"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname,"..");
const sandbox = { window:{} };
vm.createContext(sandbox);
function run(relativePath) {
  const filename=path.join(root,relativePath);
  vm.runInContext(fs.readFileSync(filename,"utf8"),sandbox,{ filename });
}

run("src/core/module-registry.js");
run("src/modules/notifications/data.js");
run("src/modules/home/data.js");
run("src/modules/home/index.js");

const registry=sandbox.window.XIBModuleRegistry;
const data=sandbox.window.XIBHomeTaskInboxData;
const notifications=sandbox.window.XIBNotificationCenterData;
const opened=[];
const baseContext={ role:"developer", now:()=>Date.parse("2026-10-16T20:00:00+08:00"), currentUser:()=>"陈敏慧-60157", currentViewLabel:()=>"开发测试视图", currentInstitutionLabel:()=>"总行", currentDepartmentLabel:()=>"总行消费者权益保护部", allowed:()=>true, navigate:route=>opened.push({ route }), openWorkflowItem:target=>opened.push(target), statusTag:value=>`<span data-status="${value}">${value}</span>`, formatRemainingTime:(deadline,status)=>status === "待提交" ? "待提交" : "30天0小时0分钟" };
const developerHtml=registry.render("home-tasks",{ ...baseContext,taskInboxRole:"developer" });
const operatorHtml=registry.render("home-tasks",{ ...baseContext,taskInboxRole:"operator",currentViewLabel:()=>"经办员视图" });
const handlerHtml=registry.render("home-tasks",{ ...baseContext,taskInboxRole:"handler",currentViewLabel:()=>"处理员视图" });
const approverHtml=registry.render("home-tasks",{ ...baseContext,taskInboxRole:"approver",currentViewLabel:()=>"审批员视图" });

const workflow=JSON.parse(fs.readFileSync(path.join(root,"data/workflow-schema.json"),"utf8"));
const tagConfig=JSON.parse(fs.readFileSync(path.join(root,"data/status-tag-config.json"),"utf8"));
const allowedStatuses=new Set([...Object.values(workflow.documentStateMachines).flatMap(machine=>machine.statuses||[]),...Object.keys(tagConfig.statuses||{})]);
const targetKinds=new Set(["ticket","subprocess","supervision","rectification","approval","review"]);
data.tasks.forEach(task=>{
  if(task.domain==="review") assert.equal(["operator","handler","approver","reviewer","analyst"].includes(task.viewRole),true,`unknown review inbox role: ${task.viewRole}`);
  else {
    assert.equal(["ticket-create","ticket-process","ticket-approval","subprocess-create","subprocess-process","subprocess-approval","sms-approval","export-approval"].includes(task.tab),true,`unknown task tab: ${task.tab}`);
    assert.equal(["operator","handler","approver","reviewer","analyst"].includes(task.ownerRole),true,`unknown task owner role: ${task.ownerRole}`);
  }
  assert.equal(["已办结","已废止"].includes(task.status),false,`final task must not enter home workbench: ${task.id}`);
  assert.equal(allowedStatuses.has(task.status),true,`unknown home task status: ${task.status}`);
  assert.equal(targetKinds.has(task.target.kind),true,`unknown task target kind: ${task.target.kind}`);
  if(!["sms-approval","export-approval"].includes(task.tab)) {
    assert.equal(typeof task.businessType,"string",`missing structured business type: ${task.id}`);
    assert.ok(task.businessType.trim(),`empty structured business type: ${task.id}`);
  }
});

const expectedMessageTypes=["待办提醒","消息通知","审批结果","正常催办","加急催办","特急催办"];
assert.deepEqual([...new Set(notifications.notifications.map(item=>item.category))].sort(),expectedMessageTypes.sort());
notifications.notifications.forEach(item=>{ assert.equal(/[【】]/.test(item.title),false,`notification title placeholder was not resolved: ${item.id}`); assert.equal(/[【】]/.test(item.content),false,`notification content placeholder was not resolved: ${item.id}`); });
assert.equal("announcements" in notifications,false,"announcement data must not be exposed when the module is removed");
const taskLabels=Object.fromEntries(data.tasks.map(item=>[item.id,`${item.businessType}${item.status}`]));
assert.equal(taskLabels["task-ticket-create-01"],"表扬单待提交");
assert.equal(taskLabels["task-subprocess-create-01"],"投诉校正待提交");
assert.equal(taskLabels["task-ticket-approval-01"],"表扬单待审批");
assert.equal(data.tasks.find(item=>item.id==="task-sms-approval-01").status,"待审批");
assert.equal(data.tasks.find(item=>item.id==="task-export-approval-01").exportType,"工单");

