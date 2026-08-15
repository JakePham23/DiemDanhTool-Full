import os
import json
import time
import asyncio
import threading
import subprocess
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# Selenium Imports
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Import các hàm helper của bạn
# LƯU Ý: Bạn cần đảm bảo hàm getListDiemDanhByInfo trong getHTML.py đã được sửa để nhận tham số driver
from getHTML import (
    scraper, 
    getInitOptions, 
    convert_url_to_amp_entity, 
    slugify_key, 
    getListDiemDanhByInfo 
)
from zalo_service import send_zalo_task
from dibu_service import scrape_attendance_by_range, build_dibu_summary

load_dotenv()

# --- CẤU HÌNH ĐĂNG NHẬP CCAMS (ĐỌC TỪ .ENV) ---
FIXED_USERNAME = os.getenv("CCAMS_USERNAME", "")
FIXED_PASSWORD = os.getenv("CCAMS_PASSWORD", "")
BASE_URL = os.getenv("CCAMS_BASE_URL", "https://ccamspro.thongtinxuanloc.com")
DIEMDANH_BASE_URL = f"{BASE_URL}/admin/diem-danh"

if not FIXED_USERNAME or not FIXED_PASSWORD:
    print("⚠️ [CẢNH BÁO] Chưa thiết lập CCAMS_USERNAME hoặc CCAMS_PASSWORD trong file .env!")

HOME_DIR = os.path.expanduser("~") 
STAGING_DIR = os.path.join(HOME_DIR, "pipeline_data", "staging")
os.makedirs(STAGING_DIR, exist_ok=True)

