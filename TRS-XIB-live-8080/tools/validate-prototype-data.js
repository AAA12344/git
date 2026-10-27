const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const readJson = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));

const formSchema = readJson("form-schema.json");
const workflowSchema = readJson("workflow-schema.json");
const statusTagConfig = readJson("status-tag-config.json");
const seedData = readJson("seed-data.json");
const organizationTree = readJson("organization-tree.json");
const rectificationDictionaries = readJson("rectification-tag-dictionaries.json");
const formFieldRows = fs.readFileSync(path.join(dataDir, "form-fields.csv"), "utf8").split(/\r?\n/);
const errors = [];
const organizations = organizationTree.organizations || [];
const warnings = [];

const processingNoticeRows = formFieldRows.filter(row => row.includes(",处理结果是否告知,处理结果是否告知,"));
if (processingNoticeRows.length !== 4) errors.push(`字段清单中的处理结果是否告知应覆盖四类主单，当前为 ${processingNoticeRows.length} 类`);
for (const row of processingNoticeRows) {
  if (!row.includes(",下拉选择器,")) errors.push("字段清单中的处理结果是否告知必须与 schema 一致使用下拉选择器");
}

const reliefNoticeRows = formFieldRows.filter(row => row.includes(",救济途径是否告知,救济途径是否告知,"));
if (reliefNoticeRows.length !== 1) errors.push(`字段清单中的救济途径是否告知应仅覆盖投诉单，当前为 ${reliefNoticeRows.length} 条`);
for (const row of reliefNoticeRows) {
  if (!row.includes(",单选,")) errors.push("字段清单中的救济途径是否告知必须与 schema 一致使用单选");
  if (!row.includes('"[""是"",""否""]"')) errors.push("字段清单中的救济途径是否告知选项必须为是、否");
}

function validateOrganizationTree() {
  const byId = new Map();
  for (const org of organizations) {
    if (!org.id) errors.push("机构树存在空编号");
    else if (byId.has(org.id)) errors.push(`机构树存在重复编号：${org.id}`);
    else byId.set(org.id, org);
  }
  const roots = organizations.filter(org => !org.parentId);
  if (roots.length !== 1) errors.push(`机构树应有且仅有一个根节点，当前为 ${roots.length} 个`);
  const depthCache = new Map();
  const resolveDepth = org => {
    if (!org) return -1;
    if (depthCache.has(org.id)) return depthCache.get(org.id);
    if (!org.parentId) {
      depthCache.set(org.id, 0);
      return 0;
    }
    const parent = byId.get(org.parentId);
    if (!parent) return NaN;
    const depth = resolveDepth(parent) + 1;
    depthCache.set(org.id, depth);
    return depth;
  };
  for (const org of organizations) {
    const calculatedDepth = resolveDepth(org);
    if (Number.isNaN(calculatedDepth)) errors.push(`机构 ${org.id} 的上级机构不存在：${org.parentId}`);
    if (!org.parentId) continue;
    const parent = byId.get(org.parentId);
    if (!parent) continue;
    const visited = new Set([org.id]);
    let cursor = parent;
    while (cursor) {
      if (visited.has(cursor.id)) { errors.push(`机构树存在循环关系：${org.id}`); break; }
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : null;
    }
  }
}

validateOrganizationTree();

function uniqueIds(records, label) {
  const seen = new Set();
  for (const record of records) {
    if (!record.id) errors.push(`${label}存在空编号`);
    else if (seen.has(record.id)) errors.push(`${label}存在重复编号：${record.id}`);
    seen.add(record.id);
  }
  return seen;
}

function validateStateMachine(name, machine) {
  const statuses = new Set(machine.statuses || []);
  if (!statuses.size) errors.push(`${name}状态机没有状态`);
  for (const [event, mapping] of Object.entries(machine.transitions || {})) {
    for (const [from, to] of Object.entries(mapping || {})) {
      if (!statuses.has(from)) errors.push(`${name}.${event} 的来源状态不存在：${from}`);
      if (!statuses.has(to)) errors.push(`${name}.${event} 的目标状态不存在：${to}`);
    }
  }
}

const machines = workflowSchema.documentStateMachines || {};
Object.entries(machines).forEach(([name, machine]) => validateStateMachine(name, machine));

