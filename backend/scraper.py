# scraper.py
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import pandas as pd
import time
import os
import json
import re


# ... (Hàm slugify_key và các biến BASE_URL/LOGIN_URL giữ nguyên) ...

def slugify_key(text):
    # Hàm này phải được định nghĩa để chạy đúng
    if not text:
        return None
    if text.strip() == '#':
        return 'stt'
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


BASE_URL = 'https://ccamspro.thongtinxuanloc.com'
LOGIN_URL = BASE_URL
DASHBOARD_URL = BASE_URL + '/admin'


def run_scraping_tool(username, password):
    # Thiết lập Selenium
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')  # Chạy ẩn để server hoạt động tốt
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.get(LOGIN_URL)

    # DI CHUYỂN TOÀN BỘ KHỐI XỬ LÝ VÀO try...except...finally
    try:
        wait = WebDriverWait(driver, 30)

        # --- BƯỚC 1: Đăng nhập ---
        username_field = wait.until(EC.presence_of_element_located((By.ID, "email")))
        username_field.send_keys(username)
        password_field = wait.until(EC.presence_of_element_located((By.ID, "password")))
        password_field.send_keys(password)
        login_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']")))
        login_button.click()

        wait.until(EC.url_changes(LOGIN_URL))
        time.sleep(2)

        # --- BƯỚC 2: Truy cập Dashboard và Lấy danh sách lớp học ---
        driver.get(DASHBOARD_URL)
        wait.until(
            EC.presence_of_element_located((
                By.XPATH,
                "//table[@id='lophocTable']/tbody/tr[1]"
            ))
        )

        html_dashboard = driver.page_source
        soup = BeautifulSoup(html_dashboard, 'lxml')
        all_data_json = []

        table = soup.select_one('table')
        thead = table.find('thead')
        tbody = table.find('tbody')

        original_cols_head = [col.get_text(strip=True) for col in thead.find_all('th')]
        standardized_cols_head = [slugify_key(h) for h in original_cols_head]
        standardized_cols_head.insert(2, 'url_chi_tiet')

        # --- BƯỚC 3: Lặp và Trích xuất dữ liệu ---
        for row in tbody.find_all('tr'):
            row_values = []
            for i, col in enumerate(row.find_all('td')):
                if i == 1:
                    a_tag = col.find('a')
                    if a_tag:
                        ten_lop = a_tag.get_text(strip=True)
                        href = a_tag.get('href')
                        full_url = BASE_URL + href
                        row_values.append(ten_lop)
                        row_values.append(full_url)
                    else:
                        row_values.append(col.get_text(strip=True))
                        row_values.append(None)
                else:
                    row_values.append(col.get_text(strip=True))

            if len(standardized_cols_head) == len(row_values):
                row_dict = dict(zip(standardized_cols_head, row_values))
                all_data_json.append(row_dict)
            else:
                # Xử lý trường hợp lỗi cấu trúc bảng
                return {
                    "error": f"Lỗi cấu trúc bảng: Tiêu đề ({len(standardized_cols_head)}) và Giá trị ({len(row_values)}) không khớp."}

        # --- BƯỚC CUỐI CÙNG: TRẢ VỀ DỮ LIỆU ---
        print(all_data_json)
        return all_data_json

    except Exception as e:
        # Nếu có lỗi (ví dụ: đăng nhập thất bại, timeout, v.v.)
        return {"error": f"Lỗi trong quá trình chạy tool: {str(e)}"}

    finally:
        driver.quit()