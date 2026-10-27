(function createNotificationCenterData(global) {
  "use strict";

  const PLACEHOLDER_PATTERN = /【([^】]+)】(单)?/g;

  function formatNotificationTemplate(template, fields = {}) {
    return String(template || "").replace(PLACEHOLDER_PATTERN, (token, fieldName, suffix = "") => {
      if (!Object.prototype.hasOwnProperty.call(fields, fieldName)) return token;
      const value = String(fields[fieldName] ?? "");
      return suffix && value.endsWith(suffix) ? value : value + suffix;
    });
  }

  function notification(config) {
    const fields = Object.freeze({ ...(config.fields || {}) });
    const reminderType = config.reminderType;
    return Object.freeze({
      ...config,
      domain: config.domain === "review" ? "review" : "complaint",
      deliveryType: config.deliveryType === "抄送" ? "抄送" : "主送",
      category: reminderType,
      fields,
      title: formatNotificationTemplate(config.titleTemplate, fields),
      content: formatNotificationTemplate(config.contentTemplate, fields)
    });
  }

  const notifications = Object.freeze([
    notification({ id:"notice-01", reminderType:"审批结果", titleTemplate:"【工/子单类型】复核被驳回", contentTemplate:"您提交的【工单类型】单（编号为【工单编号】）复核审批驳回，请尽快处理！", fields:{ "工/子单类型":"表扬单", "工单类型":"表扬单", "工单编号":"BY202607300011" }, sentAt:"2026-08-11 10:16", time:"10分钟前", read:false, roles:["operator"], source:"工单复核", target:{ kind:"ticket", id:"BY202607300011", mode:"view" } }),
    notification({ id:"notice-02", reminderType:"待办提醒", titleTemplate:"【工/子单类型】待复核", contentTemplate:"您的工单池内一条【工单类型】单（编号为【工单编号】）待复核，请尽快处理！", fields:{ "工/子单类型":"投诉单", "工单类型":"投诉单", "工单编号":"TS202608090028" }, sentAt:"2026-08-11 09:52", time:"今天 09:52", read:false, roles:["reviewer"], source:"工单复核", target:{ route:"my-approvals" } }),
    notification({ id:"notice-03", reminderType:"特急催办", titleTemplate:"【工/子单类型】已超期", contentTemplate:"您正在处理的一条【工单类型】单（编号为【工单编号】）已超期，请尽快处理！", fields:{ "工/子单类型":"投诉单", "工单类型":"投诉单", "工单编号":"TS202607230012" }, sentAt:"2026-08-11 09:31", time:"今天 09:31", read:false, roles:["handler"], source:"工单处理", target:{ kind:"ticket", id:"TS202607230012", mode:"process" } }),
    notification({ id:"notice-04", reminderType:"加急催办", titleTemplate:"【工/子单类型】响应已超时", contentTemplate:"您的工单池内一条【工单类型】单（编号为【工单编号】）响应已超时，请尽快处理！", fields:{ "工/子单类型":"信访单", "工单类型":"信访单", "工单编号":"XF202607210008" }, sentAt:"2026-08-11 09:30", time:"今天 09:30", read:false, roles:["handler"], source:"工单处理", target:{ route:"ticket-process" } }),
    notification({ id:"notice-05", reminderType:"消息通知", titleTemplate:"实时质检不通过", contentTemplate:"您处理的一条【工单类型】单（编号为【工单编号】）实时质检不通过，请知悉！", fields:{ "工单类型":"表扬单", "工单编号":"BY202607220021" }, sentAt:"2026-08-11 09:28", time:"今天 09:28", read:true, roles:["handler","approver"], source:"智能核查", target:{ kind:"ticket", id:"BY202607220021", mode:"view" } }),
    notification({ id:"notice-06", reminderType:"正常催办", titleTemplate:"导出申请待审批", contentTemplate:"您的工单池内一条导出申请（编号为【导出申请编号】）待审批，请研判审批！", fields:{ "导出申请编号":"DC202607310201" }, sentAt:"2026-08-11 08:45", time:"今天 08:45", read:true, roles:["approver"], source:"查询导出", target:{ kind:"approval", id:"DC202607310201" } }),
    notification({ id:"notice-07", reminderType:"待办提醒", titleTemplate:"短信发送失败", contentTemplate:"您于【联系时间】发送给【客户姓名】的短信发送失败，短信内容为：【短信内容】", fields:{ "联系时间":"2026-08-11 09:26", "客户姓名":"郑女士", "短信内容":"请您及时查看投诉处理结果。" }, sentAt:"2026-08-11 09:27", time:"今天 09:27", read:false, roles:["handler"], source:"联系记录", target:{ kind:"ticket", id:"TS202607230012", mode:"process" } }),
    notification({ id:"notice-08", deliveryType:"抄送", reminderType:"消息通知", titleTemplate:"督导函抄送通知", contentTemplate:"您处理的一条【工单类型】单（编号为【工单编号】）收到一条督导函（编号为【督导函编号】），请知悉！", fields:{ "工单类型":"投诉单", "工单编号":"TS202607230012", "督导函编号":"DH202608040001" }, sentAt:"2026-08-10 17:42", time:"昨天 17:42", read:true, roles:["approver"], source:"督导函", target:{ kind:"supervision", id:"DH202608040001", mode:"view" } }),
    notification({ id:"notice-09", reminderType:"审批结果", titleTemplate:"短信审批被驳回", contentTemplate:"您正在处理的一条【工单类型】单（编号为【工单编号】）短信审批驳回，请尽快处理！", fields:{ "工单类型":"投诉单", "工单编号":"TS202607230012" }, sentAt:"2026-08-10 16:18", time:"昨天 16:18", read:true, roles:["handler"], source:"短信审批", target:{ kind:"ticket", id:"TS202607230012", mode:"process" } }),
    notification({ id:"notice-10", reminderType:"正常催办", titleTemplate:"【工/子单类型】处理即将超期", contentTemplate:"您正在处理的一条【工单类型】单（编号为【工单编号】）还剩【剩余处置时间】超期，请尽快处理！", fields:{ "工/子单类型":"投诉单", "工单类型":"投诉单", "工单编号":"TS202607310106", "剩余处置时间":"10天" }, sentAt:"2026-08-10 15:06", time:"昨天 15:06", read:true, roles:["handler"], source:"工单处理", target:{ kind:"ticket", id:"TS202607310106", mode:"process" } }),
    notification({ id:"notice-11", reminderType:"待办提醒", titleTemplate:"短信审批待处理", contentTemplate:"您的工单池内一条【工单类型】单（编号为【工单编号】）短信审批待处理，请尽快处理！", fields:{ "工单类型":"投诉单", "工单编号":"TS202607230012" }, sentAt:"2026-08-10 14:32", time:"昨天 14:32", read:false, roles:["approver"], source:"短信审批", target:{ kind:"approval", id:"DX202607310101" } }),
    notification({ id:"notice-12", reminderType:"待办提醒", titleTemplate:"整改结果待审批", contentTemplate:"您的工单池内一条溯源整改单（编号为【整改单编号】）整改结果待审批，请尽快处理！", fields:{ "整改单编号":"ZG202607310104" }, sentAt:"2026-08-10 11:20", time:"昨天 11:20", read:false, roles:["approver"], source:"溯源整改", target:{ kind:"rectification", id:"ZG202607310104", mode:"approve" } }),
    notification({ id:"notice-13", reminderType:"待办提醒", titleTemplate:"【工/子单类型】待复核", contentTemplate:"您的工单池内一条【工单类型】单（编号为【工单编号】）待复核，请尽快处理！", fields:{ "工/子单类型":"投诉单", "工单类型":"投诉单", "工单编号":"TS202608090028" }, sentAt:"2026-08-11 10:02", time:"今天 10:02", read:false, roles:["reviewer"], source:"工单复核", target:{ kind:"approval", id:"TS202608090028" } }),
    notification({ id:"notice-14", reminderType:"待办提醒", titleTemplate:"【工/子单类型】草稿待完善", contentTemplate:"您的自动带入草稿箱一条【工单类型】单（编号为【工单编号】）待完善，请尽快处理！", fields:{ "工/子单类型":"投诉单", "工单类型":"投诉单", "工单编号":"TS202608080012" }, sentAt:"2026-08-11 09:48", time:"今天 09:48", read:true, roles:["analyst"], source:"工单创建", target:{ kind:"ticket", id:"TS202608080012", mode:"create" } }),
    notification({ id:"notice-15", reminderType:"审批结果", titleTemplate:"【子单类型】审批通过待补录", contentTemplate:"您提交的【子单类型】（编号为【子单编号】）审批通过，请继续补录材料！", fields:{ "子单类型":"投诉调查子单", "子单编号":"DC202608070003" }, sentAt:"2026-08-11 09:20", time:"今天 09:20", read:false, roles:["analyst"], source:"子单审批", target:{ kind:"subprocess", id:"DC202608070003", relatedTicketId:"TS202608060018", mode:"supplement" } }),
    notification({ id:"review-notice-01", domain:"review", reminderType:"审批结果", titleTemplate:"消保审查项目被退回", contentTemplate:"您提交的消保审查项目（编号为【审查项目编号】）已退回，请补充材料后重新提交！", fields:{ "审查项目编号":"SC202608120006" }, sentAt:"2026-08-13 10:18", time:"12分钟前", read:false, roles:["operator"], source:"消保审查", target:{ route:"review-manage", id:"SC202608120006" } }),
    notification({ id:"review-notice-02", domain:"review", reminderType:"待办提醒", titleTemplate:"消保审查意见待处理", contentTemplate:"消保审查项目（编号为【审查项目编号】）的审查意见待处理，请及时办理！", fields:{ "审查项目编号":"SC202608110009" }, sentAt:"2026-08-13 10:05", time:"今天 10:05", read:false, roles:["handler"], source:"消保审查", target:{ route:"review-manage", id:"SC202608110009" } }),
    notification({ id:"review-notice-03", domain:"review", reminderType:"待办提醒", titleTemplate:"消保审查材料待复核", contentTemplate:"消保审查项目（编号为【审查项目编号】）的材料待复核，请及时处理！", fields:{ "审查项目编号":"SC202608100018" }, sentAt:"2026-08-13 09:52", time:"今天 09:52", read:false, roles:["reviewer"], source:"消保审查", target:{ route:"review-manage", id:"SC202608100018" } }),
    notification({ id:"review-notice-04", domain:"review", reminderType:"待办提醒", titleTemplate:"消保审查结论待审批", contentTemplate:"消保审查项目（编号为【审查项目编号】）的审查结论待审批，请及时处理！", fields:{ "审查项目编号":"SC202608080027" }, sentAt:"2026-08-13 09:40", time:"今天 09:40", read:false, roles:["approver"], source:"消保审查", target:{ route:"review-manage", id:"SC202608080027" } }),
    notification({ id:"review-notice-05", domain:"review", reminderType:"消息通知", titleTemplate:"消保审查项目已分派", contentTemplate:"消保审查项目（编号为【审查项目编号】）已分派至您，请及时查看！", fields:{ "审查项目编号":"SC202608110041" }, sentAt:"2026-08-13 09:28", time:"今天 09:28", read:true, roles:["analyst"], source:"消保审查", target:{ route:"review-manage", id:"SC202608110041" } })
  ]);

  global.XIBNotificationCenterData = Object.freeze({ notifications, formatNotificationTemplate });
})(window);
