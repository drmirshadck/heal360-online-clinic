/* DotCom by Arshees — booking emails to patients (own calendar).
 *
 * EMAIL_PROVIDER = "zeptomail" (recommended): Zoho ZeptoMail, sender EMAIL_FROM (e.g. yourbooking@arshees.com),
 *   sender NAME = the clinic (CLINIC_NAME). Secret ZEPTO_TOKEN (a "Send Mail" token from the ZeptoMail Mail Agent),
 *   var ZEPTO_HOST = the "Host" shown in the agent's SMTP/API page (e.g. cpaas.zoho.com or api.zeptomail.com).
 * EMAIL_PROVIDER = "zoho": Zoho Mail mailbox API (older option). vars ZOHO_ACCOUNT_ID, ZOHO_DC;
 *   secrets ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN (scope ZohoMail.messages.CREATE only).
 * Both need vars: EMAIL_FROM, CLINIC_NAME, SITE_URL, CLINIC_WHATSAPP (digits).
 * Emails only ever go to the patient of that booking (and, if set, the doctor's own email). Content is fixed text;
 * nothing the patient typed is put in the subject. Failures never stop a booking.
 */

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function mailOn(env) {
  if (!env.EMAIL_FROM) return false;
  if (env.EMAIL_PROVIDER === "zeptomail") return !!env.ZEPTO_TOKEN;
  if (env.EMAIL_PROVIDER === "zoho") return !!env.ZOHO_REFRESH_TOKEN;
  return false;
}

async function zohoToken(env) {
  const k = "zoho:token";
  const hit = env.PUSH && await env.PUSH.get(k);
  if (hit) return hit;
  const dc = (env.ZOHO_DC || "com").replace(/[^a-z.]/g, "");
  const r = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: env.ZOHO_REFRESH_TOKEN, client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, grant_type: "refresh_token" }) });
  const d = await r.json().catch(() => ({}));
  if (!d.access_token) throw new Error("zoho token: " + (d.error || r.status));
  if (env.PUSH) await env.PUSH.put(k, d.access_token, { expirationTtl: Math.max(300, (d.expires_in || 3600) - 300) });
  return d.access_token;
}

export async function sendMail(env, { to, subject, html }) {
  if (!mailOn(env)) return { skipped: true };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(to || ""))) return { skipped: true };
  // at most 30 emails an hour from one helper (protects the Zoho mailbox if someone misuses the booking form)
  if (env.PUSH) {
    const hk = "mailcount:" + new Date().toISOString().slice(0, 13);
    const n = +((await env.PUSH.get(hk)) || 0);
    if (n >= +(env.EMAIL_HOURLY_LIMIT || 30)) return { skipped: true, reason: "hourly limit" };
    await env.PUSH.put(hk, String(n + 1), { expirationTtl: 7200 });
  }
  if (env.EMAIL_PROVIDER === "zeptomail") {
    const host = String(env.ZEPTO_HOST || "api.zeptomail.com").replace(/[^a-z.]/g, "");
    const tok = String(env.ZEPTO_TOKEN).replace(/^Zoho-enczapikey\s+/i, "");
    const r = await fetch(`https://${host}/v1.1/email`, { method: "POST",
      headers: { Authorization: "Zoho-enczapikey " + tok, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ from: { address: env.EMAIL_FROM, name: String(env.CLINIC_NAME || env.EMAIL_FROM_NAME || "Online Clinic").slice(0, 80) },
        to: [{ email_address: { address: to } }], subject, htmlbody: html, track_clicks: false, track_opens: false }) });
    if (!r.ok) throw new Error("zeptomail " + r.status + " " + (await r.text()).slice(0, 200));
    return { ok: true };
  }
  const dc = (env.ZOHO_DC || "com").replace(/[^a-z.]/g, "");
  const from = env.EMAIL_FROM_NAME ? `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>` : env.EMAIL_FROM;
  const send = async tok => fetch(`https://mail.zoho.${dc}/api/accounts/${encodeURIComponent(env.ZOHO_ACCOUNT_ID)}/messages`, {
    method: "POST", headers: { Authorization: "Zoho-oauthtoken " + tok, "Content-Type": "application/json" },
    body: JSON.stringify({ fromAddress: from, toAddress: to, subject, content: html, mailFormat: "html", askReceipt: "no" }) });
  let r = await send(await zohoToken(env));
  if (r.status === 401 && env.PUSH) { await env.PUSH.delete("zoho:token"); r = await send(await zohoToken(env)); }
  if (!r.ok) throw new Error("zoho send " + r.status + " " + (await r.text()).slice(0, 200));
  return { ok: true };
}

