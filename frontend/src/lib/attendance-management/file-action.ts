// src/lib/actions/file-actions.ts
'use server'; // 👈 BẮT BUỘC: Đánh dấu file này chỉ chạy trên server

import fs from 'fs';
import path from 'path';
import { CLASS_ID_TO_SLUG, CLASS_MAPPING } from '@/lib/utils/utils';
// 1. Hàm lấy Base URL tự động (Localhost hoặc Domain thật)
const getBaseUrl = () => {
    if (process.env.VERCEL_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
    return 'http://localhost:3000'; // Mặc định cho local
};
const readJsonFile = async (filename: string) => {
    try {
        const baseUrl = getBaseUrl();
        // Gọi thẳng vào đường dẫn public URL
        // cache: 'no-store' để đảm bảo luôn lấy file mới nhất nếu bạn có cập nhật
        const res = await fetch(`${baseUrl}/output_hocvien_data/${filename}`, { 
            cache: 'no-store' 
        });

        if (!res.ok) {
            console.error(`❌ Fetch thất bại: ${filename} - Status: ${res.status}`);
            return null;
        }

        return await res.json();
    } catch (error) {
        console.error(`❌ Lỗi đọc file ${filename}:`, error);
        return null;
    }
};

export const getDataGradeByInfoJson = async (MAKHOI: string, MALOPHOC: string) => {
    if (MAKHOI === 'all' && MALOPHOC === 'all') {
        return await readJsonFile('all_data.json') || [];
    }

    if (MALOPHOC === 'all') {
        // Tìm tất cả các lớp thuộc Khối này
        const matchedSlugs = Object.entries(CLASS_MAPPING)
            .filter(([_, val]) => val.MAKHOI === MAKHOI)
            .map(([slug]) => slug);

        if (matchedSlugs.length > 0) {
            const results = await Promise.all(
                matchedSlugs.map(slug => readJsonFile(`${slug}_data.json`))
            );
            const combined = results.flat().filter(Boolean);
            return combined;
        }
    }

    const lookupKey = `${MAKHOI}_${MALOPHOC}`;
    const fileSlug = CLASS_ID_TO_SLUG[lookupKey];

    if (!fileSlug) {
        console.error(`❌ Chưa mapping cho Khối ${MAKHOI} - Lớp ${MALOPHOC}`);
        return [];
    }

    const fileName = `${fileSlug}_data.json`;
    return await readJsonFile(fileName) || [];
};