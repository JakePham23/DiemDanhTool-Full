import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"
import {OptionItem} from "@/lib/types/type";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export const getStatusAttendanceVariant = (status: string | undefined | null) => {
  // FIX: Nếu status là null, undefined, hoặc rỗng, trả về 'secondary' hoặc 'outline'
  if (!status || typeof status !== 'string') {
    return 'secondary';
  }

  if (status.includes('Hiện diện')) return 'default';
  if (status.includes('Vắng')) return 'destructive';
  return 'secondary';
}
// ----------------------------------------------------------------------
// --- 2. HÀM TẢI DỮ LIỆU BẢNG ---
export const MAP_VANG_TO_HIENDIEN: { [key: string]: string } = {
  'ds_vang_all': 'hiendien_all',
  'ds_vang_tle': 'hiendien_tle',
  'ds_vang_gl': 'hiendien_gly', // Giả định vắng giáo lý tương ứng với hiện diện giáo lý
};
export const MAP_VANG_TO_VIETNAMESE: { [key: string]: string } = {
  'ds_vang_all': 'Danh sách với tất cả',
  'ds_vang_tle': 'Danh sách vắng thánh lễ',
  'ds_vang_gl': 'Danh sách vắng giáo lý', // Giả định vắng giáo lý tương ứng với hiện diện giáo lý
};
export const DANH_SACH_VANG_OPTIONS: OptionItem[] = [
  {value: "ds_vang_all", label: "Hiển thị danh sách vắng"},
  {value: "ds_vang_tle", label: "Danh sách vắng thánh lễ"},
  {value: "ds_vang_gl", label: "Danh sách vắng giáo lý"},
];
export const MAP_HIENDIEN_TO_VIETNAMESE: { [key: string]: string } = {
  'hiendien_all': 'Hiện diện với tất cả',
  'hiendien_tle': 'Hiện diện thánh lễ',
  'hiendien_gly': 'Hiện diện giáo lý', // Giả định vắng giáo lý tương ứng với hiện diện giáo lý
};

export const CLASS_MAPPING = {
  "chien_con_1": {'MAKHOI': '1', 'MALOPHOC': '39'},
  "chien_con_2": {'MAKHOI': '1', 'MALOPHOC': '40'},
  "au_nhi_1a": {'MAKHOI': '2', 'MALOPHOC': '41'},
  "au_nhi_1b": {'MAKHOI': '2', 'MALOPHOC': '42'},
  "au_nhi_2": {'MAKHOI': '2', 'MALOPHOC': '43'},
  "au_nhi_3": {'MAKHOI': '2', 'MALOPHOC': '44'},
  "thieu_nhi_1": {'MAKHOI': '3', 'MALOPHOC': '45'},
  "thieu_nhi_2": {'MAKHOI': '3', 'MALOPHOC': '46'},
  "thieu_nhi_3": {'MAKHOI': '3', 'MALOPHOC': '47'},
  "nghia_si": {'MAKHOI': '4', 'MALOPHOC': '49'},
  "hiep_si": {'MAKHOI': '5', 'MALOPHOC': '50'},
  // Thêm các lớp còn lại...
};

export const AllInfoAttendances: OptionItem[] = [
  {value: "all_info_attendances", label: "Hiển thị thông tin đầy đủ theo từng lớp"},
];

export const DIEM_DANH_OPTIONS: OptionItem[] = [
  {value: 'ds_vang_all', label: 'Danh sách với tất cả'},
  {value: 'ds_vang_tle', label: 'Danh sách vắng thánh lễ'},
  {value: 'ds_vang_gl', label: 'Danh sách vắng giáo lý'},
  {value: 'hiendien_all', label: 'Hiện diện tất cả'},
  {value: 'hiendien_tle', label: 'Hiện diện thánh lễ'},
  {value: 'hiendien_gly', label: 'Hiện diện giáo lý'},
]
export const GRADE_LEVELS = [
    { value: 'chien_con', label: 'Chiên Con', code: 'CC' },
    { value: 'au_nhi', label: 'Ấu Nhi', code: 'AN' },
    { value: 'thieu_nhi', label: 'Thiếu Nhi', code: 'TN' },
    { value: 'nghia_si', label: 'Nghĩa Sĩ', code: 'NS' },
    { value: 'hiep_si', label: 'Hiệp Sĩ', code: 'HS' },
    { value: 'du_truong', label: 'Dự Trưởng', code: 'DT' },
    { value: 'huynh_truong', label: 'Huynh Trưởng', code: 'HT' },
];

export const CLASS_ID_TO_SLUG: Record<string, string> = {
    // --- KHỐI 1: CHIÊN CON ---
    "1_39": "chien_con_1",  // Mapping ID 39 -> File chien_con_1_data.json
    "1_40": "chien_con_2",

    // --- KHỐI 2: ẤU NHI ---
    "2_41": "au_nhi_1a",
    "2_42": "au_nhi_1b",
    "2_43": "au_nhi_2",
    "2_44": "au_nhi_3",

    // --- KHỐI 3: THIẾU NHI ---
    "3_45": "thieu_nhi_1",
    "3_46": "thieu_nhi_2",
    "3_47": "thieu_nhi_3",

    // --- KHỐI 4: NGHĨA SĨ ---
    "4_49": "nghia_si", // Ví dụ (Bạn check lại ID thực tế)
    
    // --- KHỐI 5: HIỆP SĨ ---
    "5_50": "hiep_si",

};
export const MAKHOI_TENKHOI: { [key: string]: string } = {
   '2':'Ấu Nhi', 
   '3':'Thiếu Nhi',  
   '4':'Nghĩa Sĩ',  
   '5':'Hiệp Sĩ', 
   '1':'Chiên Con',  
}