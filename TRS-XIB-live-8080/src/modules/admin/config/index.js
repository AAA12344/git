(function registerAdminConfig(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  if (!registry) throw new Error("XIBModuleRegistry must load before admin-config.");

  const moduleState = { domain: "complaint", alertDetail: "", alertMode: "detail", alertScope: "bank", alertAdminScope: "super" };

  /* 预警规则模板来自 src/core/alert-rule-config.js —— 唯一数据源，
     投诉管理的「智能预警」读同一份配置，避免两处规则/摘要文案不一致。 */
  const alertConfigs = global.XIB_ALERT_RULE_CONFIG?.templates;
  if (!alertConfigs) throw new Error("XIB_ALERT_RULE_CONFIG must load before admin-config.");
  const defaultAlertRuleInstances = alertConfigs.map(item => Object.freeze({
    id: "default-" + item.id,
    templateId: item.id,
    orgScope: "全行",
    source: "系统默认",
    inheritedFrom: "",
    enabled: item.enabled,
    locked: true,
    variables: item.variables.filter(variable => !(
      (item.id === "full-ticket-volume" || item.id === "regulatory-transfer-volume") &&
      variable.name === "标准差倍数"
    ))
  }));
  const configurableOrganizationNames = ["总行", "北京分行", "上海分行", "厦门分行", "福州分行", "珠海分行", "宁德分行", "龙岩分行", "泉州分行", "漳州分行", "莆田分行", "三明分行", "南平分行"];
  const branchBaselineRuleInstances = alertConfigs.filter(item => item.scopeConfigurable).map(item => Object.freeze({
    id:"baseline-" + item.id,
    templateId:item.id,
    orgScope:"总行+12家分行",
    orgScopes:Object.freeze([...configurableOrganizationNames]),
    source:"系统铺底",
    inheritedFrom:"",
    enabled:item.enabled,
    locked:true,
    variables:item.variables
  }));
  const alertRuleInstances = [...defaultAlertRuleInstances, ...branchBaselineRuleInstances];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function actionButton(label, action, id = "") {
    return '<button class="btn-link" data-action="' + action + '" data-id="' + escapeHtml(id) + '">' + label + "</button>";
  }

  function disabledAction(label) {
    return '<span class="admin-action-unavailable" title="' + escapeHtml(label) + '">-</span>';
  }

  function ruleScopeGroup(rule) {
    if (rule.orgScope === "全行") return "bank";
    return "branch";
  }

  function renderAlertScopeTabs() {
    const tabs = [
      ["bank", "全行"],
      ["branch", "总行/分行"]
    ];
    return '<div class="tabs lib-tabs-line admin-inner-tabs admin-alert-scope-tabs">' +
      tabs.map(([id, label]) => '<button class="tab ' + (moduleState.alertScope === id ? "is-active" : "") + '" data-action="admin-alert-scope" data-id="' + id + '">' + label + "</button>").join("") +
      "</div>";
  }

  function toggle(on = true, id = "") {
    return '<button class="lib-switch admin-switch ' + (on ? "is-on" : "") + '" type="button" role="switch" aria-checked="' + (on ? "true" : "false") + '" data-action="admin-switch-toggle" data-id="' + id + '" title="点击切换启用状态"><span></span></button>';
  }

  function table(headers, rows, scope, context) {
    return '<div class="table-wrap admin-table-wrap"><table class="ds-table"><thead><tr>' + headers.map(header => "<th>" + header + "</th>").join("") + "</tr></thead><tbody>" + rows.map(row => "<tr>" + row.map(cell => "<td>" + cell + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>" + context.renderPagination(rows.length, scope, 10);
  }

  function templateById(id) {
    return alertConfigs.find(item => item.id === id) || alertConfigs[0];
  }

  function currentRule() {
    return alertRuleInstances.find(item => item.id === moduleState.alertDetail) || alertRuleInstances[0];
  }

  function currentAlert() {
    const rule = moduleState.alertMode === "create" ? null : currentRule();
    return templateById(rule?.templateId || moduleState.alertDetail || alertConfigs[0].id);
  }

  function alertTypeSelect(selectedId = "") {
    const selectableAlerts = alertConfigs.filter(item => item.scopeConfigurable);
    return '<select class="di-native-select" data-admin-alert-type>' +
      selectableAlerts.map(item => '<option value="' + escapeHtml(item.id) + '" ' + (item.id === selectedId ? "selected" : "") + ">" + escapeHtml(item.type) + "</option>").join("") +
      "</select>";
  }

  function organizationRows() {
    return global.XIB_PROTOTYPE_CONFIG?.organizationTree?.organizations || [];
  }

  function orgOptionsByType(type, fallback) {
    const rows = organizationRows().filter(item => item.type === type);
    return rows.length ? rows.map(item => ({ id: item.id, name: item.name })) : fallback.map(name => ({ id: name, name }));
  }

  function alertOrgScopeOptions(scope) {
    const branchFallback = ["北京分行", "上海分行", "厦门分行", "福州分行", "珠海分行", "宁德分行", "龙岩分行", "泉州分行", "漳州分行", "莆田分行", "三明分行", "南平分行"];
    if (scope === "ordinary") return orgOptionsByType("304903", branchFallback);
    const headOffice = organizationRows().find(item => item.name === "总行" || item.id === "000100011001");
    const head = headOffice ? [{ id: headOffice.id, name: headOffice.name }] : [{ id: "000100011001", name: "总行" }];
    return head.concat(orgOptionsByType("304903", branchFallback));
  }

  function renderOrgScopeControl(context, alert, rule = null) {
    if (!alert.scopeConfigurable) {
      return "全行全量数据";
    }
    if (rule && ruleScopeGroup(rule) === "bank") {
      return escapeHtml(rule.orgScope || "全行");
    }
    const options = alertOrgScopeOptions(moduleState.alertAdminScope);
    const placeholder = moduleState.alertAdminScope === "ordinary" ? "普通管理员仅可选择所属分行" : "超级管理员可选择总行和12个分行";
    const field = {
      type: "hierarchyCascader",
      dictionary: "organizationTree",
      tree: options.map(item => ({ label: item.name })),
      levels: ["总行/分行", "机构/下辖支行"],
      leafLevel: 2,
      multiple: true,
      nonLeafSelectable: true,
      searchable: true,
      placeholder: rule?.orgScope || "请选择总行或分行（可多选）",
      defaultValue: rule?.orgScopes ? [...rule.orgScopes] : String(rule?.orgScope || "").split("、").filter(Boolean)
    };
    if (typeof context.renderHierarchyCascaderControl === "function") {
      return '<div class="admin-alert-org-scope-field">' +
        context.renderHierarchyCascaderControl("admin-alert-org-scope-" + alert.id, field, "admin.config.alert." + alert.id + ".orgScope", false) +
        '<span>' + placeholder + "；同一预警类型下，各机构仅允许一条新增规则。</span>" +
        "</div>";
    }
    return '<div class="admin-alert-org-scope-field">' +
      '<select class="di-native-select admin-alert-org-select" multiple data-admin-alert-org-scope-single>' +
        options.map(item => '<option value="' + escapeHtml(item.id) + '" ' + ((rule?.orgScopes || []).includes(item.name) ? "selected" : "") + '>' + escapeHtml(item.name) + "</option>").join("") +
      "</select>" +
      '<span>' + placeholder + "；支持单选或多选。</span>" +
      "</div>";
  }

  function editableVariable(variable, index) {
    if (variable.name === "统计周期" || variable.name === "时间范围") {
      return '<select class="di-native-select admin-alert-rule-control" data-admin-alert-rule-field="' + index + '"><option value="7" ' + (variable.value === 7 ? "selected" : "") + '>7天</option><option value="14" ' + (variable.value === 14 ? "selected" : "") + '>14天</option><option value="30" ' + (variable.value === 30 ? "selected" : "") + '>30天</option><option value="90" ' + (variable.value === 90 ? "selected" : "") + ">90天</option></select>";
    }
    if (variable.name === "高风险标签") {
      const tags = ["舆情风险", "重复投诉", "监管关注", "群体性风险", "重大投诉"];
      const selected = String(variable.value || "").split(/[、,，]/).map(item => item.trim()).filter(Boolean);
      return '<select class="di-native-select admin-alert-rule-control" multiple size="5" data-admin-alert-rule-field="' + index + '">' +
        tags.map(tag => '<option value="' + escapeHtml(tag) + '" ' + (selected.includes(tag) ? "selected" : "") + ">" + escapeHtml(tag) + "</option>").join("") +
        "</select><span class=\"admin-alert-rule-help\">仅展示本系统维护的高风险标签。</span>";
    }
    const step = variable.name === "标准差倍数" ? ' step="0.1"' : "";
    return '<div class="admin-alert-rule-input"><input class="di-input admin-alert-rule-control" type="number"' + step + ' value="' + escapeHtml(variable.value) + '" data-admin-alert-rule-field="' + index + '"><span>' + escapeHtml(variable.unit) + "</span></div>";
  }

  function descItem(label, value, wide = false) {
    return '<div class="' + (wide ? "is-wide" : "") + '"><dt>' + escapeHtml(label) + "</dt><dd>" + value + "</dd></div>";
  }

  function editableRule(ruleText, variables) {
    const controls = variables.length
      ? '<div class="admin-alert-rule-inline-controls">' + variables.map((variable, index) =>
        '<label class="admin-alert-rule-inline-control"><span>' + escapeHtml(variable.name) + "</span>" + editableVariable(variable, index) + "</label>"
      ).join("") + "</div>"
      : "";
    return '<div class="admin-alert-rule-editor"><p>' + escapeHtml(ruleText) + "</p>" + controls + "</div>";
  }

  function scopedRuleText(rule, orgScope) {
    const full = String(rule.rule || "");
    const bankMarker = "全行规则：";
    const branchMarker = "总行及具体分行规则：";
    const bankIdx = full.indexOf(bankMarker);
    const branchIdx = full.indexOf(branchMarker);
    if (bankIdx === -1 && branchIdx === -1) return full;
    if (orgScope === "全行") {
      if (bankIdx === -1) return full;
      return full.slice(bankIdx, branchIdx > -1 ? branchIdx : full.length).trim();
    }
    if (branchIdx > -1) return full.slice(branchIdx).trim();
    return full;
  }

  function renderAlertRuleSection(alert, variables, ruleInstance = null) {
    const orgScope = ruleInstance?.orgScope || "";
    const rules = alert.rules.map((rule, ruleIndex) => {
      const title = alert.rules.length > 1 ? "预警规则 " + (ruleIndex + 1) : "预警规则";
      const ruleText = ruleInstance ? scopedRuleText(rule, orgScope) : rule.rule;
      const readonlyItems = [
        descItem("场景类型", escapeHtml(rule.scene)),
        descItem("数据来源", escapeHtml(rule.source), true),
        descItem("判断规则", editableRule(ruleText, variables), true),
        descItem("推送角色", escapeHtml(rule.push), true)
      ].join("");
      return '<section class="panel detail-section admin-alert-rule-section"><div class="panel-head"><span class="panel-title">' + title + '</span></div><dl class="ds-descriptions detail-descriptions admin-alert-rule-descriptions">' + readonlyItems + "</dl></section>";
    }).join("");
    return '<div class="detail-sections admin-alert-rule-detail-sections">' + rules + "</div>";
  }

  function renderAlertList(context) {
    const filteredRules = alertRuleInstances.filter(rule => ruleScopeGroup(rule) === moduleState.alertScope);
    const rows = filteredRules.map(rule => {
      const template = templateById(rule.templateId);
      const variableSummary = rule.variables.length
        ? rule.variables.map(variable => variable.name + (variable.name === "标准差倍数" ? "=" : "") + variable.value + variable.unit).join(" / ")
        : "系统固定启用";
      return [
        escapeHtml(template.type),
        escapeHtml(rule.orgScope),
        escapeHtml(rule.source),
        escapeHtml(variableSummary),
        toggle(rule.enabled, "alert-status-" + rule.id),
        '<div class="table-actions">' + actionButton("查看", "admin-alert-detail", rule.id) + actionButton("编辑", "admin-alert-detail", rule.id) + (rule.locked ? disabledAction("删除") : actionButton("删除", "admin-modal", "删除预警规则")) + "</div>"
      ];
    });
    const note = '<div class="admin-info-bar">全行TAB展示9类系统默认规则；总行/分行TAB展示6类系统铺底量类规则。新增规则可选择一个或多个总行/分行，同一预警类型下每个机构仅允许一条新增规则。</div>';
    const head = '<div class="admin-section-head"><h3>预警规则</h3>' + (moduleState.alertScope === "branch"
      ? '<button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-alert-create">新增量类规则</button>'
      : '<span class="admin-action-unavailable">系统默认规则不允许新增</span>') + '</div>';
    const empty = rows.length ? "" : '<div class="empty-state">当前暂无量类规则。</div>';
    return '<section class="admin-card-section admin-config-section admin-alert-list-section">' + head + note + renderAlertScopeTabs() + table(["预警类型", "机构范围", "规则来源", "数值配置", "启用状态", "操作"], rows, "admin-alert-config", context) + empty + "</section>";
  }

  function renderAlertDetail(context) {
    const rule = moduleState.alertMode === "create" ? null : currentRule();
    const alert = currentAlert();
    const isCreate = moduleState.alertMode === "create";
    const previewRule = rule || (isCreate ? { orgScope: "总行" } : null);
    const alertSummary = alert.rules.map(item => item.summary).filter(Boolean).join("\n");
    const actions = '<button class="btn xib-btn xib-btn--secondary" data-action="admin-alert-list">返回列表</button>' + (isCreate
      ? '<button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-alert-copy-save">保存</button>'
      : '<button class="btn xib-btn xib-btn--primary btn-primary" data-action="admin-alert-save">保存配置</button>');
    const ruleSource = rule?.source || "机构单独配置";
    return '<section class="page admin-page xib-module-admin-config" data-module="admin-config">' +
      context.pageHeader(isCreate ? "新增量类规则" : escapeHtml(alert.type), "选择现有量类规则类型，并为一个或多个总行/分行配置独立数值", actions) +
      '<div class="detail-sections admin-detail-sections"><section class="panel detail-section admin-detail-section"><div class="panel-head"><span class="panel-title">预警信息</span></div><dl class="ds-descriptions detail-descriptions admin-detail-descriptions">' +
        descItem("预警类型", isCreate ? alertTypeSelect(alert.id) : escapeHtml(alert.type)) +
        descItem("机构范围", renderOrgScopeControl(context, alert, rule)) +
        descItem("规则来源", escapeHtml(ruleSource)) +
        descItem("启用状态", toggle(rule?.enabled ?? alert.enabled, "alert-detail-status-" + (rule?.id || alert.id))) +
        descItem("预警摘要", escapeHtml(alertSummary), true) +
      '</dl></section></div>' +
      renderAlertRuleSection(alert, rule?.variables || alert.variables, previewRule) +
    "</section>";
  }

  function renderDomainTabs() {
    return '<div class="tabs lib-tabs-line admin-inner-tabs admin-domain-tabs">' +
      '<button class="tab ' + (moduleState.domain === "complaint" ? "is-active" : "") + '" data-action="admin-config-domain" data-id="complaint">投诉管理</button>' +
      '<button class="tab ' + (moduleState.domain === "review" ? "is-active" : "") + '" data-action="admin-config-domain" data-id="review">消保审查</button>' +
    "</div>";
  }

  function renderReviewEmpty() {
    return '<section class="admin-card-section admin-config-section"><h3>消保审查参数配置</h3><div class="empty-state">暂无配置内容，待后续补充。</div></section>';
  }

  function alertSaveSummary(template, orgScope, variables) {
    const variableText = variables.length ? variables.map(variable => variable.name + "：" + variable.value + variable.unit).join("；") : "系统固定规则";
    return '<div class="admin-alert-save-modal"><dl class="ds-descriptions detail-descriptions admin-detail-descriptions">' +
      descItem("预警类型", escapeHtml(template.type)) +
      descItem("机构范围", escapeHtml(orgScope || "全行")) +
      descItem("数值参数", escapeHtml(variableText), true) +
      '</dl><p class="admin-form-modal-note">确认后将保存当前预警参数配置。</p></div>';
  }

  function alertDraft(payload, context, template, rule = null) {
    const actionRoot = payload.trigger?.closest?.('[data-module="admin-config"]') || context.root;
    const scopeSelect = actionRoot?.querySelector?.("[data-admin-alert-org-scope-single]");
    const scopeHidden = actionRoot?.querySelector?.('.admin-alert-org-scope-field input[type="hidden"]');
    const payloadScopes = Array.isArray(payload.orgScopeNames) ? payload.orgScopeNames : [];
    const fallbackScopes = rule?.orgScopes || (rule?.orgScope ? String(rule.orgScope).split("、") : []);
    const rawScopes = payloadScopes.length ? payloadScopes : String(scopeSelect?.selectedOptions?.[0]?.text || scopeHidden?.value || payload.orgScopeName || fallbackScopes.join(",")).split(",");
    const orgScopes = [...new Set(rawScopes.map(value => String(value).split("/")[0].trim()).filter(Boolean))];
    const variables = (template.variables || []).map((variable, index) => {
      const input = actionRoot?.querySelector?.('[data-admin-alert-rule-field="' + index + '"]');
      const payloadValue = Array.isArray(payload.variableValues) ? payload.variableValues[index] : undefined;
      const parsed = Number(payloadValue ?? input?.value);
      return Object.freeze({ name:variable.name, value:Number.isFinite(parsed) ? parsed : (rule?.variables?.[index]?.value ?? variable.value), unit:variable.unit });
    });
    return { actionRoot, orgScopes, orgScope:orgScopes.join("、"), variables };
  }

  registry.register({
    name: "admin-config",
    routes: ["admin-config", "admin-config-complaint", "admin-config-review"],
    reset() { moduleState.alertDetail = ""; moduleState.alertMode = "detail"; },
    render(page, context) {
      if (page === "admin-config-review") moduleState.domain = "review";
      if (page === "admin-config-complaint" || page === "admin-config") moduleState.domain = "complaint";
      if (moduleState.domain === "complaint" && moduleState.alertDetail) return renderAlertDetail(context);
      const content = moduleState.domain === "review" ? renderReviewEmpty() : renderAlertList(context);
      return '<section class="page admin-page xib-module-admin-config" data-module="admin-config">' + context.pageHeader(moduleState.domain === "review" ? "消保审查参数" : "投诉管理参数", "维护投诉管理与消保审查参数") + content + "</section>";
    },
    afterRender(root, page, context) {
      const typeSelect = root?.querySelector?.("[data-admin-alert-type]");
      if (!typeSelect || typeSelect.dataset.alertTypeBound === "true") return;
      typeSelect.dataset.alertTypeBound = "true";
      typeSelect.addEventListener("change", () => {
        moduleState.alertDetail = typeSelect.value;
        context.rerenderPage(true);
      });
    },
    handleAction(action, payload, context) {
      if (action === "admin-config-domain") {
        moduleState.domain = payload.id === "review" ? "review" : "complaint";
        moduleState.alertDetail = "";
        moduleState.alertMode = "detail";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-alert-scope") {
        moduleState.alertScope = ["bank", "branch", "subbranch"].includes(payload.id) ? payload.id : "bank";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-alert-detail") {
        moduleState.domain = "complaint";
        moduleState.alertDetail = payload.id || alertRuleInstances[0].id;
        moduleState.alertMode = "detail";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-alert-create") {
        moduleState.domain = "complaint";
        moduleState.alertDetail = alertConfigs[0].id;
        moduleState.alertMode = "create";
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-alert-copy-save") {
        const actionRoot = payload.trigger?.closest?.('[data-module="admin-config"]') || context.root;
        const typeSelect = actionRoot?.querySelector?.("[data-admin-alert-type]");
        const template = templateById(typeSelect?.value || payload.templateId || currentAlert().id);
        const draft = alertDraft(payload, context, template);
        if (!template.scopeConfigurable) {
          context.toast("该预警类型不支持按机构范围复制");
          return true;
        }
        if (!draft.orgScopes.length) {
          context.toast("请选择总行或分行");
          return true;
        }
        const duplicateScopes = alertRuleInstances
          .filter(rule => !rule.locked && rule.templateId === template.id)
          .flatMap(rule => rule.orgScopes || [rule.orgScope])
          .filter(scope => draft.orgScopes.includes(scope));
        if (duplicateScopes.length) {
          context.toast([...new Set(duplicateScopes)].join("、") + "已存在" + template.type + "规则");
          return true;
        }
        if (!payload.confirmed) {
          context.openModal("确认保存预警参数", alertSaveSummary(template, draft.orgScope, draft.variables), "确认保存", () => {
            registry.handleAction("admin-alert-copy-save", { ...payload, confirmed:true, templateId:template.id, orgScopeNames:draft.orgScopes, variableValues:draft.variables.map(variable => variable.value) }, context);
          });
          return true;
        }
        const id = "added-" + template.id + "-" + Date.now();
        alertRuleInstances.push(Object.freeze({
          id,
          templateId: template.id,
          orgScope:draft.orgScope,
          orgScopes:Object.freeze(draft.orgScopes),
          source: "新增量类规则",
          inheritedFrom: "",
          enabled: true,
          locked: false,
          variables: Object.freeze(draft.variables)
        }));
        moduleState.alertScope = "branch";
        moduleState.alertDetail = "";
        moduleState.alertMode = "detail";
        context.closeOverlay?.();
        context.toast("已新增“" + draft.orgScope + "”量类规则");
        context.rerenderPage(true);
        return true;
      }
      if (action === "admin-alert-save") {
        const rule = currentRule();
        const template = templateById(rule.templateId);
        const draftTemplate = { ...template, variables:rule.variables };
        const draft = alertDraft(payload, context, draftTemplate, rule);
        const duplicateScopes = alertRuleInstances
          .filter(item => item.id !== rule.id && !item.locked && item.templateId === template.id)
          .flatMap(item => item.orgScopes || [item.orgScope])
          .filter(scope => draft.orgScopes.includes(scope));
        if (duplicateScopes.length) {
          context.toast([...new Set(duplicateScopes)].join("、") + "已存在" + template.type + "规则");
          return true;
        }
        context.openModal("确认保存预警参数", alertSaveSummary(template, draft.orgScope || rule.orgScope, draft.variables), "确认保存", () => {
          const index = alertRuleInstances.findIndex(item => item.id === rule.id);
          alertRuleInstances[index] = Object.freeze({ ...rule, orgScope:draft.orgScope || rule.orgScope, orgScopes:Object.freeze(draft.orgScopes.length ? draft.orgScopes : (rule.orgScopes || [])), variables:Object.freeze(draft.variables) });
          context.closeOverlay?.();
          context.toast("预警参数配置已保存");
          context.rerenderPage(true);
        });
        return true;
      }
      if (action === "admin-alert-list") {
        moduleState.alertDetail = "";
        moduleState.alertMode = "detail";
        context.rerenderPage(true);
        return true;
      }
      return false;
    }
  });
})(window);
