(function (global, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.XIBCustomerRepository = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();

  function residenceText(customer) {
    const residence = customer?.residence;
    if (!residence) return "";
    return [residence.province, residence.city, residence.district].filter(Boolean).join(" / ");
  }

  function toFormFields(customer) {
    if (!customer) return {};
    return {
      "客户姓名": customer.name || "",
      "客户编号": customer.id || "",
      "客户类型": customer.type || "",
      "证件类型": customer.identity?.type || "",
      "证件号码": customer.identity?.number || "",
      "预留手机号码": customer.contact?.mobile || "",
      "所属客户经理": customer.relationship?.manager || "",
      "客户经理所属机构": customer.relationship?.organization || "",
      "出生年份": customer.demographics?.birthYear || "",
      "客户性别": customer.demographics?.gender || "",
      "是否境内": customer.demographics?.domestic == null ? "" : customer.demographics.domestic ? "是" : "否",
      "国家地区": customer.demographics?.country || "",
      "居住地 省/市/区": residenceText(customer)
    };
  }

  function snapshotCustomer(entry = {}, row = []) {
    const id = String(entry["客户编号"] || "").trim();
    const name = String(entry["客户姓名"] || row[2] || "").trim();
    if (!id && !name) return null;
    const residenceParts = String(entry["居住地 省/市/区"] || "").split(" / ").filter(Boolean);
    return {
      id,
      status:"工单快照",
      name,
      type:entry["客户类型"] || "",
      identity:entry["证件类型"] || entry["证件号码"] ? { type:entry["证件类型"] || "", number:entry["证件号码"] || "" } : null,
      contact:{ mobile:entry["预留手机号码"] || "" },
      demographics:{
        birthYear:entry["出生年份"] || "",
        gender:entry["客户性别"] || "",
        domestic:entry["是否境内"] === "是" ? true : entry["是否境内"] === "否" ? false : null,
        country:entry["国家地区"] || ""
      },
      residence:residenceParts.length ? { province:residenceParts[0] || "", city:residenceParts[1] || "", district:residenceParts[2] || "" } : null,
      relationship:{ manager:entry["所属客户经理"] || "", organization:entry["客户经理所属机构"] || "" }
    };
  }

  function create(customerData = {}) {
    const customers = Array.isArray(customerData.customers) ? customerData.customers.map(clone) : [];
    const byId = new Map(customers.map(customer => [normalize(customer.id), customer]));

    function get(id) {
      return clone(byId.get(normalize(id)) || null);
    }

    function canonicalId(id) {
      const customer = byId.get(normalize(id));
      return customer?.mergedIntoCustomerId || customer?.id || String(id || "");
    }

    function find(query = {}) {
      const customerNo = normalize(query.customerNo);
      const documentNo = normalize(query.documentNo);
      const accountNo = normalize(query.accountNo);
      const mobile = normalize(query.mobile);
      if (!customerNo && !documentNo && !accountNo && !mobile) return [];
      const accountValues = customer => {
        const accounts = customer?.accounts;
        return [
          customer?.accountNo,
          customer?.account,
          customer?.contact?.account,
          ...(Array.isArray(accounts) ? accounts : [accounts])
        ].map(normalize).filter(Boolean);
      };
      return customers
        .filter(customer => {
          const accountMatches = accountNo && accountValues(customer).includes(accountNo);
          const mobileMatches = mobile && [customer?.contact?.mobile, customer?.contact?.phone].map(normalize).includes(mobile);
          return Boolean(
            (customerNo && normalize(customer.id) === customerNo) ||
            (documentNo && normalize(customer.identity?.number) === documentNo) ||
            accountMatches ||
            mobileMatches
          );
        })
        .sort((left, right) => {
          const statusOrder = status => status === "正常" ? 0 : status === "已合并" ? 2 : 1;
          return statusOrder(left.status) - statusOrder(right.status) || String(left.id).localeCompare(String(right.id));
        })
        .map(clone);
    }

    function resolveFromTicket(row, documentRecord) {
      const entry = documentRecord?.fields?.entry || {};
      return get(entry["客户编号"]) || snapshotCustomer(entry, row);
    }

    function customerIdFromTicket(row, documentRecord) {
      const entry = documentRecord?.fields?.entry || {};
      return canonicalId(entry["客户编号"] || "");
    }

    function matchesTicket(customerId, row, documentRecord) {
      const target = canonicalId(customerId);
      return Boolean(target) && customerIdFromTicket(row, documentRecord) === target;
    }

    return Object.freeze({
      schemaVersion:customerData.schemaVersion || "",
      asOfDate:customerData.asOfDate || "",
      all:() => customers.map(clone),
      get,
      find,
      canonicalId,
      resolveFromTicket,
      customerIdFromTicket,
      matchesTicket,
      residenceText,
      toFormFields,
      snapshotCustomer
    });
  }

  return Object.freeze({ create, residenceText, toFormFields, snapshotCustomer });
});
