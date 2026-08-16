// api/analyze-gold-news.js

export default async function handler(req, res) {
    // ==============================
    // CORS
    // ==============================

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    // ==============================
    // ENVIRONMENT VARIABLES
    // ==============================

    const FMP_API_KEY = process.env.FMP_API_KEY
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!FMP_API_KEY) {
        return res.status(500).json({
            error: "Missing FMP_API_KEY in Vercel Environment Variables"
        })
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({
            error: "Missing GEMINI_API_KEY in Vercel Environment Variables"
        })
    }

    try {

        // ==============================
        // 1. GET NEWS FROM FMP
        // ==============================

        const newsUrl =
            `https://financialmodelingprep.com/stable/forex-news` +
            `?page=0&limit=20&apikey=${encodeURIComponent(FMP_API_KEY)}`

        const newsResponse = await fetch(newsUrl)

        if (!newsResponse.ok) {
            throw new Error(
                `FMP API Error: ${newsResponse.status}`
            )
        }

        const newsData = await newsResponse.json()

        if (!Array.isArray(newsData) || newsData.length === 0) {
            throw new Error("No forex news returned from FMP")
        }

        // ==============================
        // 2. FILTER NEWS
        // ==============================

        const relevantKeywords = [
            "gold",
            "xau",
            "usd",
            "dollar",
            "fed",
            "federal reserve",
            "interest rate",
            "inflation",
            "cpi",
            "ppi",
            "nfp",
            "employment",
            "jobs",
            "treasury",
            "bond",
            "yield",
            "powell",
            "ecb",
            "boj",
            "pboc",
            "china",
            "geopolitical",
            "war",
            "oil",
            "risk",
            "safe haven"
        ]

        const filteredNews = newsData.filter(article => {

            const text = (
                `${article.title || ""} ` +
                `${article.text || ""} ` +
                `${article.content || ""}`
            ).toLowerCase()

            return relevantKeywords.some(keyword =>
                text.includes(keyword)
            )
        })

        // ถ้ากรองแล้วไม่มีข่าว ให้ใช้ข่าวล่าสุดแทน
        const finalNews =
            filteredNews.length > 0
                ? filteredNews.slice(0, 12)
                : newsData.slice(0, 12)

        // ==============================
        // 3. PREPARE NEWS FOR GEMINI
        // ==============================

        const newsText = finalNews.map((article, index) => {

            return `
NEWS ${index + 1}

Title:
${article.title || "Unknown"}

Content:
${article.text || article.content || "No content"}

Published:
${article.publishedDate || article.date || "Unknown"}

Source:
${article.site || article.source || "Unknown"}

URL:
${article.url || ""}
`
        }).join("\n-------------------------\n")

        // ==============================
        // 4. GEMINI PROMPT
        // ==============================

        const prompt = `
You are a professional institutional macro trader specializing in XAU/USD (Gold).

Your task is to analyze the latest financial news and determine the short-term directional bias of GOLD.

IMPORTANT:
- Do NOT blindly predict price.
- Do NOT invent news.
- Only use information contained in the provided news.
- Consider macroeconomic relationships.
- Explain the reasoning clearly.
- The final response MUST be valid JSON.
- Do not use Markdown.
- Do not wrap the JSON in code fences.

Analyze these factors:

1. USD strength / weakness
2. US Treasury yields
3. Real yields
4. Federal Reserve policy
5. Inflation
6. Employment data
7. Interest-rate expectations
8. Geopolitical risk
9. Risk-on / risk-off sentiment
10. Safe-haven demand
11. China / PBOC
12. ECB / BOJ if relevant

Determine:

- BUY = bullish for Gold
- SELL = bearish for Gold
- NEUTRAL = mixed / insufficient evidence

Probability should represent your confidence in the directional bias.

Return EXACTLY this JSON structure:

{
  "signal": "BUY",
  "probability": 75,
  "summary": "ภาษาไทยสรุปภาพรวมและเหตุผล",
  "marketBias": "Bullish",
  "usdImpact": "Positive for Gold",
  "yieldImpact": "Positive for Gold",
  "fedImpact": "Positive for Gold",
  "riskSentiment": "Risk-Off",
  "events": [
    {
      "title": "ชื่อข่าว",
      "date": "2026-08-16",
      "time": "12:30",
      "impact": "high"
    }
  ]
}

Rules:

signal:
BUY / SELL / NEUTRAL

marketBias:
Bullish / Bearish / Neutral

riskSentiment:
Risk-On / Risk-Off / Neutral

impact:
high / medium / low

probability:
0-100

summary:
ตอบเป็นภาษาไทย
ความยาวประมาณ 3-6 ประโยค
เน้นผลกระทบต่อ XAU/USD

NEWS DATA:

${newsText}
`

        // ==============================
        // 5. CALL GEMINI
        // ==============================

        const geminiUrl =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            "gemini-3.5-flash:generateContent"

        const geminiResponse = await fetch(geminiUrl, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY
            },

            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],

                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json"
                }
            })
        })

        if (!geminiResponse.ok) {

            const errorText =
                await geminiResponse.text()

            throw new Error(
                `Gemini API Error: ${geminiResponse.status} ${errorText}`
            )
        }

        const geminiData =
            await geminiResponse.json()

        // ==============================
        // 6. GET GEMINI TEXT
        // ==============================

        const text =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

        if (!text) {
            throw new Error(
                "Gemini returned empty response"
            )
        }

        // ==============================
        // 7. CLEAN JSON
        // ==============================

        let cleanedText = text.trim()

        // ป้องกัน Gemini ส่ง ```json ... ```
        cleanedText = cleanedText
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim()

        let result

        try {

            result = JSON.parse(cleanedText)

        } catch (jsonError) {

            console.error(
                "Gemini JSON Parse Error:",
                cleanedText
            )

            throw new Error(
                "Gemini returned invalid JSON"
            )
        }

        // ==============================
        // 8. NORMALIZE RESULT
        // ==============================

        const signal =
            ["BUY", "SELL", "NEUTRAL"].includes(
                String(result.signal).toUpperCase()
            )
                ? String(result.signal).toUpperCase()
                : "NEUTRAL"

        let probability =
            Number(result.probability)

        if (
            Number.isNaN(probability) ||
            probability < 0 ||
            probability > 100
        ) {
            probability = 50
        }

        let events =
            Array.isArray(result.events)
                ? result.events
                : []

        // จำกัดจำนวนข่าว
        events = events.slice(0, 10).map(event => {

            let impact =
                String(event.impact || "medium").toLowerCase()

            if (!["high", "medium", "low"].includes(impact)) {
                impact = "medium"
            }

            return {
                title:
                    event.title ||
                    "Market News",

                date:
                    event.date ||
                    "",

                time:
                    event.time ||
                    "",

                impact
            }
        })

        // ==============================
        // 9. FINAL RESPONSE
        // ==============================

        return res.status(200).json({

            success: true,

            signal,

            probability,

            summary:
                result.summary ||
                "ไม่พบข้อมูลวิเคราะห์",

            marketBias:
                result.marketBias ||
                "Neutral",

            usdImpact:
                result.usdImpact ||
                "Neutral",

            yieldImpact:
                result.yieldImpact ||
                "Neutral",

            fedImpact:
                result.fedImpact ||
                "Neutral",

            riskSentiment:
                result.riskSentiment ||
                "Neutral",

            events,

            updatedAt:
                new Date().toISOString(),

            source:
                "FMP + Gemini AI"
        })

    } catch (error) {

        console.error(
            "Analyze Gold News Error:",
            error
        )

        return res.status(500).json({

            success: false,

            error:
                error.message ||
                "Unknown server error"
        })
    }
}