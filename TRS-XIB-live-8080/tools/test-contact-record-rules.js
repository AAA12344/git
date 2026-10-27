const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// 从实际页面代码提取联系记录规则，覆盖审批状态与部门展示。
const source = fs.readFileSync("app.js", "utf8");
const formSchema = JSON.parse(fs.readFileSync("data/forms/main-work-orders.json", "utf8"));
function findField(value, name) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findField(item, name);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  if (value.name === name) return value;
  for (const child of Object.values(value)) {
    const found = findField(child, name);
    if (found) return found;
  }
  return null;
}
const noticeTimeField = findField(formSchema, "告知时间");
assert(noticeTimeField, "处理阶段缺少告知时间字段");
assert.equal(noticeTimeField.disabledWhen, undefined, "告知时间源规则仍会在选择否时禁用");
assert.deepEqual(noticeTimeField.requiredWhen, { key:"处理结果是否告知", equals:"是" }, "告知时间必填规则不正确");
assert(!source.includes("context === 'process' && canDevelop && ['待处理', '处理中'].includes(status)"), "开发测试角色仍会跨工单池补充处理操作");
function extract(name, nextName) {
  const start = source.indexOf("  function " + name + "(");
  const end = source.indexOf("  function " + nextName + "(", start);
  assert(start >= 0 && end > start, name + " 函数未找到");
  return source.slice(start, end);
}
const context = {
  ticketReceivingDepartment: () => "消费者权益保护部",
  ticketReceivingInstitution: () => "厦门分行"
};
vm.createContext(context);
vm.runInContext(
  extract("isSmsContact", "smsSendStatusForRecord") +
  extract("smsSendStatusForRecord", "isSettlementNotificationSms") +
  extract("contactDepartmentDisplay", "processingContactTable"),
  context
);
for (const status of ["待审批", "已驳回"]) {
  assert.equal(context.contactStatusForRecord({
    method: "短信沟通", approvalRequired: true, smsApprovalStatus: status,
    contactStatus: "已联系"
  }), "", status + "不能显示已联系");
}
assert.equal(context.contactStatusForRecord({
  method: "短信沟通", approvalRequired: true,
  smsApprovalStatus: "已通过", platformCallStatus: "调用成功", contactStatus: "已联系"
}), "调用成功");
// 短信沟通只展示短信平台调用结果，不再表达客户是否真实送达。
const resent = { method:"短信沟通", approvalRequired:true, smsApprovalStatus:"已通过", sendStatus:"已发送", contactStatus:"" };
assert.equal(context.smsSendStatusForRecord(resent), "已发送");
assert.equal(context.contactStatusForRecord(resent), "调用成功");
assert.equal(context.contactDepartmentDisplay({
  org: "厦门分行", department: "消费者权益保护部"
}, []), "消费者权益保护部");
assert.equal(context.contactDepartmentDisplay({
  org: "厦门分行", department: "厦门分行消费者权益保护部"
}, []), "消费者权益保护部");
assert.equal(context.contactDepartmentDisplay({
  org: "厦门分行", department: "总行消费者权益保护部"
}, []), "消费者权益保护部");
// 使用显式测试样例覆盖全部沟通方式和短信平台调用状态，避免依赖页面铺底数据。
const examples = [
  { id:"call-success", method:"一键外呼", contactStatus:"已联系", content:"内容", transcriptStatus:"processing" },
  { id:"call-missed", method:"一键外呼", contactStatus:"未接通", content:"" },
  { id:"sms-success", method:"短信沟通", approvalRequired:true, smsApprovalStatus:"已通过", platformCallStatus:"调用成功", content:"内容" },
  { id:"demo-undelivered-sms-no-reapproval", method:"短信沟通", approvalRequired:true, smsApprovalStatus:"已通过", platformCallStatus:"调用失败", content:"内容" },
  { id:"sms-rejected", method:"短信沟通", approvalRequired:true, smsApprovalStatus:"已驳回", smsApprovalOpinion:"请修改", content:"内容" },
  { id:"demo-resubmitted-sms", method:"短信沟通", approvalRequired:true, smsApprovalStatus:"待审批", smsApprovalOpinion:"原驳回意见", content:"内容" },
  { id:"plain-sms", method:"短信", approvalRequired:false, contactStatus:"已联系", content:"内容" },
  { id:"phone", method:"电话", contactStatus:"已联系", content:"内容" },
  { id:"email", method:"邮件", contactStatus:"已联系", content:"内容" },
  { id:"visit", method:"面访", contactStatus:"已联系", content:"内容" },
  { id:"wechat", method:"微信", contactStatus:"已联系", content:"内容" },
  { id:"other", method:"其它", contactStatus:"已联系", content:"内容" }
];
const values = key => new Set(examples.map(key));
assert(examples.some(record => record.transcriptStatus === "processing"), "处理中工单缺少录音转译回传中场景");
assert(source.includes("系统会实时进行异常风险识别，识别结果可在“异常风险识别”里查看"), "录音转译回传中缺少异常风险识别提示");
for (const method of ["一键外呼", "短信沟通", "邮件", "面访", "微信", "电话", "短信", "其它"]) {
  assert(values(record => record.method).has(method), "缺少沟通方式：" + method);
}
for (const status of ["", "待审批", "已通过", "已驳回"]) {
  assert(values(record => context.smsApprovalStatusForRecord(record)).has(status), "缺少短信审批状态：" + status);
}
const communicationSmsStatuses = new Set(examples.filter(record => record.method === "短信沟通").map(record => context.smsApprovalStatusForRecord(record)));
for (const status of ["已通过", "已驳回", "待审批"]) assert(communicationSmsStatuses.has(status), "短信沟通缺少短信审批状态：" + status);
const rejectedSms = examples.find(record => context.smsApprovalStatusForRecord(record) === "已驳回");
assert(rejectedSms?.smsApprovalOpinion, "短信审批驳回样例缺少驳回理由");
assert(source.includes('class="sms-rejection-reason"'), "已驳回短信编辑弹窗顶部缺少驳回理由");
assert(source.includes("editRecord.smsApprovalOpinion"), "短信编辑弹窗未读取驳回理由");
assert(!source.includes('{label:"驳回理由",value:record.smsApprovalOpinion'), "驳回理由不应展示在查看内容弹窗");
assert(source.includes("pendingSms.smsApprovalOpinion = opinion"), "短信审批结果未将驳回理由回写联系记录");
assert(source.includes("pendingSms.smsApprovalHistory ="), "短信审批结果未累计保存历史驳回意见");
assert(source.includes('{label:"历史驳回意见",value:record.smsApprovalOpinion'), "重新提交的短信查看内容未保留历史驳回意见");
const resubmittedSms = examples.find(record => record.id === "demo-resubmitted-sms");
assert.equal(context.smsApprovalStatusForRecord(resubmittedSms), "待审批", "缺少驳回后重新提交的待审批短信样例");
assert(resubmittedSms.smsApprovalOpinion, "重新提交短信样例未保留原驳回意见");
const plainSmsRecords = examples.filter(record => record.method === "短信");
assert.equal(plainSmsRecords.length, 1, "普通短信应只保留一种情况");
assert.equal(context.smsApprovalStatusForRecord(plainSmsRecords[0]), "", "普通短信不应显示审批状态");
assert.equal(context.contactStatusForRecord(plainSmsRecords[0]), "已联系", "普通短信联系状态应为已联系");
const undeliveredSms = examples.find(record => record.id === "demo-undelivered-sms-no-reapproval");
assert(undeliveredSms, "缺少短信未送达重发场景");
assert.equal(context.smsApprovalStatusForRecord(undeliveredSms), "已通过", "未送达短信重发不应重新审批");
assert.equal(context.contactStatusForRecord(undeliveredSms), "调用失败", "短信沟通失败状态映射不正确");
vm.runInContext(extract("canResendSmsRecord", "canEditRejectedSmsRecord"), context);
assert.equal(context.canResendSmsRecord(undeliveredSms), true, "未送达短信缺少重发操作");
for (const status of ["", "已联系", "调用成功", "调用失败", "未接通"]) {
  assert(values(record => context.contactStatusForRecord(record)).has(status), "缺少联系状态：" + status);
}
assert(examples.length > 5, "演示记录不足以验证每页5条的分页");
context.escapeAttribute = value => String(value);
context.statusTag = value => '<span class="status-tag" style="--tag-color:#1677ff">' + value + '</span>';
vm.runInContext(extract("contactStatusCell", "contactAttachmentState"), context);
vm.runInContext(extract("contactTranscriptState", "contactAttachmentCell"), context);
assert.equal(context.contactTranscriptState({ transcriptStatus:"processing", transcript:[] }).status, "processing");
assert.equal(context.contactTranscriptState({ transcriptStatus:"pending", transcript:[] }).status, "pending");
assert.equal(context.contactTranscriptState({ transcriptStatus:"success", transcript:[{ text:"模拟转译" }] }).status, "success");
Object.assign(context, {
  contactAttachmentState:record => ({ status:record.attachmentState || "pending" }),
  canEditRejectedSmsRecord:record => record.operation === "编辑",
  canResendSmsRecord:record => record.operation === "重发"
});
vm.runInContext(extract("contactRecordPresentationRows", "processingContactTable"), context);
const sortedRecords = context.contactRecordPresentationRows([
  { id:"sms-approved", method:"短信沟通", approvalRequired:true, smsApprovalStatus:"已通过", contactStatus:"已联系", content:"内容" },
  { id:"call-empty", method:"一键外呼", contactStatus:"未接通", content:"" },
  { id:"call-empty-duplicate", method:"一键外呼", contactStatus:"未接通", content:"重复内容" },
  { id:"sms-pending", method:"短信沟通", approvalRequired:true, smsApprovalStatus:"待审批", contactStatus:"", content:"内容" },
  { id:"call-content", method:"一键外呼", contactStatus:"已联系", content:"内容", attachmentState:"success", transcriptStatus:"processing" }
]).map(item => item.record.id);
assert.deepEqual(Array.from(sortedRecords), ["call-content", "call-empty-duplicate", "call-empty", "sms-approved", "sms-pending"], "联系记录排序后不得丢失状态相同的真实记录");
for (const status of ["待审批", "已通过", "已驳回", "已联系", "调用成功", "调用失败", "未接通"]) {
  assert(context.contactStatusCell(status).includes(status), "状态标签未保留状态文案：" + status);
}
console.log("Contact record rules passed.");
