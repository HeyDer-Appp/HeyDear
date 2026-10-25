// Paste your deployed Google Apps Script web-app URL here (see google-apps-script.gs)
const SHEET_URL = "https://script.google.com/macros/s/AKfycbzot5dfEL1GHVSum2-Jh6yGXbKxFKBQJUGo9156XqjZbgqWdjTSBCPULCwd9OTiS1et/exec";
// Email via FormSubmit: main inbox + CC
const MAIL_TO = "Sukhanverma@gmail.com";
const MAIL_CC = "krahit57@gmail.com";

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

// waitlist form -> email (FormSubmit) + Google Sheet
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
    const data = Object.fromEntries(f);
    const mail = fetch("https://formsubmit.co/ajax/" + MAIL_TO, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        ...data,
        _subject: "O5 Pilates waiting list: " + (data.name || "New entry"),
        _cc: MAIL_CC,
        _template: "table",
        _captcha: "false",
      }),
    }).then((r) => r.ok);
    const sheet = SHEET_URL
      ? fetch(SHEET_URL, { method: "POST", mode: "no-cors", body: new URLSearchParams(f) }).then(() => true)
      : Promise.resolve(false);
    try {
      const [mailOk, sheetOk] = (await Promise.allSettled([mail, sheet])).map((r) => r.status === "fulfilled" && r.value);
      if (!mailOk && !sheetOk) throw new Error("not saved");
      form.reset();
      msg.className = "msg ok";
      msg.textContent = "You're on the list. We'll message you before opening day.";
    } catch (err) {
      msg.className = "msg err";
      msg.textContent = "Something went wrong. Please try again or DM us on Instagram.";
    }
    btn.disabled = false;
    btn.textContent = "Join the waiting list";
  });
});
