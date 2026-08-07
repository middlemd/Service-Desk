import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createCsrfToken, isCsrfTokenValid } from "../lib/csrf-core.ts";

const root = resolve(import.meta.dirname, "..");

function filesBelow(path) {
  return readdirSync(path).flatMap((name) => {
    const fullPath = join(path, name);
    return statSync(fullPath).isDirectory() ? filesBelow(fullPath) : [fullPath];
  });
}

test("CSRF-токен привязан к субъекту, сроку и серверному секрету", () => {
  const now = Date.UTC(2026, 7, 7, 12, 0, 0);
  const token = createCsrfToken("test-secret-with-enough-entropy", "auth0|user-a", now);
  assert.equal(isCsrfTokenValid("test-secret-with-enough-entropy", "auth0|user-a", token, now), true);
  assert.equal(isCsrfTokenValid("test-secret-with-enough-entropy", "auth0|user-b", token, now), false);
  assert.equal(isCsrfTokenValid("another-secret", "auth0|user-a", token, now), false);
  assert.equal(isCsrfTokenValid("test-secret-with-enough-entropy", "auth0|user-a", `${token}x`, now), false);
  assert.equal(isCsrfTokenValid("test-secret-with-enough-entropy", "auth0|user-a", token, now + 61 * 60 * 1000), false);
});

test("клиентские модули не содержат серверные env или опасный HTML API", () => {
  const appFiles = filesBelow(join(root, "app")).filter((file) => /\.(ts|tsx)$/.test(file));
  const bannedSecrets = /SUPABASE_SERVICE_ROLE_KEY|AUTH0_CLIENT_SECRET|AUTH0_MGMT_CLIENT_SECRET|CSRF_SECRET/;
  for (const file of appFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/, relative(root, file));
    if (source.trimStart().startsWith('"use client"')) {
      assert.doesNotMatch(source, bannedSecrets, relative(root, file));
      assert.doesNotMatch(source, /process\.env/, relative(root, file));
    }
  }
});

test("каждый API route проверяет сессию, а изменяющие routes — CSRF", () => {
  const routes = filesBelow(join(root, "app", "api")).filter((file) => file.endsWith("route.ts"));
  assert.ok(routes.length >= 10);
  for (const file of routes) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /requireViewer\(/, `${relative(root, file)}: missing session check`);
    if (/export async function (POST|PATCH|PUT|DELETE)/.test(source)) {
      assert.match(source, /assertSafeMutation\(/, `${relative(root, file)}: missing CSRF check`);
    }
  }
  for (const relativeRoute of [
    "app/api/tickets/[id]/route.ts",
    "app/api/tickets/[id]/claim/route.ts",
    "app/api/tickets/[id]/comments/route.ts",
    "app/api/tickets/[id]/transition/route.ts",
  ]) {
    const source = readFileSync(join(root, relativeRoute), "utf8");
    assert.match(source, /getTicket\(viewer, id\.data\)/, `${relativeRoute}: missing object-level server check`);
  }
});

test("миграция включает RLS, default-deny grants и серверные операции", () => {
  const migration = readFileSync(join(root, "supabase", "migrations", "20260807150000_service_desk_initial.sql"), "utf8").toLowerCase();
  for (const table of ["profiles", "tickets", "comments", "categories", "audit_events"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /revoke all on all tables in schema public from anon, authenticated/);
  assert.match(migration, /create policy tickets_select/);
  assert.match(migration, /create or replace function public\.claim_ticket/);
  assert.match(migration, /create or replace function public\.admin_update_role/);
  assert.match(migration, /create or replace function public\.admin_set_specialist_categories/);
});

test("CSP использует nonce и не разрешает inline-скрипты", () => {
  const proxy = readFileSync(join(root, "proxy.ts"), "utf8");
  assert.match(proxy, /nonce-/);
  assert.match(proxy, /strict-dynamic/);
  assert.doesNotMatch(proxy, /script-src[^\n]*unsafe-inline/);
  assert.match(proxy, /Content-Security-Policy/);
});

test("Auth0 access-token endpoint не доступен клиентскому JavaScript", () => {
  const auth0 = readFileSync(join(root, "lib", "auth0.ts"), "utf8");
  assert.match(auth0, /enableAccessTokenEndpoint:\s*false/);
});

test("модальные окна удерживают Tab и возвращают фокус", () => {
  const app = readFileSync(join(root, "app", "service-desk-app.tsx"), "utf8");
  assert.match(app, /event\.key === "Tab"/);
  assert.match(app, /previouslyFocused\?\.isConnected/);
});

test("rate limit считает попытку до разбора тела заявки и комментария", () => {
  for (const relativeRoute of [
    "app/api/tickets/route.ts",
    "app/api/tickets/[id]/comments/route.ts",
  ]) {
    const source = readFileSync(join(root, relativeRoute), "utf8");
    const rateLimitCall = source.indexOf("await enforceRateLimit(");
    const jsonParseCall = source.indexOf("await parseJson(");
    assert.ok(rateLimitCall >= 0 && jsonParseCall >= 0 && rateLimitCall < jsonParseCall, `${relativeRoute}: rate limit must precede body parsing`);
  }
});

test("demo mode не обращается к защищённым API и выключен в production", () => {
  const demoApp = readFileSync(join(root, "app", "demo-service-desk-app.tsx"), "utf8");
  const demoMode = readFileSync(join(root, "lib", "demo-mode-core.ts"), "utf8");
  assert.doesNotMatch(demoApp, /fetch\s*\(/);
  assert.doesNotMatch(demoApp, /AUTH0_|SUPABASE_|process\.env/);
  assert.match(demoMode, /nodeEnv === "development"/);
  assert.match(demoMode, /demoMode === "true"/);
});
