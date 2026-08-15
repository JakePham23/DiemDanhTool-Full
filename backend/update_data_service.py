# backend/update_data_service.py
import os
import json
import time
import re
import shutil
from datetime import datetime
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from zalo_service import send_zalo_task
import requests

BACKEND_OUTPUT_DIR = "output_hocvien_data"
FRONTEND_OUTPUT_DIR = "../frontend/public/output_hocvien_data"

CLASS_SLUG_MAP = {
    "Chiên Con 1": "chien_con_1",
    "Chiên Con 2": "chien_con_2",
    "Ấu Nhi 1A": "au_nhi_1a",
    "Ấu Nhi 1B": "au_nhi_1b",
    "Ấu Nhi 2": "au_nhi_2",
    "Ấu Nhi 3": "au_nhi_3",
    "Thiếu Nhi 1": "thieu_nhi_1",
    "Thiếu Nhi 2": "thieu_nhi_2",
    "Thiếu Nhi 3": "thieu_nhi_3",
    "Nghĩa Sĩ": "nghia_si",
    "Hiệp Sĩ": "hiep_si",
    "Dự Trưởng": "du_truong",
}

# Biến lưu trạng thái cập nhật ngầm
update_status = {
    "is_running": False,
    "current_class": "",
    "completed_count": 0,
    "total_classes": 0,
    "last_updated": "",
    "logs": [],
    "summary": []
}

