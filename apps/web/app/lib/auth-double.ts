import "server-only";

import { getScopedEnvironment } from "@personal-finance/config-environment";
import {
  IdentityDirectory,
  ProviderDouble,
  parseAuthConfiguration,
  type AuthConfigurationReason,
} from "@personal-finance/auth";
import { createWebSession, encryptWebSession } from "./web-session";

export type ProviderDoubleSessionResult =
  | { status: "configured"; value: string }
  | {
      reason: AuthConfigurationReason | "invalid-double-subject" | "provider-double-disabled";
      status: "unavailable";
    };

interface ProviderDoubleSessionOptions {
  environment?: Record<string, string | undefined>;
  now?: number;
  subject?: string;
}

const identityDirectory = new IdentityDirectory();

export function isProviderDoubleEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  const runtimeEnvironment = getScopedEnvironment(environment);

  return (
    runtimeEnvironment.AUTH_PROVIDER?.trim().toLowerCase() === "double" &&
    (runtimeEnvironment.NODE_ENV === "development" || runtimeEnvironment.APP_ENV === "preview")
  );
}

export function createProviderDoubleSessionValue({
  environment = process.env,
  now,
  subject = "double|demo-user",
}: ProviderDoubleSessionOptions = {}): ProviderDoubleSessionResult {
  if (
    environment.AUTH_PROVIDER?.trim().toLowerCase() === "double" &&
    !isProviderDoubleEnabled(environment)
  ) {
    return { reason: "provider-double-disabled", status: "unavailable" };
  }

  const runtimeEnvironment = getScopedEnvironment(environment);

  if (
    runtimeEnvironment.AUTH_PROVIDER?.trim().toLowerCase() === "double" &&
    !isProviderDoubleEnabled(runtimeEnvironment)
  ) {
    return { reason: "provider-double-disabled", status: "unavailable" };
  }

  const configuration = parseAuthConfiguration(runtimeEnvironment);

  if (configuration.status === "unavailable") {
    return configuration;
  }

  if (configuration.provider !== "double" || !isProviderDoubleEnabled(runtimeEnvironment)) {
    return { reason: "provider-double-disabled", status: "unavailable" };
  }

  if (!isSafeDoubleSubject(subject)) {
    return { reason: "invalid-double-subject", status: "unavailable" };
  }

  const provider = new ProviderDouble({ issuer: configuration.issuer });
  const identity = identityDirectory.establish(provider.authenticate({ subject: subject.trim() }));
  const session = createWebSession({
    identityId: identity.id,
    ...(now === undefined ? {} : { now }),
    userId: identity.userId,
  });

  return {
    status: "configured",
    value: encryptWebSession(session, configuration.sessionSecret),
  };
}

function isSafeDoubleSubject(subject: string) {
  const trimmed = subject.trim();

  return (
    trimmed.length > 0 &&
    trimmed.length <= 128 &&
    [...trimmed].every((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 0x1f && codePoint !== 0x7f;
    })
  );
}
