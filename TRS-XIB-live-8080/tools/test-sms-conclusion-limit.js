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
  await context.addInitScript(() => {
    localStorage.setItem("xib-role", "handler");
    localStorage.setItem("xib-org", "development");
    localStorage.setItem("xib-role-profile", "development-handler");
  });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:" + server.address().port + "/?testRoute=ticket-process#ticket-process", { waitUntil:"domcontentloaded" });
    await page.waitForSelector(".ticket-list-table");
    await page.locator('.ticket-list-table [data-action="process"]:not([disabled])').first().click();
    await page.waitForSelector(".ticket-detail-page");
    await page.locator('[data-detail-tab="处理信息"]').click();
    await page.locator('[data-action="send-sms"]').click();
    await page.waitForSelector(".contact-sms-layout");
    const input = page.locator("#sms-conclusion");
    const count = page.locator("#sms-conclusion-count");
    assert.equal(await input.getAttribute("maxlength"), "300", "简要概括处理结论未限制为300字");
    assert(!(await page.locator(".is-editable-variable").innerText()).includes("最多300字"), "仍显示最多300字提示");
    assert(await count.locator("xpath=parent::*").evaluate(node => node.classList.contains("sms-textarea-with-count")), "模板短信计数器未放入文本框容器");
    assert.equal(await count.locator("xpath=parent::*").evaluate(node => node.tagName), "DIV", "模板短信计数容器仍会触发额外必填星号");
    assert.match(await count.innerText(), /^\d+\/300$/, "字数统计格式不是 当前字数/300");
    await input.fill("处".repeat(305));
    assert.equal((await input.inputValue()).length, 300, "超出300字后未截断");
    assert.equal(await count.innerText(), "300/300", "截断后字数统计未更新为300/300");
    await page.locator("#sms-content-mode").selectOption("manual");
    assert(await page.locator("#sms-template-content").isHidden(), "选择手工录入短信后模板内容仍显示");
    assert(await page.locator("#sms-manual-content").isVisible(), "选择手工录入短信后未显示正常录入页面");
    assert(await page.locator("#sms-manual-text").evaluate(node => document.activeElement === node), "切换手工录入短信后输入框未获得焦点");
    const manualCount = page.locator("#sms-manual-count");
    assert(await manualCount.locator("xpath=parent::*").evaluate(node => node.classList.contains("sms-textarea-with-count")), "手工录入短信计数器未放入文本框容器");
    await page.locator("#sms-manual-text").fill("短".repeat(12));
    assert.equal(await page.locator("#sms-manual-text").getAttribute("maxlength"), "300", "手工录入短信未限制为300字");
    assert.equal(await manualCount.innerText(), "12/300", "手工录入短信字数统计未更新");
    await page.locator("#sms-content-mode").selectOption("template");
    assert(await page.locator("#sms-template-content").isVisible(), "切回短信模板后模板内容未恢复");
    assert(await page.locator("#sms-manual-content").isHidden(), "切回短信模板后手工录入页面未隐藏");
    console.log("SMS conclusion limit regression passed");
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
