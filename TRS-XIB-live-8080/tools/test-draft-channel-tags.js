const assert = require("node:assert/strict");
const fs = require("node:fs");

const readJson = path => JSON.parse(fs.readFileSync(path, "utf8"));
const expectedBureaus = [
  "厦门金管局", "福建金管局", "珠海金管局", "北京金管局", "上海金管局", "宁德金管局",
  "龙岩金管局", "泉州金管局", "漳州金管局", "莆田金管局", "三明金管局", "南平金管局",
];

const schema = readJson("data/forms/main-work-orders.json").work_orders;
const complaintBureaus = schema.acceptance_channels["投诉单"].filter(value => value.endsWith("金管局"));
const petitionBureaus = schema.acceptance_channels["信访单"].filter(value => value.endsWith("金管局"));
assert.deepEqual(complaintBureaus, expectedBureaus);
assert.deepEqual(petitionBureaus, expectedBureaus);
assert.equal(JSON.stringify(schema).includes("属地金管局"), false);

const intelligentFields = schema.entry_sections.find(section => section.id === "intelligent-tags").fields;
const dictionaries = Object.fromEntries(intelligentFields.map(field => [field.name, field.dictionary]));
const intelligentSection = schema.entry_sections.find(section => section.id === "intelligent-tags");
const dispatchSection = schema.entry_sections.find(section => section.id === "intelligent-dispatch");
const contentSection = schema.entry_sections.find(section => section.id === "content");
const regulatorySection = schema.entry_sections.find(section => section.id === "regulatory");
const aiAction = intelligentFields.find(field => field.type === "aiAction");
assert.equal(intelligentSection.positionAfter, "content");
assert.deepEqual(aiAction.types, ["投诉单", "信访单"]);
assert.equal(intelligentFields[0].name, "AI 智能打标");
assert.equal(intelligentSection.titleBy["建议单"], "标签信息");
assert.equal(intelligentSection.titleBy["表扬单"], "标签信息");
assert.equal(dispatchSection.titleBy["建议单"], "派发信息");
assert.equal(dispatchSection.titleBy["表扬单"], "派发信息");
const subjectAppeal = contentSection.fields.find(field => field.name === "主体诉求");
assert.equal(contentSection.fields.at(-1).name, "主体诉求");
assert.equal(subjectAppeal.type, "textarea");
assert.equal(subjectAppeal.required, true);
assert.deepEqual(subjectAppeal.types, ["投诉单"]);
assert.equal(regulatorySection.fields.some(field => field.name === "主体诉求"), false);
assert.equal(dictionaries["业务办理渠道标签"], "trsBusinessChannel");
assert.equal(dictionaries["投诉产品标签"], "rectificationProduct");
assert.equal(dictionaries["投诉原因标签"], "rectificationCause");
assert.equal(dictionaries["投诉诉求标签"], "appealTag");
intelligentFields.filter(field => field.type !== "aiAction").forEach(field => assert.equal(field.type, "hierarchyCascader", `${field.name} should use cascader`));
assert.deepEqual(intelligentFields.find(field => field.name === "投诉产品标签").types, ["投诉单", "信访单", "建议单", "表扬单"]);
for (const name of ["业务办理渠道标签", "投诉原因标签", "投诉诉求标签"]) {
  assert.deepEqual(intelligentFields.find(field => field.name === name).types, ["投诉单", "信访单"]);
}

const tagTrees = readJson("data/tag-trees.json");
assert.ok(tagTrees.trsBusinessChannel.tree.some(node => node.label === "第三方合作渠道"));

const permissions = readJson("data/complaint-permission-rules.json");
permissions.rules.filter(rule => String(rule.tab || "").includes("草稿箱")).forEach(rule => {
  assert.deepEqual(rule.statuses, ["草稿"], `${rule.page}/${rule.tab} should contain drafts only`);
});

assert.equal(fs.readFileSync("data/seed-data.json", "utf8").includes("属地金管局"), false);
console.log("draft/channel/TRS contract: ok");
