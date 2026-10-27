"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml" };
  response.writeHead(200, { "Content-Type":(mime[path.extname(file)] || "application/octet-stream") + "; charset=utf-8" });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath:findBrowserExecutable(), headless:true });
  const context = await browser.newContext({ viewport:{ width:1680, height:1050 } });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:" + server.address().port + "/?testRoute=ticket-form#ticket-form", { waitUntil:"domcontentloaded" });
    await page.selectOption("#work-order-type", "投诉单");
    const customerType = page.locator('input[data-field-key="customer.1.客户类型"]');
    await customerType.locator("xpath=..").locator(".di-select-trigger").click();
    await customerType.locator("xpath=..").locator('[data-select-value="非自然人"]').click();
    await page.waitForTimeout(200);

    const expectations = [
      ["业务办理渠道", "Z-01"],
      ["业务类别", "Y-01"],
      ["投诉/信访原因", "X-01"]
    ];
    for (const [fieldName, prefix] of expectations) {
      const hidden = page.locator('input[data-field-key="' + fieldName + '"]');
      const field = hidden.locator("xpath=..");
      await field.locator(".di-cascader-trigger").click();
      const firstOption = field.locator('[data-cascade-level="0"]').first();
      await firstOption.waitFor();
      assert.match((await firstOption.textContent()).trim(), new RegExp("^" + prefix), fieldName + " 未切换为非自然人枚举");
      await field.locator(".di-cascader-trigger").click({ force:true });
    }

    await customerType.locator("xpath=..").locator(".di-select-trigger").click();
    await customerType.locator("xpath=..").locator('[data-select-value="自然人"]').click();
    await page.waitForTimeout(200);
    const channel = page.locator('input[data-field-key="业务办理渠道"]').locator("xpath=..");
    await channel.locator(".di-cascader-trigger").click();
    assert.match((await channel.locator('[data-cascade-level="0"]').first().textContent()).trim(), /^A-01/u, "切回自然人后未恢复 A 类枚举");
    console.log("客户类型切换人行标签页面交互检查通过");
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
