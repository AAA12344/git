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
    await page.locator('[data-action="add-contact"]').click();
    await page.waitForSelector(".contact-create-form");

    const phoneField = page.locator('[data-contact-record-number-field="电话"]');
    const smsField = page.locator('[data-contact-record-number-field="短信"]');
    const phoneInput = phoneField.locator("input");
    const smsInput = smsField.locator("input");
    assert.equal(await phoneField.isVisible(), true, "默认电话方式未显示电话号码字段");
    assert.equal(await smsField.isHidden(), true, "默认电话方式不应显示接收号码字段");
    assert.equal(await phoneInput.getAttribute("inputmode"), "numeric", "电话号码字段未启用数字键盘");
    assert.equal(await phoneInput.getAttribute("pattern"), "[0-9]*", "电话号码字段未限制数字格式");

    await page.locator('[data-field-key="contact-create.联系主要内容"]').fill("已向客户说明处理情况。");
    await page.locator('[data-field-key="contact-create.沟通反馈意见"]').fill("客户表示知悉。");
    await page.locator("#modal-confirm").click();
    assert((await page.locator(".modal-validation-error").innerText()).includes("请填写电话号码"), "电话方式未校验电话号码必填");
    await phoneInput.fill("123456");
    await page.locator("#modal-confirm").click();
    assert((await page.locator(".modal-validation-error").innerText()).includes("请输入有效的手机号码"), "电话方式未校验号码格式和长度");
    await phoneInput.fill("138abc00001234");
    assert.equal(await phoneInput.inputValue(), "13800001234", "电话号码字段未过滤非数字字符");

    await page.locator('[data-radio-value="短信"]').click();
    assert.equal(await phoneField.isHidden(), true, "短信方式仍显示电话号码字段");
    assert.equal(await smsField.isVisible(), true, "短信方式未显示接收号码字段");
    await page.locator("#modal-confirm").click();
    assert((await page.locator(".modal-validation-error").innerText()).includes("请填写接收号码"), "短信方式未校验接收号码必填");
    await smsInput.fill("059212345678");
    await page.locator("#modal-confirm").click();
    await page.waitForSelector(".contact-submit-confirm");
    const confirmation = await page.locator(".contact-submit-confirm").innerText();
    assert(confirmation.includes("接收号码") && confirmation.includes("059212345678"), "确认弹窗未展示短信接收号码");
    console.log("New contact record number regression passed");
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
