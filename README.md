# 📋 Hệ Thống Điểm Danh & Quản Lý Học Viên - GX Thiên Phú

Hệ thống quản lý, thu thập dữ liệu và điểm danh học viên đa nền tảng, bao gồm Web Frontend (Next.js), AI/Scraper/API Backend (FastAPI & Selenium) và các module mở rộng (FaceAttend, scripts tự động hóa).

---

## 📁 Cấu Trúc Dự Án (Project Structure)

```text
gxthienphu-tool-diemdanhd2/
├── .env.example             # File mẫu biến môi trường
├── .gitignore               # Cấu hình Git Ignore cho toàn bộ dự án
├── requirements.txt         # Thư viện Python dùng chung (.venv)
├── README.md                # Tài liệu hướng dẫn sử dụng
│
├── frontend/                # Ứng dụng Web Client (Next.js, React, TailwindCSS, Shadcn UI)
│   ├── src/                 # Mã nguồn React / Next.js
│   ├── package.json         # Danh sách packages Node.js
│   └── .env.local           # Cấu hình môi trường cho Frontend
│
├── backend/                 # API Server & Backend Service (FastAPI, Selenium, Zalo/Telegram Bot)
│   ├── main.py              # File chạy chính FastAPI
│   ├── zalo_service.py      # Module gửi thông báo qua Zalo Bot
│   ├── telegram_service.py  # Module gửi thông báo qua Telegram
│   ├── scraper.py           # Bộ cào dữ liệu qua Selenium
│   └── .env                 # Cấu hình môi trường cho Backend
│
├── gxthienphu/              # Scripts xử lý dữ liệu học viên & công cụ cào phụ trợ
│   ├── getHTML.py
│   ├── scraper.py
│   └── diemdanh.html
│
└── FaceAttend/              # Tài liệu & Module nhận diện khuôn mặt tự động (Đang phát triển)
    └── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Thiết lập Môi Trường Python Dùng Chung

Tất cả các module Python (`backend`, `gxthienphu`, `FaceAttend`) đều sử dụng chung một môi trường ảo. Bạn có thể dùng **Conda** hoặc **venv**:

#### 🔹 Cách A: Dùng Conda (Khuyên dùng nếu bạn dùng Anaconda / Miniconda)
```bash
# Tạo môi trường conda tên venv_common (nếu chưa có)
conda create -n venv_common python=3.11 -y

# Kích hoạt môi trường
conda activate venv_common

# Cài đặt toàn bộ thư viện cần thiết
pip install -r requirements.txt
```

#### 🔹 Cách B: Dùng `venv` tiêu chuẩn của Python
```bash
# 1. Tạo môi trường ảo .venv tại thư mục gốc
python3 -m venv .venv

# 2. Kích hoạt môi trường ảo:
# macOS / Linux:
source .venv/bin/activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# 3. Cài đặt toàn bộ thư viện cần thiết:
pip install --upgrade pip
pip install -r requirements.txt
```

---

### 2. Thiết lập Biến Môi Trường (`.env`)

Copy file mẫu [.env.example](file:///.env.example) và điền các thông tin token cần thiết:

```bash
# Tạo file .env cho Backend
cp .env.example backend/.env

# Tạo file .env.local cho Frontend
cp .env.example frontend/.env.local
```

> **Gợi ý:** Bạn có thể giữ 1 file `.env` ở thư mục gốc nếu muốn quản lý tập trung toàn bộ cấu hình, hoặc tách riêng vào `backend/.env` và `frontend/.env.local`.

---

### 3. Khởi Chạy Dự Án

Hệ thống đã được tích hợp cơ chế **tự động khởi động Frontend khi bật Backend**.

#### 🌟 Cách 1: Chạy 1 Lệnh Tự Động Toàn Bộ (Khuyên Dùng)
Chỉ cần chạy Backend, FastAPI sẽ **tự động kích hoạt Next.js Frontend (Port 3000)** và tự động mở trình duyệt:

1. Kích hoạt môi trường Python (Conda hoặc venv):
   ```bash
   conda activate venv_common
   # hoặc: source .venv/bin/activate
   ```
2. Vào thư mục `backend` và chạy:
   ```bash
   cd backend
   python main.py
   # Hoặc: uvicorn main:app --reload --port 3001
   ```
3. Hệ thống sẽ tự động:
   - ✅ Bật Backend API tại `http://localhost:3001`
   - ✅ Kích hoạt Next.js Frontend nền tại `http://localhost:3000` (Log lưu tại `/tmp/frontend_dev.log`)
   - ✅ Tự mở trình duyệt truy cập `http://localhost:3000/dibu`
   - ✅ Tự động đóng cả Frontend khi bạn dừng Backend (`Ctrl + C`).

---

#### 🛠️ Cách 2: Chạy Thủ Công Từng Phần (Dành cho Debug / Phát triển Frontend)
Nếu bạn muốn xem trực tiếp log giao diện của Next.js:

- **Terminal 1 (Backend):**
  ```bash
  conda activate venv_common
  cd backend
  uvicorn main:app --reload --port 3001
  ```

- **Terminal 2 (Frontend):**
  ```bash
  cd frontend
  npm install
  npm run dev
  ```
  Truy cập giao diện: `http://localhost:3000`

---

## 🛠️ Một Số Lưu Ý & Khắc Phục Lỗi (Troubleshooting)

- **Cấu hình VS Code / Cursor / PyCharm:**
  - Chọn Python Interpreter trỏ vào đường dẫn `.venv/bin/python` (trên Mac/Linux) hoặc `.venv/Scripts/python.exe` (trên Windows) để IDE tự động nhận diện thư viện và gợi ý code chuẩn xác.
- **Selenium / Chrome Driver:**
  - `webdriver-manager` đã được tích hợp sẵn trong `requirements.txt` để tự động tải và cập nhật ChromeDriver tương thích với phiên bản Google Chrome trên máy.
- **Bảo mật:**
  - Tuyệt đối không commit các file chứa token/secret (`.env`, `.env.local`, `.session`) lên Git. Toàn bộ đã được cấu hình loại trừ tự động trong [.gitignore](file:///.gitignore).
