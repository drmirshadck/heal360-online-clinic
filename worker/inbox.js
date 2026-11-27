/* DotCom by Arshees — WhatsApp inbox inside the website.
 *
 * Patients reply to the clinic's WhatsApp number. Meta sends each reply to  <helper>/wa-webhook ;
 * the helper keeps the chat (encrypted) and the doctors read and answer it on  inbox.html .
 * The page is locked: each doctor opens it with her own existing PIN (the same login as the dashboard), and her replies are signed with her name.
 *
 *   GET/POST /wa-webhook         Meta (signed with the app secret WA_APP_SECRET; verify token WA_VERIFY_TOKEN)
 *   GET  /inbox/threads                                     -> list of chats (newest first)
 *   GET  /inbox/thread?p=<phone>                            -> one chat (marks it read)
 *   POST /inbox/reply            { phone, text }                -> sends a normal WhatsApp message (allowed for 24 h after the patient's last message)
 *   POST /inbox/read             { phone }
 *
 * Chats live in KV (binding PUSH) under  wa:t:<phone>, encrypted with DATA_KEY, and expire INBOX_RETAIN_DAYS (default 90) after the last message.
 */
const enc = new TextEncoder(), dec = new TextDecoder();
const err = (status, msg) => Object.assign(new Error(msg), { status, publicMessage: msg });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const hex = u8 => [...u8].map(b => b.toString(16).padStart(2, "0")).join("");
const b64 = u8 => { let s = ""; for (const c of u8) s += String.fromCharCode(c); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64url = u8 => b64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return unb64(s); };
const safeEq = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length || !a.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const sha256hex = async s => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
const hmacKey = (secret, usage = ["sign"]) => crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, usage);
const hmac = async (secret, msg) => new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(msg)));

const WINDOW_MS = 24 * 3600 * 1000;
const phoneKey = p => String(p || "").replace(/\D/g, "");
const tKey = p => "wa:t:" + phoneKey(p);
const ttl = env => Math.max(7, +env.INBOX_RETAIN_DAYS || 90) * 86400;

/* ---------- storage (encrypted) ---------- */
let _k = null;
async function dataKey(env) {
  const raw = String(env.DATA_KEY || "");
  if (raw.length < 32) throw err(500, "Storage is not set up yet.");
  if (_k && _k.raw === raw) return _k.key;
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(raw)));
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  _k = { raw, key }; return key;
}
async function seal(env, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await dataKey(env), enc.encode(JSON.stringify(obj))));
  return b64(iv) + "." + b64(ct);
}
async function unseal(env, s) {
  if (!s) return null;
  try { const [iv, ct] = s.split("."); return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await dataKey(env), unb64(ct)))); } catch (e) { return null; }
}
const load = async (env, phone) => unseal(env, await env.PUSH.get(tKey(phone)));
const save = async (env, t) => env.PUSH.put(tKey(t.phone), await seal(env, t), { expirationTtl: ttl(env) });

/* ---------- Meta -> helper ---------- */
const clip = (s, n) => String(s ?? "").slice(0, n);
function textOf(m) {
  switch (m.type) {
    case "text": return clip(m.text && m.text.body, 4000);
    case "button": return clip(m.button && (m.button.text || m.button.payload), 500);
    case "interactive": { const i = m.interactive || {}; const r = i.button_reply || i.list_reply || {}; return clip(r.title || "", 500); }
    case "image": return "[Photo" + (m.image && m.image.caption ? ": " + clip(m.image.caption, 500) : "") + " – open it in WhatsApp]";
    case "video": return "[Video – open it in WhatsApp]";
    case "audio": return "[Voice message – open it in WhatsApp]";
    case "document": return "[Document" + (m.document && m.document.filename ? ": " + clip(m.document.filename, 120) : "") + " – open it in WhatsApp]";
    case "location": return "[Location shared – open it in WhatsApp]";
    case "sticker": return "[Sticker]";
    default: return "[Message – open it in WhatsApp]";
  }
}
async function verifySignature(env, raw, header) {
  const secret = env.WA_APP_SECRET; if (!secret) return false;
  const want = "sha256=" + hex(await hmac(secret, raw));
  return safeEq(want, String(header || ""));
}

