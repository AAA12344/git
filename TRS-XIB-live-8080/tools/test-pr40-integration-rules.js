const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

assert.match(source, /function renderAiTagRecommendationBox\(/, "应保留 PR #40 的智能标签推荐区");
assert.match(source, /data-ai-tag-main-edit=/, "应保留 PR #40 的人工下拉选择入口");
assert.doesNotMatch(source, /class="ai-tag-add"/, "不应恢复已删除的加号按钮");
assert.match(source, /data-ai-tag-move=/, "智能标签仍应支持按重要性调整顺序");
assert.match(source, /state\.aiTagSources\[key\]/, "应保留模型与人工标签来源状态");
assert.match(source, /state\.aiTagSources = tagSources/, "再次打标后应同步更新标签来源");
assert.match(source, /previousSources\[index\] && previousSources\[index\] !== ['"]模型返回['"]/, "再次打标不得覆盖人工标签，首次打标也不得保留无来源的演示默认值");

assert.match(
  source,
  /approvalScope === ['"]机构工单池['"][^]*?\['待审批', '审批中'\]\.includes\(status\)[^]*?poolActions\.unshift\(actionDef\('approve'/,
  "机构工单池待审批、审批中工单应保留审批入口"
);
assert.match(source, /const showDetailAction = \['工单审批', '子流程审批'\]\.includes\(row\?\.\[1\]\)/);
assert.match(source, /showDetailAction \? \[actionDef\('view'/, "短信和导出审批不应显示查看，工单和子流程审批应保留查看");

console.log("PR #40 integration rules passed.");
