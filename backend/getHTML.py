from selenium import webdriver
from selenium.webdriver import Keys
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
from selenium.webdriver.support.ui import Select
import time
import os
import json
import re
from urllib.parse import urlparse, parse_qs # CẦN IMPORT THÊM
from urllib.parse import unquote


def convert_url_to_amp_entity(encoded_url):
    """
    Chuyển đổi URL đã mã hóa (%3D, %26) sang dạng có &amp;
    (KHÔNG KHUYẾN NGHỊ CHO VIỆC TRUY CẬP TRÌNH DUYỆT).
    """

    # 1. Giải mã URL (Chuyển %3D thành =, %26 thành &)
    decoded_url = unquote(encoded_url)

    # 2. Xóa phần BASE_URL và dấu '?' để chỉ còn query string
    # Cần tìm vị trí của dấu '?' để tách query string
    if '?' in decoded_url:
        query_string = decoded_url.split('?', 1)[1]
    else:
        return encoded_url  # Trả về nguyên gốc nếu không có query

    # 3. Thay thế ký tự & thành &amp;
    entity_query_string = query_string.replace('&', '&amp;')

    # 4. Nối lại URL (bao gồm phần path và dấu '?')
    # Giả định phần path là /admin/hocvien
    base_path = decoded_url.split('?', 1)[0]

    return base_path + '?' + entity_query_string


# [Giữ nguyên hàm slugify_key]
def slugify_key(text):
    if not text: return None
    if text.strip() == '#': return 'stt'
    text = text.lower()
    text = re.sub(r'[áàảãạăắằẳẵặâấầẩẫậ]', 'a', text)
    text = re.sub(r'[éèẻẽẹêếềểễệ]', 'e', text)
    text = re.sub(r'[íìỉĩị]', 'i', text)
    text = re.sub(r'[óòỏõọôốồổỗộơớờởỡợ]', 'o', text)
    text = re.sub(r'[úùủũụưứừửữự]', 'u', text)
    text = re.sub(r'[ýỳỷỹỵ]', 'y', text)
    text = re.sub(r'[đ]', 'd', text)
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')

