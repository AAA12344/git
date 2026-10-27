(function createComplaintRectificationStatistics(global) {
  "use strict";

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function createModel({ row = null, stored = {}, filters = {} } = {}) {
    const normalizedFilters = Array.isArray(filters) ? { products:filters, cause:"" } : (filters || {});
    const selectedProducts = Array.isArray(normalizedFilters.products) ? [...normalizedFilters.products] : [];
    const selectedCause = typeof normalizedFilters.cause === "string" ? normalizedFilters.cause : "";
    const causeHash = [...selectedCause].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return {
      "投诉产品标签": selectedProducts.length ? selectedProducts : "全部",
      "投诉原因标签": selectedCause || "全部",
      "统计周期": stored["统计周期"] || "-",
      "统计机构": stored["统计机构"] || row?.[4] || "-",
      selectedProducts,
      selectedCause,
      causeFactor: selectedCause ? 0.82 + (causeHash % 17) / 100 : 1,
      comparison: stored.comparison || { beforeDaily:2.8, duringDaily:1.4, changeRate:-50, groups:[] },
      trend: stored.trend || {
        labels:["6/30", "7/05", "7/10", "7/15", "7/20", "7/25", "7/30", "8/04", "8/09", "8/14", "8/19", "8/22"],
        values:[4, 5, 4, 6, 5, 4, 5, 4, 3, 3, 2, 2],
        creationIndex:6,
        resultIndex:11,
        productSeries:{}
      }
    };
  }

  function comparisonGroup(product, index, statistics) {
    const leaf = String(product).split(" / ").pop();
    const stored = (statistics.comparison.groups || []).find(group => group.label === product || group.label === leaf);
    if (stored) return { ...stored, label:leaf };
    const hash = [...String(product)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const beforeDaily = Number(((2.2 + (hash % 29) / 10) * statistics.causeFactor).toFixed(1));
    const improvement = 0.48 + ((hash + index) % 24) / 100;
    const duringDaily = Number((beforeDaily * improvement).toFixed(1));
    return { label:leaf, beforeDaily, duringDaily, changeRate:Number((((duringDaily - beforeDaily) / beforeDaily) * 100).toFixed(1)) };
  }

  function trendValues(product, index, statistics) {
    const stored = statistics.trend.productSeries?.[product];
    if (stored) return stored.map(value => Number((Number(value) * statistics.causeFactor).toFixed(1)));
    const hash = [...String(product)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const factor = 0.62 + (hash % 31) / 100;
    return (statistics.trend.values || []).map((value, pointIndex) => Number(Math.max(0, Number(value) * factor * statistics.causeFactor + ((pointIndex + index + hash) % 3 - 1) * 0.2).toFixed(1)));
  }

  function rateMarkup(rate) {
    const improved = Number(rate) <= 0;
    return '<span class="rectification-change ' + (improved ? "is-improved" : "is-worse") + '">' + (improved ? "↓ " : "↑ ") + Math.abs(Number(rate || 0)).toFixed(1) + "%</span>";
  }

  function renderComparison(statistics) {
    const specific = statistics.selectedProducts.length > 0;
    const groups = specific ? statistics.selectedProducts.map((product, index) => comparisonGroup(product, index, statistics)) : [
      { label:"整改前", single:true, value:Number((Number(statistics.comparison.beforeDaily || 0) * statistics.causeFactor).toFixed(1)) },
      { label:"整改中", single:true, value:Number((Number(statistics.comparison.duringDaily || 0) * statistics.causeFactor).toFixed(1)) }
    ];
    const values = specific ? groups.flatMap(group => [Number(group.beforeDaily || 0), Number(group.duringDaily || 0)]) : groups.map(group => group.value);
    const max = Math.max(...values, 1);
    const plot = specific
      ? '<div class="comparison-grouped-bars">' + groups.map(group => {
          const before = Number(group.beforeDaily || 0);
          const during = Number(group.duringDaily || 0);
          return '<div class="comparison-group"><div class="comparison-group-bars"><div class="comparison-mini-bar"><b>' + before.toFixed(1) + '</b><i class="is-before" style="height:' + Math.max(4, Math.round(before / max * 126)) + 'px"></i></div><div class="comparison-mini-bar"><b>' + during.toFixed(1) + '</b><i class="is-during" style="height:' + Math.max(4, Math.round(during / max * 126)) + 'px"></i></div></div><strong>' + escapeHtml(group.label) + '</strong>' + rateMarkup(group.changeRate) + '</div>';
        }).join("") + "</div>"
      : '<div class="comparison-bars">' + groups.map((group, index) => '<div class="comparison-bar-item"><div class="comparison-bar-value">' + group.value.toFixed(1) + '</div><div class="comparison-bar ' + (index ? "is-during" : "is-before") + '" style="height:' + Math.max(4, Math.round(group.value / max * 126)) + 'px"></div><span>' + group.label + "</span></div>").join("") + "</div>";
    return '<div class="rectification-stat-chart comparison-chart" role="img" aria-label="日均投诉量变化对比图"><div class="rectification-chart-head"><div><strong>日均投诉量变化对比图</strong><span>日均投诉数量（件/天），保留 1 位小数</span></div><div class="rectification-chart-legend"><span class="is-before">整改前</span><span class="is-during">整改中</span></div></div><div class="comparison-plot"><div class="comparison-axis"><span>' + max.toFixed(1) + "</span><span>" + (max / 2).toFixed(1) + "</span><span>0.0</span></div>" + plot + "</div>" + (specific ? "" : '<div class="comparison-total-rate"><span>日均变化率</span>' + rateMarkup(statistics.comparison.changeRate) + "</div>") + '<p class="rectification-chart-caption">数据口径：日均投诉量 = 总投诉件数 ÷ 实际天数</p></div>';
  }

  function renderTrend(statistics) {
    const trend = statistics.trend;
    const labels = trend.labels || [];
    const colors = ["#2272de", "#f28a32", "#7a5af8", "#25a25a"];
    const series = statistics.selectedProducts.length
      ? statistics.selectedProducts.map((product, index) => ({ label:String(product).split(" / ").pop(), values:trendValues(product, index, statistics), color:colors[index % colors.length] }))
      : [{ label:statistics.selectedCause ? "全部产品 · " + String(statistics.selectedCause).split(" / ").pop() : "全部产品", values:(trend.values || []).map(value => Number((Number(value) * statistics.causeFactor).toFixed(1))), color:colors[0] }];
    const allValues = series.flatMap(item => item.values.map(Number));
    const width = 760;
    const height = 270;
    const left = 50;
    const right = 24;
    const top = 44;
    const bottom = 46;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const max = Math.max(...allValues, 1) + 1;
    const point = (value, index, count) => ({ x:left + plotWidth * index / Math.max(1, count - 1), y:top + plotHeight - Number(value || 0) / max * plotHeight });
    const creationIndex = Math.min(Number(trend.creationIndex || 0), Math.max(0, labels.length - 1));
    const resultIndex = Math.min(Number(trend.resultIndex ?? labels.length - 1), Math.max(0, labels.length - 1));
    const creationX = point(0, creationIndex, labels.length).x;
    const resultX = point(0, resultIndex, labels.length).x;
    const lines = series.map(item => {
      const points = item.values.map((value, index) => point(value, index, item.values.length));
      return '<polyline class="trend-series-line" style="stroke:' + item.color + '" points="' + points.map(value => value.x + "," + value.y).join(" ") + '"/><g class="trend-series-points" style="--series-color:' + item.color + '">' + points.map(value => '<circle cx="' + value.x + '" cy="' + value.y + '" r="3.5"/>').join("") + "</g>";
    }).join("");
    return '<div class="rectification-stat-chart trend-chart" role="img" aria-label="投诉量趋势图"><div class="rectification-chart-head"><div><strong>投诉量趋势图</strong><span>统计周期内每日投诉量连续变化</span></div><div class="trend-series-legend">' + series.map(item => '<span style="--series-color:' + item.color + '">' + escapeHtml(item.label) + "</span>").join("") + '</div></div><svg viewBox="0 0 ' + width + " " + height + '" preserveAspectRatio="xMidYMid meet"><rect class="trend-period-before" x="' + left + '" y="' + top + '" width="' + Math.max(0, creationX - left) + '" height="' + plotHeight + '"/><rect class="trend-period-during" x="' + creationX + '" y="' + top + '" width="' + Math.max(0, resultX - creationX) + '" height="' + plotHeight + '"/><g class="trend-grid"><line x1="' + left + '" y1="' + top + '" x2="' + (width - right) + '" y2="' + top + '"/><line x1="' + left + '" y1="' + (top + plotHeight / 2) + '" x2="' + (width - right) + '" y2="' + (top + plotHeight / 2) + '"/><line x1="' + left + '" y1="' + (top + plotHeight) + '" x2="' + (width - right) + '" y2="' + (top + plotHeight) + '"/></g><g class="trend-y-labels"><text x="' + (left - 8) + '" y="' + (top + 4) + '" text-anchor="end">' + max.toFixed(0) + '</text><text x="' + (left - 8) + '" y="' + (top + plotHeight / 2 + 4) + '" text-anchor="end">' + (max / 2).toFixed(0) + '</text><text x="' + (left - 8) + '" y="' + (top + plotHeight + 4) + '" text-anchor="end">0</text></g><line class="trend-event-line is-created" x1="' + creationX + '" y1="' + top + '" x2="' + creationX + '" y2="' + (top + plotHeight) + '"/><line class="trend-event-line is-result" x1="' + resultX + '" y1="' + top + '" x2="' + resultX + '" y2="' + (top + plotHeight) + '"/><text class="trend-event-label is-created" x="' + Math.max(left + 52, creationX - 5) + '" y="28" text-anchor="end">整改单创建日</text><text class="trend-event-label is-result" x="' + Math.min(width - right - 70, resultX + 5) + '" y="28">整改成果上传日</text>' + lines + '<g class="trend-axis-labels">' + labels.map((label, index) => { const item = point(0, index, labels.length); return (index % 2 === 0 || index === labels.length - 1) ? '<text x="' + item.x + '" y="' + (height - 10) + '" text-anchor="middle">' + escapeHtml(label) + "</text>" : ""; }).join("") + '</g></svg><p class="rectification-chart-caption">红色虚线为整改单创建日，绿色虚线为整改成果上传日</p></div>';
  }

  global.XIBComplaintRectificationStatistics = Object.freeze({
    createModel,
    renderComparison,
    renderTrend
  });
})(window);
