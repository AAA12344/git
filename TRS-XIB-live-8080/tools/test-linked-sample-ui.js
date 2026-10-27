const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const seedData = JSON.parse(fs.readFileSync(path.join(root, "data/seed-data.json"), "utf8"));
const mainWorkOrderSchema = JSON.parse(fs.readFileSync(path.join(root, "data/forms/main-work-orders.json"), "utf8"));
const submittedPetitionId = "XF202607310102";
const submittedPetitionDeadline = seedData.documentData.tickets[submittedPetitionId].dispositionDeadline;
const completedCustomerServiceTicketId = "TS202610090001";
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
async function assertFourColumnFilterRow(row, label) {
  const layout = await row.evaluate(element => ({
    columnCount:getComputedStyle(element).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
    occupied:[...element.children].reduce((sum, child) => sum + (child.classList.contains("is-range") ? 2 : 1), 0)
  }));
  assert(layout.columnCount === 4, `${label}不是固定四栏网格`);
  assert(layout.occupied <= 4, `${label}字段占位超过四栏`);
}
async function assertQueryDateBounds(panel, label) {
  const pickers = panel.locator("[data-app-picker]");
  const count = await pickers.count();
  assert(count > 0, `${label}缺少日期筛选条件`);
  const bounds = await pickers.evaluateAll(nodes => nodes.map(node => ({ min:node.dataset.minDate, max:node.dataset.maxDate })));
  assert(bounds.every(bound => bound.min === "2015-01-01"), `${label}日期下限未统一为 2015-01-01`);
  assert(bounds.every(bound => bound.max === "2026-10-03"), `${label}日期上限未限制为系统当前日期`);
}
function expectedTicketDetailLabels(ticketId) {
  const record = seedData.lists.tickets.find(ticket => ticket.id === ticketId);
  const entry = seedData.documentData.tickets[ticketId].fields.entry;
  const matchesCondition = condition => !condition || (Object.prototype.hasOwnProperty.call(condition, "equals")
    ? entry[condition.key] === condition.equals
    : Array.isArray(condition.in) ? condition.in.includes(entry[condition.key])
      : Object.prototype.hasOwnProperty.call(condition, "notEquals") ? entry[condition.key] !== condition.notEquals : true);
  return mainWorkOrderSchema.work_orders.entry_sections
    .flatMap(section => section.fields)
    .filter(field => (field.all || (field.types || []).includes(record.type)) && field.type !== "aiAction" && !String(field.name || "").startsWith("修正") && !["是否有客户编号", "投诉人数"].includes(field.name) && matchesCondition(field.showWhen))
    .map(field => field.labelBy?.[record.type] || field.label || field.name);
}

function expectedTicketDetailSectionIds(ticketId) {
  const record = seedData.lists.tickets.find(ticket => ticket.id === ticketId);
  const entry = seedData.documentData.tickets[ticketId].fields.entry;
  const matchesCondition = condition => !condition || (Object.prototype.hasOwnProperty.call(condition, "equals")
    ? entry[condition.key] === condition.equals
    : Array.isArray(condition.in) ? condition.in.includes(entry[condition.key])
      : Object.prototype.hasOwnProperty.call(condition, "notEquals") ? entry[condition.key] !== condition.notEquals : true);
  return mainWorkOrderSchema.work_orders.entry_sections
    .filter(section => section.fields.some(field => (field.all || (field.types || []).includes(record.type)) && field.type !== "aiAction" && !String(field.name || "").startsWith("修正") && matchesCondition(field.showWhen)))
    .map(section => section.id);
}
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch(browserExecutable ? { headless: true, executablePath: browserExecutable } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.clock.setFixedTime(new Date("2026-10-03T12:00:00+08:00"));
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-page='ticket-create']");
    await page.click("[data-page='ticket-create']");
    await page.waitForSelector(".ticket-list-table");
    const ticketText = await page.locator(".ticket-list-table").innerText();
    await page.locator('[data-pagination-size]').selectOption('50');
    await page.waitForTimeout(100);
    const expectedLinkedSubprocessTypes = new Map([
      ["TS202607230012", ["延长申请", "撤销投诉", "异常投诉", "剔除申请", "废止申请", "投诉校正", "投诉调查", "投诉问责", "纠纷化解", "异议核查"]],
      ["XF202607210008", ["废止申请", "投诉校正", "投诉问责"]],
      ["JY202607240017", ["废止申请"]]
    ]);
    for (const [ticketId, expectedTypes] of expectedLinkedSubprocessTypes) {
      const sourceRow = page.locator('.ticket-list-table tbody tr', { hasText:ticketId });
      assert(await sourceRow.count() === 1, `工单创建列表缺少关联子流程验证样例：${ticketId}`);
      await sourceRow.locator('[data-action="detail"]').click();
      await page.waitForSelector('.ticket-detail-page');
      await page.locator('[data-detail-tab="处理信息"]').click();
      await page.waitForSelector('.linked-subprocess-table');
      const actualTypes = await page.locator('.linked-subprocess-table [data-linked-subprocess-type]').evaluateAll(rows => [...new Set(rows.map(row => row.dataset.linkedSubprocessType))]);
      assert(JSON.stringify(actualTypes) === JSON.stringify(expectedTypes), `${ticketId} 关联子流程类型不正确：${actualTypes.join('、')}`);
      await page.locator('[data-action="navigate-back"]').click();
      await page.waitForSelector('.ticket-list-table');
    }
    await page.evaluate(() => {
      const registry = window.XIBModuleRegistry;
      window.XIBModuleRegistry = {
        ...registry,
        afterRender(root, route, context) {
          window.__xibTestContext = context;
          return registry.afterRender(root, route, context);
        }
      };
    });
    await page.locator('[data-pagination-size]').selectOption('50');
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.__xibTestContext.state.triggeredSubprocesses.JY202607240017 = [{
        id:'WZ-HISTORY-001', type:'投诉问责', document:'投诉问责申请单',
        relatedTicket:'JY202607240017', status:'已办结', createdAt:'2026-01-01 10:00'
      }];
      window.__xibTestContext.rerenderPage();
    });
    const historicalTicketRow = page.locator('.ticket-list-table tbody tr', { hasText:'JY202607240017' });
    await historicalTicketRow.locator('[data-action="detail"]').click();
    await page.waitForSelector('.ticket-detail-page');
    await page.locator('[data-detail-tab="处理信息"]').click();
    await page.waitForSelector('.linked-subprocess-table');
    const historicalSubprocessRow = page.locator('.linked-subprocess-table [data-linked-subprocess-type="投诉问责"]');
    const historicalTypes = await page.locator('.linked-subprocess-table [data-linked-subprocess-type]').evaluateAll(rows => rows.map(row => row.dataset.linkedSubprocessType));
    assert(await historicalSubprocessRow.count() === 1, '规则收窄后隐藏了历史已有的投诉问责子单：' + historicalTypes.join('、') + ' | ' + await page.locator('.detail-summary').innerText());
    assert(await historicalSubprocessRow.locator('[data-action="quick-subprocess"]').count() === 0, '历史保留类型仍可重新发起');
    await page.locator('[data-action="navigate-back"]').click();
    await page.waitForSelector('.ticket-list-table');
    const mainStatusOrder = ["草稿", "待复核", "复核中", "待处理", "处理中", "会签中", "待初审", "初审中", "待审批", "审批中", "已办结", "已废止"];
    const manageableMainStatusOrder = mainStatusOrder.filter(status => !["已办结", "已废止"].includes(status));
    const subprocessStatusOrder = ["草稿", "待提交", "待复核", "复核中", "待处理", "处理中", "待初审", "初审中", "待审批", "审批中", "待补录", "已办结", "已废止"];
    for (const status of manageableMainStatusOrder) {
      assert(ticketText.includes(status), `工单管理列表缺少状态：${status}`);
    }
    assert(!ticketText.includes("待提交"), "草稿箱仍展示待提交工单");
    assert(ticketText.includes(completedCustomerServiceTicketId) && ticketText.includes("已办结"), "工单创建缺少客服系统带入的已办结投诉工单样例");
    assert((await page.locator(".ticket-list-table tr", { hasText:"会签中" }).locator("td").nth(2).innerText()).trim().startsWith("投诉单"), "会签中状态只能出现在投诉单");
    assert(!ticketText.includes("已撤销") && !ticketText.includes("已废止") && !ticketText.includes("待补录"), "工单列表仍包含已移除状态");
    assert(ticketText.includes("TS202607310106"), "工单列表缺少再次投诉样例");
    const globalEmptyImage = await page.evaluate(() => {
      const node = document.createElement("div");
      node.className = "app-empty-state";
      document.body.appendChild(node);
      const backgroundImage = getComputedStyle(node, "::before").backgroundImage;
      node.remove();
      return backgroundImage;
    });
    assert(globalEmptyImage.includes("%E7%BC%BA%E7%9C%81-%E7%A9%BA%E7%A9%BA%E5%A6%82%E4%B9%9F.svg") || globalEmptyImage.includes("缺省-空空如也.svg"), "全局空状态未使用指定缺省图");
    const ticketKinds = await page.locator(".ticket-list-table [data-ticket-list-kind]").evaluateAll(nodes => [...new Set(nodes.map(node => node.dataset.ticketListKind))]);
    assert(ticketKinds.includes("再次投诉单") && !ticketKinds.includes("抄送") && !ticketKinds.includes("工单"), "创建列表应保留再次投诉关系，不显示抄送标识");
    assert(await page.locator(".ticket-list-table tr", { hasText: "TS202607230012" }).count() === 1, "隐藏抄送标识不应删除正常创建工单");
    const typography = await page.evaluate(() => ({ family:getComputedStyle(document.body).fontFamily, bodyWeight:getComputedStyle(document.body).fontWeight, titleWeight:getComputedStyle(document.querySelector(".page-title")).fontWeight }));
    assert(typography.family.split(",")[0].includes("Microsoft YaHei"), "页面应优先使用微软雅黑");
    assert(typography.bodyWeight === "400" && typography.titleWeight === "600", "正文和页面标题字重层级改变");
    const documentStatusOrder = ["草稿", "待提交", "待复核", "复核中", "待处理", "处理中", "会签中", "待初审", "初审中", "待审批", "审批中", "待补录", "已办结", "已废止"];
    const assertDeadlineOnlySort = async (tableSelector, pageLabel, expectsDeadline = true) => {
      const sortButtons = page.locator(`${tableSelector} [data-sort-scope]`);
      const count = await sortButtons.count();
      assert(count === (expectsDeadline ? 1 : 0), `${pageLabel}应仅保留处置期限排序，实际排序入口 ${count} 个`);
      if (expectsDeadline) assert(await sortButtons.first().getAttribute("aria-label") === "按处置期限排序", `${pageLabel}保留了非处置期限排序`);
    };
    await assertFourColumnFilterRow(page.locator(".ticket-create-filter-panel .grouped-filter-row-1"), "工单创建业务状态行");
    await assertFourColumnFilterRow(page.locator(".ticket-create-filter-panel .grouped-filter-row-2"), "工单创建单据识别行");
    assert((await page.locator(".ticket-create-filter-panel .grouped-filter-row-1 .filter-datepicker-range").evaluate(node => getComputedStyle(node).gridColumnStart)) === "span 2", "工单创建日期范围未占两栏");
    assert(JSON.stringify(await page.locator(".ticket-create-filter-panel .grouped-filter-row-3 label").allInnerTexts()) === JSON.stringify(["客户类型", "客户姓名", "联系方式"]), "工单创建客户信息未固定在同一独立行");
    assert(await page.locator(".ticket-create-filter-panel .grouped-filter-row-3 .ticket-filter-item", { hasText:"客户类型" }).locator("select").count() === 1, "工单创建客户类型不是下拉框");
    assert(await page.locator(".ticket-create-filter-panel .grouped-filter-row-3 .ticket-filter-item", { hasText:"联系方式" }).locator("input").count() === 1, "工单创建联系方式不是输入框搜索");
    await assertDeadlineOnlySort(".ticket-list-table", "工单创建");
    const manageableMainStatusColorPairs = await page.locator(".ticket-list-table [data-flow-status]").evaluateAll((nodes, statuses) => statuses.map(status => {
      const node = nodes.find(item => item.dataset.flowStatus === status);
      if (!node) return "missing";
      const style = getComputedStyle(node);
      return style.color + "|" + style.backgroundColor;
    }), manageableMainStatusOrder);
    assert(!manageableMainStatusColorPairs.includes("missing") && new Set(manageableMainStatusColorPairs).size === manageableMainStatusOrder.length, "工单管理状态标签未使用独立颜色");
    let mainStatusColorPairs = [];
    const mainPaletteKeys = await page.locator(".ticket-list-table [data-flow-status]").evaluateAll(nodes => nodes.map(node => node.dataset.statusPalette));
    assert(mainPaletteKeys.every(Boolean), "主单状态标签缺少统一调色板标识");
    const draftRow = page.locator(".ticket-list-table tbody tr", { hasText: "草稿" }).first();
    assert(await draftRow.locator("[data-action='detail']").count() === 0, "草稿状态不应显示查看操作");
    assert(await draftRow.locator("[data-action='edit']").count() === 1, "草稿状态应显示编辑操作");
    const waitReviewRow = page.locator(".ticket-list-table tbody tr", { hasText: "待复核" }).first();
    assert(await waitReviewRow.locator("[data-action='withdraw-submission']").count() === 1, "提交后待复核工单缺少撤回操作");
    const withdrawalStatuses = await page.locator(".ticket-list-table tbody tr:has([data-action='withdraw-submission'])").evaluateAll(rows => rows.map(row => row.querySelector('[data-flow-status]')?.textContent.trim()));
    assert(withdrawalStatuses.includes("待复核") && withdrawalStatuses.includes("待处理") && withdrawalStatuses.includes("待审批"), "提交后紧邻节点或原有待审批撤回路径不完整");
    assert(withdrawalStatuses.every(status => ["待复核", "待处理", "待审批"].includes(status)), "已超过提交后紧邻节点的工单错误显示撤回操作");
    const reviewingRow = page.locator(".ticket-list-table tbody tr", { hasText: "复核中" }).first();
    assert(await reviewingRow.locator("[data-action='withdraw-submission']").count() === 0, "复核中仍显示撤回提交");
    const waitReviewTicketId = (await waitReviewRow.locator(".primary-cell").innerText()).trim();
    const withdrawalStateSnapshot = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(item => item.startsWith("xib-prototype-state-v"));
      return { key:key || "", value:key ? localStorage.getItem(key) : null };
    });
    await waitReviewRow.locator("[data-action='withdraw-submission']").click();
    await page.waitForSelector(".action-dialog");
    const waitReviewWithdrawCopy = await page.locator(".action-dialog").innerText();
    assert(waitReviewWithdrawCopy.includes("待复核") && waitReviewWithdrawCopy.includes("待提交"), "待复核撤回弹窗未说明返回待提交");
    await page.locator("#modal-confirm").click();
    await page.waitForFunction(id => {
      const storageKey = Object.keys(localStorage).find(key => key.startsWith("xib-prototype-state-v"));
      const saved = storageKey ? JSON.parse(localStorage.getItem(storageKey) || "null") : null;
      return saved?.history?.ticket?.[id]?.[0]?.statusTransition === "待复核 → 待提交";
    }, waitReviewTicketId);
    await page.waitForFunction(id => ![...document.querySelectorAll(".ticket-list-table tbody tr")].some(row => row.textContent.includes(id) && row.querySelector('[data-flow-status]')?.textContent.trim() === "待复核"), waitReviewTicketId);
    const withdrawnRow = page.locator(".ticket-list-table tbody tr", { hasText:waitReviewTicketId });
    const withdrawnStatuses = await withdrawnRow.locator("[data-flow-status]").allInnerTexts();
    assert(!withdrawnStatuses.includes("待复核"), "撤回后的工单仍以待复核状态留在当前列表: " + withdrawnStatuses.join("、"));
    const persistedWithdrawal = await page.evaluate(id => {
      const storageKey = Object.keys(localStorage).find(key => key.startsWith("xib-prototype-state-v"));
      const saved = storageKey ? JSON.parse(localStorage.getItem(storageKey) || "null") : null;
      return saved?.history?.ticket?.[id]?.[0] || null;
    }, waitReviewTicketId);
    assert(persistedWithdrawal?.statusTransition === "待复核 → 待提交" && persistedWithdrawal?.flowSceneName.includes("撤回"), "待复核撤回未写入正确流转记录");
    await page.evaluate(snapshot => {
      if (!snapshot.key) {
        const createdKey = Object.keys(localStorage).find(item => item.startsWith("xib-prototype-state-v"));
        if (createdKey) localStorage.removeItem(createdKey);
        return;
      }
      if (snapshot.value === null) localStorage.removeItem(snapshot.key);
      else localStorage.setItem(snapshot.key, snapshot.value);
    }, withdrawalStateSnapshot);
    await page.reload({ waitUntil:"domcontentloaded" });
    await page.waitForSelector(".ticket-list-table");

    const completedCustomerServiceRow = page.locator(".ticket-list-table tbody tr", { hasText: completedCustomerServiceTicketId });
    assert(await completedCustomerServiceRow.count() === 1, "客服系统带入的已办结投诉工单未在工单创建列表唯一展示");
    const completedOperationCells = (await completedCustomerServiceRow.locator("td.operation-column").allInnerTexts()).map(value => value.trim());
    assert(JSON.stringify(completedOperationCells) === JSON.stringify(["-", "-", "-", "-", "查看"]), "已办结投诉工单操作列应为四个占位符和一个查看按钮：" + completedOperationCells.join("|"));
    await completedCustomerServiceRow.locator("[data-action='detail']").click();
    await page.waitForSelector(".ticket-detail-page");
    const completedDetailTabs = (await page.locator(".ticket-detail-page .detail-tabs .tab").allInnerTexts()).map(value => value.trim());
    assert(JSON.stringify(completedDetailTabs) === JSON.stringify(["基本信息", "处理信息", "流转记录", "客户画像"]), "客服系统已办结工单详情页签不符合要求：" + completedDetailTabs.join("、"));
    assert(await page.locator('.ticket-detail-page [data-ticket-detail-section="basic"]').count() === 1, "客服系统已办结工单缺少基本信息");
    await page.click("[data-detail-tab='处理信息']");
    await page.waitForSelector(".ticket-detail-page #section-processing-result");
    assert((await page.locator(".ticket-detail-page #section-processing-result").innerText()).includes("信用卡账单"), "客服系统已办结工单缺少处理信息");
    await page.click("[data-detail-tab='流转记录']");
    await page.waitForSelector(".ticket-detail-page .transfer-record-table");
    const completedWorkflowRows = page.locator(".ticket-detail-page .transfer-record-table tbody tr");
    assert(await completedWorkflowRows.count() === 8, "客服系统已办结工单应展示 8 条完整流转记录");
    const completedWorkflowScenes = (await completedWorkflowRows.locator("td:nth-child(4)").allInnerTexts()).map(value => value.trim());
    const completedWorkflowTransitions = (await completedWorkflowRows.locator("td:nth-child(7)").allInnerTexts()).map(value => value.replace(/\s+/g, " ").trim());
    assert(JSON.stringify(completedWorkflowScenes) === JSON.stringify(["复核工单", "复核工单", "派发工单", "处理工单", "发起会签", "会签通过", "处理审批", "办结归档"]), "客服系统已办结工单流转场景不完整：" + completedWorkflowScenes.join("、"));
    assert(JSON.stringify(completedWorkflowTransitions) === JSON.stringify(["草稿 → 待复核", "待复核 → 复核中", "复核中 → 待处理", "待处理 → 处理中", "处理中 → 会签中", "会签中 → 待审批", "待审批 → 审批中", "审批中 → 已办结"]), "客服系统已办结工单状态流转不完整：" + completedWorkflowTransitions.join("、"));
    await page.click("[data-detail-tab='客户画像']");
    await page.waitForSelector(".ticket-detail-page .ticket-customer-profile");
    assert((await page.locator(".ticket-detail-page").innerText()).includes("孙女士"), "客服系统已办结工单客户画像未按现有客户规则生成");
    await page.click("[data-page='ticket-create']");
    await page.waitForSelector(".ticket-list-table");
    const completedStatusFilter = page.locator(".ticket-create-filter-panel [data-filter-status-label='工单状态']");
    await completedStatusFilter.locator(".filter-status-trigger").click();
    await completedStatusFilter.locator("input[value='已办结']").check();
    await completedStatusFilter.locator("[data-filter-multi-confirm]").click();
    await page.locator(".ticket-create-filter-panel [data-action='search']").click();
    const completedSearchRows = page.locator(".ticket-list-table tbody tr:not([hidden]):not(.filter-empty-row)");
    assert(await completedSearchRows.count() === 4, "工单创建应只保留四类工单各一条现成的已办结样例");
    assert(await completedSearchRows.evaluateAll(rows => rows.every(row => row.querySelector('[data-flow-status]')?.dataset.flowStatus === "已办结")), "工单创建已办结筛选结果混入其他状态");
    const completedDemoIds = [completedCustomerServiceTicketId, "XF202608040001", "JY202607310104", "BY202607310103"];
    const completedIdsInList = await completedSearchRows.locator("td:nth-child(2)").allInnerTexts();
    assert(JSON.stringify(completedIdsInList.map(id => id.trim()).sort()) === JSON.stringify(completedDemoIds.sort()), "工单创建现成已办结工单不是指定的四条：" + completedIdsInList.join("、"));
    await page.locator(".ticket-list-table tr", { hasText:"XF202608040001" }).locator("[data-action='detail']").click();
    await page.waitForSelector(".ticket-detail-page");
    await page.click("[data-detail-tab='流转记录']");
    await page.waitForSelector(".ticket-detail-page .transfer-record-table tbody tr");
    const petitionTransitions = (await page.locator(".ticket-detail-page .transfer-record-table tbody tr td:nth-child(7)").allInnerTexts()).map(text => text.replace(/\s+/g, " ").trim());
    assert(JSON.stringify(petitionTransitions) === JSON.stringify(["草稿 → 待处理", "待处理 → 处理中", "处理中 → 待初审", "待初审 → 初审中", "初审中 → 待审批", "待审批 → 审批中", "审批中 → 已办结"]), "已办结信访单缺少连续的七步流转：" + petitionTransitions.join("、"));
    await page.click("[data-page='ticket-create']");
    await page.locator(".ticket-create-filter-panel [data-action='reset-filter']").click();

    const manuallyCompletedId = "TS202608040015";
    const manualContext = await browser.newContext();
    try {
      const manualPage = await manualContext.newPage();
      await manualPage.goto(`http://127.0.0.1:${port}/`, { waitUntil:"domcontentloaded" });
      const persistedTicketRows = seedData.lists.tickets.map(record => [record.id, record.type, record.customer, record.subject, record.org, record.id === manuallyCompletedId ? "已办结" : record.status, record.updatedAt]);
      await manualPage.evaluate(({ key, version, rows }) => localStorage.setItem(key, JSON.stringify({ version, rows:{ ticket:rows } })), {
        key:`xib-prototype-state-v${seedData.meta.storageVersion}`,
        version:seedData.meta.storageVersion,
        rows:persistedTicketRows
      });
      await manualPage.reload({ waitUntil:"domcontentloaded" });
      await manualPage.click("[data-page='ticket-create']");
      await manualPage.waitForSelector(".ticket-list-table");
      assert(await manualPage.locator(".ticket-list-table tbody tr", { hasText:manuallyCompletedId }).count() === 1, "用户后续手动办结的工单未出现在工单创建列表");
    } finally {
      await manualContext.close();
    }

    await page.locator(".ticket-list-table tr", { hasText:"TS202608040015" }).locator("[data-action='detail']").click();
    await page.waitForSelector(".ticket-detail-page");
    await page.click("[data-detail-tab='流转记录']");
    await page.waitForSelector(".ticket-detail-page .transfer-record-table");
    const splitWorkflowRows = page.locator(".ticket-detail-page .transfer-record-table tbody tr");
    const splitScenes = (await splitWorkflowRows.locator("td:nth-child(4)").allInnerTexts()).map(text => text.trim());
    assert(JSON.stringify(splitScenes) === JSON.stringify(["复核工单", "复核工单"]), "跨步投诉单未拆分为两次复核流转：" + splitScenes.join("、"));
    assert(JSON.stringify((await splitWorkflowRows.locator("td:nth-child(7)").allInnerTexts()).map(text => text.replace(/\s+/g, " ").trim())) === JSON.stringify(["草稿 → 待复核", "待复核 → 复核中"]), "草稿到复核中仍存在跨步状态流转");
    await page.click("[data-page='ticket-create']");
    await page.waitForSelector(".ticket-list-table");

    assert(await page.locator(".ticket-list-table tr", { hasText:"TS202501100201" }).count() === 0, "多余的历史办结工单仍出现在工单创建列表");

    await page.locator(".ticket-list-table tr", { hasText: submittedPetitionId }).locator("[data-action='detail']").click();
    await page.waitForSelector(".ticket-detail-page");
    const petitionDetail = await page.locator(".ticket-detail-page").innerText();
    const petitionDetailLabels = (await page.locator(".ticket-detail-page .detail-sections dt").allInnerTexts()).map(label => label.trim());
    assert(petitionDetailLabels.includes("客户信访时间"), "信访单受理信息缺少客户信访时间");
    assert(petitionDetailLabels.includes("接收时间"), "信访单受理信息缺少独立的接收时间");
    assert(petitionDetail.includes(submittedPetitionDeadline), "已提交信访单未展示手工录入处置期限");
    assert(!petitionDetail.includes("人行标准"), "信访单详情页仍显示人行标准分区");
    assert(!petitionDetail.includes("金管投诉分类"), "信访单详情页仍显示金管投诉分类分区");
    await page.click("[data-detail-tab='流转记录']");
    await page.waitForSelector(".ticket-detail-page .transfer-record-table");
    const workflowTable = page.locator(".ticket-detail-page .transfer-record-panel .transfer-record-table").first();
    const workflowHeaders = await workflowTable.locator("thead th").allInnerTexts();
    assert(JSON.stringify(workflowHeaders.map(value => value.trim())) === JSON.stringify(["操作人", "角色", "机构", "流转场景", "流转意见", "接收对象", "状态流转", "操作时间"]), "工单流转记录未按八字段契约展示：" + workflowHeaders.join("、"));
    const workflowTimes = await workflowTable.locator("tbody tr td:last-child").allInnerTexts();
    assert(workflowTimes.filter(value => value.trim() !== "-").every(value => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value.trim())), "流转记录操作时间未精确到秒");
    assert((await page.locator(".ticket-detail-page .flow-status-pair").count()) > 0, "流转记录未展示原状态到新状态");
    const systemRows = workflowTable.locator("tbody tr", { has:page.locator("td:first-child", { hasText:"系统" }) });
    if (await systemRows.count()) assert((await systemRows.first().locator("td").nth(1).innerText()).trim() === "-", "系统操作的角色未显示为空状态");
    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='branch-unit']");
    await page.click("[data-role-profile='branch-handler']");
    await page.waitForSelector("[data-page='ticket-process']");
    await page.evaluate(() => document.querySelector("[data-page='ticket-process']").click());
    await page.waitForFunction(() => document.querySelector(".page h1")?.textContent.includes("工单处理"));
    await page.waitForSelector(".ticket-list-table");
    await assertFourColumnFilterRow(page.locator(".process-ticket-filter-panel .is-primary-row"), "工单处理业务状态行");
    await assertFourColumnFilterRow(page.locator(".process-ticket-filter-panel .is-base-row"), "工单处理流程辅助行");
    assert(JSON.stringify(await page.locator(".process-ticket-filter-panel .is-customer-row label").allInnerTexts()) === JSON.stringify(["客户类型", "客户姓名", "联系方式"]), "工单处理客户信息未固定在同一独立行");
    assert(await page.locator(".process-ticket-filter-panel .is-customer-row .ticket-filter-item", { hasText:"客户类型" }).locator("select").count() === 1, "工单处理客户类型不是下拉框");
    assert(await page.locator(".process-ticket-filter-panel .is-customer-row .ticket-filter-item", { hasText:"联系方式" }).locator("input").count() === 1, "工单处理联系方式不是输入框搜索");
    await assertDeadlineOnlySort(".ticket-list-table", "工单处理");
    const ticketPoolCounts = await page.locator(".scope-card b").evaluateAll(nodes => nodes.map(node => Number(node.textContent.trim())));
    assert(ticketPoolCounts.length === 3 && ticketPoolCounts.every(count => count > 0), "工单处理存在无样例数据的分栏");
    assert(await page.locator(".ticket-list-table [data-ticket-list-kind='抄送']").count() === 0, "个人工作台待办不应显示抄送标识");
    assert(!(await page.locator(".ticket-list-table").innerText()).includes("已办结"), "工单处理仍展示已办结工单");
    const ticketProcessHeaderText = await page.locator(".ticket-list-table thead").innerText();
    assert(ticketProcessHeaderText.includes("工单接收机构") && ticketProcessHeaderText.includes("所属业务条线"), "工单处理列表未同时显示工单接收机构与所属业务条线");
    await page.locator(".ticket-list-table .column-customizer-trigger").click();
    const processColumnLabels = await page.locator('.column-customizer-popover[data-runtime]:not([hidden]) .column-customizer-options span').allInnerTexts();
    assert(!processColumnLabels.includes("投诉原因"), "工单处理列表显示字段仍含投诉原因");
    await page.locator(".ticket-list-table .column-customizer-trigger").click();
    const ticketProcessBusinessHeaders = await page.locator(".ticket-list-table thead th").evaluateAll(headers => headers.map(header => header.textContent.replace(/[↑↓↕]/g, "").trim()).filter(label => label && label !== "操作"));
    const receivingDepartmentIndex = ticketProcessBusinessHeaders.indexOf("工单接收部门");
    assert(receivingDepartmentIndex === ticketProcessBusinessHeaders.indexOf("工单接收机构") + 1, "工单接收部门未紧跟在工单接收机构之后");
    assert(await page.locator('[data-filter-status-label="所属业务条线"]').count() === 1, "工单处理缺少所属业务条线多选筛选");
    const processInstitutionFilter = page.locator('.process-ticket-filter-panel [data-app-hierarchy-cascader][data-field-key="filter.ticket.org"]');
    assert((await processInstitutionFilter.getAttribute("data-multiple")) === "true", "工单处理机构范围未启用多选");
    assert((await processInstitutionFilter.getAttribute("data-searchable")) === "true", "工单处理机构范围未启用模糊搜索");
    await processInstitutionFilter.locator(".di-hierarchy-cascader-trigger").click();
    const institutionSearch = processInstitutionFilter.locator("[data-hierarchy-search]");
    await institutionSearch.fill("湖里");
    assert(await processInstitutionFilter.locator('[data-hierarchy-search-toggle="厦门分行 / 厦门湖里支行"]').count() === 1, "机构范围模糊搜索未命中厦门湖里支行");
    const refreshedInstitutionFilter = page.locator('.process-ticket-filter-panel [data-app-hierarchy-cascader][data-field-key="filter.ticket.org"]');
    const refreshedInstitutionSearch = refreshedInstitutionFilter.locator("[data-hierarchy-search]");
    await refreshedInstitutionSearch.evaluate(input => { input.value = ""; input.dispatchEvent(new Event("input", { bubbles:true })); });
    await refreshedInstitutionFilter.locator(".di-hierarchy-cascader-trigger").click();
    await refreshedInstitutionFilter.locator(".di-hierarchy-cascader-trigger").click();
    await refreshedInstitutionFilter.locator('[data-hierarchy-parent="厦门分行"]').evaluate(element => element.click());
    const xiamenLeafValues = await refreshedInstitutionFilter.locator("[data-hierarchy-toggle]").evaluateAll(nodes => nodes.map(node => node.dataset.hierarchyToggle));
    assert(xiamenLeafValues.length > 1, "厦门分行缺少本体或下辖支行选项");
    for (const value of xiamenLeafValues) await refreshedInstitutionFilter.locator('[data-hierarchy-toggle="' + value + '"]').evaluate(element => element.click());
    const xiamenGroupValue = "厦门分行 / 厦门分行及其下辖所有支行";
    assert((await refreshedInstitutionFilter.locator('input[type="hidden"]').inputValue()) === xiamenGroupValue, "手动选齐分行本体和支行后未自动化简");
    assert(await refreshedInstitutionFilter.locator('[data-hierarchy-descendants="厦门分行"]').isChecked(), "手动选齐后快速全选复选框未自动勾选");
    assert(await refreshedInstitutionFilter.locator("[data-hierarchy-toggle][aria-pressed='true']").count() === xiamenLeafValues.length, "快速全选后分行本体和支行未全部显示已选择");
    const groupedInstitutionTags = refreshedInstitutionFilter.locator("[data-hierarchy-selected] .hierarchy-selected-tag");
    assert(await groupedInstitutionTags.count() === 1, "branch group must render one selected tag");
    assert((await groupedInstitutionTags.locator(".hierarchy-tag-leaf").innerText()).trim() === xiamenGroupValue.split(" / ").at(-1), "branch group tag must show only its collapsed label");
    assert(await groupedInstitutionTags.locator(".hierarchy-tag-prefix").count() === 0, "branch group tag must not repeat the parent prefix");
    await refreshedInstitutionFilter.locator('[data-hierarchy-toggle="' + xiamenLeafValues.at(-1) + '"]').evaluate(element => element.click());
    assert(!(await refreshedInstitutionFilter.locator('[data-hierarchy-descendants="厦门分行"]').isChecked()), "取消一个支行后快速全选复选框仍被勾选");
    assert((await refreshedInstitutionFilter.locator('input[type="hidden"]').inputValue()).split(",").filter(Boolean).length === xiamenLeafValues.length - 1, "取消一个支行后未展开为具体机构选择");
    await refreshedInstitutionFilter.locator('[data-hierarchy-descendants="厦门分行"]').evaluate(element => element.click());
    assert((await refreshedInstitutionFilter.locator('input[type="hidden"]').inputValue()) === xiamenGroupValue, "快速全选未重新化简分行及全部支行");
    await refreshedInstitutionFilter.locator("[data-hierarchy-confirm]").evaluate(element => element.click());
    assert((await refreshedInstitutionFilter.locator(".di-hierarchy-cascader-trigger span").innerText()).trim() === "已选 " + xiamenLeafValues.length + " 项", "折叠摘要未按分行本体和支行实际总数计数");
    await page.locator(".process-ticket-filter-panel [data-action='search']").click();
    assert(await page.locator(".ticket-list-table tbody tr:not([hidden]):not([data-empty-state])").count() > 0, "机构范围多选结果未参与工单筛选");
    const processPanelBeforeReset = await page.locator(".process-ticket-filter-panel").elementHandle();
    await page.locator(".process-ticket-filter-panel [data-action='reset-filter']").click();
    await page.waitForFunction(panel => !panel?.isConnected, processPanelBeforeReset);
    const resetProcessInstitutionFilter = page.locator('.process-ticket-filter-panel [data-app-hierarchy-cascader][data-field-key="filter.ticket.org"]');
    assert((await resetProcessInstitutionFilter.locator(".di-hierarchy-cascader-trigger span").innerText()).trim() === "请选择工单接收机构", "工单接收机构重置后折叠文案未恢复");
    await resetProcessInstitutionFilter.locator(".di-hierarchy-cascader-trigger").click();
    assert((await resetProcessInstitutionFilter.locator("[data-hierarchy-search]").inputValue()) === "", "\u673a\u6784\u8303\u56f4\u91cd\u7f6e\u540e\u641c\u7d22\u8bcd\u672a\u6e05\u7a7a");
    await page.waitForFunction(() => {
      const host = document.querySelector('.process-ticket-filter-panel [data-app-hierarchy-cascader][data-field-key="filter.ticket.org"]');
      const checkbox = host?.querySelector('[data-hierarchy-descendants="\u53a6\u95e8\u5206\u884c"]');
      if (!checkbox) host?.querySelector('[data-hierarchy-parent="\u53a6\u95e8\u5206\u884c"]')?.click();
      return checkbox && !checkbox.checked;
    });
    assert(await resetProcessInstitutionFilter.locator("[data-hierarchy-toggle][aria-pressed=\"true\"]").count() === 0, "\u673a\u6784\u8303\u56f4\u91cd\u7f6e\u540e\u5185\u90e8\u9009\u4e2d\u72b6\u6001\u672a\u6e05\u7a7a");
    await resetProcessInstitutionFilter.locator("[data-hierarchy-confirm]").evaluate(element => element.click());
    const processDepartmentFilter = page.locator('[data-receiving-department-filter="process"]');
    assert(await processDepartmentFilter.count() === 1 && !(await processDepartmentFilter.isDisabled()), "消保视角的工单接收部门筛选应默认全部且可选");
    const processDepartmentOptions = await processDepartmentFilter.locator("option:not(:first-child)").allTextContents();
    const processDepartmentCells = await page.locator(".ticket-list-table tbody tr:not([data-empty-state]) td:nth-child(" + (receivingDepartmentIndex + 2) + ")").allTextContents();
    assert(processDepartmentOptions.every(option => processDepartmentCells.map(value => value.trim()).includes(option.trim())), "工单接收部门筛选项不是当前列表的全量部门");
    if (processDepartmentOptions.length) {
      await processDepartmentFilter.selectOption({ label:processDepartmentOptions[0] });
      await page.waitForFunction(value => [...document.querySelectorAll(".ticket-list-table tbody tr:not([data-empty-state])")].every(row => row.children[6]?.textContent.trim() === value), processDepartmentOptions[0]);
      await page.locator(".process-ticket-filter-panel [data-action='reset-filter']").click();
      await page.waitForFunction(() => document.querySelector('[data-receiving-department-filter="process"]')?.value === "");
    }
    await page.click("[data-scope='机构工单池']");
    await page.waitForFunction(() => document.querySelector("[data-scope='机构工单池']")?.classList.contains("is-active"));
    assert(await page.locator(".ticket-list-table [data-action='transfer']").count() > 0, "工单处理机构工单池缺少转派操作");
    assert(await page.locator(".ticket-list-table [data-ticket-list-kind='抄送']").count() === 0, "机构工单池不应在工单类型旁显示抄送标签");
    await page.click("[data-scope='下辖工单池']");
    await page.waitForFunction(() => document.querySelector("[data-scope='下辖工单池']")?.classList.contains("is-active"));
    assert(await page.locator(".ticket-list-table [data-ticket-list-kind='抄送']").count() === 0, "下辖工单池不应在工单类型旁显示抄送标签");
    const ticketSubordinateActions = await page.locator(".ticket-list-table tbody tr:not([data-empty-state])").first().locator("[data-action]").evaluateAll(nodes => nodes.map(node => node.dataset.action));
    assert(JSON.stringify(ticketSubordinateActions.slice(0, 2)) === JSON.stringify(["remind", "detail"]), "不可召回的工单操作顺序应为催办、查看");
    assert(await page.locator('.ticket-list-table [data-action="recall-transfer"], .ticket-list-table [data-unavailable-action="recall-transfer"]').count() === 0, "工单下辖工单池仍保留已废弃的召回入口或占位");
    await page.click("[data-scope='我的工作台']");
    await page.waitForFunction(() => document.querySelector("[data-scope='我的工作台']")?.classList.contains("is-active"));
    await page.click("[data-process-tab='全部']");
    assert(await page.locator(".ticket-list-table [data-ticket-list-kind='抄送']").count() === 0, "个人工作台全部不应显示抄送标识");
    await page.click("[data-process-tab='待办']");
    const processingRow = page.locator(".ticket-list-table tr", { hasText: "TS202607230012" });
    assert(await processingRow.locator("[data-ticket-list-kind='抄送']").count() === 0, "切回工作台后抄送标识应消失");
    await processingRow.locator("[data-action='process']").click();
    await page.waitForSelector("[data-detail-tab='基本信息']");
    const expectedDetailLabels = expectedTicketDetailLabels("TS202607230012");
    const renderedDetailLabels = (await page.locator(".ticket-detail-page .detail-sections dt").allInnerTexts()).map(label => label.trim());
    for (const label of expectedDetailLabels) assert(renderedDetailLabels.includes(label), "工单详情缺少 schema 字段：" + label);
    assert(!renderedDetailLabels.includes("是否有客户编号") && !renderedDetailLabels.includes("投诉人数"), "工单详情客户信息仍展示了已删除字段");
    const detailCustomerCard = page.locator('[data-ticket-detail-section="customer"] [data-ticket-detail-customer-card="1"]');
    assert(await detailCustomerCard.count() === 1, "工单详情未按客户信息卡片展示");
    assert(await detailCustomerCard.evaluate(card => card.open), "客户信息卡片默认未展开");
    await detailCustomerCard.locator("summary").click();
    assert(!(await detailCustomerCard.evaluate(card => card.open)), "客户信息卡片不支持折叠");
    await detailCustomerCard.locator("summary").click();
    const detailDispatchCopy = page.locator('[data-ticket-detail-section="intelligent-dispatch"] .detail-descriptions div', { has:page.locator("dt", { hasText:"抄送人" }) });
    assert(await detailDispatchCopy.count() === 1, "工单详情应固定显示抄送人字段");
    assert((await detailDispatchCopy.locator("dd").innerText()).trim() === "-", "未命中自动抄送规则的详情值应为空状态");
    assert(!renderedDetailLabels.includes("自动派发至"), "工单详情的智能派发信息应由派发部门和抄送人表达");
    for (const label of ["受理渠道", "客户投诉时间", "处置期限", "转送时间", "接收时间", "转送函号", "投诉次数", "是否发送短信", "联系人姓名", "联系人证件号码", "联系人性别", "联系方式", "联系方式2"]) assert(renderedDetailLabels.includes(label), "受理信息缺少字段：" + label);
    assert(!renderedDetailLabels.includes("录音编号"), "在线客服详情不应显示客服电话录音编号");
    assert(await page.locator(".smart-tag-section .smart-tag-detail-item").count() === 4, "智能标签未按四个字段展示");
    assert(await page.locator(".correction-tag-form-section").count() === 0, "修正标签仍作为独立模块展示");
