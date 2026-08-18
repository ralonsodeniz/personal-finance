import { readFileSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  APPROVAL_COMMENT_MARKER,
  MANAGED_CHECK_MARKER,
  OWNER_APPROVAL_COMMAND,
  OWNER_APPROVAL_CHECK_NAME,
  OWNER_ID,
  OWNER_LOGIN,
  buildOwnerApprovalCheckPayload,
  evaluateOwnerApproval,
  getManagedApprovalCommentId,
  isExactOwnerApprovalComment,
  isManagedOwnerApprovalCheckRun,
  isOwnerApprovalTarget,
} from "../scripts/owner-approval.mjs";

const currentHeadSha = "a".repeat(40);
const previousHeadSha = "b".repeat(40);
const workflowPath = fileURLToPath(
  new URL("../.github/workflows/owner-approval.yml", import.meta.url),
);
const documentationPath = fileURLToPath(
  new URL("../docs/agents/owner-approval.md", import.meta.url),
);

function ownerComment(overrides = {}) {
  return {
    body: OWNER_APPROVAL_COMMAND,
    id: 101,
    user: { id: OWNER_ID, login: OWNER_LOGIN, type: "User" },
    ...overrides,
  };
}

function pullRequest(overrides = {}) {
  return {
    number: 39,
    state: "open",
    base: { ref: "main" },
    head: { sha: currentHeadSha },
    ...overrides,
  };
}

function grantedCheck(headSha = currentHeadSha, approvalCommentId = "101") {
  return {
    conclusion: "success",
    head_sha: headSha,
    name: OWNER_APPROVAL_CHECK_NAME,
    output: {
      text: `${MANAGED_CHECK_MARKER}\nCurrent head SHA: ${headSha}\n${APPROVAL_COMMENT_MARKER} ${approvalCommentId}`,
    },
  };
}