def scraper():
    # --- Cấu hình ---
    BASE_URL = 'https://ccamspro.thongtinxuanloc.com/admin'
    LOGIN_URL = BASE_URL
    DASHBOARD_URL = BASE_URL# + '/admin'
    username = os.getenv("CCAMS_USERNAME", "")
    password = os.getenv("CCAMS_PASSWORD", "")
    OUTPUT_DIR = 'data_hocvien'
    FINAL_OUTPUT_FILE = 'tat_ca_hoc_vien.xlsx'

    # Tạo thư mục lưu dữ liệu nếu chưa có
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # Thiết lập Selenium
    options = webdriver.ChromeOptions()
    options.add_argument('--headless') # Bỏ chú thích nếu muốn chạy ẩn
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')

    print("1. Khởi tạo WebDriver và truy cập trang đăng nhập...")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.get(LOGIN_URL)

    try:
        wait = WebDriverWait(driver, 3)

        # --- BƯỚC 1: Đăng nhập ---

        username_field = wait.until(EC.presence_of_element_located((By.ID, "email")))
        username_field.send_keys(username)
        password_field = wait.until(EC.presence_of_element_located((By.ID, "password")))
        password_field.send_keys(password)
        login_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']")))
        login_button.click()
        print("2. Đã gửi thông tin đăng nhập. Đang chờ chuyển hướng...")

        # wait.until(EC.url_changes(LOGIN_URL))
        time.sleep(2)  # Đợi thêm chút để trang dashboard ổn định

        # --- BƯỚC 2: Truy cập Dashboard và Lấy danh sách lớp học ---

        print(f"3. Đăng nhập thành công, đang truy cập Dashboard: {DASHBOARD_URL}")
        # driver.get(DASHBOARD_URL)

        # Chờ dữ liệu lớp học AJAX tải xong (chờ hàng đầu tiên xuất hiện)
        wait.until(
            EC.presence_of_element_located((
                By.XPATH,
                "//table[@id='lophocTable']/tbody/tr[1]"
            ))
        )
        print("4. ✅ Dữ liệu danh sách lớp học đã tải xong.")

        # Lấy HTML và phân tích bằng BeautifulSoup
        html_dashboard = driver.page_source

        with open('dashboard.html', 'w', encoding='utf-8') as f:
            f.write(html_dashboard)


        soup = BeautifulSoup(html_dashboard, 'lxml')
        all_data_json = []

        table = soup.select_one('table')
        thead = table.find('thead')
        tbody = table.find('tbody')

        original_cols_head = [col.get_text(strip=True) for col in thead.find_all('th')]
        print(original_cols_head)
        standardized_cols_head = [slugify_key(h) for h in original_cols_head]
        standardized_cols_head.insert(2, 'url_chi_tiet')
        print("Tiêu đề chuẩn hóa:", standardized_cols_head)

        for row in tbody.find_all('tr'):

            row_values = []

            for i, col in enumerate(row.find_all('td')):

                if i == 1:
                    a_tag = col.find('a')
                    if a_tag:
                        ten_lop = a_tag.get_text(strip=True)

                        href = a_tag.get('href')
                        new_href = href.replace('/admin/hocvien', '')

                        new_href = new_href.replace('?', '')

                        # 2. Xử lý logic để loại bỏ luôn dấu chấm phẩy và chuỗi '&amp;'
                        #    (nếu cần, nhưng thường đã được xử lý ở đầu script)
                        new_href = new_href.replace('&amp;', '&')
                        full_url = new_href

                        row_values.append(ten_lop)
                        row_values.append(full_url)
                    else:
                        row_values.append(col.get_text(strip=True))
                        row_values.append(None)
                else:
                    row_values.append(col.get_text(strip=True))

            # xu li json
            if len(standardized_cols_head) == len(row_values):
                row_dict = dict(zip(standardized_cols_head, row_values))
                all_data_json.append(row_dict)
            else:
                print(f"Lỗi: Tiêu đề ({len(standardized_cols_head)}) và Giá trị ({len(row_values)}) không khớp trong hàng này.")


        # final_json_output = json.dumps(all_data_json, ensure_ascii=False, indent=4)
        # print("\n--- KẾT QUẢ JSON CÓ CẤU TRÚC ---\n")
        # print(final_json_output)
        return all_data_json





        # soup = BeautifulSoup(html_dashboard, 'html.parser')
        #
        # lophoc_links = []
        # # Tìm tất cả các thẻ <a> bên trong bảng lophocTable
        # for a_tag in soup.select("#lophocTable tbody a"):
        #     href = a_tag.get('href')
        #     text = a_tag.text.strip()
        #     if href and text:
        #         # Lưu đường dẫn đầy đủ
        #         full_url = BASE_URL + href
        #         lophoc_links.append({'ten_lop': text, 'url_chi_tiet': full_url})
        #
        # print(f"5. Đã tìm thấy {len(lophoc_links)} lớp học cần trích xuất chi tiết.")
        #
        # # --- BƯỚC 3: Lặp qua từng đường dẫn và Lấy dữ liệu Học viên ---
        #
        # all_students_data = []
        #
        # for i, lop in enumerate(lophoc_links):
        #     url = lop['url_chi_tiet']
        #
        #     print(f"\n--- 6. Trích xuất: {i + 1}/{len(lophoc_links)} - Lớp: {lop['ten_lop']} ---")
        #
        #     # Điều hướng đến URL chi tiết của lớp
        #     driver.get(url)
        #
        #     # Chờ bảng học viên chi tiết tải xong
        #     try:
        #         # Chờ bảng dữ liệu học viên xuất hiện (giả định đây là bảng đầu tiên hoặc duy nhất trên trang)
        #         wait.until(EC.presence_of_element_located((By.TAG_NAME, "table")))
        #         time.sleep(2)  # Cho phép JavaScript render hoàn toàn
        #
        #         html_chi_tiet = driver.page_source
        #         soup_chi_tiet = BeautifulSoup(html_chi_tiet, 'html.parser')
        #
        #         # Tìm bảng dữ liệu học viên
        #         hocvien_table = soup_chi_tiet.find('table')
        #
        #         if hocvien_table:
        #             # Dùng pandas để đọc bảng HTML thành DataFrame
        #             df_list = pd.read_html(str(hocvien_table))
        #             if df_list:
        #                 df = df_list[0]
        #                 df['Lớp Học'] = lop['ten_lop']  # Thêm cột tên lớp
        #                 all_students_data.append(df)
        #                 print(f"   -> ✅ Lấy dữ liệu học viên cho lớp '{lop['ten_lop']}' thành công.")
        #             else:
        #                 print(f"   -> ❌ Lỗi: Không tìm thấy bảng dữ liệu học viên trong HTML.")
        #         else:
        #             print(f"   -> ❌ Lỗi: Không tìm thấy bảng HTML nào trên trang.")
        #
        #     except Exception as e:
        #         print(f"   -> ‼️ Lỗi khi tải hoặc trích xuất dữ liệu cho lớp {lop['ten_lop']}: {e}")
        #
        # # --- BƯỚC 4: Tổng hợp và Lưu trữ ---
        #
        # if all_students_data:
        #     # Hợp nhất tất cả các DataFrame thành một bảng duy nhất
        #     final_df = pd.concat(all_students_data, ignore_index=True)
        #     final_output_path = os.path.join(os.getcwd(), FINAL_OUTPUT_FILE)
        #
        #     # Lưu ra file Excel (.xlsx)
        #     final_df.to_excel(final_output_path, index=False, encoding='utf-8-sig')
        #
        #     print(f"\n7. ✅ HOÀN TẤT TRÍCH XUẤT! Tổng hợp dữ liệu {final_df.shape[0]} học viên.")
        #     print(f"   Dữ liệu đã được lưu vào file: {final_output_path}")
        # else:
        #     print("\n7. ❌ HOÀN TẤT. Không có dữ liệu học viên nào được trích xuất.")

    except Exception as e:
        print(f"\n‼️ LỖI CHUNG TRONG QUÁ TRÌNH TỰ ĐỘNG HÓA: {e}")

    finally:
        driver.quit()
        print("\n8. Đã đóng trình duyệt.")
