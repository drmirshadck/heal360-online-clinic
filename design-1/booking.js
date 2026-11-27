/* DotCom by Arshees — booking (drop-in). Built from the template by tools/make-booking-embed.py — do not edit by hand.
   Needs config.js (window.SITE) and qrcode.js before this file; opens on any element with data-book. */
(function () {
const S = window.SITE;
const $ = (q, el = document) => el.querySelector(q);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const D = S.doctor, C = S.contact;
const BASEDOC = { id: "main", name: D.name, photo: D.photo, title: D.role, bio: "", languages: "", calUser: (S.cal && S.cal.username) || "", doctorEmail: (S.cal && S.cal.doctorEmail) || "", roomUrl: (S.video && S.video.roomUrl) || "", upiId: S.payment.upiId, payeeName: S.payment.payeeName, consultations: S.consultations.types };
const DOCS = (S.doctors && S.doctors.length) ? S.doctors.map(d => Object.assign({}, BASEDOC, { bio: "", languages: "", calUser: "", doctorEmail: "", roomUrl: "" }, d, { consultations: (d.consultations && d.consultations.length) ? d.consultations : S.consultations.types })) : [BASEDOC];
let DOC = DOCS[0];
const PAY = () => ({ upiId: DOC.upiId || S.payment.upiId, payeeName: DOC.payeeName || S.payment.payeeName });
const wa = txt => `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(txt)}`;
let T = DOC.consultations;
const setDoc = id => { DOC = DOCS.find(d => d.id === id) || DOCS[0]; T = DOC.consultations; };

/* booking window in its own Shadow DOM: the page's styles can't reach it */
const host = document.createElement("div"); host.id = "dcb-host"; document.body.appendChild(host);
const SR = host.attachShadow({ mode: "open" });
const st0 = document.createElement("style"); st0.textContent = "\n#dcb-ov{--teal:var(--brand);--teal-deep:var(--brand-deep);--coral:var(--accent);--bg:#fff;--soft:color-mix(in srgb,var(--brand) 8%,#fff);--surface:#fff;--fg:#1d3239;--muted:#5d727a;--line:color-mix(in srgb,var(--brand) 14%,#e6e6e6);--on-teal:#fff;--display:\"Outfit\",\"Avenir Next\",\"Segoe UI\",system-ui,sans-serif;--body:\"Nunito Sans\",system-ui,-apple-system,sans-serif;font-family:var(--body);font-size:16px;line-height:1.55;color:var(--fg);text-align:left}\n#dcb-ov[hidden]{display:none!important}\n#dcb-ov *{box-sizing:border-box;letter-spacing:normal}\n#dcb-ov h3{margin:0;font-family:var(--display);color:var(--fg)}\n#dcb-ov p{margin:0}\n#dcb-ov a{color:var(--teal-deep)}\n#dcb-ov .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:999px;padding:12px 22px;font:700 .8rem var(--display);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;text-decoration:none;box-shadow:none;width:auto;min-height:0;transform:none}\n#dcb-ov .btn::before,#dcb-ov .btn::after{display:none}\n#dcb-ov .btn-solid{background:var(--teal);color:var(--on-teal)}\n#dcb-ov .btn:disabled{opacity:.6;cursor:default}\n#dcb-ov.overlay{position:fixed;inset:0;background:rgba(4,30,32,.6);z-index:50;display:grid;place-items:center;padding:16px}\n#dcb-ov .sheet{background:var(--surface);color:var(--fg);border-radius:24px;width:min(540px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:26px;display:grid;gap:18px}\n#dcb-ov .sheet-top{display:flex;justify-content:space-between;align-items:center;gap:12px}\n#dcb-ov .sheet-top h3{font-size:1.25rem}\n#dcb-ov .x{border:0;background:var(--soft);width:36px;height:36px;border-radius:50%;cursor:pointer;color:var(--fg);font-size:18px}\n#dcb-ov .prog{display:flex;gap:6px}\n#dcb-ov .prog i{flex:1;height:4px;border-radius:4px;background:var(--line)}\n#dcb-ov .prog i.on{background:var(--teal)}\n#dcb-ov .opt{display:flex;gap:14px;align-items:center;border:1.5px solid var(--line);border-radius:16px;padding:16px;background:var(--bg);cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}\n#dcb-ov .opt:hover{border-color:var(--teal)}\n#dcb-ov .opt div{flex:1;min-width:0}\n#dcb-ov .opt b{display:block;font-family:var(--display);font-weight:600}\n#dcb-ov .opt span{font-size:.88rem;color:var(--muted)}\n#dcb-ov .opt .fee{font-family:var(--display);font-weight:700;font-size:1.2rem;color:var(--fg);flex:none;font-variant-numeric:tabular-nums}\n#dcb-ov .days{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px}\n#dcb-ov .slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}\n#dcb-ov .chip{border:1.5px solid var(--line);background:var(--bg);color:var(--fg);border-radius:12px;padding:10px 6px;font:600 14px var(--body);cursor:pointer;text-align:center;font-variant-numeric:tabular-nums}\n#dcb-ov .chip small{display:block;font-size:.72rem;color:var(--muted);font-weight:400}\n#dcb-ov .chip[aria-pressed=\"true\"]{border-color:var(--teal);background:var(--soft)}\n#dcb-ov .chip:disabled{opacity:.35;cursor:not-allowed}\n#dcb-ov label.f{display:grid;gap:6px;font-size:.9rem;font-weight:600}\n#dcb-ov input,#dcb-ov textarea,#dcb-ov select{font:16px var(--body);padding:12px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);color:var(--fg);width:100%}\n#dcb-ov textarea{resize:vertical;min-height:80px}\n#dcb-ov .err{color:var(--coral);font-size:.86rem;min-height:1em}\n#dcb-ov .summary{background:var(--soft);border-radius:14px;padding:14px;display:grid;gap:4px;font-size:.94rem}\n#dcb-ov .summary div{display:flex;justify-content:space-between;gap:10px}\n#dcb-ov .qr{display:grid;place-items:center;gap:10px;text-align:center}\n#dcb-ov .qr canvas{width:180px;height:180px;border-radius:12px;background:#fff;padding:10px}\n#dcb-ov .apps{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;font-size:.8rem;color:var(--muted)}\n#dcb-ov .apps span{border:1px solid var(--line);border-radius:999px;padding:3px 10px}\n#dcb-ov .upi{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}\n#dcb-ov .upi span{font-weight:700;user-select:all}\n#dcb-ov .upi button{border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;padding:5px 10px;font:600 13px var(--body);cursor:pointer}\n#dcb-ov .done{text-align:center;display:grid;gap:12px;justify-items:center}\n#dcb-ov .tick{width:64px;height:64px;border-radius:50%;background:var(--teal);color:var(--on-teal);display:grid;place-items:center}\n#dcb-ov .sheet-actions{display:flex;gap:10px;justify-content:space-between}\n#dcb-ov .sheet .btn-ghost{background:transparent;color:var(--fg);border:1.5px solid var(--line)}\n#dcb-ov .small{font-size:.82rem;color:var(--muted)}\n#dcb-ov .qr img,#dcb-ov .qr canvas{width:190px;height:190px;border-radius:12px;background:#fff;padding:10px}\n#dcb-ov .calframe{width:100%;height:min(620px,70dvh);border:0;border-radius:14px;background:var(--bg)}\n#dcb-ov .sheet.wide{width:min(760px,100%)}\n#dcb-ov .paylink{display:none}\n@media (pointer:coarse){#dcb-ov .paylink{display:inline-flex}}\n#dcb-ov .doc-opt{justify-content:flex-start!important;gap:12px;text-align:left}\n#dcb-ov .doc-opt img{width:48px;height:48px;border-radius:50%;object-fit:cover}"; SR.appendChild(st0);
const ovEl = document.createElement("div");
ovEl.className = "overlay"; ovEl.id = "dcb-ov"; ovEl.hidden = true;
ovEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dcb-title"><div class="sheet-top"><h3 id="dcb-title">Book a consultation</h3><button class="x" id="close" aria-label="Close">×</button></div><div class="prog" aria-hidden="true"><i></i><i></i><i></i></div><div id="stepbox"></div></div>`;
SR.appendChild(ovEl);
const vars = ovEl.style;
vars.setProperty("--brand", S.theme.brand); vars.setProperty("--brand-deep", S.theme.brandDeep); vars.setProperty("--accent", S.theme.accent);

/* ---------- booking (same flow as the Dr Murshida site) ----------
   type → UPI payment → doctor's Cal.com calendar (inline) → confirmation.
   Cal.com sends the confirmation email with the video link (consult.html). */
let st = {};
const ov = SR.getElementById("dcb-ov"), box = SR.getElementById("stepbox"), sheet = SR.querySelector(".sheet");
const type = () => T.find(t => t.calSlug === st.type);
const CALU = () => (DOC.calUser || "").trim();
function openBook(slug, docId) {
  st = { step: 0, type: null, utr: "", doc: docId || "" };
  if (docId) setDoc(docId); else if (DOCS.length > 1) st.step = -1; else setDoc(DOCS[0].id);
  ov.hidden = false; document.body.style.overflow = "hidden"; render();
}
document.querySelectorAll("[data-book]").forEach(b => b.addEventListener("click", () => openBook(b.dataset.book || null, b.dataset.doc || (b.dataset.book ? DOCS[0].id : ""))));
const closeSheet = () => { ov.hidden = true; document.body.style.overflow = ""; };
SR.getElementById("close").onclick = closeSheet;
ov.addEventListener("click", e => { if (e.target === ov) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

function copyFrom(btn, id) {
  const el = SR.getElementById(id);
  const sel = () => { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); };
  try { navigator.clipboard.writeText(el.textContent).then(() => btn.textContent = "Copied", sel); } catch (e) { sel(); }
}
ov.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copyFrom(b, b.dataset.copy));

const upiLink = () => `upi://pay?pa=${encodeURIComponent(PAY().upiId)}&pn=${encodeURIComponent(PAY().payeeName)}&am=${type().fee.toFixed(2)}&cu=INR&tn=${encodeURIComponent(type().name)}`;
function prog() { SR.querySelectorAll(".prog i").forEach((i, k) => i.classList.toggle("on", k <= Math.min(Math.max(st.step, 0), 2))); }

/* Cal.com official inline embed loader (same as Murshida site) */
(function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
let calCount = 0, doneAt = 0;
function findEmail(obj, depth) {
  const own = (DOC.doctorEmail || "").toLowerCase();
  if (!obj || depth > 6) return "";
  if (typeof obj === "string") { const m = obj.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/); return m && m[0].toLowerCase() !== own ? m[0] : ""; }
  if (typeof obj !== "object") return "";
  for (const k of Object.keys(obj)) { if (/organizer|user|owner|host/i.test(k)) continue; const r = findEmail(obj[k], depth + 1); if (r) return r; }
  return "";
}

function render() {
  prog(); sheet.classList.toggle("wide", st.step === 2);
  const t = type();
  if (st.step === -1) {
    box.innerHTML = `<p class="small">Choose your doctor.</p><div style="display:grid;gap:10px">${DOCS.map(d => `<button class="opt doc-opt" data-d="${esc(d.id)}"><img src="${esc(d.photo)}" alt=""><div><b>${esc(d.name)}</b><span>${esc(d.title)}</span></div></button>`).join("")}</div>`;
    box.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { setDoc(b.dataset.d); st.doc = DOC.id; st.step = 0; render(); });
    return;
  }
  if (st.step === 0) {
    const fs = k => (T.find(x => x.calSlug === k) || { fee: 0 }).fee;
    const dt = iso => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    box.innerHTML = `${DOCS.length > 1 ? `<div class="summary"><div><span>Doctor</span><b>${esc(DOC.name)}</b></div></div>` : ""}<p class="small">Enter the mobile number you will use for your consultations. We use it to see whether this is a new consultation or a follow-up.</p>
      <label class="f">Mobile number<input id="fp" type="tel" autocomplete="tel" inputmode="tel" value="${esc((st.form && st.form.phone) || "+91 ")}"></label>
      <p class="err" id="e"></p>
      <div id="fres"></div>
      <div class="sheet-actions"><button class="btn btn-solid" id="fgo" style="margin-left:auto">Continue</button></div>
      <p class="small">New consultation ₹${fs("online-video-consultation")}. Follow-up within 7 days is free. Follow-up on days 8 to 14 is ₹${fs("follow-up-paid")}. From day 15 a new consultation applies.</p>`;
    $("#fgo", box).onclick = async () => {
      const e = $("#e", box), b = $("#fgo", box), ph = $("#fp", box).value.trim(), dg = ph.replace(/\D/g, "");
      if (dg.length < 10 || dg.length > 15) return e.textContent = "Please enter your mobile number with country code, e.g. +91 98765 43210.";
      e.textContent = ""; b.disabled = true; b.textContent = "Checking…";
      try {
        const r = await helperGet("/book/fee?" + new URLSearchParams({ d: DOC.id, phone: ph }));
        st.form = st.form || { name: "", email: "", phone: "", notes: "", extra: {} }; st.form.phone = ph;
        st.kind = r.kind; st.type = r.kind === "free" ? "follow-up-free" : r.kind === "paid" ? "follow-up-paid" : "online-video-consultation"; st.info = null;
        const t = type(), msg = r.kind === "free" ? `Free follow-up, valid till ${dt(r.until)}.` : r.kind === "paid" ? `Follow-up consultation ₹${t.fee}, valid till ${dt(r.until)}.` : `New consultation ₹${t.fee}.`;
        $("#fres", box).innerHTML = `<div class="summary"><div><span>${esc(msg)}</span><b>${t.fee > 0 ? "₹" + t.fee : "Free"}</b></div></div>`;
        b.textContent = "Continue";
        setTimeout(() => { st.step = t.fee > 0 ? 1 : 2; render(); }, 1100);
      } catch (x) { e.textContent = (x && x.message) || "Could not check the number. Please try again."; b.disabled = false; b.textContent = "Continue"; }
    };
    if (DOCS.length > 1) { const bk = document.createElement("div"); bk.className = "sheet-actions"; bk.innerHTML = `<button class="btn btn-ghost">Change doctor</button>`; bk.firstChild.onclick = () => { st.step = -1; render(); }; box.appendChild(bk); }
  } else if (st.step === 1) {
    box.innerHTML = `<div class="summary"><div><span>${esc(t.name)} (${esc(t.duration)})</span><b>₹${t.fee}</b></div></div>
      <div class="qr"><div id="qr" aria-label="UPI QR code"></div>
      <b>Scan to pay ₹${t.fee}</b>
      <a class="btn btn-solid paylink" href="${upiLink()}">Pay ₹${t.fee} with UPI app</a>
      <div class="upi"><span>${esc(PAY().payeeName)}</span>·<span id="upi">${esc(PAY().upiId)}</span><button id="cu">Copy UPI ID</button></div>
      <div class="apps"><span>Google Pay</span><span>PhonePe</span><span>Paytm</span><span>BHIM</span></div></div>
      <label class="f" for="utr">UPI transaction reference (optional, helps us verify faster)<input id="utr" inputmode="numeric" value="${esc(st.utr)}" placeholder="12-digit reference from your UPI app"></label>
      <p class="err" id="e"></p>
      <div class="sheet-actions"><button class="btn btn-ghost" id="back">Back</button><button class="btn btn-solid" id="paid">I've paid · choose time</button></div>`;
    drawQR();
    $("#cu", box).onclick = e => copyFrom(e.target, "upi");
    $("#back", box).onclick = () => { st.step = 0; render(); };
    $("#paid", box).onclick = () => {
      const u = $("#utr", box).value.replace(/\D/g, "");
      if (u && u.length !== 12) { $("#e", box).textContent = "The UPI reference has 12 digits. Check it, or leave it empty."; return; }
      st.utr = u; st.step = 2; render();
    };
  } else if (st.step === 2) {
    if (HELP() && !st.embed) { ownBooking(t); return; }
    if (!CALU()) {
      box.innerHTML = `<p>Online booking is being set up. Please message the clinic on WhatsApp to book your time.</p>
        <a class="btn btn-solid" target="_blank" rel="noopener" href="${wa(`Hi, I'd like to book a ${t.name} with ${D.name}.${st.utr ? " UPI ref: " + st.utr : ""}`)}">Message on WhatsApp</a>`;
      return;
    }
    box.innerHTML = `${t.fee > 0 ? `<div class="summary"><div><span>${esc(t.name)}</span><b>₹${t.fee} paid by UPI</b></div></div>` : ""}
      <p class="small">Choose your date and time. Please enter your WhatsApp number so we can send your consultation link.</p>
      <div id="calInline" style="min-height:520px"></div>
      <div class="sheet-actions"><button class="btn btn-ghost" id="back">Back</button></div>`;
    $("#back", box).onclick = () => { st.embed = false; st.step = t.fee > 0 ? 1 : 0; render(); };
    const ns = "b" + (++calCount);
    const cfg = { layout: "month_view", theme: "light" };
    if (st.utr) cfg.notes = `UPI ref: ${st.utr} (₹${t.fee})`;
    Cal("init", ns, { origin: "https://app.cal.com" });
    Cal.ns[ns]("inline", { elementOrSelector: "#calInline", calLink: `${CALU()}/${t.calSlug}`, config: cfg });
    Cal.ns[ns]("ui", { theme: "light", hideEventTypeDetails: false, layout: "month_view", cssVarsPerTheme: { light: { "cal-brand": S.theme.brand } } });
    const onDone = e => showDone(e && e.detail && e.detail.data);
    Cal.ns[ns]("on", { action: "bookingSuccessfulV2", callback: onDone });
    Cal.ns[ns]("on", { action: "bookingSuccessful", callback: onDone });
  } else if (st.t) {
    // booked on DotCom's own calendar
    const paid = t.fee > 0;
    const when = `${fmt(st.start, { weekday: "long", day: "numeric", month: "long" })}, ${fmt(st.start, { hour: "numeric", minute: "2-digit" })}`;
    const pend = st.bstatus === "pending";
    const manage = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}manage.html?d=${encodeURIComponent(DOC.id)}&b=${encodeURIComponent(st.uid)}&t=${encodeURIComponent(st.t)}`;
    box.innerHTML = `<div class="done"><span class="tick"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg></span>
      <h3>${pend ? "Booking request received!" : "Your appointment is booked!"}</h3>
      <div class="summary"><div><span>${esc(st.btitle || "Consultation")}${DOCS.length > 1 ? " · " + esc(DOC.name) : ""}</span><b>${esc(when)}</b></div></div>
      <p style="color:var(--muted)">${pend ? (paid ? "The clinic will check your UPI payment and confirm your appointment." : "The clinic will confirm your appointment.") + (st.emails ? " You'll get an email at <b>" + esc(st.email) + "</b>." : " You'll get a message on WhatsApp.") : (st.emails ? "Details are sent to <b>" + esc(st.email) + "</b>." : "")} At your time, join from this website's <b>Consultation room</b>.</p>
      <div class="sheet-actions" style="flex-wrap:wrap"><button class="btn btn-ghost" id="ics">Add to my calendar</button><a class="btn btn-ghost" href="${esc(manage)}" id="mg">Change or cancel</a></div>
      <p class="small">Keep the <b>Change or cancel</b> link — <a href="#" id="cp">copy link</a>.</p>
      <button class="btn btn-solid" id="ok">Close</button></div>`;
    $("#ok", box).onclick = closeSheet;
    $("#cp", box).onclick = e => { e.preventDefault(); (navigator.clipboard ? navigator.clipboard.writeText(manage) : Promise.reject()).then(() => e.target.textContent = "copied ✓").catch(() => prompt("Copy this link:", manage)); };
    $("#ics", box).onclick = () => {
      const z = d => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const end = st.bend || new Date(Date.parse(st.start) + 30 * 6e4).toISOString();
      const room = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}room.html?${DOC.id !== "main" ? "d=" + encodeURIComponent(DOC.id) + "&" : ""}b=${encodeURIComponent(st.uid)}&t=${encodeURIComponent(st.t)}`;
      const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DotCom by Arshees//Booking//EN", "BEGIN:VEVENT", `UID:${st.uid}@dotcom`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(st.start)}`, `DTEND:${z(end)}`,
        `SUMMARY:${((st.btitle || "Consultation") + " - " + DOC.name).replace(/[,;]/g, " ")}`, `DESCRIPTION:Join at ${room}\\nChange or cancel: ${manage}`, `URL:${room}`,
        "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Consultation in 30 minutes", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "appointment.ics"; document.body.appendChild(a); a.click(); a.remove();
    };
  } else {
    const paid = t.fee > 0;
    box.innerHTML = `<div class="done"><span class="tick"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg></span>
      <h3>${paid ? "Booking request received!" : "Your appointment is booked!"}</h3>
      <p style="color:var(--muted)">${paid ? "We'll verify your UPI payment and confirm your appointment. A <b>confirmation email</b> with your video consultation link will be sent to" : "A <b>confirmation email</b> with your appointment details will be sent to"}</p>
      <p><b>${esc(st.email || "the email address you entered")}</b></p>
      <p class="small">${paid ? "We'll also send the link to your WhatsApp number. " : ""}Please check your Spam / Junk folder if you don't see the email.</p>
      <button class="btn btn-solid" id="ok">Close</button></div>`;
    $("#ok", box).onclick = closeSheet;
  }
}
/* ---------- own booking screen (no Cal.com window) ----------
   Free times come from the helper: DotCom's own calendar (CALENDAR = "own") or, on older setups,
   the doctor's Cal.com behind the scenes. If the helper can't be reached, the old Cal.com calendar
   (or a WhatsApp message) is shown instead (st.embed). */
