/* =========================================================
   DASHBOARD.JS
   Forex / Gold Trading Journal Dashboard
   ========================================================= */

/* =========================================================
   SUPABASE
   ========================================================= */

const supabaseUrl = "https://nkhedvvqjqufwblslzmf.supabase.co"
const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5raWVkdnZxanF1ZndibHNsem1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzIwNDgsImV4cCI6MjA4ODU0ODA0OH0.S95sIjZr1WzR1isWh8WNM0uRFxdUQCZm7cNOb2kyeuY"

const client = supabase.createClient(supabaseUrl, supabaseKey)

/* =========================================================
   USER SESSION
   ========================================================= */

let user = null

try {
    user = JSON.parse(localStorage.getItem("user"))
} catch (error) {
    console.error("Invalid user session:", error)
}

if (!user || !user.id) {
    window.location.href = "login.html"
}

/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let equityChart = null
let winChart = null
let pnlChart = null

let currentDate = new Date()
let selectedDate = null

let currentTradesData = []

let isSaving = false
let isDeleting = false
let isResetting = false
let isAiLoading = false

/* =========================================================
   UTILITY
   ========================================================= */

function formatMoney(value) {
    const number = Number(value) || 0

    if (number >= 0) {
        return "$" + number.toFixed(2)
    }

    return "-$" + Math.abs(number).toFixed(2)
}

function formatSignedMoney(value) {
    const number = Number(value) || 0

    if (number > 0) {
        return "+$" + number.toFixed(2)
    }

    if (number < 0) {
        return "-$" + Math.abs(number).toFixed(2)
    }

    return "$0.00"
}

function escapeHTML(value) {
    const div = document.createElement("div")
    div.textContent = value ?? ""
    return div.innerHTML
}

function getElement(id) {
    return document.getElementById(id)
}

/* =========================================================
   LOGOUT
   ========================================================= */

function logout() {
    localStorage.removeItem("user")
    window.location.href = "login.html"
}

/* =========================================================
   VIEW SWITCHER
   ========================================================= */

function switchView(viewType) {
    const calendarCont = getElement("calendarContainer")
    const listCont = getElement("listContainer")

    const btnCal = getElement("btnCalendarView")
    const btnList = getElement("btnListView")

    if (!calendarCont || !listCont) {
        return
    }

    if (viewType === "calendar") {
        calendarCont.style.display = "block"
        listCont.style.display = "none"

        if (btnCal) {
            btnCal.classList.add("active")
        }

        if (btnList) {
            btnList.classList.remove("active")
        }
    } else {
        calendarCont.style.display = "none"
        listCont.style.display = "block"

        if (btnList) {
            btnList.classList.add("active")
        }

        if (btnCal) {
            btnCal.classList.remove("active")
        }

        renderListView()
    }
}

/* =========================================================
   RENDER LIST VIEW
   ========================================================= */

function renderListView() {
    const tradeList = getElement("tradeList")

    if (!tradeList) {
        return
    }

    tradeList.innerHTML = ""

    if (!currentTradesData || currentTradesData.length === 0) {
        tradeList.innerHTML = `
            <div style="
                text-align:center;
                padding:20px;
                opacity:0.5;
                font-size:12px;
            ">
                No trade records found
            </div>
        `
        return
    }

    const sortedData = [...currentTradesData].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    )

    sortedData.forEach((trade) => {
        const pnl = Number(trade.pnl) || 0
        const isWin = pnl >= 0
        const count = Math.abs(Number(trade.trades_count) || 1)

        const item = document.createElement("div")
        item.className = `trade-item ${isWin ? "win-item" : "loss-item"}`
        item.style.cursor = "pointer"

        item.onclick = () => {
            if (trade.date) {
                openModal(trade.date)
            }
        }

        const dateSpan = document.createElement("span")
        dateSpan.textContent = trade.date || "-"

        const pnlSpan = document.createElement("span")
        pnlSpan.style.fontWeight = "700"
        pnlSpan.style.color = isWin ? "#4ade80" : "#f87171"
        pnlSpan.textContent = formatSignedMoney(pnl)

        const countSpan = document.createElement("span")
        countSpan.style.fontSize = "11px"
        countSpan.style.opacity = "0.8"
        countSpan.textContent = `${count} ${count > 1 ? "trades" : "trade"}`

        item.appendChild(dateSpan)
        item.appendChild(pnlSpan)
        item.appendChild(countSpan)

        tradeList.appendChild(item)
    })
}

/* =========================================================
   CALENDAR
   ========================================================= */