/* Meta calls this URL: GET once to verify it, POST for every reply. onNew() lets the main worker send a phone alert. */
export async function inboxWebhook(req, env, url, onNew) {
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && env.WA_VERIFY_TOKEN && safeEq(url.searchParams.get("hub.verify_token") || "", env.WA_VERIFY_TOKEN);
    return ok ? new Response(url.searchParams.get("hub.challenge") || "", { status: 200 }) : new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Not found", { status: 404 });
  const raw = await req.text();
  if (!(await verifySignature(env, raw, req.headers.get("x-hub-signature-256")))) return new Response("Forbidden", { status: 403 });
  let data = {}; try { data = JSON.parse(raw); } catch (e) {}
  let fresh = 0;
  for (const en of data.entry || []) for (const ch of en.changes || []) {
    const v = ch.value || {}; if (ch.field && ch.field !== "messages") continue;
    const names = {}; for (const c of v.contacts || []) names[phoneKey(c.wa_id)] = clip(c.profile && c.profile.name, 80);
    for (const m of v.messages || []) {
      const phone = phoneKey(m.from); if (phone.length < 8) continue;
      const t = (await load(env, phone)) || { phone, name: "", msgs: [], unread: 0, lastIn: 0 };
      if (t.msgs.some(x => x.id === m.id)) continue;                       // Meta can send the same message twice
      const at = (+m.timestamp || Math.floor(Date.now() / 1000)) * 1000;
      t.msgs.push({ id: m.id, d: "in", text: textOf(m), at });
      t.name = names[phone] || t.name; t.lastIn = Math.max(t.lastIn || 0, at); t.unread = (t.unread || 0) + 1;
      t.msgs = t.msgs.slice(-200);
      await save(env, t); fresh++;
    }
    for (const s of v.statuses || []) {                                     // delivered / read / failed for our replies
      const phone = phoneKey(s.recipient_id); const t = phone && await load(env, phone); if (!t) continue;
      const m = t.msgs.find(x => x.id === s.id); if (!m || !["sent", "delivered", "read", "failed"].includes(s.status)) continue;
      if (m.st !== s.status) { m.st = s.status; await save(env, t); }
    }
  }
  if (fresh && onNew) await onNew(fresh);
  return new Response("ok", { status: 200 });
}

export const isInboxPath = p => p.startsWith("/inbox/");

/* doc = the doctor who is logged in (checked by the main worker with her own PIN session) */
export async function inboxRoute(req, env, p, doc) {
  const M = req.method;
  const body = async () => { try { return await req.json(); } catch (e) { throw err(400, "Bad request."); } };
  if (p === "/inbox/threads" && M === "GET") {
    const l = await env.PUSH.list({ prefix: "wa:t:", limit: 200 });
    const rows = [];
    for (const k of l.keys) {
      const t = await unseal(env, await env.PUSH.get(k.name)); if (!t || !t.msgs.length) continue;
      const last = t.msgs[t.msgs.length - 1];
      rows.push({ phone: t.phone, name: t.name || "", unread: t.unread || 0, last: clip(last.text, 90), lastDir: last.d, at: last.at, open: Date.now() - (t.lastIn || 0) < WINDOW_MS });
    }
    rows.sort((a, b) => b.at - a.at);
    return json({ threads: rows, me: doc.name || "" });
  }
  if (p === "/inbox/thread" && M === "GET") {
    const phone = phoneKey(new URL(req.url).searchParams.get("p"));
    const t = await load(env, phone); if (!t) throw err(404, "This chat was not found.");
    if (t.unread) { t.unread = 0; await save(env, t); }
    return json({ phone: t.phone, name: t.name || "", msgs: t.msgs, open: Date.now() - (t.lastIn || 0) < WINDOW_MS, until: (t.lastIn || 0) + WINDOW_MS });
  }
  if (p === "/inbox/read" && M === "POST") {
    const { phone } = await body(); const t = await load(env, phone);
    if (t && t.unread) { t.unread = 0; await save(env, t); }
    return json({ ok: true });
  }
  if (p === "/inbox/reply" && M === "POST") {
    const { phone, text } = await body();
    const t = await load(env, phone); if (!t) throw err(404, "This chat was not found.");
    const msg = String(text || "").trim().slice(0, 1500);
    if (!msg) throw err(400, "Please write a message.");
    if (Date.now() - (t.lastIn || 0) >= WINDOW_MS) throw err(409, "More than 24 hours have passed since the patient's last message, so WhatsApp does not allow a normal reply now. Please ask the patient to message again, or send a booking link by call.");
    if (String(env.WA_ENABLED) !== "true" || !env.WA_PHONE_ID || !env.WA_TOKEN) throw err(503, "WhatsApp sending is not switched on yet.");
    const who = doc.name || "";
    const out = who ? `${msg}\n\n– ${who}, ${env.CLINIC_NAME || "the clinic"}` : msg;
    const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(env.WA_PHONE_ID)}/messages`, {
      method: "POST", headers: { Authorization: "Bearer " + env.WA_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: t.phone, type: "text", text: { body: out, preview_url: false } })
    });
    if (!r.ok) { console.log("inbox reply failed", r.status, (await r.text()).slice(0, 200)); throw err(502, "WhatsApp could not send this message. Please try again."); }
    const j = await r.json().catch(() => ({}));
    t.msgs.push({ id: (j.messages && j.messages[0] && j.messages[0].id) || "out" + Date.now(), d: "out", text: out, by: who, at: Date.now(), st: "sent" });
    t.msgs = t.msgs.slice(-200); await save(env, t);
    return json({ ok: true });
  }
  throw err(404, "Not found.");
}
