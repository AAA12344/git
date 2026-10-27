# 智能核查督导函统一管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将督导函完整迁入智能核查模块，落实指定处理人、抄送审批员、一单一函和“草稿 → 处理中 → 已办结”流程，并从子单系统移除全部督导函入口与遗留行为。

**Architecture:** `src/modules/complaints/inspections/` 是督导函唯一运行时边界，负责数据规范化、角色权限、草稿、发送、处理、迁移和页面渲染。结构化数据源只保留智能核查督导函样例；子单字段、状态机、权限、池列表和 `app.js` 兼容路由全部移除。发送前读取主单最新智能核查结果，发送时冻结快照，详情页复用 `renderInspectionFindings()`。

**Tech Stack:** 原生 JavaScript、HTML/CSS、JSON 数据源、Node.js `assert`/`vm` 测试、Playwright UI 回归、localStorage、静态 `file://` 部署。

**Spec:** `docs/superpowers/specs/2026-10-26-intelligent-inspection-supervision-letter-design.md`

## Global Constraints

- 不直接在 `main` 开发；执行前从最新 `origin/main` 创建独立功能分支。
- 保持 `index.html` 的 `file://` 打开方式和现有角色、路由、主单智能核查展示可用。
- 督导函状态只能是 `草稿`、`处理中`、`已办结`。
- 督导函发送时绑定一名指定处理人，不进入机构池，不支持领取或转派。
- 抄送审批员只读查看，不新增审批节点。
- 同一 `ticketId` 在全部状态下最多对应一笔督导函。
- “督导要求”发送前可编辑，发送后只读。
- 修改结构化数据源后必须运行 `npm run build:data` 并提交 `data/form-schema.json`、`data/prototype-data.runtime.js` 的生成差异。
- 不修改其他子流程的业务行为，不向 `app.js` 增加新的督导函职责。

---

## 文件责任映射

| 文件 | 责任 |
| --- | --- |
| `src/modules/complaints/inspections/data.js` | 智能核查工单目录、核查结果和督导函初始数据入口 |
| `src/modules/complaints/inspections/index.js` | 督导函规范化、迁移、权限、状态动作、列表、详情和事件处理 |
| `src/modules/complaints/inspections/module.css` | 草稿编辑、角色只读状态和主单核查结果复用后的模块样式 |
| `data/seed-data.json` | 草稿、处理中、已办结督导函及对应工单演示数据 |
| `data/forms/subprocesses.json` | 移除督导函子单定义、字段和能力 |
| `data/workflow-schema.json` | 移除督导函子单状态机和审批配置 |
| `data/complaint-permission-rules.json` | 移除督导函子单权限，不在此处新增智能核查权限 |
| `data/subprocess-initiation-rules.json` | 移除主单发起督导函的子流程规则 |
| `app.js` | 删除督导函子单适配、工作台/审批池拼接、旧详情路由和领取事件；仅保留模块持久化桥接 |
| `tools/test-complaint-inspections-module.js` | 督导函状态、唯一性、迁移、权限和模块渲染单元回归 |
| `tools/test-intelligent-inspection-processing.js` | 保证主单智能核查触发及展示不回归 |
| `tools/test-linked-sample-ui.js` | 浏览器端发起、草稿、发送、处理、抄送查看和子单清理回归 |
| `tools/validate-subprocess-contract.js` | 验证督导函已不属于子单契约 |
| `docs/模块分工.md`、`src/modules/complaints/inspections/README.md` | 记录智能核查对督导函的唯一所有权和角色流程 |
| `data/form-schema.json`、`data/prototype-data.runtime.js` | 由生成命令更新的兼容产物，不手工编辑 |

---

### Task 1: 建立督导函领域模型、迁移和权限契约

**Files:**
- Modify: `tools/test-complaint-inspections-module.js`
- Modify: `src/modules/complaints/inspections/index.js:13-25, 205-235, 285-340, 560-580`

**Interfaces:**
- Produces: `normalizeSupervisionLetter(letter)` 返回规范后的督导函对象。
- Produces: `migrateSupervisionState(saved)` 返回 `{ supervisionLetters, migrated }`。
- Produces: `canViewSupervisionLetter(letter, actor)`、`canEditSupervisionDraft(letter, actor)`、`canProcessSupervisionLetter(letter, actor)`。
- Produces: `createSupervisionDraft(ticketId, actor, now)`、`saveSupervisionDraft(id, patch, actor, now)`、`sendSupervisionLetter(id, actor, inspectionSnapshot, now)`、`completeSupervisionLetter(id, feedback, actor, now)`，统一返回 `{ ok, reason, letter }`。

