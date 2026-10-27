const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");
const seed = require("../data/seed-data.json");

const root = path.resolve(__dirname, "..");
const storageKey = "xib-prototype-state-v" + seed.meta.storageVersion;
const seedIds = new Set(seed.lists.tickets.map(row => row.id));
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml" };
  response.writeHead(200, { "Content-Type":(mime[path.extname(file)] || "application/octet-stream") + "; charset=utf-8" });
  fs.createReadStream(file).pipe(response);
});

async function selectRole(page, organization, profile) {
  await page.locator("#role-cascade-trigger").click();
  await page.locator('[data-role-org="' + organization + '"]').click();
  await page.locator('[data-role-profile="' + profile + '"]').click();
}

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath:findBrowserExecutable(), headless:true });
  const context = await browser.newContext({ viewport:{ width:1680, height:1050 } });
  await context.addInitScript(() => {
    localStorage.setItem("xib-role", "developer");
    localStorage.setItem("xib-org", "development");
    localStorage.setItem("xib-role-profile", "development-developer");
  });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:" + server.address().port + "/?testRoute=ticket-form#ticket-form", { waitUntil:"domcontentloaded" });
    await page.selectOption("#work-order-type", "投诉单");
    await page.locator('[data-action="demo-fill-ticket"]').click();
    await page.waitForFunction(() => document.querySelector('input[data-field-key="customer.1.客户姓名"]')?.value === "陈晓敏");
    await page.locator('[data-action="smart-classify"]').click();
    await page.waitForFunction(() => Boolean(document.querySelector('input[data-field-key="业务类别"]')?.value));
    const request = page.locator('.form-item[data-field-name="投诉请求"] [data-app-select]');
    await request.locator('.di-select-trigger').click();
    await request.locator('[data-select-value="其他"]').click();
    const channel = page.locator('.form-item[data-field-name="受理渠道"] [data-app-select]');
    await channel.locator(".di-select-trigger").click();
    await channel.locator('[data-select-value="营业网点"]').click();
    await selectRole(page, "development", "development-operator");
    await page.locator('[data-action="submit-ticket"]').click();
    await page.waitForSelector("#overlay-root .modal");
    if (await page.locator(".validation-warning-dialog").count()) await page.locator("#modal-confirm").click();
    if (await page.locator(".acceptance-sms-choice").count()) await page.locator('input[name="acceptance-sms"][value="否"]').check();
    await page.locator("#modal-confirm").click();
    await page.waitForSelector(".contact-result");
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    const row = saved.rows.ticket.find(item => !seedIds.has(item[0]));
    assert(row, "工单创建未写入本地工作流数据");
    assert.equal(row[5], "待处理", "非复核工单提交后未进入待处理");
    const id = row[0];
    await page.locator(".modal-foot [data-close-overlay]").click();
    await selectRole(page, "development", "development-handler");
    await page.locator("[data-page='ticket-process']").click();
    await page.waitForSelector(".ticket-list-table");
    await page.waitForFunction(() => document.querySelector('[data-scope="机构工单池"]')?.classList.contains("is-active"));
    assert.equal(await page.locator(".ticket-list-table tr", { hasText:id }).count(), 1, "新建待处理工单未出现在接收机构的工单处理池：" + JSON.stringify(row));
    await page.locator(".ticket-list-table tr", { hasText:id }).locator('[data-action="process"]').click();
    await page.waitForSelector(".ticket-detail-page");
    const claimed = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    assert.equal(claimed.rows.ticket.find(item => item[0] === id)?.[5], "处理中", "点击处理后工单未领取为处理中");
    await page.locator("[data-page='ticket-process']").click();
    await page.waitForSelector(".ticket-list-table");
    await page.waitForFunction(() => document.querySelector('[data-scope="我的工作台"]')?.classList.contains("is-active"));
    assert.equal(await page.locator(".ticket-list-table tr", { hasText:id }).count(), 1, "领取后未提交的工单未保留在处理员工作台");
    console.log("Created ticket work-pool regression passed");
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
