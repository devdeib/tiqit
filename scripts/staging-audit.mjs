#!/usr/bin/env node
/**
 * Staging deployment smoke audit.
 * Usage: APP_URL=https://staging.example.com npm run staging:audit
 */

const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
if (!baseUrl) {
  console.error("Set APP_URL to your staging deployment origin.");
  process.exit(1);
}

const results = [];

async function check(name, path, expectStatus = 200) {
  const url = `${baseUrl}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    const ok = res.status === expectStatus;
    results.push({
      name,
      ok,
      status: res.status,
      ms: Date.now() - started,
      ...(ok ? {} : { body }),
    });
    return { ok, body, status: res.status };
  } catch (err) {
    results.push({
      name,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    });
    return { ok: false };
  }
}

console.log(`Staging audit: ${baseUrl}\n`);

const health = await check("GET /api/health", "/api/health");
const ready = await check("GET /api/ready", "/api/ready", 200);

if (ready.body?.deployment) {
  const d = ready.body.deployment;
  console.log("Deployment:");
  console.log(`  appEnv: ${d.appEnv}`);
  console.log(`  paymentProvider: ${d.paymentProvider}`);
  console.log(`  appUrl: ${d.appUrl ?? "(unset)"}`);
  if (d.errors?.length) console.log(`  errors: ${d.errors.join("; ")}`);
  if (d.warnings?.length) console.log(`  warnings: ${d.warnings.join("; ")}`);
  console.log();
}

await check("GET /api/events", "/api/events");
await check("GET /api/webhooks/sham-cash (probe)", "/api/webhooks/sham-cash", 405);

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  const mark = r.ok ? "OK" : "FAIL";
  console.log(`${mark}  ${r.name}  ${r.status ?? "-"}  ${r.ms ?? 0}ms`);
  if (r.error) console.log(`      ${r.error}`);
}

console.log();
if (failed.length) {
  console.error(`${failed.length} check(s) failed.`);
  process.exit(1);
}

if (ready.body?.status !== "ok") {
  console.warn("Ready status is not ok — review deployment.errors before staging tests.");
  process.exit(2);
}

console.log("All smoke checks passed. Run docs/STAGING-TESTS.md for manual flows.");
