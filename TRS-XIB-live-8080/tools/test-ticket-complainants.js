const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml" };
  response.writeHead(200, { "Content-Type":(mime[path.extname(file)] || "application/octet-stream") + "; charset=utf-8" });
  fs.createReadStream(file).pipe(response);
});

server.listen(0, "127.0.0.1", async () => {
  const browser = await chromium.launch({ executablePath:findBrowserExecutable(), headless:true });
  const page = await browser.newPage({ viewport:{ width:1680, height:1050 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const port = server.address().port;
    await page.goto("http://127.0.0.1:" + port + "/?testRoute=ticket-form#ticket-form");
    assert.equal(await page.locator("#work-order-type").isDisabled(), false, "选择前工单类型应可用");
    await page.selectOption("#work-order-type", "投诉单");
    await page.waitForFunction(() => document.querySelector("#work-order-type")?.disabled === true);
    assert.equal(await page.locator("#work-order-type").isDisabled(), true, "选择后工单类型应置灰且不可更改");
    assert.equal(await page.locator("#work-order-type").inputValue(), "投诉单", "锁定后应保留已选工单类型");

    const customerNoField = page.locator('.form-item[data-field-name="客户编号"]');
    const customerNoInput = page.locator('input[data-field-key="customer.1.客户编号"]');
    assert.equal(await page.locator('.form-item[data-field-name="是否有客户编号"] .form-label.required').count(), 1, "是否有客户编号应为必填项");
    assert.equal(await customerNoInput.isDisabled(), true, "未选择是否有客户编号时客户编号应置灰");
    assert.equal(await customerNoField.locator(".form-label.required").count(), 0, "未选择是否有客户编号时客户编号不应必填");
    const hasCustomerNumber = page.locator('.form-item[data-field-name="是否有客户编号"] [data-app-select]');
    await hasCustomerNumber.locator(".di-select-trigger").click();
    await hasCustomerNumber.locator('[data-select-value="是"]').click();
    await page.waitForFunction(() => !document.querySelector('input[data-field-key="customer.1.客户编号"]')?.disabled);
    assert.equal(await customerNoField.locator(".form-label.required").count(), 1, "选择有客户编号后客户编号应必填");
    assert.equal(await page.locator('input[data-field-key="事件次数"]').inputValue(), "0", "投诉次数默认值应为 0");

    for (const name of ["客户类型", "客户性别", "是否境内"]) {
      assert.equal(await page.locator(`.form-item[data-field-name="${name}"] [data-app-select]`).count(), 1, `${name}应使用下拉框`);
      assert.equal(await page.locator(`.form-item[data-field-name="${name}"] [data-app-radio]`).count(), 0, `${name}不应继续使用点选按钮`);
    }
    const residence = page.locator('.form-item[data-field-name="居住地 省/市/区"] [data-app-cascader]');
    assert.equal(await residence.locator(".di-cascader-trigger").isDisabled(), false, "客户查询前居住地省市区应允许编辑");
    await customerNoInput.fill("C202607000001");
    await customerNoField.locator('[data-action="customer-search"]').click();
    await page.locator("#modal-confirm").click();
    await page.waitForFunction(() => document.querySelector('[data-field-key="customer.1.客户姓名"]')?.value === "陈晓敏");
    assert.equal(await page.locator('.form-item[data-field-name="居住地 省/市/区"] .di-cascader-trigger').isDisabled(), false, "客户查询回填后居住地省市区仍应允许编辑");

    const count = page.locator('[data-field-key="投诉人数"]');
    assert.equal(await count.inputValue(), "1", "投诉人数应从 1 开始");
    assert.equal(await count.isEditable(), false, "投诉人数不应允许手工减少或改写");
    assert.equal(await page.locator("[data-customer-delete]").count(), 0, "客户信息 1 不应显示删除按钮");

    await page.locator("[data-customer-add]").click();
    await page.waitForFunction(() => document.querySelector('[data-field-key="投诉人数"]')?.value === "2");
    await page.locator("[data-customer-add]").click();
    await page.waitForFunction(() => document.querySelector('[data-field-key="投诉人数"]')?.value === "3");
    assert.equal(await count.inputValue(), "3", "点击加号应逐次增加投诉人数");
    assert.deepEqual(await page.locator(".customer-card strong").allInnerTexts(), ["客户信息 1", "客户信息 2", "客户信息 3"]);
    assert.equal(await page.locator(".customer-card small", { hasText:"待填写" }).count(), 0, "客户信息卡片不应显示待填写提示");
    assert.equal(await page.locator("[data-customer-delete]").count(), 2, "仅第二位及之后的投诉人应可删除");

    await page.locator('[data-field-key="customer.2.客户姓名"]').fill("待删除客户");
    await page.locator('[data-field-key="customer.3.客户姓名"]').fill("保留客户");
    await page.locator('[data-customer-delete="2"]').click();
    assert.equal(await page.locator("#customer-delete-title").innerText(), "提示");
    assert.equal(await page.locator(".customer-delete-modal .modal-body").innerText(), "确定要删除该投诉人吗?");
    await page.locator(".customer-delete-modal [data-close-overlay]", { hasText:"取消" }).click();
    assert.equal(await count.inputValue(), "3", "取消删除不应改变投诉人数");

    await page.locator('[data-customer-delete="2"]').click();
    await page.locator("#customer-delete-confirm").click();
    await page.waitForFunction(() => document.querySelector('[data-field-key="投诉人数"]')?.value === "2");
    assert.equal(await count.inputValue(), "2", "确认删除应同步减少投诉人数");
    assert.deepEqual(await page.locator(".customer-card strong").allInnerTexts(), ["客户信息 1", "客户信息 2"], "删除后客户序号应连续");
    assert.equal(await page.locator('[data-field-key="customer.2.客户姓名"]').inputValue(), "保留客户", "后续客户数据应随序号前移");
    assert.equal(errors.length, 0, "页面不应出现脚本错误: " + errors.join(" | "));
    console.log("Ticket complainant regression passed.");
  } finally {
    await browser.close();
    server.close();
  }
});
