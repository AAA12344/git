(function registerComplaintInspections(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  const data = global.XIB_COMPLAINT_INSPECTIONS_DATA;
  if (!registry) throw new Error("XIBModuleRegistry must load before complaint-inspections.");
  if (!data) throw new Error("Complaint inspections data must load before its module.");

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const actorId = actor => {
    const raw = String(actor?.id || actor?.employeeId || actor?.name || "");
    return raw.match(/(\d+)$/)?.[1] || raw;
  };
  const listValue = value => Array.isArray(value) ? value : value ? String(value).split(/[、,]/).map(item => item.trim()).filter(Boolean) : [];
  const normalizeSupervisionStatus = status => status === "草稿" ? "草稿" : ["已反馈", "已办结"].includes(status) ? "已办结" : "处理中";

  function normalizeSupervisionLetter(letter = {}) {
    const { supplement, ccApprovers, ...rest } = clone(letter);
    const senderName = letter.senderName || letter.sender || "-";
    const receiverName = letter.receiverName || letter.receiver || "-";
    const ccApproverNames = listValue(letter.ccApproverNames || ccApprovers || letter.cc);
    return {
      ...rest,
      status:normalizeSupervisionStatus(letter.status),
      senderId:actorId({ id:letter.senderId || senderName }),
      senderName,
      sender:senderName,
      receiverId:actorId({ id:letter.receiverId || receiverName }),
      receiverName,
      receiver:receiverName,
      ccApproverIds:listValue(letter.ccApproverIds || ccApprovers || letter.cc).map(value => actorId({ id:value })),
      ccApproverNames,
      cc:ccApproverNames.join("、"),
      supervisionRequirement:letter.supervisionRequirement || supplement || "",
      inspectionResultSnapshot:clone(letter.inspectionResultSnapshot || letter.findings || null)
    };
  }

  function canViewSupervisionLetter(letter, actor) {
    const id = actorId(actor);
    if (!id) return false;
    if (letter.status === "草稿") return id === letter.senderId;
    return [letter.senderId, letter.receiverId, ...(letter.ccApproverIds || [])].includes(id);
  }

  function canEditSupervisionDraft(letter, actor) {
    return letter?.status === "草稿" && actorId(actor) === letter.senderId;
  }

  function canProcessSupervisionLetter(letter, actor) {
    return letter?.status === "处理中" && actorId(actor) === letter.receiverId;
  }

  const state = {
    activeTab: "核查工单",
    letterId: "",
    letterTab: "基本信息",
    sorts: {},
    generationOverrides: {},
    supervisionLetters: clone(data.initialSupervisionLetters).map(normalizeSupervisionLetter)
  };
  const inspectionDimensions = Object.freeze([
    Object.freeze({ key:"entry", label:"录入核查" }),
    Object.freeze({ key:"processing", label:"沟通处理核查" }),
    Object.freeze({ key:"behavior", label:"产品业务核查" })
  ]);
  const inspectionLabel = key => inspectionDimensions.find(item => item.key === key)?.label || key;

  function inspectionStatusBadge(passed) {
    return '<span class="approval-inspection-status ' + (passed ? "is-pass" : "is-fail") + '">' + (passed ? "通过" : "不通过") + '</span>';
  }

  function inspectionMetaBadge(value, tone = "default", extraClass = "") {
    return '<span class="approval-inspection-meta-badge ' + (tone === "danger" ? "is-danger " : "") + extraClass + '">' + escapeHtml(value || "-") + '</span>';
  }

  function inspectionStatusRow(passed) {
    return '<div class="approval-inspection-status-row">' + inspectionStatusBadge(passed) + '</div>';
  }

  function entryNonCompliantFields(nonCompliantItems) {
    const items = Array.isArray(nonCompliantItems) ? nonCompliantItems : [];
    const hasBasis = items.includes("处理依据");
    const hasOtherItem = items.some(item => item !== "处理依据");
    if (hasBasis && !hasOtherItem) return ["处理依据"];
    if (!hasBasis) return ["事件还原", "处置意见"];
    return ["事件还原", "处置意见", "处理依据"];
  }

  function renderEntryInspection(entry) {
    if (entry?.passed === true) return '<div class="approval-inspection-category">' + inspectionStatusRow(true) + '</div>';
    const nonCompliantItems = Array.isArray(entry?.nonCompliantItems) ? entry.nonCompliantItems : [];
    const fields = entryNonCompliantFields(nonCompliantItems);
    return '<div class="approval-inspection-category has-results">' + inspectionStatusRow(false) + '<article class="approval-inspection-result">' +
      '<div class="approval-inspection-result-line"><strong>不合规字段：</strong><span class="approval-inspection-field-badges">' + fields.map(field => inspectionMetaBadge(field, "danger")).join("") + '</span></div>' +
      '<div class="approval-inspection-result-line"><strong>不合规项目：</strong><span class="approval-inspection-field-badges">' + nonCompliantItems.map(item => inspectionMetaBadge(item)).join("") + '</span></div>' +
      '<p class="approval-inspection-conclusion">' + escapeHtml(entry?.conclusion || "-") + '</p></article></div>';
  }

  function renderCommunicationInspection(communications, options = {}) {
    const items = (Array.isArray(communications?.items) ? communications.items : []).filter(item => item?.passed !== true);
    if (communications?.passed === true || !items.length) return '<div class="approval-inspection-category">' + inspectionStatusRow(true) + '</div>';
    return '<div class="approval-inspection-category has-results">' + inspectionStatusRow(false) + '<div class="approval-inspection-result-list">' + items.map(item => {
      const nonCompliantItems = Array.isArray(item?.nonCompliantItems) ? item.nonCompliantItems : [];
      // 用联系时间匹配外呼记录；只有匹配到的录音才展示编号。
      const outbound = (options.outboundRecords || []).find(record => record.time === item?.contactTime);
      const recordLine = outbound
        ? '<div class="approval-inspection-result-line"><strong>外呼联系记录：</strong><span>' + escapeHtml(item.contactTime) + ' · 一键外呼' + (outbound.contactStatus ? ' · ' + escapeHtml(outbound.contactStatus) : '') + '</span></div>' +
          '<div class="approval-inspection-result-line"><strong>录音编号：</strong><span>' + escapeHtml(outbound.recordingId || "-") + '</span></div>'
        : '<div class="approval-inspection-result-line"><strong>不合规记录：</strong><span class="approval-inspection-field-badges">' + inspectionMetaBadge(item?.contactTime || "-", "danger") + '</span></div>';
      return '<article class="approval-inspection-result">' +
        recordLine +
        '<div class="approval-inspection-result-line"><strong>不合规项目：</strong><span class="approval-inspection-field-badges">' + nonCompliantItems.map(tag => inspectionMetaBadge(tag)).join("") + '</span></div>' +
        '<p class="approval-inspection-conclusion">' + escapeHtml(item?.conclusion || "-") + '</p></article>';
    }).join("") + '</div></div>';
  }

  function normalizedProductBusinessGroups(productBusiness) {
    const configuredGroups = Array.isArray(productBusiness?.groups) ? productBusiness.groups : [];
    if (configuredGroups.length) {
      return configuredGroups.map(group => ({
        primaryLabel:group?.primaryLabel || "-",
        primaryConclusion:group?.primaryConclusion || "-",
        secondaryItems:(Array.isArray(group?.secondaryItems) ? group.secondaryItems : []).map(item => ({
          label:item?.label || "-",
          conclusion:item?.conclusion || "-"
        }))
      }));
    }
    const legacyItems = Array.isArray(productBusiness?.items) ? productBusiness.items : [];
    return legacyItems.reduce((groups, item) => {
      if (item?.level === "一级" || !groups.length) {
        groups.push({
          primaryLabel:item?.level === "一级" ? item?.label || "-" : "产品业务核查",
          primaryConclusion:item?.conclusion || item?.explanation || "-",
          secondaryItems:item?.level === "二级" ? [{ label:item?.label || "-", conclusion:item?.conclusion || item?.explanation || "-" }] : []
        });
      } else {
        groups.at(-1).secondaryItems.push({ label:item?.label || "-", conclusion:item?.conclusion || item?.explanation || "-" });
      }
      return groups;
    }, []);
  }

  function productBusinessLabels(productBusiness) {
    return normalizedProductBusinessGroups(productBusiness).flatMap(group => [
      group.primaryLabel,
      ...group.secondaryItems.map(item => item.label)
    ]);
  }

  function renderProductBusinessInspection(productBusiness) {
    const groups = normalizedProductBusinessGroups(productBusiness);
    if (productBusiness?.passed === true || !groups.length) return '<div class="approval-inspection-category">' + inspectionStatusRow(true) + '</div>';
    // 每条链只关联一个一级和一个二级；同一一级有多个二级时分别展示，避免看不清对应关系。
    const cards = groups.flatMap((group, groupIndex) => (group.secondaryItems.length ? group.secondaryItems : [null]).map(item =>
      '<article class="approval-inspection-result approval-inspection-product-chain" data-product-group-index="' + groupIndex + '">' +
      '<div class="approval-inspection-product-node"><span class="approval-inspection-product-cell-label">一级标签</span><span class="approval-inspection-meta-badge approval-inspection-product-tag" data-product-tag-level="一级">' + escapeHtml(group.primaryLabel) + '</span><p class="approval-inspection-product-reason">' + escapeHtml(group.primaryConclusion) + '</p></div>' +
      (item ? '<div class="approval-inspection-product-node is-secondary"><span class="approval-inspection-product-cell-label">二级标签</span><span class="approval-inspection-meta-badge approval-inspection-product-tag" data-product-tag-level="二级">' + escapeHtml(item.label) + '</span><p class="approval-inspection-product-reason">' + escapeHtml(item.conclusion) + '</p></div>' : '') +
      '</article>'
    )).join("");
    return '<div class="approval-inspection-category has-results">' + inspectionStatusRow(false) + '<div class="approval-inspection-result-list approval-inspection-product-result-list">' + cards + '</div></div>';
  }

  const generationStatuses = new Set(["会签中", "待审批", "审批中", "已办结"]);
  const dimensionKeys = ["entry", "communications", "productBusiness"];
  const generationPatterns = [
    ["complete", "complete", "complete"],
    ["complete", "generating", "failed"],
    ["generating", "failed", "complete"],
    ["failed", "complete", "generating"],
    ["complete", "failed", "generating"]
  ];

  function inspectionGenerationState(ticketId, ticketType, ticketStatus, dimension, hasFinding = true) {
    const override = state.generationOverrides[ticketId]?.[dimension];
    if (override) return override;
    if (ticketId === "TS202607230012" && ticketType === "投诉单") {
      return { entry:"generating", communications:hasFinding ? "complete" : "generating", productBusiness:"failed" }[dimension] || "complete";
    }
    if (ticketType !== "投诉单" || !generationStatuses.has(ticketStatus)) return "complete";
    const checksum = [...String(ticketId || "")].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const status = generationPatterns[checksum % generationPatterns.length][dimensionKeys.indexOf(dimension)];
    return status === "complete" && !hasFinding ? "generating" : status;
  }

  function renderGenerationState(status, ticketId, dimension) {
    const retry = status === "failed" ? '<button type="button" class="btn xib-btn xib-btn--secondary approval-inspection-retry" data-inspection-retry="' + escapeHtml(dimension) + '" data-inspection-ticket-id="' + escapeHtml(ticketId) + '">重新生成</button>' : "";
    return '<div class="approval-inspection-generation-state is-' + status + '" data-inspection-state="' + status + '">' + retry + '<span>' + (status === "failed" ? "生成失败" : "生成中...") + '</span></div>';
  }

  function renderInspectionFindings(findings = {}, options = {}) {
    const { ticketId = "", ticketType = "", ticketStatus = "" } = options;
    const renderers = [renderEntryInspection, renderCommunicationInspection, renderProductBusinessInspection];
    const rows = inspectionDimensions.map((dimension, index) => {
      const key = dimensionKeys[index];
      const status = options.staticResult ? "complete" : inspectionGenerationState(ticketId, ticketType, ticketStatus, key, Boolean(findings?.[key]));
      const noResult = !findings?.[key] && status === "complete";
      const content = options.showStateExamples && findings?.[key]
        ? renderers[index](findings[key], options)
        : noResult ? '<div class="approval-inspection-empty">暂无智能核查结果</div>' : status === "complete" ? renderers[index](findings?.[key], options) : renderGenerationState(status, ticketId, key);
      // 审批详情把各模块的其他状态直接列在结果下方，便于一次查看全部情况。
      const exampleStatus = { entry:"empty", communications:"generating", productBusiness:"failed" }[key];
      const example = !options.staticResult && options.showStateExamples && findings?.[key]
        ? '<div class="approval-inspection-state-example" data-inspection-example="' + key + '"><small>状态示例</small>' + (exampleStatus === "empty" ? '<div class="approval-inspection-empty">暂无智能核查结果</div>' : renderGenerationState(state.generationOverrides[ticketId]?.[key] || exampleStatus, ticketId, key)) + '</div>'
        : "";
      return '<div data-inspection-dimension="' + key + '"><dt>' + dimension.label + '</dt><dd>' + content + example + '</dd></div>';
    }).join("");
    return '<dl class="approval-inspection-fields">' + rows + '</dl>';
  }

  function bindInspectionRetry(root) {
    root?.querySelectorAll?.("[data-inspection-retry]").forEach(button => {
      if (button.dataset.inspectionRetryBound === "true") return;
      button.dataset.inspectionRetryBound = "true";
      button.addEventListener("click", () => {
        const ticketId = button.dataset.inspectionTicketId;
        const dimension = button.dataset.inspectionRetry;
        if (!ticketId || !dimensionKeys.includes(dimension)) return;
        state.generationOverrides[ticketId] ||= {};
        state.generationOverrides[ticketId][dimension] = "generating";
        const value = button.closest("[data-inspection-example]") || button.closest("dd");
        if (value) value.innerHTML = renderGenerationState("generating", ticketId, dimension);
      });
    });
  }

  function latestTicketInspectionRun(ticketId, context) {
    const current = context?.getLatestTicketInspectionRun?.(ticketId);
    if (current) return current;
    const record = data.ticketInspectionRecords.find(item => item.id === ticketId) || data.ticketLibrary.find(item => item.id === ticketId);
    return Array.isArray(record?.inspectionRuns) ? record.inspectionRuns.at(-1) || null : null;
  }

  function inspectionResultStatus(ticketId, ticketType, ticketStatus, findings) {
    const states = dimensionKeys.map(key => inspectionGenerationState(ticketId, ticketType, ticketStatus, key, Boolean(findings?.[key])));
    if (dimensionKeys.some((key, index) => states[index] === "complete" && findings?.[key]?.passed === false)) return "不通过";
    if (dimensionKeys.every((key, index) => states[index] === "complete" && findings?.[key]?.passed === true)) return "通过";
    return "-";
  }

  function ticketRow(ticketId, context, fallback) {
    return context.findTicketRow?.(ticketId) || fallback || [ticketId, "工单", "-", "-", "-", "处理中", "-"];
  }

  function ticketRecord(ticketId) {
    return data.ticketLibrary.find(item => item.id === ticketId) || data.ticketLibrary[0];
  }

  function letterForTicket(ticketId) {
    return state.supervisionLetters.find(letter => letter.ticketId === ticketId) || null;
  }

  const defaultSenderDepartment = "总行消费者权益保护部";
  function senderDepartment(letter) {
    return letter.senderDept || (letter.senderOrg === "总行" ? defaultSenderDepartment : "-");
  }

  function receiverInstitution(letter) {
    return letter.receiverOrg || data.ticketLibrary.find(item => item.id === letter.ticketId)?.institution || "-";
  }

  function receiverDepartment(letter, context) {
    return letter.receiverDept || data.ticketLibrary.find(item => item.id === letter.ticketId)?.department || context.getTicketDepartment?.(letter.ticketId) || "-";
  }

  function sortedRows(rows, scope) {
    const sort = state.sorts[scope];
    const result = rows.map(row => [...row]);
    if (!sort) return result;
    const direction = sort.direction === "asc" ? 1 : -1;
    return result.sort((left, right) => String(left[sort.index]).localeCompare(String(right[sort.index]), "zh-CN", { numeric: true }) * direction);
  }

  function sortableHead(label, scope, index) {
    return "<th>" + escapeHtml(label) + "</th>";
  }

  function moduleTabs() {
    const tabs = ["核查工单", "督导记录"];
    return '<div class="panel inspections-module-tabs"><div class="tabs lib-tabs-line">' + tabs.map(tab => '<button type="button" class="tab ' + (state.activeTab === tab ? "is-active" : "") + '" data-inspections-tab="' + escapeHtml(tab) + '">' + escapeHtml(tab) + '</button>').join("") + '</div></div>';
  }

  function renderTicketList(context) {
    const scope = "analysis-inspections";
    const rows = sortedRows(data.ticketLibrary.map(item => {
      const ticket = ticketRow(item.id, context, [item.id, item.id.startsWith("XF") ? "信访单" : "投诉单", "-", "-", item.institution, "处理中", item.createdAt]);
      const run = latestTicketInspectionRun(item.id, context);
      return [ticket[0], ticket[1], ticket[2], inspectionResultStatus(item.id, ticket[1], ticket[5], run?.findings),
        item.institution, [context.getTicketDepartment?.(item.id), item.department].find(value => value && value !== "-") || "-", run?.submittedAt || item.closedAt || ticket[6] || "-"];
    }), scope);
    const filters = context.renderGroupedFilters([
      [{ label:"工单类型", type:"select", options:["投诉单", "信访单"] }, { label:"提交处理结果时间", type:"range", minDate:"2015-01-01" }, { label:"工单编号", type:"input" }],
      [{ label:"核查结果状态", type:"select", options:["通过", "不通过"] }, { label:"所属机构", type:"orgTree", key:"filter.inspections.institution" }, { label:"所属部门", type:"orgTree", key:"filter.inspections.department" }]
    ], "inspection-filter-panel");
    const body = rows.map(row => {
      const existingLetter = letterForTicket(row[0]);
      const letterAction = row[3] !== "不通过" ? '<span class="inspection-action-placeholder">-</span>'
        : existingLetter ? '<button type="button" class="btn-link" data-action="inspections-letter-page" data-id="' + escapeHtml(existingLetter.id) + '">' + (existingLetter.status === "草稿" ? "发送督导函" : "查看督导函") + '</button>'
          : '<button type="button" class="btn-link" data-action="inspections-letter-draft" data-id="' + escapeHtml(row[0]) + '">发送督导函</button>';
      return '<tr>' + '<td class="primary-cell"><button type="button" class="btn-link analysis-record-link" data-action="inspections-open-ticket" data-id="' + escapeHtml(row[0]) + '">' + escapeHtml(row[0]) + '</button></td><td>' + escapeHtml(row[1]) + '</td><td>' + escapeHtml(row[2]) + '</td><td>' + context.statusTag(row[3]) + '</td><td>' + escapeHtml(row[4]) + '</td><td>' + escapeHtml(row[5]) + '</td><td>' + escapeHtml(row[6]) + '</td><td class="operation-cell"><div class="row-actions inspection-row-actions"><span class="inspection-action-slot">' + letterAction + '</span><span class="inspection-action-slot"><button type="button" class="btn-link" data-action="inspections-ticket-detail" data-id="' + escapeHtml(row[0]) + '">查看</button></span></div></td></tr>';
    }).join("");
    return '<section class="page analysis-list-page xib-module-complaint-inspections" data-module="complaint-inspections">' + context.pageHeader("智能核查", "查看核查工单与督导反馈") + moduleTabs() + filters + '<div class="analysis-result-heading"><h1>核查工单 <span>（' + rows.length + '）</span></h1><button type="button" class="btn xib-btn xib-btn--primary" data-action="inspections-export">导出</button></div><div class="panel"><div class="table-wrap"><table class="table ds-table inspection-ticket-table"><thead><tr>' + sortableHead("工单编号", scope, 0) + sortableHead("工单类型", scope, 1) + sortableHead("客户姓名", scope, 2) + sortableHead("核查结果状态", scope, 3) + sortableHead("所属机构", scope, 4) + sortableHead("所属部门", scope, 5) + sortableHead("提交处理结果时间", scope, 6) + '<th>操作</th></tr></thead><tbody>' + body + '</tbody></table></div>' + context.renderPagination(rows.length, scope) + '</div></section>';
  }

  function modalRoot() {
    return document.querySelector("#overlay-root");
  }

  function openTicketInspection(ticketId, context) {
    const info = ticketRecord(ticketId);
    const ticket = ticketRow(ticketId, context, [ticketId, "工单", "-", "-", info.institution, "处理中", info.createdAt]);
    const letter = letterForTicket(ticketId);
    const run = latestTicketInspectionRun(ticketId, context);
    const eligible = ticket[1] === "投诉单" && generationStatuses.has(ticket[5]);
    const resultMarkup = run || eligible ? renderInspectionFindings(run?.findings || {}, { ticketId, ticketType:ticket[1], ticketStatus:ticket[5] }) : '<div class="empty"><div><div class="empty-mark">核</div><p>暂无智能核查结果</p></div></div>';
    const content = '<div class="inspection-ticket-dialog"><div class="inspection-ticket-overview"><dl class="action-summary-grid"><div><dt>工单编号</dt><dd><button type="button" class="btn-link" data-inspections-open-ticket="' + escapeHtml(ticket[0]) + '">' + escapeHtml(ticket[0]) + '</button></dd></div><div><dt>工单类型</dt><dd>' + escapeHtml(ticket[1]) + '</dd></div><div><dt>客户姓名</dt><dd>' + escapeHtml(ticket[2]) + '</dd></div><div><dt>事项 / 业务</dt><dd>' + escapeHtml(ticket[3]) + '</dd></div><div><dt>创建时间</dt><dd>' + escapeHtml(info.createdAt) + '</dd></div><div><dt>创建人</dt><dd>' + escapeHtml(info.creator) + '</dd></div><div><dt>受理渠道</dt><dd>' + escapeHtml(info.channel) + '</dd></div><div><dt>当前机构</dt><dd>' + escapeHtml(info.institution) + '</dd></div><div><dt>当前状态</dt><dd>' + context.statusTag(ticket[5]) + '</dd></div><div><dt>督导函状态</dt><dd>' + (letter ? context.statusTag(letter.status) : "未发送") + '</dd></div></dl></div><section class="inspection-conclusion-section"><div class="inspection-dialog-title"><strong>智能核查结果</strong><span>与工单详情页展示一致，仅展示该工单最新一次核查结果。</span></div><div class="inspection-dialog-result">' + resultMarkup + '</div></section></div>';
    const canSend = inspectionResultStatus(ticketId, ticket[1], ticket[5], run?.findings) === "不通过";
    const canCreateLetter = canSend && !letter;
    context.openModal("核查工单详情", content, canCreateLetter ? "发起督导函" : "关闭", canCreateLetter ? () => {
      context.closeOverlay();
      const result = createDraftForTicket(ticketId, context);
      if (!result.ok) context.toast(result.reason, true);
    } : undefined);
    bindInspectionRetry(modalRoot());
    modalRoot()?.querySelector("[data-inspections-open-ticket]")?.addEventListener("click", event => {
      context.closeOverlay();
      context.openTicketDetail(event.currentTarget.dataset.inspectionsOpenTicket);
    });
  }

  function generateLetterId(context) {
    const dateCode = context.systemTimestamp().slice(0, 10).replace(/-/g, "");
    const sequence = state.supervisionLetters.reduce((max, letter) => String(letter.id).startsWith("DH" + dateCode)
      ? Math.max(max, Number(String(letter.id).slice(-4)) || 0)
      : max, 0) + 1;
    if (sequence > 9999) return "";
    return "DH" + dateCode + String(sequence).padStart(4, "0");
  }

  function domainLetterId(now) {
    const dateCode = String(now || "").slice(0, 10).replace(/-/g, "");
    if (!/^\d{8}$/.test(dateCode)) return "";
    const sequence = state.supervisionLetters.reduce((max, letter) => String(letter.id).startsWith("DH" + dateCode)
      ? Math.max(max, Number(String(letter.id).slice(-4)) || 0)
      : max, 0) + 1;
    return sequence > 9999 ? "" : "DH" + dateCode + String(sequence).padStart(4, "0");
  }

  function actionFailure(reason) {
    return { ok:false, reason, letter:null };
  }

  function hasFailedLatestInspection(ticketId) {
    const findings = latestTicketInspectionRun(ticketId)?.findings;
    return dimensionKeys.some(key => findings?.[key]?.passed === false);
  }

  function createSupervisionDraft(ticketId, actor, now) {
    if (!ticketId) return actionFailure("缺少关联工单。");
    if (!hasFailedLatestInspection(ticketId)) return actionFailure("仅核查结果不通过的工单可以发起督导函。");
    if (letterForTicket(ticketId)) return actionFailure("该工单已存在督导函。");
    const id = domainLetterId(now);
    if (!id) return actionFailure("无法生成督导函编号。");
    const senderName = actor?.name || "-";
    const letter = normalizeSupervisionLetter({
      id, ticketId, status:"草稿", senderId:actorId(actor), senderName,
      receiverId:"", receiverName:"-", ccApproverIds:[], ccApproverNames:[],
      supervisionRequirement:"", inspectionResultSnapshot:null, feedback:"",
      createdAt:now, updatedAt:now, sentAt:"", completedAt:""
    });
    state.supervisionLetters.unshift(letter);
    return { ok:true, reason:"", letter:clone(letter) };
  }

  function saveSupervisionDraft(id, patch, actor, now) {
    const letter = state.supervisionLetters.find(item => item.id === id);
    if (!letter) return actionFailure("未找到督导函记录。");
    if (!canEditSupervisionDraft(letter, actor)) return actionFailure("当前督导函不可编辑。");
    const next = normalizeSupervisionLetter({ ...letter, ...clone(patch || {}), status:"草稿", updatedAt:now });
    Object.assign(letter, next);
    return { ok:true, reason:"", letter:clone(letter) };
  }

  function sendSupervisionLetter(id, actor, inspectionSnapshot, now) {
    const letter = state.supervisionLetters.find(item => item.id === id);
    if (!letter) return actionFailure("未找到督导函记录。");
    if (!canEditSupervisionDraft(letter, actor)) return actionFailure("当前督导函不可发送。");
    if (!letter.receiverId) return actionFailure("请选择指定处理人。");
    if (!String(letter.supervisionRequirement || "").trim()) return actionFailure("请填写督导要求。");
    letter.status = "处理中";
    letter.inspectionResultSnapshot = clone(inspectionSnapshot || {});
    letter.sentAt = now;
    letter.updatedAt = now;
    return { ok:true, reason:"", letter:clone(letter) };
  }

  function completeSupervisionLetter(id, feedback, actor, now) {
    const letter = state.supervisionLetters.find(item => item.id === id);
    if (!letter) return actionFailure("未找到督导函记录。");
    if (!canProcessSupervisionLetter(letter, actor)) return actionFailure("仅指定处理人可处理该督导函。");
    if (!String(feedback || "").trim()) return actionFailure("请填写督导反馈。");
    letter.feedback = String(feedback).trim();
    letter.status = "已办结";
    letter.completedAt = now;
    letter.feedbackAt = now;
    letter.updatedAt = now;
    return { ok:true, reason:"", letter:clone(letter) };
  }

  function normalizeSupervisionLetterIds(letters, assignments = {}) {
    const supervisionLetters = clone(Array.isArray(letters) ? letters : []);
    const normalizedAssignments = clone(assignments || {});
    const usedIds = new Set([
      ...supervisionLetters.map(letter => String(letter.id || "")),
      ...Object.keys(normalizedAssignments)
    ].filter(id => /^DH\d{12}$/.test(id)));
    const nextSequenceByDate = {};
    usedIds.forEach(id => {
      const dateCode = id.slice(2, 10);
      nextSequenceByDate[dateCode] = Math.max(nextSequenceByDate[dateCode] || 0, Number(id.slice(-4)) || 0);
    });
    let migrated = false;
    supervisionLetters.forEach(letter => {
      const previousId = String(letter.id || "");
      if (!/^DDH\d+$/.test(previousId)) return;
      const createdDate = String(letter.createdAt || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
      const encodedDate = previousId.match(/^DDH(\d{8})/);
      const dateCode = createdDate ? createdDate.slice(1).join("") : encodedDate?.[1];
      if (!dateCode) return;
      let sequence = (nextSequenceByDate[dateCode] || 0) + 1;
      let restoredId = "DH" + dateCode + String(sequence).padStart(4, "0");
      while (usedIds.has(restoredId)) {
        sequence += 1;
        if (sequence > 9999) return;
        restoredId = "DH" + dateCode + String(sequence).padStart(4, "0");
      }
      nextSequenceByDate[dateCode] = sequence;
      usedIds.add(restoredId);
      letter.id = restoredId;
      if (Object.prototype.hasOwnProperty.call(normalizedAssignments, previousId)) {
        normalizedAssignments[restoredId] = normalizedAssignments[previousId];
        delete normalizedAssignments[previousId];
      }
      migrated = true;
    });
    return { supervisionLetters, assignments:normalizedAssignments, migrated };
  }

  function conclusionEditor(label, key, conclusion, readOnly = false) {
    return '<label class="supervision-conclusion-editor"><strong>' + escapeHtml(label) + '</strong><textarea class="di-textarea" ' + (readOnly ? 'readonly' : 'data-supervision-field="' + escapeHtml(key) + '"') + '>' + escapeHtml(conclusion?.text || conclusion || '') + '</textarea></label>';
  }

  function approverPicker(approvers, selected) {
    return '<div class="supervision-approver-picker" data-supervision-approver-picker><button type="button" class="di-select is-fluid supervision-approver-trigger" data-supervision-approver-trigger aria-expanded="false"><span data-supervision-approver-summary>' + escapeHtml(selected.join("、") || "请选择审批人") + '</span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><div class="supervision-approver-popover di-select-popover" data-supervision-approver-popover hidden><div class="supervision-approver-options">' + approvers.map(approver => '<label class="supervision-approver-option"><input type="checkbox" data-supervision-cc-approver value="' + escapeHtml(approver) + '" ' + (selected.includes(approver) ? "checked" : "") + '><span>' + escapeHtml(approver) + '</span></label>').join("") + '</div><button type="button" class="btn xib-btn xib-btn--primary" data-supervision-approver-confirm>确定</button></div></div>';
  }

  let approverOutsideClickHandler = null;
  function bindApproverPicker() {
    const root = modalRoot();
    const picker = root?.querySelector("[data-supervision-approver-picker]");
    if (!picker) return;
    const trigger = picker.querySelector("[data-supervision-approver-trigger]");
    const popover = picker.querySelector("[data-supervision-approver-popover]");
    const selected = () => [...picker.querySelectorAll("[data-supervision-cc-approver]:checked")].map(input => input.value);
    picker.addEventListener("click", event => event.stopPropagation());
    picker.addEventListener("change", () => { picker.querySelector("[data-supervision-approver-summary]").textContent = selected().join("、") || "请选择审批人"; });
    trigger.addEventListener("click", event => { event.stopPropagation(); popover.hidden = !popover.hidden; trigger.setAttribute("aria-expanded", String(!popover.hidden)); });
    picker.querySelector("[data-supervision-approver-confirm]").addEventListener("click", () => { popover.hidden = true; trigger.setAttribute("aria-expanded", "false"); });
    if (approverOutsideClickHandler) root.removeEventListener("click", approverOutsideClickHandler);
    approverOutsideClickHandler = event => { if (!picker.contains(event.target)) { popover.hidden = true; trigger.setAttribute("aria-expanded", "false"); } };
    root.addEventListener("click", approverOutsideClickHandler);
  }

  function openLetterEditor(ticketId, context) {
    const info = ticketRecord(ticketId);
    const ticket = ticketRow(ticketId, context, [ticketId, ticketId.startsWith("XF") ? "信访单" : "投诉单", "-", "-", info.institution, "处理中", info.createdAt]);
    const handlerIdentity = context.getWorkPoolIdentity?.("handler");
    const receiver = handlerIdentity?.organization === info.institution ? handlerIdentity.actor : info.handler;
    const selectedApprovers = [info.approver];
    const approvers = [...new Set([info.approver, ...data.ticketLibrary.map(item => item.approver), ...selectedApprovers].filter(Boolean))];
    const complaintProduct = context.getTicketComplaintProduct?.(ticketId) || ticket[3];
    const content = '<div class="supervision-letter-editor"><div class="supervision-route"><div><span>发送方式</span><strong>系统发送</strong></div><div><span>发送给</span><strong>' + escapeHtml(receiver) + '（处理人）</strong></div><div><span>抄送审批人</span>' + approverPicker(approvers, selectedApprovers) + '</div></div><dl class="action-summary-grid supervision-ticket-summary"><div><dt>工单编号</dt><dd>' + escapeHtml(ticket[0]) + '</dd></div><div><dt>客户姓名</dt><dd>' + escapeHtml(ticket[2]) + '</dd></div><div><dt>投诉产品标签</dt><dd>' + escapeHtml(complaintProduct) + '</dd></div><div><dt>发送人所属机构/部门</dt><dd>总行 / ' + escapeHtml(defaultSenderDepartment) + '</dd></div><div><dt>接收机构</dt><dd>' + escapeHtml(info.institution) + '</dd></div><div><dt>接收部门</dt><dd>' + escapeHtml(info.department) + '</dd></div></dl><div class="inspection-dialog-title"><strong>督导函核查结论</strong><span>核查人员可在发送前调整结论及补充说明。</span></div>' + inspectionDimensions.map(dimension => conclusionEditor(dimension.label, dimension.key, info.conclusions?.[dimension.key])).join("") + '<label class="action-full-field supervision-supplement"><span>补充内容</span><textarea class="di-textarea" data-supervision-field="supplement" placeholder="请输入督导要求、需补充材料和反馈时限等内容">请处理人根据上述核查结论补充说明，并在 3 个工作日内通过系统反馈相关材料。</textarea></label></div>';
    context.openModal("发送督导函", content, "发送督导函", () => {
      const overlay = modalRoot();
      const field = key => overlay?.querySelector('[data-supervision-field="' + key + '"]');
      const conclusions = {
        entry: { text: field("entry")?.value.trim() || "" },
        processing: { text: field("processing")?.value.trim() || "" },
        behavior: { text: field("behavior")?.value.trim() || "" }
      };
      const supplement = field("supplement")?.value.trim() || "";
      const selectedApproverValues = [...(overlay?.querySelectorAll("[data-supervision-cc-approver]:checked") || [])].map(input => input.value);
      const missingKey = Object.keys(conclusions).find(key => !conclusions[key].text);
      if (!selectedApproverValues.length) return context.showValidationError("请至少选择一位抄送审批人。", overlay?.querySelector("[data-supervision-approver-trigger]"));
      if (missingKey || !supplement) return context.showValidationError("请完善三项核查结论和补充内容。", missingKey ? field(missingKey) : field("supplement"));
      const summary = [
        {label:"工单编号",value:ticketId},{label:"客户姓名",value:ticket[2]},{label:"发送给",value:receiver + "（处理人）"},{label:"抄送",value:selectedApproverValues.join("、") + "（审批人）"},
        ...inspectionDimensions.map(dimension => ({label:dimension.label,value:conclusions[dimension.key].text,wide:true})),{label:"补充内容",value:supplement,wide:true}
      ];
      context.openSubmissionConfirmation("发送督导函", summary, () => {
        const now = context.systemTimestamp();
        const letterId = generateLetterId(context);
        if (!letterId) return { success:false, title:"督导函发送失败", message:"当日督导函编号已达到 9999 条上限，请联系系统管理员处理。", details:[] };
        const letter = { id:letterId, batchId:"", ticketId, sender:"陈敏慧-60157", senderOrg:"总行", senderDept:defaultSenderDepartment, method:"系统发送", createdAt:now,
          receiver, receiverOrg:info.institution, receiverDept:info.department, cc:selectedApproverValues.join("、"), ccApprovers:selectedApproverValues, conclusions, supplement, updatedAt:now,
          status:"处理中", startedAt:now, feedback:"", feedbackAt:"" };
        state.supervisionLetters.unshift(letter);
        context.assignWorkItem?.("subprocess", letter.id, receiver);
        context.persistWorkflowState();
        context.rerenderPage();
        return { success:true, title:"督导函发送成功", message:"督导函已通过系统发送给处理人，并抄送审批人。", details:[{label:"督导函编号",value:letter.id},{label:"当前状态",value:letter.status},{label:"发送时间",value:letter.createdAt}] };
      }, "确认发送");
    });
    bindApproverPicker();
  }

  function letterMarkup(letter, context, includeFeedback = true) {
    const ticket = ticketRow(letter.ticketId, context, [letter.ticketId, "工单", "-", "-", "-", "处理中", letter.createdAt]);
    const conclusions = inspectionDimensions.map(dimension => conclusionEditor(dimension.label, dimension.key, letter.conclusions?.[dimension.key], true)).join("");
    const feedback = includeFeedback && letter.feedback ? '<label class="supervision-conclusion-editor"><strong>处理人情况说明</strong><textarea class="di-textarea" readonly>' + escapeHtml(letter.feedback) + '</textarea><small>反馈时间：' + escapeHtml(letter.feedbackAt || "-") + '</small></label>' : "";
    return '<div class="supervision-letter-editor supervision-letter-detail"><div class="supervision-route"><div><span>发送方式</span><strong>' + escapeHtml(letter.method) + '</strong></div><div><span>发送给</span><strong>' + escapeHtml(letter.receiver) + '（处理人）</strong></div><div><span>抄送审批人</span><strong>' + escapeHtml(letter.cc) + '</strong></div></div><dl class="action-summary-grid supervision-ticket-summary"><div><dt>督导函编号</dt><dd>' + escapeHtml(letter.id) + '</dd></div><div><dt>关联工单</dt><dd>' + escapeHtml(ticket[0]) + '</dd></div><div><dt>客户姓名</dt><dd>' + escapeHtml(ticket[2]) + '</dd></div><div><dt>发送机构</dt><dd>' + escapeHtml(letter.senderOrg) + '</dd></div><div><dt>发送部门</dt><dd>' + escapeHtml(senderDepartment(letter)) + '</dd></div><div><dt>发送时间</dt><dd>' + escapeHtml(letter.createdAt) + '</dd></div></dl><div class="inspection-dialog-title"><strong>督导函核查结论</strong><span>以下为已发送的核查结论与督导要求。</span></div>' + conclusions + '<label class="action-full-field supervision-supplement"><span>督导要求</span><textarea class="di-textarea" readonly>' + escapeHtml(letter.supervisionRequirement) + '</textarea></label>' + feedback + '</div>';
  }

  function openLetterDetail(letterId, context) {
    const letter = state.supervisionLetters.find(item => item.id === letterId);
    if (!letter) return context.toast("未找到督导函记录", true);
    context.openModal("督导函详情", letterMarkup(letter, context), "关闭");
  }

  function supervisionLetterStatus(letter) {
    const raw = String(letter?.status || "");
    if (letter?.feedback || raw === "已反馈" || raw === "已办结") return "已办结";
    if (letter?.startedAt || raw === "处理中") return "处理中";
    return "待处理";
  }

  function supervisionLetterFlow(letter) {
    const operationTime = value => {
      const normalized = String(value || "-").trim().replace("T", " ");
      return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized) ? normalized + ":00" : normalized;
    };
    const rows = [
      { operatorName:letter.sender || "陈敏慧-60157", operatorRoleName:"核查人员", operatorOrgName:letter.senderOrg || "总行", flowSceneName:"发送督导函", flowOpinion:"", receiverName:letter.receiver || "-", statusTransition:"草稿 → 待处理", operationTime:operationTime(letter.createdAt) },
      ...(letter.startedAt ? [{ operatorName:letter.receiver || "处理人", operatorRoleName:"处理员", operatorOrgName:"接收机构", flowSceneName:"领取督导函", flowOpinion:"", receiverName:letter.receiver || "-", statusTransition:"待处理 → 处理中", operationTime:operationTime(letter.startedAt) }] : []),
      ...(letter.feedback ? [{ operatorName:letter.receiver || "处理人", operatorRoleName:"处理员", operatorOrgName:"接收机构", flowSceneName:"提交督导反馈", flowOpinion:"", receiverName:"-", statusTransition:"处理中 → 已办结", operationTime:operationTime(letter.feedbackAt) }] : [])
    ];
    return rows;
  }

  function renderSupervisionList(context) {
    const scope = "inspection-supervision-letters";
    const rows = sortedRows(state.supervisionLetters.map(letter => {
      const ticket = ticketRow(letter.ticketId, context);
      return [letter.id, letter.ticketId, ticket?.[2] || "-", receiverInstitution(letter), receiverDepartment(letter, context), letter.receiver || "-", supervisionLetterStatus(letter), letter.createdAt || "-"];
    }), scope);
    const filters = context.renderFilters([
      { label:"督导函编号", type:"input" },
      { label:"关联工单编号", type:"input" },
      { label:"督导函状态", type:"select", options:["待处理", "处理中", "已办结"] },
      { label:"发送时间", type:"range" },
      { label:"接收机构", type:"orgTree", key:"filter.inspections.receiverInstitution" },
      { label:"接收部门", type:"orgTree", key:"filter.inspections.receiverDepartment" }
    ]);
    const body = rows.map(row => '<tr>' + '<td class="primary-cell"><button type="button" class="btn-link" data-action="inspections-letter-page" data-id="' + escapeHtml(row[0]) + '">' + escapeHtml(row[0]) + '</button></td><td>' + escapeHtml(row[1]) + '</td><td>' + escapeHtml(row[2]) + '</td><td>' + escapeHtml(row[3]) + '</td><td>' + escapeHtml(row[4]) + '</td><td>' + escapeHtml(row[5]) + '</td><td>' + context.statusTag(row[6]) + '</td><td>' + escapeHtml(row[7]) + '</td><td class="operation-cell"><div class="row-actions"><button type="button" class="btn-link" data-action="inspections-letter-page" data-id="' + escapeHtml(row[0]) + '">查看</button>' + '</div></td></tr>').join("") || '<tr><td colspan="9"><div class="empty"><div><div class="empty-mark">督</div><p>暂无督导记录</p></div></div></td></tr>';
    const table = '<div class="table-wrap"><table class="table ds-table supervision-record-table"><thead><tr>' + sortableHead("督导函编号", scope, 0) + sortableHead("关联工单", scope, 1) + sortableHead("客户姓名", scope, 2) + sortableHead("接收机构", scope, 3) + sortableHead("接收部门", scope, 4) + sortableHead("接收处理人", scope, 5) + sortableHead("督导函状态", scope, 6) + sortableHead("发送时间", scope, 7) + '<th>操作</th></tr></thead><tbody>' + body + '</tbody></table></div>';
    return '<section class="page analysis-list-page xib-module-complaint-inspections" data-module="complaint-inspections">' + context.pageHeader("智能核查", "查看核查工单与督导反馈") + moduleTabs() + filters + '<div class="analysis-result-heading"><h1>督导记录 <span>（' + state.supervisionLetters.length + '）</span></h1><button type="button" class="btn xib-btn xib-btn--primary" data-action="inspections-export">导出</button></div><div class="panel">' + table + context.renderPagination(state.supervisionLetters.length, scope) + '</div></section>';
  }

  function renderSupervisionHandlingList(context) {
    const scope = "inspection-supervision-handling";
    const rows = sortedRows(state.supervisionLetters
      .filter(letter => ["待处理", "处理中"].includes(supervisionLetterStatus(letter)))
      .map(letter => {
        const ticket = ticketRow(letter.ticketId, context);
        const receiverOrg = letter.receiverOrg || ticket?.[4] || "-";
        const receiverDepartment = letter.receiverDepartment || (receiverOrg !== "-" ? receiverOrg + "消费者权益保护部" : "-");
        return [letter.id, letter.ticketId, ticket?.[2] || "-", receiverOrg, receiverDepartment, supervisionLetterStatus(letter), letter.createdAt || "-"];
      }), scope);
    const body = rows.map(row => '<tr><td class="primary-cell">' + escapeHtml(row[0]) + '</td><td>' + escapeHtml(row[1]) + '</td><td>' + escapeHtml(row[2]) + '</td><td>' + escapeHtml(row[3]) + '</td><td>' + escapeHtml(row[4]) + '</td><td>' + context.statusTag(row[5]) + '</td><td>' + escapeHtml(row[6]) + '</td><td class="operation-cell"><div class="row-actions"><button type="button" class="btn-link" data-action="process-supervision-letter" data-id="' + escapeHtml(row[0]) + '">处理</button><button type="button" class="btn-link" data-action="supervision-letter-detail" data-id="' + escapeHtml(row[0]) + '">查看</button></div></td></tr>').join("") || '<tr><td colspan="8"><div class="empty"><div><div class="empty-mark">督</div><p>暂无待处理督导函</p></div></div></td></tr>';
    const table = '<div class="table-wrap"><table class="table ds-table supervision-record-table"><thead><tr>' + sortableHead("督导函编号", scope, 0) + sortableHead("关联工单", scope, 1) + sortableHead("客户姓名", scope, 2) + sortableHead("接收机构", scope, 3) + sortableHead("接收部门", scope, 4) + sortableHead("督导函状态", scope, 5) + sortableHead("发送时间", scope, 6) + '<th>操作</th></tr></thead><tbody>' + body + '</tbody></table></div>';
    return '<section class="page analysis-list-page xib-module-complaint-inspections" data-module="complaint-inspections">' + context.pageHeader("智能核查", "处理分派至当前机构的督导函") + moduleTabs() + '<div class="analysis-result-heading"><h1>督导函处理 <span>（' + rows.length + '）</span></h1></div><div class="panel">' + table + context.renderPagination(rows.length, scope) + '</div></section>';
  }

  function renderSupervisionDetail(context) {
    const letter = state.supervisionLetters.find(item => item.id === state.letterId) || state.supervisionLetters[0];
    if (!letter) { state.letterId = ""; return renderSupervisionList(context); }
    const status = supervisionLetterStatus(letter);
    const ticket = ticketRow(letter.ticketId, context);
    const tabs = ["基本信息", "流转记录"];
    if (!tabs.includes(state.letterTab)) state.letterTab = "基本信息";
    const tabsHtml = '<div class="panel detail-tabs"><div class="tabs lib-tabs-line">' + tabs.map(tab => '<button type="button" class="tab ' + (state.letterTab === tab ? "is-active" : "") + '" data-inspections-letter-tab="' + escapeHtml(tab) + '">' + escapeHtml(tab) + '</button>').join("") + '</div></div>';
    const base = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">基本信息</span><small>发送阶段录入的信息</small></div><dl class="ds-descriptions detail-descriptions"><div><dt>督导函编号</dt><dd>' + escapeHtml(letter.id) + '</dd></div><div><dt>关联工单</dt><dd>' + escapeHtml(letter.ticketId) + '</dd></div><div><dt>客户姓名</dt><dd>' + escapeHtml(ticket?.[2] || "-") + '</dd></div><div><dt>发送人所属机构/部门</dt><dd>' + escapeHtml((letter.senderOrg || "-") + " / " + (letter.senderDepartment || (letter.senderOrg ? letter.senderOrg + "消费者权益保护部" : "-"))) + '</dd></div><div><dt>发送人</dt><dd>' + escapeHtml(letter.sender) + '</dd></div><div><dt>接收处理人</dt><dd>' + escapeHtml(letter.receiver) + '</dd></div><div><dt>抄送人</dt><dd>' + escapeHtml(letter.cc) + '</dd></div><div><dt>发送方式</dt><dd>' + escapeHtml(letter.method) + '</dd></div><div><dt>发送时间</dt><dd>' + escapeHtml(letter.createdAt) + '</dd></div><div><dt>当前状态</dt><dd>' + context.statusTag(status) + '</dd></div><div class="is-wide"><dt>督导要求</dt><dd>' + escapeHtml(letter.supplement) + '</dd></div></dl><div class="inspection-conclusion-list supervision-letter-conclusions is-plain-text">' + Object.entries(letter.conclusions || {}).map(item => '<article><header><strong>' + escapeHtml(inspectionLabel(item[0])) + '</strong></header><p>' + escapeHtml(item[1].text || item[1]) + '</p></article>').join("") + '</div></section>';
    const canEdit = status !== "已办结";
    const process = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">处理信息</span></div><label class="action-full-field supervision-reply-field"><span>督导反馈 <em>*</em></span><textarea class="di-textarea" data-supervision-detail-feedback ' + (canEdit ? "" : "readonly") + ' placeholder="请填写督导反馈">' + escapeHtml(letter.feedback || "") + '</textarea></label>' + (canEdit ? '<div class="sticky-actions supervision-detail-actions"><span>提交后督导函状态变为已办结</span><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="inspections-letter-submit" data-id="' + escapeHtml(letter.id) + '">提交督导反馈</button></div>' : '<section class="supervision-feedback-read"><header><strong>已办结</strong>' + context.statusTag("已办结") + '</header><p>' + escapeHtml(letter.feedback || "-") + '</p><small>反馈时间：' + escapeHtml(letter.feedbackAt || "-") + '</small></section>') + '</section>';
    const flowRows = supervisionLetterFlow(letter).map(item => '<tr><td>' + escapeHtml(item.operatorName) + '</td><td>' + escapeHtml(item.operatorRoleName) + '</td><td>' + escapeHtml(item.operatorOrgName) + '</td><td>' + escapeHtml(item.flowSceneName) + '</td><td class="transfer-opinion">' + escapeHtml(item.flowOpinion || "-") + '</td><td>' + escapeHtml(item.receiverName || "-") + '</td><td>' + escapeHtml(item.statusTransition) + '</td><td>' + escapeHtml(item.operationTime || "-") + '</td></tr>').join("");
    const flow = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">流转记录</span></div><div class="table-wrap"><table class="table ds-table transfer-record-table" data-disable-column-customizer><thead><tr><th>操作人</th><th>角色</th><th>机构</th><th>流转场景</th><th>流转意见</th><th>接收对象</th><th>状态流转</th><th>操作时间</th></tr></thead><tbody>' + flowRows + '</tbody></table></div></section>';
    const content = state.letterTab === "基本信息" ? base : flow;
    return '<section class="page subprocess-detail-page supervision-detail-page xib-module-complaint-inspections" data-module="complaint-inspections">' + context.pageHeader("督导函详情", "查看督导函发送、处理反馈与流转记录", '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="inspections-letter-back">' + context.icon("back") + ' 返回督导记录</button>') + '<div class="panel detail-summary"><div><span>督导函编号</span><strong>' + escapeHtml(letter.id) + '</strong></div><div><span>关联工单</span><strong>' + escapeHtml(letter.ticketId) + '</strong></div><div><span>当前状态</span>' + context.statusTag(status) + '</div><div><span>接收处理人</span><strong>' + escapeHtml(letter.receiver || "-") + '</strong></div></div>' + tabsHtml + content + '</section>';
  }

  function openLetterReply(letterId, context) {
    const letter = state.supervisionLetters.find(item => item.id === letterId);
    if (!letter) return context.toast("未找到督导函记录", true);
    if (supervisionLetterStatus(letter) === "已办结") return openLetterDetail(letterId, context);
    const content = letterMarkup(letter, context, false) + '<label class="action-full-field supervision-reply-field"><span>情况说明</span><textarea class="di-textarea" data-supervision-feedback placeholder="请说明核查问题、补充材料和整改处理情况"></textarea></label>';
    context.openModal("反馈督导函", content, "提交反馈", () => {
      const input = modalRoot()?.querySelector("[data-supervision-feedback]");
      const feedback = input?.value.trim() || "";
      if (!feedback) return context.showValidationError("请填写情况说明。", input);
      context.openSubmissionConfirmation("督导函反馈", [{label:"督导函编号",value:letter.id},{label:"关联工单",value:letter.ticketId},{label:"反馈给",value:letter.senderOrg},{label:"情况说明",value:feedback,wide:true}], () => {
        letter.feedback = feedback;
        letter.feedbackAt = context.systemTimestamp();
        letter.updatedAt = letter.feedbackAt;
        letter.status = "已办结";
        context.persistWorkflowState();
        context.rerenderPage();
        return { success:true, title:"督导函反馈成功", message:"情况说明已通过系统反馈至发函机构。", details:[{label:"督导函编号",value:letter.id},{label:"当前状态",value:letter.status},{label:"反馈时间",value:letter.feedbackAt}] };
      }, "确认提交");
    });
  }

  function currentSupervisionActor(context) {
    const supplied = context.getCurrentActor?.();
    if (supplied) return { ...supplied, id:actorId(supplied) };
    const role = context.state?.role || "developer";
    const identityRole = role === "developer" ? "operator" : role;
    const identity = context.getWorkPoolIdentity?.(identityRole) || {};
    return { id:actorId({ id:identity.actor }), name:identity.actor || "-", role };
  }

  function supervisionActorOptions(letter) {
    const handlers = [...new Set([letter.receiverName, ...data.ticketLibrary.map(item => item.handler)].filter(Boolean))];
    const approvers = [...new Set([...(letter.ccApproverNames || []), ...data.ticketLibrary.map(item => item.approver)].filter(Boolean))];
    return { handlers, approvers };
  }

  function supervisionInspectionMarkup(letter, context) {
    const ticket = ticketRow(letter.ticketId, context);
    const snapshot = letter.inspectionResultSnapshot || {};
    return '<section class="panel detail-section supervision-inspection-section"><div class="panel-head"><span class="panel-title">智能核查结果</span><small>发送时结果快照，与主单展示样式一致</small></div>' + renderInspectionFindings(snapshot, {
      ticketId:letter.ticketId,
      ticketType:ticket?.[1] || "投诉单",
      ticketStatus:ticket?.[5] || "处理中",
      staticResult:true
    }) + '</section>';
  }

  function renderSupervisionDraft(letter, context, actor) {
    if (!canEditSupervisionDraft(letter, actor)) return '<section class="panel empty"><strong>无权编辑该督导函草稿</strong></section>';
    const ticket = ticketRow(letter.ticketId, context);
    const run = latestTicketInspectionRun(letter.ticketId, context);
    const options = supervisionActorOptions(letter);
    const receiverOptions = options.handlers.map(name => '<option value="' + escapeHtml(actorId({ id:name })) + '" data-name="' + escapeHtml(name) + '" ' + (actorId({ id:name }) === letter.receiverId ? "selected" : "") + '>' + escapeHtml(name) + '</option>').join("");
    const approverOptions = options.approvers.map(name => '<label class="supervision-approver-option"><input type="checkbox" data-supervision-cc-approver value="' + escapeHtml(actorId({ id:name })) + '" data-name="' + escapeHtml(name) + '" ' + ((letter.ccApproverIds || []).includes(actorId({ id:name })) ? "checked" : "") + '><span>' + escapeHtml(name) + '</span></label>').join("");
    const form = '<section class="panel detail-section supervision-draft-editor"><div class="panel-head"><span class="panel-title">督导函草稿</span><small>发送后督导要求与核查结果将锁定</small></div><div class="form-grid"><div class="form-item"><label class="form-label required">指定处理人</label><div class="form-control"><select class="di-select" data-supervision-receiver><option value="">请选择</option>' + receiverOptions + '</select></div></div><div class="form-item is-wide"><label class="form-label">抄送审批员</label><div class="form-control supervision-approver-options">' + approverOptions + '</div></div><div class="form-item is-wide"><label class="form-label required">督导要求</label><div class="form-control"><textarea class="di-textarea" data-supervision-requirement placeholder="请输入督导要求、需补充材料和反馈时限等内容">' + escapeHtml(letter.supervisionRequirement) + '</textarea></div></div></div><div class="sticky-actions supervision-detail-actions"><span>草稿仅发起人可见</span><div class="sticky-action-buttons"><button type="button" class="btn xib-btn xib-btn--secondary" data-action="inspections-letter-save" data-id="' + escapeHtml(letter.id) + '">保存草稿</button><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="inspections-letter-send" data-id="' + escapeHtml(letter.id) + '">发送督导函</button></div></div></section>';
    const latestResults = '<section class="panel detail-section supervision-inspection-section"><div class="panel-head"><span class="panel-title">智能核查结果</span><small>当前主单最新核查结果，发送时生成快照</small></div>' + renderInspectionFindings(run?.findings || {}, { ticketId:letter.ticketId, ticketType:ticket?.[1] || "投诉单", ticketStatus:ticket?.[5] || "处理中", staticResult:true }) + '</section>';
    return form + latestResults;
  }

  function supervisionLetterFlowV2(letter) {
    const rows = [{
      operatorName:letter.senderName,
      operatorRoleName:"核查人员",
      operatorOrgName:letter.senderOrg || "总行",
      flowSceneName:"创建督导函草稿",
      flowOpinion:"-",
      receiverName:"-",
      statusTransition:"无 → 草稿",
      operationTime:letter.createdAt
    }];
    if (letter.sentAt) rows.push({
      operatorName:letter.senderName, operatorRoleName:"核查人员", operatorOrgName:letter.senderOrg || "总行",
      flowSceneName:"发送督导函", flowOpinion:letter.supervisionRequirement, receiverName:letter.receiverName,
      statusTransition:"草稿 → 处理中", operationTime:letter.sentAt
    });
    if (letter.completedAt) rows.push({
      operatorName:letter.receiverName, operatorRoleName:"处理员", operatorOrgName:letter.receiverOrg || "-",
      flowSceneName:"提交督导反馈", flowOpinion:letter.feedback, receiverName:"-",
      statusTransition:"处理中 → 已办结", operationTime:letter.completedAt
    });
    return rows;
  }

  function renderSupervisionDetailV2(context) {
    const letter = state.supervisionLetters.find(item => item.id === state.letterId);
    if (!letter) { state.letterId = ""; return renderSupervisionListV2(context); }
    const actor = currentSupervisionActor(context);
    if (!canViewSupervisionLetter(letter, actor)) return '<section class="page xib-module-complaint-inspections"><div class="panel empty"><strong>无权查看该督导函</strong></div></section>';
    const ticket = ticketRow(letter.ticketId, context);
    const header = context.pageHeader("督导函详情", "在智能核查中查看和处理督导函", '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="inspections-letter-back">' + context.icon("back") + ' 返回督导记录</button>');
    const summary = '<div class="panel detail-summary"><div><span>督导函编号</span><strong>' + escapeHtml(letter.id) + '</strong></div><div><span>关联工单</span><strong>' + escapeHtml(letter.ticketId) + '</strong></div><div><span>当前状态</span>' + context.statusTag(letter.status) + '</div><div><span>指定处理人</span><strong>' + escapeHtml(letter.receiverName || "-") + '</strong></div></div>';
    if (letter.status === "草稿") return '<section class="page supervision-detail-page xib-module-complaint-inspections" data-module="complaint-inspections">' + header + summary + renderSupervisionDraft(letter, context, actor) + '</section>';
    const tabs = ["基本信息", "流转记录"];
    if (!tabs.includes(state.letterTab)) state.letterTab = "基本信息";
    const tabsHtml = '<div class="panel detail-tabs"><div class="tabs lib-tabs-line">' + tabs.map(tab => '<button type="button" class="tab ' + (state.letterTab === tab ? "is-active" : "") + '" data-inspections-letter-tab="' + escapeHtml(tab) + '">' + escapeHtml(tab) + '</button>').join("") + '</div></div>';
    const basic = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">基本信息</span></div><dl class="ds-descriptions detail-descriptions"><div><dt>关联工单</dt><dd>' + escapeHtml(letter.ticketId) + '</dd></div><div><dt>客户姓名</dt><dd>' + escapeHtml(ticket?.[2] || "-") + '</dd></div><div><dt>发送人</dt><dd>' + escapeHtml(letter.senderName) + '</dd></div><div><dt>指定处理人</dt><dd>' + escapeHtml(letter.receiverName) + '</dd></div><div><dt>抄送审批员</dt><dd>' + escapeHtml((letter.ccApproverNames || []).join("、") || "-") + '</dd></div><div><dt>发送时间</dt><dd>' + escapeHtml(letter.sentAt || "-") + '</dd></div><div class="is-wide"><dt>督导要求</dt><dd>' + escapeHtml(letter.supervisionRequirement) + '</dd></div></dl></section>' + supervisionInspectionMarkup(letter, context);
    const canProcess = canProcessSupervisionLetter(letter, actor);
    const feedbackReadonly = !canProcess || letter.status === "已办结";
    const feedback = '<section class="panel detail-section supervision-feedback-section"><div class="panel-head"><span class="panel-title">处理信息</span>' + (letter.status === "已办结" ? '<small>办结时间：' + escapeHtml(letter.completedAt || "-") + '</small>' : '') + '</div><div class="form-grid"><div class="form-item is-wide"><label class="form-label' + (canProcess ? ' required' : '') + '">督导反馈</label><div class="form-control"><textarea class="di-textarea" data-supervision-detail-feedback ' + (feedbackReadonly ? 'readonly' : '') + ' placeholder="' + (feedbackReadonly ? '暂未填写督导反馈' : '请填写督导反馈') + '">' + escapeHtml(letter.feedback || "") + '</textarea></div></div></div>' + (canProcess ? '<div class="sticky-actions supervision-detail-actions"><span>提交后状态变为已办结</span><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="inspections-letter-submit" data-id="' + escapeHtml(letter.id) + '">提交督导反馈</button></div>' : '') + '</section>';
    const flowRows = supervisionLetterFlowV2(letter).map(item => '<tr><td>' + escapeHtml(item.operatorName) + '</td><td>' + escapeHtml(item.operatorRoleName) + '</td><td>' + escapeHtml(item.operatorOrgName) + '</td><td>' + escapeHtml(item.flowSceneName) + '</td><td>' + escapeHtml(item.flowOpinion) + '</td><td>' + escapeHtml(item.receiverName) + '</td><td>' + escapeHtml(item.statusTransition) + '</td><td>' + escapeHtml(item.operationTime || "-") + '</td></tr>').join("");
    const flow = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">流转记录</span></div><div class="table-wrap"><table class="table ds-table transfer-record-table" data-disable-column-customizer><thead><tr><th>操作人</th><th>角色</th><th>机构</th><th>流转场景</th><th>流转意见</th><th>接收对象</th><th>状态流转</th><th>操作时间</th></tr></thead><tbody>' + flowRows + '</tbody></table></div></section>';
    return '<section class="page supervision-detail-page xib-module-complaint-inspections" data-module="complaint-inspections">' + header + summary + tabsHtml + (state.letterTab === "基本信息" ? basic + feedback : flow) + '</section>';
  }

  function visibleSupervisionLetters(context) {
    const actor = currentSupervisionActor(context);
    return state.supervisionLetters.filter(letter => ["处理中", "已办结"].includes(letter.status) && canViewSupervisionLetter(letter, actor));
  }

  function renderSupervisionListV2(context) {
    const scope = "inspection-supervision-letters";
    const actor = currentSupervisionActor(context);
    const visible = visibleSupervisionLetters(context);
    const rows = sortedRows(visible.map(letter => {
      const ticket = ticketRow(letter.ticketId, context);
      return [letter.id, letter.ticketId, ticket?.[2] || "-", letter.receiverName || "-", (letter.ccApproverNames || []).join("、") || "-", letter.status, letter.sentAt || letter.createdAt || "-"];
    }), scope);
    const filters = context.renderFilters([{ label:"督导函编号", type:"input" }, { label:"关联工单编号", type:"input" }, { label:"督导函状态", type:"select", options:["处理中", "已办结"] }, { label:"发送时间", type:"range" }]);
    const body = rows.map(row => {
      const letter = state.supervisionLetters.find(item => item.id === row[0]);
      const label = canEditSupervisionDraft(letter, actor) ? "编辑" : canProcessSupervisionLetter(letter, actor) ? "处理" : "查看";
      const action = label === "编辑" ? "inspections-letter-edit" : label === "处理" ? "inspections-letter-process" : "inspections-letter-page";
      return '<tr><td class="primary-cell"><button type="button" class="btn-link" data-action="inspections-letter-page" data-id="' + escapeHtml(row[0]) + '">' + escapeHtml(row[0]) + '</button></td><td>' + escapeHtml(row[1]) + '</td><td>' + escapeHtml(row[2]) + '</td><td>' + escapeHtml(row[3]) + '</td><td>' + escapeHtml(row[4]) + '</td><td>' + context.statusTag(row[5]) + '</td><td>' + escapeHtml(row[6]) + '</td><td class="operation-cell"><button type="button" class="btn-link" data-action="' + action + '" data-id="' + escapeHtml(row[0]) + '">' + label + '</button></td></tr>';
    }).join("") || '<tr><td colspan="8"><div class="empty"><div><div class="empty-mark">督</div><p>暂无督导记录</p></div></div></td></tr>';
    return '<section class="page analysis-list-page xib-module-complaint-inspections" data-module="complaint-inspections">' + context.pageHeader("智能核查", "查看核查工单与督导反馈") + moduleTabs() + filters + '<div class="analysis-result-heading"><h1>督导记录 <span>（' + visible.length + '）</span></h1></div><div class="panel"><div class="table-wrap"><table class="table ds-table supervision-record-table"><thead><tr><th>督导函编号</th><th>关联工单</th><th>客户姓名</th><th>指定处理人</th><th>抄送审批员</th><th>督导函状态</th><th>创建/发送时间</th><th>操作</th></tr></thead><tbody>' + body + '</tbody></table></div>' + context.renderPagination(visible.length, scope) + '</div></section>';
  }

  function readSupervisionDraftForm(letter) {
    const receiver = document.querySelector("[data-supervision-receiver]");
    const selectedReceiver = receiver?.selectedOptions?.[0];
    const approvers = [...(document.querySelectorAll?.("[data-supervision-cc-approver]:checked") || [])];
    return {
      receiverId:receiver?.value || "",
      receiverName:selectedReceiver?.dataset?.name || selectedReceiver?.textContent?.trim() || "-",
      ccApproverIds:approvers.map(input => input.value),
      ccApproverNames:approvers.map(input => input.dataset.name || input.value),
      supervisionRequirement:document.querySelector("[data-supervision-requirement]")?.value?.trim() || letter.supervisionRequirement || ""
    };
  }

  function createDraftForTicket(ticketId, context) {
    const actor = currentSupervisionActor(context);
    const result = createSupervisionDraft(ticketId, actor, context.systemTimestamp());
    if (!result.ok) return result;
    const info = ticketRecord(ticketId);
    saveSupervisionDraft(result.letter.id, {
      senderOrg:"总行", senderDepartment:defaultSenderDepartment,
      receiverId:actorId({ id:info.handler }), receiverName:info.handler,
      receiverOrg:info.institution, receiverDepartment:info.department,
      ccApproverIds:[actorId({ id:info.approver })], ccApproverNames:[info.approver],
      method:"系统发送",
      supervisionRequirement:"请处理人根据智能核查结果补充说明，并在 3 个工作日内通过系统反馈相关材料。"
    }, actor, context.systemTimestamp());
    state.letterId = result.letter.id;
    state.letterTab = "基本信息";
    context.persistWorkflowState();
    context.rerenderPage(true);
    return { ok:true, letter:getSupervisionLetterById(result.letter.id) };
  }

  function getSupervisionLetterById(id) {
    return clone(state.supervisionLetters.find(letter => letter.id === id) || null);
  }

  function updateSelection(root, scope) {
    const inputs = [...root.querySelectorAll('[data-inspections-row-select="' + scope + '"]')];
    const checked = inputs.filter(input => input.checked).length;
    const count = root.querySelector('[data-inspections-count="' + scope + '"]');
    if (count) count.textContent = String(checked);
    const all = root.querySelector('[data-inspections-select-all="' + scope + '"]');
    if (all) {
      all.checked = inputs.length > 0 && checked === inputs.length;
      all.indeterminate = checked > 0 && checked < inputs.length;
    }
  }

  registry.register({
    name: "complaint-inspections",
    routes: ["analysis-inspections"],
    render(page, context) {
      if (state.letterId) return renderSupervisionDetailV2(context);
      return state.activeTab === "督导记录" ? renderSupervisionListV2(context) : renderTicketList(context);
    },
    afterRender(root, page, context) {
      root.querySelectorAll("[data-inspections-sort-index]").forEach(button => button.addEventListener("click", () => {
        const scope = button.dataset.inspectionsSortScope;
        const index = Number(button.dataset.inspectionsSortIndex);
        const current = state.sorts[scope];
        state.sorts[scope] = current?.index === index ? { index, direction:current.direction === "asc" ? "desc" : "asc" } : { index, direction:"asc" };
        context.rerenderPage(true);
      }));
      root.querySelectorAll("[data-inspections-select-all]").forEach(input => input.addEventListener("change", () => {
        const scope = input.dataset.inspectionsSelectAll;
        root.querySelectorAll('[data-inspections-row-select="' + scope + '"]').forEach(rowInput => { rowInput.checked = input.checked; });
        updateSelection(root, scope);
      }));
      root.querySelectorAll("[data-inspections-row-select]").forEach(input => input.addEventListener("change", () => updateSelection(root, input.dataset.inspectionsRowSelect)));
      root.querySelectorAll("[data-inspections-tab]").forEach(button => button.addEventListener("click", () => { state.activeTab = button.dataset.inspectionsTab; state.letterId = ""; context.rerenderPage(true); }));
      root.querySelectorAll("[data-inspections-letter-tab]").forEach(button => button.addEventListener("click", () => { state.letterTab = button.dataset.inspectionsLetterTab; context.rerenderPage(true); }));
    },
    handleAction(action, payload, context) {
      if (action === "inspections-ticket-detail") { openTicketInspection(payload.id, context); return true; }
      if (action === "inspections-open-ticket") { context.openTicketDetail(payload.id); return true; }
      if (action === "inspections-letter-draft") { const result = createDraftForTicket(payload.id, context); if (!result.ok) context.toast(result.reason, true); return true; }
      if (["inspections-letter-page", "inspections-letter-edit", "inspections-letter-process"].includes(action)) { state.letterId = payload.id; state.letterTab = "基本信息"; context.rerenderPage(true); return true; }
      if (action === "inspections-letter-back") { state.letterId = ""; state.letterTab = "基本信息"; state.activeTab = "督导记录"; context.rerenderPage(true); return true; }
      if (action === "inspections-letter-save") {
        const letter = state.supervisionLetters.find(item => item.id === payload.id);
        const result = saveSupervisionDraft(payload.id, readSupervisionDraftForm(letter), currentSupervisionActor(context), context.systemTimestamp());
        if (!result.ok) context.toast(result.reason, true);
        else { context.persistWorkflowState(); context.toast("督导函草稿已保存"); context.rerenderPage(true); }
        return true;
      }
      if (action === "inspections-letter-send") {
        const letter = state.supervisionLetters.find(item => item.id === payload.id);
        const actor = currentSupervisionActor(context);
        const draft = readSupervisionDraftForm(letter);
        const saved = saveSupervisionDraft(payload.id, draft, actor, context.systemTimestamp());
        if (!saved.ok) { context.toast(saved.reason, true); return true; }
        if (!draft.receiverId) { context.showValidationError("请选择指定处理人。", document.querySelector("[data-supervision-receiver]")); return true; }
        if (!draft.supervisionRequirement) { context.showValidationError("请填写督导要求。", document.querySelector("[data-supervision-requirement]")); return true; }
        const run = latestTicketInspectionRun(saved.letter.ticketId, context);
        const result = sendSupervisionLetter(payload.id, actor, run?.findings || {}, context.systemTimestamp());
        if (!result.ok) context.toast(result.reason, true);
        else { context.persistWorkflowState(); context.toast("督导函已发送"); context.rerenderPage(true); }
        return true;
      }
      if (action === "inspections-letter-submit") {
        const input = document.querySelector("[data-supervision-detail-feedback]");
        const feedback = input?.value.trim() || "";
        if (!feedback) { context.showValidationError("请填写督导反馈。", input); return true; }
        const result = completeSupervisionLetter(payload.id, feedback, currentSupervisionActor(context), context.systemTimestamp());
        if (!result.ok) context.toast(result.reason, true);
        else { context.persistWorkflowState(); context.toast("督导反馈已提交"); context.rerenderPage(true); }
        return true;
      }
      if (action === "inspections-export") { context.toast("已创建智能核查导出任务"); return true; }
      return false;
    }
  });

  global.XIBComplaintInspections = Object.freeze({
    renderInspectionFindings,
    bindInspectionRetry,
    resetViewState() { state.activeTab = "核查工单"; state.letterId = ""; },
    serializeState() { return { supervisionLetters:clone(state.supervisionLetters) }; },
    hydrateState(saved) {
      if (Array.isArray(saved?.supervisionLetters)) state.supervisionLetters = clone(saved.supervisionLetters).map(normalizeSupervisionLetter);
    },
    getSupervisionLetter(id) { return clone(state.supervisionLetters.find(letter => letter.id === id) || null); },
    normalizeSupervisionLetter,
    canViewSupervisionLetter,
    canEditSupervisionDraft,
    canProcessSupervisionLetter,
    createSupervisionDraft,
    saveSupervisionDraft,
    sendSupervisionLetter,
    completeSupervisionLetter,
    openLetterInModule(id) {
      state.activeTab = "督导记录";
      state.letterId = id || "";
      state.letterTab = "基本信息";
    },
    normalizeSupervisionLetterIds,
    getSupervisionLetterById
  });
})(window);
