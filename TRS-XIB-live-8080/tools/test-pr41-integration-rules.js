const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const subprocessConfig = JSON.parse(fs.readFileSync(path.join(root, "data", "forms", "subprocesses.json"), "utf8")).subprocesses;
const mainWorkOrders = JSON.parse(fs.readFileSync(path.join(root, "data", "forms", "main-work-orders.json"), "utf8")).work_orders;
const seed = JSON.parse(fs.readFileSync(path.join(root, "data", "seed-data.json"), "utf8"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const adminConfigSource = fs.readFileSync(path.join(root, "src", "modules", "admin", "form-config", "data.js"), "utf8");

const fieldsFor = type => (subprocessConfig.field_sections[type] || []).flatMap(section => section.fields || []);
const processingFields = mainWorkOrders.processing_fields || [];
const processingNames = processingFields.map(field => field.name);

assert(processingNames.includes("救济途径是否告知"), "主单处理应保留救济途径是否告知");
assert(!processingNames.includes("救济途径"), "主单处理不得恢复四项救济途径字段");
assert(processingNames.includes("判断依据"), "主单投诉处理应包含判断依据");

const abnormalFields = fieldsFor("异常投诉");
const abnormalType = abnormalFields.find(field => field.name === "异常投诉类型");
const manifestation = abnormalFields.find(field => field.name === "异常投诉具体表现");
const evidence = abnormalFields.find(field => field.name === "必要证据要求");
assert.equal(abnormalType?.options?.length, 3, "异常投诉类型应有三类");
assert.equal(manifestation?.options?.length, 11, "异常投诉具体表现应有十一项");
assert.equal(Object.keys(evidence?.valueMap?.values || {}).length, 11, "十一项表现均应映射必要证据要求");
assert.equal(manifestation?.autoSelectSingleOption, true, "只有一个具体表现时应自动选中");
assert(abnormalType.options.every(option => option.includes("存在")), "异常投诉三类应使用完整业务表述");
for (const option of abnormalType.options) assert(adminConfigSource.includes(JSON.stringify(option)), `后台表单配置缺少异常投诉类型：${option}`);
for (const name of ["异常投诉认定依据", "报告摘要"]) {
  const field = abnormalFields.find(item => item.name === name);
  assert.equal(field?.max, 2000, `${name}应限制为2000字`);
}

for (const [type, fieldName] of [["剔除申请", "剔除原因"], ["异议核查", "核查内容"], ["废止申请", "废止原因"]]) {
  assert.equal(fieldsFor(type).find(field => field.name === fieldName)?.max, 2000, `${type}${fieldName}应限制为2000字`);
}

const requiredSampleIds = [
  "JZ202610210001", "DC202610210001", "YC202610210001", "YT202610210001", "JF202610210001"
];
const subprocessIds = new Set((seed.lists?.subprocesses || []).map(row => row.id || row[0]));
const subprocessDetailIds = new Set(Object.keys(seed.documentData?.subprocesses || {}));
for (const id of requiredSampleIds) {
  assert(subprocessIds.has(id), `子流程列表缺少节点样例 ${id}`);
  assert(subprocessDetailIds.has(id), `子流程详情缺少节点样例 ${id}`);
}

assert(appSource.includes("function syncSeedSubprocessExamples"), "旧浏览器数据应增量补入新的子流程节点样例");
assert(appSource.includes("field.autoSelectSingleOption && options.length === 1"), "唯一的异常投诉具体表现应自动选择");
assert(appSource.includes('dependency === "异常投诉类型" && scopedValue'), "旧版异常投诉类型应映射到完整新枚举");
assert(appSource.includes('["异常投诉类型", "异常投诉具体表现"].includes(field.name) && current'), "旧版异常投诉具体表现应映射到完整新枚举");
assert(/subprocessDifferenceSections\(definition,\s*definition\.type === ["']异常投诉["'] \? ["']create["'] : ["']process["']\)/.test(appSource), "异常投诉处理阶段应复用创建表单字段");

console.log("PR41 integration rules validated");
