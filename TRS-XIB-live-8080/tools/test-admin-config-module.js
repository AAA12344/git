"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sandbox = { window: {} };
vm.createContext(sandbox);

function run(relativePath) {
  const filename = path.join(root, relativePath);
  vm.runInContext(fs.readFileSync(filename, "utf8"), sandbox, { filename });
}

run("src/core/module-registry.js");
// 预警规则配置为单一数据源，后台管理只消费，不内联维护一份文案。
run("src/core/alert-rule-config.js");
run("src/modules/admin/config/index.js");

const registry = sandbox.window.XIBModuleRegistry;
let rerenders = 0;
let alertModal = null;
const context = {
  pageHeader: (title, subtitle, actions = "") => `<header><h1>${title}</h1><p>${subtitle}</p>${actions}</header>`,
  renderPagination: (count, scope, pageSize = 10) => `<footer data-count="${count}" data-scope="${scope}" data-page-size="${pageSize}"></footer>`,
  renderHierarchyCascaderControl: (id, field) => `<div class="di-hierarchy-cascader" data-app-hierarchy-cascader data-dictionary="${field.dictionary}" data-multiple="${field.multiple}" data-initial-value="${(field.defaultValue || []).join("、")}" data-levels="${field.levels.join(" / ")}"><button>${field.placeholder}</button>${field.tree.map(item => `<span>${item.label}</span>`).join("")}</div>`,
  openModal: (title, content, confirmText, onConfirm) => { alertModal = { title, content, confirmText, onConfirm }; },
  closeOverlay: () => {},
  toast: () => {},
  rerenderPage: () => { rerenders += 1; }
};

assert.equal(registry.hasRoute("admin-config"), true);
assert.equal(registry.hasRoute("admin-config-complaint"), true);
assert.equal(registry.hasRoute("admin-config-review"), true);
assert.deepEqual(JSON.parse(JSON.stringify(registry.list())), [
  { name: "admin-config", routes: ["admin-config", "admin-config-complaint", "admin-config-review"] }
]);

const alert = registry.render("admin-config-complaint", context);
assert.match(alert, /data-module="admin-config"/);
assert.match(alert, /投诉管理参数/);
assert.match(alert, /预警规则/);
assert.match(alert, /预警类型/);
assert.match(alert, /机构范围/);
assert.match(alert, /规则来源/);
assert.match(alert, /数值配置/);
assert.match(alert, /启用状态/);
assert.match(alert, /高发投诉客户/);
assert.match(alert, /总行\/分行TAB展示6类系统铺底量类规则/);
assert.match(alert, /一个或多个总行\/分行/);
assert.match(alert, /全行TAB展示9类系统默认规则/);
assert.match(alert, /系统默认规则不允许新增/);
assert.doesNotMatch(alert, /data-action="admin-alert-create"/);
assert.match(alert, /data-action="admin-alert-scope"/);
assert.match(alert, /全行/);
assert.match(alert, /总行\/分行/);
assert.doesNotMatch(alert, /支行/);
assert.doesNotMatch(alert, /沿用上级规则|回落到全行默认规则/);
assert.match(alert, /工单全量预警/);
assert.match(alert, /监管转办工单量预警/);
assert.match(alert, /自收渠道工单量预警/);
assert.match(alert, /风险投诉/);
assert.match(alert, /data-count="9"/);
assert.match(alert, /data-scope="admin-alert-config"/);
assert.match(alert, /data-page-size="10"/);
assert.match(alert, /系统默认/);
assert.match(alert, /时间范围14天/);
assert.match(alert, /环比阈值15%/);
assert.match(alert, /标准差倍数=1\.5/);
assert.match(alert, /删除/);
assert.match(alert, /data-action="admin-alert-detail"/);
assert.doesNotMatch(alert, /催办配置/);
assert.doesNotMatch(alert, /首次催办时限/);
assert.doesNotMatch(alert, /admin-config-tab/);
assert.doesNotMatch(alert, /data-action="admin-config-domain"/);