- [ ] **Step 1: 写入失败的领域契约测试**

在 `tools/test-complaint-inspections-module.js` 增加下列断言，先锁定状态、唯一性、人员权限和旧状态迁移：

```js
const actor = { id:"60157", name:"陈敏慧-60157", role:"inspector" };
const handler = { id:"27519", name:"王琳-27519", role:"handler" };
const approver = { id:"29816", name:"赵宁-29816", role:"approver" };

moduleApi.hydrateState({ supervisionLetters:[] });
const created = moduleApi.createSupervisionDraft("TS202607230012", actor, "2026-10-26 10:00:00");
assert.equal(created.ok, true);
assert.equal(created.letter.status, "草稿");
assert.equal(moduleApi.createSupervisionDraft("TS202607230012", actor, "2026-10-26 10:01:00").ok, false);

const saved = moduleApi.saveSupervisionDraft(created.letter.id, {
  supervisionRequirement:"请补充处理依据。",
  receiverId:handler.id,
  receiverName:handler.name,
  ccApproverIds:[approver.id],
  ccApproverNames:[approver.name]
}, actor, "2026-10-26 10:02:00");
assert.equal(saved.ok, true);
assert.equal(moduleApi.canViewSupervisionLetter(saved.letter, approver), false);

const sent = moduleApi.sendSupervisionLetter(saved.letter.id, actor, { entry:{ passed:false } }, "2026-10-26 10:03:00");
assert.equal(sent.letter.status, "处理中");
assert.equal(moduleApi.canViewSupervisionLetter(sent.letter, approver), true);
assert.equal(moduleApi.canProcessSupervisionLetter(sent.letter, handler), true);
assert.equal(moduleApi.canProcessSupervisionLetter(sent.letter, approver), false);
assert.equal(moduleApi.saveSupervisionDraft(sent.letter.id, { supervisionRequirement:"不可改" }, actor, "2026-10-26 10:04:00").ok, false);

const completed = moduleApi.completeSupervisionLetter(sent.letter.id, "已补充材料。", handler, "2026-10-26 10:05:00");
assert.equal(completed.letter.status, "已办结");
assert.deepEqual([...new Set(moduleApi.serializeState().supervisionLetters.map(item => item.status))], ["已办结"]);

moduleApi.hydrateState({ supervisionLetters:[{ id:"DH202608040001", ticketId:"XF202607270024", status:"待处理", receiver:"林海-38102", supplement:"旧要求" }] });
const migrated = moduleApi.serializeState().supervisionLetters[0];
assert.equal(migrated.status, "处理中");
assert.equal(migrated.supervisionRequirement, "旧要求");
assert.equal("supplement" in migrated, false);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:complaint-inspections`

Expected: FAIL，提示 `createSupervisionDraft` 或权限接口不存在。

- [ ] **Step 3: 实现最小领域模型**

在 `src/modules/complaints/inspections/index.js` 中集中实现并导出以下逻辑：

```js
const supervisionStatuses = new Set(["草稿", "处理中", "已办结"]);
const actorId = actor => {
  const raw = String(actor?.id || actor?.employeeId || actor?.name || "");
  return raw.match(/(\d+)$/)?.[1] || raw;
};
const listValue = value => Array.isArray(value) ? value : value ? String(value).split(/[、,]/).map(item => item.trim()).filter(Boolean) : [];
const normalizeStatus = status => status === "草稿" ? "草稿" : status === "已办结" || status === "已反馈" ? "已办结" : "处理中";

function normalizeSupervisionLetter(letter = {}) {
  return {
    ...letter,
    status:normalizeStatus(letter.status),
    senderId:actorId({ id:letter.senderId || letter.sender }),
    senderName:letter.senderName || letter.sender || "-",
    receiverId:actorId({ id:letter.receiverId || letter.receiver }),
    receiverName:letter.receiverName || letter.receiver || "-",
    ccApproverIds:listValue(letter.ccApproverIds || letter.ccApprovers || letter.cc).map(value => actorId({ id:value })),
    ccApproverNames:listValue(letter.ccApproverNames || letter.ccApprovers || letter.cc),
    supervisionRequirement:letter.supervisionRequirement || letter.supplement || "",
    inspectionResultSnapshot:letter.inspectionResultSnapshot || letter.findings || null
  };
}

function canViewSupervisionLetter(letter, actor) {
  const id = actorId(actor);
  if (letter.status === "草稿") return id === letter.senderId;
  return [letter.senderId, letter.receiverId, ...(letter.ccApproverIds || [])].includes(id);
}

function canEditSupervisionDraft(letter, actor) {
  return letter.status === "草稿" && actorId(actor) === letter.senderId;
}

function canProcessSupervisionLetter(letter, actor) {
  return letter.status === "处理中" && actorId(actor) === letter.receiverId;
}
```

