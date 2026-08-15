# backend/zalo_service.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()

MALOPHOC_NAME_MAP = {
    "39": {"lop": "Chiên Con 1", "khoi": "Chiên Con"},
    "40": {"lop": "Chiên Con 2", "khoi": "Chiên Con"},
    "41": {"lop": "Ấu Nhi 1A", "khoi": "Ấu Nhi"},
    "42": {"lop": "Ấu Nhi 1B", "khoi": "Ấu Nhi"},
    "43": {"lop": "Ấu Nhi 2", "khoi": "Ấu Nhi"},
    "44": {"lop": "Ấu Nhi 3", "khoi": "Ấu Nhi"},
    "45": {"lop": "Thiếu Nhi 1", "khoi": "Thiếu Nhi"},
    "46": {"lop": "Thiếu Nhi 2", "khoi": "Thiếu Nhi"},
    "47": {"lop": "Thiếu Nhi 3", "khoi": "Thiếu Nhi"},
    "49": {"lop": "Nghĩa Sĩ", "khoi": "Nghĩa Sĩ"},
    "50": {"lop": "Hiệp Sĩ", "khoi": "Hiệp Sĩ"},
}

MAKHOI_NAME_MAP = {
    "1": "Chiên Con",
    "2": "Ấu Nhi",
    "3": "Thiếu Nhi",
    "4": "Nghĩa Sĩ",
    "5": "Hiệp Sĩ",
}

def get_report_title(type_code: str) -> str:
    titles = {
        # Nhóm 1: Báo cáo tổng hợp
        'all_info_attendances': "BÁO CÁO TỔNG HỢP (THÁNH LỄ & GIÁO LÝ)",
        
        # Nhóm 2: Danh sách vắng
        'ds_vang_tle': "VẮNG THÁNH LỄ",
        'ds_vang_gl': "VẮNG GIÁO LÝ",
        'ds_vang_gly': "VẮNG GIÁO LÝ",
        'ds_vang_all': "VẮNG THÁNH LỄ VÀ GIÁO LÝ",
        
        # Nhóm 3: Hiện diện chi tiết
        'hiendien_tle': "HIỆN DIỆN THÁNH LỄ",
        'hiendien_gly': "HIỆN DIỆN GIÁO LÝ",
        'hiendien_gl': "HIỆN DIỆN GIÁO LÝ",
        'hiendien_all': "HIỆN DIỆN THÁNH LỄ VÀ GIÁO LÝ",

        # Nhóm 4: Vắng có phép
        'vang_tle': "VẮNG CÓ PHÉP (THÁNH LỄ)",
        'vang_gly': "VẮNG CÓ PHÉP (GIÁO LÝ)",
        'vang_gl': "VẮNG CÓ PHÉP (GIÁO LÝ)",
        'vang_all': "VẮNG CÓ PHÉP (THÁNH LỄ & GIÁO LÝ)",
    }
    if type_code in titles:
        return titles[type_code]
    if type_code.startswith("vang_"):
        return "VẮNG CÓ PHÉP"
    if type_code.startswith("hiendien_"):
        return "HIỆN DIỆN"
    return "KẾT QUẢ ĐIỂM DANH"

def resolve_class_and_grade(first_record: dict, malophoc: str = None, makhoi: str = None):
    lop = first_record.get('lop', '')
    khoi = first_record.get('khoi', '')

    if malophoc and malophoc in MALOPHOC_NAME_MAP:
        mapping = MALOPHOC_NAME_MAP[malophoc]
        lop = mapping["lop"]
        khoi = mapping["khoi"]
    elif lop in MALOPHOC_NAME_MAP:
        mapping = MALOPHOC_NAME_MAP[lop]
        lop = mapping["lop"]
        khoi = mapping["khoi"]

    if khoi in MAKHOI_NAME_MAP:
        khoi = MAKHOI_NAME_MAP[khoi]
    elif makhoi and makhoi in MAKHOI_NAME_MAP:
        khoi = MAKHOI_NAME_MAP[makhoi]

    if not khoi or khoi == 'undefined':
        lower_lop = str(lop).lower()
        if 'thiếu nhi' in lower_lop or 'thieu nhi' in lower_lop:
            khoi = 'Thiếu Nhi'
        elif 'ấu nhi' in lower_lop or 'au nhi' in lower_lop:
            khoi = 'Ấu Nhi'
        elif 'chiên con' in lower_lop or 'chien con' in lower_lop:
            khoi = 'Chiên Con'
        elif 'nghĩa sĩ' in lower_lop or 'nghia si' in lower_lop:
            khoi = 'Nghĩa Sĩ'
        elif 'hiệp sĩ' in lower_lop or 'hiep si' in lower_lop:
            khoi = 'Hiệp Sĩ'
        else:
            khoi = 'Xứ Đoàn Kitô Vua'

    if not lop or lop == 'undefined':
        lop = 'Tất cả học viên'

    return lop, khoi

