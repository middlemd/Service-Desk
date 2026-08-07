import "server-only";

import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { getServerEnv } from "./env";

let client: Auth0Client | undefined;

export function getAuth0Client() {
  if (client) return client;
  const env = getServerEnv();
  client = new Auth0Client({
    domain: env.AUTH0_DOMAIN,
    clientId: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET,
    secret: env.AUTH0_SECRET,
    appBaseUrl: env.APP_BASE_URL,
    session: {
      rolling: true,
      absoluteDuration: 8 * 60 * 60,
      inactivityDuration: 30 * 60,
      cookie: {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        transient: true,
      },
    },
    enableAccessTokenEndpoint: false,
    enableParallelTransactions: true,
    includeIdTokenHintInOIDCLogoutUrl: true,
  });
  return client;
}
