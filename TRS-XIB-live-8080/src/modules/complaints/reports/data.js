(function defineComplaintReportsData(global) {
  "use strict";

  const specialFilters = Object.freeze(["重复投诉", "再次投诉", "异常投诉", "废止投诉"]);
  const filter = (label, control, options = []) => ({ label, control, options });
  const date = () => filter("建单时间", "dateRange");
  const special = () => ({ specialFilters });

  const regulatory = [
    { id:"regulatory-consumer-complaint", name:"银行业金融机构金融消费者投诉分类统计表", type:"统计", icon:"document-check.svg", tone:"purple", focus:"投诉分类", filters:[date(), filter("工单接收机构", "select"), special()], dimensions:["业务类别", "业务办理渠道", "投诉原因"] },
    { id:"regulatory-xiamen-remote-petition", name:"厦门法人银行异地分支机构信访投诉情况表", type:"统计", icon:"data-analysis.svg", tone:"purple", focus:"信访投诉情况", filters:[date(), filter("工单接收机构", "select"), special()], dimensions:["主要涉及事项", "主要涉及部门及业务", "处理应对措施、处理结果", "投诉量"] },
    { id:"regulatory-natural", name:"自然人-银行业金融机构金融消费者投诉分类统计表", type:"统计", icon:"document-check.svg", tone:"purple", focus:"自然人投诉分类", filters:[date(), filter("工单接收机构", "select"), special()], dimensions:["业务办理渠道", "业务类型", "投诉原因"] },
    { id:"regulatory-non-natural", name:"非自然人-银行业金融机构金融消费者投诉分类统计表", type:"统计", icon:"data-analysis.svg", tone:"purple", focus:"非自然人投诉分类", filters:[date(), filter("工单接收机构", "select"), special()], dimensions:["业务办理渠道", "业务类型", "投诉原因"] }
  ];

  const internal = [
    ["complaint-overall", "投诉整体情况统计表", "统计", "投诉类别", [date(), filter("受理渠道", "select"), filter("工单接收机构", "select"), filter("所属业务条线", "select"), special()]],
    ["business-line-overall", "业务条线整体情况统计表", "统计", "业务条线", [date(), filter("受理渠道", "select"), filter("工单接收机构", "select"), filter("所属业务条线", "select"), special()]],
    ["complaint-daily", "投诉日报", "统计", "日报统计口径", [date(), filter("受理渠道", "select"), filter("工单接收机构", "select"), filter("所属业务条线", "select"), special()]],
    ["complaint-reduction", "投诉压降统计表", "统计", "压降责任机构", [date(), filter("受理渠道", "select"), filter("工单接收机构", "select"), filter("所属业务条线", "select"), special()]],
    ["rectification-detail", "溯源整改明细表", "明细", "整改问题", [date(), filter("整改部门或机构", "select"), filter("整改单名称", "keyword"), filter("问题来源", "select"), filter("投诉产品标签", "multiSelect"), filter("投诉原因标签", "multiSelect")]],
    ["rectification-statistics", "溯源整改统计表", "统计", "整改阶段", [date(), filter("整改部门或机构", "select")]],
    ["dispute-resolution-detail", "纠纷化解明细表", "明细", "化解记录", [date(), filter("调处机构", "select"), filter("化解方式", "select")]],
    ["dispute-resolution-statistics", "纠纷化解统计表", "统计", "化解方式", [date(), filter("调处机构", "select"), filter("化解方式", "select")]],
    ["abnormal-detail", "异常投诉明细表", "明细", "异常投诉类型", [date(), filter("异常投诉类型", "select"), filter("工单接收机构", "select")]],
    ["abnormal-statistics", "异常投诉统计表", "统计", "异常投诉类型", [date(), filter("异常投诉类型", "select"), filter("所属机构", "select")]],
    ["accountability-detail", "投诉问责明细表", "明细", "问责对象", [date(), filter("工单接收机构", "select"), filter("问责对象", "keyword")]],
    ["accountability-statistics", "投诉问责统计表", "统计", "问责对象", [date(), filter("工单接收机构", "select"), filter("问责对象", "keyword")]],
    ["customer-behavior", "客户投诉行为画像分析表", "统计", "客户投诉行为", [filter("时间范围", "dateRange"), filter("工单类型", "select"), filter("客户编号", "keyword"), filter("客户姓名", "keyword"), filter("投诉产品标签", "multiSelect"), filter("投诉原因标签", "multiSelect"), filter("投诉笔数", "range")]],
    ["event-type-detail", "事件单类型明细表", "明细", "事件单类型", [date(), filter("工单类型", "select"), filter("工单编号", "keyword"), filter("工单状态", "select"), filter("受理渠道", "select")]],
    ["complaint-tag-detail", "投诉标签明细表", "明细", "投诉标签", [date(), filter("工单类型", "select"), filter("工单编号", "keyword"), filter("工单状态", "select"), filter("工单接收机构", "select")]],
    ["processing-status-detail", "处理状态明细表", "明细", "处理状态", [date(), filter("工单类型", "select"), filter("工单编号", "keyword"), filter("工单状态", "select"), filter("受理渠道", "select"), filter("投诉/信访机构", "select"), special()]],
    ["unfinished-detail", "未办结工单明细表", "明细", "未办结状态", [date(), filter("工单类型", "select"), filter("工单编号", "keyword"), filter("工单状态", "select"), filter("受理渠道", "select"), filter("工单接收机构", "select"), special()]],
    ["event-processing", "事件单处理统计表", "统计", "事件单处理结果", [date(), filter("工单类型", "select"), filter("受理渠道", "select"), filter("责任机构", "select"), special()]],
    ["customer-service", "客服系统统计表", "统计", "客服渠道", [date(), filter("受理渠道", "select"), filter("投诉/信访机构", "select"), special()]],
    ["regulatory-transfer", "监管转办统计表", "统计", "监管转办来源", [date(), filter("受理渠道", "select"), filter("投诉/信访机构", "select"), special()]],
    ["other-self-received", "其他自收统计表", "统计", "其他自收渠道", [date(), filter("受理渠道", "select"), filter("投诉/信访机构", "select"), special()]]
  ].map((item, index) => ({ id:item[0], name:item[1], type:item[2], focus:item[3], filters:item[4], icon:["data-analysis.svg", "document.svg", "date.svg", "receiving.svg", "files.svg"][index % 5], tone:["blue", "purple", "orange", "red", "yellow"][index % 5] }));

  const reportOptions = Object.freeze({
    "异常投诉类型":["频繁投诉", "恶意投诉", "不合理诉求"],
    "化解方式":["协商和解", "调解", "其他"],
    "问题来源":["投诉分析", "监管要求", "内部检查"]
  });

  function normalizeReport(report) {
    const filters = report.filters.map((item, index) => item.specialFilters
      ? { key:"exclusionRules", control:"checkboxes", label:"剔除规则", options:item.specialFilters }
      : { ...item, key:item.control === "dateRange" ? "date-" + index : "filter-" + index, options:item.options.length ? item.options : (reportOptions[item.label] || []) });
    return { ...report, filters };
  }

  const groups = [ { title:"监管报表", items:regulatory.map(normalizeReport) }, { title:"行内报表", items:internal.map(normalizeReport) } ];
  const freezeReport = item => Object.freeze({ ...item, filters:Object.freeze(item.filters.map(entry => Object.freeze({ ...entry, options:Object.freeze([...(entry.options || [])]) }))), dimensions:Object.freeze([...(item.dimensions || [])]) });
  global.XIB_COMPLAINT_REPORTS_DATA = Object.freeze({
    groups:Object.freeze(groups.map(group => Object.freeze({ title:group.title, items:Object.freeze(group.items.map(freezeReport)) }))),
    reports:Object.freeze(groups.flatMap(group => group.items).map(freezeReport)),
    controlLabels:Object.freeze({ select:"下拉筛选", keyword:"关键词搜索", dateRange:"时间选择", multiSelect:"多选框", range:"上下限范围", checkboxes:"多选框" })
  });
})(window);
