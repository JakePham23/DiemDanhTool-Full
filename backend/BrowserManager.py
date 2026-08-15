import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs
import time

# --- CẤU HÌNH ---
BASE_URL = 'https://ccamspro.thongtinxuanloc.com'

class BrowserManager:
    def __init__(self):
        self.driver = None
        self.wait = None
        self.lock = asyncio.Lock() # Khóa để tránh 2 request dùng chung 1 trình duyệt cùng lúc

    def start_and_login(self, username, password):
        print("🚀 [SYSTEM] Khởi động Browser & Đăng nhập...")
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        
        # Khởi tạo driver
        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        self.wait = WebDriverWait(self.driver, 10) # Tăng timeout lên 10s cho an toàn

        try:
            # Truy cập trang Login
            self.driver.get(BASE_URL + '/admin')
            
            # Kiểm tra xem có cần đăng nhập không (nếu cookie còn sống thì url sẽ khác)
            if "login" in self.driver.current_url:
                print("🔑 [SYSTEM] Đang thực hiện đăng nhập...")
                username_field = self.wait.until(EC.presence_of_element_located((By.ID, "email")))
                username_field.send_keys(username)
                
                password_field = self.wait.until(EC.presence_of_element_located((By.ID, "password")))
                password_field.send_keys(password)
                
                login_button = self.wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']")))
                login_button.click()
                
                # Chờ chuyển hướng sau khi login thành công (ví dụ chờ dashboard xuất hiện)
                self.wait.until(EC.url_contains("/admin"))
                print("✅ [SYSTEM] Đăng nhập thành công!")
            else:
                print("ℹ️ [SYSTEM] Đã đăng nhập sẵn.")

        except Exception as e:
            print(f"❌ [SYSTEM] Lỗi khởi động: {e}")
            self.close()
            raise e

    def close(self):
        if self.driver:
            print("🛑 [SYSTEM] Đang đóng Browser...")
            self.driver.quit()
            self.driver = None

# Khởi tạo instance toàn cục
browser_manager = BrowserManager()