/* DotCom by Arshees — OWN CALENDAR (no Cal.com, no accounts for the doctor).
 *
 * One Durable Object per doctor ("Calendar"). It handles one request at a time, so two
 * patients can never book the same slot. It keeps:
 *   - the doctor's timetable (working hours, breaks, slot lengths, leave)  — no patient data
 *   - bookings: time, type, status in plain; patient name/email/phone/notes ENCRYPTED (AES-GCM, secret DATA_KEY)
 * Old bookings are deleted automatically RETAIN_DAYS after the appointment (default 365).
 *
 * The worker talks to it with POST {op, ...}. Ops:
 *   info, slots, create                       (public booking screen)
 *   get, cancel, reschedule                   (patient's own manage link, token checked by the worker)
 *   list, confirm, decline, dcancel, export   (doctor dashboard, after PIN login)
 *   schedule, setSchedule                     (doctor dashboard: timetable + leave)
 *   noshow, window                            (Pro: mark a patient absent; bookings in a time window for WhatsApp reminders)
 */
import { emailPatient, emailDoctor, manageToken } from "./mail.js";

const DAY = 864e5;
export const DEFAULT_SCHEDULE = {
  tz: "Asia/Kolkata",
  week: { "1": [["10:00", "13:00"], ["17:00", "20:00"]], "2": [["10:00", "13:00"], ["17:00", "20:00"]], "3": [["10:00", "13:00"], ["17:00", "20:00"]],
          "4": [["10:00", "13:00"], ["17:00", "20:00"]], "5": [["10:00", "13:00"], ["17:00", "20:00"]], "6": [["10:00", "13:00"]], "0": [] },
  types: {},              // { "<slug>": { name, length (min), confirm (true = doctor confirms each booking) } }
  defaultLength: 20,      // minutes, for a type not listed above
  gap: 10,                // minutes between patients
  notice: 3,              // hours: earliest booking from now
  ahead: 30,              // days: how far ahead patients can book
  maxPerDay: 0,           // 0 = no limit
  leave: [],              // [{ from: "YYYY-MM-DD", to: "YYYY-MM-DD", note }]
  blocks: []              // [{ start: ISO, end: ISO, note }]  one-off blocked times
};

