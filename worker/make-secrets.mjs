// Makes the per-doctor secrets for the Cloudflare helper.
// Usage: node make-secrets.mjs <PIN>        (PIN = 4–8 digits chosen for the doctor; add --starter for a Starter site)
// Prints values to paste into Cloudflare → Worker → Settings → Variables and Secrets (type: Secret).
// Nothing is saved to disk. CAL_API_KEY and DAILY_API_KEY come from the doctor's own accounts.
import { webcrypto as c } from "node:crypto";
// Several doctors on one website: node make-secrets.mjs anish=482915 vigeesh=731604  (one PIN each, all different)
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const multi = args.some(a => a.includes("="));
const pairs = multi ? args.map(a => a.split("=")) : [["main", args[0] || ""]];
if (!pairs.length || pairs.some(([id, p]) => !/^[a-z0-9-]+$/i.test(id || "") || !/^\d{4,8}$/.test(p || ""))) {
  console.error("One doctor: node make-secrets.mjs 482915\nSeveral:    node make-secrets.mjs anish=482915 vigeesh=731604   (PINs 4–8 digits)"); process.exit(1);
}
if (new Set(pairs.map(x => x[1])).size !== pairs.length) { console.error("Every doctor needs a different PIN."); process.exit(1); }
const hex = u => Buffer.from(u).toString("hex");
const b64u = u => Buffer.from(u).toString("base64url");
const rand = n => b64u(c.getRandomValues(new Uint8Array(n)));
const kp = await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const pub = new Uint8Array(await c.subtle.exportKey("raw", kp.publicKey));
const jwk = await c.subtle.exportKey("jwk", kp.privateKey);
const hashPin = async p => hex(await c.subtle.digest("SHA-256", new TextEncoder().encode("dotcom-pin:" + p)));
const out = {};
if (multi) { const m = {}; for (const [id, p] of pairs) m[id] = await hashPin(p); out.PINS = JSON.stringify(m); }
else out.PIN_HASH = await hashPin(pairs[0][1]);
Object.assign(out, {

  SESSION_SECRET: rand(32),
  DATA_KEY: rand(32),   // own calendar: encrypts patient details. Keep a copy in Studio Desk; never change it once bookings exist.
  ...(process.argv.includes("--starter") ? {} : {   // Starter (--starter): no phone alerts, so no VAPID keys
    CAL_WEBHOOK_SECRET: rand(24),
    VAPID_PUBLIC_KEY: b64u(pub),
    VAPID_PRIVATE_JWK: JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d })
  })
});
if (process.argv.includes("--json")) console.log(JSON.stringify(out));
else for (const [k, v] of Object.entries(out)) console.log(`${k}\n${v}\n`);