async function renderCalendar() {
    const calendar = getElement("calendar")

    if (!calendar) {
        return
    }

    calendar.innerHTML = ""

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const monthYear = getElement("monthYear")

    if (monthYear) {
        monthYear.innerText =
            currentDate.toLocaleString("default", { month: "long" }) +
            " " +
            year
    }

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    let data = null
    let error = null

    try {
        const result = await client
            .from("trades")
            .select("*")
            .eq("user_id", user.id)

        data = result.data
        error = result.error
    } catch (err) {
        console.error("Calendar database error:", err)
        return
    }

    if (error) {
        console.error("Calendar Supabase error:", error)
        showToast("Unable to load calendar data", "error")
        return
    }

    const tradeMap = {}

    if (data) {
        data.forEach((trade) => {
            if (!trade.date) {
                return
            }

            if (!tradeMap[trade.date]) {
                tradeMap[trade.date] = {
                    pnl: 0,
                    count: 0
                }
            }

            tradeMap[trade.date].pnl += Number(trade.pnl) || 0
            tradeMap[trade.date].count += Math.abs(
                Number(trade.trades_count) || 1
            )
        })
    }

    /* Empty cells */
    for (let i = 0; i < firstDay; i++) {
        calendar.appendChild(document.createElement("div"))
    }

    /* Days */
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day)
        const dayOfWeek = dateObj.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

        const dateStr =
            year +
            "-" +
            String(month + 1).padStart(2, "0") +
            "-" +
            String(day).padStart(2, "0")

        const tradeInfo = tradeMap[dateStr]
        const box = document.createElement("div")

        box.className = "day"

        /* -----------------------------------------
           Trade exists
           ----------------------------------------- */
        if (tradeInfo) {
            const pnl = Number(tradeInfo.pnl) || 0
            const count = Math.abs(Number(tradeInfo.count) || 1)

            box.innerHTML = `
                <div class="day-number">
                    ${day}
                </div>

                <div class="day-info">
                    <div class="day-pnl">
                        ${pnl > 0 ? "+" : ""}
                        ${pnl.toFixed(2)}
                    </div>

                    <div class="day-count">
                        ${count}
                        ${count > 1 ? "trades" : "trade"}
                    </div>
                </div>
            `

            if (pnl > 0) {
                box.classList.add("win")
            } else if (pnl < 0) {
                box.classList.add("loss")
            }
        } else {
            box.innerHTML = `
                <div class="day-number">
                    ${day}
                </div>
            `
        }

        /* Weekend */
        if (isWeekend) {
            box.classList.add("disabled-day")
            box.title = "Market Closed (Weekend)"
        } else {
            box.onclick = () => {
                openModal(dateStr)
            }
        }

        calendar.appendChild(box)
    }
}

/* =========================================================
   MODAL
   ========================================================= */

function openModal(date) {
    selectedDate = date

    const modalDate = getElement("modalDate")
    const modal = getElement("tradeModal")

    if (modalDate) {
        modalDate.innerText = date
    }

    if (modal) {
        modal.style.display = "flex"
    }

    loadTrade(date)
}

function closeModal() {
    const modal = getElement("tradeModal")

    if (modal) {
        modal.style.display = "none"
    }
}

/* =========================================================
   AI GOLD NEWS MODAL
   ========================================================= */

function openAiNewsModal() {
    const modal = getElement("aiNewsModal")

    if (!modal) {
        return
    }

    modal.style.display = "flex"
    fetchAndRenderAiNews()
}

function closeAiNewsModal() {
    const modal = getElement("aiNewsModal")

    if (modal) {
        modal.style.display = "none"
    }
}

/* =========================================================
   AI GOLD NEWS
   ========================================================= */

