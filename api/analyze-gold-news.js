export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel Environment Variables" })
    }

    // Prompt วิเคราะห์เชิง SMC / ICT สำหรับ Gold (XAUUSD)
    const prompt = `
    You are an elite Gold (XAUUSD) trader and analyst using Smart Money Concepts (SMC) and Inner Circle Trader (ICT) methodologies.
    Analyze the current macroeconomic sentiment for USD and Gold (XAUUSD).

    Evaluate impact on Gold (XAUUSD) and return a JSON object with this EXACT structure (no markdown formatting):
    {
      "signal": "BUY",
      "probability": 78,
      "summary": "ดอลลาร์สหรัฐมีสัญญาณชะลอตัวใกล้บริเวณ FVG สำคัญ มองหาโอกาส Buy ตามโครงสร้าง SMC/ICT บริเวณ Discount Zone",
      "events": [
        { "title": "USD Liquidity Sweep & Market Sentiment", "date": "Today", "time": "Live", "impact": "red" }
      ]
    }
    `

    // เรียกใช้ gemini-2.5-flash
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error("Gemini API Error Detail:", errText)
      return res.status(500).json({ error: `Gemini API Error: ${errText}` })
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    const parsedData = JSON.parse(rawText)

    return res.status(200).json(parsedData)

  } catch (error) {
    console.error("Handler Error:", error)
    return res.status(500).json({ error: error.message })
  }
}
