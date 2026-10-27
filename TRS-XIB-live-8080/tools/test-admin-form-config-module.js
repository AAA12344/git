"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const storedValues = new Map();
const localStorage = {
  getItem: key => storedValues.has(key) ? storedValues.get(key) : null,
  setItem: (key, value) => storedValues.set(key, String(value)),
  removeItem: key => storedValues.delete(key)
};
const sandbox = { window: { localStorage, setTimeout: callback => callback() } };
vm.createContext(sandbox);
const run = relativePath => vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), sandbox, { filename: relativePath });

run("src/core/module-registry.js");
run("src/modules/admin/form-config/data.js");
run("src/modules/admin/form-config/index.js");

const moduleData = sandbox.window.XIB_ADMIN_FORM_CONFIG_DATA;
const templateStore = sandbox.window.XIBAdminFormTemplateStore;
const enumOverrideStore = sandbox.window.XIBAdminFormEnumOverrideStore;
const smsTemplateStore = sandbox.window.XIBAdminSmsTemplateStore;
const formChangeHistoryStore = sandbox.window.XIBAdminFormChangeHistoryStore;
const dictionaryStore = sandbox.window.XIBAdminDictionaryStore;
const templateDataUrl = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64," + fs.readFileSync(path.join(root, "templates", "异常投诉识别情况报告.docx")).toString("base64");
assert.equal(moduleData.forms.length, 13);
assert.equal(moduleData.fields["投诉单"].at(-1).type, "日期/时间");
assert.equal(moduleData.fields["异常投诉"].at(-1).type, "附件模板");
assert.equal(moduleData.enumMeta.product.pool.length, 25);
assert.deepEqual(Array.from(enumOverrideStore.get("complaint", moduleData.enumMeta.complaint.pool)), Array.from(moduleData.enumMeta.complaint.pool));
enumOverrideStore.save("complaint", [...moduleData.enumMeta.complaint.pool, "前端新增演示值"]);
assert.equal(enumOverrideStore.get("complaint", moduleData.enumMeta.complaint.pool).at(-1), "前端新增演示值");
assert.equal(moduleData.enumMeta.complaint.pool.length, 15);
assert.throws(() => enumOverrideStore.save("complaint", ["重复值", "重复值"]), /不能重复/);
assert.equal(templateStore.get().fileName, "异常投诉识别情况报告.docx");
assert.throws(() => templateStore.save({
  fileName: "异常投诉识别情况报告_无权限.docx",
  dataUrl: templateDataUrl
}), /仅超级管理员/);
assert.throws(() => templateStore.save({
  fileName: "伪造模板.docx",
  dataUrl: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,VGVzdA=="
}, { profileId:"technology-super-admin", displayName:"超级管理员" }), /有效的 Word 模板/);
assert.throws(() => templateStore.save({
  fileName: "超大模板.docx",
  dataUrl: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDB" + "A".repeat(2_800_000)
}, { profileId:"technology-super-admin", displayName:"超级管理员" }), /不能超过 2MB/);
templateStore.save({
  fileName: "异常投诉识别情况报告_2026-08.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dataUrl: templateDataUrl,
  updatedAt: "2026-08-20 10:30:00"
}, { profileId:"technology-super-admin", displayName:"超级管理员" });
assert.equal(templateStore.get().fileName, "异常投诉识别情况报告_2026-08.docx");
assert.equal(templateStore.history()[0].before, "异常投诉识别情况报告.docx");
assert.equal(templateStore.history()[0].after, "异常投诉识别情况报告_2026-08.docx");
const registry = sandbox.window.XIBModuleRegistry;
let rerenders = 0;
const context = {
  state: { roleProfile:"technology-super-admin" },
  currentViewLabel: () => "超级管理员",
  pageHeader: (title, subtitle, actions = "") => `<header><h1>${title}</h1><p>${subtitle}</p>${actions}</header>`,
  renderFilters: () => '<div class="filter-panel ticket-filter-panel"></div>',
  renderPagination: count => `<footer data-count="${count}"></footer>`,
  openModal: (title, content, confirmText, onConfirm) => { context.lastModal = { title, content, confirmText, onConfirm }; },
  closeOverlay: () => { context.closed = true; },
  toast: message => { context.lastToast = message; },
  rerenderPage: () => { rerenders += 1; },
  currentUser: () => "陈敏慧-60157"
};

