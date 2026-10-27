const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const storedValues = new Map();
const sandbox = { window: { localStorage: {
  getItem: key => storedValues.has(key) ? storedValues.get(key) : null,
  setItem: (key, value) => storedValues.set(key, String(value)),
  removeItem: key => storedValues.delete(key)
} } };
vm.createContext(sandbox);

function run(relativePath) {
  const filename = path.join(root, relativePath);
  vm.runInContext(fs.readFileSync(filename, "utf8"), sandbox, { filename });
}

run("src/core/module-registry.js");
run("src/modules/admin/operations/index.js");

const registry = sandbox.window.XIBModuleRegistry;
const notificationTemplateStore = sandbox.window.XIBAdminNotificationTemplateStore;
const calls = { toasts: [], modals: [], rerenders: 0 };
const context = {
  pageHeader: (title, subtitle, action = "") => `<header><h1>${title}</h1><p>${subtitle}</p>${action}</header>`,
  statusTag: text => `<span class="status">${text}</span>`,
  renderFilters: items => '<div class="filter-panel ticket-filter-panel">' + items.map(item => `<label>${item.label}<input placeholder="${item.placeholder || ""}"></label>`).join("") + '</div>',
  renderPagination: count => `<footer data-count="${count}"></footer>`,
  toast: message => calls.toasts.push(message),
  openModal: (...args) => calls.modals.push(args),
  closeOverlay: () => {},
  rerenderPage: () => { calls.rerenders += 1; }
};

const jobs = registry.render("admin-jobs", context);
assert.match(jobs, /data-module="admin-operations"/);
assert.match(jobs, /智能核查任务/);
assert.match(jobs, /data-count="6"/);
assert.match(jobs, /data-action="admin-job-form"/);
assert.equal((jobs.match(/>执行<\/button>/g) || []).length, 6);
assert.doesNotMatch(jobs, />启动<\/button>|>暂停<\/button>|已暂停|data-action="admin-job-toggle"/);

const notifications = registry.render("admin-notify-complaint", context);
assert.match(notifications, /投诉管理消息通知/);
assert.match(notifications, /配置投诉管理流程中的站内消息模板与通知渠道/);
assert.match(notifications, /新增模板/);
assert.match(notifications, /关键字/);
assert.match(notifications, /模板编码\/名称\/触发节点/);
assert.match(notifications, /提醒类型/);
assert.match(notifications, /通知角色/);
assert.match(notifications, /【工\/子单类型】草稿待完善/);
assert.match(notifications, /短信审批被驳回/);
assert.match(notifications, /data-count="10"/);
assert.equal((notifications.match(/data-action="admin-notification-template-view"/g) || []).length, 10);
assert.equal((notifications.match(/data-action="admin-notification-template-edit"/g) || []).length, 10);
assert.equal((notifications.match(/data-action="admin-notification-template-disable"/g) || []).length, 10);
assert.doesNotMatch(notifications, /响应提醒节点|超期提醒节点|新增节点/);
assert.ok(notificationTemplateStore);
assert.equal(notificationTemplateStore.list().length, 10);
assert.equal(notificationTemplateStore.search({ keyword:"短信", type:"待办提醒", status:"启用" }).length, 2);
const createdNotification = notificationTemplateStore.create({ type:"消息通知", name:"测试通知模板", trigger:"测试节点", role:"测试角色", status:"启用" });
assert.equal(notificationTemplateStore.get(createdNotification.id).name, "测试通知模板");
notificationTemplateStore.update(createdNotification.id, { name:"测试通知模板（更新）" });
assert.equal(notificationTemplateStore.get(createdNotification.id).name, "测试通知模板（更新）");
notificationTemplateStore.toggle(createdNotification.id);
assert.equal(notificationTemplateStore.get(createdNotification.id).status, "停用");

