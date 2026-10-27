"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const stored = new Map();
const sandbox = {
  window: {},
  sessionStorage: {
    getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, String(value))
  }
};
vm.createContext(sandbox);
const run = relativePath => vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), sandbox, { filename:relativePath });

run("src/core/module-registry.js");
run("src/modules/complaints/reports/data.js");
run("src/modules/complaints/reports/index.js");

const data = sandbox.window.XIB_COMPLAINT_REPORTS_DATA;
assert.equal(data.groups.length, 2);
assert.equal(data.groups[0].title, "监管报表");
assert.equal(data.groups[0].items.length, 4);
assert.equal(data.groups[1].title, "行内报表");
assert.equal(data.groups[1].items.length, 21);
assert.equal(data.reports.length, 25);
assert.equal(data.reports.filter(report => report.type === "统计").length, 17);
assert.equal(data.reports.filter(report => report.type === "明细").length, 8);
assert.equal(Object.isFrozen(data.groups), true);
assert.equal(Object.isFrozen(data.reports), true);
assert.deepEqual(
  Array.from(data.groups[0].items, report => report.name),
  ["银行业金融机构金融消费者投诉分类统计表", "厦门法人银行异地分支机构信访投诉情况表", "自然人-银行业金融机构金融消费者投诉分类统计表", "非自然人-银行业金融机构金融消费者投诉分类统计表"]
);

const customerBehavior = data.reports.find(report => report.id === "customer-behavior");
assert(customerBehavior);
assert.deepEqual(Array.from(customerBehavior.filters, item => item.label), ["时间范围", "工单类型", "客户编号", "客户姓名", "投诉产品标签", "投诉原因标签", "投诉笔数"]);
assert.equal(customerBehavior.filters.at(-1).control, "range");
assert.equal(data.reports.find(report => report.id === "rectification-detail").type, "明细");
assert.equal(data.reports.find(report => report.id === "processing-status-detail").filters.at(-1).label, "剔除规则");

const registry = sandbox.window.XIBModuleRegistry;
let navigated = "";
let toast = "";
let openedTicket = "";
let rerendered = 0;
const context = {
  pageHeader: (title, subtitle, actions = "") => `<header><h1>${title}</h1>${actions}</header>`,
  renderContextBackButton: () => '<button data-action="navigate-back">返回报表管理</button>',
  icon: name => `<i data-icon="${name}"></i>`,
  getBusinessLineOptions: () => ["零售金融部", "普惠金融部"],
  renderFilterField: field => {
    if (field.html) return field.html;
    if (field.type === "range") return `<div class="ticket-filter-item is-range"><label>${field.label}</label><input type="date"><input type="date"></div>`;
    if (field.type === "multiSelect") return `<div class="ticket-filter-item" data-filter-status-multi><label>${field.label}</label>${(field.options || []).map(option => `<input type="checkbox" value="${option}">`).join("")}</div>`;
    if (field.type === "tagHierarchy") return `<div class="ticket-filter-item" data-dictionary="${field.dictionary}"><label>${field.label}</label></div>`;
    if (field.type === "orgTree") return `<div class="ticket-filter-item" data-dictionary="institutionTree"><label>${field.label}</label></div>`;
    return `<div class="ticket-filter-item"><label>${field.label}</label><${field.type === "select" ? "select" : "input"}></${field.type === "select" ? "select" : "input"}></div>`;
  },
  renderComplaintExclusionRules: selected => `<div data-complaint-exclusion-rules><strong>剔除规则</strong>${["重复投诉", "再次投诉", "异常投诉", "废止投诉"].map(label => `<input type="checkbox" data-complaint-exclusion-rule value="${label}" ${selected.includes(label) ? "checked" : ""}>`).join("")}</div>`,
  bindComplaintExclusionRules: () => {},
  getComplaintExclusionFlags: ticketId => ticketId === "TS202607230012" ? ["重复投诉"] : [],
  navigate: page => { navigated = page; },
  rerenderPage: () => { rerendered += 1; },
  toast: message => { toast = message; },
  openTicketDetail: id => { openedTicket = id; }
};

