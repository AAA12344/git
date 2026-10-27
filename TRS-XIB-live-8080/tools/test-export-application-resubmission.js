const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");
const seed = require("../data/seed-data.json");

const root = path.resolve(__dirname, "..");
const storageKey = "xib-prototype-state-v" + seed.meta.storageVersion;
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml" };
  response.writeHead(200, { "Content-Type":(mime[path.extname(file)] || "application/octet-stream") + "; charset=utf-8" });
  fs.createReadStream(file).pipe(response);
});

async function submitNonDesensitizedRequest(page, requestId, reason = "") {
  const row = page.locator(".export-request-table tbody tr", { hasText:requestId });
  await row.locator("[data-action='edit-export-request']").click();
  await page.locator('input[name="export-desensitization"][value="非脱敏导出"]').check();
  if (reason) await page.locator("#export-reason").fill(reason);
  await page.locator("#modal-confirm").click();
  await page.waitForSelector(".export-request-table");
}

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
    await page.goto("http://127.0.0.1:" + server.address().port + "/?testRoute=ledger-query#ledger-query", { waitUntil:"domcontentloaded" });
    await page.locator("[data-query-tab='导出申请']").click();
    await page.waitForSelector(".export-request-table");

    const expiredRequestId = "DC202607300218";
    let expiredRow = page.locator(".export-request-table tbody tr", { hasText:expiredRequestId });
    assert.equal(await expiredRow.locator("[data-action='download-export']").count(), 0, "超过7天的导出申请仍可下载");
    assert.equal(await expiredRow.locator("[data-unavailable-action='download-export']").count(), 1, "过期导出申请的下载操作未显示为-");
    assert.equal(await expiredRow.locator("[data-action='edit-export-request']").count(), 1, "过期导出申请缺少编辑入口");
    await expiredRow.locator("[data-action='edit-export-request']").click();
    await page.waitForSelector(".export-application");
    await page.locator("#modal-confirm").click();
    await page.waitForSelector(".export-request-table");
    await page.waitForFunction(requestId => {
      const row = [...document.querySelectorAll(".export-request-table tbody tr")].find(item => item.textContent.includes(requestId));
      return row?.dataset.exportAppliedAt && row.dataset.exportAppliedAt !== "2026-07-30 15:08";
    }, expiredRequestId);
    let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    let request = saved.rows.exportRequests.find(row => row[0] === expiredRequestId);
    assert.notEqual(request[7], "2026-07-30 15:08", "编辑后未更新申请时间");
    assert.match(request[19] || "", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "编辑后未记录秒级审批通过时间");
    assert.match(request[20] || "", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "编辑后未记录秒级过期时间");
    assert.equal(Date.parse(request[20].replace(" ", "T")) - Date.parse(request[19].replace(" ", "T")), 7 * 24 * 60 * 60 * 1000, "编辑后的过期时间不是审批通过后7×24小时");
    expiredRow = page.locator(".export-request-table tbody tr", { hasText:expiredRequestId });
    assert.equal(await expiredRow.locator("[data-action='download-export']").count(), 1, "重新申请成功后下载未恢复可用");
    assert.equal(await expiredRow.locator("[data-action='edit-export-request']").count(), 0, "下载恢复后仍显示编辑入口");

    const rejectedRequestId = "DC202607310205";
    const applicationReason = "用于核对投诉处理过程及关联工单记录。";
    await submitNonDesensitizedRequest(page, rejectedRequestId, applicationReason);
    saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    request = saved.rows.exportRequests.find(row => row[0] === rejectedRequestId);
    let approvals = saved.rows.approvals.filter(row => row[0] === rejectedRequestId && row[1] === "导出申请审批");
    assert.notEqual(request[7], "2026-07-31 09:50", "已驳回申请编辑后未更新申请时间");
    assert.equal(request[12], applicationReason, "申请原因未写入导出申请记录");
    assert.equal(approvals.length, 1, "已驳回申请再次提交后应只保留一条审批记录");
    assert.equal(approvals[0][7], request[7], "已驳回申请的审批记录申请时间未同步");

    const withdrawnRequestId = "DC202607310201";
    const pendingRow = page.locator(".export-request-table tbody tr", { hasText:withdrawnRequestId });
    await pendingRow.locator("[data-action='withdraw-export-request']").click();
    await page.locator("#modal-confirm").click();
    await page.waitForSelector(".export-request-table");
    saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    assert.equal(saved.rows.approvals.filter(row => row[0] === withdrawnRequestId && row[1] === "导出申请审批").length, 0, "撤回申请后不应保留审批记录");
    await submitNonDesensitizedRequest(page, withdrawnRequestId);
    saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    request = saved.rows.exportRequests.find(row => row[0] === withdrawnRequestId);
    approvals = saved.rows.approvals.filter(row => row[0] === withdrawnRequestId && row[1] === "导出申请审批");
    assert.notEqual(request[7], "2026-07-31 03:10", "撤回后再次提交未更新申请时间");
    assert.equal(approvals.length, 1, "撤回后再次提交应只保留一条审批记录");
    assert.equal(approvals[0][7], request[7], "撤回后再次提交的审批记录申请时间未同步");

    const legacyRequestId = expiredRequestId;
    await page.evaluate(({ key, requestId }) => {
      const state = JSON.parse(localStorage.getItem(key));
      const legacyRow = state.rows.exportRequests.find(row => row[0] === requestId);
      const appliedAt = new Date(Date.now() - 60 * 60 * 1000);
      const pad = value => String(value).padStart(2, "0");
      legacyRow[5] = "已通过";
      legacyRow[7] = `${appliedAt.getFullYear()}-${pad(appliedAt.getMonth() + 1)}-${pad(appliedAt.getDate())} ${pad(appliedAt.getHours())}:${pad(appliedAt.getMinutes())}:${pad(appliedAt.getSeconds())}`;
      legacyRow[15] = "可下载";
      legacyRow[17] = "跨机构转派后由总行审批";
      legacyRow[18] = "同意导出";
      legacyRow.length = 19;
      localStorage.setItem(key, JSON.stringify(state));
    }, { key:storageKey, requestId:legacyRequestId });
    await page.reload({ waitUntil:"domcontentloaded" });
    await page.locator("[data-query-tab='导出申请']").click();
    await page.waitForSelector(".export-request-table");
    const migratedRow = page.locator(".export-request-table tbody tr", { hasText:legacyRequestId });
    assert.equal(await migratedRow.locator("[data-action='download-export']").count(), 1, "旧版已通过申请迁移后未恢复下载能力");
    saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    request = saved.rows.exportRequests.find(row => row[0] === legacyRequestId);
    assert.match(request[19] || "", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "旧版申请未补齐审批通过时间");
    assert.match(request[20] || "", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "旧版申请未补齐过期时间");
    assert.equal(Date.parse(request[20].replace(" ", "T")) - Date.parse(request[19].replace(" ", "T")), 7 * 24 * 60 * 60 * 1000, "旧版申请迁移后的保留期不是7×24小时");
    await migratedRow.locator("[data-action='export-request-detail']").click();
    const detail = page.locator(".export-request-detail");
    const detailLabels = (await detail.locator("dt").allInnerTexts()).map(label => label.trim());
    assert(detailLabels.includes("导出申请状态"), "详情页缺少导出申请状态");
    for (const removedLabel of ["当前节点", "敏感字段", "转派原因", "审批意见"]) {
      assert(!detailLabels.includes(removedLabel), "详情页仍显示应删除的字段：" + removedLabel);
    }
    assert.equal((await detail.locator("dt", { hasText:"关联业务单" }).locator("xpath=following-sibling::dd").textContent()).trim(), "工单：TS202607180026、TS202607230012", "详情页关联业务单未展示当前导出范围的工单编号");
    assert.deepEqual((await detail.locator(".export-request-flow th").allInnerTexts()).map(label => label.trim()), ["操作时间", "操作人", "操作动作", "说明"], "详情页流转记录表头不符合要求");
    assert(await detail.locator(".export-request-flow tbody tr").count() > 0, "详情页缺少流转记录");
    console.log("Export application resubmission regression passed");
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
