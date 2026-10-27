const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");
const seed = require("../data/seed-data.json");

const root = path.resolve(__dirname, "..");
const sampleId = "TS202610090002";
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
  const avoidanceSample = seed.lists.tickets.find(ticket => ticket.id === sampleId);
  assert(avoidanceSample, "缺少客户经理岗位回避示例工单");
  assert.equal(Object.hasOwn(avoidanceSample, "customerManagerConflict"), false, "岗位回避规则不应依赖样例专用标识");
  assert.equal(seed.documentData.tickets[sampleId].fields.entry["所属客户经理"], "林海-38102");

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
    const base = "http://127.0.0.1:" + server.address().port;
    await page.goto(base + "/?testRoute=ticket-form#ticket-form", { waitUntil:"domcontentloaded" });
    await page.selectOption("#work-order-type", "投诉单");
    await page.waitForSelector('[data-field-key="customer.1.所属客户经理"]');

    const manager = page.locator('.form-item[data-field-name="所属客户经理"] [data-person-search]');
    const managerInput = manager.locator("[data-person-search-input]");
    await managerInput.fill("王");
    const visibleManagerOptions = manager.locator("[data-person-search-option]:visible");
    assert.equal(await visibleManagerOptions.count(), 1, "所属客户经理首字搜索结果数量不正确");
    assert.equal((await visibleManagerOptions.first().innerText()).trim(), "王琳-27519");
    await visibleManagerOptions.first().click();
    assert.equal(await managerInput.inputValue(), "王琳-27519");

    await selectRole(page, "development", "development-handler");
    await page.locator('[data-page="ticket-process"]').click();
    await page.waitForSelector(".ticket-list-table");
    await page.locator('[data-scope="机构工单池"]').click();
    await page.waitForFunction(() => document.querySelector('[data-scope="机构工单池"]')?.classList.contains("is-active"));
    const sampleRow = page.locator(".ticket-list-table tr", { hasText:sampleId });
    assert.equal(await sampleRow.count(), 1, "岗位回避示例工单未显示在机构工单池");
    await sampleRow.locator('[data-action="process"]').click();
    await page.waitForSelector('.ticket-detail-page [data-detail-tab="处理信息"].is-active');

    const responsibility = page.locator('.form-item[data-field-name="责任人"] [data-app-select]');
    await responsibility.locator(".di-select-trigger").click();
    await responsibility.locator("[data-select-search]").fill("林");
    const visibleResponsibilityOptions = responsibility.locator("[data-select-value]:visible");
    assert.equal(await visibleResponsibilityOptions.count(), 1, "责任人首字搜索结果数量不正确");
    assert.equal((await visibleResponsibilityOptions.first().innerText()).trim(), "林海-38102");

    await page.locator('[data-action="submit-processing"]').click();
    await page.waitForSelector("#manager-avoidance-message");
    const modal = page.locator("#overlay-root .modal");
    assert.equal((await modal.locator(".modal-head").innerText()).trim(), "", "弹窗左上角不应展示标题");
    assert.equal((await modal.locator("#manager-avoidance-message").innerText()).trim(), "所属客户经理与当前处理人一致，根据岗位回避规则无法处理该工单", "弹窗提示文字不正确");
    assert.equal(await modal.locator(".action-dialog-question span").count(), 0, "弹窗不应展示岗位回避说明");
    assert.equal(await modal.locator(".modal-foot").count(), 0, "岗位回避提示不应展示底部按钮");
    assert.equal(await modal.locator("[data-close-overlay]").count(), 1, "岗位回避提示应仅保留一个 X 关闭按钮");
    assert.equal(await page.locator("#overlay-root .modal-mask[data-close-overlay]").count(), 0, "岗位回避提示遮罩不应成为额外关闭入口");
    await modal.locator("[data-close-overlay]").click();
    await page.waitForFunction(() => !document.querySelector("#overlay-root .modal"));
    console.log("Customer manager search and avoidance regression passed");
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
