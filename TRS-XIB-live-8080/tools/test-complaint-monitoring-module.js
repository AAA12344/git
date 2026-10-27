"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
let ticketListener;
const persistedStorage = new Map();
const storageStub = {
  getItem: key => persistedStorage.has(key) ? persistedStorage.get(key) : null,
  setItem: (key, value) => persistedStorage.set(key, String(value)),
  removeItem: key => persistedStorage.delete(key)
};
/* 列表勾选状态：批量导出只认浏览器里真正被勾选的行，测试用 selectionState 模拟勾选。 */
const selectionState = { checked: [] };
const documentStub = {
  querySelectorAll: selector => {
    const text = String(selector);
    if (text.includes("data-row-select") && text.includes(":checked")) return selectionState.checked;
    return [{ dataset: { monitoringTicket: "TS202607230012" }, addEventListener: (name, listener) => { if (name === "click") ticketListener = listener; } }];
  },
  getElementById: () => ({ value: "retail-owner", innerHTML: "" })
};
const sandbox = { window: { document: documentStub, localStorage: storageStub, sessionStorage: storageStub }, document: documentStub };
vm.createContext(sandbox);
const run = relativePath => vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), sandbox, { filename: relativePath });

run("src/core/module-registry.js");
run("src/core/alert-rule-config.js");
run("src/modules/complaints/monitoring/data.js");
run("src/modules/complaints/monitoring/index.js");

const data = sandbox.window.XIB_COMPLAINT_MONITORING_DATA;
const alertRuleConfig = sandbox.window.XIB_ALERT_RULE_CONFIG;
assert.equal(data.warningRows.length, 8);
assert.equal(Object.isFrozen(data.warningRows), true);
assert.equal(data.warningContexts.YJ20260104006.ticketIds.length, 2);

// 预警摘要必须由「预警规则配置」的模板 + 命中数值生成，不能在监控模块里另存一份文案。
data.warningTriggers.forEach(trigger => {
  const matched = alertRuleConfig.ruleByScene(trigger.scene);
  assert.ok(matched, "预警场景未在规则配置中登记：" + trigger.scene);
  const expected = alertRuleConfig.renderSummary(matched.rule.summary, { ...trigger.values, "日期": String(trigger.generatedAt).split(" ")[0] });
  const row = data.warningRows.find(item => item[0] === trigger.id);
  assert.equal(row[2], expected, "预警摘要未按规则配置生成：" + trigger.id);
  assert.doesNotMatch(row[2], /\{[^{}]+\}/, "预警摘要仍残留未替换占位符：" + trigger.id);
});

const registry = sandbox.window.XIBModuleRegistry;
let rerenders = 0;
let modal;
let openedTicket;
let overlayClosed = false;
let navigatedPage;
let filterGroups = null;
let modalCalls = 0;
let modalOptions;
const toasts = [];
const context = {
  pageHeader: (title, subtitle, actions = "") => `<header><h1>${title}</h1><p>${subtitle}</p>${actions}</header>`,
  renderFilters: () => '<div class="filter-panel ticket-filter-panel"></div>',
  renderGroupedFilters: rows => { filterGroups = rows; return '<div class="filter-panel ticket-filter-panel grouped-filter-panel"></div>'; },
  renderPagination: count => `<footer data-count="${count}"></footer>`,
  renderHierarchyCascaderControl: (id, field, key) => `<div data-app-hierarchy-cascader data-field-key="${key}"></div>`,
  getBusinessLineOptions: () => ["零售金融部", "普惠金融部", "公司金融部", "消费者权益保护部", "运营管理部", "风险管理部"],
  state: { formValues: {} },
  statusTag: text => `<mark>${text}</mark>`,
  rerenderPage: () => { rerenders += 1; },
  openModal: (title, content, confirmLabel, onConfirm, options) => { modalCalls += 1; modalOptions = options; modal = { title, content, confirmLabel, onConfirm }; },
  closeOverlay: () => { overlayClosed = true; },
  openTicketDetail: (id, options) => { openedTicket = { id, options }; },
  navigate: page => { navigatedPage = page; },
  currentUser: () => "陈敏慧-60157",
  systemTimestamp: () => "2026-07-17 11:20:00",
  toast: (message, isError) => { toasts.push({ message, isError: Boolean(isError) }); }
};

