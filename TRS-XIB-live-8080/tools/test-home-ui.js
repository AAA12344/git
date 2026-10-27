"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

(async () => {
  const browser=await chromium.launch({ executablePath:findBrowserExecutable()||undefined,headless:true });
  const page=await browser.newPage({ viewport:{ width:1440,height:900 },timezoneId:"Asia/Shanghai" });
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{ if(message.type()==="error") errors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.setItem("xib-role","developer");
    localStorage.setItem("xib-org","development");
    localStorage.setItem("xib-role-profile","development-developer");
  });
  try {
    // Keep deadline fixtures stable as the real calendar advances.
    await page.clock.setFixedTime(new Date("2026-10-16T20:00:00+08:00"));
    const url=pathToFileURL(path.resolve(__dirname,"..","index.html")).href+"#home-tasks";
    await page.goto(url,{ waitUntil:"load" });
    await page.waitForSelector('[data-module="home"]');
    assert.equal(await page.locator('[data-group="home"].is-direct>[data-page="overview"]').count(),1);
    assert.equal(await page.locator('[data-group="home"] .nav-children').count(),0);
    assert.equal(await page.locator('[data-group="complaint"] .nav-level-two>[data-page="home-tasks"]').first().textContent().then(value=>value.trim()),"待办消息");
    assert.equal(await page.locator('#top-notification-trigger').getAttribute('title'),"通知中心");
    assert.equal((await page.locator('#top-notification-trigger .notification-count').textContent()).trim(),"50");
    await page.locator('#top-notification-trigger').click();
    assert.equal(await page.locator('#notification-popover').isVisible(),true);
    assert.match(await page.locator('#notification-popover').textContent(),/通知中心[\s\S]*待办共 50 项[\s\S]*投诉管理[\s\S]*40 项投诉管理待办消息[\s\S]*消保审查[\s\S]*10 项消保审查待办消息/);
    assert.equal(await page.locator('#notification-popover .notification-popover-foot').count(),0);
    assert.equal(await page.locator('#notification-popover [data-notification-page="notice-complaint"]').count(),1);
    assert.equal(await page.locator('#notification-popover [data-notification-page="notice-review"]').count(),1);
    await page.locator('#top-notification-trigger').click();
    assert.deepEqual(await page.locator('.home-task-table th:visible').allTextContents(),["工单编号","工单类型","工单状态","处置期限"]);
    const taskColumnRatios=await page.locator('.home-task-table').evaluate(table=>{
      const tableWidth=table.getBoundingClientRect().width;
      return [...table.querySelectorAll('thead th')].map(cell=>cell.getBoundingClientRect().width/tableWidth).filter(Boolean);
    });
    assert.ok(taskColumnRatios.every(ratio=>ratio>=.19&&ratio<=.31),`待办列宽分配不均衡: ${taskColumnRatios.join(",")}`);
    assert.equal(await page.locator('[data-home-task-tab]').count(),8);
    assert.equal(await page.locator('.home-task-table tbody tr').count(),5);
    assert.equal(await page.locator('.home-task-footer[data-page-size="5"]').count(),1);
    assert.equal(await page.locator('.home-task-footer .pagination-size').count(),0);
    assert.equal(await page.locator('.home-message-tabs,[data-home-notice-tab]').count(),0);
    assert.doesNotMatch(await page.locator('.home-messages').textContent(),/公告/);
    assert.equal(await page.locator('.home-message-footer[data-page-size="6"]').count(),1);
    assert.equal(await page.locator('.home-message-footer .page-btn').count(),3);
    assert.equal((await page.locator('.home-message-footer .page-btn.is-active').textContent()).trim(),"1");
    assert.match(await page.locator('.home-message-footer').textContent(),/共 15 项/);
    assert.equal(await page.locator('.home-message-footer .pagination-current').count(),0);
    assert.deepEqual(await page.locator('.home-task-table tbody tr td:nth-child(3)').allTextContents(),["待提交","待提交","待提交","待提交","待提交"]);
    assert.equal(await page.locator('.home-today').count(),0);
    assert.doesNotMatch(await page.locator('.home-overview').textContent(),/今日数据/);

    const alignment=await page.evaluate(() => {
      const box=selector=>{ const rect=document.querySelector(selector).getBoundingClientRect(); return { top:rect.top,width:rect.width,height:rect.height }; };
      return { overview:box('.home-overview'),profile:box('.home-profile'),todo:box('.home-todo'),messages:box('.home-messages') };
    });
    assert.ok(Math.abs(alignment.overview.top-alignment.profile.top)<1,"overview row is not aligned");
    assert.ok(Math.abs(alignment.overview.height-alignment.profile.height)<1,"overview row heights differ");
    assert.ok(Math.abs(alignment.todo.top-alignment.messages.top)<1,"task row is not aligned");
    assert.ok(Math.abs(alignment.todo.height-alignment.messages.height)<1,"task row heights differ");
    assert.equal(await page.locator('.home-recent').count(),0);
    assert.equal(await page.locator('.home-shortcuts').count(),0);
    assert.equal(await page.locator('.home-user-summary span').count(),0);
    const titleSpacing=await page.evaluate(()=>document.querySelector('.home-overview').getBoundingClientRect().top-document.querySelector('.home-page-head .page-title').getBoundingClientRect().bottom);
    assert.ok(titleSpacing>=13&&titleSpacing<=15,'home title spacing differs from standard pages');
    assert.ok(alignment.todo.width>alignment.messages.width*2.5,"9/3 grid ratio is not preserved");
    assert.ok(alignment.overview.width>alignment.profile.width*2.5,"overview 9/3 grid ratio is not preserved");
    assert.equal(await page.locator('.home-progress-ring').count(),2);
    assert.equal(await page.locator('.home-efficiency-ring').count(),1);
    const ringVisual=await page.locator('.home-progress-ring').first().evaluate(node=>({ segmentCount:node.querySelectorAll('path.home-ring-segment').length,cornerRadii:[...node.querySelectorAll('path.home-ring-segment')].map(segment=>segment.dataset.cornerRadius),quadraticCorners:[...node.querySelectorAll('path.home-ring-segment')].every(segment=>(segment.getAttribute("d").match(/ Q /g)||[]).length===4),vectorEffects:[...node.querySelectorAll('path.home-ring-segment')].map(segment=>getComputedStyle(segment).vectorEffect),activeStops:[...node.querySelectorAll('[data-ring-tone="active"] stop')].map(stop=>stop.getAttribute("stop-color")) }));
    assert.equal(ringVisual.segmentCount,3);
    assert.deepEqual(ringVisual.cornerRadii,["4","4","4"]);
    assert.equal(ringVisual.quadraticCorners,true);
    assert.ok(ringVisual.vectorEffects.every(value=>value==="none"));
    assert.deepEqual(ringVisual.activeStops,["var(--progress-active-light)","var(--progress-active-dark)"]);
    const ringScaleRatio=await page.locator('.home-progress-ring').first().evaluate(node=>{
      const ratio=()=>{ const ring=node.getBoundingClientRect(); const segment=node.querySelector('path.home-ring-segment').getBoundingClientRect(); return { width:segment.width/ring.width,height:segment.height/ring.height }; };
      const before=ratio();
      document.body.style.zoom="200%";
      const after=ratio();
      document.body.style.zoom="";
      return { before,after };
    });
    assert.ok(Math.abs(ringScaleRatio.before.width-ringScaleRatio.after.width)<.01);
    assert.ok(Math.abs(ringScaleRatio.before.height-ringScaleRatio.after.height)<.01);
    assert.equal(await page.locator('.home-domain-segment,[data-home-domain]').count(),0);
    assert.match(await page.locator('.home-overview').textContent(),/已超时[\s\S]*已办结/);
    assert.doesNotMatch(await page.locator('.home-overview').textContent(),/今日数据|今日已完成/);
    assert.match(await page.locator('.home-overview-subhead').first().textContent(),/本月数据[\s\S]*根据角色切换数据显示范围/);
    assert.match(await page.locator('.home-profile').textContent(),/个人信息[\s\S]*陈敏慧[\s\S]*开发测试[\s\S]*工号[\s\S]*60157[\s\S]*机构[\s\S]*总行[\s\S]*部门[\s\S]*总行消费者权益保护部/);
    assert.doesNotMatch(await page.locator('.home-profile').textContent(),/姓名|角色/);
    assert.equal(await page.locator('.home-profile-avatar[aria-label="默认头像"] img[src="ui/assets/user-solid.svg"]').count(),1);
    const profileAlignment=await page.evaluate(()=>{
      const pairs=[...document.querySelectorAll('.home-profile-details>div')];
      const labelLefts=pairs.map(pair=>pair.querySelector('dt').getBoundingClientRect().left);
      const valueLefts=pairs.map(pair=>pair.querySelector('dd').getBoundingClientRect().left);
      const summary=document.querySelector('.home-profile-summary');
      const name=summary.querySelector('strong');
      const role=summary.querySelector('span');
      const bodyStyle=getComputedStyle(document.querySelector('.home-profile-body'));
      const pageStyle=getComputedStyle(document.querySelector('.xib-module-home-tasks'));
      return { labelSpread:Math.max(...labelLefts)-Math.min(...labelLefts),valueSpread:Math.max(...valueLefts)-Math.min(...valueLefts),summaryLeft:summary.getBoundingClientRect().left,valueLeft:valueLefts[0],nameSize:getComputedStyle(name).fontSize,nameWeight:getComputedStyle(name).fontWeight,roleSize:getComputedStyle(role).fontSize,roleColor:getComputedStyle(role).color,primaryColor:getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),bodyPadding:[bodyStyle.paddingTop,bodyStyle.paddingRight,bodyStyle.paddingBottom,bodyStyle.paddingLeft],pagePadding:[pageStyle.paddingTop,pageStyle.paddingRight,pageStyle.paddingBottom,pageStyle.paddingLeft] };
    });
    assert.ok(profileAlignment.labelSpread<1);
    assert.ok(profileAlignment.valueSpread<1);
    assert.ok(Math.abs(profileAlignment.summaryLeft-profileAlignment.valueLeft)<1);
    assert.equal(profileAlignment.nameSize,"16px");
    assert.ok(Number(profileAlignment.nameWeight)>=600);
    assert.equal(profileAlignment.roleSize,"12px");
    assert.equal(profileAlignment.roleColor,"rgb(34, 114, 222)");
    assert.deepEqual(profileAlignment.bodyPadding,["18px","18px","18px","18px"]);
    assert.deepEqual(profileAlignment.pagePadding,["18px","24px","32px","24px"]);
    assert.equal(await page.locator('.home-progress-ring [data-ring-tone="completed"]').count(),0);
    assert.equal(await page.locator('.home-progress-ring .home-ring-segment.is-completed').first().getAttribute("fill"),"var(--progress-completed)");

    const messages=await page.locator('.home-message').evaluateAll(nodes=>nodes.map(node=>({ height:node.getBoundingClientRect().height,tag:node.querySelector('em')?.textContent,color:getComputedStyle(node.querySelector('em')).color,background:getComputedStyle(node.querySelector('em')).backgroundColor })));
    assert.equal(messages.length,6);
    assert.ok(messages.every(item=>Math.abs(item.height-45)<1),"collapsed message rows are not uniformly compact");
    const taskRowHeights=await page.locator('.home-task-row').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
    assert.ok(taskRowHeights.every(height=>Math.abs(height-45)<1),"task and message rows do not share the same compact height");
    assert.equal(new Set(messages.map(item=>item.tag)).size,6);
    assert.equal(new Set(messages.map(item=>`${item.color}/${item.background}`)).size,6);
    const firstMessageId=await page.locator('.home-message').first().getAttribute('data-home-message');
    await page.locator('.home-message-footer [aria-label="下一页"]').click();
    assert.equal(await page.locator('.home-message').count(),6);
    assert.equal(await page.locator('.home-message-footer .page-btn').count(),3);
    assert.equal((await page.locator('.home-message-footer .page-btn.is-active').textContent()).trim(),"2");
    assert.notEqual(await page.locator('.home-message').first().getAttribute('data-home-message'),firstMessageId);
    await page.locator('.home-message-footer [aria-label="上一页"]').click();
    assert.equal((await page.locator('.home-message-footer .page-btn.is-active').textContent()).trim(),"1");
    assert.equal(await page.locator('.home-message').first().getAttribute('data-home-message'),firstMessageId);
    await page.locator('[data-home-task-tab="sms-approval"]').click();
    assert.deepEqual(await page.locator('.home-task-table th:visible').allTextContents(),["短信编号","关联工单编号","短信审批状态","处置期限"]);
    assert.equal(await page.locator('.home-task-row').count(),5);
    await page.locator('[data-home-task-tab="export-approval"]').click();
    assert.deepEqual(await page.locator('.home-task-table th:visible').allTextContents(),["导出申请编号","导出类型","导出申请状态","处置期限"]);
    assert.equal(await page.locator('.home-task-row').count(),5);
    await page.locator('[data-home-task-tab="ticket-create"]').click();
    await page.locator('[data-home-task-tab="subprocess-create"]').click();
    assert.deepEqual(await page.locator('.home-task-table th:visible').allTextContents(),["子单编号","子单类型","子单状态","处置期限"]);
    await page.locator('[data-home-task-tab="ticket-create"]').click();
    await page.locator('.home-task-table [data-home-task]').first().click();
    await page.waitForFunction(()=>["#ticket-detail","#subprocess-detail","#supervision-letter-detail","#my-approvals"].includes(location.hash));

    await page.goto(url,{ waitUntil:"load" });
    await page.waitForSelector('[data-module="home"]');
    await page.locator('.home-message').first().click();
    await page.waitForFunction(()=>location.hash==="#notice-complaint");

    await page.goto(url,{ waitUntil:"load" });
    await page.waitForSelector('[data-module="home"]');

    async function switchView(profileId,expectedTabs) {
      const trigger = page.locator('#role-cascade-trigger');
      await trigger.waitFor({ state:"visible" });
      await trigger.evaluate(node => node.click());
      const option = page.locator(`[data-role-profile="${profileId}"]:visible`);
      await option.waitFor({ state:"visible" });
      await option.evaluate(node => node.click());
      await page.waitForFunction(({ id, count }) => localStorage.getItem("xib-role-profile") === id && document.querySelectorAll('[data-module="home"] [data-home-task-tab]').length === count, { id:profileId, count:expectedTabs });
    }
    await switchView("development-operator",2);
    assert.deepEqual(await page.locator('[data-home-task-tab]').allTextContents(),["工单创建","子单创建"]);
    assert.match((await page.locator('.home-deadline').first().textContent()).trim(),/^\d+天\d+小时\d+分钟$/);
    await switchView("development-handler",2);
    assert.deepEqual(await page.locator('[data-home-task-tab]').allTextContents(),["工单处理","子单处理"]);
    await switchView("development-approver",4);
    assert.deepEqual(await page.locator('[data-home-task-tab]').allTextContents(),["工单审批","子单审批","短信审批","导出申请审批"]);
    await switchView("development-reviewer",4);
    await switchView("development-analyst",4);
    await switchView("development-developer",8);

    await page.locator('.home-task-table [data-home-task]').first().click();
    await page.waitForFunction(()=>location.hash==="#ticket-detail");
    await page.locator('[data-page="home-tasks"]').click();
    await page.waitForSelector('[data-module="home"]');
    await page.locator('.home-panel-link[data-page="notice-complaint"]').click();
    await page.waitForFunction(()=>location.hash==="#notice-complaint");
    await page.goto(url,{ waitUntil:"load" });
    await page.waitForSelector('[data-module="home"]');
    const openTopNotification = async (route, heading) => {
      const trigger = page.locator('#top-notification-trigger');
      await trigger.waitFor({ state:"visible" });
      await trigger.evaluate(node => node.click());
      await page.waitForFunction(() => document.querySelector('#top-notification-trigger')?.getAttribute('aria-expanded') === 'true' && !document.querySelector('#notification-popover')?.hidden);
      const destination = page.locator(`#notification-popover [data-notification-page="${route}"]:visible`);
      await destination.waitFor({ state:"visible" });
      await destination.evaluate(node => node.click());
      try {
        await page.waitForFunction(({ hash, title }) => location.hash === `#${hash}` && document.querySelector('[data-module="notifications"] h1')?.textContent === title, { hash:route, title:heading });
      } catch (error) {
        console.error("Navigation state:", await page.evaluate(() => ({ hash:location.hash, heading:document.querySelector('main h1')?.textContent || "", modules:[...document.querySelectorAll('[data-module]')].map(node => node.dataset.module), errors:[...document.querySelectorAll('.error,.app-error')].map(node => node.textContent) })));
        throw error;
      }
    };
    await openTopNotification("notice-complaint", "投诉管理通知");
    await page.locator('[data-page="home-tasks"]').click();
    await page.waitForSelector('[data-module="home"]');
    await openTopNotification("notice-review", "消保审查通知");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false);
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
  console.log("Home task inbox browser checks passed.");
})().catch(error=>{ console.error(error); process.exitCode=1; });
