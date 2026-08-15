'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, PlusCircle, CheckCircle2, Search, Users, 
  Calendar, Check, ShieldAlert, CheckSquare, Square, Loader2, Sparkles, Church, BookOpen
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { executeQuickCheckin } from '@/lib/api/scrape.api';
import { getDataGradeByInfoJson } from '@/lib/attendance-management/file-action';
import { formatDate } from '@/lib/utils/date';

const TODAY_STRING = formatDate(new Date());

interface QuickCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMakhoi?: string;
  initialMalophoc?: string;
  initialDate?: string;
  options: {
    khois: { value: string; label: string }[];
    lophocs: { value: string; label: string }[];
  };
}

export default function QuickCheckinModal({
  isOpen,
  onClose,
  onSuccess,
  initialMakhoi = '3',
  initialMalophoc = '45',
  initialDate,
  options,
}: QuickCheckinModalProps) {
  // Filters
  const [selectedKhoi, setSelectedKhoi] = useState<string>(initialMakhoi);
  const [selectedLop, setSelectedLop] = useState<string>(initialMalophoc);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  // Checkin Config
  const [checkinType, setCheckinType] = useState<'hiendien_tle' | 'hiendien_gly'>('hiendien_tle');
  const [checkinDate, setCheckinDate] = useState<string>(initialDate || TODAY_STRING);
  const [checkinMode, setCheckinMode] = useState<'exclude' | 'select'>('exclude');

  // Data & Selection
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Sync initial props
  useEffect(() => {
    if (initialMakhoi && initialMakhoi !== 'all') setSelectedKhoi(initialMakhoi);
    if (initialMalophoc && initialMalophoc !== 'all') setSelectedLop(initialMalophoc);
  }, [initialMakhoi, initialMalophoc, isOpen]);

  // Load students of selected class
  useEffect(() => {
    if (!isOpen) return;

    const fetchStudents = async () => {
      setLoadingStudents(true);
      setResultMessage(null);
      setSelectedIds(new Set());
      try {
        const makhoiToFetch = selectedKhoi === 'all' ? '3' : selectedKhoi;
        const malophocToFetch = selectedLop === 'all' ? '45' : selectedLop;

        const data = await getDataGradeByInfoJson(makhoiToFetch, malophocToFetch);
        setStudents(data || []);
        setCurrentPage(1);
      } catch (err) {
        console.error("Lỗi tải danh sách học viên:", err);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [isOpen, selectedKhoi, selectedLop]);

  // Filtered students by keyword
  const filteredStudents = useMemo(() => {
    if (!searchKeyword.trim()) return students;
    const kw = searchKeyword.toLowerCase().trim();
    return students.filter(s => {
      const name = `${s.ten_thanh || ''} ${s.ho || ''} ${s.ten || ''}`.toLowerCase();
      const code = (s.ma_hoc_vien || '').toLowerCase();
      return name.includes(kw) || code.includes(kw);
    });
  }, [students, searchKeyword]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);

  // Toggle selection of a student
  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Determine list of student IDs to actually mark present
  const targetPresentIds = useMemo(() => {
    if (checkinMode === 'select') {
      return Array.from(selectedIds);
    } else {
      return students
        .map(s => String(s.ma_hoc_vien))
        .filter(id => id && id !== 'N/A' && id !== 'ID_NOT_FOUND' && !selectedIds.has(id));
    }
  }, [students, selectedIds, checkinMode]);

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
        lop_name: lopObj ? lopObj.label : "Thiếu Nhi 1",
        khoi_name: khoiObj ? khoiObj.label : "Thiếu Nhi",
        excluded_count: checkinMode === 'exclude' ? selectedIds.size : 0
      };

      const res = await executeQuickCheckin(payload);

      if (res && res.status === 'success') {
        const typeText = checkinType === 'hiendien_tle' ? 'Thánh Lễ' : 'Giáo Lý';
        setResultMessage({
          type: 'success',
          text: `✅ Điểm danh ${typeText} thành công cho ${res.data?.success_count || idsToSubmit.length} học viên! Đã gửi Zalo.`
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        throw new Error(res?.detail || "Điểm danh không thành công");
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: `❌ Lỗi điểm danh: ${err.message || 'Không thể kết nối máy chủ'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 flex flex-col max-h-[94vh] sm:max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 uppercase tracking-wide leading-tight">
                Chọn Học Viên Điểm Danh Nhanh
              </h2>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Điểm danh hàng loạt hoặc ngoại trừ học viên vắng & thông báo Zalo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-3.5">

          {/* 1. Thanh cấu hình: Loại, Ngày, Chế độ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-slate-100/80 rounded-xl border border-slate-200 text-xs">
            {/* Loại Điểm Danh */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Loại Điểm Danh</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCheckinType('hiendien_tle')}
                  className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg font-bold transition border min-h-[38px]
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
                  className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg font-bold transition border min-h-[38px]
                    ${checkinType === 'hiendien_gly' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Giáo Lý</span>
                </button>
              </div>
            </div>

            {/* Ngày Điểm Danh */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Ngày Điểm Danh</span>
              </label>
              <input
                type="text"
                value={checkinDate}
                onChange={(e) => setCheckinDate(e.target.value)}
                placeholder="15/08/2025"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 bg-white min-h-[38px]"
              />
            </div>

            {/* Chế Độ Điểm Danh */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Chế Độ</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => { setCheckinMode('exclude'); setSelectedIds(new Set()); }}
                  className={`py-2 px-2 rounded-lg font-bold transition border text-center min-h-[38px]
                    ${checkinMode === 'exclude' 
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                >
                  Trừ Em Vắng
                </button>
                <button
                  type="button"
                  onClick={() => { setCheckinMode('select'); setSelectedIds(new Set()); }}
                  className={`py-2 px-2 rounded-lg font-bold transition border text-center min-h-[38px]
                    ${checkinMode === 'select' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                >
                  Chọn Có Mặt
                </button>
              </div>
            </div>
          </div>

          {/* 2. Dropdown Filter Khối / Lớp & Tìm Kiếm */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">Khối / Ngành</label>
              <select
                className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs font-medium bg-white min-h-[38px]"
                value={selectedKhoi}
                onChange={(e) => setSelectedKhoi(e.target.value)}
              >
                <option value="all">Tất cả</option>
                {options.khois.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">Lớp / Chi Đoàn</label>
              <select
                className="border border-slate-300 px-3 py-2 rounded-lg w-full text-xs font-medium bg-white min-h-[38px]"
                value={selectedLop}
                onChange={(e) => setSelectedLop(e.target.value)}
              >
                <option value="all">Tất cả</option>
                {options.lophocs.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-6">
              <label className="block text-xs font-bold text-slate-700 mb-1">Tìm Kiếm</label>
              <div className="flex">
                <input
                  type="text"
                  placeholder="Nhập tên hoặc mã học viên..."
                  className="border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg w-full text-xs min-h-[38px]"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
                <div className="bg-blue-600 text-white px-3 py-2 rounded-r-lg flex items-center justify-center min-h-[38px]">
                  <Search className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Banner Hướng Dẫn Chế Độ */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              {checkinMode === 'exclude' ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Ngoại trừ:</strong> Tick vào học viên <strong>VẮNG</strong> để trừ ra.
                  </span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    <strong>Chọn trực tiếp:</strong> Tick chọn học viên <strong>CÓ MẶT</strong>.
                  </span>
                </>
              )}
            </div>

            <div className="font-bold text-xs shrink-0">
              Sẽ điểm danh: <span className="text-emerald-700 font-extrabold">{targetPresentIds.length}</span>/{students.length} em
              {checkinMode === 'exclude' && selectedIds.size > 0 && (
                <span className="text-amber-700 ml-1">(Trừ {selectedIds.size} vắng)</span>
              )}
            </div>
          </div>

          {/* Thông Báo Kết Quả */}
          {resultMessage && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border
              ${resultMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'}`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resultMessage.text}</span>
            </div>
          )}

          {/* 3. BẢNG DANH SÁCH HỌC VIÊN */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[360px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="p-2.5 text-center w-12">
                      {checkinMode === 'select' ? 'Chọn' : 'Trừ vắng'}
                    </th>
                    <th className="p-2.5 font-bold">Họ và Tên Học Viên</th>
                    <th className="p-2.5 font-bold text-right sm:text-left">Lớp</th>
                    <th className="p-2.5 text-center font-bold">Trạng Thái</th>
                    <th className="hidden sm:table-cell p-2.5 text-center font-bold w-24">Nút lệnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                        Đang tải danh sách học viên...
                      </td>
                    </tr>
                  ) : paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        Không tìm thấy học viên nào phù hợp
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((st, idx) => {
                      const id = String(st.ma_hoc_vien);
                      const isChecked = selectedIds.has(id);
                      const isMarkedToPresent = checkinMode === 'select' ? isChecked : !isChecked;
                      const lopNameClean = (!st.lop || st.lop.includes('/')) 
                        ? (options.lophocs.find(l => l.value === selectedLop)?.label || "Thiếu Nhi 1")
                        : st.lop;

                      return (
                        <tr 
                          key={st.ma_hoc_vien || st.stt || idx}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer
                            ${checkinMode === 'exclude' && isChecked ? 'bg-amber-50/70 font-semibold' : ''}
                            ${checkinMode === 'select' && isChecked ? 'bg-indigo-50/70 font-semibold' : ''}`}
                          onClick={() => toggleStudent(id)}
                        >
                          <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleStudent(id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900 leading-tight">
                              <span className="text-blue-700 font-semibold mr-1">{st.ten_thanh}</span>
                              <span>{st.ho} {st.ten}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Mã: {st.ma_hoc_vien}
                            </div>
                          </td>
                          <td className="p-2.5 text-right sm:text-left">
                            <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {lopNameClean}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {isMarkedToPresent ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5">
                                Điểm danh
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200 font-medium px-2 py-0.5">
                                {checkinMode === 'exclude' ? 'Vắng' : 'Chưa chọn'}
                              </Badge>
                            )}
                          </td>
                          <td className="hidden sm:table-cell p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleSubmitCheckin(id)}
                              disabled={isSubmitting}
                              className="flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-[11px] font-semibold shadow-2xs transition active:scale-95 mx-auto"
                            >
                              <PlusCircle className="w-3 h-3" />
                              <span>Điểm danh</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phân Trang */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <div>
              Trang {currentPage}/{totalPages} ({filteredStudents.length} em)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 font-medium text-xs"
              >
                &lt; Trước
              </button>
              <span className="px-2 font-bold text-slate-800 text-xs">{currentPage}</span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 font-medium text-xs"
              >
                Tiếp &gt;
              </button>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            Tự động gửi thông báo đến Zalo Bot
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold text-xs hover:bg-slate-100 transition min-h-[40px]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => handleSubmitCheckin()}
              disabled={isSubmitting || targetPresentIds.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 min-h-[40px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang Gửi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Xác Nhận ({targetPresentIds.length} Em)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
