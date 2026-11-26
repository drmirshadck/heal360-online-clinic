/* DotCom by Arshees — own video room (no Daily, no accounts). Shared by Starter, Standard and Pro.
 *
 * How a consultation call works:
 *   - The doctor and the patient connect DIRECTLY (WebRTC, peer to peer). That costs nothing.
 *   - When a network blocks a direct connection (some UAE networks, office Wi-Fi), the call goes through
 *     Cloudflare Realtime TURN (first 1,000 GB a month free, then $0.05/GB). Secrets TURN_KEY_ID + TURN_KEY_TOKEN.
 *   - The helper only passes the connection messages between the two (a "Room" Durable Object per booking,
 *     WebSocket). No audio or video passes through the helper, and nothing of the call is stored.
 *
 * Who may enter:
 *   - Patient: the booking's signed link (d, b, t — same as the change/cancel link), confirmed booking,
 *     from 15 minutes before the start until 60 minutes after the end.
 *   - Doctor: logged in with their PIN (the dashboard's Start call), from 60 minutes before until 3 hours after.
 *
 * Consent: the patient ticks "I agree" on the room page before joining ({consent: true}); the time is saved
 *   (KV "consent:<doctor>:<booking>", kept RETAIN_DAYS) and the doctor's join shows it. Without it: {needsConsent: true}.
 *
 * Backup video (if our room can't connect): Daily, under DotCom's ONE Daily account (secret DAILY_BACKUP_KEY, same key
 *   on every helper). POST /video/backup makes a private, unrecorded room for this booking only + a short pass per side.
 *   The room page uses Daily's engine inside our own design (no Daily screen, no Daily branding).
 *
 * Routes:  POST /video/join  {d, b, t, consent}  (patient)   or  {d, b} + Authorization: Bearer <session> (doctor)
 *          POST /video/backup  (same body / login as join)  -> {url, token}
 *          GET  /video/ws?ticket=...      (WebSocket, the two sides exchange connection messages)
 */
import { call, manageToken } from "./own.js";

const enc = new TextEncoder();
const MIN = 60e3;
const isVideoPath = p => p === "/video/join" || p === "/video/ws" || p === "/video/backup";
export { isVideoPath };

/* opts: { doctors: [...], whoAmI: async req => doctorId | null, onWaiting: async (doc) => {}, json, err } */
export async function videoRoute(req, env, url, p, opts) {
  const { json, err } = opts;
  if (p === "/video/ws") return wsRoute(req, env, url, opts);
  if ((p !== "/video/join" && p !== "/video/backup") || req.method !== "POST") throw err(404, "Not found.");
  const a = await req.json().catch(() => ({}));
  const g = await gate(req, env, opts, a);
  if (g.wait) return json(g.wait);
  const { doc, uid, role, b, closes, info } = g;

  // patient consent: asked once per consultation, before the room opens; the time is kept with the clinic's records
  const ckey = "consent:" + doc.id + ":" + uid;
  let consentAt = env.PUSH ? await env.PUSH.get(ckey) : null;
  if (role === "patient" && !consentAt) {
    if (p === "/video/backup" || a.consent !== true) return json({ ...info, needsConsent: true });
    consentAt = new Date().toISOString();
    if (env.PUSH) await env.PUSH.put(ckey, consentAt, { expirationTtl: (Number(env.RETAIN_DAYS) || 365) * 86400 });
  }

  if (p === "/video/backup") return json(await dailyRoom(env, opts, doc, uid, role, info.me, closes));

  const exp = Math.min(closes, Date.now() + 4 * 3600e3);
  const ticket = await sign(env, [doc.id, uid, role, exp].join("|"));
  if (role === "patient" && opts.onWaiting) { try { await opts.onWaiting(doc, b); } catch (e) {} }
  return json({ ...info, ticket, iceServers: await iceServers(env), consentAt: consentAt || null, backup: !!env.DAILY_BACKUP_KEY });
}

