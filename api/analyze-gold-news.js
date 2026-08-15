export default async function handler(req, res) {
  // ตั้งค่า CORS ให้ Frontend เรียกใช้งานได้
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // จัดการ Preflight Request (ถ้ามี)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel settings" });
    }

    // สร้าง Prompt สำหรับวิเคราะห์ SMC/ICT (XAUUSD)
    const prompt = `
    You are an expert Gold (XAUUSD) trader using SMC and ICT methodologies.
    Analyze current market sentiment for Gold and USD.
    Return ONLY a JSON object with this EXACT format:
    {
      "signal": "BUY",
      "probability": 75,
      "summary": "ดอลลาร์ชะลอตัวใกล้บริเวณ FVG มองหาโอกาส Buy Gold จาก Liquidity Sweep บริเวณ Discount Zone",
      "events": [
        { "title": "USD Liquidity Scan & Sentiment", "date": "Today", "time": "Live", "impact": "red" }
      ]
    }
    `;

    // ยิง API ไปที่โมเดลล่าสุด (gemini-1.5-flash-latest)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const geminiData = await geminiRes.json();

    // ดัก Error กรณี Gemini ตอบกลับมาผิดพลาด
    if (!geminiRes.ok) {
      console.error("Gemini API Error:", geminiData);
      return res.status(500).json({ error: geminiData.error?.message || "Gemini API Request Failed" });
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanJson = JSON.parse(rawText);

    return res.status(200).json(cleanJson);

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
