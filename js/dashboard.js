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
GLOBAL VARIABLES
====================== */

let equityChart = null
let winChart = null
let pnlChart = null

let currentDate = new Date()
let selectedDate = null
let currentTradesData = [] // เก็บข้อมูล CacheTrades ไว้ใช้งานใน List View
let currentPnLType = "win"; // ค่าเริ่มต้นเป็นกำไร (+)

/* ======================
LOGOUT
====================== */

function logout() {
    localStorage.removeItem("user")
    window.location = "login.html"
}

/* ======================
VIEW SWITCHER (UX/UI ENHANCEMENT)
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
        tradeList.innerHTML = `<div style="text-align:center; padding: 20px; opacity:0.5; font-size:12px;">No trade records found</div>`
        return
    }

    // เรียงวันที่จากล่าสุดไปเก่าสุด
    const sortedData = [...currentTradesData].sort((a, b) => new Date(b.date) - new Date(a.date))

    sortedData.forEach(trade => {
        const pnl = Number(trade.pnl)
        const isWin = pnl >= 0
        const item = document.createElement("div")
        item.className = `trade-item ${isWin ? "win-item" : "loss-item"}`
        item.style.cursor = "pointer"
        item.onclick = () => openModal(trade.date)

        item.innerHTML = `
            <span>${trade.date}</span>
            <span style="font-weight:700; color: ${isWin ? '#4ade80' : '#f87171'}">
                ${isWin ? '+' : ''}$${pnl.toFixed(2)}
            </span>
            <span style="font-size:11px; opacity:0.8;">
                ${trade.trades_count || 1} ${trade.trades_count > 1 ? 'trades' : 'trade'}
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

    document.getElementById("monthYear").innerText =
        currentDate.toLocaleString("default", { month: "long" }) + " " + year

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)

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

// ฟังก์ชันปิด Trade Modal (หน้าเพิ่ม/แก้ไข Trade)
function closeModal() {
    const modal = document.getElementById("tradeModal");
    if (modal) {
        modal.style.display = "none";
    }
}

// ฟังก์ชันปิด Summary Modal (หน้าการ์ดสรุปผล)
function closeSummaryModal() {
    const summaryModal = document.getElementById("summaryModal");
    if (summaryModal) {
        summaryModal.style.display = "none";
    }
}

/* ======================
LOAD TRADE
====================== */

// ฟังก์ชันสลับสถานะ + / -
function setPnLType(type) {
    currentPnLType = type;
    const btnWin = document.getElementById("btnWin");
    const btnLoss = document.getElementById("btnLoss");
    const pnlInput = document.getElementById("pnlInput");

    if (type === "win") {
        btnWin.classList.add("active");
        btnLoss.classList.remove("active");
        if (pnlInput && pnlInput.value) {
            pnlInput.value = Math.abs(parseFloat(pnlInput.value) || 0);
        }
    } else {
        btnLoss.classList.add("active");
        btnWin.classList.remove("active");
        if (pnlInput && pnlInput.value) {
            const absVal = Math.abs(parseFloat(pnlInput.value) || 0);
            pnlInput.value = absVal > 0 ? -absVal : "";
        }
    }
}

// อัปเดตเครื่องหมายตามสถานะขณะผู้ใช้กำลังพิมพ์
function updatePnLSign() {
    const pnlInput = document.getElementById("pnlInput");
    if (!pnlInput || pnlInput.value === "") return;

    let val = parseFloat(pnlInput.value);
    if (isNaN(val)) return;

    if (currentPnLType === "loss" && val > 0) {
        pnlInput.value = -val;
    } else if (currentPnLType === "win" && val < 0) {
        pnlInput.value = Math.abs(val);
    }
}

// ปรับปรุงฟังก์ชัน loadTrade เดิม เพื่อให้เลือกปุ่ม + หรือ - ตามข้อมูลเก่าอัตโนมัติ
async function loadTrade(date) {
    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date);

    if (data && data.length > 0) {
        const pnl = Number(data[0].pnl);
        document.getElementById("pnlInput").value = pnl;
        document.getElementById("tradesCountInput").value = data[0].trades_count || 1;

        if (pnl < 0) {
            setPnLType("loss");
        } else {
            setPnLType("win");
        }
    } else {
        document.getElementById("pnlInput").value = "";
        document.getElementById("tradesCountInput").value = "1";
        setPnLType("win"); // ค่าเริ่มต้นสำหรับรายการใหม่
    }
}

/* ======================
SAVE TRADE
====================== */

