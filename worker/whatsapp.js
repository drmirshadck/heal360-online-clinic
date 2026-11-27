/* DotCom by Arshees — WhatsApp messages (official WhatsApp Cloud API, Meta), to the PATIENT and to the DOCTOR.
 *
 * Patient (English or Malayalam, the patient chooses on the booking form):
 *   received, confirmed, reminder24 (day before), reminder30 (30 min before), cancelled (declined / cancelled by the clinic),
 *   medicine (payment link, patient only), followup (medicines ending: ONLY when the doctor added a follow-up date)
 * Doctor (English, to the doctor's own "whatsapp" number in DOCTORS_JSON; skipped if no number):
 *   d_request (new booking, check payment), d_cancelled, d_rescheduled (by the patient),
 *   d_reminder24, d_reminder30, d_medpaid (patient says the medicine payment is done)
 * Every message names the clinic and carries the website address.
 *
 * OFF by default. Sends only when WA_ENABLED = "true" and WA_PHONE_ID + secret WA_TOKEN are set.
 * Templates must be created and approved in Meta first: see whatsapp-templates.md.
 * A failed send never stops a booking; "Send link" in the dashboard (the doctor's own WhatsApp) stays as the backup.
 */
import { roomLink } from "./mail.js";

export const waOn = env => String(env.WA_ENABLED) === "true" && !!env.WA_PHONE_ID && !!env.WA_TOKEN;

const clean = s => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 300) || "-";
function dt(iso, tz) {
  const f = o => new Intl.DateTimeFormat("en-IN", Object.assign({ timeZone: tz }, o)).format(new Date(iso));
  return { day: f({ weekday: "short", day: "numeric", month: "short" }), time: f({ hour: "numeric", minute: "2-digit" }) };
}
/* -> { name, params, doctor } for a template, or null */
export function waMessage(env, doc, b, kind) {
  const tz = env.TIMEZONE || "Asia/Kolkata";
  const clinic = env.CLINIC_NAME || "Online Clinic";
  const site = String(env.SITE_URL || "").replace(/\/?$/, "/");
  const { day, time } = dt(b.start, tz);
  const who = b.name || "Patient", dr = doc.name || "the doctor", svc = b.title || "consultation";
  const room = roomLink(env, doc, b);
  const manage = b.t ? `${site}manage.html?d=${encodeURIComponent(doc.id)}&b=${encodeURIComponent(b.uid)}&t=${encodeURIComponent(b.t)}` : site;
  const book = `${site}?doctor=${encodeURIComponent(doc.id)}`;
  const dash = site + "doctor.html", host = roomLink(env, doc, b, true);
  switch (kind) {
    case "received":   return { name: "booking_received", params: [who, svc, dr, day, time, clinic, site] };
    case "confirmed":  return { name: "booking_confirmed", params: [who, svc, dr, day, time, room, clinic, site] };
    case "reminder24": return { name: "reminder_24h", params: [who, dr, day, time, room, clinic, site] };
    case "reminder30": return { name: "reminder_30m", params: [who, dr, time, room, clinic, site] };
    case "cancelled":  return { name: "booking_cancelled", params: [who, svc, dr, day, time, book, clinic, site] };
    case "medicine":   return b.med ? { name: "medicine_payment", params: [who, String(b.med.amount), dr, manage, clinic, site] } : null;
    case "followup": {
      if (!b.fu) return null;
      const f = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(b.fu.date + "T12:00:00Z"));
      return { name: "follow_up", params: [who, dr, f, book, clinic, site] };
    }
    // ---- to the doctor (English) ----
    case "d_request":    return { doctor: true, name: "doctor_new_request", params: [dr, who, svc, day, time, dash, clinic, site] };
    case "d_cancelled":  return { doctor: true, name: "doctor_patient_cancelled", params: [dr, who, day, time, dash, clinic, site] };
    case "d_rescheduled":return { doctor: true, name: "doctor_time_changed", params: [dr, who, day, time, dash, clinic, site] };
    case "d_reminder24": return { doctor: true, name: "doctor_reminder_24h", params: [dr, who, day, time, host, clinic, site] };
    case "d_reminder30": return { doctor: true, name: "doctor_reminder_30m", params: [dr, who, time, host, clinic, site] };
    case "d_medpaid":    return b.med ? { doctor: true, name: "doctor_medicine_paid", params: [dr, who, String(b.med.amount), b.med.ref ? "UPI ref " + String(b.med.ref).replace(/^•+/, "xxxx") : "no UPI ref given", dash, clinic, site] } : null;
  }
  return null;
}
export async function sendWhatsApp(env, doc, b, kind) {
  if (!waOn(env)) return { skipped: true };
  const m = waMessage(env, doc, b, kind); if (!m) return { skipped: true };
  const to = String(m.doctor ? doc.whatsapp : b.phone || "").replace(/\D/g, "");
  if (to.length < 10) return { skipped: true };
  const ml = !m.doctor && b.lang === "ml";
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
