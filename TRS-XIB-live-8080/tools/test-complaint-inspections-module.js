"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const seedData = JSON.parse(fs.readFileSync(path.join(root, "data/seed-data.json"), "utf8"));
const supervisionExamples = seedData.runtimeDefaults.supervisionLetters;
const subprocessSchema = JSON.parse(fs.readFileSync(path.join(root, "data/forms/subprocesses.json"), "utf8"));
const workflowSchema = JSON.parse(fs.readFileSync(path.join(root, "data/workflow-schema.json"), "utf8"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert.equal(subprocessSchema.subprocesses.definitions.some(item => item.type === "督导函"), false, "督导函不应继续作为子流程定义");
assert.equal(Object.hasOwn(subprocessSchema.subprocesses.field_sections, "督导函"), false, "督导函字段不应继续出现在子流程表单");
assert.equal(Object.hasOwn(workflowSchema.documentStateMachines.subprocess.typeStatusMatrix, "督导函"), false, "督导函不应继续使用子流程状态矩阵");
assert.doesNotMatch(appSource, /subprocessRows\.concat\(supervisionRows\)/, "子单处理不应拼接督导函数据");
assert.doesNotMatch(appSource, /standardRows\.concat\(supervisionRows\)/, "子流程审批不应拼接督导函数据");
assert.equal(supervisionExamples.some(item => item.status === "草稿"), true, "缺少草稿督导函样例");
assert.equal(supervisionExamples.some(item => item.status === "处理中"), true, "缺少处理中督导函样例");
assert.equal(supervisionExamples.some(item => item.status === "处理中" && item.receiverId === "60157"), true, "缺少发给当前开发测试用户、可点击处理的督导函样例");
assert.equal(supervisionExamples.some(item => item.status === "已办结"), true, "缺少已办结督导函样例");
assert.equal(supervisionExamples.every(item => item.senderId && item.receiverId && item.supervisionRequirement), true, "督导函样例缺少人员标识或督导要求");
assert.equal(supervisionExamples.filter(item => item.status !== "草稿").every(item => item.inspectionResultSnapshot), true, "已发送督导函缺少智能核查结果快照");
assert.equal(new Set(supervisionExamples.map(item => item.ticketId)).size, supervisionExamples.length, "督导函样例违反一单一函");
let overlayRoot = null;
const sandbox = {
  window: { XIB_PROTOTYPE_CONFIG: { seedData: { lists:{ tickets:seedData.lists.tickets }, runtimeDefaults: { supervisionLetters: [] } } } },
  document: { querySelector: selector => selector === "#overlay-root" ? overlayRoot : null }
};
vm.createContext(sandbox);
const run = relativePath => vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), sandbox, { filename: relativePath });

run("src/core/module-registry.js");
run("src/modules/complaints/inspections/data.js");
run("src/modules/complaints/inspections/index.js");

