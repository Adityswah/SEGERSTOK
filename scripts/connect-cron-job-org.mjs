import fs from "node:fs";
import { config, parse } from "dotenv";

config({ path: ".env.local" });

const PRODUCTION_ENV_PATH = ".env.vercel.production.local";
const CRON_JOB_API_URL = "https://api.cron-job.org";
const JOB_TITLE = "SotoStock AI Refresh (Production)";

function readProductionEnv() {
  if (!fs.existsSync(PRODUCTION_ENV_PATH)) return {};
  return parse(fs.readFileSync(PRODUCTION_ENV_PATH));
}

function pickArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function pickIntervalMinutes() {
  const raw = pickArg("--interval") ?? process.env.CRON_JOB_ORG_INTERVAL_MINUTES ?? "60";
  const value = Number(raw);
  if (![30, 60].includes(value)) {
    throw new Error("Interval harus 30 atau 60 menit. Contoh: --interval 60");
  }
  return value;
}

function scheduleForInterval(intervalMinutes) {
  return {
    timezone: "Asia/Jakarta",
    expiresAt: 0,
    hours: [-1],
    mdays: [-1],
    minutes: intervalMinutes === 30 ? [0, 30] : [0],
    months: [-1],
    wdays: [-1],
  };
}

async function cronJobRequest(path, init = {}) {
  const response = await fetch(`${CRON_JOB_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronJobOrgApiKey}`,
      ...init.headers,
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`cron-job.org ${response.status}: ${text}`);
  }
  return payload;
}

const productionEnv = readProductionEnv();
const cronJobOrgApiKey = process.env.CRON_JOB_ORG_API_KEY ?? pickArg("--api-key");
const cronSecret = process.env.CRON_SECRET ?? productionEnv.CRON_SECRET ?? pickArg("--cron-secret");
const intervalMinutes = pickIntervalMinutes();
const productionBaseUrl =
  process.env.BETTER_AUTH_URL ??
  productionEnv.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
  productionEnv.NEXT_PUBLIC_BETTER_AUTH_URL ??
  "https://stokara.vercel.app";
const defaultTargetUrl = `${productionBaseUrl.replace(/\/$/, "")}/api/ai/refresh`;
const targetUrl = process.env.CRON_JOB_ORG_TARGET_URL ?? pickArg("--url") ?? defaultTargetUrl;

if (!cronJobOrgApiKey) {
  throw new Error("CRON_JOB_ORG_API_KEY belum tersedia. Ambil dari cron-job.org Console > Settings > API keys.");
}

if (!cronSecret) {
  throw new Error("CRON_SECRET belum tersedia. Pastikan .env.vercel.production.local berisi CRON_SECRET atau kirim --cron-secret.");
}

const jobPayload = {
  job: {
    enabled: true,
    title: JOB_TITLE,
    url: targetUrl,
    saveResponses: true,
    requestMethod: 0,
    requestTimeout: 300,
    redirectSuccess: false,
    schedule: scheduleForInterval(intervalMinutes),
    extendedData: {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      body: "",
    },
  },
};

const existingJobs = await cronJobRequest("/jobs");
const existingJob = existingJobs.jobs?.find((job) => job.title === JOB_TITLE || job.url === targetUrl);

if (existingJob?.jobId) {
  await cronJobRequest(`/jobs/${existingJob.jobId}`, {
    method: "PATCH",
    body: JSON.stringify(jobPayload),
  });
  console.log(`cron-job.org updated: jobId=${existingJob.jobId}, interval=${intervalMinutes}m, url=${targetUrl}`);
} else {
  const created = await cronJobRequest("/jobs", {
    method: "PUT",
    body: JSON.stringify(jobPayload),
  });
  console.log(`cron-job.org created: jobId=${created.jobId}, interval=${intervalMinutes}m, url=${targetUrl}`);
}
