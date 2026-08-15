# backend/quick_checkin_service.py
import time
from typing import List, Dict, Any, Optional
from zalo_service import send_zalo_raw, resolve_class_and_grade
from checkin_queue_service import (
    add_checkin_task,
    update_task_status,
    execute_driver_checkin_batch
)

def perform_batch_checkin(
    driver,
    wait,
    student_ids: List[str],
    date_str: str, # DD/MM/YYYY
    checkin_type: str, # 'hiendien_tle' | 'hiendien_gly'
    students_info: List[Dict[str, Any]],
    lop_name: str = "",
    khoi_name: str = "",
    excluded_count: int = 0
) -> Dict[str, Any]:
    """
    Thực hiện điểm danh nhanh:
    1. Ghi chép tạm dữ liệu vào file JSON hàng đợi trước.
    2. Gửi lệnh điểm danh lên CCAMS.
    3. Nếu thành công -> gửi Zalo + cập nhật trạng thái.
    4. Nếu thất bại / nghẽn -> giữ lại trong JSON hàng đợi tạm và báo hệ thống sẽ tự gửi lại sau 2 phút.
    """
    if not student_ids:
        return {"success": False, "message": "Không có học viên nào được chọn để điểm danh."}

    # BƯỚC 1: LƯU TẠM DỮ LIỆU VÀO HÀNG ĐỢI JSON
    task = add_checkin_task(
        student_ids=student_ids,
        date_str=date_str,
        checkin_type=checkin_type,
        students_info=students_info,
        lop_name=lop_name,
        khoi_name=khoi_name,
        excluded_count=excluded_count
    )
    task_id = task["id"]

    # BƯỚC 2: THỬ THỰC THI QUA TRÌNH DUYỆT
    try:
        res = execute_driver_checkin_batch(driver, wait, student_ids, date_str, checkin_type)
    except Exception as e:
        print(f"⚠️ [CHECKIN FAILED / BUSY] Lỗi thực thi Selenium: {e}")
        update_task_status(task_id, "failed_pending_retry", str(e))
        return {
            "success": False,
            "queued_retry": True,
            "task_id": task_id,
            "message": "⚠️ Hệ thống CCAMS đang bận / nghẽn mạng. Dữ liệu điểm danh đã được lưu tạm an toàn! Hệ thống sẽ tự động gửi lại trong vòng 2 phút nữa, vui lòng chờ thông báo Zalo."
        }

    success_count = res.get("successCount", 0)
    fail_count = res.get("failCount", 0)

    # Nếu tất cả hoặc phần lớn bị fail (nghẽn mạng CCAMS)
    if success_count == 0 and fail_count > 0:
        error_msg = res.get("error") or "Không thể gửi dữ liệu lên máy chủ CCAMS"
        update_task_status(task_id, "failed_pending_retry", error_msg)
        return {
            "success": False,
            "queued_retry": True,
            "task_id": task_id,
            "message": "⚠️ Hệ thống CCAMS đang bị nghẽn (0/{} thành công). Dữ liệu đã được lưu tạm an toàn! Hệ thống sẽ tự động gửi lại trong vòng 2 phút nữa, vui lòng chờ thông báo Zalo.".format(len(student_ids))
        }

    # BƯỚC 3: THÀNH CÔNG -> GỬI ZALO & ĐÁNH DẤU COMPLETED
    update_task_status(task_id, "completed")

    type_label = "Hiện diện Thánh Lễ" if checkin_type == "hiendien_tle" else "Hiện diện Giáo Lý"
    checked_students = [s for s in students_info if str(s.get("ma_hoc_vien", "")) in student_ids]
    
    zalo_msg = (
        f"📢 ĐIỂM DANH NHANH THÀNH CÔNG\n"
        f"⛪ Loại: {type_label}\n"
        f"🏫 Lớp: {lop_name} - Khối: {khoi_name}\n"
        f"📅 Ngày điểm danh: {date_str}\n"
        f"--------------------------\n"
    )

    for idx, s in enumerate(checked_students[:35]):
        holy_name = f"{s.get('ten_thanh', '').strip()} " if s.get('ten_thanh') else ""
        full_name = s.get('full_name') or f"{s.get('ho', '')} {s.get('ten', '')}".strip()
        code = f" {s.get('ma_hoc_vien', '').strip()}" if s.get('ma_hoc_vien') else ""
        zalo_msg += f"{idx + 1}. ✅ {holy_name}{full_name}{code}\n"

    if len(checked_students) > 35:
        zalo_msg += f"... và {len(checked_students) - 35} học viên khác\n"

    zalo_msg += f"--------------------------\n"
    zalo_msg += f"📊 Đã điểm danh: {success_count}/{len(student_ids)} học viên"
    if excluded_count > 0:
        zalo_msg += f" (Ngoại trừ: {excluded_count} em vắng)"
    
    send_zalo_raw(zalo_msg)

    return {
        "success": True,
        "success_count": success_count,
        "fail_count": fail_count,
        "total": len(student_ids),
        "date": date_str,
        "type": checkin_type,
        "message": f"Đã điểm danh thành công {success_count}/{len(student_ids)} học viên."
    }