const list = registry.render("admin-form-complaint", context);
assert.match(list, /data-module="admin-form-config"/);
assert.match(list, /投诉管理表单/);
assert.match(list, /投诉管理表单列表/);
assert.match(list, /短信模版/);
assert.equal((list.match(/admin-form-detail/g) || []).length, 26);
assert.match(list, /data-count="13"/);
assert.match(list, />可修改字段<\/th>/);
assert.doesNotMatch(list, />短信标题<\/th>/);
assert.doesNotMatch(list, /枚举字段数量/);
assert.equal(moduleData.forms.find(item => item.name === "投诉单").editableFieldCount, 8);
assert.equal(moduleData.forms.find(item => item.name === "异常投诉").editableFieldCount, 2);
assert.deepEqual(Array.from(moduleData.enumMeta.cancel.pool), ["邮件", "面访", "微信", "电话", "短信", "其他"]);
assert.equal(moduleData.enumMeta.exclude.pool.length, 10);
assert.match(moduleData.enumMeta.exclude.pool[7], /断卡行动/);
assert.deepEqual(Array.from(moduleData.fields["投诉问责"].map(item => item.name)), ["问责机构", "问责部门", "问责对象", "问责措施"]);
assert.equal(moduleData.fields["纠纷化解"].at(-1).name, "化解金额");
assert.doesNotMatch(list, /舆情单/);
assert.doesNotMatch(list, /admin-form-history/);

const dictionaryPage = registry.render("admin-form-dictionary", context);
assert.match(dictionaryPage, /字典管理/);
assert.match(dictionaryPage, /字典类型/);
assert.match(dictionaryPage, /字典项 — 投诉单 · 受理渠道/);
assert.match(dictionaryPage, /complaint_accept_channel/);
assert.match(dictionaryPage, /客服电话/);
assert.match(dictionaryPage, /信访单 · 受理渠道/);
assert.match(dictionaryPage, /表扬单 · 受理渠道/);
assert.match(dictionaryPage, /建议单 · 受理渠道/);
assert.doesNotMatch(dictionaryPage, /舆情单|黑猫投诉|抖音|小红书|微信公众号/);
assert.match(dictionaryPage, /新增类型/);
assert.match(dictionaryPage, /新增字典项/);
assert.ok(dictionaryStore);
assert.deepEqual(Array.from(dictionaryStore.items("complaint_accept_channel").map(item => item.name)).slice(0, 3), ["客服电话", "在线客服", "总行投诉邮箱"]);
assert.ok(dictionaryStore.items("petition_accept_channel").some(item => item.name === "纪检"));
assert.ok(!dictionaryStore.items("petition_accept_channel").some(item => item.name === "客服电话"));
const complaintChannelCount = dictionaryStore.items("complaint_accept_channel").length;
dictionaryStore.createItem("complaint_accept_channel", { code:"COMPLAINT_TEST", name:"投诉渠道测试值" });
assert.equal(dictionaryStore.items("complaint_accept_channel").length, complaintChannelCount + 1);
dictionaryStore.updateItem("complaint_accept_channel", "COMPLAINT_TEST", { name:"投诉渠道测试值（更新）" });
assert.equal(dictionaryStore.items("complaint_accept_channel").at(-1).name, "投诉渠道测试值（更新）");
dictionaryStore.toggleItem("complaint_accept_channel", "COMPLAINT_TEST");
assert.equal(dictionaryStore.items("complaint_accept_channel").at(-1).status, "停用");
dictionaryStore.deleteItem("complaint_accept_channel", "COMPLAINT_TEST");
assert.equal(dictionaryStore.items("complaint_accept_channel").length, complaintChannelCount);
assert.equal(registry.handleAction("admin-dictionary-select", { id:"biz_channel" }, { ...context, page:"admin-form-dictionary" }), true);
assert.match(registry.render("admin-form-dictionary", context), /字典项 — 投诉单 · 业务办理渠道/);

