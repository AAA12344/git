"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "data", "forms");
const outputFile = path.join(root, "data", "form-schema.json");
const sourceFiles = {
  shared: path.join(sourceDir, "shared.json"),
  workOrders: path.join(sourceDir, "main-work-orders.json"),
  subprocesses: path.join(sourceDir, "subprocesses.json")
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireKeys(value, keys, label) {
  const actual = Object.keys(value);
  const missing = keys.filter(key => !actual.includes(key));
  const unexpected = actual.filter(key => !keys.includes(key));
  if (missing.length || unexpected.length) {
    throw new Error(`${label} keys invalid; missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}`);
  }
}

function composeFormSchema() {
  const shared = readJson(sourceFiles.shared);
  const workOrders = readJson(sourceFiles.workOrders);
  const subprocesses = readJson(sourceFiles.subprocesses);
  requireKeys(shared, ["meta", "runtime_storage", "control_labels", "control_type_labels"], "data/forms/shared.json");
  requireKeys(workOrders, ["work_orders"], "data/forms/main-work-orders.json");
  requireKeys(subprocesses, ["subprocesses"], "data/forms/subprocesses.json");
  return {
    meta: shared.meta,
    runtime_storage: shared.runtime_storage,
    work_orders: workOrders.work_orders,
    subprocesses: subprocesses.subprocesses,
    control_labels: shared.control_labels,
    control_type_labels: shared.control_type_labels
  };
}

function serializeFormSchema() {
  return JSON.stringify(composeFormSchema(), null, 2) + "\n";
}

function writeFormSchema({ silent = false } = {}) {
  fs.writeFileSync(outputFile, serializeFormSchema(), "utf8");
  if (!silent) console.log("Generated data/form-schema.json from data/forms/*.json");
}

function checkFormSchema() {
  const expected = serializeFormSchema();
  const actual = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8") : "";
  if (actual !== expected) {
    console.error("data/form-schema.json is stale. Run npm run build:data and commit the generated file.");
    process.exitCode = 1;
    return;
  }
  console.log("Form schema sources and generated aggregate are in sync.");
}

if (require.main === module) {
  if (process.argv.includes("--check")) checkFormSchema();
  else writeFormSchema();
}

module.exports = { composeFormSchema, serializeFormSchema, writeFormSchema, sourceFiles, outputFile };
