import "server-only";

import { cookies } from "next/headers";

import {
  parseAuthConfiguration,
  type AuthConfiguration,
  type AuthConfigurationReason,
  type ProviderKind,
} from "@personal-finance/auth";
import { decryptWebSession, WEB_SESSION_COOKIE_NAME, type WebSession } from "./web-session";
import {
  createApplicationAuthorizer,
  type AuthorizationDecision,
} from "@personal-finance/authorization";

const authorizer = createApplicationAuthorizer();
const protectedPlaceholderRequest = {
  action: "view",
  resource: "protected-placeholder",
} as const;

export interface WebAuthState {
  authorization: AuthorizationDecision;
  configuration: WebAuthConfiguration;
  session: WebSession | null;
}

export type WebAuthConfiguration =
  | { issuer: string; provider: ProviderKind; status: "configured" }
  | { reason: AuthConfigurationReason; status: "unavailable" };

function readServerAuthConfiguration(): AuthConfiguration {
  return parseAuthConfiguration(process.env);
}

export async function getWebAuthState(): Promise<WebAuthState> {
  const serverConfiguration = readServerAuthConfiguration();

  if (serverConfiguration.status === "unavailable") {
    return {
      authorization: authorizer.authorize(null, protectedPlaceholderRequest),
      configuration: serverConfiguration,
      session: null,
    };
  }

  const cookieStore = await cookies();
  const encodedSession = cookieStore.get(WEB_SESSION_COOKIE_NAME)?.value;
  const session = encodedSession
    ? decryptWebSession(encodedSession, serverConfiguration.sessionSecret)
    : null;

  return {
    authorization: authorizer.authorize(
      session ? { identityId: session.identityId, userId: session.userId } : null,
      protectedPlaceholderRequest,
    ),
    configuration: {
      issuer: serverConfiguration.issuer,
      provider: serverConfiguration.provider,
      status: "configured",
    },
    session,
  };
}