const smsManagementPage = registry.render("admin-form-sms", context);
assert.match(smsManagementPage, /短信模板管理/);
assert.match(smsManagementPage, /短信模版列表/);
assert.doesNotMatch(smsManagementPage, /投诉管理表单列表/);
assert.doesNotMatch(list, />表单名称<\/label>/);

assert.equal(registry.handleAction("admin-form-list-tab", { id: "sms" }, { ...context, page: "admin-form-complaint" }), true);
assert.equal(rerenders, 2);
const smsList = registry.render("admin-form-complaint", context);
assert.match(smsList, /短信模版列表/);
assert.match(smsList, /短信标题/);
assert.match(smsList, />分类<\/th>/);
assert.match(smsList, />变量数量<\/th>/);
assert.match(smsList, />启用状态<\/th>/);
assert.match(smsList, />更新时间<\/th>/);
assert.match(smsList, />操作<\/th>/);
assert.match(smsList, /data-action="admin-form-sms-create"/);
assert.match(smsList, /短信模板修改记录/);
assert.match(smsList, /data-action="admin-form-sms-view"/);
assert.match(smsList, /data-action="admin-form-sms-edit"/);
assert.match(smsList, /data-action="admin-form-sms-delete"/);
assert.match(smsList, /admin-action-danger/);
assert.match(smsList, /建单告知短信/);
assert.match(smsList, /办结告知短信/);
assert.doesNotMatch(smsList, />其他</);
assert.match(smsList, /投诉受理告知短信/);
assert.doesNotMatch(smsList, /投诉办结告知短信/);
assert.match(smsList, /非我行客户提示短信/);
assert.equal(moduleData.smsTemplates.length, 3);
assert.equal(smsTemplateStore.get("accept-notice").variables[0].name, "投诉编号");
assert.equal(smsTemplateStore.get("accept-notice").variables[0].fixed, true);
assert.equal(smsTemplateStore.get("accept-notice").variables[0].source, "系统带入");
assert.equal(smsTemplateStore.get("close-notice").variables[1].source, "手工录入");
assert.equal(smsTemplateStore.get("accept-notice").category, "建单告知短信");
assert.match(smsTemplateStore.get("accept-notice").node, /工单创建阶段/);
assert.equal(smsTemplateStore.get("close-notice").category, "办结告知短信");
assert.match(smsTemplateStore.get("close-notice").node, /工单和子单处理阶段/);
assert.equal(registry.handleAction("admin-form-sms-view", { id: "accept-notice" }, { ...context, page: "admin-form-complaint" }), true);
assert.equal(context.lastModal.title, "查看短信模板");
assert.match(context.lastModal.content, /readonly/);
assert.equal(registry.handleAction("admin-form-sms-edit", { id: "accept-notice" }, { ...context, page: "admin-form-complaint" }), true);
assert.equal(context.lastModal.title, "编辑短信模板");
assert.match(context.lastModal.content, /短信标题/);
assert.match(context.lastModal.content, /短信模板内容/);
assert.match(context.lastModal.content, /模板变量/);
assert.match(context.lastModal.content, /短信分类/);
assert.match(context.lastModal.content, /admin-sms-category-field/);
assert.match(context.lastModal.content, /建单告知短信/);
assert.match(context.lastModal.content, /data-admin-sms-title/);
assert.equal(smsTemplateStore.get("accept-notice").title, "投诉受理告知短信");
assert.match(context.lastModal.content, /data-admin-sms-content/);
assert.match(context.lastModal.content, /data-admin-sms-variable/);
assert.match(context.lastModal.content, /<th>变量名称<\/th>/);
assert.match(context.lastModal.content, /<th>取值方式<\/th>/);
assert.match(context.lastModal.content, /data-admin-sms-variable-add/);
assert.doesNotMatch(context.lastModal.content, /data-admin-sms-variable-insert/);
assert.match(context.lastModal.content, /data-admin-sms-variable-source/);
assert.match(context.lastModal.content, /系统带入/);
assert.match(context.lastModal.content, /admin-sms-variable-badge/);
assert.ok(context.lastModal.content.indexOf("模板变量") < context.lastModal.content.indexOf("短信模板内容"));
assert.ok(context.lastModal.content.indexOf("短信模板内容") < context.lastModal.content.indexOf("短信发送节点"));
assert.match(context.lastModal.content, /取值优先取转送函号，无转送函号时取工单编号/);
assert.match(context.lastModal.content, /value="投诉编号"[^>]*readonly/);
assert.match(context.lastModal.content, /data-admin-sms-send-rule-readonly/);
assert.doesNotMatch(context.lastModal.content, /工单状态/);
assert.throws(() => smsTemplateStore.save("accept-notice", { title:"标题", content:"", variables:[{ name:"投诉编号" }] }), /短信模板内容不能为空/);
assert.throws(() => smsTemplateStore.save("accept-notice", { title:"标题", content:"内容", variables:[{ name:"手动变量" }] }), /投诉编号不能删除/);
assert.throws(() => smsTemplateStore.save("accept-notice", { title:"标题", content:"内容【未登记变量】", variables:[{ name:"投诉编号" }] }), /未登记变量/);
assert.throws(() => smsTemplateStore.save("accept-notice", { title:"标题", content:"内容【投诉编号】", variables:[{ name:"投诉编号" }, { name:"投诉编号" }] }), /不能重复/);
const savedSmsTemplate = smsTemplateStore.save("accept-notice", { title:"投诉受理告知短信（已更新）", content:"【厦门国际银行】更新后的短信内容【投诉编号】【补充说明】", variables:[{ name:"投诉编号" }, { name:"补充说明" }], updateTime:"2026-08-29 09:30:00" });
assert.equal(smsTemplateStore.get("accept-notice").content, "【厦门国际银行】更新后的短信内容【投诉编号】【补充说明】");
assert.equal(smsTemplateStore.get("accept-notice").variables[0].fixed, true);
assert.equal(smsTemplateStore.get("accept-notice").variables[1].source, "手工录入");
assert.ok(smsTemplateStore.history().some(item => item.category === "建单告知短信"));
assert.match(registry.render("admin-form-complaint", context), /投诉受理告知短信（已更新）/);
const createdSmsTemplate = smsTemplateStore.create({ title:"处理沟通短信示例", category:"处理沟通短信", content:"您好，【投诉编号】【补充内容】", variables:[{ name:"投诉编号", source:"系统带入" }, { name:"补充内容", source:"手工录入" }], updateTime:"2026-08-29 10:00:00" });
assert.equal(createdSmsTemplate.category, "处理沟通短信");
assert.match(createdSmsTemplate.node, /工单和子单处理阶段/);
assert.equal(createdSmsTemplate.variables[1].source, "手工录入");
assert.equal(smsTemplateStore.list().length, 4);
assert.equal(registry.handleAction("admin-form-sms-delete", { id: createdSmsTemplate.id }, { ...context, page: "admin-form-complaint" }), true);
assert.equal(context.lastModal.title, "删除短信模板");
assert.equal(context.lastModal.confirmText, "确认删除");
context.lastModal.onConfirm();
assert.equal(smsTemplateStore.get(createdSmsTemplate.id), null);
assert.equal(smsTemplateStore.list().length, 3);
assert.ok(smsTemplateStore.history().some(item => item.action === "删除" && item.category === "处理沟通短信"));
assert.equal(registry.handleAction("admin-form-sms-create", {}, { ...context, page: "admin-form-complaint" }), true);
assert.equal(context.lastModal.title, "新增短信模板");
assert.match(context.lastModal.content, /data-admin-sms-category/);
assert.equal(registry.handleAction("admin-form-list-tab", { id: "forms" }, { ...context, page: "admin-form-complaint" }), true);
assert.equal(rerenders, 4);