assert.equal(registry.hasRoute("home-tasks"),true);
assert.doesNotMatch(developerHtml,/集中处理当前身份待办，查看业务通知与最近处理记录/);
assert.match(developerHtml,/工作总览/);
assert.match(developerHtml,/已超时/);
assert.match(developerHtml,/已办结/);
assert.doesNotMatch(developerHtml,/今日数据|今日已完成/);
assert.doesNotMatch(developerHtml,/class="home-domain-segment"|data-home-domain/);
assert.match(developerHtml,/个人信息/);
assert.match(developerHtml,/aria-label="陈敏慧头像">陈<\/span>/);
assert.match(developerHtml,/本月按时操作的工单占比/);
assert.match(developerHtml,/class="home-profile-summary"><strong>陈敏慧<\/strong><span>开发测试<\/span>/);
assert.doesNotMatch(developerHtml,/<dt>姓名<\/dt>|<dt>角色<\/dt>/);
assert.match(developerHtml,/<dt>工号<\/dt><dd>60157<\/dd>/);
assert.match(developerHtml,/<dt>机构<\/dt><dd>总行<\/dd>/);
assert.match(developerHtml,/<dt>部门<\/dt><dd>总行消费者权益保护部<\/dd>/);
assert.doesNotMatch(developerHtml,/当前机构|所属部门|统计口径/);
assert.match(developerHtml,/data-progress-kind="ticket" data-progress-total="9" data-progress-completed="3" data-progress-active="3" data-progress-overdue="3"/);
assert.match(developerHtml,/data-progress-kind="subprocess" data-progress-total="6" data-progress-completed="2" data-progress-active="3" data-progress-overdue="1"/);
assert.match(operatorHtml,/data-progress-kind="ticket" data-progress-total="3"/);
assert.match(handlerHtml,/data-progress-kind="ticket" data-progress-total="5"/);
assert.match(developerHtml,/根据角色切换数据显示范围/);
assert.match(operatorHtml,/个人数据统计/);
assert.match(approverHtml,/机构数据统计/);
assert.doesNotMatch(developerHtml,/全量演示数据|本人经手数据|总行工单池/);
assert.equal(data.tasks.filter(item=>item.domain==="review").length,10);
assert.deepEqual(JSON.parse(JSON.stringify(data.taskCounts("developer"))),{ complaint:40,review:10,total:50 });
assert.deepEqual(JSON.parse(JSON.stringify(data.taskCounts("operator"))),{ complaint:10,review:2,total:12 });
assert.deepEqual(JSON.parse(JSON.stringify(data.taskCounts("handler"))),{ complaint:10,review:2,total:12 });
assert.deepEqual(JSON.parse(JSON.stringify(data.taskCounts("approver"))),{ complaint:20,review:2,total:22 });
assert.equal(typeof sandbox.window.XIBHomeTaskInbox.setDomain,"function");
assert.equal(data.monthlyWorkItems.filter(item=>item.status==="草稿").length,3);
assert.match(developerHtml,/我的待办/);
assert.match(developerHtml,/通知中心/);
assert.doesNotMatch(developerHtml,/最近处理/);
assert.doesNotMatch(developerHtml,/常用功能/);
assert.match(developerHtml,new RegExp("<th>工单编号</th><th>工单类型</th><th>工单状态</th><th>处置期限</th>"));
assert.match(developerHtml,/表扬单/);
assert.match(developerHtml,/data-home-task-tab="ticket-create"/);
assert.match(developerHtml,/data-home-task-tab="export-approval"/);
assert.equal((developerHtml.match(/data-home-task-tab=/g)||[]).length,8);
assert.match(developerHtml,/class="pagination ds-pagination home-task-footer" data-page-size="5"/);
assert.doesNotMatch(developerHtml,/data-home-task-page="2"/);
assert.doesNotMatch(developerHtml,/pagination-size/);
assert.match(developerHtml,/class="pagination ds-pagination home-message-footer" data-page-size="6"/);
assert.match(developerHtml,/home-message-footer[\s\S]*共 15 项/);
assert.equal((developerHtml.match(/data-home-message-page=/g)||[]).length,3);
assert.equal((developerHtml.match(/data-home-message=/g)||[]).length,6);
assert.doesNotMatch(developerHtml,/公告|data-home-notice-tab|home-message-tabs/);
assert.doesNotMatch(developerHtml,/陈敏慧-60157/);
assert.doesNotMatch(developerHtml,/开发测试视图/);
assert.match(operatorHtml,/共 5 项/);
assert.match(operatorHtml,/home-deadline[^>]*>30天0小时0分钟</);
assert.doesNotMatch(operatorHtml,/home-deadline[^>]*>待提交</);
assert.match(handlerHtml,/共 5 项/);
assert.match(approverHtml,/共 5 项/);
const reviewerHtml=registry.render("home-tasks",{ ...baseContext,taskInboxRole:"reviewer",currentViewLabel:()=>"复核员视图" });
const analystHtml=registry.render("home-tasks",{ ...baseContext,taskInboxRole:"analyst",currentViewLabel:()=>"业务员视图" });
assert.match(reviewerHtml,/共 5 项/);
assert.match(analystHtml,/共 5 项/);
["is-todo","is-notice","is-approval","is-normal-reminder","is-urgent-reminder","is-critical-reminder"].forEach(className=>assert.match(developerHtml,new RegExp(`class="${className}"`)));

assert.equal(registry.handleAction("home-open-task",{ id:"task-ticket-create-01" },{ ...baseContext,taskInboxRole:"operator",page:"home-tasks" }),true);
assert.equal(JSON.stringify(opened.at(-1)),JSON.stringify({ kind:"ticket",id:"BY202607300011",mode:"create" }));
assert.equal(registry.handleAction("home-open-task",{ id:"review-task-07" },{ ...baseContext,taskInboxRole:"approver",page:"home-tasks" }),true);
assert.equal(JSON.stringify(opened.at(-1)),JSON.stringify({ route:"review-manage" }));
assert.equal(registry.handleAction("unknown",{},{ ...baseContext,page:"home-tasks" }),false);
console.log("Home task inbox module checks passed.");
