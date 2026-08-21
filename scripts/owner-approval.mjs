import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const OWNER_APPROVAL_COMMAND = "/owner-approve";
export const OWNER_APPROVAL_CHECK_NAME = "Owner approval";
export const MANAGED_CHECK_MARKER = "owner-approval-workflow-v1";
export const APPROVAL_COMMENT_MARKER = "Approval comment ID:";
export const OWNER_LOGIN = "ralonsodeniz";
export const OWNER_ID = 28633982;
export const TARGET_BRANCH = "main";
export const TRUSTED_GITHUB_ACTIONS_APP_ID = 15368;
export const TRUSTED_GITHUB_ACTIONS_APP_NAME = "GitHub Actions";
export const TRUSTED_GITHUB_ACTIONS_APP_SLUG = "github-actions";
export const GH_API_TIMEOUT_MS = 30_000;
export const GH_API_MAX_BUFFER = 8 * 1024 * 1024;

export function isExactOwnerApprovalComment(comment) {
  return (
    comment?.body === OWNER_APPROVAL_COMMAND &&
    comment.user?.type === "User" &&
    comment.user?.id === OWNER_ID
  );
}

function belongsToPullRequest(comment, pullRequestNumber) {
  const commentPullRequestNumber = comment?.issue_number ?? comment?.issueNumber;

  return (
    commentPullRequestNumber === undefined ||
    Number(commentPullRequestNumber) === Number(pullRequestNumber)
  );
}

export function isOwnerApprovalTarget(pullRequest) {
  return pullRequest?.state === "open" && pullRequest?.base?.ref === TARGET_BRANCH;
}

function isFullSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

export function isEligiblePullRequest(pullRequest) {
  return (
    isOwnerApprovalTarget(pullRequest) &&
    typeof pullRequest?.number === "number" &&
    isFullSha(pullRequest?.head?.sha)
  );
}

function isTrustedGitHubActionsPublisher(checkRun) {
  const app = checkRun?.app;

  return (
    app?.id === TRUSTED_GITHUB_ACTIONS_APP_ID &&
    app?.name === TRUSTED_GITHUB_ACTIONS_APP_NAME &&
    app?.slug === TRUSTED_GITHUB_ACTIONS_APP_SLUG
  );
}

function approvalCommentIdFromOutput(outputText) {
  if (typeof outputText !== "string") {
    return undefined;
  }

  const match = new RegExp(`(?:^|\\n)${APPROVAL_COMMENT_MARKER} ([1-9][0-9]*)(?:\\n|$)`).exec(
    outputText,
  );

  return match?.[1];
}

function hasValidManagedOutput(checkRun, currentHeadSha) {
  const outputText = checkRun?.output?.text;

  if (
    typeof outputText !== "string" ||
    !outputText.startsWith(`${MANAGED_CHECK_MARKER}\nCurrent head SHA: ${currentHeadSha}\n`)
  ) {
    return false;
  }

  const approvalCommentId = approvalCommentIdFromOutput(outputText);

  return checkRun.conclusion === "success" ? approvalCommentId !== undefined : true;
}

export function isManagedOwnerApprovalCheckRun(checkRun, currentHeadSha) {
  return (
    checkRun?.name === OWNER_APPROVAL_CHECK_NAME &&
    isFullSha(currentHeadSha) &&
    checkRun?.head_sha === currentHeadSha &&
    checkRun?.status === "completed" &&
    (checkRun?.conclusion === "success" || checkRun?.conclusion === "failure") &&
    hasValidManagedOutput(checkRun, currentHeadSha) &&
    isTrustedGitHubActionsPublisher(checkRun)
  );
}

function getManagedApprovalBindingCommentId(checkRun, currentHeadSha) {
  if (!isManagedOwnerApprovalCheckRun(checkRun, currentHeadSha)) {
    return undefined;
  }

  return approvalCommentIdFromOutput(checkRun.output.text);
}

export function getManagedApprovalCommentId(checkRun, currentHeadSha) {
  if (
    !isManagedOwnerApprovalCheckRun(checkRun, currentHeadSha) ||
    checkRun.conclusion !== "success"
  ) {
    return undefined;
  }

  return approvalCommentIdFromOutput(checkRun.output.text);
}

