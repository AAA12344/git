const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");
const root = path.resolve(__dirname, "..");
const seed = require("../data/seed-data.json");
const storageKey = "xib-prototype-state-v" + seed.meta.storageVersion;
const seedIds = seed.lists.tickets.map(row => row.id);
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml" };
  response.writeHead(200, { "Content-Type":(mime[path.extname(file)] || "application/octet-stream") + "; charset=utf-8" });
  fs.createReadStream(file).pipe(response);
});

async function snapshot(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
}
async function role(page, org, profile) {
  await page.locator("#role-cascade-trigger").click();
  await page.locator('[data-role-org="' + org + '"]').click();
  await page.locator('[data-role-profile="' + profile + '"]').click();
}
async function scenario(browser, port, options) {
  const context = await browser.newContext({ viewport:{ width:1680, height:1050 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.addInitScript(() => {
    if (!localStorage.getItem("xib-role")) {
      localStorage.setItem("xib-role", "developer");
      localStorage.setItem("xib-org", "development");
      localStorage.setItem("xib-role-profile", "development-developer");
    }
  });
  try {
    await page.goto("http://127.0.0.1:" + port + "/?testRoute=ticket-form#ticket-form");
    await page.selectOption("#work-order-type", "投诉单");
    await page.locator('[data-action="demo-fill-ticket"]').click();
    await page.waitForFunction(() => document.querySelector('input[data-field-key="customer.1.客户姓名"]')?.value === "陈晓敏");
    await page.locator('[data-action="smart-classify"]').click();
    await page.waitForFunction(() => Boolean(document.querySelector('input[data-field-key="业务类别"]')?.value));
    const request = page.locator('.form-item[data-field-name="投诉请求"] [data-app-select]');
    await request.locator('.di-select-trigger').click();
    await request.locator('[data-select-value="其他"]').click();
    const channel = page.locator('.form-item[data-field-name="受理渠道"] [data-app-select]');
    if (options.channel !== "客服电话") {
      await channel.locator(".di-select-trigger").click();
      await channel.locator('[data-select-value="' + options.channel + '"]').click();
    }
    const department = page.locator('[data-institution-department][data-field-key="派发部门"]');
    assert.match(await department.inputValue(), /普惠|消费者权益保护/, "AI 派发必须从允许的部门中选取");
    if (options.subbranch) {
      const institution = page.locator('[data-app-hierarchy-cascader][data-field-key="派发机构"]');
      await institution.locator(".di-hierarchy-cascader-trigger").click();
      await institution.locator('[data-hierarchy-parent="厦门分行"]').click();
      await institution.locator('[data-hierarchy-toggle="厦门分行 / 厦门湖里支行"]').click();
      assert.equal(await department.inputValue(), "-", "支行派发部门应显示短横线");
      assert(await department.isDisabled());
    }
    const customerService = options.channel !== "营业网点";
    await role(page, customerService ? "customer-service" : "development", customerService ? "customer-operator" : "development-operator");
    await page.locator('[data-action="submit-ticket"]').click();
    await page.waitForSelector("#overlay-root .modal");
    if (await page.locator(".validation-warning-dialog").count()) await page.locator("#modal-confirm").click();
    const telephone = options.channel === "客服电话";
    assert.equal(await page.locator(".acceptance-sms-choice").count(), telephone ? 0 : 1, "客服电话建单应跳过短信确认，其他渠道保留");
    if (!telephone) {
      if (options.creationOptOut) await page.locator('input[name="acceptance-sms"][value="否"]').check();
      else {
        const contactInput = page.locator("#submission-sms-contact-input");
        await page.locator("#submission-sms-contact-toggle").click();
        const contactOptions = await page.locator("#submission-sms-contact-options button").allTextContents();
        assert.equal(await contactInput.count(), 1, "新建投诉单确认弹窗应提供可输入的联系方式下拉框");
        assert.equal(await contactInput.isEditable(), false, "已有联系方式只能选择，不允许直接编辑");
        assert.equal(contactOptions.length, 3, "联系方式2未填写时应只显示来电号码、联系方式1和手动输入");
        assert(contactOptions.includes("手动输入"), "联系方式下拉框应保留手动输入选项");
        assert(contactOptions.some(option => option.startsWith("来电号码  ")), "已填写的来电号码应显示为可选项");
        assert(contactOptions.some(option => option.startsWith("联系方式1  ")), "已填写的联系方式1应显示为可选项");
        assert(contactOptions.every(option => !option.startsWith("联系方式2  ")), "未填写的联系方式2不得显示");
        assert(contactOptions.every(option => !option.includes("未填写") && !option.includes("*")), "下拉框不得展示空值或脱敏号码");
        assert(contactOptions.some(option => /来电号码\s+13800007621\s+陈晓敏/.test(option)), "下拉框应完整展示号码和客户姓名");
        assert.equal(await page.locator("#submission-sms-contact-manual").count(), 0, "手动输入不得额外增加输入框");
        if (options.manualRecipient) {
          await page.locator("#submission-sms-contact-options [data-submission-sms-contact-manual]").click();
          assert.equal(await contactInput.inputValue(), "", "选择手动输入后应清空为可编辑状态");
          assert.equal(await contactInput.isEditable(), true, "只有选择手动输入后才允许编辑号码");
          assert.equal(await contactInput.getAttribute("placeholder"), "请输入手机号码或带区号的固定电话");
          await contactInput.fill(options.manualRecipient);
        } else {
          await page.locator("#submission-sms-contact-options [data-submission-sms-contact]").first().click();
          assert.equal(await contactInput.isEditable(), false, "选择已有联系方式后应保持只读");
        }
        await page.selectOption("#submission-sms-template-select", options.template || "受理告知短信");
      }
    }
    await page.locator("#modal-confirm").click();
    await page.waitForSelector(".contact-result");
    let data = await snapshot(page);
    const row = data.rows.ticket.find(item => !seedIds.includes(item[0]));
    assert(row, "提交未生成工单");
    const id = row[0];
    assert.equal(row[5], customerService ? "待复核" : "待处理");
    const creationSmsCount = telephone || options.creationOptOut ? 0 : 1;
    assert.equal((data.contactRecordsByTicket[id] || []).length, creationSmsCount);
    if (options.manualRecipient) assert.equal(data.contactRecordsByTicket[id][0].receiver, options.manualRecipient, "手动输入号码应写入提交短信联系记录");
    if (options.subbranch) {
      assert.equal(data.documentData.tickets[id].fields.entry["派发部门"], "-", "支行派发部门应保存为短横线");
      assert.equal(Object.prototype.hasOwnProperty.call(data.documentData.tickets[id].fields.entry, "派发消保办"), false, "工单不应保存额外派发目标字段");
    }
    await page.locator(".modal-foot [data-close-overlay]").click();

    if (customerService) {
      await role(page, "customer-service", "customer-reviewer");
      await page.locator('[data-page="my-approvals"]').first().click();
      await page.waitForSelector(".approval-table");
      let approval = page.locator(".approval-table tbody tr", { hasText:id });
      if (!(await approval.count())) {
        await page.locator('[data-approval-scope="机构工单池"]').click();
        approval = page.locator(".approval-table tbody tr", { hasText:id });
      }
      assert.equal(await approval.count(), 1, "客服复核员应看到新建待复核工单");
      await approval.locator('[data-action="approve"]').click();
      await page.waitForSelector("#section-approval");
      if (options.outcome === "reject") {
        await page.locator('#section-approval [data-radio-value="不通过"]').click();
        await page.locator('[data-field-key="复核意见"]').fill("资料需补充，退回经办员。");
      }
      await page.locator('[data-action="submit-approval"]').click();
      if (telephone && options.outcome !== "reject") {
        await page.waitForSelector(".acceptance-sms-choice");
        assert(await page.locator("#overlay-root .modal").evaluate(el => el.classList.contains("is-wide")));
        assert((await page.locator("#submission-sms-preview").innerText()).includes(id), "复核短信应显示真实工单编号");
        const reviewContactInput = page.locator("#submission-sms-contact-input");
        assert(await reviewContactInput.count() === 1 && !(await reviewContactInput.isEditable()), "复核确认应提供默认只读的联系方式下拉框");
        const reviewContactOptions = await page.locator("[data-submission-sms-contact]").allTextContents();
        assert(reviewContactOptions.every(option => option.includes("13800007621")), "复核确认联系方式未使用完整号码展示");
        if (options.reviewManualRecipient) {
          await page.locator("#submission-sms-contact-toggle").click();
          await page.locator("[data-submission-sms-contact-manual]").click();
          assert(await reviewContactInput.isEditable(), "复核确认仅在选择手动输入后才应允许编辑号码");
          await reviewContactInput.fill(options.reviewManualRecipient);
        }
        if (options.cancelOnce) {
          await page.locator(".modal-head [data-close-overlay]").click();
          data = await snapshot(page);
          assert.equal(data.rows.ticket.find(item => item[0] === id)[5], "复核中", "取消确认不能通过复核");
          assert.equal((data.contactRecordsByTicket[id] || []).length, 0, "取消确认不能发短信");
          await page.locator('[data-action="submit-approval"]').click();
          await page.waitForSelector(".acceptance-sms-choice");
        }
        if (options.screenshot) {
          fs.mkdirSync(path.join(root, "test-results"), { recursive:true });
          await page.screenshot({ animations:"disabled", path:path.join(root, "test-results/phone-review-sms.png") });
        }
        if (options.outcome === "skip") {
          await page.locator('input[name="acceptance-sms"][value="否"]').check();
          assert(await page.locator("#submission-sms-template").isHidden());
        } else {
          await page.selectOption("#submission-sms-template-select", options.template || "受理告知短信");
          assert((await page.locator("#submission-sms-preview").innerText()).includes(options.template || "受理告知短信"));
        }
        await page.locator("#modal-confirm").click();
      } else {
        assert.equal(await page.locator(".acceptance-sms-choice").count(), 0, "退回或非电话渠道复核不应触发短信弹窗");
      }
      await page.waitForSelector(".approval-table");
      data = await snapshot(page);
      assert.equal(data.rows.ticket.find(item => item[0] === id)[5], options.outcome === "reject" ? "待提交" : "待处理");
      if (options.outcome !== "reject") assert.equal(data.workPoolAssignments.ticket[id].assignee, "", "复核通过后的待处理工单不能被自动领取");
      const sms = data.contactRecordsByTicket[id] || [];
      const expectedCount = telephone ? (options.outcome === "send" ? 1 : 0) : creationSmsCount;
      assert.equal(sms.length, expectedCount, "短信必须只在正确节点发送一次");
      if (telephone && expectedCount) {
        assert.equal(sms[0].triggerStage, "review");
        assert.equal(sms[0].template, options.template || "受理告知短信");
        assert.equal(sms[0].smsApprovalStatus, "无需审批");
        assert.equal(sms[0].sendStatus, "已送达");
        assert.equal(sms[0].receiver, options.reviewManualRecipient || data.documentData.tickets[id].fields.entry["联系方式"]);
      }
      await page.reload();
      assert.equal(((await snapshot(page)).contactRecordsByTicket[id] || []).length, expectedCount, "刷新不能重复发送或丢失记录");
    }
    assert.deepEqual(errors, []);
    console.log("Passed: " + options.channel + " / " + options.outcome + " / " + (options.template || "受理告知短信"));
  } finally {
    await context.close();
  }
}

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const executablePath = findBrowserExecutable();
  const browser = await chromium.launch({ headless:true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const options of [
      { channel:"客服电话", outcome:"send", subbranch:true, cancelOnce:true, screenshot:true },
      { channel:"客服电话", outcome:"send", reviewManualRecipient:"13912345678" },
      { channel:"客服电话", outcome:"send", template:"非我行客户短信" },
      { channel:"客服电话", outcome:"skip" },
      { channel:"客服电话", outcome:"reject" },
      { channel:"营业网点", outcome:"send" },
      { channel:"营业网点", outcome:"send", manualRecipient:"13912345678" },
      { channel:"营业网点", outcome:"skip", creationOptOut:true },
      { channel:"在线客服", outcome:"send" }
    ]) await scenario(browser, server.address().port, options);
    console.log("Phone review SMS checks passed: operator submission, reviewer approval/rejection, cancellation, opt-out, templates, persistence and other channels.");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