动作函数必须同时检查当前状态、操作者、必填项和 `ticketId` 唯一性，并在成功时返回克隆后的记录，失败时不修改 `state.supervisionLetters`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:complaint-inspections`

Expected: PASS，并且现有智能核查渲染断言仍通过。

- [ ] **Step 5: 提交领域契约**

```bash
git add src/modules/complaints/inspections/index.js tools/test-complaint-inspections-module.js
git commit -m "refactor: centralize supervision letter lifecycle"
```

---

### Task 2: 补充三状态演示数据和发送快照

**Files:**
- Modify: `data/seed-data.json:13425-13550`
- Modify: `src/modules/complaints/inspections/data.js:180-205`
- Modify: `tools/test-complaint-inspections-module.js`
- Generated: `data/prototype-data.runtime.js`

**Interfaces:**
- Consumes: Task 1 的 `normalizeSupervisionLetter()` 和状态集合。
- Produces: `initialSupervisionLetters` 至少包含草稿、处理中、已办结各一条，并覆盖发起人、指定处理人、抄送审批员和核查结果快照。

- [ ] **Step 1: 写入失败的样例数据测试**

```js
const examples = seedData.runtimeDefaults.supervisionLetters;
assert.equal(examples.some(item => item.status === "草稿"), true);
assert.equal(examples.some(item => item.status === "处理中"), true);
assert.equal(examples.some(item => item.status === "已办结"), true);
assert.equal(examples.every(item => item.senderId && item.receiverId && item.supervisionRequirement), true);
assert.equal(examples.filter(item => item.status !== "草稿").every(item => item.inspectionResultSnapshot), true);
assert.equal(new Set(examples.map(item => item.ticketId)).size, examples.length, "督导函样例违反一单一函");
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:complaint-inspections`

Expected: FAIL，指出缺少草稿或新字段。

- [ ] **Step 3: 更新 `runtimeDefaults.supervisionLetters`**

每条记录使用统一字段名：

```json
{
  "id": "DH202610260001",
  "ticketId": "TS202607230012",
  "status": "处理中",
  "senderId": "60157",
  "senderName": "陈敏慧-60157",
  "receiverId": "27519",
  "receiverName": "王琳-27519",
  "ccApproverIds": ["29816"],
  "ccApproverNames": ["赵宁-29816"],
  "supervisionRequirement": "请补充处理依据和客户沟通材料。",
  "inspectionResultSnapshot": {
    "entry": { "passed": false, "nonCompliantItems": ["处理依据"], "conclusion": "处理依据缺少可核验材料。" },
    "communications": { "passed": true, "items": [] },
    "productBusiness": { "passed": true, "groups": [] }
  },
  "feedback": "",
  "createdAt": "2026-10-26 09:30:00",
  "sentAt": "2026-10-26 09:35:00",
  "updatedAt": "2026-10-26 09:35:00",
  "completedAt": ""
}
```

草稿不写 `sentAt` 和快照；已办结记录补充非空 `feedback`、`completedAt`。

- [ ] **Step 4: 生成运行时数据并复测**

Run: `npm run build:data`

Expected: 更新 `data/prototype-data.runtime.js`，`npm run test:complaint-inspections` PASS。

- [ ] **Step 5: 提交演示数据**

```bash
git add data/seed-data.json data/prototype-data.runtime.js src/modules/complaints/inspections/data.js tools/test-complaint-inspections-module.js
git commit -m "test: add supervision letter lifecycle examples"
```

---

### Task 3: 实现草稿、发送、角色列表和处理页面

**Files:**
- Modify: `src/modules/complaints/inspections/index.js:239-570`
- Modify: `src/modules/complaints/inspections/module.css`
- Modify: `tools/test-complaint-inspections-module.js`

**Interfaces:**
- Consumes: Task 1 的动作和权限函数；Task 2 的三状态数据。
- Produces: `openLetterDraft(ticketId, context)`、按角色过滤的 `visibleSupervisionLetters(context)`，以及草稿编辑、只读详情和指定处理人反馈页面。

- [ ] **Step 1: 写入失败的模块渲染测试**

为发起人、处理人、审批员分别提供 `context.getCurrentActor()`，断言：

```js
assert.match(inspectorList, /草稿/);
assert.match(inspectorList, /data-action="inspections-letter-edit"/);
assert.doesNotMatch(inspectorList, /领取督导函|待处理/);

