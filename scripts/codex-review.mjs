import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CODEX_REVIEW_CHECK_NAME = "Codex review";
export const CODEX_REVIEW_GATE_MARKER = "codex-review-gate-v1";
export const NATIVE_CODEX_NO_MAJOR_PREFIX = "Codex Review: Didn't find any major issues.";
export const CODEX_USER_ID = 199175422;
export const CODEX_LOGIN = "chatgpt-codex-connector[bot]";
export const CODEX_USER_TYPE = "Bot";
export const TARGET_BRANCH = "main";
export const TRUSTED_GITHUB_ACTIONS_APP_ID = 15368;
export const TRUSTED_GITHUB_ACTIONS_APP_NAME = "GitHub Actions";
export const TRUSTED_GITHUB_ACTIONS_APP_SLUG = "github-actions";
export const GH_API_TIMEOUT_MS = 30_000;
export const GH_API_MAX_BUFFER = 8 * 1024 * 1024;

const CANONICAL_REPOSITORY = "ralonsodeniz/personal-finance";

function isFullSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function isPositiveInteger(value) {
  return /^[1-9][0-9]*$/.test(String(value ?? ""));
}

function nativeReviewedCommitMatches(body) {
  if (typeof body !== "string") {
    return [];
  }

  const reviewedCommitPattern =
    /^[ \t]*\*{0,2}Reviewed commit:\*{0,2}[ \t]*`([0-9a-f]{7,40})`[ \t]*$/gm;

  return [...body.replace(/\r\n/g, "\n").matchAll(reviewedCommitPattern)].map((match) => match[1]);
}

function nativeReviewedCommitLineCount(body) {
  if (typeof body !== "string") {
    return 0;
  }

  const reviewedCommitLinePattern = /^[ \t]*\*{0,2}Reviewed commit(?:\*{0,2})?[ \t]*:/gm;

  return [...body.replace(/\r\n/g, "\n").matchAll(reviewedCommitLinePattern)].length;
}

function hasNativeNoMajorResult(body) {
  return typeof body === "string" && body.trimStart().startsWith(NATIVE_CODEX_NO_MAJOR_PREFIX);
}

function hasNativeCodexSummary(body) {
  return typeof body === "string" && body.trimStart().startsWith("Codex Review:");
}

function isNativePullRequestReviewContainer(body) {
  if (typeof body !== "string") {
    return false;
  }

  const normalizedBody = body.trimStart();

  return normalizedBody === "" || normalizedBody.startsWith("### 💡 Codex Review");
}

export function isTrustedCodexReviewComment(comment) {
  return (
    comment?.user?.id === CODEX_USER_ID &&
    comment.user?.login === CODEX_LOGIN &&
    comment.user?.type === CODEX_USER_TYPE
  );
}

export function parseCodexReviewResult(body, authoritativeHeadSha) {
  if (!hasNativeNoMajorResult(body)) {
    return undefined;
  }

  const reviewedCommits = nativeReviewedCommitMatches(body);
  const reviewedCommitLineCount = nativeReviewedCommitLineCount(body);

  if (reviewedCommitLineCount !== reviewedCommits.length || reviewedCommits.length > 1) {
    return undefined;
  }

  if (authoritativeHeadSha !== undefined) {
    if (!isFullSha(authoritativeHeadSha)) {
      return undefined;
    }

    if (reviewedCommits.length === 1 && !authoritativeHeadSha.startsWith(reviewedCommits[0])) {
      return undefined;
    }

    return { headSha: authoritativeHeadSha, result: "PASS" };
  }

  return reviewedCommits.length === 1 ? { headSha: reviewedCommits[0], result: "PASS" } : undefined;
}

export function isCodexReviewTarget(pullRequest) {
  return pullRequest?.state === "open" && pullRequest?.base?.ref === TARGET_BRANCH;
}

