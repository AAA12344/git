"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

assert.match(source, /initialStatus = ticketRequiresReview[^\n]+\? "待复核" : "待处理"/u, "新建主单未按规则进入待处理机构工单池");
assert.match(source, /if \(initialStatus === "待处理"\) state\.processScope = "机构工单池"/u, "待处理主单提交后未切换到机构工单池");
assert.match(source, /selectedAssignee = receiver !== "-" \? normalizedAssigneeName\(receiver\) : ""/u, "子单直接派发未使用页面选择的处置员");
assert.match(source, /assignee: processingAssignee/u, "处理中子单未写入派发人元数据");

console.log("新建主单、子单与工单池/我的工作台联动规则检查通过");
