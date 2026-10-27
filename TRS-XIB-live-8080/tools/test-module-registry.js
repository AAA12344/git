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
run("src/modules/consumer-review/index.js");
run("src/modules/education/index.js");
run("src/modules/notifications/data.js");
run("src/modules/notifications/index.js");

const registry = sandbox.window.XIBModuleRegistry;
assert.ok(registry, "module registry is exposed");
assert.equal(registry.hasRoute("review-manage"), true);
assert.equal(registry.hasRoute("education-manage"), true);
assert.equal(registry.hasRoute("notice-complaint"), true);
assert.equal(registry.hasRoute("notice-review"), true);
assert.equal(registry.hasRoute("notice-center"), false);
assert.equal(registry.hasRoute("unknown-route"), false);
assert.deepEqual(
  JSON.parse(JSON.stringify(registry.list())),
  [
    { name: "consumer-review", routes: ["review-manage"] },
    { name: "education", routes: ["education-manage"] },
    { name: "notifications", routes: ["notice-complaint", "notice-review"] }
  ]
);

const context = {
  pageMeta: {
    "notice-complaint": { title: "投诉管理通知", group: "通知中心" },
    "notice-review": { title: "消保审查通知", group: "通知中心" }
  },
  pageHeader: (title, subtitle) => `<header><h1>${title}</h1><p>${subtitle}</p></header>`
};
const complaintHtml = registry.render("notice-complaint", context);
const reviewHtml = registry.render("notice-review", context);

assert.match(complaintHtml, /xib-module-notifications/);
assert.match(complaintHtml, /投诉管理通知/);
assert.match(reviewHtml, /消保审查通知/);
assert.equal(registry.render("unknown-route", {}), null);
const emptyRoot = { matches: () => false, querySelector: () => null };
assert.equal(registry.afterRender(emptyRoot, "notice-complaint", {}), true);
assert.equal(registry.handleAction("noop", {}, { page: "notice-complaint" }), false);

let resetCalls = 0;
registry.register({ name: "resettable", routes: ["resettable-page"], render: () => "<section></section>", reset: (page, hookContext) => { resetCalls += 1; assert.equal(page, "resettable-page"); assert.equal(hookContext.moduleName, "resettable"); } });
assert.equal(registry.reset("resettable-page", {}), true);
assert.equal(resetCalls, 1);
assert.equal(registry.reset("unknown-route", {}), false);

assert.throws(() => {
  registry.register({
    name: "duplicate-route",
    routes: ["notice-review"],
    render: () => ""
  });
}, /already owned/);

console.log("Module registry checks passed.");
