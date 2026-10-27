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

async function selectRoutingAssigneeAndConfirm(page, expectedTargetText) {
  const modal = page.locator(".modal");
  await modal.waitFor();
  assert.equal(await modal.getAttribute("data-modal-size"), "wide", "整改流转人员弹窗不是宽版");
  assert((await modal.innerText()).includes(expectedTargetText), "整改流转人员弹窗目标部门不正确");
  const selector = modal.locator("#rectification-next-assignee");
  assert.equal(await selector.locator("option").count(), 3, "整改流转人员候选项不完整");
  await selector.selectOption({ index:1 });
  const actor = await selector.inputValue();
  await modal.getByRole("button", { name:"确认提交", exact:true }).click();
  return actor;
}

async function readStoredRectificationUnits(page, id) {
  return page.evaluate(rectificationId => {
    const key = Object.keys(localStorage).find(item => item.startsWith("xib-prototype-state-v"));
    const saved = key ? JSON.parse(localStorage.getItem(key) || "null") : null;
    const fields = saved?.documentData?.rectifications?.[rectificationId]?.fields || {};
    const institution = fields.base?.["所属机构"] || "-";
    const department = fields.base?.["所属部门"] || "-";
    const rectificationUnitParts = String(fields.entry?.["整改部门或机构"] || "-").split("/").map(value => value.trim()).filter(Boolean);
    return {
      initiating:department !== "-" ? department : institution,
      rectification:rectificationUnitParts.at(-1) || "-"
    };
  }, id);
}

async function readStoredRectificationRouting(page, id) {
  return page.evaluate(rectificationId => {
    const key = Object.keys(localStorage).find(item => item.startsWith("xib-prototype-state-v"));
    const saved = key ? JSON.parse(localStorage.getItem(key) || "null") : null;
    const routing = saved?.documentData?.rectifications?.[rectificationId]?.fields?.routing || [];
    return {
      last:routing.at(-1) || null,
      approval:saved?.documentData?.rectifications?.[rectificationId]?.fields?.approval || null,
      assignment:saved?.workPoolAssignments?.rectification?.[rectificationId] || null
    };
  }, id);
}

async function showRectificationRow(page, id) {
  for (const view of ["workbench", "org", "subOrg"]) {
    await page.locator(`[data-rectification-view="${view}"]`).click();
    if (view === "workbench" && await page.locator('[data-rectification-tab="all"]').count()) {
      await page.locator('[data-rectification-tab="all"]').click();
    }
    const row = page.locator(`[data-rectification-row="${id}"]`);
    if (await row.count()) return row;
  }
  throw new Error(`整改审批各工单池均未找到样例 ${id}`);
}

