(function defineComplaintWorkPool(global) {
  "use strict";

  const prototypeConfig = global.XIB_PROTOTYPE_CONFIG;
  const config = prototypeConfig?.seedData?.runtimeDefaults?.workPool;
  const organizationRecords = (prototypeConfig?.organizationTree?.organizations || []).filter(record => record.status !== "停用");
  const organizationById = new Map(organizationRecords.map(record => [record.id, record]));
  const parentInstitutionByName = new Map([
    ...organizationRecords.filter(record => record.type === "304903").map(record => [record.name, "总行"]),
    ...organizationRecords.filter(record => record.type === "304905").map(record => [record.name, organizationById.get(record.parentId)?.name]).filter(([, parent]) => parent)
  ]);
  if (!config?.identities || !config?.assignments || !organizationRecords.length) {
    throw new Error("Complaint work-pool assignments must load before complaint modules.");
  }

  const CLOSED_STATUSES = new Set(["已办结", "已废止"]);
  const assignments = JSON.parse(JSON.stringify(config.assignments));
  const STATUS_ROLES = Object.freeze({
    "草稿": "operator", "待提交": "operator", "问题待提交": "operator",
    "待处理": "handler", "处理中": "handler", "待补录": "handler", "待补充": "handler", "方案待提交": "handler", "整改中": "handler",
    "待复核": "reviewer", "复核中": "reviewer",
    "会签中": "approver", "待初审": "approver", "初审中": "approver", "待审批": "approver", "审批中": "approver",
    "问题待审核": "approver", "方案待初审": "approver", "方案待审批": "approver", "结果待初审": "approver", "结果待审批": "approver"
  });
  const TASKS = Object.freeze({
    "ticket-process": Object.freeze({
      kind: "ticket",
      roles: Object.freeze(["handler"]),
      todoStatuses: Object.freeze(["处理中"]),
      excludedStatuses: Object.freeze(["草稿", "待提交", "待复核", "复核中"]),
      viewStatuses: Object.freeze({
        workbench: Object.freeze(["处理中", "会签中", "待初审", "初审中", "待审批", "审批中"]),
        org: Object.freeze(["待处理", "处理中", "会签中", "待初审", "初审中", "待审批", "审批中"]),
        subOrg: Object.freeze(["待处理", "处理中", "会签中", "待初审", "初审中", "待审批", "审批中"])
      })
    }),
    "subprocess-process": Object.freeze({
      kind: "subprocess",
      roles: Object.freeze(["handler"]),
      typeRoleOverrides: Object.freeze({ "投诉问责": Object.freeze(["handler", "approver"]) }),
      todoStatuses: Object.freeze(["处理中", "待补录"]),
      excludedStatuses: Object.freeze(["草稿", "待提交", "待复核", "复核中"]),

      viewStatuses: Object.freeze({
        workbench: Object.freeze(["处理中", "待补录", "待初审", "初审中", "待审批", "审批中"]),
        org: Object.freeze(["待处理", "处理中", "待补录", "待初审", "初审中", "待审批", "审批中"]),
        subOrg: Object.freeze(["待处理", "处理中", "待初审", "初审中", "待审批", "审批中"])
      })
    }),
    approval: Object.freeze({
      kinds: Object.freeze(["ticket", "subprocess"]),
      roles: Object.freeze(["reviewer", "approver"]),
      todoStatuses: Object.freeze(["待复核", "复核中", "会签中", "待初审", "初审中", "待审批", "审批中"]),
      todoStatusesByRole: Object.freeze({
        reviewer: Object.freeze(["待复核", "复核中"]),
        approver: Object.freeze(["会签中", "待初审", "初审中", "待审批", "审批中"])
      }),
      allowedStatuses: Object.freeze(["待复核", "复核中", "待处理", "处理中", "会签中", "待初审", "初审中", "待审批", "审批中"]),
      roleViewStatuses: Object.freeze({
        reviewer: Object.freeze({
          workbench: Object.freeze(["待复核", "复核中"]),
          org: Object.freeze(["待复核", "复核中"]),
          subOrg: Object.freeze([])
        }),
        approver: Object.freeze({
          workbench: Object.freeze(["会签中", "待初审", "初审中", "待审批", "审批中"]),
          org: Object.freeze(["待处理", "处理中", "待初审", "初审中", "待审批", "审批中"]),
          subOrg: Object.freeze(["待处理", "处理中", "待初审", "初审中", "待审批", "审批中"])
        })
      })
    }),
    "rectification-create": Object.freeze({
      kind: "rectification",
      roles: Object.freeze(["operator"]),
      todoStatuses: Object.freeze(["草稿", "问题待提交"])
    }),
    "rectification-process": Object.freeze({
      kind: "rectification",
      roles: Object.freeze(["handler"]),
      todoStatuses: Object.freeze(["方案待提交", "整改中"])
    }),
    "rectification-approve": Object.freeze({
      kind: "rectification",
      roles: Object.freeze(["approver"]),
      todoStatuses: Object.freeze(["问题待审核", "方案待初审", "方案待审批", "结果待初审", "结果待审批"])
    })
  });

  function taskDefinition(task) {
    const definition = TASKS[task];
    if (!definition) throw new Error("Unknown complaint work-pool task: " + task);
    return definition;
  }

  function rowKind(row, definition, options) {
    if (definition.kind) return definition.kind;
    const kind = options?.kindForRow?.(row);
    if (!definition.kinds.includes(kind)) throw new Error("Unsupported work-pool row kind: " + kind);
    return kind;
  }

  function rowMeta(row, task, options = {}) {
    const definition = taskDefinition(task);
    const kind = rowKind(row, definition, options);
    const id = String(row[options.idIndex ?? 0] || "");
    const status = String(row[options.statusIndex ?? 5] || "");
    const rawOrganization = String(row[options.orgIndex ?? 4] || "");
    if (!assignments[kind]) assignments[kind] = {};
    const assignment = assignments[kind][id] || (assignments[kind][id] = { assignee: "", participants: [] });
    return {
      row,
      kind,
      id,
      status,
      organization: rawOrganization,
      assignment,
      definition,
      requestedRole: options.role || ""
    };
  }

  function effectiveRoles(meta) {
    const override = meta.definition.typeRoleOverrides?.[String(meta.row?.[1] || "")];
    if (override?.length) return override;
    if (meta.requestedRole && meta.definition.roles.includes(meta.requestedRole)) return [meta.requestedRole];
    return meta.definition.roles;
  }

  function actorsFor(meta) {
    return effectiveRoles(meta).map(role => config.identities[role]?.actor).filter(Boolean);
  }

  function currentOrganization(meta) {
    const organizations = effectiveRoles(meta).map(role => config.identities[role]?.organization).filter(Boolean);
    const unique = [...new Set(organizations)];
    if (unique.length !== 1) throw new Error("Task roles must share one development organization.");
    return unique[0];
  }

  function eligible(meta) {
    if (!meta || CLOSED_STATUSES.has(meta.status)) return false;
    if (meta.definition.allowedStatuses && !meta.definition.allowedStatuses.includes(meta.status)) return false;
    if (meta.definition.excludedStatuses?.includes(meta.status)) return false;
    return true;
  }

  function mine(meta) {
    const actors = actorsFor(meta);
    return actors.some(actor => meta.assignment.assignee === actor || (meta.assignment.participants || []).includes(actor));
  }

  function todo(meta) {
    const statuses = meta.definition.todoStatusesByRole?.[meta.requestedRole] || meta.definition.todoStatuses;
    return statuses.includes(meta.status) && actorsFor(meta).includes(meta.assignment.assignee);
  }

  function organizationRelation(meta) {
    const current = currentOrganization(meta);
    if (meta.organization === current) return "self";
    let parent = parentInstitutionByName.get(meta.organization);
    while (parent) {
      if (parent === current) return "descendant";
      parent = parentInstitutionByName.get(parent);
    }
    return "outside";
  }

  function rowsFor(rows, request) {
    const view = request.view;
    const tab = request.tab || "all";
    return rows.filter(row => {
      const meta = rowMeta(row, request.task, request);
      if (!eligible(meta)) return false;
      const viewStatuses = meta.definition.roleViewStatuses?.[meta.requestedRole]?.[view] || meta.definition.viewStatuses?.[view];
      if (viewStatuses && !viewStatuses.includes(meta.status)) return false;
      if (meta.definition.workbenchOnlyTypes?.includes(String(row[1] || "")) && view !== "workbench") return false;
      if (view === "workbench") return tab === "todo" ? todo(meta) : mine(meta);
      if (view === "org") return organizationRelation(meta) === "self" && (request.task === "subprocess-process" ? !mine(meta) : true);
      if (view === "subOrg") return organizationRelation(meta) === "descendant";
      throw new Error("Unknown complaint work-pool view: " + view);
    });
  }

  function model(rows, request) {
    const workbenchTodo = rowsFor(rows, { ...request, view: "workbench", tab: "todo" });
    const workbenchAll = rowsFor(rows, { ...request, view: "workbench", tab: "all" });
    const organization = rowsFor(rows, { ...request, view: "org", tab: "all" });
    const subordinate = rowsFor(rows, { ...request, view: "subOrg", tab: "all" });
    return Object.freeze({
      workbenchTodo,
      workbenchAll,
      organization,
      subordinate,
      rows: request.view === "workbench"
        ? (request.tab === "todo" ? workbenchTodo : workbenchAll)
        : request.view === "org" ? organization : subordinate,
      counts: Object.freeze({
        workbench: workbenchAll.length,
        todo: workbenchTodo.length,
        org: organization.length,
        subOrg: subordinate.length
      })
    });
  }

  function identity(role) {
    const value = config.identities[role];
    if (!value) throw new Error("Missing development identity for role: " + role);
    return Object.freeze({ ...value });
  }

  function advance(kind, id, status) {
    const role = STATUS_ROLES[status];
    if (!role) return null;
    if (!assignments[kind]) assignments[kind] = {};
    const actor = identity(role).actor;
    const current = assignments[kind][id] || { assignee: "", participants: [] };
    assignments[kind][id] = {
      assignee: actor,
      participants: [...new Set([...(current.participants || []), current.assignee, actor].filter(Boolean))]
    };
    return Object.freeze({ ...assignments[kind][id], participants: [...assignments[kind][id].participants] });
  }

  function assign(kind, id, actor) {
    const assignee = String(actor || "").trim();
    if (!assignee) throw new Error("A work-pool assignee is required.");
    if (!assignments[kind]) assignments[kind] = {};
    const current = assignments[kind][id] || { assignee: "", participants: [] };
    assignments[kind][id] = {
      assignee,
      participants: [...new Set([...(current.participants || []), current.assignee, assignee].filter(Boolean))]
    };
    return Object.freeze({ ...assignments[kind][id], participants: [...assignments[kind][id].participants] });
  }

  function clearTransferAssignment(kind, id, task, role = "") {
    const definition = taskDefinition(task);
    if (definition.kind !== kind && !definition.kinds?.includes(kind)) throw new Error("Complaint work-pool task does not match document kind.");
    if (!assignments[kind]) assignments[kind] = {};
    const current = assignments[kind][id] || { assignee: "", participants: [] };
    const taskActors = new Set(actorsFor({ definition, requestedRole: role }));
    assignments[kind][id] = {
      assignee: "",
      participants: [...new Set((current.participants || []).filter(actor => !taskActors.has(actor)))]
    };
    return Object.freeze({ ...assignments[kind][id], participants: [...assignments[kind][id].participants] });
  }

  function assignment(kind, id) {
    const current = assignments[kind]?.[id] || { assignee: "", participants: [] };
    return Object.freeze({ assignee: current.assignee || "", participants: [...(current.participants || [])] });
  }

  function serialize() {
    return JSON.parse(JSON.stringify(assignments));
  }

  function hydrate(value) {
    if (!value || typeof value !== "object") return;
    for (const kind of Object.keys(assignments)) {
      assignments[kind] = JSON.parse(JSON.stringify(value[kind] || assignments[kind]));
    }
  }

  global.XIBComplaintWorkPool = Object.freeze({
    tasks: TASKS,
    identity,
    model,
    rowsFor,
    advance,
    assign,
    clearTransferAssignment,
    assignment,
    serialize,
    hydrate
  });
})(window);
