"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainWorkOrders = require("../data/forms/main-work-orders.json");
const subprocesses = require("../data/forms/subprocesses.json");
const seed = require("../data/seed-data.json");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

const processingFieldNames = mainWorkOrders.work_orders.processing_fields.map(field => field.name);
assert(processingFieldNames.includes("救济途径是否告知"), "主单处理表单必须保留救济途径是否告知");
assert(!processingFieldNames.includes("救济途径"), "主单处理表单不得展示救济途径明细选项");
assert(processingFieldNames.includes("判断依据"), "主单投诉处理表单应展示投诉有效性判断依据");

const investigationFields = subprocesses.subprocesses.field_sections["投诉调查"]
  .flatMap(section => section.fields || [])
  .map(field => field.name);
assert(investigationFields.includes("无效投诉事由/有效投诉事由"), "投诉调查子单必须保留有效性变更原因");

Object.values(seed.documentData.tickets || {}).forEach(ticket => {
  assert.equal(Object.hasOwn(ticket.fields?.processing || {}, "救济途径"), false, "主单演示数据不得保存已删除的救济途径字段");
});

assert.match(
  source,
  /以下救济渠道：[^"]*①[^"]*②[^"]*③[^"]*④/,
  "办结短信模板必须继续默认包含四种救济途径"
);

console.log("Processing field rule checks passed.");
