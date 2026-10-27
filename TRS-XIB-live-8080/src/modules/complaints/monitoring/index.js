(function registerComplaintMonitoring(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  const data = global.XIB_COMPLAINT_MONITORING_DATA;
  if (!registry) throw new Error("XIBModuleRegistry must load before complaint-monitoring.");
  if (!data) throw new Error("Complaint monitoring data must load before its module.");

  /* tab = 当前页签（warnings 预警单 / cc 抄送单）；sortIndex 只在预警单页签内生效。 */
  const moduleState = { sortIndex: null, sortDirection: "asc", tab: "warnings", detailId: "" };
  /* 预警单列表的总量口径（原型演示数据量），抄送单页签的数量取实际抄送记录数。 */
  const WARNING_TOTAL = 53;
  const TAB_DEFS = Object.freeze([Object.freeze(["warnings", "预警单"]), Object.freeze(["cc", "抄送单"])]);
  const SCOPE_BY_TAB = Object.freeze({ warnings: "analysis-warnings", cc: "analysis-cc-warnings" });
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  /* 生成时间仅展示到日（yyyy-mm-dd），不带时分秒。 */
  const generatedDate = value => String(value ?? "").trim().split(/[ T]/)[0];
  /* 预警摘要里的关键数据（模板占位符代入的实测值）蓝色高亮；取不到高亮版时退回纯文本。 */
  const summaryHtml = (warningId, plain) => data.warningSummaryMarkup?.(warningId) || escapeHtml(plain);
  /* 预警机构 / 预警部门 / 所属业务条线 在本场景不适用时留空，列表统一落 "-"。 */
  const cellText = value => {
    const text = String(value ?? "").trim();
    return text && text !== "-" && text !== "—" ? text : "-";
  };
  const textCell = (value, className) => "<td" + (className ? ' class="' + className + '"' : "") + ">" + escapeHtml(cellText(value)) + "</td>";
  const warningIdCell = warningId => '<td><button type="button" class="btn-link analysis-record-link" data-action="monitoring-warning-detail" data-id="' + escapeHtml(warningId) + '">' + escapeHtml(warningId) + "</button></td>";

  function sortedWarnings() {
    const rows = data.warningRows.map(row => [...row]);
    if (moduleState.sortIndex === null) return rows;
    const direction = moduleState.sortDirection === "asc" ? 1 : -1;
    return rows.sort((left, right) => String(left[moduleState.sortIndex]).localeCompare(String(right[moduleState.sortIndex]), "zh-CN", { numeric: true }) * direction);
  }

  function sortableHead(label, index) {
    return "<th>" + escapeHtml(label) + "</th>";
  }

  function selectionHead(scope) {
    return '<th class="selection-cell"><input type="checkbox" data-select-all="' + scope + '" aria-label="全选当前结果"></th>';
  }

  function selectionCell(scope, id) {
    return '<td class="selection-cell"><input type="checkbox" data-row-select="' + scope + '" value="' + escapeHtml(id) + '" aria-label="选择 ' + escapeHtml(id) + '"></td>';
  }

  /* 批量操作栏复用查询导出列表的布局：左侧展示选中数，右侧按钮与操作列对齐。 */
  function bulkToolbar(scope, tab) {
    return '<div class="table-bulk-toolbar" data-bulk-toolbar="' + scope + '" data-module-bulk="true" style="--bulk-operation-count:1">' +
      '<div class="table-bulk-summary"><span>已选 <b data-bulk-count="' + scope + '">0</b> 项</span></div>' +
      '<div class="table-bulk-slot"><button type="button" class="btn-link" data-action="monitoring-export-selected" data-id="' + escapeHtml(tab) + '" data-monitoring-bulk-export disabled>批量导出</button></div>' +
      '<div class="table-bulk-utility-spacer" aria-hidden="true"></div></div>';
  }

  /* 选中行：批量导出只导出用户自己勾选的记录，选择状态由浏览器里的复选框决定。 */
  function selectedRowIds(scope) {
    const nodes = global.document?.querySelectorAll?.('[data-row-select="' + scope + '"]:checked') || [];
    return [...nodes].map(node => node.value).filter(Boolean);
  }

  /* 预警单页签的列：预警机构 / 预警部门不是每条预警都有值——
     只有带量场景才有预警机构，只有双一级标签（产品类/原因类）场景才有预警部门，
     维度判定由 src/core/alert-rule-config.js 声明，这里只负责把空值渲染成 "-"。 */
  function warningColumns() {
    return [
      { head: "预警单编号", index: 0, cell: row => warningIdCell(row[0]) },
      { head: "场景类型", index: 1, cell: row => textCell(row[1]) },
      { head: "预警摘要", index: 2, cell: row => '<td class="warning-summary" title="' + escapeHtml(row[2]) + '">' + summaryHtml(row[0], row[2]) + "</td>" },
      { head: "预警机构", index: 3, cell: row => textCell(row[3]) },
      { head: "预警部门", index: 4, cell: row => textCell(row[4]) },
      { head: "所属业务条线", index: 5, cell: row => textCell(row[5]) },
      { head: "生成时间", index: 6, cell: row => textCell(generatedDate(row[6])) }
    ];
  }

  /* 抄送单页签的列：场景、摘要、机构、部门、条线全部回落到对应预警单，
     页签自己只补充「谁抄的、什么时候抄的、看没看」。 */
  function ccColumns() {
    return [
      { head: "预警单编号", index: 1, cell: row => warningIdCell(row[1]) },
      { head: "场景类型", index: 2, cell: row => textCell(row[2]) },
      { head: "预警摘要", index: 3, cell: row => '<td class="warning-summary" title="' + escapeHtml(row[3]) + '">' + summaryHtml(row[1], row[3]) + "</td>" },
      { head: "预警机构", index: 4, cell: row => textCell(row[4]) },
      { head: "预警部门", index: 5, cell: row => textCell(row[5]) },
      { head: "所属业务条线", index: 6, cell: row => textCell(row[6]) },
      { head: "抄送人", index: 7, cell: row => textCell(row[7]) },
      { head: "抄送时间", index: 8, cell: row => textCell(row[8]) },
      { head: "抄送状态", index: 9, cell: row => textCell(row[9]) }
    ];
  }

  function renderTable(scope, tab, rows, columns, rowActions) {
    const head = selectionHead(scope) + columns.map(column => sortableHead(column.head, column.index)).join("") + "<th>操作</th>";
    const body = rows.map(row => "<tr>" + selectionCell(scope, row[0]) + columns.map(column => column.cell(row)).join("") + rowActions(row) + "</tr>").join("");
    return bulkToolbar(scope, tab) + '<div class="table-wrap"><table class="table ds-table selectable-table analysis-table warning-table"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function renderTabs(activeTab) {
    return '<div class="panel monitoring-tabs-panel" style="margin-bottom:0"><div class="tabs lib-tabs-line">' +
      TAB_DEFS.map(([key, label]) => '<button type="button" class="tab ' + (activeTab === key ? "is-active" : "") + '" data-action="monitoring-tab" data-id="' + key + '">' + label + "</button>").join("") +
      "</div></div>";
  }

  function renderWarnings(context) {
    const tab = moduleState.tab === "cc" ? "cc" : "warnings";
    const scope = SCOPE_BY_TAB[tab];
    const ccRows = [...data.warningCcRows];
    const rows = tab === "cc" ? ccRows : sortedWarnings();
    const filters = context.renderGroupedFilters([
      [{ label: "预警类型", type: "select", options: ["全量投诉量异常", "监管转办投诉量异常", "自收投诉投诉量异常", "一级产品投诉量异常", "一级原因投诉量异常", "升级投诉", "高发投诉客户", "高风险客户"] }, { label: "生成时间", type: "range" }, { label: "预警编号", type: "input" }],
      [{ label: "预警机构", type: "orgTree", key:"filter.monitoring.institution" }, { label: "预警部门", type:"orgTree", key:"filter.monitoring.department" }, { label: "所属业务条线", type: "multiSelect", options: context.getBusinessLineOptions(), key: "filter.monitoring.business-lines" }]
    ], "monitoring-filter-panel");
    const table = tab === "cc"
      ? renderTable(scope, tab, rows, ccColumns(), row => '<td class="operation-cell"><button type="button" class="btn-link" data-action="monitoring-warning-detail" data-id="' + escapeHtml(row[1]) + '">查看</button><button type="button" class="btn-link" data-action="monitoring-export-row" data-id="' + escapeHtml(row[0]) + '" data-tab="cc">导出</button></td>')
      : renderTable(scope, tab, rows, warningColumns(), row => '<td class="operation-cell"><button type="button" class="btn-link" data-action="monitoring-warning-copy" data-id="' + escapeHtml(row[0]) + '">抄送</button><button type="button" class="btn-link" data-action="monitoring-export-row" data-id="' + escapeHtml(row[0]) + '" data-tab="warnings">导出</button></td>');
    const total = tab === "cc" ? ccRows.length : WARNING_TOTAL;
    const title = tab === "cc" ? "抄送单列表" : "预警单列表";
    return '<section class="page analysis-list-page xib-module-complaint-monitoring" data-module="complaint-monitoring">' +
      context.pageHeader("智能预警", "查看投诉波动、产品风险及高发投诉预警") + renderTabs(tab) + filters +
      '<div class="analysis-result-heading"><h1>' + title + '</h1></div>' +
      '<div class="panel">' + table + context.renderPagination(total) + "</div></section>";
  }

  function renderMonitor(context) {
    return '<section class="page xib-module-complaint-monitoring" data-module="complaint-monitoring">' +
      context.pageHeader("数据监测", "按机构、产品、渠道和投诉原因持续监测投诉指标") +
      '<div class="panel"><div class="empty analysis-monitor-empty"><div><div class="empty-mark">⌁</div><h3>数据监测</h3><p>监测指标、阈值和趋势图将在后续迭代中补充。</p></div></div></div></section>';
  }


  function copyPersonEntries() {
    const records = global.XIB_PROTOTYPE_CONFIG?.organizationTree?.organizations || [];
    const byId = new Map(records.map(record => [record.id, record]));
    const users = global.XIB_ADMIN_USERS_DATA?.users || [];
    return users.filter(user => user.user_status === "1" && user.hr_user_status === "在职" && user.dept_code).map(user => {
      const organization = byId.get(user.org_code) || byId.get(user.loaned_org_code);
      const department = byId.get(user.dept_code);
      const org = organization?.name || "未选机构";
      const dept = department?.name || org;
      const person = user.user_name + "-" + user.user_empno;
      return { org, dept, person, value: org + " / " + dept + " / " + person };
    });
  }

  function copyPersonSelectedTags(selected) {
    return selected.length
      ? selected.map(value => '<span class="hierarchy-selected-tag ds-tag"><span class="hierarchy-tag-prefix">' + escapeHtml(value) + '</span><button type="button" data-monitoring-copy-person-remove="' + escapeHtml(value) + '" aria-label="移除 ' + escapeHtml(value) + '">×</button></span>').join('')
      : '<span class="risk-tag-empty">尚未选择抄送人</span>';
  }

  function copyPersonColumns(entries, selected, activeOrg, activeDept) {
    const orgs = [...new Set(entries.map(entry => entry.org))];
    const departments = [...new Set(entries.filter(entry => entry.org === activeOrg).map(entry => entry.dept))];
    const people = entries.filter(entry => entry.org === activeOrg && entry.dept === activeDept);
    const column = (title, items, attr, current) => '<div class="risk-cascade-column"><div class="risk-cascade-title">' + title + '</div>' + (items.length ? items.map(item => '<button type="button" class="' + (item === current ? 'is-active' : '') + '" data-monitoring-copy-person-' + attr + '="' + escapeHtml(item) + '"><span>' + escapeHtml(item) + '</span><span>›</span></button>').join('') : '<p class="hierarchy-empty-column">请先选择上一级</p>') + '</div>';
    const peopleColumn = '<div class="risk-cascade-column"><div class="risk-cascade-title">人员</div>' + (people.length ? people.map(entry => '<button type="button" class="risk-leaf-option ' + (selected.includes(entry.value) ? 'is-selected' : '') + '" data-monitoring-copy-person-leaf="' + escapeHtml(entry.value) + '"><span>' + escapeHtml(entry.person) + '</span><small>' + (selected.includes(entry.value) ? '已选择' : '选择') + '</small></button>').join('') : '<p class="hierarchy-empty-column">请先选择部门/团队</p>') + '</div>';
    return column('机构', orgs, 'org', activeOrg) + column('部门/团队', departments, 'dept', activeDept) + peopleColumn;
  }

  function copyPersonPicker(entries, selected, personKey) {
    const orgs = [...new Set(entries.map(entry => entry.org))];
    const activeOrg = orgs[0] || '';
    const activeDept = entries.find(entry => entry.org === activeOrg)?.dept || '';
    const summary = selected.length ? '已选 ' + selected.length + ' 项' : (entries.length ? '请选择抄送人' : '暂无可选抄送人');
    const tags = '<div class="risk-selected-sticky hierarchy-selected-sticky"><div><strong>当前已选标签</strong><span>可多选，无数量限制；请选择人员</span></div><div class="risk-sticky-tags" data-monitoring-copy-person-selected>' + copyPersonSelectedTags(selected) + '</div></div>';
    const columns = '<div class="risk-tag-cascader is-level-3" data-monitoring-copy-person-columns>' + copyPersonColumns(entries, selected, activeOrg, activeDept) + '</div>';
    return '<div class="di-hierarchy-cascader is-fluid monitoring-copy-person-picker" id="monitoring-copy-person-picker" data-field-key="' + escapeHtml(personKey) + '"><button type="button" class="di-select is-fluid di-hierarchy-cascader-trigger" data-monitoring-copy-person-trigger><span>' + escapeHtml(summary) + '</span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><div class="di-hierarchy-cascader-popover" data-monitoring-copy-person-menu hidden>' + tags + columns + '<div class="di-multi-cascader-foot"><button type="button" class="btn-link" data-monitoring-copy-person-clear>清空</button><button type="button" class="btn xib-btn xib-btn--primary" data-monitoring-copy-person-confirm>确定</button></div></div></div>';
  }

  function openWarningCopy(id, context) {
    const row = data.warningRows.find(item => item[0] === id) || data.warningRows[0];
    const personKey = 'monitoring.copy.' + row[0] + '.person';
    if (!Array.isArray(context.state?.formValues?.[personKey])) context.state.formValues[personKey] = context.state.formValues[personKey] ? [context.state.formValues[personKey]] : [];
    const personEntries = copyPersonEntries();
    const validPeople = personEntries.map(entry => entry.value);
    context.state.formValues[personKey] = context.state.formValues[personKey].filter(value => validPeople.includes(value));
    const personSelect = copyPersonPicker(personEntries, context.state.formValues[personKey], personKey);
    const content = '<div class="action-dialog monitoring-copy-dialog"><dl class="action-summary-grid"><div><dt>预警单编号</dt><dd>' + escapeHtml(row[0]) + '</dd></div><div><dt>场景类型</dt><dd>' + escapeHtml(row[1]) + '</dd></div><div><dt>预警摘要</dt><dd>' + escapeHtml(row[2]) + '</dd></div></dl><div class="form-grid"><div class="form-item span-2"><label class="form-label required"><span>抄送人</span></label><div class="form-control">' + personSelect + '</div></div></div></div>';
    context.openModal('抄送预警', content, '确认抄送', () => {
      const people = Array.isArray(context.state.formValues[personKey]) ? context.state.formValues[personKey] : [];
      if (!people.length) return context.toast('请选择抄送人', true);
      /* 抄送动作登记进「被抄送」页签，让抄送结果在列表里可见，而不是只弹一句提示。 */
      const copiedAt = context.systemTimestamp ? context.systemTimestamp() : "";
      people.forEach(person => data.appendWarningCc?.({
        warningId: row[0],
        ccedBy: String(person).split(" / ").at(-1) || String(person),
        ccedAt: copiedAt,
        status: "未读"
      }));
      context.closeOverlay();
      context.rerenderPage?.();
      context.toast(row[0] + ' 已抄送给 ' + people.join('、'));
    });
    const picker = document.getElementById('monitoring-copy-person-picker');
    const queryPicker = selector => typeof picker?.querySelector === 'function' ? picker.querySelector(selector) : null;
    const trigger = queryPicker('[data-monitoring-copy-person-trigger]');
    const menu = queryPicker('[data-monitoring-copy-person-menu]');
    let activeOrg = personEntries[0]?.org || '';
    let activeDept = personEntries.find(entry => entry.org === activeOrg)?.dept || '';
    const renderPicker = () => {
      const entries = personEntries;
      const orgs = [...new Set(entries.map(entry => entry.org))];
      if (!orgs.includes(activeOrg)) activeOrg = orgs[0] || '';
      const departments = [...new Set(entries.filter(entry => entry.org === activeOrg).map(entry => entry.dept))];
      if (!departments.includes(activeDept)) activeDept = departments[0] || '';
      const valid = entries.map(entry => entry.value);
      context.state.formValues[personKey] = (context.state.formValues[personKey] || []).filter(value => valid.includes(value));
      if (menu) {
        const tags = menu.querySelector('[data-monitoring-copy-person-selected]');
        const columns = menu.querySelector('[data-monitoring-copy-person-columns]');
        if (tags) tags.innerHTML = copyPersonSelectedTags(context.state.formValues[personKey]);
        if (columns) columns.innerHTML = copyPersonColumns(entries, context.state.formValues[personKey], activeOrg, activeDept);
      }
      if (trigger) trigger.querySelector('span').textContent = context.state.formValues[personKey].length ? '已选 ' + context.state.formValues[personKey].length + ' 项' : (entries.length ? '请选择抄送人' : '暂无可选抄送人');
    };
    trigger?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); if (menu) menu.hidden = !menu.hidden; picker.classList.toggle('is-open', !menu?.hidden); });
    menu?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target.closest('button');
      if (!target) return;
      if (target.dataset.monitoringCopyPersonOrg !== undefined) { activeOrg = target.dataset.monitoringCopyPersonOrg; activeDept = personEntries.find(entry => entry.org === activeOrg)?.dept || ''; renderPicker(); menu.hidden = false; return; }
      if (target.dataset.monitoringCopyPersonDept !== undefined) { activeDept = target.dataset.monitoringCopyPersonDept; renderPicker(); menu.hidden = false; return; }
      if (target.dataset.monitoringCopyPersonLeaf !== undefined) {
        const value = target.dataset.monitoringCopyPersonLeaf;
        const selected = context.state.formValues[personKey] || [];
        context.state.formValues[personKey] = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value];
        renderPicker(); menu.hidden = false;
        return;
      }
      if (target.dataset.monitoringCopyPersonRemove !== undefined) { context.state.formValues[personKey] = (context.state.formValues[personKey] || []).filter(item => item !== target.dataset.monitoringCopyPersonRemove); renderPicker(); menu.hidden = false; return; }
      if (target.dataset.monitoringCopyPersonClear !== undefined) { context.state.formValues[personKey] = []; renderPicker(); menu.hidden = false; return; }
      if (target.dataset.monitoringCopyPersonConfirm !== undefined) { menu.hidden = true; picker.classList.remove('is-open'); }
    });
  }

  function selectedWarning() {
    let id = moduleState.detailId;
    try { id = id || global.sessionStorage?.getItem("xib-monitoring-warning-detail-id") || ""; } catch (error) {}
    return data.warningRows.find(item => item[0] === id) || null;
  }

  function rememberWarning(id) {
    moduleState.detailId = id;
    try { global.sessionStorage?.setItem("xib-monitoring-warning-detail-id", id); } catch (error) {}
  }

  function renderWarningDetail(context) {
    const row = selectedWarning();
    if (!row) {
      const back = '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="monitoring-warning-back">← 返回智能预警</button>';
      return '<section class="page analysis-warning-detail-page xib-module-complaint-monitoring" data-module="complaint-monitoring">' +
        context.pageHeader("预警单详情", "", back) + '<div class="panel"><div class="empty"><div><h3>未找到对应的预警记录</h3><p>请返回智能预警列表后重新选择。</p></div></div></div></section>';
    }
    const warningContext = data.warningContexts[row[0]] || { ticketIds: [] };
    const contextTickets = warningContext.ticketIds.map(ticketId => data.tickets[ticketId]).filter(Boolean);
    const customerScopedScene = ["升级投诉", "高发投诉客户", "高风险客户"].includes(row[1]);
    const customerTickets = customerScopedScene && warningContext.customerName
      ? Object.values(data.tickets).filter(ticket => ticket.customer === warningContext.customerName)
      : contextTickets;
    const relatedTickets = row[1] === "高风险客户" ? customerTickets.slice(0, 1) : customerTickets;
    const customerHtml = warningContext.customerName || warningContext.customerId
      ? "<div><dt>客户姓名</dt><dd>" + escapeHtml(warningContext.customerName || "-") + "</dd></div><div><dt>客户编号</dt><dd>" + escapeHtml(warningContext.customerId || "-") + "</dd></div>"
      : "";
    const showBusinessLine = row[1] === "一级产品投诉量异常";
    const businessLineHead = showBusinessLine ? "<th>所属业务条线</th>" : "";
    const relatedTable = '<div class="table-wrap"><table class="table ds-table monitoring-related-ticket-table" data-disable-column-customizer><thead><tr><th>投诉工单编号</th><th>客户姓名</th><th>投诉渠道</th><th>投诉产品标签</th><th>投诉原因标签</th>' + businessLineHead + '<th>工单创建机构</th><th>状态</th></tr></thead><tbody>' +
      relatedTickets.map(ticket => '<tr><td><button type="button" class="btn-link" data-action="monitoring-ticket-open" data-id="' + escapeHtml(ticket.id) + '">' + escapeHtml(ticket.id) + "</button></td><td>" + escapeHtml(ticket.customer) + "</td><td>" + escapeHtml(ticket.channel) + '</td><td><span class="ds-tag">' + escapeHtml(ticket.productTag) + '</span></td><td><span class="ds-tag">' + escapeHtml(ticket.reasonTag) + "</span></td>" + (showBusinessLine ? "<td>" + escapeHtml(ticket.businessLine) + "</td>" : "") + "<td>" + escapeHtml(ticket.creationOrganization) + "</td><td>" + context.statusTag(ticket.status) + "</td></tr>").join("") +
      "</tbody></table></div>";
    const showRelatedTickets = ![
      "全量投诉量异常",
      "全量异常投诉",
      "监管转办投诉量异常",
      "自收投诉投诉量异常"
    ].includes(row[1]);
    const relatedSection = showRelatedTickets
      ? '<div class="panel-head" style="margin-top:18px"><span class="panel-title">关联投诉工单</span></div>' + relatedTable
      : "";
    const content = '<div class="action-dialog monitoring-warning-detail-content"><dl class="action-summary-grid"><div><dt>预警单编号</dt><dd>' + escapeHtml(row[0]) + "</dd></div><div><dt>场景类型</dt><dd>" + escapeHtml(row[1]) + "</dd></div><div><dt>预警机构</dt><dd>" + escapeHtml(cellText(row[3])) + "</dd></div><div><dt>预警部门</dt><dd>" + escapeHtml(cellText(row[4])) + "</dd></div><div><dt>所属业务条线</dt><dd>" + escapeHtml(cellText(row[5])) + "</dd></div>" + customerHtml + "<div><dt>生成时间</dt><dd>" + escapeHtml(generatedDate(row[6])) + '</dd></div></dl><div class="risk-detail-modal"><h4>预警摘要</h4><p>' + summaryHtml(row[0], row[2]) + "</p></div>" + relatedSection + "</div>";
    const back = '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="monitoring-warning-back">← 返回智能预警</button>';
    return '<section class="page analysis-warning-detail-page xib-module-complaint-monitoring" data-module="complaint-monitoring" data-warning-detail-id="' + escapeHtml(row[0]) + '">' +
      context.pageHeader("预警单详情", "", back) + '<div class="panel monitoring-warning-detail-panel">' + content + "</div></section>";
  }

  registry.register({
    name: "complaint-monitoring",
    routes: ["analysis-monitor", "analysis-warnings", "analysis-warning-detail"],
    render(page, context) {
      if (page === "analysis-monitor") return renderMonitor(context);
      if (page === "analysis-warning-detail") return renderWarningDetail(context);
      return renderWarnings(context);
    },
    afterRender(root, page, context) {
      if (page !== "analysis-warnings") return;
      const bulkButton = root.querySelector("[data-monitoring-bulk-export]");
      const selectionInputs = [...root.querySelectorAll('[data-row-select="' + SCOPE_BY_TAB[moduleState.tab] + '"]')];
      const syncBulkExport = () => {
        if (bulkButton) bulkButton.disabled = !selectionInputs.some(input => input.checked);
      };
      selectionInputs.forEach(input => input.addEventListener("change", syncBulkExport));
      root.querySelector('[data-select-all="' + SCOPE_BY_TAB[moduleState.tab] + '"]')?.addEventListener("change", () => global.setTimeout(syncBulkExport, 0));
      syncBulkExport();
      root.querySelectorAll("[data-monitoring-sort-index]").forEach(button => button.addEventListener("click", () => {
        const index = Number(button.dataset.monitoringSortIndex);
        if (moduleState.sortIndex === index) moduleState.sortDirection = moduleState.sortDirection === "asc" ? "desc" : "asc";
        else { moduleState.sortIndex = index; moduleState.sortDirection = "asc"; }
        context.rerenderPage(true);
      }));
    },
    handleAction(action, payload, context) {
      if (action === "monitoring-tab") {
        const tab = payload.id === "cc" ? "cc" : "warnings";
        if (moduleState.tab !== tab) {
          moduleState.tab = tab;
          /* 两个页签的行结构不同，切换时必须清掉排序，避免拿预警单的列下标去排被抄送的行。 */
          moduleState.sortIndex = null;
          moduleState.sortDirection = "asc";
          context.rerenderPage(true);
        }
        return true;
      }
      /* 单条导出 / 批量导出：预警数据导出不需要走审批，直接产出结果。 */
      if (action === "monitoring-export-row") {
        const tab = (payload.tab || payload.trigger?.dataset?.tab) === "cc" ? "cc" : "warnings";
        context.toast("已导出" + (tab === "cc" ? "抄送单 " : "预警单 ") + payload.id);
        return true;
      }
      if (action === "monitoring-export-selected") {
        const tab = payload.id === "cc" ? "cc" : "warnings";
        const ids = selectedRowIds(SCOPE_BY_TAB[tab]);
        if (!ids.length) { context.toast("请先选择需要导出的记录", true); return true; }
        context.toast("已导出所选 " + ids.length + " 条" + (tab === "cc" ? "抄送单" : "预警单"));
        return true;
      }
      if (action === "monitoring-warning-detail") {
        rememberWarning(payload.id);
        context.navigate("analysis-warning-detail");
        return true;
      }
      if (action === "monitoring-warning-back") { context.navigate("analysis-warnings"); return true; }
      if (action === "monitoring-ticket-open") {
        const warning = selectedWarning();
        if (!warning) { context.toast("未找到对应的预警记录", true); return true; }
        context.openTicketDetail(payload.id, { warningContextId: warning[0] });
        return true;
      }
      if (action === "monitoring-warning-copy") { openWarningCopy(payload.id, context); return true; }
      return false;
    }
  });
})(window);
