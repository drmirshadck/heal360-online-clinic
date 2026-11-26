/* DotCom by Arshees — routes for the OWN CALENDAR (used when var CALENDAR = "own").
 * Same addresses the website and dashboard already use, so the pages work with either calendar.
 *
 * Website (booking screen):  GET /book/info, GET /book/slots, POST /book/create
 * Patient's manage link:     GET /book/manage, POST /book/cancel, POST /book/reschedule   (signed link, no login)
 * Doctor dashboard (PIN):    GET /bookings, POST /confirm, POST /decline, POST /cancel-booking,
 *                            GET /schedule, POST /schedule, GET /export?month=YYYY-MM (CSV)
 */
import { DEFAULT_SCHEDULE } from "./calendar.js";
import { manageToken } from "./mail.js";
export { manageToken };

const BOOK = ["/book/info", "/book/slots", "/book/create", "/book/manage", "/book/cancel", "/book/reschedule"];
const DOCTOR = ["/bookings", "/confirm", "/decline", "/cancel-booking", "/schedule", "/export"];
export const isOwnPublic = p => BOOK.includes(p);
export const isOwnDoctor = p => DOCTOR.includes(p);

/* hooks: { onNew(doc, booking), onChange(doc, booking, what) } — phone alerts / emails */
export async function ownPublic(req, env, url, p, doctors, hooks = {}) {
  const M = req.method;
  if (p === "/book/info" && M === "GET") {
    const doc = pick(doctors, url.searchParams.get("d"));
    return ok(await call(env, doc, { op: "info", slug: slug(url.searchParams.get("slug")) }));
  }
  if (p === "/book/slots" && M === "GET") {
    const q = url.searchParams, doc = pick(doctors, q.get("d"));
    const from = /^\d{4}-\d{2}-\d{2}$/.test(q.get("from") || "") ? q.get("from") : new Date().toISOString().slice(0, 10);
    return ok(await call(env, doc, { op: "slots", slug: slug(q.get("slug")), from, days: q.get("days") || 14, tz: tzOk(q.get("tz")) }));
  }
  if (p === "/book/create" && M === "POST") {
    await limit(env, req, "bk", 8, 3600, "Too many bookings from this connection. Please try again later or contact the clinic.");
    const b = await body(req);
    const doc = pick(doctors, b.d);
    const name = String(b.name || "").trim().slice(0, 80);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 120);
    const phone = e164(b.phone);
    if (name.length < 2) throw bad(400, "Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw bad(400, "Please enter a valid email address.");
    if (!phone) throw bad(400, "Please enter your WhatsApp number with country code.");
    if (isNaN(Date.parse(b.start))) throw bad(400, "Please choose a time again.");
    const patient = { name, email, phone, notes: String(b.notes || "").trim().slice(0, 800), utr: String(b.utr || "").replace(/\D/g, "").slice(0, 12), tz: tzOk(b.tz) };
    const r = await call(env, doc, { op: "create", slug: slug(b.slug), start: new Date(b.start).toISOString(), patient });
    const t = await manageToken(env, doc.id, r.uid);
    if (hooks.onNew) await later(hooks, () => hooks.onNew(doc, { ...r, ...patient, t, slug: slug(b.slug) }));
    return ok({ uid: r.uid, status: r.status, start: r.start, end: r.end, email, t, emails: !!(env.EMAIL_FROM && (env.ZEPTO_TOKEN || env.ZOHO_REFRESH_TOKEN)) });
  }
  // patient's manage link
  let a = {};
  if (p === "/book/manage" && M === "GET") a = { b: url.searchParams.get("b"), d: url.searchParams.get("d"), t: url.searchParams.get("t") };
  else if ((p === "/book/cancel" || p === "/book/reschedule") && M === "POST") a = await body(req);
  else throw bad(404, "Not found.");
  const doc = pick(doctors, a.d);
  if (!safeEq(String(a.t || ""), await manageToken(env, doc.id, String(a.b || "")))) throw bad(403, "This link is not valid.");
  if (p === "/book/manage") { const v = await call(env, doc, { op: "get", id: a.b }); return ok(publicView(v)); }
  if (p === "/book/cancel") {
    const v = await call(env, doc, { op: "cancel", id: a.b });
    if (hooks.onChange) await later(hooks, async () => hooks.onChange(doc, { ...v, t: a.t }, "cancelled by patient"));
    return ok({ ok: true });
  }
  await limit(env, req, "rs", 10, 3600, "Too many changes. Please contact the clinic.");
  if (isNaN(Date.parse(a.start))) throw bad(400, "Please choose a time again.");
  const v = await call(env, doc, { op: "reschedule", id: a.b, start: new Date(a.start).toISOString() });
  if (hooks.onChange) await later(hooks, async () => hooks.onChange(doc, { ...v, t: a.t }, "time changed by patient"));
  return ok({ ok: true, start: v.start, status: v.status });
}

