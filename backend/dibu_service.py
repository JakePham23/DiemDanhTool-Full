import os
import json
import time
import re
import unicodedata
import pandas as pd
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = 'https://ccamspro.thongtinxuanloc.com'
DIEMDANH_URL = f'{BASE_URL}/admin/diem-danh'

def vietnamese_normalize(text):
    if not text:
        return ''
    text = unicodedata.normalize('NFC', str(text).strip().lower())
    text = text.replace('oà', 'òa').replace('oá', 'óa').replace('oả', 'ỏa').replace('oã', 'õa').replace('oạ', 'ọa')
    text = text.replace('uỳ', 'ùy').replace('uý', 'úy').replace('uỷ', 'ủy').replace('uỹ', 'ũy').replace('uỵ', 'ụy')
    text = text.replace('oè', 'òe').replace('oé', 'óe').replace('oẻ', 'ỏe').replace('oẽ', 'õe').replace('oẹ', 'ọe')
    return re.sub(r'\s+', ' ', text)

def format_date_to_vn(date_str):
    """Normalize date to DD/MM/YYYY."""
    if not date_str:
        return ''
    date_str = str(date_str).strip()
    if '-' in date_str:
        # e.g. 2026-06-01 -> 01/06/2026
        parts = date_str.split('-')
        if len(parts) == 3 and len(parts[0]) == 4:
            return f"{parts[2].zfill(2)}/{parts[1].zfill(2)}/{parts[0]}"
    return date_str

def scrape_attendance_by_range(driver, wait, from_date, to_date, nien_hoc="4", khoi="3", lop="45"):
    """
    Scrapes all attendance records from CCAMS within a date range.
    """
    from_date_vn = format_date_to_vn(from_date)
    to_date_vn = format_date_to_vn(to_date)
    
    print(f"🔍 [SCRAPER DIBU] Đang cào dữ liệu từ {from_date_vn} đến {to_date_vn} (Nienhoc={nien_hoc}, Khoi={khoi}, Lop={lop})...")
    
    driver.get(DIEMDANH_URL)
    time.sleep(1.5)
    
    if "login" in driver.current_url:
        return {"error": "Session expired. Need re-login."}
        
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.bg-gray-100 select")))
    
    select_els = driver.find_elements(By.CSS_SELECTOR, "div.bg-gray-100 select")
    if len(select_els) >= 4:
        try:
            Select(select_els[0]).select_by_value(str(nien_hoc))
        except Exception:
            pass
        time.sleep(0.3)
        try:
            Select(select_els[1]).select_by_value(str(khoi))
        except Exception:
            pass
        time.sleep(0.3)
        try:
            Select(select_els[2]).select_by_value(str(lop))
        except Exception:
            pass
        time.sleep(0.3)
        try:
            Select(select_els[3]).select_by_value('hiendien_all')
        except Exception:
            pass
            
    # Set date inputs
    from_inp = driver.find_element(By.ID, "from")
    to_inp = driver.find_element(By.ID, "to")
    
    driver.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input')); arguments[0].dispatchEvent(new Event('change'));", from_inp, from_date_vn)
    driver.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input')); arguments[0].dispatchEvent(new Event('change'));", to_inp, to_date_vn)
    time.sleep(0.5)
    
    # Click search button
    search_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(@class, 'bg-blue-500') and .//i[contains(@class, 'fa-search')]]")))
    driver.execute_script("arguments[0].click();", search_btn)
    time.sleep(1.5)
    
    all_rows = []
    current_page = 1
    max_pages = 100
    
    while current_page <= max_pages:
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        table = soup.find('table')
        tbody = table.find('tbody') if table else None
        if not tbody:
            break
        rows = tbody.find_all('tr')
        if not rows:
            break
            
        rows_in_page = 0
        for r in rows:
            tds = [td.get_text(strip=True) for td in r.find_all('td')]
            if len(tds) >= 10:
                # tds: [STT, Mã Học Viên, Tên Thánh, Họ, Tên, Lớp, Khối, Người Điểm Danh, Loại Điểm Danh, Ngày Điểm Danh, Ngày giờ Điểm Danh, ...]
                ngay_gio = tds[10] if len(tds) > 10 else ''
                ngay = ngay_gio.split(' ')[0] if ' ' in ngay_gio else ''
                gio = ngay_gio.split(' ')[1] if ' ' in ngay_gio else ''
                
                full_name = f"{tds[3]} {tds[4]}".strip()
                all_rows.append({
                    "stt": len(all_rows) + 1,
                    "ma_hoc_vien": tds[1],
                    "ten_thanh": tds[2],
                    "ho": tds[3],
                    "ten": tds[4],
                    "full_name": full_name,
                    "lop": tds[5],
                    "khoi": tds[6],
                    "nguoi_diem_danh": tds[7],
                    "thu": tds[9],
                    "ngay": ngay,
                    "gio": gio,
                    "ngay_gio": ngay_gio
                })
                rows_in_page += 1
                
        if rows_in_page < 50:
            break
            
        current_page += 1
        try:
            next_btn = driver.find_element(By.XPATH, f"//button[text()='{current_page}' and not(@disabled)]")
            driver.execute_script("arguments[0].scrollIntoView(true); arguments[0].click();", next_btn)
            time.sleep(1)
        except Exception:
            try:
                next_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Tiếp') and not(@disabled)]")
                driver.execute_script("arguments[0].scrollIntoView(true); arguments[0].click();", next_btn)
                time.sleep(1)
            except Exception:
                break
                
    return all_rows