assert.match(registry.render("analysis-monitor", context), /data-module="complaint-monitoring"/);
const warnings = registry.render("analysis-warnings", context);
assert.match(warnings, /data-count="53"/);
assert.equal((warnings.match(/monitoring-warning-detail/g) || []).length, 8);
assert.equal((warnings.match(/monitoring-warning-copy/g) || []).length, 8);
assert.match(warnings, /monitoring-warning-copy/);

// 智能预警的归属字段统一叫「预警机构 / 预警部门」，列表与筛选项都不再出现「所属机构 / 所属部门」。
const orgFilters = filterGroups?.[1] || [];
assert.deepEqual(JSON.parse(JSON.stringify(orgFilters.map(field => field.label))), ["预警机构", "预警部门", "所属业务条线"]);
assert.deepEqual(JSON.parse(JSON.stringify(orgFilters.map(field => field.key))), ["filter.monitoring.institution", "filter.monitoring.department", "filter.monitoring.business-lines"]);
assert.match(warnings, /<th>预警机构<\/th><th>预警部门<\/th>/);
assert.doesNotMatch(warnings, /所属机构|所属部门/);

// 预警单列表新增「所属业务条线」列，取值来自工单表单的业务条线字典。
assert.match(warnings, /<th>所属业务条线<\/th>/);
assert.deepEqual(
  JSON.parse(JSON.stringify(data.warningRows.map(row => row[5]))),
  ["零售金融部", "消费者权益保护部", "零售金融部", "普惠金融部", "运营管理部", "零售金融部", "消费者权益保护部", "风险管理部"]
);

// 预警机构只有「带量」场景才有；预警部门只有「双一级标签」（产品类 / 原因类）场景才有。
// 维度判定写在规则配置里，数据层按维度落库、前台按维度渲染，不在 UI 里硬编码场景名。
const sceneDimensions = alertRuleConfig.sceneDimensions;
const warningById = new Map(data.warningRows.map(row => [row[0], row]));
const orgOf = id => warningById.get(id)[3];
const deptOf = id => warningById.get(id)[4];
["YJ20260104001", "YJ20260104002", "YJ20260104003", "YJ20260104004", "YJ20260104005"]
  .forEach(id => assert.ok(orgOf(id), id + " 属于带量场景，必须有预警机构"));
["YJ20260104006", "YJ20260104007", "YJ20260104008"]
  .forEach(id => assert.equal(orgOf(id), "", id + " 不是带量场景，不应有预警机构"));
["YJ20260104004", "YJ20260104005"]
  .forEach(id => assert.ok(deptOf(id), id + " 属于双一级标签场景，必须有预警部门"));
["YJ20260104001", "YJ20260104002", "YJ20260104003", "YJ20260104006", "YJ20260104007", "YJ20260104008"]
  .forEach(id => assert.equal(deptOf(id), "", id + " 不是双一级标签场景，不应有预警部门"));
assert.deepEqual(JSON.parse(JSON.stringify(sceneDimensions("全量投诉量异常"))), { org: true, dept: false });
assert.deepEqual(JSON.parse(JSON.stringify(sceneDimensions("一级原因投诉量异常"))), { org: true, dept: true });
assert.deepEqual(JSON.parse(JSON.stringify(sceneDimensions("升级投诉"))), { org: false, dept: false });
assert.deepEqual(JSON.parse(JSON.stringify(sceneDimensions("未登记的场景"))), { org: false, dept: false });
// 不适用维度在列表里统一落 "-"，不会出现空单元格或"机构为空但部门有值"的自相矛盾。
assert.match(warnings, /<td>北京西直门支行<\/td><td>-<\/td><td>零售金融部<\/td>/);
assert.match(warnings, /<td>厦门分行<\/td><td>厦门分行零售金融部<\/td><td>普惠金融部<\/td>/);
assert.match(warnings, /<td>-<\/td><td>-<\/td><td>消费者权益保护部<\/td>/);

