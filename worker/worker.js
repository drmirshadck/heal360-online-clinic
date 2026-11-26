/* DotCom by Arshees — doctor helper (Cloudflare Worker). Same code for Starter and Standard.
 *
 * PLAN (var): "starter" = email notifications only (no phone alerts); anything else = Standard (phone alerts + email).
 *
 * Keeps the doctor's Cal.com and Daily keys secret and powers doctor.html:
 *   GET  /book/info, /book/slots, POST /book/create -> own booking screen on the website
 *
 * CALENDAR (var):  "own" = DotCom's own calendar (calendar.js + own.js): no Cal.com, no accounts for the doctor,
 *                  bookings kept in a Durable Object per doctor, patient details encrypted with secret DATA_KEY,
 *                  deleted RETAIN_DAYS after the appointment (default 365). Timetable: SCHEDULE_JSON (or "schedule"
 *                  in each DOCTORS_JSON entry) as the starting point; the doctor edits it in the dashboard.
 *                  anything else (default) = Cal.com as before (book.js).
 *   POST /login         {pin}            -> {token}
 *   GET  /bookings      (auth)           -> {pending:[], upcoming:[]}
 *   POST /confirm       (auth) {uid}
 *   POST /decline       (auth) {uid, reason}
 *   POST /host-token    (auth)           -> {token, roomUrl}
 *   GET  /vapid                          -> {key}
 *   POST /subscribe     (auth) {subscription}
 *   POST /cal-webhook   (Cal.com, signed)
 *   GET  /last-event                     -> {type, at}   (no patient details)
 *   GET  /health
 *
 * ONE DOCTOR (default):
 *   Secrets: CAL_API_KEY, DAILY_API_KEY, PIN_HASH
 *   Vars:    DOCTOR_NAME, DAILY_ROOM_URL  e.g. https://drsample.daily.co/consult
 * SEVERAL DOCTORS on one website (each with their own Cal.com, Daily and PIN):
 *   Var:     DOCTORS_JSON  [{"id":"anish","name":"Dr. Anish","roomUrl":"https://..daily.co/consult"}, ...]
 *   Secrets: PINS {"anish":"<hash>",...}, CAL_KEYS {"anish":"cal_live_..."}, DAILY_KEYS {"anish":"..."}
 *   Cal.com webhook per doctor: <helper>/cal-webhook?d=<id>
 *   Each doctor logs in with their own PIN and sees only their own bookings and alerts.
 * Shared secrets: SESSION_SECRET, CAL_WEBHOOK_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_JWK
 * Other vars:
 *   ALLOWED_ORIGINS e.g. https://drsample.com,https://www.drsample.com
 *   DOCTOR_NAME, VAPID_SUBJECT (mailto:support@arshees.com)
 * KV binding: PUSH
 *
 * No patient data is stored. Bookings are read live from Cal.com and passed through.
 * The only stored items are the doctor's push subscriptions and the type/time of the last event.
 */
import { bookRoute, isBookPath } from "./book.js";
import { isOwnPublic, isOwnDoctor, ownPublic, ownDoctor } from "./own.js";
import { emailPatient, emailDoctor } from "./mail.js";
import { isVideoPath, videoRoute } from "./video.js";
export { Room } from "./video.js";        // OWN VIDEO (Durable Object, one per consultation)
export { Calendar } from "./calendar.js";   // OWN CALENDAR (Durable Object, one per doctor)

const CAL = "https://api.cal.com/v2";
const CAL_VERSION = "2024-08-13";
const enc = new TextEncoder();

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    // video room WebSocket: answered as it is (no extra headers on a 101 response)
    if (url.pathname === "/video/ws") { try { return await videoRoute(req, env, url, "/video/ws", videoOpts(env)); } catch (e) { return json({ error: e.publicMessage || "Something went wrong." }, e.status || 500); } }
    try {
      const r = await route(req, env, url, !!cors, ctx);
      if (cors) for (const [k, v] of Object.entries(cors)) r.headers.set(k, v);
      return r;
    } catch (e) {
      const r = json({ error: e.publicMessage || "Something went wrong. Please try again." }, e.status || 500);
      if (cors) for (const [k, v] of Object.entries(cors)) r.headers.set(k, v);
      return r;
    }
  }
};

