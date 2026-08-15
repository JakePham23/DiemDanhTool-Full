# telegram_service.py
import requests
import os
from datetime import datetime
from telethon import TelegramClient
api_id = 8577183985
api_hash = 'AAE1ldvXUFxDfHjZ89VwMlJW76KlEc5HlTQ'
def format_diemdanh_message(data: list) -> str:
    if not data:
        return "⚠️ Không có dữ liệu điểm danh."

    # Lấy thông tin chung từ bản ghi đầu tiên
    info = data[0]
    total = len(data)
    
    # Lọc danh sách vắng/trễ (Python lọc list cực nhanh)
    vangs = [r for r in data if "vắng" in r.get("loai_diem_danh", "").lower() or "nghỉ" in r.get("loai_diem_danh", "").lower()]
    tre = [r for r in data if "trễ" in r.get("loai_diem_danh", "").lower()]

    # Header
    msg = f"📢 <b>KẾT QUẢ ĐIỂM DANH MỚI</b>\n"
    msg += f"--------------------------\n"
    msg += f"🏫 Lớp: <b>{info.get('lop', 'N/A')}</b> (Khối {info.get('khoi', 'N/A')})\n"
    msg += f"🕒 Lúc: {info.get('ngay_gio_diem_danh', 'N/A')}\n"
    msg += f"👤 Check: {info.get('nguoi_diem_danh', 'N/A')}\n\n"

    # Body
    for r in data:
        status = r.get("loai_diem_danh", "")
        icon = "✅"
        if "vắng" in status.lower(): icon = "🔴"
        elif "trễ" in status.lower(): icon = "⚠️"
        elif "phép" in status.lower(): icon = "📝"
        
        # Format HTML cho Telegram
        msg += f"{icon} <b>{r.get('ho', '')} {r.get('ten', '')}</b> ({r.get('ma_hoc_vien', '')})\n"
        msg += f"   <i>{status}</i>\n\n"

    # Footer
    msg += f"--------------------------\n"
    msg += f"📊 <b>Tổng kết:</b> {total} HV\n"
    msg += f"🔴 Vắng: {len(vangs)} | ⚠️ Trễ: {len(tre)}"
    
    return msg

client = TelegramClient('anon', api_id, api_hash)
def send_telegram_task(data: list):
    """Hàm này sẽ được chạy ngầm (Background Task)"""
    try:
        # Lấy biến môi trường (Bạn nhớ cài thư viện python-dotenv nếu chưa load)
        token = "8577183985:AAE1ldvXUFxDfHjZ89VwMlJW76KlEc5HlTQ"|os.getenv(" ")
        chat_id = "-1003388554734" | os.getenv("TELEGRAM_CHAT_ID")
        
        if not token or not chat_id:
            print("❌ Lỗi: Thiếu Token hoặc Chat ID trong .env")
            return

        message = format_diemdanh_message(data)
        
        # url = f"https://api.telegram.org/bot{token}/sendMessage"
        # payload = {
        #     "chat_id": chat_id,
        #     "text": message,
        #     "parse_mode": "HTML"
        # }
        
        # # Gửi request
        # response = requests.post(url, json=payload)
        client.send_message(-1003388554734, message)
        # if response.status_code == 200:
        #     print("✅ Đã gửi Telegram thành công!")
        # else:
        #     print(f"❌ Lỗi gửi Telegram: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception gửi Telegram: {str(e)}")