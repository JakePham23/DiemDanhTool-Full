import { InitOptions, UrlRequire, DiemDanhRecord, DateRange } from "@/lib/types/type"; // Nhớ import DiemDanhRecord
import { getDiemDanhData, getDataGradeByInfo } from '@/lib/api/scrape.api';
import {
    MAP_VANG_TO_HIENDIEN,
    MAP_VANG_TO_VIETNAMESE,
    AllInfoAttendances,
    MAP_HIENDIEN_TO_VIETNAMESE, DIEM_DANH_OPTIONS
} from "@/lib/utils/utils";
import { getDataGradeByInfoJson } from './file-action';// 1. Hàm tạo URL cho điểm danh thông thường

export const formatUrlAttendance = (urlRequire: UrlRequire): string => {
    const { BASE_URL, initOptions, dateRange, search } = urlRequire;

    const baseUrl = BASE_URL || "";

    let urlQuery = `${baseUrl}?MANIENHOC=${initOptions.MANIENHOC}&MAKHOI=${initOptions.MAKHOI}&MALOPHOC=${initOptions.MALOPHOC}`;
    urlQuery += `&filter=${initOptions.DIEMDANHTYPE}`;
    urlQuery += `&from=${dateRange.fromDate}`;

    if (dateRange.toDate) {
        urlQuery += `&to=${dateRange.toDate}`;
    }
    if (search) {
        urlQuery += `&search=${encodeURIComponent(search)}`;
    }

    return urlQuery;
}

export const getDataAttendances = async (
    urlQuery: string,
    NGAYDIEMDANH: any, 
    DIEMDANHTYPE: any,
    initOptions?: { MAKHOI?: string; MALOPHOC?: string }
): Promise<DiemDanhRecord[]> => {
    let finalDisplayData = await getDiemDanhData(urlQuery);
    finalDisplayData = finalDisplayData.map((student: any) => ({
        ...student, // Giữ lại họ tên, mã hv
        loai_diem_danh: MAP_HIENDIEN_TO_VIETNAMESE[DIEMDANHTYPE] || DIEMDANHTYPE,
        khoi: student.khoi || initOptions?.MAKHOI,
        lop: student.lop || initOptions?.MALOPHOC,
    }));
    return finalDisplayData;
}
// 2. Hàm tính toán danh sách vắng (Async)
export const getDataAbsentees = async (urlRequire: UrlRequire): Promise<DiemDanhRecord[]> => {
    const { BASE_URL, initOptions, dateRange } = urlRequire;

    // --- GIAI ĐOẠN 1: Tải dữ liệu ---
    // A. Tải danh sách TẤT CẢ học viên của lớp
    // const allStudentsPath = formatUrlNavigationGetDataGradeByInfo(initOptions)

    // Gọi API
    const allStudents = await getDataGradeByInfoJson(urlRequire.initOptions.MAKHOI,urlRequire.initOptions.MALOPHOC);

    // --- GIAI ĐOẠN 2: TÍNH TOÁN ---
    // 1. Tìm loại Hiện diện tương ứng (Ví dụ: Vắng lễ -> Cần tìm danh sách Hiện diện lễ để trừ ra)
    // @ts-ignore
    const hiendienType = MAP_VANG_TO_HIENDIEN[initOptions.DIEMDANHTYPE];
    if (!hiendienType) throw new Error("Loại vắng không xác định trong MAP.");

    // 2. Tải bản ghi HIỆN DIỆN
    let hiendienQuery = `${BASE_URL}?MANIENHOC=${initOptions.MANIENHOC}&MAKHOI=${initOptions.MAKHOI}&MALOPHOC=${initOptions.MALOPHOC}`;
    hiendienQuery += `&filter=${hiendienType}`;
    hiendienQuery += `&from=${dateRange.fromDate}`; // Sửa: Dùng dateRange.fromDate

    if (dateRange.toDate) {
        hiendienQuery += `&to=${dateRange.toDate}`; // Sửa: Dùng dateRange.toDate
    }

    const recordedAttendance = await getDiemDanhData(hiendienQuery);

    // 3. Phép Trừ Logic (Sử dụng Set để tối ưu hiệu năng tìm kiếm O(1))
    const presentStudentIds = new Set(recordedAttendance.map((s: any) => s.ma_hoc_vien));

    // 4. Lọc: Lấy những người CÓ trong All nhưng KHÔNG CÓ trong Hiện diện
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawAbsentStudents = allStudents.filter((student: any) =>
        !presentStudentIds.has(student.ma_hoc_vien)
    );

    // 👇 BƯỚC QUAN TRỌNG: Map lại dữ liệu
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const absentStudents = rawAbsentStudents.map((student: any) => ({
        ...student,
        //@ts-ignore
        loai_diem_danh: MAP_VANG_TO_VIETNAMESE[initOptions.DIEMDANHTYPE], // Map sang tiếng Việt đẹp
        ngay_bat_dau: dateRange.fromDate,
        ngay_gio_diem_danh: new Date().toLocaleString('vi-VN'),
        nguoi_diem_danh: "Hệ thống Check",
        
        // Fix tham chiếu biến 'selected' thành 'initOptions'
        stt: student.stt || "",
        ten_thanh: student.ten_thanh || "",
        lop: student.lop || initOptions.MALOPHOC,
        khoi: student.khoi || initOptions.MAKHOI
    }));

    return absentStudents; // ✅ Quan trọng: Phải return dữ liệu
}