async function route(req, env, url, fromSite, ctx) {
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const M = req.method;

  if (p === "/health") return json({ ok: true });
  if (p === "/cal-webhook" && M === "POST") return calWebhook(req, env, url.searchParams.get("d") || "");
  if (p === "/vapid" && M === "GET") return json({ key: env.PLAN === "starter" ? "" : (env.VAPID_PUBLIC_KEY || "") });
  if (p === "/last-event" && M === "GET") return json((await env.PUSH.get("lastEvent", "json")) || {});

  // everything below is for the doctor's own website only
  if (!fromSite) throw err(403, "Not allowed.");
  if (p === "/login" && M === "POST") return login(req, env);
  const own = env.CALENDAR === "own";
  if (own && isVideoPath(p)) return videoRoute(req, env, url, p, videoOpts(env, ctx));
  if (own && isOwnPublic(p)) return ownPublic(req, env, url, p, doctors(env), hooks(env, ctx));
  if (!own && isBookPath(p)) return bookRoute(req, url, p, async id => { const d = doctors(env).find(x => x.id === id) || (doctors(env).length === 1 ? doctors(env)[0] : null); return d && d.calKey ? { key: d.calKey, username: "" } : null; }, env.PUSH);

  const doc = await requireSession(req, env);
  if (own && isOwnDoctor(p)) return ownDoctor(req, env, url, p, doc, hooks(env, ctx));
  if (p === "/bookings" && M === "GET") return bookings(env, doc);
  if (p === "/confirm" && M === "POST") {
    const { uid } = await body(req);
    await cal(env, doc, `/bookings/${encodeURIComponent(needUid(uid))}/confirm`, { method: "POST" });
    return json({ ok: true });
  }
  if (p === "/decline" && M === "POST") {
    const { uid, reason } = await body(req);
    await cal(env, doc, `/bookings/${encodeURIComponent(needUid(uid))}/decline`, {
      method: "POST", body: JSON.stringify({ reason: String(reason || "The doctor is not available at this time.").slice(0, 300) })
    });
    return json({ ok: true });
  }
  if (p === "/host-token" && M === "POST") return hostToken(env, doc);
  if (p === "/subscribe" && M === "POST") {
    const { subscription } = await body(req);
    if (!subscription || !/^https:\/\//.test(subscription.endpoint || "")) throw err(400, "Invalid subscription.");
    const subs = ((await env.PUSH.get(subsKey(doc), "json")) || []).filter(s => s.endpoint !== subscription.endpoint);
    subs.push({ endpoint: subscription.endpoint, at: Date.now() });
    await env.PUSH.put(subsKey(doc), JSON.stringify(subs.slice(-10)));
    return json({ ok: true });
  }
  throw err(404, "Not found.");
}

/* ---------- doctors: one (default) or several (DOCTORS_JSON) ---------- */
function jmap(env, k) { try { return JSON.parse(env[k] || "{}") || {}; } catch (e) { return {}; } }
function doctors(env) {
  let list = []; try { list = JSON.parse(env.DOCTORS_JSON || "[]"); } catch (e) {}
  if (!Array.isArray(list) || !list.length) {
    return [{ id: "main", name: env.DOCTOR_NAME || "Doctor", roomUrl: env.DAILY_ROOM_URL || "", calKey: env.CAL_API_KEY, dailyKey: env.DAILY_API_KEY, pinHash: env.PIN_HASH, email: env.DOCTOR_EMAIL || "" }];
  }
  const pins = jmap(env, "PINS"), cals = jmap(env, "CAL_KEYS"), dailies = jmap(env, "DAILY_KEYS");
  return list.filter(d => d && /^[a-z0-9-]{1,40}$/i.test(d.id || "")).map(d => ({ id: d.id, name: d.name || "Doctor", roomUrl: d.roomUrl || "", calKey: cals[d.id], dailyKey: dailies[d.id], pinHash: pins[d.id], schedule: d.schedule, email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email || "") ? d.email : "" }));
}
const subsKey = d => d.id === "main" ? "subs" : "subs:" + d.id;

/* ---------- own video: who is the doctor, and "patient is waiting" alert ---------- */
function videoOpts(env, ctx) {
  return {
    doctors: doctors(env), json, err,
    whoAmI: async r => (await requireSession(r, env)).id,
    onWaiting: async doc => {
      if (env.PLAN === "starter") return;                       // Starter: no phone alerts
      const k = "wait:" + doc.id;
      if (await env.PUSH.get(k)) return;                        // at most one alert every 2 minutes
      await env.PUSH.put(k, "1", { expirationTtl: 120 });
      const many = doctors(env).length > 1;
      const p = (async () => { await env.PUSH.put("lastEvent", JSON.stringify({ type: "waiting", at: Date.now(), doctor: many ? doc.name : "" })); await pushAll(env, subsKey(doc)); })();
      if (ctx) ctx.waitUntil(p); else await p;
    }
  };
}

