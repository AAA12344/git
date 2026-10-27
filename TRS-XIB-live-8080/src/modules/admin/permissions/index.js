(function registerAdminPermissions(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  const data = global.XIB_ADMIN_PERMISSIONS_DATA;
  const appConfig = global.XIB_APP_CONFIG;
  const orgSource = global.XIB_PROTOTYPE_CONFIG?.organizationTree?.organizations || [];
  const userSource = global.XIB_ADMIN_USERS_DATA?.users || [];
  if (!registry) throw new Error("XIBModuleRegistry must load before admin-permissions.");
  if (!data) throw new Error("Admin permissions data must load before its module.");
  if (!appConfig?.navigation) throw new Error("App navigation must load before admin-permissions.");

  const moduleState = {
    workspace: "permission",
    tab: "admin",
    permissionPages: { admin: 1, review: 1, biz: 1, intelligent: 1 },
    roleKeyword: "",
    roleConfig: null,
    userScope: "all",
    userLevel: "branch-consumer",
    userOrg: "",
    userOrgPath: "",
    userDepartment: "",
    userAccount: "",
    userPage: 1,
    userRoleOverrides: new Map(),
    userReviewRoleOverrides: new Map(),
    roleEditMode: false,
    roleInfoOverrides: new Map(),
    roleMenuOverrides: new Map(),
    customRoles: { admin: [], review: [], biz: [], intelligent: [] },
    customRoleSequence: 0,
    deletedCustomRoleKeys: new Set()
  };

  const fallbackUsers = [
    { user_account: "guanlq", user_name: "管理强", job_title: "系统管理员", position: "系统管理岗", org_code: "000100011001", dept_code: "0001000110011001", office_code: "", user_status: "1", hr_user_status: "在职" },
    { user_account: "wangf", user_name: "王芳", job_title: "工单处理员", position: "工单处理岗", org_code: "000100012003", dept_code: "0001000120032017", office_code: "", user_status: "1", hr_user_status: "在职" },
    { user_account: "zhengy", user_name: "郑宇", job_title: "业务员", position: "业务岗", org_code: "000100012011", dept_code: "0001000120112018", office_code: "", user_status: "1", hr_user_status: "在职" },
    { user_account: "linh", user_name: "林红", job_title: "客服人员", position: "客服岗", org_code: "000100012003", dept_code: "0001000120033070", office_code: "000100012003307000003003", user_status: "1", hr_user_status: "在职" }
  ];

  const fallbackOrgs = [
    { id: "0001000110011001", parentId: "000100011001", name: "办公室", type: "304902", status: "启用" },
    { id: "0001000120032017", parentId: "000100012003", name: "人力资源部", type: "304904", status: "启用" },
    { id: "0001000120112018", parentId: "000100012011", name: "营业部", type: "304904", status: "启用" },
    { id: "service-center", parentId: "000100012003", name: "客服中心", type: "3049000001", status: "启用" },
    { id: "000100012003", parentId: "00010001", name: "厦门分行", type: "304903", status: "启用" }
  ];

  const users = userSource.length ? userSource : fallbackUsers;
  const organizations = orgSource.length ? orgSource : fallbackOrgs;
  const orgById = new Map(organizations.map(org => [org.id, org]));

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const attr = escapeHtml;
  const actionButton = (label, action, id = "") => '<button type="button" class="btn-link" data-action="' + action + '" data-id="' + attr(id) + '">' + escapeHtml(label) + "</button>";

  function tableMarkup(headers, rows, scope) {
    const body = rows.length
      ? rows.map(row => "<tr>" + row.map(cell => "<td>" + cell + "</td>").join("") + "</tr>").join("")
      : '<tr><td colspan="' + headers.length + '"><div class="empty-state">暂无数据</div></td></tr>';
    const wrapperClass = "table-wrap admin-table-wrap" + (String(scope).startsWith("admin-permission-") ? " admin-permission-list-wrap" : "");
    return '<div class="' + wrapperClass + '"><table class="ds-table"><thead><tr>' + headers.map(header => "<th>" + header + "</th>").join("") + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function table(headers, rows, scope, context, total = rows.length) {
    return tableMarkup(headers, rows, scope) + context.renderPagination(total, scope, 10);
  }

  function sourceOrgName(id) {
    if (!id) return "-";
    const direct = orgById.get(id);
    if (direct) return direct.name;
    const parent = organizations
      .slice()
      .sort((a, b) => String(b.id).length - String(a.id).length)
      .find(org => String(id).startsWith(org.id));
    return parent?.name || "机构树未匹配";
  }

  function normalizeUser(user) {
    return {
      account: user.user_account,
      name: user.user_name,
      job: user.job_title || user.position || "-",
      position: user.position || "-",
      orgCode: user.org_code,
      org: sourceOrgName(user.org_code),
      deptCode: user.dept_code,
      dept: sourceOrgName(user.dept_code),
      officeCode: user.office_code,
      office: sourceOrgName(user.office_code),
      status: user.user_status === "1" ? "启用" : "停用",
      hrStatus: user.hr_user_status || "-"
    };
  }

  function findParent(org, predicate) {
    let current = org;
    while (current?.parentId) {
      current = orgById.get(current.parentId);
      if (current && predicate(current)) return current;
    }
    return null;
  }

  function organizationTypeName(org) {
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
    return labels[org?.type] || "";
  }
  function orgLevelId(org) {
    const type = organizationTypeName(org);
    if (type === "中心" && String(org?.name || "").includes("客服")) return "service-center";
    if (type === "总行部门" && org.name.includes("消费者权益保护")) return "head-consumer";
    if (type === "总行部门") return "head-dept";
    if (type === "分行部门" && org.name.includes("消费者权益保护")) return "branch-consumer";
    if (type === "分行部门") return "branch-dept";
    if (type === "支行") return "branch-unit";
    return "";
  }

  function buildAssignableOrgs() {
    const imported = organizations
      .filter(org => org.status === "启用")
      .map(org => {
        const levelId = orgLevelId(org);
        if (!levelId) return null;
        const branch = findParent(org, item => organizationTypeName(item) === "一级分行");
        const head = findParent(org, item => item.name === "总行") || (org.name === "总行" ? org : null);
        const parent = branch || head || orgById.get(org.parentId);
          return {
            id: "org:" + org.id,
            code: org.id,
            levelId,
            name: levelId === "branch-unit" ? org.name : (parent?.name ? parent.name + " / " + org.name : org.name),
            treePath: organizationPath(org),
            scopeCode: parent?.id || org.id,
            scopeName: parent?.name || org.name,
            dept: org.name
        };
      })
      .filter(Boolean);

    const serviceUser = users.find(user => /客服/.test(user.job_title || user.position || ""));
    if (serviceUser && !imported.some(org => org.levelId === "service-center")) {
        imported.push({
          id: "org:service-center",
          code: serviceUser.office_code || serviceUser.dept_code || serviceUser.org_code,
          levelId: "service-center",
          name: "客服中心",
          treePath: [sourceOrgName(serviceUser.org_code), sourceOrgName(serviceUser.dept_code), sourceOrgName(serviceUser.office_code)].filter(item => item && item !== "-" && item !== "机构树未匹配").join(" / ") || "客服中心",
          scopeCode: serviceUser.org_code,
          scopeName: sourceOrgName(serviceUser.org_code),
          dept: "客服中心"
      });
    }
    return imported.length ? imported : [
      { id: "org:fallback-head", code: "0001000110011001", levelId: "head-dept", name: "总行 / 办公室", treePath: "总行 / 办公室", scopeCode: "000100011001", scopeName: "总行", dept: "办公室" }
    ];
  }

  function organizationPath(org) {
    const segments = [];
    let current = org;
    const visited = new Set();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (current.depth === undefined || Number(current.depth) >= 2) segments.unshift(current.name);
      current = orgById.get(current.parentId);
    }
    return segments.join(" / ");
  }

  const userPool = users.map(normalizeUser);
  const assignableOrgs = buildAssignableOrgs();

  function roleCategory(role) {
    if (typeof role.id === "number") return "admin";
    return "complaint";
  }

  function roleDescription(role) {
    if (roleCategory(role) === "admin") return role.desc;
    return role.position || [role.subtype, role.mainFlow && role.mainFlow !== "-" ? role.mainFlow : "", role.subCount !== undefined && role.subCount !== "-" ? role.subCount + "个子流程" : ""].filter(Boolean).join(" / ") || "-";
  }

  function roleMenus(role) {
    if (Array.isArray(role.menus)) return role.menus;
    if (typeof role.menus === "string") return role.menus.split("、").filter(Boolean);
    return [];
  }

  function roleMenuProfileKey(role) {
    if (role.custom) return "customQuery";
    if (role.name === "经办员") return "operator";
    if (role.name === "复核员") return "reviewer";
    if (role.name === "处理员") return "handler";
    if (role.name === "审批员") return "approver";
    if (role.name === "业务员") return "analyst";
    if (role.name === "超级管理员") return "admin";
    if (role.name === "普通管理员") return "adminNormal";
    return "custom";
  }

  function permittedPagesForRole(role, configId = "") {
    const savedMenus = moduleState.roleMenuOverrides.get(configId || roleStateKey(role));
    if (savedMenus) return savedMenus;
    const permissions = appConfig.permissions || {};
    if (roleMenuProfileKey(role) === "adminNormal") return ["overview", "admin-org", "admin-user", "admin-permission", "admin-notify", "admin-audit"];
    if (roleMenuProfileKey(role) === "operator") return permissions.operator || [];
    if (roleMenuProfileKey(role) === "reviewer") return permissions.reviewer || [];
    if (roleMenuProfileKey(role) === "handler") return permissions.handler || [];
    if (roleMenuProfileKey(role) === "approver") return permissions.approver || [];
    if (roleMenuProfileKey(role) === "analyst") return permissions.analyst || [];
    if (roleMenuProfileKey(role) === "admin") return permissions.admin || [];
    if (roleMenuProfileKey(role) === "customQuery") return ["overview", "ledger-query"];
    return [];
  }

  function navItemPathAllowed(item, allowedPages) {
    if (item.page && allowedPages.includes(item.page)) return true;
    if (item.id && allowedPages.includes(item.id)) return true;
    return (item.children || []).some(child => navItemPathAllowed(child, allowedPages));
  }

  function navItemPermissionKeys(item) {
    const ownKey = item.page || item.id || "";
    const childKeys = (item.children || []).flatMap(navItemPermissionKeys);
    return Array.from(new Set([ownKey].concat(childKeys).filter(Boolean)));
  }

  function menuSummary(role) {
    const allowedPages = permittedPagesForRole(role);
    const labels = [];
    appConfig.navigation.forEach(group => {
      if (!navItemPathAllowed(group, allowedPages)) return;
      (group.children?.length ? group.children : [group]).forEach(child => {
        if (navItemPathAllowed(child, allowedPages)) labels.push(group.children?.length ? group.label + "/" + child.label : group.label);
      });
    });
    return labels.join("、") || roleMenus(role).join("、") || "-";
  }

  function permissionTree(role, editable = false, configId = "") {
    const allowedPages = permittedPagesForRole(role, configId);
    const renderNode = (item, level) => {
      const checked = navItemPathAllowed(item, allowedPages);
      const keys = navItemPermissionKeys(item);
      const hasChildren = Boolean(item.children?.length);
      const toggle = hasChildren ? '<button type="button" class="admin-permission-node-toggle" data-admin-permission-node-toggle aria-expanded="false" aria-label="展开' + attr(item.label) + '"></button>' : '<span class="admin-permission-node-toggle-placeholder"></span>';
      return '<div class="permission-node level-' + level + (hasChildren ? " has-children is-node-collapsed" : "") + '"><div class="permission-node-line">' + toggle + '<label><input type="checkbox" data-admin-menu-permission="' + attr(keys.join(",")) + '" ' + (checked ? "checked" : "") + (editable ? "" : " disabled") + '> ' + escapeHtml(item.label) + "</label></div>" +
        (item.children?.length ? '<div class="permission-children">' + item.children.map(child => renderNode(child, level + 1)).join("") + "</div>" : "") + "</div>";
    };
    const controls = editable ? '<div class="admin-permission-tree-tools"><label><input type="checkbox" data-admin-tree-expand> 展开/折叠</label><label><input type="checkbox" data-admin-tree-select-all> 全选/全不选</label><label><input type="checkbox" data-admin-tree-link checked> 父子联动</label></div>' : "";
    return controls + '<div class="permission-tree admin-permission-tree ' + (editable ? "is-editable" : "is-readonly") + '">' + appConfig.navigation.map(item => renderNode(item, 1)).join("") + "</div>";
  }

  function dataLevelDescription(level) {
    return {
      "01全行": "可查看全行授权数据",
      "02分行及下辖": "可查看本分行及下辖机构授权数据",
      "03本部室": "可查看本人所属部室/部门授权数据",
      "04本支行": "可查看本支行授权数据"
    }[level] || "-";
  }

  function orgLevelById(id) {
    return data.orgLevels.find(level => level.id === id) || null;
  }

  function orgLevelForScope(value = "") {
    const text = cleanScopeLabel(value);
    if (!text || text === "-") return null;
    if (text.includes("客服中心")) return orgLevelById("service-center");
    if (text.includes("总行消保")) return orgLevelById("head-consumer");
    if (text.includes("总行业务") || text.includes("总行部门")) return orgLevelById("head-dept");
    if (text === "总行" || text === "全行") return orgLevelById("head-consumer");
    if (text.includes("分行消保")) return orgLevelById("branch-consumer");
    if (text.includes("分行业务") || text.includes("分行部门")) return orgLevelById("branch-dept");
    if (text.includes("分行及下辖") || text === "分行" || text.includes("本分行")) return orgLevelById("branch-consumer");
    if (text.includes("支行") || text.includes("本支行")) return orgLevelById("branch-unit");
    if (text.includes("本部门") || text.includes("本部室")) return orgLevelById("head-dept");
    return data.orgLevels.find(level => level.label === text) || null;
  }

  function orgLevelForRole(role, row = null) {
    if (role.id === 0) return orgLevelById("head-consumer");
    if (role.id === 1) return orgLevelById("head-dept");
    const candidates = [row?.subtype, role.subtype, role.orgScope, role.scope, row?.queryScope, role.queryScope];
    for (const candidate of candidates) {
      const level = orgLevelForScope(candidate);
      if (level) return level;
    }
    return orgLevelById("head-dept");
  }

  function normalizeOrgLevelLabel(value = "") {
    const level = orgLevelForScope(value);
    if (!level || level.id === "service-center") return cleanScopeLabel(value) || "-";
    return level.label;
  }

  function scopeValueForRole(role, row = null, kind = "query") {
    const level = orgLevelForRole(role, row);
    const field = kind === "export" ? "exportScope" : kind === "statistics" ? "statisticsScope" : "queryScope";
    return level?.[field] || level?.queryScope || "-";
  }

  function normalizeScopeValue(value = "", kind = "query") {
    const text = cleanScopeLabel(value);
    if (!text || text === "-") return "-";
    if (kind === "export" && (text === "无" || text === "不可导出" || text.includes("无导出"))) return "05无";
    if (text.includes("01") || text.includes("全行") || text.includes("全渠道")) return "01全行";
    if (text.includes("02") || text.includes("分行及下辖") || text.includes("本分行")) return "02分行及下辖";
    if (text.includes("03") || text.includes("本部室") || text.includes("本部门") || text.includes("客服中心")) return "03本部室";
    if (text.includes("04") || text.includes("本支行") || text.includes("支行")) return "04本支行";
    if (kind === "export" && text.includes("05")) return "05无";
    return text;
  }

  function dataLevelForRole(role, row = null, module = null) {
    const scopeType = module?.scopeType || "query";
    if (scopeType === "query" && row?.queryScope) return normalizeScopeValue(row.queryScope, "query");
    if (scopeType === "export" && row?.exportScope) return normalizeScopeValue(row.exportScope, "export");
    if (scopeType === "export") return normalizeScopeValue(scopeValueForRole(role, row, "export"), "export");
    if (scopeType === "statistics") return normalizeScopeValue(scopeValueForRole(role, row, "statistics"), "statistics");
    return normalizeScopeValue(scopeValueForRole(role, row, "query"), "query");
  }

  function distinctScopeOptions(kind) {
    const base = ["01全行", "02分行及下辖", "03本部室", "04本支行"];
    return kind === "export" ? base.concat("05无") : base;
  }

  function selectOptions(options, current) {
    const normalized = Array.from(new Set([current].concat(options).filter(Boolean)));
    return normalized.map(option => '<option value="' + attr(option) + '" ' + (option === current ? "selected" : "") + ">" + escapeHtml(option) + "</option>").join("");
  }

  function selectField(label, field, current, options) {
    return '<label><span>' + escapeHtml(label) + '</span><select class="di-input" data-admin-role-field="' + attr(field) + '">' + selectOptions(options, current) + "</select></label>";
  }

  function dataPermissionTable(role, context, row = null) {
    const allowedPages = permittedPagesForRole(role);
    const rows = data.dataPermissionModules.map(item => {
      const enabled = appConfig.navigation.some(nav => pathAllowedForDataModule(nav, item.menuPath.split(" / "), allowedPages));
      const level = enabled ? dataLevelForRole(role, row, item) : "-";
      return [escapeHtml(item.module), escapeHtml(item.page), escapeHtml(level), escapeHtml(enabled ? dataLevelDescription(level) : "当前角色无该模块菜单入口"), context.statusTag(enabled ? "启用" : "无权限")];
    });
    return table(["模块", "数据对象 / 页面", "数据层级", "层级说明", "状态"], rows, "admin-role-data", context);
  }

  function pathAllowedForDataModule(nav, parts, allowedPages) {
    if (!parts.length) return false;
    if (nav.label !== parts[0]) return false;
    if (parts.length === 1) return navItemPathAllowed(nav, allowedPages);
    return (nav.children || []).some(child => pathAllowedForDataModule(child, parts.slice(1), allowedPages));
  }

  function configuredUsers(role) {
    const mappedAccounts = data.roleUserIds?.[role.id] || [];
    const mappedUsers = mappedAccounts.map(account => userPool.find(user => user.account === account)).filter(Boolean);
    if (mappedUsers.length) return mappedUsers;
    if (role.name === "超级管理员") {
      return userPool.filter(user => /系统管理员|管理员/.test((user.job || "") + (user.position || ""))).slice(0, 8);
    }
    if (role.name === "普通管理员") {
      return userPool.filter(user => /管理员|管理岗/.test((user.job || "") + (user.position || ""))).slice(0, 8);
    }
    return userPool.filter(user => defaultUserHasRole(user, role.name)).slice(0, 8);
  }

  function roleCode(role, configId = "") {
    const savedCode = moduleState.roleInfoOverrides.get(configId || String(role?.id ?? ""))?.code;
    if (savedCode) return savedCode;
    if (role?.code) return role.code;
    if (typeof role.id !== "number") return String(role.id || "-");
    return role.name === "超级管理员" ? "admin-super" : "admin-normal";
  }

  function roleStateKey(role) {
    return String(role?.id ?? roleCode(role));
  }

  function roleInfoOverride(role, configId = "") {
    return moduleState.roleInfoOverrides.get(configId || roleStateKey(role)) || {};
  }

  function roleStatus(role, configId = "") {
    const override = roleInfoOverride(role, configId).status;
    if (override) return override;
    return role.status === "停用" ? "停用" : "启用";
  }

  function cleanScopeLabel(value) {
    return String(value || "").replace(/\(\d+\)/g, "");
  }

  function displayRoleName(row) {
    const name = row.name || row.role?.name || "-";
    if (/（.+）$/.test(name)) return name;
    if (row.role?.custom && name !== "查询员") return name;
    if (row.role?.custom && name === "查询员") {
      const source = [row.role.id, row.subtype, row.role?.subtype, row.role?.scope].join(" ");
      if (source.includes("branch") || source.includes("分行")) return name + "（分行）";
      if (source.includes("head") || source.includes("总行") || source.includes("全行")) return name + "（总行）";
    }
    const suffix = cleanScopeLabel(row.subtype || row.role?.subtype || row.role?.orgScope);
    return suffix && suffix !== "-" ? name + "（" + suffix + "）" : name;
  }

  function isCustomRole(role) {
    return Boolean(role?.custom);
  }

  function unavailableAction(reason) {
    return '<span class="admin-action-unavailable" title="' + attr(reason) + '">-</span>';
  }

  function dangerActionButton(label, action, id = "") {
    return '<button type="button" class="btn-link admin-action-danger" data-action="' + action + '" data-id="' + attr(id) + '">' + escapeHtml(label) + "</button>";
  }

  function roleOperationButtons(item) {
    return '<div class="table-actions">' + actionButton("查看", "admin-role-config", item.configId) + actionButton("编辑权限", "admin-role-edit", item.configId) + "</div>";
  }

  function roleStatusSwitch(item) {
    const enabled = roleStatus(item.role, item.configId) !== "停用";
    return '<button class="lib-switch admin-switch ' + (enabled ? "is-on" : "") + '" type="button" role="switch" aria-checked="' + enabled + '" data-action="admin-role-toggle" data-id="' + attr(item.configId) + '" title="点击切换角色状态"><span></span></button>';
  }

  function showRoleDisableError() {
    const toastRoot = global.document?.getElementById("toast-root");
    if (!toastRoot) return;
    const node = global.document.createElement("div");
    node.className = "toast error admin-role-disable-toast";
    node.innerHTML = '<span class="toast-icon">×</span><span class="toast-message">该角色下存在有效用户，不能停用！</span>';
    toastRoot.appendChild(node);
    global.setTimeout(() => node.remove(), 2600);
  }

  function roleTimestamp(value) {
    const text = String(value || "");
    return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(text) ? text + ":00" : text;
  }

  function auditRows(role) {
    const createdBy = isCustomRole(role) ? "超级管理员" : "系统预置";
    const createdAt = role.time || (isCustomRole(role) ? "2026-07-20 09:00" : "2026-06-01 08:00");
    const updatedBy = isCustomRole(role) ? "超级管理员" : "系统预置";
    const updatedAt = role.time || (isCustomRole(role) ? "2026-08-10 10:30" : "2026-06-01 08:00");
    return [
      descItem("创建人", escapeHtml(createdBy)),
      descItem("创建时间", escapeHtml(roleTimestamp(createdAt))),
      descItem("最后修改人", escapeHtml(updatedBy)),
      descItem("最后修改时间", escapeHtml(roleTimestamp(updatedAt)))
    ].join("");
  }

  function rowForRole(role, overrides = {}) {
    const saved = roleInfoOverride(role, overrides.configId);
    const rawSubtype = saved.subtype || overrides.subtype || role.subtype || role.orgScope || "-";
    const subtype = isCustomRole(role) ? normalizeOrgLevelLabel(rawSubtype) : rawSubtype;
    const scopeRow = { subtype, queryScope: overrides.queryScope || role.queryScope || role.scope || "" };
    const customQueryScope = isCustomRole(role) ? normalizeScopeValue(overrides.queryScope || role.queryScope || role.scope || "", "query") : "";
    const customExportScope = isCustomRole(role) ? normalizeScopeValue(overrides.exportScope || role.exportScope || "", "export") : "";
    return {
      role,
      rowId: overrides.rowId || String(role.id),
      name: saved.name || overrides.name || role.name,
      subtype,
      description: saved.description ?? overrides.description ?? (isCustomRole(role) ? (role.description || "") : roleDescription(role)),
      mainFlow: overrides.mainFlow || role.mainFlow || "-",
      subCount: overrides.subCount ?? role.subCount ?? "-",
      queryScope: saved.queryScope || customQueryScope || normalizeScopeValue(scopeValueForRole(role, scopeRow, "query"), "query"),
      exportScope: saved.exportScope || customExportScope || normalizeScopeValue(scopeValueForRole(role, scopeRow, "export"), "export"),
      menu: overrides.menu || menuSummary(role)
    };
  }

  function businessRoleRows() {
    return data.businessRoles.flatMap(role => {
      if (role.id === "processor") {
        return (data.processorRows || []).map((row, index) => {
          const rowId = "processor-" + index;
          return rowForRole(role, { ...row, rowId, configId: "bizrow:" + rowId });
        });
      }
      return [rowForRole(role, { configId: "bizrow:" + role.id })];
    }).filter(row => !moduleState.deletedCustomRoleKeys.has(roleStateKey(row.role)));
  }

  function customRoleForConfig(configId) {
    const normalized = String(configId || "");
    const match = normalized.match(/^custom:(admin|review|biz|intelligent):(.+)$/);
    if (match) return moduleState.customRoles[match[1]].find(role => String(role.id) === match[2]) || null;
    if (normalized.startsWith("bizrow:")) {
      const row = findBusinessSelection(normalized);
      return isCustomRole(row?.role) ? row.role : null;
    }
    return null;
  }

  function customRoleConfigId(tab, role) {
    return "custom:" + tab + ":" + role.id;
  }

  function findBusinessSelection(configId) {
    if (configId.startsWith("bizrow:")) {
      const rowId = configId.slice(7);
      return businessRoleRows().find(row => row.rowId === rowId) || businessRoleRows()[0];
    }
    if (configId.startsWith("biz:")) {
      const role = data.businessRoles[Number(configId.slice(4))] || data.businessRoles[0];
      return rowForRole(role);
    }
    return businessRoleRows()[0];
  }

  function renderLimitList(role) {
    const limits = role.limits || [];
    if (!limits.length) return '<div class="empty-state">暂无特殊限制。</div>';
    return '<ul class="admin-permission-limit-list">' + limits.map(item => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>";
  }

  function renderEntryRules(role, context) {
    const rows = (role.entries || []).map((entry, index) => [
      String(index + 1),
      escapeHtml(entry[0] || "-"),
      escapeHtml(entry[1] || "-"),
      escapeHtml(entry[2] || "-"),
      escapeHtml(entry[3] || "-"),
      escapeHtml(entry[4] || "-"),
      context.statusTag(entry[5] || "启用")
    ]);
    return table(["序号", "入口页面", "入口动作", "控制项", "开放条件", "可选范围", "状态"], rows, "admin-role-entries", context);
  }

  function renderApplicableLevels(role) {
    if (roleCategory(role) !== "complaint") return '<div class="empty-state">后台管理角色不按投诉机构层级配置。</div>';
    const roleName = role.name;
    const enabledIds = new Set(data.roleLevelMap?.[roleName] || []);
    return '<div class="admin-permission-level-grid">' + data.orgLevels.map(level => {
      const enabled = enabledIds.has(level.id);
      return '<label class="' + (enabled ? "is-enabled" : "") + '"><input type="checkbox" ' + (enabled ? "checked" : "") + ' disabled><span><strong>' + escapeHtml(level.label) + '</strong><small>查询 ' + escapeHtml(level.queryScope || "-") + " / 导出 " + escapeHtml(level.exportScope || "-") + '</small></span></label>';
    }).join("") + "</div>";
  }

  function currentRoleConfigSelection() {
    const configId = String(moduleState.roleConfig || "admin:0");
    const isBusiness = configId.startsWith("biz:");
    const isBusinessRow = configId.startsWith("bizrow:");
    const isReview = configId.startsWith("review:");
    const selectedRow = isBusiness || isBusinessRow ? findBusinessSelection(configId) : null;
    const reviewRole = isReview ? data.reviewRoles[Number(configId.slice(7))] : null;
    const customRole = customRoleForConfig(configId);
    const role = customRole || selectedRow?.role || reviewRole || data.adminRoles.find(item => String(item.id) === configId.replace(/^admin:/, "")) || data.adminRoles[0];
    const activeRow = selectedRow || rowForRole(role, { configId });
    return { configId, isBusiness, isBusinessRow, isReview, selectedRow, role, activeRow };
  }

  function renderRoleInfo(role, activeRow, users, status, context, editable, configId) {
    const orgLevelOptions = data.orgLevels.filter(level => level.id !== "service-center").map(level => level.label);
    const disabled = editable ? "" : " disabled";
    const systemOptions = ["系统管理", "消保审查", "消保投诉", "智能审查"];
    const systemName = { admin: "系统管理", review: "消保审查", biz: "消保投诉", intelligent: "智能审查" }[moduleState.tab] || "消保投诉";
    return '<div class="admin-role-form-grid admin-role-edit-form">' +
      '<label><span>所属系统</span><select class="di-input" data-admin-role-field="system" disabled>' + selectOptions(systemOptions, systemName) + '</select></label>' +
      '<label><span>角色名称</span><input class="di-input" data-admin-role-field="name" value="' + attr(activeRow.name) + '"' + (editable ? " required" : "") + disabled + '></label>' +
      '<label><span>角色编号</span><input class="di-input" data-admin-role-field="code" value="' + attr(roleCode(role, configId)) + '"' + (editable ? " required" : "") + disabled + '></label>' +
      '<label><span>角色说明</span><input class="di-input" data-admin-role-field="description" value="' + attr(activeRow.description) + '"' + disabled + '></label>' +
      '<label><span>机构层级</span><select class="di-input" data-admin-role-field="subtype"' + disabled + '>' + selectOptions(orgLevelOptions, activeRow.subtype) + '</select></label>' +
      '<label><span>数据范围</span><select class="di-input" data-admin-role-field="queryScope"' + disabled + '>' + selectOptions(distinctScopeOptions("query"), activeRow.queryScope) + '</select></label>' +
      '<label><span>导出数据范围</span><select class="di-input" data-admin-role-field="exportScope"' + disabled + '>' + selectOptions(distinctScopeOptions("export"), activeRow.exportScope) + '</select></label>' +
    "</div>";
  }

  function renderRoleConfig(context) {
    const { configId, isBusiness, isBusinessRow, isReview, role, activeRow } = currentRoleConfigSelection();
    const status = roleStatus(role, configId);
    const users = configuredUsers(role);
    const userRows = users.map((user, index) => [String(index + 1), escapeHtml(user.name), escapeHtml(user.account), escapeHtml(user.org), escapeHtml(user.dept), context.statusTag(user.status)]);
    const editable = moduleState.roleEditMode && status !== "停用";
    const menuEditable = editable;
    const isNew = String(moduleState.roleConfig || "").startsWith("custom:") && !roleInfoOverride(role, configId).name;
    const footer = '<div class="admin-role-dialog-footer"><button class="btn xib-btn xib-btn--secondary" data-action="admin-role-list">取消</button>' + (editable ? '<button class="btn xib-btn xib-btn--primary btn-primary" type="button" data-admin-save-role-config>确定</button>' : '') + '</div>';
    const audit = editable ? "" : '<section class="admin-role-audit"><h3>审计信息</h3><dl class="admin-desc-grid">' + auditRows(role) + '</dl></section>';
    return renderList(context, '<div class="admin-role-dialog-backdrop"><section class="admin-role-dialog" role="dialog" aria-modal="true"><header><h2>' + (editable ? (isNew ? "添加角色" : "修改角色") : "查看角色") + '</h2><button type="button" class="admin-role-dialog-close" data-action="admin-role-list" aria-label="关闭">×</button></header><div class="admin-role-dialog-body">' + renderRoleInfo(role, activeRow, users, status, context, editable, configId) + '<section class="admin-role-permission-section"><div class="admin-role-section-title">菜单权限</div>' + permissionTree(role, menuEditable, configId) + '</section>' + audit + '</div>' + footer + '</section></div>');
  }

  function descItem(label, value) {
    return "<div><dt>" + escapeHtml(label) + "</dt><dd>" + value + "</dd></div>";
  }

  function renderWorkspaceTabs() {
    return '<div class="tabs lib-tabs-line admin-inner-tabs admin-permission-tabs">' +
      '<button class="tab ' + (moduleState.workspace === "permission" ? "is-active" : "") + '" data-action="admin-set-workspace" data-id="permission">权限配置</button>' +
      '<button class="tab ' + (moduleState.workspace === "users" ? "is-active" : "") + '" data-action="admin-set-workspace" data-id="users">用户配置</button>' +
    "</div>";
  }

  function renderPermissionTabs() {
    return '<div class="tabs lib-tabs-line admin-inner-tabs admin-permission-tabs">' +
      '<button class="tab ' + (moduleState.tab === "admin" ? "is-active" : "") + '" data-action="admin-perm-tab" data-id="admin">系统管理</button>' +
      '<button class="tab ' + (moduleState.tab === "review" ? "is-active" : "") + '" data-action="admin-perm-tab" data-id="review">消保审查</button>' +
      '<button class="tab ' + (moduleState.tab === "biz" ? "is-active" : "") + '" data-action="admin-perm-tab" data-id="biz">消保投诉</button>' +
      '<button class="tab ' + (moduleState.tab === "intelligent" ? "is-active" : "") + '" data-action="admin-perm-tab" data-id="intelligent">智能审查</button>' +
    "</div>";
  }

  function renderPermissionList(context) {
    const scope = "admin-permission-" + moduleState.tab;
    const roleSets = {
      admin: data.adminRoles.map(role => { const configId = "admin:" + role.id; return { ...rowForRole(role, { configId }), configId }; }).concat(moduleState.customRoles.admin.map(role => { const configId = customRoleConfigId("admin", role); return { ...rowForRole(role, { configId }), configId }; })),
      biz: businessRoleRows().map(row => ({ ...row, configId: "bizrow:" + row.rowId })).concat(moduleState.customRoles.biz.map(role => { const configId = customRoleConfigId("biz", role); return { ...rowForRole(role, { configId }), configId }; })),
      review: data.reviewRoles.map((role, index) => { const configId = "review:" + index; return { ...rowForRole(role, { configId }), configId }; }).concat(moduleState.customRoles.review.map(role => { const configId = customRoleConfigId("review", role); return { ...rowForRole(role, { configId }), configId }; })),
      intelligent: moduleState.customRoles.intelligent.map(role => { const configId = customRoleConfigId("intelligent", role); return { ...rowForRole(role, { configId }), configId }; })
    };
    const keyword = moduleState.roleKeyword.trim();
    const filteredRows = (roleSets[moduleState.tab] || []).filter(item => !keyword || displayRoleName(item).includes(keyword));
    const allRows = filteredRows.map(item => [
      escapeHtml(displayRoleName(item)),
      escapeHtml(roleTimestamp(item.role.time || "2026-10-20 10:00:00")),
      roleStatusSwitch(item),
      roleOperationButtons(item)
    ]);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
    const currentPage = Math.min(totalPages, Math.max(1, Number(moduleState.permissionPages[moduleState.tab] || 1)));
    moduleState.permissionPages[moduleState.tab] = currentPage;
    const rows = allRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return tableMarkup(["角色", "更新时间", "状态", "操作"], rows, scope) + renderPermissionPagination(allRows.length, currentPage, totalPages);
  }

  function renderPermissionPagination(total, currentPage, totalPages) {
    const pageButtons = Array.from({ length: totalPages }, (_, index) => index + 1).map(page =>
      '<button class="page-btn ' + (page === currentPage ? "is-active" : "") + '" data-action="admin-permission-page" data-id="' + page + '">' + page + "</button>"
    ).join("");
    return '<div class="pagination ds-pagination admin-permission-pagination" data-count="' + total + '">' +
      '<span class="pagination-total">共 ' + total + ' 条</span>' +
      '<span class="di-native-select pagination-size admin-permission-page-size">10 条/页</span>' +
      '<nav class="pagination-nav" aria-label="分页">' +
        '<button class="page-btn pagination-arrow" data-action="admin-permission-page" data-id="' + Math.max(1, currentPage - 1) + '" aria-label="上一页" ' + (currentPage <= 1 ? "disabled" : "") + '>‹</button>' +
        pageButtons +
        '<button class="page-btn pagination-arrow" data-action="admin-permission-page" data-id="' + Math.min(totalPages, currentPage + 1) + '" aria-label="下一页" ' + (currentPage >= totalPages ? "disabled" : "") + '>›</button>' +
      '</nav><strong class="pagination-current" aria-live="polite">第 ' + currentPage + " / " + totalPages + " 页</strong></div>";
  }

  function orgScopeOptions() {
    const nodes = organizations
      .filter(org => org.status === "启用" && (org.name === "总行" || organizationTypeName(org) === "一级分行"))
      .map(org => ({ id: org.id, label: org.name, sort: org.name === "总行" ? 0 : 1 }));
    return [{ id: "all", label: "全行", sort: -1 }].concat(nodes.sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "zh-Hans-CN")));
  }

  function orgMatchesScope(org) {
    if (!org || moduleState.userScope === "all") return true;
    return org.scopeCode === moduleState.userScope || org.code === moduleState.userScope || String(org.code).startsWith(moduleState.userScope);
  }

  function orgsForSelection() {
    return assignableOrgs.filter(org => (moduleState.userLevel === "all" || org.levelId === moduleState.userLevel) && orgMatchesScope(org));
  }

  function normalizeOrgPath(value) {
    return String(value || "").replace(/\s*\/\s*/g, "/").trim();
  }

  function assignableOrgForPath(value) {
    const normalized = normalizeOrgPath(value);
    if (!normalized) return null;
    const exact = assignableOrgs.find(org => [org.treePath, org.name, org.dept, org.code].some(item => normalizeOrgPath(item) === normalized));
    if (exact) return exact;
    const source = organizations.find(org => normalizeOrgPath(organizationPath(org)) === normalized || normalizeOrgPath(org.name) === normalized);
    let current = source;
    while (current) {
      const assignable = assignableOrgs.find(org => org.code === current.id);
      if (assignable) return assignable;
      current = orgById.get(current.parentId);
    }
    const leafName = normalized.split("/").pop();
    return orgsForSelection().find(org => org.dept === leafName || org.name.endsWith(" / " + leafName) || org.name === leafName) || null;
  }

  function sourceOrgForPath(value) {
    const normalized = normalizeOrgPath(value);
    if (!normalized) return null;
    const assignable = assignableOrgForPath(value);
    if (assignable) return orgById.get(assignable.code) || null;
    return organizations.find(org => normalizeOrgPath(organizationPath(org)) === normalized || normalizeOrgPath(org.name) === normalized) || null;
  }

  function applyOrgTreeSelection(value, resetPage = true) {
    moduleState.userOrgPath = value || "";
    if (resetPage) moduleState.userPage = 1;
    const org = assignableOrgForPath(value);
    if (!org) {
      if (!value) moduleState.userOrg = "";
      moduleState.userAccount = "";
      return;
    }
    moduleState.userScope = "all";
    moduleState.userLevel = org.levelId;
    moduleState.userOrg = org.id;
    moduleState.userAccount = "";
  }

  function availableLevels() {
    const ids = new Set(assignableOrgs.filter(orgMatchesScope).map(org => org.levelId));
    return data.orgLevels.filter(level => ids.has(level.id));
  }

  function currentOrg() {
    if (moduleState.userOrgPath) {
      const org = assignableOrgForPath(moduleState.userOrgPath);
      if (org) return org;
    }
    return assignableOrgs.find(org => org.id === moduleState.userOrg) || null;
  }

  function userBelongsToOrg(user, org) {
    if (!org) return false;
    if (org.levelId === "service-center") return /客服/.test(user.job + user.position);
    return user.orgCode === org.code || user.deptCode === org.code || user.officeCode === org.code;
  }

  function userBelongsToRange(user) {
    if (!moduleState.userOrgPath) return true;
    const source = sourceOrgForPath(moduleState.userOrgPath);
    const rangeCode = source?.id || currentOrg()?.code || "";
    if (!rangeCode) return true;
    return [user.orgCode, user.deptCode, user.officeCode].some(code => code && String(code).startsWith(rangeCode));
  }

  function usersForCurrentOrg() {
    return userPool.filter(user => user.status === "启用" && userBelongsToRange(user) && (!moduleState.userDepartment || user.dept === moduleState.userDepartment));
  }

  function departmentOptionsForCurrentRange() {
    const values = userPool.filter(user => user.status === "启用" && userBelongsToRange(user)).map(user => user.dept).filter(value => value && value !== "-");
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function userPageSize() {
    return 10;
  }

  function userTotalPages(users = usersForCurrentOrg()) {
    return Math.max(1, Math.ceil(users.length / userPageSize()));
  }

  function usersForCurrentPage(users = usersForCurrentOrg()) {
    const totalPages = userTotalPages(users);
    moduleState.userPage = Math.min(totalPages, Math.max(1, Number(moduleState.userPage) || 1));
    const start = (moduleState.userPage - 1) * userPageSize();
    return users.slice(start, start + userPageSize());
  }

  function currentUser() {
    return userPool.find(user => user.account === moduleState.userAccount) || usersForCurrentOrg()[0] || null;
  }

  function roleApplicableForOrg(roleName, org) {
    return Boolean(org && (data.roleLevelMap[roleName] || []).includes(org.levelId));
  }

  function orgCategory(org) {
    if (!org) return "";
    if (org.levelId === "branch-unit") return "支行";
    if (org.levelId === "branch-consumer" || org.levelId === "branch-dept") return "分行";
    if (org.levelId === "head-consumer" || org.levelId === "head-dept") return "总行";
    return org.levelId === "service-center" ? "客服中心" : "";
  }

  function userRoleScopeAllowed(user, org) {
    const category = orgCategory(org);
    if (!user || !category) return false;
    if (category === "客服中心") return /客服/.test(user.job + user.position);
    const text = (user.org || "") + (user.dept || "") + (org?.name || "");
    if (category === "总行") return /总行/.test(text);
    if (category === "支行") return /支行/.test(text);
    if (category === "分行") return /分行/.test(text) && !/支行/.test(text);
    return false;
  }

  function roleApplicableForUser(roleName, user) {
    const org = orgForUser(user) || currentOrg();
    return roleApplicableForOrg(roleName, org) && userRoleScopeAllowed(user, org);
  }

  function orgForUser(user) {
    if (!user) return null;
    if (/客服/.test(user.job + user.position)) {
      return assignableOrgs.find(org => org.levelId === "service-center") || null;
    }
    return assignableOrgs.find(org => [user.officeCode, user.deptCode, user.orgCode].includes(org.code)) ||
      assignableOrgs.find(org => user.officeCode?.startsWith(org.code) || user.deptCode?.startsWith(org.code) || user.orgCode?.startsWith(org.code)) ||
      currentOrg();
  }

  function currentRoleOrg() {
    return orgForUser(currentUser()) || currentOrg();
  }

  function configuredRolesForUser(user) {
    const roleOrg = orgForUser(user) || currentOrg();
    return user ? data.baseRoleNames.filter(roleName => roleApplicableForUser(roleName, user) && userHasRole(user, roleOrg, roleName)) : [];
  }

  function configurableRolesForUser(user) {
    const configured = configuredRolesForUser(user);
    return user ? data.baseRoleNames.filter(roleName => roleApplicableForUser(roleName, user) && !configured.includes(roleName)) : [];
  }

  function defaultUserHasRole(user, roleName) {
    const text = (user?.job || "") + (user?.position || "");
    if (roleName === "经办员") return /经办员|客服人员|投诉处理员/.test(text);
    if (roleName === "复核员") return /复核|审核/.test(text);
    if (roleName === "处理员") return /处理员|工单处理员|投诉处理员|客服人员/.test(text);
    if (roleName === "审批员") return /审批员|审核员|管理员/.test(text);
    if (roleName === "业务员") return /业务员|客服人员|系统管理员/.test(text);
    return false;
  }

  function userRoleKey(org, user, roleName) {
    return [org?.id || "", user?.account || "", roleName].join("|");
  }

  function userHasRole(user, org, roleName) {
    const key = userRoleKey(org, user, roleName);
    if (moduleState.userRoleOverrides.has(key)) return moduleState.userRoleOverrides.get(key);
    return roleApplicableForOrg(roleName, org) && userRoleScopeAllowed(user, org) && defaultUserHasRole(user, roleName);
  }

  function syncUserState() {
    if (!orgScopeOptions().some(scope => scope.id === moduleState.userScope)) moduleState.userScope = "all";
    if (moduleState.userLevel !== "all" && !availableLevels().some(level => level.id === moduleState.userLevel)) moduleState.userLevel = availableLevels()[0]?.id || "all";
    if (moduleState.userOrgPath) applyOrgTreeSelection(moduleState.userOrgPath, false);
    const rangeUsers = usersForCurrentOrg();
    moduleState.userPage = Math.min(userTotalPages(rangeUsers), Math.max(1, Number(moduleState.userPage) || 1));
    if (!rangeUsers.some(user => user.account === moduleState.userAccount)) moduleState.userAccount = usersForCurrentPage(rangeUsers)[0]?.account || rangeUsers[0]?.account || "";
  }

  function select(name, value, options, extra = "") {
    return '<select class="di-input" data-admin-permission-select="' + name + '" ' + extra + ">" + options.map(option => '<option value="' + attr(option.id) + '" ' + (String(option.id) === String(value) ? "selected" : "") + ">" + escapeHtml(option.label) + "</option>").join("") + "</select>";
  }

  function renderOrgTreeFilter(context) {
    const field = { type: "hierarchyCascader", dictionary: "userOrganizationTree", levels: ["机构范围", "机构层级", "相关机构"], leafLevel: 3, multiple: false, nonLeafSelectable: true, searchable: true, placeholder: "请选择机构范围" };
    if (typeof context.renderHierarchyCascaderControl === "function") {
      return context.renderHierarchyCascaderControl("admin-permission-org-tree", field, "admin.permission.userOrgPath", false);
    }
    return '<input class="di-input" id="admin-permission-org-tree" data-field-key="admin.permission.userOrgPath" value="' + attr(moduleState.userOrgPath) + '" placeholder="请选择机构范围">';
  }

  function cleanUserRoleNames(selectedUser) {
    if (!selectedUser) return [];
    const roleOrg = orgForUser(selectedUser) || currentOrg();
    const rolesByLevel = {
      "head-consumer": ["超级管理员", "普通管理员", "业务员", "审批员", "处理员", "经办员"],
      "head-dept": ["审批员", "处理员"],
      "branch-consumer": ["普通管理员", "业务员", "审批员", "处理员", "经办员"],
      "branch-dept": ["审批员", "处理员"],
      "branch-unit": ["业务员", "审批员", "处理员", "经办员"],
      "service-center": ["业务员", "处理员", "复核员", "经办员"]
    };
    return [...(rolesByLevel[roleOrg?.levelId] || [])];
  }

  function complaintRolesForUser(selectedUser) {
    const roleOrg = orgForUser(selectedUser) || currentOrg();
    return cleanUserRoleNames(selectedUser).filter(roleName => {
      const key = userRoleKey(roleOrg, selectedUser, roleName);
      if (moduleState.userRoleOverrides.has(key)) return moduleState.userRoleOverrides.get(key);
      if (roleName === "超级管理员") return /系统管理员|超级管理员/.test(selectedUser.job + selectedUser.position);
      if (roleName === "普通管理员") return /管理员|管理岗/.test(selectedUser.job + selectedUser.position);
      if (roleName === "查询员") return false;
      return defaultUserHasRole(selectedUser, roleName);
    });
  }

  function multiRoleSelect(kind, label, options, selected) {
    const key = kind === "complaint" ? "admin-user-complaint-role" : "admin-user-review-role";
    const summary = selected.length ? "已选 " + selected.length + " 项" : "请选择";
    return '<label class="admin-role-multi-field"><span>' + escapeHtml(label) + '</span><div class="admin-role-multiselect" data-admin-role-multiselect><button type="button" class="di-select is-fluid admin-role-multiselect-trigger"><span>' + summary + '</span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><div class="admin-role-multiselect-popover di-select-popover" hidden>' + options.map(option => '<label><input type="checkbox" data-' + key + '="' + attr(option) + '" ' + (selected.includes(option) ? "checked" : "") + '><span>' + escapeHtml(option) + '</span></label>').join("") + '</div></div></label>';
  }

  function renderUserRolePanel(selectedUser) {
    if (!selectedUser) return '<section class="panel" data-admin-user-role-panel><div class="panel-head"><span class="panel-title">用户角色配置</span></div><div class="empty-state">请选择左侧用户</div></section>';
    const complaintOptions = cleanUserRoleNames(selectedUser);
    const complaintSelected = complaintRolesForUser(selectedUser);
    const reviewOptions = cleanUserRoleNames(selectedUser);
    const reviewSelected = moduleState.userReviewRoleOverrides.get(selectedUser.account) || [];
    return '<section class="panel" data-admin-user-role-panel><div class="panel-head"><span class="panel-title">用户角色配置</span><button class="btn xib-btn xib-btn--primary btn-primary" type="button" data-admin-save-user-config>保存配置</button></div><div class="panel-body">' +
      '<dl class="admin-desc-grid admin-selected-user-info">' + descItem("姓名", escapeHtml(selectedUser.name)) + descItem("工号", escapeHtml(selectedUser.account)) + descItem("机构", escapeHtml(selectedUser.org)) + descItem("部门", escapeHtml(selectedUser.dept || "-")) + '</dl>' +
      '<div class="admin-user-role-config-grid">' + multiRoleSelect("complaint", "投诉管理角色", complaintOptions, complaintSelected) + multiRoleSelect("review", "消保审查角色", reviewOptions, reviewSelected) + '</div>' +
      '</div></section>';
  }
  function renderUserPagination(users) {
    const totalPages = userTotalPages(users);
    if (totalPages <= 1) return "";
    const pageSize = userPageSize();
    const pageButtons = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      return '<button class="page-btn ' + (moduleState.userPage === page ? "is-active" : "") + '" data-action="admin-user-page" data-id="' + page + '">' + page + "</button>";
    }).join("");
    return '<div class="pagination ds-pagination admin-user-pagination" data-count="' + users.length + '">' +
      '<span class="pagination-total">共 ' + users.length + ' 条</span>' +
      '<span class="di-native-select pagination-size admin-user-page-size">' + pageSize + ' 条/页</span>' +
      '<nav class="pagination-nav" aria-label="用户列表分页">' +
        '<button class="page-btn pagination-arrow" data-action="admin-user-page" data-id="' + Math.max(1, moduleState.userPage - 1) + '" aria-label="上一页" ' + (moduleState.userPage <= 1 ? "disabled" : "") + '>‹</button>' +
        pageButtons +
        '<button class="page-btn pagination-arrow" data-action="admin-user-page" data-id="' + Math.min(totalPages, moduleState.userPage + 1) + '" aria-label="下一页" ' + (moduleState.userPage >= totalPages ? "disabled" : "") + '>›</button>' +
      '</nav><strong class="pagination-current" aria-live="polite">第 ' + moduleState.userPage + " / " + totalPages + " 页</strong></div>";
  }

  function renderUserConfig(context) {
    syncUserState();
    if (context.state?.formValues) context.state.formValues["admin.permission.userOrgPath"] = moduleState.userOrgPath;
    const selectedUser = currentUser();
    const orgUsers = usersForCurrentOrg();
    const pageUsers = usersForCurrentPage(orgUsers);
    const departmentOptions = departmentOptionsForCurrentRange();
    const filter = '<section class="filter-panel ticket-filter-panel admin-filter-panel admin-permission-user-filter"><div class="ticket-filter-grid">' +
      '<div class="ticket-filter-item"><label>机构范围</label><div class="form-control admin-org-cascader-control">' + renderOrgTreeFilter(context) + '</div></div>' +
      '<div class="ticket-filter-item"><label>部门范围</label><select class="di-native-select is-fluid" id="admin-permission-user-department"><option value="">全部部门</option>' + departmentOptions.map(value => '<option value="' + attr(value) + '" ' + (value === moduleState.userDepartment ? "selected" : "") + '>' + escapeHtml(value) + '</option>').join("") + '</select></div>' +
      '<div class="filter-actions ticket-filter-actions"><button class="btn-link" type="button" data-admin-reset-users>重置</button><button class="btn xib-btn xib-btn--primary btn-primary" type="button" data-admin-search-users>查询</button></div></div></section>';
    const userList = '<section class="panel"><div class="panel-head"><span class="panel-title">用户列表</span><span class="tag tag-blue">' + orgUsers.length + ' 名用户</span></div><div class="panel-body admin-user-list-body"><div class="admin-permission-user-list">' + (orgUsers.length ? pageUsers.map(user => {
      const roles = complaintRolesForUser(user);
      return '<button type="button" class="admin-user-list-row ' + (selectedUser?.account === user.account ? "is-active" : "") + '" data-admin-select-user data-id="' + attr(user.account) + '"><span class="admin-user-list-main"><strong>' + escapeHtml(user.name) + '</strong><em>' + escapeHtml(user.org) + '　' + escapeHtml(user.dept || "-") + '</em></span><span class="admin-user-list-tags">' + (roles.length ? roles.map(role => '<i class="tag-blue-light">' + escapeHtml(role) + '</i>').join("") : '<i class="admin-action-muted">暂无角色</i>') + '</span></button>';
    }).join("") : '<div class="empty-state">当前筛选范围暂无启用用户</div>') + '</div>' + renderUserPagination(orgUsers) + '</div></section>';
    return filter + '<section class="admin-card-section"><div class="admin-permission-user-layout">' + userList + renderUserRolePanel(selectedUser) + '</div></section>';
  }
  function renderList(context, dialog = "") {
    const actions = '<button class="btn xib-btn xib-btn--primary btn-primary" type="button" data-action="admin-role-create">新增</button>';
    const search = '<section class="filter-panel ticket-filter-panel admin-filter-panel admin-role-filter"><div class="ticket-filter-grid"><div class="ticket-filter-item"><label>角色名称</label><input class="di-input" data-admin-role-search value="' + attr(moduleState.roleKeyword) + '" placeholder="请输入角色名称"></div><div class="filter-actions ticket-filter-actions"><button class="btn xib-btn xib-btn--primary btn-primary" type="button" data-admin-role-search-button>搜索</button></div></div></section>';
    return '<section class="page admin-page xib-module-admin-permissions" data-module="admin-permissions">' + context.pageHeader("角色权限管理", "", actions) + renderPermissionTabs() + '<div class="admin-surface admin-role-list-card">' + search + renderPermissionList(context) + '</div>' + (dialog || "") + "</section>";
  }

  function bindUserConfig(root, context) {
    const bindRoleMultiselects = scope => {
      (scope || root).querySelectorAll("[data-admin-role-multiselect]").forEach(host => {
        if (host.dataset.bound === "true") return;
        host.dataset.bound = "true";
        const trigger = host.querySelector(".admin-role-multiselect-trigger");
        const popover = host.querySelector(".admin-role-multiselect-popover");
        const updateSummary = () => {
          const count = popover?.querySelectorAll('input[type="checkbox"]:checked').length || 0;
          const summary = trigger?.querySelector("span");
          if (summary) summary.textContent = count ? "已选 " + count + " 项" : "请选择";
        };
        trigger?.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          root.querySelectorAll(".admin-role-multiselect-popover").forEach(item => { if (item !== popover) item.hidden = true; });
          if (popover) popover.hidden = !popover.hidden;
        });
        popover?.addEventListener("click", event => event.stopPropagation());
        popover?.addEventListener("change", updateSummary);
      });
    };
    const bindSaveUserConfig = () => {
      const saveButton = root.querySelector("[data-admin-save-user-config]");
      if (!saveButton || saveButton.dataset.bound === "true") return;
      saveButton.dataset.bound = "true";
      saveButton.addEventListener("click", () => {
        const user = currentUser();
        const org = currentRoleOrg();
        if (!user || !org) return;
        cleanUserRoleNames(user).forEach(roleName => {
          const input = root.querySelector('[data-admin-user-complaint-role="' + roleName + '"]');
          moduleState.userRoleOverrides.set(userRoleKey(org, user, roleName), Boolean(input?.checked));
        });
        moduleState.userReviewRoleOverrides.set(user.account, [...root.querySelectorAll('[data-admin-user-review-role]:checked')].map(input => input.dataset.adminUserReviewRole));
        context.rerenderPage(false, { instant: true });
      });
    };
    const refreshSelectedUserArea = () => {
      const selectedUser = currentUser();
      root.querySelectorAll("[data-admin-select-user]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.id === selectedUser?.account);
      });
      const panel = root.querySelector("[data-admin-user-role-panel]");
      if (panel) panel.outerHTML = renderUserRolePanel(selectedUser);
      bindSaveUserConfig();
      bindRoleMultiselects(root.querySelector("[data-admin-user-role-panel]"));
    };
    root.querySelectorAll("[data-admin-permission-select]").forEach(selectEl => {
      selectEl.addEventListener("change", () => {
        const key = selectEl.dataset.adminPermissionSelect;
        if (key === "scope") { moduleState.userScope = selectEl.value; moduleState.userLevel = "all"; moduleState.userOrg = ""; moduleState.userOrgPath = ""; moduleState.userAccount = ""; moduleState.userPage = 1; }
        if (key === "level") { moduleState.userLevel = selectEl.value; moduleState.userOrg = ""; moduleState.userOrgPath = ""; moduleState.userAccount = ""; moduleState.userPage = 1; }
        context.rerenderPage(true);
      });
    });
    root.querySelectorAll("[data-admin-select-user]").forEach(button => {
      button.addEventListener("click", () => {
        moduleState.userAccount = String(button.dataset.id || "");
        refreshSelectedUserArea();
      });
    });
    root.querySelector('.admin-permission-user-filter .di-hierarchy-cascader-popover')?.addEventListener('click', event => {
      if (!event.target.closest('[data-hierarchy-toggle],[data-hierarchy-search-toggle],[data-hierarchy-confirm]')) return;
      setTimeout(() => {
        const nextOrg = root.querySelector('#admin-permission-org-tree')?.value || root.querySelector('input[data-field-key="admin.permission.userOrgPath"]')?.value || "";
        if (nextOrg === moduleState.userOrgPath) return;
        applyOrgTreeSelection(nextOrg);
        moduleState.userDepartment = "";
        syncUserState();
        context.rerenderPage(false, { instant: true });
      }, 0);
    });
    bindRoleMultiselects(root);
    root.querySelector("[data-admin-search-users]")?.addEventListener("click", () => {
      const orgTreeValue = root.querySelector("#admin-permission-org-tree")?.value || root.querySelector('input[data-field-key="admin.permission.userOrgPath"]')?.value || "";
      applyOrgTreeSelection(orgTreeValue);
      moduleState.userDepartment = root.querySelector("#admin-permission-user-department")?.value || "";
      syncUserState();
      context.rerenderPage(false, { instant: true });
    });
    root.querySelector("[data-admin-reset-users]")?.addEventListener("click", () => { moduleState.userOrgPath = ""; moduleState.userDepartment = ""; moduleState.userAccount = ""; moduleState.userPage = 1; if (context.state?.formValues) context.state.formValues["admin.permission.userOrgPath"] = ""; context.rerenderPage(false, { instant: true }); });
    bindSaveUserConfig();
  }

  global.XIB_ADMIN_USER_CONFIG_VIEW = {
    render: renderUserConfig,
    afterRender: bindUserConfig,
    handleAction(action, payload, context) {
      if (action === "admin-user-page") {
        moduleState.userPage = Math.max(1, Number(payload.id) || 1);
        moduleState.userAccount = usersForCurrentPage(usersForCurrentOrg())[0]?.account || "";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-search-users") {
        syncUserState();
        context.rerenderPage(true);
        return true;
      }
      return false;
    }
  };

  registry.register({
    name: "admin-permissions",
    routes: ["admin-permission"],
    reset() { moduleState.roleConfig = null; moduleState.roleEditMode = false; moduleState.tab = "admin"; },
    render(page, context) {
      return moduleState.roleConfig === null ? renderList(context) : renderRoleConfig(context);
    },
      afterRender(root, page, context) {
        const runRoleSearch = () => {
          moduleState.roleKeyword = root.querySelector("[data-admin-role-search]")?.value || "";
          moduleState.permissionPages[moduleState.tab] = 1;
          context.rerenderPage(true);
        };
        root.querySelector("[data-admin-role-search-button]")?.addEventListener("click", runRoleSearch);
        root.querySelector("[data-admin-role-search]")?.addEventListener("keydown", event => { if (event.key === "Enter") runRoleSearch(); });
        root.querySelector("[data-admin-tree-select-all]")?.addEventListener("change", event => {
          root.querySelectorAll("[data-admin-menu-permission]").forEach(input => { input.checked = event.target.checked; });
        });
        root.querySelector("[data-admin-tree-expand]")?.addEventListener("change", event => {
          root.querySelector(".admin-permission-tree")?.classList.toggle("is-collapsed", !event.target.checked);
          root.querySelectorAll(".admin-permission-tree .permission-node.has-children").forEach(node => {
            node.classList.toggle("is-node-collapsed", !event.target.checked);
          });
          root.querySelectorAll("[data-admin-permission-node-toggle]").forEach(button => {
            button.setAttribute("aria-expanded", String(event.target.checked));
          });
        });
        root.querySelectorAll("[data-admin-permission-node-toggle]").forEach(button => button.addEventListener("click", () => {
          const node = button.closest(".permission-node");
          const collapsed = node?.classList.toggle("is-node-collapsed") || false;
          button.setAttribute("aria-expanded", String(!collapsed));
          button.setAttribute("aria-label", (collapsed ? "展开" : "收起") + (node?.querySelector(":scope > .permission-node-line label")?.textContent || "菜单"));
        }));
        root.querySelectorAll("[data-admin-menu-permission]").forEach(input => input.addEventListener("change", event => {
          if (!root.querySelector("[data-admin-tree-link]")?.checked) return;
          event.target.closest(".permission-node")?.querySelectorAll(".permission-children [data-admin-menu-permission]").forEach(child => { child.checked = event.target.checked; });
        }));
        const saveRoleButton = root.querySelector("[data-admin-save-role-config]");
        if (saveRoleButton) {
          saveRoleButton.addEventListener("click", () => {
            const { configId, role } = currentRoleConfigSelection();
            const key = configId || roleStateKey(role);
            const nameInput = root.querySelector('[data-admin-role-field="name"]');
            const codeInput = root.querySelector('[data-admin-role-field="code"]');
            if (!nameInput?.value.trim() || !codeInput?.value.trim()) {
              const invalidInput = !nameInput?.value.trim() ? nameInput : codeInput;
              invalidInput?.setCustomValidity(invalidInput === nameInput ? "请输入角色名称" : "请输入角色编号");
              invalidInput?.reportValidity();
              invalidInput?.addEventListener("input", () => invalidInput.setCustomValidity(""), { once:true });
              return;
            }
            moduleState.roleInfoOverrides.set(key, {
              name: root.querySelector('[data-admin-role-field="name"]')?.value || role.name,
              code: root.querySelector('[data-admin-role-field="code"]')?.value || roleCode(role, configId),
              subtype: root.querySelector('[data-admin-role-field="subtype"]')?.value || role.subtype || "-",
              status: root.querySelector('[data-admin-role-field="status"]')?.value || roleStatus(role),
              queryScope: root.querySelector('[data-admin-role-field="queryScope"]')?.value || role.queryScope || role.scope || "-",
              exportScope: root.querySelector('[data-admin-role-field="exportScope"]')?.value || role.exportScope || "无",
              description: root.querySelector('[data-admin-role-field="description"]')?.value || roleDescription(role)
            });
            const checkedKeys = new Set();
            root.querySelectorAll("[data-admin-menu-permission]:checked").forEach(input => {
              String(input.dataset.adminMenuPermission || "").split(",").filter(Boolean).forEach(item => checkedKeys.add(item));
            });
            moduleState.roleMenuOverrides.set(key, Array.from(checkedKeys));
            moduleState.roleConfig = null;
            moduleState.roleEditMode = false;
            context.rerenderPage(true);
          });
        }
        bindUserConfig(root, context);
        return true;
      },
    handleAction(action, payload, context) {
      if (action === "admin-role-create") {
        const tab = ["admin", "review", "biz", "intelligent"].includes(moduleState.tab) ? moduleState.tab : "admin";
        moduleState.customRoleSequence += 1;
        const defaultLevel = data.orgLevels[0] || {};
        const role = { id: "custom-" + tab + "-" + moduleState.customRoleSequence, code: "", name: "", subtype: defaultLevel.label || "-", description: "", queryScope: defaultLevel.queryScope || "-", exportScope: defaultLevel.exportScope || "-", status: "启用", custom: true, menus: [], time: "2026-10-22 10:00:00" };
        moduleState.customRoles[tab].push(role);
        const defaultRoleCount = tab === "biz" ? businessRoleRows().length : tab === "review" ? data.reviewRoles.length : tab === "admin" ? data.adminRoles.length : 0;
        moduleState.permissionPages[tab] = Math.max(1, Math.ceil((defaultRoleCount + moduleState.customRoles[tab].length) / 10));
        moduleState.roleConfig = customRoleConfigId(tab, role);
        moduleState.roleEditMode = true;
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-role-toggle") {
        const configId = String(payload.id || "");
        const role = customRoleForConfig(configId) || (configId.startsWith("admin:") ? data.adminRoles.find(item => String(item.id) === configId.slice(6)) : configId.startsWith("review:") ? data.reviewRoles[Number(configId.slice(7))] : configId.startsWith("bizrow:") ? findBusinessSelection(configId)?.role : null);
        if (!role) return false;
        const key = configId || roleStateKey(role);
        if (roleStatus(role, configId) === "停用") {
          moduleState.roleInfoOverrides.set(key, { ...roleInfoOverride(role, configId), status: "启用" });
          context.rerenderPage(true);
          return true;
        }
        context.openModal(
          "",
          '<div class="admin-role-disable-confirm"><span class="admin-role-disable-warning" aria-hidden="true">!</span><p>停用与此角色相关的用户权限将受到影响，确定停用吗？</p></div>',
          "停用",
          () => {
            const hasActiveUsers = configuredUsers(role).some(user => user.status === "启用");
            context.closeOverlay?.();
            if (hasActiveUsers) {
              showRoleDisableError();
              return;
            }
            moduleState.roleInfoOverrides.set(key, { ...roleInfoOverride(role, configId), status: "停用" });
            context.rerenderPage(true);
          }
        );
        return true;
      }
      if (action === "admin-role-delete") {
        const configId = String(payload.id || "");
        const role = customRoleForConfig(configId);
        if (!role) return false;
        const match = configId.match(/^custom:(admin|review|biz|intelligent):(.+)$/);
        if (match) moduleState.customRoles[match[1]] = moduleState.customRoles[match[1]].filter(item => String(item.id) !== match[2]);
        else moduleState.deletedCustomRoleKeys.add(roleStateKey(role));
        moduleState.roleInfoOverrides.delete(configId);
        moduleState.roleMenuOverrides.delete(configId);
        moduleState.roleInfoOverrides.delete(roleStateKey(role));
        moduleState.roleMenuOverrides.delete(roleStateKey(role));
        moduleState.roleConfig = null;
        moduleState.roleEditMode = false;
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-role-config") { moduleState.roleConfig = String(payload.id ?? "admin:0"); moduleState.roleEditMode = false; context.rerenderPage(true); return true; }
      if (action === "admin-role-edit") { moduleState.roleConfig = String(payload.id ?? "admin:0"); moduleState.roleEditMode = true; context.rerenderPage(true); return true; }
      if (action === "admin-role-list") {
        const configId = String(moduleState.roleConfig || "");
        const draftRole = customRoleForConfig(configId);
        if (draftRole && !moduleState.roleInfoOverrides.has(configId) && !draftRole.name) {
          const match = configId.match(/^custom:(admin|review|biz|intelligent):(.+)$/);
          if (match) moduleState.customRoles[match[1]] = moduleState.customRoles[match[1]].filter(item => String(item.id) !== match[2]);
        }
        moduleState.roleConfig = null;
        moduleState.roleEditMode = false;
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-perm-tab") { moduleState.tab = ["admin", "review", "biz", "intelligent"].includes(payload.id) ? payload.id : "admin"; moduleState.roleConfig = null; moduleState.roleKeyword = ""; context.rerenderPage(true); return true; }
        if (action === "admin-permission-page") { moduleState.permissionPages[moduleState.tab] = Math.max(1, Number(payload.id) || 1); context.rerenderPage(true); return true; }
        if (action === "admin-user-page") {
          moduleState.userPage = Math.max(1, Number(payload.id) || 1);
          moduleState.userAccount = usersForCurrentPage(usersForCurrentOrg())[0]?.account || "";
          context.rerenderPage(true);
          return true;
        }
        if (action === "admin-open-user-config") {
          global.XIB_ADMIN_USERS_OPEN_CONFIG = true;
          if (typeof context.navigate === "function") context.navigate("admin-user");
          else context.rerenderPage(true);
          return true;
        }
        if (action === "admin-set-workspace") {
          global.XIB_ADMIN_USERS_OPEN_CONFIG = payload.id === "users";
          if (payload.id === "users" && typeof context.navigate === "function") context.navigate("admin-user");
          else context.rerenderPage(true);
          return true;
        }
        if (action === "admin-search-users") { syncUserState(); context.rerenderPage(true); return true; }
      return false;
    }
  });
})(window);
