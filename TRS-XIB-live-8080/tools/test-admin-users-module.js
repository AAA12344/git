"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sandbox = { window: { XIB_PROTOTYPE_CONFIG: { organizationTree: { organizations: [
  { id: "000100011001", name: "总行" },
  { id: "000100012004", name: "福州分行" }
] } } } };
sandbox.window.XIB_APP_CONFIG = { navigation: [
  { label: "首页" },
  { label: "后台管理", children: [{ label: "用户管理" }, { label: "权限管理" }] }
] };
vm.createContext(sandbox);
const run = relativePath => vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), sandbox, { filename: relativePath });

run("src/core/module-registry.js");
run("src/modules/admin/users/data.js");
run("src/modules/admin/permissions/data.js");
run("src/modules/admin/permissions/index.js");
run("src/modules/admin/users/index.js");

const data = sandbox.window.XIB_ADMIN_USERS_DATA;
const expectedUserCount = data.users.length;
assert.ok(expectedUserCount >= 22, "用户主数据应保留原有人员并包含分行消保业务员样例");
assert.equal(data.users[0].user_empno, "XIB0001");
assert.equal(data.users.find(user => user.id === "U015")?.office_code, "000100012003307000003003");
const activeBusinessUsers = data.users.filter(user => user.job_title === "业务员" && user.user_status === "1" && user.hr_user_status === "在职");
assert.ok(activeBusinessUsers.length >= 7);
assert.equal(activeBusinessUsers.filter(user => user.dept_code === "0001000120032036").map(user => user.user_name).join("、"), "苏晴、林雪");
assert.equal(data.users.some(user => "center_code" in user), false);
assert.equal(Object.isFrozen(data.users), true);

const registry = sandbox.window.XIBModuleRegistry;
let rerenders = 0;
const context = {
  pageHeader: (title, subtitle, actions = "") => `<header><h1>${title}</h1><p>${subtitle}</p>${actions}</header>`,
  renderFilters: () => '<div class="filter-panel ticket-filter-panel"></div>',
  renderPagination: count => `<footer data-count="${count}"></footer>`,
  statusTag: text => `<mark>${text}</mark>`,
  rerenderPage: () => { rerenders += 1; }
};

const list = registry.render("admin-user", context);
assert.match(list, /data-module="admin-users"/);
assert.match(list, /福州分行/);
assert.match(list, new RegExp(`data-count="${expectedUserCount}"`));
assert.equal((list.match(/admin-user-detail/g) || []).length, expectedUserCount);
assert.match(list, /data-action="admin-users-tab" data-id="all"/);
assert.match(list, /data-action="admin-users-tab" data-id="config"/);
assert.match(list, /admin\.users\.orgRange/);
assert.match(list, />机构范围</);
assert.match(list, />状态</);
assert.match(list, />角色</);
assert.match(list, />姓名</);
assert.match(list, />工号</);
assert.match(list, />机构</);
assert.doesNotMatch(list, />登录账号</);
assert.doesNotMatch(list, />已配置角色</);
assert.doesNotMatch(list, />岗位</);
assert.doesNotMatch(list, />手机号</);
assert.match(list, /超级管理员/);
assert.match(list, /经办员/);
assert.match(list, />部门</);
assert.match(registry.render("user-manage", context), /用户管理/);

assert.equal(registry.handleAction("admin-user-detail", { id: "U008" }, { ...context, page: "admin-user" }), true);
assert.equal(rerenders, 1);
const detail = registry.render("admin-user", context);
assert.match(detail, /<h1>用户详情<\/h1>/);
assert.match(detail, /detail-descriptions admin-detail-descriptions/);
assert.match(detail, /登录账号/);
assert.match(detail, /机构归属信息/);
assert.match(detail, /组织路径/);
assert.match(detail, /福州分行/);
assert.doesNotMatch(detail, /<span>中心编码<\/span>/);

assert.equal(registry.handleAction("admin-user-list", {}, { ...context, page: "admin-user" }), true);
assert.equal(rerenders, 2);
assert.match(registry.render("admin-user", context), new RegExp(`data-count="${expectedUserCount}"`));
assert.equal(registry.handleAction("admin-users-tab", { id: "config" }, { ...context, page: "admin-user" }), true);
assert.equal(rerenders, 3);
const userConfig = registry.render("admin-user", context);
assert.match(userConfig, /data-admin-user-role-panel/);
assert.match(userConfig, /data-admin-save-user-config/);
assert.match(userConfig, /admin\.permission\.userOrgPath/);
assert.match(userConfig, /admin-permission-user-layout/);
assert.doesNotMatch(userConfig, /data-action="admin-select-user"/);
console.log("Admin users module checks passed.");
