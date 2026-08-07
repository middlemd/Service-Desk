import "server-only";

import { AppError } from "./errors";
import { getServerEnv } from "./env";
import { createCsrfToken, isCsrfTokenValid } from "./csrf-core";

export function issueCsrfToken(subject: string, now = Date.now()) {
  return createCsrfToken(getServerEnv().CSRF_SECRET, subject, now);
}

export function verifyCsrfToken(subject: string, token: string | null, now = Date.now()) {
  return isCsrfTokenValid(getServerEnv().CSRF_SECRET, subject, token, now);
}

export function assertSafeMutation(request: Request, subject: string) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (!origin || origin !== requestOrigin) throw new AppError(403, "CSRF_REJECTED", "Origin mismatch");
  if (!verifyCsrfToken(subject, request.headers.get("x-csrf-token"))) throw new AppError(403, "CSRF_REJECTED", "Invalid CSRF token");
}

export function requestId(request: Request) {
  const incoming = request.headers.get("x-request-id");
  return incoming && /^[a-zA-Z0-9_-]{8,80}$/.test(incoming) ? incoming : crypto.randomUUID();
}
