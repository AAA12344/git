"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml" };
const examples = ["TS202610190105", "TS202610190114", "XF202610190101", "XF202610190102"];
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end("Not found");
  response.writeHead(200, { "Content-Type":mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless:true, executablePath:findBrowserExecutable() });
  try {
    for (const id of examples) {
      const page = await browser.newPage({ viewport:{ width:1600, height:1000 } });
      await page.addInitScript(() => {
        localStorage.setItem("xib-role", "approver");
        localStorage.setItem("xib-org", "development");
        localStorage.setItem("xib-role-profile", "development-approver");
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/?testRoute=my-approvals#my-approvals`, { waitUntil:"domcontentloaded" });
      await page.locator('[data-approval-scope="机构工单池"]').click();
      await page.locator('[data-pagination-size]').selectOption("50");
      const row = page.locator(".approval-table tbody tr", { hasText:id });
      assert.equal(await row.count(), 1, `${id} 未进入机构审批工单池`);
      await row.getByRole("button", { name:"审批" }).click();
      await page.locator('[data-detail-tab="处理信息"]').click();
      await page.waitForSelector("#section-intelligent-inspection");
      assert.match(await page.locator("#section-intelligent-inspection").innerText(), /录入|沟通|产品/);
      if (id === "TS202610190114") {
        const communication = page.locator('[data-inspection-dimension="communications"]');
        assert.equal(await communication.getByText("外呼联系记录：").count(), 2, "多笔外呼联系记录未逐笔展示");
        assert.equal(await communication.getByText("录音编号：").count(), 2, "外呼录音编号未逐笔展示");
        const chains = page.locator('[data-inspection-dimension="productBusiness"] .approval-inspection-product-chain');
        assert((await chains.count()) >= 1, "产品业务核查缺少一级二级分组");
        assert((await chains.locator('[data-product-tag-level="一级"]').count()) === (await chains.count()), "每组应有一个一级标签");
        assert((await chains.locator('[data-product-tag-level="二级"]').count()) === (await chains.count()), "每组应有一个对应的二级标签");
        // 三个模块在同一页展示结果及其他状态，失败项可单独重新生成。
        const inspection = page.locator("#section-intelligent-inspection");
        assert.equal(await inspection.locator("[data-inspection-view]").count(), 0);
        assert.equal(await inspection.locator(".approval-inspection-empty").count(), 1);
        assert.match(await inspection.locator('[data-inspection-dimension="entry"]').innerText(), /暂无智能核查结果/);
        assert.equal(await inspection.locator('[data-inspection-dimension="communications"] [data-inspection-state="generating"]').count(), 1);
        assert.equal(await inspection.locator('[data-inspection-dimension="productBusiness"] [data-inspection-state="failed"]').count(), 1);
        await inspection.locator('[data-inspection-dimension="productBusiness"] [data-inspection-retry]').click();
        assert.equal(await inspection.locator('[data-inspection-dimension="productBusiness"] [data-inspection-state="generating"]').count(), 1);
      }
      assert.equal(await page.locator('[data-action="submit-approval"]').isVisible(), true, `${id} 缺少提交审批按钮`);
      await page.close();
    }
    console.log("待审批、审批中投诉单和信访单的核查结果及审批按钮均可见。 ");
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
