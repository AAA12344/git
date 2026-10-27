(function exposeAdminFormConfigData(global) {
  "use strict";

  const templateStorageKey = "xib-admin-form-template-overrides-v1";
  const enumStorageKey = "xib-admin-form-enum-overrides-v1";
  const formChangeHistoryStorageKey = "xib-admin-form-change-history-v1";
  const smsTemplateStorageKey = "xib-admin-sms-template-overrides-v1";
  const smsTemplateCustomStorageKey = "xib-admin-sms-template-custom-v1";
  const smsTemplateHistoryStorageKey = "xib-admin-sms-template-history-v1";
  const smsTemplateDeletedStorageKey = "xib-admin-sms-template-deleted-v1";
  const templateMaxBytes = 2 * 1024 * 1024;
  const defaultAbnormalTemplate = Object.freeze({
    fieldName: "异常投诉识别情况报告",
    fileName: "异常投诉识别情况报告.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    dataUrl: "",
    updatedAt: "2026-08-19 09:47:36",
    updatedBy: "系统管理员"
  });

  function readTemplateState() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(templateStorageKey) || "null");
      if (!parsed || typeof parsed !== "object") return { current: defaultAbnormalTemplate, history: [] };
      return {
        current: { ...defaultAbnormalTemplate, ...(parsed.current || {}) },
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    } catch (_) {
      return { current: defaultAbnormalTemplate, history: [] };
    }
  }

  const templateStore = Object.freeze({
    storageKey: templateStorageKey,
    get() {
      return Object.freeze({ ...readTemplateState().current });
    },
    history() {
      return Object.freeze(readTemplateState().history.map(item => Object.freeze({ ...item })));
    },
    save(input, actor = {}) {
      if (actor.profileId !== "technology-super-admin") throw new Error("仅超级管理员可维护附件模板");
      const fileName = String(input?.fileName || "").trim();
      const dataUrl = String(input?.dataUrl || "").trim();
      if (!/\.docx$/i.test(fileName)) throw new Error("仅支持上传 .docx 文件");
      const encodedFile = dataUrl.match(/^data:[^,]*;base64,([^,]+)$/i)?.[1] || "";
      const fileBytes = encodedFile ? Math.floor(encodedFile.length * 3 / 4) - ((encodedFile.match(/=+$/) || [""])[0].length) : 0;
      if (!encodedFile.startsWith("UEsDB")) throw new Error("请上传有效的 Word 模板文件");
      if (fileBytes > templateMaxBytes) throw new Error("模板文件不能超过 2MB");
      const state = readTemplateState();
      const current = {
        ...defaultAbnormalTemplate,
        fileName,
        mimeType: String(input?.mimeType || defaultAbnormalTemplate.mimeType),
        dataUrl,
        updatedAt: String(input?.updatedAt || ""),
        updatedBy: String(actor.displayName || "超级管理员")
      };
      const history = [{
        time: current.updatedAt,
        user: current.updatedBy,
        field: "附件模板",
        before: state.current.fileName,
        after: current.fileName,
        desc: "上传新模板"
      }, ...state.history].slice(0, 20);
      global.localStorage?.setItem(templateStorageKey, JSON.stringify({ current, history }));
      return Object.freeze({ ...current });
    }
  });

  function readEnumOverrides() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(enumStorageKey) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  const enumOverrideStore = Object.freeze({
    storageKey: enumStorageKey,
    get(enumKey, fallback = []) {
      const values = readEnumOverrides()[enumKey];
      return Object.freeze([...(Array.isArray(values) ? values : fallback)]);
    },
    save(enumKey, inputValues) {
      const values = (Array.isArray(inputValues) ? inputValues : []).map(value => String(value ?? "").trim());
      if (!values.length) throw new Error("枚举值至少保留一项");
      if (values.some(value => !value)) throw new Error("枚举值不能为空");
      if (new Set(values).size !== values.length) throw new Error("枚举值不能重复");
      const overrides = readEnumOverrides();
      overrides[enumKey] = values;
      global.localStorage?.setItem(enumStorageKey, JSON.stringify(overrides));
      return Object.freeze([...values]);
    }
  });

  function readFormChangeHistory() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(formChangeHistoryStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  const formChangeHistoryStore = Object.freeze({
    storageKey: formChangeHistoryStorageKey,
    list(formName = "") {
      const rows = readFormChangeHistory().filter(item => !formName || item.formName === formName);
      return Object.freeze(rows.map(item => Object.freeze({ ...item })));
    },
    submit(input = {}) {
      const formName = String(input.formName || "").trim();
      const description = String(input.description || "").trim();
      const changes = Array.isArray(input.changes) ? input.changes : [];
      if (!formName) throw new Error("未找到需要提交的表单");
      if (!changes.length) throw new Error("暂无需要提交的修改");
      if (!description) throw new Error("请填写本次修改说明");
      const rows = changes.map(change => ({
        formName,
        time:String(input.time || ""),
        user:String(input.user || "系统管理员"),
        field:String(change.field || "-"),
        oldVal:String(change.oldVal || "-"),
        newVal:String(change.newVal || "-"),
        desc:description
      }));
      global.localStorage?.setItem(formChangeHistoryStorageKey, JSON.stringify([...rows, ...readFormChangeHistory()].slice(0, 100)));
      return Object.freeze(rows.map(item => Object.freeze({ ...item })));
    }
  });

  const pools = {
    complaint: ["贷款催收", "贷款协商还款", "贷款业务办理", "贷款提前还款", "个人征信", "企业征信", "账户管控", "账户开销户", "业务办理", "营销活动", "服务质量与态度", "额度注销", "信息披露", "个人信息保护", "其它"],
    biztype: ["合作类贷款", "非合作类贷款", "存款", "代理销售", "其它"],
    dept: ["零售金融部", "普惠金融部", "公司金融部", "运营管理部", "风险管理部", "特殊资产经营部", "消费者权益保护部"],
    product: ["美团", "度小满", "乐信", "京东", "小米", "数禾", "字节跳动", "拍拍贷", "维信金科", "马上消金", "360", "个人经营贷", "个人住房按揭贷款", "兴安贷+", "好康贷", "税享贷", "梦想贷", "公司贷款", "银行卡", "存款", "大额存单", "基金", "理财", "对公账户", "其它产品"],
    effective: ["有效投诉", "无效投诉"],
    cancel: ["邮件", "面访", "微信", "电话", "短信", "其他"],
    extend: ["延长至30日", "延长至60日"],
    accountability: ["1纪律处分（警告）", "2纪律处分（记过）", "3纪律处分（记大过）", "4纪律处分（降级/降职）", "5纪律处分（撤职）", "6纪律处分（留行察看）", "7纪律处分（开除）", "8经济处理(收回违规所得)", "9经济处理(经济处罚)", "10经济处理(经济赔偿)", "11经济处理(追索扣回绩效薪酬)", "12批评教育(违规积分)", "13批评教育(书面批评)", "14批评教育(通报批评)", "15其他处理（调整岗位）", "16其他处理(免职)", "17其他处理(解聘职务)", "18其他处理(责令辞职)", "19其他处理(解除劳务合同)", "20其他处理(辞退)", "21其他处理（退回劳务派遣公司）", "22轻微工作差错积分", "23其他"],
    exclude: ["被投诉机构错误的。", "无法确认投诉人身份的。", "投诉人主张持有被投诉机构的存款、理财、保险等产品，但实际未持有的。", "被投诉机构因执行法律、法规及国家政策的强制性规定无法向投诉人提供相关服务而被投诉的。", "投诉人主张的相关事项经人民法院判决确定存在金融诈骗等犯罪情形的。", "投诉事项经人民法院判决或仲裁机构裁决后，银行机构对应承担的责任已执行完毕，且投诉人没有新的事实与理由就同一事项重新提出投诉的。", "双方当事人就投诉事项已达成调解协议并经人民法院司法确认后，银行机构对应承担的责任已执行完毕，且投诉人没有新的事实与理由就同一事项重新提出投诉的。", "银行机构执行全国\"断卡行动\"、反洗钱等党中央、国务院及相关部门有关领域治理和整治的重要决策部署要求引发投诉的。", "银行业金融机构执行中国人民银行相关规定引发的单纯征信类投诉。", "投诉人诉求及投诉内容仅要求变更还款数额、利率、期限和还款方式等单纯协商还款类投诉。"],
    abnormal: ["1 存在涉嫌违法犯罪情形的", "2 存在扰乱公共秩序、信访秩序情形的", "3 存在其他异常情形的"],
    resolve: ["诉讼", "仲裁", "和解", "调解"],
    mediation: ["诉求人主动申请", "银行发起申请", "信访转调解"],
    mediation_type: ["线上调解", "现场调解"],
    problem_src: ["投诉", "监管检查", "审计", "专项检查", "其它"]
  };

  const formRows = Object.freeze([
    ["投诉单", "工单", ["complaint", "biztype", "dept", "product"], "2026-07-15 10:30:00"],
    ["信访单", "工单", ["complaint", "biztype", "dept", "product"], "2026-07-15 10:30:00"],
    ["表扬单", "工单", ["biztype", "dept", "product"], "2026-06-20 14:00:00"],
    ["建议单", "工单", ["biztype", "dept", "product"], "2026-06-20 14:00:00"],
    ["投诉校正", "子流程", ["complaint", "biztype", "product"], "2026-07-08 16:00:00"],
    ["投诉调查", "子流程", ["effective"], "2026-05-15 11:00:00"],
    ["撤销投诉", "子流程", ["cancel"], "2026-04-10 08:30:00"],
    ["延长申请", "子流程", ["extend"], "2026-04-10 08:30:00"],
    ["投诉问责", "子流程", ["accountability"], "2026-06-01 13:00:00"],
    ["剔除申请", "子流程", ["exclude"], "2026-06-01 13:00:00"],
    ["异常投诉", "子流程", ["abnormal"], "2026-07-12 15:00:00"],
    ["纠纷化解", "子流程", ["resolve", "mediation", "mediation_type"], "2026-07-12 15:00:00"],
    ["溯源整改", "子流程", ["biztype", "product", "problem_src"], "2026-07-18 09:00:00"]
  ].map(Object.freeze));

  const enumNames = {
    complaint: "投诉事项", biztype: "业务类型", dept: "所属业务条线", product: "产品类型",
    effective: "是否有效投诉", cancel: "撤销申请渠道", extend: "延长时间", accountability: "问责措施",
    exclude: "剔除申请类型", abnormal: "异常投诉类型", resolve: "化解方式", mediation: "调解来源",
    mediation_type: "调处方式", problem_src: "问题来源"
  };
  const enumMeta = Object.fromEntries(Object.entries(pools).map(([key, pool]) => [key, Object.freeze({ name: enumNames[key], pool: Object.freeze(pool) })]));

  const field = (name, enumKey = null, type = enumKey ? "枚举" : "文本") => Object.freeze({ name, type, enumKey });
  const templateField = () => Object.freeze({ name: "附件模板", type: "附件模板", templateName: defaultAbnormalTemplate.fileName });
  const fields = {
    投诉单: [field("投诉事项", "complaint"), field("业务类型", "biztype"), field("所属业务条线", "dept"), field("产品类型", "product"), field("投诉人姓名"), field("投诉人电话"), field("投诉内容"), field("受理时间", null, "日期/时间")],
    信访单: [field("信访事项", "complaint"), field("业务类型", "biztype"), field("所属业务条线", "dept"), field("产品类型", "product")],
    表扬单: [field("业务类型", "biztype"), field("所属业务条线", "dept"), field("产品类型", "product")],
    建议单: [field("业务类型", "biztype"), field("所属业务条线", "dept"), field("产品类型", "product")],
    投诉校正: [field("投诉事项", "complaint"), field("业务类别", "biztype"), field("产品类型", "product")],
    投诉调查: [field("是否有效投诉", "effective")], 撤销投诉: [field("撤销申请渠道", "cancel")], 延长申请: [field("延长时间", "extend")],
    投诉问责: [field("问责机构", null, "机构级联"), field("问责部门", null, "部门级联"), field("问责对象", null, "人员选择"), field("问责措施", "accountability")], 剔除申请: [field("剔除申请类型", "exclude")], 异常投诉: [field("异常投诉类型", "abnormal"), templateField()],
    纠纷化解: [field("化解方式", "resolve"), field("调解来源", "mediation"), field("调处方式", "mediation_type"), field("化解金额", null, "数字")],
    溯源整改: [field("整改业务", "biztype"), field("整改产品", "product"), field("问题来源", "problem_src")]
  };
  Object.keys(fields).forEach(key => Object.freeze(fields[key]));

  const forms = formRows.map(([name, category, enumKeys, updateTime]) => Object.freeze({
    name,
    category,
    editableFieldCount: (fields[name] || []).length,
    enumCount: enumKeys.length,
    enumKeys: Object.freeze([...enumKeys]),
    updateTime
  }));

  const globalHistory = Object.freeze([
    { time: "2026-07-18 14:30:00", user: "陈敏慧", action: "录入", desc: '投诉单-投诉事项：新增"账户管控"' },
    { time: "2026-07-16 09:15:00", user: "林海", action: "录入", desc: '投诉单-产品类型：新增"360"、"度小满"' },
    { time: "2026-07-14 16:00:00", user: "系统管理员", action: "录入", desc: '投诉单-业务类型：新增"代理销售"' },
    { time: "2026-07-12 11:20:00", user: "王磊", action: "录入", desc: '异常投诉-异常投诉类型：新增"3 存在其他异常情形的"' },
    { time: "2026-07-08 10:00:00", user: "陈敏慧", action: "录入", desc: '信访单-信访事项：新增"企业征信"' }
  ].map(Object.freeze));
  const detailHistory = Object.freeze({
    投诉单: Object.freeze([
      { time: "2026-07-18 14:30:00", user: "陈敏慧", field: "投诉事项", oldVal: "贷款催收、贷款协商还款…14项", newVal: "贷款催收、贷款协商还款…15项", desc: '新增"账户管控"' },
      { time: "2026-07-16 09:15:00", user: "林海", field: "产品类型", oldVal: "美团、度小满…23项", newVal: "美团、度小满…25项", desc: '新增"360"、"度小满"' },
      { time: "2026-07-14 16:00:00", user: "系统管理员", field: "业务类型", oldVal: "合作类贷款…4项", newVal: "合作类贷款…5项", desc: '新增"代理销售"' }
    ].map(Object.freeze))
  });

  const smsTemplates = Object.freeze([
    {
      id: "accept-notice",
      title: "投诉受理告知短信",
      node: "工单创建阶段提交时点击发送告知短信",
      category: "建单告知短信",
      enabled: true,
      trigger: "经办员提交工单或复核员复核通过客服创建的工单后，可确认发送。",
      content: "【厦门国际银行】尊敬的客户您好！您提交的投诉已由我行正式登记受理，编号【投诉编号】，我行工作人员将尽快与您联系核实，由此给您带来不便我们深表歉意。",
      variables: Object.freeze([
        Object.freeze({ name: "投诉编号", fixed: true, source: "系统带入", note: "取值优先取转送函号，无转送函号时取工单编号" })
      ]),
      sendRule: "系统默认规则：工单创建阶段提交时，由用户点击发送告知短信。",
      approval: "无需审批",
      updateTime: "2026-08-20 10:30:00"
    },
    {
      id: "close-notice",
      title: "办结告知短信",
      node: "工单和子单处理阶段发送沟通短信",
      category: "办结告知短信",
      enabled: true,
      trigger: "处理员处理完工单并提交短信沟通，审批通过后发送至客户。",
      content: "尊敬的客户您好！针对您编号【投诉编号】的投诉事项，我行已完成核查处置，处理结果：【简要概括处理结论】。若您对本次处理结果存在异议，可在收到本通知30日内选择救济渠道。",
      variables: Object.freeze([
        Object.freeze({ name: "投诉编号", fixed: true, source: "系统带入", note: "取值优先取转送函号，无转送函号时取工单编号" }),
        Object.freeze({ name: "简要概括处理结论", fixed: false, source: "手工录入", note: "" })
      ]),
      sendRule: "系统默认规则：工单或子单处理阶段，由处理人员选择模板发送沟通短信。",
      approval: "审批",
      updateTime: "2026-08-20 10:30:00"
    },
    {
      id: "non-bank-customer",
      title: "非我行客户提示短信",
      node: "工单创建阶段提交时点击发送告知短信",
      category: "建单告知短信",
      enabled: true,
      trigger: "经办员提交工单或复核员复核通过客服创建的工单后，可确认发送。",
      content: "【厦门国际银行】您好，您投诉反映的业务非我行业务，我行无权核查处置。建议您核对涉事银行名称，直接向对应银行官方客服提交投诉，避免延误您问题处理。给您带来不便敬请谅解。",
      variables: Object.freeze([
        Object.freeze({ name: "投诉编号", fixed: true, source: "系统带入", note: "取值优先取转送函号，无转送函号时取工单编号" })
      ]),
      sendRule: "系统默认规则：工单创建阶段提交时，由用户点击发送告知短信。",
      approval: "无需审批",
      updateTime: "2026-08-20 10:30:00"
    }
  ].map(Object.freeze));

  const smsCategoryMeta = Object.freeze({
    建单告知短信: Object.freeze({ node:"工单创建阶段提交时点击发送告知短信", sendRule:"系统默认规则：工单创建阶段提交时，由用户点击发送告知短信。" }),
    处理沟通短信: Object.freeze({ node:"工单和子单处理阶段发送沟通短信", sendRule:"系统默认规则：工单或子单处理阶段，由处理人员选择模板发送沟通短信。" }),
    办结告知短信: Object.freeze({ node:"工单和子单处理阶段发送沟通短信", sendRule:"系统默认规则：工单或子单处理阶段完成处理后，由处理人员选择模板发送办结告知短信。" })
  });

  function readSmsTemplateOverrides() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(smsTemplateStorageKey) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function normalizeSmsVariables(values) {
    return (Array.isArray(values) ? values : []).map(value => {
      const name = String(typeof value === "object" && value ? value.name : value || "").trim();
      const fixed = name === "投诉编号";
      return {
        name,
        fixed,
        source: fixed ? "系统带入" : "手工录入",
        note: fixed ? "取值优先取转送函号，无转送函号时取工单编号" : ""
      };
    });
  }

  function readSmsCustomTemplates() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(smsTemplateCustomStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function readSmsDeletedIds() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(smsTemplateDeletedStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      return [];
    }
  }

  function readSmsHistory() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(smsTemplateHistoryStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function appendSmsHistory(entry) {
    const rows = readSmsHistory();
    rows.unshift(entry);
    global.localStorage?.setItem(smsTemplateHistoryStorageKey, JSON.stringify(rows.slice(0, 30)));
  }

  function smsSourceTemplate(id) {
    if (readSmsDeletedIds().includes(String(id))) return null;
    return smsTemplates.find(template => template.id === id) || readSmsCustomTemplates().find(template => template.id === id) || null;
  }

  function validateSmsTemplateInput(source, input = {}) {
    const title = String(input.title ?? source.title ?? "").trim();
    const category = smsCategoryMeta[input.category] ? input.category : source.category;
    const content = String(input.content ?? "").trim();
    const variables = normalizeSmsVariables(input.variables);
    const variableNames = variables.map(variable => variable.name);
    if (!title) throw new Error("短信标题不能为空");
    if (!smsCategoryMeta[category]) throw new Error("请选择短信分类");
    if (!content) throw new Error("短信模板内容不能为空");
    if (variableNames.some(value => !value)) throw new Error("变量字段不能为空");
    if (new Set(variableNames).size !== variableNames.length) throw new Error("变量字段不能重复");
    const sourceRequiresTicketNumber = normalizeSmsVariables(source.variables).some(variable => variable.name === "投诉编号");
    if (sourceRequiresTicketNumber && !variableNames.includes("投诉编号")) throw new Error("固定变量投诉编号不能删除");
    const literalTokens = new Set(["厦门国际银行"]);
    const placeholders = [...content.matchAll(/【([^】]+)】/g)].map(match => match[1].trim()).filter(name => !literalTokens.has(name));
    const missing = placeholders.find(name => !variableNames.includes(name));
    if (missing) throw new Error("短信正文中的变量“" + missing + "”未登记");
    return { title, category, content, variables, node:smsCategoryMeta[category].node, sendRule:smsCategoryMeta[category].sendRule };
  }

  const smsTemplateStore = Object.freeze({
    storageKey: smsTemplateStorageKey,
    get(id) {
      const source = smsSourceTemplate(id);
      if (!source) return null;
      const override = readSmsTemplateOverrides()[id];
      const merged = { ...source, ...(override && typeof override === "object" ? override : {}) };
      return Object.freeze({ ...merged, variables:Object.freeze(normalizeSmsVariables(merged.variables).map(item => Object.freeze(item))) });
    },
    list() {
      return Object.freeze([...smsTemplates, ...readSmsCustomTemplates()].map(template => this.get(template.id)));
    },
    save(id, input = {}) {
      const source = smsSourceTemplate(id);
      if (!source) throw new Error("短信模板不存在");
      const normalized = validateSmsTemplateInput(source, input);
      const overrides = readSmsTemplateOverrides();
      overrides[id] = { ...normalized, enabled:input.enabled ?? source.enabled ?? true, updateTime:String(input.updateTime || source.updateTime) };
      global.localStorage?.setItem(smsTemplateStorageKey, JSON.stringify(overrides));
      appendSmsHistory({ time:overrides[id].updateTime, user:"超级管理员", action:"修改", category:normalized.category, desc:"修改短信模板配置" });
      return this.get(id);
    },
    create(input = {}) {
      const category = smsCategoryMeta[input.category] ? input.category : "建单告知短信";
      const source = { title:"", category, variables:[{ name:"投诉编号", source:"系统带入" }] };
      const normalized = validateSmsTemplateInput(source, input);
      const created = {
        id:"custom-sms-" + Date.now(),
        ...normalized,
        enabled:true,
        approval:"系统控制",
        updateTime:String(input.updateTime || "2026-08-31 10:00:00")
      };
      const rows = readSmsCustomTemplates();
      rows.push(created);
      global.localStorage?.setItem(smsTemplateCustomStorageKey, JSON.stringify(rows));
      appendSmsHistory({ time:created.updateTime, user:"超级管理员", action:"新增", category:created.category, desc:"新增" + created.category + "模板" });
      return this.get(created.id);
    },
    toggle(id, enabled, updateTime = "2026-08-31 10:00:00") {
      const current = this.get(id);
      if (!current) throw new Error("短信模板不存在");
      return this.save(id, { ...current, enabled:Boolean(enabled), updateTime });
    },
    delete(id, updateTime = "2026-09-01 10:00:00") {
      const current = this.get(id);
      if (!current) throw new Error("短信模板不存在");
      const deletedIds = [...new Set([...readSmsDeletedIds(), String(id)])];
      global.localStorage?.setItem(smsTemplateDeletedStorageKey, JSON.stringify(deletedIds));
      global.localStorage?.setItem(smsTemplateCustomStorageKey, JSON.stringify(readSmsCustomTemplates().filter(template => template.id !== id)));
      const overrides = readSmsTemplateOverrides();
      delete overrides[id];
      global.localStorage?.setItem(smsTemplateStorageKey, JSON.stringify(overrides));
      appendSmsHistory({ time:updateTime, user:"超级管理员", action:"删除", category:current.category, desc:"删除短信模板" });
      return true;
    },
    history() {
      return Object.freeze(readSmsHistory().map(item => Object.freeze({ ...item })));
    }
  });

  global.XIBAdminFormTemplateStore = templateStore;
  global.XIBAdminFormEnumOverrideStore = enumOverrideStore;
  global.XIBAdminFormChangeHistoryStore = formChangeHistoryStore;
  global.XIBAdminSmsTemplateStore = smsTemplateStore;
  global.XIB_ADMIN_FORM_CONFIG_DATA = Object.freeze({ forms: Object.freeze(forms), enumMeta: Object.freeze(enumMeta), fields: Object.freeze(fields), smsTemplates, globalHistory, detailHistory });
})(window);
