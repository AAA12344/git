(function defineComplaintMonitoringData(global) {
  "use strict";

  /* 预警单数据。
   *
   * 这里只保留「系统实际命中的原始数值」——即每条预警触发时系统测得的那几个量，
   * 不再写摘要文案。摘要统一由 src/core/alert-rule-config.js 的「预警摘要生成规则」
   * 模板 + 本文件的 values 渲染得到，保证与后台管理「预警参数配置」的规则同源，
   * 避免两处各写一份文案导致前后不一致。
   *
   * line = 所属业务条线（取自工单表单的业务条线字典，供预警单列表的条线列使用）。
   * org / dept 只在规则配置声明该场景具备该维度时才落到预警单上：
   * 带量场景才有预警机构，双一级标签（产品类/原因类）场景才有预警部门，
   * 因此触发器里即使写了机构/部门，维度不成立时也会被派生逻辑清空。
   */
  const warningTriggers = [
    {
      id: "YJ20260104001", scene: "全量投诉量异常", org: "北京西直门支行", dept: "-", line: "零售金融部", generatedAt: "2026-07-17 08:30:00",
      values: { "机构范围": "北京西直门支行", "时间范围": "14天", "当前值": 86, "环比1": "26.5", "环比2": "22.1" }
    },
    {
      id: "YJ20260104002", scene: "监管转办投诉量异常", org: "厦门分行", dept: "厦门分行消费者权益保护部", line: "消费者权益保护部", generatedAt: "2026-07-17 08:32:00",
      values: { "机构范围": "厦门分行", "时间范围": "14天", "当前值": 24, "环比1": "38.6", "环比2": "33.2" }
    },
    {
      id: "YJ20260104003", scene: "自收投诉投诉量异常", org: "福州分行", dept: "福州分行零售金融部", line: "零售金融部", generatedAt: "2026-07-17 08:35:00",
      values: { "机构范围": "福州分行", "时间范围": "14天", "当前值": 62, "门槛值": 47, "环比1": "31.2", "环比2": "27.5" }
    },
    {
      id: "YJ20260104004", scene: "一级产品投诉量异常", org: "厦门分行", dept: "厦门分行零售金融部", line: "普惠金融部", generatedAt: "2026-07-17 08:38:00",
      values: { "机构范围": "厦门分行", "产品名称": "合作类贷款", "时间范围": "14天", "当前值": 45, "门槛值": 33, "环比1": "36.4", "环比2": "29.7" }
    },
    {
      id: "YJ20260104005", scene: "一级原因投诉量异常", org: "总行", dept: "总行运营管理部", line: "运营管理部", generatedAt: "2026-07-17 08:41:00",
      values: { "机构范围": "总行", "原因名称": "管理制度、业务规则与流程类", "时间范围": "14天", "当前值": 58, "门槛值": 41, "环比1": "24.9", "环比2": "19.4" }
    },
    {
      id: "YJ20260104006", scene: "升级投诉", org: "厦门分行", dept: "厦门分行零售金融部", line: "零售金融部", generatedAt: "2026-07-17 08:44:00",
      values: { "工单编号": "TS202607230012", "原渠道": "自收渠道投诉", "升级后渠道": "监管转办投诉" }
    },
    {
      id: "YJ20260104007", scene: "高发投诉客户", org: "厦门分行", dept: "厦门分行消费者权益保护部", line: "消费者权益保护部", generatedAt: "2026-07-17 08:47:00",
      values: { "客户编号/姓名": "陈晓敏（C202407180036）", "N": 30, "数值": 4, "阈值": 3 }
    },
    {
      id: "YJ20260104008", scene: "高风险客户", org: "厦门分行", dept: "厦门分行风险管理部", line: "风险管理部", generatedAt: "2026-07-17 08:50:00",
      values: { "客户编号/姓名": "刘女士（C202407180128）", "等级": "高" }
    }
  ].map(trigger => Object.freeze({ ...trigger, values: Object.freeze(trigger.values) }));

  /* 被抄送记录：被预警抄送到的单据（对应「被抄送」页签）。
   * 只登记「抄送动作」本身，场景、摘要、机构、部门、条线一律回落到对应预警单的派生结果，
   * 不给被抄送列表另存一份口径。 */
  const WARNING_CC_STORAGE_KEY = "xib-monitoring-warning-cc-entries";
  const defaultWarningCcEntries = [
    { id: "CC202607170001", warningId: "YJ20260104001", ccedBy: "林海-38102", ccedAt: "2026-07-17 09:12:00", status: "未读" },
    { id: "CC202607170002", warningId: "YJ20260104004", ccedBy: "王琳-27519", ccedAt: "2026-07-17 09:40:00", status: "已读" },
    { id: "CC202607170003", warningId: "YJ20260104007", ccedBy: "李雯-29821", ccedAt: "2026-07-17 10:05:00", status: "未读" }
  ];

  function persistedWarningCcEntries() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(WARNING_CC_STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(entry => entry && typeof entry === "object" && entry.id && entry.warningId);
    } catch (error) {
      return [];
    }
  }

  const warningCcEntries = [...defaultWarningCcEntries, ...persistedWarningCcEntries()];

  function persistWarningCcEntries() {
    try {
      const additions = warningCcEntries.slice(defaultWarningCcEntries.length);
      global.localStorage?.setItem(WARNING_CC_STORAGE_KEY, JSON.stringify(additions));
    } catch (error) {}
  }

  const tickets = {
    TS202607230012: {
      id: "TS202607230012", customer: "陈晓敏", channel: "在线客服",
      productTag: "贷款业务 / 个人贷款 / 合作类贷款", reasonTag: "服务类 / 客服服务 / 服务效率",
      businessLine: "零售金融部", creationOrganization: "总行", status: "处理中"
    },
    TS202501100201: {
      id: "TS202501100201", customer: "陈晓敏", channel: "金融消费者保护服务平台",
      productTag: "贷款业务 / 个人贷款 / 合作类贷款", reasonTag: "服务类 / 客服服务 / 服务效率",
      businessLine: "零售金融部", creationOrganization: "厦门分行", status: "已办结"
    },
    TS202607180026: {
      id: "TS202607180026", customer: "刘女士", channel: "总行投诉邮箱",
      productTag: "贷款 / 个人非合作类贷款 / 个人经营贷", reasonTag: "服务类 / 客服服务 / 服务效率",
      businessLine: "零售金融部", creationOrganization: "厦门分行", status: "已办结"
    }
  };

  const warningContexts = {
    YJ20260104001: { ticketIds: ["TS202607230012", "TS202607180026"] },
    YJ20260104002: { ticketIds: ["TS202607180026"] },
    YJ20260104003: { ticketIds: ["TS202607230012"] },
    YJ20260104004: { ticketIds: ["TS202607230012", "TS202607180026"] },
    YJ20260104005: { ticketIds: ["TS202607230012"] },
    YJ20260104006: { customerName: "陈晓敏", customerId: "C202407180036", ticketIds: ["TS202607230012", "TS202501100201"] },
    YJ20260104007: { customerName: "陈晓敏", customerId: "C202407180036", ticketIds: ["TS202607230012", "TS202501100201"] },
    YJ20260104008: { customerName: "刘女士", customerId: "C202407180128", ticketIds: ["TS202607180026", "TS202607230012"] }
  };

  Object.values(tickets).forEach(Object.freeze);
  Object.values(warningContexts).forEach(context => {
    Object.freeze(context.ticketIds);
    Object.freeze(context);
  });

  const datePart = value => String(value ?? "").trim().split(/[ T]/)[0];

  /* 预警摘要 = 规则配置里的模板 + 该条预警实际命中的数值。
     同一份派生结果给出两种呈现：纯文本（列表 title、测试比对）与带蓝色高亮的 HTML（页面渲染），
     两边的取数完全一致，不会出现"显示的摘要"和"高亮的摘要"不是同一串文本。

     行结构：[预警单编号, 场景类型, 预警摘要, 预警机构, 预警部门, 所属业务条线, 生成时间]
     预警机构/预警部门按规则配置的场景维度落库——维度不成立的场景直接留空，
     由前台统一渲染成 "-"，避免出现"机构为空但部门有值"这类自相矛盾的预警单。 */
  let derivedCache = null;
  function warningRowOf(trigger, summary = "") {
    const config = global.XIB_ALERT_RULE_CONFIG;
    const dimensions = typeof config?.sceneDimensions === "function"
      ? config.sceneDimensions(trigger.scene)
      : { org: false, dept: false };
    const org = dimensions.org ? trigger.org : "";
    const dept = dimensions.dept ? trigger.dept : "";
    return Object.freeze([trigger.id, trigger.scene, summary, org === "-" ? "" : org, dept === "-" ? "" : dept, trigger.line || "", trigger.generatedAt]);
  }

  function deriveWarnings() {
    const config = global.XIB_ALERT_RULE_CONFIG;
    if (!config || typeof config.ruleByScene !== "function") return null;
    const rows = [];
    const summaryMarkup = {};
    warningTriggers.forEach(trigger => {
      const matched = config.ruleByScene(trigger.scene);
      const values = { ...trigger.values, "日期": datePart(trigger.generatedAt) };
      const summary = matched ? config.renderSummary(matched.rule.summary, values) : "";
      rows.push(warningRowOf(trigger, summary));
      /* 高亮范围只给「有业务意义的数值型指标」，由规则配置派生，前台不另维护清单。 */
      const highlightKeys = matched && typeof config.highlightSummaryKeys === "function"
        ? config.highlightSummaryKeys(matched.rule)
        : [];
      summaryMarkup[trigger.id] = matched && typeof config.renderSummaryMarkup === "function"
        ? config.renderSummaryMarkup(matched.rule.summary, values, { highlightKeys })
        : "";
    });
    return { rows: Object.freeze(rows), summaryMarkup: Object.freeze(summaryMarkup) };
  }

  function derived() {
    if (!derivedCache) derivedCache = deriveWarnings();
    return derivedCache;
  }

  function warningRows() {
    const result = derived();
    /* 规则配置尚未加载时先给出降级结果，待配置就绪后自动重算并缓存。 */
    if (!result) return warningTriggers.map(trigger => warningRowOf(trigger));
    return result.rows;
  }

  /* 摘要的 HTML（数值蓝色高亮）——由与 warningRows 相同的派生结果生成。 */
  function warningSummaryMarkup(id) {
    const result = derived();
    return result ? (result.summaryMarkup[id] || "") : "";
  }

  /* 被抄送派生行：[抄送编号, 预警单编号, 场景类型, 预警摘要, 预警机构, 预警部门, 所属业务条线, 抄送人, 抄送时间, 抄送状态]
   * 口径全部回落到对应预警单，抄送记录自身只带「谁抄的、什么时候抄的、看没看」。
   * 条数很少，直接实时派生，不缓存，避免新增抄送后要额外失效缓存。 */
  function warningCcRows() {
    const byId = new Map(warningRows().map(row => [row[0], row]));
    return warningCcEntries.map(entry => {
      const warning = byId.get(entry.warningId) || ["", "", "", "", "", "", ""];
      return Object.freeze([
        entry.id, entry.warningId, warning[1], warning[2], warning[3], warning[4], warning[5],
        entry.ccedBy, entry.ccedAt, entry.status
      ]);
    });
  }

  /* 抄送成功后把动作登记进「被抄送」页签，让列表与抄送结果保持一致。 */
  function appendWarningCc({ warningId, ccedBy, ccedAt, status = "未读" }) {
    if (!warningTriggers.some(trigger => trigger.id === warningId)) return null;
    const entry = { id: "CC" + Date.now() + String(warningCcEntries.length).padStart(2, "0"), warningId, ccedBy: ccedBy || "", ccedAt: ccedAt || "", status };
    warningCcEntries.push(entry);
    persistWarningCcEntries();
    return Object.freeze({ ...entry });
  }

  const api = {
    warningTriggers: Object.freeze(warningTriggers),
    tickets: Object.freeze(tickets),
    warningContexts: Object.freeze(warningContexts),
    warningSummaryMarkup,
    appendWarningCc
  };
  /* warningRows / warningCcRows 为派生值：模板可能晚于本文件加载，故用 getter 惰性求值。 */
  Object.defineProperty(api, "warningRows", { get: warningRows, enumerable: true });
  Object.defineProperty(api, "warningCcRows", { get: warningCcRows, enumerable: true });

  global.XIB_COMPLAINT_MONITORING_DATA = Object.freeze(api);
})(window);
