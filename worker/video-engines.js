/* DotCom by Arshees — the video chain: Daily (main) → Agora → Fishjam → the clinic's own direct room.
 * This file makes the private room + short pass for Agora and Fishjam (Daily is in video.js).
 * Secrets (set once on the helper): AGORA_APP_ID, AGORA_APP_CERT, FISHJAM_ID, FISHJAM_TOKEN.
 * Nothing is recorded; a room only exists for one booking. */

const enc = new TextEncoder();

/* which engines are switched on, in order. VIDEO_ENGINES can override the order, e.g. "daily,agora,fishjam". "own" is always last. */
export function engineList(env) {
  const has = {
    daily: !!env.DAILY_BACKUP_KEY,
    agora: !!(env.AGORA_APP_ID && env.AGORA_APP_CERT),
    fishjam: !!(env.FISHJAM_ID && env.FISHJAM_TOKEN),
  };
  const want = String(env.VIDEO_ENGINES || "daily,agora,fishjam").toLowerCase().split(/[\s,]+/).filter(Boolean);
  const list = want.filter((x, i) => has[x] && want.indexOf(x) === i);
  return [...list, "own"];
}

/* ---------- Agora (token "007" / AccessToken2, built with Web Crypto) ---------- */
const u16 = n => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
const u32 = n => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };
const str = s => { const d = typeof s === "string" ? enc.encode(s) : s; return cat(u16(d.length), d); };
function cat(...a) { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; }
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
async function zlib(bytes) {
  const cs = new CompressionStream("deflate");
  const w = cs.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
const b64 = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

/* publisher token for one channel and one numeric user id; expires after `seconds` */
export async function agoraToken(appId, cert, channel, uid, seconds, fixed) {
  const issue = (fixed && fixed.issue) || Math.floor(Date.now() / 1000);
  const salt = (fixed && fixed.salt) || (crypto.getRandomValues(new Uint32Array(1))[0] || 1);
  // RTC service: type 1; privileges: join(1) publish audio(2) video(3) data(4), each lasting `seconds`
  const privs = [1, 2, 3, 4].map(k => cat(u16(k), u32(seconds)));
  const service = cat(u16(1), u16(privs.length), ...privs, str(channel), str(String(uid)));
  const info = cat(str(appId), u32(issue), u32(seconds), u32(salt), u16(1), service);
  let signing = await hmac(u32(issue), enc.encode(cert));
  signing = await hmac(u32(salt), signing);
  const sig = await hmac(signing, info);
  return "007" + b64(await zlib(cat(str(sig), info)));
}

export async function agoraRoom(env, opts, doc, uid, role, closes, hashHex) {
  const { err } = opts;
  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERT) throw err(503, "This video service is not set up.");
  const channel = "dca-" + (await hashHex(env, "agora:" + doc.id + ":" + uid)).slice(0, 24);
  const num = role === "doctor" ? 1 : 2;                                   // one numeric id per side
  const seconds = Math.max(600, Math.min(6 * 3600, Math.floor((closes - Date.now()) / 1000)));
  return { ok: true, engine: "agora", appId: env.AGORA_APP_ID, channel, uid: num, token: await agoraToken(env.AGORA_APP_ID, env.AGORA_APP_CERT, channel, num, seconds) };
}

/* ---------- Fishjam (REST: one room per booking, one pass per side) ---------- */
export async function fishjamRoom(env, opts, doc, uid, role, stub) {
  const { err } = opts;
  if (!env.FISHJAM_ID || !env.FISHJAM_TOKEN) throw err(503, "This video service is not set up.");
  const base = "https://fishjam.io/api/v1/connect/" + encodeURIComponent(env.FISHJAM_ID);
  const H = { Authorization: "Bearer " + env.FISHJAM_TOKEN, "Content-Type": "application/json" };
  // the booking's Room object remembers the Fishjam room id, so both sides land in the same room
  const get = async () => (await (await stub.fetch("https://room/fj")).json()).id || "";
  let roomId = await get();
  if (!roomId) {
    const r = await fetch(base + "/room", { method: "POST", headers: H, body: JSON.stringify({ roomType: "conference", maxPeers: 10 }) });
    const j = await r.json().catch(() => ({}));
    const mine = j && j.data && j.data.room && j.data.room.id;
    if (!r.ok || !mine) { console.log("fishjam room failed", r.status, JSON.stringify(j).slice(0, 200)); throw err(502, "This video service couldn't start."); }
    const kept = await (await stub.fetch("https://room/fj", { method: "POST", body: mine })).json();   // first writer wins
    roomId = kept.id || mine;
  }
  const p = await fetch(base + "/room/" + encodeURIComponent(roomId) + "/peer", { method: "POST", headers: H, body: JSON.stringify({ type: "webrtc", options: { enableSimulcast: false } }) });
  const pj = await p.json().catch(() => ({}));
  const token = pj && pj.data && pj.data.token;
  if (!p.ok || !token) { console.log("fishjam peer failed", p.status, JSON.stringify(pj).slice(0, 200)); throw err(502, "This video service couldn't start."); }
  return { ok: true, engine: "fishjam", id: env.FISHJAM_ID, token };
}
