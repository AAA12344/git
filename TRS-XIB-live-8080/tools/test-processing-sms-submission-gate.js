const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const browserExecutable = findBrowserExecutable();
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png" };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end("Not found");
  response.writeHead(200, { "Content-Type":mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

function assert(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch(browserExecutable ? { headless:true, executablePath:browserExecutable } : { headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:960 } });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:"domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil:"domcontentloaded" });
    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='branch-unit']");
    await page.click("[data-role-profile='branch-handler']");
    await page.locator("[data-page='ticket-process']").click();
    await page.waitForSelector(".ticket-list-table");
    await page.locator(".ticket-list-table tr", { hasText:"TS202607230012" }).locator("[data-action='process']").click();
    await page.waitForSelector("[data-detail-tab='处理信息']");
    await page.click("[data-detail-tab='处理信息']");
    await page.waitForSelector("#processing-form-main");
    await page.locator("[data-action='send-sms']").first().click();
    await page.waitForSelector(".contact-sms-layout");
    await page.locator("#modal-confirm").click();
    await page.waitForFunction(() => document.querySelector("#overlay-root .modal-head")?.textContent.includes("确认短信审批申请"));
    await page.locator("#modal-confirm").click();
    await page.waitForSelector(".contact-result-modal");
    await page.locator("[data-close-overlay]", { hasText:"完成" }).click();
    await page.locator("[data-action='submit-processing']").click();
    await page.waitForFunction(() => document.querySelector("#overlay-root .modal-body")?.textContent.includes("存在待审批的短信"));
    const notice = await page.locator("#overlay-root .modal-body").innerText();
    assert(notice.includes("存在待审批的短信") && notice.includes("需审批结束后可提交处理结果"), "待审批短信未阻断提交处理结果");

    const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
    assert(source.includes("records.slice(latestRejectedIndex + 1).some(isEffectiveFollowUpContact)"), "驳回短信后的新增联系记录校验缺失");
    assert(source.includes("isSmsContact(record) || contactStatusForRecord(record) !== \"已联系\""), "有效联系记录未排除短信或未联系记录");
    console.log("Processing SMS submission gate checks passed");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
