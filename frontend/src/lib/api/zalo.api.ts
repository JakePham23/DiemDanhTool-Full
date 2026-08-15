// src/lib/api/zalo.api.ts
import { DiemDanhRecord, ExtraNotificationInfo, sendZaloNotification } from "@/lib/send-notification/zaloHelper";

export async function sendZalo(
    data: DiemDanhRecord[], 
    reportType: string = "", 
    extraInfo?: ExtraNotificationInfo
) {
    return await sendZaloNotification(data, reportType, extraInfo);
}