assert(await page.locator(".smart-tag-section [data-action='edit-correction-tag']").count() === 4, "智能标签缺少逐字段编辑入口");
    assert(await page.locator(".smart-tag-detail-item dd .smart-tag-edit img[src='ui/assets/edit2.svg']").count() === 4, "智能标签编辑按钮未使用 edit2.svg 或未位于字段值单元格");
    assert(await page.locator(".smart-tag-detail-item dt .smart-tag-edit").count() === 0, "智能标签编辑按钮仍位于字段名称旁");
    await page.evaluate(() => { window.__smartTagPageRoot = document.getElementById("page-root"); });
    await page.locator(".smart-tag-section [data-action='edit-correction-tag']").first().click();
const inlineTagEditor = page.locator(".smart-tag-inline-editor");
    assert(await page.evaluate(() => window.__smartTagPageRoot === document.getElementById("page-root")), "打开智能标签编辑器时发生整页重渲染");
    assert(!(await page.locator(".smart-tag-detail-item.is-editing").first().evaluate(item => item.classList.contains("is-wide"))), "智能标签编辑器错误扩展为全宽");
    await inlineTagEditor.locator(".di-hierarchy-cascader-trigger").click();
    const inlinePopoverState = await inlineTagEditor.locator(".di-hierarchy-cascader-popover").evaluate(node => ({ hidden:node.hidden, zIndex:Number(getComputedStyle(node).zIndex || 0), width:node.getBoundingClientRect().width }));
    assert(!inlinePopoverState.hidden && inlinePopoverState.zIndex >= 140 && inlinePopoverState.width > 0, "智能标签级联弹层图层或尺寸异常");
    await inlineTagEditor.locator("[data-hierarchy-parent]").first().click();
    await inlineTagEditor.locator("[data-hierarchy-toggle]").first().click();
    await inlineTagEditor.locator("[data-action='save-correction-tag']").click();
    await page.waitForFunction(() => document.querySelector(".smart-tag-detail-item")?.textContent.includes("不可用，已被修改"));
    assert((await page.locator(".smart-tag-detail-item").first().innerText()).includes("不可用，已被修改"), "保存修正标签后未保留并灰显原标签");
    assert(await page.evaluate(() => window.__smartTagPageRoot === document.getElementById("page-root")), "保存智能标签时发生整页重渲染");
    await page.click("[data-detail-tab='处理信息']");
    await page.waitForSelector(".linked-subprocess-table", { timeout: 3000 }).catch(async () => { throw new Error("处理信息未渲染关联子流程列表；页面错误：" + errors.join(" | ") + "；当前标签：" + await page.locator(".detail-tabs").innerText()); });
    const processingNoticeField = page.locator('[data-field-key$=".处理结果是否告知"]');
    assert(await processingNoticeField.locator("xpath=ancestor::*[@data-app-select]").count() === 1, "主工单处理结果是否告知未使用下拉框");
    assert(await processingNoticeField.locator("xpath=ancestor::*[@data-app-radio]").count() === 0, "主工单处理结果是否告知仍使用单选按钮");
    // 处理阶段只填写告知信息；核查结果进入审批阶段后单独展示。
    assert(await page.locator(".embedded-contact-block .embedded-intelligent-inspection").count() === 0, "处理阶段不应展示核查结果");
    assert(await page.locator(".embedded-contact-block .contact-record-inspection-reminder").count() === 1, "联系记录缺少常态提醒");
    assert(await page.locator("#section-processing-intelligent-inspection").count() === 0, "页面仍保留独立的智能核查区块");
    assert(await page.locator(".risk-view-switch button").count() === 0, "普通处理员不应看到开发测试视角切换");
    assert((await page.locator("#section-risk-summary .panel-title").innerText()).trim() === "异常风险识别", "风险提示未更名为异常风险识别");
    assert(await page.locator("#section-risk-summary .risk-demo-notice").count() === 0, "风险结果视角不应展示演示数据提示");
    assert(!(await page.locator("#section-risk-summary .panel-head").innerText()).includes("AI 分析来源"), "风险提示标题仍展示 AI 分析来源");
    assert(await page.locator('.risk-record-list[data-risk-view="success"] .risk-record-item').count() >= 1, "已回传外呼缺少风险结果");
    const riskTimes = await page.locator(".risk-record-meta>div:first-child strong").allInnerTexts();
    assert(JSON.stringify(riskTimes) === JSON.stringify([...riskTimes].sort().reverse()), "外呼风险结果未按联系时间降序排列");
    assert(await page.locator(".risk-record-result-head", { hasText:"投诉内容是否存在风险" }).count() >= 1, "外呼结果缺少投诉内容风险");
    assert(await page.locator(".risk-record-result-head", { hasText:"是否疑似黑灰产" }).count() >= 1, "外呼结果缺少疑似黑灰产");
    assert(!(await page.locator(".risk-record-meta").first().innerText()).includes("第 1 笔外呼"), "异常风险识别仍显示外呼序号");
    assert((await page.locator(".risk-record-meta").first().innerText()).includes("外呼时间") && (await page.locator(".risk-record-meta").first().innerText()).includes("录音编号"), "外呼结果摘要缺少时间或录音编号");
    assert(await page.locator(".risk-manual-row.is-global").count() === 1, "人工标签未作为模型结果外的独立区域展示");
    assert(await page.locator("[data-manual-risk-category]").count() === 1 && await page.locator("[data-manual-risk-label]").count() === 1, "人工标签缺少一级、二级标签联动选择");
    assert(await page.locator("[data-manual-risk-level]").count() === 1, "人工标签未自动关联风险等级");
    await page.locator('[data-action="add-manual-risk-tag"]').click();
    assert(await page.locator('.risk-manual-tag [data-action="remove-manual-risk-tag"]').count() >= 1, "人工标签不支持增加或删除");
    await page.locator('[data-action="risk-record-detail"]').first().click();
    assert(await page.locator(".risk-record-detail-modal").count() === 1, "逐笔风险查看详情未打开弹窗");
    assert(await page.locator(".risk-record-detail-reasons article").count() >= 2, "风险详情未逐个展示标签及判断原因");
    await page.locator("#modal-confirm").click();
    assert(await page.locator("#section-risk-summary .risk-notice").count() === 0, "客户历史投诉提醒仍显示在风险提示中");
    if (await page.locator("#section-processing-repeat .repeat-complaint-history").count()) {
      assert((await page.locator("#section-processing-repeat .repeat-complaint-history").innerText()).includes("重复投诉"), "再次投诉模块缺少历史投诉提醒");
    }
    await processingNoticeField.locator("xpath=ancestor::*[@data-app-select]").locator(".di-select-trigger").click();
    await processingNoticeField.locator("xpath=ancestor::*[@data-app-select]").locator('[data-select-value="否"]').click();
    await page.waitForFunction(() => document.querySelector('[data-field-key$=".处理结果是否告知"]')?.value === "否");
    const notifiedContactField = page.locator('.form-item[data-field-name="告知时间"]');
    await page.waitForFunction(() => !document.querySelector('.form-item[data-field-name="告知时间"] .form-label.required'));
    assert(await notifiedContactField.locator(".form-label.required").count() === 0, "未告知时告知时间应为选填");
    assert(await page.locator('#section-processing-result .form-item[data-field-name="告知沟通方式"]').count() === 1, "处理结果缺少自动回填的告知方式");
    const noticeSelect = page.locator('[data-field-key$=".处理结果是否告知"]').locator("xpath=ancestor::*[@data-app-select]");
    await noticeSelect.locator(".di-select-trigger").click();
    await noticeSelect.locator('[data-select-value="是"]').click();
    await page.waitForFunction(() => document.querySelector('[data-field-key$=".处理结果是否告知"]')?.value === "是");
    await page.waitForFunction(() => Boolean(document.querySelector('.form-item[data-field-name="告知时间"] .form-label.required')));
    assert(await notifiedContactField.locator(".form-label.required").count() === 1, "已告知时告知时间应为必选");
    await notifiedContactField.locator(".di-select-trigger").click();
    await notifiedContactField.locator("[data-select-value]").first().click();
    await page.waitForFunction(() => Boolean(document.querySelector('.form-item[data-field-name="告知沟通方式"] input')?.value));
    assert((await page.locator('.form-item[data-field-name="告知沟通方式"] input').inputValue()).length > 0, "选择告知时间后未回填告知方式");
    const reliefNoticeField = page.locator('.form-item[data-field-name="救济途径是否告知"]');
    assert(JSON.stringify(await reliefNoticeField.locator('[data-radio-value]').evaluateAll(buttons => buttons.map(button => button.dataset.radioValue))) === JSON.stringify(["是", "否"]), "救济途径是否告知不是是/否单选");
    assert(await reliefNoticeField.locator('input[type="checkbox"]').count() === 0, "救济途径是否告知仍显示旧复选选项");
    await reliefNoticeField.locator('[data-radio-value="否"]').click();
    assert((await reliefNoticeField.locator('input[type="hidden"]').inputValue()) === "否", "救济途径是否告知不能选择否");
    await reliefNoticeField.locator('[data-radio-value="是"]').click();
    assert((await reliefNoticeField.locator('input[type="hidden"]').inputValue()) === "是", "救济途径是否告知不能选择是");
    const reliefField = page.locator('.form-item[data-field-name="救济途径"]');
    assert(await reliefField.count() === 0, "投诉单处理页面仍展示已删除的救济途径字段");
    assert(await page.locator("#section-risk-summary [data-risk-card]").count() === 0, "逐笔结果下方仍显示重复的汇总风险卡片");
    assert(await page.locator("#section-processing-related-subprocess").count() === 0 && !(await page.locator(".processing-layout .form-anchor").innerText()).includes("关联子流程信息"), "工单处理详情仍展示重复的关联子流程信息区块");
    assert(await page.locator(".contact-record-table [data-action='resend-sms']").count() === 1, "未送达的办结告知短信未展示重发操作");
    assert(await page.locator('[data-pagination-scope^="contact-records-"]').count() === 0, "联系记录宣讲视图仍显示分页器");
    assert(await page.locator(".contact-record-table tbody tr").count() > 0, "联系记录未展示当前工单数据");
    const contactHeaders = (await page.locator(".contact-record-table thead th").allInnerTexts()).map(text => text.trim());
    const methodIndex = contactHeaders.indexOf("沟通方式");
    const approvalIndex = contactHeaders.indexOf("短信审批状态");
    const contactIndex = contactHeaders.indexOf("联系状态");
    const seenMethods = new Set();
    const seenApprovals = new Set();
    const seenContacts = new Set();
    const seenColors = new Set();
    for (const cells of await page.locator(".contact-record-table tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].map(cell => cell.innerText.trim())))) {
      seenMethods.add(cells[methodIndex].split(" · ")[0]);
      seenApprovals.add(cells[approvalIndex]);
      seenContacts.add(cells[contactIndex]);
    }
    for (const style of await page.locator(".contact-record-table .status-tag").evaluateAll(nodes => nodes.map(node => node.getAttribute("style") || ""))) {
      const color = style.match(/--tag-color:([^;]+)/)?.[1];
      if (color) seenColors.add(color);
    }
    assert(seenMethods.has("一键外呼") && seenMethods.has("短信沟通"), "当前工单缺少外呼或短信联系记录");
    assert(seenApprovals.has("已通过") && seenContacts.has("已联系"), "当前工单缺少已完成联系记录");
    assert(seenColors.size <= 2, "联系记录状态标签使用超过两种颜色");
    assert(await page.locator("[data-action='export-contacts']").count() === 0, "联系记录仍显示导出联系记录按钮");
    await page.locator('[data-action="call-customer"]').first().click();
    await page.waitForSelector(".contact-call-picker");
    assert(await page.locator('input[name="outbound-number-mode"]').count() === 2, "一键外呼弹窗缺少两种号码来源");
    assert(await page.locator('input[name="outbound-number-mode"][value="existing"]').isChecked(), "一键外呼未默认选择已有联系方式");
    assert(await page.locator('input[name="outbound-number"]').count() === 3, "一键外呼未读取来电号码、联系方式1、联系方式2");
    const manualOutboundNumber = page.locator("#outbound-manual-number");
    assert(await manualOutboundNumber.count() === 1 && (await manualOutboundNumber.getAttribute("type")) === "tel", "一键外呼弹窗缺少手动电话号码输入框");
    assert(await page.locator("[data-outbound-manual]").isHidden(), "一键外呼默认状态不应展示手动输入框");
    await page.locator('input[name="outbound-number-mode"][value="manual"]').check();
    assert(await page.locator("[data-outbound-existing]").isHidden() && await page.locator("[data-outbound-manual]").isVisible(), "一键外呼号码来源切换未联动内容区");
    await manualOutboundNumber.fill("0592-12345678");
    const contactTotalBeforeCall = await page.locator(".contact-record-table tbody tr").count();
    await page.getByRole("button", { name:"外呼", exact:true }).click();
    await page.waitForSelector("#contact-call-stage");
    assert((await page.locator("#contact-call-stage p").innerText()).includes("手动输入 · 0592-12345678"), "手动输入电话号码未用于发起外呼");
    assert((await page.locator("#call-live-copy").innerText()) === "通话中", "外呼开始后未显示通话中状态");
    assert(await page.locator("#call-duration").isVisible() && await page.locator("#hangup-call").isVisible(), "通话中缺少计时或挂断按钮");
    const liveFeedbackForm = page.locator("#call-feedback-form");
    assert(await liveFeedbackForm.isVisible(), "点击外呼后未直接展示通话反馈记录表单");
    assert(await page.locator("#save-call-feedback").isDisabled(), "挂断前不应允许保存通话反馈");
    const callSummaryLabels = await page.locator(".contact-call-summary dt").allInnerTexts();
    assert(JSON.stringify(callSummaryLabels) === JSON.stringify(["客户姓名", "电话号码", "沟通方式", "联系时间"]), "通话反馈概要字段顺序不正确或仍包含通话时长");
    assert((await page.locator("#call-main-content").inputValue()).includes("客户主张/诉求"), "联系主要内容未默认置入可编辑模板");
    assert((await page.locator("#call-feedback").inputValue()).includes("客户最终态度"), "沟通反馈意见未默认置入可编辑模板");
    assert(await page.locator("#call-main-content").getAttribute("maxlength") === "2000" && await page.locator("#call-feedback").getAttribute("maxlength") === "2000", "通话反馈字段未限制为 2000 字");
    await page.locator("#call-main-content").fill("客户主张/诉求：核实扣费。\n我行解释/方案：已说明处理时限，挂断后补充核查范围。");
    await page.locator("#call-feedback").fill("客户最终态度：知悉。\n跟进意见说明：挂断后补充，按期反馈处理结果。");
    assert((await page.locator("#call-main-content").inputValue()).includes("挂断后补充核查范围"), "联系主要内容不可编辑");
    assert((await page.locator("#call-feedback").inputValue()).includes("挂断后补充"), "沟通反馈意见不可编辑");
    await page.locator("#hangup-call").click();
    assert((await page.locator("#call-live-copy").innerText()) === "通话已结束", "挂断后通话状态未更新");
    assert(await page.locator("#save-call-feedback").isEnabled(), "挂断后应允许保存通话反馈");
    await page.locator("#save-call-feedback").click();
    await page.waitForSelector(".contact-result.is-success");
    assert((await page.locator(".contact-result").innerText()).includes("通话反馈已保存并写入联系记录"), "保存通话反馈后未显示通话反馈记录页面");
    const resultLabels = await page.locator(".contact-result .contact-confirm-list dt").allInnerTexts();
    assert(JSON.stringify(resultLabels) === JSON.stringify(["工单编号", "客户姓名", "处理机构", "沟通方式", "电话号码", "联系时间", "联系状态", "联系主要内容", "沟通反馈意见"]), "通话反馈记录字段不正确");
    ["通话时长", "接听状态", "短信审批状态", "附件"].forEach(label => assert(!resultLabels.includes(label), "通话反馈记录仍展示字段：" + label));
    assert((await page.locator(".contact-result .contact-confirm-list").innerText()).includes("已联系"), "通话反馈记录未保留已联系状态");
    await page.locator(".modal-foot [data-close-overlay]").click();
    await page.waitForSelector(".contact-result", { state:"detached" });
    await page.waitForFunction(expectedCount => document.querySelectorAll(".contact-record-table tbody tr").length === expectedCount, contactTotalBeforeCall + 1);
    assert(await page.locator(".contact-record-table tbody tr").count() === contactTotalBeforeCall + 1, "保存通话反馈后未新增联系记录");
    // 表格按沟通方式排序，新增记录不一定在最后一行；按原始记录序号定位。
    const newestContactIndex = await page.locator(".contact-record-table [data-action='contact-detail']").evaluateAll(nodes => Math.max(...nodes.map(node => Number(node.dataset.id))));
    const outboundContent = page.locator('.contact-record-table [data-action="contact-detail"][data-id="' + newestContactIndex + '"]');
    await outboundContent.click();
    const outboundDetailLabels = await page.locator("#overlay-root .contact-confirm-list dt").allInnerTexts();
    assert(!outboundDetailLabels.includes("附件"), "查看联系内容悬浮窗仍显示附件行");
    assert(!outboundDetailLabels.includes("通话时长"), "查看联系内容悬浮窗仍显示通话时长");
    assert(!outboundDetailLabels.includes("接听状态"), "查看联系内容悬浮窗仍显示接听状态");
    assert(await page.locator("#contact-record-content").isEditable() && await page.locator("#contact-record-feedback").isEditable(), "查看联系内容中的反馈字段不可编辑");
    assert((await page.locator("#modal-confirm").innerText()).trim() === "保存更改", "查看联系内容弹窗按钮未改为保存更改");
    await page.locator("#contact-record-content").fill("客户补充：已核实扣费明细。");
    await page.locator("#contact-record-feedback").fill("客户反馈：已知悉处理结果。");
    await page.locator("#modal-confirm").click();
    await page.waitForSelector("#contact-record-content", { state:"detached" });
    await page.waitForTimeout(150);
    await outboundContent.click();
    assert((await page.locator("#contact-record-content").inputValue()) === "客户补充：已核实扣费明细。", "联系主要内容修改后未保存");
    assert((await page.locator("#contact-record-feedback").inputValue()) === "客户反馈：已知悉处理结果。", "沟通反馈意见修改后未保存");
    await page.locator(".modal-foot [data-close-overlay]").click();
    const outboundAttachment = page.locator(".contact-record-table [data-action='contact-attachment']", { hasText:"查看附件" }).first();
    assert((await outboundAttachment.innerText()).trim() === "查看附件", "已回传附件未显示统一的查看附件按钮");
    await outboundAttachment.click();
    await page.waitForSelector(".contact-attachment-layout");
    assert((await page.locator("#overlay-root .modal-head").innerText()).includes("查看附件"), "一键外呼附件未打开查看附件悬浮窗");
    assert(await page.locator(".contact-attachment-card").count() === 2, "查看附件悬浮窗未显示录音文件和录音转文本两张卡片");
    assert(await page.locator(".contact-audio-player").count() === 0, "查看附件悬浮窗仍存在内嵌在线播放器");
    assert((await page.locator(".contact-attachment-meta dt").allInnerTexts()).includes("录音编号"), "录音附件元数据缺少录音编号");
    assert(await page.locator(".modal-foot button").count() === 1, "查看附件悬浮窗底部应只保留一个按钮");
    assert((await page.locator("#modal-confirm").innerText()).trim() === "关闭", "查看附件悬浮窗保留的按钮不是关闭");
    assert(await page.locator(".contact-transcript-entry").count() >= 3, "录音转译文本缺少模拟对话内容");
    assert(await page.locator(".contact-transcript-text").evaluate(element => getComputedStyle(element).overflowY) === "auto", "录音转译文本缺少独立滚动区");
    assert(!(await page.locator(".contact-attachment-card-head").first().innerText()).includes("通话录音_"), "录音文件卡片右上角仍显示文件名");
    assert(!(await page.locator(".contact-attachment-meta dt").allInnerTexts()).includes("通话时长"), "录音附件元数据仍显示通话时长");
    await page.locator("#modal-confirm").click();
    await page.locator('[data-action="send-sms"]').first().click();
    await page.waitForSelector(".contact-sms-layout");
    assert(await page.locator('input[name="sms-number-mode"]').count() === 2, "短信沟通弹窗缺少两种接收号码来源");
    assert(await page.locator('input[name="sms-number-mode"][value="existing"]').isChecked(), "短信沟通未默认选择已有接收号码");
    assert(await page.locator("[data-sms-manual]").isHidden(), "短信沟通默认状态不应展示手动号码输入框");
    const smsConclusion = page.locator("#sms-conclusion");
    assert(await smsConclusion.getAttribute("maxlength") === "300", "短信处理结论未限制为 300 字");
    await smsConclusion.fill("处".repeat(305));
    assert((await smsConclusion.inputValue()).length === 300, "短信处理结论超过 300 字后未截断");
    await page.locator('input[name="sms-number-mode"][value="manual"]').check();
    assert(await page.locator("[data-sms-existing]").isHidden() && await page.locator("[data-sms-manual]").isVisible(), "短信接收号码来源切换未联动内容区");
    await page.getByRole("button", { name:"取消", exact:true }).click();
    const linkedHeaders = await page.locator(".linked-subprocess-table thead th").allInnerTexts();
    assert(JSON.stringify(linkedHeaders.map(text => text.trim())) === JSON.stringify(["子流程类型", "申请状态", "子单编号", "子流程结论", "操作"]), "关联子流程表头与字段规则不一致");
    const linkedIds = await page.locator(".linked-subprocess-table [data-action='open-related-subprocess']").evaluateAll(nodes => nodes.map(node => node.dataset.id));
    assert(linkedIds.includes("WZ202607310108") && linkedIds.includes("CX202608030001"), "关联子流程未读取流转中及已办结的结构化子单记录");
    assert(!linkedIds.includes("CX202607310008"), "关联子流程仍展示草稿子单编号或查看入口");
    const positiveConclusion = page.locator('[data-subprocess-conclusion="WZ202607310108"]');
    assert((await positiveConclusion.locator(".subprocess-conclusion-field").innerText()).trim() === "是否问责", "投诉问责结论缺少结构化字段名");
    assert((await positiveConclusion.locator(".subprocess-conclusion-result").innerText()).trim() === "是", "投诉问责结论缺少结构化结果");
    assert((await positiveConclusion.getAttribute("data-conclusion-tone")) === "positive", "肯定结论未使用绿色语义样式");
    const negativeConclusion = page.locator('[data-subprocess-conclusion="WZ202607270005"]');
    assert((await negativeConclusion.getAttribute("data-conclusion-tone")) === "negative", "否定结论未使用红色语义样式");
    const conclusionColors = await page.evaluate(() => ({
      positive: getComputedStyle(document.querySelector('[data-subprocess-conclusion="WZ202607310108"] .subprocess-conclusion-result')).color,
      negative: getComputedStyle(document.querySelector('[data-subprocess-conclusion="WZ202607270005"] .subprocess-conclusion-result')).color
    }));
    assert(conclusionColors.positive === "rgb(22, 128, 74)", "肯定结论的实际字体颜色不是绿色");
    assert(conclusionColors.negative === "rgb(212, 56, 56)", "否定结论的实际字体颜色不是红色");
    assert((await page.locator(".linked-subprocess-table").innerText()).includes("0 条子单") === false, "未发起子流程仍显示‘0 条子单’备注");
    const unmappedConclusionCell = page.locator('[data-linked-subprocess-type="延长申请"]').first().locator(".subprocess-conclusion-cell");
    assert((await unmappedConclusionCell.innerText()).trim() === "-" && (await unmappedConclusionCell.innerHTML()).trim() === "-", "无结论字段的子流程未使用纯文字短横线留空");
    const emptySubprocessRowHeight = await page.locator('tr[data-linked-subprocess-id=""]').first().evaluate(row => row.getBoundingClientRect().height);
    assert(emptySubprocessRowHeight <= 52, `未发起子流程行高过大：${emptySubprocessRowHeight}px`);
    const accountabilityTypeCell = page.locator('[data-linked-subprocess-type="投诉问责"] .linked-subprocess-type-cell').first();
    assert((await accountabilityTypeCell.getAttribute("rowspan")) === "2", "同类型多子单未合并子流程类型单元格");
    assert(await page.locator('.linked-subprocess-table [data-action="process-linked-subprocess"],.linked-subprocess-table [data-action="review-linked-subprocess"],.linked-subprocess-table [data-action="approve-linked-subprocess"]').count() === 0, "关联子流程操作栏仍包含处理、初审或审批");
    await page.click("[data-detail-tab='关联单据']");
    await page.waitForSelector(".related-order-list");
    const relatedIds = await page.locator(".related-order-item").evaluateAll(nodes => nodes.map(node => node.dataset.relatedItem));
    const linkedHiddenStatusIds = await page.evaluate(ids => ids.filter(id => window.XIB_PROTOTYPE_CONFIG.seedData.lists.subprocesses.some(record => record.id === id && ["草稿", "已废止"].includes(record.status))), linkedIds);
    assert(linkedIds.every(id => relatedIds.includes(id)), "关联单据缺少已进入流转或已办结的子流程");
    assert(linkedHiddenStatusIds.length === 0, "关联子流程仍展示草稿或已废止子单");
    assert(!relatedIds.includes("TS202607230012"), "关联单据仍重复展示当前主单");
    await page.click("[data-detail-tab='处理信息']");
    await page.locator('.linked-subprocess-table [data-action="open-related-subprocess"][data-id="WZ202607310108"]').click();
    await page.waitForSelector(".subprocess-detail-page");
    assert((await page.locator(".subprocess-detail-page").innerText()).includes("WZ202607310108"), "点击子单编号未进入对应子流程详情");
    await page.evaluate(() => {
      localStorage.setItem("xib-role", "developer");
      localStorage.setItem("xib-org", "development");
      localStorage.setItem("xib-role-profile", "development-developer");
    });
    await page.goto(`http://127.0.0.1:${port}/?testRoute=subprocess-create#subprocess-create`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector(".page h1")?.textContent.includes("子单创建"));
    await page.waitForSelector(".subprocess-list-table");
    const subprocessCreateFilterLabels = (await page.locator(".subprocess-create-filter-panel label").allInnerTexts()).map(text => text.trim());
    assert(await page.locator(".subprocess-create-filter-panel .grouped-filter-row").count() === 2, "子单创建筛选栏应精简为两行");
    assert(["子流程单创建人", "所属机构", "所属部门"].every(label => !subprocessCreateFilterLabels.includes(label)), "子单创建仍显示本人归属相关冗余筛选");
    assert(["子流程类型", "子流程单状态", "处置期限", "子流程单编号", "关联工单编号"].every(label => subprocessCreateFilterLabels.includes(label)), "子单创建必要筛选条件缺失");
    assert(!(await page.locator(".subprocess-list-table").innerText()).includes("已办结"), "子单创建仍展示已办结子单");
    const subprocessRejectedCreateRow = page.locator(".subprocess-list-table tbody tr", { hasText: "待提交" }).first();
    assert(await subprocessRejectedCreateRow.locator("[data-action='subprocess-detail']").count() === 0, "子单已驳回不应显示查看操作");
    assert(await subprocessRejectedCreateRow.locator("[data-action='edit-subprocess']").count() === 1, "子单已驳回应显示编辑操作");
    assert(await subprocessRejectedCreateRow.locator("[data-action='void-row']", { hasText: "废止" }).count() === 1, "子单已驳回应显示废止操作");
    const subprocessApprovalRow = page.locator(".subprocess-list-table tbody tr", { hasText: "待审批" }).first();
    assert(await subprocessApprovalRow.locator("[data-action='withdraw-submission']").count() === 0, "待审批子单不应显示撤回操作");
    const subprocessApprovingRow = page.locator(".subprocess-list-table tbody tr", { hasText: "审批中" }).first();
    assert(await subprocessApprovingRow.locator("[data-action='withdraw-submission']").count() === 0, "审批中子单仍显示撤回提交");
    await assertDeadlineOnlySort(".subprocess-list-table", "子单创建");
    await page.goto(`http://127.0.0.1:${port}/?testRoute=subprocess-manage#subprocess-manage`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector(".page h1")?.textContent.includes("子单处理"));
    await page.waitForSelector(".subprocess-list-table");
    assert((await page.locator('[data-subprocess-scope="机构工单池"] span').innerText()).trim() === "本机构范围内未办结的子单", "子单处理机构工单池说明不正确");
    assert(JSON.stringify(await page.locator(".subprocess-process-filter-panel .grouped-filter-row-3 label").allInnerTexts()) === JSON.stringify(["子流程单创建人", "所属机构", "所属部门"]), "子单处理创建归属信息未固定在同一独立行");
    for (const [key, label] of [["filter.subprocess-process.institution", "所属机构"], ["filter.subprocess-process.department", "所属部门"]]) {
      const filter = page.locator(`[data-app-hierarchy-cascader][data-field-key="${key}"]`);
      assert((await filter.locator("xpath=ancestor::div[contains(@class, \"ticket-filter-item\")]/label").innerText()).trim() === label, `子单处理缺少${label}筛选`);
      if (label === "所属机构") assert((await filter.getAttribute("data-multiple")) === "true" && (await filter.getAttribute("data-searchable")) === "true", "子单处理所属机构未复用多选搜索机构树");
      else assert((await filter.getAttribute("data-dictionary")) === "departmentTree", "子单处理所属部门未复用部门字典");
    }
    assert(!(await page.locator(".subprocess-list-table").innerText()).includes("已办结"), "子单处理仍展示已办结子单");
    const subprocessPoolCounts = await page.locator(".scope-card b").evaluateAll(nodes => nodes.map(node => Number(node.textContent.trim())));
    assert(subprocessPoolCounts.length === 3 && subprocessPoolCounts.every(count => count > 0), "子单处理存在无样例数据的分栏");
    assert(await page.locator(".subprocess-list-table tr", { hasText: "待处理" }).count() === 0, "子单处理我的工作台仍出现待处理单据");
    for (const [id, type] of [["TC202608080014", "剔除申请"], ["YT202608080015", "异常投诉"]]) {
      const assignedProcessingRow = page.locator(".subprocess-list-table tbody tr", { hasText:id });
      assert(await assignedProcessingRow.count() === 1, `子单处理我的工作台待办缺少${type}处理中样例：${id}`);
      const assignedProcessingText = await assignedProcessingRow.innerText();
      assert(assignedProcessingText.includes(type) && assignedProcessingText.includes("处理中"), `${type}样例类型或状态错误：${assignedProcessingText}`);
    }
    await page.click("[data-subprocess-scope='机构工单池']");
    await page.waitForFunction(() => document.querySelector("[data-subprocess-scope='机构工单池']")?.classList.contains("is-active"));
    const organizationWaitSubprocessRow = page.locator(".subprocess-list-table tbody tr", { hasText: "待处理" }).first();
    assert(await organizationWaitSubprocessRow.count() === 1, "子单机构工单池缺少未领取的待处理样例");
    assert(await organizationWaitSubprocessRow.locator("[data-action='process-subprocess'],[data-action='process-supervision-letter']").count() === 1, "子单机构工单池待处理单据缺少处理操作");
    assert(await page.locator(".subprocess-list-table [data-action='transfer-subprocess']", { hasText: "转派" }).count() > 0, "子单处理机构工单池缺少转派操作");
    const claimedSubprocessId = "DC202607310099";
    const claimableSubprocessRow = page.locator(".subprocess-list-table tbody tr", { hasText:claimedSubprocessId });
    assert(await claimableSubprocessRow.locator("[data-action='process-subprocess']").count() === 1, "待处理子单缺少处理操作");
    await claimableSubprocessRow.locator("[data-action='process-subprocess']").click();
    await page.waitForSelector(".subprocess-detail-page");
    await page.click("[data-page='subprocess-manage']");
    await page.waitForSelector("[data-subprocess-scope='我的工作台'].is-active");
    const workbenchClaimedRow = page.locator(".subprocess-list-table tbody tr", { hasText:claimedSubprocessId });
    assert(await workbenchClaimedRow.count() === 1 && (await workbenchClaimedRow.innerText()).includes("处理中"), "领取子单后未进入我的工作台或状态未更新");
    await page.click("[data-subprocess-scope='机构工单池']");
    await page.waitForSelector("[data-subprocess-scope='机构工单池'].is-active");
    const organizationClaimedRow = page.locator(".subprocess-list-table tbody tr", { hasText:claimedSubprocessId });
    assert(await organizationClaimedRow.count() === 0, "已领取子单仍保留在机构工单池");
    await page.click("[data-subprocess-scope='下辖工单池']");
    await page.waitForFunction(() => document.querySelector("[data-subprocess-scope='下辖工单池']")?.classList.contains("is-active"));
    assert(await page.locator(".subprocess-list-table tbody tr:not([data-empty-state])").count() > 0, "子单处理下辖工单池缺少样例数据");
    const subordinateRow = page.locator(".subprocess-list-table tbody tr", { hasText: "待处理" }).first();
    assert(await subordinateRow.count() === 1, "子单处理下辖工单池缺少待处理样例");
    const subordinateActions = await subordinateRow.locator("[data-action]").evaluateAll(nodes => nodes.map(node => node.dataset.action).filter(action => ["remind", "recall-transfer", "subprocess-detail"].includes(action)));
    assert(JSON.stringify(subordinateActions) === JSON.stringify(["remind", "subprocess-detail"]), "子单下辖工单池操作顺序应为催办、查看且不得包含召回");
    assert(!(await page.locator(".subprocess-list-table").innerText()).includes("督导函"), "督导函仍出现在下辖工单池");
    assert(await page.locator(".subprocess-list-table [data-action='process-subprocess'],.subprocess-list-table [data-action='process-supervision-letter']").count() === 0, "子单处理下辖工单池仍显示处理操作");
    await assertDeadlineOnlySort(".subprocess-list-table", "子单处理");
    const subprocessProcessBusinessHeaders = await page.locator(".subprocess-list-table thead th").evaluateAll(headers => headers.map(header => header.textContent.replace(/[↑↓↕]/g, "").trim()).filter(label => label && label !== "操作"));

    await page.click("[data-page='ledger-query']");
    await page.waitForSelector("[data-query-tab='工单导出']");
    await assertQueryDateBounds(page.locator(".ticket-export-filter-panel"), "工单导出");
    await page.selectOption("[data-query-ticket-type]", "");
    assert(await page.locator(".ticket-export-filter-panel .is-conditional-row").isVisible(), "未选择工单类型时未持续显示智能标签筛选");
    await assertFourColumnFilterRow(page.locator(".ticket-export-filter-panel .is-primary-row"), "工单导出业务状态行");
    await assertFourColumnFilterRow(page.locator(".ticket-export-filter-panel .is-base-row"), "工单导出单据识别行");
    assert(JSON.stringify(await page.locator(".ticket-export-filter-panel .is-customer-row label").allInnerTexts()) === JSON.stringify(["客户类型", "客户姓名", "联系方式"]), "工单导出客户信息未固定在同一独立行");
    assert(await page.locator(".ticket-export-filter-panel .is-customer-row .ticket-filter-item", { hasText:"客户类型" }).locator("select").count() === 1, "工单导出客户类型不是下拉框");
    assert(await page.locator(".ticket-export-filter-panel .is-customer-row .ticket-filter-item", { hasText:"联系方式" }).locator("input").count() === 1, "工单导出联系方式不是输入框搜索");
    assert(await page.locator('.ticket-export-filter-panel [data-filter-status-label="所属业务条线"]').count() === 1, "工单导出缺少所属业务条线多选筛选");
    assert(JSON.stringify(await page.locator(".ticket-export-filter-panel .is-risk-row label").allInnerTexts()) === JSON.stringify(["是否异常投诉", "是否黑灰产投诉"]), "工单导出缺少异常投诉或黑灰产投诉查询条件");
    const riskSelectOptions = await page.locator(".ticket-export-filter-panel .is-risk-row select").evaluateAll(selects => selects.map(select => [...select.options].map(option => option.textContent.trim())));
    assert(riskSelectOptions.length === 2 && riskSelectOptions.every(options => JSON.stringify(options) === JSON.stringify(["全部", "是", "否"])), "异常投诉和黑灰产投诉查询条件的选项不正确");
    assert(await page.locator(".selectable-table [data-ticket-list-kind='抄送']").count() === 0, "查询导出不应在工单类型旁显示抄送标签");
    assert((await page.locator('.ticket-export-filter-panel [data-app-hierarchy-cascader][data-field-key="filter.ticket-export.org"]').getAttribute("data-multiple")) === "true", "工单导出机构范围未启用多选");
    assert((await page.locator(".selectable-table thead").innerText()).includes("所属业务条线") && !(await page.locator(".selectable-table thead").innerText()).includes("当前机构"), "工单导出列表未以所属业务条线替换当前机构");
    assert(await page.locator('.selectable-table [data-action="choose-subprocess"],.selectable-table [data-action="quick-subprocess"]').count() === 0, "查询导出工单列表不应提供子流程发起入口");
    const correctedTicketRow = page.locator('.selectable-table tbody tr', { hasText:'TS202501100201' });
    assert(await correctedTicketRow.count() === 1, "工单查询列表缺少已办结投诉校正回显示例");
    await correctedTicketRow.locator('[data-action="detail"]').click();
    await page.waitForSelector('.ticket-detail-page');
    const correctedCustomerType = page.locator('[data-ticket-detail-section="customer"] .is-correction-changed', { has:page.locator('dt', { hasText:'客户类型' }) });
    assert(await correctedCustomerType.count() === 1, "最新已办结投诉校正未在主单客户类型字段回显");
    assert((await correctedCustomerType.locator('.correction-current-value').innerText()).trim() === '自然人', "主单未采用办结时间最新的投诉校正值");
    assert((await correctedCustomerType.locator('.correction-previous-value').innerText()).trim() === '非自然人', "主单未保留最新投诉校正前的字段值");
    const correctionDisplayStyle = await correctedCustomerType.evaluate(node => ({
      labelColor:getComputedStyle(node.querySelector('dt')).color,
      currentColor:getComputedStyle(node.querySelector('.correction-current-value')).color,
      currentWeight:Number(getComputedStyle(node.querySelector('.correction-current-value')).fontWeight),
      previousDecoration:getComputedStyle(node.querySelector('.correction-previous-value')).textDecorationLine
    }));
    assert(correctionDisplayStyle.labelColor === correctionDisplayStyle.currentColor && correctionDisplayStyle.currentWeight >= 600, "投诉校正后的字段名和新值未使用蓝色加粗样式");
    assert(correctionDisplayStyle.previousDecoration.includes('line-through'), "投诉校正前的字段值未使用删除线");
    const correctedAppealTag = page.locator('[data-smart-tag-field="投诉诉求标签"].is-correction-changed');
    assert(await correctedAppealTag.count() === 1, "最新投诉校正的修正标签未在主单回显");
    assert((await correctedAppealTag.locator('.smart-tag-version.is-corrected').innerText()).includes('费用减免'), "主单修正标签未显示最新办结值");
    assert((await correctedAppealTag.locator('.smart-tag-version.is-original.is-replaced').innerText()).includes('协商还款/个性化分期'), "主单修正标签未保留修改前内容");
    await page.locator('[data-detail-tab="处理信息"]').click();
    // 智能核查结果仅在待审批和审批中展示，已办结工单不再显示该区块。
    assert(await page.locator('#section-intelligent-inspection').count() === 0, "已办结工单仍显示审批阶段核查结果");
    await page.locator('[data-detail-tab="基本信息"]').click();
    await page.waitForSelector('[data-detail-tab="基本信息"].is-active');
    await page.locator('[data-action="navigate-back"]').click();
    await page.waitForSelector('[data-query-tab="工单导出"]');
    const queryDetailRow = page.locator(".selectable-table tbody tr", { hasText:"TS202607230012" });
    await queryDetailRow.locator('[data-action="detail"]').click();
    await page.waitForSelector('[data-detail-tab="处理信息"]');
    await page.locator('[data-detail-tab="处理信息"]').click();
    await page.waitForSelector(".linked-subprocess-table");
    assert((await page.locator(".workflow-readonly-notice").innerText()).includes("可在“关联子流程”中"), "查询导出进入的工单详情未说明关联子流程快速发起能力");
    const queryExtensionRow = page.locator('[data-linked-subprocess-type="延长申请"]').first();
    const queryCorrectionRow = page.locator('[data-linked-subprocess-type="投诉校正"]').first();
    assert(await queryExtensionRow.locator('[data-action="quick-subprocess"]').count() === 1 && await queryExtensionRow.locator('[data-action="quick-subprocess"]').isEnabled(), "处理中投诉单未在查询详情的关联子流程中开放延长申请");
    assert(await queryCorrectionRow.locator('button:has-text("发起"):disabled').count() === 1, "处理中投诉单错误开放了仅办结阶段可发起的投诉校正");
    await queryExtensionRow.locator('[data-action="quick-subprocess"]').click();
    await page.waitForSelector("#overlay-root .quick-subprocess-form");
    assert((await page.locator("#overlay-root .modal").innerText()).includes("快速创建延长申请"), "关联子流程快速发起未打开对应类型弹窗");
    await page.getByRole("button", { name:"取消", exact:true }).click();
    await page.locator('[data-action="navigate-back"]').click();
    await page.waitForSelector("[data-query-tab='工单导出']");
    assert(await page.locator('.selectable-table [data-action="choose-subprocess"],.selectable-table [data-action="quick-subprocess"]').count() === 0, "返回查询导出后列表出现了子流程发起入口");
    const queryTicketSelections = page.locator('[data-row-select="query-tickets"]');
    await queryTicketSelections.nth(0).check();
    await queryTicketSelections.nth(1).check();
    const batchExportButton = page.locator('[data-bulk-operation="export"][data-bulk-action="批量导出"]');
    assert(await batchExportButton.count() === 1 && await batchExportButton.isEnabled(), "工单导出列表未正确显示并启用批量导出按钮");
    await batchExportButton.click();
    await page.waitForSelector("#overlay-root .export-application");
    assert(await page.locator('input[name="export-desensitization"][value="脱敏导出"]').isChecked(), "工单导出未默认选择脱敏导出");
    const ticketExportModalText = await page.locator("#overlay-root .export-application").innerText();
    assert(ticketExportModalText.includes("脱敏导出可直接导出；非脱敏（含客户信息）导出需提交至本机构进行审批"), "工单导出缺少导出方式顶部提示");
    assert(ticketExportModalText.includes("导出工单编号："), "工单导出缺少工单编号预览");
    assert(await page.locator("#overlay-root [data-export-sensitive-field]").count() === 0, "简化后的导出弹窗仍显示敏感字段选择");
    assert(await page.locator("#overlay-root #export-reason").isHidden(), "脱敏导出时申请原因应隐藏");
    await page.locator('input[name="export-desensitization"][value="非脱敏导出"]').check();
    const routeInstitution = page.locator("#export-approver-org");
    const routeApprover = page.locator("#export-approver");
    assert(await routeInstitution.isVisible() && await routeApprover.isVisible(), "非脱敏导出未显示系统匹配的机构和审批人");
    assert(await routeInstitution.getAttribute("readonly") !== null && await routeApprover.getAttribute("readonly") !== null, "审批机构或审批人仍可编辑");
    assert((await routeInstitution.inputValue()).length > 0 && (await routeApprover.inputValue()).length > 0, "系统未按流转规则默认填入机构或审批人");
    assert((await routeApprover.inputValue()).includes("、"), "审批人未回显该部门下的多个审批人");
    const exportReason = page.locator("#export-reason");
    assert(await exportReason.isVisible(), "非脱敏导出未显示申请原因文本框");
    assert((await exportReason.getAttribute("maxlength")) === "2000", "申请原因未限制为 2000 字");
    assert((await page.locator("#export-reason-count").innerText()) === "0/2000", "申请原因初始字数统计不正确");
    await exportReason.fill("A".repeat(2000));
    assert((await page.locator("#export-reason-count").innerText()) === "2000/2000", "申请原因字数统计未实时更新");
    await exportReason.press("End");
    await exportReason.type("B");
    assert((await exportReason.inputValue()).length === 2000, "申请原因超过 2000 字后仍可输入");
    await page.locator('input[name="export-desensitization"][value="脱敏导出"]').check();
    assert(await exportReason.isHidden(), "切回脱敏导出后仍显示申请原因");
    await page.getByRole("button", { name:"取消", exact:true }).click();
    await page.selectOption("[data-query-ticket-type]", "投诉单");
    const queryTagFilters = page.locator(".ticket-export-filter-panel .is-conditional-row [data-app-hierarchy-cascader]");
    assert(await page.locator(".ticket-export-filter-panel .is-conditional-row").isVisible(), "投诉单未显示智能标签筛选");
    assert(await queryTagFilters.count() === 4, "查询导出缺少四项智能打标级联筛选");
    await assertFourColumnFilterRow(page.locator(".ticket-export-filter-panel .is-conditional-row"), "查询导出智能标签");
    assert(JSON.stringify(await page.locator(".ticket-export-filter-panel .is-conditional-row .ticket-filter-item>label").allTextContents()) === JSON.stringify(["业务办理渠道标签", "投诉产品标签", "投诉原因标签", "投诉诉求标签"]), "查询导出标签筛选字段名与智能打标不一致");
    assert((await queryTagFilters.evaluateAll(nodes => nodes.map(node => node.dataset.nonLeaf))).every(value => value === "true"), "查询导出标签筛选未允许选择非末级标签");
    const firstQueryTagFilter = queryTagFilters.first();
    await firstQueryTagFilter.locator(".di-hierarchy-cascader-trigger").click();
    await firstQueryTagFilter.locator("[data-hierarchy-parent]").first().click();
    assert((await firstQueryTagFilter.locator("input[type='hidden']").inputValue()).length > 0, "查询导出标签筛选无法选择非末级标签");
    await firstQueryTagFilter.locator("[data-hierarchy-confirm]").click();
    await page.selectOption("[data-query-ticket-type]", "信访单");
    assert(await page.locator(".ticket-export-filter-panel .is-conditional-row").isVisible(), "信访单未显示智能标签筛选");
    await page.selectOption("[data-query-ticket-type]", "建议单");
    assert(await page.locator(".ticket-export-filter-panel .is-conditional-row").isVisible(), "建议单未持续显示智能标签筛选");
    await page.locator(".ticket-export-filter-panel [data-action='search']").click();
    assert(await page.locator(".query-ticket-export-table tbody tr:not([hidden]):not([data-empty-state])").count() === 0, "建议单错误匹配了仅投诉单和信访单具备的智能标签");
    await page.selectOption("[data-query-ticket-type]", "表扬单");
    assert(await page.locator(".ticket-export-filter-panel .is-conditional-row").isVisible(), "表扬单未持续显示智能标签筛选");
    await page.locator(".ticket-export-filter-panel [data-action='search']").click();
    assert(await page.locator(".query-ticket-export-table tbody tr:not([hidden]):not([data-empty-state])").count() === 0, "表扬单错误匹配了仅投诉单和信访单具备的智能标签");
    const taggedFilterPanel = await page.locator(".ticket-export-filter-panel").elementHandle();
    await page.locator(".ticket-export-filter-panel [data-action='reset-filter']").click();
    await page.waitForFunction(panel => !panel?.isConnected, taggedFilterPanel);
    await page.selectOption("[data-query-ticket-type]", "建议单");
    await page.locator(".ticket-export-filter-panel [data-action='search']").click();
    assert(await page.locator(".query-ticket-export-table tbody tr:not([hidden]):not([data-empty-state])", { hasText:"建议单" }).count() > 0, "未选择智能标签时建议单未正常显示");
    const suggestionFilterPanel = await page.locator(".ticket-export-filter-panel").elementHandle();
    await page.locator(".ticket-export-filter-panel [data-action='reset-filter']").click();
    await page.waitForFunction(panel => !panel?.isConnected, suggestionFilterPanel);
    await page.selectOption("[data-query-ticket-type]", "投诉单");
    const queryText = await page.locator(".page").innerText();
    assert(queryText.includes("TS202607310106"), "查询导出缺少再次投诉单");
    assert(queryText.includes("再次投诉单"), "查询导出未标识再次投诉单");
    assert(!queryText.includes("TS202607310101"), "查询导出不应显示草稿工单");
    assert(queryText.includes("已办结"), "查询导出未保留已办结工单");
    assert(queryText.includes("已废止"), "查询导出未保留已废止工单");
    for (const kind of ["异常投诉单", "废止投诉单", "重复/异常投诉单"]) {
      assert(await page.locator('.query-ticket-export-table [data-ticket-list-kind="' + kind + '"]').count() > 0, "查询导出缺少标签示例：" + kind);
    }
    const kindColumnWidths = await page.locator(".query-ticket-export-table tbody tr:not([data-empty-state]) td:nth-child(3)").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    assert(new Set(kindColumnWidths.map(width => Math.round(width))).size === 1, "工单类型与客户姓名间距不一致");
    const queryTableColumnBounds = await page.locator(".query-ticket-export-table tbody tr:not([data-empty-state])").first().evaluate(row => {
      const cells = [...row.cells];
      const deadlineText = document.createRange();
      deadlineText.selectNodeContents(cells[7]);
      return { deadlineTextRight:deadlineText.getBoundingClientRect().right, firstActionLeft:cells[8].querySelector("button")?.getBoundingClientRect().left ?? cells[8].getBoundingClientRect().left, dateWidth:cells[7].getBoundingClientRect().width };
    });
    assert(queryTableColumnBounds.dateWidth >= 190 && queryTableColumnBounds.deadlineTextRight + 8 <= queryTableColumnBounds.firstActionLeft, "查询导出列表的处置期限与操作内容发生重叠");
    const exclusionOptions = page.locator(".ticket-export-filter-panel .complaint-exclusion-option");
    const exclusionNotes = await exclusionOptions.locator("small").allTextContents();
    assert(exclusionNotes.length === 4 && exclusionNotes[0].startsWith("经系统重复投诉规则识别") && exclusionNotes[3].startsWith("工单状态为【已废止】"), "剔除规则说明不完整或仍有重复名称");
    assert((await exclusionOptions.count()) === 4 && (await exclusionOptions.first().locator("input, .complaint-exclusion-name, small").count()) === 3, "剔除规则未将勾选框、名称和说明合并为一项");
    const exclusionPositions = await exclusionOptions.evaluateAll(nodes => nodes.map(node => ({ x:Math.round(node.getBoundingClientRect().x), y:Math.round(node.getBoundingClientRect().y) })));
    assert(exclusionPositions[0].y === exclusionPositions[1].y && exclusionPositions[2].y === exclusionPositions[3].y && exclusionPositions[0].x < exclusionPositions[1].x, "剔除规则没有按每行两项排列");
    const noMatchIdFilter = page.locator(".ticket-export-filter-panel .ticket-filter-item", { hasText:"工单编号" }).locator("input");
    await noMatchIdFilter.fill("TS-NOT-FOUND");
    await page.locator(".ticket-export-filter-panel [data-action='search']").click();
    await page.waitForFunction(() => document.querySelector(".ticket-export-filter-panel")?.dataset.filterActive === "true" && document.querySelector(".query-ticket-export-table [data-empty-state]")?.textContent.includes("暂无数据"), undefined, { timeout:60000 });
    const filterPanelBeforeReset = await page.locator(".ticket-export-filter-panel").elementHandle();
    await page.locator(".ticket-export-filter-panel [data-action='reset-filter']").click();
    await page.waitForFunction(panel => !panel?.isConnected, filterPanelBeforeReset);
    await page.waitForFunction(() => document.querySelector(".ticket-export-filter-panel")?.dataset.filterActive !== "true" && document.querySelector(".query-ticket-export-table tbody tr:not([data-empty-state])"));
    await noMatchIdFilter.fill("TS2026080200");
    await page.locator(".ticket-export-filter-panel [data-action='search']").click();
    await page.waitForFunction(() => document.querySelector(".ticket-export-filter-panel")?.dataset.filterActive === "true" && document.querySelectorAll(".query-ticket-export-table tbody tr:not([hidden]):not([data-empty-state])").length === 0);
    assert(await page.locator(".query-ticket-export-table tbody tr:not([hidden]):not([data-empty-state])").count() === 0, "工单编号仍在做模糊匹配");
    await noMatchIdFilter.fill("TS202608020013");
    await page.locator(".ticket-export-filter-panel [data-action='search']").click();
    await page.waitForFunction(() => {
      const rows = [...document.querySelectorAll(".query-ticket-export-table tbody tr:not([hidden]):not([data-empty-state])")];
      return rows.length === 1 && rows[0].querySelector(".primary-cell")?.textContent.trim() === "TS202608020013";
    });
    const exactMatchIds = await page.locator(".query-ticket-export-table tbody tr:not([hidden]):not([data-empty-state]) .primary-cell").allInnerTexts();
    assert(JSON.stringify(exactMatchIds.map(value => value.trim())) === JSON.stringify(["TS202608020013"]), "工单编号精准匹配未找到对应工单");
    await page.locator(".ticket-export-filter-panel [data-action='reset-filter']").click();
    const earliestDatePicker = page.locator(".ticket-export-filter-panel [data-app-picker]").first();
    assert(await earliestDatePicker.getAttribute("data-min-date") === "2015-01-01", "查询导出日期控件未限制从 2015 年起");
    assert(await earliestDatePicker.getAttribute("data-max-date") === "2026-10-03", "查询导出日期控件未限制到系统当前日期");
    await earliestDatePicker.locator("[data-picker-trigger]").click();
    assert((await earliestDatePicker.locator("[data-picker-month-title]").innerText()) === "2026 年 10 月", "查询导出日期控件未默认定位系统当前月份");
    assert(await earliestDatePicker.locator("[data-picker-month-next]").isDisabled() && await earliestDatePicker.locator("[data-picker-year-next]").isDisabled(), "查询导出仍可导航至系统当前日期之后的月份");
    assert(await earliestDatePicker.locator('[data-date-value="2026-10-04"]').isDisabled(), "查询导出仍可选择系统当前日期之后的日期");
    for (let year = 2026; year > 2015; year -= 1) await earliestDatePicker.locator("[data-picker-year-prev]").click();
    for (let month = 10; month > 1; month -= 1) await earliestDatePicker.locator("[data-picker-month-prev]").click();
    assert((await earliestDatePicker.locator("[data-picker-month-title]").innerText()) === "2015 年 1 月", "查询导出日期无法定位至 2015 年 1 月");
    assert(await earliestDatePicker.locator("[data-picker-month-prev]").isDisabled() && await earliestDatePicker.locator("[data-picker-year-prev]").isDisabled(), "查询导出仍可选择 2015 年以前的日期");
    await earliestDatePicker.locator("[data-picker-cancel]").click();
    const queryMainStatusOrder = mainStatusOrder.filter(status => status !== "草稿");
    mainStatusColorPairs = await page.locator(".selectable-table [data-flow-status]").evaluateAll((nodes, statuses) => statuses.map(status => {
      const node = nodes.find(item => item.dataset.flowStatus === status);
      if (!node) return "missing";
      const style = getComputedStyle(node);
      return style.color + "|" + style.backgroundColor;
    }), queryMainStatusOrder);
    assert(!mainStatusColorPairs.includes("missing") && new Set(mainStatusColorPairs).size === queryMainStatusOrder.length, `query export did not cover ${queryMainStatusOrder.length} main status colors: ${JSON.stringify(mainStatusColorPairs)}`);
    const quickFilterLabels = ["重复投诉", "再次投诉", "异常投诉", "废止投诉"];
    for (const label of quickFilterLabels) {
      assert(await page.locator('[data-complaint-exclusion-rule][value="' + label + '"]').count() === 1, "查询导出缺少剔除规则：" + label);
    }
    const visibleQueryIds = () => page.locator(".selectable-table tbody tr:not([data-empty-state]) .primary-cell").evaluateAll(nodes => nodes.map(node => node.textContent.trim()));
    const allQueryIds = await visibleQueryIds();
    const expectExcludedIds = async (label, excludedIds) => {
      await page.locator('[data-complaint-exclusion-rule][value="' + label + '"]').check();
      await page.waitForTimeout(300);
      const actual = await visibleQueryIds();
      assert(excludedIds.every(id => !actual.includes(id)), label + "剔除后仍显示命中工单：" + JSON.stringify(actual));
      assert(actual.length === allQueryIds.length - excludedIds.length, label + "剔除数量异常，实际工单：" + JSON.stringify(actual));
      return actual;
    };
    const repeatExcludedIds = [
      "TS202411080211", "TS202501050221", "TS202501100201", "TS202505190212",
      "TS202507110222", "TS202509150202", "TS202601220213", "TS202603120203",
      "TS202605170223", "TS202408150101", "TS202607230012", "TS202607310106", "TS202608050011"
    ];
    const afterRepeatExclusion = await expectExcludedIds("重复投诉", repeatExcludedIds);
    assert(afterRepeatExclusion.includes("TS202608020013") && afterRepeatExclusion.includes("TS202608040012"), "重复投诉剔除规则误伤非重复投诉工单");
    assert(await page.locator('[data-complaint-exclusion-rule][value="再次投诉"]').isChecked(), "勾选重复投诉后未自动勾选再次投诉");
    await page.locator('[data-complaint-exclusion-rule][value="重复投诉"]').uncheck();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-complaint-exclusion-rule][value="重复投诉"],[data-complaint-exclusion-rule][value="再次投诉"]')].every(input => !input.checked));
    const afterAgainExclusion = await expectExcludedIds("再次投诉", ["TS202607310106", "TS202608050011"]);
    assert(afterAgainExclusion.includes("TS202607230012"), "再次投诉剔除规则不应排除其他重复投诉");
    const repeatPartial = await page.locator('[data-complaint-exclusion-rule][value="重复投诉"]').evaluate(input => ({ checked:input.checked, indeterminate:input.indeterminate }));
    assert(!repeatPartial.checked && repeatPartial.indeterminate, "单独勾选再次投诉时，重复投诉未显示部分选中");
    await page.locator('[data-complaint-exclusion-rule][value="再次投诉"]').uncheck();
    await page.waitForFunction(() => !document.querySelector('[data-complaint-exclusion-rule][value="重复投诉"]')?.indeterminate);
    await expectExcludedIds("异常投诉", ["TS202608020013", "TS202605170223"]);
    await page.locator('[data-complaint-exclusion-rule][value="异常投诉"]').uncheck();
    await page.locator('[data-complaint-exclusion-rule][value="废止投诉"]').check();
    await page.waitForFunction(() => {
      const statuses = [...document.querySelectorAll(".selectable-table tbody tr:not([data-empty-state]) [data-flow-status]")].map(node => node.textContent.trim());
      return statuses.length > 0 && statuses.every(status => status !== "已废止");
    });
    const voidStatuses = await page.locator(".selectable-table tbody tr:not([data-empty-state]) [data-flow-status]").evaluateAll(nodes => nodes.map(node => node.textContent.trim()));
    assert(voidStatuses.length > 0 && voidStatuses.every(status => status !== "已废止"), "废止投诉剔除后仍显示已废止工单");
    await page.locator(".export-filter-panel [data-action='reset-filter']").click();
    await page.waitForFunction(() => [...document.querySelectorAll("[data-complaint-exclusion-rule]")].every(input => !input.checked) && [...document.querySelectorAll(".selectable-table .primary-cell")].some(node => node.textContent.trim() === "TS202607230012"));
    assert((await visibleQueryIds()).includes("TS202607230012"), "重置后未恢复全部工单");
    await assertDeadlineOnlySort(".selectable-table", "查询导出-工单");

    await page.click("[data-query-tab='溯源整改导出']");
    await page.waitForSelector(".rectification-query-table");
    await assertQueryDateBounds(page.locator(".rectification-filter-panel"), "溯源整改导出");
    const rectificationFilterLabels = await page.locator(".rectification-filter-panel .ticket-filter-item>label").allInnerTexts();
    assert(JSON.stringify(rectificationFilterLabels.map(label => label.trim())) === JSON.stringify(["整改状态", "整改单编号", "关联工单编号", "申请时间", "计划完成时间", "整改单创建人", "整改机构或部门", "整改负责人", "是否抄送"]), "溯源整改导出筛选条件或顺序不正确：" + rectificationFilterLabels.join("、"));
    assert(await page.locator(".rectification-query-table [data-sort-scope]").count() === 0, "溯源整改导出不应保留非处置期限排序");
    const rectificationSelections = page.locator('[data-row-select="query-rectifications"]');
    await rectificationSelections.nth(0).check();
    await rectificationSelections.nth(1).check();
    const rectificationBatchExport = page.locator('[data-bulk-operation="export"][data-bulk-action="批量导出"]');
    assert(await rectificationBatchExport.count() === 1 && await rectificationBatchExport.isEnabled(), "溯源整改导出未显示并启用批量导出按钮");
    await rectificationBatchExport.click();
    await page.waitForSelector("#overlay-root .rectification-export-dialog");
    const rectificationExportText = await page.locator("#overlay-root .rectification-export-dialog").innerText();
    assert(rectificationExportText.includes("溯源整改不含敏感信息，可直接导出"), "溯源整改导出缺少直接导出提示");
    assert(rectificationExportText.includes("导出整改单编号："), "溯源整改导出缺少整改单编号预览");
    assert(await page.locator("#overlay-root [name='export-desensitization']").count() === 0, "溯源整改导出不应显示脱敏方式");
    assert(await page.locator("#overlay-root #export-approver-org, #overlay-root #export-approver").count() === 0, "溯源整改导出不应显示审批路由");
    await page.getByRole("button", { name:"取消", exact:true }).click();
    const queryRelatedTicketButton = page.locator(".rectification-query-table [data-action='rectification-related-tickets']", { hasText: "/..." }).first();
    assert(await queryRelatedTicketButton.count() === 1, "溯源整改导出多关联工单未显示首个编号省略入口");
    await queryRelatedTicketButton.click();
    await page.waitForSelector("#overlay-root .related-ticket-dialog");
    assert((await page.locator("#overlay-root .modal-head").innerText()).trim() === "关联工单编号", "溯源整改导出关联工单弹窗标题不正确");
    const queryRelatedTicketModalBox = await page.locator("#overlay-root .modal").boundingBox();
    assert(queryRelatedTicketModalBox.width >= 900, "溯源整改导出关联工单弹窗未使用宽版尺寸");
    assert(await page.locator("#overlay-root .related-ticket-dialog [data-action='detail']").count() > 1, "溯源整改导出关联工单弹窗未完整显示多个编号");
    await page.getByRole("button", { name:"取消", exact:true }).click();
    await page.click("[data-query-tab='导出申请']");
    await page.waitForSelector(".export-request-table");
    await assertQueryDateBounds(page.locator(".export-request-filter-panel"), "导出申请");
    const exportRequestFilterRows = page.locator(".export-request-filter-panel .export-filter-row");
    assert(JSON.stringify((await exportRequestFilterRows.nth(0).locator("label").allInnerTexts()).map(text => text.trim())) === JSON.stringify(["导出类型", "导出申请状态", "申请时间"]), "查询导出-导出申请首行筛选条件不正确");
    assert(JSON.stringify((await exportRequestFilterRows.nth(1).locator("label").allInnerTexts()).map(text => text.trim())) === JSON.stringify(["导出申请人", "所属机构", "所属部门"]), "查询导出-导出申请人归属筛选条件未保持同一行");
    assert(JSON.stringify((await exportRequestFilterRows.nth(2).locator("label").allInnerTexts()).map(text => text.trim())) === JSON.stringify(["导出申请编号", "关联工单编号"]), "查询导出-导出申请编号条件未位于最后一行");
    const exportTypeOptions = await exportRequestFilterRows.nth(0).locator(".ticket-filter-item", { hasText:"导出类型" }).locator("select option:not(:first-child)").allInnerTexts();
    assert(JSON.stringify(exportTypeOptions) === JSON.stringify(["工单", "子单", "溯源整改单", "报表"]), "导出类型字典不正确：" + exportTypeOptions.join("、"));
    const exportText = await page.locator(".export-request-table").innerText();
    for (const header of ["导出申请编号", "导出类型", "导出申请状态", "申请时间", "过期时间", "操作"]) {
      assert(exportText.includes(header), `导出申请列表缺少表头：${header}`);
    }
    assert(!exportText.includes("处置期限"), "导出申请列表仍显示处置期限");
    const expiredApprovedRow = page.locator(".export-request-table tbody tr", { hasText:"DC202607300218" });
    const activeApprovedRow = page.locator(".export-request-table tbody tr", { hasText:"DC202607310204" });
    assert(await expiredApprovedRow.locator("[data-action='download-export']").count() === 0, "审批通过后超过7×24小时的导出申请仍可下载");
    assert(await expiredApprovedRow.locator("[data-unavailable-action='download-export']").count() === 1, "过期导出申请未在下载列显示 -");
    assert(await expiredApprovedRow.locator("[data-action='edit-export-request']").count() === 1, "过期导出申请未提供编辑入口");
    assert(await activeApprovedRow.locator("[data-action='download-export']").count() === 1, "审批通过后7×24小时有效期内的导出申请不可下载");
    assert(await activeApprovedRow.locator("[data-action='edit-export-request']").count() === 0, "有效期内导出申请错误显示编辑入口");
    const firstExportRequestRow = page.locator(".export-request-table tbody tr", { hasText:"DC202607310201" });
    assert((await firstExportRequestRow.locator(".export-request-applied-at").innerText()).trim() === "2026-07-31 03:10", "导出申请列表未显示原始申请时间");
    assert((await firstExportRequestRow.locator(".export-request-expires-at").innerText()).trim() === "-", "审批中的导出申请不应开始显示过期时间");
    const approvedExportRows = page.locator(".export-request-table tbody tr[data-export-status='已通过']");
    assert(await approvedExportRows.count() >= 2, "导出申请列表缺少有效期内和已过期样例");
    assert(await approvedExportRows.evaluateAll(rows => rows.every(row => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.querySelector('.export-request-expires-at')?.textContent.trim() || ''))), "已通过导出申请未显示秒级过期时间");
    for (const type of ["工单", "子单", "溯源整改单", "报表"]) assert(exportText.includes(type), "导出申请列表缺少导出类型样例：" + type);
    await exportRequestFilterRows.nth(0).locator(".ticket-filter-item", { hasText:"导出类型" }).locator("select").selectOption({ label:"报表" });
    await page.locator(".export-request-filter-panel [data-action='search']").click();
    const reportExportRequestIds = await page.locator(".export-request-table tbody tr:not([hidden]) .primary-cell").allInnerTexts();
    assert(JSON.stringify(reportExportRequestIds) === JSON.stringify(["DC202607310206"]), "报表导出类型筛选结果不正确：" + reportExportRequestIds.join("、"));
    await page.locator(".export-request-filter-panel [data-action='reset-filter']").click();
    await page.locator("#filter-申请时间-start").evaluate(input => { input.value = "2026-07-30"; });
    await page.locator("#filter-申请时间-end").evaluate(input => { input.value = "2026-07-30"; });
    await page.locator(".export-request-filter-panel [data-action='search']").click();
    const july30Rows = page.locator(".export-request-table tbody tr:not([hidden]):not(.filter-empty-row)");
    assert(await july30Rows.count() === 2, "申请时间筛选未精确限定导出申请列表");
    assert(await july30Rows.evaluateAll(rows => rows.every(row => String(row.dataset.exportAppliedAt || "").startsWith("2026-07-30"))), "申请时间筛选结果包含区间外申请");
    await page.locator(".export-request-filter-panel [data-action='reset-filter']").click();
    assert(exportText.includes("DC202607310201"), "导出申请列表缺少当日小时级样例");
    assert(exportText.includes("待提交"), "导出申请列表缺少待提交状态样例");

    await page.click("[data-query-tab='导出台账']");
    await page.waitForSelector(".export-ledger-table");
    await assertQueryDateBounds(page.locator(".filter-panel"), "导出台账");
    const ledgerFilter = page.locator(".ticket-filter-item", { has:page.locator("label", { hasText:"导出类型" }) });
    assert(await page.locator(".ticket-filter-item label", { hasText:"导出状态" }).count() === 0, "导出台账仍显示导出状态筛选条件");
    const ledgerTypeOptions = await ledgerFilter.locator("select option:not(:first-child)").allInnerTexts();
    assert(JSON.stringify(ledgerTypeOptions) === JSON.stringify(["子单", "工单", "整改单", "报表", "核查记录", "报告"]), "导出台账导出类型选项不正确：" + ledgerTypeOptions.join("、"));
    const ledgerHeaders = (await page.locator(".export-ledger-table thead th").allInnerTexts()).map(text => text.trim());
    assert(ledgerHeaders.indexOf("导出申请编号") === ledgerHeaders.indexOf("导出时间") - 1, "导出台账申请编号列未放在导出时间之前");
    assert(ledgerHeaders.indexOf("导出类型") === ledgerHeaders.indexOf("导出时间") + 1, "导出台账导出类型列未紧随导出时间");
    assert(ledgerHeaders.indexOf("关联业务单") === ledgerHeaders.indexOf("导出数据量") + 1, "导出台账关联业务单列位置不正确");
    assert(ledgerHeaders.indexOf("申请原因") === ledgerHeaders.indexOf("脱敏情况") + 1, "导出台账申请原因列位置不正确");
    const ledgerDisplayedTypes = await page.locator(".export-ledger-table tbody tr").evaluateAll(rows => rows.map(row => [...row.cells].map(cell => cell.textContent.trim())));
    assert(ledgerDisplayedTypes.some(cells => cells.includes("整改单")), "溯源整改单未在导出台账显示为整改单：" + ledgerDisplayedTypes.map(cells => cells.join("|")).join("、"));
    assert(ledgerDisplayedTypes.every(cells => ["成功", "失败"].includes(cells[ledgerHeaders.indexOf("导出状态")])), "导出台账仍显示旧导出状态");
    const ledgerFirstRow = page.locator(".export-ledger-table tbody tr").first();
    const ledgerCells = await ledgerFirstRow.locator("td").allInnerTexts();
    const ledgerReason = ledgerCells[ledgerHeaders.indexOf("申请原因")].trim();
    assert(Array.from(ledgerReason).length <= 18 && ledgerReason.endsWith("..."), "申请原因未按 15 字截断并添加省略号");
    const ledgerRelation = ledgerCells[ledgerHeaders.indexOf("关联业务单")].trim();
    await ledgerFirstRow.locator('[data-action="export-request-detail"]').click();
    const detailValues = await page.locator("#overlay-root .export-request-detail .action-summary-grid>div").evaluateAll(items => Object.fromEntries(items.map(item => [item.querySelector("dt")?.textContent.trim(), item.querySelector("dd")?.textContent.trim()])));
    assert(detailValues["导出申请编号"] === ledgerCells[ledgerHeaders.indexOf("导出申请编号")].trim(), "台账申请编号与详情不一致");
    assert(detailValues["关联业务单"] === ledgerRelation, "台账关联业务单与详情不一致");
    assert(detailValues["申请原因"].startsWith(ledgerReason.slice(0, 15)), "台账申请原因与详情不一致");
    await page.getByRole("button", { name:"关闭", exact:true }).click();
    await ledgerFilter.locator("select").selectOption({ label:"整改单" });
    await page.locator(".filter-panel [data-action='search']").click();
    const rectificationLedgerRows = page.locator(".export-ledger-table tbody tr:not([hidden]):not(.filter-empty-row)");
    assert(await rectificationLedgerRows.count() === 1 && (await rectificationLedgerRows.first().locator("td").allInnerTexts()).map(text => text.trim()).includes("整改单"), "导出台账导出类型筛选不正确");
    await page.locator(".filter-panel [data-action='reset-filter']").click();

    await page.evaluate(() => document.querySelector("[data-query-tab='子流程单导出']").click());
    await page.waitForFunction(() => document.querySelector("[data-query-tab='子流程单导出']")?.classList.contains("is-active"));
    await page.waitForSelector("table");
    await assertQueryDateBounds(page.locator(".subprocess-export-filter-panel"), "子流程单导出");
    await page.locator(".subprocess-list-table [data-action='export-row']").first().click();
    await page.waitForSelector("#overlay-root .export-application");
    assert(await page.locator('input[name="export-desensitization"][value="脱敏导出"]').isChecked(), "子流程单导出未默认选择脱敏导出");
    assert((await page.locator("#overlay-root .export-application").innerText()).includes("导出子流程单编号："), "子流程单导出缺少子流程单编号预览");
    await page.getByRole("button", { name:"取消", exact:true }).click();
    const subprocessText = await page.locator(".page").innerText();
    const querySubprocessStatusOrder = subprocessStatusOrder.filter(status => status !== "草稿");
    for (const status of querySubprocessStatusOrder) {
      assert(subprocessText.includes(status), `子流程列表缺少状态：${status}`);
    }
    assert(!subprocessText.includes("已撤销"), "子流程列表仍包含已移除状态");
    const subprocessStatusColorPairs = await page.locator(".subprocess-list-table [data-flow-status]").evaluateAll((nodes, statuses) => statuses.map(status => {
      const node = nodes.find(item => item.dataset.flowStatus === status);
      if (!node) return "missing";
      const style = getComputedStyle(node);
      return style.color + "|" + style.backgroundColor;
    }), querySubprocessStatusOrder);
    assert(!subprocessStatusColorPairs.includes("missing") && new Set(subprocessStatusColorPairs).size === querySubprocessStatusOrder.length, `subprocess query did not cover ${querySubprocessStatusOrder.length} status colors`);
    assert(new Set([...manageableMainStatusColorPairs, ...mainStatusColorPairs, ...subprocessStatusColorPairs]).size >= documentStatusOrder.length - 1, "status color union did not cover current workflow states");
    assert(subprocessText.includes("TS202607310106"), "子流程未关联再次投诉单");
    await assertDeadlineOnlySort(".subprocess-list-table", "查询导出-子单");
    assert(!subprocessText.includes("YC202607310107"), "查询导出不应显示草稿子单");
    const multiSubprocessRow = page.locator(".subprocess-list-table tbody tr", { hasText:"WZ202607270005" });
    const multiSubprocessLink = multiSubprocessRow.locator('[data-action="subprocess-related-tickets"]');
    assert(await multiSubprocessLink.count() === 1 && (await multiSubprocessLink.innerText()).trim() === "TS202607230012/...", "子单列表多关联工单未使用编号摘要入口");
    await multiSubprocessLink.click();
    await page.waitForSelector("#overlay-root .modal table");
    const multiSubprocessModalText = await page.locator("#overlay-root .modal").innerText();
    for (const ticketId of ["TS202607230012", "TS202501100201", "TS202509150202", "TS202603120203"]) assert(multiSubprocessModalText.includes(ticketId), "子单关联工单弹窗缺少 " + ticketId);
    const multiSubprocessModalBox = await page.locator("#overlay-root .modal").boundingBox();
    assert(multiSubprocessModalBox.width >= 900, "子单关联工单弹窗未使用宽版尺寸");
    await page.locator("#overlay-root .modal [data-close-overlay]").last().click();
    await multiSubprocessRow.locator('[data-action="subprocess-detail"]').click();
    await page.waitForSelector(".subprocess-detail-page .detail-descriptions");
    const subprocessBaseLabels = (await page.locator(".subprocess-detail-page .detail-descriptions").first().locator("dt").allInnerTexts()).map(value => value.trim());
    assert(!subprocessBaseLabels.includes("抄送人"), "抄送人不应位于子单基础信息分区内");
    const subprocessCopySection = page.locator(".subprocess-detail-page .subprocess-copy-section");
    assert(await subprocessCopySection.count() === 1 && (await subprocessCopySection.locator("dt").innerText()).trim() === "抄送人", "子单基本信息页签末端缺少抄送人");
    await page.locator('[data-subprocess-detail-tab="关联单据"]').click();
    await page.waitForSelector(".subprocess-related-workspace .contact-toolbar.is-readonly");
    const readonlyContactActions = page.locator('.subprocess-related-workspace .contact-toolbar [data-action="call-customer"], .subprocess-related-workspace .contact-toolbar [data-action="send-sms"], .subprocess-related-workspace .contact-toolbar [data-action="add-contact"]');
    assert(await readonlyContactActions.count() === 3, "子单关联单据联系记录缺少三个只读操作按钮");
    assert(await readonlyContactActions.evaluateAll(buttons => buttons.every(button => button.disabled && button.getAttribute("aria-disabled") === "true")), "子单关联单据联系记录操作按钮仍可点击");

    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='development']");
    await page.click("[data-role-profile='development-developer']");
    await page.waitForSelector("[data-page='rectification-create']");
    await page.evaluate(() => document.querySelector("[data-page='rectification-create']").click());
    await page.waitForFunction(() => document.querySelector(".page")?.textContent.includes("整改创建"));
    await page.waitForSelector("table");
    await page.evaluate(() => document.querySelector("[data-rectification-tab='all']")?.click());
    await page.waitForFunction(() => document.querySelector(".rectification-table")?.textContent.includes("ZG202607310103"));
    const rectificationText = await page.locator(".rectification-table").innerText();
    const visibleRectificationStatuses = ["草稿", "问题待审核", "方案待提交", "方案待初审", "方案待审批", "整改中", "结果待初审", "结果待审批"];
    for (const status of visibleRectificationStatuses) {
      assert(rectificationText.includes(status), `溯源整改工作台全部缺少经办员经手状态：${status}`);
    }
    assert(!rectificationText.includes("已办结") && !rectificationText.includes("已废止"), "溯源整改工作台全部不应包含已办结或已废止");
    const relatedTicketButton = page.locator(".rectification-table [data-action='rectification-related-tickets']", { hasText: "TS202607230012/..." }).first();
    assert(await relatedTicketButton.count(), "溯源整改单未展示多关联工单入口");
    await relatedTicketButton.click();
    await page.waitForSelector("#overlay-root .modal table");
    const relatedTicketModalText = await page.locator("#overlay-root .modal").innerText();
    assert(relatedTicketModalText.includes("TS202607310106"), "溯源整改单关联工单弹窗未展示再次投诉关联");
    const relatedTicketModalBox = await page.locator("#overlay-root .modal").boundingBox();
    assert(relatedTicketModalBox.width >= 900, "关联工单弹窗未使用宽版尺寸");
    assert(relatedTicketModalBox.x >= 0 && relatedTicketModalBox.x + relatedTicketModalBox.width <= 1600, "关联工单弹窗超出视口");
    await page.locator("#overlay-root .modal [data-close-overlay]").last().click();
    const rectificationStatusOrder = ["草稿", "问题待提交", "问题待审核", "方案待提交", "方案待初审", "方案待审批", "整改中", "结果待初审", "结果待审批", "已办结", "已废止"];
    const rectificationDefaultStatuses = await page.locator(".rectification-table tbody tr").evaluateAll(rows => rows.map(row => row.cells[6]?.innerText.trim()).filter(Boolean));
    assert(rectificationDefaultStatuses.every((status, index) => index === 0 || rectificationStatusOrder.indexOf(rectificationDefaultStatuses[index - 1]) <= rectificationStatusOrder.indexOf(status)), "溯源整改首次进入未按状态机顺序默认排序");
    const rectificationPaletteMap = await page.locator(".rectification-table [data-flow-status]").evaluateAll(tags => Object.fromEntries(tags.map(tag => [tag.dataset.flowStatus, tag.dataset.statusPalette])));
    const rectificationPalettes = visibleRectificationStatuses.map(status => rectificationPaletteMap[status]);
    assert(rectificationPalettes.every(Boolean), "溯源整改当前池状态存在未配置颜色的标签");
    assert(new Set(rectificationPalettes).size === visibleRectificationStatuses.length, "溯源整改当前池状态复用了相同颜色");
    assert(await page.locator(".rectification-table [aria-label$='排序']").count() === 0, "溯源整改列表表头不应提供排序功能");
    const multiRectificationRow = page.locator("tr", { hasText: "ZG202607310103" });
    assert(await multiRectificationRow.locator("[data-action='rectification-related-tickets']").count() === 1, "多工单整改未使用关联工单弹窗入口");
    await multiRectificationRow.locator("[data-action='rectification-detail']").click();
    await page.waitForSelector(".rectification-detail-page");
    const expectedRectificationRelationIds = seedData.documentData.rectifications.ZG202607310103.relatedTicketIds;
    const summaryRelationIds = await page.locator(".detail-summary [data-action='open-rectification-related-ticket']").evaluateAll(nodes => nodes.map(node => node.dataset.id));
    assert(JSON.stringify(summaryRelationIds) === JSON.stringify(expectedRectificationRelationIds), "整改详情摘要未完整展示结构化多关联工单");
    assert(!(await page.locator(".detail-summary").innerText()).includes("`"), "整改详情摘要仍把反引号显示为关联工单");
    const relatedDetailTable = page.locator(".rectification-related-detail-field .rectification-related-table");
    assert(await relatedDetailTable.count() === 1, "整改问题中的关联工单编号未按列表展示");
    const detailRelationIds = await relatedDetailTable.locator("[data-action='open-rectification-related-ticket']").evaluateAll(nodes => nodes.map(node => node.dataset.id));
    assert(detailRelationIds.includes("TS202607230012") && detailRelationIds.includes("TS202607310106"), "整改详情未使用结构化多工单关联");
    assert(await relatedDetailTable.locator("th", { hasText:"操作" }).count() === 0, "整改详情关联工单列表不应显示操作列");
    const rectificationDetailText = await page.locator(".rectification-detail-page").innerText();
    for (const expected of ["整改问题", "整改方案", "整改结果", "整改结果-投诉统计", "计划完成时间", "工作成果说明", "日均投诉量变化对比图", "投诉量趋势图", "日均投诉量 = 总投诉件数 ÷ 实际天数"]) {
      assert(rectificationDetailText.includes(expected), `整改结果审核详情缺少：${expected}`);
    }
    assert(await page.locator('.rectification-stat-chart[aria-label="日均投诉量变化对比图"]').count() === 1, "日均投诉量变化对比图未渲染");
    assert(await page.locator('.rectification-stat-chart[aria-label="投诉量趋势图"]').count() === 1, "投诉量趋势图未渲染");
    assert(await page.locator("#subprocess-processing-form").count() === 0, "整改结果审核阶段不应开放编辑表单");
    assert(rectificationDetailText.includes("投诉标签变化趋势"), "整改统计未展示字段表中的趋势字段中文名");
    assert(!rectificationDetailText.includes("附件（整改问题）") && !rectificationDetailText.includes("附件（整改方案）") && !rectificationDetailText.includes("附件（整改结果）"), "整改详情仍展示不规范的附件字段名");
    const statisticsProductCascader = page.locator('.rectification-statistics-section [data-app-hierarchy-cascader][data-dictionary="rectificationProduct"]');
    const statisticsCauseCascader = page.locator('.rectification-statistics-section [data-app-hierarchy-cascader][data-dictionary="rectificationCause"]');
    assert(await statisticsProductCascader.locator(".risk-cascade-column").count() === 3, "整改统计产品筛选未复用三级产品字典");
    assert(await statisticsCauseCascader.locator(".risk-cascade-column").count() === 3, "整改统计原因筛选未复用三级原因字典");
    await statisticsProductCascader.locator(".di-hierarchy-cascader-trigger").click();
    await page.waitForTimeout(100);
    const hierarchyPopoverGeometry = await statisticsProductCascader.evaluate(host => {
      const trigger = host.querySelector(".di-hierarchy-cascader-trigger").getBoundingClientRect();
      const popoverNode = host.querySelector(".di-hierarchy-cascader-popover");
      const popover = popoverNode.getBoundingClientRect();
      const stickyNode = host.querySelector(".hierarchy-selected-sticky");
      const sticky = stickyNode.getBoundingClientRect();
      const columns = host.querySelector("[data-hierarchy-columns]").getBoundingClientRect();
      const footer = host.querySelector(".di-multi-cascader-foot").getBoundingClientRect();
      const section = host.closest(".rectification-statistics-section").getBoundingClientRect();
      const stickyStyle = getComputedStyle(stickyNode);
      return {
        triggerTop: trigger.top,
        triggerBottom: trigger.bottom,
        popoverTop: popover.top,
        popoverBottom: popover.bottom,
        popoverLeft: popover.left,
        popoverRight: popover.right,
        popoverWidth: popover.width,
        stickyTop: sticky.top,
        stickyLeft: sticky.left,
        stickyRight: sticky.right,
        stickyHeight: sticky.height,
        stickyMargin: stickyStyle.margin,
        columnsTop: columns.top,
        footerBottom: footer.bottom,
        sectionRight: section.right
      };
    });
    const popoverAnchoredBelow = hierarchyPopoverGeometry.popoverTop >= hierarchyPopoverGeometry.triggerBottom && hierarchyPopoverGeometry.popoverTop - hierarchyPopoverGeometry.triggerBottom <= 10;
    const popoverAnchoredAbove = hierarchyPopoverGeometry.popoverBottom <= hierarchyPopoverGeometry.triggerTop && hierarchyPopoverGeometry.triggerTop - hierarchyPopoverGeometry.popoverBottom <= 10;
    assert(popoverAnchoredBelow || popoverAnchoredAbove, "级联弹层未贴近触发器定位");
    assert(hierarchyPopoverGeometry.stickyTop >= hierarchyPopoverGeometry.popoverTop && hierarchyPopoverGeometry.stickyLeft >= hierarchyPopoverGeometry.popoverLeft && hierarchyPopoverGeometry.stickyRight <= hierarchyPopoverGeometry.popoverRight + 1, "级联弹层顶部已选区域仍被负边距拉出或裁切");
    assert(hierarchyPopoverGeometry.stickyMargin === "0px" && hierarchyPopoverGeometry.stickyHeight >= 60, "级联弹层顶部已选区域样式未完整重置");
    assert(hierarchyPopoverGeometry.columnsTop >= hierarchyPopoverGeometry.stickyTop + hierarchyPopoverGeometry.stickyHeight - 1 && hierarchyPopoverGeometry.footerBottom > hierarchyPopoverGeometry.columnsTop, "级联弹层的顶部、列表和底部操作区发生重叠");
    assert(hierarchyPopoverGeometry.popoverWidth <= 722 && hierarchyPopoverGeometry.popoverRight <= hierarchyPopoverGeometry.sectionRight + 1, "统计筛选级联弹层宽度超出统计卡片边界");
    await statisticsProductCascader.locator("[data-hierarchy-toggle]").first().click();
    await statisticsProductCascader.locator("[data-hierarchy-confirm]").click();
    await page.waitForSelector(".comparison-grouped-bars");
    assert(await page.locator(".comparison-group").count() >= 1, "选择具体产品后未切换为产品分组柱状图");
    assert(await page.locator(".trend-series-legend span").count() >= 1, "选择具体产品后未按产品生成趋势线图例");
    const trendPointsBeforeCause = await page.locator(".trend-series-line").first().getAttribute("points");
    await statisticsCauseCascader.locator(".di-hierarchy-cascader-trigger").click();
    await statisticsCauseCascader.locator("[data-hierarchy-toggle]").first().click();
    await page.waitForFunction(beforePoints => document.querySelector(".trend-series-line")?.getAttribute("points") !== beforePoints, trendPointsBeforeCause);
    assert(!(await statisticsCauseCascader.locator(".di-hierarchy-cascader-trigger").innerText()).includes("全部原因标签"), "原因标签筛选结果未回显");
    await page.setViewportSize({ width: 1920, height: 1000 });
    const rectificationLayout = await page.evaluate(() => {
      const pageNode = document.querySelector(".rectification-detail-page");
      const content = document.querySelector(".rectification-detail-page > .detail-sections");
      const charts = [...document.querySelectorAll(".rectification-stat-field-block")];
      const svg = document.querySelector(".trend-chart svg");
      const pageStyle = pageNode ? getComputedStyle(pageNode) : null;
      const expectedContentWidth = pageNode && pageStyle
        ? pageNode.clientWidth - parseFloat(pageStyle.paddingLeft) - parseFloat(pageStyle.paddingRight)
        : 0;
      const pageRect = pageNode?.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect();
      return {
        contentWidth: contentRect?.width || 0,
        expectedContentWidth,
        leftGutter: contentRect && pageRect ? contentRect.left - pageRect.left : 0,
        rightGutter: contentRect && pageRect ? pageRect.right - contentRect.right : 0,
        expectedLeftGutter: pageStyle ? parseFloat(pageStyle.paddingLeft) : 0,
        expectedRightGutter: pageStyle ? parseFloat(pageStyle.paddingRight) : 0,
        chartWidths: charts.map(chart => chart.getBoundingClientRect().width),
        chartTops: charts.map(chart => chart.getBoundingClientRect().top),
        preserveAspectRatio: svg?.getAttribute("preserveAspectRatio") || ""
      };
    });
    assert(Math.abs(rectificationLayout.contentWidth - rectificationLayout.expectedContentWidth) < 2, "整改详情表单宽度未与工单详情标准内容区对齐");
    assert(Math.abs(rectificationLayout.leftGutter - rectificationLayout.expectedLeftGutter) < 2 && Math.abs(rectificationLayout.rightGutter - rectificationLayout.expectedRightGutter) < 2, "整改详情表单列表未保留与页面边缘一致的左右 padding 间距");
    assert(rectificationLayout.leftGutter === 24 && rectificationLayout.rightGutter === 24, "1920px 下整改详情左右页面间距不是 24px");
    assert(rectificationLayout.chartWidths[0] < 560 && rectificationLayout.chartWidths[1] < 820, "整改统计图仍在宽屏下过度拉伸");
    assert(Math.abs(rectificationLayout.chartTops[0] - rectificationLayout.chartTops[1]) < 4, "宽屏整改统计图未按统计分析样式并排展示");
    assert(rectificationLayout.preserveAspectRatio === "xMidYMid meet", "整改趋势图未保持固定绘图比例");
    await page.setViewportSize({ width: 1538, height: 674 });
    const browserCommentViewport = await page.evaluate(() => {
      const detail = document.querySelector(".rectification-detail-page > .detail-sections");
      const detailRect = detail?.getBoundingClientRect();
      const panels = [...document.querySelectorAll(".rectification-detail-page > .detail-sections > .detail-section")];
      return {
        pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        detailFits: detail ? detail.scrollWidth <= detail.clientWidth + 1 : false,
        panelsFit: Boolean(detailRect) && panels.every(panel => panel.getBoundingClientRect().right <= detailRect.right + 1)
      };
    });
    assert(browserCommentViewport.pageFits, "1538px 视口下整改详情仍撑出浏览器右侧");
    assert(browserCommentViewport.detailFits && browserCommentViewport.panelsFit, "1538px 视口下整改阶段表单超出详情内容区");
    await page.setViewportSize({ width: 1100, height: 900 });
    const narrowLayout = await page.evaluate(() => {
      const section = document.querySelector(".rectification-statistics-section");
      const charts = [...document.querySelectorAll(".rectification-stat-field-block")];
      return {
        fits: section ? section.scrollWidth <= section.clientWidth + 1 : false,
        chartTops: charts.map(chart => chart.getBoundingClientRect().top)
      };
    });
    assert(narrowLayout.fits, "窄屏整改统计区出现横向溢出");
    assert(narrowLayout.chartTops[1] > narrowLayout.chartTops[0] + 80, "窄屏整改统计图未自动纵向排列");
    await page.setViewportSize({ width: 1600, height: 1000 });

    const linkedTicketButton = page.locator('.rectification-related-detail-field [data-action="open-rectification-related-ticket"]').first();
    const linkedTicketId = await linkedTicketButton.getAttribute("data-id");
    await linkedTicketButton.click();
    await page.waitForSelector(".ticket-detail-page");
    assert((await page.locator(".ticket-detail-page .detail-summary").innerText()).includes(linkedTicketId), "整改关联工单编号点击后未进入对应工单详情");
    await page.locator('.ticket-detail-page [data-action="navigate-back"]').click();
    await page.waitForSelector(".rectification-detail-page");
    await page.evaluate(() => document.querySelector("[data-page='rectification-create']").click());
    await page.waitForSelector(".rectification-table");
    await page.locator("[data-action='new-rectification']").click();
    await page.waitForSelector("#rectification-form-main");
    const productCascader = page.locator('[data-app-hierarchy-cascader][data-dictionary="rectificationProduct"]');
    const causeCascader = page.locator('[data-app-hierarchy-cascader][data-dictionary="rectificationCause"]');
    const ccCascader = page.locator('[data-app-hierarchy-cascader][data-dictionary="rectificationCc"]');
    assert(await productCascader.locator(".risk-cascade-column").count() === 3, "投诉产品标签不是三级级联选择器");
    assert(await productCascader.locator("[data-hierarchy-toggle]").count() > 0, "投诉产品标签未提供三级叶子选项");
    assert(await causeCascader.locator(".risk-cascade-column").count() === 3, "投诉原因标签不是三级级联选择器");
    assert(await causeCascader.locator("[data-hierarchy-toggle]").count() > 0, "投诉原因标签未显示三级叶子选项");
    assert(await ccCascader.locator(".risk-cascade-column").count() === 3, "抄送人不是级联选择器");
    const exactAttachmentLabels = await page.locator("#rectification-form-main .form-label").evaluateAll(labels => labels.map(label => label.textContent.trim()).filter(text => text === "附件"));
    assert(exactAttachmentLabels.length === 1, "整改问题分区的附件字段名不是精确的“附件”");
    const relatedSectionTitle = await page.locator("#rectification-form-main .form-item", { hasText: "关联工单编号" }).locator("xpath=ancestor::section[1]").locator(".form-section-head").innerText();
    assert(relatedSectionTitle.includes("整改问题"), "关联工单编号未放入字段表指定的整改问题分区");
    await page.locator("[data-action='search-rectification-related-tickets']").click();
    await page.waitForSelector("#overlay-root .rectification-related-picker");
    const rectificationTypeOptions = (await page.locator('[data-rectification-filter="type"] option').allInnerTexts()).map(text => text.trim());
    assert(JSON.stringify(rectificationTypeOptions) === JSON.stringify(["全部", "投诉单", "信访单"]), "溯源整改关联工单类型筛选仍包含其他工单：" + rectificationTypeOptions.join("、"));
    const rectificationPickerTypes = await page.locator('[data-rectification-picker-row]').evaluateAll(rows => [...new Set(rows.map(row => row.dataset.ticketType))]);
    assert(rectificationPickerTypes.includes("投诉单") && rectificationPickerTypes.includes("信访单") && rectificationPickerTypes.every(type => ["投诉单", "信访单"].includes(type)), "溯源整改可选数据未限定为投诉单和信访单：" + rectificationPickerTypes.join("、"));
    const firstPickerId = await page.locator("[data-rectification-picker-row]").first().getAttribute("data-ticket-id");
    await page.locator('[data-rectification-filter="id"]').fill("TS-NOT-FOUND");
    await page.locator("[data-rectification-picker-search]").click();
    await page.waitForSelector(".rectification-related-picker [data-empty-state]");
    assert((await page.locator(".rectification-related-picker [data-empty-state]").innerText()).includes("暂无数据"), "整改单关联工单查询零结果未显示空状态");
    await page.locator('[data-rectification-filter="id"]').fill(firstPickerId);
    await page.locator("[data-rectification-picker-search]").click();
    await page.waitForFunction(expectedId => [...document.querySelectorAll("[data-rectification-picker-row]")].filter(row => !row.hidden).every(row => row.dataset.ticketId.includes(expectedId)), firstPickerId);
    await page.locator('[data-rectification-picker-row]:visible [data-rectification-ticket]').first().check();
    await page.locator("#modal-confirm").click();
    const formRelatedTable = page.locator("#rectification-form-main .rectification-related-table");
    await formRelatedTable.waitFor();
    assert(await formRelatedTable.locator('[data-action="open-rectification-related-ticket"][data-id="' + firstPickerId + '"]').count() === 1, "新建整改单关联工单编号不可点击");
    assert(await formRelatedTable.locator("th", { hasText:"操作" }).count() === 1, "新建整改单关联列表缺少操作列");

    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='branch-unit']");
    await page.click("[data-role-profile='branch-handler']");
    await page.waitForSelector("[data-page='rectification-process']");
    await page.evaluate(() => document.querySelector("[data-page='rectification-process']").click());
    await page.waitForSelector(".rectification-table");
    await page.locator(".rectification-table tr", { hasText: "ZG202607210006" }).locator("[data-action='rectification-process']").click();
    await page.waitForSelector("#subprocess-processing-form");
    assert(await page.locator('#subprocess-processing-form [data-field-key$=".整改计划"]').count() === 1, "制定整改计划阶段未开放整改计划字段");
    assert(await page.locator('#subprocess-processing-form [data-field-key$=".计划完成时间"]').count() === 1, "制定整改计划阶段未开放计划完成时间字段");
    assert(await page.locator('#subprocess-processing-form [data-field-key$=".工作成果说明"]').count() === 0, "制定整改计划阶段不应开放整改结果字段");

    await page.evaluate(() => document.querySelector("[data-page='rectification-process']").click());
    await page.waitForSelector(".rectification-table");
    await page.locator(".rectification-table tr", { hasText: "ZG202607170004" }).locator("[data-action='rectification-process']").click();
    await page.waitForSelector("#subprocess-processing-form");
    assert(await page.locator('.rectification-stage-section', { hasText: "整改方案" }).count() === 1, "填写整改结果阶段未回显已提交的整改方案");
    assert(await page.locator('#subprocess-processing-form [data-field-key$=".工作成果说明"]').count() === 1, "填写整改结果阶段未开放工作成果说明字段");
    assert(await page.locator('#subprocess-processing-form [data-field-key$=".整改计划"]').count() === 0, "填写整改结果阶段不应重新编辑整改计划字段");

    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='branch-unit']");
    await page.click("[data-role-profile='branch-unit-approver']");
    await page.waitForSelector("[data-page='my-approvals']");
    await page.evaluate(() => document.querySelector("[data-page='my-approvals']").click());
    await page.waitForFunction(() => document.querySelector(".page h1")?.textContent.includes("审批管理"));
    await page.evaluate(() => document.querySelector("[data-approval-tab='工单审批']").click());
    await page.waitForFunction(() => document.querySelector("[data-approval-tab='工单审批']")?.classList.contains("is-active"));
    await page.waitForSelector(".approval-table [aria-label='按处置期限排序']");
    const ticketApprovalBusinessHeaders = await page.locator(".approval-table thead th").evaluateAll(headers => headers.map(header => header.textContent.replace(/[↑↓↕]/g, "").trim()).filter(label => label && label !== "操作"));
    assert(JSON.stringify(ticketApprovalBusinessHeaders) === JSON.stringify(ticketProcessBusinessHeaders), "工单审批与工单处理列表表头不一致");
    assert(await page.locator('[data-receiving-department-filter="approval"]').count() === 1, "工单审批缺少工单接收部门筛选");
    await assertDeadlineOnlySort(".approval-table", "审批管理-工单");
    await page.evaluate(() => document.querySelector("[data-approval-tab='子流程审批']").click());
    await page.waitForFunction(() => document.querySelector("[data-approval-tab='子流程审批']")?.classList.contains("is-active"));
    const subprocessApprovalBusinessHeaders = await page.locator(".approval-table thead th").evaluateAll(headers => headers.map(header => header.textContent.replace(/[↑↓↕]/g, "").trim()).filter(label => label && label !== "操作"));
    assert(JSON.stringify(subprocessApprovalBusinessHeaders) === JSON.stringify(subprocessProcessBusinessHeaders), "子单审批与子单处理列表表头不一致");
    const subprocessApprovalView = page.locator('.approval-table [data-action="approval-subprocess-detail"]').first();
    assert(await subprocessApprovalView.count() === 1, "子流程审批列表缺少查看按钮");
    await subprocessApprovalView.click();
    await page.waitForSelector('.subprocess-detail-page');
    assert((await page.locator('.subprocess-detail-page').innerText()).includes("返回审批管理"), "子流程审批查看未跳转到对应详情页或缺少审批管理返回入口");
    await page.goBack();
    await page.waitForSelector('[data-approval-tab="子流程审批"].is-active');
    await assertDeadlineOnlySort(".approval-table", "审批管理-子单");
    await page.evaluate(() => document.querySelector("[data-approval-tab='短信审批']").click());
    await page.waitForFunction(() => document.querySelector("[data-approval-tab='短信审批']")?.classList.contains("is-active"));
    const smsApprovalFilterText = await page.locator(".approval-filter-panel").innerText();
    assert(!smsApprovalFilterText.includes("短信审批状态"), "短信审批筛选区不应展示短信审批状态");
    const smsApprovalText = await page.locator(".approval-table").innerText();
    const smsApprovalHeaders = await page.locator(".approval-table thead th").evaluateAll(headers => headers.map(header => header.textContent.replace(/[↑↓↕]/g, "").trim()).filter(Boolean));
    assert(await page.locator('.approval-table [data-operation-key="detail"], .approval-table [data-operation-key="view"]').count() === 0, "短信审批列表仍显示查看按钮");
    for (const header of ["短信编号", "关联工单编号", "短信审批状态", "处置期限", "操作"]) assert(smsApprovalHeaders.includes(header), "短信审批列表缺少表头：" + header);
    for (const removedHeader of ["审批类型", "业务类型", "发起人", "发起机构", "当前节点", "单据状态"]) assert(!smsApprovalHeaders.includes(removedHeader), "短信审批列表仍显示旧表头：" + removedHeader);
    await page.locator(".approval-table .column-customizer-trigger").click();
    const smsColumnPopover = page.locator('.column-customizer-popover[data-runtime]:not([hidden])');
    const smsRemainingTimeColumn = smsColumnPopover.locator('[data-optional-column-label="剩余处置时间"]');
    assert(await smsRemainingTimeColumn.count() === 1 && !(await smsRemainingTimeColumn.isChecked()), "短信审批剩余处置时间应默认隐藏并支持配置");
    await smsRemainingTimeColumn.check();
    const smsTimeHeaders = await page.locator(".approval-table thead").innerText();
    assert(smsTimeHeaders.includes("处置期限") && smsTimeHeaders.includes("剩余处置时间"), "短信审批处置期限与剩余处置时间不能并列显示");
    await smsColumnPopover.locator("[data-column-reset]").click();
    assert(smsApprovalText.includes("DX202607310101"), "短信审批列表缺少新时间样例");
    assert(!smsApprovalText.includes("剩余 1 天"), "短信审批仍显示旧的天级硬编码时限");

    await page.evaluate(() => document.querySelector("[data-approval-tab='导出申请审批']").click());
    await page.waitForFunction(() => document.querySelector("[data-approval-tab='导出申请审批']")?.classList.contains("is-active"));
    const approvalExportFilterRows = page.locator(".export-request-filter-panel.approval-filter-panel .export-filter-row");
    assert(JSON.stringify((await approvalExportFilterRows.nth(0).locator("label").allInnerTexts()).map(text => text.trim())) === JSON.stringify(["导出类型", "导出申请状态", "申请时间"]), "审批管理-导出申请首行筛选条件不正确");
    assert(JSON.stringify((await approvalExportFilterRows.nth(1).locator("label").allInnerTexts()).map(text => text.trim())) === JSON.stringify(["导出申请人", "所属机构", "所属部门"]), "审批管理-导出申请人归属筛选条件未保持同一行");
    assert(JSON.stringify((await approvalExportFilterRows.nth(2).locator("label").allInnerTexts()).map(text => text.trim())) === JSON.stringify(["导出申请编号", "关联工单编号"]), "审批管理-导出申请编号条件未位于最后一行");
    assert(await approvalExportFilterRows.locator("label", { hasText:"导出申请状态" }).count() === 1, "审批管理-导出申请状态筛选重复显示");
    const exportApprovalText = await page.locator(".approval-table").innerText();
    const exportApprovalHeaders = await page.locator(".approval-table thead th").evaluateAll(headers => headers.map(header => header.textContent.replace(/[↑↓↕]/g, "").trim()).filter(Boolean));
    assert(await page.locator('.approval-table [data-operation-key="detail"], .approval-table [data-operation-key="view"]').count() === 0, "导出申请审批列表仍显示查看按钮");
    for (const header of ["导出申请编号", "导出类型", "关联工单编号", "导出申请状态", "申请时间", "过期时间", "操作"]) assert(exportApprovalHeaders.includes(header), "导出申请审批列表缺少表头：" + header);
    for (const removedHeader of ["审批类型", "业务类型", "发起人", "发起机构", "当前节点", "单据状态"]) assert(!exportApprovalHeaders.includes(removedHeader), "导出申请审批列表仍显示旧表头：" + removedHeader);
    assert(exportApprovalText.includes("DC202607310201"), "导出审批列表与导出申请未关联");
    assert(!exportApprovalText.includes("剩余 2 天"), "导出审批仍显示旧的天级硬编码时限");
    const multiExportRelated = page.locator('.approval-table [data-action="export-approval-related-tickets"]').first();
    assert(await multiExportRelated.count() === 1 && (await multiExportRelated.innerText()).endsWith("/..."), "多关联工单的导出审批未显示首个编号省略入口");
    await multiExportRelated.click();
    assert(await page.locator(".related-ticket-dialog tbody [data-action='detail']").count() === 2, "导出审批关联工单弹窗未展示完整编号列表");
    await page.getByRole("button", { name:"取消", exact:true }).click();
    assert(await page.locator('.approval-table [data-action="detail"][data-id="TS202607180026"]').count() === 1, "单个关联工单的导出审批未提供直接跳转入口");

    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='development']");
    await page.click("[data-role-profile='development-developer']");
    const topLevelModuleRoutes = [
      ["review-manage", "消保审查", "consumer-review"],
      ["education-manage", "宣传教育", "education"],
      ["notice-complaint", "投诉管理通知", "notifications"],
      ["notice-review", "消保审查通知", "notifications"]
    ];
    for (const [route, heading, moduleName] of topLevelModuleRoutes) {
      await page.evaluate(pageRoute => document.querySelector("[data-page='" + pageRoute + "']").click(), route);
      await page.waitForFunction(({ expectedHeading, expectedModule }) => document.querySelector("[data-module='" + expectedModule + "'] h1")?.textContent.includes(expectedHeading), { expectedHeading: heading, expectedModule: moduleName });
      const modulePage = page.locator("[data-module='" + moduleName + "']");
      assert(await modulePage.locator("h1", { hasText: heading }).count() === 1, heading + " 模块标题未渲染");
      assert(await modulePage.getAttribute("data-module") === moduleName, heading + " 未由独立一级模块接管");
    }


    const adminRouteCases = [
      ["admin-jobs", 6],
      ["admin-audit", 15]
    ];
    for (const [route, expectedRows] of adminRouteCases) {
      await page.evaluate(pageRoute => document.querySelector("[data-page='" + pageRoute + "']").click(), route);
      await page.waitForFunction(rowCount => (
        document.querySelector("[data-module='admin-operations']") &&
        document.querySelectorAll("[data-module='admin-operations'] tbody tr").length === rowCount
      ), expectedRows);
      const modulePage = page.locator("[data-module='admin-operations']");
      assert(await modulePage.count() === 1, route + " is not owned by admin-operations");
      assert(await modulePage.locator("tbody tr").count() === expectedRows, route + " row count changed during migration");
    }

    await page.evaluate(() => document.querySelector("[data-page='admin-notify-complaint']").click());
    await page.waitForFunction(() => (
      document.querySelector("[data-module='admin-operations'] h1")?.textContent.includes("投诉管理消息通知") &&
      document.querySelectorAll("[data-module='admin-operations'] tbody tr").length === 10
    ));
    const notificationModule = page.locator("[data-module='admin-operations']");
    assert((await notificationModule.innerText()).includes("配置投诉管理流程中的站内消息模板与通知渠道"), "投诉管理消息通知缺少生产系统说明");
    assert(await notificationModule.locator("[data-action='admin-notification-template-create']").count() === 1, "投诉管理消息通知缺少新增模板操作");
    assert(await notificationModule.locator("input[placeholder='模板编码/名称/触发节点']").count() === 1, "投诉管理消息通知关键字条件不正确");
    const notificationHeaders = await notificationModule.locator("thead th").allInnerTexts();
    assert(JSON.stringify(notificationHeaders) === JSON.stringify(["提醒类型", "模板名称", "业务模块", "触发节点", "通知角色", "更新时间", "状态", "操作"]), "投诉管理消息通知表头与生产系统不一致");
    assert(await notificationModule.locator("tbody tr").count() === 10, "投诉管理消息通知首屏应显示10条模板");
    assert((await notificationModule.innerText()).includes("共 10 条"), "投诉管理消息通知分页总数不正确");
    assert(await notificationModule.locator("[data-action='admin-notification-template-view']").count() === 10, "消息模板缺少查看操作");
    assert(await notificationModule.locator("[data-action='admin-notification-template-edit']").count() === 10, "消息模板缺少编辑操作");
    assert(await notificationModule.locator("[data-action='admin-notification-template-disable']").count() === 10, "消息模板缺少停用操作");
    assert(await notificationModule.locator(".admin-notify-scene").count() === 0, "投诉管理消息通知仍显示旧提醒节点卡片");
    await notificationModule.locator("[data-action='admin-notification-template-edit']").first().click();
    await page.waitForSelector("[data-module='admin-operations'][data-notification-template-page='edit']");
    const editPage = page.locator("[data-module='admin-operations'][data-notification-template-page='edit']");
    assert((await editPage.innerText()).includes("编辑模板"), "编辑模板未进入独立页面");
    assert((await editPage.innerText()).includes("通知信息") && (await editPage.innerText()).includes("通知模板"), "编辑模板独立页面结构不完整");
    assert((await editPage.innerText()).includes("发送渠道"), "编辑模板独立页面缺少发送渠道");
    assert(await editPage.locator("[data-action='admin-notification-template-list']").count() === 1, "编辑模板页面缺少返回列表");
    assert(await editPage.locator("[data-action='admin-notification-template-save']").count() === 1, "编辑模板页面缺少保存配置");
    assert(await editPage.locator("input:not([disabled]):not([readonly])").count() >= 7, "编辑模板页面字段不可编辑");
    await editPage.locator("[data-action='admin-notification-template-list']").click();
    await page.waitForSelector("[data-action='admin-notification-template-create']");
    await page.locator("[data-module='admin-operations'] [data-action='admin-notification-template-create']").click();
    await page.waitForSelector("[data-module='admin-operations'][data-notification-template-page='create']");
    const addPage = page.locator("[data-module='admin-operations'][data-notification-template-page='create']");
    assert(JSON.stringify(await addPage.locator("[data-admin-notification-type] option").allInnerTexts()) === JSON.stringify(["请选择", "待办提醒", "审批结果", "消息通知"]), "新增消息模板提醒类型字典不正确");
    assert(await addPage.locator("input:not([disabled]):not([readonly])").count() >= 7, "新增消息模板字段不可编辑");
    await addPage.locator("[data-action='admin-notification-template-list']").click();

    await page.evaluate(() => document.querySelector("[data-page='admin-audit']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-operations'] tbody tr").length === 15);
    await page.locator("[data-action='admin-audit-tab'][data-id='review']").click();
    await page.waitForFunction(() => (
      document.querySelector("[data-action='admin-audit-tab'][data-id='review']")?.classList.contains("is-active") &&
      document.querySelectorAll("[data-module='admin-operations'] tbody tr").length === 3
    ));
    await page.locator("[data-action='admin-audit-detail']").first().click();
    await page.waitForSelector("#overlay-root .modal .modal-body");
    assert((await page.locator("#overlay-root .modal .modal-body").innerText()).trim().length > 0, "audit detail modal is empty");
    await page.keyboard.press("Escape");


    await page.evaluate(() => document.querySelector("[data-page='admin-config-complaint']").click());
    await page.waitForFunction(() => (
      document.querySelector("[data-module='admin-config']") &&
      document.querySelector("[data-module='admin-config'] .admin-config-section")
    ));
    await page.waitForFunction(() => (
      document.querySelectorAll("[data-module='admin-config'] tbody tr").length === 9
    ));
    assert(await page.locator("[data-module='admin-config'] [data-action='admin-config-tab']").count() === 0, "admin config still has inner reminder/alert tabs");
    const configSwitch = page.locator("[data-module='admin-config'] [data-action='admin-switch-toggle']").first();
    const configSwitchBefore = await configSwitch.getAttribute("aria-checked");
    await configSwitch.click();
    assert(await configSwitch.getAttribute("aria-checked") !== configSwitchBefore, "admin config switch did not change state");
    await page.locator("[data-module='admin-config'] [data-action='admin-alert-detail']").first().click();
    await page.waitForFunction(() => (
      document.querySelector("[data-module='admin-config'] h1")?.textContent.includes("工单全量预警") &&
      document.querySelector("[data-module='admin-config']")?.innerText.includes("预警规则") &&
      document.querySelector("[data-module='admin-config']")?.innerText.includes("时间范围") &&
      document.querySelector("[data-module='admin-config']")?.innerText.includes("环比阈值")
    ));
    await page.locator("[data-module='admin-config'] [data-action='admin-alert-save']").first().click();
    await page.waitForSelector("#overlay-root .modal");
    assert((await page.locator("#overlay-root .modal").innerText()).includes("确认保存预警参数"), "预警参数保存未展示确认摘要弹窗");
    await page.keyboard.press("Escape");
    await page.locator("[data-module='admin-config'] [data-action='admin-alert-list']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-config'] tbody tr").length === 9);
    await page.locator("[data-module='admin-config'] [data-action='admin-alert-scope'][data-id='branch']").click();
    await page.locator("[data-module='admin-config'] [data-action='admin-alert-create']").click();
    await page.locator("[data-module='admin-config'] [data-admin-alert-type]").selectOption("product");
    await page.waitForFunction(() => document.querySelector("[data-module='admin-config']")?.innerText.includes("一级产品投诉量异常"));
    await page.locator("[data-module='admin-config'] .admin-alert-org-scope-field .di-hierarchy-cascader-trigger").click();
    await page.locator("[data-module='admin-config'] .admin-alert-org-scope-field [data-hierarchy-parent]", { hasText: "厦门分行" }).first().click();
    await page.locator("[data-module='admin-config'] .admin-alert-org-scope-field [data-hierarchy-confirm]").click();
    await page.locator("[data-module='admin-config'] [data-action='admin-alert-copy-save']").click();
    await page.waitForSelector("#overlay-root .modal");
    await page.locator("#modal-confirm").click();
    await page.waitForFunction(() => {
      const body = document.querySelector("[data-module='admin-config'] tbody")?.innerText || "";
      return body.includes("产品类") && body.includes("厦门分行");
    });

    await page.evaluate(() => document.querySelector("[data-page='admin-form-dictionary']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-form-config'] .admin-dictionary-type").length === 10);
    const dictionaryModule = page.locator("[data-module='admin-form-config']");
    assert((await dictionaryModule.innerText()).includes("字典类型") && (await dictionaryModule.innerText()).includes("字典项 — 投诉单 · 受理渠道"), "字典管理未按表单和字段拆分为左右双栏");
    assert(await dictionaryModule.locator("[data-action='admin-dictionary-type-create']").isVisible(), "字典管理缺少新增类型入口");
    assert(await dictionaryModule.locator("[data-action='admin-dictionary-item-create']").isVisible(), "字典管理缺少新增字典项入口");
    await dictionaryModule.locator("[data-action='admin-dictionary-select'][data-id='biz_channel']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-form-config']")?.textContent.includes("字典项 — 投诉单 · 业务办理渠道"));
    await page.evaluate(() => document.querySelector("[data-page='admin-form-sms']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-form-config'] .admin-list-card:first-of-type tbody tr").length === 3);
    assert(await page.locator("[data-module='admin-form-config'] [data-action='admin-form-sms-create']").isVisible(), "短信模板列表未展示新增入口");
    assert((await page.locator("[data-module='admin-form-config'] .admin-list-card:first-of-type thead").innerText()).includes("启用状态"), "短信模板列表缺少启用状态列");
    const smsTemplateRow = page.locator("[data-module='admin-form-config'] .admin-list-card:first-of-type tbody tr").first();
    await smsTemplateRow.locator("[data-action='admin-form-sms-edit']").click();
    await page.waitForSelector("#overlay-root .admin-sms-template-modal [data-admin-sms-category]");
    assert(await page.locator("#overlay-root [data-admin-sms-title]").count() === 0, "短信模板编辑弹窗仍展示短信标题");
    const categoryTrigger = page.locator("#overlay-root .admin-sms-category-field [data-native-select-trigger]");
    await categoryTrigger.click();
    const categoryMenu = page.locator("#overlay-root .admin-sms-category-field [data-native-select-menu]");
    assert(await categoryMenu.isVisible(), "短信分类下拉框点击后未展开");
    await categoryMenu.locator('[data-native-select-value="处理沟通短信"]').click();
    assert(await page.locator("#overlay-root [data-admin-sms-category]").inputValue() === "处理沟通短信", "短信分类选择结果未写入");
    await page.locator("#overlay-root [data-admin-sms-content]").fill("浏览器保存后的短信正文【投诉编号】");
    await page.locator("#modal-confirm").click();
    await page.waitForSelector("#overlay-root .admin-sms-template-modal", { state:"detached" });
    assert((await page.locator("[data-module='admin-form-config']").innerText()).includes("短信模板修改记录"), "短信模板列表下方未展示修改记录");
    await page.evaluate(() => document.querySelector("[data-page='analysis-warnings']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaint-monitoring'] tbody tr").length === 8);
    await page.locator("[data-module='complaint-monitoring'] [data-action='monitoring-warning-detail'][data-id='YJ20260104006']").click();
    await page.waitForSelector(".analysis-warning-detail-page[data-warning-detail-id='YJ20260104006']");
    const warningDetailText = await page.locator(".analysis-warning-detail-page").innerText();
    assert(warningDetailText.includes("客户姓名") && warningDetailText.includes("客户编号"), "预警详情页未拆分展示客户姓名和客户编号");
    await page.locator("[data-action='monitoring-ticket-open'][data-id='TS202607230012']").first().click();
    await page.waitForFunction(() => document.querySelector(".ticket-detail-page")?.textContent.includes("关联预警内容"));
    await page.evaluate(() => document.querySelector("[data-page='analysis-inspections']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaint-inspections'] .inspection-ticket-table tbody tr").length === 4);
    const inspectionHeaders = await page.locator("[data-module='complaint-inspections'] .inspection-ticket-table thead th").allInnerTexts();
    assert(!inspectionHeaders.includes("核查状态"), "核查工单列表仍显示核查状态列");
    assert(inspectionHeaders.includes("核查结果状态") && !inspectionHeaders.includes("录入核查") && !inspectionHeaders.includes("沟通处理核查") && !inspectionHeaders.includes("产品业务核查"), "三项核查列未合并为核查结果状态");
    assert(inspectionHeaders.includes("提交处理结果时间") && !inspectionHeaders.includes("办结时间"), "核查列表时间字段未更新");
    assert(inspectionHeaders.indexOf("所属部门") === inspectionHeaders.indexOf("所属机构") + 1, "核查工单所属部门未紧跟所属机构");
    const inspectionDepartments = await page.locator("[data-module='complaint-inspections'] .inspection-ticket-table tbody tr td:nth-child(6)").allInnerTexts();
    assert(inspectionDepartments.some(value => value.trim() && value.trim() !== "-"), "核查工单所属部门未显示工单数据");
    const existingLetterRow = page.locator("[data-module='complaint-inspections'] .inspection-ticket-table tr", { hasText:"TS202607230012" });
    assert(await existingLetterRow.locator("[data-action='inspections-letter-page']").innerText() === "查看督导函", "已发送督导函未提供查看入口");
    assert(await existingLetterRow.locator("[data-action='inspections-edit-letter'], [data-action='inspections-delete-letter']").count() === 0, "已发送督导函仍显示编辑或删除操作");
    assert(await existingLetterRow.locator("[data-action='inspections-send-letter']").count() === 0, "已发送督导函仍允许重复发送");
    assert(await page.locator("[data-module='complaint-inspections'] [data-inspections-sort-index]").count() === 0, "智能核查列表不应保留非处置期限排序");
    assert(await page.locator("[data-module='complaint-inspections'] [data-action='inspections-batch-open']").count() === 0, "智能核查不应再显示批次详情入口");
    const inspectionTypeOptions = await page.locator("[data-module='complaint-inspections'] .ticket-filter-item", { hasText:"工单类型" }).locator("select option").allInnerTexts();
    assert(JSON.stringify(inspectionTypeOptions) === JSON.stringify(["全部", "投诉单", "信访单"]), "智能核查工单类型应仅含投诉单与信访单");
    const inspectionFilters = page.locator("[data-module='complaint-inspections'] .inspection-filter-panel");
    assert(!(await inspectionFilters.innerText()).includes("核查状态"), "核查工单查询栏仍显示核查状态");
    assert((await inspectionFilters.locator(".ticket-filter-item", { hasText:"提交处理结果时间" }).locator("[data-app-picker]").first().getAttribute("data-min-date")) === "2015-01-01", "提交处理结果时间未限制最早 2015 年");
    await inspectionFilters.locator(".ticket-filter-item", { hasText:"核查结果状态" }).locator("select").selectOption({ label:"通过" });
    await inspectionFilters.locator('[data-action="search"]').click();
    const passedInspectionRows = await page.locator("[data-module='complaint-inspections'] .inspection-ticket-table tbody tr:visible").allInnerTexts();
    assert(passedInspectionRows.length >= 1 && passedInspectionRows.every(row => row.includes("通过") && !row.includes("不通过") && !row.includes("发送")), "通过状态筛选错误或仍允许发送");
    await inspectionFilters.locator('[data-action="reset-filter"]').click();
    await inspectionFilters.locator(".ticket-filter-item", { hasText:"核查结果状态" }).locator("select").selectOption({ label:"不通过" });
    await inspectionFilters.locator('[data-action="search"]').click();
    const failedInspectionRows = await page.locator("[data-module='complaint-inspections'] .inspection-ticket-table tbody tr:visible").allInnerTexts();
    assert(failedInspectionRows.length >= 1 && failedInspectionRows.every(row => row.includes("不通过") && (row.includes("发送") || row.includes("查看督导函")) && !row.includes("编辑") && !row.includes("删除")), "不通过状态筛选错误或存在错误的督导函操作");
    await inspectionFilters.locator('[data-action="reset-filter"]').click();
    await inspectionFilters.locator(".ticket-filter-item", { hasText:"工单编号" }).locator("input").fill("TS202607230012");
    await inspectionFilters.locator('[data-action="search"]').click();
    assert(await page.locator("[data-module='complaint-inspections'] .inspection-ticket-table tbody tr:visible").count() === 1, "工单编号未精准筛选工单");
    await inspectionFilters.locator('[data-action="reset-filter"]').click();
    await inspectionFilters.locator(".ticket-filter-item", { hasText:"工单类型" }).locator("select").selectOption({ label:"信访单" });
    await inspectionFilters.locator('[data-action="search"]').click();
    const visibleInspectionTypes = await page.locator("[data-module='complaint-inspections'] .inspection-ticket-table tbody tr:visible td:nth-child(2)").allInnerTexts();
    assert(visibleInspectionTypes.length > 0 && visibleInspectionTypes.every(type => type === "信访单"), "工单类型未筛选对应工单");
    await inspectionFilters.locator('[data-action="reset-filter"]').click();
    const inspectionTicketLink = page.locator("[data-module='complaint-inspections'] .inspection-ticket-table [data-action='inspections-open-ticket']").first();
    assert(await inspectionTicketLink.count() === 1, "批次工单编号未渲染为详情链接");
    assert(await inspectionTicketLink.evaluate(node => node.classList.contains("btn-link") && getComputedStyle(node).color !== getComputedStyle(node.closest("tr")).color), "批次工单编号未使用项目统一的蓝色链接样式");
    await inspectionTicketLink.click();
    await page.waitForSelector(".ticket-detail-page");
    await page.locator('[data-detail-tab="处理信息"]').click();
    assert(await page.locator("#section-intelligent-inspection").count() === 0, "处理中工单不应展示审批阶段核查结果");
    await page.evaluate(() => document.querySelector("[data-page='analysis-inspections']").click());
    await page.waitForSelector("[data-module='complaint-inspections'] .inspection-ticket-table");
    await page.locator("[data-module='complaint-inspections'] .inspection-ticket-table tr", { hasText: "TS202607230012" }).locator("[data-action='inspections-ticket-detail']").click();
    await page.waitForFunction(() => document.querySelector("#overlay-root .modal-head")?.textContent.includes("核查工单详情"));
    const inspectionModal = page.locator("#overlay-root .inspection-ticket-dialog");
    assert(await inspectionModal.locator('[data-inspection-dimension="entry"] [data-inspection-state="generating"]').count() === 1, "指定工单弹窗的录入核查未显示生成中");
    assert(await inspectionModal.locator('[data-inspection-dimension="productBusiness"] [data-inspection-state="failed"] [data-inspection-retry="productBusiness"]').count() === 1, "指定工单弹窗的产品业务核查未显示生成失败及重新生成");
    await inspectionModal.locator('[data-inspection-retry="productBusiness"]').click();
    assert(await inspectionModal.locator('[data-inspection-dimension="productBusiness"] [data-inspection-state="generating"]').count() === 1, "重新生成后产品业务核查未切换为生成中");
    await page.locator("#overlay-root .modal-foot [data-close-overlay]").click();
    await page.locator("[data-module='complaint-inspections'] .inspection-ticket-table [data-action='inspections-open-ticket'][data-id='TS202607230012']").click();
    await page.waitForSelector(".ticket-detail-page");
    await page.locator('[data-detail-tab="处理信息"]').click();
    assert(await page.locator("#section-intelligent-inspection").count() === 0, "处理中工单不应展示重新生成的审批结果");
    await page.evaluate(() => document.querySelector("[data-page='analysis-inspections']").click());
    await page.waitForSelector("[data-module='complaint-inspections'] .inspection-ticket-table");
    const passedPetitionRow = page.locator("[data-module='complaint-inspections'] .inspection-ticket-table tr", { hasText:"XF202607210008" });
    assert((await passedPetitionRow.innerText()).includes("通过") && !(await passedPetitionRow.innerText()).includes("发送"), "三项通过的信访单状态或操作不正确");
    await passedPetitionRow.locator("[data-action='inspections-ticket-detail']").click();
    await page.waitForSelector("#overlay-root .inspection-ticket-dialog");
    assert(await page.locator("#overlay-root .inspection-ticket-dialog .approval-inspection-status.is-pass").count() === 3, "信访单核查弹窗未展示三项通过");
    await page.locator("#overlay-root .modal-foot [data-close-overlay]").click();
    await page.locator("[data-module='complaint-inspections'] [data-action='inspections-open-ticket'][data-id='XF202607210008']").click();
    await page.waitForSelector(".ticket-detail-page");
    await page.locator('[data-detail-tab="处理信息"]').click();
    assert(await page.locator("#section-intelligent-inspection").count() === 0, "待处理信访单不应展示审批阶段核查结果");
    await page.evaluate(() => document.querySelector("[data-page='analysis-inspections']").click());
    await page.waitForSelector("[data-module='complaint-inspections'] .inspection-ticket-table");
    await page.evaluate(() => {
      const letters = window.XIBComplaintInspections.serializeState().supervisionLetters.filter(letter => letter.ticketId !== "TS202607230012");
      window.XIBComplaintInspections.hydrateState({ supervisionLetters:letters });
      document.querySelector("[data-page='analysis-inspections']").click();
    });
    await page.waitForSelector("[data-module='complaint-inspections'] .inspection-ticket-table [data-action='inspections-send-letter'][data-id='TS202607230012']");
    await page.locator("[data-module='complaint-inspections'] .inspection-ticket-table tr", { hasText: "TS202607230012" }).locator("[data-action='inspections-send-letter']").click();
    await page.waitForFunction(() => document.querySelector("#overlay-root .modal-head")?.textContent.includes("发送督导函"));
    assert((await page.locator("#overlay-root .supervision-ticket-summary").innerText()).includes("厦门分行消费者权益保护部"), "新增督导函的发送弹窗未展示接收部门");
    const letterEditorText = await page.locator("#overlay-root .supervision-letter-editor").innerText();
    assert(letterEditorText.includes("投诉产品标签") && letterEditorText.includes("发送人所属机构/部门") && letterEditorText.includes("接收机构") && letterEditorText.includes("接收部门") && !letterEditorText.includes("事项 / 业务"), "发送督导函的摘要字段未更新");
    await page.locator("#overlay-root [data-supervision-approver-trigger]").click();
    const ccApprovers = await page.locator("#overlay-root [data-supervision-cc-approver]").evaluateAll(nodes => nodes.map(node => node.value));
    assert(ccApprovers.includes("赵宁-29816") && ccApprovers.includes("郭颖-18307"), "抄送审批人下拉缺少候选人");
    await page.locator("#overlay-root [data-supervision-cc-approver]:checked").uncheck();
    await page.locator("#overlay-root [data-supervision-cc-approver][value='赵宁-29816']").check();
    await page.locator("#overlay-root [data-supervision-cc-approver][value='郭颖-18307']").check();
    await page.locator("#overlay-root [data-supervision-approver-confirm]").click();
    await page.locator("#modal-confirm").click();
    await page.waitForFunction(() => document.querySelector("#overlay-root .modal-head")?.textContent.includes("确认发送督导函"));
    const supervisionConfirmationText = await page.locator("#overlay-root .modal-body").innerText();
    assert(supervisionConfirmationText.includes("赵宁-29816") && supervisionConfirmationText.includes("郭颖-18307"), "发送确认未使用多选的抄送审批人");
    await page.locator("#modal-confirm").click();
    await page.waitForSelector("#overlay-root .contact-result");
    const supervisionSendResult = await page.locator("#overlay-root .contact-result").innerText();
    assert(supervisionSendResult.includes("已通过系统发送给处理人"), `督导函发送失败：${supervisionSendResult}`);
    const sentSupervisionId = supervisionSendResult.match(/DH\d{12}/)?.[0];
    assert(sentSupervisionId && /^DH\d{12}$/.test(sentSupervisionId), "督导函编号未按 DH + 年月日 + 4位流水号生成");
    const sentSupervision = await page.evaluate(id => window.XIBComplaintInspections.serializeState().supervisionLetters.find(letter => letter.id === id), sentSupervisionId);
    assert(sentSupervision?.ccApprovers?.length === 2 && sentSupervision.ccApprovers.includes("赵宁-29816") && sentSupervision.ccApprovers.includes("郭颖-18307") && sentSupervision?.senderDept === "总行消费者权益保护部", "督导函未保存多个抄送审批人或发送部门");
    await page.getByRole("button", { name: "完成" }).click();
    await page.locator("[data-inspections-tab='督导记录']").click();
    await page.waitForSelector(".supervision-record-table thead th");
    const supervisionHeaders = await page.locator(".supervision-record-table thead th").allInnerTexts();
    assert(supervisionHeaders.indexOf("接收部门") === supervisionHeaders.indexOf("接收机构") + 1, `督导记录接收部门列位置不正确：${supervisionHeaders.join(" / ")}`);
    assert(!supervisionHeaders.includes("发送机构") && !supervisionHeaders.includes("发送部门"), "督导记录仍显示发送方机构或部门列");
    assert(!supervisionHeaders.includes("更新时间"), "督导记录仍显示更新时间列");
    const receiverInstitutionFilter = page.locator('[data-app-hierarchy-cascader][data-field-key="filter.inspections.receiverInstitution"]');
    const receiverDepartmentFilter = page.locator('[data-app-hierarchy-cascader][data-field-key="filter.inspections.receiverDepartment"]');
    assert((await receiverInstitutionFilter.getAttribute("data-dictionary")) === "institutionTree" && (await receiverInstitutionFilter.getAttribute("data-multiple")) === "true" && (await receiverInstitutionFilter.getAttribute("data-searchable")) === "true", "接收机构未复用子单处理的全量机构树");
    assert((await receiverDepartmentFilter.getAttribute("data-dictionary")) === "departmentTree", "接收部门未复用子单处理的全量部门树");
    await receiverDepartmentFilter.evaluate(host => host.dispatchEvent(new CustomEvent("xib:hierarchy-set", { detail:["总行 / 总行消费者权益保护部"] })));
    await page.locator("[data-module='complaint-inspections'] .filter-panel [data-action='search']").click();
    assert(await page.locator(".supervision-record-table tbody tr:visible:not(.filter-empty-row)").count() === 0, `接收部门筛选未排除不匹配的督导记录：${await receiverDepartmentFilter.locator('input[type="hidden"]').inputValue()} / ${(await page.locator(".supervision-record-table tbody tr:visible:not(.filter-empty-row)").allInnerTexts()).join(" | ")}`);
    await page.locator("[data-module='complaint-inspections'] .filter-panel [data-action='reset-filter']").click();
    const sentReceiverDepartmentPath = `${sentSupervision.receiverOrg} / ${sentSupervision.receiverDept}`;
    await receiverDepartmentFilter.evaluate((host, path) => host.dispatchEvent(new CustomEvent("xib:hierarchy-set", { detail:[path] })), sentReceiverDepartmentPath);
    await page.locator("[data-module='complaint-inspections'] .filter-panel [data-action='search']").click();
    const sentSupervisionRow = page.locator(".supervision-record-table tbody tr", { hasText:sentSupervisionId });
    assert(await sentSupervisionRow.isVisible() && (await sentSupervisionRow.innerText()).includes(sentSupervision.receiverDept), "新督导函未展示或筛出接收部门");
    await page.locator("[data-module='complaint-inspections'] .filter-panel [data-action='reset-filter']").click();
    await receiverInstitutionFilter.evaluate(host => host.dispatchEvent(new CustomEvent("xib:hierarchy-set", { detail:["总行 / 总行"] })));
    await page.locator("[data-module='complaint-inspections'] .filter-panel [data-action='search']").click();
    assert(await page.locator(".supervision-record-table tbody tr:visible:not(.filter-empty-row)").count() === 0, "接收机构筛选未排除不匹配的督导记录");
    await page.locator("[data-module='complaint-inspections'] .filter-panel [data-action='reset-filter']").click();
    const sentReceiverInstitutionPath = `${sentSupervision.receiverOrg} / ${sentSupervision.receiverOrg}`;
    await receiverInstitutionFilter.evaluate((host, path) => host.dispatchEvent(new CustomEvent("xib:hierarchy-set", { detail:[path] })), sentReceiverInstitutionPath);
    await page.locator("[data-module='complaint-inspections'] .filter-panel [data-action='search']").click();
    assert(await sentSupervisionRow.isVisible(), "接收机构筛选未命中对应的督导记录");
    await page.locator("[data-module='complaint-inspections'] .filter-panel [data-action='reset-filter']").click();
    await page.goto(`http://127.0.0.1:${port}/?testRoute=subprocess-manage#subprocess-manage`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-subprocess-scope='我的工作台']");
    await page.click("[data-subprocess-scope='我的工作台']");
    await page.waitForFunction(() => document.querySelector("[data-subprocess-scope='我的工作台']")?.classList.contains("is-active"));
    const workbenchSupervisionMatches = page.locator(".subprocess-list-table tbody tr", { hasText: sentSupervisionId });
    assert(await workbenchSupervisionMatches.count() === 1, `直接指派的新督导函未进入我的工作台：${sentSupervisionId}｜${(await workbenchSupervisionMatches.allTextContents()).join(" / ")}`);
    assert((await workbenchSupervisionMatches.first().innerText()).includes("处理中"), "直接指派的新督导函状态不是处理中");
    const supervisionRow = workbenchSupervisionMatches.first();
    await supervisionRow.locator("[data-action='process-supervision-letter']").waitFor();
    await supervisionRow.locator("[data-action='process-supervision-letter']").click();
    await page.waitForSelector(".supervision-letter-detail-page");
    await page.waitForSelector("[data-supervision-feedback-field]");
    await page.locator("[data-supervision-feedback-field]").fill("已补充处理依据、联系记录和客户说明材料。");
    await page.locator("[data-action='submit-supervision-letter-feedback']").click();
    await page.waitForFunction(() => document.querySelector(".supervision-letter-detail-page")?.textContent.includes("已办结"));
    await page.evaluate(() => document.querySelector("[data-page='admin-org']").click());
    await page.waitForFunction(() => document.querySelector("[data-module='admin-organizations'] .admin-org-tree-toolbar")?.textContent.includes("1221"));
    await page.locator("#admin-org-filter-name").fill("厦门分行");
    await page.locator("[data-action='admin-org-search']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-organizations'] .admin-org-tree-toolbar")?.textContent.includes("共 1 个机构"));
    await page.locator("[data-module='admin-organizations'] [data-action='admin-select-org'][data-id='000100012003']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-organizations'] .admin-detail-section .panel-title")?.textContent === "厦门分行");
    await page.locator("[data-module='admin-organizations'] [data-action='admin-org-reset']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-organizations'] .admin-org-tree-toolbar")?.textContent.includes("1221"));
    await page.evaluate(() => document.querySelector("[data-page='admin-user']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-users'] tbody tr").length === (window.XIB_ADMIN_USERS_DATA?.users?.length || 0));
    await page.locator("[data-module='admin-users'] [data-action='admin-user-detail'][data-id='U008']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-users'] h1")?.textContent.trim() === "用户详情");
    assert((await page.locator("[data-module='admin-users']").innerText()).includes("赵霞"), "用户详情缺少用户姓名");
    assert((await page.locator("[data-module='admin-users']").innerText()).includes("福州分行"), "用户详情缺少当前机构信息");
    await page.locator("[data-module='admin-users'] [data-action='admin-user-list']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-users'] tbody tr").length === (window.XIB_ADMIN_USERS_DATA?.users?.length || 0));
    await page.evaluate(() => document.querySelector("[data-page='admin-permission']").click());
    await page.locator("[data-module='admin-permissions'] [data-action='admin-perm-tab'][data-id='biz']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-permissions'] tbody tr").length === 10);
    await page.locator("[data-module='admin-permissions'] [data-action='admin-role-edit']").first().click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-permissions'] .admin-role-dialog h2")?.textContent.trim() === "修改角色");
    await page.locator("[data-module='admin-permissions'] [data-action='admin-role-list']").first().click();
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-permissions'] tbody tr").length === 10);
    await page.evaluate(() => document.querySelector("[data-page='analysis-reports']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaints-reports'] [data-action='complaints-report-open']").length === 25);
    assert(await page.locator("[data-report-group='行内报表'] [data-action='complaints-report-type']").count() === 3, "行内报表缺少全部、统计、明细切换");
    assert(await page.locator("[data-report-group='行内报表'] .report-catalog-tabs.xib-segmented-filter").count() === 1, "行内报表类型未复用分段筛选控件");
    await page.locator("[data-report-group='行内报表'] [data-action='complaints-report-type'][data-id='明细']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-report-group='行内报表'] [data-action='complaints-report-open']").length === 8);
    await page.locator("[data-report-group='行内报表'] [data-action='complaints-report-type'][data-id='全部']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaints-reports'] [data-action='complaints-report-open']").length === 25);
    await page.locator("[data-action='complaints-report-open'][data-id='regulatory-natural']").click();
    await page.waitForSelector("[data-report-id='regulatory-natural'] [data-complaint-exclusion-rules]");
    const reportRepeat = page.locator("[data-report-id='regulatory-natural'] [data-complaint-exclusion-rule][value='重复投诉']");
    const reportAgain = page.locator("[data-report-id='regulatory-natural'] [data-complaint-exclusion-rule][value='再次投诉']");
    await reportAgain.check();
    assert(await reportRepeat.evaluate(input => !input.checked && input.indeterminate), "报表剔除规则未同步重复/再次投诉的部分选中状态");
    await page.locator("[data-report-id='regulatory-natural'] [data-action='search']").click();
    assert(await page.locator("[data-report-id='regulatory-natural'] [data-report-row]:visible").count() === 10, "报表再次投诉剔除结果不正确");
    await page.locator("[data-report-id='regulatory-natural'] [data-action='reset-filter']").click();
    assert(await page.locator("[data-report-id='regulatory-natural'] [data-report-row]:visible").count() === 12, "报表重置后未恢复全部工单");
    await page.locator("[data-action='navigate-back']").click();
    await page.waitForSelector("[data-report-view='catalog']");
    await page.locator("[data-module='complaints-reports'] [data-action='complaints-report-open'][data-id='customer-behavior']").click();
    await page.waitForSelector("[data-module='complaints-reports'][data-report-view='detail'][data-report-id='customer-behavior']");
    assert(await page.locator("[data-module='complaints-reports'] input[type='number']").count() === 2, "投诉笔数上下限应显示两个输入框");
    assert(await page.locator("[data-module='complaints-reports'] [data-report-row]").count() === 12, "报表详情页应显示 12 条样例工单");
    assert(await page.locator("[data-module='complaints-reports'] [aria-label='配置列表显示字段']").count() === 0, "报表详情列表不应显示字段配置入口");
    assert(await page.locator("[data-module='complaints-reports'] .report-filter-panel.ticket-filter-panel").count() === 1, "报表筛选栏未复用工单筛选布局");
    assert(await page.locator("[data-module='complaints-reports'] [data-app-hierarchy-cascader][data-dictionary='rectificationProduct']").count() === 1, "投诉产品标签未复用产品标签字典");
    assert(await page.locator("[data-module='complaints-reports'] [data-app-hierarchy-cascader][data-dictionary='rectificationCause']").count() === 1, "投诉原因标签未复用原因标签字典");
    await page.locator("[data-module='complaints-reports'] [data-report-row-select]").first().check();
    assert(await page.locator("[data-report-selected-count]").innerText() === "1", "选择工单后已选计数应更新");
    await page.locator("[data-action='complaints-report-export']").click();
    await page.waitForFunction(() => [...document.querySelectorAll("#toast-root .toast")].some(node => node.textContent.includes("已加入导出任务")));
    await page.evaluate(() => {
      localStorage.setItem("xib-role", "developer");
      localStorage.setItem("xib-org", "development");
      localStorage.setItem("xib-role-profile", "development-developer");
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector("[data-page='ledger-query']");
    await page.click("[data-page='ledger-query']");
    await page.waitForSelector('[data-query-tab="工单导出"]');
    await page.locator('[data-query-tab="工单导出"]').click();
    const telephoneTicketRow = page.locator(".selectable-table tbody tr", { hasText:"TS202411080211" });
    await telephoneTicketRow.locator('[data-action="detail"]').click();
    await page.waitForSelector('.ticket-detail-page [data-ticket-detail-section="accept"]');
    const telephoneRecordingField = page.locator('.ticket-detail-page [data-ticket-detail-section="accept"] dt', { hasText:"录音编号" });
    assert(await telephoneRecordingField.count() === 1, "客服电话详情缺少录音编号");
    const telephoneTranscriptAction = page.locator('.ticket-detail-page [data-action="view-call-transcript"][data-id="CALL-20241108-0211"]');
    assert(await telephoneTranscriptAction.count() === 1, "客服电话详情缺少按录音编号查看转文本的入口");
    await telephoneTranscriptAction.click();
    await page.waitForFunction(() => document.querySelector("#overlay-root .modal-body")?.textContent.includes("CALL-20241108-0211"));
    await page.locator("#modal-confirm").click();
    const detailSamples = [
      ["TS202607230012", "投诉单"],
      ["XF202607210008", "信访单"],
      ["BY202607220021", "表扬单"],
      ["JY202607240017", "建议单"]
    ];
    for (const [ticketId, ticketType] of detailSamples) {
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:"domcontentloaded" });
      await page.waitForSelector("[data-page='ledger-query']");
      await page.click("[data-page='ledger-query']");
      await page.waitForSelector('[data-query-tab="工单导出"]');
      await page.locator('[data-query-tab="工单导出"]').click();
      await page.locator(".selectable-table tbody tr", { hasText:ticketId }).locator('[data-action="detail"]').click();
      await page.waitForSelector(".ticket-detail-page .detail-sections");
      const labels = (await page.locator(".ticket-detail-page .detail-sections dt").allInnerTexts()).map(value => value.trim());
      for (const expectedLabel of expectedTicketDetailLabels(ticketId)) assert(labels.includes(expectedLabel), `${ticketType} ${ticketId} 详情缺少 schema 字段：${expectedLabel}`);
      for (const sectionId of expectedTicketDetailSectionIds(ticketId)) assert(await page.locator(`[data-ticket-detail-section="${sectionId}"]`).count() === 1, `${ticketType} ${ticketId} 详情缺少适用的 schema 字段分区：${sectionId}`);
    }
    assert(errors.length === 0, `页面运行错误：${errors.join(" | ")}`);
    console.log(JSON.stringify({
      ok: true,
      pages: ["工单创建", "工单处理", "子单创建", "子单处理", "查询导出-工单", "查询导出-子单", "溯源整改", "审批管理-工单", "审批管理-子单", "短信审批", "导出申请审批", "消保审查", "宣传教育", "通知中心"],
      browserErrors: errors
    }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});