const HELP = () => ((S.helper && S.helper.url) || "").replace(/\/$/, "");
const TZ = (() => { try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"; return z === "Asia/Calcutta" ? "Asia/Kolkata" : z; } catch (e) { return "Asia/Kolkata"; } })();
const ymd = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const fmt = (iso, o) => { try { return new Intl.DateTimeFormat("en-IN", Object.assign({ timeZone: TZ }, o)).format(new Date(iso)); } catch (e) { return iso; } };
async function helperGet(path) {
  const r = await fetch(HELP() + path); const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || "Could not load times."); e.status = r.status; throw e; } return d;
}
function useEmbed() { st.embed = true; st.sub = ""; render(); }
async function loadSlots(t, more) {
  const q = new URLSearchParams({ d: DOC.id, slug: t.calSlug, tz: TZ });
  const from = more && st.until ? st.until : ymd(new Date());
  q.set("from", from); q.set("days", "14");
  const [info, sl] = await Promise.all([st.info ? Promise.resolve(st.info) : helperGet("/book/info?" + new URLSearchParams({ d: DOC.id, slug: t.calSlug })), helperGet("/book/slots?" + q)]);
  st.info = info;
  st.slots = Object.assign(more ? (st.slots || {}) : {}, sl.slots || {});
  st.until = ymd(new Date(new Date(from + "T12:00:00").getTime() + 14 * 864e5));
}
function ownBooking(t) {
  sheet.classList.add("wide");
  const paidLine = t.fee > 0 ? `<div class="summary"><div><span>${esc(t.name)}</span><b>₹${t.fee} paid by UPI</b></div></div>` : "";
  if (st.sub === "form") return ownForm(t, paidLine);
  if (!st.slots || st.slotsFor !== DOC.id + "/" + t.calSlug) {
    box.innerHTML = `${paidLine}<p class="small" aria-live="polite">Loading available times…</p>`;
    st.slotsFor = DOC.id + "/" + t.calSlug; st.info = null; st.slots = null; st.until = "";
    loadSlots(t).then(() => { if (st.step === 2) render(); }).catch(() => { if (st.step === 2) useEmbed(); });
    return;
  }
  const days = []; const start = new Date(); start.setHours(12, 0, 0, 0);
  const n = Math.round((new Date(st.until + "T12:00:00") - start) / 864e5);
  for (let i = 0; i < n; i++) days.push(ymd(new Date(start.getTime() + i * 864e5)));
  const open = days.filter(d => st.slots[d] && st.slots[d].length);
  if (!st.day || !open.includes(st.day)) st.day = open[0] || "";
  const times = st.day ? st.slots[st.day] : [];
  const part = iso => { const h = +fmt(iso, { hour: "numeric", hourCycle: "h23" }); return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening"; };
  const groups = {}; times.forEach(iso => (groups[part(iso)] = groups[part(iso)] || []).push(iso));
  box.innerHTML = `${paidLine}
    ${st.msg ? `<p class="err">${esc(st.msg)}</p>` : ""}
    <p class="small"><b>Choose a day</b>${TZ !== "Asia/Kolkata" ? ` · times shown in your time (${esc(TZ.replace(/_/g, " "))})` : ""}</p>
    <div class="days">${days.map(d => { const has = st.slots[d] && st.slots[d].length; const dt = d + "T12:00:00"; return `<button class="chip" data-day="${d}" aria-pressed="${d === st.day}" ${has ? "" : "disabled"}><small>${new Date(dt).toLocaleDateString("en-IN", { weekday: "short" })}</small>${new Date(dt).getDate()}<small>${new Date(dt).toLocaleDateString("en-IN", { month: "short" })}</small></button>`; }).join("")}</div>
    <button class="btn btn-ghost" id="more" style="justify-self:start">More dates →</button>
    ${st.day ? `<p class="small"><b>${esc(new Date(st.day + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }))}</b> · ${esc(st.info && st.info.length ? st.info.length + " min" : t.duration)}</p>
      ${Object.entries(groups).map(([g, l]) => `<p class="small" style="margin:6px 0 0">${g}</p><div class="slots">${l.map(iso => `<button class="chip" data-time="${esc(iso)}">${esc(fmt(iso, { hour: "numeric", minute: "2-digit" }))}</button>`).join("")}</div>`).join("")}`
      : `<p>No free times in these dates. Tap <b>More dates</b>, or message the clinic.</p>`}
    <div class="sheet-actions"><button class="btn btn-ghost" id="back">Back</button></div>
    <p class="small" style="text-align:center"><a href="#" id="alt">${CALU() ? "Having trouble? Use the full calendar" : "Having trouble? Message the clinic on WhatsApp"}</a></p>`;
  st.msg = "";
  box.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { st.day = b.dataset.day; render(); });
  box.querySelectorAll("[data-time]").forEach(b => b.onclick = () => { st.time = b.dataset.time; st.sub = "form"; render(); });
  $("#more", box).onclick = e => { e.target.disabled = true; e.target.textContent = "Loading…"; loadSlots(t, true).then(render).catch(() => { e.target.textContent = "Couldn't load — try again"; e.target.disabled = false; }); };
  $("#back", box).onclick = () => { st.slots = null; st.step = t.fee > 0 ? 1 : 0; render(); };
  $("#alt", box).onclick = e => { e.preventDefault(); if (CALU()) useEmbed(); else window.open(wa(`Hello, I would like to book a ${t.name}${DOCS.length > 1 ? " with " + DOC.name : ""}.`), "_blank"); };
}
function ownForm(t, paidLine) {
  const f = st.form || (st.form = { name: "", email: "", phone: "+91 ", notes: "", extra: {} });
  const info = st.info || {}; const phoneReq = !info.phone || info.phone.required;
  const fieldHtml = x => {
    const v = f.extra[x.slug] ?? "", id = "x_" + x.slug, lab = esc(x.label) + (x.required ? "" : " (optional)");
    if (x.type === "textarea") return `<label class="f">${lab}<textarea id="${id}">${esc(v)}</textarea></label>`;
    if ((x.type === "select" || x.type === "radio") && x.options.length) return `<label class="f">${lab}<select id="${id}"><option value=""></option>${x.options.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
    if (x.type === "boolean" || x.type === "checkbox") return `<label class="f" style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="${id}" style="width:auto" ${v === true ? "checked" : ""}>${lab}</label>`;
    return `<label class="f">${lab}<input id="${id}" ${x.type === "number" ? 'inputmode="numeric"' : ""} value="${esc(v)}"></label>`;
  };
  box.innerHTML = `<div class="summary"><div><span>${esc(t.name)}${DOCS.length > 1 ? " · " + esc(DOC.name) : ""}</span><b>${esc(fmt(st.time, { weekday: "short", day: "numeric", month: "short" }))}, ${esc(fmt(st.time, { hour: "numeric", minute: "2-digit" }))}</b></div>${t.fee > 0 ? `<div><span>Fee</span><b>₹${t.fee} paid by UPI</b></div>` : ""}</div>
    <label class="f">Full name<input id="bn" autocomplete="name" value="${esc(f.name)}"></label>
    <label class="f">Email (your confirmation and video link come here)<input id="be" type="email" autocomplete="email" value="${esc(f.email)}"></label>
    <label class="f">WhatsApp number${phoneReq ? "" : " (optional)"}<input id="bp" type="tel" autocomplete="tel" inputmode="tel" value="${esc(f.phone)}"></label>
    ${(info.fields || []).map(fieldHtml).join("")}
    <label class="f">Anything the doctor should know? (optional)<textarea id="bnotes" placeholder="Main complaint, how long, current medicines">${esc(f.notes)}</textarea></label>
    <p class="err" id="e"></p>
    <div class="sheet-actions"><button class="btn btn-ghost" id="back">Change time</button><button class="btn btn-solid" id="go">Confirm booking</button></div>`;
  const save = () => {
    f.name = $("#bn", box).value.trim(); f.email = $("#be", box).value.trim(); f.phone = $("#bp", box).value.trim(); f.notes = $("#bnotes", box).value.trim();
    (info.fields || []).forEach(x => { const el = $("#x_" + x.slug, box); if (el) f.extra[x.slug] = el.type === "checkbox" ? el.checked : el.value.trim(); });
  };
  $("#back", box).onclick = () => { save(); st.sub = ""; render(); };
  $("#go", box).onclick = async () => {
    save(); const e = $("#e", box), go = $("#go", box);
    const digits = f.phone.replace(/\D/g, "");
    if (f.name.length < 2) return e.textContent = "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) return e.textContent = "Please enter a valid email address.";
    if ((phoneReq || digits.length > 3) && (digits.length < 10 || digits.length > 15)) return e.textContent = "Please enter your WhatsApp number with country code, e.g. +91 98765 43210.";
    const miss = (info.fields || []).find(x => x.required && (f.extra[x.slug] === "" || f.extra[x.slug] === undefined || f.extra[x.slug] === false));
    if (miss) return e.textContent = "Please fill in: " + miss.label;
    go.disabled = true; go.textContent = "Booking…"; e.textContent = "";
    try {
      const r = await fetch(HELP() + "/book/create", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ d: DOC.id, slug: t.calSlug, start: st.time, tz: TZ, name: f.name, email: f.email, phone: digits.length > 3 ? f.phone : "", notes: f.notes, extra: f.extra, utr: st.utr }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409) { st.msg = d.error || "That time was just taken. Please choose another."; st.sub = ""; st.slots = null; render(); return; }
      if (!r.ok || !d.uid) throw new Error(d.error || "The booking could not be saved. Please try again.");
      st.email = d.email || f.email; st.uid = d.uid; st.t = d.t || ""; st.start = d.start || st.time; st.bend = d.end || ""; st.bstatus = d.status; st.emails = !!d.emails; st.btitle = t.name;
      st.form = null; st.sub = ""; st.slots = null; st.step = 3; render();
    } catch (x) { e.textContent = x.message; go.disabled = false; go.textContent = "Confirm booking"; }
  };
}
function showDone(data) {
  if (Date.now() - doneAt < 4000) return;   // both Cal events fire for one booking
  doneAt = Date.now(); st.email = findEmail(data, 0); st.step = 3; render();
}
function drawQR() {
  const el = $("#qr", box);
  if (typeof qrcode !== "function") { el.innerHTML = '<p class="small">Use the UPI ID below to pay.</p>'; return; }
  const q = qrcode(0, "M"); q.addData(upiLink()); q.make();
  el.innerHTML = q.createImgTag(6, 0, "UPI QR code");
}

/* ---------- ?doctor=<id>#book opens booking for that doctor ---------- */
(function () { const q = new URLSearchParams(location.search).get("doctor"); if (q && DOCS.length > 1 && DOCS.some(d => d.id === q)) addEventListener("load", () => setTimeout(() => openBook(null, q), 400)); })();
})();