def save_json_both(filename: str, data: any):
    """Lưu file JSON đồng bộ ở cả backend và frontend public"""
    os.makedirs(BACKEND_OUTPUT_DIR, exist_ok=True)
    backend_path = os.path.join(BACKEND_OUTPUT_DIR, filename)
    with open(backend_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    try:
        os.makedirs(FRONTEND_OUTPUT_DIR, exist_ok=True)
        frontend_path = os.path.join(FRONTEND_OUTPUT_DIR, filename)
        with open(frontend_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"⚠️ Không ghi được vào frontend public: {e}", flush=True)

def send_zalo_raw(text: str):
    """Gửi trực tiếp tin nhắn thông báo tùy chỉnh đến Zalo Bot"""
    token = os.getenv("ZALO_BOT_TOKEN", "2904097519088763119:NzeuaJZIwmIOSdNxuzCSoqsBMSfAJXzMWixCfonpEUZZzvMSGYnkWlzhJUmGteMv")
    chat_id = os.getenv("CHAT_ID", "3699bc065d4bb415ed5a")
    api_url = f"https://bot-api.zaloplatforms.com/bot{token}/sendMessage"
    try:
        requests.post(api_url, json={"chat_id": chat_id, "text": text}, timeout=10)
    except Exception as e:
        print(f"❌ Lỗi gửi Zalo thông báo cập nhật: {e}", flush=True)

def perform_update_data_pipeline(driver, wait, username, password):
    """Quy trình cào và cập nhật dữ liệu toàn bộ lớp học ngầm"""
    global update_status

    if update_status["is_running"]:
        print("⚠️ Đang có một tiến trình cập nhật khác đang chạy.", flush=True)
        return

    update_status["is_running"] = True
    update_status["completed_count"] = 0
    update_status["logs"] = []
    update_status["summary"] = []

    try:
        now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        print(f"🚀 [UPDATE] Bắt đầu quy trình cập nhật dữ liệu lúc {now_str}...", flush=True)

        # 1. Truy cập Dashboard /admin để lấy danh sách các lớp
        driver.get("https://ccamspro.thongtinxuanloc.com/admin")
        time.sleep(2)

        if "login" in driver.current_url:
            username_field = wait.until(EC.presence_of_element_located((By.ID, "email")))
            username_field.clear()
            username_field.send_keys(username)
            password_field = wait.until(EC.presence_of_element_located((By.ID, "password")))
            password_field.clear()
            password_field.send_keys(password)
            btn = driver.find_element(By.XPATH, "//button[@type='submit']")
            driver.execute_script("arguments[0].click();", btn)
            time.sleep(2)

        soup = BeautifulSoup(driver.page_source, 'lxml')
        table = soup.select_one('table#lophocTable') or soup.select_one('table')
        
        dashboard_data = []
        if table:
            tbody = table.find('tbody')
            for row in tbody.find_all('tr'):
                tds = row.find_all('td')
                if len(tds) >= 8:
                    stt = tds[0].get_text(strip=True)
                    ten_lop_tag = tds[1].find('a')
                    ten_lop = ten_lop_tag.get_text(strip=True) if ten_lop_tag else tds[1].get_text(strip=True)
                    url_chi_tiet = ""
                    if ten_lop_tag and ten_lop_tag.get('href'):
                        href = ten_lop_tag.get('href')
                        url_chi_tiet = href.replace('/admin/hocvien?', '').replace('/admin/hocvien', '').replace('&amp;', '&').strip('?')
                    
                    nam = tds[2].get_text(strip=True)
                    nu = tds[3].get_text(strip=True)
                    tong = tds[4].get_text(strip=True)
                    chu_nhiem = tds[5].get_text(strip=True)
                    glv1 = tds[6].get_text(strip=True)
                    glv2 = tds[7].get_text(strip=True)

                    dashboard_data.append({
                        "stt": stt,
                        "ten_lop": ten_lop,
                        "url_chi_tiet": url_chi_tiet,
                        "nam": nam,
                        "nu": nu,
                        "tong": tong,
                        "chu_nhiem": chu_nhiem,
                        "glv1": glv1,
                        "glv2": glv2
                    })

        # 0. Dọn dẹp các file cache điểm danh cũ
        try:
            for fname in os.listdir(BACKEND_OUTPUT_DIR):
                if fname.startswith("cache_dd_") and fname.endswith(".json"):
                    os.remove(os.path.join(BACKEND_OUTPUT_DIR, fname))
            print("🧹 [UPDATE] Đã dọn dẹp các file cache điểm danh cũ.", flush=True)
        except Exception as err:
            print(f"⚠️ Không thể dọn cache điểm danh: {err}", flush=True)

        # 0.1 Cập nhật options_data.json cho Dropdown Điểm danh & Điểm danh nhanh
        try:
            from getHTML import getInitOptions
            options_res = getInitOptions(driver, wait, password, "https://ccamspro.thongtinxuanloc.com/admin/diem-danh")
            if options_res and isinstance(options_res, dict) and "nienhocs" in options_res:
                save_json_both("options_data.json", options_res)
                print("✅ [UPDATE] Đã làm mới options_data.json", flush=True)
        except Exception as opt_err:
            print(f"⚠️ Không thể làm mới options_data.json: {opt_err}", flush=True)

        # Lưu dashboard_data.json
        if dashboard_data:
            save_json_both("dashboard_data.json", dashboard_data)
            print(f"✅ [UPDATE] Đã cập nhật dashboard_data.json ({len(dashboard_data)} lớp)", flush=True)

        update_status["total_classes"] = len(dashboard_data)
        all_students_combined = []

        # 2. Cào từng lớp
        for idx, lop_item in enumerate(dashboard_data):
            ten_lop = lop_item["ten_lop"]
            url_chi_tiet = lop_item["url_chi_tiet"]
            slug = CLASS_SLUG_MAP.get(ten_lop, ten_lop.lower().replace(" ", "_"))

            update_status["current_class"] = ten_lop
            print(f"⚡ [UPDATE] ({idx + 1}/{len(dashboard_data)}) Đang cào lớp: {ten_lop}...", flush=True)

            if not url_chi_tiet:
                print(f"⚠️ Bỏ qua lớp {ten_lop} vì không có url_chi_tiet", flush=True)
                continue

            target_url = f"https://ccamspro.thongtinxuanloc.com/admin/hocvien?{url_chi_tiet}"
            driver.get(target_url)
            time.sleep(2)

            soup_lop = BeautifulSoup(driver.page_source, 'lxml')
            table_lop = soup_lop.select_one('table')
            
            students_lop = []
            if table_lop:
                tbody_lop = table_lop.find('tbody')
                tr_list = tbody_lop.find_all('tr') if tbody_lop else []

                for r_idx, tr in enumerate(tr_list):
                    tds = [td.get_text(strip=True) for td in tr.find_all('td')]
                    if not tds or len(tds) < 4:
                        continue

                    stt_val = tds[0] if len(tds) > 0 else str(r_idx + 1)
                    ten_thanh_val = tds[1] if len(tds) > 1 else ""
                    ho_val = tds[2] if len(tds) > 2 else ""
                    ten_val = tds[3] if len(tds) > 3 else ""
                    
                    # Cột 4 thường là avatar hoặc ngày sinh
                    # Nếu tds[4] chứa ngày '/' thì đó là ngày sinh
                    if len(tds) > 4 and '/' in tds[4]:
                        ngay_sinh_val = tds[4]
                        lop_val = tds[5] if len(tds) > 5 else ten_lop
                        tinh_trang_val = tds[6] if len(tds) > 6 else "Bình thường"
                        nien_hoc_val = tds[7] if len(tds) > 7 else "2025-2026"
                    else:
                        ngay_sinh_val = tds[5] if len(tds) > 5 else ""
                        lop_val = tds[6] if len(tds) > 6 else ten_lop
                        tinh_trang_val = tds[7] if len(tds) > 7 else "Bình thường"
                        nien_hoc_val = tds[8] if len(tds) > 8 else "2025-2026"

                    if '/' in lop_val:
                        ngay_sinh_val = lop_val
                        lop_val = ten_lop

                    # Click lấy ID từ panel
                    ma_hv = "N/A"
                    if r_idx < len(selenium_rows):
                        try:
                            driver.execute_script("arguments[0].click();", selenium_rows[r_idx])
                            time.sleep(0.08)
                            label = driver.find_element(By.XPATH, "//div[contains(@class, 'flex flex-col items-center')]//label[contains(@class, 'font-medium')]")
                            raw_text = label.get_attribute("textContent").strip()
                            match = re.search(r'\d+$', raw_text)
                            if match:
                                ma_hv = match.group(0)
                        except Exception:
                            pass

                    student_obj = {
                        "stt": stt_val,
                        "ma_hoc_vien": ma_hv,
                        "ten_thanh": ten_thanh_val,
                        "ho": ho_val,
                        "ten": ten_val,
                        "ngay_sinh": ngay_sinh_val,
                        "lop": lop_val,
                        "tinh_trang": tinh_trang_val,
                        "nien_hoc": nien_hoc_val
                    }
                    students_lop.append(student_obj)
                    all_students_combined.append(student_obj)

            # Lưu file lớp riêng biệt
            class_filename = f"{slug}_data.json"
            save_json_both(class_filename, students_lop)

            update_status["completed_count"] += 1
            summary_item = f"✅ {ten_lop}: {len(students_lop)} học viên"
            update_status["summary"].append(summary_item)
            print(f"   └ Hoàn tất {ten_lop}: {len(students_lop)} học viên", flush=True)

            # Gửi thông báo Zalo theo từng lớp thành công
            class_noti_msg = (
                f"📢 CẬP NHẬT LỚP THÀNH CÔNG ({update_status['completed_count']}/{len(dashboard_data)})\n"
                f"🏫 Lớp: {ten_lop}\n"
                f"📊 Sĩ số: {len(students_lop)} học viên (Nam: {lop_item.get('nam', '0')}, Nữ: {lop_item.get('nu', '0')})\n"
                f"⏰ Thời gian: {datetime.now().strftime('%H:%M:%S - %d/%m/%Y')}"
            )
            send_zalo_raw(class_noti_msg)

        # 3. Lưu all_data.json
        if all_students_combined:
            save_json_both("all_data.json", all_students_combined)
            print(f"✅ [UPDATE] Đã cập nhật all_data.json (Tổng cộng: {len(all_students_combined)} học viên)", flush=True)

        # 4. Gửi thông báo Zalo Tổng Kết Hoàn Tất
        finish_time = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        update_status["last_updated"] = finish_time

        summary_lines = "\n".join([f"{i+1}. {item}" for i, item in enumerate(update_status["summary"])])
        final_noti_msg = (
            f"🎉 CẬP NHẬT DỮ LIỆU DANH SÁCH HOÀN TẤT\n"
            f"🏫 Giáo Xứ Thiên Phú (Niên khóa 2025-2026)\n"
            f"--------------------------\n"
            f"{summary_lines}\n"
            f"--------------------------\n"
            f"📊 Tổng cộng: {len(all_students_combined)} học viên\n"
            f"⏰ Hoàn tất lúc: {finish_time}"
        )
        send_zalo_raw(final_noti_msg)
        print("🎉 [UPDATE] Toàn bộ dữ liệu danh sách đã được làm mới thành công!", flush=True)

    except Exception as e:
        print(f"❌ [UPDATE ERROR]: {str(e)}", flush=True)
        send_zalo_raw(f"⚠️ CẢNH BÁO: Quá trình cập nhật danh sách gặp lỗi: {str(e)}")
    finally:
        update_status["is_running"] = False
