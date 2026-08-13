import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // 1. ตั้งค่า Header เพื่อรองรับ CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // 2. ถ้าบราวเซอร์ยิง OPTIONS มาเช็ค ให้ตอบ 200 กลับไปทันที
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 3. ตรวจสอบว่าเป็น POST หรือไม่
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { newsContent } = req.body || {};

        if (!newsContent) {
            return res.status(400).json({ error: "กรุณากรอกข้อความข่าว" });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                error: "ไม่พบ GEMINI_API_KEY ในระบบ (.env.local หรือ Vercel Settings)"
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemPrompt = `
คุณคือ AI นักวิเคราะห์ข่าวเศรษฐกิจและ Quantitative Trader
หน้าที่ของคุณคือ นำข้อมูลตัวเลขเศรษฐกิจ ข่าว หรือสถิติที่ผู้ใช้กรอก เข้ามาประมวลผลเพื่อคาดการณ์ "โอกาสความเป็นไปได้เชิงสถิติ (Probability Analysis)"

ให้วิเคราะห์และตอบออกมาในรูปแบบ Markdown ตามโครงสร้างนี้เท่านั้น:

1. 📊 สรุปประเด็นข่าวและค่าตัวเลขสำคัญ
2. 🎯 คาดการณ์โอกาสการเคลื่อนที่ของราคา (Probability Breakdown)
   - 🟢 **โอกาสขึ้น (Bullish Chance):** [X]%
   - 🔴 **โอกาสลง (Bearish Chance):** [Y]%
   - ⚪ **โอกาสไม่มีอะไรเกิดขึ้น / Sideway:** [Z]%
3. 📋 ตารางสถานการณ์และกลยุทธ์การรับมือ (Scenario Matrix)
4. 💡 คำแนะนำด้านบริหารความเสี่ยง
        `;

        const prompt = `${systemPrompt}\n\nข้อมูลข่าวที่ต้องวิเคราะห์:\n${newsContent}`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return res.status(200).json({ result: responseText });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: `Server Error: ${error.message}` });
    }
}