async function fetchAndRenderAiNews() {
    if (isAiLoading) {
        return
    }

    isAiLoading = true

    const summaryText = getElement("aiSummaryText")
    const signalBadge = getElement("aiProbSignal")
    const percentText = getElement("aiProbPercent")
    const fillBar = getElement("aiProbFill")
    const newsContainer = getElement("newsImpactList")

    try {
        showToast("กำลังวิเคราะห์ข่าวทองคำด้วย AI...", "success")

        if (summaryText) {
            summaryText.innerText =
                "กำลังดึงข้อมูลข่าวสดและวิเคราะห์ตลาด XAU/USD..."
        }

        if (signalBadge) {
            signalBadge.innerText = "ANALYZING..."
        }

        if (percentText) {
            percentText.innerText = "..."
        }

        if (fillBar) {
            fillBar.style.width = "0%"
        }

        if (newsContainer) {
            newsContainer.innerHTML = `
                <div style="
                    text-align:center;
                    padding:20px;
                    opacity:.6;
                ">
                    กำลังโหลดข่าวล่าสุด...
                </div>
            `
        }

        /*
         * สำคัญ:
         * dashboard.js ไม่เก็บ API KEY
         * ให้ Backend /api/analyze-gold-news เป็นผู้จัดการ Gemini / FMP API
         */

        const response = await fetch("/api/analyze-gold-news", {
            method: "GET",
            headers: {
                Accept: "application/json"
            },
            cache: "no-store"
        })

        let data = null

        try {
            data = await response.json()
        } catch {
            throw new Error("API returned invalid JSON")
        }

        if (!response.ok) {
            throw new Error(data?.error || `API Error ${response.status}`)
        }

        /*
         * Normalize API response
         */

        const signal = String(data?.signal || "BUY").toUpperCase()
        let probability = Number(data?.probability)

        if (!Number.isFinite(probability)) {
            probability = 50
        }

        probability = Math.max(0, Math.min(100, probability))

        const summary = data?.summary || "ไม่พบข้อมูลวิเคราะห์"
        const events = Array.isArray(data?.events) ? data.events : []

        /* -----------------------------------------
           Signal
           ----------------------------------------- */
        if (signalBadge) {
            if (signal === "BUY") {
                signalBadge.innerText = "BULLISH (BUY)"
            } else if (signal === "SELL") {
                signalBadge.innerText = "BEARISH (SELL)"
            } else {
                signalBadge.innerText = "NEUTRAL"
            }

            signalBadge.className =
                "prob-signal " +
                (signal === "SELL"
                    ? "sell"
                    : signal === "BUY"
                    ? "buy"
                    : "neutral")
        }

        /* -----------------------------------------
           Probability
           ----------------------------------------- */
        if (percentText) {
            percentText.innerText = `${probability.toFixed(0)}%`
        }

        if (fillBar) {
            fillBar.style.width = `${probability}%`
            fillBar.className =
                "prob-bar-fill " +
                (signal === "SELL"
                    ? "sell"
                    : signal === "BUY"
                    ? "buy"
                    : "neutral")
        }

        /* -----------------------------------------
           Summary
           ----------------------------------------- */
        if (summaryText) {
            summaryText.innerText = summary
        }

        /* -----------------------------------------
           News Events
           ----------------------------------------- */
        if (newsContainer) {
            newsContainer.innerHTML = ""

            if (events.length === 0) {
                newsContainer.innerHTML = `
                    <div style="
                        text-align:center;
                        padding:20px;
                        opacity:.6;
                    ">
                        ไม่พบข่าวสำคัญในขณะนี้
                    </div>
                `
            } else {
                events.forEach((news) => {
                    const row = document.createElement("div")
                    row.className = "news-item-row"

                    const left = document.createElement("div")
                    left.className = "news-left-info"

                    const impact = document.createElement("span")
                    impact.className =
                        "news-impact-tag " +
                        String(news?.impact || "medium").toLowerCase()

                    const title = document.createElement("span")
                    title.className = "news-title-text"
                    title.textContent = news?.title || "ข่าวไม่มีชื่อ"

                    left.appendChild(impact)
                    left.appendChild(title)

                    const timeWrap = document.createElement("div")
                    timeWrap.className = "news-time-wrap"

                    const date = document.createElement("span")
                    date.className = "news-date"
                    date.textContent = news?.date || "-"

                    const time = document.createElement("span")
                    time.className = "news-time"
                    time.textContent = news?.time || "-"

                    timeWrap.appendChild(date)
                    timeWrap.appendChild(time)

                    row.appendChild(left)
                    row.appendChild(timeWrap)

                    newsContainer.appendChild(row)
                })
            }
        }

        showToast("AI วิเคราะห์ข่าวสำเร็จ", "success")
    } catch (error) {
        console.error("AI Gold News Error:", error)

        if (summaryText) {
            summaryText.innerText = "ไม่สามารถเชื่อมต่อ AI News API ได้"
        }

        if (signalBadge) {
            signalBadge.innerText = "OFFLINE"
            signalBadge.className = "prob-signal neutral"
        }

        if (percentText) {
            percentText.innerText = "N/A"
        }

        if (fillBar) {
            fillBar.style.width = "0%"
            fillBar.className = "prob-bar-fill neutral"
        }

        if (newsContainer) {
            newsContainer.innerHTML = `
                <div style="
                    text-align:center;
                    padding:20px;
                    color:#f87171;
                ">
                    ไม่สามารถโหลดข้อมูลข่าวได้
                    <br>
                    <small style="opacity:.6;">
                        ${escapeHTML(error.message)}
                    </small>
                </div>
            `
        }

        showToast("เชื่อมต่อ AI News API ไม่สำเร็จ", "error")
    } finally {
        isAiLoading = false
    }
}

