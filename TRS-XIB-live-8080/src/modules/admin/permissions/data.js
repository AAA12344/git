(function defineAdminPermissionsData(global) {
  "use strict";

  const adminRoles = [
    { id: 0, name: "超级管理员", desc: "全行所有用户账号管理 + 普通管理员配置/管理 + 参数配置", orgScope: "总行消保部", time: "2026-06-01 08:00", status: "正常", menuPerms: { "后台管理": { checked: true, children: { "机构管理": true, "用户管理": true, "权限管理": true, "参数配置": true, "表单配置": true, "定时任务": true, "消息通知": true, "系统操作日志": true } } }, ops: { add: true, delete: true, edit: true, query: true, export: true } },
    { id: 1, name: "普通管理员", desc: "本行/本机构用户账号的创建、修改、查询、删除及权限设置", orgScope: "总行消保部/分行消保部", time: "2026-06-15 10:30", status: "正常", menuPerms: { "后台管理": { checked: false, indeterminate: true, children: { "机构管理": false, "用户管理": true, "权限管理": true, "参数配置": false, "表单配置": false, "定时任务": false, "消息通知": true, "系统操作日志": true } } }, ops: { add: false, delete: false, edit: true, query: true, export: false } }
  ];

  const businessRoles = [
    { id: "operator-service", name: "经办员", subtype: "客服中心", position: "创建客服中心渠道受理的3类主流程", mainFlow: "投诉/表扬/建议", subCount: 3, scope: "全渠道+本中心", queryScope: "全渠道查询 + 客服中心创建记录", exportScope: "无", menus: ["工单录入", "工单查询"], ops: { add: true, delete: false, edit: false, query: true, export: false, isReadonly: true, create: true, review: false, process: false, countersign: false, firstReview: false, approve: false, supplement: false }, limits: ["不可导出", "不可处理他人工单", "子单类型需按关联投诉单归属和状态二次过滤"], entries: [["工单创建", "新建工单", "工单类型", "角色=经办员（客服中心）", "投诉单、建议单、表扬单", "启用"], ["子单创建", "新建子单", "子单类型", "存在可关联工单", "投诉校正单、撤销投诉单、投诉废止单", "启用"]] },
    { id: "operator-branch", name: "经办员", subtype: "支行", position: "创建5类主流程，发起3类子流程", mainFlow: "投诉/表扬/建议/信访/舆情", subCount: 3, scope: "本支行", queryScope: "流转至本支行处理的各类工单", exportScope: "无", menus: ["工单录入", "工单查询"], ops: { add: true, delete: false, edit: false, query: true, export: false, isReadonly: true, create: true, review: false, process: false, countersign: false, firstReview: false, approve: false, supplement: false }, limits: ["无导出权限", "仅可操作本人草稿", "支行发起工单默认进入支行工单池"], entries: [["工单创建", "新建工单", "工单类型", "角色=经办员（支行）", "投诉单、建议单、表扬单", "启用"], ["子单创建", "新建子单", "子单类型", "存在可关联工单", "投诉校正单、撤销投诉单、投诉废止单", "启用"]] },
    { id: "operator-consumer-branch", name: "经办员", subtype: "分行消保", position: "创建5类主流程，发起9类子流程并承担部分初审", mainFlow: "5类", subCount: 9, scope: "本分行", queryScope: "本分行数据", exportScope: "无", menus: ["工单录入", "工单处理", "工单查询"], ops: { add: true, delete: false, edit: false, query: true, export: false, isReadonly: true, create: true, review: false, process: false, countersign: false, firstReview: true, approve: false, supplement: false }, limits: ["调查、剔除、异常、异议等子流程需初审", "子单枚举按关联单、渠道和流程状态过滤"], entries: [["工单创建", "新建工单", "工单类型", "角色=经办员（分行消保）", "投诉单、建议单、表扬单、信访单", "启用"], ["子单创建", "新建子单", "子单类型", "存在可关联工单", "校正、调查、撤销、问责、剔除、异常、异议、废止等", "启用"]] },
    { id: "operator-consumer-head", name: "经办员", subtype: "总行消保", position: "创建5类主流程，发起8类子流程并承担部分初审", mainFlow: "5类", subCount: 8, scope: "全行", queryScope: "全行数据", exportScope: "无", menus: ["工单录入", "工单处理", "工单查询"], ops: { add: true, delete: false, edit: false, query: true, export: false, isReadonly: true, create: true, review: false, process: false, countersign: false, firstReview: true, approve: false, supplement: false }, limits: ["不发起投诉问责", "调查、剔除、异常、异议等子流程需初审"], entries: [["工单创建", "新建工单", "工单类型", "角色=经办员（总行消保）", "投诉单、建议单、表扬单、信访单", "启用"], ["子单创建", "新建子单", "子单类型", "存在可关联工单", "校正、调查、撤销、剔除、异常、异议、废止等", "启用"]] },
    { id: "reviewer-service", name: "复核员", subtype: "客服中心", position: "复核客服中心创建的主流程和部分子流程", mainFlow: "-", subCount: "2(复核)", scope: "客服中心", queryScope: "客服中心渠道创建的3主2子", exportScope: "无", menus: ["工单审批", "工单查询"], ops: { add: false, delete: false, edit: false, query: true, export: false, isReadonly: true, create: false, review: true, process: false, countersign: false, firstReview: false, approve: false, supplement: false }, limits: ["不可修改原工单", "不可导出", "无任务时工作台为空"], entries: [] },
    { id: "processor", name: "处理员", subtype: "总行/分行/支行", position: "处理主流程，发起处理阶段子流程", mainFlow: "5类", subCount: 8, scope: "本部门/本分行/本支行", queryScope: "本部门/本分行/本支行处理数据", exportScope: "可导出授权范围内处理数据", menus: ["工单处理", "工单查询", "工单导出", "报告中心"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: true, countersign: true, firstReview: false, approve: false, supplement: true }, limits: ["非本人处理中工单只读", "下辖机构池工单不得直接领取", "待补录仅适用于指定子单类型"], entries: [["子单创建/工单详情", "新建子单/发起子流程", "子单类型", "当前工单允许发起子流程", "校正、延长、问责、剔除、异常、纠纷化解、废止", "启用"]] },
    { id: "approver-branch", name: "审批员", subtype: "分行消保", position: "主流程、子流程和溯源整改审批", mainFlow: "5类", subCount: 10, scope: "本分行", queryScope: "本分行数据", exportScope: "可导出本分行数据", menus: ["工单审批", "工单查询", "工单导出", "溯源整改"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: false, countersign: true, firstReview: true, approve: true, supplement: false }, limits: ["会签与初审共用审批工作台", "不同流程进入条件不同", "审批通过后部分子单进入待补录"], entries: [] },
    { id: "approver-head-dept", name: "审批员", subtype: "总行部门", position: "审批本部门处理的主流程，并对信访和溯源整改进行初审", mainFlow: "5类+信访初审", subCount: 4, scope: "本部门", queryScope: "本部门处理数据", exportScope: "可导出本部门处理数据", menus: ["工单审批", "工单查询", "工单导出", "溯源整改"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: false, countersign: true, firstReview: true, approve: true, supplement: false }, limits: ["仅审批或初审流转至本部门的任务", "不得修改处理结果"], entries: [] },
    { id: "approver-branch-dept", name: "审批员", subtype: "分行部门/支行", position: "对信访工单和溯源整改单进行初审", mainFlow: "信访初审+溯源初审", subCount: 0, scope: "本部门/支行", queryScope: "本部门/本支行数据", exportScope: "可导出本部门/本支行数据", menus: ["工单审批", "工单查询", "工单导出", "溯源整改"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: false, countersign: false, firstReview: true, approve: false, supplement: false }, limits: ["仅在流程派发初审任务时可操作", "无审批终审权限"], entries: [] },
    { id: "approver-head-consumer", name: "审批员", subtype: "总行消保", position: "审批总行消保口径的信访和子流程任务", mainFlow: "5类", subCount: 10, scope: "全行", queryScope: "全行数据", exportScope: "可导出全行数据", menus: ["工单审批", "工单查询", "工单导出", "溯源整改"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: false, countersign: true, firstReview: false, approve: true, supplement: false }, limits: ["不发起投诉问责", "按总行消保审批任务授权"], entries: [] },
    { id: "approver-branch-lead", name: "审批员", subtype: "分行消保小组组长/副组长", position: "审批本分行处理员发起的延长申请", mainFlow: "延长申请", subCount: "1", scope: "本分行", queryScope: "本分行数据", exportScope: "可导出本分行数据", menus: ["工单审批", "工单查询", "工单导出"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: false, countersign: false, firstReview: false, approve: true, supplement: false }, limits: ["仅处理延长申请审批任务", "不配置溯源整改入口"], entries: [] },
    { id: "approver-head-supervisor", name: "审批员", subtype: "总行消保部主管", position: "信访终审和延长至60日申请进一步审批", mainFlow: "信访终审+延长审批", subCount: "2", scope: "全行", queryScope: "全行数据", exportScope: "可导出全行数据", menus: ["工单审批", "工单查询", "工单导出", "溯源整改"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: false, countersign: false, firstReview: false, approve: true, supplement: false }, limits: ["仅处理主管审批节点", "审批入口由流程条件触发"], entries: [] },
    { id: "business-head", name: "业务员", subtype: "总行消保", position: "统计分析和部分废止初审", mainFlow: "统计分析+废止初审", subCount: "1", scope: "全行", queryScope: "全行数据", exportScope: "可导出全行数据", menus: ["工单查询", "工单导出", "统计分析"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: false, countersign: false, firstReview: true, approve: false, supplement: false }, limits: ["仅对授权任务执行初审", "不得进入工单处理"], entries: [] },
    { id: "business-service", name: "业务员", subtype: "客服中心", position: "统计分析客服中心相关工单", mainFlow: "统计分析", subCount: "0", scope: "全渠道", queryScope: "客服中心相关数据", exportScope: "可导出客服中心相关数据", menus: ["工单查询", "工单导出", "统计分析"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: false, countersign: false, firstReview: false, approve: false, supplement: false }, limits: ["只看客服中心授权范围内数据", "不得进入工单处理"], entries: [] },
    { id: "business-branch", name: "业务员", subtype: "分行消保", position: "统计分析本分行工单，并对投诉废止单进行初审", mainFlow: "统计分析+废止初审", subCount: "1", scope: "本分行", queryScope: "本分行数据", exportScope: "可导出本分行数据", menus: ["工单审批", "工单查询", "工单导出", "统计分析"], ops: { add: false, delete: false, edit: false, query: true, export: true, isReadonly: true, create: false, review: false, process: false, countersign: false, firstReview: true, approve: false, supplement: false }, limits: ["仅对投诉废止单初审", "统计口径限本分行"], entries: [] },
    { id: "query-head", name: "查询员", subtype: "总行", position: "新增角色样例：查询全行投诉管理授权范围内数据", mainFlow: "查询", subCount: "0", scope: "全行", queryScope: "全行数据", exportScope: "无", custom: true, menus: ["工单查询"], ops: { add: false, delete: true, edit: true, query: true, export: false, isReadonly: false, create: false, review: false, process: false, countersign: false, firstReview: false, approve: false, supplement: false }, limits: ["新增角色样例，可编辑权限、停用或删除", "默认无导出权限"], entries: [] },
    { id: "query-branch", name: "查询员", subtype: "分行", position: "新增角色样例：查询本分行及下辖投诉管理授权范围内数据", mainFlow: "查询", subCount: "0", scope: "分行及下辖", queryScope: "分行及下辖数据", exportScope: "无", custom: true, menus: ["工单查询"], ops: { add: false, delete: true, edit: true, query: true, export: false, isReadonly: false, create: false, review: false, process: false, countersign: false, firstReview: false, approve: false, supplement: false }, limits: ["新增角色样例，可编辑权限、停用或删除", "默认无导出权限"], entries: [] }
  ];

  const baseRoleNames = ["经办员", "复核员", "处理员", "审批员", "业务员"];

  const orgLevels = [
    { id: "head-consumer", label: "总行消保部", workOrderScope: "总行（业务部门+消保部）", downstreamScope: "分行及下辖", statisticsScope: "01全行", queryScope: "01全行", exportScope: "01全行" },
    { id: "head-dept", label: "总行业务部门", workOrderScope: "本业务部门", downstreamScope: "分行业务部门", statisticsScope: "03本部室", queryScope: "03本部室", exportScope: "03本部室" },
    { id: "branch-consumer", label: "分行消保部", workOrderScope: "分行（业务部门+消保部）", downstreamScope: "下辖支行", statisticsScope: "02分行及下辖", queryScope: "02分行及下辖", exportScope: "02分行及下辖" },
    { id: "branch-dept", label: "分行业务部门", workOrderScope: "本业务部门", downstreamScope: "下辖支行", statisticsScope: "03本部室", queryScope: "03本部室", exportScope: "03本部室" },
    { id: "branch-unit", label: "支行", workOrderScope: "本支行", downstreamScope: "-", statisticsScope: "04本支行", queryScope: "04本支行", exportScope: "04本支行" },
    { id: "service-center", label: "客服中心", workOrderScope: "客服中心", downstreamScope: "-", statisticsScope: "03本部室", queryScope: "01全行", exportScope: "03本部室" }
  ].map(level => ({ ...level, dataScope: [level.statisticsScope, level.queryScope, level.exportScope] }));

  const roleLevelMap = {
    "经办员": ["head-consumer", "branch-consumer", "branch-unit", "service-center"],
    "复核员": ["service-center"],
    "处理员": ["head-consumer", "head-dept", "branch-consumer", "branch-dept", "branch-unit", "service-center"],
    "审批员": ["head-consumer", "head-dept", "branch-consumer", "branch-dept", "branch-unit"],
    "业务员": ["head-consumer", "head-dept", "branch-consumer", "branch-unit", "service-center"],
    "查询员": ["head-consumer", "branch-consumer", "branch-dept", "branch-unit"]
  };

  const dataPermissionModules = [
    { module: "审批中心", page: "审批管理", menuPath: "投诉管理 / 审批管理", scopeType: "query" },
    { module: "投诉管理", page: "查询导出", menuPath: "投诉管理 / 查询导出", scopeType: "query" },
    { module: "投诉管理", page: "报表管理", menuPath: "投诉管理 / 报表管理", scopeType: "statistics" },
    { module: "后台管理", page: "用户管理", menuPath: "后台管理 / 用户管理", scopeType: "admin" },
    { module: "后台管理", page: "表单配置", menuPath: "后台管理 / 表单配置", scopeType: "admin" },
    { module: "后台管理", page: "流程管理", menuPath: "后台管理 / 权限管理", scopeType: "admin" },
    { module: "统计中心", page: "投诉统计分析", menuPath: "统计分析 / 投诉统计分析", scopeType: "statistics" },
    { module: "统计中心", page: "信访统计分析", menuPath: "统计分析 / 信访统计分析", scopeType: "statistics" },
    { module: "报告中心", page: "报告中心", menuPath: "报告中心", scopeType: "export" }
  ];

  const roleUserIds = {
    "operator-service": ["linh"],
    "operator-branch": ["zhangw"],
    "operator-consumer-branch": ["chenj", "may"],
    "operator-consumer-head": ["guanlq"],
    "reviewer-service": ["liming"],
    "processor": ["wangf", "zhaox", "wul"],
    "approver-branch": ["huangy"],
    "approver-head-dept": ["liming"],
    "approver-branch-dept": ["zhouj"],
    "approver-head-consumer": ["guanlq"],
    "approver-branch-lead": ["huangy"],
    "approver-head-supervisor": ["xieb"],
    "business-service": ["linh"],
    "business-branch": ["zhengy"],
    "business-head": ["guanlq"],
    "query-head": ["guanlq"],
    "query-branch": ["chenj"]
  };

  const processorRows = [
    { subtype: "总行消保", queryScope: "总行消保授权数据" },
    { subtype: "分行消保", queryScope: "分行消保授权数据" },
    { subtype: "总行部门", queryScope: "本部门" },
    { subtype: "分行部门", queryScope: "本分行/本部门" },
    { subtype: "支行", queryScope: "本支行" },
    { subtype: "客服中心", queryScope: "客服中心" }
  ];

  const freezeRole = role => Object.freeze({
    ...role,
    menus: Object.freeze([].concat(role.menus || [])),
    limits: Object.freeze([].concat(role.limits || [])),
    entries: Object.freeze((role.entries || []).map(entry => Object.freeze([...entry]))),
    ops: Object.freeze({ ...role.ops })
  });
  global.XIB_ADMIN_PERMISSIONS_DATA = Object.freeze({
    adminRoles: Object.freeze(adminRoles.map(freezeRole)),
    businessRoles: Object.freeze(businessRoles.map(freezeRole)),
    reviewRoles: Object.freeze([]),
    baseRoleNames: Object.freeze(baseRoleNames),
    orgLevels: Object.freeze(orgLevels.map(level => Object.freeze({ ...level, dataScope: Object.freeze([...level.dataScope]) }))),
    roleLevelMap: Object.freeze(Object.fromEntries(Object.entries(roleLevelMap).map(([roleName, levelIds]) => [roleName, Object.freeze([...levelIds])]))),
    dataPermissionModules: Object.freeze(dataPermissionModules.map(item => Object.freeze({ ...item }))),
    roleUserIds: Object.freeze(Object.fromEntries(Object.entries(roleUserIds).map(([roleId, accounts]) => [roleId, Object.freeze([...accounts])]))),
    processorRows: Object.freeze(processorRows.map(row => Object.freeze({ ...row })))
  });
})(window);