/* signed token for the patient's own "change or cancel" link (also used in emails) */
export async function manageToken(env, docId, uid) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(env.SESSION_SECRET || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("manage:" + docId + ":" + uid)));
  let b = ""; for (const c of sig.slice(0, 18)) b += String.fromCharCode(c);
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------- the emails ---------- */
function when(iso, tz) {
  const f = (z, o) => new Intl.DateTimeFormat("en-IN", Object.assign({ timeZone: z }, o)).format(new Date(iso));
  const main = `${f(tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${f(tz, { hour: "numeric", minute: "2-digit" })}`;
  const z = tz === "Asia/Kolkata" ? "India time" : tz.replace(/_/g, " ") + " time";
  return `${main} (${z})`;
}
function shell(env, title, bodyHtml, forDoctor) {
  const clinic = esc(env.CLINIC_NAME || "the clinic");
  const wa = String(env.CLINIC_WHATSAPP || "").replace(/\D/g, "");
  return `<!doctype html><html><body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#1d3239">
<div style="max-width:560px;margin:0 auto;padding:24px 14px">
<div style="background:#ffffff;border-radius:16px;padding:26px 24px">
<p style="margin:0 0 4px;font-size:13px;color:#5d727a;letter-spacing:.04em;text-transform:uppercase">${clinic}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#04244d">${esc(title)}</h1>
${bodyHtml}
${forDoctor ? `<p style="margin:22px 0 0;padding:12px 14px;background:#fff6e5;border-radius:10px;font-size:13px;color:#5d4a1f"><b>Automatic message from your online clinic — please do not reply.</b> Manage bookings in your dashboard.</p>` : `<p style="margin:22px 0 0;padding:12px 14px;background:#fff6e5;border-radius:10px;font-size:13px;color:#5d4a1f"><b>Please do not reply to this email</b> — replies are not read. ${wa ? `For any questions, message ${clinic} on <a href="https://wa.me/${wa}" style="color:#005293">WhatsApp</a>.` : `For any questions, please contact ${clinic}.`}</p>`}
</div>
<p style="text-align:center;font-size:11px;color:#8aa0a8;margin:14px 0 0">${forDoctor ? "DotCom by Arshees · booking system" : `Sent for ${clinic}.`}</p>
</div></body></html>`;
}
function card(rows) {
  return `<table role="presentation" style="width:100%;border-collapse:collapse;background:#eef4f8;border-radius:12px;margin:0 0 18px">${rows.map(([k, v]) =>
    `<tr><td style="padding:10px 14px;font-size:14px;color:#5d727a;width:38%">${esc(k)}</td><td style="padding:10px 14px;font-size:14px;font-weight:bold">${esc(v)}</td></tr>`).join("")}</table>`;
}
const btn = (href, label) => `<p style="margin:0 0 10px"><a href="${esc(href)}" style="display:inline-block;background:#005293;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px;font-size:14px">${esc(label)}</a></p>`;

