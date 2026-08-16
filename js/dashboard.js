const supabaseUrl = "https://nkhedvvqjqufwblslzmf.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJu..."
const client = supabase.createClient(supabaseUrl, supabaseKey)

/* ======================
USER SESSION
====================== */

const user = JSON.parse(localStorage.getItem("user"))

if (!user) {
    window.location = "login.html"
}

/* ======================
GLOBAL VARIABLES
====================== */

let equityChart = null
let winChart = null
let pnlChart = null

let currentDate = new Date()
let selectedDate = null
let currentTradesData = []

/* ======================
NEWS VARIABLES
====================== */

let rawNewsData = []
let currentNewsFilter = "ALL"
let currentNewsDate = null

/* ======================
LOGOUT
====================== */

function logout() {
    localStorage.removeItem("user")
    window.location = "login.html"
}

/* ======================
VIEW SWITCHER
====================== */

function switchView(viewType) {
    const calendarCont = document.getElementById("calendarContainer")
    const listCont = document.getElementById("listContainer")
    const btnCal = document.getElementById("btnCalendarView")
    const btnList = document.getElementById("btnListView")

    if (!calendarCont || !listCont) return

    if (viewType === "calendar") {
        calendarCont.style.display = "block"
        listCont.style.display = "none"

        if (btnCal) btnCal.classList.add("active")
        if (btnList) btnList.classList.remove("active")
    } else {
        calendarCont.style.display = "none"
        listCont.style.display = "block"

        if (btnList) btnList.classList.add("active")
        if (btnCal) btnCal.classList.remove("active")

        renderListView()
    }
}

/* ======================
RENDER LIST VIEW
====================== */

function renderListView() {
    const tradeList = document.getElementById("tradeList")
    if (!tradeList) return

    tradeList.innerHTML = ""

    if (!currentTradesData || currentTradesData.length === 0) {
        tradeList.innerHTML = `
            <div style="text-align:center; padding:20px; opacity:0.5; font-size:12px;">
                No trade records found
            </div>
        `
        return
    }

    const sortedData = [...currentTradesData]
        .sort((a, b) => new Date(b.date) - new Date(a.date))

    sortedData.forEach(trade => {
        const pnl = Number(trade.pnl)
        const isWin = pnl >= 0

        const item = document.createElement("div")

        item.className = `trade-item ${isWin ? "win-item" : "loss-item"}`
        item.style.cursor = "pointer"

        item.onclick = () => openModal(trade.date)

        item.innerHTML = `
            <span>${trade.date}</span>

            <span style="
                font-weight:700;
                color:${isWin ? "#4ade80" : "#f87171"}
            ">
                ${isWin ? "+" : ""}$${pnl.toFixed(2)}
            </span>

            <span style="font-size:11px; opacity:0.8;">
                ${trade.trades_count || 1}
                ${trade.trades_count > 1 ? "trades" : "trade"}
            </span>
        `

        tradeList.appendChild(item)
    })
}

/* ======================
CALENDAR
====================== */

async function renderCalendar() {
    const calendar = document.getElementById("calendar")

    if (!calendar) return

    calendar.innerHTML = ""

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const monthYear = document.getElementById("monthYear")

    if (monthYear) {
        monthYear.innerText =
            currentDate.toLocaleString("default", {
                month: "long"
            }) + " " + year
    }

    const firstDay =
        new Date(year, month, 1).getDay()

    const daysInMonth =
        new Date(year, month + 1, 0).getDate()

    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)

    const tradeMap = {}

    if (data) {
        data.forEach(t => {
            if (!tradeMap[t.date]) {
                tradeMap[t.date] = {
                    pnl: 0,
                    count: 0
                }
            }

            tradeMap[t.date].pnl += Number(t.pnl)
            tradeMap[t.date].count += Number(
                t.trades_count || 1
            )
        })
    }

    for (let i = 0; i < firstDay; i++) {
        calendar.appendChild(
            document.createElement("div")
        )
    }

    for (let day = 1; day <= daysInMonth; day++) {

        const dateObj = new Date(year, month, day)
        const dayOfWeek = dateObj.getDay()

        const isWeekend =
            dayOfWeek === 0 ||
            dayOfWeek === 6

        const dateStr =
            year + "-" +
            String(month + 1).padStart(2, "0") + "-" +
            String(day).padStart(2, "0")

        const tradeInfo = tradeMap[dateStr]

        const box = document.createElement("div")

        box.className = "day"

        if (tradeInfo) {

            const pnl = tradeInfo.pnl
            const count = Math.abs(
                tradeInfo.count
            )

            box.innerHTML = `
                <div class="day-number">
                    ${day}
                </div>

                <div class="day-info">
                    <div class="day-pnl">
                        ${(pnl > 0 ? "+" : "") +
                pnl.toFixed(2)}
                    </div>

                    <div class="day-count">
                        ${count}
                        ${count > 1 ? "trades" : "trade"}
                    </div>
                </div>
            `

            if (pnl > 0) {
                box.classList.add("win")
            }

            if (pnl < 0) {
                box.classList.add("loss")
            }

        } else {

            box.innerHTML = `
                <div class="day-number">
                    ${day}
                </div>
            `
        }

        if (isWeekend) {

            box.classList.add("disabled-day")
            box.title = "Market Closed (Weekend)"

        } else {

            box.onclick = () =>
                openModal(dateStr)
        }

        calendar.appendChild(box)
    }
}

