(function registerEducation(global) {
  "use strict";

  const registry = global.XIBModuleRegistry;
  if (!registry) throw new Error("XIBModuleRegistry must load before education.");

  registry.register({
    name: "education",
    routes: ["education-manage"],
    render(page, context) {
      const meta = context.pageMeta[page] || { title: "宣传教育", group: "宣传教育" };
      return `<section class="page xib-module-education" data-module="education">
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