function validateStatusTagConfig() {
  const palettes = statusTagConfig.palettes || {};
  const statuses = statusTagConfig.statuses || {};
  const colorPattern = /^#[0-9A-F]{6}$/i;
  if (!palettes[statusTagConfig.defaultPalette]) errors.push("状态标签默认调色板不存在");
  for (const [name, palette] of Object.entries(palettes)) {
    if (!colorPattern.test(palette.textColor || "")) errors.push(`状态标签调色板 ${name} 的文字颜色无效`);
    if (!colorPattern.test(palette.backgroundColor || "")) errors.push(`状态标签调色板 ${name} 的背景颜色无效`);
  }
  for (const [status, palette] of Object.entries(statuses)) {
    if (!palettes[palette]) errors.push(`状态标签 ${status} 引用了不存在的调色板：${palette}`);
  }
  for (const rule of statusTagConfig.fallbackRules || []) {
    if (!Array.isArray(rule.keywords) || !rule.keywords.length) errors.push("状态标签兜底规则缺少关键词");
    if (!palettes[rule.palette]) errors.push(`状态标签兜底规则引用了不存在的调色板：${rule.palette}`);
  }
  for (const [machineName, machine] of Object.entries(machines)) {
    for (const status of machine.statuses || []) {
      if (!statuses[status]) errors.push(`${machineName} 状态缺少标签配置：${status}`);
    }
  }
}

validateStatusTagConfig();

// 主工单/子流程状态以 workflow-schema.json 为唯一来源；表单 schema 不再重复维护状态枚举，避免双写漂移。
const configuredStatusLists = {
  ticket: formSchema.work_orders?.statuses || [],
  subprocess: formSchema.subprocesses?.statuses || []
};
for (const [name, configuredStatuses] of Object.entries(configuredStatusLists)) {
  const machineStatuses = machines[name]?.statuses || [];
  if (configuredStatuses.length && JSON.stringify(configuredStatuses) !== JSON.stringify(machineStatuses)) {
    errors.push(name + " 的表单状态枚举与工作流状态机不一致");
  }
}

const expectedTicketStatusMatrix = {
  "投诉单": ["草稿", "待提交", "待复核", "复核中", "待处理", "处理中", "会签中", "待审批", "审批中", "已办结", "已废止"],
  "信访单": ["草稿", "待提交", "待处理", "处理中", "待初审", "初审中", "待审批", "审批中", "已办结", "已废止"],
  "建议单": ["草稿", "待提交", "待复核", "复核中", "待处理", "处理中", "待审批", "审批中", "已办结", "已废止"],
  "表扬单": ["草稿", "待提交", "待复核", "复核中", "待处理", "处理中", "待审批", "审批中", "已办结", "已废止"]
};
for (const [type, statuses] of Object.entries(expectedTicketStatusMatrix)) {
  const configured = Object.keys(machines.ticket?.typeStatusMatrix?.[type] || {});
  if (JSON.stringify(configured) !== JSON.stringify(statuses)) errors.push(`${type} 主单状态矩阵不符合确认规则：${configured.join("、")}`);
}
if (machines.ticket?.statuses?.includes("待补录")) errors.push("主工单状态机不应包含待补录");
if (machines.ticket?.transitions?.submitProcessingToInitial?.["处理中"] !== "待初审" || machines.ticket?.transitions?.startInitial?.["待初审"] !== "初审中" || machines.ticket?.transitions?.passInitial?.["初审中"] !== "待审批" || machines.ticket?.transitions?.rejectInitial?.["初审中"] !== "处理中") errors.push("主工单初审状态转换不完整");
const expectedWorkflowRecordCodes = ["operatorName", "operatorRoleName", "operatorOrgName", "flowSceneName", "flowOpinion", "receiverName", "statusTransition", "operationTime"];
if (JSON.stringify((workflowSchema.workflowRecordSchema?.fields || []).map(field => field.code)) !== JSON.stringify(expectedWorkflowRecordCodes)) errors.push("流转记录字段契约必须固定为八字段顺序");
const workflowRecordTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
for (const [documentType, histories] of Object.entries(seedData.workflowHistory || {})) {
  for (const [documentId, records] of Object.entries(histories || {})) {
    for (const [recordIndex, record] of (records || []).entries()) {
      const location = `${documentType} ${documentId} 第 ${recordIndex + 1} 条流转记录`;
      const missingCodes = expectedWorkflowRecordCodes.filter(code => !Object.prototype.hasOwnProperty.call(record, code));
      if (missingCodes.length) errors.push(`${location} 缺少字段：${missingCodes.join("、")}`);
      if (Object.keys(record).some(code => ["actor", "role", "org", "action", "opinion", "receiver", "from", "to", "time"].includes(code))) errors.push(`${location} 仍使用旧版字段`);
      if (record.operationTime && record.operationTime !== "-" && !workflowRecordTimePattern.test(record.operationTime)) errors.push(`${location} 的操作时间不是 YYYY-MM-DD HH:mm:ss`);
      if (record.statusTransition && record.statusTransition !== "-" && !String(record.statusTransition).includes(" → ")) errors.push(`${location} 的状态流转未使用“原状态 → 新状态”格式`);
      if (record.operatorName === "系统" && record.operatorRoleName !== "-") errors.push(`${location} 的系统操作角色必须显示为“-”`);
      if (!/(转派|驳回|回填)/.test(String(record.flowSceneName || "")) && record.flowOpinion) errors.push(`${location} 的普通操作不应写入流转意见`);
    }
  }
}