CLASS_ID_MAP = {
    "39": {"name": "Chiên Con 1", "khoi": "1", "slug": "chien_con_1"},
    "40": {"name": "Chiên Con 2", "khoi": "1", "slug": "chien_con_2"},
    "41": {"name": "Ấu Nhi 1A", "khoi": "2", "slug": "au_nhi_1a"},
    "42": {"name": "Ấu Nhi 1B", "khoi": "2", "slug": "au_nhi_1b"},
    "43": {"name": "Ấu Nhi 2", "khoi": "2", "slug": "au_nhi_2"},
    "44": {"name": "Ấu Nhi 3", "khoi": "2", "slug": "au_nhi_3"},
    "45": {"name": "Thiếu Nhi 1", "khoi": "3", "slug": "thieu_nhi_1"},
    "46": {"name": "Thiếu Nhi 2", "khoi": "3", "slug": "thieu_nhi_2"},
    "47": {"name": "Thiếu Nhi 3", "khoi": "3", "slug": "thieu_nhi_3"},
    "49": {"name": "Nghĩa Sĩ", "khoi": "4", "slug": "nghia_si"},
    "50": {"name": "Hiệp Sĩ", "khoi": "5", "slug": "hiep_si"},
}

def build_dibu_summary(raw_sessions, from_date, to_date, class_name=None, lop_id="45"):
    """
    Tổng hợp dữ liệu số buổi đi của học viên:
    1. Nếu có dữ liệu HK2 / số buổi cần bù trong năm: Tính số buổi còn thiếu sau khi bù (so_can_bu - so_da_di).
    2. Nếu chưa có dữ liệu cả năm: Liệt kê tổng số buổi đã đi trong khoảng thời gian đã chọn.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Xác định thông tin lớp
    class_info = CLASS_ID_MAP.get(str(lop_id), {})
    actual_class_name = class_info.get("name") or class_name or "Thiếu Nhi 1"
    class_slug = class_info.get("slug") or "thieu_nhi_1"
    
    # 1. Kiểm tra xem có file bảng điểm HK2 cả năm của lớp này không
    hk2_json_path = os.path.join(base_dir, 'output_hocvien_data', f'{class_slug}_bangdiem_hk2.json')
    has_yearly_data = False
    students_base = []
    
    if os.path.exists(hk2_json_path):
        try:
            with open(hk2_json_path, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
                if loaded and isinstance(loaded, list) and any(s.get('so_buoi_can_bu', 0) > 0 for s in loaded):
                    students_base = loaded
                    has_yearly_data = True
        except Exception as e:
            print(f"⚠️ Lỗi đọc file HK2 {hk2_json_path}: {e}")
            
    # 2. Nếu không có file HK2 cả năm, lấy danh sách học viên lớp từ file data lớp hoặc all_data.json
    if not students_base:
        class_data_path = os.path.join(base_dir, 'output_hocvien_data', f'{class_slug}_data.json')
        if os.path.exists(class_data_path):
            with open(class_data_path, 'r', encoding='utf-8') as f:
                students_base = json.load(f)
        else:
            all_data_path = os.path.join(base_dir, 'output_hocvien_data', 'all_data.json')
            if os.path.exists(all_data_path):
                with open(all_data_path, 'r', encoding='utf-8') as f:
                    all_students = json.load(f)
                    students_base = [s for s in all_students if vietnamese_normalize(s.get('lop', '')) == vietnamese_normalize(actual_class_name)]
                    
    # Đếm số buổi đi thực tế theo mã học viên và họ tên
    counts_by_norm_name = {}
    counts_by_mahv = {}
    
    for s in raw_sessions:
        fn = s.get('full_name', '')
        norm_fn = vietnamese_normalize(fn)
        mahv = str(s.get('ma_hoc_vien', '')).strip()
        
        if norm_fn:
            counts_by_norm_name[norm_fn] = counts_by_norm_name.get(norm_fn, 0) + 1
        if mahv:
            counts_by_mahv[mahv] = counts_by_mahv.get(mahv, 0) + 1
            
    summary_students = []
    seen_mahv = set()
    
    for idx, st in enumerate(students_base):
        fn = st.get('full_name') or f"{st.get('ho', '')} {st.get('ten', '')}".strip()
        norm_fn = vietnamese_normalize(fn)
        mahv = str(st.get('ma_hoc_vien', '')).strip()
        if mahv:
            seen_mahv.add(mahv)
            
        so_da_di = counts_by_mahv.get(mahv, counts_by_norm_name.get(norm_fn, 0))
        
        if has_yearly_data:
            # Có dữ liệu cả năm -> Tính số buổi thiếu sau bù
            so_can_bu = st.get('so_buoi_can_bu', 0)
            so_con_thieu = max(0, so_can_bu - so_da_di)
            if so_can_bu > 0:
                if so_con_thieu == 0:
                    trang_thai = "ĐÃ HOÀN THÀNH BÙ"
                    danh_gia = f"Đã bù đủ ({so_da_di}/{so_can_bu})"
                else:
                    trang_thai = f"CÒN THIẾU {so_con_thieu} BUỔI"
                    danh_gia = f"Thiếu {so_con_thieu} buổi ({so_da_di}/{so_can_bu})"
            else:
                trang_thai = "ĐẠT (Không cần bù)"
                danh_gia = f"Đạt chuyên cần (Đi thêm {so_da_di}b)"
        else:
            # Chưa có dữ liệu cả năm -> Chỉ liệt kê tổng số buổi đã đi trong kỳ
            so_can_bu = 0
            so_con_thieu = 0
            if so_da_di > 0:
                trang_thai = f"ĐÃ ĐI {so_da_di} BUỔI"
                danh_gia = f"Đã tham gia {so_da_di} buổi ({format_date_to_vn(from_date)} - {format_date_to_vn(to_date)})"
            else:
                trang_thai = "CHƯA GHI NHẬN"
                danh_gia = "Chưa có lượt điểm danh trong kỳ"
                
        summary_students.append({
            "stt": st.get('stt') or (idx + 1),
            "ma_hoc_vien": mahv,
            "ten_thanh": st.get('ten_thanh', ''),
            "ho": st.get('ho', ''),
            "ten": st.get('ten', ''),
            "full_name": fn,
            "lop": actual_class_name,
            "chuyen_can_70": st.get('chuyen_can_70', 70) if has_yearly_data else None,
            "so_buoi_can_bu": so_can_bu,
            "so_buoi_da_di_bu": so_da_di,
            "so_buoi_con_thieu": so_con_thieu,
            "trang_thai": trang_thai,
            "danh_gia": danh_gia,
            "ghi_chu_goc": st.get('ghi_chu_goc', ''),
            "tb_canam": st.get('tb_canam', ''),
            "xep_loai_ht": st.get('xep_loai_ht', ''),
            "xep_loai_hk": st.get('xep_loai_hk', '')
        })
        
    # Bổ sung học viên có trong lượt cào nhưng chưa có trong danh sách gốc
    for s in raw_sessions:
        mahv = str(s.get('ma_hoc_vien', '')).strip()
        fn = s.get('full_name', '')
        norm_fn = vietnamese_normalize(fn)
        if mahv and mahv not in seen_mahv:
            seen_mahv.add(mahv)
            so_da_di = counts_by_mahv.get(mahv, 1)
            summary_students.append({
                "stt": len(summary_students) + 1,
                "ma_hoc_vien": mahv,
                "ten_thanh": s.get('ten_thanh', ''),
                "ho": s.get('ho', ''),
                "ten": s.get('ten', ''),
                "full_name": fn,
                "lop": s.get('lop') or actual_class_name,
                "chuyen_can_70": None,
                "so_buoi_can_bu": 0,
                "so_buoi_da_di_bu": so_da_di,
                "so_buoi_con_thieu": 0,
                "trang_thai": f"ĐÃ ĐI {so_da_di} BUỔI",
                "danh_gia": f"Đã tham gia {so_da_di} buổi",
                "ghi_chu_goc": "",
                "tb_canam": "",
                "xep_loai_ht": "",
                "xep_loai_hk": ""
            })
            
    # Thống kê tổng quan
    total_active = len([s for s in summary_students if s['so_buoi_da_di_bu'] > 0])
    max_sessions = max([s['so_buoi_da_di_bu'] for s in summary_students] or [0])
    
    total_need_makeup = len([s for s in summary_students if s['so_buoi_can_bu'] > 0]) if has_yearly_data else 0
    total_completed = len([s for s in summary_students if s['so_buoi_can_bu'] > 0 and s['so_buoi_con_thieu'] == 0]) if has_yearly_data else 0
    total_missing = len([s for s in summary_students if s['so_buoi_can_bu'] > 0 and s['so_buoi_con_thieu'] > 0]) if has_yearly_data else 0
    
    result = {
        "metadata": {
            "lop": actual_class_name,
            "lop_id": str(lop_id),
            "from_date": format_date_to_vn(from_date),
            "to_date": format_date_to_vn(to_date),
            "has_yearly_data": has_yearly_data,
            "total_students": len(summary_students),
            "total_active_students": total_active,
            "max_sessions_by_one": max_sessions,
            "total_need_makeup": total_need_makeup,
            "total_completed": total_completed,
            "total_missing": total_missing,
            "total_sessions_recorded": len(raw_sessions),
            "updated_at": time.strftime("%d/%m/%Y %H:%M:%S")
        },
        "students": summary_students,
        "raw_sessions": raw_sessions
    }
    
    # Lưu cache nếu là lớp Thiếu Nhi 1
    if str(lop_id) == "45":
        dirs_to_save = [
            os.path.join(base_dir, 'output_hocvien_data'),
            os.path.abspath(os.path.join(base_dir, '..', 'frontend', 'public', 'output_hocvien_data'))
        ]
        for d in dirs_to_save:
            if os.path.exists(d):
                summary_file = os.path.join(d, 'dibu_thieu_nhi_1_summary.json')
                with open(summary_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                    
    return result