const data = sandbox.window.XIB_COMPLAINT_INSPECTIONS_DATA;
assert.equal(data.batchRows.length, 8);
assert.equal(data.ticketLibrary.length, 4);
assert.equal(Object.isFrozen(data.batchRows), true);
assert.equal(Object.isFrozen(data.ticketLibrary[0].conclusions), true);
assert.equal(Object.isFrozen(data.ticketLibrary[0].inspectionRuns), true);
assert.equal(data.ticketLibrary[0].inspectionRuns.length, 2);
const latestInspectionRun = data.ticketLibrary[0].inspectionRuns.at(-1);
assert.equal(latestInspectionRun.submittedAt, "2026-07-20 16:05:00");
assert.equal(latestInspectionRun.findings.entry.passed, false);
assert.equal(JSON.stringify(latestInspectionRun.findings.entry.nonCompliantItems), JSON.stringify(["工作人员处置情况", "初次处置结果首次反映问题处理结果", "处理依据"]));
assert.equal(Boolean(latestInspectionRun.findings.entry.conclusion), true);
assert.equal(latestInspectionRun.findings.communications.items.length, 2);
assert.equal(latestInspectionRun.findings.communications.items.every(item => item.passed === false && item.contactTime && item.nonCompliantItems.length && item.conclusion), true);
assert.equal(latestInspectionRun.findings.productBusiness.groups.length, 2);
assert.equal(latestInspectionRun.findings.productBusiness.groups.every(group => group.primaryLabel && group.primaryConclusion && group.secondaryItems.length), true);
assert.equal(latestInspectionRun.findings.productBusiness.groups.flatMap(group => group.secondaryItems).every(item => item.label && item.conclusion), true);
assert.equal(data.ticketLibrary.find(item => item.id === "XF202607210008").inspectionRuns[0].findings.entry.passed, true);
assert.equal(data.ticketLibrary.find(item => item.id === "XF202607210008").inspectionRuns[0].findings.communications.passed, true);
assert.equal(data.ticketLibrary.find(item => item.id === "XF202607210008").inspectionRuns[0].findings.productBusiness.passed, true);
assert.equal(data.ticketLibrary.find(item => item.id === "XF202607270024").inspectionRuns[0].findings.entry.passed, false);
const submittedStatuses = new Set(["会签中", "待初审", "初审中", "待审批", "审批中", "已办结"]);
const visibleWorkOrderTypes = new Set(["投诉单", "信访单", "建议单", "表扬单"]);
const submittedWorkOrderTickets = seedData.lists.tickets.filter(ticket => visibleWorkOrderTypes.has(ticket.type) && submittedStatuses.has(ticket.status));
const inspectionRecordById = new Map(data.ticketInspectionRecords.map(record => [record.id, record]));
// 四种审批状态样例都应具备可查看的智能核查结果。
for (const status of ["待审批", "审批中"]) {
  for (const type of ["投诉单", "信访单"]) {
    const examples = submittedWorkOrderTickets.filter(ticket => ticket.status === status && ticket.type === type);
    assert(examples.length > 0, `${status}缺少${type}样例`);
    assert(examples.every(ticket => inspectionRecordById.get(ticket.id)?.inspectionRuns.length > 0), `${status}的${type}缺少智能核查结果`);
  }
}
assert.equal(submittedWorkOrderTickets.every(ticket => inspectionRecordById.has(ticket.id)), true);
assert.equal(inspectionRecordById.has("TS202607230012"), true, "退回处理中但已有提交记录的工单应保留核查结果");
assert.equal(inspectionRecordById.has("XF202607210008"), true, "演示信访单应有三项通过的最新核查结果");
submittedWorkOrderTickets.forEach(ticket => {
  const latest = inspectionRecordById.get(ticket.id).inspectionRuns.at(-1);
  assert.equal(typeof latest.findings.entry.passed, "boolean", ticket.id + " 缺少录入核查结论");
  assert.equal(Array.isArray(latest.findings.entry.nonCompliantItems), true, ticket.id + " 缺少录入核查不合规项目");
  assert.equal(Boolean(latest.findings.entry.conclusion), true, ticket.id + " 缺少录入核查一句话结论");
  assert.equal(typeof latest.findings.communications.passed, "boolean", ticket.id + " 缺少沟通处理核查结论");
  latest.findings.communications.items.forEach(item => {
    assert.equal(typeof item.passed, "boolean", ticket.id + " 联系记录缺少是否通过结论");
    assert.equal(Boolean(item.contactTime), true, ticket.id + " 联系记录缺少联系时间");
    assert.equal(Array.isArray(item.nonCompliantItems), true, ticket.id + " 联系记录缺少不合规项目");
    assert.equal(Boolean(item.conclusion), true, ticket.id + " 联系记录缺少一句话结论");
  });
  assert.equal(typeof latest.findings.productBusiness.passed, "boolean", ticket.id + " 缺少产品业务核查结论");
  const productGroups = latest.findings.productBusiness.groups;
  assert.equal(Array.isArray(productGroups), true, ticket.id + " 缺少产品业务核查一级标签分组");
  if (!latest.findings.productBusiness.passed) {
    assert.equal(productGroups.length > 0, true, ticket.id + " 不通过时缺少产品业务核查卡片");
    productGroups.forEach(group => {
      assert.equal(Boolean(group.primaryLabel && group.primaryConclusion), true, ticket.id + " 一级标签或一句话缺失");
      assert.equal(Array.isArray(group.secondaryItems) && group.secondaryItems.length > 0, true, ticket.id + " 一级标签下缺少二级标签");
      assert.equal(group.secondaryItems.every(item => item.label && item.conclusion), true, ticket.id + " 二级标签或对应的一句话缺失");
    });
  }
});
const requiredActiveStatuses = ["会签中", "待初审", "初审中", "待审批", "审批中"];
requiredActiveStatuses.forEach(status => {
  const statusTickets = submittedWorkOrderTickets.filter(ticket => ticket.status === status);
  assert.equal(statusTickets.length > 0, true, "缺少“" + status + "”状态的工单样例");
  assert.equal(statusTickets.every(ticket => inspectionRecordById.has(ticket.id)), true, "“" + status + "”状态仍有工单缺少智能核查数据");
});
const generatedRuns = submittedWorkOrderTickets.map(ticket => inspectionRecordById.get(ticket.id).inspectionRuns.at(-1));
assert.equal(generatedRuns.some(run => run.findings.entry.passed && run.findings.communications.passed && run.findings.productBusiness.passed), true, "缺少全通过样例");
assert.equal(generatedRuns.some(run => !run.findings.entry.passed && !run.findings.communications.passed && !run.findings.productBusiness.passed), true, "缺少全不通过样例");
assert.equal(generatedRuns.some(run => [run.findings.entry.passed, run.findings.communications.passed, run.findings.productBusiness.passed].filter(Boolean).length === 1), true, "缺少混合通过样例");
const productBusinessGroups = data.ticketInspectionRecords.flatMap(record => record.inspectionRuns).flatMap(run => run.findings.productBusiness.groups);
const productBusinessTags = productBusinessGroups.flatMap(group => [group.primaryLabel, ...group.secondaryItems.map(item => item.label)]);
assert.equal(productBusinessTags.length > 0, true, "缺少产品业务核查标签样例");
assert.equal(productBusinessGroups.every(group => group.primaryConclusion && group.secondaryItems.every(item => item.conclusion)), true, "产品业务核查一级、二级标签均应包含对应的一句话");

