/* DotCom by Arshees — own booking screen (shared by Starter proxy, Standard and Pro helpers).
 *
 * The website shows its own date/time picker and form; this file talks to Cal.com behind
 * the scenes, so patients never see Cal.com. Cal.com still does the real work: free slots,
 * no double-booking, time zones, confirmation emails, webhooks (dashboard, alerts, WhatsApp).
 *
 *   GET  /book/info?d=<doctor>&slug=<event slug>              -> {title, length, confirm, phone, fields}
 *   GET  /book/slots?d=&slug=&from=YYYY-MM-DD&days=14&tz=...  -> {slots: {"YYYY-MM-DD": ["ISO", ...]}}
 *   POST /book/create {d, slug, start, tz, name, email, phone, notes, extra, utr} -> {uid, status, start}
 *
 * Nothing is stored: the booking goes straight into the doctor's own Cal.com.
 * who(docId) must return {key, username} for a known doctor (key may be empty: then the public
 * Cal.com endpoints are used with the username), or null for an unknown doctor.
 */

const CAL = "https://api.cal.com/v2";
const etCache = new Map();

export function isBookPath(p) { return p === "/book/info" || p === "/book/slots" || p === "/book/create"; }

export async function bookRoute(req, url, p, who, kv) {
  const M = req.method;
  if (p === "/book/info" && M === "GET") {
    const { et } = await eventType(who, url.searchParams.get("d"), url.searchParams.get("slug"));
    return ok(publicInfo(et));
  }
  if (p === "/book/slots" && M === "GET") {
    const q = url.searchParams;
    const { et, doc } = await eventType(who, q.get("d"), q.get("slug"));
    const from = /^\d{4}-\d{2}-\d{2}$/.test(q.get("from") || "") ? q.get("from") : new Date().toISOString().slice(0, 10);
    const days = Math.min(Math.max(parseInt(q.get("days") || "14", 10) || 14, 1), 31);
    const end = new Date(new Date(from + "T00:00:00Z").getTime() + days * 864e5).toISOString().slice(0, 10);
    const tz = tzOk(q.get("tz"));
    const qs = new URLSearchParams({ eventTypeId: String(et.id), start: from, end, timeZone: tz });
    const d = await calFetch(doc, "/slots?" + qs, {}, "2024-09-04");
    return ok({ slots: normSlots(d.data || d), tz });
  }
  if (p === "/book/create" && M === "POST") {
    if (kv) {
      const ip = req.headers.get("cf-connecting-ip") || "x", k = "bk:" + ip;
      const n = +((await kv.get(k)) || 0);
      if (n >= 8) throw bad(429, "Too many bookings from this connection. Please try again later or contact the clinic.");
      await kv.put(k, String(n + 1), { expirationTtl: 3600 });
    }
    let b = {}; try { b = await req.json(); } catch (e) { throw bad(400, "Bad request."); }
    const { et, doc } = await eventType(who, b.d, b.slug);
    const name = String(b.name || "").trim().slice(0, 80);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 120);
    const start = new Date(String(b.start || ""));
    if (name.length < 2) throw bad(400, "Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw bad(400, "Please enter a valid email address.");
    if (isNaN(start) || start.getTime() < Date.now() - 6e4) throw bad(400, "Please choose a time again.");
    const phone = e164(b.phone);
    const f = fieldsOf(et);
    const phoneF = f.find(x => x.type === "phone" && !x.hidden);
    if (phoneF && phoneF.required && !phone) throw bad(400, "Please enter your WhatsApp number.");
    const notes = [String(b.notes || "").trim().slice(0, 800), b.utr ? `UPI ref: ${String(b.utr).replace(/\D/g, "").slice(0, 12)}` : ""].filter(Boolean).join("\n");
    const attendee = { name, email, timeZone: tzOk(b.tz), language: "en" };
    const resp = {};
    if (phone && phoneF) { if (phoneF.slug === "attendeePhoneNumber") attendee.phoneNumber = phone; else resp[phoneF.slug] = phone; }
    if (notes) resp.notes = notes;
    const extra = b.extra && typeof b.extra === "object" ? b.extra : {};
    for (const x of customFields(et)) {
      if (x.type === "phone") continue;
      let v = extra[x.slug];
      if (v === undefined || v === "") { if (x.required) throw bad(400, `Please fill in: ${x.label}`); continue; }
      if (x.type === "boolean" || x.type === "checkbox") v = v === true || v === "true";
      else if (x.type === "number") v = Number(v);
      else v = String(v).slice(0, 500);
      resp[x.slug] = v;
    }
    const payload = { start: start.toISOString(), eventTypeId: et.id, attendee, bookingFieldsResponses: resp, metadata: { source: "website" } };
    const d = await calFetch({ key: "" }, "/bookings", { method: "POST", body: JSON.stringify(payload) }, "2024-08-13");
    const bk = Array.isArray(d.data) ? d.data[0] : (d.data || {});
    if (!bk.uid) throw bad(502, "The booking could not be saved. Please try again.");
    return ok({ uid: bk.uid, status: String(bk.status || "").toLowerCase(), start: bk.start || payload.start, email });
  }
  throw bad(404, "Not found.");
}