export class Calendar {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, start INTEGER NOT NULL, "end" INTEGER NOT NULL, slug TEXT NOT NULL, title TEXT,
      status TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, enc TEXT NOT NULL)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS bk_start ON bookings(start)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`);
    for (const col of ["r24", "r1", "absent"]) { try { this.sql.exec(`ALTER TABLE bookings ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`); } catch (e) { /* already there */ } }
  }

  async fetch(req) {
    let a = {}; try { a = await req.json(); } catch (e) {}
    try {
      const r = await this.op(a);
      return Response.json(r);
    } catch (e) {
      return Response.json({ error: e.publicMessage || "Something went wrong. Please try again." }, { status: e.status || 500 });
    }
  }

  async alarm() {
    this.cleanup();
    try { await this.sendReminders(); } catch (e) { console.log("reminders failed", String(e && e.message || e)); }
    await this.ensureAlarm(true);
  }
  /* next wake-up: the next reminder that falls due, or tomorrow (daily clean-up) */
  async ensureAlarm(force) {
    const now = Date.now();
    let next = now + DAY;
    const rows = this.sql.exec(`SELECT start, r24, r1 FROM bookings WHERE status = 'confirmed' AND start > ? ORDER BY start LIMIT 200`, now).toArray();
    for (const b of rows) {
      if (!b.r24 && b.start - DAY > now) next = Math.min(next, b.start - DAY);
      if (!b.r1) next = Math.min(next, Math.max(now + 6e4, b.start - 3600e3));
    }
    const cur = await this.ctx.storage.getAlarm();
    if (force || !cur || cur > next || cur < now - 6e4) await this.ctx.storage.setAlarm(next);
  }
  /* reminder emails for confirmed bookings: ~24 hours and ~1 hour before */
  async sendReminders() {
    const meta = this.meta(); if (!meta.id) return;
    const now = Date.now();
    const rows = this.sql.exec(`SELECT * FROM bookings WHERE status = 'confirmed' AND start > ? AND start < ? AND (r24 = 0 OR r1 = 0)`, now + 5 * 6e4, now + DAY + 10 * 6e4).toArray();
    for (const r of rows) {
      const left = r.start - now;
      let kind = "";
      if (!r.r1 && left <= 3600e3 + 2 * 6e4) kind = "reminder1";
      else if (!r.r24 && left <= DAY + 2 * 6e4 && left > 3 * 3600e3) kind = "reminder24";
      if (!kind) continue;
      // mark first, so a retry never sends twice; booked inside 24 h -> no "tomorrow" email
      this.sql.exec(kind === "reminder1" ? `UPDATE bookings SET r1 = 1, r24 = 1 WHERE id = ?` : `UPDATE bookings SET r24 = 1 WHERE id = ?`, r.id);
      const v = await this.view(r);
      const t = await manageToken(this.env, meta.id, r.id);
      const doc = { id: meta.id, name: meta.name, email: meta.email || "" };
      await emailPatient(this.env, doc, { ...v, t }, kind, meta.many).catch(e => console.log("reminder email failed", String(e && e.message || e)));
      await emailDoctor(this.env, doc, v, kind, meta.many).catch(e => console.log("doctor reminder email failed", String(e && e.message || e)));
    }
  }
  meta() { const row = this.sql.exec(`SELECT v FROM kv WHERE k = 'who'`).toArray()[0]; try { return row ? JSON.parse(row.v) : {}; } catch (e) { return {}; } }
  cleanup() {
    const days = Math.max(parseInt(this.env.RETAIN_DAYS || "365", 10) || 365, 30);
    this.sql.exec(`DELETE FROM bookings WHERE "end" < ?`, Date.now() - days * DAY);
    this.sql.exec(`UPDATE bookings SET status = 'expired', updated = ? WHERE status = 'pending' AND start < ?`, Date.now(), Date.now());
  }

  /* ---------- settings ---------- */
  schedule(defaults) {
    const row = this.sql.exec(`SELECT v FROM kv WHERE k = 'schedule'`).toArray()[0];
    let saved = {}; try { saved = row ? JSON.parse(row.v) : {}; } catch (e) {}
    return Object.assign({}, DEFAULT_SCHEDULE, defaults || {}, saved);
  }
  typeOf(s, slug) {
    const t = (s.types || {})[slug];
    if (t) return { name: t.name || slug, length: clampInt(t.length, 5, 240, s.defaultLength), confirm: t.confirm !== false };
    if (Object.keys(s.types || {}).length) return null;              // types are listed and this isn't one of them
    return { name: slug.replace(/-/g, " "), length: clampInt(s.defaultLength, 5, 240, 20), confirm: true };
  }

  /* ---------- slots ---------- */
  active(from, to) {
    return this.sql.exec(`SELECT id, start, "end" FROM bookings WHERE status IN ('pending','confirmed') AND "end" > ? AND start < ?`, from, to).toArray();
  }
  freeSlots(s, type, fromMs, toMs, ignoreId) {
    const now = Date.now();
    const earliest = now + (Number(s.notice) || 0) * 3600e3;
    const latest = now + clampInt(s.ahead, 1, 365, 30) * DAY;
    fromMs = Math.max(fromMs, earliest); toMs = Math.min(toMs, latest);
    if (toMs <= fromMs) return [];
    const len = type.length * 6e4, gap = clampInt(s.gap, 0, 120, 0) * 6e4, step = len + gap;
    const busy = this.active(fromMs - DAY, toMs + DAY).filter(b => b.id !== ignoreId);
    const blocks = (s.blocks || []).map(b => [Date.parse(b.start), Date.parse(b.end)]).filter(x => x[0] < x[1]);
    const leave = (s.leave || []).filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l.from || ""));
    const out = [];
    // walk the doctor's local days
    let day = localDate(fromMs - DAY, s.tz);
    const lastDay = localDate(toMs + DAY, s.tz);
    for (let guard = 0; day <= lastDay && guard < 400; guard++, day = addDays(day, 1)) {
      if (leave.some(l => day >= l.from && day <= (l.to || l.from))) continue;
      const wd = String(new Date(day + "T12:00:00Z").getUTCDay());
      const wins = (s.week || {})[wd] || [];
      let count = s.maxPerDay > 0 ? busy.filter(b => localDate(b.start, s.tz) === day).length : 0;
      for (const w of wins) {
        if (!Array.isArray(w) || !/^\d\d:\d\d$/.test(w[0]) || !/^\d\d:\d\d$/.test(w[1])) continue;
        const ws = zoned(day, w[0], s.tz), we = zoned(day, w[1], s.tz);
        for (let t = ws; t + len <= we; t += step) {
          if (t < fromMs || t >= toMs) continue;
          if (s.maxPerDay > 0 && count >= s.maxPerDay) break;
          const e = t + len;
          if (busy.some(b => t < b.end + gap && e + gap > b.start)) continue;
          if (blocks.some(([bs, be]) => t < be && e > bs)) continue;
          out.push(t);
        }
      }
    }
    return out;
  }

  /* ---------- ops ---------- */
  async op(a) {
    if (a.who && a.who.id) this.sql.exec(`INSERT INTO kv (k, v) VALUES ('who', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, JSON.stringify({ id: a.who.id, name: a.who.name, email: a.who.email || "", many: !!a.who.many }));
    try { return await this.op2(a); } finally { await this.ensureAlarm(); }
  }
  async op2(a) {
    const s = this.schedule(a.defaults);
    switch (a.op) {
      case "info": {
        const t = this.typeOf(s, a.slug); if (!t) throw bad(404, "This consultation type is not open for online booking.");
        return { title: t.name, length: t.length, confirm: t.confirm, phone: { required: true }, fields: [] };
      }
      case "slots": {
        const t = this.typeOf(s, a.slug); if (!t) throw bad(404, "This consultation type is not open for online booking.");
        const from = Date.parse(a.from + "T00:00:00Z") - 14 * 3600e3;   // a little before, trimmed by tz grouping below
        const to = from + (clampInt(a.days, 1, 31, 14) + 1) * DAY;
        const tz = a.tz || s.tz;
        const slots = {};
        for (const ms of this.freeSlots(s, t, from, to)) {
          const d = localDate(ms, tz);
          if (d < a.from) continue;
          (slots[d] = slots[d] || []).push(new Date(ms).toISOString());
        }
        return { slots, tz };
      }
      case "create": {
        const t = this.typeOf(s, a.slug); if (!t) throw bad(404, "This consultation type is not open for online booking.");
        const start = Date.parse(a.start);
        if (!this.freeSlots(s, t, start - 1, start + 1).includes(start)) throw bad(409, "Sorry, that time was just taken. Please choose another time.");
        const id = newId();
        const status = t.confirm ? "pending" : "confirmed";
        const p = a.patient || {};
        const enc = await this.seal({ name: p.name, email: p.email, phone: p.phone, notes: p.notes, utr: p.utr, tz: p.tz });
        this.sql.exec(`INSERT INTO bookings (id, start, "end", slug, title, status, created, updated, enc, r24, r1) VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
          id, start, start + t.length * 6e4, a.slug, t.name, status, Date.now(), Date.now(), enc, start - Date.now() < 26 * 3600e3 ? 1 : 0);
        return { uid: id, status, start: new Date(start).toISOString(), end: new Date(start + t.length * 6e4).toISOString(), title: t.name };
      }
      case "get": {
        const b = this.row(a.id); if (!b) throw bad(404, "This booking was not found.");
        return { ...(await this.view(b)), canChange: this.canChange(b) };
      }
      case "cancel": case "dcancel": case "decline": {
        const b = this.row(a.id); if (!b) throw bad(404, "This booking was not found.");
        if (a.op === "cancel" && !this.canChange(b)) throw bad(409, "This booking can no longer be changed online. Please contact the clinic.");
        if (!["pending", "confirmed"].includes(b.status)) throw bad(409, "This booking is already " + b.status + ".");
        const st = a.op === "decline" ? "declined" : "cancelled";
        this.sql.exec(`UPDATE bookings SET status = ?, updated = ? WHERE id = ?`, st, Date.now(), b.id);
        return { ok: true, ...(await this.view({ ...b, status: st })) };
      }
      case "confirm": {
        const b = this.row(a.id); if (!b) throw bad(404, "This booking was not found.");
        if (b.status !== "pending") throw bad(409, "This booking is already " + b.status + ".");
        this.sql.exec(`UPDATE bookings SET status = 'confirmed', updated = ? WHERE id = ?`, Date.now(), b.id);
        return { ok: true, ...(await this.view({ ...b, status: "confirmed" })) };
      }
      case "reschedule": {
        const b = this.row(a.id); if (!b) throw bad(404, "This booking was not found.");
        if (!this.canChange(b)) throw bad(409, "This booking can no longer be changed online. Please contact the clinic.");
        const t = this.typeOf(s, b.slug) || { length: Math.round((b.end - b.start) / 6e4), confirm: true };
        const start = Date.parse(a.start);
        if (!this.freeSlots(s, t, start - 1, start + 1, b.id).includes(start)) throw bad(409, "Sorry, that time was just taken. Please choose another time.");
        this.sql.exec(`UPDATE bookings SET start = ?, "end" = ?, updated = ?, r24 = ?, r1 = 0 WHERE id = ?`, start, start + t.length * 6e4, Date.now(), start - Date.now() < 26 * 3600e3 ? 1 : 0, b.id);
        return { ok: true, ...(await this.view({ ...b, start, end: start + t.length * 6e4 })) };
      }
      case "list": {
        const now = Date.now();
        const rows = this.sql.exec(`SELECT * FROM bookings WHERE "end" > ? AND status IN ('pending','confirmed') ORDER BY start LIMIT 200`, now - 2 * 3600e3).toArray();
        const all = await Promise.all(rows.map(r => this.view(r)));
        const past = this.sql.exec(`SELECT * FROM bookings WHERE "end" <= ? AND "end" > ? AND status = 'confirmed' ORDER BY start DESC LIMIT 50`, now - 2 * 3600e3, now - 7 * DAY).toArray();
        return { own: true, emails: !!(this.env.EMAIL_FROM && (this.env.ZEPTO_TOKEN || this.env.ZOHO_REFRESH_TOKEN)), pending: all.filter(b => b.status === "pending"), upcoming: all.filter(b => b.status === "confirmed"),
          past: await Promise.all(past.map(r => this.view(r))) };
      }
      case "noshow": {
        const b = this.row(a.id); if (!b) throw bad(404, "This booking was not found.");
        if (b.status !== "confirmed" || b.start > Date.now()) throw bad(409, "Only a past confirmed consultation can be marked as no-show.");
        this.sql.exec(`UPDATE bookings SET absent = 1, updated = ? WHERE id = ?`, Date.now(), b.id);
        return { ok: true };
      }
      case "window": {
        const from = Number(a.from) || 0, to = Number(a.to) || 0;
        const rows = this.sql.exec(`SELECT * FROM bookings WHERE start >= ? AND start < ? AND status = 'confirmed' ORDER BY start LIMIT 300`, from, to).toArray();
        return { rows: await Promise.all(rows.map(r => this.view(r))) };
      }
      case "export": {
        const m = /^(\d{4})-(\d{2})$/.exec(a.month || ""); if (!m) throw bad(400, "Choose a month.");
        const from = zoned(`${m[1]}-${m[2]}-01`, "00:00", s.tz);
        const next = +m[2] === 12 ? `${+m[1] + 1}-01-01` : `${m[1]}-${String(+m[2] + 1).padStart(2, "0")}-01`;
        const to = zoned(next, "00:00", s.tz);
        const rows = this.sql.exec(`SELECT * FROM bookings WHERE start >= ? AND start < ? ORDER BY start`, from, to).toArray();
        return { tz: s.tz, rows: await Promise.all(rows.map(r => this.view(r))) };
      }
      case "schedule": return { schedule: s };
      case "setSchedule": {
        const clean = cleanSchedule(a.schedule || {}, s);
        this.sql.exec(`INSERT INTO kv (k, v) VALUES ('schedule', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, JSON.stringify(clean));
        return { schedule: this.schedule(a.defaults) };
      }
    }
    throw bad(400, "Unknown request.");
  }

  row(id) { return /^[A-Za-z0-9_-]{8,40}$/.test(String(id || "")) ? this.sql.exec(`SELECT * FROM bookings WHERE id = ?`, id).toArray()[0] : null; }
  canChange(b) {
    const cut = (Number(this.env.CHANGE_CUTOFF_HOURS) >= 0 && this.env.CHANGE_CUTOFF_HOURS !== undefined ? Number(this.env.CHANGE_CUTOFF_HOURS) : 2) * 3600e3;
    return ["pending", "confirmed"].includes(b.status) && b.start - Date.now() > cut;
  }
  async view(b) {
    const p = await this.open(b.enc);
    return { uid: b.id, status: b.status, title: b.title || b.slug, slug: b.slug, start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString(),
      name: p.name || "Patient", email: p.email || "", phone: p.phone || "", notes: p.notes || "", utr: p.utr || "", tz: p.tz || "", absent: !!b.absent, created: new Date(b.created).toISOString() };
  }

  /* ---------- encryption of patient details ---------- */
  async key() {
    if (this._key) return this._key;
    const raw = String(this.env.DATA_KEY || "");
    if (raw.length < 32) throw bad(500, "Booking storage is not set up yet (DATA_KEY).");
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("dotcom-data:" + raw));
    return (this._key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]));
  }
  async seal(obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await this.key(), new TextEncoder().encode(JSON.stringify(obj))));
    return b64(iv) + "." + b64(ct);
  }
  async open(s) {
    try {
      const [iv, ct] = String(s).split(".");
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await this.key(), unb64(ct));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) { return {}; }
  }
}

