"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const browserExecutable = findBrowserExecutable();
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml" };
const allowedBatchLabels = new Set(["批量催办", "批量导出"]);
const forbiddenBatchLabels = ["批量废止", "批量撤回", "批量召回", "批量复核", "批量初审", "批量审批", "批量会签", "批量处理", "批量查看", "批量通过"];

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end("Not found");
  response.writeHead(200, { "Content-Type":mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

async function openRoute(page, port, route) {
  await page.goto(`http://127.0.0.1:${port}/?testRoute=${route}#${route}`, { waitUntil:"domcontentloaded" });
  await page.waitForSelector("#page-root .page");
}

async function closeResult(page) {
  await page.waitForSelector(".batch-result-dialog");
  await page.getByRole("button", { name:"完成", exact:true }).click();
}

async function selectInstitution(host, parent, leaf) {
  await host.locator(".di-hierarchy-cascader-trigger").click();
  await host.locator(`[data-hierarchy-parent="${parent}"]`).click();
  await host.locator(`[data-hierarchy-toggle="${parent} / ${leaf}"]`).click();
}

async function assertOnlyAllowedBatchActions(page, route) {
  const labels = await page.locator("[data-bulk-action]").allInnerTexts();
  labels.forEach(label => assert(allowedBatchLabels.has(label), `${route} 出现不允许的批量操作：${label}`));
  forbiddenBatchLabels.forEach(label => assert(!labels.includes(label), `${route} 仍出现 ${label}`));
}

(async () => {
  const sourceFiles = ["app.js", "src/modules/complaints/rectification/index.js", "src/modules/complaints/inspections/index.js"];
  const sources = sourceFiles.map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  const workflow = JSON.parse(fs.readFileSync(path.join(root, "data/workflow-schema.json"), "utf8"));
  assert(sources.includes('const BATCH_OPERATION_KEYS = new Set(["remind", "transfer", "export"])'), "公共批量操作白名单未按规则移除批量删除");
  ["batch-delete-reason", "batch-void-reason", "batch-withdraw-reason", "batch-recall-reason", "batch-export-format", "batch-export-purpose", "撤回原因"].forEach(token => assert(!sources.includes(token), `不应保留批量字段或撤回原因：${token}`));
  assert.deepEqual(workflow.documentStateMachines.ticket.transitions.withdrawSubmission, { "待复核":"待提交", "待处理":"待提交" });
  assert.deepEqual(workflow.documentStateMachines.subprocess.transitions.withdrawSubmission, { "待复核":"待提交", "待处理":"待提交" });
  assert(sources.includes('const size = "wide"') && sources.includes('overlayRoot.querySelectorAll(".modal")'), "操作弹窗未统一为宽版");
  assert(!sources.includes("<dt>执行结果</dt>"), "批量确认弹窗仍显示执行结果字段");
  assert(sources.includes("openBatchResultDialog") && sources.includes("失败记录未发生数据变更"), "允许的批量操作缺少逐条结果反馈");

  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch(browserExecutable ? { headless:true, executablePath:browserExecutable } : { headless:true });
  const page = await browser.newPage({ viewport:{ width:1600, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.setItem("xib-role", "developer");
    localStorage.setItem("xib-org", "development");
    localStorage.setItem("xib-role-profile", "development-developer");
  });

  try {
    await openRoute(page, port, "ticket-create");
    await assertOnlyAllowedBatchActions(page, "工单创建");
    assert.equal(await page.locator('[data-bulk-operation="delete"], [data-bulk-operation="void"], [data-bulk-operation="withdraw"], [data-bulk-operation="recall"], [data-bulk-operation="export"]').count(), 0, "工单创建全部列表不应渲染批量删除等入口");
    await page.locator(".ticket-list-table .column-customizer-trigger").click();
    const columnPopover = page.locator('.column-customizer-popover[data-runtime]:not([hidden])');
    const configuredLabels = await columnPopover.locator('.column-customizer-options span').allInnerTexts();
    const filterLabels = await page.locator(".ticket-create-filter-panel .ticket-filter-item > label").allInnerTexts();
    assert(filterLabels.every(label => configuredLabels.includes(label.trim()) || ["处置期限", "是否抄送"].includes(label.trim())), "列表字段配置未按规则纳入筛选条件候选列");
    assert(!configuredLabels.includes("是否抄送"), "是否抄送不应出现在列表显示字段配置中");
    assert(await columnPopover.locator('[data-optional-column-label]:checked').count() === 0, "筛选条件候选列不应默认显示");
    const customerTypeOptional = columnPopover.locator('[data-optional-column-label="客户类型"]');
    assert(await customerTypeOptional.count() === 1, "客户类型未作为可选列表列提供");
    await customerTypeOptional.check();
    assert(await page.locator('.ticket-list-table th[data-optional-list-column="客户类型"]').count() === 1, "勾选客户类型后未增加列表列头");
    assert((await page.locator('.ticket-list-table td[data-optional-list-column="客户类型"]').allInnerTexts()).some(text => text.trim() === "自然人"), "客户类型可选列未回显真实字段数据");
    assert(await page.locator(".ticket-create-filter-panel .ticket-filter-item", { hasText:"客户类型" }).evaluate(node => getComputedStyle(node).display !== "none"), "配置列表列头时不应隐藏筛选条件");
    const remainingTimeOptional = columnPopover.locator('[data-optional-column-label="剩余处置时间"]');
    assert(await remainingTimeOptional.count() === 1 && !(await remainingTimeOptional.isChecked()), "剩余处置时间应作为默认不显示的可选列");
    assert((await page.locator(".ticket-list-table thead").innerText()).includes("处置期限") && !(await page.locator(".ticket-list-table thead").innerText()).includes("剩余处置时间"), "列表默认应仅显示处置期限");
    await remainingTimeOptional.check();
    const coexistTimeHeaders = await page.locator(".ticket-list-table thead").innerText();
    assert(coexistTimeHeaders.includes("处置期限") && coexistTimeHeaders.includes("剩余处置时间"), "处置期限与剩余处置时间未并列显示");
    await columnPopover.locator('[data-column-reset]').click();
    assert(await page.locator('.ticket-list-table th[data-optional-list-column="客户类型"]').count() === 0, "恢复默认后筛选条件候选列仍在列表中显示");
    assert(await page.locator('.ticket-list-table th[data-optional-list-column="剩余处置时间"]').count() === 0, "恢复默认后剩余处置时间仍在列表中显示");
    assert(await page.locator(".ticket-create-filter-panel .ticket-filter-item").first().evaluate(node => getComputedStyle(node).display !== "none"), "列表字段配置不应改变筛选栏显示");

    const withdrawRows = page.locator('.ticket-list-table tbody tr:has(button[data-operation-key="withdraw"])');
    const withdrawStatuses = await withdrawRows.locator('[data-flow-status]').allInnerTexts();
    assert(withdrawStatuses.includes("待复核"), "缺少提交后待复核工单的撤回路径");
    assert(withdrawStatuses.includes("待处理"), "缺少提交后待处理工单的撤回路径");
    assert(withdrawStatuses.includes("待审批"), "缺少待审批工单的原有撤回路径");
    assert(withdrawStatuses.every(status => ["待复核", "待处理", "待审批"].includes(status.trim())), "已超过紧邻节点的工单错误显示撤回操作");
    const withdrawAction = withdrawRows.filter({ has:page.locator('[data-flow-status="待审批"]') }).locator('button[data-operation-key="withdraw"]').first();
    await withdrawAction.click();
    await page.waitForSelector(".action-dialog");
    assert.equal(await page.locator(".action-dialog input, .action-dialog select, .action-dialog textarea").count(), 0, "撤回不应填写原因或其他字段");
    const withdrawCopy = await page.locator(".action-dialog").innerText();
    assert(withdrawCopy.includes("待审批") && withdrawCopy.includes("处理中"), "撤回弹窗未说明从待审批返回处理中");
    await page.getByRole("button", { name:"取消", exact:true }).click();

    await page.getByRole("button", { name:/自动带入草稿箱/ }).click();
    await page.waitForFunction(() => document.querySelector('[data-create-tab="自动带入草稿箱"]')?.classList.contains("is-active"));
    const autoDeadlineCells = page.locator('.ticket-list-table .ticket-time-cell');
    assert(await autoDeadlineCells.count() > 0, "自动带入草稿箱缺少处置期限列");
    const autoDeadlineTexts = await autoDeadlineCells.allInnerTexts();
    assert(autoDeadlineTexts.some(value => value.trim() === "-") && autoDeadlineTexts.some(value => value.trim() !== "-"), "草稿处置期限未按实际数据与缺失值分别回显");
    assert(await page.locator('.ticket-list-table .ticket-time-cell[data-disposition-deadline]:not([data-disposition-deadline=""])').first().evaluate(node => node.classList.contains("is-urgent")), "剩余不足三天的处置时间未标红");
    assert.equal(await page.locator('[data-row-select="auto-drafts"], [data-bulk-operation="delete"]').count(), 0, "自动带入草稿箱不应提供批量删除或复选框");
    await page.locator('.ticket-list-table [data-action="delete-row"]').first().click();
    await page.waitForSelector(".action-dialog");
    assert((await page.locator(".action-dialog").innerText()).includes("删除后该草稿无法恢复。"), "自动带入草稿箱删除弹窗文案不正确");
    await page.getByRole("button", { name:"取消", exact:true }).click();

    await page.getByRole("button", { name:/录入导入草稿箱/ }).click();
    await page.waitForFunction(() => document.querySelector('[data-create-tab="录入导入草稿箱"]')?.classList.contains("is-active"));
    await page.locator('.ticket-list-table [data-action="delete-row"]').first().click();
    await page.waitForSelector(".action-dialog");
    assert((await page.locator(".action-dialog").innerText()).includes("删除后该草稿无法恢复。"), "录入导入草稿箱删除弹窗文案不正确");
    await page.getByRole("button", { name:"取消", exact:true }).click();

    await page.getByRole("button", { name:/导入记录/ }).click();
    await page.waitForFunction(() => document.querySelector('[data-create-tab="导入记录"]')?.classList.contains("is-active"));
    assert.deepEqual(await page.locator(".filter-panel .ticket-filter-item > label").allInnerTexts(), ["导入状态", "导入时间", "导入文件"], "导入记录筛选条件不是指定三项");
    assert((await page.locator(".import-table thead").innerText()).includes("导入时间"), "导入记录列表未显示导入时间列");
    const importRows = page.locator(".import-table tbody tr");
    const failedRows = importRows.filter({ hasText:"导入失败" });
    const successRows = importRows.filter({ hasText:"导入成功" });
    assert(await failedRows.count() > 0 && await successRows.count() > 0, "导入记录样例未覆盖成功和失败状态");
    assert.equal(await failedRows.locator('[data-action="delete-row"]').count(), await failedRows.count(), "导入失败记录缺少删除操作");
    assert.equal(await successRows.locator('[data-action="delete-row"]').count(), 0, "导入成功记录错误显示删除操作");
    assert.equal(await page.locator('[data-row-select="import-records"], [data-bulk-operation="delete"]').count(), 0, "导入记录不应提供批量删除或复选框");
    await failedRows.first().locator('[data-action="delete-row"]').click();
    await page.waitForSelector(".action-dialog");
    assert((await page.locator(".action-dialog").innerText()).includes("删除后该导入记录无法恢复。"), "导入记录删除弹窗文案不正确");
    await page.getByRole("button", { name:"取消", exact:true }).click();

    await openRoute(page, port, "ticket-create");
    await page.locator('[data-create-tab="全部"]').click();
    await page.waitForFunction(() => document.querySelector('[data-create-tab="全部"]')?.classList.contains("is-active"));

    const remindAction = page.locator('button[data-operation-key="remind"][data-batch-label="批量催办"]').first();
    assert.equal(await remindAction.count(), 1, "缺少批量催办对应的单条催办样例");
    const remindRow = remindAction.locator("xpath=ancestor::tr");
    await remindRow.locator("[data-row-select]").check();
    const remindButton = page.locator('[data-bulk-operation="remind"][data-bulk-action="批量催办"]');
    assert.equal(await remindButton.count(), 1, "缺少批量催办入口");
    const positions = await Promise.all([
      remindAction.evaluate(node => { const box=node.closest("td").getBoundingClientRect(); return { x:box.x, centerY:box.y+box.height/2 }; }),
      remindButton.evaluate(node => { const slot=node.closest(".table-bulk-slot").getBoundingClientRect(); const button=node.getBoundingClientRect(); const toolbar=node.closest(".table-bulk-toolbar").getBoundingClientRect(); return { x:slot.x, buttonCenterY:button.y+button.height/2, toolbarCenterY:toolbar.y+toolbar.height/2 }; })
    ]);
    assert(Math.abs(positions[0].x - positions[1].x) <= 1, "批量催办未与对应操作列横向对齐");
    assert(Math.abs(positions[1].buttonCenterY - positions[1].toolbarCenterY) <= 1, "批量催办未在工具栏 section 内垂直居中");
    await remindButton.click();
    await page.waitForSelector(".batch-action-dialog");
    assert.equal(await page.locator(".batch-action-dialog input, .batch-action-dialog select, .batch-action-dialog textarea").count(), 0, "批量催办不应要求填写字段");
    await page.getByRole("button", { name:"确认催办", exact:true }).click();
    await page.waitForSelector(".batch-result-dialog");
    assert((await page.locator(".batch-result-dialog").innerText()).includes("状态保持"), "批量催办改变了流程状态");
    await closeResult(page);

    await openRoute(page, port, "ticket-process");
    await assertOnlyAllowedBatchActions(page, "工单处理");
    assert(await page.locator('button[data-operation-key="transfer"]').count() > 0, "取消批量转派时误删了单条转派");
    assert.equal(await page.locator('[data-bulk-operation="transfer"], [data-bulk-action="批量转派"], [data-batch-label="批量转派"]').count(), 0, "工单处理仍提供批量转派");

    for (const route of ["subprocess-create", "subprocess-manage", "my-approvals", "rectification-create", "rectification-process", "rectification-approve", "query-tickets", "query-subprocesses", "analysis-inspections"]) {
      await openRoute(page, port, route);
      await assertOnlyAllowedBatchActions(page, route);
      if (route.startsWith("rectification-")) {
        assert.equal(await page.locator('[data-operation-key="transfer"], [data-bulk-operation="transfer"]').count(), 0, `${route} 仍提供转派操作`);
        assert.equal(await page.locator('[data-row-select="rectification-orders"], [data-select-all="rectification-orders"], [data-bulk-toolbar="rectification-orders"]').count(), 0, `${route} 仍保留无效批量选择控件`);
      }
    }
    await openRoute(page, port, "subprocess-manage");
    await page.locator('[data-subprocess-scope="下辖工单池"]').click();
    await page.waitForFunction(() => document.querySelector('[data-subprocess-scope="下辖工单池"]')?.classList.contains("is-active"));
    assert.equal(await page.locator('[data-bulk-operation="recall"]').count(), 0, "下辖子单池仍提供批量召回");
    assert.equal(await page.locator('[data-operation-key="recall"], [data-action="recall-transfer"]').count(), 0, "下辖子单池仍保留已废弃的单条召回");

    await openRoute(page, port, "my-approvals");
    await page.locator('[data-approval-scope="下辖工单池"]').click();
    await page.waitForFunction(() => document.querySelector('[data-approval-scope="下辖工单池"]')?.classList.contains("is-active"));
    assert.equal(await page.locator('[data-bulk-operation="recall"]').count(), 0, "下辖审批池仍提供批量召回");
    assert.equal(await page.locator('[data-operation-key="recall"], [data-action="recall-transfer"]').count(), 0, "下辖审批池仍保留已废弃的单条召回");

    await openRoute(page, port, "analysis-inspections");
    assert.equal(await page.locator('[data-bulk-operation="inspection-export"], [data-inspections-row-select], [data-inspections-select-all]').count(), 0, "智能核查仍保留批量导出或批量选择控件");
    assert.equal(errors.length, 0, `浏览器错误：${errors.join(" | ")}`);
    console.log(JSON.stringify({ ok:true, checks:["批量催办、转派及导出白名单", "待审批工单撤回至处理中", "草稿箱无复选框和批量删除", "导入记录无复选框和批量删除", "导入失败记录单条删除", "批量按钮横向对列", "批量按钮垂直居中", "催办仅确认且状态不变", "转派真实流转", "召回入口已移除", "溯源整改不可转派", "智能核查无批量导出", "所有操作弹窗宽版"], browserErrors:errors }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exit(1);
});
