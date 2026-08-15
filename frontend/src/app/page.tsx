'use client'

import React, { useEffect, useState, useCallback } from "react"
import { getDataGxThienPhu, triggerUpdateData, getUpdateDataStatus } from "@/lib/api/scrape.api"
import Link from 'next/link'

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { 
  Users, User, UserCircle, RefreshCw, CheckCircle2, AlertCircle, Loader2, BookOpen, GraduationCap
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card' 
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import AppLayout from "@/components/AppLayout"

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

export default function Home() {
  const [getDataTNThienPhu, setDataTNThienPhu] = useState<TNThienPhu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Trạng thái Update Data ngầm
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<{
    current_class: string
    completed_count: number
    total_classes: number
    last_updated?: string
  } | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      let data: any = await getDataGxThienPhu()

      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch (e) {
          console.error("Lỗi parse JSON:", e)
          throw new Error("Dữ liệu nhận được không phải là JSON hợp lệ.")
        }
      }
      
      if (Array.isArray(data)) {
          setDataTNThienPhu(data as TNThienPhu[])
          setError(null)
      } else {
          throw new Error("Dữ liệu cuối cùng không phải là định dạng mảng hợp lệ.")
      }
      
    } catch (err) {
      setError('Không thể tải hoặc xử lý dữ liệu từ máy chủ. Vui lòng kiểm tra console.')
      console.error("Lỗi khi tải dữ liệu:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Polling kiểm tra tiến độ cập nhật ngầm nếu đang chạy
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isUpdating) {
      interval = setInterval(async () => {
        try {
          const status = await getUpdateDataStatus()
          if (status) {
            setUpdateProgress({
              current_class: status.current_class,
              completed_count: status.completed_count,
              total_classes: status.total_classes,
              last_updated: status.last_updated
            })

            if (!status.is_running && status.completed_count > 0) {
              setIsUpdating(false)
              setSuccessMsg(`Đã cập nhật thành công ${status.completed_count} lớp học! Dữ liệu đã gửi về Zalo.`)
              loadData()
              setTimeout(() => setSuccessMsg(null), 8000)
            }
          }
        } catch (e) {
          console.error("Lỗi kiểm tra tiến độ:", e)
        }
      }, 2500)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isUpdating, loadData])

  // Xử lý bấm nút Cập nhật
  const handleTriggerUpdate = async () => {
    try {
      setSuccessMsg(null)
      setIsUpdating(true)
      const res = await triggerUpdateData()
      console.log("Trigger update:", res)
    } catch (err: any) {
      console.error("Lỗi trigger update:", err)
      setError("Không thể khởi động tiến trình cập nhật dữ liệu.")
      setIsUpdating(false)
    }
  }

  const dataToReduce = Array.isArray(getDataTNThienPhu) ? getDataTNThienPhu : [];

  const totalStats = dataToReduce.reduce( 
    (acc, item) => ({
      nam: acc.nam + parseInt(item.nam || '0'),
      nu: acc.nu + parseInt(item.nu || '0'),
      tong: acc.tong + parseInt(item.tong || '0'),
    }),
    { nam: 0, nu: 0, tong: 0 }
  )

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 md:p-8 space-y-5 max-w-7xl mx-auto">
        
        {/* Header & Nút Cập Nhật Dữ Liệu */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
              Danh Sách Lớp Giáo Lý
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Tổng quan các lớp & học viên niên khóa 2025-2026
            </p>
          </div>

          <button
            onClick={handleTriggerUpdate}
            disabled={isUpdating}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-xs transition active:scale-95 min-h-[42px]
              ${isUpdating 
                ? 'bg-amber-500 text-white cursor-not-allowed opacity-90 animate-pulse' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang Cập Nhật Ngầm...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Cập Nhật Dữ Liệu Mới</span>
              </>
            )}
          </button>
        </div>

        {/* Banner Thông Báo Tiến Độ */}
        {isUpdating && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
            <Loader2 className="w-5 h-5 text-amber-600 animate-spin mt-0.5 shrink-0" />
            <div className="flex-1 text-xs sm:text-sm">
              <div className="font-bold flex flex-wrap items-center gap-2">
                <span>Đang cào dữ liệu danh sách học viên...</span>
                {updateProgress && updateProgress.total_classes > 0 && (
                  <Badge className="bg-amber-600 text-white text-[11px]">
                    {updateProgress.completed_count}/{updateProgress.total_classes} Lớp
                  </Badge>
                )}
              </div>
              <p className="text-amber-700 mt-1 text-xs">
                Đang xử lý: <span className="font-semibold">{updateProgress?.current_class || 'Khởi động...'}</span>. Tiến trình chạy ngầm và gửi thông báo Zalo theo từng lớp.
              </p>
            </div>
          </div>
        )}

        {/* Banner Thành Công */}
        {successMsg && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs sm:text-sm font-medium">{successMsg}</div>
          </div>
        )}

        {error && (
          <Card className="border-rose-300 border bg-rose-50/50">
            <CardHeader className="p-4">
              <CardTitle className="text-rose-800 flex items-center gap-2 text-sm font-bold">
                <AlertCircle className="w-4 h-4" /> Lỗi Tải Dữ Liệu
              </CardTitle>
              <CardDescription className="text-xs text-rose-700">{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Cards Thống kê (Responsive: 1 col on mobile, 3 col on tablet+) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">Tổng Học Viên</CardTitle>
              <Users className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalStats.tong}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Toàn bộ 12 lớp trong xứ đoàn</p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">Học Viên Nam</CardTitle>
              <User className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">
                {totalStats.nam}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Chiếm {totalStats.tong > 0 ? ((totalStats.nam / totalStats.tong) * 100).toFixed(1) : 0}% tổng số
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">Học Viên Nữ</CardTitle>
              <UserCircle className="h-4 w-4 text-pink-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-pink-600">
                {totalStats.nu}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Chiếm {totalStats.tong > 0 ? ((totalStats.nu / totalStats.tong) * 100).toFixed(1) : 0}% tổng số
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Danh Sách Lớp (Desktop Table + Mobile Cards) */}
        <Card className="shadow-xs border-slate-200">
          <CardHeader className="p-4 sm:p-5 border-b bg-slate-50/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-slate-800">Chi Tiết Các Lớp</CardTitle>
              <CardDescription className="text-xs">
                Danh sách {getDataTNThienPhu.length} lớp học và giáo lý viên phụ trách
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-white text-xs hidden sm:inline-flex">Niên khóa 2025-2026</Badge>
          </CardHeader>
          
          <CardContent className="p-0">
            
            {/* MOBILE CARD VIEW (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading && getDataTNThienPhu.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">Đang tải danh sách lớp...</div>
              ) : (
                getDataTNThienPhu.map((item) => (
                  <div key={item.stt} className="p-3.5 space-y-2.5 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center">
                          {item.stt}
                        </span>
                        <Link
                          href={'/hocvien/' + item.url_chi_tiet.replace('?', '%26').replace(/=/g, '%3D')}
                          className="font-bold text-blue-600 hover:underline text-sm"
                        >
                          {item.ten_lop}
                        </Link>
                      </div>
                      <Badge className="bg-slate-900 text-white font-bold text-xs">
                        {item.tong} em
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Sĩ số:</span>
                      <span className="text-blue-700 font-semibold">{item.nam} Nam</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-pink-700 font-semibold">{item.nu} Nữ</span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-500">Chủ nhiệm:</span> <strong>{item.chu_nhiem || "Chưa có"}</strong>
                      </div>
                      {(item.glv1 || item.glv2) && (
                        <div>
                          <span className="text-slate-500">GLV:</span> {[item.glv1, item.glv2].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* DESKTOP TABLE (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-100/70">
                  <TableRow>
                    <TableHead className="w-12 text-center font-bold">STT</TableHead>
                    <TableHead className="font-bold">Tên Lớp</TableHead>
                    <TableHead className="text-center font-bold">Nam</TableHead>
                    <TableHead className="text-center font-bold">Nữ</TableHead>
                    <TableHead className="text-center font-bold">Tổng</TableHead>
                    <TableHead className="font-bold">Chủ Nhiệm</TableHead>
                    <TableHead className="font-bold">GLV 1</TableHead>
                    <TableHead className="font-bold">GLV 2</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getDataTNThienPhu.map((item) => (
                    <TableRow key={item.stt} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-medium text-center">{item.stt}</TableCell>
                      <TableCell>
                        <Link
                          href={'/hocvien/'+item.url_chi_tiet.replace('?', '%26').replace(/=/g, '%3D')}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                        >
                          {item.ten_lop}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{item.nam}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">{item.nu}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-slate-900 text-white font-bold">{item.tong}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-700">{item.chu_nhiem || (<span className="text-muted-foreground italic">Chưa có</span>)}</TableCell>
                      <TableCell className="text-slate-700">{item.glv1 || (<span className="text-muted-foreground italic">Chưa có</span>)}</TableCell>
                      <TableCell className="text-slate-700">{item.glv2 || (<span className="text-muted-foreground italic">Chưa có</span>)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}