const catalog = registry.render("analysis-reports", context);
assert.match(catalog, /data-module="complaints-reports"/);
assert.match(catalog, /data-report-view="catalog"/);
assert.equal((catalog.match(/data-action="complaints-report-open"/g) || []).length, 25);
assert.equal((catalog.match(/analysis-report-icon is-statistics/g) || []).length, 17);
assert.equal((catalog.match(/analysis-report-icon is-detail/g) || []).length, 8);
assert.doesNotMatch(catalog, /analysis-report-icon is-(?:blue|purple|orange|yellow|red)/);
assert.equal((catalog.match(/data-action="complaints-report-type"/g) || []).length, 3);
assert.match(catalog, /class="xib-segmented-filter report-catalog-tabs"/);
assert.doesNotMatch(catalog, /class="report-type/);
assert.match(catalog, /自然人-银行业金融机构金融消费者投诉分类统计表/);
assert.match(catalog, /银行业金融机构金融消费者投诉分类统计表/);
assert.match(catalog, /厦门法人银行异地分支机构信访投诉情况表/);
assert.match(catalog, /其他自收统计表/);
assert.deepEqual(
  Array.from(data.reports.find(report => report.id === "regulatory-consumer-complaint").dimensions),
  ["业务类别", "业务办理渠道", "投诉原因"]
);
assert.deepEqual(
  Array.from(data.reports.find(report => report.id === "regulatory-xiamen-remote-petition").dimensions),
  ["主要涉及事项", "主要涉及部门及业务", "处理应对措施、处理结果", "投诉量"]
);

assert.equal(registry.handleAction("complaints-report-type", { id:"统计" }, { ...context, page:"analysis-reports" }), true);
assert.equal(rerendered, 1);
const statisticsCatalog = registry.render("analysis-reports", context);
assert.equal((statisticsCatalog.match(/data-action="complaints-report-open"/g) || []).length, 17);
assert.doesNotMatch(statisticsCatalog, /溯源整改明细表/);
assert.match(statisticsCatalog, /溯源整改统计表/);
registry.handleAction("complaints-report-type", { id:"全部" }, { ...context, page:"analysis-reports" });

assert.equal(registry.handleAction("complaints-report-open", { id:"customer-behavior" }, { ...context, page:"analysis-reports" }), true);
assert.equal(navigated, "analysis-report-detail");
assert.equal(stored.get("xib-complaint-report-id"), "customer-behavior");

const customerDetail = registry.render("analysis-report-detail", context);
assert.match(customerDetail, /客户投诉行为画像分析表/);
assert.match(customerDetail, /data-report-view="detail"/);
assert.equal((customerDetail.match(/type="number"/g) || []).length, 2, "上下限范围必须由两个数字输入框组成");
assert.equal((customerDetail.match(/data-report-row(?:\s|>)/g) || []).length, 12);
assert.equal((customerDetail.match(/data-report-row-select/g) || []).length, 12);
assert.match(customerDetail, /data-action="complaints-report-export"/);
assert.match(customerDetail, /data-disable-column-customizer/);
assert.match(customerDetail, /ticket-filter-panel export-filter-panel report-filter-panel/);
assert.match(customerDetail, /report-filter-row is-customer-row/);
assert.match(customerDetail, /data-dictionary="rectificationProduct"/);
assert.match(customerDetail, /data-dictionary="rectificationCause"/);
assert.doesNotMatch(customerDetail, /modal|悬浮窗/);

registry.handleAction("complaints-report-open", { id:"regulatory-natural" }, { ...context, page:"analysis-reports" });
const regulatoryDetail = registry.render("analysis-report-detail", context);
assert.match(regulatoryDetail, /自然人-银行业金融机构金融消费者投诉分类统计表/);
assert.match(regulatoryDetail, /scope="colgroup"/);
assert.match(regulatoryDetail, /colspan="6"[^>]*>投诉分类统计/);
assert.match(regulatoryDetail, /业务办理渠道/);
assert.match(regulatoryDetail, /业务类型/);
assert.match(regulatoryDetail, /投诉原因/);
assert.equal((regulatoryDetail.match(/>剔除规则</g) || []).length, 1);
assert.equal((regulatoryDetail.match(/value="重复投诉"/g) || []).length, 1);
assert.equal((regulatoryDetail.match(/data-complaint-exclusion-flags=/g) || []).length, 12);

assert.equal(registry.handleAction("complaints-report-export", { id:"regulatory-natural" }, { ...context, page:"analysis-report-detail" }), true);
assert.equal(toast, "自然人-银行业金融机构金融消费者投诉分类统计表 已加入导出任务");
assert.equal(registry.handleAction("complaints-report-ticket", { id:"TS202607230012" }, { ...context, page:"analysis-report-detail" }), true);
assert.equal(openedTicket, "TS202607230012");

console.log("Complaint reports module checks passed.");