/* who is joining, and is the room open for them */
async function gate(req, env, opts, a) {
  const { err } = opts;
  const doc = (opts.doctors || []).find(x => x.id === String(a.d || "main")) || (opts.doctors || [])[0];
  if (!doc) throw err(400, "Unknown doctor.");
  const uid = String(a.b || "");
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(uid)) throw err(400, "This link is not complete.");

  let role = "patient";
  const auth = req.headers.get("authorization");
  if (auth) {
    const me = await opts.whoAmI(req).catch(() => null);
    if (me !== doc.id) throw err(403, "Only this consultation's doctor can join as the doctor.");
    role = "doctor";
  } else if (!safeEq(String(a.t || ""), await manageToken(env, doc.id, uid))) throw err(403, "This link is not valid.");

  let b; try { b = await call(env, doc, { op: "get", id: uid }); } catch (e) { throw err(404, "This booking was not found."); }
  if (b.status !== "confirmed") throw err(409, b.status === "pending" ? "Your booking is waiting for the clinic to confirm the payment." : "This consultation is not active (" + b.status + ").");
  const start = Date.parse(b.start), end = Date.parse(b.end), now = Date.now();
  const open = Number(env.VIDEO_OPEN_MINUTES) || 15;                      // patient: VIDEO_OPEN_MINUTES (default 15)
  const early = role === "doctor" ? Math.max(60, open) : open;           // doctor: an hour early (or more, if set higher)
  const opens = start - early * MIN, closes = end + (role === "doctor" ? 180 : 60) * MIN;
  if (now < opens) return { wait: { ok: false, wait: true, opens: new Date(opens).toISOString(), start: b.start, error: "The room opens " + early + " minutes before your consultation." } };
  if (now > closes) throw err(410, "This consultation time has passed.");
  const info = { ok: true, role, me: role === "doctor" ? doc.name : b.name, other: role === "doctor" ? b.name : doc.name, title: b.title, start: b.start, end: b.end };
  return { doc, uid, role, b, closes, info };
}

/* BACKUP VIDEO: Daily (DotCom's one Daily account, secret DAILY_BACKUP_KEY — no account per doctor).
   A private room just for this booking, named from a hash (no names in it), not recorded, at most 2 people,
   closing an hour after the consultation; each side gets its own short-lived pass. */
async function dailyRoom(env, opts, doc, uid, role, me, closes) {
  const { err } = opts;
  if (!env.DAILY_BACKUP_KEY) throw err(503, "Backup video is not set up for this clinic.");
  const base = String(env.DAILY_API_BASE || "https://api.daily.co/v1").replace(/\/$/, "");
  const H = { Authorization: "Bearer " + env.DAILY_BACKUP_KEY, "Content-Type": "application/json" };
  const name = "dcb-" + (await hashHex(env, doc.id + ":" + uid)).slice(0, 24);
  const exp = Math.floor(Math.min(closes, Date.now() + 6 * 3600e3) / 1000);
  let room = await fetch(base + "/rooms/" + name, { headers: H });
  if (room.status === 404) {
    room = await fetch(base + "/rooms", { method: "POST", headers: H, body: JSON.stringify({ name, privacy: "private",
      properties: { exp, eject_at_room_exp: true, max_participants: 3, enable_chat: false, enable_screenshare: false, enable_prejoin_ui: false, start_video_off: false, start_audio_off: false } }) });
    if (room.status === 400) room = await fetch(base + "/rooms/" + name, { headers: H });   // the other side made it a moment ago
  }
  if (!room.ok) { console.log("daily room failed", room.status, await room.text().catch(() => "")); throw err(502, "Backup video couldn't start. Please try again."); }
  const r = await room.json();
  const tk = await fetch(base + "/meeting-tokens", { method: "POST", headers: H, body: JSON.stringify({ properties: {
    room_name: name, exp, eject_at_token_exp: true, is_owner: false, user_name: me || (role === "doctor" ? "Doctor" : "Patient"),
    user_id: role, enable_screenshare: false } }) });   // recording is never switched on (rooms and passes don't allow it)
  if (!tk.ok) { console.log("daily token failed", tk.status, await tk.text().catch(() => "")); throw err(502, "Backup video couldn't start. Please try again."); }
  return { ok: true, role, url: r.url, token: (await tk.json()).token };
}
async function hashHex(env, s) { const d = await crypto.subtle.digest("SHA-256", enc.encode("room|" + env.SESSION_SECRET + "|" + s)); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join(""); }