describe("owner approval policy", () => {
  it("accepts only the exact command from the canonical human identity", () => {
    expect(isExactOwnerApprovalComment(ownerComment())).toBe(true);
    expect(isExactOwnerApprovalComment(ownerComment({ body: `${OWNER_APPROVAL_COMMAND}\n` }))).toBe(
      false,
    );
    expect(
      isExactOwnerApprovalComment(ownerComment({ body: `Please use ${OWNER_APPROVAL_COMMAND}` })),
    ).toBe(false);
    expect(
      isExactOwnerApprovalComment(
        ownerComment({ user: { id: OWNER_ID + 1, login: "another-user", type: "User" } }),
      ),
    ).toBe(false);
    expect(
      isExactOwnerApprovalComment(
        ownerComment({ user: { id: OWNER_ID + 1, login: OWNER_LOGIN, type: "User" } }),
      ),
    ).toBe(true);
    expect(
      isExactOwnerApprovalComment(
        ownerComment({ user: { id: OWNER_ID, login: "renamed-owner", type: "User" } }),
      ),
    ).toBe(true);
    expect(
      isExactOwnerApprovalComment(
        ownerComment({ user: { id: OWNER_ID + 1, login: "another-user", type: "User" } }),
      ),
    ).toBe(false);
    expect(
      isExactOwnerApprovalComment(
        ownerComment({ user: { id: OWNER_ID, login: OWNER_LOGIN, type: "Bot" } }),
      ),
    ).toBe(false);
  });

  it("fails closed when the approval belongs to an older head SHA", () => {
    const decision = evaluateOwnerApproval({
      checkRuns: [grantedCheck(previousHeadSha)],
      comments: [ownerComment()],
      pullRequest: pullRequest(),
    });

    expect(decision.conclusion).toBe("failure");
  });

  it("accepts an exact owner command for the current pull-request head", () => {
    const approval = ownerComment();
    const decision = evaluateOwnerApproval({
      checkRuns: [],
      comments: [approval],
      eventAction: "created",
      eventComment: approval,
      eventIssueNumber: 39,
      pullRequest: pullRequest(),
    });

    expect(decision.conclusion).toBe("success");
  });

  it("binds current-head authorization to the approving comment ID", () => {
    const newerApproval = ownerComment({ id: 202 });
    const decision = evaluateOwnerApproval({
      checkRuns: [grantedCheck(currentHeadSha, "202")],
      comments: [ownerComment()],
      eventAction: "deleted",
      eventComment: newerApproval,
      eventIssueNumber: 39,
      pullRequest: pullRequest(),
    });

    expect(decision.conclusion).toBe("failure");
  });

  it("does not authorize wrong commands, prose, actors, or bots", () => {
    const invalidComments = [
      ownerComment({ body: "owner-approve" }),
      ownerComment({ body: "Please /owner-approve" }),
      ownerComment({ user: { id: OWNER_ID + 1, login: "another-user", type: "User" } }),
      ownerComment({ user: { id: OWNER_ID, login: OWNER_LOGIN, type: "Bot" } }),
    ];

    for (const comment of invalidComments) {
      const decision = evaluateOwnerApproval({
        checkRuns: [],
        comments: [comment],
        eventAction: "created",
        eventComment: comment,
        eventIssueNumber: 39,
        pullRequest: pullRequest(),
      });

      expect(decision.conclusion).toBe("failure");
    }
  });

  it("preserves current authorization while unrelated comments are recomputed", () => {
    const decision = evaluateOwnerApproval({
      checkRuns: [grantedCheck()],
      comments: [ownerComment()],
      eventAction: "created",
      eventComment: { body: "A question", user: { id: 7, login: "reviewer", type: "User" } },
      eventIssueNumber: 39,
      pullRequest: pullRequest(),
    });

    expect(decision.conclusion).toBe("success");
  });

  it("revokes authorization when the last exact comment is edited or deleted", () => {
    for (const eventAction of ["edited", "deleted"]) {
      const decision = evaluateOwnerApproval({
        checkRuns: [grantedCheck()],
        comments: [],
        eventAction,
        eventComment: ownerComment(),
        eventIssueNumber: 39,
        pullRequest: pullRequest(),
      });

      expect(decision.conclusion).toBe("failure");
    }
  });

  it("does not authorize a comment associated with another pull request", () => {
    const decision = evaluateOwnerApproval({
      checkRuns: [],
      comments: [ownerComment({ issue_number: 40 })],
      eventAction: "created",
      eventComment: ownerComment(),
      eventIssueNumber: 40,
      pullRequest: pullRequest(),
    });

    expect(decision.conclusion).toBe("failure");
  });

  it("does not authorize a closed or non-main pull request", () => {
    expect(isOwnerApprovalTarget(pullRequest())).toBe(true);
    expect(isOwnerApprovalTarget(pullRequest({ state: "closed" }))).toBe(false);
    expect(isOwnerApprovalTarget(pullRequest({ base: { ref: "develop" } }))).toBe(false);

    expect(
      evaluateOwnerApproval({
        checkRuns: [],
        comments: [ownerComment()],
        eventAction: "created",
        eventComment: ownerComment(),
        eventIssueNumber: 39,
        pullRequest: pullRequest({ state: "closed" }),
      }).conclusion,
    ).toBe("failure");

    expect(
      evaluateOwnerApproval({
        checkRuns: [],
        comments: [ownerComment()],
        eventAction: "created",
        eventComment: ownerComment(),
        eventIssueNumber: 39,
        pullRequest: pullRequest({ base: { ref: "develop" } }),
      }).conclusion,
    ).toBe("failure");
  });

  it("recognizes only its managed current-head check run", () => {
    expect(isManagedOwnerApprovalCheckRun(grantedCheck(), currentHeadSha)).toBe(true);
    expect(getManagedApprovalCommentId(grantedCheck(), currentHeadSha)).toBe("101");
    expect(isManagedOwnerApprovalCheckRun(grantedCheck(previousHeadSha), currentHeadSha)).toBe(
      false,
    );
    expect(
      isManagedOwnerApprovalCheckRun(
        { ...grantedCheck(), output: { text: "a different check" } },
        currentHeadSha,
      ),
    ).toBe(false);
  });

  it("builds the stable check payload against the current head SHA", () => {
    const payload = buildOwnerApprovalCheckPayload({
      decision: {
        approvalCommentId: "101",
        conclusion: "failure",
        headSha: currentHeadSha,
        reason: "Approval is required.",
      },
    });

    expect(payload).toMatchObject({
      conclusion: "failure",
      head_sha: currentHeadSha,
      name: OWNER_APPROVAL_CHECK_NAME,
      status: "completed",
    });
    expect(payload.output.text).toContain(currentHeadSha);
  });

  it("records the approving comment ID in a successful check", () => {
    const payload = buildOwnerApprovalCheckPayload({
      decision: {
        approvalCommentId: "202",
        conclusion: "success",
        headSha: currentHeadSha,
        reason: "Approval is present.",
      },
    });

    expect(payload.output.text).toContain(`${APPROVAL_COMMENT_MARKER} 202`);
  });

  it("keeps the workflow metadata-only and executes trusted main-branch code", () => {
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("pull_request_target:");
    expect(workflow).toContain("issue_comment:");
    expect(workflow).toContain("checks: write");
    expect(workflow).toContain("repository: ralonsodeniz/personal-finance");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("run: node scripts/owner-approval.mjs");
    expect(workflow).not.toContain("pull_request:\n");
    expect(workflow).not.toContain("github.event.pull_request.head.sha");
    expect(workflow).not.toContain("pnpm install");
    expect(workflow).not.toContain("npm install");
  });

  it("documents the exact command and current-head behavior", () => {
    const documentation = readFileSync(documentationPath, "utf8");

    expect(documentation).toContain("/owner-approve");
    expect(documentation).toContain("Owner approval");
    expect(documentation).toContain("28633982");
    expect(documentation).toContain("current head SHA");
    expect(documentation).toContain("pull_request_target");
  });
});