/* ======================
TRADE MODAL
====================== */

function openModal(date) {

    selectedDate = date

    document.getElementById(
        "modalDate"
    ).innerText = date

    document.getElementById(
        "tradeModal"
    ).style.display = "flex"

    loadTrade(date)
}

function closeModal() {

    document.getElementById(
        "tradeModal"
    ).style.display = "none"
}

/* ======================
LOAD TRADE
====================== */

async function loadTrade(date) {

    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)

    if (data && data.length > 0) {

        document.getElementById(
            "pnlInput"
        ).value = data[0].pnl

        document.getElementById(
            "tradesCountInput"
        ).value =
            data[0].trades_count || 1

    } else {

        document.getElementById(
            "pnlInput"
        ).value = ""

        document.getElementById(
            "tradesCountInput"
        ).value = "1"
    }
}

/* ======================
SAVE TRADE
====================== */

async function saveTrade() {

    const pnlInputVal =
        document.getElementById(
            "pnlInput"
        ).value

    const pnl = parseFloat(pnlInputVal)

    const tradesCount =
        Math.abs(
            parseInt(
                document.getElementById(
                    "tradesCountInput"
                ).value
            )
        ) || 1

    if (
        isNaN(pnl) ||
        pnlInputVal.trim() === ""
    ) {

        showToast(
            "Invalid PnL number",
            "error"
        )

        return
    }

    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", selectedDate)

    if (data && data.length > 0) {

        await client
            .from("trades")
            .update({
                pnl: pnl,
                trades_count: tradesCount
            })
            .eq("user_id", user.id)
            .eq("date", selectedDate)

    } else {

        await client
            .from("trades")
            .insert([
                {
                    user_id: user.id,
                    date: selectedDate,
                    pnl: pnl,
                    trades_count: tradesCount
                }
            ])
    }

    closeModal()

    showToast(
        "Trade Saved 📈",
        "success"
    )

    await refreshDashboard()
}

/* ======================
DELETE TRADE
====================== */

function showDeleteConfirm() {

    document.getElementById(
        "confirmModal"
    ).style.display = "flex"
}

async function deleteTrade() {

    if (!selectedDate) return

    await client
        .from("trades")
        .delete()
        .eq("user_id", user.id)
        .eq("date", selectedDate)

    document.getElementById(
        "confirmModal"
    ).style.display = "none"

    closeModal()

    showToast(
        "Trade Deleted",
        "error"
    )

    await refreshDashboard()
}

/* ======================
RESET
====================== */

function resetTrades() {

    document.getElementById(
        "resetModal"
    ).style.display = "flex"
}

async function confirmReset() {

    document.body.classList.add(
        "flash"
    )

    showToast(
        "Resetting all trades...",
        "error"
    )

    await client
        .from("trades")
        .delete()
        .eq("user_id", user.id)

    document.getElementById(
        "resetModal"
    ).style.display = "none"

    await refreshDashboard()
}

/* ======================
MONTH NAVIGATION
====================== */

function prevMonth() {

    currentDate.setMonth(
        currentDate.getMonth() - 1
    )

    renderCalendar()
}

function nextMonth() {

    currentDate.setMonth(
        currentDate.getMonth() + 1
    )

    renderCalendar()
}

/* ======================
LOAD TRADES & METRICS
====================== */

