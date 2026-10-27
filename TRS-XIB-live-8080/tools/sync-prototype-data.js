const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { writeFormSchema } = require("./build-form-schema");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
writeFormSchema({ silent: true });
const files = {
  formSchema: path.join(dataDir, "form-schema.json"),
  workflowSchema: path.join(dataDir, "workflow-schema.json"),
  statusTagConfig: path.join(dataDir, "status-tag-config.json"),
  complaintPermissionRules: path.join(dataDir, "complaint-permission-rules.json"),
  seedData: path.join(dataDir, "seed-data.json"),
  customerData: path.join(dataDir, "customers.json"),
  organizationTree: path.join(dataDir, "organization-tree.json"),
  tagTrees: path.join(dataDir, "tag-trees.json"),
  rectificationTagDictionaries: path.join(dataDir, "rectification-tag-dictionaries.json"),
  subprocessInitiationRules: path.join(dataDir, "subprocess-initiation-rules.json"),
  regionTree: path.join(dataDir, "region-tree.json")
};

const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const rectificationTagDictionaries = readJson(files.rectificationTagDictionaries);
const baseTagTrees = readJson(files.tagTrees);
const tagTrees = {
  ...baseTagTrees,
  meta: {
    ...baseTagTrees.meta,
    sources: {
      ...(baseTagTrees.meta?.sources || {}),
      rectificationProduct: "产品标签体系_v4_0722.xlsx / 阶梯型体系（三级）",
      rectificationCause: "标签体系/厦门国际银行-0721-原因标签体系.xlsx / 原因标签体系 (修改)（三级，排除‘删’项）"
    }
  },
  rectificationProduct: { label:"投诉产品标签", levels:["一级产品标签","二级产品标签","三级产品标签"], kind:"cascader", tree:rectificationTagDictionaries.productTree || [] },
  rectificationCause: { label:"投诉原因标签", levels:["一级原因标签","二级原因标签","三级原因标签"], kind:"cascader", tree:rectificationTagDictionaries.causeTree || [] }
};
const normalizeSourceText = text => text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const sourceText = Object.values(files).map(file => normalizeSourceText(fs.readFileSync(file, "utf8"))).join("\n");
const sourceHash = crypto.createHash("sha256").update(sourceText).digest("hex").slice(0, 16);
const payload = {
  sourceHash,
  formSchema: readJson(files.formSchema),
  workflowSchema: readJson(files.workflowSchema),
  statusTagConfig: readJson(files.statusTagConfig),
  complaintPermissionRules: readJson(files.complaintPermissionRules),
  seedData: readJson(files.seedData),
  customerData: readJson(files.customerData),
  organizationTree: readJson(files.organizationTree),
  tagTrees,
  subprocessInitiationRules: readJson(files.subprocessInitiationRules),
  regionTree: readJson(files.regionTree)
};

const output = [
  "/* Generated from data/forms/*.json and data/*.json by tools/sync-prototype-data.js. Do not edit directly. */",
  "window.XIB_PROTOTYPE_CONFIG = " + JSON.stringify(payload, null, 2) + ";",
  ""
].join("\n");
fs.writeFileSync(path.join(dataDir, "prototype-data.runtime.js"), output, "utf8");
console.log("Generated data/prototype-data.runtime.js");
