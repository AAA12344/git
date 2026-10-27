# Shared core

This directory contains small contracts shared by every business module.

## Files

- `app-config.js` is the source of truth for navigation, page metadata, role
  profiles, and route permissions. It validates itself when loaded and exports
  the immutable `window.XIB_APP_CONFIG` object.
- `module-registry.js` owns route registration and delegates rendering,
  post-render hooks, and module actions through `window.XIBModuleRegistry`.

## Adding a route

1. Add the navigation entry to `app-config.js`.
2. Add the route to each role that should see it.
3. Register exactly one module as the route owner.
4. Add the module script to `index.html` after `module-registry.js`.
5. Update the configuration and module tests.
6. Run `npm run verify`.

Do not put ticket-, approval-, statistics-, or admin-specific business logic in
this directory. Shared core defines contracts; modules implement features.
