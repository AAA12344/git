(function registerNotifications(global) {
  "use strict";
  const registry = global.XIBModuleRegistry;
  const data = global.XIBNotificationCenterData;
  if (!registry || !data) throw new Error("Notification center dependencies must load before notifications.");

  const routeDomains = Object.freeze({ "notice-complaint":"complaint", "notice-review":"review" });
  const domainLabels = Object.freeze({ complaint:"投诉管理通知", review:"消保审查通知" });
  const categories = ["全部","特急催办","加急催办","正常催办","审批结果","待办提醒","消息通知"];
  const messageTones = { "待办提醒":"todo", "消息通知":"notice", "审批结果":"approval", "正常催办":"normal-reminder", "加急催办":"urgent-reminder", "特急催办":"critical-reminder" };
  const makeView = () => ({ readFilter:"全部", copyOnly:false, category:"全部", query:"", draftQuery:"", selectedId:"", page:1, pageSize:8 });
  const views = { complaint:makeView(), review:makeView() };
  const readState = new Map(data.notifications.map(item => [item.id,Boolean(item.read)]));
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character]));
  const taskInboxRole = context => context.taskInboxRole || context.role || "developer";
  const visibleNotifications = context => taskInboxRole(context) === "developer" ? data.notifications : data.notifications.filter(item => item.roles.includes(taskInboxRole(context)));
  const domainForPage = page => routeDomains[page] || "complaint";
  const viewForPage = page => views[domainForPage(page)];
  const domainNotifications = (context,domain) => visibleNotifications(context).filter(item => item.domain === domain);

  function filteredNotifications(context,domain,view) {
    const query = view.query.trim().toLowerCase();
    return domainNotifications(context,domain).filter(item => {
      const read = readState.get(item.id);
      if (view.readFilter === "未读" && read) return false;
      if (view.readFilter === "已读" && !read) return false;
      if (view.category !== "全部" && item.category !== view.category) return false;
      if (view.copyOnly && item.deliveryType !== "抄送") return false;
      if (!query) return true;
      return [item.title,item.content,item.category,item.source,item.target?.id].some(value => String(value || "").toLowerCase().includes(query));
    });
  }

  const toneClass = category => messageTones[category] || "notice";

  function renderReadFilters(context,domain,view) {
    const messages = domainNotifications(context,domain);
    const counts = { 全部:messages.length, 未读:messages.filter(item => !readState.get(item.id)).length, 已读:messages.filter(item => readState.get(item.id)).length };
    return `<div class="notification-read-filter xib-segmented-filter" role="group" aria-label="阅读状态筛选">${["全部","未读","已读"].map(label => `<button type="button" class="${view.readFilter === label ? "is-active" : ""}" data-notification-read="${label}">${label}<span>${counts[label]}</span></button>`).join("")}</div>`;
  }

  function renderCopyFilter(context,domain,view) {
    const count = domainNotifications(context,domain).filter(item => item.deliveryType === "抄送").length;
    return `<button type="button" class="notification-copy-filter ${view.copyOnly ? "is-active" : ""}" data-notification-copy aria-pressed="${view.copyOnly}">抄送<span>${count}</span></button>`;
  }

  function renderPagination(total,view) {
    const totalPages = Math.max(1,Math.ceil(total / view.pageSize));
    view.page = Math.min(view.page,totalPages);
    if (totalPages <= 1) return "";
    return `<footer class="notification-pagination"><span>共 ${total} 条</span><div><button type="button" class="page-btn" data-notification-page="${Math.max(1,view.page-1)}" ${view.page === 1 ? "disabled" : ""} aria-label="上一页">‹</button><span>第 ${view.page} / ${totalPages} 页</span><button type="button" class="page-btn" data-notification-page="${Math.min(totalPages,view.page+1)}" ${view.page === totalPages ? "disabled" : ""} aria-label="下一页">›</button></div></footer>`;
  }

  function renderList(page,context) {
    const domain = domainForPage(page);
    const view = viewForPage(page);
    const messages = filteredNotifications(context,domain,view);
    const totalPages = Math.max(1,Math.ceil(messages.length / view.pageSize));
    view.page = Math.min(view.page,totalPages);
    const pageRows = messages.slice((view.page - 1) * view.pageSize, view.page * view.pageSize);
    const domainLabel = domainLabels[domain];
    return `<section class="page xib-module-notifications" data-module="notifications" data-notification-route="${page}">${context.pageHeader(domainLabel,"集中查看站内消息、催办提醒与审批结果")}<div class="panel notification-filter-panel"><div class="notification-filter-actions">${renderReadFilters(context,domain,view)}${renderCopyFilter(context,domain,view)}</div><label class="notification-search"><img src="ui/assets/search.svg" alt=""><input type="search" value="${escapeHtml(view.draftQuery || view.query)}" placeholder="搜索消息内容、业务编号" data-notification-search><button type="button" class="btn xib-btn xib-btn--primary" data-notification-search-submit>搜索</button></label></div><div class="panel notification-list-panel"><div class="tabs lib-tabs-line notification-category-tabs">${categories.map(category => `<button type="button" class="tab ${view.category === category ? "is-active" : ""}" data-notification-category="${category}">${category}</button>`).join("")}</div><div class="notification-list-head"><strong>${domainLabel}</strong><span>共 ${messages.length} 条</span></div><div class="notification-list">${pageRows.length ? pageRows.map(item => `<button type="button" class="notification-row ${readState.get(item.id) ? "is-read" : "is-unread"}" data-notification-open="${escapeHtml(item.id)}"><i class="notification-unread-dot" aria-hidden="true"></i><em class="notification-type is-${toneClass(item.category)}">${escapeHtml(item.category)}</em><span class="notification-row-content"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.content)}</small></span><time>${escapeHtml(item.sentAt)}</time><img class="notification-row-arrow" src="ui/assets/arrow-right.svg" alt=""></button>`).join("") : `<div class="notification-empty"><div></div><strong>暂无通知</strong><span>当前筛选条件下没有消息</span></div>`}</div>${renderPagination(messages.length,view)}</div></section>`;
  }

  function renderDetail(page,context,item) {
    const targetId = item.target?.id || "—";
    const showExtraMetadata = item.domain !== "complaint";
    return `<section class="page xib-module-notifications" data-module="notifications" data-notification-route="${page}">${context.pageHeader("消息详情","查看站内消息全文与相关业务信息")}<div class="panel notification-detail-panel"><div class="panel-head"><button type="button" class="notification-back" data-notification-back><img src="ui/assets/arrow-left.svg" alt="">返回通知列表</button></div><article class="notification-detail"><header><em class="notification-type is-${toneClass(item.category)}">${escapeHtml(item.category)}</em><span>${readState.get(item.id) ? "已读" : "未读"}</span></header><h2>${escapeHtml(item.title)}</h2><time>${escapeHtml(item.sentAt)}</time><div class="notification-detail-content">${escapeHtml(item.content)}</div><dl>${showExtraMetadata ? `<div><dt>消息栏目</dt><dd>${domainLabels[item.domain]}</dd></div>` : ""}<div><dt>消息类型</dt><dd>${escapeHtml(item.category)}</dd></div>${showExtraMetadata ? `<div><dt>接收方式</dt><dd>${escapeHtml(item.deliveryType)}</dd></div>` : ""}<div><dt>来源模块</dt><dd>${escapeHtml(item.source)}</dd></div><div><dt>相关业务编号</dt><dd>${escapeHtml(targetId)}</dd></div></dl><footer><button type="button" class="btn xib-btn xib-btn--primary" data-notification-target="${escapeHtml(item.id)}">查看相关业务</button></footer></article></div></section>`;
  }

  function render(page,context) {
    const domain = domainForPage(page);
    const view = viewForPage(page);
    const passedId = context.state?.notificationMessageId;
    const passedItem = passedId ? visibleNotifications(context).find(item => item.id === passedId && item.domain === domain) : null;
    if (context.state?.notificationListRequested) {
      view.selectedId = "";
      context.state.notificationListRequested = false;
    }
    if (passedItem) view.selectedId = passedId;
    const selected = domainNotifications(context,domain).find(item => item.id === view.selectedId);
    if (view.selectedId && !selected) view.selectedId = "";
    return selected ? renderDetail(page,context,selected) : renderList(page,context);
  }

  function refresh(section,page,context) {
    section.outerHTML = render(page,context);
    const root = document.querySelector('[data-module="notifications"]');
    if (root) bind(root,page,context);
  }

  function openTarget(item,context) {
    if (!item?.target) return;
    if (item.target.route) context.navigate?.(item.target.route);
    else context.openWorkflowItem?.(item.target);
  }

  function bind(section,page,context) {
    const view = viewForPage(page);
    section.querySelectorAll("[data-notification-read]").forEach(button => button.addEventListener("click",() => { view.readFilter = button.dataset.notificationRead; view.page = 1; refresh(section,page,context); }));
    section.querySelector("[data-notification-copy]")?.addEventListener("click",() => { view.copyOnly = !view.copyOnly; view.page = 1; refresh(section,page,context); });
    section.querySelectorAll("[data-notification-category]").forEach(button => button.addEventListener("click",() => { view.category = button.dataset.notificationCategory; view.page = 1; refresh(section,page,context); }));
    section.querySelector("[data-notification-search]")?.addEventListener("input",event => { view.draftQuery = event.target.value; });
    section.querySelector("[data-notification-search]")?.addEventListener("keydown",event => { if (event.key === "Enter") { event.preventDefault(); view.query = event.target.value; view.draftQuery = view.query; view.page = 1; refresh(section,page,context); } });
    section.querySelector("[data-notification-search-submit]")?.addEventListener("click",() => { const input = section.querySelector("[data-notification-search]"); view.query = input?.value || ""; view.draftQuery = view.query; view.page = 1; refresh(section,page,context); });
    section.querySelectorAll("[data-notification-page]").forEach(button => button.addEventListener("click",() => { if (!button.disabled) { view.page = Number(button.dataset.notificationPage) || 1; refresh(section,page,context); } }));
    section.querySelectorAll("[data-notification-open]").forEach(button => button.addEventListener("click",() => { const id = button.dataset.notificationOpen; readState.set(id,true); view.selectedId = id; context.clearNotificationMessage?.(); refresh(section,page,context); }));
    section.querySelector("[data-notification-back]")?.addEventListener("click",() => { view.selectedId = ""; context.clearNotificationMessage?.(); refresh(section,page,context); });
    section.querySelectorAll("[data-notification-target]").forEach(button => button.addEventListener("click",() => openTarget(data.notifications.find(item => item.id === button.dataset.notificationTarget),context)));
  }

  registry.register({
    name:"notifications",
    routes:Object.keys(routeDomains),
    render,
    afterRender(root,page,context) {
      const section = root.matches?.('[data-module="notifications"]') ? root : root.querySelector('[data-module="notifications"]');
      if (section) bind(section,page,context);
    }
  });
})(window);