export function evaluateOwnerApproval({
  checkRuns = [],
  comments = [],
  eventAction,
  eventComment,
  eventIssueNumber,
  pullRequest,
}) {
  const currentHeadSha = pullRequest?.head?.sha;

  if (!isEligiblePullRequest(pullRequest)) {
    return {
      conclusion: "failure",
      headSha: currentHeadSha,
      reason: "The pull request must be open and target main.",
    };
  }

  const exactApprovalComments = comments.filter(
    (comment) =>
      belongsToPullRequest(comment, pullRequest.number) && isExactOwnerApprovalComment(comment),
  );
  const currentHeadApprovalCommentId = checkRuns
    .map((checkRun) => getManagedApprovalBindingCommentId(checkRun, currentHeadSha))
    .find((commentId) => exactApprovalComments.some((comment) => String(comment.id) === commentId));
  const exactApprovalEvent =
    (eventAction === "created" || eventAction === "edited") &&
    Number(eventIssueNumber) === pullRequest.number &&
    belongsToPullRequest(eventComment, pullRequest.number) &&
    isExactOwnerApprovalComment(eventComment) &&
    eventComment?.id !== undefined &&
    exactApprovalComments.some((comment) => String(comment.id) === String(eventComment.id));

  if (exactApprovalEvent || currentHeadApprovalCommentId !== undefined) {
    return {
      conclusion: "success",
      headSha: currentHeadSha,
      approvalCommentId: exactApprovalEvent
        ? String(eventComment.id)
        : currentHeadApprovalCommentId,
      reason: "The canonical owner authorized this exact current head.",
    };
  }

  return {
    conclusion: "failure",
    headSha: currentHeadSha,
    reason: "An exact canonical-owner approval for this current head is required.",
  };
}

export function buildOwnerApprovalCheckPayload({ decision }) {
  if (!isFullSha(decision?.headSha)) {
    throw new Error("Owner approval checks require a full current head SHA.");
  }

  const isAuthorized = decision.conclusion === "success";

  const approvalCommentId = String(decision.approvalCommentId ?? "");

  if (isAuthorized && !/^[1-9][0-9]*$/.test(approvalCommentId)) {
    throw new Error("Successful owner approval checks require an approving comment ID.");
  }

  const approvalCommentText = /^[1-9][0-9]*$/.test(approvalCommentId)
    ? `\n${APPROVAL_COMMENT_MARKER} ${approvalCommentId}`
    : "";

  return {
    conclusion: decision.conclusion,
    head_sha: decision.headSha,
    name: OWNER_APPROVAL_CHECK_NAME,
    output: {
      text: `${MANAGED_CHECK_MARKER}\nCurrent head SHA: ${decision.headSha}${approvalCommentText}\n\n${decision.reason}`,
      title: isAuthorized ? "Owner approval granted" : "Owner approval required",
      summary: isAuthorized
        ? "The canonical repository owner authorized this current pull-request head."
        : "The canonical repository owner has not authorized this current pull-request head.",
    },
    status: "completed",
  };
}

const CANONICAL_REPOSITORY = "ralonsodeniz/personal-finance";

export function runGhApi(
  args,
  input,
  { timeout = GH_API_TIMEOUT_MS, maxBuffer = GH_API_MAX_BUFFER, env = process.env } = {},
) {
  const result = spawnSync("gh", ["api", ...args], {
    encoding: "utf8",
    env,
    input,
    killSignal: "SIGTERM",
    timeout,
    maxBuffer,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = result.stderr?.trim() || `exit code ${result.status}`;
    throw new Error(`gh api failed: ${details}`);
  }

  return result.stdout.trim();
}

function runGhApiJson(args, input) {
  const output = runGhApi(args, input);

  return output ? JSON.parse(output) : null;
}

function runGhApiPaginated(endpoint) {
  const pages = runGhApiJson(["--paginate", "--slurp", endpoint]);

  if (!Array.isArray(pages)) {
    throw new Error("gh api pagination returned an unexpected response.");
  }

  return pages;
}

function flattenArrayPages(pages, errorMessage) {
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page))) {
    throw new Error(errorMessage);
  }

  return pages.flat();
}

export function flattenIssueCommentPages(pages) {
  return flattenArrayPages(pages, "gh api returned malformed issue-comment pages.");
}

export function flattenCheckRunPages(pages) {
  if (!Array.isArray(pages) || pages.some((page) => !page || !Array.isArray(page.check_runs))) {
    throw new Error("gh api returned malformed check-run pages.");
  }

  return pages.flatMap((page) => page.check_runs);
}

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is required.");
  }

  return JSON.parse(readFileSync(eventPath, "utf8"));
}