// 摘要高亮「有业务意义的数值型指标」，一级产品/原因场景还高亮对应的标签值；
// 机构、客户、工单编号、渠道、等级、日期等定位信息与系统字段保持正文色；
// 去标签后必须与纯文本摘要逐字一致。
const stripTags = html => String(html).replace(/<[^>]*>/g, "");
const marksOf = id => [...String(data.warningSummaryMarkup(id)).matchAll(/<mark class="alert-summary-highlight">([^<]*)<\/mark>/g)].map(match => match[1]);
// 锚点：全量投诉量异常只高亮【时间范围】【当前值】【环比1】【环比2】；
// 高发投诉客户高亮【时间范围】【数值】【投诉次数阈值】；
// 升级投诉 / 高风险客户的摘要里没有数值型指标，整体不高亮。
assert.deepEqual(JSON.parse(JSON.stringify(marksOf("YJ20260104001"))), ["14天", "86", "26.5", "22.1"]);
assert.deepEqual(JSON.parse(JSON.stringify(marksOf("YJ20260104004"))), ["合作类贷款", "14天", "45", "33", "36.4", "29.7"]);
assert.deepEqual(JSON.parse(JSON.stringify(marksOf("YJ20260104005"))), ["管理制度、业务规则与流程类", "14天", "58", "41", "24.9", "19.4"]);
assert.deepEqual(JSON.parse(JSON.stringify(marksOf("YJ20260104007"))), ["30", "4", "3"]);
assert.deepEqual(JSON.parse(JSON.stringify(marksOf("YJ20260104006"))), []);
assert.deepEqual(JSON.parse(JSON.stringify(marksOf("YJ20260104008"))), []);
assert.match(warnings, /<mark class="alert-summary-highlight">14天<\/mark>/);
assert.match(warnings, /<mark class="alert-summary-highlight">86<\/mark>/);
// 日期、机构名称、客户、工单编号、渠道等不高亮；产品/原因标签按对应场景高亮
assert.doesNotMatch(warnings, /<mark class="alert-summary-highlight">2026-07-17<\/mark>/);
assert.doesNotMatch(warnings, /<mark class="alert-summary-highlight">北京西直门支行<\/mark>/);
assert.match(warnings, /<mark class="alert-summary-highlight">合作类贷款<\/mark>/);
assert.match(warnings, /<mark class="alert-summary-highlight">管理制度、业务规则与流程类<\/mark>/);
assert.doesNotMatch(warnings, /<mark class="alert-summary-highlight">TS202607230012<\/mark>/);
assert.doesNotMatch(warnings, /<mark class="alert-summary-highlight">【/);
// 高亮集合必须与规则配置声明的核心命中信息一致，不能另写一份清单
data.warningTriggers.forEach(trigger => {
  const matched = alertRuleConfig.ruleByScene(trigger.scene);
  const keys = alertRuleConfig.highlightSummaryKeys(matched.rule);
  const values = { ...trigger.values, "日期": String(trigger.generatedAt).split(" ")[0] };
  assert.deepEqual(
    JSON.parse(JSON.stringify(marksOf(trigger.id))),
    JSON.parse(JSON.stringify(keys.map(key => String(values[key])))),
    "高亮范围与规则配置的核心命中信息不一致：" + trigger.id
  );
});
const strippedWarnings = stripTags(warnings);
data.warningRows.forEach(row => assert.ok(strippedWarnings.includes(row[2]), "高亮版摘要与纯文本摘要不一致：" + row[0]));

// 高亮渲染必须转义，不能把数据里的尖括号注入页面；不传 highlightKeys 时高亮全部代入值。
assert.equal(
  alertRuleConfig.renderSummaryMarkup("A{值}B", { "值": '<img src=x onerror="1">' }),
  'A<mark class="alert-summary-highlight">&lt;img src=x onerror=&quot;1&quot;&gt;</mark>B'
);
assert.equal(alertRuleConfig.renderSummaryMarkup("A{值}B", { "值": "1" }, { highlightKeys: [] }), "A1B");
assert.deepEqual(
  JSON.parse(JSON.stringify(alertRuleConfig.highlightSummaryKeys(alertRuleConfig.ruleByScene("全量投诉量异常").rule))),
  ["时间范围", "当前值", "环比1", "环比2"]
);

registry.afterRender({ querySelector: () => null, querySelectorAll: () => [] }, "analysis-warnings", context);
assert.doesNotMatch(warnings, /data-monitoring-sort-index/);

