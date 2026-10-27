# 协作操作手册

本文是 README“零基础协作流程”的补充。第一次参与请先阅读 [README.md](README.md) 和 [一级模块分工](docs/模块分工.md)。

## 1. 一次性准备

建议安装：

- Git；
- Node.js 22 LTS，最低支持 Node.js 20；
- GitHub Desktop（不熟悉命令行时推荐）；
- Codex App、Codex IDE 扩展或 Codex CLI；
- Microsoft Edge 或 Google Chrome。

首次下载仓库：

```powershell
git clone https://github.com/sophia6703/TRS-XIB.git
cd TRS-XIB
npm install
npm run verify
```

如果仓库克隆后的文件夹名不是 `Prototype`，不影响运行。

## 2. 每个任务的固定流程

### 2.1 更新主分支

```powershell
git switch main
git pull --ff-only origin main
```

### 2.2 建任务分支

```powershell
git switch -c feat/<英文任务名>
```

可用前缀：

- `feat/`：新增功能；
- `fix/`：修复问题；
- `refactor/`：保持功能不变的结构迁移；
- `docs/`：只改文档；
- `test/`：只补测试。

### 2.3 限定模块范围

从 [docs/模块分工.md](docs/模块分工.md) 确定目录。默认只允许修改：

```text
src/modules/<自己的模块>/
对应测试
必要文档
```

需要修改 `src/core/`、`src/shared/`、`app.js`、`styles.css`、共享数据 schema 或生成流程时，先在任务/PR 说明原因和影响模块。字段调整按维护边界选择 `data/forms/main-work-orders.json` 或 `data/forms/subprocesses.json`；不要直接修改生成的 `data/form-schema.json`。

### 2.4 使用 Codex

把仓库根目录作为项目打开。Codex 会自动读取 `AGENTS.md`；进入模块目录工作时，还会读取更近的 `src/modules/AGENTS.md` 或模块内规则。

推荐提示词：

```text
先阅读仓库和目标模块的 AGENTS.md、README 与架构文档。
只处理 <模块/路由>。
先审查现状和依赖，再给出计划并实现。
保留现有视觉、角色权限、交互、演示数据和 index.html 直接打开方式。
新增聚焦回归，运行 npm run verify。
完成后列出修改、测试、风险和下一步，不要修改其他模块。
```

以下操作让 AI 先解释再执行：

- 删除或批量移动文件；
- 重写 Git 历史或强制推送；
- 修改共享 schema、存储版本或构建脚本；
- 增加生产依赖；
- 访问部署、密钥或真实外部系统。

### 2.5 本地检查

常用命令：

```powershell
npm run dev              # 启动本地服务器
npm run check:syntax     # JavaScript 语法
npm run test:data        # 数据、配置、模块契约和协作规则
npm run test:ui          # 浏览器回归和 file:// 检查
npm run verify           # 提交前完整检查
npm run build            # 重新生成数据与统计产物
npm run check:generated  # 检查生成文件是否最新
```

可视修改必须自己打开页面检查，不能只看测试结果。

### 2.6 提交

```powershell
git status
git diff
git add <本任务文件>
git commit -m "feat: add education course list"
git push -u origin feat/education-course-list
```

不要使用 `git add .` 盲目把其他人的临时文件加入提交。

提交信息使用英文并保持 UTF-8 编码。中文 Windows 控制台（GBK）直接输入中文 commit 会把文字写成问号且不可恢复，建议在编辑器/图形客户端中填写，或先在仓库执行 `git config i18n.commitEncoding utf-8`。

### 2.7 创建 PR

本仓库使用 GitHub，因此叫 PR，不叫 MR。PR 标题、描述和讨论使用中文；commit 与代码名称使用英文。

PR 必须包含：

- 修改目的；
- 模块与路由；
- 影响角色；
- 可见结果和截图/预览链接；
- 已运行测试；
- 风险、迁移债务和回滚方式。

### 2.8 审查和合并

1. 等待 GitHub CI 全部变绿。
2. 使用 Codex `/review` 或 PR 中 `@codex review` 做代码审查。
3. 由至少一名模块维护人确认业务和页面；高风险变更按约定增加批准人数。
4. 使用 Squash and merge。
5. 删除任务分支。
6. 其他人重新更新 `main`。

建议在 GitHub 仓库设置中开启 **Automatically delete head branches**，合并后自动删除远程任务分支；本地再执行 `git fetch --prune` 并删除对应本地分支，避免历史分支堆积。

## 3. 冲突处理

### 普通源码冲突

1. 停止继续开发。
2. 更新远程 `main`。
3. 让 Codex解释冲突双方的意图。
4. 只解决冲突，不顺便重构。
5. 完成后重新运行 `npm run verify`。

不要对整个文件直接选择“全部保留我的”或“全部保留对方的”。

### 生成文件冲突

1. 先解决 `data/forms/`、其他 JSON、JSX 等可编辑源文件。
2. 不手工拼接 `data/form-schema.json`、`*.runtime.js`、`statistics-module.js` 或 `statistics-module.css`。
3. 运行 `npm run build`。
4. 检查生成差异后提交。

## 4. CI 失败处理

在本地先运行失败的同名命令。常见原因：

- 忘记运行 `npm install`；
- JavaScript 引号或括号错误；
- 修改源数据后没有重新生成；
- 新模块忘记加入 `index.html` 或 `check:syntax`；
- 路由被两个模块同时注册；
- 浏览器页面出现控制台错误；
- 破坏 `file://` 直接打开。

把完整错误信息交给 Codex，不要只说“CI 挂了”。

## 5. Skill 适用范围

普通协作规则放在 `AGENTS.md`，不需要为每个模块创建 Skill。

只有当一个流程已经稳定、经常重复，而且具有明确输入输出时，再考虑共享 Skill，例如：

- 按固定清单迁移一个旧模块；
- 自动生成统一格式的版本说明；
- 按项目规则审查 PR；
- 汇总 CI 失败原因。

现阶段优先把规则、测试和模块边界做好，比立即开发复杂 Skill 更重要。
