"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const requiredAssets = [
  "data/prototype-data.runtime.js",
  "data/china-geojson.runtime.js",
  "src/modules/complaints/work-pool.js",
  "statistics-module.js",
  "statistics-module.css",
  "ui/vendor/react.production.min.js",
  "ui/vendor/react-dom.production.min.js"
];

const missing = requiredAssets.filter(relativePath => {
  const absolutePath = path.join(root, relativePath);
  return !fs.existsSync(absolutePath) || fs.statSync(absolutePath).size === 0;
});

if (missing.length) {
  console.error("Deployment assets are missing or empty:");
  missing.forEach(relativePath => console.error(`- ${relativePath}`));
  console.error("Run npm run build locally, commit the generated files, and push again.");
  process.exit(1);
}

console.log(`Deployment assets are ready (${requiredAssets.length} files).`);
