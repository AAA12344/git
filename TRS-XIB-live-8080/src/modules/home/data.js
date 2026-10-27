(function createHomeTaskInboxData(global) {
  "use strict";

  const complaintTasks = [
    { id:"task-ticket-create-01", tab:"ticket-create", ownerRole:"operator", institution:"总行", businessType:"表扬单", businessNo:"BY202607300011", status:"待提交", deadlineAt:"2026-10-17T18:00:00", target:{ kind:"ticket", id:"BY202607300011", mode:"create" } },
    { id:"task-ticket-create-02", tab:"ticket-create", ownerRole:"operator", institution:"总行", businessType:"投诉单", businessNo:"TS202608080012", status:"待提交", deadlineAt:"2026-10-19T18:00:00", target:{ kind:"ticket", id:"TS202608080012", mode:"create" } },
    { id:"task-subprocess-create-01", tab:"subprocess-create", ownerRole:"operator", institution:"总行", businessType:"投诉校正", businessNo:"JZ202607290015", status:"待提交", deadlineAt:"2026-10-18T18:00:00", target:{ kind:"subprocess", id:"JZ202607290015", relatedTicketId:"TS202607250031", mode:"create" } },
    { id:"task-subprocess-create-02", tab:"subprocess-create", ownerRole:"operator", institution:"总行", businessType:"投诉调查", businessNo:"DC202608070003", status:"待提交", deadlineAt:"2026-10-20T18:00:00", target:{ kind:"subprocess", id:"DC202608070003", relatedTicketId:"TS202608060018", mode:"create" } },
    { id:"task-ticket-process-01", tab:"ticket-process", ownerRole:"handler", institution:"总行", businessType:"投诉单", businessNo:"TS202607230012", status:"处理中", deadlineAt:"2026-09-01T18:00:00", target:{ kind:"ticket", id:"TS202607230012", mode:"process" } },
    { id:"task-ticket-process-02", tab:"ticket-process", ownerRole:"handler", institution:"总行", businessType:"信访单", businessNo:"XF202607210008", status:"待处理", deadlineAt:"2026-09-02T18:00:00", target:{ kind:"ticket", id:"XF202607210008", mode:"process" } },
    { id:"task-subprocess-process-01", tab:"subprocess-process", ownerRole:"handler", institution:"总行", businessType:"投诉调查", businessNo:"DC202607310099", status:"待处理", deadlineAt:"2026-09-06T18:00:00", target:{ kind:"subprocess", id:"DC202607310099", relatedTicketId:"TS202607250031", mode:"process" } },
    { id:"task-subprocess-process-02", tab:"subprocess-process", ownerRole:"handler", institution:"总行", businessType:"异议核查", businessNo:"HC202607200006", status:"处理中", deadlineAt:"2026-09-07T18:00:00", target:{ kind:"subprocess", id:"HC202607200006", relatedTicketId:"TS202607250031", mode:"process" } },
    { id:"task-ticket-approval-01", tab:"ticket-approval", ownerRole:"approver", institution:"总行", businessType:"表扬单", businessNo:"BY202607220021", status:"待审批", deadlineAt:"2026-09-06T18:00:00", target:{ kind:"approval", id:"BY202607220021" } },
    { id:"task-ticket-approval-02", tab:"ticket-approval", ownerRole:"reviewer", institution:"总行", businessType:"投诉单", businessNo:"TS202608090028", status:"待复核", deadlineAt:"2026-09-07T18:00:00", target:{ kind:"approval", id:"TS202608090028" } },
    { id:"task-subprocess-approval-01", tab:"subprocess-approval", ownerRole:"approver", institution:"总行", businessType:"投诉问责", businessNo:"WZ202607270005", status:"待审批", deadlineAt:"2026-09-07T18:00:00", target:{ kind:"approval", id:"WZ202607270005" } },
    { id:"task-subprocess-approval-02", tab:"subprocess-approval", ownerRole:"reviewer", institution:"总行", businessType:"投诉调查", businessNo:"DC202608060006", status:"复核中", deadlineAt:"2026-09-04T18:00:00", target:{ kind:"approval", id:"DC202608060006" } },
    { id:"task-sms-approval-01", tab:"sms-approval", ownerRole:"approver", institution:"总行", businessNo:"DX202607310101", relatedBusinessNo:"TS202607230012", status:"待审批", deadlineAt:"2026-09-04T18:00:00", target:{ kind:"approval", id:"DX202607310101" } },
    { id:"task-sms-approval-02", tab:"sms-approval", ownerRole:"approver", institution:"总行", businessNo:"DX202607310102", relatedBusinessNo:"BY202607220021", status:"审批中", deadlineAt:"2026-09-05T18:00:00", target:{ kind:"approval", id:"DX202607310102" } },
    { id:"task-export-approval-01", tab:"export-approval", ownerRole:"approver", institution:"总行", businessNo:"DC202607310201", exportType:"工单", status:"待审批", deadlineAt:"2026-09-04T18:00:00", target:{ kind:"approval", id:"DC202607310201" } },
    { id:"task-export-approval-02", tab:"export-approval", ownerRole:"analyst", institution:"总行", businessNo:"DC202607310202", exportType:"子单", status:"审批中", deadlineAt:"2026-09-03T18:00:00", target:{ kind:"approval", id:"DC202607310202" } }
  ];

  const supplementalTaskNumbers = {
    "ticket-create":["BY202610160031","TS202610160032","JY202610160033"],
    "ticket-process":["TS202610160041","XF202610160042","BY202610160043"],
    "ticket-approval":["JY202610160051","TS202610160052","XF202610160053"],
    "subprocess-create":["DC202610160061","JZ202610160062","HC202610160063"],
    "subprocess-process":["DC202610160071","WZ202610160072","HC202610160073"],
    "subprocess-approval":["DC202610160081","WZ202610160082","JZ202610160083"],
    "sms-approval":["DX202610160091","DX202610160092","DX202610160093"],
    "export-approval":["DC202610160101","DC202610160102","DC202610160103"]
  };
  Object.entries(supplementalTaskNumbers).forEach(([tab,numbers]) => {
    const templates = complaintTasks.filter(item => item.tab === tab);
    numbers.forEach((businessNo,index) => {
      const source = templates[index % templates.length];
      complaintTasks.push({
        ...source,
        id:`task-${tab}-0${index + 3}`,
        businessNo,
        relatedBusinessNo:source.relatedBusinessNo ? `TS202610160${String(index + 21).padStart(3,"0")}` : undefined,
        deadlineAt:`2026-10-${18 + index}T18:00:00`,
        target:{ ...source.target,id:businessNo }
      });
    });
  });

  const reviewTasks = [
    { id:"review-task-01", domain:"review", viewRole:"operator", businessType:"消保审查", title:"审查项目材料提交", businessNo:"SC202608130001", status:"待提交", deadlineAt:"2026-09-18T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608130001" } },
    { id:"review-task-02", domain:"review", viewRole:"operator", businessType:"消保审查", title:"审查材料重新提交", businessNo:"SC202608120006", status:"待提交", deadlineAt:"2026-09-16T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608120006" } },
    { id:"review-task-03", domain:"review", viewRole:"handler", businessType:"消保审查", title:"审查意见处理", businessNo:"SC202608110009", status:"处理中", deadlineAt:"2026-09-14T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608110009" } },
    { id:"review-task-04", domain:"review", viewRole:"handler", businessType:"消保审查", title:"审查项目领取处理", businessNo:"SC202608120011", status:"待处理", deadlineAt:"2026-09-20T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608120011" } },
    { id:"review-task-05", domain:"review", viewRole:"reviewer", businessType:"消保审查", title:"审查材料复核", businessNo:"SC202608100018", status:"待复核", deadlineAt:"2026-09-12T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608100018" } },
    { id:"review-task-06", domain:"review", viewRole:"reviewer", businessType:"消保审查", title:"审查结论复核", businessNo:"SC202608090021", status:"复核中", deadlineAt:"2026-09-15T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608090021" } },
    { id:"review-task-07", domain:"review", viewRole:"approver", businessType:"消保审查", title:"审查结论审批", businessNo:"SC202608080027", status:"待审批", deadlineAt:"2026-09-13T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608080027" } },
    { id:"review-task-08", domain:"review", viewRole:"approver", businessType:"消保审查", title:"审查项目审批", businessNo:"SC202608070032", status:"审批中", deadlineAt:"2026-09-11T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608070032" } },
    { id:"review-task-09", domain:"review", viewRole:"analyst", businessType:"消保审查", title:"审查资料补录", businessNo:"SC202608120035", status:"待补录", deadlineAt:"2026-09-17T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608120035" } },
    { id:"review-task-10", domain:"review", viewRole:"analyst", businessType:"消保审查", title:"审查项目初审提交", businessNo:"SC202608110041", status:"待提交", deadlineAt:"2026-09-19T18:00:00", target:{ kind:"review", route:"review-manage", id:"SC202608110041" } }
  ];

  complaintTasks.forEach(item => { item.domain = "complaint"; });
  const tasks = Object.freeze([...complaintTasks, ...reviewTasks]);

  const monthlyWorkItems = Object.freeze([
    ["complaint","ticket","operator","已办结","2026-10-15T18:00:00","2026-10-15T15:20:00"],
    ["complaint","ticket","operator","处理中","2026-10-17T18:00:00",""],
    ["complaint","ticket","operator","待提交","2026-10-19T18:00:00",""],
    ["complaint","ticket","handler","已办结","2026-10-15T18:00:00","2026-10-15T16:10:00"],
    ["complaint","ticket","handler","已废止","2026-10-16T18:00:00","2026-10-16T11:30:00"],
    ["complaint","ticket","handler","处理中","2026-10-15T18:00:00",""],
    ["complaint","ticket","handler","待处理","2026-10-16T18:00:00",""],
    ["complaint","ticket","handler","处理中","2026-09-10T18:00:00",""],
    ["complaint","ticket","analyst","已办结","2026-08-08T18:00:00","2026-08-09T17:00:00"],
    ["complaint","ticket","analyst","待补录","2026-10-20T18:00:00",""],
    ["complaint","ticket","operator","草稿","2026-10-22T18:00:00",""],
    ["complaint","subprocess","operator","已办结","2026-10-15T18:00:00","2026-10-15T14:00:00"],
    ["complaint","subprocess","operator","待提交","2026-10-18T18:00:00",""],
    ["complaint","subprocess","handler","已办结","2026-10-15T18:00:00","2026-10-15T16:30:00"],
    ["complaint","subprocess","handler","处理中","2026-10-21T18:00:00",""],
    ["complaint","subprocess","handler","待处理","2026-09-09T18:00:00",""],
    ["complaint","subprocess","analyst","已废止","2026-08-03T18:00:00","2026-08-03T12:10:00"],
    ["complaint","subprocess","analyst","待补录","2026-10-20T18:00:00",""],
    ["complaint","subprocess","operator","草稿","2026-10-23T18:00:00",""],
    ["review","project","operator","已办结","2026-08-07T18:00:00","2026-08-07T16:00:00"],
    ["review","project","operator","待提交","2026-11-01T18:00:00",""],
    ["review","project","handler","已办结","2026-08-05T18:00:00","2026-08-06T17:10:00"],
    ["review","project","handler","处理中","2026-10-28T18:00:00",""],
    ["review","project","handler","处理中","2026-08-11T18:00:00",""],
    ["review","project","analyst","待补录","2026-10-31T18:00:00",""],
    ["review","project","operator","草稿","2026-11-03T18:00:00",""],
    ["review","item","operator","已办结","2026-08-05T18:00:00","2026-08-05T11:20:00"],
    ["review","item","operator","待提交","2026-10-30T18:00:00",""],
    ["review","item","handler","已办结","2026-08-04T18:00:00","2026-08-04T17:30:00"],
    ["review","item","handler","待处理","2026-11-03T18:00:00",""],
    ["review","item","analyst","已废止","2026-08-03T18:00:00","2026-08-03T10:40:00"],
    ["review","item","analyst","待补录","2026-11-02T18:00:00",""]
  ].map((item,index) => Object.freeze({ id:`monthly-${String(index + 1).padStart(2,"0")}`, domain:item[0], kind:item[1], ownerRole:item[2], status:item[3], deadlineAt:item[4], completedAt:item[5], institution:"总行", createdAt:"2026-10-15T09:00:00" })));

  const shortcuts = [
    { label:"新建工单", route:"ticket-form", icon:"document-add.svg" },
    { label:"工单处理", route:"ticket-process", icon:"document-check.svg" },
    { label:"子单处理", route:"subprocess-manage", icon:"process.svg" },
    { label:"审批管理", route:"my-approvals", icon:"seal-outline.svg" },
    { label:"查询导出", route:"ledger-query", icon:"excel.svg" },
    { label:"整改处理", route:"rectification-process", icon:"project-outline.svg" }
  ];
  const recentByRole = {
    developer:[
      { businessNo:"TS202607230012", documentType:"投诉单", subject:"陈晓敏 · 贷款协商还款", status:"处理中", time:"10:36", target:{ kind:"ticket", id:"TS202607230012", mode:"process" } },
      { businessNo:"DC202607310099", documentType:"投诉调查子单", subject:"张女士 · 投诉调查子单", status:"待处理", time:"09:40", target:{ kind:"subprocess", id:"DC202607310099", relatedTicketId:"TS202607250031", mode:"process" } },
      { businessNo:"ZG202607170004", documentType:"溯源整改单", subject:"账户管控流程整改", status:"整改中", time:"09:18", target:{ kind:"rectification", id:"ZG202607170004", mode:"process" } }
    ],
    operator:[
      { businessNo:"BY202607300011", documentType:"表扬单", subject:"林女士 · 服务质量与态度", status:"待提交", time:"10:12", target:{ kind:"ticket", id:"BY202607300011", mode:"create" } },
      { businessNo:"JZ202607290015", documentType:"投诉调查子单", subject:"周先生 · 账户服务争议", status:"待提交", time:"09:45", target:{ kind:"subprocess", id:"JZ202607290015", relatedTicketId:"TS202607250031", mode:"create" } }
    ],
    handler:[
      { businessNo:"TS202607230012", documentType:"投诉单", subject:"陈晓敏 · 贷款协商还款", status:"处理中", time:"10:36", target:{ kind:"ticket", id:"TS202607230012", mode:"process" } },
      { businessNo:"ZG202607170004", documentType:"溯源整改单", subject:"账户管控流程整改", status:"整改中", time:"09:18", target:{ kind:"rectification", id:"ZG202607170004", mode:"process" } }
    ],
    approver:[
      { businessNo:"BY202607220021", documentType:"表扬单", subject:"林女士 · 服务质量与态度", status:"待审批", time:"08:50", target:{ kind:"approval", id:"BY202607220021" } },
      { businessNo:"DX202607310101", documentType:"短信审批", subject:"办结告知短信发送申请", status:"待审批", time:"08:30", target:{ kind:"approval", id:"DX202607310101" } }
    ],
    reviewer:[
      { businessNo:"TS202608090028", documentType:"投诉单", subject:"王女士 · 个人经营贷款投诉", status:"待复核", time:"10:05", target:{ kind:"approval", id:"TS202608090028" } },
      { businessNo:"DC202608060006", documentType:"投诉调查子单", subject:"关联工单调查结论复核", status:"复核中", time:"09:22", target:{ kind:"approval", id:"DC202608060006" } }
    ],
    analyst:[
      { businessNo:"TS202608080012", documentType:"投诉单", subject:"信用卡还款渠道投诉", status:"待提交", time:"10:20", target:{ kind:"ticket", id:"TS202608080012", mode:"create" } },
      { businessNo:"DC202608070003", documentType:"投诉调查子单", subject:"投诉响应机制整改", status:"待补录", time:"09:18", target:{ kind:"subprocess", id:"DC202608070003", relatedTicketId:"TS202608060018", mode:"supplement" } }
    ]
  };
  function taskCounts(role = "developer") {
    const approvalRoles = new Set(["reviewer","approver","analyst"]);
    const visible = role === "developer" ? tasks : tasks.filter(item => item.domain === "review" ? item.viewRole === role : (
      item.ownerRole === role || (approvalRoles.has(role) && ["ticket-approval","subprocess-approval","sms-approval","export-approval"].includes(item.tab))
    ));
    const complaint = visible.filter(item => item.domain === "complaint").length;
    const review = visible.filter(item => item.domain === "review").length;
    return Object.freeze({ complaint, review, total:complaint + review });
  }
  global.XIBHomeTaskInboxData = Object.freeze({ tasks, monthlyWorkItems, shortcuts, recent:recentByRole.developer, recentByRole, taskCounts });
})(window);