const tickets = seedData.lists?.tickets || [];
const subprocesses = seedData.lists?.subprocesses || [];
const rectifications = seedData.lists?.rectifications || [];
const approvals = seedData.lists?.approvals || [];
const noApprovalSubprocessTypes = new Set(workflowSchema.approvalRules?.subprocessNoApprovalTypes || []);
const ticketCountersignTypes = new Set(workflowSchema.approvalRules?.ticketCountersignTypes || []);
const ticketIds = uniqueIds(tickets, "主工单");
const ticketEntryFields = (formSchema.work_orders?.entry_sections || [])
  .flatMap(section => section.fields || [])
  .filter(field => field.type !== "aiAction" && !String(field.name || "").startsWith("修正"));
const complaintOnlyRequiredSectionIds = ["pboc", "regulatory"];
for (const sectionId of complaintOnlyRequiredSectionIds) {
  const section = (formSchema.work_orders?.entry_sections || []).find(item => item.id === sectionId);
  if (!section) {
    errors.push(`主工单缺少${sectionId === "pboc" ? "人行标准" : "金管投诉分类"}分区`);
    continue;
  }
  const inputFields = (section.fields || []).filter(field => field.type !== "aiAction");
  if (!inputFields.length || inputFields.some(field => JSON.stringify(field.types) !== JSON.stringify(["投诉单"]))) {
    errors.push(`${section.title}必须仅适用于投诉单`);
  }
  if (inputFields.some(field => !field.required)) errors.push(`${section.title}的全部录入字段必须设为必填`);
}
const complaintClassificationFieldNames = complaintOnlyRequiredSectionIds
  .flatMap(sectionId => (formSchema.work_orders?.entry_sections || []).find(section => section.id === sectionId)?.fields || [])
  .filter(field => field.type !== "aiAction")
  .map(field => field.name)
  .concat("主体诉求");
const contentSection = (formSchema.work_orders?.entry_sections || []).find(section => section.id === "content");
const subjectAppealField = contentSection?.fields?.find(field => field.name === "主体诉求");
const contentAttachmentField = contentSection?.fields?.find(field => field.name === "附件");
if (!subjectAppealField || subjectAppealField.type !== "textarea" || !subjectAppealField.required || JSON.stringify(subjectAppealField.types) !== JSON.stringify(["投诉单"]) || contentSection.fields.at(-2)?.name !== "主体诉求") {
  errors.push("主体诉求必须位于工单具体内容的附件之前，且为投诉单专属必填长文本框");
}
if (!contentAttachmentField || contentAttachmentField.type !== "upload" || !contentAttachmentField.all || contentSection.fields.at(-1)?.name !== "附件") errors.push("附件必须作为所有工单通用的工单具体内容末尾上传字段");
if ((formSchema.work_orders?.entry_sections || []).find(section => section.id === "regulatory")?.fields?.some(field => field.name === "主体诉求")) errors.push("金管投诉分类分区不应继续包含主体诉求");
const intelligentTagSection = (formSchema.work_orders?.entry_sections || []).find(section => section.id === "intelligent-tags");
const intelligentDispatchSection = (formSchema.work_orders?.entry_sections || []).find(section => section.id === "intelligent-dispatch");
const intelligentTagFields = intelligentTagSection?.fields || [];
const aiTagAction = intelligentTagFields.find(field => field.type === "aiAction");
const productTagField = intelligentTagFields.find(field => field.name === "投诉产品标签");
const aiOnlyTagNames = ["业务办理渠道标签", "投诉原因标签", "投诉诉求标签"];
if (intelligentTagSection?.positionAfter !== "content") errors.push("智能标签必须紧接工单具体内容分区");
if (intelligentTagFields[0]?.name !== "AI 智能打标" || JSON.stringify(aiTagAction?.types) !== JSON.stringify(["投诉单", "信访单"])) errors.push("AI 智能打标必须位于智能标签顶部且仅适用于投诉单、信访单");
if (JSON.stringify(productTagField?.types) !== JSON.stringify(["投诉单", "信访单", "建议单", "表扬单"])) errors.push("投诉产品标签的适用工单类型配置不正确");
for (const name of aiOnlyTagNames) {
  const field = intelligentTagFields.find(item => item.name === name);
  if (JSON.stringify(field?.types) !== JSON.stringify(["投诉单", "信访单"])) errors.push(`${name}必须仅适用于投诉单、信访单`);
}
if (intelligentTagSection?.titleBy?.["建议单"] !== "标签信息" || intelligentTagSection?.titleBy?.["表扬单"] !== "标签信息") errors.push("建议单、表扬单的智能标签分区必须显示为标签信息");
if (intelligentDispatchSection?.titleBy?.["建议单"] !== "派发信息" || intelligentDispatchSection?.titleBy?.["表扬单"] !== "派发信息") errors.push("建议单、表扬单的智能派发分区必须显示为派发信息");
if (JSON.stringify(seedData).includes("业务类型标签") || JSON.stringify(seedData).includes("修正业务类型标签")) errors.push("样例数据仍包含旧标签字段名");
function ticketEntryFieldVisible(field, type, entry) {
  if (!(field.all || (field.types || []).includes(type))) return false;
  if (field.autoDispatchCc) return populatedTicketEntryValue(entry?.[field.name]);
  const condition = field.showWhen;
  if (!condition) return true;
  const current = entry?.[condition.key];
  if (Object.prototype.hasOwnProperty.call(condition, "equals")) return current === condition.equals;
  if (Array.isArray(condition.in)) return condition.in.includes(current);
  if (Object.prototype.hasOwnProperty.call(condition, "notEquals")) return current !== condition.notEquals;
  return true;
}
function populatedTicketEntryValue(value) {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}
uniqueIds(subprocesses, "子流程单");
uniqueIds(rectifications, "溯源整改单");

