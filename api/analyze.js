import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { newsContent } = req.body || {};

        if (!newsContent) {
            return res.status(400).json({ error: "กรุณากรอกข้อความข่าว" });
        }

        // ดึง API Key
        const apiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_Key;
        if (!apiKey) {
            return res.status(500).json({ 
                error: "ไม่พบ GEMINI_API_KEY ใน Vercel Environment Variables" 
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        
        // 🟢 เปลี่ยนมาใช้ชื่อโมเดลมาตรฐานตัวนี้ครับ
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemPrompt = `
คุณคือ AI นักวิเคราะห์ข่าวเศรษฐกิจและ Quantitative Trader ประจำห้องเทรด (เน้นสินทรัพย์ XAUUSD และ Forex/Crypto)
หน้าที่ของคุณคือ นำข้อมูลตัวเลขเศรษฐกิจ ข่าว หรือสถิติที่ผู้ใช้กรอก เข้ามาประมวลผลเพื่อคาดการณ์ "โอกาสความเป็นไปได้เชิงสถิติ (Probability Analysis)"

ให้วิเคราะห์และตอบออกมาในรูปแบบ Markdown ตามโครงสร้างนี้เท่านั้น:

1. 📊 สรุปประเด็นข่าวและค่าตัวเลขสำคัญ
   - ตัวเลขจริง (Actual) / คาดการณ์ (Forecast) / ครั้งก่อน (Previous)

2. 🎯 คาดการณ์โอกาสการเคลื่อนที่ของราคา (Probability Breakdown)
   วิเคราะห์ความน่าจะเป็นออกมาเป็น % รวมกันต้องได้ 100% พร้อมเหตุผลสั้นๆ:
   - 🟢 **โอกาสขึ้น (Bullish Chance):** [X]% - (ระบุปัจจัยสนับสนุน)
   - 🔴 **โอกาสลง (Bearish Chance):** [Y]% - (ระบุปัจจัยสนับสนุน)
   - ⚪ **โอกาสไม่มีอะไรเกิดขึ้น / Sideway:** [Z]% - (ระบุปัจจัย)

3. 📋 ตารางสถานการณ์และกลยุทธ์การรับมือ (Scenario Matrix)
   | ฉากทัศน์ตัวเลข | โอกาสเกิด (%) | ผลกระทบต่อราคา | พฤติกรรมราคาที่คาด (Price Action / SMC) |
   | --- | --- | --- | --- |
   | ตัวเลขสูงกว่าคาด | ...% | ... | ... |
   | ตัวเลขตามคาด | ...% | ... | ... |
   | ตัวเลขต่ำกว่าคาด | ...% | ... | ... |

4. 💡 คำแนะนำด้านบริหารความเสี่ยง (Risk Management Note)
`;

        const prompt = `${systemPrompt}\n\nข้อมูลข่าวที่ต้องวิเคราะห์:\n${newsContent}`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return res.status(200).json({ result: responseText });

    } catch (error) {
        console.error("Gemini API Error:", error);
        return res.status(500).json({ error: `AI Processing Error: ${error.message}` });
    }
}