async function loadTrades() {

    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("date", {
            ascending: true
        })

    currentTradesData = data || []

    if (!data || data.length === 0) {

        document.getElementById(
            "totalPnL"
        ).innerText = "$0.00"

        document.getElementById(
            "winrate"
        ).innerText = "0%"

        document.getElementById(
            "totalTrades"
        ).innerText = "0"

        document.getElementById(
            "maxDD"
        ).innerText = "$0.00"

        document.getElementById(
            "profitFactor"
        ).innerText = "0.00"

        document.getElementById(
            "riskReward"
        ).innerText = "0.00"

        document.getElementById(
            "expectancy"
        ).innerText = "$0.00"

        document.getElementById(
            "strategyScore"
        ).innerText = "0.0"

        drawEquity([], [])
        drawWin([], [])
        drawPnL([], [])

        if (
            document.getElementById(
                "listContainer"
            )?.style.display !== "none"
        ) {
            renderListView()
        }

        return
    }

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

    data.forEach(t => {

        const pnl = Number(t.pnl)

        const count =
            Number(
                t.trades_count || 1
            )

        pnlList.push(pnl)

        totalPnL += pnl

        totalTradesCount += count

        labels.push(t.date)

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

        const dd =
            peak - totalPnL

        if (dd > maxDD) {
            maxDD = dd
        }
    })

    const winrate =
        (wins / data.length) * 100

    const profitFactor =
        grossLoss > 0
            ? grossProfit / grossLoss
            : grossProfit

    const avgWin =
        wins > 0
            ? grossProfit / wins
            : 0

    const avgLoss =
        losses > 0
            ? grossLoss / losses
            : 0

    const riskReward =
        avgLoss > 0
            ? avgWin / avgLoss
            : avgWin

    const winRateDec =
        wins / data.length

    const lossRateDec =
        losses / data.length

    const expectancy =
        (winRateDec * avgWin) -
        (lossRateDec * avgLoss)

    let strategyScore = 0

    if (data.length > 0) {

        const pfScore =
            Math.min(
                profitFactor / 2,
                1
            ) * 40

        const wrScore =
            (winrate / 100) * 40

        const ddPenalty =
            peak > 0
                ? Math.min(
                    maxDD / peak,
                    1
                ) * 20
                : 0

        strategyScore =
            Math.max(
                0,
                pfScore +
                wrScore +
                (20 - ddPenalty)
            )
    }

    document.getElementById(
        "totalPnL"
    ).innerText =
        "$" + totalPnL.toFixed(2)

    document.getElementById(
        "winrate"
    ).innerText =
        winrate.toFixed(1) + "%"

    document.getElementById(
        "totalTrades"
    ).innerText =
        totalTradesCount

    document.getElementById(
        "maxDD"
    ).innerText =
        "$" + maxDD.toFixed(2)

    document.getElementById(
        "profitFactor"
    ).innerText =
        profitFactor.toFixed(2)

    document.getElementById(
        "riskReward"
    ).innerText =
        riskReward.toFixed(2)

    document.getElementById(
        "expectancy"
    ).innerText =
        (expectancy >= 0
            ? "$"
            : "-$") +
        Math.abs(
            expectancy
        ).toFixed(2)

    document.getElementById(
        "strategyScore"
    ).innerText =
        strategyScore.toFixed(1)

    drawEquity(
        labels,
        equity
    )

    drawWin(
        labels,
        pnlList
    )

    drawPnL(
        labels,
        pnlList
    )

    if (
        document.getElementById(
            "listContainer"
        )?.style.display !== "none"
    ) {
        renderListView()
    }
}

/* ======================
CHARTS
====================== */

function drawEquity(labels, data) {

    if (equityChart) {
        equityChart.destroy()
    }

    const ctx =
        document.getElementById(
            "equityChart"
        )?.getContext("2d")

    if (!ctx) return

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            200
        )

    gradient.addColorStop(
        0,
        "rgba(34, 197, 94, 0.4)"
    )

    gradient.addColorStop(
        1,
        "rgba(34, 197, 94, 0.0)"
    )

    equityChart =
        new Chart(ctx, {

            type: "line",

            data: {
                labels,

                datasets: [{
                    label: "Equity ($)",
                    data,

                    borderColor:
                        "#22c55e",

                    borderWidth: 2.5,

                    backgroundColor:
                        gradient,

                    fill: true,

                    tension: 0.3,

                    pointBackgroundColor:
                        "#22c55e",

                    pointRadius:
                        data.length === 1
                            ? 5
                            : 3,

                    pointHoverRadius: 6
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {
                        callbacks: {
                            label:
                                ctx =>
                                    ` Equity: $${ctx.raw.toFixed(2)}`
                        }
                    }
                },

                scales: {

                    x: {
                        grid: {
                            color:
                                "rgba(255,255,255,0.05)"
                        },

                        ticks: {
                            color: "#94a3b8"
                        }
                    },

                    y: {
                        grid: {
                            color:
                                "rgba(255,255,255,0.05)"
                        },

                        ticks: {
                            color: "#94a3b8",

                            callback:
                                v => "$" + v
                        },

                        beginAtZero: true
                    }
                }
            }
        })
}