def send_zalo_task(data: list, report_type: str = "", malophoc: str = None, makhoi: str = None, date_str: str = None):
    token = os.getenv("ZALO_BOT_TOKEN", "2904097519088763119:NzeuaJZIwmIOSdNxuzCSoqsBMSfAJXzMWixCfonpEUZZzvMSGYnkWlzhJUmGteMv")
    chat_id = os.getenv("CHAT_ID", "3699bc065d4bb415ed5a")

    if not data:
        print("⚠️ Không có dữ liệu để gửi Zalo")
        return

    first_record = data[0] if len(data) > 0 else {}
    lop, khoi = resolve_class_and_grade(first_record, malophoc, makhoi)
    title = get_report_title(report_type)

    chunk_size = 35
    chunks = [data[i:i + chunk_size] for i in range(0, len(data), chunk_size)]
    api_url = f"https://bot-api.zaloplatforms.com/bot{token}/sendMessage"

    for idx, chunk in enumerate(chunks):
        msg = ""
        total_chunks = len(chunks)
        if idx == 0:
            msg += f"📢 {title}{f' (Phần {idx + 1}/{total_chunks})' if total_chunks > 1 else ''}\n"
            msg += f"🏫 Lớp: {lop} - Khối: {khoi}\n"
            if date_str:
                msg += f"📅 Ngày: {date_str}\n"
            msg += f"--------------------------\n"
        else:
            msg += f"📢 {title} (Phần {idx + 1}/{total_chunks} - Tiếp theo)\n"
            msg += f"🏫 Lớp: {lop} - Khối: {khoi}\n"
            msg += f"--------------------------\n"

        start_offset = idx * chunk_size
        for i, r in enumerate(chunk):
            item_number = start_offset + i + 1
            holy_name = f"{r.get('ten_thanh', '').strip()} " if r.get('ten_thanh') else ""
            full_name = r.get('full_name') or f"{r.get('ho', '')} {r.get('ten', '')}".strip()
            student_code = f" {r.get('ma_hoc_vien', '').strip()}" if r.get('ma_hoc_vien') else ""

            if report_type == 'all_info_attendances':
                status = f" ({r.get('loai_diem_danh', '')})" if r.get('loai_diem_danh') else ""
                msg += f"{item_number}. {holy_name}{full_name}{student_code}{status}\n"
            else:
                icon = "✅"
                if report_type.startswith("ds_vang"):
                    icon = "🔴"
                msg += f"{item_number}. {icon} {holy_name}{full_name}{student_code}\n"

        if idx == len(chunks) - 1:
            msg += "--------------------------\n"
            msg += f"📊 Tổng số: {len(data)} học viên"

        try:
            res = requests.post(api_url, json={"chat_id": chat_id, "text": msg}, timeout=10)
            if res.status_code == 200 and res.json().get("ok"):
                print(f"✅ Gửi Zalo thành công (Phần {idx + 1}/{len(chunks)})")
            else:
                print(f"❌ Lỗi gửi Zalo: {res.text}")
        except Exception as e:
            print(f"❌ Exception gửi Zalo: {str(e)}")

def send_zalo_raw(text: str):
    """Gửi trực tiếp tin nhắn văn bản đến Zalo Bot"""
    token = os.getenv("ZALO_BOT_TOKEN", "2904097519088763119:NzeuaJZIwmIOSdNxuzCSoqsBMSfAJXzMWixCfonpEUZZzvMSGYnkWlzhJUmGteMv")
    chat_id = os.getenv("CHAT_ID", "3699bc065d4bb415ed5a")
    api_url = f"https://bot-api.zaloplatforms.com/bot{token}/sendMessage"

    try:
        res = requests.post(api_url, json={"chat_id": chat_id, "text": text}, timeout=10)
        if res.status_code == 200 and res.json().get("ok"):
            print("✅ Gửi Zalo Raw thành công")
        else:
            print(f"❌ Lỗi gửi Zalo Raw: {res.text}")
    except Exception as e:
        print(f"❌ Exception gửi Zalo Raw: {str(e)}")