/* ---------- schedule cleaning (what the doctor may change from the dashboard) ---------- */
function cleanSchedule(n, cur) {
  const out = {};
  const hm = x => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x || ""));
  if (n.week && typeof n.week === "object") {
    out.week = {};
    for (const d of ["0", "1", "2", "3", "4", "5", "6"]) {
      const wins = Array.isArray(n.week[d]) ? n.week[d] : [];
      out.week[d] = wins.filter(w => Array.isArray(w) && hm(w[0]) && hm(w[1]) && w[0] < w[1]).slice(0, 6).map(w => [w[0], w[1]]);
    }
  }
  if (n.leave !== undefined) out.leave = (Array.isArray(n.leave) ? n.leave : []).filter(l => l && /^\d{4}-\d{2}-\d{2}$/.test(l.from || "") && (!l.to || (/^\d{4}-\d{2}-\d{2}$/.test(l.to) && l.to >= l.from)))
    .slice(0, 100).map(l => ({ from: l.from, to: l.to || l.from, note: String(l.note || "").slice(0, 80) }));
  if (n.blocks !== undefined) out.blocks = (Array.isArray(n.blocks) ? n.blocks : []).filter(b => b && !isNaN(Date.parse(b.start)) && Date.parse(b.end) > Date.parse(b.start))
    .slice(0, 100).map(b => ({ start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString(), note: String(b.note || "").slice(0, 80) }));
  if (n.gap !== undefined) out.gap = clampInt(n.gap, 0, 120, cur.gap);
  if (n.notice !== undefined) out.notice = clampInt(n.notice, 0, 168, cur.notice);
  if (n.ahead !== undefined) out.ahead = clampInt(n.ahead, 1, 180, cur.ahead);
  if (n.maxPerDay !== undefined) out.maxPerDay = clampInt(n.maxPerDay, 0, 200, 0);
  if (n.types && typeof n.types === "object") {
    out.types = {};
    for (const [slug, t] of Object.entries(n.types).slice(0, 20)) {
      if (!/^[a-z0-9-]{1,80}$/i.test(slug) || !t) continue;
      out.types[slug] = { name: String(t.name || slug).slice(0, 80), length: clampInt(t.length, 5, 240, 20), confirm: t.confirm !== false };
    }
  }
  return Object.assign({}, savedOnly(cur), out);   // a partial save keeps everything else as it was
}
function savedOnly(cur) {
  // everything except tz / defaultLength comes from the doctor; keep current values so a partial save doesn't reset others
  const o = {}; for (const k of ["week", "leave", "blocks", "gap", "notice", "ahead", "maxPerDay", "types"]) if (cur[k] !== undefined) o[k] = cur[k];
  return o;
}

/* ---------- time zone helpers (no libraries) ---------- */
function parts(ms, tz) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const o = {}; for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}
export function localDate(ms, tz) { const p = parts(ms, tz); return `${p.year}-${p.month}-${p.day}`; }
function offset(ms, tz) { const p = parts(ms, tz); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000; }
export function zoned(day, hm, tz) {          // local "YYYY-MM-DD" + "HH:MM" in tz -> UTC ms
  const [y, m, d] = day.split("-").map(Number), [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offset(guess, tz);
  t = guess - offset(t, tz);
  return t;
}
function addDays(day, n) { const t = new Date(day + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }

/* ---------- small helpers ---------- */
function clampInt(v, lo, hi, dflt) { const n = parseInt(v, 10); return isNaN(n) ? dflt : Math.min(Math.max(n, lo), hi); }
function newId() { return b64(crypto.getRandomValues(new Uint8Array(15))); }
function b64(u8) { let s = ""; for (const c of u8) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64(s) { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function bad(status, msg) { const e = new Error(msg); e.status = status; e.publicMessage = msg; return e; }
