(function defineAlertRuleConfig(global) {
  "use strict";

  /* 预警规则配置 —— 唯一数据源，内容逐字取自《新预警参数配置（9.2客户反馈版）.xlsx》
   * 第 1 张工作表「预警单生成规则」。
   *
   * 后台管理「预警参数配置」与投诉管理「智能预警」都读这一份，不各自维护文案，
   * 避免系统内 AI 生成的内容与业务确认过的参数表不一致。
   *
   * 摘要模板占位符：{日期} {机构范围} {时间范围} {当前值} {环比1} {环比2} {门槛值}
   * {产品名称} {原因名称} {工单编号} {原渠道} {升级后渠道} {客户编号/姓名}
   * {N} {数值} {阈值} {命中标签} {等级}
   */
  const templates = [
    {
      id: "full-ticket-volume",
      type: "工单全量预警",
      orgScope: "全行、总行、具体分行",
      scopeConfigurable: true,
      enabled: true,
      desc: "按投诉工单总量口径识别全量工单异常波动。",
      configurableNote: "规则模板固定，只允许修改判断规则中的数值和机构范围。",
      rules: Object.freeze([
        {
          scene: "全量投诉量异常",
          source: "全量投诉单",
          rule: "在【机构范围】内，按【时间范围】统计当前及前两个窗口的投诉工单总量。\n全行规则：双环比均超过【环比阈值】时预警。\n总行及具体分行规则：当前窗口超过历史均值+【标准差倍数】×标准差，且双环比均超过【环比阈值】时预警；未超过标准差门槛时不预警。触发后按【时间范围】封锁，同类型、同机构不重复预警。",
          calculation: "全行：双环比；\n总行/具体分行：先超过标准差门槛，再判断双环比；时间范围默认14天",
          push: "处理员（总/分行消保）、审批员（总/分行消保）、业务员（总/分行消保），不涉及支行。",
          summary: "【工单全量预警】{日期}，{机构范围}当前{时间范围}投诉工单总量{当前值}件，较上一窗口增长{环比1}%，较上上窗口增长{环比2}%，触发预警。"
        }
      ]),
      variables: Object.freeze([
        { name: "时间范围", value: 14, unit: "天" },
        { name: "环比阈值", value: 15, unit: "%" },
        { name: "标准差倍数", value: 1.5, unit: "" }
      ])
    },
    {
      id: "regulatory-transfer-volume",
      type: "监管转办工单量预警",
      orgScope: "全行、总行、具体分行",
      scopeConfigurable: true,
      enabled: true,
      desc: "按监管转办投诉工单口径识别监管转办量异常波动。",
      configurableNote: "规则模板固定，只允许修改判断规则中的数值和机构范围。",
      rules: Object.freeze([
        {
          scene: "监管转办投诉量异常",
          source: "工单类型=投诉单 \n受理渠道=监管转办（....）",
          rule: "在【机构范围】内，按【时间范围】统计当前及前两个窗口的监管转办投诉工单量。全行规则：双环比均超过【环比阈值】时预警。总行及具体分行规则：当前窗口超过历史均值+【标准差倍数】×标准差，且双环比均超过【环比阈值】时预警；未超过标准差门槛时不预警。触发后按【时间范围】封锁，同类型、同机构不重复预警。",
          calculation: "全行：双环比；总行/具体分行：先超过标准差门槛，再判断双环比；时间范围默认14天",
          push: "处理员（总/分行消保）、审批员（总/分行消保）、业务员（总/分行消保），不涉及支行。",
          summary: "【监管转办工单量预警】{日期}，{机构范围}当前{时间范围}监管转办工单量{当前值}件，较上一窗口增长{环比1}%，较上上窗口增长{环比2}%，触发预警。"
        }
      ]),
      variables: Object.freeze([
        { name: "时间范围", value: 14, unit: "天" },
        { name: "环比阈值", value: 15, unit: "%" },
        { name: "标准差倍数", value: 1.5, unit: "" }
      ])
    },
    {
      id: "self-received-channel-volume",
      type: "自收渠道工单量预警",
      orgScope: "全行、总行、具体分行",
      scopeConfigurable: true,
      enabled: true,
      desc: "按其他自收渠道投诉工单口径识别自收渠道量异常波动。",
      configurableNote: "规则模板固定，只允许修改判断规则中的数值和机构范围。",
      rules: Object.freeze([
        {
          scene: "自收投诉投诉量异常",
          source: "工单类型=投诉单\n受理渠道=自收投诉(...)",
          rule: "在【机构范围】内，按【时间范围】统计当前及前两个窗口的自收渠道投诉工单量。当前窗口达到历史均值+【标准差倍数】×标准差，且双环比均超过【环比阈值】时预警。触发后按【时间范围】封锁，同类型、同机构不重复预警。",
          calculation: "均值+标准差+双环比；时间范围默认14天",
          push: "处理员（总/分行消保）、审批员（总/分行消保）、业务员（总/分行消保），不涉及支行。",
          summary: "【自收渠道工单量预警】{日期}，{机构范围}当前{时间范围}自收渠道工单量{当前值}件，超过标准差门槛{门槛值}件；较上一窗口增长{环比1}%，较上上窗口增长{环比2}%，触发预警。"
        }
      ]),
      variables: Object.freeze([
        { name: "时间范围", value: 14, unit: "天" },
        { name: "环比阈值", value: 15, unit: "%" },
        { name: "标准差倍数", value: 1.5, unit: "" }
      ])
    },
    {
      id: "escalation",
      type: "升级投诉",
      orgScope: "全行全量数据",
      scopeConfigurable: false,
      enabled: true,
      desc: "基于全行全量工单识别自收投诉升级监管转呼、监管转呼升级监管转办、监管转办转信访及跨级升级情形。",
      adjustableVariables: "无",
      defaultValues: "升级路径固定启用",
      editable: false,
      configurableNote: "系统内置规则，不按机构范围拆分，不配置阈值。",
      rules: Object.freeze([
        {
          scene: "升级投诉",
          source: "投诉系统投诉工单升级记录",
          rule: "同一客户重复投诉内监管渠道投诉单，若存在任意一笔自收渠道投诉单的【接收时间】<该监管单的【接收时间】，则该监管单计入1笔。",
          calculation: "(1)投诉人身份一致性：投诉人姓名、证件号完全一致；\n(2)时间周期一致性：1个自然年（重复）\n(3)投诉事项一致性：投诉同一类业务，即对应相同的人行投诉业务标签中类；\n(4)被投诉机构一致性：被投诉机构信息从修正后的被投诉机构数据中取值，被投诉机构的直属上级和直属下级机构都算作同一机构。其中，直属上下级根据机构树的父子节点进行判断。\n实时触发，出现即预警",
          push: "处理员（总/分行消保）、审批员（总/分行消保）、业务员（总/分行消保），不涉及支行。",
          summary: "【升级预警】{日期}投诉工单{工单编号}由{原渠道}升级为{升级后渠道}，触发预警。"
        }
      ]),
      variables: Object.freeze([])
    },
    {
      id: "risk-complaint",
      type: "风险投诉",
      orgScope: "全行、总行、具体分行",
      scopeConfigurable: true,
      enabled: true,
      desc: "按风险投诉口径统计投诉工单，作为投诉风险波动类预警配置。",
      configurableNote: "规则模板固定，只允许修改判断规则中的数值和机构范围。",
      rules: Object.freeze([
        {
          scene: "风险投诉",
          source: "投诉系统中标记为风险投诉的工单数据。",
          rule: "在【机构范围】内，按【时间范围】统计当前及前两个窗口的风险投诉工单量。当前窗口达到历史均值+【标准差倍数】×标准差，且双环比均超过【环比阈值】时预警。触发后按【时间范围】封锁，同类型、同机构不重复预警。",
          calculation: "",
          push: "处理员（总/分行消保）、审批员（总/分行消保）、业务员（总/分行消保），不涉及支行。",
          summary: "【风险投诉预警】{日期}，{机构范围}当前{时间范围}风险投诉工单量{当前值}件，超过标准差门槛{门槛值}件；较上一窗口增长{环比1}%，较上上窗口增长{环比2}%，触发预警。"
        }
      ]),
      variables: Object.freeze([
        { name: "时间范围", value: 14, unit: "天" },
        { name: "环比阈值", value: 15, unit: "%" },
        { name: "标准差倍数", value: 1.5, unit: "" }
      ])
    },
    {
      id: "reason",
      type: "原因类",
      orgScope: "全行、总行、具体分行",
      scopeConfigurable: true,
      enabled: true,
      desc: "从一级原因维度统计全量投诉与监管投诉的波动情况。",
      configurableNote: "原因字典来自系统现有投诉原因；规则模板固定，只允许修改判断规则中的数值和机构范围。",
      rules: Object.freeze([
        {
          scene: "一级原因投诉量异常",
          source: "工单类型=投诉单\n投诉原因标签一级标签",
          rule: "在【机构范围】内，按【时间范围】统计当前及前两个窗口的某一级原因投诉量。当前窗口达到历史均值+【标准差倍数】×标准差，且双环比均超过【环比阈值】时预警。触发后按【时间范围】封锁，同类型、同机构不重复预警。",
          calculation: "均值+标准差+双环比；时间范围默认14天",
          push: "处理员（总/分行消保）、审批员（总/分行消保）、业务员（总/分行消保），不涉及支行。",
          summary: "【原因类预警】{日期}，{机构范围}{原因名称}当前{时间范围}投诉量{当前值}件，超过标准差门槛{门槛值}件；较上一窗口增长{环比1}%，较上上窗口增长{环比2}%，触发预警。"
        }
      ]),
      variables: Object.freeze([
        { name: "时间范围", value: 14, unit: "天" },
        { name: "环比阈值", value: 15, unit: "%" },
        { name: "标准差倍数", value: 1.5, unit: "" }
      ])
    },
    {
      id: "product",
      type: "产品类",
      orgScope: "全行、总行、具体分行",
      scopeConfigurable: true,
      enabled: true,
      desc: "从一级产品维度统计全量投诉与监管投诉的波动情况。",
      configurableNote: "产品字典来自系统现有产品；规则模板固定，只允许修改判断规则中的数值和机构范围。",
      rules: Object.freeze([
        {
          scene: "一级产品投诉量异常",
          source: "工单类型=投诉单\n投诉产品标签一级标签",
          rule: "在【机构范围】内，按【时间范围】统计当前及前两个窗口的某一级产品投诉量。当前窗口达到历史均值+【标准差倍数】×标准差，且双环比均超过【环比阈值】时预警。触发后按【时间范围】封锁，同类型、同机构不重复预警。",
          calculation: "均值+标准差+双环比；时间范围默认14天",
          push: "处理员（总/分行消保）、审批员（总/分行消保）、业务员（总/分行消保），不涉及支行。",
          summary: "【产品类预警】{日期}，{机构范围}{产品名称}当前{时间范围}投诉量{当前值}件，超过标准差门槛{门槛值}件；较上一窗口增长{环比1}%，较上上窗口增长{环比2}%，触发预警。"
        }
      ]),
      variables: Object.freeze([
        { name: "时间范围", value: 14, unit: "天" },
        { name: "环比阈值", value: 15, unit: "%" },
        { name: "标准差倍数", value: 1.5, unit: "" }
      ])
    },
    {
      id: "frequent-customer",
      type: "高发投诉客户",
      orgScope: "全行全量数据",
      scopeConfigurable: false,
      enabled: true,
      defaultValues: "时间范围=30天；投诉次数阈值=3次",
      configurableNote: "只修改判断规则中的时间范围和次数阈值，不按机构范围拆分。",
      rules: Object.freeze([
        {
          scene: "高发投诉客户",
          source: "全量投诉事件单（含内部投诉工单、监管转办投诉工单）",
          rule: "定期生成高发投诉客户清单；高发客户指该客户在指定时间内产生投诉事件单超过阈值",
          calculation: "按投诉编号计算；根据周期和阈值触发",
          push: "处理员（总/分行消保）、审批员（总/分行消保）、业务员（总/分行消保），不涉及支行。",
          summary: "【高发客户预警】{日期}客户{客户编号/姓名}在近{N}天内累计投诉{数值}次，超过阈值（{阈值}次），触发预警。"
        }
      ]),
      variables: Object.freeze([
        { name: "时间范围", value: 30, unit: "天" },
        { name: "投诉次数阈值", value: 3, unit: "次" }
      ])
    },
    {
      id: "high-risk-customer",
      type: "高风险客户",
      orgScope: "全行全量数据",
      scopeConfigurable: false,
      enabled: true,
      defaultValues: "风险等级=高；命中标签示例：舆情风险、重复投诉、监管关注、群体性风险、重大投诉",
      configurableNote: "风险标签取值来自本系统，不依赖外部风险系统；只允许配置高风险标签。",
      rules: Object.freeze([
        {
          scene: "高风险客户",
          source: "全量投诉事件单（含内部投诉工单、监管转办投诉工单）",
          rule: "客户被识别为高风险时触发",
          calculation: "出现即提示",
          push: "处理员（总/分行消保）、审批员（总/分行消保）、业务员（总/分行消保），不涉及支行。",
          summary: "【高风险客户预警】{日期}客户{客户编号/姓名}被识别为高风险客户，风险等级{等级}，触发预警。"
        }
      ]),
      variables: Object.freeze([
        { name: "高风险标签", value: "舆情风险、重复投诉", unit: "" }
      ])
    }
  ];

  /* 列表展示维度 —— 预警单列表里「预警机构 / 预警部门」两列不是每条预警都有值：
   *   · 只有「带量」的场景类型（对机构范围内的工单量做统计）才落在某个机构上，才有预警机构；
   *   · 只有「双一级标签」的场景类型（一级产品标签 / 一级原因标签，即产品类与原因类）才落到承办部门，才有预警部门。
   *
   * 这份判定刻意不写进 templates.rules：rules 会整块渲染到后台管理「预警参数配置」，
   * 列表展示维度属于前台呈现口径，不是可配置的预警参数，混进去会污染配置页。 */
  const SCENE_LIST_DIMENSIONS = Object.freeze({
    "全量投诉量异常": Object.freeze({ org: true, dept: false }),
    "监管转办投诉量异常": Object.freeze({ org: true, dept: false }),
    "自收投诉投诉量异常": Object.freeze({ org: true, dept: false }),
    "一级产品投诉量异常": Object.freeze({ org: true, dept: true }),
    "一级原因投诉量异常": Object.freeze({ org: true, dept: true }),
    "升级投诉": Object.freeze({ org: false, dept: false }),
    "风险投诉": Object.freeze({ org: false, dept: false }),
    "高发投诉客户": Object.freeze({ org: false, dept: false }),
    "高风险客户": Object.freeze({ org: false, dept: false })
  });

  /* 取某场景类型在预警单列表里的机构/部门可见性；未登记的场景一律不展示，避免凭空多出归属字段。 */
  function sceneDimensions(scene) {
    const registered = SCENE_LIST_DIMENSIONS[String(scene ?? "")];
    return Object.freeze({
      org: Boolean(registered?.org),
      dept: Boolean(registered?.dept)
    });
  }

  /* 按场景类型取规则模板（智能预警用）。 */
  function ruleByScene(scene) {
    for (const template of templates) {
      const rule = template.rules.find(item => item.scene === scene);
      if (rule) return { template, rule };
    }
    return null;
  }

  /* 用实际命中数值渲染摘要模板；未提供的占位符原样保留，便于暴露漏配。 */
  function renderSummary(template, values = {}) {
    return String(template ?? "").replace(/\{([^{}]+)\}/g, (placeholder, key) =>
      Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder);
  }

  /* 摘要里哪些占位符需要在前台蓝色高亮。
     除可度量的业务数据外，一级产品、一级原因场景中的产品/原因标签值也属于核心命中信息。
     机构范围、客户编号/姓名、工单编号、原渠道/升级后渠道、等级、日期仍保持正文色。 */
  const SUMMARY_METRIC_PLACEHOLDERS = Object.freeze([
    "产品名称", "原因名称", "时间范围", "当前值", "环比1", "环比2", "门槛值", "N", "数值", "阈值"
  ]);

  function highlightSummaryKeys(rule) {
    const placeholders = String(rule?.summary ?? "").match(/\{([^{}]+)\}/g) || [];
    return placeholders
      .map(token => token.slice(1, -1))
      .filter(key => SUMMARY_METRIC_PLACEHOLDERS.includes(key));
  }

  /* 摘要的 HTML 版本：模板里的固定文案原样输出，命中 highlightKeys 的数值用 <mark> 蓝色高亮。
     highlightKeys 省略时高亮全部代入值；传入数组时只高亮数组内的占位符（其余按普通文本输出）。
     注意文本一律转义后再插入，数值来自数据层同样不可信。 */
  function renderSummaryMarkup(template, values = {}, options = {}) {
    const markClass = options.markClass || "alert-summary-highlight";
    const allowed = Array.isArray(options.highlightKeys) ? new Set(options.highlightKeys) : null;
    const source = String(template ?? "");
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
    let html = "";
    let cursor = 0;
    source.replace(/\{([^{}]+)\}/g, (placeholder, key, index) => {
      html += escapeHtml(source.slice(cursor, index));
      if (!Object.prototype.hasOwnProperty.call(values, key)) {
        html += escapeHtml(placeholder);
      } else if (!allowed || allowed.has(key)) {
        html += '<mark class="' + markClass + '">' + escapeHtml(values[key]) + "</mark>";
      } else {
        html += escapeHtml(values[key]);
      }
      cursor = index + placeholder.length;
      return placeholder;
    });
    return html + escapeHtml(source.slice(cursor));
  }

  global.XIB_ALERT_RULE_CONFIG = Object.freeze({
    templates: Object.freeze(templates),
    ruleByScene,
    sceneDimensions,
    renderSummary,
    renderSummaryMarkup,
    highlightSummaryKeys
  });
})(window);

