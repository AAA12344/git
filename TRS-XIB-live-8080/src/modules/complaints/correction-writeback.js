(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XIBCorrectionWriteback = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const comparable = value => Array.isArray(value) ? value.join(" / ") : String(value ?? "");
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function buildChanges({ fields = [], values = {}, originalValues = {}, existingOverrides = {}, entry = {}, fieldMap = {}, skippedFields = [] }) {
    const skipped = new Set(skippedFields);
    const changes = [];
    for (const field of fields) {
      if (skipped.has(field.name)) continue;
      const value = values[field.name];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) continue;
      const targetName = field.writebackField || fieldMap[field.name] || field.name;
      const oldValue = Object.prototype.hasOwnProperty.call(existingOverrides, targetName) ? existingOverrides[targetName] : entry[targetName];
      const comparisonValue = Object.prototype.hasOwnProperty.call(originalValues, field.name) ? originalValues[field.name] : oldValue;
      if (comparable(value) === comparable(comparisonValue)) continue;
      changes.push({ field:targetName, oldValue:clone(oldValue ?? ""), newValue:clone(value) });
    }
    return changes;
  }
  function latest(history = []) {
    return [...history].filter(item => item?.completedAt && Array.isArray(item.changes)).sort((left, right) => String(right.completedAt).localeCompare(String(left.completedAt)))[0] || null;
  }
  function prefillValue({ sourceNames = [], sourceValues = {}, overrides = {}, phase = "entry" }) {
    for (const name of sourceNames) {
      if (phase !== "processing" && overrides[name] !== undefined && overrides[name] !== null && overrides[name] !== "") return clone(overrides[name]);
      if (sourceValues[name] !== undefined && sourceValues[name] !== null && sourceValues[name] !== "") return clone(sourceValues[name]);
    }
    return undefined;
  }
  return { buildChanges, latest, prefillValue };
});
