"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const scanRoots = [
  "README.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "docs",
  path.join("src", "modules")
];

function markdownFiles(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return absolutePath.endsWith(".md") ? [absolutePath] : [];
  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relativePath, entry.name);
    return entry.isDirectory() ? markdownFiles(child) : entry.name.endsWith(".md") ? [path.join(root, child)] : [];
  });
}

const errors = [];
const files = scanRoots.flatMap(markdownFiles);
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

for (const filename of files) {
  const content = fs.readFileSync(filename, "utf8");
  for (const match of content.matchAll(linkPattern)) {
    let target = match[1].trim().replace(/^<|>$/g, "").split(/\s+['"]/)[0];
    if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue;
    target = target.split("#", 1)[0];
    try {
      target = decodeURIComponent(target);
    } catch {
      errors.push(`${path.relative(root, filename)}: invalid encoded link ${match[1]}`);
      continue;
    }
    const resolved = path.resolve(path.dirname(filename), target);
    if (!fs.existsSync(resolved)) {
      errors.push(`${path.relative(root, filename)}: missing ${target}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Documentation links checked: ${files.length} Markdown files.`);