/* ---------- own calendar: phone alert to the doctor (no patient details in the alert) ---------- */
function hooks(env, ctx) {
  const many = doctors(env).length > 1;
  const alert = async (doc, type) => {
    if (env.PLAN === "starter") return;   // Starter: email only, no phone alerts
    await env.PUSH.put("lastEvent", JSON.stringify({ type, at: Date.now(), doctor: many ? doc.name : "" }));
    await pushAll(env, subsKey(doc));
  };
  const log = kind => e => console.log("email failed", kind, String(e && e.message || e));
  // the patient and the doctor both get an email for every step (doctor: their own email from DOCTORS_JSON)
  const mail = async (doc, b, kind, dkind) => {
    await emailPatient(env, doc, b, kind, many).catch(log(kind));
    await emailDoctor(env, doc, b, dkind || kind, many).catch(log("doctor " + (dkind || kind)));
  };
  return {
    bg: ctx ? p => ctx.waitUntil(p) : null,
    // phone alerts to the doctor never carry patient details; emails go only to that booking's patient
    onNew: async (doc, b) => { await alert(doc, b.status === "pending" ? "request" : "created"); await mail(doc, b, b.status === "pending" ? "received" : "booked", b.status === "pending" ? "request" : "booked"); },
    onChange: async (doc, b, what) => {
      if (what === "confirmed") return mail(doc, b, "confirmed");
      if (what === "declined") return mail(doc, b, "declined");
      if (what === "cancelled by doctor") return mail(doc, b, "cancelledByDoctor");
      if (what === "cancelled by patient") { await alert(doc, "cancelled"); return mail(doc, b, "cancelledByPatient"); }
      if (what === "time changed by patient") { await alert(doc, "rescheduled"); return mail(doc, b, "rescheduled"); }
    }
  };
}

/* ---------- auth ---------- */
async function login(req, env) {
  const ip = req.headers.get("cf-connecting-ip") || "x";
  const key = "fail:" + ip;
  const fails = +((await env.PUSH.get(key)) || 0);
  if (fails >= 8) throw err(429, "Too many wrong attempts. Try again in 15 minutes.");
  const { pin } = await body(req);
  const hash = /^\d{4,8}$/.test(String(pin || "")) ? await sha256hex("dotcom-pin:" + pin) : "";
  const doc = hash ? doctors(env).find(d => safeEq(hash, String(d.pinHash || "").toLowerCase())) : null;
  if (!doc) {
    await env.PUSH.put(key, String(fails + 1), { expirationTtl: 900 });
    throw err(401, "Wrong PIN.");
  }
  const exp = Date.now() + 30 * 24 * 3600 * 1000;
  const payload = b64url(enc.encode(JSON.stringify({ exp, d: doc.id })));
  return json({ token: payload + "." + await hmacB64(env.SESSION_SECRET, payload), exp, doctor: { id: doc.id, name: doc.name } });
}
async function requireSession(req, env) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [payload, sig] = t.split(".");
  if (!payload || !sig || !safeEq(sig, await hmacB64(env.SESSION_SECRET, payload))) throw err(401, "Please log in again.");
  let p = {}; try { p = JSON.parse(new TextDecoder().decode(unb64url(payload))); } catch (e) {}
  if (!(p.exp > Date.now())) throw err(401, "Please log in again.");
  const doc = doctors(env).find(d => d.id === (p.d || "main"));
  if (!doc) throw err(401, "Please log in again.");
  return doc;
}

