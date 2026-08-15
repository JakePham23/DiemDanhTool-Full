from getHTML import *
from urllib.parse import urlencode, parse_qs, urlparse
import json  # Cần cho việc ghi file JSON
import os  # Cần cho việc tạo thư mục

FIXED_USERNAME = 'glvloc'
FIXED_PASSWORD = '0368079841'


def create_encoded_url(path, params):
    """Tạo URL query đã mã hóa từ một dictionary tham số."""
    encoded_query = urlencode(params)
    return f"{path}?{encoded_query}"


def save_data_to_json(data, filename):
    """Ghi dữ liệu dictionary/list ra file JSON trong thư mục 'output'."""
    output_dir = 'output_hocvien_data'
    os.makedirs(output_dir, exist_ok=True)  # Tạo thư mục nếu chưa tồn tại
    filepath = os.path.join(output_dir, filename)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    print(f"✅ Đã lưu dữ liệu ra file: {filepath}")


def main():
    dashboard_data = scraper()

    # --- THAM SỐ CƠ SỞ (BASE PARAMS) ---
    BASE_PATH = '/admin/hocvien'
    MANIENHOC_VALUE = '4'

    # Định nghĩa cấu trúc lớp và tên file
    classes = {
        "chien_con_1": {'MAKHOI': '1', 'MALOPHOC': '39'},
        "chien_con_2": {'MAKHOI': '1', 'MALOPHOC': '40'},
        "au_nhi_1a": {'MAKHOI': '2', 'MALOPHOC': '41'},
        # Thêm các lớp còn lại vào dictionary để lặp qua
        "au_nhi_1b": {'MAKHOI': '2', 'MALOPHOC': '42'},
        "au_nhi_2": {'MAKHOI': '2', 'MALOPHOC': '43'},
        "au_nhi_3": {'MAKHOI': '2', 'MALOPHOC': '44'},
        "thieu_nhi_1": {'MAKHOI': '3', 'MALOPHOC': '45'},
        "thieu_nhi_2": {'MAKHOI': '3', 'MALOPHOC': '46'},
        "thieu_nhi_3": {'MAKHOI': '3', 'MALOPHOC': '47'},
        "nghia_si": {'MAKHOI': '4', 'MALOPHOC': '49'},
        "hiep_si": {'MAKHOI': '5', 'MALOPHOC': '50'},
    }

    print("--- BẮT ĐẦU TRÍCH XUẤT DỮ LIỆU TỪNG LỚP ---")

    for class_name, ids in classes.items():
        params = {'MANIENHOC': MANIENHOC_VALUE, 'MAKHOI': ids['MAKHOI'], 'MALOPHOC': ids['MALOPHOC']}

        # 1. Tạo URL đã mã hóa
        class_url = create_encoded_url(BASE_PATH, params)
        print(f"\nĐang xử lý lớp: {class_name}")

        # 2. Gọi hàm scraping
        try:
            class_data = getListStudentByInfo(class_url, FIXED_USERNAME, FIXED_PASSWORD)

            # 3. Ghi ra file JSON
            filename = f"{class_name}_data.json"
            save_data_to_json(class_data, filename)

        except Exception as e:
            print(f"‼️ LỖI SCRAPING cho lớp {class_name}: {e}")
            # Ghi lỗi vào file log hoặc tiếp tục

    print("\n--- HOÀN TẤT QUÁ TRÌNH TRÍCH XUẤT VÀ GHI FILE ---")

DIEMDANH_BASE_URL = 'https://ccamspro.thongtinxuanloc.com/admin/diem-danh'

if __name__ == '__main__':
    # dashboard_data = scraper()
    # save_data_to_json(dashboard_data,'dashboard_data.json')
    # options_data = getInitOptions(DIEMDANH_BASE_URL, FIXED_USERNAME, FIXED_PASSWORD)

    # class_data = getListStudentByInfo('/admin/hocvien?MANIENHOC%3D4%26MAKHOI%3D3%26MALOPHOC%3D45', FIXED_USERNAME, FIXED_PASSWORD)

    # save_data_to_json(class_data,'data.json')
    getListDiemDanhByInfo(DIEMDANH_BASE_URL, FIXED_USERNAME, FIXED_PASSWORD)
    # main()