export function getEventPullRequestNumber(eventName, event) {
  if (
    eventName === "pull_request_target" ||
    eventName === "pull_request_review" ||
    eventName === "pull_request_review_comment"
  ) {
    return event.pull_request?.number;
  }

  if (eventName === "issue_comment" && event.issue?.pull_request) {
    return event.issue.number;
  }

  return undefined;
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

function isEligiblePullRequest(pullRequest) {
  return (
    isCodexReviewTarget(pullRequest) &&
    Number.isInteger(pullRequest?.number) &&
    pullRequest.number > 0 &&
    isFullSha(pullRequest?.head?.sha)
  );
}

function failureDecision(headSha, reason, details = {}) {
  return {
    conclusion: "failure",
    headSha,
    reason,
    ...details,
  };
}

function isDismissedPullRequestReview(review) {
  return typeof review?.state === "string" && review.state.toLowerCase() === "dismissed";
}

function isChangesRequestedPullRequestReview(review) {
  return typeof review?.state === "string" && review.state.toLowerCase() === "changes_requested";
}

function nativeArtifactBinding(artifact, source, parentReview) {
  const reviewedCommits = nativeReviewedCommitMatches(artifact.body);

  if (source === "issue") {
    return nativeReviewedCommitLineCount(artifact.body) === reviewedCommits.length &&
      reviewedCommits.length === 1
      ? { abbreviatedHeadSha: reviewedCommits[0] }
      : undefined;
  }

  const associatedCommitSha = artifact.commit_id ?? parentReview?.commit_id;

  if (!isFullSha(associatedCommitSha)) {
    return undefined;
  }

  return { fullHeadSha: associatedCommitSha };
}

function nativeArtifactMatchesCurrentHead(binding, source, currentHeadSha) {
  return source === "issue"
    ? currentHeadSha.startsWith(binding.abbreviatedHeadSha)
    : binding.fullHeadSha === currentHeadSha;
}

export function evaluateCodexReview({
  comments = [],
  pullRequestReviews = [],
  pullRequestReviewComments = [],
  pullRequest,
  unavailable = false,
}) {
  const currentHeadSha = pullRequest?.head?.sha;

  if (!isEligiblePullRequest(pullRequest)) {
    return failureDecision(currentHeadSha, "The pull request must be open and target main.");
  }

  if (unavailable) {
    return failureDecision(
      currentHeadSha,
      "The native Codex review state could not be verified; retry is required.",
    );
  }

  if (!Array.isArray(comments)) {
    return failureDecision(
      currentHeadSha,
      "The native Codex review comments response was malformed; retry is required.",
    );
  }

  if (!Array.isArray(pullRequestReviews) || !Array.isArray(pullRequestReviewComments)) {
    return failureDecision(
      currentHeadSha,
      "The native Codex review response was malformed; retry is required.",
    );
  }

  const activePullRequestReviews = pullRequestReviews.filter(
    (review) => !isDismissedPullRequestReview(review),
  );
  const dismissedPullRequestReviewIds = new Set(
    pullRequestReviews
      .filter((review) => isDismissedPullRequestReview(review))
      .map((review) => review.id)
      .filter(isPositiveInteger)
      .map(String),
  );
  const activePullRequestReviewComments = pullRequestReviewComments.filter(
    (comment) => !dismissedPullRequestReviewIds.has(String(comment?.pull_request_review_id ?? "")),
  );

  const reviewsById = new Map(
    pullRequestReviews
      .filter((review) => isPositiveInteger(review?.id))
      .map((review) => [String(review.id), review]),
  );
  const nativeReviewCommentParentIds = new Set(
    activePullRequestReviewComments
      .filter((comment) => isTrustedCodexReviewComment(comment))
      .map((comment) => comment.pull_request_review_id)
      .filter(isPositiveInteger)
      .map(String),
  );
  const nativeIssueComments = comments.filter(
    (comment) =>
      isTrustedCodexReviewComment(comment) &&
      (hasNativeCodexSummary(comment.body) || hasNativeNoMajorResult(comment.body)),
  );
  const nativeReviews = activePullRequestReviews
    .filter((review) => isTrustedCodexReviewComment(review))
    .filter(
      (review) =>
        !(
          isNativePullRequestReviewContainer(review.body) &&
          !isChangesRequestedPullRequestReview(review) &&
          nativeReviewCommentParentIds.has(String(review.id))
        ),
    );
  const nativeReviewComments = activePullRequestReviewComments
    .filter((comment) => isTrustedCodexReviewComment(comment))
    .map((comment) => ({
      artifact: comment,
      parentReview: reviewsById.get(String(comment.pull_request_review_id)),
      source: "review-comment",
      kind: hasNativeNoMajorResult(comment.body) ? "result" : "finding",
    }));
  const nativeArtifacts = [
    ...nativeIssueComments.map((comment) => ({
      artifact: comment,
      source: "issue",
      kind: "result",
    })),
    ...nativeReviews.map((review) => ({
      artifact: review,
      source: "review",
      kind:
        isChangesRequestedPullRequestReview(review) || !hasNativeNoMajorResult(review.body)
          ? "finding"
          : "result",
    })),
    ...nativeReviewComments,
  ];

  if (nativeArtifacts.length === 0) {
    return failureDecision(
      currentHeadSha,
      "A trusted native Codex final result for this current head is required.",
    );
  }

  const currentResults = [];
  let hasStaleArtifact = false;

  for (const { artifact, source, kind, parentReview } of nativeArtifacts) {
    const binding = nativeArtifactBinding(artifact, source, parentReview);

    if (!binding || !isPositiveInteger(artifact.id)) {
      return failureDecision(
        currentHeadSha,
        "A trusted native Codex artifact was malformed or unbound; retry is required.",
      );
    }

    if (!nativeArtifactMatchesCurrentHead(binding, source, currentHeadSha)) {
      hasStaleArtifact = true;
      continue;
    }

    if (kind === "finding") {
      return failureDecision(
        currentHeadSha,
        "Active native Codex findings or changes requested exist for this current head.",
        { result: "CHANGES_REQUESTED", resultCommentId: String(artifact.id) },
      );
    }

    const parsedResult = parseCodexReviewResult(
      artifact.body,
      source === "issue" ? undefined : binding.fullHeadSha,
    );

    if (!parsedResult) {
      return failureDecision(
        currentHeadSha,
        "A trusted native Codex result was malformed or unresolved; retry is required.",
      );
    }

    currentResults.push({
      ...parsedResult,
      commentId: String(artifact.id),
    });
  }

  if (currentResults.length === 0) {
    return failureDecision(
      currentHeadSha,
      hasStaleArtifact
        ? "The available native Codex result is stale for this current head."
        : "A trusted native Codex result for this current head is required.",
    );
  }

  if (currentResults.length > 1) {
    return failureDecision(
      currentHeadSha,
      "Duplicate or conflicting native Codex results exist for this current head.",
    );
  }

  const [currentResult] = currentResults;

  if (currentResult.result !== "PASS") {
    return failureDecision(
      currentHeadSha,
      "Native Codex requested changes for this current head.",
      { result: currentResult.result, resultCommentId: currentResult.commentId },
    );
  }

  return {
    conclusion: "success",
    headSha: currentHeadSha,
    reason: "The trusted native Codex review passed for this exact current head.",
    result: currentResult.result,
    resultCommentId: currentResult.commentId,
  };
}

function isTrustedGitHubActionsPublisher(checkRun) {
  const app = checkRun?.app;

  return (
    app?.id === TRUSTED_GITHUB_ACTIONS_APP_ID &&
    app?.name === TRUSTED_GITHUB_ACTIONS_APP_NAME &&
    app?.slug === TRUSTED_GITHUB_ACTIONS_APP_SLUG
  );
}

function resultCommentIdFromManagedOutput(outputText) {
  if (typeof outputText !== "string") {
    return undefined;
  }

  const match =
    /^codex-review-gate-v1\nCurrent head SHA: [0-9a-f]{40}\nDecision: success\nCodex result: PASS\nResult comment ID: ([1-9][0-9]*)\n\n/.exec(
      outputText,
    );

  return match?.[1];
}

function hasValidManagedOutput(checkRun, currentHeadSha) {
  const outputText = checkRun?.output?.text;
  const expectedPrefix = `${CODEX_REVIEW_GATE_MARKER}\nCurrent head SHA: ${currentHeadSha}\nDecision: ${checkRun?.conclusion}\n`;

  if (typeof outputText !== "string" || !outputText.startsWith(expectedPrefix)) {
    return false;
  }

  if (checkRun.conclusion === "success") {
    return resultCommentIdFromManagedOutput(outputText) !== undefined;
  }

  const failureOutput = outputText.slice(expectedPrefix.length);

  return /^(?:\n|Codex result: CHANGES_REQUESTED\nResult comment ID: [1-9][0-9]*\n\n)/.test(
    failureOutput,
  );
}

export function isManagedCodexReviewCheckRun(checkRun, currentHeadSha) {
  return (
    checkRun?.name === CODEX_REVIEW_CHECK_NAME &&
    isFullSha(currentHeadSha) &&
    checkRun?.head_sha === currentHeadSha &&
    checkRun?.status === "completed" &&
    (checkRun?.conclusion === "success" || checkRun?.conclusion === "failure") &&
    hasValidManagedOutput(checkRun, currentHeadSha) &&
    isTrustedGitHubActionsPublisher(checkRun)
  );
}

export function getManagedCodexReviewResultCommentId(checkRun, currentHeadSha) {
  if (
    !isManagedCodexReviewCheckRun(checkRun, currentHeadSha) ||
    checkRun.conclusion !== "success"
  ) {
    return undefined;
  }

  return resultCommentIdFromManagedOutput(checkRun.output.text);
}

export function buildCodexReviewCheckPayload({ decision }) {
  if (!isFullSha(decision?.headSha)) {
    throw new Error("Codex review checks require a full current head SHA.");
  }

  if (decision.conclusion !== "success" && decision.conclusion !== "failure") {
    throw new Error("Codex review checks require a success or failure conclusion.");
  }

  if (decision.conclusion === "success") {
    if (decision.result !== "PASS" || !isPositiveInteger(decision.resultCommentId)) {
      throw new Error("Successful Codex review checks require a PASS result comment ID.");
    }
  } else if (
    decision.result !== undefined &&
    decision.result !== "PASS" &&
    decision.result !== "CHANGES_REQUESTED"
  ) {
    throw new Error("Codex review checks have an unsupported result marker.");
  }

  const resultLines =
    decision.result === undefined
      ? []
      : [
          `Codex result: ${decision.result}`,
          ...(isPositiveInteger(decision.resultCommentId)
            ? [`Result comment ID: ${decision.resultCommentId}`]
            : []),
        ];
  const reason = String(decision.reason ?? "Codex review is required.").replace(/\r?\n/g, " ");

  return {
    conclusion: decision.conclusion,
    head_sha: decision.headSha,
    name: CODEX_REVIEW_CHECK_NAME,
    output: {
      text: [
        CODEX_REVIEW_GATE_MARKER,
        `Current head SHA: ${decision.headSha}`,
        `Decision: ${decision.conclusion}`,
        ...resultLines,
        "",
        reason,
      ].join("\n"),
      title: decision.conclusion === "success" ? "Codex review passed" : "Codex review required",
      summary:
        decision.conclusion === "success"
          ? "A trusted native Codex PASS result is bound to the current pull-request head."
          : "A trusted native Codex PASS result is required for the current pull-request head.",
    },
    status: "completed",
  };
}

function runGhApi(args, input) {
  const result = spawnSync("gh", ["api", ...args], {
    encoding: "utf8",
    env: process.env,
    input,
    killSignal: "SIGTERM",
    timeout: GH_API_TIMEOUT_MS,
    maxBuffer: GH_API_MAX_BUFFER,
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

export function flattenIssueCommentPages(pages) {
  return flattenArrayPages(pages, "gh api returned malformed issue-comment pages.");
}

export function flattenCheckRunPages(pages) {
  if (!Array.isArray(pages) || pages.some((page) => !page || !Array.isArray(page.check_runs))) {
    throw new Error("gh api returned malformed check-run pages.");
  }

  return pages.flatMap((page) => page.check_runs);
}

function flattenArrayPages(pages, errorMessage) {
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page))) {
    throw new Error(errorMessage);
  }

  return pages.flat();
}

export function flattenPullRequestReviewPages(pages) {
  return flattenArrayPages(pages, "gh api returned malformed pull-request review pages.");
}

export function flattenPullRequestReviewCommentPages(pages) {
  return flattenArrayPages(pages, "gh api returned malformed pull-request review-comment pages.");
}

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is required.");
  }

  return JSON.parse(readFileSync(eventPath, "utf8"));
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

