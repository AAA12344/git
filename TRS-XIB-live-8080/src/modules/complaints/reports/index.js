(function registerComplaintReports(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  const data = global.XIB_COMPLAINT_REPORTS_DATA;
  if (!registry) throw new Error("XIBModuleRegistry must load before complaints-reports.");
  if (!data) throw new Error("Complaint reports data must load before its module.");

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
  const state = { reportId:"", catalogType:"全部", exclusions:{} };
  const ticketIds = ["TS202607230012", "XF202607210008", "JY202607240017", "TS202607290016", "TS202607310106", "XF202608040001", "TS202608040012", "JY202607280019", "XF202608040002", "TS202608050011", "BY202607220021", "TS202411080211"];
  const statuses = ["处理中", "待处理", "待审批", "审批中", "已办结"];
  const channels = ["客服电话", "营业网点", "金融消费者保护服务平台"];
  const institutions = ["总行", "厦门分行", "福州分行"];

  function rememberReport(id) {
    state.reportId = id;
    try { sessionStorage.setItem("xib-complaint-report-id", id); } catch (error) {}
  }

  function selectedReport() {
    let id = state.reportId;
    try { id = id || sessionStorage.getItem("xib-complaint-report-id") || ""; } catch (error) {}
    return data.reports.find(report => report.id === id) || data.reports[0];
  }

  function typeTabs() {
    return '<div class="xib-segmented-filter report-catalog-tabs" role="tablist" aria-label="行内报表类型">' + ["全部", "统计", "明细"].map(type => '<button type="button" class="' + (state.catalogType === type ? "is-active" : "") + '" role="tab" aria-selected="' + (state.catalogType === type) + '" data-action="complaints-report-type" data-id="' + type + '">' + type + '</button>').join("") + '</div>';
  }

  function sectionTitle(title, count, tabs = "") {
    return '<div class="analysis-section-title"><i></i><h2>' + escapeHtml(title) + '</h2><span>' + count + ' 张</span>' + tabs + '</div>';
  }

  function renderCatalog(context) {
    const header = context.pageHeader ? context.pageHeader("报表管理") : '<div class="page-header"><h1 class="page-title">报表管理</h1></div>';
    return '<section class="page analysis-report-page xib-module-complaints-reports" data-module="complaints-reports" data-report-view="catalog">' + header +
      data.groups.map(group => {
        const items = group.title === "行内报表" && state.catalogType !== "全部" ? group.items.filter(item => item.type === state.catalogType) : group.items;
        return '<section class="analysis-report-section" data-report-group="' + escapeHtml(group.title) + '">' + sectionTitle(group.title, items.length, group.title === "行内报表" ? typeTabs() : "") + '<div class="analysis-report-grid">' +
          items.map(item => '<button type="button" class="analysis-report-card" data-action="complaints-report-open" data-id="' + escapeHtml(item.id) + '" data-report-type="' + escapeHtml(item.type) + '"><span class="analysis-report-icon is-' + (item.type === "统计" ? "statistics" : "detail") + '"><img src="ui/assets/' + escapeHtml(item.icon) + '" alt=""></span><span class="analysis-report-card-copy"><strong>' + escapeHtml(item.name) + '</strong></span></button>').join("") +
          '</div></section>';
      }).join("") + '</section>';
  }

  function filterDefinition(item, report, index, context) {
    const key = "filter.report." + report.id + "." + index;
    if (item.control === "dateRange") return { label:item.label, type:"range" };
    if (item.control === "keyword") return { label:item.label, type:"input", placeholder:"请输入" + item.label };
    if (item.control === "range") return { html:'<div class="ticket-filter-item is-range report-number-filter"><label>' + escapeHtml(item.label) + '</label><div class="filter-number-controls"><input class="di-input is-fluid" type="number" min="0" placeholder="下限"><i>至</i><input class="di-input is-fluid" type="number" min="0" placeholder="上限"></div></div>' };
    if (item.label === "投诉产品标签") return { label:item.label, type:"tagHierarchy", dictionary:"rectificationProduct", key };
    if (item.label === "投诉原因标签") return { label:item.label, type:"tagHierarchy", dictionary:"rectificationCause", key };
    if (item.label === "所属业务条线") return { label:item.label, type:"multiSelect", options:context.getBusinessLineOptions(), key };
    if (/机构|部门/.test(item.label)) return { label:item.label, type:"orgTree", key };
    if (item.control === "multiSelect") return { label:item.label, type:"multiSelect", options:item.options, key };
    return { label:item.label, type:"select", options:item.options.length ? item.options : undefined };
  }

  function renderFilterPanel(report, context) {
    const groups = { core:[], customer:[], ownership:[], tags:[] };
    report.filters.forEach((item, index) => {
      if (item.control === "checkboxes") return;
      const group = /客户|投诉笔数/.test(item.label) ? "customer" : /机构|部门|所属业务条线|问责对象/.test(item.label) ? "ownership" : /标签|业务办理渠道|投诉原因/.test(item.label) ? "tags" : "core";
      groups[group].push(context.renderFilterField(filterDefinition(item, report, index, context)));
    });
    const fields = Object.entries(groups).filter(([, items]) => items.length).map(([group, items]) => '<div class="export-filter-row report-filter-row is-' + group + '-row">' + items.join("") + '</div>').join("");
    const exclusions = report.filters.some(item => item.control === "checkboxes") ? context.renderComplaintExclusionRules(state.exclusions[report.id] || [], "report:" + report.id) : "";
    return '<div class="filter-panel ticket-filter-panel export-filter-panel report-filter-panel"><div class="export-filter-layout">' + fields + exclusions + '<div class="filter-actions export-filter-actions"><button type="button" class="btn-link filter-reset" data-action="reset-filter">' + context.icon("reset") + ' 重置</button><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="search">' + context.icon("search") + ' 搜索</button></div></div></div>';
  }

  function reportColumns(report) {
    const base = [
      { label:"工单编号", key:"ticketId" },
      { label:"工单类型", key:"ticketType" },
      { label:report.focus, key:"focus" }
    ];
    if (report.dimensions?.length) return [...base, { label:"投诉分类统计", children:report.dimensions.map((label, index) => ({ label, children:[{ label:"数量", key:"dimension" + index + "Count" }, { label:"占比", key:"dimension" + index + "Ratio" }] })) }];
    if (report.type === "统计") return [...base, { label:report.focus + "统计", children:[{ label:"数量", key:"quantity" }, { label:"占比", key:"ratio" }] }, { label:"统计范围", children:[{ label:"受理渠道", key:"channel" }, { label:"统计机构", key:"institution" }] }];
    return [...base, { label:"客户信息", children:[{ label:"客户姓名", key:"customer" }, { label:"客户编号", key:"customerId" }] }, { label:"办理信息", children:[{ label:"受理渠道", key:"channel" }, { label:"当前状态", key:"status" }, { label:"工单接收机构", key:"institution" }] }];
  }

  const leafCount = column => column.children?.length ? column.children.reduce((sum, child) => sum + leafCount(child), 0) : 1;
  const columnDepth = column => column.children?.length ? 1 + Math.max(...column.children.map(columnDepth)) : 1;

  function renderHead(columns) {
    const depth = Math.max(...columns.map(columnDepth));
    const rows = Array.from({ length:depth }, () => []);
    function visit(column, level) {
      if (column.children?.length) {
        rows[level].push('<th colspan="' + leafCount(column) + '" scope="colgroup">' + escapeHtml(column.label) + '</th>');
        column.children.forEach(child => visit(child, level + 1));
      } else {
        rows[level].push('<th rowspan="' + (depth - level) + '" scope="col">' + escapeHtml(column.label) + '</th>');
      }
    }
    columns.forEach(column => visit(column, 0));
    rows[0].unshift('<th rowspan="' + depth + '" class="selection-cell"><input type="checkbox" data-report-select-all aria-label="全选当前结果"></th>');
    return '<thead>' + rows.map(row => '<tr>' + row.join("") + '</tr>').join("") + '</thead>';
  }

  function flattenColumns(columns) {
    return columns.flatMap(column => column.children?.length ? flattenColumns(column.children) : [column]);
  }

  function sampleValue(key, index, report) {
    const values = {
      ticketId:ticketIds[index], ticketType:["投诉单", "信访单", "建议单", "表扬单"][index % 4], focus:[report.focus + "一", report.focus + "二", report.focus + "三"][index % 3],
      customer:["陈晓敏", "周先生", "林女士", "王女士"][index % 4], customerId:"C202607" + String(index + 1).padStart(6, "0"), channel:channels[index % channels.length], status:statuses[index % statuses.length], institution:institutions[index % institutions.length], quantity:String(12 + index * 3), ratio:(11 + index * 2) + "%"
    };
    if (/dimension\d+Count/.test(key)) return String(8 + index * 2 + Number(key.match(/\d+/)[0]));
    if (/dimension\d+Ratio/.test(key)) return (9 + index + Number(key.match(/\d+/)[0])) + "%";
    return values[key] || "—";
  }

  function renderRows(report, columns, context) {
    const leaves = flattenColumns(columns);
    return ticketIds.map((ticketId, index) => {
      const flags = context.getComplaintExclusionFlags(ticketId);
      return '<tr data-report-row data-focus-index="' + (index % 3) + '" data-complaint-exclusion-flags="' + escapeHtml(flags.join(",")) + '"><td class="selection-cell"><input type="checkbox" data-report-row-select value="' + ticketId + '" aria-label="选择 ' + ticketId + '"></td>' + leaves.map(column => column.key === "ticketId" ? '<td><button type="button" class="btn-link report-ticket-link" data-action="complaints-report-ticket" data-id="' + ticketId + '">' + ticketId + '</button></td>' : '<td>' + escapeHtml(sampleValue(column.key, index, report)) + '</td>').join("") + '</tr>';
    }).join("");
  }

  function renderDetail(context) {
    const report = selectedReport();
    const columns = reportColumns(report);
    const back = context.renderContextBackButton ? context.renderContextBackButton("analysis-reports", "报表管理") : '<button class="btn xib-btn xib-btn--secondary" data-action="complaints-report-back">返回报表管理</button>';
    const actions = back + '<button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="complaints-report-export" data-id="' + escapeHtml(report.id) + '">导出</button>';
    const header = context.pageHeader ? context.pageHeader(report.name, "", actions) : '<div class="page-header"><h1 class="page-title">' + escapeHtml(report.name) + '</h1><div class="page-actions">' + actions + '</div></div>';
    return '<section class="page xib-module-complaints-reports report-detail-page" data-module="complaints-reports" data-report-view="detail" data-report-id="' + escapeHtml(report.id) + '">' + header +
      '<div class="report-detail-meta"><span class="report-type is-' + (report.type === "统计" ? "statistics" : "detail") + '">' + report.type + '</span></div>' +
      renderFilterPanel(report, context) +
      '<section class="panel report-result-panel"><div class="report-result-toolbar"><span>已选 <b data-report-selected-count>0</b> 项</span><span>共 <b data-report-visible-count>' + ticketIds.length + '</b> 条工单</span></div><div class="table-wrap"><table class="table ds-table report-detail-table" data-disable-column-customizer>' + renderHead(columns) + '<tbody>' + renderRows(report, columns, context) + '</tbody></table></div></section></section>';
  }

  function afterRender(root, page, context) {
    if (page !== "analysis-report-detail") return;
    const moduleRoot = root.querySelector('[data-module="complaints-reports"]');
    if (!moduleRoot) return;
    const updateSelection = () => {
      const visible = [...moduleRoot.querySelectorAll("[data-report-row]")].filter(row => !row.hidden);
      const checked = visible.filter(row => row.querySelector("[data-report-row-select]")?.checked);
      moduleRoot.querySelector("[data-report-selected-count]").textContent = checked.length;
      moduleRoot.querySelector("[data-report-visible-count]").textContent = visible.length;
      const all = moduleRoot.querySelector("[data-report-select-all]");
      all.checked = visible.length > 0 && checked.length === visible.length;
      all.indeterminate = checked.length > 0 && checked.length < visible.length;
    };
    moduleRoot.querySelector("[data-report-select-all]")?.addEventListener("change", event => {
      moduleRoot.querySelectorAll("[data-report-row]:not([hidden]) [data-report-row-select]").forEach(input => { input.checked = event.target.checked; });
      updateSelection();
    });
    moduleRoot.querySelectorAll("[data-report-row-select]").forEach(input => input.addEventListener("change", updateSelection));
    context.bindComplaintExclusionRules(moduleRoot, (selected, scope) => {
      if (!scope.startsWith("report:")) return;
      state.exclusions[scope.slice(7)] = selected;
    });
    moduleRoot.querySelector("[data-action='search']")?.addEventListener("click", updateSelection);
    moduleRoot.querySelector("[data-action='reset-filter']")?.addEventListener("click", () => {
      state.exclusions[selectedReport().id] = [];
      updateSelection();
    });
  }

  registry.register({
    name:"complaints-reports",
    routes:["analysis-reports", "analysis-report-detail"],
    render(page, context) { return page === "analysis-report-detail" ? renderDetail(context) : renderCatalog(context); },
    afterRender,
    handleAction(action, payload, context) {
      if (action === "complaints-report-open") { rememberReport(payload.id); context.navigate("analysis-report-detail"); return true; }
      if (action === "complaints-report-type") { state.catalogType = ["统计", "明细"].includes(payload.id) ? payload.id : "全部"; context.rerenderPage(); return true; }
      if (action === "complaints-report-back") { context.navigate("analysis-reports"); return true; }
      if (action === "complaints-report-export") { context.toast(selectedReport().name + " 已加入导出任务"); return true; }
      if (action === "complaints-report-ticket") { context.openTicketDetail(payload.id); return true; }
      return false;
    },
    reset() { state.reportId = ""; state.catalogType = "全部"; state.exclusions = {}; }
  });
})(window);
