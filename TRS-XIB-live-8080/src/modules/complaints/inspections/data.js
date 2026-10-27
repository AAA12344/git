(function defineComplaintInspectionsData(global) {
  "use strict";

  const deepClone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const deepFreeze = value => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };

  const batchRows = [
    ["ZJ20250634002", "已完成", "2023-10-30 10:45:00", "北京分行", "北京西直门支行", "26", "23", "3", "93.7%"],
    ["ZJ20250634003", "已完成", "2023-10-30 10:45:00", "北京分行", "北京分行", "123", "121", "2", "98.9%"],
    ["ZJ20250634004", "已完成", "2023-10-30 10:45:00", "北京分行", "北京西直门支行", "78", "73", "5", "96.4%"],
    ["ZJ20250634005", "已完成", "2023-10-30 10:45:00", "北京分行", "北京西直门支行", "64", "54", "10", "85.4%"],
    ["ZJ20250634006", "已完成", "2023-10-30 10:45:00", "北京分行", "北京西直门支行", "156", "147", "9", "97.7%"],
    ["ZJ20250634007", "已完成", "2023-10-30 10:45:00", "北京分行", "北京西直门支行", "98", "96", "2", "99.0%"],
    ["ZJ20250634008", "已完成", "2023-10-30 10:45:00", "北京分行", "北京西直门支行", "75", "75", "0", "100%"],
    ["ZJ20250634009", "已完成", "2023-10-30 10:45:00", "北京分行", "北京西直门支行", "75", "75", "0", "100%"]
  ];

  const inspectionRun = (submittedAt, entry, communications = [], productBusinessGroups = []) => ({
    submittedAt,
    findings:{
      entry,
      communications:{ passed:communications.every(item => item?.passed === true), items:communications },
      productBusiness:{ passed:productBusinessGroups.length === 0, groups:productBusinessGroups }
    }
  });

  const ticketLibrary = [
    {
      id:"TS202607230012", createdAt:"2026-07-16 09:32", creator:"陈敏慧-60157", channel:"客服电话", institution:"厦门分行", department:"厦门分行消费者权益保护部", handler:"王琳-27519", approver:"赵宁-29816",
      conclusions:{ entry:{ level:"通过", text:"客户身份、投诉事项、受理时间及分类字段完整，录入信息与客服摘要一致。" }, processing:{ level:"需补充", text:"处理意见已覆盖主要诉求，但费用测算依据和书面回复材料需要进一步补充。" }, behavior:{ level:"关注", text:"业务办理流程基本合规，建议复核息费说明和客户知情确认记录。" } },
      inspectionRuns:[
        inspectionRun("2026-07-18 10:30:00",
          { passed:false, nonCompliantItems:["工作人员处置情况"], conclusion:"上一轮核查：工作人员处置过程记录不完整。" },
          [{ passed:false, contactTime:"2026-07-18 10:26", nonCompliantItems:["结果告知不完整"], conclusion:"上一轮核查：未记录客户对费用测算依据的确认结果。" }],
          [{
            primaryLabel:"产品业务不合规标签1",
            primaryConclusion:"产品业务办理资料未充分证明关键环节已经履行告知义务。",
            secondaryItems:[
              { label:"产品业务不合规标签2", conclusion:"关键费用及适用条件的说明记录不完整。" }
            ]
          }]),
        inspectionRun("2026-07-20 16:05:00",
          { passed:false, nonCompliantItems:["工作人员处置情况","初次处置结果首次反映问题处理结果","处理依据"], conclusion:"事件还原和处置意见未完整记录工作人员处置过程及首次反映问题处理结果，处理依据也不充分。" },
          [
          { passed:false, contactTime:"2026-07-18 10:26", nonCompliantItems:["投诉渠道"], conclusion:"未明确记录客户对费用测算依据的确认结果。" },
          { passed:false, contactTime:"2026-07-20 15:42", nonCompliantItems:["投诉渠道","外呼行为不当","结果告知不完整"], conclusion:"沟通反馈中缺少下一步处理时限及责任人的告知记录。" }
        ], [
          {
            primaryLabel:"产品业务不合规标签1",
            primaryConclusion:"贷款息费说明与客户知情确认记录不完整。",
            secondaryItems:[
              { label:"产品业务不合规标签2", conclusion:"未清晰记录综合年化成本及费用构成的告知情况。" },
              { label:"产品业务不合规标签3", conclusion:"缺少客户对关键费用说明的确认记录。" }
            ]
          },
          {
            primaryLabel:"产品业务不合规标签4",
            primaryConclusion:"投诉处理依据与书面材料之间缺少完整对应关系。",
            secondaryItems:[
              { label:"产品业务不合规标签5", conclusion:"未关联具体制度条款及费用测算材料。" }
            ]
          }
        ])
      ]
    },
    {
      id:"XF202607210008", createdAt:"2026-07-16 08:45", creator:"周宁-39218", channel:"监管转办", institution:"厦门分行", department:"厦门分行消费者权益保护部", handler:"林海-38102", approver:"郭颖-18307",
      conclusions:{ entry:{ level:"通过", text:"信访来源、客户信息及账户管控事项记录完整。" }, processing:{ level:"通过", text:"核查材料、处理意见与联系记录能够相互印证。" }, behavior:{ level:"通过", text:"账户管控措施符合内部制度，已向客户说明处理依据。" } },
      inspectionRuns:[inspectionRun("2026-07-21 08:45:00", { passed:true, nonCompliantItems:[], conclusion:"信访事项录入完整。" })]
    },
    {
      id:"TS202411080211", createdAt:"2024-11-08 10:20", creator:"陈敏慧-60157", channel:"客服电话", institution:"厦门分行", department:"厦门分行消费者权益保护部", handler:"王琳-27519", approver:"赵宁-29816",
      conclusions:{ entry:{ level:"通过", text:"信用卡年费投诉信息录入完整。" }, processing:{ level:"通过", text:"客户沟通与处理结果记录完整。" }, behavior:{ level:"通过", text:"产品业务处理依据充分。" } },
      inspectionRuns:[inspectionRun("2024-11-12 15:40:00", { passed:true, nonCompliantItems:[], conclusion:"录入内容完整，未发现不合规项目。" })]
    },
    {
      id:"XF202607270024", createdAt:"2026-07-22 09:10", creator:"周宁-39218", channel:"监管转办", institution:"福州分行", department:"福州分行消费者权益保护部", handler:"林海-38102", approver:"郭颖-18307",
      conclusions:{ entry:{ level:"需补充", text:"贷款提前结清事项的处理依据需补充。" }, processing:{ level:"通过", text:"客户联系记录完整。" }, behavior:{ level:"通过", text:"未发现产品业务不合规事项。" } },
      inspectionRuns:[inspectionRun("2026-07-27 10:05:00", { passed:false, nonCompliantItems:["处理依据"], conclusion:"贷款提前结清处理依据缺少可核验材料。" })]
    }
  ];

  // 保留各阶段核查数据，页面仅在待审批和审批中展示结果。
  const submittedInspectionStatuses = new Set(["会签中", "待初审", "初审中", "待审批", "审批中", "已办结"]);
  const seededTickets = global.XIB_PROTOTYPE_CONFIG?.seedData?.lists?.tickets || [];
  const passedEntryInspection = () => ({ passed:true, nonCompliantItems:[], conclusion:"录入内容完整，未发现不合规项目。" });
  const failedEntryInspection = subject => ({
    passed:false,
    nonCompliantItems:["工作人员处置情况", "投诉处理结果", "处理依据"],
    conclusion:"“" + subject + "”未完整记录工作人员处置情况和投诉处理结果，处理依据也缺少可核验支撑。"
  });
  const contentEntryInspectionFailed = subject => ({
    passed:false,
    nonCompliantItems:["客户业务办理情况", "争议纠纷内容"],
    conclusion:"“" + subject + "”的业务办理经过和争议焦点记录不完整。"
  });
  const basisEntryInspectionFailed = () => ({
    passed:false,
    nonCompliantItems:["处理依据"],
    conclusion:"处理依据只有结论性描述，缺少可核验的事实或材料支撑。"
  });
  // 多笔联系记录分别核查，每笔保留独立时间、项目和理由。
  const failedCommunications = (ticket, index) => [
    {
      passed:false,
      contactTime:"2026-07-16 10:18:00",
      nonCompliantItems:index % 2 ? ["客户态度记录不完整"] : ["外呼行为不当", "结果告知不完整"],
      conclusion:index % 2 ? "联系记录未明确记载客户对处理结果的最终态度。" : "联系记录缺少下一步处理时限和责任人的告知内容。"
    },
    {
      passed:false,
      contactTime:"2026-07-17 08:50:00",
      nonCompliantItems:["救济途径告知不完整"],
      conclusion:"联系记录未完整说明客户可选择的救济途径。"
    }
  ];
  const failedProductBusiness = (ticket, index) => [
    {
      primaryLabel:"产品制度执行记录不完整",
      primaryConclusion:"“" + ticket.subject + "”涉及的产品制度执行记录存在不完整情形。",
      secondaryItems:[
        { label:"业务办理依据不完整", conclusion:index % 2 ? "业务办理依据与客户告知记录未能完整对应。" : "关键业务环节缺少可核验的操作留痕。" },
        ...(index % 3 === 0 ? [{ label:"产品风险提示不完整", conclusion:"补充材料未覆盖该产品风险提示的完整内容。" }] : [])
      ]
    },
    ...(index % 4 === 0 ? [{
      primaryLabel:"产品后续管理待核实",
      primaryConclusion:"产品后续管理环节存在需进一步核实的合规风险。",
      secondaryItems:[
        { label:"复核记录不完整", conclusion:"后续处理记录未体现制度要求的复核动作。" }
      ]
    }] : [])
  ];

  function generatedInspectionRun(ticket, index) {
    const variant = index % 5;
    // 审批中示例同时展示多笔沟通核查和产品业务标签理由。
    if (ticket.id === "TS202610190114") return inspectionRun(ticket.updatedAt + ":00", basisEntryInspectionFailed(), failedCommunications(ticket, index), failedProductBusiness(ticket, index));
    if (variant === 0) return inspectionRun(ticket.updatedAt + ":00", passedEntryInspection());
    if (variant === 1) return inspectionRun(ticket.updatedAt + ":00", failedEntryInspection(ticket.subject), failedCommunications(ticket, index), failedProductBusiness(ticket, index));
    if (variant === 2) return inspectionRun(ticket.updatedAt + ":00", contentEntryInspectionFailed(ticket.subject), [], failedProductBusiness(ticket, index));
    if (variant === 3) return inspectionRun(ticket.updatedAt + ":00", passedEntryInspection(), failedCommunications(ticket, index));
    return inspectionRun(ticket.updatedAt + ":00", basisEntryInspectionFailed(), failedCommunications(ticket, index), []);
  }

  const ticketInspectionRecordMap = new Map(
    ticketLibrary.filter(item => Array.isArray(item.inspectionRuns) && item.inspectionRuns.length).map(item => [item.id, item])
  );
  seededTickets
    .filter(ticket => ["投诉单", "信访单", "建议单", "表扬单"].includes(ticket.type) && submittedInspectionStatuses.has(ticket.status))
    .forEach((ticket, index) => {
      if (ticketInspectionRecordMap.has(ticket.id)) return;
      ticketInspectionRecordMap.set(ticket.id, {
        id:ticket.id,
        inspectionRuns:[generatedInspectionRun(ticket, index)]
      });
    });
  const ticketInspectionRecords = [...ticketInspectionRecordMap.values()];

  const initialSupervisionLetters = deepClone(
    global.XIB_PROTOTYPE_CONFIG?.seedData?.runtimeDefaults?.supervisionLetters || []
  );

  global.XIB_COMPLAINT_INSPECTIONS_DATA = deepFreeze({
    batchRows,
    ticketLibrary,
    ticketInspectionRecords,
    initialSupervisionLetters
  });
})(window);
