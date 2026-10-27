(function registerAdminOperations(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  if (!registry) throw new Error("XIBModuleRegistry must load before admin-operations.");

  const data = Object.freeze({
    jobs: Object.freeze([
      { name: "智能核查任务", type: "定时执行", cron: "0 8 * * *（每天 08:00）", lastRun: "2026-07-20 08:00:02", status: "运行中" },
      { name: "机构身份信息同步", type: "定时执行", cron: "0 2 * * *（每天 02:00）", lastRun: "2026-07-20 02:00:01", status: "运行中" },
      { name: "投诉数据归档", type: "定时执行", cron: "0 0 1 * *（每月1日）", lastRun: "2026-07-01 00:00:05", status: "运行中" },
      { name: "超时工单统计", type: "定时执行", cron: "0 9 * * *（每天 09:00）", lastRun: "2026-07-20 09:00:03", status: "运行中" },
      { name: "报表邮件推送", type: "定时执行", cron: "0 8 * * 1（每周一）", lastRun: "2026-07-20 08:00:01", status: "运行中" },
      { name: "日志清理", type: "系统维护", cron: "0 3 * * 0（每周日）", lastRun: "2026-07-19 03:00:00", status: "运行中" }
    ]),
    notifications: Object.freeze([
      ...[
        ["22", "未领取自动催办", "即将超时响应（进入工单池24-X小时未领取）", "工单在工单池，未被处理员/审批员及时领取", "待处理", "工单池所有处理员", "1次", "正常催办", "【工/子单类型】响应即将超时", "您的工单池内一条【工单类型】单（编号为【工单编号】）响应时间还剩X小时，即将超时，请尽快处理！", "从【接收时间】开始计算，识别是否有触达客户；时间X（3-5h）超级管理员可配置，适用于全行。", false],
        ["23", "未领取自动催办", "已超时响应（进入工单池24小时未领取）", "工单在工单池，未被处理员/审批员及时领取", "待处理", "工单池所有处理员", "每天", "加急催办", "【工/子单类型】响应已超时", "您的工单池内一条【工单类型】单（编号为【工单编号】）响应已超时，请尽快处理！", "从【接收时间】开始计算，识别是否有触达客户；时间X（3-5h）超级管理员可配置，适用于全行。", false],
        ["24", "即将超期自动催办", "【处置期限】还剩10天，正常催办", "工单在工单池，未被处理员及时领取", "待处理", "工单池所有处理员", "1次", "正常催办", "【工/子单类型】领取即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "", false],
        ["25", "即将超期自动催办", "【处置期限】还剩10天，正常催办", "处理员未及时处理", "处理中", "当前工单处理员", "1次", "正常催办", "【工/子单类型】处理即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "", false],
        ["26", "即将超期自动催办", "【处置期限】还剩10天，正常催办", "工单在工单池，未被审批员及时领取", "待审批", "工单池所有审批员", "1次", "正常催办", "【工/子单类型】领取即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "", false],
        ["27", "即将超期自动催办", "【处置期限】还剩10天，正常催办", "审批员未及时审批", "审批中", "当前工单审批员", "1次", "正常催办", "【工/子单类型】审批即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "", false],
        ["28", "即将超期自动催办", "【处置期限】还剩3天，加急催办", "工单在工单池，未被处理员及时领取", "待处理", "工单池所有处理员+审批员", "1次", "加急催办", "【工/子单类型】领取即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "加急催办：催处理员+审批员。", false],
        ["29", "即将超期自动催办", "【处置期限】还剩3天，加急催办", "处理员未及时处理", "处理中", "当前工单处理员+审批员", "1次", "加急催办", "【工/子单类型】处理即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "加急催办：催处理员+审批员。", false],
        ["30", "即将超期自动催办", "【处置期限】还剩3天，加急催办", "工单在工单池，未被审批员及时领取", "待审批", "工单池所有审批员", "1次", "加急催办", "【工/子单类型】领取即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "加急催办：催处理员+审批员。", false],
        ["31", "即将超期自动催办", "【处置期限】还剩3天，加急催办", "审批员未及时审批", "审批中", "当前工单审批员", "1次", "加急催办", "【工/子单类型】审批即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "加急催办：催处理员+审批员。", false],
        ["32", "即将超期自动催办", "【处置期限】还剩1天，特急催办并提级催办", "工单在工单池，未被处理员及时领取", "待处理", "工单池所有处理员+审批员", "每天", "特急催办", "【工/子单类型】领取即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "特急催办：催处理员+审批员。", true],
        ["33", "即将超期自动催办", "【处置期限】还剩1天，特急催办并提级催办", "处理员未及时处理", "处理中", "当前工单处理员+审批员", "每天", "特急催办", "【工/子单类型】处理即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "特急催办：催处理员+审批员。", true],
        ["34", "即将超期自动催办", "【处置期限】还剩1天，特急催办并提级催办", "工单在工单池，未被审批员及时领取", "待审批", "工单池所有审批员", "每天", "特急催办", "【工/子单类型】领取即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "特急催办：催处理员+审批员。", true],
        ["35", "即将超期自动催办", "【处置期限】还剩1天，特急催办并提级催办", "审批员未及时审批", "审批中", "当前工单审批员", "每天", "特急催办", "【工/子单类型】审批即将超期", "您的工单池内的 / 您正在处理的一条监管转办工单（编号为【工单编号】）还剩10/3/1天超期，请尽快处理！", "特急催办：催处理员+审批员。", true],
        ["36", "已超期自动催办", "已超期", "工单在工单池，未被处理员及时领取", "待处理", "工单池所有处理员+审批员", "每天", "特急催办", "【工/子单类型】已超期", "您的工单池内的 / 您正在处理的一条【工单类型】单（编号为【工单编号】）已超期，请尽快处理！", "特急催办：催处理员+审批员。", false],
        ["37", "已超期自动催办", "已超期", "处理员未及时处理", "处理中", "当前工单处理员+审批员", "每天", "特急催办", "【工/子单类型】已超期", "您的工单池内的 / 您正在处理的一条【工单类型】单（编号为【工单编号】）已超期，请尽快处理！", "特急催办：催处理员+审批员。", false],
        ["38", "已超期自动催办", "已超期", "工单在工单池，未被审批员及时领取", "待审批", "工单池所有审批员", "每天", "特急催办", "【工/子单类型】已超期", "您的工单池内的 / 您正在处理的一条【工单类型】单（编号为【工单编号】）已超期，请尽快处理！", "特急催办：催处理员+审批员。", false],
        ["39", "已超期自动催办", "已超期", "审批员未及时审批", "审批中", "当前工单审批员", "每天", "特急催办", "【工/子单类型】已超期", "您的工单池内的 / 您正在处理的一条【工单类型】单（编号为【工单编号】）已超期，请尽快处理！", "特急催办：催处理员+审批员。", false]
      ].map(([row, scenario, node, trigger, statusChange, role, frequency, type, title, content, note, popup]) => {
        const sheetRow = String(Number(row) + 1);
        return Object.freeze({
        id: "sheet-row-" + sheetRow,
        row: sheetRow,
        title,
        scenario,
        node,
        trigger,
        statusChange,
        type,
        role,
        frequency,
        content,
        note,
        configurable: true,
        responseHours: row === "22" ? 4 : "",
        hourRange: row === "22" ? "3-5" : "",
        mail: true,
        unifiedAuth: true,
        todo: true,
        popup,
        status: true,
        time: "2026-08-12 16:27",
        ruleUnit: row === "22" || row === "23" ? "小时" : "天",
        ruleDistance: row === "22" ? 4 : row === "23" ? 24 : Number(node.match(/还剩(\d+)天/)?.[1] || 0),
        ruleFrequency: Number(frequency.match(/\d+/)?.[0] || 1),
        dictionaryExamples: row === "22" || row === "23"
          ? ["投诉单", "信访单", "表扬单", "建议单", "舆情单"]
          : ["投诉单", "信访单"],
        titleExample: title.replace(/【工\/子单类型】/g, row === "22" || row === "23" ? "投诉单" : "投诉子流程单"),
        contentExample: content
          .replace(/【工单类型】/g, row === "22" || row === "23" || Number(row) >= 36 ? "投诉单" : "监管转办工单")
          .replace(/【工单编号】/g, "TS202607230012")
          .replace(/X小时/g, "4小时")
      });
      })
    ]),
    auditLogs: Object.freeze([
      { time: "2026-07-21 10:30:00", module: "表单配置", type: "修改", target: "投诉单-投诉事项", before: "14项", after: "15项", operator: "陈敏慧", detail: "新增枚举值\"账户管控\"", tag: "config" },
      { time: "2026-07-21 09:15:00", module: "权限管理", type: "修改", target: "投诉处理员", before: "3个菜单", after: "4个菜单", operator: "系统管理员", detail: "新增\"消息通知\"权限", tag: "perm" },
      { time: "2026-07-20 16:40:00", module: "参数配置", type: "删除", target: "导出台账", before: "-", after: "-", operator: "系统管理员", detail: "移除导出台账功能", tag: "config" },
      { time: "2026-07-20 14:30:00", module: "机构管理", type: "修改", target: "厦门分行", before: "10人", after: "12人", operator: "林海", detail: "更新人员数量", tag: "config" },
      { time: "2026-07-20 11:00:00", module: "定时任务", type: "新增", target: "每日预警推送", before: "-", after: "每天08:00执行", operator: "王磊", detail: "新增定时任务", tag: "config" },
      { time: "2026-07-19 16:20:00", module: "表单配置", type: "修改", target: "投诉单-业务类型", before: "4项", after: "5项", operator: "陈敏慧", detail: "新增\"代理销售\"", tag: "config" },
      { time: "2026-07-19 14:10:00", module: "权限管理", type: "新增", target: "信访处理员", before: "-", after: "2个菜单", operator: "系统管理员", detail: "新增角色", tag: "perm" },
      { time: "2026-07-19 10:00:00", module: "机构管理", type: "新增", target: "泉州分行", before: "-", after: "8人", operator: "林海", detail: "新增机构", tag: "config" },
      { time: "2026-07-18 15:30:00", module: "用户管理", type: "导入", target: "批量导入用户", before: "-", after: "150人", operator: "上游系统", detail: "从HR系统导入", tag: "data-import" },
      { time: "2026-07-18 09:00:00", module: "消息通知", type: "修改", target: "投诉预警模板", before: "旧模板", after: "新模板", operator: "陈敏慧", detail: "更新通知模板", tag: "config" },
      { time: "2026-07-17 14:00:00", module: "参数配置", type: "修改", target: "预警阈值", before: "原阈值", after: "新阈值", operator: "王磊", detail: "调整工单总量预警参数", tag: "config" },
      { time: "2026-07-17 10:30:00", module: "权限管理", type: "删除", target: "临时测试角色", before: "1个菜单", after: "-", operator: "系统管理员", detail: "删除测试角色", tag: "perm" },
      { time: "2026-07-16 16:00:00", module: "表单配置", type: "修改", target: "异常投诉-异常投诉类型", before: "2项", after: "3项", operator: "王磊", detail: "新增\"三、存在其他异常情形\"", tag: "config" },
      { time: "2026-07-16 11:20:00", module: "定时任务", type: "修改", target: "数据备份", before: "每天22:00", after: "每天23:00", operator: "系统管理员", detail: "调整执行时间", tag: "config" },
      { time: "2026-07-15 09:00:00", module: "机构管理", type: "删除", target: "鼓浪屿临时网点", before: "2人", after: "-", operator: "林海", detail: "撤销临时网点", tag: "config" }
    ])
  });

  const moduleState = { auditTab: "complaint", notificationTemplateMode: "", notificationTemplateId: "", notificationFilters:{ keyword:"", type:"全部", status:"全部" } };
  const complaintMessageStorageKey = "xib-admin-complaint-message-nodes-v4";
  const complaintMessageTypeOptions = Object.freeze(["正常催办", "加急催办", "特急催办"]);
  const complaintMessageFrequencyOptions = Object.freeze(["1次", "每天"]);
  const complaintNotificationTemplateDefaults = [
    ["待办提醒", "【工/子单类型】草稿待完善", "创建", "客服系统中创建该工单的经办员", "2026-10-14 07:43"],
    ["待办提醒", "【工/子单类型】待复核", "待复核", "工单池所有复核员", "2026-10-14 07:43"],
    ["审批结果", "【工/子单类型】复核被驳回", "复核审批驳回", "客服系统中创建该工单的经办员", "2026-10-14 07:43"],
    ["待办提醒", "【工/子单类型】待处理", "提交并派发", "工单池所有处理员", "2026-10-14 07:43"],
    ["待办提醒", "【工/子单类型】待处理", "提交并派发", "工单池所有处理员", "2026-10-14 07:43"],
    ["消息通知", "下辖【工/子单类型】待处理", "派发抄送", "抄送人", "2026-10-14 07:43"],
    ["待办提醒", "【工/子单类型】待处理", "待处理", "工单池所有处理员", "2026-10-14 07:43"],
    ["待办提醒", "短信发送失败", "短信发送失败", "短信发送人", "2026-09-05 04:13"],
    ["待办提醒", "短信审批待处理", "短信待审批", "工单池所有审批员", "2026-09-05 04:13"],
    ["审批结果", "短信审批被驳回", "短信审批驳回", "当前工单处理员", "2026-09-05 04:13"]
  ].map((item, index) => ({ id:"complaint-template-" + (index + 1), type:item[0], name:item[1], module:"投诉管理", trigger:item[2], role:item[3], updatedAt:item[4], status:"启用", messageTitle:item[1], messageContent:"您有一条" + item[1].replace(/[【】]/g, "") + "消息，请及时处理。", channels:["站内信"] }));
  const notificationTemplateStorageKey = "xib-admin-notification-templates-v1";
  function loadNotificationTemplates() {
    try {
      const stored = JSON.parse(global.localStorage?.getItem(notificationTemplateStorageKey) || "null");
      if (Array.isArray(stored) && stored.length) return stored;
    } catch (_) {}
    return complaintNotificationTemplateDefaults.map(item => ({ ...item, channels:[...item.channels] }));
  }
  let complaintNotificationTemplates = loadNotificationTemplates();
  function persistNotificationTemplates() { global.localStorage?.setItem(notificationTemplateStorageKey, JSON.stringify(complaintNotificationTemplates)); }
  function timestampNow(date = new Date()) {
    const pad = value => String(value).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }
  const notificationTemplateStore = Object.freeze({
    list:() => complaintNotificationTemplates.map(item => ({ ...item, channels:[...(item.channels || [])] })),
    get:id => {
      const item = complaintNotificationTemplates.find(template => template.id === id);
      return item ? { ...item, channels:[...(item.channels || [])] } : null;
    },
    search(filters = {}) {
      const keyword = String(filters.keyword || "").trim().toLowerCase();
      return notificationTemplateStore.list().filter(item => (!keyword || [item.id, item.name, item.trigger].some(value => String(value).toLowerCase().includes(keyword))) && (!filters.type || filters.type === "全部" || item.type === filters.type) && (!filters.status || filters.status === "全部" || item.status === filters.status));
    },
    create(input) {
      if (!String(input?.name || "").trim()) throw new Error("模板名称不能为空");
      const numericIds = complaintNotificationTemplates.map(item => Number(String(item.id).replace(/\D/g, "")) || 0);
      const item = { id:"complaint-template-" + (Math.max(0, ...numericIds) + 1), type:input.type || "待办提醒", name:String(input.name).trim(), module:"投诉管理", trigger:String(input.trigger || "").trim(), role:String(input.role || "").trim(), updatedAt:timestampNow(), status:input.status === "停用" ? "停用" : "启用", messageTitle:String(input.messageTitle || input.name).trim(), messageContent:String(input.messageContent || "").trim(), channels:Array.isArray(input.channels) && input.channels.length ? [...input.channels] : ["站内信"] };
      complaintNotificationTemplates.push(item);
      persistNotificationTemplates();
      return notificationTemplateStore.get(item.id);
    },
    update(id, input) {
      const item = complaintNotificationTemplates.find(template => template.id === id);
      if (!item) throw new Error("未找到消息模板");
      Object.assign(item, input, { id:item.id, module:"投诉管理", updatedAt:timestampNow() });
      if (!String(item.name || "").trim()) throw new Error("模板名称不能为空");
      persistNotificationTemplates();
      return notificationTemplateStore.get(id);
    },
    toggle(id) {
      const item = complaintNotificationTemplates.find(template => template.id === id);
      if (!item) throw new Error("未找到消息模板");
      item.status = item.status === "启用" ? "停用" : "启用";
      item.updatedAt = timestampNow();
      persistNotificationTemplates();
      return notificationTemplateStore.get(id);
    }
  });
  global.XIBAdminNotificationTemplateStore = notificationTemplateStore;
  const complaintMessageScenes = Object.freeze([
    Object.freeze({
      id:"response-reminder",
      name:"响应提醒",
      nodeHeader:"响应提醒节点",
      unit:"小时",
      description:"进入处理员工单池后，按未领取时长触发响应提醒。",
      initialNodes:Object.freeze([
        Object.freeze({ id:"response-upcoming-default", kind:"upcoming", threshold:3, type:"正常催办", frequency:"1次", escalation:"否", locked:true }),
        Object.freeze({ id:"response-overdue-default", kind:"overdue", threshold:24, type:"加急催办", frequency:"每天", escalation:"否", locked:true })
      ])
    }),
    Object.freeze({
      id:"deadline-reminder",
      name:"超期提醒",
      nodeHeader:"超期提醒节点",
      unit:"天",
      description:"按当前时间与处置期限的距离触发超期提醒。",
      initialNodes:Object.freeze([
        Object.freeze({ id:"deadline-upcoming-default", kind:"upcoming", threshold:10, type:"正常催办", frequency:"1次", escalation:"否", locked:true }),
        Object.freeze({ id:"deadline-upcoming-3-preset", kind:"upcoming", threshold:3, type:"加急催办", frequency:"1次", escalation:"是", locked:false }),
        Object.freeze({ id:"deadline-upcoming-1-preset", kind:"upcoming", threshold:1, type:"特急催办", frequency:"每天", escalation:"是", locked:false }),
        Object.freeze({ id:"deadline-overdue-default", kind:"overdue", threshold:0, type:"特急催办", frequency:"每天", escalation:"是", locked:true })
      ])
    })
  ]);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function tag(text, tone = "blue") {
    const tones = { green: "success", yellow: "warning", red: "danger", gray: "default", blue: "info" };
    return '<span class="ds-tag ds-tag--' + (tones[tone] || tone) + '">' + escapeHtml(text) + "</span>";
  }

  function surface(body) {
    return '<div class="admin-surface">' + body + "</div>";
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

  function filter(items, context) {
    return context.renderFilters(items).replace("filter-panel ticket-filter-panel", "filter-panel ticket-filter-panel admin-filter-panel");
  }

  function jobFormMarkup() {
    const fields = [
      { label:"任务名称", value:"自动催办任务", required:true },
      { label:"任务描述", value:"自动催办定时任务", required:false },
      { label:"定时规则", value:"0 0/10 * * * ?", required:true },
      { label:"类名", value:"eventJobs", required:true },
      { label:"方法名", value:"taskCampaignJob", required:true }
    ];
    return '<form class="admin-job-modal-form" data-admin-job-form>' + fields.map(field => '<label class="admin-job-modal-row"><span class="' + (field.required ? 'required' : '') + '">' + escapeHtml(field.label) + '</span><input class="di-input is-fluid" value="' + escapeHtml(field.value) + '"></label>').join("") + '</form>';
  }

  function openJobForm(context) {
    context.openModal("批量任务", jobFormMarkup(), "提交", () => {
      context.closeOverlay();
      context.toast("定时任务已提交");
    });
  }

  function renderJobs(context) {
    const rows = data.jobs.map(job => [
      escapeHtml(job.name), escapeHtml(job.type), escapeHtml(job.cron), escapeHtml(job.lastRun), context.statusTag(job.status),
      '<div class="table-actions">' + actionButton("执行", "admin-modal", "执行任务") + actionButton("编辑", "admin-job-form", job.name) + actionButton("日志", "admin-modal", "任务日志") + "</div>"
    ]);
    return '<section class="page admin-page xib-module-admin-operations" data-module="admin-operations">' + context.pageHeader("定时任务", "", '<button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-job-form">新增任务</button>') + surface(table(["任务名称", "任务类型", "cron表达式/执行时间", "最近执行时间", "状态", "操作"], rows, "admin-jobs", context)) + "</section>";
  }

  function readComplaintMessageState() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(complaintMessageStorageKey) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function currentScene(sceneId) {
    return complaintMessageScenes.find(scene => scene.id === sceneId) || complaintMessageScenes[0];
  }

  function sortSceneNodes(scene, nodes) {
    return [...nodes].sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "overdue" ? 1 : -1;
      return scene.id === "response-reminder" ? left.threshold - right.threshold : right.threshold - left.threshold;
    });
  }

  function sceneNodes(scene) {
    const stored = readComplaintMessageState()[scene.id]?.nodes;
    if (!Array.isArray(stored) || stored.length < 2) return sortSceneNodes(scene, scene.initialNodes.map(node => ({ ...node })));
    const lockedNodes = scene.initialNodes.filter(node => node.locked);
    const lockedIds = new Set(lockedNodes.map(node => node.id));
    const normalized = stored.filter(node => node && node.id && ["upcoming", "overdue"].includes(node.kind)).map(node => ({ ...node, locked:lockedIds.has(node.id) }));
    for (const lockedNode of lockedNodes) if (!normalized.some(node => node.id === lockedNode.id)) normalized.push({ ...lockedNode });
    return sortSceneNodes(scene, normalized);
  }

  function persistSceneNodes(scene, nodes) {
    const state = readComplaintMessageState();
    state[scene.id] = {
      nodes:sortSceneNodes(scene, nodes),
      updatedAt:new Date().toLocaleString("sv-SE").replace("T", " ").slice(0, 16)
    };
    global.localStorage?.setItem(complaintMessageStorageKey, JSON.stringify(state));
  }

  function reminderTypeMarkup(type) {
    const tones = { "正常催办":"normal-reminder", "加急催办":"urgent-reminder", "特急催办":"critical-reminder" };
    return '<em class="notification-type is-' + (tones[type] || "normal-reminder") + '">' + escapeHtml(type) + '</em>';
  }

  function escalationMarkup(value) {
    const escalated = value === "是";
    return '<span class="ds-tag ds-tag--' + (escalated ? "danger" : "default") + ' admin-notify-escalation-badge">' + (escalated ? "是" : "否") + '</span>';
  }

  function nodeName(scene, node, upcomingIndex = 1) {
    if (node.kind === "overdue") return scene.id === "response-reminder" ? "已响应超时节点" : "已超期节点";
    return (scene.id === "response-reminder" ? "响应提醒节点" : "超期提醒节点") + upcomingIndex;
  }

  function sceneValueMeaning(scene) {
    if (scene.id === "response-reminder") return '<strong>配置值含义：</strong>响应提醒节点的数值是距 24 小时响应时限尚余的小时数；例如“3”表示进入处理员工单池 21 小时仍未领取时触发。已响应超时节点“24”表示进入工单池满 24 小时仍未领取。';
    return '<strong>配置值含义：</strong>超期提醒节点的数值是距处置期限尚余的自然日数；例如“3”表示处置期限还剩 3 天时触发。“0”表示已经到达或超过处置期限。';
  }

  function notificationTemplate(scene, node) {
    if (scene.id === "response-reminder") {
      return node.kind === "overdue"
        ? { title:"【工/子单类型】响应已超时", content:"您的工单池内一条【工单类型】单（编号为【工单编号】）响应已超时，请尽快处理！" }
        : { title:"【工/子单类型】响应即将超时", content:"您的工单池内一条【工单类型】单（编号为【工单编号】）响应时间还剩" + node.threshold + "小时，即将超时，请尽快处理！" };
    }
    return node.kind === "overdue"
      ? { title:"【工/子单类型】已超期", content:"您的工单池内的 / 您正在处理的一条【工单类型】单（编号为【工单编号】）已超期，请尽快处理！" }
      : { title:"【工/子单类型】领取/处理/审批即将超期", content:"您的工单池内的 / 您正在处理的一条【工单类型】单（编号为【工单编号】）还剩" + node.threshold + "天超期，请尽快处理！" };
  }

  function notificationSceneTable(scene) {
    const nodes = sceneNodes(scene);
    let upcomingIndex = 0;
    const rows = nodes.map(node => {
      if (node.kind === "upcoming") upcomingIndex += 1;
      const name = nodeName(scene, node, upcomingIndex);
      const deleteAction = node.locked ? '<span class="admin-notify-unavailable-action">-</span>' : '<button type="button" class="btn-link admin-action-danger" data-action="admin-notify-node-delete" data-id="' + escapeHtml(scene.id + ":" + node.id) + '">删除</button>';
      const operations = '<div class="table-actions admin-notify-node-actions">' + actionButton("编辑", "admin-notify-node-edit", scene.id + ":" + node.id) + deleteAction + actionButton("查看", "admin-notify-node-view", scene.id + ":" + node.id) + '</div>';
      return [escapeHtml(name + "（" + scene.unit + "）"), '<strong class="admin-notify-config-value">' + escapeHtml(node.threshold) + '</strong>', reminderTypeMarkup(node.type), escapeHtml(node.frequency), escalationMarkup(node.escalation), operations];
    });
    const headers = [scene.nodeHeader, "配置值", "消息类型", "频率", "是否提级催办", "操作"];
    const tableHtml = '<div class="table-wrap admin-table-wrap admin-notify-node-table-wrap"><table class="table ds-table admin-notify-node-table"><thead><tr>' + headers.map(header => '<th>' + escapeHtml(header) + '</th>').join("") + '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join("") + '</tr>').join("") + '</tbody></table></div>';
    return '<section class="panel admin-notify-scene" data-notify-scene="' + escapeHtml(scene.id) + '"><div class="panel-head admin-notify-scene-head"><div><span class="panel-title">' + escapeHtml(scene.name) + '</span><small>' + escapeHtml(scene.description) + '</small></div><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-notify-node-add" data-id="' + escapeHtml(scene.id) + '">新增节点</button></div><div class="admin-notify-value-meaning">' + sceneValueMeaning(scene) + '</div><div class="admin-notify-scene-body">' + tableHtml + '</div></section>';
  }

  function notificationTypeTag(type) {
    const tone = type === "审批结果" ? "yellow" : type === "消息通知" ? "blue" : "green";
    return tag(type, tone);
  }

  function notificationField(label, control, options = {}) {
    const span = options.full ? " span-2" : "";
    return '<div class="form-item' + span + '"><label class="form-label' + (options.required ? ' required' : '') + '">' + label + '</label><div class="form-control">' + control + '</div></div>';
  }

  function renderNotificationTemplatePage(context) {
    const mode = moduleState.notificationTemplateMode || "create";
    const template = notificationTemplateStore.get(moduleState.notificationTemplateId);
    const readonly = mode === "view";
    const item = template || { type:"", name:"", trigger:"", role:"", messageTitle:"", messageContent:"", channels:["站内信"] };
    const title = mode === "create" ? "新增模板" : readonly ? "查看模板" : "编辑模板";
    const readonlyAttr = readonly ? ' readonly aria-readonly="true"' : '';
    const disabledAttr = readonly ? ' disabled aria-disabled="true"' : '';
    const code = template ? "CWO_" + template.id.replace("complaint-template-", "TEMPLATE_").toUpperCase() : "";
    const messageTitle = item.messageTitle || "";
    const messageContent = item.messageContent || "";
    const input = (value, placeholder = "", extra = "") => '<input class="di-input is-fluid" value="' + escapeHtml(value) + '" placeholder="' + escapeHtml(placeholder) + '"' + readonlyAttr + extra + '>';
    const info = '<section class="panel admin-notification-editor-panel"><div class="panel-head"><span class="panel-title">通知信息</span></div><div class="panel-body"><div class="form-grid admin-notification-editor-grid">' +
      notificationField("模板编码", input(code, "系统自动生成", ' data-admin-notification-code readonly aria-readonly="true"'), { required:true }) +
      notificationField("模板名称", input(item.name, "", " data-admin-notification-name"), { required:true }) +
      notificationField("业务模块", '<select class="di-native-select" disabled aria-disabled="true"><option>投诉管理(CWO)</option></select>', { required:true }) +
      notificationField("提醒类型", selectControl(["请选择", "待办提醒", "审批结果", "消息通知"], item.type || "请选择", "data-admin-notification-type", readonly), { required:true }) +
      notificationField("触发节点", input(item.trigger, "如：即将超时响应（进入工单池24小时未领取）", " data-admin-notification-trigger"), { full:true }) +
      notificationField("适用条件", input(""), { full:true }) +
      notificationField("触发前状态", input("")) +
      notificationField("触发后状态", input("")) +
      notificationField("通知角色", input(item.role, "如：工单池所有处理员", " data-admin-notification-role"), { full:true }) +
      notificationField("频率说明", input("")) +
    '</div></div></section>';
    const channels = '<div class="admin-notification-channels">' + ["站内信", "邮件", "统一认证平台提示", "企业微信"].map(channel => '<label><input type="checkbox" value="' + escapeHtml(channel) + '" data-admin-notification-channel' + ((item.channels || []).includes(channel) ? ' checked' : '') + disabledAttr + '> ' + channel + '</label>').join("") + '</div>';
    const templatePanel = '<section class="panel admin-notification-editor-panel"><div class="panel-head"><span class="panel-title">通知模板</span></div><div class="panel-body"><div class="form-grid admin-notification-editor-grid">' +
      notificationField("消息标题", input(messageTitle, "", " data-admin-notification-message-title"), { required:true, full:true }) +
      notificationField("消息内容", '<textarea class="di-textarea is-fluid" rows="4" data-admin-notification-message-content' + readonlyAttr + '>' + escapeHtml(messageContent) + '</textarea>', { required:true, full:true }) +
      notificationField("发送渠道", channels, { full:true }) +
    '</div></div></section>';
    const actions = '<button class="btn xib-btn xib-btn--secondary" data-action="admin-notification-template-list">返回列表</button>' + (readonly ? '' : '<button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-notification-template-save">保存配置</button>');
    const header = '<div class="page-header admin-notification-editor-header"><div><h1 class="page-title">' + title + '</h1><p>填写通知信息、通知内容与发送渠道</p></div><div class="page-actions">' + actions + '</div></div>';
    return '<section class="page admin-page xib-module-admin-operations admin-notification-editor-page" data-module="admin-operations" data-notification-template-page="' + mode + '">' + header + '<div class="detail-sections admin-detail-sections">' + info + templatePanel + '</div></section>';
  }

  function renderNotifications(context) {
    if (moduleState.notificationTemplateMode) return renderNotificationTemplatePage(context);
    const currentFilters = moduleState.notificationFilters;
    const filters = '<div class="admin-notification-filterbar">' +
      '<label><span>关键字</span><input class="di-input" placeholder="模板编码/名称/触发节点" value="' + escapeHtml(currentFilters.keyword) + '" data-admin-notification-filter-keyword></label>' +
      '<label><span>提醒类型</span>' + selectControl(["全部", "待办提醒", "审批结果", "消息通知"], currentFilters.type, "data-admin-notification-filter-type", false) + '</label>' +
      '<label><span>状态</span>' + selectControl(["全部", "启用", "停用"], currentFilters.status, "data-admin-notification-filter-status", false) + '</label>' +
      '<div class="admin-notification-filter-actions"><button class="btn xib-btn xib-btn--primary btn-primary" type="button" data-action="admin-notification-filter-search">查询</button><button class="btn xib-btn xib-btn--secondary" type="button" data-action="admin-notification-filter-reset">重置</button></div>' +
    '</div>';
    const visibleTemplates = notificationTemplateStore.search(currentFilters);
    const rows = visibleTemplates.map(item => [
      notificationTypeTag(item.type), escapeHtml(item.name), escapeHtml(item.module), escapeHtml(item.trigger), escapeHtml(item.role), escapeHtml(item.updatedAt), tag(item.status, item.status === "启用" ? "green" : "gray"),
      '<div class="table-actions admin-notification-actions">' + actionButton("查看", "admin-notification-template-view", item.id) + actionButton("编辑", "admin-notification-template-edit", item.id) + '<button type="button" class="btn-link admin-notification-disable" data-action="admin-notification-template-disable" data-id="' + item.id + '">' + (item.status === "启用" ? "停用" : "启用") + '</button></div>'
    ]);
    const headers = ["提醒类型", "模板名称", "业务模块", "触发节点", "通知角色", "更新时间", "状态", "操作"];
    const emptyRow = '<tr><td colspan="8"><div class="empty-state">暂无符合条件的消息模板</div></td></tr>';
    const list = '<div class="table-wrap admin-table-wrap"><table class="ds-table"><thead><tr>' + headers.map(header => '<th>' + header + '</th>').join("") + '</tr></thead><tbody>' + (rows.length ? rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join("") + '</tr>').join("") : emptyRow) + '</tbody></table></div>' + context.renderPagination(visibleTemplates.length, 1, "admin-notify-complaint");
    return '<section class="page admin-page xib-module-admin-operations admin-notification-list-page" data-module="admin-operations">' + context.pageHeader("投诉管理消息通知", "", '<button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-notification-template-create">新增模板</button>') + '<div class="admin-section-note">配置投诉管理流程中的站内消息模板与通知渠道</div>' + surface(filters + list) + '</section>';
  }

  function renderReviewNotifications(context) {
    return '<section class="page admin-page xib-module-admin-operations" data-module="admin-operations">' +
      context.pageHeader("消保审查消息", "维护消保审查消息提示规则") +
      surface('<section class="admin-card-section admin-list-card"><h3>消保审查消息配置</h3><div class="empty-state">暂无配置内容，待后续补充。</div></section>') +
    "</section>";
  }

  function selectControl(options, value, attribute, readonly) {
    return '<select class="di-native-select" ' + attribute + (readonly ? ' disabled aria-disabled="true"' : '') + '>' + options.map(option => '<option value="' + escapeHtml(option) + '" ' + (option === value ? 'selected' : '') + '>' + escapeHtml(option) + '</option>').join('') + '</select>';
  }

  function suggestedThreshold(scene) {
    const existing = new Set(sceneNodes(scene).map(node => Number(node.threshold)));
    const candidates = scene.id === "response-reminder" ? [6, 9, 12, 15, 18, 21] : [3, 1, 5, 7, 2, 4, 6, 8, 9];
    return candidates.find(value => !existing.has(value)) ?? (scene.id === "response-reminder" ? 6 : 1);
  }

  function messageNodeModal(scene, node, readonly) {
    const template = notificationTemplate(scene, node);
    const disabled = readonly ? ' disabled aria-disabled="true"' : '';
    const readonlyAttr = readonly ? ' readonly aria-readonly="true"' : '';
    const valueHint = scene.id === "response-reminder"
      ? (node.kind === "overdue" ? "从进入处理员工单池开始累计；24 表示满 24 小时仍未领取。" : "表示距离 24 小时响应时限尚余的小时数；系统在进入工单池 24−配置值小时后触发。")
      : (node.kind === "overdue" ? "0 表示当前时间已经到达或超过处置期限。" : "表示距离处置期限尚余的自然日数。系统在剩余天数等于配置值时触发。");
    return '<div class="action-dialog admin-notify-node-dialog" data-notify-scene-id="' + escapeHtml(scene.id) + '" data-notify-node-id="' + escapeHtml(node.id) + '"><div class="form-grid admin-notify-node-form">' +
      '<div class="form-item"><label class="form-label required">' + escapeHtml(scene.nodeHeader) + '</label><div class="form-control"><div class="admin-notify-threshold-control"><input class="di-input" type="number" min="0" step="1" value="' + escapeHtml(node.threshold) + '" data-admin-message-threshold' + readonlyAttr + '><span>' + escapeHtml(scene.unit) + '</span></div><small class="field-hint">' + escapeHtml(valueHint) + '</small></div></div>' +
      '<div class="form-item"><label class="form-label required">消息类型</label><div class="form-control">' + selectControl(complaintMessageTypeOptions, node.type, 'data-admin-message-type', readonly) + '</div></div>' +
      '<div class="form-item"><label class="form-label required">频率</label><div class="form-control">' + selectControl(complaintMessageFrequencyOptions, node.frequency, 'data-admin-message-frequency', readonly) + '</div></div>' +
      '<div class="form-item"><label class="form-label required">是否提级催办</label><div class="form-control"><div class="admin-notify-radio-group"><label><input type="radio" name="admin-message-escalation" value="是" data-admin-message-escalation ' + (node.escalation === '是' ? 'checked' : '') + disabled + '> 是</label><label><input type="radio" name="admin-message-escalation" value="否" data-admin-message-escalation ' + (node.escalation !== '是' ? 'checked' : '') + disabled + '> 否</label></div></div></div>' +
      '<div class="form-item span-2"><label class="form-label">通知标题</label><div class="form-control"><input class="di-input is-fluid" value="' + escapeHtml(template.title) + '" data-admin-message-preview-title readonly aria-readonly="true"></div></div>' +
      '<div class="form-item span-2"><label class="form-label">通知内容</label><div class="form-control"><textarea class="di-textarea admin-notify-template-textarea" data-admin-message-preview-content readonly aria-readonly="true">' + escapeHtml(template.content) + '</textarea><small class="field-hint">通知标题与通知内容由系统生成，仅节点数值变化时同步更新剩余时间。</small></div></div>' +
    '</div></div>';
  }

  function validateSceneNodes(scene, nodes) {
    if (new Set(nodes.map(node => Number(node.threshold))).size !== nodes.length) throw new Error("同一场景的提醒节点值不能重复");
    if (nodes.some(node => !Number.isInteger(Number(node.threshold)) || Number(node.threshold) < 0)) throw new Error(scene.nodeHeader + "请输入非负整数");
    const lockedUpcoming = nodes.find(node => node.locked && node.kind === "upcoming");
    const lockedOverdue = nodes.find(node => node.locked && node.kind === "overdue");
    const customNodes = nodes.filter(node => !node.locked);
    if (scene.id === "response-reminder" && customNodes.some(node => node.threshold <= lockedUpcoming.threshold || node.threshold >= lockedOverdue.threshold)) throw new Error("新增节点必须位于即将响应节点和已响应超时节点之间");
    if (scene.id === "deadline-reminder" && customNodes.some(node => node.threshold >= lockedUpcoming.threshold || node.threshold <= lockedOverdue.threshold)) throw new Error("新增节点必须位于即将超期节点和已超期节点之间");
  }

  function openMessageNodeDialog(context, sceneId, nodeId = "", mode = "view") {
    const scene = currentScene(sceneId);
    const nodes = sceneNodes(scene);
    const isAdd = mode === "add";
    const readonly = mode === "view";
    const node = isAdd
      ? { id:scene.id + "-custom-" + Date.now(), kind:"upcoming", threshold:suggestedThreshold(scene), type:scene.id === "response-reminder" ? "加急催办" : "特急催办", frequency:scene.id === "response-reminder" ? "1次" : "每天", escalation:scene.id === "response-reminder" ? "否" : "是", locked:false }
      : nodes.find(item => item.id === nodeId);
    if (!node) return context.toast("未找到提醒节点", true);
    const title = (isAdd ? "新增" : readonly ? "查看" : "编辑") + scene.name + "节点";
    context.openModal(title, messageNodeModal(scene, node, readonly), readonly ? "关闭" : "保存", () => {
      if (readonly) return context.closeOverlay();
      const root = global.document?.querySelector(".admin-notify-node-dialog");
      const thresholdValue = String(root?.querySelector("[data-admin-message-threshold]")?.value ?? "").trim();
      const updated = {
        ...node,
        threshold:Number(thresholdValue),
        type:root?.querySelector("[data-admin-message-type]")?.value || "",
        frequency:root?.querySelector("[data-admin-message-frequency]")?.value || "",
        escalation:root?.querySelector("[data-admin-message-escalation]:checked")?.value || ""
      };
      try {
        if (thresholdValue === "") throw new Error(scene.nodeHeader + "不能为空");
        if (!complaintMessageTypeOptions.includes(updated.type)) throw new Error("请选择消息类型");
        if (!complaintMessageFrequencyOptions.includes(updated.frequency)) throw new Error("请选择频率");
        if (!["是", "否"].includes(updated.escalation)) throw new Error("请选择是否提级催办");
        const nextNodes = isAdd ? [...nodes, updated] : nodes.map(item => item.id === node.id ? updated : item);
        validateSceneNodes(scene, nextNodes);
        persistSceneNodes(scene, nextNodes);
        context.closeOverlay();
        context.rerenderPage(true);
        context.toast(scene.name + "节点已" + (isAdd ? "新增" : "更新"));
      } catch (error) {
        context.toast(error?.message || "提醒节点保存失败", true);
      }
    });
    const root = global.document?.querySelector(".admin-notify-node-dialog");
    const thresholdInput = root?.querySelector("[data-admin-message-threshold]");
    const syncPreview = () => {
      const threshold = Number(thresholdInput?.value);
      const template = notificationTemplate(scene, { ...node, threshold:Number.isFinite(threshold) ? threshold : node.threshold });
      const titleInput = root?.querySelector("[data-admin-message-preview-title]");
      const contentInput = root?.querySelector("[data-admin-message-preview-content]");
      if (titleInput) titleInput.value = template.title;
      if (contentInput) contentInput.value = template.content;
    };
    thresholdInput?.addEventListener("input", syncPreview);
  }

  function deleteMessageNode(context, sceneId, nodeId) {
    const scene = currentScene(sceneId);
    const nodes = sceneNodes(scene);
    const node = nodes.find(item => item.id === nodeId);
    if (!node) return context.toast("未找到提醒节点", true);
    if (node.locked) return context.toast("默认节点不可删除", true);
    context.openModal("删除提醒节点", '<div class="action-dialog"><div class="action-dialog-question"><strong>确认删除该' + escapeHtml(scene.name) + '节点？</strong><span>删除后，该时间点将不再触发提醒。</span></div></div>', "确认删除", () => {
      persistSceneNodes(scene, nodes.filter(item => item.id !== nodeId));
      context.closeOverlay();
      context.rerenderPage(true);
      context.toast(scene.name + "节点已删除");
    });
  }

  const auditUserIds = Object.freeze({ "陈敏慧":"60157", "林海":"38102", "王磊":"40218", "系统管理员":"admin", "上游系统":"HR_SYNC" });
  const auditIpAddresses = Object.freeze({ "陈敏慧":"10.0.16.191", "林海":"10.0.16.185", "王磊":"10.0.16.188", "系统管理员":"10.0.16.180", "上游系统":"10.0.16.10" });
  const auditModulePaths = Object.freeze({
    "机构管理":"/admin/organization",
    "用户管理":"/admin/user",
    "权限管理":"/admin/permission",
    "参数配置":"/admin/complaint-params",
    "表单配置":"/admin/form-config",
    "定时任务":"/admin/scheduled-task",
    "消息通知":"/admin/message-notification"
  });

  function auditInvocation(log, index) {
    const operationPaths = { "新增":"create", "修改":"update", "删除":"delete", "导入":"import" };
    return {
      userId:auditUserIds[log.operator] || log.operator,
      path:(auditModulePaths[log.module] || "/admin/operation") + "/" + (operationPaths[log.type] || "execute"),
      ip:auditIpAddresses[log.operator] || "10.0.16.190",
      status:"成功",
      duration:[46, 32, 63, 50, 85, 28, 41, 57, 126, 38, 44, 31, 69, 52, 35][index % 15],
      time:log.time
    };
  }

  function renderAudit(context) {
    const tab = moduleState.auditTab;
    const logs = tab === "review" ? data.auditLogs.filter(item => item.tag === "perm") : data.auditLogs;
    const rows = logs.map((log, index) => {
      const invocation = auditInvocation(log, data.auditLogs.indexOf(log));
      return [escapeHtml(invocation.userId), escapeHtml(invocation.path), escapeHtml(invocation.ip), tag(invocation.status, "green"), escapeHtml(invocation.duration), escapeHtml(invocation.time), actionButton("详情", "admin-audit-detail", String(index))];
    });
    const tabs = '<div class="tabs lib-tabs-line admin-inner-tabs admin-audit-business-tabs"><button class="tab ' + (tab === "complaint" ? "is-active" : "") + '" data-action="admin-audit-tab" data-id="complaint">投诉</button><button class="tab ' + (tab === "review" ? "is-active" : "") + '" data-action="admin-audit-tab" data-id="review">审查</button></div>';
    const filters = filter([{ label:"用户ID", type:"input", placeholder:"请输入" }, { label:"调用路径", type:"input", placeholder:"请输入" }, { label:"IP地址", type:"input", placeholder:"请输入" }, { label:"调用状态", type:"select", options:["成功", "失败"] }, { label:"方法耗时", type:"input", placeholder:"请输入" }, { label:"调用时间", type:"range" }], context);
    const title = '<div class="admin-audit-heading"><div class="admin-audit-title"><h2>系统操作日志</h2><span>共 <b>' + logs.length + '</b> / ' + data.auditLogs.length + ' 条</span><span class="admin-audit-info" title="展示原型中的后台配置、权限及数据导入操作记录">i</span></div><button type="button" class="btn xib-btn xib-btn--primary" data-action="admin-audit-reset">重置</button></div>';
    return '<section class="page admin-page xib-module-admin-operations admin-audit-page" data-module="admin-operations">' + surface(tabs + '<div class="admin-audit-card">' + title + filters + table(["用户ID", "调用路径", "IP地址", "调用状态", "方法耗时(毫秒)", "调用时间", "操作"], rows, "admin-audit", context) + '</div>') + "</section>";
  }

  registry.register({
    name: "admin-operations",
    routes: ["admin-jobs", "admin-notify", "admin-notify-complaint", "admin-notify-review", "admin-audit"],
    reset() {
      moduleState.notificationTemplateMode = "";
      moduleState.notificationTemplateId = "";
      moduleState.notificationFilters = { keyword:"", type:"全部", status:"全部" };
    },
    render(page, context) {
      if (page === "admin-jobs") return renderJobs(context);
      if (page === "admin-notify-review") return renderReviewNotifications(context);
      if (page === "admin-notify" || page === "admin-notify-complaint") return renderNotifications(context);
      return renderAudit(context);
    },
    handleAction(action, payload, context) {
      if (action === "admin-audit-tab") {
        moduleState.auditTab = payload.id === "review" ? "review" : "complaint";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-audit-reset") {
        moduleState.auditTab = "complaint";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-job-form") {
        openJobForm(context);
        return true;
      }
      if (action === "admin-notification-template-create" || action === "admin-notification-template-view" || action === "admin-notification-template-edit") {
        moduleState.notificationTemplateMode = action === "admin-notification-template-create" ? "create" : action.endsWith("view") ? "view" : "edit";
        moduleState.notificationTemplateId = payload.id || "";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-notification-template-list") {
        moduleState.notificationTemplateMode = "";
        moduleState.notificationTemplateId = "";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-notification-template-save") {
        const isCreate = moduleState.notificationTemplateMode === "create";
        const root = global.document?.querySelector("[data-notification-template-page]");
        const value = selector => String(root?.querySelector(selector)?.value || "").trim();
        const channels = [...(root?.querySelectorAll("[data-admin-notification-channel]:checked") || [])].map(input => input.value);
        try {
          const input = {
            name:value("[data-admin-notification-name]"),
            type:value("[data-admin-notification-type]"),
            trigger:value("[data-admin-notification-trigger]"),
            role:value("[data-admin-notification-role]"),
            messageTitle:value("[data-admin-notification-message-title]"),
            messageContent:value("[data-admin-notification-message-content]"),
            channels
          };
          if (!input.name) throw new Error("模板名称不能为空");
          if (!input.type || input.type === "请选择") throw new Error("请选择提醒类型");
          if (!input.messageTitle) throw new Error("消息标题不能为空");
          if (!input.messageContent) throw new Error("消息内容不能为空");
          if (!input.channels.length) throw new Error("请至少选择一个发送渠道");
          if (isCreate) notificationTemplateStore.create(input);
          else notificationTemplateStore.update(moduleState.notificationTemplateId, input);
          moduleState.notificationTemplateMode = "";
          moduleState.notificationTemplateId = "";
          context.rerenderPage(true);
          context.toast(isCreate ? "消息模板已新增" : "消息模板已更新");
        } catch (error) {
          context.toast(error?.message || "消息模板保存失败", true);
        }
        return true;
      }
      if (action === "admin-notification-template-disable") {
        try {
          const updated = notificationTemplateStore.toggle(payload.id);
          context.rerenderPage(true);
          context.toast("消息模板已" + updated.status);
        } catch (error) {
          context.toast(error?.message || "消息模板状态更新失败", true);
        }
        return true;
      }
      if (action === "admin-notification-filter-search") {
        moduleState.notificationFilters = {
          keyword:String(global.document?.querySelector("[data-admin-notification-filter-keyword]")?.value || "").trim(),
          type:global.document?.querySelector("[data-admin-notification-filter-type]")?.value || "全部",
          status:global.document?.querySelector("[data-admin-notification-filter-status]")?.value || "全部"
        };
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-notification-filter-reset") {
        moduleState.notificationFilters = { keyword:"", type:"全部", status:"全部" };
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-notify-node-add") {
        openMessageNodeDialog(context, payload.id, "", "add");
        return true;
      }
      if (action === "admin-notify-node-edit" || action === "admin-notify-node-view" || action === "admin-notify-node-delete") {
        const [sceneId, nodeId] = String(payload.id || "").split(":");
        if (action === "admin-notify-node-delete") deleteMessageNode(context, sceneId, nodeId);
        else openMessageNodeDialog(context, sceneId, nodeId, action === "admin-notify-node-view" ? "view" : "edit");
        return true;
      }
      if (action === "admin-audit-detail") {
        const logs = moduleState.auditTab === "review" ? data.auditLogs.filter(item => item.tag === "perm") : data.auditLogs;
        const log = logs[Number(payload.id)] || logs[0];
        const detail = log ? escapeHtml(log.detail) : "查看该条后台操作日志的操作前、操作后与说明。";
        context.openModal("操作详情", detail, "关闭");
        return true;
      }
      return false;
    },
    afterRender() {}
  });
})(window);
