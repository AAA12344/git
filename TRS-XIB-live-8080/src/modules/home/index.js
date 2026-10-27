(function registerHomeTaskInbox(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  const data = global.XIBHomeTaskInboxData;
  const notificationData = global.XIBNotificationCenterData;
  if (!registry || !data || !notificationData) throw new Error("Home task inbox dependencies must load before home.");

  const messageTones = { "待办提醒":"todo", "消息通知":"notice", "审批结果":"approval", "正常催办":"normal-reminder", "加急催办":"urgent-reminder", "特急催办":"critical-reminder" };
  const roleLabels = { developer:"开发测试", operator:"经办员", handler:"处理员", reviewer:"复核员", approver:"审批员", analyst:"业务员" };
  const finalStatuses = new Set(["已办结", "已废止"]);
  const todoTabs = Object.freeze([
    { id:"ticket-create", label:"工单创建", roles:["operator"], category:"standard", numberLabel:"工单编号" },
    { id:"ticket-process", label:"工单处理", roles:["handler"], category:"standard", numberLabel:"工单编号" },
    { id:"ticket-approval", label:"工单审批", roles:["reviewer","approver","analyst"], category:"standard", numberLabel:"工单编号" },
    { id:"subprocess-create", label:"子单创建", roles:["operator"], category:"standard", numberLabel:"子单编号" },
    { id:"subprocess-process", label:"子单处理", roles:["handler"], category:"standard", numberLabel:"子单编号" },
    { id:"subprocess-approval", label:"子单审批", roles:["reviewer","approver","analyst"], category:"standard", numberLabel:"子单编号" },
    { id:"sms-approval", label:"短信审批", roles:["reviewer","approver","analyst"], category:"sms" },
    { id:"export-approval", label:"导出申请审批", roles:["reviewer","approver","analyst"], category:"export" }
  ]);
  const institutionScopeRoles = new Set(["reviewer","approver","analyst"]);
  const view = { activeTodoTabByRole:{}, todoPages:{}, noticePage:1 };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character]));
  const taskInboxRole = context => context.taskInboxRole || context.role || "developer";
  const taskInboxRoles = context => {
    if (taskInboxRole(context) === "developer") return ["developer"];
    const roles = Array.isArray(context.taskInboxRoles) ? context.taskInboxRoles : [taskInboxRole(context)];
    return [...new Set(roles.filter(role => roleLabels[role]))];
  };
  const domainLabel = domain => domain === "review" ? "消保审查" : "投诉管理";
  const visibleTodoTabs = context => {
    const roles = taskInboxRoles(context);
    return roles.includes("developer") ? todoTabs : todoTabs.filter(tab => tab.roles.some(role => roles.includes(role)));
  };
  const activeTodoTab = context => {
    const roleKey = taskInboxRoles(context).join("+") || taskInboxRole(context);
    const tabs = visibleTodoTabs(context);
    const selected = view.activeTodoTabByRole[roleKey];
    if (tabs.some(tab => tab.id === selected)) return tabs.find(tab => tab.id === selected);
    view.activeTodoTabByRole[roleKey] = tabs[0]?.id || "";
    return tabs[0] || null;
  };
  const roleTasks = (context, domain = "complaint") => {
    if (domain !== "complaint") return data.tasks.filter(item => item.domain === domain && (taskInboxRole(context) === "developer" || item.viewRole === taskInboxRole(context)));
    const tab = activeTodoTab(context);
    if (!tab) return [];
    const roles = taskInboxRoles(context);
    const institution = context.currentInstitutionLabel?.() || "总行";
    const institutionScope = roles.includes("developer") || roles.some(role => institutionScopeRoles.has(role));
    return data.tasks.filter(item => item.domain === domain && item.tab === tab.id && (
      roles.includes("developer") ||
      (institutionScope ? item.institution === institution : roles.includes(item.ownerRole))
    ));
  };
  const roleNotifications = context => notificationData.notifications.filter(item => item.domain === "complaint" && (taskInboxRole(context) === "developer" || item.roles.includes(taskInboxRole(context))));
  const taskLabel = item => `${item.businessType || ""}${item.status || ""}`;
  const status = (context,value) => context.statusTag ? context.statusTag(value) : `<span class="tag">${escapeHtml(value)}</span>`;
  const businessTimeZoneOffset = "+08:00";
  const businessTimeZoneOffsetMs = 8 * 60 * 60 * 1000;

  function businessTimestamp(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    const raw = String(value || "").trim();
    if (!raw) return NaN;
    const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(raw)
      ? `${raw.replace(" ","T")}${businessTimeZoneOffset}`
      : raw;
    return new Date(normalized).getTime();
  }

  function currentTimestamp(context) {
    const configured = typeof context?.now === "function" ? context.now() : context?.now;
    const timestamp = configured == null ? Date.now() : businessTimestamp(configured);
    return Number.isFinite(timestamp) ? timestamp : Date.now();
  }

  function businessDateParts(timestamp) {
    const date = new Date(timestamp + businessTimeZoneOffsetMs);
    return { year:date.getUTCFullYear(), month:date.getUTCMonth(), date:date.getUTCDate() };
  }

  function scopeMode(context) {
    const roles = taskInboxRoles(context);
    if (roles.includes("developer")) return "all";
    return roles.some(role => institutionScopeRoles.has(role)) ? "institution" : "personal";
  }

  function scopeLabel(context) {
    const mode = scopeMode(context);
    if (mode === "all") return "根据角色切换数据显示范围";
    if (mode === "institution") return "机构数据统计";
    return "个人数据统计";
  }

  function scopedMonthlyItems(context, domain) {
    const mode = scopeMode(context);
    const institution = context.currentInstitutionLabel?.() || "总行";
    const roles = taskInboxRoles(context);
    const now = currentTimestamp(context);
    const nowParts = businessDateParts(now);
    const monthStart = Date.UTC(nowParts.year,nowParts.month,1) - businessTimeZoneOffsetMs;
    return data.monthlyWorkItems.filter(item => {
      const occurredAt = businessTimestamp(item.completedAt || item.createdAt);
      return item.domain === domain && item.status !== "草稿" && occurredAt >= monthStart && occurredAt <= now && (
      mode === "all" ||
      (mode === "institution" && item.institution === institution) ||
      (mode === "personal" && roles.includes(item.ownerRole))
      );
    });
  }

  function progressFor(items, kind, context) {
    const rows = items.filter(item => item.kind === kind);
    const completed = rows.filter(item => finalStatuses.has(item.status)).length;
    const now = currentTimestamp(context);
    const overdue = rows.filter(item => !finalStatuses.has(item.status) && businessTimestamp(item.deadlineAt) < now).length;
    const active = Math.max(0, rows.length - completed - overdue);
    return { total:rows.length, completed, active, overdue };
  }

  function efficiencyFor(items, domain, context) {
    const primaryKind = domain === "review" ? "project" : "ticket";
    const now = businessDateParts(currentTimestamp(context));
    const completed = items.filter(item => {
      if (item.kind !== primaryKind || item.status !== "已办结" || !item.completedAt) return false;
      const completedAt = businessDateParts(businessTimestamp(item.completedAt));
      return completedAt.year === now.year && completedAt.month === now.month;
    });
    const onTime = completed.filter(item => businessTimestamp(item.completedAt) <= businessTimestamp(item.deadlineAt)).length;
    return { completed:completed.length, onTime, percent:completed.length ? Math.round(onTime / completed.length * 100) : 0 };
  }

  function deadlinePresentation(item,context) {
    if (!item?.deadlineAt) return { text:"—", urgent:false };
    const deadlineStatus = item.status === "待提交" ? "" : item.status;
    const text = context.formatRemainingTime ? context.formatRemainingTime(item.deadlineAt,deadlineStatus) : item.deadlineAt;
    const remainingMs = businessTimestamp(item.deadlineAt) - currentTimestamp(context);
    return { text, urgent:text.startsWith("已逾期") || remainingMs < 3 * 24 * 60 * 60 * 1000 };
  }

  function sortTasksByDeadline(items) {
    return [...items].sort((left,right) => businessTimestamp(left.deadlineAt) - businessTimestamp(right.deadlineAt));
  }

  function deadlineCell(item,context) {
    const deadline = deadlinePresentation(item,context);
    return `<td class="home-deadline-cell"><span class="home-deadline ${deadline.urgent ? "is-urgent" : ""}">${escapeHtml(deadline.text)}</span><img class="home-row-arrow" src="ui/assets/arrow-right.svg" alt=""></td>`;
  }

  function taskColumns(tab) {
    if (tab?.category === "sms") return ["短信编号","关联工单编号","短信审批状态","处置期限"];
    if (tab?.category === "export") return ["导出申请编号","导出类型","导出申请状态","处置期限"];
    if (tab?.id?.startsWith("subprocess-")) return [tab.numberLabel || "子单编号","子单类型","子单状态","处置期限"];
    return [tab?.numberLabel || "工单编号","工单类型","工单状态","处置期限"];
  }

  function taskCells(item,tab,context) {
    const number = `<td class="primary-cell is-static-id">${escapeHtml(item.businessNo)}</td>`;
    if (tab?.category === "sms") return `${number}<td>${escapeHtml(item.relatedBusinessNo || "-")}</td><td>${status(context,item.status)}</td>${deadlineCell(item,context)}`;
    if (tab?.category === "export") return `${number}<td>${escapeHtml(item.exportType || "-")}</td><td>${status(context,item.status)}</td>${deadlineCell(item,context)}`;
    return `${number}<td>${escapeHtml(item.businessType || "-")}</td><td>${status(context,item.status)}</td>${deadlineCell(item,context)}`;
  }

  function renderHeader() {
    return `<header class="home-page-head"><h1 class="page-title">待办消息</h1></header>`;
  }

  function ringPoint(percent,radius = 40) {
    const angle = percent / 100 * 360 * Math.PI / 180;
    return { x:50 + radius * Math.cos(angle), y:50 + radius * Math.sin(angle) };
  }

  function pointMarkup(point) {
    return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  function roundedRingPath(start,end,cornerRadius = 4) {
    const outerRadius = 45;
    const innerRadius = 35;
    const span = Math.max(.01,end - start);
    const radius = Math.min(cornerRadius,(outerRadius - innerRadius) / 2 - .2);
    const outerInset = Math.min(span / 4,radius / outerRadius / (Math.PI * 2) * 100);
    const innerInset = Math.min(span / 4,radius / innerRadius / (Math.PI * 2) * 100);
    const largeArc = span > 50 ? 1 : 0;
    const outerStartInset = ringPoint(start + outerInset,outerRadius);
    const outerEndInset = ringPoint(end - outerInset,outerRadius);
    const outerEnd = ringPoint(end,outerRadius);
    const endOuterFace = ringPoint(end,outerRadius - radius);
    const endInnerFace = ringPoint(end,innerRadius + radius);
    const innerEnd = ringPoint(end,innerRadius);
    const innerEndInset = ringPoint(end - innerInset,innerRadius);
    const innerStartInset = ringPoint(start + innerInset,innerRadius);
    const innerStart = ringPoint(start,innerRadius);
    const startInnerFace = ringPoint(start,innerRadius + radius);
    const startOuterFace = ringPoint(start,outerRadius - radius);
    const outerStart = ringPoint(start,outerRadius);
    return [
      `M ${pointMarkup(outerStartInset)}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${pointMarkup(outerEndInset)}`,
      `Q ${pointMarkup(outerEnd)} ${pointMarkup(endOuterFace)}`,
      `L ${pointMarkup(endInnerFace)}`,
      `Q ${pointMarkup(innerEnd)} ${pointMarkup(innerEndInset)}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${pointMarkup(innerStartInset)}`,
      `Q ${pointMarkup(innerStart)} ${pointMarkup(startInnerFace)}`,
      `L ${pointMarkup(startOuterFace)}`,
      `Q ${pointMarkup(outerStart)} ${pointMarkup(outerStartInset)} Z`
    ].join(" ");
  }

  function ringGradient(id,tone,start,end) {
    const from = ringPoint(start);
    const to = ringPoint(end);
    return `<linearGradient id="${id}" data-ring-tone="${tone}" gradientUnits="userSpaceOnUse" x1="${from.x.toFixed(2)}" y1="${from.y.toFixed(2)}" x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}"><stop offset="0%" stop-color="var(--progress-${tone}-light)"></stop><stop offset="100%" stop-color="var(--progress-${tone}-dark)"></stop></linearGradient>`;
  }

  function ringSegment(kind,tone,start,length) {
    if (length <= 0) return { gradient:"", path:"" };
    const gap = Math.min(1.4,length * .3);
    const visibleStart = start + gap / 2;
    const visibleEnd = start + length - gap / 2;
    const id = `home-ring-${kind}-${tone}`;
    const isSolid = tone === "completed";
    return {
      gradient:isSolid ? "" : ringGradient(id,tone,visibleStart,visibleEnd),
      path:`<path class="home-ring-segment is-${tone}" data-corner-radius="4" d="${roundedRingPath(visibleStart,visibleEnd,4)}" fill="${isSolid ? "var(--progress-completed)" : `url(#${id})`}"></path>`
    };
  }

  function renderProgressRing(progress,kind) {
    const total = Math.max(1,progress.total);
    const definitions = [];
    const paths = [];
    let offset = 0;
    [["completed",progress.completed],["active",progress.active],["overdue",progress.overdue]].forEach(([tone,value]) => {
      const length = value / total * 100;
      const segment = ringSegment(kind,tone,offset,length);
      if (segment.path) {
        if (segment.gradient) definitions.push(segment.gradient);
        paths.push(segment.path);
      }
      offset += length;
    });
    const visual = progress.total
      ? `<defs>${definitions.join("")}</defs>${paths.join("")}`
      : '<circle class="home-ring-track" cx="50" cy="50" r="40"></circle>';
    return `<div class="home-progress-ring"><svg class="home-ring-svg" viewBox="0 0 100 100" aria-hidden="true">${visual}</svg><span><strong>${progress.total}</strong><small>总数</small></span></div>`;
  }

  function renderEfficiencyRing(percent,domain) {
    const safePercent = Math.max(0,Math.min(100,percent));
    const id = `home-ring-efficiency-${domain}`;
    const visiblePercent = Math.min(99.5,safePercent);
    const gradient = ringGradient(id,"active",0,visiblePercent);
    const segment = visiblePercent > 0 ? `<path class="home-ring-segment is-active" data-corner-radius="4" d="${roundedRingPath(0,visiblePercent,4)}" fill="url(#${id})"></path>` : "";
    return `<div class="home-efficiency-ring"><svg class="home-ring-svg" viewBox="0 0 100 100" aria-hidden="true"><defs>${gradient}</defs><circle class="home-ring-track" cx="50" cy="50" r="40"></circle>${segment}</svg><span><strong>${safePercent}%</strong><small>按时办结</small></span></div>`;
  }

  function renderProgressCard(label, progress, kind) {
    return `<article class="home-progress-card ${progress.total ? "" : "is-empty"}" data-progress-kind="${kind}" data-progress-total="${progress.total}" data-progress-completed="${progress.completed}" data-progress-active="${progress.active}" data-progress-overdue="${progress.overdue}">${renderProgressRing(progress,kind)}<div class="home-progress-info"><strong>${label}</strong><div class="home-progress-legend"><span class="is-completed"><i></i>已办结 <b>${progress.completed}</b></span><span class="is-active"><i></i>流转中 <b>${progress.active}</b></span><span class="is-overdue"><i></i>已超时 <b>${progress.overdue}</b></span></div></div></article>`;
  }

  function renderEfficiencyCard(items, domain, context) {
    const efficiency = efficiencyFor(items, domain, context);
    return `<article class="home-progress-card home-efficiency-card" data-efficiency-percent="${efficiency.percent}">${renderEfficiencyRing(efficiency.percent,domain)}<div class="home-progress-info"><strong>处理效率</strong><p>本月按时操作的${domain === "review" ? "审查项目" : "工单"}占比</p><small>${efficiency.onTime} / ${efficiency.completed} 单</small></div></article>`;
  }

  function renderOverview(context) {
    const domain = "complaint";
    const items = scopedMonthlyItems(context,domain);
    const kinds = [{ kind:"ticket", label:"工单进度" }, { kind:"subprocess", label:"子单进度" }];
    return `<section class="panel home-overview" aria-labelledby="home-overview-title"><div class="panel-head"><strong class="panel-title" id="home-overview-title">工作总览</strong></div><div class="home-overview-body"><section class="home-monthly"><div class="home-overview-subhead"><strong>本月数据</strong><span>${escapeHtml(scopeLabel(context))}</span></div><div class="home-monthly-grid">${kinds.map(item => renderProgressCard(item.label,progressFor(items,item.kind,context),item.kind)).join("")}${renderEfficiencyCard(items,domain,context)}</div></section></div></section>`;
  }

  function renderProfile(context) {
    const role = taskInboxRole(context);
    const rawUser = String(context.currentUser?.() || "用户");
    const [userName = "用户", employeeNo = "—"] = rawUser.split("-");
    const institution = context.currentInstitutionLabel?.() || "—";
    const department = context.currentDepartmentLabel?.() || "—";
    const roleName = roleLabels[role] || context.currentViewLabel?.() || "当前用户";
    return `<section class="panel home-profile" aria-labelledby="home-profile-title"><div class="panel-head"><strong class="panel-title" id="home-profile-title">个人信息</strong></div><div class="home-profile-body"><div class="home-profile-identity"><span class="home-profile-avatar" aria-label="${escapeHtml(userName)}头像">${escapeHtml(userName.slice(0, 1))}</span><div class="home-profile-summary"><strong>${escapeHtml(userName)}</strong><span>${escapeHtml(roleName)}</span></div></div><dl class="home-profile-details"><div><dt>工号</dt><dd>${escapeHtml(employeeNo)}</dd></div><div><dt>机构</dt><dd>${escapeHtml(institution)}</dd></div><div><dt>部门</dt><dd>${escapeHtml(department)}</dd></div></dl></div></section>`;
  }

  function renderTaskRows(context, domain) {
    const tasks = sortTasksByDeadline(roleTasks(context,domain));
    const tab = activeTodoTab(context);
    const pageKey = tab?.id || domain;
    const pageSize = 5;
    const totalPages = Math.max(1,Math.ceil(tasks.length / pageSize));
    const currentPage = Math.min(Math.max(1,Number(view.todoPages[pageKey]) || 1),totalPages);
    view.todoPages[pageKey] = currentPage;
    const visible = tasks.slice((currentPage - 1) * pageSize,currentPage * pageSize);
    if (!visible.length) return `<div class="home-empty"><div></div><strong>暂无待办</strong><span>当前身份在${escapeHtml(tab?.label || domainLabel(domain))}下没有待处理事项</span></div>`;
    const pageButtons = Array.from({ length:totalPages },(_,index) => index + 1).map(page => `<button type="button" class="page-btn ${page === currentPage ? "is-active" : ""}" data-home-task-page="${page}" data-home-task-domain="${domain}" aria-label="第${page}页" ${page === currentPage ? 'aria-current="page"' : ""}>${page}</button>`).join("");
    const pagination = `<footer class="pagination ds-pagination home-task-footer" data-page-size="${pageSize}"><span class="pagination-total">共 ${tasks.length} 项</span><nav class="pagination-nav" aria-label="我的待办分页"><button type="button" class="page-btn pagination-arrow" data-home-task-page="${Math.max(1,currentPage - 1)}" data-home-task-domain="${domain}" aria-label="上一页" ${currentPage <= 1 ? "disabled" : ""}>‹</button>${pageButtons}<button type="button" class="page-btn pagination-arrow" data-home-task-page="${Math.min(totalPages,currentPage + 1)}" data-home-task-domain="${domain}" aria-label="下一页" ${currentPage >= totalPages ? "disabled" : ""}>›</button></nav><strong class="pagination-current" aria-live="polite">第 ${currentPage} / ${totalPages} 页</strong></footer>`;
    const headers = taskColumns(tab).map(label => `<th>${label}</th>`).join("");
    return `<div class="table-wrap"><table class="table ds-table home-task-table"><thead><tr>${headers}</tr></thead><tbody>${visible.map(item => `<tr class="home-task-row" tabindex="0" role="link" data-home-task="${escapeHtml(item.id)}">${taskCells(item,tab,context)}</tr>`).join("")}</tbody></table></div>${pagination}`;
  }

  function renderTodo(context) {
    const domain = "complaint";
    const selected = activeTodoTab(context);
    const tabs = visibleTodoTabs(context);
    const tabBar = `<div class="tabs ds-tabs home-task-tabs" role="tablist" aria-label="我的待办分类">${tabs.map(tab => `<button type="button" role="tab" class="tab ${tab.id === selected?.id ? "is-active" : ""}" data-home-task-tab="${tab.id}" aria-selected="${tab.id === selected?.id}">${tab.label}</button>`).join("")}</div>`;
    return `<section class="panel home-todo" aria-labelledby="home-todo-title"><div class="panel-head"><strong class="panel-title" id="home-todo-title">我的待办</strong></div>${tabBar}<div class="home-task-content">${renderTaskRows(context,domain)}</div></section>`;
  }

  function renderMessageItem(item) {
    const tone = messageTones[item.category] || "notice";
    return `<button type="button" class="home-message" data-home-message="${escapeHtml(item.id)}"><span class="home-message-main"><em class="is-${tone}">${escapeHtml(item.category)}</em><b>${escapeHtml(item.title)}</b></span><time>${escapeHtml(item.time)}</time><img src="ui/assets/arrow-right.svg" alt=""></button>`;
  }

  function renderMessages(context) {
    const notices = roleNotifications(context);
    const pageSize = 6;
    const totalPages = Math.max(1,Math.ceil(notices.length / pageSize));
    const currentPage = Math.min(Math.max(1,Number(view.noticePage) || 1),totalPages);
    view.noticePage = currentPage;
    const visible = notices.slice((currentPage - 1) * pageSize,currentPage * pageSize);
    const pagination = `<footer class="pagination ds-pagination home-message-footer" data-page-size="${pageSize}"><span class="pagination-total">共 ${notices.length} 项</span><nav class="pagination-nav" aria-label="通知中心分页"><button type="button" class="page-btn pagination-arrow" data-home-message-page="${Math.max(1,currentPage - 1)}" aria-label="上一页" ${currentPage <= 1 ? "disabled" : ""}>‹</button><button type="button" class="page-btn is-active" data-home-message-page="${currentPage}" aria-label="第${currentPage}页" aria-current="page">${currentPage}</button><button type="button" class="page-btn pagination-arrow" data-home-message-page="${Math.min(totalPages,currentPage + 1)}" aria-label="下一页" ${currentPage >= totalPages ? "disabled" : ""}>›</button></nav></footer>`;
    return `<section class="panel home-messages" aria-labelledby="home-message-title"><div class="panel-head"><strong class="panel-title" id="home-message-title">通知中心</strong><button type="button" class="home-panel-link" data-page="notice-complaint" aria-label="进入通知中心" title="进入通知中心"><img src="ui/assets/arrow-right.svg" alt=""></button></div><div class="home-message-list">${visible.map(renderMessageItem).join("") || `<div class="home-message-empty">暂无消息</div>`}</div>${pagination}</section>`;
  }

  function renderContent(context) {
    return `${renderHeader()}<div class="home-dashboard-grid">${renderOverview(context)}${renderProfile(context)}${renderTodo(context)}${renderMessages(context)}</div>`;
  }

  function refresh(section,context) { section.innerHTML = renderContent(context); bind(section,context); }

  function openTaskTarget(target,context) {
    if (target?.kind === "review") return context.navigate?.(target.route || "review-manage");
    return context.openWorkflowItem?.(target);
  }

  function dispatchAction(action,payload,context) {
    if (action === "home-open-task") {
      const task = data.tasks.find(item => item.id === payload.id);
      if (task) openTaskTarget(task.target,context);
      return true;
    }
    return false;
  }

  function bind(section,context) {
    section.querySelectorAll("[data-home-task-tab]").forEach(button => button.addEventListener("click",() => {
      const roleKey = taskInboxRoles(context).join("+") || taskInboxRole(context);
      if (!visibleTodoTabs(context).some(tab => tab.id === button.dataset.homeTaskTab)) return;
      view.activeTodoTabByRole[roleKey] = button.dataset.homeTaskTab;
      view.todoPages[button.dataset.homeTaskTab] = 1;
      refresh(section,context);
    }));
    section.querySelectorAll("[data-home-task-page]").forEach(button => button.addEventListener("click",() => {
      const tabId = activeTodoTab(context)?.id || "complaint";
      view.todoPages[tabId] = Math.max(1,Number(button.dataset.homeTaskPage) || 1);
      refresh(section,context);
    }));
    section.querySelectorAll("[data-home-message-page]").forEach(button => button.addEventListener("click",() => {
      view.noticePage = Math.max(1,Number(button.dataset.homeMessagePage) || 1);
      refresh(section,context);
    }));
    section.querySelectorAll("[data-home-message]").forEach(button => button.addEventListener("click",() => context.openNotificationMessage?.(button.dataset.homeMessage)));
    section.querySelectorAll("[data-home-task]").forEach(row => {
      const open = () => { const task = data.tasks.find(item => item.id === row.dataset.homeTask); if (task) openTaskTarget(task.target,context); };
      row.addEventListener("click",open);
      row.addEventListener("keydown",event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
    section.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click",() => context.navigate?.(button.dataset.page)));
  }

  registry.register({
    name:"home",
    routes:["home-tasks"],
    render(page,context) { return `<section class="page xib-module-home-tasks" data-module="home">${renderContent(context)}</section>`; },
    afterRender(root,page,context) { const section = root.matches?.('[data-module="home"]') ? root : root.querySelector('[data-module="home"]'); if (section) bind(section,context); },
    handleAction(action,payload,context) { return dispatchAction(action,payload,context); }
  });
  global.XIBHomeTaskInbox = Object.freeze({ setDomain() { view.activeTodoTabByRole = {}; view.todoPages = {}; view.noticePage = 1; } });
})(window);