# ----------------------------------------------

def getListStudentByInfo(urlNavigation, username, password):
    url_with_amp = convert_url_to_amp_entity(urlNavigation)
    # --- Cấu hình ---
    BASE_URL = 'https://ccamspro.thongtinxuanloc.com'
    HOCVIEN_URL = BASE_URL + url_with_amp
    # Vui lòng đảm bảo đường dẫn này đúng.
    # CHROME_USER_DATA_DIR = "/Users/jakepham/Library/Application Support/Google/Chrome"
    # PROFILE_DIRECTORY = "Profile 3"

    # Thiết lập Selenium
    options = webdriver.ChromeOptions()
    options.add_argument('--headless') # KHÔNG DÙNG HEADLESS KHI DÙNG PROFILE
    # options.add_argument(f"user-data-dir={CHROME_USER_DATA_DIR}")
    # options.add_argument(f"profile-directory={PROFILE_DIRECTORY}")
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')

    print("1. Khởi tạo WebDriver với Hồ sơ đã lưu...")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

    all_data_json = []

    try:
        driver.get(BASE_URL)
        wait = WebDriverWait(driver, 5)
        print("2. Bắt đầu đăng nhập thủ công...")
        username_field = wait.until(EC.presence_of_element_located((By.ID, "email")))
        username_field.send_keys(username)
        password_field = wait.until(EC.presence_of_element_located((By.ID, "password")))
        password_field.send_keys(password)
        login_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']")))
        login_button.click()
        # --- BƯỚC 1: TRUY CẬP TRỰC TIẾP (Sử dụng phiên đã lưu) ---
        driver.get(HOCVIEN_URL)
        print(f"3. Truy cập trực tiếp: {HOCVIEN_URL}")

        # ❌ LƯU Ý: KHỐI CODE ĐĂNG NHẬP THỦ CÔNG ĐÃ BỊ LOẠI BỎ (Vì đang dùng hồ sơ)
        # Nếu phiên hết hạn, bạn sẽ bị chuyển hướng và cần bật lại khối đăng nhập

        # --- BƯỚC 2: Thao tác Dropdown ---
        # wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.bg-gray-100.p-4.rounded-md.mb-4")))



        # --- BƯỚC 3: Trích xuất Dữ liệu ---
        wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table.w-full.border-collapse.border.border-gray-300")))
        time.sleep(3)
        select_elements = driver.find_elements(By.CSS_SELECTOR, "div.bg-gray-100 select")

        normalized_url_path = url_with_amp.replace('&amp;', '&')
        params_query_string = urlparse(normalized_url_path).query
        params = parse_qs(params_query_string)

        # Trích xuất các giá trị cần thiết
        # Sử dụng .get() để tránh lỗi nếu tham số không tồn tại
        nien_hoc_value = params.get('MANIENHOC', [''])[0]
        khoi_nganh_value = params.get('MAKHOI', [''])[0]
        lop_chi_doan_value = params.get('MALOPHOC', [''])[0]
        print(url_with_amp)
        print(urlNavigation)
        print(nien_hoc_value, khoi_nganh_value, lop_chi_doan_value)
        if len(select_elements) >= 3:
            # 4.1. Chọn Niên học (MANIENHOC=4)
            select_niên_học = Select(select_elements[0])
            select_niên_học.select_by_value(nien_hoc_value)
            # 4.2. Chọn Khối / Ngành (MAKHOI=2)
            select_khối_ngành = Select(select_elements[1])
            select_khối_ngành.select_by_value(khoi_nganh_value)
            time.sleep(1)
            # 4.3. Chọn Lớp / Chi Đoàn (MALOPHOC=44)
            select_lớp_chi_đoàn = Select(select_elements[2])
            select_lớp_chi_đoàn.select_by_value(lop_chi_doan_value)
            time.sleep(1)
            print("4. ✅ Đã chọn các giá trị Dropdown bằng mã ID (Value).")
        else:
            # Kiểm tra xem có bị chuyển hướng về trang login không
            if "login" in driver.current_url:
                raise Exception("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại thủ công hoặc bật lại khối đăng nhập.")
            else:
                print("4. ⚠️ Không tìm thấy đủ 3 dropdown để thao tác.")

        time.sleep(3)

        html_page = driver.page_source
        soup = BeautifulSoup(html_page, 'lxml')
        with open('hocvien.html', 'w', encoding='utf-8') as f:
            f.write(html_page)
        table = soup.select_one('table.w-full.border-collapse.border.border-gray-300')

        if not table:
            raise Exception("Không tìm thấy bảng dữ liệu học viên.")

        thead = table.find('thead')
        tbody = table.find('tbody')

        original_cols_head = [col.get_text(strip=True) for col in thead.find_all('th')]
        original_cols_head.insert(1, 'ma_hoc_vien')

        standardized_cols_head = [slugify_key(h) for h in original_cols_head]
        selenium_rows = driver.find_elements(By.CSS_SELECTOR, "table.w-full.border-collapse tbody tr")

        for index, selenium_row in enumerate(selenium_rows):
            print(f"   Đang xử lý dòng: {index + 1}/{len(selenium_rows)}")

            # 1. CLICK VÀO DÒNG ĐỂ HIỂN THỊ PANEL CHI TIẾT
            selenium_row.click()

            # 2. CHỜ PANEL BÊN PHẢI TẢI XONG (chờ tiêu đề form xuất hiện)
            wait.until(EC.visibility_of_element_located((
                By.XPATH, "//h2[text()='Thông tin chi tiết']"
            )))

            # 3. Lấy MAHOCVIEN từ Panel Chi tiết (Đáng tin cậy)
            # MAHOCVIEN nằm trong thẻ label chứa class="block font-medium"
            # Giả định cấu trúc là: <label> <i class="fas fa-barcode"></i> MAHOCVIEN </label>
            try:
                # Tìm element chứa Mã Học Viên
                ma_hoc_vien_element = driver.find_element(By.XPATH,
                                                          "//div[contains(@class, 'flex flex-col items-center')]//label[contains(@class, 'font-medium')]"
                                                          )
                # Lấy text, và loại bỏ các ký tự thừa để chỉ giữ lại ID (ví dụ: 2025069)
                ma_hoc_vien_full_text = ma_hoc_vien_element.get_attribute("textContent").strip()
                # Thử trích xuất dãy số ở cuối chuỗi (dựa trên ảnh chụp)
                ma_hoc_vien = re.search(r'\d+$', ma_hoc_vien_full_text).group(0)
            except Exception as e:
                ma_hoc_vien = "ID_NOT_FOUND"
                print(f"      Lỗi trích xuất ID dòng {index + 1}: {e}")

            # 4. Lấy HTML của dòng (đã click) và các cột khác
            soup_row = BeautifulSoup(selenium_row.get_attribute('outerHTML'), 'lxml')
            row_values = []
            cols = soup_row.find_all('td')

            # 5. Trích xuất các cột TD và chèn MAHOCVIEN
            for i, col in enumerate(cols):
                if i == 0:  # Cột STT/Checkbox
                    stt_span = col.find('span', {'v-else': True})
                    row_values.append(stt_span.get_text(strip=True) if stt_span else "")
                else:
                    row_values.append(col.get_text(strip=True))

            # 6. Chèn MAHOCVIEN vào vị trí thứ 2 (sau STT)
            row_values.insert(1, ma_hoc_vien)

            # --- Xử lý JSON ---
        # if len(standardized_cols_head) == len(row_values):
            row_dict = dict(zip(standardized_cols_head, row_values))
            all_data_json.append(row_dict)
        # else:
        #     print(f"Lỗi: Tiêu đề ({len(standardized_cols_head)}) và Giá trị ({len(row_values)}) không khớp.")

        return all_data_json

    except Exception as e:
        print(f"\n‼️ LỖI CHUNG TRONG QUÁ TRÌNH TỰ ĐỘNG HÓA: {e}")
        # Trả về đối tượng lỗi để API FastAPI xử lý
        return {"error": f"Scraping thất bại: {str(e)}"}

    finally:
        driver.quit()
        print("\n8. Đã đóng trình duyệt.")


