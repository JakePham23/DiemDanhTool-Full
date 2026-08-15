// src/lib/api/scrape.api.ts (HOÀN CHỈNH VỚI REACT CACHE CHO MỌI HÀM)

import { cache } from 'react'; // 👈 BẮT BUỘC
import api from '../axios.customize' 
import { InitDataResponse, DiemDanhRecord, OptionItem } from '@/lib/types/type' 
// ----------------------------------------------------------------------
// Định nghĩa Interfaces
// ----------------------------------------------------------------------
// import {getReportTitle} from '@/lib/attendance-management/index'
interface TNThienPhu {
  stt: string
  ten_lop: string
  url_chi_tiet: string
  nam: string
  nu: string
  tong: string
  chu_nhiem: string
  glv1: string
  glv2: string
}

interface RawOptionItem {
    [key: string]: string; 
}

interface RawInitData {
    [x: string]: any
    nienhocs: RawOptionItem[];
    khois: RawOptionItem[];
    lophocs: RawOptionItem[];
}

interface GenericApiResponse {
    status: string;
    data: RawInitData;
    count?: number; 
}

// ----------------------------------------------------------------------
// Hàm Utilities
// ----------------------------------------------------------------------

const normalizeOptions = (arr: any[], valueKey: string, labelKey: string): OptionItem[] => {
    if (!Array.isArray(arr)) return [];
    
    return arr
        .map(item => ({
            value: String(item[valueKey] || ''), 
            label: String(item[labelKey] || ''),
        }));
};

// ----------------------------------------------------------------------
// 1. getDataGxThienPhu (Dữ liệu tĩnh)
// ----------------------------------------------------------------------

// Cache: Tối ưu hoá việc gọi API trong một request.
export const getDataGxThienPhu = cache(async (): Promise<TNThienPhu[]> => {
    // console.log('Fetching: getDataGxThienPhu');
    const result = await api.get('/scrape')
    return result.data.data
});

// ----------------------------------------------------------------------
// 2. getDataGradeByInfo (Tham số động + POST)
// ----------------------------------------------------------------------

// Cache: Ghi nhớ kết quả dựa trên tham số url_navigation.
// Nếu hai component gọi với cùng một url_navigation trong cùng 1 Server Request, chỉ gọi API một lần.
export const getDataGradeByInfo = cache(async (url_navigation: string) => {


    // console.log(`Fetching: getDataGradeByInfo for URL: ${url_navigation}`);
    const result = await api.post(`/scrape/grade`, {url_navigation});
    return result.data.data;
});


// ----------------------------------------------------------------------
// 3. getInitDiemDanhOptions (Dữ liệu cấu hình/Dropdown)
// ----------------------------------------------------------------------

// Cache: Rất hữu ích cho dữ liệu cấu hình.
export const getInitDiemDanhOptions = cache(async (): Promise<InitDataResponse> => {
    try {
        // console.log('Fetching: getInitDiemDanhOptions');
        const response = await api.get<GenericApiResponse>('/scrape/diemdanh/init');
        
        const rawData = response.data.data;

        const normalizedData: InitDataResponse = {
            nienhocs: normalizeOptions(rawData.nienhocs, 'MANIENHOC', 'TENNIENHOC'),
            khois: normalizeOptions(rawData.khois, 'MAKHOI', 'TENKHOI'),
            lophocs: normalizeOptions(rawData.lophocs, 'MALOPHOC', 'TENLOPHOC'),
            diemdanhtypes: Array.isArray(rawData?.diemdanhtypes)
            ? normalizeOptions(rawData.diemdanhtypes, 'VALUE', 'TENLOAI')
            : [],        
            };

        return normalizedData;
        
    } catch (error: any) {
        const errorMessage = error.response?.data?.detail 
                             || error.message 
                             || "Lỗi mạng khi tải cấu hình.";
        throw new Error(errorMessage);
    }
});

// ----------------------------------------------------------------------
// 4. getDiemDanhData (Tham số động + POST)
// ----------------------------------------------------------------------