async function wsRoute(req, env, url, opts) {
  const { err } = opts;
  if ((req.headers.get("upgrade") || "").toLowerCase() !== "websocket") throw err(426, "WebSocket only.");
  const origin = req.headers.get("origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (allowed.length && origin && !allowed.includes(origin)) throw err(403, "Not allowed.");
  const t = url.searchParams.get("ticket") || "";
  const raw = await verify(env, t);
  if (!raw) throw err(403, "Please open the room again.");
  const [docId, uid, role, exp] = raw.split("|");
  if (!(Number(exp) > Date.now())) throw err(403, "Please open the room again.");
  if (!env.ROOMS) throw err(500, "Video rooms are not set up yet (ROOMS binding).");
  const stub = env.ROOMS.get(env.ROOMS.idFromName(docId + ":" + uid));
  return stub.fetch(new Request("https://room/?role=" + role, req));
}

/* One per booking. Passes connection messages between the doctor and the patient; at most one of each. */
export class Room {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const role = new URL(req.url).searchParams.get("role") === "doctor" ? "doctor" : "patient";
    const [client, server] = Object.values(new WebSocketPair());
    for (const old of this.state.getWebSockets(role)) { try { old.close(4000, "Opened on another screen"); } catch (e) {} }
    this.state.acceptWebSocket(server, [role]);
    const others = this.state.getWebSockets().filter(w => w !== server && w.readyState === 1);
    server.send(JSON.stringify({ type: "welcome", role, peers: others.map(w => this.state.getTags(w)[0]) }));
    for (const w of others) { try { w.send(JSON.stringify({ type: "peer-joined", role })); } catch (e) {} }
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, msg) {
    if (typeof msg !== "string" || msg.length > 64000) return;
    if (msg === "ping") { try { ws.send("pong"); } catch (e) {} return; }
    for (const w of this.state.getWebSockets()) if (w !== ws) { try { w.send(msg); } catch (e) {} }
  }
  webSocketClose(ws) { this.left(ws); }
  webSocketError(ws) { this.left(ws); }
  left(ws) {
    const role = (this.state.getTags(ws) || [])[0];
    // a reload or a second screen: the new connection is already here, so the other side must not hang up on it
    if (this.state.getWebSockets(role).some(w => w !== ws && w.readyState === 1)) return;
    for (const w of this.state.getWebSockets()) if (w !== ws) { try { w.send(JSON.stringify({ type: "peer-left", role })); } catch (e) {} }
  }
}

/* Cloudflare Realtime TURN: short-lived relay passwords for this call */
async function iceServers(env) {
  const stun = [{ urls: ["stun:stun.cloudflare.com:3478"] }];
  if (!env.TURN_KEY_ID || !env.TURN_KEY_TOKEN) return stun;
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: "POST", headers: { Authorization: "Bearer " + env.TURN_KEY_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 4 * 3600 })
    });
    if (!r.ok) throw new Error("TURN " + r.status);
    const j = await r.json();
    const list = Array.isArray(j.iceServers) ? j.iceServers : (j.iceServers ? [j.iceServers] : []);
    // browsers handle port 53 badly; keep 3478, 80 and 443 (443 = TURN over TLS, gets through strict networks)
    return list.map(s => ({ ...s, urls: [].concat(s.urls || []).filter(u => !/:53(\?|$)/.test(u)) })).filter(s => s.urls.length);
  } catch (e) { console.log("TURN failed", String(e && e.message || e)); return stun; }
}

async function key(env) { return crypto.subtle.importKey("raw", enc.encode("video|" + env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function sign(env, raw) { const k = await key(env); return b64u(enc.encode(raw)) + "." + b64u(await crypto.subtle.sign("HMAC", k, enc.encode(raw))); }
async function verify(env, t) {
  const [p, s] = String(t).split("."); if (!p || !s) return null;
  try { const raw = new TextDecoder().decode(unb64u(p)); const k = await key(env); return (await crypto.subtle.verify("HMAC", k, unb64u(s), enc.encode(raw))) ? raw : null; } catch (e) { return null; }
}
function safeEq(a, b) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
