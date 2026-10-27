"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const statuses = ["草稿", "问题待提交", "问题待审核", "方案待提交", "方案待初审", "方案待审批", "整改中", "结果待初审", "结果待审批", "已办结", "已废止"];
const sandbox = {
  window: {
    XIB_PROTOTYPE_CONFIG: {
      workflowSchema: { documentStateMachines: { rectification: { statuses } } },
      organizationTree: { organizations: [
        { id:"head", parentId:"bank", name:"总行", type:"304901", status:"启用" },
        { id:"xiamen", parentId:"bank", name:"厦门分行", type:"304903", status:"启用" },
        { id:"fuzhou", parentId:"bank", name:"福州分行", type:"304903", status:"启用" }
      ] },
      seedData: { runtimeDefaults: { workPool: {
        identities: {
          operator: { actor:"陈敏慧-60157", organization:"总行" },
          handler: { actor:"林海-38102", organization:"总行" },
          reviewer: { actor:"周岚-20618", organization:"总行" },
          approver: { actor:"赵宁-29816", organization:"总行" }
        },
        assignments: { ticket:{}, subprocess:{}, rectification: {
          ZG001:{ assignee:"陈敏慧-60157", participants:["陈敏慧-60157"] },
          ZG002:{ assignee:"陈敏慧-60157", participants:["陈敏慧-60157"] },
          ZG003:{ assignee:"赵宁-29816", participants:["赵宁-29816"] },
          ZG004:{ assignee:"林海-38102", participants:["林海-38102"] },
          ZG005:{ assignee:"林海-38102", participants:["林海-38102"] }
        } }
      } } }
    }
  }
};
vm.createContext(sandbox);
const run = relativePath => vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), sandbox, { filename: relativePath });

run("src/core/module-registry.js");
run("src/modules/complaints/work-pool.js");
run("src/modules/complaints/rectification/data.js");
run("src/modules/complaints/rectification/statistics.js");
run("src/modules/complaints/rectification/detail.js");
run("src/modules/complaints/rectification/index.js");

const data = sandbox.window.XIB_COMPLAINT_RECTIFICATION_DATA;
assert.deepEqual([...data.statusOrder], statuses);
assert.equal(Object.isFrozen(data.statusOrder), true);
assert.deepEqual([...data.modules.create.todoStates], ["草稿", "问题待提交"]);
assert.deepEqual([...data.modules.process.todoStates], ["方案待提交", "整改中"]);
assert.deepEqual([...data.modules.approve.todoStates], ["问题待审核", "方案待初审", "方案待审批", "结果待初审", "结果待审批"]);
assert.deepEqual(Object.keys(data.routingRules), ["problemSubmit", "planSubmit", "planInitialApprove", "resultSubmit", "resultInitialApprove"]);
assert.equal(data.approvalCandidates.length, 2);

