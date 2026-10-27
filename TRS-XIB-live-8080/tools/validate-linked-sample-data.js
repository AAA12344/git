const fs = require("fs");
const path = require("path");

const dataDir = path.resolve(__dirname, "..", "data");
const readJson = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
const seed = readJson("seed-data.json");
const workflow = readJson("workflow-schema.json");
const complaintPermissions = readJson("complaint-permission-rules.json");
const errors = [];
const lists = seed.lists || {};
const tickets = lists.tickets || [];
const subprocesses = lists.subprocesses || [];
const rectifications = lists.rectifications || [];
const approvals = lists.approvals || [];
const exportRequests = lists.exportRequests || [];
const ticketById = new Map(tickets.map(item => [item.id, item]));
const subprocessById = new Map(subprocesses.map(item => [item.id, item]));
const exportById = new Map(exportRequests.map(item => [item.id, item]));
const exportRequestTypes = ["工单", "子单", "溯源整改单", "报表"];
const prototypeDatePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function checkStatusCoverage(kind, records) {
  const expected = workflow.documentStateMachines?.[kind]?.statuses || [];
  const actual = new Set(records.map(item => item.status));
  for (const status of expected) {
    if (!actual.has(status)) errors.push(`${kind} 样例缺少状态：${status}`);
  }
}

checkStatusCoverage("ticket", tickets);
checkStatusCoverage("subprocess", subprocesses);
checkStatusCoverage("rectification", rectifications);

for (const item of subprocesses) {
  const ticket = ticketById.get(item.relatedTicketId);
  if (!ticket) errors.push(`子流程 ${item.id} 关联主工单不存在：${item.relatedTicketId}`);
  else if (item.customer !== ticket.customer) errors.push(`子流程 ${item.id} 客户与主工单不一致：${item.customer}/${ticket.customer}`);
}
let multiSubprocessSamples = 0;
for (const item of subprocesses) {
  const detail = seed.documentData?.subprocesses?.[item.id];
  const detailIds = [...new Set((detail?.relatedTicketIds || []).filter(Boolean))];
  if (!detailIds.length || detailIds[0] !== item.relatedTicketId) errors.push(`子流程 ${item.id} 详情关联工单未以列表主工单开头`);
  if (detailIds.length > 1) multiSubprocessSamples += 1;
  for (const id of detailIds) if (!ticketById.has(id)) errors.push(`子流程 ${item.id} 详情关联工单不存在：${id}`);
  const baseIds = String(detail?.fields?.base?.["关联工单编号"] || "").split(/[、,，]/).map(value => value.trim()).filter(Boolean);
  if (JSON.stringify(baseIds) !== JSON.stringify(detailIds)) errors.push(`子流程 ${item.id} 基础信息与结构化关联工单不一致`);
}
if (multiSubprocessSamples < 1) errors.push("子流程样例缺少多关联工单详情场景");
const subprocessRelationCounts = subprocesses.reduce((counts, item) => counts.set(item.relatedTicketId, (counts.get(item.relatedTicketId) || 0) + 1), new Map());
if (subprocessRelationCounts.size < 5) errors.push("子流程样例过度集中，至少应分布到 5 个主工单");
if (Math.max(...subprocessRelationCounts.values()) > Math.ceil(subprocesses.length / 3)) errors.push("单个主工单关联了过多子流程样例");
for (const item of rectifications) {
  if (!item.relatedTicketIds?.length) errors.push(`溯源整改单 ${item.id} 未关联工单`);
  for (const id of item.relatedTicketIds || []) {
    if (!ticketById.has(id)) errors.push(`溯源整改单 ${item.id} 关联工单不存在：${id}`);
  }
}
let multiRectificationSamples = 0;
for (const item of rectifications) {
  if ((item.relatedTicketIds || []).length > 1) multiRectificationSamples += 1;
  const detail = seed.documentData?.rectifications?.[item.id];
  const detailIds = detail?.relatedTicketIds || [];
  const entryIds = detail?.fields?.entry?.["关联工单编号"] || [];
  if (JSON.stringify(detailIds) !== JSON.stringify(item.relatedTicketIds || [])) errors.push(`溯源整改单 ${item.id} 列表与详情关联工单不一致`);
  if (JSON.stringify(entryIds) !== JSON.stringify(detailIds)) errors.push(`溯源整改单 ${item.id} 整改问题与结构化关联工单不一致`);
  if (Object.prototype.hasOwnProperty.call(detail?.fields?.entry || {}, "关联事件单编号")) errors.push(`溯源整改单 ${item.id} 仍使用旧字段名：关联事件单编号`);
}
if (multiRectificationSamples < 4) errors.push("溯源整改样例至少需要 4 张多关联工单记录");

