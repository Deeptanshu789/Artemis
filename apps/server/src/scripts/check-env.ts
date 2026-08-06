#!/usr/bin/env npx tsx
/**
 * Print env readiness without starting the HTTP server.
 */
import { validateEnv } from "../services/envCheck.js";
import { env } from "../config.js";

const report = validateEnv();
console.log(
  JSON.stringify(
    {
      port: env.port,
      geminiModel: env.geminiModel,
      ...report,
      hint: report.missingForLive.length
        ? "Fill missing keys in .env or keep DEMO_MODE=true"
        : "Live keys look present (or DEMO_MODE)",
    },
    null,
    2,
  ),
);
process.exit(report.ok || report.demoMode ? 0 : 1);