// Cache: Ghi nhớ kết quả dựa trên tham số urlQuery.
// export const getDiemDanhData = cache(async (urlQuery: string): Promise<DiemDanhRecord[]> => {
//     // console.log(`Fetching: getDiemDanhData for query: ${urlQuery}`);
//     const result = await api.post(`/scrape/diemdanh/data`, {
//         url_navigation: urlQuery 
//     });

//     if (!Array.isArray(result.data.data)) {
//         if (result.data.data && result.data.data.error) {
//              throw new Error(result.data.data.error);
//         }
//         return [];
//     }

//     return result.data.data as DiemDanhRecord[];
// });
// import { sendTelegramNotification } from '@/lib/send-notification/telegramHelper'; // Nhớ sửa đường dẫn import

export const getDiemDanhData = cache(async (urlQuery: string): Promise<DiemDanhRecord[]> => {
    // 1. Gọi API FastAPI
    const result = await api.post(`/scrape/diemdanh/data`, {
        url_navigation: urlQuery 
    });

    // 2. Validate lỗi
    if (!Array.isArray(result.data.data)) {
        if (result.data.data && result.data.data.error) {
             throw new Error(result.data.data.error);
        }
        return [];
    }
    const data = result.data.data as DiemDanhRecord[];

    // --- TÍCH HỢP TELEGRAM TẠI ĐÂY ---
    // if (data.length > 0) {
        // Gọi hàm gửi không cần await (fire and forget) để web load nhanh hơn
    // sendTelegramNotification(data).catch(err => console.log(err));
    // }
    // ---------------------------------

    return data;
});

// ----------------------------------------------------------------------
// 5. getDibuSummary & getDibuCache (Đi lễ bù)
// ----------------------------------------------------------------------

export const getDibuSummary = async (
    fromDate: string,
    toDate: string,
    nienHoc: string = "4",
    khoi: string = "3",
    lop: string = "45",
    forceScrape: boolean = true
) => {
    try {
        const result = await api.post('/scrape/dibu', {
            from_date: fromDate,
            to_date: toDate,
            nien_hoc: nienHoc,
            khoi: khoi,
            lop: lop,
            force_scrape: forceScrape
        });

        if (result.data && result.data.status === 'success') {
            return result.data.data;
        }
        
        throw new Error(result.data?.message || "Không thể lấy dữ liệu đi bù");
    } catch (error: any) {
        // If backend fails or is offline, try reading local static json cache
        console.warn("Backend API error, attempting fallback to static json:", error);
        try {
            const staticRes = await fetch('/output_hocvien_data/dibu_thieu_nhi_1_summary.json');
            if (staticRes.ok) {
                return await staticRes.json();
            }
        } catch (staticErr) {
            console.error("Static JSON fallback failed:", staticErr);
        }
        throw error;
    }
};

export const getDibuCache = async () => {
    try {
        const result = await api.get('/scrape/dibu/cache');
        if (result.data && result.data.status === 'success') {
            return result.data.data;
        }
    } catch (e) {
        // Fallback to static public file
        try {
            const staticRes = await fetch('/output_hocvien_data/dibu_thieu_nhi_1_summary.json');
            if (staticRes.ok) {
                return await staticRes.json();
            }
        } catch {}
    }
    return null;
};

// ----------------------------------------------------------------------
// 6. Cập nhật dữ liệu danh sách học viên ngầm
// ----------------------------------------------------------------------

export const triggerUpdateData = async () => {
    const result = await api.post('/update-data');
    return result.data;
};

export const getUpdateDataStatus = async () => {
    const result = await api.get('/update-data/status');
    return result.data?.data;
};

// ----------------------------------------------------------------------
// 7. Điểm danh nhanh (Thánh lễ / Giáo lý)
// ----------------------------------------------------------------------

export interface QuickCheckinPayload {
    student_ids: string[];
    date_str: string;
    checkin_type: 'hiendien_tle' | 'hiendien_gly';
    students_info: any[];
    lop_name?: string;
    khoi_name?: string;
    excluded_count?: number;
}

export const executeQuickCheckin = async (payload: QuickCheckinPayload) => {
    const result = await api.post('/checkin/quick', payload);
    return result.data;
};