"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const sandbox={ window:{} };
vm.createContext(sandbox);
for (const relativePath of ["src/core/module-registry.js","src/modules/notifications/data.js","src/modules/notifications/index.js"]) {
  const filename=path.join(root,relativePath);
  vm.runInContext(fs.readFileSync(filename,"utf8"),sandbox,{ filename });
}

const registry=sandbox.window.XIBModuleRegistry;
const data=sandbox.window.XIBNotificationCenterData;
const context={
  role:"developer",
  taskInboxRole:"developer",
  pageMeta:{
    "notice-complaint":{ title:"投诉管理通知",group:"通知中心" },
    "notice-review":{ title:"消保审查通知",group:"通知中心" }
  },
  pageHeader:(title,description)=>`<header><h1>${title}</h1><p>${description}</p></header>`,
  navigate:()=>{},
  openWorkflowItem:()=>{}
};
const complaintHtml=registry.render("notice-complaint",context);
const reviewHtml=registry.render("notice-review",context);
const expectedCategories=["特急催办","加急催办","正常催办","审批结果","待办提醒","消息通知"];
const notificationEmptySvg=fs.readFileSync(path.join(root,"ui/assets/缺省-暂无通知.svg"),"utf8");
const workOrderEmptySvg=fs.readFileSync(path.join(root,"ui/assets/缺省-空空如也.svg"),"utf8");
const canvasBackground=/<rect[^>]+fill="#FFFFFF"[^>]+x="0"[^>]+y="0"[^>]+width="132"[^>]+height="114"/;
assert.doesNotMatch(notificationEmptySvg,canvasBackground,"notification empty SVG must have a transparent canvas");
assert.doesNotMatch(workOrderEmptySvg,canvasBackground,"work-order empty SVG must have a transparent canvas");

assert.equal(registry.hasRoute("notice-complaint"),true);
assert.equal(registry.hasRoute("notice-review"),true);
assert.equal(registry.hasRoute("notice-center"),false);
assert.match(complaintHtml,/<h1>投诉管理通知<\/h1>/);
assert.match(reviewHtml,/<h1>消保审查通知<\/h1>/);
assert.doesNotMatch(complaintHtml,/data-notification-domain=/);
assert.doesNotMatch(reviewHtml,/data-notification-domain=/);
assert.match(complaintHtml,/data-notification-route="notice-complaint"/);
assert.match(reviewHtml,/data-notification-route="notice-review"/);
assert.match(complaintHtml,/data-notification-read="全部"/);
assert.match(complaintHtml,/data-notification-read="未读"/);
assert.match(complaintHtml,/data-notification-read="已读"/);
assert.match(complaintHtml,/data-notification-copy/);
assert.match(complaintHtml,/aria-pressed="false"/);
assert.match(complaintHtml,/placeholder="搜索消息内容、业务编号"/);
assert.equal((complaintHtml.match(/data-notification-category=/g)||[]).length,7);
expectedCategories.forEach(category=>assert.match(complaintHtml,new RegExp(`data-notification-category="${category}"`)));
assert.equal((complaintHtml.match(/data-notification-open=/g)||[]).length,Math.min(8,data.notifications.filter(item=>item.domain==="complaint").length));
assert.equal((reviewHtml.match(/data-notification-open=/g)||[]).length,Math.min(8,data.notifications.filter(item=>item.domain==="review").length));
assert.equal(data.notifications.some(item=>!item.read),true);
assert.equal(data.notifications.some(item=>item.read),true);
assert.equal(data.notifications.some(item=>item.deliveryType==="抄送"),true);
assert.equal(data.notifications.find(item=>item.id==="notice-08")?.deliveryType,"抄送");
assert.equal("announcements" in data,false,"announcement data must not be exposed");
data.notifications.forEach(item=>{
  assert.equal(expectedCategories.includes(item.category),true,`unknown notification category: ${item.category}`);
  assert.equal(/[【】]/.test(item.title),false,`unresolved notification title placeholder: ${item.id}`);
  assert.equal(/[【】]/.test(item.content),false,`unresolved notification content placeholder: ${item.id}`);
  assert.equal(item.category,item.reminderType,`notification type alias mismatch: ${item.id}`);
  assert.equal(["complaint","review"].includes(item.domain),true,`unknown notification domain: ${item.id}`);
  assert.equal(["主送","抄送"].includes(item.deliveryType),true,`unknown delivery type: ${item.id}`);
  assert.ok(item.target?.route || item.target?.kind,`missing target: ${item.id}`);
});
console.log("Notification center module checks passed.");