function eventPullRequestNumber(eventName, event) {
  if (eventName === "pull_request_target") {
    return event.pull_request?.number;
  }

  if (eventName === "issue_comment" && event.issue?.pull_request) {
    return event.issue.number;
  }

  return undefined;
}

function eventIssueNumber(eventName, event) {
  return eventName === "issue_comment" ? event.issue?.number : undefined;
}

export function getEventHeadSha(event) {
  return event?.pull_request?.head?.sha ?? event?.issue?.pull_request?.head?.sha;
}

export function getFallbackHeadSha(event, authoritativeHeadSha) {
  const eventHeadSha = getEventHeadSha(event);

  if (isFullSha(eventHeadSha)) {
    return eventHeadSha;
  }

  return isFullSha(authoritativeHeadSha) ? authoritativeHeadSha : undefined;
}

function canonicalRepositoryParts() {
  if (process.env.GITHUB_REPOSITORY !== CANONICAL_REPOSITORY) {
    throw new Error(`This workflow only runs for ${CANONICAL_REPOSITORY}.`);
  }

  const [owner, repo] = CANONICAL_REPOSITORY.split("/");

  return { owner, repo };
}

function pullRequestFromApi({ owner, repo, number }) {
  return runGhApiJson([`repos/${owner}/${repo}/pulls/${number}`]);
}

function pullRequestHeadShaFromGraphql({ owner, repo, number }) {
  const query = [
    "query($owner: String!, $repo: String!, $number: Int!) {",
    "repository(owner: $owner, name: $repo) {",
    "pullRequest(number: $number) { headRefOid }",
    "}",
    "}",
  ].join(" ");
  const response = runGhApiJson([
    "graphql",
    "-f",
    `query=${query}`,
    "-f",
    `owner=${owner}`,
    "-f",
    `repo=${repo}`,
    "-F",
    `number=${number}`,
  ]);
  const headSha = response?.data?.repository?.pullRequest?.headRefOid;

  if (!isFullSha(headSha)) {
    throw new Error("The authoritative pull-request metadata did not return a full head SHA.");
  }

  return headSha;
}

function commentsFromApi({ owner, repo, number }) {
  return flattenIssueCommentPages(
    runGhApiPaginated(`repos/${owner}/${repo}/issues/${number}/comments?per_page=100`),
  );
}

function checkRunsFromApi({ owner, repo, headSha }) {
  const checkName = encodeURIComponent(OWNER_APPROVAL_CHECK_NAME);

  return flattenCheckRunPages(
    runGhApiPaginated(
      `repos/${owner}/${repo}/commits/${headSha}/check-runs?check_name=${checkName}&per_page=100`,
    ),
  );
}

function updateCheckRun({ owner, repo, checkRunId, payload }) {
  const updatePayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "head_sha"),
  );

  runGhApi(
    ["--method", "PATCH", `repos/${owner}/${repo}/check-runs/${checkRunId}`, "--input", "-"],
    JSON.stringify(updatePayload),
  );
}

function createCheckRun({ owner, repo, payload }) {
  runGhApi(
    ["--method", "POST", `repos/${owner}/${repo}/check-runs`, "--input", "-"],
    JSON.stringify(payload),
  );
}

function upsertOwnerApprovalCheck({ owner, repo, existingCheckRuns, payload }) {
  const managedRuns = existingCheckRuns.filter((checkRun) =>
    isManagedOwnerApprovalCheckRun(checkRun, payload.head_sha),
  );

  if (managedRuns.length === 0) {
    createCheckRun({ owner, repo, payload });
    return;
  }

  for (const checkRun of managedRuns) {
    try {
      updateCheckRun({ owner, repo, checkRunId: checkRun.id, payload });
    } catch (error) {
      console.error(`Could not update check run ${checkRun.id}; creating a replacement.`);
      createCheckRun({ owner, repo, payload });
      console.error(error);
    }
  }
}

function failureDecision(headSha, reason, details = {}) {
  return { conclusion: "failure", headSha, reason, ...details };
}

function hasVerifiablePullRequestMetadata(pullRequest) {
  return (
    pullRequest !== null &&
    typeof pullRequest === "object" &&
    !Array.isArray(pullRequest) &&
    typeof pullRequest.state === "string" &&
    typeof pullRequest.base?.ref === "string" &&
    isFullSha(pullRequest.head?.sha)
  );
}

