// utils/zaloHelper.ts

export interface DiemDanhRecord {
    stt?: string;
    ma_hoc_vien: string;
    ten_thanh?: string;
    ho: string;
    ten: string;
    full_name?: string;
    lop?: string;
    khoi?: string;
    nguoi_diem_danh?: string;
    loai_diem_danh?: string;
    ngay_diem_danh?: string;
    ngay_gio_diem_danh?: string;
}

export interface ExtraNotificationInfo {
    MAKHOI?: string;
    MALOPHOC?: string;
    date?: string;
}

// 1. Mapping Mã lớp và Mã khối sang tên đầy đủ
export const MALOPHOC_NAME_MAP: Record<string, { lop: string; khoi: string }> = {
    "39": { lop: "Chiên Con 1", khoi: "Chiên Con" },
    "40": { lop: "Chiên Con 2", khoi: "Chiên Con" },
    "41": { lop: "Ấu Nhi 1A", khoi: "Ấu Nhi" },
    "42": { lop: "Ấu Nhi 1B", khoi: "Ấu Nhi" },
    "43": { lop: "Ấu Nhi 2", khoi: "Ấu Nhi" },
    "44": { lop: "Ấu Nhi 3", khoi: "Ấu Nhi" },
    "45": { lop: "Thiếu Nhi 1", khoi: "Thiếu Nhi" },
    "46": { lop: "Thiếu Nhi 2", khoi: "Thiếu Nhi" },
    "47": { lop: "Thiếu Nhi 3", khoi: "Thiếu Nhi" },
    "49": { lop: "Nghĩa Sĩ", khoi: "Nghĩa Sĩ" },
    "50": { lop: "Hiệp Sĩ", khoi: "Hiệp Sĩ" },
};

export const MAKHOI_NAME_MAP: Record<string, string> = {
    "1": "Chiên Con",
    "2": "Ấu Nhi",
    "3": "Thiếu Nhi",
    "4": "Nghĩa Sĩ",
    "5": "Hiệp Sĩ",
};

// 2. Hàm chia nhỏ mảng thành các phần (Chunking)
export function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked_arr = [];
    for (let i = 0; i < array.length; i += size) {
        chunked_arr.push(array.slice(i, i + size));
    }
    return chunked_arr;
}

// 3. Map tiêu đề báo cáo dựa trên loại yêu cầu
export const getReportTitle = (typeCode: string): string => {
    switch (typeCode) {
        // Nhóm 1: Báo cáo tổng hợp
        case 'all_info_attendances':
            return "BÁO CÁO TỔNG HỢP (THÁNH LỄ & GIÁO LÝ)";

        // Nhóm 2: Danh sách vắng
        case 'ds_vang_tle':
            return "VẮNG THÁNH LỄ";
        case 'ds_vang_gl':
        case 'ds_vang_gly':
            return "VẮNG GIÁO LÝ";
        case 'ds_vang_all':
            return "VẮNG THÁNH LỄ VÀ GIÁO LÝ";

        // Nhóm 3: Hiện diện chi tiết
        case 'hiendien_tle':
            return "HIỆN DIỆN THÁNH LỄ";
        case 'hiendien_gly':
        case 'hiendien_gl':
            return "HIỆN DIỆN GIÁO LÝ";
        case 'hiendien_all':
            return "HIỆN DIỆN THÁNH LỄ VÀ GIÁO LÝ";

        // Nhóm 4: Vắng có phép
        case 'vang_tle':
            return "VẮNG CÓ PHÉP (THÁNH LỄ)";
        case 'vang_gly':
        case 'vang_gl':
            return "VẮNG CÓ PHÉP (GIÁO LÝ)";
        case 'vang_all':
            return "VẮNG CÓ PHÉP (THÁNH LỄ & GIÁO LÝ)";

        default:
            if (typeCode.startsWith('vang_')) {
                return "VẮNG CÓ PHÉP";
            }
            if (typeCode.startsWith('hiendien_')) {
                return "HIỆN DIỆN";
            }
            return "KẾT QUẢ ĐIỂM DANH";
    }
};

