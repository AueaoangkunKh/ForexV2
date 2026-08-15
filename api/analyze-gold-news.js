export default async function handler(req, res) {
  // ==============================
  // CORS
  // ==============================
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  // ==============================
  // ONLY GET / POST
  // ==============================
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    })
  }

  try {
    // ==============================
    // ENVIRONMENT VARIABLES
    // ==============================
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    const FMP_API_KEY = process.env.FMP_API_KEY

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY in Vercel Environment Variables"
      })
    }

    if (!FMP_API_KEY) {
      return res.status(500).json({
        error: "Missing FMP_API_KEY in Vercel Environment Variables"
      })
    }

    // ==============================
    // TODAY
    // ==============================
    const today = new Date().toISOString().split("T")[0]

    // ==============================
    // FETCH ECONOMIC CALENDAR
    // ==============================
    const calendarUrl =
      `https://financialmodelingprep.com/api/v3/economic_calendar` +
      `?from=${today}&to=${today}&apikey=${encodeURIComponent(FMP_API_KEY)}`

    const calendarRes = await fetch(calendarUrl)

    if (!calendarRes.ok) {
      const errorText = await calendarRes.text()

      throw new Error(
        `FMP API Error (${calendarRes.status}): ${errorText}`
      )
    }

    const rawNews = await calendarRes.json()

    // ==============================
    // FILTER USD MEDIUM / HIGH
    // ==============================
    const usdNews = Array.isArray(rawNews)
      ? rawNews.filter(
          (n) =>
            n &&
            n.currency === "USD" &&
            (n.impact === "High" || n.impact === "Medium")
        )
      : []

    // ==============================
    // PREPARE NEWS DATA
    // ==============================
    const newsForAI =
      usdNews.length > 0
        ? usdNews.map((n) => ({
            event: n.event || "",
            date: n.date || "",
            time: n.time || "",
            country: n.country || "",
            currency: n.currency || "",
            impact: n.impact || "",
            actual: n.actual ?? null,
            previous: n.previous ?? null,
            estimate: n.estimate ?? null
          }))
        : "No high impact USD news today."

    // ==============================
    // PROMPT
    // ==============================
    const prompt = `
You are an elite Gold (XAUUSD) macro and technical analyst specializing in:
- Smart Money Concepts (SMC)
- ICT methodology
- Liquidity
- Market structure
- Fair Value Gaps (FVG)
- Order Blocks
- Dollar Index (DXY)
- US Treasury yields
- Risk-on / Risk-off sentiment
- Safe-haven flows

Your task is to evaluate today's USD economic news and determine the likely short-term directional bias for XAUUSD.

IMPORTANT:
1. Do not invent economic events.
2. Only use the supplied news data.
3. If there are no important news events, evaluate the general market implications conservatively.
4. The probability must be between 50 and 90.
5. Return ONLY valid JSON.
6. Do NOT use markdown.
7. Do NOT wrap the JSON in code fences.
8. The "summary" must be in Thai.
9. Keep the summary concise and useful for a trading dashboard.

NEWS DATA:
${JSON.stringify(newsForAI, null, 2)}

RETURN EXACTLY THIS JSON STRUCTURE:

{
  "signal": "BUY",
  "probability": 75,
  "summary": "คำวิเคราะห์ภาษาไทย 2 ประโยค โดยเน้น Dollar Index bias, liquidity sweeps, FVG และ Order Blocks",
  "events": [
    {
      "title": "Event Name",
      "date": "15 Aug",
      "time": "19:30",
      "impact": "red"
    }
  ]
}

RULES:
- signal must be exactly "BUY" or "SELL"
- probability must be a number from 50 to 90
- summary must be a Thai string
- events must be an array
- impact must be either "red" or "orange"
- If there are no USD news events, return an empty events array.
`

    // ==============================
    // GEMINI INTERACTIONS API
    // ==============================
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          input: prompt
        })
      }
    )

    // ==============================
    // READ GEMINI RESPONSE
    // ==============================
    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      console.error("Gemini API Error:", geminiData)

      return res.status(geminiRes.status).json({
        error: "Gemini API Error",
        details:
          geminiData?.error?.message ||
          geminiData?.message ||
          JSON.stringify(geminiData)
      })
    }

    // ==============================
    // EXTRACT OUTPUT TEXT
    // ==============================
    let rawText = ""

    // Current Interactions API response structure
    if (typeof geminiData.output_text === "string") {
      rawText = geminiData.output_text
    }

    // Fallback: read steps manually
    if (!rawText && Array.isArray(geminiData.steps)) {
      const modelOutputStep = geminiData.steps.find(
        (step) => step?.type === "model_output"
      )

      if (modelOutputStep && Array.isArray(modelOutputStep.content)) {
        rawText = modelOutputStep.content
          .filter((item) => item?.type === "text")
          .map((item) => item?.text || "")
          .join("")
      }
    }

    if (!rawText) {
      console.error(
        "Gemini returned no text:",
        JSON.stringify(geminiData, null, 2)
      )

      throw new Error("Gemini returned no text output")
    }

    // ==============================
    // CLEAN JSON
    // ==============================
    let cleanJsonText = rawText.trim()

    // Remove markdown code fences
    cleanJsonText = cleanJsonText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    // Find first { and last }
    const firstBrace = cleanJsonText.indexOf("{")
    const lastBrace = cleanJsonText.lastIndexOf("}")

    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanJsonText = cleanJsonText.slice(
        firstBrace,
        lastBrace + 1
      )
    }

    // ==============================
    // PARSE JSON
    // ==============================
    let parsedData

    try {
      parsedData = JSON.parse(cleanJsonText)
    } catch (jsonError) {
      console.error("Gemini JSON Parse Error:", jsonError)
      console.error("Raw Gemini Text:", rawText)

      return res.status(500).json({
        error: "Gemini returned invalid JSON",
        raw: rawText
      })
    }

    // ==============================
    // VALIDATE SIGNAL
    // ==============================
    const signal =
      parsedData?.signal === "SELL"
        ? "SELL"
        : "BUY"

    // ==============================
    // VALIDATE PROBABILITY
    // ==============================
    let probability = Number(parsedData?.probability)

    if (!Number.isFinite(probability)) {
      probability = 50
    }

    probability = Math.round(
      Math.min(
        90,
        Math.max(50, probability)
      )
    )

    // ==============================
    // VALIDATE SUMMARY
    // ==============================
    const summary =
      typeof parsedData?.summary === "string" &&
      parsedData.summary.trim()
        ? parsedData.summary.trim()
        : "ไม่สามารถสร้างบทวิเคราะห์ได้"

    // ==============================
    // VALIDATE EVENTS
    // ==============================
    const events = Array.isArray(parsedData?.events)
      ? parsedData.events
          .filter((event) => event && typeof event === "object")
          .map((event) => ({
            title:
              typeof event.title === "string"
                ? event.title
                : "Unknown Event",

            date:
              typeof event.date === "string"
                ? event.date
                : "",

            time:
              typeof event.time === "string"
                ? event.time
                : "",

            impact:
              event.impact === "red"
                ? "red"
                : "orange"
          }))
      : []

    // ==============================
    // FINAL RESPONSE
    // ==============================
    return res.status(200).json({
      signal,
      probability,
      summary,
      events
    })

  } catch (error) {
    console.error("AI Gold News Handler Error:", error)

    return res.status(500).json({
      error: "AI Market Evaluation failed",
      details: error?.message || "Unknown server error"
    })
  }
}
