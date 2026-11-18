const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location = "login.html";

let equityChart = null;
let winChart = null;
let pnlChart = null;
let shareMiniChart = null;

let currentDate = new Date();
let selectedDate = null;
let currentTradesData = [];
let currentEquityFilter = "all";
let currentPnLType = "win";
let currentTransType = "deposit";

document.addEventListener("DOMContentLoaded", async () => {
    const welcomeEl = document.getElementById("welcomeUser");
    if (welcomeEl && user?.username) {
        welcomeEl.innerText = `OPERATOR: ${user.username.toUpperCase()}`;
    }

    await refreshDashboard();

    document.getElementById("saveTrade").onclick = saveTrade;
    document.getElementById("deleteTrade").onclick = () => document.getElementById("confirmModal").style.display = "flex";
    document.getElementById("confirmDeleteBtn").onclick = deleteTrade;
    document.getElementById("cancelDeleteBtn").onclick = () => document.getElementById("confirmModal").style.display = "none";
    document.getElementById("confirmResetBtn").onclick = confirmReset;
    document.getElementById("cancelResetBtn").onclick = () => document.getElementById("resetModal").style.display = "none";
});

function logout() {
    localStorage.removeItem("user");
    window.location = "login.html";
}

function parseLocalDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
}

/* ======================
   ANIMATED NUMBER COUNTER
====================== */
function animateValue(elementId, endValue, prefix = "", suffix = "", decimals = 2) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const duration = 600;
    const startTime = performance.now();
    const startValue = 0;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (endValue - startValue) * easeOut;

        const sign = current < 0 ? "-" : "";
        el.innerText = `${sign}${prefix}${Math.abs(current).toFixed(decimals)}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            const finalSign = endValue < 0 ? "-" : "";
            el.innerText = `${finalSign}${prefix}${Math.abs(endValue).toFixed(decimals)}${suffix}`;
        }
    }
    requestAnimationFrame(update);
}

/* ======================
   VIEW & FILTER SWITCHERS
====================== */
function switchView(viewType) {
    const calendarCont = document.getElementById("calendarContainer");
    const listCont = document.getElementById("listContainer");
    const btnCal = document.getElementById("btnCalendarView");
    const btnList = document.getElementById("btnListView");

    if (viewType === "calendar") {
        calendarCont.style.display = "block";
        listCont.style.display = "none";
        btnCal.classList.add("active");
        btnList.classList.remove("active");
    } else {
        calendarCont.style.display = "none";
        listCont.style.display = "block";
        btnList.classList.add("active");
        btnCal.classList.remove("active");
        renderListView();
    }
}

function setEquityFilter(filter, btnEl) {
    currentEquityFilter = filter;
    document.querySelectorAll(".tf-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    applyEquityFilterAndDraw();
}

function applyEquityFilterAndDraw() {
    if (!currentTradesData || currentTradesData.length === 0) {
        drawEquity([], []);
        return;
    }

    const latestTradeDate = parseLocalDate(currentTradesData[currentTradesData.length - 1].date);
    let filtered = [...currentTradesData];

    if (currentEquityFilter === "7d") {
        const cutoff = new Date(latestTradeDate);
        cutoff.setDate(latestTradeDate.getDate() - 6);
        filtered = filtered.filter(t => parseLocalDate(t.date) >= cutoff);
    } else if (currentEquityFilter === "30d") {
        const cutoff = new Date(latestTradeDate);
        cutoff.setDate(latestTradeDate.getDate() - 29);
        filtered = filtered.filter(t => parseLocalDate(t.date) >= cutoff);
    } else if (currentEquityFilter === "month") {
        filtered = filtered.filter(t => {
            const d = parseLocalDate(t.date);
            return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
        });
    }

    let running = 0;
    const labels = [];
    const equity = [];

    filtered.forEach(t => {
        running += Number(t.pnl);
        labels.push(t.date);
        equity.push(running);
    });

    drawEquity(labels, equity);
}

/* ======================
   LIST & CALENDAR RENDER
====================== */
function renderListView() {
    const tradeList = document.getElementById("tradeList");
    if (!tradeList) return;
    tradeList.innerHTML = "";

    if (!currentTradesData || currentTradesData.length === 0) {
        tradeList.innerHTML = `<div style="text-align:center; padding: 24px; opacity:0.5; font-size:12px;">No trade records found</div>`;
        return;
    }

    const sorted = [...currentTradesData].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(trade => {
        const pnl = Number(trade.pnl);
        const isWin = pnl >= 0;
        const item = document.createElement("div");
        item.className = `trade-item ${isWin ? "win-item" : "loss-item"}`;
        item.style.cursor = "pointer";
        item.onclick = () => openModal(trade.date);

        item.innerHTML = `
            <span>${trade.date}</span>
            <span style="font-weight:700; color: ${isWin ? '#4ade80' : '#f87171'}">
                ${isWin ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}
            </span>
            <span style="font-size:11px; color:#94a3b8;">
                ${trade.trades_count || 1} ${trade.trades_count > 1 ? 'trades' : 'trade'}
            </span>
        `;
        tradeList.appendChild(item);
    });
}

async function renderCalendar() {
    const calendar = document.getElementById("calendar");
    if (!calendar) return;
    calendar.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    document.getElementById("monthYear").innerText =
        currentDate.toLocaleString("default", { month: "long" }) + " " + year;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const { data } = await client.from("trades").select("*").eq("user_id", user.id);

    const tradeMap = {};
    if (data) {
        data.forEach(t => {
            if (!tradeMap[t.date]) tradeMap[t.date] = { pnl: 0, count: 0 };
            tradeMap[t.date].pnl += Number(t.pnl);
            tradeMap[t.date].count += Number(t.trades_count || 1);
        });
    }

    for (let i = 0; i < firstDay; i++) {
        calendar.appendChild(document.createElement("div"));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        const tradeInfo = tradeMap[dateStr];
        const box = document.createElement("div");
        box.className = "day";

        if (tradeInfo) {
            const pnl = tradeInfo.pnl;
            const count = Math.abs(tradeInfo.count);
            box.innerHTML = `
                <div class="day-number">${day}</div>
                <div>
                    <div class="day-pnl">${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}</div>
                    <div class="day-count">${count} ${count > 1 ? 'trades' : 'trade'}</div>
                </div>
            `;
            if (pnl > 0) box.classList.add("win");
            if (pnl < 0) box.classList.add("loss");
        } else {
            box.innerHTML = `<div class="day-number">${day}</div>`;
        }

        if (isWeekend) {
            box.classList.add("disabled-day");
            box.title = "Market Closed";
        } else {
            box.onclick = () => openModal(dateStr);
        }

        calendar.appendChild(box);
    }
}

/* ======================
   MODALS & CRUD
====================== */
function openModal(date) {
    selectedDate = date;
    document.getElementById("modalDate").innerText = date;
    document.getElementById("tradeModal").style.display = "flex";
    loadTrade(date);
}

function closeModal() {
    document.getElementById("tradeModal").style.display = "none";
}

function closeSummaryModal() {
    document.getElementById("summaryModal").style.display = "none";
}

function openTransactionModal(type) {
    currentTransType = type;
    document.getElementById("transModalTitle").innerText =
        type === "deposit" ? "💵 ฝากเงิน (Deposit)" : "💸 ถอนเงิน (Withdraw)";
    document.getElementById("transAmountInput").value = "";
    document.getElementById("transactionModal").style.display = "flex";
}

function closeTransactionModal() {
    document.getElementById("transactionModal").style.display = "none";
}

async function saveTransaction() {
    const amountVal = parseFloat(document.getElementById("transAmountInput").value);
    if (isNaN(amountVal) || amountVal <= 0) {
        showToast("กรุณากรอกจำนวนเงินให้ถูกต้อง", "error");
        return;
    }

    const { error } = await client.from("transactions").insert([{
        user_id: String(user.id),
        type: currentTransType,
        amount: amountVal
    }]);

    if (error) {
        showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    } else {
        showToast(currentTransType === "deposit" ? "ฝากเงินสำเร็จ 🟢" : "ถอนเงินสำเร็จ 🔴", "success");
        closeTransactionModal();
        await refreshDashboard();
    }
}

async function getTotalCapital() {
    const { data, error } = await client.from("transactions").select("*").eq("user_id", String(user.id));
    if (error || !data) return 0;
    return data.reduce((acc, curr) => curr.type === "deposit" ? acc + Number(curr.amount) : acc - Number(curr.amount), 0);
}

function setPnLType(type) {
    currentPnLType = type;
    const btnWin = document.getElementById("btnWin");
    const btnLoss = document.getElementById("btnLoss");
    const pnlInput = document.getElementById("pnlInput");

    if (type === "win") {
        btnWin.classList.add("active");
        btnLoss.classList.remove("active");
        if (pnlInput.value) pnlInput.value = Math.abs(parseFloat(pnlInput.value) || 0);
    } else {
        btnLoss.classList.add("active");
        btnWin.classList.remove("active");
        if (pnlInput.value) {
            const absVal = Math.abs(parseFloat(pnlInput.value) || 0);
            pnlInput.value = absVal > 0 ? -absVal : "";
        }
    }
}

function updatePnLSign() {
    const pnlInput = document.getElementById("pnlInput");
    if (!pnlInput.value) return;
    const val = parseFloat(pnlInput.value);
    if (isNaN(val)) return;
    if (currentPnLType === "loss" && val > 0) pnlInput.value = -val;
    if (currentPnLType === "win" && val < 0) pnlInput.value = Math.abs(val);
}

async function loadTrade(date) {
    const { data } = await client.from("trades").select("*").eq("user_id", user.id).eq("date", date);
    if (data && data.length > 0) {
        const pnl = Number(data[0].pnl);
        document.getElementById("pnlInput").value = pnl;
        document.getElementById("tradesCountInput").value = data[0].trades_count || 1;
        setPnLType(pnl < 0 ? "loss" : "win");
    } else {
        document.getElementById("pnlInput").value = "";
        document.getElementById("tradesCountInput").value = "1";
        setPnLType("win");
    }
}

async function saveTrade() {
    const pnlInputVal = document.getElementById("pnlInput").value;
    const pnl = parseFloat(pnlInputVal);
    const tradesCount = Math.abs(parseInt(document.getElementById("tradesCountInput").value)) || 1;

    if (isNaN(pnl) || pnlInputVal.trim() === "") {
        showToast("กรุณากรอกตัวเลข PnL", "error");
        return;
    }

    const { data } = await client.from("trades").select("*").eq("user_id", user.id).eq("date", selectedDate);

    if (data && data.length > 0) {
        await client.from("trades").update({ pnl, trades_count: tradesCount }).eq("user_id", user.id).eq("date", selectedDate);
    } else {
        await client.from("trades").insert([{ user_id: user.id, date: selectedDate, pnl, trades_count: tradesCount }]);
    }

    closeModal();
    showToast("Trade Saved 📈", "success");
    await refreshDashboard();
}

async function deleteTrade() {
    if (!selectedDate) return;
    await client.from("trades").delete().eq("user_id", user.id).eq("date", selectedDate);
    document.getElementById("confirmModal").style.display = "none";
    closeModal();
    showToast("Trade Deleted", "error");
    await refreshDashboard();
}

function resetTrades() {
    document.getElementById("resetModal").style.display = "flex";
}

async function confirmReset() {
    await client.from("trades").delete().eq("user_id", user.id);
    await client.from("transactions").delete().eq("user_id", user.id);
    document.getElementById("resetModal").style.display = "none";
    showToast("Terminal Reset Complete", "error");
    await refreshDashboard();
}

function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
    if (currentEquityFilter === "month") applyEquityFilterAndDraw();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
    if (currentEquityFilter === "month") applyEquityFilterAndDraw();
}

/* ======================
   LOAD METRICS & STREAK
====================== */
async function loadTrades() {
    const capital = await getTotalCapital();
    const { data } = await client.from("trades").select("*").eq("user_id", user.id).order("date", { ascending: true });

    currentTradesData = data || [];

    if (!data || data.length === 0) {
        animateValue("totalBalance", capital, "$", "", 2);
        animateValue("totalPnL", 0, "$", "", 2);
        animateValue("winrate", 0, "", "%", 1);
        animateValue("totalTrades", 0, "", "", 0);
        animateValue("maxDD", 0, "$", "", 2);

        document.getElementById("profitFactor").innerText = "0.00";
        document.getElementById("riskReward").innerText = "0.00";
        document.getElementById("expectancy").innerText = "$0.00";
        document.getElementById("strategyScore").innerText = "0.0";
        document.getElementById("streakBadge").innerText = "🔥 0 Day Streak";
        document.getElementById("roiPercent").innerText = "ROI: +0.0%";
        document.getElementById("winLossCount").innerText = "0W / 0L Days";
        document.getElementById("avgTradesDay").innerText = "Avg 0.0 / day";

        drawEquity([], []);
        drawWin([]);
        drawPnL([], []);
        return;
    }

    let labels = [];
    let pnlList = [];
    let totalPnL = 0;
    let totalTradesCount = 0;
    let wins = 0;
    let losses = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let peak = 0;
    let maxDD = 0;

    let currentStreak = 0;
    for (let i = data.length - 1; i >= 0; i--) {
        if (Number(data[i].pnl) > 0) currentStreak++;
        else break;
    }

    data.forEach(t => {
        const pnl = Number(t.pnl);
        const count = Number(t.trades_count || 1);

        pnlList.push(pnl);
        totalPnL += pnl;
        totalTradesCount += count;
        labels.push(t.date);

        if (pnl > 0) {
            wins++;
            grossProfit += pnl;
        } else if (pnl < 0) {
            losses++;
            grossLoss += Math.abs(pnl);
        }

        if (totalPnL > peak) peak = totalPnL;
        const dd = peak - totalPnL;
        if (dd > maxDD) maxDD = dd;
    });

    const winrate = (wins / data.length) * 100;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit;
    const avgWin = wins > 0 ? (grossProfit / wins) : 0;
    const avgLoss = losses > 0 ? (grossLoss / losses) : 0;
    const riskReward = avgLoss > 0 ? (avgWin / avgLoss) : avgWin;
    const expectancy = ((wins / data.length) * avgWin) - ((losses / data.length) * avgLoss);

    const pfScore = Math.min(profitFactor / 2, 1) * 40;
    const wrScore = (winrate / 100) * 40;
    const ddPenalty = peak > 0 ? Math.min(maxDD / peak, 1) * 20 : 0;
    const strategyScore = Math.max(0, pfScore + wrScore + (20 - ddPenalty));

    const currentBalance = capital + totalPnL;
    const roi = capital > 0 ? (totalPnL / capital) * 100 : 0;

    const balanceElem = document.getElementById("totalBalance");
    balanceElem.style.color = currentBalance >= 0 ? "#38bdf8" : "#f87171";

    const pnlElem = document.getElementById("totalPnL");
    const pnlCard = document.getElementById("pnlCardGlow");
    pnlElem.style.color = totalPnL >= 0 ? "#4ade80" : "#f87171";
    pnlCard.classList.remove("glow-win", "glow-loss");
    if (totalPnL > 0) pnlCard.classList.add("glow-win");
    if (totalPnL < 0) pnlCard.classList.add("glow-loss");

    animateValue("totalBalance", currentBalance, "$", "", 2);
    animateValue("totalPnL", totalPnL, "$", "", 2);
    animateValue("winrate", winrate, "", "%", 1);
    animateValue("totalTrades", totalTradesCount, "", "", 0);
    animateValue("maxDD", maxDD, "$", "", 2);

    document.getElementById("roiPercent").innerText = `ROI: ${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`;
    document.getElementById("winLossCount").innerText = `${wins}W / ${losses}L Days`;
    document.getElementById("avgTradesDay").innerText = `Avg ${(totalTradesCount / data.length).toFixed(1)} / day`;
    document.getElementById("streakBadge").innerText = `🔥 ${currentStreak} Day Streak`;

    document.getElementById("profitFactor").innerText = profitFactor.toFixed(2);
    document.getElementById("riskReward").innerText = riskReward.toFixed(2);
    document.getElementById("expectancy").innerText = (expectancy >= 0 ? "$" : "-$") + Math.abs(expectancy).toFixed(2);
    document.getElementById("strategyScore").innerText = strategyScore.toFixed(1);

    applyEquityFilterAndDraw();
    drawWin(pnlList);
    drawPnL(labels, pnlList);

    if (document.getElementById("listContainer").style.display !== "none") {
        renderListView();
    }
}

/* ======================
   CHARTS
====================== */
function drawEquity(labels, data) {
    if (equityChart) equityChart.destroy();
    const ctx = document.getElementById("equityChart")?.getContext("2d");
    if (!ctx) return;

    const lastVal = data.length > 0 ? data[data.length - 1] : 0;
    const isPositive = lastVal >= 0;
    const lineColor = isPositive ? "#22c55e" : "#ef4444";

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, isPositive ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)");
    gradient.addColorStop(1, "rgba(2, 6, 23, 0.0)");

    const zeroLine = labels.map(() => 0);

    equityChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Equity ($)",
                    data,
                    borderColor: lineColor,
                    borderWidth: 2.5,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.32,
                    pointBackgroundColor: lineColor,
                    pointRadius: data.length <= 2 ? 4 : 2.5,
                    pointHoverRadius: 6
                },
                {
                    label: "Break-even ($0)",
                    data: zeroLine,
                    borderColor: "rgba(148, 163, 184, 0.35)",
                    borderWidth: 1.2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    filter: (item) => item.datasetIndex === 0,
                    callbacks: { label: (c) => ` Net Equity: ${c.raw >= 0 ? '+' : '-'}$${Math.abs(c.raw).toFixed(2)}` }
                }
            },
            scales: {
                x: { grid: { color: "rgba(255, 255, 255, 0.04)" }, ticks: { color: "#94a3b8", maxTicksLimit: 8, font: { size: 10 } } },
                y: { grid: { color: "rgba(255, 255, 255, 0.04)" }, ticks: { color: "#94a3b8", font: { size: 10 }, callback: (v) => (v >= 0 ? "$" : "-$") + Math.abs(v) } }
            }
        }
    });
}

function drawWin(pnlList) {
    if (winChart) winChart.destroy();
    const ctx = document.getElementById("winChart")?.getContext("2d");
    if (!ctx) return;

    let wins = 0, losses = 0, grossWin = 0, grossLoss = 0;
    pnlList.forEach(p => {
        if (p > 0) {
            wins++;
            grossWin += p;
        } else if (p < 0) {
            losses++;
            grossLoss += Math.abs(p);
        }
    });

    const total = wins + losses;
    const winrate = total > 0 ? (wins / total) * 100 : 0;
    const avgWin = wins > 0 ? grossWin / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const payoff = avgLoss > 0 ? (avgWin / avgLoss) : avgWin;

    const gaugeText = document.getElementById("gaugeWinrate");
    if (gaugeText) gaugeText.innerText = winrate.toFixed(1) + "%";

    const avgWinEl = document.getElementById("avgWinText");
    if (avgWinEl) avgWinEl.innerText = `+$${avgWin.toFixed(2)}`;

    const avgLossEl = document.getElementById("avgLossText");
    if (avgLossEl) avgLossEl.innerText = `-$${avgLoss.toFixed(2)}`;

    const payoffEl = document.getElementById("payoffBadge");
    if (payoffEl) payoffEl.innerText = `PAYOFF ${payoff.toFixed(2)}R`;

    const chartData = total > 0 ? [wins, losses] : [1, 0];
    const chartColors = total > 0
        ? ["#22c55e", "rgba(239, 68, 68, 0.75)"]
        : ["rgba(255, 255, 255, 0.08)", "transparent"];

    winChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Winning Days", "Losing Days"],
            datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderColor: "#0f172a",
                borderWidth: 3,
                hoverOffset: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "74%",
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: total > 0,
                    callbacks: { label: (c) => ` ${c.label}: ${c.raw} days` }
                }
            }
        }
    });
}

function drawPnL(labels, data) {
    if (pnlChart) pnlChart.destroy();
    const ctx = document.getElementById("pnlChart")?.getContext("2d");
    if (!ctx) return;

    const bestDay = data.length > 0 ? Math.max(...data, 0) : 0;
    const worstDay = data.length > 0 ? Math.min(...data, 0) : 0;
    const bestEl = document.getElementById("bestDayBadge");
    const worstEl = document.getElementById("worstDayBadge");
    if (bestEl) bestEl.innerText = `MAX +$${bestDay.toFixed(0)}`;
    if (worstEl) worstEl.innerText = `MIN -$${Math.abs(worstDay).toFixed(0)}`;

    const winGrad = ctx.createLinearGradient(0, 0, 0, 220);
    winGrad.addColorStop(0, "rgba(34, 197, 94, 0.95)");
    winGrad.addColorStop(1, "rgba(34, 197, 94, 0.15)");

    const lossGrad = ctx.createLinearGradient(0, 0, 0, 220);
    lossGrad.addColorStop(0, "rgba(239, 68, 68, 0.15)");
    lossGrad.addColorStop(1, "rgba(239, 68, 68, 0.95)");

    const formattedLabels = labels.map(d => {
        const p = d.split("-");
        return p.length === 3 ? `${p[2]}/${p[1]}` : d;
    });

    const barValuePlugin = {
        id: "barValuePlugin",
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            ctx.save();
            ctx.font = "600 11px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";

            chart.getDatasetMeta(0).data.forEach((bar, index) => {
                const val = data[index];
                if (val === undefined) return;
                const text = (val >= 0 ? "+$" : "-$") + Math.abs(val).toFixed(0);
                ctx.fillStyle = val >= 0 ? "#4ade80" : "#f87171";
                const yPos = val >= 0 ? bar.y - 8 : bar.y + 15;
                ctx.fillText(text, bar.x, yPos);
            });
            ctx.restore();
        }
    };

    pnlChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: formattedLabels,
            datasets: [{
                data,
                backgroundColor: data.map(v => v >= 0 ? winGrad : lossGrad),
                borderColor: data.map(v => v >= 0 ? "#4ade80" : "#f87171"),
                borderWidth: 1.5,
                borderRadius: 8,
                maxBarThickness: 42
            }]
        },
        plugins: [barValuePlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 24, bottom: 8 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => ` Net PnL: ${c.raw >= 0 ? '+' : '-'}$${Math.abs(c.raw).toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        padding: 16,
                        color: "#cbd5e1",
                        font: { family: "'JetBrains Mono', monospace" }
                    }
                },
                y: {
                    grace: "18%",
                    grid: { color: "rgba(255, 255, 255, 0.04)" },
                    ticks: { color: "#64748b", callback: (v) => (v >= 0 ? "$" : "-$") + Math.abs(v) }
                }
            }
        }
    });
}

