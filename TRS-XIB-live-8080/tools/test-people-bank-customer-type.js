const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
assert.match(source, /const PEOPLE_BANK_TABLES = \{/u, "缺少按客户类型划分的人行标签枚举");
assert.match(source, /function peopleBankCascaderSource\(sourceKey/u, "缺少人行标签数据源切换规则");
assert.match(source, /function activeCustomerType\(\) \{\s*return state\.formValues\["customer\.1\.客户类型"\] \|\| state\.formValues\["客户类型"\] \|\| "";/u, "未读取主单第一位客户的真实客户类型字段");
assert.match(source, /function isOrganizationCustomerType\(value = activeCustomerType\(\)\)/u, "缺少统一的非自然人判断规则");
assert.match(source, /return isOrganizationCustomerType\(\) \? table\.organization : table\.natural/u, "非自然人未切换到独立人行标签枚举");
assert.match(source, /if \(linkedName === "客户类型"\) \{\s*resetPeopleBankTagsAfterCustomerTypeChange\(\);\s*rerenderPage\(\);/u, "客户类型下拉框变更后未刷新人行标签枚举");
assert.match(source, /02010\|信用贷款/u, "非自然人业务类别缺少信用贷款");
assert.match(source, /02010\|个人住房贷款/u, "自然人业务类别缺少个人住房贷款");
assert.match(source, /if \(!String\(activeCustomerType\(\)\)\.trim\(\)\)/u, "AI 智能打标未校验客户类型必填");
assert.match(source, /请先填写：客户类型/u, "AI 智能打标缺少客户类型必填提示");
const smartClassifySource = source.slice(
  source.indexOf("function smartClassify()"),
  source.indexOf("function resetImportJob()")
);
assert.doesNotMatch(smartClassifySource, /openModal\("AI 智能打标结果"/u, "AI 智能打标不应再弹出结果确认框");
assert.match(smartClassifySource, /state\.aiClassificationReady = true;\s*rerenderPage\(\);/u, "AI 智能打标应直接回填并刷新页面");
assert.match(source, /organizationCustomer \? "Z-01 前台业务渠道/u, "主单详情未按非自然人回显 Z 类渠道");
assert.match(source, /organizationCustomer \? "Y-02 贷款 \/ Y-0201 信用贷款/u, "主单详情未按非自然人回显 Y 类业务");
assert.match(source, /organizationCustomer \? "X-03 金融机构管理制度、业务规则与流程/u, "主单详情未按非自然人回显 X 类原因");
console.log("客户类型与人行标签联动规则检查通过");
