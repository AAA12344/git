"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");
const root = path.resolve(__dirname, "..");
const browserExecutable = findBrowserExecutable();
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png" };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end("Not found");
  response.writeHead(200, { "Content-Type":mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});
function assert(condition, message) { if (!condition) throw new Error(message); }
async function freshPage(browser, port, options = {}) {
  const context = await browser.newContext({ viewport:{ width:1600, height:1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  if (options.omitTransferLetterTicketId) {
    await page.route("**/data/prototype-data.runtime.js", async route => {
      const response = await route.fetch();
      const body = await response.text() + `\ndelete window.XIB_PROTOTYPE_CONFIG.seedData.documentData.tickets[${JSON.stringify(options.omitTransferLetterTicketId)}].fields.entry["转送函号"];`;
      await route.fulfill({ response, body });
    });
  }
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:"domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("xib-role", "developer"); localStorage.setItem("xib-role-profile", "development-developer"); });
  await page.reload({ waitUntil:"domcontentloaded" });
  return { context, page, errors };
}
async function openSupplement(page, id) {
  await page.click("[data-page='subprocess-manage']");
  await page.waitForSelector(".subprocess-list-table");
  const row = page.locator(".subprocess-list-table tr", { hasText:id });
  assert(await row.locator('[data-action="supplement-subprocess"]').count() === 1, `${id} 缺少补录操作`);
  await row.locator('[data-action="supplement-subprocess"]').click();
  await page.waitForSelector(".subprocess-detail-page");
  assert(await page.locator('[data-subprocess-detail-tab="补录信息"]').count() === 0, "补录仍使用独立页签");
  const hasProcessingTab = await page.locator('[data-subprocess-detail-tab="\u5904\u7406\u4fe1\u606f"]').count();
  if (hasProcessingTab) assert(await page.locator('[data-subprocess-detail-tab="\u5904\u7406\u4fe1\u606f"].is-active').count() === 1, "supplement for process subprocess should land on processing tab");
  else assert(await page.locator('[data-subprocess-detail-tab="\u57fa\u672c\u4fe1\u606f"].is-active').count() === 1, "supplement for no-process subprocess should land on basic tab");
  await page.waitForSelector("#section-subprocess-supplement");
  const copyBeforeSupplement = await page.locator(".detail-sections").evaluate(container => {
    const children = [...container.children];
    const copyIndex = children.findIndex(child => child.classList.contains("subprocess-copy-section"));
    const supplementIndex = children.findIndex(child => child.id === "section-subprocess-supplement");
    return copyIndex >= 0 && supplementIndex === copyIndex + 1;
  });
  if (!hasProcessingTab) assert(copyBeforeSupplement, "抄送人应位于基本信息页签末端并紧邻补录信息之前");
  assert(await page.locator('[data-field-key^="subprocess-processing."]:not(:disabled)').count() === 0, "补录阶段仍可编辑原处理字段");
}
async function chooseCustomSelect(page, fieldKey, value) {
  const input = page.locator(`[data-field-key="${fieldKey}"]`);
  const host = input.locator("xpath=..");
  await host.locator(".di-select-trigger").click();
  await host.locator(`[data-select-value="${value}"]`).click();
}

async function openSubprocessFormWithTicket(page, ticketId) {
  await page.click("[data-page='subprocess-create']");
  await page.click("[data-page='subprocess-form']");
  await page.click('[data-action="search-related-ticket"]');
  await page.locator(`input[name="related-ticket-result"][value="${ticketId}"]`).check();
  await page.click("#modal-confirm");
  await page.waitForFunction(id => document.querySelector('input[name="related-event"]')?.value === id, ticketId);
}

async function testExclusionWorkbenchAndReadonlyFields(browser, port) {
  const { context, page, errors } = await freshPage(browser, port, { omitTransferLetterTicketId:"TS202607230012" });
  try {
    await page.click("[data-page='subprocess-manage']");
    await page.waitForSelector(".subprocess-list-table");
    const row = page.locator(".subprocess-list-table tbody tr", { hasText:"TC202608010013" });
    assert(await row.count() === 1, "子单处理-我的工作台-待办缺少处理中的剔除申请样例");
    assert((await row.innerText()).includes("处理中"), "剔除申请待办样例状态不是处理中");

    await openSubprocessFormWithTicket(page, "TS202607230012");
    const exclusionType = page.locator('[data-subprocess-type="剔除申请"]');
    await exclusionType.click({ force:true });
    await page.waitForTimeout(150);
    assert((await exclusionType.getAttribute("class") || "").includes("is-active"), "当前工单未激活剔除申请类型：" + JSON.stringify(await exclusionType.evaluate(node => ({ disabled:node.disabled, text:node.innerText }))));
    const exclusionExpected = {
      "关联转送函号": "-",
      "客户姓名": "陈晓敏",
      "投诉内容": "贷款协商还款"
    };
    for (const [name, expected] of Object.entries(exclusionExpected)) {
      const field = page.locator(`[data-field-key="subprocess-base.剔除申请.${name}"]`);
      assert(await field.count() === 1, `剔除申请缺少${name}`);
      assert(await field.isDisabled(), `剔除申请${name}应置灰且不可修改`);
      assert((await field.inputValue()).trim() === expected, `剔除申请${name}未按关联主单回显，期望：${expected}`);
    }

    await openSubprocessFormWithTicket(page, "TS202608020013");
    const abnormalType = page.locator('[data-subprocess-type="异常投诉"]');
    await abnormalType.click({ force:true });
    await page.waitForTimeout(150);
    const abnormalExpected = {
      "关联转送函号": "YZTS202608020013",
      "客户姓名": "黄先生",
      "投诉内容": "贷款催收"
    };
    for (const [name, expected] of Object.entries(abnormalExpected)) {
      const field = page.locator(`[data-field-key="subprocess-base.异常投诉.${name}"]`);
      assert(await field.count() === 1, `异常投诉缺少${name}`);
      assert(await field.isDisabled(), `异常投诉${name}应置灰且不可修改`);
      assert((await field.inputValue()).trim() === expected, `异常投诉${name}未按关联主单回显，期望：${expected}`);
    }
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }
}

async function testResolutionAmountStep(browser, port) {
  const { context, page, errors } = await freshPage(browser, port);
  try {
    await openSubprocessFormWithTicket(page, "TS202607230012");
    await page.locator('[data-subprocess-type="纠纷化解"]').click({ force:true });
    await page.waitForTimeout(150);
    const amount = page.locator('[data-field-key="subprocess.纠纷化解.化解金额"]');
    assert(await amount.getAttribute("step") === "1", "化解金额步进值不是1");
    assert(await amount.getAttribute("min") === "0", "化解金额最小值不是0");
    await amount.fill("0");
    await amount.evaluate(input => input.stepUp());
    assert(await amount.inputValue() === "1", "化解金额向上步进一次后不是1");
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }
}
async function testExtension(browser, port) {
  const { context, page, errors } = await freshPage(browser, port);
  try {
    await openSupplement(page, "YC202607310021");
    assert(await page.locator(".supplement-contact-table tbody tr").count() >= 2, "延长申请未展示完整联系记录模块");
    assert(!(await page.locator(".supplement-contact-table thead").innerText()).includes("选择"), "延长申请联系记录仍显示选择列");
    assert(await page.locator(".supplement-contact-table [data-supplement-contact-select]").count() === 0, "延长申请联系记录仍显示单选框");
    const extensionSupplementBeforeEnable = await page.locator("#section-subprocess-supplement").elementHandle();
    await chooseCustomSelect(page, "supplement.YC202607310021.是否告知延期", "是");
    await page.waitForFunction(section => !section?.isConnected, extensionSupplementBeforeEnable);
    await chooseCustomSelect(page, "supplement.YC202607310021.告知延期时间", "2026-07-16 15:46:00");
    await page.waitForFunction(() => document.querySelector('[data-field-key="supplement.YC202607310021.告知延期时间"]')?.value === "2026-07-16 15:46:00");
    await page.waitForFunction(() => document.querySelector('[data-field-key="supplement.YC202607310021.告知延期方式"]')?.value === "短信沟通");
    const noticeMethod = await page.locator('[data-field-key="supplement.YC202607310021.告知延期方式"]').inputValue();
    assert(noticeMethod === "短信沟通", `告知延期方式未按联系记录自动回填，实际值：${noticeMethod}`);
    assert(await page.locator('[data-field-key="supplement.YC202607310021.告知延期时间"]:disabled').count() === 0, "选择“是”后告知延期时间不应置灰");
    await chooseCustomSelect(page, "supplement.YC202607310021.是否告知延期", "否");
    await page.waitForFunction(() => document.querySelector('[data-field-key="supplement.YC202607310021.告知延期时间"]')?.closest(".form-item")?.querySelector(".di-select-trigger")?.disabled === true);
    assert(await page.locator('[data-field-key="supplement.YC202607310021.告知延期时间"]').locator("xpath=..").locator(".di-select-trigger:disabled").count() === 1, "选择“否”后告知延期时间应置灰");
    assert(await page.locator('[data-field-key="supplement.YC202607310021.告知延期方式"]:disabled').count() === 1, "选择“否”后告知延期方式应置灰");
    await page.click('[data-action="submit-subprocess-supplement"]');
    await page.waitForSelector("#modal-confirm");
    await page.click("#modal-confirm");
    await page.waitForSelector(".subprocess-list-table");
    assert(await page.locator(".subprocess-list-table tr", { hasText:"YC202607310021" }).count() === 0, "延长申请提交补录后未办结并退出待办");
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }
}
async function testResultType(browser, port, id, expectedOptions, fieldName) {
  const { context, page, errors } = await freshPage(browser, port);
  try {
    await openSupplement(page, id);
    const radioChoices = page.locator("#section-subprocess-supplement [data-radio-value]");
    const selectChoices = page.locator("#section-subprocess-supplement [data-select-value]");
    const choices = await (await radioChoices.count() ? radioChoices : selectChoices).allInnerTexts();
    assert(JSON.stringify(choices.map(value => value.trim())) === JSON.stringify(expectedOptions), `${id} 补录字典不正确：${choices}`);
    if (await radioChoices.count()) await page.locator(`#section-subprocess-supplement [data-radio-value="${expectedOptions[0]}"]`).click();
    else await chooseCustomSelect(page, `supplement.${id}.${fieldName}`, expectedOptions[0]);
    assert((await page.locator(`[data-field-key="supplement.${id}.${fieldName}"]`).inputValue()) === expectedOptions[0], `${fieldName} 未写入`);
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }
}
async function testApprovalVisibility(browser, port) {
  const { context, page, errors } = await freshPage(browser, port);
  try {
    await page.click("[data-page='my-approvals']");
    await page.click("[data-approval-tab='子流程审批']");
    await page.waitForFunction(() => document.querySelector("[data-approval-tab='子流程审批']")?.classList.contains("is-active"));
    const row = page.locator(".approval-table tbody tr", { hasText:"DC202607240019" });
    assert(await row.locator('[data-action="approve"]').count() === 1, "确定的子流程审批样例缺少审批入口");
    await row.locator('[data-action="approve"]').click();
    await page.waitForSelector(".subprocess-detail-page");
    assert(await page.locator('[data-subprocess-detail-tab="处理信息"].is-active').count() === 1, "审批入口未直接定位到处理信息");
    await page.waitForSelector("#section-approval");
    assert(await page.locator("#section-approval").count() === 1 && await page.locator('[data-action="submit-approval"]').count() === 1, "子单处理信息末尾缺少唯一审批表单");
    const isLast = await page.locator(".detail-sections").evaluate(container => container.lastElementChild?.id === "section-approval");
    assert(isLast, "子单审批表单不是处理信息最后一个分区");
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }
}
async function testReviewAndFieldTable(browser, port) {
  const first = await freshPage(browser, port);
  try {
    await first.page.click("[data-page='my-approvals']");
    await first.page.click("[data-approval-tab='子流程审批']");
    await first.page.waitForFunction(() => document.querySelector("[data-approval-tab='子流程审批']")?.classList.contains("is-active"));
    const reviewRow = first.page.locator(".approval-table tbody tr", { hasText:"CX202608030001" });
    assert(await reviewRow.locator('[data-action="approve"]').count() === 1, "撤销投诉客服渠道样例缺少复核入口");
    assert((await reviewRow.innerText()).includes("复核"), "撤销投诉客服渠道样例未展示复核节点");
    await reviewRow.locator('[data-action="approve"]').click();
    await first.page.waitForSelector("#section-approval");
    assert((await first.page.locator("#section-approval").innerText()).includes("复核信息"), "复核表单未显示在处理信息末尾");
    await first.page.click('[data-action="submit-approval"]');
    await first.page.waitForSelector(".approval-table");
    assert(await first.page.locator(".approval-table tbody tr", { hasText:"CX202608030001" }).count() === 0, "撤销投诉复核通过后未直接办结");
    assert(first.errors.length === 0, first.errors.join(" | "));
  } finally { await first.context.close(); }

  const second = await freshPage(browser, port);
  try {
    await second.page.click("[data-page='subprocess-create']");
    await second.page.click("[data-page='subprocess-form']");
    await second.page.click('[data-action="search-related-ticket"]');
    const repeatTicketId = await second.page.evaluate(() => Object.keys(window.XIB_PROTOTYPE_CONFIG.seedData.runtimeDefaults?.repeatRelations || {})[0] || "");
    assert(repeatTicketId, "测试数据缺少再次投诉单关系");
    assert(await second.page.locator('input[name="related-ticket-result"][value="' + repeatTicketId + '"]').count() === 0, "再次投诉单不应出现在查询关联工单列表");
    await second.page.locator('[data-query-filter="id"]').fill("TS-NOT-FOUND");
    await second.page.locator("[data-query-submit]").click();
    await second.page.waitForSelector(".query-result-table [data-empty-state]");
    assert((await second.page.locator(".query-result-table [data-empty-state]").innerText()).includes("暂无数据"), "关联工单查询零结果未显示空状态");
    await second.page.locator('[data-query-filter="id"]').fill("TS202607230012");
    await second.page.locator("[data-query-submit]").click();
    await second.page.locator('input[name="related-ticket-result"][value="TS202607230012"]').check();
    await second.page.click("#modal-confirm");
    await second.page.waitForFunction(() => document.querySelector('input[name="related-event"]')?.value === "TS202607230012");
    await second.page.locator('[data-subprocess-type="异常投诉"]').click();
    await second.page.waitForFunction(() => document.querySelector('[data-subprocess-type="异常投诉"]')?.classList.contains("is-active"));
    for (const field of ["关联转送函号", "客户姓名", "投诉机构", "客户投诉时间", "投诉内容"]) {
      const count = await second.page.locator('[data-field-key="subprocess-base.异常投诉.' + field + '"]').count();
      if (count !== 1) {
        const keys = await second.page.locator('#section-subprocess-basic [data-field-key]').evaluateAll(nodes => nodes.map(node => node.dataset.fieldKey));
        const activeType = await second.page.locator('[data-subprocess-type].is-active').allInnerTexts();
        const typeButton = second.page.locator('button[data-subprocess-type="异常投诉"]');
        const typeState = await typeButton.count() ? await typeButton.evaluate(node => ({ disabled:node.disabled, text:node.innerText, className:node.className })) : {};
        const sourceId = await second.page.locator('input[name="related-event"]').inputValue();
        throw new Error("异常投诉基础信息缺少字段：" + field + "；当前类型=" + activeType.join("/") + "；基础字段=" + keys.join(",") + "；关联=" + sourceId + "；类型按钮=" + JSON.stringify(typeState));
      }
    }
    assert(await second.page.locator('[data-field-key="subprocess.\u5f02\u5e38\u6295\u8bc9.\u5f02\u5e38\u6295\u8bc9\u7c7b\u578b"]').count() === 1, "anomaly classification fields should appear on create page");
    await second.page.locator('[data-action="demo-fill-subprocess"]').click();
    assert((await second.page.locator('[data-subprocess-type="异常投诉"]').getAttribute("class")).includes("is-active"), "一键填写 Demo 后子单类型被覆盖");
    await second.page.waitForFunction(() => document.querySelector('[data-field-key="subprocess.异常投诉.异常投诉认定依据"]')?.value.includes("多渠道重复提交"));
    assert((await second.page.locator('[data-field-key="subprocess.异常投诉.异常投诉认定依据"]').inputValue()).includes("多渠道重复提交"), "异常投诉 Demo 未按当前子单类型填写差异内容");
    const createTemplateLink = second.page.locator('.subprocess-form-page [data-field-name="异常投诉识别情况报告"] [data-form-template-download]');
    assert(await createTemplateLink.count() === 1, "子单创建入口缺少异常投诉识别情况报告模板下载按钮");
    assert((await createTemplateLink.innerText()).trim() === "下载模板", "子单创建入口模板按钮文案必须为下载模板");
    assert(decodeURIComponent(await createTemplateLink.getAttribute("href")) === "templates/异常投诉识别情况报告.docx", "子单创建入口模板下载地址错误");
    assert(await createTemplateLink.getAttribute("download") === "异常投诉识别情况报告.docx", "子单创建入口模板下载文件名错误");
    await second.page.click("[data-page='subprocess-manage']");
    await second.page.waitForSelector(".subprocess-list-table");
    assert(await second.page.locator(".subprocess-list-table tr", { hasText:"DC202607310099" }).count() === 0, "pending investigation should not appear in personal workbench");
    await second.page.click("[data-subprocess-scope='机构工单池']");
    await second.page.waitForFunction(() => document.querySelector("[data-subprocess-scope='机构工单池']")?.classList.contains("is-active"));
    const investigationPageButton = second.page.locator('[data-pagination-scope="subprocess-process"] [data-pagination-page="2"]').last();
    if (await investigationPageButton.count()) {
      await investigationPageButton.click({ force:true });
      await second.page.waitForFunction(() => [...document.querySelectorAll(".subprocess-list-table tbody tr")].some(row => row.textContent.includes("DC202607310099")));
    }
    const processingRow = second.page.locator(".subprocess-list-table tr", { hasText:"DC202607310099" }).first();
    assert(await processingRow.locator('[data-action="process-subprocess"]').count() === 1, "organization-pool investigation sample should have process action");
    await processingRow.locator('[data-action="process-subprocess"]').click({ force:true });
    await second.page.waitForSelector("#subprocess-processing-form");
    assert(await second.page.locator('[data-field-key="subprocess-processing.\u6295\u8bc9\u8c03\u67e5.\u6295\u8bc9\u8c03\u67e5\u7ed3\u679c"]').count() === 1, "investigation result field should load from schema");
    assert(await second.page.locator('[data-field-key="subprocess-processing.\u6295\u8bc9\u8c03\u67e5.\u4fee\u6539\u6295\u8bc9\u6709\u6548\u6027\u8ba4\u5b9a\u7ed3\u8bba"]').count() === 1, "investigation conclusion field should load from schema");
    assert(second.errors.length === 0, second.errors.join(" | "));
  } finally { await second.context.close(); }
}

async function testAbnormalReportQuickTemplate(browser, port) {
  const { context, page, errors } = await freshPage(browser, port);
  try {
    await page.click("[data-page='ticket-process']");
    await page.waitForSelector(".ticket-list-table");
    const ticketRow = page.locator(".ticket-list-table tr", { hasText:"TS202607230012" }).first();
    assert(await ticketRow.locator("[data-action='process']").count() === 1, "快速发起模板测试缺少工单处理入口");
    await ticketRow.locator("[data-action='process']").click();
    await page.waitForSelector("[data-detail-tab='处理信息']");
    await page.click("[data-detail-tab='处理信息']");
    await page.waitForSelector(".linked-subprocess-table");
    const abnormalRow = page.locator('[data-linked-subprocess-type="异常投诉"]').first();
    assert(await abnormalRow.locator('[data-action="quick-subprocess"]').count() === 1, "工单详情缺少异常投诉快速发起入口");
    await abnormalRow.locator('[data-action="quick-subprocess"]').click();
    await page.waitForSelector("#overlay-root .quick-subprocess-form");
    const quickTemplateLink = page.locator('#overlay-root [data-field-name="异常投诉识别情况报告"] [data-form-template-download]');
    assert(await quickTemplateLink.count() === 1, "快速发起悬浮窗缺少异常投诉识别情况报告模板下载按钮");
    assert((await quickTemplateLink.innerText()).trim() === "下载模板", "快速发起悬浮窗模板按钮文案必须为下载模板");
    assert(decodeURIComponent(await quickTemplateLink.getAttribute("href")) === "templates/异常投诉识别情况报告.docx", "快速发起悬浮窗模板下载地址错误");
    assert(await quickTemplateLink.getAttribute("download") === "异常投诉识别情况报告.docx", "快速发起悬浮窗模板下载文件名错误");
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }
}

async function testAdminMaintainedAbnormalReportTemplate(browser, port) {
  const { context, page, errors } = await freshPage(browser, port);
  try {
    await page.evaluate(() => {
      localStorage.setItem("xib-role", "admin");
      localStorage.setItem("xib-org", "technology");
      localStorage.setItem("xib-role-profile", "technology-admin");
    });
    await page.reload({ waitUntil:"domcontentloaded" });
    await page.evaluate(() => document.querySelector("[data-page='admin-form-complaint']").click());
    await page.waitForSelector(".xib-module-admin-form-config");
    let abnormalRow = page.locator(".admin-list-card tbody tr", { hasText:"异常投诉" }).first();
    await abnormalRow.locator('[data-action="admin-form-detail"]').last().click();
    await page.waitForSelector(".admin-template-readonly");
    assert(await page.locator("[data-admin-form-template-input]").count() === 0, "二级管理员不应看到附件模板上传入口");
    assert((await page.locator("main").innerText()).includes("仅超级管理员可维护"), "二级管理员缺少附件模板只读提示");

    await page.evaluate(() => localStorage.setItem("xib-role-profile", "technology-super-admin"));
    await page.reload({ waitUntil:"domcontentloaded" });
    await page.evaluate(() => document.querySelector("[data-page='admin-form-complaint']").click());
    await page.waitForSelector(".xib-module-admin-form-config");
    abnormalRow = page.locator(".admin-list-card tbody tr", { hasText:"异常投诉" }).first();
    await abnormalRow.locator('[data-action="admin-form-detail"]').last().click();
    await page.waitForSelector("[data-admin-form-template-input]", { state:"attached" });
    assert((await page.locator(".admin-template-file-name").innerText()).trim() === "异常投诉识别情况报告.docx", "后台表单配置未展示当前附件模板");

    const nextTemplateName = "异常投诉识别情况报告_2026-08.docx";
    await page.locator("[data-admin-form-template-input]").setInputFiles({
      name: nextTemplateName,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: fs.readFileSync(path.join(root, "templates", "异常投诉识别情况报告.docx"))
    });
    await page.waitForFunction(name => document.querySelector(".admin-template-file-name")?.textContent.trim() === name, nextTemplateName);
    assert((await page.locator(".admin-template-file-meta").innerText()).includes("超级管理员"), "模板更新后未记录维护人");

    await page.evaluate(() => {
      localStorage.setItem("xib-role", "developer");
      localStorage.setItem("xib-org", "development");
      localStorage.setItem("xib-role-profile", "development-developer");
    });
    await page.reload({ waitUntil:"domcontentloaded" });
    await page.click("[data-page='subprocess-create']");
    await page.click("[data-page='subprocess-form']");
    await page.click('[data-action="search-related-ticket"]');
    await page.locator('input[name="related-ticket-result"][value="TS202607230012"]').check();
    await page.click("#modal-confirm");
    await page.waitForFunction(() => document.querySelector('input[name="related-event"]')?.value === "TS202607230012");
    await page.locator('[data-subprocess-type="异常投诉"]').click();
    const templateLink = page.locator('.subprocess-form-page [data-field-name="异常投诉识别情况报告"] [data-form-template-download]');
    await templateLink.waitFor();
    assert(await templateLink.getAttribute("download") === nextTemplateName, "处理员页面未使用后台维护后的模板文件名");
    assert((await templateLink.getAttribute("href")).startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,"), "处理员页面未下载后台维护后的模板内容");
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }
}

async function testNoProcessingStage(browser, port) {
  const { context, page, errors } = await freshPage(browser, port);
  try {
    await page.click("[data-page='subprocess-manage']");
    await page.waitForSelector(".subprocess-list-table");
    await page.click("[data-subprocess-scope='机构工单池']");
    await page.waitForFunction(() => document.querySelector(".subprocess-list-table")?.textContent.includes("FZ202607310004"));
    const manageRow = page.locator(".subprocess-list-table tr", { hasText:"FZ202607310004" });
    assert(await manageRow.locator('[data-action="process-subprocess"]').count() === 0, "无处理阶段子流程不应显示处理操作");
    await manageRow.locator('[data-action="subprocess-detail"]').click();
    await page.waitForSelector(".subprocess-detail-page");
    assert(await page.locator('[data-subprocess-detail-tab="\u5904\u7406\u4fe1\u606f"]').count() === 0, "无处理阶段子流程仍展示处理页签");
    assert(await page.locator('[data-subprocess-detail-tab="\u57fa\u672c\u4fe1\u606f"].is-active').count() === 1, "无处理阶段子流程详情应停留在基本信息页签");
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }

  const approval = await freshPage(browser, port);
  try {
    await approval.page.click("[data-page='my-approvals']");
    await approval.page.click("[data-approval-tab='\u5b50\u6d41\u7a0b\u5ba1\u6279']");
    await approval.page.waitForFunction(() => document.querySelector("[data-approval-tab=\'\u5b50\u6d41\u7a0b\u5ba1\u6279\']")?.classList.contains("is-active"));
    const row = approval.page.locator(".approval-table tbody tr", { hasText:"WZ202607270005" });
    assert(await row.locator('[data-action="approve"]').count() === 1, "accountability should have approval action");
    await row.locator('[data-action="approve"]').click();
    await approval.page.waitForSelector(".subprocess-detail-page");
    assert(await approval.page.locator('[data-subprocess-detail-tab="\u5904\u7406\u4fe1\u606f"]').count() === 0, "人工触发投诉问责不应展示处理页签");
    assert(await approval.page.locator('[data-subprocess-detail-tab="\u57fa\u672c\u4fe1\u606f"].is-active').count() === 1, "人工触发投诉问责审批应停留在基本信息页签");
    assert((await approval.page.locator(".subprocess-detail-page").innerText()).includes("人工触发"), "人工触发投诉问责未展示只读触发方式");
    await approval.page.waitForSelector("#section-approval");
    const isLast = await approval.page.locator(".detail-sections").evaluate(container => container.lastElementChild?.id === "section-approval");
    assert(isLast, "approval section should be last in basic tab for no-process subprocess");
    assert(approval.errors.length === 0, approval.errors.join(" | "));
  } finally { await approval.context.close(); }

  const automatic = await freshPage(browser, port);
  try {
    await automatic.page.click("[data-page='subprocess-manage']");
    await automatic.page.waitForSelector(".subprocess-list-table");
    await automatic.page.click("[data-subprocess-scope='我的工作台']");
    const processingRow = automatic.page.locator(".subprocess-list-table tr", { hasText:"WZ202608090202" });
    assert(await processingRow.locator('[data-action="process-subprocess"]').count() === 1, "系统自动触发处理中的投诉问责应进入我的工作台并提供处理操作");
    await processingRow.locator('[data-action="process-subprocess"]').click();
    await automatic.page.waitForSelector(".subprocess-detail-page");
    assert(await automatic.page.locator('[data-subprocess-detail-tab="\u5904\u7406\u4fe1\u606f"].is-active').count() === 1, "系统自动触发投诉问责应进入处理信息页签");
    assert((await automatic.page.locator(".subprocess-detail-page").innerText()).includes("投诉问责处理"), "系统自动触发投诉问责缺少处理区块");
    await automatic.page.click('[data-subprocess-detail-tab="\u57fa\u672c\u4fe1\u606f"]');
    await automatic.page.waitForFunction(() => document.querySelector('[data-subprocess-detail-tab="基本信息"]')?.classList.contains("is-active"));
    const automaticBasicText = await automatic.page.locator(".subprocess-detail-page").innerText();
    assert(automaticBasicText.includes("系统自动触发"), "系统自动触发投诉问责未展示只读触发方式：" + automaticBasicText);
    assert(automatic.errors.length === 0, automatic.errors.join(" | "));
  } finally { await automatic.context.close(); }
}

async function testRequiredUploadSubmission(browser, port, type) {
  const { context, page, errors } = await freshPage(browser, port);
  try {
    await page.click("[data-page='subprocess-create']");
    await page.click("[data-page='subprocess-form']");
    await page.click('[data-action="search-related-ticket"]');
    await page.locator('input[name="related-ticket-result"][value="TS202607230012"]').check();
    await page.click("#modal-confirm");
    await page.waitForFunction(() => document.querySelector('input[name="related-event"]')?.value === "TS202607230012");
    await page.locator('[data-subprocess-type="' + type + '"]').click();
    await page.click('[data-action="demo-fill-subprocess"]');
    const requiredUpload = type === "异常投诉" ? "异常投诉识别情况报告" : "调解协议";
    const uploadInput = page.locator('[data-drag-upload][data-field-key="subprocess.' + type + '.' + requiredUpload + '"] [data-upload-input]');
    await uploadInput.setInputFiles({ name:requiredUpload + ".pdf", mimeType:"application/pdf", buffer:Buffer.from("prototype upload") });
    await page.waitForFunction(({ type, field }) => Boolean(document.querySelector('[data-drag-upload][data-field-key="subprocess.' + type + '.' + field + '"]')?.classList.contains("has-file")), { type, field:requiredUpload });
    await page.click('[data-action="submit-subprocess"]');
    await page.waitForSelector("#modal-confirm");
    assert(!(await page.locator(".toast").allInnerTexts()).some(text => text.includes("必填子流程字段未完成")), type + " 的必填上传字段仍被误判为空");
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }
}

async function testCorrectionComplaintRequestIsEditable(browser, port) {
  const { context, page, errors } = await freshPage(browser, port);
  try {
    await openSubprocessFormWithTicket(page, "TS202501100201");
    await page.locator('[data-subprocess-type="投诉校正"]').click();
    const request = page.locator('[data-field-key="subprocess.投诉校正.投诉请求"]');
    await request.waitFor();
    assert(await request.isEnabled(), "投诉校正的投诉请求应允许编辑");
    assert((await request.inputValue()) === "退还相关费用并书面说明", "后续投诉校正的投诉请求应从关联主单最新校正值带入");
    await page.click('[data-action="demo-fill-subprocess"]');
    await request.fill("");
    await page.click('[data-action="submit-subprocess"]');
    assert(await request.evaluate(element => element.classList.contains("is-error")), "投诉校正的投诉请求为空时应阻止提交");
    await request.fill("申请调整投诉诉求分类");
    await page.click('[data-action="save-subprocess-draft"]');
    await page.waitForSelector(".subprocess-list-table");
    const createdDraftId = await page.evaluate(() => {
      const storageVersion = window.XIB_PROTOTYPE_CONFIG.seedData.meta.storageVersion;
      const saved = JSON.parse(localStorage.getItem(`xib-prototype-state-v${storageVersion}`) || "null");
      return Object.entries(saved?.documentData?.subprocesses || {}).find(([, document]) => document?.fields?.entry?.["投诉请求"] === "申请调整投诉诉求分类")?.[0] || "";
    });
    assert(createdDraftId, "投诉校正草稿未写入本地持久化存储");
    await page.reload({ waitUntil:"domcontentloaded" });
    const persistedRequest = await page.evaluate(id => {
      const storageVersion = window.XIB_PROTOTYPE_CONFIG.seedData.meta.storageVersion;
      const saved = JSON.parse(localStorage.getItem(`xib-prototype-state-v${storageVersion}`) || "null");
      return saved?.documentData?.subprocesses?.[id]?.fields?.entry?.["投诉请求"] || "";
    }, createdDraftId);
    assert(persistedRequest === "申请调整投诉诉求分类", "投诉校正草稿刷新后应保留修改后的投诉请求");
    assert(errors.length === 0, errors.join(" | "));
  } finally { await context.close(); }
}

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch(browserExecutable ? { headless:true, executablePath:browserExecutable } : { headless:true });
  try {
    await testExtension(browser, port);
    await testResultType(browser, port, "YT202607300010", ["认定成功", "认定失败"], "异常认定结果");
    await testResultType(browser, port, "TC202607260012", ["剔除成功", "剔除失败"], "剔除认定结果");
    await testApprovalVisibility(browser, port);
    await testReviewAndFieldTable(browser, port);
    await testExclusionWorkbenchAndReadonlyFields(browser, port);
    await testResolutionAmountStep(browser, port);
    await testAbnormalReportQuickTemplate(browser, port);
    await testNoProcessingStage(browser, port);
    await testRequiredUploadSubmission(browser, port, "异常投诉");
    await testRequiredUploadSubmission(browser, port, "纠纷化解");
    await testCorrectionComplaintRequestIsEditable(browser, port);
    console.log("Subprocess workflow passed: field-table linkage, review routing, approval placement, and supplement controls");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack || error.message); server.close(); process.exit(1); });