assert.match(handlerList, /data-action="inspections-letter-process"/);
assert.doesNotMatch(handlerList, /data-action="inspections-letter-edit"/);

assert.match(approverList, /查看/);
assert.doesNotMatch(approverList, /编辑|处理|提交督导反馈/);

assert.match(draftMarkup, /督导要求/);
assert.match(draftMarkup, /data-supervision-requirement/);
assert.match(sentMarkup, /督导要求[^]*?readonly/);
assert.match(sentMarkup, /data-inspection-dimension="entry"/);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:complaint-inspections`

Expected: FAIL，现有页面仍直接发送、按角色分裂列表或显示旧文案。

- [ ] **Step 3: 改造核查工单操作**

按 `inspectionResultStatus(ticketId) === "不通过"` 和 `findLetterByTicket(ticketId)` 渲染：

```js
const letterAction = resultStatus !== "不通过" ? "-"
  : existingLetter
    ? actionButton("inspections-letter-page", existingLetter.id, "查看督导函")
    : actionButton("inspections-letter-draft", ticketId, "发起督导函");
```

发起操作只创建草稿并进入编辑页，不直接发送。

- [ ] **Step 4: 实现草稿编辑和发送**

草稿页只读展示工单信息和最新智能核查结果，可编辑指定处理人、抄送审批员和督导要求；“保存草稿”调用 `saveSupervisionDraft()`，“发送督导函”调用 `sendSupervisionLetter()` 并传入最新结果深拷贝。

发送前字段级校验文案固定为：

```js
if (!receiverId) return context.showValidationError("请选择指定处理人。", receiverControl);
if (!supervisionRequirement.trim()) return context.showValidationError("请填写督导要求。", requirementControl);
```

- [ ] **Step 5: 实现统一督导记录和角色权限**

删除处理员专用的第二套列表分支，统一由 `visibleSupervisionLetters(context)` 过滤记录；操作列依据权限函数显示“编辑 / 处理 / 查看”。处理中和已办结记录的抄送审批员均可见但无编辑按钮。

- [ ] **Step 6: 复用主单智能核查样式**

督导函详情使用：

```js
const inspectionMarkup = renderInspectionFindings(letter.inspectionResultSnapshot || {}, {
  ticketId:letter.ticketId,
  ticketType:ticket?.[1],
  ticketStatus:ticket?.[5],
  staticResult:true
});
```

`staticResult:true` 必须禁用“重新生成”，保证已发送快照只读。仅 `canProcessSupervisionLetter()` 为真时渲染可编辑反馈框和提交按钮。

- [ ] **Step 7: 更新流转记录和样式**

流转记录只允许：`创建督导函草稿`、`发送督导函（草稿 → 处理中）`、`提交督导反馈（处理中 → 已办结）`。删除“待处理”和“领取督导函”。CSS 选择器必须限定在 `.xib-module-complaint-inspections` 下。

- [ ] **Step 8: 运行模块测试和语法检查**

Run: `npm run test:complaint-inspections && npm run check:syntax`

Expected: PASS。

- [ ] **Step 9: 提交页面流程**

```bash
git add src/modules/complaints/inspections/index.js src/modules/complaints/inspections/module.css tools/test-complaint-inspections-module.js
git commit -m "feat: add assigned supervision letter workflow"
```

---

### Task 4: 从结构化子单契约移除督导函

**Files:**
- Modify: `data/forms/subprocesses.json:60-80, 1801-1930, 2100-2120`
- Modify: `data/workflow-schema.json:468-500, 590-605`
- Modify: `data/complaint-permission-rules.json`
- Modify: `data/subprocess-initiation-rules.json`
- Modify: `tools/validate-subprocess-contract.js`
- Modify: `tools/test-pr41-integration-rules.js`
- Generated: `data/form-schema.json`
- Generated: `data/prototype-data.runtime.js`

**Interfaces:**
- Produces: 子单类型、字段、状态机、发起规则和权限集合中均不存在 `督导函`。
- Preserves: 其余子流程的原顺序、字段、状态和权限完全不变。

- [ ] **Step 1: 写入失败的子单排除测试**

在 `tools/validate-subprocess-contract.js` 增加：

```js
const text = JSON.stringify({ subprocesses, workflow, permissions, initiationRules });
assert.equal(text.includes("督导函"), false, "督导函不应继续注册为子流程");
assert.equal(subprocesses.type_options.includes("督导函"), false);
assert.equal(Boolean(workflow.documentStateMachines.subprocess.typeOverrides?.["督导函"]), false);
```

同时在 `tools/test-pr41-integration-rules.js` 中保留其他子流程样例断言，确保删除动作没有扩大范围。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:subprocess-contract && npm run test:pr41-integration`

