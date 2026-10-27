(function defineComplaintRectificationData(global) {
  "use strict";

  const configuredStatuses = global.XIB_PROTOTYPE_CONFIG?.workflowSchema?.documentStateMachines?.rectification?.statuses || [];
  const statusOrder = configuredStatuses.length ? [...configuredStatuses] : [
    "草稿", "问题待提交", "问题待审核", "方案待提交", "方案待初审", "方案待审批",
    "整改中", "结果待初审", "结果待审批", "已办结", "已废止"
  ];

  const routingRules = {
    problemSubmit: { target:"initiating", nextNode:"整改问题审核" },
    planSubmit: { target:"rectification", nextNode:"整改方案初审" },
    planInitialApprove: { target:"initiating", nextNode:"整改方案审批" },
    resultSubmit: { target:"rectification", nextNode:"整改结果初审" },
    resultInitialApprove: { target:"initiating", nextNode:"整改结果审批" }
  };

  const approvalCandidates = [
    { actor:"赵宁-29816", name:"赵宁", employeeNo:"29816", role:"审批员" },
    { actor:"郭颖-18307", name:"郭颖", employeeNo:"18307", role:"审批员" }
  ];

  global.XIB_COMPLAINT_RECTIFICATION_DATA = Object.freeze({
    statusOrder: Object.freeze(statusOrder),
    routingRules: Object.freeze(Object.fromEntries(Object.entries(routingRules).map(([key, value]) => [key, Object.freeze(value)]))),
    approvalCandidates: Object.freeze(approvalCandidates.map(candidate => Object.freeze(candidate))),
    processStates: Object.freeze(["方案待提交", "整改中"]),
    approvalStates: Object.freeze(["问题待审核", "方案待初审", "方案待审批", "结果待初审", "结果待审批"]),
    // 三级模块：状态 → 所属模块；各模块“我的工作台-待办”状态集
    modules: Object.freeze({
      create: Object.freeze({
        label: "整改创建",
        todoStates: Object.freeze(["草稿", "问题待提交"]),
        involveField: "base.创建人"
      }),
      process: Object.freeze({
        label: "整改处理",
        todoStates: Object.freeze(["方案待提交", "整改中"]),
        involveField: "entry.整改负责人（处置员）"
      }),
      approve: Object.freeze({
        label: "整改审批",
        todoStates: Object.freeze(["问题待审核", "方案待初审", "方案待审批", "结果待初审", "结果待审批"]),
        involveField: "approval.审批人"
      })
    }),
    operationOrder: Object.freeze(["edit", "process", "approve", "void", "delete", "view", "detail"])
  });
})(window);