const rows = [
  ["ZG004", "溯源整改", "TS004", "甲", "厦门分行", "整改中", "2026-08-03", "整改四", "整改中", false],
  ["ZG001", "溯源整改", "TS001、TS002", "乙", "总行", "草稿", "2026-08-01", "整改一", "草稿", true],
  ["ZG002", "溯源整改", "TS002", "乙", "总行", "问题待提交", "2026-08-02", "整改二", "问题待提交", false],
  ["ZG003", "溯源整改", "TS003", "丙", "福州分行", "问题待审核", "2026-08-02", "整改三", "问题待审核", false],
  ["ZG005", "溯源整改", "TS005", "丁", "厦门分行", "已办结", "2026-08-04", "整改五", "已办结", true]
];
const registry = sandbox.window.XIBModuleRegistry;
let rerenders = 0;
let openedFormId = null;
let savedDrafts = 0;
let submittedForms = 0;
const context = {
  role: "developer",
  page: "rectification-create",
  getRectificationRows: () => rows.map(row => [...row]),
  getRectificationDocument: id => {
    const map = {
      "ZG001": { fields: { base: { "创建人": "陈敏慧-60157" }, entry: { "整改部门或机构": "总行" } } },
      "ZG002": { fields: { base: { "创建人": "陈敏慧-60157" }, entry: { "整改部门或机构": "总行" } } },
      "ZG003": { fields: { base: { "创建人": "王五" }, entry: { "整改部门或机构": "福州分行" } } },
      "ZG004": { fields: { base: { "创建人": "王五", "申请时间":"2026-08-03 09:00:00" }, entry: { "整改部门或机构": "厦门分行", "整改负责人（处置员）":"林海-38102", "抄送人":["赵宁-29816"] }, plan:{ "计划完成时间":"2026-08-22" } } },
      "ZG005": { fields: { base: { "创建人": "陈敏慧-60157" }, entry: { "整改部门或机构": "厦门分行" } } }
    };
    return map[id] || null;
  },
  currentUser: () => "陈敏慧-60157",
  currentOrgLabel: () => "总行",
  currentInstitutionLabel: () => "总行",
  currentDepartmentLabel: () => "总行消费者权益保护部",
  qualifiedDepartmentName: (institution, department) => String(institution || "总行").split(" / ").pop() + department,
  getRectificationDetailModel: () => ({ row:[...rows[0]], base:{ "申请时间":"2026-08-03 09:00:00" }, role:"developer", approvalFull:false, canEdit:true, canEditProcess:true }),
  renderRectificationReadonlySections: (phase, row, titles) => `<section data-readonly-phase="${phase}" data-titles="${(titles || []).join(",")}">${row[0]}</section>`,
  renderRectificationProcessingEditor: row => `<form data-rectification-processing>${row[0]}</form>`,
  renderRectificationWorkflowRejection: () => '<div data-workflow-rejection></div>',
  renderRectificationFlow: () => '<ol data-rectification-flow></ol>',
  renderRectificationApprovalEditor: () => '<form data-approval-editor></form>',
  renderRectificationApprovalFooter: () => '<footer data-approval-footer></footer>',
  pageHeader: (title, subtitle, actions = "") => `<header><h1>${title}</h1><p>${subtitle}</p>${actions}</header>`,
  icon: name => `<i>${name}</i>`,
  renderFilters: () => '<div class="filter-panel ticket-filter-panel"></div>',
  renderGroupedFilters: rows => '<div class="filter-panel ticket-filter-panel grouped-filter-panel rectification-filter-panel">' + rows.flat().map(field => '<label>' + field.label + '</label>').join('') + '</div>',
  paginateRows: rows => rows,
  renderPagination: count => `<footer data-count="${count}"></footer>`,
  statusTag: status => `<mark>${status}</mark>`,
  rerenderPage: () => { rerenders += 1; },
  renderContextBackButton: () => '<button data-action="navigate-back" data-id="rectification-create">返回整改创建</button>',
  getRectificationFormModel: () => ({
    row:null,
    sections:[{ title:"整改问题", fields:[{ name:"整改单名称", type:"text" }, { name:"投诉原因标签", type:"hierarchyCascader" }, { name:"关联工单编号", type:"relatedEventPicker" }] }],
    orgLabel:"总行",
    applicationTime:"",
    role:"developer"
  }),
  renderRectificationFormField: field => '<div data-test-field="' + field.name + '" data-summary-levels="' + (field.summaryLevels || 0) + '">' + field.name + '</div>',
  getRectificationRelatedTicketIds: () => ["TS001"],
  getRectificationPickerRows: () => [["TS001", "投诉单", "张三", "客服电话", "总行", "处理中"]],
  setRectificationRelatedTickets: () => {},
  openRectificationForm: id => { openedFormId = id; },
  saveRectificationDraft: () => { savedDrafts += 1; },
  submitRectification: () => { submittedForms += 1; },
  openModal: () => {},
  closeOverlay: () => {},
  toast: () => {}
};

const list = registry.render("rectification-create", context);
assert.match(list, /data-module="complaint-rectification"/);
assert.match(list, /整改创建/);
assert.match(list, /我的工作台/);
assert.match(list, /机构工单池/);
assert.match(list, /下辖工单池/);
assert.match(list, /data-rectification-view=/);
assert.match(list, /data-rectification-tab=/);
assert.match(list, /new-rectification/);
assert.match(list, /申请时间/);
assert.match(list, /计划完成时间/);
for (const label of ["整改状态", "申请时间", "计划完成时间", "整改单编号", "关联工单编号", "整改单创建人", "整改机构或部门", "整改负责人"]) assert.match(list, new RegExp(label));
for (const removed of ["处置期限", "所属机构", "所属部门", "是否抄送"]) assert.doesNotMatch(list.match(/rectification-filter-panel[\s\S]*?<div class="panel">/)?.[0] || "", new RegExp(removed), "整改筛选栏仍包含已删除条件：" + removed);
assert.ok(list.indexOf("申请时间") < list.indexOf("计划完成时间"), "申请时间应显示在计划完成时间之前");
// 整改创建 我的工作台-待办：草稿 + 问题待提交
assert.ok(list.indexOf("ZG001") > -1 && list.indexOf("ZG002") > -1);
const draftRowMarkup = list.match(/data-rectification-row="ZG001"[\s\S]*?<\/tr>/)?.[0] || "";
const resubmitRowMarkup = list.match(/data-rectification-row="ZG002"[\s\S]*?<\/tr>/)?.[0] || "";
assert.doesNotMatch(draftRowMarkup, /data-operation-key="void"/, "草稿不应出现废止操作");
assert.match(draftRowMarkup, /<td>-<\/td>/, "计划完成时间为空时应显示占位符");
assert.match(resubmitRowMarkup, /data-operation-key="void"/, "问题待提交应出现废止操作");

