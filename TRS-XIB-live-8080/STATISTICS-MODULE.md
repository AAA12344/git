# 统计模块开发说明

## 当前结构

首页、投诉统计分析、信访统计分析和报告中心已经作为主应用的一等模块运行，不再通过 iframe 加载。

- `app.js`：维护主导航、权限、路由映射以及统计模块的 mount / update / unmount 生命周期。
- `statistics-module.source.jsx`：统计与报告页面的唯一可编辑源文件，保留原页面的数据联动和筛选逻辑。
- `statistics-module.js`：预编译产物，请勿直接编辑。
- `statistics-module.css`：离线生成的 Tailwind 样式与统计模块定制样式，请勿直接编辑。
- `data/china-geojson.runtime.js`：构建时从迁移基线提取的全国省级 GeoJSON，供首页全国地图使用。
- `ui/vendor/react.production.min.js`、`ui/vendor/react-dom.production.min.js`：本地生产版运行时。
- `tools/build-statistics-module.js`：离线构建脚本。
- `statistics-embedded.html`：主应用不直接加载，但当前构建仍从中提取 Babel、Tailwind、React 和地图数据，因此仍是构建依赖。

统计模块挂载在 Shadow DOM 中。这样既可以复用原 React 组件和交互，又不会让 Tailwind 工具类、表单重置样式污染工单、审批、后台管理等原生模块。

## 路由映射

| 主应用页面 | 模块路由 |
| --- | --- |
| `overview` | `home` |
| `stats-complaint-overview` | `production` |
| `stats-complaint-institution` | `institution2` |
| `stats-complaint-product` | `product` |
| `stats-complaint-reason` | `reason` |
| `stats-complaint-channel` | `channel` |
| `stats-complaint-line` | `line` |
| `stats-complaint-customer` | `customer` |
| `stats-petition` | `petition` |
| `report-center` | `reports` |

同一组统计页面之间切换时只调用 `update`，不会销毁模块，因此筛选状态和 React 实例可以复用。切换到工单等其他业务模块时执行 `unmount`，再次进入时重新挂载并恢复完整事件绑定。

## 修改与构建

1. 只编辑 `statistics-module.source.jsx`。
2. 在 `Prototype` 目录运行：

   ```powershell
   node tools\build-statistics-module.js
   ```

3. 检查语法：

   ```powershell
   node --check app.js
   node --check statistics-module.js
   ```

4. 运行无头浏览器回归：

   ```powershell
   node tools\test-statistics-module.js
   ```

构建脚本会：

- 使用旧页面中保存的 Babel Standalone，仅在 Node 构建阶段把 JSX 预编译为普通 JavaScript；
- 使用 Playwright Chromium 或本机 Edge/Chrome 离线提取实际使用到的 Tailwind 静态样式；
- 更新本地 React、ReactDOM 生产版运行时；
- 不向浏览器发送 Babel 或 Tailwind 编译器。

以下命令具有覆盖性，正常开发和 AI 自动化不得运行：

```powershell
node tools\build-statistics-module.js --refresh-source
```

它会用迁移基线覆盖 `statistics-module.source.jsx`。只有明确决定放弃当前统计源码并重新迁移时，才可以在独立分支中人工执行。

## 回归清单

- 使用“开发测试视图”逐页检查首页、投诉总览、机构、产品、原因、渠道、条线、客户、信访统计和报告中心。
- 确认统计页面之间切换时模块节点不变，页面主标题和数据内容正确更新。
- 检查开始/结束日期、机构、渠道、口径、环比/同比、剔除规则、查询和重置；机构范围弹窗默认按处理机构，并在投诉页支持切换投诉机构、信访页支持切换信访机构。
- 检查指标说明、异常明细、地图下钻、排行分页、报告类型切换、报告配置和导出。
- 从统计页切换到工单页，再返回统计页，检查日期弹层、下拉层和页面外点击关闭。
- 分别用经办员、业务员、管理员和开发测试视图检查原有页面权限，避免绕过 `PERMISSIONS`。
- 检查页面中不存在 iframe，浏览器控制台无运行时异常。
