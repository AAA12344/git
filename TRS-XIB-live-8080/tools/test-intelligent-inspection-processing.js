"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(
  source,
  /function shouldShowIntelligentInspection\(row\) \{[^]*?return \["投诉单", "信访单"\]\.includes\(row\?\.\[1\]\) && \["待处理", "处理中", "会签中", "待审批", "审批中"\]\.includes\(row\?\.\[5\]\);[^]*?\}/,
  "投诉单、信访单应在处理、会签及审批阶段展示智能核查模块"
);
assert.match(
  source,
  /function renderApprovalIntelligentInspectionSection\(row\) \{[^]*?let run = latestInspectionRun\(row\);[^]*?if \(!run && !\["待处理", "处理中"\]\.includes\(row\?\.\[5\]\)\) \{[^]*?recordSubmittedInspectionRun\(row,[^]*?persistWorkflowState\(\);[^]*?\}/,
  "处理阶段不应提前生成结果，审批阶段缺少结果时应补录并持久化智能核查结果"
);
assert.match(
  source,
  /showIntelligentInspection \? \[\{ id: "intelligent-inspection", title: "智能核查" \}\] : \[\]/,
  "处理阶段导航不应隐藏智能核查"
);
assert.match(
  source,
  /const inspectionSection = showIntelligentInspection \? renderApprovalIntelligentInspectionSection\(row\) : ''/,
  "处理阶段正文不应隐藏智能核查"
);
const submittedInspectionSource = source.slice(
  source.indexOf("function recordSubmittedInspectionRun"),
  source.indexOf("function restoreCountersignProcessingValues")
);
assert.doesNotMatch(
  submittedInspectionSource,
  /contactTranscriptState\(record\)\.status === "success"/,
  "提交处理触发智能核查不应以录音转文本成功作为整体前提"
);
assert.match(
  source,
  /workflowTransition\("ticket"[^]*?if \(!transition\.ok\) return toast\(transition\.reason, true\);[^]*?recordSubmittedInspectionRun\(ticket\);/,
  "智能核查必须在处理提交成功后触发"
);
assert.match(
  source,
  /\(type === "投诉单" \? renderAgainComplaintSection\(row\) : ""\) \+\s*resultSection \+\s*inspectionSection/,
  "再次投诉必须稳定展示在处理结果前，智能核查展示在处理结果后"
);
assert.match(
  source,
  /const complaintNoticePredecessor = \["黑灰产附件", "黑灰产原因", "是否黑灰产投诉"\][^]*?field\.name === noticePredecessorName[^]*?noticeFields\.map\(noticeField => renderField\(noticeField, scope\)\)/,
  "处理结果是否告知、告知时间、告知方式应紧跟完整黑灰产字段组"
);
assert.doesNotMatch(
  source,
  /risk-notice-fields/,
  "告知字段不应放在异常风险识别模块"
);
assert.match(
  source,
  /id="section-processing-meta"[^]*?metaItems[^]*?processingContactTable/,
  "事件处理信息应展示字段清单中的状态、接收机构、处理员和接收部门"
);
assert.match(
  source,
  /const complaintNoticePredecessor = \["黑灰产附件", "黑灰产原因", "是否黑灰产投诉"\][^]*?const noticePredecessorName = type === "投诉单"[^]*?complaintNoticePredecessor[^]*?firstNoticeIndex/,
  "投诉单告知字段应排在完整黑灰产字段组后，其他工单应保持字段清单中的原始位置"
);
const riskSummarySource = source.slice(
  source.indexOf("function renderRiskSummary"),
  source.indexOf("function updateRiskSummaryCard")
);
assert.match(riskSummarySource, /const demoStates = \["result", "result", "generating", "failed", "empty", "generating"\]/);
assert.match(riskSummarySource, /const statusLabels = \{ result:"有结果", generating:"生成中", failed:"生成失败", empty:"无结果" \}/);
assert.match(riskSummarySource, /status === "failed" \|\| status === "empty"/);
assert.match(riskSummarySource, /data-action="risk-record-retry"[^]*?>重新生成/);
assert.match(
  source,
  /state\.riskRetryByTicket\[state\.detailId\]\[index\] = true/,
  "异常风险识别应支持无结果或生成失败后重新生成，并进入生成中状态"
);

console.log("Intelligent inspection processing checks passed.");
