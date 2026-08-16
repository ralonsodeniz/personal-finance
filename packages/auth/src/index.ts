export type ProviderKind = "auth0" | "double";

export interface ProviderIdentity {
  email?: string;
  issuer: string;
  name?: string;
  provider: ProviderKind;
  subject: string;
}

export interface ProviderAuthenticationInput {
  email?: string;
  issuer?: string;
  name?: string;
  subject: string;
}

export type AuthConfigurationReason =
  | "invalid-provider-configuration"
  | "invalid-session-secret"
  | "missing-provider-configuration"
  | "missing-session-secret";

export type AuthConfiguration =
  | {
      clientId?: string;
      clientSecret?: string;
      issuer: string;
      provider: ProviderKind;
      sessionSecret: string;
      status: "configured";
    }
  | {
      reason: AuthConfigurationReason;
      status: "unavailable";
    };

export interface IdentityProvider {
  readonly provider: ProviderKind;
  authenticate(input: ProviderAuthenticationInput): ProviderIdentity;
}

export interface ProviderDoubleOptions {
  issuer?: string;
}

export class ProviderDouble implements IdentityProvider {
  readonly provider = "double" as const;

  private readonly issuer: string;

  constructor({ issuer = "https://provider-double.local/" }: ProviderDoubleOptions = {}) {
    this.issuer = requirePart(issuer, "issuer");
  }

  authenticate({ email, issuer = this.issuer, name, subject }: ProviderAuthenticationInput) {
    return {
      ...(email ? { email } : {}),
      issuer: requirePart(issuer, "issuer"),
      ...(name ? { name } : {}),
      provider: this.provider,
      subject: requirePart(subject, "subject"),
    } satisfies ProviderIdentity;
  }
}

export interface Identity {
  email?: string;
  id: string;
  issuer: string;
  name?: string;
  provider: ProviderKind;
  subject: string;
  userId: string;
}

export interface IdentityDirectoryOptions {
  createId?: () => string;
}

export function parseAuthConfiguration(
  environment: Record<string, string | undefined>,
): AuthConfiguration {
  const providerValue = environment.AUTH_PROVIDER?.trim().toLowerCase() || "auth0";

  if (providerValue !== "auth0" && providerValue !== "double") {
    return unavailable("invalid-provider-configuration");
  }

  const issuer = parseIssuer(
    environment.AUTH0_ISSUER_BASE_URL ?? environment.AUTH0_DOMAIN,
    providerValue === "double" ? "https://provider-double.local/" : undefined,
  );

  if (!issuer) {
    return unavailable("missing-provider-configuration");
  }

  const clientId = environment.AUTH0_CLIENT_ID?.trim();
  const clientSecret = environment.AUTH0_CLIENT_SECRET?.trim();

  if (providerValue === "auth0" && (!clientId || !clientSecret)) {
    return unavailable("missing-provider-configuration");
  }

  const sessionSecret = environment.AUTH0_SECRET?.trim();

  if (!sessionSecret) {
    return unavailable("missing-session-secret");
  }

  if (sessionSecret.length < 32) {
    return unavailable("invalid-session-secret");
  }

  return {
    ...(clientId ? { clientId } : {}),
    ...(clientSecret ? { clientSecret } : {}),
    issuer,
    provider: providerValue,
    sessionSecret,
    status: "configured",
  };
}

export function providerIdentityKey({
  issuer,
  subject,
}: Pick<ProviderIdentity, "issuer" | "subject">) {
  return JSON.stringify([requirePart(issuer, "issuer"), requirePart(subject, "subject")]);
}

export class IdentityDirectory {
  private readonly createId: () => string;

  private readonly identities = new Map<string, Identity>();

  constructor({ createId = defaultCreateId }: IdentityDirectoryOptions = {}) {
    this.createId = createId;
  }

  establish(providerIdentity: ProviderIdentity): Identity {
    const key = providerIdentityKey(providerIdentity);
    const existing = this.identities.get(key);

    if (existing) {
      return existing;
    }

    const userId = this.createId();
    const identity = {
      ...(providerIdentity.email ? { email: providerIdentity.email } : {}),
      id: this.createId(),
      issuer: providerIdentity.issuer,
      ...(providerIdentity.name ? { name: providerIdentity.name } : {}),
      provider: providerIdentity.provider,
      subject: providerIdentity.subject,
      userId,
    } satisfies Identity;

    this.identities.set(key, identity);
    return identity;
  }

  find(providerIdentity: Pick<ProviderIdentity, "issuer" | "subject">): Identity | undefined {
    return this.identities.get(providerIdentityKey(providerIdentity));
  }
}

function defaultCreateId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("IdentityDirectory requires a randomUUID implementation");
  }

  return globalThis.crypto.randomUUID();
}

function requirePart(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Provider ${name} is required`);
  }

  return trimmed;
}

function parseIssuer(value: string | undefined, fallback: string | undefined) {
  const candidate = value?.trim() || fallback;

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);

    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function unavailable(reason: AuthConfigurationReason): AuthConfiguration {
  return { reason, status: "unavailable" };
}