const review = registry.render("admin-form-review", context);
assert.match(review, /消保审查表单/);
assert.match(review, /暂无配置内容/);

assert.equal(registry.handleAction("admin-form-detail", { id: "投诉单" }, { ...context, page: "admin-form-complaint" }), true);
assert.equal(rerenders, 5);
const detail = registry.render("admin-form-complaint", context);
assert.match(detail, /投诉单/);
assert.match(detail, /账户管控/);
assert.match(detail, /data-count="4"/);
assert.match(detail, /data-count="3"/);
assert.match(detail, />字段名称<\/th>/);
assert.doesNotMatch(detail, /新字段名称/);
assert.doesNotMatch(detail, /投诉人姓名/);
assert.doesNotMatch(detail, /投诉人电话/);
assert.doesNotMatch(detail, /投诉内容/);
assert.doesNotMatch(detail, /受理时间/);
assert.doesNotMatch(detail, /短信模板配置/);
assert.doesNotMatch(detail, /受理告知短信/);
assert.match(detail, /data-action="admin-form-field-edit"/);
assert.match(detail, /<th>操作时间<\/th><th>操作人<\/th><th>修改字段<\/th><th>说明<\/th>/);
assert.doesNotMatch(detail, /修改前版本|修改后版本/);
assert.equal(registry.handleAction("admin-form-field-edit", { id: "complaint" }, { ...context, page: "admin-form-complaint" }), true);
assert.equal(context.lastModal.title, "编辑枚举值");
assert.doesNotMatch(context.lastModal.content, /新字段名称/);
assert.match(context.lastModal.content, /字段名称/);
assert.match(context.lastModal.content, /data-admin-enum-field-name[^>]*readonly/);
assert.match(context.lastModal.content, /贷款催收/);
assert.match(context.lastModal.content, /新增枚举值/);
assert.match(context.lastModal.content, /data-admin-enum-add/);
assert.match(context.lastModal.content, /data-admin-enum-value/);

