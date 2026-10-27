(function registerAdminOrganizations(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  const organizationTree = global.XIB_PROTOTYPE_CONFIG?.organizationTree;
  if (!registry) throw new Error("XIBModuleRegistry must load before admin-organizations.");
  if (!Array.isArray(organizationTree?.organizations)) throw new Error("Organization tree data must load before admin-organizations.");

  const organizations = organizationTree.organizations;
  const preferredId = organizations.some(item => item.id === "0001000110011007")
    ? "0001000110011007"
    : (organizations[0]?.id || "");
  const moduleState = {
    selectedId: preferredId,
    filters: { name: "", code: "", depth: "" },
    collapsedIds: new Set()
  };

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function getOrganization(id) {
    return organizations.find(item => item.id === id);
  }

  function childrenOf(id) {
    return organizations.filter(item => item.parentId === id);
  }

  function ancestorsOf(organization) {
    const ancestors = [];
    let current = organization;
    const seen = new Set();
    while (current && current.parentId && !seen.has(current.parentId)) {
      seen.add(current.parentId);
      current = getOrganization(current.parentId);
      if (current) ancestors.unshift(current);
    }
    return ancestors;
  }

  function depthOf(organization) {
    return ancestorsOf(organization).length;
  }

  function pathOf(organization, key) {
    return [...ancestorsOf(organization), organization].map(item => item?.[key] || item?.id || "-").join(" / ");
  }

  function hasFilter(filters) {
    return Boolean((filters.name || "").trim() || (filters.code || "").trim() || String(filters.depth ?? "").trim());
  }

  function matchesFilters(organization, filters) {
    const name = (filters.name || "").trim().toLowerCase();
    const code = (filters.code || "").trim().toLowerCase();
    const depth = String(filters.depth ?? "").trim();
    const organizationName = String(organization.name || "").toLowerCase();
    const organizationCode = String(organization.code || organization.id || "").toLowerCase();
    const depthMatches = !depth || depthOf(organization) === Number(depth);
    return (!name || organizationName.includes(name)) && (!code || organizationCode.includes(code)) && depthMatches;
  }

  function subtreeMatches(organization, filters) {
    if (!hasFilter(filters) || matchesFilters(organization, filters)) return true;
    return childrenOf(organization.id).some(child => subtreeMatches(child, filters));
  }

  function depthLabel(depth) {
    const labels = { 0: "集团总部", 1: "银行总行", 2: "一级机构", 3: "二级机构", 4: "三级机构", 5: "四级机构" };
    return labels[Number(depth)] || (depth !== undefined && depth !== null ? depth + "级" : "-");
  }

  function typeLabel(organization) {
    const labels = {
      "3049000001": "中心",
      "3049000002": "处室",
      "3049000003": "分行子部门",
      "3049000004": "分行处级",
      "304901": "机构主体",
      "304902": "总行部门",
      "304903": "一级分行",
      "304904": "分行部门",
      "304905": "支行",
      "304906": "支行部门"
    };
    return labels[organization.type] || organization.type || "-";
  }

  function typeShort(organization) {
    const label = typeLabel(organization);
    if (label.includes("主体")) return "主体";
    if (label.includes("分行")) return label === "一级分行" ? "分行" : "部门";
    if (label.includes("支行")) return label === "支行" ? "支行" : "部门";
    if (label.includes("处")) return "处室";
    return label;
  }

  function typeTag(organization) {
    const tone = organization.type === "304901" || organization.type === "3049000001"
      ? "info"
      : organization.type === "304902" ? "success" : "warning";
    return '<span class="ds-tag ds-tag--' + tone + '">' + escapeHtml(typeLabel(organization)) + "</span>";
  }

  function actionButton(label, action, id = "") {
    return '<button class="btn-link" data-action="' + action + '" data-id="' + escapeHtml(id) + '">' + label + "</button>";
  }

  function table(headers, rows, scope, context) {
    return '<div class="table-wrap admin-table-wrap"><table class="ds-table"><thead><tr>' +
      headers.map(header => "<th>" + header + "</th>").join("") +
      "</tr></thead><tbody>" + rows.map(row => "<tr>" + row.map(cell => "<td>" + cell + "</td>").join("") + "</tr>").join("") +
      "</tbody></table></div>" + context.renderPagination(rows.length, 1, scope);
  }

  function detailDescriptions(items) {
    return '<dl class="ds-descriptions detail-descriptions admin-detail-descriptions">' +
      items.map(([label, value]) => '<div><dt>' + escapeHtml(label) + "</dt><dd>" + (String(value || "").includes("<span") ? value : escapeHtml(value || "-")) + "</dd></div>").join("") +
      "</dl>";
  }

  function renderTree(parentId, depth, selectedId, filters) {
    const filtering = hasFilter(filters);
    const nodes = childrenOf(parentId).filter(node => !filtering || subtreeMatches(node, filters));
    return nodes.map(node => {
      const active = node.id === selectedId ? " is-active" : "";
      const children = childrenOf(node.id);
      const isOpen = !moduleState.collapsedIds.has(node.id);
      const label = "<span>" + escapeHtml(node.name) + "</span><em>" + escapeHtml(typeShort(node)) + "</em>";
      if (children.length) {
        return '<div class="admin-tree-node-wrap depth-' + depth + " " + (isOpen ? "is-open" : "") + '"><div class="admin-tree-line"><button type="button" class="admin-tree-toggle" data-admin-org-toggle="' + escapeHtml(node.id) + '" aria-expanded="' + isOpen + '" aria-label="' + escapeHtml((isOpen ? "收起" : "展开") + node.name) + '" title="' + (isOpen ? "收起" : "展开") + '"></button><button type="button" class="admin-tree-node has-children' + active + '" data-action="admin-select-org" data-id="' + escapeHtml(node.id) + '">' + label + '</button></div><div class="admin-tree-children">' + renderTree(node.id, depth + 1, selectedId, filters) + "</div></div>";
      }
      return '<div class="admin-tree-node-wrap depth-' + depth + '"><div class="admin-tree-line"><span class="admin-tree-toggle-placeholder"></span><button type="button" class="admin-tree-node' + active + '" data-action="admin-select-org" data-id="' + escapeHtml(node.id) + '">' + label + "</button></div></div>";
    }).join("");
  }

  function renderDetail(selected, context) {
    const parent = selected.parentId ? getOrganization(selected.parentId) : null;
    const children = childrenOf(selected.id);
    const organizationId = selected.id || selected.code || "-";
    const tags = typeTag(selected) + context.statusTag(selected.status || "启用");
    const fields = [
      ["自增主键", "-"],
      ["组织编码", organizationId],
      ["组织名称", selected.name],
      ["父级部门CODE", selected.parentId || "-"],
      ["组织负责人A角", "-"],
      ["组织负责人B角", "-"],
      ["组织负责人C角", "-"],
      ["组织编号路径", pathOf(selected, "id")],
      ["组织ID路径", pathOf(selected, "id")],
      ["组织名称路径", pathOf(selected, "name")],
      ["排序号", "-"],
      ["组织状态", context.statusTag(selected.status || "启用")],
      ["组织类型", typeLabel(selected) + (selected.type ? "（" + selected.type + "）" : "")],
      ["企业微信id", "-"],
      ["分管领导", "-"],
      ["创建人", "-"],
      ["创建时间", "-"],
      ["更新人", "-"],
      ["更新时间", "-"],
      ["租户号", "-"],
      ["上级机构", parent ? parent.name : "-"],
      ["层级深度", depthLabel(depthOf(selected))],
      ["下属机构数量", children.length + " 个"]
    ];
    const childRows = children.map((item, index) => [
      String(index + 1),
      actionButton(escapeHtml(item.name), "admin-select-org", item.id),
      escapeHtml(item.id || item.code),
      typeTag(item),
      context.statusTag(item.status || "启用"),
      '<div class="table-actions">' + actionButton("查看", "admin-select-org", item.id) + (childrenOf(item.id).length ? '<span class="admin-action-muted">不可删除</span>' : actionButton("删除", "admin-modal", "org-delete")) + "</div>"
    ]);
    return '<div class="detail-sections admin-detail-sections"><section class="panel detail-section admin-detail-section"><div class="panel-head"><span class="panel-title">' + escapeHtml(selected.name) + '</span><span class="panel-extra">' + tags + "</span></div>" + detailDescriptions(fields) + "</section></div>" +
      '<div class="admin-sub-head"><h3>下属机构（' + children.length + '）</h3></div>' +
      table(["序号", "机构名称", "机构编码", "机构类型", "状态", "操作"], childRows, "admin-org-children", context);
  }

  function render(context) {
    const selected = getOrganization(moduleState.selectedId) || organizations[0];
    if (!selected) return '<section class="page admin-page"><div class="empty">暂无机构数据</div></section>';
    moduleState.selectedId = selected.id;
    const filters = moduleState.filters;
    const treeHtml = renderTree(null, 0, selected.id, filters) || '<div class="admin-tree-empty">暂无匹配机构</div>';
    const matchingCount = hasFilter(filters) ? organizations.filter(item => matchesFilters(item, filters)).length : organizations.length;
    const depthOptions = [["", "全部层级"], ...[0, 1, 2, 3, 4, 5].map(depth => [String(depth), depthLabel(depth)])]
      .map(([value, label]) => '<option value="' + value + '" ' + (String(filters.depth ?? "") === value ? "selected" : "") + ">" + escapeHtml(label) + "</option>").join("");
    return '<section class="page admin-page admin-org-page xib-module-admin-organizations" data-module="admin-organizations">' +
      context.pageHeader("机构管理", "维护全行机构、部门和数据权限归属") +
      '<div class="admin-org-layout-v2"><aside class="admin-org-left"><div class="admin-org-search-panel"><label><span>机构名称</span><input class="di-input" id="admin-org-filter-name" value="' + escapeHtml(filters.name) + '" placeholder="请输入"></label><label><span>机构编码</span><input class="di-input" id="admin-org-filter-code" value="' + escapeHtml(filters.code) + '" placeholder="请输入"></label><label><span>机构层级</span><select class="di-native-select" id="admin-org-filter-depth">' + depthOptions + '</select></label><div class="admin-org-search-actions"><button class="btn-link" type="button" data-action="admin-org-reset">重置</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-org-search">搜索</button></div></div><div class="admin-org-tree-toolbar"><span>共 ' + matchingCount + ' 个机构</span><div><button class="btn-link" type="button" data-action="admin-org-collapse-all">全部折叠</button><button class="btn-link" type="button" data-action="admin-org-expand-all">全部展开</button></div></div><div class="admin-org-tree">' + treeHtml + '</div></aside><section class="admin-org-right" id="admin-org-detail-region" aria-live="polite">' + renderDetail(selected, context) + "</section></div></section>";
  }

  function readFilters(trigger) {
    const page = trigger?.closest(".admin-org-page") || document;
    return {
      name: page.querySelector("#admin-org-filter-name")?.value || "",
      code: page.querySelector("#admin-org-filter-code")?.value || "",
      depth: page.querySelector("#admin-org-filter-depth")?.value || ""
    };
  }

  registry.register({
    name: "admin-organizations",
    routes: ["admin-org"],
    reset() { moduleState.selectedId = preferredId; },
    render(page, context) {
      return render(context);
    },
    afterRender(root, page, context) {
      root.querySelectorAll("[data-admin-org-toggle]").forEach(button => {
        button.addEventListener("click", event => {
          event.stopPropagation();
          const id = button.dataset.adminOrgToggle;
          if (moduleState.collapsedIds.has(id)) moduleState.collapsedIds.delete(id);
          else moduleState.collapsedIds.add(id);
          context.rerenderPage(false, { instant: true });
        });
      });
    },
    handleAction(action, payload, context) {
      if (action === "admin-select-org") {
        if (getOrganization(payload.id)) moduleState.selectedId = payload.id;
        context.rerenderPage(false, { instant: true });
        return true;
      }
      if (action === "admin-org-search") {
        moduleState.filters = readFilters(payload.trigger);
        moduleState.collapsedIds.clear();
        context.rerenderPage(false, { instant: true });
        return true;
      }
      if (action === "admin-org-reset") {
        moduleState.filters = { name: "", code: "", depth: "" };
        moduleState.collapsedIds.clear();
        context.rerenderPage(false, { instant: true });
        return true;
      }
      if (action === "admin-org-expand-all") {
        moduleState.collapsedIds.clear();
        context.rerenderPage(false, { instant: true });
        return true;
      }
      if (action === "admin-org-collapse-all") {
        moduleState.collapsedIds = new Set(organizations.filter(item => childrenOf(item.id).length).map(item => item.id));
        context.rerenderPage(false, { instant: true });
        return true;
      }
      return false;
    }
  });
})(window);
