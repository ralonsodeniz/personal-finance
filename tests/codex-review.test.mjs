import { readFileSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CODEX_LOGIN,
  CODEX_REVIEW_CHECK_NAME,
  CODEX_REVIEW_GATE_MARKER,
  CODEX_REVIEW_PROTOCOL_MARKER,
  CODEX_USER_ID,
  GH_API_TIMEOUT_MS,
  TARGET_BRANCH,
  TRUSTED_GITHUB_ACTIONS_APP_ID,
  TRUSTED_GITHUB_ACTIONS_APP_NAME,
  TRUSTED_GITHUB_ACTIONS_APP_SLUG,
  CODEX_USER_TYPE,
  GH_API_MAX_BUFFER,
  buildCodexReviewCheckPayload,
  evaluateCodexReview,
  flattenCheckRunPages,
  flattenIssueCommentPages,
  getEventHeadSha,
  getEventPullRequestNumber,
  isManagedCodexReviewCheckRun,
  isTrustedCodexReviewComment,
  parseCodexReviewResult,
} from "../scripts/codex-review.mjs";
import { REQUIRED_CONTEXTS } from "../scripts/verify-main-protection.mjs";

const currentHeadSha = "a".repeat(40);
const previousHeadSha = "b".repeat(40);
const nextHeadSha = "c".repeat(40);
const publicCodexUserId = 267193182;
const workflowPath = fileURLToPath(
  new URL("../.github/workflows/codex-review.yml", import.meta.url),
);
const codexReviewScriptPath = fileURLToPath(
  new URL("../scripts/codex-review.mjs", import.meta.url),
);
const documentationPath = fileURLToPath(new URL("../docs/agents/codex-review.md", import.meta.url));
const rootAgentsPath = fileURLToPath(new URL("../AGENTS.md", import.meta.url));
const protectionDocumentationPath = fileURLToPath(
  new URL("../docs/architecture/main-protection.md", import.meta.url),
);

const trustedGitHubActionsApp = {
  id: TRUSTED_GITHUB_ACTIONS_APP_ID,
  name: TRUSTED_GITHUB_ACTIONS_APP_NAME,
  slug: TRUSTED_GITHUB_ACTIONS_APP_SLUG,
};

function reviewBody(headSha, result) {
  return `${CODEX_REVIEW_PROTOCOL_MARKER}\nReviewed head SHA: ${headSha}\nResult: ${result}`;
}

function codexComment(overrides = {}) {
  return {
    body: reviewBody(currentHeadSha, "PASS"),
    id: 401,
    user: { id: CODEX_USER_ID, login: CODEX_LOGIN, type: CODEX_USER_TYPE },
    ...overrides,
  };
}

function pullRequest(overrides = {}) {
  return {
    number: 51,
    state: "open",
    base: { ref: TARGET_BRANCH },
    head: { sha: currentHeadSha },
    ...overrides,
  };
}

function decisionFor(comments, overrides = {}) {
  return evaluateCodexReview({ comments, pullRequest: pullRequest(overrides) });
}

