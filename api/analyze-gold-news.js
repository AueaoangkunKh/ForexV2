export default async function handler(req, res) {
  // รองรับ CORS
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in environment variables" })
    }

    // 1. ดึงข้อมูลปฏิทินเศรษฐกิจจริง (ตัวอย่างใช้ Economic Calendar API)
    // หมายเหตุ: สามารถเปลี่ยน URL เป็น API ปฏิทินข่าวที่คุณใช้อยู่ได้
    const today = new Date().toISOString().split("T")[0]
    const calendarRes = await fetch(`https://financialmodelingprep.com/api/v3/economic_calendar?from=${today}&to=${today}&apikey=${process.env.FMP_API_KEY || ''}`)
    const rawNews = await calendarRes.json()

    // กรองเฉพาะข่าว USD สำคัญระดับ Medium/High
    const usdNews = Array.isArray(rawNews) 
      ? rawNews.filter(n => n.currency === "USD" && (n.impact === "High" || n.impact === "Medium"))
      : []

    // 2. สร้าง Prompt ส่งให้ Gemini วิเคราะห์สำหรับ XAUUSD (SMC / ICT)
    const prompt = `
    You are an elite Gold (XAUUSD) trader using SMC (Smart Money Concepts) and ICT methodologies.
    Analyze these economic news events for USD:
    ${JSON.stringify(usdNews.length > 0 ? usdNews : "No high impact USD news today. Analyze general market sentiment for Gold.")}

    Evaluate impact on XAUUSD and return ONLY a valid JSON object in this exact format (no markdown formatting, no code blocks):
    {
      "signal": "BUY" or "SELL",
      "probability": number between 50 and 90,
      "summary": "Brief 2-sentence Thai analysis. Focus on Dollar Index bias, Liquidity Sweeps, and Key FVGs/Order Blocks for Gold.",
      "events": [
        { "title": "Event Name", "date": "15 Aug", "time": "19:30", "impact": "red" or "orange" }
      ]
    }
    `

    // 3. ยิงไปที่ Gemini API
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    
    // คลีน Format ป้องกัน Markdown ติดมา
    const cleanJsonText = rawText.replace(/```json|```/g, "").trim()
    const parsedData = JSON.parse(cleanJsonText)

    return res.status(200).json(parsedData)

  } catch (error) {
    console.error("AI News Handler Error:", error)
    return res.status(500).json({ error: error.message })
  }
}