'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
    AlertCircle, Search, Users, Calendar, PlusCircle, RotateCw, Printer, 
    CheckCircle2, Clock, ShieldAlert, Check, Sparkles
} from 'lucide-react';
import { getInitDiemDanhOptions } from '@/lib/api/scrape.api'; 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; 
import { sendZaloNotification } from '@/lib/send-notification/zaloHelper';
import { formatUrlAttendance, getDataAbsentees, getDataAttendances, getInfoAttendancebyGrade } from '@/lib/attendance-management/index';
import { InitDataResponse, DiemDanhRecord, InitOptions, OptionItem, DateRange, UrlRequire } from '@/lib/types/type';
import { formatDate, getDefaultFromDate } from '@/lib/utils/date';
import {
    getStatusAttendanceVariant,
    DANH_SACH_VANG_OPTIONS, CLASS_MAPPING, AllInfoAttendances,
} from '@/lib/utils/utils';
import QuickCheckinModal from '@/components/QuickCheckinModal';
import AppLayout from '@/components/AppLayout';

const TODAY_STRING = formatDate(new Date()); 
const DEFAULT_FROM_DATE = getDefaultFromDate(TODAY_STRING); 

const getDiemDanhType = (typeString: string) => {
    if (!typeString) return 'N/A';
    return typeString.trim() || 'N/A'; 
};

const REVERSE_CLASS_MAP: { [malophoc: string]: string } = Object.values(CLASS_MAPPING).reduce((acc, curr) => {
    acc[curr.MALOPHOC] = curr.MAKHOI;
    return acc;
}, {} as { [malophoc: string]: string });

