(function registerConsumerReview(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  if (!registry) throw new Error("XIBModuleRegistry must load before consumer-review.");

  registry.register({
    name: "consumer-review",
    routes: ["review-manage"],
    render(page, context) {
      const meta = context.pageMeta[page] || { title: "消保审查", group: "消保审查" };
      return `<section class="page xib-module-consumer-review" data-module="consumer-review">
        ${context.pageHeader(meta.title, `${meta.group}功能入口已按角色权限纳入导航`)}
        <div class="panel"><div class="empty"><div>
          <div class="empty-mark">□</div>
          <h3>${meta.title}</h3>
          <p>该一级模块已经拥有独立目录，后续业务页面在此模块内迭代。</p>
        </div></div></div>
      </section>`;
    }
  });
})(window);
