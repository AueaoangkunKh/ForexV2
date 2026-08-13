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

    // เก็บทั้ง pnl และ trades_count แยกตามวันที่
    const tradeMap = {}
    if (data) {
        data.forEach(t => {
            if (!tradeMap[t.date]) {
                tradeMap[t.date] = { pnl: 0, count: 0 }
            }
            tradeMap[t.date].pnl += Number(t.pnl)
            tradeMap[t.date].count += Number(t.trades_count || 1)
        })
    }

    // เติมช่องว่างด้านหน้า
    for (let i = 0; i < firstDay; i++) {
        calendar.appendChild(document.createElement("div"))
    }

    // วนลูปสร้างกล่องวันที่
    for (let day = 1; day <= daysInMonth; day++) {

        const dateObj = new Date(year, month, day)
        const dayOfWeek = dateObj.getDay()
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6)

        const dateStr =
            year + "-" +
            String(month + 1).padStart(2, "0") + "-" +
            String(day).padStart(2, "0")

        const tradeInfo = tradeMap[dateStr]
        const box = document.createElement("div")

        box.className = "day"

        if (tradeInfo) {
            const pnl = tradeInfo.pnl
            // 🔹 เพิ่ม Math.abs() ตรงนี้ เพื่อป้องกันไม่ให้จำนวนออเดอร์เป็นค่าติดลบ (-1 trades)
            const count = Math.abs(tradeInfo.count)

            box.innerHTML = `
                <div class="day-number">${day}</div>
                <div class="day-info">
                    <div class="day-pnl">${(pnl > 0 ? "+" : "") + pnl.toFixed(2)}</div>
                    <div class="day-count">${count} ${count > 1 ? 'trades' : 'trade'}</div>
                </div>
            `

            if (pnl > 0) box.classList.add("win")
            if (pnl < 0) box.classList.add("loss")
        } else {
            box.innerHTML = `<div class="day-number">${day}</div>`
        }

        // เช็คเสาร์-อาทิตย์
        if (isWeekend) {
            box.classList.add("disabled-day")
            box.title = "Market Closed (Weekend)"
        } else {
            box.onclick = () => openModal(dateStr)
        }

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

    if (data && data.length > 0) {
        document.getElementById("pnlInput").value = data[0].pnl
        document.getElementById("tradesCountInput").value = data[0].trades_count || 1
    } else {
        document.getElementById("pnlInput").value = ""
        document.getElementById("tradesCountInput").value = "1"
    }
}