function drawWin(labels, pnlList) {

    if (winChart) {
        winChart.destroy()
    }

    const ctx =
        document.getElementById(
            "winChart"
        )?.getContext("2d")

    if (!ctx) return

    let wins = 0
    let winrateData = []

    pnlList.forEach(
        (pnl, i) => {

            if (pnl > 0) {
                wins++
            }

            winrateData.push(
                (
                    (wins / (i + 1)) *
                    100
                ).toFixed(1)
            )
        }
    )

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            200
        )

    gradient.addColorStop(
        0,
        "rgba(56, 189, 248, 0.3)"
    )

    gradient.addColorStop(
        1,
        "rgba(56, 189, 248, 0.0)"
    )

    winChart =
        new Chart(ctx, {

            type: "line",

            data: {

                labels,

                datasets: [{
                    label:
                        "Winrate (%)",

                    data:
                        winrateData,

                    borderColor:
                        "#38bdf8",

                    borderWidth: 2.5,

                    backgroundColor:
                        gradient,

                    fill: true,

                    tension: 0.3,

                    pointBackgroundColor:
                        "#38bdf8",

                    pointRadius:
                        winrateData.length === 1
                            ? 5
                            : 3
                }]
            },

            options: {

                responsive: true,
                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {

                        callbacks: {

                            label:
                                ctx =>
                                    ` Winrate: ${ctx.raw}%`
                        }
                    }
                },

                scales: {

                    x: {

                        grid: {
                            color:
                                "rgba(255,255,255,0.05)"
                        },

                        ticks: {
                            color:
                                "#94a3b8"
                        }
                    },

                    y: {

                        min: 0,
                        max: 100,

                        grid: {
                            color:
                                "rgba(255,255,255,0.05)"
                        },

                        ticks: {

                            color:
                                "#94a3b8",

                            callback:
                                v => v + "%"
                        }
                    }
                }
            }
        })
}

function drawPnL(labels, data) {

    if (pnlChart) {
        pnlChart.destroy()
    }

    const ctx =
        document.getElementById(
            "pnlChart"
        )?.getContext("2d")

    if (!ctx) return

    const winGradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            200
        )

    winGradient.addColorStop(
        0,
        "rgba(34,197,94,0.95)"
    )

    winGradient.addColorStop(
        1,
        "rgba(34,197,94,0.2)"
    )

    const lossGradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            200
        )

    lossGradient.addColorStop(
        0,
        "rgba(239,68,68,0.2)"
    )

    lossGradient.addColorStop(
        1,
        "rgba(239,68,68,0.95)"
    )

    const formattedLabels =
        labels.map(dateStr => {

            if (!dateStr) return ""

            const parts =
                dateStr.split("-")

            if (parts.length === 3) {

                const dateObj =
                    new Date(
                        parts[0],
                        parts[1] - 1,
                        parts[2]
                    )

                return dateObj.toLocaleDateString(
                    "th-TH",
                    {
                        day: "numeric",
                        month: "short"
                    }
                )
            }

            return dateStr
        })

    pnlChart =
        new Chart(ctx, {

            type: "bar",

            data: {

                labels:
                    formattedLabels,

                datasets: [{

                    label:
                        "PnL ($)",

                    data,

                    backgroundColor:
                        data.map(
                            v =>
                                v >= 0
                                    ? winGradient
                                    : lossGradient
                        ),

                    borderColor:
                        data.map(
                            v =>
                                v >= 0
                                    ? "#22c55e"
                                    : "#ef4444"
                        ),

                    borderWidth: 1.5,

                    borderRadius: 6,

                    maxBarThickness: 38
                }]
            },

            options: {

                responsive: true,
                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {

                        callbacks: {

                            label:
                                ctx =>
                                    ctx.raw >= 0
                                        ? ` PnL: +$${ctx.raw.toFixed(2)}`
                                        : ` PnL: -$${Math.abs(ctx.raw).toFixed(2)}`
                        }
                    }
                },

                scales: {

                    x: {

                        grid: {
                            display: false
                        },

                        ticks: {
                            color:
                                "#cbd5e1"
                        }
                    },

                    y: {

                        grid: {
                            color:
                                "rgba(255,255,255,0.05)"
                        },

                        ticks: {

                            color:
                                "#94a3b8",

                            callback:
                                v =>
                                    v >= 0
                                        ? "$" + v
                                        : "-$" + Math.abs(v)
                        }
                    }
                }
            }
        })
}

/* ======================
REFRESH & INIT
====================== */

