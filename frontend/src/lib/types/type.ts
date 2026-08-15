export interface InitOptions {
    MANIENHOC: string;
    MAKHOI: string;
    MALOPHOC: string;
    DIEMDANHTYPE?: string
}

// Giao diện cho dữ liệu Điểm danh (giả định giống Student, có thể cần điều chỉnh)
export interface DiemDanhRecord {
    stt: string;
    ma_hoc_vien: string;
    ten_thanh: string;
    ho: string;
    ten: string;
    lop: string;
    khoi: string;
    nguoi_diem_danh: string;
    loai_diem_danh: string; // Đây là giá trị gộp, cần hiển thị riêng
    ngay_diem_danh: string; // (Thứ 5)
    ngay_gio_diem_danh: string; // (16/10/2025 19:15:03)
}

// Giao diện cho dữ liệu tùy chọn từ API /init
export interface OptionItem {
    value: string; // MANIENHOC, MAKHOI, MALOPHOC
    label: string; // TENNIENHOC, TENKHOI, TENLOPHOC
}
export interface DateRange {
    fromDate: string;
    toDate: string;
}
export interface Student {
  stt: string
  ma_hoc_vien: string
  ten_thanh: string
  ho: string
  ten: string
  ngay_sinh: string
  lop: string
  tinh_trang: string
  nien_hoc: string
}
export interface InitDataResponse {
    nienhocs: OptionItem[];
    khois: OptionItem[];
    lophocs: OptionItem[];
    diemdanhtypes?: OptionItem[]
}

export interface DiemDanhPageProps {
    diemdanhBaseUrl: string; // URL cơ sở để gọi API init (ví dụ: '/admin/diemdanh')
}

export interface UrlRequire{
    BASE_URL: string;
    initOptions: InitOptions;
    dateRange: DateRange;
    search: string;
}

export interface DibuStudent {
    stt: number | string;
    ma_hoc_vien: string;
    ten_thanh: string;
    ho: string;
    ten: string;
    full_name: string;
    lop: string;
    chuyen_can_70?: number | null;
    so_buoi_can_bu?: number | null;
    so_buoi_da_di_bu: number;
    so_buoi_con_thieu?: number | null;
    trang_thai: string;
    danh_gia: string;
    ghi_chu_goc?: string;
    tb_canam?: number | string;
    xep_loai_ht?: string;
    xep_loai_hk?: string;
}

export interface DibuSession {
    stt: number;
    ma_hoc_vien: string;
    ten_thanh: string;
    ho: string;
    ten: string;
    full_name: string;
    lop: string;
    khoi: string;
    ngay: string;
    thu: string;
    gio: string;
    ngay_gio: string;
    nguoi_diem_danh: string;
}

export interface DibuMetadata {
    lop: string;
    lop_id?: string;
    from_date: string;
    to_date: string;
    has_yearly_data?: boolean;
    total_students: number;
    total_active_students?: number;
    max_sessions_by_one?: number;
    total_need_makeup: number;
    total_completed: number;
    total_missing: number;
    total_sessions_recorded: number;
    updated_at: string;
}

export interface DibuSummaryResponse {
    metadata: DibuMetadata;
    students: DibuStudent[];
    raw_sessions: DibuSession[];
}