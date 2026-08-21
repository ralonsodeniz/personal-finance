import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  APPROVAL_COMMENT_MARKER,
  GH_API_MAX_BUFFER,
  GH_API_TIMEOUT_MS,
  MANAGED_CHECK_MARKER,
  OWNER_APPROVAL_COMMAND,
  OWNER_APPROVAL_CHECK_NAME,
  OWNER_ID,
  OWNER_LOGIN,
  TRUSTED_GITHUB_ACTIONS_APP_ID,
  TRUSTED_GITHUB_ACTIONS_APP_NAME,
  TRUSTED_GITHUB_ACTIONS_APP_SLUG,
  buildOwnerApprovalCheckPayload,
  evaluateOwnerApproval,
  flattenCheckRunPages,
  flattenIssueCommentPages,
  getEventHeadSha,
  getFallbackHeadSha,
  getManagedApprovalCommentId,
  isExactOwnerApprovalComment,
  isManagedOwnerApprovalCheckRun,
  isOwnerApprovalTarget,
  runGhApi,
} from "../scripts/owner-approval.mjs";

const currentHeadSha = "a".repeat(40);
const previousHeadSha = "b".repeat(40);
const workflowPath = fileURLToPath(
  new URL("../.github/workflows/owner-approval.yml", import.meta.url),
);
const ownerApprovalScriptPath = fileURLToPath(
  new URL("../scripts/owner-approval.mjs", import.meta.url),
);
const documentationPath = fileURLToPath(
  new URL("../docs/agents/owner-approval.md", import.meta.url),
);
const protectionDocumentationPath = fileURLToPath(
  new URL("../docs/architecture/main-protection.md", import.meta.url),
);

const trustedGitHubActionsApp = {
  id: TRUSTED_GITHUB_ACTIONS_APP_ID,
  name: TRUSTED_GITHUB_ACTIONS_APP_NAME,
  slug: TRUSTED_GITHUB_ACTIONS_APP_SLUG,
};

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
    app: trustedGitHubActionsApp,
    output: {
      text: `${MANAGED_CHECK_MARKER}\nCurrent head SHA: ${headSha}\n${APPROVAL_COMMENT_MARKER} ${approvalCommentId}`,
    },
    status: "completed",
  };
}