const updatedComplaintValues = [...enumOverrideStore.get("complaint", moduleData.enumMeta.complaint.pool), "提交说明测试值"];
sandbox.window.document = {
  querySelector: selector => selector === ".admin-enum-edit-modal" ? {
    querySelectorAll: innerSelector => innerSelector === "[data-admin-enum-value]" ? updatedComplaintValues.map(value => ({ value })) : []
  } : null,
  getElementById: () => null
};
context.lastModal.onConfirm();
assert.equal(enumOverrideStore.get("complaint", moduleData.enumMeta.complaint.pool).at(-1), "提交说明测试值");
assert.equal(context.lastToast, "字段配置已暂存，请提交修改");
assert.equal(registry.handleAction("admin-form-submit", {}, { ...context, page: "admin-form-complaint" }), true);
assert.equal(context.lastModal.title, "提交修改");
assert.equal(context.lastModal.confirmText, "确认提交");
assert.match(context.lastModal.content, /说明 <em>\*<\/em>/);
assert.match(context.lastModal.content, /admin-form-change-description/);
const descriptionInput = { value:"补充投诉事项字典值，用于验证修改记录说明。", focus() {} };
sandbox.window.document = {
  querySelector: () => null,
  getElementById: id => id === "admin-form-change-description" ? descriptionInput : null
};
context.lastModal.onConfirm();
assert.equal(context.lastToast, "表单修改已提交");
assert.equal(formChangeHistoryStore.list("投诉单")[0].user, "陈敏慧-60157");
assert.equal(formChangeHistoryStore.list("投诉单")[0].desc, descriptionInput.value);
assert.match(registry.render("admin-form-complaint", context), /补充投诉事项字典值，用于验证修改记录说明。/);

assert.equal(registry.handleAction("admin-form-detail", { id: "异常投诉" }, { ...context, page: "admin-form-complaint" }), true);
assert.equal(rerenders, 8);
const abnormalDetail = registry.render("admin-form-complaint", context);
assert.match(abnormalDetail, /附件模板/);
assert.match(abnormalDetail, /异常投诉识别情况报告_2026-08\.docx/);
assert.match(abnormalDetail, /上传新模板/);
assert.match(abnormalDetail, /data-admin-form-template-input/);
assert.match(abnormalDetail, /超级管理员/);
const secondaryAdminDetail = registry.render("admin-form-complaint", { ...context, state:{ roleProfile:"technology-admin" }, currentViewLabel:() => "二级管理员" });
assert.doesNotMatch(secondaryAdminDetail, /data-admin-form-template-input/);
assert.match(secondaryAdminDetail, /仅超级管理员可维护/);

assert.equal(registry.handleAction("admin-form-list", {}, { ...context, page: "admin-form-complaint" }), true);
assert.equal(rerenders, 9);
assert.match(registry.render("admin-form-complaint", context), /投诉管理表单列表/);
console.log("Admin form configuration module checks passed.");
