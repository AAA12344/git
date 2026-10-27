const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const filename = path.resolve(__dirname, "..", "src", "core", "app-config.js");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(filename, "utf8"), sandbox, { filename });

const config = sandbox.window.XIB_APP_CONFIG;
assert.ok(config, "app config is exposed");
assert.equal(config.version, "1.0.0");
assert.equal(config.routeIds.length, 40, "all visible navigation and detail routes are declared");
assert.equal(Object.keys(config.pageMeta).length, 47, "navigation and detail metadata are declared");
assert.deepEqual(
  JSON.parse(JSON.stringify(config.routeAliases)),
  {
    "admin-permission-admin": "admin-permission",
    "admin-permission-biz": "admin-permission",
    "admin-permission-review": "admin-permission"
  },
  "legacy permission routes redirect to the unified role-permission page"
);
assert.equal(config.pageMeta["analysis-report-detail"].subgroupId, "reports");
assert.equal(config.pageMeta["analysis-warning-detail"].subgroupId, "inspection-warning");
assert.equal(config.orgRoleOptions.flatMap(org => org.roles).length, 26, "all role profiles are declared");
assert.deepEqual(
  JSON.parse(JSON.stringify(config.permissions.developer)),
  JSON.parse(JSON.stringify(config.routeIds)),
  "developer access follows the complete navigation tree"
);
assert.equal(config.pageMeta["ticket-detail"].subgroupId, "ticket");
assert.equal(config.pageMeta["home-tasks"].title, "待办消息");
assert.equal(config.pageMeta.overview.title, "首页");
assert.equal(config.navigation.find(item => item.id === "home").page, "overview");
assert.equal(config.navigation.find(item => item.id === "home").children, undefined, "home is a direct dashboard entry");
const adminMenuIds = config.navigation.find(item => item.id === "admin").children.map(item => item.id);
assert.ok(!adminMenuIds.includes("admin-form-config"), "form configuration group is removed");
assert.ok(adminMenuIds.includes("admin-form-dictionary"), "dictionary management is a second-level menu");
assert.ok(adminMenuIds.includes("admin-form-sms"), "SMS template management is a second-level menu");
assert.ok(config.permissions.admin.includes("admin-form-review"), "legacy review form route remains available for compatible direct links");
assert.equal(config.navigation.find(item => item.id === "complaint").children[0].id, "home-tasks", "task inbox is the first complaint section");
assert.equal(config.pageMeta["home-tasks"].groupId, "complaint");
const noticeNavigation = config.navigation.find(item => item.id === "notice");
assert.equal(noticeNavigation.page, undefined, "notification center is a navigation group");
assert.deepEqual(
  JSON.parse(JSON.stringify(noticeNavigation.children.map(item => [item.page,item.label]))),
  JSON.parse(JSON.stringify([["notice-complaint","投诉管理通知"],["notice-review","消保审查通知"]]))
);
assert.equal(config.pageMeta["notice-complaint"].title, "投诉管理通知");
assert.equal(config.pageMeta["notice-review"].title, "消保审查通知");
assert.deepEqual(
  JSON.parse(JSON.stringify(config.orgRoleOptions.find(org => org.id === "development").roles.map(profile => profile.taskInboxRole))),
  JSON.parse(JSON.stringify(["developer", "operator", "handler", "approver", "reviewer", "analyst"]))
);
assert.equal(config.permissions.admin.includes("user-manage"), true, "legacy admin alias remains available");
assert.equal(Object.isFrozen(config), true);
assert.equal(Object.isFrozen(config.navigation), true);
assert.equal(Object.isFrozen(config.orgRoleOptions[0].roles), true);

console.log("App configuration checks passed.");
