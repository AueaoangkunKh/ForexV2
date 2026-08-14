import { createClient } from "@supabase/supabase-js";

const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
    try {
        // ตรวจสอบเบื้องต้นว่าตัวแปรสภาพแวดล้อมถูกโหลดมาจริงไหม
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
            throw new Error("Missing Supabase Environment Variables on Vercel Settings");
        }

        // ลองดึงข้อมูลจากตาราง users
        await client
            .from("users")
            .select("id")
            .limit(1);

        return res.status(200).json({
            status: "OK",
            time: new Date()
        });
    } catch (error) {
        // หากเกิด Error จะส่งสถานะ 500 พร้อมข้อความแจ้งเตือนที่อ่านออกแทนการแครช
        return res.status(500).json({
            status: "FAILED",
            error: error.message
        });
    }
}