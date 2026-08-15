// pages/api/send-telegram.ts
import { NextApiRequest, NextApiResponse } from "next";
import { chunkArray, formatMessageHTML, DiemDanhRecord } from "@/lib/send-notification/telegramHelper";

export async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST")
        return res.status(405).json({ error: "Method not allowed" });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        return res.status(500).json({
            error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID"
        });
    }

    const data = req.body.data as DiemDanhRecord[];
    if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid data format" });
    }

    const CHUNK_SIZE = 30;
    const chunks = chunkArray(data, CHUNK_SIZE);

    try {
        for (let i = 0; i < chunks.length; i++) {
            let msg = formatMessageHTML(chunks[i], i, chunks.length);

            if (i === chunks.length - 1) {
                msg += `--------------------------\n`;
                msg += `📊 <b>Tổng số:</b> ${data.length} HV`;
            }

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: msg,
                    parse_mode: "HTML"
                }),
            });
        }

        return res.json({ success: true, chunks: chunks.length });

    } catch (err) {
        return res.status(500).json({ error: "Telegram send failed", detail: err });
    }
}


export async function sendTelegram(data: DiemDanhRecord[]) {
    await fetch("/api/send-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
    });
}
