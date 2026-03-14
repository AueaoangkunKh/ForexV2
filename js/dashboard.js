const supabaseUrl = "https://nkhedvvqjqufwblslzmf.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5raGVkdnZxanF1ZndibHNsem1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzIwNDgsImV4cCI6MjA4ODU0ODA0OH0.S95sIjZr1WzR1isWh8WNM0uRFxdUQCZm7cNOb2kyeuY"

const client = supabase.createClient(supabaseUrl, supabaseKey)

/* ======================
USER SESSION
====================== */

const user = JSON.parse(localStorage.getItem("user"))

if (!user) {
    window.location = "login.html"
}

/* ======================
GLOBAL
====================== */

let equityChart = null
let winChart = null
let pnlChart = null

let currentDate = new Date()
let selectedDate = null

/* ======================
LOGOUT
====================== */

function logout() {

    localStorage.removeItem("user")

    window.location = "login.html"

}

/* ======================
CALENDAR
====================== */

async function renderCalendar() {

    const calendar = document.getElementById("calendar")

    calendar.innerHTML = ""

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    document.getElementById("monthYear").innerText =
        currentDate.toLocaleString("default", { month: "long" }) + " " + year

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)

    const tradeMap = {}

    data.forEach(t => {

        if (!tradeMap[t.date]) tradeMap[t.date] = 0

        tradeMap[t.date] += Number(t.pnl)

    })

    for (let i = 0; i < firstDay; i++) {

        calendar.appendChild(document.createElement("div"))

    }

    for (let day = 1; day <= daysInMonth; day++) {

        const dateStr =
            year + "-" +
            String(month + 1).padStart(2, "0") + "-" +
            String(day).padStart(2, "0")

        const pnl = tradeMap[dateStr]

        const box = document.createElement("div")

        box.className = "day"

        box.innerHTML = `
        <div class="day-number">${day}</div>
        <div class="day-pnl">${pnl ? (pnl > 0 ? "+" : "") + pnl : ""}</div>
        `

        if (pnl > 0) box.classList.add("win")
        if (pnl < 0) box.classList.add("loss")

        box.onclick = () => openModal(dateStr)

        calendar.appendChild(box)

    }

}

/* ======================
MODAL
====================== */

function openModal(date) {

    selectedDate = date

    document.getElementById("modalDate").innerText = date

    document.getElementById("tradeModal").style.display = "flex"

    loadTrade(date)

}

function closeModal() {

    document.getElementById("tradeModal").style.display = "none"

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

    document.getElementById("pnlInput").value =
        data.length ? data[0].pnl : ""

}

/* ======================
SAVE TRADE
====================== */

async function saveTrade() {

    const pnl = parseFloat(document.getElementById("pnlInput").value)

    if (isNaN(pnl)) {

        alert("Invalid number")

        return

    }

    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", selectedDate)

    if (data.length > 0) {

        await client
            .from("trades")
            .update({ pnl: pnl })
            .eq("user_id", user.id)
            .eq("date", selectedDate)

    } else {

        await client
            .from("trades")
            .insert([
                {
                    user_id: user.id,
                    date: selectedDate,
                    pnl: pnl
                }
            ])

    }

    closeModal()

    await refreshDashboard()

}

/* ======================
DELETE TRADE
====================== */

function showDeleteConfirm() {

    document.getElementById("confirmModal").style.display = "flex"

}

async function deleteTrade() {

    if (!selectedDate) return

    await client
        .from("trades")
        .delete()
        .eq("user_id", user.id)
        .eq("date", selectedDate)

    document.getElementById("confirmModal").style.display = "none"

    closeModal()

    location.reload()
}

/* ======================
RESET
====================== */

function resetTrades() {

    document.getElementById("resetModal").style.display = "flex"

}

async function confirmReset() {

    await client
        .from("trades")
        .delete()
        .eq("user_id", user.id)

    document.getElementById("resetModal").style.display = "none"

    location.reload()

}

/* ======================
MONTH NAVIGATION
====================== */

function prevMonth() {

    currentDate.setMonth(currentDate.getMonth() - 1)

    renderCalendar()

}

function nextMonth() {

    currentDate.setMonth(currentDate.getMonth() + 1)

    renderCalendar()

}

/* ======================
LOAD TRADES
====================== */

