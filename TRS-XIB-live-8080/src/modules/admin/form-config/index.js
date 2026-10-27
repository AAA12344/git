(function registerAdminFormConfig(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  const data = global.XIB_ADMIN_FORM_CONFIG_DATA;
  const templateStore = global.XIBAdminFormTemplateStore;
  const enumOverrideStore = global.XIBAdminFormEnumOverrideStore;
  const formChangeHistoryStore = global.XIBAdminFormChangeHistoryStore;
  const smsTemplateStore = global.XIBAdminSmsTemplateStore;
  if (!registry) throw new Error("XIBModuleRegistry must load before admin-form-config.");
  if (!data) throw new Error("Admin form configuration data must load before its module.");

  const moduleState = { domain: "complaint", detail: "", listTab: "forms", dictionaryId:"complaint_accept_channel", pendingChanges:{} };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const actionButton = (label, action, id = "") => '<button class="btn-link" data-action="' + action + '" data-id="' + escapeHtml(id) + '">' + label + "</button>";
  const surface = body => '<div class="admin-surface">' + body + "</div>";

  function formatTimestamp(date = new Date()) {
    const pad = value => String(value).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
  }

  function canMaintainTemplate(context) {
    return context.state?.roleProfile === "technology-super-admin";
  }

  function table(headers, rows, scope, context) {
    return '<div class="table-wrap admin-table-wrap"><table class="ds-table"><thead><tr>' + headers.map(header => "<th>" + header + "</th>").join("") + "</tr></thead><tbody>" + rows.map(row => "<tr>" + row.map(cell => "<td>" + cell + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>" + context.renderPagination(rows.length, 1, scope);
  }

  function disabledAction(label) {
    return '<span class="admin-action-unavailable" title="' + escapeHtml(label) + '">-</span>';
  }

  function truncateText(value, length = 50) {
    const text = String(value || "");
    return text.length > length ? text.slice(0, length - 3) + "..." : text;
  }

  function renderDomainTabs() {
    return '<div class="tabs lib-tabs-line admin-inner-tabs admin-domain-tabs">' +
      '<button class="tab ' + (moduleState.domain === "complaint" ? "is-active" : "") + '" data-action="admin-form-domain" data-id="complaint">投诉管理</button>' +
      '<button class="tab ' + (moduleState.domain === "review" ? "is-active" : "") + '" data-action="admin-form-domain" data-id="review">消保审查</button>' +
    "</div>";
  }

  function renderReviewEmpty(context) {
    return '<section class="page admin-page xib-module-admin-form-config" data-module="admin-form-config">' +
      context.pageHeader("消保审查表单", "配置消保审查相关表单字段") +
      surface('<section class="admin-card-section admin-list-card"><h3>消保审查表单配置</h3><div class="empty-state">暂无配置内容，待后续补充。</div></section>') +
    "</section>";
  }

  function renderListTabs() {
    return '<div class="tabs lib-tabs-line admin-inner-tabs admin-form-list-tabs">' +
      '<button class="tab ' + (moduleState.listTab === "forms" ? "is-active" : "") + '" data-action="admin-form-list-tab" data-id="forms">投诉管理表单列表</button>' +
      '<button class="tab ' + (moduleState.listTab === "sms" ? "is-active" : "") + '" data-action="admin-form-list-tab" data-id="sms">短信模版</button>' +
    "</div>";
  }

  function renderFormList(context) {
    const rows = data.forms.map((item, index) => [String(index + 1), escapeHtml(item.name), escapeHtml(item.category), String(item.editableFieldCount ?? item.enumCount ?? 0), escapeHtml(item.updateTime), '<div class="table-actions">' + actionButton("查看", "admin-form-detail", item.name) + actionButton("编辑", "admin-form-detail", item.name) + "</div>"]);
    return '<section class="admin-card-section admin-list-card"><h3>投诉管理表单列表</h3>' + table(["序号", "表单名称", "分类", "可修改字段", "更新时间", "操作"], rows, "admin-form-config", context) + "</section>";
  }

  function renderSmsTemplateList(context) {
    const rows = smsTemplateStore.list().map((template, index) => [
      String(index + 1),
      escapeHtml(template.title),
      escapeHtml(template.category),
      String(template.variables.length),
      '<button class="lib-switch admin-switch ' + (template.enabled ? "is-on" : "") + '" type="button" role="switch" aria-checked="' + (template.enabled ? "true" : "false") + '" data-action="admin-form-sms-toggle" data-id="' + escapeHtml(template.id) + '"><span></span></button>',
      escapeHtml(template.updateTime),
      '<div class="table-actions">' + actionButton("查看", "admin-form-sms-view", template.id) + actionButton("编辑", "admin-form-sms-edit", template.id) + '<button class="btn-link admin-action-danger" data-action="admin-form-sms-delete" data-id="' + escapeHtml(template.id) + '">删除</button></div>'
    ]);
    const historyRows = smsTemplateStore.history().map(item => [escapeHtml(item.time), escapeHtml(item.user), escapeHtml(item.action), escapeHtml(item.category || "-"), escapeHtml(item.desc)]);
    const head = '<div class="admin-section-head"><h3>短信模版列表</h3><button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-form-sms-create">新增短信模板</button></div>';
    return '<section class="admin-card-section admin-list-card">' + head + table(["序号", "短信标题", "分类", "变量数量", "启用状态", "更新时间", "操作"], rows, "admin-form-sms-template", context) + '</section>' +
      '<section class="admin-card-section admin-list-card"><h3>短信模板修改记录</h3>' + table(["操作时间", "操作人", "操作类型", "短信分类", "变更说明"], historyRows, "admin-form-sms-history", context) + "</section>";
  }

  const dictionaryStorageKey = "xib-admin-field-dictionaries-v1";
  const acceptanceChannels = {
    投诉单:["客服电话", "在线客服", "总行投诉邮箱", "机构专线电话", "营业网点", "客户意见簿", "信函", "厦门金管局", "福建金管局", "珠海金管局", "北京金管局", "上海金管局", "宁德金管局", "龙岩金管局", "泉州金管局", "漳州金管局", "莆田金管局", "三明金管局", "南平金管局", "金融消费者保护服务平台", "市长热线", "其它"],
    信访单:["厦门金管局", "福建金管局", "珠海金管局", "北京金管局", "上海金管局", "宁德金管局", "龙岩金管局", "泉州金管局", "漳州金管局", "莆田金管局", "三明金管局", "南平金管局", "纪检", "其它"],
    表扬单:["客服电话", "在线客服", "总行投诉邮箱", "机构专线电话", "营业网点", "客户意见簿", "信函", "其它"],
    建议单:["客服电话", "在线客服", "总行投诉邮箱", "机构专线电话", "营业网点", "客户意见簿", "信函", "其它"]
  };
  const itemRows = (names, prefix) => names.map((name, index) => ({ code:prefix + "_" + String(index + 1).padStart(2, "0"), name, status:"启用" }));
  const defaultDictionaries = {
    types:[
      { id:"complaint_accept_channel", formName:"投诉单", fieldName:"受理渠道" },
      { id:"petition_accept_channel", formName:"信访单", fieldName:"受理渠道" },
      { id:"praise_accept_channel", formName:"表扬单", fieldName:"受理渠道" },
      { id:"suggestion_accept_channel", formName:"建议单", fieldName:"受理渠道" },
      { id:"biz_channel", formName:"投诉单", fieldName:"业务办理渠道" },
      { id:"business_category", formName:"投诉单", fieldName:"业务类别" },
      { id:"business_type", formName:"投诉单", fieldName:"业务类型" },
      { id:"cert_type", formName:"客户信息", fieldName:"证件类型" },
      { id:"complaint_level", formName:"投诉单", fieldName:"投诉等级" },
      { id:"customer_type", formName:"客户信息", fieldName:"客户类型" }
    ],
    items:{
      complaint_accept_channel:itemRows(acceptanceChannels.投诉单, "COMPLAINT_CHANNEL"),
      petition_accept_channel:itemRows(acceptanceChannels.信访单, "PETITION_CHANNEL"),
      praise_accept_channel:itemRows(acceptanceChannels.表扬单, "PRAISE_CHANNEL"),
      suggestion_accept_channel:itemRows(acceptanceChannels.建议单, "SUGGESTION_CHANNEL"),
      biz_channel:itemRows(["营业网点", "线上渠道", "电话渠道"], "BIZ_CHANNEL"),
      business_category:itemRows(["零售业务", "公司业务", "其他业务"], "BUSINESS_CATEGORY"),
      business_type:itemRows(["存款业务", "贷款业务", "支付结算"], "BUSINESS_TYPE"),
      cert_type:itemRows(["居民身份证", "护照", "其他证件"], "CERT_TYPE"),
      complaint_level:itemRows(["一般投诉", "重大投诉", "紧急投诉"], "COMPLAINT_LEVEL"),
      customer_type:itemRows(["自然人", "非自然人", "其他"], "CUSTOMER_TYPE")
    }
  };
  const cloneDictionaryData = value => JSON.parse(JSON.stringify(value));
  function loadDictionaryData() {
    try {
      const stored = JSON.parse(global.localStorage?.getItem(dictionaryStorageKey) || "null");
      if (stored?.types?.length && stored?.items) return stored;
    } catch (_) {}
    return cloneDictionaryData(defaultDictionaries);
  }
  let dictionaryData = loadDictionaryData();
  function persistDictionaryData() { global.localStorage?.setItem(dictionaryStorageKey, JSON.stringify(dictionaryData)); }
  function dictionaryType(id) { return dictionaryData.types.find(item => item.id === id) || null; }
  function dictionaryItems(id) { return (dictionaryData.items[id] || []).map(item => ({ ...item })); }
  const dictionaryStore = Object.freeze({
    types:() => dictionaryData.types.map(item => ({ ...item, count:(dictionaryData.items[item.id] || []).length })),
    items:dictionaryItems,
    createType(input) {
      const id = String(input?.id || "").trim();
      if (!id || dictionaryType(id)) throw new Error("字典编码不能为空或重复");
      dictionaryData.types.push({ id, formName:String(input.formName || "通用表单").trim(), fieldName:String(input.fieldName || "自定义字段").trim() });
      dictionaryData.items[id] = [];
      persistDictionaryData();
      return dictionaryType(id);
    },
    updateType(id, input) {
      const target = dictionaryType(id);
      if (!target) throw new Error("未找到字典类型");
      target.formName = String(input.formName || target.formName).trim();
      target.fieldName = String(input.fieldName || target.fieldName).trim();
      persistDictionaryData();
      return { ...target };
    },
    deleteType(id) {
      dictionaryData.types = dictionaryData.types.filter(item => item.id !== id);
      delete dictionaryData.items[id];
      persistDictionaryData();
    },
    createItem(typeId, input) {
      const rows = dictionaryData.items[typeId];
      const code = String(input?.code || "").trim();
      const name = String(input?.name || "").trim();
      if (!rows || !code || !name) throw new Error("字典项编码和名称不能为空");
      if (rows.some(item => item.code === code || item.name === name)) throw new Error("字典项编码或名称不能重复");
      const item = { code, name, status:input.status === "停用" ? "停用" : "启用" };
      rows.push(item);
      persistDictionaryData();
      return { ...item };
    },
    updateItem(typeId, code, input) {
      const rows = dictionaryData.items[typeId] || [];
      const item = rows.find(row => row.code === code);
      if (!item) throw new Error("未找到字典项");
      const nextName = String(input?.name || item.name).trim();
      if (!nextName || rows.some(row => row !== item && row.name === nextName)) throw new Error("字典项名称不能为空或重复");
      item.name = nextName;
      persistDictionaryData();
      return { ...item };
    },
    toggleItem(typeId, code) {
      const item = (dictionaryData.items[typeId] || []).find(row => row.code === code);
      if (!item) throw new Error("未找到字典项");
      item.status = item.status === "启用" ? "停用" : "启用";
      persistDictionaryData();
      return { ...item };
    },
    deleteItem(typeId, code) {
      dictionaryData.items[typeId] = (dictionaryData.items[typeId] || []).filter(item => item.code !== code);
      persistDictionaryData();
    }
  });
  global.XIBAdminDictionaryStore = dictionaryStore;

  function renderDictionaryManagement(context) {
    const dictionaryTypes = dictionaryStore.types();
    const selected = dictionaryTypes.find(item => item.id === moduleState.dictionaryId) || dictionaryTypes[0];
    if (!selected) return '<section class="page admin-page xib-module-admin-form-config" data-module="admin-form-config">' + context.pageHeader("字典管理", "") + surface('<div class="empty-state">暂无字典配置</div>') + '</section>';
    moduleState.dictionaryId = selected.id;
    const typeList = dictionaryTypes.map(item => '<article class="admin-dictionary-type' + (item.id === selected.id ? ' is-active' : '') + '" data-action="admin-dictionary-select" data-id="' + item.id + '"><strong>' + escapeHtml(item.formName + " · " + item.fieldName) + '</strong><code>' + item.id + '</code><div><button class="btn-link" data-action="admin-dictionary-type-edit" data-id="' + item.id + '">编辑</button><button class="btn-link admin-action-danger" data-action="admin-dictionary-type-delete" data-id="' + item.id + '">删除</button></div><small>' + item.count + ' 项</small></article>').join("");
    const rows = dictionaryStore.items(selected.id).map((item, index) => [escapeHtml(item.code), escapeHtml(item.name), escapeHtml(selected.formName), escapeHtml(selected.fieldName), String(index + 1), '<span class="tag ds-tag ' + (item.status === "启用" ? "success" : "default") + '">' + item.status + '</span>', '<div class="table-actions">' + actionButton("编辑", "admin-dictionary-item-edit", item.code) + actionButton(item.status === "启用" ? "停用" : "启用", "admin-dictionary-item-toggle", item.code) + '<button class="btn-link admin-action-danger" data-action="admin-dictionary-item-delete" data-id="' + item.code + '">删除</button></div>']);
    const left = '<aside class="admin-dictionary-types"><div class="admin-dictionary-pane-head"><strong>字典类型</strong><button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-dictionary-type-create">＋ 新增类型</button></div><div class="admin-dictionary-type-list">' + typeList + '</div></aside>';
    const right = '<section class="admin-dictionary-items"><div class="admin-dictionary-pane-head"><strong>字典项 — ' + escapeHtml(selected.formName + " · " + selected.fieldName) + '</strong><button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-dictionary-item-create">＋ 新增字典项</button></div>' + table(["编码", "名称", "适用表单", "对应字段", "排序", "状态", "操作"], rows, "admin-dictionary-items", context) + '</section>';
    return '<section class="page admin-page xib-module-admin-form-config" data-module="admin-form-config">' + context.pageHeader("字典管理", "") + surface('<div class="admin-dictionary-layout">' + left + right + '</div>') + '</section>';
  }

  function renderSmsManagement(context) {
    return '<section class="page admin-page xib-module-admin-form-config" data-module="admin-form-config">' + context.pageHeader("短信模板管理", "维护投诉管理短信模板及发送规则") + surface(renderSmsTemplateList(context)) + '</section>';
  }

  function renderList(context) {
    const activeList = moduleState.listTab === "sms" ? renderSmsTemplateList(context) : renderFormList(context);
    return '<section class="page admin-page xib-module-admin-form-config" data-module="admin-form-config">' +
      context.pageHeader("投诉管理表单", "配置投诉管理相关表单字段与短信模版") +
      surface(renderListTabs() + activeList) +
    "</section>";
  }

  function enumEditModal(item) {
    const meta = item?.enumKey ? data.enumMeta[item.enumKey] : null;
    if (!meta) return '<div class="action-dialog"><div class="action-dialog-question"><strong>当前字段不是枚举字段</strong><span>仅枚举字段支持维护字典值。</span></div></div>';
    const values = enumOverrideStore.get(item.enumKey, meta.pool);
    const rows = values.map((value, index) => '<div class="admin-enum-edit-row"><span data-admin-enum-index>' + String(index + 1).padStart(2, "0") + '</span><input class="di-input" value="' + escapeHtml(value) + '" data-admin-enum-value><button type="button" class="btn-link admin-action-danger" data-admin-enum-remove>删除</button></div>').join("");
    return '<div class="admin-enum-edit-modal">' +
      '<div class="admin-form-modal-note">维护字段：<strong>' + escapeHtml(item.name) + '</strong>。本原型仅保存前端枚举配置，不修改实际表单字段。</div>' +
      '<label class="admin-form-modal-row"><span>字段名称</span><input class="di-input" value="' + escapeHtml(item.name) + '" data-admin-enum-field-name readonly aria-readonly="true"></label>' +
      '<div class="admin-enum-edit-list">' + rows + '</div>' +
      '<button type="button" class="btn xib-btn xib-btn--secondary admin-enum-add" data-admin-enum-add>新增枚举值</button>' +
    "</div>";
  }

  function bindEnumEditModal() {
    const root = global.document?.querySelector(".admin-enum-edit-modal");
    if (!root) return;
    const list = root.querySelector(".admin-enum-edit-list");
    const renumber = () => list.querySelectorAll("[data-admin-enum-index]").forEach((node, index) => { node.textContent = String(index + 1).padStart(2, "0"); });
    root.querySelector("[data-admin-enum-add]")?.addEventListener("click", () => {
      const row = global.document.createElement("div");
      row.className = "admin-enum-edit-row";
      row.innerHTML = '<span data-admin-enum-index></span><input class="di-input" placeholder="请输入枚举值" data-admin-enum-value><button type="button" class="btn-link admin-action-danger" data-admin-enum-remove>删除</button>';
      list.appendChild(row);
      renumber();
      row.querySelector("input")?.focus();
    });
    list.addEventListener("click", event => {
      const remove = event.target.closest("[data-admin-enum-remove]");
      if (!remove) return;
      remove.closest(".admin-enum-edit-row")?.remove();
      renumber();
    });
  }

  function saveEnumEditModal(field, context) {
    const root = global.document?.querySelector(".admin-enum-edit-modal");
    if (!root) return;
    const values = [...root.querySelectorAll("[data-admin-enum-value]")].map(input => input.value);
    try {
      const previous = enumOverrideStore.get(field.enumKey, data.enumMeta[field.enumKey]?.pool || []);
      const saved = enumOverrideStore.save(field.enumKey, values);
      const pendingForForm = moduleState.pendingChanges[moduleState.detail] || (moduleState.pendingChanges[moduleState.detail] = {});
      const existing = pendingForForm[field.enumKey];
      pendingForForm[field.enumKey] = {
        field:field.name,
        oldVal:existing?.oldVal || previous.join("、"),
        newVal:saved.join("、")
      };
      context.closeOverlay();
      context.toast("字段配置已暂存，请提交修改");
      context.rerenderPage(true);
    } catch (error) {
      context.toast(error?.message || "枚举值保存失败", true);
    }
  }

  function openSubmitChangesDialog(context) {
    const changes = Object.values(moduleState.pendingChanges[moduleState.detail] || {});
    if (!changes.length) {
      context.toast("暂无需要提交的修改", true);
      return;
    }
    const changedFields = changes.map(item => item.field).join("、");
    const content = '<div class="action-dialog admin-form-submit-dialog"><div class="action-dialog-question"><strong>提交本次表单修改</strong><span>已修改字段：' + escapeHtml(changedFields) + '。请填写说明，描述本次更改内容和目的。</span></div><label class="action-full-field"><span>说明 <em>*</em></span><div class="textarea-with-count"><textarea class="di-textarea" id="admin-form-change-description" maxlength="500" placeholder="请输入本次更改说明"></textarea><small class="textarea-count" id="admin-form-change-description-count">0/500</small></div></label></div>';
    global.setTimeout(() => {
      const input = global.document?.getElementById("admin-form-change-description");
      const counter = global.document?.getElementById("admin-form-change-description-count");
      const sync = () => { if (counter && input) counter.textContent = input.value.length + "/500"; };
      sync();
      input?.addEventListener("input", sync);
    }, 0);
    context.openModal("提交修改", content, "确认提交", () => {
      const input = global.document?.getElementById("admin-form-change-description");
      const description = String(input?.value || "").trim();
      if (!description) {
        input?.focus();
        context.toast("请填写本次修改说明", true);
        return;
      }
      try {
        formChangeHistoryStore.submit({
          formName:moduleState.detail,
          changes,
          description,
          time:formatTimestamp(),
          user:context.currentUser?.() || context.currentViewLabel?.() || "系统管理员"
        });
        delete moduleState.pendingChanges[moduleState.detail];
        context.closeOverlay();
        context.toast("表单修改已提交");
        context.rerenderPage(true);
      } catch (error) {
        context.toast(error?.message || "表单修改提交失败", true);
      }
    });
  }

  const smsCategoryMeta = {
    建单告知短信: { node:"工单创建阶段提交时点击发送告知短信", sendRule:"系统默认规则：工单创建阶段提交时，由用户点击发送告知短信。" },
    处理沟通短信: { node:"工单和子单处理阶段发送沟通短信", sendRule:"系统默认规则：工单或子单处理阶段，由处理人员选择模板发送沟通短信。" },
    办结告知短信: { node:"工单和子单处理阶段发送沟通短信", sendRule:"系统默认规则：工单或子单处理阶段完成处理后，由处理人员选择模板发送办结告知短信。" }
  };

  function smsTemplateModal(template, readonly = false, isCreate = false) {
    if (!template) return "";
    const readonlyAttr = readonly ? " readonly" : "";
    const variableRows = template.variables.map((variable, index) => {
      const fixedAttr = variable.fixed ? ' readonly aria-readonly="true" data-admin-sms-variable-fixed' : readonlyAttr;
      const sourceControl = '<div class="admin-template-readonly" data-admin-sms-variable-source>' + escapeHtml(variable.source) + '</div>';
      const actions = readonly || variable.fixed
        ? "-"
        : '<button type="button" class="btn-link admin-action-danger" data-admin-sms-variable-remove>删除</button>';
      return '<tr data-admin-sms-variable-row><td data-admin-sms-variable-index>' + String(index + 1).padStart(2, "0") + '</td><td><input class="di-input" value="' + escapeHtml(variable.name) + '" data-admin-sms-variable' + fixedAttr + '></td><td>' + sourceControl + (variable.note ? '<small>' + escapeHtml(variable.note) + '</small>' : "") + '</td><td><div class="table-actions">' + actions + "</div></td></tr>";
    }).join("");
    const variableHead = '<div class="admin-sms-variable-head">' + (readonly ? "" : '<button type="button" class="btn xib-btn xib-btn--secondary" data-admin-sms-variable-add>新增变量</button>') + '</div>';
    const badges = template.variables.map(variable => '<button type="button" class="admin-sms-variable-badge" data-admin-sms-variable-badge data-variable-name="' + escapeHtml(variable.name) + '" ' + (readonly ? "disabled" : "") + '>【' + escapeHtml(variable.name) + '】</button>').join("");
    const categoryControl = readonly
      ? '<div class="admin-template-readonly">' + escapeHtml(template.category) + '</div>'
      : '<select class="di-native-select" data-admin-sms-category><option value="建单告知短信" ' + (template.category === "建单告知短信" ? "selected" : "") + '>建单告知短信</option><option value="处理沟通短信" ' + (template.category === "处理沟通短信" ? "selected" : "") + '>处理沟通短信</option><option value="办结告知短信" ' + (template.category === "办结告知短信" ? "selected" : "") + '>办结告知短信</option></select>';
    return '<div class="admin-sms-template-modal">' +
      '<div class="form-grid">' +
      '<div class="form-item span-2"><label class="form-label required">短信标题</label><div class="form-control"><input class="di-input" data-admin-sms-title value="' + escapeHtml(template.title || "") + '"' + readonlyAttr + '></div></div>' +
      '<div class="form-item admin-sms-category-field"><label class="form-label required">短信分类</label><div class="form-control">' + categoryControl + '</div></div>' +
        '<div class="form-item span-2"><label class="form-label">模板变量</label><div class="form-control">' + variableHead + '<div class="table-wrap admin-table-wrap"><table class="ds-table admin-sms-variable-table"><thead><tr><th>序号</th><th>变量名称</th><th>取值方式</th><th>操作</th></tr></thead><tbody data-admin-sms-variable-body>' + variableRows + '</tbody></table></div></div></div>' +
        '<div class="form-item span-2"><label class="form-label required">短信模板内容</label><div class="form-control"><div class="admin-sms-variable-badges" data-admin-sms-variable-badges>' + badges + '</div><textarea class="di-textarea admin-sms-template-textarea" rows="6" data-admin-sms-content' + readonlyAttr + '>' + escapeHtml(template.content) + '</textarea></div></div>' +
        '<div class="form-item span-2"><label class="form-label">短信发送节点</label><div class="form-control"><div class="admin-template-readonly" data-admin-sms-node>' + escapeHtml(template.node) + '</div></div></div>' +
        '<div class="form-item span-2"><label class="form-label">发送规则</label><div class="form-control"><div class="admin-template-readonly admin-sms-send-rule-readonly" data-admin-sms-send-rule-readonly>' + escapeHtml(template.sendRule) + '</div></div></div>' +
      '</div>' +
    "</div>";
  }

  function bindSmsTemplateModal(context) {
    const root = global.document?.querySelector(".admin-sms-template-modal");
    const body = root?.querySelector("[data-admin-sms-variable-body]");
    const content = root?.querySelector("[data-admin-sms-content]");
    if (!root || !body || !content) return;
    const renumber = () => body.querySelectorAll("[data-admin-sms-variable-index]").forEach((node, index) => { node.textContent = String(index + 1).padStart(2, "0"); });
    const renderBadges = () => {
      const target = root.querySelector("[data-admin-sms-variable-badges]");
      if (!target) return;
      target.innerHTML = [...body.querySelectorAll("[data-admin-sms-variable]")].map(input => {
        const name = String(input.value || "").trim();
        return name ? '<button type="button" class="admin-sms-variable-badge" data-admin-sms-variable-badge data-variable-name="' + escapeHtml(name) + '">【' + escapeHtml(name) + '】</button>' : "";
      }).join("");
    };
    root.querySelector("[data-admin-sms-category]")?.addEventListener("change", event => {
      const meta = smsCategoryMeta[event.target.value] || smsCategoryMeta.建单告知短信;
      root.querySelector("[data-admin-sms-node]").textContent = meta.node;
      root.querySelector("[data-admin-sms-send-rule-readonly]").textContent = meta.sendRule;
    });
    root.querySelector("[data-admin-sms-variable-add]")?.addEventListener("click", () => {
      body.insertAdjacentHTML("beforeend", '<tr data-admin-sms-variable-row><td data-admin-sms-variable-index></td><td><input class="di-input" placeholder="请输入变量名称" data-admin-sms-variable></td><td><div class="admin-template-readonly" data-admin-sms-variable-source>手工录入</div></td><td><div class="table-actions"><button type="button" class="btn-link admin-action-danger" data-admin-sms-variable-remove>删除</button></div></td></tr>');
      renumber();
      body.lastElementChild?.querySelector("[data-admin-sms-variable]")?.focus();
    });
    body.addEventListener("input", renderBadges);
    root.addEventListener("click", event => {
      const row = event.target.closest("[data-admin-sms-variable-row]");
      if (row && event.target.closest("[data-admin-sms-variable-remove]")) {
        row.remove();
        renumber();
        renderBadges();
        return;
      }
      const badge = event.target.closest("[data-admin-sms-variable-badge]");
      if (!badge && !event.target.closest("[data-admin-sms-variable-insert]")) return;
      const name = badge?.dataset.variableName || String(row?.querySelector("[data-admin-sms-variable]")?.value || "").trim();
      if (!name) {
        context.toast("请先填写变量名称");
        row?.querySelector("[data-admin-sms-variable]")?.focus();
        return;
      }
      const token = "【" + name + "】";
      const start = Number.isInteger(content.selectionStart) ? content.selectionStart : content.value.length;
      const end = Number.isInteger(content.selectionEnd) ? content.selectionEnd : start;
      if (typeof content.setRangeText === "function") content.setRangeText(token, start, end, "end");
      else content.value = content.value.slice(0, start) + token + content.value.slice(end);
      content.focus();
    });
  }

  function saveSmsTemplateModal(templateId, context, isCreate = false) {
    const root = global.document?.querySelector(".admin-sms-template-modal");
    if (!root) return;
    try {
      const category = root.querySelector("[data-admin-sms-category]")?.value;
      const input = {
        title:root.querySelector("[data-admin-sms-title]")?.value,
        category,
        content:root.querySelector("[data-admin-sms-content]")?.value,
        variables:[...root.querySelectorAll("[data-admin-sms-variable-row]")].map(row => ({ name:row.querySelector("[data-admin-sms-variable]")?.value, source:row.querySelector("[data-admin-sms-variable-source]")?.textContent })),
        updateTime:formatTimestamp()
      };
      if (isCreate) smsTemplateStore.create(input);
      else smsTemplateStore.save(templateId, input);
      context.closeOverlay();
      context.toast("短信模板配置已保存");
      context.rerenderPage(true);
    } catch (error) {
      context.toast(error?.message || "短信模板保存失败", true);
    }
  }

  function renderDetail(context) {
    const name = moduleState.detail;
    const rows = (data.fields[name] || []).filter(item => item.enumKey || item.type === "附件模板").map(item => {
      if (item.type === "附件模板") {
        const template = templateStore.get();
        const fileCell = '<div class="admin-template-file"><strong class="admin-template-file-name">' + escapeHtml(template.fileName) + '</strong><small class="admin-template-file-meta">' + escapeHtml(template.updatedBy) + ' · ' + escapeHtml(template.updatedAt) + '</small></div>';
        const uploadAction = canMaintainTemplate(context)
          ? '<label class="btn-link admin-template-upload">上传新模板<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden data-admin-form-template-input></label>'
          : '<span class="admin-template-readonly">仅超级管理员可维护</span>';
        return [escapeHtml(item.name), escapeHtml(item.type), fileCell, uploadAction];
      }
      const values = item.enumKey && data.enumMeta[item.enumKey] ? enumOverrideStore.get(item.enumKey, data.enumMeta[item.enumKey].pool).join("、") : "-";
      const operation = item.enumKey ? actionButton("编辑", "admin-form-field-edit", item.enumKey) : disabledAction("非枚举字段不支持维护枚举值");
      return [escapeHtml(item.name), escapeHtml(item.type), escapeHtml(truncateText(values)), operation];
    });
    const templateHistory = name === "异常投诉" ? templateStore.history().map(item => ({ time:item.time, user:item.user, field:item.field, oldVal:item.before, newVal:item.after, desc:item.desc })) : [];
    const historyRows = [...formChangeHistoryStore.list(name), ...templateHistory, ...(data.detailHistory[name] || [])].map(item => [escapeHtml(item.time), escapeHtml(item.user), escapeHtml(item.field), escapeHtml(item.desc)]);
    const actions = '<button class="btn xib-btn xib-btn--secondary" data-action="admin-form-list">返回列表</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-form-submit">提交修改</button>';
    return '<section class="page admin-page xib-module-admin-form-config" data-module="admin-form-config">' + context.pageHeader(escapeHtml(name), "字段级编辑", actions) + surface('<section class="admin-card-section admin-list-card"><h3>字段配置</h3>' + table(["字段名称", "字段类型", "枚举值", "操作"], rows, "admin-form-fields", context) + '</section><section class="admin-card-section admin-list-card"><h3>修改记录</h3>' + table(["操作时间", "操作人", "修改字段", "说明"], historyRows, "admin-form-detail-history", context) + "</section>") + "</section>";
  }

  registry.register({
    name: "admin-form-config",
    routes: ["admin-form-config", "admin-form-complaint", "admin-form-dictionary", "admin-form-sms", "admin-form-review"],
    reset() { moduleState.detail = ""; },
    render(page, context) {
      if (page === "admin-form-review") moduleState.domain = "review";
      if (page === "admin-form-dictionary") { moduleState.domain = "complaint"; moduleState.detail = ""; return renderDictionaryManagement(context); }
      if (page === "admin-form-sms") { moduleState.domain = "complaint"; moduleState.detail = ""; return renderSmsManagement(context); }
      if (page === "admin-form-complaint" || page === "admin-form-config") moduleState.domain = "complaint";
      if (moduleState.domain === "review") return renderReviewEmpty(context);
      return moduleState.detail ? renderDetail(context) : renderList(context);
    },
    handleAction(action, payload, context) {
      if (action === "admin-form-domain") {
        moduleState.domain = payload.id === "review" ? "review" : "complaint";
        moduleState.detail = "";
        moduleState.listTab = "forms";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-dictionary-select") {
        const types = dictionaryStore.types();
        moduleState.dictionaryId = types.some(item => item.id === payload.id) ? payload.id : types[0]?.id || "";
        context.rerenderPage(false, { instant:true });
        return true;
      }
      if (action === "admin-dictionary-item-toggle") {
        const item = dictionaryStore.toggleItem(moduleState.dictionaryId, payload.id);
        context.toast("字典项已" + item.status);
        context.rerenderPage(true);
        return true;
      }
      if (/^admin-dictionary-(type|item)-(create|edit|delete)$/.test(action)) {
        const isDelete = action.endsWith("delete");
        const isType = action.includes("-type-");
        const isCreate = action.endsWith("create");
        const verb = isCreate ? "新增" : action.endsWith("edit") ? "编辑" : "删除";
        const selectedType = dictionaryType(isType ? payload.id : moduleState.dictionaryId);
        const selectedItem = dictionaryStore.items(moduleState.dictionaryId).find(item => item.code === payload.id);
        const content = isDelete
          ? '<div class="action-dialog"><div class="action-dialog-question"><strong>确认删除' + (isType ? "字典类型" : "字典项") + '？</strong><span>删除后将无法恢复，请确认操作。</span></div></div>'
          : '<div class="action-dialog admin-dictionary-edit-dialog">' + (isType
            ? '<label class="action-full-field"><span>字典编码</span><input class="di-input" data-admin-dictionary-code value="' + escapeHtml(selectedType?.id || "") + '" ' + (isCreate ? "" : "readonly") + '></label><label class="action-full-field"><span>适用表单</span><input class="di-input" data-admin-dictionary-form value="' + escapeHtml(selectedType?.formName || "") + '"></label><label class="action-full-field"><span>对应字段</span><input class="di-input" data-admin-dictionary-field value="' + escapeHtml(selectedType?.fieldName || "") + '"></label>'
            : '<label class="action-full-field"><span>字典项编码</span><input class="di-input" data-admin-dictionary-code value="' + escapeHtml(selectedItem?.code || "") + '" ' + (isCreate ? "" : "readonly") + '></label><label class="action-full-field"><span>字典项名称</span><input class="di-input" data-admin-dictionary-name value="' + escapeHtml(selectedItem?.name || "") + '"></label>') + '</div>';
        context.openModal(verb + (isType ? "字典类型" : "字典项"), content, isDelete ? "确认删除" : "保存", () => {
          try {
            if (isDelete) {
              if (isType) {
                dictionaryStore.deleteType(payload.id);
                moduleState.dictionaryId = dictionaryStore.types()[0]?.id || "";
              } else dictionaryStore.deleteItem(moduleState.dictionaryId, payload.id);
            } else {
              const root = global.document?.querySelector(".admin-dictionary-edit-dialog");
              const code = String(root?.querySelector("[data-admin-dictionary-code]")?.value || "").trim();
              if (isType) {
                const values = { formName:root?.querySelector("[data-admin-dictionary-form]")?.value, fieldName:root?.querySelector("[data-admin-dictionary-field]")?.value };
                if (isCreate) { dictionaryStore.createType({ id:code, ...values }); moduleState.dictionaryId = code; }
                else dictionaryStore.updateType(payload.id, values);
              } else {
                const name = root?.querySelector("[data-admin-dictionary-name]")?.value;
                if (isCreate) dictionaryStore.createItem(moduleState.dictionaryId, { code, name });
                else dictionaryStore.updateItem(moduleState.dictionaryId, payload.id, { name });
              }
            }
            context.closeOverlay();
            context.toast((isType ? "字典类型" : "字典项") + "已" + verb);
            context.rerenderPage(true);
          } catch (error) { context.toast(error?.message || "字典配置保存失败", true); }
        });
        return true;
      }
      if (action === "admin-form-list-tab") {
        moduleState.listTab = payload.id === "sms" ? "sms" : "forms";
        moduleState.detail = "";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-form-detail") {
        moduleState.domain = "complaint";
        moduleState.detail = data.forms.some(item => item.name === payload.id) ? payload.id : data.forms[0].name;
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-form-list") {
        moduleState.detail = "";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-form-field-edit") {
        const field = (data.fields[moduleState.detail] || []).find(item => item.enumKey === payload.id);
        context.openModal("编辑枚举值", enumEditModal(field), "保存字段配置", () => saveEnumEditModal(field, context));
        bindEnumEditModal();
        return true;
      }
      if (action === "admin-form-submit") {
        openSubmitChangesDialog(context);
        return true;
      }
      if (action === "admin-form-sms-view") {
        const template = smsTemplateStore.get(payload.id);
        context.openModal("查看短信模板", smsTemplateModal(template, true), "关闭", () => { context.closeOverlay(); });
        return true;
      }
      if (action === "admin-form-sms-edit") {
        const template = smsTemplateStore.get(payload.id);
        context.openModal("编辑短信模板", smsTemplateModal(template, false), "保存短信模板", () => saveSmsTemplateModal(payload.id, context));
        bindSmsTemplateModal(context);
        return true;
      }
      if (action === "admin-form-sms-create") {
        const template = { id:"", title:"", category:"建单告知短信", node:smsCategoryMeta.建单告知短信.node, content:"", variables:[{ name:"投诉编号", fixed:true, source:"系统带入", note:"取值优先取转送函号，无转送函号时取工单编号" }], sendRule:smsCategoryMeta.建单告知短信.sendRule };
        context.openModal("新增短信模板", smsTemplateModal(template, false, true), "保存短信模板", () => saveSmsTemplateModal("", context, true));
        bindSmsTemplateModal(context);
        return true;
      }
      if (action === "admin-form-sms-toggle") {
        const template = smsTemplateStore.get(payload.id);
        smsTemplateStore.toggle(payload.id, !template.enabled, formatTimestamp());
        context.toast("短信模板状态已更新");
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-form-sms-delete") {
        const template = smsTemplateStore.get(payload.id);
        if (!template) return true;
        context.openModal("删除短信模板", '<div class="action-dialog"><div class="action-dialog-question"><strong>确认删除该' + escapeHtml(template.category) + '吗？</strong><span>删除后该模板将不再出现在短信模板列表中。</span></div></div>', "确认删除", () => {
          smsTemplateStore.delete(payload.id, formatTimestamp());
          context.closeOverlay();
          context.toast("短信模板已删除");
          context.rerenderPage(true);
        });
        return true;
      }
      return false;
    },
    afterRender(root, page, context) {
      const input = root.querySelector("[data-admin-form-template-input]");
      if (!input) return;
      if (!canMaintainTemplate(context)) {
        input.remove();
        return;
      }
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!/\.docx$/i.test(file.name)) {
          context.toast("仅支持上传 .docx 文件");
          input.value = "";
          return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          try {
            templateStore.save({ fileName:file.name, mimeType:file.type, dataUrl:String(reader.result || ""), updatedAt:formatTimestamp() }, { profileId:context.state?.roleProfile, displayName:context.currentViewLabel?.() || "超级管理员" });
            context.toast("附件模板已更新");
            context.rerenderPage(true);
          } catch (error) {
            context.toast(error?.message || "模板保存失败，请缩小文件后重试");
          }
        });
        reader.addEventListener("error", () => context.toast("模板读取失败，请重新选择文件"));
        reader.readAsDataURL(file);
      });
    }
  });
})(window);