export async function ownDoctor(req, env, url, p, doc, hooks = {}) {
  const M = req.method;
  if (p === "/bookings" && M === "GET") {
    const r = await call(env, doc, { op: "list" });
    // signed link per booking, so the dashboard can send the patient their consultation-room link
    for (const k of ["pending", "upcoming"]) for (const b of r[k] || []) b.t = await manageToken(env, doc.id, b.uid);
    return ok(r);
  }
  if (p === "/confirm" && M === "POST") { const { uid } = await body(req); const v = await call(env, doc, { op: "confirm", id: uid }); if (hooks.onChange) await later(hooks, async () => hooks.onChange(doc, { ...v, t: await manageToken(env, doc.id, v.uid) }, "confirmed")); return ok({ ok: true }); }
  if (p === "/decline" && M === "POST") { const { uid, reason } = await body(req); const v = await call(env, doc, { op: "decline", id: uid }); if (hooks.onChange) await later(hooks, () => hooks.onChange(doc, { ...v, reason: String(reason || "").slice(0, 300) }, "declined")); return ok({ ok: true }); }
  if (p === "/cancel-booking" && M === "POST") { const { uid, reason } = await body(req); const v = await call(env, doc, { op: "dcancel", id: uid }); if (hooks.onChange) await later(hooks, () => hooks.onChange(doc, { ...v, reason: String(reason || "").slice(0, 300) }, "cancelled by doctor")); return ok({ ok: true }); }
  if (p === "/schedule" && M === "GET") return ok(await call(env, doc, { op: "schedule" }));
  if (p === "/schedule" && M === "POST") { const b = await body(req); return ok(await call(env, doc, { op: "setSchedule", schedule: b.schedule || {} })); }
  if (p === "/export" && M === "GET") {
    const month = url.searchParams.get("month") || "";
    const r = await call(env, doc, { op: "export", month });
    const fmt = iso => new Intl.DateTimeFormat("en-GB", { timeZone: r.tz, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
    const rows = [["Date & time", "Consultation", "Status", "Patient", "Phone", "Email", "UPI ref", "Notes"]]
      .concat(r.rows.map(b => [fmt(b.start), b.title, b.status, b.name, b.phone, b.email, b.utr, b.notes]));
    const csv = "﻿" + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`).join(",")).join("\r\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bookings-${month}.csv"`, "Cache-Control": "no-store" } });
  }
  throw bad(404, "Not found.");
}

/* ---------- helpers ---------- */
function pick(doctors, id) {
  const all = doctors; id = String(id || "main");
  const d = all.find(x => x.id === id) || (all.length === 1 && id === "main" ? all[0] : null);
  if (!d) throw bad(400, "This doctor is not open for online booking.");
  return d;
}
export async function call(env, doc, msg) {
  if (!env.CALS) throw bad(500, "The calendar is not set up yet.");
  const stub = env.CALS.get(env.CALS.idFromName(doc.id));
  const r = await stub.fetch("https://calendar/", { method: "POST", body: JSON.stringify({ ...msg, defaults: defaultsFor(env, doc), who: { id: doc.id, name: doc.name, email: doc.email || "", many: (() => { try { return JSON.parse(env.DOCTORS_JSON || "[]").length > 1; } catch (e) { return false; } })() } }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw bad(r.status, d.error || "Something went wrong. Please try again.");
  return d;
}
function defaultsFor(env, doc) {
  let s = doc.schedule;
  if (!s) { try { s = JSON.parse(env.SCHEDULE_JSON || "{}"); } catch (e) { s = {}; } }
  return { ...DEFAULT_SCHEDULE, ...(s || {}), tz: (s && s.tz) || env.TIMEZONE || DEFAULT_SCHEDULE.tz };
}
function publicView(v) { return { title: v.title, slug: v.slug, start: v.start, end: v.end, status: v.status, name: v.name, canChange: v.canChange }; }
async function limit(env, req, tag, max, ttl, msg) {
  if (!env.PUSH) return;
  const k = tag + ":" + (req.headers.get("cf-connecting-ip") || "x");
  const n = +((await env.PUSH.get(k)) || 0);
  if (n >= max) throw bad(429, msg);
  await env.PUSH.put(k, String(n + 1), { expirationTtl: ttl });
}
function later(hooks, fn) { const p = safe(fn); if (hooks && hooks.bg) { hooks.bg(p); return; } return p; }   // bg: answer the patient/doctor at once, emails/alerts finish in the background
async function safe(fn) { try { await fn(); } catch (e) { /* alerts/emails must never break a booking */ } }
function slug(s) { s = String(s || ""); if (!/^[a-z0-9-]{1,80}$/i.test(s)) throw bad(400, "Bad request."); return s; }
function tzOk(tz) { tz = String(tz || ""); if (tz === "Asia/Calcutta") return "Asia/Kolkata"; try { if (/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz; } } catch (e) {} return "Asia/Kolkata"; }
function e164(s) { let d = String(s || "").replace(/[^\d+]/g, ""); const plus = d.startsWith("+"); d = d.replace(/\D/g, "").replace(/^0+/, ""); if (!d) return ""; if (!plus && d.length === 10) d = "91" + d; return d.length >= 8 && d.length <= 15 ? "+" + d : ""; }
function safeEq(a, b) { if (a.length !== b.length || !a.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function body(req) { try { return await req.json(); } catch (e) { throw bad(400, "Bad request."); } }
function ok(o) { return new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function bad(status, msg) { const e = new Error(msg); e.status = status; e.publicMessage = msg; return e; }