for (const ticket of tickets) {
  if (!machines.ticket?.statuses?.includes(ticket.status)) errors.push(`主工单 ${ticket.id} 使用非法状态：${ticket.status}`);
  if (ticket.type !== "舆情单" && !machines.ticket?.typeStatusMatrix?.[ticket.type]?.[ticket.status]) errors.push(`主工单 ${ticket.id} 的类型不允许状态：${ticket.type} / ${ticket.status}`);
  if (ticket.status === "会签中" && !ticketCountersignTypes.has(ticket.type)) errors.push(`只有配置的投诉类主工单可以处于会签中：${ticket.id} / ${ticket.type}`);
  const detail = seedData.documentData?.tickets?.[ticket.id];
  if (!detail) errors.push(`主工单 ${ticket.id} 缺少 documentData 完整记录`);
  else {
    for (const stage of ["entry", "processing", "review", "initialApproval", "countersign", "approval"]) {
      if (!detail.fields || typeof detail.fields[stage] !== "object") errors.push(`主工单 ${ticket.id} 缺少 fields.${stage}`);
    }
    const entry = detail.fields?.entry || {};
    const inapplicableComplaintFields = ticket.type === "投诉单" ? [] : complaintClassificationFieldNames.filter(name => Object.prototype.hasOwnProperty.call(entry, name));
    if (inapplicableComplaintFields.length) errors.push(`非投诉主工单 ${ticket.id} 不应保存投诉分类字段：${inapplicableComplaintFields.join("、")}`);
    if (["建议单", "表扬单"].includes(ticket.type)) {
      const inapplicableSmartTags = aiOnlyTagNames.filter(name => Object.prototype.hasOwnProperty.call(entry, name));
      if (inapplicableSmartTags.length) errors.push(`${ticket.type} ${ticket.id} 仅应保存投诉产品标签：${inapplicableSmartTags.join("、")}`);
      if (!populatedTicketEntryValue(entry["投诉产品标签"])) errors.push(`${ticket.type} ${ticket.id} 缺少投诉产品标签样例`);
    }
    if (ticket.status !== "草稿") {
      const missingEntryFields = ticketEntryFields.filter(field => ticketEntryFieldVisible(field, ticket.type, entry) && !populatedTicketEntryValue(entry[field.name])).map(field => field.name);
      if (missingEntryFields.length) errors.push(`主工单 ${ticket.id} 缺少适用录入字段：${[...new Set(missingEntryFields)].join("、")}`);
    }
    const receivingInstitution = detail.fields?.entry?.["工单接收机构"] || "";
    if (ticket.status === "草稿" && receivingInstitution) errors.push(`草稿工单 ${ticket.id} 不应已有工单接收机构`);
    if (ticket.status !== "草稿" && receivingInstitution !== ticket.org) errors.push(`工单 ${ticket.id} 的工单接收机构与当前流转机构不一致`);
  }
}
if (JSON.stringify([...ticketCountersignTypes]) !== JSON.stringify(["投诉单"])) errors.push("会签规则必须且只能配置投诉单");
if (!tickets.some(ticket => ticket.type === "投诉单" && ticket.status === "会签中")) errors.push("演示数据缺少会签中的投诉单");
if (!tickets.some(ticket => ticket.type === "信访单" && ticket.status === "待初审") || !tickets.some(ticket => ticket.type === "信访单" && ticket.status === "初审中")) errors.push("信访单缺少待初审和初审中状态样例");
const supplementSections = formSchema.subprocesses?.supplement_sections || {};
const expectedSupplementFields = {
  "延长申请": ["是否告知延期", "告知延期时间", "告知延期方式"],
  "异常投诉": ["异常认定结果"],
  "剔除申请": ["剔除认定结果"]
};
for (const [type, names] of Object.entries(expectedSupplementFields)) {
  const configured = (supplementSections[type] || []).flatMap(section => section.fields || []).map(field => field.name);
  if (JSON.stringify(configured) !== JSON.stringify(names)) errors.push(`${type} 补录字段配置不完整：${configured.join("、")}`);
  if (!subprocesses.some(record => record.type === type && record.status === "待补录")) errors.push(`${type} 缺少待补录样例`);
}
const recordingNumberField = ticketEntryFields.find(field => field.name === "录音编号");
if (!recordingNumberField || recordingNumberField.hint !== undefined) errors.push("录音编号字段不应显示 field-hint");
const countersignField = formSchema.work_orders?.processing_fields?.find(field => field.name === "是否会签");
if (!countersignField || JSON.stringify(countersignField.types) !== JSON.stringify(["投诉单"]) || !countersignField.required) errors.push("处理字段‘是否会签’必须仅用于投诉单且必填");
const complaintObjectEntryField = ticketEntryFields.find(field => field.labelBy?.["投诉单"] === "投诉对象" || field.name === "投诉对象");
const complaintObjectProcessingField = formSchema.work_orders?.processing_fields?.find(field => field.name === "投诉对象");
const complaintSubjectIndex = ticketEntryFields.findIndex(field => field.name === "投诉/信访事项");
if (!complaintObjectEntryField || complaintObjectEntryField.type !== "text" || complaintObjectEntryField.dependsOn || complaintObjectEntryField.required || complaintObjectEntryField.hint || complaintObjectEntryField.span || ticketEntryFields[complaintSubjectIndex - 1]?.name !== "投诉对象") errors.push("投诉对象必须是无提示、非必填的二分之一宽度填写框，位于投诉事项前方");
if (complaintObjectProcessingField) errors.push("投诉对象不应继续配置在处理结果阶段");
for (const ticket of tickets.filter(item => item.type === "投诉单")) {
  const document = seedData.documentData?.tickets?.[ticket.id];
  if (Object.prototype.hasOwnProperty.call(document?.fields?.processing || {}, "投诉对象")) errors.push(`投诉单 ${ticket.id} 的处理阶段仍保存投诉对象`);
}
const countersignOrganizationField = formSchema.work_orders?.processing_fields?.find(field => field.name === "会签机构");
if (!countersignOrganizationField || countersignOrganizationField.type !== "hierarchyCascader" || countersignOrganizationField.dictionary !== "institutionTree" || !countersignOrganizationField.multiple || countersignOrganizationField.requiredWhen?.key !== "是否会签") errors.push("会签机构必须是由‘是否会签=是’触发并加载机构业务字典的多选字段");
const businessLineField = (formSchema.work_orders?.entry_sections || []).flatMap(section => section.fields || []).find(field => field.name === "所属业务条线");
const expectedPrimaryBusinessLines = ["零售金融部", "普惠金融部", "公司金融部", "消费者权益保护部"];
const expectedOptionalBusinessLines = ["运营管理部", "风险管理部", "安全保卫部/总务部", "授信审批部", "华侨金融部", "特殊资产经营部", "科技管理部", "科技开发部", "科技运维部"];
if (!businessLineField || businessLineField.type !== "businessLinePicker" || !businessLineField.required || JSON.stringify(businessLineField.primaryOptions) !== JSON.stringify(expectedPrimaryBusinessLines) || JSON.stringify(businessLineField.optionalOptions) !== JSON.stringify(expectedOptionalBusinessLines)) errors.push("所属业务条线必须为必选四选一、可选最多选一的最新字典");
for (const ticket of tickets) {
  const value = seedData.documentData?.tickets?.[ticket.id]?.fields?.entry?.["所属业务条线"];
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`主工单 ${ticket.id} 的所属业务条线必须结构化存储`); continue; }
  if (!expectedPrimaryBusinessLines.includes(value.primary)) errors.push(`主工单 ${ticket.id} 的必选条线不在最新字典中：${value.primary || "-"}`);
  if (value.optional && !expectedOptionalBusinessLines.includes(value.optional)) errors.push(`主工单 ${ticket.id} 的可选条线不在最新字典中：${value.optional}`);
}
const dispatchFields = (formSchema.work_orders?.entry_sections || []).flatMap(section => section.fields || []).filter(field => ["派发机构", "派发部门", "抄送人"].includes(field.name));
const dispatchInstitutionField = dispatchFields.find(field => field.name === "派发机构");
const dispatchDepartmentField = dispatchFields.find(field => field.name === "派发部门");
const dispatchCopyField = dispatchFields.find(field => field.name === "抄送人");
if (!dispatchInstitutionField || dispatchInstitutionField.dictionary !== "institutionTree" || dispatchInstitutionField.multiple !== false || dispatchInstitutionField.includeDescendantsOption !== false) errors.push("派发机构必须使用总行/分行/支行机构字典单选");
if (!dispatchDepartmentField || dispatchDepartmentField.type !== "select" || dispatchDepartmentField.optionsByInstitution?.key !== "派发机构" || !dispatchDepartmentField.required) errors.push("派发部门必须按派发机构联动并设为必填");
if (!dispatchCopyField || dispatchCopyField.type !== "readonly" || !dispatchCopyField.disabled || !dispatchCopyField.autoDispatchCc || dispatchCopyField.placeholder !== "-") errors.push("智能派发抄送人必须为只读、条件自动回填的业务员字段");
if ((formSchema.work_orders?.processing_fields || []).some(field => field.displaySection === "关联子流程信息")) errors.push("工单处理字段不应重复维护关联子流程信息区块");
const expectedSubprocessCopyRecipients = { "CX202608030001":"林海-38102", "JZ202608030003":"陈敏慧-60157", "YC202607310107":"审批员（总行消保部主管）" };
for (const [id, expected] of Object.entries(expectedSubprocessCopyRecipients)) {
  const actual = seedData.documentData?.subprocesses?.[id]?.fields?.base?.["抄送人"];
  if (actual !== expected) errors.push(`子流程 ${id} 的抄送人样例不符合规则：${actual || "-"}`);
}
const expectedOrganizationDictionaries = new Map([["投诉/信访/表扬机构", "institutionTree"], ["派发机构", "institutionTree"], ["会签机构", "institutionTree"], ["责任机构", "institutionTree"], ["问责部门", "departmentTree"], ["整改部门或机构", "businessUnitTree"]]);
const schemaFields = [];
(function collectFields(value) { if (Array.isArray(value)) return value.forEach(collectFields); if (!value || typeof value !== "object") return; if (value.name && value.type) schemaFields.push(value); Object.values(value).forEach(collectFields); })(formSchema);
for (const [name, dictionary] of expectedOrganizationDictionaries) {
  const fields = schemaFields.filter(field => field.name === name);
  if (name === "问责部门") {
    if (!fields.length || fields.some(field => field.type !== "select" || field.optionsByInstitution?.key !== "问责机构")) {
      errors.push("问责部门必须按问责机构联动");
    }
    continue;
  }
  if (!fields.length || fields.some(field => field.dictionary !== dictionary)) errors.push(`${name} 未使用 ${dictionary} 业务字典`);
  const expectedLevels = dictionary === "institutionTree" ? ["总行/分行", "机构/下辖支行"] : dictionary === "departmentTree" ? ["总行/分行", "部门"] : ["总行/分行", "机构/部门/支行"];
  if (fields.some(field => field.leafLevel !== 2 || field.nonLeafSelectable !== false || JSON.stringify(field.levels) !== JSON.stringify(expectedLevels))) errors.push(`${name} 未使用规定的二级级联结构：${expectedLevels.join(" → ")}`);
}
const countersignSample = tickets.find(ticket => ticket.status === "会签中");
const countersignDocument = seedData.documentData?.tickets?.[countersignSample?.id];
const countersignProcessing = countersignDocument?.fields?.processing || {};
const countersignMembers = countersignDocument?.fields?.countersign?.["会签明细"] || [];
if (countersignProcessing["是否会签"] !== "是" || !Array.isArray(countersignProcessing["会签机构"]) || countersignProcessing["会签机构"].length < 2) errors.push("会签中投诉单的处理结果未保存多个会签机构");
if ((countersignProcessing["会签机构"] || []).some(value => String(value).split(" / ").length !== 2)) errors.push("会签机构样例未保存为‘总行/分行 / 机构’二级路径");
if (JSON.stringify(seedData).includes("\"机构 / ") || JSON.stringify(seedData).includes("\"部门 / ")) errors.push("样例数据仍包含旧的机构/部门分类前缀");
if (!Array.isArray(countersignMembers) || countersignMembers.length < 2 || new Set(countersignMembers.map(item => item["会签人"])).size < 2 || countersignMembers.some(item => !item["会签机构"] || !item["会签人"])) errors.push("会签中投诉单缺少多人会签样例明细");
if (machines.ticket?.transitions?.submitProcessingToCountersign?.["处理中"] !== "会签中" || machines.ticket?.transitions?.passCountersign?.["会签中"] !== "待审批" || machines.ticket?.transitions?.rejectCountersign?.["会签中"] !== "处理中") errors.push("投诉单会签状态转换不完整");

