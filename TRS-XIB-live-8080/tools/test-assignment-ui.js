const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const browserExecutable = findBrowserExecutable();
const mime = {
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml"
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end("Not found");
  response.writeHead(200, { "Content-Type":mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function selectInstitution(host, parent, leaf) {
  await host.locator(".di-hierarchy-cascader-trigger").click();
  await host.locator(`[data-hierarchy-parent="${parent}"]`).click();
  await host.locator(`[data-hierarchy-toggle="${parent} / ${leaf}"]`).dispatchEvent("click");
}

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch(browserExecutable ? { headless:true, executablePath:browserExecutable } : { headless:true });
  const page = await browser.newPage({ viewport:{ width:1600, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    if (localStorage.getItem("xib-role-profile")) return;
    localStorage.setItem("xib-role", "developer");
    localStorage.setItem("xib-org", "development");
    localStorage.setItem("xib-role-profile", "development-developer");
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/?testRoute=ticket-form#ticket-form`, { waitUntil:"domcontentloaded" });
    await page.selectOption("#work-order-type", "投诉单");
    await page.waitForSelector("#section-intelligent-dispatch");
    const dispatchLabels = await page.locator("#section-intelligent-dispatch .form-label span:first-child").allInnerTexts();
    assert(JSON.stringify(dispatchLabels.map(text => text.trim())) === JSON.stringify(["派发机构", "派发部门", "抄送人"]), "智能派发字段展示不完整");
    const alwaysVisibleCopyField = page.locator('.form-item[data-field-name="抄送人"]');
    assert(await alwaysVisibleCopyField.isVisible(), "抄送人应在工单创建页固定显示");
    assert(!(await alwaysVisibleCopyField.locator(".form-label").getAttribute("class")).includes("required"), "未命中自动抄送规则时不应标记必填");
    const readonlyCopyInput = alwaysVisibleCopyField.locator('input[data-auto-dispatch-cc][data-field-key="抄送人"]');
    assert(await readonlyCopyInput.isDisabled(), "未命中自动抄送规则时抄送人应置灰只读");
    assert((await readonlyCopyInput.inputValue()).trim() === "-", "未命中自动抄送规则时默认值应显示为横线");
    assert(!(await page.locator("#section-intelligent-dispatch").innerText()).includes("派发机构/部门"), "智能派发仍显示旧字段名");
    const dispatchInstitution = page.locator('[data-app-hierarchy-cascader][data-field-key="派发机构"]');
    assert((await dispatchInstitution.getAttribute("data-multiple")) === "false", "派发机构必须是单选");
    await selectInstitution(dispatchInstitution, "厦门分行", "厦门湖里支行");
    const dispatchDepartment = page.locator('[data-institution-department][data-field-key="派发部门"]');
    assert(await dispatchDepartment.isDisabled() && (await dispatchDepartment.inputValue()) === "-", "派发机构选择支行后派发部门应显示短横线");
    await selectInstitution(dispatchInstitution, "厦门分行", "厦门分行");
    assert(!(await dispatchDepartment.isDisabled()), "派发机构选择分行本体后派发部门仍不可选");
    assert((await dispatchDepartment.locator("option").allInnerTexts()).some(text => text.includes("厦门分行消费者权益保护部")), "派发部门未加载对应分行部门字典");
    const organizations = require("../data/organization-tree.json").organizations;
    for (const ownerName of ["总行", "厦门分行", "福州分行", "宁德分行"]) {
      await selectInstitution(dispatchInstitution, ownerName, ownerName);
      const owner = organizations.find(item => item.name === ownerName);
      const expected = organizations.filter(item => item.parentId === owner.id && item.status !== "停用" && ["304902", "304904"].includes(item.type) && /普惠|消费者权益保护/.test(item.name)).map(item => ownerName + item.name);
      const actual = (await dispatchDepartment.locator('option:not([value=""])').allInnerTexts()).filter(text => text !== "-");
      assert(JSON.stringify(actual) === JSON.stringify(expected), ownerName + "智能派发可选部门不符合机构树的普惠/消保范围：" + actual.join("、"));
      assert(["", "-"].includes(await dispatchDepartment.inputValue()), "切换机构后不应保留上一机构的具体部门");
      await dispatchDepartment.selectOption(expected[0]);
    }
    await selectInstitution(dispatchInstitution, "厦门分行", "厦门湖里支行");
    assert(await dispatchDepartment.isDisabled() && (await dispatchDepartment.inputValue()) === "-", "切换到支行后派发部门应显示短横线");
    assert((await page.locator('.form-item[data-field-name="派发部门"] .form-label').getAttribute("class")).includes("required") === false, "支行部门不应标记必填");
    const departmentText = await dispatchDepartment.evaluate(select => select.closest("[data-native-select-shell]")?.querySelector(".di-native-select-trigger")?.textContent?.trim() || "");
    assert(departmentText === "-", "支行派发部门界面应显示短横线");
    fs.mkdirSync(path.join(root, "test-results"), { recursive:true });
    await page.locator("#section-intelligent-dispatch").screenshot({ animations:"disabled", path:path.join(root, "test-results/smart-dispatch-subbranch.png") });
    await page.locator('[data-action="demo-fill-ticket"]').click();
    await page.waitForFunction(() => document.querySelector('input[data-field-key="customer.1.客户姓名"]')?.value === "陈晓敏");
    assert((await dispatchDepartment.inputValue()) === "", "Demo 不应预填智能派发部门");
    await page.locator('[data-action="smart-classify"]').click();
    await page.waitForFunction(() => document.querySelector('[data-field-key="派发部门"]')?.value.includes("消费者权益保护"));
    await page.waitForSelector(".ai-model-disclaimer");
    assert((await dispatchDepartment.inputValue()).includes("消费者权益保护"), "AI 派发未按允许部门回填");
    fs.mkdirSync(path.join(root, "test-results"), { recursive:true });
    await page.locator("#section-intelligent-dispatch").screenshot({ path:path.join(root, "test-results/smart-dispatch.png") });

    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='customer-service']");
    await page.click("[data-role-profile='customer-operator']");
    await page.waitForFunction(() => document.querySelector(".top-role-control")?.textContent.includes("客户服务中心"));
    assert((await page.locator(".top-role-control").innerText()).includes("客户服务中心"), "客服角色未在页面导航后保持");
    assert(await page.locator('.form-item[data-field-name="抄送人"]').count() === 1, "客服/总行消保创建视角未初始化抄送人控件");
    const serviceDispatchLabels = (await page.locator("#section-intelligent-dispatch .form-label span:first-child").allInnerTexts()).map(text => text.trim());
    assert(JSON.stringify(serviceDispatchLabels) === JSON.stringify(["派发机构", "派发部门", "抄送人"]), "智能派发应只显示派发机构、派发部门和抄送人：" + serviceDispatchLabels.join("、"));
    const serviceDispatchInstitution = page.locator('[data-app-hierarchy-cascader][data-field-key="派发机构"]');
    await selectInstitution(serviceDispatchInstitution, "厦门分行", "厦门湖里支行");
    const dispatchCopyField = page.locator('.form-item[data-field-name="抄送人"]');
    await dispatchCopyField.waitFor();
    const dispatchCopyInput = dispatchCopyField.locator('input[data-auto-dispatch-cc][data-field-key="抄送人"]');
    assert(await dispatchCopyInput.isDisabled(), "命中自动抄送规则后抄送人应保持系统只读");
    await page.waitForFunction(() => document.querySelector('input[data-auto-dispatch-cc][data-field-key="抄送人"]')?.value.includes("苏晴-39108"));
    assert((await dispatchCopyField.locator(".form-label").getAttribute("class")).includes("required"), "命中自动抄送规则时抄送人应标记必填");
    const subbranchCopyText = await dispatchCopyInput.inputValue();
    assert(subbranchCopyText === "苏晴-39108、林雪-48216", "派发至支行时未自动抄送对应分行消保全部在职业务员，当前显示：" + subbranchCopyText);
    await selectInstitution(serviceDispatchInstitution, "厦门分行", "厦门分行");
    const serviceDispatchDepartment = page.locator('[data-institution-department][data-field-key="派发部门"]');
    const consumerDepartment = (await serviceDispatchDepartment.locator('option:not([value=""])').evaluateAll(options => options.map(option => option.value))).find(value => value.includes("消费者权益保护"));
    await serviceDispatchDepartment.selectOption(consumerDepartment);
    await page.waitForFunction(() => document.querySelector('input[data-auto-dispatch-cc][data-field-key="抄送人"]')?.value.trim() === "-");
    assert(await dispatchCopyField.isVisible(), "未命中自动抄送规则时抄送人字段仍应显示");
    assert(!(await dispatchCopyField.locator(".form-label").getAttribute("class")).includes("required"), "退出自动抄送条件后抄送人仍被标记为必填");
    const puhuiDepartment = (await serviceDispatchDepartment.locator('option:not([value=""])').evaluateAll(options => options.map(option => option.value))).find(value => value.includes("普惠"));
    await serviceDispatchDepartment.selectOption(puhuiDepartment);
    await dispatchCopyField.waitFor();
    assert((await dispatchCopyInput.inputValue()) === "苏晴-39108、林雪-48216", "派发至分行普惠部门时未自动抄送对应分行消保全部在职业务员");
    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='development']");
    await page.click("[data-role-profile='development-developer']");
    await page.waitForFunction(() => document.querySelector(".top-role-control")?.textContent.includes("开发测试视图"));

    await page.goto(`http://127.0.0.1:${port}/?testRoute=ticket-create#ticket-create`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector(".ticket-list-table");
    const currentInstitutionIndex = await page.locator(".ticket-list-table thead th").evaluateAll(headers => headers.findIndex(header => header.textContent.trim().includes("工单接收机构")));
    const draftRow = page.locator(".ticket-list-table tbody tr", { hasText:"草稿" }).first();
    assert(currentInstitutionIndex >= 0 && (await draftRow.locator("td").nth(currentInstitutionIndex).innerText()).trim() === "-", "草稿工单的工单接收机构未显示短横线");

    await page.goto(`http://127.0.0.1:${port}/?testRoute=ticket-process#ticket-process`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector(".ticket-list-table");
    const processRow = page.locator(".ticket-list-table tr", { hasText:"TS202607230012" });
    assert((await processRow.locator('[data-action="process"]').innerText()).trim() === "处理", "处理中工单未显示处理操作");
    await processRow.locator('[data-action="process"]').click();
    await page.waitForSelector(".ticket-detail-page");
    await page.locator('[data-detail-tab="处理信息"]').click();
    await page.waitForSelector('#section-intelligent-inspection');
    // 投诉单处理阶段展示智能核查模块，提交处理后生成结果。
    assert(await page.locator('#section-intelligent-inspection').count() === 1, '投诉单处理阶段应展示智能核查模块');
    await page.goto(`http://127.0.0.1:${port}/?testRoute=ticket-process#ticket-process`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector(".ticket-list-table");
    const processRowAfterInspectionCheck = page.locator(".ticket-list-table tr", { hasText:"TS202607230012" });

    await processRowAfterInspectionCheck.locator('[data-action="transfer"]').click();
    await page.waitForSelector(".assignment-dialog");
    const ticketSummaryLabels = (await page.locator(".assignment-summary-grid dt").allInnerTexts()).map(text => text.trim());
    assert(JSON.stringify(ticketSummaryLabels) === JSON.stringify(["工单编号", "工单类型", "客户姓名", "当前机构"]), "工单转派只读字段不符合规则");
    const assignmentLabels = (await page.locator(".action-assignment-grid label>span,.assignment-dialog>.action-full-field>span").allInnerTexts()).map(text => text.trim());
    assert(assignmentLabels[0].startsWith("接收机构") && assignmentLabels[1].startsWith("接收部门") && assignmentLabels[2].startsWith("接收人") && assignmentLabels[3].startsWith("转派原因"), "工单转派填写字段不完整");
    const assignmentInstitution = page.locator('[data-app-hierarchy-cascader][data-field-key="assignment-org"]');
    await selectInstitution(assignmentInstitution, "厦门分行", "厦门湖里支行");
    const assignmentDepartment = page.locator("#assignment-department");
    assert(await assignmentDepartment.isDisabled() && (await assignmentDepartment.inputValue()) === "-", "接收机构选择支行后接收部门未显示短横线");
    assert((await page.locator("#assignment-person").inputValue()) === "-", "接收人默认值不是短横线");
    assert((await page.locator(".assignment-dialog>.action-full-field").innerText()).includes("*"), "处理中工单的转派原因未标记必填");
    await page.locator('[data-close-overlay]').last().click();
    const ticketWorkbenchText = await page.locator('.ticket-list-table tbody').innerText();
    assert(!ticketWorkbenchText.includes('待处理'), '工单处理我的工作台仍出现待处理');
    await page.locator('[data-scope="机构工单池"]').click();
    await page.waitForTimeout(100);
    await page.waitForSelector('.ticket-list-table');
    const pendingTicketRow = page.locator('.ticket-list-table tr', { hasText:'XF202607210008' });
    const pendingTicketCount = await pendingTicketRow.count();
    const pendingTicketHtml = pendingTicketCount ? await pendingTicketRow.first().innerText() : await page.locator('.ticket-list-table tbody').innerText();
    const pendingTicketProcess = pendingTicketCount ? await pendingTicketRow.first().locator('[data-action="process"]').count() : 0;
    assert(pendingTicketCount === 1 && pendingTicketProcess === 1, '机构工单池待处理工单缺少处理操作：' + pendingTicketHtml);
    await page.locator('[data-scope="下辖工单池"]').click();
    await page.waitForTimeout(100);
    await page.waitForSelector('.ticket-list-table');
    assert(await page.locator('.ticket-list-table [data-action="process"]').count() === 0, '下辖工单池不应提供处理操作');
    assert(await page.locator('.ticket-list-table [data-action="recall-transfer"], .ticket-list-table [data-unavailable-action="recall-transfer"]').count() === 0, '下辖工单池仍保留已废弃的召回入口或占位');

    await page.goto(`http://127.0.0.1:${port}/?testRoute=subprocess-manage#subprocess-manage`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector(".subprocess-list-table");
    await page.locator('.subprocess-list-table [data-action="transfer-subprocess"]').first().click();
    await page.waitForSelector(".assignment-dialog");
    const subprocessSummaryLabels = (await page.locator(".assignment-summary-grid dt").allInnerTexts()).map(text => text.trim());
    assert(JSON.stringify(subprocessSummaryLabels) === JSON.stringify(["子单编号", "子单类型", "客户姓名", "当前机构"]), "子单转派只读字段不符合规则");
    await page.locator('[data-close-overlay]').last().click();
    const subprocessWorkbenchText = await page.locator('.subprocess-list-table tbody').innerText();
    assert(!subprocessWorkbenchText.includes('待处理'), '子单处理我的工作台仍出现待处理');
    await page.locator('[data-subprocess-scope="机构工单池"]').click();
    await page.waitForTimeout(100);
    await page.waitForSelector('.subprocess-list-table');
    const pendingSubprocessRow = page.locator('.subprocess-list-table tr', { hasText:'DC202607310099' });
    assert(await pendingSubprocessRow.count() === 1 && (await pendingSubprocessRow.locator('[data-action="process-subprocess"]').innerText()).trim() === '处理', '机构工单池待处理子单缺少处理操作');
    await page.locator('[data-subprocess-scope="下辖工单池"]').click();
    await page.waitForTimeout(100);
    await page.waitForSelector('.subprocess-list-table');
    assert(await page.locator('.subprocess-list-table [data-action="recall-transfer"], .subprocess-list-table [data-unavailable-action="recall-transfer"]').count() === 0, '下辖子单池仍保留已废弃的召回入口或占位');

    await page.goto(`http://127.0.0.1:${port}/?testRoute=my-approvals#my-approvals`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector(".approval-table");
    const approvalTransfer = page.locator('.approval-table [data-action="transfer-approval"]').first();
    assert(await approvalTransfer.count() === 1, "审批管理缺少转派操作样例");
    await approvalTransfer.click();
    await page.waitForSelector(".assignment-dialog");
    const approvalSummaryLabels = (await page.locator(".assignment-summary-grid dt").allInnerTexts()).map(text => text.trim());
    assert(["工单编号", "子单编号"].includes(approvalSummaryLabels[0]) && approvalSummaryLabels.slice(2).join("|") === "客户姓名|当前机构", "审批转派未复用业务单据只读字段");
    await page.locator('[data-close-overlay]').last().click();
    await page.locator('[data-approval-scope="下辖工单池"]').click();
    await page.waitForTimeout(100);
    await page.waitForSelector('.approval-table');
    assert(await page.locator('.approval-table [data-action="recall-transfer"], .approval-table [data-unavailable-action="recall-transfer"]').count() === 0, '审批下辖工单池仍保留已废弃的召回入口或占位');
    const openRolePage = async (role, org, profile, route = 'my-approvals') => {
      const rolePage = await browser.newPage({ viewport:{ width:1600, height:1000 } });
      rolePage.on('pageerror', error => errors.push(error.message));
      rolePage.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await rolePage.addInitScript(values => {
        localStorage.setItem('xib-role', values.role);
        localStorage.setItem('xib-org', values.org);
        localStorage.setItem('xib-role-profile', values.profile);
      }, { role, org, profile });
      await rolePage.goto(`http://127.0.0.1:${port}/?testRoute=${route}#${route}`, { waitUntil:'domcontentloaded' });
      await rolePage.waitForSelector('#page-root .page');
      return rolePage;
    };
    const approvalStatuses = rolePage => rolePage.locator('.approval-table tbody tr').evaluateAll(rows => rows.map(row => ['待复核','复核中','待处理','处理中','会签中','待初审','初审中','待审批','审批中'].find(status => row.innerText.includes(status))).filter(Boolean));
const reviewerPage = await openRolePage('reviewer', 'customer-service', 'customer-reviewer');
    await reviewerPage.locator('[data-approval-work-tab="全部"]').click(); await reviewerPage.waitForTimeout(100);
    const reviewerWorkbenchStatuses = await approvalStatuses(reviewerPage);
    assert(['待复核','复核中'].every(status => reviewerWorkbenchStatuses.includes(status)) && reviewerWorkbenchStatuses.every(status => ['待复核','复核中'].includes(status)), '复核员工作台状态矩阵不完整：' + reviewerWorkbenchStatuses.join('、'));
    const reviewerActions = await reviewerPage.locator('.approval-table button[data-action]').allInnerTexts();
    assert(reviewerActions.includes('复核') && reviewerActions.includes('转派') && reviewerActions.includes('查看'), '复核员工作台缺少复核、转派或查看样例');
    assert(!reviewerActions.some(action => ['处理','会签','审批'].includes(action.trim())), '复核员工作台出现越权处理、会签或审批操作');
    await reviewerPage.locator('[data-approval-scope="机构工单池"]').click(); await reviewerPage.waitForTimeout(100);
    assert((await approvalStatuses(reviewerPage)).every(status => ['待复核','复核中'].includes(status)), '复核员机构池出现非复核状态');
    await reviewerPage.locator('[data-approval-scope="下辖工单池"]').click(); await reviewerPage.waitForTimeout(100);
    assert((await approvalStatuses(reviewerPage)).length === 0, '复核员下辖工单池应为空');
    await reviewerPage.close();
const approverPage = await openRolePage('approver', 'branch-consumer', 'branch-consumer-approver');
    await approverPage.locator('[data-approval-work-tab="全部"]').click(); await approverPage.waitForTimeout(100);
    const approverWorkbenchStatuses = await approvalStatuses(approverPage);
    assert(['会签中','待初审','初审中','待审批','审批中'].every(status => approverWorkbenchStatuses.includes(status)) && approverWorkbenchStatuses.every(status => ['会签中','待初审','初审中','待审批','审批中'].includes(status)), '审批员工作台状态矩阵不完整：' + approverWorkbenchStatuses.join('、'));
    const approverWorkbenchActions = await approverPage.locator('.approval-table button[data-action]').allInnerTexts();
    assert(approverWorkbenchActions.includes('初审') && approverWorkbenchActions.includes('会签') && approverWorkbenchActions.includes('审批') && approverWorkbenchActions.includes('转派') && approverWorkbenchActions.includes('查看'), '审批员工作台缺少初审、会签、审批、转派或查看样例；实际：' + approverWorkbenchActions.join('、'));
    assert(!approverWorkbenchActions.some(action => ['处理','复核'].includes(action.trim())), '审批员工作台出现越权处理或复核操作');
    await approverPage.locator('[data-approval-scope="机构工单池"]').click(); await approverPage.waitForTimeout(100);
    const approverOrgStatuses = await approvalStatuses(approverPage);
    assert(['待处理','处理中'].every(status => approverOrgStatuses.includes(status)) && approverOrgStatuses.every(status => ['待处理','处理中','待初审','初审中','待审批','审批中'].includes(status)), '审批员机构池出现越权状态或缺少处理阶段样例：' + approverOrgStatuses.join('、'));
    const assertPoolViewReadOnly = async (scope, kind) => {
      await approverPage.locator(`[data-approval-scope="${scope}"]`).click(); await approverPage.waitForTimeout(100);
      await approverPage.locator(`[data-approval-pool-tab="${kind === 'ticket' ? '工单审批' : '子流程审批'}"]`).click(); await approverPage.waitForTimeout(100);
      const viewRow = approverPage.locator('.approval-table tbody tr').filter({ has:approverPage.getByRole('button', { name:'查看', exact:true }) }).first();
      assert(await viewRow.count() === 1, `${scope}${kind === 'ticket' ? '工单' : '子流程'}池缺少查看样例`);
      const viewId = (await viewRow.locator('.primary-cell').innerText()).trim();
      const viewStatus = await viewRow.locator('[data-flow-status]').first().getAttribute('data-flow-status');
      await viewRow.getByRole('button', { name:'查看', exact:true }).click();
      await approverPage.waitForSelector(kind === 'ticket' ? '.ticket-detail-page' : '.subprocess-detail-page');
      assert(await approverPage.locator('.approval-opinion-section, [data-action="submit-approval"]').count() === 0, `${scope}${kind === 'ticket' ? '工单' : '子流程'}点击查看错误进入领取/审批模式`);
      await approverPage.goBack();
      await approverPage.waitForSelector('.approval-table');
      const returnedRow = approverPage.locator('.approval-table tbody tr', { hasText:viewId });
      assert(await returnedRow.locator('[data-flow-status]').first().getAttribute('data-flow-status') === viewStatus, `${scope}${kind === 'ticket' ? '工单' : '子流程'}查看后改变了状态`);
    };
    await assertPoolViewReadOnly('机构工单池', 'ticket');
    await assertPoolViewReadOnly('机构工单池', 'subprocess');
    await assertPoolViewReadOnly('下辖工单池', 'ticket');
    await assertPoolViewReadOnly('下辖工单池', 'subprocess');
    await approverPage.locator('[data-approval-scope="下辖工单池"]').click(); await approverPage.waitForTimeout(100);
    const approverSubOrgStatuses = await approvalStatuses(approverPage);
    assert(approverSubOrgStatuses.length > 0 && approverSubOrgStatuses.every(status => ['待处理','处理中','待初审','初审中','待审批','审批中'].includes(status)), '审批员下辖池出现越权状态或缺少样例：' + approverSubOrgStatuses.join('、'));
    await approverPage.close();

    const inspectionApprovalPage = await openRolePage('approver', 'branch-consumer', 'branch-consumer-approver');
    await inspectionApprovalPage.locator('[data-approval-work-tab="全部"]').click();
    await inspectionApprovalPage.waitForTimeout(100);
    const inspectionApprovalRow = inspectionApprovalPage.locator('.approval-table tbody tr', { hasText:'BY202607220021' });
    assert(await inspectionApprovalRow.count() === 1, '审批管理缺少表扬单样例');
    await inspectionApprovalRow.locator('[data-action="approve"]').click();
    await inspectionApprovalPage.waitForSelector('.ticket-detail-page');
    await inspectionApprovalPage.locator('[data-detail-tab="处理信息"]').click();
    await inspectionApprovalPage.waitForSelector('.linked-subprocess-table [data-linked-subprocess-type]');
    const praiseApprovalSubprocessTypes = await inspectionApprovalPage.locator('.linked-subprocess-table [data-linked-subprocess-type]').evaluateAll(rows => [...new Set(rows.map(row => row.dataset.linkedSubprocessType))]);
    assert(JSON.stringify(praiseApprovalSubprocessTypes) === JSON.stringify(['废止申请']), '表扬单审批详情关联子流程未限定为废止申请：' + praiseApprovalSubprocessTypes.join('、'));
    assert(await inspectionApprovalPage.locator('#section-risk-summary').count() === 0, '表扬单审批详情不应展示风险提示');
    assert(await inspectionApprovalPage.locator('#section-intelligent-inspection').count() === 0, '表扬单审批详情不应展示智能核查');
    const approvalAnchors = (await inspectionApprovalPage.locator('.form-anchor .anchor-link').allInnerTexts()).map(text => text.trim());
    assert(!approvalAnchors.includes('风险提示') && !approvalAnchors.includes('智能核查'), '表扬单审批详情导航仍显示风险提示或智能核查');
    await inspectionApprovalPage.close();

    const actionLabels = async (rolePage, tableSelector) => (await rolePage.locator(tableSelector + ' button[data-action]').allInnerTexts()).map(text => text.trim());
    const tableStatuses = async (rolePage, tableSelector) => rolePage.locator(tableSelector + ' tbody tr').evaluateAll(rows => rows.map(row => row.querySelector('[data-flow-status]')?.dataset.flowStatus || '').filter(Boolean));
    const includesAll = (actual, expected) => expected.every(value => actual.includes(value));

    const operatorTicketPage = await openRolePage('operator', 'development', 'development-operator', 'ticket-create');
    assert((await operatorTicketPage.locator('.top-role-control').innerText()).includes('经办员视图'), '开发测试经办员视角未生效');
    let labels = await actionLabels(operatorTicketPage, '.ticket-list-table');
    assert(includesAll(labels, ['催办','撤回','查看']) && !labels.some(label => ['处理','复核','审批','会签'].includes(label)), '经办员工单创建操作样例或权限不正确');
    await operatorTicketPage.locator('[data-create-tab="自动带入草稿箱"]').click(); await operatorTicketPage.waitForTimeout(100);
    labels = await actionLabels(operatorTicketPage, '.ticket-list-table');
    assert(includesAll(labels, ['编辑','删除']), '经办员草稿箱缺少编辑或删除样例');
    await operatorTicketPage.close();

    const operatorSubprocessPage = await openRolePage('operator', 'development', 'development-operator', 'subprocess-create');
    await operatorSubprocessPage.locator('[data-pagination-size]').selectOption('50'); await operatorSubprocessPage.waitForTimeout(100);
    const operatorSubprocessStatuses = await tableStatuses(operatorSubprocessPage, '.subprocess-list-table');
    labels = await actionLabels(operatorSubprocessPage, '.subprocess-list-table');
    assert(includesAll(operatorSubprocessStatuses, ['草稿','待提交','待复核','复核中','待处理','处理中','待初审','初审中','待审批','审批中']), '经办员子单创建未覆盖全部有权限状态样例：' + operatorSubprocessStatuses.join('、'));
    assert(includesAll(labels, ['编辑','删除','废止','撤回','催办','查看']), '经办员子单创建缺少操作样例');
    await operatorSubprocessPage.close();

    const operatorRectificationPage = await openRolePage('operator', 'development', 'development-operator', 'rectification-create');
    labels = await actionLabels(operatorRectificationPage, '.rectification-table');
    assert(includesAll(labels, ['编辑','删除','废止','查看']) && !labels.includes('提交'), '经办员整改创建操作样例不完整或仍出现提交');
    await operatorRectificationPage.close();

    const handlerTicketPage = await openRolePage('handler', 'development', 'development-handler', 'ticket-process');
    assert((await handlerTicketPage.locator('.top-role-control').innerText()).includes('处理员视图'), '开发测试处理员视角未生效');
    await handlerTicketPage.locator('[data-process-tab="全部"]').click(); await handlerTicketPage.waitForTimeout(100);
    let statuses = await tableStatuses(handlerTicketPage, '.ticket-list-table');
    labels = await actionLabels(handlerTicketPage, '.ticket-list-table');
    assert(includesAll(statuses, ['处理中']) && !statuses.includes('待补录') && includesAll(labels, ['处理','转派','查看']) && !labels.includes('补录'), '处理员工单工作台状态或操作样例不符合主单状态机；状态：' + statuses.join('、') + '；操作：' + labels.join('、'));
    await handlerTicketPage.locator('[data-scope="机构工单池"]').click(); await handlerTicketPage.waitForTimeout(100);
    statuses = await tableStatuses(handlerTicketPage, '.ticket-list-table');
    labels = await actionLabels(handlerTicketPage, '.ticket-list-table');
    assert(statuses.includes('待处理') && includesAll(labels, ['处理','转派','查看']), '处理员工单机构池缺少待处理或处理操作样例');
    await handlerTicketPage.locator('[data-scope="下辖工单池"]').click(); await handlerTicketPage.waitForTimeout(100);
    labels = await actionLabels(handlerTicketPage, '.ticket-list-table');
    assert(includesAll(labels, ['催办','查看']) && !labels.includes('召回') && await handlerTicketPage.locator('.ticket-list-table [data-action="recall-transfer"], .ticket-list-table [data-unavailable-action="recall-transfer"]').count() === 0, '处理员工单下辖池操作不符合无召回规则');
    await handlerTicketPage.close();

    const handlerSubprocessPage = await openRolePage('handler', 'development', 'development-handler', 'subprocess-manage');
    await handlerSubprocessPage.locator('[data-subprocess-tab="全部"]').click(); await handlerSubprocessPage.waitForTimeout(100);
    statuses = await tableStatuses(handlerSubprocessPage, '.subprocess-list-table');
    labels = await actionLabels(handlerSubprocessPage, '.subprocess-list-table');
    assert(includesAll(statuses, ['处理中','待补录']) && includesAll(labels, ['处理','补录','转派','查看']), '处理员子单工作台缺少状态或操作样例');
    await handlerSubprocessPage.locator('[data-subprocess-scope="机构工单池"]').click(); await handlerSubprocessPage.waitForTimeout(100);
    labels = await actionLabels(handlerSubprocessPage, '.subprocess-list-table');
    assert(includesAll(labels, ['处理','转派','查看']), '处理员子单机构池缺少处理、转派或查看样例');
    await handlerSubprocessPage.locator('[data-subprocess-scope="下辖工单池"]').click(); await handlerSubprocessPage.waitForTimeout(100);
    labels = await actionLabels(handlerSubprocessPage, '.subprocess-list-table');
    assert(includesAll(labels, ['催办','查看']) && !labels.includes('召回'), '处理员子单下辖池操作不符合无召回规则');
    await handlerSubprocessPage.close();

    const handlerRectificationPage = await openRolePage('handler', 'development', 'development-handler', 'rectification-process');
    statuses = await tableStatuses(handlerRectificationPage, '.rectification-table');
    labels = await actionLabels(handlerRectificationPage, '.rectification-table');
    assert(includesAll(statuses, ['方案待提交','整改中']) && includesAll(labels, ['处理','查看']) && !labels.includes('转派'), '处理员整改处理状态、操作或禁转派规则异常；状态：' + statuses.join('、') + '；操作：' + labels.join('、'));
    await handlerRectificationPage.close();

    const approverRectificationPage = await openRolePage('approver', 'development', 'development-approver', 'rectification-approve');
    assert((await approverRectificationPage.locator('.top-role-control').innerText()).includes('审批员视图'), '开发测试审批员视角未生效');
    statuses = await tableStatuses(approverRectificationPage, '.rectification-table');
    labels = await actionLabels(approverRectificationPage, '.rectification-table');
    assert(includesAll(statuses, ['问题待审核','方案待初审','方案待审批','结果待初审','结果待审批']) && includesAll(labels, ['审批','查看']), '审批员整改审批缺少状态或操作样例');
    await approverRectificationPage.close();

    const ownershipContext = await browser.newContext({ viewport:{ width:1600, height:1000 } });
    await ownershipContext.addInitScript(() => {
      localStorage.setItem("xib-role", "developer");
      localStorage.setItem("xib-org", "development");
      localStorage.setItem("xib-role-profile", "development-developer");
    });
    const ownershipPage = await ownershipContext.newPage();
    ownershipPage.on('pageerror', error => errors.push(error.message));
    ownershipPage.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await ownershipPage.goto(`http://127.0.0.1:${port}/?testRoute=ticket-process#ticket-process`, { waitUntil:"domcontentloaded" });
    await ownershipPage.waitForSelector(".ticket-list-table");
    await ownershipPage.locator('.ticket-list-table tr', { hasText:"TS202607230012" }).locator('[data-action="transfer"]').click();
    await ownershipPage.waitForSelector(".assignment-dialog");
    await selectInstitution(ownershipPage.locator('[data-app-hierarchy-cascader][data-field-key="assignment-org"]'), "厦门分行", "厦门湖里支行");
    await ownershipPage.locator("#assignment-reason").fill("转派支行继续处理");
    await ownershipPage.getByRole("button", { name:"确认转派", exact:true }).click();
    await ownershipPage.waitForSelector(".assignment-dialog", { state:"detached" });
    await ownershipPage.goto(`http://127.0.0.1:${port}/?testRoute=ticket-detail#ticket-detail`, { waitUntil:"domcontentloaded" });
    await ownershipPage.locator('[data-detail-tab="处理信息"]').click();
    await ownershipPage.waitForSelector("#section-processing-meta");
    // 处理归属现在集中展示在工单顶部摘要中。
    const processingMeta = await ownershipPage.locator(".ticket-detail-summary > div").evaluateAll(items => Object.fromEntries(items.map(item => [item.querySelector("span")?.textContent.trim(), item.querySelector("strong")?.textContent.trim()])));
    assert("处理员" in processingMeta && "工单接收部门" in processingMeta, "工单摘要未保留单值处理归属字段");
    assert(!Object.keys(processingMeta).some(label => /处理员[12]|工单接收部门[12]/.test(label)), "工单摘要仍显示带序号的处理归属字段");
    assert(processingMeta["工单接收部门"] === "-", "工单接收机构为支行时工单接收部门未显示短横线");
    assert(processingMeta["处理员"] && processingMeta["处理员"] !== "-", "工单摘要未记录最后一个处理员");
    await ownershipContext.close();

    await page.locator('#role-cascade-trigger').click();
    await page.locator('[data-role-profile="development-handler"]').click();
    await page.waitForTimeout(100);
    assert(await page.evaluate(() => localStorage.getItem('xib-role')) === 'handler', '顶部开发测试处理员视角未切换为真实 handler 权限');
    assert(errors.length === 0, `浏览器错误：${errors.join(" | ")}`);
    console.log(JSON.stringify({ ok:true, checks:["智能派发机构部门联动", "工单接收机构", "事件处理信息末次归属", "支行接收部门留空", "转派弹窗", "处理补录同列", "待处理池归属", "不可用操作占位", "审批角色矩阵", "开发视角真实权限切换", "经办复核处理审批状态与操作样例", "溯源整改不可转派"], browserErrors:errors }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exit(1);
});
