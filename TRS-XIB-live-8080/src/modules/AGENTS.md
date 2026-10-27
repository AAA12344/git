# Module development guidance

These instructions apply to all top-level business modules.

## Ownership boundary

- A top-level module may have multiple maintainers. Keep each task inside one top-level module unless a shared contract is explicitly required.
- Do not query or mutate another module's DOM, state, or sample data.
- Shared route, storage, or UI contracts require a separate or clearly identified core change.
- A route must have exactly one registered owner.
- Legacy code in `app.js` is not safe for parallel editing. Extract a bounded route group before assigning simultaneous work.

## Required module shape

- Use a stable kebab-case directory and module name.
- Register owned routes through `window.XIBModuleRegistry`.
- Render one root with `data-module="<module-name>"` and a scoped root class.
- Prefix action names with the module name or a stable domain prefix.
- Keep module state local unless a documented shared service is needed.
- Add a focused contract test and browser regression for primary interactions.

## Review rules

- Flag route ownership collisions and changes outside the assigned module.
- Flag direct edits to generated bundles.
- Flag global CSS selectors introduced by a module.
- Preserve direct `file://` opening until the project explicitly changes that product requirement.
- Run `npm run verify` before requesting review.