/* =========================================================
   LOAD TRADE
   ========================================================= */

async function loadTrade(date) {
    if (!user || !user.id) {
        return
    }

    try {
        const { data, error } = await client
            .from("trades")
            .select("*")
            .eq("user_id", user.id)
            .eq("date", date)
            .limit(1)

        if (error) {
            console.error("Load trade error:", error)
            showToast("Unable to load trade", "error")
            return
        }

        const pnlInput = getElement("pnlInput")
        const tradesCountInput = getElement("tradesCountInput")

        if (data && data.length > 0) {
            if (pnlInput) {
                pnlInput.value = data[0].pnl
            }

            if (tradesCountInput) {
                tradesCountInput.value = data[0].trades_count || 1
            }
        } else {
            if (pnlInput) {
                pnlInput.value = ""
            }

            if (tradesCountInput) {
                tradesCountInput.value = "1"
            }
        }
    } catch (error) {
        console.error("Load trade exception:", error)
    }
}

/* =========================================================
   SAVE TRADE
   ========================================================= */

async function saveTrade() {
    if (isSaving) {
        return
    }

    if (!selectedDate) {
        showToast("Please select a date", "error")
        return
    }

    const pnlInput = getElement("pnlInput")
    const tradesCountInput = getElement("tradesCountInput")

    const pnlInputVal = pnlInput?.value || ""
    const pnl = parseFloat(pnlInputVal)
    const tradesCount =
        Math.abs(parseInt(tradesCountInput?.value)) || 1

    if (pnlInputVal.trim() === "" || !Number.isFinite(pnl)) {
        showToast("Invalid PnL number", "error")
        return
    }

    isSaving = true

    try {
        const { data, error: selectError } = await client
            .from("trades")
            .select("id")
            .eq("user_id", user.id)
            .eq("date", selectedDate)
            .limit(1)

        if (selectError) {
            throw selectError
        }

        let result

        if (data && data.length > 0) {
            result = await client
                .from("trades")
                .update({
                    pnl: pnl,
                    trades_count: tradesCount
                })
                .eq("user_id", user.id)
                .eq("date", selectedDate)
        } else {
            result = await client.from("trades").insert([
                {
                    user_id: user.id,
                    date: selectedDate,
                    pnl: pnl,
                    trades_count: tradesCount
                }
            ])
        }

        if (result.error) {
            throw result.error
        }

        closeModal()
        showToast("Trade Saved 📈", "success")

        await refreshDashboard()
    } catch (error) {
        console.error("Save trade error:", error)
        showToast("Failed to save trade", "error")
    } finally {
        isSaving = false
    }
}

/* =========================================================
   DELETE TRADE
   ========================================================= */

function showDeleteConfirm() {
    const modal = getElement("confirmModal")

    if (modal) {
        modal.style.display = "flex"
    }
}

async function deleteTrade() {
    if (isDeleting || !selectedDate) {
        return
    }

    isDeleting = true

    try {
        const { error } = await client
            .from("trades")
            .delete()
            .eq("user_id", user.id)
            .eq("date", selectedDate)

        if (error) {
            throw error
        }

        const confirmModal = getElement("confirmModal")

        if (confirmModal) {
            confirmModal.style.display = "none"
        }

        closeModal()
        showToast("Trade Deleted", "error")

        await refreshDashboard()
    } catch (error) {
        console.error("Delete trade error:", error)
        showToast("Failed to delete trade", "error")
    } finally {
        isDeleting = false
    }
}

/* =========================================================
   RESET
   ========================================================= */

function resetTrades() {
    const modal = getElement("resetModal")

    if (modal) {
        modal.style.display = "flex"
    }
}

async function confirmReset() {
    if (isResetting) {
        return
    }

    isResetting = true

    try {
        document.body.classList.add("flash")
        showToast("Resetting all trades...", "error")

        const { error } = await client
            .from("trades")
            .delete()
            .eq("user_id", user.id)

        if (error) {
            throw error
        }

        const resetModal = getElement("resetModal")

        if (resetModal) {
            resetModal.style.display = "none"
        }

        await refreshDashboard()
        showToast("All trades reset", "success")
    } catch (error) {
        console.error("Reset error:", error)
        showToast("Failed to reset trades", "error")
    } finally {
        isResetting = false

        setTimeout(() => {
            document.body.classList.remove("flash")
        }, 700)
    }
}