/* ======================
   SHARE CARD & MINI CHART
====================== */
function setShareTheme(themeName, btnEl) {
    const card = document.getElementById("summaryCard");
    card.classList.remove("theme-cyber", "theme-gold", "theme-minimal");
    card.classList.add(`theme-${themeName}`);

    document.querySelectorAll(".theme-chip").forEach(c => c.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
}

function openSummaryModal() {
    document.getElementById("summaryUsername").innerText = (user?.username || "TRADER").toUpperCase();
    document.getElementById("summaryDate").innerText = document.getElementById("monthYear")?.innerText || "";

    const totalPnLText = document.getElementById("totalPnL")?.innerText || "$0.00";
    const sumPnLEl = document.getElementById("sumTotalPnL");
    sumPnLEl.innerText = totalPnLText;
    sumPnLEl.style.color = totalPnLText.includes("-") ? "#f87171" : "#4ade80";

    document.getElementById("sumWinrate").innerText = document.getElementById("winrate")?.innerText || "0%";
    document.getElementById("sumPF").innerText = document.getElementById("profitFactor")?.innerText || "0.00";
    document.getElementById("sumTrades").innerText = document.getElementById("totalTrades")?.innerText || "0";
    document.getElementById("sumMaxDD").innerText = document.getElementById("maxDD")?.innerText || "$0.00";

    document.getElementById("summaryModal").style.display = "flex";
    drawShareMiniChart();
}

function drawShareMiniChart() {
    if (shareMiniChart) shareMiniChart.destroy();
    const ctx = document.getElementById("shareMiniChart")?.getContext("2d");
    if (!ctx) return;

    let running = 0;
    const points = currentTradesData.map(t => {
        running += Number(t.pnl);
        return running;
    });

    if (points.length === 0) points.push(0, 0);
    const isPos = points[points.length - 1] >= 0;

    shareMiniChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: points.map((_, i) => i),
            datasets: [{
                data: points,
                borderColor: isPos ? "#4ade80" : "#f87171",
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.35,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

async function copySummaryImage() {
    const card = document.getElementById("summaryCard");
    if (!card) return;

    showToast("Generating certificate...", "success");
    const canvas = await html2canvas(card, { scale: 3, backgroundColor: null, useCORS: true });

    canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            showToast("Copied certificate to clipboard! 📋", "success");
        } catch (err) {
            const win = window.open();
            win.document.write(`<img src="${canvas.toDataURL("image/png")}" style="max-width:100%;" />`);
        }
    });
}

async function refreshDashboard() {
    await renderCalendar();
    await loadTrades();
}

function showToast(text, type = "success") {
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toastText");
    toastText.innerText = text;
    toast.classList.remove("success", "error");
    toast.classList.add(type, "show");
    setTimeout(() => toast.classList.remove("show"), 2800);
}