async function refreshDashboard() {

    await renderCalendar()

    await loadTrades()
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await refreshDashboard()

        createParticles()

        document.getElementById(
            "saveTrade"
        ).onclick = saveTrade

        document.getElementById(
            "deleteTrade"
        ).onclick =
            showDeleteConfirm

        document.getElementById(
            "confirmDeleteBtn"
        ).onclick =
            deleteTrade

        document.getElementById(
            "cancelDeleteBtn"
        ).onclick = () => {

            document.getElementById(
                "confirmModal"
            ).style.display = "none"
        }

        document.getElementById(
            "confirmResetBtn"
        ).onclick =
            confirmReset

        document.getElementById(
            "cancelResetBtn"
        ).onclick = () => {

            document.getElementById(
                "resetModal"
            ).style.display = "none"
        }
    }
)

/* =========================
TOAST & PARTICLES
========================= */

function showToast(
    text,
    type = "success"
) {

    const toast =
        document.getElementById(
            "toast"
        )

    const toastText =
        document.getElementById(
            "toastText"
        )

    if (!toast || !toastText) {
        return
    }

    toastText.innerText = text

    toast.classList.remove(
        "success",
        "error"
    )

    toast.classList.add(
        type,
        "show"
    )

    setTimeout(
        () => {
            toast.classList.remove(
                "show"
            )
        },
        3000
    )
}

function createParticles() {

    for (
        let i = 0;
        i < 25;
        i++
    ) {

        const p =
            document.createElement(
                "div"
            )

        p.className =
            "particle"

        p.style.left =
            Math.random() * 100 + "%"

        p.style.animationDuration =
            (10 +
                Math.random() * 20) +
            "s"

        document.body.appendChild(p)
    }
}


/* =========================================================
   XAU/USD FINANCIAL NEWS CENTER
========================================================= */

function getBangkokDate() {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Bangkok",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(new Date())
}


/* ======================
OPEN NEWS MODAL
====================== */

function openNewsModal(
    selectedDateStr
) {

    const modal =
        document.getElementById(
            "newsModal"
        )

    const datePicker =
        document.getElementById(
            "newsDatePicker"
        )

    if (!modal) return

    modal.style.display =
        "flex"

    if (datePicker) {

        if (selectedDateStr) {

            datePicker.value =
                selectedDateStr

        } else {

            datePicker.value =
                getBangkokDate()
        }
    }

    currentNewsFilter = "ALL"

    createNewsFilters()

    fetchEconomicNews()
}


/* ======================
CLOSE NEWS MODAL
====================== */

function closeNewsModal() {

    const modal =
        document.getElementById(
            "newsModal"
        )

    if (modal) {
        modal.style.display =
            "none"
    }
}


/* ======================
FETCH NEWS
====================== */

async function fetchEconomicNews() {

    const datePicker =
        document.getElementById(
            "newsDatePicker"
        )

    const tbody =
        document.getElementById(
            "newsTableBody"
        )

    if (!datePicker || !tbody) {
        return
    }

    const selectedDate =
        datePicker.value ||
        getBangkokDate()

    currentNewsDate =
        selectedDate

    tbody.innerHTML = `
        <tr>
            <td colspan="6"
                style="
                    text-align:center;
                    opacity:0.6;
                    padding:30px;
                ">
                ⏳ Loading financial news...
            </td>
        </tr>
    `

    try {

        const response =
            await fetch(
                `/api/news?date=${encodeURIComponent(
                    selectedDate
                )}&limit=100`
            )

        const result =
            await response.json()

        if (!response.ok) {

            throw new Error(
                result.error ||
                "News API request failed"
            )
        }

        if (!result.success) {

            throw new Error(
                result.error ||
                "Unable to load news"
            )
        }

        rawNewsData =
            Array.isArray(
                result.news
            )
                ? result.news
                : []

        renderNewsTable()

    } catch (error) {

        console.error(
            "News Fetch Error:",
            error
        )

        rawNewsData = []

        tbody.innerHTML = `
            <tr>
                <td colspan="6"
                    style="
                        text-align:center;
                        padding:30px;
                        color:#f87171;
                    ">
                    ❌ ${escapeHtml(
            error.message
        )}
                </td>
            </tr>
        `
    }
}


/* ======================
CREATE FILTER BUTTONS
====================== */