for (const record of subprocesses) {
  if (!machines.subprocess?.statuses?.includes(record.status)) errors.push(`子流程单 ${record.id} 使用非法状态：${record.status}`);
  const detail = seedData.documentData?.subprocesses?.[record.id];
  if (!detail) errors.push(`子流程单 ${record.id} 缺少 documentData 完整记录`);
  if (record.relatedTicketId && !ticketIds.has(record.relatedTicketId)) warnings.push(`子流程单 ${record.id} 关联的是历史/外部工单：${record.relatedTicketId}`);
  if (noApprovalSubprocessTypes.has(record.type)) {
    if (["待审批", "审批中"].includes(record.status)) errors.push(`免审批子流程 ${record.id} 不应处于审批状态：${record.status}`);
    if (approvals.some(item => item.id === record.id || item.businessType === record.type)) errors.push(`免审批子流程 ${record.id} 不应生成审批待办`);
    if (detail && (Object.keys(detail.fields?.initialApproval || {}).length || Object.keys(detail.fields?.approval || {}).length)) errors.push(`免审批子流程 ${record.id} 不应保存审批字段`);
  }
}

const accountabilityRecords = subprocesses.filter(record => record.type === "投诉问责");
const accountabilityTriggerModes = new Set(["人工触发", "系统自动触发"]);
for (const record of accountabilityRecords) {
  const detail = seedData.documentData?.subprocesses?.[record.id];
  const triggerMode = detail?.fields?.base?.["触发方式"];
  if (!accountabilityTriggerModes.has(triggerMode)) errors.push(`投诉问责 ${record.id} 缺少合法触发方式：${triggerMode || "-"}`);
  if (triggerMode === "人工触发" && ["待处理", "处理中"].includes(record.status)) errors.push(`人工触发投诉问责 ${record.id} 不应进入处理状态：${record.status}`);
  const transitions = (seedData.workflowHistory?.subprocess?.[record.id] || []).map(item => item.statusTransition || "");
  if (triggerMode === "人工触发" && transitions.some(value => value.includes("待处理") || value.includes("处理中"))) errors.push(`人工触发投诉问责 ${record.id} 的流转记录不应包含处理节点`);
  if (triggerMode === "系统自动触发" && !transitions.some(value => value.includes("待处理"))) errors.push(`系统自动触发投诉问责 ${record.id} 的流转记录必须包含待处理节点`);
}
for (const status of ["待处理", "处理中"]) {
  if (!accountabilityRecords.some(record => record.status === status && seedData.documentData?.subprocesses?.[record.id]?.fields?.base?.["触发方式"] === "系统自动触发")) {
    errors.push(`投诉问责缺少系统自动触发的“${status}”样例`);
  }
}
const accountabilityTriggerField = formSchema.subprocesses?.base_field_rules?.type_fields?.["投诉问责"]?.find(field => field.name === "触发方式");
if (!accountabilityTriggerField || accountabilityTriggerField.type !== "readonly" || accountabilityTriggerField.editable !== false) errors.push("投诉问责触发方式必须在详情中只读展示");