def getInitOptions(driver_or_url=None, wait_or_user=None, password=None, DIEMDANH_BASE_URL='https://ccamspro.thongtinxuanloc.com/admin/diem-danh'):
    """
    Trích xuất options từ trang Điểm Danh.
    Hỗ trợ nhận (driver, wait, DIEMDANH_BASE_URL) để tái sử dụng trình duyệt đang mở.
    """
    options_data = {
        "nienhocs": [],
        "khois": [],
        "lophocs": [],
        "diemdanhtypes": []
    }

    # Kiểm tra xem tham số đầu vào là driver hay url
    if hasattr(driver_or_url, 'get'):
        # Đang truyền driver và wait vào
        driver = driver_or_url
        wait = wait_or_user or WebDriverWait(driver, 10)
        target_url = DIEMDANH_BASE_URL
        should_quit = False
    else:
        # Cách cũ: tạo driver mới
        target_url = driver_or_url or DIEMDANH_BASE_URL
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        wait = WebDriverWait(driver, 10)
        should_quit = True

    try:
        driver.get(target_url)
        
        # Chỉ đăng nhập nếu bị chuyển hướng về login
        if "login" in driver.current_url:
            print("🔑 [getInitOptions] Phiên hết hạn, đang đăng nhập...")
            username_field = wait.until(EC.presence_of_element_located((By.ID, "email")))
            username_field.send_keys(wait_or_user or os.getenv("CCAMS_USERNAME", ""))
            password_field = wait.until(EC.presence_of_element_located((By.ID, "password")))
            password_field.send_keys(password or os.getenv("CCAMS_PASSWORD", ""))
            login_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']")))
            login_button.click()
            wait.until(EC.url_contains("/admin"))
            driver.get(target_url)

        # Chờ dropdown xuất hiện
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.bg-gray-100 select")))
        time.sleep(1.5)

        html = driver.page_source
        soup = BeautifulSoup(html, 'lxml')

        select_elements = soup.select("div.bg-gray-100 select")

        if len(select_elements) >= 4:
            # Trích xuất Niên Học
            for option in select_elements[0].find_all('option'):
                if option.get('value'):
                    options_data["nienhocs"].append({
                        "MANIENHOC": option.get('value'),
                        "TENNIENHOC": option.get_text(strip=True)
                    })

            # Trích xuất Khối / Ngành
            for option in select_elements[1].find_all('option'):
                if option.get('value') and option.get('value') != 'all':
                    options_data["khois"].append({
                        "MAKHOI": option.get('value'),
                        "TENKHOI": option.get_text(strip=True)
                    })

            # Trích xuất Lớp / Chi Đoàn
            for option in select_elements[2].find_all('option'):
                if option.get('value') and option.get('value') != 'all':
                    options_data["lophocs"].append({
                        "MALOPHOC": option.get('value'),
                        "TENLOPHOC": option.get_text(strip=True)
                    })
            if len(select_elements) > 3:
                for option in select_elements[3].find_all('option'):
                    if option.get('value'):
                        options_data["diemdanhtypes"].append({
                            "VALUE": option.get('value'),
                            "TENLOAI": option.get_text(strip=True)
                        })

        return options_data

    except Exception as e:
        print(f"\n‼️ LỖI TRONG QUÁ TRÌNH TRÍCH XUẤT OPTION: {e}")
        return {"error": f"Lỗi trích xuất tùy chọn: {str(e)}"}

    finally:
        if should_quit:
            driver.quit()


