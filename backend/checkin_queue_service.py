# backend/checkin_queue_service.py
import os
import json
import time
import uuid
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional
from zalo_service import send_zalo_raw

QUEUE_FILE_PATH = os.path.join(os.path.dirname(__file__), "output_hocvien_data", "pending_checkin_queue.json")
queue_lock = threading.Lock()

def _ensure_queue_file():
    os.makedirs(os.path.dirname(QUEUE_FILE_PATH), exist_ok=True)
    if not os.path.exists(QUEUE_FILE_PATH):
        with open(QUEUE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)

def get_queue() -> List[Dict[str, Any]]:
    _ensure_queue_file()
    with queue_lock:
        try:
            with open(QUEUE_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Lỗi đọc queue file: {e}")
            return []

def save_queue(items: List[Dict[str, Any]]):
    _ensure_queue_file()
    with queue_lock:
        try:
            with open(QUEUE_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️ Lỗi ghi queue file: {e}")

def add_checkin_task(
    student_ids: List[str],
    date_str: str,
    checkin_type: str,
    students_info: List[Dict[str, Any]],
    lop_name: str,
    khoi_name: str,
    excluded_count: int = 0
) -> Dict[str, Any]:
    """Ghi chép tạm dữ liệu điểm danh vào hàng đợi JSON trước khi gửi lên CCAMS"""
    task_id = str(uuid.uuid4())[:8]
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    new_task = {
        "id": task_id,
        "created_at": now_str,
        "status": "pending", # "pending" | "processing" | "completed" | "failed_pending_retry"
        "student_ids": [str(x) for x in student_ids],
        "date_str": date_str,
        "checkin_type": checkin_type,
        "students_info": students_info,
        "lop_name": lop_name,
        "khoi_name": khoi_name,
        "excluded_count": excluded_count,
        "retry_count": 0,
        "last_error": None
    }

    queue = get_queue()
    queue.append(new_task)
    save_queue(queue)
    print(f"💾 [QUEUE] Đã lưu tạm tác vụ điểm danh [{task_id}] cho lớp {lop_name} ({len(student_ids)} em) vào JSON.")
    return new_task

def update_task_status(task_id: str, status: str, last_error: Optional[str] = None):
    queue = get_queue()
    for t in queue:
        if t.get("id") == task_id:
            t["status"] = status
            if last_error:
                t["last_error"] = last_error
            if status == "completed":
                t["completed_at"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            break
    
    # Dọn dẹp các tác vụ completed quá 24h
    active_queue = [t for t in queue if t.get("status") != "completed"]
    save_queue(active_queue)

def execute_driver_checkin_batch(driver, wait, student_ids: List[str], date_str: str, checkin_type: str) -> Dict[str, Any]:
    """Hàm lõi thực thi in-browser batch điểm danh qua Selenium"""
    if "/admin/diem-danh" not in driver.current_url:
        driver.get("https://ccamspro.thongtinxuanloc.com/admin/diem-danh")
        time.sleep(2)

    batch_js = """
    const [studentIds, dateStr, checkinType, done] = [arguments[0], arguments[1], arguments[2], arguments[arguments.length - 1]];
    
    if (!window.axios) {
        return done({ success: false, error: 'Không tìm thấy window.axios trong phiên làm việc' });
    }

    async function runBatch() {
        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (const mahv of studentIds) {
            try {
                const res = await window.axios.post('/api/v1/diem-danh', {
                    MAHOCVIEN: String(mahv),
                    NGAYDIEMDANH: dateStr,
                    LOAI: checkinType
                });
                if (res.status === 200 || (res.data && res.data.success !== false)) {
                    successCount++;
                    results.push({ id: mahv, success: true, data: res.data });
                } else {
                    failCount++;
                    results.push({ id: mahv, success: false, detail: res.data });
                }
            } catch (err) {
                failCount++;
                results.push({ id: mahv, success: false, error: err.message || String(err) });
            }
            await new Promise(r => setTimeout(r, 35));
        }

        done({ success: true, successCount, failCount, results });
    }

    runBatch();
    """

    res = driver.execute_async_script(batch_js, student_ids, date_str, checkin_type)
    return res

def process_batch_queue_by_grade(browser_manager, fixed_username: str, fixed_password: str):
    """
    Tiến trình chạy ngầm quét hàng đợi tạm:
    - Gom tất cả các lớp thuộc cùng 1 KHỐI gửi luôn 1 lần nếu có nhiều lớp đang chờ.
    - Tự động chạy lại mỗi 2 phút.
    """
    queue = get_queue()
    pending_tasks = [t for t in queue if t.get("status") in ["pending", "failed_pending_retry"]]

    if not pending_tasks:
        return

    print(f"🔄 [AUTO-RETRY WORKER] Đang quét {len(pending_tasks)} tác vụ điểm danh chờ gửi lại...")

    # Nhóm các task theo (khoi_name, date_str, checkin_type)
    grouped: Dict[tuple, List[Dict[str, Any]]] = {}
    for task in pending_tasks:
        key = (task.get("khoi_name") or "Thiếu Nhi", task.get("date_str"), task.get("checkin_type"))
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(task)

    for (khoi_name, date_str, checkin_type), task_list in grouped.items():
        try:
            # Gom tất cả student_ids không trùng lặp
            all_student_ids = []
            all_students_info = []
            class_names = []
            task_ids = []

            for t in task_list:
                task_ids.append(t.get("id"))
                if t.get("lop_name") and t.get("lop_name") not in class_names:
                    class_names.append(t.get("lop_name"))
                for sid in t.get("student_ids", []):
                    if sid not in all_student_ids:
                        all_student_ids.append(sid)
                for sinfo in t.get("students_info", []):
                    if str(sinfo.get("ma_hoc_vien", "")) in all_student_ids:
                        all_students_info.append(sinfo)

            print(f"🚀 [AUTO-RETRY] Đang gửi gom theo Khối [{khoi_name}] cho {len(class_names)} lớp ({len(all_student_ids)} học viên)...")

            with browser_manager.lock:
                browser_manager.ensure_logged_in(fixed_username, fixed_password)
                res = execute_driver_checkin_batch(
                    browser_manager.driver,
                    browser_manager.wait,
                    all_student_ids,
                    date_str,
                    checkin_type
                )

            if res.get("success") and res.get("successCount", 0) > 0:
                success_count = res.get("successCount", len(all_student_ids))
                type_label = "Hiện diện Thánh Lễ" if checkin_type == "hiendien_tle" else "Hiện diện Giáo Lý"
                lop_str = ", ".join(class_names) if class_names else khoi_name

                # Gửi thông báo Zalo
                zalo_msg = (
                    f"📢 ĐIỂM DANH TỰ ĐỘNG THÀNH CÔNG (GỬI LẠI THEO KHỐI)\n"
                    f"⛪ Loại: {type_label}\n"
                    f"🏫 Khối: {khoi_name} (Lớp: {lop_str})\n"
                    f"📅 Ngày: {date_str}\n"
                    f"📊 Đã đồng bộ thành công: {success_count}/{len(all_student_ids)} học viên\n"
                    f"--------------------------\n"
                )

                checked_students = [s for s in all_students_info if str(s.get("ma_hoc_vien", "")) in all_student_ids]
                for idx, s in enumerate(checked_students[:30]):
                    holy_name = f"{s.get('ten_thanh', '').strip()} " if s.get('ten_thanh') else ""
                    full_name = s.get('full_name') or f"{s.get('ho', '')} {s.get('ten', '')}".strip()
                    code = f" {s.get('ma_hoc_vien', '').strip()}" if s.get('ma_hoc_vien') else ""
                    zalo_msg += f"{idx + 1}. ✅ {holy_name}{full_name}{code}\n"

                if len(checked_students) > 30:
                    zalo_msg += f"... và {len(checked_students) - 30} học viên khác\n"

                send_zalo_raw(zalo_msg)

                # Đánh dấu hoàn thành
                for tid in task_ids:
                    update_task_status(tid, "completed")
                print(f"✅ [AUTO-RETRY] Đã hoàn thành điểm danh tự động cho Khối {khoi_name}!")
            else:
                for tid in task_ids:
                    update_task_status(tid, "failed_pending_retry", res.get("error", "CCAMS busy"))

        except Exception as err:
            print(f"❌ [AUTO-RETRY ERROR] Khối {khoi_name}: {err}")
            for tid in task_ids:
                update_task_status(tid, "failed_pending_retry", str(err))

def start_retry_worker_loop(browser_manager, fixed_username: str, fixed_password: str):
    """Khởi chạy luồng chạy ngầm tự động thử lại mỗi 2 phút (120s)"""
    def loop():
        time.sleep(10) # Chờ server khởi động ổn định
        while True:
            try:
                process_batch_queue_by_grade(browser_manager, fixed_username, fixed_password)
            except Exception as e:
                print(f"⚠️ [RETRY WORKER LOOP ERROR]: {e}")
            time.sleep(120) # Chạy lại sau 2 phút

    t = threading.Thread(target=loop, daemon=True)
    t.start()
    print("⏰ [WORKER] Đã kích hoạt Background Retry Worker (tự động thử lại mỗi 2 phút)!")