/* ---------- Cal.com ---------- */
async function eventType(who, docId, slug) {
  docId = String(docId || "main"); slug = String(slug || "");
  if (!/^[a-z0-9-]{1,40}$/i.test(docId) || !/^[a-z0-9-]{1,80}$/i.test(slug)) throw bad(400, "Bad request.");
  const doc = await who(docId);
  if (!doc || (!doc.key && !doc.username)) throw bad(400, "Online booking is not set up for this doctor yet.");
  const ck = docId + "/" + slug, hit = etCache.get(ck);
  if (hit && hit.at > Date.now() - 600e3) return { et: hit.et, doc };
  const qs = new URLSearchParams({ eventSlug: slug });
  if (doc.username) qs.set("username", doc.username);
  const d = await calFetch(doc.username ? { key: "" } : doc, "/event-types?" + qs, {}, "2024-06-14");
  const list = Array.isArray(d.data) ? d.data : (d.data ? [d.data] : []);
  const et = list.find(x => x && x.slug === slug) || (list.length === 1 ? list[0] : null);
  if (!et || !et.id) throw bad(404, "This consultation type is not open for online booking.");
  etCache.set(ck, { et, at: Date.now() });
  return { et, doc };
}
async function calFetch(doc, path, init, version) {
  const h = { "cal-api-version": version, "Content-Type": "application/json" };
  if (doc && doc.key) h.Authorization = `Bearer ${doc.key}`;
  const r = await fetch(CAL + path, { ...init, headers: h });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (data && data.error && (data.error.message || data.error.details && data.error.details.message)) || data.message || "";
    if (/no.*available|not available|already.*booked|booked/i.test(m)) throw bad(409, "Sorry, that time was just taken. Please choose another time.");
    throw bad(r.status === 404 ? 404 : 502, "The calendar could not be reached. Please try again.");
  }
  return data;
}
function fieldsOf(et) { return Array.isArray(et.bookingFields) ? et.bookingFields.map(x => ({ slug: x.slug || x.name, type: x.type, label: x.label || x.slug || x.name, required: !!x.required, hidden: !!x.hidden, options: x.options })) : []; }
const SYSTEM = new Set(["name", "email", "location", "title", "notes", "guests", "rescheduleReason", "attendeePhoneNumber", "smsReminderNumber"]);
function customFields(et) { return fieldsOf(et).filter(x => x.slug && !x.hidden && !SYSTEM.has(x.slug)); }
function publicInfo(et) {
  const f = fieldsOf(et);
  const phoneF = f.find(x => x.type === "phone" && !x.hidden);
  const opt = o => (Array.isArray(o) ? o : []).map(v => typeof v === "string" ? v : (v && (v.value || v.label)) || "").filter(Boolean).slice(0, 30);
  return {
    title: et.title || et.slug, length: et.lengthInMinutes || et.length || 0,
    confirm: !!(et.requiresConfirmation || (et.confirmationPolicy && et.confirmationPolicy.type && et.confirmationPolicy.type !== "none")),
    phone: phoneF ? { required: phoneF.required } : null,
    fields: customFields(et).filter(x => x.type !== "phone").map(x => ({ slug: x.slug, type: x.type, label: String(x.label).slice(0, 120), required: x.required, options: opt(x.options) }))
  };
}
function normSlots(d) {
  const src = d && d.slots && typeof d.slots === "object" ? d.slots : d;
  const out = {};
  if (!src || typeof src !== "object") return out;
  for (const [day, arr] of Object.entries(src)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(arr)) continue;
    const list = arr.map(s => typeof s === "string" ? s : (s && (s.start || s.time))).filter(Boolean);
    if (list.length) out[day] = list;
  }
  return out;
}

/* ---------- small helpers ---------- */
function tzOk(tz) { tz = String(tz || ""); try { if (tz && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz; } } catch (e) {} return "Asia/Kolkata"; }
function e164(s) { let d = String(s || "").replace(/[^\d+]/g, ""); const plus = d.startsWith("+"); d = d.replace(/\D/g, "").replace(/^0+/, ""); if (!d) return ""; if (!plus && d.length === 10) d = "91" + d; return d.length >= 8 && d.length <= 15 ? "+" + d : ""; }
function ok(o) { return new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function bad(status, msg) { const e = new Error(msg); e.status = status; e.publicMessage = msg; return e; }
