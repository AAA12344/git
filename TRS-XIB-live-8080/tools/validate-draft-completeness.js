const fs = require("fs");
const path = require("path");

const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "seed-data.json"), "utf8"));
const errors = [];
const tickets = seed.lists?.tickets || [];
const subprocesses = seed.lists?.subprocesses || [];
const ticketDocuments = seed.documentData?.tickets || {};
const subprocessDocuments = seed.documentData?.subprocesses || {};
const requiredTicketEntryFields = [
  "工单编号",
  "建单时间",
  "工单类型",
  "客户姓名",
  "受理渠道",
  "接收时间",
  "联系方式",
  "涉及机构",
  "投诉/信访事项",
  "反馈内容",
  "派发机构",
  "派发部门",
  "工单接收机构"
];

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

function validateDraftMetadata(record, document, label, fieldGroups) {
  const metadata = document?.draftMetadata;
  if (!metadata) {
    errors.push(`${label} ${record.id} 缺少 draftMetadata`);
    return;
  }
  if (metadata.validationStatus === "通过") errors.push(`${label} ${record.id} 的草稿校验状态不应为通过`);
  if (!metadata.sourceType || !metadata.sourceReference) errors.push(`${label} ${record.id} 缺少结构化数据来源`);
  if (!metadata.missingFields?.length) errors.push(`${label} ${record.id} 未声明缺失字段`);
  if (!metadata.validationErrors?.length) errors.push(`${label} ${record.id} 未声明校验错误`);
  for (const field of metadata.missingFields || []) {
    const value = fieldGroups.map(group => group?.[field]).find(item => !isBlank(item));
    if (!isBlank(value)) errors.push(`${label} ${record.id} 声明缺失字段但实际有值：${field}`);
  }
}

for (const ticket of tickets) {
  const document = ticketDocuments[ticket.id];
  const entry = document?.fields?.entry || {};
  if (ticket.status === "草稿") {
    validateDraftMetadata(ticket, document, "工单草稿", [entry]);
    continue;
  }
  for (const field of requiredTicketEntryFields) {
    if (isBlank(entry[field])) errors.push(`已提交工单 ${ticket.id} 缺少必填字段：${field}`);
  }
  if (document?.draftMetadata && document.draftMetadata.validationStatus !== "通过") {
    errors.push(`非草稿工单 ${ticket.id} 仍保留未通过的草稿校验状态`);
  }
  if (ticket.type === "信访单") {
    if (isBlank(document?.dispositionDeadline)) errors.push(`已提交信访单 ${ticket.id} 缺少手工处置期限`);
    if (entry["处置期限"] !== document?.dispositionDeadline) errors.push(`信访单 ${ticket.id} 表单期限与详情期限不一致`);
  }
}

for (const record of subprocesses) {
  const document = subprocessDocuments[record.id];
  const base = document?.fields?.base || {};
  if (record.status === "草稿") {
    validateDraftMetadata(record, document, "子单草稿", [base, document?.fields?.entry || {}]);
    continue;
  }
  for (const field of ["子流程单编号", "关联工单编号", "申请时间"]) {
    if (isBlank(base[field])) errors.push(`已提交子单 ${record.id} 缺少基础字段：${field}`);
  }
  if (document?.draftMetadata && document.draftMetadata.validationStatus !== "通过") {
    errors.push(`非草稿子单 ${record.id} 仍保留未通过的草稿校验状态`);
  }
}

if (!tickets.some(item => item.status === "草稿")) errors.push("缺少工单草稿样例");
if (!subprocesses.some(item => item.status === "草稿")) errors.push("缺少子单草稿样例");

console.log(JSON.stringify({
  storageVersion: seed.meta?.storageVersion,
  ticketDrafts: tickets.filter(item => item.status === "草稿").map(item => item.id),
  subprocessDrafts: subprocesses.filter(item => item.status === "草稿").map(item => item.id),
  submittedPetitions: tickets.filter(item => item.type === "信访单" && item.status !== "草稿").map(item => ({
    id: item.id,
    deadline: ticketDocuments[item.id]?.dispositionDeadline
  })),
  errors
}, null, 2));

if (errors.length) process.exit(1);
