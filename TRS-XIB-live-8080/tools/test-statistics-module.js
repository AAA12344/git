"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
const { findBrowserExecutable } = require("./browser-path");

const prototypeDir = path.resolve(__dirname, "..");
const edge = findBrowserExecutable();
if (!edge) throw new Error("未找到 Edge/Chrome，无法运行统计模块回归测试");
const indexUrl = pathToFileURL(path.join(prototypeDir, "index.html")).href + "#overview";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "xib-edge-"));
const browser = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-extensions",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  indexUrl
], { stdio: "ignore", windowsHide: true });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));


async function waitForPort() {
  const file = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100; i += 1) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
    await wait(100);
  }
  throw new Error("Edge DevTools 端口启动超时");
}

async function main() {
  const [port] = await waitForPort();
  let targets = [];
  for (let i = 0; i < 50; i += 1) {
    targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
    if (targets.some(target => target.type === "page")) break;
    await wait(100);
  }
  const page = targets.find(target => target.type === "page");
  if (!page) throw new Error("未找到页面调试目标");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const exceptions = [];
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails.text || "Runtime exception");
    }
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const verifySelectableDetails=async prefix=>{
    const initial=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const rows=[...shadow.querySelectorAll('[data-testid="${prefix}-select"]')];const selectAll=shadow.querySelector('[data-testid="${prefix}-select-all"]');const exportButton=shadow.querySelector('[data-testid="${prefix}-export"]');return{rowCount:rows.length,selectAll:Boolean(selectAll),checked:rows.filter(node=>node.checked).length,exportDisabled:exportButton?.disabled}})()`);
    if(!initial.rowCount||!initial.selectAll||initial.checked!==0||!initial.exportDisabled)throw new Error(`${prefix}选择初始状态失败：`+JSON.stringify(initial));
    await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="${prefix}-select"]').click();true`);await wait(60);
    const afterSingle=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;return{checked:shadow.querySelectorAll('[data-testid="${prefix}-select"]:checked').length,exportDisabled:shadow.querySelector('[data-testid="${prefix}-export"]').disabled}})()`);
    if(afterSingle.checked!==1||afterSingle.exportDisabled)throw new Error(`${prefix}单选与导出联动失败：`+JSON.stringify(afterSingle));
    if(initial.rowCount>1){await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="${prefix}-select-all"]').click();true`);await wait(60);}
    const afterAll=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const rows=[...shadow.querySelectorAll('[data-testid="${prefix}-select"]')];return{rowCount:rows.length,checked:rows.filter(node=>node.checked).length,selectAll:shadow.querySelector('[data-testid="${prefix}-select-all"]').checked}})()`);
    if(afterAll.checked!==afterAll.rowCount||!afterAll.selectAll)throw new Error(`${prefix}全选联动失败：`+JSON.stringify(afterAll));
    return{initial,afterSingle,afterAll};
  };
  const selectionChecks={};

  await command("Runtime.enable");
  await evaluate(`localStorage.setItem('xib-role','developer'); localStorage.setItem('xib-role-profile','development-developer'); location.reload(); true`);
  await wait(1800);

  const routes = {
    overview: "首页",
    "stats-complaint-overview": "投诉总览",
    "stats-complaint-institution": "机构分析",
    "stats-complaint-product": "产品分析",
    "stats-complaint-reason": "原因分析",
    "stats-complaint-channel": "渠道分析",
    "stats-complaint-line": "条线分析",
    "stats-complaint-customer": "客户分析",
    "stats-petition": "信访统计分析",
    "report-center": "报告中心"
  };
  const devQueryFilterRoutes = new Set([
    "overview",
    "stats-complaint-overview",
    "stats-complaint-institution",
    "stats-complaint-product",
    "stats-complaint-reason",
    "stats-complaint-channel",
    "stats-complaint-line",
    "stats-complaint-customer",
    "stats-petition"
  ]);
  const results = [];
  let firstHost = null;
  for (const [route, expectedText] of Object.entries(routes)) {
    await evaluate(`location.hash = ${JSON.stringify(route)}`);
    await wait(500);
    const snapshot = await evaluate(`(() => {
      const host = document.querySelector('.statistics-module-host');
      const shadow = host?.shadowRoot;
      const text = shadow?.querySelector('main')?.textContent || '';
      if (!window.__xibFirstStatisticsHost) window.__xibFirstStatisticsHost = host;
      return {
        route: location.hash.slice(1),
        mainHeading: shadow?.querySelector('main h1, main h2')?.textContent?.trim() || '',
        iframeCount: document.querySelectorAll('iframe').length,
        hasHost: Boolean(host),
        hasShadow: Boolean(shadow),
        hasExpectedText: text.includes(${JSON.stringify(expectedText)}),
        sameHost: window.__xibFirstStatisticsHost === host,
        hostHeight: host?.clientHeight || 0,
        moduleHeight: shadow?.querySelector('#root')?.clientHeight || 0,
        moduleScrollHeight: shadow?.querySelector('#root')?.scrollHeight || 0,
        moduleOverflowY: shadow ? getComputedStyle(shadow.querySelector('#root')).overflowY : '',
        devGranularityCount: shadow?.querySelectorAll('[data-dev-org-granularity]').length || 0,
        selectedOrganizationRowCount: shadow?.querySelectorAll('[data-testid="dev-selected-organizations"]').length || 0,
        selectedOrganizationPlaceholder: shadow?.querySelector('[data-testid="dev-selected-organizations"]')?.textContent.includes('待选择') || false,
        buttons: Array.from(shadow?.querySelectorAll('button') || []).slice(0, 8).map(button => button.textContent.trim()).filter(Boolean)
      };
    })()`);
    firstHost ||= snapshot.hasHost;
    results.push(snapshot);
  }

  await evaluate(`location.hash = 'stats-complaint-product'`);
  await wait(500);
  const productDetailInitial=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host')?.shadowRoot;const filters=shadow?.querySelector('[data-testid="product-detail-filters"]');const row=shadow?.querySelector('[data-testid="product-detail-row"]');const header=[...row?.parentElement?.firstElementChild?.children||[]].map(node=>node.textContent.trim());const title=[...shadow.querySelectorAll('h3')].find(node=>node.textContent.trim()==='关联单笔投诉明细');return{title:Boolean(title),summary:title?.nextElementSibling?.textContent||'',filters:filters?.textContent||'',header,secondary:[...shadow.querySelectorAll('[data-testid="product-detail-row"]')].map(item=>item.children[3]?.textContent.trim()),rowCount:shadow.querySelectorAll('[data-testid="product-detail-row"]').length,firstId:row?.querySelector('button')?.textContent.trim()||''}})()`);
  const expectedProductHeaders=['工单编号','客户投诉时间','一级产品标签','二级产品标签','投诉原因标签','投诉诉求','受理渠道','工单状态'];
  if(!productDetailInitial.title||productDetailInitial.summary.includes('全行（按处理机构）')||productDetailInitial.summary.includes('当前一级产品：')||productDetailInitial.summary.includes('按投诉量降序')||!productDetailInitial.summary.includes('一级产品必选')||!productDetailInitial.summary.includes('二级产品与投诉原因仅可择其一')||JSON.stringify(productDetailInitial.header)!==JSON.stringify(expectedProductHeaders)||!productDetailInitial.filters.includes('一级产品类型：贷款')||productDetailInitial.filters.includes('二级产品类型：')||productDetailInitial.filters.includes('投诉原因：')||productDetailInitial.rowCount!==5||!['个人合作类贷款','个人非合作类贷款','对公贷款'].every(name=>productDetailInitial.secondary.includes(name)))throw new Error('产品关联单笔投诉明细初始结构回归失败：'+JSON.stringify(productDetailInitial));
  selectionChecks.product=await verifySelectableDetails('product-detail');
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-product-cause="催收"]').click();true`);await wait(100);
  const productCauseFilter=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;return{filter:shadow.querySelector('[data-testid="product-detail-filters"]').textContent,rows:shadow.querySelectorAll('[data-testid="product-detail-row"]').length,cause:shadow.querySelector('[data-testid="product-detail-row"]')?.children[4]?.textContent||''}})()`);
  if(!productCauseFilter.filter.includes('投诉原因：催收')||productCauseFilter.filter.includes('二级产品类型：')||productCauseFilter.rows!==1||productCauseFilter.cause!=='催收')throw new Error('产品投诉原因互斥筛选失败：'+JSON.stringify(productCauseFilter));
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;[...shadow.querySelectorAll('button')].find(node=>node.textContent.includes('个人非合作类贷款')).click();return true})()`);await wait(100);
  const productFineFilter=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="product-detail-filters"]').textContent`);
  if(!productFineFilter.includes('二级产品类型：个人非合作类贷款')||productFineFilter.includes('投诉原因：'))throw new Error('产品二级产品互斥筛选失败：'+productFineFilter);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="product-detail-reset"]').click();true`);await wait(100);
  const productResetFilter=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const actions=[...shadow.querySelectorAll('h3')].find(node=>node.textContent.trim()==='关联单笔投诉明细')?.parentElement?.nextElementSibling;return{filter:shadow.querySelector('[data-testid="product-detail-filters"]').textContent,rows:shadow.querySelectorAll('[data-testid="product-detail-row"]').length,actions:[...actions?.querySelectorAll('button')||[]].map(node=>node.textContent.trim())}})()`);
  if(productResetFilter.filter.includes('二级产品类型：')||productResetFilter.filter.includes('投诉原因：')||productResetFilter.rows!==5||productResetFilter.actions.indexOf('重置交叉筛选')>productResetFilter.actions.indexOf('导出明细'))throw new Error('产品交叉筛选重置失败：'+JSON.stringify(productResetFilter));
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="product-detail-row"] button').click();true`);await wait(300);
  const productTicketNavigation=await evaluate(`({hash:location.hash,heading:document.querySelector('main h1')?.textContent.trim()||''})`);
  if(productTicketNavigation.hash!=='#ticket-detail'||productTicketNavigation.heading!=='工单详情')throw new Error('产品工单编号未跳转工单详情：'+JSON.stringify(productTicketNavigation));

  await evaluate(`location.hash = 'stats-complaint-reason'`);
  await wait(500);
  const reasonDetailInitial=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host')?.shadowRoot;const filters=shadow?.querySelector('[data-testid="reason-detail-filters"]');const row=shadow?.querySelector('[data-testid="reason-detail-row"]');const header=[...row?.parentElement?.firstElementChild?.children||[]].map(node=>node.textContent.trim());const title=[...shadow.querySelectorAll('h3')].find(node=>node.textContent.trim()==='关联单笔投诉明细');const actions=[...title?.parentElement?.nextElementSibling?.querySelectorAll('button')||[]].map(node=>node.textContent.trim()).filter(Boolean);return{summary:title?.nextElementSibling?.textContent||'',filters:filters?.textContent||'',header,secondary:[...shadow.querySelectorAll('[data-testid="reason-detail-row"]')].map(item=>item.children[3]?.textContent.trim()),rowCount:shadow.querySelectorAll('[data-testid="reason-detail-row"]').length,actions,hasOperation:[...header].includes('操作')}})()`);
  const expectedReasonHeaders=['工单编号','客户投诉时间','投诉原因一级标签','投诉原因二级标签','投诉产品标签','责任机构','受理渠道','所属业务条线','客户类型','工单状态'];
  if(reasonDetailInitial.summary.includes('全行（按处理机构）')||!reasonDetailInitial.summary.includes('明细仅随当前投诉原因一级标签和投诉原因二级标签筛选联动')||reasonDetailInitial.filters.includes('机构范围：')||reasonDetailInitial.filters.includes('客户投诉时间：')||reasonDetailInitial.filters.includes('修正')||!reasonDetailInitial.filters.includes('投诉原因一级标签：贷款')||reasonDetailInitial.filters.includes('投诉原因二级标签：')||JSON.stringify(reasonDetailInitial.header)!==JSON.stringify(expectedReasonHeaders)||reasonDetailInitial.hasOperation||reasonDetailInitial.actions[0]!=='重置交叉筛选'||reasonDetailInitial.actions[1]!=='导出明细'||!['催收','协商还款','贷款利率','个人信息','征信异议'].every(name=>reasonDetailInitial.secondary.includes(name)))throw new Error('原因关联单笔投诉明细结构回归失败：'+JSON.stringify(reasonDetailInitial));
  selectionChecks.reason=await verifySelectableDetails('reason-detail');
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const card=[...shadow.querySelectorAll('h3')].find(node=>node.textContent.includes('关联分布 Top5'))?.closest('article');[...card.querySelectorAll('button')].find(node=>node.textContent.trim()==='条线').click();return true;})()`);await wait(100);
  const reasonRelatedReadonly=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const ranking=shadow.querySelector('[data-testid="reason-related-ranking"]');const filter=shadow.querySelector('[data-testid="reason-detail-filters"]').textContent;const row=shadow.querySelector('[data-testid="reason-detail-row"]');const header=shadow.querySelector('[data-testid="reason-detail-row"]')?.parentElement?.firstElementChild?.firstElementChild;return{buttons:ranking.querySelectorAll('button').length,filter,columns:row?.children.length||0,customerType:row?.children[8]?.textContent.trim()||'',headerWhiteSpace:header?getComputedStyle(header).whiteSpace:''}})()`);
  if(reasonRelatedReadonly.buttons!==0||reasonRelatedReadonly.filter.includes('部门/条线：')||reasonRelatedReadonly.columns!==10||!reasonRelatedReadonly.customerType||reasonRelatedReadonly.headerWhiteSpace!=='nowrap')throw new Error('原因关联视角应为只读且明细应包含客户类型：'+JSON.stringify(reasonRelatedReadonly));
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="reason-detail-reset"]').click();true`);await wait(100);
  const reasonResetFilter=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="reason-detail-filters"]').textContent`);
  if(reasonResetFilter.includes('部门/条线：')||reasonResetFilter.includes('投诉原因二级标签：'))throw new Error('原因交叉筛选重置失败：'+reasonResetFilter);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="reason-detail-row"] button').click();true`);await wait(300);
  const reasonTicketNavigation=await evaluate(`({hash:location.hash,heading:document.querySelector('main h1')?.textContent.trim()||''})`);
  if(reasonTicketNavigation.hash!=='#ticket-detail'||reasonTicketNavigation.heading!=='工单详情')throw new Error('原因工单编号未跳转工单详情：'+JSON.stringify(reasonTicketNavigation));

  await evaluate(`location.hash = 'overview'`);
  await wait(500);
  const homeSummary = await evaluate(`(() => {
    const section = document.querySelector('.statistics-module-host')?.shadowRoot?.querySelector('[data-testid="home-summary-metrics"]');
    const cards = [...(section?.querySelectorAll('[data-testid="home-summary-card"]') || [])];
    return { labels: cards.map(card => card.querySelector('span[title]')?.title),
      icons: cards.filter(card => card.querySelector('svg')).length,
      details: cards.map(card => card.querySelector('.line-clamp-2')?.textContent || ''),
      comparisons: cards.map(card => card.querySelector('.mt-auto')?.textContent || ''),
      text: section?.textContent || '',
      columns: section ? getComputedStyle(section).gridTemplateColumns.split(' ').length : 0 };
  })()`);
  const expectedHomeLabels = ['投诉增长率', '投诉件15日办结率', '监管转办件占比', '监管转办件环比/同比'];
  if (JSON.stringify(homeSummary.labels) !== JSON.stringify(expectedHomeLabels) || homeSummary.icons !== 4 || homeSummary.columns !== 4 || /投诉数据指标|投诉处理指标|每百万|全行（|全部条线|剔除重复投诉/.test(homeSummary.text)) {
    throw new Error('首页四张独立指标卡回归失败：' + JSON.stringify(homeSummary));
  }
  const expectedCountLabels = ['投诉量', '15日办结数量', '监管转办数量'];
  if (expectedCountLabels.some((label,index) => !homeSummary.details[index].startsWith(label+'：') || !/[\d,]+ 件$/.test(homeSummary.details[index])) || homeSummary.comparisons[0] || !/环比.*\d+\.\d%/.test(homeSummary.comparisons[1]) || homeSummary.comparisons[2] || homeSummary.details[3] || homeSummary.comparisons[3]) {
    throw new Error('首页数量说明及环比回归失败：' + JSON.stringify(homeSummary));
  }
  const homeDistributionModules=await evaluate(`(() => {
    const shadow=document.querySelector('.statistics-module-host')?.shadowRoot;
    const article=title=>[...shadow.querySelectorAll('h2')].find(node=>node.textContent.trim()===title)?.closest('article');
    const section=title=>[...shadow.querySelectorAll('h2')].find(node=>node.textContent.trim()===title)?.closest('section');
    const customer=article('客户投诉分布');
    const panels=[...customer.querySelectorAll('h3')].reduce((result,node)=>(result[node.textContent.trim()]=node.parentElement.parentElement,result),{});
    const products=article('产品类型分布');
    const productButtons=[...products.querySelectorAll('.grid.grid-cols-12 button')];
    const branch=shadow.querySelector('#executive-branch-ranking');
    const branchHeader=[...branch.querySelector('.p-5 > .grid').children];
    const line=section('业务条线分布');
    const petition=article('信访机构分布');
    return{
      ages:[...panels['年龄分布'].querySelectorAll('button')].map(node=>node.firstElementChild.textContent.trim()),
      ageBarsColored:[...panels['年龄分布'].querySelectorAll('button i')].every(node=>getComputedStyle(node).backgroundColor!=='rgba(0, 0, 0, 0)'),
      regions:[...panels['地区分布'].querySelectorAll('button')].map(node=>node.lastElementChild.textContent.trim()),
      products:productButtons.map(node=>node.querySelector('span > span[title]')?.textContent.trim()),
      productShares:productButtons.map(node=>Number(node.querySelector(':scope > span:last-child')?.textContent.replace('占比','').replace('%','').trim())),
      productAreas:productButtons.map(node=>[node.style.gridColumn,node.style.gridRow]),
      branchHeaders:branchHeader.filter(node=>getComputedStyle(node).display!=='none').map(node=>node.textContent.trim()),
      conclusionAbsent:!branch.textContent.includes('当前重要结论'),
      branchVisibleCells:[...(branch.querySelectorAll('.p-5 > div')[1]?.querySelector('button')?.children||[])].filter(node=>getComputedStyle(node).display!=='none').length,
      lines:[...line.querySelectorAll('.grid.grid-cols-7 > div')].map(node=>node.firstElementChild.textContent.trim()),
      petitionRows:[...petition.querySelectorAll('.space-y-1 > div')].map(node=>node.children[1]?.textContent.trim()),
      petitionSummary:petition.querySelector('h2 + p')?.textContent||''
    };
  })()`);
  const expectedHomeAges=['18岁以下','18—29岁','30—39岁','40—49岁','50—59岁','60岁及以上','未知'];
  const expectedHomeRegions=['福建省','上海市','广东省','北京市','浙江省','其他国内地区','境外'];
  const expectedHomeProducts=['贷款','存款','财富管理','支付结算','电子银行'];
  if(JSON.stringify(homeDistributionModules.ages)!==JSON.stringify(expectedHomeAges)||!homeDistributionModules.ageBarsColored||JSON.stringify(homeDistributionModules.regions)!==JSON.stringify(expectedHomeRegions)||JSON.stringify(homeDistributionModules.products)!==JSON.stringify(expectedHomeProducts)||Math.abs(homeDistributionModules.productShares.reduce((sum,value)=>sum+value,0)-100)>.01||homeDistributionModules.productAreas.some(area=>!area[0]||!area[1])||!homeDistributionModules.conclusionAbsent||homeDistributionModules.branchHeaders.includes('风险状态')||homeDistributionModules.branchVisibleCells!==6||homeDistributionModules.lines.length!==7||homeDistributionModules.petitionRows.length!==5||homeDistributionModules.petitionSummary.includes('机构范围：全行'))throw new Error('首页分布类卡片结构回归失败：'+JSON.stringify(homeDistributionModules));
  const nationalMap = await evaluate(`(() => {
    const shadow = document.querySelector('.statistics-module-host')?.shadowRoot;
    const nationalSvg = shadow?.querySelector('svg[aria-label="全国重点分行地图"]');
    const provincePaths = nationalSvg?.querySelectorAll('path[data-region]').length || 0;
    const mapFrame=nationalSvg?.closest('.relative');
    const ranking=mapFrame?.previousElementSibling;
    const detailPanel=mapFrame?.nextElementSibling;
    const warningNames=new Set(['珠海分行','福州分行']);
    const labels=[...nationalSvg.querySelectorAll('g')].map(group=>{const texts=group.querySelectorAll('text');return{name:texts[0]?.textContent.trim()||'',detail:texts[1]?.textContent.trim()||'',fill:texts[1]?.getAttribute('fill')||''}}).filter(item=>item.name);
    const rankingRows=[...ranking.querySelectorAll('.mt-2.space-y-1 > button')].map(button=>{const name=button.querySelector('b')?.textContent.trim()||'';const value=button.querySelector('.text-right b');const share=button.querySelector('.text-right small');return{name,value:value?.textContent.trim()||'',share:share?.textContent.trim()||'',valueColor:getComputedStyle(value).color,shareColor:getComputedStyle(share).color}});
    const comparisonRow=[...detailPanel.querySelectorAll('span')].find(node=>node.textContent.trim().endsWith('变化'))?.parentElement;
    const regionButton = Array.from(shadow?.querySelectorAll('main button') || []).find(button => button.textContent.trim() === '地区');
    regionButton?.click();
    return {
      geoFeatures: window.CHINA_GEOJSON?.features?.length || 0,
      hasNationalSvg: Boolean(nationalSvg),
      provincePaths,
      clickedRegion: Boolean(regionButton),
      labelsUseShare:labels.length>0&&labels.every(item=>item.detail.includes('件 · 占比')&&!/环比|同比/.test(item.detail)),
      labelRiskColors:labels.every(item=>item.fill===(warningNames.has(item.name)?'#E11D48':'#059669')),
      rankingUsesShare:rankingRows.length>0&&rankingRows.every(item=>item.share.startsWith('占比 ')&&!/环比|同比/.test(item.share)),
      rankingRiskColors:rankingRows.every(item=>{const expected=warningNames.has(item.name)?'rgb(225, 29, 72)':'rgb(5, 150, 105)';return item.valueColor===expected&&item.shareColor===expected}),
      comparisonHidden:Boolean(comparisonRow)&&getComputedStyle(comparisonRow).display==='none'
    };
  })()`);
  await wait(300);
  nationalMap.hasRegionalSvg = await evaluate(`Boolean(document.querySelector('.statistics-module-host')?.shadowRoot?.querySelector('svg[aria-label="福建省内分行地图"]'))`);

  const selectedHomeSubbranches=['厦门直属支行','厦门湖里支行','厦门嘉禾支行','厦门文园支行','福州仓山支行','福州福清支行','福州鼓楼支行','福州华林支行'];
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="home-org-scope"]').click();true`);await wait(80);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"] [data-clear-organizations]').click();true`);await wait(50);
  for(const branchName of ['厦门分行','福州分行']){
    await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"] [data-org-parent="${branchName}"]').click();true`);await wait(40);
    for(const subbranchName of selectedHomeSubbranches.filter(name=>name.startsWith(branchName.replace('分行','')))){
      await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"] input[aria-label="${subbranchName}"]').click();true`);await wait(30);
    }
  }
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');[...dialog.querySelectorAll('button')].find(node=>node.textContent.trim()==='确认').click();return true})()`);await wait(150);
  const readHomeBranchDistribution=()=>evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const card=shadow.querySelector('#executive-branch-ranking');return[...card.querySelectorAll('.p-5 > div:nth-child(2) > button')].map(row=>row.children[1]?.textContent.trim())})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const ranking=shadow.querySelector('svg[aria-label="全国重点分行地图"]')?.closest('.relative')?.previousElementSibling;[...ranking.querySelectorAll('button')].find(node=>node.querySelector('b')?.textContent.trim()==='厦门分行')?.click();return true})()`);await wait(120);
  const xiamenScopedSubbranches=await readHomeBranchDistribution();
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const ranking=shadow.querySelector('svg[aria-label="福建省内分行地图"], svg[aria-label="全国重点分行地图"]')?.closest('.relative')?.previousElementSibling;[...ranking.querySelectorAll('button')].find(node=>node.querySelector('b')?.textContent.trim()==='福州分行')?.click();return true})()`);await wait(150);
  const fuzhouScopedSubbranches=await readHomeBranchDistribution();
  const expectedXiamenSubbranches=selectedHomeSubbranches.filter(name=>name.startsWith('厦门')).sort();
  const expectedFuzhouSubbranches=selectedHomeSubbranches.filter(name=>name.startsWith('福州')).sort();
  if(JSON.stringify([...xiamenScopedSubbranches].sort())!==JSON.stringify(expectedXiamenSubbranches)||JSON.stringify([...fuzhouScopedSubbranches].sort())!==JSON.stringify(expectedFuzhouSubbranches))throw new Error('首页支行投诉分布未按当前分行拆分所选支行：'+JSON.stringify({xiamenScopedSubbranches,fuzhouScopedSubbranches}));

  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="home-line-scope"]').click();true`);await wait(80);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('input[aria-label="全部条线"]').click();true`);await wait(50);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('input[aria-label="科技运维部"]').click();true`);await wait(50);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-line-confirm]').click();true`);await wait(120);
  const homeScopedLines=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const section=[...shadow.querySelectorAll('h2')].find(node=>node.textContent.trim()==='业务条线分布')?.closest('section');return[...section.querySelectorAll('.grid.grid-cols-7 > div')].map(node=>node.querySelector('span[title]')?.textContent.trim())})()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="home-org-scope"]').click();true`);await wait(80);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const dialog=shadow.querySelector('[data-testid="organization-scope-dialog"]');dialog.querySelector('[data-clear-organizations]').click();dialog.querySelector('[data-org-parent="上海分行"]').click();return true})()`);await wait(60);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"] input[aria-label="上海分行本体"]').click();true`);await wait(60);
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');[...dialog.querySelectorAll('button')].find(node=>node.textContent.trim()==='确认').click();return true})()`);await wait(120);
  const homeScopedPetition=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const article=[...shadow.querySelectorAll('h2')].find(node=>node.textContent.trim()==='信访机构分布')?.closest('article');return{rows:[...article.querySelectorAll('.space-y-1 > div')].map(node=>node.children[1]?.textContent.trim()),summary:article.querySelector('h2 + p')?.textContent||''}})()`);
  if(homeScopedLines.join(',')!=='科技运维部'||homeScopedPetition.rows.join(',')!=='上海分行'||homeScopedPetition.summary.includes('机构范围：上海分行'))throw new Error('首页条线或信访机构筛选联动失败：'+JSON.stringify({homeScopedLines,homeScopedPetition}));

  await evaluate(`(() => { const shadow=document.querySelector('.statistics-module-host').shadowRoot; [...shadow.querySelectorAll('button')].find(node=>node.textContent.trim()==='同比').click(); return true; })()`);
  await wait(100);
  const homeLineNavigation = await evaluate(`(() => { const shadow=document.querySelector('.statistics-module-host').shadowRoot; const arrow=shadow.querySelector('button[aria-label="进入条线分析"]'); const reason=shadow.querySelector('button[aria-label="进入原因分析"]'); const sameStyle=arrow?.className===reason?.className; arrow?.click(); return {exists:Boolean(arrow),sameStyle}; })()`);
  await wait(500);
  const inheritedLineSummary = await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="line-comparison-card"]')?.textContent || ''`);
  if (!homeLineNavigation.exists || !homeLineNavigation.sameStyle || inheritedLineSummary.includes('2026-07-01')) throw new Error('首页条线箭头或查询条件继承失败：'+JSON.stringify({homeLineNavigation,inheritedLineSummary}));

  await evaluate(`location.hash = 'ticket-create'`);
  await wait(500);
  const leftStatistics = await evaluate(`!document.querySelector('.statistics-module-host')`);
  await evaluate(`location.hash = 'stats-complaint-overview'`);
  await wait(500);
  const remountedStatistics = await evaluate(`(() => {
    const host = document.querySelector('.statistics-module-host');
    return Boolean(host?.shadowRoot?.querySelector('main')?.textContent.includes('投诉总览'));
  })()`);

  await evaluate(`location.hash = 'stats-complaint-overview'`);
  await wait(400);
  const interaction = await evaluate(`(() => {
    const shadow = document.querySelector('.statistics-module-host')?.shadowRoot;
    const buttons = Array.from(shadow?.querySelectorAll('button') || []);
    const query = buttons.find(button => button.textContent.trim() === '查询');
    const reset = buttons.find(button => button.textContent.trim() === '重置');
    query?.click();
    reset?.click();
    const info = shadow?.querySelector('button[aria-label*="说明"]');
    info?.click();
    return {
      query: Boolean(query),
      reset: Boolean(reset),
      info: Boolean(info),
      portal: Boolean(shadow?.getElementById('statistics-portal-root'))
    };
  })()`);
  await wait(300);
  interaction.portalContent = await evaluate(`Boolean(document.querySelector('.statistics-module-host')?.shadowRoot?.getElementById('statistics-portal-root')?.textContent.trim())`);

  await evaluate(`location.hash = 'stats-complaint-channel'`);
  await wait(500);
  await evaluate(`(() => {
    const shadow = document.querySelector('.statistics-module-host')?.shadowRoot;
    const root = shadow?.querySelector('#root');
    root.scrollTop = 120;
    root.dispatchEvent(new Event('scroll'));
    return true;
  })()`);
  await wait(200);
  const channelCollapseAfterScroll = await evaluate(`(() => {
    const shadow = document.querySelector('.statistics-module-host')?.shadowRoot;
    const filter = shadow?.querySelector('[data-testid="channel-shared-filters"]');
    return {
      collapsed: Boolean(filter?.querySelector('.xib-embed-filter-grid')?.classList.contains('is-collapsed')),
      rootScrollTop: Math.round(shadow?.querySelector('#root')?.scrollTop || 0)
    };
  })()`);
  const readChannelState = () => evaluate(`(() => {
    const shadow = document.querySelector('.statistics-module-host')?.shadowRoot;
    const card=shadow?.querySelector('[data-testid="channel-distribution-card"]');
    const rows=[...(card?.querySelectorAll('[data-channel-name]')||[])];
    const bars = rows.map(row=>row.querySelector('[data-channel-distribution-bar]'));
    const colors = bars.map(bar => getComputedStyle(bar).backgroundColor);
    const selectedCount = bars.filter(bar => bar.dataset.selected === 'true').length;
    const toggle=card?.querySelector('[data-testid="business-channel-label-level"]');
    return {count:bars.length,names:rows.map(row=>row.dataset.channelName),values:rows.map(row=>Number(row.querySelector('[data-channel-value]')?.textContent.replaceAll(',',''))),changes:rows.map(row=>row.querySelector('[data-channel-change]')?.textContent.trim()),colors,selectedCount,toggleVisible:Boolean(toggle),toggleLabels:[...(toggle?.querySelectorAll('button')||[])].map(node=>node.textContent.trim()),activeLevel:[...(toggle?.querySelectorAll('button')||[])].find(node=>node.className.includes('bg-white'))?.textContent.trim()||''};
  })()`);
  const readChannelRelated = () => evaluate(`(() => {
    const shadow=document.querySelector('.statistics-module-host')?.shadowRoot;
    const section=shadow?.querySelector('[data-testid="channel-related-problems"]');
    const angles=[...(section?.querySelectorAll('[data-related-angle]')||[])].map(angle=>({title:angle.dataset.relatedAngle,names:[...angle.querySelectorAll('[data-related-name]')].map(node=>node.textContent.trim()),values:[...angle.querySelectorAll('[data-related-value]')].map(node=>node.textContent.trim())}));
    const detail=shadow?.querySelector('[data-testid="channel-related-details"]');
    const detailRow=detail?.querySelector('[data-testid="channel-detail-row"]');
    const detailTitle=detail?.querySelector('h3');
    const detailActions=[...detailTitle?.parentElement?.nextElementSibling?.querySelectorAll('button')||[]].map(node=>node.textContent.trim()).filter(Boolean);
    return {title:section?.querySelector('[data-testid="channel-related-title"]')?.textContent.trim()||'',angles,detailHeaders:[...(detail?.querySelector('[data-testid="channel-detail-header"]')?.children||[])].map(node=>node.textContent.trim()),businessChannels:[...(detail?.querySelectorAll('[data-business-channel]')||[])].map(node=>node.textContent.trim()),detailSummary:detailTitle?.nextElementSibling?.textContent||'',detailActions,detailColumns:detailRow?.children.length||0,businessLine:detailRow?.children[7]?.textContent.trim()||'',customerType:detailRow?.children[8]?.textContent.trim()||'',ticketButton:Boolean(detailRow?.querySelector('button')),hasCompletenessMetric:shadow?.textContent.includes('渠道标签完整率')};
  })()`);
  const businessPrimaryChannels = await readChannelState();
  const primaryRelated = await readChannelRelated();
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-channel-name="线上自有渠道"]').click();true`);
  await wait(120);
  const alternatePrimaryRelated = await readChannelRelated();
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-channel-name="大堂渠道"]').click();true`);
  await wait(80);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="business-channel-label-level"] button:nth-child(2)').click();true`);
  await wait(150);
  const businessSecondaryChannels = await readChannelState();
  await evaluate(`(() => {const select=document.querySelector('.statistics-module-host').shadowRoot.querySelector('.xib-embed-caliber select');const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(select,'有效投诉');select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await wait(120);
  const filteredBusinessSecondaryChannels = await readChannelState();
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;[...shadow.querySelectorAll('button')].find(node=>node.textContent.trim()==='投诉受理渠道')?.click();return true})()`);
  await wait(120);
  const intakeChannels = await readChannelState();
  const intakeRelated = await readChannelRelated();
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="channel-org-scope"]').click();true`);
  await wait(100);
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');dialog.querySelector('[data-clear-organizations]').click();dialog.querySelector('[data-org-parent="厦门分行"]').click();return true})()`);
  await wait(60);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"] input[aria-label="厦门分行本体"]').click();true`);
  await wait(60);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"] [data-org-parent="上海分行"]').click();true`);
  await wait(60);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"] input[aria-label="上海分行本体"]').click();true`);
  await wait(60);
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');[...dialog.querySelectorAll('button')].find(node=>node.textContent.trim()==='确认').click();return true})()`);
  await wait(140);
  const selectedOrgRelated = await readChannelRelated();
  const channelCardVisibility = await evaluate(`(() => {
    const shadow = document.querySelector('.statistics-module-host')?.shadowRoot;
    const filter = shadow?.querySelector('[data-testid="channel-shared-filters"]');
    const card = Array.from(shadow?.querySelectorAll('article') || []).find(item => item.textContent.includes('有效投诉量'));
    const filterGrid = filter?.querySelector('.xib-embed-filter-grid');
    const filterRect = filter?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    return {
      collapsed: Boolean(filterGrid?.classList.contains('is-collapsed')),
      rootScrollTop: Math.round(shadow?.querySelector('#root')?.scrollTop || 0),
      collapseButtonLabel: filter?.querySelector('.xib-filter-collapse-btn')?.getAttribute('aria-label') || '',
      filterBottom: Math.round(filterRect?.bottom || 0),
      cardTop: Math.round(cardRect?.top || 0),
      visible: Boolean(filterRect && cardRect && filterRect.bottom <= cardRect.top + 1)
    };
  })()`);

  const expectedChannelColors = new Set(["rgb(34, 114, 222)", "rgb(124, 169, 232)"]);
  const channelHoverCssPresent = fs.readFileSync(path.join(prototypeDir, "statistics-module.css"), "utf8").includes("#root .channel-distribution-bar:hover { background:#4997FF; }");
  const expectedPrimaryChannels='大堂渠道,线上自有渠道,第三方合作渠道,其他,内部管理渠道';
  const expectedSecondaryChannels='柜面业务,手机银行,微信/公众平台,网上银行,厅堂服务,客服电话,在线客服,短信渠道,厅堂自助,维信金科';
  const allowedPrimaryBusinessChannels=new Set(expectedPrimaryChannels.split(','));
  const primarySignature=primaryRelated.angles.map(angle=>`${angle.title}:${angle.names.join(',')}:${angle.values.join(',')}`).join('|');
  const alternateSignature=alternatePrimaryRelated.angles.map(angle=>`${angle.title}:${angle.names.join(',')}:${angle.values.join(',')}`).join('|');
  const defaultInstitution=primaryRelated.angles.find(angle=>angle.title==='责任机构');
  const selectedInstitution=selectedOrgRelated.angles.find(angle=>angle.title==='责任机构');
  const channelExpectedProductNames=['贷款','存款','财富管理','支付结算','电子银行'];
  const channelProducts=primaryRelated.angles.find(angle=>angle.title==='关联产品')?.names||[];
  const expectedChannelDetailHeaders=['工单编号','客户投诉时间','责任机构','产品标签','投诉原因标签','受理渠道','业务办理渠道','所属业务条线','客户类型','工单状态'];
  const channelRelatedValid=!primaryRelated.hasCompletenessMetric&&primaryRelated.title==='大堂渠道关联问题'&&alternatePrimaryRelated.title==='线上自有渠道关联问题'&&primaryRelated.angles.length===5&&primaryRelated.angles.every(angle=>angle.names.length===5&&angle.values.length===5)&&channelProducts.slice().sort().join(',')===channelExpectedProductNames.slice().sort().join(',')&&primarySignature!==alternateSignature&&defaultInstitution?.names.length===5&&selectedInstitution?.names.length===2&&selectedInstitution.names.every(name=>['厦门分行','上海分行'].includes(name))&&JSON.stringify(intakeRelated.detailHeaders)===JSON.stringify(expectedChannelDetailHeaders)&&intakeRelated.businessChannels.every(name=>allowedPrimaryBusinessChannels.has(name))&&!intakeRelated.detailSummary.includes('全行（按处理机构）')&&intakeRelated.detailActions[0]==='重置交叉筛选'&&intakeRelated.detailActions[1]==='导出明细'&&intakeRelated.detailColumns===10&&Boolean(intakeRelated.businessLine)&&Boolean(intakeRelated.customerType)&&intakeRelated.ticketButton;
  const channelBarsValid = channelHoverCssPresent&&businessPrimaryChannels.count===5&&businessPrimaryChannels.names.join(',')===expectedPrimaryChannels&&businessPrimaryChannels.toggleVisible&&businessPrimaryChannels.toggleLabels.join(',')==='一级标签,二级标签'&&businessPrimaryChannels.activeLevel==='一级标签'&&businessSecondaryChannels.count===10&&businessSecondaryChannels.names.join(',')===expectedSecondaryChannels&&businessSecondaryChannels.activeLevel==='二级标签'&&businessSecondaryChannels.values.every((value,index,values)=>index===0||values[index-1]>=value)&&filteredBusinessSecondaryChannels.values[0]<businessSecondaryChannels.values[0]&&filteredBusinessSecondaryChannels.changes[0]!==businessSecondaryChannels.changes[0]&&intakeChannels.count>=7&&!intakeChannels.toggleVisible&&[businessPrimaryChannels,businessSecondaryChannels,filteredBusinessSecondaryChannels,intakeChannels].every(result=>result.selectedCount===1&&result.colors.every(color=>expectedChannelColors.has(color)))&&channelRelatedValid;
  selectionChecks.channel=await verifySelectableDetails('channel-detail');
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="channel-detail-row"] button').click();true`);await wait(300);
  const channelTicketNavigation=await evaluate(`({hash:location.hash,heading:document.querySelector('main h1')?.textContent.trim()||''})`);
  if(channelTicketNavigation.hash!=='#ticket-detail'||channelTicketNavigation.heading!=='工单详情')throw new Error('渠道工单编号未跳转工单详情：'+JSON.stringify(channelTicketNavigation));
  await evaluate(`location.hash='stats-complaint-overview'; true`);
  await wait(500);
  const unifiedScopeBase = await evaluate(`(() => {
    const shadow=document.querySelector('.statistics-module-host')?.shadowRoot;
    const org=shadow?.querySelector('button[data-testid="overview-org-scope"]');
    const line=shadow?.querySelector('button[data-testid="overview-line-scope"]');
    return {orgExists:Boolean(org),orgText:org?.textContent.trim()||'',lineExists:Boolean(line),lineText:line?.textContent.trim()||''};
  })()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="overview-org-scope"]').click();true`);
  await wait(120);
  const unifiedScopeDialog = await evaluate(`(() => {
    const shadow=document.querySelector('.statistics-module-host').shadowRoot;
    const dialog=shadow.querySelector('[data-testid="organization-scope-dialog"]');
    const dimension=dialog.querySelector('[data-testid="overview-org-dimension"]');
    return {exists:Boolean(dialog),quick:[...dialog.querySelectorAll('[data-quick-scope]')].map(node=>node.textContent.trim()),firstLevels:[...dialog.querySelectorAll('[data-org-parent]')].map(node=>node.dataset.orgParent),selected:[...dialog.querySelectorAll('button[aria-label^="移除"]')].map(node=>node.getAttribute('aria-label').replace('移除','')),dimensionLabels:[...dimension.querySelectorAll('button')].map(node=>node.textContent.trim()),dimensionActive:[...dimension.querySelectorAll('button')].find(node=>node.className.includes('bg-white'))?.textContent.trim()||''};
  })()`);
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');[...dialog.querySelectorAll('[data-testid="overview-org-dimension"] button')].find(node=>node.textContent.trim()==='投诉机构').click();return true})()`);await wait(60);
  const overviewDimensionAfterSwitch=await evaluate(`(() => {const dimension=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="overview-org-dimension"]');return[...dimension.querySelectorAll('button')].find(node=>node.className.includes('bg-white'))?.textContent.trim()||''})()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-clear-organizations]').click();true`);await wait(60);
  const clearedSelection=await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');const confirm=[...dialog.querySelectorAll('button')].find(node=>node.textContent.trim()==='确认');return{remaining:dialog.querySelectorAll('button[aria-label^="移除"]').length,confirmDisabled:Boolean(confirm?.disabled),clearDisabled:Boolean(dialog.querySelector('[data-clear-organizations]')?.disabled)}})()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-quick-scope="全行"]').click();true`);await wait(60);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[aria-label="移除上海分行"]').click();true`);await wait(60);
  const removableSelection=await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');return{removed:!dialog.querySelector('button[aria-label="移除上海分行"]'),remaining:dialog.querySelectorAll('button[aria-label^="移除"]').length}})()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-quick-scope="全行"]').click();true`);await wait(60);
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');dialog.querySelector('[data-org-parent="北京分行"]').click();return true})()`);await wait(60);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('input[aria-label="北京分行及其所有下辖"]').click();true`);await wait(60);
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');[...dialog.querySelectorAll('button')].find(node=>node.textContent.trim()==='确认').click();return true})()`);
  await wait(100);
  const branchGroupText=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="overview-org-scope"]').textContent.trim()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="overview-org-scope"]').click();true`);await wait(80);
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');dialog.querySelector('[data-org-parent="北京分行"]').click();return true})()`);await wait(60);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('input[aria-label="北京分行及其所有下辖"]').click();true`);await wait(60);
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');[...dialog.querySelectorAll('button')].find(node=>node.textContent.trim()==='确认').click();return true})()`);await wait(80);
  const branchSelfText=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="overview-org-scope"]').textContent.trim()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="overview-org-scope"]').click();true`);await wait(80);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-quick-scope="五大分行及其下辖"]').click();true`);await wait(60);
  await evaluate(`(() => {const dialog=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="organization-scope-dialog"]');[...dialog.querySelectorAll('button')].find(node=>node.textContent.trim()==='确认').click();return true})()`);await wait(80);
  const shortcutText=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="overview-org-scope"]').textContent.trim()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="overview-line-scope"]').click();true`);await wait(80);
  const lineDefault=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const all=shadow.querySelector('input[aria-label="全部条线"]');const options=[...all.closest('.absolute').querySelectorAll('input[type="checkbox"]')].filter(node=>node!==all);return{allChecked:all.checked,optionCount:options.length}})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;shadow.querySelector('input[aria-label="全部条线"]').click();return true})()`);await wait(50);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('input[aria-label="零售金融部"]').click();true`);await wait(50);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-line-confirm]').click();true`);await wait(80);
  const lineSingleText=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="overview-line-scope"]').textContent.trim()`);
  const scopedKeyDistribution=await evaluate(`(() => {
    const shadow=document.querySelector('.statistics-module-host').shadowRoot;
    const section=shadow.querySelector('[data-testid="overview-key-distribution-rows"]');
    const read=()=>[...section.querySelectorAll('[data-distribution-name]')].map(row=>({name:row.dataset.distributionName,value:Number(row.textContent.match(/[\\d,]+件/)?.[0].replace(/[,件]/g,'')||0)}));
    const viewButton=label=>[...section.closest('section').querySelectorAll('button')].find(node=>node.textContent.trim()===label);
    const institutions=read();
    viewButton('产品').click();
    return new Promise(resolve=>setTimeout(()=>{const products=read();viewButton('条线').click();setTimeout(()=>{const lines=read();viewButton('客户').click();setTimeout(()=>resolve({institutions,products,lines,customers:read()}),80)},80)},80));
  })()`);
  const descending=rows=>rows.every((row,index)=>index===0||rows[index-1].value>=row.value);
  const expectedProductNames=['贷款','存款','财富管理','支付结算','电子银行'];
  const expectedCustomerNames=['无风险客户','高龄老人','超高龄老人','未成年','重要客户','新市民'];
  if(scopedKeyDistribution.institutions.length>5||!descending(scopedKeyDistribution.institutions)||scopedKeyDistribution.products.map(row=>row.name).join(',')!==expectedProductNames.join(',')||!descending(scopedKeyDistribution.products)||scopedKeyDistribution.lines.length!==1||scopedKeyDistribution.lines[0].name!=='零售金融部'||!descending(scopedKeyDistribution.lines)||scopedKeyDistribution.customers.map(row=>row.name).join(',')!==expectedCustomerNames.join(',')||!descending(scopedKeyDistribution.customers))throw new Error('重点分布的机构、产品、条线或客户视角回归失败：'+JSON.stringify(scopedKeyDistribution));
  const appSource=fs.readFileSync(path.join(prototypeDir,'app.js'),'utf8');
  const workOrderScope={renamed:!appSource.includes('label: "相关机构"')&&appSource.includes('label: "工单接收机构"'),hasDescendantCheckbox:appSource.includes('data-hierarchy-descendants'),hasSingleSelection:appSource.includes('selected = [descendants.checked ? groupValue : selfValue]')};
  const unifiedScope={base:unifiedScopeBase,dialog:unifiedScopeDialog,overviewDimensionAfterSwitch,clearedSelection,removableSelection,branchGroupText,branchSelfText,shortcutText,lineDefault,lineSingleText,workOrderScope};

  const setStatisticsDate=(pageKey,value)=>evaluate(`(() => {const input=document.querySelector('.statistics-module-host').shadowRoot.querySelector('input[aria-label="${pageKey}"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'${value}');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return input.value})()`);
  await evaluate(`location.hash='stats-complaint-institution';true`);await wait(500);
  const institutionDefaultCharts=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const branches=${JSON.stringify(['厦门分行','上海分行','福州分行','北京分行','宁德分行','龙岩分行','漳州分行','莆田分行','三明分行','珠海分行','泉州分行','南平分行'])};const names=id=>branches.filter(name=>shadow.querySelector('[data-testid="institution2-'+id+'"]')?.textContent.includes(name));return{trend:names('trend'),pressure:names('pressure'),regulatory:names('regulatory'),efficiency:names('efficiency'),quality:names('quality')}})()`);
  await setStatisticsDate('institution开始日期','2024-01-01');
  await setStatisticsDate('institution结束日期','2026-07-15');
  await wait(180);
  const institutionLongRange=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;return{buttons:[...shadow.querySelector('[data-testid="institution-trend-granularity"]').querySelectorAll('button')].map(node=>node.textContent.trim()),axis:shadow.querySelector('svg[aria-label="机构投诉变化趋势折线图"]')?.textContent||''}})()`);
  await evaluate(`(() => {const svg=document.querySelector('.statistics-module-host').shadowRoot.querySelector('svg[aria-label="机构投诉变化趋势折线图"]');const box=svg.getBoundingClientRect();svg.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:box.left+box.width*.48,clientY:box.top+box.height*.45}));return true})()`);await wait(80);
  institutionLongRange.tooltip=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="institution-trend-tooltip"]')?.textContent||''`);
  await evaluate(`location.hash='stats-petition';true`);await wait(500);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="petition-org-scope"]').click();true`);await wait(100);
  const petitionOrgDimension=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const dialog=shadow.querySelector('[data-testid="organization-scope-dialog"]');const control=dialog.querySelector('[data-testid="petition-org-dimension"]');const labels=[...control.querySelectorAll('button')].map(node=>node.textContent.trim());[...control.querySelectorAll('button')].find(node=>node.textContent.trim()==='信访机构').click();return{labels}})()`);await wait(80);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const dialog=shadow.querySelector('[data-testid="organization-scope-dialog"]');[...dialog.querySelectorAll('button')].find(node=>node.textContent.trim()==='取消').click();return true})()`);await wait(100);
  petitionOrgDimension.contextUpdated=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.textContent.includes('机构字段：信访机构')`);
  const petitionRelatedSection=`[...document.querySelector('.statistics-module-host').shadowRoot.querySelectorAll('section')].find(node=>node.querySelector('h2')?.textContent.trim()==='信访关联分布')`;
  const readPetitionRanking=()=>evaluate(`(() => {const section=${petitionRelatedSection};const ranking=section.querySelector('[data-testid="petition-related-ranking"]');const rows=[...ranking.children].filter(node=>node.children.length===5);const pagination=ranking.querySelector('[data-testid="petition-related-pagination"]');return{names:rows.map(row=>row.children[1].textContent.trim()),ranks:rows.map(row=>row.children[0].textContent.trim()),pageButtons:pagination?[...pagination.querySelectorAll('button[aria-label^="信访关联分布第"]')].length:0,note:pagination?.previousElementSibling?.textContent.trim()||''}})()`);
  await evaluate(`(() => {const section=${petitionRelatedSection};[...section.querySelectorAll('button')].find(node=>node.textContent.trim()==='产品').click();return true})()`);await wait(80);
  const petitionProducts=await readPetitionRanking();
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[aria-label="信访关联分布第2页"]').click();true`);await wait(80);
  petitionProducts.secondPage=await readPetitionRanking();
  await evaluate(`(() => {const section=${petitionRelatedSection};[...section.querySelectorAll('button')].find(node=>node.textContent.trim()==='渠道').click();return true})()`);await wait(80);
  const petitionChannels=await readPetitionRanking();
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[aria-label="信访关联分布第2页"]').click();true`);await wait(80);
  petitionChannels.secondPage=await readPetitionRanking();
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="petition-line-scope"]').click();true`);await wait(80);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;shadow.querySelector('input[aria-label="全部条线"]').click();shadow.querySelector('input[aria-label="风险管理部"]').click();shadow.querySelector('input[aria-label="科技运维部"]').click();shadow.querySelector('[data-line-confirm]').click();return true})()`);await wait(100);
  await evaluate(`(() => {const section=${petitionRelatedSection};[...section.querySelectorAll('button')].find(node=>node.textContent.trim()==='条线').click();return true})()`);await wait(80);
  const petitionLines=await readPetitionRanking();
  await evaluate(`(() => {const section=${petitionRelatedSection};[...section.querySelectorAll('button')].find(node=>node.textContent.trim()==='客户').click();return true})()`);await wait(80);
  const petitionCustomers=await readPetitionRanking();
  const expectedPetitionProductFirstPage=['度小满','京东','乐信','美团','数禾','字节跳动','拍拍贷','维信金科','小米','马上消费'];
  const expectedPetitionCustomers=['30—39岁','40—49岁','50—59岁','18—29岁','60岁及以上','18岁以下','未知'];
  const petitionChannelNames=[...petitionChannels.names,...petitionChannels.secondPage.names];
  const petitionRelatedViewsValid=JSON.stringify(petitionProducts.names)===JSON.stringify(expectedPetitionProductFirstPage)&&petitionProducts.pageButtons===7&&petitionProducts.names.length===10&&petitionProducts.secondPage.names.length===10&&petitionProducts.secondPage.ranks[0]==='11'&&petitionChannels.pageButtons===2&&petitionChannels.names.length===10&&petitionChannels.secondPage.names.length===4&&petitionChannels.secondPage.ranks[0]==='11'&&new Set(petitionChannelNames).size===petitionChannelNames.length&&JSON.stringify(petitionLines.names)===JSON.stringify(['风险管理部','科技运维部'])&&petitionLines.pageButtons===0&&JSON.stringify(petitionCustomers.names)===JSON.stringify(expectedPetitionCustomers)&&petitionCustomers.pageButtons===0;
  if(!petitionRelatedViewsValid)throw new Error('信访产品/渠道分页、条线筛选或客户类型回归失败：'+JSON.stringify({petitionProducts,petitionChannels,petitionLines,petitionCustomers}));
  const petitionDetail=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const table=shadow.querySelector('[data-testid="petition-detail-table"]');const title=[...shadow.querySelectorAll('h3')].find(node=>node.textContent.trim()==='关联信访明细');const ranking=shadow.querySelector('[data-testid="petition-related-ranking"]');const relatedSection=[...shadow.querySelectorAll('section')].find(node=>node.querySelector('h2')?.textContent.trim()==='信访关联分布');const filterPanel=shadow.querySelector('[data-testid="petition-shared-filters"]');const headerNodes=[...table.querySelectorAll('thead th')];const firstRect=headerNodes[0].getBoundingClientRect();const secondRect=headerNodes[1].getBoundingClientRect();return{headers:headerNodes.map(node=>node.textContent.trim()),headerWidths:headerNodes.map(node=>Math.round(node.getBoundingClientRect().width)),firstTwoSeparated:firstRect.right<=secondRect.left+1,summary:title?.nextElementSibling?.textContent||'',actions:[...title?.parentElement?.nextElementSibling?.querySelectorAll('button')||[]].map(node=>node.textContent.trim()).filter(Boolean),rankingButtons:ranking.querySelectorAll('button').length,filters:shadow.querySelector('[data-testid="petition-detail-filters"]')?.textContent||'',removedFilters:['投诉渠道','投诉口径','剔除规则'].every(label=>!filterPanel.textContent.includes(label)),noCurrentObject:!relatedSection.textContent.includes('当前关联对象'),fullWidth:ranking.getBoundingClientRect().width/relatedSection.getBoundingClientRect().width>.9,ticketButton:Boolean(table.querySelector('tbody button'))}})()`);
  const expectedPetitionHeaders=['信访工单编号','客户信访时间','信访机构','产品二级标签','信访原因标签','受理渠道','所属业务条线','客户类型','处理状态','是否超期'];
  if(JSON.stringify(petitionDetail.headers)!==JSON.stringify(expectedPetitionHeaders)||!petitionDetail.firstTwoSeparated||petitionDetail.headerWidths[0]!==250||petitionDetail.headerWidths[1]!==140||!petitionDetail.summary.includes('明细仅随日期、机构范围和条线范围联动')||!petitionDetail.summary.includes('Top5 仅供查看')||petitionDetail.actions[0]!=='重置交叉筛选'||petitionDetail.actions[1]!=='导出明细'||petitionDetail.rankingButtons!==0||!petitionDetail.filters.includes('统计机构：')||!petitionDetail.filters.includes('条线范围：')||!petitionDetail.removedFilters||!petitionDetail.noCurrentObject||!petitionDetail.fullWidth||!petitionDetail.ticketButton)throw new Error('信访筛选移除、关联分布或明细回归失败：'+JSON.stringify(petitionDetail));
  selectionChecks.petition=await verifySelectableDetails('petition-detail');
  await evaluate(`location.hash='stats-complaint-overview';true`);await wait(500);
  await setStatisticsDate('投诉总览开始日期','2024-01-01');
  await setStatisticsDate('投诉总览结束日期','2026-07-15');
  await wait(180);
  const overviewLongRange=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;return{buttons:[...shadow.querySelector('[data-testid="overview-trend-granularity"]').querySelectorAll('button')].map(node=>node.textContent.trim()),axis:shadow.querySelector('svg[aria-label="按监管投诉和自收投诉展示的渠道趋势图"]')?.textContent||''}})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const svg=shadow.querySelector('svg[aria-label="按监管投诉和自收投诉展示的渠道趋势图"]');svg.querySelector('circle.cursor-pointer').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));return true})()`);await wait(80);
  overviewLongRange.tooltip=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="overview-trend-tooltip"]')?.textContent||''`);
  const rectificationStages=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;return{summary:shadow.querySelector('[data-testid="rectification-stage-summary"]')?.textContent||'',rows:[...shadow.querySelectorAll('[data-testid="rectification-list"] > div')].map(row=>row.lastElementChild?.textContent.trim()||'')}})()`);
  selectionChecks.rectification=await verifySelectableDetails('rectification');
  await evaluate(`location.hash='stats-complaint-line';true`);await wait(500);
  const lineDefaultPage=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const card=shadow.querySelector('[data-testid="line-comparison-card"]');return{names:[...card.querySelectorAll('[data-line-name]')].map(node=>node.dataset.lineName),pageCount:card.querySelectorAll('[aria-label^="条线对比第"]').length,footer:card.textContent}})()`);
  const lineRelatedProducts=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const ranking=shadow.querySelector('[data-testid="line-related-ranking"]');return[...ranking.children].map(row=>row.children[0]?.children[1]?.textContent.trim()||'')})()`);
  const lineDetailInitial=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const row=shadow.querySelector('[data-testid="line-detail-row"]');const title=[...shadow.querySelectorAll('h3')].find(node=>node.textContent.trim()==='关联单笔投诉明细');return{headers:[...shadow.querySelector('[data-testid="line-detail-header"]').children].map(node=>node.textContent.trim()),relatedButtons:shadow.querySelector('[data-testid="line-related-ranking"]').querySelectorAll('button').length,filters:shadow.querySelector('[data-testid="line-detail-filters"]').textContent,summary:title?.nextElementSibling?.textContent||'',actions:[...title?.parentElement?.nextElementSibling?.querySelectorAll('button')||[]].map(node=>node.textContent.trim()).filter(Boolean),columns:row?.children.length||0,customerType:row?.children[7]?.textContent.trim()||'',ticketButton:Boolean(row?.querySelector('button'))}})()`);
  const expectedLineHeaders=['工单编号','客户投诉时间','所属业务条线','产品一级标签','投诉原因一级标签','责任机构','受理渠道','客户类型','工单状态'];
  if(JSON.stringify(lineDetailInitial.headers)!==JSON.stringify(expectedLineHeaders)||lineDetailInitial.relatedButtons!==0||!lineDetailInitial.filters.includes('所属业务条线：零售金融部')||lineDetailInitial.summary.includes('全行（按处理机构）')||lineDetailInitial.actions[0]!=='重置交叉筛选'||lineDetailInitial.actions[1]!=='导出明细'||lineDetailInitial.columns!==9||!lineDetailInitial.customerType||!lineDetailInitial.ticketButton)throw new Error('条线明细只读关联视角或列结构回归失败：'+JSON.stringify(lineDetailInitial));
  selectionChecks.line=await verifySelectableDetails('line-detail');
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;shadow.querySelector('[data-line-name="普惠金融部"]').click();return true})()`);await wait(80);
  const selectedLineDetail=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="line-detail-filters"]').textContent`);
  if(!selectedLineDetail.includes('所属业务条线：普惠金融部'))throw new Error('条线对比选中项未联动明细：'+selectedLineDetail);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[aria-label="条线对比第2页"]').click();true`);await wait(80);
  const lineSecondPage=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;return[...shadow.querySelectorAll('[data-testid="line-comparison-list"] [data-line-name]')].map(node=>node.dataset.lineName)})()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('button[data-testid="line-line-scope"]').click();true`);await wait(80);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;shadow.querySelector('input[aria-label="全部条线"]').click();return true})()`);await wait(50);
  for(const name of ['零售金融部','科技运维部','安全保卫部/总务部']){
    await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('input[aria-label="${name}"]').click();true`);
    await wait(30);
  }
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-line-confirm]').click();true`);await wait(120);
  const lineFilteredPage=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const card=shadow.querySelector('[data-testid="line-comparison-card"]');return{names:[...card.querySelectorAll('[data-line-name]')].map(node=>node.dataset.lineName),pageCount:card.querySelectorAll('[aria-label^="条线对比第"]').length,summary:card.querySelector('p')?.textContent||'',selectedLine:shadow.querySelector('section h3')?.textContent||''}})()`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="line-detail-row"] button').click();true`);await wait(300);
  const lineTicketNavigation=await evaluate(`({hash:location.hash,heading:document.querySelector('main h1')?.textContent.trim()||''})`);
  if(lineTicketNavigation.hash!=='#ticket-detail'||lineTicketNavigation.heading!=='工单详情')throw new Error('条线工单编号未跳转工单详情：'+JSON.stringify(lineTicketNavigation));
  await evaluate(`location.hash='stats-complaint-customer';true`);await wait(500);
  const customerComposition=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const section=shadow.querySelector('[data-testid="customer-composition"]');const riskArticle=[...section.querySelectorAll('article')].find(node=>node.querySelector('h3')?.textContent.trim()==='风险客户类型');const ageArticle=section.querySelector('[data-customer-dimension="年龄"]');return{exists:Boolean(section),dimensions:[...section.querySelectorAll('article h3')].map(node=>node.textContent.trim()),ages:[...ageArticle.querySelectorAll('button')].map(node=>node.querySelector('span')?.textContent.trim()||''),riskTypes:riskArticle?[...riskArticle.querySelectorAll('button')].map(node=>node.querySelector('span')?.textContent.trim()||''):[],hasZodiac:section?.textContent.includes('星座')||false}})()`);
  const domesticBefore=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const article=shadow.querySelector('[data-customer-dimension="境内外"]');return[...article.querySelectorAll('button')].map(node=>node.textContent.trim())})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const article=shadow.querySelector('[data-customer-dimension="境内外"]');[...article.querySelectorAll('button')].find(node=>node.textContent.includes('境内客户')).click();return true})()`);await wait(80);
  const domesticRegionState=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const region=shadow.querySelector('[data-customer-dimension="地区"]');const domestic=shadow.querySelector('[data-customer-dimension="境内外"]');return{regionVisible:Boolean(region),regionNames:[...region?.querySelectorAll('button')||[]].map(node=>node.querySelector('span:last-child')?.textContent.trim()||''),domesticRows:[...domestic.querySelectorAll('button')].map(node=>node.textContent.trim())}})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const region=shadow.querySelector('[data-customer-dimension="地区"]');[...region.querySelectorAll('button')].find(node=>node.textContent.includes('其他国内地区')).click();return true})()`);await wait(80);
  const regionSelectionState=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const domestic=shadow.querySelector('[data-customer-dimension="境内外"]');return{domesticRows:[...domestic.querySelectorAll('button')].map(node=>node.textContent.trim()),footer:shadow.querySelector('[data-testid="customer-composition"]')?.lastElementChild?.textContent||''}})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const region=shadow.querySelector('[data-customer-dimension="地区"]');[...region.querySelectorAll('button')].find(node=>node.textContent.includes('其他国内地区')).click();return true})()`);await wait(50);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const domestic=shadow.querySelector('[data-customer-dimension="境内外"]');[...domestic.querySelectorAll('button')].find(node=>node.textContent.includes('境内客户')).click();return true})()`);await wait(50);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const domestic=shadow.querySelector('[data-customer-dimension="境内外"]');[...domestic.querySelectorAll('button')].find(node=>node.textContent.includes('境外客户')).click();return true})()`);await wait(80);
  const foreignRegionState=await evaluate(`(() => {const region=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-customer-dimension="地区"]');const buttons=[...region.querySelectorAll('button')];return{visible:Boolean(region),names:buttons.map(node=>node.querySelector('span:last-child')?.textContent.trim()||''),shares:buttons.map(node=>node.querySelector('b')?.textContent.trim()||''),heights:buttons.map(node=>node.querySelector('span[style]')?.style.height||''),colors:buttons.map(node=>node.querySelector('span[style]')?.style.background||'')}})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const domestic=shadow.querySelector('[data-customer-dimension="境内外"]');[...domestic.querySelectorAll('button')].find(node=>node.textContent.includes('境外客户')).click();return true})()`);await wait(50);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const domestic=shadow.querySelector('[data-customer-dimension="境内外"]');[...domestic.querySelectorAll('button')].find(node=>node.textContent.includes('未知')).click();return true})()`);await wait(80);
  const unknownRegionState=await evaluate(`(() => {const region=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-customer-dimension="地区"]');const buttons=[...region.querySelectorAll('button')];return{visible:Boolean(region),names:buttons.map(node=>node.querySelector('span:last-child')?.textContent.trim()||''),shares:buttons.map(node=>node.querySelector('b')?.textContent.trim()||''),heights:buttons.map(node=>node.querySelector('span[style]')?.style.height||''),colors:buttons.map(node=>node.querySelector('span[style]')?.style.background||'')}})()`);
  const expectedCustomerRegions=['福建省','上海市','广东省','北京市','浙江省','其他国内地区'];
  const unavailableRegionValid=state=>state.visible&&JSON.stringify(state.names)===JSON.stringify(expectedCustomerRegions)&&state.shares.every(value=>value==='0%')&&state.heights.every(value=>value==='20px')&&state.colors.every(value=>value==='rgb(203, 213, 225)');
  const customerGeography={domesticRegionState,regionSelectionState,foreignRegionState,unknownRegionState};
  if(!domesticRegionState.regionVisible||JSON.stringify(domesticRegionState.regionNames)!==JSON.stringify(expectedCustomerRegions)||JSON.stringify(domesticRegionState.domesticRows)!==JSON.stringify(domesticBefore)||JSON.stringify(regionSelectionState.domesticRows)!==JSON.stringify(domesticBefore)||!regionSelectionState.footer.includes('境内外＝境内客户｜地区＝其他国内地区')||!unavailableRegionValid(foreignRegionState)||!unavailableRegionValid(unknownRegionState))throw new Error('客户地区与境内外联动回归失败：'+JSON.stringify(customerGeography));
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="customer-detail-reset"]').click();true`);await wait(80);
  const customerRelatedProducts=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const ranking=shadow.querySelector('[data-testid="customer-related-ranking"]');return[...ranking.children].map(row=>row.children[1]?.textContent.trim()||'')})()`);
  const customerDetailBefore=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const table=shadow.querySelector('[data-testid="customer-detail-table"]');const title=[...shadow.querySelectorAll('h3')].find(node=>node.textContent.trim()==='关联单笔投诉明细');const ranking=shadow.querySelector('[data-testid="customer-related-ranking"]');const headerNodes=[...table.querySelectorAll('thead th')];const firstRect=headerNodes[0].getBoundingClientRect();const secondRect=headerNodes[1].getBoundingClientRect();return{headers:headerNodes.map(node=>node.textContent.trim()),headerWidths:headerNodes.map(node=>Math.round(node.getBoundingClientRect().width)),firstTwoSeparated:firstRect.right<=secondRect.left+1,rowIds:[...table.querySelectorAll('[data-testid="customer-detail-row"]')].map(row=>row.querySelector('button')?.textContent.trim()||''),summary:title?.nextElementSibling?.textContent||'',actions:[...title?.parentElement?.nextElementSibling?.querySelectorAll('button')||[]].map(node=>node.textContent.trim()).filter(Boolean),filters:shadow.querySelector('[data-testid="customer-detail-filters"]')?.textContent||'',rankingButtons:ranking.querySelectorAll('button').length,ticketButton:Boolean(table.querySelector('tbody button'))}})()`);
  const expectedCustomerHeaders=['工单编号','客户投诉时间','客户编号','客户类型','年龄','性别','境内外/地区','风险类型','产品标签','投诉原因标签','责任机构','受理渠道','所属业务条线','工单状态'];
  if(JSON.stringify(customerDetailBefore.headers)!==JSON.stringify(expectedCustomerHeaders)||customerDetailBefore.headers.includes('星座')||!customerDetailBefore.firstTwoSeparated||customerDetailBefore.headerWidths[0]!==230||customerDetailBefore.headerWidths[1]!==140||customerDetailBefore.headerWidths.slice(2,6).some(width=>width!==customerDetailBefore.headerWidths[2]||width>110)||!customerDetailBefore.summary.includes('六个维度筛选联动')||!customerDetailBefore.summary.includes('关联分布 Top5 仅供查看')||customerDetailBefore.actions[0]!=='重置交叉筛选'||customerDetailBefore.actions[1]!=='导出明细'||!customerDetailBefore.filters.includes('客户维度：全部')||customerDetailBefore.rankingButtons!==0||!customerDetailBefore.ticketButton)throw new Error('客户关联明细字段、列宽、操作区或只读联动回归失败：'+JSON.stringify(customerDetailBefore));
  selectionChecks.customer=await verifySelectableDetails('customer-detail');
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const section=[...shadow.querySelectorAll('section')].find(node=>node.querySelector('h3')?.textContent.includes('关联分布 Top5'));[...section.querySelectorAll('button')].find(node=>node.textContent.trim()==='原因').click();return true})()`);await wait(80);
  const customerDetailAfterView=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;return{rowIds:[...shadow.querySelectorAll('[data-testid="customer-detail-row"]')].map(row=>row.querySelector('button')?.textContent.trim()||''),filters:shadow.querySelector('[data-testid="customer-detail-filters"]')?.textContent||''}})()`);
  if(JSON.stringify(customerDetailAfterView.rowIds)!==JSON.stringify(customerDetailBefore.rowIds)||customerDetailAfterView.filters!==customerDetailBefore.filters)throw new Error('客户关联 Top5 视角不应影响明细：'+JSON.stringify({customerDetailBefore,customerDetailAfterView}));
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="customer-detail-table"] tbody button').click();true`);await wait(300);
  const customerTicketNavigation=await evaluate(`({hash:location.hash,heading:document.querySelector('main h1')?.textContent.trim()||''})`);
  if(customerTicketNavigation.hash!=='#ticket-detail'||customerTicketNavigation.heading!=='工单详情')throw new Error('客户工单编号未跳转工单详情：'+JSON.stringify(customerTicketNavigation));

  await evaluate(`location.hash='report-center';true`);await wait(500);
  const openReportConfig=async type=>{await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const card=[...shadow.querySelectorAll('article')].find(node=>node.querySelector('b')?.textContent.trim()==='${type}');[...card.querySelectorAll('button')].find(node=>node.textContent.trim()==='维护配置').click();return true})()`);await wait(120);};
  const readReportAnalysis=()=>evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const section=shadow.querySelector('[data-testid="report-analysis-dimensions"]');const library=shadow.querySelector('[data-testid="report-scale-metrics"]')?.closest('section');const heading=shadow.querySelector('h1');const exclusionTop=[...shadow.querySelectorAll('div')].find(node=>node.textContent.trim()==='数据剔除规则')?.getBoundingClientRect().top;return{title:heading?.textContent.trim()||'',libraryTitle:library?.querySelector('h2')?.textContent.trim()||'',sectionCount:heading?.closest('section')?.parentElement?.querySelectorAll(':scope > section').length||0,items:[...section?.querySelectorAll('button')||[]].map(node=>({label:[...node.querySelectorAll('span')].find(span=>span.textContent.trim().endsWith('维度'))?.textContent.trim()||'',checked:node.getAttribute('aria-checked')==='true',disabled:node.disabled})),hasAnalysisDimensions:Boolean(section),hasGenerationConfig:shadow.textContent.includes('生成配置'),hasOrgScope:shadow.textContent.includes('适用机构范围'),metricDateControls:library?.querySelectorAll('input[type="date"],.xib-embed-date').length||0,belowExclusions:section?section.getBoundingClientRect().top>exclusionTop:true}})()`);
  const verifyScaleMetricRadio=async()=>{
    const read=()=>evaluate(`(() => {const group=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="report-scale-metrics"]');return{labels:[...group.querySelectorAll('[role="radio"]')].map(node=>node.textContent.trim()),selected:[...group.querySelectorAll('[role="radio"][aria-checked="true"]')].map(node=>node.textContent.trim())}})()`);
    const initial=await read();
    await evaluate(`(() => {const group=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="report-scale-metrics"]');[...group.querySelectorAll('[role="radio"]')].find(node=>node.textContent.includes('有效投诉量')).click();return true})()`);await wait(40);
    const effective=await read();
    await evaluate(`(() => {const group=document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="report-scale-metrics"]');[...group.querySelectorAll('[role="radio"]')].find(node=>node.textContent.includes('有责投诉量')).click();return true})()`);await wait(40);
    const responsible=await read();
    return{initial,effective,responsible};
  };
  await openReportConfig('周报');
  const weeklyReportConfig=await readReportAnalysis();
  weeklyReportConfig.scaleMetrics=await verifyScaleMetricRadio();
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;[...shadow.querySelectorAll('button')].find(node=>node.textContent.includes('返回报告中心')).click();return true})()`);await wait(120);
  await openReportConfig('日报');
  const dailyReportConfig=await readReportAnalysis();
  dailyReportConfig.scaleMetrics=await verifyScaleMetricRadio();
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;[...shadow.querySelectorAll('button')].find(node=>node.textContent.includes('返回报告中心')).click();return true})()`);await wait(120);
  await openReportConfig('季报');
  const quarterlyReportConfig=await readReportAnalysis();
  quarterlyReportConfig.scaleMetrics=await verifyScaleMetricRadio();
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;[...shadow.querySelectorAll('button')].find(node=>node.textContent.trim()==='保存配置').click();return true})()`);await wait(120);
  await openReportConfig('月报');
  const monthlyReportConfig=await readReportAnalysis();
  monthlyReportConfig.scaleMetrics=await verifyScaleMetricRadio();
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;[...shadow.querySelectorAll('button')].find(node=>node.textContent.includes('返回报告中心')).click();return true})()`);await wait(120);
  const reportCenterFullBank=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const cards=shadow.querySelector('[data-testid="report-type-cards"]');const table=shadow.querySelector('[data-testid="report-list-table"]');const rows=[...table.querySelectorAll('tbody tr[data-report-row]')];const trigger=shadow.querySelector('[data-testid="report-org-scope"]');const date=shadow.querySelector('[data-testid="report-query-date"]');return{cardLabels:[...cards.querySelectorAll('article b')].map(node=>node.textContent.trim()),cardColumns:getComputedStyle(cards).gridTemplateColumns.split(' ').length,cardWidths:[...cards.querySelectorAll('article')].map(node=>Math.round(node.getBoundingClientRect().width)),selectedOrg:trigger.textContent.trim(),header:[...table.querySelectorAll('thead th')].map(node=>node.textContent.trim()),institutions:rows.map(row=>row.lastElementChild.textContent.trim()),count:rows.length,dateLabel:date?.querySelector('[data-testid="report-query-date-label"]')?.textContent.trim()||'',dateValues:[...date.querySelectorAll('input[type="date"]')].map(node=>node.value),dateControlCount:date.querySelectorAll('.xib-embed-date').length,hasExclusions:shadow.querySelector('[data-testid="report-filter-bar"]').textContent.includes('剔除规则'),previewLabels:[...shadow.querySelectorAll('[data-testid="report-preview-meta"] span')].map(node=>node.textContent.trim())}})()`);
  const reportPreviewBeforeCard=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="report-preview-meta"] b')?.textContent.trim()||''`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const card=[...shadow.querySelectorAll('[data-testid="report-type-cards"] article')].find(node=>node.querySelector('b')?.textContent.trim()==='月报');card.click();return true})()`);await wait(80);
  const reportPreviewAfterCard=await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="report-preview-meta"] b')?.textContent.trim()||''`);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="report-list-table"] tbody tr[data-report-row]').click();true`);await wait(80);
  const reportPreviewAfterRow=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const meta=[...shadow.querySelectorAll('[data-testid="report-preview-meta"] b')].map(node=>node.textContent.trim());return{id:meta[0],period:meta[1],sender:meta[2],title:shadow.querySelector('[data-testid="report-preview-panel"] h3')?.textContent.trim()||''}})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const setValue=(label,value)=>{const input=shadow.querySelector('input[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};setValue('报告查询开始日期','2026-07-03');setValue('报告查询结束日期','2026-07-03');return true})()`);await wait(80);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;[...shadow.querySelectorAll('[data-testid="report-filter-bar"] button')].find(node=>node.textContent.trim()==='查询').click();return true})()`);await wait(100);
  const reportDateFiltered=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const rows=[...shadow.querySelectorAll('[data-testid="report-list-table"] tbody tr[data-report-row]')];return{count:rows.length,generationTimes:rows.map(row=>row.children[3].textContent.trim())}})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;[...shadow.querySelectorAll('[data-testid="report-filter-bar"] button')].find(node=>node.textContent.trim()==='重置').click();return true})()`);await wait(100);
  await evaluate(`document.querySelector('.statistics-module-host').shadowRoot.querySelector('[data-testid="report-org-scope"]').click();true`);await wait(80);
  const reportOrganizationPicker=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const all=shadow.querySelector('input[aria-label="全选"]');const popup=all.closest('.absolute');return{labels:[...popup.querySelectorAll('input[type="checkbox"]')].map(node=>node.getAttribute('aria-label')),allChecked:all.checked,fullBankChecked:popup.querySelector('input[aria-label="全行"]').checked}})()`);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;shadow.querySelector('[data-report-org-confirm]').click();return true})()`);await wait(80);
  await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;[...shadow.querySelectorAll('[data-testid="report-filter-bar"] button')].find(node=>node.textContent.trim()==='查询').click();return true})()`);await wait(100);
  const reportCenterAllInstitutions=await evaluate(`(() => {const shadow=document.querySelector('.statistics-module-host').shadowRoot;const rows=[...shadow.querySelectorAll('[data-testid="report-list-table"] tbody tr[data-report-row]')];return{institutions:rows.map(row=>row.lastElementChild.textContent.trim()),count:rows.length,summary:shadow.querySelector('[data-testid="report-filter-bar"]')?.textContent||''}})()`);
  const weeklyLabels=['受理分行维度','投诉产品维度','投诉事项维度','投诉原因维度'];
  const scaleMetricRadioValid=result=>result.initial.labels.join(',')==='受理投诉量,有效投诉量,有责投诉量'&&result.initial.selected.join(',')==='受理投诉量'&&result.effective.selected.join(',')==='有效投诉量'&&result.responsible.selected.join(',')==='有责投诉量';
  const reportLibraryOnlyValid=result=>result.libraryTitle==='指标变量库'&&result.sectionCount===2&&!result.hasGenerationConfig&&!result.hasOrgScope&&result.metricDateControls===0&&scaleMetricRadioValid(result.scaleMetrics)&&result.belowExclusions;
  if(weeklyReportConfig.title!=='周报维护配置'||!reportLibraryOnlyValid(weeklyReportConfig)||weeklyReportConfig.hasAnalysisDimensions||weeklyReportConfig.items.length!==0)throw new Error('周报指标变量库或单选配置回归失败：'+JSON.stringify(weeklyReportConfig));
  if(dailyReportConfig.title!=='日报维护配置'||!reportLibraryOnlyValid(dailyReportConfig)||dailyReportConfig.hasAnalysisDimensions||dailyReportConfig.items.length!==0)throw new Error('日报指标变量库或单选配置回归失败：'+JSON.stringify(dailyReportConfig));
  if(monthlyReportConfig.title!=='月报维护配置'||!reportLibraryOnlyValid(monthlyReportConfig)||JSON.stringify(monthlyReportConfig.items.map(item=>item.label))!==JSON.stringify(weeklyLabels)||!monthlyReportConfig.items.slice(0,3).every(item=>item.checked&&item.disabled)||monthlyReportConfig.items[3].checked||monthlyReportConfig.items[3].disabled)throw new Error('月报指标变量库或投诉原因维度回归失败：'+JSON.stringify(monthlyReportConfig));
  if(quarterlyReportConfig.title!=='季报维护配置'||!reportLibraryOnlyValid(quarterlyReportConfig)||JSON.stringify(quarterlyReportConfig.items.map(item=>item.label))!==JSON.stringify(weeklyLabels)||!quarterlyReportConfig.items.slice(0,3).every(item=>item.checked&&item.disabled)||quarterlyReportConfig.items[3].checked||quarterlyReportConfig.items[3].disabled)throw new Error('季报指标变量库或投诉原因维度回归失败：'+JSON.stringify(quarterlyReportConfig));
  if(reportPreviewBeforeCard!==reportPreviewAfterCard||reportPreviewAfterRow.id===reportPreviewBeforeCard||!reportPreviewAfterRow.id||!reportPreviewAfterRow.period||!reportPreviewAfterRow.sender||!reportPreviewAfterRow.title)throw new Error('报告预览未与报告编号独立联动：'+JSON.stringify({reportPreviewBeforeCard,reportPreviewAfterCard,reportPreviewAfterRow}));
  if(reportCenterFullBank.cardLabels.join(',')!=='日报,周报,月报,季报'||reportCenterFullBank.cardColumns!==4||new Set(reportCenterFullBank.cardWidths).size!==1||reportCenterFullBank.selectedOrg!=='全选'||reportCenterFullBank.header[3]!=='报告生成时间'||reportCenterFullBank.header.at(-1)!=='统计机构'||reportCenterFullBank.dateLabel!=='查询日期'||reportCenterFullBank.dateValues.join(',')!=='2026-06-01,2026-07-31'||reportCenterFullBank.dateControlCount!==2||reportCenterFullBank.hasExclusions||reportCenterFullBank.previewLabels.at(-1)!=='报告生成时间'||!reportCenterFullBank.count||new Set(reportCenterFullBank.institutions).size<=1||!reportDateFiltered.count||reportDateFiltered.generationTimes.some(value=>!value.startsWith('2026-07-03'))||reportOrganizationPicker.labels[0]!=='全选'||reportOrganizationPicker.labels[1]!=='全行'||!reportOrganizationPicker.allChecked||!reportOrganizationPicker.fullBankChecked||!reportCenterAllInstitutions.count||new Set(reportCenterAllInstitutions.institutions).size<=1||!reportCenterAllInstitutions.summary.includes('全选'))throw new Error('报告日期查询、生成时间、机构多选或全选/全行语义回归失败：'+JSON.stringify({reportCenterFullBank,reportDateFiltered,reportOrganizationPicker,reportCenterAllInstitutions}));

  console.log(JSON.stringify({ results, nationalMap, unifiedScope, petitionOrgDimension, institutionDefaultCharts, institutionLongRange, overviewLongRange, rectificationStages, selectionChecks, productViews:{lineRelatedProducts,customerRelatedProducts,petitionProducts}, lineComparison:{defaultPage:lineDefaultPage,secondPage:lineSecondPage,filteredPage:lineFilteredPage}, customerComposition, customerGeography, reportConfiguration:{weeklyReportConfig,dailyReportConfig,quarterlyReportConfig,monthlyReportConfig,reportCenterFullBank,reportCenterAllInstitutions}, lifecycle: { leftStatistics, remountedStatistics }, interaction, channelCollapseAfterScroll, channelCardVisibility, channelBars: { businessPrimary:businessPrimaryChannels, businessSecondary:businessSecondaryChannels, filteredBusinessSecondary:filteredBusinessSecondaryChannels, intake:intakeChannels, related:{primary:primaryRelated,alternate:alternatePrimaryRelated,intake:intakeRelated,selectedOrg:selectedOrgRelated,valid:channelRelatedValid}, hoverCss:channelHoverCssPresent, valid:channelBarsValid }, exceptions }, null, 2));
  const failed = results.some(item => item.iframeCount !== 0 || !item.hasHost || !item.hasShadow || !item.hasExpectedText || !item.sameHost || item.moduleHeight > item.hostHeight + 2 || (item.moduleScrollHeight > item.moduleHeight + 2 && !['auto','scroll'].includes(item.moduleOverflowY)));
  const expectedFirstLevels='总行,北京分行,上海分行,厦门分行,福州分行,珠海分行,宁德分行,龙岩分行,泉州分行,漳州分行,莆田分行,三明分行,南平分行';
  const unifiedScopeValid=unifiedScope.base.orgExists&&unifiedScope.base.orgText==='全行'&&unifiedScope.base.lineExists&&unifiedScope.base.lineText==='全部条线'&&unifiedScope.dialog.exists&&unifiedScope.dialog.quick.join(',')==='全行,五大分行及其下辖,省内分行及其下辖'&&unifiedScope.dialog.dimensionLabels.join(',')==='处理机构,投诉机构'&&unifiedScope.dialog.dimensionActive==='处理机构'&&unifiedScope.overviewDimensionAfterSwitch==='投诉机构'&&unifiedScope.dialog.firstLevels.join(',')===expectedFirstLevels&&unifiedScope.dialog.selected.join(',')===expectedFirstLevels&&unifiedScope.clearedSelection.remaining===0&&unifiedScope.clearedSelection.confirmDisabled&&unifiedScope.clearedSelection.clearDisabled&&unifiedScope.removableSelection.removed&&unifiedScope.removableSelection.remaining===12&&unifiedScope.branchGroupText==='北京分行及其所有下辖'&&unifiedScope.branchSelfText==='北京分行'&&unifiedScope.shortcutText==='五大分行及其下辖'&&unifiedScope.lineDefault.allChecked&&unifiedScope.lineDefault.optionCount===13&&unifiedScope.lineSingleText==='已选 1 项'&&unifiedScope.workOrderScope.renamed&&unifiedScope.workOrderScope.hasDescendantCheckbox&&!unifiedScope.workOrderScope.hasSingleSelection;
  const petitionOrgDimensionValid=petitionOrgDimension.labels.join(',')==='处理机构,信访机构'&&petitionOrgDimension.contextUpdated;
  const institutionDefaultsValid=Object.values(institutionDefaultCharts).every(names=>names.length===5)&&!Object.values(institutionDefaultCharts).some(names=>names.includes('总行'));
  const longRangeValid=institutionLongRange.buttons.join(',')==='季度,半年,年度'&&institutionLongRange.axis.includes('2024年Q1')&&overviewLongRange.buttons.join(',')==='季度,半年,年度'&&overviewLongRange.axis.includes('2024年Q1')&&institutionLongRange.tooltip&&!/环比|同比/.test(institutionLongRange.tooltip)&&overviewLongRange.tooltip&&!/环比|同比/.test(overviewLongRange.tooltip);
  const productViewsValid=[lineRelatedProducts,customerRelatedProducts].every(names=>names.slice().sort().join(',')===expectedProductNames.slice().sort().join(','))&&petitionRelatedViewsValid;
  const expectedRectificationStages=['提问阶段','方案制定阶段','整改阶段','结果审核阶段','已办结'];
  const rectificationStagesValid=expectedRectificationStages.every(stage=>rectificationStages.summary.includes(stage)&&rectificationStages.rows.includes(stage))&&!['待处理','处理中','审批中'].some(stage=>rectificationStages.summary.includes(stage)||rectificationStages.rows.includes(stage));
  const lineComparisonValid=lineDefaultPage.names.join(',')==='零售金融部,普惠金融部,公司金融部,消费者权益保护部,运营管理部,风险管理部,特殊资产经营部'&&lineDefaultPage.pageCount===2&&lineDefaultPage.footer.includes('共 13 个条线，每页 7 个')&&lineSecondPage[0]==='安全保卫部/总务部'&&lineFilteredPage.names.join(',')==='零售金融部,安全保卫部/总务部,科技运维部'&&lineFilteredPage.pageCount===1&&lineFilteredPage.summary.includes('展示已选 3 项业务条线');
  const customerCompositionValid=customerComposition.exists&&!customerComposition.hasZodiac&&customerComposition.dimensions.join(',')==='客户类型,地区,性别,年龄,境内外,风险客户类型'&&customerComposition.ages.join(',')==='18岁以下,18—29岁,30—39岁,40—49岁,50—59岁,60岁及以上,未知'&&customerComposition.riskTypes.join(',')==='高龄老人,超高龄老人,未成年,重要客户,新市民,无风险客户';
  const homeMapDisplayValid=nationalMap.labelsUseShare&&nationalMap.labelRiskColors&&nationalMap.rankingUsesShare&&nationalMap.rankingRiskColors&&nationalMap.comparisonHidden;
  if(!homeMapDisplayValid)throw new Error('首页投诉地图占比或风险配色回归失败：'+JSON.stringify(nationalMap));
  if (failed || !unifiedScopeValid || !petitionOrgDimensionValid || !institutionDefaultsValid || !longRangeValid || !productViewsValid || !rectificationStagesValid || !lineComparisonValid || !customerCompositionValid || nationalMap.geoFeatures < 30 || !nationalMap.hasNationalSvg || nationalMap.provincePaths < 30 || !nationalMap.clickedRegion || !nationalMap.hasRegionalSvg || !nationalMap.labelsUseShare || !nationalMap.labelRiskColors || !nationalMap.rankingUsesShare || !nationalMap.rankingRiskColors || !nationalMap.comparisonHidden || !leftStatistics || !remountedStatistics || !channelCardVisibility.collapsed || !channelCardVisibility.visible || !channelBarsValid || exceptions.length) process.exitCode = 1;
  ws.close();
}

main()
  .catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    browser.kill();
    await wait(300);
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      if (error?.code !== "EPERM") throw error;
      console.warn(`Skipped locked Edge profile cleanup: ${profile}`);
    }
  });
