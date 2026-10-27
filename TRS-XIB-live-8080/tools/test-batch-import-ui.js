"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

const root = path.resolve(__dirname, "..");
const browserExecutable = findBrowserExecutable();
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

const importHeaders = ["客户编号", "客户类型", "卡号/账号", "证件号码", "预留手机号码", "受理渠道", "具体来源", "投诉时间", "转送时间", "接收时间", "是否发送短信", "转送函号", "联系人姓名", "联系人证件号码", "联系方式1", "联系方式2", "投诉机构", "投诉对象", "投诉事项", "所属业务条线", "投诉内容"];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  Object.entries(entries).forEach(([name, value]) => {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(value);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function columnName(index) {
  let value = index + 1;
  let output = "";
  while (value) { value -= 1; output = String.fromCharCode(65 + (value % 26)) + output; value = Math.floor(value / 26); }
  return output;
}

function xlsxFixture(headers, rows = []) {
  const xmlEscape = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rowXml = [headers, ...rows].map((values, rowIndex) => `<row r="${rowIndex + 2}">${values.map((value, columnIndex) => value === "" || value == null ? "" : `<c r="${columnName(columnIndex)}${rowIndex + 2}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`).join("")}</row>`).join("");
  return storedZip({
    "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="导入" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`
  });
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end("Not found");
  response.writeHead(200, { "Content-Type":mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch(browserExecutable ? { headless:true, executablePath:browserExecutable } : { headless:true });
  const page = await browser.newPage({ viewport:{ width:1680, height:1050 }, acceptDownloads:true });
  const errors = [];
  page.on("pageerror", error => errors.push("PAGEERROR: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("CONSOLE: " + message.text()); });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:"domcontentloaded" });
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("xib-role", "developer");
      localStorage.setItem("xib-org", "development");
      localStorage.setItem("xib-role-profile", "development-developer");
    });
    await page.reload({ waitUntil:"domcontentloaded" });

    await page.goto(`http://127.0.0.1:${server.address().port}/?testRoute=ticket-process#ticket-process`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector("[data-process-ticket-type]");
    assert.equal(await page.locator("[data-process-ticket-type] option").first().innerText(), "全部", "工单处理类型筛选默认项不是“全部”");
    await page.goto(`http://127.0.0.1:${server.address().port}/?testRoute=ledger-query#ledger-query`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector("[data-query-ticket-type]");
    assert.equal(await page.locator("[data-query-ticket-type] option").first().innerText(), "全部", "工单查询类型筛选默认项不是“全部”");
    await page.locator('[data-query-tab="子流程单导出"]').click();
    await page.waitForSelector("[data-query-subprocess-type]");
    assert.equal(await page.locator("[data-query-subprocess-type] option").first().innerText(), "全部", "子流程查询类型筛选默认项不是“全部”");

    await page.goto(`http://127.0.0.1:${server.address().port}/?testRoute=ticket-create#ticket-create`, { waitUntil:"domcontentloaded" });
    await page.locator('[data-action="open-import"]').click();
    await page.waitForSelector(".import-drawer");
    assert.match(await page.locator(".import-drawer").innerText(), /文件大小不超过 30 MB/, "批量导入未展示 30 MB 限制");
    assert.equal(await page.locator(".import-stepper").count(), 0, "精简版不应继续展示四步流程说明");
    assert.equal(await page.locator(".import-rule-list").count(), 0, "精简版不应继续展示灰色规则列表");
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-download-template]").click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "批量导入模版.xlsx", "下载的批量导入模板文件名不正确");

    await page.locator('#upload-drop input[type="file"]').setInputFiles({ name:"伪造模板.xlsx", mimeType:mime[".xlsx"], buffer:Buffer.from("not-an-xlsx") });
    await page.locator("#parse-import").click();
    await page.waitForFunction(() => document.querySelector(".import-validation-status")?.textContent === "校验失败");
    assert.equal(await page.locator(".import-drawer .import-inline-progress").count(), 1, "校验结果未在批量导入抽屉内展示");
    assert.match(await page.locator("#import-result-panel").innerText(), /不是有效的 \.xlsx/, "仅修改扩展名的文件未被阻断");
    assert.equal(await page.locator("#import-progress-next").innerText(), "重新提交", "校验失败后未提供重新提交入口");
    await page.locator("#import-progress-next").click();
    await page.waitForSelector(".import-drawer #upload-drop");
    await page.locator('[data-close-overlay]').first().click();

    await page.goto(`http://127.0.0.1:${server.address().port}/?testRoute=ticket-create#ticket-create`, { waitUntil:"domcontentloaded" });
    await page.locator('[data-action="open-import"]').click();
    await page.locator('#upload-drop input[type="file"]').setInputFiles({ name:"超限模板.xlsx", mimeType:mime[".xlsx"], buffer:Buffer.alloc(30 * 1024 * 1024 + 1) });
    await page.locator("#parse-import").click();
    await page.waitForFunction(() => document.querySelector(".import-validation-status")?.textContent === "校验失败");
    assert.match(await page.locator("#import-result-panel").innerText(), /超过 30 MB/, "超过 30 MB 的文件未被阻断");
    await page.locator("#import-progress-cancel").click();

    await page.goto(`http://127.0.0.1:${server.address().port}/?testRoute=ticket-create#ticket-create`, { waitUntil:"domcontentloaded" });
    await page.locator('[data-action="open-import"]').click();
    const wrongHeaders = [...importHeaders];
    wrongHeaders[4] = "手机";
    await page.locator('#upload-drop input[type="file"]').setInputFiles({ name:"错误表头.xlsx", mimeType:mime[".xlsx"], buffer:xlsxFixture(wrongHeaders) });
    await page.locator("#parse-import").click();
    await page.waitForFunction(() => document.querySelector(".import-validation-status")?.textContent === "校验失败");
    assert.match(await page.locator("#import-result-panel").innerText(), /表头.*预留手机号码/, "必要列名错误时未阻断并指出字段");
    await page.locator("#import-progress-next").click();

    const duplicateHeaders = [...importHeaders];
    duplicateHeaders[5] = "客户类型";
    await page.locator('#upload-drop input[type="file"]').setInputFiles({ name:"重复表头.xlsx", mimeType:mime[".xlsx"], buffer:xlsxFixture(duplicateHeaders) });
    await page.locator("#parse-import").click();
    await page.waitForFunction(() => document.querySelector(".import-validation-status")?.textContent === "校验失败");
    assert.match(await page.locator("#import-result-panel").innerText(), /重复列.*客户类型/, "重复列未阻断并指出重复字段");
    await page.locator("#import-progress-next").click();

    const invalidPhoneRow = ["CUST-IMPORT-001", "自然人", "62220001", "350100199001011234", "abc138", "营业网点", "", "2026-10-01", "", "2026-10-02 09:00", "否", "", "测试客户", "", "13800138000", "", "厦门分行", "张经理", "贷款业务办理", "零售金融部", "测试批量导入字段校验"];
    await page.locator('#upload-drop input[type="file"]').setInputFiles({ name:"字段错误.xlsx", mimeType:mime[".xlsx"], buffer:xlsxFixture(importHeaders, [invalidPhoneRow]) });
    await page.locator("#parse-import").click();
    await page.waitForFunction(() => document.querySelector(".import-validation-status")?.textContent === "校验完成");
    assert.match(await page.locator("#import-result-panel").innerText(), /1\s*条待补充/, "字段错误不应阻断整批且应计入待补充数量");
    assert.match(await page.locator("#import-result-panel").innerText(), /手机号格式不正确/, "字段错误未在解析结果中定位提示");
    await page.locator("#import-progress-next").click();
    await page.waitForSelector('[data-create-tab="录入导入草稿箱"].is-active');
    const importedDraft = page.locator(".ticket-list-table tbody tr", { hasText:"测试客户" }).first();
    assert.equal(await importedDraft.count(), 1, "字段错误行未生成可编辑草稿");
    await importedDraft.locator('[data-action="edit"]').click();
    await page.waitForSelector('#ticket-form-main .form-item[data-field-name="预留手机号码"]');
    const phoneField = page.locator('#ticket-form-main .form-item[data-field-name="预留手机号码"]');
    assert.equal(await phoneField.locator("input").inputValue(), "", "格式错误的手机原值仍被带入草稿");
    assert.match(await phoneField.innerText(), /手机号格式不正确/, "字段错误未显示在对应字段下方");

    await page.goto(`http://127.0.0.1:${server.address().port}/?testRoute=ticket-create#ticket-create`, { waitUntil:"domcontentloaded" });
    await page.locator('[data-action="open-import"]').click();

    await page.locator('#upload-drop input[type="file"]').setInputFiles(path.join(root, "批量导入模版.xlsx"));
    await page.waitForTimeout(700);
    assert.equal(await page.locator(".import-drawer").count(), 1, "上传文件后仍自动进入解析流程");
    assert.equal(await page.locator("#parse-import").isEnabled(), true, "上传成功后“校验并上传”按钮未启用");
    assert.equal(await page.locator("#parse-import").innerText(), "校验并上传", "上传成功后的操作文案不正确");
    await page.locator("#parse-import").click();
    await page.waitForFunction(() => document.querySelector(".import-validation-status")?.textContent === "校验完成");
    assert.equal(await page.locator(".import-drawer .import-inline-progress").count(), 1, "精简版解析结果未保留在导入抽屉内");
    assert.match(await page.locator("#import-result-panel").innerText(), /成功解析\s*1\s*条/, "模板中的有效业务行统计不正确");
    assert.equal(await page.locator(".import-live-stats").count(), 0, "精简版不应显示旧版四宫格统计");
    await page.locator("#import-progress-next").click();
    await page.waitForSelector('[data-create-tab="录入导入草稿箱"].is-active');
    assert.equal(errors.length, 0, errors.join(" | "));
    console.log(JSON.stringify({ ok:true, checks:["全局类型筛选默认全部", "精简版导入抽屉", "下载新版批量导入模板", "伪 XLSX 阻断与重新提交", "30 MB 文件限制", "错误及重复表头阻断", "字段错误不阻断且原值清空", "导入草稿字段下红字提示", "上传后手动校验", "内嵌解析结果", "生成后进入导入草稿箱"] }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
