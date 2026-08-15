'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
    Calendar, Users, CheckCircle2, AlertCircle, Clock, 
    Download, Search, RefreshCw, Filter, ArrowLeft,
    Check, X, Sparkles, FileSpreadsheet, Eye, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DibuStudent, DibuSession, DibuSummaryResponse } from '@/lib/types/type';
import { getDibuSummary, getDibuCache } from '@/lib/api/scrape.api';
import AppLayout from '@/components/AppLayout';

// Danh sách các lớp học của Xứ Đoàn
const AVAILABLE_CLASSES = [
    { value: "45", label: "Thiếu Nhi 1 (Khối Thiếu Nhi)", khoi: "3", name: "Thiếu Nhi 1" },
    { value: "46", label: "Thiếu Nhi 2 (Khối Thiếu Nhi)", khoi: "3", name: "Thiếu Nhi 2" },
    { value: "47", label: "Thiếu Nhi 3 (Khối Thiếu Nhi)", khoi: "3", name: "Thiếu Nhi 3" },
    { value: "41", label: "Ấu Nhi 1A (Khối Ấu Nhi)", khoi: "2", name: "Ấu Nhi 1A" },
    { value: "42", label: "Ấu Nhi 1B (Khối Ấu Nhi)", khoi: "2", name: "Ấu Nhi 1B" },
    { value: "43", label: "Ấu Nhi 2 (Khối Ấu Nhi)", khoi: "2", name: "Ấu Nhi 2" },
    { value: "44", label: "Ấu Nhi 3 (Khối Ấu Nhi)", khoi: "2", name: "Ấu Nhi 3" },
    { value: "39", label: "Chiên Con 1 (Khối Chiên Con)", khoi: "1", name: "Chiên Con 1" },
    { value: "40", label: "Chiên Con 2 (Khối Chiên Con)", khoi: "1", name: "Chiên Con 2" },
    { value: "49", label: "Nghĩa Sĩ (Khối Nghĩa Sĩ)", khoi: "4", name: "Nghĩa Sĩ" },
    { value: "50", label: "Hiệp Sĩ (Khối Hiệp Sĩ)", khoi: "5", name: "Hiệp Sĩ" },
];

