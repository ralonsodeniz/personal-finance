import "server-only";

// The web cookie codec is an app-owned adapter; @personal-finance/auth keeps
// the provider-neutral identity/session seam separate from native storage.
export * from "./web-session-core";