const registry = sandbox.window.XIBModuleRegistry;
const moduleApi = sandbox.window.XIBComplaintInspections;
const inspectorActor = { id:"60157", name:"陈敏慧-60157", role:"inspector" };
const handlerActor = { id:"27519", name:"王琳-27519", role:"handler" };
const approverActor = { id:"29816", name:"赵宁-29816", role:"approver" };

moduleApi.hydrateState({ supervisionLetters:[] });
const passedDraftResult = moduleApi.createSupervisionDraft("XF202607210008", inspectorActor, "2026-10-26 09:58:00");
assert.equal(passedDraftResult.ok, false, "最新核查结果通过的工单不得发起督导函");
assert.equal(passedDraftResult.reason, "仅核查结果不通过的工单可以发起督导函。");
const missingInspectionDraftResult = moduleApi.createSupervisionDraft("UNKNOWN-TICKET", inspectorActor, "2026-10-26 09:59:00");
assert.equal(missingInspectionDraftResult.ok, false, "无核查结果的工单不得发起督导函");
assert.equal(missingInspectionDraftResult.reason, "仅核查结果不通过的工单可以发起督导函。");
const draftResult = moduleApi.createSupervisionDraft("TS202607230012", inspectorActor, "2026-10-26 10:00:00");
assert.equal(draftResult.ok, true);
assert.equal(draftResult.letter.status, "草稿");
assert.equal(moduleApi.createSupervisionDraft("TS202607230012", inspectorActor, "2026-10-26 10:01:00").ok, false, "同一工单不得重复发起督导函");

const savedDraft = moduleApi.saveSupervisionDraft(draftResult.letter.id, {
  supervisionRequirement:"请补充处理依据。",
  receiverId:handlerActor.id,
  receiverName:handlerActor.name,
  ccApproverIds:[approverActor.id],
  ccApproverNames:[approverActor.name]
}, inspectorActor, "2026-10-26 10:02:00");
assert.equal(savedDraft.ok, true);
assert.equal(moduleApi.canViewSupervisionLetter(savedDraft.letter, approverActor), false, "草稿不应向抄送审批员展示");

const sentDraft = moduleApi.sendSupervisionLetter(savedDraft.letter.id, inspectorActor, { entry:{ passed:false } }, "2026-10-26 10:03:00");
assert.equal(sentDraft.ok, true);
assert.equal(sentDraft.letter.status, "处理中");
assert.equal(moduleApi.canViewSupervisionLetter(sentDraft.letter, approverActor), true);
assert.equal(moduleApi.canProcessSupervisionLetter(sentDraft.letter, handlerActor), true);
assert.equal(moduleApi.canProcessSupervisionLetter(sentDraft.letter, approverActor), false);
assert.equal(moduleApi.saveSupervisionDraft(sentDraft.letter.id, { supervisionRequirement:"不可修改" }, inspectorActor, "2026-10-26 10:04:00").ok, false, "发送后督导要求必须只读");