/* ---------- Cal.com ---------- */
async function cal(env, doc, path, init = {}) {
  const r = await fetch(CAL + path, {
    ...init,
    headers: { "Authorization": `Bearer ${doc.calKey || ""}`, "cal-api-version": CAL_VERSION, "Content-Type": "application/json" }
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw err(502, "Your booking calendar is not connected. Please contact DotCom support (support@arshees.com).");
  if (!r.ok) throw err(502, (data && data.error && data.error.message) || "Cal.com did not accept the request. Please try again.");
  return data;
}
async function bookings(env, doc) {
  const [pend, up] = await Promise.all([
    cal(env, doc, "/bookings?status=unconfirmed&sortStart=asc&take=50"),
    cal(env, doc, "/bookings?status=upcoming&sortStart=asc&take=50")
  ]);
  const list = d => (Array.isArray(d.data) ? d.data : []).map(slim);
  const pending = list(pend);
  const pendingUids = new Set(pending.map(b => b.uid));
  return json({ pending, upcoming: list(up).filter(b => !pendingUids.has(b.uid) && b.status !== "pending") });
}
function slim(b) {
  const a = (b.attendees && b.attendees[0]) || {};
  const f = b.bookingFieldsResponses || b.responses || {};
  const phone = f.whatsapp || f.WhatsApp || f.phone || f.attendeePhoneNumber || a.phoneNumber || "";
  const notes = typeof f.notes === "string" ? f.notes : (b.description || "");
  return {
    uid: b.uid,
    status: String(b.status || "").toLowerCase(),
    title: (b.eventType && (b.eventType.title || b.eventType.slug)) || b.title || "Consultation",
    start: b.start || b.startTime, end: b.end || b.endTime,
    name: a.name || f.name || "Patient",
    email: a.email || f.email || "",
    phone: String(typeof phone === "object" ? (phone.value || "") : phone),
    notes: String(notes || "").slice(0, 500)
  };
}

/* ---------- Daily host token ---------- */
async function hostToken(env, doc) {
  const roomUrl = doc.roomUrl || "";
  const room = roomUrl.split("/").filter(Boolean).pop();
  if (!room) throw err(500, "Video room is not set up yet.");
  const r = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: { "Authorization": `Bearer ${doc.dailyKey || ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { room_name: room, is_owner: true, user_name: doc.name, exp: Math.floor(Date.now() / 1000) + 6 * 3600 } })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.token) throw err(502, "Could not open the video room. Please try again.");
  return json({ token: d.token, roomUrl });
}

/* ---------- Cal.com webhook -> phone notification ---------- */
async function calWebhook(req, env, docId) {
  const raw = await req.text();
  const sig = (req.headers.get("x-cal-signature-256") || "").toLowerCase();
  const expect = await hmacHex(env.CAL_WEBHOOK_SECRET, raw);
  if (!env.CAL_WEBHOOK_SECRET || !safeEq(sig, expect)) return json({ error: "bad signature" }, 401);
  let ev = {}; try { ev = JSON.parse(raw); } catch (e) {}
  const type = String(ev.triggerEvent || "");
  if (type === "PING") return json({ ok: true });
  const known = { BOOKING_REQUESTED: "request", BOOKING_CREATED: "created", BOOKING_CANCELLED: "cancelled", BOOKING_RESCHEDULED: "rescheduled" };
  if (!known[type]) return json({ ok: true, ignored: type });
  const all = doctors(env);
  const doc = all.length === 1 ? all[0] : all.find(d => d.id === docId);
  if (!doc) return json({ error: "unknown doctor: add ?d=<doctor id> to this webhook link" }, 400);
  await env.PUSH.put("lastEvent", JSON.stringify({ type: known[type], at: Date.now(), doctor: all.length > 1 ? doc.name : "" }));
  const sent = await pushAll(env, subsKey(doc));
  return json({ ok: true, sent });
}
async function pushAll(env, key) {
  const subs = (await env.PUSH.get(key, "json")) || [];
  if (!subs.length || !env.VAPID_PRIVATE_JWK) return 0;
  const keep = []; let sent = 0;
  for (const s of subs) {
    try {
      const r = await sendPush(env, s.endpoint);
      if (r.status === 404 || r.status === 410) continue;   // phone unsubscribed
      if (r.ok) sent++;
      keep.push(s);
    } catch (e) { keep.push(s); }
  }
  await env.PUSH.put(key, JSON.stringify(keep));
  return sent;
}
/* Web Push with no payload (no encryption needed). The service worker shows the message. */
async function sendPush(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const jwt = await vapidJWT(env, aud);
  return fetch(endpoint, {
    method: "POST",
    headers: { "TTL": "86400", "Urgency": "high", "Content-Length": "0", "Authorization": `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}` }
  });
}
async function vapidJWT(env, aud) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey("jwk", { ...jwk, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const h = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const p = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "mailto:support@arshees.com" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(h + "." + p));
  return h + "." + p + "." + b64url(new Uint8Array(sig));
}

/* ---------- helpers ---------- */
function corsHeaders(req, env) {
  const o = req.headers.get("origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!o || !allowed.includes(o)) return null;
  return { "Access-Control-Allow-Origin": o, "Vary": "Origin", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Max-Age": "86400" };
}
function json(o, status = 200) { return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function err(status, msg) { const e = new Error(msg); e.status = status; e.publicMessage = msg; return e; }
async function body(req) { try { return await req.json(); } catch (e) { throw err(400, "Bad request."); } }
function needUid(u) { if (!/^[A-Za-z0-9_-]{6,80}$/.test(String(u || ""))) throw err(400, "Bad booking id."); return u; }
function safeEq(a, b) { a = String(a); b = String(b); if (a.length !== b.length || !a.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function b64url(u8) { let s = ""; for (const c of u8) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64url(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function sha256hex(s) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))); }
function hex(u8) { return [...u8].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function hmacKey(secret) { return crypto.subtle.importKey("raw", enc.encode(String(secret || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); }
async function hmacB64(secret, msg) { return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(msg)))); }
async function hmacHex(secret, msg) { return hex(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(msg)))); }