const processList = registry.render("rectification-process", { ...context, page: "rectification-process" });
assert.match(processList, /整改处理/);
assert.match(processList, /ZG004/);
assert.match(processList, /2026-08-03 09:00:00/);
assert.match(processList, /2026-08-22/);
assert.match(processList, /data-rectification-responsible="林海-38102"/);
assert.match(processList, /data-rectification-copied="是"/);
assert.doesNotMatch(processList, /new-rectification/);
assert.doesNotMatch(processList, /转派|data-operation-key="transfer"|data-bulk-operation="transfer"/);
assert.doesNotMatch(processList, /data-row-select="rectification-orders"|data-select-all="rectification-orders"|data-bulk-toolbar="rectification-orders"/);

const approveList = registry.render("rectification-approve", { ...context, page: "rectification-approve" });
assert.match(approveList, /整改审批/);
assert.match(approveList, /ZG003/);
assert.doesNotMatch(approveList, /ZG001/);

assert.equal(registry.hasRoute("rectification-create"), true);
assert.equal(registry.hasRoute("rectification-process"), true);
assert.equal(registry.hasRoute("rectification-approve"), true);
assert.equal(registry.hasRoute("rectification-form"), true);
assert.equal(registry.hasRoute("rectification-detail"), true);

const detail = registry.render("rectification-detail", context);
assert.match(detail, /data-rectification-view="detail"/);
assert.match(detail, /ZG004/);

const form = registry.render("rectification-form", context);
assert.match(form, /data-rectification-view="form"/);
assert.match(form, /新建溯源整改单/);
assert.doesNotMatch(form, /整改发起阶段填写/);
assert.doesNotMatch(form, /整改方案与整改成果由处理员在后续节点填写/);
assert.match(form, /data-test-field="整改单名称"/);
assert.match(form, /data-test-field="投诉原因标签" data-summary-levels="2"/);
assert.match(form, /save-rectification-draft/);
assert.match(form, /submit-rectification/);
assert.equal(registry.handleAction("new-rectification", {}, { ...context, page:"rectification-create" }), true);
assert.equal(openedFormId, "");
assert.equal(registry.handleAction("edit-rectification", { id:"ZG001" }, { ...context, page:"rectification-create" }), true);
assert.equal(openedFormId, "ZG001");
assert.equal(registry.handleAction("save-rectification-draft", {}, { ...context, page:"rectification-form" }), true);
assert.equal(registry.handleAction("submit-rectification", {}, { ...context, page:"rectification-form" }), true);
assert.equal(savedDrafts, 1);
assert.equal(submittedForms, 1);

let viewListener;
let tabListener;
const viewBtn = { dataset:{ rectificationView:"org" }, addEventListener:(name, listener) => { if (name === "click") viewListener = listener; } };
const tab = { dataset:{ rectificationTab:"all" }, addEventListener:(name, listener) => { if (name === "click") tabListener = listener; } };
registry.afterRender({
  querySelectorAll: selector => selector === "[data-rectification-view]" ? [viewBtn] : selector === "[data-rectification-tab]" ? [tab] : []
}, "rectification-create", context);
viewListener();
assert.equal(rerenders, 1);
tabListener();
assert.equal(rerenders, 2);
for (const page of ["rectification-create", "rectification-process", "rectification-approve"]) {
  const renderedList = registry.render(page, context);
  assert.doesNotMatch(renderedList, /data-rectification-sort-index/);
  assert.doesNotMatch(renderedList, /aria-label="按[^"]+排序"/);
}

console.log("Complaint rectification module checks passed.");