(async () => {
  const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const rectificationMachine = JSON.parse(fs.readFileSync(path.join(root, "data/workflow-schema.json"), "utf8")).documentStateMachines.rectification;
  assert.equal(rectificationMachine.transitions.submitProblemDraft["草稿"], "问题待审核", "草稿提交后必须直接进入问题待审核");
  assert.equal(rectificationMachine.transitions.reject["问题待审核"], "问题待提交", "问题待提交只能作为问题审核不通过的退回状态");
  assert.equal(rectificationMachine.transitions.rejectPlan["方案待提交"], "问题待提交", "方案待提交驳回后必须回到问题待提交");
  assert(appSource.includes('returnToRectificationList("rectification-create")'), "创建阶段未使用统一整改返回路由");
  assert(appSource.includes('returnToRectificationList("rectification-process")'), "处理阶段未使用统一整改返回路由");
  assert(appSource.includes('returnToRectificationList("rectification-approve")'), "审批阶段未使用统一整改返回路由");

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
    await openRoute(page, port, "rectification-create");
    assert.equal((await page.locator('[data-rectification-view="org"] span').innerText()).trim(), "本机构范围内未办结的整改单", "整改创建机构工单池说明不正确");
    const listHeaders = await page.locator(".rectification-table thead th").allInnerTexts();
    const applicationHeaderIndex = listHeaders.findIndex(label => label.includes("申请时间"));
    const plannedHeaderIndex = listHeaders.findIndex(label => label.includes("计划完成时间"));
    assert(applicationHeaderIndex > -1, "整改列表缺少申请时间");
    assert(plannedHeaderIndex > applicationHeaderIndex, "计划完成时间应紧随申请时间");
    const draftRow = page.locator('.rectification-table tbody tr', { hasText:"草稿" }).first();
    assert.equal((await draftRow.locator("td").nth(7).innerText()).trim(), "-", "计划完成时间为空时未显示占位符");
    const edit = page.locator('button[data-action="edit-rectification"]').first();
    assert.equal(await edit.count(), 1, "整改创建列表缺少可提交的编辑样例");
    const submittedRectificationId = await edit.getAttribute("data-id");
    await edit.click();
    await page.waitForURL(/#rectification-form$/);
    await page.locator('[data-action="demo-fill-subprocess"]').click();
    await page.locator('[data-action="submit-rectification"]').click();
    const createActor = await selectRoutingAssigneeAndConfirm(page, "消费者权益保护部");
    await page.waitForURL(/#rectification-create$/);
    await page.waitForSelector('[data-rectification-module="create"]');
    const createRouting = await readStoredRectificationRouting(page, submittedRectificationId);
    assert.equal(createRouting.last?.nextNode, "整改问题审核");
    assert.equal(createRouting.last?.assignee, createActor);
    assert.equal(createRouting.approval?.["审批人"], createActor);
    assert.equal(createRouting.assignment?.assignee, createActor);

    await openRoute(page, port, "rectification-process");
    assert.equal((await page.locator('[data-rectification-view="org"] span').innerText()).trim(), "本机构范围内未办结的整改单", "整改处理机构工单池说明不正确");
    const planRow = page.locator(".rectification-table tbody tr", { hasText:"方案待提交" }).first();
    const process = planRow.locator('button[data-action="rectification-process"]');
    assert.equal(await process.count(), 1, "整改处理列表缺少可处理样例");
    const submittedPlanId = await planRow.getAttribute("data-rectification-row");
    await process.click();
    await page.waitForURL(/#rectification-detail$/);
    await page.waitForSelector('[data-action="submit-subprocess-processing"]');
    const stickyButtons = page.locator('[data-action="save-subprocess-processing"], [data-action="reject-rectification-plan"], [data-action="submit-subprocess-processing"]');
    const stickyActionLabels = (await stickyButtons.allInnerTexts()).map(text => text.trim());
    const stickyActions = await stickyButtons.evaluateAll(buttons => buttons.map(button => button.dataset.action));
    const saveIndex = stickyActions.indexOf("save-subprocess-processing");
    const rejectIndex = stickyActions.indexOf("reject-rectification-plan");
    const submitIndex = stickyActions.indexOf("submit-subprocess-processing");
    assert(saveIndex > -1 && rejectIndex === saveIndex + 1 && submitIndex === rejectIndex + 1, "方案待提交底部按钮顺序不正确：" + JSON.stringify({ stickyActions, stickyActionLabels }));
    assert.equal(stickyActionLabels[saveIndex], "保存草稿", "整改处理保存按钮名称不正确");
    assert.equal(stickyActionLabels[submitIndex], "提交制定整改计划", "整改计划提交按钮名称不正确");
    await page.locator('[data-action="reject-rectification-plan"]').click();
    const rejectModal = page.locator(".modal");
    assert.equal(await rejectModal.getAttribute("data-modal-size"), "wide", "整改方案驳回弹窗不是宽版");
    assert((await rejectModal.innerText()).includes("问题待提交"), "整改方案驳回弹窗未显示目标节点");
    assert.equal(await rejectModal.locator('.action-readonly-status .tag').count(), 1, "驳回目标节点未使用状态 badge");
    const rejectReceiver = rejectModal.locator('input[readonly]');
    assert.equal(await rejectReceiver.inputValue(), "陈敏慧-60157", "驳回接收人未回显整改单创建人");
    assert(await rejectReceiver.isDisabled(), "驳回接收人输入框未禁用置灰");
    assert.notEqual(await rejectReceiver.evaluate((node) => getComputedStyle(node).backgroundColor), "rgb(255, 255, 255)", "驳回接收人输入框仍为白色背景");
    await rejectModal.getByRole("button", { name:"确认驳回", exact:true }).click();
    assert(await rejectModal.locator(".modal-validation-error").count() === 1, "驳回理由为空时未阻止提交");
    await rejectModal.getByRole("button", { name:"取消", exact:true }).click();
    await page.locator('[data-action="demo-fill-subprocess-processing"]').click();
    await page.locator('[data-action="submit-subprocess-processing"]').click();
    const planUnits = await readStoredRectificationUnits(page, submittedPlanId);
    const planActor = await selectRoutingAssigneeAndConfirm(page, planUnits.rectification);
    await page.waitForURL(/#rectification-process$/);
    await page.waitForSelector('[data-rectification-module="process"]');
    const planRouting = await readStoredRectificationRouting(page, submittedPlanId);
    assert.equal(planRouting.last?.nextNode, "整改方案初审");
    assert.equal(planRouting.last?.assignee, planActor);
    assert.equal(planRouting.approval?.["审批人"], planActor);
    assert.equal(planRouting.assignment?.assignee, planActor);

    const resultRow = page.locator(".rectification-table tbody tr", { hasText:"整改中" }).first();
    const submittedResultId = await resultRow.getAttribute("data-rectification-row");
    await resultRow.locator('button[data-action="rectification-process"]').click();
    await page.waitForURL(/#rectification-detail$/);
    await page.locator('[data-action="demo-fill-subprocess-processing"]').click();
    await page.locator('[data-action="submit-subprocess-processing"]').click();
    const resultUnits = await readStoredRectificationUnits(page, submittedResultId);
    const resultActor = await selectRoutingAssigneeAndConfirm(page, resultUnits.rectification);
    await page.waitForURL(/#rectification-process$/);
    const resultRouting = await readStoredRectificationRouting(page, submittedResultId);
    assert.equal(resultRouting.last?.nextNode, "整改结果初审");
    assert.equal(resultRouting.last?.assignee, resultActor);
    assert.equal(resultRouting.approval?.["审批人"], resultActor);
    assert.equal(resultRouting.assignment?.assignee, resultActor);

    await openRoute(page, port, "rectification-approve");
    assert.equal((await page.locator('[data-rectification-view="org"] span').innerText()).trim(), "本机构范围内未办结的整改单", "整改审批机构工单池说明不正确");
    const submittedAuditRow = page.locator(".rectification-table tbody tr", { hasText:submittedRectificationId });
    assert.equal(await submittedAuditRow.count(), 1, "草稿提交后未进入整改审批列表");
    assert.match(await submittedAuditRow.innerText(), /问题待审核/, "草稿提交后的状态不是问题待审核");
    const approve = submittedAuditRow.locator('button[data-action="rectification-approve"]');
    assert.equal(await approve.count(), 1, "整改审批列表缺少可审批样例");
    await approve.click();
    await page.waitForURL(/#rectification-detail$/);
    await page.locator('[data-action="submit-approval"]').click();
    await page.waitForURL(/#rectification-approve$/);
    await page.waitForSelector('[data-rectification-module="approve"]');

    for (const [id, status, nextNode] of [[submittedPlanId, "方案待初审", "整改方案审批"], [submittedResultId, "结果待初审", "整改结果审批"]]) {
      const initialRow = await showRectificationRow(page, id);
      assert.match(await initialRow.innerText(), new RegExp(status), id + " 缺少初审样例状态");
      await initialRow.locator('[data-action="rectification-approve"]').click();
      await page.waitForURL(/#rectification-detail$/);
      await page.locator('[data-action="submit-approval"]').click();
      const units = await readStoredRectificationUnits(page, id);
      const actor = await selectRoutingAssigneeAndConfirm(page, units.initiating);
      await page.waitForURL(/#rectification-approve$/);
      await page.waitForSelector('[data-rectification-module="approve"]');
      const routing = await readStoredRectificationRouting(page, id);
      assert.equal(routing.last?.nextNode, nextNode);
      assert.equal(routing.last?.assignee, actor);
      assert.equal(routing.approval?.["审批人"], actor);
      assert.equal(routing.assignment?.assignee, actor);
    }

    assert.equal(errors.length, 0, `浏览器错误：${errors.join(" | ")}`);
    console.log(JSON.stringify({ ok:true, checks:["列表申请时间与计划完成时间顺序", "计划完成时间空值占位", "草稿提交进入问题待审核", "问题审核退回问题待提交", "创建提交选择发起部门审批人员", "整改方案提交选择整改部门审批人员", "整改结果提交选择整改部门审批人员", "方案初审选择发起部门审批人员", "结果初审选择发起部门审批人员", "选择结果写入路由记录、审批字段与工单池", "整改创建提交返回创建列表", "整改处理提交返回处理列表", "整改审批提交返回审批列表", "详情页关闭", "原列表状态保留"], browserErrors:errors }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exit(1);
});
