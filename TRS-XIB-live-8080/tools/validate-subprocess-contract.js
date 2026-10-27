"use strict";
require("./test-correction-writeback");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const workflow = readJson("data/workflow-schema.json");
const forms = readJson("data/forms/subprocesses.json").subprocesses;
const mainWorkOrders = readJson("data/forms/main-work-orders.json").work_orders;
const seed = readJson("data/seed-data.json");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const errors = [];
if (!/function isManualAccountabilityDraft\(row[\s\S]*?row\?\.\[5\] === "草稿"/.test(appSource)) errors.push("manual accountability draft should be identified explicitly");
if (!/subprocessHasProcessingStage\(definitionOrType, row = null\)[\s\S]*?isManualAccountabilityDraft\(row\)/.test(appSource)) errors.push("manual accountability draft should display the processing tab");
if (!/renderSubprocessProcessingEditor\(definition, row, \{ allowSubmit: !manualAccountabilityDraft \}\)/.test(appSource)) errors.push("manual accountability draft processing editor should save without submit-processing action");
const byPrefix = Object.fromEntries((forms.definitions || []).map(item => [item.prefix, item.type]));
const abnormalDefinition = (forms.definitions || []).find(item => item.prefix === "YT");
if (abnormalDefinition?.document !== "异常投诉申请单") errors.push("abnormal complaint document label should be 异常投诉申请单");
const st = forms.statuses;
const matrixStatus = indexes => indexes.map(index => st[index]);
const expectedProcessTitles = {
  [byPrefix.YT]: [],
  [byPrefix.TC]: [forms.field_sections[byPrefix.TC]?.[0]?.title],
  [byPrefix.DC]: [forms.field_sections[byPrefix.DC]?.[1]?.title],
  [byPrefix.HC]: [forms.field_sections[byPrefix.HC]?.[2]?.title],
  [byPrefix.ZG]: forms.field_sections[byPrefix.ZG]?.filter(section => section.phase !== "create").map(section => section.title),
  [byPrefix.WZ]: ["投诉问责处理"]
};
const expectedMatrix = {
  [byPrefix.CX]: matrixStatus([0,1,2,3,11,12]),
  [byPrefix.FZ]: matrixStatus([0,1,2,3,6,7,8,9,11,12]),
  [byPrefix.JZ]: matrixStatus([0,1,2,3,8,9,11,12]),
  [byPrefix.YT]: matrixStatus([0,1,4,5,6,7,8,9,10,11,12]),
  [byPrefix.TC]: matrixStatus([0,1,4,5,6,7,8,9,10,11,12]),
  [byPrefix.YC]: matrixStatus([0,1,6,7,8,9,10,11,12]),
  [byPrefix.JF]: matrixStatus([0,1,8,9,11,12]),
  [byPrefix.DC]: matrixStatus([0,1,4,5,6,7,8,9,11,12]),
  [byPrefix.WZ]: matrixStatus([0,1,4,5,8,9,11,12]),
  [byPrefix.HC]: matrixStatus([0,1,4,5,6,7,8,9,11,12])
};
const machine = workflow.documentStateMachines.subprocess;
const handlerRejectableTypes = [byPrefix.DC, byPrefix.TC, byPrefix.YT, byPrefix.HC];
if (JSON.stringify(machine.transitions?.rejectProcessingToDraft) !== JSON.stringify({ "待处理":"待提交", "处理中":"待提交" })) errors.push("handler rejection should return pending/processing subprocesses to 待提交");
if (machine.flowScenes?.rejectProcessingToDraft !== "处理人驳回") errors.push("handler rejection flow scene should be 处理人驳回");
const rejectableTypeLiteral = /HANDLER_REJECTABLE_SUBPROCESS_TYPES\s*=\s*new Set\(\["投诉调查",\s*"剔除申请",\s*"异常投诉",\s*"异议核查"\]\)/;
if (!rejectableTypeLiteral.test(appSource)) errors.push("handler rejection should be limited to 投诉调查、剔除申请、异常投诉、异议核查");
if (!/function rejectSubprocessProcessing\(\)[\s\S]*?if \(!reason\)[\s\S]*?rejectProcessingToDraft[\s\S]*?action:"处理人驳回"/.test(appSource)) errors.push("handler rejection should require a reason and record 处理人驳回 history");
const processTypes = [byPrefix.YT, byPrefix.TC, byPrefix.DC, byPrefix.HC, byPrefix.WZ];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (!same(machine.statuses, forms.statuses)) errors.push("workflow statuses and form statuses differ");
if (forms.statuses.length !== 13) errors.push("subprocess status count should be 13");
for (const [type, expectedTitles] of Object.entries(expectedProcessTitles)) {
  if (!same(forms.process_section_titles[type] || [], expectedTitles || [])) errors.push(type + " process_section_titles differs");
}
for (const type of Object.keys(forms.process_section_titles || {})) {
  if (!Object.prototype.hasOwnProperty.call(expectedProcessTitles, type)) errors.push(type + " should not configure processing sections");
}
for (const [type, expected] of Object.entries(expectedMatrix)) {
  const configured = Object.keys(machine.typeStatusMatrix?.[type] || {});
  if (!same(configured, expected)) errors.push(type + " status matrix differs: " + configured.join(" -> "));
  const hasProcessing = processTypes.includes(type);
  const hasProcessingStatus = configured.includes(st[4]) || configured.includes(st[5]);
  if (hasProcessing !== hasProcessingStatus) errors.push(type + " processing fields and status matrix disagree");
}
for (const type of handlerRejectableTypes) if (!processTypes.includes(type)) errors.push(type + " should have a processing stage before handler rejection");
for (const type of [byPrefix.CX, byPrefix.FZ, byPrefix.JZ]) {
  if (machine.typeStatusMatrix[type]?.[st[2]] !== "customerService" || machine.typeStatusMatrix[type]?.[st[3]] !== "customerService") errors.push(type + " review node should be customerService only");
}
const processFieldNames = type => new Set((forms.field_sections[type] || [])
  .filter(section => (forms.process_section_titles[type] || []).includes(section.title))
  .flatMap(section => section.fields.map(field => field.name)));
for (const row of seed.lists.subprocesses || []) {
  const allowed = Object.keys(machine.typeStatusMatrix?.[row.type] || {});
  if (!allowed.includes(row.status)) errors.push(row.id + " status " + row.status + " is not allowed for " + row.type);
  const doc = seed.documentData.subprocesses?.[row.id];
  if (!doc) { errors.push(row.id + " has no documentData.subprocesses record"); continue; }
  const processing = doc.fields?.processing || {};
  const processingKeys = Object.keys(processing).filter(key => processing[key] !== undefined && processing[key] !== "");
  const hasProcessing = processTypes.includes(row.type);
  if (!hasProcessing && processingKeys.length) errors.push(row.id + " / " + row.type + " has no processing stage but fields.processing is not empty: " + processingKeys.join(", "));
  if (hasProcessing) {
    const allowedFields = processFieldNames(row.type);
    for (const key of processingKeys) if (!allowedFields.has(key)) errors.push(row.id + " / " + row.type + " processing field is not in schema: " + key);
  }
  const supplementKeys = Object.keys(doc.fields?.supplement || {}).filter(key => doc.fields.supplement[key] !== undefined && doc.fields.supplement[key] !== "");
  if (supplementKeys.length && !forms.approval_rules.supplement_types.includes(row.type)) errors.push(row.id + " has supplement fields but its type is not configured for supplement");
  if (row.status === st[10] && !forms.approval_rules.supplement_types.includes(row.type)) errors.push(row.id + " is in supplement status but type is not configured for supplement");
}
const anomaly = forms.field_sections[byPrefix.YT][0].fields;
const abnormalReport = anomaly.find(field => field.name === "异常投诉识别情况报告");
if (abnormalReport?.template !== "异常投诉识别情况报告.docx") errors.push("abnormal complaint report should reference the standard DOCX template");
const abnormalReportTemplate = path.join(root, "templates", abnormalReport?.template || "");
if (!abnormalReport?.template || !fs.existsSync(abnormalReportTemplate) || fs.statSync(abnormalReportTemplate).size === 0) errors.push("abnormal complaint report template asset is missing or empty");
const manifestations = anomaly.find(field => field.optionsBy);
const evidence = anomaly.find(field => field.valueMap);
if (Object.keys(manifestations?.optionsBy?.values || {}).length !== 3) errors.push("anomaly manifestation optionsBy should have 3 branches");
if (Object.keys(evidence?.valueMap?.values || {}).length !== 11) errors.push("anomaly evidence valueMap should cover 11 manifestations");
const abnormalType = anomaly.find(field => field.name === "异常投诉类型");
if (abnormalType?.options?.length !== 3 || abnormalType.defaultValue) errors.push("abnormal type should contain 3 options and start unselected");
if (!manifestations?.autoSelectSingleOption || (manifestations.optionsBy.values[abnormalType?.options?.[0]] || []).length !== 1) errors.push("the first abnormal type should select its only manifestation automatically");
if ((manifestations?.options || []).some(option => !evidence?.valueMap?.values?.[option])) errors.push("every abnormal manifestation needs a matching evidence requirement");
if (anomaly.filter(field => ["异常投诉认定依据", "报告摘要"].includes(field.name)).some(field => field.max !== 2000 || !field.required)) errors.push("abnormal narratives should be required and limited to 2000 characters");
const objectionProcess = forms.field_sections[byPrefix.HC].find(section => (forms.process_section_titles[byPrefix.HC] || []).includes(section.title))?.fields || [];
if (!objectionProcess.some(field => field.options?.length === 3)) errors.push("objection process should include a 3-option conclusion field");
const fieldByName = (type, name) => (forms.field_sections[type] || []).flatMap(section => section.fields || []).find(field => field.name === name);
if (fieldByName(byPrefix.DC, "证明材料")?.required !== true) errors.push("complaint investigation evidence should remain required");
if (fieldByName(byPrefix.CX, "证明材料")?.required === true) errors.push("cancel complaint evidence should remain optional");
if (fieldByName(byPrefix.TC, "证明材料")?.required !== true) errors.push("exclusion request evidence should be required");
if (!fieldByName(byPrefix.JZ, "投诉/信访事项") || !fieldByName(byPrefix.JZ, "投诉/信访原因") || fieldByName(byPrefix.JZ, "投诉事项") || fieldByName(byPrefix.JZ, "投诉原因")) errors.push("complaint correction titles should match 投诉/信访事项 and 投诉/信访原因");
const mainEntryFieldNames = new Set((mainWorkOrders.entry_sections || []).flatMap(section => section.fields || []).map(field => field.name));
const correctionWritebackSkipped = new Set(["事件还原", "处置意见", "最后处置意见", "附件上传"]);
for (const field of (forms.field_sections[byPrefix.JZ] || []).flatMap(section => section.fields || [])) {
  if (correctionWritebackSkipped.has(field.name)) continue;
  const target = field.writebackField || field.name.replace(/^修正/, "");
  if (!mainEntryFieldNames.has(target)) errors.push("complaint correction writeback target is missing from main ticket schema: " + field.name + " -> " + target);
}
if (!/CORRECTION_WRITEBACK\.buildChanges\(\{ fields, values, originalValues, existingOverrides/.test(appSource)) errors.push("completed complaint correction should use the tested writeback module");
const cancelChannels = ["邮件", "面访", "微信", "电话", "短信", "其他"];
if (!same(fieldByName(byPrefix.CX, "撤销申请渠道")?.options, cancelChannels)) errors.push("cancel request channels differ from the confirmed dictionary");
const accountabilityInstitution = fieldByName(byPrefix.WZ, "问责机构");
const accountabilityDepartment = fieldByName(byPrefix.WZ, "问责部门");
const accountabilityObject = fieldByName(byPrefix.WZ, "问责对象");
if (accountabilityInstitution?.type !== "hierarchyCascader" || accountabilityInstitution.dictionary !== "branchInstitutionTree" || accountabilityInstitution.defaultFrom?.field !== "责任机构") errors.push("accountability institution should use the branch institution tree and default from the responsible institution");
if (accountabilityDepartment?.optionsByInstitution?.key !== "问责机构" || accountabilityDepartment.defaultFrom?.field !== "责任部门") errors.push("accountability department should cascade from accountability institution and default from the responsible department");
if (accountabilityObject?.type !== "personByDepartment" || accountabilityObject.dependsOnInstitution !== "问责机构" || accountabilityObject.dependsOn !== "问责部门" || accountabilityObject.defaultFrom?.field !== "责任人") errors.push("accountability object should cascade from accountability department and default from the responsible person");
const resolutionAmount = fieldByName(byPrefix.JF, "化解金额");
if (resolutionAmount?.type !== "amount" || resolutionAmount.min !== 0.01 || resolutionAmount.max !== 99999999.99 || resolutionAmount.precision !== 2 || resolutionAmount.unit !== "元") errors.push("resolution amount should be a yuan amount above zero, at most 99,999,999.99, with two decimal places");
const exclusionTypes = [
  "被投诉机构错误的。",
  "无法确认投诉人身份的。",
  "投诉人主张持有被投诉机构的存款、理财、保险等产品，但实际未持有的。",
  "被投诉机构因执行法律、法规及国家政策的强制性规定无法向投诉人提供相关服务而被投诉的。",
  "投诉人主张的相关事项经人民法院判决确定存在金融诈骗等犯罪情形的。",
  "投诉事项经人民法院判决或仲裁机构裁决后，银行机构对应承担的责任已执行完毕，且投诉人没有新的事实与理由就同一事项重新提出投诉的。",
  "双方当事人就投诉事项已达成调解协议并经人民法院司法确认后，银行机构对应承担的责任已执行完毕，且投诉人没有新的事实与理由就同一事项重新提出投诉的。",
  "银行机构执行全国\"断卡行动\"、反洗钱等党中央、国务院及相关部门有关领域治理和整治的重要决策部署要求引发投诉的。",
  "银行业金融机构执行中国人民银行相关规定引发的单纯征信类投诉。",
  "投诉人诉求及投诉内容仅要求变更还款数额、利率、期限和还款方式等单纯协商还款类投诉。"
];
if (!same(fieldByName(byPrefix.TC, "剔除申请类型")?.options, exclusionTypes)) errors.push("exclusion request type dictionary differs from the confirmed ten values");
for (const type of [byPrefix.TC, byPrefix.YT]) {
  const inheritedFields = forms.base_field_rules?.type_fields?.[type] || [];
  for (const name of ["关联转送函号", "客户姓名", "投诉内容"]) {
    const field = inheritedFields.find(item => item.name === name);
    const readOnly = field?.editable === false || field?.type === "readonly";
    if (field?.source !== "relatedTicket" || !readOnly) errors.push(type + " " + name + " should be populated from the related ticket and read-only");
  }
}
const processingExclusion = (seed.lists.subprocesses || []).find(row => row.type === byPrefix.TC && row.status === "处理中");
if (!processingExclusion) errors.push("subprocess workbench should include a processing exclusion request sample");
else if (seed.workPool?.assignments?.subprocess?.[processingExclusion.id]?.assignee !== seed.workPool?.identities?.handler?.actor) errors.push("processing exclusion request should be assigned to the current handler");
for (const type of [byPrefix.YC, byPrefix.YT, byPrefix.TC]) if (!forms.supplement_sections[type]?.length) errors.push(type + " has no supplement section");
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Subprocess contract checked: processing stages, status matrix, seed fields, and supplement rules");