assert.equal(registry.handleAction("admin-alert-scope", { id: "branch" }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 1);
const branchScope = registry.render("admin-config-complaint", context);
assert.match(branchScope, /新增量类规则/);
assert.match(branchScope, /总行\+12家分行/);
assert.doesNotMatch(branchScope, /沿用上级规则|回落到全行默认规则|支行/);
assert.match(branchScope, /data-count="6"/);

assert.equal(registry.handleAction("admin-alert-scope", { id: "bank" }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 2);

assert.equal(registry.handleAction("admin-alert-detail", { id: "default-full-ticket-volume" }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 3);
const detail = registry.render("admin-config-complaint", context);
assert.match(detail, /工单全量预警/);
assert.match(detail, /预警规则/);
assert.match(detail, /全量投诉量异常/);
assert.doesNotMatch(detail, /判断规则中的数值可编辑/);
assert.match(detail, /判断规则/);
assert.doesNotMatch(detail, /标准差门槛/);
assert.match(detail, /全行规则：双环比均超过【环比阈值】时预警/);
assert.match(detail, /<dt>机构范围<\/dt><dd>全行<\/dd>/);
assert.match(detail, /推送角色/);
assert.match(detail, /处理员（总\/分行消保）、审批员（总\/分行消保）、业务员（总\/分行消保），不涉及支行。/);
assert.doesNotMatch(detail, /推送逻辑|具体分行命中/);
assert.match(detail, /<dt>预警摘要<\/dt>/);
assert.match(detail, /【工单全量预警】\{日期\}，\{机构范围\}当前\{时间范围\}投诉工单总量\{当前值\}件/);
assert.doesNotMatch(detail, /<dt>说明<\/dt>|按投诉工单总量口径识别全量工单异常波动/);
assert.doesNotMatch(detail, /支行：推/);
assert.doesNotMatch(detail, /推送给总行消保办成员/);
assert.doesNotMatch(detail, /判断规则可修改变量/);
assert.doesNotMatch(detail, /默认值\/字典值/);
assert.doesNotMatch(detail, /是否可编辑/);
assert.doesNotMatch(detail, /配置说明/);
assert.doesNotMatch(detail, /预警摘要生成规则/);
assert.doesNotMatch(detail, /可编辑内容/);
assert.doesNotMatch(detail, /计算口径\/方式/);
assert.doesNotMatch(detail, /删除限制/);
assert.doesNotMatch(detail, /系统默认规则不可删除/);
assert.doesNotMatch(detail, /继承逻辑|沿用|回落/);
assert.match(detail, /时间范围/);
assert.match(detail, /环比阈值/);
assert.doesNotMatch(detail, /均值k值|<span>标准差倍数<\/span>/);
assert.match(detail, /data-admin-alert-rule-field="0"/);
assert.match(detail, /data-admin-alert-rule-field="1"/);
assert.doesNotMatch(detail, /data-admin-alert-rule-field="2"/);
assert.doesNotMatch(detail, /admin-alert-readonly-scope/);
assert.equal(registry.handleAction("admin-alert-list", {}, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 4);

assert.equal(registry.handleAction("admin-alert-create", {}, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 5);
const create = registry.render("admin-config-complaint", context);
assert.match(create, /新增量类规则/);
assert.match(create, /data-action="admin-alert-copy-save">保存<\/button>/);
assert.doesNotMatch(create, /复制保存/);
assert.match(create, /data-admin-alert-type/);
assert.match(create, /data-app-hierarchy-cascader/);
assert.match(create, /data-dictionary="organizationTree"/);
assert.match(create, /data-multiple="true"/);
assert.doesNotMatch(create, /配置权限/);
assert.doesNotMatch(create, /data-admin-alert-admin-scope/);
assert.match(create, /超级管理员可选择总行和12个分行/);
assert.match(create, /总行/);
assert.match(create, /厦门分行/);
assert.match(create, /工单全量预警/);
assert.match(create, /监管转办工单量预警/);
assert.match(create, /自收渠道工单量预警/);
assert.match(create, /处理员（总\/分行消保）、审批员（总\/分行消保）、业务员（总\/分行消保），不涉及支行。/);
assert.doesNotMatch(create, /全行\/总行命中/);
assert.doesNotMatch(create, /具体分行命中/);
assert.match(create, /标准差倍数/);
assert.match(create, /value="1\.5"/);
assert.doesNotMatch(create, /高风险客户/);
let alertToast = "";
assert.equal(registry.handleAction("admin-alert-copy-save", { orgScopeNames: ["厦门分行", "福州分行"], templateId: "product" }, { ...context, page: "admin-config", root: null, toast: message => { alertToast = message; } }), true);
assert.equal(alertModal.title, "确认保存预警参数");
assert.equal(alertModal.confirmText, "确认保存");
assert.match(alertModal.content, /产品类/);
assert.match(alertModal.content, /厦门分行、福州分行/);
alertModal.onConfirm();
assert.equal(rerenders, 6);
const copiedBranchRule = registry.render("admin-config-complaint", context);
assert.match(copiedBranchRule, /厦门分行/);
assert.match(copiedBranchRule, /福州分行/);
assert.match(copiedBranchRule, /产品类/);
assert.match(copiedBranchRule, /新增量类规则/);
assert.match(copiedBranchRule, /data-count="7"/);
assert.equal(registry.handleAction("admin-alert-copy-save", { orgScopeNames: ["福州分行"], templateId: "product" }, { ...context, page: "admin-config", root: null, toast: message => { alertToast = message; } }), true);
assert.match(alertToast, /福州分行.*已存在产品类规则/);
assert.equal(registry.handleAction("admin-alert-detail", { id: copiedBranchRule.match(/data-action="admin-alert-detail" data-id="(added-product-[^"]+)"/)?.[1] }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 7);
const copiedBranchDetail = registry.render("admin-config-complaint", context);
assert.match(copiedBranchDetail, /data-app-hierarchy-cascader/);
assert.match(copiedBranchDetail, /data-multiple="true"/);
assert.match(copiedBranchDetail, /data-initial-value="厦门分行、福州分行"/);
assert.match(copiedBranchDetail, /data-action="admin-alert-save"/);
assert.match(copiedBranchDetail, /处理员（总\/分行消保）、审批员（总\/分行消保）、业务员（总\/分行消保），不涉及支行。/);
assert.doesNotMatch(copiedBranchDetail, /相关产品\/责任部门|总行、分行部门/);
assert.doesNotMatch(copiedBranchDetail, /全行命中|总行命中/);
assert.equal(registry.handleAction("admin-alert-list", {}, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 8);

assert.equal(registry.handleAction("admin-alert-detail", { id: "default-product" }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 9);
const product = registry.render("admin-config-complaint", context);
assert.match(product, /一级产品投诉量异常/);
assert.match(product, /当前窗口达到历史均值\+【标准差倍数】×标准差/);
assert.match(product, /环比阈值/);
assert.match(product, /标准差倍数/);
assert.match(product, /处理员（总\/分行消保）、审批员（总\/分行消保）、业务员（总\/分行消保），不涉及支行。/);
assert.doesNotMatch(product, /同时推送相关产品\/责任部门/);
assert.doesNotMatch(product, /产品部门负责人/);
assert.doesNotMatch(product, /推送给总行消保办成员/);
assert.equal(registry.handleAction("admin-alert-list", {}, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 10);

assert.equal(registry.handleAction("admin-alert-detail", { id: "default-reason" }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 11);
const reason = registry.render("admin-config-complaint", context);
assert.match(reason, /一级原因投诉量异常/);
assert.match(reason, /处理员（总\/分行消保）、审批员（总\/分行消保）、业务员（总\/分行消保），不涉及支行。/);
assert.doesNotMatch(reason, /同时推送相关产品\/责任部门/);
assert.doesNotMatch(reason, /产品部门负责人/);
assert.doesNotMatch(reason, /推送给总行消保办成员/);
assert.equal(registry.handleAction("admin-alert-list", {}, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 12);

assert.equal(registry.handleAction("admin-alert-detail", { id: "default-risk-complaint" }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 13);
const riskComplaint = registry.render("admin-config-complaint", context);
assert.match(riskComplaint, /风险投诉/);
assert.match(riskComplaint, /处理员（总\/分行消保）、审批员（总\/分行消保）、业务员（总\/分行消保），不涉及支行。/);
assert.doesNotMatch(riskComplaint, /同时推送对应客户/);
assert.doesNotMatch(riskComplaint, /当前工单处理部门审批员、处理员/);
assert.equal(registry.handleAction("admin-alert-list", {}, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 14);

assert.equal(registry.handleAction("admin-alert-detail", { id: "default-escalation" }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 15);
const escalation = registry.render("admin-config-complaint", context);
assert.match(escalation, /升级投诉/);
assert.match(escalation, /全行全量数据/);
assert.match(escalation, /同一客户重复投诉内监管渠道投诉单/);
assert.match(escalation, /<dt>机构范围<\/dt><dd>全行全量数据<\/dd>/);
assert.match(escalation, /处理员（总\/分行消保）、审批员（总\/分行消保）、业务员（总\/分行消保），不涉及支行。/);
assert.doesNotMatch(escalation, /同时推送对应客户/);
assert.doesNotMatch(escalation, /支行：推/);
assert.doesNotMatch(escalation, /推送给总行消保办成员/);
assert.doesNotMatch(escalation, /判断规则可修改变量/);
assert.doesNotMatch(escalation, /默认值\/字典值/);
assert.doesNotMatch(escalation, /是否可编辑/);
assert.doesNotMatch(escalation, /配置说明/);
assert.doesNotMatch(escalation, /预警摘要生成规则/);
assert.doesNotMatch(escalation, /无可编辑变量/);
assert.doesNotMatch(escalation, /计算口径\/方式/);
assert.doesNotMatch(escalation, /删除限制/);
assert.equal(registry.handleAction("admin-alert-list", {}, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 16);

assert.equal(registry.handleAction("admin-alert-detail", { id: "default-frequent-customer" }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 17);
const frequentCustomer = registry.render("admin-config-complaint", context);
assert.match(frequentCustomer, /高发投诉客户/);
assert.match(frequentCustomer, /高发客户指该客户在指定时间内产生投诉事件单超过阈值/);
assert.match(frequentCustomer, /时间范围/);
assert.match(frequentCustomer, /投诉次数阈值/);
assert.match(frequentCustomer, /处理员（总\/分行消保）、审批员（总\/分行消保）、业务员（总\/分行消保），不涉及支行。/);
assert.doesNotMatch(frequentCustomer, /同时推送对应客户/);
assert.doesNotMatch(frequentCustomer, /支行：推/);
assert.doesNotMatch(frequentCustomer, /推送给总行消保办成员/);
assert.doesNotMatch(frequentCustomer, /均值k值/);
assert.equal(registry.handleAction("admin-alert-list", {}, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 18);

assert.equal(registry.handleAction("admin-alert-detail", { id: "default-high-risk-customer" }, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 19);
const highRiskCustomer = registry.render("admin-config-complaint", context);
assert.match(highRiskCustomer, /高风险客户/);
assert.match(highRiskCustomer, /高风险标签/);
assert.match(highRiskCustomer, /舆情风险/);
assert.match(highRiskCustomer, /客户被识别为高风险时触发/);
assert.match(highRiskCustomer, /处理员（总\/分行消保）、审批员（总\/分行消保）、业务员（总\/分行消保），不涉及支行。/);
assert.doesNotMatch(highRiskCustomer, /同时推送对应客户/);
assert.doesNotMatch(highRiskCustomer, /风险管理部门/);
assert.doesNotMatch(highRiskCustomer, /支行：推/);
assert.doesNotMatch(highRiskCustomer, /推送给总行消保办成员/);
assert.doesNotMatch(highRiskCustomer, /统计周期/);
assert.equal(registry.handleAction("admin-alert-list", {}, { ...context, page: "admin-config" }), true);
assert.equal(rerenders, 20);

const review = registry.render("admin-config-review", context);
assert.match(review, /消保审查参数配置/);
assert.match(review, /暂无配置内容/);

assert.equal(registry.handleAction("unknown-action", {}, { ...context, page: "admin-config" }), false);
console.log("Admin config module checks passed.");