const completedDraft = moduleApi.completeSupervisionLetter(sentDraft.letter.id, "已补充材料。", handlerActor, "2026-10-26 10:05:00");
assert.equal(completedDraft.ok, true);
assert.equal(completedDraft.letter.status, "已办结");
assert.equal(moduleApi.completeSupervisionLetter(sentDraft.letter.id, "重复提交", handlerActor, "2026-10-26 10:06:00").ok, false);

moduleApi.hydrateState({ supervisionLetters:[{
  id:"DH202608040001", ticketId:"XF202607270024", status:"待处理",
  sender:"陈敏慧-60157", receiver:"林海-38102", cc:"郭颖-18307", supplement:"旧要求"
}] });
const migratedLetter = moduleApi.serializeState().supervisionLetters[0];
assert.equal(migratedLetter.status, "处理中");
assert.equal(migratedLetter.supervisionRequirement, "旧要求");
assert.equal(migratedLetter.receiverId, "38102");
assert.equal(JSON.stringify(migratedLetter.ccApproverIds), JSON.stringify(["18307"]));
assert.equal("supplement" in migratedLetter, false);

moduleApi.hydrateState({ supervisionLetters:[] });
const processingTicketMarkup = moduleApi.renderInspectionFindings(latestInspectionRun.findings, { ticketId:"TS202607230012", ticketType:"投诉单", ticketStatus:"处理中" });
assert.match(processingTicketMarkup, /data-inspection-dimension="entry"[^]*?data-inspection-state="generating"/);
assert.match(processingTicketMarkup, /data-inspection-dimension="communications"[^]*?不合规记录/);
assert.match(processingTicketMarkup, /data-inspection-dimension="productBusiness"[^]*?data-inspection-state="failed"/);
assert.match(processingTicketMarkup, /data-inspection-retry="productBusiness"/);
const mixedTicket = seedData.lists.tickets.find(ticket => ticket.id === "TS202501100201");
const mixedFindings = inspectionRecordById.get(mixedTicket.id).inspectionRuns.at(-1).findings;
const mixedMarkup = moduleApi.renderInspectionFindings(mixedFindings, { ticketId:mixedTicket.id, ticketType:mixedTicket.type, ticketStatus:mixedTicket.status });
assert.match(mixedMarkup, /data-inspection-dimension="entry"[^]*?data-inspection-state="generating"/);
assert.match(mixedMarkup, /data-inspection-dimension="communications"[^]*?data-inspection-state="failed"/);
assert.match(mixedMarkup, /data-inspection-retry="communications"/);
assert.match(mixedMarkup, /data-inspection-dimension="productBusiness"[^]*?approval-inspection-status/);
const allContentTicket = seedData.lists.tickets.find(ticket => ticket.id === "TS202411080211");
const allContentFindings = inspectionRecordById.get(allContentTicket.id).inspectionRuns.at(-1).findings;
const allContentMarkup = moduleApi.renderInspectionFindings(allContentFindings, { ticketId:allContentTicket.id, ticketType:allContentTicket.type, ticketStatus:allContentTicket.status });
assert.doesNotMatch(allContentMarkup, /data-inspection-state=/);
const eligibleMarkup = seedData.lists.tickets.filter(ticket => ticket.type === "投诉单" && ["会签中", "待审批", "审批中", "已办结"].includes(ticket.status)).map(ticket => {
  const findings = inspectionRecordById.get(ticket.id)?.inspectionRuns.at(-1)?.findings;
  return moduleApi.renderInspectionFindings(findings, { ticketId:ticket.id, ticketType:ticket.type, ticketStatus:ticket.status });
});
assert(eligibleMarkup.some(markup => markup.includes("is-pass")), "已有核查内容应包含通过结果");
assert(eligibleMarkup.some(markup => markup.includes("is-fail")), "已有核查内容应包含不通过结果");
assert(eligibleMarkup.some(markup => markup.includes('data-inspection-state="generating"')), "现有投诉单缺少生成中样例");
assert(eligibleMarkup.some(markup => markup.includes('data-inspection-state="failed"')), "现有投诉单缺少生成失败样例");
const valueNode = { innerHTML:"" };
const retryButton = {
  dataset:{ inspectionTicketId:mixedTicket.id, inspectionRetry:"communications" },
  closest: () => valueNode,
  addEventListener(_event, listener) { this.click = listener; }
};
moduleApi.bindInspectionRetry({ querySelectorAll: () => [retryButton] });
retryButton.click();
assert.match(valueNode.innerHTML, /data-inspection-state="generating"/);
assert.doesNotMatch(valueNode.innerHTML, /重新生成/);
assert.match(moduleApi.renderInspectionFindings(mixedFindings, { ticketId:mixedTicket.id, ticketType:mixedTicket.type, ticketStatus:mixedTicket.status }), /data-inspection-dimension="communications"[^]*?data-inspection-state="generating"/);
let rerenders = 0;
let modal;
let openedTicketId = "";
let groupedFilterRows;
let assignedWorkItem;
let confirmation;
const context = {
  state:{ role:"developer" },
  getCurrentActor: () => inspectorActor,
  pageHeader: (title, subtitle, actions = "") => `<header><h1>${title}</h1><p>${subtitle}</p>${actions}</header>`,
  renderFilters: () => '<div class="filter-panel ticket-filter-panel"></div>',
  renderGroupedFilters: rows => { groupedFilterRows = rows; return '<div class="filter-panel ticket-filter-panel grouped-filter-panel"></div>'; },
  renderPagination: count => `<footer data-count="${count}"></footer>`,
  statusTag: status => `<mark>${status}</mark>`,
  icon: name => `<i>${name}</i>`,
  findTicketRow: id => {
    const ticket = seedData.lists.tickets.find(item => item.id === id);
    return ticket ? [id, ticket.type, ticket.customer, ticket.subject || "贷款协商还款", "厦门分行", ticket.status, ticket.createdAt] : null;
  },
  getTicketDepartment: () => "厦门分行消费者权益保护部",
  getTicketComplaintProduct: () => "贷款 / 个人合作类贷款 / 度小满",
  getWorkPoolIdentity: () => ({ actor:"林海-38102", organization:"厦门分行" }),
  getCommonDepartmentOptions: () => ["总行消费者权益保护部", "厦门分行消费者权益保护部"],
  rerenderPage: () => { rerenders += 1; },
  openModal: (title, content, button, callback) => { modal = { title, content, button, callback }; },
  closeOverlay: () => {},
  openTicketDetail: id => { openedTicketId = id; },
  toast: () => {},
  persistWorkflowState: () => {},
  assignWorkItem: (kind, id, assignee) => { assignedWorkItem = { kind, id, assignee }; },
  clearWorkItemAssignment: () => {},
  systemTimestamp: () => "2026-08-03 12:00:00",
  showValidationError: () => {},
  openSubmissionConfirmation: (title, summary, callback, button) => { confirmation = { title, summary, callback, button }; }
};

