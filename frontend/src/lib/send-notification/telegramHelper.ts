// utils/telegramHelper.ts

export interface DiemDanhRecord {
    stt: string;
    ma_hoc_vien: string;
    ten_thanh: string;
    ho: string;
    ten: string;
    lop: string;
    khoi: string;
    nguoi_diem_danh: string;
    loai_diem_danh: string;
    ngay_diem_danh: string;
    ngay_gio_diem_danh: string;
}
// utils/telegramHelper.ts
import {MAKHOI_TENKHOI} from '@/lib/utils/utils'
// ... (Interface giữ nguyên) ...

// Hàm chia nhỏ mảng thành các mảng con (Chunking)
export function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked_arr = [];
    for (let i = 0; i < array.length; i += size) {
        chunked_arr.push(array.slice(i, i + size));
    }
    return chunked_arr;
}
// utils/telegramHelper.ts
import { DIEM_DANH_OPTIONS } from "@/lib/utils/utils"; // Import biến mapping của bạn

// 1. Map tiêu đề báo cáo dựa trên loại yêu cầu
export const getReportTitle = (typeCode: string): string => {
    // Trường hợp đặc biệt: Báo cáo tổng hợp
    if (typeCode === 'all_info_attendances') {
        return "BÁO CÁO TỔNG HỢP (LỄ & GIÁO LÝ)";
    }

    // Các trường hợp lọc cụ thể (Vắng lễ, Vắng GL...)
    const option = DIEM_DANH_OPTIONS.find(opt => opt.value === typeCode);
    return option ? option.label.toUpperCase() : "KẾT QUẢ ĐIỂM DANH";
};

// 2. Hàm format nội dung
export const formatMessageHTML = (
    records: DiemDanhRecord[], 
    chunkIndex: number, 
    totalChunks: number, 
    reportType: string = ""
): string => {
    const info = records[0];
    
    // HEADER: Tiêu đề dựa trên reportType (đã map ở trên)
    let msg = "";
    if (chunkIndex === 0) {
        const title = getReportTitle(reportType);
        msg += `📢 <b>${title}</b> (Phần ${chunkIndex + 1}/${totalChunks})\n`;
        msg += `🏫 Lớp: <b>${info.lop}</b> - Khối: ${MAKHOI_TENKHOI[info.khoi]}\n`;
        msg += `--------------------------\n`;
    } else {
        const title = getReportTitle(reportType);
        msg += `... <b>${title} (Tiếp)</b>\n\n`;
    }

    // BODY: Xử lý từng dòng học sinh
    records.forEach((r) => {
        // Lấy trạng thái thực tế của từng học sinh
        const statusText = r.loai_diem_danh || ""; 
        
        // Logic chọn Icon thông minh dựa trên nội dung text
        let icon = '🔵'; // Mặc định
        const lowerStatus = statusText.toLowerCase();

        if (lowerStatus.includes('✅')) icon = ''; // Nếu text đã có icon sẵn (như hàm tổng hợp) thì không thêm nữa
        else if (lowerStatus.includes('vắng')) icon = '🔴';
        else if (lowerStatus.includes('trễ')) icon = '⚠️';
        else if (lowerStatus.includes('phép')) icon = '📝';
        else if (lowerStatus.includes('hiện diện') || lowerStatus.includes('có mặt')) icon = '✅';

        // In tên và MSSV
        msg += `${icon} <b>${r.ho} ${r.ten}</b> <code>${r.ma_hoc_vien}</code>\n`;
        
        // In trạng thái chi tiết
        // Nếu là báo cáo tổng hợp, statusText thường dài (VD: "✅ Lễ | 🔴 Vắng GL") -> Luôn hiển thị
        // Nếu là báo cáo vắng đơn lẻ -> Có thể ẩn nếu muốn gọn
        if (statusText.length > 0) {
             msg += `   └ <i>${statusText}</i>\n`;
        }
        
        msg += `\n`; // Xuống dòng cho thoáng
    });

    return msg;
};

// 3. Cập nhật hàm gửi tin nhắn để nhận reportType từ bên ngoài truyền vào
export const sendTelegramNotification = async (
    data: DiemDanhRecord[], 
    reportType: string = "" // <--- THAM SỐ MỚI (Mặc định rỗng)
) => {
    const token = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error("❌ Lỗi ENV Telegram");
        return;
    }

    const CHUNK_SIZE = 30; 
    const chunks = chunkArray(data, CHUNK_SIZE);

    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunkData = chunks[i];
            
            // Truyền reportType xuống hàm format
            let message = formatMessageHTML(chunkData, i, chunks.length, reportType);

            if (i === chunks.length - 1) {
                const total = data.length;
                message += `--------------------------\n`;
                message += `📊 <b>Tổng số:</b> ${total} HV`;
            }

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                }),
            });
        }
        console.log(`✅ Đã gửi Telegram thành công (${reportType})`);

    } catch (error) {
        console.error("❌ Lỗi gửi Telegram:", error);
    }
};