function createNewsFilters() {

    const existing =
        document.getElementById(
            "newsFilterButtons"
        )

    if (existing) {
        existing.remove()
    }

    const datePicker =
        document.getElementById(
            "newsDatePicker"
        )

    if (!datePicker) return

    const container =
        document.createElement(
            "div"
        )

    container.id =
        "newsFilterButtons"

    container.style.cssText = `
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:12px;
        margin-bottom:12px;
    `

    const filters = [
        ["ALL", "📰 All"],
        ["GOLD", "🟡 Gold"],
        ["USD", "💵 USD"],
        ["FED", "🏦 Fed"],
        ["ECONOMY", "📊 Economy"],
        ["YIELD", "📈 Yield"],
        ["RISK", "🌍 Risk"]
    ]

    filters.forEach(
        ([value, label]) => {

            const button =
                document.createElement(
                    "button"
                )

            button.type = "button"

            button.innerText =
                label

            button.dataset.filter =
                value

            button.style.cssText = `
                border:1px solid rgba(148,163,184,0.25);
                background:rgba(15,23,42,0.75);
                color:#cbd5e1;
                padding:7px 12px;
                border-radius:8px;
                cursor:pointer;
                font-size:12px;
                transition:0.2s;
            `

            if (
                value ===
                currentNewsFilter
            ) {
                setNewsFilterButtonActive(
                    button,
                    true
                )
            }

            button.onclick = () => {

                currentNewsFilter =
                    value

                document
                    .querySelectorAll(
                        "#newsFilterButtons button"
                    )
                    .forEach(
                        btn =>
                            setNewsFilterButtonActive(
                                btn,
                                btn.dataset.filter ===
                                value
                            )
                    )

                renderNewsTable()
            }

            container.appendChild(
                button
            )
        }
    )

    datePicker.parentNode.insertBefore(
        container,
        datePicker.nextSibling
    )
}


/* ======================
FILTER BUTTON STYLE
====================== */

function setNewsFilterButtonActive(
    button,
    active
) {

    if (active) {

        button.style.background =
            "rgba(56,189,248,0.18)"

        button.style.borderColor =
            "rgba(56,189,248,0.6)"

        button.style.color =
            "#7dd3fc"

    } else {

        button.style.background =
            "rgba(15,23,42,0.75)"

        button.style.borderColor =
            "rgba(148,163,184,0.25)"

        button.style.color =
            "#cbd5e1"
    }
}


/* ======================
FILTER NEWS DATA
====================== */

function getFilteredNews() {

    if (
        currentNewsFilter ===
        "ALL"
    ) {
        return rawNewsData
    }

    return rawNewsData.filter(
        item =>
            item.category ===
            currentNewsFilter
    )
}


/* ======================
RENDER NEWS TABLE
====================== */

function renderNewsTable() {

    const tbody =
        document.getElementById(
            "newsTableBody"
        )

    if (!tbody) return

    const news =
        getFilteredNews()

    if (
        !rawNewsData ||
        rawNewsData.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6"
                    style="
                        text-align:center;
                        padding:30px;
                        opacity:0.6;
                    ">
                    📰 No relevant financial news found for this date.
                </td>
            </tr>
        `

        updateNewsActionButtons()

        return
    }

    if (news.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6"
                    style="
                        text-align:center;
                        padding:30px;
                        opacity:0.6;
                    ">
                    No ${escapeHtml(
            currentNewsFilter
        )} news found.
                </td>
            </tr>
        `

        updateNewsActionButtons()

        return
    }

    tbody.innerHTML =
        news.map(
            (item, index) => {

                const time =
                    formatNewsTime(
                        item.publishedDate
                    )

                const category =
                    item.category ||
                    "MARKET"

                const impact =
                    item.impact ||
                    "NORMAL"

                const title =
                    escapeHtml(
                        item.title ||
                        "Untitled News"
                    )

                const site =
                    escapeHtml(
                        item.site ||
                        "Unknown"
                    )

                const url =
                    sanitizeUrl(
                        item.url
                    )

                return `
                    <tr>

                        <td style="
                            white-space:nowrap;
                            vertical-align:top;
                        ">
                            ${time}
                        </td>

                        <td style="
                            vertical-align:top;
                        ">
                            <span
                                class="news-category-badge"
                                style="
                                    display:inline-block;
                                    padding:4px 7px;
                                    border-radius:6px;
                                    font-size:10px;
                                    font-weight:700;
                                "
                            >
                                ${escapeHtml(
                    category
                )}
                            </span>
                        </td>

                        <td style="
                            vertical-align:top;
                            min-width:300px;
                        ">

                            ${url
                        ? `
                                    <a
                                        href="${url}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style="
                                            color:inherit;
                                            text-decoration:none;
                                            font-weight:600;
                                        "
                                    >
                                        ${title}
                                    </a>
                                    `
                        :
                        `<span style="font-weight:600;">
                                        ${title}
                                    </span>`
                    }

                            <div style="
                                margin-top:6px;
                                font-size:11px;
                                opacity:0.55;
                            ">
                                ${site}
                            </div>

                        </td>

                        <td style="
                            vertical-align:top;
                        ">
                            <span style="
                                display:inline-block;
                                padding:4px 7px;
                                border-radius:6px;
                                font-size:10px;
                                font-weight:700;
                                color:${impact === "HIGH"
                        ? "#fca5a5"
                        : "#cbd5e1"
                    };
                                background:${impact === "HIGH"
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(148,163,184,0.10)"
                    };
                            ">
                                ${impact === "HIGH"
                        ? "🔴 HIGH"
                        : "NORMAL"
                    }
                            </span>
                        </td>

                        <td style="
                            vertical-align:top;
                        ">
                            <button
                                onclick="copySingleNews(${index})"
                                style="
                                    border:0;
                                    background:rgba(56,189,248,0.12);
                                    color:#7dd3fc;
                                    border-radius:6px;
                                    padding:6px 8px;
                                    cursor:pointer;
                                    font-size:11px;
                                "
                            >
                                📋
                            </button>
                        </td>

                        <td style="
                            vertical-align:top;
                        ">
                            ${url
                        ? `
                                    <a
                                        href="${url}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style="
                                            font-size:11px;
                                            color:#94a3b8;
                                        "
                                    >
                                        Open
                                    </a>
                                    `
                        : "-"
                    }
                        </td>

                    </tr>
                `
            }
        ).join("")

    updateNewsActionButtons()
}