assert.equal(registry.handleAction("monitoring-warning-detail", { id: "YJ20260104006" }, { ...context, page: "analysis-warnings" }), true);
assert.equal(navigatedPage, "analysis-warning-detail");
let detailHtml = registry.render("analysis-warning-detail", context);
assert.match(detailHtml, /data-warning-detail-id="YJ20260104006"/);
assert.match(detailHtml, /返回智能预警/);
assert.match(detailHtml, /<dt>客户姓名<\/dt><dd>陈晓敏<\/dd>/);
assert.match(detailHtml, /<dt>客户编号<\/dt><dd>C202407180036<\/dd>/);
assert.doesNotMatch(detailHtml, /关联客户/);
assert.match(detailHtml, /TS202607230012/);
assert.doesNotMatch(detailHtml, /点击工单编号进入详情，并保留本预警内容上下文/);
assert.match(detailHtml, /<th>投诉渠道<\/th><th>投诉产品标签<\/th><th>投诉原因标签<\/th><th>工单创建机构<\/th>/);
assert.doesNotMatch(detailHtml, /<th>操作<\/th>|>查看<\/button>/);
assert.match(detailHtml, /data-disable-column-customizer/);
assert.match(detailHtml, /在线客服/);
assert.match(detailHtml, /<span class="ds-tag">贷款业务 \/ 个人贷款 \/ 合作类贷款<\/span>/);
assert.match(detailHtml, /<span class="ds-tag">服务类 \/ 客服服务 \/ 服务效率<\/span>/);
assert.doesNotMatch(detailHtml, /投诉事项|当前机构/);
// 详情页的归属字段与列表同口径。
assert.match(detailHtml, /<dt>预警机构<\/dt>/);
assert.match(detailHtml, /<dt>预警部门<\/dt>/);
assert.doesNotMatch(detailHtml, /所属机构|所属部门/);
// 摘要不追加系统说明，监测口径及其他规则说明全部删除。
assert.doesNotMatch(detailHtml, /系统按当前统计周期、历史均值与预警阈值自动识别|监测口径|预警规则|数据来源|判断规则|推送逻辑|计算口径/);
assert.match(detailHtml, /<h4>预警摘要<\/h4><p>/);
// 升级投诉没有「后台管理可修改的参数」，摘要整体不高亮
assert.doesNotMatch(detailHtml, /alert-summary-highlight/);
assert.equal(registry.handleAction("monitoring-ticket-open", { id: "TS202607230012" }, { ...context, page: "analysis-warning-detail" }), true);
assert.equal(openedTicket.id, "TS202607230012");
assert.equal(openedTicket.options.warningContextId, "YJ20260104006");
assert.doesNotMatch(detailHtml, /刘女士|TS202607180026/);
assert.ok((detailHtml.match(/data-action="monitoring-ticket-open"/g) || []).length >= 2, "升级投诉至少关联两笔同客户工单");
assert.match(detailHtml, /TS202501100201/);

// 三类汇总预警不展示整个「关联投诉工单」模块，即使演示上下文中存在工单数据。
["YJ20260104001", "YJ20260104002", "YJ20260104003"].forEach(id => {
  assert.equal(registry.handleAction("monitoring-warning-detail", { id }, { ...context, page: "analysis-warnings" }), true);
  detailHtml = registry.render("analysis-warning-detail", context);
  assert.doesNotMatch(detailHtml, /关联投诉工单|monitoring-ticket-open/);
});

// 高发投诉客户的详情摘要只高亮数值型指标：时间范围 30、投诉次数 4、阈值 3
assert.equal(registry.handleAction("monitoring-warning-detail", { id: "YJ20260104007" }, { ...context, page: "analysis-warnings" }), true);
detailHtml = registry.render("analysis-warning-detail", context);
assert.match(detailHtml, /<mark class="alert-summary-highlight">30<\/mark>/);
assert.match(detailHtml, /<mark class="alert-summary-highlight">4<\/mark>/);
assert.match(detailHtml, /<mark class="alert-summary-highlight">3<\/mark>/);
assert.doesNotMatch(detailHtml, /<mark class="alert-summary-highlight">陈晓敏（C202407180036）<\/mark>/);
assert.doesNotMatch(detailHtml, /刘女士|TS202607180026|监测口径/);
assert.ok((detailHtml.match(/data-action="monitoring-ticket-open"/g) || []).length >= 2, "高发投诉客户至少关联两笔同客户工单");
assert.match(detailHtml, /TS202501100201/);