function publishDecision({ owner, repo, existingCheckRuns, decision }) {
  const payload = buildOwnerApprovalCheckPayload({ decision });

  upsertOwnerApprovalCheck({ owner, repo, existingCheckRuns, payload });
  console.log(
    `Owner approval ${payload.conclusion} for head ${payload.head_sha}: ${decision.reason}`,
  );
}

function publishMetadataFailure({ owner, repo, event, pullRequestNumber, reason, originalError }) {
  let fallbackHeadSha;

  try {
    const authoritativeHeadSha = isFullSha(getEventHeadSha(event))
      ? getEventHeadSha(event)
      : pullRequestHeadShaFromGraphql({ owner, repo, number: pullRequestNumber });

    fallbackHeadSha = getFallbackHeadSha(event, authoritativeHeadSha);
  } catch (fallbackError) {
    console.error("Could not resolve a fallback pull-request head SHA.");
    console.error(fallbackError);
  }

  if (!isFullSha(fallbackHeadSha)) {
    throw originalError;
  }

  let existingCheckRuns = [];

  try {
    existingCheckRuns = checkRunsFromApi({ owner, repo, headSha: fallbackHeadSha });
  } catch (checkRunsError) {
    console.error("Could not read existing Owner approval check runs while publishing failure.");
    console.error(checkRunsError);
  }

  const approvalCommentId = existingCheckRuns
    .map((checkRun) => getManagedApprovalBindingCommentId(checkRun, fallbackHeadSha))
    .find((commentId) => commentId !== undefined);

  publishDecision({
    existingCheckRuns,
    owner,
    repo,
    decision: failureDecision(fallbackHeadSha, reason, { approvalCommentId }),
  });
  throw originalError;
}

function runWorkflow() {
  const { owner, repo } = canonicalRepositoryParts();
  const eventName = process.env.GITHUB_EVENT_NAME;
  const event = readEventPayload();
  const pullRequestNumber = eventPullRequestNumber(eventName, event);

  if (!Number.isInteger(pullRequestNumber)) {
    throw new Error("The workflow event does not identify a pull request.");
  }

  let pullRequest;

  try {
    pullRequest = pullRequestFromApi({ owner, repo, number: pullRequestNumber });
  } catch (error) {
    publishMetadataFailure({
      owner,
      repo,
      event,
      pullRequestNumber,
      reason: "The current pull-request metadata could not be verified; retry is required.",
      originalError: error,
    });
  }

  if (!hasVerifiablePullRequestMetadata(pullRequest)) {
    const metadataError = new Error("The pull request metadata was malformed; retry is required.");

    publishMetadataFailure({
      owner,
      repo,
      event,
      pullRequestNumber,
      reason: "The current pull-request metadata was malformed; retry is required.",
      originalError: metadataError,
    });
  }

  const currentHeadSha = pullRequest.head.sha;

  if (!isOwnerApprovalTarget(pullRequest)) {
    console.log("Owner approval is not applicable to this closed or non-main pull request.");
    return;
  }

  if (!isFullSha(currentHeadSha)) {
    throw new Error("The pull request did not return a full head SHA.");
  }

  let comments;
  let commentsError;

  try {
    comments = commentsFromApi({ owner, repo, number: pullRequestNumber });
  } catch (error) {
    comments = [];
    commentsError = error;
  }

  let checkRuns;
  let checkRunsError;

  try {
    checkRuns = checkRunsFromApi({ owner, repo, headSha: currentHeadSha });
  } catch (error) {
    checkRuns = [];
    checkRunsError = error;
  }

  const decision =
    commentsError || checkRunsError
      ? failureDecision(
          currentHeadSha,
          "The current approval state could not be verified; retry is required.",
          {
            approvalCommentId: checkRuns
              .map((checkRun) => getManagedApprovalBindingCommentId(checkRun, currentHeadSha))
              .find((commentId) => commentId !== undefined),
          },
        )
      : evaluateOwnerApproval({
          checkRuns,
          comments,
          eventAction: event.action,
          eventComment: event.comment,
          eventIssueNumber: eventIssueNumber(eventName, event),
          pullRequest,
        });

  publishDecision({
    existingCheckRuns: checkRuns,
    owner,
    repo,
    decision,
  });

  if (commentsError || checkRunsError) {
    const verificationError = commentsError ?? checkRunsError;

    console.error(verificationError);
    throw verificationError;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runWorkflow();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
