export default async function handler(req, res) {
  // 1. รองรับ CORS
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") return res.status(200).end()

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel settings" })
    }

    // 2. Prompt SMC/ICT สำหรับ XAUUSD
    const prompt = `
    You are an expert XAUUSD trader using SMC and ICT methodologies.
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
    `

    // 3. ยิงไปที่ Gemini API
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    })

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      return res.status(500).json({ error: geminiData.error?.message || "Gemini API Request Failed" })
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    const cleanJson = JSON.parse(rawText)

    return res.status(200).json(cleanJson)

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