// 高风险客户仅展示该客户的一张关联投诉工单。
assert.equal(registry.handleAction("monitoring-warning-detail", { id: "YJ20260104008" }, { ...context, page: "analysis-warnings" }), true);
detailHtml = registry.render("analysis-warning-detail", context);
assert.equal((detailHtml.match(/<tbody><tr>/g) || []).length, 1);
assert.match(detailHtml, /刘女士|TS202607180026/);
assert.doesNotMatch(detailHtml, /陈晓敏|TS202607230012/);


assert.equal(registry.handleAction("monitoring-warning-copy", { id: "YJ20260104006" }, { ...context, page: "analysis-warnings" }), true);
assert.equal(modal.title, "抄送预警");
assert.match(modal.content, /抄送人/);
assert.match(modal.content, /monitoring-copy-person-picker/);
assert.doesNotMatch(modal.content, /抄送机构/);

// 详情页与列表同口径：预警机构 / 预警部门 / 所属业务条线三列都在。
assert.equal(registry.handleAction("monitoring-warning-detail", { id: "YJ20260104004" }, { ...context, page: "analysis-warnings" }), true);
detailHtml = registry.render("analysis-warning-detail", context);
assert.match(detailHtml, /<dt>所属业务条线<\/dt><dd>普惠金融部<\/dd>/);
assert.match(detailHtml, /<dt>预警部门<\/dt><dd>厦门分行零售金融部<\/dd>/);
assert.match(detailHtml, /<th>投诉原因标签<\/th><th>所属业务条线<\/th><th>工单创建机构<\/th>/);
assert.match(detailHtml, /<td>零售金融部<\/td>/);
assert.equal(registry.handleAction("monitoring-warning-detail", { id: "YJ20260104007" }, { ...context, page: "analysis-warnings" }), true);
detailHtml = registry.render("analysis-warning-detail", context);
assert.match(detailHtml, /<dt>预警机构<\/dt><dd>-<\/dd><\/div><div><dt>预警部门<\/dt><dd>-<\/dd>/);

// 抄送确认后要把动作登记进「被抄送」，不能只弹一句提示。
const ccBefore = data.warningCcRows.length;
assert.equal(registry.handleAction("monitoring-warning-copy", { id: "YJ20260104006" }, { ...context, page: "analysis-warnings" }), true);
context.state.formValues["monitoring.copy.YJ20260104006.person"] = ["厦门分行 / 零售金融部 / 林海-38102"];
modal.onConfirm();
assert.equal(data.warningCcRows.length, ccBefore + 1);
const appendedCc = data.warningCcRows[data.warningCcRows.length - 1];
assert.equal(appendedCc[1], "YJ20260104006");
assert.equal(appendedCc[2], "升级投诉");
// 被抄送行的摘要 / 机构 / 部门 / 条线全部回落到对应预警单，不另存一份口径。
assert.equal(appendedCc[3], warningById.get("YJ20260104006")[2]);
assert.equal(appendedCc[4], "");
assert.equal(appendedCc[6], "零售金融部");
assert.equal(appendedCc[7], "林海-38102");
assert.equal(appendedCc[8], "2026-07-17 11:20:00");
assert.equal(appendedCc[9], "未读");
assert.match(persistedStorage.get("xib-monitoring-warning-cc-entries") || "", /林海-38102/);
assert.match(toasts.at(-1).message, /YJ20260104006 已抄送给/);

// 重新加载数据模块后，新增的抄送记录仍应从本地存储恢复。
const reloadSandbox = { window: { localStorage: storageStub } };
vm.createContext(reloadSandbox);
const reloadRun = relativePath => vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), reloadSandbox, { filename: relativePath });
reloadRun("src/core/alert-rule-config.js");
reloadRun("src/modules/complaints/monitoring/data.js");
assert.ok(reloadSandbox.window.XIB_COMPLAINT_MONITORING_DATA.warningCcRows.some(row => row[7] === "林海-38102"));

