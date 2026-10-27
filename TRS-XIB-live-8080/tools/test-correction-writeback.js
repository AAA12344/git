"use strict";
const assert = require("assert");
const writeback = require("../src/modules/complaints/correction-writeback");
const changes = writeback.buildChanges({
  fields:[{ name:"投诉/信访事项", writebackField:"投诉/信访事项" }, { name:"业务办理渠道" }, { name:"修正投诉诉求标签" }],
  values:{ "投诉/信访事项":"贷款催收", "业务办理渠道":"手机银行", "修正投诉诉求标签":"费用减免" },
  originalValues:{ "投诉/信访事项":"贷款业务办理", "业务办理渠道":"手机银行", "修正投诉诉求标签":"协商处理" },
  existingOverrides:{ "投诉诉求标签":"协商还款类 / 协商处理" },
  entry:{ "投诉/信访事项":"贷款业务办理", "业务办理渠道":"A-01033 移动客户端" },
  fieldMap:{ "修正投诉诉求标签":"投诉诉求标签" }
});
assert.deepStrictEqual(changes, [
  { field:"投诉/信访事项", oldValue:"贷款业务办理", newValue:"贷款催收" },
  { field:"投诉诉求标签", oldValue:"协商还款类 / 协商处理", newValue:"费用减免" }
], "办结回写应映射已修改字段并排除仅因表单归一化产生差异的未修改字段");
assert.strictEqual(writeback.latest([{ subprocessId:"JZ-OLD", completedAt:"2026-01-01 10:00:00", changes:[] }, { subprocessId:"JZ-NEW", completedAt:"2026-02-01 10:00:00", changes:[{}] }]).subprocessId, "JZ-NEW", "应采用办结时间最新的投诉校正记录");
assert.strictEqual(writeback.prefillValue({ sourceNames:["客户类型"], sourceValues:{ "客户类型":"非自然人" }, overrides:{ "客户类型":"自然人" } }), "自然人", "后续投诉校正应优先预填主单最新校正值");
console.log("Complaint correction writeback checks passed.");