/* ======================
FORMAT NEWS TIME
====================== */

function formatNewsTime(
    dateString
) {

    if (!dateString) {
        return "--:--"
    }

    const date =
        new Date(dateString)

    if (isNaN(date.getTime())) {
        return "--:--"
    }

    return date.toLocaleTimeString(
        "th-TH",
        {
            timeZone:
                "Asia/Bangkok",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    )
}


/* ======================
COPY SINGLE NEWS
====================== */

async function copySingleNews(
    index
) {

    const news =
        getFilteredNews()

    const item =
        news[index]

    if (!item) return

    const text =
        buildNewsText(
            [item]
        )

    try {

        await navigator.clipboard.writeText(
            text
        )

        showToast(
            "News copied 📋",
            "success"
        )

    } catch (error) {

        fallbackCopyText(text)

        showToast(
            "News copied 📋",
            "success"
        )
    }
}


/* ======================
COPY ALL NEWS FOR AI
====================== */

async function copyNewsForAI() {

    const news =
        getFilteredNews()

    if (
        !news ||
        news.length === 0
    ) {

        showToast(
            "No news to copy",
            "error"
        )

        return
    }

    const text =
        buildNewsText(
            news
        )

    try {

        await navigator.clipboard.writeText(
            text
        )

        showToast(
            `${news.length} news copied for AI 🤖`,
            "success"
        )

    } catch (error) {

        fallbackCopyText(text)

        showToast(
            `${news.length} news copied for AI 🤖`,
            "success"
        )
    }
}


/* ======================
BUILD AI PROMPT
====================== */

function buildNewsText(
    news
) {

    const date =
        currentNewsDate ||
        getBangkokDate()

    let output = ""

    output +=
        "XAU/USD MARKET NEWS ANALYSIS\n"

    output +=
        "Date: " + date + "\n"

    output +=
        "Timezone: Asia/Bangkok\n"

    output +=
        "News Count: " +
        news.length +
        "\n\n"

    output +=
        "========================================\n"

    output +=
        "NEWS DATA\n"

    output +=
        "========================================\n\n"

    news.forEach(
        (item, index) => {

            output +=
                `NEWS ${index + 1}\n`

            output +=
                `Headline: ${item.title || "-"}\n`

            output +=
                `Category: ${item.category || "-"}\n`

            output +=
                `Impact: ${item.impact || "-"}\n`

            output +=
                `Source: ${item.site || "-"}\n`

            output +=
                `Published: ${item.publishedDate || "-"}\n`

            output +=
                `URL: ${item.url || "-"}\n`

            if (item.text) {

                output +=
                    `Summary: ${item.text}\n`
            }

            output += "\n"
        }
    )

    output +=
        "========================================\n"

    output +=
        "AI ANALYSIS REQUEST\n"

    output +=
        "========================================\n\n"

    output +=
        "Analyze the above financial news specifically for XAU/USD (Gold).\n\n"

    output +=
        "Focus on:\n"

    output +=
        "1. Federal Reserve / FOMC\n"

    output +=
        "2. US Dollar / DXY\n"

    output +=
        "3. US Treasury Yields\n"

    output +=
        "4. Real Yields\n"

    output +=
        "5. Inflation / CPI / PCE / PPI\n"

    output +=
        "6. Employment / NFP / Unemployment\n"

    output +=
        "7. Interest Rate Expectations\n"

    output +=
        "8. Risk-On / Risk-Off sentiment\n"

    output +=
        "9. Geopolitical Risk\n"

    output +=
        "10. Safe-Haven Demand\n\n"

    output +=
        "Please provide:\n"

    output +=
        "- Overall XAU/USD Bias: Bullish / Bearish / Neutral\n"

    output +=
        "- Short-term impact on Gold\n"

    output +=
        "- Key bullish factors\n"

    output +=
        "- Key bearish factors\n"

    output +=
        "- Most important news\n"

    output +=
        "- USD impact\n"

    output +=
        "- Yield impact\n"

    output +=
        "- Fed impact\n"

    output +=
        "- Expected market reaction\n"

    output +=
        "- Confidence percentage\n\n"

    output +=
        "Important: Do not blindly assume every headline is bullish or bearish for Gold. Explain the reasoning and distinguish direct market impact from secondary effects."

    return output
}


/* ======================
UPDATE NEWS ACTION BUTTONS
====================== */

function updateNewsActionButtons() {

    const existing =
        document.getElementById(
            "newsActionButtons"
        )

    if (existing) {
        existing.remove()
    }

    const modalContent =
        document.querySelector(
            ".news-modal-content"
        )

    if (!modalContent) return

    const buttons =
        document.createElement(
            "div"
        )

    buttons.id =
        "newsActionButtons"

    buttons.style.cssText = `
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:15px;
    `

    buttons.innerHTML = `
        <button
            type="button"
            onclick="copyNewsForAI()"
            style="
                flex:1;
                min-width:160px;
                border:1px solid rgba(56,189,248,0.4);
                background:rgba(56,189,248,0.12);
                color:#7dd3fc;
                padding:10px 14px;
                border-radius:8px;
                cursor:pointer;
                font-weight:700;
            "
        >
            📋 Copy News for AI
        </button>

        <button
            type="button"
            onclick="openGemini()"
            style="
                flex:1;
                min-width:120px;
                border:1px solid rgba(167,139,250,0.4);
                background:rgba(167,139,250,0.12);
                color:#c4b5fd;
                padding:10px 14px;
                border-radius:8px;
                cursor:pointer;
                font-weight:700;
            "
        >
            🤖 Gemini
        </button>

        <button
            type="button"
            onclick="openChatGPT()"
            style="
                flex:1;
                min-width:120px;
                border:1px solid rgba(74,222,128,0.35);
                background:rgba(74,222,128,0.10);
                color:#86efac;
                padding:10px 14px;
                border-radius:8px;
                cursor:pointer;
                font-weight:700;
            "
        >
            💬 ChatGPT
        </button>
    `

    const modalButtons =
        modalContent.querySelector(
            ".modal-buttons"
        )

    if (modalButtons) {

        modalContent.insertBefore(
            buttons,
            modalButtons
        )

    } else {

        modalContent.appendChild(
            buttons
        )
    }
}


/* ======================
OPEN GEMINI
====================== */

function openGemini() {

    window.open(
        "https://gemini.google.com/",
        "_blank",
        "noopener,noreferrer"
    )

    showToast(
        "Gemini opened 🤖",
        "success"
    )
}


/* ======================
OPEN CHATGPT
====================== */

function openChatGPT() {

    window.open(
        "https://chatgpt.com/",
        "_blank",
        "noopener,noreferrer"
    )

    showToast(
        "ChatGPT opened 💬",
        "success"
    )
}


/* ======================
COPY FALLBACK
====================== */

function fallbackCopyText(
    text
) {

    const textarea =
        document.createElement(
            "textarea"
        )

    textarea.value = text

    textarea.style.position =
        "fixed"

    textarea.style.opacity =
        "0"

    document.body.appendChild(
        textarea
    )

    textarea.focus()

    textarea.select()

    document.execCommand(
        "copy"
    )

    textarea.remove()
}


/* ======================
ESCAPE HTML
====================== */

function escapeHtml(
    value
) {

    if (value === null ||
        value === undefined) {
        return ""
    }

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        )
}


/* ======================
SAFE URL
====================== */

function sanitizeUrl(
    value
) {

    if (!value) return ""

    try {

        const url =
            new URL(value)

        if (
            url.protocol ===
            "https:" ||
            url.protocol ===
            "http:"
        ) {
            return url.href
        }

    } catch (error) {

        return ""
    }

    return ""
}