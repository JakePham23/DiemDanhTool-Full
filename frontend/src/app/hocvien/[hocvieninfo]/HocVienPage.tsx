'use client'; // BẮT BUỘC để sử dụng hooks (useState, useEffect)

import React, { useState, useEffect } from 'react';
import { getDataGradeByInfo } from '@/lib/api/scrape.api' // Cần import hàm API
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar, Users, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert" // Cần import Alert/AlertDescription

// --- INTERFACES ---
interface Student {
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

interface ScrapeConfig {
    url_navigation: string;
    username: string;
    password: string;
}

interface HocVienPageProps {
    urlNavigation: string; // URL query đã chuẩn hóa nhận từ Server Component
}

// Giả định thông tin đăng nhập
const FIXED_USERNAME = 'tnthienphu';
const FIXED_PASSWORD = '123456789';

// --- HÀM TÍNH TOÁN/FORMAT ---

const getInitials = (ho: string, ten: string) => {
    // Sửa lỗi tiềm năng nếu ho hoặc ten là chuỗi rỗng
    const hoChar = ho.split(' ').pop()?.charAt(0) || '';
    return `${ten.charAt(0)}${hoChar}`
}

const formatBirthday = (dateStr: string) => {
    if (!dateStr) return 'Chưa có'
    // Thêm logic format ngày tháng nếu cần
    return dateStr
}

const getStatusVariant = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'bình thường': return 'default'
      case 'nghỉ học': return 'destructive'
      case 'chuyển lớp': return 'secondary'
      default: return 'outline'
    }
}

// Sửa kiểu dữ liệu: đảm bảo data luôn là Student[]
const calculateStats = (data: Student[] | any) => {
    // 1. Bảo vệ: Đảm bảo data là một mảng. Nếu không, dùng mảng rỗng [] thay thế.
    const studentList = Array.isArray(data) ? data : [];
    
    return {
        total: studentList.length,
        male: studentList.filter(s => 
          ['Giuse', 'Phêrô', 'Phaolô', 'Antôn', 'Tômasô', 'Đaminh', 'Gioan Baotixita'].includes(s.ten_thanh)
        ).length,
        female: studentList.filter(s => 
          ['Maria', 'Têrêsa', 'Anna'].includes(s.ten_thanh)
        ).length,
        missingBirthday: studentList.filter(s => !s.ngay_sinh).length,
    }
};


// --- COMPONENT CHÍNH (CLIENT) ---

export default function HocVienPage({ urlNavigation }: HocVienPageProps){
    // 💡 ĐÃ SỬA LỖI: Khởi tạo state data bằng mảng rỗng [] thay vì null.
    const [data, setData] = useState<Student[]>([]); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // BƯỚC 1: Dùng useEffect để tải dữ liệu phía Client
useEffect(() => {
        // --- 1. HÀM FETCH DATA ---
        const fetchData = async () => {
            // Khởi tạo trạng thái
            setLoading(true);
            setError(null);
            
            try {

                const url_navigation= urlNavigation
                
                // Gọi API với config object đầy đủ
                // Giả định getDataGradeByInfo trả về Student[] hoặc ném lỗi
                const result = await getDataGradeByInfo(url_navigation) as Student[]; 
                setData(result);
            } catch (err: any) {
                // Xử lý lỗi (Đảm bảo lỗi được cô lập thành chuỗi)
                setError(err.message || 'Lỗi không xác định khi tải dữ liệu.');
            } finally {
                setLoading(false);
            }
        };

        if (urlNavigation) {
            fetchData();
        }
    }, [urlNavigation]); // 💡 ĐÃ SỬA LỖI: Thêm urlNavigation vào dependency array 
                         // nếu component có thể cần re-fetch khi prop này thay đổi.


    // BƯỚC 2: Xử lý trạng thái tải (Loading/Error/Empty)
    if (loading) {
        return <div className="container mx-auto p-6 text-center">Đang tải dữ liệu học viên...</div>;
    }

    if (error) {
        return (
            <div className="container mx-auto p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        {error}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    // 💡 ĐÃ SỬA LỖI: Chỉ kiểm tra length vì data luôn là mảng
    if (data.length === 0) {
        return (
            <div className="container mx-auto p-6">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Không có học viên trong lớp này hoặc dữ liệu API rỗng.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    // BƯỚC 3: Tính toán stats và Render
    const stats = calculateStats(data);
    const className = data[0]?.lop || 'Không xác định';
    const schoolYear = data[0]?.nien_hoc || '';


    return (
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Lớp {className}</h1>
                <p className="text-muted-foreground">
                  Niên khóa {schoolYear}
                </p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                <Users className="mr-2 h-4 w-4" />
                {stats.total} học viên
              </Badge>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tổng Số</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Nam</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.male}
                </div>
                {/* 💡 Xử lý chia cho 0 nếu total = 0 */}
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.male / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Nữ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-pink-600">
                  {stats.female}
                </div>
                {/* 💡 Xử lý chia cho 0 nếu total = 0 */}
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.female / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Thiếu Ngày Sinh</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {stats.missingBirthday}
                </div>
                {/* 💡 Xử lý chia cho 0 nếu total = 0 */}
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.missingBirthday / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Student List */}
          <Card>
            <CardHeader>
              <CardTitle>Danh Sách Học Viên</CardTitle>
              <CardDescription>
                Thông tin chi tiết {stats.total} học viên trong lớp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">STT</TableHead>
                    <TableHead className="w-16">Mã học viên</TableHead>
                    <TableHead>Học Viên</TableHead>
                    <TableHead>Tên Thánh</TableHead>
                    <TableHead>Họ và Tên</TableHead>
                    <TableHead className="text-center">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      Ngày Sinh
                    </TableHead>
                    <TableHead className="text-center">Tình Trạng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((student, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{student.ma_hoc_vien}</TableCell>

                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {getInitials(student.ho, student.ten)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {student.ho} {student.ten}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {student.ten_thanh}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {student.ten_thanh}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.ho} {student.ten}
                      </TableCell>
                      <TableCell className="text-center">
                        {student.ngay_sinh ? (
                          <span className="text-sm">
                            {formatBirthday(student.ngay_sinh)}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 italic">
                            Chưa có thông tin
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getStatusVariant(student.tinh_trang)}>
                          {student.tinh_trang}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Missing Birthday Warning */}
          {stats.missingBirthday > 0 && (
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Có {stats.missingBirthday} học viên chưa cập nhật ngày sinh.
                Vui lòng bổ sung thông tin để hoàn thiện hồ sơ.
              </AlertDescription>
            </Alert>
          )}
        </div>
    )
}