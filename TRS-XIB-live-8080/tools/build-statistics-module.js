/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");
const { minify } = require("terser");

const prototypeDir = path.resolve(__dirname, "..");
const legacyPath = path.join(prototypeDir, "statistics-embedded.html");
const sourcePath = path.join(prototypeDir, "statistics-module.source.jsx");
const outputPath = path.join(prototypeDir, "statistics-module.js");
const cssPath = path.join(prototypeDir, "statistics-module.css");
const chinaGeoPath = path.join(prototypeDir, "data", "china-geojson.runtime.js");
const vendorDir = path.join(prototypeDir, "ui", "vendor");
const reactPath = path.join(vendorDir, "react.production.min.js");
const reactDomPath = path.join(vendorDir, "react-dom.production.min.js");
const refreshSource = process.argv.includes("--refresh-source");

function readLegacyScripts(html) {
  return Array.from(html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi), match => match[1]);
}

function readLegacyStyles(html) {
  return Array.from(html.matchAll(/<style(?:\s+[^>]*)?>([\s\S]*?)<\/style>/gi), match => match[1]);
}

function requireBlock(block, description) {
  if (!block) throw new Error(`未能从 statistics-embedded.html 找到${description}`);
  return block.trim();
}

function createModuleSource(jsx) {
  let source = jsx.trim();

  source = source.replace(
    /function App\(\) \{\s*const initialHash = window\.location\.hash;\s*const \[pageKey, setPageKey\] = useState\([^;]+;\s*/,
    `function statisticsRouteToPage(route) {
      return route === 'home' || route === 'executive' ? 'home' : route === 'reports' ? 'reports' : route === 'petition' ? 'petition' : route === 'institution' || route === 'institution2' ? 'institution2' : route === 'product' ? 'product' : route === 'reason' ? 'reason' : route === 'channel' ? 'channel' : route === 'line' ? 'line' : route === 'customer' ? 'customer' : route === 'overview' ? 'overview' : route === 'overview2' ? 'overview2' : 'production';
    }

    function App({ route = 'production', onRouteChange }) {
      const [pageKey, setPageKey] = useState(() => statisticsRouteToPage(route));
      `
  );

  source = source.replace(
    /\s*const routeToPage = \(route\) =>[^;]+;\s*React\.useEffect\(\(\) => \{\s*const handleRouteMessage = \(event\) => \{[\s\S]*?return \(\) => window\.removeEventListener\('message', handleRouteMessage\);\s*\}, \[\]\);/,
    `
      React.useEffect(() => {
        setPageKey(statisticsRouteToPage(route));
        setSelectedMetric(null);
        setDetailMetric(null);
      }, [route]);
    `
  );

  source = source.replace(
    /setPageKey\(target\);\s*window\.location\.hash = route;\s*if \(window\.parent !== window\) window\.parent\.postMessage\(\{ type: 'xib-statistics-route-change', route \}, '\*'\);/,
    `setPageKey(target);
        if (route && typeof onRouteChange === 'function') onRouteChange(route);`
  );

  source = source.replaceAll("document.getElementById('root')", "getStatisticsRoot()");
  source = source.replaceAll('document.getElementById("root")', "getStatisticsRoot()");
  source = source.replaceAll(
    "if (!document.documentElement.classList.contains('xib-stat-embed')) return;",
    "if (!getStatisticsRoot()) return;"
  );
  source = source.replace(
    "document.querySelectorAll('.xib-sticky-filter').forEach(filter => {",
    "(getStatisticsRoot()?.querySelectorAll('.xib-sticky-filter') || []).forEach(filter => {"
  );
  source = source.replace(
    "const scrollTop = document.scrollingElement?.scrollTop || window.scrollY || 0;",
    "const statisticsRoot = getStatisticsRoot();\n        const scrollTop = statisticsRoot?.scrollTop || 0;\n        const stickyViewportTop = statisticsRoot?.getBoundingClientRect().top || 0;"
  );
  source = source.replace(
    "document.querySelectorAll('.xib-sticky-filter').forEach(filter => {",
    "(statisticsRoot?.querySelectorAll('.xib-sticky-filter') || []).forEach(filter => {"
  );
  source = source.replace(
    "const isStuck = scrollTop > 0 && filter.getBoundingClientRect().top <= top + 1;",
    "const isStuck = scrollTop > 0 && filter.getBoundingClientRect().top <= stickyViewportTop + top + 1;"
  );
  source = source.replace(
    `      if (!window.__xibEmbedOfficialCloser) {
        window.__xibEmbedOfficialCloser = event => {
          if (!event.target.closest('.xib-embed-control')) closeAll(null);
        };
        document.addEventListener('click', window.__xibEmbedOfficialCloser);
      }`,
    `      const officialEventRoot = getStatisticsRoot()?.getRootNode();
      if (officialEventRoot && statisticsOfficialCloserRoot !== officialEventRoot) {
        if (statisticsOfficialCloserRoot && statisticsOfficialCloser) {
          statisticsOfficialCloserRoot.removeEventListener('click', statisticsOfficialCloser);
        }
        statisticsOfficialCloser = event => {
          if (!event.target.closest('.xib-embed-control')) closeAll(null);
        };
        statisticsOfficialCloserRoot = officialEventRoot;
        statisticsOfficialCloserRoot.addEventListener('click', statisticsOfficialCloser);
      }`
  );
  source = source.replace(",document.body)}</>;", ",getStatisticsPortalRoot())}</>;");
  source = source.replace(
    "document.querySelector('[data-testid=\"institution2-trend\"]')",
    "getStatisticsRoot()?.querySelector('[data-testid=\"institution2-trend\"]')"
  );
  source = source.replace(
    "document.addEventListener('mousedown',close);",
    "getStatisticsRoot()?.getRootNode().addEventListener('mousedown',close);"
  );
  source = source.replace(
    "document.removeEventListener('mousedown',close);",
    "getStatisticsRoot()?.getRootNode().removeEventListener('mousedown',close);"
  );
  source = source.replace(
    "document.getElementById('petition-detail-table')",
    "getStatisticsRoot()?.querySelector('#petition-detail-table')"
  );
  source = source.replace(
    "document.querySelectorAll('td, span').forEach(node => {",
    "getStatisticsRoot()?.querySelectorAll('td, span').forEach(node => {"
  );

  source = source.replace(
    "ReactDOM.createRoot(getStatisticsRoot()).render(<App />);",
    ""
  );

  source = source.replace(
    /window\.addEventListener\('scroll', scheduleStickyFilterLayers, \{ passive:true \}\);\s*window\.addEventListener\('resize', scheduleStickyFilterLayers\);\s*if \(document\.documentElement\.classList\.contains\('xib-stat-embed'\)\) \{[\s\S]*?\}\s*$/,
    ""
  );

  if (!source.includes("function App({ route = 'production', onRouteChange })")) {
    throw new Error("App 路由改造失败，旧页面结构可能已变化，请更新构建脚本中的迁移规则");
  }

  const modulePrelude = `(function (global) {
    "use strict";
    let statisticsRootElement = null;
    let statisticsReactRoot = null;
    let statisticsObserver = null;
    let statisticsHost = null;
    let statisticsOptions = {};
    let statisticsOfficialCloser = null;
    let statisticsOfficialCloserRoot = null;

    function getStatisticsRoot() {
      return statisticsRootElement;
    }

    function getStatisticsPortalRoot() {
      return statisticsHost?.shadowRoot?.getElementById('statistics-portal-root') || statisticsRootElement;
    }

`;

  const moduleEpilogue = `

    function renderStatisticsModule() {
      if (!statisticsReactRoot) return;
      statisticsReactRoot.render(
        <App
          route={statisticsOptions.route || 'production'}
          onRouteChange={statisticsOptions.onRouteChange}
        />
      );
    }

    function startStatisticsEnhancements() {
      if (!statisticsRootElement) return;
      if (statisticsObserver) statisticsObserver.disconnect();
      statisticsObserver = new MutationObserver(() => window.requestAnimationFrame(() => {
        syncEmbeddedWorkOrderStatus();
        syncEmbeddedOfficialControls();
        scheduleStickyFilterLayers();
      }));
      statisticsObserver.observe(statisticsRootElement, { childList: true, subtree: true });
      window.requestAnimationFrame(() => {
        syncEmbeddedWorkOrderStatus();
        syncEmbeddedOfficialControls();
        scheduleStickyFilterLayers();
      });
      statisticsRootElement.addEventListener('scroll', scheduleStickyFilterLayers, { passive: true });
      window.addEventListener('resize', scheduleStickyFilterLayers);
    }

    function stopStatisticsEnhancements() {
      if (statisticsObserver) statisticsObserver.disconnect();
      statisticsObserver = null;
      if (statisticsOfficialCloserRoot && statisticsOfficialCloser) {
        statisticsOfficialCloserRoot.removeEventListener('click', statisticsOfficialCloser);
      }
      statisticsOfficialCloser = null;
      statisticsOfficialCloserRoot = null;
      statisticsRootElement?.removeEventListener('scroll', scheduleStickyFilterLayers);
      window.removeEventListener('resize', scheduleStickyFilterLayers);
    }

    global.XIBStatisticsModule = {
      mount(host, options = {}) {
        if (!host) throw new Error('统计分析模块缺少挂载节点');
        if (statisticsHost && statisticsHost !== host) this.unmount();
        statisticsHost = host;
        statisticsOptions = { ...options };
        const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
        let mountNode = shadowRoot.getElementById('root');
        if (!mountNode) {
          const stylesheet = document.createElement('link');
          stylesheet.rel = 'stylesheet';
          stylesheet.href = 'statistics-module.css';
          shadowRoot.appendChild(stylesheet);
          mountNode = document.createElement('div');
          mountNode.id = 'root';
          shadowRoot.appendChild(mountNode);
          const portalNode = document.createElement('div');
          portalNode.id = 'statistics-portal-root';
          shadowRoot.appendChild(portalNode);
        }
        statisticsRootElement = mountNode;
        statisticsReactRoot = statisticsReactRoot || ReactDOM.createRoot(mountNode);
        renderStatisticsModule();
        startStatisticsEnhancements();
      },
      update(options = {}) {
        const routeChanged = Boolean(options.route && options.route !== statisticsOptions.route);
        statisticsOptions = { ...statisticsOptions, ...options };
        renderStatisticsModule();
        if (routeChanged) statisticsRootElement?.scrollTo({ top: 0, behavior: 'auto' });
        window.requestAnimationFrame(scheduleStickyFilterLayers);
      },
      unmount() {
        stopStatisticsEnhancements();
        if (statisticsReactRoot) statisticsReactRoot.unmount();
        statisticsReactRoot = null;
        statisticsRootElement = null;
        statisticsHost = null;
        statisticsOptions = {};
      }
    };
  })(window);
`;

  return modulePrelude + source + moduleEpilogue;
}

function shadowCompatibleCss(css) {
  return css
    .replaceAll(":root", ":host")
    .replace(/html,\s*body,\s*#root/g, ":host, #root")
    .replace(/html\.xib-stat-embed\s+body\s*>\s*#root/g, "#root")
    .replace(/html\.xib-stat-embed\s+body\s+#root/g, "#root")
    .replace(/html\.xib-stat-embed\s+#root/g, "#root")
    .replace(/html\.xib-stat-embed\s+body/g, "#root")
    .replace(/html\.xib-stat-embed/g, "#root")
    .replace(/body\s*>\s*#root/g, "#root")
    .replace(/body\s+#root/g, "#root")
    .replace(/(^|[},]\s*)body(?=\s*[{,:>])/gm, "$1#root");
}

function collectTailwindTokens(source) {
  const candidates = new Set();
  const stringPattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  for (const match of source.matchAll(stringPattern)) {
    const value = match[2];
    if (!/[-:\[\]\/]/.test(value) && !/\b(?:flex|grid|block|hidden|relative|absolute|sticky|fixed|table)\b/.test(value)) continue;
    for (const token of value.split(/\s+/)) {
      const normalized = token.trim().replace(/^[("'`]+|[)"'`,;]+$/g, "");
      if (!normalized || normalized.length > 180) continue;
      if (normalized.includes("${") || /[<>{}\\]/.test(normalized)) continue;
      if (!/^[!A-Za-z0-9_:[\]#.%/(),&=*+'"-]+$/.test(normalized)) continue;
      candidates.add(normalized);
    }
  }
  return Array.from(candidates).sort();
}

async function generateTailwindCss(tailwindRuntime, tailwindConfig, source) {
  const browser = findBrowserExecutable();
  if (!browser) throw new Error("未找到 Edge/Chrome，无法离线生成统计模块 Tailwind 样式");
  const tokens = collectTailwindTokens(source);
  const tempPath = path.join(prototypeDir, "tools", ".statistics-tailwind-build.html");
  const tokenMarkup = tokens.map(token => `<i class="${token.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"></i>`).join("");
  const html = `<!doctype html><html><head><meta charset="UTF-8"><script>${tailwindRuntime}</script><script>${tailwindConfig}</script><style type="text/tailwindcss"></style></head><body><div>${tokenMarkup}</div></body></html>`;
  fs.writeFileSync(tempPath, html, "utf8");
  let browserInstance;
  try {
    browserInstance = await chromium.launch({
      headless: true,
      executablePath: browser,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-extensions"]
    });
    const page = await browserInstance.newPage();
    await page.goto(pathToFileURL(tempPath).href, { waitUntil: "load", timeout: 60000 });
    await page.waitForFunction(
      () => [...document.querySelectorAll("style")].some(style => style.textContent.length >= 10000),
      undefined,
      { timeout: 60000 }
    );
    const styles = (await page.locator("style").allTextContents()).filter(style => style.trim());
    const generated = styles.sort((a, b) => b.length - a.length)[0];
    if (!generated || generated.length < 10000) {
      throw new Error(`Tailwind 静态样式生成异常（${generated?.length || 0} 字符）`);
    }
    console.log(`Tailwind: ${tokens.length} 个候选类，${generated.length} 字符 CSS`);
    return generated;
  } finally {
    await browserInstance?.close();
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

function compileWithBabel(babelStandalone, source) {
  const context = { console };
  context.self = context;
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(babelStandalone, context, { filename: "babel-standalone.js" });
  if (!context.Babel) throw new Error("Babel Standalone 初始化失败");
  return context.Babel.transform(source, {
    presets: ["react"],
    sourceType: "script",
    comments: true,
    compact: false
  }).code;
}

async function main() {
  const html = fs.readFileSync(legacyPath, "utf8");
  const scripts = readLegacyScripts(html);
  const styles = readLegacyStyles(html);
  const tailwindRuntime = requireBlock(scripts.find(script => script.includes("cdn.tailwindcss.com should not be used")), "Tailwind 运行时");
  const tailwindConfig = requireBlock(scripts.find(script => script.includes("tailwind.config =")), "Tailwind 配置");
  const react = requireBlock(scripts.find(script => script.includes("react.production.min.js")), "React");
  const reactDom = requireBlock(scripts.find(script => script.includes("react-dom.production.min.js")), "ReactDOM");
  const babel = requireBlock(scripts.find(script => script.length > 1000000 && script.includes("Babel")), "Babel Standalone");
  const legacyJsx = requireBlock(scripts.find(script => script.includes("function App()") && script.includes("ReactDOM.createRoot")), "统计页面 JSX");
  const chinaGeoData = requireBlock(scripts.find(script => script.includes("window.CHINA_GEOJSON=")), "全国地图 GeoJSON");

  fs.mkdirSync(vendorDir, { recursive: true });
  fs.mkdirSync(path.dirname(chinaGeoPath), { recursive: true });
  fs.writeFileSync(chinaGeoPath, `${chinaGeoData}\n`, "utf8");
  fs.writeFileSync(reactPath, `${react}\n`, "utf8");
  fs.writeFileSync(reactDomPath, `${reactDom}\n`, "utf8");

  if (refreshSource || !fs.existsSync(sourcePath)) {
    fs.writeFileSync(sourcePath, `${createModuleSource(legacyJsx)}\n`, "utf8");
    console.log(`已${refreshSource ? "刷新" : "创建"} ${path.basename(sourcePath)}`);
  }

  const source = fs.readFileSync(sourcePath, "utf8");
  const customCss = styles
    .filter(style => style.includes("--xib-primary") || style.includes("html.xib-stat-embed"))
    .map(shadowCompatibleCss)
    .join("\n\n");
  const tailwindCss = await generateTailwindCss(tailwindRuntime, tailwindConfig, source);
  const moduleViewportCss = `:host{display:block;height:100%;min-height:100%}#root{box-sizing:border-box;height:100%!important;min-height:100%!important;overflow:auto!important;overscroll-behavior:contain}`;
  fs.writeFileSync(cssPath, `${tailwindCss}\n\n${customCss}\n\n${moduleViewportCss}\n`, "utf8");

  const compiled = compileWithBabel(babel, source);
  const minified = await minify(compiled, {
    compress: true,
    mangle: true,
    format: { comments: false }
  });
  fs.writeFileSync(outputPath, `/* 由 tools/build-statistics-module.js 从 statistics-module.source.jsx 生成，请勿直接编辑。 */\n${minified.code}\n`, "utf8");

  console.log(`全国地图数据: ${fs.statSync(chinaGeoPath).size} bytes`);
  console.log(`React: ${fs.statSync(reactPath).size} bytes`);
  console.log(`ReactDOM: ${fs.statSync(reactDomPath).size} bytes`);
  console.log(`统计模块 JS: ${fs.statSync(outputPath).size} bytes`);
  console.log(`统计模块 CSS: ${fs.statSync(cssPath).size} bytes`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
