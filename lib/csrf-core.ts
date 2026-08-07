import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_WINDOW_SECONDS = 30 * 60;

function tokenSignature(secret: string, subject: string, bucket: number) {
  return createHmac("sha256", secret).update(`${subject}:${bucket}`).digest("base64url");
}

export function createCsrfToken(secret: string, subject: string, now = Date.now()) {
  const bucket = Math.floor(now / 1000 / TOKEN_WINDOW_SECONDS);
  return `${bucket}.${tokenSignature(secret, subject, bucket)}`;
}

export function isCsrfTokenValid(secret: string, subject: string, token: string | null, now = Date.now()) {
  if (!token) return false;
  const [rawBucket, signature, ...rest] = token.split(".");
  if (rest.length || !rawBucket || !signature || !/^\d+$/.test(rawBucket)) return false;
  const bucket = Number(rawBucket);
  const currentBucket = Math.floor(now / 1000 / TOKEN_WINDOW_SECONDS);
  if (bucket !== currentBucket && bucket !== currentBucket - 1) return false;
  const expected = tokenSignature(secret, subject, bucket);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