/* =========================================================
   MONTH NAVIGATION
   ========================================================= */

function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1)
    renderCalendar()
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1)
    renderCalendar()
}

/* =========================================================
   LOAD TRADES & METRICS
   ========================================================= */

async function loadTrades() {
    if (!user || !user.id) {
        return
    }

    try {
        const { data, error } = await client
            .from("trades")
            .select("*")
            .eq("user_id", user.id)
            .order("date", { ascending: true })

        if (error) {
            throw error
        }

        currentTradesData = data || []

        /* -----------------------------------------
           EMPTY DATA
           ----------------------------------------- */
        if (!data || data.length === 0) {
            updateMetric("totalPnL", "$0.00")
            updateMetric("winrate", "0%")
            updateMetric("totalTrades", "0")
            updateMetric("maxDD", "$0.00")
            updateMetric("profitFactor", "0.00")
            updateMetric("riskReward", "0.00")
            updateMetric("expectancy", "$0.00")
            updateMetric("strategyScore", "0.0")

            drawEquity([], [])
            drawWin([], [])
            drawPnL([], [])

            if (
                getElement("listContainer") &&
                getElement("listContainer").style.display !== "none"
            ) {
                renderListView()
            }

            return
        }

        /* -----------------------------------------
           VARIABLES
           ----------------------------------------- */
        let labels = []
        let equity = []
        let pnlList = []

        let totalPnL = 0
        let totalTradesCount = 0
        let wins = 0
        let losses = 0
        let grossProfit = 0
        let grossLoss = 0
        let peak = 0
        let maxDD = 0

        /* -----------------------------------------
           PROCESS DATA
           ----------------------------------------- */
        data.forEach((trade) => {
            const pnl = Number(trade.pnl) || 0
            const count = Math.abs(Number(trade.trades_count) || 1)

            pnlList.push(pnl)
            totalPnL += pnl
            totalTradesCount += count
            labels.push(trade.date)
            equity.push(totalPnL)

            if (pnl > 0) {
                wins++
                grossProfit += pnl
            } else if (pnl < 0) {
                losses++
                grossLoss += Math.abs(pnl)
            }

            if (totalPnL > peak) {
                peak = totalPnL
            }

            const dd = peak - totalPnL
            if (dd > maxDD) {
                maxDD = dd
            }
        })

        /* -----------------------------------------
           CALCULATIONS & METRICS
           ----------------------------------------- */
        const winrate =
            data.length > 0 ? ((wins / data.length) * 100).toFixed(1) : 0

        const profitFactor =
            grossLoss > 0
                ? (grossProfit / grossLoss).toFixed(2)
                : grossProfit > 0
                ? "∞"
                : "0.00"

        const avgWin = wins > 0 ? grossProfit / wins : 0
        const avgLoss = losses > 0 ? grossLoss / losses : 0
        const riskReward =
            avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "0.00"

        const winProb = wins / (data.length || 1)
        const lossProb = losses / (data.length || 1)
        const expectancy = winProb * avgWin - lossProb * avgLoss

        // Strategy Score Calculation (0.0 - 10.0 scale)
        let score = 0
        score += Math.min(4, (parseFloat(winrate) / 100) * 4)
        score += Math.min(3, (parseFloat(profitFactor) || 0) * 1.5)
        score += Math.min(3, (parseFloat(riskReward) || 0) * 1.5)
        score = Math.min(10, Math.max(0, score)).toFixed(1)

        /* -----------------------------------------
           UPDATE UI METRICS
           ----------------------------------------- */
        updateMetric("totalPnL", formatSignedMoney(totalPnL))
        updateMetric("winrate", `${winrate}%`)
        updateMetric("totalTrades", totalTradesCount)
        updateMetric("maxDD", formatMoney(maxDD))
        updateMetric("profitFactor", profitFactor)
        updateMetric("riskReward", riskReward)
        updateMetric("expectancy", formatSignedMoney(expectancy))
        updateMetric("strategyScore", score)

        /* -----------------------------------------
           UPDATE CHARTS & LIST
           ----------------------------------------- */
        drawEquity(labels, equity)
        drawWin([wins, losses], ["Wins", "Losses"])
        drawPnL(labels, pnlList)

        if (
            getElement("listContainer") &&
            getElement("listContainer").style.display !== "none"
        ) {
            renderListView()
        }
    } catch (error) {
        console.error("Load trades error:", error)
        showToast("Failed to load trades", "error")
    }
}