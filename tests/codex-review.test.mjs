import { readFileSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CODEX_LOGIN,
  CODEX_REVIEW_CHECK_NAME,
  CODEX_REVIEW_GATE_MARKER,
  CODEX_USER_ID,
  GH_API_TIMEOUT_MS,
  NATIVE_CODEX_NO_MAJOR_PREFIX,
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
  flattenPullRequestReviewCommentPages,
  flattenPullRequestReviewPages,
  getFallbackHeadSha,
  getEventHeadSha,
  getEventPullRequestNumber,
  isManagedCodexReviewCheckRun,
  isTrustedCodexReviewComment,
  parseCodexReviewResult,
} from "../scripts/codex-review.mjs";
import {
  hasExpectedCodexReviewBinding,
  REQUIRED_CHECK_BINDINGS,
  REQUIRED_CONTEXTS,
} from "../scripts/verify-main-protection.mjs";

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

function observedNativeNoMajorBody(headSha = currentHeadSha) {
  return `${NATIVE_CODEX_NO_MAJOR_PREFIX} Can't wait for the next one!\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``;
}

function legacyMarkerBody(headSha, result) {
  return `<!-- codex-review: v1 -->\nReviewed head SHA: ${headSha}\nResult: ${result}`;
}

function codexComment(overrides = {}) {
  return {
    body: observedNativeNoMajorBody(),
    id: 401,
    user: { id: CODEX_USER_ID, login: CODEX_LOGIN, type: CODEX_USER_TYPE },
    ...overrides,
  };
}

function nativePullRequestReview(overrides = {}) {
  return codexComment({ id: 501, commit_id: currentHeadSha, ...overrides });
}

function nativePullRequestReviewComment(overrides = {}) {
  return {
    body: "A current-head native Codex finding.",
    id: 502,
    commit_id: currentHeadSha,
    pull_request_review_id: 501,
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
  it("accepts the observed native no-major-issues issue comment for the current head", () => {
    const decision = evaluateCodexReview({
      comments: [
        codexComment({
          body: observedNativeNoMajorBody(),
          id: 601,
        }),
      ],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "success",
      headSha: currentHeadSha,
      result: "PASS",
      resultCommentId: "601",
    });
  });

  it("parses only the observed native no-major-issues result", () => {
    expect(parseCodexReviewResult(observedNativeNoMajorBody())).toEqual({
      headSha: currentHeadSha.slice(0, 10),
      result: "PASS",
    });
    expect(parseCodexReviewResult(`Review details\n\n${observedNativeNoMajorBody()}`)).toBe(
      undefined,
    );
    expect(
      parseCodexReviewResult(`${NATIVE_CODEX_NO_MAJOR_PREFIX}\n\nNo reviewed commit was supplied.`),
    ).toBe(undefined);
    expect(
      parseCodexReviewResult(
        `${observedNativeNoMajorBody()}\n**Reviewed commit:** \`${previousHeadSha.slice(0, 10)}\``,
      ),
    ).toBe(undefined);
    expect(parseCodexReviewResult(legacyMarkerBody(currentHeadSha, "PASS"))).toBe(undefined);
    expect(parseCodexReviewResult("PASS")).toBe(undefined);
    expect(parseCodexReviewResult(NATIVE_CODEX_NO_MAJOR_PREFIX, currentHeadSha)).toEqual({
      headSha: currentHeadSha,
      result: "PASS",
    });
    expect(
      parseCodexReviewResult(
        `${NATIVE_CODEX_NO_MAJOR_PREFIX}\nReviewed commit: not-a-sha`,
        currentHeadSha,
      ),
    ).toBe(undefined);
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

  it("evaluates native pull-request review bodies as Codex evidence", () => {
    const decision = evaluateCodexReview({
      comments: [],
      pullRequestReviews: [nativePullRequestReview()],
      pullRequestReviewComments: [],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "success",
      headSha: currentHeadSha,
      result: "PASS",
      resultCommentId: "501",
    });
  });

  it("blocks a current trusted review body that is not a native final result", () => {
    const decision = evaluateCodexReview({
      comments: [codexComment()],
      pullRequestReviews: [
        nativePullRequestReview({
          id: 502,
          body: "**P1 Badge** Current-head finding prose.",
        }),
      ],
      pullRequestReviewComments: [],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "failure",
      result: "CHANGES_REQUESTED",
      resultCommentId: "502",
    });
  });

  it("uses full review commit IDs and checks abbreviated native text against them", () => {
    expect(
      evaluateCodexReview({
        comments: [],
        pullRequestReviews: [
          nativePullRequestReview({
            body: observedNativeNoMajorBody(previousHeadSha),
            commit_id: currentHeadSha,
          }),
        ],
        pullRequestReviewComments: [],
        pullRequest: pullRequest(),
      }).conclusion,
    ).toBe("failure");
    expect(
      evaluateCodexReview({
        comments: [],
        pullRequestReviews: [
          nativePullRequestReview({
            body: NATIVE_CODEX_NO_MAJOR_PREFIX,
            commit_id: currentHeadSha,
          }),
        ],
        pullRequestReviewComments: [],
        pullRequest: pullRequest(),
      }).conclusion,
    ).toBe("success");
    expect(
      evaluateCodexReview({
        comments: [],
        pullRequestReviews: [
          nativePullRequestReview({
            body: `${NATIVE_CODEX_NO_MAJOR_PREFIX}\nReviewed commit: not-a-sha`,
            commit_id: currentHeadSha,
          }),
        ],
        pullRequestReviewComments: [],
        pullRequest: pullRequest(),
      }).conclusion,
    ).toBe("failure");
    expect(
      evaluateCodexReview({
        comments: [],
        pullRequestReviews: [
          nativePullRequestReview({
            body: `${NATIVE_CODEX_NO_MAJOR_PREFIX}\n**Reviewed commit**: \`${previousHeadSha.slice(0, 10)}\``,
            commit_id: currentHeadSha,
          }),
        ],
        pullRequestReviewComments: [],
        pullRequest: pullRequest(),
      }).conclusion,
    ).toBe("failure");
    expect(
      evaluateCodexReview({
        comments: [],
        pullRequestReviews: [nativePullRequestReview({ commit_id: undefined })],
        pullRequestReviewComments: [],
        pullRequest: pullRequest(),
      }).conclusion,
    ).toBe("failure");
  });

  it("does not authorize a dismissed native pull-request review", () => {
    const decision = evaluateCodexReview({
      comments: [],
      pullRequestReviews: [nativePullRequestReview({ state: "dismissed" })],
      pullRequestReviewComments: [],
      pullRequest: pullRequest(),
    });

    expect(decision.conclusion).toBe("failure");
  });

  it("does not authorize an inline comment belonging to a dismissed review", () => {
    const decision = evaluateCodexReview({
      comments: [],
      pullRequestReviews: [nativePullRequestReview({ id: 601, state: "dismissed" })],
      pullRequestReviewComments: [nativePullRequestReviewComment({ pull_request_review_id: 601 })],
      pullRequest: pullRequest(),
    });

    expect(decision.conclusion).toBe("failure");
  });

  it("ignores dismissed inline evidence when a fresh current result exists", () => {
    const decision = evaluateCodexReview({
      comments: [codexComment()],
      pullRequestReviews: [nativePullRequestReview({ id: 601, state: "dismissed" })],
      pullRequestReviewComments: [nativePullRequestReviewComment({ pull_request_review_id: 601 })],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "success",
      resultCommentId: "401",
    });
  });

  it("combines issue comments and inline review comments at the current-head boundary", () => {
    const decision = evaluateCodexReview({
      comments: [codexComment({ id: 503, body: observedNativeNoMajorBody(previousHeadSha) })],
      pullRequestReviews: [nativePullRequestReview({ id: 504 })],
      pullRequestReviewComments: [],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "success",
      headSha: currentHeadSha,
      result: "PASS",
      resultCommentId: "504",
    });
  });

  it("binds inline review evidence to its parent review commit", () => {
    const decision = evaluateCodexReview({
      comments: [codexComment({ id: 703 })],
      pullRequestReviews: [
        nativePullRequestReview({
          id: 701,
          state: "COMMENTED",
          commit_id: previousHeadSha,
          body: "\n### 💡 Codex Review\n\nHere are some automated review suggestions for this pull request.",
        }),
      ],
      pullRequestReviewComments: [
        nativePullRequestReviewComment({
          id: 702,
          pull_request_review_id: 701,
          commit_id: currentHeadSha,
          body: "**P1 Badge** Stale-parent finding prose.",
        }),
      ],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "success",
      headSha: currentHeadSha,
      result: "PASS",
      resultCommentId: "703",
    });
  });

  it("accepts a native no-major result published as a current-head review comment", () => {
    const decision = evaluateCodexReview({
      comments: [],
      pullRequestReviews: [
        nativePullRequestReview({
          id: 501,
          body: "\n### 💡 Codex Review\n\nHere are some automated review suggestions for this pull request.",
        }),
      ],
      pullRequestReviewComments: [
        nativePullRequestReviewComment({
          body: NATIVE_CODEX_NO_MAJOR_PREFIX,
          id: 505,
        }),
      ],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "success",
      headSha: currentHeadSha,
      result: "PASS",
      resultCommentId: "505",
    });
  });

  it("does not let the native review envelope block its result comment", () => {
    const decision = evaluateCodexReview({
      comments: [],
      pullRequestReviews: [
        nativePullRequestReview({
          id: 601,
          body: "\n### 💡 Codex Review\n\nHere are some automated review suggestions for this pull request.",
        }),
      ],
      pullRequestReviewComments: [
        nativePullRequestReviewComment({
          body: NATIVE_CODEX_NO_MAJOR_PREFIX,
          id: 602,
          pull_request_review_id: 601,
        }),
      ],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "success",
      headSha: currentHeadSha,
      result: "PASS",
      resultCommentId: "602",
    });
  });

  it("keeps a changes-requested native review envelope blocking", () => {
    const decision = evaluateCodexReview({
      comments: [],
      pullRequestReviews: [
        nativePullRequestReview({
          id: 603,
          body: "\n### 💡 Codex Review\n\nHere are some automated review suggestions for this pull request.",
          state: "CHANGES_REQUESTED",
        }),
      ],
      pullRequestReviewComments: [
        nativePullRequestReviewComment({
          body: NATIVE_CODEX_NO_MAJOR_PREFIX,
          id: 604,
          pull_request_review_id: 603,
        }),
      ],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "failure",
      result: "CHANGES_REQUESTED",
      resultCommentId: "603",
    });
  });

  it("rejects an active current-head native inline finding", () => {
    const decision = evaluateCodexReview({
      comments: [codexComment()],
      pullRequestReviews: [nativePullRequestReview({ body: "Native review summary" })],
      pullRequestReviewComments: [nativePullRequestReviewComment()],
      pullRequest: pullRequest(),
    });

    expect(decision.conclusion).toBe("failure");
  });

  it("fails an unbound active native inline artifact closed", () => {
    const decision = evaluateCodexReview({
      comments: [codexComment()],
      pullRequestReviews: [nativePullRequestReview({ body: "Native review summary" })],
      pullRequestReviewComments: [nativePullRequestReviewComment({ commit_id: undefined })],
      pullRequest: pullRequest(),
    });

    expect(decision.conclusion).toBe("failure");
  });

  it("does not let a stale inline finding poison a fresh current result", () => {
    const decision = evaluateCodexReview({
      comments: [codexComment()],
      pullRequestReviews: [
        nativePullRequestReview({ body: "Native review summary", commit_id: previousHeadSha }),
      ],
      pullRequestReviewComments: [nativePullRequestReviewComment({ commit_id: previousHeadSha })],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "success",
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
      evaluateCodexReview({
        comments: [],
        pullRequestReviews: null,
        pullRequestReviewComments: [],
        pullRequest: pullRequest(),
      }).conclusion,
    ).toBe("failure");
    expect(
      evaluateCodexReview({
        comments: [],
        pullRequestReviews: [
          nativePullRequestReview({ state: "CHANGES_REQUESTED", body: "Native review summary" }),
        ],
        pullRequestReviewComments: [],
        pullRequest: pullRequest(),
      }).conclusion,
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

  it("fails malformed, legacy-marker, and untrusted native results closed", () => {
    expect(
      decisionFor([
        codexComment({
          body: `${NATIVE_CODEX_NO_MAJOR_PREFIX}\n\nNo reviewed commit was supplied.`,
        }),
      ]).conclusion,
    ).toBe("failure");
    expect(
      decisionFor([
        codexComment({
          body: `${observedNativeNoMajorBody()}\n**Reviewed commit:** \`${previousHeadSha.slice(0, 10)}\``,
        }),
      ]).conclusion,
    ).toBe("failure");
    expect(
      decisionFor([codexComment({ body: legacyMarkerBody(currentHeadSha, "PASS") })]).conclusion,
    ).toBe("failure");
    expect(
      decisionFor([
        codexComment({
          body: observedNativeNoMajorBody(),
          user: { id: 999, login: "owner", type: "User" },
        }),
      ]).conclusion,
    ).toBe("failure");
  });

  it("ignores stale native results when the current head has a valid PASS", () => {
    const decision = decisionFor([
      codexComment({ id: 402, body: observedNativeNoMajorBody(previousHeadSha) }),
      codexComment({ id: 403 }),
    ]);

    expect(decision).toMatchObject({
      conclusion: "success",
      headSha: currentHeadSha,
      result: "PASS",
      resultCommentId: "403",
    });
  });

  it("does not let malformed stale review prose poison a current PASS", () => {
    const decision = evaluateCodexReview({
      comments: [codexComment()],
      pullRequestReviews: [
        nativePullRequestReview({
          body: `${NATIVE_CODEX_NO_MAJOR_PREFIX}\nReviewed commit: not-a-sha`,
          commit_id: previousHeadSha,
        }),
      ],
      pullRequestReviewComments: [],
      pullRequest: pullRequest(),
    });

    expect(decision).toMatchObject({
      conclusion: "success",
      result: "PASS",
      resultCommentId: "401",
    });
  });

  it("fails conflicting reviewed-commit bindings closed", () => {
    const conflictingIssue = `${observedNativeNoMajorBody()}\n**Reviewed commit:** \`${previousHeadSha.slice(0, 10)}\``;
    const decision = decisionFor([codexComment({ body: conflictingIssue })]);

    expect(decision.conclusion).toBe("failure");
  });

  it("invalidates a previous-head result until the new head has a fresh result", () => {
    const oldResult = codexComment({ body: observedNativeNoMajorBody(previousHeadSha) });

    expect(decisionFor([oldResult]).conclusion).toBe("failure");
    expect(
      decisionFor(
        [oldResult, codexComment({ id: 402, body: observedNativeNoMajorBody(nextHeadSha) })],
        {
          head: { sha: nextHeadSha },
        },
      ).conclusion,
    ).toBe("success");
  });

  it("routes pull-request, review, and issue-comment events through the same recomputation seam", () => {
    expect(getEventPullRequestNumber("pull_request_target", { pull_request: { number: 51 } })).toBe(
      51,
    );
    for (const eventName of ["pull_request_review", "pull_request_review_comment"]) {
      expect(getEventPullRequestNumber(eventName, { pull_request: { number: 51 } })).toBe(51);
    }
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
    expect(getEventHeadSha({ comment: codexComment() })).toBeUndefined();
    expect(
      getEventHeadSha({
        comment: codexComment({
          user: { id: 999, login: "arbitrary-user", type: "User" },
        }),
      }),
    ).toBeUndefined();
  });

  it("uses authoritative pull-request metadata for URL-only issue-comment events", () => {
    const issueCommentEvent = {
      issue: { number: 51, pull_request: { url: "https://api.github.com/pulls/51" } },
    };

    expect(getFallbackHeadSha(issueCommentEvent, currentHeadSha)).toBe(currentHeadSha);
    expect(getFallbackHeadSha(issueCommentEvent, previousHeadSha)).toBe(previousHeadSha);
    expect(getFallbackHeadSha(issueCommentEvent, "not-a-sha")).toBeUndefined();
    expect(getFallbackHeadSha(issueCommentEvent, [[{ sha: currentHeadSha }]])).toBeUndefined();
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
    expect(flattenPullRequestReviewPages([[nativePullRequestReview()]])).toHaveLength(1);
    expect(flattenPullRequestReviewCommentPages([[nativePullRequestReviewComment()]])).toHaveLength(
      1,
    );
    expect(() => flattenPullRequestReviewPages([[nativePullRequestReview()], {}])).toThrow(
      "malformed pull-request review pages",
    );
    expect(() =>
      flattenPullRequestReviewCommentPages([[nativePullRequestReviewComment()], {}]),
    ).toThrow("malformed pull-request review-comment pages");
  });

  it("bounds paginated GitHub API output before parsing it", () => {
    expect(GH_API_MAX_BUFFER).toBe(8 * 1024 * 1024);
    expect(readFileSync(codexReviewScriptPath, "utf8")).toContain("maxBuffer: GH_API_MAX_BUFFER");
  });

  it("fails duplicate or conflicting current-head results", () => {
    expect(decisionFor([codexComment(), codexComment({ id: 402 })]).conclusion).toBe("failure");
    expect(decisionFor([codexComment(), codexComment({ id: 402 })]).conclusion).toBe("failure");
    expect(
      evaluateCodexReview({
        comments: [codexComment()],
        pullRequestReviews: [
          nativePullRequestReview({ id: 403, state: "CHANGES_REQUESTED", body: "Native review" }),
        ],
        pullRequestReviewComments: [],
        pullRequest: pullRequest(),
      }).conclusion,
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
    expect(workflow).toContain("pull_request_review:");
    expect(workflow).toContain("pull_request_review_comment:");
    expect(workflow).toContain("github.event_name == 'pull_request_review'");
    expect(workflow).toContain("github.event_name == 'pull_request_review_comment'");
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
    expect(documentation).toContain("@codex review");
    expect(documentation).toContain("pull_request_review_id");
    expect(documentation).toContain("headRefOid");
    expect(documentation).not.toContain("pull-request commits endpoint");
    expect(documentation).toContain("MODULE_NOT_FOUND");
    expect(documentation).toContain("bootstrap");
    expect(documentation).toContain("/owner-approve");
    expect(documentation).toContain("recovery");

    const rootAgents = readFileSync(rootAgentsPath, "utf8");
    expect(rootAgents).toContain("## Code Review Rules");
    expect(rootAgents).toContain("@codex review");
    expect(rootAgents).toContain("Reviewed commit");
    expect(rootAgents).toContain(CODEX_LOGIN);
    expect(rootAgents).not.toContain("codex-review: v1");
    expect(rootAgents).not.toContain("Result: PASS");
    expect(rootAgents).not.toContain("Result: CHANGES_REQUESTED");
  });

  it("targets Codex review in the exact protection policy and defers live activation", () => {
    expect(REQUIRED_CONTEXTS).toEqual([
      "Root quality gate",
      "Owner approval",
      "CodeQL analysis",
      "Dependency review",
      "Codex review",
    ]);
    expect(REQUIRED_CHECK_BINDINGS).toEqual([
      { context: "Codex review", app_id: TRUSTED_GITHUB_ACTIONS_APP_ID },
    ]);
    expect(hasExpectedCodexReviewBinding(REQUIRED_CHECK_BINDINGS)).toBe(true);
    expect(hasExpectedCodexReviewBinding([{ context: "Codex review", app_id: null }])).toBe(false);
    expect(
      hasExpectedCodexReviewBinding([
        { context: "Codex review", app_id: TRUSTED_GITHUB_ACTIONS_APP_ID + 1 },
      ]),
    ).toBe(false);

    const protectionDocumentation = readFileSync(protectionDocumentationPath, "utf8");
    expect(protectionDocumentation).toContain("Codex review");
    expect(protectionDocumentation).toContain("@codex review");
    expect(protectionDocumentation).toContain("MODULE_NOT_FOUND");
    expect(protectionDocumentation).toContain("successful baseline");
    expect(protectionDocumentation).toContain("does not mutate live main protection");
  });
});