def find_chrome_binary():
    import shutil
    candidates = [
        shutil.which("google-chrome"),
        shutil.which("google-chrome-stable"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None

# --- 1. CLASS QUẢN LÝ BROWSER (SINGLETON) ---
class BrowserManager:
    def __init__(self):
        self.driver = None
        self.wait = None
        self.lock = asyncio.Lock() # Khóa an toàn luồng

    def start_and_login(self, username, password):
        print("🚀 [SYSTEM] Khởi động Browser & Đăng nhập lần đầu...")
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        
        chrome_bin = find_chrome_binary()
        if chrome_bin:
            print(f"🌐 [CHROME] Sử dụng Chrome binary tại: {chrome_bin}")
            options.binary_location = chrome_bin
        else:
            print("⚠️ [CHROME] Không tìm thấy Chrome binary trên máy. Nếu gặp lỗi, vui lòng cài google-chrome hoặc chromium-browser.")

        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        self.wait = WebDriverWait(self.driver, 10)

        try:
            self.driver.get(BASE_URL + '/admin')
            if "login" in self.driver.current_url:
                print("🔑 [SYSTEM] Đang thực hiện đăng nhập...")
                self._perform_login(username, password)
            else:
                print("ℹ️ [SYSTEM] Đã có phiên đăng nhập sẵn.")

        except Exception as e:
            print(f"❌ [SYSTEM] Lỗi khởi động: {e}")
            self.close()
            raise e

    def _perform_login(self, username, password):
        """Thực hiện đăng nhập khi bị out phiên"""
        try:
            username_field = self.wait.until(EC.presence_of_element_located((By.ID, "email")))
            username_field.clear()
            username_field.send_keys(username)
            
            password_field = self.wait.until(EC.presence_of_element_located((By.ID, "password")))
            password_field.clear()
            password_field.send_keys(password)
            
            login_button = self.wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']")))
            self.driver.execute_script("arguments[0].click();", login_button)
            
            self.wait.until(EC.url_contains("/admin"))
            print("✅ [SYSTEM] Đăng nhập thành công!")
        except Exception as e:
            print(f"❌ [SYSTEM] Lỗi đăng nhập: {e}")
            raise e

    def ensure_logged_in(self, username, password):
        """
        Đảm bảo trình duyệt đã bật và phiên còn sống.
        CHỈ đăng nhập 1 lần, nếu bị out phiên mới đăng nhập lại.
        """
        if not self.driver:
            self.start_and_login(username, password)
            return

        try:
            # Kiểm tra trạng thái hiện tại của trình duyệt
            current_url = self.driver.current_url
            if "login" in current_url:
                print("🔄 [SYSTEM] Phát hiện bị out phiên, đang đăng nhập lại...")
                self._perform_login(username, password)
        except Exception as e:
            print(f"⚠️ [SYSTEM] Driver cần khởi động lại: {e}")
            self.close()
            self.start_and_login(username, password)

    def close(self):
        if self.driver:
            print("🛑 [SYSTEM] Đang đóng Browser...")
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None

# Khởi tạo instance toàn cục
browser_manager = BrowserManager()

# --- TỰ ĐỘNG KHỞI ĐỘNG FRONTEND ---
frontend_process = None

def is_port_in_use(port: int) -> bool:
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(('127.0.0.1', port)) == 0
    except Exception:
        return False

def start_frontend():
    global frontend_process
    if is_port_in_use(3000):
        print("ℹ️ [FRONTEND] Frontend đã đang chạy trên http://localhost:3000.")
        return

    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
    if os.path.exists(frontend_dir):
        print("🚀 [FRONTEND] Đang khởi động Next.js Frontend trên cổng 3000...")
        import shutil

        # Tìm đường dẫn npm động (hỗ trợ Linux, macOS, nvm, homebrew)
        npm_bin = shutil.which("npm")
        if not npm_bin:
            common_paths = [
                os.path.expanduser("~/.nvm/versions/node/v22.20.0/bin/npm"),
                "/usr/local/bin/npm",
                "/opt/homebrew/bin/npm",
                "/usr/bin/npm"
            ]
            for p in common_paths:
                if os.path.exists(p):
                    npm_bin = p
                    break

        if not npm_bin:
            npm_bin = "npm"

        env = os.environ.copy()
        if "/" in npm_bin:
            node_dir = os.path.dirname(npm_bin)
            env["PATH"] = f"{node_dir}:{env.get('PATH', '')}"

        # Kiểm tra node_modules
        node_modules_path = os.path.join(frontend_dir, "node_modules")
        if not os.path.exists(node_modules_path):
            print("📦 [FRONTEND] Chưa có node_modules, đang tự động chạy npm install...")
            try:
                subprocess.run([npm_bin, "install"], cwd=frontend_dir, env=env, check=True)
            except Exception as err:
                print(f"⚠️ [FRONTEND] Lỗi chạy npm install: {err}")

        try:
            log_path = os.path.join(os.path.dirname(__file__), "frontend_dev.log")
            log_file = open(log_path, "w", encoding="utf-8")
            frontend_process = subprocess.Popen(
                [npm_bin, "run", "dev", "--", "-p", "3000", "-H", "0.0.0.0"],
                cwd=frontend_dir,
                env=env,
                stdout=log_file,
                stderr=log_file
            )
            print(f"✅ [FRONTEND] Đã kích hoạt Next.js Frontend nền (Port 3000, Host 0.0.0.0 - Log: {log_path})!")

            def check_frontend_status():
                time.sleep(3)
                if frontend_process and frontend_process.poll() is not None:
                    print(f"❌ [FRONTEND] Frontend bị dừng bất thường (Mã thoát: {frontend_process.returncode})!")
                    try:
                        with open(log_path, "r", encoding="utf-8") as f:
                            err_content = f.read().strip()
                            if err_content:
                                print(f"📋 [FRONTEND LOG LỖI]:\n{err_content}\n---")
                    except Exception:
                        pass

            threading.Thread(target=check_frontend_status, daemon=True).start()
        except Exception as e:
            print(f"⚠️ [FRONTEND] Không thể tự khởi động frontend: {e}")

def stop_frontend():
    global frontend_process
    if frontend_process:
        print("🛑 [FRONTEND] Đang tắt Frontend...")
        try:
            frontend_process.terminate()
        except Exception:
            pass
        frontend_process = None

# --- 2. LIFESPAN (VÒNG ĐỜI SERVER) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP: Tự load frontend & khởi động browser ngầm không bị đơ server
    start_frontend()
    def background_startup():
        try:
            browser_manager.start_and_login(FIXED_USERNAME, FIXED_PASSWORD)
            # Khởi động worker tự động quét & gom theo Khối gửi bù mỗi 2 phút
            start_retry_worker_loop(browser_manager, FIXED_USERNAME, FIXED_PASSWORD)
        except Exception as e:
            print(f"⚠️ [BROWSER] Lỗi khởi động ngầm: {e}")

    threading.Thread(target=background_startup, daemon=True).start()
    
    yield
    
    # SHUTDOWN
    browser_manager.close()
    stop_frontend()

# --- 3. KHỞI TẠO APP FASTAPI (CHỈ 1 LẦN DUY NHẤT) ---
app = FastAPI(title="CCAMS Scraper API", lifespan=lifespan)

# Cấu hình CORS
origins = ["http://localhost:3000", "http://127.0.0.1:3000", "https://diemdanhd2tool.vercel.app"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],    
    allow_headers=["*"],
)

# --- 4. CÁC MODELS & HELPER FUNCTIONS ---
class ScrapeConfig(BaseModel):
    url_navigation: str

class DibuRequest(BaseModel):
    from_date: str = "01/06/2026"
    to_date: str = "14/08/2026"
    nien_hoc: str = "4"
    khoi: str = "3"
    lop: str = "45"
    force_scrape: bool = True

def save_to_file_task(data, url_nav):
    """Hàm chạy nền: Lưu file JSON xuống ổ cứng"""
    try:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = f"diemdanh_{timestamp}.json"
        filepath = os.path.join(STAGING_DIR, filename)
        
        final_content = {
            "metadata": { "source_url": url_nav, "scraped_at": timestamp },
            "data": data
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(final_content, f, ensure_ascii=False, indent=2)
            
        print(f"✅ [SYSTEM] Đã lưu file staging: {filepath}")
    except Exception as e:
        print(f"❌ [ERROR] Không lưu được file: {e}")

def send_zalo_diemdanh_task(data, url_nav):
    """Hàm chạy nền: Tự động gửi thông báo Zalo khi cào xong dữ liệu điểm danh"""
    try:
        from urllib.parse import parse_qs, urlparse
        parsed_url = urlparse(url_nav)
        qs = parse_qs(parsed_url.query)
        
        report_type = qs.get("filter", [""])[0]
        malophoc = qs.get("MALOPHOC", [""])[0]
        makhoi = qs.get("MAKHOI", [""])[0]
        date_str = qs.get("from", [""])[0]

        if data and isinstance(data, list) and len(data) > 0:
            print(f"📲 [ZALO] Đang gửi thông báo cho {len(data)} học viên ({report_type})...")
            send_zalo_task(data, report_type=report_type, malophoc=malophoc, makhoi=makhoi, date_str=date_str)
    except Exception as e:
        print(f"❌ [ZALO ERROR]: {e}")

# --- 5. ENDPOINTS ---

@app.get("/")
def read_root():
    return {"message": "CCAMS API đang hoạt động."}

@app.get("/api/scrape")
def scrape_dashboard():
    """Endpoint lấy dữ liệu dashboard (từ file cache hoặc chạy tool cũ)"""
    try:
        result = ''
        # Logic này đang đọc file cache, bạn có thể giữ nguyên
        if os.path.exists('output_hocvien_data/dashboard_data.json'):
            with open('output_hocvien_data/dashboard_data.json', 'r') as file:
                result = json.load(file)
        else:
             return {"status": "error", "message": "Chưa có dữ liệu cache dashboard"}

        if isinstance(result, dict) and ("error" in result or "warning" in result):
            raise HTTPException(status_code=400, detail=result.get("error") or result.get("warning"))

        return {"status": "success", "data": result, "count": len(result)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi Server: {str(e)}")

@app.post("/api/scrape/grade")
def scrape_grade_detail(config: ScrapeConfig):
    """Endpoint lấy chi tiết lớp (từ file cache)"""
    try:
        print(config.url_navigation)
        result = ''
        params = convert_url_to_amp_entity(config.url_navigation)
        params = params.replace( "&amp;", "&").replace( "/admin/hocvien?", "")
        
        is_all_classes = ('MAKHOI=all' in params and 'MALOPHOC=all' in params)
        
        if is_all_classes:
            with open('output_hocvien_data/all_data.json', 'r') as file:
                result = json.load(file)
        else:
            with open('output_hocvien_data/dashboard_data.json', 'r') as file:
                data = json.load(file)
            ten_lop_tim_thay = None
            for lop_hoc in data:
                if lop_hoc.get("url_chi_tiet") == params:
                    ten_lop_tim_thay = lop_hoc.get("ten_lop")
                    break
            
            if ten_lop_tim_thay:
                ten_lop_tim_thay = slugify_key(ten_lop_tim_thay)
                filename = f'output_hocvien_data/{ten_lop_tim_thay}_data.json'
                with open(filename, 'r') as file:
                    result = json.load(file)
            else:
                 return {"status": "error", "message": "Không tìm thấy lớp trong cache"}

        if isinstance(result, dict) and ("error" in result or "warning" in result):
            raise HTTPException(status_code=400, detail=result.get("error"))

        return {"status": "success", "data": result, "count": len(result)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi Server: {str(e)}")

@app.get("/api/scrape/diemdanh/init")
async def get_diemdanh_options():
    """Endpoint lấy options khởi tạo (Tái sử dụng browser, chỉ đăng nhập 1 lần)"""
    async with browser_manager.lock:
        try:
            browser_manager.ensure_logged_in(FIXED_USERNAME, FIXED_PASSWORD)
            result = getInitOptions(browser_manager.driver, browser_manager.wait, FIXED_PASSWORD, DIEMDANH_BASE_URL)

            if isinstance(result, dict) and "error" in result:
                raise HTTPException(status_code=400, detail=result.get("error"))

            return {"status": "success", "data": result}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Lỗi Server: {str(e)}")

# --- ENDPOINT QUAN TRỌNG ĐÃ TỐI ƯU ---
@app.post("/api/scrape/diemdanh/data")
async def scrape_diemdanh_data(config: ScrapeConfig, background_tasks: BackgroundTasks):
    """
    Endpoint CÀO DỮ LIỆU ĐIỂM DANH:
    1. Sử dụng Browser đã login sẵn (siêu nhanh, chỉ đăng nhập 1 lần).
    2. Chỉ đăng nhập lại khi bị out phiên.
    3. Có cơ chế khóa (Lock) để tránh xung đột.
    """
    async with browser_manager.lock:
        try:
            browser_manager.ensure_logged_in(FIXED_USERNAME, FIXED_PASSWORD)
            print(f"⚡ [API] Nhận request scrape: {config.url_navigation}")
            
            result = getListDiemDanhByInfo(browser_manager.driver, browser_manager.wait, config.url_navigation)

            if isinstance(result, dict) and "error" in result:
                # Nếu lỗi session expired, đăng nhập lại và thử lại 1 lần
                if "Session expired" in str(result["error"]) or "login" in browser_manager.driver.current_url:
                    print("🔄 Session chết, đang đăng nhập lại...")
                    browser_manager._perform_login(FIXED_USERNAME, FIXED_PASSWORD)
                    result = getListDiemDanhByInfo(browser_manager.driver, browser_manager.wait, config.url_navigation)
                else:
                    raise HTTPException(status_code=400, detail=result.get("error"))

            # --- BACKGROUND TASKS ---
            background_tasks.add_task(save_to_file_task, result, config.url_navigation)

            return {"status": "success", "data": result, "count": len(result) if isinstance(result, list) else 0}

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Lỗi Server: {str(e)}")

@app.get("/api/scrape/dibu/cache")
def get_dibu_cache():
    """Lấy dữ liệu đi bù đã tổng hợp từ cache JSON"""
    try:
        cache_path = 'output_hocvien_data/dibu_thieu_nhi_1_summary.json'
        if os.path.exists(cache_path):
            with open(cache_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return {"status": "success", "data": data}
        else:
            return {"status": "error", "message": "Chưa có dữ liệu cache đi bù"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi Server: {str(e)}")

@app.post("/api/scrape/dibu")
async def scrape_and_summarize_dibu(req: DibuRequest):
    """
    Endpoint CÀO VÀ TỔNG HỢP SỐ BUỔI ĐI BÙ:
    - Sử dụng phiên đăng nhập hiện tại, không đăng nhập lại nếu còn sống.
    - Cào dữ liệu thực tế từ web CCAMS theo khoảng thời gian.
    - Đối soát với bảng điểm HK2 và tính số buổi còn thiếu.
    """
    # Nếu không bắt buộc force_scrape và có cache phù hợp cho Thiếu Nhi 1, có thể trả về cache
    cache_path = 'output_hocvien_data/dibu_thieu_nhi_1_summary.json'
    if not req.force_scrape and str(req.lop) == "45" and os.path.exists(cache_path):
        with open(cache_path, 'r', encoding='utf-8') as f:
            cached = json.load(f)
            if cached.get("metadata", {}).get("from_date") == req.from_date and cached.get("metadata", {}).get("to_date") == req.to_date:
                return {"status": "success", "data": cached}

    async with browser_manager.lock:
        try:
            browser_manager.ensure_logged_in(FIXED_USERNAME, FIXED_PASSWORD)

            print(f"⚡ [API DIBU] Cào dữ liệu đi bù từ {req.from_date} đến {req.to_date} cho lớp {req.lop}...")
            
            raw_sessions = scrape_attendance_by_range(
                browser_manager.driver,
                browser_manager.wait,
                from_date=req.from_date,
                to_date=req.to_date,
                nien_hoc=req.nien_hoc,
                khoi=req.khoi,
                lop=req.lop
            )
            
            if isinstance(raw_sessions, dict) and "error" in raw_sessions:
                if "Session expired" in str(raw_sessions["error"]) or "login" in browser_manager.driver.current_url:
                    print("🔄 Session chết, đang đăng nhập lại...")
                    browser_manager._perform_login(FIXED_USERNAME, FIXED_PASSWORD)
                    raw_sessions = scrape_attendance_by_range(
                        browser_manager.driver,
                        browser_manager.wait,
                        from_date=req.from_date,
                        to_date=req.to_date,
                        nien_hoc=req.nien_hoc,
                        khoi=req.khoi,
                        lop=req.lop
                    )
                else:
                    raise HTTPException(status_code=400, detail=raw_sessions.get("error"))

            summary_result = build_dibu_summary(raw_sessions, req.from_date, req.to_date, lop_id=req.lop)
            return {"status": "success", "data": summary_result}

        except Exception as e:
            print(f"❌ [ERROR DIBU]: {e}")
            raise HTTPException(status_code=500, detail=f"Lỗi khi cào dữ liệu đi bù: {str(e)}")

class ZaloNotifyRequest(BaseModel):
    data: list
    report_type: str = ""
    malophoc: Optional[str] = None
    makhoi: Optional[str] = None
    date_str: Optional[str] = None

@app.post("/api/notification/zalo")
def api_send_zalo(req: ZaloNotifyRequest):
    """Endpoint gửi thông báo Zalo Bot từ server"""
    try:
        send_zalo_task(
            data=req.data,
            report_type=req.report_type,
            malophoc=req.malophoc,
            makhoi=req.makhoi,
            date_str=req.date_str
        )
        return {"status": "success", "message": "Đã gửi thông báo Zalo"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi gửi Zalo: {str(e)}")

# --- ENDPOINT CẬP NHẬT DỮ LIỆU DANH SÁCH HỌC VIÊN CHẠY NGẦM ---
from update_data_service import perform_update_data_pipeline, update_status

@app.post("/api/update-data")
async def trigger_update_data(background_tasks: BackgroundTasks):
    """Kích hoạt cập nhật danh sách tất cả các lớp chạy ngầm và gửi Zalo khi hoàn tất"""
    if update_status["is_running"]:
        return {
            "status": "already_running",
            "message": f"Đang cập nhật lớp {update_status.get('current_class', '...')} ({update_status.get('completed_count', 0)}/{update_status.get('total_classes', 12)})"
        }

    async with browser_manager.lock:
        browser_manager.ensure_logged_in(FIXED_USERNAME, FIXED_PASSWORD)

    background_tasks.add_task(
        perform_update_data_pipeline,
        browser_manager.driver,
        browser_manager.wait,
        FIXED_USERNAME,
        FIXED_PASSWORD
    )

    return {
        "status": "started",
        "message": "Đã khởi động tiến trình cập nhật ngầm. Kết quả từng lớp sẽ được gửi về Zalo Bot."
    }

@app.get("/api/update-data/status")
def get_update_data_status():
    """Lấy tiến độ cập nhật danh sách học viên"""
    return {
        "status": "success",
        "data": update_status
    }

# --- ENDPOINT ĐIỂM DANH NHANH (QUICK CHECKIN & QUEUE) ---
from quick_checkin_service import perform_batch_checkin
from checkin_queue_service import start_retry_worker_loop, get_queue

class QuickCheckinRequest(BaseModel):
    student_ids: List[str]
    date_str: str # DD/MM/YYYY e.g. "15/08/2025"
    checkin_type: str = "hiendien_tle" # "hiendien_tle" | "hiendien_gly"
    students_info: List[dict] = []
    lop_name: str = ""
    khoi_name: str = ""
    excluded_count: int = 0

@app.post("/api/checkin/quick")
async def api_quick_checkin(req: QuickCheckinRequest):
    """Endpoint điểm danh nhanh hàng loạt cho danh sách học viên có lưu tạm & tự động thử lại"""
    async with browser_manager.lock:
        try:
            browser_manager.ensure_logged_in(FIXED_USERNAME, FIXED_PASSWORD)
            result = perform_batch_checkin(
                driver=browser_manager.driver,
                wait=browser_manager.wait,
                student_ids=req.student_ids,
                date_str=req.date_str,
                checkin_type=req.checkin_type,
                students_info=req.students_info,
                lop_name=req.lop_name,
                khoi_name=req.khoi_name,
                excluded_count=req.excluded_count
            )
            
            # Nếu được xếp vào hàng đợi chờ tự động gửi lại sau 2 phút
            if result.get("queued_retry"):
                return {
                    "status": "queued_retry",
                    "data": result,
                    "message": result.get("message")
                }

            if not result.get("success"):
                raise HTTPException(status_code=400, detail=result.get("error") or result.get("message"))
            
            return {"status": "success", "data": result}
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ [QUICK CHECKIN ERROR]: {e}", flush=True)
            raise HTTPException(status_code=500, detail=f"Lỗi điểm danh nhanh: {str(e)}")

@app.get("/api/checkin/queue-status")
def get_checkin_queue_status():
    """Lấy danh sách các tác vụ điểm danh đang chờ tự động gửi lại"""
    queue = get_queue()
    pending = [t for t in queue if t.get("status") in ["pending", "failed_pending_retry"]]
    return {
        "status": "success",
        "pending_count": len(pending),
        "items": queue
    }

if __name__ == "__main__":
    import uvicorn
    import threading
    import webbrowser

    def open_browser():
        # Đợi frontend khởi động xong trên cổng 3000
        for _ in range(20):
            time.sleep(0.5)
            if is_port_in_use(3000):
                break
        time.sleep(1)
        print("🌐 [BROWSER] Đang mở giao diện Tool Theo Dõi Đi Bù trên http://localhost:3000/dibu...")
        webbrowser.open("http://localhost:3000/dibu")

    threading.Thread(target=open_browser, daemon=True).start()
    print("🚀 [SERVER] Khởi chạy backend trên http://localhost:3001...")
    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=False)