/* consultation room: the website's own video room (room.html) for the patient's booking; the doctor's link opens it as host */
export function roomLink(env, doc, b, asDoctor) {
  const site = String(env.SITE_URL || "").replace(/\/?$/, "/");
  const d = doc.id !== "main" ? "d=" + encodeURIComponent(doc.id) + "&" : "";
  if (!b || !b.uid) return site + "room.html";
  if (asDoctor) return `${site}room.html?${d}b=${encodeURIComponent(b.uid)}&host=1`;
  return b.t ? `${site}room.html?${d}b=${encodeURIComponent(b.uid)}&t=${encodeURIComponent(b.t)}` : `${site}manage.html?${d}b=${encodeURIComponent(b.uid)}`;
}
export function bookingEmail(env, doc, b, kind, many) {
  const site = String(env.SITE_URL || "").replace(/\/?$/, "/");
  const manage = b.t ? `${site}manage.html?d=${encodeURIComponent(doc.id)}&b=${encodeURIComponent(b.uid)}&t=${encodeURIComponent(b.t)}` : "";
  const room = roomLink(env, doc, b);
  const tz = b.tz || env.TIMEZONE || "Asia/Kolkata";
  const rows = [["Consultation", b.title || "Consultation"]].concat(many ? [["Doctor", doc.name]] : []).concat([["Date & time", when(b.start, tz)], ["Patient", b.name || ""]]);
  const hi = `<p style="margin:0 0 14px;font-size:15px">Dear ${esc(b.name || "patient")},</p>`;
  const clinic = env.CLINIC_NAME || "the clinic";
  const T = {
    received: [`Booking request received – ${clinic}`, "We've received your booking request",
      `${hi}<p style="margin:0 0 16px;font-size:15px">Thank you. The clinic will check your payment and confirm your appointment. You'll get another email when it's confirmed.</p>${card(rows)}${manage ? btn(manage, "View, change or cancel") : ""}`],
    booked: [`Appointment booked – ${clinic}`, "Your appointment is booked",
      `${hi}${card(rows)}<p style="margin:0 0 16px;font-size:15px">At your time, open the consultation room on the clinic's website.</p>${btn(room, "Consultation room")}${manage ? `<p style="margin:0;font-size:14px"><a href="${esc(manage)}" style="color:#005293">Change or cancel</a></p>` : ""}`],
    confirmed: [`Appointment confirmed – ${clinic}`, "Your appointment is confirmed",
      `${hi}<p style="margin:0 0 16px;font-size:15px">Good news — the clinic has confirmed your appointment.</p>${card(rows)}<p style="margin:0 0 16px;font-size:15px">At your time, open the consultation room on the clinic's website.</p>${btn(room, "Consultation room")}${manage ? `<p style="margin:0;font-size:14px"><a href="${esc(manage)}" style="color:#005293">Change or cancel</a></p>` : ""}`],
    declined: [`Booking not possible – ${clinic}`, "Sorry, this booking isn't possible",
      `${hi}<p style="margin:0 0 16px;font-size:15px">The clinic couldn't accept this booking.${b.reason ? " " + esc(b.reason) : ""} If you paid by UPI, the clinic will refund you.</p>${card(rows)}${btn(site + "#book", "Book another time")}`],
    cancelledByDoctor: [`Appointment cancelled – ${clinic}`, "Your appointment is cancelled",
      `${hi}<p style="margin:0 0 16px;font-size:15px">Sorry — the clinic had to cancel this appointment.${b.reason ? " " + esc(b.reason) : ""} If you paid by UPI, the clinic will refund you.</p>${card(rows)}${btn(site + "#book", "Book another time")}`],
    cancelledByPatient: [`Appointment cancelled – ${clinic}`, "Your appointment is cancelled",
      `${hi}<p style="margin:0 0 16px;font-size:15px">As you asked, this appointment is cancelled. If you paid by UPI, the clinic will contact you about a refund.</p>${card(rows)}${btn(site + "#book", "Book a new appointment")}`],
    reminder24: [`Reminder: your appointment tomorrow – ${clinic}`, "Your appointment is tomorrow",
      `${hi}<p style="margin:0 0 16px;font-size:15px">A friendly reminder of your online consultation.</p>${card(rows)}<p style="margin:0 0 16px;font-size:15px">At your time, open the consultation room on the clinic's website. Please use a phone or laptop with a camera, in a quiet place with good internet.</p>${btn(room, "Consultation room")}${manage ? `<p style="margin:0;font-size:14px">Can't make it? <a href="${esc(manage)}" style="color:#005293">Change or cancel</a></p>` : ""}`],
    reminder1: [`Starting soon: your consultation – ${clinic}`, "Your consultation starts in about an hour",
      `${hi}${card(rows)}<p style="margin:0 0 16px;font-size:15px">A few minutes before your time, open the consultation room and allow camera and microphone when asked.</p>${btn(room, "Open consultation room")}`],
    rescheduled: [`New appointment time – ${clinic}`, "Your appointment time is changed",
      `${hi}${card(rows)}${manage ? btn(manage, "View, change or cancel") : ""}`]
  }[kind];
  return T ? { to: b.email, subject: T[0], html: shell(env, T[1], T[2]) } : null;
}

/* ---------- emails to the doctor (their own existing email, "email" in DOCTORS_JSON) ---------- */
function feeFor(env, doc, slug) {
  let sc = doc.schedule; if (!sc) { try { sc = JSON.parse(env.SCHEDULE_JSON || "{}"); } catch (e) { sc = {}; } }
  const t = sc && sc.types && sc.types[slug], p = doc.types && doc.types[slug];   // Pro: fee in DOCTORS_JSON types
  const fee = Number(t && t.fee) || Number(p && p.fee) || 0;
  return fee > 0 ? fee : 0;
}
export function doctorEmail(env, doc, b, kind, many) {
  if (!doc.email) return null;
  const site = String(env.SITE_URL || "").replace(/\/?$/, "/");
  const dash = site + "doctor.html";
  const room = roomLink(env, doc, b, true);
  const tz = env.TIMEZONE || "Asia/Kolkata";
  const fee = feeFor(env, doc, b.slug);
  const pay = fee ? `₹${fee}${b.utr ? " · UPI ref " + b.utr : " · no UPI reference given"}` : (b.utr ? "UPI ref " + b.utr : "");
  const rows = [["Patient", b.name || ""], ["Consultation", b.title || "Consultation"], ["Date & time", when(b.start, tz)]]
    .concat(b.phone ? [["WhatsApp", b.phone]] : []).concat(pay ? [["Payment", pay]] : []).concat(b.reason ? [["Reason", b.reason]] : []);
  const hi = `<p style="margin:0 0 14px;font-size:15px">Dear ${esc(doc.name || "Doctor")},</p>`;
  const who = esc(b.name || "A patient");
  const nm = String(b.name || "Patient").replace(/[<>\r\n]/g, "").slice(0, 60);   // plain text for the subject line
  const T = {
    request: [`New booking request – please check payment – ${nm}`, "New booking request — check the payment",
      `${hi}<p style="margin:0 0 16px;font-size:15px">${who} has booked and says they paid by UPI. Please check your UPI / bank app for the payment, then confirm or decline in your dashboard.</p>${card(rows)}${btn(dash, "Open dashboard to confirm")}`],
    booked: [`New appointment – ${nm}`, "New appointment booked", `${hi}${card(rows)}${btn(dash, "Open dashboard")}`],
    confirmed: [`Payment confirmed – appointment booked – ${nm}`, "Payment confirmed — appointment booked",
      `${hi}<p style="margin:0 0 16px;font-size:15px">You confirmed the payment. The appointment is booked and ${who} has been emailed.</p>${card(rows)}${btn(dash, "Open dashboard")}`],
    declined: [`Booking declined – ${nm}`, "Booking declined",
      `${hi}<p style="margin:0 0 16px;font-size:15px">You declined this booking and ${who} has been told. If they paid, please refund them by UPI.</p>${card(rows)}`],
    cancelledByDoctor: [`Appointment cancelled – ${nm}`, "You cancelled an appointment",
      `${hi}<p style="margin:0 0 16px;font-size:15px">${who} has been told. If they paid, please refund them by UPI.</p>${card(rows)}`],
    cancelledByPatient: [`Patient cancelled – ${nm}`, "A patient cancelled their appointment",
      `${hi}<p style="margin:0 0 16px;font-size:15px">${who} cancelled. The time is free again for other patients. If they paid, please arrange the refund by UPI.</p>${card(rows)}${btn(dash, "Open dashboard")}`],
    rescheduled: [`Patient changed the time – ${nm}`, "A patient changed their appointment time",
      `${hi}<p style="margin:0 0 16px;font-size:15px">${who} moved their appointment to the new time below.</p>${card(rows)}${btn(dash, "Open dashboard")}`],
    reminder24: [`Tomorrow: consultation with ${nm}`, "You have a consultation tomorrow", `${hi}${card(rows)}${btn(dash, "Open dashboard")}`],
    reminder1: [`In 1 hour: consultation with ${nm}`, "Your consultation starts in about an hour", `${hi}${card(rows)}${btn(room, "Open consultation room")}<p style="margin:0;font-size:14px"><a href="${esc(dash)}" style="color:#005293">Open dashboard</a></p>`]
  }[kind];
  return T ? { to: doc.email, subject: T[0], html: shell(env, T[1], T[2], true) } : null;
}
export async function emailDoctor(env, doc, b, kind, many) {
  const m = doctorEmail(env, doc, b, kind, many);
  if (m) return sendMail(env, m);
}

export async function emailPatient(env, doc, b, kind, many) {
  const m = bookingEmail(env, doc, b, kind, many);
  if (m) return sendMail(env, m);
}