const requiredRectificationFields = {
  base: ["创建人", "所属机构", "所属部门", "溯源整改单编号", "申请时间", "办结时间"],
  entry: ["整改单名称", "投诉产品标签", "投诉原因标签", "问题来源", "问题描述", "整改部门或机构", "整改负责人（处置员）"],
  plan: ["整改计划", "整改开始时间", "计划完成时间", "提交时间", "执行部门/团队"],
  result: ["工作成果说明"],
  statistics: ["投诉产品标签", "投诉原因标签", "统计周期", "统计机构", "comparison", "trend"]
};
const planRectificationStates = new Set(["方案待提交", "方案待初审", "方案待审批", "整改中", "结果待初审", "结果待审批", "已办结"]);
const submittedResultStates = new Set(["结果待初审", "结果待审批", "已办结"]);
function requireRectificationFields(id, stage, values, names) {
  for (const name of names) {
    const value = values?.[name];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) errors.push(`溯源整改单 ${id} 在 ${stage} 阶段缺少字段：${name}`);
  }
}
for (const record of rectifications) {
  if (!machines.rectification?.statuses?.includes(record.status)) errors.push(`溯源整改单 ${record.id} 使用非法状态：${record.status}`);
  const detail = seedData.documentData?.rectifications?.[record.id];
  if (!detail) {
    errors.push(`溯源整改单 ${record.id} 缺少 documentData 完整记录`);
    continue;
  }
  requireRectificationFields(record.id, "基础信息", detail.fields?.base, requiredRectificationFields.base);
  if (!["草稿", "已废止"].includes(record.status)) requireRectificationFields(record.id, "创建整改问题", detail.fields?.entry, requiredRectificationFields.entry);
  if (planRectificationStates.has(record.status)) requireRectificationFields(record.id, "制定整改计划", detail.fields?.plan, requiredRectificationFields.plan);
  if (submittedResultStates.has(record.status)) {
    requireRectificationFields(record.id, "填写整改结果", detail.fields?.result, requiredRectificationFields.result);
    requireRectificationFields(record.id, "整改统计", detail.fields?.statistics, requiredRectificationFields.statistics);
  }
}

