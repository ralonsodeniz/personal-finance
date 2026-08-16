import { describe, expect, it } from "vitest";

import { createApplicationAuthorizer } from "./index.js";

const request = {
  action: "view",
  resource: "protected-placeholder",
};

describe("application-owned authorization", () => {
  it("allows an internal actor without depending on provider claims or persistence", () => {
    const authorizer = createApplicationAuthorizer();

    expect(
      authorizer.authorize(
        {
          identityId: "identity-123",
          userId: "user-123",
        },
        request,
      ),
    ).toEqual({ allowed: true });
  });

  it("denies an absent actor without exposing a protected resource", () => {
    const authorizer = createApplicationAuthorizer();

    expect(authorizer.authorize(null, request)).toEqual({
      allowed: false,
      reason: "unauthenticated",
    });
  });
});
