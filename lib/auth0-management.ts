import "server-only";

import { randomBytes } from "node:crypto";
import { AppError } from "./errors";
import { getServerEnv } from "./env";

let tokenCache: { token: string; expiresAt: number } | null = null;

function managementBaseUrl() {
  const domain = getServerEnv().AUTH0_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${domain}`;
}

async function getManagementToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const env = getServerEnv();
  const response = await fetch(`${managementBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.AUTH0_MGMT_CLIENT_ID,
      client_secret: env.AUTH0_MGMT_CLIENT_SECRET,
      audience: `${managementBaseUrl()}/api/v2/`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new AppError(502, "INTERNAL", "Identity provider unavailable");
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new AppError(502, "INTERNAL", "Identity provider unavailable");
  tokenCache = { token: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
  return payload.access_token;
}

export async function createAuth0Invitation(email: string, displayName: string) {
  const env = getServerEnv();
  const token = await getManagementToken();
  const temporaryPassword = `${randomBytes(28).toString("base64url")}aA1!`;
  const createResponse = await fetch(`${managementBaseUrl()}/api/v2/users`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      connection: env.AUTH0_CONNECTION,
      email,
      name: displayName,
      password: temporaryPassword,
      email_verified: false,
      verify_email: true,
    }),
    cache: "no-store",
  });
  if (!createResponse.ok) throw new AppError(400, "INVALID_INPUT", "Identity creation rejected");
  const created = (await createResponse.json()) as { user_id?: string };
  if (!created.user_id) throw new AppError(502, "INTERNAL", "Identity provider returned no subject");

  const resetResponse = await fetch(`${managementBaseUrl()}/dbconnections/change_password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.AUTH0_CLIENT_ID, email, connection: env.AUTH0_CONNECTION }),
    cache: "no-store",
  });
  if (!resetResponse.ok) {
    await deleteAuth0User(created.user_id).catch(() => undefined);
    throw new AppError(502, "INTERNAL", "Invitation delivery failed");
  }
  return created.user_id;
}

export async function deleteAuth0User(subject: string) {
  const token = await getManagementToken();
  await fetch(`${managementBaseUrl()}/api/v2/users/${encodeURIComponent(subject)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}
