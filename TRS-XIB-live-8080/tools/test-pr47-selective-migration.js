"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("app.js", "utf8");

function extract(name, nextName) {
  const start = source.indexOf("  function " + name + "(");
  const end = source.indexOf("  function " + nextName + "(", start);
  assert(start >= 0 && end > start, name + " function not found");
  return source.slice(start, end);
}

const context = {
  currentUserActor: () => "陈敏慧-60157",
  normalizedAssigneeName: value => String(value || "").trim(),
  ticketLastHandler: row => row?.handler || "-"
};
vm.createContext(context);
vm.runInContext(extract("contactOperationColumnVisible", "processingContactTable"), context);

assert.equal(context.contactOperationColumnVisible({ handler:"陈敏慧-60157" }, false, true), true, "当前处理员应看到联系记录操作列");
assert.equal(context.contactOperationColumnVisible({ handler:"林海-38102" }, false, true), true, "可编辑处理页面应保留联系记录操作列");
assert.equal(context.contactOperationColumnVisible({ handler:"陈敏慧-60157" }, true, true), false, "查看或审批只读场景不得看到联系记录操作列");
assert.equal(context.contactOperationColumnVisible({ handler:"陈敏慧-60157" }, true, false), false, "其他只读联系记录也不得看到操作列");
assert.equal(context.contactOperationColumnVisible({ handler:"陈敏慧-60157" }, false, false), false, "关联单据等非处理表面默认不得看到操作列");

vm.runInContext(extract("validateAttachmentSelection", "renderField"), context);
assert.equal(context.validateAttachmentSelection([{ name:"a.pdf", size:1024 }]).ok, true);
assert.match(context.validateAttachmentSelection(Array.from({ length:31 }, (_, index) => ({ name:index + ".pdf", size:1 }))).message, /最多上传30个文件/);
assert.match(context.validateAttachmentSelection([{ name:"oversize.pdf", size:100 * 1024 * 1024 + 1 }]).message, /单个文件不能超过100M/);

assert.match(source, /最多支持上传30个文件，单个文件最大100M/);
assert.match(source, /data-upload-input hidden multiple/);
assert.doesNotMatch(source, /'批量转派'/, "批量转派入口必须移除，单笔转派继续保留");
assert.match(source, /actionDef\('transfer', '转派', 'transfer'\)/, "单笔工单转派必须保留");
assert.match(source, /<div><span>工单类型<\/span><strong>\$\{escapeAttribute\(type \|\| "-"\)\}<\/strong><\/div>/, "工单处理页顶部必须保留工单类型");

console.log("PR #47 selective migration rules passed.");