moduleApi.hydrateState({ supervisionLetters:supervisionExamples });
const draftExample = supervisionExamples.find(item => item.status === "草稿");
assert.equal(registry.handleAction("inspections-letter-page", { id:draftExample.id }, { ...context, page:"analysis-inspections" }), true);
const draftPageMarkup = registry.render("analysis-inspections", context);
assert.match(draftPageMarkup, /data-supervision-requirement/);
assert.match(draftPageMarkup, /data-action="inspections-letter-save"/);
assert.match(draftPageMarkup, /data-action="inspections-letter-send"/);
assert.doesNotMatch(draftPageMarkup, /领取督导函|待处理/);

const processingExample = supervisionExamples.find(item => item.status === "处理中");
const approverContext = { ...context, state:{ role:"approver" }, getCurrentActor:() => approverActor };
assert.equal(registry.handleAction("inspections-letter-page", { id:processingExample.id }, { ...approverContext, page:"analysis-inspections" }), true);
const approverPageMarkup = registry.render("analysis-inspections", approverContext);
assert.match(approverPageMarkup, /督导要求/);
assert.match(approverPageMarkup, /data-supervision-detail-feedback[^>]*readonly/);
assert.doesNotMatch(approverPageMarkup, /data-action="inspections-letter-submit"|supervision-feedback-read/);