async function saveTrade() {
    const pnlInputVal = document.getElementById("pnlInput").value
    const pnl = parseFloat(pnlInputVal)
    const tradesCount = Math.abs(parseInt(document.getElementById("tradesCountInput").value)) || 1

    if (isNaN(pnl) || pnlInputVal.trim() === "") {
        showToast("Invalid PnL number", "error")
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
    showToast("Trade Saved 📈", "success")
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
    showToast("Trade Deleted", "error")
    await refreshDashboard()
}

/* ======================
RESET
====================== */

function resetTrades() {
    document.getElementById("resetModal").style.display = "flex"
}

async function confirmReset() {
    document.body.classList.add("flash")
    showToast("Resetting all trades...", "error")

    await client
        .from("trades")
        .delete()
        .eq("user_id", user.id)

    document.getElementById("resetModal").style.display = "none"
    await refreshDashboard()
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
LOAD TRADES & METRICS
====================== */

async function loadTrades() {
    const { data } = await client
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true })

    currentTradesData = data || []

    if (!data || data.length === 0) {
        document.getElementById("totalPnL").innerText = "$0.00"
        document.getElementById("winrate").innerText = "0%"
        document.getElementById("totalTrades").innerText = "0"
        document.getElementById("maxDD").innerText = "$0.00"

        document.getElementById("profitFactor").innerText = "0.00"
        document.getElementById("riskReward").innerText = "0.00"
        document.getElementById("expectancy").innerText = "$0.00"
        document.getElementById("strategyScore").innerText = "0.0"

        drawEquity([], [])
        drawWin([], [])
        drawPnL([], [])

        if (document.getElementById("listContainer") && document.getElementById("listContainer").style.display !== "none") {
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
        const count = Number(t.trades_count || 1)

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

        if (totalPnL > peak) peak = totalPnL
        const dd = peak - totalPnL
        if (dd > maxDD) maxDD = dd
    })

    const winrate = (wins / data.length) * 100

    // ANALYTICS METRICS
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit
    const avgWin = wins > 0 ? (grossProfit / wins) : 0
    const avgLoss = losses > 0 ? (grossLoss / losses) : 0
    const riskReward = avgLoss > 0 ? (avgWin / avgLoss) : avgWin

    const winRateDec = wins / data.length
    const lossRateDec = losses / data.length
    const expectancy = (winRateDec * avgWin) - (lossRateDec * avgLoss)

    let strategyScore = 0
    if (data.length > 0) {
        const pfScore = Math.min(profitFactor / 2, 1) * 40
        const wrScore = (winrate / 100) * 40
        const ddPenalty = peak > 0 ? Math.min(maxDD / peak, 1) * 20 : 0
        strategyScore = Math.max(0, pfScore + wrScore + (20 - ddPenalty))
    }

    // UPDATE UI
    document.getElementById("totalPnL").innerText = "$" + totalPnL.toFixed(2)
    document.getElementById("winrate").innerText = winrate.toFixed(1) + "%"
    document.getElementById("totalTrades").innerText = totalTradesCount
    document.getElementById("maxDD").innerText = "$" + maxDD.toFixed(2)

    document.getElementById("profitFactor").innerText = profitFactor.toFixed(2)
    document.getElementById("riskReward").innerText = riskReward.toFixed(2)
    document.getElementById("expectancy").innerText = (expectancy >= 0 ? "$" : "-$") + Math.abs(expectancy).toFixed(2)
    document.getElementById("strategyScore").innerText = strategyScore.toFixed(1)

    drawEquity(labels, equity)
    drawWin(labels, pnlList)
    drawPnL(labels, pnlList)

    if (document.getElementById("listContainer") && document.getElementById("listContainer").style.display !== "none") {
        renderListView()
    }
}

/* ======================
CHARTS
====================== */

function drawEquity(labels, data) {
    if (equityChart) equityChart.destroy();
    const ctx = document.getElementById("equityChart")?.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
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
                pointRadius: data.length === 1 ? 5 : 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (ctx) => ` Equity: $${ctx.raw.toFixed(2)}` }
                }
            },
            scales: {
                x: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#94a3b8" } },
                y: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#94a3b8", callback: (v) => "$" + v }, beginAtZero: true }
            }
        }
    });
}

function drawWin(labels, pnlList) {
    if (winChart) winChart.destroy();
    const ctx = document.getElementById("winChart")?.getContext("2d");
    if (!ctx) return;

    let wins = 0;
    let winrateData = [];
    pnlList.forEach((pnl, i) => {
        if (pnl > 0) wins++;
        winrateData.push(((wins / (i + 1)) * 100).toFixed(1));
    });

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
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
                tooltip: { callbacks: { label: (ctx) => ` Winrate: ${ctx.raw}%` } }
            },
            scales: {
                x: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#94a3b8" } },
                y: { min: 0, max: 100, grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#94a3b8", callback: (v) => v + "%" } }
            }
        }
    });
}

function drawPnL(labels, data) {
    if (pnlChart) pnlChart.destroy();
    const ctx = document.getElementById("pnlChart")?.getContext("2d");
    if (!ctx) return;

    const winGradient = ctx.createLinearGradient(0, 0, 0, 200);
    winGradient.addColorStop(0, "rgba(34, 197, 94, 0.95)");
    winGradient.addColorStop(1, "rgba(34, 197, 94, 0.2)");

    const lossGradient = ctx.createLinearGradient(0, 0, 0, 200);
    lossGradient.addColorStop(0, "rgba(239, 68, 68, 0.2)");
    lossGradient.addColorStop(1, "rgba(239, 68, 68, 0.95)");

    const formattedLabels = labels.map(dateStr => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            return dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        }
        return dateStr;
    });

    pnlChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: formattedLabels,
            datasets: [{
                label: "PnL ($)",
                data,
                backgroundColor: data.map(v => v >= 0 ? winGradient : lossGradient),
                borderColor: data.map(v => v >= 0 ? "#22c55e" : "#ef4444"),
                borderWidth: 1.5,
                borderRadius: 6,
                maxBarThickness: 38
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ctx.raw >= 0 ? ` PnL: +$${ctx.raw.toFixed(2)}` : ` PnL: -$${Math.abs(ctx.raw).toFixed(2)}`
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: "#cbd5e1" } },
                y: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#94a3b8", callback: (v) => v >= 0 ? "$" + v : "-$" + Math.abs(v) } }
            }
        }
    });
}

