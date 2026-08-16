export default async function handler(req, res) {
    // ============================================
    // CORS
    // ============================================
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // ============================================
    // Only GET
    // ============================================
    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    // ============================================
    // FMP API KEY
    // ============================================
    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
        console.error("Missing FMP_API_KEY");

        return res.status(500).json({
            success: false,
            error: "Missing FMP_API_KEY in Vercel Environment Variables"
        });
    }

    // ============================================
    // QUERY PARAMETERS
    // ============================================
    const {
        date,
        limit = "50"
    } = req.query || {};

    // ============================================
    // DATE
    // ============================================
    const selectedDate = date || getBangkokDate();

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        return res.status(400).json({
            success: false,
            error: "Invalid date format. Use YYYY-MM-DD."
        });
    }

    // ============================================
    // LIMIT
    // ============================================
    let newsLimit = parseInt(limit, 10);

    if (isNaN(newsLimit)) {
        newsLimit = 50;
    }

    newsLimit = Math.min(Math.max(newsLimit, 1), 100);

    try {
        // ========================================
        // FMP GENERAL NEWS API
        // ========================================
        const fmpUrl =
            "https://financialmodelingprep.com/api/v4/general_news" +
            `?page=0&limit=${newsLimit}` +
            `&from=${selectedDate}` +
            `&to=${selectedDate}` +
            `&apikey=${encodeURIComponent(apiKey)}`;

        const response = await fetch(fmpUrl);

        if (!response.ok) {
            const errorText = await response.text();

            console.error("FMP Error:", response.status, errorText);

            return res.status(response.status).json({
                success: false,
                error: "FMP API request failed",
                details: errorText
            });
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error("Unexpected FMP response:", data);

            return res.status(500).json({
                success: false,
                error: "Unexpected response from FMP API"
            });
        }

        // ========================================
        // FILTER NEWS
        // ========================================
        const filteredNews = data
            .filter(isRelevantNews)
            .map(normalizeNews)
            .sort((a, b) => {
                return new Date(b.publishedDate) - new Date(a.publishedDate);
            });

        // ========================================
        // RESPONSE
        // ========================================
        return res.status(200).json({
            success: true,
            date: selectedDate,
            count: filteredNews.length,
            news: filteredNews
        });

    } catch (error) {
        console.error("News API Error:", error);

        return res.status(500).json({
            success: false,
            error: "Failed to fetch financial news",
            details: error.message
        });
    }
}


// ==================================================
// BANGKOK DATE
// ==================================================

function getBangkokDate() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}


// ==================================================
// NEWS FILTER
// ==================================================

function isRelevantNews(item) {
    const title = String(
        item.title ||
        item.headline ||
        ""
    ).toLowerCase();

    const text = String(
        item.text ||
        item.content ||
        item.summary ||
        ""
    ).toLowerCase();

    const combinedText = `${title} ${text}`;

    // ============================================
    // GOLD / XAU
    // ============================================

    const goldKeywords = [
        "gold",
        "xau",
        "bullion",
        "precious metal",
        "precious metals",
        "gold price",
        "gold prices",
        "gold futures",
        "gold market",
        "gold demand",
        "gold rally"
    ];

    // ============================================
    // FED
    // ============================================

    const fedKeywords = [
        "federal reserve",
        "fed",
        "fomc",
        "fed chair",
        "powell",
        "interest rate",
        "interest rates",
        "rate cut",
        "rate cuts",
        "rate hike",
        "rate hikes",
        "monetary policy"
    ];

    // ============================================
    // US ECONOMY
    // ============================================

    const economyKeywords = [
        "inflation",
        "cpi",
        "core cpi",
        "pce",
        "core pce",
        "ppi",
        "nonfarm payroll",
        "nonfarm payrolls",
        "nfp",
        "employment",
        "unemployment",
        "jobless claims",
        "jobs report",
        "retail sales",
        "gdp",
        "economic growth",
        "recession"
    ];

    // ============================================
    // USD
    // ============================================

    const usdKeywords = [
        "us dollar",
        "u.s. dollar",
        "usd",
        "dollar index",
        "dxy",
        "greenback"
    ];

    // ============================================
    // BOND / YIELD
    // ============================================

    const yieldKeywords = [
        "treasury yield",
        "treasury yields",
        "bond yield",
        "bond yields",
        "10-year yield",
        "10 year yield",
        "10-year treasury",
        "10 year treasury",
        "real yield",
        "real yields"
    ];

    // ============================================
    // GEOPOLITICAL / RISK
    // ============================================

    const riskKeywords = [
        "geopolitical",
        "geopolitics",
        "war",
        "conflict",
        "sanctions",
        "safe haven",
        "risk-off",
        "risk off",
        "risk-on",
        "risk on",
        "middle east",
        "ukraine",
        "russia",
        "china",
        "taiwan"
    ];

    const allKeywords = [
        ...goldKeywords,
        ...fedKeywords,
        ...economyKeywords,
        ...usdKeywords,
        ...yieldKeywords,
        ...riskKeywords
    ];

    return allKeywords.some(keyword =>
        combinedText.includes(keyword)
    );
}


