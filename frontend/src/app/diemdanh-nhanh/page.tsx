'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
  Zap, PlusCircle, CheckCircle2, Search, Users, 
  Calendar, Check, ShieldAlert, CheckSquare, Square, 
  Loader2, Sparkles, Church, BookOpen, ArrowRight, RotateCw, AlertCircle, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { executeQuickCheckin, getInitDiemDanhOptions } from '@/lib/api/scrape.api';
import { getDataGradeByInfoJson } from '@/lib/attendance-management/file-action';
import { formatDate } from '@/lib/utils/date';
import { InitDataResponse } from '@/lib/types/type';
import { CLASS_MAPPING } from '@/lib/utils/utils';
import AppLayout from '@/components/AppLayout';

const TODAY_STRING = formatDate(new Date());

const REVERSE_CLASS_MAP: { [malophoc: string]: string } = Object.values(CLASS_MAPPING).reduce((acc, curr) => {
    acc[curr.MALOPHOC] = curr.MAKHOI;
    return acc;
}, {} as { [malophoc: string]: string });

export default function QuickCheckinPage() {
  // Dropdown Options
  const [options, setOptions] = useState<InitDataResponse>({ nienhocs: [], khois: [], lophocs: [] });
  
  // Selection
  const [selectedKhoi, setSelectedKhoi] = useState<string>('3'); // Thiếu Nhi
  const [selectedLop, setSelectedLop] = useState<string>('45'); // Thiếu Nhi 1
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  // Checkin Config - Ưu tiên ngày hiện tại
  const [checkinType, setCheckinType] = useState<'hiendien_tle' | 'hiendien_gly'>('hiendien_tle');
  const [checkinDate, setCheckinDate] = useState<string>(TODAY_STRING);
  const [checkinMode, setCheckinMode] = useState<'exclude' | 'select'>('exclude'); // 'exclude' | 'select'

  // Data & Selection
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string; successCount?: number } | null>(null);

  // View Mode for Mobile: Show all by default
  const [viewAll, setViewAll] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // 1. Tải Options lớp và khối
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const res = await getInitDiemDanhOptions();
        setOptions(res);
      } catch (e) {
        console.error("Lỗi tải options:", e);
      }
    };
    loadOptions();
  }, []);

  // Filtered Lớp theo Khối
  const filteredLophocs = useMemo(() => {
    let list: { value: string; label: string }[] = [];
    if (selectedKhoi === 'all') {
      list = options.lophocs;
    } else {
      list = options.lophocs.filter(lop => {
        const makhoiCuaLop = REVERSE_CLASS_MAP[lop.value];
        return makhoiCuaLop === selectedKhoi;
      });
    }
    return [{ value: 'all', label: 'Tất cả các lớp' }, ...list];
  }, [options.lophocs, selectedKhoi]);

  const activeKhoiObj = useMemo(() => {
    return options.khois.find(k => k.value === selectedKhoi) || { label: "Thiếu Nhi" };
  }, [options.khois, selectedKhoi]);

  const activeClassObj = useMemo(() => {
    if (selectedLop === 'all') {
      return { label: `Tất cả các lớp (${activeKhoiObj.label})` };
    }
    return options.lophocs.find(l => l.value === selectedLop) || { label: "Thiếu Nhi 1" };
  }, [options.lophocs, selectedLop, activeKhoiObj]);

  // Handle change Lớp / Khối
  const handleLopChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLop = e.target.value;
    let newKhoi = selectedKhoi;
    if (newLop !== 'all') {
      const foundKhoi = REVERSE_CLASS_MAP[newLop];
      if (foundKhoi) newKhoi = foundKhoi;
    }
    setSelectedLop(newLop);
    setSelectedKhoi(newKhoi);
  };

  const handleKhoiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newKhoi = e.target.value;
    setSelectedKhoi(newKhoi);
    const firstLop = options.lophocs.find(l => REVERSE_CLASS_MAP[l.value] === newKhoi);
    if (firstLop) {
      setSelectedLop(firstLop.value);
    } else {
      setSelectedLop('all');
    }
  };

  // 2. Tải danh sách học viên theo lớp đã chọn
  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    setResultMessage(null);
    setSelectedIds(new Set());
    try {
      const data = await getDataGradeByInfoJson(selectedKhoi, selectedLop);
      setStudents(data || []);
      setCurrentPage(1);
    } catch (err) {
      console.error("Lỗi tải danh sách học viên:", err);
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedKhoi, selectedLop]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Toggle hiển thị học viên Chuyển xứ / Tạm nghỉ
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);

  // Danh sách học viên đang theo học (Bình thường)
  const activeStudents = useMemo(() => {
    if (includeInactive) return students;
    return students.filter(s => !s.tinh_trang || s.tinh_trang === 'Bình thường' || s.tinh_trang === 'binh_thuong');
  }, [students, includeInactive]);

  // Filtered students by keyword
  const filteredStudents = useMemo(() => {
    if (!Array.isArray(activeStudents)) return [];
    const kw = (searchKeyword || '').toLowerCase().trim();
    if (!kw) return activeStudents;
    return activeStudents.filter(s => {
      if (!s) return false;
      const name = `${s.ten_thanh || ''} ${s.ho || ''} ${s.ten || ''}`.toLowerCase();
      const code = String(s.ma_hoc_vien || '').toLowerCase();
      return name.includes(kw) || code.includes(kw);
    });
  }, [activeStudents, searchKeyword]);

  // Pagination or Full List calculation
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE) || 1;
  const displayedStudents = useMemo(() => {
    if (viewAll) return filteredStudents;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage, viewAll]);

  // Toggle selection
  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all / Deselect all
  const handleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allChecked = displayedStudents.every(s => next.has(String(s.ma_hoc_vien)));
      if (allChecked) {
        displayedStudents.forEach(s => next.delete(String(s.ma_hoc_vien)));
      } else {
        displayedStudents.forEach(s => next.add(String(s.ma_hoc_vien)));
      }
      return next;
    });
  };

  // Determine list of student IDs to actually mark present
  const targetPresentIds = useMemo(() => {
    if (checkinMode === 'select') {
      return Array.from(selectedIds);
    } else {
      return activeStudents
        .map(s => String(s.ma_hoc_vien))
        .filter(id => id && id !== 'N/A' && id !== 'ID_NOT_FOUND' && !selectedIds.has(id));
    }
  }, [activeStudents, selectedIds, checkinMode]);

  // Helper lấy tên lớp & khối chuẩn không bị lỗi fallback
  const getCleanClassName = (st: any) => {
    if (st.lop && !st.lop.includes('/')) return st.lop;
    if (st.tinh_trang && !st.tinh_trang.includes('/') && st.tinh_trang !== 'Bình thường') return st.tinh_trang;
    return activeClassObj.label;
  };

  const getCleanGradeName = (st: any) => {
    if (st.khoi && !st.khoi.includes('/') && st.khoi !== 'Thiếu Nhi') return st.khoi;
    return activeKhoiObj.label;
  };

  // Submit batch checkin
  const handleSubmitCheckin = async (singleStudentId?: string) => {
    const idsToSubmit = singleStudentId ? [singleStudentId] : targetPresentIds;

    if (idsToSubmit.length === 0) {
      setResultMessage({
        type: 'error',
        text: 'Không có học viên nào được chọn để điểm danh.'
      });
      return;
    }

    setIsSubmitting(true);
    setResultMessage(null);

    const lopObj = options.lophocs.find(l => l.value === selectedLop);
    const khoiObj = options.khois.find(k => k.value === selectedKhoi);

    try {
      const payload = {
        student_ids: idsToSubmit,
        date_str: checkinDate,
        checkin_type: checkinType,
        students_info: students,
        lop_name: lopObj ? lopObj.label : activeClassObj.label,
        khoi_name: khoiObj ? khoiObj.label : activeKhoiObj.label,
        excluded_count: checkinMode === 'exclude' ? selectedIds.size : 0
      };

      const res = await executeQuickCheckin(payload);

      if (res && res.status === 'success') {
        const typeText = checkinType === 'hiendien_tle' ? 'Thánh Lễ' : 'Giáo Lý';
        const count = res.data?.success_count || idsToSubmit.length;
        setResultMessage({
          type: 'success',
          text: `Điểm danh ${typeText} thành công cho ${count} học viên ngày ${checkinDate}! Thông báo đã gửi đến Zalo Bot.`,
          successCount: count
        });
      } else if (res && (res.status === 'queued_retry' || res.data?.queued_retry)) {
        setResultMessage({
          type: 'warning',
          text: res.message || res.data?.message || '⚠️ Máy chủ CCAMS đang bị nghẽn. Dữ liệu đã được lưu tạm an toàn! Hệ thống sẽ tự động gửi lại trong vòng 2 phút nữa, vui lòng chờ thông báo Zalo.'
        });
      } else {
        throw new Error(res?.detail || "Điểm danh không thành công");
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: `Lỗi khi thực hiện điểm danh: ${err.message || 'Không thể kết nối máy chủ CCAMS'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Điểm Danh Nhanh
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Điểm danh hàng loạt theo lớp & tự động gửi Zalo Bot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/diemdanh" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 min-h-[40px] text-xs font-semibold">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Xem Lịch Sử Điểm Danh</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Configuration Card */}
        <Card className="shadow-xs border-slate-200">
          <CardHeader className="p-3.5 sm:p-5 pb-2 sm:pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Cấu Hình Điểm Danh
            </CardTitle>
          </CardHeader>

          <CardContent className="p-3.5 sm:p-5 space-y-3.5">
            
            {/* Hàng 1: Loại Điểm Danh, Ngày, Chế Độ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-slate-100/70 rounded-xl border border-slate-200">
              
              {/* Loại Điểm Danh */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Loại Điểm Danh</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCheckinType('hiendien_tle')}
                    className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold transition border min-h-[38px]
                      ${checkinType === 'hiendien_tle' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                  >
                    <Church className="w-3.5 h-3.5" />
                    <span>Thánh Lễ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckinType('hiendien_gly')}
                    className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold transition border min-h-[38px]
                      ${checkinType === 'hiendien_gly' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Giáo Lý</span>
                  </button>
                </div>
              </div>

              {/* Ngày Điểm Danh (Mặc định ngày hiện tại) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ngày Điểm Danh (Hôm nay: {TODAY_STRING})</span>
                </label>
                <input
                  type="text"
                  value={checkinDate}
                  onChange={(e) => setCheckinDate(e.target.value)}
                  placeholder={TODAY_STRING}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 bg-white min-h-[38px]"
                />
              </div>

              {/* Chế Độ Điểm Danh */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Chế Độ</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setCheckinMode('exclude'); setSelectedIds(new Set()); }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition border text-center min-h-[38px]
                      ${checkinMode === 'exclude' 
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                  >
                    Trừ Em Vắng
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCheckinMode('select'); setSelectedIds(new Set()); }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition border text-center min-h-[38px]
                      ${checkinMode === 'select' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                  >
                    Chọn Có Mặt
                  </button>
                </div>
              </div>
            </div>

            {/* Hàng 2: Chọn Khối, Lớp & Tìm Kiếm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
              <div className="lg:col-span-3">
                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Khối / Ngành</label>
                <select
                  className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs font-medium bg-white min-h-[38px]"
                  value={selectedKhoi}
                  onChange={handleKhoiChange}
                >
                  {options.khois.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Lớp / Chi Đoàn</label>
                <select
                  className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs font-medium bg-white min-h-[38px]"
                  value={selectedLop}
                  onChange={handleLopChange}
                >
                  {filteredLophocs.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-6">
                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Tìm Kiếm Học Viên</label>
                <div className="flex">
                  <input
                    type="text"
                    placeholder="Nhập tên hoặc mã học viên..."
                    className="border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg w-full text-xs min-h-[38px]"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                  />
                  <div className="bg-blue-600 text-white px-3.5 py-2 rounded-r-lg flex items-center justify-center min-h-[38px]">
                    <Search className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Banner Giải Thích & Thống Kê */}
            <div className="p-3 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {checkinMode === 'exclude' ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Ngoại trừ:</strong> Tick vào học sinh <strong>VẮNG</strong> để loại trừ khỏi danh sách điểm danh.
                    </span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      <strong>Chọn trực tiếp:</strong> Tick chọn học sinh <strong>CÓ MẶT</strong>.
                    </span>
                  </>
                )}
              </div>

              <div className="font-bold text-xs shrink-0 flex items-center gap-2">
                <span>Sẽ điểm danh: <strong className="text-emerald-700 text-sm font-extrabold">{targetPresentIds.length}</strong>/{activeStudents.length} em</span>
                {checkinMode === 'exclude' && selectedIds.size > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
                    Trừ {selectedIds.size} vắng
                  </Badge>
                )}
              </div>
            </div>

            {/* Banner Kết Quả */}
            {resultMessage && (
              <div className={`p-3.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 border shadow-xs
                ${resultMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border-rose-200'}`}
              >
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <div className="flex-1">{resultMessage.text}</div>
                {resultMessage.type === 'success' && (
                  <Link href="/diemdanh">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7">
                      Xem Danh Sách
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bảng Danh Sách Học Viên */}
        <Card className="shadow-xs border-slate-200">
          <CardHeader className="p-3.5 sm:p-5 border-b bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-slate-800">
                Danh Sách Học Viên ({filteredStudents.length})
              </CardTitle>
              <CardDescription className="text-xs">
                {checkinMode === 'exclude' ? 'Chạm vào học viên để đánh dấu VẮNG' : 'Chạm vào học viên để CHỌN CÓ MẶT'}
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Hiện học sinh chuyển xứ / tạm nghỉ</span>
              </label>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs h-8"
              >
                {checkinMode === 'exclude' ? 'Đảo chọn tất cả' : 'Chọn tất cả'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            
            {/* 1. MOBILE RESPONSIVE LIST VIEW (< md): Hiển thị Full Họ Tên, Lớp & Tình Trạng Điểm Danh */}
            <div className="md:hidden divide-y divide-slate-100">
              {loadingStudents ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  Đang tải danh sách học viên...
                </div>
              ) : displayedStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Không tìm thấy học viên nào phù hợp
                </div>
              ) : (
                displayedStudents.map((st, idx) => {
                  const id = String(st.ma_hoc_vien);
                  const isChecked = selectedIds.has(id);
                  const isMarkedToPresent = checkinMode === 'select' ? isChecked : !isChecked;
                  const classNameClean = getCleanClassName(st);

                  return (
                    <div
                      key={st.ma_hoc_vien || idx}
                      onClick={() => toggleStudent(id)}
                      className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer active:bg-slate-100
                        ${checkinMode === 'exclude' && isChecked ? 'bg-amber-50/80 border-l-4 border-amber-500' : ''}
                        ${checkinMode === 'select' && isChecked ? 'bg-indigo-50/80 border-l-4 border-indigo-500' : ''}`}
                    >
                      {/* Cột 1: Checkbox */}
                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudent(id)}
                          className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                        <span className="text-[11px] font-semibold text-slate-400 w-4 text-center">
                          {idx + 1}
                        </span>
                      </div>

                      {/* Cột 2: Full Họ & Tên Học Viên */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-900 leading-tight">
                          <span className="text-blue-700 font-semibold mr-1">{st.ten_thanh}</span>
                          <span>{st.ho} {st.ten}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                          <span>Mã: {st.ma_hoc_vien}</span>
                        </div>
                      </div>

                      {/* Cột 3: Tên Lớp */}
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {classNameClean}
                        </span>
                      </div>

                      {/* Cột 4: Trạng Thái Điểm Danh (Mobile không cần nút lệnh) */}
                      <div className="shrink-0 text-right min-w-[70px]">
                        {isMarkedToPresent ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5">
                            Điểm danh
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200 font-medium px-2 py-0.5">
                            {checkinMode === 'exclude' ? 'Vắng' : 'Chưa chọn'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. DESKTOP FULL TABLE (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <Table className="min-w-full text-xs">
                <TableHeader className="bg-slate-100/80">
                  <TableRow>
                    <th className="p-3 text-center w-12 font-bold text-slate-700">
                      {checkinMode === 'select' ? 'Chọn' : 'Trừ vắng'}
                    </th>
                    <TableHead className="w-12 text-center font-bold">STT</TableHead>
                    <TableHead className="font-bold">Mã HV</TableHead>
                    <TableHead className="font-bold">Tên Thánh</TableHead>
                    <TableHead className="font-bold">Họ và Tên</TableHead>
                    <TableHead className="font-bold">Lớp</TableHead>
                    <TableHead className="font-bold">Khối</TableHead>
                    <TableHead className="text-center font-bold">Trạng Thái Điểm Danh</TableHead>
                    <TableHead className="text-center font-bold w-24">Nút lệnh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStudents ? (
                    <TableRow>
                      <TableCell colSpan={9} className="p-10 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                        Đang tải danh sách học viên...
                      </TableCell>
                    </TableRow>
                  ) : displayedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="p-10 text-center text-slate-400">
                        Không tìm thấy học viên nào phù hợp
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedStudents.map((st, idx) => {
                      const id = String(st.ma_hoc_vien);
                      const isChecked = selectedIds.has(id);
                      const isMarkedToPresent = checkinMode === 'select' ? isChecked : !isChecked;
                      const classNameClean = getCleanClassName(st);
                      const gradeNameClean = getCleanGradeName(st);

                      return (
                        <TableRow 
                          key={st.ma_hoc_vien || idx}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer
                            ${checkinMode === 'exclude' && isChecked ? 'bg-amber-50/70' : ''}
                            ${checkinMode === 'select' && isChecked ? 'bg-indigo-50/70' : ''}`}
                          onClick={() => toggleStudent(id)}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleStudent(id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                            />
                          </td>
                          <TableCell className="text-center font-medium text-slate-400">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-700">{st.ma_hoc_vien}</TableCell>
                          <TableCell className="font-medium text-slate-800">{st.ten_thanh}</TableCell>
                          <TableCell className="font-bold text-slate-900">{st.ho} {st.ten}</TableCell>
                          <TableCell className="text-slate-700 font-medium">{classNameClean}</TableCell>
                          <TableCell className="text-slate-600 font-medium">{gradeNameClean}</TableCell>
                          <TableCell className="text-center">
                            {isMarkedToPresent ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                                Đã chọn ĐD
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                                {checkinMode === 'exclude' ? 'Vắng (Trừ ra)' : 'Chưa chọn'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleSubmitCheckin(id)}
                              disabled={isSubmitting}
                              className="flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-xs font-semibold shadow-2xs transition active:scale-95 mx-auto"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Điểm danh</span>
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Toggle xem tất cả hoặc phân trang */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/40">
              <div>
                Tổng: <strong>{filteredStudents.length}</strong> học viên
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewAll(!viewAll)}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  {viewAll ? "Thu gọn phân trang" : "Hiển thị tất cả học viên"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-14 md:bottom-0 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 z-20">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Sẽ gửi điểm danh cho <strong>{targetPresentIds.length}</strong> học viên & thông báo Zalo Bot.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmitCheckin()}
              disabled={isSubmitting || targetPresentIds.length === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 min-h-[42px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang Gửi...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Xác Nhận Điểm Danh ({targetPresentIds.length} Em)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
