(function createComplaintRectificationDetail(global) {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function relatedTicketIds(row, context) {
    if (context.getRectificationRelatedTicketIds) return context.getRectificationRelatedTicketIds(row);
    if (context.getRelatedTicketIds) return context.getRelatedTicketIds(row?.[2]);
    return String(row?.[2] || "").split(/[、,，;；\s`´｀]+/).map(value => value.trim()).filter(value => value && /[A-Za-z0-9]/.test(value));
  }

  function renderRelatedTicketLinks(row, context) {
    const ids = relatedTicketIds(row, context);
    return ids.length ? '<span class="related-ticket-link-list">' + ids.map(ticketId => '<button type="button" class="btn-link" data-action="open-rectification-related-ticket" data-id="' + escapeHtml(ticketId) + '">' + escapeHtml(ticketId) + '</button>').join("") + '</span>' : "-";
  }

  function renderTransferRecords(row, statusTag) {
    const passed = statusTag("通过");
    return '<div class="table-wrap"><table class="table ds-table transfer-record-table"><thead><tr><th>操作人</th><th>角色</th><th>机构</th><th>操作</th><th>流转意见</th><th>接收人</th><th>状态</th><th>操作时间</th></tr></thead><tbody><tr><td>陈敏慧-60157</td><td>经办员</td><td>' + escapeHtml(row[4]) + '</td><td>创建并提交</td><td>材料已核对，提交下一节点处理。</td><td>当前节点处理人</td><td>' + passed + '</td><td>' + escapeHtml(row[6]) + '</td></tr><tr><td>系统</td><td>系统</td><td>消费者权益保护系统</td><td>自动分配</td><td>依据子流程类型与机构权限分配当前节点。</td><td>当前机构</td><td>' + passed + '</td><td>' + escapeHtml(row[6]) + '</td></tr></tbody></table></div>';
  }

  function render(context) {
    const model = context.getRectificationDetailModel();
    if (!model?.row) return '<section class="page"><div class="module-load-error">未找到溯源整改单，请返回列表后重试。</div></section>';

    const row = model.row;
    const base = model.base || {};
    const createContent = model.editableApprovalStage?.phase === "create"
      ? context.renderRectificationApprovalEditableSections(row, model.editableApprovalStage)
      : context.renderRectificationReadonlySections("create", row);
    const processContent = model.editableApprovalStage?.phase === "process"
      ? (model.editableApprovalStage.dataStage === "result" ? context.renderRectificationReadonlySections("process", row, ["整改方案"]) : "")
        + context.renderRectificationApprovalEditableSections(row, model.editableApprovalStage)
        + (model.editableApprovalStage.dataStage === "result" ? context.renderRectificationReadonlySections("process", row, ["整改结果-投诉统计"]) : "")
      : model.canEditProcess
      ? ((row[5] === "整改中" ? context.renderRectificationReadonlySections("process", row, ["整改方案"]) : "") + context.renderRectificationProcessingEditor(row))
      : context.renderRectificationReadonlySections("process", row);
    const approvalSection = model.approvalFull
      ? '<section class="panel detail-section subprocess-approval-section"><div class="panel-head"><span class="panel-title">审批意见</span></div><div class="panel-body">' + context.renderRectificationApprovalEditor() + '</div></section>'
      : "";
    const returnPage = context.getRectificationReturnPage ? context.getRectificationReturnPage() : "rectification-create";
    const headerActions = (model.role === "developer" ? '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="subprocess-field-inventory" data-id="' + escapeHtml(row[0]) + '">字段清单</button>' : "") + context.renderContextBackButton(returnPage, "溯源整改");
    const title = (model.approvalFull ? "溯源整改审批 · " : "") + "溯源整改单详情";
    const rectificationNumber = row[5] === "草稿" ? "-" : row[0];
    const summary = '<div class="panel detail-summary"><div><span>溯源整改单编号</span><strong>' + escapeHtml(rectificationNumber) + '</strong></div><div><span>单据类型</span><strong>' + escapeHtml(row[1]) + '</strong></div><div><span>当前状态</span>' + context.statusTag(row[5]) + '</div><div><span>关联工单编号</span>' + renderRelatedTicketLinks(row, context) + '</div></div>';
    const basic = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">基础信息</span></div><dl class="ds-descriptions detail-descriptions"><div><dt>创建人</dt><dd>陈敏慧-60157</dd></div><div><dt>所属机构</dt><dd>' + escapeHtml(row[4]) + '</dd></div><div><dt>所属部门</dt><dd>' + escapeHtml(context.qualifiedDepartmentName(row[4], "消费者权益保护部")) + '</dd></div><div><dt>申请时间</dt><dd>' + escapeHtml(base["申请时间"] || row[6]) + '</dd></div><div><dt>办结时间</dt><dd>' + escapeHtml(base["办结时间"] || "-") + '</dd></div><div><dt>整改单编号</dt><dd>' + escapeHtml(rectificationNumber) + '</dd></div></dl></section>';
    const workflow = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">流程节点</span></div><div class="panel-body">' + context.renderRectificationFlow() + '</div></section>';
    const transfer = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">流转记录</span></div>' + renderTransferRecords(row, context.statusTag) + '</section>';

    return '<section class="page subprocess-detail-page rectification-detail-page ' + (model.approvalFull ? "approval-detail-page" : "") + '" data-rectification-view="detail">' + context.pageHeader(title, "查看整改问题、整改方案、整改成果及完整流转记录", headerActions) + summary + context.renderRectificationWorkflowRejection(row) + '<div class="detail-sections">' + basic + createContent + processContent + workflow + transfer + approvalSection + '</div>' + (model.approvalFull ? context.renderRectificationApprovalFooter() : "") + '</section>';
  }

  global.XIBComplaintRectificationDetail = Object.freeze({ render });
})(window);