const handlerContext = { ...context, state:{ role:"handler" }, getCurrentActor:() => ({ id:processingExample.receiverId, name:processingExample.receiverName, role:"handler" }) };
const handlerPageMarkup = registry.render("analysis-inspections", handlerContext);
assert.match(handlerPageMarkup, /data-supervision-detail-feedback/);
assert.doesNotMatch(handlerPageMarkup, /data-supervision-detail-feedback[^>]*readonly/);
assert.match(handlerPageMarkup, /data-action="inspections-letter-submit"/);
assert.doesNotMatch(handlerPageMarkup, /领取督导函|待处理/);

const completedExample = supervisionExamples.find(item => item.status === "已办结");
const completedContext = { ...context, state:{ role:"developer" }, getCurrentActor:() => inspectorActor };
assert.equal(registry.handleAction("inspections-letter-page", { id:completedExample.id }, { ...completedContext, page:"analysis-inspections" }), true);
const completedPageMarkup = registry.render("analysis-inspections", completedContext);
assert.match(completedPageMarkup, /data-supervision-detail-feedback[^>]*readonly/);
assert.match(completedPageMarkup, new RegExp(completedExample.feedback));
assert.doesNotMatch(completedPageMarkup, /supervision-feedback-read|data-action="inspections-letter-submit"/);

moduleApi.hydrateState({ supervisionLetters:[] });
moduleApi.resetViewState();

const list = registry.render("analysis-inspections", context);
assert.match(list, /data-module="complaint-inspections"/);
assert.match(list, /核查工单/);
assert.doesNotMatch(list, /核查批次详情|inspections-batch-open/);
assert.equal((list.match(/data-action="inspections-open-ticket"/g) || []).length, 4);
assert.equal(groupedFilterRows.flat().find(field => field.label === "工单编号")?.type, "input");
assert.equal(groupedFilterRows.flat().find(field => field.label === "工单类型")?.type, "select");
assert.equal(JSON.stringify(groupedFilterRows.flat().find(field => field.label === "工单类型")?.options), JSON.stringify(["投诉单", "信访单"]));
assert.equal(groupedFilterRows.flat().find(field => field.label === "提交处理结果时间")?.minDate, "2015-01-01");
assert.equal(JSON.stringify(groupedFilterRows.flat().find(field => field.label === "核查结果状态")?.options), JSON.stringify(["通过", "不通过"]));
assert.equal(groupedFilterRows.flat().some(field => field.label === "核查状态"), false);

registry.afterRender({
  querySelectorAll: () => [],
  querySelector: () => null
}, "analysis-inspections", context);
assert.doesNotMatch(list, /data-inspections-sort-index/);