const repeatRelations = seed.runtimeDefaults?.repeatRelations || {};
if (!Object.keys(repeatRelations).length) errors.push("样例缺少再次投诉关系");
for (const [repeatId, relation] of Object.entries(repeatRelations)) {
  const repeat = ticketById.get(repeatId);
  const main = ticketById.get(relation.mainTicket);
  if (!repeat) errors.push(`再次投诉单不存在：${repeatId}`);
  if (!main) errors.push(`再次投诉关联主工单不存在：${relation.mainTicket}`);
  if (repeat && repeat.type !== "投诉单") errors.push(`再次投诉单类型错误：${repeatId}`);
  if (main && main.type !== "投诉单") errors.push(`再次投诉主工单类型错误：${relation.mainTicket}`);
  if (!relation.linked) errors.push(`再次投诉关系未确认关联：${repeatId}`);
}

const requestApprovals = approvals.filter(item => ["短信审批", "导出申请审批"].includes(item.approvalType));
for (const approval of requestApprovals) {
  if (!approval.appliedAt) errors.push(`${approval.approvalType} ${approval.id} 缺少申请时间`);
  if (approval.approvalType === "短信审批") {
    const ticket = ticketById.get(approval.relatedTicketId);
    if (!ticket) errors.push(`短信审批 ${approval.id} 关联工单不存在：${approval.relatedTicketId}`);
    else if (ticket.status !== "处理中") errors.push(`短信审批 ${approval.id} 关联工单不是处理中：${ticket.id}/${ticket.status}`);
  }
  if (approval.approvalType === "导出申请审批" && !exportById.has(approval.id)) {
    errors.push(`导出审批 ${approval.id} 缺少对应导出申请`);
  }
}

for (const request of exportRequests) {
  if (!request.appliedAt) errors.push(`导出申请 ${request.id} 缺少申请时间`);
  if (!exportRequestTypes.includes(request.exportType)) errors.push(`导出申请 ${request.id} 的导出类型不在字典中：${request.exportType || "-"}`);
  if (!request.department) errors.push(`导出申请 ${request.id} 缺少申请人所属部门`);
  const relatedIds = [...(request.relatedTicketIds || []), ...(request.relatedSubprocessIds || [])];
  if (!relatedIds.length) errors.push(`导出申请 ${request.id} 未关联业务单`);
  for (const id of request.relatedTicketIds || []) {
    if (!ticketById.has(id)) errors.push(`导出申请 ${request.id} 关联工单不存在：${id}`);
  }
  for (const id of request.relatedSubprocessIds || []) {
    if (!subprocessById.has(id)) errors.push(`导出申请 ${request.id} 关联子流程不存在：${id}`);
  }
  if (["待审批", "审批中"].includes(request.status) && !approvals.some(item => item.id === request.id && item.approvalType === "导出申请审批")) {
    errors.push(`${request.status}导出申请 ${request.id} 缺少审批待办`);
  }
  if (!["待提交", "待审批", "审批中", "已通过", "已驳回"].includes(request.status)) {
    errors.push(`导出申请 ${request.id} 状态不在状态机内：${request.status}`);
  }
  if (request.status === "已通过") {
    if (!prototypeDatePattern.test(request.approvedAt || "")) errors.push(`已通过导出申请 ${request.id} 缺少秒级审批通过时间`);
    if (!prototypeDatePattern.test(request.expiresAt || "")) errors.push(`已通过导出申请 ${request.id} 缺少秒级过期时间`);
    const approvedAt = Date.parse(String(request.approvedAt).replace(" ", "T") + "+08:00");
    const expiresAt = Date.parse(String(request.expiresAt).replace(" ", "T") + "+08:00");
    if (Number.isFinite(approvedAt) && Number.isFinite(expiresAt) && expiresAt - approvedAt !== 7 * 24 * 60 * 60 * 1000) errors.push(`导出申请 ${request.id} 的过期时间不是审批通过后7×24小时`);
  } else if (request.approvedAt || request.expiresAt) {
    errors.push(`未通过导出申请 ${request.id} 不应开始下载有效期计时`);
  }
}