// 双 tab：预警单 / 抄送单。页签及列表标题不展示数量；切到「抄送单」后列结构变为抄送视角。
assert.match(warnings, />预警单<\/button>/);
assert.match(warnings, />抄送单<\/button>/);
assert.doesNotMatch(warnings, /class="count"|预警单列表\s*<span>/);
assert.equal(registry.handleAction("monitoring-tab", { id: "cc" }, { ...context, page: "analysis-warnings" }), true);
const ccView = registry.render("analysis-warnings", context);
assert.match(ccView, /class="tab is-active" data-action="monitoring-tab" data-id="cc"/);
assert.match(ccView, /抄送单列表/);
assert.match(ccView, /<th>抄送人<\/th><th>抄送时间<\/th><th>抄送状态<\/th>/);
assert.match(ccView, /<th>所属业务条线<\/th>/);
assert.doesNotMatch(ccView, /monitoring-warning-copy/);
const ccCount = data.warningCcRows.length;
assert.equal((ccView.match(/data-row-select="/g) || []).length, ccCount);
assert.equal((ccView.match(/data-action="monitoring-warning-detail"/g) || []).length, ccCount * 2);
assert.ok(ccView.includes('data-count="' + ccCount + '"'));
assert.match(ccView, /CC202607170001/);
assert.match(ccView, /林海-38102/);
assert.equal(registry.handleAction("monitoring-tab", { id: "warnings" }, { ...context, page: "analysis-warnings" }), true);
assert.match(registry.render("analysis-warnings", context), /预警单列表/);

// 无详情编号或编号失效时不得静默展示第一笔预警。
assert.equal(registry.handleAction("monitoring-warning-detail", { id: "UNKNOWN" }, { ...context, page: "analysis-warnings" }), true);
detailHtml = registry.render("analysis-warning-detail", context);
assert.match(detailHtml, /未找到对应的预警记录/);
assert.doesNotMatch(detailHtml, /data-warning-detail-id="YJ20260104001"/);

// 单条导出位于操作列；批量导出复用查询导出的表格批量栏，并与操作列对齐。
assert.equal((warnings.match(/data-action="monitoring-export-row"/g) || []).length, 8);
assert.match(warnings, /class="table-bulk-toolbar" data-bulk-toolbar="analysis-warnings" data-module-bulk="true"/);
assert.match(warnings, /class="table-bulk-slot"[\s\S]*data-action="monitoring-export-selected"[\s\S]*disabled>批量导出/);
assert.match(warnings, /<div class="analysis-result-heading"><h1>预警单列表<\/h1><\/div>/);
assert.doesNotMatch(warnings, /export-analysis/);
const modalCallsBeforeExport = modalCalls;
toasts.length = 0;
selectionState.checked = [];
assert.equal(registry.handleAction("monitoring-export-row", { id: "YJ20260104001", tab: "warnings" }, { ...context, page: "analysis-warnings" }), true);
assert.match(toasts.at(-1).message, /已导出预警单 YJ20260104001/);
assert.doesNotMatch(toasts.at(-1).message, /导出无需审批/);
assert.equal(registry.handleAction("monitoring-export-row", { id: "CC202607170001", tab: "cc" }, { ...context, page: "analysis-warnings" }), true);
assert.match(toasts.at(-1).message, /已导出抄送单 CC202607170001/);
assert.equal(registry.handleAction("monitoring-export-selected", { id: "warnings" }, { ...context, page: "analysis-warnings" }), true);
assert.equal(toasts.at(-1).isError, true);
selectionState.checked = [{ value: "YJ20260104001" }, { value: "YJ20260104003" }];
assert.equal(registry.handleAction("monitoring-export-selected", { id: "warnings" }, { ...context, page: "analysis-warnings" }), true);
assert.match(toasts.at(-1).message, /已导出所选 2 条预警单/);
assert.equal(registry.handleAction("monitoring-export-selected", { id: "cc" }, { ...context, page: "analysis-warnings" }), true);
assert.match(toasts.at(-1).message, /已导出所选 2 条抄送单/);
assert.equal(modalCalls, modalCallsBeforeExport, "导出不应弹出任何审批或确认弹窗");

// 模块自管的批量工具栏必须带 data-module-bulk，否则会被宿主的列表清理逻辑当成无效入口移除。
assert.match(fs.readFileSync(path.join(root, "app.js"), "utf8"), /hasAttribute\("data-module-bulk"\)/);
assert.equal(registry.handleAction("monitoring-unknown-action", {}, { ...context, page: "analysis-warnings" }), false);

console.log("Complaint monitoring module checks passed.");
