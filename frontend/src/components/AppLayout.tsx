'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    LayoutDashboard, ListChecks, CalendarCheck, 
    Menu, X, CheckCircle2, ChevronRight, Church, Zap
} from 'lucide-react';

interface AppLayoutProps {
    children: React.ReactNode;
}

const navItems = [
    { name: "Tổng quan", icon: LayoutDashboard, href: "/" },
    { name: "Danh sách điểm danh", icon: ListChecks, href: "/diemdanh" },
    { name: "Điểm danh nhanh", icon: Zap, href: "/diemdanh-nhanh" },
    { name: "Theo Dõi Đi Bù", icon: CalendarCheck, href: "/dibu" },
];

export default function AppLayout({ children }: AppLayoutProps) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 antialiased selection:bg-blue-500 selection:text-white">
            
            {/* MOBILE HEADER BAR (< md) */}
            <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Church className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-slate-900 leading-tight">GX Thiên Phú</h1>
                        <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">Tool Điểm Danh</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
                    aria-label="Toggle Menu"
                >
                    {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </header>

            {/* MOBILE DRAWER OVERLAY */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 z-50 md:hidden backdrop-blur-xs transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    <div 
                        className="w-72 bg-white h-full p-5 shadow-2xl flex flex-col space-y-6 animate-in slide-in-from-left duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between border-b pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                                    <Church className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-sm text-slate-900">GX Thiên Phú</h2>
                                    <p className="text-[10px] text-slate-500">Xứ Đoàn Kitô Vua</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Navigation Links */}
                        <nav className="space-y-1.5 flex-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition ${
                                            isActive
                                                ? 'bg-blue-50 text-blue-600 shadow-2xs border border-blue-100'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                            <span>{item.name}</span>
                                        </div>
                                        {isActive && <ChevronRight className="w-4 h-4 text-blue-600" />}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Drawer Footer */}
                        <div className="border-t pt-4 text-[11px] text-slate-400 text-center">
                            Phiên bản 2.0 • Xứ Đoàn Kitô Vua
                        </div>
                    </div>
                </div>
            )}

            {/* DESKTOP SIDEBAR (>= md) */}
            <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col p-5 space-y-6 shadow-xs shrink-0 sticky top-0 h-screen">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20">
                        <Church className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-bold text-base text-slate-900 leading-tight">GX Thiên Phú</h2>
                        <p className="text-[11px] text-blue-600 font-semibold tracking-wide uppercase">Tool Điểm Danh</p>
                    </div>
                </div>

                <nav className="space-y-1.5 flex-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-600 font-bold shadow-2xs border border-blue-100'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                            >
                                <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-slate-100 pt-4 text-xs text-slate-400">
                    <p className="font-medium text-slate-600">Xứ Đoàn Kitô Vua</p>
                    <p className="text-[11px] mt-0.5">Hỗ trợ điểm danh & đi bù</p>
                </div>
            </aside>

            {/* MAIN VIEWPORT */}
            <main className="flex-1 min-w-0 pb-16 md:pb-8">
                {children}
            </main>

            {/* MOBILE BOTTOM NAVIGATION BAR (< md) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 px-3 py-1.5 flex items-center justify-around shadow-lg">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[11px] font-medium transition min-w-[72px] ${
                                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <item.icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-600 scale-110' : 'text-slate-400'} transition-transform`} />
                            <span className="truncate max-w-[80px]">{item.name.replace("Danh sách ", "")}</span>
                        </Link>
                    );
                })}
            </nav>

        </div>
    );
}
