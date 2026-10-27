"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

(async () => {
  const browserPath = findBrowserExecutable();
  const browser = await chromium.launch({
    executablePath: browserPath || undefined,
    headless: true
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    const indexUrl = pathToFileURL(path.resolve(__dirname, "..", "index.html")).href + "#overview";
    await page.goto(indexUrl, { waitUntil: "load" });
    await page.waitForSelector("#role-cascade-trigger");
    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='development']");
    await page.click("[data-role-profile='development-developer']");
    await page.waitForSelector("[data-page='admin-jobs']", { state: "attached" });
    await page.evaluate(() => document.querySelector("[data-page='admin-jobs']").click());
    await page.waitForFunction(() => (
      document.querySelector("[data-module='admin-operations']") &&
      document.querySelectorAll("[data-module='admin-operations'] tbody tr").length === 6
    ));
    await page.evaluate(() => document.querySelector("[data-page='admin-config-complaint']").click());
    await page.waitForSelector("[data-module='admin-config']");
    assert.match(await page.locator("[data-module='admin-config']").innerText(), /投诉管理参数/);
    await page.evaluate(() => document.querySelector("[data-page='admin-config-review']").click());
    await page.waitForFunction(() => document.querySelector("[data-module='admin-config']")?.innerText.includes("暂无配置内容"));
    await page.evaluate(() => document.querySelector("[data-page='admin-config-complaint']").click());
    await page.waitForFunction(() => (
      document.querySelectorAll("[data-module='admin-config'] tbody tr").length === 9
    ));
    const alertListText = await page.locator("[data-module='admin-config'] table").innerText();
    assert.match(alertListText, /预警类型/);
    assert.match(alertListText, /机构范围/);
    assert.match(alertListText, /启用状态/);
    assert.match(alertListText, /工单全量预警/);
    assert.match(alertListText, /监管转办工单量预警/);
    assert.match(alertListText, /自收渠道工单量预警/);
    assert.equal(await page.locator("[data-module='admin-config'] [data-action='admin-alert-scope']").count(), 2);
    assert.equal(await page.locator("[data-module='admin-config'] [data-action='admin-alert-create']").count(), 0);
    await page.locator("[data-module='admin-config'] [data-action='admin-alert-detail']").first().click();
    await page.waitForFunction(() => (
      document.querySelector("[data-module='admin-config'] h1")?.textContent.includes("工单全量预警") &&
      document.querySelector("[data-module='admin-config']")?.innerText.includes("预警规则") &&
      document.querySelector("[data-module='admin-config']")?.innerText.includes("时间范围") &&
      document.querySelector("[data-module='admin-config']")?.innerText.includes("环比阈值")
    ));
    assert.equal(await page.locator("[data-module='admin-config'] [data-admin-alert-rule-field]").count(), 2);
    assert.equal(await page.locator("[data-module='admin-config'] .admin-alert-readonly-scope").count(), 0);
    assert.equal(await page.locator("[data-module='admin-config'] [data-app-hierarchy-cascader][data-dictionary='organizationTree']").count(), 0);
    await page.locator("[data-module='admin-config'] [data-action='admin-alert-list']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-config'] tbody tr").length === 9);
    assert.equal(await page.locator("[data-module='admin-config'] [data-action='admin-config-tab']").count(), 0);
    assert.equal(await page.locator("[data-page='admin-form-review']").count(), 0);
    assert.equal(await page.locator("[data-page='admin-form-dictionary']").count(), 1);
    assert.equal(await page.locator("[data-page='admin-form-sms']").count(), 1);
    await page.evaluate(() => document.querySelector("[data-page='admin-form-dictionary']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-form-config'] .admin-dictionary-type").length === 10);
    assert.match(await page.locator("[data-module='admin-form-config']").innerText(), /字典项 — 投诉单 · 受理渠道/);
    await page.evaluate(() => document.querySelector("[data-page='admin-form-sms']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-form-config'] .admin-list-card:first-of-type tbody tr").length === 3);
    await page.evaluate(() => document.querySelector("[data-page='analysis-warnings']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaint-monitoring'] tbody tr").length === 8);
    assert.equal(await page.locator("[data-module='complaint-monitoring'] [data-monitoring-sort-index]").count(), 0);
    await page.evaluate(() => document.querySelector("[data-page='analysis-inspections']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaint-inspections'] .inspection-ticket-table tbody tr").length === 4);
    assert.equal(await page.locator("[data-module='complaint-inspections'] [data-inspections-sort-index]").count(), 0);
    await page.evaluate(() => document.querySelector("[data-page='rectification-create']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaint-rectification'] .rectification-table tbody tr").length >= 1);
    await page.evaluate(() => document.querySelector("[data-rectification-tab='all']")?.click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaint-rectification'] .rectification-table tbody tr").length === 12);
    await page.locator("[data-module='complaint-rectification'] [data-action='new-rectification']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='complaint-rectification'][data-rectification-view='form'] #rectification-form-main"));
    assert.match(await page.locator("[data-module='complaint-rectification'] h1").textContent(), /新建溯源整改单/);
    await page.locator("[data-module='complaint-rectification'] [data-action='navigate-back']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaint-rectification'] .rectification-table tbody tr").length === 12);
    await page.evaluate(() => document.querySelector("[data-module='complaint-rectification'] [data-rectification-tab='todo']")?.click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaint-rectification'] .rectification-table tbody tr").length === 2);
    assert.match(await page.locator("[data-module='complaint-rectification'] .rectification-table").innerText(), /ZG202608100005/);
    await page.evaluate(() => document.querySelector("[data-page='admin-org']").click());
    await page.waitForFunction(() => document.querySelector("[data-module='admin-organizations'] .admin-org-tree-toolbar")?.textContent.includes("1221"));
    await page.locator("#admin-org-filter-name").fill("厦门分行");
    await page.locator("[data-action='admin-org-search']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-organizations'] .admin-org-tree-toolbar")?.textContent.includes("共 1 个机构"));
    await page.locator("[data-module='admin-organizations'] [data-action='admin-select-org'][data-id='000100012003']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-organizations'] .admin-detail-section .panel-title")?.textContent === "厦门分行");
    await page.locator("[data-module='admin-organizations'] [data-action='admin-org-reset']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-organizations'] .admin-org-tree-toolbar")?.textContent.includes("1221"));
    await page.evaluate(() => document.querySelector("[data-page='admin-user']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-users'] tbody tr").length === (window.XIB_ADMIN_USERS_DATA?.users?.length || 0));
    await page.locator("[data-module='admin-users'] [data-action='admin-user-detail']").first().click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-users'] h1")?.textContent.includes("用户详情"));
    await page.evaluate(() => document.querySelector("[data-page='admin-permission']").click());
    await page.locator("[data-module='admin-permissions'] [data-action='admin-perm-tab'][data-id='biz']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-permissions'] tbody tr").length === 10);
    const permissionTableText = await page.locator("[data-module='admin-permissions'] table").innerText();
    assert.match(permissionTableText, /角色/);
    assert.match(permissionTableText, /更新时间/);
    assert.match(permissionTableText, /状态/);
    assert.match(permissionTableText, /操作/);
    assert.match(permissionTableText, /经办员（客服中心）/);
    assert.match(permissionTableText, /处理员（总行消保）/);
    assert.match(permissionTableText, /处理员（分行消保）/);
    assert(!permissionTableText.includes("角色说明"), "权限配置列表仍展示角色说明列");
    assert(!permissionTableText.includes("角色编码"), "权限配置列表仍展示角色编码列");
    assert(!permissionTableText.includes("关联用户数"), "权限配置列表仍展示关联用户数列");
    assert(!permissionTableText.includes("数据范围"), "权限配置列表仍展示数据范围列");
    assert(!permissionTableText.includes("导出范围"), "权限配置列表仍展示导出范围列");
    assert.doesNotMatch(permissionTableText, /菜单权限/);
    const hasHorizontalScroll = await page.locator("[data-module='admin-permissions'] .admin-permission-list-wrap").evaluate(node => node.scrollWidth > node.clientWidth + 1);
    assert.equal(hasHorizontalScroll, false, "权限配置列表仍出现横向拖拽轴");
    await page.locator("[data-module='admin-permissions'] [data-action='admin-permission-page'][data-id='3']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-permissions'] table")?.innerText.includes("查询员（总行）"));
    const queryPageText = await page.locator("[data-module='admin-permissions'] table").innerText();
    assert.match(queryPageText, /查询员（总行）/);
    assert.match(queryPageText, /查询员（分行）/);
    assert.match(queryPageText, /编辑权限/);
    assert.equal(await page.locator("[data-module='admin-permissions'] [data-action='admin-role-toggle']").count(), 2, "查询员角色缺少状态开关");
    assert.equal(await page.locator("[data-module='admin-permissions'] [data-action='admin-role-delete']").count(), 0, "系统内置查询员角色不应提供删除入口");
    await page.evaluate(() => document.querySelector("[data-page='admin-user']").click());
    await page.waitForSelector("[data-module='admin-users']");
    if (await page.locator("[data-module='admin-users'] [data-action='admin-user-list']").count()) {
      await page.locator("[data-module='admin-users'] [data-action='admin-user-list']").click();
    }
    await page.waitForFunction(() => document.querySelector("[data-module='admin-users'] [data-action='admin-users-tab'][data-id='config']"));
    await page.locator("[data-module='admin-users'] [data-action='admin-users-tab'][data-id='config']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-users'] .admin-permission-user-filter .ticket-filter-item").length === 2);
    const userConfigText = await page.locator("[data-module='admin-users']").innerText();
    assert.match(userConfigText, /机构范围/);
    assert.match(userConfigText, /用户列表/);
    assert.match(userConfigText, /用户角色配置/);
    assert.match(userConfigText, /姓名/);
    assert.match(userConfigText, /机构/);
    assert.match(userConfigText, /部门/);
    const configuredUserCount = Number(userConfigText.match(/(\d+) 名用户/)?.[1] || 0);
    assert(configuredUserCount >= 13, `用户配置列表应保留原有人员并包含新增业务员，当前 ${configuredUserCount} 名`);
    assert.equal(await page.locator("[data-module='admin-users'] .admin-role-config-head").count(), 0);
    assert.equal(await page.locator("[data-module='admin-users'] [data-admin-user-role-panel] [data-admin-save-user-config]").count(), 1);
    assert.equal(await page.locator("[data-module='admin-users'] [data-admin-select-user]").count(), 10);
    assert.equal(await page.locator("[data-module='admin-users'] .pagination.ds-pagination.admin-user-pagination").count(), 1);
    assert.equal(await page.locator("[data-module='admin-users'] .admin-user-pagination .page-btn.is-active").innerText(), "1");
    await page.locator("[data-module='admin-users'] .admin-user-pagination .page-btn:not(.pagination-arrow)[data-action='admin-user-page'][data-id='2']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-users'] .admin-user-pagination .page-btn.is-active")?.dataset.id === "2");
    await page.waitForFunction(expected => document.querySelectorAll("[data-module='admin-users'] [data-admin-select-user]").length === expected, Math.min(10, configuredUserCount - 10));
    await page.locator("[data-module='admin-users'] .admin-user-pagination .page-btn:not(.pagination-arrow)[data-action='admin-user-page'][data-id='1']").click();
    await page.waitForFunction(() => document.querySelector("[data-module='admin-users'] .admin-user-pagination .page-btn.is-active")?.dataset.id === "1");
    await page.waitForFunction(() => document.querySelectorAll("[data-module='admin-users'] [data-admin-select-user]").length === 10);
    await page.evaluate(() => { document.querySelector("[data-module='admin-users']").dataset.noRefreshProbe = "keep"; });
    const secondUserName = await page.evaluate(() => {
      const user = document.querySelectorAll("[data-module='admin-users'] [data-admin-select-user]")[1];
      const name = user?.querySelector("strong")?.textContent?.replace(/（.*$/, "").trim();
      user?.click();
      return name;
    });
    await page.waitForFunction(name => document.querySelector("[data-admin-user-role-panel] .admin-selected-user-info dd")?.textContent?.trim() === name, secondUserName);
    assert.equal(await page.locator("[data-module='admin-users']").evaluate(node => node.dataset.noRefreshProbe), "keep");
    const selectedUserRoleText = await page.locator("[data-module='admin-users'] [data-admin-user-role-panel]").innerText();
    assert.match(selectedUserRoleText, /分行/);
    assert.doesNotMatch(selectedUserRoleText, /总行业务部门|总行消保部|支行/);
    const complaintRoleSelect = page.locator("[data-module='admin-users'] [data-admin-role-multiselect]").first();
    await complaintRoleSelect.locator(".admin-role-multiselect-trigger").evaluate(trigger => trigger.click());
    await page.waitForFunction(() => {
      const popover = document.querySelector("[data-module='admin-users'] [data-admin-role-multiselect] .admin-role-multiselect-popover");
      return popover && !popover.hidden;
    });
    await page.waitForTimeout(100);
    const roleCheckbox = complaintRoleSelect.locator("[data-admin-user-complaint-role]").first();
    if (await roleCheckbox.count()) {
      await page.evaluate(() => { document.querySelector("[data-module='admin-users']").dataset.noRefreshProbe = "keep"; });
      await roleCheckbox.evaluate(node => node.click());
      assert.equal(await page.locator("[data-module='admin-users']").evaluate(node => node.dataset.noRefreshProbe), "keep");
    }
    await page.locator("[data-module='admin-users'] [data-admin-search-users]").click();
    await page.waitForFunction(expected => document.querySelector("[data-module='admin-users']")?.innerText.includes(expected + " 名用户"), configuredUserCount);
    assert.equal(await page.locator("[data-module='admin-users'] [data-admin-select-user]").count(), 10);
    await page.waitForSelector("[data-module='admin-users'] [data-app-hierarchy-cascader][data-dictionary='userOrganizationTree']");
    assert.match(await page.locator("[data-module='admin-users'] .di-hierarchy-cascader-trigger").innerText(), /请选择机构范围|全行|总行/);
    await page.evaluate(() => document.querySelector("[data-page='analysis-reports']").click());
    await page.waitForFunction(() => document.querySelectorAll("[data-module='complaints-reports'] [data-action='complaints-report-open']").length === 25);
    assert.equal(await page.locator("[data-report-group='行内报表'] [data-action='complaints-report-type']").count(), 3);
    assert.equal(await page.locator("[data-report-group='行内报表'] .report-type").count(), 0);
    await page.locator("[data-module='complaints-reports'] [data-action='complaints-report-open']").first().click();
    await page.waitForSelector("[data-module='complaints-reports'][data-report-view='detail']");
    assert.equal(await page.locator("[data-module='complaints-reports'] [data-report-row]").count(), 12);
    assert.equal(await page.locator("#overlay-root .modal").count(), 0);
    assert.equal(await page.locator("[data-action='complaints-report-export']").count(), 1);
    assert.equal(await page.locator("[aria-label='配置列表显示字段']").count(), 0);
    assert.equal(errors.length, 0, errors.join(" | "));
    console.log("Direct file:// open check passed.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