/* ======================
SAVE TRADE
====================== */
async function saveTrade() {
    const pnl = parseFloat(document.getElementById("pnlInput").value)
    const tradesCount = Math.abs(parseInt(document.getElementById("tradesCountInput").value)) || 1

    if (isNaN(pnl)) {
        alert("Invalid PnL number")
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

        // รีเซ็ตค่า Analytics เป็น 0 เมื่อไม่มีข้อมูล
        document.getElementById("profitFactor").innerText = "0.00"
        document.getElementById("riskReward").innerText = "0.00"
        document.getElementById("expectancy").innerText = "$0.00"
        document.getElementById("strategyScore").innerText = "0.0"
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
    let winAmount = []
    let lossAmount = []

    let peak = 0
    let maxDD = 0

    data.forEach(t => {
        const pnl = Number(t.pnl)
        const count = Number(t.trades_count || 1)

        pnlList.push(pnl)
        totalPnL += pnl
        totalTradesCount += count

        labels.push(t.date)
        equity.push(totalPnL)

        if (pnl > 0) {
            wins++
            grossProfit += pnl
            winAmount.push(pnl)
        } else if (pnl < 0) {
            losses++
            grossLoss += Math.abs(pnl)
            lossAmount.push(Math.abs(pnl))
        }

        if (totalPnL > peak) peak = totalPnL
        const dd = peak - totalPnL
        if (dd > maxDD) maxDD = dd
    })

    const winrate = (wins / data.length) * 100

    // --- การคำนวณ ANALYTICS METRICS ---

    // 1. Profit Factor = Gross Profit / Gross Loss
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit

    // 2. Average Win / Average Loss
    const avgWin = wins > 0 ? (grossProfit / wins) : 0
    const avgLoss = losses > 0 ? (grossLoss / losses) : 0

    // 3. Risk Reward Ratio = Average Win / Average Loss
    const riskReward = avgLoss > 0 ? (avgWin / avgLoss) : avgWin

    // 4. Expectancy = (Win Rate % * Avg Win) - (Loss Rate % * Avg Loss)
    const winRateDec = wins / data.length
    const lossRateDec = losses / data.length
    const expectancy = (winRateDec * avgWin) - (lossRateDec * avgLoss)

    // 5. Strategy Score (สูตรประเมินกลยุทธ์ 0-100)
    // ให้น้ำหนักจาก Winrate, Profit Factor, และ Max Drawdown
    let strategyScore = 0
    if (data.length > 0) {
        const pfScore = Math.min(profitFactor / 2, 1) * 40 // สูงสุด 40 คะแนน
        const wrScore = (winrate / 100) * 40              // สูงสุด 40 คะแนน
        const ddPenalty = peak > 0 ? Math.min(maxDD / peak, 1) * 20 : 0 // หักคะแนนตาม DD
        strategyScore = Math.max(0, pfScore + wrScore + (20 - ddPenalty))
    }

    // --- อัปเดต UI ด้านบน ---
    document.getElementById("totalPnL").innerText = "$" + totalPnL.toFixed(2)
    document.getElementById("winrate").innerText = winrate.toFixed(1) + "%"
    document.getElementById("totalTrades").innerText = totalTradesCount
    document.getElementById("maxDD").innerText = "$" + maxDD.toFixed(2)

    // --- อัปเดต UI กล่อง ANALYTICS ---
    document.getElementById("profitFactor").innerText = profitFactor.toFixed(2)
    document.getElementById("riskReward").innerText = riskReward.toFixed(2)
    document.getElementById("expectancy").innerText = (expectancy >= 0 ? "$" : "-$") + Math.abs(expectancy).toFixed(2)
    document.getElementById("strategyScore").innerText = strategyScore.toFixed(1)

    drawEquity(labels, equity)
    drawWin(labels, pnlList)
    drawPnL(labels, pnlList)
}

/* ======================
CHARTS IMPROVED
====================== */

function drawEquity(labels, data) {
    if (equityChart) equityChart.destroy();

    const ctx = document.getElementById("equityChart").getContext("2d");
    
    // สร้าง Gradient เพิ่มความพรีเมียม
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(34, 197, 94, 0.4)");
    gradient.addColorStop(1, "rgba(34, 197, 94, 0.0)");

    equityChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Equity ($)",
                data,
                borderColor: "#22c55e",
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: "#22c55e",
                pointRadius: data.length === 1 ? 5 : 3, // เพิ่มจุดถ้ามีเทรดเดียว
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (ctx) => ` Equity: $${ctx.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#94a3b8" }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: {
                        color: "#94a3b8",
                        callback: (value) => "$" + value
                    },
                    // เริ่มต้นแกน Y จาก 0 เพื่อความสมดุล
                    beginAtZero: true
                }
            }
        }
    });
}

function drawWin(labels, pnlList) {
    if (winChart) winChart.destroy();

    let wins = 0;
    let winrateData = [];

    pnlList.forEach((pnl, i) => {
        if (pnl > 0) wins++;
        winrateData.push(((wins / (i + 1)) * 100).toFixed(1));
    });

    const ctx = document.getElementById("winChart").getContext("2d");
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(56, 189, 248, 0.3)");
    gradient.addColorStop(1, "rgba(56, 189, 248, 0.0)");

    winChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Winrate (%)",
                data: winrateData,
                borderColor: "#38bdf8",
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: "#38bdf8",
                pointRadius: winrateData.length === 1 ? 5 : 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` Winrate: ${ctx.raw}%`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#94a3b8" }
                },
                y: {
                    min: 0,
                    max: 100, // ล็อกสเกล Winrate 0 - 100% อ่านง่ายขึ้น
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: {
                        color: "#94a3b8",
                        callback: (value) => value + "%"
                    }
                }
            }
        }
    });
}

function drawPnL(labels, data) {
    if (pnlChart) pnlChart.destroy();

    const ctx = document.getElementById("pnlChart").getContext("2d");

    pnlChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "PnL ($)",
                data,
                backgroundColor: data.map(v => v >= 0 ? "rgba(34, 197, 94, 0.85)" : "rgba(239, 68, 68, 0.85)"),
                borderColor: data.map(v => v >= 0 ? "#22c55e" : "#ef4444"),
                borderWidth: 1,
                borderRadius: 6, // ขอบแท่งมน
                barThickness: data.length > 10 ? 'flex' : 40 // ปรับความกว้างแท่งไม่ให้บวมเกินไป
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` PnL: $${ctx.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#94a3b8" }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: {
                        color: "#94a3b8",
                        callback: (value) => "$" + value
                    }
                }
            }
        }
    });
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

/* ======================
AI NEWS MODAL
====================== */

function openNewsModal() {
    document.getElementById("newsModal").style.display = "flex";
}

function closeNewsModal() {
    document.getElementById("newsModal").style.display = "none";
}

async function analyzeNewsWithAI() {
    const newsContent = document.getElementById("newsInput").value.trim();
    const resultBox = document.getElementById("newsResult");
    const btnText = document.getElementById("analyzeBtnText");
    const loader = document.getElementById("analyzeLoader");

    if (!newsContent) {
        alert("กรุณากรอกข้อมูลข่าวหรือตัวเลขเศรษฐกิจากตารางก่อนครับ");
        return;
    }

    btnText.style.display = "none";
    loader.style.display = "inline";
    resultBox.innerHTML = "<p class='news-placeholder'>⏳ AI กำลังวิเคราะห์ข้อมูลและสร้างตารางกลยุทธ์...</p>";

    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newsContent })
        });

        // 🔹 เช็คว่า Response OK หรือไม่ก่อนแปลง JSON
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: `HTTP Status ${response.status}` }));
            throw new Error(errData.error || `Server responded with status ${response.status}`);
        }

        const data = await response.json();

        if (data.result) {
            resultBox.innerHTML = marked.parse(data.result);
        } else {
            resultBox.innerHTML = "<p style='color:#ef4444;'>ไม่พบข้อมูลตอบกลับจาก AI</p>";
        }
    } catch (err) {
        resultBox.innerHTML = `<p style='color:#ef4444; font-weight:bold;'>⚠️ เกิดข้อผิดพลาด: ${err.message}</p>`;
    } finally {
        btnText.style.display = "inline";
        loader.style.display = "none";
    }
}
