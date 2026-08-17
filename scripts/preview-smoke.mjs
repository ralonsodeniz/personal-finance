import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { createPreviewEnvironment } from "../packages/config-environment/index.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const webPort = Number(process.env.PREVIEW_WEB_PORT ?? "3200");
const docsPort = Number(process.env.PREVIEW_DOCS_PORT ?? "4200");
const webURL = `http://localhost:${webPort}`;
const docsURL = `http://localhost:${docsPort}`;
const previewEnvironment = {
  ...createPreviewEnvironment(process.env),
  PREVIEW_DOCS_URL: docsURL,
  PREVIEW_WEB_PORT: String(webPort),
};

function start(command, args) {
  const child = spawn(command, args, {
    cwd: rootDirectory,
    detached: process.platform !== "win32",
    env: previewEnvironment,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`Preview process failed to start: ${error.message}`);
  });

  return child;
}

function sendSignal(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    if (process.platform === "win32" || !child.pid) {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
}

function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolvePromise, reject) => {
    const finish = () => {
      clearTimeout(forceKillTimer);
      resolvePromise();
    };

    child.once("error", reject);
    child.once("exit", finish);
    sendSignal(child, "SIGTERM");

    const forceKillTimer = setTimeout(() => {
      try {
        sendSignal(child, "SIGKILL");
      } catch (error) {
        reject(error);
      }
    }, 5_000);
    forceKillTimer.unref();
  });
}

async function waitForURL(url, child) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview process exited with code ${child.exitCode} before ${url} was ready`);
    }

    try {
      const response = await globalThis.fetch(url);

      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // The server is still starting.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

const web = start("pnpm", [
  "--filter",
  "@personal-finance/web",
  "start",
  "--hostname",
  "127.0.0.1",
  "--port",
  String(webPort),
]);
const docs = start("pnpm", [
  "--filter",
  "@personal-finance/docs",
  "exec",
  "docusaurus",
  "serve",
  "--no-open",
  "--host",
  "127.0.0.1",
  "--port",
  String(docsPort),
]);

try {
  await Promise.all([
    waitForURL(`${webURL}/api/v1/system/health?scope=system`, web),
    waitForURL(`${docsURL}/developers/intro`, docs),
  ]);

  const result = spawn("pnpm", ["--filter", "@personal-finance/web", "run", "test:e2e:preview"], {
    cwd: rootDirectory,
    env: previewEnvironment,
    stdio: "inherit",
  });

  const exitCode = await new Promise((resolvePromise, reject) => {
    result.on("error", reject);
    result.on("exit", (code, signal) => resolvePromise(code ?? (signal ? 1 : 0)));
  });

  process.exitCode = exitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await Promise.all([stop(web), stop(docs)]);
}