// ==================================================
// NORMALIZE NEWS
// ==================================================

function normalizeNews(item) {
    const title =
        item.title ||
        item.headline ||
        "Untitled News";

    const text =
        item.text ||
        item.content ||
        item.summary ||
        "";

    const publishedDate =
        item.publishedDate ||
        item.date ||
        item.published_at ||
        "";

    const site =
        item.site ||
        item.source ||
        item.publisher ||
        "Unknown";

    const url =
        item.url ||
        item.link ||
        "";

    return {
        title,
        text,
        publishedDate,
        site,
        url,
        category: detectCategory(`${title} ${text}`),
        impact: detectImpact(`${title} ${text}`)
    };
}


// ==================================================
// CATEGORY
// ==================================================

function detectCategory(text) {
    const value = String(text).toLowerCase();

    if (
        value.includes("gold") ||
        value.includes("xau") ||
        value.includes("bullion") ||
        value.includes("precious metal")
    ) {
        return "GOLD";
    }

    if (
        value.includes("federal reserve") ||
        value.includes("fomc") ||
        value.includes("fed chair") ||
        value.includes("powell") ||
        value.includes("interest rate")
    ) {
        return "FED";
    }

    if (
        value.includes("inflation") ||
        value.includes("cpi") ||
        value.includes("pce") ||
        value.includes("ppi") ||
        value.includes("nonfarm payroll") ||
        value.includes("nfp") ||
        value.includes("unemployment")
    ) {
        return "ECONOMY";
    }

    if (
        value.includes("dollar") ||
        value.includes("usd") ||
        value.includes("dxy")
    ) {
        return "USD";
    }

    if (
        value.includes("treasury") ||
        value.includes("yield") ||
        value.includes("bond")
    ) {
        return "YIELD";
    }

    if (
        value.includes("war") ||
        value.includes("conflict") ||
        value.includes("geopolitical") ||
        value.includes("safe haven") ||
        value.includes("risk-off") ||
        value.includes("risk off")
    ) {
        return "RISK";
    }

    return "MARKET";
}


// ==================================================
// IMPACT
// ==================================================

function detectImpact(text) {
    const value = String(text).toLowerCase();

    const highImpactKeywords = [
        "federal reserve",
        "fomc",
        "powell",
        "interest rate",
        "rate cut",
        "rate hike",
        "cpi",
        "pce",
        "nonfarm payroll",
        "nonfarm payrolls",
        "nfp",
        "unemployment",
        "recession"
    ];

    if (
        highImpactKeywords.some(keyword =>
            value.includes(keyword)
        )
    ) {
        return "HIGH";
    }

    return "NORMAL";
}