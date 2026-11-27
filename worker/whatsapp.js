/* DotCom by Arshees — WhatsApp messages to the PATIENT (official WhatsApp Cloud API, Meta).
 *
 * Messages (each in English or Malayalam, the patient chooses on the booking form):
 *   received   – booking request received (doctor will confirm)
 *   confirmed  – the doctor confirmed it + the video-room link
 *   reminder24 – the day before
 *   reminder30 – 30 minutes before
 *   medicine   – medicine payment link (pays that doctor's own UPI)
 * Every message names the clinic and carries the website address.
 *
 * OFF by default. It only sends when WA_ENABLED = "true" and the number is connected:
 *   vars:    WA_ENABLED, WA_PHONE_ID (the phone-number id from Meta), CLINIC_NAME, SITE_URL
 *   secret:  WA_TOKEN (permanent token of the "notifier" system user)
 * Templates must be created and approved in Meta first: see whatsapp-templates.md (names below).
 * A failed send never stops a booking; the dashboard's "Send link" (opens the doctor's own WhatsApp) stays as the backup.
 */
import { roomLink } from "./mail.js";

export const waOn = env => String(env.WA_ENABLED) === "true" && !!env.WA_PHONE_ID && !!env.WA_TOKEN;

const clean = s => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 300) || "-";
function dt(iso, tz) {
  const f = o => new Intl.DateTimeFormat("en-IN", Object.assign({ timeZone: tz }, o)).format(new Date(iso));
  return { day: f({ weekday: "short", day: "numeric", month: "short" }), time: f({ hour: "numeric", minute: "2-digit" }) };
}
/* -> { name, params } for a template, or null */
export function waMessage(env, doc, b, kind) {
  const tz = env.TIMEZONE || "Asia/Kolkata";
  const clinic = env.CLINIC_NAME || "Online Clinic";
  const site = String(env.SITE_URL || "").replace(/\/?$/, "/");
  const { day, time } = dt(b.start, tz);
  const who = b.name || "Patient", dr = doc.name || "the doctor", svc = b.title || "consultation";
  const room = roomLink(env, doc, b);
  const manage = b.t ? `${site}manage.html?d=${encodeURIComponent(doc.id)}&b=${encodeURIComponent(b.uid)}&t=${encodeURIComponent(b.t)}` : site;
  switch (kind) {
    case "received":   return { name: "booking_received", params: [who, svc, dr, day, time, clinic, site] };
    case "confirmed":  return { name: "booking_confirmed", params: [who, svc, dr, day, time, room, clinic, site] };
    case "reminder24": return { name: "reminder_24h", params: [who, dr, day, time, room, clinic, site] };
    case "reminder30": return { name: "reminder_30m", params: [who, dr, time, room, clinic, site] };
    case "medicine":   return b.med ? { name: "medicine_payment", params: [who, String(b.med.amount), dr, manage, clinic, site] } : null;
  }
  return null;
}
export async function sendWhatsApp(env, doc, b, kind) {
  if (!waOn(env)) return { skipped: true };
  const to = String(b.phone || "").replace(/\D/g, "");
  if (to.length < 10) return { skipped: true };
  const m = waMessage(env, doc, b, kind); if (!m) return { skipped: true };
  const ml = b.lang === "ml";
  const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(env.WA_PHONE_ID)}/messages`, {
    method: "POST",
    headers: { Authorization: "Bearer " + env.WA_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template",
      template: { name: ml ? m.name + "_ml" : m.name, language: { code: ml ? "ml" : "en" },
        components: [{ type: "body", parameters: m.params.map(t => ({ type: "text", text: clean(t) })) }] } })
  });
  if (!r.ok) throw new Error("whatsapp " + r.status + " " + (await r.text()).slice(0, 200));
  return { ok: true };
}