Expected: FAIL，指出督导函仍存在于子单契约。

- [ ] **Step 3: 删除督导函子单配置**

只删除与 `督导函` 对应的类型对象、字段区段、状态覆盖、发起规则和权限项；不得重排或改写其他子流程对象。

- [ ] **Step 4: 重新生成数据产物**

Run: `npm run build:data`

Expected: `data/form-schema.json` 和 `data/prototype-data.runtime.js` 更新，生成文件不再包含督导函子单定义，但仍包含 `runtimeDefaults.supervisionLetters`。

- [ ] **Step 5: 运行数据测试**

Run: `npm run test:form-schema && npm run test:subprocess-contract && npm run test:pr41-integration && npm run test:data`

Expected: PASS。

- [ ] **Step 6: 提交结构化数据清理**

```bash
git add data/forms/subprocesses.json data/workflow-schema.json data/complaint-permission-rules.json data/subprocess-initiation-rules.json data/form-schema.json data/prototype-data.runtime.js tools/validate-subprocess-contract.js tools/test-pr41-integration-rules.js
git commit -m "refactor: remove supervision letters from subprocess schema"
```

---

### Task 5: 删除 `app.js` 的督导函子单桥接和池逻辑

**Files:**
- Modify: `app.js:180-190, 900-1030, 1420-1430, 1720-1790, 6590-6610, 6840-6860, 7690-7900, 9440-9460, 10260-10360`
- Modify: `tools/test-linked-sample-ui.js:1600-1750`
- Modify: `tools/test-assignment-ui.js`
- Modify: `tools/test-intelligent-inspection-processing.js`

**Interfaces:**
- Consumes: 智能核查模块的 `serializeState()`、`hydrateState()` 和页面路由处理。
- Produces: `app.js` 只负责保存/恢复督导函模块状态，不再把督导函转换为子单行或审批行。

- [ ] **Step 1: 写入失败的静态回归测试**

在 `tools/test-intelligent-inspection-processing.js` 增加：

```js
assert.doesNotMatch(source, /function renderSupervisionLetterDetail/);
assert.doesNotMatch(source, /supervisionLetterRows\(ticketRowById\)/);
assert.doesNotMatch(source, /data-action=["']process-supervision-letter/);
assert.doesNotMatch(source, /领取督导函|待处理 → 处理中/);
assert.doesNotMatch(source, /navigate\(["']supervision-letter-detail["']\)/);
```

在 `tools/test-assignment-ui.js` 中断言子单工作台、机构池、下辖池和审批列表均不包含“督导函”。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:intelligent-inspection-processing && npm run test:assignment-ui`

Expected: FAIL，命中旧详情、领取和池拼接代码。

- [ ] **Step 3: 删除旧路由和页面渲染器**

删除 `supervision-letter-detail` 的全局路由、`renderSupervisionLetterDetail*`、保存反馈草稿和提交反馈事件；详情和处理统一由智能核查模块完成。

- [ ] **Step 4: 删除子单与审批列表拼接**

删除 `supervisionLetterRows()` 在子单工作台、机构工单池、下辖工单池和审批管理中的拼接；删除 `process-supervision-letter` 的领取/推进逻辑。保留 `persistWorkflowState()` 中：

```js
supervisionLetters: window.XIBComplaintInspections?.serializeState().supervisionLetters || []
```

以及启动时对 `hydrateState()` 的调用。

- [ ] **Step 5: 更新浏览器断言**

从 `tools/test-linked-sample-ui.js` 删除“发送后进入子单我的工作台”的旧场景，改为在 `analysis-inspections` 的“督导记录”中验证指定处理人可处理；保留现有编号、接收部门、抄送审批员和筛选断言。

- [ ] **Step 6: 运行聚焦回归**

Run: `npm run test:intelligent-inspection-processing && npm run test:assignment-ui && npm run test:linked-ui`

Expected: PASS；子单池无督导函，智能核查流程完整。

- [ ] **Step 7: 提交遗留代码清理**

```bash
git add app.js tools/test-linked-sample-ui.js tools/test-assignment-ui.js tools/test-intelligent-inspection-processing.js
git commit -m "refactor: remove supervision subprocess adapters"
```

---

### Task 6: 完成端到端角色回归和文档

**Files:**
- Modify: `tools/test-linked-sample-ui.js`
- Modify: `src/modules/complaints/inspections/README.md`
- Modify: `docs/模块分工.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1-5 的领域动作、页面和数据。
- Produces: 覆盖发起人、指定处理人、抄送审批员和无关人员的浏览器级验收证据。