export default function DiemDanhPage() {
    const BASE_DIEMDANH_URL = '/admin/diem-danh'; 
    
    // State cho các tùy chọn Dropdown
    const [options, setOptions] = useState<InitDataResponse>({ nienhocs: [], khois: [], lophocs: [] });
    
    const [selected, setSelected] = useState<InitOptions>({
        MANIENHOC: '', 
        MAKHOI: 'all',
        MALOPHOC: 'all',
        DIEMDANHTYPE: 'hiendien_tle'
    });
    
    const [dateRange, setDateRange] = useState<DateRange>({
        fromDate: DEFAULT_FROM_DATE,
        toDate: formatDate(new Date())
    });

    const [searchKeyword, setSearchKeyword] = useState<string>(''); 
    const [data, setData] = useState<DiemDanhRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Active Top Tab
    const [activeTab, setActiveTab] = useState<'thongtin' | 'lichsu' | 'chuagui'>('thongtin');

    // Quick Checkin Modal State
    const [isQuickCheckinOpen, setIsQuickCheckinOpen] = useState(false);

    // Pagination for main table
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 25;

    // Helper: Nhóm các Options từ API
    const renderAttendanceOptions = useCallback((apiTypes: OptionItem[]) => {
        if (!Array.isArray(apiTypes)) return null; 

        const hienDienGroup = apiTypes.filter(opt => opt.value?.startsWith('hiendien_'));
        const vangCoPhepGroup = apiTypes.filter(opt => opt.value?.startsWith('vang_'));

        const groups = [
            { label: "Báo cáo tổng hợp", items: AllInfoAttendances }, 
            { label: "Danh sách vắng", items: DANH_SACH_VANG_OPTIONS }, 
            { label: "Hiện diện chi tiết", items: hienDienGroup },
            { label: "Vắng có phép", items: vangCoPhepGroup },
        ].filter(group => group.items && group.items.length > 0);

        return groups.map(group => (
            <optgroup key={group.label} label={group.label}>
                {group.items.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </optgroup>
        ));
    }, []);

    // 1. Tải các tùy chọn ban đầu
    useEffect(() => {
        const loadInitOptions = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await getInitDiemDanhOptions(); 
                setOptions(result);

                const defaultNienHocValue = result.nienhocs.length > 0 ? result.nienhocs[0].value : '4';
                const defaultDiemDanhValue = 'hiendien_tle';
                
                setSelected(prev => ({
                    ...prev,
                    MANIENHOC: defaultNienHocValue,
                    DIEMDANHTYPE: defaultDiemDanhValue,
                    MAKHOI: '3',
                    MALOPHOC: '45',
                }));
            } catch (err: any) {
                setError(err.message || 'Lỗi khi tải các tùy chọn ban đầu.');
            } finally {
                setLoading(false);
            }
        };

        loadInitOptions();
    }, []);

    // 2. Hàm Tải Dữ Liệu Điểm Danh
    const loadDiemDanhData = useCallback(async () => {
        const { MANIENHOC, MAKHOI, MALOPHOC, DIEMDANHTYPE } = selected; 
        const { fromDate, toDate } = dateRange;
        const search = searchKeyword.trim();

        const urlRequire: UrlRequire = {
            BASE_URL: BASE_DIEMDANH_URL,
            initOptions: {
                MANIENHOC,
                MAKHOI,
                MALOPHOC,
                DIEMDANHTYPE,
            },
            dateRange: {
                fromDate,
                toDate,
            },
            search,
        };

        if (!MANIENHOC || !DIEMDANHTYPE || !fromDate) {
            setError("Vui lòng chọn Niên học, Loại điểm danh và Từ Ngày.");
            return;
        }

        setLoading(true);
        setError(null);
        let finalDisplayData: DiemDanhRecord[] = [];

        try {
            if (DIEMDANHTYPE === 'all_info_attendances') {
                try {
                    finalDisplayData = await getInfoAttendancebyGrade(
                        BASE_DIEMDANH_URL,
                        { MANIENHOC, MAKHOI, MALOPHOC, DIEMDANHTYPE: '' },
                        { fromDate, toDate },
                        searchKeyword
                    );
                    setData(finalDisplayData);
                    setCurrentPage(1);
                    
                    if (finalDisplayData.length > 0) {
                        sendZaloNotification(finalDisplayData, DIEMDANHTYPE, { MAKHOI, MALOPHOC, date: fromDate }).catch((err: any) => console.log(err));
                    }
                } catch (err) {
                    console.error(err);
                    setError("Lỗi khi lấy báo cáo tổng hợp.");
                } finally {
                    setLoading(false);
                }
                return;
            }

            const isVangListRequest = DANH_SACH_VANG_OPTIONS.some(opt => opt.value === DIEMDANHTYPE);
            
            if (!isVangListRequest) {
                const urlQuery = formatUrlAttendance(urlRequire);
                finalDisplayData = await getDataAttendances(urlQuery, fromDate, DIEMDANHTYPE, { MAKHOI, MALOPHOC });
            } else {
                finalDisplayData = await getDataAbsentees(urlRequire);
            }

            setData(finalDisplayData);
            setCurrentPage(1);
            
            if (finalDisplayData.length > 0) {
                sendZaloNotification(finalDisplayData, DIEMDANHTYPE, { MAKHOI, MALOPHOC, date: fromDate }).catch((err: any) => console.log(err));
            }

        } catch (err: any) {
            setError(err.message || 'Lỗi khi tải dữ liệu điểm danh.');
        } finally {
            setLoading(false);
        }
    }, [selected, dateRange, searchKeyword, BASE_DIEMDANH_URL]);

    // Tự động load dữ liệu
    useEffect(() => {
        if (selected.MANIENHOC && selected.DIEMDANHTYPE && dateRange.fromDate) {
            loadDiemDanhData();
        }
    }, [selected.MANIENHOC, selected.MAKHOI, selected.MALOPHOC, selected.DIEMDANHTYPE]);

    // Filter lớp theo khối
    const filteredLophocs = useMemo(() => {
        if (selected.MAKHOI === 'all') return options.lophocs;
        return options.lophocs.filter(lop => {
            const makhoiCuaLop = REVERSE_CLASS_MAP[lop.value];
            return makhoiCuaLop === selected.MAKHOI;
        });
    }, [options.lophocs, selected.MAKHOI]);

    // Handle change
    const handleLopChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMalophoc = e.target.value;
        let newMakhoi = selected.MAKHOI;
        
        if (newMalophoc !== 'all') {
            const foundMakhoi = REVERSE_CLASS_MAP[newMalophoc];
            if (foundMakhoi) newMakhoi = foundMakhoi;
        }
        
        setSelected(prev => ({
            ...prev,
            MALOPHOC: newMalophoc,
            MAKHOI: newMakhoi
        }));
    };

    const handleKhoiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMakhoi = e.target.value;
        setSelected(prev => ({
            ...prev,
            MAKHOI: newMakhoi,
            MALOPHOC: 'all'
        }));
    };

    // Pagination
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE) || 1;
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    }, [data, currentPage]);

    return (
        <AppLayout>
            <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 max-w-7xl mx-auto">
                
                {/* Top Bar (Mobile-friendly header & action buttons) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                            <Check className="w-5 h-5 stroke-[3]" />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            Điểm Danh Học Viên
                        </h1>
                    </div>

                    {/* Top Right Action Buttons */}
                    <div className="flex items-center gap-2">
                        {/* Nút Điểm Danh Nhanh */}
                        <Link href="/diemdanh-nhanh" className="flex-1 sm:flex-initial">
                            <button
                                title="Chuyển sang trang Điểm danh nhanh"
                                className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3.5 rounded-xl shadow-xs transition active:scale-95 text-xs font-bold min-h-[40px]"
                            >
                                <PlusCircle className="w-4 h-4" />
                                <span>Điểm Danh Nhanh</span>
                            </button>
                        </Link>

                        {/* Nút Làm mới */}
                        <button
                            onClick={loadDiemDanhData}
                            disabled={loading}
                            title="Làm mới dữ liệu"
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl flex items-center justify-center shadow-xs transition active:scale-95 disabled:opacity-50 min-h-[40px] min-w-[40px]"
                        >
                            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        {/* Nút In */}
                        <button
                            onClick={() => window.print()}
                            title="In danh sách"
                            className="bg-slate-700 hover:bg-slate-800 text-white p-2.5 rounded-xl flex items-center justify-center shadow-xs transition active:scale-95 min-h-[40px] min-w-[40px]"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Sub Navigation Tabs (Horizontally scrollable on mobile) */}
                <div className="flex items-center gap-4 sm:gap-6 border-b border-slate-200 text-xs sm:text-sm font-medium overflow-x-auto no-scrollbar whitespace-nowrap pb-0.5">
                    <button
                        onClick={() => setActiveTab('thongtin')}
                        className={`pb-2.5 flex items-center gap-1.5 transition border-b-2 shrink-0
                            ${activeTab === 'thongtin' 
                                ? 'border-blue-600 text-blue-600 font-bold' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Thông tin điểm danh</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('lichsu')}
                        className={`pb-2.5 flex items-center gap-1.5 transition border-b-2 shrink-0
                            ${activeTab === 'lichsu' 
                                ? 'border-blue-600 text-blue-600 font-bold' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Clock className="w-4 h-4" />
                        <span>Lịch sử điểm danh từ D2</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('chuagui')}
                        className={`pb-2.5 flex items-center gap-1.5 transition border-b-2 shrink-0
                            ${activeTab === 'chuagui' 
                                ? 'border-blue-600 text-blue-600 font-bold' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <ShieldAlert className="w-4 h-4" />
                        <span>Tài khoản D2 chưa gửi</span>
                    </button>
                </div>

                {/* BỘ LỌC DỮ LIỆU */}
                <Card className="shadow-xs border-slate-200">
                    <CardHeader className="py-3 px-4 sm:px-5 border-b bg-slate-50/50">
                        <CardTitle className="text-xs sm:text-sm font-bold text-slate-700">Bộ lọc Dữ liệu</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 sm:p-5 space-y-3 sm:space-y-4">
                        
                        {/* Hàng 1: Niên học, Khối, Lớp, Tìm kiếm */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-end">
                            <div className="lg:col-span-2">
                                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Niên học</label>
                                <select 
                                    className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs font-medium bg-white min-h-[38px]"
                                    value={selected.MANIENHOC}
                                    onChange={(e) => setSelected(prev => ({ ...prev, MANIENHOC: e.target.value, MAKHOI: 'all', MALOPHOC: 'all' }))}
                                    disabled={loading}
                                >
                                    {options.nienhocs.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="lg:col-span-2">
                                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Khối / Ngành</label>
                                <select 
                                    className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs font-medium bg-white min-h-[38px]"
                                    value={selected.MAKHOI}
                                    onChange={handleKhoiChange}
                                    disabled={loading}
                                >
                                    <option value="all">Tất cả</option>
                                    {options.khois.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="lg:col-span-2">
                                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Lớp / Chi Đoàn</label>
                                <select 
                                    className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs font-medium bg-white min-h-[38px]"
                                    value={selected.MALOPHOC}
                                    onChange={handleLopChange}
                                    disabled={loading}
                                >
                                    <option value="all">Tất cả</option>
                                    {filteredLophocs.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="sm:col-span-2 lg:col-span-6">
                                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Tìm Kiếm</label>
                                <div className="flex">
                                    <input 
                                        type="text" 
                                        className="border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg w-full text-xs min-h-[38px]" 
                                        placeholder="Nhập từ khóa..."
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && loadDiemDanhData()}
                                        disabled={loading}
                                    />
                                    <button 
                                        onClick={loadDiemDanhData} 
                                        disabled={loading} 
                                        className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 rounded-r-lg flex items-center justify-center transition min-h-[38px]"
                                    >
                                        <Search className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* Hàng 2: Loại Điểm Danh & Ngày */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-end">
                            <div className="sm:col-span-2 lg:col-span-4">
                                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
                                    Loại Điểm Danh
                                </label>
                                <select 
                                    className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs font-medium bg-white min-h-[38px]"
                                    value={selected.DIEMDANHTYPE}
                                    onChange={(e) => setSelected(prev => ({ ...prev, DIEMDANHTYPE: e.target.value }))}
                                    disabled={loading}
                                >
                                    {renderAttendanceOptions(options.diemdanhtypes || [])}
                                </select>
                            </div>

                            <div className="lg:col-span-3">
                                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Từ Ngày</span>
                                </label>
                                <input 
                                    type="text" 
                                    className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs bg-white min-h-[38px]"
                                    value={dateRange.fromDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                                    disabled={loading}
                                    placeholder="DD/MM/YYYY"
                                />
                            </div>

                            <div className="lg:col-span-3">
                                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Đến Ngày</span>
                                </label>
                                <input 
                                    type="text" 
                                    className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs bg-white min-h-[38px]"
                                    value={dateRange.toDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                                    disabled={loading}
                                    placeholder="DD/MM/YYYY"
                                />
                            </div>

                            <div className="sm:col-span-2 lg:col-span-2">
                                <button
                                    onClick={loadDiemDanhData}
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition min-h-[38px]"
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Tra Cứu</span>
                                </button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* TRẠNG THÁI LOADING / NGHẼN MẠNG */}
                {loading && (
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs sm:text-sm flex items-center gap-3 font-semibold animate-pulse shadow-xs">
                        <RotateCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                        <div>
                            <div>Đang cào dữ liệu từ máy chủ CCAMS...</div>
                            <div className="text-[11px] font-normal text-blue-700 mt-0.5">
                                Quá trình có thể mất vài giây nếu máy chủ đang có nhiều người cùng truy cập.
                            </div>
                        </div>
                    </div>
                )}

                {/* THÔNG BÁO LỖI */}
                {error && !loading && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between gap-3 font-medium shadow-xs">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                            <div>
                                <div className="font-bold">Không thể tải dữ liệu điểm danh</div>
                                <div className="text-xs text-rose-700 mt-0.5">{error}</div>
                            </div>
                        </div>
                        <button
                            onClick={loadDiemDanhData}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shrink-0 transition active:scale-95"
                        >
                            Thử Lại
                        </button>
                    </div>
                )}

                {/* KẾT QUẢ TÌM KIẾM */}
                <Card className="shadow-xs border-slate-200">
                    <CardHeader className="py-3 px-4 sm:px-5 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span>Kết Quả ({data.length} bản ghi)</span>
                        </CardTitle>

                        <Link href="/diemdanh-nhanh">
                            <button
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>+ Điểm danh nhanh</span>
                            </button>
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-12 text-center text-slate-500 text-xs sm:text-sm">
                                <RotateCw className="w-7 h-7 text-blue-600 animate-spin mx-auto mb-2" />
                                <div className="font-bold text-slate-700">Đang lấy dữ liệu từ hệ thống CCAMS...</div>
                                <div className="text-xs text-slate-400 mt-1">Vui lòng đợi giây lát trong khi hệ thống đồng bộ</div>
                            </div>
                        ) : data.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-xs sm:text-sm">
                                Không có dữ liệu điểm danh nào trong khoảng thời gian này.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table className="min-w-full text-xs">
                                    <TableHeader className="bg-slate-100/80">
                                        <TableRow>
                                            <TableHead className="w-10 text-center font-bold">STT</TableHead>
                                            <TableHead className="font-bold">Mã Học Viên</TableHead>
                                            <TableHead className="font-bold">Tên Thánh</TableHead>
                                            <TableHead className="font-bold">Họ và Tên</TableHead>
                                            <TableHead className="font-bold">Lớp</TableHead>
                                            <TableHead className="font-bold">Loại Điểm Danh</TableHead>
                                            <TableHead className="text-center font-bold">Ngày ĐD</TableHead>
                                            <TableHead className="text-right font-bold pr-4">Giờ ĐD</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedData.map((record, index) => {
                                            const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                                            return (
                                                <TableRow key={index} className="hover:bg-slate-50 transition-colors">
                                                    <TableCell className="font-medium text-center">{record.stt || globalIndex}</TableCell>
                                                    <TableCell className="font-semibold text-slate-700">{record.ma_hoc_vien}</TableCell>
                                                    <TableCell className="font-medium text-slate-800">{record.ten_thanh}</TableCell>
                                                    <TableCell>
                                                        <span className="text-slate-600 mr-1">{record.ho}</span>
                                                        <span className="font-bold text-slate-900">{record.ten}</span>
                                                    </TableCell>
                                                    <TableCell className="text-slate-600">{record.lop}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusAttendanceVariant(record.loai_diem_danh)}>
                                                            {getDiemDanhType(record.loai_diem_danh)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center whitespace-nowrap text-slate-600">
                                                        {record.ngay_bat_dau || record.ngay_diem_danh || dateRange.fromDate}
                                                    </TableCell>
                                                    <TableCell className="text-right whitespace-nowrap text-slate-600 font-mono pr-4">
                                                        {record.ngay_gio_diem_danh || "-"}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Phân Trang */}
                        {data.length > 0 && (
                            <div className="flex items-center justify-between p-3 sm:p-4 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/40">
                                <div>
                                    Trang {currentPage} / {totalPages} ({data.length} bản ghi)
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-2.5 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 font-medium"
                                    >
                                        &lt; Trước
                                    </button>
                                    <span className="px-2 py-1 bg-blue-600 text-white rounded-md font-bold text-xs">{currentPage}</span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-2.5 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 font-medium"
                                    >
                                        Tiếp &gt;
                                    </button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>

            {/* MODAL ĐIỂM DANH NHANH */}
            <QuickCheckinModal
                isOpen={isQuickCheckinOpen}
                onClose={() => setIsQuickCheckinOpen(false)}
                onSuccess={() => {
                    loadDiemDanhData();
                }}
                initialMakhoi={selected.MAKHOI}
                initialMalophoc={selected.MALOPHOC}
                initialDate="15/08/2025"
                options={{
                    khois: options.khois,
                    lophocs: filteredLophocs
                }}
            />
        </AppLayout>
    );
}