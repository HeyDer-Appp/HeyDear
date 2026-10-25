// Paste your deployed Google Apps Script web-app URL here (see google-apps-script.gs)
const SHEET_URL = "";

// nav
const burger = document.querySelector(".burger");
const menu = document.querySelector(".nav ul");
burger?.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  burger.setAttribute("aria-expanded", open);
});

// reveal on scroll
const rv = [...document.querySelectorAll(".rv")];
const reveal = () => {
  const lim = innerHeight * 0.94;
  rv.forEach((el, i) => el && el.getBoundingClientRect().top < lim && (el.classList.add("in"), (rv[i] = null)));
};
addEventListener("scroll", reveal, { passive: true });
addEventListener("resize", reveal);
reveal();

// countdown to opening day (1 Nov 2026)
const cd = document.getElementById("countdown");
if (cd) {
  const target = new Date("2026-11-01T00:00:00+05:30").getTime();
  const tick = () => {
    const d = Math.max(0, target - Date.now());
    const v = [Math.floor(d / 864e5), Math.floor(d / 36e5) % 24, Math.floor(d / 6e4) % 60, Math.floor(d / 1e3) % 60];
    cd.querySelectorAll("b").forEach((b, i) => (b.textContent = String(v[i]).padStart(2, "0")));
  };
  tick();
  setInterval(tick, 1000);
}

// waitlist form -> Google Sheet
document.querySelectorAll("form[data-waitlist]").forEach((form) => {
  const msg = form.querySelector(".msg");
  const btn = form.querySelector("button");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    if (f.get("website")) return; // honeypot
    const phone = String(f.get("phone") || "").replace(/\D/g, "");
    if (phone.length < 10) {
      msg.className = "msg err";
      msg.textContent = "Please enter a valid 10-digit WhatsApp number.";
      return;
    }
    f.delete("website");
    f.append("page", location.pathname.split("/").pop() || "index.html");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      if (SHEET_URL) {
        await fetch(SHEET_URL, { method: "POST", mode: "no-cors", body: new URLSearchParams(f) });
      } else {
        console.warn("SHEET_URL not set in js/main.js — entry kept in this browser only.");
        const q = JSON.parse(localStorage.getItem("o5_waitlist") || "[]");
        q.push(Object.fromEntries(f));
        localStorage.setItem("o5_waitlist", JSON.stringify(q));
      }
      form.reset();
      msg.className = "msg ok";
      msg.textContent = "You're in! 🎉 We'll message you before opening day.";
      confetti();
    } catch (err) {
      msg.className = "msg err";
      msg.textContent = "Something went wrong. Please try again or DM us on Instagram.";
    }
    btn.disabled = false;
    btn.textContent = "Join the waiting list";
  });
});

// tiny confetti burst
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#d9744a", "#f7e0a9", "#f3b896", "#c8d4b4", "#8b5a38", "#f6d5c8"];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.setProperty("--dx", (Math.random() - 0.5) * 240 + "px");
    c.style.setProperty("--r", Math.random() * 720 + "deg");
    c.style.animationDelay = Math.random() * 0.4 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2600);
  }
}