function pullRequestReviewsFromApi({ owner, repo, number }) {
  return flattenPullRequestReviewPages(
    runGhApiPaginated(`repos/${owner}/${repo}/pulls/${number}/reviews?per_page=100`),
  );
}

function pullRequestReviewCommentsFromApi({ owner, repo, number }) {
  return flattenPullRequestReviewCommentPages(
    runGhApiPaginated(`repos/${owner}/${repo}/pulls/${number}/comments?per_page=100`),
  );
}

function checkRunsFromApi({ owner, repo, headSha }) {
  const checkName = encodeURIComponent(CODEX_REVIEW_CHECK_NAME);

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

function upsertCodexReviewCheck({ owner, repo, existingCheckRuns, payload }) {
  const managedRuns = existingCheckRuns.filter((checkRun) =>
    isManagedCodexReviewCheckRun(checkRun, payload.head_sha),
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

function publishDecision({ owner, repo, existingCheckRuns, decision }) {
  const payload = buildCodexReviewCheckPayload({ decision });

  upsertCodexReviewCheck({ owner, repo, existingCheckRuns, payload });
  console.log(
    `Codex review ${payload.conclusion} for head ${payload.head_sha}: ${decision.reason}`,
  );
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

function publishMetadataFailure({ owner, repo, event, pullRequestNumber, reason, originalError }) {
  let fallbackHeadSha;

  try {
    const eventHeadSha = getEventHeadSha(event);

    fallbackHeadSha = getFallbackHeadSha(
      event,
      isFullSha(eventHeadSha)
        ? eventHeadSha
        : pullRequestHeadShaFromGraphql({ owner, repo, number: pullRequestNumber }),
    );
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
    console.error("Could not read existing Codex check runs while publishing failure.");
    console.error(checkRunsError);
  }

  publishDecision({
    existingCheckRuns,
    owner,
    repo,
    decision: failureDecision(fallbackHeadSha, reason),
  });
  throw originalError;
}

function runWorkflow() {
  const { owner, repo } = canonicalRepositoryParts();
  const eventName = process.env.GITHUB_EVENT_NAME;
  const event = readEventPayload();
  const pullRequestNumber = getEventPullRequestNumber(eventName, event);

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

  if (!isCodexReviewTarget(pullRequest)) {
    console.log("Codex review is not applicable to this closed or non-main pull request.");
    return;
  }

  const currentHeadSha = pullRequest?.head?.sha;

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

  let pullRequestReviews;
  let pullRequestReviewsError;

  try {
    pullRequestReviews = pullRequestReviewsFromApi({ owner, repo, number: pullRequestNumber });
  } catch (error) {
    pullRequestReviews = [];
    pullRequestReviewsError = error;
  }

  let pullRequestReviewComments;
  let pullRequestReviewCommentsError;

  try {
    pullRequestReviewComments = pullRequestReviewCommentsFromApi({
      owner,
      repo,
      number: pullRequestNumber,
    });
  } catch (error) {
    pullRequestReviewComments = [];
    pullRequestReviewCommentsError = error;
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
    commentsError || pullRequestReviewsError || pullRequestReviewCommentsError || checkRunsError
      ? failureDecision(
          currentHeadSha,
          "The current native Codex review state could not be verified; retry is required.",
        )
      : evaluateCodexReview({
          comments,
          pullRequestReviews,
          pullRequestReviewComments,
          pullRequest,
        });

  publishDecision({
    existingCheckRuns: checkRuns,
    owner,
    repo,
    decision,
  });

  if (
    commentsError ||
    pullRequestReviewsError ||
    pullRequestReviewCommentsError ||
    checkRunsError
  ) {
    const verificationError =
      commentsError ?? pullRequestReviewsError ?? pullRequestReviewCommentsError ?? checkRunsError;

    console.error(verificationError);
    throw verificationError;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    runWorkflow();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
