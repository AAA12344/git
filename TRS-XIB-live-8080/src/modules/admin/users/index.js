(function registerAdminUsers(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  const data = global.XIB_ADMIN_USERS_DATA;
  if (!registry) throw new Error("XIBModuleRegistry must load before admin-users.");
  if (!data) throw new Error("Admin users data must load before its module.");

  const moduleState = {
    detailId: "",
    tab: "all",
    filters: { orgPath: "", department: "", role: "", status: "", name: "", empno: "" }
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const attr = escapeHtml;
  const surface = body => '<div class="admin-surface">' + body + "</div>";
  const actionButton = (label, action, id = "") => '<button class="btn-link" data-action="' + action + '" data-id="' + attr(id) + '">' + label + "</button>";
  const cleanRoles = ["经办员", "复核员", "处理员", "审批员", "业务员", "普通管理员", "超级管理员", "查询员"];

  function organizations() { return global.XIB_PROTOTYPE_CONFIG?.organizationTree?.organizations || []; }
  function organization(id) { return organizations().find(item => item.id === id); }
  function organizationName(id) {
    if (!id) return "-";
    const orgs = organizations();
    return orgs.find(item => item.id === id)?.name || orgs.slice().sort((a, b) => String(b.id).length - String(a.id).length).find(item => String(id).startsWith(item.id))?.name || id;
  }
  function organizationPath(id) {
    const byId = new Map(organizations().map(item => [item.id, item]));
    let current = byId.get(id);
    if (!current) return id || "-";
    const result = [];
    const seen = new Set();
    while (current && !seen.has(current.id)) { seen.add(current.id); result.unshift(current.name); current = byId.get(current.parentId); }
    return result.join(" / ");
  }
  function institutionLabel(user) { return organizationName(user.org_code); }
  function departmentLabel(user) { return organizationName(user.dept_code); }
  function roleNameFromText(text) {
    const value = String(text || "");
    if (/超级管理员|系统管理员/.test(value)) return "超级管理员";
    if (/普通管理员|管理员/.test(value)) return "普通管理员";
    if (/复核|审核/.test(value)) return "复核员";
    if (/审批/.test(value)) return "审批员";
    if (/处理/.test(value)) return "处理员";
    if (/经办|客服/.test(value)) return "经办员";
    if (/业务/.test(value)) return "业务员";
    return "查询员";
  }
  function configuredRoleNames(user) {
    const permissions = global.XIB_ADMIN_PERMISSIONS_DATA || {};
    const roles = [roleNameFromText((user.job_title || "") + (user.position || ""))];
    (permissions.businessRoles || []).forEach(role => {
      if ((permissions.roleUserIds?.[role.id] || []).includes(user.user_account)) roles.push(String(role.name || "").replace(/（.*?）/g, ""));
    });
    return Array.from(new Set(roles.filter(role => cleanRoles.includes(role))));
  }
  function roleTags(user) {
    const roles = configuredRoleNames(user);
    return roles.length ? '<div class="admin-user-role-tags">' + roles.map(role => '<span class="tag-blue-light">' + escapeHtml(role) + '</span>').join("") + '</div>' : "-";
  }
  function statusTag(text, context) { return typeof context.statusTag === "function" ? context.statusTag(text) : '<span class="status-tag">' + escapeHtml(text) + '</span>'; }
  function table(headers, rows, scope, context) {
    const body = rows.length ? rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join("") + '</tr>').join("") : '<tr><td colspan="' + headers.length + '"><div class="empty-state">暂无数据</div></td></tr>';
    return '<div class="table-wrap admin-table-wrap"><table class="ds-table"><thead><tr>' + headers.map(header => '<th>' + header + '</th>').join("") + '</tr></thead><tbody>' + body + '</tbody></table></div>' + context.renderPagination(rows.length, scope, 10);
  }
  function orgLeaf(value) { return String(value || "").split(" / ").filter(Boolean).at(-1) || ""; }
  function departmentsFor(orgPath) {
    const leaf = orgLeaf(orgPath);
    const selected = organizations().find(item => item.name === leaf && ["304901", "304903", "304905"].includes(item.type));
    return organizations().filter(item => ["304902", "304904"].includes(item.type) && (!selected || item.parentId === selected.id || String(item.id).startsWith(selected.id))).map(item => item.name).filter((item, index, array) => array.indexOf(item) === index).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }
  function rolesFor(orgPath) {
    const roles = cleanRoles.filter(role => role !== "超级管理员");
    if (!orgPath || String(orgPath).includes("总行")) roles.push("超级管理员");
    return roles;
  }
  function renderOrgRangeControl(context) {
    const key = "admin.users.orgRange";
    if (context.state?.formValues) context.state.formValues[key] = moduleState.filters.orgPath;
    const field = { type: "hierarchyCascader", dictionary: "organizationTree", levels: ["总行/分行", "机构/下辖支行"], leafLevel: 2, multiple: false, nonLeafSelectable: true, searchable: true, placeholder: "请选择机构范围" };
    return context.renderHierarchyCascaderControl?.("admin-users-org-range", field, key, false) || '<input class="di-input" id="admin-users-org-range" data-field-key="' + key + '" value="' + attr(moduleState.filters.orgPath) + '">';
  }
  function options(values, current, placeholder) {
    return '<option value="">' + placeholder + '</option>' + values.map(value => '<option value="' + attr(value) + '" ' + (value === current ? "selected" : "") + '>' + escapeHtml(value) + '</option>').join("");
  }
  function renderAllUserFilters(context) {
    const filters = moduleState.filters;
    return '<section class="filter-panel ticket-filter-panel admin-filter-panel admin-users-filter"><div class="ticket-filter-grid">' +
      '<div class="ticket-filter-item"><label>机构范围</label><div class="form-control">' + renderOrgRangeControl(context) + '</div></div>' +
      '<div class="ticket-filter-item"><label>部门范围</label><select class="di-native-select is-fluid" id="admin-users-department">' + options(departmentsFor(filters.orgPath), filters.department, "全部部门") + '</select></div>' +
      '<div class="ticket-filter-item"><label>角色</label><select class="di-native-select is-fluid" id="admin-users-role">' + options(rolesFor(filters.orgPath), filters.role, "全部角色") + '</select></div>' +
      '<div class="ticket-filter-item"><label>状态</label><select class="di-native-select is-fluid" id="admin-users-status">' + options(["启用", "停用"], filters.status, "全部状态") + '</select></div>' +
      '<div class="ticket-filter-item"><label>姓名</label><input class="di-input" id="admin-users-name" value="' + attr(filters.name) + '" placeholder="请输入姓名"></div>' +
      '<div class="ticket-filter-item"><label>工号</label><input class="di-input" id="admin-users-empno" value="' + attr(filters.empno) + '" placeholder="请输入工号"></div>' +
      '<div class="filter-actions ticket-filter-actions"><button class="btn-link" type="button" data-admin-users-reset>重置</button><button class="btn xib-btn xib-btn--primary" type="button" data-admin-users-search>查询</button></div>' +
      '</div></section>';
  }
  function filteredUsers() {
    const filters = moduleState.filters;
    const orgTokens = String(filters.orgPath || "").split(" / ").filter(Boolean);
    return data.users.filter(user => {
      const roles = configuredRoleNames(user);
      return (!orgTokens.length || orgTokens.includes(institutionLabel(user)) || orgTokens.includes(departmentLabel(user))) &&
        (!filters.department || departmentLabel(user) === filters.department) &&
        (!filters.role || roles.includes(filters.role)) &&
        (!filters.status || (user.user_status === "1" ? "启用" : "停用") === filters.status) &&
        (!filters.name || String(user.user_name).toLocaleLowerCase().includes(filters.name.toLocaleLowerCase())) &&
        (!filters.empno || String(user.user_empno).toLocaleLowerCase().includes(filters.empno.toLocaleLowerCase()));
    });
  }
  function renderUserTabs() {
    return '<div class="tabs lib-tabs-line admin-inner-tabs admin-user-tabs"><button class="tab ' + (moduleState.tab === "all" ? "is-active" : "") + '" data-action="admin-users-tab" data-id="all">全部用户</button><button class="tab ' + (moduleState.tab === "config" ? "is-active" : "") + '" data-action="admin-users-tab" data-id="config">用户配置</button></div>';
  }
  function renderAllUsers(context) {
    const users = filteredUsers();
    const rows = users.map(user => [escapeHtml(user.user_empno || "-"), escapeHtml(user.user_name), escapeHtml(institutionLabel(user)), escapeHtml(departmentLabel(user)), roleTags(user), statusTag(user.user_status === "1" ? "启用" : "停用", context), actionButton("查看", "admin-user-detail", user.id)]);
    return surface(renderAllUserFilters(context) + table(["工号", "姓名", "机构", "部门", "角色", "状态", "操作"], rows, "admin-users", context));
  }
  function renderUserConfig(context) {
    const view = global.XIB_ADMIN_USER_CONFIG_VIEW;
    return view?.render ? view.render(context) : surface('<div class="empty-state">用户配置依赖权限数据，权限管理模块加载后可使用。</div>');
  }
  function detailDescriptions(items) { return '<dl class="ds-descriptions detail-descriptions admin-detail-descriptions">' + items.map(item => '<div><dt>' + escapeHtml(item[0]) + '</dt><dd>' + item[1] + '</dd></div>').join("") + '</dl>'; }
  function detailPanel(title, items) { return '<section class="panel detail-section admin-detail-section"><div class="panel-head"><span class="panel-title">' + escapeHtml(title) + '</span></div>' + detailDescriptions(items) + '</section>'; }
  function renderList(context) {
    if (global.XIB_ADMIN_USERS_OPEN_CONFIG) { moduleState.tab = "config"; global.XIB_ADMIN_USERS_OPEN_CONFIG = false; }
    return '<section class="page admin-page xib-module-admin-users" data-module="admin-users">' + context.pageHeader("用户管理", "查看用户同步信息，并按机构范围为用户配置可用角色") + renderUserTabs() + (moduleState.tab === "config" ? renderUserConfig(context) : renderAllUsers(context)) + '</section>';
  }
  function renderDetail(context) {
    const user = data.users.find(item => item.id === moduleState.detailId) || data.users[0];
    const basic = [["工号", escapeHtml(user.user_empno)], ["姓名", escapeHtml(user.user_name)], ["登录账号", escapeHtml(user.user_account)], ["性别", user.gender === "1" ? "女" : user.gender === "0" ? "男" : "-"], ["手机号", escapeHtml(user.mobile_phone)], ["邮箱", escapeHtml(user.email)], ["状态", statusTag(user.user_status === "1" ? "启用" : "停用", context)], ["职务", escapeHtml(user.job_title)], ["岗位", escapeHtml(user.position)]];
    const org = [["机构", escapeHtml(institutionLabel(user))], ["部门", escapeHtml(departmentLabel(user))], ["机构编码", escapeHtml(user.org_code)], ["部门编码", escapeHtml(user.dept_code || "-")], ["组织路径", escapeHtml(organizationPath(user.dept_code || user.org_code))]];
    const audit = [["创建人", escapeHtml(user.create_by)], ["创建时间", escapeHtml(user.create_time)], ["更新人", escapeHtml(user.update_by)], ["更新时间", escapeHtml(user.update_time)]];
    return '<section class="page admin-page xib-module-admin-users" data-module="admin-users">' + context.pageHeader("用户详情", "查看用户基础信息、机构归属信息和审计信息", '<button class="btn xib-btn xib-btn--secondary" data-action="admin-user-list">返回用户管理</button>') + '<div class="detail-sections admin-detail-sections">' + detailPanel("基本信息", basic) + detailPanel("机构归属信息", org) + detailPanel("审计信息", audit) + '</div></section>';
  }
  function readFilters(root) {
    return {
      orgPath: root.querySelector('#admin-users-org-range')?.value || root.querySelector('input[data-field-key="admin.users.orgRange"]')?.value || "",
      department: root.querySelector('#admin-users-department')?.value || "",
      role: root.querySelector('#admin-users-role')?.value || "",
      status: root.querySelector('#admin-users-status')?.value || "",
      name: root.querySelector('#admin-users-name')?.value.trim() || "",
      empno: root.querySelector('#admin-users-empno')?.value.trim() || ""
    };
  }

  registry.register({
    name: "admin-users",
    routes: ["admin-user", "user-manage"],
    reset() { moduleState.detailId = ""; moduleState.tab = "all"; },
    render(page, context) { return moduleState.detailId ? renderDetail(context) : renderList(context); },
    afterRender(root, page, context) {
      if (!moduleState.detailId && moduleState.tab === "config") global.XIB_ADMIN_USER_CONFIG_VIEW?.afterRender?.(root, context);
      root.querySelector('.admin-users-filter .di-hierarchy-cascader-popover')?.addEventListener('click', event => {
        if (!event.target.closest('[data-hierarchy-toggle],[data-hierarchy-search-toggle],[data-hierarchy-confirm]')) return;
        setTimeout(() => {
          const nextOrg = root.querySelector('#admin-users-org-range')?.value || root.querySelector('input[data-field-key="admin.users.orgRange"]')?.value || "";
          if (nextOrg === moduleState.filters.orgPath) return;
          moduleState.filters = { ...moduleState.filters, orgPath: nextOrg, department: "", role: "" };
          context.rerenderPage(false, { instant: true });
        }, 0);
      });
      root.querySelector('[data-admin-users-search]')?.addEventListener('click', () => { moduleState.filters = readFilters(root); context.rerenderPage(false, { instant: true }); });
      root.querySelector('[data-admin-users-reset]')?.addEventListener('click', () => { moduleState.filters = { orgPath: "", department: "", role: "", status: "", name: "", empno: "" }; if (context.state?.formValues) context.state.formValues["admin.users.orgRange"] = ""; context.rerenderPage(false, { instant: true }); });
      return true;
    },
    handleAction(action, payload, context) {
      if (action === "admin-users-tab") { moduleState.tab = payload.id === "config" ? "config" : "all"; moduleState.detailId = ""; context.rerenderPage(true); return true; }
      if (!moduleState.detailId && moduleState.tab === "config" && global.XIB_ADMIN_USER_CONFIG_VIEW?.handleAction?.(action, payload, context)) return true;
      if (action === "admin-user-detail") { moduleState.detailId = data.users.some(user => user.id === payload.id) ? payload.id : data.users[0].id; context.rerenderPage(true); return true; }
      if (action === "admin-user-list") { moduleState.detailId = ""; moduleState.tab = "all"; context.rerenderPage(true); return true; }
      return false;
    }
  });
})(window);
