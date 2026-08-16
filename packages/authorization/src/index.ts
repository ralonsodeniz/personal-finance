export interface ApplicationActor {
  identityId: string;
  userId: string;
}

export interface AuthorizationRequest {
  action: string;
  resource: string;
}

export type AuthorizationDecision =
  { allowed: true } | { allowed: false; reason: "forbidden" | "unauthenticated" };

export interface ApplicationAuthorizer {
  authorize(actor: ApplicationActor | null, request: AuthorizationRequest): AuthorizationDecision;
}

export function createApplicationAuthorizer(): ApplicationAuthorizer {
  return {
    authorize(actor, request) {
      void request;

      if (!actor?.identityId || !actor.userId) {
        return { allowed: false, reason: "unauthenticated" };
      }

      return { allowed: true };
    },
  };
}
