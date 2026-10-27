(function createModuleRegistry(global) {
  "use strict";

  const modules = [];
  const modulesByName = new Map();
  const modulesByRoute = new Map();

  function requireFunction(moduleDefinition, key) {
    if (moduleDefinition[key] !== undefined && typeof moduleDefinition[key] !== "function") {
      throw new TypeError("Module " + moduleDefinition.name + " has an invalid " + key + " hook.");
    }
  }

  function register(moduleDefinition) {
    if (!moduleDefinition || typeof moduleDefinition !== "object") {
      throw new TypeError("A module definition object is required.");
    }

    const name = String(moduleDefinition.name || "").trim();
    const routes = [...new Set((moduleDefinition.routes || []).map(route => String(route).trim()).filter(Boolean))];

    if (!name) throw new Error("Every module needs a stable name.");
    if (!routes.length) throw new Error("Module " + name + " must own at least one route.");
    if (modulesByName.has(name)) throw new Error("Module name already registered: " + name);

    routes.forEach(route => {
      if (modulesByRoute.has(route)) {
        throw new Error("Route " + route + " is already owned by " + modulesByRoute.get(route).name + ".");
      }
    });

    requireFunction(moduleDefinition, "render");
    requireFunction(moduleDefinition, "afterRender");
    requireFunction(moduleDefinition, "handleAction");
    requireFunction(moduleDefinition, "reset");
    if (!moduleDefinition.render) throw new Error("Module " + name + " needs a render hook.");

    const registered = Object.freeze({
      name,
      routes: Object.freeze(routes),
      render: moduleDefinition.render,
      afterRender: moduleDefinition.afterRender,
      handleAction: moduleDefinition.handleAction,
      reset: moduleDefinition.reset
    });

    modules.push(registered);
    modulesByName.set(name, registered);
    routes.forEach(route => modulesByRoute.set(route, registered));
    return registered;
  }

  function hookContext(moduleDefinition, page, context) {
    return Object.assign({}, context || {}, {
      moduleName: moduleDefinition.name,
      page
    });
  }

  function render(page, context) {
    const moduleDefinition = modulesByRoute.get(page);
    if (!moduleDefinition) return null;
    const html = moduleDefinition.render(page, hookContext(moduleDefinition, page, context));
    if (typeof html !== "string") {
      throw new TypeError("Module " + moduleDefinition.name + " must render an HTML string.");
    }
    return html;
  }

  function afterRender(root, page, context) {
    const moduleDefinition = modulesByRoute.get(page);
    if (!moduleDefinition?.afterRender) return false;
    moduleDefinition.afterRender(root, page, hookContext(moduleDefinition, page, context));
    return true;
  }

  function handleAction(action, payload, context) {
    const moduleDefinition = modulesByRoute.get(context?.page);
    if (!moduleDefinition?.handleAction) return false;
    return moduleDefinition.handleAction(
      action,
      payload || {},
      hookContext(moduleDefinition, context.page, context)
    ) === true;
  }

  function reset(page, context) {
    const moduleDefinition = modulesByRoute.get(page);
    if (!moduleDefinition?.reset) return false;
    moduleDefinition.reset(page, hookContext(moduleDefinition, page, context));
    return true;
  }

  function list() {
    return modules.map(moduleDefinition => ({
      name: moduleDefinition.name,
      routes: [...moduleDefinition.routes]
    }));
  }

  global.XIBModuleRegistry = Object.freeze({
    register,
    render,
    afterRender,
    handleAction,
    reset,
    hasRoute: route => modulesByRoute.has(route),
    list
  });
})(window);