// 4. Giải quyết chính xác tên Lớp và tên Khối (tránh undefined)
export const resolveClassAndGrade = (
    firstRecord?: DiemDanhRecord,
    extraInfo?: ExtraNotificationInfo
): { lop: string; khoi: string } => {
    let lop = firstRecord?.lop || '';
    let khoi = firstRecord?.khoi || '';

    // Nếu extraInfo có MALOPHOC
    if (extraInfo?.MALOPHOC && MALOPHOC_NAME_MAP[extraInfo.MALOPHOC]) {
        const mapping = MALOPHOC_NAME_MAP[extraInfo.MALOPHOC];
        lop = mapping.lop;
        khoi = mapping.khoi;
    }

    // Nếu lop là số ID
    if (MALOPHOC_NAME_MAP[lop]) {
        const mapping = MALOPHOC_NAME_MAP[lop];
        lop = mapping.lop;
        khoi = mapping.khoi;
    }

    // Nếu khoi là số ID
    if (MAKHOI_NAME_MAP[khoi]) {
        khoi = MAKHOI_NAME_MAP[khoi];
    } else if (extraInfo?.MAKHOI && MAKHOI_NAME_MAP[extraInfo.MAKHOI]) {
        khoi = MAKHOI_NAME_MAP[extraInfo.MAKHOI];
    }

    // Suy luận khối từ tên lớp nếu vẫn chưa có
    if (!khoi || khoi === 'undefined') {
        const lowerLop = (lop || '').toLowerCase();
        if (lowerLop.includes('thiếu nhi') || lowerLop.includes('thieu nhi')) khoi = 'Thiếu Nhi';
        else if (lowerLop.includes('ấu nhi') || lowerLop.includes('au nhi')) khoi = 'Ấu Nhi';
        else if (lowerLop.includes('chiên con') || lowerLop.includes('chien con')) khoi = 'Chiên Con';
        else if (lowerLop.includes('nghĩa sĩ') || lowerLop.includes('nghia si')) khoi = 'Nghĩa Sĩ';
        else if (lowerLop.includes('hiệp sĩ') || lowerLop.includes('hiep si')) khoi = 'Hiệp Sĩ';
        else khoi = 'Xứ Đoàn Kitô Vua';
    }

    if (!lop || lop === 'undefined') {
        lop = 'Tất cả học viên';
    }

    return { lop, khoi };
};

// 5. Format nội dung gửi Zalo (Dạng súc tích gọn gàng)
export const formatMessageZalo = (
    records: DiemDanhRecord[], 
    chunkIndex: number, 
    totalChunks: number, 
    reportType: string = "",
    extraInfo?: ExtraNotificationInfo,
    startOffset: number = 0
): string => {
    const { lop, khoi } = resolveClassAndGrade(records[0], extraInfo);
    const title = getReportTitle(reportType);
    let msg = "";

    // HEADER
    if (chunkIndex === 0) {
        msg += `📢 ${title}${totalChunks > 1 ? ` (Phần ${chunkIndex + 1}/${totalChunks})` : ''}\n`;
        msg += `🏫 Lớp: ${lop} - Khối: ${khoi}\n`;
        if (extraInfo?.date) {
            msg += `📅 Ngày: ${extraInfo.date}\n`;
        }
        msg += `--------------------------\n`;
    } else {
        msg += `📢 ${title} (Phần ${chunkIndex + 1}/${totalChunks} - Tiếp theo)\n`;
        msg += `🏫 Lớp: ${lop} - Khối: ${khoi}\n`;
        msg += `--------------------------\n`;
    }

    // BODY: Liệt kê gọn gàng 1 dòng mỗi em
    records.forEach((r, idx) => {
        const itemNumber = startOffset + idx + 1;
        const holyName = r.ten_thanh ? `${r.ten_thanh.trim()} ` : '';
        const fullName = r.full_name || `${r.ho || ''} ${r.ten || ''}`.trim();
        const studentCode = r.ma_hoc_vien ? ` ${r.ma_hoc_vien.trim()}` : '';

        if (reportType === 'all_info_attendances') {
            const status = r.loai_diem_danh ? ` (${r.loai_diem_danh})` : '';
            msg += `${itemNumber}. ${holyName}${fullName}${studentCode}${status}\n`;
        } else {
            let icon = '✅';
            if (reportType.startsWith('ds_vang')) {
                icon = '🔴';
            }
            msg += `${itemNumber}. ${icon} ${holyName}${fullName}${studentCode}\n`;
        }
    });

    return msg;
};

// 7. Hàm gửi thông báo đến Zalo Bot
export const sendZaloNotification = async (
    data: DiemDanhRecord[], 
    reportType: string = "",
    extraInfo?: ExtraNotificationInfo
) => {
    const token = process.env.NEXT_PUBLIC_ZALO_BOT_TOKEN || process.env.ZALO_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_ZALO_CHAT_ID || process.env.CHAT_ID;

    if (!token || !chatId) {
        console.error("❌ Lỗi ENV: Thiếu ZALO_BOT_TOKEN hoặc CHAT_ID");
        return;
    }

    if (!data || data.length === 0) {
        console.log("⚠️ Không có học viên nào để gửi thông báo Zalo");
        return;
    }

    const CHUNK_SIZE = 35; // Giới hạn 35 học sinh mỗi tin nhắn
    const chunks = chunkArray(data, CHUNK_SIZE);
    const API_URL = `https://bot-api.zaloplatforms.com/bot${token}/sendMessage`;

    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunkData = chunks[i];
            const startOffset = i * CHUNK_SIZE;
            let message = formatMessageZalo(chunkData, i, chunks.length, reportType, extraInfo, startOffset);

            if (i === chunks.length - 1) {
                message += `--------------------------\n`;
                message += `📊 Tổng số: ${data.length} học viên`;
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message
                }),
            });

            const resJson = await response.json();
            if (!resJson.ok) {
                console.error(`❌ Zalo API Error (Phần ${i + 1}):`, resJson);
            }
        }
        console.log(`✅ Đã gửi Zalo thành công: ${getReportTitle(reportType)} (${data.length} học viên)`);

    } catch (error) {
        console.error("❌ Lỗi kết nối Zalo Bot API:", error);
    }
};
