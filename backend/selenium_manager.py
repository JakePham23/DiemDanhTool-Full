# selenium_manager.py

from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, WebDriverException
import time

class SeleniumManager:
    """
    Quản lý phiên Selenium WebDriver (Singleton Pattern).
    Đảm bảo driver chỉ được khởi tạo một lần và tự động đăng nhập lại khi session chết.
    """
    _instance = None
    DRIVER_RETRY_LIMIT = 3
    LOGIN_CHECK_ELEMENT = (By.ID, "user-profile-dropdown") # Giả định phần tử tồn tại sau khi đăng nhập

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(SeleniumManager, cls).__new__(cls)
            cls._instance.driver = None
            cls._instance.login_url = kwargs.get('login_url')
            cls._instance.username = kwargs.get('username')
            cls._instance.password = kwargs.get('password')
            cls._instance._init_driver()
        return cls._instance

    def _init_driver(self):
        """Khởi tạo Chrome WebDriver với cấu hình Headless cho deploy."""
        print("--- [SeleniumManager] Initializing new Chrome Driver...")
        
        chrome_options = Options()
        # Cấu hình cần thiết cho môi trường server/deploy
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080") # Đặt kích thước cửa sổ
        
        try:
            service = ChromeService(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.set_page_load_timeout(30)
            self.driver.set_script_timeout(30)
            print("--- [SeleniumManager] Driver initialized successfully.")
            self.ensure_login()
        except Exception as e:
            print(f"--- [SeleniumManager] ERROR: Failed to initialize driver: {e}")
            self.driver = None # Đặt driver thành None để báo hiệu lỗi nghiêm trọng

    def is_logged_in(self):
        """Kiểm tra session còn hợp lệ bằng cách tìm một phần tử sau khi đăng nhập."""
        if not self.driver:
            return False
            
        try:
            # Kiểm tra URL hiện tại có phải là trang đăng nhập không
            if 'admin/login' in self.driver.current_url.lower():
                return False
                
            # Kiểm tra phần tử chỉ có khi đã đăng nhập (sẽ raise exception nếu không tìm thấy)
            self.driver.find_element(self.LOGIN_CHECK_ELEMENT[0], self.LOGIN_CHECK_ELEMENT[1])
            return True
        except WebDriverException:
            # Xảy ra khi driver chết hoặc phần tử không tồn tại (chưa đăng nhập)
            return False

    def perform_login(self):
        """Thực hiện quy trình đăng nhập."""
        print(f"--- [SeleniumManager] Attempting to login to {self.login_url}...")
        
        try:
            self.driver.get(self.login_url)
            
            # --- START: THAY THẾ BẰNG LOGIC ĐĂNG NHẬP CỦA BẠN ---
            # Giả định: input user/pass có ID là 'username' và 'password', nút submit có ID 'submit-button'
            self.driver.find_element(By.NAME, "tendangnhap").send_keys(self.username)
            self.driver.find_element(By.NAME, "matkhau").send_keys(self.password)
            self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
            # --- END: THAY THẾ BẰNG LOGIC ĐĂNG NHẬP CỦA BẠN ---

            time.sleep(5) # Đợi chuyển hướng và load trang

            if self.is_logged_in():
                print("--- [SeleniumManager] Login successful.")
                return True
            else:
                print("--- [SeleniumManager] Login failed (Login element not found after submit).")
                return False
        except TimeoutException:
            print("--- [SeleniumManager] Login failed due to timeout.")
            return False
        except Exception as e:
            print(f"--- [SeleniumManager] An unexpected error occurred during login: {e}")
            return False

    def get_driver(self):
        """Trả về instance driver, đảm bảo nó đã đăng nhập."""
        if not self.driver:
            # Cố gắng khởi tạo lại nếu driver bị lỗi nghiêm trọng
            self._init_driver()
            if not self.driver:
                 raise Exception("Critical: Selenium Driver could not be initialized.")
        
        if self.is_logged_in():
            # Session còn sống, trả về driver ngay
            return self.driver
        
        # Session đã chết, thử đăng nhập lại
        print("--- [SeleniumManager] Session expired or invalid. Re-logging in...")
        
        for attempt in range(self.DRIVER_RETRY_LIMIT):
            try:
                if self.perform_login():
                    return self.driver
            except Exception as e:
                print(f"--- [SeleniumManager] Re-login attempt {attempt + 1} failed: {e}")
                time.sleep(2)
        
        # Nếu đăng nhập lại thất bại sau nhiều lần
        raise Exception("Failed to log in to CCAMS after multiple attempts. Check credentials or site status.")

# NOTE: Bạn phải import và sử dụng manager này trong các hàm scraper của mình.
# Ví dụ: sửa các hàm trong getHTML.py để nhận 'driver' làm tham số đầu tiên.
# VÍ DỤ: def getListStudentByInfo(driver, url_navigation):