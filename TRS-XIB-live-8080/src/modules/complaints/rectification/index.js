(function registerComplaintRectification(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  const data = global.XIB_COMPLAINT_RECTIFICATION_DATA;
  const detail = global.XIBComplaintRectificationDetail;
  const workPool = global.XIBComplaintWorkPool;
  if (!registry) throw new Error("XIBModuleRegistry must load before complaint-rectification.");
  if (!data) throw new Error("Complaint rectification data must load before its module.");
  if (!detail) throw new Error("Complaint rectification detail must load before its module.");
  if (!workPool) throw new Error("Complaint work-pool must load before rectification.");

  const state = { module: "create", view: "workbench", tab: "todo" };
  const statusRank = new Map(data.statusOrder.map((status, index) => [status, index]));
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  const MODULES = ["create", "process", "approve"];
  const VIEWS = [
    { key: "workbench", label: "我的工作台", desc: "当前任务角色经手过且尚未办结的整改单" },
    { key: "org", label: "机构工单池", desc: "本机构范围内未办结的整改单" },
    { key: "subOrg", label: "下辖工单池", desc: "下辖机构全部未办结整改单" }
  ];

  let contextRef = null;

  function documentField(row, path) {
    if (!contextRef || !path) return "";
    const doc = contextRef.getRectificationDocument(row[0]);
    const parts = String(path).split(".");
    const stage = parts[0];
    const field = parts.slice(1).join(".");
    const value = doc?.fields?.[stage]?.[field];
    if (value === undefined || value === null) return "";
    return Array.isArray(value) ? value.join("、") : String(value);
  }

  function sortedRows(rows) {
    return rows.map(row => [...row]).sort((left, right) =>
      (statusRank.get(String(left[5] || "")) ?? data.statusOrder.length) -
      (statusRank.get(String(right[5] || "")) ?? data.statusOrder.length)
    );
  }

  function actionDef(key, label, action, batch = "", danger = false) {
    return { key, label, action, batch, danger };
  }

  function rowActions(row, role, moduleKey) {
    const status = row[5];
    const actions = [];
    const creator = ["operator", "developer"].includes(role);
    if (moduleKey === "create") {
      if (status === "草稿" && creator) {
        actions.push(actionDef("edit", "编辑", "edit-rectification"));
        actions.push(actionDef("delete", "删除", "delete-row", "", true));
      }
      if (status === "问题待提交" && creator) {
        actions.push(actionDef("edit", "编辑", "edit-rectification"));
      }
    }
    if (moduleKey === "process" && data.processStates.includes(status) && ["handler", "developer"].includes(role)) {
      actions.push(actionDef("process", "处理", "rectification-process"));
    }
    if (moduleKey === "approve" && data.approvalStates.includes(status) && ["approver", "developer"].includes(role)) {
      actions.push(actionDef("approve", "审批", "rectification-approve"));
    }

    if (creator && moduleKey === "create" && status === "问题待提交") actions.push(actionDef("void", "废止", "void-rectification", "", true));
    actions.push(actionDef("detail", "查看", "rectification-detail"));
    return actions;
  }

  function operationDefs(rows, role, moduleKey) {
    const byKey = new Map();
    rows.forEach(row => rowActions(row, role, moduleKey).forEach(definition => byKey.set(definition.key, definition)));
    return data.operationOrder.filter(key => byKey.has(key)).map(key => byKey.get(key));
  }

  function operationHeaders(definitions) {
    return definitions.map((definition, index) => '<th class="operation-column" title="' + escapeHtml(definition.label) + '">' + (index === 0 ? "操作" : "") + "</th>").join("");
  }

  function operationCells(definitions, actions, id) {
    const byKey = new Map(actions.map(action => [action.key, action]));
    return definitions.map(definition => {
      const action = byKey.get(definition.key);
      if (!action) return '<td class="operation-column">-</td>';
      return '<td class="operation-column"><button class="btn-link' + (action.danger ? " is-danger" : "") + '" data-operation-key="' + escapeHtml(action.key) + '"' + (action.batch ? ' data-batch-label="' + escapeHtml(action.batch) + '"' : "") + ' data-action="' + escapeHtml(action.action) + '" data-id="' + escapeHtml(id) + '">' + escapeHtml(action.label) + "</button></td>";
    }).join("");
  }

  function tableHead(label) {
    return '<th>' + escapeHtml(label) + '</th>';
  }

  function relatedTicketSummary(row) {
    const ids = contextRef.getRectificationRelatedTicketIds ? contextRef.getRectificationRelatedTicketIds(row) : contextRef.getRelatedTicketIds(row[2]);
    if (!ids.length) return "-";
    const label = ids.length > 1 ? ids[0] + "/..." : ids[0];
    return '<button type="button" class="btn-link" data-action="rectification-related-tickets" data-id="' + escapeHtml(row[0]) + '">' + escapeHtml(label) + '</button>';
  }

  function renderTable(rows, role, moduleKey) {
    const displayed = sortedRows(rows);
    const definitions = operationDefs(displayed, role, moduleKey);
    const body = displayed.length ? displayed.map(row => {
      const displayId = row[5] === "草稿" ? "-" : row[0];
      const applicationTime = documentField(row, "base.申请时间") || row[6] || "-";
      const plannedCompletionTime = documentField(row, "plan.计划完成时间") || "-";
      const responsible = documentField(row, "entry.整改负责人（处置员）") || "-";
      const creator = documentField(row, "base.创建人") || row[3];
      const organization = documentField(row, "entry.整改部门或机构") || row[4];
      const copied = Boolean(documentField(row, "entry.抄送人"));
      return '<tr data-rectification-row="' + escapeHtml(row[0]) + '" data-rectification-creator="' + escapeHtml(creator) + '" data-rectification-organization="' + escapeHtml(organization) + '" data-rectification-responsible="' + escapeHtml(responsible) + '" data-rectification-copied="' + (copied ? '是' : '否') + '" data-rectification-application-time="' + escapeHtml(applicationTime) + '" data-rectification-planned-completion-time="' + escapeHtml(plannedCompletionTime) + '"><td class="primary-cell">' + escapeHtml(displayId) + '</td><td>' + escapeHtml(row[7] || "-") + '</td><td>' + relatedTicketSummary(row) + '</td><td>' + escapeHtml(creator) + '</td><td>' + escapeHtml(organization) + '</td><td>' + contextRef.statusTag(row[5]) + '</td><td>' + escapeHtml(applicationTime) + '</td><td>' + escapeHtml(plannedCompletionTime) + '</td>' + operationCells(definitions, rowActions(row, role, moduleKey), row[0]) + "</tr>";
    }).join("") : '<tr><td colspan="' + (8 + definitions.length) + '"><div class="empty"><div><p>当前栏目暂无溯源整改单</p></div></div></td></tr>';
    return '<div class="table-wrap"><table class="table ds-table rectification-table"><thead><tr>' + tableHead("整改单编号") + tableHead("整改单名称") + tableHead("关联工单编号") + tableHead("创建人") + tableHead("负责机构") + tableHead("整改状态") + tableHead("申请时间") + tableHead("计划完成时间") + operationHeaders(definitions) + '</tr></thead><tbody>' + body + "</tbody></table></div>";
  }

  function renderList(context, moduleKey) {
    const allRows = context.getRectificationRows();
    const role = context.role;
    const pool = workPool.model(allRows, { task: "rectification-" + moduleKey, view: state.view, tab: state.tab });
    const rows = pool.rows;
    const tableRows = moduleKey === "create"
      ? context.paginateRows(sortedRows(rows), "rectification-create", 20, [10, 20])
      : rows;
    const moduleLabel = data.modules[moduleKey].label;
    const roleText = moduleKey === "process" ? "处理员视角" : moduleKey === "approve" ? "审批员视角" : "经办员视角";
    const createAction = moduleKey === "create" && ["operator", "developer"].includes(role) ? '<button class="btn xib-btn xib-btn--primary btn-primary" data-action="new-rectification">' + context.icon("plus") + " 新建整改单</button>" : "";
    const scopeCounts = { workbench: pool.counts.workbench, org: pool.counts.org, subOrg: pool.counts.subOrg };
    const scopeGridHtml = '<div class="scope-grid rectification-scope-grid">' + VIEWS.map(view => '<button type="button" class="scope-card ds-card app-card ' + (state.view === view.key ? "is-active" : "") + '" data-rectification-view="' + view.key + '"><b>' + scopeCounts[view.key] + '</b><strong>' + view.label + '</strong><span>' + view.desc + '</span></button>').join("") + '</div>';
    return '<section class="page xib-module-complaint-rectification" data-module="complaint-rectification" data-rectification-module="' + moduleKey + '">' +
      context.pageHeader(moduleLabel, "集中管理溯源整改单的创建、处理与审批；当前视角：" + roleText, createAction) +
      scopeGridHtml +
      (state.view === "workbench" ? '<div class="panel" style="margin-bottom:12px"><div class="tabs lib-tabs-line">' + ['<button class="tab ' + (state.tab === "todo" ? "is-active" : "") + '" data-rectification-tab="todo">待办<span class="count">' + pool.counts.todo + '</span></button>', '<button class="tab ' + (state.tab === "all" ? "is-active" : "") + '" data-rectification-tab="all">全部<span class="count">' + pool.counts.workbench + '</span></button>'].join("") + '</div></div>' : "") +
      context.renderGroupedFilters([
        [{label:"整改状态",type:"select",options:data.statusOrder},{label:"整改单编号",type:"input"},{label:"关联工单编号",type:"input"}],
        [{label:"申请时间",type:"range"},{label:"计划完成时间",type:"range"}],
        [{label:"整改单创建人",type:"input"},{label:"整改机构或部门",type:"orgTree",key:"filter.rectification.organization"},{label:"整改负责人",type:"input",placeholder:"请输入整改负责人关键词"}]
      ], "rectification-filter-panel") +
      '<div class="panel">' + renderTable(tableRows, role, moduleKey) + (moduleKey === "create" ? context.renderPagination(rows.length, "rectification-create", 20, [10, 20]) : context.renderPagination(rows.length)) + '</div></section>';
  }

  function render(context) {
    contextRef = context;
    const page = context.page;
    const moduleKey = page === "rectification-create" ? "create" : page === "rectification-process" ? "process" : "approve";
    state.module = moduleKey;
    return renderList(context, moduleKey);
  }

  function renderForm(context) {
    const model = context.getRectificationFormModel();
    const row = model.row;
    const sections = model.sections || [];
    const scope = "subprocess.溯源整改";
    const anchors = [{ id:"rectification-basic", title:"基础信息" }].concat(sections.map((section, index) => ({ id:"rectification-difference-" + (index + 1), title:section.title })));
    const title = row ? "编辑溯源整改单" : "新建溯源整改单";
    const demoAction = model.role === "developer" ? '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="demo-fill-subprocess">' + context.icon("edit") + ' 一键填写 Demo</button>' : "";
    const difference = sections.map((section, index) => '<section class="form-section subprocess-difference-section" id="section-rectification-difference-' + (index + 1) + '"><div class="form-section-head">' + escapeHtml(section.title) + (row ? '<small>整改发起阶段填写</small>' : '') + '</div><div class="form-section-body"><div class="form-grid">' + section.fields.map(field => context.renderRectificationFormField(!row && field.name === "投诉原因标签" ? { ...field, summaryLevels:2 } : field, scope)).join("") + '</div></div></section>').join("");
    const submitLabel = row?.[5] === "草稿" ? "提交整改问题" : "提交整改单";
    return '<section class="page subprocess-form-page rectification-form-page xib-module-complaint-rectification" data-module="complaint-rectification" data-rectification-view="form" style="padding-bottom:0">' + context.pageHeader(title, "录入整改单基础信息与整改问题，整改方案和整改成果在处理阶段填写", context.renderContextBackButton(context.getRectificationReturnPage ? context.getRectificationReturnPage() : "rectification-create", "溯源整改")) +
      '<div class="form-layout subprocess-form-layout"><form id="rectification-form-main"><section class="form-section" id="section-rectification-basic"><div class="form-section-head">基础信息</div><div class="form-section-body"><div class="form-grid">' +
      '<div class="form-item"><label class="form-label required">创建人</label><div class="form-control"><input class="di-input is-fluid" value="' + escapeHtml(documentField(row || ["", "", "", "", "", "草稿", "", "", "", false], "base.创建人") || row?.[3] || "陈敏慧-60157") + '" disabled></div></div>' +
      '<div class="form-item"><label class="form-label required">所属机构</label><div class="form-control"><input class="di-input is-fluid" value="' + escapeHtml(row?.[4] || context.currentInstitutionLabel()) + '" disabled></div></div>' +
      '<div class="form-item"><label class="form-label required">所属部门</label><div class="form-control"><input class="di-input is-fluid" value="' + escapeHtml(row ? context.qualifiedDepartmentName(row[4], "消费者权益保护部") : context.currentDepartmentLabel()) + '" disabled></div></div>' +
      '<div class="form-item"><label class="form-label required">溯源整改单编号</label><div class="form-control"><input class="di-input is-fluid" value="' + escapeHtml(row && row[5] !== "草稿" ? row[0] : "提交后系统生成") + '" disabled></div></div>' +
      '<div class="form-item"><label class="form-label required">申请时间</label><div class="form-control"><input class="di-input is-fluid" value="' + escapeHtml(model.applicationTime || "提交后系统自动生成") + '" disabled></div></div>' +
      '<div class="form-item"><label class="form-label required">办结时间</label><div class="form-control"><input class="di-input is-fluid" value="' + escapeHtml(row?.[5] === "已办结" ? row[6] : "-") + '" disabled></div></div></div></div></section>' + difference + '</form><aside class="form-anchor"><div class="anchor-title">填写导航</div><nav class="lib-anchor" aria-label="溯源整改填写导航">' + anchors.map((section, index) => '<a class="anchor-link ' + (index === 0 ? "is-active" : "") + '" href="#section-' + escapeHtml(section.id) + '" data-anchor="' + escapeHtml(section.id) + '">' + escapeHtml(section.title) + '</a>').join("") + '</nav></aside></div>' +
      '<div class="sticky-actions">' + (row ? '<span style="margin-right:auto;color:var(--muted);font-size:12px">整改方案与整改成果由处理员在后续节点填写</span>' : '') + '<div class="sticky-action-buttons">' + demoAction + '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="save-rectification-draft">保存草稿</button><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="submit-rectification">' + submitLabel + '</button></div></div></section>';
  }

  function openRelatedTicketPicker(context) {
    const selected = context.getRectificationRelatedTicketIds();
    const rows = context.getRectificationPickerRows();
    const filters = '<div class="query-filter-row rectification-picker-filters"><label><span>工单编号</span><input class="di-input" data-rectification-filter="id" placeholder="输入工单编号"></label><label><span>客户姓名</span><input class="di-input" data-rectification-filter="customer" placeholder="输入客户姓名"></label><label><span>工单类型</span><select class="di-native-select" data-rectification-filter="type"><option value="">全部</option>' + [...new Set(rows.map(row => row[1]).filter(Boolean))].map(type => '<option>' + escapeHtml(type) + '</option>').join("") + '</select></label><button type="button" class="btn xib-btn xib-btn--primary" data-rectification-picker-search>查询</button></div>';
    const table = '<div class="table-wrap"><table class="table ds-table rectification-related-picker"><thead><tr><th></th><th>工单编号</th><th>工单类型</th><th>客户姓名</th><th>受理渠道</th><th>当前机构</th><th>工单状态</th></tr></thead><tbody>' + rows.map(row => '<tr data-rectification-picker-row data-ticket-id="' + escapeHtml(row[0]) + '" data-ticket-type="' + escapeHtml(row[1]) + '" data-ticket-customer="' + escapeHtml(row[2]) + '"><td><input type="checkbox" data-rectification-ticket value="' + escapeHtml(row[0]) + '" ' + (selected.includes(row[0]) ? "checked" : "") + '></td><td class="primary-cell">' + escapeHtml(row[0]) + '</td><td>' + escapeHtml(row[1]) + '</td><td>' + escapeHtml(row[2]) + '</td><td>' + escapeHtml(row[3]) + '</td><td>' + escapeHtml(row[4]) + '</td><td>' + context.statusTag(row[5]) + '</td></tr>').join("") + '</tbody></table></div>';
    context.openModal("查询关联工单", '<div class="query-dialog rectification-picker-dialog">' + filters + '<div class="import-validation-note">仅展示当前数据权限范围内、状态允许关联的工单；支持勾选多张工单。</div>' + table + '</div>', "确认关联", () => {
      const values = [...document.querySelectorAll("[data-rectification-ticket]:checked")].map(input => input.value);
      context.setRectificationRelatedTickets(values);
      context.closeOverlay();
      context.rerenderPage();
      context.toast(values.length ? "已关联 " + values.length + " 张工单" : "已清空关联工单");
    });
    document.querySelector("[data-rectification-picker-search]")?.addEventListener("click", () => {
      const idValue = document.querySelector('[data-rectification-filter="id"]')?.value.trim().toLowerCase() || "";
      const customerValue = document.querySelector('[data-rectification-filter="customer"]')?.value.trim().toLowerCase() || "";
      const typeValue = document.querySelector('[data-rectification-filter="type"]')?.value || "";
      const tableBody = document.querySelector(".rectification-related-picker tbody");
      tableBody?.querySelector("[data-rectification-picker-empty]")?.remove();
      let visibleCount = 0;
      document.querySelectorAll("[data-rectification-picker-row]").forEach(row => {
        row.hidden = Boolean((idValue && !row.dataset.ticketId.toLowerCase().includes(idValue)) || (customerValue && !row.dataset.ticketCustomer.toLowerCase().includes(customerValue)) || (typeValue && row.dataset.ticketType !== typeValue));
        if (!row.hidden) visibleCount += 1;
      });
      if (!visibleCount && tableBody) tableBody.insertAdjacentHTML("beforeend", '<tr data-empty-state data-rectification-picker-empty><td colspan="7"><div class="ds-empty app-empty-state"><h4>暂无数据</h4></div></td></tr>');
    });
  }

  function handleModuleAction(action, payload, context) {
    if (action === "open-rectification-related-ticket") { context.openTicketDetail(payload.id); return true; }
    if (["rectification-create", "rectification-process", "rectification-approve"].includes(context.page) && ["new-rectification", "edit-rectification"].includes(action)) {
      context.openRectificationForm(action === "edit-rectification" ? payload.id : "");
      return true;
    }
    if (context.page !== "rectification-form") return false;
    if (action === "remove-rectification-related-ticket") {
      context.setRectificationRelatedTickets(context.getRectificationRelatedTicketIds().filter(ticketId => ticketId !== payload.id));
      context.rerenderPage();
      context.toast("已从关联列表移除 " + payload.id);
      return true;
    }
    if (action === "search-rectification-related-tickets") { openRelatedTicketPicker(context); return true; }
    if (action === "save-rectification-draft") { context.saveRectificationDraft(); return true; }
    if (action === "submit-rectification") { context.submitRectification(); return true; }
    return false;
  }

  registry.register({
    name: "complaint-rectification",
    routes: ["rectification-create", "rectification-process", "rectification-approve", "rectification-form", "rectification-detail"],
    render(page, context) {
      if (page === "rectification-form") return renderForm(context);
      if (page === "rectification-detail") return detail.render(context);
      return render(context);
    },
    afterRender(root, page, context) {
      if (!["rectification-create", "rectification-process", "rectification-approve"].includes(page)) return;
      contextRef = context;
      root.querySelectorAll("[data-rectification-view]").forEach(button => button.addEventListener("click", () => {
        state.view = button.dataset.rectificationView;
        context.rerenderPage(true);
      }));
      root.querySelectorAll("[data-rectification-tab]").forEach(button => button.addEventListener("click", () => {
        state.tab = button.dataset.rectificationTab;
        context.rerenderPage(true);
      }));
    },
    handleAction: handleModuleAction
  });

  global.XIBComplaintRectification = Object.freeze({
    setListTab(tab) { state.tab = String(tab || "todo"); },
    resetListState() { state.module = "create"; state.view = "workbench"; state.tab = "todo"; },
    renderDetail(context) { return detail.render(context); }
  });
})(window);
