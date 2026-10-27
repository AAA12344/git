"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const codeownersPath = path.join(root, ".github", "CODEOWNERS");
const lines = fs.readFileSync(codeownersPath, "utf8").split(/\r?\n/);
const entries = [];

for (const [index, rawLine] of lines.entries()) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const parts = line.split(/\s+/);
  assert(parts.length >= 2, `.github/CODEOWNERS:${index + 1} needs a path and at least one owner`);
  const [pattern, ...owners] = parts;
  owners.forEach(owner => assert(owner.startsWith("@"), `.github/CODEOWNERS:${index + 1} has an invalid owner: ${owner}`));
  entries.push({ pattern, owners });
}

const requiredPatterns = [
  "*", "/data/", "/data/forms/main-work-orders.json", "/data/forms/subprocesses.json",
  "/data/forms/shared.json", "/tools/", "/.github/", "/src/modules/home/", "/src/modules/complaints/",
  "/src/modules/consumer-review/", "/src/modules/statistics/", "/src/modules/report-center/",
  "/src/modules/education/", "/src/modules/notifications/", "/src/modules/admin/"
];
requiredPatterns.forEach(pattern => assert(entries.some(entry => entry.pattern === pattern), `CODEOWNERS is missing required pattern: ${pattern}`));

console.log(`CODEOWNERS checked: ${entries.length} active rules.`);