for (const [kind, records] of [["ticket", tickets], ["subprocess", subprocesses]]) {
  const histories = seed.workflowHistory?.[kind] || {};
  for (const record of records.filter(item => item.status !== "草稿" && item.type !== "舆情单")) {
    const storedHistory = histories[record.id] || [];
    const history = [...storedHistory].sort((a, b) => String(a.operationTime || "").localeCompare(String(b.operationTime || "")));
    if (!history.length) {
      errors.push(`${kind} ${record.id} 已到达 ${record.status} 但缺少流转记录`);
      continue;
    }
    const times = storedHistory.map(item => item.operationTime);
    if (times.some(time => !prototypeDatePattern.test(time || ""))) errors.push(`${kind} ${record.id} 存在非秒级流转时间`);
    const timeDirections = times.slice(1).map((time, index) => String(time).localeCompare(String(times[index]))).filter(Boolean);
    if (timeDirections.some(value => value > 0) && timeDirections.some(value => value < 0)) errors.push(`${kind} ${record.id} 的流转记录存储顺序不一致`);
    if (history.at(-1)?.statusTransition?.split(/\s*→\s*/).at(-1) !== record.status) errors.push(`${kind} ${record.id} 的最后流转状态未到达当前状态 ${record.status}`);
    history.forEach((item, index) => {
      if (!index) return;
      const previousTarget = history[index - 1]?.statusTransition?.split(/\s*→\s*/).at(-1);
      const currentSource = item.statusTransition?.split(/\s*→\s*/).at(0);
      if (previousTarget !== currentSource) errors.push(`${kind} ${record.id} 的流转状态不连续：${previousTarget || "-"} → ${currentSource || "-"}`);
    });
    for (const item of history) {
      if (!item.operatorName || !item.operatorRoleName || !item.operatorOrgName || !item.flowSceneName || item.flowOpinion == null || !item.receiverName || !/^.+\s→\s.+$/.test(item.statusTransition || "")) errors.push(`${kind} ${record.id} 的流转记录八字段不完整`);
      if (item.operatorName === "系统" && (item.operatorRoleName !== "-" || item.operatorOrgName !== "-")) errors.push(`${kind} ${record.id} 的系统流转记录角色和机构必须为-`);
      if (/转派|驳回/.test(item.flowSceneName) && !String(item.flowOpinion || "").trim()) errors.push(`${kind} ${record.id} 的${item.flowSceneName}缺少手工原因示例`);
      if (/办结回填/.test(item.flowSceneName) && (item.operatorName !== "系统" || !item.systemGeneratedOpinion || !String(item.flowOpinion || "").includes("字段变更"))) errors.push(`${kind} ${record.id} 的办结回填缺少系统自动字段变更示例`);
    }
  }
}
const allDocumentHistoryRecords = [
  ...Object.values(seed.workflowHistory?.ticket || {}).flat(),
  ...Object.values(seed.workflowHistory?.subprocess || {}).flat()
];
if (!allDocumentHistoryRecords.some(item => /转派/.test(item.flowSceneName || "") && String(item.flowOpinion || "").trim())) errors.push("流转历史缺少带手工原因的转派示例");
if (!allDocumentHistoryRecords.some(item => /驳回/.test(item.flowSceneName || "") && String(item.flowOpinion || "").trim())) errors.push("流转历史缺少带手工原因的驳回示例");
if (!allDocumentHistoryRecords.some(item => item.operatorName === "系统" && item.operatorRoleName === "-" && item.operatorOrgName === "-" && item.systemGeneratedOpinion === true && /字段变更/.test(item.flowOpinion || "") && /投诉校正|投诉调查/.test(item.flowOpinion || ""))) errors.push("流转历史缺少投诉校正或投诉调查办结后的系统字段变更示例");


const knownPermissionPages = new Set(["ticket-create", "ticket-process", "subprocess-create", "subprocess-manage", "my-approvals", "ledger-query"]);
const knownPermissionRoles = new Set(["operator", "reviewer", "handler", "approver", "analyst", "admin"]);
if (!Array.isArray(complaintPermissions.rules) || complaintPermissions.rules.length < 40) errors.push("投诉管理权限规则数量异常，请检查 data/complaint-permission-rules.json");
for (const rule of complaintPermissions.rules || []) {
  if (!knownPermissionPages.has(rule.page)) errors.push(`投诉管理权限规则页面未知：${rule.sourceRow}/${rule.page}`);
  if (!rule.tab) errors.push(`投诉管理权限规则缺少 TAB：Excel 行 ${rule.sourceRow}`);
  if (!Array.isArray(rule.statuses) || !rule.statuses.length) errors.push(`投诉管理权限规则缺少可显示状态：Excel 行 ${rule.sourceRow}`);
  if (!Array.isArray(rule.roles) || !rule.roles.length) errors.push(`投诉管理权限规则缺少角色映射：Excel 行 ${rule.sourceRow}`);
  for (const role of rule.roles || []) if (!knownPermissionRoles.has(role)) errors.push(`投诉管理权限规则角色未知：Excel 行 ${rule.sourceRow}/${role}`);
}

const report = {
  storageVersion: seed.meta?.storageVersion,
  coverage: {
    ticket: [...new Set(tickets.map(item => item.status))],
    subprocess: [...new Set(subprocesses.map(item => item.status))],
    rectification: [...new Set(rectifications.map(item => item.status))]
  },
  relations: {
    repeatComplaints: Object.keys(repeatRelations).length,
    linkedSubprocesses: subprocesses.length,
    linkedRectifications: rectifications.length,
    smsApprovals: approvals.filter(item => item.approvalType === "短信审批").length,
    exportRequests: exportRequests.length,
    complaintPermissionRules: complaintPermissions.rules?.length || 0
  },
  errors
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
