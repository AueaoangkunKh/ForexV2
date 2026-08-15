export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") return res.status(200).end()

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" })
    }

    const prompt = `
    You are an expert XAUUSD trader using SMC and ICT.
    Analyze today's Gold (XAUUSD) market sentiment and USD conditions.
    Return ONLY a JSON object with this exact structure:
    {
      "signal": "BUY",
      "probability": 75,
      "summary": "ตลาดทองคำมีแนวโน้มรีบาวด์จาก Liquidity Sweep บริเวณ Discount Zone โดยรอการยืนยันโครงสร้างราคาแบบ Choch ในกรอบเวลาเล็ก",
      "events": [
        { "title": "USD Liquidity Scan", "date": "Today", "time": "Live", "impact": "red" }
      ]
    }
    `

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
      console.error("Gemini Response Error:", geminiData)
      return res.status(500).json({ error: geminiData.error?.message || "Gemini API Request Failed" })
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    const cleanJson = JSON.parse(rawText)

    return res.status(200).json(cleanJson)

  } catch (err) {
    console.error("API Handler Error:", err)
    return res.status(500).json({ error: err.message })
  }
}
