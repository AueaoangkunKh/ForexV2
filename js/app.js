const supabaseUrl = "https://nkhedvvqjqufwblslzmf.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5raGVkdnZxanF1ZndibHNsem1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzIwNDgsImV4cCI6MjA4ODU0ODA0OH0.S95sIjZr1WzR1isWh8WNM0uRFxdUQCZm7cNOb2kyeuY"

const client = supabase.createClient(supabaseUrl, supabaseKey)

/* =========================
REGISTER
========================= */

async function register() {

    const username = document.getElementById("username").value.trim()
    const password = document.getElementById("password").value.trim()

    const msg = document.getElementById("msg")

    if (!username || !password) {

        msg.innerText = "⚠ Please fill username and password"
        return

    }

    /* insert user */

    const { data, error } = await client
        .from("users")
        .insert([
            {
                username: username,
                password: password
            }
        ])
        .select()

    if (error) {

        if (error.message.includes("duplicate")) {

            msg.innerText = "⚠ Username already exists"

        } else {

            msg.innerText = error.message

        }

        return
    }

    msg.innerText = "✅ Register success! Redirecting..."

    setTimeout(() => {

        window.location = "login.html"

    }, 1500)

}



/* =========================
LOGIN
========================= */

async function login() {

    const username = document.getElementById("username").value.trim()
    const password = document.getElementById("password").value.trim()

    const msg = document.getElementById("msg")
    const card = document.getElementById("card")

    const spinner = document.getElementById("spinner")
    const text = document.getElementById("btnText")

    const userInput = document.getElementById("username")
    const passInput = document.getElementById("password")

    msg.innerText = ""
    userInput.style.border = ""
    passInput.style.border = ""



    if (!username || !password) {

        msg.innerText = "⚠ Please enter username and password"

        card.classList.add("shake")

        setTimeout(() => {

            card.classList.remove("shake")

        }, 300)

        return
    }



    /* loading */

    text.style.display = "none"
    spinner.style.display = "block"



    const { data, error } = await client
        .from("users")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .single()



    text.style.display = "inline"
    spinner.style.display = "none"



    if (error || !data) {

        msg.innerText = "❌ Username or password incorrect"

        userInput.style.border = "2px solid #ef4444"
        passInput.style.border = "2px solid #ef4444"

        card.classList.add("shake")

        setTimeout(() => {

            card.classList.remove("shake")

        }, 400)

        return
    }



    msg.innerText = "✅ Login success"



    /* 🔐 SAVE SESSION (IMPORTANT) */

    localStorage.setItem("user", JSON.stringify(data))



    setTimeout(() => {

        window.location = "dashboard.html"

    }, 600)

}
