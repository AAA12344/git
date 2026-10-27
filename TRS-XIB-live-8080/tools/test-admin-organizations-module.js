"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sandbox = { window: {} };
vm.createContext(sandbox);
const run = relativePath => vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), sandbox, { filename: relativePath });

run("data/prototype-data.runtime.js");
run("src/core/module-registry.js");
run("src/modules/admin/organizations/index.js");

const organizations = sandbox.window.XIB_PROTOTYPE_CONFIG.organizationTree.organizations;
assert.equal(organizations.length, 1221);
assert.equal(organizations.filter(item => !item.parentId).length, 1);
assert.equal(organizations.some(item => "typeName" in item || "typeShort" in item || "depth" in item || "dataScope" in item || "deletable" in item), false);

const registry = sandbox.window.XIBModuleRegistry;
let rerenders = 0;
const context = {
  pageHeader: (title, subtitle, actions = "") => `<header><h1>${title}</h1><p>${subtitle}</p>${actions}</header>`,
  renderPagination: count => `<footer data-count="${count}"></footer>`,
  statusTag: text => `<mark>${text}</mark>`,
  rerenderPage: () => { rerenders += 1; }
};

const initial = registry.render("admin-org", context);
assert.match(initial, /data-module="admin-organizations"/);
assert.match(initial, /共 1221 个机构/);
assert.match(initial, /授信审批部/);
assert.match(initial, /厦门国际银行股份有限公司集团/);
assert.match(initial, /组织编码/);
assert.match(initial, /组织编号路径/);
assert.match(initial, /组织负责人A角/);

assert.equal(registry.handleAction("admin-select-org", { id: "0001000110011012" }, { ...context, page: "admin-org" }), true);
const selectedDetail = registry.render("admin-org", context);
assert.match(selectedDetail, /<span class="panel-title">零售金融部<\/span>/);
assert.match(selectedDetail, /detail-descriptions admin-detail-descriptions/);
assert.match(selectedDetail, /组织名称路径/);

const values = { "#admin-org-filter-name": "零售金融部", "#admin-org-filter-code": "", "#admin-org-filter-depth": "" };
const trigger = { closest: () => ({ querySelector: selector => ({ value: values[selector] }) }) };
assert.equal(registry.handleAction("admin-org-search", { trigger }, { ...context, page: "admin-org" }), true);
const filtered = registry.render("admin-org", context);
assert.match(filtered, /共 6 个机构/);
assert.match(filtered, /零售金融部/);

assert.equal(registry.handleAction("admin-org-collapse-all", {}, { ...context, page: "admin-org" }), true);
assert.match(registry.render("admin-org", context), /aria-expanded="false"/);
assert.equal(registry.handleAction("admin-org-reset", {}, { ...context, page: "admin-org" }), true);
assert.match(registry.render("admin-org", context), /共 1221 个机构/);
assert.equal(rerenders, 4);

let toggleListener;
const toggle = { dataset: { adminOrgToggle: "0001" }, addEventListener: (name, listener) => { if (name === "click") toggleListener = listener; } };
registry.afterRender({ querySelectorAll: () => [toggle] }, "admin-org", context);
toggleListener({ stopPropagation() {} });
assert.equal(rerenders, 5);

console.log("Admin organizations module checks passed.");
