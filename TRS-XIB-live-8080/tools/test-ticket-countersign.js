"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const browserExecutable = findBrowserExecutable();
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openFreshDeveloperPage(browser, port) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("xib-role", "developer");
    localStorage.setItem("xib-role-profile", "development-developer");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-page='ticket-process']");
  return { context, page, errors };
}

async function verifyComplaintObjectAvoidance(browser, port) {
  const { context, page, errors } = await openFreshDeveloperPage(browser, port);
  try {
    await page.evaluate(() => {
      const seed = structuredClone(window.XIB_PROTOTYPE_CONFIG.seedData);
      const version = Number(seed.meta.storageVersion);
      seed.documentData.tickets.TS202607230012.fields.entry["投诉对象"] = "陈敏慧-60157";
      localStorage.setItem(`xib-prototype-state-v${version}`, JSON.stringify({ version, documentData:seed.documentData }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.click("[data-page='ticket-process']");
    await page.waitForSelector(".ticket-list-table");
    const row = page.locator(".ticket-list-table tr", { hasText: "TS202607230012" });
    await row.locator("[data-action='process']").click();
    await page.click("[data-detail-tab='处理信息']");
    await page.waitForSelector("#processing-form-main");
    await page.click("[data-action='demo-fill-processing']");
    await page.locator('.form-item', { has: page.locator('input[data-field-key$=".是否会签"]') }).locator('[data-radio-value="否"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll("#processing-form-main .form-label.required")].every(label => {
      const control = label.parentElement.querySelector("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)");
      return !control || Boolean(control.value);
    }));
    await page.click("[data-action='submit-processing']");
    await page.waitForTimeout(200);
    const toastTexts = await page.locator(".toast").allInnerTexts();
    assert(toastTexts.some(text => text.includes("投诉对象与当前处理员存在回避关系")), `投诉对象回避校验未生效：${toastTexts.join(" | ")}`);
    assert(await page.locator("#modal-confirm").count() === 0, "投诉对象命中回避校验后仍打开提交确认框");
    assert(errors.length === 0, `投诉对象回避校验出现浏览器错误：${errors.join(" | ")}`);
  } finally {
    await context.close();
  }
}

async function submitComplaintProcessing(browser, port, countersignChoice, expectedStatus) {
  const { context, page, errors } = await openFreshDeveloperPage(browser, port);
  try {
    await page.click("[data-page='ticket-process']");
    await page.waitForSelector(".ticket-list-table");
    const row = page.locator(".ticket-list-table tr", { hasText: "TS202607230012" });
    assert((await row.locator("td").nth(2).locator(".ticket-type-with-kind > span").first().innerText()).trim() === "投诉单", "会签分支测试样例必须是投诉单");
    await row.locator("[data-action='process']").click();
    await page.waitForSelector("[data-detail-tab='处理信息']");
    assert(await page.locator('[data-ticket-detail-section="content"] .form-item[data-field-name="投诉对象"], .complaint-object-detail-item').count() === 0, "基本信息仍显示旧投诉对象编辑入口");
    await page.click("[data-detail-tab='处理信息']");
    await page.waitForSelector("#processing-form-main");

    assert(await page.locator('#section-processing-result .form-item[data-field-name="投诉对象"]').count() === 0, "处理结果仍显示投诉对象");

    const field = page.locator(".form-item", { has: page.locator('input[data-field-key$=".是否会签"]') });
    assert(await field.count() === 1, "投诉单处理表单缺少‘是否会签’字段");
    assert(await field.locator(".form-label.required").count() === 1, "‘是否会签’必须由处理员必选");
    assert((await field.locator('input[type="hidden"]').inputValue()) === "", "‘是否会签’不应预设默认答案");

    await page.click("[data-action='demo-fill-processing']");
    await page.waitForSelector("#processing-form-main");
    const refreshedField = page.locator(".form-item", { has: page.locator('input[data-field-key$=".是否会签"]') });
    await refreshedField.locator(`[data-radio-value='${countersignChoice}']`).click();
    assert((await page.locator('[data-field-key$=".是否会签"]').inputValue()) === countersignChoice, "会签选择未写入处理表单");
    assert(await page.locator("#section-processing-countersign").count() === 1, "处理信息缺少独立的会签信息分区");
    assert(await page.locator('#section-processing-result .form-item[data-field-name="是否会签"]').count() === 0, "是否会签仍混在处理结果分区");
    const departmentField = page.locator('.form-item[data-field-name="会签机构"]');
    const countersignDepartmentField = page.locator('.form-item[data-field-name="会签部门"]');
    await page.waitForFunction(expected => document.querySelectorAll('.form-item[data-field-name="会签机构"]').length === expected, countersignChoice === "是" ? 1 : 0);
    assert((await departmentField.count()) === (countersignChoice === "是" ? 1 : 0), "会签机构显隐未跟随是否会签");
    assert((await countersignDepartmentField.count()) === (countersignChoice === "是" ? 1 : 0), "会签部门显隐未跟随是否会签");
    if (countersignChoice === "是") {
      assert(await departmentField.locator(".form-label.required").count() === 1, "选择会签后会签机构必须条件必填");
      assert((await departmentField.locator('[data-multiple="true"][data-dictionary="institutionTree"]').count()) === 1, "会签机构必须使用机构业务字典的多选级联控件");
      await departmentField.locator(".di-hierarchy-cascader-trigger").click();
      assert(await departmentField.locator(".risk-cascade-column").count() === 2, "会签机构未呈现机构/下辖机构两级业务树");
      assert(await departmentField.locator(".risk-cascade-column").first().locator("button").count() > 4, "会签机构未加载完整机构业务字典");
      const selectedOrganizations = await departmentField.locator(".hierarchy-selected-tag").allInnerTexts();
      assert(selectedOrganizations.some(value => value.includes("总行")) && selectedOrganizations.some(value => value.includes("上海分行")), "会签机构样例未覆盖总行与分行");
      const institutionSummary = departmentField.locator(".countersign-value-summary");
      const institutionLabels = await institutionSummary.locator(".countersign-value-chip").allInnerTexts();
      assert(institutionLabels.some(value => value.includes("总行")) && institutionLabels.some(value => value.includes("上海分行")), "会签机构未回显全部已选机构名称标签");
      assert(await institutionSummary.evaluate(node => getComputedStyle(node).flexWrap === "wrap"), "会签机构名称标签未启用自动换行");
      assert(await countersignDepartmentField.locator("[data-countersign-department-select]").count() === 1, "会签部门未使用机构联动多选框");
      const departmentOptions = await countersignDepartmentField.locator(".countersign-department-option").allTextContents();
      assert(departmentOptions.some(option => option.includes("总行")) && departmentOptions.some(option => option.includes("上海分行")), "会签部门候选未按已选机构汇总生成");
      const departmentSummary = countersignDepartmentField.locator(".countersign-value-summary");
      const departmentLabels = await departmentSummary.locator(".countersign-value-chip").allInnerTexts();
      assert(departmentLabels.some(value => value.includes("总行")) && departmentLabels.some(value => value.includes("上海分行")), "会签部门未回显全部已选部门名称标签");
      assert(await departmentSummary.evaluate(node => getComputedStyle(node).flexWrap === "wrap"), "会签部门名称标签未启用自动换行");
      assert(!departmentOptions.includes("请先选择会签机构"), "会签部门下拉框不应在已选择机构后保留等待提示");
      await departmentField.locator('[data-hierarchy-parent="厦门分行"]').click();
      await departmentField.locator('[data-hierarchy-toggle="厦门分行 / 厦门湖里支行"]').click();
      await page.waitForFunction(() => [...document.querySelectorAll('.form-item[data-field-name="会签部门"] .countersign-department-option')].some(option => option.textContent.includes("厦门湖里支行")));
      assert((await countersignDepartmentField.locator(".countersign-department-option").allTextContents()).some(option => option.includes("厦门湖里支行")), "会签机构变化后会签部门候选未同步刷新");
      await countersignDepartmentField.locator("[data-countersign-department-trigger]").click();
      const newDepartmentOption = countersignDepartmentField.locator(".countersign-department-option", { hasText:"厦门湖里支行" }).first();
      await newDepartmentOption.locator('input[type="checkbox"]').check();
      assert((await departmentSummary.locator(".countersign-value-chip").allInnerTexts()).some(value => value.includes("厦门湖里支行")), "会签机构变化后的新部门无法选择并回显");
      await departmentField.locator("[data-hierarchy-confirm]").click();
    }
    await page.waitForFunction(() => [...document.querySelectorAll("#processing-form-main .form-label.required")].every(label => {
      const control = label.parentElement.querySelector("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)");
      return !control || Boolean(control.value);
    }));
    await page.waitForTimeout(100);

    await page.click("[data-action='submit-processing']");
    await page.waitForTimeout(500);
    if (await page.locator("#modal-confirm").count() === 0) {
      const debug = await page.evaluate(() => ({
        toasts: [...document.querySelectorAll(".toast")].map(node => node.textContent.trim()),
        route: location.hash,
        required: [...document.querySelectorAll("#processing-form-main .form-label.required")].map(label => {
          const control = label.parentElement.querySelector("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)");
          return { label: label.textContent.trim(), value: control?.value || "", type: control?.type || "missing" };
        }).filter(item => !item.value)
      }));
      throw new Error("提交处理结果未打开确认框：" + JSON.stringify(debug));
    }
    await page.waitForSelector("#modal-confirm");
    const modalText = await page.locator(".modal").innerText();
    assert(modalText.includes(countersignChoice === "是" ? "工单会签" : "工单审批"), "提交确认未展示正确的下一节点");
    await page.click("#modal-confirm");
    await page.waitForSelector(".ticket-list-table");
    await page.evaluate(() => document.querySelector("[data-process-tab='全部']")?.click());
    await page.waitForFunction(() => document.querySelector(".ticket-list-table")?.textContent.includes("TS202607230012"));
    const updatedRow = page.locator(".ticket-list-table tr", { hasText: "TS202607230012" });
    const updatedStatus = (await updatedRow.locator("[data-flow-status]").innerText()).trim();
    assert(updatedStatus === expectedStatus, `选择‘${countersignChoice}’后应进入‘${expectedStatus}’，实际为‘${updatedStatus}’`);
    const assertSubmittedInspection = async () => {
      await page.waitForSelector("#section-intelligent-inspection");
      const inspection = page.locator("#section-intelligent-inspection");
      assert((await inspection.getAttribute("data-inspection-submitted-at")) !== "2026-07-20 16:05:00", "处理员再次提交后仍展示旧核查批次");
      const entry = inspection.locator(".approval-inspection-fields>div:first-child");
      assert(await entry.locator('[data-inspection-state="generating"]').count() === 1, "指定工单录入核查应显示生成中");
      const communication = inspection.locator(".approval-inspection-fields>div:nth-child(2)");
      assert(await communication.locator(".approval-inspection-status.is-fail").count() === 1, "多条不合规联系记录只能显示一个总不通过 badge");
      assert(await communication.locator(".approval-inspection-result").count() === 2, "沟通处理核查未按不合规联系记录逐条展示");
      const communicationText = await communication.innerText();
      assert(["不合规记录", "不合规项目"].every(label => communicationText.includes(label)) && !communicationText.includes("一句话结论："), "沟通处理核查字段或一句话结论展示方式不正确");
      const product = inspection.locator(".approval-inspection-fields>div:last-child");
      assert(await product.locator('[data-inspection-state="failed"] [data-inspection-retry="productBusiness"]').count() === 1, "指定工单产品业务核查应显示生成失败及重新生成");
    };
    if (countersignChoice === "是") {
      await page.click("[data-page='my-approvals']");
      await page.waitForSelector(".approval-table");
      await page.locator('[data-pagination-size]').selectOption("50");
      const approvalRow = page.locator(".approval-table tr", { hasText: "TS202607230012" });
      await approvalRow.waitFor();
      assert(await approvalRow.locator("[data-operation-key='initial']", { hasText: "会签" }).count() === 1, "审批管理未在初审操作列显示会签按钮");
      assert(await approvalRow.locator("[data-operation-key='countersign']").count() === 0, "会签仍占用独立操作列");
      await approvalRow.locator("[data-operation-key='initial']", { hasText: "会签" }).click();
      await page.waitForSelector(".approval-detail-page");
      assert(await page.locator("#section-approval").count() === 0, "基础信息栏目不应展示会签意见");
      assert(await page.locator('[data-action="submit-approval"]').count() === 0, "基础信息栏目不应展示提交会签按钮");
      await page.locator('[data-detail-tab="处理信息"]').click();
      await page.waitForSelector(".countersign-opinion-table");
      // 处理员提交后已触发智能核查，会签处理信息继续展示核查结果。
      assert(await page.locator("#section-intelligent-inspection").count() === 1, "会签处理信息应展示已生成的智能核查结果");
      assert(await page.locator("#section-approval .form-section-head", { hasText: "会签意见" }).count() === 1, "审批详情缺少会签意见分区");
      assert(await page.locator(".countersign-opinion-table tbody tr").count() === 1, "会签意见应只展示所选会签人");
      const countersigners = await page.locator(".countersign-opinion-table tbody tr").evaluateAll(rows => rows.map(row => row.dataset.countersignMember));
      assert(new Set(countersigners).size === 1 && countersigners[0], "会签意见未使用所选会签人");
      assert(await page.locator('.countersign-opinion-table [data-current-countersigner="true"] textarea[data-field-key="会签意见"]').count() === 1, "当前会签人没有可编辑的会签意见");
      const currentCountersignRow = page.locator('.countersign-opinion-table [data-current-countersigner="true"]');
      assert(await currentCountersignRow.locator('[data-radio-value="通过"]').count() === 1 && await currentCountersignRow.locator('[data-radio-value="驳回"]').count() === 1, "会签结论字典不是通过/驳回");
      await currentCountersignRow.locator('[data-radio-value="驳回"]').click();
      assert((await currentCountersignRow.locator('[data-approval-opinion]').getAttribute("aria-required")) === "true", "会签驳回时意见未变为必填");
      await currentCountersignRow.locator('[data-radio-value="通过"]').click();
      assert(await page.locator("#section-approval").count() === 1, "会签意见分区重复渲染");
      assert(await page.locator(".approval-bottom-actions").count() === 1, "会签提交栏重复渲染");
      assert(await page.locator('[data-action="submit-approval"]').count() === 1, "提交会签意见按钮重复渲染");
      assert((await page.locator(".detail-summary [data-flow-status]").innerText()).trim() === "会签中", "打开会签时工单未保持会签中");
      await page.locator('[data-action="submit-approval"]').click();
      await page.waitForSelector(".approval-table");
      const postCountersignRow = page.locator(".approval-table tr", { hasText: "TS202607230012" });
      assert((await postCountersignRow.locator('[data-flow-status="待审批"]').count()) === 1, "全部会签结束后工单未进入待审批");
      assert(await postCountersignRow.locator('[data-operation-key="approve"]', { hasText: "审批" }).count() === 1, "待审批工单仍显示为会签操作");
    } else {
      await page.click("[data-page='my-approvals']");
      await page.waitForSelector(".approval-table");
      // 新增审批样例后，扩大分页范围以继续核对指定工单的会签后审批流程。
      await page.locator('[data-pagination-size]').selectOption("50");
      const approvalRow = page.locator(".approval-table tr", { hasText: "TS202607230012" });
      await approvalRow.waitFor();
      assert(await approvalRow.locator('[data-operation-key="approve"]', { hasText: "审批" }).count() === 1, "待审批工单未显示审批操作");
      await approvalRow.locator('[data-operation-key="approve"]', { hasText: "审批" }).click();
      await page.waitForSelector(".approval-detail-page");
      assert((await page.locator(".detail-summary [data-flow-status]").innerText()).trim() === "审批中", "领取审批后工单未进入审批中");
      assert(await page.locator("#section-approval").count() === 0, "基础信息栏目不应展示审批信息");
      assert(await page.locator('[data-action="submit-approval"]').count() === 0, "基础信息栏目不应展示提交审批按钮");
      await page.locator('[data-detail-tab="处理信息"]').click();
      await page.waitForSelector("#section-approval .approval-editor");
      await assertSubmittedInspection();
      assert(await page.locator('#section-approval [data-radio-value="通过"]').count() === 1 && await page.locator('#section-approval [data-radio-value="驳回"]').count() === 1, "审批结论字典不是通过/驳回");
      await page.locator('#section-approval [data-radio-value="驳回"]').click();
      assert((await page.locator('#section-approval [data-approval-opinion]').getAttribute("aria-required")) === "true", "审批驳回时意见未变为必填");
    }
    assert(errors.length === 0, `会签分支出现浏览器错误：${errors.join(" | ")}`);
  } finally {
    await context.close();
  }
}

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch(browserExecutable ? { headless: true, executablePath: browserExecutable } : { headless: true });
  try {
    await verifyComplaintObjectAvoidance(browser, port);
    await submitComplaintProcessing(browser, port, "否", "待审批");
    await submitComplaintProcessing(browser, port, "是", "会签中");
    console.log("Ticket countersign branching passed: 否 → 待审批；是 → 会签中");
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  server.close();
  process.exitCode = 1;
});
