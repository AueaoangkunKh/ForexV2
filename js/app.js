// ฟังก์ชันเข้ารหัสรหัสผ่านด้วย SHA-256
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* =========================
   REGISTER
========================= */
async function register() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");
    const btn = document.getElementById("registerBtn");

    if (!username || !password) {
        msg.style.color = "#f87171";
        msg.innerText = "⚠ Please fill username and password";
        return;
    }

    btn.disabled = true;
    const hashedPassword = await hashPassword(password);

    const { error } = await client
        .from("users")
        .insert([{ username: username, password: hashedPassword }])
        .select();

    btn.disabled = false;

    if (error) {
        msg.style.color = "#f87171";
        msg.innerText = error.message.includes("duplicate")
            ? "⚠ Username already exists"
            : error.message;
        return;
    }

    msg.style.color = "#4ade80";
    msg.innerText = "✅ Account created! Redirecting...";
    setTimeout(() => window.location = "login.html", 1200);
}

/* =========================
   LOGIN
========================= */
async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");
    const card = document.getElementById("card");
    const spinner = document.getElementById("spinner");
    const text = document.getElementById("btnText");

    msg.innerText = "";

    if (!username || !password) {
        msg.innerText = "⚠ Please enter username and password";
        card.classList.add("shake");
        setTimeout(() => card.classList.remove("shake"), 300);
        return;
    }

    text.style.display = "none";
    spinner.style.display = "block";

    const hashedPassword = await hashPassword(password);

    // เช็กทั้งรหัสที่เข้ารหัสแล้ว และรหัสเดิม (เผื่อบัญชีเก่าที่สมัครไว้ก่อนอัปเดต)
    const { data, error } = await client
        .from("users")
        .select("*")
        .eq("username", username)
        .or(`password.eq.${hashedPassword},password.eq.${password}`)
        .single();

    text.style.display = "inline";
    spinner.style.display = "none";

    if (error || !data) {
        msg.innerText = "❌ Invalid username or password";
        card.classList.add("shake");
        setTimeout(() => card.classList.remove("shake"), 400);
        return;
    }

    // ถ้ายังเป็นรหัสผ่านแบบเก่า ให้ทำการอัปเกรดเป็นแบบ Hash อัตโนมัติ
    if (data.password === password) {
        await client.from("users").update({ password: hashedPassword }).eq("id", data.id);
    }

    msg.style.color = "#4ade80";
    msg.innerText = "✅ Access Granted";
    localStorage.setItem("user", JSON.stringify({ id: data.id, username: data.username }));

    setTimeout(() => window.location = "dashboard.html", 500);
}