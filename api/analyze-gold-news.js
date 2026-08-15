export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    const FMP_API_KEY = process.env.FMP_API_KEY

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel settings" })
    }

    // ดึงข้อมูลข่าวสารจาก FMP (หากมี API Key)
    let usdNews = []
    if (FMP_API_KEY) {
      try {
        const today = new Date().toISOString().split("T")[0]
        const calendarUrl = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${today}&to=${today}&apikey=${encodeURIComponent(FMP_API_KEY)}`
        const calendarRes = await fetch(calendarUrl)
        if (calendarRes.ok) {
          const rawNews = await calendarRes.json()
          if (Array.isArray(rawNews)) {
            usdNews = rawNews.filter(n => n && n.currency === "USD" && (n.impact === "High" || n.impact === "Medium"))
          }
        }
      } catch (fmpErr) {
        console.warn("FMP Fetch Warning:", fmpErr.message)
      }
    }

    const newsDataString = usdNews.length > 0 
      ? JSON.stringify(usdNews.map(n => ({ event: n.event, time: n.time, impact: n.impact, actual: n.actual, estimate: n.estimate })), null, 2)
      : "No specific high impact USD news events scheduled for today. Analyze general USD/Gold market sentiment."

    const prompt = `
You are an expert Gold (XAUUSD) trader using SMC and ICT methodologies.
Analyze market sentiment based on USD economic factors, Liquidity Sweeps, Fair Value Gaps (FVG), Order Blocks, and DXY context.

NEWS DATA:
${newsDataString}

Return ONLY valid JSON in this exact structure without markdown or backticks:
{
  "signal": "BUY",
  "probability": 75,
  "summary": "ดอลลาร์ชะลอตัวใกล้บริเวณ FVG มองหาโอกาส Buy Gold จาก Liquidity Sweep บริเวณ Discount Zone",
  "events": [
    {
      "title": "USD Liquidity Scan & Sentiment",
      "date": "Today",
      "time": "Live",
      "impact": "red"
    }
  ]
}
`

    // ระบุชื่อโมเดลเป็น gemini-2.0-flash หรือ gemini-1.5-flash ตรงๆ (ห้ามใส่ -latest)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    })

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      console.error("Gemini Error:", geminiData)
      return res.status(500).json({ error: geminiData.error?.message || "Gemini API Request Failed" })
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    const cleanJson = JSON.parse(rawText)

    return res.status(200).json({
      signal: cleanJson.signal || "BUY",
      probability: cleanJson.probability || 70,
      summary: cleanJson.summary || "ประมวลผลสำเร็จ",
      events: cleanJson.events || []
    })

  } catch (err) {
    console.error("Handler Error:", err)
    return res.status(500).json({ error: err.message })
  }
}