const rectificationSections = formSchema.subprocesses?.field_sections?.["溯源整改"] || [];
const rectificationSectionNames = rectificationSections.map(section => section.title);
for (const expected of ["整改问题", "整改方案", "整改结果", "整改结果-投诉统计"]) {
  if (!rectificationSectionNames.includes(expected)) errors.push(`溯源整改字段配置缺少阶段：${expected}`);
}

const expectedRectificationFieldNames = {
  "整改问题": ["整改单名称", "投诉产品标签", "投诉原因标签", "问题来源", "具体问题来源", "关联工单编号", "问题描述", "整改部门或机构", "整改负责人（处置员）", "抄送人", "附件"],
  "整改方案": ["整改计划", "整改开始时间", "计划完成时间", "附件", "提交时间", "执行部门/团队"],
  "整改结果": ["工作成果说明", "附件"],
  "整改结果-投诉统计": ["投诉产品标签", "投诉原因标签", "统计周期", "统计机构", "日均投诉量变化对比图", "投诉标签变化趋势"]
};
for (const section of rectificationSections) {
  const actual = section.fields.map(field => field.name);
  const expected = expectedRectificationFieldNames[section.title] || [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`溯源整改 ${section.title} 字段中文名或顺序不符合字段表：${actual.join("、")}`);
}
const expectedRectificationStatuses = ["草稿", "问题待提交", "问题待审核", "方案待提交", "方案待初审", "方案待审批", "整改中", "结果待初审", "结果待审批", "已办结", "已废止"];
if (JSON.stringify(machines.rectification?.statuses || []) !== JSON.stringify(expectedRectificationStatuses)) errors.push("溯源整改状态机顺序不符合确认顺序");
const productLeafPaths = new Set((rectificationDictionaries.productTree || []).flatMap(first => (first.children || []).flatMap(second => (second.children || []).map(third => [first.label, second.label, third.label].join(" / ")))));
const causeLeafPaths = new Set((rectificationDictionaries.causeTree || []).flatMap(first => (first.children || []).flatMap(second => (second.children || []).map(third => [first.label, second.label, third.label].join(" / ")))));
if (productLeafPaths.size !== 71) errors.push(`产品标签字典三级叶子数量异常：${productLeafPaths.size}`);
if (causeLeafPaths.size !== 469) errors.push(`原因标签字典三级叶子数量异常：${causeLeafPaths.size}`);
if ((rectificationDictionaries.causeTree || []).some(first => !(first.children || []).length || first.children.some(second => !(second.children || []).length))) errors.push("投诉原因标签字典存在缺少三级叶子的分支");
const complaintReasonFields = [];
const collectComplaintReasonFields = value => {
  if (Array.isArray(value)) return value.forEach(collectComplaintReasonFields);
  if (!value || typeof value !== "object") return;
  if (value.dictionary === "rectificationCause") complaintReasonFields.push(value);
  Object.values(value).forEach(collectComplaintReasonFields);
};
collectComplaintReasonFields(formSchema);
for (const field of complaintReasonFields) {
  if (field.leafLevel !== 3 || (field.levels || []).length !== 3 || field.tree) errors.push(`原因标签字段未统一使用集中式三级字典：${field.name || "未命名字段"}`);
}
for (const record of rectifications) {
  const detail = seedData.documentData?.rectifications?.[record.id];
  for (const product of detail?.fields?.entry?.["投诉产品标签"] || []) if (!productLeafPaths.has(product)) errors.push(`溯源整改单 ${record.id} 使用非法三级产品标签：${product}`);
  const cause = detail?.fields?.entry?.["投诉原因标签"];
  if (cause && !causeLeafPaths.has(cause)) errors.push(`溯源整改单 ${record.id} 使用非法三级原因标签：${cause}`);
  const statisticsCause = detail?.fields?.statistics?.["投诉原因标签"];
  if (statisticsCause && statisticsCause !== "全部" && !causeLeafPaths.has(statisticsCause)) errors.push(`溯源整改单 ${record.id} 统计筛选使用非法三级原因标签：${statisticsCause}`);
}
for (const [ticketId, detail] of Object.entries(seedData.documentData?.tickets || {})) {
  const cause = detail?.fields?.entry?.["投诉原因标签"];
  if (cause && !causeLeafPaths.has(cause)) errors.push(`主工单 ${ticketId} 使用非法三级原因标签：${cause}`);
}

const workOrderTypes = new Set(formSchema.work_orders?.document_types || []);
for (const ticket of tickets) {
  if (!workOrderTypes.has(ticket.type)) errors.push(`主工单 ${ticket.id} 使用未定义的类型：${ticket.type}`);
}

const report = {
  formSchemaVersion: formSchema.meta?.version,
  statusTagConfigVersion: statusTagConfig.meta?.version,
  storageVersion: seedData.meta?.storageVersion,
  counts: {
    tickets: tickets.length,
    subprocesses: subprocesses.length,
    rectifications: rectifications.length,
    organizations: organizations.length,
    completeDocuments:
      Object.keys(seedData.documentData?.tickets || {}).length +
      Object.keys(seedData.documentData?.subprocesses || {}).length +
      Object.keys(seedData.documentData?.rectifications || {}).length
  },
  errors,
  warnings
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