describe("Codex review protocol", () => {
  it("parses only the exact final machine-readable result block", () => {
    expect(parseCodexReviewResult(reviewBody(currentHeadSha, "PASS"))).toEqual({
      headSha: currentHeadSha,
      result: "PASS",
    });
    expect(
      parseCodexReviewResult(
        `Review details\n\n${reviewBody(currentHeadSha, "CHANGES_REQUESTED")}`,
      ),
    ).toEqual({ headSha: currentHeadSha, result: "CHANGES_REQUESTED" });
    expect(parseCodexReviewResult(`${reviewBody(currentHeadSha, "PASS")}\nMore text`)).toBe(
      undefined,
    );
    expect(parseCodexReviewResult(reviewBody("short", "PASS"))).toBe(undefined);
    expect(parseCodexReviewResult(`${CODEX_REVIEW_PROTOCOL_MARKER}\nResult: PASS`)).toBe(undefined);
    expect(parseCodexReviewResult("PASS")).toBe(undefined);
  });

  it("trusts only the observed native Codex publisher identity", () => {
    expect(isTrustedCodexReviewComment(codexComment())).toBe(true);
    expect(decisionFor([codexComment()]).conclusion).toBe("success");
    expect(
      isTrustedCodexReviewComment(
        codexComment({
          user: { id: publicCodexUserId, login: "codex", type: "User" },
        }),
      ),
    ).toBe(false);
    expect(
      decisionFor([
        codexComment({
          user: { id: publicCodexUserId, login: "codex", type: "User" },
        }),
      ]).conclusion,
    ).toBe("failure");
    expect(
      isTrustedCodexReviewComment(
        codexComment({
          user: { id: CODEX_USER_ID, login: "arbitrary-bot[bot]", type: "Bot" },
        }),
      ),
    ).toBe(false);
    expect(
      decisionFor([
        codexComment({
          user: { id: CODEX_USER_ID, login: "arbitrary-bot[bot]", type: "Bot" },
        }),
      ]).conclusion,
    ).toBe("failure");
    expect(
      isTrustedCodexReviewComment(
        codexComment({ user: { id: 999, login: "arbitrary-user", type: "User" } }),
      ),
    ).toBe(false);
    expect(
      decisionFor([codexComment({ user: { id: 999, login: "arbitrary-user", type: "User" } })])
        .conclusion,
    ).toBe("failure");
  });

  it("passes exactly one trusted PASS result for the current full head", () => {
    const comment = codexComment();
    const decision = decisionFor([comment]);

    expect(decision).toMatchObject({
      conclusion: "success",
      headSha: currentHeadSha,
      result: "PASS",
      resultCommentId: "401",
    });
  });

  it("fails for missing, unavailable, changes-requested, and reaction-only states", () => {
    expect(GH_API_TIMEOUT_MS).toBe(30_000);
    expect(decisionFor([]).conclusion).toBe("failure");
    expect(
      evaluateCodexReview({
        comments: [codexComment()],
        pullRequest: pullRequest(),
        unavailable: true,
      }).conclusion,
    ).toBe("failure");
    expect(evaluateCodexReview({ comments: null, pullRequest: pullRequest() }).conclusion).toBe(
      "failure",
    );
    expect(
      decisionFor([codexComment({ body: reviewBody(currentHeadSha, "CHANGES_REQUESTED") })])
        .conclusion,
    ).toBe("failure");
    expect(
      decisionFor([
        codexComment({
          body: "The review is clean.",
          reactions: { "+1": 1 },
        }),
      ]).conclusion,
    ).toBe("failure");
  });

  it("fails malformed and untrusted protocol-looking results closed", () => {
    expect(
      decisionFor([
        codexComment({
          body: `${CODEX_REVIEW_PROTOCOL_MARKER}\nReviewed head SHA: ${currentHeadSha}`,
        }),
      ]).conclusion,
    ).toBe("failure");
    expect(
      decisionFor([
        codexComment({
          body: reviewBody(currentHeadSha, "PASS"),
          user: { id: 999, login: "owner", type: "User" },
        }),
      ]).conclusion,
    ).toBe("failure");
  });

  it("invalidates a previous-head result until the new head has a fresh result", () => {
    const oldResult = codexComment({ body: reviewBody(previousHeadSha, "PASS") });

    expect(decisionFor([oldResult]).conclusion).toBe("failure");
    expect(
      decisionFor([oldResult, codexComment({ id: 402, body: reviewBody(nextHeadSha, "PASS") })], {
        head: { sha: nextHeadSha },
      }).conclusion,
    ).toBe("success");
  });

  it("routes pull-request and issue-comment events through the same recomputation seam", () => {
    expect(getEventPullRequestNumber("pull_request_target", { pull_request: { number: 51 } })).toBe(
      51,
    );
    expect(
      getEventPullRequestNumber("issue_comment", {
        issue: { number: 51, pull_request: { url: "https://api.github.com/pulls/51" } },
      }),
    ).toBe(51);
    expect(getEventPullRequestNumber("issue_comment", { issue: { number: 51 } })).toBeUndefined();
    expect(getEventPullRequestNumber("push", {})).toBeUndefined();
    expect(getEventHeadSha({ pull_request: { head: { sha: currentHeadSha } } })).toBe(
      currentHeadSha,
    );
    expect(getEventHeadSha({ issue: { pull_request: { head: { sha: nextHeadSha } } } })).toBe(
      nextHeadSha,
    );
    expect(getEventHeadSha({ comment: codexComment() })).toBe(currentHeadSha);
    expect(
      getEventHeadSha({
        comment: {
          body: `${CODEX_REVIEW_PROTOCOL_MARKER}\nReviewed head SHA: ${currentHeadSha}`,
          user: { id: CODEX_USER_ID, login: CODEX_LOGIN, type: CODEX_USER_TYPE },
        },
      }),
    ).toBe(currentHeadSha);
    expect(
      getEventHeadSha({
        comment: codexComment({
          user: { id: 999, login: "arbitrary-user", type: "User" },
        }),
      }),
    ).toBeUndefined();
  });

  it("rejects malformed GitHub pagination instead of discarding it", () => {
    expect(flattenIssueCommentPages([[codexComment()]])).toHaveLength(1);
    expect(() => flattenIssueCommentPages([[codexComment()], { body: "unexpected" }])).toThrow(
      "malformed issue-comment pages",
    );
    expect(flattenCheckRunPages([{ check_runs: [] }])).toEqual([]);
    expect(() => flattenCheckRunPages([{ check_runs: [] }, []])).toThrow(
      "malformed check-run pages",
    );
  });

  it("bounds paginated GitHub API output before parsing it", () => {
    expect(GH_API_MAX_BUFFER).toBe(8 * 1024 * 1024);
    expect(readFileSync(codexReviewScriptPath, "utf8")).toContain("maxBuffer: GH_API_MAX_BUFFER");
  });

  it("fails duplicate or conflicting current-head results", () => {
    expect(decisionFor([codexComment(), codexComment({ id: 402 })]).conclusion).toBe("failure");
    expect(
      decisionFor([
        codexComment(),
        codexComment({ id: 402, body: reviewBody(currentHeadSha, "CHANGES_REQUESTED") }),
      ]).conclusion,
    ).toBe("failure");
  });

  it("fails when the pull request is not an open main-target", () => {
    expect(decisionFor([codexComment()], { state: "closed" }).conclusion).toBe("failure");
    expect(decisionFor([codexComment()], { base: { ref: "develop" } }).conclusion).toBe("failure");
    expect(
      evaluateCodexReview({
        comments: [codexComment()],
        pullRequest: pullRequest({ head: { sha: "not-a-sha" } }),
      }).conclusion,
    ).toBe("failure");
  });

  it("builds and recognizes only a managed current-head check run", () => {
    const payload = buildCodexReviewCheckPayload({
      decision: {
        conclusion: "success",
        headSha: currentHeadSha,
        reason: "The trusted native Codex review passed for this exact head.",
        result: "PASS",
        resultCommentId: "401",
      },
    });

    expect(payload).toMatchObject({
      conclusion: "success",
      head_sha: currentHeadSha,
      name: CODEX_REVIEW_CHECK_NAME,
      status: "completed",
    });
    expect(payload.output.text).toContain(CODEX_REVIEW_GATE_MARKER);
    expect(
      isManagedCodexReviewCheckRun({ ...payload, app: trustedGitHubActionsApp }, currentHeadSha),
    ).toBe(true);
    expect(
      isManagedCodexReviewCheckRun(
        { ...payload, app: { ...trustedGitHubActionsApp, id: TRUSTED_GITHUB_ACTIONS_APP_ID + 1 } },
        currentHeadSha,
      ),
    ).toBe(false);
    expect(
      isManagedCodexReviewCheckRun({ ...payload, app: trustedGitHubActionsApp }, previousHeadSha),
    ).toBe(false);
    expect(
      isManagedCodexReviewCheckRun(
        {
          ...payload,
          app: trustedGitHubActionsApp,
          output: { ...payload.output, text: "foreign output" },
        },
        currentHeadSha,
      ),
    ).toBe(false);

    const unavailablePayload = buildCodexReviewCheckPayload({
      decision: {
        conclusion: "failure",
        headSha: currentHeadSha,
        reason: "The current native Codex review state could not be verified; retry is required.",
      },
    });

    expect(unavailablePayload.conclusion).toBe("failure");
    expect(
      isManagedCodexReviewCheckRun(
        { ...unavailablePayload, app: trustedGitHubActionsApp },
        currentHeadSha,
      ),
    ).toBe(true);
  });

  it("keeps the workflow metadata-only and documents recovery boundaries", () => {
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("pull_request_target:");
    expect(workflow).toContain("issue_comment:");
    expect(workflow).toContain("checks: write");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("issues: read");
    expect(workflow).toContain("pull-requests: read");
    expect(workflow).toContain("repository: ralonsodeniz/personal-finance");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("run: node scripts/codex-review.mjs");
    expect(workflow).toContain(`name: ${CODEX_REVIEW_CHECK_NAME}`);
    expect(workflow).toContain("name: Recompute current Codex review state");
    expect(workflow).not.toContain("OPENAI_API_KEY");
    expect(workflow).not.toContain("codex-action");
    expect(workflow).not.toContain("pnpm install");
    expect(workflow).not.toContain("npm install");
    expect(workflow).not.toContain("github.event.pull_request.head.sha");

    const documentation = readFileSync(documentationPath, "utf8");
    expect(documentation).toContain(CODEX_REVIEW_CHECK_NAME);
    expect(documentation).toContain(String(CODEX_USER_ID));
    expect(documentation).toContain(CODEX_LOGIN);
    expect(documentation).toContain(CODEX_USER_TYPE);
    expect(documentation).toContain(String(publicCodexUserId));
    expect(documentation).toContain("native integration");
    expect(documentation).toContain("/owner-approve");
    expect(documentation).toContain("recovery");

    const rootAgents = readFileSync(rootAgentsPath, "utf8");
    expect(rootAgents).toContain("## Code Review Rules");
    expect(rootAgents).toContain("Reviewed head SHA:");
    expect(rootAgents).toContain("Result: PASS");
    expect(rootAgents).toContain("Result: CHANGES_REQUESTED");
  });

  it("targets Codex review in the exact protection policy and defers live activation", () => {
    expect(REQUIRED_CONTEXTS).toEqual([
      "Root quality gate",
      "Owner approval",
      "CodeQL analysis",
      "Dependency review",
      "Codex review",
    ]);

    const protectionDocumentation = readFileSync(protectionDocumentationPath, "utf8");
    expect(protectionDocumentation).toContain("Codex review");
    expect(protectionDocumentation).toContain("successful baseline");
    expect(protectionDocumentation).toContain("does not mutate live main protection");
  });
});