- [ ] **Step 1: 增加完整浏览器场景**

在 `tools/test-linked-sample-ui.js` 按以下顺序执行：

```js
// 核查人员：不通过且无督导函 -> 发起 -> 草稿 -> 保存 -> 发送。
// 核查人员：再次回到核查工单，只能查看已有督导函，不能重复发起。
// 指定处理人：督导记录可见“处理中”，可填写反馈并办结。
// 抄送审批员：处理中和已办结均可见，只显示“查看”，无可编辑控件。
// 无关人员：看不到上述记录。
// 子单创建、处理、审批、关联子流程和关联单据中均不存在“督导函”。
```

关键断言使用稳定选择器：`data-action="inspections-letter-draft"`、`data-action="inspections-letter-save"`、`data-action="inspections-letter-send"`、`data-action="inspections-letter-process"`、`data-supervision-requirement` 和 `data-supervision-detail-feedback`。

- [ ] **Step 2: 运行浏览器测试确认行为**

Run: `npm run test:linked-ui`

Expected: PASS；若本地浏览器无法启动，记录准确的启动错误，但不得将其描述为测试通过。

- [ ] **Step 3: 更新模块文档**

`src/modules/complaints/inspections/README.md` 明确：

- 智能核查模块独占督导函生命周期。
- 状态仅为草稿、处理中、已办结。
- 指定处理人不领取；审批员仅抄送查看。
- `inspectionResultSnapshot` 在发送时冻结。
- 子单模块不得读取或写入督导函。

同步更新 `docs/模块分工.md` 和 `README.md` 的模块说明，删除“督导函作为子流程”的描述。

- [ ] **Step 4: 运行完整生成和验证**

Run:

```bash
npm run build:data
npm run check:generated
npm run check:syntax
npm run test:data
npm run test:ui
npm run verify
git diff --check
```

Expected: 所有命令 PASS；生成文件无陈旧差异；如 UI 测试受本机浏览器限制，PR 中逐项记录未执行成功的命令和原始错误。

- [ ] **Step 5: 人工检查 `file://` 与关键页面**

直接打开 `index.html`，依次检查核查人员、处理员、审批员视角；确认子单页面无督导函、智能核查列表和详情无错位、发送后督导要求只读、办结后反馈只读。

- [ ] **Step 6: 提交测试与文档**

```bash
git add tools/test-linked-sample-ui.js src/modules/complaints/inspections/README.md docs/模块分工.md README.md data/prototype-data.runtime.js data/form-schema.json
git commit -m "docs: document supervision letter ownership"
```

---

## 最终审查清单

- [ ] `git diff origin/main...HEAD --stat` 仅包含智能核查督导函、子单清理、测试、生成物和对应文档。
- [ ] `rg -n "督导函" data/forms/subprocesses.json data/workflow-schema.json data/complaint-permission-rules.json data/subprocess-initiation-rules.json` 无匹配。
- [ ] `rg -n "领取督导函|待处理 → 处理中|supervision-letter-detail|supervisionLetterRows" app.js` 无匹配。
- [ ] `rg -n "草稿|处理中|已办结" src/modules/complaints/inspections/index.js` 对应唯一状态集合。
- [ ] 已核对三个演示状态、四类角色权限、一单一函和发送快照。
- [ ] 已运行完整验证并记录客观结果。
- [ ] 提交 PR 前同步最新 `origin/main`，重新生成并复测，不覆盖远端同事修改。
