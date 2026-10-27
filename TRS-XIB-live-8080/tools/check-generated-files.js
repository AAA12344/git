"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const generatedFiles = [
  "data/form-schema.json",
  "data/prototype-data.runtime.js",
  "data/china-geojson.runtime.js",
  "statistics-module.js",
  "statistics-module.css",
  "ui/vendor/react.production.min.js",
  "ui/vendor/react-dom.production.min.js"
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function fileHash(relativePath) {
  const filename = path.join(root, relativePath);
  if (!fs.existsSync(filename)) return "missing";
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

const before = new Map(generatedFiles.map(file => [file, fileHash(file)]));

run(process.execPath, [path.join("tools", "sync-prototype-data.js")]);
run(process.execPath, [path.join("tools", "build-statistics-module.js")]);

const changed = generatedFiles.filter(file => before.get(file) !== fileHash(file));

if (changed.length) {
  console.error("Generated files were stale and have been refreshed:");
  changed.forEach(file => console.error("- " + file));
  console.error("Review and commit the refreshed files, then run this check again.");
  process.exit(1);
}

console.log("Generated files are up to date.");
