const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const browserExecutable = findBrowserExecutable();
const mainWorkOrderSchema = JSON.parse(fs.readFileSync(path.join(root, "data", "forms", "main-work-orders.json"), "utf8"));
const intakeChannelsByType = mainWorkOrderSchema.work_orders?.acceptance_channels || {};
assert(JSON.stringify(intakeChannelsByType["舆情单"]) === JSON.stringify(["黑猫投诉", "抖音", "小红书", "微信公众号", "其它"]), "历史舆情单受理渠道字典缺失");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
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

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch(browserExecutable ? { headless: true, executablePath: browserExecutable } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
  const errors = [];
  page.on("pageerror", error => errors.push("PAGEERROR: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("CONSOLE: " + message.text()); });

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => {
      localStorage.setItem("xib-role", "developer");
      localStorage.setItem("xib-org", "development");
      localStorage.setItem("xib-role-profile", "development-developer");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-page='ticket-create']");
    await page.click("[data-page='ticket-create']");
    await page.waitForSelector(".ticket-list-table");
    assert(!(await page.locator("main").innerText()).includes("舆情单"), "工单创建列表或筛选仍显示舆情单");
    const acceptanceChannelFilter = page.locator('[data-filter-status-label="受理渠道"]');
    await acceptanceChannelFilter.locator(".filter-status-trigger").click();
    const acceptanceChannelFilterOptions = await acceptanceChannelFilter.locator(".filter-status-option").allInnerTexts();
    for (const retiredOption of ["黑猫投诉", "抖音", "小红书", "微信公众号"]) {
      assert(!acceptanceChannelFilterOptions.includes(retiredOption), `受理渠道筛选仍显示舆情专属选项：${retiredOption}`);
    }
    assert(acceptanceChannelFilterOptions.includes("其它"), "受理渠道筛选误删现行工单共用的“其它”选项");
    await page.click("[data-page='ticket-form']");
    await page.waitForSelector("#ticket-form-main");
    const workOrderTypeOptions = await page.locator("#work-order-type option").allInnerTexts();
    assert(!workOrderTypeOptions.includes("舆情单"), `新建工单仍可选择舆情单: ${workOrderTypeOptions.join("、")}`);
    assert(JSON.stringify(workOrderTypeOptions.filter(Boolean)) === JSON.stringify(["请选择", "投诉单", "信访单", "表扬单", "建议单"]), `新建工单类型选项不符合业务下线后的四类范围: ${workOrderTypeOptions.join("、")}`);
    const demoExpectations = [
      { type:"投诉单", customer:"陈晓敏", channel:"客服电话", recording:"CALL-20260828-091832", complaintObject:"王芳-XIB0004" },
      { type:"信访单", customer:"周先生", channel:"纪检", recording:"", receivedAt:"2026-08-25 10:20", deadline:"2026-09-24 18:00", petitionType:"纪检（消保类申诉）" },
      { type:"表扬单", customer:"林女士", channel:"客服电话", recording:"CALL-20260828-104506" },
      { type:"建议单", customer:"刘女士", channel:"在线客服", recording:"" }
    ];
    for (const expectation of demoExpectations) {
      await page.goto(`http://127.0.0.1:${port}/?testRoute=ticket-form&demoType=${encodeURIComponent(expectation.type)}#ticket-form`, { waitUntil:"domcontentloaded" });
      await page.selectOption("#work-order-type", expectation.type);
      await page.waitForFunction(() => document.querySelector('[data-field-key="反馈内容"]')?.value === "");
      await page.click("[data-action='demo-fill-ticket']");
      await page.waitForFunction(type => document.querySelector("#work-order-type")?.value === type && document.querySelector('[data-field-key="反馈内容"]')?.value, expectation.type);
      const actualDemoCustomer = await page.locator('input[data-field-key="customer.1.客户姓名"]').inputValue();
      const actualCustomerNo = await page.locator('input[data-field-key="customer.1.客户编号"]').inputValue();
      const actualDemoContent = await page.locator('[data-field-key="反馈内容"]').inputValue();
      assert(actualDemoCustomer === expectation.customer, expectation.type + " Demo 未使用独立客户样例：" + actualDemoCustomer + " / " + actualCustomerNo + " / " + actualDemoContent);
      assert((await page.locator('.form-item[data-field-name="受理渠道"] [data-field-key="受理渠道"]').inputValue()) === expectation.channel, expectation.type + " Demo 受理渠道不正确");
      const recordingField = page.locator('.form-item[data-field-name="录音编号"]');
      assert((await recordingField.count()) === (expectation.recording ? 1 : 0), expectation.type + " 的录音编号显示条件不正确");
      if (expectation.recording) {
        assert((await recordingField.locator('[data-field-key="录音编号"]').inputValue()) === expectation.recording, expectation.type + " Demo 未填写录音编号");
        assert(await recordingField.locator(".field-hint").count() === 0, expectation.type + " 录音编号仍显示 field-hint");
        await recordingField.locator('[data-action="view-call-transcript"]').click();
        await page.waitForFunction(recordingId => document.querySelector("#overlay-root .modal-body")?.textContent.includes(recordingId), expectation.recording);
        await page.locator("#modal-confirm").click();
      }
      if (expectation.complaintObject) {
        assert((await page.locator('[data-field-key="投诉对象"]').inputValue()) === expectation.complaintObject, expectation.type + " Demo 未填写必填投诉对象");
      }
      if (expectation.petitionType) {
        assert((await page.locator('[data-field-key="信访类型"]').inputValue()) === expectation.petitionType, "信访单 Demo 未填写必填信访类型");
        assert((await page.locator('[data-field-key="接收时间"]').inputValue()) === expectation.receivedAt, "信访单 Demo 未填写必填接收时间");
        assert((await page.locator('[data-field-key="处置期限"]').inputValue()) === expectation.deadline, "信访单 Demo 未填写必填处置期限");
      }
    }
    await page.goto(`http://127.0.0.1:${port}/?testRoute=ticket-form&demoType=customer-checks#ticket-form`, { waitUntil:"domcontentloaded" });
    await page.selectOption("#work-order-type", "投诉单");
    await page.waitForFunction(() => document.querySelector('[data-field-key="反馈内容"]')?.value === "");
    await page.click("[data-action='demo-fill-ticket']");
    await page.waitForFunction(() => document.querySelector('input[data-field-key="customer.1.客户姓名"]')?.value === "陈晓敏");
    const customerNumberLabel = await page.locator('.form-item[data-field-name="客户编号"] .form-label').innerText();
    assert(customerNumberLabel.includes("查询条件：客户编号或证件号码或卡号/账号、预留手机号码"), `客户编号查询条件提示不符: ${customerNumberLabel}`);

    // 查看历史工单独立于“查询并回填”，直接使用当前表单中的客户身份字段
    const customerHistoryButton = page.locator("[data-action='customer-history']");
    assert(!(await customerHistoryButton.isDisabled()), "查看历史工单仍错误依赖查询并回填");
    await customerHistoryButton.click();
    await page.waitForSelector(".customer-history-summary");
    assert((await page.locator(".customer-history-dialog").innerText()).includes("TS202408150101"), "未执行查询回填时无法独立查看当前客户历史工单");
    await page.locator("#modal-confirm").click();

    await page.locator('input[data-field-key="customer.1.客户编号"]').fill("C202607000004");
    await customerHistoryButton.click();
    await page.waitForSelector(".customer-history-dialog");
    const voidedHistoryText = await page.locator(".customer-history-dialog").innerText();
    assert(voidedHistoryText.includes("TS202607180026") && voidedHistoryText.includes("已废止"), "已废止工单未进入客户历史工单查询结果");
    assert(!voidedHistoryText.includes("草稿"), "草稿工单错误进入客户历史工单查询结果");
    await page.locator("#modal-confirm").click();

    // 客户查询无匹配结果时展示空状态
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("xib-role", "developer");
      localStorage.setItem("xib-org", "development");
      localStorage.setItem("xib-role-profile", "development-developer");
    });
    await page.goto(`http://127.0.0.1:${port}/?testRoute=ticket-form&demoType=customer-checks&case=zero-result#ticket-form`, { waitUntil:"domcontentloaded" });
    await page.selectOption("#work-order-type", "投诉单");
    const hasCustomerNumber = page.locator('.form-item[data-field-name="是否有客户编号"] [data-app-select]');
    await hasCustomerNumber.locator(".di-select-trigger").click();
    await hasCustomerNumber.locator('[data-select-value="是"]').click();
    await page.waitForFunction(() => document.querySelector('input[data-field-key="customer.1.客户编号"]')?.disabled === false);
    await page.fill('input[data-field-key="customer.1.客户编号"]', "C-NOT-FOUND");
    await page.fill('input[data-field-key="customer.1.证件号码"]', "999999999999999999");
    await page.locator("[data-action='customer-search']").click();
    await page.waitForSelector(".query-dialog .app-empty-state");
    assert((await page.locator(".query-dialog .app-empty-state").innerText()).includes("未查询到客户"), "客户查询零结果未显示空状态");
    await page.locator("#modal-confirm").click();

    // 查询并回填只负责客户主数据查询与字段回填
    await page.click("[data-action='demo-fill-ticket']");
    await page.waitForFunction(() => document.querySelector('input[data-field-key="customer.1.客户姓名"]')?.value === "陈晓敏");
    await page.locator("[data-action='customer-search']").click();
    await page.waitForSelector(".query-result-table");
    const customerQueryText = await page.locator(".query-result-table").innerText();
    assert(customerQueryText.includes("陈晓敏") && customerQueryText.includes("C202607000001") && customerQueryText.includes("350203198807180628"), `客户查询未返回结构化主数据: ${customerQueryText}`);
    assert(!customerQueryText.includes("C202407180036"), "客户查询仍返回旧硬编码客户编号");
    assert(await page.getByRole("button", { name:"取消选择", exact:true }).count() === 0, "客户查询结果仍显示取消选择按钮");
    await page.locator("#modal-confirm").click();
    assert((await page.locator('input[data-field-key="customer.1.客户编号"]').inputValue()) === "C202607000001", "回填客户编号未来自客户主数据");
    assert((await page.locator('input[data-field-key="customer.1.证件号码"]').inputValue()) === "350203198807180628", "回填证件号码未来自客户主数据");
    assert(Number(await page.locator('input[data-field-key="事件次数"]').inputValue()) > 0, "客户编号回填后未反显历史投诉次数");
    assert(!(await page.locator('.form-item[data-field-name="出生年份"] .di-year-trigger').isDisabled()), "客户回填后出生年份被错误锁定");
    assert(!(await page.locator('input[data-field-key="customer.1.预留手机号码"]').isDisabled()), "客户回填后预留手机号码被错误锁定");
    assert(!(await page.locator('.form-item[data-field-name="客户类型"] .di-select-trigger').isDisabled()), "客户回填后客户类型被错误锁定");

    // 国家地区与居住地按自身联动规则控制，不因客户回填而整体锁定
    const regionPage = await browser.newPage({ viewport: { width:1680, height:1050 } });
    await regionPage.goto(`http://127.0.0.1:${port}/?testRoute=ticket-form&case=region-edit#ticket-form`, { waitUntil:"domcontentloaded" });
    await regionPage.selectOption("#work-order-type", "投诉单");
    const countryHost = regionPage.locator('.form-item[data-field-name="国家地区"] [data-app-select]');
    await countryHost.locator(".di-select-trigger").waitFor({ state:"visible" });
    await countryHost.locator(".di-select-trigger").evaluate(trigger => trigger.click());
    await countryHost.locator('.di-select-popover:not([hidden])').waitFor({ state:"visible" });
    const countryOptions = await countryHost.locator("[data-select-value]").allInnerTexts();
    assert(countryOptions.length > 200, `国家地区选项过少: ${countryOptions.length}`);
    assert(countryOptions[0] === "中华人民共和国", "中华人民共和国未置顶");
    assert(!countryOptions.includes("台湾") && !countryOptions.includes("中国香港") && !countryOptions.includes("中国澳门"), "港澳台不应出现在国家列表中（一个中国原则）");
    assert(countryOptions.includes("美国") && countryOptions.includes("日本"), "国家列表缺少常见国家");
    await countryHost.locator('.di-select-popover:not([hidden]) [data-select-value="中华人民共和国"]').click({ force:true });
    await regionPage.waitForFunction(() => document.querySelector('.form-item[data-field-name="居住地 省/市/区"] .di-cascader-trigger')?.disabled === false);

    // 居住地：中华人民共和国的省市区级联
    const regionHost = regionPage.locator('.form-item[data-field-name="居住地 省/市/区"] [data-app-cascader]');
    await regionHost.locator(".di-cascader-trigger").waitFor({ state:"visible" });
    const provinceOptions = await regionPage.locator('.form-item[data-field-name="居住地 省/市/区"] [data-cascade-column="0"] [data-cascade-label]').allInnerTexts();
    assert(provinceOptions[0] === "不清楚", "省级第一项应为“不清楚”");
    assert(provinceOptions.includes("香港特别行政区") && provinceOptions.includes("澳门特别行政区") && provinceOptions.includes("台湾省"), "居住地缺少港澳台省级选项");
    assert(provinceOptions.includes("福建省") && provinceOptions.includes("上海市"), "居住地缺少大陆省份");
    await regionPage.evaluate(() => {
      const host = document.querySelector('.form-item[data-field-name="居住地 省/市/区"] [data-app-cascader]');
      const popover = host.querySelector('.di-cascader-popover');
      if (popover.hidden) host.querySelector('.di-cascader-trigger').click();
      [[0, "福建省"], [1, "厦门市"], [2, "思明区"]].forEach(([level, label]) => {
        const option = popover.querySelector(`[data-cascade-column="${level}"] [data-cascade-label="${label}"]`);
        if (!option) throw new Error(`级联选项不存在：${level}/${label}`);
        option.click();
      });
    });
    await regionPage.waitForFunction(() => document.querySelector('.form-item[data-field-name="居住地 省/市/区"] input[type="hidden"]')?.value === "福建省 / 厦门市 / 思明区");

    // 选择“不清楚”→ 市/区两列置灰
    await regionHost.locator(".di-cascader-trigger").click();
    await regionPage.waitForFunction(() => document.querySelector('.form-item[data-field-name="居住地 省/市/区"] [data-cascade-column="0"] [data-cascade-label="不清楚"]'));
    await regionPage.evaluate(() => document.querySelector('.form-item[data-field-name="居住地 省/市/区"] [data-cascade-column="0"] [data-cascade-label="不清楚"]').click());
    assert((await regionHost.locator('input[type="hidden"]').inputValue()) === "不清楚", "选择不清楚后取值错误");
    await regionHost.locator(".di-cascader-trigger").click();
    await regionPage.waitForFunction(() => document.querySelector('.form-item[data-field-name="居住地 省/市/区"] [data-cascade-column="1"]')?.classList.contains("is-muted"));
    const mutedCount = await regionPage.locator('.form-item[data-field-name="居住地 省/市/区"] .di-cascader-column.is-muted').count();
    assert(mutedCount === 2, `选择“不清楚”后市/区两列应置灰，实际 ${mutedCount}`);
    await regionPage.keyboard.press("Escape");

    // 选其他国家 → 居住地自动“不清楚”且禁用
    await countryHost.locator(".di-select-trigger").click();
    await regionPage.evaluate(() => document.querySelector('.form-item[data-field-name="国家地区"] [data-select-value="美国"]').click());
    await regionPage.waitForFunction(() => document.querySelector('.form-item[data-field-name="居住地 省/市/区"] .di-cascader-trigger')?.disabled === true);
    assert((await regionHost.locator('input[type="hidden"]').inputValue()) === "不清楚", "选其他国家后应自动填“不清楚”");
    assert(await regionHost.locator(".di-cascader-trigger span").innerText() === "不清楚", "触发按钮未显示“不清楚”");

    // 切回中华人民共和国 → 清空并恢复可编辑
    await countryHost.locator(".di-select-trigger").click();
    await regionPage.evaluate(() => document.querySelector('.form-item[data-field-name="国家地区"] [data-select-value="中华人民共和国"]').click());
    await regionPage.waitForFunction(() => document.querySelector('.form-item[data-field-name="居住地 省/市/区"] .di-cascader-trigger')?.disabled === false);
    assert((await regionHost.locator('input[type="hidden"]').inputValue()) === "", "切回中华人民共和国后居住地应清空待重选");
    await regionPage.close();

    // 查询历史工单总结
    await page.locator("[data-action='customer-history']").click();
    await page.waitForSelector(".customer-history-summary");
    const summary = await page.locator(".customer-history-summary").innerText();
    const historyDialogText = await page.locator(".customer-history-dialog").innerText();
    const historyTableHeaders = await page.locator(".customer-history-table thead th").allInnerTexts();
    const historyTableRows = page.locator(".customer-history-table tbody tr");
    const historyRowSeparators = await historyTableRows.evaluateAll(rows => rows.slice(0, -1).every(row => parseFloat(getComputedStyle(row.cells[0]).borderBottomWidth) > 0));
    assert(historyDialogText.includes("TS202408150101"), "超过一年的已办结工单应显示在客户历史中");
    assert(historyDialogText.includes("TS202607230012") && historyDialogText.includes("TS202608050011"), "客户历史工单未包含当前或处理中的非草稿工单");
    assert(JSON.stringify(historyTableHeaders) === JSON.stringify(["工单类型", "工单编号", "工单状态"]), `客户历史工单表头不符合规范: ${historyTableHeaders.join("、")}`);
    assert(await historyTableRows.count() > 1 && historyRowSeparators, "客户历史工单行之间缺少分隔线");
    assert(/共有工单\d+笔（投诉单\d+笔、信访单\d+笔、建议单\d+笔、表扬单\d+笔）/.test(summary), `历史工单总结文案不符: ${summary}`);
    assert(!summary.includes("重复投诉") && !summary.includes("历史监管投诉"), `客户历史工单仍展示已删除的统计项: ${summary}`);
    await page.click("#modal-confirm");

    assert(errors.length === 0, `页面运行错误：${errors.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, checks: ["舆情单全局隐藏与不可创建", "筛选条件移除舆情专属受理渠道", "历史舆情渠道字典保留", "四类工单差异化 Demo", "客服电话录音转文本", "结构化客户查询与回填", "真实客户工单关联", "国家地区字典", "居住地省市区级联", "不清楚置灰", "其他国家联动禁用", "客户历史包含非草稿工单及精简统计"], browserErrors: errors }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
