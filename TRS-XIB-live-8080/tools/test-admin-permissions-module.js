"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const sandbox = { window: { XIB_APP_CONFIG: { navigation: [
  { label: "首页" },
  { label: "投诉管理", children: [{ label: "工单管理", children: [{ label: "工单创建" }] }] },
  { label: "后台管理", children: [{ label: "权限管理" }] }
] } } };
vm.createContext(sandbox);
const run = relativePath => vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), sandbox, { filename:relativePath });
run("src/core/module-registry.js");
run("src/modules/admin/permissions/data.js");
run("src/modules/admin/permissions/index.js");

const permissionSource = fs.readFileSync(path.join(root, "src/modules/admin/permissions/index.js"), "utf8");
assert.doesNotMatch(permissionSource, /\.typeName\b/, "permission module must derive organization names from type codes");
assert.match(permissionSource, /"304903": "一级分行"/, "organization type dictionary is incomplete");
const data = sandbox.window.XIB_ADMIN_PERMISSIONS_DATA;
assert.equal(data.adminRoles.length, 2);
assert.equal(data.businessRoles.length, 17);
assert.equal(data.businessRoles.filter(role => role.name === "审批员").length, 6);

const registry = sandbox.window.XIBModuleRegistry;
let rerenders = 0;
const context = {
  page: "admin-permission",
  pageHeader: (title, subtitle, actions = "") => `<header><h1>${title}</h1><p>${subtitle}</p>${actions}</header>`,
  renderPagination: count => `<footer data-count="${count}"></footer>`,
  statusTag: text => `<mark>${text}</mark>`,
  rerenderPage: () => { rerenders += 1; }
};

assert.equal(registry.render("admin-permission-admin", context), null, "旧权限子路由不应由模块重复注册");
const adminList = registry.render("admin-permission", context);
assert.match(adminList, /data-module="admin-permissions"/);
assert.match(adminList, /角色权限管理/);
["系统管理", "消保审查", "消保投诉", "智能审查"].forEach(label => assert.match(adminList, new RegExp(label)));
assert.match(adminList, /data-action="admin-role-create"[^>]*>新增<\/button>/);
["角色", "更新时间", "状态", "操作"].forEach(label => assert.match(adminList, new RegExp("<th>" + label + "<\\/th>")));
assert.match(adminList, /data-action="admin-role-toggle"/);
assert.match(adminList, /编辑权限/);
assert.match(adminList, /data-count="2"/);
assert.doesNotMatch(adminList, /关联用户数/);

assert.equal(registry.handleAction("admin-perm-tab", { id:"biz" }, context), true);
const businessList = registry.render("admin-permission", context);
assert.match(businessList, /处理员（总行消保）/);
assert.match(businessList, /处理员（分行消保）/);
assert.match(businessList, /经办员（客服中心）/);
assert.match(businessList, /data-count="22"/);
assert.equal((businessList.match(/<tr><td>/g) || []).length, 10);
assert.equal(registry.handleAction("admin-permission-page", { id:"3" }, context), true);
assert.match(registry.render("admin-permission", context), /查询员（总行）|查询员（分行）/);

assert.equal(registry.handleAction("admin-role-edit", { id:"bizrow:processor-2" }, context), true);
const systemRoleDialog = registry.render("admin-permission", context);
assert.match(systemRoleDialog, /修改角色/);
assert.match(systemRoleDialog, /data-admin-role-field="name"/);
assert.match(systemRoleDialog, /data-admin-save-role-config/);
assert.doesNotMatch(systemRoleDialog, /审计信息/);
assert.equal(registry.handleAction("admin-role-list", {}, context), true);

assert.equal(registry.handleAction("admin-role-create", {}, context), true);
const newRoleDialog = registry.render("admin-permission", context);
assert.match(newRoleDialog, /添加角色/);
assert.match(newRoleDialog, /data-admin-role-field="name"/);
assert.match(newRoleDialog, /data-admin-role-field="code"/);
assert.match(newRoleDialog, /data-admin-role-field="exportScope"/);
assert.match(newRoleDialog, /data-admin-save-role-config/);
assert.doesNotMatch(newRoleDialog, /data-admin-menu-permission="[^"]*"[^>]* disabled/);
assert.equal(registry.handleAction("admin-role-list", {}, context), true);

assert.equal(registry.handleAction("admin-perm-tab", { id:"review" }, context), true);
assert.match(registry.render("admin-permission", context), /消保审查/);
assert.equal(registry.handleAction("admin-perm-tab", { id:"intelligent" }, context), true);
const intelligentList = registry.render("admin-permission", context);
assert.match(intelligentList, /智能审查/);
assert.match(intelligentList, /data-count="0"/);
assert.match(intelligentList, /data-action="admin-role-create"/);

const userConfigContext = { ...context, state:{ formValues:{} }, renderHierarchyCascaderControl:(id, field, key) => '<div data-test-dictionary="' + field.dictionary + '" data-test-key="' + key + '"></div>' };
const userConfig = sandbox.window.XIB_ADMIN_USER_CONFIG_VIEW.render(userConfigContext);
assert.match(userConfig, /data-test-dictionary="userOrganizationTree"/);
assert.match(userConfig, /投诉管理角色/);
assert.match(userConfig, /消保审查角色/);
assert.match(userConfig, /data-admin-user-complaint-role="审批员"/);
assert.match(userConfig, /data-admin-user-review-role="审批员"/);
assert.doesNotMatch(userConfig, /角色1|角色2|角色3/);
assert.match(permissionSource, /"head-consumer": \["超级管理员", "普通管理员", "业务员", "审批员", "处理员", "经办员"\]/);
assert.match(permissionSource, /"head-dept": \["审批员", "处理员"\]/);
assert.match(permissionSource, /"branch-consumer": \["普通管理员", "业务员", "审批员", "处理员", "经办员"\]/);
assert.match(permissionSource, /"branch-dept": \["审批员", "处理员"\]/);
assert.match(permissionSource, /"branch-unit": \["业务员", "审批员", "处理员", "经办员"\]/);
assert.match(permissionSource, /"service-center": \["业务员", "处理员", "复核员", "经办员"\]/);
assert.ok(rerenders >= 7, "权限页签、分页和角色弹窗操作必须触发页面刷新");
console.log("Admin permissions module checks passed.");