export const formatUrlNavigationGetDataGradeByInfo =  (initOptions: InitOptions) => {
    return `/admin/hocvien?MANIENHOC%3D${initOptions.MANIENHOC}%26MAKHOI%3D${initOptions.MAKHOI}%26MALOPHOC%3D${initOptions.MALOPHOC}`;
}
// 3. Hiển thị tất cả thông tin điểm danh, hiển diện, vắng theo thánh lễ và giáo lý cụ thể theo lớp
// phải check DIEMDANHTYPE Có phải bằng all_info_attendances trước khi gọi hàm
// hàm này sẽ thực hiện lấy riêng lẽ rồi tổng hợp lợi (4 api)
export const getInfoAttendancebyGrade = async (
    BASE_URL: string,
    initOptions: InitOptions,
    dateRange: DateRange,
    search: string = ''
): Promise<DiemDanhRecord[]> => {

    // 1. Chuẩn bị các Promise (Công việc) để chạy song song
    // ---------------------------------------------------------

    // A. Lấy danh sách TẤT CẢ học viên (Master List)
    // const urlAll = formatUrlNavigationGetDataGradeByInfo(initOptions);
    const taskAllStudents = getDataGradeByInfoJson(initOptions.MAKHOI, initOptions.MALOPHOC);

    // B. Lấy danh sách HIỆN DIỆN THÁNH LỄ
    const reqMass: UrlRequire = {
        BASE_URL,
        initOptions: { ...initOptions, DIEMDANHTYPE: 'hiendien_tle' },
        dateRange,
        search
    };
    const urlMass = formatUrlAttendance(reqMass);
    const taskMassPresence = getDiemDanhData(urlMass);

    // C. Lấy danh sách HIỆN DIỆN GIÁO LÝ
    const reqGL: UrlRequire = {
        BASE_URL,
        initOptions: { ...initOptions, DIEMDANHTYPE: 'hiendien_gly' },
        dateRange,
        search
    };
    const urlGL = formatUrlAttendance(reqGL);
    const taskGLPresence = getDiemDanhData(urlGL);


    // 2. Kích hoạt chạy song song (Chờ cả 3 xong mới chạy tiếp)
    // ---------------------------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const [allStudents, presentMass, presentGL] = await Promise.all([
        // Task 1: DS Học viên (Nếu lỗi thì trả về rỗng, coi như không có ai)
        taskAllStudents.catch(err => {
            console.error("❌ Lỗi lấy DS Tổng:", err);
            return []; 
        }),
        
        // Task 2: Hiện diện Lễ (Nếu lỗi thì trả về rỗng -> Coi như vắng hết)
        taskMassPresence.catch(err => {
            console.error("❌ Lỗi lấy Hiện diện Lễ:", err);
            return [];
        }),

        // Task 3: Hiện diện GL (Nếu lỗi thì trả về rỗng -> Coi như vắng hết)
        taskGLPresence.catch(err => {
            console.error("❌ Lỗi lấy Hiện diện GL:", err);
            return [];
        })
    ]);
    
    // // Kiểm tra nếu danh sách tổng bị lỗi (rỗng) thì dừng luôn đỡ tính toán sai
    // if (!allStudents || allStudents.length === 0) {
    //     console.warn("⚠️ Không lấy được danh sách học viên, trả về mảng rỗng.");
    //     return [];
    // }


    // 3. Xử lý dữ liệu (Mapping & Merging)
    // ---------------------------------------------------------

    // Tạo Set ID để tìm kiếm cho nhanh (Độ phức tạp O(1))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const massMap = new Map(presentMass.map((s: any) => [s.ma_hoc_vien, s]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const glMap = new Map(presentGL.map((s: any) => [s.ma_hoc_vien, s]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalListStudents: DiemDanhRecord[] = allStudents.map((student: any) => {
        // console.log(student)
        // Lấy bản ghi điểm danh (nếu có)
        const recordMass = massMap.get(student.ma_hoc_vien); // Trả về object hoặc undefined
        const recordGL = glMap.get(student.ma_hoc_vien);

        // Kiểm tra trạng thái
        const isPresentMass = !!recordMass; // Có dữ liệu -> true
        const isPresentGL = !!recordGL;

        // Tạo chuỗi trạng thái tổng hợp
        const statusParts = [];
        statusParts.push(isPresentMass ? "✅ Lễ" : "🔴 Vắng Lễ");
        statusParts.push(isPresentGL ? "✅ GL" : "🔴 Vắng GL");

        // --- XỬ LÝ LOGIC NGƯỜI ĐIỂM DANH & NGÀY GIỜ ---
        // Ưu tiên lấy thông tin từ Lễ -> Giáo Lý -> Mặc định
        let nguoiCheck = "Hệ thống Check";
        let ngayGioCheck = ''; // Mặc định lấy giờ hiện tại

        if (isPresentMass && isPresentGL) {
            // Nếu có mặt cả 2, gộp thông tin (hoặc chọn 1 cái tùy bạn)
            nguoiCheck = `${recordMass.nguoi_diem_danh} & ${recordGL.nguoi_diem_danh}`;
            // Lấy giờ của cái nào đến sớm hơn hoặc lấy cả 2
            ngayGioCheck = `${recordMass.ngay_gio_diem_danh} | ${recordGL.ngay_gio_diem_danh}`; 
        } 
        else if (isPresentMass) {
            nguoiCheck = recordMass.nguoi_diem_danh;
            ngayGioCheck = recordMass.ngay_gio_diem_danh;
        } 
        else if (isPresentGL) {
            nguoiCheck = recordGL.nguoi_diem_danh;
            ngayGioCheck = recordGL.ngay_gio_diem_danh;
        }
        // Nếu vắng cả 2 -> Giữ nguyên giá trị mặc định ("Hệ thống Check")

        return {
            ...student,
            // Ghi đè các trường thông tin tổng hợp
            loai_diem_danh: statusParts.join("  |  "), 

            // Các trường phụ trợ
            is_co_mat_le: isPresentMass,
            is_co_mat_gl: isPresentGL,

            // Meta data (Lấy từ biến đã xử lý ở trên)
            ngay_gio_diem_danh: ngayGioCheck,
            nguoi_diem_danh: nguoiCheck,
            
            lop: student.lop || initOptions.MALOPHOC,
            khoi: student.khoi || initOptions.MAKHOI
        };
    })
    .sort((a: any, b: any) => {
        // Code sort giữ nguyên như cũ
        const vangCountA = (a.is_co_mat_le ? 0 : 1) + (a.is_co_mat_gl ? 0 : 1);
        const vangCountB = (b.is_co_mat_le ? 0 : 1) + (b.is_co_mat_gl ? 0 : 1);
        if (vangCountB !== vangCountA) return vangCountB - vangCountA;
        if (a.is_co_mat_le !== b.is_co_mat_le) return (a.is_co_mat_le === false) ? -1 : 1;
        return 0;
    });

    return finalListStudents;
}