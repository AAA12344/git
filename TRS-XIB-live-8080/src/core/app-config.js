(function createAppConfig(global) {
  "use strict";

  const roleLabels = {
    operator: "经办员",
    reviewer: "复核员",
    handler: "处理员",
    approver: "审批员",
    analyst: "业务员",
    admin: "管理员",
    developer: "开发测试"
  };

  const orgRoleOptions = [
    { id: "development", label: "开发测试", institutionLabel: "总行", departmentLabel: "总行消费者权益保护部", roles: [
      { id: "development-developer", label: "开发测试视图", role: "developer", taskInboxRole: "developer" },
      { id: "development-operator", label: "经办员视图", role: "operator", taskInboxRole: "operator" },
      { id: "development-handler", label: "处理员视图", role: "handler", taskInboxRole: "handler" },
      { id: "development-approver", label: "审批员视图", role: "approver", taskInboxRole: "approver" },
      { id: "development-reviewer", label: "复核员视图", role: "reviewer", taskInboxRole: "reviewer" },
      { id: "development-analyst", label: "业务员视图", role: "analyst", taskInboxRole: "analyst" }
    ] },
    { id: "customer-service", label: "客户服务中心", institutionLabel: "总行", departmentLabel: "总行零售金融部", roles: [
      { id: "customer-operator", label: "经办员（客服中心）", role: "operator" },
      { id: "customer-reviewer", label: "复核员（客服中心）", role: "reviewer" },
      { id: "customer-analyst", label: "业务员（客服中心）", role: "analyst" }
    ] },
    { id: "branch-unit", label: "支行", institutionLabel: "北京朝阳支行", departmentLabel: "", roles: [
      { id: "branch-operator", label: "经办员（支行）", role: "operator" },
      { id: "branch-handler", label: "处理员（支行）", role: "handler" },
      { id: "branch-unit-approver", label: "审批员（分行部门/支行）", role: "approver" }
    ] },
    { id: "branch-department", label: "分行部门", institutionLabel: "北京分行", departmentLabel: "北京分行零售金融部", roles: [
      { id: "branch-department-handler", label: "处理员（分行部门）", role: "handler" },
      { id: "branch-department-approver", label: "审批员（分行部门/支行）", role: "approver" }
    ] },
    { id: "branch-consumer", label: "分行消保", institutionLabel: "厦门分行", departmentLabel: "厦门分行消费者权益保护部", roles: [
      { id: "branch-consumer-operator", label: "经办员（分行消保）", role: "operator" },
      { id: "branch-consumer-approver", label: "审批员（分行消保）", role: "approver" },
      { id: "branch-consumer-analyst", label: "业务员（分行消保）", role: "analyst" }
    ] },
    { id: "branch-lead", label: "分行消保小组", institutionLabel: "厦门分行", departmentLabel: "厦门分行消费者权益保护部", roles: [{ id: "branch-lead-approver", label: "审批员（组长/副组长）", role: "approver" }] },
    { id: "head-department", label: "总行部门", institutionLabel: "总行", departmentLabel: "总行零售金融部", roles: [
      { id: "head-department-handler", label: "处理员（总行部门）", role: "handler" },
      { id: "head-department-approver", label: "审批员（总行部门）", role: "approver" }
    ] },
    { id: "head-consumer", label: "总行消保", institutionLabel: "总行", departmentLabel: "总行消费者权益保护部", roles: [
      { id: "head-consumer-operator", label: "经办员（总行消保）", role: "operator" },
      { id: "head-consumer-approver", label: "审批员（总行消保）", role: "approver" },
      { id: "head-consumer-analyst", label: "业务员（总行消保）", role: "analyst" }
    ] },
    { id: "head-supervisor", label: "总行消保部主管", institutionLabel: "总行", departmentLabel: "总行消费者权益保护部", roles: [{ id: "head-supervisor-approver", label: "审批员（总行消保部主管）", role: "approver" }] },
    { id: "technology", label: "科技运维", institutionLabel: "总行", departmentLabel: "总行科技运维部", roles: [
      { id: "technology-admin", label: "二级管理员", role: "admin" },
      { id: "technology-super-admin", label: "超级管理员", role: "admin" }
    ] }
  ];

  const navigation = [
    { id: "home", label: "首页", page: "overview" },
    { id: "complaint", label: "投诉管理", children: [
      { id: "home-tasks", label: "待办消息", page: "home-tasks" },
      { id: "ticket", label: "工单管理", children: [
        { id: "ticket-create", label: "工单创建" },
        { id: "ticket-process", label: "工单处理" }
      ] },
      { id: "request", label: "子单管理", children: [
        { id: "subprocess-create", label: "子单创建" },
        { id: "subprocess-manage", label: "子单处理" }
      ] },
      { id: "approval", label: "审批管理", page: "my-approvals" },
      { id: "rectification", label: "溯源整改", children: [
        { id: "rectification-create", label: "整改创建" },
        { id: "rectification-process", label: "整改处理" },
        { id: "rectification-approve", label: "整改审批" }
      ] },
      { id: "ledger-query", label: "查询导出", page: "ledger-query" },
      { id: "inspection-warning", label: "核查预警", children: [
        { id: "analysis-inspections", label: "智能核查" },
        { id: "analysis-warnings", label: "智能预警" }
      ] },
      { id: "reports", label: "报表管理", page: "analysis-reports" }
    ] },
    { id: "review", label: "消保审查", page: "review-manage" },
    { id: "statistics", label: "统计分析", children: [
      { id: "stats-complaint", label: "投诉统计分析", children: [
        { id: "stats-complaint-overview", label: "投诉总览" },
        { id: "stats-complaint-institution", label: "机构分析" },
        { id: "stats-complaint-product", label: "产品分析" },
        { id: "stats-complaint-reason", label: "原因分析" },
        { id: "stats-complaint-channel", label: "渠道分析" },
        { id: "stats-complaint-line", label: "条线分析" },
        { id: "stats-complaint-customer", label: "客户分析" }
      ] },
      { id: "stats-petition", label: "信访统计分析", page: "stats-petition" }
    ] },
    { id: "report-center", label: "报告中心", page: "report-center" },
    { id: "education", label: "宣传教育", page: "education-manage" },
    { id: "notice", label: "通知中心", children: [
      { id: "notice-complaint", label: "投诉管理通知", page: "notice-complaint" },
      { id: "notice-review", label: "消保审查通知", page: "notice-review" }
    ] },
    { id: "admin", label: "后台管理", children: [
      { id: "admin-org", label: "机构管理", page: "admin-org" },
      { id: "admin-user", label: "用户管理", page: "admin-user" },
      { id: "admin-permission", label: "角色权限管理", page: "admin-permission" },
      { id: "admin-config", label: "参数配置", children: [
        { id: "admin-config-complaint", label: "投诉管理参数" },
        { id: "admin-config-review", label: "消保审查参数" }
      ] },
      { id: "admin-form-dictionary", label: "字典管理", page: "admin-form-dictionary" },
      { id: "admin-form-sms", label: "短信模板管理", page: "admin-form-sms" },
      { id: "admin-jobs", label: "定时任务", page: "admin-jobs" },
      { id: "admin-notify", label: "消息通知配置", children: [
        { id: "admin-notify-complaint", label: "投诉管理消息" },
        { id: "admin-notify-review", label: "消保审查消息" }
      ] },
      { id: "admin-audit", label: "系统操作日志", page: "admin-audit" }
    ] }
  ];

  function navPageIds(items) {
    return items.flatMap(item => item.page ? [item.page] : item.children ? navPageIds(item.children) : item.id ? [item.id] : []);
  }

  const routeIds = [...navPageIds(navigation), "analysis-report-detail", "analysis-warning-detail"];
  const permissions = {
    operator: ["home-tasks", "overview", "ticket-create", "ticket-process", "subprocess-create", "subprocess-manage", "ledger-query", "rectification-create", "rectification-process", "analysis-inspections", "analysis-warnings", "analysis-warning-detail", "notice-complaint", "notice-review"],
    reviewer: ["home-tasks", "overview", "ticket-process", "my-approvals", "notice-complaint", "notice-review"],
    handler: ["home-tasks", "overview", "ticket-process", "subprocess-create", "subprocess-manage", "ledger-query", "rectification-create", "rectification-process", "analysis-inspections", "analysis-warnings", "analysis-warning-detail", "notice-complaint", "notice-review"],
    approver: ["home-tasks", "overview", "ledger-query", "my-approvals", "rectification-create", "rectification-approve", "notice-complaint", "notice-review"],
    analyst: ["overview", "home-tasks", "my-approvals", "report-center", "analysis-reports", "analysis-report-detail", "stats-complaint-overview", "stats-complaint-institution", "stats-complaint-product", "stats-complaint-reason", "stats-complaint-channel", "stats-complaint-line", "stats-complaint-customer", "stats-petition", "notice-complaint", "notice-review"],
    admin: ["overview", "admin-org", "admin-user", "admin-permission", "admin-config-complaint", "admin-config-review", "admin-form-dictionary", "admin-form-sms", "admin-form-review", "admin-jobs", "admin-notify-complaint", "admin-notify-review", "admin-audit", "notice-complaint", "notice-review", "user-manage"],
    developer: routeIds
  };

  const pageMeta = {};
  navigation.forEach(group => {
    if (group.page) pageMeta[group.page] = { title: group.label, group: group.label, groupId: group.id };
    (group.children || []).forEach(section => {
      if (section.page) pageMeta[section.page] = { title: section.label, group: group.label, groupId: group.id, subgroup: section.label, subgroupId: section.id };
      (section.children || []).forEach(page => {
        pageMeta[page.id] = { title: page.label, group: group.label, groupId: group.id, subgroup: section.label, subgroupId: section.id };
      });
    });
  });
  pageMeta["ticket-form"] = { title: "新建工单", group: "投诉管理", groupId: "complaint", subgroup: "工单管理", subgroupId: "ticket" };
  pageMeta["ticket-detail"] = { title: "工单详情", group: "投诉管理", groupId: "complaint", subgroup: "工单管理", subgroupId: "ticket" };
  pageMeta["analysis-warning-detail"] = { title: "预警单详情", group: "投诉管理", groupId: "complaint", subgroup: "核查预警", subgroupId: "inspection-warning" };
  pageMeta["subprocess-detail"] = { title: "子流程详情", group: "投诉管理", groupId: "complaint", subgroup: "子单管理", subgroupId: "request" };
  pageMeta["subprocess-form"] = { title: "新建子流程单", group: "投诉管理", groupId: "complaint", subgroup: "子单管理", subgroupId: "request" };
  pageMeta["rectification-detail"] = { title: "溯源整改单详情", group: "投诉管理", groupId: "complaint", subgroup: "溯源整改", subgroupId: "rectification" };
  pageMeta["rectification-form"] = { title: "新建溯源整改单", group: "投诉管理", groupId: "complaint", subgroup: "溯源整改", subgroupId: "rectification" };
  pageMeta["rectification-create"] = { title: "整改创建", group: "投诉管理", groupId: "complaint", subgroup: "溯源整改", subgroupId: "rectification" };
  pageMeta["rectification-process"] = { title: "整改处理", group: "投诉管理", groupId: "complaint", subgroup: "溯源整改", subgroupId: "rectification" };
  pageMeta["rectification-approve"] = { title: "整改审批", group: "投诉管理", groupId: "complaint", subgroup: "溯源整改", subgroupId: "rectification" };
  pageMeta["analysis-report-detail"] = { title: "报表详情", group: "投诉管理", groupId: "complaint", subgroup: "报表管理", subgroupId: "reports" };
  pageMeta["admin-form-review"] = { title: "消保审查表单", group: "后台管理", groupId: "admin", subgroup: "表单配置", subgroupId: "admin-form-config" };

  const routeAliases = {
    "admin-permission-admin": "admin-permission",
    "admin-permission-biz": "admin-permission",
    "admin-permission-review": "admin-permission"
  };

  function assertUnique(values, label) {
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
    if (duplicates.length) throw new Error(label + " contains duplicates: " + [...new Set(duplicates)].join(", "));
  }

  function validateConfig() {
    const roles = Object.keys(roleLabels);
    const profiles = orgRoleOptions.flatMap(org => org.roles);
    assertUnique(orgRoleOptions.map(org => org.id), "Organization role group IDs");
    assertUnique(profiles.map(profile => profile.id), "Role profile IDs");
    assertUnique(routeIds, "Navigation route IDs");

    profiles.forEach(profile => {
      if (!roles.includes(profile.role)) throw new Error("Unknown role on profile " + profile.id + ": " + profile.role);
    });
    roles.forEach(role => {
      if (!Array.isArray(permissions[role]) || !permissions[role].length) throw new Error("Missing permissions for role: " + role);
    });
    const allowedPermissionRoutes = new Set([...routeIds, "admin-form-review", "user-manage"]);
    Object.entries(permissions).forEach(([role, pages]) => {
      assertUnique(pages, "Permissions for " + role);
      pages.forEach(page => {
        if (!allowedPermissionRoutes.has(page)) throw new Error("Unknown permission route for " + role + ": " + page);
      });
    });
    routeIds.forEach(route => {
      if (!pageMeta[route]) throw new Error("Missing page metadata for route: " + route);
    });
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  validateConfig();
  global.XIB_APP_CONFIG = deepFreeze({
    version: "1.0.0",
    roleLabels,
    orgRoleOptions,
    navigation,
    permissions,
    pageMeta,
    routeIds,
    routeAliases
  });
})(window);