/* ======================
REFRESH & INIT
====================== */

async function refreshDashboard() {
    await renderCalendar()
    await loadTrades()
}

document.addEventListener("DOMContentLoaded", async () => {
    await refreshDashboard()
    createParticles()

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
TOAST & PARTICLES SYSTEM
========================= */

function showToast(text, type = "success") {
    const toast = document.getElementById("toast")
    const toastText = document.getElementById("toastText")
    if (!toast || !toastText) return

    toastText.innerText = text
    toast.classList.remove("success", "error")
    toast.classList.add(type, "show")

    setTimeout(() => {
        toast.classList.remove("show")
    }, 3000)
}

function createParticles() {
    for (let i = 0; i < 25; i++) {
        const p = document.createElement("div")
        p.className = "particle"
        p.style.left = Math.random() * 100 + "%"
        p.style.animationDuration = (10 + Math.random() * 20) + "s"
        document.body.appendChild(p)
    }
}

// เปิด Modal และอัปเดตข้อมูลสถิติลงการ์ด
async function openSummaryModal() {
    let displayName = "Trader";

    try {
        // 1. ลองดึงจากตัวแปร user หรือ Supabase Session
        let currentUser = typeof user !== "undefined" ? user : null;
        
        if (!currentUser && typeof supabase !== "undefined") {
            const { data } = await supabase.auth.getUser();
            currentUser = data?.user;
        }

        // 2. ถ้าเจอ User ใน Supabase Auth
        if (currentUser) {
            displayName = currentUser.user_metadata?.username || 
                          currentUser.user_metadata?.full_name || 
                          (currentUser.email ? currentUser.email.split("@")[0] : null);
        }

        // 3. ถ้ายังไม่เจอ ให้ลองดึงจาก LocalStorage (เผื่อเซฟไว้ตอน Login)
        if (!displayName || displayName === "Trader") {
            const storedUser = localStorage.getItem("user") || localStorage.getItem("sb-user");
            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                displayName = parsed.username || parsed.email?.split("@")[0] || displayName;
            }
        }
    } catch (e) {
        console.log("Error fetching user info:", e);
    }

    // อัปเดตชื่อผู้ใช้งานลงการ์ด
    document.getElementById("summaryUsername").innerText = displayName || "Trader";

    // ดึงข้อมูลสถิติลงการ์ด
    const totalPnL = document.getElementById("totalPnL")?.innerText || "$0.00";
    const winrate = document.getElementById("winrate")?.innerText || "0%";
    const totalTrades = document.getElementById("totalTrades")?.innerText || "0";
    const maxDD = document.getElementById("maxDD")?.innerText || "$0.00";
    const profitFactor = document.getElementById("profitFactor")?.innerText || "0.00";
    const monthYear = document.getElementById("monthYear")?.innerText || "";

    document.getElementById("sumTotalPnL").innerText = totalPnL;
    document.getElementById("sumWinrate").innerText = winrate;
    document.getElementById("sumTrades").innerText = totalTrades;
    document.getElementById("sumMaxDD").innerText = maxDD;
    document.getElementById("sumPF").innerText = profitFactor;
    document.getElementById("summaryDate").innerText = monthYear;

    // กำหนดสีตามผลกำไร / ขาดทุน
    const pnlElem = document.getElementById("sumTotalPnL");
    if (totalPnL.includes("-")) {
        pnlElem.style.color = "#f87171";
    } else {
        pnlElem.style.color = "#4ade80";
    }

    document.getElementById("summaryModal").style.display = "flex";
}

// ฟังก์ชันคัดลอกรูปภาพโดยเปิดใช้ letterRendering เพื่อป้องกันตัวหนังสือขี่กัน
async function copySummaryImage() {
    const card = document.getElementById("summaryCard");
    if (!card) return;

    try {
        if (typeof showToast === "function") showToast("Generating image...", "success");

        const canvas = await html2canvas(card, {
            scale: 3, // เพิ่มความคมชัดระดับ HD
            backgroundColor: null,
            useCORS: true,
            letterRendering: true, // ป้องกันตัวอักษรซ้อนขี่กัน
            logging: false
        });

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            try {
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);
                if (typeof showToast === "function") showToast("Copied image to clipboard! 📋", "success");
            } catch (err) {
                const image = canvas.toDataURL("image/png");
                const newWindow = window.open();
                newWindow.document.write(`<img src="${image}" style="max-width:100%;" />`);
            }
        });
    } catch (e) {
        console.error(e);
    }
}