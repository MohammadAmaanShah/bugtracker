import crypto from "crypto";

const derive = (value, salt) => crypto.scryptSync(value, salt, 64);

export function hashValue(value) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${derive(String(value), salt).toString("hex")}`;
}

export function verifyValue(value, stored) {
  if (!stored || typeof stored !== "string") return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = derive(String(value), salt);
  const actual = Buffer.from(hash, "hex");
  return (
    candidate.length === actual.length &&
    crypto.timingSafeEqual(candidate, actual)
  );
}
