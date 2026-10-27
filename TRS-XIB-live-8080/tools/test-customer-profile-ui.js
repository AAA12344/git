"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const { findBrowserExecutable } = require("./browser-path");

(async () => {
  const browserPath = findBrowserExecutable();
  const browser = await chromium.launch({
    executablePath:browserPath || undefined,
    headless:true
  });
  const page = await browser.newPage({ viewport:{ width:1600, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    const previewCases = {
      TS202607230012:{ customerNo:"C202607000001", levelCounts:[3,1,2], statCounts:[6,6,0,0,0], activeType:"投诉单", typeCount:6, histories:6 },
      TS202607250031:{ customerNo:"C202607000007", levelCounts:[1,1,1], statCounts:[3,3,0,0,0], activeType:"投诉单", typeCount:3, histories:3 },
      TS202608040012:{ customerNo:"C202608000013", levelCounts:[1,1,2], statCounts:[4,4,0,0,0], activeType:"投诉单", typeCount:4, histories:4 },
      JY202607240017:{ customerNo:"C202607000005", levelCounts:[0,0,0], statCounts:[1,0,0,1,0], activeType:"建议单", typeCount:1, histories:1 },
    };    const targetTicketId = process.env.XIB_CUSTOMER_PROFILE_TICKET_ID || "TS202607230012";
    const previewCase = previewCases[targetTicketId] || previewCases.TS202607230012;
    const indexUrl = pathToFileURL(path.resolve(__dirname, "..", "index.html")).href + "#overview";
    await page.goto(indexUrl, { waitUntil:"load" });
    await page.waitForSelector("#role-cascade-trigger");
    await page.click("#role-cascade-trigger");
    await page.click("[data-role-org='development']");
    await page.click("[data-role-profile='development-developer']");
    await page.waitForSelector("[data-page='ticket-create']", { state:"attached" });
    await page.evaluate(() => document.querySelector("[data-page='ticket-create']").click());
    await page.waitForSelector(".ticket-list-table");
    const detailButton = page.locator(".ticket-list-table [data-action='detail']").first();
    await detailButton.evaluate((button, id) => { button.dataset.id = id; button.click(); }, targetTicketId);
    await page.waitForSelector(".ticket-detail-page");

    const tabLabels = await page.locator(".ticket-detail-page .detail-tabs .tab").allInnerTexts();
    assert(tabLabels.includes("客户画像"), "工单详情缺少客户画像页签");
    assert(!tabLabels.includes("历史工单"), "工单详情仍保留历史工单页签");
    await page.locator("[data-detail-tab='客户画像']").click();
    try {
      await page.waitForSelector(".ticket-customer-profile");
    } catch (error) {
      console.error("customer profile render errors:", errors.join(" | "));
      console.error("ticket detail text:", (await page.locator(".ticket-detail-page").innerText()).slice(0, 1200));
      throw error;
    }

    assert.equal(await page.locator(".customer-basic-card").count(), 1, "客户基本信息卡片未渲染");
    assert.equal(await page.locator(".complaint-path-card").count(), 1, "投诉路径卡片未渲染");
    assert.equal(await page.locator(".customer-profile-card-head small").count(), 0, "画像卡片标题下仍有灰色注释");
    const cardHeadHeights = await page.locator(".customer-profile-card-head").evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height)));
    assert.deepEqual(cardHeadHeights, [46, 46], `画像卡片标题栏未遵循统一 46px panel 规范: ${cardHeadHeights.join(",")}`);
    const cardHeights = await page.locator(".customer-profile-overview > .customer-profile-card").evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height)));
    assert(cardHeights.every(height => height <= 310), `顶部画像卡片未压缩到 310px 以内: ${cardHeights.join(",")}`);
    assert((await page.locator(".customer-basic-card").innerText()).includes(previewCase.customerNo), "客户画像未显示工单关联的真实客户编号");
    assert.equal(await page.locator(".ticket-customer-profile").getByText("历史工单", { exact:true }).count(), 1, "客户画像中的历史工单标题重复");
    assert.equal(await page.locator(".complaint-path-level").count(), 3, "投诉路径必须固定显示三个统计层级");
    assert.deepEqual(await page.locator(".complaint-path-level > strong").allInnerTexts(), ["行内投诉", "网微投诉", "监管投诉"], "三级投诉路径名称或顺序不正确");
    const levelCounts = (await page.locator(".complaint-path-level > b").allInnerTexts()).map(Number);
    assert.deepEqual(levelCounts, previewCase.levelCounts, `三级投诉路径数量不符合真实历史工单: ${levelCounts.join(",")}`);
    assert.equal(await page.locator(".complaint-path-chart, .complaint-path-insight, .complaint-channel-timeline").count(), 0, "旧流程判断、流量图或时间线仍然存在");
    const firstNonEmptyLevel = previewCase.levelCounts.findIndex(count => count > 0);
    if (firstNonEmptyLevel >= 0) {
      await page.locator(".complaint-path-level").nth(firstNonEmptyLevel).click();
      await page.waitForSelector(".complaint-path-level.is-selected");
      assert.equal(await page.locator(".complaint-path-level.is-selected").count(), 1, "点击路径层级后未显示选中状态");
      assert.equal(await page.locator(".history-ticket-list [data-history-ticket]").count(), previewCase.levelCounts[firstNonEmptyLevel], "点击路径层级后未按对应数量筛选历史工单");
      assert((await page.locator(".history-path-filter-status").innerText()).includes(["行内投诉", "网微投诉", "监管投诉"][firstNonEmptyLevel]), "历史工单未显示当前路径筛选条件");
      await page.locator(".complaint-path-level").nth(firstNonEmptyLevel).click();
      await page.waitForFunction(() => document.querySelectorAll(".complaint-path-level.is-selected").length === 0);
      assert.equal(await page.locator(".complaint-path-level.is-selected").count(), 0, "再次点击同一等级后未取消筛选");
      assert.equal(await page.locator(".history-ticket-list [data-history-ticket]").count(), previewCase.histories, "再次点击同一等级后未恢复全部历史工单");
      await page.locator(".complaint-path-level").nth(firstNonEmptyLevel).click();
      await page.locator(".complaint-path-card [data-customer-path-clear]").click();
      await page.waitForFunction(() => document.querySelectorAll(".complaint-path-level.is-selected").length === 0);
      assert.equal(await page.locator(".complaint-path-level.is-selected").count(), 0, "全部历史按钮未清除路径筛选");
    }
    assert.equal(await page.locator(".customer-profile-metrics").count(), 0, "客户基本信息卡仍保留底部统计条");
    assert.equal(await page.locator(".complaint-path-stat").count(), 5, "投诉统计未显示累计和四类工单");
    assert.deepEqual(await page.locator(".complaint-path-stat > span").allInnerTexts(), ["累计", "投诉", "信访", "建议", "表扬"], "投诉统计项目或顺序不正确");
    const statCounts = (await page.locator(".complaint-path-stat > strong").allInnerTexts()).map(Number);
    assert.deepEqual(statCounts, previewCase.statCounts, `投诉统计未使用真实历史数据: ${statCounts.join(",")}`);
    assert.equal(await page.locator(".complaint-path-stat.is-total").count(), 1, "累计统计缺失");
    assert.equal(await page.locator("button.complaint-path-stat.is-total, .complaint-path-stat.is-total[data-action]").count(), 0, "累计统计不应可点击");
    assert.equal(await page.locator("[data-action='customer-type-filter']").count(), 4, "投诉、信访、建议、表扬应提供四个类型筛选按钮");
    assert.equal(await page.locator("[data-action='customer-path-level']").count(), 3, "投诉路径应提供三个等级筛选按钮");
    assert.equal(await page.locator(".complaint-path-card [data-action='customer-type-filter'], .complaint-path-card [data-action='customer-path-level']").count(), 7, "客户画像必须恰好提供七个历史筛选按钮");
    assert(!(await page.locator(".customer-basic-card").innerText()).includes("累计"), "累计统计仍留在客户基本信息卡");
    assert((await page.locator(".complaint-path-card").innerText()).includes("累计"), "累计统计未移入投诉统计卡");
    const conclusion = await page.locator("[data-customer-complaint-conclusion]").innerText();
    assert.match(conclusion, /^该客户共有历史工单\d+笔（投诉单\d+笔、信访单\d+笔、建议单\d+笔、表扬单\d+笔）；重复投诉\d+笔；历史监管投诉\d+笔。$/, "投诉统计结论格式不正确");
    assert(conclusion.includes(`历史监管投诉${previewCase.levelCounts[2]}笔`), "投诉统计结论中的历史监管投诉未取第三级监管渠道数量");
    const typeButton = page.locator("[data-action='customer-type-filter'][data-id='" + previewCase.activeType + "']");
    await typeButton.click();
    await page.waitForSelector("[data-action='customer-type-filter'].is-selected");
    assert.equal(await page.locator("[data-action='customer-type-filter'].is-selected").count(), 1, "点击工单类型后未显示选中状态");
    assert.equal(await page.locator(".complaint-path-level.is-selected").count(), 0, "工单类型筛选未清除投诉等级筛选");
    assert.equal(await page.locator(".history-ticket-list [data-history-ticket]").count(), previewCase.typeCount, "工单类型未筛选对应历史工单");
    assert((await page.locator(".history-path-filter-status").innerText()).includes(previewCase.activeType), "历史工单未显示当前类型筛选");
    await page.locator("[data-action='customer-type-filter'][data-id='" + previewCase.activeType + "']").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-action='customer-type-filter'].is-selected").length === 0);
    assert.equal(await page.locator(".history-ticket-list [data-history-ticket]").count(), previewCase.histories, "再次点击同一工单类型后未恢复全部历史工单");
    assert(!(await page.locator(".complaint-path-card").innerText()).includes("近一年工单"), "客户画像仍错误使用近一年统计口径");
    if (targetTicketId === "TS202607230012") {
      assert.equal(await page.locator(".history-ticket-list [data-history-ticket='TS202408150101']").count(), 1, "超过一年的已办结工单未进入历史工单");
      assert.equal(await page.locator(".history-ticket-list [data-history-ticket='TS202607310106']").count(), 1, "处理中的非草稿工单未进入历史工单");
      assert.equal(await page.locator(".history-ticket-list [data-history-ticket='TS202608050011']").count(), 1, "待处理的非草稿工单未进入历史工单");
      assert.equal(await page.locator(".history-ticket-list [data-history-ticket='TS202607310101']").count(), 0, "草稿工单错误进入历史工单");
    }
    const factsColumns = await page.locator(".customer-profile-facts").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    assert.equal(factsColumns, 1, "客户基本信息未使用单列布局");
    const undersizedText = await page.locator(".ticket-customer-profile").evaluate(root => [...root.querySelectorAll("*")]
      .filter(node => node.getClientRects().length && node.textContent.trim() && (node.childElementCount === 0 || node instanceof SVGTextElement))
      .map(node => ({ text:node.textContent.trim().slice(0, 24), size:parseFloat(getComputedStyle(node).fontSize) }))
      .filter(item => Number.isFinite(item.size) && item.size < 10));
    assert.deepEqual(undersizedText, [], `客户画像存在小于 10px 的可见文字: ${JSON.stringify(undersizedText)}`);

    assert.equal(await page.locator(".history-ticket-list [data-history-ticket]").count(), previewCase.histories, "历史工单未按真实客户编号关联");
    if (previewCase.histories) {
      assert.equal(await page.locator(".history-ticket-content").count(), 1, "历史工单详情未在右侧渲染");
      if (previewCase.histories > 1) {
        const secondHistoryId = await page.locator(".history-ticket-list [data-history-ticket]").nth(1).getAttribute("data-history-ticket");
        await page.locator(".history-ticket-list [data-history-ticket]").nth(1).click();
        await page.waitForFunction(id => document.querySelector("[data-history-ticket='" + id + "']")?.classList.contains("is-active"), secondHistoryId);
        assert.match(await page.locator(".history-ticket-content h3").innerText(), new RegExp(secondHistoryId), "切换历史工单后右侧详情未联动");
      }
    } else {
      assert.equal(await page.locator(".history-ticket-content").count(), 0, "无历史客户不应渲染虚构工单详情");
      assert.equal(await page.locator(".history-ticket-empty").count(), 1, "无历史客户缺少明确空状态");
    }

    if (process.env.XIB_CUSTOMER_PROFILE_SCREENSHOT) {
      await page.locator(".customer-profile-overview").screenshot({ path:process.env.XIB_CUSTOMER_PROFILE_SCREENSHOT });
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    const layout = await page.evaluate(hasHistory => {
      const cards = [...document.querySelectorAll(".customer-profile-overview > .customer-profile-card")].map(node => node.getBoundingClientRect());
      const workspace = document.querySelector(".ticket-customer-profile .history-workspace")?.getBoundingClientRect();
      const list = document.querySelector(".ticket-customer-profile .history-ticket-list")?.getBoundingClientRect();
      const detail = document.querySelector(".ticket-customer-profile .history-ticket-content")?.getBoundingClientRect();
      return {
        sameTop:Math.abs(cards[0].top - cards[1].top) < 2,
        leftNarrower:cards[0].width < cards[1].width,
        workspaceAligned:!hasHistory || (workspace && list && detail && Math.abs(list.top - detail.top) < 2),
        fits:document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        cardWidths:cards.map(item => item.width)
      };
    }, previewCase.histories > 0);
    assert(layout.sameTop && layout.leftNarrower, `顶部两张卡片未按左窄右宽布局: ${JSON.stringify(layout)}`);
    assert(layout.workspaceAligned, "历史工单列表与详情未按图示顶部对齐");
    assert(layout.fits, "客户画像导致页面横向溢出");
    assert.equal(errors.length, 0, errors.join(" | "));
    console.log(JSON.stringify({
      ok:true,
      ticketId:targetTicketId,
      state:"三级投诉路径筛选",
      checks:["客户画像页签","紧凑双卡片布局","左侧信息单列","累计只读与七个筛选按钮","可见文字不小于10px","三级数量流程","点击筛选历史工单","同级再次点击取消筛选","历史工单联动","统计结论","file:// 打开"]
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
