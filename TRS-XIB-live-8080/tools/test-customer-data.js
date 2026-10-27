"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { create } = require("../src/modules/complaints/customer-repository");

const root = path.resolve(__dirname, "..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const customerData = readJson("data/customers.json");
const seedData = readJson("data/seed-data.json");
const mainWorkOrderSchema = readJson("data/forms/main-work-orders.json");
const repository = create(customerData);
const customers = repository.all();
const byId = new Map(customers.map(customer => [customer.id, customer]));
const tickets = seedData.lists?.tickets || [];
const documents = seedData.documentData?.tickets || {};

assert.equal(new Set(customers.map(customer => customer.id)).size, customers.length, "客户编号必须唯一");
assert(!seedData.lists?.customerHistory, "旧 customerHistory 模板数据必须移除");
const workOrderTypeField = mainWorkOrderSchema.work_orders.entry_sections.flatMap(section => section.fields).find(field => field.type === "workOrderType");
assert(workOrderTypeField && !workOrderTypeField.options.includes("舆情单"), "新建工单类型选项仍包含已下线舆情单");
assert(!fs.readFileSync(path.join(root, "src/modules/admin/form-config/data.js"), "utf8").includes('["舆情单", "工单"'), "后台表单配置仍展示舆情单");
assert(customers.some(customer => customer.type === "单位客户"), "缺少单位客户边界样例");
assert(customers.some(customer => customer.status === "资料待补全"), "缺少资料不完整客户边界样例");
assert(customers.some(customer => customer.status === "身份未核实" && !customer.identity), "缺少匿名/身份未核实客户边界样例");

for (const customer of customers) {
  assert(customer.id && customer.name && customer.type && customer.status, `客户主数据必填字段不完整：${customer.id || "-"}`);
  if (customer.mergedIntoCustomerId) {
    assert(byId.has(customer.mergedIntoCustomerId), `历史客户 ${customer.id} 合并目标不存在`);
    assert.notEqual(customer.mergedIntoCustomerId, customer.id, `历史客户 ${customer.id} 不能合并到自身`);
  }
}

let linkedTicketCount = 0;
for (const ticket of tickets) {
  const document = documents[ticket.id];
  assert(document, `工单 ${ticket.id} 缺少完整记录`);
  const entry = document.fields?.entry || {};
  const customerNo = entry["客户编号"];
  if (ticket.status === "草稿" && !customerNo) continue;
  const customer = byId.get(customerNo);
  assert(customer, `工单 ${ticket.id} 引用了不存在的客户编号：${customerNo || "-"}`);
  linkedTicketCount += 1;
  if (ticket.status === "草稿") continue;
  assert.equal(ticket.customer, customer.name, `工单列表 ${ticket.id} 的客户姓名与客户主数据不一致`);
  assert.equal(entry["客户姓名"], customer.name, `工单详情 ${ticket.id} 的客户姓名与客户主数据不一致`);
  assert.equal(entry["证件类型"] || "", customer.identity?.type || "", `工单 ${ticket.id} 的证件类型与客户主数据不一致`);
  assert.equal(entry["证件号码"] || "", customer.identity?.number || "", `工单 ${ticket.id} 的证件号码与客户主数据不一致`);
  assert.equal(entry["预留手机号码"] || "", customer.contact?.mobile || "", `工单 ${ticket.id} 的手机号与客户主数据不一致`);
}

const sameDocumentCustomers = repository.find({ documentNo:"350203198807180628" });
assert.deepEqual(sameDocumentCustomers.map(customer => customer.id), ["C202607000001", "C201912050118"], "同证件历史客户查询结果或排序不正确");
assert.equal(repository.canonicalId("C201912050118"), "C202607000001", "历史客户未解析到统一客户编号");
assert.equal(repository.find({ customerNo:"C202608000100" })[0]?.type, "单位客户", "单位客户无法按客户编号查询");
assert.equal(repository.toFormFields(repository.get("C202608000099"))["居住地 省/市/区"], "", "境外资料不完整客户不应伪造居住地");
assert.equal(repository.toFormFields(repository.get("ANON2026080001"))["证件号码"], "", "匿名客户不应伪造证件号码");

const historyCounts = new Map();
for (const ticket of tickets) {
  const document = documents[ticket.id];
  const customerId = repository.canonicalId(repository.customerIdFromTicket([], document));
  if (customerId && ticket.status === "已办结") historyCounts.set(customerId, (historyCounts.get(customerId) || 0) + 1);
}
assert((historyCounts.get("C202607000001") || 0) === 4, "陈晓敏应包含跨年度且覆盖三级路径的四笔已办结历史");
assert((historyCounts.get("C202607000007") || 0) === 4, "张女士应包含当前已办结工单及三笔历史工单");
assert((historyCounts.get("C202608000013") || 0) === 4, "黄先生应包含覆盖三级路径的四笔已办结历史");
assert((historyCounts.get("C202607000006") || 0) === 2, "缺少同一客户多笔已办结工单样例");
const expectedPathSamples = {
  TS202501100201:"金融消费者保护服务平台",
  TS202509150202:"厦门金管局",
  TS202603120203:"福建金管局",
  TS202501050221:"营业网点",
  TS202507110222:"金融消费者保护服务平台",
  TS202605170223:"泉州金管局"
};
for (const [ticketId, channel] of Object.entries(expectedPathSamples)) {
  assert.equal(documents[ticketId]?.fields?.entry?.["受理渠道"], channel, `三级路径样例 ${ticketId} 渠道不正确`);
  assert.equal(tickets.find(ticket => ticket.id === ticketId)?.status, "已办结", `三级路径样例 ${ticketId} 必须为已办结`);
}

console.log(JSON.stringify({
  ok:true,
  schemaVersion:repository.schemaVersion,
  customers:customers.length,
  linkedTickets:linkedTicketCount,
  edgeCases:["同证件历史客户", "跨年度已办结历史", "三级路径多历史工单", "单位客户", "境外资料待补全", "匿名客户", "无历史工单", "多笔监管投诉"]
}, null, 2));
