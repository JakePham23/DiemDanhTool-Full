// app/hocvien/[hocvieninfo]/page.tsx (Server Component)

import dynamic from 'next/dynamic';
// KHÔNG cần import các components UI ở đây nữa, chỉ cần import Client Component

interface PageProps {
    params: { hocvieninfo: string };
}

// Dùng dynamic import để tải Client Component
const HocVienClientPage = dynamic(() => import('./HocVienPage'), { ssr: false });

export default function Page({ params }: PageProps) {
    // 1. Next.js tự động giải mã hocvieninfo
    const { hocvieninfo } = params; 
    
    // 2. Nối URL mà API backend cần
    const url_navigation = `/admin/hocvien?${hocvieninfo}`;
    
    // 3. Render Client Component và truyền URL đã chuẩn hóa
    return <HocVienClientPage urlNavigation={url_navigation} />;
}