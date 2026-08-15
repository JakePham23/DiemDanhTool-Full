// lib/axios.customize.ts
import axios from "axios";
import { toast } from "sonner";

const getBaseURL = () => {
  // Khi chạy ở trình duyệt (Client-side), luôn dùng relative path /api
  // để đi qua Next.js Reverse Proxy trên cùng domain Cloudflare Tunnel
  if (typeof window !== "undefined") {
    return "/api";
  }
  // Khi chạy ở Server-side (SSR)
  const backend = process.env.NEXT_PUBLIC_API_BACKEND;
  if (backend && backend.trim()) {
    const raw = backend.trim().replace(/\/+$/, "");
    return raw.endsWith("/api") ? raw : `${raw}/api`;
  }
  return "http://127.0.0.1:3001/api";
};

const instance = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// 🟢 Request interceptor — đính kèm accessToken
instance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("accessToken");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🟢 Response interceptor — bắt lỗi chung
instance.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response) {
      toast.error(error.response.data?.message || "Server Error");
    } else if (error.request) {
      toast.error("Network error, please check your connection.");
    } else {
      toast.error(error.message);
    }
    return Promise.reject(error);
  }
);


export default instance;