# def loginAuto(urlNavigation, username, password)):
#     print('url navigation: ', urlNavigation)
#     BASE_URL = 'https://ccamspro.thongtinxuanloc.com'
#     options = webdriver.ChromeOptions()
#     options.add_argument('--headless')
#     options.add_argument('--no-sandbox')
#     options.add_argument('--disable-dev-shm-usage')

#     print("1. Khởi tạo WebDriver...")
#     driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
#     driver.get(BASE_URL + '/admin')
#     wait = WebDriverWait(driver, 1)
#     print("2. Bắt đầu đăng nhập...")

#     # Đăng nhập (giữ nguyên)
#     username_field = wait.until(EC.presence_of_element_located((By.ID, "email")))
#     username_field.send_keys(username)
#     password_field = wait.until(EC.presence_of_element_located((By.ID, "password")))
#     password_field.send_keys(password)
#     login_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']")))
#     login_button.click()

def getListDiemDanhByInfo(driver, wait, urlNavigation):
    # BASE_URL = 'https://ccamspro.thongtinxuanloc.com' # Đã có global hoặc config
    BASE_URL = 'https://ccamspro.thongtinxuanloc.com'
    
    print(f'🔍 [SCRAPER] Đang cào dữ liệu: {urlNavigation}')

    # 1. PHÂN TÍCH URL
    parsed_url = urlparse(urlNavigation)
    params = parse_qs(parsed_url.query)
    nien_hoc_value = params.get('MANIENHOC', [''])[0]
    khoi_nganh_value = params.get('MAKHOI', [''])[0]
    lop_chi_doan_value = params.get('MALOPHOC', [''])[0]
    attendance_filter_value = params.get('filter', ['hiendien_all'])[0]
    search_keyword = params.get('search', [''])[0]
    from_date = params.get('from', [''])[0]
    to_date = params.get('to', [''])[0]
    DIEMDANH_URL = BASE_URL + parsed_url.path

    all_data_json = []
    
    # --- KHỞI TẠO BIẾN CHO VÒNG LẶP (QUAN TRỌNG) ---
    current_page = 1
    max_pagination_loops = 100
    last_table_element = None 
    # -----------------------------------------------

    # Selectors
    CONTROL_BLOCK_SELECTOR = "div.bg-gray-100.p-4.rounded-md.mb-4"
    MAIN_RESULT_BLOCK_SELECTOR = "div.p-6.bg-white.shadow-md.rounded-md"
    TABLE_CLASS_SELECTOR = "table.w-full.border-collapse.border.border-gray-300"

    try:
        # 3. Truy cập trang Điểm Danh
        driver.get(DIEMDANH_URL)
        
        # KIỂM TRA SESSION
        if "login" in driver.current_url:
             # Ném lỗi để main.py bắt được và login lại
             return {"error": "Session expired. Need re-login."}

        print(f"3. Truy cập trang: {DIEMDANH_URL}")

        # Chờ khối điều khiển
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, CONTROL_BLOCK_SELECTOR)))
        # Giảm thời gian chờ cứng xuống vì browser đã sẵn sàng
        time.sleep(1.5) 

        # 4. Kích hoạt bộ lọc
        select_elements = driver.find_elements(By.CSS_SELECTOR, f"{CONTROL_BLOCK_SELECTOR} select")
        if len(select_elements) >= 4:
            Select(select_elements[0]).select_by_value(nien_hoc_value)
            try:
                Select(select_elements[1]).select_by_value(khoi_nganh_value)
            except: pass
            try:
                Select(select_elements[2]).select_by_value(lop_chi_doan_value)
            except: pass
            Select(select_elements[3]).select_by_value(attendance_filter_value)

        # Xử lý input tìm kiếm/ngày tháng
        time.sleep(0.5)
        if search_keyword:
            search_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@placeholder='Nhập từ khóa...']")))
            search_input.clear()
            search_input.send_keys(search_keyword)

        if from_date:
            from_input = driver.find_element(By.ID, "from")
            driver.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change'))", from_input, from_date)

        if to_date:
            to_input = driver.find_element(By.ID, "to")
            driver.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change'))", to_input, to_date)

        # 5. Click Search
        time.sleep(1)
        search_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(@class, 'bg-blue-500') and ./i[@class='fas fa-search text-white']]")))
        driver.execute_script("arguments[0].click();", search_button)
        time.sleep(2) 

        # 6. VÒNG LẶP PHÂN TRANG
        while current_page <= max_pagination_loops:
            print(f"📄 Đang lấy trang {current_page}...")

            # 6.1. Chờ bảng
            if current_page > 1:
                try:
                    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, TABLE_CLASS_SELECTOR)))
                    time.sleep(0.5)
                except:
                    break
            else:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, TABLE_CLASS_SELECTOR)))

            # 6.3. Parse HTML bằng BeautifulSoup (Giữ nguyên logic của bạn)
            html_page = driver.page_source
            soup = BeautifulSoup(html_page, 'lxml')
            
            result_container = soup.select_one(MAIN_RESULT_BLOCK_SELECTOR)
            table = result_container.select_one(TABLE_CLASS_SELECTOR) if result_container else None

            if not table: break

            # --- LOGIC LẤY HEADER VÀ DATA (GIỮ NGUYÊN) ---
            thead = table.find('thead')
            tbody = table.find('tbody')
            original_cols_head = [col.get_text(strip=True) for col in thead.find_all('th')]
            standardized_cols_head = [slugify_key(h) for h in original_cols_head]

            try:
                loai_diem_danh_index = standardized_cols_head.index('loai_diem_danh')
            except ValueError:
                loai_diem_danh_index = -1

            rows_extracted = 0
            for row_index, row in enumerate(tbody.find_all('tr')):
                row_values = []
                cols = row.find_all('td')
                for i, col in enumerate(cols):
                    if i == 0:
                        stt_span = col.find('span', {'v-else': True})
                        row_values.append(stt_span.get_text(strip=True) if stt_span else "")
                    elif i == loai_diem_danh_index:
                        # Logic lấy select option (Giữ nguyên)
                        selected_text = "N/A"
                        try:
                            # Cần tìm lại element vì DOM thay đổi, tuy nhiên dùng xpath index như cũ là ổn
                            # Lưu ý: soup không tương tác được, phải dùng driver nếu muốn lấy value thực tế từ JS
                            # Ở đây bạn đang dùng driver bên trong loop soup -> Hơi rủi ro nếu DOM lệch
                            # Cách an toàn nhất cho text select:
                            val = col.select_one('select option[selected]')
                            if val: selected_text = val.get_text(strip=True)
                            else: selected_text = col.get_text(strip=True)
                        except:
                            selected_text = col.get_text(strip=True)
                        row_values.append(selected_text)
                    else:
                        row_values.append(col.get_text(strip=True))

                if len(standardized_cols_head) == len(row_values):
                    all_data_json.append(dict(zip(standardized_cols_head, row_values)))
                    rows_extracted += 1

            if rows_extracted < 50:
                print("✅ Đã đến trang cuối.")
                break

            current_page += 1
            
            # 6.4. Next Page
            try:
                next_page_xpath = f"//button[text()='{current_page}' and not(@disabled)]"
                next_btn = driver.find_element(By.XPATH, next_page_xpath)
                driver.execute_script("arguments[0].scrollIntoView(true); arguments[0].click();", next_btn)
                time.sleep(1) # Chờ load trang mới
            except:
                print("Không tìm thấy trang tiếp theo. Kết thúc.")
                break

        return all_data_json

    except Exception as e:
        print(f"‼️ LỖI SCRAPING: {e}")
        return {"error": f"Scraping thất bại: {str(e)}"}



    # getListStudentByInfo('/admin/hocvien?MANIENHOC=4&amp;MAKHOI=3&amp;MALOPHOC=45', 'tnthienphu', '123456789')
