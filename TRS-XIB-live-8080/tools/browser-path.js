"use strict";

const fs = require("fs");

function playwrightChromiumPath() {
  try {
    const { chromium } = require("playwright");
    const executable = chromium.executablePath();
    return executable && fs.existsSync(executable) ? executable : "";
  } catch (error) {
    return "";
  }
}

function browserCandidates(preferred = "") {
  return [
    preferred,
    process.env.XIB_TEST_BROWSER,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    playwrightChromiumPath(),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
}

function findBrowserExecutable(preferred = "") {
  return browserCandidates(preferred).find(candidate => fs.existsSync(candidate)) || "";
}

module.exports = { browserCandidates, findBrowserExecutable };