const notificationFormValues = {
  "[data-admin-notification-name]":"页面新增模板",
  "[data-admin-notification-type]":"消息通知",
  "[data-admin-notification-trigger]":"页面新增节点",
  "[data-admin-notification-role]":"页面测试角色",
  "[data-admin-notification-message-title]":"页面新增标题",
  "[data-admin-notification-message-content]":"页面新增内容"
};
const notificationFormRoot = {
  querySelector: selector => ({ value:notificationFormValues[selector] || "" }),
  querySelectorAll: selector => selector === "[data-admin-notification-channel]:checked" ? [{ value:"站内信" }, { value:"邮件" }] : []
};
sandbox.window.document = { querySelector: selector => selector === "[data-notification-template-page]" ? notificationFormRoot : null };
assert.equal(registry.handleAction("admin-notification-template-create", {}, { ...context, page:"admin-notify-complaint" }), true);
assert.equal(registry.handleAction("admin-notification-template-save", {}, { ...context, page:"admin-notify-complaint" }), true);
const createdFromPage = notificationTemplateStore.list().find(item => item.name === "页面新增模板");
assert.ok(createdFromPage);
assert.deepEqual(Array.from(createdFromPage.channels), ["站内信", "邮件"]);
notificationFormValues["[data-admin-notification-name]"] = "页面编辑模板";
assert.equal(registry.handleAction("admin-notification-template-edit", { id:createdFromPage.id }, { ...context, page:"admin-notify-complaint" }), true);
assert.equal(registry.handleAction("admin-notification-template-save", {}, { ...context, page:"admin-notify-complaint" }), true);
assert.equal(notificationTemplateStore.get(createdFromPage.id).name, "页面编辑模板");
sandbox.window.document = { querySelector: selector => ({
  "[data-admin-notification-filter-keyword]":{ value:"短信" },
  "[data-admin-notification-filter-type]":{ value:"待办提醒" },
  "[data-admin-notification-filter-status]":{ value:"启用" }
}[selector] || null) };
assert.equal(registry.handleAction("admin-notification-filter-search", {}, { ...context, page:"admin-notify-complaint" }), true);
assert.match(registry.render("admin-notify-complaint", context), /data-count="2"/);
assert.equal(registry.handleAction("admin-notification-filter-reset", {}, { ...context, page:"admin-notify-complaint" }), true);
assert.match(registry.render("admin-notify-complaint", context), /data-count="12"/);

const reviewNotifications = registry.render("admin-notify-review", context);
assert.match(reviewNotifications, /消保审查消息/);
assert.match(reviewNotifications, /暂无配置内容/);

assert.equal(registry.handleAction("admin-notification-template-view", { id:"complaint-template-1" }, { ...context, page:"admin-notify-complaint" }), true);
const viewPage = registry.render("admin-notify-complaint", context);
assert.match(viewPage, /data-notification-template-page="view"/);
assert.match(viewPage, /查看模板/);
assert.match(viewPage, /草稿待完善/);
assert.match(viewPage, /通知角色/);
assert.doesNotMatch(viewPage, /data-action="admin-notification-template-save"/);
assert.equal(registry.handleAction("admin-notification-template-list", {}, { ...context, page:"admin-notify-complaint" }), true);
assert.equal(registry.handleAction("admin-notification-template-create", {}, { ...context, page:"admin-notify-complaint" }), true);
const createPage = registry.render("admin-notify-complaint", context);
assert.match(createPage, /data-notification-template-page="create"/);
assert.match(createPage, /新增模板/);
assert.match(createPage, /通知信息/);
assert.match(createPage, /通知模板/);
assert.match(createPage, /发送渠道/);
assert.match(createPage, /保存配置/);
assert.equal(registry.handleAction("admin-notification-template-list", {}, { ...context, page:"admin-notify-complaint" }), true);
assert.equal(registry.handleAction("admin-notification-template-disable", { id:"complaint-template-1" }, { ...context, page:"admin-notify-complaint" }), true);
assert.equal(calls.toasts.at(-1), "消息模板已停用");
assert.equal(notificationTemplateStore.get("complaint-template-1").status, "停用");
assert.match(registry.render("admin-notify-complaint", context), /消息模板已停用|停用/);

assert.equal(registry.handleAction("admin-audit-tab", { id:"review" }, { ...context, page:"admin-audit" }), true);
assert.equal(calls.rerenders, 12);
const audit = registry.render("admin-audit", context);
assert.match(audit, /data-id="complaint">投诉/);
assert.match(audit, /data-id="review">审查/);
assert.match(audit, /共 <b>3<\/b> \/ 15 条/);
assert.match(audit, /admin-audit-heading/);
assert.match(audit, /data-action="admin-audit-reset"/);
assert.match(audit, />详情<\/button>/);
assert.match(audit, /用户ID/);
assert.match(audit, /调用路径/);
assert.match(audit, /IP地址/);
assert.match(audit, /方法耗时\(毫秒\)/);
assert.match(audit, /\/admin\/permission\/update/);
assert.match(audit, /data-count="3"/);
assert.equal(registry.handleAction("admin-audit-reset", {}, { ...context, page:"admin-audit" }), true);

assert.equal(registry.handleAction("admin-job-form", {}, { ...context, page:"admin-jobs" }), true);
const jobModal = calls.modals.at(-1);
assert.equal(jobModal[0], "批量任务");
assert.equal(jobModal[2], "提交");
assert.match(jobModal[1], /自动催办任务/);
assert.match(jobModal[1], /自动催办定时任务/);
assert.ok(jobModal[1].includes("0 0/10 * * * ?"));
assert.match(jobModal[1], /eventJobs/);
assert.match(jobModal[1], /taskCampaignJob/);
assert.equal(registry.handleAction("admin-job-toggle", {}, { ...context, page:"admin-jobs" }), false);
assert.equal(registry.handleAction("admin-audit-detail", { id:"0" }, { ...context, page:"admin-audit" }), true);
assert.equal(calls.modals.at(-1)[0], "操作详情");

console.log("Admin operations module checks passed.");