function boundFailureCheck(headSha = currentHeadSha, approvalCommentId = "101") {
  return {
    ...buildOwnerApprovalCheckPayload({
      decision: {
        approvalCommentId,
        conclusion: "failure",
        headSha,
        reason: "The current pull-request metadata could not be verified; retry is required.",
      },
    }),
    app: trustedGitHubActionsApp,
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
    ).toBe(false);
    expect(
      isExactOwnerApprovalComment(ownerComment({ user: { login: OWNER_LOGIN, type: "User" } })),
    ).toBe(false);
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

  it("recovers a bound authorization after a transient non-success result", () => {
    const failure = boundFailureCheck();

    expect(isManagedOwnerApprovalCheckRun(failure, currentHeadSha)).toBe(true);
    expect(getManagedApprovalCommentId(failure, currentHeadSha)).toBeUndefined();
    expect(
      evaluateOwnerApproval({
        checkRuns: [failure],
        comments: [ownerComment()],
        pullRequest: pullRequest(),
      }).conclusion,
    ).toBe("success");
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

  it("recognizes only its managed current-head check run from GitHub Actions", () => {
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
    expect(
      isManagedOwnerApprovalCheckRun(
        {
          ...grantedCheck(),
          app: { ...trustedGitHubActionsApp, id: TRUSTED_GITHUB_ACTIONS_APP_ID + 1 },
        },
        currentHeadSha,
      ),
    ).toBe(false);
    expect(
      isManagedOwnerApprovalCheckRun(
        { ...grantedCheck(), app: { ...trustedGitHubActionsApp, slug: "foreign-actions" } },
        currentHeadSha,
      ),
    ).toBe(false);
    expect(
      isManagedOwnerApprovalCheckRun(
        { ...grantedCheck(), app: { ...trustedGitHubActionsApp, name: "Foreign Actions" } },
        currentHeadSha,
      ),
    ).toBe(false);
    expect(
      isManagedOwnerApprovalCheckRun(
        { ...grantedCheck(), app: { id: TRUSTED_GITHUB_ACTIONS_APP_ID } },
        currentHeadSha,
      ),
    ).toBe(false);
    expect(
      isManagedOwnerApprovalCheckRun({ ...grantedCheck(), app: undefined }, currentHeadSha),
    ).toBe(false);
    expect(
      isManagedOwnerApprovalCheckRun(
        {
          ...grantedCheck(),
          output: { text: `${MANAGED_CHECK_MARKER}\nCurrent head SHA: ${currentHeadSha}` },
        },
        currentHeadSha,
      ),
    ).toBe(false);
    expect(
      isManagedOwnerApprovalCheckRun({ ...grantedCheck(), conclusion: "neutral" }, currentHeadSha),
    ).toBe(false);
  });

  it("fails closed when a foreign managed-looking check run is the only authorization", () => {
    const foreignCheck = {
      ...grantedCheck(),
      app: { ...trustedGitHubActionsApp, id: TRUSTED_GITHUB_ACTIONS_APP_ID + 1 },
    };

    expect(
      evaluateOwnerApproval({
        checkRuns: [foreignCheck],
        comments: [ownerComment()],
        pullRequest: pullRequest(),
      }).conclusion,
    ).toBe("failure");
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
    expect(payload.output.text).toContain(`${APPROVAL_COMMENT_MARKER} 101`);
  });

  it("bounds GitHub API calls and recovers issue-comment heads from trusted metadata", () => {
    expect(GH_API_TIMEOUT_MS).toBe(30_000);
    expect(GH_API_MAX_BUFFER).toBe(8 * 1024 * 1024);
    expect(getEventHeadSha({ pull_request: { head: { sha: currentHeadSha } } })).toBe(
      currentHeadSha,
    );
    expect(
      getEventHeadSha({
        issue: { pull_request: { url: "https://api.github.com/repos/example/pulls/39" } },
      }),
    ).toBeUndefined();
    expect(
      getFallbackHeadSha(
        {
          issue: {
            number: 39,
            pull_request: { url: "https://api.github.com/repos/example/pulls/39" },
          },
        },
        currentHeadSha,
      ),
    ).toBe(currentHeadSha);
    expect(getFallbackHeadSha({}, "not-a-sha")).toBeUndefined();
  });

  it("enforces timeout and output bounds on GitHub API subprocesses", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "owner-approval-test-"));
    const ghPath = join(temporaryDirectory, "gh");
    const fakeGh = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes("timeout")) {
  setInterval(() => {}, 1000);
} else {
  process.stdout.write("x".repeat(2048));
}
`;

    try {
      writeFileSync(ghPath, fakeGh);
      chmodSync(ghPath, 0o755);
      const environment = { ...process.env, PATH: `${temporaryDirectory}:${process.env.PATH}` };

      expect(() =>
        runGhApi(["timeout"], undefined, {
          env: environment,
          timeout: 25,
          maxBuffer: GH_API_MAX_BUFFER,
        }),
      ).toThrowError(expect.objectContaining({ code: "ETIMEDOUT" }));
      expect(() =>
        runGhApi(["buffer"], undefined, {
          env: environment,
          timeout: GH_API_TIMEOUT_MS,
          maxBuffer: 1024,
        }),
      ).toThrowError(expect.objectContaining({ code: "ENOBUFS" }));
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("publishes a current-head failure when issue-comment metadata lookup fails", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "owner-approval-test-"));
    const eventPath = join(temporaryDirectory, "event.json");
    const ghPath = join(temporaryDirectory, "gh");
    const recordPath = join(temporaryDirectory, "check-payload.json");
    const fakeGh = `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args.includes("graphql")) {
  console.log(JSON.stringify({ data: { repository: { pullRequest: { headRefOid: ${JSON.stringify(currentHeadSha)} } } } }));
  process.exit(0);
}
if (args.some((argument) => argument.includes("/pulls/39"))) {
  console.error("metadata unavailable");
  process.exit(1);
}
if (args.some((argument) => argument.includes("/check-runs?"))) {
  console.log(${JSON.stringify(JSON.stringify([{ check_runs: [grantedCheck()] }]))});
  process.exit(0);
}
if (args.includes("POST") || args.includes("PATCH")) {
  writeFileSync(${JSON.stringify(recordPath)}, readFileSync(0, "utf8"));
  console.log("{}");
  process.exit(0);
}
console.log("{}");
`;

    try {
      writeFileSync(
        eventPath,
        JSON.stringify({
          issue: { number: 39, pull_request: { url: "https://api.github.com/pulls/39" } },
        }),
      );
      writeFileSync(ghPath, fakeGh);
      chmodSync(ghPath, 0o755);

      let workflowError;

      try {
        execFileSync(process.execPath, [ownerApprovalScriptPath], {
          cwd: fileURLToPath(new URL("..", import.meta.url)),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: "issue_comment",
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_REPOSITORY: "ralonsodeniz/personal-finance",
            PATH: `${temporaryDirectory}:${process.env.PATH}`,
          },
        });
      } catch (error) {
        workflowError = error;
      }

      expect(workflowError?.status).toBe(1);
      expect(readFileSync(recordPath, "utf8")).toMatch(
        new RegExp(`"conclusion":"failure".*Current head SHA: ${currentHeadSha}`),
      );
      expect(readFileSync(recordPath, "utf8")).toContain(`${APPROVAL_COMMENT_MARKER} 101`);
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("publishes a current-head failure when lifecycle metadata lookup fails", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "owner-approval-test-"));
    const eventPath = join(temporaryDirectory, "event.json");
    const ghPath = join(temporaryDirectory, "gh");
    const recordPath = join(temporaryDirectory, "check-payload.json");
    const fakeGh = `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args.some((argument) => argument.includes("/pulls/39"))) {
  console.error("metadata unavailable");
  process.exit(1);
}
if (args.some((argument) => argument.includes("/check-runs?"))) {
  console.log("[{\\"check_runs\\":[]}]");
  process.exit(0);
}
if (args.includes("POST")) {
  writeFileSync(${JSON.stringify(recordPath)}, readFileSync(0, "utf8"));
  console.log("{}");
  process.exit(0);
}
console.log("[]");
`;

    try {
      writeFileSync(
        eventPath,
        JSON.stringify({
          pull_request: { number: 39, head: { sha: currentHeadSha } },
        }),
      );
      writeFileSync(ghPath, fakeGh);
      chmodSync(ghPath, 0o755);

      let workflowError;

      try {
        execFileSync(process.execPath, [ownerApprovalScriptPath], {
          cwd: fileURLToPath(new URL("..", import.meta.url)),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: "pull_request_target",
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_REPOSITORY: "ralonsodeniz/personal-finance",
            PATH: `${temporaryDirectory}:${process.env.PATH}`,
          },
        });
      } catch (error) {
        workflowError = error;
      }

      expect(workflowError?.status).toBe(1);
      expect(readFileSync(recordPath, "utf8")).toMatch(
        new RegExp(`"conclusion":"failure".*"head_sha":"${currentHeadSha}"`),
      );
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("publishes a current-head failure when approval-state API lookup fails", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "owner-approval-test-"));
    const eventPath = join(temporaryDirectory, "event.json");
    const ghPath = join(temporaryDirectory, "gh");
    const recordPath = join(temporaryDirectory, "check-payload.json");
    const fakeGh = `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args.some((argument) => argument.includes("/pulls/39"))) {
  console.log(JSON.stringify({ number: 39, state: "open", base: { ref: "main" }, head: { sha: ${JSON.stringify(currentHeadSha)} } }));
  process.exit(0);
}
if (args.some((argument) => argument.includes("/issues/39/comments"))) {
  console.error("comments unavailable");
  process.exit(1);
}
if (args.some((argument) => argument.includes("/check-runs?"))) {
  console.log("[{\\"check_runs\\":[]}]");
  process.exit(0);
}
if (args.includes("POST")) {
  writeFileSync(${JSON.stringify(recordPath)}, readFileSync(0, "utf8"));
  console.log("{}");
  process.exit(0);
}
console.log("{}");
`;

    try {
      writeFileSync(
        eventPath,
        JSON.stringify({
          issue: { number: 39, pull_request: { url: "https://api.github.com/pulls/39" } },
        }),
      );
      writeFileSync(ghPath, fakeGh);
      chmodSync(ghPath, 0o755);

      let workflowError;

      try {
        execFileSync(process.execPath, [ownerApprovalScriptPath], {
          cwd: fileURLToPath(new URL("..", import.meta.url)),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: "issue_comment",
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_REPOSITORY: "ralonsodeniz/personal-finance",
            PATH: `${temporaryDirectory}:${process.env.PATH}`,
          },
        });
      } catch (error) {
        workflowError = error;
      }

      expect(workflowError?.status).toBe(1);
      expect(readFileSync(recordPath, "utf8")).toMatch(
        new RegExp(`"conclusion":"failure".*"head_sha":"${currentHeadSha}"`),
      );
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("fails closed without publishing when no authoritative fallback head exists", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "owner-approval-test-"));
    const eventPath = join(temporaryDirectory, "event.json");
    const ghPath = join(temporaryDirectory, "gh");
    const recordPath = join(temporaryDirectory, "check-payload.json");
    const fakeGh = `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args.includes("graphql")) {
  console.log(JSON.stringify({ data: { repository: { pullRequest: {} } } }));
  process.exit(0);
}
if (args.some((argument) => argument.includes("/pulls/39"))) {
  process.exit(1);
}
if (args.includes("POST")) {
  writeFileSync(${JSON.stringify(recordPath)}, "unexpected publication");
}
console.log("{}");
`;

    try {
      writeFileSync(
        eventPath,
        JSON.stringify({
          issue: { number: 39, pull_request: { url: "https://api.github.com/pulls/39" } },
        }),
      );
      writeFileSync(ghPath, fakeGh);
      chmodSync(ghPath, 0o755);

      let workflowError;

      try {
        execFileSync(process.execPath, [ownerApprovalScriptPath], {
          cwd: fileURLToPath(new URL("..", import.meta.url)),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: "issue_comment",
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_REPOSITORY: "ralonsodeniz/personal-finance",
            PATH: `${temporaryDirectory}:${process.env.PATH}`,
          },
        });
      } catch (error) {
        workflowError = error;
      }

      expect(workflowError?.status).toBe(1);
      expect(existsSync(recordPath)).toBe(false);
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("rejects malformed paginated API responses instead of discarding pages", () => {
    expect(flattenIssueCommentPages([[ownerComment()]])).toHaveLength(1);
    expect(() => flattenIssueCommentPages([[ownerComment()], { body: "unexpected" }])).toThrow(
      "malformed issue-comment pages",
    );
    expect(flattenCheckRunPages([{ check_runs: [] }])).toEqual([]);
    expect(() => flattenCheckRunPages([{ check_runs: [] }, []])).toThrow(
      "malformed check-run pages",
    );
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
    expect(workflow).toContain("name: Recompute current approval state");
    expect(workflow).not.toContain("name: Recompute owner approval");
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
    expect(documentation).toMatch(/release authorization, not\s+code review/);
    expect(documentation).toMatch(/GitHub Actions\s+publisher identity: app ID `15368`/);
    expect(documentation).toContain("Recompute current approval state");
    expect(documentation).toContain("mergeState");

    const protectionDocumentation = readFileSync(protectionDocumentationPath, "utf8");
    expect(protectionDocumentation).toContain("all non-Owner required contexts");
    expect(protectionDocumentation).toContain("only remaining blocker");
    expect(protectionDocumentation).toContain("mergeState is clean");
  });
});