assert.match(list, /TS202607230012/);
assert.match(list, /data-action="inspections-letter-draft"[^>]*>发送督导函</);
assert.match(list, /data-action="inspections-open-ticket" data-id="TS202607230012"/);
assert.match(list, /<th>核查结果状态<\/th>/);
assert.doesNotMatch(list, /<th>录入核查<\/th>|<th>沟通处理核查<\/th>|<th>产品业务核查<\/th>/);
const tsDetailRowStart = list.lastIndexOf("<tr>", list.indexOf('data-id="TS202607230012"'));
const tsDetailRow = list.slice(tsDetailRowStart, list.indexOf("</tr>", tsDetailRowStart) + 5);
assert.match(tsDetailRow, /<mark>不通过<\/mark>/);
assert.doesNotMatch(tsDetailRow, /生成中\.\.\.|生成失败|外呼行为不当/);
assert.match(list, /TS202411080211/);
assert.match(list, /XF202607270024/);
assert.doesNotMatch(list, /BY202607220021|JY202607240017|YQ202607260006/);
const sampleRow = id => {
  const start = list.lastIndexOf("<tr>", list.indexOf('data-id="' + id + '"'));
  return list.slice(start, list.indexOf("</tr>", start) + 5);
};
assert.match(sampleRow("TS202411080211"), /<mark>通过<\/mark>/);
assert.doesNotMatch(sampleRow("TS202411080211"), /data-action="inspections-letter-draft"/);
assert.match(sampleRow("XF202607210008"), /<mark>通过<\/mark>/);
assert.doesNotMatch(sampleRow("XF202607210008"), /data-action="inspections-letter-draft"/);
assert.match(sampleRow("XF202607270024"), /<mark>不通过<\/mark>/);
assert.match(sampleRow("XF202607270024"), /data-action="inspections-letter-draft"/);
assert.match(list, /inspection-action-placeholder">-</);
assert.match(list, /inspection-row-actions/);
assert.match(list, /<th>所属机构<\/th><th>所属部门<\/th><th>提交处理结果时间<\/th>/);
assert.match(tsDetailRow, /厦门分行<\/td><td>厦门分行消费者权益保护部<\/td>/);
assert.doesNotMatch(list, />函件<\/button>/);
assert.doesNotMatch(list, /<th>核查状态<\/th>/);
assert.equal(registry.handleAction("inspections-open-ticket", { id: "TS202607230012" }, { ...context, page: "analysis-inspections" }), true);
assert.equal(openedTicketId, "TS202607230012");

assert.equal(registry.handleAction("inspections-ticket-detail", { id: "TS202607230012" }, { ...context, page: "analysis-inspections" }), true);
assert.equal(modal.title, "核查工单详情");
assert.match(modal.content, /智能核查结果/);
assert.match(modal.content, /沟通处理核查/);
assert.match(modal.content, /产品业务核查/);
assert.match(modal.content, /不合规记录/);
assert.doesNotMatch(modal.content, /一句话结论：/);
assert.match(modal.content, /data-inspection-dimension="entry"[^]*?data-inspection-state="generating"/);
assert.match(modal.content, /data-inspection-dimension="productBusiness"[^]*?data-inspection-state="failed"/);
assert.match(modal.content, /data-inspection-retry="productBusiness"/);
assert.doesNotMatch(modal.content, /不合规字段|贷款息费说明与客户知情确认记录不完整/);
assert.equal(registry.handleAction("inspections-ticket-detail", { id:"TS202607230012" }, {
  ...context,
  page:"analysis-inspections",
  getLatestTicketInspectionRun: () => ({ submittedAt:"2026-08-10 10:00:00", findings:{
    entry:{ passed:true }, communications:{ passed:true, items:[] }, productBusiness:{ passed:true, groups:[] }
  } })
}), true);
assert.equal((modal.content.match(/approval-inspection-status is-pass/g) || []).length, 1, "核查弹窗未读取与工单详情相同的最新核查批次");
const modalTicketId = "TS202509150202";
assert.equal(registry.handleAction("inspections-ticket-detail", { id:modalTicketId }, {
  ...context,
  page:"analysis-inspections",
  findTicketRow: id => [id, "投诉单", "客户", "贷款业务", "厦门分行", "已办结", "2026-07-16"]
}), true);
assert.match(modal.content, /data-inspection-state="generating"/);
assert.match(modal.content, /data-inspection-state="failed"/);
assert.match(modal.content, /data-inspection-retry="productBusiness"/);
const letter = {
  id: "DH202608030001", batchId: "ZJ20250634002", ticketId: "TS202607230012",
  senderOrg: "总行消费者权益保护部", receiver: "王琳-27519", cc: "赵宁-29816", method: "系统发送",
  status: "待处理", conclusions: { entry:{ text:"录入结论" }, processing:{ text:"处理结论" }, behavior:{ text:"行为结论" } },
  supplement: "请补充材料", createdAt: "2026-08-03 12:00:00", updatedAt: "2026-08-03 12:00:00", feedback: "", feedbackAt: ""
};
moduleApi.hydrateState({ supervisionLetters: [letter] });
assert.equal(moduleApi.serializeState().supervisionLetters.length, 1);
const existingLetterList = registry.render("analysis-inspections", context);
const existingLetterRow = existingLetterList.slice(existingLetterList.lastIndexOf("<tr>", existingLetterList.indexOf('data-id="TS202607230012"')), existingLetterList.indexOf("</tr>", existingLetterList.indexOf('data-id="TS202607230012"')) + 5);
assert.match(existingLetterRow, /data-action="inspections-letter-page"[^>]*>查看督导函</);
assert.doesNotMatch(existingLetterRow, /data-action="inspections-edit-letter"|data-action="inspections-delete-letter"|>编辑<|>删除</);
assert.doesNotMatch(existingLetterRow, /data-action="inspections-letter-draft"/);
assert.equal(registry.handleAction("inspections-ticket-detail", { id:"TS202607230012" }, { ...context, page:"analysis-inspections" }), true);
assert.equal(modal.button, "关闭");
moduleApi.hydrateState({ supervisionLetters: [] });
assert.match(registry.render("analysis-inspections", context), /data-action="inspections-letter-draft" data-id="TS202607230012">发送督导函</);

moduleApi.hydrateState({ supervisionLetters:supervisionExamples });
registry.handleAction("inspections-letter-back", {}, { ...context, page:"analysis-inspections" });
const supervisionRecordMarkup = registry.render("analysis-inspections", context);
const hiddenDraftExample = supervisionExamples.find(item => item.status === "草稿");
const publishedExamples = supervisionExamples.filter(item => ["处理中", "已办结"].includes(item.status));
assert.doesNotMatch(supervisionRecordMarkup, new RegExp(hiddenDraftExample.id), "草稿督导函不得显示在督导记录");
publishedExamples.forEach(item => assert.match(supervisionRecordMarkup, new RegExp(item.id)));
assert.match(supervisionRecordMarkup, new RegExp("督导记录 <span>（" + publishedExamples.length + "）<\\/span>"));
const currentUserProcessingExample = supervisionExamples.find(item => item.status === "处理中" && item.receiverId === "60157");
const currentUserRowStart = supervisionRecordMarkup.lastIndexOf("<tr>", supervisionRecordMarkup.indexOf(currentUserProcessingExample.id));
const currentUserRow = supervisionRecordMarkup.slice(currentUserRowStart, supervisionRecordMarkup.indexOf("</tr>", currentUserRowStart) + 5);
assert.match(currentUserRow, /data-action="inspections-letter-process"[^>]*>处理</);

registry.handleAction("inspections-letter-back", {}, { ...handlerContext, page:"analysis-inspections" });
const handlerRecordMarkup = registry.render("analysis-inspections", handlerContext);
const handlerRecordRowStart = handlerRecordMarkup.lastIndexOf("<tr>", handlerRecordMarkup.indexOf(processingExample.id));
const handlerRecordRow = handlerRecordMarkup.slice(handlerRecordRowStart, handlerRecordMarkup.indexOf("</tr>", handlerRecordRowStart) + 5);
assert.match(handlerRecordRow, /data-action="inspections-letter-process"[^>]*>处理</);

registry.handleAction("inspections-letter-back", {}, { ...approverContext, page:"analysis-inspections" });
const approverRecordMarkup = registry.render("analysis-inspections", approverContext);
const approverRecordRowStart = approverRecordMarkup.lastIndexOf("<tr>", approverRecordMarkup.indexOf(processingExample.id));
const approverRecordRow = approverRecordMarkup.slice(approverRecordRowStart, approverRecordMarkup.indexOf("</tr>", approverRecordRowStart) + 5);
assert.match(approverRecordRow, /data-action="inspections-letter-page"[^>]*>查看</);
assert.doesNotMatch(approverRecordRow, />处理</);

const normalizedIds = moduleApi.normalizeSupervisionLetterIds([
  { id:"DH202608040001", ticketId:"TS-EXISTING", createdAt:"2026-08-04 08:00:00" },
  { id:"DDH20260804102000000", ticketId:"TS-LEGACY-1", createdAt:"2026-08-04 10:20:00" },
  { id:"DDH20260804113000000", ticketId:"TS-LEGACY-2", createdAt:"2026-08-04 11:30:00" }
], {
  DH202608040002:{ assignee:"预留处理人" },
  DDH20260804102000000:{ assignee:"处理人甲" },
  DDH20260804113000000:{ assignee:"处理人乙" }
});
assert.equal(normalizedIds.migrated, true);
assert.equal(JSON.stringify(normalizedIds.supervisionLetters.map(item => item.id)), JSON.stringify(["DH202608040001", "DH202608040003", "DH202608040004"]));
assert.equal(normalizedIds.assignments.DH202608040002.assignee, "预留处理人");
assert.equal(normalizedIds.assignments.DH202608040003.assignee, "处理人甲");
assert.equal(normalizedIds.assignments.DH202608040004.assignee, "处理人乙");
assert.doesNotMatch(JSON.stringify(normalizedIds), /DDH\d+/);
moduleApi.resetViewState();
assert.match(registry.render("analysis-inspections", context), /核查工单 <span>/);

console.log("Complaint inspections module checks passed.");