async function loadTrades() {

    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true })

    if (!data || data.length === 0) {

        document.getElementById("totalPnL").innerText = "$0"
        document.getElementById("winrate").innerText = "0%"
        document.getElementById("totalTrades").innerText = "0"
        document.getElementById("maxDD").innerText = "$0"

        document.getElementById("profitFactor").innerText = "0"
        document.getElementById("riskReward").innerText = "0"
        document.getElementById("expectancy").innerText = "0"
        document.getElementById("strategyScore").innerText = "0"

        return
    }

    let labels = []
    let equity = []
    let pnlList = []

    let total = 0
    let wins = 0
    let losses = 0

    let grossProfit = 0
    let grossLoss = 0

    let winAmount = []
    let lossAmount = []

    let peak = 0
    let maxDD = 0

    data.forEach(t => {

        const pnl = Number(t.pnl)

        pnlList.push(pnl)

        total += pnl

        labels.push(t.date)

        equity.push(total)

        if (pnl > 0) {

            wins++

            grossProfit += pnl

            winAmount.push(pnl)

        } else if (pnl < 0) {

            losses++

            grossLoss += Math.abs(pnl)

            lossAmount.push(Math.abs(pnl))

        }

        if (total > peak) peak = total

        const dd = peak - total

        if (dd > maxDD) maxDD = dd

    })

    const winrate = (wins / data.length) * 100

    const avgWin =
        winAmount.length ?
            winAmount.reduce((a, b) => a + b, 0) / winAmount.length : 0

    const avgLoss =
        lossAmount.length ?
            lossAmount.reduce((a, b) => a + b, 0) / lossAmount.length : 0

    const profitFactor =
        grossLoss === 0 ? grossProfit : grossProfit / grossLoss

    const riskReward =
        avgLoss === 0 ? 0 : avgWin / avgLoss

    const expectancy =
        ((winrate / 100) * avgWin) -
        ((1 - winrate / 100) * avgLoss)

    const strategyScore =
        ((winrate * profitFactor) / 10)

    document.getElementById("totalPnL").innerText =
        "$" + total.toFixed(2)

    document.getElementById("winrate").innerText =
        winrate.toFixed(1) + "%"

    document.getElementById("totalTrades").innerText =
        data.length

    document.getElementById("maxDD").innerText =
        "$" + maxDD.toFixed(2)

    document.getElementById("profitFactor").innerText =
        profitFactor.toFixed(2)

    document.getElementById("riskReward").innerText =
        riskReward.toFixed(2)

    document.getElementById("expectancy").innerText =
        expectancy.toFixed(2)

    document.getElementById("strategyScore").innerText =
        strategyScore.toFixed(1)

    drawEquity(labels, equity)

    drawWin(labels, pnlList)

    drawPnL(labels, pnlList)

}

/* ======================
CHARTS
====================== */

function drawEquity(labels, data) {

    if (equityChart) equityChart.destroy()

    equityChart = new Chart(
        document.getElementById("equityChart"),
        {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Equity",
                    data,
                    borderColor: "#22c55e",
                    tension: 0.3
                }]
            }
        })
}

function drawWin(labels, pnlList) {

    if (winChart) winChart.destroy()

    let wins = 0

    let winrateData = []

    pnlList.forEach((pnl, i) => {

        if (pnl > 0) wins++

        winrateData.push((wins / (i + 1)) * 100)

    })

    winChart = new Chart(
        document.getElementById("winChart"),
        {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Winrate %",
                    data: winrateData,
                    borderColor: "#38bdf8",
                    tension: 0.3
                }]
            }
        })
}

function drawPnL(labels, data) {

    if (pnlChart) pnlChart.destroy()

    pnlChart = new Chart(
        document.getElementById("pnlChart"),
        {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "PnL",
                    data,
                    backgroundColor: data.map(v =>
                        v >= 0 ? "#22c55e" : "#ef4444"
                    )
                }]
            }
        })
}

/* ======================
REFRESH
====================== */

async function refreshDashboard() {

    await renderCalendar()

    await loadTrades()

}

/* ======================
INIT
====================== */

document.addEventListener("DOMContentLoaded", async () => {

    await refreshDashboard()

    document.getElementById("saveTrade").onclick = saveTrade

    document.getElementById("deleteTrade").onclick = showDeleteConfirm

    document.getElementById("confirmDeleteBtn").onclick = deleteTrade

    document.getElementById("cancelDeleteBtn").onclick = () => {

        document.getElementById("confirmModal").style.display = "none"

    }

    document.getElementById("confirmResetBtn").onclick = confirmReset

    document.getElementById("cancelResetBtn").onclick = () => {

        document.getElementById("resetModal").style.display = "none"

    }

})

/* =========================
ULTRA UI SYSTEM
========================= */

/* TOAST */

function showToast(text, type = "success") {

    const toast = document.getElementById("toast")
    const toastText = document.getElementById("toastText")

    toastText.innerText = text

    toast.classList.remove("success", "error")
    toast.classList.add(type)

    toast.classList.add("show")

    setTimeout(() => {
        toast.classList.remove("show")
    }, 3000)

}

/* PARTICLES */

function createParticles() {

    for (let i = 0; i < 30; i++) {

        const p = document.createElement("div")
        p.className = "particle"

        p.style.left = Math.random() * 100 + "%"
        p.style.animationDuration = (10 + Math.random() * 20) + "s"

        document.body.appendChild(p)

    }

}

/* NUMBER COUNTER */

function animateValue(element, start, end, duration) {

    let startTimestamp = null

    function step(timestamp) {

        if (!startTimestamp) startTimestamp = timestamp

        const progress = Math.min((timestamp - startTimestamp) / duration, 1)

        element.innerText = Math.floor(progress * (end - start) + start)

        if (progress < 1)
            requestAnimationFrame(step)

    }

    requestAnimationFrame(step)

}

/* RESET ANIMATION PATCH */

const originalConfirmReset = confirmReset

confirmReset = async function () {

    document.body.classList.add("flash")

    showToast("Resetting all trades...", "error")

    await originalConfirmReset()

}

/* SAVE TRADE PATCH */

const originalSaveTrade = saveTrade

saveTrade = async function () {

    await originalSaveTrade()

    showToast("Trade Saved 📈", "success")

}

/* DELETE TRADE PATCH */

const originalDeleteTrade = deleteTrade

deleteTrade = async function () {

    await originalDeleteTrade()

    showToast("Trade Deleted", "error")

}

/* PARTICLE INIT */

document.addEventListener("DOMContentLoaded", () => {

    createParticles()

})