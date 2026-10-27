"use strict";

const assert=require("node:assert/strict");
const path=require("node:path");
const { pathToFileURL }=require("node:url");
const { chromium }=require("playwright");
const { findBrowserExecutable }=require("./browser-path");

(async()=>{
  const browser=await chromium.launch({ executablePath:findBrowserExecutable()||undefined,headless:true });
  const page=await browser.newPage({ viewport:{ width:1440,height:900 } });
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{ if(message.type()==="error") errors.push(`${message.text()} ${message.location().url || ""}`.trim()); });
  await page.addInitScript(()=>{
    localStorage.setItem("xib-role","developer");
    localStorage.setItem("xib-org","development");
    localStorage.setItem("xib-role-profile","development-developer");
  });
  try {
    const url=pathToFileURL(path.resolve(__dirname,"..","index.html")).href+"#notice-complaint";
    await page.goto(url,{ waitUntil:"load" });
    await page.waitForSelector('[data-module="notifications"]');
    assert.equal(await page.locator('[data-module="notifications"] h1').textContent(),"投诉管理通知");
    assert.equal(await page.locator('[data-module="notifications"] [data-notification-domain]').count(),0);
    assert.equal(await page.locator('[data-group="notice"] [data-page="notice-complaint"]').count(),1);
    assert.equal(await page.locator('[data-group="notice"] [data-page="notice-review"]').count(),1);
    assert.match(await page.locator('.notification-list-head').textContent(),/投诉管理通知/);
    assert.equal(await page.locator('.notification-row').count(),8);

    await page.locator('[data-group="notice"] [data-page="notice-review"]').click();
    await page.waitForFunction(()=>location.hash==="#notice-review");
    await page.waitForFunction(()=>document.querySelector('[data-module="notifications"] h1')?.textContent==="消保审查通知");
    assert.equal(await page.locator('[data-module="notifications"] h1').textContent(),"消保审查通知");
    assert.match(await page.locator('.notification-list-head').textContent(),/消保审查通知/);
    assert.equal(await page.locator('.notification-row').count(),5);
    await page.locator('.notification-row').first().click();
    assert.deepEqual(await page.locator('.notification-detail dt').allInnerTexts(),["消息栏目","消息类型","接收方式","来源模块","相关业务编号"],"消保审查通知详情字段意外变化");
    await page.locator('[data-notification-back]').click();

    await page.locator('[data-group="notice"] [data-page="notice-complaint"]').click();
    await page.waitForFunction(()=>location.hash==="#notice-complaint");
    await page.waitForFunction(()=>document.querySelector('[data-module="notifications"] h1')?.textContent==="投诉管理通知");
    assert.equal(await page.locator('[data-notification-category]').count(),7);
    assert.equal(await page.locator('.notification-row').count(),8);
    await page.locator('[data-notification-search]').fill('__NO_NOTIFICATION__');
    await page.locator('[data-notification-search-submit]').click();
    await page.waitForSelector('.notification-empty');
    const emptyImage=await page.locator('.notification-empty>div').evaluate(node=>getComputedStyle(node).backgroundImage);
    assert.ok(emptyImage.includes('缺省-暂无通知.svg') || emptyImage.includes('%E7%BC%BA%E7%9C%81-%E6%9A%82%E6%97%A0%E9%80%9A%E7%9F%A5.svg'),emptyImage);
    await page.locator('[data-notification-search]').fill('');
    await page.locator('[data-notification-search-submit]').click();
    assert.equal(await page.locator('.notification-row').count(),8);
    const copyFilter=page.locator('[data-notification-copy]');
    await copyFilter.click();
    assert.equal(await page.locator('.notification-row').count(),1);
    assert.match(await page.locator('.notification-row').innerText(),/督导函抄送通知/);
    assert.equal(await page.locator('[data-notification-copy]').getAttribute("aria-pressed"),"true");
    await page.locator('[data-notification-copy]').click();
    assert.equal(await page.locator('.notification-row').count(),8);

    await page.locator('[data-notification-read="未读"]').click();
    assert.equal(await page.locator('.notification-row').count(),8);
    await page.locator('[data-notification-read="全部"]').click();
    await page.locator('[data-notification-category="待办提醒"]').click();
    await page.locator('[data-notification-search]').fill('ZG202607310104');
    await page.locator('[data-notification-search-submit]').click();
    assert.equal(await page.locator('.notification-row').count(),1);
    await page.locator('.notification-row').click();
    await page.waitForSelector('.notification-detail');
    assert.match(await page.locator('.notification-detail-content').textContent(),/ZG202607310104/);
    const complaintDetailLabels=await page.locator('.notification-detail dt').allInnerTexts();
    assert.deepEqual(complaintDetailLabels,["消息类型","来源模块","相关业务编号"],"投诉管理通知详情仍显示消息栏目或接收方式");
    await page.locator('[data-notification-back]').click();
    await page.waitForSelector('.notification-list');
    assert.equal(await page.locator('[data-notification-category="待办提醒"]').getAttribute('class').then(value=>value.includes('is-active')),true);
    assert.equal(await page.locator('[data-notification-search]').inputValue(),'ZG202607310104');
    assert.equal(await page.locator('.notification-row').count(),1);
    await page.locator('.notification-row').click();
    await page.locator('[data-notification-target]').click();
    await page.waitForFunction(()=>location.hash==="#rectification-detail");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false);
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
  console.log("Notification center browser checks passed.");
})().catch(error=>{ console.error(error); process.exitCode=1; });