export default function DiBuPage() {
    // Form filter state
    const [fromDate, setFromDate] = useState('01/06/2026');
    const [toDate, setToDate] = useState('14/08/2026');
    const [selectedClass, setSelectedClass] = useState('45'); // 45 = Thieu Nhi 1
    
    // Data state
    const [summaryData, setSummaryData] = useState<DibuSummaryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingStep, setLoadingStep] = useState('');
    
    // Filter and search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'missing' | 'completed' | 'active' | 'inactive'>('all');
    
    // Modal state for student detail
    const [selectedStudent, setSelectedStudent] = useState<DibuStudent | null>(null);

    const currentClassObj = AVAILABLE_CLASSES.find(c => c.value === selectedClass) || AVAILABLE_CLASSES[0];

    // 1. Initial load from cache or default scrape
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setInitialLoading(true);
                const cache = await getDibuCache();
                if (cache && cache.metadata?.lop_id === selectedClass) {
                    setSummaryData(cache);
                } else if (cache && selectedClass === '45') {
                    setSummaryData(cache);
                } else {
                    const res = await getDibuSummary(fromDate, toDate, "4", currentClassObj.khoi, selectedClass, false);
                    setSummaryData(res);
                }
            } catch (err: any) {
                console.error("Lỗi khi load cache ban đầu:", err);
            } finally {
                setInitialLoading(false);
            }
        };
        loadInitialData();
    }, []);

    // 2. Handle manual scrape & collection trigger
    const handleScrape = async () => {
        try {
            setLoading(true);
            setError(null);
            
            setLoadingStep('1/3: Đang kết nối đến hệ thống điểm danh CCAMS...');
            await new Promise(r => setTimeout(r, 600));
            
            setLoadingStep(`2/3: Đang trích xuất dữ liệu điểm danh lớp ${currentClassObj.name} từ ${fromDate} đến ${toDate}...`);
            const result = await getDibuSummary(fromDate, toDate, "4", currentClassObj.khoi, selectedClass, true);
            
            setLoadingStep('3/3: Đang phân tích và tổng hợp số buổi tham gia...');
            await new Promise(r => setTimeout(r, 400));
            
            setSummaryData(result);
        } catch (err: any) {
            console.error("Lỗi khi cào dữ liệu đi bù:", err);
            setError(err.message || 'Không thể cào dữ liệu từ máy chủ CCAMS');
        } finally {
            setLoading(false);
            setLoadingStep('');
        }
    };

    // Filtered student list
    const filteredStudents = useMemo(() => {
        if (!summaryData?.students) return [];
        const q = (searchQuery || '').toLowerCase().trim();
        return summaryData.students.filter(student => {
            if (!student) return false;
            const fullName = student.full_name || student.ho_ten || `${student.ho || ''} ${student.ten || ''}`.trim();
            const matchesQuery = !q ||
                fullName.toLowerCase().includes(q) ||
                (student.ten_thanh || '').toLowerCase().includes(q) ||
                (student.ma_hoc_vien || '').toLowerCase().includes(q);
            
            if (!matchesQuery) return false;

            if (statusFilter === 'missing') return (student.so_buoi_con_thieu ?? 0) > 0;
            if (statusFilter === 'completed') return (student.so_buoi_con_thieu ?? 0) === 0;
            if (statusFilter === 'active') return student.so_buoi_da_di_bu > 0;
            if (statusFilter === 'inactive') return student.so_buoi_da_di_bu === 0;
            return true;
        });
    }, [summaryData, searchQuery, statusFilter]);

    const hasYearlyData = summaryData?.summary?.has_yearly_data ?? false;

    // Student sessions map for modal
    const studentSessions = useMemo(() => {
        if (!selectedStudent || !summaryData?.raw_attendance_records) return [];
        return summaryData.raw_attendance_records.filter(r => r.ma_hoc_vien === selectedStudent.ma_hoc_vien);
    }, [selectedStudent, summaryData]);

    return (
        <AppLayout>
            <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
                
                {/* Header Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                Lớp {currentClassObj.name}
                            </span>
                            <span className="text-xs text-slate-500">
                                {hasYearlyData ? "Năm học 2025 - 2026 • Đã có dữ liệu HK2" : "Năm học 2025 - 2026 • Thống kê số buổi theo kỳ"}
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                            {hasYearlyData ? "Tổng Hợp & Theo Dõi Đi Lễ Bù" : `Thống Kê Số Buổi Đi Lễ - ${currentClassObj.name}`}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            {hasYearlyData 
                                ? "Tự động cào dữ liệu từ hệ thống CCAMS và đối soát số buổi đi bù của học viên"
                                : "Tự động cào và đếm tổng số buổi đi lễ thực tế của từng học viên trong khoảng thời gian đã chọn"
                            }
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href={`/api/export?class=${selectedClass}`} target="_blank" download className="w-full sm:w-auto">
                            <Button variant="outline" className="w-full sm:w-auto gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 min-h-[40px] text-xs font-semibold">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                Tải File Excel
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Control Panel (Responsive grid) */}
                <Card className="shadow-xs border-slate-200">
                    <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3">
                        <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-800">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            Chọn Khoảng Thời Gian & Lớp Học
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Hệ thống sẽ tự động cào số buổi đi lễ thực tế từ CCAMS theo ngày đã chọn
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-5 pt-2 space-y-3 sm:space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Từ ngày:</label>
                                <input 
                                    type="text" 
                                    value={fromDate} 
                                    onChange={(e) => setFromDate(e.target.value)} 
                                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium min-h-[38px]" 
                                    placeholder="DD/MM/YYYY"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Đến ngày:</label>
                                <input 
                                    type="text" 
                                    value={toDate} 
                                    onChange={(e) => setToDate(e.target.value)} 
                                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium min-h-[38px]" 
                                    placeholder="DD/MM/YYYY"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Lớp học:</label>
                                <select 
                                    value={selectedClass} 
                                    onChange={(e) => setSelectedClass(e.target.value)} 
                                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium min-h-[38px]"
                                >
                                    {AVAILABLE_CLASSES.map(cls => (
                                        <option key={cls.value} value={cls.value}>{cls.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Button 
                                    onClick={handleScrape} 
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm gap-2 shadow-xs transition active:scale-95 min-h-[38px]"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                    {loading ? 'Đang Thu Thập...' : 'Cào Dữ Liệu Ngay'}
                                </Button>
                            </div>
                        </div>

                        {loadingStep && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center gap-2">
                                <Clock className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                                <span className="font-medium">{loadingStep}</span>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Summary Statistics Cards (Responsive: 2 cols on mobile, 4 cols on desktop) */}
                {summaryData?.summary && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <Card className="shadow-xs border-slate-200">
                            <CardHeader className="p-3.5 sm:p-4 pb-1">
                                <CardTitle className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Sĩ Số Lớp
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3.5 sm:p-4 pt-0">
                                <div className="text-xl sm:text-2xl font-extrabold text-slate-900">{summaryData.summary?.tong_hoc_vien ?? 0}</div>
                                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">học viên chính thức</p>
                            </CardContent>
                        </Card>

                        {hasYearlyData ? (
                            <>
                                <Card className="shadow-xs border-slate-200">
                                    <CardHeader className="p-3.5 sm:p-4 pb-1">
                                        <CardTitle className="text-[11px] sm:text-xs font-semibold text-amber-600 uppercase tracking-wider">
                                            Cần Bù HK2
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3.5 sm:p-4 pt-0">
                                        <div className="text-xl sm:text-2xl font-extrabold text-amber-700">{summaryData.summary?.tong_buoi_can_bu ?? 0}</div>
                                        <p className="text-[10px] sm:text-xs text-amber-600/80 mt-0.5">buổi cần hoàn thành</p>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-xs border-slate-200">
                                    <CardHeader className="p-3.5 sm:p-4 pb-1">
                                        <CardTitle className="text-[11px] sm:text-xs font-semibold text-blue-600 uppercase tracking-wider">
                                            Đã Đi Bù
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3.5 sm:p-4 pt-0">
                                        <div className="text-xl sm:text-2xl font-extrabold text-blue-700">{summaryData.summary?.tong_buoi_da_bu ?? 0}</div>
                                        <p className="text-[10px] sm:text-xs text-blue-600/80 mt-0.5">buổi thực tế đã đi</p>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-xs border-slate-200">
                                    <CardHeader className="p-3.5 sm:p-4 pb-1">
                                        <CardTitle className="text-[11px] sm:text-xs font-semibold text-rose-600 uppercase tracking-wider">
                                            Còn Thiếu
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3.5 sm:p-4 pt-0">
                                        <div className="text-xl sm:text-2xl font-extrabold text-rose-700">{summaryData.summary?.tong_buoi_con_thieu ?? 0}</div>
                                        <p className="text-[10px] sm:text-xs text-rose-600/80 mt-0.5">buổi chưa hoàn thành</p>
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            <>
                                <Card className="shadow-xs border-slate-200">
                                    <CardHeader className="p-3.5 sm:p-4 pb-1">
                                        <CardTitle className="text-[11px] sm:text-xs font-semibold text-blue-600 uppercase tracking-wider">
                                            Lượt Đi Lễ
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3.5 sm:p-4 pt-0">
                                        <div className="text-xl sm:text-2xl font-extrabold text-blue-700">{summaryData.summary?.tong_buoi_da_bu ?? 0}</div>
                                        <p className="text-[10px] sm:text-xs text-blue-600/80 mt-0.5">lượt tham gia</p>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-xs border-slate-200">
                                    <CardHeader className="p-3.5 sm:p-4 pb-1">
                                        <CardTitle className="text-[11px] sm:text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                                            Đã Tham Gia
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3.5 sm:p-4 pt-0">
                                        <div className="text-xl sm:text-2xl font-extrabold text-emerald-700">
                                            {(summaryData.students || []).filter(s => s.so_buoi_da_di_bu > 0).length}
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-emerald-600/80 mt-0.5">học viên có đi lễ</p>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-xs border-slate-200">
                                    <CardHeader className="p-3.5 sm:p-4 pb-1">
                                        <CardTitle className="text-[11px] sm:text-xs font-semibold text-amber-600 uppercase tracking-wider">
                                            Chưa Tham Gia
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3.5 sm:p-4 pt-0">
                                        <div className="text-xl sm:text-2xl font-extrabold text-amber-700">
                                            {(summaryData.students || []).filter(s => s.so_buoi_da_di_bu === 0).length}
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-amber-600/80 mt-0.5">học viên 0 buổi</p>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                )}

                {/* Filter and Search Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên thánh, họ và tên, mã học viên..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white min-h-[38px]"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        <Button
                            variant={statusFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('all')}
                            className="text-xs h-8 whitespace-nowrap"
                        >
                            Tất cả ({summaryData?.students?.length ?? 0})
                        </Button>

                        {hasYearlyData ? (
                            <>
                                <Button
                                    variant={statusFilter === 'missing' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter('missing')}
                                    className="text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50 whitespace-nowrap"
                                >
                                    Còn thiếu
                                </Button>
                                <Button
                                    variant={statusFilter === 'completed' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter('completed')}
                                    className="text-xs h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50 whitespace-nowrap"
                                >
                                    Đã đủ
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant={statusFilter === 'active' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter('active')}
                                    className="text-xs h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50 whitespace-nowrap"
                                >
                                    Có đi lễ
                                </Button>
                                <Button
                                    variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter('inactive')}
                                    className="text-xs h-8 text-amber-600 border-amber-200 hover:bg-amber-50 whitespace-nowrap"
                                >
                                    0 buổi
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Results Table */}
                <Card className="shadow-xs border-slate-200">
                    <CardHeader className="py-3 px-4 sm:px-5 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs sm:text-sm font-bold text-slate-800">
                            Danh Sách Học Viên ({filteredStudents.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {initialLoading ? (
                            <div className="p-8 text-center text-slate-400 text-xs sm:text-sm">
                                <Clock className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                                Đang tải dữ liệu ban đầu...
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs sm:text-sm">
                                Không tìm thấy học viên nào phù hợp
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table className="min-w-full text-xs">
                                    <TableHeader className="bg-slate-100/80">
                                        <TableRow>
                                            <TableHead className="w-10 text-center font-bold">STT</TableHead>
                                            <TableHead className="font-bold">Mã HV</TableHead>
                                            <TableHead className="font-bold">Tên Thánh & Họ Tên</TableHead>
                                            {hasYearlyData ? (
                                                <>
                                                    <TableHead className="text-center font-bold text-amber-700">Cần Bù HK2</TableHead>
                                                    <TableHead className="text-center font-bold text-blue-700">Đã Đi Bù</TableHead>
                                                    <TableHead className="text-center font-bold text-rose-700">Còn Thiếu</TableHead>
                                                </>
                                            ) : (
                                                <TableHead className="text-center font-bold text-blue-700">Tổng Buổi Đi</TableHead>
                                            )}
                                            <TableHead className="text-center font-bold">Trạng Thái</TableHead>
                                            <TableHead className="text-center font-bold w-16">Chi Tiết</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStudents.map((st, index) => {
                                            const isComplete = (st.so_buoi_con_thieu ?? 0) === 0;
                                            return (
                                                <TableRow key={st.ma_hoc_vien || index} className="hover:bg-slate-50 transition-colors">
                                                    <TableCell className="text-center font-medium text-slate-500">{index + 1}</TableCell>
                                                    <TableCell className="font-semibold text-slate-700">{st.ma_hoc_vien}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium text-blue-700 text-xs">{st.ten_thanh}</div>
                                                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                                            {st.full_name || st.ho_ten || `${st.ho || ''} ${st.ten || ''}`.trim()}
                                                        </div>
                                                    </TableCell>
                                                    
                                                    {hasYearlyData ? (
                                                        <>
                                                            <TableCell className="text-center font-bold text-amber-700">{st.so_buoi_can_bu ?? 0}</TableCell>
                                                            <TableCell className="text-center font-bold text-blue-700">{st.so_buoi_da_di_bu}</TableCell>
                                                            <TableCell className="text-center">
                                                                <span className={`font-extrabold ${isComplete ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                    {st.so_buoi_con_thieu ?? 0}
                                                                </span>
                                                            </TableCell>
                                                        </>
                                                    ) : (
                                                        <TableCell className="text-center font-extrabold text-blue-700 text-sm">
                                                            {st.so_buoi_da_di_bu}
                                                        </TableCell>
                                                    )}

                                                    <TableCell className="text-center">
                                                        {hasYearlyData ? (
                                                            <Badge className={isComplete ? 'bg-emerald-600 text-white' : 'bg-rose-100 text-rose-700 border-rose-200'}>
                                                                {isComplete ? 'Đã Đủ' : 'Còn Thiếu'}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant={st.so_buoi_da_di_bu > 0 ? 'default' : 'outline'} className={st.so_buoi_da_di_bu > 0 ? 'bg-blue-600 text-white' : 'text-slate-400'}>
                                                                {st.so_buoi_da_di_bu > 0 ? `${st.so_buoi_da_di_bu} buổi` : 'Chưa đi'}
                                                            </Badge>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setSelectedStudent(st)}
                                                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>

            {/* MODAL CHI TIẾT HỌC VIÊN (Mobile responsive bottom sheet / modal) */}
            {selectedStudent && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                                    {selectedStudent.ten_thanh} {selectedStudent.full_name || selectedStudent.ho_ten || `${selectedStudent.ho || ''} ${selectedStudent.ten || ''}`.trim()}
                                </h3>
                                <p className="text-xs text-slate-500">Mã: {selectedStudent.ma_hoc_vien} • Lớp: {currentClassObj.name}</p>
                            </div>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 text-xl font-bold flex items-center justify-center"
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                            {/* Summary row in modal */}
                            {hasYearlyData ? (
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                        <p className="text-[11px] text-slate-500">Cần bù HK2</p>
                                        <p className="text-sm font-extrabold text-amber-700 mt-0.5">{selectedStudent.so_buoi_can_bu ?? 0} buổi</p>
                                    </div>
                                    <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                                        <p className="text-[11px] text-blue-600">Đã đi bù</p>
                                        <p className="text-sm font-extrabold text-blue-700 mt-0.5">{selectedStudent.so_buoi_da_di_bu} buổi</p>
                                    </div>
                                    <div className={`p-2.5 rounded-xl border ${(selectedStudent.so_buoi_con_thieu ?? 0) > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                        <p className="text-[11px]">Còn thiếu</p>
                                        <p className="text-sm font-extrabold mt-0.5">{selectedStudent.so_buoi_con_thieu ?? 0} buổi</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 text-center">
                                    <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                                        <p className="text-[11px] text-blue-600">Tổng Buổi Đã Đi</p>
                                        <p className="text-base font-extrabold text-blue-700 mt-0.5">{selectedStudent.so_buoi_da_di_bu} buổi</p>
                                    </div>
                                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                        <p className="text-[11px] text-slate-500">Khoảng thời gian</p>
                                        <p className="text-xs font-bold text-slate-800 mt-1">{fromDate} - {toDate}</p>
                                    </div>
                                </div>
                            )}

                            {/* Sessions log list */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                                    Lịch sử các buổi đã tham dự ({studentSessions.length}):
                                </h4>
                                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                                    {studentSessions.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic py-4 text-center">
                                            Chưa ghi nhận buổi điểm danh nào trong khoảng thời gian này
                                        </p>
                                    ) : (
                                        studentSessions.map((session, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs border border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] flex items-center justify-center">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="font-bold text-slate-800">{session.ngay}</span>
                                                    <span className="text-slate-500">({session.thu})</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-mono text-blue-700 font-medium">{session.gio}</span>
                                                    <p className="text-[10px] text-slate-400">{session.nguoi_diem_danh}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3.5 bg-slate-50 border-t flex justify-end">
                            <Button onClick={() => setSelectedStudent(null)} variant="outline" size="sm" className="min-h-[38px] text-xs">
                                Đóng
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
