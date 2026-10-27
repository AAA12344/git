(function () {
  "use strict";

  const PROTOTYPE_CONFIG = window.XIB_PROTOTYPE_CONFIG;
  if (!PROTOTYPE_CONFIG?.formSchema || !PROTOTYPE_CONFIG?.workflowSchema || !PROTOTYPE_CONFIG?.statusTagConfig || !PROTOTYPE_CONFIG?.seedData || !PROTOTYPE_CONFIG?.customerData) {
    throw new Error("原型结构化数据未加载，请确认 data/prototype-data.runtime.js 已在 app.js 前引入。");
  }
  const FORM_SCHEMA = PROTOTYPE_CONFIG.formSchema;
  const DISABLED_WORK_ORDER_TYPES = new Set(["舆情单"]);
  const visibleWorkOrderTypes = types => (types || []).filter(type => !DISABLED_WORK_ORDER_TYPES.has(type));
  const WORKFLOW_SCHEMA = PROTOTYPE_CONFIG.workflowSchema;
  const STATUS_TAG_CONFIG = PROTOTYPE_CONFIG.statusTagConfig;
  const SEED_DATA = PROTOTYPE_CONFIG.seedData;
  const CUSTOMER_DATA = PROTOTYPE_CONFIG.customerData;
  if (!window.XIBCustomerRepository) throw new Error("客户数据服务未加载，请确认 customer-repository.js 已在 app.js 前引入。");
  const CUSTOMER_REPOSITORY = window.XIBCustomerRepository.create(CUSTOMER_DATA);
  const CURRENT_USER_ACTOR = "陈敏慧-60157";
  const CUSTOMER_MANAGER_OPTIONS = Object.freeze(["泰罗-12128", "泰迪-13250", "泰森-99635", "王布鲁-66596", "张波旗-44756", "刘倩-55942"]);
  const deepClone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const seedList = name => deepClone(SEED_DATA.lists?.[name] || []);
  function normalizeRelatedTicketIds(value) {
    const flattened = Array.isArray(value) ? value.flat(Infinity) : [value];
    const ids = flattened.flatMap(item => String(item ?? "")
      .replace(/[`´｀]+/g, "、")
      .split(/[、,，;；\s]+/)
      .map(ticketId => ticketId.trim())
      .filter(ticketId => ticketId && /[A-Za-z0-9]/.test(ticketId)));
    return [...new Set(ids)];
  }
  const ticketRecordToRow = record => [record.id, record.type, record.customer, record.subject, record.org, record.status, record.updatedAt];
  const subprocessRecordToRow = record => [record.id, record.type, record.relatedTicketId, record.customer, record.org, record.status, record.updatedAt];
  const rectificationRecordToRow = record => [record.id, record.type, normalizeRelatedTicketIds(record.relatedTicketIds).join("、"), record.customer, record.org, record.status, record.updatedAt, record.title, record.node, Boolean(record.hasAttachment)];
  const approvalRecordToRow = record => [record.id, record.approvalType, record.approvalType === "导出申请审批" ? normalizeExportRequestType(record.businessType) : record.businessType, record.applicant, record.org, record.node, record.remainingTime, record.appliedAt || "", record.relatedTicketId || "", record.relatedSubprocessId || "", record.status || ""];
  const EXPORT_REQUEST_TYPES = Object.freeze(["工单", "子单", "溯源整改单", "报表"]);
  const EXPORT_LEDGER_TYPES = Object.freeze(["子单", "工单", "整改单", "报表", "核查记录", "报告"]);
  const EXPORT_REQUEST_STATUSES = Object.freeze(["待提交", "待审批", "审批中", "已通过", "已驳回"]);
  function normalizeExportRequestType(value) {
    const source = String(value || "");
    if (!source) return "";
    if (EXPORT_REQUEST_TYPES.includes(source)) return source;
    if (/子流程|子单/.test(source)) return "子单";
    if (/溯源|整改/.test(source)) return "溯源整改单";
    if (/报表|统计/.test(source)) return "报表";
    return "工单";
  }
  function exportApplicantDepartment(record = {}) {
    if (record.department) return record.department;
    const institution = String(record.org || "");
    if (!institution) return "";
    return institution === "总行" ? "总行消费者权益保护部" : institution + "消费者权益保护部";
  }
  const exportRequestToRow = record => [record.id, normalizeExportRequestType(record.exportType), record.dataScope, record.applicant, record.org, record.status, record.node, record.appliedAt, (record.relatedTicketIds || []).join("、"), (record.relatedSubprocessIds || []).join("、"), record.desensitization || "", (record.sensitiveFields || []).join("、"), record.reason || "", record.approver || "", record.approverOrg || "", record.exportStatus || (record.status === "已通过" ? "可下载" : ""), exportApplicantDepartment(record), record.transferReason || "", record.approvalOpinion || "", record.approvedAt || "", record.expiresAt || "", (record.relatedRectificationIds || []).join("、")];
  const importJobToRow = record => [record.fileName, record.createdAt, record.status];

  const APP_CONFIG = window.XIB_APP_CONFIG;
  if (!APP_CONFIG?.roleLabels || !APP_CONFIG?.orgRoleOptions || !APP_CONFIG?.navigation || !APP_CONFIG?.permissions || !APP_CONFIG?.pageMeta) {
    throw new Error("应用配置未加载，请确认 src/core/app-config.js 已在 app.js 前引入。");
  }
  const ROLE_LABELS = APP_CONFIG.roleLabels;
  const ORG_ROLE_OPTIONS = APP_CONFIG.orgRoleOptions;
  const NAV = APP_CONFIG.navigation;
  const PERMISSIONS = APP_CONFIG.permissions;
  const PAGE_META = APP_CONFIG.pageMeta;
  const ROUTE_ALIASES = APP_CONFIG.routeAliases || {};
  const normalizeRoute = page => ROUTE_ALIASES[page] || page;
  const COMPLAINT_PERMISSION_RULES = PROTOTYPE_CONFIG.complaintPermissionRules?.rules || [];
  const COMPLAINT_WORK_POOL = window.XIBComplaintWorkPool;
  if (!COMPLAINT_WORK_POOL) throw new Error("投诉工单池服务未加载，请确认 work-pool.js 已在 app.js 前引入。");

  function complaintPoolView(scope) {
    const views = { "我的工作台": "workbench", "机构工单池": "org", "下辖工单池": "subOrg" };
    if (!views[scope]) throw new Error("未知工单池视图：" + scope);
    return views[scope];
  }

  function approvalPoolKind(row) {
    return row[1] === "工单审批" ? "ticket" : "subprocess";
  }


  function roleProfiles() {
    return ORG_ROLE_OPTIONS.flatMap(org => org.roles.map(role => ({ ...role, org: org.id, orgLabel: org.label, institutionLabel: org.institutionLabel || "总行", departmentLabel: org.departmentLabel || "" })));
  }

  function defaultRoleProfile(role = "operator") {
    return roleProfiles().find(profile => profile.role === role) || roleProfiles()[0];
  }

  function currentRoleProfile() {
    return roleProfiles().find(profile => profile.id === state.roleProfile) || defaultRoleProfile(state.role);
  }

  function renderRoleCascader() {
    const profile = currentRoleProfile();
    const activeOrg = ORG_ROLE_OPTIONS.find(org => org.id === profile.org) || ORG_ROLE_OPTIONS[0];
    return `<label class="top-role-control"><span>视角</span><div class="role-cascader" data-role-cascader data-active-org="${activeOrg.id}"><button type="button" class="role-cascader-trigger" id="role-cascade-trigger" aria-expanded="false"><span>${profile.orgLabel} / ${profile.label}</span><img src="ui/assets/caret-bottom.svg" alt=""></button><div class="role-cascader-popover" hidden><div class="role-cascader-column role-org-column">${ORG_ROLE_OPTIONS.map(org => `<button type="button" class="${org.id === activeOrg.id ? "is-active" : ""}" data-role-org="${org.id}">${org.label}</button>`).join("")}</div><div class="role-cascader-column role-profile-column">${activeOrg.roles.map(role => `<button type="button" class="${role.id === profile.id ? "is-active" : ""}" data-role-profile="${role.id}">${role.label}</button>`).join("")}</div></div></div></label>`;
  }
  const RISK_TAG_CATALOG = [{"dimension":"易投诉风险","primary":"特定身份人群","label":"高龄老人","level":"高","definition":"指投诉人是60-79周岁的老年人，对金融业务规则理解能力较弱、数字操作不熟练、防骗意识不足"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"超高龄老人","level":"高","definition":"指投诉人是80周岁及以上的老年人，身体机能与认知水平进一步下降，行动不便且风险承受能力极低，对上门服务、简化流程需求强烈，也可能是子女或亲属代办业务。按以下步骤进行判定：\n1、判断是否提到有超高龄老人，如果有提到，进入步骤2，否则不触发此标签，结束；\n2、判断超高龄老人是否是投诉人，如果是，属于此标签；否则不属于，结束判断。投诉人有两种情况：一是与客服沟通的人自己是超高龄老人、二是与客服沟通的人代超高龄老人投诉。两种情况中投诉人必须与投诉事件直接相关。"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"未成年","level":"高","definition":"指投诉人是未满18周岁的客户，缺乏独立金融决策能力，多为家长代为投诉。若只有\"儿子\"\"孩子\"等关键词未提及年龄，不触发此标签。"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"重要客户","level":"中","definition":"属于客户财富等级高，属于在银行金融资产持续达标的高价值客户，享有私人银行专属服务，对应差异化的服务权益与资源倾斜。投诉人可能自述自己为VIP客户。"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"新市民","level":"中","definition":"新市民是指因各种原因来到城市生活，但尚未完全融入城市的人群。这些人群包括因创业、就业、子女上学等原因而迁移至城市的人员，如农民工、新就业的大中专毕业生等。"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"器质性病变","level":"中","definition":"投诉人身体器官组织出现结构性损伤，经医学检查可明确诊断的病变类型。例如：冠心病、肾结石、肺炎等，严重器质性病变可能导致截肢，包括先天/后天残疾人。"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"孕妇","level":"低","definition":"指投诉人是处于孕期的客户，行动不便且需规避健康风险，对业务办理效率、等候环境、便捷服务（如优先办理）有特殊需求的敏感人群"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"宝妈/宝爸","level":"低","definition":"指投诉人是处于婴幼儿照料期的女性客户，时间碎片化且需兼顾育儿。按以下步骤进行判定：\n1、判断是否提到小孩年龄，如果有提到，进入步骤2，否则进入步骤3；\n2、判断小孩年龄是否处于婴幼儿时期或在上幼儿园，如果是，输出此标签，否则不可输出此标签，结束判断；\n3、判断是否涉及\"奶粉\"、\"尿不湿\"、\"宝宝\"等关键词，如果是，输出此标签，否则不可输出此标签，结束判断。"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"重大手术康复期","level":"高","definition":"指投诉人接受重大手术后处于康复阶段，行动能力与身体耐受度有限，需减少线下奔波。"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"其他特殊人士","level":"高","definition":"个人特殊状况（如独居无依、遭遇重大变故等）。"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"危重病客户","level":"高","definition":"投诉人患有恶性肿瘤、心脏病等重大疾病且处于治疗期的客户，身体状况导致行动受限、不能自理、生命垂危，一般现场处理时风险较高"},{"dimension":"易投诉风险","primary":"特定身份人群","label":"疑似心理状态异常","level":"高","definition":"投诉人疑似存在精神行为或情绪异常（如抑郁症、焦虑障碍、心境障碍等精神障碍疾病），容易作出危及自己生命的过激举动，"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"法律从业者","level":"中","definition":"客户自述从事律师、法官或检察官的工作。对法律程序较为熟悉或法律专业术语的频繁使用，均不符合法律从业者的特征定义"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"行政事业机构人员","level":"中","definition":"C-ESP-客户来源-行政事业机构客户、监管机构从业者"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"金融行业从业者","level":"高","definition":"指投诉人是在金融行业从事各种专业工作的职业人士。金融行业涵盖银行业、保险业、证券业等多个领域，金融人员就是在这些领域中提供专业服务，包括财务分析、投资决策、风险管理等。"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"媒体从业者","level":"高","definition":"投诉人是记者、网红大V、自媒体、博主、新闻编辑、主持人、评论员、舆情分析师等职业。"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"教育及人力从业者","level":"高","definition":"投诉人从事教育或人力工作，平时工作场景中习惯一言堂，投诉中不接受不同意见，易给沟通对象造成心理压抑的群体。"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"警察","level":"中","definition":"投诉人必须在文本中明确提及自己的职业为警察、公安、交警等系统人员或公安机关工作身份。只要投诉人没明确说自己是警察，均不触发此标签。"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"低端从业者","level":"高","definition":"投诉人职业层级偏低，人群构成复杂，反复投诉但不愿意沟通，可能有很多交流群会交流投诉经验，如大货车司机。"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"无业","level":"高","definition":"投诉人无固定职业，大龄未婚者风险较高，容易因无聊或生活不顺深夜致电客服的群体，且有充足的空闲时间投诉。"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"男性科研人员","level":"中","definition":"此类人群为从事科技研发的男性，性格较真，投诉事项较难处理。"},{"dimension":"易投诉风险","primary":"特定职业人群","label":"退伍军人","level":"中","definition":"客户自述为退伍军人。通常有一定沟通难度，且相关政策、业务具备一定特殊性。"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁投诉至金融监管机构","level":"低","definition":"客户威胁要找金融监管机构投诉，如金融监管总局(含金融消保中心)、12378、金融消费者保护服务平台，如果没有提到以上关键词，不属于此标签。排除场景：拨打银行客服(955xx/400xx)或内部热线、拨打12388等政府部门热线。"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁起诉","level":"低","definition":"客户提到要起诉、或说到法院见、或称自己会寻求法律援助。排除场景：因为银行这边的疏忽导致需要通过司法途径帮忙、司法上诉不是因为觉得银行有问题。"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁投诉至政府机构或社会团体","level":"中","definition":"客户威胁要找政府机构或社会团体投诉，如人民银行、中国消协、金融工会、12315、12345、12388。"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁信访","level":"中","definition":"以向信访部门递交书面材料、反复实地走访信访机构为要挟。"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁投诉各级巡视组","level":"中","definition":"明确声称要向巡视组反映相关单位或人员的违规问题，依托巡视监督的权威性放大诉求影响力"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁投诉至人大政协代表","level":"中","definition":"客户威胁自己会将与银行的争议情况反馈给人大代表、政协委员。"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁或要求升级至行内上级部门","level":"低","definition":"客户认为现沟通人员级别不够，威胁、要求或声称已经找行领导、上级行、总行，或拨打银行内部客服(955xx等)升级。排除场景：外部监管机构、只说是'过激行为'但没说哪种、声称会对上级（如行长）造成不良影响、投诉上级行。"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁自杀","level":"高","definition":"以跳楼、服毒等极端自伤方式威胁，意图施压。"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁投诉银行工作人员","level":"中","definition":"客户明确表示将会投诉该工作人员，理由往往是客户投诉工作人员服务态度差、说话生硬、挂电话等。注意与其他威胁投诉情况进行区分，威胁投诉监管、威胁起诉均不属于此类标签。"},{"dimension":"易投诉风险","primary":"以威胁手段要挟","label":"威胁媒体曝光","level":"高","definition":"扬言向抖音、微博等各类媒体平台或网络大V披露相关争议事项，要挟对方满足自身诉求"},{"dimension":"涉黑灰产","primary":"认知与话术特征","label":"专业名词堆砌","level":"中","definition":"1.检查客户是否直接让客服帮忙查询从开卡到现在的分期手续费、利息、违约金、年费、罚息等。如果没有直接说，则不属于此类标签，结束。如果有，进入下一步。2.结合全文分析客户的态度，如果是正常沟通且最后协商成功，不属于此类标签，否则属于。"},{"dimension":"涉黑灰产","primary":"认知与话术特征","label":"法律认知异常","level":"高","definition":"用户在沟通过程中能直接引用说出完整的法律条款，包括不限于《个人信息保护法》、《信用卡监督管理办法》等（例如：《信用卡监督管理办法》第70条：欠款超出了持卡人还款能力的，且持卡人仍有还款意愿的情况下，发卡行可以与持卡人平等地协商，达成一个个性化分期的还款协议，而且最长的可以分5年60期偿还所有欠款）。注意客户通过上网查询或咨询律师的方式得知相关法律条款不属于此类标签。认知错误异常也不属于此类标签。"},{"dimension":"涉黑灰产","primary":"诉求合理性异常","label":"高诉求","level":"高","definition":"例如对银行提出的分期方案不接受，强调一定要分分5年60期、直接回绝银行的减免方案；或投诉人所要求的赔偿多于正常赔偿数额1倍及以上"},{"dimension":"涉黑灰产","primary":"诉求合理性异常","label":"投诉内容异常","level":"高","definition":"业务关系已完结，客户向会员单位提出违反业务合同内容诉求。"},{"dimension":"涉黑灰产","primary":"表述策略类","label":"刻意夸大事实","level":"中","definition":"客户描述自身情况刻意夸大事实，例如“家庭关系出现了破裂我活不下去了”、“要离婚分家”、“不想活了”等等。单纯骂人地极端表达不属于此标签。"},{"dimension":"涉黑灰产","primary":"表述策略类","label":"规避投诉关键词","level":"高","definition":"在监管热线沟通中刻意回避“投诉”类关键词，表示想要和银行协商一下处理，达到让客服一键转接相关机构的目的"},{"dimension":"涉黑灰产","primary":"表述策略类","label":"对比他人","level":"低","definition":"质问银行为什么其他人可以申请，哪家先处理就先还哪家"},{"dimension":"涉黑灰产","primary":"表述策略类","label":"弱化自身","level":"高","definition":"虚构弱势群体身份博取同情，留证加剧威胁：虚构了离婚净身出户、破产被起诉场景：“再拖我就断供，房子将被查封，需记录工号作为证据”。需要结合整体情况判断，不可根据单独的一句话断章取义。不可以纯推断，一定要有实际根据。且一定是说自己或自己的家庭情况很可怜，不是说别人很可怜。"},{"dimension":"涉黑灰产","primary":"表述策略类","label":"指责银行未告知","level":"中","definition":"指责银行方没有告知、和之前说的不一样、没有给出合适的方案等等，总之把过错都推给银行，借此向银行索取赔偿或提出诉求。"},{"dimension":"涉黑灰产","primary":"结论与逻辑问题","label":"结论推翻","level":"中","definition":"是指客户自己推翻之前的诉求，提出新的诉求。银行修改方案、客户不同意银行的要求均不属于此类标签。"},{"dimension":"涉黑灰产","primary":"沟通行为提及","label":"主动提及交材料","level":"中","definition":"客户为了达成诉求主动说“我准备了失业证明、病例等材料，现在真的特别困难”。客户要求银行提供材料的情况不属于此标签。"},{"dimension":"涉黑灰产","primary":"沟通行为提及","label":"表明录音留证","level":"高","definition":"检查客户是否明确表示自己在录音，且多次问客服的工号是多少，以此作为威胁。如果是，属于此标签。"},{"dimension":"涉黑灰产","primary":"异常行为","label":"威胁闹访","level":"中","definition":"客户威胁内容未实践，只是口头威胁，属于未完成时态。闹访是指信访人在信访过程中采取过激行为，如非法聚集、围堵冲击国家机关、拦截公务车辆等不正当手段试图达到个人目的。此标签要追溯到原文的语句，不可推断、暗示。"},{"dimension":"涉黑灰产","primary":"异常行为","label":"威胁异常催办","level":"高","definition":"多次对自己不正当，不合理诉求的投诉要求催办"},{"dimension":"涉黑灰产","primary":"异常行为","label":"非本人投诉","level":"高","definition":"通过核身/冒充家人且拒绝提供涉及业务本人联系方式沟通过程中，对投诉事项本身及细节不了解可能涉及多位投诉人投诉同一事项常见场景：个贷（住房贷款-烂尾楼）"},{"dimension":"涉黑灰产","primary":"虚假身份","label":"代理投诉","level":"高","definition":"投诉人疑似身份为代理律师，进行投诉代理"},{"dimension":"涉黑灰产","primary":"虚假身份","label":"主动承认代理身份","level":"高","definition":"客户承认自己是代理投诉者或表明自己委托中介/代理人进行投诉"},{"dimension":"缠诉闹诉","primary":"升级投诉","label":"我行投诉升级监管投诉","level":"高","definition":"判断是否由我行内部投诉，升级为12378+监管网微渠道监管呼转投诉，输出是/否。"},{"dimension":"缠诉闹诉","primary":"升级投诉","label":"监管呼转投诉升级监管转办投诉","level":"高","definition":"判断是否由12378+监管网微渠道监管呼转投诉，升级为监管转办投诉，输出是/否。"},{"dimension":"缠诉闹诉","primary":"重复投诉","label":"重复监管呼转投诉","level":"中","definition":"投诉人姓名、业务类别大类、被投诉机构一致，且拨打12378热线+监管网微渠道投诉后呼转至本行次数大于等于2次，输出是/否。"},{"dimension":"缠诉闹诉","primary":"重复投诉","label":"重复监管转办投诉","level":"中","definition":"投诉人姓名、业务类别大类、被投诉机构一致，且拨打12378热线+监管网微渠道投诉至监管机构，由监管转办次数大于等于2次，输出是/否。"},{"dimension":"缠诉闹诉","primary":"重复投诉","label":"重复投诉","level":"中","definition":"投诉人姓名、业务类别大类、被投诉机构一致，不限制投诉来源，次数大于等于2次，输出是/否。"},{"dimension":"缠诉闹诉","primary":"人身或场所安全类威胁","label":"威胁围堵网点及网点员工","level":"中","definition":"以围堵网点、拦截员工，干扰机构正常运营相要挟"},{"dimension":"缠诉闹诉","primary":"人身或场所安全类威胁","label":"威胁冲击网点前台柜台","level":"中","definition":"威胁要强行冲击网点前台柜台，破坏服务秩序"},{"dimension":"缠诉闹诉","primary":"人身或场所安全类威胁","label":"威胁跟踪骚扰相关人员","level":"高","definition":"在录音中扬言要对网点工作人员或其家属，实施持续性跟踪、电话/信息骚扰、上门滋扰等行为"},{"dimension":"缠诉闹诉","primary":"人身或场所安全类威胁","label":"电话言语骚扰工作人员","level":"高","definition":"客户通过电话渠道，针对工作人员进行与业务无关的、具有冒犯性或重复性的言语性骚扰。例如：明确拒绝男性工作人员接电话，一定要女性工作人员接听，且进行言语骚扰。（注意单纯的辱骂不属于此类标签，属于使用辱骂性词汇）"},{"dimension":"缠诉闹诉","primary":"人身或场所安全类威胁","label":"威胁破坏网点设备","level":"中","definition":"扬言损坏网点办公、服务等各类设备"},{"dimension":"缠诉闹诉","primary":"人身或场所安全类威胁","label":"使用辱骂性词汇","level":"高","definition":"指客户在沟通中使用各类严重辱骂性质词汇（例如你脑子有毛病吧、傻逼等等），反映其态度恶劣。注意类似于“你们与开发商勾结”、”你是黑社会“、”你没良心“的指责不属于辱骂性词汇。"},{"dimension":"缠诉闹诉","primary":"外部渠道类威胁","label":"威胁示威抗议","level":"中","definition":"煽动多人聚集示威，线下拉横幅、借群体性事件扩大影响以实现施压目的"},{"dimension":"缠诉闹诉","primary":"外部渠道类威胁","label":"威胁报警","level":"低","definition":"以报警为借口，恶意利用执法资源施压"},{"dimension":"缠诉闹诉","primary":"偏执投诉","label":"借群体性事件无理投诉","level":"中","definition":"按照以下步骤进行判定：\n1.判断投诉内容是否明确提及以下具体社会热点事件的其中一件：保交楼风险事件、群访事件、云联惠事件。如果没有提及，不属于此类标签，结束。如果有提及，进入步骤2。\n2.结合全文分析客户是否以社会热点或群体性事件为由，提出与自身权益无关或明显夸大的诉求，借机向银行施压，如果是，属于此标签，否则不属于。"},{"dimension":"缠诉闹诉","primary":"偏执投诉","label":"长期遗留问题纠缠","level":"高","definition":"1.判断根据对话内容能否判定对话时间跨度，如果不能，则不属于这类标签。如果能，进入下一步。\n2.投诉事项持续超过一年，客户因时间长久、牵扯不清的复杂问题长期投诉，或者在问题与当前银行无直接关联的情况下持续要求解决。"},{"dimension":"缠诉闹诉","primary":"无理要求银行承担损失","label":"被第三方诈骗","level":"中","definition":"客户因第三方机构诈骗遭受资金损失，仍坚持向银行提出索赔或追责的投诉行为"},{"dimension":"缠诉闹诉","primary":"无理要求银行承担损失","label":"转嫁经营风险","level":"高","definition":"1.判断客户是否因为经营失败/理财失败/投资失败/买房失败而投诉。如果不是，不属于此标签，结束。否则进入下一步；2.结合全文分析客户是否将自己的的风险与损失要求由银行承担，以此为由拒绝还贷或要求银行赔偿。"},{"dimension":"疑似牟利","primary":"诉求与利益特征","label":"小额利益导向","level":"高","definition":"诉求集中在减免息费、利息退还、小额赔付（几十到几千元）、没领到银行的礼品、使用优惠券或积分产生损失等问题，无大额损失主张，目的是为了获得一些金钱利益，占小便宜。不包含客户申请个人养老金、提高信用卡额度、希望消除逾期记录的情况。"},{"dimension":"疑似牟利","primary":"诉求与利益特征","label":"无理损失索赔","level":"高","definition":"客户强调自己因银行责任遭受财产损失，要求银行赔偿，但无法提供实际损失证明，最终目的是要求银行赔钱。注意希望提高额度、减免息费等不涉及银行赔偿的情况不属于此类标签。"},{"dimension":"疑似牟利","primary":"投诉行为特征","label":"通过找茬方式获利","level":"低","definition":"客户仅以工作人员态度不好、银行操作流程或宣传表述等轻微违规等情况为由索赔一定的金额，或通过找茬的方式引导工作人员出错，或没事找事，借此机会谋取小利补偿、礼品等。如果没有找茬的行为，无论是否为了获利都不属于此类标签。"},{"dimension":"疑似牟利","primary":"投诉行为特征","label":"交叉对比施压索赔","level":"中","definition":"以其他银行同类业务免费、低价或服务更优为由，要求银行减免小额费用，借助对比放大诉求合理性。常见客户表述：别的银行都可以，为什么你们不行。"}];
  const DEFAULT_CONTENT_RISK_TAGS = ["威胁自杀", "威胁信访", "威胁媒体曝光"];
  const DEFAULT_GRAY_RISK_TAGS = ["专业名词堆砌", "弱化自身", "非本人投诉"];
  const DISPOSITION_DEADLINE_RULES = Object.freeze({
    ticket: Object.freeze({
      "投诉单": { mode: "offset", days: 15, label: "接收时间 +15个自然日" },
      "再次投诉单": { mode: "inherit", label: "继承关联主工单处置期限" },
      "信访单": { mode: "manual", label: "无默认期限，由经办人手工录入" },
      "表扬单": { mode: "offset", days: 10, label: "接收时间 +10个自然日" },
      "建议单": { mode: "offset", days: 10, label: "接收时间 +10个自然日" },
      "舆情单": { mode: "offset", days: 15, label: "接收时间 +15个自然日（规则预留）" }
    }),
    subprocess: Object.freeze({
      "投诉问责": { mode: "offset", days: 15, label: "申请时间 +15个自然日" },
      "投诉校正": { mode: "offset", days: 15, label: "申请时间 +15个自然日" },
      "投诉调查": { mode: "offset", days: 15, label: "申请时间 +15个自然日" },
      "异常投诉": { mode: "offset", days: 15, label: "申请时间 +15个自然日" },
      "剔除申请": { mode: "offset", days: 15, label: "申请时间 +15个自然日" },
      "异议核查": { mode: "offset", days: 30, label: "申请时间 +30个自然日" },
      "延长申请": { mode: "inherit", label: "继承关联主工单处置期限" },
      "撤销投诉": { mode: "inherit", label: "继承关联主工单处置期限" },
      "废止申请": { mode: "inherit", label: "继承关联主工单处置期限" },
      "纠纷化解": { mode: "none", label: "无处置期限" }
    }),
    request: Object.freeze({
      "短信审批": { mode: "offset", hours: 8, label: "申请时间 +8小时" },
      "导出申请审批": { mode: "offset", hours: 8, label: "申请时间 +8小时" }
    }),
    rectification: Object.freeze({
      "溯源整改": { mode: "pending", label: "处置期限待业务规则确认" }
    })
  });
  const RISK_REASON_OVERRIDES = {
    "威胁自杀": "虽未直接说出“自杀”二字，但连续表达“没有希望了”“谁也救不了我”“这是最后一通投诉”等，并结合既往投诉历史中的负面情绪升级趋势，系统将提高敏感度。",
    "威胁信访": "虽未直接说出“上访”或具体的政府部门名称，但连续表达“我要去上面讨说法”“你们不管我就找更大的领导”“不行就去门口坐着等”等，存在信访升级风险。",
    "威胁媒体曝光": "未直接说出“发布到媒体”或具体平台名称，但连续表达“让所有人都看看”“总有地方能讲理”“我手里的东西不怕没人看”等，并结合过往投诉中曾提及收集录音、截图等证据并扬言公开的趋势，系统将提高对媒体曝光行为风险的敏感度。",
    "专业名词堆砌": "投诉内容中虽未直接提及具体黑灰产行为，但连续出现大量与互联网金融、支付、风控、账户安全相关的非常规专业术语，且术语密集堆叠，同时缺乏对自身具体遭遇的自然、连贯描述。",
    "弱化自身": "投诉内容中反复使用“帮朋友问的”“替别人反映”“我只是中间人”等表达，刻意与投诉事项保持距离，同时回避提供与账户、订单、交易记录直接相关的个人关键信息。",
    "非本人投诉": "投诉内容前后身份陈述不一致，对关键交易细节了解有限，且拒绝提供涉及业务本人的有效联系方式，系统据此提示可能存在非本人投诉风险。"
  };

  const state = {
    currentUserActor: localStorage.getItem("xib-current-user-actor") || CURRENT_USER_ACTOR,
    role: localStorage.getItem("xib-role") || "operator",
    org: localStorage.getItem("xib-org") || defaultRoleProfile(localStorage.getItem("xib-role") || "operator").org,
    roleProfile: localStorage.getItem("xib-role-profile") || defaultRoleProfile(localStorage.getItem("xib-role") || "operator").id,
    page: normalizeRoute(location.hash.replace(/^#\/?/, "") || "home-tasks"),
    openGroups: new Set(["complaint"]),
    openSubgroups: new Set(["ticket", "request", "rectification", "inspection-warning", "stats-complaint"]),
    menuOpen: false,
    createTab: "全部",
    processScope: "我的工作台",
    processTab: "待办",
   processTicketType: "",
    rectificationMode: "view",
    rectificationEditId: "",
    rectificationReturnPage: "rectification-create",
    approvalTab: "工单审批",
    approvalScope: "我的工作台",
    approvalPoolTab: "\u5de5\u5355\u5ba1\u6279",
    approvalWorkTab: "待办",
    approvalFilterType: "",
    historyTicketId: "",
    customerProfilePathFilter: "",
    customerProfileTypeFilter: "",
    requestApprovalTab: "短信审批",
    workOrderType: "",
    ticketEditingId: "",
    ticketDraftSource: "",
    filterStatusMulti: {},
    detailId: "TS202607230012",
    detailTab: "基本信息",
    relatedRootTicketId: "TS202607230012",
    relatedItemId: "TS202607230012",
    relatedSourceSubprocessId: "",
    detailEntry: "view",
    warningContextId: "",
   subprocessTab: "全部",
    subprocessCreateTab: "\u5168\u90e8",
    queryTab: "工单导出",
    querySubprocessType: "",
    queryTicketType: "",
    queryComplaintQuickFilters: [],
    correctionTagEditing: "",
    businessLineEditing: "",
    subprocessType: "延长申请",
    subprocessScope: "我的工作台",
    subprocessTab: "待办",
    subprocessId: "YC202607160003",
    supervisionLetterId: "DH202608040001",
    subprocessDetailTab: "基本信息",
    subprocessSourceTicket: "",
    subprocessSourceTickets: [],
    subprocessQuickSource: "",
    notificationOpen: false,
    notificationMessageId: "",
    notificationListRequested: false,
    triggeredSubprocesses: {},
    expandedSubprocessFlows: new Set(),
    formValues: {},
    collapsedCustomers: new Set(),
    receivingDepartmentFilters: {},
    sorts: {},
    hiddenColumns: {},
    optionalListColumns: {},
    pagination: {},
approvalContext: null,
    approvalStageByDocument: deepClone(SEED_DATA.runtimeDefaults?.approvalStageByDocument || {}),
    supplementDataBySubprocess: deepClone(SEED_DATA.runtimeDefaults?.supplementDataBySubprocess || {}),
    riskTagsByTicket: deepClone(SEED_DATA.runtimeDefaults?.riskTagsByTicket || {}),
    riskRetryByTicket: {},
    manualRiskTagsByTicket: {},
    documentData: deepClone(SEED_DATA.documentData || { tickets:{}, subprocesses:{}, rectifications:{} }),
    aiClassificationReady: false,
    aiTrsTags: {},
    aiTagSuggestions: {},
    aiTagSlotCounts: {},
    aiTagProvenance: {},
    aiTagSources: {},
    aiClassificationSuggestions: {},
    aiGeneratedFields: new Set(),
    correctionOriginalValues: {},
    importJob: { fileName: "", sourceFile: null, status: "idle", progress: 0, total: 0, parsed: 0, valid: 0, invalid: 0, drafts: 0, targetValid: 0, targetInvalid: 0, oversized: false, blockReason: "", rows: [], fieldErrors: [] },
    importDraftDataById: {},
    importFieldErrors: {},
    activeImportDraftId: "",
    selectedRelatedTicket: "",
    repeatRelations: deepClone(SEED_DATA.runtimeDefaults?.repeatRelations || {}),
    smsStatusByTicket: deepClone(SEED_DATA.runtimeDefaults?.smsStatusByTicket || {}),
    smsRetryOverrides: {},
    contactRecordsByTicket: {},
    contactRecordEditsByTicket: {},
    navigationTrail: [],
    subprocessRelatedContextId: ""
  };
  try {
    const savedTrail = JSON.parse(sessionStorage.getItem("xib-navigation-trail") || "[]");
    if (Array.isArray(savedTrail)) state.navigationTrail = savedTrail.filter(item => item && item.page).slice(-24);
  } catch (error) {
    state.navigationTrail = [];
  }

  const ticketSeedRecords = seedList("tickets").filter(record => !DISABLED_WORK_ORDER_TYPES.has(record.type));
  const ticketRows = ticketSeedRecords.map(ticketRecordToRow);
  const ticketSeedRecordById = new Map(ticketSeedRecords.map(record => [record.id, record]));
  const ticketAudienceById = new Map(ticketSeedRecords.map(record => [record.id, { copiedTo: [...(record.copiedTo || [])] }]));
  const autoDraftRows = seedList("autoDrafts").filter(record => !DISABLED_WORK_ORDER_TYPES.has(record.type)).map(ticketRecordToRow);
  const manualDraftRows = seedList("manualDrafts").filter(record => !DISABLED_WORK_ORDER_TYPES.has(record.type)).map(ticketRecordToRow);
  const importRows = seedList("importJobs").map(importJobToRow);

  const SUBPROCESS_DEFINITIONS = deepClone(FORM_SCHEMA.subprocesses?.definitions || []);
  const SUBPROCESS_TYPES = SUBPROCESS_DEFINITIONS.filter(item => item.type !== "溯源整改").map(item => item.type);
  const DOCUMENT_PREFIXES = {
    "投诉单":"TS", "建议单":"JY", "表扬单":"BY", "信访单":"XF", "舆情单":"YQ",
    "投诉校正":"JZ", "投诉调查":"DC", "撤销投诉":"CX", "延长申请":"YC", "投诉问责":"WZ",
    "剔除申请":"TC", "异常投诉":"YT", "纠纷化解":"JF", "异议核查":"HC", "废止申请":"FZ", "督导函":"DH", "溯源整改":"ZG"
  };

  function systemTimestamp() {
    const parts = new Intl.DateTimeFormat("zh-CN", { timeZone:"Asia/Shanghai", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}`;
  }

  function generateDocumentId(type, timestamp = systemTimestamp()) {
    const prefix = DOCUMENT_PREFIXES[type];
    if (!prefix) throw new Error("未配置单据类型编号前缀：" + type);
    const dateCode = String(timestamp).slice(0,10).replace(/-/g, "");
    const base = prefix + dateCode;
    const rows = [...ticketRows, ...subprocessRows, ...rectificationRows];
    const sequence = rows.reduce((max, row) => String(row[0]).startsWith(base) ? Math.max(max, Number(String(row[0]).slice(-4)) || 0) : max, 0) + 1;
    return base + String(sequence).padStart(4, "0");
  }

  function parsePrototypeDate(value) {
    const normalized = String(value || "").trim().replace(" ", "T");
    if (!normalized) return null;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatPrototypeDate(date) {
    const pad = value => String(value).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function documentRecordFor(kind, row) {
    const id = String(row?.[0] || "");
    if (kind === "ticket") return state.documentData.tickets?.[id] || SEED_DATA.documentData?.tickets?.[id] || null;
    if (kind === "subprocess") return state.documentData.subprocesses?.[id] || SEED_DATA.documentData?.subprocesses?.[id] || null;
    if (kind === "rectification") return state.documentData.rectifications?.[id] || SEED_DATA.documentData?.rectifications?.[id] || null;
    return null;
  }

  function idTimestamp(id) {
    const matched = String(id || "").match(/^[A-Z]{2}(\d{4})(\d{2})(\d{2})/);
    return matched ? new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]), 9, 0, 0) : null;
  }

  function sourceTimestampFor(row, kind) {
    const record = documentRecordFor(kind, row);
    const fieldTime = kind === "ticket"
      ? record?.fields?.entry?.["接收时间"] || record?.fields?.entry?.["建单时间"]
      : record?.fields?.base?.["申请时间"];
    if (kind === "request") {
      const exportRow = exportRequestRows.find(item => item[0] === row?.[0]);
      return parsePrototypeDate(row?.[7] || exportRow?.[7]) || idTimestamp(row?.[0]);
    }
    if (kind === "export") return parsePrototypeDate(row?.[7]) || idTimestamp(row?.[0]);
    const explicitTimestamp = parsePrototypeDate(fieldTime || record?.createdAt || row?.[6]);
    if (explicitTimestamp || kind === "subprocess") return explicitTimestamp;
    return idTimestamp(row?.[0]);
  }

  function ticketTypeForDeadline(row) {
    if (row?.[7] === "再次投诉单" || row?.[3] === "再次投诉" || state.repeatRelations[row?.[0]]?.mainTicket) return "再次投诉单";
    return String(row?.[1] || "");
  }

  function relatedMainTicketId(row, kind) {
    if (kind === "subprocess") return String(row?.[2] || "");
    return String(row?.[8] || state.repeatRelations[row?.[0]]?.mainTicket || "");
  }

  function ticketRowForDeadline(ticketId) {
    if (!ticketId) return null;
    const listRow = ticketRows.find(item => item[0] === ticketId) || queryTicketRows.find(item => item[0] === ticketId);
    if (listRow) return listRow;
    const record = state.documentData.tickets?.[ticketId] || SEED_DATA.documentData?.tickets?.[ticketId];
    if (!record) return null;
    return [ticketId, record.documentType || "投诉单", "", "", "", "", record.createdAt];
  }

  function dispositionDeadlineInfo(row, kind = "ticket", options = {}) {
    if (options.actualOnly) {
      const record = documentRecordFor(kind, row);
      const draftRecord = [...seedList("autoDrafts"), ...seedList("manualDrafts")].find(item => item.id === row?.[0]);
      const configured = record?.dispositionDeadline || record?.fields?.entry?.["处置期限"] || draftRecord?.dispositionDeadline || "";
      return { deadline: configured, emptyLabel: "-", ruleText: configured ? "单据实际处置期限" : "当前单据未填写处置期限", source: configured ? "actual" : "missing" };
    }
    let ruleGroup = kind;
    let type = String(row?.[1] || "");
    if (kind === "ticket") type = ticketTypeForDeadline(row);
    if (kind === "approval") {
      if (row?.[1] === "工单审批") return dispositionDeadlineInfo(ticketRowForDeadline(row[0]) || row, "ticket");
      if (row?.[1] === "子流程审批") {
        const source = subprocessRows.find(item => item[0] === row[0]) || row;
        return dispositionDeadlineInfo(source, "subprocess");
      }
      ruleGroup = "request";
      type = String(row?.[1] || "");
    }
    if (kind === "export") {
      ruleGroup = "request";
      type = "导出申请审批";
    }
    const rule = DISPOSITION_DEADLINE_RULES[ruleGroup]?.[type];
    if (!rule) return { deadline: "", emptyLabel: "-", ruleText: "该单据类型尚未配置处置期限", source: "unconfigured" };
    if (rule.mode === "none") return { deadline: "", emptyLabel: "-", ruleText: rule.label, source: "none" };
    if (rule.mode === "pending") return { deadline: "", emptyLabel: "-", ruleText: rule.label, source: "pending" };
    if (rule.mode === "inherit") {
      const mainTicketId = relatedMainTicketId(row, kind);
      const mainRow = ticketRowForDeadline(mainTicketId);
      if (!mainRow) return { deadline: "", emptyLabel: "-", ruleText: rule.label, source: "inherit", relatedId: mainTicketId };
      const inherited = dispositionDeadlineInfo(mainRow, "ticket");
      return {
        ...inherited,
        emptyLabel: inherited.deadline ? "" : "-",
        ruleText: rule.label + (mainTicketId ? "：" + mainTicketId : ""),
        source: "inherit",
        relatedId: mainTicketId
      };
    }
    if (rule.mode === "manual") {
      const record = documentRecordFor(kind, row);
      const configured = record?.dispositionDeadline || "";
      return {
        deadline: configured,
        emptyLabel: configured ? "" : "-",
        ruleText: rule.label,
        source: "manual"
      };
    }
    const sourceDate = sourceTimestampFor(row, kind === "approval" ? "request" : kind);
    if (!sourceDate) return { deadline: "", emptyLabel: "-", ruleText: rule.label, source: "missing-source" };
    const deadline = new Date(sourceDate.getTime());
    if (rule.days) deadline.setDate(deadline.getDate() + rule.days);
    if (rule.hours) deadline.setHours(deadline.getHours() + rule.hours);
    return { deadline: formatPrototypeDate(deadline), emptyLabel: "", ruleText: rule.label, source: "rule" };
  }

  function dispositionDeadline(row, kind = "ticket") {
    return dispositionDeadlineInfo(row, kind).deadline;
  }

  function dispositionRemaining(deadline, status = "") {
    if (["已办结", "已废止", "已通过", "已驳回"].includes(status)) return "-";
    const target = parsePrototypeDate(deadline);
    if (!target) return "-";
    const milliseconds = target.getTime() - Date.now();
    const absoluteMinutes = Math.max(0, Math.floor(Math.abs(milliseconds) / 60000));
    const days = Math.floor(absoluteMinutes / 1440);
    const hours = Math.floor((absoluteMinutes % 1440) / 60);
    const minutes = absoluteMinutes % 60;
    const value = days + "天" + hours + "小时" + minutes + "分钟";
    return milliseconds < 0 ? "已逾期 " + value : value;
  }

  function dispositionTimeIsUrgent(deadline) {
    const target = parsePrototypeDate(deadline);
    if (!target) return false;
    const milliseconds = target.getTime() - Date.now();
    return milliseconds < 3 * 24 * 60 * 60 * 1000;
  }

  function dispositionDisplayValue(info, status = "") {
    if (!info.deadline) return info.emptyLabel;
    return info.deadline;
  }

  const TICKET_TIME_SORT_INDEX = -1;

  function renderTicketTimeHead(scope) {
    const sort = state.sorts[scope];
    const active = sort && sort.index === TICKET_TIME_SORT_INDEX;
    const direction = active ? sort.direction : "none";
    const symbol = direction === "asc" ? "&#8593;" : direction === "desc" ? "&#8595;" : "&#8597;";
    return '<th class="sortable-column ticket-time-column"><button type="button" class="table-sort' + (active ? ' is-active' : '') + '" data-sort-scope="' + scope + '" data-sort-index="' + TICKET_TIME_SORT_INDEX + '" aria-label="按处置期限排序" aria-sort="' + (direction === "none" ? "none" : direction === "asc" ? "ascending" : "descending") + '"><span>处置期限</span><i aria-hidden="true">' + symbol + '</i></button></th>';
  }

  function renderTicketTimeCell(row, kind = "ticket", status = row?.[5] || "", options = {}) {
    const info = dispositionDeadlineInfo(row, kind, options);
    const urgent = dispositionTimeIsUrgent(info.deadline, status);
    const overdue = info.deadline && dispositionRemaining(info.deadline, status).startsWith("已逾期");
    return '<td class="ticket-time-cell' + (urgent ? " is-urgent" : "") + (overdue ? " is-overdue" : "") + '" data-disposition-deadline="' + escapeAttribute(info.deadline) + '" data-disposition-status="' + escapeAttribute(status) + '" data-disposition-empty="' + escapeAttribute(info.emptyLabel) + '" data-disposition-source="' + escapeAttribute(info.source) + '" title="' + escapeAttribute(info.ruleText) + '">' + dispositionDisplayValue(info, status) + '</td>';
  }

  function refreshDispositionCountdowns() {
    document.querySelectorAll(".ticket-time-cell[data-disposition-source]").forEach(cell => {
      const deadline = cell.dataset.dispositionDeadline;
      cell.textContent = deadline
        ? deadline
        : cell.dataset.dispositionEmpty || "";
      cell.classList.toggle("is-urgent", dispositionTimeIsUrgent(deadline));
      cell.classList.toggle("is-overdue", Boolean(deadline) && dispositionRemaining(deadline, cell.dataset.dispositionStatus || "").startsWith("已逾期"));
    });
    document.querySelectorAll('[data-optional-list-column="剩余处置时间"][data-disposition-deadline]').forEach(cell => {
      const deadline = cell.dataset.dispositionDeadline;
      const status = cell.dataset.dispositionStatus || "";
      cell.textContent = deadline ? dispositionRemaining(deadline, status) : cell.dataset.dispositionEmpty || "-";
      cell.classList.toggle("is-urgent", dispositionTimeIsUrgent(deadline));
      cell.classList.toggle("is-overdue", Boolean(deadline) && dispositionRemaining(deadline, status).startsWith("已逾期"));
    });
  }

  const CASCADER_DATA = {
    region: (PROTOTYPE_CONFIG?.regionTree?.tree) || [
      { label: "不清楚" },
      { label: "福建省", children: [
        { label: "厦门市", children: [{ label: "思明区" }, { label: "湖里区" }, { label: "集美区" }, { label: "海沧区" }] },
        { label: "福州市", children: [{ label: "鼓楼区" }, { label: "台江区" }, { label: "仓山区" }] }
      ] }
    ],
    channel: [
      { label: "A-01 前台业务渠道", children: [
        { label: "A-0101 营业现场" },
        { label: "A-0102 自助机具" },
        { label: "A-0103 电子渠道", children: [{ label: "A-01031 网银渠道" }, { label: "A-01032 电话渠道" }, { label: "A-01033 移动客户端" }, { label: "A-01034 网络公众平台" }, { label: "A-01035 短信渠道" }, { label: "A-01039 其他" }] },
        { label: "A-0104 第三方渠道" },
        { label: "A-0199 其他" }
      ] },
      { label: "A-02 中、后台业务渠道" }
    ],
    business: [
      { label: "B-01 人民币储蓄", children: [{ label: "B-0100 人民币储蓄", children: [{ label: "B-01000 人民币储蓄" }] }] },
      { label: "B-02 贷款", children: [
        { label: "B-0201 个人住房贷款", children: [{ label: "B-02010 个人住房贷款" }] },
        { label: "B-0202 汽车消费贷", children: [{ label: "B-02020 汽车消费贷款" }] },
        { label: "B-0203 教育助学贷", children: [{ label: "B-02030 教育助学贷款" }] },
        { label: "B-0204 其他消费贷款", children: [{ label: "B-02040 其他消费贷款" }] },
        { label: "B-0205 个人生产经营贷", children: [{ label: "B-02050 个人生产经营性贷款" }] },
        { label: "B-0299 其他", children: [{ label: "B-02990 其他贷款" }] }
      ] },
      { label: "B-03 银行卡", children: [
        { label: "B-0301 借记卡", children: [{ label: "B-03010 借记卡" }] },
        { label: "B-0302 信用卡", children: [{ label: "B-03021 申请、开卡及换卡" }, { label: "B-03022 使用和还款" }, { label: "B-03023 账单" }, { label: "B-03024 活动及积分" }, { label: "B-03025 挂失及注销" }, { label: "B-03026 盗刷" }, { label: "B-03027 个人信用信息" }, { label: "B-03029 其他" }] },
        { label: "B-0303 准贷记卡等", children: [{ label: "B-03030 准贷记卡等" }] }
      ] },
      { label: "B-04 自营理财", children: [{ label: "B-0400 自营理财", children: [{ label: "B-04000 自营理财" }] }] },
      { label: "B-05 支付结算", children: [{ label: "B-0501 账户管理" }, { label: "B-0502 资金汇划" }, { label: "B-0503 票据" }, { label: "B-0504 联网核查" }, { label: "B-0505 电子支付" }] },
      { label: "B-06 人民币管理" }, { label: "B-07 外汇" }, { label: "B-08 贵金属" }, { label: "B-09 个人金融信息" }, { label: "B-10 银行代理业务" }, { label: "B-11 其他中间业务" }, { label: "B-12 债务催收" }, { label: "B-13 国库" }, { label: "B-99 其他" }
    ],
    reason: [
      { label: "C-01 服务态度及服务质量", children: [{ label: "C-0101 服务态度" }, { label: "C-0102 业务操作效率" }, { label: "C-0103 业务差错" }, { label: "C-0104 营业秩序" }] },
      { label: "C-02 服务设施、设备、业务系统", children: [{ label: "C-0200 服务设施、设备、业务系统", children: [{ label: "C-02000 服务设施、设备、业务系统" }] }] },
      { label: "C-03 管理制度、业务规则与流程", children: [{ label: "C-0300 管理制度、业务规则与流程", children: [{ label: "C-03000 管理制度、业务规则与流程" }] }] },
      { label: "C-04 营销方式和手段" }, { label: "C-05 信息披露" }, { label: "C-06 自主选择权" }, { label: "C-07 定价收费" }, { label: "C-08 产品收益" }, { label: "C-09 合同条款" }, { label: "C-10 消费者资金安全" }, { label: "C-11 消费者信息安全" }, { label: "C-12 债务催收方式和手段" }
    ]
  };

  function peopleBankTree(prefix, source) {
    const rows = source.trim().split(";").map(item => item.split("|")).filter(row => row.length === 2);
    const roots = [], rootByCode = new Map(), middleByCode = new Map();
    rows.forEach(([code, name]) => {
      const rootCode = code.slice(0, 2), middleCode = code.slice(0, 4);
      if (code.endsWith("000")) {
        const root = { label: `${prefix}-${rootCode} ${name}`, children: [] };
        roots.push(root); rootByCode.set(rootCode, root); return;
      }
      const root = rootByCode.get(rootCode);
      if (!root) return;
      if (code.endsWith("0")) {
        const middle = { label: `${prefix}-${middleCode} ${name}`, children: [] };
        root.children.push(middle); middleByCode.set(middleCode, middle); return;
      }
      (middleByCode.get(middleCode)?.children || root.children).push({ label: `${prefix}-${code} ${name}` });
    });
    const prune = nodes => nodes.map(node => node.children?.length ? { ...node, children:prune(node.children) } : { label:node.label });
    return prune(roots);
  }

  const PEOPLE_BANK_COMMON_CHANNEL = "01000|前台业务渠道;01010|营业现场;01020|自助机具;01030|电子渠道;01031|网银渠道;01032|电话渠道;01033|移动客户端;01034|网络公众平台;01035|短信渠道;01039|其他;01040|第三方渠道;01990|其他;02000|中、后台业务渠道";
  const PEOPLE_BANK_NATURAL_BUSINESS = "01000|人民币储蓄;02000|贷款;02010|个人住房贷款;02020|个人汽车消费贷款;02030|教育助学贷款;02040|其他消费贷款;02050|个人生产经营性贷款;02990|其他;03000|银行卡;03010|借记卡;03011|借记卡账户管理;03012|借记卡收费及挂失;03013|借记卡使用;03014|借记卡市场活动及增值服务;03015|借记卡盗刷;03019|其他;03020|信用卡;03021|信用卡申请、开卡及换卡;03022|信用卡使用和还款;03023|信用卡账单服务;03024|信用卡市场活动、积分及增值服务;03025|信用卡挂失及注销;03026|信用卡盗刷;03027|信用卡个人信用信息;03029|其他;03030|准贷记卡等其他卡类业务;04000|自营理财;05000|支付结算;05010|账户管理;05020|资金汇划;05030|票据;05040|联网核查;05050|电子支付;05060|非银行支付机构网络支付;05070|汇兑业务;05080|多用途预付费卡;05990|其他;06000|人民币管理;06010|残损、污损币兑换（收存）;06020|假币鉴定与收缴;06030|小面额人民币兑换（收存）;06040|纪念币（钞）;06990|其他;07000|外汇;07010|个人结售汇;07020|个人外汇汇款;07030|个人外汇交易;07040|个人外汇储蓄;07050|外汇账户管理;07990|其他;08000|贵金属;08010|自营实物贵金属;08020|自营账户贵金属;08030|代理贵金属交易;08990|其他;09000|个人金融信息;09010|个人信用信息采集;09020|个人信用信息使用;09030|个人信用信息异议处理;09040|除信用信息之外的个人金融信息的收集与使用;09990|其他;10000|银行代理业务;10010|代理保险业务;10020|代理证券业务;10030|代理期货业务;10040|代理信托业务;10050|代理基金业务;10060|代理他行业务;10990|其他;11000|其他中间业务;11010|个人资信证明;11020|保管箱;11030|代收代付业务;11990|其他;12000|债务催收;12010|信用卡债务催收;12020|贷款债务催收;12990|其他;13000|国库;13010|国债;13020|税收与行政事业性收费;13030|资金拨付;13990|其他;99000|其他;99010|功能类业务;99020|其他银行业务;99030|呼叫服务;99990|其他投诉";
  const PEOPLE_BANK_ORGANIZATION_BUSINESS = "01000|人民币储蓄;02000|贷款;02010|信用贷款;02020|担保贷款;02021|保证贷款;02022|抵押贷款;02023|质押贷款;02030|票据贴现;02040|国际贸易融资;02041|信用证;02042|押汇;02043|国际保理;02044|福费廷;02049|其他;02990|其他;03000|银行卡;03010|单位结算卡;03011|单位结算卡账户管理;03012|单位结算卡收费及挂失;03013|单位结算卡使用;03014|单位结算卡市场活动及增值服务;03015|单位结算卡盗刷;03019|其他;03020|其他卡类业务;04000|自营理财;05000|支付结算;05010|账户管理;05020|资金汇划;05030|票据;05040|联网核查;05050|电子支付;05060|非银行支付机构网络支付;05070|汇兑业务;05080|多用途预付费卡;05090|收单业务;05990|其他;06000|人民币管理;06010|残损、污损币兑换（收存）;06020|假币鉴定与收缴;06030|小面额人民币兑换（收存）;06040|纪念币（钞）;06990|其他;07000|外汇;07010|结售汇;07020|外汇汇款;07030|外汇交易;07040|外汇储蓄;07050|外汇账户管理;07990|其他;08000|贵金属;08010|自营实物贵金属;08020|自营账户贵金属;08030|代理贵金属交易;08990|其他;09000|金融信息;09010|信用信息采集;09020|信用信息使用;09030|信用信息异议处理;09040|除信用信息之外的金融信息的收集与使用;09990|其他;10000|银行代理业务;10010|代理保险业务;10020|代理证券业务;10030|代理期货业务;10040|代理信托业务;10050|代理基金业务;10060|代理他行业务;10990|其他;11000|其他中间业务;11010|保管箱;11020|代收代付业务;11990|其他;12000|债务催收;12010|贷款债务催收;12990|其他;13000|国库;13010|国债;13020|税收与行政事业性收费;13030|资金拨付;13990|其他;99000|其他;99010|功能类业务;99020|其他银行业务;99030|呼叫服务;99990|其他投诉";
  const PEOPLE_BANK_NATURAL_REASON = "01000|服务态度及服务质量;01010|服务态度;01020|业务操作及效率;01030|业务差错;01040|营业秩序;02000|金融机构服务设施、设备、业务系统;03000|管理制度、业务规则与流程;04000|营销方式和手段;05000|信息披露;06000|自主选择权;07000|定价收费;08000|产品收益;09000|合同条款;10000|消费者资金安全;11000|消费者信息安全;12000|债务催收方式和手段";
  const PEOPLE_BANK_ORGANIZATION_REASON = "01000|服务态度及服务质量;01010|服务态度;01020|业务操作及效率;01030|业务差错;01040|营业秩序;02000|金融机构服务设施、设备、业务系统;03000|金融机构管理制度、业务规则与流程;04000|营销方式和手段;05000|信息披露;06000|自主选择权;07000|定价收费;08000|产品收益;09000|合同条款;10000|资金安全;11000|信息安全;12000|债务催收方式和手段";
  const PEOPLE_BANK_TABLES = {
    channel:{ natural:peopleBankTree("A", PEOPLE_BANK_COMMON_CHANNEL), organization:peopleBankTree("Z", PEOPLE_BANK_COMMON_CHANNEL) },
    business:{ natural:peopleBankTree("B", PEOPLE_BANK_NATURAL_BUSINESS), organization:peopleBankTree("Y", PEOPLE_BANK_ORGANIZATION_BUSINESS) },
    reason:{ natural:peopleBankTree("C", PEOPLE_BANK_NATURAL_REASON), organization:peopleBankTree("X", PEOPLE_BANK_ORGANIZATION_REASON) }
  };

  function activeCustomerType() {
    return state.formValues["customer.1.客户类型"] || state.formValues["客户类型"] || "";
  }

  function isOrganizationCustomerType(value = activeCustomerType()) {
    return String(value || "").trim() === "非自然人";
  }

  function peopleBankCascaderSource(sourceKey) {
    const table = PEOPLE_BANK_TABLES[sourceKey];
    if (!table) return CASCADER_DATA[sourceKey] || [];
    return isOrganizationCustomerType() ? table.organization : table.natural;
  }

  function resetPeopleBankTagsAfterCustomerTypeChange() {
    ["业务办理渠道", "业务类别", "投诉/信访原因"].forEach(key => {
      state.formValues[key] = "";
      state.aiGeneratedFields.delete(key);
    });
  }
  CASCADER_DATA.regulatoryCategory = [{"label":"个人业务","children":[{"label":"人民币储蓄"},{"label":"个人住房贷款","children":[{"label":"办理问题"},{"label":"息费及定价争议"},{"label":"催收及征信纠纷"}]},{"label":"个人汽车消费贷款","children":[{"label":"办理问题"},{"label":"息费及定价争议"},{"label":"催收及征信纠纷"}]},{"label":"个人教育助学贷款","children":[{"label":"办理问题"},{"label":"息费及定价争议"},{"label":"催收及征信纠纷"}]},{"label":"其他消费贷款","children":[{"label":"办理问题"},{"label":"息费及定价争议"},{"label":"催收及征信纠纷"}]},{"label":"个人生产经营性贷款","children":[{"label":"办理问题"},{"label":"息费及定价争议"},{"label":"催收及征信纠纷"}]},{"label":"其他贷款","children":[{"label":"办理问题"},{"label":"息费及定价争议"},{"label":"催收及征信纠纷"}]},{"label":"借记卡账号管理"},{"label":"借记卡收费及挂失"},{"label":"借记卡使用"},{"label":"借记卡市场活动及增值服务"},{"label":"借记卡盗刷"},{"label":"借记卡其他"},{"label":"信用卡分期","children":[{"label":"办理问题"},{"label":"息费及定价争议"},{"label":"催收及征信纠纷"}]},{"label":"信用卡消费贷款","children":[{"label":"办理问题"},{"label":"息费及定价争议"},{"label":"催收及征信纠纷"}]},{"label":"信用卡申请、开卡及换卡"},{"label":"信用卡使用和还款"},{"label":"信用卡账单服务"},{"label":"信用卡市场活动、积分及增值服务"},{"label":"信用卡挂失及注销"},{"label":"信用卡盗刷"},{"label":"信用卡其他"},{"label":"自营理财"},{"label":"支付结算"},{"label":"人民币管理"},{"label":"外汇"},{"label":"贵金属"},{"label":"个人金融信息"},{"label":"代理保险业务"},{"label":"代理证券业务"},{"label":"代理期货业务"},{"label":"代理信托业务"},{"label":"代理基金业务"},{"label":"代理其他业务"},{"label":"其他中间业务"},{"label":"国库"},{"label":"其他"}]},{"label":"对公业务","children":[{"label":"企业账户管理及使用"},{"label":"企业存款及理财"},{"label":"企业贷款"},{"label":"本/外币支付结算及结售汇"},{"label":"企业代理/担保业务"},{"label":"企业收费"},{"label":"企业电子渠道使用"},{"label":"其他"}]}];

  const spField = (name, type = "text", config = {}) => ({ name, type, ...config });
  const SP_PRODUCT_OPTIONS = ["美团","度小满","乐信","京东","小米","数禾","字节跳动","拍拍贷","维信金科","马上消金","360","个人经营贷","个人住房按揭贷款","兴安贷+","好康贷","税享贷","梦想贷","公司贷款","银行卡","存款","大额存单","基金","理财","对公账户","其它产品"];
  const SP_BUSINESS_OPTIONS = ["合作类贷款","非合作类贷款","存款","代理销售","其它"];
  const SP_YES_NO = ["是","否"];
  const SUBPROCESS_FIELD_SECTIONS = deepClone(FORM_SCHEMA.subprocesses?.field_sections || {});
  const SUBPROCESS_SUPPLEMENT_SECTIONS = deepClone(FORM_SCHEMA.subprocesses?.supplement_sections || {});
  const SUBPROCESS_BASE_FIELD_RULES = deepClone(FORM_SCHEMA.subprocesses?.base_field_rules || {});
  const SUBPROCESS_PROCESS_SECTION_TITLES = deepClone(FORM_SCHEMA.subprocesses?.process_section_titles || {});
  const subprocessRows = seedList("subprocesses").map(subprocessRecordToRow);
  const rectificationRows = seedList("rectifications").map(rectificationRecordToRow);
  const exportRequestRows = seedList("exportRequests").map(exportRequestToRow);
  const approvalRows = seedList("approvals").map(approvalRecordToRow);

  const approvalRules = WORKFLOW_SCHEMA.approvalRules || {};
  const TICKET_INITIAL_APPROVAL_TYPES = new Set(approvalRules.ticketInitialApprovalTypes || []);
  const TICKET_COUNTERSIGN_TYPES = new Set(approvalRules.ticketCountersignTypes || []);
  const SUBPROCESS_NO_APPROVAL_TYPES = new Set(approvalRules.subprocessNoApprovalTypes || []);
  const SUBPROCESS_INITIAL_APPROVAL_TYPES = new Set(approvalRules.subprocessInitialApprovalTypes || []);
  const SUBPROCESS_NO_FINAL_APPROVAL_TYPES = new Set(approvalRules.subprocessNoFinalApprovalTypes || []);
  const SUBPROCESS_SUPPLEMENT_TYPES = new Set(approvalRules.subprocessSupplementTypes || []);

  function ticketRequiresReview(type = state.workOrderType) {
    const customerServiceTypes = ["投诉单", "表扬单", "建议单"];
    const channelRequiresReview = (approvalRules.ticketReviewChannels || []).includes(state.formValues["受理渠道"]);
    return (channelRequiresReview || state.ticketDraftSource === "自动带入草稿箱" || currentRoleProfile().org === "customer-service") && customerServiceTypes.includes(type);
  }

  function ticketSmsDeferredUntilReview(type, channel) {
    return type === "投诉单" && (approvalRules.ticketReviewChannels || []).includes(channel);
  }

  function ticketRequiresCountersign(row) {
    if (!row || !TICKET_COUNTERSIGN_TYPES.has(row[1])) return false;
    if (row[5] === "会签中") return true;
    const processing = documentRecordFor("ticket", row)?.fields?.processing || {};
    // Keep the legacy key readable so existing browser drafts survive the field rename.
    return (processing["是否会签"] ?? processing["是否需要会签"]) === "是";
  }

  function approvalStagesFor(kind, row) {
    if (!row) return [];
    if (kind === "ticket") {
      if (ticketRequiresCountersign(row)) return ["countersign", "approval"];
      return TICKET_INITIAL_APPROVAL_TYPES.has(row[1]) ? ["initial", "approval"] : ["approval"];
    }
    if (kind === "subprocess") {
      if (["待复核", "复核中"].includes(row[5])) return ["review"];
      if (SUBPROCESS_NO_APPROVAL_TYPES.has(row[1])) return [];
      const stages = [];
      if (subprocessNeedsInitialApproval(row)) stages.push("initial");
      if (!SUBPROCESS_NO_FINAL_APPROVAL_TYPES.has(row[1])) stages.push("approval");
      return stages;
    }
    return ["approval"];
  }

  function subprocessNeedsInitialApproval(row) {
    return Boolean(row && (SUBPROCESS_INITIAL_APPROVAL_TYPES.has(row[1] || "") || (row[1] === "延长申请" && extensionRequiresInitialApproval(row[2], row[0]))));
  }

  function approvalStageFor(kind, row) {
    const stages = approvalStagesFor(kind, row);
    if (["待初审", "初审中"].includes(row?.[5])) return "initial";
    if (["待审批", "审批中"].includes(row?.[5])) return "approval";
    if (kind === "ticket") {
      if (ticketRequiresCountersign(row)) {
        if (row?.[5] === "会签中") return "countersign";
        if (["待审批", "审批中"].includes(row?.[5])) return "approval";
      }
    }
    const stored = state.approvalStageByDocument[row?.[0]];
    if (stages.includes(stored)) return stored;
    return stages[0] || "none";
  }

  function setApprovalStage(id, stage) {
    if (!id) return;
    if (stage && stage !== "none") state.approvalStageByDocument[id] = stage;
    else delete state.approvalStageByDocument[id];
  }

  function approvalStageLabel(stage) {
    return stage === "review" ? "复核" : stage === "initial" ? "初审" : stage === "countersign" ? "会签" : "审批";
  }

  const DOCUMENT_STATE_MACHINES = deepClone(WORKFLOW_SCHEMA.documentStateMachines || {});
  const SUBPROCESS_TYPE_STATUS_MATRIX = deepClone(DOCUMENT_STATE_MACHINES.subprocess?.typeStatusMatrix || {});

  function subprocessSupportsStatus(type, status) {
    return Boolean(SUBPROCESS_TYPE_STATUS_MATRIX[type]?.[status]);
  }

  function subprocessRequiresReview(type, relatedTicketId = "") {
    if (!subprocessSupportsStatus(type, "待复核")) return false;
    const ticket = ticketRowById(relatedTicketId);
    const channel = ticket ? ticketAcceptanceChannel(ticket) : "";
    return currentRoleProfile().org === "customer-service" || ["客服电话", "在线客服"].includes(channel);
  }

  function extensionRequiresInitialApproval(relatedTicketId = "", candidateId = "") {
    if (!relatedTicketId) return false;
    return subprocessRows.some(row => row[1] === "\u5ef6\u957f\u7533\u8bf7" && row[2] === relatedTicketId && row[0] !== candidateId && ["\u5f85\u8865\u5f55", "\u5df2\u529e\u7ed3"].includes(row[5]));
  }

  function complaintAccountabilityTriggerMode(row = null) {
    if (!row || row?.[1] !== "投诉问责") return "人工触发";
    return documentRecordFor("subprocess", row)?.fields?.base?.["触发方式"] || "人工触发";
  }

  function isManualAccountabilityDraft(row = null) {
    return row?.[1] === "投诉问责" && row?.[5] === "草稿" && complaintAccountabilityTriggerMode(row) === "人工触发";
  }

  function subprocessInitialStatus(type, relatedTicketId = "", triggerMode = "人工触发") {
    if (subprocessRequiresReview(type, relatedTicketId)) return "待复核";
    if (type === "异议核查") return "处理中";
    if (type === "投诉问责" && triggerMode !== "系统自动触发") return "待审批";
    if (subprocessSupportsStatus(type, "待处理")) return "待处理";
    if (SUBPROCESS_INITIAL_APPROVAL_TYPES.has(type) || (type === "延长申请" && extensionRequiresInitialApproval(relatedTicketId))) return "待初审";
    if (subprocessSupportsStatus(type, "待审批")) return "待审批";
    return "已办结";
  }

  function subprocessSubmitEvent(status) {
    return status === "待复核" ? "submitToReview" : status === "处理中" ? "submitToProcessingDirect" : status === "待处理" ? "submitToProcessing" : status === "待初审" ? "submitToInitial" : status === "待审批" ? "submitToApproval" : "submitToComplete";
  }

  const DOCUMENT_STATUS_ORDER = ["草稿", "待提交", "待复核", "复核中", "待处理", "处理中", "会签中", "待初审", "初审中", "待审批", "审批中", "待补录", "已办结", "已废止"];
  const DOCUMENT_STATUS_RANK = new Map(DOCUMENT_STATUS_ORDER.map((status, index) => [status, index]));
  const RECTIFICATION_STATUS_ORDER = ["草稿", "问题待提交", "问题待审核", "方案待提交", "方案待初审", "方案待审批", "整改中", "结果待初审", "结果待审批", "已办结", "已废止"];
  const RECTIFICATION_STATUS_RANK = new Map(RECTIFICATION_STATUS_ORDER.map((status, index) => [status, index]));
  const DOCUMENT_STATUS_SORT_INDEX_BY_SCOPE = new Map([
    ["auto-drafts", 5],
    ["manual-drafts", 5],
    ["created-tickets", 5],
    ["review-tickets", 5],
    ["process-tickets", 5],
    ["query-tickets", 5],
    ["subprocess-source", 5],
    ["subprocess-create", 5],
    ["subprocess-process", 5],
    ["query-subprocesses", 5],
    ["subprocess-approvals", 5],
    ["approvals-ticket", 5],
    ["approvals-subprocess", 5],
    ["approval-pool-ticket", 5],
    ["approval-pool-subprocess", 5],
    ["rectification-orders", 5],
    ["query-rectifications", 5],
    ["approvals", 10]
  ]);
  const isDocumentStatusSort = (scope, index) => DOCUMENT_STATUS_SORT_INDEX_BY_SCOPE.get(scope) === index;
  function normalizeWorkflowHistoryBuckets(source = {}) {
    return Object.fromEntries(["ticket", "subprocess", "rectification"].map(kind => [kind, Object.fromEntries(Object.entries(source[kind] || {}).map(([id, records]) => [id, (records || []).map(normalizeWorkflowRecord)]))]));
  }
  const workflowHistory = normalizeWorkflowHistoryBuckets(deepClone(SEED_DATA.workflowHistory || {}));
  const exportRequestHistory = Object.fromEntries(Object.entries(SEED_DATA.exportRequestHistory || {}).map(([id, records]) => [id, (records || []).map(normalizeWorkflowRecord)]));

  function workflowRows(kind) {
    if (kind === "ticket") return ticketRows;
    if (kind === "subprocess") return subprocessRows;
    return rectificationRows;
  }

  function workflowRow(kind, id) {
    return workflowRows(kind).find(row => row[0] === id) || null;
  }

  function documentDataBucket(kind) {
    const key = kind === "ticket" ? "tickets" : kind === "subprocess" ? "subprocesses" : "rectifications";
    if (!state.documentData[key]) state.documentData[key] = {};
    return state.documentData[key];
  }

  function scopedFormValues(prefix) {
    const result = {};
    const token = prefix ? prefix + "." : "";
    Object.entries(state.formValues).forEach(([key, value]) => {
      if (!token || key.startsWith(token)) result[token ? key.slice(token.length) : key] = deepClone(value);
    });
    return result;
  }

  function snapshotDocumentStage(kind, id, stage, values) {
    if (!id) return;
    const row = workflowRow(kind, id);
    const bucket = documentDataBucket(kind);
    const record = bucket[id] || {
      id,
      documentType: row?.[1] || "",
      schemaVersion: FORM_SCHEMA.meta?.version || "1.0.0",
      fields: {},
      createdAt: row?.[6] || systemTimestamp()
    };
    if (!record.fields) record.fields = {};
    record.fields[stage] = deepClone(values || {});
    record.updatedAt = systemTimestamp();
    bucket[id] = record;
  }

  function workflowTransition(kind, id, event, metadata = {}) {
    const row = workflowRow(kind, id);
    const machine = DOCUMENT_STATE_MACHINES[kind];
    const next = row && machine?.transitions?.[event]?.[row[5]];
    if (!row || !next) return { ok: false, reason: "当前状态不允许执行该操作" };
    const from = row[5];
    row[5] = next;
    if (metadata.assignee) COMPLAINT_WORK_POOL.assign(kind, id, metadata.assignee);
    else COMPLAINT_WORK_POOL.advance(kind, id, next);
    if (metadata.targetOrg) {
      if (kind === "ticket") setTicketReceivingInstitution(row, metadata.targetOrg);
      else row[4] = institutionDisplayName(metadata.targetOrg);
    }
    if (kind === "ticket") {
      const assignment = COMPLAINT_WORK_POOL.assignment("ticket", id);
      const handler = next === "处理中" ? (metadata.assignee || assignment.assignee) : "";
      updateTicketProcessingOwnership(row, { handler, department:metadata.targetDepartment });
    }
    row[6] = metadata.time || systemTimestamp();
    const record = appendWorkflowRecord(kind, row, from, next, event, metadata);
    persistWorkflowState();
    return { ok: true, row, from, to: next, record };
  }

  function repairApprovalWorkPoolAssignments() {
    const reviewStatuses = new Set(["待复核", "复核中"]);
    const approvalStatuses = new Set(["会签中", "待初审", "初审中", "待审批", "审批中"]);
    const staleActors = new Set([
      COMPLAINT_WORK_POOL.identity("operator").actor,
      COMPLAINT_WORK_POOL.identity("handler").actor
    ]);
    let repaired = 0;
    [["ticket", ticketRows], ["subprocess", subprocessRows]].forEach(([kind, rows]) => {
      rows.forEach(row => {
        if (!reviewStatuses.has(row[5]) && !approvalStatuses.has(row[5])) return;
        const assignment = COMPLAINT_WORK_POOL.assignment(kind, row[0]);
        if (assignment.assignee && !staleActors.has(assignment.assignee)) return;
        if (COMPLAINT_WORK_POOL.advance(kind, row[0], row[5])) repaired += 1;
      });
    });
    return repaired;
  }

  function workflowOperationTime(value = systemTimestamp()) {
    const normalized = String(value || systemTimestamp()).trim().replace("T", " ");
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) return normalized + ":00";
    return normalized;
  }

  function workflowReceiverName(kind, row, next, metadata = {}) {
    if (metadata.receiverName !== undefined) return metadata.receiverName || "-";
    const explicit = String(metadata.receiver || "").trim();
    const generic = /^(?:-|下一节点处理人|当前处理人|处理员|当前复核员|复核员|当前初审人|初审员|当前审批人|审批人|当前会签人|下一会签人|上一节点处理人|原处理人|创建人)$/;
    if (metadata.assignee) return metadata.assignee;
    if (explicit && !generic.test(explicit)) return explicit;
    if (["已办结", "已废止"].includes(next)) return "-";
    const org = kind === "ticket" ? ticketReceivingInstitution(row) : (row?.[4] || currentRoleProfile().institutionLabel);
    if (next === "待处理") return org + "机构工单池";
    if (next === "待复核") return org + "复核工单池";
    if (next === "待初审") return org + "初审工单池";
    if (next === "待审批") return org + "审批工单池";
    if (["复核中", "处理中", "初审中", "审批中", "会签中"].includes(next)) return metadata.actor || CURRENT_USER_ACTOR;
    return "-";
  }

  function appendWorkflowRecord(kind, row, from, to, event, metadata = {}) {
    const machine = DOCUMENT_STATE_MACHINES[kind] || {};
    const profile = currentRoleProfile();
    const operatorName = metadata.operatorName || metadata.actor || CURRENT_USER_ACTOR;
    const systemOperation = operatorName === "系统" || metadata.system === true;
    const flowSceneName = machine.flowScenes?.[event] || metadata.flowSceneName || metadata.action || event || "-";
    const opinionAllowed = metadata.systemGeneratedOpinion === true || /转派|驳回/.test(flowSceneName);
    const record = {
      operatorName,
      operatorRoleName: systemOperation ? "-" : (metadata.operatorRoleName || metadata.role || ROLE_LABELS[profile.role] || profile.label || "-"),
      operatorOrgName: systemOperation ? "-" : (metadata.operatorOrgName || metadata.org || profile.institutionLabel || "-"),
      flowSceneName,
      flowOpinion: opinionAllowed ? String(metadata.flowOpinion ?? metadata.opinion ?? "") : "",
      receiverName: workflowReceiverName(kind, row, to, metadata),
      statusTransition: `${from || "-"} → ${to || "-"}`,
      operationTime: workflowOperationTime(metadata.operationTime || metadata.time || row?.[6]),
      result: metadata.result || (/reject|驳回/.test(event + flowSceneName) ? "驳回" : "通过")
    };
    if (metadata.systemGeneratedOpinion === true) record.systemGeneratedOpinion = true;
    if (Array.isArray(metadata.countersignMembers)) record.countersignMembers = deepClone(metadata.countersignMembers);
    if (!workflowHistory[kind][row[0]]) workflowHistory[kind][row[0]] = [];
    workflowHistory[kind][row[0]].unshift(record);
    return record;
  }

  function appendExportRequestRecord(row, action, explanation = "", metadata = {}) {
    if (!row?.[0]) return null;
    const profile = currentRoleProfile();
    const record = {
      operatorName: metadata.operatorName || CURRENT_USER_ACTOR,
      operatorRoleName: metadata.role || ROLE_LABELS[profile.role] || profile.label || "-",
      operatorOrgName: metadata.org || profile.institutionLabel || "-",
      flowSceneName: action,
      flowOpinion: explanation || "",
      receiverName: metadata.receiver || "-",
      statusTransition: metadata.statusTransition || "-",
      operationTime: workflowOperationTime(metadata.operationTime || systemTimestamp()),
      result: metadata.result || action
    };
    if (!exportRequestHistory[row[0]]) exportRequestHistory[row[0]] = [];
    exportRequestHistory[row[0]].unshift(record);
    return record;
  }

  const STORAGE_VERSION = Number(SEED_DATA.meta?.storageVersion || 3);
  const WORKFLOW_STORAGE_KEY = "xib-prototype-state-v" + STORAGE_VERSION;
  const LEGACY_STORAGE_KEYS = ["xib-workflow-state-v2"];

  function persistedRows() {
    return {
      ticket: deepClone(ticketRows),
      autoDrafts: deepClone(autoDraftRows),
      manualDrafts: deepClone(manualDraftRows),
      imports: deepClone(importRows),
      subprocess: deepClone(subprocessRows),
      rectification: deepClone(rectificationRows),
      approvals: deepClone(approvalRows),
      exportRequests: deepClone(exportRequestRows)
    };
  }

  function replaceRows(target, rows) {
    if (!Array.isArray(rows)) return;
    target.splice(0, target.length, ...deepClone(rows));
  }

  function syncSeedSubprocessExamples() {
    const obsoleteIds = new Set([
      "YT202610210004", "YT202610210009",
      ...Array.from({ length: 9 }, (_, index) => `YT20261021${String(index + 12).padStart(4, "0")}`),
      "YC202610210004", "YC202610210007", "YC202610210010", "YC202610210011", "YC202610210012", "YC202610210013"
    ]);
    const sampleIdPattern = /^(?:JZ|DC|YC|YT|JF)20261021\d{4}$/;
    let changed = false;
    for (let index = subprocessRows.length - 1; index >= 0; index--) {
      if (!obsoleteIds.has(subprocessRows[index][0])) continue;
      const [removed] = subprocessRows.splice(index, 1);
      delete state.documentData.subprocesses?.[removed[0]];
      delete workflowHistory.subprocess?.[removed[0]];
      changed = true;
    }
    const addedIds = [];
    (SEED_DATA.lists?.subprocesses || []).filter(item => sampleIdPattern.test(item.id) && !obsoleteIds.has(item.id)).forEach(item => {
      if (subprocessRows.some(row => row[0] === item.id)) return;
      subprocessRows.unshift(subprocessRecordToRow(item));
      if (SEED_DATA.documentData?.subprocesses?.[item.id]) state.documentData.subprocesses[item.id] = deepClone(SEED_DATA.documentData.subprocesses[item.id]);
      if (SEED_DATA.workflowHistory?.subprocess?.[item.id]) workflowHistory.subprocess[item.id] = deepClone(SEED_DATA.workflowHistory.subprocess[item.id]);
      addedIds.push(item.id);
      changed = true;
    });
    (SEED_DATA.lists?.approvals || []).filter(item => sampleIdPattern.test(item.id)).forEach(item => {
      if (approvalRows.some(row => row[0] === item.id)) return;
      approvalRows.push(approvalRecordToRow(item));
      changed = true;
    });
    return { addedIds, changed };
  }

  function persistWorkflowState() {
    try {
      localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        rows: persistedRows(),
        documentData: state.documentData,
        history: workflowHistory,
        exportRequestHistory: exportRequestHistory,
        smsStatusByTicket: state.smsStatusByTicket,
        smsRetryOverrides: state.smsRetryOverrides,
        contactRecordsByTicket: state.contactRecordsByTicket,
        contactRecordEditsByTicket: state.contactRecordEditsByTicket,
        supervisionLetters: window.XIBComplaintInspections?.serializeState().supervisionLetters || [],
        approvalStageByDocument: state.approvalStageByDocument,
        supplementDataBySubprocess: state.supplementDataBySubprocess,
        riskTagsByTicket: state.riskTagsByTicket,
        manualRiskTagsByTicket: state.manualRiskTagsByTicket,
        repeatRelations: state.repeatRelations,
        importDraftDataById: state.importDraftDataById,
        triggeredSubprocesses: state.triggeredSubprocesses,
        workPoolAssignments: COMPLAINT_WORK_POOL.serialize()
      }));
    } catch (error) {
      console.warn("Prototype persistence unavailable", error);
    }
  }

  function restoreWorkflowState() {
    try {
      const saved = JSON.parse(localStorage.getItem(WORKFLOW_STORAGE_KEY) || "null");
      if (!saved || saved.version !== STORAGE_VERSION) return;
      replaceRows(ticketRows, saved.rows?.ticket);
      replaceRows(autoDraftRows, saved.rows?.autoDrafts);
      replaceRows(manualDraftRows, saved.rows?.manualDrafts);
      replaceRows(importRows, saved.rows?.imports);
      replaceRows(subprocessRows, saved.rows?.subprocess);
      // Repair subprocesses created by older builds, which stored the role/view label
      // (for example "开发测试") instead of the real institution name.
      subprocessRows.forEach(row => {
        const profile = roleProfiles().find(item => item.orgLabel === row[4] || item.label === row[4]);
        if (profile?.institutionLabel) row[4] = COMPLAINT_WORK_POOL.identity("handler").organization || profile.institutionLabel;
      });
      replaceRows(rectificationRows, saved.rows?.rectification);
      replaceRows(approvalRows, saved.rows?.approvals);
      let approvalIdsMigrated = false;
      const approvalSerialsByDate = {};
      approvalRows.forEach(row => {
        if (row[1] !== "短信审批" || /^DX\d{8}\d{4}$/.test(String(row[0] || ""))) return;
        const date = String(row[7] || "").replace(/\D/g, "").slice(0, 8) || systemTimestamp().replace(/\D/g, "").slice(0, 8);
        const serial = (approvalSerialsByDate[date] || 0) + 1;
        approvalSerialsByDate[date] = serial;
        row[0] = "DX" + date + String(serial).padStart(4, "0");
        approvalIdsMigrated = true;
      });
      replaceRows(exportRequestRows, saved.rows?.exportRequests);
      let exportRequestsMigrated = false;
      exportRequestRows.forEach(row => {
        row[1] = normalizeExportRequestType(row[1]);
        row[16] = row[16] || exportApplicantDepartment({ org:row[4] });
        if (row[1] === "溯源整改单" && !row[21] && row[17] && /(?:^|、)[A-Z]{2}\d{12}(?:、|$)/.test(row[17])) {
          row[21] = row[17];
          row[17] = "";
          exportRequestsMigrated = true;
        }
        if (row[5] === "已通过" && (!row[19] || !row[20])) {
          const approvedAt = parsePrototypeDate(row[19] || row[7]);
          if (approvedAt) {
            row[19] = row[19] || formatPrototypeDateTime(approvedAt);
            row[20] = row[20] || formatPrototypeDateTime(new Date(approvedAt.getTime() + 7 * 24 * 60 * 60 * 1000));
            exportRequestsMigrated = true;
          }
        }
      });
      approvalRows.forEach(row => {
        if (row[1] !== "导出申请审批") return;
        row[2] = normalizeExportRequestType(exportRequestRows.find(item => item[0] === row[0])?.[1] || row[2]);
      });
      if (saved.documentData) state.documentData = deepClone(saved.documentData);
      ["ticket", "subprocess", "rectification"].forEach(kind => {
        workflowHistory[kind] = normalizeWorkflowHistoryBuckets({ [kind]:deepClone(saved.history?.[kind] || workflowHistory[kind] || {}) })[kind];
      });
      const subprocessExamplesMigration = syncSeedSubprocessExamples();
      // 旧浏览器数据只补入新增的审批演示工单，不覆盖用户已经编辑的工单。
      const migratedApprovalExamples = [];
      (SEED_DATA.lists?.tickets || []).filter(item => ["投诉单", "信访单"].includes(item.type) && ["待审批", "审批中"].includes(item.status)).forEach(item => {
        if (ticketRows.some(row => row[0] === item.id)) return;
        ticketRows.push(ticketRecordToRow(item));
        if (SEED_DATA.documentData?.tickets?.[item.id]) state.documentData.tickets[item.id] = deepClone(SEED_DATA.documentData.tickets[item.id]);
        if (SEED_DATA.workflowHistory?.ticket?.[item.id]) workflowHistory.ticket[item.id] = deepClone(SEED_DATA.workflowHistory.ticket[item.id]);
        migratedApprovalExamples.push(item.id);
      });
      // Upgrade only the untouched petition demo in existing browser storage. Never
      // replace a ticket that a user has already advanced or edited manually.
      const petitionDemoId = "XF202608040001";
      const savedPetitionRow = ticketRows.find(row => row[0] === petitionDemoId);
      const savedPetitionFlow = workflowHistory.ticket?.[petitionDemoId] || [];
      const petitionDemoWasUntouched = savedPetitionRow?.[5] === "待初审" && savedPetitionRow?.[6] === "2026-08-04 09:10" &&
        savedPetitionFlow.length === 1 && savedPetitionFlow.at(-1)?.statusTransition === "处理中 → 待初审";
      const petitionDemoNeedsOpeningSteps = savedPetitionRow?.[5] === "已办结" && savedPetitionRow?.[6] === "2026-08-04 10:20" &&
        savedPetitionFlow.length === 5 && savedPetitionFlow[0]?.statusTransition === "处理中 → 待初审" &&
        savedPetitionFlow.at(-1)?.statusTransition === "审批中 → 已办结";
      if (petitionDemoWasUntouched) {
        const canonicalRow = ticketRecordToRow(ticketSeedRecordById.get(petitionDemoId));
        savedPetitionRow.splice(0, savedPetitionRow.length, ...canonicalRow);
        workflowHistory.ticket[petitionDemoId] = deepClone(SEED_DATA.workflowHistory.ticket[petitionDemoId]);
        if (state.documentData.tickets?.[petitionDemoId]) state.documentData.tickets[petitionDemoId].updatedAt = canonicalRow[6];
      } else if (petitionDemoNeedsOpeningSteps) {
        workflowHistory.ticket[petitionDemoId] = deepClone(SEED_DATA.workflowHistory.ticket[petitionDemoId]);
      }
      Object.keys(exportRequestHistory).forEach(id => delete exportRequestHistory[id]);
      Object.entries(saved.exportRequestHistory || {}).forEach(([id, records]) => { exportRequestHistory[id] = (records || []).map(normalizeWorkflowRecord); });
      if (saved.smsStatusByTicket) state.smsStatusByTicket = deepClone(saved.smsStatusByTicket);
      if (saved.smsRetryOverrides) state.smsRetryOverrides = deepClone(saved.smsRetryOverrides);
      if (saved.contactRecordsByTicket) state.contactRecordsByTicket = deepClone(saved.contactRecordsByTicket);
      Object.keys(state.contactRecordsByTicket).forEach(ticketId => {
        state.contactRecordsByTicket[ticketId] = (state.contactRecordsByTicket[ticketId] || []).filter(record => !/^(?:default-|demo-|approval-call-)/.test(String(record?.id || "")));
      });
      if (saved.contactRecordEditsByTicket) state.contactRecordEditsByTicket = deepClone(saved.contactRecordEditsByTicket);
      // Restore every timestamp-style legacy ID to the stable DH + date + daily sequence convention.
      const normalizedSupervisionIds = window.XIBComplaintInspections?.normalizeSupervisionLetterIds(saved.supervisionLetters, saved.workPoolAssignments?.subprocess);
      const supervisionIdsMigrated = Boolean(normalizedSupervisionIds?.migrated);
      if (normalizedSupervisionIds) {
        saved.supervisionLetters = normalizedSupervisionIds.supervisionLetters;
        if (saved.workPoolAssignments?.subprocess) saved.workPoolAssignments.subprocess = normalizedSupervisionIds.assignments;
      }
      window.XIBComplaintInspections?.hydrateState({ supervisionLetters: saved.supervisionLetters });
      if (saved.approvalStageByDocument) state.approvalStageByDocument = deepClone(saved.approvalStageByDocument);
      if (saved.supplementDataBySubprocess) state.supplementDataBySubprocess = deepClone(saved.supplementDataBySubprocess);
      if (saved.riskTagsByTicket) state.riskTagsByTicket = deepClone(saved.riskTagsByTicket);
      if (saved.manualRiskTagsByTicket) state.manualRiskTagsByTicket = deepClone(saved.manualRiskTagsByTicket);
      if (saved.repeatRelations) state.repeatRelations = deepClone(saved.repeatRelations);
      if (saved.importDraftDataById) state.importDraftDataById = deepClone(saved.importDraftDataById);
      if (saved.triggeredSubprocesses) state.triggeredSubprocesses = deepClone(saved.triggeredSubprocesses);
      COMPLAINT_WORK_POOL.hydrate(saved.workPoolAssignments);
      // 兼容旧浏览器数据：部分工单已进入审批状态，但工单池仍保留处理人，
      // 会导致其被审批管理“我的工作台”过滤。仅修复缺失或仍指向建单/处理人的归属。
      const approvalAssignmentsRepaired = repairApprovalWorkPoolAssignments();
      subprocessExamplesMigration.addedIds.forEach(id => {
        const assignee = SEED_DATA.runtimeDefaults?.workPool?.assignments?.subprocess?.[id]?.assignee;
        if (assignee) COMPLAINT_WORK_POOL.assign("subprocess", id, assignee);
      });
      migratedApprovalExamples.forEach(id => {
        const assignee = SEED_DATA.runtimeDefaults?.workPool?.assignments?.ticket?.[id]?.assignee;
        if (assignee) COMPLAINT_WORK_POOL.assign("ticket", id, assignee);
      });
      if (exportRequestsMigrated || petitionDemoWasUntouched || petitionDemoNeedsOpeningSteps || supervisionIdsMigrated || approvalIdsMigrated || migratedApprovalExamples.length || subprocessExamplesMigration.changed || approvalAssignmentsRepaired) persistWorkflowState();
    } catch (error) {
      console.warn("Prototype restoration unavailable", error);
    }
  }

  function reconcileStructuredSeedRelations() {
    const seedTickets = SEED_DATA.documentData?.tickets || {};
    Object.entries(state.documentData.tickets || {}).forEach(([ticketId, detail]) => {
      if (!detail?.fields?.entry || detail.fields.entry["附件"] !== undefined) return;
      detail.fields.entry["附件"] = seedTickets[ticketId]?.fields?.entry?.["附件"] || "-";
    });
    Object.entries(state.documentData.tickets || {}).forEach(([ticketId, detail]) => {
      if (detail?.documentType !== "投诉单" || !detail.fields) return;
      detail.fields.entry = detail.fields.entry || {};
      detail.fields.processing = detail.fields.processing || {};
      const reliefNotice = detail.fields.processing["救济途径是否告知"];
      if (reliefNotice && !["是", "否"].includes(reliefNotice)) detail.fields.processing["救济途径是否告知"] = "是";
      delete detail.fields.processing["救济途径"];
      if (detail.fields.entry["投诉对象"] === undefined) detail.fields.entry["投诉对象"] = detail.fields.processing["投诉对象"] || detail.fields.entry["投诉/信访对象"] || seedTickets[ticketId]?.fields?.entry?.["投诉对象"] || "";
      delete detail.fields.processing["投诉对象"];
      delete detail.fields.entry["投诉/信访对象"];
    });
    const seedSubprocesses = new Map((SEED_DATA.lists?.subprocesses || []).map(record => [record.id, record]));
    subprocessRows.forEach(row => {
      const canonical = seedSubprocesses.get(row[0]);
      if (!canonical) return;
      row[2] = canonical.relatedTicketId;
      row[3] = canonical.customer;
const detail = state.documentData.subprocesses?.[row[0]];
      if (detail) {
        const detailIds = [detail.relatedTicketIds, detail.fields?.base?.["关联工单编号"]].map(normalizeRelatedTicketIds).find(ids => ids.length) || [];
        if (!detailIds.length) {
          detail.relatedTicketIds = [canonical.relatedTicketId];
          if (!detail.fields) detail.fields = {};
          if (!detail.fields.base) detail.fields.base = {};
          if (!detail.fields.base["关联工单编号"]) detail.fields.base["关联工单编号"] = canonical.relatedTicketId;
        }
      }    });
    const sampleId = "TS202607290016";
    const sample = state.documentData.tickets?.[sampleId];
    const canonicalSample = SEED_DATA.documentData?.tickets?.[sampleId];
    if (sample && canonicalSample) {
      const processing = sample.fields?.processing || {};
      if (!processing["会签机构"] && processing["会签部门"] && Array.isArray(processing["会签部门"]) && processing["会签部门"].every(value => String(value).includes(" / "))) {
        processing["会签机构"] = deepClone(processing["会签部门"]);
      }
      const members = sample.fields?.countersign?.["会签明细"];
      if (!Array.isArray(members) || members.length < 2) sample.fields.countersign = deepClone(canonicalSample.fields.countersign);
    }
  }

  restoreWorkflowState();
  if (ensureSeedTicketContactRecords()) persistWorkflowState();
  reconcileStructuredSeedRelations();
  function workflowEntry(kind) {
    if (state.approvalContext) return "approve";
    if (kind === "rectification") return state.rectificationMode === "process" ? "process" : state.rectificationMode === "approve" ? "approve" : "view";
    return state.detailEntry || "view";
  }

  function workflowPolicy(kind, row, entry = workflowEntry(kind)) {
    const role = currentRoleProfile().role;
    const status = row?.[5] || "";
    const approvalStates = kind === "rectification" ? ["问题待审核", "方案待初审", "方案待审批", "结果待初审", "结果待审批"] : kind === "ticket" ? ["会签中", "待初审", "初审中", "待审批", "审批中"] : ["待初审", "初审中", "待审批", "审批中"];
    const processStates = kind === "ticket" ? ["待处理", "处理中"] : kind === "subprocess" ? ["待处理", "处理中"] : ["方案待提交", "整改中"];
    const creatorStates = kind === "rectification" ? ["草稿", "问题待提交"] : ["草稿", "待提交"];
    const isApprovalEntry = entry === "approve";
    const reviewApproval = ["ticket", "subprocess"].includes(kind) && ["待复核", "复核中"].includes(status) && ["reviewer", "developer"].includes(role);
    const regularApproval = approvalStates.includes(status) && ["reviewer", "approver", "analyst", "developer"].includes(role);
    const canApprove = isApprovalEntry && (reviewApproval || regularApproval);
    const canProcess = entry === "process" && ["handler", "developer"].includes(role) && processStates.includes(status);
    const canSupplement = kind === "subprocess" && entry === "supplement" && status === "待补录" && ["operator", "handler", "developer"].includes(role);
    const canEditCreation = entry === "create" && ["operator", "developer"].includes(role) && creatorStates.includes(status);
    const isRepeatTicket = kind === "ticket" && ["再次投诉单", "重复投诉单"].includes(ticketListKind(row));
    const detailOrigin = state.navigationTrail[state.navigationTrail.length - 1]?.page || "";
    const canStartFromQueryDetail = kind === "ticket" && entry === "view" && state.page === "ticket-detail" && detailOrigin === "ledger-query" && ["operator", "handler", "developer"].includes(role);
    return {
      kind, entry, status,
      readOnly: isApprovalEntry || entry === "view" || (!canApprove && !canProcess && !canSupplement && !canEditCreation),
      canApprove, canProcess, canSupplement, canEditCreation,
      canEdit: canProcess || canSupplement || canEditCreation,
      canSeeProcessing: kind === "ticket" && (["handler", "developer"].includes(role) || isApprovalEntry || processStates.includes(status) || canStartFromQueryDetail),
      canStartSubprocess: kind === "ticket" && !isRepeatTicket && (canProcess || canStartFromQueryDetail),
      rejection: (workflowHistory[kind][row?.[0]] || []).find(item => item.result === "不通过" || item.result === "驳回") || null
    };
  }

  // 审批人员也可以补充风险标签，其他工单内容仍保持只读。
  function canEditManualRiskTags(row) {
    const policy = workflowPolicy("ticket", row);
    return state.detailTab === "处理信息" && ["投诉单", "信访单"].includes(row?.[1]) &&
      (policy.canProcess || (policy.entry === "approve" && policy.canApprove));
  }

  function renderDraftValidationBanner(record, documentLabel) {
    const metadata = record?.draftMetadata;
    if (!metadata || metadata.validationStatus === "通过") return "";
    const missingFields = metadata.missingFields || [];
    const errorSummary = (metadata.validationErrors || []).map(item => item.field + "：" + item.message).join("；");
    return '<section class="workflow-rejection draft-validation-banner" role="status"><div class="workflow-rejection-head"><span class="workflow-rejection-icon" aria-hidden="true">!</span><div><strong>' + documentLabel + '草稿数据不完整</strong><span>草稿允许保存缺失信息；补齐并通过校验后才能提交。</span></div>' + statusTag("校验未通过") + '</div><div class="workflow-rejection-body"><div class="workflow-rejection-opinion"><span>待补充字段（' + missingFields.length + '）</span><p>' + (missingFields.join("、") || "-") + '</p><small>' + (errorSummary || "存在未通过的数据完整性校验") + '</small></div><dl class="workflow-rejection-meta"><div><dt>数据来源</dt><dd>' + escapeAttribute(metadata.sourceType || "-") + '</dd></div><div><dt>来源记录</dt><dd>' + escapeAttribute(metadata.sourceReference || "-") + '</dd></div><div><dt>最近校验时间</dt><dd>' + escapeAttribute(metadata.lastValidatedAt || "-") + '</dd></div></dl></div></section>';
  }

  function renderWorkflowRejection(policy) {
    if (!policy.rejection) return "";
    if (policy.kind === "ticket" && policy.status !== "处理中") return "";
    if (policy.kind !== "ticket" && !String(policy.status).includes("驳回")) return "";
    const item = normalizeWorkflowRecord(policy.rejection);
    const isTicket = policy.kind === "ticket";
    const title = isTicket ? "审批未通过，工单已退回处理" : "审批未通过，单据已退回上一节点";
    const helper = isTicket ? "请根据审批意见补充处理信息后重新提交审批。" : "请根据审批意见补充相关信息后重新提交。";
    const status = isTicket ? "处理中" : policy.status;
    return '<section class="workflow-rejection" role="status"><div class="workflow-rejection-head"><span class="workflow-rejection-icon" aria-hidden="true">!</span><div><strong>' + title + '</strong><span>' + helper + '</span></div>' + statusTag(status) + '</div><div class="workflow-rejection-body"><div class="workflow-rejection-opinion"><span>驳回意见</span><p>' + escapeAttribute(item.flowOpinion || "-") + '</p></div><dl class="workflow-rejection-meta"><div><dt>审批人</dt><dd>' + escapeAttribute(item.operatorName) + '</dd></div><div><dt>角色 / 机构</dt><dd>' + escapeAttribute(item.operatorRoleName + ' · ' + item.operatorOrgName) + '</dd></div><div><dt>操作时间</dt><dd>' + escapeAttribute(item.operationTime) + '</dd></div></dl></div></section>';
  }

  function latestCreationRejection(kind, row) {
    if (!row || row[5] !== "待提交") return null;
    return (workflowHistory[kind]?.[row[0]] || []).map(normalizeWorkflowRecord).find(item =>
      item.to === "待提交" && (item.result === "不通过" || item.result === "驳回") && /复核驳回|处理人驳回/.test(item.flowSceneName)
    ) || null;
  }

  function renderCreationRejection(kind, row) {
    const item = latestCreationRejection(kind, row);
    if (!item) return "";
    const documentName = kind === "ticket" ? "工单" : "子单";
    return '<section class="workflow-rejection" role="status"><div class="workflow-rejection-head"><span class="workflow-rejection-icon" aria-hidden="true">!</span><div><strong>最新驳回意见</strong><span>请根据驳回意见修改' + documentName + '内容后重新提交。</span></div>' + statusTag("待提交") + '</div><div class="workflow-rejection-body"><div class="workflow-rejection-opinion"><span>驳回意见</span><p>' + escapeAttribute(item.flowOpinion || "-") + '</p></div><dl class="workflow-rejection-meta"><div><dt>驳回人</dt><dd>' + escapeAttribute(item.operatorName) + '</dd></div><div><dt>驳回节点</dt><dd>' + escapeAttribute(item.flowSceneName) + '</dd></div><div><dt>操作时间</dt><dd>' + escapeAttribute(item.operationTime) + '</dd></div></dl></div></section>';
  }
  const queryTicketRows = ticketRows.map(row => {
    const relation = state.repeatRelations[row[0]];
    return [...row, relation?.mainTicket ? "再次投诉单" : "工单", relation?.mainTicket || "-"];
  });

  const FINANCIAL_REGULATORY_BUREAUS = Object.freeze(["厦门金管局","福建金管局","珠海金管局","北京金管局","上海金管局","宁德金管局","龙岩金管局","泉州金管局","漳州金管局","莆田金管局","三明金管局","南平金管局"]);
  const ACCEPTANCE_CHANNEL_OPTIONS = Object.freeze(FORM_SCHEMA.work_orders?.acceptance_channels || {
    "投诉单": ["客服电话", "在线客服", "总行投诉邮箱", "机构专线电话", "营业网点", "客户意见簿", "信函", ...FINANCIAL_REGULATORY_BUREAUS, "金融消费者保护服务平台", "市长热线", "其它"],
    "信访单": [...FINANCIAL_REGULATORY_BUREAUS, "纪检", "其它"],
    "\u8868\u626c\u5355": ["\u5ba2\u670d\u7535\u8bdd", "\u5728\u7ebf\u5ba2\u670d", "\u603b\u884c\u6295\u8bc9\u90ae\u7bb1", "\u673a\u6784\u4e13\u7ebf\u7535\u8bdd", "\u8425\u4e1a\u7f51\u70b9", "\u5ba2\u6237\u610f\u89c1\u7c3f", "\u4fe1\u51fd", "\u5176\u5b83"],
    "\u5efa\u8bae\u5355": ["\u5ba2\u670d\u7535\u8bdd", "\u5728\u7ebf\u5ba2\u670d", "\u603b\u884c\u6295\u8bc9\u90ae\u7bb1", "\u673a\u6784\u4e13\u7ebf\u7535\u8bdd", "\u8425\u4e1a\u7f51\u70b9", "\u5ba2\u6237\u610f\u89c1\u7c3f", "\u4fe1\u51fd", "\u5176\u5b83"],
    "\u8206\u60c5\u5355": ["\u9ed1\u732b\u6295\u8bc9", "\u6296\u97f3", "\u5c0f\u7ea2\u4e66", "\u5fae\u4fe1\u516c\u4f17\u53f7", "\u5176\u5b83"]
  });
  const ALL_ACCEPTANCE_CHANNEL_OPTIONS = [...new Set(Object.entries(ACCEPTANCE_CHANNEL_OPTIONS)
    .filter(([type]) => !DISABLED_WORK_ORDER_TYPES.has(type))
    .flatMap(([, options]) => options))];

  const ASSIGNMENT_TAG_FIELD_NAMES = new Set(["业务办理渠道标签", "投诉产品标签", "投诉原因标签", "投诉诉求标签"]);
  const ASSIGNMENT_TAG_FIELDS = deepClone(
    FORM_SCHEMA.work_orders?.entry_sections?.find(section => section.id === "intelligent-tags")?.fields
      ?.filter(field => ASSIGNMENT_TAG_FIELD_NAMES.has(field.name)) || []
  );
  const CORRECTION_TAG_FIELD_MAP = Object.freeze({
    "\u4fee\u6b63\u4e1a\u52a1\u529e\u7406\u6e20\u9053\u6807\u7b7e": "\u4e1a\u52a1\u529e\u7406\u6e20\u9053\u6807\u7b7e",
    "修正投诉产品标签": "投诉产品标签",
    "\u4fee\u6b63\u6295\u8bc9\u539f\u56e0\u6807\u7b7e": "\u6295\u8bc9\u539f\u56e0\u6807\u7b7e",
    "\u4fee\u6b63\u6295\u8bc9\u8bc9\u6c42\u6807\u7b7e": "\u6295\u8bc9\u8bc9\u6c42\u6807\u7b7e"
  });
  const CORRECTION_TAG_FIELDS = new Set(Object.keys(CORRECTION_TAG_FIELD_MAP));
  const CORRECTION_WRITEBACK = window.XIBCorrectionWriteback;

  function correctionTagFieldDefinitions() {
    return Object.entries(CORRECTION_TAG_FIELD_MAP).map(([name, sourceName]) => {
      const field = deepClone(ASSIGNMENT_TAG_FIELDS.find(item => item.name === sourceName) || {});
      delete field.types;
      delete field.requiredBy;
      return { ...field, name, all: true, required: false, placeholder: "如无需修正可留空" };
    });
  }

  function correctionTagName(sourceName) {
    return Object.entries(CORRECTION_TAG_FIELD_MAP).find(([, mappedSource]) => mappedSource === sourceName)?.[0] || "";
  }

  function correctionTagField(sourceName) {
    return correctionTagFieldDefinitions().find(field => CORRECTION_TAG_FIELD_MAP[field.name] === sourceName) || null;
  }

  function normalizedTagDisplay(value) {
    return Array.isArray(value) ? value.join(" / ") : String(value || "");
  }

  function smartTagOriginalValue(row, sourceName) {
    const stored = documentRecordFor("ticket", row)?.fields?.entry?.[sourceName];
    if (stored) return normalizedTagDisplay(stored);
    const result = TRS_TAG_RESULTS[row?.[1]] || TRS_TAG_RESULTS["投诉单"];
    const fallback = {
      "业务办理渠道标签": result.channel,
      "投诉产品标签": result.product,
      "投诉原因标签": result.reason,
      "投诉诉求标签": result.appeal
    }[sourceName];
    return normalizedTagDisplay(fallback);
  }

  function smartTagCorrectionValue(row, sourceName) {
    const correctionName = correctionTagName(sourceName);
    if (!correctionName) return "";
    const live = state.formValues["processing." + row[0] + "." + correctionName];
    const stored = documentRecordFor("ticket", row)?.fields?.processing?.[correctionName];
    return normalizedTagDisplay(live || stored);
  }

  function correctionTagDraftKey(row, sourceName) {
    return "correction-draft." + row[0] + "." + correctionTagName(sourceName);
  }

  function renderSmartTagPill(value, className = "") {
    return '<span class="ds-tag is-light is-blue smart-tag-pill ' + className + '">' + escapeAttribute(value || "-") + '</span>';
  }

  function renderSmartTagItem(row, sourceName, editable) {
    const ticketRecord = documentRecordFor("ticket", row);
    const latestCorrectionChange = latestCompletedCorrection(ticketRecord)?.changes?.find(change => change.field === sourceName);
    const storedOverride = ticketRecord?.fields?.correctionOverrides?.[sourceName];
    let original = smartTagOriginalValue(row, sourceName);
    let corrected = smartTagCorrectionValue(row, sourceName);
    if (latestCorrectionChange) {
      original = normalizedTagDisplay(latestCorrectionChange.oldValue);
      corrected = normalizedTagDisplay(latestCorrectionChange.newValue);
    } else if (!corrected && storedOverride !== undefined && storedOverride !== null && storedOverride !== "") {
      original = normalizedTagDisplay(storedOverride);
    }
    const editKey = row[0] + "::" + sourceName;
    const editing = editable && state.correctionTagEditing === editKey;
    const draft = normalizedTagDisplay(state.formValues[correctionTagDraftKey(row, sourceName)]);
    const replacement = editing ? draft : corrected;
    const editButton = editable ? '<button type="button" class="smart-tag-edit" data-action="edit-correction-tag" data-id="' + escapeAttribute(sourceName) + '" data-ticket="' + escapeAttribute(row[0]) + '" aria-label="编辑' + escapeAttribute(sourceName) + '" title="编辑"><img src="ui/assets/edit2.svg" alt=""></button>' : '';
    const versions = '<div class="smart-tag-versions"><div class="smart-tag-version is-original ' + (replacement ? 'is-replaced' : '') + '">' + renderSmartTagPill(original) + (replacement ? '<em>不可用，已被修改</em>' : '') + '</div>' + (replacement ? '<div class="smart-tag-version is-corrected"><span>修正后标签</span>' + renderSmartTagPill(replacement, "is-corrected") + '</div>' : '') + '</div>';
    let editor = "";
    if (editing) {
      const field = correctionTagField(sourceName);
      editor = '<div class="smart-tag-inline-editor"><div class="smart-tag-editor-label">选择修正标签</div>' + renderField(field, "correction-draft." + row[0]) + '<div class="smart-tag-editor-actions"><button type="button" class="btn xib-btn xib-btn--secondary" data-action="cancel-correction-tag" data-id="' + escapeAttribute(sourceName) + '" data-ticket="' + escapeAttribute(row[0]) + '">取消</button><button type="button" class="btn xib-btn xib-btn--primary" data-action="save-correction-tag" data-id="' + escapeAttribute(sourceName) + '" data-ticket="' + escapeAttribute(row[0]) + '">保存</button></div></div>';
    }
    return '<div class="smart-tag-detail-item ' + (editing ? 'is-editing ' : '') + (latestCorrectionChange ? 'is-correction-changed' : '') + '" data-smart-tag-ticket="' + escapeAttribute(row[0]) + '" data-smart-tag-field="' + escapeAttribute(sourceName) + '"><dt>' + escapeAttribute(sourceName) + '</dt><dd><div class="smart-tag-value-row">' + versions + editButton + '</div>' + editor + '</dd></div>';
  }

  function refreshSmartTagItem(row, sourceName) {
    const current = [...document.querySelectorAll(".smart-tag-detail-item")].find(item => item.dataset.smartTagTicket === row[0] && item.dataset.smartTagField === sourceName);
    if (!current) return;
    const template = document.createElement("template");
    template.innerHTML = renderSmartTagItem(row, sourceName, true);
    const next = template.content.firstElementChild;
    current.replaceWith(next);
    bindActionButtons(next);
    bindHierarchyCascaders(next);
  }

  function assignmentTagFieldsForType(type) {
    return ASSIGNMENT_TAG_FIELDS.filter(field => historicalFieldApplies(field, type));
  }

  function renderSmartTagsSection(row, editable = false) {
    const type = row?.[1] || "投诉单";
    const title = ["建议单", "表扬单"].includes(type) ? "标签信息" : "智能标签";
    const disclaimer = sectionUsesAi("intelligent-tags", type) ? '<small class="ai-section-disclaimer">' + AI_DISCLAIMER + '</small>' : "";
    return '<section class="panel detail-section smart-tag-section" data-ticket-detail-section="intelligent-tags"><div class="panel-head"><span class="panel-title">' + title + '</span>' + disclaimer + '</div><dl class="ds-descriptions detail-descriptions smart-tag-descriptions">' + assignmentTagFieldsForType(type).map(field => renderSmartTagItem(row, field.name, editable)).join("") + '</dl></section>';
  }

  function businessLineDraftKey(row) {
    return "business-line-draft." + row[0];
  }

  function ticketBusinessLineValue(row) {
    const value = documentRecordFor("ticket", row)?.fields?.entry?.["所属业务条线"];
    if (value && typeof value === "object") return deepClone(value);
    if (typeof value === "string" && value) return { primary:value, optional:"" };
    return { primary:"零售金融部", optional:"" };
  }

  function renderBusinessLineDetailItem(row, editable = false) {
    const editing = editable && state.businessLineEditing === row[0];
    const value = ticketBusinessLineValue(row);
    const draftKey = businessLineDraftKey(row);
    const editButton = editable ? '<button type="button" class="smart-tag-edit" data-action="edit-business-line" data-ticket="' + escapeAttribute(row[0]) + '" aria-label="编辑所属业务条线" title="编辑"><img src="ui/assets/edit2.svg" alt=""></button>' : '';
    const editor = editing ? '<div class="smart-tag-inline-editor business-line-inline-editor"><div class="smart-tag-editor-label">修改所属业务条线</div>' + renderBusinessLinePickerControl('field-business-line-draft-' + escapeAttribute(row[0]), BUSINESS_LINE_FIELD, draftKey, false, false) + '<div class="smart-tag-editor-actions"><button type="button" class="btn xib-btn xib-btn--secondary" data-action="cancel-business-line" data-ticket="' + escapeAttribute(row[0]) + '">取消</button><button type="button" class="btn xib-btn xib-btn--primary" data-action="save-business-line" data-ticket="' + escapeAttribute(row[0]) + '">保存</button></div></div>' : '';
    return '<div class="is-wide business-line-detail-item ' + (editing ? 'is-editing' : '') + '" data-business-line-ticket="' + escapeAttribute(row[0]) + '"><dt>所属业务条线</dt><dd><div class="business-line-value-row"><span>' + escapeAttribute(businessLineValueLabel(value) || '-') + '</span>' + editButton + '</div>' + editor + '</dd></div>';
  }

  function recordTicketEntryFieldChange(row, label, previousValue, nextValue) {
    const before = ticketDetailValueText(previousValue) || "-";
    const after = ticketDetailValueText(nextValue) || "-";
    if (before === after) return null;
    return appendWorkflowRecord("ticket", row, row[5], row[5], "修改基本信息", {
      flowSceneName:"修改基本信息",
      flowOpinion:label + "：" + before + " → " + after,
      systemGeneratedOpinion:true,
      receiverName:"-",
      operationTime:systemTimestamp()
    });
  }

  function ticketComplaintInstitutionValue(row) {
    return documentRecordFor("ticket", row)?.fields?.entry?.["投诉/信访/表扬机构"] || row?.[4] || "";
  }

  function refreshBusinessLineDetailItem(row) {
    const current = document.querySelector('.business-line-detail-item[data-business-line-ticket="' + CSS.escape(row[0]) + '"]');
    if (!current) return;
    const template = document.createElement("template");
    template.innerHTML = renderBusinessLineDetailItem(row, true);
    const next = template.content.firstElementChild;
    current.replaceWith(next);
    bindActionButtons(next);
    bindBusinessLinePickers(next);
  }
  const TRS_TAG_RESULTS = {
    "投诉单": {
      product: ["贷款", "个人合作类贷款", "度小满"],
      channel: ["第三方合作渠道", "度小满"],
      appeal: ["催收还款类", "协商还款/个性化分期"],
      reason: ["服务类", "客服服务", "服务效率"]
    },
    "信访单": {
      product: ["贷款", "个人非合作类贷款", "个人经营贷"],
      channel: ["大堂渠道", "柜面业务"],
      appeal: ["查证解释类", "查明账户异常原因"],
      reason: ["服务类", "网点线下服务", "对客户经理服务不满意"]
    },
    "表扬单": {
      product: ["电子银行", "个人电子渠道", "手机银行"],
      channel: ["大堂渠道", "厅堂服务"],
      appeal: ["追责道歉类", "赔礼道歉"],
      reason: ["服务类", "网点线下服务", "对客户经理服务不满意"]
    },
    "建议单": {
      product: ["贷款", "个人非合作类贷款", "个人经营贷"],
      channel: ["线上自有渠道", "手机银行"],
      appeal: ["账户额度类", "注销额度"],
      reason: ["对公企业网银", "企业网银登录与认证场景", "企业网银无法登录"]
    },
    "舆情单": {
      product: ["贷款", "个人合作类贷款", "京东"],
      channel: ["第三方合作渠道", "京东"],
      appeal: ["账户额度类", "撤销不良标记"],
      reason: ["服务类", "客服服务", "服务效率"]
    }
  };
  const AI_CLASSIFICATION_TYPES = new Set(["投诉单", "信访单"]);
  const AI_TAG_FIELD_NAMES = ["业务办理渠道标签", "投诉产品标签", "投诉原因标签", "投诉诉求标签"];
  const AI_SINGLE_FIELD_NAMES = ["业务办理渠道", "业务类别", "投诉/信访原因", "被投诉业务办理渠道", "被投诉业务类别", "被投诉业务原因"];
  const AI_WAITING_FIELD_NAMES = new Set([...AI_TAG_FIELD_NAMES, ...AI_SINGLE_FIELD_NAMES, "投诉请求", "派发机构", "派发部门"]);
  const AI_DISCLAIMER = "本内容由AI大模型自动生成，仅供参考，请自行核实甄别。";
  const formSections = deepClone(FORM_SCHEMA.work_orders?.entry_sections || []);

  function formSectionTitle(section, type = state.workOrderType) {
    return section?.titleBy?.[type] || section?.title || "";
  }

  function orderedFormSections() {
    const sections = [...formSections];
    sections.filter(section => section.positionAfter).forEach(section => {
      const currentIndex = sections.indexOf(section);
      const targetIndex = sections.findIndex(candidate => candidate.id === section.positionAfter);
      if (currentIndex < 0 || targetIndex < 0) return;
      sections.splice(currentIndex, 1);
      const refreshedTargetIndex = sections.findIndex(candidate => candidate.id === section.positionAfter);
      sections.splice(refreshedTargetIndex + 1, 0, section);
    });
    return sections;
  }

  function sectionUsesAi(sectionId, type = state.workOrderType) {
    if (!AI_CLASSIFICATION_TYPES.has(type)) return false;
    if (["intelligent-tags", "intelligent-dispatch"].includes(sectionId)) return true;
    return type === "投诉单" && ["pboc", "regulatory"].includes(sectionId);
  }
  const BUSINESS_LINE_FIELD = deepClone(formSections.flatMap(section => section.fields || []).find(field => field.name === "所属业务条线") || {});
  const BUSINESS_LINE_OPTIONS = Object.freeze([...new Set([...(BUSINESS_LINE_FIELD.primaryOptions || []), ...(BUSINESS_LINE_FIELD.optionalOptions || [])])]);

  function businessLineFilterField(key) {
    return { label:"所属业务条线", type:"multiSelect", key, options:BUSINESS_LINE_OPTIONS };
  }

  function complaintPermissionConfigured(page, tab = "") {
    if (!Array.isArray(COMPLAINT_PERMISSION_RULES) || !COMPLAINT_PERMISSION_RULES.length) return false;
    const normalizedTab = normalizedPermissionTab(tab);
    return COMPLAINT_PERMISSION_RULES.some(rule => rule.page === page && (!normalizedTab || normalizedPermissionTab(rule.tab) === normalizedTab));
  }

  function complaintPageAllowed(page) {
    if (!complaintPermissionConfigured(page)) return null;
    if (state.role === "developer") return true;
    return complaintPermissionEntries(page).length > 0;
  }

  function allowed(page) {
    if (page === "ticket-form") {
      const complaintAllowed = complaintPageAllowed("ticket-create");
      return (complaintAllowed !== null ? complaintAllowed : PERMISSIONS[state.role].includes("ticket-create"));
    }
    if (page === "ticket-detail") {
      const relatedPages = ["ticket-create", "ticket-process", "ledger-query", "my-approvals"];
      return relatedPages.some(item => complaintPageAllowed(item) === true) || PERMISSIONS[state.role].some(id => ["ticket-create", "ticket-process", "ledger-query", "my-approvals"].includes(id));
    }
    if (page === "subprocess-form") {
      const complaintAllowed = complaintPageAllowed("subprocess-create");
      return (complaintAllowed !== null ? complaintAllowed : PERMISSIONS[state.role].includes("subprocess-create"));
    }
    if (page === "subprocess-detail") {
      const relatedPages = ["subprocess-create", "subprocess-manage", "ledger-query", "my-approvals"];
      return relatedPages.some(item => complaintPageAllowed(item) === true) || PERMISSIONS[state.role].some(id => ["subprocess-create", "subprocess-manage", "ledger-query", "subprocess-approvals", "my-approvals"].includes(id));
    }
    if (["rectification-detail", "rectification-form"].includes(page)) return ["rectification-create", "rectification-process", "rectification-approve"].some(id => PERMISSIONS[state.role].includes(id));
    const complaintAllowed = complaintPageAllowed(page);
    if (complaintAllowed !== null) return complaintAllowed;
    return PERMISSIONS[state.role].includes(page);
  }

  function icon(name) {
    if (name === "info") return '<svg class="xib-action-icon xib-info-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path></svg>';
    if (name === "ai") return '<svg class="xib-action-icon xib-ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.35 4.05a2.5 2.5 0 0 0 1.6 1.6L19 10l-4.05 1.35a2.5 2.5 0 0 0-1.6 1.6L12 17l-1.35-4.05a2.5 2.5 0 0 0-1.6-1.6L5 10l4.05-1.35a2.5 2.5 0 0 0 1.6-1.6L12 3z"></path><path d="M5 3v4M3 5h4M19 16v5M16.5 18.5h5"></path></svg>';
    const map = { plus: "plus.svg", edit: "data.svg", import: "upload2.svg", search: "search.svg", reset: "refresh.svg", close: "close.svg", back: "back.svg", menu: "menu.svg", phone: "phone.svg", notice: "notice.svg", upload: "upload.svg", download: "download.svg", transcript: "microphone.svg" };
    return map[name] ? `<img class="xib-action-icon" src="ui/assets/${map[name]}" alt="">` : `<span aria-hidden="true">${name}</span>`;
  }

  function escapeAttribute(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function statusTagPalette(status) {
    const exact = STATUS_TAG_CONFIG.statuses?.[status];
    if (exact && STATUS_TAG_CONFIG.palettes?.[exact]) return exact;
    const matchedRule = (STATUS_TAG_CONFIG.fallbackRules || []).find(rule =>
      (rule.keywords || []).some(keyword => status.includes(keyword)) && STATUS_TAG_CONFIG.palettes?.[rule.palette]
    );
    return matchedRule?.palette || STATUS_TAG_CONFIG.defaultPalette || "info";
  }

  function statusTag(status) {
    if (!status || status === "-") return '<span class="status-empty">-</span>';
    const text = String(status);
    const paletteKey = statusTagPalette(text);
    const palette = STATUS_TAG_CONFIG.palettes?.[paletteKey] || STATUS_TAG_CONFIG.palettes?.info || {};
    const className = STATUS_TAG_CONFIG.component?.className || "tag ds-tag is-light status-tag";
    const style = `--tag-color:${palette.textColor || "#2272DE"};--tag-light:${palette.backgroundColor || "#E9F1FC"}`;
    return `<span class="${escapeAttribute(className)}" data-flow-status="${escapeAttribute(text)}" data-status-palette="${escapeAttribute(paletteKey)}" style="${escapeAttribute(style)}">${escapeAttribute(text)}</span>`;
  }

  function plainIdCell(value, className = "primary-cell") {
    return '<td class="' + className + ' is-static-id">' + escapeAttribute(value || "-") + '</td>';
  }

  function linkedIdCell(value, action, extraAttrs = "", className = "primary-cell") {
    const safe = escapeAttribute(value || "-");
    return '<td class="' + className + '"><button type="button" class="btn-link" data-action="' + action + '" data-id="' + safe + '" ' + extraAttrs + '>' + safe + '</button></td>';
  }

  function filterStatusKey(label, explicitKey = "") {
    return "multi:" + filterNormalizedText(explicitKey || label || "");
  }

  function selectedFilterStatuses(label, explicitKey = "") {
    return state.filterStatusMulti?.[filterStatusKey(label, explicitKey)] || [];
  }

  function filterMultiSummary(values) {
    return values.length ? values.join("\u3001") : "\u8bf7\u9009\u62e9";
  }

  function filterMultiHint(label) {
    return /\u72b6\u6001/.test(label) ? "\u53ef\u591a\u9009\u72b6\u6001\uff0c\u672a\u9009\u62e9\u65f6\u8868\u793a\u5168\u90e8" : "\u53ef\u591a\u9009\uff0c\u672a\u9009\u62e9\u65f6\u8868\u793a\u5168\u90e8";
  }

  function filterMultiOptionLabel(label, option) {
    if (/\u72b6\u6001/.test(label)) return statusTag(option);
    if (label === "受理渠道") return '<span class="filter-channel-tag">' + escapeAttribute(option) + '</span>';
    return escapeAttribute(option);
  }

  function renderFilterMultiSelect(label, options = [], breakBefore = false, explicitKey = "") {
    const selected = selectedFilterStatuses(label, explicitKey);
    const summary = filterMultiSummary(selected);
    const searchable = ["受理渠道", "所属业务条线"].includes(label);
    const search = searchable ? '<div class="filter-status-search"><input type="search" class="di-input is-fluid" data-filter-multi-search placeholder="搜索' + escapeAttribute(label) + '" aria-label="搜索' + escapeAttribute(label) + '"></div>' : '';
    return '<div class="ticket-filter-item filter-status-multi ' + (breakBefore ? 'is-filter-row-break' : '') + '" data-filter-status-multi data-filter-status-label="' + escapeAttribute(label) + '" data-filter-multi-key="' + escapeAttribute(filterStatusKey(label, explicitKey)) + '"><label>' + label + '</label><button type="button" class="filter-status-trigger di-select is-fluid di-select-trigger" aria-haspopup="listbox"><span>' + escapeAttribute(summary) + '</span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><div class="filter-status-popover di-select-popover" hidden><div class="filter-status-head"><strong>' + escapeAttribute(label) + '</strong><span data-filter-multi-count>已选 ' + selected.length + '</span></div>' + search + '<div class="filter-status-options">' + options.map(option => '<label class="filter-status-option ' + (selected.includes(option) ? 'is-checked' : '') + '" data-filter-option-text="' + escapeAttribute(option) + '"><input type="checkbox" value="' + escapeAttribute(option) + '" ' + (selected.includes(option) ? 'checked' : '') + '><span>' + filterMultiOptionLabel(label, option) + '</span></label>').join("") + '</div><div class="filter-status-empty" data-filter-multi-empty hidden>无匹配项</div><div class="filter-status-footer"><button type="button" class="btn-link" data-filter-multi-clear>清空</button><small data-filter-multi-helper>' + filterMultiHint(label) + '</small><button type="button" class="btn xib-btn xib-btn--primary" data-filter-multi-confirm>确定</button></div></div></div>';
  }

  function topTaskCounts() {
    const profile = currentRoleProfile();
    const role = profile.taskInboxRole || state.role;
    return window.XIBHomeTaskInboxData?.taskCounts?.(role) || { complaint:0, review:0, total:0 };
  }

  function renderShell() {
    window.XIBStatisticsModule?.unmount();
    const profile = currentRoleProfile();
    const taskCounts = topTaskCounts();
    state.role = profile.role;
    state.org = profile.org;
    if (!ROLE_LABELS[state.role]) state.role = "operator";
    if (state.page === "user-manage") state.page = "admin-user";
    if (!allowed(state.page)) state.page = PERMISSIONS[state.role][0];
    let meta = PAGE_META[state.page] || PAGE_META.overview;
    if (state.role === "reviewer" && state.page === "ticket-process") meta = { title: "客服工单复核", group: "投诉管理", groupId: "complaint", subgroup: "工单管理", subgroupId: "ticket" };
    state.openGroups.add(meta.groupId);
    if (meta.subgroupId) state.openSubgroups.add(meta.subgroupId);
    document.getElementById("app").innerHTML = `
      <div class="app-shell ${state.menuOpen ? "menu-open" : ""}">
        <nav class="topbar lib-top-nav is-primary" aria-label="全局导航">
          <div class="lib-top-logo"><img src="ui/assets/xib-wordmark-primary.png" alt="厦门国际银行"></div>
          <button class="icon-btn app-menu-trigger" id="mobile-menu" title="展开导航">${icon("menu")}</button>
          <div class="app-system-name">消费者权益保护系统</div>
          <div class="top-actions">
            <div class="top-notification">
              <button class="icon-btn top-notification-trigger" id="top-notification-trigger" type="button" title="通知中心" aria-label="通知中心，共${taskCounts.total}项待办" aria-expanded="false"><img class="xib-action-icon" src="ui/assets/notice.svg" alt=""><span class="notification-count">${taskCounts.total}</span></button>
              <div class="notification-popover lib-dropdown" id="notification-popover" hidden>
                <div class="notification-popover-head"><strong>通知中心</strong><span>待办共 ${taskCounts.total} 项</span></div>
                <button type="button" data-notification-page="notice-complaint"><span class="notification-icon is-blue">${taskCounts.complaint}</span><span><b>投诉管理</b><small>${taskCounts.complaint} 项投诉管理待办消息</small></span><img src="ui/assets/arrow-right.svg" alt=""></button>
                <button type="button" data-notification-page="notice-review"><span class="notification-icon is-purple">${taskCounts.review}</span><span><b>消保审查</b><small>${taskCounts.review} 项消保审查待办消息</small></span><img src="ui/assets/arrow-right.svg" alt=""></button>
              </div>
            </div>
            ${state.role === "developer" ? `<button type="button" class="btn xib-btn xib-btn--secondary top-reset-demo" data-action="reset-demo-data" title="恢复所有模块的默认演示数据">${icon("reset")} 恢复默认数据</button>` : ""}
            ${renderRoleCascader()}
            <button class="lib-top-user" id="app-user-menu" type="button" aria-expanded="false"><span class="lib-avatar">陈</span><span class="top-user-text">陈敏慧<small>总行 · ${profile.orgLabel} · ${ROLE_LABELS[state.role]}</small></span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button>
          </div>
          <div class="lib-dropdown app-user-dropdown" hidden><button data-user-action="个人信息">个人信息</button><button data-user-action="账号设置">账号设置</button><button data-user-action="切换机构">切换机构</button><button data-user-action="退出登录">退出登录</button></div>
        </nav>
        <aside class="sidebar lib-side-menu is-dark" aria-label="业务导航">${renderNav()}</aside>
        <main class="main">
          <div class="breadcrumb lib-breadcrumb">${breadcrumbHtml(meta)}</div>
          <div id="page-root" class="lib-fade-surface">${renderPage(state.page)}</div>
        </main>
      </div>`;
    const initialStatisticsRoute = STATISTICS_MODULE_ROUTES[state.page];
    if (initialStatisticsRoute) mountStatisticsModule(document.getElementById("page-root"), initialStatisticsRoute);
    bindGlobalEvents();
    bindPageEvents();
  }

  function breadcrumbHtml(meta) {
    if (!meta.subgroup && meta.group === meta.title) return '<strong>' + meta.title + '</strong>';
    const parts = ['<span>' + meta.group + '</span>'];
    if (meta.subgroup && meta.subgroup !== meta.title) parts.push('<span>/</span><span>' + meta.subgroup + '</span>');
    parts.push('<span>/</span><strong>' + meta.title + '</strong>');
    return parts.join("");
  }

  function navIcon(groupId) {
    return ({ home: "home1-outline.svg", complaint: "document.svg", review: "check.svg", statistics: "data-analysis.svg", "report-center": "report.svg", education: "notebook.svg", notice: "notice.svg", admin: "setting.svg" })[groupId] || "document.svg";
  }

  function navSectionIcon(sectionId) {
    return ({
      ticket: "document.svg",
      request: "application.svg",
      approval: "seal-outline.svg",
      rectification: "process.svg",
      "inspection-warning": "monitor.svg",
      "stats-complaint": "data-analysis.svg",
      "stats-petition": "document.svg",
      reports: "report.svg",
      "home-tasks": "to-do-list.svg",
      "home-dashboard": "dashboard.svg",
      "admin-org": "building.svg",
      "admin-user": "user.svg",
      "admin-permission": "seal-outline.svg",
      "admin-config": "setting.svg",
      "admin-form-config": "project-outline.svg",
      "admin-jobs": "clock-in.svg",
      "admin-notify": "notice.svg",
      "admin-audit": "operation.svg"
    })[sectionId] || "document.svg";
  }

  function navNodeAllowed(node) {
    if (node.page) return allowed(node.page);
    if (node.children) return node.children.some(navNodeAllowed);
    return node.id ? allowed(node.id) : false;
  }

  function navNodeContainsPage(node, page) {
    if (node.page) return node.page === page;
    if (node.children) return node.children.some(child => navNodeContainsPage(child, page));
    return node.id === page;
  }

  function renderNav() {
    return NAV.map(group => {
      if (group.page) {
        if (!allowed(group.page)) return "";
        return '<div class="nav-group is-direct" data-group="' + group.id + '"><button class="nav-primary lib-menu-item ' + (group.page === state.page ? "is-active" : "") + '" data-page="' + group.page + '"><i class="nav-icon"><img src="ui/assets/' + navIcon(group.id) + '" alt=""></i><b class="nav-label">' + group.label + '</b></button></div>';
      }
      const sections = (group.children || []).filter(navNodeAllowed);
      if (!sections.length) return "";
      const open = state.openGroups.has(group.id);
      const containsActive = navNodeContainsPage(group, state.page);
      return '<div class="nav-group ' + (open ? "is-open " : "") + (containsActive ? "has-active-child" : "") + '" data-group="' + group.id + '">' +
        '<button class="nav-primary lib-menu-item is-parent ' + (open ? "is-open" : "") + '" aria-expanded="' + open + '" data-group-toggle="' + group.id + '"><i class="nav-icon"><img src="ui/assets/' + navIcon(group.id) + '" alt=""></i><b class="nav-label">' + group.label + '</b><span class="chevron"><img src="ui/assets/' + (open ? "caret-top.svg" : "caret-bottom.svg") + '" alt=""></span></button>' +
        '<div class="nav-children nav-level-two">' + sections.map(section => {
          if (section.children) {
            const pages = section.children.filter(page => allowed(page.id));
            if (!pages.length) return "";
            const sectionOpen = state.openSubgroups.has(section.id);
            const sectionActive = pages.some(page => page.id === state.page);
            return '<div class="nav-subgroup ' + (sectionOpen ? "is-open " : "") + (sectionActive ? "has-active-child" : "") + '" data-subgroup="' + section.id + '">' +
              '<button class="nav-secondary lib-menu-item is-parent ' + (sectionOpen ? "is-open" : "") + '" aria-expanded="' + sectionOpen + '" data-subgroup-toggle="' + section.id + '"><i class="nav-icon"><img src="ui/assets/' + navSectionIcon(section.id) + '" alt=""></i><span class="nav-secondary-label">' + section.label + '</span><span class="chevron"><img src="ui/assets/' + (sectionOpen ? "caret-top.svg" : "caret-bottom.svg") + '" alt=""></span></button>' +
              '<div class="nav-tertiary-list">' + pages.map(page => '<button class="nav-tertiary lib-menu-item ' + (page.id === state.page ? "is-active" : "") + '" data-page="' + page.id + '">' + (state.role === "reviewer" && page.id === "ticket-process" ? "客服工单复核" : page.label) + '</button>').join("") + '</div></div>';
          }
          if (!allowed(section.page)) return "";
          return '<button class="nav-secondary lib-menu-item is-level-two ' + (section.page === state.page ? "is-active" : "") + '" data-page="' + section.page + '"><i class="nav-icon"><img src="ui/assets/' + navSectionIcon(section.id) + '" alt=""></i><span class="nav-secondary-label">' + section.label + '</span></button>';
        }).join("") + '</div></div>';
    }).join("");
  }
  function navigationLabel(page) {
    if (state.role === "reviewer" && page === "ticket-process") return "客服工单复核";
    return PAGE_META[page]?.title || "上一页";
  }

  function persistNavigationTrail() {
    try { sessionStorage.setItem("xib-navigation-trail", JSON.stringify(state.navigationTrail)); } catch (error) {}
  }

  function rememberNavigationOrigin(nextPage) {
    if (!state.page || state.page === nextPage) return;
    const last = state.navigationTrail[state.navigationTrail.length - 1];
    if (!last || last.page !== state.page) state.navigationTrail.push({ page: state.page, label: navigationLabel(state.page) });
    state.navigationTrail = state.navigationTrail.slice(-24);
    persistNavigationTrail();
  }

  function currentBackTarget(fallbackPage, fallbackLabel) {
    const target = [...state.navigationTrail].reverse().find(item => item?.page && allowed(item.page));
    return target || { page: fallbackPage, label: fallbackLabel || navigationLabel(fallbackPage) };
  }

  function renderContextBackButton(fallbackPage, fallbackLabel) {
    const target = currentBackTarget(fallbackPage, fallbackLabel);
    return `<button type="button" class="btn xib-btn xib-btn--secondary" data-action="navigate-back" data-id="${target.page}">${icon("back")} 返回${target.label}</button>`;
  }

  function navigateBack(fallbackPage) {
    let target = null;
    while (state.navigationTrail.length) {
      const candidate = state.navigationTrail.pop();
      if (candidate?.page && allowed(candidate.page)) { target = candidate; break; }
    }
    persistNavigationTrail();
    return navigate(target?.page || fallbackPage || "overview", { skipHistory: true, preservePageState: true });
  }

  function pageHeader(title, desc, actions = "") {
    return `<div class="page-header"><div><h1 class="page-title">${title}</h1></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
  }

  const STATISTICS_MODULE_ROUTES = {
    "overview": "home",
    "stats-complaint-overview": "production",
    "stats-complaint-institution": "institution2",
    "stats-complaint-product": "product",
    "stats-complaint-reason": "reason",
    "stats-complaint-channel": "channel",
    "stats-complaint-line": "line",
    "stats-complaint-customer": "customer",
    "stats-petition": "petition",
    "report-center": "reports"
  };

  function statisticsPageForRoute(route) {
    return Object.keys(STATISTICS_MODULE_ROUTES).find(page => STATISTICS_MODULE_ROUTES[page] === route);
  }

  function renderStatisticsModule(page) {
    const route = STATISTICS_MODULE_ROUTES[page] || "production";
    const meta = PAGE_META[page] || { title: "统计分析" };
    return `<section class="page page--statistics-module" aria-label="${meta.title}"><div class="statistics-module-wrap"><div class="statistics-module-host" data-statistics-route="${route}"></div></div></section>`;
  }

  function mountStatisticsModule(root, route) {
    const host = root.querySelector(".statistics-module-host");
    if (!host) return;
    if (!window.XIBStatisticsModule) {
      host.innerHTML = '<div class="module-load-error">统计分析模块加载失败，请刷新页面后重试。</div>';
      return;
    }
    window.XIBStatisticsModule.mount(host, {
      route,
      onRouteChange(nextRoute) {
        const nextPage = statisticsPageForRoute(nextRoute);
        if (nextPage && nextPage !== state.page && allowed(nextPage)) navigate(nextPage);
      },
      onOpenTicket(ticketId) {
        openTicketDetail(ticketId);
      }
    });
  }

  function renderPage(page) {
    const moduleHtml = window.XIBModuleRegistry?.render(page, moduleContext());
    if (moduleHtml !== null && moduleHtml !== undefined) return moduleHtml;
    const map = {
      overview: () => renderStatisticsModule("overview"),
      "ticket-create": renderTicketCreate,
      "ticket-process": renderTicketProcess,
      "ticket-form": renderTicketForm,
      "ticket-detail": renderTicketDetail,
      "subprocess-create": renderSubprocessCreate,
      "subprocess-form": renderSubprocessForm,
      "subprocess-manage": renderSubprocessManage,
      "export-requests": renderExportRequests,
      "ledger-query": renderLedgerQuery,
      "subprocess-detail": renderSubprocessDetail,
      "rectification-detail": () => window.XIBComplaintRectification.renderDetail(moduleContext()),


      "my-approvals": renderMyApprovals,
      "ticket-approvals": renderTicketApprovals,
      "subprocess-approvals": renderSubprocessApprovals,
      "request-approvals": renderRequestApprovals,
      "report-center": () => renderStatisticsModule("report-center"),
      "stats-complaint-overview": () => renderStatisticsModule("stats-complaint-overview"),
      "stats-complaint-institution": () => renderStatisticsModule("stats-complaint-institution"),
      "stats-complaint-product": () => renderStatisticsModule("stats-complaint-product"),
      "stats-complaint-reason": () => renderStatisticsModule("stats-complaint-reason"),
      "stats-complaint-channel": () => renderStatisticsModule("stats-complaint-channel"),
      "stats-complaint-line": () => renderStatisticsModule("stats-complaint-line"),
      "stats-complaint-customer": () => renderStatisticsModule("stats-complaint-customer"),
      "stats-petition": () => renderStatisticsModule("stats-petition"),
    };
    return (map[page] || (() => renderPlaceholder(page)))();
  }

  function openTicketDetail(ticketId, options = {}) {
    state.warningContextId = options.warningContextId || "";
    state.detailEntry = "view";
    state.approvalContext = null;
    state.detailId = ticketId;
    state.detailTab = "基本信息";
    state.relatedRootTicketId = ticketId;
    state.relatedItemId = ticketId;
    state.relatedSourceSubprocessId = "";
    return navigate("ticket-detail");
  }

  function openWorkflowItem(item = {}) {
    const id = item.id || "";
    if (!id) return toast("未找到待办业务编号", true);
    if (item.kind === "approval") return openApprovalReview(id);
    state.approvalContext = null;
    if (item.kind === "ticket") {
      state.detailEntry = item.mode || "view";
      state.detailId = id;
      state.detailTab = "基本信息";
      state.relatedRootTicketId = id;
      state.relatedItemId = id;
      state.relatedSourceSubprocessId = "";
      return navigate("ticket-detail");
    }
    if (item.kind === "subprocess") {
      state.detailEntry = item.mode || "view";
      state.subprocessId = id;
      state.detailId = item.relatedTicketId || state.detailId;
      state.subprocessDetailTab = ["process","supplement"].includes(item.mode) ? "处理信息" : "基本信息";
      return navigate("subprocess-detail");
    }
    if (item.kind === "supervision") {
      window.XIBComplaintInspections?.openLetterInModule?.(id);
      return navigate("analysis-inspections");
    }
    if (item.kind === "rectification") {
      state.rectificationMode = item.mode || "view";
      state.subprocessId = id;
      if (item.mode === "approve") {
        const row = rectificationRows.find(record => record[0] === id);
        state.approvalContext = { requestId:id, type:"子流程审批", mode:"full", ticketId:row?.[2] || "", subprocessId:id };
        resetApprovalFormValues("approval");
      }
      return navigate("rectification-detail");
    }
    if (item.route) return navigate(item.route);
    return toast("该待办暂未配置详情入口", true);
  }

  function findTicketRow(ticketId) {
    const row = ticketRows.find(item => item[0] === ticketId);
    return row ? [...row] : null;
  }

  function openNotificationMessage(id) {
    state.notificationMessageId = id || "";
    const notification = window.XIBNotificationCenterData?.notifications?.find(item => item.id === state.notificationMessageId);
    return navigate(notification?.domain === "review" ? "notice-review" : "notice-complaint", { preserveNotificationMessage:true });
  }

  function moduleContext() {
    return {
      state,
      page: state.page,
      role: state.role,
      pageMeta: PAGE_META,
      pageHeader,
      renderContextBackButton,
      icon,
      toast,
      navigate,
      openTicketDetail,
      openWorkflowItem,
      openNotificationMessage,
      clearNotificationMessage: () => { state.notificationMessageId = ""; },
      formatRemainingTime: (deadline, status) => dispositionRemaining(deadline, status),
      findTicketRow,
      getTicketDepartment: ticketId => ticketReceivingDepartment(ticketRowById(ticketId)),
      getTicketComplaintProduct: ticketId => {
        const ticket = ticketRowById(ticketId);
        const value = documentRecordFor("ticket", ticket)?.fields?.entry?.["投诉产品标签"];
        return Array.isArray(value) ? value.join(" / ") : String(value || "");
      },
      getCommonDepartmentOptions: () => [...new Set(departmentHierarchyTree().flatMap(group => group.children || []).map(item => item.label))],
      getLatestTicketInspectionRun: ticketId => deepClone(latestInspectionRun(ticketRowById(ticketId))),
      getWorkPoolIdentity: role => ({ ...COMPLAINT_WORK_POOL.identity(role) }),
      assignWorkItem: (kind, id, assignee) => COMPLAINT_WORK_POOL.assign(kind, id, assignee),
      clearWorkItemAssignment: (kind, id, task = "subprocess-process", role = "handler") => COMPLAINT_WORK_POOL.clearTransferAssignment(kind, id, task, role),
      getRectificationRows: () => deepClone(rectificationRows),
      getRectificationReturnPage: () => rectificationReturnPage(),
      returnToRectificationList,
      getRectificationDocument: id => deepClone(documentRecordFor("rectification", [id]) || null),
      getRelatedTicketIds: value => normalizeRelatedTicketIds(value),
      currentUser: () => CURRENT_USER_ACTOR,
      currentOrgLabel: () => currentRoleProfile().orgLabel,
      currentInstitutionLabel: () => currentRoleProfile().institutionLabel,
      currentDepartmentLabel: () => currentRoleProfile().departmentLabel || "-",
      qualifiedDepartmentName,
      currentViewLabel: () => currentRoleProfile().label,
      taskInboxRole: currentRoleProfile().taskInboxRole || state.role,
      getRectificationDetailModel: () => {
        const row = rectificationRows.find(item => item[0] === state.subprocessId) || rectificationRows[0];
        if (!row) return null;
        const policy = workflowPolicy("rectification", row);
        const approvalFull = state.approvalContext?.mode === "full" && state.approvalContext?.type === "子流程审批";
        const editableApprovalStage = approvalFull ? rectificationApprovalEditableStage(row) : null;
        return {
          row: deepClone(row),
          base: deepClone(documentRecordFor("rectification", row)?.fields?.base || {}),
          role: state.role,
          approvalFull,
          editableApprovalStage,
          canEdit: policy.canEdit,
          canEditProcess: policy.canProcess && !approvalFull,
          canEditApprovalPrevious: Boolean(editableApprovalStage)
        };
      },
      renderRectificationReadonlySections: (phase, row, titles) => renderSubprocessReadonlyDifference(subprocessDefinition("溯源整改"), phase, deepClone(row), titles ? [...titles] : undefined),
      renderRectificationRelatedTickets: row => renderRectificationRelatedTickets(deepClone(row), { readOnly:true }),
      renderRectificationProcessingEditor: row => renderSubprocessProcessingEditor(subprocessDefinition("溯源整改"), deepClone(row)),
      renderRectificationApprovalEditableSections: (row, stage) => renderRectificationApprovalEditableSections(deepClone(row), stage),
      renderRectificationWorkflowRejection: row => renderWorkflowRejection(workflowPolicy("rectification", deepClone(row))),
      renderRectificationFlow: () => renderSubprocessFlow("溯源整改"),
      renderRectificationApprovalEditor: () => approvalEditor(false),
      renderRectificationApprovalFooter: () => renderApprovalStickyFooter(),
      getRectificationFormModel,
      renderRectificationFormField: (field, scope) => renderField(deepClone(field), scope),
      getRectificationRelatedTicketIds: row => [...rectificationRelatedTicketIds(row)],
      getRectificationPickerRows,
      setRectificationRelatedTickets,
      openRectificationForm,
      saveRectificationDraft,
      submitRectification,
      persistWorkflowState,
      systemTimestamp,
      showValidationError: showOverlayValidationError,
      openSubmissionConfirmation: openContactSubmissionConfirmation,
      allowed,
      rerenderPage,
      statusTag,
      renderFilters,
      renderGroupedFilters,
      renderFilterField: field => renderFilterField(deepClone(field)),
      getBusinessLineOptions: () => [...BUSINESS_LINE_OPTIONS],
      renderComplaintExclusionRules: (selected, scope) => renderComplaintExclusionRules(selected, scope),
      bindComplaintExclusionRules,
      getComplaintExclusionFlags: ticketId => complaintExclusionFlags(ticketId),
      renderPagination,
      paginateRows,
      renderHierarchyCascaderControl: (id, field, key, disabled) => renderHierarchyCascaderControl(id, { ...field, tree: hierarchyTreeFor(field.dictionary) }, key, disabled),
      bindOverlayFormControls,
      toast,
      openModal,
      closeOverlay
    };
  }

  function renderTicketCreate() {
    const completedDemoIds = new Set(["TS202610090001", "XF202608040001", "JY202607310104", "BY202607310103"]);
    const createRows = ticketRows.filter(row => {
      if (row[5] === "已废止") return false;
      if (row[5] !== "已办结") return true;
      // Retain user-completed work orders while limiting preloaded examples to one per type.
      return completedDemoIds.has(row[0]) || ticketSeedRecordById.get(row[0])?.status !== "已办结";
    });
    const manageableRows = filterRowsByComplaintPermission(createRows, "ticket-create", "全部");
    const autoDrafts = filterRowsByComplaintPermission(autoDraftRows.filter(row => row[5] === "草稿"), "ticket-create", "自动带入草稿箱");
    const manualDrafts = filterRowsByComplaintPermission(manualDraftRows.filter(row => row[5] === "草稿"), "ticket-create", "录入/导入草稿箱");
    let tabs = availableComplaintTabs("ticket-create", [["全部", manageableRows.length], ["自动带入草稿箱", autoDrafts.length], ["录入导入草稿箱", manualDrafts.length], ["导入记录", importRows.length]]);
    if (!tabs.some(([tab]) => tab === state.createTab)) state.createTab = tabs[0]?.[0] || "全部";
    let table = "";
    let total = manageableRows.length;
    const currentRows = state.createTab === "自动带入草稿箱" ? autoDrafts : state.createTab === "录入导入草稿箱" ? manualDrafts : manageableRows;
    const receivingDepartmentRows = filterTicketRowsByReceivingDepartment(currentRows, "create");
    if (state.createTab === "自动带入草稿箱") { table = renderTicketTable(receivingDepartmentRows, { context: "create", draft: true, scope: "auto-drafts" }); total = receivingDepartmentRows.length; }
    else if (state.createTab === "录入导入草稿箱") { table = renderTicketTable(receivingDepartmentRows, { context: "create", draft: true, scope: "manual-drafts" }); total = receivingDepartmentRows.length; }
    else if (state.createTab === "导入记录") { const rows = filterRowsByComplaintPermission(importRows, "ticket-create", "导入记录", 2); table = renderImportTable(rows); total = rows.length; }
    else { table = renderTicketTable(receivingDepartmentRows, { context: "create", scope: "created-tickets", pageSize: 50 }); total = receivingDepartmentRows.length; }
    return `<section class="page">
      ${pageHeader("工单创建", "统一管理投诉、信访、表扬、建议四类工单的录入与导入", `<button class="btn xib-btn xib-btn--secondary" data-action="open-import">${icon("import")} 导入工单</button><button class="btn xib-btn xib-btn--primary btn-primary" data-page="ticket-form">${icon("plus")} 新建工单</button>`)}
      <div class="panel" style="margin-bottom:12px"><div class="tabs lib-tabs-line">${tabs.map(([t,n])=>`<button class="tab ${state.createTab===t?'is-active':''}" data-create-tab="${t}">${t}<span class="count">${n}</span></button>`).join("")}</div></div>
      ${state.createTab === "导入记录" ? renderFilters([{ label:"导入状态", type:"select", options:["导入成功", "导入中", "导入失败"] }, { label:"导入时间", type:"date" }, { label:"导入文件", type:"input", placeholder:"请输入导入文件关键词" }]) : renderTicketFilters("create", false, currentRows)}
      <div class="panel">${table}${renderPagination(total, state.createTab === "\u5bfc\u5165\u8bb0\u5f55" ? "import-jobs" : state.createTab === "\u81ea\u52a8\u5e26\u5165\u8349\u7a3f\u7bb1" ? "auto-drafts" : state.createTab === "\u5f55\u5165\u5bfc\u5165\u8349\u7bb1" ? "manual-drafts" : "created-tickets", state.createTab === "全部" ? 50 : 20)}</div>
    </section>`;
  }

  function renderTicketProcess() {
    const header = pageHeader("工单处理", "处理主流程与短信审批", '<button class="btn xib-btn xib-btn--secondary" data-action="refresh">' + icon("reset") + ' 刷新</button>');
    const pool = COMPLAINT_WORK_POOL.model(ticketRows, { task: "ticket-process", view: complaintPoolView(state.processScope), tab: state.processTab === "待办" ? "todo" : "all" });
    const availableProcessRows = filterRowsByComplaintPermission(pool.rows, "ticket-process", state.processScope);
    const processRows = filterTicketRowsByReceivingDepartment(availableProcessRows, "process");
    const scopes = [["我的工作台", pool.counts.workbench, "当前处理员经手过且尚未办结的工单"], ["机构工单池", pool.counts.org, "本机构范围内所有未办结工单"], ["下辖工单池", pool.counts.subOrg, "下辖机构全部未办结工单"]];
    const scopeGridHtml = '<div class="scope-grid process-scope-grid">' + scopes.map(([label,count,desc]) => '<button class="scope-card ds-card app-card ' + (state.processScope === label ? "is-active" : "") + '" data-scope="' + label + '"><b>' + count + '</b><strong>' + label + '</strong><span>' + desc + '</span></button>').join("") + '</div>';
    const isMyWorkbench = state.processScope === "我的工作台";
    const tabsHtml = isMyWorkbench ? '<div class="panel process-tabs-panel" style="margin-bottom:0"><div class="tabs lib-tabs-line">' + '<button class="tab ' + (state.processTab === "待办" ? "is-active" : "") + '" data-process-tab="待办">待办<span class="count">' + pool.counts.todo + '</span></button>' + '<button class="tab ' + (state.processTab === "全部" ? "is-active" : "") + '" data-process-tab="全部">全部<span class="count">' + pool.counts.workbench + '</span></button>' + '</div></div>' : "";
    return '<section class="page">' + header + scopeGridHtml + tabsHtml + renderProcessTicketFilters(false, availableProcessRows) + '<div class="panel">' + renderTicketTable(processRows, { context: "process", scope: "process-tickets", includeSmsApproval: true, showBusinessLine: true }) + renderPagination(processRows.length, "process-tickets") + '</div></section>';
  }
  function filterSelect(label, options, disabled = false, value = "", breakBefore = false) {
    if (!disabled && /\u5de5\u5355\u72b6\u6001|\u5b50\u6d41\u7a0b.*\u72b6\u6001|\u53d7\u7406\u6e20\u9053/.test(label)) return renderFilterMultiSelect(label, options || [], breakBefore);
    return `<div class="ticket-filter-item ${breakBefore ? 'is-filter-row-break' : ''}"><label>${label}</label><select class="di-native-select is-fluid" ${disabled ? 'disabled' : ''}><option value="">${value || '全部'}</option>${options.map(option => `<option>${option}</option>`).join("")}</select></div>`;
  }


  function filterOptions(label) {
    if (/导入状态/.test(label)) return ["导入成功", "导入中", "导入失败"];
    if (/工单类型/.test(label)) return ["投诉单","信访单","表扬单","建议单"];
    if (/子流程类型/.test(label)) return SUBPROCESS_TYPES;
    if (/导出类型/.test(label)) return [...EXPORT_REQUEST_TYPES];
    if (/申请类型/.test(label)) return ["延长办结","废止工单","撤销投诉","纠纷化解","问责处罚","异议核查","短信发送","台账导出"];
    if (/审批类型/.test(label)) return ["工单审批","子流程审批","短信审批","导出申请审批"];
    if (/短信审批状态|短信状态/.test(label)) return ["待审批","已通过","已驳回"];
    if (/整改状态/.test(label)) return DOCUMENT_STATE_MACHINES.rectification.statuses;
    if (/子流程.*状态/.test(label)) return DOCUMENT_STATE_MACHINES.subprocess.statuses;
    if (/工单状态|工单状态/.test(label)) return DOCUMENT_STATE_MACHINES.ticket.statuses;
    if (/导出申请状态|申请状态/.test(label)) return [...EXPORT_REQUEST_STATUSES];
    if (/状态/.test(label)) return DOCUMENT_STATE_MACHINES.ticket.statuses;
    if (/渠道/.test(label)) return ALL_ACCEPTANCE_CHANNEL_OPTIONS;
    if (/客户类型/.test(label)) return ["自然人","非自然人"];
    if (/业务类别/.test(label)) return ["个人金融", "银行卡", "零售贷款", "电子银行", "支付结算"];
    if (/投诉原因/.test(label)) return ["服务态度", "业务差错", "收费争议", "信息披露", "系统故障"];
    if (/机构|部门/.test(label)) return ["总行","厦门分行","福州分行","泉州分行","北京朝阳支行"];
    if (/节点/.test(label)) return ["初审","复审","终审","流程结束"];
    if (/层级|记录类型|单据类型/.test(label)) return ["工单","再次投诉单","子流程单"];
    return ["全部"];
  }

  function normalizeFilter(item) {
    if (typeof item === "object") return item;
    if (/时间|期限|日期/.test(item)) return { label: item, type: "range" };
    if (/编号|姓名|申请人|客户|对象|文件|关键词/.test(item)) return { label: item, type: "input" };
    return { label: item, type: "select", options: filterOptions(item) };
  }

  function renderOrgFilterItem(label, key, placeholder = "请选择机构/部门") {
    const isCombined = /机构\s*\/\s*部门|部门\s*\/\s*机构/.test(label);
    const isDepartment = !isCombined && /部门/.test(label) && !/机构/.test(label);
    const dictionary = isCombined ? "businessUnitTree" : (isDepartment ? "departmentTree" : "institutionTree");
    const institutionPlaceholder = label === "工单接收机构" ? "请选择工单接收机构" : "请选择机构范围";
    const field = { type: "hierarchyCascader", dictionary, tree: hierarchyTreeFor(dictionary), levels: ["总行/分行", isCombined ? "机构/部门/支行" : (isDepartment ? "部门" : "机构/下辖支行")], leafLevel: 2, multiple: dictionary === "institutionTree", nonLeafSelectable: false, includeDescendantsOption: dictionary === "institutionTree", searchable: dictionary === "institutionTree", placeholder: dictionary === "institutionTree" ? institutionPlaceholder : placeholder };
    return '<div class="ticket-filter-item"><label>' + label + '</label><div class="form-control">' + renderHierarchyCascaderControl("filter-" + key, field, key) + '</div></div>';
  }

  function hierarchyTreeDepth(tree) {
    return (tree || []).reduce((depth, node) => Math.max(depth, 1 + hierarchyTreeDepth(node.children || [])), 0);
  }

  function firstHierarchyLeafPath(tree) {
    const path = [];
    let nodes = tree || [];
    while (nodes.length) {
      const node = nodes[0];
      path.push(node.label);
      nodes = node.children || [];
    }
    return path;
  }

  function hierarchyDemoValue(dictionary, preferred = "", treeOverride = null) {
    const tree = treeOverride?.length ? treeOverride : hierarchyTreeFor(dictionary);
    const preferredPath = String(preferred || "").split(" / ").filter(Boolean);
    const preferredNode = preferredPath.length ? hierarchyNode(tree, preferredPath) : null;
    const path = preferredNode && !preferredNode.children?.length ? preferredPath : firstHierarchyLeafPath(tree);
    return path.join(" / ");
  }

  function cascaderDemoValue(sourceKey, preferred = "") {
    const tree = peopleBankCascaderSource(sourceKey);
    const preferredPath = String(preferred || "").split(" / ").filter(Boolean);
    const preferredNode = preferredPath.length ? cascadeNode(sourceKey, preferredPath) : null;
    const path = preferredNode && !preferredNode.children?.length ? preferredPath : firstHierarchyLeafPath(tree);
    return path.join(" / ");
  }

  function renderTagFilterItem(field) {
    const source = rectificationHierarchyField(field.dictionary) || {};
    const tree = hierarchyTreeFor(field.dictionary);
    const configuredLevels = PROTOTYPE_CONFIG.tagTrees?.[field.dictionary]?.levels || source.levels || [];
    const leafLevel = Math.max(1, hierarchyTreeDepth(tree), configuredLevels.length);
    const levels = Array.from({ length: leafLevel }, (_, index) => configuredLevels[index] || ("第" + (index + 1) + "级标签"));
    const definition = { ...source, dictionary:field.dictionary, tree, levels, leafLevel, multiple:false, nonLeafSelectable:true, placeholder:"请选择标签" };
    const key = field.key || ("filter.tags." + field.dictionary);
    const safeId = key.replace(/[^A-Za-z0-9_-]/g, "-");
    return '<div class="ticket-filter-item tag-hierarchy-filter ' + (field.breakBefore ? 'is-filter-row-break' : '') + '"><label>' + field.label + '</label><div class="form-control">' + renderHierarchyCascaderControl("filter-" + safeId, definition, key, Boolean(field.disabled)) + '</div></div>';
  }

  function renderFilterField(item) {
    const field = normalizeFilter(item);
    if (field.html) return field.html;
    if (field.type === "orgTree") return renderOrgFilterItem(field.label, field.key || ("filter." + field.label), field.placeholder);
    if (field.type === "tagHierarchy") return renderTagFilterItem(field);
    if (field.type === "multiSelect") return renderFilterMultiSelect(field.label, field.options || [], field.breakBefore, field.key || "");
    if (field.type === "range") {
      const safe = field.label.replace(/[^\w\u4e00-\u9fa5]/g, "-");
      const minDate = field.minDate || (state.page === "ledger-query" ? "2015-01-01" : "");
      const maxDate = field.maxDate || (state.page === "ledger-query" ? systemTimestamp().slice(0, 10) : "");
      const start = renderPickerControl(`filter-${safe}-start`, { type: "date", placeholder: "开始日期", minDate, maxDate }, `筛选-${field.label}-开始`);
      const end = renderPickerControl(`filter-${safe}-end`, { type: "date", placeholder: "结束日期", minDate, maxDate }, `筛选-${field.label}-结束`);
      return `<div class="ticket-filter-item is-range filter-datepicker-range ${field.breakBefore ? 'is-filter-row-break' : ''}"><label>${field.label}</label><div class="filter-datepicker-controls">${start}<i>至</i>${end}</div></div>`;
    }
    if (field.type === "date") {
      const safe = field.label.replace(/[^\w\u4e00-\u9fa5]/g, "-");
      const picker = renderPickerControl(`filter-${safe}`, { type: "date", placeholder: "请选择日期", minDate:state.page === "ledger-query" ? "2015-01-01" : "", maxDate:state.page === "ledger-query" ? systemTimestamp().slice(0, 10) : "" }, `筛选-${field.label}`);
      return `<div class="ticket-filter-item filter-datepicker-single ${field.breakBefore ? 'is-filter-row-break' : ''}"><label>${field.label}</label><div class="form-control">${picker}</div></div>`;
    }
    if (field.type === "select") return filterSelect(field.label, field.options || filterOptions(field.label), field.disabled, field.value, field.breakBefore);
    return `<div class="ticket-filter-item ${field.breakBefore ? 'is-filter-row-break' : ''}"><label>${field.label}</label><input class="di-input is-fluid" placeholder="${field.placeholder || '请输入'}" ${field.disabled?'disabled':''} value="${field.value || ''}"></div>`;
  }

  function renderTicketFilters(mode = "create", reviewerOnly = false, availableRows = []) {
    const channel = { label: "受理渠道", type: reviewerOnly ? "input" : "select", options: filterOptions("受理渠道"), value: reviewerOnly ? "客服中心" : "", disabled: reviewerOnly };
    const rows = [
      ["工单类型", "工单状态", { label: "处置期限", type: "range" }],
      [channel, "工单编号"],
      [{ label:"客户类型", type:"select", options:["自然人", "非自然人"] }, "客户姓名", { label:"联系方式", type:"input", placeholder:"请输入联系方式" }],
      [{ label: "工单接收机构", type: "orgTree", key: "filter.ticket.org" }, renderReceivingDepartmentFilter(availableRows, "create"), businessLineFilterField("filter.ticket.business-lines")]
    ];
    return renderGroupedFilters(rows, "ticket-create-filter-panel");
  }

  function consumerProtectionDepartment(profile = currentRoleProfile()) {
    return /消费者权益保护|消保/.test(String(profile.departmentLabel || ""));
  }

  function receivingDepartmentFilterConfig(rows = [], key = "process") {
    // The department filter is sourced from the complete list currently shown.
    // It is intentionally independent from the institution filter so that the
    // consumer-protection view can default to “全部” across all receiving departments.
    const options = [...new Set(rows.map(ticketReceivingDepartment).filter(value => value && value !== "-"))];
    const profile = currentRoleProfile();
    // Only dedicated business-department views are restricted to their own department.
    // Customer-service reviewers retain their existing cross-department review scope.
    const locked = !consumerProtectionDepartment(profile) && ["branch-department", "head-department"].includes(profile.org) && Boolean(profile.departmentLabel);
    const selected = locked ? profile.departmentLabel : (state.receivingDepartmentFilters[key] || "");
    if (locked && !options.includes(selected)) options.push(selected);
    if (!locked && selected && !options.includes(selected)) state.receivingDepartmentFilters[key] = "";
    return { options, selected:locked ? selected : (state.receivingDepartmentFilters[key] || ""), locked };
  }

  function receivingInstitutionFilterSelections() {
    const value = state.formValues["filter.ticket.org"];
    return Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []);
  }

  function receivingInstitutionMatchesSelection(selection, target) {
    const normalizedTarget = institutionDisplayName(target);
    const parts = String(selection || "").split(" / ").filter(Boolean);
    if (!parts.length) return false;
    if (String(selection) === hierarchyDescendantGroupValue(parts[0])) {
      const group = institutionHierarchyTree().find(node => node.label === parts[0]);
      return Boolean(group && flattenBusinessTree([group]).some(node => node.label === normalizedTarget));
    }
    return normalizedTarget === (parts.at(-1) || "");
  }

  function renderReceivingDepartmentFilter(rows, key) {
    const config = receivingDepartmentFilterConfig(rows, key);
    const disabled = config.locked || !config.options.length;
    const placeholder = config.options.length ? "全部" : "当前列表暂无接收部门";
    return { html: '<div class="ticket-filter-item"><label>工单接收部门</label><select class="di-native-select is-fluid" data-receiving-department-filter="' + escapeAttribute(key) + '"' + (disabled ? ' disabled' : '') + '><option value="">' + escapeAttribute(placeholder) + '</option>' + config.options.map(option => '<option value="' + escapeAttribute(option) + '"' + (option === config.selected ? ' selected' : '') + '>' + escapeAttribute(option) + '</option>').join("") + '</select></div>' };
  }

  function filterTicketRowsByReceivingDepartment(rows, key) {
    const selected = receivingDepartmentFilterConfig(rows, key).selected;
    return selected ? rows.filter(row => ticketReceivingDepartment(row) === selected) : rows;
  }

  function renderProcessTicketFilters(reviewerOnly = false, rows = []) {
    const typeControl = { html: '<div class="ticket-filter-item"><label>工单类型</label><select class="di-native-select is-fluid" data-process-ticket-type><option value="">全部</option>' +
      filterOptions("工单类型").map(type => '<option value="' + type + '" ' + (state.processTicketType === type ? "selected" : "") + '>' + type + '</option>').join("") +
      '</select></div>' };
    const channel = reviewerOnly
      ? { label: "受理渠道", type: "input", value: "客服中心", disabled: true }
      : { label: "受理渠道", type: "select", options: filterOptions("受理渠道") };
    const showComplaintFields = ["投诉单"].includes(state.processTicketType);
    const complaintFields = [
      { label: "业务办理渠道", type: "tagHierarchy", dictionary: "trsBusinessChannel", key: "filter.process.tags.channel" },
      { label: "业务类别", type: "tagHierarchy", dictionary: "rectificationProduct", key: "filter.process.tags.business" },
      { label: "投诉原因", type: "tagHierarchy", dictionary: "rectificationCause", key: "filter.process.tags.reason" }
    ];
    return '<div class="filter-panel ticket-filter-panel export-filter-panel process-ticket-filter-panel"><div class="export-filter-layout">' +
      renderExportFilterRow([typeControl, "工单状态", { label: "处置期限", type: "range" }], "is-primary-row") +
      renderExportFilterRow([channel, { label: "工单编号", type: "input" }, "短信审批状态"], "is-base-row") +
      renderExportFilterRow([{ label:"客户类型", type:"select", options:["自然人", "非自然人"] }, "客户姓名", { label:"联系方式", type:"input", placeholder:"请输入联系方式" }], "is-customer-row") +
      renderExportFilterRow([{ label: "工单接收机构", type: "orgTree", key: "filter.ticket.org" }, renderReceivingDepartmentFilter(rows, "process"), businessLineFilterField("filter.process.business-lines")], "is-ownership-row") +
      renderExportFilterRow(complaintFields, "is-conditional-row", !showComplaintFields) +
      '<div class="filter-actions export-filter-actions"><button class="btn-link filter-reset" data-action="reset-filter">' + icon("reset") + ' 重置</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="search">' + icon("search") + ' 搜索</button></div></div></div>';
  }
  function renderFilters(items) {
    return `<div class="filter-panel ticket-filter-panel"><div class="ticket-filter-grid">${items.map(renderFilterField).join("")}<div class="filter-actions ticket-filter-actions"><button class="btn-link filter-reset" data-action="reset-filter">${icon("reset")} 重置</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="search">${icon("search")} 搜索</button></div></div></div>`;
  }

  function renderGroupedFilters(rows, className = "") {
    return '<div class="filter-panel ticket-filter-panel export-filter-panel grouped-filter-panel ' + className + '"><div class="export-filter-layout">' + rows.map((fields, index) => renderExportFilterRow(fields, "grouped-filter-row grouped-filter-row-" + (index + 1))).join("") + '<div class="filter-actions export-filter-actions"><button class="btn-link filter-reset" data-action="reset-filter">' + icon("reset") + ' 重置</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="search">' + icon("search") + ' 搜索</button></div></div></div>';
  }

  const OPERATION_ORDER = ['edit','review','process','supplement','initial','approve','claim','transfer','remind','withdraw','void','delete','download','export','view','detail'];

  function sortRowsForTable(rows, scope) {
    const sort = state.sorts[scope];
    const result = rows.map(row => [...row]);
    if (!sort) return result;
    const direction = sort.direction === 'asc' ? 1 : -1;
    if (isDocumentStatusSort(scope, sort.index)) {
      return result.sort((a, b) => {
        const rankMap = ['rectification-orders', 'query-rectifications'].includes(scope) ? RECTIFICATION_STATUS_RANK : DOCUMENT_STATUS_RANK;
        const fallbackRank = ['rectification-orders', 'query-rectifications'].includes(scope) ? RECTIFICATION_STATUS_ORDER.length : DOCUMENT_STATUS_ORDER.length;
        const rankA = rankMap.get(String(a[sort.index] ?? '')) ?? fallbackRank;
        const rankB = rankMap.get(String(b[sort.index] ?? '')) ?? fallbackRank;
        return (rankA - rankB) * direction;
      });
    }
    return result.sort((a, b) => String(a[sort.index] ?? '').localeCompare(String(b[sort.index] ?? ''), 'zh-CN', { numeric: true }) * direction);
  }

  function sortByTaskArrival(rows, dateIndex = 6, newestFirst = false) {
    const direction = newestFirst ? -1 : 1;
    return rows.map(row => [...row]).sort((left, right) => String(left?.[dateIndex] || "").localeCompare(String(right?.[dateIndex] || ""), "zh-CN", { numeric:true }) * direction);
  }

  function tableEmptyStateRow(colspan) {
    return '<tr class="table-empty-row" data-empty-state><td colspan="' + Math.max(1, colspan) + '"><div class="ds-empty app-empty-state"><h4>暂无数据</h4></div></td></tr>';
  }

  function applyTableEmptyStates(scope = document) {
    const emptyValues = new Set(["", "undefined", "null", "待补全", "不适用", "未配置", "待确定", "缺失", "未设置（手工录入）", "—"]);
    scope.querySelectorAll("table tbody td").forEach(cell => {
      if (cell.hasAttribute("colspan") || cell.matches(".operation-column, .column-customizer-spacer") || cell.querySelector("button, input, select, textarea, a, img, svg, .ds-tag, .tag")) return;
      if (emptyValues.has(cell.textContent.trim())) cell.textContent = "-";
    });
    scope.querySelectorAll("table tbody").forEach(tbody => {
      const rows = [...tbody.rows];
      const dataRows = rows.filter(row => !row.matches("[data-empty-state], .filter-empty-row") && !row.querySelector(".empty, .ds-empty, .filter-empty-result"));
      if (!dataRows.length) tbody.innerHTML = tableEmptyStateRow(tbody.closest("table")?.tHead?.rows[0]?.cells.length || 1);
    });
  }
  function sortableHead(label, scope, index) {
    return '<th>' + label + '</th>';
  }

  function actionDef(key, label, action, batch = '', danger = false, disabled = false, disabledReason = '') {
    return { key, label, action, batch, danger, disabled, disabledReason };
  }

  function actionButton(def, id) {
    const title = def.disabledReason ? ' title="' + escapeAttribute(def.disabledReason) + '"' : '';
    const batch = def.batch ? ' data-batch-label="' + escapeAttribute(def.batch) + '"' : '';
    if (def.disabled) return '<span class="operation-unavailable" data-operation-key="' + def.key + '" data-unavailable-action="' + def.action + '" aria-label="' + escapeAttribute(def.label + '不可用') + '"' + title + '>-</span>';
    return '<button class="btn-link' + (def.danger ? ' is-danger' : '') + '" data-operation-key="' + def.key + '"' + batch + ' data-action="' + def.action + '" data-id="' + id + '"' + title + '>' + def.label + '</button>';
  }

  function operationColumnKey(key) {
    if (key === "supplement") return "process";
    return ["void", "delete"].includes(key) ? "remove" : key;
  }

  function operationColumnLabel(def) {
    return operationColumnKey(def.key) === "remove" ? "\u5e9f\u6b62/\u5220\u9664" : def.label;
  }

  const OPERATION_COLUMN_ORDER = [...new Set(OPERATION_ORDER.map(operationColumnKey))];

  function collectOperationDefs(rows, resolver, options = {}) {
    const map = new Map();
    rows.forEach(row => resolver(row).forEach(def => {
      const columnKey = operationColumnKey(def.key);
      if (!map.has(columnKey)) map.set(columnKey, { ...def, columnKey, label:operationColumnLabel(def) });
    }));
    const order = options.viewBeforeDownload
      ? [...OPERATION_COLUMN_ORDER.filter(key => !['view','detail','download'].includes(key)), 'view', 'detail', 'download']
      : OPERATION_COLUMN_ORDER;
    return order.filter(key => map.has(key)).map(key => map.get(key));
  }

  const BATCH_OPERATION_KEYS = new Set(["remind", "transfer", "export"]);

  function collectBatchOperationDefs(rows, resolver) {
    const definitions = new Map();
    rows.forEach(row => resolver(row).forEach(def => {
      if (!def.batch || def.disabled || !BATCH_OPERATION_KEYS.has(def.key)) return;
      const identity = def.key + "::" + def.batch;
      if (!definitions.has(identity)) definitions.set(identity, { ...def });
    }));
    const order = new Map(OPERATION_ORDER.map((key, index) => [key, index]));
    return [...definitions.values()].sort((left, right) => {
      const rank = (order.get(left.key) ?? OPERATION_ORDER.length) - (order.get(right.key) ?? OPERATION_ORDER.length);
      return rank || left.batch.localeCompare(right.batch, "zh-CN");
    });
  }

  function renderOperationHeaders(defs) {
    return defs.map((def, index) => '<th class="operation-column" title="' + def.label + '">' + (index === 0 ? '操作' : '') + '</th>').join('');
  }

  function renderOperationCells(defs, actions, id) {
    const map = new Map(actions.map(def => [operationColumnKey(def.key), def]));
    return defs.map(def => '<td class="operation-column">' + (map.has(def.columnKey || def.key) ? actionButton(map.get(def.columnKey || def.key), id) : '-') + '</td>').join('');
  }



  function normalizedPermissionTab(tab = "") {
    return String(tab || "").replace("录入导入草稿箱", "录入/导入草稿箱").replace("子流程单导出", "子流程导出");
  }

  function permissionRoleIds() {
    if (state.role === "developer") return ["developer", "operator", "reviewer", "handler", "approver", "analyst", "admin"];
    return [state.role];
  }

  function complaintPermissionEntries(page, tab = "", options = {}) {
    const normalizedTab = normalizedPermissionTab(tab);
    const roles = permissionRoleIds();
    return COMPLAINT_PERMISSION_RULES.filter(rule => {
      if (rule.page !== page) return false;
      if (normalizedTab && normalizedPermissionTab(rule.tab) !== normalizedTab) return false;
      if (options.ignoreRole || state.role === "developer") return true;
      return (rule.roles || []).some(role => roles.includes(role));
    });
  }

  function complaintPermissionStatusAllowed(page, tab, status) {
    if (state.role === "developer") return true;
    const configuredEntries = complaintPermissionEntries(page, tab, { ignoreRole: true });
    const entries = complaintPermissionEntries(page, tab);
    if (!configuredEntries.length) return true;
    if (!entries.length) return false;
    if (entries.some(rule => (rule.statuses || []).includes(status))) return true;
    if (normalizedPermissionTab(tab) === "全部") {
      return complaintPermissionEntries(page).some(rule => (rule.statuses || []).includes(status));
    }
    return false;
  }

  function filterRowsByComplaintPermission(rows, page, tab, statusIndex = 5) {
    return rows.filter(row => complaintPermissionStatusAllowed(page, tab, row[statusIndex]));
  }

  function normalizedPermissionAction(label = "") {
    const map = { "详情": "查看", "领取": "处理", "撤回提交": "撤回", "撤回转派": "撤回", "撤回申请": "撤回", "重提": "重新申请" };
    return map[label] || label;
  }

  function filterActionsByComplaintPermission(actions, page, tab, status) {
    if (state.role === "developer") return actions;
    const configuredEntries = complaintPermissionEntries(page, tab, { ignoreRole: true });
    let entries = complaintPermissionEntries(page, tab).filter(rule => (rule.statuses || []).includes(status));
    if (configuredEntries.length && !entries.length && normalizedPermissionTab(tab) === "全部") entries = complaintPermissionEntries(page).filter(rule => (rule.statuses || []).includes(status));
    if (configuredEntries.length && !entries.length) return [];
    if (!entries.length) return actions;
    const allowedActions = new Set(entries.flatMap(rule => rule.actions || []));
    const filtered = actions.filter(action => allowedActions.has(normalizedPermissionAction(action.label)));
    const detail = actions.find(action => normalizedPermissionAction(action.label) === "查看");
    if (!["草稿", "待提交"].includes(status) && detail && !filtered.some(action => normalizedPermissionAction(action.label) === "查看")) filtered.push(detail);
    return filtered.length ? filtered : actions.filter(action => normalizedPermissionAction(action.label) === "查看");
  }

  // 查询导出的「工单导出」「子流程单导出」各保留一条无导出权限的演示记录：
  // 记录本身与查看入口照常展示，仅把导出操作渲染为置灰，用于演示权限差异，
  // 不影响其他列表行的既有权限过滤结果。
  function queryExportActionsWithDemoPermission(actions, page, tab, status, row, demoId) {
    const filtered = filterActionsByComplaintPermission(actions, page, tab, status);
    if (!demoId || !row || row[0] !== demoId) return filtered;
    const disabledExport = actionDef("export", "导出", "export-row", "批量导出", false, true, "当前演示记录无导出权限");
    return [...filtered.filter(action => action.key !== "export"), disabledExport];
  }

  function queryExportPermissionDemoRow(rows, kind) {
    const base = rows[0];
    if (!base) return null;
    const demo = [...base];
    const isTicket = kind === "ticket";
    demo[0] = isTicket ? "TS202610130099" : "ZF202610130099";
    // 工单行与子流程行第 2/3 列语义不同：工单为 客户姓名，子流程为 子流程类型，
    // 子流程的客户姓名在第 3 列（0 基）。
    demo[isTicket ? 2 : 3] = "权限演示客户";
    demo[5] = "已办结";
    return demo;
  }

  function complaintTabAllowed(page, tab) {
    if (state.role === "developer") return true;
    if (!complaintPermissionConfigured(page, tab)) return true;
    return complaintPermissionEntries(page, tab).length > 0;
  }

  function availableComplaintTabs(page, tabs) {
    if (page === "my-approvals") return complaintPageAllowed(page) === false ? [] : tabs;
    return tabs.filter(tab => complaintTabAllowed(page, Array.isArray(tab) ? tab[0] : tab));
  }

  function renderBulkToolbar(scope, operationDefs, batchDefs = []) {
    if (!batchDefs.length) return "";
    const columns = operationDefs || [];
    const actionsByColumn = new Map(columns.map(def => [def.columnKey || operationColumnKey(def.key), []]));
    batchDefs.forEach(def => {
      const columnKey = operationColumnKey(def.key);
      if (actionsByColumn.has(columnKey)) actionsByColumn.get(columnKey).push(def);
    });
    const slots = columns.map(def => {
      const actions = actionsByColumn.get(def.columnKey || operationColumnKey(def.key)) || [];
      return '<div class="table-bulk-slot' + (actions.length > 1 ? ' is-multiple' : '') + '">' + actions.map(action => '<button class="btn-link' + (action.danger ? ' is-danger' : '') + '" data-bulk-action="' + escapeAttribute(action.batch) + '" data-bulk-operation="' + escapeAttribute(action.key) + '" disabled>' + escapeAttribute(action.batch) + '</button>').join('') + '</div>';
    }).join('');
    return '<div class="table-bulk-toolbar" data-bulk-toolbar="' + escapeAttribute(scope) + '" style="--bulk-operation-count:' + columns.length + '"><div class="table-bulk-summary"><span>已选 <b data-bulk-count="' + escapeAttribute(scope) + '">0</b> 项</span></div>' + slots + '<div class="table-bulk-utility-spacer" aria-hidden="true"></div></div>';
  }

  function selectionCell(scope, id) {
    return '<td class="selection-cell"><input type="checkbox" data-row-select="' + scope + '" value="' + id + '" aria-label="选择 ' + id + '"></td>';
  }

  function selectionHead(scope) {
    return '<th class="selection-cell"><input type="checkbox" data-select-all="' + scope + '" aria-label="全选当前结果"></th>';
  }

  function expectedSubmissionTargetStatus(kind, row) {
    if (!row) return "";
    if (kind === "ticket") {
      const entry = documentRecordFor("ticket", row)?.fields?.entry || {};
      const customerServiceTypes = new Set(["投诉单", "表扬单", "建议单"]);
      const customerServiceSource = ["客服电话", "在线客服"].includes(ticketAcceptanceChannel(row)) || /客服/.test(String(entry["创建人所属机构"] || ""));
      return customerServiceSource && customerServiceTypes.has(row[1]) ? "待复核" : "待处理";
    }
    if (kind === "subprocess") {
      const relatedTicket = ticketRowById(row[2]);
      const customerServiceSource = relatedTicket && ["客服电话", "在线客服"].includes(ticketAcceptanceChannel(relatedTicket));
      if (customerServiceSource && subprocessSupportsStatus(row[1], "待复核")) return "待复核";
      return subprocessSupportsStatus(row[1], "待处理") ? "待处理" : "";
    }
    return "";
  }

  function submissionTargetStatus(kind, row) {
    const expected = expectedSubmissionTargetStatus(kind, row);
    if (!expected) return "";
    const history = (workflowHistory[kind]?.[row?.[0]] || []).map(normalizeWorkflowRecord);
    const submission = [...history].reverse().find(record => ["草稿", "待提交"].includes(record.from) && ["待复核", "待处理"].includes(record.to));
    if (submission) return submission.to === expected ? expected : "";
    const hasProgressed = history.some(record => record.from === expected && record.to !== record.from);
    return !hasProgressed && row?.[5] === expected ? expected : "";
  }

  function canWithdrawSubmission(kind, row) {
    return Boolean(row && row[5] === submissionTargetStatus(kind, row));
  }

  function repeatComplaintMetadata(row) {
    const record = documentRecordFor("ticket", row);
    const entry = record?.fields?.entry || {};
    const corrected = record?.fields?.correctionOverrides || {};
    const product = corrected["投诉产品标签"] ?? entry["投诉产品标签"];
    const productKey = (Array.isArray(product) ? product : String(product || "").split("/")).map(value => String(value).trim()).filter(Boolean).join("/");
    const institutionValue = corrected["投诉/信访/表扬机构"] ?? entry["投诉/信访/表扬机构"] ?? entry["涉及机构"] ?? row?.[4] ?? "";
    const institutionName = String(Array.isArray(institutionValue) ? institutionValue.at(-1) : institutionValue).split("/").map(value => value.trim()).filter(Boolean).at(-1) || "";
    return {
      id:row?.[0] || "",
      row,
      name:String(entry["客户姓名"] || row?.[2] || "").trim(),
      identity:String(entry["证件号码"] || entry["联系人证件号码"] || "").trim(),
      date:String(entry["客户投诉时间"] || entry["客户事件时间"] || row?.[6] || "").slice(0, 10),
      productKey,
      institutionName
    };
  }

  function institutionsAreEquivalent(leftName, rightName) {
    if (!leftName || !rightName) return false;
    if (leftName === rightName) return true;
    const records = activeOrganizationRecords();
    const left = records.find(record => record.name === leftName);
    const right = records.find(record => record.name === rightName);
    return Boolean(left && right && (left.parentId === right.id || right.parentId === left.id));
  }

  function repeatComplaintRelationMap() {
    const unique = new Map();
    [...ticketRows, ...queryTicketRows.map(row => row.slice(0, 7))].forEach(row => {
      if (row?.[0] && row[1] === "投诉单" && row[5] === "已办结") unique.set(row[0], row);
    });
    const groups = new Map();
    [...unique.values()].map(repeatComplaintMetadata).filter(item => item.name && item.identity && item.date && item.productKey && item.institutionName).forEach(item => {
      const key = [item.name, item.identity, item.productKey].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    const relations = new Map();
    groups.forEach(items => {
      const pending = items.slice().sort((left, right) => left.date.localeCompare(right.date, "zh-CN") || left.id.localeCompare(right.id, "zh-CN"));
      while (pending.length) {
        const main = pending.shift();
        const deadline = new Date(main.date + "T00:00:00");
        deadline.setFullYear(deadline.getFullYear() + 1);
        const repeats = [];
        for (let index = pending.length - 1; index >= 0; index -= 1) {
          const candidate = pending[index];
          const candidateDate = new Date(candidate.date + "T00:00:00");
          if (candidateDate <= deadline && institutionsAreEquivalent(main.institutionName, candidate.institutionName)) repeats.unshift(pending.splice(index, 1)[0]);
        }
        if (!repeats.length) continue;
        const ticketIds = [main.id, ...repeats.map(item => item.id)];
        relations.set(main.id, { mainTicket:main.id, role:"main", linked:true, status:"已识别", ticketIds });
        repeats.forEach(item => relations.set(item.id, { mainTicket:main.id, role:"repeat", linked:true, status:"已识别", ticketIds }));
      }
    });
    return relations;
  }

  function automaticRepeatRelationForTicket(ticketId) {
    return repeatComplaintRelationMap().get(ticketId) || null;
  }

  function ticketListKind(row) {
    const automatic = automaticRepeatRelationForTicket(row?.[0]);
    if (automatic?.role === "repeat") return "重复投诉单";
    if (state.repeatRelations[row?.[0]]?.mainTicket || row?.[7] === "再次投诉单") return "再次投诉单";
    return "";
  }

  function renderTicketTypeWithKind(row, options = {}) {
    const flags = options.exportComplaint && row?.[1] === "投诉单" ? complaintExclusionFlags(row[0]) : [];
    const kind = flags.includes("重复投诉") && flags.includes("异常投诉") ? "重复/异常投诉单" : flags.includes("异常投诉") ? "异常投诉单" : flags.includes("废止投诉") ? "废止投诉单" : ticketListKind(row, options);
    const tag = kind ? '<span class="tag ds-tag is-light ticket-kind-tag ' + (["再次投诉单", "重复投诉单", "重复/异常投诉单", "异常投诉单", "废止投诉单"].includes(kind) ? "is-yellow" : "is-purple") + '" data-ticket-list-kind="' + kind + '">' + kind + '</span>' : "";
    return '<span class="ticket-type-with-kind"><span>' + escapeAttribute(row?.[1] || "-") + '</span>' + tag + '</span>';
  }

  function ticketBusinessLine(row) {
    return businessLineValueLabel(documentRecordFor("ticket", row)?.fields?.entry?.["所属业务条线"]) || "—";
  }

  function ticketReceivingInstitution(row) {
    if (!row || row[5] === "草稿") return "-";
    return documentRecordFor("ticket", row)?.fields?.entry?.["工单接收机构"] || row[4] || "-";
  }

  function normalizedAssigneeName(value) {
    return String(value || "").replace(/（[^）]+）\s*$/, "").trim();
  }

  function currentUserActor() {
    return normalizedAssigneeName(state.currentUserActor || CURRENT_USER_ACTOR);
  }

  function ticketReceivingDepartment(row) {
    const institution = ticketReceivingInstitution(row);
    if (institutionSelectionDetails(institution).isSubbranch) return "-";
    const record = documentRecordFor("ticket", row);
    const processing = record?.fields?.processing || {};
    const entry = record?.fields?.entry || {};
    const candidates = [entry["派发部门"], processing["工单接收部门"], processing["工单接收部门2"], processing["工单接收部门1"]]
      .map(value => listColumnValueText(value))
      .filter(value => value && value !== "-");
    // Some legacy demo records stored the institution in the department slot.
    // Never expose that institution value as a department option/display value.
    const institutionNames = new Set([
      institutionDisplayName(institution),
      ...institutionHierarchyTree().map(node => node.label),
      ...activeOrganizationRecords().map(record => record.name)
    ]);
    return candidates.find(value => !institutionNames.has(value)) || "-";
  }

  function ticketLastHandler(row) {
    const record = documentRecordFor("ticket", row);
    const processing = record?.fields?.processing || {};
    const stored = processing["处理员"] || processing["处理员2"] || processing["处理员1"];
    if (stored) return listColumnValueText(stored);
    const lastHandled = (workflowHistory.ticket[row?.[0]] || []).map(normalizeWorkflowRecord).find(item => item.operatorRoleName === "处理员" && item.operatorName !== "-");
    if (lastHandled?.operatorName) return listColumnValueText(lastHandled.operatorName);
    const assignment = COMPLAINT_WORK_POOL.assignment("ticket", row?.[0]);
    return listColumnValueText(assignment.assignee || assignment.participants.at(-1));
  }

  function contactOperatorForTicket(row) {
    const handler = normalizedAssigneeName(ticketLastHandler(row));
    return handler && handler !== "-" ? handler : "林海-38102";
  }

  function updateTicketProcessingOwnership(row, values = {}) {
    const record = documentRecordFor("ticket", row);
    if (!record) return;
    if (!record.fields) record.fields = {};
    if (!record.fields.processing) record.fields.processing = {};
    if (values.handler) record.fields.processing["处理员"] = normalizedAssigneeName(values.handler);
    if (values.department !== undefined) record.fields.processing["工单接收部门"] = institutionSelectionDetails(ticketReceivingInstitution(row)).isSubbranch ? "-" : listColumnValueText(values.department);
    record.updatedAt = systemTimestamp();
  }

  function setTicketReceivingInstitution(row, value) {
    if (!row) return "-";
    const institution = institutionDisplayName(value);
    row[4] = institution === "-" ? "" : institution;
    const record = documentRecordFor("ticket", row);
    if (record?.fields?.entry) record.fields.entry["工单接收机构"] = row[4];
    const queryRow = typeof queryTicketRows === "undefined" ? null : queryTicketRows.find(item => item[0] === row[0]);
    if (queryRow) queryRow[4] = row[4];
    return row[4] || "-";
  }

  function subprocessCreatorInstitution(row) {
    if (!row) return "-";
    return documentRecordFor("subprocess", row)?.fields?.base?.["所属机构"] || row[4] || "-";
  }
  function ticketActions(row, context, options = {}) {
    const status = row[5];
    const role = state.role;
    const canDevelop = role === 'developer';
    const detail = actionDef('detail', '查看', 'detail');
    if (options.readOnly || role === 'reviewer') {
      const canReview = ["待复核", "复核中"].includes(status) && (role === 'reviewer' || canDevelop);
      return canReview ? [actionDef('review', '复核', 'review'), detail] : [detail];
    }
    if (context === 'create') {
      if (!['operator','developer'].includes(role)) return [detail];
      const rejectedToCreation = Boolean(latestCreationRejection("ticket", row));
      const actions = status === '草稿' ? [actionDef('edit', '编辑', 'edit'), actionDef('delete', '删除', 'delete-row', '', true)] : status === '待提交' ? (rejectedToCreation ? [detail, actionDef('edit', '编辑', 'edit')] : [actionDef('edit', '编辑', 'edit'), actionDef('void', '废止', 'void-row', '', true)]) : status === '已办结' ? [detail] : [actionDef('remind', '催办', 'remind', '批量催办'), ...((status === "待审批" || canWithdrawSubmission('ticket', row)) ? [actionDef('withdraw', '撤回', 'withdraw-submission')] : []), detail];
      return filterActionsByComplaintPermission(actions, 'ticket-create', state.createTab || '全部', status);
    }
    if (!['handler','developer'].includes(role)) return [detail];
    let actions = [detail];
    if (state.processScope === '机构工单池') {
      const transfer = transferReasonPolicy(status).allowed ? [actionDef('transfer', '转派', 'transfer')] : [];
      actions = status === '待处理' ? [actionDef('process', '处理', 'process'), ...transfer, detail] : [...transfer, detail];
    }
    else if (state.processScope === '我的工作台' && ['待处理','处理中'].includes(status)) actions = [actionDef('process', '处理', 'process'), actionDef('transfer', '转派', 'transfer'), detail];
    else if (state.processScope === '下辖工单池') actions = [actionDef('remind', '催办', 'remind', '批量催办'), detail];
    return filterActionsByComplaintPermission(actions, 'ticket-process', state.processScope, status);
  }

  function renderTicketTable(rows, options = {}) {
    const context = options.context || 'create';
    const scope = options.scope || 'tickets';
    const preparedRows = options.includeSmsApproval ? rows.map(row => {
      const smsStatus = row[5] === "处理中" ? (state.smsStatusByTicket[row[0]] || "") : "";
      return row.length > 7 ? [...row.slice(0,7), smsStatus] : [...row, smsStatus];
    }) : rows;
    const businessLineIndex = 9;
    const displayRows = ticketRowsWithAcceptanceChannel(preparedRows).map(row => {
      const next = [...row];
      if (options.showBusinessLine) next[businessLineIndex] = ticketBusinessLine(row);
      return next;
    });
    const timeSort = state.sorts[scope];
    const sortedRows = timeSort?.index === TICKET_TIME_SORT_INDEX
      ? displayRows.map(row => [...row]).sort((a, b) => dispositionDeadline(a).localeCompare(dispositionDeadline(b)) * (timeSort.direction === "asc" ? 1 : -1))
      : timeSort ? sortRowsForTable(displayRows, scope) : sortByTaskArrival(displayRows, 6, Boolean(options.draft));
    const pageRows = options.disablePagination ? sortedRows : paginateRows(sortedRows, scope, options.pageSize || 10);
    const resolver = options.actionResolver || (row => ticketActions(row, context, options));
    const defs = collectOperationDefs(pageRows, resolver);
    const hideSelection = Boolean(options.hideSelection || ["auto-drafts", "manual-drafts"].includes(scope));
    const smsHead = options.includeSmsApproval ? '<th>短信审批状态</th>' : '';
    const businessLineHead = options.showBusinessLine ? '<th>所属业务条线</th>' : '';
    const toolbar = hideSelection ? '' : renderBulkToolbar(scope, defs, collectBatchOperationDefs(pageRows, resolver));
    const selectionHeader = hideSelection ? '' : selectionHead(scope);
    const table = '<table class="table ds-table selectable-table ticket-list-table deadline-aware-table ' + (options.tableClass || '') + '"><thead><tr>' + selectionHeader + '<th>工单编号</th><th>工单类型</th><th>客户姓名</th><th>受理渠道</th><th>工单接收机构</th><th>工单接收部门</th>' + businessLineHead + '<th>工单状态</th>' + smsHead + renderTicketTimeHead(scope) + renderOperationHeaders(defs) + '</tr></thead><tbody>' + pageRows.map(row => { const displayId = row[5] === '草稿' ? '-' : row[0]; return '<tr>' + (hideSelection ? '' : selectionCell(scope,row[0])) + '<td class="primary-cell">' + displayId + '</td><td>' + renderTicketTypeWithKind(row) + '</td><td>' + (row[2] || '-') + '</td><td>' + (row[3] || '-') + '</td><td>' + ticketReceivingInstitution(row) + '</td><td>' + ticketReceivingDepartment(row) + '</td>' + (options.showBusinessLine ? '<td>' + (row[businessLineIndex] || '-') + '</td>' : '') + '<td>' + statusTag(row[5]) + '</td>' + (options.includeSmsApproval ? '<td>' + statusTag(row[7]) + '</td>' : '') + renderTicketTimeCell(row, "ticket", row[5], { actualOnly:Boolean(options.draft) }) + renderOperationCells(defs, resolver(row), row[0]) + '</tr>'; }).join('') + '</tbody></table>';
    return '<div class="table-wrap"><div class="table-aligned-shell">' + toolbar + table + '</div></div>';
  }
  function normalizeImportStatus(status) {
    if (["导入成功", "草稿生成成功"].includes(status)) return "导入成功";
    if (["导入失败", "解析失败"].includes(status)) return "导入失败";
    return "导入中";
  }
  function renderImportTable(rows) {
    const scope = 'import-records';
    const sortedRows = sortRowsForTable(rows, scope);
    const pageRows = paginateRows(sortedRows, scope, 8);
    const resolver = row => normalizeImportStatus(row[2]) === '导入失败' && ['operator','developer'].includes(state.role) ? [actionDef('delete', '删除', 'delete-row', '批量删除', true)] : [];
    const defs = collectOperationDefs(pageRows, resolver);
    return '<div class="table-wrap"><table class="table ds-table import-table"><thead><tr>' + sortableHead('导入文件', scope, 0) + sortableHead('导入时间', scope, 1) + sortableHead('导入状态', scope, 2) + renderOperationHeaders(defs) + '</tr></thead><tbody>' + pageRows.map(row => '<tr><td class="primary-cell">' + (row[0] || '-') + '</td><td>' + (row[1] || '-') + '</td><td>' + statusTag(normalizeImportStatus(row[2])) + '</td>' + renderOperationCells(defs, resolver(row), row[0]) + '</tr>').join('') + '</tbody></table></div>';
  }

  function renderPagination(total = 23, scope = "default", pageSize = 10, pageSizeOptions = [10, 20, 50]) {
    if (!state.pagination) state.pagination = {};
    const sizeKey = scope + ":pageSize";
    const currentPageSize = pageSizeOptions.includes(Number(state.pagination[sizeKey])) ? Number(state.pagination[sizeKey]) : pageSize;
    const totalPages = Math.max(1, Math.ceil(total / currentPageSize));
    const current = Math.min(totalPages, Math.max(1, Number(state.pagination[scope] || 1)));
    state.pagination[scope] = current;
    state.pagination[sizeKey] = currentPageSize;
    const windowStart = Math.max(1, Math.min(current - 1, totalPages - 2));
    const pages = Array.from({ length: Math.min(3, totalPages) }, (_, index) => windowStart + index);
    const prevDisabled = current <= 1;
    const nextDisabled = current >= totalPages;
    const options = pageSizeOptions.map(size => '<option value="' + size + '" ' + (size === currentPageSize ? 'selected' : '') + '>' + size + ' 条/页</option>').join('');
    // 分页器可能位于处理表单内，页码按钮必须避免触发表单提交。
    return '<div class="pagination ds-pagination" data-pagination-scope="' + escapeAttribute(scope) + '"><span class="pagination-total">共 ' + total + ' 条</span><select class="di-native-select pagination-size" data-pagination-size aria-label="每页条数">' + options + '</select><nav class="pagination-nav" aria-label="分页"><button type="button" class="page-btn pagination-arrow" data-pagination-page="' + Math.max(1, current - 1) + '" aria-label="上一页" ' + (prevDisabled ? 'disabled' : '') + '>‹</button>' + pages.map(page => '<button type="button" class="page-btn ' + (page === current ? 'is-active' : '') + '" data-pagination-page="' + page + '">' + page + '</button>').join('') + '<button type="button" class="page-btn pagination-arrow" data-pagination-page="' + Math.min(totalPages, current + 1) + '" aria-label="下一页" ' + (nextDisabled ? 'disabled' : '') + '>›</button></nav><label class="pagination-jump">前往 <input class="di-input" value="' + current + '" inputmode="numeric" data-pagination-jump aria-label="跳转页码"> 页</label><strong class="pagination-current" aria-live="polite">第 ' + current + ' / ' + totalPages + ' 页</strong></div>';
  }

  function paginateRows(rows, scope, pageSize = 10, pageSizeOptions = [10, 20, 50]) {
    if (!state.pagination) state.pagination = {};
    const sizeKey = scope + ":pageSize";
    const configuredPageSize = Number(state.pagination[sizeKey] || pageSize);
    const currentPageSize = pageSizeOptions.includes(configuredPageSize) ? configuredPageSize : pageSize;
    const totalPages = Math.max(1, Math.ceil(rows.length / currentPageSize));
    const current = Math.min(totalPages, Math.max(1, Number(state.pagination[scope] || 1)));
    state.pagination[scope] = current;
    state.pagination[sizeKey] = currentPageSize;
    return rows.slice((current - 1) * currentPageSize, current * currentPageSize);
  }

  function fieldKey(field, scope = "") {
    const key = field.key || field.name;
    return scope ? scope + "." + key : key;
  }
  function fieldLabel(field) { return field.labelBy?.[state.workOrderType] || field.label || field.name; }
  function fieldValue(field, key = fieldKey(field)) { return state.formValues[key] ?? field.valueBy?.[state.workOrderType] ?? field.value ?? field.defaultValue ?? ""; }
  function fieldDisabled(field, scope = "") { return Boolean(field.disabled || field.disabledBy?.includes(state.workOrderType) || (field.disabledWhen && conditionMatches(field.disabledWhen, scope))); }
  function customerServiceDraftChannelLocked() { return state.ticketDraftSource === "自动带入草稿箱" && currentRoleProfile().org !== "customer-service"; }
  function customerServiceDraftChannelDefault() { return state.ticketDraftSource === "自动带入草稿箱" && currentRoleProfile().org === "customer-service"; }
  function conditionMatches(condition, scope = "") {
    if (!condition) return true;
    const key = scope ? scope + "." + condition.key : condition.key;
    const value = state.formValues[key] || "";
    if (Object.prototype.hasOwnProperty.call(condition, "equals")) return value === condition.equals;
    if (Object.prototype.hasOwnProperty.call(condition, "notEquals")) return value !== condition.notEquals;
    if (condition.in) return condition.in.includes(value);
    return true;
  }
  function fieldVisible(field, scope = "") {
    const applies = field.all || (field.types || []).includes(state.workOrderType);
    if (!scope && CORRECTION_TAG_FIELDS.has(field.name)) return false;
    return Boolean(applies && conditionMatches(field.showWhen, scope));
  }
  function fieldRequired(field, scope = "") {
    if (field.autoDispatchCc) return ticketDispatchCopyRecipients().length > 0;
    const institutionRules = field.optionsByInstitution;
    const institutionKey = scope ? scope + "." + institutionRules?.key : institutionRules?.key;
    if (institutionRules?.emptyForSubbranch && institutionSelectionDetails(state.formValues[institutionKey]).isSubbranch) return false;
    return Boolean(field.required || field.requiredBy?.[state.workOrderType] || (field.requiredWhen && conditionMatches(field.requiredWhen, scope)));
  }
  function visibleFormSections() {
    const sections = orderedFormSections().filter(section => section.fields.some(field => fieldVisible(field)));
    return state.workOrderType ? sections : sections.filter(section => section.id === "basic");
  }

  function hydrateTicketFormForEdit(row) {
    if (!row) return;
    const entry = documentRecordFor("ticket", row)?.fields?.entry || {};
    state.ticketEditingId = row[0];
    state.workOrderType = row[1];
    state.formValues = {};
    Object.entries(entry).forEach(([key, value]) => {
      state.formValues[key] = deepClone(value);
      state.formValues["customer.1." + key] = deepClone(value);
    });
    state.formValues["工单类型"] = row[1];
    state.formValues["customer.1.客户姓名"] = entry["客户姓名"] || row[2] || "";
  }

  function renderTicketForm() {
    const sections = visibleFormSections();
    const demoAction = state.role === "developer" ? `<button class="btn xib-btn xib-btn--secondary" data-action="demo-fill-ticket">${icon("edit")} 一键填写 Demo</button>` : "";
    const editingRow = state.ticketEditingId ? ticketRowById(state.ticketEditingId) : null;
    return `<section class="page" style="padding-bottom:0">${pageHeader(editingRow ? "编辑工单" : "新建工单", "统一工单表单，根据工单类型和字段选择动态展示差异字段", renderContextBackButton("ticket-create", "工单创建"))}${renderCreationRejection("ticket", editingRow)}<div class="form-layout"><form id="ticket-form-main"><div id="form-sections">${renderFormSections()}</div></form><aside class="form-anchor"><div class="anchor-title">填写导航</div><nav class="lib-anchor" aria-label="表单填写导航">${sections.map((section,index)=>`<a class="anchor-link ${index===0?'is-active':''}" href="#section-${section.id}" data-anchor="${section.id}">${formSectionTitle(section)}</a>`).join("")}</nav></aside></div><div class="sticky-actions ticket-form-actions"><div class="sticky-action-buttons">${demoAction}<button class="btn xib-btn xib-btn--secondary" data-action="save-draft">保存草稿</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="submit-ticket">提交并派发</button></div></div></section>`;
  }
  function customerCount() {
    if (!["投诉单", "信访单"].includes(state.workOrderType)) return 1;
    const value = Number(state.formValues["投诉人数"] ?? 1);
    return Number.isFinite(value) ? Math.min(10, Math.max(1, Math.floor(value))) : 1;
  }

  function renderCustomerCountControl(countField, count) {
    const label = fieldLabel(countField);
    const required = fieldRequired(countField);
    return `<div class="form-item" data-field-name="投诉人数"><label class="form-label ${required ? "required" : ""}" for="customer-count-value"><span>${label}</span></label><div class="form-control"><div class="customer-count-control"><input class="di-input is-fluid" id="customer-count-value" data-field-key="投诉人数" value="${count}" readonly aria-readonly="true"><button type="button" class="customer-count-add" data-customer-add aria-label="增加一位投诉人" title="增加一位投诉人" ${count >= 10 ? "disabled" : ""}>+</button></div></div></div>`;
  }

  function removeCustomer(number) {
    const count = customerCount();
    if (number <= 1 || number > count) return;
    const values = {};
    Object.entries(state.formValues).forEach(([key, value]) => {
      const match = key.match(/^customer\.(\d+)\.(.+)$/);
      if (!match) {
        values[key] = value;
        return;
      }
      const customerNumber = Number(match[1]);
      if (customerNumber === number) return;
      const nextNumber = customerNumber > number ? customerNumber - 1 : customerNumber;
      values[`customer.${nextNumber}.${match[2]}`] = value;
    });
    values["投诉人数"] = String(count - 1);
    state.formValues = values;
    state.collapsedCustomers = new Set([...state.collapsedCustomers]
      .filter(customerNumber => customerNumber !== number)
      .map(customerNumber => customerNumber > number ? customerNumber - 1 : customerNumber));
  }

  function openCustomerDeleteConfirmation(number) {
    if (number <= 1 || number > customerCount()) return;
    showOverlay(`<div class="modal-mask" data-close-overlay></div><div class="modal customer-delete-modal" data-modal-size="compact" role="dialog" aria-modal="true" aria-labelledby="customer-delete-title"><div class="modal-head" id="customer-delete-title">提示<button class="icon-btn" data-close-overlay aria-label="关闭">${icon("close")}</button></div><div class="modal-body"><p>确定要删除该投诉人吗?</p></div><div class="modal-foot"><button class="btn xib-btn xib-btn--secondary" data-close-overlay>取消</button><button class="btn xib-btn xib-btn--primary btn-primary" id="customer-delete-confirm">确定</button></div></div>`);
    const modal = document.querySelector("#overlay-root .customer-delete-modal");
    modal?.classList.remove("is-wide");
    if (modal) modal.dataset.modalSize = "compact";
    document.getElementById("customer-delete-confirm")?.addEventListener("click", () => {
      removeCustomer(number);
      closeOverlay();
      rerenderPage();
    });
  }

  function renderCustomerSection(section) {
    const countField = section.fields.find(field => field.name === "投诉人数");
    const customerFields = section.fields.filter(field => field !== countField);
    const count = customerCount();
    const countRow = fieldVisible(countField) ? `<div class="customer-count-row">${renderCustomerCountControl(countField, count)}</div>` : "";
    const cards = Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      const scope = "customer." + number;
      const collapsed = state.collapsedCustomers.has(number);
      const deleteAction = number > 1 ? `<button type="button" class="customer-card-delete" data-customer-delete="${number}"><img src="ui/assets/delete.svg" alt="">删除</button>` : "";
      const customerTitle = ["投诉单", "信访单"].includes(state.workOrderType) ? "客户信息 " + number : "客户信息";
      return `<section class="customer-card ${collapsed ? "is-collapsed" : ""}" data-customer-card="${number}"><div class="customer-card-head"><button type="button" class="customer-card-toggle" data-customer-toggle="${number}" aria-expanded="${!collapsed}"><span><strong>${customerTitle}</strong></span><img class="customer-card-caret" src="ui/assets/${collapsed ? "caret-bottom.svg" : "caret-top.svg"}" alt=""></button>${deleteAction}</div><div class="customer-card-body" ${collapsed ? "hidden" : ""}><div class="form-grid">${customerFields.filter(field => fieldVisible(field, scope)).map(field => renderField(field, scope)).join("")}</div></div></section>`;
    }).join("");
    return countRow + `<div class="customer-card-list">${cards}</div>`;
  }

  function aiInputFields() {
    const inputNames = new Set(["反馈内容"]);
    if (state.workOrderType === "投诉单") inputNames.add("主体诉求");
    return formSections.flatMap(section => section.fields).filter(field => inputNames.has(field.name) && fieldVisible(field));
  }

  function aiOutputGroups() {
    return ["pboc", "regulatory", "intelligent-tags", "intelligent-dispatch"].map(id => {
      const section = formSections.find(item => item.id === id);
      const fields = (section?.fields || []).filter(fieldVisible).filter(field => field.type !== "aiAction" && field.aiFill !== false);
      return fields.length ? { id, title: formSectionTitle(section), fields } : null;
    }).filter(Boolean);
  }

  function renderAiRecommendationPreview() {
    if (!state.aiClassificationReady) return "";
    return `<p class="ai-model-disclaimer">${AI_DISCLAIMER}<br>填写标签时请按重要性排序，最重要的标签排在最前面；确认后仍可手动修改。</p>`;
  }

  function renderFormSections() {
    return visibleFormSections().map(section => {
      const body = section.id === "customer" ? renderCustomerSection(section) : `<div class="form-grid">${section.fields.filter(field => fieldVisible(field)).map(field => renderField(field)).join("")}</div>`;
      const mappedNotice = sectionUsesAi(section.id) ? `<small class="ai-section-disclaimer">${AI_DISCLAIMER}</small>` : "";
      const smartDispatchRefresh = section.id === "intelligent-dispatch" && AI_CLASSIFICATION_TYPES.has(state.workOrderType)
        ? `<button type="button" class="btn xib-btn xib-btn--secondary ai-dispatch-refresh" data-action="refresh-smart-dispatch">${icon("reset")} 刷新</button>`
        : "";
      const headExtra = mappedNotice || smartDispatchRefresh ? `<span class="ai-section-head-actions">${mappedNotice}${smartDispatchRefresh}</span>` : "";
      const selectionNote = state.page === "ticket-form" && AI_CLASSIFICATION_TYPES.has(state.workOrderType)
        ? section.id === "intelligent-tags" ? '<p class="ai-section-selection-note">每类最多选 3 个标签；确认后可按重要性调整顺序。</p>'
          : ["pboc", "regulatory"].includes(section.id) ? '<p class="ai-section-selection-note">以下每个字段最终只能选填 1 个；AI 推荐可供参考。</p>' : ""
        : "";
      return `<section class="form-section" id="section-${section.id}"><div class="form-section-head"><span>${formSectionTitle(section)}</span>${headExtra}</div><div class="form-section-body">${selectionNote}${body}</div></section>`;
    }).join("");
  }
  function ticketAiWaitingPlaceholder(key) {
    return "请选择";
  }
  function renderSelectControl(id, options, disabled = false, key = id, config = {}) {
    const selected = state.formValues[key] || "";
    const aiClass = selected && state.aiGeneratedFields.has(key) ? " is-ai-generated" : "";
    const searchable = Boolean(config.searchable);
    const search = searchable ? '<div class="di-select-search"><input type="search" class="di-input is-fluid" data-select-search data-select-search-mode="' + escapeAttribute(config.searchMode || "contains") + '" placeholder="' + escapeAttribute(config.searchPlaceholder || "搜索") + '" aria-label="' + escapeAttribute(config.searchPlaceholder || "搜索选项") + '"></div>' : '';
    const optionButtons = options.map(option => '<button type="button" class="' + (selected === option ? 'is-active' : '') + '" data-select-value="' + escapeAttribute(option) + '">' + escapeAttribute(option) + '</button>').join("");
    return '<div class="di-custom-select' + (searchable ? ' is-searchable' : '') + '" data-app-select><button type="button" class="di-select is-fluid di-select-trigger" ' + (disabled ? 'disabled' : '') + '><span class="' + aiClass.trim() + '">' + escapeAttribute(selected || config.placeholder || ticketAiWaitingPlaceholder(key)) + '</span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><input type="hidden" id="' + escapeAttribute(id) + '" data-field-key="' + escapeAttribute(key) + '" value="' + escapeAttribute(selected) + '"><div class="di-select-popover" hidden>' + search + '<div class="di-select-options">' + optionButtons + '</div><div class="di-select-empty" data-select-empty hidden>无匹配选项</div></div></div>';
  }

  function outboundContactRecordsForTicket(ticket = activeContactTicket()) {
    return contactRecordsForTicket(ticket).filter(record => record?.method === "一键外呼");
  }

  function outboundContactTimesForTicket(ticket = activeContactTicket()) {
    // 已告知处理结果时，只允许选择已成功联系的外呼记录。
    return [...new Set(outboundContactRecordsForTicket(ticket)
      .filter(record => contactStatusForRecord(record) === "已联系")
      .map(record => String(record.time || "").trim()).filter(Boolean))];
  }

  function bindSelectSearch(menu) {
    const search = menu?.querySelector("[data-select-search]");
    if (!search || search.dataset.bound === "true") return;
    search.dataset.bound = "true";
    search.addEventListener("input", () => {
      const query = search.value.toLocaleLowerCase().replace(/\s+/g, "");
      let visible = 0;
      const prefixOnly = search.dataset.selectSearchMode === "prefix";
      menu.querySelectorAll("[data-select-value]").forEach(option => {
        const candidate = option.dataset.selectValue.toLocaleLowerCase().replace(/\s+/g, "");
        const matched = prefixOnly ? candidate.startsWith(query) : candidate.includes(query);
        option.hidden = !matched;
        if (matched) visible += 1;
      });
      const empty = menu.querySelector("[data-select-empty]");
      if (empty) empty.hidden = visible > 0;
    });
  }

  function focusSelectSearch(menu) {
    const search = menu?.querySelector("[data-select-search]");
    if (!search) return;
    search.value = "";
    search.dispatchEvent(new Event("input"));
    setTimeout(() => search.focus(), 0);
  }

  function renderPersonSearchControl(id, options, disabled = false, key = id, config = {}) {
    const current = state.formValues[key] || "";
    const optionValues = [...new Set([...(options || []), current].filter(Boolean))];
    return '<div class="di-custom-select di-person-search" data-person-search data-search-mode="' + escapeAttribute(config.searchMode || "prefix") + '">'
      + '<input class="di-input is-fluid" id="' + escapeAttribute(id) + '" data-field-key="' + escapeAttribute(key) + '" data-person-search-input role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" placeholder="' + escapeAttribute(config.placeholder || "输入姓名首字搜索或手工录入") + '" value="' + escapeAttribute(current) + '" ' + (disabled ? 'disabled' : '') + '>'
      + '<div class="di-select-popover" data-person-search-menu hidden><div class="di-select-options">'
      + optionValues.map(option => '<button type="button" data-person-search-option="' + escapeAttribute(option) + '">' + escapeAttribute(option) + '</button>').join("")
      + '</div><div class="di-select-empty" data-person-search-empty hidden>无匹配人员，可继续手工录入</div></div></div>';
  }

  function bindPersonSearchControl(host) {
    const input = host?.querySelector("[data-person-search-input]");
    const menu = host?.querySelector("[data-person-search-menu]");
    if (!input || !menu || input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    const filter = () => {
      const query = input.value.toLocaleLowerCase().replace(/\s+/g, "");
      const prefixOnly = host.dataset.searchMode === "prefix";
      let visible = 0;
      menu.querySelectorAll("[data-person-search-option]").forEach(option => {
        const candidate = option.dataset.personSearchOption.toLocaleLowerCase().replace(/\s+/g, "");
        const matched = !query || (prefixOnly ? candidate.startsWith(query) : candidate.includes(query));
        option.hidden = !matched;
        if (matched) visible += 1;
      });
      const empty = menu.querySelector("[data-person-search-empty]");
      if (empty) empty.hidden = visible > 0;
    };
    const open = () => {
      document.querySelectorAll(".di-select-popover,.di-picker-popover").forEach(popover => { if (popover !== menu) popover.hidden = true; });
      filter();
      menu.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };
    input.addEventListener("focus", open);
    input.addEventListener("click", event => { event.stopPropagation(); open(); });
    input.addEventListener("input", () => { filter(); menu.hidden = false; input.setAttribute("aria-expanded", "true"); });
    menu.querySelectorAll("[data-person-search-option]").forEach(option => option.addEventListener("click", event => {
      event.stopPropagation();
      input.value = option.dataset.personSearchOption;
      state.formValues[input.dataset.fieldKey] = input.value;
      state.aiGeneratedFields.delete(input.dataset.fieldKey);
      syncCorrectionFieldHighlight(input, input.value);
      menu.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }));
  }

  function nativeSelectDisplayText(select) {
    if (select.dataset.emptyDisplay === "true") return "";
    const selected = select.options[select.selectedIndex];
    return selected?.textContent?.trim() || select.dataset.placeholder || "请选择";
  }

  function renderEnhancedNativeSelectOptions(select, menu) {
    menu.innerHTML = [...select.options].map(option => {
      const value = option.value;
      const active = value === select.value;
      return '<button type="button" class="' + (active ? 'is-active' : '') + '" data-native-select-value="' + escapeAttribute(value) + '" role="option" aria-selected="' + active + '" ' + (option.disabled ? 'disabled' : '') + '>' + escapeAttribute(option.textContent.trim()) + '</button>';
    }).join("");
  }

  function syncEnhancedNativeSelect(select) {
    if (!select) return;
    const shell = select.closest("[data-native-select-shell]");
    if (!shell) return;
    const trigger = shell.querySelector("[data-native-select-trigger]");
    const menu = shell.querySelector("[data-native-select-menu]");
    if (!trigger || !menu) return;
    trigger.disabled = select.disabled;
    trigger.setAttribute("aria-disabled", String(select.disabled));
    const value = trigger.querySelector("span");
    value.textContent = nativeSelectDisplayText(select);
    value.classList.toggle("is-ai-generated", Boolean(select.value && state.aiGeneratedFields.has(select.dataset.fieldKey)));
    renderEnhancedNativeSelectOptions(select, menu);
  }

  function enhanceNativeSelects(scope = document) {
    const selector = "select.di-native-select:not([multiple]):not([data-native-enhanced]),select.di-input:not([multiple]):not([data-native-enhanced])";
    const selects = [...(scope.matches?.(selector) ? [scope] : []), ...scope.querySelectorAll(selector)];
    selects.forEach(select => {
      const measuredWidth = Math.ceil(select.getBoundingClientRect().width);
      const parentWidth = Math.ceil(select.parentElement?.getBoundingClientRect().width || 0);
      const fluid = select.classList.contains("is-fluid") || (parentWidth > 0 && measuredWidth >= parentWidth - 2);
      const shell = document.createElement("div");
      shell.className = "di-native-select-shell" + (fluid ? " is-fluid" : "");
      shell.dataset.nativeSelectShell = "true";
      if (!fluid && measuredWidth > 0) shell.style.width = measuredWidth + "px";
      shell.innerHTML = '<button type="button" class="di-select is-fluid di-select-trigger di-native-select-trigger" data-native-select-trigger aria-haspopup="listbox" aria-expanded="false"><span></span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><div class="di-select-popover di-native-select-popover" data-native-select-menu role="listbox" hidden></div>';
      select.parentNode.insertBefore(shell, select);
      shell.appendChild(select);
      select.dataset.nativeEnhanced = "true";
      select.classList.add("is-native-select-source");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");

      const trigger = shell.querySelector("[data-native-select-trigger]");
      const menu = shell.querySelector("[data-native-select-menu]");
      const close = () => {
        menu.hidden = true;
        shell.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      };
      const sync = () => syncEnhancedNativeSelect(select);
      trigger.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        document.querySelectorAll(".di-select-popover,.di-picker-popover,.di-cascader-popover,.di-hierarchy-cascader-popover,.di-year-popover,.filter-status-popover").forEach(panel => {
          if (panel !== menu) panel.hidden = true;
        });
        sync();
        const opening = menu.hidden;
        menu.hidden = !opening;
        shell.classList.toggle("is-open", opening);
        trigger.setAttribute("aria-expanded", String(opening));
      });
      menu.addEventListener("click", event => {
        const option = event.target.closest("[data-native-select-value]");
        if (!option || option.disabled) return;
        event.preventDefault();
        event.stopPropagation();
        select.value = option.dataset.nativeSelectValue;
        select.dispatchEvent(new Event("input", { bubbles:true }));
        select.dispatchEvent(new Event("change", { bubbles:true }));
        if (select.isConnected) sync();
        close();
      });
      select.addEventListener("input", sync);
      select.addEventListener("change", sync);
      new MutationObserver(sync).observe(select, { childList:true, subtree:true, attributes:true, attributeFilter:["disabled", "selected", "label", "value"] });
      sync();
    });
  }

  function observeNativeSelectMounts() {
    if (window.__nativeSelectMountObserver || !document.body) return;
    window.__nativeSelectMountObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) enhanceNativeSelects(node);
      }));
    });
    window.__nativeSelectMountObserver.observe(document.body, { childList:true, subtree:true });
  }


  function cascadeColumnsHtml(sourceKey, path = []) {
    let nodes = peopleBankCascaderSource(sourceKey);
    const columns = [];
    let mutedLeaf = "";
    for (let level = 0; level < 3; level += 1) {
      const selected = path[level] || "";
      if (mutedLeaf) {
        columns.push('<div class="di-cascader-column is-muted" data-cascade-column="' + level + '"><p>已选择「' + mutedLeaf + '」，无下级选项</p></div>');
        continue;
      }
      columns.push('<div class="di-cascader-column" data-cascade-column="' + level + '">' + (nodes.length ? nodes.map(node => '<button type="button" class="' + (selected === node.label ? 'is-active' : '') + '" data-cascade-level="' + level + '" data-cascade-label="' + node.label + '"><span>' + node.label + '</span>' + (node.children ? '<img src="ui/assets/caret-right.svg" alt="">' : '') + '</button>').join('') : '<p>请先选择上一级</p>') + '</div>');
      const selectedNode = nodes.find(node => node.label === selected);
      if (selectedNode && !(selectedNode.children && selectedNode.children.length)) mutedLeaf = selected;
      nodes = selectedNode?.children || [];
    }
    return columns.join('');
  }

  function cascadeNode(sourceKey, path) {
    let nodes = peopleBankCascaderSource(sourceKey);
    let node = null;
    for (const label of path) { node = nodes.find(item => item.label === label); if (!node) return null; nodes = node.children || []; }
    return node;
  }

  function renderCascaderControl(id, sourceKey, key, disabled = false, linkedKeys = []) {
    const current = state.formValues[key] || "";
    const path = current ? current.split(" / ").filter(value => value && value !== "/") : [];
    const aiClass = current && state.aiGeneratedFields.has(key) ? " class=\"is-ai-generated\"" : "";
    return '<div class="di-cascader" data-app-cascader data-cascader-source="' + sourceKey + '" data-cascader-linked="' + escapeAttribute(JSON.stringify(linkedKeys)) + '"><button type="button" class="di-select is-fluid di-cascader-trigger" ' + (disabled ? 'disabled' : '') + '><span' + aiClass + '>' + escapeAttribute(current || ticketAiWaitingPlaceholder(key)) + '</span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><input type="hidden" id="' + id + '" data-field-key="' + key + '" value="' + escapeAttribute(current) + '" ' + (disabled ? 'disabled' : '') + '><div class="di-cascader-popover" hidden><div class="di-cascader-columns">' + cascadeColumnsHtml(sourceKey, path) + '</div></div></div>';
  }

  function renderRadioControl(id, options, key, defaultValue = "", disabled = false) {
    const selected = state.formValues[key] ?? defaultValue;
    return `<div class="di-choice-row ${disabled ? "is-disabled" : ""}" data-app-radio>${options.map(option=>`<button type="button" class="di-radio-choice ${selected===option?'is-checked':''}" data-radio-value="${option}" ${disabled?'disabled':''}>${option}</button>`).join("")}<input type="hidden" id="${id}" data-field-key="${key}" value="${selected}" ${disabled?'disabled':''}></div>`;
  }

  function businessLineValueLabel(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return [value.primary, value.optional].filter(Boolean).join(" / ");
  }

  function renderBusinessLinePickerControl(id, field, key, disabled = false, toggleOptional = true) {
    const raw = state.formValues[key] || field.defaultValue || {};
    const selected = typeof raw === "string" ? { primary: raw, optional: "" } : raw;
    const primaryOptions = field.primaryOptions || [];
    const optionalOptions = field.optionalOptions || [];
    const primary = selected.primary || "";
    const optional = selected.optional || "";
    const hiddenValue = JSON.stringify({ primary, optional });
    return '<div class="business-line-picker ' + (disabled ? 'is-disabled' : '') + '" data-business-line-picker data-business-line-toggle-optional="' + (toggleOptional ? 'true' : 'false') + '" data-field-key="' + escapeAttribute(key) + '">' +
      '<div class="business-line-block"><span>' + escapeAttribute(field.primaryLabel || '必选条线') + '</span><div class="di-choice-row" data-business-line-primary>' + primaryOptions.map(option => '<button type="button" class="di-radio-choice ' + (option === primary ? 'is-checked' : '') + '" data-line-value="' + escapeAttribute(option) + '" ' + (disabled ? 'disabled' : '') + '>' + escapeAttribute(option) + '</button>').join('') + '</div></div>' +
      '<div class="business-line-block"><span>' + escapeAttribute(field.optionalLabel || '可选条线') + '</span><div class="di-choice-row" data-business-line-optional>' + (toggleOptional ? '' : '<div class="business-line-empty-row"><button type="button" class="di-radio-choice ' + (!optional ? 'is-checked' : '') + '" data-line-value="" ' + (disabled ? 'disabled' : '') + '>-</button></div>') + optionalOptions.map(option => '<button type="button" class="di-radio-choice ' + (option === optional ? 'is-checked' : '') + '" data-line-value="' + escapeAttribute(option) + '" ' + (disabled ? 'disabled' : '') + '>' + escapeAttribute(option) + '</button>').join('') + '</div></div>' +
      '<input type="hidden" id="' + id + '" data-field-key="' + escapeAttribute(key) + '" value="' + escapeAttribute(primary) + '" data-business-line-value="' + escapeAttribute(hiddenValue) + '" ' + (disabled ? 'disabled' : '') + '>' +
      '<small class="business-line-hint">' + escapeAttribute(field.placeholder || '必选 4 选 1；可选 3 选 0 或 1') + '</small></div>';
  }

  function bindBusinessLinePickers(root = document) {
    root.querySelectorAll("[data-business-line-picker]").forEach(host => {
      if (host.dataset.businessLineBound === "true") return;
      host.dataset.businessLineBound = "true";
      const hidden = host.querySelector('input[type="hidden"]');
      const sync = () => {
        const primary = host.querySelector("[data-business-line-primary] .is-checked")?.dataset.lineValue || "";
        const optional = host.querySelector("[data-business-line-optional] .is-checked")?.dataset.lineValue || "";
        const value = { primary, optional };
        hidden.value = primary;
        hidden.dataset.businessLineValue = JSON.stringify(value);
        state.formValues[hidden.dataset.fieldKey] = value;
      };
      host.querySelectorAll("[data-business-line-primary] [data-line-value]").forEach(button => button.addEventListener("click", () => {
        if (button.disabled) return;
        host.querySelectorAll("[data-business-line-primary] [data-line-value]").forEach(item => item.classList.toggle("is-checked", item === button));
        sync();
      }));
      host.querySelectorAll("[data-business-line-optional] [data-line-value]").forEach(button => button.addEventListener("click", () => {
        if (button.disabled) return;
        if (host.dataset.businessLineToggleOptional === "true" && button.classList.contains("is-checked")) {
          button.classList.remove("is-checked");
          sync();
          return;
        }
        host.querySelectorAll("[data-business-line-optional] [data-line-value]").forEach(item => item.classList.toggle("is-checked", item === button));
        sync();
      }));
      sync();
    });
  }
  function renderYearPickerControl(id, field, key, disabled = false) {
    const current = fieldValue(field, key);
    const start = current ? Math.floor(Number(current) / 12) * 12 : 1980;
    return '<div class="di-year-picker" data-app-year-picker data-year-start="' + start + '"><button type="button" class="di-select is-fluid di-year-trigger" ' + (disabled ? 'disabled' : '') + '><img class="lib-icon-img" src="ui/assets/date.svg" alt=""><span>' + (current || field.placeholder || '选择年份') + '</span></button><input type="hidden" id="' + id + '" data-field-key="' + key + '" value="' + current + '" ' + (disabled ? 'disabled' : '') + '><div class="di-year-popover" hidden><div class="di-year-head"><button type="button" data-year-prev aria-label="上一组年份">‹‹</button><b data-year-title></b><button type="button" data-year-next aria-label="下一组年份">››</button></div><div class="di-year-grid"></div></div></div>';
  }

  function pickerCalendarDays(monthValue, selectedDate = "", minDate = "", maxDate = "") {
    const [year, month] = monthValue.split("-").map(Number);
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();
    const blanks = Array.from({ length: firstWeekday }, () => '<button type="button" disabled></button>');
    const days = Array.from({ length: totalDays }, (_, index) => {
      const value = year + "-" + String(month).padStart(2, "0") + "-" + String(index + 1).padStart(2, "0");
      const disabled = (minDate && value < minDate) || (maxDate && value > maxDate);
      return '<button type="button" class="' + (value === selectedDate ? "is-active" : "") + '" data-date-value="' + value + '"' + (disabled ? ' disabled' : '') + '>' + (index + 1) + '</button>';
    });
    return blanks.concat(days).join("");
  }

  function shiftPickerMonth(monthValue, amount) {
    const [year, month] = monthValue.split("-").map(Number);
    const value = new Date(year, month - 1 + amount, 1);
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
  }

  function bindPickerControl(host, popupScope = document) {
    if (host.dataset.pickerBound === "true") return;
    host.dataset.pickerBound = "true";
    const trigger = host.querySelector("[data-picker-trigger]");
    const popover = host.querySelector(".di-picker-popover");
    const hidden = host.querySelector('input[type="hidden"]');
    const minDate = host.dataset.minDate || "";
    const maxDate = host.dataset.maxDate || "";
    if (trigger.disabled) return;
    const currentParts = String(hidden.value || "").split(" ");
    host.dataset.pendingDate = currentParts[0] && /^\d{4}-\d{2}-\d{2}$/.test(currentParts[0]) ? currentParts[0] : "";
    host.dataset.pendingHour = currentParts[1]?.slice(0, 2) || "09";
    host.dataset.pendingMinute = currentParts[1]?.slice(3, 5) || "00";
    host.dataset.pickerMonth = host.dataset.pendingDate.slice(0, 7) || maxDate.slice(0, 7) || "2026-07";
    const renderCalendar = () => {
      const [year, month] = host.dataset.pickerMonth.split("-");
      host.querySelector("[data-picker-month-title]").textContent = year + " 年 " + Number(month) + " 月";
      host.querySelector("[data-picker-days]").innerHTML = pickerCalendarDays(host.dataset.pickerMonth, host.dataset.pendingDate, minDate, maxDate);
      host.querySelector("[data-picker-year-prev]").disabled = Boolean(minDate && shiftPickerMonth(host.dataset.pickerMonth, -12) < minDate.slice(0, 7));
      host.querySelector("[data-picker-month-prev]").disabled = Boolean(minDate && shiftPickerMonth(host.dataset.pickerMonth, -1) < minDate.slice(0, 7));
      host.querySelector("[data-picker-year-next]").disabled = Boolean(maxDate && shiftPickerMonth(host.dataset.pickerMonth, 12) > maxDate.slice(0, 7));
      host.querySelector("[data-picker-month-next]").disabled = Boolean(maxDate && shiftPickerMonth(host.dataset.pickerMonth, 1) > maxDate.slice(0, 7));
    };
    const renderTime = () => {
      host.querySelectorAll("[data-time-hour]").forEach(button => button.classList.toggle("is-active", button.dataset.timeHour === host.dataset.pendingHour));
      host.querySelectorAll("[data-time-minute]").forEach(button => button.classList.toggle("is-active", button.dataset.timeMinute === host.dataset.pendingMinute));
    };
    trigger.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      popupScope.querySelectorAll(".di-select-popover,.di-picker-popover,.di-cascader-popover,.di-year-popover,.filter-status-popover").forEach(panel => { if (panel !== popover) panel.hidden = true; });
      renderCalendar();
      renderTime();
      popover.hidden = !popover.hidden;
      if (!popover.hidden) {
        positionAnchoredPopover(trigger, popover, { flipVertical: true });
        requestAnimationFrame(() => {
          host.querySelector('[data-time-hour].is-active')?.scrollIntoView({ block: "center" });
          host.querySelector('[data-time-minute].is-active')?.scrollIntoView({ block: "center" });
        });
      }
    });
    popover.addEventListener("click", event => {
      event.stopPropagation();
      const dateButton = event.target.closest("[data-date-value]");
      const hourButton = event.target.closest("[data-time-hour]");
      const minuteButton = event.target.closest("[data-time-minute]");
      if (dateButton) {
        host.dataset.pendingDate = dateButton.dataset.dateValue;
        renderCalendar();
      } else if (hourButton) {
        host.dataset.pendingHour = hourButton.dataset.timeHour;
        renderTime();
      } else if (minuteButton) {
        host.dataset.pendingMinute = minuteButton.dataset.timeMinute;
        renderTime();
      } else if (event.target.closest("[data-picker-year-prev]")) {
        host.dataset.pickerMonth = minDate ? [shiftPickerMonth(host.dataset.pickerMonth, -12), minDate.slice(0, 7)].sort().at(-1) : shiftPickerMonth(host.dataset.pickerMonth, -12);
        renderCalendar();
      } else if (event.target.closest("[data-picker-month-prev]")) {
        host.dataset.pickerMonth = minDate ? [shiftPickerMonth(host.dataset.pickerMonth, -1), minDate.slice(0, 7)].sort().at(-1) : shiftPickerMonth(host.dataset.pickerMonth, -1);
        renderCalendar();
      } else if (event.target.closest("[data-picker-month-next]")) {
        host.dataset.pickerMonth = maxDate ? [shiftPickerMonth(host.dataset.pickerMonth, 1), maxDate.slice(0, 7)].sort().at(0) : shiftPickerMonth(host.dataset.pickerMonth, 1);
        renderCalendar();
      } else if (event.target.closest("[data-picker-year-next]")) {
        host.dataset.pickerMonth = maxDate ? [shiftPickerMonth(host.dataset.pickerMonth, 12), maxDate.slice(0, 7)].sort().at(0) : shiftPickerMonth(host.dataset.pickerMonth, 12);
        renderCalendar();
      } else if (event.target.closest("[data-picker-cancel]")) {
        popover.hidden = true;
      } else if (event.target.closest("[data-picker-confirm]")) {
        if (!host.dataset.pendingDate) return toast("请先选择日期", true);
        if (minDate && host.dataset.pendingDate < minDate) return toast("最早只能选择 2015 年的日期", true);
        if (maxDate && host.dataset.pendingDate > maxDate) return toast("最晚只能选择系统当前日期", true);
        const value = host.dataset.pendingDate + (host.dataset.pickerKind === "datetime" ? " " + host.dataset.pendingHour + ":" + host.dataset.pendingMinute : "");
        hidden.value = value;
        state.formValues[hidden.dataset.fieldKey] = value;
        state.aiGeneratedFields.delete(hidden.dataset.fieldKey);
        trigger.querySelector("span").textContent = value;
        trigger.querySelector("span").classList.remove("is-ai-generated");
        popover.hidden = true;
        if (hidden.dataset.fieldKey === "子流程-申请时间") rerenderPage();
      }
    });
    renderCalendar();
    renderTime();
  }

  function renderPickerControl(id, field, key) {
    const dateTime = field.type === "datetime";
    const disabled = fieldDisabled(field);
    const current = fieldValue(field, key);
    const placeholder = field.placeholder || (dateTime ? "选择日期与时间" : "选择日期");
    const shown = current || placeholder;
    const currentParts = String(current || "").split(" ");
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(currentParts[0] || "") ? currentParts[0] : "";
    const selectedHour = currentParts[1]?.slice(0, 2) || "09";
    const selectedMinute = currentParts[1]?.slice(3, 5) || "00";
    const monthValue = selectedDate.slice(0, 7) || String(field.maxDate || "").slice(0, 7) || "2026-07";
    const timePanel = dateTime ? '<div class="di-picker-time-panel"><div class="di-picker-time-column"><span>小时</span><div class="di-picker-time-list">' + Array.from({ length: 24 }, (_, hour) => { const value = String(hour).padStart(2, "0"); return '<button type="button" class="' + (value === selectedHour ? "is-active" : "") + '" data-time-hour="' + value + '">' + value + '</button>'; }).join("") + '</div></div><div class="di-picker-time-column"><span>分钟</span><div class="di-picker-time-list">' + Array.from({ length: 60 }, (_, minute) => { const value = String(minute).padStart(2, "0"); return '<button type="button" class="' + (value === selectedMinute ? "is-active" : "") + '" data-time-minute="' + value + '">' + value + '</button>'; }).join("") + '</div></div></div>' : "";
    return '<div class="di-picker-field" data-app-picker data-picker-kind="' + (dateTime ? "datetime" : "date") + '" data-min-date="' + escapeAttribute(field.minDate || "") + '" data-max-date="' + escapeAttribute(field.maxDate || "") + '"><button type="button" class="di-select is-fluid di-picker-trigger" data-picker-trigger ' + (disabled ? "disabled" : "") + '><img class="lib-icon-img" src="ui/assets/' + (dateTime ? "clock-in.svg" : "date.svg") + '" alt=""><span data-picker-placeholder="' + placeholder + '">' + shown + '</span></button><input type="hidden" id="' + id + '" data-field-key="' + key + '" value="' + current + '" ' + (disabled ? "disabled" : "") + '><div class="di-picker-popover ' + (dateTime ? "is-datetime" : "") + '" hidden><div class="di-calendar"><div class="di-calendar-head"><button type="button" data-picker-year-prev aria-label="上一年">‹‹</button><button type="button" data-picker-month-prev aria-label="上个月">‹</button><b data-picker-month-title>' + monthValue.slice(0, 4) + ' 年 ' + Number(monthValue.slice(5, 7)) + ' 月</b><button type="button" data-picker-month-next aria-label="下个月">›</button><button type="button" data-picker-year-next aria-label="下一年">››</button></div><div class="di-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="di-days" data-picker-days>' + pickerCalendarDays(monthValue, selectedDate, field.minDate || "", field.maxDate || "") + '</div></div>' + timePanel + '<div class="di-picker-footer"><button type="button" data-picker-cancel>取消</button><button type="button" data-picker-confirm>确定</button></div></div></div>';
  }
  const ORGANIZATION_TYPES = Object.freeze({
    HEAD_OFFICE: "304901",
    HEAD_OFFICE_DEPARTMENT: "304902",
    BRANCH: "304903",
    BRANCH_DEPARTMENT: "304904",
    SUBBRANCH: "304905"
  });
  const BUSINESS_HIERARCHY_DICTIONARIES = new Set(["institutionTree", "departmentTree", "businessUnitTree"]);
  let organizationTreeCache = null;
  let userOrganizationTreeCache = null;
  let institutionTreeCache = null;
  let departmentTreeCache = null;
  let businessUnitTreeCache = null;

  function activeOrganizationRecords() {
    return (PROTOTYPE_CONFIG.organizationTree?.organizations || []).filter(record => record.status !== "停用");
  }

  function organizationHierarchyTree() {
    if (organizationTreeCache) return organizationTreeCache;
    const records = activeOrganizationRecords();
    const recordById = new Map(records.map(record => [record.id, record]));
    const childrenByParent = new Map();
    const depthById = new Map();
    records.forEach(record => {
      if (!childrenByParent.has(record.parentId)) childrenByParent.set(record.parentId, []);
      childrenByParent.get(record.parentId).push(record);
    });
    function recordDepth(record) {
      if (depthById.has(record.id)) return depthById.get(record.id);
      const parent = recordById.get(record.parentId);
      const depth = parent ? recordDepth(parent) + 1 : 0;
      depthById.set(record.id, depth);
      return depth;
    }
    organizationTreeCache = records.filter(record => recordDepth(record) === 2).map(organization => ({
      label: organization.name,
      children: (childrenByParent.get(organization.id) || []).map(unit => ({
        label: unit.name,
        children: (childrenByParent.get(unit.id) || []).map(record => ({ label: record.name }))
      }))
    })).filter(organization => organization.children.length);
    return organizationTreeCache;
  }

  function userOrganizationHierarchyTree() {
    if (userOrganizationTreeCache) return userOrganizationTreeCache;
    const baseTree = deepClone(organizationHierarchyTree());
    if (!baseTree.some(node => node.label === "客服中心")) baseTree.push({ label:"客服中心" });
    userOrganizationTreeCache = baseTree;
    return userOrganizationTreeCache;
  }

  // 总行角色可选全辖机构；分行角色只选择本分行及其下辖机构。
  function roleScopedInstitutionTree() {
    const institution = currentRoleProfile().institutionLabel || "总行";
    const tree = institutionHierarchyTree();
    if (institution === "总行") return tree;
    return tree.filter(node => node.label === institution || (node.children || []).some(child => child.label === institution));
  }

  function institutionHierarchyTree() {
    if (institutionTreeCache) return institutionTreeCache;
    const records = activeOrganizationRecords();
    const headOffice = records.find(record => record.type === ORGANIZATION_TYPES.HEAD_OFFICE && record.name === "总行");
    const branches = records.filter(record => record.type === ORGANIZATION_TYPES.BRANCH);
    const subbranchesByParent = new Map();
    records.filter(record => record.type === ORGANIZATION_TYPES.SUBBRANCH).forEach(record => {
      if (!subbranchesByParent.has(record.parentId)) subbranchesByParent.set(record.parentId, []);
      subbranchesByParent.get(record.parentId).push(record);
    });
    institutionTreeCache = [
      ...(headOffice ? [{ label: headOffice.name, children: [{ label:headOffice.name }] }] : []),
      ...branches.map(branch => ({
        label: branch.name,
        children: [
          { label:branch.name },
          ...(subbranchesByParent.get(branch.id) || []).map(record => ({ label:record.name }))
        ]
      }))
    ];
    return institutionTreeCache;
  }

  function qualifiedDepartmentName(institution, department) {
    const owner = String(institution || "总行").split(" / ").pop();
    const name = String(department || "");
    if (!name || name.startsWith(owner)) return name;
    return owner + name;
  }

  function departmentHierarchyTree() {
    if (departmentTreeCache) return departmentTreeCache;
    const records = activeOrganizationRecords();
    const headOffice = records.find(record => record.type === ORGANIZATION_TYPES.HEAD_OFFICE && record.name === "总行");
    const branches = records.filter(record => record.type === ORGANIZATION_TYPES.BRANCH);
    const directDepartments = (owner, type) => records
      .filter(record => record.parentId === owner?.id && record.type === type)
      .map(record => ({ label: qualifiedDepartmentName(owner.name, record.name) }));
    departmentTreeCache = [
      ...(headOffice ? [{ label: headOffice.name, children: directDepartments(headOffice, ORGANIZATION_TYPES.HEAD_OFFICE_DEPARTMENT) }] : []),
      ...branches.map(branch => ({ label: branch.name, children: directDepartments(branch, ORGANIZATION_TYPES.BRANCH_DEPARTMENT) }))
    ].filter(group => group.children?.length);
    return departmentTreeCache;
  }

  function flattenBusinessTree(tree) {
    const values = [];
    const seen = new Set();
    const walk = nodes => (nodes || []).forEach(node => {
      if (!seen.has(node.label)) {
        seen.add(node.label);
        values.push({ label: node.label });
      }
      walk(node.children || []);
    });
    walk(tree);
    return values;
  }

  function businessUnitHierarchyTree() {
    if (businessUnitTreeCache) return businessUnitTreeCache;
    const departmentsByOwner = new Map(departmentHierarchyTree().map(group => [group.label, group.children || []]));
    businessUnitTreeCache = institutionHierarchyTree().map(group => ({
      label: group.label,
      children: [
        ...((group.children || []).slice(0, 1)).map(node => ({ label:node.label })),
        ...(departmentsByOwner.get(group.label) || []).map(node => ({ label:node.label })),
        ...((group.children || []).slice(1)).map(node => ({ label:node.label }))
      ]
    })).filter(group => group.children.length);
    return businessUnitTreeCache;
  }

  function institutionNameFromBusinessUnit(value) {
    const target = String(value || "").split(" / ").pop();
    if (!target) return "总行";
    const names = flattenBusinessTree(institutionHierarchyTree()).map(node => node.label).sort((left, right) => right.length - left.length);
    return names.find(name => target === name || target.startsWith(name)) || "总行";
  }

  function institutionSelectionDetails(value) {
    const parts = String(value || "").split(" / ").map(part => part.trim()).filter(Boolean);
    const owner = parts[0] || "";
    const institution = parts.at(-1) || "";
    return { path:parts.join(" / "), owner, institution, isSubbranch:Boolean(owner && institution && owner !== institution) || activeOrganizationRecords().some(record => record.name === institution && record.type === ORGANIZATION_TYPES.SUBBRANCH) };
  }

  function institutionDisplayName(value) {
    return institutionSelectionDetails(value).institution || "-";
  }

  function hrUsersForInstitution(value) {
    const selection = institutionSelectionDetails(value);
    if (!selection.institution) return [];
    const organization = activeOrganizationRecords().find(record => record.name === selection.institution);
    if (!organization) return [];
    return (window.XIB_ADMIN_USERS_DATA?.users || [])
      .filter(user => user.user_status === "1" && user.hr_user_status === "在职")
      .filter(user => organization.type === ORGANIZATION_TYPES.SUBBRANCH
        ? [user.office_code, user.loaned_office_code].includes(organization.id)
        : [user.org_code, user.loaned_org_code].includes(organization.id))
      .slice()
      .sort((left, right) => String(left.user_name || "").localeCompare(String(right.user_name || ""), "zh-CN"))
      .map(user => user.user_name + "-" + user.user_empno);
  }

  function hrUsersForDepartment(institutionValue, departmentValue) {
    const department = String(departmentValue || "").trim();
    if (!department) return [];
    if (department === "-") return hrUsersForInstitution(institutionValue);
    const selection = institutionSelectionDetails(institutionValue);
    const records = activeOrganizationRecords();
    const departmentRecord = records.find(record => {
      if (![ORGANIZATION_TYPES.HEAD_OFFICE_DEPARTMENT, ORGANIZATION_TYPES.BRANCH_DEPARTMENT].includes(record.type)) return false;
      return record.name === department || qualifiedDepartmentName(selection.owner, record.name) === department;
    });
    if (!departmentRecord) return [];
    return (window.XIB_ADMIN_USERS_DATA?.users || [])
      .filter(user => user.user_status === "1" && user.hr_user_status === "在职")
      .filter(user => [user.dept_code, user.loaned_dept_code].includes(departmentRecord.id))
      .slice()
      .sort((left, right) => String(left.user_name || "").localeCompare(String(right.user_name || ""), "zh-CN"))
      .map(user => user.user_name + "-" + user.user_empno);
  }

  function subprocessHandlersForInstitution(value) {
    const selection = institutionSelectionDetails(value);
    if (!selection.institution) return [];
    const organization = activeOrganizationRecords().find(record => record.name === selection.institution);
    if (!organization) return [];
    const users = (window.XIB_ADMIN_USERS_DATA?.users || [])
      .filter(user => user.user_status === "1" && user.hr_user_status === "在职")
      .filter(user => organization.type === ORGANIZATION_TYPES.SUBBRANCH
        ? [user.office_code, user.loaned_office_code].includes(organization.id)
        : [user.org_code, user.loaned_org_code].includes(organization.id))
      .filter(user => /处理员|处理岗/.test(String(user.job_title || "") + String(user.position || "")))
      .slice()
      .sort((left, right) => String(left.user_name || "").localeCompare(String(right.user_name || ""), "zh-CN"))
      .map(user => user.user_name + "-" + user.user_empno);
    return users;
  }

  function complaintObjectOptions(institutionValue) {
    return ["-", ...hrUsersForInstitution(institutionValue)];
  }

  function departmentOptionsForInstitution(value, rules = {}) {
    const selection = institutionSelectionDetails(value);
    if (!selection.owner) return [];
    if (selection.isSubbranch) return rules.emptyForSubbranch ? [] : ["-"];
    const group = departmentHierarchyTree().find(item => item.label === selection.owner);
    const allowedNames = rules.departmentNameIncludes || [];
    return (group?.children || []).map(item => item.label)
      .filter(name => !allowedNames.length || allowedNames.some(keyword => name.includes(keyword)));
  }

  function dispatchDepartmentOptions(value) {
    const field = formSections.flatMap(section => section.fields || []).find(item => item.name === "派发部门");
    return ["-", ...new Set(departmentOptionsForInstitution(value, field?.optionsByInstitution || {}).filter(option => option !== "-"))];
  }

  function ticketDispatchCcCreatorEligible() {
    return ["head-consumer", "customer-service"].includes(currentRoleProfile().org);
  }

  function ticketDispatchCopyRecipients() {
    if (!ticketDispatchCcCreatorEligible()) return [];
    const selection = institutionSelectionDetails(state.formValues["派发机构"] || "");
    const department = String(state.formValues["派发部门"] || "");
    const branchPuhuiTarget = Boolean(selection.owner && selection.owner !== "总行" && !selection.isSubbranch && department.includes("普惠"));
    if (!selection.isSubbranch && !branchPuhuiTarget) return [];
    if (!selection.owner || selection.owner === "总行") return [];
    const records = activeOrganizationRecords();
    const branch = records.find(record => record.type === ORGANIZATION_TYPES.BRANCH && record.name === selection.owner);
    const consumerDepartment = records.find(record => record.parentId === branch?.id && record.type === ORGANIZATION_TYPES.BRANCH_DEPARTMENT && record.name.includes("消费者权益保护"));
    if (!consumerDepartment) return [];
    return (window.XIB_ADMIN_USERS_DATA?.users || [])
      .filter(user => user.user_status === "1" && user.hr_user_status === "在职" && user.job_title === "业务员" && user.dept_code === consumerDepartment.id)
      .map(user => user.user_name + "-" + user.user_empno);
  }

  function syncTicketDispatchCopyRecipients(scope = document) {
    const recipients = ticketDispatchCopyRecipients();
    state.formValues["抄送人"] = [...recipients];
    const root = scope?.querySelector ? scope : document;
    const input = root.querySelector('[data-auto-dispatch-cc][data-field-key="抄送人"]') || document.querySelector('[data-auto-dispatch-cc][data-field-key="抄送人"]');
    if (!input) return;
    input.closest(".form-item")?.querySelector(".form-label")?.classList.toggle("required", recipients.length > 0);
    input.value = recipients.length ? recipients.join("、") : "-";
  }

  function renderInstitutionDepartmentControl(id, key, sourceKey, disabled = false, placeholder = "请选择部门", rules = {}) {
    const sourceValue = state.formValues[sourceKey] || "";
    const isDispatchDepartment = key.split(".").pop() === "派发部门";
    const options = isDispatchDepartment ? dispatchDepartmentOptions(sourceValue) : departmentOptionsForInstitution(sourceValue, rules);
    const branchLocked = institutionSelectionDetails(sourceValue).isSubbranch;
    const blankSubbranch = branchLocked && rules.emptyForSubbranch && !isDispatchDepartment;
    let selected = state.formValues[key] || "";
    if (branchLocked) selected = blankSubbranch ? "" : "-";
    else if (!options.includes(selected)) selected = "";
    state.formValues[key] = selected;
    const controlDisabled = disabled || !sourceValue || branchLocked;
    const emptyLabel = blankSubbranch ? "" : state.page === "ticket-form" && AI_WAITING_FIELD_NAMES.has(key) ? "请选择" : sourceValue ? placeholder : "请先选择机构";
    return '<select class="di-native-select is-fluid" id="' + escapeAttribute(id) + '" data-field-key="' + escapeAttribute(key) + '" data-institution-department data-empty-display="' + Boolean(blankSubbranch) + '" data-institution-source-key="' + escapeAttribute(sourceKey) + '" data-institution-department-rules="' + escapeAttribute(JSON.stringify(rules)) + '" data-placeholder="' + escapeAttribute(placeholder) + '" ' + (controlDisabled ? 'disabled' : '') + '><option value="">' + escapeAttribute(emptyLabel) + '</option>' + options.map(option => '<option value="' + escapeAttribute(option) + '" ' + (option === selected ? 'selected' : '') + '>' + escapeAttribute(option) + '</option>').join("") + '</select>';
  }

  function syncInstitutionDepartmentControls(scope = document, sourceKey = "") {
    scope.querySelectorAll("[data-institution-department]").forEach(control => {
      if (sourceKey && control.dataset.institutionSourceKey !== sourceKey) return;
      const departmentKey = control.dataset.fieldKey;
      const sourceValue = state.formValues[control.dataset.institutionSourceKey] || "";
      const rules = JSON.parse(control.dataset.institutionDepartmentRules || "{}");
      const isDispatchDepartment = departmentKey.split(".").pop() === "派发部门";
      const options = isDispatchDepartment ? dispatchDepartmentOptions(sourceValue) : departmentOptionsForInstitution(sourceValue, rules);
      const branchLocked = institutionSelectionDetails(sourceValue).isSubbranch;
      const blankSubbranch = branchLocked && rules.emptyForSubbranch && !isDispatchDepartment;
      let selected = state.formValues[departmentKey] || "";
      if (branchLocked) selected = blankSubbranch ? "" : "-";
      else if (!options.includes(selected)) selected = "";
      state.formValues[departmentKey] = selected;
      const emptyLabel = blankSubbranch ? "" : state.page === "ticket-form" && AI_WAITING_FIELD_NAMES.has(departmentKey) ? "请选择" : sourceValue ? (control.dataset.placeholder || "请选择部门") : "请先选择机构";
      control.innerHTML = '<option value="">' + escapeAttribute(emptyLabel) + '</option>' + options.map(option => '<option value="' + escapeAttribute(option) + '" ' + (option === selected ? 'selected' : '') + '>' + escapeAttribute(option) + '</option>').join("");
      control.value = selected;
      control.disabled = !sourceValue || branchLocked;
      control.dataset.emptyDisplay = String(Boolean(blankSubbranch));
      if (rules.emptyForSubbranch) {
        control.closest(".form-item")?.querySelector(".form-label")?.classList.toggle("required", !branchLocked && Boolean(schemaFieldByName(departmentKey.split(".").pop())?.required));
      }
      syncEnhancedNativeSelect(control);
    });
    syncCountersignPersonControls(scope, sourceKey);
    syncCountersignDepartmentControls(scope, sourceKey);
    if (!sourceKey) syncTicketDispatchCopyRecipients(scope);
    else if (sourceKey === "派发机构") setTimeout(() => syncTicketDispatchCopyRecipients(scope), 50);
  }

  function countersignInstitutionPaths(value) {
    return Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []);
  }

  function countersignPersonOptions(selectedOrgs) {
    const selected = countersignInstitutionPaths(selectedOrgs);
    if (!selected.length) return ["请先选择会签机构"];
    return selected.flatMap(path => {
      const parts = String(path).split(" / ").filter(Boolean);
      const org = parts[0] || "未选机构";
      const unit = parts[1] || org;
      return [unit + "负责人", unit + "经办人"];
    });
  }

  function countersignDepartmentEntries(selectedOrgs) {
    const selected = countersignInstitutionPaths(selectedOrgs);
    return selected.flatMap(path => {
      const departments = departmentOptionsForInstitution(path);
      const institution = institutionSelectionDetails(path).institution || path;
      if (!departments.length) return [{ value: path + " / -", label: institution + " / -" }];
      return departments.map(department => ({ value: path + " / " + department, label: institution + " / " + department }));
    });
  }

  function countersignDepartmentValues(selectedOrgs, current = []) {
    const entries = countersignDepartmentEntries(selectedOrgs);
    const valid = (Array.isArray(current) ? current : [current]).filter(value => entries.some(entry => entry.value === value));
    if (valid.length) return valid;
    return countersignInstitutionPaths(selectedOrgs).map(path => entries.find(entry => entry.value.startsWith(path + " / "))?.value).filter(Boolean);
  }

  function renderCountersignDepartmentSelect(field, key, scope, disabled) {
    const institutionKey = scope + ".会签机构";
    const entries = countersignDepartmentEntries(state.formValues[institutionKey]);
    const selected = countersignDepartmentValues(state.formValues[institutionKey], state.formValues[key]);
    state.formValues[key] = selected;
    const waitingForInstitution = !entries.length;
    const selectedLabels = selected.map(value => entries.find(entry => entry.value === value)?.label || value);
    const summary = waitingForInstitution ? countersignTriggerValues([], [], "请先选择会签机构") : countersignTriggerValues(selected, selectedLabels, "请选择会签部门");
    return '<div class="di-native-select-shell is-fluid countersign-department-picker" data-countersign-department-select data-field-key="' + escapeAttribute(key) + '" data-countersign-institution-key="' + escapeAttribute(institutionKey) + '"><button type="button" class="di-select is-fluid di-select-trigger di-native-select-trigger" data-countersign-department-trigger ' + (disabled || waitingForInstitution ? 'disabled' : '') + '><span class="countersign-value-summary">' + summary + '</span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><div class="di-select-popover di-native-select-popover countersign-department-popover" data-countersign-department-menu hidden>' + (waitingForInstitution ? '<div class="countersign-department-empty">请先选择会签机构</div>' : entries.map(entry => '<label class="countersign-department-option"><input type="checkbox" value="' + escapeAttribute(entry.value) + '" ' + (selected.includes(entry.value) ? 'checked' : '') + '><span>' + escapeAttribute(entry.label) + '</span></label>').join("")) + '</div><input type="hidden" data-field-key="' + escapeAttribute(key) + '" value="' + escapeAttribute(selected.join(",")) + '" ' + (disabled || waitingForInstitution ? 'disabled' : '') + '></div>';
  }

  function syncCountersignDepartmentControls(scope = document, sourceKey = "") {
    const root = scope?.querySelectorAll ? scope : document;
    root.querySelectorAll("[data-countersign-department-select]").forEach(control => {
      if (sourceKey && sourceKey !== control.dataset.countersignInstitutionKey) return;
      const entries = countersignDepartmentEntries(state.formValues[control.dataset.countersignInstitutionKey]);
      const selected = countersignDepartmentValues(state.formValues[control.dataset.countersignInstitutionKey], state.formValues[control.dataset.fieldKey]);
      state.formValues[control.dataset.fieldKey] = selected;
      const menu = control.querySelector("[data-countersign-department-menu]");
      const hidden = control.querySelector('input[type="hidden"]');
      const trigger = control.querySelector("[data-countersign-department-trigger]");
      if (menu) menu.innerHTML = entries.length ? entries.map(entry => '<label class="countersign-department-option"><input type="checkbox" value="' + escapeAttribute(entry.value) + '" ' + (selected.includes(entry.value) ? 'checked' : '') + '><span>' + escapeAttribute(entry.label) + '</span></label>').join("") : '<div class="countersign-department-empty">请先选择会签机构</div>';
      if (hidden) { hidden.value = selected.join(","); hidden.disabled = !entries.length; }
      if (trigger) {
        trigger.disabled = !entries.length;
        const labels = selected.map(value => entries.find(entry => entry.value === value)?.label || value);
        trigger.querySelector("span").innerHTML = entries.length ? countersignTriggerValues(selected, labels, "请选择会签部门") : countersignTriggerValues([], [], "请先选择会签机构");
      }
    });
  }

  function renderCountersignPersonSelect(field, key, scope, disabled) {
    const institutionKey = scope + ".会签机构";
    const options = countersignPersonOptions(state.formValues[institutionKey]);
    const waitingForInstitution = options[0] === "请先选择会签机构";
    const selected = options.includes(state.formValues[key]) ? state.formValues[key] : (waitingForInstitution ? "" : options[0]);
    state.formValues[key] = selected;
    return '<select class="di-native-select is-fluid" data-field-key="' + escapeAttribute(key) + '" data-countersign-person-select data-countersign-institution-key="' + escapeAttribute(institutionKey) + '" ' + (disabled ? 'disabled' : '') + '>' + (waitingForInstitution ? '<option value="">请先选择会签机构</option>' : options.map(option => '<option value="' + escapeAttribute(option) + '" ' + (option === selected ? 'selected' : '') + '>' + escapeAttribute(option) + '</option>').join("")) + '</select>';
  }

  function syncCountersignPersonControls(scope = document, sourceKey = "") {
    const root = scope?.querySelectorAll ? scope : document;
    root.querySelectorAll("[data-countersign-person-select]").forEach(control => {
      if (sourceKey && sourceKey !== control.dataset.countersignInstitutionKey) return;
      const options = countersignPersonOptions(state.formValues[control.dataset.countersignInstitutionKey]);
      const previous = state.formValues[control.dataset.fieldKey] || "";
      const waitingForInstitution = options[0] === "请先选择会签机构";
      const selected = options.includes(previous) ? previous : (waitingForInstitution ? "" : options[0]);
      state.formValues[control.dataset.fieldKey] = selected;
      control.innerHTML = waitingForInstitution ? '<option value="">请先选择会签机构</option>' : options.map(option => '<option value="' + escapeAttribute(option) + '" ' + (option === selected ? 'selected' : '') + '>' + escapeAttribute(option) + '</option>').join("");
      control.value = selected;
      syncEnhancedNativeSelect(control);
    });
  }

  function dispatchInstitutionPaths(value) {
    const values = Array.isArray(value) ? value : [value];
    return [...new Set(values.map(item => String(item || "").trim()).filter(Boolean))];
  }


  function dispatchInstitutionLabel(value) {
    return dispatchInstitutionPaths(value).map(path => hierarchySelectionLabel(path, "institutionTree")).join("、");
  }


  function hierarchyTreeFor(dictionary) {
    if (dictionary === "organizationTree") return organizationHierarchyTree();
    if (dictionary === "userOrganizationTree") return userOrganizationHierarchyTree();
    if (dictionary === "institutionTree") return institutionHierarchyTree();
    if (dictionary === "roleInstitutionTree") return roleScopedInstitutionTree();
    if (dictionary === "branchInstitutionTree") return institutionHierarchyTree().map(node => ({ label:node.label }));
    if (String(dictionary || "").startsWith("deptPeople|")) {
      const [, institutionKey, departmentKey] = String(dictionary).split("|");
      return hrUsersForDepartment(state.formValues[institutionKey], state.formValues[departmentKey]).map(label => ({ label }));
    }
    if (dictionary === "departmentTree") return departmentHierarchyTree();
    if (dictionary === "businessUnitTree") return businessUnitHierarchyTree();
    if (PROTOTYPE_CONFIG.tagTrees?.[dictionary]?.tree) return PROTOTYPE_CONFIG.tagTrees[dictionary].tree;
    return rectificationHierarchyField(dictionary)?.tree || [];
  }

  function tagTreeLeafOptions(dictionary) {
    const tree = PROTOTYPE_CONFIG.tagTrees?.[dictionary]?.tree || [];
    const leaves = [];
    const walk = (nodes, prefix) => nodes.forEach(node => {
      const path = prefix ? prefix + " / " + node.label : node.label;
      if (node.children && node.children.length) walk(node.children, path);
      else leaves.push(path);
    });
    walk(tree, "");
    return leaves;
  }

  function positionHierarchyPopover(trigger, popover) {
    positionAnchoredPopover(trigger, popover, { flipVertical: true });
  }

  const topLayerPopoverAnchors = new WeakMap();
  let topLayerPopoverViewportBound = false;

  function hideTopLayerPopover(popover) {
    if (!popover?.matches?.(":popover-open")) return;
    try { popover.hidePopover(); } catch (_) {}
  }

  function anchorTopLayerPopover(trigger, popover, options = {}) {
    if (!trigger?.isConnected || !popover?.isConnected || popover.hidden || !popover.matches(":popover-open")) return;
    const triggerRect = trigger.getBoundingClientRect();
    const naturalWidth = Number(popover.dataset.anchorNaturalWidth || 0);
    const width = Math.min(Math.max(triggerRect.width, naturalWidth), Math.max(0, window.innerWidth - 16));
    popover.style.width = width + "px";
    popover.style.maxHeight = "";
    const popoverRect = popover.getBoundingClientRect();
    const gap = Number(popover.dataset.anchorGap || 0);
    const left = Math.min(window.innerWidth - popoverRect.width - 8, Math.max(8, triggerRect.left));
    const belowTop = triggerRect.bottom + gap;
    const availableBelow = Math.max(0, window.innerHeight - belowTop - 8);
    const availableAbove = Math.max(0, triggerRect.top - gap - 8);
    const placeAbove = options.flipVertical && popoverRect.height > availableBelow && popoverRect.height <= availableAbove;
    const top = placeAbove ? triggerRect.top - popoverRect.height - gap : belowTop;
    popover.style.left = left + "px";
    popover.style.top = Math.max(8, top) + "px";
    if (!placeAbove && popoverRect.height > availableBelow) popover.style.maxHeight = availableBelow + "px";
  }

  function bindTopLayerPopoverViewport() {
    if (topLayerPopoverViewportBound) return;
    topLayerPopoverViewportBound = true;
    const reposition = () => document.querySelectorAll(".is-modal-top-layer:popover-open").forEach(popover => {
      const anchor = topLayerPopoverAnchors.get(popover);
      if (anchor) anchorTopLayerPopover(anchor.trigger, popover, anchor.options);
    });
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
  }

  function promoteModalPopover(trigger, popover, options = {}) {
    if (!trigger?.closest(".modal") || typeof popover?.showPopover !== "function") return false;
    if (!popover.hasAttribute("popover")) {
      const naturalRect = popover.getBoundingClientRect();
      const host = trigger.parentElement;
      const triggerBottom = trigger.offsetTop + trigger.offsetHeight;
      const originalTop = popover.offsetParent === host ? popover.offsetTop : triggerBottom;
      popover.dataset.anchorGap = String(Math.max(0, originalTop - triggerBottom));
      popover.dataset.anchorNaturalWidth = String(naturalRect.width || trigger.getBoundingClientRect().width);
      popover.setAttribute("popover", "manual");
      new MutationObserver(() => { if (popover.hidden) hideTopLayerPopover(popover); }).observe(popover, { attributes: true, attributeFilter: ["hidden"] });
    }
    popover.classList.add("is-modal-top-layer");
    if (!popover.matches(":popover-open")) {
      try { popover.showPopover(); } catch (_) { return false; }
    }
    topLayerPopoverAnchors.set(popover, { trigger, options });
    bindTopLayerPopoverViewport();
    anchorTopLayerPopover(trigger, popover, options);
    return true;
  }

  function positionAnchoredPopover(trigger, popover, options = {}) {
    popover.style.left = "";
    popover.style.right = "";
    popover.style.top = "";
    popover.style.bottom = "";
    requestAnimationFrame(() => {
      if (promoteModalPopover(trigger, popover, options)) return;
      hideTopLayerPopover(popover);
      popover.classList.remove("is-modal-top-layer");
      popover.style.width = "";
      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      if (triggerRect.left + popoverRect.width > window.innerWidth - 8) {
        popover.style.left = "auto";
        popover.style.right = "0";
      }
      const positionedRect = popover.getBoundingClientRect();
      if (positionedRect.left < 8) {
        popover.style.right = "auto";
        popover.style.left = (8 - triggerRect.left) + "px";
      }
      if (options.flipVertical && positionedRect.bottom > window.innerHeight - 8 && triggerRect.top > popoverRect.height + 8) {
        popover.style.top = "auto";
        popover.style.bottom = "calc(100% + 8px)";
      }
    });
  }

  function rectificationHierarchyField(dictionary) {
    const configuredTree = PROTOTYPE_CONFIG.tagTrees?.[dictionary]?.tree || [];
    const withConfiguredTree = field => configuredTree.length ? { ...field, tree: configuredTree } : field;
    const processingField = PROCESSING_FIELDS.find(field => field.dictionary === dictionary);
    if (processingField) return BUSINESS_HIERARCHY_DICTIONARIES.has(dictionary) || dictionary === "organizationTree" ? { ...processingField, tree: hierarchyTreeFor(dictionary) } : withConfiguredTree(processingField);
    for (const sections of Object.values(SUBPROCESS_FIELD_SECTIONS)) {
      for (const section of sections || []) {
        const field = section.fields.find(item => item.dictionary === dictionary);
        if (field) return withConfiguredTree(field);
      }
    }
    return null;
  }

  function hierarchyNode(tree, path) {
    let nodes = tree || [];
    let node = null;
    for (const label of path) {
      node = nodes.find(item => item.label === label);
      if (!node) return null;
      nodes = node.children || [];
    }
    return node;
  }

  function hierarchyInitialPath(field, selected) {
    const selectedValue = Array.isArray(selected) ? selected[0] : selected;
    if (selectedValue) return String(selectedValue).split(" / ");
    const path = [];
    let nodes = field?.tree || [];
    for (let level = 0; level < Math.max(1, Number(field?.leafLevel || 1)); level += 1) {
      if (!nodes.length) break;
      path.push(nodes[0].label);
      nodes = nodes[0].children || [];
    }
    return path;
  }

  function hierarchySelectionLabel(value, dictionary = "") {
    const parts = String(value || "").split(" / ").filter(Boolean);
    if (BUSINESS_HIERARCHY_DICTIONARIES.has(dictionary)) return parts.at(-1) || "";
    return parts.join(" / ");
  }

  function tagPathDisplay(value) {
    return String(value || "").split(" / ").filter(Boolean).join(" → ");
  }

  function hierarchyDescendantGroupValue(parentLabel) {
    return parentLabel + " / " + parentLabel + "及其下辖所有支行";
  }

  function hierarchyBranchLeafValues(field, parentLabel) {
    const parent = (field?.tree || []).find(node => node.label === parentLabel);
    return (parent?.children || []).map(node => parentLabel + " / " + node.label);
  }

  function hierarchyValueSelected(field, selected, value) {
    if (selected.includes(value)) return true;
    if (field?.dictionary !== "institutionTree" || !field.includeDescendantsOption) return false;
    const parentLabel = String(value || "").split(" / ")[0];
    return selected.includes(hierarchyDescendantGroupValue(parentLabel));
  }

  function normalizeHierarchySelection(field, values) {
    let normalized = [...new Set((values || []).filter(Boolean))];
    if (field?.dictionary !== "institutionTree" || !field.includeDescendantsOption || !field.multiple) return normalized;
    (field.tree || []).filter(node => node.label !== "总行").forEach(node => {
      const leafValues = hierarchyBranchLeafValues(field, node.label);
      const groupValue = hierarchyDescendantGroupValue(node.label);
      if (leafValues.length && (normalized.includes(groupValue) || leafValues.every(value => normalized.includes(value)))) {
        normalized = normalized.filter(value => value !== groupValue && !leafValues.includes(value));
        normalized.push(groupValue);
      }
    });
    return normalized;
  }

  function toggleHierarchySelection(field, selected, value) {
    if (!field?.multiple) return [value];
    const parentLabel = String(value || "").split(" / ")[0];
    const groupValue = hierarchyDescendantGroupValue(parentLabel);
    let next = [...selected];
    if (field.dictionary === "institutionTree" && field.includeDescendantsOption && next.includes(groupValue)) {
      next = next.filter(item => item !== groupValue);
      next.push(...hierarchyBranchLeafValues(field, parentLabel));
    }
    next = next.includes(value) ? next.filter(item => item !== value) : [...next, value];
    return normalizeHierarchySelection(field, next);
  }

  function hierarchySelectionCount(field, selected) {
    return (selected || []).reduce((count, value) => {
      const parentLabel = String(value || "").split(" / ")[0];
      return count + (value === hierarchyDescendantGroupValue(parentLabel) ? Math.max(1, hierarchyBranchLeafValues(field, parentLabel).length) : 1);
    }, 0);
  }

  function countersignTriggerValues(values, labels, placeholder) {
    const items = (values || []).map((value, index) => labels?.[index] || value).filter(Boolean);
    if (!items.length) return '<span class="countersign-value-placeholder">' + escapeAttribute(placeholder || "请选择") + '</span>';
    return items.map(value => '<span class="countersign-value-chip" title="' + escapeAttribute(value) + '">' + escapeAttribute(value) + '</span>').join('');
  }

  function hierarchyCollapsedSummary(field, selected) {
    if (!selected.length) return field?.placeholder || "请选择";
    if (field?.multiple && field.showSelectedSummary) return selected.map(value => hierarchySelectionLabel(value, field.dictionary)).join("、");
    if (field?.multiple) return "已选 " + hierarchySelectionCount(field, selected) + " 项";
    const label = hierarchySelectionLabel(selected[0], field?.dictionary);
    const summaryLevels = Number(field?.summaryLevels || 0);
    return summaryLevels > 0 ? label.split(/\s*\/\s*/).slice(0, summaryLevels).join(" / ") : label;
  }

  function aiTagSlotLabel(value, index, generated) {
    return '<span class="ai-tag-slot-pill' + (value && generated ? ' is-ai-generated' : '') + '">' + escapeAttribute(value ? tagPathDisplay(value) : '请选择') + '</span>';
  }

  function renderAiTagEditorControl(id, field, key, disabled) {
    const stored = state.formValues[key];
    const values = (Array.isArray(stored) ? stored : (stored ? [stored] : [])).slice(0, 3);
    const count = Math.min(3, Math.max(1, state.aiTagSlotCounts[key] || values.length));
    const slots = Array.from({ length: count }, (_, index) => '<span class="ai-tag-editor-item' + (!values[index] ? ' is-empty' : '') + '"><button type="button" class="ai-tag-chip" data-ai-tag-edit="' + index + '" aria-label="编辑第' + (index + 1) + '个' + escapeAttribute(field.name) + '" ' + (disabled ? 'disabled' : '') + '>' + aiTagSlotLabel(values[index], index, state.aiTagProvenance[key]?.[index]) + '</button>' + (values[index] && !disabled ? '<span class="ai-tag-order-actions"><button type="button" data-ai-tag-move="' + index + '" data-direction="up" aria-label="将第' + (index + 1) + '个标签前移" ' + (index === 0 ? 'disabled' : '') + '>↑</button><button type="button" data-ai-tag-move="' + index + '" data-direction="down" aria-label="将第' + (index + 1) + '个标签后移" ' + (index === values.length - 1 ? 'disabled' : '') + '>↓</button></span><button type="button" class="ai-tag-editor-remove" data-ai-tag-remove="' + index + '" aria-label="删除第' + (index + 1) + '个' + escapeAttribute(field.name) + '">×</button>' : '') + '<input type="hidden" id="' + id + (index ? '-' + index : '') + '" data-field-key="' + escapeAttribute(index ? key + '.__aiTag' + index : key) + '" value="' + escapeAttribute(values[index] || '') + '"></span>').join('');
    const addDisabled = disabled || values.length >= 3;
    return '<div class="ai-tag-editor" data-app-ai-tag-editor data-field-key="' + escapeAttribute(key) + '" data-dictionary="' + escapeAttribute(field.dictionary) + '" data-leaf-level="' + Number(field.leafLevel || field.levels?.length || 1) + '" data-levels="' + escapeAttribute(JSON.stringify(field.levels || [])) + '"><button type="button" class="ai-tag-add ai-tag-main-trigger" data-ai-tag-main-edit="' + values.length + '" aria-label="添加' + escapeAttribute(field.name) + '" ' + (addDisabled ? 'disabled' : '') + '>＋</button><div class="ai-tag-slot-list">' + slots + '</div><div class="ai-tag-shared-panel" hidden><div class="ai-tag-panel-head"><strong data-ai-tag-panel-title></strong><button type="button" class="icon-btn" data-ai-tag-panel-close aria-label="关闭标签选择面板">×</button></div><div class="risk-tag-cascader is-level-' + Number(field.leafLevel || field.levels?.length || 1) + '" data-ai-tag-columns></div></div></div>';
  }

  function renderAiTagRecommendationBox(field, values) {
    if (!state.aiClassificationReady || !values?.length) return "";
    const enumPaths = [];
    const collect = (nodes, prefix = []) => (nodes || []).forEach(node => {
      const path = [...prefix, node.label];
      if (node.children?.length) collect(node.children, path);
      else enumPaths.push(path.join(" / "));
    });
    collect(field.tree || hierarchyTreeFor(field.dictionary));
    const recommended = [...new Set(values.filter(value => enumPaths.includes(value)))];
    const recommendationParents = new Set(recommended.map(value => value.split(" / ").slice(0, -1).join(" / ")));
    const related = enumPaths.filter(value => !recommended.includes(value) && recommendationParents.has(value.split(" / ").slice(0, -1).join(" / ")));
    const displayValues = [...related.slice(0, 1), ...recommended].slice(0, 4);
    const selected = new Set(Array.isArray(state.formValues[field.name]) ? state.formValues[field.name] : (state.formValues[field.name] ? [state.formValues[field.name]] : []));
    const lines = displayValues.map(value => '<button type="button" class="ai-tag-quick-option ' + (selected.has(value) ? 'ai-tag-path-recommendation' : 'ai-tag-path-context') + '" data-ai-tag-quick-add="' + escapeAttribute(field.name) + '" data-ai-tag-quick-value="' + escapeAttribute(value) + '">' + escapeAttribute(hierarchySelectionLabel(value, field.dictionary) || value) + '</button>').join("");
    return '<div class="ai-tag-recommendation-title">' + icon("ai") + '<span>AI 智能打标推荐</span></div><div class="ai-tag-recommendation-box" aria-label="AI 智能打标推荐路径">' + lines + '</div>';
  }

  function hierarchySearchResultsHtml(field, query, selected) {
    const needle = filterNormalizedText(query);
    if (!needle) return "";
    const paths = [];
    const leafLevel = Number(field?.leafLevel || field?.levels?.length || 1);
    const walk = (nodes, prefix, level) => (nodes || []).forEach(node => {
      const current = [...prefix, node.label];
      if (level >= leafLevel - 1 || !(node.children || []).length) paths.push(current);
      else walk(node.children, current, level + 1);
    });
    walk(field?.tree || [], [], 0);
    const matches = paths.filter(path => filterNormalizedText(path.join(" ")).includes(needle));
    if (!matches.length) return '<div class="hierarchy-search-empty">未找到匹配机构</div>';
    return matches.map(path => {
      const value = path.join(" / ");
      const selectedMark = hierarchyValueSelected(field, selected, value);
      return '<button type="button" class="hierarchy-search-option ' + (selectedMark ? 'is-selected' : '') + '" data-hierarchy-search-toggle="' + escapeAttribute(value) + '" aria-pressed="' + selectedMark + '"><span><strong>' + escapeAttribute(path.at(-1)) + '</strong><small>' + escapeAttribute(path[0]) + '</small></span><em>' + (selectedMark ? '已选择' : '选择') + '</em></button>';
    }).join("");
  }

  function hierarchySelectedTags(selected, removable = false, dictionary = "") {
    if (!selected.length) return '<span class="risk-tag-empty">尚未选择标签</span>';
    return selected.map(value => {
      const parts = String(value).split(" / ").filter(Boolean);
      const isDescendantGroup = dictionary === "institutionTree" && value === hierarchyDescendantGroupValue(parts[0]);
      const leaf = parts.pop() || "";
      const prefix = BUSINESS_HIERARCHY_DICTIONARIES.has(dictionary) || isDescendantGroup ? "" : parts.join(" / ");
      const structuredLabel = prefix
        ? '<span class="hierarchy-tag-prefix">' + escapeAttribute(prefix) + '</span><span class="hierarchy-tag-separator">/</span><span class="hierarchy-tag-leaf">' + escapeAttribute(leaf) + '</span>'
        : '<span class="hierarchy-tag-leaf">' + escapeAttribute(leaf) + '</span>';
      return '<span class="tag ds-tag is-light is-blue hierarchy-selected-tag ' + (["organizationTree", "institutionTree", "departmentTree", "businessUnitTree"].includes(dictionary) ? 'is-organization-tag' : '') + '" title="' + escapeAttribute(value) + '">' + structuredLabel + (removable ? '<button type="button" data-hierarchy-remove="' + escapeAttribute(value) + '" aria-label="移除' + escapeAttribute(hierarchySelectionLabel(value, dictionary)) + '">×</button>' : '') + '</span>';
    }).join('');
  }

  function hierarchyColumnsHtml(field, activePath, selected) {
    if (!field) return '';
    let nodes = field.tree || [];
    const columns = [];
    const leafLevel = Number(field.leafLevel || field.levels?.length || 1);
    const nonLeaf = Boolean(field.nonLeafSelectable);
    for (let level = 0; level < leafLevel; level += 1) {
      const isLeaf = level === leafLevel - 1;
      const title = field.levels?.[level] || ('第' + (level + 1) + '级');
      let options = nodes.length ? nodes.map(node => {
        const path = activePath.slice(0, level).concat(node.label);
        const value = path.join(' / ');
        const selectedMark = hierarchyValueSelected(field, selected, value);
        const active = activePath[level] === node.label;
        const cls = [active ? 'is-active' : '', selectedMark ? 'is-selected' : '', isLeaf ? 'hierarchy-leaf-option' : ''].filter(Boolean).join(' ');
        return '<button type="button" class="' + cls + '" ' + (isLeaf ? 'data-hierarchy-toggle="' + escapeAttribute(value) + '" aria-pressed="' + selectedMark + '"' : 'data-hierarchy-parent="' + escapeAttribute(node.label) + '" data-hierarchy-level="' + level + '"') + '><span>' + escapeAttribute(node.label) + '</span>' + (isLeaf ? '<small>' + (selectedMark ? '已选择' : '选择') + '</small>' : (nonLeaf ? '<small>' + (selectedMark ? '已选中' : '选中') + '</small>' : '<span>›</span>')) + '</button>';
      }).join('') : '<p class="hierarchy-empty-column">请先选择上一级</p>';
      if (isLeaf && field.includeDescendantsOption && activePath[0] && activePath[0] !== '总行') {
        const groupValue = hierarchyDescendantGroupValue(activePath[0]);
        const groupChecked = selected.includes(groupValue) || hierarchyBranchLeafValues(field, activePath[0]).every(value => selected.includes(value));
        options = '<label class="hierarchy-descendant-option"><input type="checkbox" data-hierarchy-descendants="' + escapeAttribute(activePath[0]) + '" ' + (groupChecked ? 'checked' : '') + '><span>' + escapeAttribute(activePath[0]) + '及其下辖所有支行</span></label>' + options;
      }
      columns.push('<div class="risk-cascade-column"><div class="risk-cascade-title">' + escapeAttribute(title) + '</div>' + options + '</div>');
      const activeNode = nodes.find(node => node.label === activePath[level]);
      nodes = activeNode?.children || [];
    }
    return columns.join('');
  }

  function isCountersignInstitutionKey(key) {
    return /(^|\.)会签机构$/.test(String(key || ""));
  }

  function renderHierarchyCascaderControl(id, field, key, disabled = false) {
    const stored = state.formValues[key];
    const raw = Object.prototype.hasOwnProperty.call(state.formValues, key) ? stored : field.defaultValue;
    const selected = field.multiple ? normalizeHierarchySelection(field, Array.isArray(raw) ? raw : (raw ? [raw] : [])) : (raw ? [raw] : []);
    const activePath = hierarchyInitialPath(field, selected);
    const countersignInstitution = isCountersignInstitutionKey(key);
    const summary = countersignInstitution
      ? countersignTriggerValues(selected, selected.map(value => hierarchySelectionLabel(value, field.dictionary)), field.placeholder || "请选择")
      : escapeAttribute(selected.length ? hierarchyCollapsedSummary(field, selected) : hierarchyCollapsedSummary(field, selected));
    const leafLevel = Number(field.leafLevel || field.levels?.length || 1);
    const nonLeaf = Boolean(field.nonLeafSelectable);
    const hint = nonLeaf ? '单选；可选择任意层级' : (field.multiple ? (field.maxSelections ? '最多选择' + field.maxSelections + '个；请按重要性排序' : '可多选、无数量限制；只能选择末级标签') : '单选；只能选择末级标签');
    const search = field.searchable ? '<div class="di-select-search hierarchy-search"><input type="search" class="di-input is-fluid" data-hierarchy-search placeholder="搜索机构名称" aria-label="搜索机构名称"></div><div class="hierarchy-search-results" data-hierarchy-search-results hidden></div>' : '';
    return '<div class="di-hierarchy-cascader' + (countersignInstitution ? ' countersign-institution-picker' : '') + '" data-app-hierarchy-cascader data-dictionary="' + escapeAttribute(field.dictionary) + '" data-field-key="' + escapeAttribute(key) + '" data-multiple="' + Boolean(field.multiple) + '" data-max-selections="' + (field.maxSelections || '') + '" data-non-leaf="' + nonLeaf + '" data-include-descendants="' + Boolean(field.includeDescendantsOption) + '" data-searchable="' + Boolean(field.searchable) + '" data-show-selected-summary="' + Boolean(field.showSelectedSummary) + '" data-summary-levels="' + Number(field.summaryLevels || 0) + '" data-placeholder="' + escapeAttribute(field.placeholder || "请选择") + '" data-leaf-level="' + leafLevel + '" data-levels="' + escapeAttribute(JSON.stringify(field.levels || [])) + '" data-active-path="' + escapeAttribute(JSON.stringify(activePath)) + '"><button type="button" class="di-select is-fluid di-hierarchy-cascader-trigger" ' + (disabled ? 'disabled' : '') + '><span class="' + (countersignInstitution ? 'countersign-value-summary ' : '') + (state.aiGeneratedFields.has(key) ? 'is-ai-generated' : '') + '">' + summary + '</span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><input type="hidden" id="' + id + '" data-field-key="' + escapeAttribute(key) + '" value="' + escapeAttribute(selected.join(',')) + '" ' + (disabled ? 'disabled' : '') + '><div class="di-hierarchy-cascader-popover" hidden>' + search + '<div class="risk-selected-sticky hierarchy-selected-sticky"><div><strong>当前已选标签</strong><span>' + hint + '</span></div><div class="risk-sticky-tags" data-hierarchy-selected>' + hierarchySelectedTags(selected, !disabled, field.dictionary) + '</div></div><div class="risk-tag-cascader is-level-' + leafLevel + '" data-hierarchy-columns>' + hierarchyColumnsHtml(field, activePath, selected) + '</div><div class="di-multi-cascader-foot"><button type="button" class="btn-link" data-hierarchy-clear>清空</button><button type="button" class="btn xib-btn xib-btn--primary" data-hierarchy-confirm>确定</button></div></div></div>';
  }

  function renderMultiCascaderControl(id, field, key) {
    return renderHierarchyCascaderControl(id, field, key, false);
  }

  function rectificationStatisticsFor(row = null) {
    const record = row ? documentRecordFor("rectification", row) : null;
    if (!state.rectificationStatsFilters) state.rectificationStatsFilters = {};
    const filters = state.rectificationStatsFilters[row?.[0]] || {};
    return window.XIBComplaintRectificationStatistics.createModel({
      row: row ? [...row] : null,
      stored: deepClone(record?.fields?.statistics || {}),
      filters: deepClone(filters)
    });
  }

  function renderRectificationComparisonChart(row = null) {
    return window.XIBComplaintRectificationStatistics.renderComparison(rectificationStatisticsFor(row));
  }

  function renderRectificationTrendChart(row = null) {
    return window.XIBComplaintRectificationStatistics.renderTrend(rectificationStatisticsFor(row));
  }

  function renderRectificationStatisticsTagFilter(row, stats, kind) {
    const isProduct = kind === "product";
    const dictionary = isProduct ? "rectificationProduct" : "rectificationCause";
    const baseField = rectificationHierarchyField(dictionary);
    if (!baseField) return '<div class="rectification-stat-readonly">标签字典加载失败</div>';
    const approvalOnly = rectificationReturnPage() === "rectification-approve";
    const entry = documentRecordFor("rectification", row)?.fields?.entry || {};
    if (approvalOnly && !isProduct) {
      return '<div class="rectification-stat-readonly" data-rectification-statistics-cause-readonly>' + escapeAttribute(entry["投诉原因标签"] || "-") + '</div>';
    }
    const key = 'rectification-statistics-filter.' + row[0] + '.' + kind;
    const associatedProducts = approvalOnly && isProduct && Array.isArray(entry["投诉产品标签"])
      ? [...new Set(entry["投诉产品标签"].filter(Boolean))]
      : [];
    const hasStoredApprovalFilter = approvalOnly && isProduct
      && Object.prototype.hasOwnProperty.call(state.rectificationStatsFilters || {}, row[0]);
    const current = isProduct
      ? (approvalOnly && !hasStoredApprovalFilter ? associatedProducts : stats.selectedProducts)
        .filter(value => !approvalOnly || associatedProducts.includes(value))
      : stats.selectedCause;
    state.formValues[key] = isProduct ? [...current] : current;
    const restrictTreeToPaths = (nodes, paths, prefix = []) => (nodes || []).map(node => {
      const path = [...prefix, node.label];
      const value = path.join(" / ");
      const children = restrictTreeToPaths(node.children || [], paths, path);
      return paths.some(item => item === value || item.startsWith(value + " / "))
        ? { ...node, ...(node.children ? { children } : {}) }
        : null;
    }).filter(Boolean);
    const field = {
      ...baseField,
      multiple: isProduct,
      placeholder: isProduct ? "全部产品标签" : "全部原因标签",
      ...(approvalOnly && isProduct ? { tree:restrictTreeToPaths(baseField.tree, associatedProducts) } : {})
    };
    return renderHierarchyCascaderControl('rectification-statistics-' + row[0] + '-' + kind, field, key, false);
  }

  function renderRectificationStatisticsSection(row) {
    const stats = rectificationStatisticsFor(row);
    return '<section class="panel detail-section rectification-stage-section rectification-statistics-section"><div class="panel-head"><span class="panel-title">整改结果-投诉统计</span></div><div class="rectification-stat-filter-grid"><div class="rectification-stat-filter-item is-product-tag"><label>投诉产品标签</label>' + renderRectificationStatisticsTagFilter(row, stats, "product") + '</div><div class="rectification-stat-filter-item is-cause-tag"><label>投诉原因标签</label>' + renderRectificationStatisticsTagFilter(row, stats, "cause") + '</div><div class="rectification-stat-filter-item is-period"><label>统计周期</label><div class="rectification-stat-readonly">' + escapeAttribute(stats["统计周期"]) + '</div></div><div class="rectification-stat-filter-item is-org"><label>统计机构</label><button type="button" class="di-select is-fluid rectification-stat-org" disabled><span>' + escapeAttribute(stats["统计机构"]) + '</span><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button></div></div><div class="rectification-stat-charts"><div class="rectification-stat-field-block"><div class="rectification-stat-field-name">日均投诉量变化对比图</div>' + renderRectificationComparisonChart(row) + '</div><div class="rectification-stat-field-block"><div class="rectification-stat-field-name">投诉标签变化趋势</div>' + renderRectificationTrendChart(row) + '</div></div></section>';
  }

  function acceptanceChannelOptions(workOrderType = "\u6295\u8bc9\u5355") {
    return ACCEPTANCE_CHANNEL_OPTIONS[workOrderType] || ACCEPTANCE_CHANNEL_OPTIONS["\u6295\u8bc9\u5355"] || [];
  }

  function ticketAcceptanceChannel(rowOrId) {
    const row = Array.isArray(rowOrId) ? rowOrId : ticketRowById(rowOrId);
    const id = Array.isArray(rowOrId) ? rowOrId[0] : rowOrId;
    const type = row?.[1] || state.documentData.tickets?.[id]?.documentType || "投诉单";
    const options = acceptanceChannelOptions(type);
    const storedValue = state.documentData.tickets?.[id]?.fields?.entry?.["受理渠道"] || "";
    const normalizedValue = storedValue === "客户意见薄" ? "客户意见簿" : storedValue;
    if (options.includes(normalizedValue)) return normalizedValue;
    const hash = String(id || type).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return options[hash % Math.max(1, options.length - 1)] || "其它";
  }

  function ticketRowsWithAcceptanceChannel(rows) {
    return rows.map(row => {
      const displayRow = [...row];
      displayRow[3] = ticketAcceptanceChannel(row);
      return displayRow;
    });
  }


  function markDocumentVoided(kind, id) {
    const row = workflowRow(kind, id);
    if (!row) return toast("未找到单据：" + id, true);
    if (row[5] !== "待提交") return toast("仅待提交状态可以废止", true);
    openModal("确认废止", '<div class="action-dialog"><div class="action-dialog-question"><strong>确认废止 ' + id + '？</strong><span>废止后单据状态变为已废止，并作为最终状态进入查询导出。</span></div></div>', "确认废止", () => {
      const from = row[5];
      row[5] = "已废止";
      row[6] = systemTimestamp();
      if (kind === "ticket") {
        const queryRow = queryTicketRows.find(item => item[0] === id);
        if (queryRow) {
          queryRow[5] = row[5];
          queryRow[6] = row[6];
        }
      }
      appendWorkflowRecord(kind, row, from, "已废止", "废止", { result:"废止", receiverName:"-" });
      persistWorkflowState();
      closeOverlay();
      toast(id + " 已废止");
      rerenderPage();
    });
  }

  function validateAttachmentSelection(files) {
    const selected = Array.from(files || []).filter(Boolean);
    if (!selected.length) return { ok:false, message:"请选择附件", files:[] };
    if (selected.length > 30) return { ok:false, message:"最多上传30个文件", files:selected };
    const oversized = selected.find(file => Number(file.size || 0) > 100 * 1024 * 1024);
    if (oversized) return { ok:false, message:"单个文件不能超过100M：" + (oversized.name || "未命名文件"), files:selected };
    return { ok:true, message:"", files:selected };
  }

  function processingAttachmentNames(value = "") {
    return String(value || "").split(/[、,，]/).map(name => name.trim()).filter(Boolean);
  }

  function renderProcessingAttachmentList(names = [], disabled = false) {
    return '<div class="processing-attachment-list" data-processing-attachment-list>' + names.map((name, index) => '<div class="processing-attachment-item" data-processing-attachment-name="' + escapeAttribute(name) + '"><span class="processing-attachment-name"><b>' + (index + 1) + '.</b><img src="ui/assets/document.svg" alt=""><span>' + escapeAttribute(name) + '</span></span><span class="processing-attachment-actions"><em>已完成</em>' + (disabled ? '' : '<button type="button" data-processing-attachment-remove="' + escapeAttribute(name) + '" aria-label="删除' + escapeAttribute(name) + '"><img src="ui/assets/delete.svg" alt=""></button>') + '</span></div>').join("") + '</div>';
  }

  function updateProcessingAttachmentControl(box, names) {
    const control = box.closest("[data-processing-attachment-control]");
    if (!control) return false;
    const normalizedNames = names.map(name => String(name || "").trim()).filter(Boolean);
    control.querySelector("[data-processing-attachment-list]").outerHTML = renderProcessingAttachmentList(normalizedNames, box.classList.contains("is-disabled"));
    box.classList.toggle("has-file", normalizedNames.length > 0);
    if (box.dataset.fieldKey) state.formValues[box.dataset.fieldKey] = normalizedNames.join("、");
    return true;
  }

  function appendProcessingAttachmentFiles(box, names) {
    const control = box.closest("[data-processing-attachment-control]");
    if (!control) return { handled:false, ok:true, names };
    const existingNames = [...control.querySelectorAll("[data-processing-attachment-name]")].map(item => item.dataset.processingAttachmentName).filter(Boolean);
    const combinedNames = [...new Set([...existingNames, ...names])];
    if (combinedNames.length > 30) return { handled:true, ok:false, message:"最多上传30个文件" };
    updateProcessingAttachmentControl(box, combinedNames);
    return { handled:true, ok:true, names:combinedNames };
  }

  function renderField(field, scope = "") {
    const baseKey = fieldKey(field); const key = fieldKey(field, scope); const label = fieldLabel(field); const required = fieldRequired(field, scope);
    const id = `field-${key.replace(/[^\w\u4e00-\u9fa5]/g,"-")}`; const correctionChanged = correctionFieldChanged(key, state.formValues[key]); const cls = `form-item ${field.span?'span-2':''} ${field.singleRow?'is-single-row':''} ${correctionChanged ? 'is-correction-changed' : ''}`;
    const dependencyKey = dependency => scope ? scope + "." + dependency : dependency;
    const dependencyValue = dependency => {
      let scopedValue = state.formValues[dependencyKey(dependency)];
      // 历史异常投诉样例仅保存编号和短名称，按编号迁移到当前完整枚举。
      if (dependency === "异常投诉类型" && scopedValue) {
        const matched = Object.keys(field.optionsBy?.values || {}).find(value => value.split(" ")[0] === String(scopedValue).split(" ")[0]);
        if (matched) { scopedValue = matched; state.formValues[dependencyKey(dependency)] = matched; }
      }
      if (scopedValue !== undefined && scopedValue !== "") return scopedValue;
      if (field.dependsOnStage && state.detailId) return documentRecordFor("ticket", ticketRowById(state.detailId))?.fields?.[field.dependsOnStage]?.[dependency] || "";
      return "";
    };
    const institutionSourceKey = field.optionsByInstitution ? dependencyKey(field.optionsByInstitution.key) : "";
    const options = field.optionsByInstitution ? (field.name === "派发部门" ? dispatchDepartmentOptions(state.formValues[institutionSourceKey]) : departmentOptionsForInstitution(state.formValues[institutionSourceKey], field.optionsByInstitution)) : field.optionsBy ? (field.optionsBy.values?.[dependencyValue(field.optionsBy.key)] || []) : (field.options || (field.dictionary ? tagTreeLeafOptions(field.dictionary) : []));
    let current = fieldValue(field, key);
    if (["异常投诉类型", "异常投诉具体表现"].includes(field.name) && current) {
      const matched = field.options?.find(value => value.split(" ")[0] === String(current).split(" ")[0]);
      if (matched) { current = matched; state.formValues[key] = matched; }
    }
    if (field.name === "救济途径是否告知" && current && !["是", "否"].includes(current)) {
      current = "是";
      state.formValues[key] = current;
    }
    if (field.autoDispatchCc) {
      const recipients = ticketDispatchCopyRecipients();
      state.formValues[key] = [...recipients];
      current = recipients.length ? recipients.join("、") : "-";
    }
    if (field.optionsBy && current && !options.includes(current)) { current = ""; state.formValues[key] = ""; }
    if (field.autoSelectSingleOption && options.length === 1) { current = options[0]; state.formValues[key] = current; }
    if (field.valueMap) { current = field.valueMap.values?.[dependencyValue(field.valueMap.key)] || ""; state.formValues[key] = current; }
    const dependencyMissing = Boolean(field.optionsBy && !dependencyValue(field.optionsBy.key));
    const resultNoticeField = scope.startsWith("processing.") ? PROCESSING_FIELDS.find(item => item.name === "处理结果是否告知") : null;
    const resultNoticeKey = resultNoticeField ? fieldKey(resultNoticeField, scope) : "";
    const resultNoticeValue = dependencyValue("处理结果是否告知") || (resultNoticeKey ? state.formValues[resultNoticeKey] : "") || "";
    // 投诉单、信访单在选择“是”或“否”后都可选告知时间。
    const noticeTimeEnabled = ["投诉单", "信访单"].includes(state.workOrderType)
      ? ["是", "否"].includes(resultNoticeValue) : resultNoticeValue === "是";
    const resultNoticeDisabled = scope.startsWith("processing.") && field.name === "告知时间" && !noticeTimeEnabled;
    const resultNoticeRuleOverride = scope.startsWith("processing.") && field.name === "告知时间" && noticeTimeEnabled;
    const disabled = (fieldDisabled(field, scope) && !resultNoticeRuleOverride) || dependencyMissing || resultNoticeDisabled || Boolean(field.autoSelectSingleOption && options.length === 1); let control = "";
    if (field.type === "aiAction") return `<div class="form-item span-2 ai-form-item"><div class="ai-assist-actions ai-entry-action"><button type="button" class="btn xib-btn xib-btn--primary btn-primary ai-smart-button" data-action="smart-classify">${icon("ai")} AI 智能打标</button></div>${renderAiRecommendationPreview()}</div>`;
    if (field.type === "approvalAttachmentReadonly") {
      const attachmentNames = processingAttachmentNames(current || "处理结果证明材料.pdf");
      control = `<div class="upload-field-control processing-attachment-control is-readonly" data-processing-attachment-control><div class="drag-box app-drag-upload processing-attachment-drop" aria-disabled="true"><img class="lib-icon-img" src="ui/assets/upload.svg" alt=""><p><span>处理附件</span></p><small>处理人已上传，审批页面仅可查看</small></div>${renderProcessingAttachmentList(attachmentNames, true)}</div>`;
    }
    else if (field.type === "readonly") control = `<input class="di-input is-fluid${state.aiGeneratedFields.has(key) ? ' is-ai-generated' : ''}" id="${id}" data-field-key="${key}" value="${escapeAttribute(current)}" ${field.placeholder ? `placeholder="${escapeAttribute(field.placeholder)}"` : ''} ${field.autoDispatchCc ? 'data-auto-dispatch-cc' : ''} disabled>`;
    else if (field.type === "workOrderType") control = `<select class="di-native-select is-fluid" id="work-order-type" ${state.workOrderType ? "disabled" : ""}><option value="">请选择</option>${visibleWorkOrderTypes(field.options || ["投诉单","信访单","表扬单","建议单"]).map(value=>`<option ${value===state.workOrderType?'selected':''}>${value}</option>`).join("")}</select>`;
    else if (field.type === "channel") {
      const locked = customerServiceDraftChannelLocked();
      const options = locked ? ["客服电话"] : acceptanceChannelOptions(state.workOrderType);
      if (locked) state.formValues[key] = "客服电话";
      else if (customerServiceDraftChannelDefault() && !state.formValues[key]) state.formValues[key] = "客服电话";
      control = renderSelectControl(id, options, disabled || locked, key);
    } else if (field.type === "personSelect" && (!field.personSelectTypes || field.personSelectTypes.includes(state.workOrderType))) {
      const institutionValue = dependencyValue(field.dependsOn || "");
      const personOptions = complaintObjectOptions(institutionValue);
      if (!state.formValues[key] || !personOptions.includes(state.formValues[key])) state.formValues[key] = field.defaultValue || "-";
      current = state.formValues[key];
      control = renderSelectControl(id, personOptions, disabled || !institutionValue, key, { searchable: field.searchable !== false, searchPlaceholder: "搜索投诉对象" });
    } else if (field.type === "select" && field.optionsByInstitution) control = renderInstitutionDepartmentControl(id, key, institutionSourceKey, disabled, field.placeholder || "请选择部门", field.optionsByInstitution);
    else if (field.type === "personByDepartment" && field.multiple) {
      const institutionKey = scope + "." + field.dependsOnInstitution;
      const departmentKey = scope + "." + field.dependsOn;
      const people = hrUsersForDepartment(state.formValues[institutionKey], state.formValues[departmentKey]);
      const selected = (Array.isArray(current) ? current : String(current || "").split(/[、,，]/)).map(item => String(item).trim()).filter(item => people.includes(item));
      state.formValues[key] = selected;
      control = renderHierarchyCascaderControl(id, { ...field, dictionary:"deptPeople|" + institutionKey + "|" + departmentKey, tree:people.map(label => ({ label })), levels:["人员"], leafLevel:1, nonLeafSelectable:false, searchable:true, multiple:true }, key, disabled || !people.length);
    }
    else if (field.type === "personByDepartment") {
      const institutionValue = dependencyValue(field.dependsOnInstitution || "");
      const departmentValue = dependencyValue(field.dependsOn || "");
      const personOptions = hrUsersForDepartment(institutionValue, departmentValue);
      if (current && !personOptions.includes(current)) {
        if (field.strictOptions) { state.formValues[key] = ""; current = ""; }
        else personOptions.unshift(current);
      }
      control = renderSelectControl(id, personOptions, disabled || !institutionValue || !departmentValue, key, { searchable:true, searchPlaceholder:field.searchPlaceholder || "搜索问责对象" });
    }
    else if (field.type === "personSearch") control = renderPersonSearchControl(id, options, disabled, key, { searchMode:field.searchMode || "prefix", placeholder:field.placeholder });
    else if (field.type === "countersignPersonSelect") control = renderCountersignPersonSelect(field, key, scope, disabled);
    else if (field.type === "countersignDepartmentSelect") control = renderCountersignDepartmentSelect(field, key, scope, disabled);
    else if (field.type === "select") control = renderSelectControl(id, options, disabled, key, { searchable:Boolean(field.searchable), searchMode:field.searchMode || "contains", searchPlaceholder:field.searchPlaceholder || "搜索选项", placeholder:field.placeholder });
    else if (field.type === "outboundContactTime") {
      // 投诉单和信访单可选择任一联系记录时间，并从该记录回填告知方式。
      const ticket = ticketRowById(state.detailId);
      const allContactTimes = scope.startsWith("processing.") && ["投诉单", "信访单"].includes(state.workOrderType);
      const times = allContactTimes
        ? [...new Set(contactRecordsForTicket(ticket).map(record => String(record.time || "").trim()).filter(Boolean))]
        : outboundContactTimesForTicket(ticket);
      if (current && !times.includes(current)) {
        current = "";
        state.formValues[key] = "";
      }
      control = renderSelectControl(id, times, disabled, key, { placeholder: field.placeholder || "请选择外呼联系记录时间" });
    }
    else if (field.type === "businessLinePicker") control = renderBusinessLinePickerControl(id, field, key, disabled);
    else if (field.type === "contactRecordSelect") {
      const row = workflowRow("subprocess", state.subprocessId);
      const ticket = row ? ticketRowById(row[2]) : null;
      const contactOptions = ticket ? contactRecordsForTicket(ticket).map(record => record.time) : [];
      if (current && !contactOptions.includes(current)) {
        current = "";
        state.formValues[key] = "";
      }
      if (current) syncExtensionNoticeMethod(key, current);
      control = renderSelectControl(id, contactOptions, disabled, key);
    }
    else if (field.type === "relatedEventPicker") { const rectificationRow = rectificationRows.find(item => item[0] === state.rectificationEditId); control = '<div class="rectification-related-selection" data-rectification-related-selection>' + renderRectificationRelatedTickets(rectificationRow) + '</div><input type="hidden" name="related-event" data-field-key="' + key + '" value="' + rectificationRelatedTicketIds(rectificationRow).join("、") + '"><button type="button" class="btn xib-btn xib-btn--secondary subprocess-related-search" data-action="search-rectification-related-tickets">查询并选择</button>'; }
    else if (field.type === "hierarchyCascader") {
      const tree = field.tree || hierarchyTreeFor(field.dictionary);
      const editableAiTag = state.page === "ticket-form" && AI_CLASSIFICATION_TYPES.has(state.workOrderType) && AI_TAG_FIELD_NAMES.includes(field.name);
      const displayField = { ...field, ...(tree?.length ? { tree } : {}) };
      if (editableAiTag) {
        control = renderAiTagEditorControl(id, displayField, key, disabled);
      } else control = renderHierarchyCascaderControl(id, displayField, key, disabled);
    }
    else if (field.type === "institutionDepartment") control = renderInstitutionDepartmentControl(id, key, field.sourceKey, disabled, "请选择接收部门", { emptyForSubbranch: Boolean(field.emptyForSubbranch) });
    else if (field.type === "multiCascader") control = renderMultiCascaderControl(id, field, key);
    else if (field.type === "trendChart" || field.type === "rectificationTrendChart") control = renderRectificationTrendChart();
    else if (field.type === "rectificationBarChart") control = renderRectificationComparisonChart();
    else if (field.type === "cascader") {
      let cascaderDisabled = disabled;
      if (field.cascader === "region") {
        const countryValue = dependencyValue("国家地区");
        if (countryValue && countryValue !== "中华人民共和国") {
          cascaderDisabled = true;
          current = "不清楚";
          state.formValues[key] = current;
        }
      }
      control = renderCascaderControl(id, field.cascader, key, cascaderDisabled, field.linkedKeys || []);
    }
    else if (field.type === "radio") control = renderRadioControl(id, options, key, field.defaultValue || "", disabled);
    else if (field.type === "checkboxGroup") {
      const selected = state.formValues[key] || field.defaultValues || [];
      control = `<div class="di-checkbox-group ${disabled ? "is-disabled" : ""}" data-app-checkbox-group data-field-key="${key}">${field.options.map(option => `<label class="di-checkbox-choice"><input type="checkbox" value="${option}" ${selected.includes(option) ? "checked" : ""} ${disabled ? "disabled" : ""}><span>${option}</span></label>`).join("")}</div>`;
    }
    else if (field.type === "upload") {
      const defaultTemplateName = String(field.template || "").trim();
      const maintainedTemplate = defaultTemplateName && window.XIBAdminFormTemplateStore ? window.XIBAdminFormTemplateStore.get() : null;
      const templateName = maintainedTemplate?.fileName || defaultTemplateName;
      const templateUrl = maintainedTemplate?.dataUrl || (defaultTemplateName ? "templates/" + encodeURIComponent(defaultTemplateName) : "");
      const templateAction = defaultTemplateName
        ? `<div class="upload-template-row"><span>请先下载并填写标准模板</span><a class="btn xib-btn xib-btn--secondary form-template-download" data-form-template-download href="${escapeAttribute(templateUrl)}" download="${escapeAttribute(templateName)}">${icon("download")} 下载模板</a></div>`
        : "";
      const processingAttachment = scope.startsWith("processing.") && field.name === "处理附件";
      const attachmentNames = processingAttachmentNames(current);
      control = processingAttachment
        ? `<div class="upload-field-control processing-attachment-control" data-processing-attachment-control>${templateAction}<div class="drag-box app-drag-upload processing-attachment-drop ${current ? "has-file" : ""} ${disabled ? "is-disabled" : ""}" data-drag-upload data-field-key="${key}" tabindex="${disabled ? "-1" : "0"}"><img class="lib-icon-img" src="ui/assets/upload.svg" alt=""><p><span data-upload-status>将文件拖到此处，或</span><button type="button" data-upload-browse ${disabled ? "disabled" : ""}>点击上传</button></p><small>最多支持上传30个文件，单个文件最大100M</small><input type="file" data-upload-input hidden multiple ${disabled ? "disabled" : ""}></div>${renderProcessingAttachmentList(attachmentNames, disabled)}</div>`
        : `<div class="upload-field-control">${templateAction}<div class="drag-box app-drag-upload ${current ? "has-file" : ""} ${disabled ? "is-disabled" : ""}" data-drag-upload data-field-key="${key}" tabindex="${disabled ? "-1" : "0"}"><img class="lib-icon-img" src="ui/assets/upload.svg" alt=""><p><span data-upload-status>${current ? "已选择：" + current : "将文件拖到此处，或"}</span><button type="button" data-upload-browse ${disabled ? "disabled" : ""}>${current ? "重新选择" : "点击上传"}</button></p><small>最多支持上传30个文件，单个文件最大100M</small>${state.role === "developer" && !disabled ? `<button type="button" class="demo-upload-link" data-demo-upload data-demo-file="${field.name}示例材料.pdf">一键上传示例文件</button>` : ""}<input type="file" data-upload-input hidden multiple ${disabled ? "disabled" : ""}></div></div>`;
    }
    else if (field.type === "date" || field.type === "datetime") control = renderPickerControl(id, field, key);
    else if (field.type === "year") control = renderYearPickerControl(id, field, key, disabled);
    else if (field.type === "textarea") {
      const textarea = `<textarea class="di-textarea${state.aiGeneratedFields.has(key) ? ' is-ai-generated' : ''}" id="${id}" data-field-key="${key}" placeholder="${field.placeholder || '请输入'}" ${field.max != null ? `maxlength="${field.max}"` : ""} ${disabled?'disabled':''}>${current}</textarea>`;
      control = field.max != null ? `<div class="textarea-with-count">${textarea}<small class="textarea-count">${String(current || "").length}/${field.max}</small></div>` : textarea;
    }
    else if (scope.startsWith("customer.") && field.name === "所属客户经理") control = `<div class="customer-manager-autocomplete"><input class="di-input is-fluid" id="${id}" data-field-key="${key}" data-customer-manager-input type="text" autocomplete="off" placeholder="${field.placeholder || '查询回填或手工录入'}" value="${escapeAttribute(current)}" ${disabled?'disabled':''}><div class="customer-manager-suggestions" data-customer-manager-suggestions hidden>${CUSTOMER_MANAGER_OPTIONS.map(option => `<button type="button" data-customer-manager-option="${escapeAttribute(option)}">${escapeAttribute(option)}</button>`).join("")}</div></div>`;
    else if (field.type === "amount") control = `<div class="amount-input"><input class="di-input is-fluid" id="${id}" data-field-key="${key}" data-amount-input type="text" inputmode="decimal" placeholder="${field.placeholder || '请输入'}" value="${escapeAttribute(formatAmountText(current))}" ${disabled?'disabled':''}><span class="amount-input-unit">${escapeAttribute(field.unit || "元")}</span></div>`;
    else control = `<input class="di-input is-fluid${state.aiGeneratedFields.has(key) ? ' is-ai-generated' : ''}" id="${id}" data-field-key="${key}" type="${field.type==='number'?'number':'text'}" placeholder="${field.placeholder || '请输入'}" value="${current}" ${field.maxLength ? `maxlength="${field.maxLength}"` : ""} ${field.min != null ? `min="${field.min}"` : ""} ${field.max != null ? `max="${field.max}"` : ""} ${field.step != null ? `step="${field.step}"` : ""} ${disabled?'disabled':''}>`;
    const primaryAction = field.action ? `<button type="button" class="btn-link form-field-action" data-action="${field.actionAction || "customer-search"}" data-customer-scope="${scope}">${field.action}</button>` : "";
    const secondaryAction = field.secondaryAction ? `<button type="button" class="btn-link form-field-action" data-action="${field.secondaryActionAction}" data-customer-scope="${scope}">${field.secondaryAction}</button>` : "";
    const hideTicketEntryNote = ["投诉单", "信访单"].includes(state.workOrderType) && ["投诉/信访/表扬机构", "反馈内容", "主体诉求", "转送时间", "转送函号"].includes(field.name);
    const labelNote = field.conditional && !hideTicketEntryNote ? `<small class="field-label-note">（${escapeAttribute(field.conditional)}）</small>` : "";
    let fieldHint = field.hint || "";

    if (field.name === "居住地 省/市/区" && scope.startsWith("customer.")) {
      const auxiliaryAddress = state.formValues[scope + ".__custAddress"] || "";
      if (!current && auxiliaryAddress) fieldHint = "CustAddress：" + auxiliaryAddress;
    }

    if (field.hintBy) {
      const sourceValue = field.hintBy.sourceStage && state.detailId
        ? documentRecordFor("ticket", ticketRowById(state.detailId))?.fields?.[field.hintBy.sourceStage]?.[field.hintBy.key] || ""
        : dependencyValue(field.hintBy.key);
      fieldHint = field.hintBy.values?.[sourceValue] || "";
    }
    const originalAiTags = state.page === "ticket-form" ? state.aiTagSuggestions[field.name] : null;
    const singleCandidates = state.page === "ticket-form" ? state.aiClassificationSuggestions[field.name] : null;
    const readonlyMissingHint = field.type === "readonly" && required && !String(current || "").trim()
      ? '<small class="form-field-hint field-validation-message">数据未回填，请检查关联主单/联系记录</small>'
      : "";
    const hint = originalAiTags?.length
      ? renderAiTagRecommendationBox(field, originalAiTags)
      : singleCandidates?.length
        ? '<div class="form-field-hint ai-single-candidates"><span>AI 打标候选（点击可选填，上方仅选 1 个）：</span><div class="ai-single-candidate-list">' + singleCandidates.map((value, index) => '<button type="button" class="ai-single-candidate' + (current === value ? ' is-selected' : '') + '" data-ai-candidate-key="' + escapeAttribute(key) + '" data-ai-candidate-value="' + escapeAttribute(value) + '"><b>' + (index + 1) + '.</b> ' + escapeAttribute(value) + (current === value ? '<span data-ai-candidate-check aria-hidden="true">✓</span>' : '') + '</button>').join('') + '</div></div>'
        : (fieldHint ? `<small class="form-field-hint">${escapeAttribute(fieldHint)}</small>` : readonlyMissingHint);
    const importError = state.page === "ticket-form" ? state.importFieldErrors[key] : "";
    const importErrorMarkup = importError ? `<small class="import-field-error" data-import-field-error>${escapeAttribute(importError)}</small>` : "";
    return `<div class="${cls}${importError ? ' has-import-error' : ''}" data-field-name="${baseKey}"><label class="form-label ${required?'required':''}" for="${id}"><span>${label}</span>${labelNote}</label><div class="form-control">${control}${hint}${importErrorMarkup}<div class="form-field-actions">${primaryAction}${secondaryAction}</div></div></div>`;
  }

  function formatAmountText(value) {
    const raw = String(value ?? "").replace(/,/g, "").trim();
    if (!raw || !/^\d+(?:\.\d+)?$/.test(raw)) return raw;
    return Number(raw).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
  }

  function bindAmountInputs(root = document) {
    root.querySelectorAll("[data-amount-input]").forEach(control => {
      if (control.dataset.amountBound === "true") return;
      control.dataset.amountBound = "true";
      control.addEventListener("focus", () => { control.value = String(control.value).replace(/,/g, ""); });
      control.addEventListener("input", () => {
        const cleaned = control.value.replace(/[^\d.]/g, "").replace(/^(\d*\.?)(.*)$/, (_, head, tail) => head + tail.replace(/\./g, "")).replace(/^(\d*\.\d{0,2}).*$/, "$1");
        control.value = cleaned;
        state.formValues[control.dataset.fieldKey] = cleaned;
      });
      control.addEventListener("blur", () => { control.value = formatAmountText(control.value); });
    });
  }

  const PROCESSING_FIELDS = deepClone(FORM_SCHEMA.work_orders?.processing_fields || []);
  const LINKED_SUBPROCESS_HIDDEN_STATUSES = new Set(["草稿", "已废止"]);

  function triggeredForTicket(ticketId = state.detailId) {
    return state.triggeredSubprocesses[ticketId] || [];
  }

  function subprocessIndicator(type, ticketId = state.detailId) {
    return triggeredForTicket(ticketId).filter(record => record.type === type);
  }

  const SUBPROCESS_CONCLUSION_DEFINITIONS = Object.freeze({
    "撤销投诉": { field: "是否撤销投诉", values: ["是", "否"] },
    "异常投诉": { field: "异常认定结果", values: ["认定成功", "认定失败"] },
    "剔除申请": { field: "剔除认定结果", values: ["剔除成功", "剔除失败"] },
    "投诉问责": { field: "是否问责", values: ["是", "否"] },
    "纠纷化解": { field: "调解成功", values: ["是", "否"] },
    "异议核查": { field: "核查结论", values: ["核查一致", "核查部分不一致", "核查完全不一致"] }
  });

  function linkedSubprocessRecords(ticketId = state.detailId) {
    const recordsById = new Map();
    subprocessRows.filter(row => String(row[2] || "").split("、").includes(ticketId)).forEach(row => {
      recordsById.set(row[0], {
        id: row[0],
        type: row[1],
        document: subprocessDefinition(row[1]).document,
        relatedTicket: ticketId,
        status: row[5],
        createdAt: row[6],
        row
      });
    });
    triggeredForTicket(ticketId).forEach(record => {
      if (!record?.id) return;
      const row = subprocessRows.find(item => item[0] === record.id) || [record.id, record.type, ticketId, "陈晓敏", currentRoleProfile().orgLabel, record.status, record.createdAt];
      recordsById.set(record.id, { ...recordsById.get(record.id), ...record, row, relatedTicket: ticketId });
    });
    return [...recordsById.values()].filter(record => {
      const status = record.status || record.row?.[5] || "";
      return !LINKED_SUBPROCESS_HIDDEN_STATUSES.has(status);
    });
  }

  const SUBPROCESS_POSITIVE_CONCLUSIONS = new Set(["是", "认定成功", "剔除成功", "核查一致"]);
  const SUBPROCESS_NEGATIVE_CONCLUSIONS = new Set(["否", "认定失败", "剔除失败", "核查部分不一致", "核查完全不一致"]);

  function subprocessConclusionDetails(record) {
    const definition = SUBPROCESS_CONCLUSION_DEFINITIONS[record?.type];
    if (!definition) return { field: "-", value: "-", tone: "neutral" };
    const fieldName = definition.field;
    let value = "-";
    if (record?.id) {
      const liveValue = state.formValues["subprocess-processing." + record.type + "." + fieldName] ?? state.formValues["subprocess." + record.type + "." + fieldName];
      if (liveValue !== undefined && liveValue !== null && liveValue !== "") value = Array.isArray(liveValue) ? liveValue.join("、") : String(liveValue);
      else {
        const stored = documentRecordFor("subprocess", record.row)?.fields || {};
        for (const stage of ["supplement", "processing", "approval", "initialApproval", "entry", "base"]) {
          const storedValue = stored[stage]?.[fieldName];
          if (storedValue !== undefined && storedValue !== null && storedValue !== "") {
            value = Array.isArray(storedValue) ? storedValue.join("、") : String(storedValue);
            break;
          }
        }
      }
    }
    const tone = SUBPROCESS_POSITIVE_CONCLUSIONS.has(value) ? "positive" : SUBPROCESS_NEGATIVE_CONCLUSIONS.has(value) ? "negative" : "neutral";
    return { field: fieldName, value, tone };
  }

  function subprocessConclusion(record) {
    const details = subprocessConclusionDetails(record);
    return details.field + " - " + details.value;
  }

  function renderSubprocessConclusion(record) {
    if (!SUBPROCESS_CONCLUSION_DEFINITIONS[record?.type]) return "-";
    const details = subprocessConclusionDetails(record);
    const idAttribute = record?.id ? ' data-subprocess-conclusion="' + escapeAttribute(record.id) + '"' : '';
    return '<span class="subprocess-conclusion" data-conclusion-tone="' + details.tone + '"' + idAttribute + '><span class="subprocess-conclusion-field">' + escapeAttribute(details.field) + '</span><span class="subprocess-conclusion-separator" aria-hidden="true">—</span><strong class="subprocess-conclusion-result">' + escapeAttribute(details.value) + '</strong></span>';
  }

  function subprocessDeadlineValue(type, createdAt, relatedTicketId) {
    const rule = SUBPROCESS_BASE_FIELD_RULES.deadline_rules?.[type];
    if (!rule || rule.mode === "none") return "-";
    if (rule.mode === "inheritTicketDeadline") return dispositionDeadline(ticketRowById(relatedTicketId), "ticket") || "随主工单处置期限";
    const applied = parsePrototypeDate(createdAt);
    if (!applied || rule.mode !== "daysAfterApplication") return "-";
    applied.setDate(applied.getDate() + Number(rule.days || 0));
    return applied.toISOString().slice(0, 10);
  }

  function subprocessTypeBaseValues(type, relatedTicketId, createdAt = systemTimestamp()) {
    const ticket = ticketRowById(relatedTicketId);
    const record = ticket ? documentRecordFor("ticket", ticket) : null;
    const entry = record?.fields?.entry || {};
    const values = {};
    (SUBPROCESS_BASE_FIELD_RULES.type_fields?.[type] || []).forEach(field => {
      if (field.name === "关联转送函号") values[field.name] = entry["转送函号"] || "-";
      else if (field.name === "客户姓名") values[field.name] = ticket?.[2] || "";
      else if (field.name === "投诉机构") values[field.name] = ticket?.[4] || "";
      else if (field.name === "客户投诉时间") values[field.name] = entry["客户投诉时间"] || ticket?.[6] || "";
      else if (field.name === "投诉内容") values[field.name] = entry["投诉/信访事项"] || entry["反馈内容"] || ticket?.[3] || "";
    });
    values["处置期限"] = subprocessDeadlineValue(type, createdAt, relatedTicketId);
    return values;
  }

  function subprocessInvestigationAssignmentDefaults(sourceRow) {
    if (!sourceRow) return;
    const relatedTicketId = sourceRow[0] || state.subprocessSourceTicket;
    const record = documentRecordFor("ticket", sourceRow);
    const processing = record?.fields?.processing || {};
    const entry = record?.fields?.entry || {};
    const legacyOwnership = String(processing["责任机构/部门"] || "").split("/").map(value => value.trim()).filter(Boolean);
    const institution = processing["工单处理机构"] || processing["工单接收机构"] || entry["工单接收机构"] || ticketReceivingInstitution(sourceRow) || "";
    const rawDepartment = processing["工单处理部门"] || processing["工单接收部门"] || processing["责任部门"] || legacyOwnership[1] || ticketReceivingDepartment(sourceRow) || "";
    const departmentOptions = departmentOptionsForInstitution(institution, { emptyForSubbranch: true });
    const department = departmentOptions.find(option => option === rawDepartment || String(rawDepartment).endsWith(option) || option.endsWith(String(rawDepartment))) || rawDepartment;
    const handler = normalizedAssigneeName(processing["处理员"] || ticketLastHandler(sourceRow) || "");
    const scope = "subprocess.异议核查.";
    const initializedKey = scope + "__assignmentDefaultsInitialized";
    if (state.formValues[initializedKey]) return;
    if (state.formValues[scope + "接收机构"] === undefined || state.formValues[scope + "接收机构"] === "") state.formValues[scope + "接收机构"] = institution;
    if (state.formValues[scope + "接收部门"] === undefined || state.formValues[scope + "接收部门"] === "") state.formValues[scope + "接收部门"] = department;
    if (state.formValues[scope + "处置员"] === undefined || state.formValues[scope + "处置员"] === "") state.formValues[scope + "处置员"] = handler;
    state.formValues[initializedKey] = true;
  }

  function populateCorrectionFieldsFromRelatedTicket() {
    if (state.subprocessType !== "投诉校正") return;
    const relatedTicketId = subprocessSourceTicketRow()?.[0] || state.subprocessSourceTicket;
    const ticket = ticketRowById(relatedTicketId);
    const record = ticket ? documentRecordFor("ticket", ticket) : null;
    if (!ticket || !record) return;
    const scope = "subprocess.投诉校正.";
    const marker = scope + "__prefilledFor";
    if (state.formValues[marker] === relatedTicketId) return;
    state.correctionOriginalValues = {};
    const entry = record.fields?.entry || {};
    const processing = record.fields?.processing || {};
    const corrected = record.fields?.correctionOverrides || {};
    const fields = subprocessDifferenceSections(subprocessDefinition("投诉校正"), "create").flatMap(section => section.fields);
    fields.forEach(field => {
      const source = field.prefillFrom;
      if (!source) return;
      const sourceValues = source.phase === "processing" ? processing : entry;
      const sourceNames = source.fields || (source.field ? [source.field] : []);
      let value = CORRECTION_WRITEBACK.prefillValue({ sourceNames, sourceValues, overrides:corrected, phase:source.phase });
      if (value === undefined && field.name === "投诉/信访事项") value = ticket[3] || "";
      if ((value === undefined || value === "") && field.name === "抄送人") value = entry["创建人"] || "陈敏慧-60157";
      if (Array.isArray(value) && source.arrayValue === "last") value = value.at(-1) || "";
      if (value !== undefined && ["select", "hierarchyCascader"].includes(field.type)) {
        value = correctionOptionValue(field, value, entry);
      }
      if (value !== undefined && value !== "") {
        const key = scope + field.name;
        state.formValues[key] = value;
        state.correctionOriginalValues[key] = deepClone(value);
      }
    });
    state.formValues[marker] = relatedTicketId;
  }

  function correctionComparableValue(value) {
    return Array.isArray(value) ? value.join(" / ") : String(value ?? "");
  }

  function correctionFieldChanged(key, value = state.formValues[key]) {
    if (!String(key || "").startsWith("subprocess.投诉校正.") || String(key).endsWith(".__prefilledFor")) return false;
    if (!Object.prototype.hasOwnProperty.call(state.correctionOriginalValues || {}, key)) return false;
    return correctionComparableValue(value) !== correctionComparableValue(state.correctionOriginalValues[key]);
  }

  function correctionOriginalEntrySnapshot() {
    const prefix = "subprocess.投诉校正.";
    return Object.fromEntries(Object.entries(state.correctionOriginalValues || {}).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), deepClone(value)]));
  }

  function syncCorrectionFieldHighlight(controlOrKey, value) {
    const key = typeof controlOrKey === "string" ? controlOrKey : controlOrKey?.dataset?.fieldKey;
    if (!key || typeof document === "undefined") return;
    const control = typeof controlOrKey === "string"
      ? [...document.querySelectorAll("[data-field-key]")].find(item => item.dataset.fieldKey === key)
      : controlOrKey;
    control?.closest(".form-item")?.classList.toggle("is-correction-changed", correctionFieldChanged(key, value));
  }

  function correctionOptionValue(field, value, entry) {
    const options = field.type === "hierarchyCascader" ? tagTreeLeafOptions(field.dictionary) : (field.options || []);
    if (!options.length) return String(value || "");
    const raw = String(value || "");
    if (options.includes(raw)) return raw;
    const candidates = [raw];
    if (["业务类别", "被投诉业务类别"].includes(field.name) && entry["业务类型"]) candidates.push(String(entry["业务类型"]));
    const contained = options.find(option => candidates.some(candidate => candidate.includes(option) || option.includes(candidate)));
    if (contained) return contained;
    const aliases = {
      "业务办理渠道": { "移动客户端": "手机银行", "电子渠道": "手机银行", "柜面": "营业网点" },
      "被投诉业务办理渠道": { "电子渠道": "手机银行", "移动客户端": "手机银行", "柜面": "营业网点" },
      "修正业务办理渠道标签": { "柜面": "线下渠道", "网点": "线下渠道", "大堂": "线下渠道", "第三方": "第三方渠道" },
      "修正投诉诉求标签": { "协商": "协商处理", "费用": "费用减免", "道歉": "赔礼道歉", "更正": "信息更正" }
    }[field.name] || {};
    const alias = Object.keys(aliases).find(key => raw.includes(key));
    if (alias && options.includes(aliases[alias])) return aliases[alias];
    return options.includes("其它") ? "其它" : "";
  }

  function subprocessCopyRecipient(type, relatedTickets, values = {}) {
    const ticketId = normalizeRelatedTicketIds(relatedTickets)[0] || "";
    if (type === "撤销投诉") return COMPLAINT_WORK_POOL.assignment("ticket", ticketId).assignee || COMPLAINT_WORK_POOL.identity("handler").actor;
    if (type === "投诉校正") {
      const ticket = ticketRowById(ticketId);
      return documentRecordFor("ticket", ticket)?.fields?.entry?.["创建人"] || "陈敏慧-60157";
    }
    if (type === "延长申请") {
      if (extensionRequiresInitialApproval(ticketId, state.subprocessEditingId || "")) return "-";
      if (String(values["延长时间"] || "").includes("30")) return "审批员（总行消保部主管）";
    }
    return "-";
  }

  function createSubprocessRecord(type, relatedTickets, details = {}) {
    const definition = subprocessDefinition(type);
    const createdAt = systemTimestamp();
    const ticketIds = normalizeRelatedTicketIds(relatedTickets);
    const relatedTicket = ticketIds[0] || "";
    const triggerMode = type === "投诉问责" ? (details.triggerMode || "人工触发") : "";
    const status = details.status || subprocessInitialStatus(type, relatedTicket, triggerMode);
    const baseValues = subprocessTypeBaseValues(type, relatedTicket, createdAt);
    if (details.existingId) {
      const existing = [...(state.triggeredSubprocesses[relatedTicket] || []), ...Object.values(state.triggeredSubprocesses).flat()].find(item => item.id === details.existingId);
      const existingDocument = state.documentData.subprocesses?.[details.existingId];
      if (existing && existingDocument) {
        const typeBaseValues = scopedFormValues("subprocess-base." + type);
        const entryValues = scopedFormValues("subprocess." + type);
        if (type === "投诉校正") delete entryValues["__prefilledFor"];
        if (type === "异议核查") delete entryValues["__assignmentDefaultsInitialized"];
        const copyRecipient = subprocessCopyRecipient(type, ticketIds, { ...typeBaseValues, ...entryValues });
        existing.type = type;
        existing.relatedTicket = relatedTicket;
        existing.relatedTicketIds = ticketIds;
        existing.status = status;
        existing.relationStatus = status === "已办结" ? "无需后续节点，已办结" : status + "，尚未关联";
        existingDocument.relatedTicketIds = ticketIds;
        existingDocument.fields = existingDocument.fields || {};
        existingDocument.fields.base = { ...(existingDocument.fields.base || {}), "关联工单编号":ticketIds.join("、"), "处置期限":baseValues["处置期限"], ...typeBaseValues, ...(type === "投诉问责" ? { "触发方式":triggerMode } : {}), "抄送人":copyRecipient };
        existingDocument.fields.entry = entryValues;
        if (type === "投诉校正") existingDocument.fields.correctionOriginalValues = correctionOriginalEntrySnapshot();
        existingDocument.updatedAt = createdAt;
        const row = subprocessRows.find(item => item[0] === details.existingId);
        if (row) { row[2] = relatedTicket; row[3] = ticketRowById(relatedTicket)?.[2] || row[3]; row[5] = status; row[6] = createdAt; }
        persistWorkflowState();
        return existing;
      }
    }
    const id = generateDocumentId(type, createdAt);
    const record = {
      id, type, document: definition.document, relatedTicket, relatedTicketIds: ticketIds,
      mainTicket: details.mainTicket || "", note: details.note || "", createdAt,
      status, relationStatus: status === "已办结" ? "无需后续节点，已办结" : status + "，尚未关联", linked: status === "已办结"
    };
    state.triggeredSubprocesses[relatedTicket] = [...triggeredForTicket(relatedTicket), record];
    const ticket = ticketRowById(relatedTicket);
    // Work-pool routing compares this column with the active handler's institution,
    // not the creator's role/view label. Using "开发测试" made newly created
    // subprocesses look external and kept them out of the subprocess processing pool.
    const processingInstitution = COMPLAINT_WORK_POOL.identity("handler").organization || ticketReceivingInstitution(ticket) || currentRoleProfile().institutionLabel;
    subprocessRows.unshift([id, type, relatedTicket, ticket?.[2] || "待确认", processingInstitution, record.status, record.createdAt]);
    const typeBaseValues = scopedFormValues("subprocess-base." + type);
    const entryValues = scopedFormValues("subprocess." + type);
    if (type === "投诉校正") delete entryValues["__prefilledFor"];
    if (type === "异议核查") delete entryValues["__assignmentDefaultsInitialized"];
    const copyRecipient = subprocessCopyRecipient(type, ticketIds, { ...typeBaseValues, ...entryValues });
    state.documentData.subprocesses[id] = {
      id, documentType:type, schemaVersion:FORM_SCHEMA.meta?.version || "1.0.0", relatedTicketIds:ticketIds,
      fields: {
        base: {
          "创建人":"陈敏慧-60157", "所属机构":currentRoleProfile().institutionLabel, "所属部门":currentRoleProfile().departmentLabel || "-",
          "子流程单编号":id, "关联工单编号":ticketIds.join("、"), "申请时间":createdAt, "处置期限":baseValues["处置期限"],
          ...baseValues, ...typeBaseValues, ...(type === "投诉问责" ? { "触发方式":triggerMode } : {}), "抄送人":copyRecipient
        },
        entry:entryValues, ...(type === "投诉校正" ? { correctionOriginalValues:correctionOriginalEntrySnapshot() } : {}), processing:{}, review:{}, initialApproval:{}, approval:{}, supplement:{}
      },
      createdAt, updatedAt:createdAt
    };
    if (["待初审", "待审批"].includes(status)) setApprovalStage(id, status === "待初审" ? "initial" : "approval");
    persistWorkflowState();
    return record;
  }
  function isSmsContact(record) {
    return ["短信", "短信沟通"].includes(record?.method);
  }

  function contactSmsNumber(record, ticketId, index, records = []) {
    if (!isSmsContact(record)) return "-";
    const explicitNumber = record.smsNumber || record.approvalRequestId || (/^DX\d+$/.test(String(record.id || "")) ? record.id : "");
    if (explicitNumber) return explicitNumber;
    const smsIndex = records.slice(0, index + 1).filter(isSmsContact).length - 1;
    const linkedApprovals = approvalRows.filter(row => row[1] === "短信审批" && row[8] === ticketId);
    return linkedApprovals[smsIndex]?.[0] || "-";
  }

  function smsApprovalStatusForRecord(record) {
    if (!isSmsContact(record)) return "";
    // 无需审批的短信在审批状态列按空值规则展示为“-”，审批属性仍保留在记录中。
    if (record.approvalRequired === false) return "";
    if (record.smsApprovalStatus !== undefined) return record.smsApprovalStatus;
    const legacy = record.status || "";
    if (["待审批", "审批中"].includes(legacy)) return "待审批";
    if (["已通过", "审批通过", "已发送"].includes(legacy)) return "已通过";
    if (["已驳回", "申请驳回", "审批驳回"].includes(legacy)) return "已驳回";
    return "";
  }

  function contactStatusForRecord(record) {
    if (record?.method === "短信沟通") {
      // 短信平台无法逐笔确认客户是否真实送达，联系状态只表达平台接口调用结果。
      if (record.approvalRequired !== false && smsApprovalStatusForRecord(record) !== "已通过") return "";
      const explicit = String(record.platformCallStatus || "").trim();
      const platformResult = explicit || String(record.sendStatus || record.status || "").trim();
      if (["调用失败", "发送失败"].includes(platformResult)) return "调用失败";
      if (["调用成功", "已发送", "已送达", "未送达", "审批通过", "已联系"].includes(platformResult)) return "调用成功";
      return "";
    }
    if (record.contactStatus !== undefined) return record.contactStatus;
    const legacy = record.status || "";
    if (["一键外呼", "电话"].includes(record.method)) {
      if (["已联系", "未接通"].includes(legacy)) return legacy;
      return "";
    }
    return legacy === "已联系" ? "已联系" : "";
  }

  function contactTimeForRecord(record) {
    return ["已联系", "调用成功"].includes(contactStatusForRecord(record)) ? String(record?.time || "").trim() : "";
  }

  function smsSendStatusForRecord(record) {
    if (!isSmsContact(record)) return "";
    if (record.sendStatus !== undefined) return record.sendStatus;
    if (["已发送", "审批通过"].includes(record.status)) return "已送达";
    if (record.status === "发送失败") return "未送达";
    if (["审批中", "待审批", "申请驳回", "已驳回"].includes(record.status)) return "未发送";
    return "";
  }

  function isSettlementNotificationSms(record) {
    return isSmsContact(record) && record?.template === "办结告知短信";
  }

  function isEffectiveFollowUpContact(record) {
    if (!record || isSmsContact(record) || contactStatusForRecord(record) !== "已联系") return false;
    return true;
  }

  function processingSmsSubmissionGate(ticketId = state.detailId) {
    const records = contactRecordsForTicket(ticketRowById(ticketId));
    if (records.some(record => isSettlementNotificationSms(record) && smsApprovalStatusForRecord(record) === "待审批")) return "pending";
    if (records.some(isEffectiveFollowUpContact)) return "";
    let latestRejectedIndex = -1;
    for (let index = records.length - 1; index >= 0; index -= 1) {
      if (isSettlementNotificationSms(records[index]) && smsApprovalStatusForRecord(records[index]) === "已驳回") {
        latestRejectedIndex = index;
        break;
      }
    }
    if (latestRejectedIndex < 0) return "";
    return records.slice(latestRejectedIndex + 1).some(isEffectiveFollowUpContact) ? "" : "rejected";
  }

  function contactStatusCell(value) {
    if (!value) return "-";
    // 联系记录与系统其他状态标签共用统一语义色，避免待审批、驳回和失败状态都退化成灰色。
    return statusTag(value);
  }

  function contactAttachmentState(record) {
    const explicit = String(record?.attachmentStatus || "").trim().toLowerCase();
    const attachment = String(record?.attachment || "").trim();
    if (explicit === "failed" || attachment === "回传失败") return { status:"failed", attachment:"" };
    if (explicit === "pending" || !attachment || attachment === "-") return { status:"pending", attachment:"" };
    return { status:"success", attachment };
  }

  function contactTranscriptState(record) {
    const explicit = String(record?.transcriptStatus || "").trim().toLowerCase();
    if (explicit === "failed" || record?.transcript === "回传失败") return { status:"failed", transcript:[] };
    const transcript = Array.isArray(record?.transcript) ? record.transcript : [];
    if (explicit === "processing") return { status:"processing", transcript:[] };
    if (explicit === "pending" || !transcript.length) return { status:"pending", transcript:[] };
    return { status:"success", transcript };
  }

  function contactAttachmentCell(record, index, ticketId) {
    // 所有沟通方式统一提供附件入口，具体状态在弹窗内说明。
    return '<button type="button" class="btn-link" data-action="contact-attachment" data-id="' + index + '" data-ticket="' + escapeAttribute(ticketId || "") + '">查看附件</button>';
  }
  function contactToolbar(readOnly = false, ticketId = "") {
    const disabled = readOnly ? ' disabled aria-disabled="true"' : '';
    return '<div class="contact-toolbar' + (readOnly ? ' is-readonly' : '') + '"><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="call-customer"' + disabled + '>' + icon("phone") + ' \u4e00\u952e\u5916\u547c</button><button type="button" class="btn xib-btn xib-btn--secondary" data-action="send-sms"' + disabled + '>' + icon("notice") + ' \u77ed\u4fe1\u6c9f\u901a</button><button type="button" class="btn xib-btn xib-btn--secondary" data-action="add-contact"' + disabled + '>' + icon("plus") + ' \u65b0\u5efa\u8054\u7cfb\u8bb0\u5f55</button><button type="button" class="btn xib-btn xib-btn--secondary" data-action="query-sms-receipt" data-ticket="' + escapeAttribute(ticketId) + '">' + icon("search") + ' \u67e5\u8be2\u77ed\u4fe1\u53d1\u9001\u56de\u6267</button></div>';
  }

  function openSmsReceiptQuery(ticket = activeContactTicket()) {
    const row = ticket || activeContactTicket();
    const ticketId = row?.[0] || "";
    const records = contactRecordsForTicket(row);
    const smsRecords = records.map((record, index) => ({ record, index })).filter(item => isSmsContact(item.record));
    const profile = contactProfile(row);
    const phones = [...new Set([
      ...(profile.numbers || []).map(item => item.value),
      ...smsRecords.map(item => item.record.receiver)
    ].map(value => String(value || "").trim()).filter(Boolean))];
    const dates = smsRecords.map(item => String(item.record.time || "").slice(0, 10)).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
    const startDate = dates[0] || "";
    const endDate = dates[dates.length - 1] || startDate;
    const phoneOptions = phones.length
      ? phones.map(value => '<option value="' + escapeAttribute(value) + '">' + escapeAttribute(value) + '</option>').join("")
      : '<option value="">暂无可查询手机号</option>';
    const content = '<div class="sms-receipt-query"><div class="contact-modal-intro"><strong>按短信平台支持的条件查询</strong><span>查询结果仅供业务人员人工核对，不会自动回写或判断短信是否真实送达客户。</span></div><div class="form-grid"><div class="form-item"><label class="form-label required" for="sms-receipt-phone">手机号</label><div class="form-control"><select class="di-native-select is-fluid" id="sms-receipt-phone">' + phoneOptions + '</select></div></div><div class="form-item"><label class="form-label required" for="sms-receipt-start">开始日期</label><div class="form-control"><input class="di-input is-fluid" id="sms-receipt-start" type="date" value="' + escapeAttribute(startDate) + '"></div></div><div class="form-item"><label class="form-label required" for="sms-receipt-end">结束日期</label><div class="form-control"><input class="di-input is-fluid" id="sms-receipt-end" type="date" value="' + escapeAttribute(endDate) + '"></div></div></div></div>';
    openModal("查询短信发送回执", content, "查询", () => {
      const phoneControl = document.getElementById("sms-receipt-phone");
      const startControl = document.getElementById("sms-receipt-start");
      const endControl = document.getElementById("sms-receipt-end");
      const phone = phoneControl?.value.trim() || "";
      const start = startControl?.value || "";
      const end = endControl?.value || "";
      if (!phone) return showOverlayValidationError("请选择需要查询的手机号。", phoneControl);
      if (!start || !end) return showOverlayValidationError("请选择完整的日期区间。", !start ? startControl : endControl);
      if (start > end) return showOverlayValidationError("开始日期不能晚于结束日期。", startControl);
      const matches = smsRecords.filter(({ record }) => {
        const sentDate = String(record.time || "").slice(0, 10);
        return String(record.receiver || "").trim() === phone && sentDate >= start && sentDate <= end;
      });
      const resultRows = matches.map(({ record, index }) => {
        const receipt = String(record.platformReceipt || record.deliveryReceipt || record.receiptStatus || smsSendStatusForRecord(record) || "暂无回执").trim();
        return '<tr><td>' + escapeAttribute(contactSmsNumber(record, ticketId, index, records)) + '</td><td>' + escapeAttribute(record.time || "-") + '</td><td>' + escapeAttribute(phone) + '</td><td>' + escapeAttribute(receipt) + '</td></tr>';
      }).join("");
      const table = resultRows
        ? '<div class="table-wrap"><table class="table ds-table"><thead><tr><th>短信编号</th><th>发送时间</th><th>手机号</th><th>短信平台原始回执</th></tr></thead><tbody>' + resultRows + '</tbody></table></div>'
        : '<div class="app-empty-state"><h4>该手机号在所选日期区间内暂无短信回执记录</h4></div>';
      const result = '<div class="sms-receipt-result"><div class="contact-modal-intro"><strong>查询条件：' + escapeAttribute(phone) + '，' + escapeAttribute(start) + ' 至 ' + escapeAttribute(end) + '</strong><span>请业务人员结合短信平台原始回执自行判断是否真实送达，本查询不会改变联系记录状态。</span></div>' + table + '</div>';
      openModal("短信发送回执查询结果", result, "关闭", closeOverlay, { hideCancel:true });
    });
  }

  function canResendSmsRecord(record) {
    if (!isSmsContact(record) || contactStatusForRecord(record) !== "调用失败") return false;
    return record.approvalRequired !== true || smsApprovalStatusForRecord(record) === "已通过";
  }

  function canEditRejectedSmsRecord(record) {
    return isSmsContact(record) && smsApprovalStatusForRecord(record) === "已驳回";
  }

  function contactDepartmentDisplay(record, row) {
    // 处理机构已单独展示，处理部门仅显示部门名称。
    const department = String(record.department || ticketReceivingDepartment(row) || "").trim();
    const institution = String(record.org || ticketReceivingInstitution(row) || "").trim();
    if (!department || department === "-") return "-";
    const withoutCurrentInstitution = institution && institution !== "-" && institution !== "系统" && department.startsWith(institution)
      ? department.slice(institution.length) : department;
    // 历史记录可能带有其他机构前缀，如“总行消费者权益保护部”。
    return withoutCurrentInstitution.replace(/^(?:总行|[^\s/／]+?分行)[\s/／·-]*/, "").trim() || "-";
  }

  function contactRecordPresentationRows(records) {
    // 宣讲顺序依次按：沟通方式、短信审批状态、联系状态、联系内容、附件、操作。
    const methodOrder = ["一键外呼", "短信沟通", "电话", "短信", "邮件", "微信", "面访", "其它"];
    const approvalOrder = ["已通过", "已驳回", "待审批", "-"];
    const contactOrder = ["调用成功", "调用失败", "已联系", "未接通", "-"];
    const attachmentOrder = ["success", "processing", "pending", "failed"];
    const operationValue = record => canEditRejectedSmsRecord(record) ? "编辑" : canResendSmsRecord(record) ? "重发" : "-";
    const operationOrder = ["编辑", "重发", "-"];
    const rank = (order, value) => {
      const index = order.indexOf(value);
      return index < 0 ? order.length : index;
    };
    const attachmentValue = record => {
      const attachment = contactAttachmentState(record);
      if (attachment.status === "success" && contactTranscriptState(record).status === "processing") return "processing";
      return attachment.status;
    };
    const sortKeys = record => [
      rank(methodOrder, record.method || "其它"),
      rank(approvalOrder, smsApprovalStatusForRecord(record)),
      rank(contactOrder, contactStatusForRecord(record)),
      record.content || record.feedback ? 0 : 1,
      rank(attachmentOrder, attachmentValue(record)),
      rank(operationOrder, operationValue(record))
    ];
    const sorted = records.map((record, index) => ({ record, index, keys:sortKeys(record) }))
      .sort((left, right) => {
        for (let index = 0; index < left.keys.length; index += 1) {
          if (left.keys[index] !== right.keys[index]) return left.keys[index] - right.keys[index];
        }
        return left.index - right.index;
      });
    // 每笔联系记录都有独立的时间和内容，排序时不能按展示状态合并真实记录。
    return sorted;
  }

  function contactOperationColumnVisible(row, readOnly = true, processingSurface = false) {
    return !readOnly && processingSurface;
  }

  function processingContactTable(row, readOnly = false, ticketProcessing = false) {
    const records = contactRecordsForTicket(row);
    const showOperationColumn = contactOperationColumnVisible(row, readOnly, ticketProcessing);
    const head = ticketProcessing
      ? '<th>短信编号</th><th>联系时间</th><th>联系人</th><th>处理机构</th><th>处理部门</th><th>沟通方式</th><th>短信审批状态</th><th>联系状态</th><th>联系内容</th><th>附件</th>' + (showOperationColumn ? '<th>操作</th>' : '')
      : '<th>短信编号</th><th>联系时间</th><th>联系人</th><th>处理机构</th><th>沟通方式</th><th>短信审批状态</th><th>联系状态</th><th>联系内容</th><th>附件</th>' + (showOperationColumn ? '<th>操作</th>' : '');
    // 宣讲视图直接展示全部联系记录，便于一次查看所有枚举场景。
    const body = contactRecordPresentationRows(records).map(({ record, index }) => {
      const contactPerson = record.operator || contactOperatorForTicket(row);
      const department = contactDepartmentDisplay(record, row);
      // 待审批不可操作；驳回可编辑；通过后仅发送失败的短信可重发。
      const operation = canEditRejectedSmsRecord(record)
        ? `<button type="button" class="btn-link" data-action="edit-rejected-sms" data-id="${index}" data-ticket="${row[0]}">编辑</button>`
        : canResendSmsRecord(record)
          ? `<button type="button" class="btn-link" data-action="resend-sms" data-id="${index}" data-ticket="${row[0]}">重发</button>`
          : "-";
      return `<tr><td>${escapeAttribute(contactSmsNumber(record, row[0], index, records))}</td><td>${escapeAttribute(contactTimeForRecord(record) || "-")}</td><td>${escapeAttribute(ticketProcessing ? contactPerson : record.contact)}</td><td>${escapeAttribute(record.org)}</td>${ticketProcessing ? `<td>${escapeAttribute(department)}</td>` : ""}<td>${escapeAttribute(record.method + (record.template ? " · " + record.template : ""))}</td><td>${contactStatusCell(smsApprovalStatusForRecord(record))}</td><td>${contactStatusCell(contactStatusForRecord(record))}</td><td><button type="button" class="btn-link" data-action="contact-detail" data-id="${index}" data-ticket="${row[0]}">查看内容</button></td><td>${contactAttachmentCell(record, index, row[0])}</td>${showOperationColumn ? `<td class="operation-cell">${operation}</td>` : ""}</tr>`;
    }).join("");
    const tableTitle = ticketProcessing ? '<div class="contact-record-table-title"><span>联系记录</span><small>沟通结束或短信审批通过后自动生成</small></div>' : '';
    // 联系记录下方统一提示一键外呼的核查范围。
    const inspectionReminder = ticketProcessing && ["投诉单", "信访单"].includes(row?.[1]) ? '<div class="contact-record-inspection-reminder"><strong>注意：</strong>所有告知方式为“一键外呼”的联系记录，均会进行沟通规范智能核查。其中，针对告知客户的录音还会核查投诉时间、投诉渠道、投诉内容、处理结果及救济途径的告知情况。请确保沟通规范、告知完整。</div>' : '';
    return contactToolbar(readOnly, row?.[0] || "") + tableTitle + inspectionReminder + `<div class="table-wrap"><table class="table ds-table contact-record-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function repeatRelationForTicket(ticketId = state.detailId) {
    return state.repeatRelations[ticketId] || automaticRepeatRelationForTicket(ticketId) || null;
  }

  function renderAgainComplaintSection(row) {
    const scope = "processing." + row[0];
    const selected = state.formValues[scope + ".是否再次投诉"] || "否";
    const relatedTicket = state.formValues[scope + ".关联未归档工单主单编号"] || "";
    const note = state.formValues[scope + ".情况说明"] || "";
    const relation = repeatRelationForTicket(row[0]);
    const noteField = PROCESSING_FIELDS.find(field => field.name === "情况说明");
    const relatedField = PROCESSING_FIELDS.find(field => field.name === "关联未归档工单主单编号");
    const difference = selected === "是" ? `<div class="form-item"><label class="form-label required" for="repeat-main-ticket">${relatedField?.name || "关联未归档工单主单编号"}</label><div class="form-control"><div class="form-control-action"><input class="di-input is-fluid" id="repeat-main-ticket" data-field-key="${scope}.关联未归档工单主单编号" value="${relatedTicket}" placeholder="${relatedField?.placeholder || "查询并选择历史未归档工单"}"><button type="button" class="btn xib-btn xib-btn--secondary" data-action="search-repeat-ticket">查询工单</button></div><small>按同一客户、15 个自然日及业务类别中类查询</small></div></div><div class="form-item span-2">${renderField(noteField, scope)}</div><div class="repeat-reuse-note span-2">提交处理结果后进入工单审批；审批通过后，当前工单将作为“再次投诉单”与所选主工单关联，并复用主工单处理结果共同办结。</div>` : "";
    const relationStatus = relation ? `<div class="repeat-relation-status"><span>当前关系状态</span>${statusTag(relation.status)}<small>${relation.mainTicket ? "关联主工单：" + relation.mainTicket : ""}</small></div>` : "";
    const againField = PROCESSING_FIELDS.find(field => field.name === "是否再次投诉") || { name:"是否再次投诉", type:"radio", all:true, required:true, defaultValue:"否", options:["是","否"] };
    return `<section class="form-section processing-section" id="section-processing-repeat"><div class="form-section-head"><span>再次投诉</span></div><div class="form-section-body"><div class="process-rule-note">判断参考：15 个自然日内，同一客户、同一事项再次投诉，且业务类别中类一致。</div><div class="form-grid repeat-complaint-grid">${renderField(againField, scope)}${difference}</div>${relationStatus}</div></section>`;
  }

  const HANDLER_CREATE_TYPES = ["投诉校正", "延长申请", "投诉问责", "剔除申请", "异常投诉", "纠纷化解", "废止申请"];
  const OPERATOR_CREATE_TYPES = {
    "customer-operator": ["投诉校正", "撤销投诉", "废止申请"],
    "branch-operator": ["投诉校正", "撤销投诉", "废止申请"],
    "branch-consumer-operator": ["投诉校正", "投诉调查", "撤销投诉", "投诉问责", "剔除申请", "异常投诉", "异议核查", "废止申请"],
    "head-consumer-operator": ["投诉校正", "投诉调查", "撤销投诉", "剔除申请", "异常投诉", "异议核查", "废止申请"]
  };
  const APPROVER_SUBPROCESS_TYPES = {
    "branch-unit-approver": [],
    "branch-department-approver": [],
    "branch-consumer-approver": ["投诉校正", "投诉调查", "投诉问责", "剔除申请", "异常投诉", "纠纷化解", "异议核查", "废止申请"],
    "branch-lead-approver": ["延长申请"],
    "head-department-approver": ["延长申请", "投诉问责", "纠纷化解"],
    "head-consumer-approver": ["投诉校正", "投诉调查", "剔除申请", "异常投诉", "异议核查", "废止申请"],
    "head-supervisor-approver": ["延长申请"]
  };

  function subprocessCapabilities(type, hasRecord = false) {
    const profile = currentRoleProfile();
    if (profile.role === "developer") return { create: true, process: hasRecord, review: hasRecord, approve: hasRecord };
    if (profile.role === "handler") return { create: HANDLER_CREATE_TYPES.includes(type), process: hasRecord, review: false, approve: false };
    if (profile.role === "operator") {
      const allowedTypes = OPERATOR_CREATE_TYPES[profile.id] || [];
      return { create: allowedTypes.includes(type), process: false, review: hasRecord && ["投诉调查", "剔除申请", "异常投诉", "异议核查"].includes(type), approve: false };
    }
    if (profile.role === "reviewer") return { create: false, process: false, review: hasRecord && type === "投诉校正", approve: false };
    if (profile.role === "approver") return { create: false, process: false, review: false, approve: hasRecord && (APPROVER_SUBPROCESS_TYPES[profile.id] || []).includes(type) };
    if (profile.role === "analyst") return { create: false, process: false, review: hasRecord && type === "废止申请", approve: false };
    return { create: false, process: false, review: false, approve: false };
  }

  function creatableSubprocessDefinitions() {
    return SUBPROCESS_DEFINITIONS.filter(definition => !["溯源整改", "督导函"].includes(definition.type) && subprocessCapabilities(definition.type, false).create);
  }

  function subprocessPhase(status) {
    if (["草稿", "待提交", "待复核", "复核中"].includes(status)) return "创建";
    if (["待处理", "处理中", "会签中"].includes(status)) return "处理";
    if (["待审批", "审批中"].includes(status)) return "审核";
    if (["已办结", "已完成"].includes(status)) return "办结";
    return "";
  }

  const SUBPROCESS_PHASE_MATRIX = PROTOTYPE_CONFIG.subprocessInitiationRules?.matrix || {};
  const SUBPROCESS_MULTI_SELECT_TYPES = PROTOTYPE_CONFIG.subprocessInitiationRules?.multiSelectOnly || ["剔除申请", "异常投诉", "纠纷化解"];

  function subprocessSourceTicketRows() {
    const multi = Array.isArray(state.subprocessSourceTickets) ? state.subprocessSourceTickets.filter(Boolean) : [];
    if (multi.length) return multi.map(id => ticketRows.find(row => row[0] === id)).filter(Boolean);
    if (state.subprocessSourceTicket) {
      const row = ticketRows.find(item => item[0] === state.subprocessSourceTicket);
      return row ? [row] : [];
    }
    return [];
  }

  function subprocessSourceTicketRow() {
    return subprocessSourceTicketRows()[0] || null;
  }

  function subprocessInitiationAvailability(definition, ticketRow = subprocessSourceTicketRow(), options = {}) {
    const profile = currentRoleProfile();
    const requireApplicationDate = options.requireApplicationDate === true;
    const rows = Array.isArray(ticketRow) && Array.isArray(ticketRow[0]) ? ticketRow.filter(Boolean) : (ticketRow ? [ticketRow] : subprocessSourceTicketRows());
    if (!rows.length) return { enabled: false, reason: "请先查询并关联工单" };
    if (requireApplicationDate && !String(state.formValues["子流程-申请时间"] || "").trim()) return { enabled: false, reason: "申请时间由系统在提交后生成" };
    if (!["operator", "handler", "developer"].includes(profile.role)) return { enabled: false, reason: "仅经办员、处理员可发起" };
    if (profile.role !== "developer" && !subprocessCapabilities(definition.type, false).create) return { enabled: false, reason: "当前机构角色无发起权限" };
    if (rows.length > 1 && !SUBPROCESS_MULTI_SELECT_TYPES.includes(definition.type)) {
      return { enabled: false, reason: "多选关联工单仅支持发起" + SUBPROCESS_MULTI_SELECT_TYPES.join("、") };
    }
    for (const row of rows) {
      const ticketType = row[1];
      const phase = subprocessPhase(row[5]);
      const allowedPhases = SUBPROCESS_PHASE_MATRIX[ticketType]?.[definition.type] || [];
      const phaseMatches = allowedPhases.includes(phase) || (phase === "审核" && allowedPhases.includes("审批"));
      if (!phaseMatches) return { enabled: false, reason: row[0] + "（" + ticketType + " / " + row[5] + "）不可发起" };
      if (profile.role === "handler" && phase !== "处理") return { enabled: false, reason: "处理员仅可在处理阶段发起" };
    }
    return { enabled: true, reason: "可发起" };
  }

  function subprocessFlow(type, row = null) {
    const profile = currentRoleProfile();
    const currentOrg = profile.role === "developer" ? "发起机构" : profile.orgLabel;
    const consumerOrg = profile.org.startsWith("head") ? "总行消保" : "分行消保";
    if (type === "溯源整改") return [[consumerOrg, "经办员", "创建整改单"], [currentOrg, "处理员", "制定计划 / 填写结果"], [currentOrg, "部门审批员", "阶段初审"], [consumerOrg, "审批员", "阶段审批"], ["总行消保部", "主管", "知悉 / 终审"]];
    const steps = [[currentOrg, "经办员", "创建 / 保存草稿"]];
    if (subprocessSupportsStatus(type, "待复核")) steps.push(["客服渠道", "复核员", "复核（仅客服渠道）"]);
    if (subprocessSupportsStatus(type, "待处理") && subprocessHasProcessingStage(type, row)) steps.push([currentOrg, "处理员", "业务处理"]);
    if (subprocessSupportsStatus(type, "待审批")) {
      if (SUBPROCESS_INITIAL_APPROVAL_TYPES.has(type) || (type === "延长申请" && extensionRequiresInitialApproval(state.subprocessSourceTicket || state.detailId))) steps.push([consumerOrg, "初审员", "初审"]);
      steps.push([consumerOrg, "审批员", "审批"]);
    }
    if (subprocessSupportsStatus(type, "待补录")) steps.push([consumerOrg, "经办员", "结果补录"]);
    steps.push(["系统", "系统", "办结 / 归档"]);
    return steps;
  }

  function renderSubprocessFlow(type, row = null) {
    const steps = subprocessFlow(type, row);
    return `<div class="subprocess-flow" aria-label="${type}流程">${steps.map((step, index) => `<div class="subprocess-flow-step"><span>${index + 1}</span><div><strong>${step[0]}</strong><small>${step[1]}</small><b>${step[2]}</b></div></div>${index < steps.length - 1 ? `<i>→</i>` : ""}`).join("")}</div>`;
  }

  function renderLinkedSubprocessSection(row, policy = workflowPolicy("ticket", row)) {
    const allRecords = linkedSubprocessRecords(row[0]);
    // 可发起类型以当前规则为准；历史上已产生的关联子单始终保留查看，
    // 即使后续规则收窄了该工单类型可发起的子流程范围。
    const allowedTypes = SUBPROCESS_PHASE_MATRIX[row?.[1]] || {};
    const historicalTypes = new Set(allRecords.map(record => record.type));
    const definitions = SUBPROCESS_DEFINITIONS.filter(definition =>
      definition.type !== "督导函" &&
      definition.type !== "溯源整改" &&
      (Object.prototype.hasOwnProperty.call(allowedTypes, definition.type) || historicalTypes.has(definition.type))
    );
    const body = definitions.map(definition => {
      const records = allRecords.filter(record => record.type === definition.type && record.id);
      const currentlyAllowed = Object.prototype.hasOwnProperty.call(allowedTypes, definition.type);
      const capabilities = subprocessCapabilities(definition.type, records.length > 0);
      const availability = subprocessInitiationAvailability(definition, row, { requireApplicationDate: false });
      const expanded = state.expandedSubprocessFlows.has(definition.type);
      let createReason = "";
      if (!currentlyAllowed) createReason = "该类型仅保留历史记录，当前工单类型不可发起";
      else if (!policy.canStartSubprocess) createReason = "当前状态/权限无法发起";
      else if (!capabilities.create) createReason = "当前机构角色无发起权限";
      else if (records.length && !definition.repeatable) createReason = "该类型已发起";
      else if (!availability.enabled) createReason = availability.reason;
      const createAction = createReason
        ? '<span class="subprocess-action-slot subprocess-action-disabled"><button type="button" class="btn-link" disabled>发起</button><button type="button" class="disabled-reason-trigger" data-tooltip="' + escapeAttribute(createReason) + '" aria-label="查看不可发起原因">' + icon("info") + '</button></span>'
        : '<span class="subprocess-action-slot subprocess-action-enabled"><button type="button" class="btn-link" data-action="quick-subprocess" data-subprocess-type="' + definition.type + '">发起</button><span class="disabled-reason-placeholder" aria-hidden="true"></span></span>';
      const displayedRecords = records.length ? records : [null];
      const recordRows = displayedRecords.map((record, index) => {
        const countNote = records.length > 1 ? '<small>' + records.length + ' 条子单</small>' : '';
        const typeCell = index === 0 ? '<td class="linked-subprocess-type-cell" rowspan="' + displayedRecords.length + '"><strong>' + definition.type + '</strong>' + countNote + '</td>' : '';
        const applicationStatus = record ? statusTag(record.status) : '<span class="ds-tag is-dot is-gray">未发起</span>';
        const idCell = record ? '<button type="button" class="btn-link" data-action="open-related-subprocess" data-id="' + record.id + '">' + record.id + '</button>' : '-';
        const conclusion = renderSubprocessConclusion(record || { type: definition.type });
        const createSlot = index === 0 ? createAction : '<span class="subprocess-action-slot subprocess-action-placeholder" aria-hidden="true"></span>';
        const actions = createSlot;
        return '<tr data-linked-subprocess-type="' + definition.type + '" data-linked-subprocess-id="' + (record?.id || '') + '">' + typeCell + '<td>' + applicationStatus + '</td><td>' + idCell + '</td><td class="subprocess-conclusion-cell">' + conclusion + '</td><td class="operation-cell"><div class="row-actions">' + actions + '</div></td></tr>';
      }).join("");
      const flowRow = records.length ? '' : '<tr class="subprocess-flow-row" data-flow-row="' + definition.type + '" ' + (expanded ? '' : 'hidden') + '><td colspan="5">' + renderSubprocessFlow(definition.type) + '</td></tr>';
      return recordRows + flowRow;
    }).join("");
    return '<section class="form-section processing-section" id="section-processing-subprocess"><div class="form-section-head"><span>关联子流程</span></div><div class="form-section-body subprocess-list-body"><div class="table-wrap"><table class="table ds-table linked-subprocess-table"><thead><tr><th>子流程类型</th><th>申请状态</th><th>子单编号</th><th>关联子单处理结果</th><th>操作</th></tr></thead><tbody>' + body + '</tbody></table></div></div></section>';
  }

  const COUNTERSIGN_PROCESSING_FIELDS = new Set(["是否会签", "会签机构", "会签部门", "会签人"]);
  const REPEAT_PROCESSING_FIELDS = new Set(["是否再次投诉", "关联未归档工单主单编号", "情况说明"]);                    
  const INTELLIGENT_INSPECTION_PROCESSING_FIELDS = new Set(["处理结果是否告知", "告知时间", "救济途径是否告知"]);
  const META_PROCESSING_FIELDS = () => PROCESSING_FIELDS.filter(field => field.displaySection === "事件处理信息");
  function approvalInspectionRecord(ticketId) {
    const library = window.XIB_COMPLAINT_INSPECTIONS_DATA?.ticketInspectionRecords;
    return Array.isArray(library) ? library.find(item => item.id === ticketId) || null : null;
  }

  function inspectionRunsFor(row) {
    const seededRuns = approvalInspectionRecord(row?.[0])?.inspectionRuns;
    const submittedRuns = documentRecordFor("ticket", row)?.inspectionRuns;
    return [
      ...(Array.isArray(seededRuns) ? seededRuns : []),
      ...(Array.isArray(submittedRuns) ? submittedRuns : [])
    ].filter(run => run?.submittedAt && run?.findings)
      .sort((left, right) => String(left.submittedAt).localeCompare(String(right.submittedAt), "zh-CN"));
  }

  function latestInspectionRun(row) {
    return inspectionRunsFor(row).at(-1) || null;
  }

  function shouldShowIntelligentInspection(row) {
    // 投诉单和信访单在处理阶段展示待生成状态，提交处理后继续在会签、审批阶段展示核查结果。
    return ["投诉单", "信访单"].includes(row?.[1]) && ["待处理", "处理中", "会签中", "待审批", "审批中"].includes(row?.[5]);
  }

  function renderApprovalIntelligentInspectionSection(row) {
    // 处理阶段只展示待生成状态；进入会签、审批详情时才兼容补齐旧浏览器数据中尚未保存的核查结果。
    let run = latestInspectionRun(row);
    if (!run && !["待处理", "处理中"].includes(row?.[5])) {
      run = recordSubmittedInspectionRun(row, contactTimeDisplay(row?.[6] || systemTimestamp()));
      if (run) persistWorkflowState();
    }
    // 核查明细关联实际的一键外呼记录，并沿用附件中的录音编号。
    const outboundRecords = contactRecordsForTicket(row).filter(record => record.method === "一键外呼").map(record => ({
      time:record.time,
      contactStatus:record.contactStatus,
      recordingId:contactRecordingId(record, row)
    }));
    // 普通工单按真实状态展示；指定演示工单同页补充无数据、生成中、生成失败三种状态。
    const findingsMarkup = window.XIBComplaintInspections?.renderInspectionFindings?.(run?.findings || {}, { ticketId:row?.[0], ticketType:row?.[1], ticketStatus:row?.[5], outboundRecords, showStateExamples:row?.[0] === "TS202610190114" }) || "";
    return '<section class="form-section processing-section approval-intelligent-inspection-section" id="section-intelligent-inspection" data-inspection-ticket-id="' + escapeAttribute(row?.[0] || "") + '" data-inspection-submitted-at="' + escapeAttribute(run?.submittedAt || "") + '"><div class="form-section-head"><span>智能核查</span></div><div class="form-section-body">' + findingsMarkup + '</div></section>';
  }

  function recordSubmittedInspectionRun(row, submittedAt = systemTimestamp()) {
    // 投诉单和信访单提交后生成工单核查结果；录音核查仍按回传状态单独判断。
    if (!["投诉单", "信访单"].includes(row?.[1])) return null;
    const record = documentRecordFor("ticket", row);
    if (!record) return null;
    const previous = latestInspectionRun(row);
    const run = previous ? { ...deepClone(previous), submittedAt } : {
      submittedAt,
      findings:{
        entry:{ passed:true, nonCompliantItems:[], conclusion:"录入内容完整，未发现不合规项目。" },
        communications:{ passed:true, items:[] },
        productBusiness:{ passed:true, items:[] }
      }
    };
    record.inspectionRuns = Array.isArray(record.inspectionRuns) ? record.inspectionRuns : [];
    record.inspectionRuns.push(run);
    record.updatedAt = submittedAt;
    return run;
  }

  function restoreCountersignProcessingValues(row, scope) {
    if (row[1] !== "投诉单") return;
    const stored = documentRecordFor("ticket", row)?.fields?.processing || {};
    if (state.formValues[scope + ".是否会签"] === undefined && stored["是否会签"] !== undefined) state.formValues[scope + ".是否会签"] = deepClone(stored["是否会签"]);
    const selected = state.formValues[scope + ".会签机构"] ?? stored["会签机构"];
    if (state.formValues[scope + ".会签机构"] === undefined && selected !== undefined) state.formValues[scope + ".会签机构"] = deepClone(selected);
    const departments = stored["会签部门"] ?? stored["会签人"];
    if (state.formValues[scope + ".会签部门"] === undefined && departments !== undefined) state.formValues[scope + ".会签部门"] = Array.isArray(departments) ? deepClone(departments) : [departments];
  }
  function restoreComplaintObjectProcessingValue(row, scope) {
    if (row[1] !== "投诉单") return;
    const key = scope + ".投诉对象";
    if (state.formValues[key] !== undefined) return;
    const record = documentRecordFor("ticket", row);
    state.formValues[key] = record?.fields?.processing?.["投诉对象"] ?? record?.fields?.entry?.["投诉/信访对象"] ?? "-";
  }
  function restoreStoredProcessingValues(row, scope) {
    const stored = documentRecordFor("ticket", row)?.fields?.processing || {};
    Object.entries(stored).forEach(([name, value]) => {
      const key = scope + "." + name;
      if (state.formValues[key] === undefined) state.formValues[key] = deepClone(value);
    });
  }
  function restoreReliefNoticeProcessingValues(row, scope) {
    if (row[1] !== "投诉单") return;
    const record = documentRecordFor("ticket", row);
    const stored = record?.fields?.processing || {};
    const noticeKey = scope + ".救济途径是否告知";
    if (state.formValues[noticeKey] === undefined && stored["救济途径是否告知"] !== undefined) {
      const legacy = stored["救济途径是否告知"];
      const values = Array.isArray(legacy) ? legacy : String(legacy || "").split(/[、,，]/).map(value => value.trim()).filter(Boolean);
      const isNo = values.length === 1 && values[0] === "否";
      state.formValues[noticeKey] = isNo ? "否" : "是";
    }
  }
  function renderProcessingWorkspace(row) {
    const type = row[1];
    state.workOrderType = type;
    const scope = "processing." + row[0];
    restoreStoredProcessingValues(row, scope);
    const processingRecord = documentRecordFor("ticket", row);
    const resultNoticeKey = scope + ".处理结果是否告知";
    if (state.formValues[resultNoticeKey] === undefined) {
      state.formValues[resultNoticeKey] = processingRecord?.fields?.processing?.["处理结果是否告知"] || "";
    }
    restoreComplaintObjectProcessingValue(row, scope);
    restoreCountersignProcessingValues(row, scope);
    restoreReliefNoticeProcessingValues(row, scope);
    const policy = workflowPolicy("ticket", row);
    const repeatComplaint = type === "投诉单" && (state.formValues[scope + ".是否再次投诉"] || "否") === "是";
    const approvalFull = state.approvalContext?.mode === "full" && state.approvalContext?.type === "工单审批";
    const approvalView = Boolean(state.approvalContext);
    const showRiskAndInspection = ["投诉单", "信访单"].includes(type);
    const showIntelligentInspection = shouldShowIntelligentInspection(row);
    // 待处理和处理中将告知字段并入处理结果；智能核查在提交前展示空状态，提交后展示结果。
    const showInspectionNotice = showRiskAndInspection && ["待处理", "处理中"].includes(row[5]);
    const processingStage = showInspectionNotice;
    const sections = [
      { id: "processing-meta", title: "事件处理信息" },
      ...(showRiskAndInspection ? [{ id: "risk-summary", title: "异常风险识别" }] : []),
      ...(type === "投诉单" ? [{ id: "processing-repeat", title: "再次投诉" }] : []),
      { id: "processing-result", title: "处理结果" },
      ...(showIntelligentInspection ? [{ id: "intelligent-inspection", title: "智能核查" }] : []),
      ...(type === "投诉单" ? [{ id: "processing-countersign", title: "会签信息" }] : []),
      { id: "processing-subprocess", title: "关联子流程" },
      ...(approvalFull ? [{ id: "approval", title: approvalFormConfig().stage === "countersign" ? "会签意见" : "审批意见" }] : [])
    ];
    const visibleFields = PROCESSING_FIELDS.filter(field => fieldVisible(field, scope));
    const noticeFieldNames = new Set(["处理结果是否告知", "告知时间"]);
    const resultSourceFields = visibleFields.filter(field => !COUNTERSIGN_PROCESSING_FIELDS.has(field.name) && !noticeFieldNames.has(field.name) && !field.displaySection && !REPEAT_PROCESSING_FIELDS.has(field.name));
    const intelligentInspectionSourceFields = visibleFields.filter(field => noticeFieldNames.has(field.name));
    const countersignSourceFields = visibleFields.filter(field => COUNTERSIGN_PROCESSING_FIELDS.has(field.name));
    const metaSourceFields = META_PROCESSING_FIELDS();
    const prepareFields = fields => (repeatComplaint || policy.readOnly) ? fields.map(field => ({ ...field, disabled:true, required:false, requiredBy:undefined, requiredWhen:undefined })) : fields;
    const resultFields = prepareFields(resultSourceFields);
    const approvalResultFields = approvalFull
      ? resultFields.map(field => field.name === "处理附件"
        ? { ...field, type:"approvalAttachmentReadonly", value:processingRecord?.fields?.processing?.[field.name] || state.formValues[scope + "." + field.name] || "处理结果证明材料.pdf" }
        : field)
      : resultFields;
    const resultNoticeValue = state.formValues[resultNoticeKey] || "";
    const noticeMethodKey = scope + ".告知沟通方式";
    const selectedNoticeTime = state.formValues[scope + ".告知时间"] || "";
    const matchedNoticeRecord = selectedNoticeTime ? contactRecordsForTicket(row).find(record => String(record.time || "").trim() === selectedNoticeTime) : null;
    if (matchedNoticeRecord) state.formValues[noticeMethodKey] = matchedNoticeRecord.method || "";
    const noticeMethod = state.formValues[noticeMethodKey] || "";
    // 告知方式由所选联系记录自动回填，避免时间与方式不一致。
    const noticeMethodField = { name:"告知沟通方式", label:"告知方式", type:"readonly", value:noticeMethod, placeholder:"选择告知时间后自动回填" };
    const noticeFields = prepareFields(intelligentInspectionSourceFields.flatMap(field => {
      // 未告知处理结果时，告知时间和自动回填的告知方式均可留空。
      if (field.name === "告知时间") return [{ ...field, required:resultNoticeValue === "是", requiredWhen:undefined, label:"告知时间", placeholder:"请选择" }, noticeMethodField];
      return [field];
    }));
    const countersignFields = prepareFields(countersignSourceFields);
    const resultNotice = repeatComplaint ? '<div class="repeat-result-notice"><strong>当前工单已判定为再次投诉</strong><span>以下处理结果由关联主工单复用，审批通过前仅供查看，当前无需重复填写。</span></div>' : "";
    const readonlyNotice = policy.readOnly ? '<div class="workflow-readonly-notice">当前从' + (policy.entry === "approve" ? "审批管理" : "查看入口") + '进入，业务内容只读' + (policy.canStartSubprocess ? '；可在“关联子流程”中按工单类型、当前阶段和角色权限快速发起符合条件的子流程。' : '，不能编辑或发起子流程。') + '</div>' : "";
    const countersignSection = type === "投诉单" ? '<section class="form-section processing-section" id="section-processing-countersign"><div class="form-section-head">会签信息</div><div class="form-section-body"><div class="form-grid">' + countersignFields.map(field => renderField(field, scope)).join("") + '</div></div></section>' : '';
    const metaItems = metaSourceFields.map(field => {
      let value = field.value || "-";
      if (field.name === "工单状态") value = statusTag(row[5]);
      else if (field.name === "工单接收机构") value = ticketReceivingInstitution(row);
      else if (field.name === "处理员") value = ticketLastHandler(row);
      else if (field.name === "工单接收部门") value = ticketReceivingDepartment(row);
      return '<div><dt>' + field.name + '</dt><dd>' + value + '</dd></div>';
    }).join("");
    const inspectionSection = showIntelligentInspection ? renderApprovalIntelligentInspectionSection(row) : '';
    // 达成一致的两个字段共用一行，保持不同工单类型下的布局一致。
    const agreementField = approvalResultFields.find(field => field.name === "是否达成一致");
    const agreementMethodField = approvalResultFields.find(field => field.name === "达成一致方式");
    const firstNoticeIndex = visibleFields.findIndex(field => noticeFieldNames.has(field.name));
    const resultFieldNames = new Set(approvalResultFields.map(field => field.name));
    const complaintNoticePredecessor = ["黑灰产附件", "黑灰产原因", "是否黑灰产投诉"].find(name => resultFieldNames.has(name));
    const noticePredecessorName = type === "投诉单" && complaintNoticePredecessor
      ? complaintNoticePredecessor
      : visibleFields.slice(0, firstNoticeIndex).reverse().find(field => resultFieldNames.has(field.name))?.name;
    const resultFieldMarkup = approvalResultFields.filter(field => field.name !== "达成一致方式").map(field =>
      field.name === "是否达成一致" && agreementMethodField
        ? '<div class="processing-agreement-row">' + renderField(agreementField, scope) + renderField(agreementMethodField, scope) + '</div>'
        : renderField(field, scope) + (field.name === noticePredecessorName ? noticeFields.map(noticeField => renderField(noticeField, scope)).join("") : "")
    ).join("") + (!noticePredecessorName ? noticeFields.map(noticeField => renderField(noticeField, scope)).join("") : "");
    const resultSection = '<section class="form-section processing-section ' + (repeatComplaint ? "is-repeat-reused" : "") + '" id="section-processing-result"><div class="form-section-head">处理结果</div><div class="form-section-body">' + resultNotice + '<div class="form-grid">' + resultFieldMarkup + '</div></div></section>';
    const surface = '<div class="workflow-detail-surface" data-workflow-readonly="' + policy.readOnly + '" data-workflow-can-start-subprocess="' + policy.canStartSubprocess + '">' + readonlyNotice +
      '<section class="form-section processing-section" id="section-processing-meta"><div class="form-section-head">事件处理信息</div><div class="form-section-body"><dl class="ds-descriptions detail-descriptions process-generated">' + metaItems + '</dl><div class="embedded-contact-block"><div class="embedded-block-title"><span>联系客户</span></div>' + processingContactTable(row, policy.readOnly || approvalFull || state.detailEntry !== "process", true) + '</div></div></section>' +
      (showRiskAndInspection ? renderRiskSummary(row, true, canEditManualRiskTags(row)) : "") +
      (type === "投诉单" ? renderAgainComplaintSection(row) : "") +
      resultSection +
      inspectionSection +
      countersignSection + renderLinkedSubprocessSection(row, policy) + '</div>';
    const form = '<div class="form-layout processing-layout ' + (approvalView ? "is-approval-review" : "") + '"><form id="processing-form-main">' + surface + (approvalFull ? renderFullApprovalSection() : "") + '</form><aside class="form-anchor"><div class="anchor-title">填写导航</div><nav class="lib-anchor" aria-label="处理信息填写导航">' + sections.map((section,index) => '<a class="anchor-link ' + (index===0?"is-active":"") + '" href="#section-' + section.id + '" data-anchor="' + section.id + '">' + section.title + '</a>').join("") + '</nav></aside></div>';
    if (approvalFull) return form + renderApprovalStickyFooter();
    if (!policy.canProcess) return form;
    const processingDemoAction = state.role === "developer" ? '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="demo-fill-processing">' + icon("edit") + ' 一键填写 Demo</button>' : "";
    return form + '<div class="sticky-actions processing-actions"><span>系统自动保存处理草稿</span><div class="sticky-action-buttons">' + processingDemoAction + '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="save-processing">保存处理草稿</button><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="submit-processing">提交处理结果</button></div></div>';
  }

  function renderTransferRecordTable(row = workflowRow("ticket", state.detailId)) {
    const fallback = [
      { operatorName:"陈敏慧-60157", operatorRoleName:"经办员", operatorOrgName:row?.[4] || "总行 / 客户服务中心", flowSceneName:"创建工单", flowOpinion:"", receiverName:(row?.[4] || "总行") + "机构工单池", statusTransition:"草稿 → " + (row?.[5] || "待处理"), operationTime:workflowOperationTime(row?.[6] || systemTimestamp()), result:"通过" }
    ];
    return '<div class="panel transfer-record-panel">' + renderWorkflowRecordTable(workflowRecordsFor("ticket", row, fallback)) + '</div>';
  }
  function ticketRowById(id) {
    const direct = ticketRows.find(item => item[0] === id);
    if (direct) return direct;
    const queried = queryTicketRows.find(item => item[0] === id);
    return queried ? queried.slice(0, 7) : null;
  }

  function relatedWorkItems(rootTicketId, fallbackRow) {
    const rootRow = ticketRowById(rootTicketId) || fallbackRow;
    const rootQuery = queryTicketRows.find(item => item[0] === rootTicketId);
    const rootRelation = repeatRelationForTicket(rootTicketId);
    const items = [];
    const automaticRelation = automaticRepeatRelationForTicket(rootTicketId);
    if (automaticRelation?.role === "main") {
      automaticRelation.ticketIds.forEach((ticketId, index) => {
        const row = ticketRowById(ticketId);
        if (row) items.push({ id:ticketId, kind:index === 0 ? "工单" : "重复投诉单", status:row[5], row, source:"ticket", keepRoot:index === 0 });
      });
    }
    const mainTicketId = rootRelation?.linked ? rootRelation.mainTicket : rootQuery?.[8] && rootQuery[8] !== "-" ? rootQuery[8] : "";
    if (mainTicketId && mainTicketId !== rootTicketId && !items.some(item => item.id === mainTicketId)) {
      const mainRow = ticketRowById(mainTicketId) || [mainTicketId, "投诉单", rootRow[2], "首次投诉", "厦门分行", "处理中", "2026-07-02 14:26"];
      items.push({ id:mainTicketId, kind:"工单", status:mainRow[5], row:mainRow, source:"ticket" });
    }
    queryTicketRows.filter(item => item[8] === rootTicketId && !items.some(existing => existing.id === item[0])).forEach(row => items.push({ id:row[0], kind:"重复投诉单", status:row[5], row:row.slice(0, 7), source:"ticket" }));
    Object.entries(state.repeatRelations).filter(([, relation]) => relation.linked && relation.mainTicket === rootTicketId).forEach(([ticketId]) => {
      const row = ticketRowById(ticketId) || [ticketId, "投诉单", rootRow[2], "再次投诉", rootRow[4], "处理中", "2026-07-17 15:30"];
      items.push({ id:ticketId, kind:"重复投诉单", status:row[5], row, source:"ticket" });
    });
    linkedSubprocessRecords(rootTicketId).forEach(record => items.push({ id:record.id, kind:"子流程单", status:record.status, row:record.row, source:"subprocess" }));
    if (state.relatedSourceSubprocessId && !items.some(item => item.id === state.relatedSourceSubprocessId)) {
      const sourceRow = subprocessRows.find(item => item[0] === state.relatedSourceSubprocessId);
      if (sourceRow) items.push({ id:sourceRow[0], kind:"子流程单", status:sourceRow[5], row:sourceRow, source:"subprocess" });
    }
    const seen = new Set();
    return items.filter(item => item.id && item.id !== "-" && item.status !== "草稿" && (item.id !== rootTicketId || item.keepRoot) && !seen.has(item.id) && seen.add(item.id));
  }

  function renderRelatedTicketAllContent(active, rootTicketId, relationshipOverride = "", contactReadOnly = false) {
    const row = active.row;
    const relatedDocument = documentRecordFor("ticket", row);
    const relatedEntry = relatedDocument?.fields?.entry || {};
    const relatedCustomer = CUSTOMER_REPOSITORY.toFormFields(CUSTOMER_REPOSITORY.resolveFromTicket(row, relatedDocument));
    const deadlineInfo = dispositionDeadlineInfo(row, active.source === "subprocess" ? "subprocess" : "ticket");
    const deadlineText = deadlineInfo.deadline || deadlineInfo.emptyLabel;
    return `<section class="panel related-order-content"><div class="related-order-content-head"><div><span>${active.kind}</span><h3>${row[1]} · ${row[0]}</h3></div>${statusTag(row[5])}</div><form class="related-complete-form" aria-label="${active.kind}完整内容">
      <section class="related-form-section"><div class="related-block-title">基础信息</div><dl class="ds-descriptions detail-descriptions"><div><dt>创建人</dt><dd>${escapeAttribute(relatedEntry["创建人"] || "陈敏慧-60157")}</dd></div><div><dt>创建人所属机构</dt><dd>${escapeAttribute(relatedEntry["创建人所属机构"] || "总行")}</dd></div><div><dt>创建人所属部门</dt><dd>${escapeAttribute(relatedEntry["创建人所属部门"] || "总行零售金融部")}</dd></div><div><dt>工单编号</dt><dd>${row[0]}</dd></div><div><dt>工单类型</dt><dd>${row[1]}</dd></div><div><dt>建单时间</dt><dd>${row[6]}</dd></div></dl></section>
      <section class="related-form-section"><div class="related-block-title">客户与受理信息</div><dl class="ds-descriptions detail-descriptions"><div><dt>客户姓名</dt><dd>${escapeAttribute(relatedCustomer["客户姓名"] || row[2] || "-")}</dd></div><div><dt>客户编号</dt><dd>${escapeAttribute(relatedCustomer["客户编号"] || "-")}</dd></div><div><dt>证件类型</dt><dd>${escapeAttribute(relatedCustomer["证件类型"] || "-")}</dd></div><div><dt>证件号码</dt><dd>${escapeAttribute(relatedCustomer["证件号码"] || "-")}</dd></div><div><dt>预留手机号码</dt><dd>${escapeAttribute(relatedCustomer["预留手机号码"] || "-")}</dd></div><div><dt>受理渠道</dt><dd>${escapeAttribute(relatedEntry["受理渠道"] || "-")}</dd></div><div><dt>客户事件时间</dt><dd>${escapeAttribute(relatedEntry["客户事件时间"] || row[6]?.slice(0, 10) || "-")}</dd></div><div><dt>处置期限</dt><dd>${escapeAttribute(deadlineText)}</dd></div></dl></section>
      <section class="related-form-section"><div class="related-block-title">工单具体内容</div><dl class="ds-descriptions detail-descriptions"><div><dt>涉及机构</dt><dd>${row[4]}</dd></div><div><dt>业务类型</dt><dd>合作类贷款</dd></div><div><dt>产品类型</dt><dd>个人经营贷</dd></div><div><dt>所属业务条线</dt><dd>零售金融部</dd></div><div class="is-wide"><dt>反馈内容</dt><dd>${row[3]}。客户反映业务办理和费用说明存在疑问，希望银行核实并明确答复。</dd></div><div class="is-wide"><dt>客户诉求</dt><dd>说明费用计算依据，协商合理处理方案并反馈处理结果。</dd></div></dl><div class="detail-section-actions"><button type="button" class="btn xib-btn xib-btn--secondary" data-action="view-call-transcript">${icon("transcript")} 查看录音转文本内容</button></div></section>
      <section class="related-form-section"><div class="related-block-title">事件处理信息</div><dl class="ds-descriptions detail-descriptions"><div><dt>工单状态</dt><dd>${statusTag(row[5])}</dd></div><div><dt>接收机构</dt><dd>厦门分行</dd></div><div><dt>接收部门</dt><dd>厦门分行零售金融部</dd></div><div><dt>处理员</dt><dd>陈敏慧-60157</dd></div><div class="is-wide"><dt>事件还原</dt><dd>已核实客户业务申请、合同约定、账单和通话记录，确认客户对息费说明及还款方案存在疑问。</dd></div><div class="is-wide"><dt>处理依据</dt><dd>依据贷款合同、费用公示规则及投诉处理管理办法开展核查和答复。</dd></div></dl></section>
      <section class="related-form-section"><div class="related-block-title">联系记录</div>${processingContactTable(row, contactReadOnly)}</section>
      <section class="related-form-section"><div class="related-block-title">处理结果</div><dl class="ds-descriptions detail-descriptions"><div><dt>投诉有效性</dt><dd>有效投诉</dd></div><div><dt>责任机构</dt><dd>厦门分行</dd></div><div><dt>责任部门</dt><dd>厦门分行零售金融部</dd></div><div><dt>责任人</dt><dd>林海-38102</dd></div><div><dt>是否达成一致</dt><dd>是</dd></div><div><dt>客户满意度</dt><dd>满意</dd></div><div><dt>结果是否告知</dt><dd>是</dd></div><div class="is-wide"><dt>处置意见</dt><dd>已向客户说明费用计算依据并提供协商还款方案，客户确认无异议。</dd></div><div class="is-wide"><dt>处理附件</dt><dd><button type="button" class="btn-link" data-action="contact-attachment">处理说明.pdf</button>、<button type="button" class="btn-link" data-action="contact-attachment">客户确认记录.mp3</button></dd></div></dl></section>
      <section class="related-form-section"><div class="related-block-title">流转记录</div>${renderWorkflowRecordTable(workflowRecordsFor("ticket", row))}</section>
    </form></section>`;
  }

  function renderRelatedSubprocessAllContent(active) {
    const row = active.row;
    const definition = subprocessDefinition(row[1]);
    return `<section class="panel related-order-content"><div class="related-order-content-head"><div><span>${active.kind}</span><h3>${definition.document} · ${active.id}</h3></div>${statusTag(active.status)}</div><form class="related-complete-form" aria-label="${definition.document}完整内容">
      <section class="related-form-section"><div class="related-block-title">基础信息</div><dl class="ds-descriptions detail-descriptions"><div><dt>${definition.document}编号</dt><dd>${active.id}</dd></div><div><dt>子流程类型</dt><dd>${row[1]}</dd></div><div><dt>事件创建人</dt><dd>陈敏慧-60157</dd></div><div><dt>发起机构</dt><dd>${row[4]}</dd></div><div><dt>关联主工单</dt><dd><button type="button" class="btn-link" data-related-item="${row[2]}">${row[2]}</button></dd></div><div><dt>申请时间</dt><dd>${row[6]}</dd></div></dl></section>
      <section class="related-form-section"><div class="related-block-title">${definition.document}差异字段</div><dl class="ds-descriptions detail-descriptions"><div><dt>申请原因</dt><dd>根据当前投诉处理情况发起${definition.document}。</dd></div><div><dt>业务依据</dt><dd>相关专属字段仍待业务确认</dd></div><div class="is-wide"><dt>情况说明</dt><dd>已关联主工单材料、客户信息和现有处理记录，后续在该子流程中继续补充专属字段。</dd></div></dl></section>
      <section class="related-form-section"><div class="related-block-title">处理信息</div><dl class="ds-descriptions detail-descriptions"><div><dt>当前状态</dt><dd>${statusTag(active.status)}</dd></div><div><dt>接收机构</dt><dd>${row[4]}</dd></div><div><dt>接收部门</dt><dd>${qualifiedDepartmentName(row[4], "消费者权益保护部") || "-"}</dd></div><div><dt>当前处理角色</dt><dd>处理员 / 审批员</dd></div><div><dt>更新时间</dt><dd>${row[6]}</dd></div><div class="is-wide"><dt>处理意见</dt><dd>已核验公共字段和关联主工单信息，等待当前节点处理。</dd></div><div class="is-wide"><dt>附件</dt><dd><button type="button" class="btn-link" data-action="contact-attachment">子流程申请材料.pdf</button></dd></div></dl></section>
      <section class="related-form-section"><div class="related-block-title">流程节点</div><div class="related-inline-flow">${renderSubprocessFlow(row[1])}</div></section>
      <section class="related-form-section"><div class="related-block-title">流转记录</div>${renderWorkflowRecordTable(workflowHistory.subprocess?.[row[0]] || [])}</section>
    </form><div class="related-order-footer"><button type="button" class="btn xib-btn xib-btn--secondary" data-action="open-related-subprocess" data-id="${active.id}">打开独立子流程详情</button></div></section>`;
  }

  function renderRelatedWorkOrderWorkspace(rootRow) {
    const rootTicketId = state.relatedRootTicketId || rootRow[0];
    const items = relatedWorkItems(rootTicketId, rootRow);
    if (!items.length) {
      state.relatedItemId = "";
      return `<section class="panel related-order-empty"><div class="ds-empty app-empty-state"><h4>暂无数据</h4><p>当前主单不重复展示，草稿及未生成编号的单据也不显示。</p></div></section>`;
    }
    if (!items.some(item => item.id === state.relatedItemId)) state.relatedItemId = items[0].id;
    const active = items.find(item => item.id === state.relatedItemId) || items[0];
    const list = `<aside class="panel related-order-list"><div class="related-order-list-head"><strong>关联单据</strong><span>${items.length}</span></div><div class="related-order-list-body">${items.map(item => `<button type="button" class="related-order-item ${item.id === active.id ? "is-active" : ""}" data-related-item="${item.id}"><span class="related-order-kind">${item.kind}</span><strong>${item.id}</strong><small>${item.source === "subprocess" ? item.row[1] : item.row[1] + " · " + item.row[2]}</small><i>${statusTag(item.status)}</i></button>`).join("")}</div></aside>`;
    const detail = active.source === "subprocess" ? renderRelatedSubprocessAllContent(active) : renderRelatedTicketAllContent(active, rootTicketId);
    return `<div class="related-workspace">${list}${detail}</div>`;
  }

  function renderMainTicketOnlyRelatedWorkspace(mainTicketId, fallbackRow, relationshipLabel, contactReadOnly = false) {
    const mainRow = ticketRowById(mainTicketId) || fallbackRow || [mainTicketId, "投诉单", "-", "关联投诉事项", "-", "-", "-"];
    const active = { id:mainRow[0], kind:"工单", status:mainRow[5], row:mainRow, source:"ticket" };
    state.relatedRootTicketId = mainRow[0];
    state.relatedItemId = mainRow[0];
    const list = `<aside class="panel related-order-list"><div class="related-order-list-head"><strong>关联单据</strong><span>1</span></div><div class="related-order-list-body"><button type="button" class="related-order-item is-active" data-related-item="${escapeAttribute(active.id)}"><span class="related-order-kind">工单</span><strong>${escapeAttribute(active.id)}</strong><small>${escapeAttribute(mainRow[1] + " · " + mainRow[2])}</small><i>${statusTag(mainRow[5])}</i></button></div></aside>`;
    return `<div class="related-workspace related-workspace--single-main">${list}${renderRelatedTicketAllContent(active, mainRow[0], relationshipLabel, contactReadOnly)}</div>`;
  }
  function customerForTicket(row) {
    return CUSTOMER_REPOSITORY.resolveFromTicket(row, documentRecordFor("ticket", row));
  }

  function customerHistoryRecordFromRow(row) {
    const document = documentRecordFor("ticket", row);
    const entry = document?.fields?.entry || {};
    const processing = document?.fields?.processing || {};
    const customerProfile = CUSTOMER_REPOSITORY.resolveFromTicket(row, document);
    const createdAt = entry["建单时间"] || document?.createdAt || row?.[6] || "";
    return {
      id:row[0],
      type:row[1],
      subject:entry["投诉/信访事项"] || row[3] || "-",
      org:entry["涉及机构"] || row[4] || "-",
      status:row[5],
      createdAt,
      deadline:document?.dispositionDeadline || entry["处置期限"] || "-",
      channel:entry["受理渠道"] || "-",
      request:entry["投诉请求"] || entry["主体诉求"] || "-",
      content:entry["反馈内容"] || "-",
      result:processing["处置意见"] || processing["处理依据"] || "-",
      customer:customerProfile?.name || entry["客户姓名"] || row[2] || "-",
      customerNo:customerProfile?.id || entry["客户编号"] || "",
      documentNo:customerProfile?.identity?.number || entry["证件号码"] || "",
      customerProfile,
      entryFields:deepClone(entry),
      processingFields:deepClone(processing),
      document,
      row
    };
  }

  function customerHistoryRecords(row = ticketRowById(state.detailId) || ticketRows[0], options = {}) {
    const sourceDocument = documentRecordFor("ticket", row);
    const sourceEntry = sourceDocument?.fields?.entry || {};
    const customerNo = options.customerNo || sourceEntry["客户编号"] || state.formValues["customer.1.客户编号"] || "";
    const canonicalCustomerNo = CUSTOMER_REPOSITORY.canonicalId(customerNo);
    const excludeId = Object.prototype.hasOwnProperty.call(options, "excludeId") ? options.excludeId : row?.[0];
    if (!canonicalCustomerNo) return [];
    return ticketRows
      .filter(ticket => ticket[5] !== "草稿" && ticket[0] !== excludeId)
      .filter(ticket => CUSTOMER_REPOSITORY.matchesTicket(canonicalCustomerNo, ticket, documentRecordFor("ticket", ticket)))
      .map(customerHistoryRecordFromRow)
      .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  }

  function refreshCustomerComplaintCount(scope = "customer.1") {
    const prefix = scope ? scope + "." : "";
    const customerNo = state.formValues[prefix + "客户编号"] || "";
    const history = customerNo ? customerHistoryRecords(ticketRows[0], { customerNo, excludeId:"" }) : [];
    state.formValues["事件次数"] = String(history.filter(record => record.type === "投诉单").length);
  }

  function historicalFieldApplies(field, type) {
    return Boolean(field.all || (field.types || []).includes(type));
  }

  function historicalFieldLabel(field, type) {
    return field.labelBy?.[type] || field.name;
  }

  function historicalConditionMatches(condition, values) {
    if (!condition) return true;
    const value = values[condition.key];
    if (Object.prototype.hasOwnProperty.call(condition, "equals")) return value === condition.equals;
    if (condition.in) return condition.in.includes(value);
    return true;
  }

  function historicalEntryOverrides(record) {
    const entry = record.entryFields || {};
    const customerFields = CUSTOMER_REPOSITORY.toFormFields(record.customerProfile);
    const organizationCustomer = isOrganizationCustomerType(entry["客户类型"] || customerFields["客户类型"]);
    return {
      "创建人": entry["创建人"] || "陈敏慧-60157",
      "创建人所属机构": entry["创建人所属机构"] || "总行",
      "创建人所属部门": entry["创建人所属部门"] || "总行零售金融部",
      "工单编号": record.id,
      "建单时间": record.createdAt,
      "工单类型": record.type,
      ...customerFields,
      "投诉人数": entry["投诉人数"] || "1",
      "卡号/账号": entry["卡号/账号"] || "-",
      "受理渠道": record.channel,
      "客户事件时间": entry["客户事件时间"] || record.createdAt.slice(0, 10),
      "客户投诉时间": entry["客户投诉时间"] || record.createdAt.slice(0, 10),
      "接收时间": entry["接收时间"] || record.createdAt,
      "处置期限": entry["处置期限"] || record.deadline,
      "录音编号": entry["录音编号"] || "CALL-" + record.id.slice(2) + "-01",
      "转送函号": entry["转送函号"] || "-",
      "联系人姓名": entry["联系人姓名"] || record.customer,
      "联系方式": entry["联系方式"] || record.customerProfile?.contact?.mobile || "-",
      "投诉/信访事项": record.subject,
      "反馈内容": record.content,
      "投诉请求": record.request,
      "涉及机构": record.org,
      "投诉机构": record.org,
      "业务类型": entry["业务类型"] || "合作类贷款",
      "产品类型": entry["产品类型"] || "个人经营贷",
      "所属业务条线": entry["所属业务条线"] || { primary:"零售金融部" },
      "业务办理渠道": entry["业务办理渠道"] || (organizationCustomer ? "Z-01 前台业务渠道 / Z-0103 电子渠道 / Z-01033 移动客户端" : "A-01 前台业务渠道 / A-0103 电子渠道 / A-01033 移动客户端"),
      "业务类别": entry["业务类别"] || (organizationCustomer ? "Y-02 贷款 / Y-0201 信用贷款" : "B-02 贷款 / B-0205 个人生产经营性贷款"),
      "投诉/信访原因": entry["投诉/信访原因"] || (organizationCustomer ? "X-03 金融机构管理制度、业务规则与流程" : "C-03 管理制度、业务规则与流程"),
      "主体诉求": entry["主体诉求"] || record.request,
      "派发机构": entry["派发机构"] || record.org,
      "派发部门": entry["派发部门"] || departmentOptionsForInstitution(record.org).find(item => item.includes("消费者权益保护部")) || departmentOptionsForInstitution(record.org)[0] || "-",
      ...entry
    };
  }

  function historicalProcessingOverrides(record) {
    const processing = record.processingFields || {};
    return {
      "投诉对象": processing["投诉对象"] || "-",
      "事件还原": "已核实客户业务申请、合同约定、账单、系统记录及沟通录音，确认客户对" + record.subject + "存在疑问。",
      "处理依据": "依据业务合同、费用公示规则、消费者权益保护及投诉处理管理制度开展核查。",
      "处置意见": record.result,
      "责任机构": record.org ? record.org + " / " + record.org : "-",
      "责任部门": "-",
      "责任人": "林海-38102",
      "责任人具体情况": "不适用",
      "投诉有效性": "有效投诉",
      "处置员反馈时间": record.deadline,
      "是否超期": "否",
      "是否黑灰产投诉": "否",
      "处理结果是否告知": "是",
      "告知时间": record.deadline,
      "告知方式": "电话",
      "救济途径是否告知": "是",
      "是否达成一致": "是",
      "客户满意度": "满意",
      "抄送人": "机构消保联系人",
      "处理附件": "处理说明.pdf、客户确认记录.mp3",
      ...processing
    };
  }

  function historicalFallbackValue(field, record, phase) {
    if (field.valueBy?.[record.type]) return field.valueBy[record.type];
    if (field.value != null) return field.value;
    if (field.defaultValue != null) return field.defaultValue;
    if (field.defaultValues?.length) return field.defaultValues.join("、");
    if (field.type === "upload") return historicalFieldLabel(field, record.type) + "历史归档材料.pdf";
    if (field.type === "date") return record.createdAt.slice(0, 10);
    if (field.type === "datetime") return record.createdAt;
    if (field.type === "year") return "1988";
    if (field.type === "number") return "1";
    if (field.type === "checkboxGroup") return (field.options || []).slice(0, 2).join("、") || "无";
    if (field.type === "radio" || field.type === "select") return field.options?.[0] || "已归档";
    if (field.type === "textarea") return phase === "processing" ? "历史处理阶段已填写并归档。" : "历史录入阶段已填写并归档。";
    return "已归档";
  }

  function historicalFieldsFor(record, fields, phase) {
    const overrides = phase === "processing" ? historicalProcessingOverrides(record) : historicalEntryOverrides(record);
    const applicable = fields.filter(field => historicalFieldApplies(field, record.type));
    const values = Object.fromEntries(applicable.map(field => [field.name, overrides[field.name] ?? historicalFallbackValue(field, record, phase)]));
    return applicable.map(field => {
      const conditionalVisible = historicalConditionMatches(field.showWhen, values);
      return {
        name: field.name,
        label: historicalFieldLabel(field, record.type),
        value: conditionalVisible ? values[field.name] : "不适用（当前条件未触发）",
        wide: Boolean(field.span || ["textarea", "upload", "checkboxGroup", "cascader"].includes(field.type))
      };
    });
  }

  function historicalTicketSnapshot(record) {
    const entrySections = orderedFormSections().map(section => ({ id:section.id, title:formSectionTitle(section, record.type), fields:historicalFieldsFor(record, section.fields, "entry") })).filter(section => section.fields.length);
    const processingFields = historicalFieldsFor(record, PROCESSING_FIELDS, "processing");
    const approvalStages = [["复核", record.document?.fields?.review], ["初审", record.document?.fields?.initialApproval], ["会签", record.document?.fields?.countersign], ["审批", record.document?.fields?.approval]];
    const displayValue = value => Array.isArray(value) ? value.join("、") : value && typeof value === "object" ? Object.values(value).filter(Boolean).join(" / ") : String(value ?? "");
    const approvalFields = approvalStages.flatMap(([stage, values]) => Object.entries(values || {}).filter(([, value]) => value !== "" && value != null && (!Array.isArray(value) || value.length)).map(([label, value]) => ({ label:label.startsWith(stage) ? label : stage + " · " + label, value:displayValue(value) })));
    if (!approvalFields.length) approvalFields.push({ label:"审批信息", value:"当前工单尚未形成复核或审批记录" });
    approvalFields.push({ label:"当前工单状态", value:record.status });
    return { entrySections, processingFields, approvalFields };
  }

  function renderHistoricalFieldRows(fields) {
    const displayValue = value => Array.isArray(value) ? value.join("、") : value && typeof value === "object" ? Object.values(value).filter(Boolean).join(" / ") : String(value ?? "");
    return fields.map(field => '<div class="' + (field.wide ? "is-wide" : "") + '"><dt>' + escapeAttribute(field.label) + '</dt><dd>' + escapeAttribute(displayValue(field.value) || "-") + '</dd></div>').join("");
  }

  function historyFieldInventory(record) {
    const snapshot = historicalTicketSnapshot(record);
    return {
      entry: snapshot.entrySections.reduce((sum, section) => sum + section.fields.length, 0),
      processing: snapshot.processingFields.length,
      approval: snapshot.approvalFields.length,
      sections: snapshot.entrySections.map(section => ({ stage:"录入", title:section.title, fields:section.fields.map(field => field.label) }))
        .concat([{ stage:"处理", title:"处理表单", fields:snapshot.processingFields.map(field => field.label) }, { stage:"审批", title:"复核与审批", fields:snapshot.approvalFields.map(field => field.label) }])
    };
  }

  const FIELD_CONTROL_LABELS = {
    readonly: "只读文本框",
    workOrderType: "工单类型选择器",
    text: "文本框",
    number: "数字输入框",
    select: "下拉选择器",
    channel: "渠道选择器",
    radio: "单选按钮",
    textarea: "文本域",
    date: "日期选择器",
    datetime: "日期时间选择器",
    year: "年份选择器",
    cascader: "级联选择器",
    multiCascader: "多选级联选择器",
    checkboxGroup: "复选框组",
    upload: "上传控件",
    trendChart: "趋势图"
  };

  function ticketInventoryRecord(row) {
    return customerHistoryRecordFromRow(row);
  }

  function inventoryStoredValue(row, field, stage, fallback) {
    const scopes = stage === "录入"
      ? ["customer.1." + fieldKey(field), fieldKey(field)]
      : ["processing." + row[0] + "." + fieldKey(field), fieldKey(field)];
    const storedKey = scopes.find(key => Object.prototype.hasOwnProperty.call(state.formValues, key));
    if (storedKey) {
      const value = state.formValues[storedKey];
      return {
        value: Array.isArray(value) ? value.join("、") : value,
        source: "当前表单值"
      };
    }
    const stageKey = stage === "录入" ? "entry" : "processing";
    const recordValue = state.documentData.tickets?.[row[0]]?.fields?.[stageKey]?.[field.name];
    if (recordValue !== undefined && recordValue !== "") {
      return {
        value: Array.isArray(recordValue) ? recordValue.join("、") : recordValue,
        source: "结构化工单数据"
      };
    }
    return { value: fallback, source: "当前工单值" };
  }

  function inventoryRequiredRule(field, type, values) {
    if (field.required || field.requiredBy?.[type]) return "必填";
    if (field.requiredWhen) return historicalConditionMatches(field.requiredWhen, values)
      ? "条件必填（已触发）"
      : "条件必填（未触发）";
    return "非必填";
  }

  function inventoryEditRule(field, row, stage) {
    if (field.type === "readonly" || field.type === "workOrderType" || field.disabled || field.disabledBy?.includes(row[1])) return "只读";
    if (stage === "录入") return row[5] === "草稿" ? "当前可编辑" : "已提交，只读";
    if (stage === "处理") return ["待处理", "处理中"].includes(row[5]) ? "处理节点可编辑" : "非当前处理节点";
    return "对应审批节点可编辑";
  }

  function ticketMetadataInventoryRows(row) {
    const record = ticketInventoryRecord(row);
    const type = row[1];
    const entryOverrides = historicalEntryOverrides(record);
    const entryFields = formSections.flatMap(section => section.fields.filter(field => historicalFieldApplies(field, type)));
    const entryValues = {};
    entryFields.forEach(field => {
      const fallback = entryOverrides[field.name] ?? historicalFallbackValue(field, record, "entry");
      entryValues[field.name] = inventoryStoredValue(row, field, "录入", fallback).value;
    });
    const entryRows = formSections.flatMap(section => section.fields
      .filter(field => historicalFieldApplies(field, type))
      .map(field => {
        const fallback = entryOverrides[field.name] ?? historicalFallbackValue(field, record, "entry");
        const stored = inventoryStoredValue(row, field, "录入", fallback);
        const visible = historicalConditionMatches(field.showWhen, entryValues);
        return {
          stage: "录入",
          section: section.title,
          label: historicalFieldLabel(field, type),
          control: FIELD_CONTROL_LABELS[field.type] || field.type,
          required: inventoryRequiredRule(field, type, entryValues),
          editable: inventoryEditRule(field, row, "录入"),
          status: visible ? (field.showWhen ? "显示（条件已触发）" : "显示") : "隐藏（条件未触发）",
          value: visible ? stored.value : "-",
          source: visible ? stored.source : "条件未触发"
        };
      }));

    const processingOverrides = historicalProcessingOverrides(record);
    const processingFields = PROCESSING_FIELDS.filter(field => historicalFieldApplies(field, type));
    const processingValues = {};
    processingFields.forEach(field => {
      const fallback = processingOverrides[field.name] ?? historicalFallbackValue(field, record, "processing");
      processingValues[field.name] = inventoryStoredValue(row, field, "处理", fallback).value;
    });
    const processingRows = processingFields.map(field => {
      const fallback = processingOverrides[field.name] ?? historicalFallbackValue(field, record, "processing");
      const stored = inventoryStoredValue(row, field, "处理", fallback);
      const visible = historicalConditionMatches(field.showWhen, processingValues);
      return {
        stage: "处理",
        section: "处理表单",
        label: historicalFieldLabel(field, type),
        control: FIELD_CONTROL_LABELS[field.type] || field.type,
        required: inventoryRequiredRule(field, type, processingValues),
        editable: inventoryEditRule(field, row, "处理"),
        status: visible ? (field.showWhen ? "显示（条件已触发）" : "显示") : "隐藏（条件未触发）",
        value: visible ? stored.value : "-",
        source: visible ? stored.source : "条件未触发"
      };
    });
    return entryRows.concat(processingRows);
  }

  function approvalInventoryRows(row) {
    const history = (workflowHistory.ticket[row[0]] || []).map(normalizeWorkflowRecord);
    const stageDefinitions = [
      { stage: "复核", action: "复核", current: ["待复核", "复核中"].includes(row[5]) },
      ...(TICKET_INITIAL_APPROVAL_TYPES.has(row[1]) ? [{ stage: "初审", action: "初审", current: ["待初审", "初审中"].includes(row[5]) }] : []),
      ...(ticketRequiresCountersign(row) ? [{ stage: "会签", action: "会签", current: row[5] === "会签中" && approvalStageFor("ticket", row) === "countersign" }] : []),
      { stage: "审批", action: "审批", current: ["待审批", "审批中"].includes(row[5]) && approvalStageFor("ticket", row) === "approval" }
    ];
    return stageDefinitions.flatMap(definition => {
      const completed = history.find(item => item.flowSceneName === definition.action + "通过" || item.flowSceneName === definition.action + "驳回" || item.flowSceneName === definition.action + "不通过");
      const nodeStatus = completed ? "已完成" : definition.current ? "当前节点" : "待流转";
      const values = [
        { suffix: "人", control: "只读文本框", required: "必填", editable: "只读", value: completed?.operatorName || (definition.current ? "系统根据当前节点生成" : "-") },
        { suffix: "结论", control: "单选按钮", required: "必填", editable: "对应审批节点可编辑", value: completed?.result || "-" },
        { suffix: "意见", control: "文本域", required: "条件必填（复核不通过；会签、初审或审批驳回）", editable: "对应审批节点可编辑", value: completed?.flowOpinion || "-" }
      ];
      return values.map(field => ({
        stage: definition.stage,
        section: definition.stage + "表单",
        label: definition.stage + field.suffix,
        control: field.control,
        required: field.required,
        editable: field.editable,
        status: nodeStatus,
        value: field.value,
        source: completed ? "流转记录" : definition.current ? "当前节点" : "尚未流转"
      }));
    });
  }

  function openTicketFieldInventory(id) {
    const row = ticketRowById(id) || ticketRows[0];
    const rows = ticketMetadataInventoryRows(row).concat(approvalInventoryRows(row));
    const counts = rows.reduce((result, item) => {
      result[item.stage] = (result[item.stage] || 0) + 1;
      return result;
    }, {});
    const countText = Object.entries(counts).map(([stage, count]) => stage + " " + count + " 项").join(" · ");
    const body = rows.map(item => '<tr><td>' + escapeAttribute(item.stage) + '</td><td>' + escapeAttribute(item.section) + '</td><td class="inventory-field-name">' + escapeAttribute(item.label) + '</td><td>' + escapeAttribute(item.control) + '</td><td>' + escapeAttribute(item.required) + '</td><td>' + escapeAttribute(item.editable) + '</td><td>' + escapeAttribute(item.status) + '</td><td class="inventory-field-value"><span>' + escapeAttribute(item.value == null || item.value === "" ? "-" : String(item.value)) + '</span><small>' + escapeAttribute(item.source) + '</small></td></tr>').join("");
    openModal("工单字段清单", '<div class="ticket-field-inventory"><div class="query-condition"><span>当前工单</span><strong>' + escapeAttribute(row[0]) + ' · ' + escapeAttribute(row[1]) + ' · ' + escapeAttribute(row[5]) + '</strong><small>' + countText + '；以下内容直接按当前工单类型、字段元数据、表单值与流转状态生成。</small></div><div class="table-wrap"><table class="table ds-table"><thead><tr><th>阶段</th><th>页面分区</th><th>字段中文名</th><th>控件类型</th><th>必填规则</th><th>编辑规则</th><th>当前状态</th><th>当前值 / 来源</th></tr></thead><tbody>' + body + '</tbody></table></div></div>', "关闭");
  }

  function renderHistoryTicketContent(record, showInventory = true) {
    const snapshot = historicalTicketSnapshot(record);
    const inventory = historyFieldInventory(record);
    const entryHtml = snapshot.entrySections.map(section => '<section class="related-form-section history-stage-section"><div class="related-block-title"><span>录入 · ' + section.title + '</span><small>' + section.fields.length + ' 个字段</small></div><dl class="ds-descriptions detail-descriptions">' + renderHistoricalFieldRows(section.fields) + '</dl></section>').join("");
    const contacts = state.contactRecordsByTicket?.[record.id] || [];
    const contactRows = contacts.length ? contacts.map(item => '<tr><td>' + escapeAttribute(contactTimeDisplay(item.time || item.createdAt || "-")) + '</td><td>' + escapeAttribute(item.contact || item.name || record.customer) + '</td><td>' + escapeAttribute(item.method || "-") + '</td><td>' + escapeAttribute(item.status || "-") + '</td><td>' + escapeAttribute(item.content || "-") + '</td><td>' + escapeAttribute(item.attachment || "-") + '</td></tr>').join("") : '<tr><td colspan="6"><div class="ds-empty compact-empty">暂无已保存的联系记录</div></td></tr>';
    const processingHtml = '<section class="related-form-section history-stage-section"><div class="related-block-title"><span>处理 · 处理表单</span><small>' + snapshot.processingFields.length + ' 个字段</small></div><dl class="ds-descriptions detail-descriptions">' + renderHistoricalFieldRows(snapshot.processingFields) + '</dl></section><section class="related-form-section"><div class="related-block-title">处理 · 联系记录</div><div class="table-wrap"><table class="table ds-table"><thead><tr><th>联系时间</th><th>联系人</th><th>沟通方式</th><th>联系状态</th><th>联系内容</th><th>附件</th></tr></thead><tbody>' + contactRows + '</tbody></table></div></section>';
    const transitions = workflowRecordsFor("ticket", ticketRowById(record.id) || [record.id, record.type]);
    const approvalHtml = '<section class="related-form-section history-stage-section"><div class="related-block-title"><span>审批 · 复核与审批表单</span><small>' + snapshot.approvalFields.length + ' 个字段</small></div><dl class="ds-descriptions detail-descriptions">' + renderHistoricalFieldRows(snapshot.approvalFields) + '</dl></section><section class="related-form-section"><div class="related-block-title">审批 · 流转记录</div>' + renderWorkflowRecordTable(transitions) + '</section>';
    return '<section class="panel related-order-content history-ticket-content"><div class="related-order-content-head"><div><h3>' + escapeAttribute(record.type) + ' · ' + escapeAttribute(record.id) + '</h3><small>录入 ' + inventory.entry + ' 项 · 处理 ' + inventory.processing + ' 项 · 审批 ' + inventory.approval + ' 项</small></div><div class="history-content-actions">' + statusTag(record.status) + '</div></div><form class="related-complete-form" aria-label="历史工单完整信息">' + entryHtml + processingHtml + approvalHtml + '</form></section>';
  }

  const CUSTOMER_COMPLAINT_PATH_LEVELS = Object.freeze([
    Object.freeze({ key:"bank", label:"行内投诉" }),
    Object.freeze({ key:"online", label:"网微投诉" }),
    Object.freeze({ key:"regulatory", label:"监管投诉" })
  ]);

  const CUSTOMER_INTERNAL_COMPLAINT_CHANNELS = Object.freeze([
    "客服电话", "在线客服", "总行投诉邮箱", "机构专线电话",
    "营业网点", "客户意见簿", "信函", "其它"
  ]);
  const CUSTOMER_ONLINE_COMPLAINT_CHANNELS = Object.freeze(["金融消费者保护服务平台"]);

  function customerComplaintPathCategory(channel = "") {
    const storedValue = String(channel || "").trim();
    const normalized = storedValue === "客户意见薄" ? "客户意见簿" : storedValue;
    if (CUSTOMER_INTERNAL_COMPLAINT_CHANNELS.includes(normalized)) return "bank";
    if (CUSTOMER_ONLINE_COMPLAINT_CHANNELS.includes(normalized)) return "online";
    if (FINANCIAL_REGULATORY_BUREAUS.includes(normalized)) return "regulatory";
    return "";
  }

  function customerPathLevelLabel(key) {
    return CUSTOMER_COMPLAINT_PATH_LEVELS.find(level => level.key === key)?.label || "全部历史";
  }

  function customerComplaintPathAnalysis(row) {
    const records = customerHistoryRecords(row);
    const complaintRecords = records.filter(item => item.type === "投诉单").map(item => ({ ...item, category:customerComplaintPathCategory(item.channel) }));
    const counts = Object.fromEntries(CUSTOMER_COMPLAINT_PATH_LEVELS.map(level => [level.key, 0]));
    complaintRecords.forEach(item => {
      if (item.category && Object.prototype.hasOwnProperty.call(counts, item.category)) counts[item.category] += 1;
    });
    const levels = CUSTOMER_COMPLAINT_PATH_LEVELS.map(level => ({ ...level, count:counts[level.key] || 0 }));
    const workOrderCounts = Object.fromEntries(["投诉单", "信访单", "建议单", "表扬单"].map(type => [type, records.filter(item => item.type === type).length]));
    const repeatTotal = complaintRecords.filter(item => isRepeatComplaint(item.row, ticketRows)).length;
    return { records, complaintRecords, counts, levels, regulatoryTotal:counts.regulatory || 0, repeatTotal, workOrderCounts };
  }

  function customerPathFilteredHistory(row) {
    const allItems = customerHistoryRecords(row);
    const level = state.customerProfilePathFilter;
    const type = state.customerProfileTypeFilter;
    const items = level
      ? allItems.filter(item => item.type === "投诉单" && customerComplaintPathCategory(item.channel) === level)
      : type ? allItems.filter(item => item.type === type) : allItems;
    return { allItems, items, level, type };
  }

  function renderHistoricalTicketWorkspace(row) {
    const { allItems, items, level, type } = customerPathFilteredHistory(row);
    if (!allItems.length) {
      state.historyTicketId = "";
      return '<section class="panel history-ticket-empty"><div class="ds-empty app-empty-state"><h4>暂无历史工单</h4><p>未查询到与该客户编号关联的其他非草稿工单。</p></div></section>';
    }
    const filterLabel = level ? customerPathLevelLabel(level) : type;
    const filterStatus = filterLabel
      ? '<div class="history-path-filter-status"><span>当前筛选</span><strong>' + escapeAttribute(filterLabel) + '</strong><em>' + items.length + ' 笔</em><button type="button" class="btn-link" data-action="customer-path-clear" data-customer-path-clear>清除筛选</button></div>'
      : "";
    if (!items.length) {
      state.historyTicketId = "";
      return filterStatus + '<section class="panel history-ticket-empty"><div class="ds-empty app-empty-state"><h4>当前筛选暂无历史工单</h4><p>请选择其他工单类型或投诉等级，或清除筛选查看全部历史。</p></div></section>';
    }
    if (!items.some(item => item.id === state.historyTicketId)) state.historyTicketId = items[0].id;
    const active = items.find(item => item.id === state.historyTicketId) || items[0];
    const list = '<aside class="panel related-order-list history-ticket-list"><div class="related-order-list-head"><strong>工单列表</strong><span>' + items.length + '</span></div><div class="related-order-list-body">' + items.map(item => '<button type="button" class="related-order-item ' + (item.id === active.id ? "is-active" : "") + '" data-history-ticket="' + item.id + '"><span class="related-order-kind">' + item.type + '</span><strong>' + item.id + '</strong><small>' + item.subject + '</small><i>' + statusTag(item.status) + '</i></button>').join("") + '</div></aside>';
    return filterStatus + '<div class="related-workspace history-workspace">' + list + renderHistoryTicketContent(active) + '</div>';
  }

  function maskedProfileValue(value, visibleStart, visibleEnd) {
    const text = String(value || "").trim();
    if (!text) return "-";
    if (text.length <= visibleStart + visibleEnd) return text;
    return text.slice(0, visibleStart) + "*".repeat(Math.min(8, text.length - visibleStart - visibleEnd)) + text.slice(-visibleEnd);
  }

  function renderCustomerProfileCard(row) {
    const customer = customerForTicket(row);
    const fields = CUSTOMER_REPOSITORY.toFormFields(customer);
    const customerName = String(fields["客户姓名"] || row[2] || "-");
    const customerNo = String(fields["客户编号"] || "-");
    const identityTags = [fields["客户类型"], fields["客户性别"], customer?.status && customer.status !== "正常" ? customer.status : ""].filter(Boolean).join(" · ") || "资料待核实";
    return '<section class="panel customer-profile-card customer-basic-card">' +
      '<div class="customer-profile-card-head"><span class="panel-title">客户基本信息</span></div>' +
      '<div class="customer-identity"><span class="customer-avatar" aria-hidden="true">' + escapeAttribute(customerName.slice(0, 1) || "客") + '</span><div><h3>' + escapeAttribute(customerName) + '</h3><p>' + escapeAttribute(customerNo) + '</p><div class="customer-identity-tags"><span>' + escapeAttribute(identityTags) + '</span></div></div></div>' +
      '<dl class="customer-profile-facts"><div><dt>证件号码</dt><dd>' + escapeAttribute(maskedProfileValue(fields["证件号码"], 6, 4)) + '</dd></div><div><dt>预留手机</dt><dd>' + escapeAttribute(maskedProfileValue(fields["预留手机号码"], 3, 4)) + '</dd></div><div><dt>居住地</dt><dd>' + escapeAttribute(fields["居住地 省/市/区"] || "-") + '</dd></div></dl>' +
    '</section>';
  }

  function renderComplaintPathCard(row, analysis) {
    const activeLevel = state.customerProfilePathFilter;
    const activeType = state.customerProfileTypeFilter;
    const hasFilter = Boolean(activeLevel || activeType);
    const typeStats = [
      { type:"投诉单", label:"投诉", count:analysis.workOrderCounts["投诉单"] || 0 },
      { type:"信访单", label:"信访", count:analysis.workOrderCounts["信访单"] || 0 },
      { type:"建议单", label:"建议", count:analysis.workOrderCounts["建议单"] || 0 },
      { type:"表扬单", label:"表扬", count:analysis.workOrderCounts["表扬单"] || 0 }
    ];
    const statistics = '<div class="complaint-path-stat is-total" data-profile-stat="total"><strong>' + analysis.records.length + '</strong><span>累计</span></div>' +
      typeStats.map(item => {
        const active = activeType === item.type;
        return '<button type="button" class="complaint-path-stat is-filter ' + (active ? "is-selected" : "") + '" data-profile-stat="' + item.type + '" data-action="customer-type-filter" data-id="' + item.type + '" aria-pressed="' + active + '"><strong>' + item.count + '</strong><span>' + item.label + '</span></button>';
      }).join("");
    const flow = analysis.levels.map((level, index) => {
      const active = activeLevel === level.key;
      const node = '<button type="button" class="complaint-path-level scope-card ' + (active ? "is-selected is-active" : "") + ' ' + (level.count ? "has-records" : "is-empty") + '" data-action="customer-path-level" data-id="' + level.key + '" data-customer-path-level="' + level.key + '" aria-pressed="' + active + '"><span>第 ' + (index + 1) + ' 级</span><b>' + level.count + '</b><strong>' + escapeAttribute(level.label) + '</strong></button>';
      return node + (index < analysis.levels.length - 1 ? '<span class="complaint-path-flow-arrow" aria-hidden="true">→</span>' : "");
    }).join("");
    const filterText = activeLevel ? "已筛选：" + customerPathLevelLabel(activeLevel) : activeType ? "已筛选：" + activeType : "点击统计或等级筛选下方历史工单";
    const conclusion = '该客户共有历史工单' + analysis.records.length + '笔（投诉单' + (analysis.workOrderCounts["投诉单"] || 0) + '笔、信访单' + (analysis.workOrderCounts["信访单"] || 0) + '笔、建议单' + (analysis.workOrderCounts["建议单"] || 0) + '笔、表扬单' + (analysis.workOrderCounts["表扬单"] || 0) + '笔）；重复投诉' + (analysis.repeatTotal || 0) + '笔；历史监管投诉' + (analysis.regulatoryTotal || 0) + '笔。';
    return '<section class="panel customer-profile-card complaint-path-card">' +
      '<div class="customer-profile-card-head"><span class="panel-title">投诉统计</span><button type="button" class="btn xib-btn xib-btn--secondary complaint-path-reset ' + (hasFilter ? "" : "is-active") + '" data-action="customer-path-clear" data-customer-path-clear>' + (hasFilter ? "清除筛选" : "全部历史") + '</button></div>' +
      '<div class="complaint-path-body"><div class="complaint-path-statistics" aria-label="按工单类型筛选客户全部非草稿历史工单">' + statistics + '</div>' +
      '<div class="complaint-path-section-head"><strong>投诉路径</strong><span>' + escapeAttribute(filterText) + '</span></div>' +
      '<div class="complaint-path-levels" role="group" aria-label="三级投诉路径历史工单筛选">' + flow + '</div>' +
      '<p class="complaint-stat-conclusion" data-customer-complaint-conclusion>' + escapeAttribute(conclusion) + '</p></div></section>';
  }

  function renderCustomerProfile(row) {
    const analysis = customerComplaintPathAnalysis(row);
    const filteredHistory = customerPathFilteredHistory(row);
    const historyCountText = filteredHistory.level || filteredHistory.type ? filteredHistory.items.length + " / " + filteredHistory.allItems.length + " 笔" : filteredHistory.allItems.length + " 笔";
    return '<div class="ticket-customer-profile"><div class="customer-profile-overview">' + renderCustomerProfileCard(row) + renderComplaintPathCard(row, analysis) + '</div><section class="customer-profile-history"><div class="customer-profile-section-title"><span>历史工单</span><strong>' + historyCountText + '</strong></div>' + renderHistoricalTicketWorkspace(row) + '</section></div>';
  }

  function openHistoryFieldInventory(id) {
    const record = customerHistoryRecords().find(item => item.id === id) || customerHistoryRecords()[0];
    const inventory = historyFieldInventory(record);
    const rows = inventory.sections.map(section => '<tr><td>' + section.stage + '</td><td>' + section.title + '</td><td>' + section.fields.length + '</td><td>' + section.fields.join('、') + '</td></tr>').join("");
    openModal("历史工单字段清单", '<div class="history-field-inventory"><div class="query-condition"><span>工单编号</span><strong>' + record.id + '</strong><small>录入 ' + inventory.entry + ' 项 · 处理 ' + inventory.processing + ' 项 · 审批 ' + inventory.approval + ' 项；字段名称直接取自当前表单元数据。</small></div><div class="table-wrap"><table class="table ds-table"><thead><tr><th>阶段</th><th>章节</th><th>字段数</th><th>字段名称</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>', "关闭");
  }

  function openCustomerHistory(scope = "customer.1") {
    const prefix = scope ? scope + "." : "";

    const customerNo = state.formValues[prefix + "客户编号"] || state.formValues[prefix + "__customerId"] || "";
    const customerName = state.formValues[prefix + "客户姓名"] || "-";
    const items = customerHistoryRecords(["", state.workOrderType || "投诉单", customerName], { customerNo, excludeId:"", includeNonDraft:true });
    const complaintRows = items.filter(record => record.type === "投诉单");
    const countType = typeName => items.filter(record => record.type === typeName).length;
    const summary = '<div class="customer-history-summary">该客户共有工单' + items.length + '笔（投诉单' + complaintRows.length + '笔、信访单' + countType("信访单") + '笔、建议单' + countType("建议单") + '笔、表扬单' + countType("表扬单") + '笔）。</div>';
    const list = items.length ? '<div class="panel related-order-list customer-history-list"><div class="related-order-list-head"><strong>工单列表</strong><span>' + items.length + '</span></div><div class="table-wrap customer-history-table-wrap"><table class="table ds-table customer-history-table" aria-label="客户历史工单"><thead><tr><th scope="col">工单类型</th><th scope="col">工单编号</th><th scope="col">工单状态</th></tr></thead><tbody>' + items.map(item => '<tr class="customer-history-item"><td>' + escapeAttribute(item.type) + '</td><td><strong>' + escapeAttribute(item.id) + '</strong></td><td>' + statusTag(item.status) + '</td></tr>').join("") + '</tbody></table></div></div>' : '<div class="ds-empty app-empty-state customer-history-empty"><h4>暂无历史工单</h4><p>没有与客户编号 ' + escapeAttribute(customerNo || "-") + ' 关联的非草稿工单。</p></div>';
    openModal("客户历史工单", '<div class="customer-history-dialog">' + summary + list + '</div>', "关闭");
  }

  function approvalRecord(id = state.approvalContext?.requestId) {
    return approvalRecordById(id) || null;
  }

  function approvalFormConfig(context = state.approvalContext) {
    const stage = context?.reviewMode ? "review" : (context?.approvalStage || "approval");
    const label = approvalStageLabel(stage);
    return {
      stage,
      label,
      actorKey: label + "人",
      conclusionKey: label + "结论",
      opinionKey: label + "意见"
    };
  }

  function approvalRejectConclusion(config = approvalFormConfig()) {
    return config.stage === "review" ? "不通过" : "驳回";
  }

  function approvalConclusionIsRejected(conclusion) {
    return ["不通过", "驳回"].includes(conclusion);
  }

  function syncApprovalOpinionRequirement(host, conclusion) {
    const editor = host.closest(".approval-editor") || host.closest("tr[data-current-countersigner]");
    const opinion = editor?.querySelector("[data-approval-opinion]");
    if (!opinion) return;
    const rejected = approvalConclusionIsRejected(conclusion);
    opinion.setAttribute("aria-required", String(rejected));
    opinion.closest(".approval-opinion-field")?.classList.toggle("required", rejected);
  }

  function resetApprovalFormValues(stage = "approval") {
    const label = approvalStageLabel(stage);
    state.formValues[label + "结论"] = "通过";
    state.formValues[label + "意见"] = "";
  }

  function countersignMembersForTicket(ticketId = state.approvalContext?.ticketId || state.detailId) {
    const row = workflowRow("ticket", ticketId);
    const record = documentRecordFor("ticket", row);
    const storedMembers = record?.fields?.countersign?.["会签明细"];
    if (Array.isArray(storedMembers) && storedMembers.length > 1) return deepClone(storedMembers);
    const processing = record?.fields?.processing || {};
    let organizations = processing["会签机构"] || [];
    if (!Array.isArray(organizations)) organizations = organizations ? [organizations] : [];
    if (!organizations.length) organizations = ["总行 / 总行"];
    const person = processing["会签人"] || countersignPersonOptions(organizations)[0];
    return [{
      "会签机构": organizations.map(organization => hierarchySelectionLabel(organization, "institutionTree")).join("、"),
      "会签人": person,
      "会签结论": "",
      "会签意见": "",
      "会签状态": "待会签",
      current: true
    }];
  }

  function renderCountersignOpinionTable(readonly = false) {
    const config = approvalFormConfig();
    const rejectConclusion = approvalRejectConclusion(config);
    const members = countersignMembersForTicket();
    const conclusion = state.formValues[config.conclusionKey] || "通过";
    const opinion = state.formValues[config.opinionKey] || "";
    const rows = members.map((member, index) => {
      const editable = !readonly && (member.current || (!members.some(item => item.current) && index === members.length - 1));
      const decision = editable
        ? '<div class="di-choice-row" data-app-radio><button type="button" class="di-radio-choice ' + (conclusion === "通过" ? "is-checked" : "") + '" data-radio-value="通过">通过</button><button type="button" class="di-radio-choice ' + (conclusion === rejectConclusion ? "is-checked" : "") + '" data-radio-value="' + rejectConclusion + '">' + rejectConclusion + '</button><input type="hidden" data-field-key="' + config.conclusionKey + '" value="' + escapeAttribute(conclusion) + '"></div>'
        : statusTag(member["会签结论"] || "待会签");
      const opinionControl = editable
        ? '<textarea class="di-textarea countersign-opinion-input" data-approval-opinion data-field-key="' + config.opinionKey + '" aria-required="' + approvalConclusionIsRejected(conclusion) + '" placeholder="驳回时必填">' + escapeAttribute(opinion) + '</textarea>'
        : '<span class="countersign-opinion-text">' + escapeAttribute(member["会签意见"] || "-") + '</span>';
      return '<tr data-countersign-member="' + escapeAttribute(member["会签人"] || "") + '" data-current-countersigner="' + editable + '"><td>' + escapeAttribute(member["会签机构"] || "-") + '</td><td><strong>' + escapeAttribute(member["会签人"] || "-") + '</strong><small>' + escapeAttribute(member["会签状态"] || (editable ? "待会签" : "已会签")) + '</small></td><td>' + decision + '</td><td>' + opinionControl + '</td></tr>';
    }).join("");
    return '<div class="countersign-opinion-table-wrap"><div class="countersign-table-note"><strong>多人会签</strong><span>每位会签人独立填写结论和意见；当前登录人的行可编辑。</span></div><div class="table-wrap"><table class="table ds-table countersign-opinion-table"><thead><tr><th>会签机构</th><th>会签人</th><th>会签结论</th><th>会签意见</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function approvalEditor(compact = false) {
    const config = approvalFormConfig();
    if (config.stage === "countersign" && !compact) return renderCountersignOpinionTable(false);
    const conclusion = state.formValues[config.conclusionKey] || "通过";
    const rejectConclusion = approvalRejectConclusion(config);
    const opinion = state.formValues[config.opinionKey] || "";
    const actor = currentRoleProfile().label + " · 陈敏慧-60157";
    return '<div class="approval-editor ' + (compact ? "is-compact" : "") + '"><label><span>' + config.actorKey + '</span><input class="di-input" value="' + actor + '" readonly></label><div class="approval-decision"><span>' + config.conclusionKey + '</span><div class="di-choice-row" data-app-radio><button type="button" class="di-radio-choice ' + (conclusion === "通过" ? "is-checked" : "") + '" data-radio-value="通过">通过</button><button type="button" class="di-radio-choice ' + (conclusion === rejectConclusion ? "is-checked" : "") + '" data-radio-value="' + rejectConclusion + '">' + rejectConclusion + '</button><input type="hidden" data-field-key="' + config.conclusionKey + '" value="' + conclusion + '"></div></div><label class="approval-opinion-field ' + (approvalConclusionIsRejected(conclusion) ? "required" : "") + '"><span>' + config.opinionKey + '</span><div class="textarea-with-count"><textarea class="di-textarea" maxlength="2000" data-approval-opinion data-field-key="' + config.opinionKey + '" aria-required="' + approvalConclusionIsRejected(conclusion) + '" placeholder="' + rejectConclusion + '时必填">' + opinion + '</textarea><small class="textarea-count">' + String(opinion || "").length + '/2000</small></div></label></div>';
  }

  function renderQuickApprovalWorkbench(record, row) {
    const isSms = record[1] === "短信审批";
    const title = isSms ? "待审批短信" : "待审批导出申请";
    const requestDeadline = dispositionDeadlineInfo(record, "approval");
    const requestTimeLabel = requestDeadline.deadline
      ? "申请时间 " + (record[7] || "-") + " · " + dispositionRemaining(requestDeadline.deadline, "") + "（+8小时）"
      : requestDeadline.emptyLabel;
    const exportRow = isSms ? null : exportRequestRows.find(item => item[0] === record[0]);
    const relatedTickets = isSms ? record[8] : exportRow?.[8];
    const relatedSubprocesses = isSms ? "" : exportRow?.[9];
    const relationText = [relatedTickets && "工单：" + relatedTickets, relatedSubprocesses && "子流程：" + relatedSubprocesses].filter(Boolean).join("；") || "-";
    const focus = isSms
      ? '<section class="panel detail-section approval-focus-section"><div class="panel-head"><span class="panel-title">短信审批内容</span></div><dl class="ds-descriptions detail-descriptions"><div><dt>关联工单</dt><dd>' + row[0] + '</dd></div><div><dt>客户姓名</dt><dd>' + row[2] + '</dd></div><div><dt>投诉事项</dt><dd>' + row[3] + '</dd></div><div><dt>申请时间</dt><dd>' + (record[7] || "-") + '</dd></div><div><dt>接收号码</dt><dd>13800007621</dd></div><div class="is-wide"><dt>短信内容</dt><dd>尊敬的客户，您反馈的事项正在处理中。相关核查进展及后续安排已由处理人员向您说明，如有疑问请联系对应处理机构。</dd></div></dl></section>'
      : '<section class="panel detail-section approval-focus-section"><div class="panel-head"><span class="panel-title">导出申请内容</span></div><dl class="ds-descriptions detail-descriptions"><div><dt>导出类型</dt><dd>' + (exportRow?.[1] || record[2]) + '</dd></div><div><dt>申请人</dt><dd>' + record[3] + '</dd></div><div><dt>数据范围</dt><dd>' + (exportRow?.[2] || "-") + '</dd></div><div><dt>申请时间</dt><dd>' + (record[7] || "-") + '</dd></div><div class="is-wide"><dt>关联业务单</dt><dd>' + relationText + '</dd></div><div class="is-wide"><dt>导出字段</dt><dd>工单编号、工单类型、客户姓名（脱敏）、受理渠道、业务类型、处理机构、工单状态、创建时间、办结时间</dd></div><div class="is-wide"><dt>申请用途</dt><dd>投诉处理复盘、台账核对或监管报送准备。</dd></div></dl></section>';
    return '<section class="panel approval-quick-bar"><div class="approval-quick-meta"><span>' + title + '</span><strong>' + record[0] + ' · ' + record[5] + '</strong><small>' + requestTimeLabel + '</small></div>' + approvalEditor(true) + '<div class="approval-quick-actions"><button type="button" class="btn xib-btn xib-btn--secondary" data-action="save-approval">保存</button><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="submit-approval">提交审批意见</button></div></section>' + focus;
  }

  function renderPriorApprovalStage() {
    const context = state.approvalContext;
    if (!context || context.approvalStage !== "approval") return "";
    const kind = context.type === "工单审批" ? "ticket" : context.type === "子流程审批" ? "subprocess" : "";
    const id = kind === "ticket" ? context.ticketId : context.subprocessId;
    const row = kind ? workflowRow(kind, id) : null;
    const priorStage = row ? approvalStagesFor(kind, row).find(stage => ["initial", "countersign"].includes(stage)) : "";
    if (!row || !priorStage) return "";
    const label = approvalStageLabel(priorStage);
    if (priorStage === "countersign") return '<div class="approval-prior-stage"><div class="approval-prior-stage-title"><strong>会签信息</strong><span>已完成，当前只读</span></div>' + renderCountersignOpinionTable(true) + '</div>';
    const history = (workflowHistory[kind][id] || []).map(normalizeWorkflowRecord).find(item => item.flowSceneName === label + "通过" || item.flowSceneName === label + "驳回" || item.flowSceneName === label + "不通过");
    if (!history) return "";
    return '<div class="approval-prior-stage"><div class="approval-prior-stage-title"><strong>' + label + '信息</strong><span>已完成，当前只读</span></div><dl class="ds-descriptions detail-descriptions"><div><dt>' + label + '人</dt><dd>' + escapeAttribute(history.operatorName) + '</dd></div><div><dt>' + label + '结论</dt><dd>' + statusTag(history.result) + '</dd></div><div class="is-wide"><dt>' + label + '意见</dt><dd>' + escapeAttribute(history.flowOpinion || "-") + '</dd></div></dl></div>';
  }

  function renderFullApprovalSection() {
    const config = approvalFormConfig();
    const title = config.stage === "countersign" ? "会签意见" : config.label + "信息";
    const help = config.stage === "countersign" ? "多人会签逐人记录；当前登录人填写自己的结论和意见，驳回时意见必填" : "浏览完整业务内容后填写；结论为" + approvalRejectConclusion(config) + "时意见必填";
    const ticket = state.approvalContext?.type === "工单审批" ? ticketRowById(state.approvalContext.ticketId || state.detailId) : null;
    const missingEffectiveContact = ticket?.[1] === "投诉单" && ["approval", "countersign"].includes(config.stage) && !contactRecordsForTicket(ticket).some(isEffectiveFollowUpContact);
    const contactNotice = missingEffectiveContact ? '<div class="approval-contact-warning" role="status">处理不规范：处理阶段无有效联系记录</div>' : '';
    return contactNotice + '<section class="form-section approval-opinion-section" id="section-approval"><div class="form-section-head">' + title + '</div><div class="form-section-body">' + renderPriorApprovalStage() + approvalEditor(false) + '</div></section>';
  }

  function renderApprovalStickyFooter() {
    const config = approvalFormConfig();
    return '<div class="sticky-actions approval-bottom-actions"><span>' + config.label + '意见可暂存，提交后进入下一流转节点</span><button type="button" class="btn xib-btn xib-btn--secondary" data-action="save-approval">保存' + config.label + '意见</button><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="submit-approval">提交' + config.label + '意见</button></div>';
  }

  function openApprovalReview(id) {
    const ticket = workflowRow("ticket", id);
    const subprocess = workflowRow("subprocess", id);
    const record = approvalRecordById(id) || (subprocess ? [subprocess[0], "子流程审批", subprocess[1], subprocess[3], subprocess[4], approvalStageLabel(approvalStageFor("subprocess", subprocess)), "剩余 1 天"] : null);
    if (!record) return toast("未找到待审批记录", true);

    const quick = ["短信审批", "导出申请审批"].includes(record[1]);
    if (quick) {
      const relatedSubprocess = record[9] ? workflowRow("subprocess", record[9]) : null;
      const ticketId = record[8] || relatedSubprocess?.[2] || "TS202607230012";
      state.approvalContext = { requestId:record[0], type:record[1], mode:"quick", ticketId, subprocessId:record[9] || "", approvalStage:"approval" };
      state.detailEntry = "approve";
      if (record[1] === "短信审批" && workflowRow("ticket", ticketId)?.[5] !== "处理中") {
        state.approvalContext = null;
        return toast("仅处理中工单可发起或审批短信申请", true);
      }
      resetApprovalFormValues("approval");
      state.detailId = ticketId;
      state.detailTab = "基本信息";
      return navigate("ticket-detail");
    }

    if (ticket || record[1] === "工单审批") {
      const target = ticket || workflowRow("ticket", record[0]);
      if (!target) return toast("未找到待审批工单", true);
      state.approvalContext = { requestId:target[0], type:"工单审批", mode:"full", ticketId:target[0] };
      state.detailEntry = "approve";
      if (["待复核", "复核中"].includes(target[5])) {
        if (target[5] === "待复核") {
          const started = workflowTransition("ticket", target[0], "startReview", { action:"进入复核", opinion:"复核员已打开工单并开始复核。", result:"处理中", receiver:"当前复核员" });
          if (!started.ok) { state.approvalContext = null; return toast(started.reason, true); }
        }
        state.approvalContext.reviewMode = true;
        state.approvalContext.approvalStage = "review";
      } else if (target[5] === "会签中") {
        const stage = approvalStageFor("ticket", target);
        state.approvalContext.approvalStage = stage;
        const started = workflowTransition("ticket", target[0], "startCountersign", { action:"进入会签", result:"处理中", receiver:"当前会签人" });
        if (!started.ok) { state.approvalContext = null; return toast(started.reason, true); }
      } else if (["待初审", "初审中"].includes(target[5])) {
        const stage = "initial";
        state.approvalContext.approvalStage = stage;
        if (target[5] === "待初审") {
          const started = workflowTransition("ticket", target[0], "startInitial", { result:"处理中", receiver:"当前初审人" });
          if (!started.ok) { state.approvalContext = null; return toast(started.reason, true); }
        }
      } else if (["待审批", "审批中"].includes(target[5])) {
        const stage = approvalStageFor("ticket", target);
        state.approvalContext.approvalStage = stage;
        if (target[5] === "待审批") {
          const started = workflowTransition("ticket", target[0], "startApproval", { action:"进入" + approvalStageLabel(stage), result:"处理中", receiver:"当前" + approvalStageLabel(stage) + "人" });
          if (!started.ok) { state.approvalContext = null; return toast(started.reason, true); }
        }
      } else {
        state.approvalContext = null;
        return toast("当前工单状态无法进入复核、会签或审批", true);
      }
      resetApprovalFormValues(state.approvalContext.approvalStage);
      state.detailId = target[0];
      state.detailTab = "基本信息";
      state.relatedRootTicketId = target[0];
      state.relatedItemId = target[0];
      return navigate("ticket-detail");
    }

    const target = subprocess || workflowRow("subprocess", record[0]);
    if (!target) return toast("未找到待审批子流程", true);
    const reviewMode = ["待复核", "复核中"].includes(target[5]);
    const stage = reviewMode ? "review" : approvalStageFor("subprocess", target);
    if (stage === "none") return toast("该子流程不需要复核、初审或审批，系统已自动流转", true);
    if (!reviewMode && !["待初审", "初审中", "待审批", "审批中"].includes(target[5])) return toast("当前子流程状态无法进入复核、初审或审批", true);
    state.approvalContext = { requestId:target[0], type:"子流程审批", mode:"full", ticketId:target[2], subprocessId:target[0], approvalStage:stage, reviewMode };
    state.detailEntry = "approve";
    if (reviewMode && target[5] === "待复核") {
      const started = workflowTransition("subprocess", target[0], "startReview", { action:"进入复核", result:"处理中", receiver:"当前复核员" });
      if (!started.ok) { state.approvalContext = null; return toast(started.reason, true); }
    } else if (!reviewMode && ["待初审", "待审批"].includes(target[5])) {
      const started = workflowTransition("subprocess", target[0], target[5] === "待初审" ? "startInitial" : "startApproval", { result:"处理中", receiver:"当前" + approvalStageLabel(stage) + "人" });
      if (!started.ok) { state.approvalContext = null; return toast(started.reason, true); }
    }
    resetApprovalFormValues(stage);
    state.subprocessId = target[0];
    state.detailId = target[2];
    state.subprocessDetailTab = "处理信息";
    return navigate("subprocess-detail");
  }

  function submitApprovalReview(smsConfirmation = null) {
    const context = state.approvalContext;
    if (!context) return;
    const config = approvalFormConfig(context);
    const conclusion = state.formValues[config.conclusionKey] || "";
    const opinion = (state.formValues[config.opinionKey] || "").trim();
    const rejected = approvalConclusionIsRejected(conclusion);
    if (!conclusion) return toast("请选择" + config.conclusionKey, true);
    if (rejected && !opinion) return toast(config.conclusionKey + "为" + conclusion + "时必须填写" + config.opinionKey, true);

    let workflowKind = "";
    let workflowId = "";
    let workflowRowValue = null;
    if (context.type === "工单审批" && workflowRow("ticket", context.ticketId)) {
      workflowKind = "ticket";
      workflowId = context.ticketId;
      workflowRowValue = workflowRow("ticket", workflowId);
    } else if (workflowRow("rectification", context.subprocessId || context.requestId)) {
      workflowKind = "rectification";
      workflowId = context.subprocessId || context.requestId;
      workflowRowValue = workflowRow("rectification", workflowId);
    } else if (workflowRow("subprocess", context.subprocessId || context.requestId)) {
      workflowKind = "subprocess";
      workflowId = context.subprocessId || context.requestId;
      workflowRowValue = workflowRow("subprocess", workflowId);
    }

    const rectificationRoutingKey = workflowKind === "rectification" && conclusion === "通过"
      ? ({ "方案待初审":"planInitialApprove", "结果待初审":"resultInitialApprove" }[workflowRowValue?.[5]] || "")
      : "";
    const rectificationRoutingSelection = smsConfirmation?.rectificationAssignee || null;
    if (rectificationRoutingKey && !rectificationRoutingSelection) {
      const nextStatus = workflowRowValue[5] === "方案待初审" ? "方案待审批" : "结果待审批";
      return openRectificationRoutingDialog({
        row:workflowRowValue,
        ruleKey:rectificationRoutingKey,
        title:"提交整改初审意见",
        question:"确认初审通过？",
        hint:"请选择整改单发起部门的审批人员，提交后由该人员完成当前阶段审批。",
        summary:[["整改单编号", workflowId], ["提交后状态", nextStatus]],
        confirmLabel:"确认提交",
        onConfirm:selection => { closeOverlay(); submitApprovalReview({ rectificationAssignee:selection }); }
      });
    }

    const reviewSmsRequired = workflowKind === "ticket" && context.reviewMode && conclusion === "通过"
      && ticketSmsDeferredUntilReview(workflowRowValue[1], ticketAcceptanceChannel(workflowRowValue));
    if (reviewSmsRequired && !smsConfirmation) {
      const summary = '<div class="action-dialog"><div class="action-dialog-question"><strong>确认复核通过？</strong><span>复核通过后进入机构工单池，并按本次选择发送短信。</span></div><dl class="action-summary-grid"><div><dt>工单编号</dt><dd>' + escapeAttribute(workflowId) + '</dd></div><div><dt>客户姓名</dt><dd>' + escapeAttribute(workflowRowValue[2]) + '</dd></div><div><dt>受理渠道</dt><dd>' + escapeAttribute(ticketAcceptanceChannel(workflowRowValue)) + '</dd></div><div><dt>派发机构</dt><dd>' + escapeAttribute(workflowRowValue[4]) + '</dd></div></dl>';
      return openTicketSmsConfirmation({
        title:"工单复核确认", summary, confirmLabel:"确认复核通过", ticketId:workflowId,
        onConfirm:(template, recipient) => { closeOverlay(); submitApprovalReview({ template, recipient }); }
      });
    }

    if (workflowKind === "rectification") {
      const editableStage = rectificationApprovalEditableStage(workflowRowValue);
      if (editableStage) persistRectificationApprovalEdits(workflowRowValue, editableStage);
    }

    let countersignSnapshotMembers = [];
    let currentCountersignMember = null;
    let nextCountersignMember = null;
    let remainingCountersignCount = 0;
    if (config.stage === "countersign") {
      let submitted = false;
      countersignSnapshotMembers = countersignMembersForTicket(workflowId).map(member => {
        if (!submitted && (member.current || !member["会签结论"])) {
          submitted = true;
          currentCountersignMember = { ...member };
          return { ...member, "会签结论": conclusion, "会签意见": opinion, "会签状态": "已会签", current:false };
        }
        return { ...member, current:false };
      });
      if (conclusion === "通过") {
        const nextIndex = countersignSnapshotMembers.findIndex(member => !member["会签结论"]);
        if (nextIndex >= 0) {
          countersignSnapshotMembers[nextIndex] = { ...countersignSnapshotMembers[nextIndex], current:true, "会签状态":"待会签" };
          nextCountersignMember = countersignSnapshotMembers[nextIndex];
        }
        remainingCountersignCount = countersignSnapshotMembers.filter(member => !member["会签结论"]).length;
      }
    }

    let approvalEvent = rejected ? "reject" : "approve";
    if (context.reviewMode) {
      if (workflowKind === "subprocess") approvalEvent = rejected ? "rejectReview" : (workflowRowValue?.[1] === "撤销投诉" ? "reviewToComplete" : subprocessNeedsInitialApproval(workflowRowValue) ? "reviewToInitial" : "reviewToApproval");
      else approvalEvent = rejected ? "rejectReview" : "review";
    }
    else if (config.stage === "initial" && workflowKind !== "rectification") approvalEvent = rejected ? (workflowKind === "subprocess" && !subprocessHasProcessingStage(workflowRowValue?.[1], workflowRowValue) ? "rejectInitialToDraft" : "rejectInitial") : "passInitial";
    else if (config.stage === "countersign") approvalEvent = rejected ? "rejectCountersign" : remainingCountersignCount ? "startCountersign" : "passCountersign";
    else if (workflowKind === "subprocess" && conclusion === "通过") approvalEvent = SUBPROCESS_SUPPLEMENT_TYPES.has(workflowRowValue?.[1]) ? "approveToSupplement" : "approveToComplete";

    let transitionResult = null;
    if (workflowKind) {
      const approvalDataStage = config.stage === "review" ? "review" : config.stage === "initial" ? "initialApproval" : config.stage === "countersign" ? "countersign" : "approval";
      const approvalSnapshot = {
        [config.actorKey]: currentRoleProfile().label + " · 陈敏慧-60157",
        [config.conclusionKey]: conclusion,
        [config.opinionKey]: opinion
      };
      if (config.stage === "countersign") approvalSnapshot["会签明细"] = countersignSnapshotMembers;
      snapshotDocumentStage(workflowKind, workflowId, approvalDataStage, approvalSnapshot);
      const waitingForCountersigners = config.stage === "countersign" && conclusion === "通过" && remainingCountersignCount > 0;
      transitionResult = workflowTransition(workflowKind, workflowId, approvalEvent, {
        action: waitingForCountersigners ? "提交会签意见" : config.label + conclusion,
        actor: config.stage === "countersign" ? (currentCountersignMember?.["会签人"] || "当前会签人") : undefined,
        role: config.stage === "countersign" ? "会签人" : undefined,
        org: config.stage === "countersign" ? (currentCountersignMember?.["会签机构"] || currentRoleProfile().orgLabel) : undefined,
        opinion,
        result: conclusion,
        receiver: rectificationRoutingSelection?.actor || (rejected ? "上一节点处理人" : waitingForCountersigners ? (nextCountersignMember?.["会签人"] || "下一会签人") : ["initial", "countersign"].includes(config.stage) ? "审批人" : (approvalEvent === "approveToSupplement" ? "补录经办人" : "下一节点处理人")),
        assignee:rectificationRoutingSelection?.actor
      });
      if (!transitionResult.ok) return toast(transitionResult.reason, true);
      if (workflowKind === "rectification" && rectificationRoutingSelection) saveRectificationRoutingAssignment(workflowId, transitionResult, rectificationRoutingSelection);
      if (workflowKind === "ticket" && context.reviewMode && transitionResult.to === "待处理") COMPLAINT_WORK_POOL.clearTransferAssignment("ticket", workflowId, "ticket-process");
      if (reviewSmsRequired && smsConfirmation?.template) recordTicketAcceptanceSms(workflowRowValue, smsConfirmation.template, "review", smsConfirmation.recipient || "");
      if (config.stage === "review" && workflowKind === "subprocess" && conclusion === "通过") setApprovalStage(workflowId, transitionResult.to === "待初审" ? "initial" : transitionResult.to === "待审批" ? "approval" : "none");
      if (config.stage === "initial" && conclusion === "通过") setApprovalStage(workflowId, "approval");
      if (config.stage === "countersign" && conclusion === "通过") setApprovalStage(workflowId, remainingCountersignCount ? "countersign" : "approval");
      if (config.stage === "approval" && conclusion === "通过") setApprovalStage(workflowId, "none");
      if (workflowKind === "subprocess" && workflowRowValue?.[1] === "投诉校正" && transitionResult.to === "已办结" && conclusion === "通过") {
        applyCompletedCorrectionToMainTicket(workflowRowValue);
      }
    }

    if (context.type === "导出申请审批") {
      const exportRequest = exportRequestRows.find(item => item[0] === context.requestId);
      if (exportRequest) {
        exportRequest[5] = conclusion === "通过" ? "已通过" : "已驳回";
        exportRequest[6] = conclusion === "通过" ? "已生成文件" : "流程结束";
        exportRequest[13] = currentRoleProfile().label;
        exportRequest[14] = currentRoleProfile().institutionLabel || exportRequest[14];
        exportRequest[15] = conclusion === "通过" ? "可下载" : "已驳回";
        exportRequest[18] = opinion;
        if (conclusion === "通过") {
          const approvedAt = new Date();
          exportRequest[19] = formatPrototypeDateTime(approvedAt);
          exportRequest[20] = formatPrototypeDateTime(new Date(approvedAt.getTime() + EXPORT_REQUEST_DOWNLOAD_RETENTION_MS));
        } else {
          exportRequest[19] = "";
          exportRequest[20] = "";
        }
        appendExportRequestRecord(exportRequest, conclusion === "通过" ? "审批通过" : "审批驳回", opinion || (conclusion === "通过" ? "同意申请" : "不同意申请"), { statusTransition:"审批中 → " + exportRequest[5], result:conclusion });
      }
      removeExportApprovalRecord(context.requestId);
    }

    let smsStatusResult = "";
    if (context.type === "短信审批") {
      const ticket = workflowRow("ticket", context.ticketId);
      if (!ticket || ticket[5] !== "处理中") return toast("仅处理中工单可提交短信审批", true);
      smsStatusResult = rejected ? "已驳回" : "已通过";
      const approvalRecord = approvalRows.find(row => row[0] === context.requestId);
      if (approvalRecord) approvalRecord[10] = smsStatusResult;
      state.smsStatusByTicket[context.ticketId] = smsStatusResult;
      const smsRecords = state.contactRecordsByTicket[context.ticketId] || [];
      const pendingSms = [...smsRecords].reverse().find(record => isSmsContact(record) && smsApprovalStatusForRecord(record) === "待审批");
      if (pendingSms) {
        pendingSms.smsApprovalStatus = smsStatusResult;
        if (rejected) {
          pendingSms.smsApprovalOpinion = opinion;
          pendingSms.smsApprovalHistory = [...(pendingSms.smsApprovalHistory || []), { opinion, time:systemTimestamp() }];
        }
        pendingSms.contactStatus = conclusion === "通过" ? "已联系" : "";
        pendingSms.sendStatus = conclusion === "通过" ? "已送达" : "未发送";
      }
      persistWorkflowState();
    }

    const triggeredRecord = Object.values(state.triggeredSubprocesses).flat().find(record => record.id === context.requestId || record.id === context.subprocessId);
    if (triggeredRecord && transitionResult) {
      triggeredRecord.status = transitionResult.to;
      const finalApprovalPassed = config.stage === "approval" && conclusion === "通过";
      triggeredRecord.linked = finalApprovalPassed;
      triggeredRecord.relationStatus = finalApprovalPassed ? (transitionResult.to === "待补录" ? "审批通过，待完成补录" : "审批通过，已关联") : rejected ? config.label + conclusion + "，未关联" : "初审通过，等待审批";
      if (finalApprovalPassed && triggeredRecord.type === "废止申请") {
        const relatedTicket = ticketRowById(triggeredRecord.relatedTicket);
        if (relatedTicket) {
          relatedTicket[5] = "已废止";
          relatedTicket[6] = systemTimestamp();
          const queryRow = queryTicketRows.find(item => item[0] === relatedTicket[0]);
          if (queryRow) {
            queryRow[5] = relatedTicket[5];
            queryRow[6] = relatedTicket[6];
          }
        }
      }
      const row = subprocessRows.find(item => item[0] === triggeredRecord.id);
      if (row) row[5] = triggeredRecord.status;
    }

    const repeatRelation = context.type === "工单审批" && config.stage === "approval" ? state.repeatRelations[context.ticketId] : null;
    if (repeatRelation) {
      repeatRelation.linked = conclusion === "通过";
      repeatRelation.status = conclusion === "通过" ? "审批通过，已关联" : "审批驳回，未关联";
    }

    persistWorkflowState();
    toast(context.requestId + " 已提交" + config.label + "意见，结论：" + conclusion + (transitionResult ? "；单据状态：" + transitionResult.to : "") + (smsStatusResult ? "；短信状态：" + smsStatusResult + "；工单保持处理中" : ""));
    state.approvalContext = null;
    state.formValues[config.opinionKey] = "";
    state.approvalTab = context.type === "子流程审批" ? "子流程审批" : context.type === "短信审批" ? "短信审批" : context.type === "导出申请审批" ? "导出申请审批" : "工单审批";
    if (workflowKind === "rectification") returnToRectificationList("rectification-approve"); else navigate("my-approvals");
  }

  function riskCatalogItem(label) {
    return RISK_TAG_CATALOG.find(item => item.label === label);
  }

  function contentRiskCatalog() {
    return RISK_TAG_CATALOG.filter(item => item.dimension !== "涉黑灰产");
  }

  function grayRiskCatalog() {
    return RISK_TAG_CATALOG.filter(item => item.dimension === "涉黑灰产");
  }

  function modelContentRiskLabelsFor(row) {
    return DEFAULT_CONTENT_RISK_TAGS.filter(label => riskCatalogItem(label));
  }

  function modelGrayRiskLabelsFor(row) {
    return DEFAULT_GRAY_RISK_TAGS.filter(label => riskCatalogItem(label));
  }

  function savedRiskLabelsFor(row, kind) {
    const saved = state.riskTagsByTicket[row[0]];
    if (Array.isArray(saved)) return kind === "content" ? saved.filter(label => riskCatalogItem(label)) : modelGrayRiskLabelsFor(row);
    if (saved && Array.isArray(saved[kind])) return saved[kind].filter(label => riskCatalogItem(label));
    return kind === "gray" ? modelGrayRiskLabelsFor(row) : modelContentRiskLabelsFor(row);
  }

  function contentRiskLabelsFor(row) {
    return savedRiskLabelsFor(row, "content");
  }

  function grayRiskLabelsFor(row) {
    return savedRiskLabelsFor(row, "gray");
  }

  function saveRiskLabelsFor(row, kind, labels) {
    const existing = state.riskTagsByTicket[row[0]];
    state.riskTagsByTicket[row[0]] = {
      content: kind === "content" ? labels.slice() : (Array.isArray(existing) ? existing.slice() : Array.isArray(existing?.content) ? existing.content.slice() : modelContentRiskLabelsFor(row)),
      gray: kind === "gray" ? labels.slice() : (Array.isArray(existing?.gray) ? existing.gray.slice() : modelGrayRiskLabelsFor(row))
    };
  }

  function riskLevelClass(level) {
    return level === "高" ? "risk-level-high" : level === "中" ? "risk-level-medium" : "risk-level-low";
  }

  function riskTagMarkup(label, removable = false) {
    const item = riskCatalogItem(label) || { label, level: "高" };
    return '<span class="ds-tag risk-level-tag ' + riskLevelClass(item.level) + '">' +
      escapeAttribute(item.label) +
      (removable ? '<button type="button" data-risk-remove="' + escapeAttribute(item.label) + '" aria-label="移除' + escapeAttribute(item.label) + '">×</button>' : "") +
      '</span>';
  }

  function riskReasonText(item) {
    if (RISK_REASON_OVERRIDES[item.label]) return RISK_REASON_OVERRIDES[item.label];
    return "系统识别到录音转文本中存在与“" + item.label + "”相符的语义和行为特征。标签定义：" + item.definition;
  }

  function renderRiskReasonArticles(labels) {
    if (!labels.length) return '<div class="risk-reason-empty">模型未识别到风险标签。</div>';
    return labels.map(label => {
      const item = riskCatalogItem(label);
      if (!item) return "";
      return '<article><div class="risk-reason-heading">' + riskTagMarkup(label) + '<span>' + escapeAttribute(item.primary) + ' · ' + escapeAttribute(item.level) + '风险</span></div><p><strong>判断原因：</strong>' + escapeAttribute(riskReasonText(item)) + '</p></article>';
    }).join("");
  }

  function renderSelectedRiskDescriptions(labels) {
    if (!labels.length) return '<div class="risk-selected-description-empty">尚未选择人工维护标签，请从下方标签体系中选择。</div>';
    return labels.map(label => {
      const item = riskCatalogItem(label);
      if (!item) return "";
      return '<article><div>' + riskTagMarkup(label) + '<span>' + escapeAttribute(item.dimension) + ' / ' + escapeAttribute(item.primary) + '</span></div><p>' + escapeAttribute(item.definition) + '</p></article>';
    }).join("");
  }

  // 开发测试视图固定展示三笔已生成结果，便于说明排序、标签上限和详情弹窗。
  function riskResultRecordsForTicket(row) {
    const actual = outboundContactRecordsForTicket(row)
      .filter(record => contactTranscriptState(record).status === "success")
      .map(record => ({ ...record }));
    if (state.role === "developer") {
      actual.push(
        { id:"risk-demo-2", time:"2026-10-16 10:27:33", recordingId:"CALL-20261016-102733" },
        { id:"risk-demo-3", time:"2026-10-16 11:05:41", recordingId:"CALL-20261016-110541" }
      );
    }
    const sorted = actual.sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")));
    // 开发演示只展示三笔样例；其他视图保留全部已回传的外呼记录。
    return state.role === "developer" ? sorted.slice(0, 3) : sorted;
  }

  function riskRecordLabels(row, index, kind) {
    const catalog = kind === "gray" ? grayRiskCatalog() : contentRiskCatalog();
    const counts = kind === "gray" ? [6, 4, 5] : [8, 5, 6];
    const offset = index % Math.max(catalog.length, 1);
    const rotated = catalog.slice(offset).concat(catalog.slice(0, offset));
    return rotated.slice(0, Math.min(counts[index] || 5, rotated.length)).map(item => item.label);
  }

  function riskRecordTagsMarkup(labels, maxVisible = 4) {
    const visible = labels.slice(0, maxVisible).map(label => '<span class="risk-model-tag">' + escapeAttribute(label) + '</span>').join("");
    const overflow = labels.length > maxVisible ? '<span class="risk-tag-more">+' + (labels.length - maxVisible) + '</span>' : '';
    return visible + overflow;
  }

  // 人工补充选项来自《XIB风险提示标签体系0918》：一级标签、二级标签、风险等级。
  const MANUAL_RISK_TAG_OPTIONS = [
    {"category":"易投诉风险","label":"高龄老人","level":"高"},
    {"category":"易投诉风险","label":"超高龄老人","level":"高"},
    {"category":"易投诉风险","label":"未成年","level":"高"},
    {"category":"易投诉风险","label":"重要客户","level":"中"},
    {"category":"易投诉风险","label":"新市民","level":"中"},
    {"category":"易投诉风险","label":"器质性病变","level":"中"},
    {"category":"易投诉风险","label":"孕妇","level":"低"},
    {"category":"易投诉风险","label":"宝妈/宝爸","level":"低"},
    {"category":"易投诉风险","label":"重大手术康复期","level":"高"},
    {"category":"易投诉风险","label":"其他特殊人士","level":"高"},
    {"category":"易投诉风险","label":"危重病客户","level":"高"},
    {"category":"易投诉风险","label":"疑似心理状态异常","level":"高"},
    {"category":"易投诉风险","label":"法律从业者","level":"中"},
    {"category":"易投诉风险","label":"行政事业机构人员","level":"中"},
    {"category":"易投诉风险","label":"金融行业从业者","level":"高"},
    {"category":"易投诉风险","label":"媒体从业者","level":"高"},
    {"category":"易投诉风险","label":"教育及人力从业者","level":"高"},
    {"category":"易投诉风险","label":"警察","level":"中"},
    {"category":"易投诉风险","label":"低端从业者","level":"高"},
    {"category":"易投诉风险","label":"无业","level":"高"},
    {"category":"易投诉风险","label":"男性科研人员","level":"中"},
    {"category":"易投诉风险","label":"退伍军人","level":"中"},
    {"category":"易投诉风险","label":"威胁投诉至金融监管机构","level":"低"},
    {"category":"易投诉风险","label":"威胁起诉","level":"低"},
    {"category":"易投诉风险","label":"威胁投诉至政府机构或社会团体","level":"中"},
    {"category":"易投诉风险","label":"威胁信访","level":"中"},
    {"category":"易投诉风险","label":"威胁投诉各级巡视组","level":"中"},
    {"category":"易投诉风险","label":"威胁投诉至人大政协代表","level":"中"},
    {"category":"易投诉风险","label":"威胁或要求升级至行内上级部门","level":"低"},
    {"category":"易投诉风险","label":"威胁自杀","level":"高"},
    {"category":"易投诉风险","label":"威胁危害公共安全","level":"高"},
    {"category":"易投诉风险","label":"威胁投诉银行工作人员","level":"中"},
    {"category":"易投诉风险","label":"威胁媒体曝光","level":"高"},
    {"category":"涉黑灰产","label":"专业名词堆砌","level":"中"},
    {"category":"涉黑灰产","label":"法律认知异常","level":"高"},
    {"category":"涉黑灰产","label":"高诉求","level":"高"},
    {"category":"涉黑灰产","label":"投诉内容异常","level":"高"},
    {"category":"涉黑灰产","label":"刻意夸大事实","level":"中"},
    {"category":"涉黑灰产","label":"规避投诉关键词","level":"高"},
    {"category":"涉黑灰产","label":"对比他人","level":"低"},
    {"category":"涉黑灰产","label":"弱化自身","level":"高"},
    {"category":"涉黑灰产","label":"指责银行未告知","level":"中"},
    {"category":"涉黑灰产","label":"结论推翻","level":"中"},
    {"category":"涉黑灰产","label":"主动提及交材料","level":"中"},
    {"category":"涉黑灰产","label":"表明录音留证","level":"高"},
    {"category":"涉黑灰产","label":"威胁闹访","level":"中"},
    {"category":"涉黑灰产","label":"威胁异常催办","level":"高"},
    {"category":"涉黑灰产","label":"非本人投诉","level":"高"},
    {"category":"涉黑灰产","label":"代理投诉","level":"高"},
    {"category":"涉黑灰产","label":"主动承认代理身份","level":"高"},
    {"category":"缠诉闹诉","label":"威胁我行投诉升级监管投诉","level":"高"},
    {"category":"缠诉闹诉","label":"威胁重复监管转办投诉","level":"中"},
    {"category":"缠诉闹诉","label":"威胁重复投诉","level":"中"},
    {"category":"缠诉闹诉","label":"威胁围堵网点及网点员工","level":"中"},
    {"category":"缠诉闹诉","label":"威胁冲击网点前台柜台","level":"中"},
    {"category":"缠诉闹诉","label":"威胁跟踪骚扰相关人员","level":"高"},
    {"category":"缠诉闹诉","label":"电话言语骚扰工作人员","level":"高"},
    {"category":"缠诉闹诉","label":"威胁破坏网点设备","level":"中"},
    {"category":"缠诉闹诉","label":"使用辱骂性词汇","level":"高"},
    {"category":"缠诉闹诉","label":"威胁示威抗议","level":"中"},
    {"category":"缠诉闹诉","label":"威胁报警","level":"低"},
    {"category":"缠诉闹诉","label":"借群体性事件无理投诉","level":"中"},
    {"category":"缠诉闹诉","label":"长期遗留问题纠缠","level":"高"},
    {"category":"缠诉闹诉","label":"被第三方诈骗","level":"中"},
    {"category":"缠诉闹诉","label":"转嫁经营风险","level":"高"},
    {"category":"疑似牟利","label":"小额利益导向","level":"高"},
    {"category":"疑似牟利","label":"无理损失索赔","level":"高"},
    {"category":"疑似牟利","label":"通过找茬方式获利","level":"低"},
    {"category":"疑似牟利","label":"交叉对比施压索赔","level":"中"}
  ];

  function manualRiskTagsForTicket(row) {
    if (!Array.isArray(state.manualRiskTagsByTicket[row[0]])) state.manualRiskTagsByTicket[row[0]] = ["高龄老人", "专业名词堆砌"];
    return state.manualRiskTagsByTicket[row[0]];
  }

  function openManualRiskTagDialog(row) {
    const selected = new Set(manualRiskTagsForTicket(row));
    const options = MANUAL_RISK_TAG_OPTIONS.map(item => '<label class="manual-risk-option"><input type="checkbox" value="' + escapeAttribute(item.label) + '" ' + (selected.has(item.label) ? "checked" : "") + '><span><b>' + escapeAttribute(item.category) + '</b><strong>' + escapeAttribute(item.label) + '</strong><small>' + escapeAttribute(item.level) + '风险</small></span></label>').join("");
    const content = '<div class="manual-risk-dialog"><div class="manual-risk-dialog-note">以下为参照风险提示标签体系选取的少量示例，可多选。</div><div class="manual-risk-options">' + options + '</div></div>';
    return openModal("添加人工标签", content, "保存标签", () => {
      state.manualRiskTagsByTicket[row[0]] = [...document.querySelectorAll('.manual-risk-option input:checked')].map(input => input.value);
      closeOverlay();
      rerenderPage();
    });
  }

  function openRiskRecordDetail(row, index, kind) {
    const records = riskResultRecordsForTicket(row);
    const record = records[index];
    if (!record) return toast("未找到该笔风险识别结果", true);
    const labels = riskRecordLabels(row, index, kind);
    const title = kind === "gray" ? "疑似黑灰产识别详情" : "投诉内容风险识别详情";
    const summary = '<div class="risk-record-detail-summary"><div><span>联系时间</span><strong>' + escapeAttribute(record.time || "-") + '</strong></div><div><span>录音编号</span><strong>' + escapeAttribute(contactRecordingId(record, row)) + '</strong></div></div>';
    const tags = '<div class="risk-record-detail-tags"><strong>识别标签（' + labels.length + '）</strong><div>' + labels.map(label => '<span class="risk-model-tag">' + escapeAttribute(label) + '</span>').join("") + '</div></div>';
    const reasons = '<div class="risk-record-detail-reasons"><div class="risk-record-detail-title">标签及判断原因</div>' + labels.map(label => { const item = riskCatalogItem(label); /* 此详情页不展示“特定身份人群”分类文字。 */ const primary = item?.primary === "特定身份人群" ? "" : (item?.primary ? item.primary + " · " : ""); return '<article><div class="risk-reason-heading"><span class="risk-model-tag">' + escapeAttribute(label) + '</span><span>' + escapeAttribute(primary) + escapeAttribute(item?.level || "-") + '风险</span></div><p><strong>判断原因：</strong>' + escapeAttribute(item ? riskReasonText(item) : "模型根据录音转译内容识别出该风险特征。") + '</p></article>'; }).join("") + '</div>';
    return openModal(title, '<div class="risk-record-detail-modal">' + summary + tags + reasons + '</div>', "关闭", undefined, { hideCancel:true });
  }

  function renderRiskSummary(row, force = false, editable = false) {
    if (row[1] !== "投诉单" && !force) return "";
    const resultRecords = riskResultRecordsForTicket(row);
    // 开发测试视图逐笔枚举六种外呼情况，普通角色继续展示已有记录。
    const demoRecords = [
      { time:"2026-10-16 09:42:18", recordingId:"CALL-20261016-094218" },
      { time:"2026-10-16 09:18:06", recordingId:"CALL-20261016-091806" },
      { time:"2026-10-15 16:30:25", recordingId:"CALL-20261015-163025" },
      { time:"2026-10-15 14:06:12", recordingId:"CALL-20261015-140612" }
    ];
    const records = state.role === "developer" ? resultRecords.concat(demoRecords).slice(0, 6) : resultRecords;
    const demoStates = ["result", "result", "generating", "failed", "empty", "generating"];
    const recordRows = records.map((record, index) => {
      const status = state.riskRetryByTicket[row[0]]?.[index] ? "generating" : (state.role === "developer" ? demoStates[index] : "result");
      const recordingId = contactRecordingId(record, row);
      const meta = '<div class="risk-record-meta"><div><span>外呼时间</span><strong>' + escapeAttribute(record.time || "-") + '</strong></div><div><span>录音编号</span><strong>' + escapeAttribute(recordingId) + '</strong></div></div>';
      const statusLabels = { result:"有结果", generating:"生成中", failed:"生成失败", empty:"无结果" };
      const statusBadge = status === "result" ? "" : '<span class="risk-record-status is-' + status + '">' + statusLabels[status] + '</span>';
      if (status !== "result") {
        const descriptions = { generating:"正在分析这笔外呼录音，请稍候。", failed:"这笔外呼录音的风险识别未完成。", empty:"这笔外呼录音暂无识别结果。" };
        const retry = status === "failed" || status === "empty" ? '<button type="button" class="risk-retry-button" data-action="risk-record-retry" data-id="' + index + '">重新生成</button>' : '';
        return '<article class="risk-record-item" data-risk-record-index="' + index + '">' + meta + '<div class="risk-record-main">' + statusBadge + '<div class="risk-record-state is-' + status + '"><span>' + descriptions[status] + '</span>' + retry + '</div></div></article>';
      }
      const recordContentLabels = riskRecordLabels(row, index, "content");
      const recordGrayLabels = riskRecordLabels(row, index, "gray");
      const contentResult = recordContentLabels.length ? riskRecordTagsMarkup(recordContentLabels) : '<span class="risk-result-clear">未识别到投诉内容风险</span>';
      const grayResult = recordGrayLabels.length ? riskRecordTagsMarkup(recordGrayLabels) : '<span class="risk-result-clear">未识别到黑灰产风险</span>';
      return '<article class="risk-record-item" data-risk-record-index="' + index + '">' + meta + '<div class="risk-record-main">' + statusBadge + '<div class="risk-record-results"><div><div class="risk-record-result-head"><span>投诉内容是否存在风险</span><strong>' + (recordContentLabels.length ? "是" : "否") + '</strong><button type="button" class="btn-link" data-action="risk-record-detail" data-id="' + index + ':content">查看详情</button></div><div class="risk-record-tag-list">' + contentResult + '</div></div><div><div class="risk-record-result-head"><span>是否疑似黑灰产</span><strong>' + (recordGrayLabels.length ? "是" : "否") + '</strong><button type="button" class="btn-link" data-action="risk-record-detail" data-id="' + index + ':gray">查看详情</button></div><div class="risk-record-tag-list">' + grayResult + '</div></div></div></div></article>';
    }).join("") || '<div class="risk-record-empty">暂无外呼联系记录</div>';
    const manualTags = manualRiskTagsForTicket(row);
    const manualMarkup = manualTags.length ? manualTags.map(label => { const item = MANUAL_RISK_TAG_OPTIONS.find(option => option.label === label); return '<span class="risk-manual-tag"><small>' + escapeAttribute(item?.category || "人工标签") + '</small>' + escapeAttribute(label) + '<b>' + escapeAttribute(item?.level || "-") + '风险</b>' + (editable ? '<button type="button" data-action="remove-manual-risk-tag" data-id="' + escapeAttribute(label) + '" aria-label="删除' + escapeAttribute(label) + '">×</button>' : '') + '</span>'; }).join("") : '<span class="risk-manual-empty">暂未添加人工标签</span>';
    const manualCategories = [...new Set(MANUAL_RISK_TAG_OPTIONS.map(item => item.category))];
    const firstCategory = manualCategories[0];
    const firstOptions = MANUAL_RISK_TAG_OPTIONS.filter(item => item.category === firstCategory);
    // 审批及查看入口仅展示人工标签，编辑控件只向有处理权限的角色开放。
    const manualControls = editable ? '<div class="risk-manual-controls"><label><span>风险分类</span><select data-manual-risk-category>' + manualCategories.map(item => '<option>' + escapeAttribute(item) + '</option>').join("") + '</select></label><label><span>风险标签</span><select data-manual-risk-label>' + firstOptions.map(item => '<option value="' + escapeAttribute(item.label) + '">' + escapeAttribute(item.label) + '</option>').join("") + '</select></label><label><span>风险等级</span><strong data-manual-risk-level>' + escapeAttribute(firstOptions[0]?.level || "-") + '风险</strong></label><button type="button" class="risk-manual-add" data-action="add-manual-risk-tag">＋ 添加标签</button></div>' : '';
    const manualRow = '<div class="risk-manual-row is-global"><div class="risk-manual-current"><div class="risk-manual-title"><strong>人工补充</strong><span>按风险分类选择风险标签，风险等级自动关联</span></div><div class="risk-manual-tags">' + manualMarkup + '</div></div>' + manualControls + '</div>';
    const riskView = state.role === "developer" ? "mixed" : (records.length ? "success" : "empty");
    return '<section class="panel detail-section risk-summary-section" id="section-risk-summary"><div class="panel-head"><span class="panel-title">异常风险识别</span></div><div class="risk-record-list" data-risk-view="' + riskView + '">' + recordRows + manualRow + '</div></section>';
  }

  function updateRiskSummaryCard(row, kind) {
    const card = document.querySelector('[data-risk-card="' + kind + '"]');
    if (!card) return;
    const labels = kind === "gray" ? grayRiskLabelsFor(row) : contentRiskLabelsFor(row);
    const presence = card.querySelector("[data-risk-presence]");
    const tags = card.querySelector("[data-risk-tags]");
    presence.textContent = labels.length ? "是" : "否";
    presence.classList.toggle("is-clear", !labels.length);
    tags.innerHTML = labels.length ? labels.map(label => riskTagMarkup(label)).join("") : '<span class="risk-tag-empty">' + (kind === "gray" ? "未选择黑灰产标签" : "未选择风险标签") + '</span>';
  }

  function openRiskDetail(row, kind, editable) {
    const gray = kind === "gray";
    const modelLabels = gray ? modelGrayRiskLabelsFor(row) : modelContentRiskLabelsFor(row);
    let draft = (gray ? grayRiskLabelsFor(row) : contentRiskLabelsFor(row)).slice();
    const catalog = gray ? grayRiskCatalog() : contentRiskCatalog();
    const initial = riskCatalogItem(draft[0]) || catalog[0];
    let activeDimension = initial.dimension;
    let activePrimary = initial.primary;
    const editor = editable
      ? '<section class="risk-editor-section"><div class="risk-editor-head"><div><strong>人工维护风险标签</strong><span>按风险类型、一级标签、二级标签逐级选择；保存后作为最终展示标签</span></div><b data-risk-count></b></div><div class="risk-selected-description-list" data-risk-selected-descriptions></div><div class="risk-tag-cascader" data-risk-cascade><div class="risk-cascade-column" data-risk-dimensions></div><div class="risk-cascade-column" data-risk-primaries></div><div class="risk-cascade-column" data-risk-labels></div></div></section>'
      : '<div class="workflow-readonly-notice">当前入口仅支持查看模型判断结果和已确认标签，风险标签由工单处理员维护。</div>';
    const selectedTags = draft.length ? draft.map(label => riskTagMarkup(label, editable)).join("") : '<span class="risk-tag-empty">尚未选择人工维护标签</span>';
    const content = '<div class="risk-detail-modal"><div class="risk-selected-sticky"><div><strong>当前已选标签</strong><span>人工确认结果，保存后同步到工单风险提示</span></div><div class="risk-sticky-tags" data-risk-selected>' + selectedTags + '</div></div><details class="risk-model-section" open><summary><div><strong>模型判断详情</strong><span>模型原始输出，不随人工标签选择变化</span></div><img class="risk-model-caret lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></summary><div class="risk-reason-list" data-risk-reasons>' + renderRiskReasonArticles(modelLabels) + '</div></details>' + editor + '</div>';
    openModal(gray ? "疑似黑灰产识别详情" : "投诉内容风险识别详情", content, editable ? "保存标签" : "关闭", editable ? () => {
      saveRiskLabelsFor(row, gray ? "gray" : "content", draft);
      persistWorkflowState();
      closeOverlay();
      updateRiskSummaryCard(row, gray ? "gray" : "content");
      toast((gray ? "黑灰产" : "风险") + "标签已更新");
    } : closeOverlay);

    const modal = document.querySelector(".risk-detail-modal");
    if (!editable) return;

    const renderEditor = () => {
      const dimensions = [...new Set(catalog.map(item => item.dimension))];
      const primaries = [...new Set(catalog.filter(item => item.dimension === activeDimension).map(item => item.primary))];
      if (!primaries.includes(activePrimary)) activePrimary = primaries[0];
      const labels = catalog.filter(item => item.dimension === activeDimension && item.primary === activePrimary);
      modal.querySelector("[data-risk-count]").textContent = "已选 " + draft.length + " 个";
      modal.querySelector("[data-risk-selected]").innerHTML = draft.length ? draft.map(label => riskTagMarkup(label, true)).join("") : '<span class="risk-tag-empty">尚未选择人工维护标签</span>';
      modal.querySelector("[data-risk-selected-descriptions]").innerHTML = renderSelectedRiskDescriptions(draft);
      modal.querySelector("[data-risk-dimensions]").innerHTML = '<div class="risk-cascade-title">风险类型</div>' + dimensions.map(value => '<button type="button" class="' + (value === activeDimension ? "is-active" : "") + '" data-risk-dimension="' + escapeAttribute(value) + '">' + escapeAttribute(value) + '<span>›</span></button>').join("");
      modal.querySelector("[data-risk-primaries]").innerHTML = '<div class="risk-cascade-title">一级标签</div>' + primaries.map(value => '<button type="button" class="' + (value === activePrimary ? "is-active" : "") + '" data-risk-primary="' + escapeAttribute(value) + '">' + escapeAttribute(value) + '<span>›</span></button>').join("");
      modal.querySelector("[data-risk-labels]").innerHTML = '<div class="risk-cascade-title">二级标签</div>' + labels.map(item => {
        const selected = draft.includes(item.label);
        return '<button type="button" class="risk-leaf-option ' + (selected ? "is-selected " : "") + riskLevelClass(item.level) + '" data-risk-toggle="' + escapeAttribute(item.label) + '" aria-pressed="' + selected + '"><span>' + escapeAttribute(item.label) + '</span><small>' + escapeAttribute(item.level) + '风险</small></button>';
      }).join("");
    };

    modal.addEventListener("click", event => {
      const dimensionButton = event.target.closest("[data-risk-dimension]");
      const primaryButton = event.target.closest("[data-risk-primary]");
      const toggleButton = event.target.closest("[data-risk-toggle]");
      const removeButton = event.target.closest("[data-risk-remove]");
      if (dimensionButton) {
        activeDimension = dimensionButton.dataset.riskDimension;
        activePrimary = catalog.find(item => item.dimension === activeDimension)?.primary || "";
      } else if (primaryButton) {
        activePrimary = primaryButton.dataset.riskPrimary;
      } else if (toggleButton) {
        const label = toggleButton.dataset.riskToggle;
        if (draft.includes(label)) draft = draft.filter(item => item !== label);
        else draft.push(label);
      } else if (removeButton) {
        draft = draft.filter(item => item !== removeButton.dataset.riskRemove);
      } else {
        return;
      }
      renderEditor();
    });
    renderEditor();
  }

  function currentCallRecordingId(explicitId = "") {
    const provided = String(explicitId || "").trim();
    if (provided) return provided;
    const formControl = document.querySelector('.form-item[data-field-name="录音编号"] [data-field-key="录音编号"]');
    const formValue = String(formControl?.value || state.formValues["录音编号"] || "").trim();
    if (formValue) return formValue;
    const row = ticketRowById(state.detailId);
    return String(documentRecordFor("ticket", row)?.fields?.entry?.["录音编号"] || "").trim();
  }

  function openCallTranscript(recordingId = "") {
    const resolvedId = currentCallRecordingId(recordingId);
    if (!resolvedId) return toast("请先输入录音编号", true);
    const content = '<div class="call-transcript"><div class="call-transcript-meta"><span>录音编号：' + escapeAttribute(resolvedId) + '</span><span>通话时间：2026-08-28 09:18:32</span><span>通话时长：06:42</span><span>坐席：陈敏慧-60157</span></div><div class="call-transcript-line"><b>客户 09:18:42</b><p>我想确认一下这笔业务的办理情况，页面上的费用和进度说明我没有完全看明白。</p></div><div class="call-transcript-line is-agent"><b>坐席 09:19:03</b><p>好的，我先核实业务记录和当前处理进度，也会记录您希望获得明确说明的诉求。</p></div><div class="call-transcript-line"><b>客户 09:20:16</b><p>希望银行说明相关依据，并尽快把处理结果告诉我。</p></div></div>';
    return openModal("录音转文本内容", content, "关闭");
  }
  function renderTicketAttachments(row) {
    const attachments = [
      ["受理信息", "录音文件", "CALL-20260716-0932.mp3", "MP3 / 8.6 MB", "系统", "2026-07-16 09:32"],
      ["工单具体内容", "附件", "贷款合同及费用说明.pdf", "PDF / 2.4 MB", row[2], "2026-07-16 09:34"],
      ["联系记录", "附件", "客户沟通录音_0716.mp3", "MP3 / 5.1 MB", "陈敏慧-60157", "2026-07-16 10:18:00"],
      ["处理结果", "处理附件", "协商还款方案.pdf", "PDF / 1.2 MB", "陈敏慧-60157", "2026-07-16 15:42"],
      ["投诉调查", "证明材料", "调查核验材料.zip", "ZIP / 6.8 MB", "林海-38102", "2026-07-17 11:06"]
    ];
    return `<section class="panel detail-section attachment-ledger"><div class="panel-head"><span class="panel-title">附件汇总</span><small>按来源栏目和字段统一归集本工单相关材料</small></div><div class="table-wrap"><table class="table ds-table attachment-table"><thead><tr><th>所属栏目</th><th>字段名称</th><th>附件名称</th><th>格式 / 大小</th><th>上传人</th><th>上传时间</th><th>操作</th></tr></thead><tbody>${attachments.map((item,index) => `<tr><td>${item[0]}</td><td>${item[1]}</td><td class="primary-cell">${item[2]}</td><td>${item[3]}</td><td>${item[4]}</td><td>${item[5]}</td><td class="operation-cell"><div class="row-actions"><button type="button" class="btn-link" data-action="preview-attachment" data-id="${index}">预览</button><button type="button" class="btn-link" data-action="download-attachment" data-id="${index}">下载</button></div></td></tr>`).join("")}</tbody></table></div></section>`;
  }

  function ticketDetailValueText(value) {
    if (Array.isArray(value)) return value.join("、");
    if (value && typeof value === "object") {
      if (Object.prototype.hasOwnProperty.call(value, "primary")) return businessLineValueLabel(value);
      return Object.values(value).filter(item => item !== "" && item != null).join(" / ");
    }
    return String(value ?? "");
  }

  function ticketEntryDetailModel(row) {
    const record = customerHistoryRecordFromRow(row);
    const values = historicalEntryOverrides(record);
    const sections = orderedFormSections().map(section => {
      const fields = section.fields.filter(field => historicalFieldApplies(field, row[1]) && field.type !== "aiAction" && !CORRECTION_TAG_FIELDS.has(field.name)).map(field => {
        let value = Object.prototype.hasOwnProperty.call(values, field.name) ? values[field.name] : undefined;
        if (value === undefined || value === "") value = field.valueBy?.[row[1]] ?? field.value ?? field.defaultValue ?? "";
        return { field, value };
      }).filter(item => historicalConditionMatches(item.field.showWhen, values));
      return { ...section, title:formSectionTitle(section, row[1]), fields };
    }).filter(section => section.fields.length);
    return { record, values, sections };
  }

  function renderTicketEntryDetailField(item, row, editable) {
    const { field, value } = item;
    if (field.name === "所属业务条线") return renderBusinessLineDetailItem(row, editable);
    const ticketRecord = documentRecordFor("ticket", row);
    const latestCorrection = latestCompletedCorrection(ticketRecord);
    const correctionChange = latestCorrection?.changes?.find(change => change.field === field.name);
    const override = correctionChange?.newValue ?? ticketRecord?.fields?.correctionOverrides?.[field.name];
    const hasOverride = override !== undefined && override !== null && override !== "";
    const displayValue = ticketDetailValueText(hasOverride ? override : value) || "-";
    const previousValue = correctionChange ? ticketDetailValueText(correctionChange.oldValue) || "-" : "";
    const wide = Boolean(field.span || field.singleRow || ["textarea", "upload", "checkboxGroup", "cascader", "hierarchyCascader", "businessLinePicker"].includes(field.type));
    const recordingAction = field.actionAction === "view-call-transcript" && displayValue !== "-"
      ? '<button type="button" class="btn-link detail-field-action" data-action="view-call-transcript" data-id="' + escapeAttribute(displayValue) + '">' + escapeAttribute(field.action || "查看录音转文本") + '</button>'
      : "";
    const valueHtml = correctionChange
      ? '<span class="correction-current-value">' + escapeAttribute(displayValue) + '</span><span class="correction-previous-value" aria-label="修改前">' + escapeAttribute(previousValue) + '</span>'
      : '<span>' + escapeAttribute(displayValue) + '</span>';
    return '<div class="' + (wide ? "is-wide" : "") + (correctionChange ? " is-correction-changed" : "") + '"><dt>' + escapeAttribute(historicalFieldLabel(field, row[1])) + '</dt><dd>' + valueHtml + recordingAction + '</dd></div>';
  }

  function latestCompletedCorrection(ticketRecord) {
    const history = Array.isArray(ticketRecord?.fields?.correctionHistory) ? ticketRecord.fields.correctionHistory : [];
    return CORRECTION_WRITEBACK.latest(history);
  }

  function applyCompletedCorrectionToMainTicket(subprocessRow) {
    if (!subprocessRow || subprocessRow[1] !== "投诉校正") return;
    const ticket = ticketRowById(subprocessRow[2]);
    const subprocessRecord = documentRecordFor("subprocess", subprocessRow);
    if (!ticket || !subprocessRecord) return;
    const values = subprocessRecord.fields?.entry || {};
    const ticketRecord = state.documentData.tickets?.[ticket[0]] || documentRecordFor("ticket", ticket);
    if (!ticketRecord) return;
    const existingOverrides = { ...(ticketRecord.fields?.correctionOverrides || {}) };
    const originalValues = subprocessRecord.fields?.correctionOriginalValues || {};
    const fields = subprocessDifferenceSections(subprocessDefinition("投诉校正"), "create").flatMap(section => section.fields);
    const changes = CORRECTION_WRITEBACK.buildChanges({ fields, values, originalValues, existingOverrides, entry:ticketRecord.fields?.entry || {}, fieldMap:CORRECTION_TAG_FIELD_MAP, skippedFields:["事件还原", "处置意见", "最后处置意见", "附件上传"] });
    if (!changes.length) return;
    const completedAt = systemTimestamp();
    const correctionRecord = { subprocessId:subprocessRow[0], completedAt, changes };
    state.documentData.tickets = state.documentData.tickets || {};
    state.documentData.tickets[ticket[0]] = ticketRecord;
    ticketRecord.fields = ticketRecord.fields || {};
    ticketRecord.fields.correctionHistory = [...(ticketRecord.fields.correctionHistory || []).filter(item => item?.subprocessId !== subprocessRow[0]), correctionRecord];
    const latest = latestCompletedCorrection(ticketRecord);
    ticketRecord.fields.correctionOverrides = { ...existingOverrides };
    for (const change of latest?.changes || []) ticketRecord.fields.correctionOverrides[change.field] = deepClone(change.newValue);
    ticketRecord.fields.correctionOverridesUpdatedAt = latest?.completedAt || completedAt;
    persistWorkflowState();
  }

  function renderTicketDetailCustomerCards(section, row, values, editable) {
    const customerFields = section.fields.filter(item => !["是否有客户编号", "投诉人数"].includes(item.field.name));
    const customerCount = Math.max(1, Number(values["投诉人数"]) || 1);
    const cards = Array.from({ length: customerCount }, (_, index) => {
      const number = index + 1;
      const prefix = number === 1 ? "" : "customer." + number + ".";
      const cardFields = customerFields.map(item => {
        const value = prefix && Object.prototype.hasOwnProperty.call(values, prefix + item.field.name)
          ? values[prefix + item.field.name]
          : number === 1 ? item.value : "";
        return renderTicketEntryDetailField({ field:item.field, value }, row, editable);
      }).join("");
      return '<details class="ticket-detail-customer-card" data-ticket-detail-customer-card="' + number + '" open><summary><span><strong>客户信息 ' + number + '</strong></span><img src="ui/assets/caret-top.svg" alt=""></summary><dl class="ds-descriptions detail-descriptions ticket-detail-customer-fields">' + cardFields + '</dl></details>';
    }).join("");
    return '<div class="ticket-detail-customer-list">' + cards + '</div>';
  }

  function renderTicketEntryDetailSections(row, editable = false) {
    const model = ticketEntryDetailModel(row);
    const entry = model.record.entryFields || {};
    return model.sections.map(section => {
      if (section.id === "intelligent-tags") return renderSmartTagsSection(row, editable);
      if (section.id === "customer") {
        const customerCards = renderTicketDetailCustomerCards(section, row, model.values, editable);
        return '<section class="panel detail-section ticket-schema-detail-section ticket-detail-customer-section" data-ticket-detail-section="customer"><div class="panel-head"><span class="panel-title">' + escapeAttribute(section.title) + '</span></div>' + customerCards + '</section>';
      }
      let fieldsHtml = section.fields.map(item => renderTicketEntryDetailField(item, row, editable)).join("");
      if (section.id === "basic") fieldsHtml += '<div><dt>工单状态</dt><dd>' + statusTag(row[5]) + '</dd></div>';

      const disclaimer = sectionUsesAi(section.id, row[1]) ? '<small class="ai-section-disclaimer">' + AI_DISCLAIMER + '</small>' : "";
      return '<section class="panel detail-section ticket-schema-detail-section" data-ticket-detail-section="' + escapeAttribute(section.id) + '"><div class="panel-head"><span class="panel-title">' + escapeAttribute(section.title) + '</span>' + disclaimer + '</div><dl class="ds-descriptions detail-descriptions">' + fieldsHtml + '</dl></section>';
    }).join("");
  }
  function renderTicketDetail() {
    const row = ticketRows.find(item => item[0] === state.detailId) || queryTicketRows.find(item => item[0] === state.detailId)?.slice(0, 7) || ticketRows[0];
    const ticketRecord = documentRecordFor("ticket", row);
    const deadlineInfo = dispositionDeadlineInfo(row, "ticket");
    const deadlineText = deadlineInfo.deadline || deadlineInfo.emptyLabel;
    const entryFields = ticketRecord?.fields?.entry || {};
    const customerFields = CUSTOMER_REPOSITORY.toFormFields(customerForTicket(row));
    const type = row[1];
    const petitionType = entryFields["信访类型"] || "-";
    const petitionTypeDetail = type === "信访单" ? `<div class="is-single-row"><dt>信访类型</dt><dd>${escapeAttribute(petitionType)}</dd></div>` : "";
    const draftValidation = renderDraftValidationBanner(ticketRecord, "工单");
    const createdAt = entryFields["建单时间"] || ticketRecord?.createdAt || row[6] || "-";
    const receivedAt = entryFields["接收时间"] || createdAt;
    const eventDate = entryFields["客户事件时间"] || createdAt.slice(0, 10);
    const warningSource = state.warningContextId ? window.XIB_COMPLAINT_MONITORING_DATA?.warningRows.find(item => item[0] === state.warningContextId) : null;
    const warningContextBanner = warningSource ? `<section class="panel detail-section"><div class="panel-head"><span class="panel-title">关联预警内容</span><button type="button" class="btn-link" data-action="navigate-back" data-id="analysis-warnings">返回智能预警</button></div><dl class="ds-descriptions detail-descriptions"><div><dt>预警单编号</dt><dd>${warningSource[0]}</dd></div><div><dt>场景类型</dt><dd>${warningSource[1]}</dd></div><div class="is-wide"><dt>预警摘要</dt><dd>${warningSource[2]}</dd></div></dl></section>` : "";
    const policy = workflowPolicy("ticket", row);
    const approval = state.approvalContext;
    const quickApproval = approval?.mode === "quick";
    const fullTicketApproval = approval?.mode === "full" && approval?.type === "工单审批";
    const isReviewStatus = ["待复核", "复核中"].includes(row[5]);
    const reviewInBasic = fullTicketApproval && approval?.reviewMode;
    const customerServiceCompletedSample = row[5] === "已办结" && ticketSeedRecordById.get(row[0])?.source === "客服系统带入";
    const rejectedCreationView = policy.entry === "view" && Boolean(latestCreationRejection("ticket", row));
    // 投诉单和信访单沿用同一处理信息页面，审批阶段均可查看智能核查。
    const hasInspectionProcessing = ["投诉单", "信访单"].includes(type) && ["会签中", "待审批", "审批中", "已办结"].includes(row[5]);
    const canProcess = ((policy.canSeeProcessing || customerServiceCompletedSample || hasInspectionProcessing) && !isReviewStatus) || rejectedCreationView;
    const tabs = rejectedCreationView ? ["基本信息", "处理信息", "流转记录", "历史工单", "关联工单"] : ["基本信息", ...(canProcess ? ["处理信息"] : []), "流转记录", "客户画像", ...(!customerServiceCompletedSample ? ["关联单据"] : [])];
    const basic = '<div class="detail-sections">' + renderTicketEntryDetailSections(row, policy.canProcess) + '</div>';
    const basicWithReview = basic + (reviewInBasic ? renderFullApprovalSection() : "");
    let content = basicWithReview;
    if (state.detailTab === "处理信息" && canProcess) content = renderProcessingWorkspace(row);
    if (state.detailTab === "流转记录") content = renderTransferRecordTable(row);
    if (["客户画像", "历史工单"].includes(state.detailTab)) content = renderCustomerProfile(row);
    if (["关联单据", "关联工单"].includes(state.detailTab)) {
      const repeatRelation = repeatRelationForTicket(row[0]);
      const queryRelation = queryTicketRows.find(item => item[0] === row[0])?.[8];
      const mainTicketId = repeatRelation?.mainTicket || (queryRelation && queryRelation !== "-" ? queryRelation : "");
      content = ["再次投诉单", "重复投诉单"].includes(ticketListKind(row)) && mainTicketId
        ? renderMainTicketOnlyRelatedWorkspace(mainTicketId, ticketRowById(mainTicketId), "该再次投诉单所关联的主工单")
        : renderRelatedWorkOrderWorkspace(row);
    }

    const backPage = state.warningContextId ? "analysis-warnings" : approval ? "my-approvals" : policy.entry === "process" ? "ticket-process" : "ticket-create";
    const approvalLabel = approval ? approvalStageLabel(approval.reviewMode ? "review" : approval.approvalStage) : "";
    const title = approval ? "工单" + approvalLabel : state.detailTab === "处理信息" ? "工单处理" : "工单详情";
    const subtitle = approval ? "查看待" + approvalLabel + "工单的完整内容并填写" + approvalLabel + "意见" : (state.detailTab === "处理信息" ? "填写" : "查看") + type + "的处理信息与流转记录";
    const tabsHtml = `<div class="panel detail-tabs"><div class="tabs lib-tabs-line">${tabs.map(t=>`<button class="tab ${state.detailTab===t?"is-active":""}" data-detail-tab="${t}">${t}</button>`).join("")}</div></div>`;
    const approvalTop = quickApproval ? renderQuickApprovalWorkbench(approvalRecord(), row) : "";
    const approvalBottom = reviewInBasic ? renderApprovalStickyFooter() : "";
    const headerActions = (state.role === "developer" ? `<button type="button" class="btn xib-btn xib-btn--secondary" data-action="ticket-field-inventory" data-id="${row[0]}">字段清单</button>` : "") +
      renderContextBackButton(backPage, state.warningContextId ? "智能预警" : approval ? "审批管理" : (policy.entry === "process" ? "工单处理" : "工单创建"));
    // 处理信息卡片的第二行补齐工单类型，取当前工单自身的类型。
    const processingSummary = canProcess ? `<div><span>处理员</span><strong>${escapeAttribute(ticketLastHandler(row))}</strong></div><div><span>工单接收机构</span><strong>${escapeAttribute(ticketReceivingInstitution(row))}</strong></div><div><span>工单接收部门</span><strong>${escapeAttribute(ticketReceivingDepartment(row))}</strong></div><div><span>工单类型</span><strong>${escapeAttribute(type || "-")}</strong></div>` : "";
    const complaintNotice = type === "投诉单" ? '<div class="detail-summary-alert">该客户一年内有重复投诉 10 笔、监管转办投诉 4 笔，请谨慎处理。</div>' : "";
    return `<section class="page ticket-detail-page ${approval ? "approval-detail-page" : ""}">${pageHeader(title, subtitle, headerActions)}${warningContextBanner}<div class="panel detail-summary ticket-detail-summary"><div><span>工单编号</span><strong>${row[0]}</strong></div><div><span>客户姓名</span><strong>${row[2]}</strong></div><div><span>当前状态</span>${statusTag(row[5])}</div><div><span>处置期限</span><strong>${deadlineText}</strong></div>${processingSummary}${complaintNotice}</div>${renderWorkflowRejection(policy)}${draftValidation}${approvalTop}${tabsHtml}${content}${approvalBottom}</section>`;
  }

  function subprocessDefinition(type = state.subprocessType) {
    return SUBPROCESS_DEFINITIONS.find(item => item.type === type) || SUBPROCESS_DEFINITIONS[0];
  }

  const HANDLER_REJECTABLE_SUBPROCESS_TYPES = new Set(["投诉调查", "剔除申请", "异常投诉", "异议核查"]);

  function canRejectSubprocessProcessing(row) {
    return HANDLER_REJECTABLE_SUBPROCESS_TYPES.has(row?.[1]) && ["待处理", "处理中"].includes(row?.[5]);
  }

  function subprocessApplicantName(row) {
    const record = documentRecordFor("subprocess", row);
    return listColumnValueText(record?.fields?.base?.["创建人"] || record?.fields?.entry?.["创建人"] || CURRENT_USER_ACTOR);
  }

  function subprocessSmsApprovalStatus(row) {
    if (!row || row[1] !== "\u5ef6\u957f\u7533\u8bf7" || row[5] !== "\u5f85\u8865\u5f55") return "";
    const ticket = ticketRowById(row[2]);
    const records = contactRecordsForTicket(ticket);
    const sms = records.find(record => isSmsContact(record));
    return smsApprovalStatusForRecord(sms) || "\u5f85\u5ba1\u6279";
  }

  function subprocessActions(row, options = {}) {
    const approvalMode = Boolean(options.approvalMode);
    const context = options.context || 'create';
    const status = row[5];
    const role = state.role;
    const accountabilityProcessor = row?.[1] === "投诉问责" && ["approver", "developer"].includes(role);
    const detail = actionDef('detail', '查看', 'subprocess-detail');
    if (approvalMode) {
      const stage = approvalStageFor("subprocess", row);
      if (stage === "initial" && ['reviewer','approver','analyst','developer'].includes(role) && ['待初审','初审中'].includes(status)) return [actionDef('initial', '初审', 'approve'), actionDef('transfer', '转派', 'transfer-approval'), detail];
      if (stage === "approval" && ['approver','developer'].includes(role) && ['待审批','审批中'].includes(status)) return [actionDef('approve', '审批', 'approve'), actionDef('transfer', '转派', 'transfer-approval'), detail];
      return [detail];
    }
    if (context === 'create') {
      if (!['operator','handler','developer'].includes(role)) return [detail];
      const rejectedToCreation = Boolean(latestCreationRejection("subprocess", row));
      const actions = status === '草稿' ? [actionDef('edit', '编辑', 'edit-subprocess'), actionDef('delete', '删除', 'delete-row', '', true)] : status === '待提交' ? (rejectedToCreation ? [detail, actionDef('edit', '编辑', 'edit-subprocess')] : [actionDef('edit', '编辑', 'edit-subprocess'), actionDef('void', '废止', 'void-row', '', true)]) : status === '已办结' ? [detail] : [actionDef('remind', '催办', 'remind', '批量催办'), ...(canWithdrawSubmission('subprocess', row) ? [actionDef('withdraw', '撤回', 'withdraw-submission')] : []), detail];
      return filterActionsByComplaintPermission(actions, 'subprocess-create', state.subprocessCreateTab || '全部', status);
    }
    if (context === 'process') {
      if (!['handler','developer'].includes(role) && !accountabilityProcessor) return [detail];
      let actions = [detail];
      if (state.subprocessScope === '机构工单池') {
        const transfer = transferReasonPolicy(status).allowed ? [actionDef('transfer', '转派', 'transfer-subprocess')] : [];
        actions = status === '待处理' ? [actionDef('process', '处理', 'process-subprocess'), ...transfer, detail] : [...transfer, detail];
      }
      else if (state.subprocessScope === '我的工作台' && ['待处理','处理中'].includes(status)) actions = [actionDef('process', '处理', 'process-subprocess'), actionDef('transfer', '转派', 'transfer-subprocess'), detail];
      else if (state.subprocessScope === '我的工作台' && status === '待补录' && ['operator','handler','developer'].includes(role)) actions = [actionDef('supplement', '补录', 'supplement-subprocess'), actionDef('transfer', '转派', 'transfer-subprocess'), detail];
      else if (state.subprocessScope === '下辖工单池') actions = [actionDef('remind', '催办', 'remind', '批量催办'), detail];
      return filterActionsByComplaintPermission(actions, 'subprocess-manage', state.subprocessScope, status);
    }
    if (context === 'query') {
      const queryActions = status === '草稿' ? [actionDef('export', '导出', 'export-row', '批量导出')] : [detail, actionDef('export', '导出', 'export-row', '批量导出')];
      return queryExportActionsWithDemoPermission(queryActions, 'ledger-query', '子流程导出', status, row, options.permissionDemoId);
    }
    return [detail];
  }

  function renderSubprocessTicketBasicLinks(row) {
    const ids = subprocessRelatedTicketIds(row);
    if (!ids.length) return "-";
    if (ids.length === 1) return `<button type="button" class="btn-link" data-action="open-ticket-basic" data-id="${ids[0]}">${ids[0]}</button>`;
    return `<button type="button" class="btn-link" data-action="subprocess-related-tickets" data-id="${row[0]}">${ids[0]}/...</button>`;
  }
  function renderSubprocessTable(rows, options = {}) {
    if (typeof options === 'boolean') options = { approvalMode: options };
    const context = options.context || 'process';
    const scope = options.scope || 'subprocesses';
    const timeSort = state.sorts[scope];
    const sortedRows = timeSort?.index === TICKET_TIME_SORT_INDEX
      ? rows.map(row => [...row]).sort((a, b) => (dispositionDeadline(a, "subprocess") || "9999").localeCompare(dispositionDeadline(b, "subprocess") || "9999") * (timeSort.direction === "asc" ? 1 : -1))
      : sortByTaskArrival(rows, 6, Boolean(options.draft));
    const pageRows = options.disablePagination ? sortedRows : paginateRows(sortedRows, scope, options.pageSize || 10);
    const resolver = options.actionResolver || (row => subprocessActions(row, options));
    const defs = collectOperationDefs(pageRows, resolver);
    const smsHead = options.includeSmsApproval ? '<th>短信审批状态</th>' : '';
    return renderBulkToolbar(scope, defs, collectBatchOperationDefs(pageRows, resolver)) + '<div class="table-wrap"><table class="table ds-table selectable-table deadline-aware-table subprocess-list-table ' + (options.tableClass || '') + '"><thead><tr>' + selectionHead(scope) + '<th>子流程单编号</th><th>子流程类型</th><th>关联工单编号</th><th>客户姓名</th><th>所属机构</th><th>子流程状态</th>' + smsHead + renderTicketTimeHead(scope) + renderOperationHeaders(defs) + '</tr></thead><tbody>' + pageRows.map(row => { const displayId = row[5] === '\u8349\u7a3f' ? '-' : row[0]; const smsStatus = subprocessSmsApprovalStatus(row); return '<tr>' + selectionCell(scope,row[0]) + '<td class="primary-cell">' + displayId + '</td><td>' + row[1] + '</td><td>' + renderSubprocessTicketBasicLinks(row) + '</td><td>' + row[3] + '</td><td>' + row[4] + '</td><td>' + statusTag(row[5]) + '</td>' + (options.includeSmsApproval ? '<td>' + (smsStatus ? statusTag(smsStatus) : '-') + '</td>' : '') + renderTicketTimeCell(row, "subprocess") + renderOperationCells(defs, resolver(row), row[0]) + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  function renderSubprocessSourceTable() {
    const rows = sortRowsForTable(ticketRowsWithAcceptanceChannel(ticketRows.filter(row => !["已办结", "已废止", "草稿"].includes(row[5]))), "subprocess-source");
    return `<div class="table-wrap"><table class="table ds-table"><thead><tr>${sortableHead("工单编号", "subprocess-source", 0)}${sortableHead("工单类型", "subprocess-source", 1)}${sortableHead("客户姓名", "subprocess-source", 2)}${sortableHead("受理渠道", "subprocess-source", 3)}${sortableHead("处理机构", "subprocess-source", 4)}${sortableHead("工单状态", "subprocess-source", 5)}<th></th></tr></thead><tbody>${rows.map(row => `<tr><td class="primary-cell">${row[0]}</td><td>${renderTicketTypeWithKind(row)}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${statusTag(row[5])}</td><td class="operation-cell"><span>操作</span><button type="button" class="btn-link" data-action="choose-subprocess" data-id="${row[0]}">发起</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  function rectificationRelatedTicketIds(row = null) {
    const key = "subprocess.溯源整改.关联工单编号";
    const selected = state.formValues[key];
    if (selected !== undefined) return normalizeRelatedTicketIds(selected);
    if (state.subprocessSourceTicket) return normalizeRelatedTicketIds(state.subprocessSourceTicket);
    const record = row ? documentRecordFor("rectification", row) : null;
    const stored = [record?.relatedTicketIds, record?.fields?.entry?.["关联工单编号"], record?.fields?.base?.["关联工单编号"]].map(normalizeRelatedTicketIds).find(candidate => candidate.length) || [];
    return stored.length ? stored : normalizeRelatedTicketIds(row?.[2]);
  }

  function renderRectificationRelatedTicketSummary(row) {
    const ids = rectificationRelatedTicketIds(row);
    if (!ids.length) return "-";
    if (ids.length === 1) return '<button type="button" class="btn-link" data-action="detail" data-id="' + escapeAttribute(ids[0]) + '">' + escapeAttribute(ids[0]) + '</button>';
    return '<button type="button" class="btn-link" data-action="rectification-related-tickets" data-id="' + escapeAttribute(row[0]) + '">' + escapeAttribute(ids[0]) + '/...</button>';
  }

  function renderRectificationRelatedTickets(row = null, options = {}) {
    const ids = rectificationRelatedTicketIds(row);
    if (!ids.length) return '<span class="rectification-related-placeholder">暂未选择关联工单</span>';
    const readOnly = Boolean(options.readOnly);
    const rows = ids.map(id => ticketRows.find(item => item[0] === id) || [id, "工单", "-", "-", "-", "-"]).map(item => {
      const displayItem = [...item];
      displayItem[3] = ticketAcceptanceChannel(item);
      return displayItem;
    });
    const operationHead = readOnly ? "" : '<th class="operation-column">操作</th>';
    const operationCell = item => readOnly ? "" : '<td class="operation-cell"><button type="button" class="btn-link is-danger" data-action="remove-rectification-related-ticket" data-id="' + escapeAttribute(item[0]) + '">删除</button></td>';
    return '<div class="table-wrap rectification-related-table-wrap"><table class="table ds-table rectification-related-table"><thead><tr><th>工单编号</th><th>工单类型</th><th>客户姓名</th><th>受理渠道</th><th>当前机构</th><th>工单状态</th>' + operationHead + '</tr></thead><tbody>' +
      rows.map(item => '<tr data-rectification-related-row="' + escapeAttribute(item[0]) + '"><td class="primary-cell"><button type="button" class="btn-link rectification-related-ticket-link" data-action="open-rectification-related-ticket" data-id="' + escapeAttribute(item[0]) + '">' + escapeAttribute(item[0]) + '</button></td><td>' + renderTicketTypeWithKind(item) + '</td><td>' + escapeAttribute(item[2]) + '</td><td>' + escapeAttribute(item[3]) + '</td><td>' + escapeAttribute(item[4]) + '</td><td>' + (item[5] === "-" ? "-" : statusTag(item[5])) + '</td>' + operationCell(item) + '</tr>').join("") +
      '</tbody></table></div>';
  }
  function renderSubprocessRelatedSelection() {
    const rows = subprocessSourceTicketRows();
    if (!rows.length) return "";
    return '<div class="table-wrap subprocess-related-table-wrap"><table class="table ds-table subprocess-related-table"><thead><tr><th>工单编号</th><th>工单类型</th><th>客户姓名</th><th>受理渠道</th><th>当前机构</th><th>工单状态</th><th class="operation-column">操作</th></tr></thead><tbody>' +
      rows.map(item => '<tr data-subprocess-related-row="' + item[0] + '"><td class="primary-cell">' + item[0] + '</td><td>' + renderTicketTypeWithKind(item) + '</td><td>' + item[2] + '</td><td>' + ticketAcceptanceChannel(item) + '</td><td>' + item[4] + '</td><td>' + statusTag(item[5]) + '</td><td class="operation-cell"><button type="button" class="btn-link is-danger" data-action="remove-subprocess-related-ticket" data-id="' + item[0] + '">删除</button></td></tr>').join("") +
      '</tbody></table></div>';
  }

  function renderSubprocessCreate() {
    const filters = renderGroupedFilters([
      ["子流程类型", "子流程单状态", "处置期限"],
      ["子流程单编号", "关联工单编号"]
    ], "subprocess-create-filter-panel");
    const allRows = filterRowsByComplaintPermission(subprocessRows.filter(row => !["已办结", "已废止"].includes(row[5])), "subprocess-create", "全部");
    const draftRows = filterRowsByComplaintPermission(allRows.filter(row => row[5] === "草稿"), "subprocess-create", "草稿箱");
    const rows = state.subprocessCreateTab === "草稿箱" ? draftRows : allRows;
    const tabs = availableComplaintTabs("subprocess-create", [["全部", allRows.length], ["草稿箱", draftRows.length]]);
    if (!tabs.some(([tab]) => tab === state.subprocessCreateTab)) state.subprocessCreateTab = tabs[0]?.[0] || "全部";
    const tabHtml = '<div class="panel"><div class="tabs lib-tabs-line">' + tabs.map(([tab,count]) => '<button class="tab ' + (state.subprocessCreateTab === tab ? "is-active" : "") + '" data-subprocess-create-tab="' + tab + '">' + tab + '<span class="count">' + count + '</span></button>').join("") + '</div></div>';
    const results = renderSubprocessTable(rows, { context: "create", scope: "subprocess-create", draft: state.subprocessCreateTab === "草稿箱" });
    return '<section class="page">' + pageHeader("子单创建", "发起并跟踪本人提交的子单", '<button class="btn xib-btn xib-btn--primary btn-primary" data-page="subprocess-form">' + icon("plus") + ' 新建子单</button>') + tabHtml + filters + '<div class="panel">' + results + renderPagination(rows.length, "subprocess-create") + '</div></section>';
  }

  function renderExportRequests() {
    return '<section class="page">' + pageHeader("导出申请", "查看本人在查询导出中发起的导出申请") +
      renderExportRequestFilters("query") +
      '<div class="panel">' + renderExportRequestTable() + renderPagination(exportRequestRows.length, "export-requests") + '</div></section>';
  }
  function subprocessDifferenceSections(definition, phase = "all") {
    if (!definition) return [];
    const sections = SUBPROCESS_FIELD_SECTIONS[definition.type] || [];
    const processTitles = SUBPROCESS_PROCESS_SECTION_TITLES[definition.type] || [];
    if (phase === "create") return sections.filter(section => !processTitles.includes(section.title));
    if (phase === "process") return sections.filter(section => processTitles.includes(section.title));
    return sections;
  }

  function subprocessHasProcessingStage(definitionOrType, row = null) {
    const type = typeof definitionOrType === "string" ? definitionOrType : definitionOrType?.type;
    if (type === "投诉问责") return complaintAccountabilityTriggerMode(row) === "系统自动触发" || isManualAccountabilityDraft(row);
    if (type === "异常投诉") return true;
    return Boolean(type && (SUBPROCESS_PROCESS_SECTION_TITLES[type] || []).length);
  }

  function renderSubprocessDifference(definition) {
    if (!definition) return "";
    if (definition.type === "异议核查") subprocessInvestigationAssignmentDefaults(subprocessSourceTicketRow());
    const scope = "subprocess." + definition.type;
    return subprocessDifferenceSections(definition, "create").map((section,index) => '<section class="form-section subprocess-difference-section" id="section-subprocess-difference-' + (index + 1) + '"><div class="form-section-head">' + section.title + '</div><div class="form-section-body"><div class="form-grid">' + section.fields.map(field => {
      if (definition.type !== "异议核查") return renderField(field, scope);
      if (field.name === "接收部门") return renderField({ ...field, type: "institutionDepartment", sourceKey: scope + ".接收机构", emptyForSubbranch: true }, scope);
      if (field.name === "处置员") {
        const institution = state.formValues[scope + "接收机构"] || "";
        const options = subprocessHandlersForInstitution(institution);
        const current = state.formValues[scope + "处置员"] || "";
        return renderField({ ...field, options: options.includes(current) || !current ? options : [current, ...options] }, scope);
      }
      return renderField(field, scope);
    }).join("") + '</div></div></section>').join("");
  }

  function renderSubprocessTypeBaseFields(definition, sourceRow) {
    if (!definition) return "";
    const scope = "subprocess-base." + definition.type;
    const defaults = subprocessTypeBaseValues(definition.type, sourceRow?.[0] || state.subprocessSourceTicket, state.formValues["子流程-申请时间"] || systemTimestamp());
    const fields = SUBPROCESS_BASE_FIELD_RULES.type_fields?.[definition.type] || [];
    fields.forEach(field => {
      const key = scope + "." + field.name;
      if (state.formValues[key] === undefined) state.formValues[key] = defaults[field.name] || "";
    });
    return fields.map(field => renderField(field.editable === false ? { ...field, type:"readonly" } : field, scope)).join("");
  }

  function populateAccountabilityDefaultsFromRelatedTicket(definition, sourceRow) {
    if (definition?.type !== "投诉问责" || !sourceRow) return;
    const scope = "subprocess.投诉问责.";
    const initializedKey = scope + "__responsibilityDefaultsFor";
    if (state.formValues[initializedKey] === sourceRow[0]) return;
    const processing = documentRecordFor("ticket", sourceRow)?.fields?.processing || {};
    const legacyOwnership = String(processing["责任机构/部门"] || "").split("/").map(value => value.trim()).filter(Boolean);
    const legacyOwner = legacyOwnership[0] || "";
    const institution = processing["责任机构"] || (legacyOwner ? legacyOwner + " / " + legacyOwner : "");
    const department = processing["责任部门"] || legacyOwnership[1] || "";
    const person = String(processing["责任人"] || "").trim();
    state.formValues[scope + "问责机构"] = institution;
    state.formValues[scope + "问责部门"] = department;
    state.formValues[scope + "问责对象"] = person;
    state.formValues[initializedKey] = sourceRow[0];
  }

  function renderSubprocessForm() {
    const definitions = SUBPROCESS_DEFINITIONS.filter(item => !["溯源整改", "督导函"].includes(item.type));
    const sourceRow = subprocessSourceTicketRow();
    if (state.subprocessType && !subprocessInitiationAvailability(subprocessDefinition(state.subprocessType), subprocessSourceTicketRows()).enabled) state.subprocessType = "";
    const definition = state.subprocessType ? subprocessDefinition(state.subprocessType) : null;
    populateCorrectionFieldsFromRelatedTicket();
    populateAccountabilityDefaultsFromRelatedTicket(definition, sourceRow);
    const sections = definition ? subprocessDifferenceSections(definition, "create") : [];
    const withdrawalCopyRecipient = definition?.type === "撤销投诉" && sourceRow?.[0]
      ? (COMPLAINT_WORK_POOL.assignment("ticket", sourceRow[0]).assignee || COMPLAINT_WORK_POOL.identity("handler").actor)
      : "";
    const isSecondExtension = definition?.type === "延长申请" && sourceRow?.[0]
      ? extensionRequiresInitialApproval(sourceRow[0], state.subprocessEditingId || "")
      : false;
    const extensionCopyRecipient = definition?.type === "延长申请" && sourceRow?.[0] && !isSecondExtension
      ? "审批员（总行消保部主管）"
      : "";
    const copyRecipient = withdrawalCopyRecipient || extensionCopyRecipient;
    const anchors = [{ id:"subprocess-basic", title:"基础信息" }]
      .concat(sections.map((section,index) => ({ id:"subprocess-difference-" + (index + 1), title:section.title })))
      .concat(copyRecipient ? [{ id:"subprocess-copy", title:"抄送信息" }] : []);
    const demoAction = state.role === "developer" ? '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="demo-fill-subprocess" ' + (!definition ? 'disabled' : '') + '>' + icon("edit") + ' 一键填写 Demo</button>' : "";
    const typeButtons = definitions.map(item => {
      const availability = subprocessInitiationAvailability(item, subprocessSourceTicketRows());
      const active = state.subprocessType === item.type;
      const button = '<button type="button" class="' + (active ? "is-active " : "") + (!availability.enabled ? "is-disabled" : "") + '" data-subprocess-type="' + item.type + '" ' + (!availability.enabled ? 'disabled' : '') + '><strong>' + item.type + '</strong><span>' + item.document + '</span><em>' + (availability.enabled ? "可发起" : "当前不可发起") + '</em></button>';
      const info = availability.enabled ? "" : '<button type="button" class="disabled-reason-trigger subprocess-type-info" data-tooltip="' + escapeAttribute(availability.reason) + '" aria-label="查看' + item.type + '不可发起原因">' + icon("info") + '</button>';
      return '<div class="subprocess-type-option">' + button + info + '</div>';
    }).join("");
    const selectedSummary = sourceRow
      ? '<div class="subprocess-source-summary"><div><span>关联工单</span><strong>' + sourceRow[0] + '</strong></div><div><span>工单类型</span><strong>' + sourceRow[1] + '</strong></div><div><span>当前状态</span><strong>' + sourceRow[5] + '</strong></div><div><span>当前机构</span><strong>' + sourceRow[4] + '</strong></div></div>'
      : '<div class="subprocess-source-summary is-empty">请先查询并关联工单。完成基础信息后，系统将根据工单类型、状态、机构和角色开放可发起的子流程。</div>';
    const baseTypeFields = renderSubprocessTypeBaseFields(definition, sourceRow);
    const deadlineValue = definition ? subprocessDeadlineValue(definition.type, state.formValues["子流程-申请时间"] || systemTimestamp(), sourceRow?.[0] || state.subprocessSourceTicket) : "-";
    const difference = definition
      ? renderSubprocessDifference(definition)
      : '<section class="form-section subprocess-locked-section"><div class="subprocess-locked-content"><strong>差异字段尚未加载</strong><span>关联工单并选择可发起的子流程类型后显示。</span></div></section>';
    const copySection = copyRecipient
      ? '<section class="form-section subprocess-copy-section" id="section-subprocess-copy"><div class="form-section-head">抄送信息</div><div class="form-section-body"><div class="form-grid"><div class="form-item span-2"><label class="form-label">抄送人</label><div class="form-control"><input class="di-input is-fluid" value="' + escapeAttribute(copyRecipient) + '" disabled></div></div></div></div></section>'
      : '';
    const relatedEventHtml = state.subprocessQuickSource
      ? '<div class="form-item span-2"><label class="form-label required">关联工单编号</label><div class="form-control"><input class="di-input is-fluid" name="related-event" value="' + state.subprocessQuickSource + '" readonly><small class="field-help">工单详情内快速发起，关联工单固定为当前工单，不可修改</small></div></div>'
      : '<div class="form-item span-2"><label class="form-label required">关联工单编号</label><div class="form-control"><div class="subprocess-related-trigger"><input type="hidden" name="related-event" value="' + subprocessSourceTicketRows().map(row => row[0]).join("、") + '"><button type="button" class="btn xib-btn xib-btn--secondary subprocess-related-search" data-action="search-related-ticket">查询并选择工单</button></div><div class="subprocess-related-list">' + renderSubprocessRelatedSelection() + '</div></div></div>';
    const editingRow = state.subprocessEditingId ? workflowRow("subprocess", state.subprocessEditingId) : null;
    return '<section class="page subprocess-form-page" style="padding-bottom:0">' + pageHeader(editingRow ? "编辑子单" : "新建子单", "先关联工单，再按工单状态与角色权限填写差异字段", renderContextBackButton("subprocess-create", "子单创建")) + renderCreationRejection("subprocess", editingRow) +
      '<div class="form-layout subprocess-form-layout"><form id="subprocess-form-main"><section class="form-section" id="section-subprocess-basic"><div class="form-section-head">基础信息</div><div class="form-section-body"><div class="form-grid">' +
        '<div class="form-item"><label class="form-label required">创建人</label><div class="form-control"><input class="di-input is-fluid" value="陈敏慧-60157" disabled></div></div>' +
        '<div class="form-item"><label class="form-label required">所属机构</label><div class="form-control"><input class="di-input is-fluid" value="' + currentRoleProfile().institutionLabel + '" disabled></div></div>' +
        '<div class="form-item"><label class="form-label required">所属部门</label><div class="form-control"><input class="di-input is-fluid" value="' + (currentRoleProfile().departmentLabel || "-") + '" disabled></div></div>' +
        '<div class="form-item"><label class="form-label required">子流程单编号</label><div class="form-control"><input class="di-input is-fluid" value="提交后系统生成" disabled></div></div>' +
        relatedEventHtml +
        '<div class="form-item"><label class="form-label required">申请时间</label><div class="form-control"><input class="di-input is-fluid" value="' + (state.formValues["子流程-申请时间"] || "提交后系统自动生成") + '" disabled></div></div>' +
        '<div class="form-item"><label class="form-label">处置期限</label><div class="form-control"><input class="di-input is-fluid" value="' + deadlineValue + '" disabled></div></div>' + baseTypeFields +
      '</div>' + selectedSummary + '</div></section>' +
      '<section class="panel subprocess-type-panel"><div class="form-section-head">选择子流程类型<small>灰色类型表示当前工单或角色规则不允许发起</small></div><div class="subprocess-type-grid">' + typeButtons + '</div></section>' + difference + copySection + '</form>' +
      '<aside class="form-anchor"><div class="anchor-title">填写导航</div><nav class="lib-anchor" aria-label="子流程填写导航">' + anchors.map((section,index) => '<a class="anchor-link ' + (index===0?'is-active':'') + '" href="#section-' + section.id + '" data-anchor="' + section.id + '">' + section.title + '</a>').join("") + '</nav></aside></div>' +
      '<div class="sticky-actions"><span style="margin-right:auto;color:var(--muted);font-size:12px">当前单据：' + (definition ? definition.document : '尚未选择') + '</span><div class="sticky-action-buttons">' + demoAction + '<button class="btn xib-btn xib-btn--secondary" data-action="save-subprocess-draft" ' + (!definition ? 'disabled' : '') + '>保存草稿</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="submit-subprocess" ' + (!definition ? 'disabled' : '') + '>提交' + (definition ? definition.document : '子流程申请') + '</button></div></div></section>';
  }
  function hydrateSubprocessFormForEdit(row) {
    if (!row) return;
    const document = state.documentData.subprocesses?.[row[0]];
    const base = document?.fields?.base || {};
    const entry = document?.fields?.entry || {};
    state.subprocessEditingId = row[0];
    state.subprocessType = row[1];
    state.subprocessSourceTicket = row[2] || "";
    state.subprocessSourceTickets = Array.isArray(document?.relatedTicketIds) && document.relatedTicketIds.length ? [...document.relatedTicketIds] : [row[2]].filter(Boolean);
    state.formValues["子流程-申请时间"] = base["申请时间"] || row[6] || "";
    Object.entries(base).forEach(([key, value]) => {
      if (!["创建人", "所属机构", "所属部门", "子流程单编号", "关联工单编号", "申请时间"].includes(key)) state.formValues["subprocess-base." + row[1] + "." + key] = value;
    });
    Object.entries(entry).forEach(([key, value]) => { state.formValues["subprocess." + row[1] + "." + key] = value; });
    if (row[1] === "投诉校正") {
      state.correctionOriginalValues = {};
      Object.entries(document?.fields?.correctionOriginalValues || entry).forEach(([key, value]) => { state.correctionOriginalValues["subprocess.投诉校正." + key] = deepClone(value); });
      state.formValues["subprocess.投诉校正.__prefilledFor"] = row[2] || "";
    }
  }

  function renderSubprocessManage() {
    const pool = COMPLAINT_WORK_POOL.model(subprocessRows, { task: "subprocess-process", view: complaintPoolView(state.subprocessScope), tab: state.subprocessTab === "待办" ? "todo" : "all" });
    const tabRows = filterRowsByComplaintPermission(pool.rows, "subprocess-manage", state.subprocessScope);
    const displayCounts = pool.counts;
    const isMyWorkbench = state.subprocessScope === "我的工作台";
    const tabsHtml = isMyWorkbench ? '<div class="panel subprocess-tabs-panel" style="margin-bottom:0"><div class="tabs lib-tabs-line">' + '<button class="tab ' + (state.subprocessTab === "待办" ? "is-active" : "") + '" data-subprocess-tab="待办">待办<span class="count">' + displayCounts.todo + '</span></button>' + '<button class="tab ' + (state.subprocessTab === "全部" ? "is-active" : "") + '" data-subprocess-tab="全部">全部<span class="count">' + displayCounts.workbench + '</span></button>' + '</div></div>' : "";
    const scopes = [["我的工作台", displayCounts.workbench, "当前处理员经手过且尚未办结的子单"], ["机构工单池", displayCounts.org, "本机构范围内未办结的子单"], ["下辖工单池", displayCounts.subOrg, "下辖机构全部未办结子单"]];
    const filters = renderGroupedFilters([
      ["子流程类型", "子流程单状态", "处置期限"],
      ["子流程单编号", "关联工单编号"],
      [{ label:"子流程单创建人", type:"input" }, { label:"所属机构", type:"orgTree", key:"filter.subprocess-process.institution" }, { label:"所属部门", type:"orgTree", key:"filter.subprocess-process.department" }]
    ], "subprocess-process-filter-panel");
    return '<section class="page">' + pageHeader("子单处理", "领取、处理和转派流转至当前机构的子单") + '<div class="scope-grid">' + scopes.map(([label,count,desc]) => '<button class="scope-card ds-card app-card ' + (state.subprocessScope === label ? "is-active" : "") + '" data-subprocess-scope="' + label + '"><b>' + count + '</b><strong>' + label + '</strong><span>' + desc + '</span></button>').join("") + '</div>' + tabsHtml + filters + '<div class="panel">' + renderSubprocessTable(tabRows, { context: "process", scope: "subprocess-process", includeSmsApproval: true }) + renderPagination(tabRows.length, "subprocess-process") + '</div></section>';
  }

  const COMPLAINT_EXCLUSION_RULES = Object.freeze([
    Object.freeze({ key: "重复投诉", title: "一个自然年内，同一客户、同投诉产品标签中类" }),
    Object.freeze({ key: "再次投诉", title: "重复投诉的子集，且是否再次投诉为是" }),
    Object.freeze({ key: "异常投诉", title: "关联异常投诉子流程，且异常认定结果为认定成功" }),
    Object.freeze({ key: "废止投诉", title: "工单状态为已废止" })
  ]);

  function complaintMiddleCategory(row) {
    const value = documentRecordFor("ticket", row)?.fields?.entry?.["投诉产品标签"];
    if (Array.isArray(value)) return String(value[1] || "").trim();
    return String(value || "").split(/\s*[/>、]\s*/)[1]?.trim() || "";
  }

  function ticketCreatedAt(row) {
    const value = documentRecordFor("ticket", row)?.fields?.entry?.["建单时间"] || row?.[6];
    return parsePrototypeDate(value);
  }

  function withinOneNaturalYear(first, second) {
    if (!first || !second) return false;
    const earlier = first <= second ? first : second;
    const later = first <= second ? second : first;
    const anniversary = new Date(earlier.getTime());
    anniversary.setFullYear(anniversary.getFullYear() + 1);
    return later <= anniversary;
  }

  function repeatComplaintCustomerKey(row) {
    const document = documentRecordFor("ticket", row);
    const customerId = CUSTOMER_REPOSITORY.canonicalId(CUSTOMER_REPOSITORY.customerIdFromTicket(row, document));
    return customerId ? "id:" + customerId : "name:" + String(row?.[2] || "").trim();
  }

  function isRepeatComplaint(row, rows) {
    if (row?.[1] !== "投诉单") return false;
    const customerKey = repeatComplaintCustomerKey(row);
    const category = complaintMiddleCategory(row);
    const createdAt = ticketCreatedAt(row);
    if (!customerKey || customerKey === "name:" || !category || !createdAt) return false;
    return rows.some(candidate => candidate[0] !== row[0] && candidate[1] === "投诉单" && repeatComplaintCustomerKey(candidate) === customerKey && complaintMiddleCategory(candidate) === category && withinOneNaturalYear(createdAt, ticketCreatedAt(candidate)));
  }

  function isAgainComplaint(row, rows) {
    return isRepeatComplaint(row, rows) && String(documentRecordFor("ticket", row)?.fields?.processing?.["是否再次投诉"] || "") === "是";
  }

  function isAbnormalComplaint(row) {
    return subprocessRows.some(subprocess => subprocess[1] === "异常投诉" && subprocessRelatedTicketIds(subprocess).includes(row[0]) && subprocessConclusionDetails({ id: subprocess[0], type: subprocess[1], row: subprocess }).value === "认定成功");
  }

  function isBlackGrayComplaint(row) {
    return String(documentRecordFor("ticket", row)?.fields?.processing?.["是否黑灰产投诉"] || "") === "是";
  }

  function complaintExclusionMatch(row, key, rows) {
    if (key === "重复投诉") return isRepeatComplaint(row, rows);
    if (key === "再次投诉") return isAgainComplaint(row, rows);
    if (key === "异常投诉") return isAbnormalComplaint(row);
    if (key === "废止投诉") return row[5] === "已废止";
    return false;
  }

  function complaintExclusionFlags(ticketId) {
    const rows = queryTicketRows.filter(row => row[5] !== "草稿");
    const row = rows.find(item => item[0] === ticketId);
    return row ? COMPLAINT_EXCLUSION_RULES.map(option => option.key).filter(key => complaintExclusionMatch(row, key, rows)) : [];
  }

  function queryTicketExportRows() {
    const rows = queryTicketRows.filter(row => row[5] !== "草稿");
    const selected = state.queryComplaintQuickFilters || [];
    return selected.length ? rows.filter(row => !selected.some(key => complaintExclusionMatch(row, key, rows))) : rows;
  }

  function renderQueryTicketTable() {
    const scope = 'query-tickets';
    const businessLineIndex = 9;
    const exportRows = queryTicketExportRows();
    const sourceRows = ticketRowsWithAcceptanceChannel(exportRows).map(row => { const next = [...row]; next[businessLineIndex] = ticketBusinessLine(row); return next; });
    const timeSort = state.sorts[scope];
    const rows = timeSort?.index === TICKET_TIME_SORT_INDEX
      ? sourceRows.map(row => [...row]).sort((left, right) => (dispositionDeadline(left, "ticket", { actualOnly:true }) || "9999").localeCompare(dispositionDeadline(right, "ticket", { actualOnly:true }) || "9999") * (timeSort.direction === "asc" ? 1 : -1))
      : sortRowsForTable(sourceRows, scope);
    const pageRows = paginateRows(rows, scope, 50);
    const resolver = row => filterActionsByComplaintPermission([actionDef('detail', '查看', 'detail'), actionDef('export', '导出', 'export-row', '批量导出')], 'ledger-query', '工单导出', row[5]);
    const defs = collectOperationDefs(pageRows, resolver);
    return renderBulkToolbar(scope, defs, collectBatchOperationDefs(pageRows, resolver)) + '<div class="table-wrap"><table class="table ds-table selectable-table query-ticket-export-table"><thead><tr>' + selectionHead(scope) + sortableHead('工单编号', scope, 0) + sortableHead('工单类型', scope, 1) + sortableHead('客户姓名', scope, 2) + sortableHead('受理渠道', scope, 3) + sortableHead('所属业务条线', scope, businessLineIndex) + sortableHead('工单状态', scope, 5) + renderTicketTimeHead(scope) + renderOperationHeaders(defs) + '</tr></thead><tbody>' + pageRows.map(row => '<tr>' + selectionCell(scope,row[0]) + '<td class="primary-cell">' + row[0] + '</td><td>' + renderTicketTypeWithKind(row, { exportComplaint:true }) + '</td><td>' + row[2] + '</td><td>' + row[3] + '</td><td>' + row[businessLineIndex] + '</td><td>' + statusTag(row[5]) + '</td>' + renderTicketTimeCell(row, "ticket", row[5], { actualOnly:true }) + renderOperationCells(defs, resolver(row), row[0]) + '</tr>').join('') + '</tbody></table></div>';
  }

  function exportRequestActions(row) {
    const status = row[5];
    if (row[15] === "已废止") return [actionDef("detail", "查看", "export-request-detail")];
    let actions = [actionDef("detail", "查看", "export-request-detail")];
    if (["待提交", "已驳回"].includes(status)) actions = [actionDef("edit", "编辑", "edit-export-request"), actionDef("void", "废止", "void-export-request", "", true)];
    else if (status === "待审批") actions = [actionDef("remind", "催办", "remind"), actionDef("withdraw", "撤回", "withdraw-export-request"), actionDef("detail", "查看", "export-request-detail")];
    else if (status === "审批中") actions = [actionDef("remind", "催办", "remind"), actionDef("detail", "查看", "export-request-detail")];
    else if (status === "已通过") actions = [
      actionDef("detail", "查看", "export-request-detail"),
      actionDef("download", "下载", "download-export", "", false, !exportRequestDownloadAvailable(row), "导出文件仅保留审批通过后 7×24 小时"),
      ...(!exportRequestDownloadAvailable(row) ? [actionDef("edit", "编辑", "edit-export-request", "", false, false, "编辑导出申请")] : [])
    ];
    return filterActionsByComplaintPermission(actions, "ledger-query", "导出申请", status);
  }

  const EXPORT_REQUEST_DOWNLOAD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

  function formatPrototypeDateTime(value) {
    const parts = new Intl.DateTimeFormat("zh-CN", { timeZone:"Asia/Shanghai", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).formatToParts(value);
    const item = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${item.year}-${item.month}-${item.day} ${item.hour}:${item.minute}:${item.second}`;
  }

  function exportRequestDownloadAvailable(row, now = new Date()) {
    if (!row || row[5] !== "已通过" || row[15] === "已废止") return false;
    const approvedAt = parsePrototypeDate(row[19]);
    const expiresAt = parsePrototypeDate(row[20]);
    if (!approvedAt || !expiresAt) return false;
    return now.getTime() >= approvedAt.getTime() && now.getTime() <= expiresAt.getTime();
  }

  function exportRequestExpired(row, now = new Date()) {
    const expiresAt = parsePrototypeDate(row?.[20]);
    return Boolean(expiresAt && expiresAt.getTime() < now.getTime());
  }

  function renderExportRequestTable() {
    const scope = "export-requests";
    const permittedExportRequestRows = filterRowsByComplaintPermission(exportRequestRows, "ledger-query", "导出申请");
    const rows = sortRowsForTable(permittedExportRequestRows, scope);
    const pageRows = paginateRows(rows, scope, 10);
    const resolver = row => exportRequestActions(row);
    const defs = collectOperationDefs(rows, resolver, { viewBeforeDownload:true });
    return renderBulkToolbar(scope, defs, collectBatchOperationDefs(pageRows, resolver)) + '<div class="table-wrap"><table class="table ds-table selectable-table export-request-table"><thead><tr>' + selectionHead(scope) + sortableHead("导出申请编号", scope, 0) + sortableHead("导出类型", scope, 1) + sortableHead("导出申请状态", scope, 5) + sortableHead("申请时间", scope, 7) + sortableHead("过期时间", scope, 20) + renderOperationHeaders(defs) + '</tr></thead><tbody>' + pageRows.map(row => { const status = row[15] === "已废止" ? "已废止" : row[5]; const expiryClass = exportRequestExpired(row) ? " is-expired" : ""; return '<tr' + exportRequestFilterAttributes(row) + '>' + selectionCell(scope, row[0]) + '<td class="primary-cell">' + (row[0] || '-') + '</td><td>' + escapeAttribute(normalizeExportRequestType(row[1]) || '-') + '</td><td>' + statusTag(status) + '</td><td class="export-request-applied-at">' + escapeAttribute(row[7] || '-') + '</td><td class="export-request-expires-at' + expiryClass + '">' + escapeAttribute(row[20] || '-') + '</td>' + renderOperationCells(defs, resolver(row), row[0]) + '</tr>'; }).join("") + '</tbody></table></div>';
  }

  function exportRequestFilterAttributes(row) {
    const values = {
      "data-export-request":"true",
      "data-export-type":normalizeExportRequestType(row?.[1]),
      "data-export-status":row?.[15] === "已废止" ? "已废止" : row?.[5],
      "data-export-applied-at":row?.[7],
      "data-export-related-ticket":row?.[8],
      "data-export-applicant":row?.[3],
      "data-export-institution":row?.[4],
      "data-export-department":row?.[16]
    };
    return Object.entries(values).map(([name,value]) => ' ' + name + '="' + escapeAttribute(value || "") + '"').join("");
  }

  function renderExportRequestFilters(mode = "query") {
    const isApproval = mode === "approval";
    const timeField = { label:"申请时间", type:"range" };
    const prefix = isApproval ? "filter.approval.export-request" : "filter.export-request";
    const rows = [
      [{ label:"导出类型", type:"select", options:[...EXPORT_REQUEST_TYPES] }, { label:"导出申请状态", type:"select", options:[...EXPORT_REQUEST_STATUSES] }, timeField],
      [{ label:"导出申请人", type:"input" }, { label:"所属机构", type:"orgTree", key:prefix + ".institution" }, { label:"所属部门", type:"orgTree", key:prefix + ".department" }],
      [{ label:"导出申请编号", type:"input" }, { label:"关联工单编号", type:"input" }]
    ];
    const classes = [isApproval ? "is-approval-business-row" : "is-primary-row", isApproval ? "is-approval-ownership-row" : "is-ownership-row", isApproval ? "is-approval-detail-row" : "is-customer-row"];
    const body = rows.map((fields,index) => renderExportFilterRow(fields, classes[index])).join("");
    return '<div class="filter-panel ticket-filter-panel export-filter-panel ' + (isApproval ? 'approval-filter-panel ' : '') + 'export-request-filter-panel"><div class="export-filter-layout">' + body + '<div class="filter-actions export-filter-actions"><button class="btn-link filter-reset" data-action="reset-filter">' + icon("reset") + ' 重置</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="search">' + icon("search") + ' 搜索</button></div></div></div>';
  }

  function exportRequestRelatedDocuments(row) {
    return [row[8] && "工单：" + row[8], row[9] && "子单：" + row[9], row[21] && "整改单：" + row[21]].filter(Boolean).join("；") || "-";
  }

  function exportRequestReason(row) {
    return row[12] || "用于投诉处理复盘和监管报送材料准备。";
  }

  function exportLedgerRows() {
    return exportRequestRows.filter(row => row[5] === "已通过" || row[15] === "已下载" || row[6] === "直接导出" || /导出失败|生成失败|^失败$/.test(row[15] || "")).map(row => [
      row[7] || "-",
      row[3] || "-",
      row[4] || "-",
      row[13] || "-",
      row[14] || "-",
      row[2] || "-",
      row[10] || "-",
      /导出失败|生成失败|^失败$/.test(row[15] || "") ? "失败" : "成功",
      row[0],
      row[1] === "溯源整改单" ? "整改单" : row[1] || "-",
      exportRequestRelatedDocuments(row),
      exportRequestReason(row)
    ]);
  }

  function renderExportLedgerTable() {
    const scope = "export-ledger";
    const rows = sortRowsForTable(exportLedgerRows(), scope);
    const pageRows = paginateRows(rows, scope, 10);
    const resolver = row => [actionDef("detail", "查看", "export-request-detail"), ...(row[7] === "成功" ? [actionDef("download", "下载", "download-export")] : [])];
    const defs = collectOperationDefs(rows, resolver, { viewBeforeDownload:true });
    return renderBulkToolbar(scope, defs, collectBatchOperationDefs(pageRows, resolver)) + '<div class="table-wrap"><table class="table ds-table selectable-table export-ledger-table"><thead><tr>' + selectionHead(scope) + sortableHead("导出申请编号", scope, 8) + sortableHead("导出时间", scope, 0) + sortableHead("导出类型", scope, 9) + sortableHead("申请人", scope, 1) + sortableHead("申请人所属机构", scope, 2) + sortableHead("审批人", scope, 3) + sortableHead("审批人所属机构", scope, 4) + sortableHead("导出数据量", scope, 5) + sortableHead("关联业务单", scope, 10) + sortableHead("脱敏情况", scope, 6) + sortableHead("申请原因", scope, 11) + sortableHead("导出状态", scope, 7) + renderOperationHeaders(defs) + '</tr></thead><tbody>' + pageRows.map(row => { const reason = Array.from(row[11]); const shownReason = reason.length > 15 ? reason.slice(0, 15).join("") + "..." : row[11]; return '<tr>' + selectionCell(scope, row[8]) + '<td class="primary-cell">' + escapeAttribute(row[8]) + '</td><td>' + escapeAttribute(row[0]) + '</td><td>' + escapeAttribute(row[9]) + '</td><td>' + escapeAttribute(row[1]) + '</td><td>' + escapeAttribute(row[2]) + '</td><td>' + escapeAttribute(row[3]) + '</td><td>' + escapeAttribute(row[4]) + '</td><td>' + escapeAttribute(row[5]) + '</td><td>' + escapeAttribute(row[10]) + '</td><td>' + escapeAttribute(row[6]) + '</td><td title="' + escapeAttribute(row[11]) + '">' + escapeAttribute(shownReason) + '</td><td>' + statusTag(row[7]) + '</td>' + renderOperationCells(defs, resolver(row), row[8]) + '</tr>'; }).join("") + '</tbody></table></div>';
  }

  const SUBPROCESS_EXPORT_FILTER_FIELDS = {
    "投诉调查": [
      { label: "是否修正", type: "select", options: ["是", "否"] },
      { label: "处理机构", type: "orgTree", key: "filter.subprocess-handle.org" }
    ],
    "投诉问责": [
      { label: "是否问责", type: "select", options: ["是", "否"] },
      { label: "问责机构", type: "orgTree", key: "filter.subprocess-accountability.org" }
    ],
    "纠纷化解": [
      { label: "化解方式", type: "select", options: ["诉讼", "仲裁", "和解", "调解"] },
      { label: "调解来源", type: "select", options: ["诉求人主动申请", "银行发起申请", "信访转调解"] },
      { label: "调解成功", type: "select", options: ["是", "否"] },
      { label: "调处方式", type: "select", options: ["线上调解", "现场调解"] }
    ],
    "异常投诉": [
      { label: "客户姓名", type: "input" },
      { label: "异常投诉类型", type: "select", options: ["涉嫌违法犯罪", "扰乱公共秩序或信访秩序", "其他异常情形"] },
      { label: "异常投诉具体表现", type: "select", options: ["涉嫌敲诈勒索、诈骗或伪造材料", "非法聚集、围堵或阻断交通", "侮辱、殴打或威胁工作人员", "其他异常情形"] }
    ],
    "剔除申请": [
      { label: "客户姓名", type: "input" },
      { label: "剔除申请类型", type: "select", options: ["被投诉机构错误", "无法确认投诉人身份", "客户实际未持有所投诉产品", "单纯征信类投诉", "单纯协商还款类投诉"] }
    ],
    "异议核查": [
      { label: "客户姓名", type: "input" },
      { label: "是否达成一致", type: "select", options: ["是", "否"] },
      { label: "接收机构", type: "orgTree", key: "filter.subprocess-export.receiveInstitution" },
      { label: "接收部门", type: "orgTree", key: "filter.subprocess-export.receiveDepartment" }
    ],
    "投诉校正": [],
    "撤销投诉": [],
    "延长申请": []
  };

  function renderExportFilterRow(fields, className = "", hidden = false) {
    return '<div class="export-filter-row ' + className + '"' + (hidden ? ' hidden' : '') + '>' + fields.map(field => field && field.html ? field.html : renderFilterField(field)).join("") + '</div>';
  }

  function normalizeComplaintExclusionSelection(current, changedKey, checked) {
    const selected = new Set(current || []);
    if (changedKey === "重复投诉") {
      if (checked) { selected.add("重复投诉"); selected.add("再次投诉"); }
      else { selected.delete("重复投诉"); selected.delete("再次投诉"); }
    } else if (changedKey === "再次投诉") {
      if (checked) selected.add("再次投诉");
      else { selected.delete("再次投诉"); selected.delete("重复投诉"); }
    } else if (checked) selected.add(changedKey);
    else selected.delete(changedKey);
    return COMPLAINT_EXCLUSION_RULES.map(option => option.key).filter(key => selected.has(key));
  }

  function renderComplaintExclusionRules(selected = [], scope = "query") {
    const values = Array.isArray(selected) ? selected : [];
    const descriptions = [
      '经系统重复投诉规则识别，并标记为“重复投诉单”的投诉工单。',
      '投诉单字段【再次投诉】取值为“是”的工单。',
      '投诉单已关联异常投诉申请单，且【异常投诉判定】为“是”的工单。',
      '工单状态为【已废止】的投诉工单。'
    ];
    return '<div class="query-complaint-exclusion-rules" data-complaint-exclusion-rules data-exclusion-scope="' + escapeAttribute(scope) + '"><strong>剔除规则</strong><div class="complaint-exclusion-options">' + COMPLAINT_EXCLUSION_RULES.map((option, index) => '<label class="complaint-exclusion-option" title="' + escapeAttribute(option.title) + '"><input type="checkbox" data-complaint-exclusion-rule value="' + option.key + '" ' + (values.includes(option.key) ? "checked" : "") + '><span class="complaint-exclusion-name">' + option.key + '</span><small>' + descriptions[index] + '</small></label>').join("") + '</div></div>';
  }

  function bindComplaintExclusionRules(root, onChange) {
    root.querySelectorAll("[data-complaint-exclusion-rules]").forEach(group => {
      const inputs = [...group.querySelectorAll("[data-complaint-exclusion-rule]")];
      const selectedValues = () => COMPLAINT_EXCLUSION_RULES.map(option => option.key).filter(key => inputs.some(input => input.value === key && input.checked));
      const syncPartialState = () => {
        const repeat = inputs.find(input => input.value === "重复投诉");
        const again = inputs.find(input => input.value === "再次投诉");
        if (repeat) repeat.indeterminate = Boolean(!repeat.checked && again?.checked);
      };
      syncPartialState();
      inputs.forEach(input => input.addEventListener("change", () => {
        const next = normalizeComplaintExclusionSelection(selectedValues(), input.value, input.checked);
        inputs.forEach(item => { item.checked = next.includes(item.value); });
        syncPartialState();
        onChange?.(next, group.dataset.exclusionScope || "query");
      }));
    });
  }

  function renderTicketExportFilters() {
    const typeControl = { html: '<div class="ticket-filter-item"><label>工单类型</label><select class="di-native-select is-fluid" data-query-ticket-type><option value="">全部</option>' +
      filterOptions("工单类型").map(type => '<option value="' + type + '" ' + (state.queryTicketType === type ? "selected" : "") + '>' + type + '</option>').join("") +
      '</select></div>' };
    const customerFields = [
      { label: "客户类型", type: "select", options: ["自然人", "非自然人"] },
      { label: "客户姓名", type: "input" },
      { label: "联系方式", type: "input", placeholder:"请输入联系方式" }
    ];
    const complaintFields = [
      { label: "业务办理渠道标签", type: "tagHierarchy", dictionary: "trsBusinessChannel", key: "filter.query.tags.channel" },
      { label: "投诉产品标签", type: "tagHierarchy", dictionary: "rectificationProduct", key: "filter.query.tags.business" },
      { label: "投诉原因标签", type: "tagHierarchy", dictionary: "rectificationCause", key: "filter.query.tags.reason" },
      { label: "投诉诉求标签", type: "tagHierarchy", dictionary: "appealTag", key: "filter.query.tags.appeal" }
    ];
    return '<div class="filter-panel ticket-filter-panel export-filter-panel ticket-export-filter-panel"><div class="export-filter-layout">' +
      renderExportFilterRow([typeControl, "工单状态", { label:"处置期限", type:"range" }], "is-primary-row") +
      renderExportFilterRow(["受理渠道", { label: "工单编号", type: "input" }], "is-base-row") +
      renderExportFilterRow(customerFields, "is-customer-row") +
      renderExportFilterRow([{ label: "工单接收机构", type: "orgTree", key: "filter.ticket-export.org" }, businessLineFilterField("filter.query.business-lines")], "is-ownership-row") +
      renderExportFilterRow([{ label: "是否异常投诉", type: "select", options: ["是", "否"] }, { label: "是否黑灰产投诉", type: "select", options: ["是", "否"] }], "is-risk-row") +
      renderExportFilterRow(complaintFields, "is-conditional-row") +
      renderComplaintExclusionRules(state.queryComplaintQuickFilters, "query") +
      '<div class="filter-actions export-filter-actions"><button class="btn-link filter-reset" data-action="reset-filter">' + icon("reset") + ' 重置</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="search">' + icon("search") + ' 搜索</button></div></div></div>';
  }

  function renderSubprocessExportFilters() {
    const typeControl = { html: '<div class="ticket-filter-item"><label>子流程类型</label><select class="di-native-select is-fluid" data-query-subprocess-type><option value="">全部</option>' +
      SUBPROCESS_TYPES.map(type => '<option value="' + type + '" ' + (state.querySubprocessType === type ? "selected" : "") + '>' + type + '</option>').join("") +
      '</select></div>' };
    const differenceFields = SUBPROCESS_EXPORT_FILTER_FIELDS[state.querySubprocessType] || [];
    return '<div class="filter-panel ticket-filter-panel export-filter-panel subprocess-export-filter-panel"><div class="export-filter-layout">' +
      renderExportFilterRow([typeControl, "子流程单状态", { label:"处置期限", type:"range" }], "is-primary-row") +
      renderExportFilterRow([{ label: "子流程单编号", type: "input" }, { label: "关联工单编号", type: "input" }], "is-base-row") +
      renderExportFilterRow([{ label: "子流程单创建人", type: "input" }, { label: "所属机构", type: "orgTree", key: "filter.subprocess-export.institution" }, { label: "所属部门", type: "orgTree", key: "filter.subprocess-export.department" }], "is-ownership-row") +
      (differenceFields.length ? renderExportFilterRow(differenceFields, "is-conditional-row") : "") +
      '<div class="filter-actions export-filter-actions"><button class="btn-link filter-reset" data-action="reset-filter">' + icon("reset") + ' 重置</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="search">' + icon("search") + ' 搜索</button></div></div></div>';
  }
  function renderLedgerQuery() {
    const tabs = availableComplaintTabs("ledger-query", ["工单导出", "子流程单导出", "溯源整改导出", "导出申请", "导出台账"]);
    if (!tabs.includes(state.queryTab)) state.queryTab = tabs[0] || "工单导出";
    const subprocessMode = state.queryTab === "子流程单导出";
    const rectificationMode = state.queryTab === "溯源整改导出";
    const exportRequestMode = state.queryTab === "导出申请";
    const exportLedgerMode = state.queryTab === "导出台账";
    const ledgerRows = exportLedgerRows();
    const querySubprocessRows = subprocessRows.filter(row => row[5] !== '草稿');
    const queryRectificationRows = rectificationRows.filter(row => row[5] !== "草稿");
    const results = exportLedgerMode ? renderExportLedgerTable() : exportRequestMode ? renderExportRequestTable() : rectificationMode ? renderRectificationQueryTable() : (subprocessMode ? renderSubprocessTable(querySubprocessRows, { context: "query", scope: "query-subprocesses", pageSize: 50 }) : renderQueryTicketTable());
    const filtersHtml = exportLedgerMode ? renderFilters(["导出时间", "申请人", { label: "申请人所属机构", type: "orgTree", key: "filter.ledger.org" }, "审批人", "脱敏情况", { label:"导出类型", type:"select", options:[...EXPORT_LEDGER_TYPES] }]) : exportRequestMode ? renderExportRequestFilters("query") : rectificationMode ? renderGroupedFilters([
      [{ label:"整改状态", type:"select", options:RECTIFICATION_STATUS_ORDER }, { label:"整改单编号", type:"input" }, { label:"关联工单编号", type:"input" }],
      [{ label:"申请时间", type:"range" }, { label:"计划完成时间", type:"range" }],
      [{ label:"整改单创建人", type:"input" }, { label:"整改机构或部门", type:"orgTree", key:"filter.rectification-export.org" }, { label:"整改负责人", type:"input", placeholder:"请输入整改负责人关键词" }]
    ], "rectification-filter-panel") : (subprocessMode ? renderSubprocessExportFilters() : renderTicketExportFilters());
    const subtitle = exportLedgerMode ? "查看所有已执行导出操作的记录" : exportRequestMode ? "查看在查询导出中发起的导出申请进度" : rectificationMode ? "查询和导出溯源整改单（不含草稿）" : (subprocessMode ? "仅查询和导出子流程单，不混入工单结果" : "查询和导出工单及再次投诉单，不包含子流程单");
    const total = exportLedgerMode ? ledgerRows.length : exportRequestMode ? exportRequestRows.length : rectificationMode ? queryRectificationRows.length : (subprocessMode ? querySubprocessRows.length : queryTicketExportRows().length);
    const scope = exportLedgerMode ? "export-ledger" : exportRequestMode ? "export-requests" : rectificationMode ? "query-rectifications" : (subprocessMode ? "query-subprocesses" : "query-tickets");
    return '<section class="page">' + pageHeader("查询导出", subtitle, "") + '<div class="panel"><div class="tabs lib-tabs-line">' + tabs.map(tab => '<button class="tab ' + (state.queryTab === tab ? "is-active" : "") + '" data-query-tab="' + tab + '">' + tab + '</button>').join("") + '</div></div>' + filtersHtml + '<div class="panel">' + results + renderPagination(total, scope, 50) + '</div></section>';
  }
  function renderRectificationQueryTable() {
    const scope = "query-rectifications";
    const rows = sortRowsForTable(rectificationRows.filter(row => row[5] !== "草稿"), "query-rectifications");
    const resolver = () => [actionDef("export", "导出", "rectification-export", "批量导出"), actionDef("detail", "查看", "rectification-detail")];
    const defs = collectOperationDefs(rows, resolver);
    const body = rows.map(row => {
      const record = documentRecordFor("rectification", row);
      const responsible = record?.fields?.entry?.["整改负责人（处置员）"] || "-";
      const creator = record?.fields?.base?.["创建人"] || row[3] || "-";
      const organization = record?.fields?.entry?.["整改部门或机构"] || row[4] || "-";
      const copied = Array.isArray(record?.fields?.entry?.["抄送人"]) ? record.fields.entry["抄送人"].length > 0 : Boolean(record?.fields?.entry?.["抄送人"]);
      const applicationTime = record?.fields?.base?.["申请时间"] || row[6] || "-";
      const plannedCompletionTime = record?.fields?.plan?.["计划完成时间"] || "-";
      return '<tr data-rectification-creator="' + escapeAttribute(creator) + '" data-rectification-organization="' + escapeAttribute(organization) + '" data-rectification-responsible="' + escapeAttribute(responsible) + '" data-rectification-copied="' + (copied ? '是' : '否') + '" data-rectification-application-time="' + escapeAttribute(applicationTime) + '" data-rectification-planned-completion-time="' + escapeAttribute(plannedCompletionTime) + '">' + selectionCell(scope, row[0]) + '<td class="primary-cell">' + escapeAttribute(row[0]) + '</td><td>' + escapeAttribute(row[7] || "-") + '</td><td>' + renderRectificationRelatedTicketSummary(row) + '</td><td>' + escapeAttribute(row[4]) + '</td><td>' + statusTag(row[5]) + '</td><td>' + escapeAttribute(row[6]) + '</td>' + renderOperationCells(defs, resolver(row), row[0]) + '</tr>';
    }).join("");
    return renderBulkToolbar(scope, defs, collectBatchOperationDefs(rows, resolver)) + '<div class="table-wrap"><table class="table ds-table selectable-table rectification-query-table"><thead><tr>' + selectionHead(scope) + sortableHead('整改单编号', scope, 0) + sortableHead('整改单名称', scope, 7) + sortableHead('关联工单编号', scope, 2) + sortableHead('负责机构', scope, 4) + sortableHead('整改状态', scope, 5) + sortableHead('更新时间', scope, 6) + renderOperationHeaders(defs) + '</tr></thead><tbody>' + (body || tableEmptyStateRow(9)) + '</tbody></table></div>';
  }
  function rectificationFieldValue(field, row) {
    const record = documentRecordFor("rectification", row);
    if (!record) return undefined;
    const stage = field.dataStage;
    if (stage && Object.prototype.hasOwnProperty.call(record.fields?.[stage] || {}, field.name)) return record.fields[stage][field.name];
    for (const candidate of ["base", "entry", "plan", "result", "statistics"]) {
      if (Object.prototype.hasOwnProperty.call(record.fields?.[candidate] || {}, field.name)) return record.fields[candidate][field.name];
    }
    return undefined;
  }

  function displayRectificationValue(field, value, row) {
    if (field.type === "rectificationBarChart") return renderRectificationComparisonChart(row);
    if (field.type === "rectificationTrendChart" || field.type === "trendChart") return renderRectificationTrendChart(row);
    if (field.type === "upload") return value ? '<button type="button" class="btn-link" data-action="contact-attachment">' + escapeAttribute(value) + '</button>' : "-";
    if (Array.isArray(value)) return value.length ? '<div class="rectification-value-tags">' + value.map(item => '<span class="tag ds-tag is-light is-blue">' + escapeAttribute(item) + '</span>').join('') + '</div>' : "-";
    return value === undefined || value === null || value === "" ? "-" : escapeAttribute(value);
  }

  function subprocessFieldDisplay(field, row = null) {
    if (row?.[1] === "溯源整改") {
      const stored = rectificationFieldValue(field, row);
      if (["rectificationBarChart", "rectificationTrendChart", "trendChart"].includes(field.type)) return displayRectificationValue(field, stored, row);
      if (field.name === "关联工单编号") return renderRelatedTicketLinks(row);
      if (field.name === "整改单名称" && row?.[7] && stored === undefined) return escapeAttribute(row[7]);
      if (field.name === "整改部门或机构" && row?.[4] && stored === undefined) return escapeAttribute(row[4] + " / 消费者权益保护部");
      if (stored !== undefined) return displayRectificationValue(field, stored, row);
    }
    if (field.name === "关联工单编号" && row?.[2]) return renderRelatedTicketLinks(row);
    const storedRecord = row ? documentRecordFor("subprocess", row) : null;
    const storedValue = storedRecord?.fields?.processing?.[field.name] ?? storedRecord?.fields?.entry?.[field.name] ?? storedRecord?.fields?.base?.[field.name];
    if (field.type === "upload") {
      const label = storedValue !== undefined && storedValue !== "" ? (Array.isArray(storedValue) ? storedValue.join("、") : String(storedValue)) : "查看已上传材料";
      return '<button type="button" class="btn-link" data-action="contact-attachment">' + escapeAttribute(label) + '</button>';
    }
    if (storedValue !== undefined && storedValue !== "") return escapeAttribute(Array.isArray(storedValue) ? storedValue.join("、") : storedValue);
    if (field.value) return escapeAttribute(field.value);
    if (field.name.includes("时间") || field.name.includes("日期")) return "2026-07-16 11:08";
    if (field.options?.length) return escapeAttribute(field.options[0]);
    if (field.type === "readonly") return "系统自动生成";
    return "已按申请材料填写";
  }

  function renderSubprocessReadonlyDifference(definition, phase = "all", row = null, requestedTitles = null) {
    let visibleSections = subprocessDifferenceSections(definition, phase);
    if (definition.type === "溯源整改" && phase === "process" && row) {
      const planStates = ["方案待提交", "方案待初审", "方案待审批"];
      const resultReviewStates = ["结果待初审", "结果待审批"];
      if (planStates.includes(row[5])) visibleSections = visibleSections.filter(section => section.title === "整改方案");
      else if (row[5] === "整改中") visibleSections = visibleSections.filter(section => ["整改方案", "整改结果"].includes(section.title));
      else if (resultReviewStates.includes(row[5]) || row[5] === "已办结") visibleSections = visibleSections.filter(section => ["整改方案", "整改结果", "整改结果-投诉统计"].includes(section.title));
      else visibleSections = [];
    }
    if (requestedTitles?.length) visibleSections = visibleSections.filter(section => requestedTitles.includes(section.title));
    return visibleSections.map(section => {
      if (definition.type === "溯源整改" && section.phase === "statistics") return renderRectificationStatisticsSection(row);
      const fieldsHtml = section.fields.map(field => {
        if (definition.type === "溯源整改" && field.type === "relatedEventPicker") {
          return '<div class="is-wide rectification-related-detail-field"><dt>' + escapeAttribute(field.name) + '</dt><dd>' + renderRectificationRelatedTickets(row, { readOnly:true }) + '</dd></div>';
        }
        return '<div class="' + (field.span ? 'is-wide' : '') + '"><dt>' + escapeAttribute(field.name) + '</dt><dd>' + subprocessFieldDisplay(field, row) + '</dd></div>';
      }).join('');
      return '<section class="panel detail-section rectification-stage-section rectification-stage-' + escapeAttribute(section.phase || phase) + '"><div class="panel-head"><span class="panel-title">' + escapeAttribute(section.title) + '</span></div><dl class="ds-descriptions detail-descriptions">' + fieldsHtml + '</dl></section>';
    }).join('');
  }

  function rectificationApprovalEditableStage(row) {
    const stageByStatus = {
      "问题待审核": { phase:"create", dataStage:"entry", label:"整改问题" },
      "方案待初审": { phase:"process", dataStage:"plan", titles:["整改方案"], label:"整改方案" },
      "结果待初审": { phase:"process", dataStage:"result", titles:["整改结果"], label:"整改结果" }
    };
    return stageByStatus[row?.[5]] || null;
  }

  function renderRectificationApprovalEditableSections(row, stage) {
    if (!row || !stage) return "";
    const definition = subprocessDefinition("溯源整改");
    let sections = subprocessDifferenceSections(definition, stage.phase);
    if (stage.titles?.length) sections = sections.filter(section => stage.titles.includes(section.title));
    const scope = "subprocess" + (stage.phase === "process" ? "-processing" : "") + ".溯源整改";
    const record = documentRecordFor("rectification", row);
    if (stage.phase === "create") state.rectificationEditId = row[0];
    sections.forEach(section => section.fields.forEach(field => {
      const key = scope + "." + field.name;
      const stored = record?.fields?.[field.dataStage || stage.dataStage || section.phase]?.[field.name];
      if (state.formValues[key] === undefined && stored !== undefined) state.formValues[key] = deepClone(stored);
      if (field.type === "readonly" && stored !== undefined) field.value = stored;
    }));
    const fieldsForRender = field => {
      if (field.type === "relatedEventPicker") {
        return '<div class="is-wide rectification-related-detail-field"><dt>' + escapeAttribute(field.name) + '</dt><dd>' + renderRectificationRelatedTickets(row, { readOnly:true }) + '</dd></div>';
      }
      return renderField(field, scope);
    };
    return sections.map((section, index) => '<section class="panel detail-section rectification-stage-section rectification-approval-edit-section" id="section-rectification-approval-edit-' + (index + 1) + '"><div class="panel-head"><span class="panel-title">' + escapeAttribute(section.title) + '</span></div><div class="panel-body"><div class="form-grid">' + section.fields.map(fieldsForRender).join("") + '</div></div></section>').join("");
  }

  function persistRectificationApprovalEdits(row, stage) {
    if (!row || !stage) return { ok:true };
    const definition = subprocessDefinition("溯源整改");
    let sections = subprocessDifferenceSections(definition, stage.phase);
    if (stage.titles?.length) sections = sections.filter(section => stage.titles.includes(section.title));
    const scope = "subprocess" + (stage.phase === "process" ? "-processing" : "") + ".溯源整改";
    const record = documentRecordFor("rectification", row) || { fields:{} };
    const existing = deepClone(record.fields?.[stage.dataStage] || {});
    sections.forEach(section => section.fields.forEach(field => {
      if (field.type === "relatedEventPicker") return;
      const value = state.formValues[scope + "." + field.name];
      if (value !== undefined) existing[field.name] = deepClone(value);
    }));
    snapshotDocumentStage("rectification", row[0], stage.dataStage, existing);
    return { ok:true };
  }

  function renderSubprocessProcessingEditor(definition, row = null, options = {}) {
    let sections = subprocessDifferenceSections(definition, definition.type === "异常投诉" ? "create" : "process");
    if (definition.type === "溯源整改" && row) {
      if (row[5] === "方案待提交") sections = sections.filter(section => section.title === "整改方案");
      else if (row[5] === "整改中") sections = sections.filter(section => section.title === "整改结果");
      else sections = [];
    }
    const isRectification = definition.type === "溯源整改";
    const isHandlerRejectable = !isRectification && canRejectSubprocessProcessing(row);
    if (!sections.length && !isHandlerRejectable) return "";
    const scope = "subprocess-processing." + definition.type;
    const record = row ? documentRecordFor(definition.type === "溯源整改" ? "rectification" : "subprocess", row) : null;
    sections.forEach(section => section.fields.forEach(field => {
      const key = scope + "." + field.name;
      const stored = definition.type === "溯源整改" ? record?.fields?.[field.dataStage || section.phase]?.[field.name] : record?.fields?.processing?.[field.name];
      if (state.formValues[key] === undefined && stored !== undefined) state.formValues[key] = deepClone(stored);
      if (field.type === "readonly" && stored !== undefined) field.value = stored;
    }));
    const stageName = definition.type === "溯源整改" ? (row?.[5] === "方案待提交" ? "制定整改计划" : "填写整改结果") : "子流程处理";
    const rejectPlanButton = isRectification && row?.[5] === "方案待提交"
      ? '<button type="button" class="btn xib-btn btn-danger" data-action="reject-rectification-plan">驳回</button>'
      : "";
    const rejectProcessingButton = isHandlerRejectable
      ? '<button type="button" class="btn xib-btn btn-danger" data-action="reject-subprocess-processing">驳回</button>'
      : "";
    const saveLabel = isRectification ? "保存草稿" : "保存处理草稿";
    const submitButton = options.allowSubmit === false ? "" : '<button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="submit-subprocess-processing">提交' + stageName + '</button>';
    const editHint = options.allowSubmit === false ? "草稿阶段可维护处理信息；正式提交仍直接进入审批" : "仅当前阶段字段可编辑，已完成阶段保持只读";
    return '<form id="subprocess-processing-form" class="subprocess-processing-form">' + sections.map((section,index) => '<section class="form-section subprocess-difference-section rectification-edit-section" id="section-subprocess-processing-' + (index + 1) + '"><div class="form-section-head">' + section.title + '</div><div class="form-section-body"><div class="form-grid">' + section.fields.map(field => renderField(field, scope)).join("") + '</div></div></section>').join("") + '<div class="sticky-actions subprocess-processing-actions"><span style="margin-right:auto;color:var(--muted);font-size:12px">' + editHint + '</span><div class="sticky-action-buttons">' + (state.role === "developer" ? '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="demo-fill-subprocess-processing">' + icon("edit") + ' 一键填写 Demo</button>' : "") + '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="save-subprocess-processing">' + saveLabel + '</button>' + rejectPlanButton + rejectProcessingButton + submitButton + '</div></div></form>';
  }

  function renderRelatedTicketLinks(row) {
    const ids = row?.[1] === "溯源整改" ? rectificationRelatedTicketIds(row) : subprocessRelatedTicketIds(row);
    return ids.length ? '<span class="related-ticket-link-list">' + ids.map(ticketId => '<button type="button" class="btn-link" data-action="open-related-workspace" data-id="' + escapeAttribute(ticketId) + '" data-subprocess-type="' + escapeAttribute(row?.[0] || "") + '">' + escapeAttribute(ticketId) + '</button>').join("") + '</span>' : "-";
  }

  function subprocessRelatedTicketIds(row) {
    const record = row ? documentRecordFor("subprocess", row) : null;
    const sources = [record?.relatedTicketIds, record?.fields?.base?.["关联工单编号"], row?.[2]];
    const ids = sources.map(normalizeRelatedTicketIds).find(candidate => candidate.length) || [];
    return ids;
  }

  function renderSubprocessRelatedDocuments(row) {
    const tickets = subprocessRelatedTicketIds(row).map((ticketId, index) => {
      const ticket = ticketRowById(ticketId) || [ticketId, "投诉单", index ? "陈晓敏" : row[3], "关联投诉事项", row[4], "处理中", row[6]];
      return '<tr><td><button type="button" class="btn-link" data-action="open-related-workspace" data-id="' + ticketId + '" data-subprocess-type="' + row[0] + '">' + ticketId + '</button></td><td>' + ticket[1] + '</td><td>' + ticket[2] + '</td><td>' + ticketAcceptanceChannel(ticket) + '</td><td>' + ticket[4] + '</td><td>' + statusTag(ticket[5]) + '</td><td>' + (index === 0 ? "发起时关联主工单" : "共同关联主工单") + '</td></tr>';
    }).join("");
    return '<section class="panel detail-section subprocess-related-documents"><div class="panel-head"><span class="panel-title">关联主工单</span><small>支持一个子流程单关联多个主工单；点击工单编号进入完整详情</small></div><div class="table-wrap"><table class="table ds-table"><thead><tr><th>工单编号</th><th>工单类型</th><th>客户姓名</th><th>受理渠道</th><th>当前机构</th><th>工单状态</th><th>关联关系</th></tr></thead><tbody>' + tickets + '</tbody></table></div></section>';
  }

  function renderSubprocessRelatedWorkspace(row) {
    const rootTicketId = subprocessRelatedTicketIds(row)[0] || row[2];
    const contextChanged = state.subprocessRelatedContextId !== row[0] || state.relatedRootTicketId !== rootTicketId;
    state.relatedRootTicketId = rootTicketId;
    state.relatedSourceSubprocessId = row[0];
    state.subprocessRelatedContextId = row[0];
    if (contextChanged) state.relatedItemId = rootTicketId;
    const rootRow = ticketRowById(rootTicketId) || [rootTicketId, "投诉单", row[3], "关联投诉事项", row[4], "处理中", row[6]];
    return `<div class="subprocess-related-workspace">${renderMainTicketOnlyRelatedWorkspace(rootTicketId, rootRow, "该子流程所关联的主工单", true)}</div>`;
  }

  function flowStatusCell(record) {
    const from = record.from || "";
    const to = record.to || record.status || record.result || "";
    if (from && to) return '<span class="flow-status-pair">' + statusTag(from) + '<span aria-hidden="true">→</span>' + statusTag(to) + '</span>';
    return "-";
  }

  function normalizeWorkflowRecord(item) {
    const transition = String(item.statusTransition || "").split(/\s*→\s*/);
    const from = item.from || transition[0] || "";
    const to = item.to || item.status || transition[1] || "";
    const operatorName = item.operatorName || item.actor || "-";
    const flowSceneName = item.flowSceneName || item.action || "-";
    const opinionAllowed = item.systemGeneratedOpinion === true || /转派|驳回|回填|修改基本信息/.test(flowSceneName);
    return {
      operatorName,
      operatorRoleName:operatorName === "系统" ? "-" : (item.operatorRoleName || item.role || "-"),
      operatorOrgName:operatorName === "系统" ? "-" : (item.operatorOrgName || item.org || "-"),
      flowSceneName,
      flowOpinion:opinionAllowed ? (item.flowOpinion ?? item.opinion ?? "") : "",
      receiverName:item.receiverName ?? item.receiver ?? "-",
      statusTransition:item.statusTransition || (from && to ? `${from} → ${to}` : "-"),
      operationTime:workflowOperationTime(item.operationTime || item.time || "-"),
      result:item.result || item.to || "-",
      from,
      to
    };
  }

  function renderWorkflowRecordTable(records = []) {
    const normalized = records.map(normalizeWorkflowRecord);
    const body = normalized.length ? normalized.map(record => '<tr><td>' + escapeAttribute(record.operatorName) + '</td><td>' + escapeAttribute(record.operatorRoleName) + '</td><td>' + escapeAttribute(record.operatorOrgName) + '</td><td>' + escapeAttribute(record.flowSceneName) + '</td><td class="transfer-opinion">' + escapeAttribute(record.flowOpinion || "-") + '</td><td>' + escapeAttribute(record.receiverName || "-") + '</td><td>' + flowStatusCell(record) + '</td><td>' + escapeAttribute(record.operationTime || "-") + '</td></tr>').join("") : '<tr><td colspan="8">-</td></tr>';
    return '<div class="table-wrap"><table class="table ds-table transfer-record-table" data-disable-column-customizer><thead><tr><th>操作人</th><th>角色</th><th>机构</th><th>流转场景</th><th>流转意见</th><th>接收对象</th><th>状态流转</th><th>操作时间</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  const COMPLAINT_FLOW_STEPS = DOCUMENT_STATE_MACHINES.ticket?.complaintDisplayFlowSteps || [];

  function complaintFlowPath(from, to) {
    if (from === to) return [];
    const queue = [{ status:from, path:[] }];
    const visited = new Set([from]);
    while (queue.length) {
      const current = queue.shift();
      for (const step of COMPLAINT_FLOW_STEPS) {
        if (step[0] !== current.status || visited.has(step[1])) continue;
        const path = [...current.path, step];
        if (step[1] === to) return path;
        visited.add(step[1]);
        queue.push({ status:step[1], path });
      }
    }
    return [];
  }

  function complaintWorkflowRecordsForDisplay(records, row) {
    return records.flatMap(record => {
      const path = complaintFlowPath(record.from, record.to);
      if (!path.length) {
        // Ancillary actions (such as reassignment) remain visible without inventing a status change.
        return [{ ...record, flowSceneName:record.from === "待提交" && record.to === "待处理" ? "派发工单" : record.flowSceneName }];
      }
      return path.map(([from, to, scene], index) => ({
        ...record,
        from,
        to,
        flowSceneName:scene,
        statusTransition:`${from} → ${to}`,
        receiverName:index === path.length - 1 ? record.receiverName : workflowReceiverName("ticket", row, to),
        result:to
      }));
    });
  }

  function workflowRecordsFor(kind, row, fallbackRecords = []) {
    const history = (workflowHistory[kind]?.[row?.[0]] || []).map(normalizeWorkflowRecord);
    const records = history.length ? history : fallbackRecords.map(normalizeWorkflowRecord);
    const chronological = records.sort((a, b) => String(a.operationTime || "").localeCompare(String(b.operationTime || "")));
    return kind === "ticket" && row?.[1] === "投诉单" ? complaintWorkflowRecordsForDisplay(chronological, row) : chronological;
  }

  function renderSubprocessTransferTab(row, definition) {
    const fallback = [
      { operatorName:"陈敏慧-60157", operatorRoleName:"经办员", operatorOrgName:row[4], flowSceneName:"创建并提交", flowOpinion:"", receiverName:subprocessHasProcessingStage(definition, row) ? row[4] + "机构工单池" : row[4] + "审批工单池", statusTransition:"草稿 → " + row[5], operationTime:workflowOperationTime(row[6]) }
    ];
    const records = renderWorkflowRecordTable(workflowRecordsFor("subprocess", row, fallback));
    return '<div class="detail-sections"><section class="panel detail-section"><div class="panel-head"><span class="panel-title">流程节点</span></div><div class="panel-body">' + renderSubprocessFlow(definition.type, row) + '</div></section><section class="panel detail-section"><div class="panel-head"><span class="panel-title">流转记录</span></div>' + records + '</section></div>';
  }

  function renderSubprocessBasicTab(row, definition, policy = workflowPolicy("subprocess", row), approvalFull = false) {
    const record = documentRecordFor("subprocess", row);
    const stored = record?.fields?.base || {};
    const commonNames = ["创建人", "所属机构", "所属部门", "申请时间", "处置期限", "子流程单编号", "关联工单编号"];
    const typeFields = SUBPROCESS_BASE_FIELD_RULES.type_fields?.[definition.type] || [];
    const values = { "创建人":"陈敏慧-60157", "所属机构":row[4], "所属部门":qualifiedDepartmentName(row[4], "消费者权益保护部"), "申请时间":row[6], "处置期限":subprocessDeadlineValue(row[1], row[6], row[2]), "子流程单编号":row[0], "关联工单编号":subprocessRelatedTicketIds(row).join("、"), "抄送人":subprocessCopyRecipient(row[1], subprocessRelatedTicketIds(row), { ...stored, ...(record?.fields?.entry || {}) }), ...stored };
    const renderValue = name => name === "关联工单编号" ? renderRelatedTicketLinks(row) : escapeAttribute(values[name] || "-");
    const rows = commonNames.map(name => '<div><dt>' + name + '</dt><dd>' + renderValue(name) + '</dd></div>').join("") + typeFields.map(field => '<div class="' + (field.span ? 'is-wide' : '') + '"><dt>' + field.name + '</dt><dd>' + escapeAttribute(values[field.name] || "-") + '</dd></div>').join("");
    const base = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">基础信息</span></div><dl class="ds-descriptions detail-descriptions">' + rows + '</dl></section>';
    const copy = '<section class="panel detail-section subprocess-copy-section"><div class="panel-head"><span class="panel-title">抄送信息</span></div><dl class="ds-descriptions detail-descriptions"><div class="is-wide"><dt>抄送人</dt><dd>' + escapeAttribute(values["抄送人"] || "-") + '</dd></div></dl></section>';
    const hasProcessing = subprocessHasProcessingStage(definition, row);
    const storedSupplement = record?.fields?.supplement || {};
    const showSupplement = !hasProcessing && SUBPROCESS_SUPPLEMENT_TYPES.has(row[1]) && (row[5] === "待补录" || Object.keys(storedSupplement).length > 0 || state.supplementDataBySubprocess[row[0]]);
    const supplementContent = showSupplement ? renderSubprocessSupplementSection(row, definition, policy.canSupplement) : "";
    const approvalContent = !hasProcessing && approvalFull ? renderFullApprovalSection() : "";
    return '<div class="detail-sections">' + base + renderSubprocessReadonlyDifference(definition, "create", row) + copy + supplementContent + approvalContent + '</div>';
  }

  function renderSubprocessProcessingTab(row, definition, policy, approvalFull) {
    const manualAccountabilityDraft = isManualAccountabilityDraft(row);
    const generated = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">子流程处理信息</span></div><dl class="ds-descriptions detail-descriptions"><div><dt>当前状态</dt><dd>' + statusTag(row[5]) + '</dd></div><div><dt>接收机构</dt><dd>' + row[4] + '</dd></div><div><dt>接收部门</dt><dd>' + (qualifiedDepartmentName(row[4], "消费者权益保护部") || "-") + '</dd></div><div><dt>当前处理角色</dt><dd>' + (approvalFull ? "审批员" : manualAccountabilityDraft ? "创建人" : policy.canSupplement ? "补录经办人" : policy.canProcess ? "处理员" : "当前节点处理人") + '</dd></div><div><dt>更新时间</dt><dd>' + row[6] + '</dd></div></dl></section>';
    const processSections = subprocessDifferenceSections(definition, "process");
    let businessContent = "";
    if (approvalFull) businessContent = renderSubprocessReadonlyDifference(definition, "process", row);
    else if (policy.canProcess || manualAccountabilityDraft) businessContent = renderSubprocessProcessingEditor(definition, row, { allowSubmit: !manualAccountabilityDraft });
    else businessContent = renderSubprocessReadonlyDifference(definition, "process", row);
    if (definition.type === "异议核查") {
      const contactTicket = ticketRowById(row[2]) || [row[2], "投诉单", row[3], "关联投诉事项", row[4], "处理中", row[6]];
      const contactReadOnly = approvalFull || !policy.canProcess || state.detailEntry !== "process";
      businessContent = '<section class="panel detail-section"><div class="panel-head"><span class="panel-title">联系记录</span><small>与主工单联系记录共用同一数据源</small></div><div class="panel-body">' + processingContactTable(contactTicket, contactReadOnly, true) + '</div></section>' + businessContent;
    }
    if (!processSections.length) businessContent += '<section class="panel detail-section subprocess-no-process-fields"><div class="panel-head"><span class="panel-title">处理阶段差异字段</span></div><div class="panel-body empty"><strong>本类型无单独处理阶段字段</strong><span>该子流程的差异字段已在创建阶段填写，当前栏目仅展示系统处理信息与状态。</span></div></section>';
    const storedSupplement = documentRecordFor("subprocess", row)?.fields?.supplement || {};
    const showSupplement = SUBPROCESS_SUPPLEMENT_TYPES.has(row[1]) && (row[5] === "待补录" || Object.keys(storedSupplement).length > 0 || state.supplementDataBySubprocess[row[0]]);
    const supplementContent = showSupplement ? renderSubprocessSupplementSection(row, definition, policy.canSupplement) : "";
    const approvalContent = approvalFull ? renderFullApprovalSection() : "";
    const footer = approvalFull ? renderApprovalStickyFooter() : policy.canSupplement ? renderSubprocessSupplementActions(row) : "";
    return '<div class="detail-sections">' + generated + businessContent + supplementContent + approvalContent + '</div>' + footer;
  }

  function subprocessSupplementScope(row) {
    return "supplement." + row[0];
  }

  function subprocessSupplementFields(definition) {
    return (SUBPROCESS_SUPPLEMENT_SECTIONS[definition.type] || []).flatMap(section => section.fields || []);
  }

  function hydrateSubprocessSupplementForm(row, definition) {
    const scope = subprocessSupplementScope(row);
    const stored = documentRecordFor("subprocess", row)?.fields?.supplement || {};
    const saved = state.supplementDataBySubprocess[row[0]] || {};
    const values = { ...stored, ...(saved.fields || {}) };
    subprocessSupplementFields(definition).forEach(field => {
      const key = scope + "." + field.name;
      if (state.formValues[key] === undefined && values[field.name] !== undefined) state.formValues[key] = deepClone(values[field.name]);
    });
    const selectedKey = scope + "._selectedContactIndex";
    if (state.formValues[selectedKey] === undefined && saved.selectedContactIndex !== undefined) state.formValues[selectedKey] = String(saved.selectedContactIndex);
  }

  function supplementContactContext(row) {
    const ticket = ticketRowById(row[2]) || [row[2], "投诉单", row[3], "关联投诉事项", row[4], "处理中", row[6]];
    return { ticket, records: contactRecordsForTicket(ticket) };
  }

  function renderSupplementContactRecords(row, editable) {
    const { records } = supplementContactContext(row);
    const body = records.length ? records.map((record, index) => '<tr><td>' + escapeAttribute(record.time) + '</td><td>' + escapeAttribute(record.contact) + '</td><td>' + escapeAttribute(record.org) + '</td><td>' + escapeAttribute(record.method + (record.template ? " · " + record.template : "")) + '</td><td>' + contactStatusCell(smsApprovalStatusForRecord(record)) + '</td><td>' + contactStatusCell(contactStatusForRecord(record)) + '</td><td><button type="button" class="btn-link" data-action="supplement-contact-detail" data-id="' + index + '">查看内容</button></td><td>' + contactAttachmentCell(record, index, row[2]) + '</td></tr>').join("") : '<tr><td colspan="8">-</td></tr>';
    return '<div class="embedded-contact-block supplement-contact-block"><div class="embedded-block-title"><span>联系记录</span><small>告知延期时间下拉框可选择联系记录中的时间，告知延期方式将自动回填</small></div>' + contactToolbar() + '<div class="table-wrap"><table class="table ds-table contact-record-table supplement-contact-table"><thead><tr><th>联系时间</th><th>联系人</th><th>处理机构</th><th>沟通方式</th><th>短信审批状态</th><th>联系状态</th><th>联系内容</th><th>附件</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }

  function renderSubprocessSupplementSection(row, definition, editable) {
    hydrateSubprocessSupplementForm(row, definition);
    const scope = subprocessSupplementScope(row);
    const sections = SUBPROCESS_SUPPLEMENT_SECTIONS[definition.type] || [];
    const selectedNoticeTime = state.formValues[scope + ".告知延期时间"];
    if (definition.type === "延长申请" && selectedNoticeTime) syncExtensionNoticeMethod(scope + ".告知延期时间", selectedNoticeTime);
    const fields = sections.flatMap(section => section.fields || []).filter(field => fieldVisible(field, scope));
    const renderedFields = fields.map(field => renderField(editable ? field : { ...field, disabled:true, required:false, requiredWhen:undefined }, scope)).join("");
    const contacts = definition.type === "延长申请" ? renderSupplementContactRecords(row, editable) : "";
    return '<section class="panel detail-section subprocess-supplement-section" id="section-subprocess-supplement"><div class="panel-head"><span class="panel-title">补录信息</span></div><div class="panel-body"><div class="subprocess-supplement-notice"><strong>' + definition.document + '审批已通过</strong><span>其他创建、处理和审批字段保持只读，请在此完成结果补录。</span></div>' + contacts + '<div class="form-grid subprocess-supplement-grid">' + renderedFields + '</div></div></section>';
  }

  function renderSubprocessSupplementActions() {
    return '<div class="sticky-actions subprocess-supplement-actions"><span>补录字段提交后不可继续编辑</span><button type="button" class="btn xib-btn xib-btn--secondary" data-action="save-subprocess-supplement">保存补录</button><button type="button" class="btn xib-btn xib-btn--primary btn-primary" data-action="submit-subprocess-supplement">提交补录</button></div>';
  }

  function selectSupplementContact(index) {
    const row = workflowRow("subprocess", state.subprocessId);
    if (!row || row[1] !== "延长申请" || row[5] !== "待补录") return toast("当前单据无法选择延期联系记录", true);
    const record = supplementContactContext(row).records[index];
    if (!record) return toast("未找到所选联系记录", true);
    const scope = subprocessSupplementScope(row);
    state.formValues[scope + "._selectedContactIndex"] = String(index);
    state.formValues[scope + ".告知延期时间"] = record.time;
    state.formValues[scope + ".告知延期方式"] = record.method;
    if (record.time) state.formValues[scope + ".是否告知延期"] = "是";
    rerenderPage();
    toast("已回填告知延期时间和方式");
  }

  function syncExtensionNoticeMethod(timeKey, timeValue) {
    if (!timeKey.endsWith(".告知延期时间")) return;
    const scope = timeKey.slice(0, -".告知延期时间".length);
    const row = workflowRow("subprocess", state.subprocessId);
    const ticket = row ? ticketRowById(row[2]) : null;
    const records = row ? supplementContactContext(row).records : (ticket ? contactRecordsForTicket(ticket) : ticketRows.flatMap(item => contactRecordsForTicket(item)));
    const recordIndex = records.findIndex(item => item.time === timeValue);
    const record = recordIndex >= 0 ? records[recordIndex] : null;
    state.formValues[scope + "._selectedContactIndex"] = record ? String(recordIndex) : "";
    state.formValues[scope + ".告知延期方式"] = record?.method || "";
  }

  function subprocessInventoryValue(row, field, phase) {
    const scope = phase === "处理" ? "subprocess-processing." + row[1] : "subprocess." + row[1];
    const key = scope + "." + field.name;
    if (Object.prototype.hasOwnProperty.call(state.formValues, key)) {
      const value = state.formValues[key];
      return { value: Array.isArray(value) ? value.join("、") : value, source: "当前表单值" };
    }
    const fallback = subprocessFieldDisplay(field, row);
    return { value: String(fallback ?? "-").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(), source: "当前子流程单值" };
  }

  function subprocessPhaseInventoryRows(row, definition, phase) {
    const sections = subprocessDifferenceSections(definition, phase === "处理" ? "process" : "create");
    const fields = sections.flatMap(section => section.fields);
    const values = Object.fromEntries(fields.map(field => [field.name, subprocessInventoryValue(row, field, phase).value]));
    return sections.flatMap(section => section.fields.map(field => {
      const stored = subprocessInventoryValue(row, field, phase);
      const visible = historicalConditionMatches(field.showWhen, values);
      const editable = field.type === "readonly" || field.disabled
        ? "只读"
        : phase === "处理"
          ? (["待处理", "处理中", "方案待提交", "整改中"].includes(row[5]) ? "处理节点可编辑" : "非当前处理节点")
          : (row[5] === "草稿" || row[5] === "问题待提交" ? "当前可编辑" : "已提交，只读");
      return {
        stage: phase,
        section: section.title,
        label: field.name,
        control: FIELD_CONTROL_LABELS[field.type] || field.type,
        required: inventoryRequiredRule(field, row[1], values),
        editable,
        status: visible ? (field.showWhen ? "显示（条件已触发）" : "显示") : "隐藏（条件未触发）",
        value: visible ? stored.value : "-",
        source: visible ? stored.source : "条件未触发"
      };
    }));
  }

  function subprocessApprovalInventoryRows(row) {
    if (SUBPROCESS_NO_APPROVAL_TYPES.has(row[1])) return [];
    const history = (workflowHistory.subprocess[row[0]] || []).map(normalizeWorkflowRecord);
    const definitions = [
      ...(subprocessNeedsInitialApproval(row) ? [{ stage: "初审", action: "初审" }] : []),
      ...(!SUBPROCESS_NO_FINAL_APPROVAL_TYPES.has(row[1]) ? [{ stage: "审批", action: "审批" }] : [])
    ];
    return definitions.flatMap(definition => {
      const completed = history.find(item => item.flowSceneName === definition.action + "通过" || item.flowSceneName === definition.action + "驳回" || item.flowSceneName === definition.action + "不通过");
      const currentStatuses = definition.stage === "初审" ? ["待初审", "初审中"] : ["待审批", "审批中"];
      const current = currentStatuses.includes(row[5]) && approvalStageFor("subprocess", row) === (definition.stage === "初审" ? "initial" : "approval");
      const nodeStatus = completed ? "已完成" : current ? "当前节点" : "待流转";
      return [
        { suffix: "人", control: "只读文本框", required: "必填", editable: "只读", value: completed?.operatorName || (current ? "系统根据当前节点生成" : "-") },
        { suffix: "结论", control: "单选按钮", required: "必填", editable: "对应审批节点可编辑", value: completed?.result || "-" },
        { suffix: "意见", control: "文本域", required: "条件必填（结论驳回）", editable: "对应审批节点可编辑", value: completed?.flowOpinion || "-" }
      ].map(field => ({
        stage: definition.stage,
        section: definition.stage + "表单",
        label: definition.stage + field.suffix,
        control: field.control,
        required: field.required,
        editable: field.editable,
        status: nodeStatus,
        value: field.value,
        source: completed ? "流转记录" : current ? "当前节点" : "尚未流转"
      }));
    });
  }

  function openSubprocessFieldInventory(id) {
    const row = [...subprocessRows, ...rectificationRows].find(item => item[0] === id) || subprocessRows[0];
    const definition = subprocessDefinition(row[1]);
    const baseRows = [
      ["事件创建人", "陈敏慧-60157"],
      ["所属机构", row[4]],
      ["所属部门", qualifiedDepartmentName(row[4], "消费者权益保护部")],
      ["子流程单编号", row[0]],
      ["关联工单编号", row[2]],
      ["申请时间", row[6]]
    ].map(([label, value]) => ({ stage: "基础", section: "基础信息", label, control: "只读文本框", required: "必填", editable: "只读", status: "显示", value, source: "当前子流程单值" }));
    const rows = baseRows
      .concat(subprocessPhaseInventoryRows(row, definition, "录入"))
      .concat(subprocessPhaseInventoryRows(row, definition, "处理"))
      .concat(subprocessApprovalInventoryRows(row));
    if (SUBPROCESS_SUPPLEMENT_TYPES.has(row[1])) {
      const scope = subprocessSupplementScope(row);
      const stored = documentRecordFor("subprocess", row)?.fields?.supplement || {};
      (SUBPROCESS_SUPPLEMENT_SECTIONS[row[1]] || []).forEach(section => (section.fields || []).forEach(field => {
        const value = state.formValues[scope + "." + field.name] ?? stored[field.name] ?? "-";
        rows.push({ stage: "补录", section: section.title, label: field.name, control: FIELD_CONTROL_LABELS[field.type] || field.type, required: field.required ? "必填" : field.requiredWhen ? "条件必填" : "非必填", editable: row[5] === "待补录" ? "当前可编辑" : "对应补录节点可编辑", status: row[5] === "待补录" ? "当前节点" : "待流转", value, source: value === "-" ? "尚未补录" : "补录字段" });
      }));
    }
    const counts = rows.reduce((result, item) => {
      result[item.stage] = (result[item.stage] || 0) + 1;
      return result;
    }, {});
    const countText = Object.entries(counts).map(([stage, count]) => stage + " " + count + " 项").join(" · ");
    const body = rows.map(item => '<tr><td>' + escapeAttribute(item.stage) + '</td><td>' + escapeAttribute(item.section) + '</td><td class="inventory-field-name">' + escapeAttribute(item.label) + '</td><td>' + escapeAttribute(item.control) + '</td><td>' + escapeAttribute(item.required) + '</td><td>' + escapeAttribute(item.editable) + '</td><td>' + escapeAttribute(item.status) + '</td><td class="inventory-field-value"><span>' + escapeAttribute(item.value == null || item.value === "" ? "-" : String(item.value)) + '</span><small>' + escapeAttribute(item.source) + '</small></td></tr>').join("");
    openModal("子流程单字段清单", '<div class="ticket-field-inventory subprocess-field-inventory"><div class="query-condition"><span>当前子流程单</span><strong>' + escapeAttribute(row[0]) + ' · ' + escapeAttribute(definition.document) + ' · ' + escapeAttribute(row[5]) + '</strong><small>' + countText + '；以下内容按当前子流程类型、字段元数据、表单值与流转状态生成。</small></div><div class="table-wrap"><table class="table ds-table"><thead><tr><th>阶段</th><th>页面分区</th><th>字段中文名</th><th>控件类型</th><th>必填规则</th><th>编辑规则</th><th>当前状态</th><th>当前值 / 来源</th></tr></thead><tbody>' + body + '</tbody></table></div></div>', "关闭");
  }

  function renderSubprocessDetail() {
    const row = [...subprocessRows, ...rectificationRows].find(item => item[0] === state.subprocessId) || subprocessRows[0];
    if (row[1] === "溯源整改") return window.XIBComplaintRectification.renderDetail(moduleContext());
    const definition = subprocessDefinition(row[1]);
    const subprocessRecord = documentRecordFor("subprocess", row);
    const draftValidation = renderDraftValidationBanner(subprocessRecord, "子单");
    const policy = workflowPolicy("subprocess", row);
    const approvalEntry = state.approvalContext?.type === "子流程审批";
    const approvalFull = state.approvalContext?.mode === "full" && approvalEntry;
    const supplementMode = state.detailEntry === "supplement" && row[5] === "待补录";
    const backPage = approvalEntry ? "my-approvals" : "subprocess-manage";
    const backLabel = approvalEntry ? "审批管理" : "子单处理";
    const hasProcessing = subprocessHasProcessingStage(definition, row);
    const rejectedCreationView = policy.entry === "view" && Boolean(latestCreationRejection("subprocess", row));
    const tabs = rejectedCreationView ? ["基本信息", "处理信息", "流转记录", "历史工单", "关联工单"] : ["基本信息"].concat(hasProcessing ? ["处理信息"] : [], ["流转记录", "关联单据"]);
    if (approvalFull && !state.subprocessDetailTab) state.subprocessDetailTab = hasProcessing ? "处理信息" : "基本信息";
    if (!tabs.includes(state.subprocessDetailTab)) state.subprocessDetailTab = "基本信息";
    let content = "";
    if (state.subprocessDetailTab === "基本信息") content = renderSubprocessBasicTab(row, definition, policy, approvalFull);
    else if (state.subprocessDetailTab === "处理信息") content = renderSubprocessProcessingTab(row, definition, policy, approvalFull);
    else if (state.subprocessDetailTab === "流转记录") content = renderSubprocessTransferTab(row, definition);
    else if (state.subprocessDetailTab === "历史工单") content = renderCustomerProfile(ticketRowById(row[2]) || [row[2], "投诉单", row[3], "-", row[4], "处理中", row[6]]);
    else content = renderSubprocessRelatedWorkspace(row);
    const tabsHtml = '<div class="panel detail-tabs"><div class="tabs lib-tabs-line">' + tabs.map(tab => '<button class="tab ' + (state.subprocessDetailTab === tab ? "is-active" : "") + '" data-subprocess-detail-tab="' + tab + '">' + tab + '</button>').join("") + '</div></div>';
    const stageLabel = approvalFull ? approvalStageLabel(state.approvalContext?.approvalStage) : "";
    const pageTitlePrefix = approvalFull ? "子流程" + stageLabel + " · " : supplementMode ? "子流程补录 · " : "";
    const noProcessFooter = !hasProcessing && state.subprocessDetailTab === "基本信息" ? (approvalFull ? renderApprovalStickyFooter() : policy.canSupplement ? renderSubprocessSupplementActions(row) : "") : "";
    const noApprovalNotice = SUBPROCESS_NO_APPROVAL_TYPES.has(row[1]) ? '<section class="rectification-stage-notice is-readonly subprocess-no-approval-notice"><div><strong>无需审批</strong><span>撤销投诉完成处理后由系统直接更新关联主工单的处置结果并办结，不进入初审、复核或审批待办。</span></div><small>系统直办</small></section>' : "";
    const headerActions = (state.role === "developer" ? '<button type="button" class="btn xib-btn xib-btn--secondary" data-action="subprocess-field-inventory" data-id="' + row[0] + '">字段清单</button>' : "") + renderContextBackButton(backPage, backLabel);
    return '<section class="page subprocess-detail-page ' + (approvalFull ? "approval-detail-page" : "") + (supplementMode ? " supplement-detail-page" : "") + '">' + pageHeader(pageTitlePrefix + definition.document + "详情", supplementMode ? "补充审批通过后的待补录信息，提交后完成办结" : "按创建、处理、流转与关联关系查看子流程单完整内容", headerActions) + '<div class="panel detail-summary"><div><span>' + definition.document + '编号</span><strong>' + row[0] + '</strong></div><div><span>子流程类型</span><strong>' + row[1] + '</strong></div><div><span>当前状态</span>' + statusTag(row[5]) + '</div><div><span>关联主工单</span><button class="btn-link" data-action="open-related-workspace" data-id="' + row[2] + '" data-subprocess-type="' + row[0] + '">' + row[2] + '</button></div></div>' + renderWorkflowRejection(policy) + draftValidation + noApprovalNotice + tabsHtml + content + noProcessFooter + '</section>';
  }
  function renderApprovalFilters(tab, poolMode = false, sourceRows = []) {
    const ticketType = { label: "工单类型", type: "select", options: filterOptions("工单类型") };
    const ticketStatus = { label: "工单状态", type: "select", options: filterOptions("工单状态") };
    const subprocessType = { label: "子流程类型", type: "select", options: SUBPROCESS_TYPES.filter(type => type !== "督导函") };
    const subprocessStatus = { label: "子流程单状态", type: "select", options: DOCUMENT_STATE_MACHINES.subprocess?.statuses || ["草稿", "待处理", "处理中", "待审批", "审批中", "待补录", "已办结"] };
    const rows = [];
    if (tab === "工单审批") {
      rows.push(renderExportFilterRow([ticketType, ticketStatus, { label: "处置期限", type: "range" }], "is-approval-business-row"));
      rows.push(renderExportFilterRow([{ label: "受理渠道", type: "select", options: filterOptions("受理渠道") }, { label: "工单编号", type: "input" }], "is-approval-base-row"));
      rows.push(renderExportFilterRow([{ label:"客户类型", type:"select", options:["自然人", "非自然人"] }, "客户姓名", { label:"联系方式", type:"input", placeholder:"请输入联系方式" }], "is-approval-customer-row"));
      rows.push(renderExportFilterRow([{ label: "工单接收机构", type: "orgTree", key: "filter.approval.ticket.org" }, renderReceivingDepartmentFilter(sourceRows, "approval"), businessLineFilterField("filter.approval.ticket.business-lines")], "is-approval-ownership-row"));
    } else if (tab === "子流程审批") {
      rows.push(renderExportFilterRow([subprocessType, subprocessStatus, { label: "处置期限", type: "range" }], "is-approval-business-row"));
      rows.push(renderExportFilterRow([{ label: "子流程单编号", type: "input" }, { label: "关联工单编号", type: "input" }], "is-approval-base-row"));
      rows.push(renderExportFilterRow([{ label: "子流程单创建人", type: "input" }, { label: "所属机构", type: "orgTree", key: "filter.approval.subprocess.institution" }, { label: "所属部门", type: "orgTree", key: "filter.approval.subprocess.department" }], "is-approval-ownership-row"));
    } else if (tab === "短信审批") {
      rows.push(renderExportFilterRow([{ label:"处置期限", type:"range" }, { label:"短信编号", type:"input" }], "is-approval-base-row"));
    } else if (tab === "导出申请审批") {
      return renderExportRequestFilters("approval");
    }
    return '<div class="filter-panel ticket-filter-panel export-filter-panel approval-filter-panel"><div class="export-filter-layout">' + rows.join("") +
      '<div class="filter-actions export-filter-actions"><button class="btn-link filter-reset" data-action="reset-filter">' + icon("reset") + ' 重置</button><button class="btn xib-btn xib-btn--primary btn-primary" data-action="search">' + icon("search") + ' 搜索</button></div></div></div>';
  }
  function approvalStatusesForRole(kind, scopeOverride) {
    const role = currentRoleProfile().role;
    const scope = scopeOverride || state.approvalScope || "我的工作台";
    if (scope === "__all__") return ["待复核", "复核中", "待处理", "处理中", "会签中", "待初审", "初审中", "待审批", "审批中"];
    if (role === "reviewer") return scope === "下辖工单池" ? [] : ["待复核", "复核中"];
    if (role === "approver") {
      if (scope === "我的工作台") return kind === "ticket" ? ["会签中", "待初审", "初审中", "待审批", "审批中"] : ["待初审", "初审中", "待审批", "审批中"];
      return ["待处理", "处理中", "待初审", "初审中", "待审批", "审批中"];
    }
    if (scope === "我的工作台") return kind === "ticket" ? ["待复核", "复核中", "会签中", "待初审", "初审中", "待审批", "审批中"] : ["待复核", "复核中", "待初审", "初审中", "待审批", "审批中"];
    return ["待复核", "复核中", "待处理", "处理中", "待初审", "初审中", "待审批", "审批中"];
  }

  function ticketApprovalRows(scopeOverride) {
    const visibleStates = approvalStatusesForRole("ticket", scopeOverride);
    return ticketRows.filter(row => visibleStates.includes(row[5])).map(row => {
      const stage = ["待处理", "处理中"].includes(row[5]) ? "process" : ["待复核", "复核中"].includes(row[5]) ? "review" : approvalStageFor("ticket", row);
      const node = stage === "process" ? "业务处理" : stage === "review" ? "建单复核" : stage === "initial" ? (row[5] === "初审中" ? "初审中" : "初审") : stage === "countersign" ? "会签" : (row[5] === "审批中" ? "审批中" : "审批");
      return [row[0], "工单审批", row[1], row[2], row[4], node, stage === "review" ? "剩余 1 天" : "剩余 2 天", "", "", "", row[5]];
    });
  }

  function subprocessApprovalRows(scopeOverride) {
    const visibleStates = approvalStatusesForRole("subprocess", scopeOverride);
    const standardRows = subprocessRows.filter(row => visibleStates.includes(row[5])).map(row => {
      const stage = ["待处理", "处理中"].includes(row[5]) ? "process" : ["待复核", "复核中"].includes(row[5]) ? "review" : approvalStageFor("subprocess", row);
      const node = stage === "process" ? "业务处理" : stage === "review" ? (row[5] === "复核中" ? "复核中" : "复核") : stage === "initial" ? (row[5] === "初审中" ? "初审中" : "初审") : (row[5] === "审批中" ? "审批中" : "审批");
      return [row[0], "子流程审批", row[1], row[3], row[4], node, "剩余 1 天", "", row[2], row[0], row[5]];
    });
    return standardRows;
  }

  function approvalRowsForTab(tab, scopeOverride) {
    if (tab === "工单审批") return ticketApprovalRows(scopeOverride);
    if (tab === "子流程审批") return subprocessApprovalRows(scopeOverride);
    return approvalRows.filter(row => row[1] === tab);
  }

  function approvalRecordById(id) {
    return ticketApprovalRows().find(row => row[0] === id) || subprocessApprovalRows().find(row => row[0] === id) || approvalRows.find(row => row[0] === id);
  }

  function renderMyApprovals() {
    const workTabs = availableComplaintTabs("my-approvals", ["工单审批", "子流程审批"]);
    const requestTabs = availableComplaintTabs("my-approvals", ["短信审批", "导出申请审批"]);
    const allTabs = workTabs.concat(requestTabs);
    if (!allTabs.includes(state.approvalTab)) state.approvalTab = workTabs[0] || requestTabs[0];
    if (!workTabs.includes(state.approvalPoolTab)) state.approvalPoolTab = workTabs[0];
    if (!["我的工作台", "机构工单池", "下辖工单池"].includes(state.approvalScope)) state.approvalScope = "我的工作台";
    const isMyWorkspace = state.approvalScope === "我的工作台";
    const activeTab = isMyWorkspace ? state.approvalTab : state.approvalPoolTab;
    const isWorkTab = workTabs.includes(activeTab);
    const poolRole = ["reviewer", "approver"].includes(state.role) ? state.role : "";
    const poolRequest = { task: "approval", view: complaintPoolView(state.approvalScope), tab: state.approvalWorkTab === "待办" ? "todo" : "all", statusIndex: 10, kindForRow: approvalPoolKind, role: poolRole };
    // Build counts from the complete approval source. Filtering by the
    // currently selected pool here made the other pool counts change after
    // switching views.
    const allWorkRows = ticketApprovalRows("__all__").concat(subprocessApprovalRows("__all__"));
    const aggregatePool = COMPLAINT_WORK_POOL.model(allWorkRows, poolRequest);
    const activeApprovalRows = approvalRowsForTab(activeTab);
    const activePool = isWorkTab ? COMPLAINT_WORK_POOL.model(activeApprovalRows, poolRequest) : null;
    const rawRows = activePool
      ? activePool.rows
      : (isMyWorkspace ? activeApprovalRows : []);
    const availableRows = filterRowsByComplaintPermission(rawRows, "my-approvals", state.approvalScope, 10);
    const rows = activeTab === "工单审批" ? filterTicketRowsByReceivingDepartment(availableRows, "approval") : availableRows;
    const scopes = [["我的工作台", aggregatePool.counts.workbench, "当前复核员或审批员经手过且尚未办结的工单"], ["机构工单池", aggregatePool.counts.org, "本机构范围内所有未办结审批工单"], ["下辖工单池", aggregatePool.counts.subOrg, "下辖机构全部未办结审批工单"]];
    const scopeGridHtml = '<div class="scope-grid process-scope-grid approval-scope-grid">' + scopes.map(([label,count,desc]) => '<button class="scope-card ds-card app-card ' + (state.approvalScope === label ? "is-active" : "") + '" data-approval-scope="' + label + '"><b>' + count + '</b><strong>' + label + '</strong><span>' + desc + '</span></button>').join("") + '</div>';
    const categoryTabs = isMyWorkspace ? allTabs : workTabs;
    const categoryHtml = '<div class="panel"><div class="tabs lib-tabs-line">' + categoryTabs.map(tab => { const model = workTabs.includes(tab) ? COMPLAINT_WORK_POOL.model(approvalRowsForTab(tab, "__all__"), poolRequest) : null; const count = model ? model.rows.length : approvalRowsForTab(tab).length; const attr = isMyWorkspace ? "data-approval-tab" : "data-approval-pool-tab"; return '<button class="tab ' + (activeTab === tab ? "is-active" : "") + '" ' + attr + '="' + tab + '">' + tab + '<span class="count">' + count + '</span></button>'; }).join("") + '</div></div>';
    const workbenchTabs = isMyWorkspace && isWorkTab ? '<div class="panel approval-work-tabs-panel" style="margin-bottom:0"><div class="tabs lib-tabs-line">' + '<button class="tab ' + (state.approvalWorkTab === "待办" ? "is-active" : "") + '" data-approval-work-tab="待办">待办<span class="count">' + activePool.counts.todo + '</span></button>' + '<button class="tab ' + (state.approvalWorkTab === "全部" ? "is-active" : "") + '" data-approval-work-tab="全部">全部<span class="count">' + activePool.counts.workbench + '</span></button>' + '</div></div>' : "";
    const filtersHtml = renderApprovalFilters(activeTab, !isMyWorkspace, availableRows.map(row => workflowRow("ticket", row[0])).filter(Boolean));
    const tableScopeBase = isMyWorkspace ? "approvals" : "approval-pool";
    const tableScope = isWorkTab ? tableScopeBase + (activeTab === "工单审批" ? "-ticket" : "-subprocess") : tableScopeBase;
    const tableHtml = isWorkTab
      ? renderApprovalBusinessTable(rows, activeTab, { approvalScope:state.approvalScope, scope:tableScope })
      : renderApprovalTable(rows, { approvalScope:state.approvalScope, scope:tableScope, tab:activeTab });
    return '<section class="page">' + pageHeader("审批管理", "按复核员、审批员任务视角聚合未办结审批工单") + scopeGridHtml + categoryHtml + workbenchTabs + filtersHtml + '<div class="panel">' + tableHtml + renderPagination(rows.length, tableScope) + '</div></section>';
  }
  function renderTicketApprovals() {
    const rows = approvalRowsForTab("工单审批");
    return `<section class="page">${pageHeader(state.role === "reviewer" ? "客服工单复核" : "工单审批", state.role === "reviewer" ? "复核客服中心创建的主流程及校正、撤销事项" : "审批当前权限范围内的五类主流程工单")}${renderFilters(["工单编号", "客户姓名", "工单类型", "审批节点", { label: "发起机构", type: "orgTree", key: "filter.ticket-approval.org" }, "审批状态", "剩余时限"])}<div class="panel">${renderApprovalBusinessTable(rows, "工单审批", { scope:"ticket-approvals", approvalScope:"我的工作台" })}${renderPagination(rows.length, "ticket-approvals")}</div></section>`;
  }

  function renderSubprocessApprovals() {
    const rows = approvalRowsForTab("子流程审批");
    return `<section class="page">${pageHeader("子流程审批", "复核并审批延长、调查、校正、剔除等子流程事项")}${renderFilters(["子流程编号", "关联工单编号", "子流程类型", "审批节点", { label: "发起机构", type: "orgTree", key: "filter.subprocess-approval.org" }, "审批状态", "剩余时限"])}<div class="panel">${renderApprovalBusinessTable(rows, "子流程审批", { scope:"subprocess-approvals", approvalScope:"我的工作台" })}${renderPagination(rows.length, "subprocess-approvals")}</div></section>`;
  }

  function renderRequestApprovals() {
    const tabs = ["短信审批","导出申请审批"];
    return `<section class="page">${pageHeader("申请审批", "审批短信发送与数据导出申请，子流程审批已拆分为独立模块")}<div class="panel" style="margin-bottom:12px"><div class="tabs lib-tabs-line">${tabs.map(tab=>`<button class="tab ${state.requestApprovalTab===tab?'is-active':''}" data-request-approval-tab="${tab}">${tab}</button>`).join("")}</div></div>${renderFilters(["申请单编号", "关联工单编号", "申请类型", "审批节点", "申请人", { label: "发起机构", type: "orgTree", key: "filter.request-approval.org" }, "发起时间"])}<div class="panel">${renderApprovalTable(approvalRows.filter(row=>row[1]===state.requestApprovalTab), { scope:"request-approvals", tab:state.requestApprovalTab })}${renderPagination(approvalRows.filter(row=>row[1]===state.requestApprovalTab).length, "request-approvals")}</div></section>`;
  }

  function approvalActions(row, approvalScope = state.approvalScope || "我的工作台") {
    const isSubprocessApproval = row?.[1] === '子流程审批';
    const detail = actionDef('detail', '查看', isSubprocessApproval ? 'approval-subprocess-detail' : 'detail');
    const showDetailAction = ['工单审批', '子流程审批'].includes(row?.[1]);
    const analystCanApprove = state.role === 'analyst' && String(row?.[2] || "").includes('废止');
    const ticket = row?.[1] === '工单审批' ? workflowRow("ticket", row[0]) : null;
    const subprocess = row?.[1] === '子流程审批' ? workflowRow("subprocess", row[0]) : null;
    const stage = ["待复核", "复核中"].includes(ticket?.[5]) || ["待复核", "复核中"].includes(subprocess?.[5]) ? "review" : ticket ? approvalStageFor("ticket", ticket) : subprocess ? approvalStageFor("subprocess", subprocess) : "approval";
    if (approvalScope !== '我的工作台' && ['reviewer','approver','developer'].includes(state.role)) {
      const status = row?.[10] || row?.[5] || '';
      const poolDetailAction = isSubprocessApproval ? 'approval-subprocess-detail' : 'detail';
      const poolActions = [...(showDetailAction ? [actionDef('view', '查看', poolDetailAction)] : []), ...(transferReasonPolicy(status).allowed ? [actionDef('transfer', '转派', 'transfer-approval')] : []), actionDef('remind', '催办', 'remind', '批量催办')];
      // 本机构工单池中的待审批、审批中工单允许审批员直接进入审批。
      if (approvalScope === '机构工单池' && ticket && ['待审批', '审批中'].includes(status) && ['approver', 'developer'].includes(state.role)) {
        poolActions.unshift(actionDef('approve', '审批', 'approve'));
      }
      return filterActionsByComplaintPermission(poolActions, 'my-approvals', approvalScope, status);
    }
    const actions = [];
    if (stage === "review" && ['reviewer','developer'].includes(state.role)) actions.push(actionDef('review', '复核', 'approve'));
    if (stage === "initial" && ['reviewer','approver','analyst','developer'].includes(state.role)) actions.push(actionDef('initial', '初审', 'approve'));
    if (stage === "countersign" && ['reviewer','approver','analyst','developer'].includes(state.role)) actions.push(actionDef('initial', '会签', 'approve'));
    if (stage === "approval" && (['approver','developer'].includes(state.role) || analystCanApprove)) actions.push(actionDef('approve', '审批', 'approve'));
    if (actions.length && transferReasonPolicy(row?.[10] || row?.[5] || "").allowed) actions.push(actionDef('transfer', '转派', 'transfer-approval'));
    if (showDetailAction) actions.push(detail);
    return filterActionsByComplaintPermission(actions, "my-approvals", approvalScope, row?.[10] || "");
  }

  function renderApprovalBusinessTable(rows, tab, options = {}) {
    const approvalById = new Map(rows.map(row => [row[0], row]));
    const sourceKind = tab === "工单审批" ? "ticket" : "subprocess";
    const sourceRows = rows.map(row => workflowRow(sourceKind, row[0])).filter(Boolean);
    const resolver = sourceRow => approvalActions(approvalById.get(sourceRow[0]), options.approvalScope);
    return sourceKind === "ticket"
      ? renderTicketTable(sourceRows, { context:"approval", scope:options.scope, includeSmsApproval:true, showBusinessLine:true, tableClass:"approval-table", actionResolver:resolver })
      : renderSubprocessTable(sourceRows, { context:"approval", scope:options.scope, includeSmsApproval:true, tableClass:"approval-table", actionResolver:resolver });
  }

  function renderApprovalTable(rows, options = {}) {
    const scope = options.scope || 'approvals';
    const approvalScope = options.approvalScope || state.approvalScope || '我的工作台';
    const tab = options.tab || rows[0]?.[1] || state.approvalTab;
    const timeSort = state.sorts[scope];
    const sortedRows = timeSort?.index === TICKET_TIME_SORT_INDEX
      ? rows.map(row => [...row]).sort((a, b) => (dispositionDeadline(a, "approval") || "9999").localeCompare(dispositionDeadline(b, "approval") || "9999") * (timeSort.direction === "asc" ? 1 : -1))
      : sortRowsForTable(rows, scope);
    const pageRows = options.disablePagination ? sortedRows : paginateRows(sortedRows, scope, options.pageSize || 10);
    const resolver = row => approvalActions(row, approvalScope);
    const defs = collectOperationDefs(sortedRows, resolver);
    const operationHeaders = defs.map((def, index) => {
      return '<th class="operation-column approval-operation-column" title="' + def.label + '">' + (index === 0 ? "操作" : "") + '</th>';
    }).join('');
    if (["短信审批", "导出申请审批"].includes(tab)) {
      const isSms = tab === "短信审批";
      const dataHeaders = isSms
        ? sortableHead('短信编号', scope, 0) + sortableHead('关联工单编号', scope, 8) + sortableHead('短信审批状态', scope, 10)
        : sortableHead('导出申请编号', scope, 0) + sortableHead('导出类型', scope, 2) + sortableHead('关联工单编号', scope, 8) + sortableHead('导出申请状态', scope, 10);
      const timeHeader = isSms ? renderTicketTimeHead(scope) : sortableHead('申请时间', scope, 7) + sortableHead('过期时间', scope, 20);
      const emptyColspan = (isSms ? 5 : 7) + defs.length;
      const body = pageRows.map(row => {
        const exportRequest = isSms ? null : exportRequestRows.find(item => item[0] === row[0]);
        const requestStatus = exportRequest?.[15] === "已废止" ? "已废止" : (exportRequest?.[5] || row[10] || '-');
        return '<tr' + (exportRequest ? exportRequestFilterAttributes(exportRequest) : '') + '>' + selectionCell(scope,row[0]) +
          '<td class="primary-cell">' + escapeAttribute(row[0] || '-') + '</td>' +
          (isSms ? '' : '<td>' + escapeAttribute(normalizeExportRequestType(exportRequest?.[1] || row[2]) || '-') + '</td>') +
          '<td>' + (isSms ? escapeAttribute(row[8] || '-') : renderExportApprovalRelatedTickets(row[0])) + '</td><td>' + statusTag(isSms ? (row[10] || '-') : requestStatus) + '</td>' +
          (isSms ? renderTicketTimeCell(row, "approval", row[10]) : '<td class="export-request-applied-at">' + escapeAttribute(row[7] || '-') + '</td><td class="export-request-expires-at">' + escapeAttribute(exportRequest?.[20] || '-') + '</td>') + renderOperationCells(defs, resolver(row), row[0]) + '</tr>';
      }).join('');
      return renderBulkToolbar(scope, defs, collectBatchOperationDefs(pageRows, resolver)) + '<div class="table-wrap"><table class="table ds-table selectable-table approval-table deadline-aware-table"><thead><tr>' + selectionHead(scope) + dataHeaders + timeHeader + operationHeaders + '</tr></thead><tbody>' + (body || '<tr><td colspan="' + emptyColspan + '"><div class="empty" style="min-height:180px"><div><div class="empty-mark">✓</div><p>当前分类暂无待审批事项</p></div></div></td></tr>') + '</tbody></table></div>';
    }
    return renderBulkToolbar(scope, defs, collectBatchOperationDefs(pageRows, resolver)) + '<div class="table-wrap"><table class="table ds-table selectable-table approval-table deadline-aware-table"><thead><tr>' + selectionHead(scope) + sortableHead('业务单号', scope, 0) + sortableHead('审批类型', scope, 1) + sortableHead('业务类型', scope, 2) + sortableHead('发起人', scope, 3) + sortableHead('发起机构', scope, 4) + sortableHead('当前节点', scope, 5) + sortableHead('单据状态', scope, 10) + renderTicketTimeHead(scope) + operationHeaders + '</tr></thead><tbody>' + (pageRows.map(row => { const exportRequest = row[1] === "导出申请审批" ? exportRequestRows.find(item => item[0] === row[0]) : null; return '<tr' + (exportRequest ? exportRequestFilterAttributes(exportRequest) : '') + '>' + selectionCell(scope,row[0]) + '<td class="primary-cell">' + (row[0] || '-') + '</td><td>' + (row[1] || '-') + '</td><td>' + (row[2] || '-') + '</td><td>' + (row[3] || '-') + '</td><td>' + (row[4] || '-') + '</td><td>' + (row[5] || '-') + '</td><td>' + statusTag(row[10]) + '</td>' + renderTicketTimeCell(row, "approval") + renderOperationCells(defs, resolver(row), row[0]) + '</tr>'; }).join('') || '<tr><td colspan="15"><div class="empty" style="min-height:180px"><div><div class="empty-mark">✓</div><p>当前分类暂无待审批事项</p></div></div></td></tr>') + '</tbody></table></div>';
  }
function renderPlaceholder(page) {
    const meta = PAGE_META[page] || { title: "页面", group: "功能模块" };
    return `<section class="page">${pageHeader(meta.title, `${meta.group}功能入口已按角色权限纳入导航`)}<div class="panel"><div class="empty"><div><div class="empty-mark">□</div><h3>${meta.title}</h3><p>当前阶段先完成导航与核心工单工作流，业务页面将在后续迭代。</p></div></div></div></section>`;
  }

  function listColumnValueText(value) {
    if (Array.isArray(value)) return value.map(listColumnValueText).filter(item => item && item !== "-").join("、") || "-";
    if (value && typeof value === "object") return Object.values(value).map(listColumnValueText).filter(item => item && item !== "-").join("、") || "-";
    const text = String(value ?? "").trim();
    return text && !["待补全", "不适用", "未配置", "待确定", "缺失", "未设置（手工录入）", "—"].includes(text) ? text : "-";
  }

  function nestedDocumentField(source, names, visited = new Set()) {
    if (!source || typeof source !== "object" || visited.has(source)) return "";
    visited.add(source);
    const keys = Array.isArray(names) ? names : [names];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const value = source[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
      }
    }
    for (const value of Object.values(source)) {
      if (!value || typeof value !== "object") continue;
      const matched = nestedDocumentField(value, keys, visited);
      if (matched !== "") return matched;
    }
    return "";
  }

  function listRowIdentity(row) {
    return row.querySelector("[data-row-select]")?.value || row.querySelector(".primary-cell")?.textContent.trim() || row.cells[1]?.textContent.trim() || "";
  }

  function seedRecordByIdentity(identity) {
    const lists = Object.values(SEED_DATA.lists || {});
    for (const records of lists) {
      if (!Array.isArray(records)) continue;
      const record = records.find(item => [item?.id, item?.fileName, item?.batchNo, item?.taskNo, item?.warningNo].map(String).includes(String(identity)));
      if (record) return record;
    }
    return null;
  }

  function canonicalListColumnLabel(label) {
    const text = String(label || "").replace(/[↑↓↕\s]/g, "");
    if (["子流程状态", "子流程单状态"].includes(text)) return "子流程状态";
    if (["子流程编号", "子流程单编号"].includes(text)) return "子流程单编号";
    return text;
  }

  function optionalListColumnValue(row, table, label) {
    const identity = listRowIdentity(row);
    const ticket = [...ticketRows, ...autoDraftRows, ...manualDraftRows].find(item => item[0] === identity) || queryTicketRows.find(item => item[0] === identity);
    const subprocess = subprocessRows.find(item => item[0] === identity);
    const rectification = rectificationRows.find(item => item[0] === identity);
    const exportRequest = exportRequestRows.find(item => item[0] === identity);
    const approval = approvalRows.find(item => item[0] === identity);
    const importJob = importRows.find(item => item[0] === identity);
    const aliases = {
      "联系方式":["联系方式", "来电号码", "预留手机号码", "手机号码"],
      "子流程单创建人":["子流程单创建人", "创建人"],
      "导出申请人":["导出申请人", "申请人"],
      "工单接收机构":["工单接收机构", "处理机构"],
      "关联工单编号":["关联工单编号", "关联工单号码"],
      "所属业务条线":["所属业务条线", "业务条线"]
    };
    let value = "";
    if (ticket) {
      const document = documentRecordFor("ticket", ticket);
      const ticketSeed = seedRecordByIdentity(identity);
      const direct = {
        "工单编号":ticket[0], "工单类型":ticket[1], "客户姓名":ticket[2], "受理渠道":ticketAcceptanceChannel(ticket),
        "工单接收机构":ticketReceivingInstitution(ticket), "所属业务条线":ticketBusinessLine(ticket), "工单状态":ticket[5],
        "创建时间":document?.createdAt || ticket[6], "更新时间":document?.updatedAt || ticket[6], "处置期限":dispositionDeadline(ticket, "ticket", { actualOnly:true }),
        "剩余处置时间":dispositionRemaining(dispositionDeadline(ticket, "ticket", { actualOnly:true }), ticket[5])
      };
      value = direct[label] ?? nestedDocumentField([document, ticketSeed], aliases[label] || label);
    } else if (subprocess) {
      const document = documentRecordFor("subprocess", subprocess);
      const direct = {
        "子流程单编号":subprocess[0], "子流程编号":subprocess[0], "子流程类型":subprocess[1], "子流程单类型":subprocess[1],
        "关联工单编号":subprocessRelatedTicketIds(subprocess), "客户姓名":subprocess[3], "发起机构":subprocess[4], "所属机构":subprocess[4],
        "子流程状态":subprocess[5], "子流程单状态":subprocess[5], "申请时间":document?.createdAt || subprocess[6],
        "处置期限":dispositionDeadline(subprocess, "subprocess", { actualOnly:true })
      };
      value = direct[label] ?? nestedDocumentField([document, seedRecordByIdentity(identity)], aliases[label] || label);
    } else if (rectification) {
      const document = documentRecordFor("rectification", rectification);
      const direct = {
        "整改单编号":rectification[0], "关联工单编号":rectificationRelatedTicketIds(rectification), "整改单名称":rectification[7],
        "整改单创建人":nestedDocumentField(document, ["整改单创建人", "创建人"]) || rectification[3], "整改部门或机构":nestedDocumentField(document, "整改部门或机构") || rectification[4],
        "整改状态":rectification[5], "申请时间":nestedDocumentField(document, "申请时间") || rectification[6], "计划完成时间":nestedDocumentField(document, "计划完成时间")
      };
      value = direct[label] ?? nestedDocumentField([document, seedRecordByIdentity(identity)], aliases[label] || label);
    } else if (exportRequest) {
      value = ({
        "导出申请编号":exportRequest[0], "导出类型":normalizeExportRequestType(exportRequest[1]), "导出申请状态":exportRequest[15] === "已废止" ? "已废止" : exportRequest[5],
        "申请时间":exportRequest[7], "处置期限":dispositionDeadline(exportRequest, "export", { actualOnly:true }), "关联工单编号":exportRequest[8],
        "导出申请人":exportRequest[3], "所属机构":exportRequest[4], "所属部门":exportRequest[16]
      })[label] ?? nestedDocumentField(seedRecordByIdentity(identity), aliases[label] || label);
    } else if (approval) {
      value = ({
        "业务单号":approval[0], "审批类型":approval[1], "业务类型":approval[2], "发起人":approval[3], "申请人":approval[3],
        "发起机构":approval[4], "当前节点":approval[5], "单据状态":approval[10], "审批状态":approval[10], "申请时间":approval[7],
        "关联工单编号":approval[8], "关联子流程单编号":approval[9]
      })[label] ?? nestedDocumentField(seedRecordByIdentity(identity), aliases[label] || label);
    } else if (importJob) {
      value = ({ "导入文件":importJob[0], "导入时间":importJob[1], "导入状态":normalizeImportStatus(importJob[2]) })[label];
    } else {
      value = nestedDocumentField(seedRecordByIdentity(identity), aliases[label] || label);
    }
    const text = listColumnValueText(value);
    return /状态$/.test(label) && text !== "-" ? statusTag(text) : escapeAttribute(text);
  }

  function enhanceTableColumnSettings() {
    document.querySelectorAll(".column-customizer-popover[data-runtime]").forEach(item => item.remove());
    document.querySelectorAll("#page-root table.table").forEach((table, tableIndex) => {
      if (table.hasAttribute("data-disable-column-customizer")) return;
      const headerRow = table.querySelector("thead tr");
      const headers = [...table.querySelectorAll("thead th")];
      if (!headerRow || headers.length < 2 || headerRow.querySelector(".column-customizer-trigger")) return;
      const configurable = headers.map((header,index) => ({ index, label: header.textContent.trim().replace(/[↑↓↕]/g, "").trim() }))
        .filter(item => item.label && item.label !== "操作" && !headers[item.index].querySelector('input[type="checkbox"]'));
      if (!configurable.length) return;
      const key = state.page + ":" + tableIndex + ":" + configurable.map(item => item.label).join("|");
      const hidden = new Set(state.hiddenColumns[key] || []);
      const page = table.closest(".page");
      const filterPanels = page ? [...page.querySelectorAll(".filter-panel")].filter(panel => !panel.closest(".overlay-card")) : [];
      const precedingPanels = filterPanels.filter(panel => Boolean(panel.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING));
      const filterPanel = precedingPanels.at(-1) || (filterPanels.length === 1 ? filterPanels[0] : null);
      const filterItems = filterPanel ? [...filterPanel.querySelectorAll(".ticket-filter-item")] : [];
      const defaultLabels = new Set(configurable.map(item => canonicalListColumnLabel(item.label)));
      const candidateLabels = [...(table.classList.contains("deadline-aware-table") ? ["剩余处置时间"] : []), ...filterItems.map(filterItemLabel).filter(Boolean)];
      const nonConfigurableOptionalLabels = new Set(["是否抄送", ...(state.page === "ticket-process" ? ["投诉原因"] : [])]);
      const optionalLabels = [...new Set(candidateLabels)].filter(label => !defaultLabels.has(canonicalListColumnLabel(label)) && !nonConfigurableOptionalLabels.has(canonicalListColumnLabel(label)));
      const optionalKey = state.page + ":optional-columns:" + tableIndex + ":" + optionalLabels.join("|");
      const selectedOptional = new Set((state.optionalListColumns[optionalKey] || []).filter(label => optionalLabels.includes(label)));
      const syncOptionalColumns = () => {
        table.querySelectorAll("[data-optional-list-column]").forEach(cell => cell.remove());
        const headerAnchor = headerRow.querySelector(".operation-column, .column-customizer-cell");
        selectedOptional.forEach(label => {
          const optionalHead = document.createElement("th");
          optionalHead.dataset.optionalListColumn = label;
          optionalHead.className = "optional-list-column";
          optionalHead.textContent = label;
          headerRow.insertBefore(optionalHead, headerAnchor || null);
          table.querySelectorAll("tbody tr").forEach(row => {
            if (row.querySelector("[colspan]")) return;
            const cell = document.createElement("td");
            cell.dataset.optionalListColumn = label;
            cell.className = "optional-list-column";
            if (label === "剩余处置时间") {
              const deadlineCell = row.querySelector(".ticket-time-cell[data-disposition-source]");
              const deadline = deadlineCell?.dataset.dispositionDeadline || "";
              const status = deadlineCell?.dataset.dispositionStatus || "";
              cell.classList.add("ticket-remaining-time-cell");
              cell.dataset.dispositionDeadline = deadline;
              cell.dataset.dispositionStatus = status;
              cell.dataset.dispositionEmpty = deadlineCell?.dataset.dispositionEmpty || "-";
              cell.textContent = deadline ? dispositionRemaining(deadline, status) : "-";
              cell.classList.toggle("is-urgent", dispositionTimeIsUrgent(deadline));
              cell.classList.toggle("is-overdue", Boolean(deadline) && dispositionRemaining(deadline, status).startsWith("已逾期"));
            } else {
              cell.innerHTML = optionalListColumnValue(row, table, label);
            }
            const rowAnchor = row.querySelector(".operation-column, .column-customizer-spacer");
            row.insertBefore(cell, rowAnchor || null);
          });
        });
        table.querySelectorAll("tbody tr [colspan]").forEach(cell => { cell.colSpan = headerRow.cells.length; });
      };
      const applyVisibility = () => {
        headers.forEach((header,index) => {
          const isHidden = hidden.has(index);
          header.hidden = isHidden;
          table.querySelectorAll("tbody tr").forEach(row => {
            const cell = row.children[index];
            if (cell && !cell.hasAttribute("colspan")) cell.hidden = isHidden;
          });
        });
      };
      syncOptionalColumns();
      const operationHeader = headers.find(header => header.textContent.trim().replace(/[↑↓↕]/g, "").trim() === "操作");
      let utilityHost = operationHeader;
      if (operationHeader) {
        operationHeader.classList.add("operation-column-with-customizer");
        operationHeader.textContent = "";
        const tools = document.createElement("div");
        tools.className = "operation-header-tools";
        tools.innerHTML = '<span>操作</span><button type="button" class="icon-btn column-customizer-trigger" aria-label="配置列表显示字段" title="配置列表显示字段" aria-expanded="false"><img src="ui/assets/setting.svg" alt=""></button>';
        operationHeader.appendChild(tools);
      } else {
        const utilityHead = document.createElement("th");
        utilityHead.className = "column-customizer-cell";
        utilityHead.innerHTML = '<button type="button" class="icon-btn column-customizer-trigger" aria-label="配置列表显示字段" title="配置列表显示字段" aria-expanded="false"><img src="ui/assets/setting.svg" alt=""></button>';
        headerRow.appendChild(utilityHead);
        table.querySelectorAll("tbody tr").forEach(row => {
          if (row.querySelector("[colspan]") || row.querySelector(".column-customizer-spacer")) return;
          const spacer = document.createElement("td");
          spacer.className = "column-customizer-spacer";
          spacer.setAttribute("aria-hidden", "true");
          row.appendChild(spacer);
        });
        utilityHost = utilityHead;
      }
      const popover = document.createElement("div");
      popover.className = "column-customizer-popover";
      popover.dataset.runtime = "true";
      popover.hidden = true;
      popover.innerHTML = '<strong>列表显示字段</strong><div class="column-customizer-options">' +
        configurable.map(item => '<label><input type="checkbox" data-column-index="' + item.index + '" ' + (hidden.has(item.index) ? "" : "checked") + '><span>' + item.label + '</span></label>').join("") +
        optionalLabels.map(label => '<label><input type="checkbox" data-optional-column-label="' + escapeAttribute(label) + '" ' + (selectedOptional.has(label) ? "checked" : "") + '><span>' + escapeAttribute(label) + '</span></label>').join("") +
        '</div><button type="button" class="btn-link" data-column-reset>恢复默认</button>';
      popover.style.width = optionalLabels.length ? "360px" : "260px";
      document.body.appendChild(popover);
      const trigger = utilityHost.querySelector(".column-customizer-trigger");
      trigger.addEventListener("click", event => {
        event.stopPropagation();
        const shouldOpen = popover.hidden;
        document.querySelectorAll(".column-customizer-popover[data-runtime]").forEach(item => { item.hidden = true; });
        popover.hidden = !shouldOpen;
        trigger.setAttribute("aria-expanded", String(shouldOpen));
        if (shouldOpen) {
          const rect = trigger.getBoundingClientRect();
          const width = optionalLabels.length ? 360 : 260;
          popover.style.left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width)) + "px";
          popover.style.top = (rect.bottom + 6) + "px";
          requestAnimationFrame(() => {
            if (popover.getBoundingClientRect().bottom > window.innerHeight - 12) popover.style.top = Math.max(12, rect.top - popover.offsetHeight - 6) + "px";
          });
          document.addEventListener("click", () => {
            popover.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
          }, { once: true });
        }
      });
      popover.addEventListener("click", event => event.stopPropagation());
      popover.querySelectorAll("[data-column-index]").forEach(input => input.addEventListener("change", () => {
        const index = Number(input.dataset.columnIndex);
        if (input.checked) hidden.delete(index); else hidden.add(index);
        state.hiddenColumns[key] = [...hidden];
        applyVisibility();
      }));
      popover.querySelectorAll("[data-optional-column-label]").forEach(input => input.addEventListener("change", () => {
        const label = input.dataset.optionalColumnLabel;
        if (input.checked) selectedOptional.add(label); else selectedOptional.delete(label);
        state.optionalListColumns[optionalKey] = [...selectedOptional];
        syncOptionalColumns();
      }));
      popover.querySelector("[data-column-reset]").addEventListener("click", () => {
        hidden.clear();
        selectedOptional.clear();
        state.hiddenColumns[key] = [];
        state.optionalListColumns[optionalKey] = [];
        popover.querySelectorAll("[data-column-index]").forEach(input => { input.checked = true; });
        popover.querySelectorAll("[data-optional-column-label]").forEach(input => { input.checked = false; });
        syncOptionalColumns();
        applyVisibility();
      });
      applyVisibility();
    });
  }

  function sortTableInPlace(button) {
    const table = button.closest("table");
    const tbody = table?.querySelector("tbody");
    const header = button.closest("th");
    if (!table || !tbody || !header) return;
    const scope = button.dataset.sortScope;
    const index = Number(button.dataset.sortIndex);
    const current = state.sorts[scope];
    const direction = current && current.index === index && current.direction === "asc" ? "desc" : "asc";
    state.sorts[scope] = { index, direction };
    table.querySelectorAll("[data-sort-scope]").forEach(control => {
      const active = control.dataset.sortScope === scope && Number(control.dataset.sortIndex) === index;
      const controlDirection = active ? direction : "none";
      control.classList.toggle("is-active", active);
      control.setAttribute("aria-sort", controlDirection === "none" ? "none" : controlDirection === "asc" ? "ascending" : "descending");
      const iconNode = control.querySelector("i");
      if (iconNode) iconNode.innerHTML = controlDirection === "asc" ? "&#8593;" : controlDirection === "desc" ? "&#8595;" : "&#8597;";
    });
    const cellIndex = header.cellIndex;
    const rows = [...tbody.rows].filter(row => !row.querySelector("[colspan]"));
    const documentStatusSort = isDocumentStatusSort(scope, index);
    rows.sort((a, b) => {
      const aCell = a.cells[cellIndex];
      const bCell = b.cells[cellIndex];
      const aValue = aCell?.dataset.dispositionDeadline || aCell?.textContent.trim() || "";
      const bValue = bCell?.dataset.dispositionDeadline || bCell?.textContent.trim() || "";
      if (documentStatusSort) {
        const rankMap = scope === "rectification-orders" ? RECTIFICATION_STATUS_RANK : DOCUMENT_STATUS_RANK;
        const fallbackRank = scope === "rectification-orders" ? RECTIFICATION_STATUS_ORDER.length : DOCUMENT_STATUS_ORDER.length;
        const rankA = rankMap.get(aValue) ?? fallbackRank;
        const rankB = rankMap.get(bValue) ?? fallbackRank;
        return (rankA - rankB) * (direction === "asc" ? 1 : -1);
      }
      return aValue.localeCompare(bValue, "zh-CN", { numeric: true }) * (direction === "asc" ? 1 : -1);
    });
    rows.forEach(row => tbody.appendChild(row));
  }

  function schemaFieldByName(name) {
    const scan = sections => sections.flatMap(section => section.fields || []).find(field => field.name === name);
    return scan(formSections) || scan(Object.values(SUBPROCESS_FIELD_SECTIONS).flat()) || scan(Object.values(SUBPROCESS_SUPPLEMENT_SECTIONS).flat()) || PROCESSING_FIELDS.find(field => field.name === name) || null;
  }

  function clearAiHighlight(fieldKey) {
    if (!fieldKey) return;
    state.aiGeneratedFields.delete(fieldKey);
    document.querySelectorAll('[data-field-key]').forEach(el => {
      if (el.dataset.fieldKey === fieldKey && el.classList) el.classList.remove("is-ai-generated");
    });
    document.querySelectorAll(".di-select-trigger span.is-ai-generated, .di-cascader-trigger span.is-ai-generated, .di-hierarchy-cascader-trigger span.is-ai-generated").forEach(el => {
      const host = el.closest("[data-app-select], [data-app-cascader], [data-app-hierarchy-cascader]");
      if (host && host.querySelector('input[type="hidden"][data-field-key="' + fieldKey + '"]')) el.classList.remove("is-ai-generated");
    });
  }

  function syncAiSingleCandidateSelection(fieldKey, selectedValue) {
    document.querySelectorAll('[data-ai-candidate-key]').forEach(button => {
      if (button.dataset.aiCandidateKey !== fieldKey) return;
      const selected = Boolean(selectedValue && button.dataset.aiCandidateValue === selectedValue);
      button.classList.toggle('is-selected', selected);
      const check = button.querySelector('[data-ai-candidate-check]');
      if (selected && !check) button.insertAdjacentHTML('beforeend', '<span data-ai-candidate-check aria-hidden="true">✓</span>');
      if (!selected) check?.remove();
    });
  }

  function refreshLinkedFields(root, changedName) {
    let touched = false;
    root.querySelectorAll("[data-app-select]").forEach(host => {
      const hidden = host.querySelector('input[type="hidden"]');
      const key = hidden?.dataset.fieldKey || "";
      const field = schemaFieldByName(key.split(".").pop());
      if (!field?.optionsBy || field.optionsBy.key !== changedName) return;
      const scope = key.slice(0, key.lastIndexOf(".") + 1);
      const dependency = state.formValues[scope + field.optionsBy.key] || state.formValues[field.optionsBy.key] || "";
      const options = field.optionsBy.values?.[dependency] || [];
      const menu = host.querySelector(".di-select-popover");
      if (menu) {
        const current = state.formValues[key];
        if (current && !options.includes(current)) { state.formValues[key] = ""; hidden.value = ""; }
        if (field.autoSelectSingleOption && options.length === 1) { state.formValues[key] = options[0]; hidden.value = options[0]; }
        const triggerSpan = host.querySelector(".di-select-trigger span");
        const trigger = host.querySelector(".di-select-trigger");
        const dependencyMissing = !dependency;
        if (trigger) trigger.disabled = dependencyMissing || Boolean(field.autoSelectSingleOption && options.length === 1);
        hidden.disabled = dependencyMissing || Boolean(field.autoSelectSingleOption && options.length === 1);
        menu.innerHTML = options.map(option => '<button type="button" class="' + (state.formValues[key] === option ? "is-active" : "") + '" data-select-value="' + escapeAttribute(option) + '">' + escapeAttribute(option) + '</button>').join("");
        menu.querySelectorAll("[data-select-value]").forEach(option => option.addEventListener("click", () => {
          triggerSpan.textContent = option.dataset.selectValue;
          triggerSpan.classList.remove("is-ai-generated");
          hidden.value = option.dataset.selectValue;
          state.formValues[hidden.dataset.fieldKey] = hidden.value;
          state.aiGeneratedFields.delete(hidden.dataset.fieldKey);
          syncCorrectionFieldHighlight(hidden, hidden.value);
          menu.hidden = true;
          refreshLinkedFields(root, hidden.dataset.fieldKey.split(".").pop());
        }));
        triggerSpan.textContent = state.formValues[key] || triggerSpan.dataset.placeholder || "请选择";
        if (field.autoSelectSingleOption) refreshLinkedFields(root, field.name);
      }
      touched = true;
    });
    root.querySelectorAll('[data-field-key]').forEach(control => {
      const key = control.dataset.fieldKey || "";
      const field = schemaFieldByName(key.split(".").pop());
      if (!field?.valueMap || field.valueMap.key !== changedName) return;
      const scope = key.slice(0, key.lastIndexOf(".") + 1);
      const dependency = state.formValues[scope + field.valueMap.key] || state.formValues[field.valueMap.key] || "";
      const value = field.valueMap.values?.[dependency] || "";
      control.value = value;
      state.formValues[key] = value;
      touched = true;
    });
    return touched;
  }

  function bindGlobalEvents() {
    document.querySelectorAll("[data-group-toggle]").forEach(btn => btn.addEventListener("click", () => {
      const groupId = btn.dataset.groupToggle;
      if (state.openGroups.has(groupId)) state.openGroups.delete(groupId);
      else state.openGroups.add(groupId);
      const group = btn.closest(".nav-group");
      group.classList.toggle("is-open", state.openGroups.has(groupId));
      btn.classList.toggle("is-open", state.openGroups.has(groupId));
      btn.setAttribute("aria-expanded", String(state.openGroups.has(groupId)));
      const caret = btn.querySelector(".chevron img");
      if (caret) caret.src = `ui/assets/${state.openGroups.has(groupId) ? "caret-top.svg" : "caret-bottom.svg"}`;
    }));
    document.querySelectorAll("[data-subgroup-toggle]").forEach(btn => btn.addEventListener("click", () => {
      const subgroupId = btn.dataset.subgroupToggle;
      if (state.openSubgroups.has(subgroupId)) state.openSubgroups.delete(subgroupId);
      else state.openSubgroups.add(subgroupId);
      const subgroup = btn.closest(".nav-subgroup");
      subgroup.classList.toggle("is-open", state.openSubgroups.has(subgroupId));
      btn.classList.toggle("is-open", state.openSubgroups.has(subgroupId));
      btn.setAttribute("aria-expanded", String(state.openSubgroups.has(subgroupId)));
      const caret = btn.querySelector(".chevron img");
      if (caret) caret.src = "ui/assets/" + (state.openSubgroups.has(subgroupId) ? "caret-top.svg" : "caret-bottom.svg");
    }));
    bindPageNavigation(document);
    const roleCascader = document.querySelector("[data-role-cascader]");
    const roleTrigger = document.getElementById("role-cascade-trigger");
    const rolePopover = roleCascader.querySelector(".role-cascader-popover");
    roleCascader.addEventListener("click", event => {
      const orgButton = event.target.closest("[data-role-org]");
      const profileButton = event.target.closest("[data-role-profile]");
      if (event.target.closest("#role-cascade-trigger")) {
        event.stopPropagation();
        const open = rolePopover.hidden;
        rolePopover.hidden = !open;
        roleTrigger.setAttribute("aria-expanded", String(open));
        roleTrigger.querySelector("img").src = `ui/assets/${open ? "caret-top.svg" : "caret-bottom.svg"}`;
        return;
      }
      if (orgButton) {
        event.stopPropagation();
        const org = ORG_ROLE_OPTIONS.find(item => item.id === orgButton.dataset.roleOrg);
        roleCascader.dataset.activeOrg = org.id;
        roleCascader.querySelectorAll("[data-role-org]").forEach(button => button.classList.toggle("is-active", button === orgButton));
        roleCascader.querySelector(".role-profile-column").innerHTML = org.roles.map(role => `<button type="button" data-role-profile="${role.id}">${role.label}</button>`).join("");
        return;
      }
      if (profileButton) {
        event.stopPropagation();
        const profile = roleProfiles().find(item => item.id === profileButton.dataset.roleProfile);
        state.roleProfile = profile.id;
        state.role = profile.role;
        state.org = profile.org;
        localStorage.setItem("xib-role-profile", profile.id);
        localStorage.setItem("xib-role", profile.role);
        localStorage.setItem("xib-org", profile.org);
        if (!allowed(state.page)) state.page = PERMISSIONS[state.role][0];
        location.hash = state.page;
        renderShell();
        toast("已切换为" + profile.orgLabel + " / " + profile.label);
      }
    });
    if (window.__roleCascaderOutside) document.removeEventListener("click", window.__roleCascaderOutside);
    window.__roleCascaderOutside = event => {
      if (!event.target.closest("[data-role-cascader]")) {
        rolePopover.hidden = true;
        roleTrigger.setAttribute("aria-expanded", "false");
        roleTrigger.querySelector("img").src = "ui/assets/caret-bottom.svg";
      }
    };
    document.addEventListener("click", window.__roleCascaderOutside);
    const notificationButton = document.getElementById("top-notification-trigger");
    const notificationPopover = document.getElementById("notification-popover");
    notificationButton.addEventListener("click", event => {
      event.stopPropagation();
      state.notificationOpen = notificationPopover.hidden;
      notificationPopover.hidden = !state.notificationOpen;
      notificationButton.setAttribute("aria-expanded", String(state.notificationOpen));
    });
    notificationPopover.querySelectorAll("[data-notification-page]").forEach(button => button.addEventListener("click", () => {
      state.notificationOpen = false;
      notificationPopover.hidden = true;
      notificationButton.setAttribute("aria-expanded", "false");
      navigate(button.dataset.notificationPage);
    }));
    if (window.__notificationOutside) document.removeEventListener("click", window.__notificationOutside);
    window.__notificationOutside = event => {
      if (!event.target.closest(".top-notification")) {
        state.notificationOpen = false;
        notificationPopover.hidden = true;
        notificationButton.setAttribute("aria-expanded", "false");
      }
    };
    document.addEventListener("click", window.__notificationOutside);    const userMenuButton = document.getElementById("app-user-menu");
    const userDropdown = document.querySelector(".app-user-dropdown");
    userMenuButton.addEventListener("click", event => { event.stopPropagation(); const open = userDropdown.hidden; userDropdown.hidden = !open; userMenuButton.setAttribute("aria-expanded", String(open)); });
    userDropdown.querySelectorAll("[data-user-action]").forEach(button => button.addEventListener("click", () => { userDropdown.hidden = true; userMenuButton.setAttribute("aria-expanded", "false"); toast(`${button.dataset.userAction}为原型占位入口`); }));
    if (window.__userMenuOutside) document.removeEventListener("click", window.__userMenuOutside);
    window.__userMenuOutside = event => { if (!event.target.closest(".lib-top-user, .app-user-dropdown")) { userDropdown.hidden = true; userMenuButton.setAttribute("aria-expanded", "false"); } };
    document.addEventListener("click", window.__userMenuOutside);
    document.getElementById("mobile-menu").addEventListener("click", () => {
      state.menuOpen = !state.menuOpen;
      document.querySelector(".app-shell").classList.toggle("menu-open", state.menuOpen);
    });
  }

  function bindFilterCollapsibles() {
    document.querySelectorAll(".filter-panel").forEach((panel,index) => {
      if (panel.dataset.filterCollapsibleBound === "true") return;
      panel.dataset.filterCollapsibleBound = "true";
      panel.classList.add("is-collapsible");
      const body = document.createElement("div");
      body.className = "filter-collapse-body";
      body.id = "filter-collapse-" + state.page + "-" + index;
      while (panel.firstChild) body.appendChild(panel.firstChild);
      const head = document.createElement("div");
      head.className = "filter-collapse-head";
      head.innerHTML = '<button type="button" class="filter-collapse-toggle" aria-expanded="true" aria-controls="' + body.id + '"><span>折叠筛选</span><img src="ui/assets/caret-top.svg" alt=""></button>';
      panel.append(head,body);
      const toggle = head.querySelector(".filter-collapse-toggle");
      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!expanded));
        toggle.querySelector("span").textContent = expanded ? "展开筛选" : "折叠筛选";
        toggle.querySelector("img").src = "ui/assets/" + (expanded ? "caret-bottom.svg" : "caret-top.svg");
        body.hidden = expanded;
        panel.classList.toggle("is-collapsed", expanded);
      });
    });
  }

  function bindDisabledReasonTooltips() {
    document.querySelector(".disabled-reason-tooltip")?.remove();
    const tooltip = document.createElement("div");
    tooltip.className = "disabled-reason-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    const hide = () => { tooltip.hidden = true; };
    const show = trigger => {
      tooltip.textContent = trigger.dataset.tooltip || "当前状态或权限无法发起";
      tooltip.hidden = false;
      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const halfWidth = tooltipRect.width / 2;
      const left = Math.min(window.innerWidth - halfWidth - 12, Math.max(halfWidth + 12, triggerRect.left + triggerRect.width / 2));
      let top = triggerRect.top - tooltipRect.height - 10;
      let placement = "top";
      if (top < 8) { top = triggerRect.bottom + 10; placement = "bottom"; }
      tooltip.style.left = left + "px";
      tooltip.style.top = top + "px";
      tooltip.dataset.placement = placement;
    };
    document.querySelectorAll(".disabled-reason-trigger[data-tooltip]").forEach(trigger => {
      trigger.addEventListener("mouseenter", () => show(trigger));
      trigger.addEventListener("mouseleave", hide);
      trigger.addEventListener("focus", () => show(trigger));
      trigger.addEventListener("blur", hide);
    });
  }

  function bindActionButtons(scope = document) {
    scope.querySelectorAll("[data-action]").forEach(btn => {
      if (btn.dataset.actionBound === "true") return;
      btn.dataset.actionBound = "true";
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "customer-path-level") {
          state.customerProfilePathFilter = btn.getAttribute("aria-pressed") === "true" ? "" : (btn.dataset.id || "");
          state.customerProfileTypeFilter = "";
          state.historyTicketId = "";
          rerenderPage();
          return;
        }
        if (action === "customer-type-filter") {
          state.customerProfileTypeFilter = btn.getAttribute("aria-pressed") === "true" ? "" : (btn.dataset.id || "");
          state.customerProfilePathFilter = "";
          state.historyTicketId = "";
          rerenderPage();
          return;
        }
        if (action === "customer-path-clear") {
          state.customerProfilePathFilter = "";
          state.customerProfileTypeFilter = "";
          state.historyTicketId = "";
          rerenderPage();
          return;
        }
        if (action === "admin-switch-toggle") {
          const enabled = !btn.classList.contains("is-on");
          btn.classList.toggle("is-on", enabled);
          btn.setAttribute("aria-checked", String(enabled));
          toast((btn.dataset.id || "开关") + "已" + (enabled ? "启用" : "停用"));
          return;
        }
        handleAction(action, btn.dataset.id, btn.dataset.customerScope, btn.dataset.subprocessType, btn);
      });
    });
  }

  function applyRegulatoryStats() {
    const controls = {};
    const scopes = ["", "customer.1."];
    scopes.forEach(prefix => {
      ["向机构投诉次数", "监管转送次数", "是否向机构进行过投诉"].forEach(name => {
        const el = document.querySelector('input[data-field-key="' + prefix + name + '"]');
        if (el) controls[name] = { el, prefix };
      });
    });
    if (!controls["向机构投诉次数"] && !controls["监管转送次数"]) return;
    const customer = state.formValues["customer.1.客户姓名"] || "";
    const selfChannels = ["客服电话", "在线客服", "总行投诉邮箱", "机构专线电话", "营业网点", "客户意见簿", "信函", "金融消费者保护服务平台", "市长热线", "其它"];
    const rows = customer ? ticketRows.filter(record => record[2] === customer) : ticketRows;
    const toOrgCount = rows.filter(record => selfChannels.includes(ticketAcceptanceChannel(record))).length;
    const regulatoryCount = rows.filter(record => FINANCIAL_REGULATORY_BUREAUS.includes(ticketAcceptanceChannel(record))).length;
    const setField = (name, value) => {
      const ctrl = controls[name];
      if (!ctrl) return;
      const key = ctrl.prefix + name;
      if (state.formValues[key] !== undefined && state.formValues[key] !== "") return;
      state.formValues[key] = value;
      ctrl.el.value = value;
    };
    setField("向机构投诉次数", String(toOrgCount));
    setField("监管转送次数", String(regulatoryCount));
    setField("是否向机构进行过投诉", toOrgCount ? "是" : "否");
  }

  function bindHierarchyCascaders(scope = document) {
    scope.querySelectorAll("[data-app-hierarchy-cascader]").forEach(host => {
      if (host.dataset.hierarchyBound === "true") return;
      host.dataset.hierarchyBound = "true";
      const dictionary = host.dataset.dictionary;
      const multiple = host.dataset.multiple === "true";
      const maxSelections = Number(host.dataset.maxSelections || 0);
      const nonLeaf = host.dataset.nonLeaf === "true";
      const leafLevel = Number(host.dataset.leafLevel || 2);
      const levels = JSON.parse(host.dataset.levels || "[]");
      const tree = hierarchyTreeFor(dictionary);
      const field = { tree, levels, leafLevel, dictionary, multiple, nonLeafSelectable: nonLeaf, includeDescendantsOption: host.dataset.includeDescendants === "true", searchable: host.dataset.searchable === "true", showSelectedSummary: host.dataset.showSelectedSummary === "true", summaryLevels:Number(host.dataset.summaryLevels || 0), placeholder: host.dataset.placeholder || (dictionary === "institutionTree" ? "请选择机构范围" : "请选择") };
      const trigger = host.querySelector(".di-hierarchy-cascader-trigger");
      const popover = host.querySelector(".di-hierarchy-cascader-popover");
      const columns = host.querySelector("[data-hierarchy-columns]");
      const selectedHolder = host.querySelector("[data-hierarchy-selected]");
      const hidden = host.querySelector('input[type="hidden"]');
      const searchInput = host.querySelector("[data-hierarchy-search]");
      const searchResults = host.querySelector("[data-hierarchy-search-results]");
      const storedValue = state.formValues[host.dataset.fieldKey];
      const initialValues = storedValue === undefined ? String(hidden?.value || "").split(",").filter(Boolean) : (Array.isArray(storedValue) ? [...storedValue] : [storedValue].filter(Boolean));
      let selected = multiple ? normalizeHierarchySelection(field, initialValues) : initialValues.slice(0, 1);
      let activePath = JSON.parse(host.dataset.activePath || "[]");
      const sync = () => {
        state.formValues[host.dataset.fieldKey] = multiple ? [...selected] : (selected[0] || "");
        syncAiSingleCandidateSelection(host.dataset.fieldKey, selected[0] || "");
        syncCorrectionFieldHighlight(hidden, state.formValues[host.dataset.fieldKey]);
        hidden.value = selected.join(',');
        syncInstitutionDepartmentControls(host.closest(".overlay-card") || document, host.dataset.fieldKey);
        trigger.querySelector('span').innerHTML = isCountersignInstitutionKey(host.dataset.fieldKey)
          ? countersignTriggerValues(selected, selected.map(value => hierarchySelectionLabel(value, field.dictionary)), field.placeholder || "请选择")
          : escapeAttribute(selected.length ? hierarchyCollapsedSummary(field, selected) : hierarchyCollapsedSummary(field, selected));
        selectedHolder.innerHTML = hierarchySelectedTags(selected, true, field?.dictionary);
        columns.innerHTML = hierarchyColumnsHtml(field, activePath, selected);
        if (searchInput?.value.trim()) searchResults.innerHTML = hierarchySearchResultsHtml(field, searchInput.value, selected);
      };
      const updateSearch = () => {
        if (!searchInput || !searchResults) return;
        const query = searchInput.value.trim();
        searchResults.hidden = !query;
        columns.hidden = Boolean(query);
        searchResults.innerHTML = query ? hierarchySearchResultsHtml(field, query, selected) : "";
      };
      searchInput?.addEventListener("input", updateSearch);
      const applyStatisticsFilter = () => {
        const match = host.dataset.fieldKey.match(/^rectification-statistics-filter\.([^.]+)\.(product|cause)$/);
        if (!match) return false;
        const rowId = match[1];
        const current = state.rectificationStatsFilters[rowId];
        const filterState = Array.isArray(current) ? { products: current, cause: "" } : { products: [], cause: "", ...(current || {}) };
        if (match[2] === "product") filterState.products = [...selected];
        else filterState.cause = selected[0] || "";
        state.rectificationStatsFilters[rowId] = filterState;
        rerenderPage();
        return true;
      };
      trigger.addEventListener('click', event => { event.stopPropagation(); document.querySelectorAll('.di-hierarchy-cascader-popover,.di-select-popover,.di-picker-popover,.di-cascader-popover').forEach(panel => { if (panel !== popover) panel.hidden = true; }); popover.hidden = !popover.hidden; if (!popover.hidden) positionHierarchyPopover(trigger, popover); });
      popover.addEventListener('click', event => {
        event.stopPropagation();
        const parent = event.target.closest('[data-hierarchy-parent]');
        const leaf = event.target.closest('[data-hierarchy-toggle]');
        const searchLeaf = event.target.closest('[data-hierarchy-search-toggle]');
        const remove = event.target.closest('[data-hierarchy-remove]');
        const descendants = event.target.closest('[data-hierarchy-descendants]');
        if (descendants) { const parentLabel = descendants.dataset.hierarchyDescendants; const branchValues = hierarchyBranchLeafValues(field, parentLabel); const groupValue = hierarchyDescendantGroupValue(parentLabel); selected = selected.filter(item => item !== groupValue && !branchValues.includes(item)); if (descendants.checked) selected.push(groupValue); selected = normalizeHierarchySelection(field, selected); activePath = [parentLabel, branchValues[0]?.split(' / ').at(-1) || parentLabel]; clearAiHighlight(host.dataset.fieldKey); sync(); return; }
        if (parent) { const level = Number(parent.dataset.hierarchyLevel); activePath.splice(level); activePath[level] = parent.dataset.hierarchyParent; const node = hierarchyNode(field.tree, activePath); if (node?.children?.length) activePath[level + 1] = node.children[0].label; if (nonLeaf) { const value = activePath.slice(0, level + 1).join(' / '); selected = multiple ? (selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]) : [value]; } sync(); return; }
        if (leaf || searchLeaf) { const value = leaf?.dataset.hierarchyToggle || searchLeaf.dataset.hierarchySearchToggle; if (maxSelections && !selected.includes(value) && selected.length >= maxSelections) return toast("每类标签最多选择" + maxSelections + "个", true); selected = toggleHierarchySelection(field, selected, value); if (!multiple) popover.hidden = true; activePath = value.split(' / '); clearAiHighlight(host.dataset.fieldKey); sync(); if (!multiple && applyStatisticsFilter()) return; if (!multiple && host.dataset.fieldKey === "subprocess.异议核查.接收机构") { state.formValues["subprocess.异议核查.接收部门"] = ""; state.formValues["subprocess.异议核查.处置员"] = ""; rerenderPage(); return; } if (!multiple && host.dataset.fieldKey === "subprocess.投诉问责.问责机构") { state.formValues["subprocess.投诉问责.问责部门"] = ""; state.formValues["subprocess.投诉问责.问责对象"] = ""; rerenderPage(); return; } if (!multiple && host.dataset.fieldKey.split('.').pop() === "投诉/信访/表扬机构") { rerenderPage(); return; } return; }
        if (remove) { selected = selected.filter(item => item !== remove.dataset.hierarchyRemove); clearAiHighlight(host.dataset.fieldKey); sync(); }
      });
      host.addEventListener("xib:hierarchy-set", event => {
        const values = Array.isArray(event.detail) ? event.detail : [];
        selected = multiple ? normalizeHierarchySelection(field, values) : values.slice(0, 1);
        activePath = hierarchyInitialPath(field, selected);
        sync();
      });
      host.addEventListener("xib:hierarchy-reset", () => {
        selected = [];
        activePath = hierarchyInitialPath(field, selected);
        if (searchInput) searchInput.value = "";
        sync();
        updateSearch();
      });
      host.querySelector('[data-hierarchy-clear]')?.addEventListener('click', event => { event.stopPropagation(); selected = []; clearAiHighlight(host.dataset.fieldKey); sync(); if (applyStatisticsFilter()) return; if (host.dataset.fieldKey.split('.').pop() === "投诉/信访/表扬机构") rerenderPage(); });
      host.querySelector('[data-hierarchy-confirm]')?.addEventListener('click', event => {
        event.stopPropagation();
        sync();
        popover.hidden = true;
        if (["filter.ticket.org", "filter.approval.ticket.org"].includes(host.dataset.fieldKey)) { rerenderPage(); return; }
        applyStatisticsFilter();
      });
    });
  }

  function bindAiTagEditors(scope = document) {
    scope.querySelectorAll('[data-app-ai-tag-editor]').forEach(host => {
      const key = host.dataset.fieldKey;
      const dictionary = host.dataset.dictionary;
      const field = { dictionary, tree:hierarchyTreeFor(dictionary), leafLevel:Number(host.dataset.leafLevel || 1), levels:JSON.parse(host.dataset.levels || '[]'), multiple:false };
      const panel = host.querySelector('.ai-tag-shared-panel');
      const columns = host.querySelector('[data-ai-tag-columns]');
      const title = host.querySelector('[data-ai-tag-panel-title]');
      let activeSlot = 0;
      let activePath = [];
      const values = () => {
        const stored = state.formValues[key];
        return Array.isArray(stored) ? [...stored] : (stored ? [stored] : []);
      };
      const draw = () => {
        title.textContent = '正在编辑第 ' + (activeSlot + 1) + ' 个标签';
        columns.innerHTML = hierarchyColumnsHtml(field, activePath, [values()[activeSlot]].filter(Boolean));
        host.querySelectorAll('[data-ai-tag-edit]').forEach(button => button.classList.toggle('is-active', Number(button.dataset.aiTagEdit) === activeSlot && !panel.hidden));
      };
      host.addEventListener('click', event => {
        const move = event.target.closest('[data-ai-tag-move]');
        if (move) {
          const index = Number(move.dataset.aiTagMove);
          const target = index + (move.dataset.direction === 'up' ? -1 : 1);
          const next = values();
          if (target < 0 || target >= next.length) return;
          // 标签、来源和高亮标记一起移动，保存后的重要性顺序与页面一致。
          [next[index], next[target]] = [next[target], next[index]];
          for (const items of [state.aiTagProvenance[key], state.aiTagSources[key]]) {
            if (items) [items[index], items[target]] = [items[target], items[index]];
          }
          state.formValues[key] = next;
          // 排序操作需要立即刷新，确保保存顺序和当前页面展示同步。
          rerenderPage(false, { instant:true });
          return;
        }
        const remove = event.target.closest('[data-ai-tag-remove]');
        if (remove) {
          const index = Number(remove.dataset.aiTagRemove);
          const next = values();
          next.splice(index, 1);
          state.aiTagProvenance[key]?.splice(index, 1);
          state.aiTagSources[key]?.splice(index, 1);
          state.formValues[key] = next;
          state.aiTagSlotCounts[key] = Math.max(1, next.length);
          clearAiHighlight(key);
          rerenderPage();
          return;
        }
        const edit = event.target.closest('[data-ai-tag-edit],[data-ai-tag-main-edit]');
        if (edit) {
          const isMainSelector = edit.hasAttribute('data-ai-tag-main-edit');
          const currentValues = values();
          if (isMainSelector && currentValues.length >= 3) {
            toast("每类标签最多选择3个", true);
            return;
          }
          const slot = isMainSelector ? currentValues.length : Number(edit.dataset.aiTagEdit);
          // 点击标签或新增入口一律展开面板并定位到对应标签；再次点击保持展开，关闭统一走面板右上角 ×。
          // 之前的同序号 toggle 会让“点标签”变成收起，看起来像点击无反应。
          document.querySelectorAll('.ai-tag-shared-panel').forEach(other => { if (other !== panel) other.hidden = true; });
          activeSlot = slot;
          activePath = hierarchyInitialPath(field, [values()[slot]].filter(Boolean));
          panel.hidden = false;
          draw();
          // 面板在标签下方内联展开，标签贴近视口底部时会被挤出可视区，这里把它带回可见范围。
          requestAnimationFrame(() => {
            const rect = panel.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) panel.scrollIntoView({ block: "nearest" });
          });
          return;
        }
        if (event.target.closest('[data-ai-tag-panel-close]')) { panel.hidden = true; draw(); return; }
        const parent = event.target.closest('[data-hierarchy-parent]');
        if (parent && panel.contains(parent)) {
          const level = Number(parent.dataset.hierarchyLevel);
          activePath.splice(level);
          activePath[level] = parent.dataset.hierarchyParent;
          const node = hierarchyNode(field.tree, activePath);
          if (node?.children?.length) activePath[level + 1] = node.children[0].label;
          draw();
          return;
        }
        const leaf = event.target.closest('[data-hierarchy-toggle]');
        if (leaf && panel.contains(leaf)) {
          const next = values();
          const selectedValue = leaf.dataset.hierarchyToggle;
          const duplicateIndex = next.indexOf(selectedValue);
          if (duplicateIndex >= 0 && duplicateIndex !== activeSlot) {
            toast("该标签已选择", true);
            return;
          }
          next[activeSlot] = selectedValue;
          state.formValues[key] = next;
          if (!state.aiTagProvenance[key]) state.aiTagProvenance[key] = [];
          state.aiTagProvenance[key][activeSlot] = false;
          if (!state.aiTagSources[key]) state.aiTagSources[key] = [];
          state.aiTagSources[key][activeSlot] = state.aiClassificationReady ? '人工添加' : '用户已选';
          state.aiTagSlotCounts[key] = Math.max(1, next.length);
          clearAiHighlight(key);
          rerenderPage();
        }
      });
    });
  }

  function bindPageEvents() {
    bindPageNavigation(document.getElementById("page-root"));
    document.querySelector("[data-manual-risk-category]")?.addEventListener("change", event => {
      const options = MANUAL_RISK_TAG_OPTIONS.filter(item => item.category === event.target.value);
      const labelSelect = document.querySelector("[data-manual-risk-label]");
      if (labelSelect) labelSelect.innerHTML = options.map(item => '<option value="' + escapeAttribute(item.label) + '">' + escapeAttribute(item.label) + '</option>').join("");
      const level = document.querySelector("[data-manual-risk-level]");
      if (level) level.textContent = (options[0]?.level || "-") + "风险";
    });
    document.querySelector("[data-manual-risk-label]")?.addEventListener("change", event => {
      const item = MANUAL_RISK_TAG_OPTIONS.find(option => option.label === event.target.value);
      const level = document.querySelector("[data-manual-risk-level]");
      if (level) level.textContent = (item?.level || "-") + "风险";
    });
    bindFilterCollapsibles();
    bindDisabledReasonTooltips();
    bindHierarchyCascaders();
    bindAiTagEditors();
    document.querySelectorAll('[data-ai-tag-quick-add]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.aiTagQuickAdd;
      const value = button.dataset.aiTagQuickValue;
      const current = Array.isArray(state.formValues[key]) ? [...state.formValues[key]] : (state.formValues[key] ? [state.formValues[key]] : []);
      if (current.includes(value)) return;
      if (current.length >= 3) return toast("每类标签最多选择3个", true);
      current.push(value);
      state.formValues[key] = current;
      if (!state.aiTagProvenance[key]) state.aiTagProvenance[key] = [];
      state.aiTagProvenance[key].push(true);
      if (!state.aiTagSources[key]) state.aiTagSources[key] = [];
      state.aiTagSources[key].push('模型返回');
      state.aiTagSlotCounts[key] = current.length;
      rerenderPage();
    }));
    document.querySelectorAll('[data-ai-candidate-key]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.aiCandidateKey;
      const value = button.dataset.aiCandidateValue;
      if (!AI_SINGLE_FIELD_NAMES.includes(key) || !state.aiClassificationSuggestions[key]?.includes(value)) return;
      state.formValues[key] = value;
      state.aiGeneratedFields.add(key);
      if (key === '被投诉业务类别') {
        const path = value.split(' / ');
        ['被投诉业务类别1', '被投诉业务类别2', '被投诉业务类别3'].forEach((linkedKey, index) => { state.formValues[linkedKey] = path[index] || '/'; });
      }
      rerenderPage();
    }));
    document.querySelectorAll("[data-app-multi-cascader]").forEach(host => {
      const trigger = host.querySelector(".di-multi-cascader-trigger");
      const popover = host.querySelector(".di-multi-cascader-popover");
      const hidden = host.querySelector('input[type="hidden"]');
      const sync = () => {
        const values = [...host.querySelectorAll("[data-multi-cascader-value]:checked")].map(input => input.dataset.multiCascaderValue);
        state.formValues[host.dataset.fieldKey] = values;
        hidden.value = values.join(",");
        trigger.querySelector("span").textContent = values.length ? values.join("、") : "请选择产品标签";
      };
      trigger.addEventListener("click", event => { event.stopPropagation(); popover.hidden = !popover.hidden; });
      host.querySelectorAll("[data-multi-cascader-value]").forEach(input => input.addEventListener("change", sync));
      host.querySelector("[data-multi-cascader-clear]")?.addEventListener("click", () => { host.querySelectorAll("[data-multi-cascader-value]").forEach(input => { input.checked = false; }); sync(); });
      host.querySelector("[data-multi-cascader-confirm]")?.addEventListener("click", () => { sync(); popover.hidden = true; });
    });
    document.querySelectorAll("[data-create-tab]").forEach(btn => btn.addEventListener("click", () => { state.createTab = btn.dataset.createTab; state.pagination = { ...(state.pagination || {}), "created-tickets":1, "auto-drafts":1, "manual-drafts":1, "import-jobs":1 }; rerenderPage(); }));
    document.querySelectorAll("[data-pagination-page]").forEach(btn => btn.addEventListener("click", () => { if (btn.disabled) return; const scope = btn.closest("[data-pagination-scope]")?.dataset.paginationScope || "default"; if (!state.pagination) state.pagination = {}; state.pagination[scope] = Number(btn.dataset.paginationPage) || 1; rerenderPage(); }));
    document.querySelectorAll("[data-pagination-size]").forEach(select => select.addEventListener("change", () => { const scope = select.closest("[data-pagination-scope]")?.dataset.paginationScope || "default"; if (!state.pagination) state.pagination = {}; state.pagination[scope + ":pageSize"] = Number(select.value) || 8; state.pagination[scope] = 1; rerenderPage(); }));
    document.querySelectorAll("[data-pagination-jump]").forEach(input => input.addEventListener("keydown", event => { if (event.key !== "Enter") return; event.preventDefault(); const scope = input.closest("[data-pagination-scope]")?.dataset.paginationScope || "default"; if (!state.pagination) state.pagination = {}; state.pagination[scope] = Math.max(1, Number(input.value) || 1); rerenderPage(); }));
    document.querySelectorAll("[data-sort-scope]").forEach(btn => btn.addEventListener("click", () => sortTableInPlace(btn)));
    bindBulkSelection();
    enhanceTableColumnSettings();
   document.querySelectorAll("[data-subprocess-tab]").forEach(btn => btn.addEventListener("click", () => { state.subprocessTab = btn.dataset.subprocessTab; rerenderPage(); }));
    document.querySelectorAll("[data-subprocess-create-tab]").forEach(btn => btn.addEventListener("click", () => { state.subprocessCreateTab = btn.dataset.subprocessCreateTab; if (!state.pagination) state.pagination = {}; state.pagination["subprocess-create"] = 1; rerenderPage(); }));
    document.querySelectorAll("[data-query-tab]").forEach(btn => btn.addEventListener("click", () => { state.queryTab = btn.dataset.queryTab; rerenderPage(); }));
    document.querySelectorAll("[data-query-subprocess-type]").forEach(select => select.addEventListener("change", () => { state.querySubprocessType = select.value; rerenderPage(); }));
    bindComplaintExclusionRules(document, (selected, scope) => {
      if (scope !== "query") return;
      state.queryComplaintQuickFilters = selected;
      if (!state.pagination) state.pagination = {};
      state.pagination["query-tickets"] = 1;
      rerenderPage();
    });
    document.querySelectorAll("[data-process-ticket-type]").forEach(select => select.addEventListener("change", event => {
      state.processTicketType = event.currentTarget.value;
      const row = document.querySelector(".process-ticket-filter-panel .is-conditional-row");
      if (row) row.hidden = !["投诉单"].includes(state.processTicketType);
    }));
    document.querySelectorAll("[data-receiving-department-filter]").forEach(select => select.addEventListener("change", event => {
      state.receivingDepartmentFilters[event.currentTarget.dataset.receivingDepartmentFilter] = event.currentTarget.value;
      if (!state.pagination) state.pagination = {};
      state.pagination["created-tickets"] = 1;
      state.pagination["process-tickets"] = 1;
      state.pagination["approvals-ticket"] = 1;
      state.pagination["approval-pool-ticket"] = 1;
      rerenderPage();
    }));
    document.querySelectorAll("[data-query-ticket-type]").forEach(select => select.addEventListener("change", event => {
      state.queryTicketType = event.currentTarget.value;
    }));
    document.querySelectorAll("[data-subprocess-type]").forEach(btn => btn.addEventListener("click", () => { if (btn.disabled) return; state.subprocessType = btn.dataset.subprocessType; const applicationTime = state.formValues["子流程-申请时间"] || ""; state.formValues = { "子流程-申请时间": applicationTime }; rerenderPage(); }));
    document.querySelectorAll("[data-subprocess-scope]").forEach(btn => btn.addEventListener("click", () => { state.subprocessScope = btn.dataset.subprocessScope; state.subprocessTab = "待办"; rerenderPage(); }));
    document.querySelectorAll("[data-process-tab]").forEach(btn => btn.addEventListener("click", () => { state.processTab = btn.dataset.processTab; rerenderPage(); }));
    document.querySelectorAll("[data-subprocess-tab]").forEach(btn => btn.addEventListener("click", () => { state.subprocessTab = btn.dataset.subprocessTab; rerenderPage(); }));
    document.querySelectorAll("[data-scope]").forEach(btn => btn.addEventListener("click", () => { state.processScope = btn.dataset.scope; state.processTab = "待办"; rerenderPage(); }));
    document.querySelectorAll("[data-approval-tab]").forEach(btn => btn.addEventListener("click", () => { state.approvalTab = btn.dataset.approvalTab; state.approvalWorkTab = "待办"; state.approvalFilterType = ""; if (!state.pagination) state.pagination = {}; state.pagination.approvals = 1; rerenderPage(); }));
    document.querySelectorAll("[data-approval-work-tab]").forEach(btn => btn.addEventListener("click", () => { state.approvalWorkTab = btn.dataset.approvalWorkTab; if (!state.pagination) state.pagination = {}; state.pagination.approvals = 1; rerenderPage(); }));
    document.querySelectorAll("[data-approval-pool-tab]").forEach(btn => btn.addEventListener("click", () => { state.approvalPoolTab = btn.dataset.approvalPoolTab; state.approvalWorkTab = "待办"; state.approvalFilterType = ""; if (!state.pagination) state.pagination = {}; state.pagination["approval-pool"] = 1; rerenderPage(); }));
    document.querySelectorAll("[data-approval-scope]").forEach(btn => btn.addEventListener("click", () => { state.approvalScope = btn.dataset.approvalScope; state.approvalWorkTab = "待办"; if (!state.pagination) state.pagination = {}; state.pagination.approvals = 1; state.pagination["approval-pool"] = 1; rerenderPage(); }));
    document.querySelectorAll("[data-approval-filter-type]").forEach(select => select.addEventListener("change", () => { state.approvalFilterType = select.value; rerenderPage(); }));
    document.querySelectorAll("[data-request-approval-tab]").forEach(btn => btn.addEventListener("click", () => { state.requestApprovalTab = btn.dataset.requestApprovalTab; rerenderPage(); }));
    document.querySelectorAll("[data-detail-tab]").forEach(btn => btn.addEventListener("click", () => {
      state.detailTab = btn.dataset.detailTab;
      state.correctionTagEditing = "";
      state.businessLineEditing = "";
      if (["客户画像", "历史工单"].includes(state.detailTab)) { state.customerProfilePathFilter = ""; state.customerProfileTypeFilter = ""; state.historyTicketId = customerHistoryRecords(ticketRowById(state.detailId) || ticketRows[0])[0]?.id || ""; }
      if (["关联单据", "关联工单"].includes(state.detailTab)) {
        state.relatedRootTicketId = state.detailId;
        if (!state.relatedItemId || !relatedWorkItems(state.relatedRootTicketId, ticketRowById(state.detailId) || ticketRows[0]).some(item => item.id === state.relatedItemId)) state.relatedItemId = "";
      }
      rerenderPage();
    }));
    document.querySelectorAll("[data-history-ticket]").forEach(btn => btn.addEventListener("click", () => { state.historyTicketId = btn.dataset.historyTicket; rerenderPage(); }));
    document.querySelectorAll("[data-subprocess-detail-tab]").forEach(btn => btn.addEventListener("click", () => {
      state.subprocessDetailTab = btn.dataset.subprocessDetailTab;
      if (["关联单据", "关联工单"].includes(state.subprocessDetailTab)) {
        const row = [...subprocessRows, ...rectificationRows].find(item => item[0] === state.subprocessId);
        if (row) {
          state.relatedRootTicketId = row[2];
          state.relatedSourceSubprocessId = row[0];
          state.subprocessRelatedContextId = row[0];
          state.relatedItemId = row[2];
        }
      }
      rerenderPage();
    }));
    document.querySelectorAll("[data-related-item]").forEach(button => button.addEventListener("click", () => { state.relatedItemId = button.dataset.relatedItem; rerenderPage(); }));
    document.querySelectorAll("[data-simple-tab]").forEach(btn => btn.addEventListener("click", () => { btn.parentElement.querySelectorAll(".tab").forEach(t=>t.classList.remove("is-active")); btn.classList.add("is-active"); }));
    bindActionButtons(document);
    window.XIBModuleRegistry?.afterRender(document.getElementById("page-root"), state.page, moduleContext());
    window.XIBComplaintInspections?.bindInspectionRetry(document.getElementById("page-root"));

    document.querySelectorAll('[data-workflow-readonly="true"]').forEach(surface => {
      const selectors = ['input','select','textarea','button[data-action="add-contact"]','button[data-action="send-sms"]','button[data-action="call-customer"]','button[data-action="smart-classify"]','button[data-action="process-linked-subprocess"]','button[data-action="review-linked-subprocess"]','button[data-action="approve-linked-subprocess"]'];
      if (surface.dataset.workflowCanStartSubprocess !== "true") selectors.push('button[data-action="quick-subprocess"]');
      surface.querySelectorAll(selectors.join(",")).forEach(control => {
        // 人工补充的枚举选择可在审批页面使用。
        if (control.closest(".risk-manual-controls")) return;
        control.disabled = true;
      });
    });
    document.querySelectorAll("[data-drag-upload]").forEach(box => {
      const input = box.querySelector("[data-upload-input]");
      const browse = box.querySelector("[data-upload-browse]");
      const status = box.querySelector("[data-upload-status]");
      const selectFile = files => {
        const result = validateAttachmentSelection(files);
        if (!result.ok) return toast(result.message, true);
        const names = result.files.map(file => file.name);
        const appendResult = appendProcessingAttachmentFiles(box, names);
        if (appendResult.handled) {
          if (!appendResult.ok) return toast(appendResult.message, true);
          toast("已添加 " + names.length + " 个附件");
          return;
        }
        status.textContent = "已选择：" + names.join("、");
        browse.textContent = "重新选择";
        box.classList.add("has-file");
        if (box.dataset.fieldKey) state.formValues[box.dataset.fieldKey] = names.join("、");
        toast("已添加 " + names.length + " 个附件");
      };
      box.querySelector("[data-demo-upload]")?.addEventListener("click", event => { event.stopPropagation(); selectFile([{ name: event.currentTarget.dataset.demoFile, size:0 }]); });
      browse.addEventListener("click", event => { event.stopPropagation(); input.click(); });
      input.addEventListener("change", () => selectFile(input.files));
      box.addEventListener("click", event => { if (!event.target.closest("button")) input.click(); });
      box.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.click(); } });
      ["dragenter", "dragover"].forEach(type => box.addEventListener(type, event => { event.preventDefault(); box.classList.add("is-dragging"); }));
      box.addEventListener("dragleave", () => box.classList.remove("is-dragging"));
      box.addEventListener("drop", event => { event.preventDefault(); box.classList.remove("is-dragging"); selectFile(event.dataTransfer.files); });
      box.closest("[data-processing-attachment-control]")?.addEventListener("click", event => {
        const remove = event.target.closest("[data-processing-attachment-remove]");
        if (!remove) return;
        event.preventDefault();
        const names = processingAttachmentNames(state.formValues[box.dataset.fieldKey]).filter(name => name !== remove.dataset.processingAttachmentRemove);
        updateProcessingAttachmentControl(box, names);
      });
    });
    document.querySelectorAll("[data-customer-toggle]").forEach(button => button.addEventListener("click", () => {
      const number = Number(button.dataset.customerToggle);
      const card = button.closest("[data-customer-card]");
      const body = card.querySelector(".customer-card-body");
      const collapsed = !body.hidden;
      body.hidden = collapsed;
      card.classList.toggle("is-collapsed", collapsed);
      button.setAttribute("aria-expanded", String(!collapsed));
      button.querySelector(".customer-card-caret").src = `ui/assets/${collapsed ? "caret-bottom.svg" : "caret-top.svg"}`;
      if (collapsed) state.collapsedCustomers.add(number); else state.collapsedCustomers.delete(number);
    }));
    document.querySelector("[data-customer-add]")?.addEventListener("click", () => {
      const count = customerCount();
      if (count >= 10) return;
      state.formValues["投诉人数"] = String(count + 1);
      rerenderPage();
    });
    document.querySelectorAll("[data-customer-delete]").forEach(button => button.addEventListener("click", () => {
      openCustomerDeleteConfirmation(Number(button.dataset.customerDelete));
    }));
    bindBusinessLinePickers();
    document.querySelectorAll("[data-person-search]").forEach(bindPersonSearchControl);
    document.querySelectorAll("[data-app-select]").forEach(host => {
      const trigger = host.querySelector(".di-select-trigger"); const menu = host.querySelector(".di-select-popover"); const hidden = host.querySelector('input[type="hidden"]');
      bindSelectSearch(menu);
      trigger.addEventListener("click", event => { event.stopPropagation(); document.querySelectorAll(".di-select-popover,.di-picker-popover").forEach(pop => { if (pop !== menu) pop.hidden = true; }); menu.hidden = !menu.hidden; if (!menu.hidden) focusSelectSearch(menu); });
      menu.querySelectorAll("[data-select-value]").forEach(option => option.addEventListener("click", () => {
        const fieldKey = hidden.dataset.fieldKey;
        const previousValue = state.formValues[fieldKey] || "";
        const nextValue = option.dataset.selectValue;
        trigger.querySelector("span").textContent = nextValue;
        trigger.querySelector("span").classList.remove("is-ai-generated");
        hidden.value = nextValue;
        state.formValues[fieldKey] = nextValue;
        state.aiGeneratedFields.delete(fieldKey);
        syncAiSingleCandidateSelection(fieldKey, nextValue);
        syncCorrectionFieldHighlight(hidden, nextValue);
        menu.querySelectorAll("button").forEach(item => item.classList.toggle("is-active", item === option));
        menu.hidden = true;
        const linkedName = fieldKey.split(".").pop();
        if (linkedName === "客户类型") {
          resetPeopleBankTagsAfterCustomerTypeChange();
          rerenderPage();
          return;
        }
        if (linkedName === "国家地区") {
          const regionKey = fieldKey.replace(/国家地区$/, "居住地 省/市/区");
          if (nextValue === "中华人民共和国" && previousValue && previousValue !== nextValue) state.formValues[regionKey] = "";
          else if (nextValue && nextValue !== "中华人民共和国") state.formValues[regionKey] = "不清楚";
        }
        if (["异常投诉类型","异常投诉具体表现"].includes(linkedName)) {
          refreshLinkedFields(document, linkedName);
        } else if (["是否有客户编号","受理渠道","国家地区","产品类型","责任人","问责措施","调解成功","整改产品","问题来源","核查结果是否告知","是否超期","是否告知延期","告知延期时间","处理结果是否告知","告知沟通方式","告知时间","救济途径是否告知"].includes(linkedName)) {
          if (linkedName === "告知延期时间") syncExtensionNoticeMethod(fieldKey, nextValue);
          if (linkedName === "告知时间" && fieldKey.startsWith("processing.")) {
            const noticeScope = fieldKey.slice(0, -".告知时间".length);
            const noticeTicket = ticketRowById(noticeScope.slice("processing.".length));
            const contact = contactRecordsForTicket(noticeTicket).find(record => String(record.time || "").trim() === nextValue);
            state.formValues[noticeScope + ".告知沟通方式"] = contact?.method || "";
          }
          if (linkedName === "是否告知延期" && nextValue !== "是") {
            const scope = fieldKey.slice(0, -".是否告知延期".length);
            state.formValues[scope + ".告知延期时间"] = "";
            state.formValues[scope + ".告知延期方式"] = "";
            state.formValues[scope + "._selectedContactIndex"] = "";
          }
          if (linkedName === "告知沟通方式") {
            const scope = fieldKey.slice(0, -".告知沟通方式".length);
            state.formValues[scope + ".告知时间"] = "";
          }
          rerenderPage();
        }
      }));
    });
    document.querySelectorAll("[data-app-radio]").forEach(host => host.querySelectorAll("[data-radio-value]").forEach(button => button.addEventListener("click", () => {
      host.querySelectorAll("[data-radio-value]").forEach(item => item.classList.toggle("is-checked", item === button));
      const hidden = host.querySelector('input[type="hidden"]');
      hidden.value = button.dataset.radioValue;
      state.formValues[hidden.dataset.fieldKey] = hidden.value;
      state.aiGeneratedFields.delete(hidden.dataset.fieldKey);
      if (hidden.dataset.fieldKey === "客户类型") {
        resetPeopleBankTagsAfterCustomerTypeChange();
        rerenderPage();
        return;
      }
      if (state.importFieldErrors[hidden.dataset.fieldKey]) {
        delete state.importFieldErrors[hidden.dataset.fieldKey];
        host.closest(".form-item")?.classList.remove("has-import-error");
        host.closest(".form-item")?.querySelector("[data-import-field-error]")?.remove();
      }
      syncApprovalOpinionRequirement(host, hidden.value);
      if (["是否有客户编号","是否再次投诉","是否黑灰产投诉","是否要求整改","是否采纳","是否问责","调解成功","是否会签","是否告知延期","救济途径是否告知"].includes(hidden.dataset.fieldKey.split(".").pop())) rerenderPage();
    })));
    document.querySelectorAll("[data-app-checkbox-group]").forEach(host => host.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener("change", () => {
      state.formValues[host.dataset.fieldKey] = [...host.querySelectorAll('input:checked')].map(item => item.value); state.aiGeneratedFields.delete(host.dataset.fieldKey);
    })));
    document.querySelectorAll("[data-app-cascader]").forEach(host => {
      const trigger = host.querySelector(".di-cascader-trigger"); const popover = host.querySelector(".di-cascader-popover"); const columns = host.querySelector(".di-cascader-columns"); const hidden = host.querySelector('input[type="hidden"]'); const sourceKey = host.dataset.cascaderSource; host.dataset.cascadePath = JSON.stringify(hidden.value ? hidden.value.split(" / ") : []);
      trigger.addEventListener("click", event => { event.stopPropagation(); document.querySelectorAll(".di-select-popover,.di-picker-popover,.di-cascader-popover").forEach(pop => { if (pop !== popover) pop.hidden = true; }); popover.hidden = !popover.hidden; });
      columns.addEventListener("click", event => { const option = event.target.closest("[data-cascade-label]"); if (!option) return; event.stopPropagation(); const level = Number(option.dataset.cascadeLevel); const path = JSON.parse(host.dataset.cascadePath || "[]"); path.splice(level); path[level] = option.dataset.cascadeLabel; host.dataset.cascadePath = JSON.stringify(path); const node = cascadeNode(sourceKey, path); columns.innerHTML = cascadeColumnsHtml(sourceKey, path); if (!node?.children?.length) { const value = path.join(" / "); hidden.value = value; state.formValues[hidden.dataset.fieldKey] = value; syncAiSingleCandidateSelection(hidden.dataset.fieldKey, value); const linkedKeys = JSON.parse(host.dataset.cascaderLinked || "[]"); linkedKeys.forEach((linkedKey, index) => { state.formValues[linkedKey] = path[index] || "/"; }); state.aiGeneratedFields.delete(hidden.dataset.fieldKey); syncCorrectionFieldHighlight(hidden, value); trigger.querySelector("span").textContent = value; trigger.querySelector("span").classList.remove("is-ai-generated"); popover.hidden = true; if (hidden.dataset.fieldKey === "subprocess.异议核查.接收机构") { state.formValues["subprocess.异议核查.接收部门"] = ""; state.formValues["subprocess.异议核查.处置员"] = ""; rerenderPage(); } } });
    });
    document.querySelectorAll("[data-app-year-picker]").forEach(host => {
      const trigger = host.querySelector(".di-year-trigger"); const popover = host.querySelector(".di-year-popover"); const grid = host.querySelector(".di-year-grid"); const title = host.querySelector("[data-year-title]"); const hidden = host.querySelector('input[type="hidden"]');
      const renderYears = () => { const start = Number(host.dataset.yearStart); title.textContent = start + ' 年 - ' + (start + 11) + ' 年'; grid.innerHTML = Array.from({ length: 12 }, (_, index) => { const year = String(start + index); return '<button type="button" class="' + (hidden.value === year ? 'is-active' : '') + '" data-year-value="' + year + '">' + year + '</button>'; }).join(''); };
      trigger.addEventListener("click", event => { event.stopPropagation(); document.querySelectorAll(".di-select-popover,.di-picker-popover,.di-cascader-popover,.di-year-popover").forEach(pop => { if (pop !== popover) pop.hidden = true; }); renderYears(); popover.hidden = !popover.hidden; });
      host.querySelector("[data-year-prev]").addEventListener("click", event => { event.stopPropagation(); host.dataset.yearStart = String(Number(host.dataset.yearStart) - 12); renderYears(); });
      host.querySelector("[data-year-next]").addEventListener("click", event => { event.stopPropagation(); host.dataset.yearStart = String(Number(host.dataset.yearStart) + 12); renderYears(); });
      grid.addEventListener("click", event => { const option = event.target.closest("[data-year-value]"); if (!option) return; event.stopPropagation(); hidden.value = option.dataset.yearValue; state.formValues[hidden.dataset.fieldKey] = hidden.value; trigger.querySelector("span").textContent = hidden.value; popover.hidden = true; });
      renderYears();
    });
    document.querySelectorAll("[data-app-picker]").forEach(host => bindPickerControl(host, document));
    document.querySelectorAll("[data-filter-status-multi]").forEach(host => {
      const label = host.dataset.filterStatusLabel || filterItemLabel(host);
      const key = host.dataset.filterMultiKey || filterStatusKey(label);
      const trigger = host.querySelector(".filter-status-trigger");
      const popover = host.querySelector(".filter-status-popover");
      const sync = () => {
        const values = [...host.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
        state.filterStatusMulti[key] = values;
        trigger.querySelector("span").textContent = filterMultiSummary(values);
        const count = host.querySelector("[data-filter-multi-count]");
        if (count) count.textContent = "\u5df2\u9009 " + values.length;
        host.querySelectorAll(".filter-status-option").forEach(option => {
          const input = option.querySelector('input[type="checkbox"]');
          option.classList.toggle("is-checked", Boolean(input?.checked));
        });
      };
      trigger?.addEventListener("click", event => { event.stopPropagation(); document.querySelectorAll(".di-select-popover,.di-picker-popover,.filter-status-popover").forEach(pop => { if (pop !== popover) pop.hidden = true; }); popover.hidden = !popover.hidden; if (!popover.hidden) { positionAnchoredPopover(trigger, popover, { flipVertical: true }); const search = host.querySelector("[data-filter-multi-search]"); if (search) { search.value = ""; search.dispatchEvent(new Event("input")); setTimeout(() => search.focus(), 0); } } });
      host.querySelector("[data-filter-multi-search]")?.addEventListener("input", event => {
        const query = event.currentTarget.value.toLocaleLowerCase().replace(/\s+/g, "");
        let visible = 0;
        host.querySelectorAll(".filter-status-option").forEach(option => {
          const matched = (option.dataset.filterOptionText || "").toLocaleLowerCase().replace(/\s+/g, "").includes(query);
          option.hidden = !matched;
          if (matched) visible += 1;
        });
        const empty = host.querySelector("[data-filter-multi-empty]");
        if (empty) empty.hidden = visible > 0;
      });
      host.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener("change", sync));
      host.querySelector("[data-filter-multi-clear]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); host.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; }); sync(); });
      host.querySelector("[data-filter-multi-confirm]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); popover.hidden = true; });
    });
    document.querySelectorAll("[data-app-range]").forEach(host => { const trigger = host.querySelector("[data-range-trigger]"); const menu = host.querySelector(".filter-range-popover"); trigger.addEventListener("click", event => { event.stopPropagation(); menu.hidden = !menu.hidden; }); menu.querySelectorAll("[data-range-value]").forEach(option => option.addEventListener("click", () => { trigger.querySelector("span").textContent = option.dataset.rangeValue; menu.hidden = true; })); });
    applyRegulatoryStats();
    if (window.__formPopupCloser) document.removeEventListener("click", window.__formPopupCloser);
    window.__formPopupCloser = event => { if (!event.target.closest(".di-custom-select,.di-native-select-shell,.di-picker-field,.di-cascader,.di-hierarchy-cascader,.di-year-picker,.filter-status-multi")) document.querySelectorAll(".di-select-popover,.di-picker-popover,.di-cascader-popover,.di-hierarchy-cascader-popover,.di-year-popover,.filter-status-popover").forEach(pop => pop.hidden = true); };
    document.addEventListener("click", window.__formPopupCloser);
    const typeSelect = document.getElementById("work-order-type");
    if (typeSelect) typeSelect.addEventListener("change", e => { state.workOrderType = e.target.value; state.formValues = {}; state.aiClassificationReady = false; state.aiTrsTags = {}; state.aiTagSuggestions = {}; state.aiTagSlotCounts = {}; state.aiTagProvenance = {}; state.aiTagSources = {}; state.aiClassificationSuggestions = {}; state.aiGeneratedFields.clear(); state.collapsedCustomers.clear(); rerenderPage(); if (state.workOrderType) toast(`已切换为${state.workOrderType}字段`); });
    document.querySelectorAll("[data-countersign-department-select]").forEach(host => {
      const trigger = host.querySelector("[data-countersign-department-trigger]");
      const menu = host.querySelector("[data-countersign-department-menu]");
      const hidden = host.querySelector('input[type="hidden"]');
      trigger?.addEventListener("click", event => { event.stopPropagation(); document.querySelectorAll("[data-countersign-department-menu]").forEach(item => { if (item !== menu) item.hidden = true; }); menu.hidden = !menu.hidden; });
      menu?.addEventListener("change", event => {
        if (!event.target.matches('input[type="checkbox"]')) return;
        const values = [...menu.querySelectorAll('input[type="checkbox"]:checked')].map(option => option.value);
        state.formValues[host.dataset.fieldKey] = values;
        hidden.value = values.join(",");
        const entries = countersignDepartmentEntries(state.formValues[host.dataset.countersignInstitutionKey]);
        const labels = values.map(value => entries.find(entry => entry.value === value)?.label || value);
        trigger.querySelector("span").innerHTML = countersignTriggerValues(values, labels, "请选择会签部门");
      });
    });
    bindAmountInputs(document);
    document.querySelectorAll("[data-field-key]").forEach(control => { if (["hidden","radio"].includes(control.type)) return; const update = () => { state.formValues[control.dataset.fieldKey] = control.multiple ? [...control.selectedOptions].map(option => option.value) : control.value; state.aiGeneratedFields.delete(control.dataset.fieldKey); control.classList.remove("is-ai-generated"); if (state.importFieldErrors[control.dataset.fieldKey]) { delete state.importFieldErrors[control.dataset.fieldKey]; control.closest(".form-item")?.classList.remove("has-import-error"); control.closest(".form-item")?.querySelector("[data-import-field-error]")?.remove(); if (state.activeImportDraftId && state.importDraftDataById[state.activeImportDraftId]) state.importDraftDataById[state.activeImportDraftId].fieldErrors = deepClone(state.importFieldErrors); } syncCorrectionFieldHighlight(control, state.formValues[control.dataset.fieldKey]); if (control.dataset.fieldKey === "派发部门") syncTicketDispatchCopyRecipients(control.closest("form") || document); if (control.dataset.fieldKey === "subprocess.异议核查.接收部门") rerenderPage(); if (control.dataset.fieldKey === "subprocess.投诉问责.问责部门") { state.formValues["subprocess.投诉问责.问责对象"] = ""; rerenderPage(); } }; control.addEventListener("input", update); if (control.multiple || ["subprocess.异议核查.接收部门", "subprocess.投诉问责.问责部门"].includes(control.dataset.fieldKey)) control.addEventListener("change", update); });
    document.querySelectorAll("[data-customer-manager-input]").forEach(input => {
      const box = input.closest(".customer-manager-autocomplete");
      const suggestions = box?.querySelector("[data-customer-manager-suggestions]");
      if (!suggestions || input.dataset.managerBound === "true") return;
      input.dataset.managerBound = "true";
      input.addEventListener("input", () => {
        const query = input.value.trim().replace(/\s+/g, "").toLocaleLowerCase();
        let visible = 0;
        suggestions.querySelectorAll("[data-customer-manager-option]").forEach(option => {
          const name = option.dataset.customerManagerOption.split("-")[0].replace(/\s+/g, "").toLocaleLowerCase();
          const matched = Boolean(query) && [...query].every(character => name.includes(character));
          option.hidden = !matched;
          if (matched) visible += 1;
        });
        suggestions.hidden = visible === 0;
      });
      suggestions.querySelectorAll("[data-customer-manager-option]").forEach(option => option.addEventListener("click", () => {
        input.value = option.dataset.customerManagerOption;
        input.dispatchEvent(new Event("input", { bubbles:true }));
        suggestions.hidden = true;
      }));
    });
    document.querySelectorAll("[data-anchor]").forEach(link => link.addEventListener("click", e => { e.preventDefault(); document.getElementById(`section-${link.dataset.anchor}`).scrollIntoView({ behavior: "smooth", block: "start" }); }));
    enhanceNativeSelects(document);
    observeNativeSelectMounts();
    bindAnchorObserver();
  }

  function bindPageNavigation(scope) {
    if (!scope) return;
    scope.querySelectorAll("[data-page]").forEach(btn => {
      if (btn.dataset.pageBound === "true") return;
      btn.dataset.pageBound = "true";
      btn.addEventListener("click", () => {
        if (btn.dataset.page === "ticket-form" && state.page !== "ticket-form") {
          state.ticketEditingId = "";
          state.ticketDraftSource = state.page === "ticket-create" ? (state.createTab || "") : "";
          state.workOrderType = "";
          state.formValues = customerServiceDraftChannelLocked() ? { "受理渠道":"客服电话" } : {};
          state.collapsedCustomers.clear();
        }
        if (btn.dataset.page === "subprocess-form") {
          state.subprocessEditingId = "";
          state.subprocessType = "";
          state.subprocessSourceTicket = "";
          state.subprocessSourceTickets = [];
          state.formValues = {};
        }
        if (btn.dataset.page === "my-approvals") state.approvalContext = null;
        window.XIBModuleRegistry?.reset?.(btn.dataset.page, moduleContext());
        state.detailEntry = "view";
        navigate(btn.dataset.page);
      });
    });
  }

  function batchRecordContext(scope, id) {
    if (scope === "auto-drafts") return { scope, id, kind:"autoDraft", row:autoDraftRows.find(row => row[0] === id) || null };
    if (scope === "manual-drafts") return { scope, id, kind:"manualDraft", row:manualDraftRows.find(row => row[0] === id) || null };
    if (scope === "import-records") return { scope, id, kind:"import", row:importRows.find(row => row[0] === id) || null };
    if (scope === "export-requests") return { scope, id, kind:"exportRequest", row:exportRequestRows.find(row => row[0] === id) || null };
    if (scope === "rectification-orders") return { scope, id, kind:"rectification", row:workflowRow("rectification", id) };
    if (["approvals", "approval-pool", "ticket-approvals", "request-approvals"].includes(scope)) {
      const approvalRecord = approvalRecordById(id);
      const assignment = approvalRecord ? assignmentDocumentContext("approval", id, approvalRecord) : null;
      return { scope, id, kind:assignment?.sourceKind || "approvalRequest", row:assignment?.sourceRow || approvalRecord || null, approvalRecord, fromApproval:true };
    }
    const ticket = workflowRow("ticket", id);
    if (ticket) return { scope, id, kind:"ticket", row:ticket };
    const subprocess = workflowRow("subprocess", id);
    if (subprocess) return { scope, id, kind:"subprocess", row:subprocess };
    const rectification = workflowRow("rectification", id);
    if (rectification) return { scope, id, kind:"rectification", row:rectification };
    return { scope, id, kind:"unknown", row:null };
  }

  function batchContextStatus(context) {
    if (context.kind === "import") return context.row?.[2] || "-";
    if (context.kind === "exportRequest") return context.row?.[5] || "-";
    if (context.fromApproval) return context.approvalRecord?.[10] || context.row?.[5] || "-";
    return context.row?.[5] || "-";
  }

  function batchSummaryMarkup(contexts, operationHint = "") {
    const statuses = [...new Set(contexts.map(batchContextStatus))];
    const ids = contexts.map(context => context.id);
    const hint = operationHint ? escapeAttribute(operationHint) + "；" : "";
    const explanation = hint ? '<span>' + hint + '系统将在提交前再次逐条校验权限和当前状态，不符合条件的记录不会被修改。</span>' : '';
    return '<div class="action-dialog batch-action-dialog"><div class="action-dialog-question"><strong>已选择 ' + contexts.length + ' 条记录</strong>' + explanation + '</div><dl class="action-summary-grid"><div><dt>选中数量</dt><dd>' + contexts.length + ' 条</dd></div><div><dt>当前状态</dt><dd>' + statuses.map(statusTag).join(' ') + '</dd></div><div class="is-wide"><dt>业务单号</dt><dd>' + escapeAttribute(ids.join("、")) + '</dd></div></dl>';
  }

  function openBatchResultDialog(label, results) {
    const success = results.filter(result => result.ok);
    const failure = results.filter(result => !result.ok);
    const rows = results.map(result => '<tr><td class="primary-cell">' + escapeAttribute(result.id) + '</td><td>' + statusTag(result.ok ? "成功" : "失败") + '</td><td>' + escapeAttribute(result.message || (result.ok ? "操作成功" : "操作失败")) + '</td></tr>').join("");
    const content = '<div class="action-dialog batch-result-dialog"><div class="action-dialog-question"><strong>' + escapeAttribute(label) + '完成</strong><span>成功 ' + success.length + ' 条，失败 ' + failure.length + ' 条。失败记录未发生数据变更，可按提示调整后重新操作。</span></div><div class="table-wrap"><table class="table ds-table"><thead><tr><th>业务单号</th><th>结果</th><th>结果说明</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    openModal(label + "结果", content, "完成");
  }

  function completeBatchOperation(label, results) {
    persistWorkflowState();
    closeOverlay();
    rerenderPage(false, { instant:true });
    requestAnimationFrame(() => openBatchResultDialog(label, results));
  }

  function executeBatchOperation(label, contexts, executor) {
    const results = contexts.map(context => {
      try {
        const message = executor(context);
        return { id:context.id, ok:true, message:message || "操作成功" };
      } catch (error) {
        return { id:context.id, ok:false, message:error?.message || "当前状态不支持该操作" };
      }
    });
    completeBatchOperation(label, results);
  }

  function requireBatchRow(context) {
    if (!context.row) throw new Error("未找到记录或记录已被删除");
    return context.row;
  }

  function addBatchHistory(kind, row, action, opinion, result, receiver = "-") {
    appendWorkflowRecord(kind, row, row[5], row[5], action, { action, opinion, result, receiver });
  }

  function deleteBatchRecord(context) {
    const row = requireBatchRow(context);
    const remove = (rows, target) => { const index = rows.indexOf(target); if (index < 0) throw new Error("记录已不存在"); rows.splice(index, 1); };
    if (context.kind === "import") { if (normalizeImportStatus(row[2]) !== "导入失败") throw new Error("仅导入失败记录可以删除"); remove(importRows, row); return "失败导入记录已删除"; }
    if (context.kind === "autoDraft") { if (row[5] !== "草稿") throw new Error("仅草稿状态可以删除"); remove(autoDraftRows, row); return "自动带入草稿已删除"; }
    if (context.kind === "manualDraft") { if (row[5] !== "草稿") throw new Error("仅草稿状态可以删除"); remove(manualDraftRows, row); return "录入/导入草稿已删除"; }
    if (row[5] !== "草稿") throw new Error("仅草稿状态可以删除");
    if (context.kind === "ticket") {
      remove(ticketRows, row);
      const queryRow = queryTicketRows.find(item => item[0] === context.id);
      if (queryRow) remove(queryTicketRows, queryRow);
      ticketAudienceById.delete(context.id);
      delete state.documentData.tickets?.[context.id];
      delete workflowHistory.ticket?.[context.id];
    } else if (context.kind === "subprocess") {
      remove(subprocessRows, row);
      delete state.documentData.subprocesses?.[context.id];
      delete workflowHistory.subprocess?.[context.id];
    } else if (context.kind === "rectification") {
      remove(rectificationRows, row);
      delete state.documentData.rectifications?.[context.id];
      delete workflowHistory.rectification?.[context.id];
    } else throw new Error("该记录不支持删除");
    return "草稿已删除";
  }

  function voidBatchRecord(context, reason) {
    const row = requireBatchRow(context);
    if (context.kind === "exportRequest") {
      if (!["待提交", "已驳回"].includes(row[5])) throw new Error("仅待提交或已驳回的导出申请可以废止");
      row[5] = "已废止"; row[6] = "流程结束"; row[15] = "已废止";
      return "导出申请已废止，流程结束";
    }
    if (context.kind === "rectification") {
      const result = workflowTransition("rectification", context.id, "void", { action:"废止", opinion:reason, result:"废止", receiver:"-" });
      if (!result.ok) throw new Error(result.reason);
      row[8] = "流程终止";
      return "整改单已废止，流程终止";
    }
    if (!["ticket", "subprocess"].includes(context.kind) || row[5] !== "待提交") throw new Error("仅待提交状态可以废止");
    const from = row[5];
    row[5] = "已废止"; row[6] = systemTimestamp();
    COMPLAINT_WORK_POOL.advance(context.kind, context.id, row[5]);
    if (context.kind === "ticket") {
      const queryRow = queryTicketRows.find(item => item[0] === context.id);
      if (queryRow) { queryRow[5] = row[5]; queryRow[6] = row[6]; }
    }
    appendWorkflowRecord(context.kind, row, from, "已废止", "废止", { result:"废止", receiverName:"-" });
    return "单据已废止并进入最终状态";
  }

  function withdrawBatchRecord(context, reason) {
    const row = requireBatchRow(context);
    if (context.kind === "exportRequest") {
      if (row[5] !== "待审批") throw new Error("仅待审批的导出申请可以撤回");
      row[5] = "待提交"; row[6] = "申请人待提交"; row[15] = "草稿";
      return "导出申请已撤回，回到待提交草稿";
    }
    if (!["ticket", "subprocess"].includes(context.kind) || !canWithdrawSubmission(context.kind, row)) throw new Error("已超过提交后的紧邻节点，不能撤回");
    const result = workflowTransition(context.kind, context.id, "withdrawSubmission", { action:"撤回", opinion:reason, receiver:"创建人", result:"待提交" });
    if (!result.ok) throw new Error(result.reason);
    if (context.kind === "ticket") {
      const queryRow = queryTicketRows.find(item => item[0] === context.id);
      if (queryRow) { queryRow[5] = result.row[5]; queryRow[6] = result.row[6]; }
    }
    return "已撤回，状态变为待提交";
  }

  function remindBatchRecord(context) {
    const row = requireBatchRow(context);
    if (!["ticket", "subprocess"].includes(context.kind)) throw new Error("该记录不支持催办");
    if (["已办结", "已废止"].includes(row[5])) throw new Error("办结或废止记录不能催办");
    addBatchHistory(context.kind, row, "催办", "已发送催办提醒。", "已发送", "当前处理人");
    return "已向当前处理人发送催办提醒；流程状态保持" + row[5];
  }

  function transferBatchRecord(context, targetPath, targetDepartment, receiverValue, reason) {
    if (!String(reason || "").trim()) throw new Error("转派时必须填写转派原因");
    const row = requireBatchRow(context);
    const targetOrg = institutionDisplayName(targetPath);
    const receiver = receiverValue !== "-" ? receiverValue : [targetOrg, targetDepartment, "工单池"].filter(Boolean).join(" / ");
    if (context.kind === "rectification") {
      const fromOrg = row[4]; row[4] = targetOrg; row[6] = systemTimestamp();
      addBatchHistory("rectification", row, "转派", reason || "-", "转派", receiver);
      const history = workflowHistory.rectification[context.id]?.[0]; if (history) { history.fromOrg = fromOrg; history.toOrg = targetOrg; }
      return "已转派至" + receiver + "，整改状态保持" + row[5];
    }
    if (context.kind === "approvalRequest" || ["短信审批", "导出申请审批"].includes(context.approvalRecord?.[1]) || (context.fromApproval && !["ticket", "subprocess"].includes(context.kind))) {
      const record = context.approvalRecord;
      if (!record) throw new Error("未找到审批任务");
      record[4] = targetOrg; record[5] = receiverValue === "-" ? "待机构池领取" : "待审批人领取";
      if (record[1] === "导出申请审批") {
        const exportRequest = exportRequestRows.find(item => item[0] === record[0]);
        if (exportRequest) {
          exportRequest[17] = reason || "-";
          appendExportRequestRecord(exportRequest, "转派", reason || "-", { statusTransition:"审批中 → 审批中", receiver, result:"转派" });
        }
      }
      return "审批任务已转派至" + receiver;
    }
    const status = row[5];
    const policy = transferReasonPolicy(status);
    if (!policy.allowed) throw new Error(status + "不能转派");
    const event = context.fromApproval ? (["待复核", "复核中"].includes(status) ? "transferReview" : "transferApproval") : "transfer";
    const assignee = receiverValue !== "-" ? normalizedAssigneeName(receiverValue) : "";
    const result = workflowTransition(context.kind, context.id, event, { action:"转派", opinion:reason || "-", receiver, targetOrg, targetDepartment, assignee, result:"转派" });
    if (!result.ok) throw new Error(result.reason);
    return "已转派至" + receiver + "；状态为" + result.to;
  }

  function openBatchOperationDialog(scope, operation, label, ids) {
    if (!BATCH_OPERATION_KEYS.has(operation)) return toast("当前操作不支持批量处理", true);
    if (operation === "export" && ["query-tickets", "query-subprocesses"].includes(scope)) return openExportApplicationDialog(ids);
    if (operation === "export" && scope === "query-rectifications") return openRectificationExportDialog(ids);
    const contexts = ids.map(id => batchRecordContext(scope, id));
    if (!contexts.length) return toast("请先选择记录", true);
    if (operation === "delete") {
      const content = batchSummaryMarkup(contexts, "确认后删除所选记录；仅草稿或导入失败记录可删除") + '</div>';
      return openModal(label, content, "确认删除", () => executeBatchOperation(label, contexts, context => deleteBatchRecord(context)));
    }
    if (operation === "remind") {
      const content = batchSummaryMarkup(contexts) + '</div>';
      return openModal(label, content, "确认催办", () => executeBatchOperation(label, contexts, context => remindBatchRecord(context)));
    }
    if (operation === "transfer") {
      const institutionControl = renderHierarchyCascaderControl("batch-assignment-org", { type:"hierarchyCascader", dictionary:"institutionTree", tree:institutionHierarchyTree(), levels:["总行/分行", "机构/下辖支行"], leafLevel:2, multiple:false, nonLeafSelectable:false, includeDescendantsOption:false, searchable:true, placeholder:"请选择接收机构" }, "batch-assignment-org");
      const departmentControl = renderInstitutionDepartmentControl("batch-assignment-department", "batch-assignment-department", "batch-assignment-org", false, "请选择接收部门");
      const people = ["-", "林海-38102（处理员）", "王琳-27519（处理员）", "王宁-31042（审批员）", "李雯-29821（复核员）"];
      const receiverRequired = contexts.some(context => ["短信审批", "导出申请审批"].includes(context.approvalRecord?.[1]));
      const reasonRequired = contexts.some(context => transferReasonPolicy(context.row?.[5] || context.approvalRecord?.[10]).required);
      const content = batchSummaryMarkup(contexts) + '<div class="action-assignment-grid"><label><span>接收机构 <em>*</em></span><div class="form-control">' + institutionControl + '</div></label><label><span>接收部门 <em>*</em></span>' + departmentControl + '</label><label><span>接收人' + (receiverRequired ? ' <em>*</em>' : '') + '</span><select class="di-native-select is-fluid" id="batch-assignment-person">' + people.map(person => '<option value="' + escapeAttribute(person) + '">' + escapeAttribute(person) + '</option>').join("") + '</select></label></div><label class="action-full-field"><span>转派原因 ' + (reasonRequired ? '<em>*</em>' : '') + '</span><textarea class="di-textarea" id="batch-assignment-reason" placeholder="说明批量转派原因及关注事项"></textarea></label></div>';
      return openModal(label, content, "确认转派", () => { const targetPath=document.getElementById("batch-assignment-org")?.value || ""; const department=document.getElementById("batch-assignment-department")?.value || ""; const person=document.getElementById("batch-assignment-person")?.value || "-"; const reason=document.getElementById("batch-assignment-reason")?.value.trim() || ""; if(!targetPath) return toast("请选择接收机构", true); if(!department) return toast("请选择接收部门", true); if(receiverRequired && person === "-") return toast("请选择接收人", true); if(reasonRequired && !reason) return toast("所选记录包含转派原因必填状态，请填写转派原因", true); executeBatchOperation(label, contexts, context => transferBatchRecord(context, targetPath, department, person, reason)); });
    }
  }
  function bindBulkSelection() {
    // 仅保留确实存在批量操作的列表选择框；没有批量入口的列表不展示无效复选框。
    document.querySelectorAll("[data-select-all]").forEach(input => {
      const scope = input.dataset.selectAll;
      const toolbar = document.querySelector(`[data-bulk-toolbar="${CSS.escape(scope)}"]`);
      if (toolbar?.querySelector("[data-bulk-action]") || toolbar?.hasAttribute("data-module-bulk")) return;
      input.closest(".selection-cell")?.remove();
      document.querySelectorAll(`[data-row-select="${CSS.escape(scope)}"]`).forEach(row => row.closest(".selection-cell")?.remove());
      toolbar?.remove();
    });
    const sync = scope => {
      const rows = [...document.querySelectorAll(`[data-row-select="${scope}"]`)];
      const selected = rows.filter(input => input.checked);
      const all = document.querySelector(`[data-select-all="${scope}"]`);
      if (all) { all.checked = rows.length > 0 && selected.length === rows.length; all.indeterminate = selected.length > 0 && selected.length < rows.length; }
      const count = document.querySelector(`[data-bulk-count="${scope}"]`);
      if (count) count.textContent = selected.length;
      document.querySelectorAll(`[data-bulk-toolbar="${scope}"] [data-bulk-action]`).forEach(button => {
        const key = button.dataset.bulkOperation;
        const label = button.dataset.bulkAction;
        const alwaysEligible = key === "inspection-export";
        const eligible = selected.length > 0 && selected.every(input => alwaysEligible || input.closest("tr")?.querySelector(`button[data-operation-key="${key}"][data-batch-label="${CSS.escape(label)}"]`));
        button.disabled = !eligible;
        button.title = eligible ? `将对已选 ${selected.length} 条记录执行${label}` : selected.length ? "所选记录中包含状态、权限或操作类型不一致的记录" : "请先选择记录";
      });
      rows.forEach(input => input.closest('tr')?.classList.toggle('is-selected', input.checked));
    };
    document.querySelectorAll('[data-select-all]').forEach(input => input.addEventListener('change', () => { const scope = input.dataset.selectAll; document.querySelectorAll(`[data-row-select="${scope}"]`).forEach(row => { row.checked = input.checked; }); sync(scope); }));
    document.querySelectorAll('[data-row-select]').forEach(input => input.addEventListener('change', () => sync(input.dataset.rowSelect)));
    document.querySelectorAll('[data-bulk-toolbar]').forEach(toolbar => sync(toolbar.dataset.bulkToolbar));
    document.querySelectorAll('[data-bulk-action]').forEach(button => button.addEventListener('click', () => {
      if (button.disabled) return;
      const scope = button.closest("[data-bulk-toolbar]")?.dataset.bulkToolbar;
      const ids = scope ? [...document.querySelectorAll(`[data-row-select="${scope}"]:checked`)].map(input => input.value) : [];
      openBatchOperationDialog(scope, button.dataset.bulkOperation, button.dataset.bulkAction, ids);
    }));
  }

  function bindAnchorObserver() {
    if (window.__anchorObserver) window.__anchorObserver.disconnect();
    if (window.__anchorScrollHandler) window.removeEventListener("scroll", window.__anchorScrollHandler);
    const links = [...document.querySelectorAll("[data-anchor]")];
    const sections = [...document.querySelectorAll(".form-section")];
    if (!links.length || !sections.length) return;
    const update = () => {
      const probe = window.scrollY + 150;
      let active = sections[0];
      sections.forEach(section => { if (section.offsetTop <= probe) active = section; });
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) active = sections[sections.length - 1];
      links.forEach(link => link.classList.toggle("is-active", active.id === `section-${link.dataset.anchor}`));
    };
    window.__anchorScrollHandler = update;
    window.addEventListener("scroll", update, { passive: true });
    requestAnimationFrame(update);
  }

  function openWithdrawSubmissionDialog(id) {
    const ticket = ticketRows.find(item => item[0] === id);
    const subprocess = subprocessRows.find(item => item[0] === id);
    const kind = ticket ? "ticket" : subprocess ? "subprocess" : "";
    const row = ticket || subprocess;
    const ticketApprovalWithdrawal = kind === "ticket" && row?.[5] === "待审批";
    if (!row || (!ticketApprovalWithdrawal && !canWithdrawSubmission(kind, row))) return toast("当前状态不能撤回", true);
    const targetStatus = ticketApprovalWithdrawal ? "处理中" : "待提交";
    const description = ticketApprovalWithdrawal ? "仅待审批工单可以由创建人撤回；撤回后返回处理中。" : "仅可撤回提交后的紧邻节点；单据将回到待提交。";
    openModal("撤回", '<div class="action-dialog"><div class="action-dialog-question"><strong>确认撤回 ' + id + '？</strong></div><dl class="action-summary-grid"><div><dt>单据编号</dt><dd>' + row[0] + '</dd></div><div><dt>单据类型</dt><dd>' + row[1] + '</dd></div><div><dt>当前状态</dt><dd>' + statusTag(row[5]) + '</dd></div><div><dt>撤回后状态</dt><dd>' + statusTag(targetStatus) + '</dd></div></dl></div>', "确认撤回", () => {
      if (ticketApprovalWithdrawal) {
        const result = workflowTransition("ticket", id, "withdrawApproval", { action:"撤回", opinion:"创建人从待审批撤回至处理中。", receiver:"原处理人", result:targetStatus });
        if (!result.ok) return toast(result.reason, true);
        const queryRow = queryTicketRows.find(item => item[0] === id);
        if (queryRow) { queryRow[5] = targetStatus; queryRow[6] = result.row[6]; }
      } else {
        const result = workflowTransition(kind, id, "withdrawSubmission", { action:"撤回", opinion:"创建人从提交后的紧邻节点撤回，返回待提交。", receiver:"创建人", result:"待提交" });
        if (!result.ok) return toast(result.reason, true);
        if (kind === "ticket") {
          const queryRow = queryTicketRows.find(item => item[0] === id);
          if (queryRow) { queryRow[5] = result.row[5]; queryRow[6] = result.row[6]; }
        }
      }
      persistWorkflowState();
      closeOverlay(); rerenderPage(); toast(id + " 已撤回，状态变为" + targetStatus);
    });
  }

  function openRemindConfirmDialog(id) {
    let context = batchRecordContext(state.page === "my-approvals" ? "approvals" : "tickets", id);
    if (!context.row) context = batchRecordContext("export-requests", id);
    const row = context.row;
    const status = batchContextStatus(context);
    if (!row) return toast("未找到待催办单据", true);
    if (["已办结", "已废止"].includes(status)) return toast("办结或废止记录不能催办", true);
    const kindLabel = context.approvalRecord?.[1] || row[1] || "业务单据";
    openModal("确认催办", '<div class="action-dialog"><div class="action-dialog-question"><strong>确认催办 ' + id + '？</strong></div><dl class="action-summary-grid"><div><dt>业务单号</dt><dd>' + escapeAttribute(id) + '</dd></div><div><dt>业务类型</dt><dd>' + escapeAttribute(kindLabel) + '</dd></div><div><dt>当前状态</dt><dd>' + statusTag(status) + '</dd></div><div><dt>催办对象</dt><dd>当前处理人</dd></div></dl></div>', "确认催办", () => {
      if (["ticket", "subprocess"].includes(context.kind)) remindBatchRecord(context);
      persistWorkflowState();
      closeOverlay();
      rerenderPage(false, { instant:true });
      toast("已向 " + id + " 的当前处理人发送催办提醒");
    });
  }
  function openExportRequestWithdrawDialog(id) {
    const row = exportRequestRows.find(item => item[0] === id) || exportRequestRows[0];
    openModal("撤回导出申请", '<div class="action-dialog"><div class="action-dialog-question"><strong>确认撤回该导出申请？</strong></div><dl class="action-summary-grid"><div><dt>导出申请编号</dt><dd>' + row[0] + '</dd></div><div><dt>导出类型</dt><dd>' + row[1] + '</dd></div><div><dt>数据范围</dt><dd>' + row[2] + '</dd></div><div><dt>申请状态</dt><dd>' + row[5] + '</dd></div><div><dt>当前节点</dt><dd>' + row[6] + '</dd></div><div><dt>申请时间</dt><dd>' + row[7] + '</dd></div></dl></div>', "确认撤回申请", () => { row[5] = "待提交"; row[6] = "申请人待提交"; row[15] = "草稿"; removeExportApprovalRecord(row[0]); persistWorkflowState(); closeOverlay(); rerenderPage(); toast(row[0] + " 已撤回，回到待提交草稿"); });
  }

  function removeExportApprovalRecord(requestId) {
    for (let index = approvalRows.length - 1; index >= 0; index -= 1) {
      if (approvalRows[index][0] === requestId && approvalRows[index][1] === "导出申请审批") approvalRows.splice(index, 1);
    }
  }

  function upsertExportApprovalRecord(requestId, exportType, profile, appliedAt, relatedTicketIds, relatedSubprocessIds) {
    const record = [requestId, "导出申请审批", exportType, profile.label, profile.orgLabel, "导出审批", "+8小时", appliedAt, relatedTicketIds, relatedSubprocessIds, "待审批"];
    const existingIndex = approvalRows.findIndex(item => item[0] === requestId && item[1] === "导出申请审批");
    if (existingIndex >= 0) {
      approvalRows.splice(existingIndex, 1, record);
      for (let index = approvalRows.length - 1; index > existingIndex; index -= 1) {
        if (approvalRows[index][0] === requestId && approvalRows[index][1] === "导出申请审批") approvalRows.splice(index, 1);
      }
      return;
    }
    approvalRows.unshift(record);
  }

  const TRANSFER_REASON_POLICY = Object.freeze({
    required: Object.freeze(["复核中", "处理中", "初审中", "审批中", "待补录"]),
    optional: Object.freeze(["待复核", "待处理", "待初审", "待审批"]),
    forbidden: Object.freeze(["会签中"])
  });

  function transferReasonPolicy(status = "") {
    const normalizedStatus = String(status || "").trim();
    const allowed = !TRANSFER_REASON_POLICY.forbidden.includes(normalizedStatus);
    return Object.freeze({
      status: normalizedStatus,
      allowed,
      required: allowed
    });
  }
  function assignmentOptions(options = [], includePool = false) {
    const values = includePool ? ["-", ...options] : options;
    return '<option value="">\u8bf7\u9009\u62e9</option>' + values.map(value => '<option value="' + escapeAttribute(value) + '">' + escapeAttribute(value) + '</option>').join("");
  }

  function assignmentDocumentContext(kind, id, row) {
    let sourceKind = kind;
    let sourceRow = kind === "ticket" ? ticketRowById(id) : kind === "subprocess" ? workflowRow("subprocess", id) : null;
    let approvalType = "";
    if (kind === "approval") {
      approvalType = row?.[1] || "";
      sourceRow = ticketRowById(id) || ticketRowById(row?.[8]) || null;
      sourceKind = sourceRow ? "ticket" : "subprocess";
      if (!sourceRow) sourceRow = workflowRow("subprocess", id) || workflowRow("subprocess", row?.[9]);
    }
    const isTicket = sourceKind === "ticket";
    const base = {
      sourceKind,
      sourceRow,
      numberLabel:isTicket ? "工单编号" : "子单编号",
      typeLabel:isTicket ? "工单类型" : "子单类型",
      number:sourceRow?.[0] || id,
      type:sourceRow?.[1] || row?.[2] || "-",
      customer:isTicket ? (sourceRow?.[2] || "-") : (sourceRow?.[3] || "-"),
      currentInstitution:isTicket ? ticketReceivingInstitution(sourceRow) : subprocessCreatorInstitution(sourceRow)
    };
    if (kind !== "approval") return base;
    const relatedTicket = ticketRowById(row?.[8]);
    const approvalTitleMap = {
      "工单审批": "转派工单审批",
      "子流程审批": "转派子流程审批",
      "短信审批": "转派短信审批",
      "导出申请审批": "转派导出申请审批"
    };
    const fields = [];
    if (approvalType === "短信审批") {
      fields.push(
        { label: "短信所属工单编号", value: row?.[8] || "-" },
        { label: "接收号码", value: "13800007621" },
        { label: "客户姓名", value: relatedTicket?.[2] || "-" },
        { label: "当前机构", value: row?.[4] || "-" }
      );
    } else if (approvalType === "导出申请审批") {
      fields.push(
        { label: "导出申请编号", value: row?.[0] || id },
        { label: "导出类型", value: normalizeExportRequestType(row?.[2]) || "-" },
        { label: "申请人", value: row?.[3] || "-" },
        { label: "当前机构", value: row?.[4] || "-" }
      );
    } else if (approvalType === "子流程审批") {
      fields.push(
        { label: "子流程编号", value: row?.[0] || id },
        { label: "子流程类型", value: row?.[2] || "-" },
        { label: "客户姓名", value: workflowRow("subprocess", row?.[0])?.[3] || row?.[3] || "-" },
        { label: "当前机构", value: row?.[4] || "-" }
      );
    } else {
      fields.push(
        { label: "工单编号", value: row?.[0] || id },
        { label: "工单类型", value: row?.[2] || "-" },
        { label: "客户姓名", value: workflowRow("ticket", row?.[0])?.[2] || row?.[3] || "-" },
        { label: "当前机构", value: row?.[4] || "-" }
      );
    }
    base.title = approvalTitleMap[approvalType] || ("转派" + (isTicket ? "工单" : "子流程") + "审批");
    base.fields = fields;
    return base;
  }

  function openAssignmentDialog(kind, id) {
    const isApproval = kind === "approval";
    const row = isApproval ? approvalRecordById(id) : workflowRow(kind, id);
    if (!row) return toast("未找到待操作单据", true);
    const context = assignmentDocumentContext(kind, id, row);
    const transferStatus = String(context.sourceRow?.[5] || (isApproval ? (row[10] || row[5] || "") : (row[5] || "")));
    const reasonPolicy = transferReasonPolicy(transferStatus);
    if (!reasonPolicy.allowed) return toast(transferStatus + "不能转派", true);
    const approvalRole = isApproval && transferStatus.includes("复核") ? "复核员" : "审批员";
    const people = isApproval
      ? (approvalRole === "复核员" ? ["李雯-29821（复核员）", "赵宁-29816（复核员）"] : ["王宁-31042（审批员）", "周慧-31608（审批员）"])
      : context.sourceKind === "subprocess" ? ["王琳-27519（子流程处理员）", "许一帆-49017（子流程处理员）"] : ["林海-38102（工单处理员）", "王琳-27519（工单处理员）"];
    state.formValues["assignment-org"] = "";
    state.formValues["assignment-department"] = "";
    state.formValues["assignment-person"] = "-";
    const institutionControl = renderHierarchyCascaderControl("assignment-org", { type:"hierarchyCascader", dictionary:"institutionTree", tree:institutionHierarchyTree(), levels:["总行/分行", "机构/下辖支行"], leafLevel:2, multiple:false, nonLeafSelectable:false, includeDescendantsOption:false, searchable:true, placeholder:"请选择接收机构" }, "assignment-org");
    const departmentControl = renderInstitutionDepartmentControl("assignment-department", "assignment-department", "assignment-org", false, "请选择接收部门");
    const receiverRequired = isApproval && ["短信审批", "导出申请审批"].includes(row?.[1]);
    const personControl = '<select class="di-native-select is-fluid" id="assignment-person" data-field-key="assignment-person"><option value="-" selected>' + (receiverRequired ? "请选择接收人" : "-") + '</option>' + people.map(value => '<option value="' + escapeAttribute(value) + '">' + escapeAttribute(value) + '</option>').join("") + '</select>';
    const reasonRequired = reasonPolicy.required;
    const summaryItems = isApproval && context.fields
      ? context.fields.map(field => '<div><dt>' + escapeAttribute(field.label) + '</dt><dd>' + escapeAttribute(field.value) + '</dd></div>').join("")
      : '<div><dt>' + context.numberLabel + '</dt><dd>' + escapeAttribute(context.number) + '</dd></div><div><dt>' + context.typeLabel + '</dt><dd>' + escapeAttribute(context.type) + '</dd></div><div><dt>客户姓名</dt><dd>' + escapeAttribute(context.customer) + '</dd></div><div><dt>当前机构</dt><dd>' + escapeAttribute(context.currentInstitution) + '</dd></div>';
    const dialogTitle = isApproval && context.title ? context.title : ("转派" + (context.sourceKind === "ticket" ? "工单" : "子单"));
    const content = '<div class="action-dialog assignment-dialog"><dl class="action-summary-grid assignment-summary-grid">' + summaryItems + '</dl><div class="action-assignment-grid"><label><span>接收机构 <em>*</em></span><div class="form-control">' + institutionControl + '</div></label><label><span>接收部门 <em>*</em></span>' + departmentControl + '</label><label><span>接收人' + (receiverRequired ? ' <em>*</em>' : '') + '</span>' + personControl + '</label></div><label class="action-full-field"><span>转派原因 ' + (reasonRequired ? '<em>*</em>' : '') + '</span><textarea class="di-textarea" id="assignment-reason" placeholder="' + (reasonRequired ? transferStatus + '转派时必填' : '可填写转派原因及需要关注的信息') + '"></textarea></label></div>';
    openModal(dialogTitle, content, "确认转派", () => {
      const targetPath = document.getElementById("assignment-org")?.value || "";
      const targetOrg = institutionDisplayName(targetPath);
      const targetDepartment = document.getElementById("assignment-department")?.value || "";
      const receiverValue = document.getElementById("assignment-person")?.value || "-";
      const reason = document.getElementById("assignment-reason")?.value.trim() || "";
      if (!targetPath) return toast("请选择接收机构", true);
      if (!targetDepartment) return toast("请选择接收部门", true);
      if (receiverRequired && receiverValue === "-") return toast("请选择接收人", true);
      if (reasonRequired && !reason) { document.getElementById("assignment-reason")?.focus(); return toast(transferStatus + "转派时必须填写转派原因", true); }
      const receiver = receiverValue !== "-" ? receiverValue : [targetOrg, targetDepartment !== "-" ? targetDepartment : "", "工单池"].filter(Boolean).join(" / ");
      let result = { ok:true };
      if (!isApproval) {
        result = workflowTransition(context.sourceKind, context.number, "transfer", { action:"转派", opinion:reason || "-", receiver, targetOrg, targetDepartment, assignee:receiverValue !== "-" ? normalizedAssigneeName(receiverValue) : "", result:"转派" });
      } else if (context.sourceRow) {
        const event = ["待复核", "复核中"].includes(transferStatus) ? "transferReview" : "transferApproval";
        result = workflowTransition(context.sourceKind, context.number, event, { action:"转派", opinion:reason || "-", receiver, targetOrg, targetDepartment, result:"转派" });
        const approvalRow = approvalRows.find(item => item[0] === id);
        if (approvalRow) { approvalRow[4] = targetOrg; approvalRow[5] = receiverValue === "-" ? "待机构池领取" : approvalRole === "复核员" ? "待复核人领取" : "待审批人领取"; }
      }
      if (!result.ok) return toast(result.reason, true);
      closeOverlay(); rerenderPage(); toast(context.number + " 已转派至 " + receiver);
    });
  }

  function openTransferApprovalDialog(id) {
    return openAssignmentDialog("approval", id);
  }

  function exportApprovalRoute(profile = currentRoleProfile()) {
    const institution = [profile.institutionLabel, profile.departmentLabel].filter(Boolean).join(" / ") || profile.orgLabel || "-";
    const branchRoute = /分行|支行/.test(profile.institutionLabel || "") || /分行|支行/.test(profile.departmentLabel || "");
    return {
      institution,
      approvers:branchRoute ? "王宁-31042、周慧-31608" : "李明-17306、王宁-48216"
    };
  }

  function openExportApplicationDialog(ids = [], editRequestId = "") {
    const editing = exportRequestRows.find(item => item[0] === editRequestId);
    const selected = ids.length ? ids : editing ? String(editing[8] || editing[9] || "").split(/[、,，]/).filter(Boolean) : ticketRows.slice(0, 4).map(row => row[0]);
    const isSubprocess = selected.some(id => /^[A-Z]{2}202/.test(id) && !/^(TS|XF|BY|JY|YQ)/.test(id));
    const mode = editing?.[10] || "脱敏导出";
    const relatedLabel = isSubprocess ? "导出子流程单编号" : "导出工单编号";
    const route = exportApprovalRoute();
    const approvalInstitution = editing?.[14] || route.institution;
    const approvalPerson = editing?.[13] || route.approvers;
    const applicationReason = editing?.[12] || "";
    const content = '<div class="action-dialog export-application"><div class="action-dialog-question"><strong>选择导出方式</strong><span>脱敏导出可直接导出；非脱敏（含客户信息）导出需提交至本机构进行审批。</span></div><div class="export-ticket-summary"><span>' + relatedLabel + '：</span><strong>' + selected.join("、") + '</strong></div><div class="export-mode-group"><label><input type="radio" name="export-desensitization" value="脱敏导出" ' + (mode === "脱敏导出" ? "checked" : "") + '>脱敏导出</label><label><input type="radio" name="export-desensitization" value="非脱敏导出" ' + (mode === "非脱敏导出" ? "checked" : "") + '>非脱敏导出</label></div><div class="export-non-desensitized-fields" data-export-sensitive-section><div class="export-approval-targets action-two-columns"><label><span>审批机构</span><input class="di-input is-fluid" id="export-approver-org" value="' + escapeAttribute(approvalInstitution) + '" readonly aria-readonly="true"></label><label><span>审批人</span><input class="di-input is-fluid" id="export-approver" value="' + escapeAttribute(approvalPerson) + '" readonly aria-readonly="true"></label></div><label class="action-full-field export-application-reason"><span>申请原因</span><div class="textarea-with-count"><textarea class="di-textarea" id="export-reason" maxlength="2000" placeholder="请输入申请原因">' + escapeAttribute(applicationReason.slice(0, 2000)) + '</textarea><small class="textarea-count" id="export-reason-count" aria-live="polite">' + String(applicationReason || "").slice(0, 2000).length + '/2000</small></div></label></div><div class="export-desensitized-note" data-export-direct-note>脱敏导出可直接生成文件，并写入导出台账。</div></div>';
    openModal("导出申请", content, mode === "非脱敏导出" ? "提交导出申请" : "导出", () => {
      const selectedMode = document.querySelector('input[name="export-desensitization"]:checked')?.value || "";
      if (!selectedMode) return toast("请选择是否脱敏", true);
      const appliedAt = systemTimestamp();
      const requestId = editing?.[0] || ("DC" + appliedAt.slice(0, 10).replace(/-/g, "") + String(exportRequestRows.length + 1).padStart(4, "0"));
      const exportType = isSubprocess ? "子单" : "工单";
      const profile = currentRoleProfile();
      const approver = document.getElementById("export-approver")?.value || approvalPerson;
      const approverOrg = document.getElementById("export-approver-org")?.value || approvalInstitution;
      const status = selectedMode === "脱敏导出" ? "已通过" : "待审批";
      const node = selectedMode === "脱敏导出" ? "直接导出" : "导出审批";
      if (selectedMode === "非脱敏导出") {
        if (!approverOrg) return toast("系统未匹配到审批机构", true);
        if (!approver) return toast("系统未匹配到审批人", true);
      }
      const sensitiveFields = selectedMode === "非脱敏导出" ? "客户信息" : "";
      const reason = selectedMode === "非脱敏导出" ? (document.getElementById("export-reason")?.value.trim() || "非脱敏导出（含客户信息），系统自动提交本机构审批。") : "脱敏导出，系统自动排除敏感字段。";
      const directlyApprovedAt = selectedMode === "脱敏导出" ? new Date() : null;
      const newRow = [requestId, exportType, selected.length + (isSubprocess ? " 条子流程单" : " 条工单"), profile.label, profile.institutionLabel, status, node, appliedAt, isSubprocess ? "" : selected.join("、"), isSubprocess ? selected.join("、") : "", selectedMode, sensitiveFields, reason, approver, approverOrg, selectedMode === "脱敏导出" ? "可下载" : "待审批", profile.departmentLabel || "-", editing?.[17] || "", editing?.[18] || "", directlyApprovedAt ? formatPrototypeDateTime(directlyApprovedAt) : "", directlyApprovedAt ? formatPrototypeDateTime(new Date(directlyApprovedAt.getTime() + EXPORT_REQUEST_DOWNLOAD_RETENTION_MS)) : ""];
      if (editing) exportRequestRows.splice(exportRequestRows.findIndex(item => item[0] === editing[0]), 1, newRow);
      else exportRequestRows.unshift(newRow);
      appendExportRequestRecord(newRow, "提交申请", reason, { statusTransition:(editing?.[5] || "待提交") + " → " + status, receiver:status === "待审批" ? approver : "-", result:status });
      if (selectedMode === "非脱敏导出") upsertExportApprovalRecord(requestId, exportType, profile, appliedAt, isSubprocess ? "" : selected.join("、"), isSubprocess ? selected.join("、") : "");
      else removeExportApprovalRecord(requestId);
      persistWorkflowState();
      closeOverlay();
      rerenderPage();
      toast(selectedMode === "脱敏导出" ? "已生成脱敏导出记录，可在导出台账查看" : "导出申请已提交，可在导出申请栏目查看进度");
    });
    const syncExportMode = () => {
      const selectedMode = document.querySelector('input[name="export-desensitization"]:checked')?.value || "脱敏导出";
      const sensitiveSection = document.querySelector("[data-export-sensitive-section]");
      const directNote = document.querySelector("[data-export-direct-note]");
      if (sensitiveSection) sensitiveSection.hidden = selectedMode === "脱敏导出";
      if (directNote) directNote.hidden = selectedMode !== "脱敏导出";
      const confirm = document.getElementById("modal-confirm");
      if (confirm) confirm.textContent = selectedMode === "脱敏导出" ? "导出" : "提交导出申请";
    };
    document.querySelectorAll('input[name="export-desensitization"]').forEach(input => input.addEventListener("change", syncExportMode));
    const reasonControl = document.getElementById("export-reason");
    const reasonCount = document.getElementById("export-reason-count");
    const syncReasonCount = () => {
      if (reasonControl.value.length > 2000) reasonControl.value = reasonControl.value.slice(0, 2000);
      reasonCount.textContent = reasonControl.value.length + "/2000";
    };
    reasonControl.addEventListener("input", syncReasonCount);
    syncReasonCount();
    syncExportMode();
  }

  function openRectificationExportDialog(ids = []) {
    const selected = [...new Set((ids || []).filter(id => rectificationRows.some(row => row[0] === id)))];
    if (!selected.length) return toast("请选择需要导出的溯源整改单", true);
    const content = '<div class="action-dialog rectification-export-dialog"><div class="action-dialog-question"><strong>溯源整改不含敏感信息，可直接导出</strong><span>确认后系统将生成导出文件，并在导出台账中保留记录。</span></div><div class="export-ticket-summary"><span>导出整改单编号：</span><strong>' + selected.map(escapeAttribute).join("、") + '</strong></div></div>';
    openModal("溯源整改导出", content, "导出", () => {
      const exportedAt = systemTimestamp();
      const requestId = "DC" + exportedAt.slice(0, 10).replace(/-/g, "") + String(exportRequestRows.length + 1).padStart(4, "0");
      const profile = currentRoleProfile();
      const expiresAt = formatPrototypeDateTime(new Date(parsePrototypeDate(exportedAt).getTime() + EXPORT_REQUEST_DOWNLOAD_RETENTION_MS));
      exportRequestRows.unshift(exportRequestToRow({ id:requestId, exportType:"溯源整改单", dataScope:selected.length + " 条溯源整改单", applicant:profile.label, org:profile.institutionLabel, department:profile.departmentLabel || "-", status:"已通过", node:"直接导出", appliedAt:exportedAt, relatedRectificationIds:selected, desensitization:"不涉及脱敏", reason:"溯源整改不含敏感信息，直接导出。", approver:"-", approverOrg:"-", exportStatus:"可下载", approvedAt:exportedAt, expiresAt }));
      closeOverlay();
      rerenderPage();
      toast("已生成溯源整改导出文件，可在导出台账查看");
    });
  }


  function markExportRequestVoided(id) {
    const row = exportRequestRows.find(item => item[0] === id);
    if (!row) return toast("未找到导出申请：" + id, true);
    if (!["待提交", "已驳回"].includes(row[5])) return toast("仅待提交或已驳回的导出申请可以废止", true);
    openModal("确认废止导出申请", '<div class="action-dialog"><div class="action-dialog-question"><strong>确认废止 ' + id + '？</strong><span>废止后该导出申请不再进入审批或下载流程。</span></div></div>', "确认废止", () => {
      row[5] = "已驳回";
      row[6] = "流程结束";
      row[15] = "已废止";
      persistWorkflowState();
      closeOverlay();
      toast(id + " 已废止");
      rerenderPage();
    });
  }

  function openExportRequestDetail(id) {
    const row = exportRequestRows.find(item => item[0] === id) || exportRequestRows[0];
    const relatedDocuments = exportRequestRelatedDocuments(row);
    const history = exportRequestHistory[row[0]] || [{ operationTime:row[7], operatorName:row[3] || "-", flowSceneName:"提交申请", flowOpinion:row[12] || "-" }];
    const flowRows = history.map(record => '<tr><td>' + escapeAttribute(record.operationTime) + '</td><td>' + escapeAttribute(record.operatorName) + '</td><td>' + escapeAttribute(record.flowSceneName) + '</td><td>' + escapeAttribute(record.flowOpinion || "-") + '</td></tr>').join("") || '<tr><td colspan="4">暂无流转记录</td></tr>';
    const detailContent = '<div class="action-dialog export-request-detail"><dl class="action-summary-grid"><div><dt>导出申请编号</dt><dd>' + escapeAttribute(row[0]) + '</dd></div><div><dt>导出类型</dt><dd>' + escapeAttribute(row[1]) + '</dd></div><div><dt>数据范围</dt><dd>' + escapeAttribute(row[2]) + '</dd></div><div><dt>申请人</dt><dd>' + escapeAttribute(row[3]) + '</dd></div><div><dt>申请机构</dt><dd>' + escapeAttribute(row[4]) + '</dd></div><div><dt>导出申请状态</dt><dd>' + statusTag(row[5]) + '</dd></div><div><dt>申请时间</dt><dd>' + escapeAttribute(row[7]) + '</dd></div><div><dt>脱敏情况</dt><dd>' + escapeAttribute(row[10] || "-") + '</dd></div><div><dt>审批人</dt><dd>' + escapeAttribute(row[13] || "-") + '</dd></div><div class="is-wide"><dt>关联业务单</dt><dd>' + escapeAttribute(relatedDocuments) + '</dd></div><div class="is-wide"><dt>申请原因</dt><dd>' + escapeAttribute(exportRequestReason(row)) + '</dd></div></dl><section class="export-request-flow"><div class="related-block-title">流转记录</div><div class="table-wrap"><table class="table ds-table transfer-record-table"><thead><tr><th>操作时间</th><th>操作人</th><th>操作动作</th><th>说明</th></tr></thead><tbody>' + flowRows + '</tbody></table></div></section></div>';
    openModal("导出申请详情", detailContent, "关闭");
  }

  function openReviewConfirm(id) {
    return openApprovalReview(id);
  }
  function getRectificationFormModel() {
    const definition = subprocessDefinition("溯源整改");
    const row = rectificationRows.find(item => item[0] === state.rectificationEditId) || null;
    return {
      row: row ? deepClone(row) : null,
      sections: deepClone(subprocessDifferenceSections(definition, "create")),
      orgLabel: currentRoleProfile().orgLabel,
      applicationTime: state.formValues["子流程-申请时间"] || "",
      role: state.role
    };
  }

  function getRectificationPickerRows() {
    return ticketRows.filter(row => row[5] !== "草稿" && ["投诉单", "信访单"].includes(row[1])).map(row => {
      const displayRow = [...row];
      displayRow[3] = ticketAcceptanceChannel(row);
      return displayRow;
    });
  }

  function setRectificationRelatedTickets(ticketIds = []) {
    const values = [...new Set(ticketIds.map(value => String(value || "").trim()).filter(Boolean))];
    state.formValues["subprocess.溯源整改.关联工单编号"] = values;
    state.subprocessSourceTicket = values.join("、");
  }

  function rectificationReturnPage(fallback = "rectification-create") {
    return ["rectification-create", "rectification-process", "rectification-approve"].includes(state.rectificationReturnPage) ? state.rectificationReturnPage : fallback;
  }

  function returnToRectificationList(fallback = "rectification-create") {
    return navigate(rectificationReturnPage(fallback), { skipHistory:true, preservePageState:true });
  }

  function openRectificationForm(id = "") {
    if (["rectification-create", "rectification-process", "rectification-approve"].includes(state.page)) state.rectificationReturnPage = state.page;
    const row = id ? rectificationRows.find(item => item[0] === id) : null;
    prepareRectificationForm(row);
    return navigate("rectification-form");
  }

  function prepareRectificationForm(row = null) {
    state.subprocessType = "溯源整改";
    state.rectificationEditId = row?.[0] || "";
    state.subprocessSourceTicket = row?.[2] || "";
    state.formValues = {};
    state.formValues["subprocess.溯源整改.关联工单编号"] = row?.[2] ? String(row[2]).split(/[、,，]/).map(value => value.trim()).filter(Boolean) : [];
    if (!row) return;
    const record = documentRecordFor("rectification", row);
    state.formValues["子流程-申请时间"] = record?.fields?.base?.["申请时间"] || row[6];
    Object.entries(record?.fields?.entry || {}).forEach(([name, value]) => {
      state.formValues["subprocess.溯源整改." + name] = deepClone(value);
    });
  }
  function filterNormalizedText(value) {
    return String(value || "").toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, "");
  }

  function filterPanelForTrigger(trigger) {
    return trigger?.closest?.(".filter-panel") || [...document.querySelectorAll(".filter-panel")].find(panel => !panel.hidden);
  }

  function filterItemLabel(item) {
    return item.querySelector(":scope > label")?.textContent.trim() || item.querySelector("label")?.textContent.trim() || "";
  }

  function filterCriteriaFromPanel(panel) {
    if (!panel) return [];
    return [...panel.querySelectorAll(".ticket-filter-item")].filter(item => {
      if (item.hidden || item.closest("[hidden]")) return false;
      return true;
    }).map(item => {
      const label = filterItemLabel(item);
      const disabled = [...item.querySelectorAll("input,select")].every(control => control.disabled);
      if (!label || disabled) return null;
      if (item.classList.contains("is-range")) {
        const values = [...item.querySelectorAll('input[type="hidden"]')].map(input => input.value.trim());
        return values.some(Boolean) ? { label, kind: "range", start: values[0] || "", end: values[1] || "", item } : null;
      }
      if (item.matches("[data-filter-status-multi]")) {
        const values = [...item.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value.trim()).filter(Boolean);
        return values.length ? { label, kind: "multi-select", values, item } : null;
      }
      const hierarchyHost = item.querySelector("[data-app-hierarchy-cascader]");
      const hierarchyValue = hierarchyHost?.querySelector('input[type="hidden"]')?.value.trim() || "";
      if (hierarchyValue) {
        const values = hierarchyValue.split(",").map(value => value.trim()).filter(Boolean);
        return { label, kind: hierarchyHost.dataset.multiple === "true" ? "hierarchy-multi" : "hierarchy", value: values[0] || "", values, dictionary:hierarchyHost.dataset.dictionary || "", item };
      }
      const pickerValue = item.querySelector('[data-app-picker] input[type="hidden"]')?.value.trim() || "";
      if (pickerValue) return { label, kind:"range", start:pickerValue, end:pickerValue, item };
      const select = item.querySelector("select");
      if (select) {
        const value = select.value.trim();
        if (!value || /^(请选择|全部|全部渠道|全部受理)$/.test(value)) return null;
        return { label, kind: "select", value, item, options: [...select.options].map(option => option.value).filter(value => value && !/^(请选择|全部)$/.test(value)) };
      }
      const input = item.querySelector('input:not([type="hidden"])');
      const value = input?.value.trim() || "";
      return value ? { label, kind: "text", value, item } : null;
    }).filter(Boolean);
  }

  function filterHeaderAliases(label) {
    const aliases = [label];
    if (/编号|批次号/.test(label)) aliases.push("编号", "业务单号", "单号", "批次号");
    if (/工单状态|子流程.*状态|申请状态|审批状态|任务状态|整改状态/.test(label)) aliases.push("状态");
    if (/机构|部门/.test(label)) aliases.push("当前机构", "机构", "发起机构", "负责机构", "发起部门", "所属机构", "所属部门");
    if (/客户姓名|申请人|创建人|当前处理人/.test(label)) aliases.push("客户姓名", "申请人", "创建人", "发起人", "处理人");
    if (/工单类型|子流程类型/.test(label)) aliases.push("业务类型");
    if (/工单类型|子流程类型|审批类型|申请类型|导出类型/.test(label)) aliases.push("类型", "单据类型");
    if (/时间|日期|期限|时限/.test(label)) aliases.push("创建时间", "申请时间", "生成时间", "核查时间", "处置期限", "剩余时限", "时间");
    if (/渠道/.test(label)) aliases.push("渠道");
    if (/业务类别|事项|原因/.test(label)) aliases.push("事项", "业务");
    return [...new Set(aliases.map(filterNormalizedText).filter(Boolean))];
  }

  function filterHeaderIndex(table, label) {
    const aliases = filterHeaderAliases(label);
    const headers = [...table.querySelectorAll("thead th")];
    const exact = headers.find(th => aliases.includes(filterNormalizedText(th.textContent)));
    if (exact) return exact.cellIndex;
    const partial = headers.find(th => {
      const text = filterNormalizedText(th.textContent);
      return aliases.some(alias => alias.length > 1 && (text.includes(alias) || alias.includes(text)));
    });
    return partial ? partial.cellIndex : -1;
  }

  function filterRowDates(row, preferredText = "") {
    const source = [preferredText, row.dataset.filterDate, row.dataset.filterCreatedAt, row.dataset.filterDeadline, row.textContent].filter(Boolean).join(" ");
    const dates = [];
    source.replace(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/g, (_, year, month, day) => {
      dates.push(year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0"));
      return _;
    });
    source.replace(/(20\d{2})(\d{2})(\d{2})/g, (_, year, month, day) => {
      dates.push(year + "-" + month + "-" + day);
      return _;
    });
    return [...new Set(dates)].sort();
  }

  function syntheticFilterMatch(row, criterion) {
    if (criterion.kind !== "select" || !criterion.options?.length) return false;
    const id = row.querySelector(".primary-cell")?.textContent.trim() || row.cells[1]?.textContent.trim() || row.textContent.trim();
    const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return criterion.options[seed % criterion.options.length] === criterion.value;
  }

  function structuredTicketFilterValue(row, label) {
    const ticketId = row.querySelector(".primary-cell")?.textContent.trim() || "";
    const ticket = ticketRowById(ticketId);
    if (!ticket) return "";
    if (["机构范围", "工单接收机构"].includes(label)) return ticketReceivingInstitution(ticket);
    if (label === "所属业务条线") return ticketBusinessLine(ticket);
    if (label === "是否异常投诉") return isAbnormalComplaint(ticket) ? "是" : "否";
    if (label === "是否黑灰产投诉") return isBlackGrayComplaint(ticket) ? "是" : "否";
    const entry = documentRecordFor("ticket", ticket)?.fields?.entry || {};
    const fieldName = ({ "业务办理渠道":"业务办理渠道标签", "业务类别":"投诉产品标签", "投诉原因":"投诉原因标签", "业务办理渠道标签":"业务办理渠道标签", "投诉产品标签":"投诉产品标签", "投诉原因标签":"投诉原因标签", "投诉诉求标签":"投诉诉求标签" })[label] || "";
    const value = fieldName ? entry[fieldName] : "";
    return Array.isArray(value) ? value.join(" / ") : String(value || "");
  }

  function institutionHierarchySelectionMatches(selection, target) {
    const parts = String(selection || "").split(" / ").filter(Boolean);
    const leaf = parts.at(-1) || "";
    if (String(selection) === hierarchyDescendantGroupValue(parts[0])) {
      const group = institutionHierarchyTree().find(node => node.label === parts[0]);
      const names = group ? flattenBusinessTree([group]).map(node => filterNormalizedText(node.label)) : [];
      const normalizedTarget = filterNormalizedText(target);
      return names.some(name => normalizedTarget.includes(name));
    }
    return filterNormalizedText(target).includes(filterNormalizedText(leaf));
  }

  function filterRowMatches(row, table, criterion) {
    const columnIndex = filterHeaderIndex(table, criterion.label);
    const preferredText = columnIndex >= 0 ? row.cells[columnIndex]?.textContent.trim() || "" : "";
    const exportRequestValue = row.dataset.exportRequest === "true" ? ({
      "导出类型":row.dataset.exportType,
      "导出申请状态":row.dataset.exportStatus,
      "申请时间":row.dataset.exportAppliedAt,
      "导出申请编号":row.querySelector(".primary-cell")?.textContent.trim(),
      "关联工单编号":row.dataset.exportRelatedTicket,
      "导出申请人":row.dataset.exportApplicant,
      "所属机构":row.dataset.exportInstitution,
      "所属部门":row.dataset.exportDepartment
    }[criterion.label] || "") : "";
    const rectificationValue = ({
      "申请时间":row.dataset.rectificationApplicationTime,
      "计划完成时间":row.dataset.rectificationPlannedCompletionTime,
      "整改单创建人":row.dataset.rectificationCreator,
      "整改机构或部门":row.dataset.rectificationOrganization,
      "整改负责人":row.dataset.rectificationResponsible,
      "是否抄送":row.dataset.rectificationCopied
    }[criterion.label] || "");
    if (criterion.kind === "range") {
      const dates = filterRowDates(row, rectificationValue || exportRequestValue || preferredText);
      if (!dates.length) return false;
      return dates.some(date => (!criterion.start || date >= criterion.start.slice(0, 10)) && (!criterion.end || date <= criterion.end.slice(0, 10)));
    }
    if (criterion.kind === "multi-select") {
      const expectedValues = (criterion.values || []).map(filterNormalizedText).filter(Boolean);
      if (!expectedValues.length) return true;
      const target = filterNormalizedText(exportRequestValue || (columnIndex >= 0 ? preferredText : row.textContent));
      return expectedValues.some(value => target.includes(value));
    }
    const expected = filterNormalizedText(criterion.value);
    if (!expected) return true;
    if (criterion.label === "核查结果状态") return filterNormalizedText(preferredText) === expected;
    if (criterion.label === "工单编号") {
      const ticketId = row.querySelector(".primary-cell")?.textContent.trim() || preferredText;
      return filterNormalizedText(ticketId) === expected;
    }
    if (criterion.kind === "hierarchy" || criterion.kind === "hierarchy-multi") {
      const target = rectificationValue || exportRequestValue || structuredTicketFilterValue(row, criterion.label) || preferredText;
      const values = criterion.values?.length ? criterion.values : [criterion.value];
      if (criterion.dictionary === "institutionTree") return values.some(value => institutionHierarchySelectionMatches(value, target));
      return values.some(value => {
        const leaf = String(value || "").split(" / ").filter(Boolean).at(-1) || value;
        return filterNormalizedText(target).includes(filterNormalizedText(leaf));
      });
    }
    if (rectificationValue) return filterNormalizedText(rectificationValue).includes(expected);
    if (exportRequestValue) return filterNormalizedText(exportRequestValue).includes(expected);
    const structuredTicketValue = structuredTicketFilterValue(row, criterion.label);
    if (structuredTicketValue) return filterNormalizedText(structuredTicketValue).includes(expected);
    if (columnIndex >= 0) return filterNormalizedText(preferredText).includes(expected);
    const rowText = filterNormalizedText(row.textContent);
    if (rowText.includes(expected)) return true;
    return syntheticFilterMatch(row, criterion);
  }

  function filterResultTables(panel) {
    const page = panel?.closest(".page") || document.getElementById("page-root");
    if (!page || !panel) return [];
    return [...page.querySelectorAll("table")].filter(table => {
      if (table.closest("#overlay-root")) return false;
      return Boolean(panel.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
  }

  function updateFilteredPagination(panel, visibleCount, filtered) {
    const page = panel.closest(".page");
    const pagination = page?.querySelector(".pagination");
    if (pagination) {
      const summary = pagination.querySelector("span");
      if (summary) {
        if (!summary.dataset.defaultText) summary.dataset.defaultText = summary.textContent;
        summary.textContent = filtered ? "共 " + visibleCount + " 条" : summary.dataset.defaultText;
      }
      pagination.querySelectorAll("button").forEach((button, index) => {
        if (!button.dataset.defaultDisabled) button.dataset.defaultDisabled = button.disabled ? "true" : "false";
        button.disabled = filtered ? index !== 1 : button.dataset.defaultDisabled === "true";
        button.classList.toggle("is-active", filtered && index === 1);
      });
    }
    const headingCount = page?.querySelector(".analysis-result-heading h1 span");
    if (headingCount) {
      if (!headingCount.dataset.defaultText) headingCount.dataset.defaultText = headingCount.textContent;
      headingCount.textContent = filtered ? "（" + visibleCount + "）" : headingCount.dataset.defaultText;
    }
  }

  function applyCurrentFilters(trigger) {
    const panel = filterPanelForTrigger(trigger);
    const criteria = filterCriteriaFromPanel(panel);
    const exclusionRules = [...(panel?.querySelectorAll("[data-complaint-exclusion-rule]:checked") || [])].map(input => input.value);
    const tables = filterResultTables(panel);
    let totalVisible = 0;
    tables.forEach(table => {
      const tbody = table.tBodies[0];
      if (!tbody) return;
      tbody.querySelector(".filter-empty-row")?.remove();
      const rows = [...tbody.rows].filter(row => !row.querySelector("[colspan]"));
      let visible = 0;
      rows.forEach(row => {
        const flags = String(row.dataset.complaintExclusionFlags || "").split(",").filter(Boolean);
        const excluded = exclusionRules.some(rule => flags.includes(rule));
        const matches = !excluded && criteria.every(criterion => filterRowMatches(row, table, criterion));
        row.hidden = !matches;
        if (matches) visible += 1;
      });
      if (!visible) {
        const empty = document.createElement("tr");
        empty.className = "filter-empty-row";
        empty.dataset.emptyState = "";
        empty.innerHTML = tableEmptyStateRow(Math.max(1, table.tHead?.rows[0]?.cells.length || 1)).replace(/^<tr[^>]*>|<\/tr>$/g, "");
        tbody.appendChild(empty);
      }
      totalVisible += visible;
    });
    const activeCriteria = criteria.length + exclusionRules.length;
    updateFilteredPagination(panel, totalVisible, activeCriteria > 0);
    panel.dataset.filterActive = activeCriteria ? "true" : "false";
    return { count: totalVisible, criteria: activeCriteria, tables: tables.length };
  }

  function resetCurrentFilters(trigger) {
    const panel = filterPanelForTrigger(trigger);
    if (!panel) return;
    panel.querySelectorAll("input").forEach(input => {
      if (input.disabled) return;
      if (["checkbox", "radio"].includes(input.type)) input.checked = false;
      else input.value = "";
    });
    panel.querySelectorAll("select").forEach(select => {
      if (!select.disabled) select.selectedIndex = 0;
    });
    panel.querySelectorAll("[data-app-hierarchy-cascader]").forEach(host => {
      delete state.formValues[host.dataset.fieldKey];
      host.dispatchEvent(new CustomEvent("xib:hierarchy-reset"));
    });
    panel.querySelectorAll("[data-filter-status-multi]").forEach(host => {
      const key = host.dataset.filterMultiKey || filterStatusKey(host.dataset.filterStatusLabel || filterItemLabel(host));
      if (state.filterStatusMulti) delete state.filterStatusMulti[key];
      host.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
      const triggerText = host.querySelector(".filter-status-trigger span");
      if (triggerText) triggerText.textContent = "\u8bf7\u9009\u62e9";
      const count = host.querySelector("[data-filter-multi-count]");
      if (count) count.textContent = "\u5df2\u9009 0";
      host.querySelectorAll(".filter-status-option").forEach(option => option.classList.remove("is-checked"));
    });
    panel.querySelectorAll("[data-picker-placeholder]").forEach(span => {
      span.textContent = span.dataset.pickerPlaceholder;
    });
    filterResultTables(panel).forEach(table => {
      table.tBodies[0]?.querySelector(".filter-empty-row")?.remove();
      [...(table.tBodies[0]?.rows || [])].forEach(row => { row.hidden = false; });
    });
    updateFilteredPagination(panel, 0, false);
    delete panel.dataset.filterActive;
  }

  function openRelatedTicketListModal(ids, title = "关联工单") {
    const rows = normalizeRelatedTicketIds(ids).map(ticketId => ticketRowById(ticketId) || [ticketId, "工单", "-", "-", "-", "-", "-"]);
    const body = rows.map(ticket => '<tr><td><button type="button" class="btn-link" data-action="detail" data-id="' + escapeAttribute(ticket[0]) + '">' + escapeAttribute(ticket[0]) + '</button></td><td>' + escapeAttribute(ticket[1] || "-") + '</td><td>' + escapeAttribute(ticket[2] || "-") + '</td><td>' + escapeAttribute(ticket[3] || "-") + '</td><td>' + escapeAttribute(ticket[4] || "-") + '</td><td>' + statusTag(ticket[5] || "-") + '</td></tr>').join("") || '<tr><td colspan="6">-</td></tr>';
    openModal(title, '<div class="related-ticket-dialog"><div class="table-wrap"><table class="table ds-table"><thead><tr><th>工单编号</th><th>工单类型</th><th>客户姓名</th><th>投诉/信访事项</th><th>当前机构</th><th>工单状态</th></tr></thead><tbody>' + body + '</tbody></table></div></div>', "关闭", undefined, { size: "wide" });
    bindActionButtons(document.querySelector("#overlay-root"));
  }

  function openRectificationRelatedTickets(rectificationId) {
    const row = rectificationRows.find(item => item[0] === rectificationId);
    if (!row) return toast("未找到溯源整改单", true);
    openRelatedTicketListModal(rectificationRelatedTicketIds(row), "关联工单编号");
  }

  function openRectificationRelatedTicketQuery() {
    const row = rectificationRows.find(item => item[0] === state.rectificationEditId) || null;
    const selectedIds = new Set(rectificationRelatedTicketIds(row));
    const pageSize = 20;
    let currentPage = 1;
    let filters = {};
    const renderPage = () => {
      const rows = getRectificationPickerRows().filter(item => {
        if (filters.id && !String(item[0]).includes(filters.id)) return false;
        if (filters.customer && !String(item[2]).includes(filters.customer)) return false;
        if (filters.type && filters.type !== "全部" && item[1] !== filters.type) return false;
        if (filters.status && filters.status !== "全部" && item[5] !== filters.status) return false;
        return true;
      });
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      currentPage = Math.min(totalPages, Math.max(1, currentPage));
      const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
      const body = pageRows.length
        ? pageRows.map(item => '<tr data-rectification-query-row="' + escapeAttribute(item[0]) + '"><td><input type="checkbox" name="rectification-related-result" value="' + escapeAttribute(item[0]) + '" ' + (selectedIds.has(item[0]) ? 'checked' : '') + '></td><td class="primary-cell">' + escapeAttribute(item[0]) + '</td><td>' + renderTicketTypeWithKind(item) + '</td><td>' + escapeAttribute(item[2]) + '</td><td>' + escapeAttribute(item[3]) + '</td><td>' + escapeAttribute(item[4]) + '</td><td>' + (item[5] === '-' ? '-' : statusTag(item[5])) + '</td></tr>').join('')
        : tableEmptyStateRow(7);
      const pages = Array.from({ length: totalPages }, (_, index) => index + 1).map(page => '<button type="button" class="page-btn ' + (page === currentPage ? 'is-active' : '') + '" data-rectification-query-page="' + page + '">' + page + '</button>').join('');
      const host = document.querySelector('[data-rectification-query-table]');
      if (host) host.innerHTML = '<div class="table-wrap"><table class="table ds-table query-result-table"><thead><tr><th></th><th>工单编号</th><th>工单类型</th><th>客户姓名</th><th>受理渠道</th><th>当前机构</th><th>工单状态</th></tr></thead><tbody>' + body + '</tbody></table></div><div class="pagination ds-pagination rectification-query-pagination"><span class="pagination-total">共 ' + rows.length + ' 条</span><nav class="pagination-nav" aria-label="关联工单分页"><button type="button" class="page-btn pagination-arrow" data-rectification-query-page="' + Math.max(1, currentPage - 1) + '" ' + (currentPage <= 1 ? 'disabled' : '') + '>‹</button>' + pages + '<button type="button" class="page-btn pagination-arrow" data-rectification-query-page="' + Math.min(totalPages, currentPage + 1) + '" ' + (currentPage >= totalPages ? 'disabled' : '') + '>›</button></nav><strong class="pagination-current">第 ' + currentPage + ' / ' + totalPages + ' 页</strong></div>';
      applyTableEmptyStates(host);
    };
    const filterRow = '<div class="query-filter-row"><label><span>工单编号</span><input class="di-input" data-rectification-query-filter="id" placeholder="输入工单编号"></label><label><span>客户姓名</span><input class="di-input" data-rectification-query-filter="customer" placeholder="输入客户姓名"></label><label><span>工单类型</span><select class="di-native-select" data-rectification-query-filter="type"><option>全部</option>' + ["投诉单", "信访单", "表扬单", "建议单"].map(value => '<option>' + value + '</option>').join('') + '</select></label><label><span>工单状态</span><select class="di-native-select" data-rectification-query-filter="status"><option>全部</option>' + (DOCUMENT_STATE_MACHINES.ticket.statuses || []).map(value => '<option>' + value + '</option>').join('') + '</select></label><button type="button" class="btn xib-btn xib-btn--primary" data-rectification-query-submit>查询</button></div>';
    openModal('查询关联工单', '<div class="query-dialog">' + filterRow + '<div class="query-result-title"><strong>可关联工单</strong><span>每页最多展示20条，可多选关联工单</span></div><div data-rectification-query-table></div></div>', '确认关联', () => {
      const selected = [...selectedIds];
      if (!selected.length) return toast('请至少选择一条工单', true);
      setRectificationRelatedTickets(selected);
      closeOverlay();
      rerenderPage();
      toast('已选择关联工单 ' + selected.join('、'));
    });
    renderPage();
    const root = document.querySelector('#overlay-root .modal-body');
    root?.addEventListener('change', event => {
      const checkbox = event.target.closest('input[name="rectification-related-result"]');
      if (!checkbox) return;
      if (checkbox.checked) selectedIds.add(checkbox.value); else selectedIds.delete(checkbox.value);
    });
    root?.addEventListener('click', event => {
      const pageButton = event.target.closest('[data-rectification-query-page]');
      if (pageButton && !pageButton.disabled) { currentPage = Number(pageButton.dataset.rectificationQueryPage) || 1; renderPage(); return; }
      if (event.target.closest('[data-rectification-query-submit]')) {
        const read = key => root.querySelector('[data-rectification-query-filter="' + key + '"]')?.value || '';
        filters = { id:read('id').trim(), customer:read('customer').trim(), type:read('type'), status:read('status') };
        currentPage = 1;
        renderPage();
      }
    });
  }

  function openSubprocessRelatedTickets(subprocessId) {
    const row = workflowRow("subprocess", subprocessId);
    if (!row) return toast("未找到子流程单", true);
    openRelatedTicketListModal(subprocessRelatedTicketIds(row), "关联工单编号");
  }

  function exportApprovalRelatedTicketIds(approvalId) {
    const exportRequest = exportRequestRows.find(item => item[0] === approvalId);
    const approval = approvalRows.find(item => item[0] === approvalId);
    return normalizeRelatedTicketIds(exportRequest?.[8] || approval?.[8]);
  }

  function renderExportApprovalRelatedTickets(approvalId) {
    const ids = exportApprovalRelatedTicketIds(approvalId);
    if (!ids.length) return "-";
    if (ids.length === 1) return '<button type="button" class="btn-link" data-action="detail" data-id="' + escapeAttribute(ids[0]) + '">' + escapeAttribute(ids[0]) + '</button>';
    return '<button type="button" class="btn-link" data-action="export-approval-related-tickets" data-id="' + escapeAttribute(approvalId) + '">' + escapeAttribute(ids[0]) + '/...</button>';
  }

  function openExportApprovalRelatedTickets(approvalId) {
    const ids = exportApprovalRelatedTicketIds(approvalId);
    if (!ids.length) return toast("当前导出申请没有关联工单", true);
    openRelatedTicketListModal(ids, "关联工单编号");
  }

  function handleAction(action, id, customerScope = "", subprocessType = "", trigger = null) {
    if (window.XIBModuleRegistry?.handleAction(action, { id, customerScope, subprocessType, trigger }, moduleContext())) return;
    if (["edit-business-line", "cancel-business-line", "save-business-line"].includes(action)) {
      const row = ticketRowById(trigger?.dataset.ticket || state.detailId) || ticketRows[0];
      const draftKey = businessLineDraftKey(row);
      if (action === "edit-business-line") {
        state.formValues[draftKey] = ticketBusinessLineValue(row);
        state.businessLineEditing = row[0];
        refreshBusinessLineDetailItem(row);
        return;
      }
      if (action === "cancel-business-line") {
        delete state.formValues[draftKey];
        state.businessLineEditing = "";
        refreshBusinessLineDetailItem(row);
        return;
      }
      const selected = state.formValues[draftKey];
      if (!selected?.primary) return toast("请选择一项必选条线", true);
      const record = documentRecordFor("ticket", row);
      if (!record) return toast("未找到工单结构化数据", true);
      record.fields = record.fields || {};
      record.fields.entry = record.fields.entry || {};
      const previous = deepClone(record.fields.entry["所属业务条线"] || { primary:"-", optional:"" });
      record.fields.entry["所属业务条线"] = deepClone(selected);
      recordTicketEntryFieldChange(row, "所属业务条线", previous, selected);
      delete state.formValues[draftKey];
      state.businessLineEditing = "";
      persistWorkflowState();
      refreshBusinessLineDetailItem(row);
      return toast("所属业务条线已更新");
    }
    if (["edit-correction-tag", "cancel-correction-tag", "save-correction-tag"].includes(action)) {
      const row = ticketRowById(trigger?.dataset.ticket || state.detailId) || ticketRows[0];
      const sourceName = id;
      const correctionName = correctionTagName(sourceName);
      const draftKey = correctionTagDraftKey(row, sourceName);
      const liveKey = "processing." + row[0] + "." + correctionName;
      if (!correctionName) return toast("未找到对应的标签字典", true);
      if (action === "edit-correction-tag") {
        const previous = state.correctionTagEditing;
        const current = row[0] + "::" + sourceName;
        if (previous && previous !== current) {
          const separator = previous.indexOf("::");
          const previousTicketId = previous.slice(0, separator);
          const previousSourceName = previous.slice(separator + 2);
          const previousRow = ticketRowById(previousTicketId) || row;
          delete state.formValues[correctionTagDraftKey(previousRow, previousSourceName)];
          state.correctionTagEditing = "";
          refreshSmartTagItem(previousRow, previousSourceName);
        }
        state.formValues[draftKey] = state.formValues[liveKey] || smartTagCorrectionValue(row, sourceName) || "";
        state.correctionTagEditing = current;
        refreshSmartTagItem(row, sourceName);
        return;
      }
      if (action === "cancel-correction-tag") {
        delete state.formValues[draftKey];
        state.correctionTagEditing = "";
        refreshSmartTagItem(row, sourceName);
        return;
      }
      const selected = state.formValues[draftKey];
      if (!selected) return toast("请选择修正后的标签", true);
      state.formValues[liveKey] = selected;
      delete state.formValues[draftKey];
      state.correctionTagEditing = "";
      persistWorkflowState();
      refreshSmartTagItem(row, sourceName);
      return toast(sourceName + "已修正");
    }
    if (action === "reset-demo-data") return openModal("恢复默认数据", '<div class="action-dialog"><div class="action-dialog-question"><strong>恢复所有模块的默认演示数据？</strong><span>将从 seed-data.json 对应的初始备份恢复主工单、完整表单字段、子流程、整改、审批与流转历史。当前开发测试视图和机构身份会保留。</span></div></div>', "确认恢复", () => { [WORKFLOW_STORAGE_KEY, ...LEGACY_STORAGE_KEYS].forEach(key => localStorage.removeItem(key)); window.location.reload(); });
    if (action === "navigate-back") return navigateBack(id);
    if (action === "admin-modal") return openModal(id || "后台管理", "该操作保留同事原型中的入口，后续可继续补充表单校验与真实保存逻辑。", "确认");
    if (action === "export-analysis") return toast("已创建统计分析导出任务");
    if (action === "rectification-related-tickets") return openRectificationRelatedTickets(id);
    if (action === "search-rectification-related-tickets") return openRectificationRelatedTicketQuery();
    if (action === "subprocess-related-tickets") return openSubprocessRelatedTickets(id);
    if (action === "export-approval-related-tickets") return openExportApprovalRelatedTickets(id);
    if (action === "open-import") return openImportDrawer();
    if (action === "review") return openReviewConfirm(id);
    if (action === "withdraw-submission") return openWithdrawSubmissionDialog(id);
    if (action === "withdraw-export-request") return openExportRequestWithdrawDialog(id);
    if (action === "transfer-approval") return openTransferApprovalDialog(id);
    if (action === "export-request-detail") return openExportRequestDetail(id);
    if (action === "download-export") {
      const row = exportRequestRows.find(item => item[0] === id);
      if (!exportRequestDownloadAvailable(row)) return toast("导出文件已过期，请重新提交导出申请", true);
      row[15] = "已下载";
      toast(id + " 的导出文件已开始下载");
      rerenderPage();
      return;
    }
    if (action === "export-row") return openExportApplicationDialog([id]);
    if (action === "reapply-export-request") return openExportApplicationDialog([], id);
    if (action === "edit-export-request") return openExportApplicationDialog([], id);
    if (action === "void-export-request") return markExportRequestVoided(id);
    if (action === "rectification-detail" || action === "rectification-process") {
      state.approvalContext = null;
      state.rectificationReturnPage = ["rectification-create", "rectification-process", "rectification-approve"].includes(state.page) ? state.page : (action === "rectification-process" ? "rectification-process" : "rectification-create");
      state.rectificationMode = action === "rectification-process" ? "process" : "view";
      state.subprocessId = id;
      return navigate("rectification-detail");
    }
    if (action === "rectification-approve") {
      const row = rectificationRows.find(item => item[0] === id);
      state.approvalContext = { requestId: id, type: "子流程审批", mode: "full", ticketId: row?.[2] || "", subprocessId: id };
      state.rectificationReturnPage = "rectification-approve";
      state.rectificationMode = "approve";
      state.subprocessId = id;
      state.subprocessDetailTab = "基本信息";
      resetApprovalFormValues("approval");
      return navigate("rectification-detail");
    }
    if (action === "rectification-export") {
      return openRectificationExportDialog([id]);
    }
    if (action === "void-rectification") {
      const row = workflowRow("rectification", id);
      return openModal("确认废止溯源整改单", '<div class="action-dialog"><div class="action-dialog-question"><strong>确认废止 ' + id + '？</strong><span>废止后流程终止，单据保留在台账中且不可继续编辑。</span></div><label class="action-full-field"><span>废止原因</span><textarea class="di-textarea" id="rectification-void-reason" placeholder="请输入废止原因"></textarea></label></div>', "确认废止", () => {
        const reason = document.getElementById("rectification-void-reason")?.value.trim();
        if (!reason) return toast("请填写废止原因", true);
        const result = workflowTransition("rectification", id, "void", { action:"废止", opinion:reason, result:"通过", receiver:"-" });
        if (!result.ok) return toast(result.reason, true);
        row[8] = "流程终止"; closeOverlay(); rerenderPage(); toast(id + " 已废止");
      });
    }
    if (action === "new-subprocess") { if (!["operator", "handler", "developer"].includes(state.role)) return toast("仅经办员、处理员可发起子流程", true); state.subprocessEditingId = ""; state.subprocessType = ""; state.subprocessSourceTicket = ""; state.formValues = {}; return navigate("subprocess-form"); }
    if (action === "choose-subprocess") return openSubprocessTypePicker(id);
    if (action === "quick-subprocess") return openQuickSubprocess(subprocessType, state.detailId);
    if (action === "quick-subprocess-detail") return openQuickSubprocessDetail(id);
    if (action === "open-ticket-basic") return openTicketDetail(id);
    if (action === "open-related-workspace") {
      state.relatedRootTicketId = id;
      state.relatedItemId = id;
      state.relatedSourceSubprocessId = subprocessType || state.subprocessId;
      state.detailId = id;
      state.detailTab = "关联单据";
      closeOverlay();
      return navigate("ticket-detail");
    }
    if (action === "open-related-subprocess") { state.approvalContext = null; state.detailEntry = "view"; state.subprocessId = id; state.subprocessDetailTab = "基本信息"; return navigate("subprocess-detail"); }
    if (action === "toggle-subprocess-flow") { state.expandedSubprocessFlows.has(subprocessType) ? state.expandedSubprocessFlows.delete(subprocessType) : state.expandedSubprocessFlows.add(subprocessType); return rerenderPage(); }
    if (["process-linked-subprocess", "review-linked-subprocess", "approve-linked-subprocess"].includes(action)) {
      const records = linkedSubprocessRecords(state.detailId).filter(record => record.type === subprocessType);
      const capabilities = subprocessCapabilities(subprocessType, records.length > 0);
      const permissionKey = action === "process-linked-subprocess" ? "process" : action === "review-linked-subprocess" ? "review" : "approve";
      if (!records.length) return toast("该子流程尚未发起", true);
      if (!capabilities[permissionKey]) return toast("当前机构与角色无此操作权限", true);
      const record = records[0];
      if (permissionKey === "process") { state.approvalContext = null; state.detailEntry = "process"; state.subprocessId = record.id; state.subprocessDetailTab = "基本信息"; return navigate("subprocess-detail"); }
      if (permissionKey === "review") return openModal("子流程复核 / 初审", `确认 ${record.document} ${record.id} 的材料完整、处理意见符合要求。`, "确认通过", () => { closeOverlay(); toast(`${record.id} 已通过复核 / 初审`); });
      return openApprovalReview(record.id);
    }
    if (action === "save-processing") return toast("处理草稿已保存");
    if (action === "submit-processing") return submitProcessingResult();
    if (action === "save-subprocess-processing") return saveSubprocessProcessingDraft();
    if (action === "reject-rectification-plan") return rejectRectificationPlan();
    if (action === "reject-subprocess-processing") return rejectSubprocessProcessing();
    if (action === "submit-subprocess-processing") return submitSubprocessProcessing();
    if (action === "upload-placeholder") return toast("已打开附件选择器");
    if (action === "call-customer") return openOutboundNumberPicker();
    if (action === "add-contact") return openNewContactRecord();
    if (action === "send-sms") return openSmsCommunication();
    if (action === "query-sms-receipt") return openSmsReceiptQuery(ticketRowById(trigger?.dataset.ticket) || activeContactTicket());
    if (action === "contact-detail") return openContactRecordDetail(Number(id || 0), ticketRowById(trigger?.dataset.ticket) || activeContactTicket());
    if (action === "resend-sms") return resendSmsContact(Number(id || 0), ticketRowById(trigger?.dataset.ticket) || activeContactTicket());
    if (action === "edit-rejected-sms") return openSmsCommunication(contactRecordsForTicket(ticketRowById(trigger?.dataset.ticket) || activeContactTicket())[Number(id || 0)]);
    if (action === "supplement-contact-detail") { const row = workflowRow("subprocess", state.subprocessId); return openContactRecordDetail(Number(id || 0), ticketRowById(row?.[2]) || undefined); }
    if (action === "select-supplement-contact") return selectSupplementContact(Number(id || 0));
    if (action === "contact-attachment") {
      const recordIndex = id !== undefined && id !== "" && Number.isInteger(Number(id)) ? Number(id) : null;
      if (recordIndex !== null) return openContactAttachment(recordIndex, ticketRowById(trigger?.dataset.ticket) || activeContactTicket());
      return toast("正在打开联系记录附件");
    }
    if (action === "preview-attachment") return openModal("附件预览", '<div class="attachment-preview"><strong>附件已加载</strong><p>此处展示附件 ' + (Number(id) + 1) + ' 的脱敏预览内容，原型不读取真实业务材料。</p></div>', "关闭");
    if (action === "download-attachment") return toast("附件已加入下载任务");
    if (action === "risk-record-retry") {
      const index = Number(id);
      if (!Number.isInteger(index) || index < 0) return;
      state.riskRetryByTicket[state.detailId] ||= {};
      state.riskRetryByTicket[state.detailId][index] = true;
      return rerenderPage(false, { instant:true });
    }
    if (action === "risk-record-detail") {
      const [recordIndex, kind] = String(id || "").split(":");
      const row = workflowRow("ticket", state.detailId) || ticketRows[0];
      return openRiskRecordDetail(row, Number(recordIndex), kind === "gray" ? "gray" : "content");
    }
    if (action === "add-manual-risk-tag") {
      const row = workflowRow("ticket", state.detailId) || ticketRows[0];
      if (!canEditManualRiskTags(row)) return toast("当前角色不能修改人工标签", true);
      const label = document.querySelector("[data-manual-risk-label]")?.value;
      if (!MANUAL_RISK_TAG_OPTIONS.some(item => item.label === label)) return toast("请选择有效的风险标签", true);
      state.manualRiskTagsByTicket[row[0]] = [...new Set([...manualRiskTagsForTicket(row), label])];
      persistWorkflowState();
      return rerenderPage();
    }
    if (action === "remove-manual-risk-tag") {
      const row = workflowRow("ticket", state.detailId) || ticketRows[0];
      if (!canEditManualRiskTags(row)) return toast("当前角色不能修改人工标签", true);
      state.manualRiskTagsByTicket[row[0]] = manualRiskTagsForTicket(row).filter(label => label !== id);
      persistWorkflowState();
      return rerenderPage();
    }
    if (action === "risk-detail") {
      const row = workflowRow("ticket", state.detailId) || ticketRows[0];
      const policy = workflowPolicy("ticket", row);
      const editable = state.detailTab === "处理信息" && policy.canProcess;
      return openRiskDetail(row, id, editable);
    }
    if (action === "view-call-transcript") return openCallTranscript(id);
    if (action === "edit-subprocess") { const row = subprocessRows.find(item => item[0] === id); state.detailEntry = "create"; state.formValues = {}; if (row) hydrateSubprocessFormForEdit(row); return navigate("subprocess-form"); }
    if (action === "process-subprocess") { const row = workflowRow("subprocess", id); if (row?.[5] === "待处理") { const claimResult = workflowTransition("subprocess", id, "claim", { action:"领取", opinion:"领取子流程单并开始处理。" }); if (!claimResult.ok) return toast(claimResult.reason, true); } state.subprocessScope = "我的工作台"; state.approvalContext = null; state.detailEntry = "process"; state.subprocessId = id; state.detailId = row?.[2] || state.detailId; state.subprocessDetailTab = subprocessHasProcessingStage(row?.[1], row) ? "处理信息" : "基本信息"; return navigate("subprocess-detail"); }
    if (action === "supplement-subprocess") { const row = workflowRow("subprocess", id); state.approvalContext = null; state.detailEntry = "supplement"; state.subprocessId = id; state.detailId = row?.[2] || state.detailId; state.subprocessDetailTab = subprocessHasProcessingStage(row?.[1], row) ? "处理信息" : "基本信息"; return navigate("subprocess-detail"); }
    if (action === "save-subprocess-supplement") return saveSubprocessSupplement();
    if (action === "submit-subprocess-supplement") return submitSubprocessSupplement();
    if (action === "claim-subprocess") { const result = workflowTransition("subprocess", id, "claim", { action:"领取", opinion:"已领取子流程单并开始处理。" }); toast(result.ok ? `已领取子流程单 ${id}` : result.reason, !result.ok); rerenderPage(); return; }
    if (action === "transfer-subprocess") return openAssignmentDialog("subprocess", id);
    if (action === "save-subprocess-draft") return saveSubprocessDraft();
    if (action === "submit-subprocess") return submitSubprocess();
    if (action === "remove-subprocess-related-ticket") {
      const idx = (state.subprocessSourceTickets || []).indexOf(id);
      if (idx >= 0) state.subprocessSourceTickets.splice(idx, 1);
      if (state.subprocessSourceTicket === id) state.subprocessSourceTicket = "";
      rerenderPage();
      return;
    }
    if (action === "search-related-ticket") return openRelatedTicketQuery();
    if (action === "search-repeat-ticket") return openRepeatMainTicketQuery();
    if (action === "approval-subprocess-detail") { state.approvalContext = { requestId:id, type:"子流程审批", mode:"view", subprocessId:id }; state.detailEntry = "view"; state.subprocessId = id; state.subprocessDetailTab = "基本信息"; return navigate("subprocess-detail"); }
    if (action === "subprocess-detail") { state.approvalContext = null; state.detailEntry = "view"; state.subprocessId = id; state.subprocessDetailTab = "基本信息"; return navigate("subprocess-detail"); }
    if (action === "export-query") return openExportApplicationDialog();
    if (action === "reset-filter") {
      const hadReceivingInstitutionFilter = Boolean(state.formValues["filter.ticket.org"]?.length || state.formValues["filter.ticket.org"]);
      resetCurrentFilters(trigger);
      let shouldRerender = false;
      if (state.page === "ledger-query" && state.queryTab === "子流程单导出") {
        shouldRerender = Boolean(state.querySubprocessType);
        state.querySubprocessType = "";
      } else if (state.page === "ledger-query" && state.queryTab === "工单导出") {
        shouldRerender = Boolean(state.queryTicketType || state.queryComplaintQuickFilters?.length);
        state.queryTicketType = "";
        state.queryComplaintQuickFilters = [];
      } else if (state.page === "ticket-create") {
        shouldRerender = hadReceivingInstitutionFilter || Boolean(state.receivingDepartmentFilters.create);
        state.receivingDepartmentFilters.create = "";
      } else if (state.page === "ticket-process") {
        shouldRerender = hadReceivingInstitutionFilter || Boolean(state.processTicketType || state.receivingDepartmentFilters.process);
        state.processTicketType = "";
        state.receivingDepartmentFilters.process = "";
      } else if (state.page === "my-approvals") {
        shouldRerender = hadReceivingInstitutionFilter || Boolean(state.approvalFilterType || state.receivingDepartmentFilters.approval);
        state.approvalFilterType = "";
        state.receivingDepartmentFilters.approval = "";
      }
      if (shouldRerender) rerenderPage();
      toast("筛选条件已重置");
      return;
    }
    if (action === "search") { const result = applyCurrentFilters(trigger); return toast(result.tables ? "已按当前条件筛选，共 " + result.count + " 条" : "当前页面没有可筛选的数据", !result.tables); }
    if (action === "refresh") return toast("数据已刷新");
    if (action === "save-draft") return toast("草稿已保存");
    if (action === "demo-fill-ticket") return fillTicketDemo();
    if (action === "demo-fill-processing") return fillProcessingDemo();
    if (action === "demo-fill-subprocess") return fillSubprocessDemo();
    if (action === "demo-fill-subprocess-processing") return fillSubprocessProcessingDemo();
    if (action === "smart-classify") return smartClassify();
    if (action === "refresh-smart-dispatch") return refreshSmartDispatch();
    if (action === "submit-ticket") return submitTicket();
    if (action === "customer-search") return queryCustomer(customerScope);
    if (action === "customer-history") return openCustomerHistory(customerScope);
    if (action === "ticket-field-inventory") return openTicketFieldInventory(id);
    if (action === "subprocess-field-inventory") return openSubprocessFieldInventory(id);
    if (action === "history-field-inventory") return openHistoryFieldInventory(id);
    if (action === "detail" && /^(TS|XF|BY|JY|YQ)/.test(id || "")) { state.warningContextId = ""; const row = workflowRow("ticket", id); if (state.page === "ticket-process" && state.processScope === "本机构工单池" && row?.[5] === "待处理" && ["handler", "developer"].includes(state.role)) { const result = workflowTransition("ticket", id, "claim", { action:"查看领取", opinion:"查看工单并自动领取进入处理。", receiver:"当前处理人" }); if (!result.ok) return toast(result.reason, true); toast("已领取 " + id); state.detailEntry = "process"; } else { state.detailEntry = "view"; } state.approvalContext = null; state.detailId = id; state.detailTab = "基本信息"; state.relatedRootTicketId = id; state.relatedItemId = id; state.relatedSourceSubprocessId = ""; return navigate("ticket-detail"); }
    if (action === "detail") return openModal("业务详情", `正在查看业务单 ${id}。详情页将汇总基本信息、流转记录、联系记录和关联申请。`, "关闭");
    if (action === "claim") { const result = workflowTransition("ticket", id, "claim", { action:"领取", opinion:"已领取工单并进入处理。" }); toast(result.ok ? `已领取 ${id}` : result.reason, !result.ok); rerenderPage(); return; }
    if (action === "edit") {
      state.ticketDraftSource = state.createTab || "";
      const importedDraft = state.importDraftDataById[id];
      state.activeImportDraftId = importedDraft ? id : "";
      state.importFieldErrors = deepClone(importedDraft?.fieldErrors || {});
      if (importedDraft) {
        state.ticketEditingId = "";
        state.workOrderType = importedDraft.type || "投诉单";
        state.formValues = deepClone(importedDraft.values || {});
      } else {
        hydrateTicketFormForEdit(workflowRow("ticket", id));
      }
      toast(`正在编辑 ${id}`);
      return navigate("ticket-form");
    }
    if (action === "remind") return openRemindConfirmDialog(id);
    if (action === "process") {
      const targetRow = workflowRow("ticket", id);
      if (targetRow && targetRow[5] === "待处理") {
        const claimResult = workflowTransition("ticket", id, "claim", { action: "领取", opinion: "领取工单并进入处理。" });
        if (!claimResult.ok) return toast(claimResult.reason, true);
        // 领取后工单属于当前处理员，不能继续停留在机构工单池中查看。
        state.processScope = "我的工作台";
        state.processTab = "待办";
      }
      state.approvalContext = null; state.detailEntry = "process"; state.detailId = id; state.detailTab = customerManagerConflictsWithActiveHandler(id) ? "处理信息" : "基本信息"; state.relatedRootTicketId = id; state.relatedItemId = id; state.relatedSourceSubprocessId = ""; return navigate("ticket-detail");
    }
    if (action === "transfer") return openAssignmentDialog("ticket", id);
    if (action === "void-row") return markDocumentVoided(id && /^(TS|XF|BY|JY|YQ)/.test(id) ? "ticket" : "subprocess", id);
    if (action === "delete-row") {
      const scope = trigger?.closest("tr")?.querySelector("[data-row-select]")?.dataset.rowSelect || "tickets";
      const context = batchRecordContext(scope, id);
      const deletionWarning = state.createTab === "导入记录" ? "删除后该导入记录无法恢复。" : "删除后该草稿无法恢复。";
      return openModal("确认删除", `<div class="action-dialog"><div class="action-dialog-question"><strong>确认删除 ${id}？</strong><span>${deletionWarning}</span></div></div>`, "确认删除", () => {
        try {
          const message = deleteBatchRecord(context);
          persistWorkflowState();
          closeOverlay();
          rerenderPage(false, { instant:true });
          toast(message);
        } catch (error) {
          toast(error?.message || "当前记录不能删除", true);
        }
      });
    }
    if (action === "approve") return openApprovalReview(id);
    if (action === "save-approval") return toast(approvalFormConfig().label + "意见已保存");
    if (action === "submit-approval") return submitApprovalReview();
    if (action === "duplicate") { state.workOrderType = ""; state.ticketDraftSource = ""; state.formValues = {}; state.collapsedCustomers.clear(); return navigate("ticket-form"); }
  }

  function openSubprocessTypePicker(ticketId) {
    if (!["operator", "handler", "developer"].includes(state.role)) return toast("仅经办员、处理员可发起子流程", true);
    state.subprocessSourceTicket = ticketId;
    state.subprocessSourceTickets = [];
    state.subprocessQuickSource = ticketId;
    state.subprocessType = "";
    state.formValues = {};
    navigate("subprocess-form");
    toast("已带入关联工单，申请时间将在提交后由系统生成");
  }

  function renderQuickSubprocessFields(definition) {
    const sections = subprocessDifferenceSections(definition, "create");
    if (!sections.length) return "";
    const scope = "quick-subprocess." + definition.type;
    return '<div class="quick-difference-sections">' + sections.map(section => '<section><h4>' + section.title + '</h4><div class="form-grid">' + section.fields.map(field => renderField(field, scope)).join("") + '</div></section>').join("") + '</div>';
  }

  function bindOverlayFormControls(root) {
    root.addEventListener("click", event => event.stopPropagation());
    root.addEventListener("click", event => {
      if (event.target.closest(".di-hierarchy-cascader,.di-custom-select,.di-native-select-shell,.di-picker-field,.di-cascader,.di-year-picker,.filter-status-multi")) return;
      root.querySelectorAll(".di-hierarchy-cascader-popover,.di-select-popover,.di-picker-popover,.di-cascader-popover,.di-year-popover,.filter-status-popover").forEach(panel => { panel.hidden = true; });
    });
    bindBusinessLinePickers(root);
    root.querySelectorAll("[data-app-hierarchy-cascader]").forEach(host => {
      if (host.dataset.overlayHierarchyBound === "true") return;
      host.dataset.overlayHierarchyBound = "true";
      const dictionary = host.dataset.dictionary;
      const fieldKey = host.dataset.fieldKey;
      const multiple = host.dataset.multiple === "true";
      const nonLeaf = host.dataset.nonLeaf === "true";
      const leafLevel = Number(host.dataset.leafLevel || 2);
      const levels = JSON.parse(host.dataset.levels || "[]");
      const tree = hierarchyTreeFor(dictionary);
      const field = { tree, levels, leafLevel, dictionary, multiple, nonLeafSelectable: nonLeaf, includeDescendantsOption: host.dataset.includeDescendants === "true", searchable: host.dataset.searchable === "true", showSelectedSummary: host.dataset.showSelectedSummary === "true", placeholder: host.dataset.placeholder || (dictionary === "institutionTree" ? "请选择机构范围" : "请选择") };
      const trigger = host.querySelector(".di-hierarchy-cascader-trigger");
      const popover = host.querySelector(".di-hierarchy-cascader-popover");
      const columns = host.querySelector("[data-hierarchy-columns]");
      const selectedHolder = host.querySelector("[data-hierarchy-selected]");
      const hidden = host.querySelector('input[type="hidden"]');
      const searchInput = host.querySelector("[data-hierarchy-search]");
      const searchResults = host.querySelector("[data-hierarchy-search-results]");
      let selected = multiple ? normalizeHierarchySelection(field, Array.isArray(state.formValues[host.dataset.fieldKey]) ? [...state.formValues[host.dataset.fieldKey]] : []) : (state.formValues[host.dataset.fieldKey] ? [state.formValues[host.dataset.fieldKey]] : []);
      let activePath = JSON.parse(host.dataset.activePath || "[]");
      const sync = () => {
        state.formValues[host.dataset.fieldKey] = multiple ? [...selected] : (selected[0] || "");
        hidden.value = selected.join(',');
        syncInstitutionDepartmentControls(host.closest(".overlay-card") || document, host.dataset.fieldKey);
        trigger.querySelector('span').innerHTML = isCountersignInstitutionKey(host.dataset.fieldKey)
          ? countersignTriggerValues(selected, selected.map(value => hierarchySelectionLabel(value, field.dictionary)), field.placeholder || "请选择")
          : escapeAttribute(hierarchyCollapsedSummary(field, selected));
        selectedHolder.innerHTML = hierarchySelectedTags(selected, true, field?.dictionary);
        columns.innerHTML = hierarchyColumnsHtml(field, activePath, selected);
        if (searchInput?.value.trim()) searchResults.innerHTML = hierarchySearchResultsHtml(field, searchInput.value, selected);
      };
      const updateSearch = () => {
        if (!searchInput || !searchResults) return;
        const query = searchInput.value.trim();
        searchResults.hidden = !query;
        columns.hidden = Boolean(query);
        searchResults.innerHTML = query ? hierarchySearchResultsHtml(field, query, selected) : "";
      };
      searchInput?.addEventListener("input", updateSearch);
      const inOverlay = Boolean(host.closest("#overlay-root"));
      const openHierarchyPopover = event => {
        event.preventDefault();
        event.stopPropagation();
        root.querySelectorAll('.di-hierarchy-cascader-popover,.di-select-popover,.di-picker-popover,.di-cascader-popover').forEach(panel => { if (panel !== popover) panel.hidden = true; });
        // Modal cascaders must open from a click and stay open until an option is chosen
        // or the user clicks outside.  Do not use the native press state as visibility.
        popover.hidden = false;
        positionHierarchyPopover(trigger, popover);
        if (searchInput) { searchInput.value = ""; updateSearch(); setTimeout(() => searchInput.focus(), 0); }
      };
      if (inOverlay) {
        // Let the document-level outside-click handler finish first, then open
        // on the next tick. This prevents the same click from immediately
        // closing the modal cascader after it has been opened.
        trigger.onclick = event => {
          event.preventDefault();
          event.stopPropagation();
          setTimeout(() => openHierarchyPopover(event), 0);
        };
      } else {
        trigger.addEventListener('click', event => { event.stopPropagation(); root.querySelectorAll('.di-hierarchy-cascader-popover,.di-select-popover,.di-picker-popover,.di-cascader-popover').forEach(panel => { if (panel !== popover) panel.hidden = true; }); popover.hidden = !popover.hidden; if (!popover.hidden) { positionHierarchyPopover(trigger, popover); if (searchInput) { searchInput.value = ""; updateSearch(); setTimeout(() => searchInput.focus(), 0); } } });
      }
      popover.addEventListener('click', event => {
        event.stopPropagation();
        const parent = event.target.closest('[data-hierarchy-parent]');
        const leaf = event.target.closest('[data-hierarchy-toggle]');
        const searchLeaf = event.target.closest('[data-hierarchy-search-toggle]');
        const remove = event.target.closest('[data-hierarchy-remove]');
        const descendants = event.target.closest('[data-hierarchy-descendants]');
        if (descendants) { const parentLabel = descendants.dataset.hierarchyDescendants; const branchValues = hierarchyBranchLeafValues(field, parentLabel); const groupValue = hierarchyDescendantGroupValue(parentLabel); selected = selected.filter(item => item !== groupValue && !branchValues.includes(item)); if (descendants.checked) selected.push(groupValue); selected = normalizeHierarchySelection(field, selected); activePath = [parentLabel, branchValues[0]?.split(' / ').at(-1) || parentLabel]; clearAiHighlight(host.dataset.fieldKey); sync(); return; }
        if (parent) { const level = Number(parent.dataset.hierarchyLevel); activePath.splice(level); activePath[level] = parent.dataset.hierarchyParent; const node = hierarchyNode(field.tree, activePath); if (node?.children?.length) activePath[level + 1] = node.children[0].label; if (nonLeaf) { const value = activePath.slice(0, level + 1).join(' / '); selected = multiple ? (selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]) : [value]; } sync(); return; }
        if (leaf || searchLeaf) { const value = leaf?.dataset.hierarchyToggle || searchLeaf.dataset.hierarchySearchToggle; selected = toggleHierarchySelection(field, selected, value); if (!multiple) popover.hidden = true; activePath = value.split(' / '); clearAiHighlight(host.dataset.fieldKey); sync(); return; }
        if (remove) { selected = selected.filter(item => item !== remove.dataset.hierarchyRemove); clearAiHighlight(host.dataset.fieldKey); sync(); }
      });
      host.querySelector('[data-hierarchy-clear]')?.addEventListener('click', event => { event.stopPropagation(); selected = []; clearAiHighlight(host.dataset.fieldKey); sync(); });
      host.querySelector('[data-hierarchy-confirm]')?.addEventListener('click', event => { event.stopPropagation(); sync(); popover.hidden = true; });
    });
    root.querySelectorAll("[data-app-select]").forEach(host => {
      const trigger = host.querySelector(".di-select-trigger"); const menu = host.querySelector(".di-select-popover"); const hidden = host.querySelector('input[type="hidden"]');
      host.dataset.overlayBound = "true";
      bindSelectSearch(menu);
      trigger.onpointerdown = event => { event.preventDefault(); event.stopPropagation(); root.querySelectorAll(".di-select-popover,.di-picker-popover").forEach(pop => { if (pop !== menu) pop.hidden = true; }); menu.hidden = false; positionAnchoredPopover(trigger, menu, { flipVertical: true }); focusSelectSearch(menu); };
      trigger.onclick = event => { event.preventDefault(); event.stopPropagation(); setTimeout(() => { const panel = trigger.parentElement.querySelector(".di-select-popover,.di-picker-popover"); if (panel) { panel.hidden = false; positionAnchoredPopover(trigger, panel, { flipVertical: true }); focusSelectSearch(panel); } }, 0); };
      menu.querySelectorAll("[data-select-value]").forEach(option => option.addEventListener("click", () => { trigger.querySelector("span").textContent = option.dataset.selectValue; trigger.querySelector("span").classList.remove("is-ai-generated"); hidden.value = option.dataset.selectValue; state.formValues[hidden.dataset.fieldKey] = hidden.value; state.aiGeneratedFields.delete(hidden.dataset.fieldKey); if (hidden.dataset.fieldKey.endsWith(".告知延期时间")) syncExtensionNoticeMethod(hidden.dataset.fieldKey, hidden.value); menu.hidden = true; const linkedName = hidden.dataset.fieldKey.split(".").pop(); if (["异常投诉类型","异常投诉具体表现"].includes(linkedName)) refreshLinkedFields(root, linkedName); }));
    });
    root.querySelectorAll("[data-app-radio]").forEach(host => host.querySelectorAll("[data-radio-value]").forEach(button => button.addEventListener("click", () => { host.querySelectorAll("[data-radio-value]").forEach(item => item.classList.toggle("is-checked", item === button)); const hidden = host.querySelector('input[type="hidden"]'); hidden.value = button.dataset.radioValue; state.formValues[hidden.dataset.fieldKey] = hidden.value; state.aiGeneratedFields.delete(hidden.dataset.fieldKey); syncApprovalOpinionRequirement(host, hidden.value); })));
    root.querySelectorAll("[data-app-checkbox-group]").forEach(host => host.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener("change", () => { state.formValues[host.dataset.fieldKey] = [...host.querySelectorAll("input:checked")].map(item => item.value); state.aiGeneratedFields.delete(host.dataset.fieldKey); })));
    root.querySelectorAll("[data-app-picker]").forEach(host => bindPickerControl(host, root));
    root.querySelectorAll("[data-drag-upload]").forEach(box => {
      const input = box.querySelector("[data-upload-input]"); const browse = box.querySelector("[data-upload-browse]"); const status = box.querySelector("[data-upload-status]");
      const selectFile = files => { const result = validateAttachmentSelection(files); if (!result.ok) return toast(result.message, true); const names = result.files.map(file => file.name); const appendResult = appendProcessingAttachmentFiles(box, names); if (appendResult.handled) { if (!appendResult.ok) return toast(appendResult.message, true); return; } status.textContent = "已选择：" + names.join("、"); browse.textContent = "重新选择"; box.classList.add("has-file"); if (box.dataset.fieldKey) state.formValues[box.dataset.fieldKey] = names.join("、"); };
      box.querySelector("[data-demo-upload]")?.addEventListener("click", event => { event.stopPropagation(); selectFile([{ name: event.currentTarget.dataset.demoFile, size:0 }]); });
      browse.addEventListener("click", event => { event.stopPropagation(); input.click(); }); input.addEventListener("change", () => selectFile(input.files));
      box.addEventListener("dragover", event => event.preventDefault()); box.addEventListener("drop", event => { event.preventDefault(); selectFile(event.dataTransfer.files); });
    });
    bindAmountInputs(root);
    root.querySelectorAll("[data-field-key]").forEach(control => { if (["hidden","radio"].includes(control.type)) return; control.addEventListener("input", () => { state.formValues[control.dataset.fieldKey] = control.value; state.aiGeneratedFields.delete(control.dataset.fieldKey); control.classList.remove("is-ai-generated"); syncCorrectionFieldHighlight(control, control.value); }); });
    enhanceNativeSelects(root);
  }
  function activeContactTicket() {
    if (state.subprocessId && state.detailEntry === "supplement") {
      const row = workflowRow("subprocess", state.subprocessId);
      const ticket = ticketRowById(row?.[2]);
      if (ticket) return ticket;
    }
    return ticketRowById(state.detailId) || ticketRows[0];
  }

  function contactProfile(ticket = activeContactTicket()) {
    const entry = documentRecordFor("ticket", ticket)?.fields?.entry || {};
    const numbers = [
      { label:"来电号码", value:entry["来电号码"] || entry["预留手机号码"] || "" },
      { label:"联系方式1", value:entry["联系方式1"] || entry["联系方式"] || "" },
      { label:"联系方式2", value:entry["联系方式2"] || "" }
    ].map(item => ({ ...item, value:String(item.value || "").trim() }))
      .filter(item => item.value && item.value !== "-");
    return {
      ticketId: ticket[0],
      customer: ticket[2],
      numbers
    };
  }

  function contactRecordKey(ticketId, record, index) {
    return ticketId + ":" + (record.id || "record-" + index);
  }

  function contactTimeDisplay(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text) ? text + ":00" : text;
  }

  // 录音编号沿用系统既有约定：CALL-YYYYMMDD-HHMMSS。
  // 优先取联系记录自带编号，其次取工单受理信息里登记的"录音编号"，最后按联系时间推导。
  function contactRecordingId(record, ticket) {
    const explicit = String(record?.recordingId || "").trim();
    if (explicit) return explicit;
    const registered = String(documentRecordFor("ticket", ticket)?.fields?.entry?.["录音编号"] || "").trim();
    if (registered) return registered;
    const stamp = String(record?.time || "").replace(/\D/g, "");
    if (stamp.length < 8) return "-";
    return "CALL-" + stamp.slice(0, 8) + "-" + (stamp.slice(8, 12) + "00").slice(0, 6);
  }

  function ensureSeedTicketContactRecords() {
    let changed = false;
    ticketSeedRecords.forEach(seed => {
      const ticket = ticketRows.find(row => row[0] === seed.id);
      if (!ticket) return;
      const existingRecords = state.contactRecordsByTicket[ticket[0]] || [];
      if (existingRecords.length) {
        const manualSms = existingRecords.find(record => record.id === "seed-contact-sms-manual-success");
        const acceptanceSms = existingRecords.find(record => record.id === "seed-contact-sms-acceptance");
        const needsSeedNormalization = existingRecords.some(record => ["seed-contact-phone-missed", "seed-contact-sms-manual-failed"].includes(record.id)) ||
          !acceptanceSms ||
          Boolean(manualSms && (manualSms.smsNumber || manualSms.contactStatus !== "已联系" || manualSms.platformCallStatus)) ||
          existingRecords.some(record => record.time && !["已联系", "调用成功"].includes(contactStatusForRecord(record))) ||
          existingRecords.some(record => record.method === "短信沟通" && String(record?.id || "").startsWith("seed-contact-sms-") && (!record.smsNumber || record.template === "处理进度告知短信"));
        if (needsSeedNormalization) {
          const normalizedRecords = existingRecords.filter(record => !["seed-contact-phone-missed", "seed-contact-sms-manual-failed"].includes(record.id));
          const normalizedManualSms = normalizedRecords.find(record => record.id === "seed-contact-sms-manual-success");
          const smsNumbers = {
            "seed-contact-sms-approved-success":"DX202607160001",
            "seed-contact-sms-approved-failed":"DX202607170001",
            "seed-contact-sms-rejected":"DX202607170002",
            "seed-contact-sms-pending":"DX202607170003",
            "seed-contact-sms-acceptance":"DX202607170004"
          };
          normalizedRecords.forEach(record => {
            if (smsNumbers[record.id]) record.smsNumber = smsNumbers[record.id];
            if (record.template === "处理进度告知短信") {
              record.template = "手工录入短信";
              record.smsContent = "手工录入短信待审批。";
              record.content = "手工录入短信待审批。";
            }
            if (!["已联系", "调用成功"].includes(contactStatusForRecord(record))) record.time = "";
          });
          if (!acceptanceSms) {
            const reference = normalizedRecords.find(record => record.id === "seed-contact-sms-approved-success") || normalizedRecords[0] || {};
            normalizedRecords.splice(2, 0, { ...reference, id:"seed-contact-sms-acceptance", smsNumber:"DX202607170004", time:"2026-07-16 11:20:00", method:"短信沟通", template:"投诉受理告知短信", receiver:reference.receiver || "13800001234", approvalRequired:true, smsApprovalStatus:"已通过", platformCallStatus:"调用成功", smsContent:"投诉受理告知短信已提交短信平台。", content:"投诉受理告知短信已提交短信平台。", attachment:"" });
          }
          if (normalizedManualSms) Object.assign(normalizedManualSms, { smsNumber:"", contactStatus:"已联系", smsApprovalStatus:"已通过", sendStatus:"已送达", platformCallStatus:"" });
          state.contactRecordsByTicket[ticket[0]] = normalizedRecords;
          changed = true;
        }
        return;
      }
      // 已有系统短信实例也属于联系记录，不再重复铺底。
      if (Object.prototype.hasOwnProperty.call(SEED_DATA.runtimeDefaults?.smsStatusByTicket || {}, ticket[0])) return;
      const entry = documentRecordFor("ticket", ticket)?.fields?.entry || {};
      const processing = documentRecordFor("ticket", ticket)?.fields?.processing || {};
      const contact = ticket[2] || "客户";
      const receiver = entry["联系方式"] || entry["预留手机号码"] || "13800001234";
      const org = ticket[4] || entry["工单接收机构"] || "厦门分行";
      const department = processing["工单接收部门"] || processing["工单处理部门"] || entry["工单接收部门"] || "消费者权益保护部";
      const base = { contact, org, department, operator:"林海-38102", content:"已就客户反映事项进行沟通，并记录客户意见及处理反馈。", feedback:"客户已知悉本次沟通内容。" };
      state.contactRecordsByTicket[ticket[0]] = [
        { ...base, id:"seed-contact-call-success", time:"2026-07-16 10:18:00", method:"一键外呼", phone:receiver, contactStatus:"已联系", answerStatus:"已接听", callDuration:"03:26", attachment:"客户沟通录音.mp3" },
        { ...base, id:"seed-contact-call-missed", time:"", method:"一键外呼", phone:receiver, contactStatus:"未接通", answerStatus:"未接听", feedback:"本次外呼未接通。", attachment:"" },
        { ...base, id:"seed-contact-sms-acceptance", smsNumber:"DX202607170004", time:"2026-07-16 11:20:00", method:"短信沟通", template:"投诉受理告知短信", receiver, approvalRequired:true, smsApprovalStatus:"已通过", platformCallStatus:"调用成功", smsContent:"投诉受理告知短信已提交短信平台。", content:"投诉受理告知短信已提交短信平台。", attachment:"" },
        { ...base, id:"seed-contact-sms-approved-success", smsNumber:"DX202607160001", time:"2026-07-16 15:46:00", method:"短信沟通", template:"办结告知短信", receiver, approvalRequired:true, smsApprovalStatus:"已通过", platformCallStatus:"调用成功", smsContent:"办结告知短信已提交短信平台。", attachment:"" },
        { ...base, id:"seed-contact-sms-approved-failed", smsNumber:"DX202607170001", time:"", method:"短信沟通", template:"办结告知短信", receiver, approvalRequired:true, smsApprovalStatus:"已通过", platformCallStatus:"调用失败", smsContent:"办结告知短信调用短信平台失败。", attachment:"" },
        { ...base, id:"seed-contact-sms-rejected", smsNumber:"DX202607170002", time:"", method:"短信沟通", template:"办结告知短信", receiver, approvalRequired:true, smsApprovalStatus:"已驳回", smsApprovalOpinion:"短信内容需进一步明确处理结论后重新提交。", platformCallStatus:"", smsContent:"待修改的办结告知短信。", attachment:"" },
        { ...base, id:"seed-contact-sms-pending", smsNumber:"DX202607170003", time:"", method:"短信沟通", template:"手工录入短信", receiver, approvalRequired:true, smsApprovalStatus:"待审批", platformCallStatus:"", smsContent:"手工录入短信待审批。", content:"手工录入短信待审批。", attachment:"" },
        { ...base, id:"seed-contact-phone-success", time:"2026-07-17 15:30:00", method:"电话", phone:receiver, contactStatus:"已联系", attachment:"电话沟通记录.pdf" },
        { ...base, id:"seed-contact-sms-manual-success", time:"2026-07-17 16:00:00", method:"短信", receiver, approvalRequired:false, smsApprovalStatus:"已通过", contactStatus:"已联系", sendStatus:"已送达", smsContent:"已通过短信与客户完成沟通。", attachment:"" },
        { ...base, id:"seed-contact-email", time:"2026-07-17 14:00:00", method:"邮件", contactStatus:"已联系", attachment:"邮件往来记录.pdf" },
        { ...base, id:"seed-contact-wechat", time:"2026-07-17 15:00:00", method:"微信", contactStatus:"已联系", attachment:"微信沟通截图.png" },
        { ...base, id:"seed-contact-visit", time:"2026-07-18 09:30:00", method:"面访", contactStatus:"已联系", attachment:"面访记录.pdf" },
        { ...base, id:"seed-contact-other", time:"2026-07-18 10:20:00", method:"其它", contactStatus:"已联系", attachment:"其它沟通材料.pdf" }
      ];
      changed = true;
    });
    return changed;
  }

  function contactRecordsForTicket(ticket = activeContactTicket()) {
    const instanceSmsStatus = Object.prototype.hasOwnProperty.call(SEED_DATA.runtimeDefaults?.smsStatusByTicket || {}, ticket[0])
      ? (state.smsStatusByTicket[ticket[0]] || SEED_DATA.runtimeDefaults.smsStatusByTicket[ticket[0]])
      : "";
    const instanceSmsRecords = instanceSmsStatus ? [{
      id:"instance-sms-" + ticket[0],
      time:"2026-07-16 15:46:00",
      contact:ticket[2],
      org:"厦门分行",
      method:"短信沟通",
      template:"办结告知短信",
      approvalRequired:true,
      smsApprovalStatus:instanceSmsStatus,
      contactStatus:instanceSmsStatus === "已通过" ? "已联系" : "",
      sendStatus:instanceSmsStatus === "已通过" ? "已送达" : "未发送",
      receiver:contactProfile(ticket).numbers[0]?.value || "-",
      content:smsTemplateContent("办结告知短信", { ticket:ticket[0], conclusion:"已核实相关业务办理情况，并向客户说明处理结论。" }),
      attachment:""
    }] : [];
    return instanceSmsRecords.concat(state.contactRecordsByTicket[ticket[0]] || []).map((record, index) => ({
      ...record,
      time: contactTimeDisplay(record.time || record.createdAt),
      operator: record.operator || contactOperatorForTicket(ticket),
      department: record.department || ticketReceivingDepartment(ticket) || currentRoleProfile().departmentLabel || "-",
      ...(state.contactRecordEditsByTicket[ticket[0]]?.[record.id] || {}),
      // 重发不覆盖原“未送达”记录，保留其重发入口与历史状态。
      ...(() => {
        const retry = state.smsRetryOverrides[contactRecordKey(ticket[0], record, index)] || {};
        return record.contactStatus === "未送达" ? { retryAt:retry.retryAt } : retry;
      })()
    }));
  }
  function appendContactRecord(record, ticketId = state.detailId) {
    const ticket = ticketRowById(ticketId);
    const savedRecord = {
      id:record.id || "contact-" + Date.now().toString(36),
      ...record,
      operator: record.operator || contactOperatorForTicket(ticket),
      department: record.department || ticketReceivingDepartment(ticket) || currentRoleProfile().departmentLabel || "-"
    };
    state.contactRecordsByTicket[ticketId] = [...(state.contactRecordsByTicket[ticketId] || []), savedRecord];
    persistWorkflowState();
    rerenderPage();
  }

  function updateContactRecord(record, changes, ticketId = state.detailId) {
    if (!record?.id) return false;
    state.contactRecordEditsByTicket[ticketId] = {
      ...(state.contactRecordEditsByTicket[ticketId] || {}),
      [record.id]: { ...(state.contactRecordEditsByTicket[ticketId]?.[record.id] || {}), ...changes }
    };
    persistWorkflowState();
    rerenderPage();
    return true;
  }

  function openContactAttachment(index, ticket = activeContactTicket()) {
    const record = contactRecordsForTicket(ticket)[index];
    if (!record) return toast("未找到联系记录", true);
    const attachment = contactAttachmentState(record);
    const isCall = ["一键外呼", "电话"].includes(record.method);
    // 非外呼记录也可查看附件；未上传时展示明确的空状态。
    if (!isCall) {
      const content = '<div class="contact-attachment-layout"><article class="contact-attachment-card"><div class="contact-attachment-card-head"><strong>' + escapeAttribute(record.method || "联系记录") + '附件</strong></div><dl class="contact-attachment-meta"><div><dt>沟通方式</dt><dd>' + escapeAttribute(record.method || "-") + '</dd></div><div><dt>联系时间</dt><dd>' + escapeAttribute(record.time || "-") + '</dd></div><div class="is-wide"><dt>附件</dt><dd>' + (attachment.status === "success" ? escapeAttribute(attachment.attachment) : attachment.status === "failed" ? "附件回传失败" : "暂无附件") + '</dd></div></dl></article></div>';
      return openModal("查看附件", content, "关闭", undefined, { hideCancel: true });
    }
    if (attachment.status !== "success") {
      const message = attachment.status === "failed" ? "录音文件回传失败" : contactStatusForRecord(record) === "未接通" ? "本次外呼未接通，暂无录音文件" : "录音文件尚未回传";
      return openModal("查看附件", '<div class="app-empty-state contact-attachment-empty"><h4>' + message + '</h4></div>', "关闭", undefined, { hideCancel: true });
    }
    const transcript = contactTranscriptState(record);
    // 转译回传期间同步说明后续风险识别结果的展示位置。
    const transcriptContent = transcript.status === "processing"
      ? '<div class="app-empty-state contact-attachment-empty"><h4>录音转译回传中</h4><p>回传成功后，系统会实时进行异常风险识别，识别结果可在“异常风险识别”里查看。</p></div>'
      : transcript.status === "pending"
        ? '<div class="app-empty-state contact-attachment-empty"><h4>录音转文本尚未回传</h4><p>第三方返回结果后将在此处展示。</p></div>'
      : transcript.status === "failed"
        ? '<div class="contact-transcript-failed">回传失败</div>'
        : '<div class="contact-transcript-text" role="region" aria-label="录音转译文本" tabindex="0">' + transcript.transcript.map(item => '<p class="contact-transcript-entry"><strong>' + escapeAttribute(item.speaker || "-") + ' ' + escapeAttribute(item.time || "-") + '</strong>' + escapeAttribute(item.text || "-") + '</p>').join("") + '</div>';
    // 录音编号只在信息表中展示一次，避免与标题右侧重复。
    const content = '<div class="contact-attachment-layout"><article class="contact-attachment-card"><div class="contact-attachment-card-head"><strong>录音文件</strong></div><dl class="contact-attachment-meta"><div class="is-wide"><dt>录音编号</dt><dd>' + escapeAttribute(contactRecordingId(record, ticket)) + '</dd></div><div><dt>客户</dt><dd>' + escapeAttribute(record.contact || ticket?.[2] || "-") + '</dd></div><div><dt>联系号码</dt><dd>' + escapeAttribute(record.phone || "-") + '</dd></div><div><dt>联系时间</dt><dd>' + escapeAttribute(record.time || "-") + '</dd></div></dl></article><article class="contact-attachment-card"><div class="contact-attachment-card-head"><strong>录音转文本</strong><span>' + (transcript.status === "success" ? "已回传" : transcript.status === "failed" ? "回传失败" : transcript.status === "processing" ? "回传中" : "待回传") + '</span></div>' + transcriptContent + '</article></div>';
    return openModal("查看附件", content, "关闭", undefined, { hideCancel: true });
  }

  function resendSmsContact(index, ticket = activeContactTicket()) {
    const record = contactRecordsForTicket(ticket)[index];
    if (!record || !canResendSmsRecord(record)) return toast("当前联系记录不满足重发条件", true);
    const approvalNote = record.approvalRequired === true ? "沿用原审批结果，无需再次审批。" : "该短信无需审批。";
    openModal("确认重发短信", `<div class="action-dialog"><div class="action-dialog-question"><strong>确认重发${record.template || "短信"}？</strong><span>${approvalNote}</span></div><dl class="action-summary-grid"><div><dt>接收号码</dt><dd>${escapeAttribute(record.receiver || "-")}</dd></div><div><dt>原联系状态</dt><dd>${contactStatusForRecord(record)}</dd></div></dl></div>`, "确认重发", () => {
      const retryAt = systemTimestamp();
      state.smsRetryOverrides[contactRecordKey(ticket[0], record, index)] = { retryAt };
      persistWorkflowState();
      closeOverlay();
      // 新增发送尝试，原未送达记录仍可追溯。
      appendContactRecord({ time:retryAt, contact:record.contact, org:record.org, department:record.department, method:record.method, template:record.template, approvalRequired:record.approvalRequired, smsApprovalStatus:smsApprovalStatusForRecord(record), contactStatus:"", sendStatus:"已发送", receiver:record.receiver, smsContent:record.smsContent || record.content, content:record.content, attachment:"", retryOf:record.id }, ticket[0]);
      toast("短信已重发，送达结果待回传");
    });
  }

  function contactSummaryMarkup(items) {
    return '<dl class="contact-confirm-list">' + items.map(item => '<div class="' + (item.wide ? 'is-wide' : '') + '"><dt>' + escapeAttribute(item.label) + '</dt><dd>' + escapeAttribute(item.value || '-') + '</dd></div>').join('') + '</dl>';
  }

  function showOverlayValidationError(message, target = null) {
    const body = document.querySelector("#overlay-root .modal-body");
    if (!body) return toast(message, true);
    const errorHost = body.querySelector(".call-feedback-scroll") || body;
    let notice = errorHost.querySelector(".modal-validation-error");
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "modal-validation-error";
      notice.setAttribute("role", "alert");
      errorHost.prepend(notice);
    }
    notice.innerHTML = '<span aria-hidden="true">!</span><strong>' + escapeAttribute(message) + '</strong>';
    notice.classList.remove("is-pulsing");
    requestAnimationFrame(() => notice.classList.add("is-pulsing"));
    target?.focus?.();
    toast(message, true);
  }
  function showContactResult(success, title, message, details = []) {
    const resultClass = success ? "is-success" : "is-error";
    const mark = success ? '<path d="M7.5 12.5l3 3 6-7"></path>' : '<path d="M9 9l6 6M15 9l-6 6"></path>';
    showOverlay('<div class="modal-mask" data-close-overlay></div><div class="modal is-wide contact-result-modal" data-modal-size="wide"><div class="modal-head">' + title + '<button class="icon-btn" data-close-overlay>' + icon("close") + '</button></div><div class="modal-body"><div class="contact-result ' + resultClass + '"><span class="contact-result-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle>' + mark + '</svg></span><strong>' + escapeAttribute(message) + '</strong>' + (details.length ? contactSummaryMarkup(details) : '') + '</div></div><div class="modal-foot"><button class="btn xib-btn xib-btn--primary btn-primary" data-close-overlay>完成</button></div></div>');
  }

  function openContactSubmissionConfirmation(title, items, submitter, confirmText = "确认提交") {
    openModal('确认' + title, '<div class="contact-submit-confirm"><div class="contact-confirm-notice"><strong>请再次核对提交内容</strong><span>确认后将按当前工单及角色权限进入下一处理节点。</span></div>' + contactSummaryMarkup(items) + '</div>', confirmText, () => {
      try {
        const outcome = submitter() || {};
        showContactResult(outcome.success !== false, outcome.title || (title + '成功'), outcome.message || '操作已完成', outcome.details || []);
      } catch (error) {
        showContactResult(false, title + '失败', error?.message || '系统暂时无法完成提交，请稍后重试。');
      }
    });
  }

  function contactNumberOptionsMarkup(profile, inputName, optionClass, disabled = false) {
    if (!profile.numbers.length) return '<div class="contact-number-empty">当前工单未保存可用联系方式</div>';
    return profile.numbers.map((number,index) => '<label class="' + optionClass + (disabled ? ' is-disabled' : '') + '"><input type="radio" name="' + inputName + '" value="' + escapeAttribute(number.value) + '" data-number-label="' + escapeAttribute(number.label) + '" ' + (disabled ? 'disabled ' : '') + (index === 0 ? 'checked' : '') + '><span><b>' + escapeAttribute(number.label) + '</b><strong>' + escapeAttribute(number.value) + '</strong><small>' + escapeAttribute(profile.customer) + '</small></span></label>').join('');
  }

  function bindContactNumberSourceMode(config) {
    const sync = () => {
      const mode = document.querySelector('input[name="' + config.modeName + '"]:checked')?.value || "existing";
      const existing = document.querySelector(config.existingSelector);
      const manual = document.querySelector(config.manualSelector);
      if (existing) existing.hidden = mode !== "existing";
      if (manual) manual.hidden = mode !== "manual";
      document.querySelector("#overlay-root .modal-validation-error")?.remove();
      if (mode === "manual") document.getElementById(config.manualInputId)?.focus();
    };
    document.querySelectorAll('input[name="' + config.modeName + '"]').forEach(control => control.addEventListener("change", sync));
    sync();
  }

  function validContactNumber(value) {
    const text = String(value || "").trim();
    const digits = text.replace(/\D/g, "");
    return /^[+\d\s()\-]{7,24}$/.test(text) && digits.length >= 7 && digits.length <= 15;
  }

  function validContactRecordNumber(value) {
    const digits = String(value || "").trim();
    return /^(?:1[3-9]\d{9}|0\d{9,11})$/.test(digits);
  }

  function contactRecordNumberField(scope, name, method, hidden = false) {
    const key = scope + "." + name;
    const id = "field-" + key.replace(/[^\w\u4e00-\u9fa5]/g, "-");
    return '<div class="form-item" data-field-name="' + name + '" data-contact-record-number-field="' + method + '" ' + (hidden ? 'hidden style="display:none"' : '') + '><label class="form-label required" for="' + id + '"><span>' + name + '</span></label><div class="form-control"><input class="di-input is-fluid" id="' + id + '" data-field-key="' + key + '" type="tel" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="请输入手机号码或带区号的固定电话"></div></div>';
  }

  function openOutboundNumberPicker() {
    const profile = contactProfile();
    const options = contactNumberOptionsMarkup(profile, "outbound-number", "contact-number-option");
    openModal('一键外呼', '<div class="contact-call-picker"><div class="contact-modal-intro"><strong>选择外呼方式</strong><span>从工单已保存的联系方式中选择，或手动输入本次外呼号码。</span></div><fieldset class="contact-number-mode"><legend>外呼方式</legend><div class="di-choice-row"><label><input type="radio" name="outbound-number-mode" value="existing" checked><span>选择外呼电话</span></label><label><input type="radio" name="outbound-number-mode" value="manual"><span>手动输入外呼电话</span></label></div></fieldset><section class="contact-number-source-section" data-outbound-existing><div class="contact-number-list">' + options + '</div></section><section class="contact-number-source-section" data-outbound-manual hidden><label class="contact-dialog-field"><span>外呼电话号码</span><input class="di-input is-fluid" id="outbound-manual-number" type="tel" maxlength="24" inputmode="tel" autocomplete="off" placeholder="请输入手机号码或带区号的固定电话"></label></section></div>', '外呼', () => {
      const mode = document.querySelector('input[name="outbound-number-mode"]:checked')?.value || 'existing';
      if (mode === 'manual') {
        const manualInput = document.getElementById('outbound-manual-number');
        const manualValue = manualInput?.value.trim() || '';
        if (!validContactNumber(manualValue)) return showOverlayValidationError('请输入有效的手机号码或带区号的固定电话。', manualInput);
        return startOutboundCall(profile, { label:'手动输入', value:manualValue.replace(/\s+/g, '') });
      }
      const selected = document.querySelector('input[name="outbound-number"]:checked');
      if (!selected) return showOverlayValidationError('请选择外呼电话。', document.querySelector('input[name="outbound-number"]'));
      startOutboundCall(profile, { label:selected.dataset.numberLabel, value:selected.value });
    });
    bindContactNumberSourceMode({ modeName:'outbound-number-mode', existingSelector:'[data-outbound-existing]', manualSelector:'[data-outbound-manual]', manualInputId:'outbound-manual-number' });
  }

  const CALL_MAIN_CONTENT_TEMPLATE = '客户主张/诉求：【请填写客户的核心诉求、抱怨点或事实陈述，如“表示/认为/要求……”】\n我行解释/方案：【请填写我行的政策解释、处理意见或提供的具体方案，如“我行向客户解释/告知/建议……”】';
  const CALL_FEEDBACK_TEMPLATE = '客户最终态度：【满意/知悉/无异议/需进一步沟通/拒绝接受】\n跟进意见说明：【若选“需进一步沟通/拒绝”，请简述客户下一步动作或我行下一步计划。】';

  function startOutboundCall(profile, number) {
    const startedAt = systemTimestamp();
    const callStartedAt = Date.now();
    let callEnded = false;
    let callDuration = 0;
    const formatDuration = seconds => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    // 同一弹窗里保持通话计时与反馈表单，挂断后才允许保存反馈。
    const feedbackMarkup = '<div class="call-feedback-form" id="call-feedback-form"><div class="call-feedback-scroll"><div class="call-feedback-heading"><strong>通话反馈记录</strong><span>通话中可以边沟通边填写，挂断后保存。</span></div><dl class="contact-call-summary"><div><dt>客户姓名</dt><dd>' + escapeAttribute(profile.customer) + '</dd></div><div><dt>电话号码</dt><dd>' + escapeAttribute(number.value) + '</dd></div><div><dt>沟通方式</dt><dd>一键外呼</dd></div><div><dt>联系时间</dt><dd>' + escapeAttribute(startedAt) + '</dd></div></dl><label class="contact-dialog-field required"><span>联系主要内容</span><div class="textarea-with-count"><textarea class="di-textarea" id="call-main-content" maxlength="2000">' + escapeAttribute(CALL_MAIN_CONTENT_TEMPLATE) + '</textarea><small class="textarea-count">' + CALL_MAIN_CONTENT_TEMPLATE.length + '/2000</small></div></label><label class="contact-dialog-field required"><span>沟通反馈意见</span><div class="textarea-with-count"><textarea class="di-textarea" id="call-feedback" maxlength="2000">' + escapeAttribute(CALL_FEEDBACK_TEMPLATE) + '</textarea><small class="textarea-count">' + CALL_FEEDBACK_TEMPLATE.length + '/2000</small></div></label></div><div class="call-feedback-actions" id="call-feedback-actions"><span id="call-feedback-hint">通话中，可同步填写反馈。</span><button type="button" class="btn xib-btn xib-btn--primary" id="save-call-feedback" disabled>保存通话反馈</button></div></div>';
    showOverlay('<div class="modal-mask"></div><div class="modal is-wide contact-call-modal"><div class="modal-head">一键外呼</div><div class="modal-body"><div class="contact-call-live-layout"><div class="contact-call-stage" id="contact-call-stage"><div class="call-avatar"><span></span><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3"><circle cx="32" cy="24" r="10"></circle><path d="M14 52c3-10 10-15 18-15s15 5 18 15"></path></svg></div><h3>' + escapeAttribute(profile.customer) + '</h3><p>' + escapeAttribute(number.label) + ' · ' + escapeAttribute(number.value) + '</p><div class="call-live-status"><i></i><span id="call-live-copy">通话中</span></div><strong class="call-duration" id="call-duration" role="timer">00:00</strong><button type="button" class="btn xib-btn call-hangup-button" id="hangup-call">挂断</button></div>' + feedbackMarkup + '</div></div></div>');
    const durationNode = document.getElementById('call-duration');
    const callTimer = window.setInterval(() => {
      if (!durationNode.isConnected || callEnded) return window.clearInterval(callTimer);
      callDuration = Math.floor((Date.now() - callStartedAt) / 1000);
      durationNode.textContent = formatDuration(callDuration);
    }, 1000);
    document.getElementById('hangup-call').addEventListener('click', () => {
      callDuration = Math.floor((Date.now() - callStartedAt) / 1000);
      window.clearInterval(callTimer);
      callEnded = true;
      durationNode.textContent = formatDuration(callDuration);
      document.getElementById('contact-call-stage').classList.add('is-ended');
      document.getElementById('call-live-copy').textContent = '通话已结束';
      document.getElementById('hangup-call').remove();
      document.getElementById('call-feedback-hint').textContent = '通话已结束，请确认并保存反馈。';
      document.getElementById('save-call-feedback').disabled = false;
    });
    document.getElementById('save-call-feedback').addEventListener('click', () => {
      if (!callEnded) return;
      const contentControl = document.getElementById('call-main-content');
      const feedbackControl = document.getElementById('call-feedback');
      const content = contentControl?.value.trim() || '';
      const feedback = feedbackControl?.value.trim() || '';
      if (!content || !feedback) return showOverlayValidationError('请完整填写联系主要内容和沟通反馈意见。', !content ? contentControl : feedbackControl);
      const attachment = '通话录音_' + profile.ticketId + '.mp3';
      const transcript = [
        { speaker:'客户', time:'00:05', text:'您好，我想确认一下当前投诉事项的处理进度。' },
        { speaker:'处理员', time:'00:18', text:'您好，我已经查询到相关工单，现在向您核实诉求并说明处理安排。' },
        { speaker:'客户', time:'00:42', text:'好的，请核实后尽快把处理结果反馈给我。' }
      ];
      appendContactRecord({ time:startedAt, contact:profile.customer, org:'厦门分行', method:'一键外呼', contactStatus:'已联系', phone:number.value, answerStatus:'已接听', callDuration:formatDuration(callDuration), content, feedback, attachment, transcript }, profile.ticketId);
      showContactResult(true, '通话反馈记录', '通话反馈已保存并写入联系记录', [
        {label:'工单编号',value:profile.ticketId},
        {label:'客户姓名',value:profile.customer},
        {label:'处理机构',value:'厦门分行'},
        {label:'沟通方式',value:'一键外呼'},
        {label:'电话号码',value:number.value},
        {label:'联系时间',value:startedAt},
        {label:'联系状态',value:'已联系'},
        {label:'联系主要内容',value:content,wide:true},
        {label:'沟通反馈意见',value:feedback,wide:true}
      ]);
    });
  }

  const SMS_TEMPLATE_DEFINITIONS = Object.freeze({
    "受理告知短信": {
      stage:"submission",
      approvalRequired:false,
      content:variables => "【厦门国际银行】尊敬的客户您好！您提交的投诉已由我行正式登记受理，编号【" + variables.ticket + "】，我行工作人员将尽快与您联系核实，由此给您带来不便我们深表歉意。"
    },
    "非我行客户短信": {
      stage:"submission",
      approvalRequired:false,
      content:() => "【厦门国际银行】您好，您投诉反映的业务非我行业务，我行无权核查处置。建议您核对涉事银行名称，直接向对应银行官方客服提交投诉，避免延误您问题处理。给您带来不便敬请谅解。"
    },
    "办结告知短信": {
      stage:"processing",
      approvalRequired:true,
      content:variables => "【厦门国际银行】尊敬的客户您好！针对您编号【" + variables.ticket + "】的投诉事项，我行已完成核查处置，处理结果：【" + variables.conclusion + "】，处置依据为《商业银行法》及我行服务协议相关条款。若您对本次处理结果存在异议，可在收到本通知30日内选择以下救济渠道：①向我行上级分行书面申请核查；②向当地金融消费纠纷调解中心申请调解；③依法提起仲裁或民事诉讼；④拨打金融监管热线12378反馈。如有疑问致电客服95608。【厦门国际银行】"
    }
  });

  function smsTemplateDefinition(template) {
    return SMS_TEMPLATE_DEFINITIONS[template] || SMS_TEMPLATE_DEFINITIONS["办结告知短信"];
  }

  function smsTemplateContent(template, variables = {}) {
    return smsTemplateDefinition(template).content(variables);
  }


  function submissionSmsPreviewMarkup(template, ticketId = "提交后系统生成") {
    const content = smsTemplateContent(template, { ticket:ticketId });
    return `<strong>${escapeAttribute(template)}</strong><p>${escapeAttribute(content)}</p>`;
  }

  function submissionSmsContactOptions(ticketId = "") {
    const values = ticketId ? (documentRecordFor("ticket", ticketRowById(ticketId))?.fields?.entry || {}) : state.formValues;
    const customer = String(values["customer.1.客户姓名"] || values["客户姓名"] || "客户").trim();
    const sources = [
      { value:"来电号码", number:values["来电号码"] || values["customer.1.预留手机号码"] || values["预留手机号码"] || "" },
      { value:"联系方式1", number:values["联系方式1"] || values["联系方式"] || values["customer.1.预留手机号码"] || values["预留手机号码"] || "" },
      { value:"联系方式2", number:values["联系方式2"] || "" }
    ];
    return sources.map(source => ({
      ...source,
      number:String(source.number || "").trim(),
      text:source.value + "  " + source.number + "  " + customer
    })).filter(source => source.number);
  }

  function submissionSmsContactMarkup(ticketId = "") {
    const sources = submissionSmsContactOptions(ticketId);
    const initialValue = sources[0]?.text || "";
    const options = sources.map(source => '<button type="button" role="option" data-submission-sms-contact="' + escapeAttribute(source.text) + '">' + escapeAttribute(source.text) + '</button>').join("");
    return '<div class="submission-sms-template-field" id="submission-sms-contact-field"><span>联系方式</span><div class="submission-sms-contact-combobox" id="submission-sms-contact-combobox"><input class="di-input is-fluid" id="submission-sms-contact-input" value="' + escapeAttribute(initialValue) + '" maxlength="80" autocomplete="off" placeholder="请输入手机号码或带区号的固定电话" role="combobox" aria-label="联系方式" aria-autocomplete="none" aria-expanded="false" aria-controls="submission-sms-contact-options" data-contact-mode="existing" readonly><button type="button" class="submission-sms-contact-toggle" id="submission-sms-contact-toggle" aria-label="展开联系方式选项" tabindex="-1"><img class="lib-icon-img" src="ui/assets/caret-bottom.svg" alt=""></button><div class="di-select-popover submission-sms-contact-options" id="submission-sms-contact-options" role="listbox" hidden>' + options + '<button type="button" role="option" data-submission-sms-contact-manual>手动输入</button></div></div></div>';
  }

  // Creation and review share one confirmation UI; callers own the workflow transition.
  function openTicketSmsConfirmation({ title, summary, confirmLabel, ticketId, onConfirm }) {
    const actionLabel = ticketId ? "复核通过后" : "提交后";
    const contactMarkup = submissionSmsContactMarkup(ticketId);
    openModal(title, summary + `<fieldset class="acceptance-sms-choice"><legend>是否向客户发送短信？</legend><p>选择“是”后由系统自动发送，无需审批，并写入工单详情的联系记录。</p><label><input type="radio" name="acceptance-sms" value="是" checked><span>是，${actionLabel}自动发送</span></label><label><input type="radio" name="acceptance-sms" value="否"><span>否，本次不发送</span></label><div class="submission-sms-template" id="submission-sms-template"><div class="submission-sms-control-row">${contactMarkup}<label class="submission-sms-template-field"><span>短信模板</span><select class="di-native-select is-fluid" id="submission-sms-template-select"><option value="受理告知短信" selected>受理告知短信</option><option value="非我行客户短信">非我行客户短信</option></select></label></div><div class="acceptance-sms-preview" id="submission-sms-preview">${submissionSmsPreviewMarkup("受理告知短信", ticketId)}</div></div></fieldset></div>`, confirmLabel, () => {
      const choice = document.querySelector('input[name="acceptance-sms"]:checked');
      if (!choice) return showOverlayValidationError("请选择是否发送短信。", document.querySelector('input[name="acceptance-sms"]'));
      const template = choice.value === "是" ? document.getElementById("submission-sms-template-select")?.value || "受理告知短信" : "";
      const entry = ticketId ? documentRecordFor("ticket", ticketRowById(ticketId))?.fields?.entry || {} : state.formValues;
      let recipient = entry["联系方式"] || entry["预留手机号码"] || entry["customer.1.预留手机号码"];
      if (template) {
        const contactInput = document.getElementById("submission-sms-contact-input");
        const selectedSource = submissionSmsContactOptions(ticketId).find(source => source.text === contactInput?.value);
        recipient = selectedSource?.number || contactInput?.value.trim() || "";
        if (recipient && !selectedSource && !validContactNumber(recipient)) return showOverlayValidationError("请输入有效的手机号码或带区号的固定电话。", contactInput);
      }
      if (template && !recipient) return showOverlayValidationError("客户联系号码为空，请先补充号码、选择其他联系方式或选择本次不发送。");
      onConfirm(template, recipient);
    });
    const templatePicker = document.getElementById("submission-sms-template");
    const templateSelect = document.getElementById("submission-sms-template-select");
    const contactInput = document.getElementById("submission-sms-contact-input");
    const contactToggle = document.getElementById("submission-sms-contact-toggle");
    const contactOptions = document.getElementById("submission-sms-contact-options");
    const preview = document.getElementById("submission-sms-preview");
    const setContactOptionsOpen = open => {
      if (!contactInput || !contactOptions) return;
      contactOptions.hidden = !open;
      contactInput.setAttribute("aria-expanded", String(open));
    };
    const sync = () => {
      const sendsSms = document.querySelector('input[name="acceptance-sms"]:checked')?.value === "是";
      templatePicker.hidden = !sendsSms;
      templateSelect.disabled = !sendsSms;
      if (contactInput) contactInput.disabled = !sendsSms;
      if (contactToggle) contactToggle.disabled = !sendsSms;
      if (!sendsSms) setContactOptionsOpen(false);
      if (sendsSms) preview.innerHTML = submissionSmsPreviewMarkup(templateSelect.value, ticketId);
    };
    document.querySelectorAll('input[name="acceptance-sms"]').forEach(control => control.addEventListener("change", sync));
    templateSelect.addEventListener("change", sync);
    contactInput?.addEventListener("click", event => {
      event.stopPropagation();
      setContactOptionsOpen(true);
    });
    contactInput?.addEventListener("input", () => setContactOptionsOpen(false));
    contactToggle?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setContactOptionsOpen(contactOptions.hidden);
      contactInput?.focus();
    });
    contactOptions?.addEventListener("click", event => {
      const option = event.target.closest("[data-submission-sms-contact],[data-submission-sms-contact-manual]");
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      const manual = option.hasAttribute("data-submission-sms-contact-manual");
      contactInput.value = manual ? "" : option.dataset.submissionSmsContact;
      contactInput.readOnly = !manual;
      contactInput.dataset.contactMode = manual ? "manual" : "existing";
      contactInput.setAttribute("aria-autocomplete", manual ? "list" : "none");
      setContactOptionsOpen(false);
      contactInput.focus();
    });
    sync();
  }

  function recordTicketAcceptanceSms(row, template, triggerStage, recipientOverride = "") {
    const entry = documentRecordFor("ticket", row)?.fields?.entry || {};
    const definition = smsTemplateDefinition(template);
    const content = smsTemplateContent(template, { ticket:row[0] });
    state.contactRecordsByTicket[row[0]] = [...(state.contactRecordsByTicket[row[0]] || []), {
      id:triggerStage + "-sms-" + Date.now().toString(36),
      time:systemTimestamp(),
      contact:row[2],
      org:"系统",
      method:"短信沟通",
      template,
      triggerStage,
      approvalRequired:definition.approvalRequired,
      smsApprovalStatus:"无需审批",
      contactStatus:"已联系",
      sendStatus:"已送达",
      receiver:recipientOverride || entry["联系方式"] || entry["预留手机号码"] || "",
      smsContent:content,
      content,
      attachment:""
    }];
  }

  function smsTemplatePreviewMarkup(variables) {
    return '<p>【厦门国际银行】尊敬的客户您好！针对您编号【<mark>' + escapeAttribute(variables.ticket) + '</mark>】的投诉事项，我行已完成核查处置，处理结果：【<mark>' + escapeAttribute(variables.conclusion || '请填写处理结论') + '</mark>】，处置依据为《商业银行法》及我行服务协议相关条款。若您对本次处理结果存在异议，可在收到本通知30日内选择以下救济渠道：①向我行上级分行书面申请核查；②向当地金融消费纠纷调解中心申请调解；③依法提起仲裁或民事诉讼；④拨打金融监管热线12378反馈。如有疑问致电客服95608。【厦门国际银行】</p>';
  }

  function openSmsCommunication(editRecord = null) {
    const profile = contactProfile();
    /* Preserve the previous template-only dialog for reference while the editable/retry flow below is active.
    const receiverOptions = contactNumberOptionsMarkup(profile, "sms-receiver", "sms-number-option");
    const variables = { ticket:profile.ticketId, conclusion:'已核实相关业务办理情况，并向客户说明费用依据及协商处理方案。' };
    openModal('发送短信', '<div class="contact-sms-layout is-settlement-template"><div class="contact-sms-editor"><fieldset class="contact-number-mode"><legend>接收号码方式</legend><div class="di-choice-row"><label><input type="radio" name="sms-number-mode" value="existing" checked><span>选择接收号码</span></label><label><input type="radio" name="sms-number-mode" value="manual"><span>手动输入接收号码</span></label></div></fieldset><section class="contact-number-source-section" data-sms-existing><div class="sms-number-list">' + receiverOptions + '</div></section><section class="contact-number-source-section" data-sms-manual hidden><label class="contact-dialog-field"><span>接收号码</span><input class="di-input is-fluid" id="sms-manual-number" type="tel" maxlength="24" inputmode="tel" autocomplete="off" placeholder="请输入手机号码或带区号的固定电话"></label></section><label class="contact-dialog-field"><span>短信模板</span><select class="di-native-select is-fluid" id="sms-template" disabled><option>办结告知短信</option></select></label><section class="sms-template-variable-panel"><div class="sms-template-variable-head"><strong>短信变量</strong></div><div class="sms-variable-grid"><label class="contact-dialog-field is-system-variable"><span>工单编号</span><input class="di-input is-fluid" id="sms-ticket" value="' + escapeAttribute(variables.ticket) + '" readonly></label><label class="contact-dialog-field required is-editable-variable"><span>简要概括处理结论</span><div class="sms-textarea-with-count"><textarea class="di-textarea" id="sms-conclusion" maxlength="300" placeholder="请概括核查处置结论">' + escapeAttribute(variables.conclusion) + '</textarea><small class="sms-character-count" id="sms-conclusion-count">' + String(variables.conclusion || "").length + '/300</small></div></label></div></section><section class="sms-template-copy"><div class="sms-template-variable-head"><strong>短信内容</strong></div><div id="sms-template-highlight">' + smsTemplatePreviewMarkup(variables) + '</div></section></div></div>', '提交审批', () => {
    */
    const receiverOptions = contactNumberOptionsMarkup(profile, "sms-receiver", "sms-number-option", Boolean(editRecord));
    const variables = { ticket:profile.ticketId, conclusion:editRecord?.smsContent || '已核实相关业务办理情况，并向客户说明费用依据及协商处理方案。' };
    const rejectionNotice = editRecord && smsApprovalStatusForRecord(editRecord) === "已驳回"
      ? '<section class="sms-rejection-reason"><strong>驳回理由</strong><p>' + escapeAttribute(editRecord.smsApprovalOpinion || "-") + '</p></section>'
      : '';
    openModal('发送短信', rejectionNotice + '<div class="contact-sms-layout is-settlement-template"><div class="contact-sms-editor"><fieldset class="contact-number-mode"' + (editRecord ? ' disabled' : '') + '><legend>接收号码方式</legend><div class="di-choice-row"><label><input type="radio" name="sms-number-mode" value="existing" checked><span>选择接收号码</span></label><label><input type="radio" name="sms-number-mode" value="manual"><span>手动输入接收号码</span></label></div></fieldset><section class="contact-number-source-section" data-sms-existing><div class="sms-number-list">' + receiverOptions + '</div></section><section class="contact-number-source-section" data-sms-manual hidden><label class="contact-dialog-field"><span>接收号码</span><input class="di-input is-fluid" id="sms-manual-number" type="tel" maxlength="24" inputmode="tel" autocomplete="off" placeholder="请输入手机号码或带区号的固定电话"></label></section><fieldset class="contact-number-mode"><legend>短信模板</legend><label class="contact-dialog-field"><select class="di-native-select is-fluid" id="sms-content-mode"' + (editRecord ? ' disabled' : '') + '><option value="template" selected>使用办结告知短信模板</option><option value="manual">手工录入短信</option></select></label></fieldset><section id="sms-template-content"><section class="sms-template-variable-panel"><div class="sms-template-variable-head"><strong>短信变量</strong></div><div class="sms-variable-grid"><label class="contact-dialog-field is-system-variable"><span>工单编号</span><input class="di-input is-fluid" id="sms-ticket" value="' + escapeAttribute(variables.ticket) + '" readonly></label><label class="contact-dialog-field required is-editable-variable"><span>简要概括处理结论</span><div class="sms-textarea-with-count"><textarea class="di-textarea" id="sms-conclusion" maxlength="300" placeholder="请概括核查处置结论">' + escapeAttribute(variables.conclusion) + '</textarea><small class="sms-character-count" id="sms-conclusion-count">0/300</small></div></label></div></section><section class="sms-template-copy"><div class="sms-template-variable-head"><strong>短信内容</strong></div><div id="sms-template-highlight">' + smsTemplatePreviewMarkup(variables) + '</div></section></section><section id="sms-manual-content" hidden><label class="contact-dialog-field required"><span>短信内容</span><div class="sms-textarea-with-count"><textarea class="di-textarea sms-content-editor" id="sms-manual-text" maxlength="300" placeholder="请输入完整短信内容"></textarea><small class="sms-character-count" id="sms-manual-count">0/300</small></div></label></section></div></div>', '提交审批', () => {
      const mode = document.querySelector('input[name="sms-number-mode"]:checked')?.value || 'existing';
      const selected = document.querySelector('input[name="sms-receiver"]:checked');
      const manualControl = document.getElementById('sms-manual-number');
      const manualValue = manualControl?.value.trim() || '';
      const receiverValue = mode === 'manual' ? manualValue.replace(/\s+/g, '') : selected?.value || '';
      const contentMode = document.getElementById('sms-content-mode')?.value || 'template';
      const conclusionControl = document.getElementById('sms-conclusion');
      const conclusion = conclusionControl?.value.trim() || '';
      if (mode === 'manual' && !validContactNumber(manualValue)) return showOverlayValidationError('请输入有效的手机号码或带区号的固定电话。', manualControl);
      if (mode === 'existing' && !selected) return showOverlayValidationError('请选择接收号码。', document.querySelector('input[name="sms-receiver"]'));
      const manualContentControl = document.getElementById('sms-manual-text');
      const manualContent = manualContentControl?.value.trim() || '';
      if (contentMode === 'template' && !conclusion) return showOverlayValidationError('请填写简要概括处理结论。', conclusionControl);
      if (contentMode === 'manual' && !manualContent) return showOverlayValidationError('请填写完整短信内容。', manualContentControl);
      const content = contentMode === 'manual' ? manualContent : smsTemplateContent('办结告知短信', { ticket:profile.ticketId, conclusion, relief:'和解、调解、诉讼、仲裁' });
      const items = [{label:'工单编号',value:profile.ticketId},{label:'接收号码',value:receiverValue},{label:'短信模板',value:contentMode === 'manual' ? '手工录入' : '办结告知短信'},...(contentMode === 'template' ? [{label:'处理结论',value:conclusion,wide:true}] : []),{label:'短信内容',value:content,wide:true}];
      openContactSubmissionConfirmation('短信审批申请', items, () => {
        state.smsStatusByTicket[profile.ticketId] = '待审批';
        /* Previous append-only behavior superseded by editable approval records.
        appendContactRecord({ time:systemTimestamp(), contact:profile.customer, org:'厦门分行', method:'短信沟通', template:'办结告知短信', approvalRequired:true, smsApprovalStatus:'待审批', contactStatus:'', sendStatus:'未发送', receiver:receiverValue, smsContent:content, content, attachment:'' }, profile.ticketId);
        */
        const appliedAt = systemTimestamp();
        const approvalDate = appliedAt.replace(/\D/g, '').slice(0, 8);
        const approvalSerial = approvalRows.reduce((max, row) => {
          const match = String(row[0] || '').match(new RegExp('^DX' + approvalDate + '(\\d{4})$'));
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0) + 1;
        const approvalId = 'DX' + approvalDate + String(approvalSerial).padStart(4, '0');
        const smsTemplate = contentMode === 'manual' ? '手工录入' : '办结告知短信';
        if (editRecord?.id) {
          const storedRecord = (state.contactRecordsByTicket[profile.ticketId] || []).find(item => item.id === editRecord.id);
          if (storedRecord) Object.assign(storedRecord, { time:appliedAt, template:smsTemplate, approvalRequired:true, smsApprovalStatus:'待审批', contactStatus:'', sendStatus:'未发送', receiver:receiverValue, smsContent:content, content, approvalRequestId:approvalId });
        } else {
          appendContactRecord({ time:appliedAt, contact:profile.customer, org:'厦门分行', method:'短信沟通', template:smsTemplate, approvalRequired:true, smsApprovalStatus:'待审批', contactStatus:'', sendStatus:'未发送', receiver:receiverValue, smsContent:content, content, approvalRequestId:approvalId, attachment:'' }, profile.ticketId);
        }
        approvalRows.push([approvalId, '短信审批', smsTemplate, currentRoleProfile().label, '厦门分行', '内容审批', '剩余 8 小时', appliedAt, profile.ticketId, '', '待审批']);
        persistWorkflowState();
        return { message:'短信审批申请已提交', details:[{label:'工单状态',value:'处理中'},{label:'短信审批状态',value:'待审批'}] };
      });
    });
    const refreshSms = () => {
      const conclusionControl = document.getElementById('sms-conclusion');
      if (conclusionControl.value.length > 300) conclusionControl.value = conclusionControl.value.slice(0, 300);
      document.getElementById('sms-conclusion-count').textContent = conclusionControl.value.length + '/300';
      const current = { ticket:profile.ticketId, conclusion:conclusionControl.value.trim() };
      document.getElementById('sms-template-highlight').innerHTML = smsTemplatePreviewMarkup(current);
      document.querySelector('.modal-validation-error')?.remove();
    };
    document.getElementById('sms-conclusion').addEventListener('input', refreshSms);
    refreshSms();
    const refreshManualSmsCount = () => {
      const manualControl = document.getElementById('sms-manual-text');
      if (!manualControl) return;
      if (manualControl.value.length > 300) manualControl.value = manualControl.value.slice(0, 300);
      const counter = document.getElementById('sms-manual-count');
      if (counter) counter.textContent = manualControl.value.length + '/300';
      document.querySelector('.modal-validation-error')?.remove();
    };
    document.getElementById('sms-manual-text')?.addEventListener('input', refreshManualSmsCount);
    refreshManualSmsCount();
    bindContactNumberSourceMode({ modeName:'sms-number-mode', existingSelector:'[data-sms-existing]', manualSelector:'[data-sms-manual]', manualInputId:'sms-manual-number' });
    const contentModeControl = document.getElementById('sms-content-mode');
    const syncSmsContentMode = () => {
      const manual = contentModeControl?.value === 'manual';
      const templateContent = document.getElementById('sms-template-content');
      const manualContent = document.getElementById('sms-manual-content');
      if (templateContent) templateContent.hidden = manual;
      if (manualContent) manualContent.hidden = !manual;
      document.querySelector('#overlay-root .modal-validation-error')?.remove();
      if (manual) document.getElementById('sms-manual-text')?.focus();
    };
    contentModeControl?.addEventListener('change', syncSmsContentMode);
    syncSmsContentMode();
  }
  function openNewContactRecord() {
    const profile = contactProfile();
    const scope = 'contact-create';
    ['沟通方式','电话号码','接收号码','联系时间','联系主要内容','沟通反馈意见','附件'].forEach(name => delete state.formValues[scope + '.' + name]);
    state.formValues[scope + '.联系时间'] = systemTimestamp();
    const fields = [
      { name:'沟通方式', type:'radio', all:true, required:true, options:['邮件','面访','微信','电话','短信','其它'], defaultValue:'电话', span:true },
      { name:'联系时间', type:'text', all:true, required:true, placeholder:'yyyy-MM-dd HH:mm:ss' },
      { name:'联系主要内容', type:'textarea', all:true, required:true, span:true, placeholder:'记录沟通事项、客户主张及我行说明' },
      { name:'沟通反馈意见', type:'textarea', all:true, required:true, span:true, placeholder:'记录客户态度、反馈意见及后续安排' },
      { name:'附件', type:'upload', all:true, span:true }
    ];
    const fieldMarkup = fields.map(field => renderField(field, scope));
    fieldMarkup.splice(1, 0, contactRecordNumberField(scope, '电话号码', '电话'), contactRecordNumberField(scope, '接收号码', '短信', true));
    openModal('新建联系记录', '<div class="contact-modal-intro"><strong>补充线下或其他渠道的联系记录</strong><span>附件用于证明并记录联系内容，支持使用拖拽上传组件。</span></div><div class="form-grid contact-create-form">' + fieldMarkup.join('') + '</div>', '提交记录', () => {
      const values = Object.fromEntries(fields.map(field => [field.name, state.formValues[scope + '.' + field.name] || document.querySelector('[data-field-key="' + scope + '.' + field.name + '"]')?.value || field.defaultValue || '']));
      const missing = ['沟通方式','联系时间','联系主要内容','沟通反馈意见'].filter(name => !String(values[name] || '').trim());
      if (missing.length) return showOverlayValidationError('请补充：' + missing.join('、') + '。', document.querySelector('[data-field-key="' + scope + '.' + missing[0] + '"]'));
      const numberFieldName = values['沟通方式'] === '电话' ? '电话号码' : values['沟通方式'] === '短信' ? '接收号码' : '';
      const numberControl = numberFieldName ? document.querySelector('[data-field-key="' + scope + '.' + numberFieldName + '"]') : null;
      const contactNumber = numberControl?.value.trim() || '';
      if (numberFieldName && !contactNumber) return showOverlayValidationError('请填写' + numberFieldName + '。', numberControl);
      if (numberFieldName && !validContactRecordNumber(contactNumber)) return showOverlayValidationError('请输入有效的手机号码或带区号的固定电话，仅支持数字。', numberControl);
      const timeControl = document.querySelector('[data-field-key="' + scope + '.联系时间"]');
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(values['联系时间'] || ''))) return showOverlayValidationError('联系时间格式应为 yyyy-MM-dd HH:mm:ss，并精确到秒。', timeControl);
      const items = [{label:'工单编号',value:profile.ticketId},{label:'客户姓名',value:profile.customer},{label:'沟通方式',value:values['沟通方式']},...(numberFieldName ? [{label:numberFieldName,value:contactNumber}] : []),{label:'联系时间',value:values['联系时间']},{label:'联系主要内容',value:values['联系主要内容'],wide:true},{label:'沟通反馈意见',value:values['沟通反馈意见'],wide:true},{label:'附件',value:values['附件'] || '未上传'}];
      openContactSubmissionConfirmation('联系记录', items, () => {
        appendContactRecord({ time:values['联系时间'], contact:profile.customer, org:'厦门分行', method:values['沟通方式'], phone:values['沟通方式'] === '电话' ? contactNumber : '', receiver:values['沟通方式'] === '短信' ? contactNumber : '', contactStatus:'已联系', smsApprovalStatus:values['沟通方式'] === '短信' ? '已通过' : '', sendStatus:values['沟通方式'] === '短信' ? '已送达' : '', content:values['联系主要内容'], feedback:values['沟通反馈意见'], attachment:values['附件'] || '' }, profile.ticketId);
        return { message:'联系记录已提交并写入当前工单', details:[{label:'工单编号',value:profile.ticketId},{label:'沟通方式',value:values['沟通方式']}] };
      });
    });
    const overlayRoot = document.getElementById('overlay-root');
    bindOverlayFormControls(overlayRoot);
    const methodControl = overlayRoot.querySelector('[data-field-key="' + scope + '.沟通方式"]');
    const syncNumberField = () => {
      const method = methodControl?.value || '电话';
      overlayRoot.querySelectorAll('[data-contact-record-number-field]').forEach(item => {
        const visible = item.dataset.contactRecordNumberField === method;
        item.hidden = !visible;
        item.style.display = visible ? '' : 'none';
      });
      overlayRoot.querySelector('.modal-validation-error')?.remove();
    };
    methodControl?.closest('[data-app-radio]')?.querySelectorAll('[data-radio-value]').forEach(button => button.addEventListener('click', syncNumberField));
    overlayRoot.querySelectorAll('[data-contact-record-number-field] input').forEach(input => input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, 12);
      if (input.value !== digits) input.value = digits;
      state.formValues[input.dataset.fieldKey] = digits;
      overlayRoot.querySelector('.modal-validation-error')?.remove();
    }));
    syncNumberField();
  }

  function openContactRecordDetail(index, ticket = activeContactTicket()) {
    const record = contactRecordsForTicket(ticket)[index] || contactRecordsForTicket(ticket)[0];
    let items;
    if (["一键外呼", "电话"].includes(record.method)) {
      items = [{label:"客户姓名",value:record.contact},{label:"沟通方式",value:record.method},{label:"电话号码",value:record.phone || "13800008000"},{label:"联系时间",value:record.time},{label:"联系状态",value:contactStatusForRecord(record) || "-"}];
    } else if (isSmsContact(record)) {
      items = [{label:"客户姓名",value:record.contact},{label:"沟通方式",value:"短信"},{label:"短信模板",value:record.template || "-"},{label:"接收号码",value:record.receiver || "13900003635"},{label:"联系时间",value:record.time},{label:"短信审批状态",value:smsApprovalStatusForRecord(record) || "-"},...(smsApprovalStatusForRecord(record) !== "已驳回" && record.smsApprovalOpinion ? [{label:"历史驳回意见",value:record.smsApprovalOpinion,wide:true}] : []),{label:"短信平台调用状态",value:contactStatusForRecord(record) || "-"},...(record.retryAt ? [{label:"最近重发时间",value:record.retryAt}] : []),{label:"短信内容",value:record.smsContent || record.content,wide:true}];
    } else {
      items = [{label:"客户姓名",value:record.contact},{label:"沟通方式",value:record.method},{label:"联系时间",value:record.time},{label:"联系状态",value:contactStatusForRecord(record) || "-"}];
    }
    if (isSmsContact(record)) return openModal("查看联系内容", contactSummaryMarkup(items), "关闭");
    const editableContent = '<div class="contact-record-edit-form">' + contactSummaryMarkup(items) + '<label class="contact-dialog-field required"><span>联系主要内容</span><div class="textarea-with-count"><textarea class="di-textarea" id="contact-record-content" maxlength="2000">' + escapeAttribute(record.content || "") + '</textarea><small class="textarea-count">' + String(record.content || "").length + '/2000</small></div></label><label class="contact-dialog-field required"><span>沟通反馈意见</span><div class="textarea-with-count"><textarea class="di-textarea" id="contact-record-feedback" maxlength="2000">' + escapeAttribute(record.feedback || "") + '</textarea><small class="textarea-count">' + String(record.feedback || "").length + '/2000</small></div></label></div>';
    openModal("查看联系内容", editableContent, "保存更改", () => {
      const contentControl = document.getElementById("contact-record-content");
      const feedbackControl = document.getElementById("contact-record-feedback");
      const content = contentControl?.value.trim() || "";
      const feedback = feedbackControl?.value.trim() || "";
      if (!content || !feedback) return showOverlayValidationError("请完整填写联系主要内容和沟通反馈意见。", !content ? contentControl : feedbackControl);
      updateContactRecord(record, { content, feedback }, ticket[0]);
      closeOverlay();
      toast("联系内容已保存");
    });
  }
  function openQuickSubprocess(type, relatedTicket) {
    const ticketRow = workflowRow("ticket", relatedTicket);
    const availability = subprocessInitiationAvailability(subprocessDefinition(type), ticketRow, { requireApplicationDate: false });
    if (!workflowPolicy("ticket", ticketRow).canStartSubprocess || !availability.enabled) return toast(availability.enabled ? "当前状态/权限无法发起" : availability.reason, true);
    if (!subprocessCapabilities(type, false).create) return toast("当前机构与角色无该子流程创建权限", true);
    const definition = subprocessDefinition(type);
    const existing = subprocessIndicator(type, relatedTicket);
    if (existing.length && !definition.repeatable) return toast(definition.document + "已发起，可通过编号查看", true);
    const differenceFields = renderQuickSubprocessFields(definition);
    openModal("快速创建" + definition.document, `<div class="quick-subprocess-form"><dl class="ds-descriptions detail-descriptions"><div><dt>事件创建人</dt><dd>陈敏慧-60157</dd></div><div><dt>所属机构</dt><dd>厦门分行</dd><dt>所属部门</dt><dd>厦门分行零售金融部</dd></div><div><dt>${definition.document}编号</dt><dd>提交后系统生成</dd></div><div><dt>关联工单编号</dt><dd>${relatedTicket}</dd></div><div><dt>申请时间</dt><dd>提交后系统自动生成</dd></div><div><dt>关联规则</dt><dd>审批通过后自动关联</dd></div></dl>${differenceFields}</div>`, "创建并发起", () => {
      const required = [...document.querySelectorAll("#overlay-root .form-label.required")].map(label => label.parentElement.querySelector("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)")).filter(Boolean);
      const missing = required.filter(control => !control.value);
      if (missing.length) { const target = missing[0].type === "hidden" ? missing[0].parentElement.querySelector(".di-select,.di-picker-trigger") : missing[0]; target?.focus(); return toast("还有 " + missing.length + " 个必填字段未完成", true); }
      const record = createSubprocessRecord(type, relatedTicket, {});
      closeOverlay();
      rerenderPage();
      toast(record.document + " " + record.id + " 已提交审批，审批通过后自动关联主工单");
    });
    bindOverlayFormControls(document.getElementById("overlay-root"));
  }

  function openQuickSubprocessDetail(id) {
    const dynamicRecord = Object.values(state.triggeredSubprocesses).flat().find(item => item.id === id);
    const row = subprocessRows.find(item => item[0] === id);
    if (!dynamicRecord && !row) return toast("暂未找到该子流程记录", true);
    const record = dynamicRecord || { id:row[0], type:row[1], document:subprocessDefinition(row[1]).document, relatedTicket:row[2], status:row[5], row };
    const normalized = { ...record, row:record.row || row };
    openModal(normalized.document + "详情", `<div class="quick-detail"><p>子流程单编号：<b>${normalized.id}</b></p><p>关联工单编号：<b>${normalized.relatedTicket}</b></p><p>申请状态：<b>${normalized.status}</b></p><p>子流程结论：<b>${subprocessConclusion(normalized)}</b></p></div>`, "关闭");
  }
  function ticketEntryValue(ticket, name) {
    const record = documentRecordFor("ticket", ticket);
    const entry = record?.fields?.entry || {};
    return entry[name] ?? entry["customer.1." + name] ?? "";
  }

  function ambiguousCustomerNameIssue(ticket) {
    if (!ticket || !["\u6295\u8bc9\u5355", "\u4fe1\u8bbf\u5355"].includes(ticket[1])) return null;
    const name = String(ticketEntryValue(ticket, "\u5ba2\u6237\u59d3\u540d") || ticket[2] || "").trim();
    if (!name) return { field:"\u5ba2\u6237\u59d3\u540d", value:"\u672a\u586b\u5199", reason:"\u5ba2\u6237\u59d3\u540d\u4e3a\u7a7a\uff0c\u4e0d\u4fbf\u4e8e\u8bc6\u522b\u9ad8\u53d1\u5ba2\u6237\u548c\u5ba2\u6237\u6295\u8bc9\u6b21\u6570\u3002" };
    const ambiguous = /^[\u4e00-\u9fa5]{1,2}(\u67d0|\u5148\u751f|\u5973\u58eb|\u5c0f\u59d0|\u963f\u59e8|\u540c\u5b66|\u7237\u7237|\u5976\u5976|\u53d4\u53d4|\u5e08\u5085|\u5ba2\u6237)$/.test(name);
    return ambiguous ? { field:"\u5ba2\u6237\u59d3\u540d", value:name, reason:"\u8be5\u8868\u8ff0\u53ef\u80fd\u4e0d\u662f\u5b8c\u6574\u5ba2\u6237\u59d3\u540d\uff0c\u4e0d\u4fbf\u4e8e\u7cfb\u7edf\u8bc6\u522b\u9ad8\u53d1\u5ba2\u6237\u6295\u8bc9\u60c5\u51b5\u548c\u5ba2\u6237\u6295\u8bc9\u6b21\u6570\u3002" } : null;
  }

  function incompleteDocumentNumberIssue(ticket) {
    if (!ticket || !["\u6295\u8bc9\u5355", "\u4fe1\u8bbf\u5355"].includes(ticket[1])) return null;
    const number = String(ticketEntryValue(ticket, "\u8bc1\u4ef6\u53f7\u7801") || "").trim();
    if (number && !/[?*]/.test(number)) return null;
    return { field:"\u8bc1\u4ef6\u53f7\u7801", value:number || "\u672a\u586b\u5199", reason:"\u8bc1\u4ef6\u53f7\u7801\u672a\u8865\u5145\u5b8c\u6574\uff0c\u4f1a\u5f71\u54cd\u5ba2\u6237\u5206\u6790\u548c\u6295\u8bc9\u6b21\u6570\u7edf\u8ba1\uff1b\u533f\u540d\u6216\u786e\u5b9e\u65e0\u6cd5\u9501\u5b9a\u6295\u8bc9\u4eba\u7684\u6781\u7aef\u60c5\u51b5\u53ef\u7ee7\u7eed\u63d0\u4ea4\u3002" };
  }

  function processingSoftValidationIssues(ticket) {
    return [ambiguousCustomerNameIssue(ticket), incompleteDocumentNumberIssue(ticket)].filter(Boolean);
  }

  function openProcessingSoftValidationConfirm(issues, onContinue) {
    const rows = issues.map(issue => '<tr><td>' + issue.field + '</td><td>' + escapeAttribute(issue.value) + '</td><td>' + issue.reason + '</td></tr>').join("");
    openModal("\u5904\u7406\u63d0\u4ea4\u63d0\u9192", '<div class="action-dialog validation-warning-dialog"><div class="action-dialog-question"><strong>\u5efa\u8bae\u63d0\u4ea4\u524d\u68c0\u67e5\u5ba2\u6237\u8bc6\u522b\u4fe1\u606f</strong><span>\u4ee5\u4e0b\u4fe1\u606f\u53ef\u80fd\u5f71\u54cd\u9ad8\u53d1\u5ba2\u6237\u548c\u5ba2\u6237\u6295\u8bc9\u6b21\u6570\u7edf\u8ba1\u3002\u82e5\u5c5e\u4e8e\u533f\u540d\u6295\u8bc9\u7b49\u6781\u7aef\u60c5\u51b5\uff0c\u53ef\u4ee5\u786e\u8ba4\u7ee7\u7eed\u63d0\u4ea4\u3002</span></div><div class="table-wrap"><table class="table ds-table"><thead><tr><th>\u5b57\u6bb5</th><th>\u5f53\u524d\u5185\u5bb9</th><th>\u63d0\u9192\u539f\u56e0</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>', "\u786e\u8ba4\u7ee7\u7eed", onContinue);
  }

  function validateComplaintTransferChannel() {
    if (state.workOrderType !== "\u6295\u8bc9\u5355") return true;
    const letter = String(state.formValues["\u8f6c\u9001\u51fd\u53f7"] || "").trim().toUpperCase();
    if (!letter) return true;
    const channel = String(state.formValues["\u53d7\u7406\u6e20\u9053"] || "").trim();
    if (letter.startsWith("YZTS")) {
      if (/\u91d1\u878d.*\u670d\u52a1\u5e73\u53f0/.test(channel)) return true;
      alert("\u8f6c\u9001\u51fd\u53f7\u4e3a YZTS \u5f00\u5934\u65f6\uff0c\u53d7\u7406\u6e20\u9053\u5e94\u9009\u62e9\u91d1\u878d\u6d88\u8d39\u8005\u4fdd\u62a4\u670d\u52a1\u5e73\u53f0/\u91d1\u878d\u670d\u52a1\u5e73\u53f0\uff0c\u8bf7\u68c0\u67e5\u540e\u518d\u63d0\u4ea4\u3002");
      return false;
    }
    if (letter.startsWith("YZ")) {
      if (/\u53a6\u95e8.*(\u76d1\u7ba1\u5c40|\u91d1\u7ba1\u5c40)|\u5c5e\u5730.*(\u76d1\u7ba1\u5c40|\u91d1\u7ba1\u5c40)/.test(channel)) return true;
      alert("\u8f6c\u9001\u51fd\u53f7\u4e3a YZ \u5f00\u5934\u65f6\uff0c\u53d7\u7406\u6e20\u9053\u5e94\u9009\u62e9\u53a6\u95e8\u76d1\u7ba1\u5c40/\u53a6\u95e8\u91d1\u7ba1\u5c40\u6216\u5c5e\u5730\u76d1\u7ba1\u5c40/\u5c5e\u5730\u91d1\u7ba1\u5c40\uff0c\u8bf7\u68c0\u67e5\u540e\u518d\u63d0\u4ea4\u3002");
      return false;
    }
    return true;
  }

  function customerManagerConflictsWithActiveHandler(ticketId) {
    const ticket = ticketRowById(ticketId);
    const manager = String(documentRecordFor("ticket", ticket)?.fields?.entry?.["所属客户经理"] || "").trim();
    const activeHandler = COMPLAINT_WORK_POOL.identity("handler").actor;
    return Boolean(manager && activeHandler && (manager === activeHandler || manager.split("-")[0] === activeHandler.split("-")[0]));
  }

  function showRequiredFieldError(control, message) {
    if (!control) return;
    const target = control.type === "hidden" ? control.parentElement?.querySelector(".di-select,.di-picker-trigger") || control : control;
    const item = control.closest?.(".form-item") || target.closest?.(".form-item");
    item?.querySelector(".field-validation-message")?.remove();
    const notice = document.createElement("small");
    notice.className = "field-validation-message";
    notice.textContent = message;
    item?.querySelector(".form-control")?.appendChild(notice);
    target.classList.add("is-error");
    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target.focus?.();
  }

  function submitProcessingResult() {
    const form = document.getElementById("processing-form-main");
    const scope = "processing." + state.detailId;
    const ticket = ticketRowById(state.detailId);
    if (customerManagerConflictsWithActiveHandler(state.detailId)) {
      return showOverlay('<div class="modal-mask"></div><div class="modal" data-modal-size="compact" role="dialog" aria-modal="true" aria-labelledby="manager-avoidance-message"><div class="modal-head"><button class="icon-btn" data-close-overlay aria-label="关闭">' + icon("close") + '</button></div><div class="modal-body"><div class="action-dialog"><div class="action-dialog-question"><strong id="manager-avoidance-message">所属客户经理与当前处理人一致，根据岗位回避规则无法处理该工单</strong></div></div></div></div>');
    }
    const repeatComplaint = (state.formValues[scope + ".\u662f\u5426\u518d\u6b21\u6295\u8bc9"] || "\u5426") === "\u662f";
    const repeatMainTicket = state.formValues[scope + ".\u5173\u8054\u672a\u5f52\u6863\u5de5\u5355\u4e3b\u5355\u7f16\u53f7"] || "";
    const repeatNote = (state.formValues[scope + ".\u60c5\u51b5\u8bf4\u660e"] || "").trim();
    if (repeatComplaint && !repeatMainTicket) return toast("\u8bf7\u9009\u62e9\u5173\u8054\u672a\u5f52\u6863\u5de5\u5355\u4e3b\u5355", true);
    if (repeatComplaint && !repeatNote) return toast("\u8bf7\u586b\u5199\u518d\u6b21\u6295\u8bc9\u60c5\u51b5\u8bf4\u660e", true);
    const currentHandler = "\u9648\u654f\u6167-60157";
    const handlerShortName = currentHandler.split("-")[0];
    const objectText = String(documentRecordFor("ticket", ticket)?.fields?.entry?.["投诉对象"] || "").trim();
    if (objectText && objectText !== "-" && (objectText === currentHandler || objectText === handlerShortName)) return toast("投诉对象与当前处理员存在回避关系，请核实后再提交", true);
    const personValue = String(state.formValues[scope + ".\u8d23\u4efb\u4eba"] || "");
    if (personValue && (personValue === currentHandler || personValue.split("-")[0] === handlerShortName)) return toast("\u8d23\u4efb\u4eba\u4e0d\u80fd\u4e3a\u5f53\u524d\u5904\u7406\u5458\uff08\u56de\u907f\u6821\u9a8c\uff09", true);
    const missing = [...form.querySelectorAll(".form-label.required")].map(label => label.parentElement.querySelector("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)")).filter(control => control && !String(control.value || "").trim());
    if (missing.length) {
      showRequiredFieldError(missing[0], "该字段为必填项，请补充后再提交");
      return toast("\u8fd8\u6709 " + missing.length + " \u4e2a\u5fc5\u586b\u5904\u7406\u5b57\u6bb5\u672a\u5b8c\u6210", true);
    }
    const savedProcessing = documentRecordFor("ticket", ticket)?.fields?.processing || {};
    const countersignChoice = state.formValues[scope + ".\u662f\u5426\u4f1a\u7b7e"] || state.formValues[scope + ".\u662f\u5426\u9700\u8981\u4f1a\u7b7e"] || savedProcessing["\u662f\u5426\u4f1a\u7b7e"] || savedProcessing["\u662f\u5426\u9700\u8981\u4f1a\u7b7e"] || "";
    const requiresCountersign = TICKET_COUNTERSIGN_TYPES.has(ticket?.[1]) && countersignChoice === "\u662f";
    const openSubmitDialog = () => {
      const nextStage = requiresCountersign ? "\u4f1a\u7b7e" : TICKET_INITIAL_APPROVAL_TYPES.has(ticket?.[1]) ? "\u521d\u5ba1" : "\u5ba1\u6279";
      const message = repeatComplaint ? "\u63d0\u4ea4\u540e\u8fdb\u5165\u5de5\u5355" + nextStage + "\uff1b\u540e\u7eed\u5ba1\u6279\u901a\u8fc7\u540e\uff0c\u5f53\u524d\u5de5\u5355\u4f5c\u4e3a\u518d\u6b21\u6295\u8bc9\u5355\u4e0e\u4e3b\u5de5\u5355\u5173\u8054\uff0c\u5e76\u590d\u7528\u5176\u5904\u7406\u7ed3\u679c\u3002" : "\u63d0\u4ea4\u540e\u8fdb\u5165\u5de5\u5355" + nextStage + "\u8282\u70b9\uff0c\u5f53\u524d\u5904\u7406\u5b57\u6bb5\u5c06\u9501\u5b9a\u3002";
      const relationSummary = repeatComplaint ? `<div><dt>\u518d\u6b21\u6295\u8bc9\u5224\u5b9a</dt><dd>\u662f</dd></div><div><dt>\u5173\u8054\u4e3b\u5de5\u5355</dt><dd>${repeatMainTicket}</dd></div>` : '<div><dt>\u518d\u6b21\u6295\u8bc9\u5224\u5b9a</dt><dd>\u5426</dd></div><div><dt>\u4e0b\u4e00\u8282\u70b9</dt><dd>\u5de5\u5355' + nextStage + '</dd></div>';
      openModal("\u63d0\u4ea4\u5904\u7406\u7ed3\u679c", `<div class="action-dialog"><div class="action-dialog-question"><strong>\u786e\u8ba4\u63d0\u4ea4\u5904\u7406\u7ed3\u679c\uff1f</strong><span>${message}</span></div><dl class="action-summary-grid"><div><dt>\u5de5\u5355\u7f16\u53f7</dt><dd>${state.detailId}</dd></div><div><dt>\u5de5\u5355\u7c7b\u578b</dt><dd>${state.workOrderType}</dd></div>${relationSummary}<div><dt>\u5173\u8054\u5b50\u6d41\u7a0b</dt><dd>\u4ec5\u5305\u542b\u5ba1\u6279\u901a\u8fc7\u4e14\u5df2\u5173\u8054\u7684\u5b50\u6d41\u7a0b</dd></div></dl></div>`, "\u786e\u8ba4\u63d0\u4ea4", () => {
        if (repeatComplaint) state.repeatRelations[state.detailId] = { mainTicket:repeatMainTicket, note:repeatNote, status:"\u5f85\u5ba1\u6279\uff0c\u5c1a\u672a\u5173\u8054", linked:false };
        snapshotDocumentStage("ticket", state.detailId, "processing", scopedFormValues("processing." + state.detailId));
        const approvalStage = requiresCountersign ? "countersign" : approvalStagesFor("ticket", ticket).find(stage => stage !== "countersign") || "approval";
        const event = requiresCountersign ? "submitProcessingToCountersign" : approvalStage === "initial" ? "submitProcessingToInitial" : "submitProcessing";
        setApprovalStage(state.detailId, approvalStage);
        const processingOpinion = scopedFormValues("processing." + state.detailId)["\u5904\u7f6e\u610f\u89c1"] || scopedFormValues("processing." + state.detailId)["\u5904\u7406\u4f9d\u636e"] || scopedFormValues("processing." + state.detailId)["\u4e8b\u4ef6\u8fd8\u539f"] || (repeatComplaint ? "\u5224\u5b9a\u4e3a\u518d\u6b21\u6295\u8bc9\uff0c\u63d0\u4ea4" + nextStage + "\u540e\u518d\u8fdb\u5165\u5ba1\u6279\u3002" : "\u5904\u7406\u7ed3\u679c\u5df2\u586b\u5199\u5b8c\u6210\uff0c\u63d0\u4ea4" + nextStage + "\u3002");
        const transition = workflowTransition("ticket", state.detailId, event, { action:"\u63d0\u4ea4\u5904\u7406\u7ed3\u679c", opinion:processingOpinion, receiver:"\u5de5\u5355" + nextStage + "\u4eba" });
        if (!transition.ok) return toast(transition.reason, true);
        repairApprovalWorkPoolAssignments();
        recordSubmittedInspectionRun(ticket);
        persistWorkflowState();
        closeOverlay();
        toast(repeatComplaint ? "\u5904\u7406\u7ed3\u679c\u5df2\u63d0\u4ea4" + nextStage + "\uff0c\u5ba1\u6279\u901a\u8fc7\u540e\u5efa\u7acb\u518d\u6b21\u6295\u8bc9\u5173\u8054" : "\u5904\u7406\u7ed3\u679c\u5df2\u63d0\u4ea4" + nextStage);
        navigate("ticket-process");
      });
    };
    const issues = processingSoftValidationIssues(ticket);
    if (issues.length) return openProcessingSoftValidationConfirm(issues, openSubmitDialog);
    openSubmitDialog();
  }

  function queryCustomer(scope = "customer.1") {
    const prefix = scope ? scope + "." : "";
    const customerNo = state.formValues[prefix + "客户编号"] || "";
    const documentNo = state.formValues[prefix + "证件号码"] || "";
    const accountNo = state.formValues[prefix + "卡号/账号"] || "";
    const mobile = state.formValues[prefix + "预留手机号码"] || "";
    if (!customerNo && !documentNo && !accountNo && !mobile) return toast("请先输入客户编号、证件号码、卡号/账号或预留手机号码", true);
    const condition = [
      customerNo ? "客户编号：" + customerNo : "",
      documentNo ? "证件号码：" + documentNo : "",
      accountNo ? "卡号/账号：" + accountNo : "",
      mobile ? "预留手机号码：" + mobile : ""
    ].filter(Boolean).join("；");
    const number = Number(scope.split(".").pop()) || 1;
    const results = CUSTOMER_REPOSITORY.find({ customerNo, documentNo, accountNo, mobile });
    if (!results.length) {
      return openModal("查询客户信息", '<div class="query-dialog"><div class="query-condition"><span>查询条件</span><strong>' + escapeAttribute(condition) + '</strong></div><div class="ds-empty app-empty-state"><h4>未查询到客户</h4><p>请核对客户编号、证件号码、卡号/账号或预留手机号码。</p></div></div>', "关闭");
    }
    const rows = results.map((item,index) => '<tr><td><input type="radio" name="customer-query-result" value="' + index + '" ' + (index === 0 ? "checked" : "") + '></td><td class="primary-cell">' + escapeAttribute(item.name || "-") + '</td><td>' + escapeAttribute(item.id || "-") + '</td><td>' + escapeAttribute(item.identity?.type || "-") + '</td><td>' + escapeAttribute(item.identity?.number || "-") + '</td><td>' + escapeAttribute(item.contact?.mobile || "-") + '</td><td>' + escapeAttribute(item.relationship?.manager || "-") + ' / ' + escapeAttribute(item.relationship?.organization || "-") + '</td></tr>').join("");
    openModal("查询客户信息", '<div class="query-dialog"><div class="query-condition"><span>查询条件</span><strong>' + escapeAttribute(condition) + '</strong></div><div class="query-result-title"><strong>查询结果</strong><span>共 ' + results.length + ' 条，请选择需要回填的客户</span></div><div class="table-wrap"><table class="table ds-table query-result-table"><thead><tr><th></th><th>客户姓名</th><th>客户编号</th><th>证件类型</th><th>证件号码</th><th>预留手机号码</th><th>客户经理 / 机构</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>', "选择并回填", () => {
      const selected = Number(document.querySelector('input[name="customer-query-result"]:checked')?.value || 0);
      const item = results[selected];
      Object.entries(CUSTOMER_REPOSITORY.toFormFields(item)).forEach(([key, value]) => { state.formValues[prefix + key] = value; });
      const auxiliaryAddress = item.CustAddress || item.custAddress || (typeof item.address === "string" ? item.address : "") || item.address?.fullAddress || item.address?.text || item.contact?.CustAddress || "";
      state.formValues[prefix + "__custAddress"] = String(auxiliaryAddress || "").trim();
      state.formValues[prefix + "是否有客户编号"] = "是";
      state.formValues[prefix + "__matched"] = true;
      state.formValues[prefix + "__customerId"] = CUSTOMER_REPOSITORY.canonicalId(item.id);
      refreshCustomerComplaintCount(scope);
      closeOverlay();
      rerenderPage();
      toast("客户信息 " + number + " 已回填，请人工确认");
    });
  }

  function openRepeatMainTicketQuery() {
    const scope = "processing." + state.detailId;
    const key = scope + ".关联未归档工单主单编号";
    const current = state.formValues[key] || "";
    const currentRow = ticketRowById(state.detailId) || ticketRows[0];
    const rows = [
      ["TS202607020018", "投诉单", currentRow[2], "首次投诉：贷款协商还款", "厦门分行", "处理中", "2026-07-02 14:26"],
      ["TS202606280031", "投诉单", currentRow[2], "首次投诉：息费说明", "厦门分行", "待审批", "2026-06-28 10:08"]
    ];
    const renderRows = filterValue => {
      const matchedRows = rows.filter(row => !filterValue || row[0].toLowerCase().includes(filterValue.toLowerCase()));
      if (!matchedRows.length) return tableEmptyStateRow(7);
      return matchedRows.map((row,index) => `<tr><td><input type="radio" name="repeat-main-ticket-result" value="${row[0]}" ${current === row[0] || (!current && index === 0) ? "checked" : ""}></td><td class="primary-cell">${row[0]}</td><td>${row[2]}</td><td>${ticketAcceptanceChannel(row)}</td><td>${row[4]}</td><td>${statusTag(row[5])}</td><td>${row[6]}</td></tr>`).join("");
    };
    openModal("查询未归档主工单", `<div class="query-dialog"><div class="query-filter-row"><label><span>工单编号</span><input class="di-input" data-repeat-main-query-id value="${escapeAttribute(current)}" placeholder="输入工单编号"></label><label><span>客户姓名</span><input class="di-input" value="${escapeAttribute(currentRow[2])}" disabled></label><button type="button" class="btn xib-btn xib-btn--primary" data-repeat-main-query-submit>查询</button></div><div class="query-result-title"><strong>符合再次投诉判定范围的工单</strong><span>同一客户、15 个自然日、业务类别中类一致</span></div><div class="table-wrap"><table class="table ds-table query-result-table"><thead><tr><th></th><th>工单编号</th><th>客户姓名</th><th>受理渠道</th><th>当前机构</th><th>工单状态</th><th>创建时间</th></tr></thead><tbody data-repeat-main-query-results>${renderRows(current)}</tbody></table></div></div>`, "确认选择", () => {
      const selected = document.querySelector('input[name="repeat-main-ticket-result"]:checked')?.value;
      if (!selected) return toast("请选择一条未归档主工单", true);
      state.formValues[key] = selected;
      closeOverlay();
      rerenderPage();
      toast("已选择主工单 " + selected);
    });
    document.querySelector("[data-repeat-main-query-submit]")?.addEventListener("click", () => {
      const value = document.querySelector("[data-repeat-main-query-id]")?.value.trim() || "";
      const body = document.querySelector("[data-repeat-main-query-results]");
      if (body) body.innerHTML = renderRows(value);
    });
  }
  function relatedTicketQueryRows(filters = {}) {
    let rows = ticketRows.filter(row => row[5] !== "草稿" && ticketListKind(row) !== "再次投诉单");
    if (filters.id) rows = rows.filter(row => row[0].includes(filters.id));
    if (filters.customer) rows = rows.filter(row => row[2].includes(filters.customer));
    if (filters.type && filters.type !== "全部") rows = rows.filter(row => row[1] === filters.type);
    if (filters.status && filters.status !== "全部") rows = rows.filter(row => row[5] === filters.status);
    if (filters.channel && filters.channel !== "全部") rows = rows.filter(row => ticketAcceptanceChannel(row) === filters.channel);
    return rows;
  }

  function relatedTicketQueryTableHtml(rows, selectedIds) {
    const headers = [["工单编号", 0], ["工单类型", 1], ["客户姓名", 2], ["受理渠道", 3], ["当前机构", 4], ["工单状态", 5]];
    const body = rows.length
      ? rows.map(row => '<tr data-query-row="' + row[0] + '"><td><input type="checkbox" name="related-ticket-result" value="' + row[0] + '" ' + (selectedIds.includes(row[0]) ? "checked" : "") + '></td><td class="primary-cell">' + row[0] + '</td><td>' + renderTicketTypeWithKind(row) + '</td><td>' + row[2] + '</td><td>' + ticketAcceptanceChannel(row) + '</td><td>' + row[4] + '</td><td>' + statusTag(row[5]) + '</td></tr>').join("")
      : tableEmptyStateRow(headers.length + 1);
    return '<div class="table-wrap"><table class="table ds-table query-result-table"><thead><tr><th></th>' + headers.map(([label, index]) => sortableHead(label, "related-query", index)).join("") + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function bindRelatedTicketQuery(root) {
    root.addEventListener("click", event => {
      const sortButton = event.target.closest('[data-sort-scope="related-query"]');
      if (sortButton) { sortTableInPlace(sortButton); return; }
      if (!event.target.closest('[data-query-submit]')) return;
      const read = key => root.querySelector('[data-query-filter="' + key + '"]')?.value || "";
      const selectedBefore = [...root.querySelectorAll('input[name="related-ticket-result"]:checked')].map(input => input.value);
      const filters = { id: read("id"), customer: read("customer"), type: read("type"), status: read("status"), channel: read("channel") };
      const rows = sortRowsForTable(relatedTicketQueryRows(filters), "related-query");
      const tableHost = root.querySelector('[data-query-table]');
      if (tableHost) {
        tableHost.innerHTML = relatedTicketQueryTableHtml(rows, selectedBefore);
        applyTableEmptyStates(tableHost);
      }
    });
  }

  function openRelatedTicketQuery() {
    const selectedIds = subprocessSourceTicketRows().map(row => row[0]);
    const filterRow = '<div class="query-filter-row">' +
      '<label><span>工单编号</span><input class="di-input" data-query-filter="id" placeholder="输入工单编号"></label>' +
      '<label><span>客户姓名</span><input class="di-input" data-query-filter="customer" placeholder="输入客户姓名"></label>' +
      '<label><span>工单类型</span><select class="di-native-select" data-query-filter="type"><option>全部</option>' + ["投诉单","信访单","表扬单","建议单"].map(value => '<option>' + value + '</option>').join("") + '</select></label>' +
      '<label><span>工单状态</span><select class="di-native-select" data-query-filter="status"><option>全部</option>' + (DOCUMENT_STATE_MACHINES.ticket.statuses || []).map(value => '<option>' + value + '</option>').join("") + '</select></label>' +
      '<label><span>受理渠道</span><select class="di-native-select" data-query-filter="channel"><option>全部</option>' + ALL_ACCEPTANCE_CHANNEL_OPTIONS.map(value => '<option>' + value + '</option>').join("") + '</select></label>' +
      '<button type="button" class="btn xib-btn xib-btn--primary" data-query-submit>查询</button></div>';
    const initialRows = sortRowsForTable(relatedTicketQueryRows({}), "related-query");
    openModal("查询关联工单", '<div class="query-dialog">' + filterRow + '<div class="query-result-title"><strong>可关联工单</strong><span>筛选条件参考工单处理筛选栏；点击表头可排序；支持多选（多选仅可发起剔除申请、异常投诉、纠纷化解）</span></div><div data-query-table>' + relatedTicketQueryTableHtml(initialRows, selectedIds) + '</div></div>', "确认关联", () => {
      const selected = [...document.querySelectorAll('input[name="related-ticket-result"]:checked')].map(input => input.value);
      if (!selected.length) return toast("请至少选择一条工单", true);
      if (state.subprocessQuickSource) {
        state.subprocessSourceTicket = selected[0];
      } else {
        state.subprocessSourceTickets = selected;
        state.subprocessSourceTicket = selected.length === 1 ? selected[0] : "";
      }
      state.selectedRelatedTicket = selected[0] || "";
      state.subprocessType = "";
      closeOverlay();
      rerenderPage();
      toast("已选择关联工单 " + selected.join("、") + "，申请时间将在提交后由系统生成");
    });
    bindRelatedTicketQuery(document.querySelector("#overlay-root .modal-body"));
  }
  function rectificationFormText(name) {
    const key = "subprocess.溯源整改." + name;
    const control = document.querySelector('[data-field-key="' + key + '"]');
    return String(control?.value ?? state.formValues[key] ?? "").trim();
  }

  function rectificationRoutingRule(key) {
    return window.XIB_COMPLAINT_RECTIFICATION_DATA?.routingRules?.[key] || null;
  }

  function rectificationRoutingUnit(row, target) {
    const record = row ? documentRecordFor("rectification", row) : null;
    const base = record?.fields?.base || {};
    const entry = record?.fields?.entry || {};
    if (target === "rectification") {
      const raw = entry["整改部门或机构"] || rectificationFormText("整改部门或机构") || row?.[4] || currentRoleProfile().institutionLabel;
      const parts = String(raw).split("/").map(value => value.trim()).filter(Boolean);
      return {
        institution:parts[0] || currentRoleProfile().institutionLabel,
        department:parts.slice(1).join(" / ") || parts[0] || currentRoleProfile().departmentLabel || "-",
        label:String(raw)
      };
    }
    const institution = base["所属机构"] || row?.[4] || currentRoleProfile().institutionLabel;
    const department = base["所属部门"] && base["所属部门"] !== "-" ? base["所属部门"] : (row ? "-" : currentRoleProfile().departmentLabel || "-");
    return { institution, department, label:department !== "-" ? department : institution };
  }

  function rectificationApprovalCandidates(row, routingRule) {
    const unit = rectificationRoutingUnit(row, routingRule.target);
    const configured = window.XIB_COMPLAINT_RECTIFICATION_DATA?.approvalCandidates || [];
    return configured.map(candidate => ({ ...candidate, institution:unit.institution, department:unit.department, targetLabel:unit.label }));
  }

  function saveRectificationRoutingAssignment(id, transition, selection) {
    const record = state.documentData.rectifications?.[id];
    if (!record || !selection) return;
    record.fields = record.fields || {};
    const history = Array.isArray(record.fields.routing) ? record.fields.routing : [];
    record.fields.routing = [...history, {
      fromStatus:transition.from,
      toStatus:transition.to,
      nextNode:selection.nextNode,
      targetType:selection.target,
      targetInstitution:selection.institution,
      targetDepartment:selection.department,
      assignee:selection.actor,
      role:selection.role,
      selectedAt:systemTimestamp()
    }];
    record.fields.approval = {
      ...(record.fields.approval || {}),
      "审批节点":selection.nextNode,
      "审批人":selection.actor,
      "审批角色":selection.role,
      "审批机构":selection.institution,
      "审批部门":selection.department
    };
    record.updatedAt = systemTimestamp();
  }

  function openRectificationRoutingDialog({ row = null, ruleKey, title, question, hint, summary = [], confirmLabel = "确认提交", onConfirm }) {
    const rule = rectificationRoutingRule(ruleKey);
    if (!rule) return toast("未找到下一节点人员配置", true);
    const candidates = rectificationApprovalCandidates(row, rule);
    const unit = rectificationRoutingUnit(row, rule.target);
    const summaryHtml = summary.concat([
      ["下一节点", rule.nextNode],
      ["目标机构", unit.institution],
      ["目标部门", unit.department]
    ]).map(([label, value]) => '<div><dt>' + escapeAttribute(label) + '</dt><dd>' + escapeAttribute(value || "-") + '</dd></div>').join("");
    const options = candidates.map(candidate => '<option value="' + escapeAttribute(candidate.actor) + '">' + escapeAttribute(candidate.actor + " · " + candidate.role) + '</option>').join("");
    const content = '<div class="action-dialog rectification-routing-dialog" data-rectification-routing-rule="' + escapeAttribute(ruleKey) + '"><div class="action-dialog-question"><strong>' + escapeAttribute(question) + '</strong><span>' + escapeAttribute(hint) + '</span></div><dl class="action-summary-grid">' + summaryHtml + '</dl><label class="action-full-field"><span>下一节点人员 <em>*</em></span><select class="di-native-select is-fluid" id="rectification-next-assignee"><option value="">请选择' + escapeAttribute(rule.nextNode) + '人员</option>' + options + '</select></label></div>';
    openModal(title, content, confirmLabel, () => {
      const actor = document.getElementById("rectification-next-assignee")?.value || "";
      const candidate = candidates.find(item => item.actor === actor);
      if (!candidate) return toast("请选择下一节点人员", true);
      onConfirm?.({ ...candidate, target:rule.target, nextNode:rule.nextNode });
    });
  }

  function upsertRectificationRow(status) {
    const related = document.querySelector('#rectification-form-main [name="related-event"]')?.value.trim() || state.subprocessSourceTicket || "";
    const title = rectificationFormText("整改单名称") || "未命名溯源整改单";
    const now = systemTimestamp();
    let row = rectificationRows.find(item => item[0] === state.rectificationEditId);
    if (!row) {
      const id = generateDocumentId("溯源整改");
      row = [id, "溯源整改", related, "陈敏慧", currentRoleProfile().institutionLabel, status, now, title, status, Boolean(rectificationFormText("附件"))];
      rectificationRows.unshift(row);
      state.rectificationEditId = id;
    } else {
      row[2] = related; row[5] = status; row[6] = now; row[7] = title; row[8] = status;
    }
    const existing = documentRecordFor("rectification", row) || {};
    const entryValues = scopedFormValues("subprocess.溯源整改");
    delete entryValues["关联工单编号"];
    entryValues["关联工单编号"] = related ? related.split("、").filter(Boolean) : [];
    state.documentData.rectifications[row[0]] = {
      ...existing, id: row[0], documentType: "溯源整改", schemaVersion: FORM_SCHEMA.meta?.version || "1.4.0",
      relatedTicketIds: related ? related.split("、").filter(Boolean) : [],
      fields: {
        ...(existing.fields || {}),
        base: { ...(existing.fields?.base || {}), "创建人": "陈敏慧-60157", "所属机构": row[4], "所属部门": qualifiedDepartmentName(row[4], "消费者权益保护部"), "溯源整改单编号": row[0], "申请时间": existing.fields?.base?.["申请时间"] || now, "办结时间": status === "已办结" ? now : "-" },
        entry: entryValues, plan: existing.fields?.plan || {}, result: existing.fields?.result || {}, statistics: existing.fields?.statistics || {}, approval: existing.fields?.approval || {}
      }, createdAt: existing.createdAt || now, updatedAt: now
    };
    persistWorkflowState();
    return row;
  }

  function saveRectificationDraft() {
    const row = upsertRectificationRow("草稿");
    toast(row[0] + " 草稿已保存");
    rerenderPage();
  }

  function submitRectification() {
    const form = document.getElementById("rectification-form-main");
    if (!form) return;
    const related = form.querySelector('[name="related-event"]');
    const missing = [...form.querySelectorAll(".form-label.required")].filter(label => {
      const holder = label.parentElement.querySelector("[data-field-key]");
      if (!holder) return false;
      const value = holder.matches("input,textarea,select") ? holder.value : state.formValues[holder.dataset.fieldKey];
      return Array.isArray(value) ? !value.length : !String(value || "").trim();
    });
    if (missing.length) {
      missing[0].parentElement.querySelector("input,textarea,button")?.focus();
      return toast("还有 " + missing.length + " 个必填整改字段未完成", true);
    }
    const title = rectificationFormText("整改单名称");
    const existingRow = rectificationRows.find(item => item[0] === state.rectificationEditId);
    const fromStatus = existingRow?.[5] || "草稿";
    const event = fromStatus === "草稿" ? "submitProblemDraft" : "submitProblem";
    const nextStatus = "问题待审核";
    openRectificationRoutingDialog({
      row:existingRow,
      ruleKey:"problemSubmit",
      title:"提交溯源整改单",
      question:"确认提交" + title + "？",
      hint:"请选择整改单发起部门的审批人员，提交后由该人员审核整改问题。",
      summary:[["关联工单编号", related.value.trim() || "-"], ["提交后状态", nextStatus]],
      confirmLabel:"确认提交",
      onConfirm:selection => {
      const row = upsertRectificationRow(fromStatus);
      const transition = workflowTransition("rectification", row[0], event, { action: event === "submitProblemDraft" ? "提交整改问题" : "提交整改单", opinion: "整改问题材料已提交。", receiver: selection.actor, assignee:selection.actor });
      if (!transition.ok) return toast(transition.reason, true);
      row[8] = transition.to;
      saveRectificationRoutingAssignment(row[0], transition, selection);
      persistWorkflowState();
      closeOverlay();
      window.XIBComplaintRectification?.setListTab("todo");
      toast(row[0] + " 已提交，当前状态：" + transition.to);
      returnToRectificationList("rectification-create");
      }
    });
  }
  function validateSubprocessCreation(requireComplete = true) {
    const related = document.querySelector('#subprocess-form-main [name="related-event"]');
    if (!related?.value.trim()) { related?.focus(); related?.classList.add('is-error'); toast('请填写关联工单编号', true); return null; }
    const relatedTickets = String(related.value.trim()).split(/[、,，]/).map(value => value.trim()).filter(Boolean);
    const definition = subprocessDefinition();
    if (relatedTickets.length > 1 && !SUBPROCESS_MULTI_SELECT_TYPES.includes(definition.type)) {
      toast('多选关联工单仅支持发起' + SUBPROCESS_MULTI_SELECT_TYPES.join('、'), true);
      return null;
    }
    for (const ticketId of relatedTickets) {
      const row = ticketRowById(ticketId);
      const availability = subprocessInitiationAvailability(definition, row);
      if (!availability.enabled) { toast(availability.reason, true); return null; }
    }
    if (requireComplete) {
      const requiredControls = [...document.querySelectorAll("#subprocess-form-main .form-label.required")].map(label => {
        const item = label.closest(".form-item");
        const upload = item?.querySelector("[data-drag-upload][data-field-key]");
        if (upload?.classList.contains("is-disabled")) return null;
        if (upload) return { control:upload, value:state.formValues[upload.dataset.fieldKey] || "" };
        const keyed = item?.querySelector("[data-field-key]");
        if (keyed?.disabled) return null;
        if (keyed?.dataset.fieldKey) {
          const stored = state.formValues[keyed.dataset.fieldKey];
          return { control:keyed, value:stored !== undefined ? stored : keyed.value };
        }
        const control = item?.querySelector("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)");
        return control ? { control, value:control.value } : null;
      }).filter(Boolean);
      const missingFields = requiredControls.filter(item => Array.isArray(item.value) ? !item.value.length : !String(item.value || "").trim());
      const firstMissing = missingFields[0]?.control;
      if (missingFields.length) { showRequiredFieldError(firstMissing, "该字段为必填项，请补充后再提交"); toast("还有 " + missingFields.length + " 个必填子流程字段未完成", true); return null; }
      const scope = "subprocess." + definition.type;
      const numericFields = subprocessDifferenceSections(definition, "create").flatMap(section => section.fields).filter(field => ["number", "amount"].includes(field.type));
      for (const field of numericFields) {
        const key = scope + "." + field.name;
        const rawValue = String(state.formValues[key] ?? "").replace(/,/g, "").trim();
        if (!rawValue) continue;
        const decimalPattern = field.precision != null ? new RegExp("^\\d+(?:\\.\\d{1," + field.precision + "})?$") : /^-?\d+(?:\.\d+)?$/;
        const numericValue = Number(rawValue);
        if (!decimalPattern.test(rawValue) || !Number.isFinite(numericValue) || (field.min != null && numericValue < field.min) || (field.max != null && numericValue > field.max)) {
          const control = document.querySelector('[data-field-key="' + key + '"]');
          control?.focus();
          control?.classList.add("is-error");
          const precisionText = field.precision != null ? "，且最多保留" + field.precision + "位小数" : "";
          toast(field.name + "必须在" + (field.min ?? 0) + "至" + (field.max ?? "允许上限") + "之间" + precisionText, true);
          return null;
        }
        state.formValues[key] = rawValue;
      }
    }
    return { related:relatedTickets.join("、"), relatedTickets, definition };
  }

  function saveSubprocessDraft() {
    const model = validateSubprocessCreation(false);
    if (!model) return;
    const record = createSubprocessRecord(model.definition.type, model.relatedTickets, { status:"草稿", existingId:state.subprocessEditingId });
    state.subprocessSourceTicket = "";
    state.subprocessSourceTickets = [];
    toast(record.document + "草稿已保存，可在子单创建列表继续跟踪");
    navigate("subprocess-create");
  }

  function submitSubprocess() {
    const model = validateSubprocessCreation(true);
    if (!model) return;
    const nextStatus = subprocessInitialStatus(model.definition.type, model.relatedTickets[0]);
    const nextNode = ["待处理", "处理中"].includes(nextStatus) ? "子单处理" : nextStatus === "待复核" ? "客服渠道复核" : nextStatus === "待初审" ? "子流程初审" : nextStatus === "待审批" ? "子流程审批" : "系统直接办结";
    const sourceRow = ticketRowById(model.relatedTickets[0]);
    const sourceRecord = sourceRow ? documentRecordFor("ticket", sourceRow) : null;
    const sourceProcessing = sourceRecord?.fields?.processing || {};
    const sourceEntry = sourceRecord?.fields?.entry || {};
    const assignmentScope = "subprocess." + model.definition.type + ".";
    const receivingInstitution = state.formValues[assignmentScope + "接收机构"] || sourceProcessing["工单处理机构"] || sourceEntry["工单接收机构"] || ticketReceivingInstitution(sourceRow) || "-";
    const receivingDepartment = state.formValues[assignmentScope + "接收部门"] || sourceProcessing["工单处理部门"] || sourceProcessing["工单接收部门"] || ticketReceivingDepartment(sourceRow) || "-";
    const receiver = state.formValues[assignmentScope + "处置员"] || state.formValues[assignmentScope + "接收人"] || sourceProcessing["处理员"] || ticketLastHandler(sourceRow) || "-";
    const selectedAssignee = receiver !== "-" ? normalizedAssigneeName(receiver) : "";
    const processingAssignee = nextStatus === "处理中" ? (selectedAssignee || COMPLAINT_WORK_POOL.identity("handler").actor) : receiver;
    openModal('确认提交', '<div class="action-dialog"><div class="action-dialog-question"><strong>确认提交' + model.definition.document + '？</strong><span>系统将根据子流程类型和关联工单渠道自动选择下一节点。</span></div><dl class="action-summary-grid"><div><dt>子流程类型</dt><dd>' + escapeAttribute(model.definition.type) + '</dd></div><div><dt>关联工单</dt><dd>' + escapeAttribute(model.related) + '</dd></div><div><dt>接收机构</dt><dd>' + escapeAttribute(receivingInstitution) + '</dd></div><div><dt>接收部门</dt><dd>' + escapeAttribute(receivingDepartment) + '</dd></div><div><dt>接收人</dt><dd>' + escapeAttribute(processingAssignee) + '</dd></div><div><dt>提交后状态</dt><dd>' + escapeAttribute(nextStatus) + '</dd></div><div><dt>下一节点</dt><dd>' + escapeAttribute(nextNode) + '</dd></div></dl></div>', '确认提交', () => {
      const record = createSubprocessRecord(model.definition.type, model.relatedTickets, { status:"草稿", existingId:state.subprocessEditingId });
      const assignmentMetadata = nextStatus === "处理中"
        ? { targetOrg: receivingInstitution !== "-" ? receivingInstitution : "", assignee: processingAssignee }
        : {};
      const transition = workflowTransition("subprocess", record.id, subprocessSubmitEvent(nextStatus), { action:"提交子流程", opinion:"字段校验通过，按类型状态矩阵流转。", receiver:nextNode, ...assignmentMetadata });
      if (!transition.ok) return toast(transition.reason, true);
      record.status = transition.to;
      record.relationStatus = transition.to + "，尚未关联";
      if (["待初审", "待审批"].includes(transition.to)) setApprovalStage(record.id, transition.to === "待初审" ? "initial" : "approval");
      state.subprocessSourceTicket = "";
      state.subprocessSourceTickets = [];
      closeOverlay();
      persistWorkflowState();
      toast(record.document + "已提交，状态更新为" + transition.to);
      navigate('subprocess-create');
    });
  }

  function completeTicketSubmission(submissionSmsTemplate = "", submissionSmsRecipient = "") {
    const createdAt = systemTimestamp();
    const editingRow = state.ticketEditingId ? ticketRowById(state.ticketEditingId) : null;
    const id = editingRow?.[0] || generateDocumentId(state.workOrderType, createdAt);
    const customer = state.formValues["customer.1.客户姓名"] || "待确认";
    const subject = state.formValues["投诉/信访事项"] || state.formValues["反馈内容"] || "待补充";
    const dispatchPath = state.formValues["派发机构"] || "";
    const dispatchDepartment = state.formValues["派发部门"] || "";
    const org = institutionDisplayName(dispatchPath) === "-" ? currentRoleProfile().institutionLabel : institutionDisplayName(dispatchPath);
    const initialStatus = ticketRequiresReview(state.workOrderType) ? "待复核" : "待处理";
    if (editingRow) {
      editingRow[1] = state.workOrderType;
      editingRow[2] = customer;
      editingRow[3] = subject;
      editingRow[4] = org;
      editingRow[6] = editingRow[6] || createdAt;
    } else {
      ticketRows.unshift([id, state.workOrderType, customer, subject, org, initialStatus, createdAt]);
    }
    const entryValues = {};
    Object.entries(state.formValues).forEach(([key, value]) => {
      if (!key.startsWith("processing.") && !key.startsWith("subprocess.")) {
        entryValues[key.replace(/^customer\.1\./, "")] = deepClone(value);
      }
    });
    entryValues["工单编号"] = id;
    entryValues["建单时间"] = createdAt;
    entryValues["工单类型"] = state.workOrderType;
    entryValues["工单接收机构"] = org;
    const existingDocument = state.documentData.tickets[id];
    state.documentData.tickets[id] = existingDocument ? {
      ...existingDocument,
      documentType: state.workOrderType,
      fields: { ...existingDocument.fields, entry: entryValues },
      updatedAt: createdAt,
      ...(state.workOrderType === "信访单" ? { dispositionDeadline: entryValues["处置期限"] || "" } : {})
    } : {
      id,
      documentType: state.workOrderType,
      schemaVersion: FORM_SCHEMA.meta?.version || "1.0.0",
      fields: { entry: entryValues, processing:{}, review:{}, initialApproval:{}, countersign:{}, approval:{} },
      attachments: [],
      createdAt,
      updatedAt: createdAt,
      ...(state.workOrderType === "信访单" ? { dispositionDeadline: entryValues["处置期限"] || "" } : {})
    };
    if (editingRow) {
      const transition = workflowTransition("ticket", id, "submit", { action:"驳回后重新提交", opinion:"已根据最新驳回意见修改并重新提交。", receiver:"客服渠道复核" });
      if (!transition.ok) return toast(transition.reason, true);
    }
    if (initialStatus === "待复核") COMPLAINT_WORK_POOL.advance("ticket", id, initialStatus);
    if (submissionSmsTemplate) recordTicketAcceptanceSms(ticketRowById(id), submissionSmsTemplate, "submission", submissionSmsRecipient);
    persistWorkflowState();
    state.workOrderType = "";
    state.ticketEditingId = "";
    state.ticketDraftSource = "";
    state.formValues = {};
    state.aiClassificationReady = false;
    state.aiTrsTags = {}; state.aiTagSuggestions = {}; state.aiTagSlotCounts = {}; state.aiTagProvenance = {}; state.aiTagSources = {}; state.aiClassificationSuggestions = {}; state.aiGeneratedFields.clear();
    // 待处理工单尚未领取，处理员进入工单处理时应默认看到其所在的机构工单池。
    if (initialStatus === "待处理") state.processScope = "机构工单池";
    navigate("ticket-create");
    const nextStep = initialStatus === "待复核" ? "已进入复核" : "已派发至工单处理的机构工单池，待处理员领取";
    const smsResult = submissionSmsTemplate ? submissionSmsTemplate + "已由系统自动发送并写入联系记录" : "本次未发送短信";
    showContactResult(true, "工单提交成功", "工单已生成并进入下一处理节点。", [
      { label:"流转结果", value:nextStep },
      { label:"短信发送", value:smsResult }
    ]);
  }

  function submitTicket() {
    if (!state.workOrderType) return toast("请先选择工单类型", true);
    const form = document.getElementById("ticket-form-main");
    syncInstitutionDepartmentControls(form, "派发机构");
    const missing = [...form.querySelectorAll(".form-label.required")].map(label => {
      const item = label.closest(".form-item");
      const upload = item?.querySelector("[data-drag-upload][data-field-key]");
      if (upload) return String(state.formValues[upload.dataset.fieldKey] || "").trim() ? null : upload;
      const keyed = item?.querySelector("[data-field-key]");
      if (keyed?.disabled) return null;
      if (keyed?.dataset.fieldKey) {
        const stored = state.formValues[keyed.dataset.fieldKey];
        const value = stored !== undefined ? stored : keyed.value;
        const completed = Array.isArray(value) ? value.length > 0 : String(value || "").trim();
        return completed || keyed.type === "radio" ? null : keyed;
      }
      const control = item?.querySelector("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)");
      return control && !String(control.value || "").trim() && control.type !== "radio" ? control : null;
    }).filter(Boolean);
    form.querySelectorAll("[data-business-line-picker]").forEach(host => {
      const hidden = host.querySelector('input[type="hidden"]');
      const value = state.formValues[hidden?.dataset.fieldKey] || {};
      if (hidden && !String(value.primary || hidden.value || "").trim()) missing.push(hidden);
    });
    if (missing.length) {
      const target = missing[0].matches?.("[data-drag-upload]")
        ? missing[0]
        : missing[0].type === "hidden"
          ? missing[0].parentElement.querySelector(".di-select,.di-picker-trigger")
          : missing[0];
      target?.focus();
      target?.classList.add("is-error");
      toast(`还有 ${missing.length} 个必填项未完成`, true);
      return;
    }
    if (state.workOrderType === "信访单") {
      const deadlineControl = form.querySelector('[data-field-key="处置期限"]');
      const manualDeadline = state.formValues["处置期限"] || deadlineControl?.value || "";
      if (!manualDeadline.trim()) {
        deadlineControl?.parentElement.querySelector(".di-picker-trigger")?.classList.add("is-error");
        deadlineControl?.parentElement.querySelector(".di-picker-trigger")?.focus();
        return toast("信访单必须手工录入处置期限后才能提交并派发", true);
      }
      state.formValues["处置期限"] = manualDeadline;
    }
    const requiresReview = ticketRequiresReview(state.workOrderType);
    const submittedStatus = requiresReview ? "待复核" : "待处理";
    const submittedHint = requiresReview ? "提交后先进入客服中心复核，复核通过后按派发规则进入对应机构工单池。" : "提交后按派发规则直接进入对应机构工单池。";
    const summary = `<div class="action-dialog"><div class="action-dialog-question"><strong>确认提交${state.workOrderType}？</strong><span>${submittedHint}</span></div><dl class="action-summary-grid"><div><dt>工单类型</dt><dd>${state.workOrderType}</dd></div><div><dt>派发机构</dt><dd>${dispatchInstitutionLabel(state.formValues["派发机构"]) || "待智能推荐"}</dd></div><div><dt>客户姓名</dt><dd>${state.formValues["customer.1.客户姓名"] || "待确认"}</dd></div><div><dt>提交后状态</dt><dd>${submittedStatus}</dd></div></dl>`;
    const openConfirm = () => {
      if (state.workOrderType !== "投诉单" || ticketSmsDeferredUntilReview(state.workOrderType, state.formValues["受理渠道"])) {
        return openModal("确认提交", summary + "</div>", "确认提交", () => completeTicketSubmission());
      }
      return openTicketSmsConfirmation({ title:"确认提交", summary, confirmLabel:"确认提交", onConfirm:completeTicketSubmission });
    };
    const softIssues = [];
    for (let customerIndex = 1; customerIndex <= customerCount(); customerIndex += 1) {
      const customerScope = "customer." + customerIndex;
      const customerNameValue = String(state.formValues[customerScope + ".客户姓名"] || "").trim();
      const suffix = customerCount() > 1 ? "（客户 " + customerIndex + "）" : "";
      if (/某/.test(customerNameValue) || /(先生|女士|小姐|阿姨|叔叔|爷爷|奶奶|同学|大妈|大爷|太太|小哥|大姐|师傅|小妹|大哥)$/.test(customerNameValue)) {
        softIssues.push({ field: "客户姓名" + suffix, value: customerNameValue, reason: "客户姓名可能不完整，建议尽量填写明确的全名，便于高发客户识别与重复投诉统计。" });
      }
      if (!String(state.formValues[customerScope + ".证件号码"] || "").trim()) {
        softIssues.push({ field: "证件号码" + suffix, value: "未填写", reason: "证件号码未填写，建议补充完善客户证件号码，便于后续客户识别与统计。" });
      }
    }
    if (softIssues.length) return openProcessingSoftValidationConfirm(softIssues, openConfirm);
    return openConfirm();
  }
  const TICKET_DEMO_PROFILES = Object.freeze({
    "投诉单": Object.freeze({ customerId:"C202607000001", channel:"客服电话", recordingId:"CALL-20260828-091832", eventDate:"2026-08-26", receivedAt:"2026-08-27 09:20", subject:"贷款协商还款", object:"王芳-XIB0004", content:"客户来电反映个人经营贷款还款方案及息费计算说明不够清晰，希望银行核实并提供明确答复。", request:"其他", institution:"厦门分行", line:{ primary:"零售金融部", optional:"风险管理部" } }),
    "信访单": Object.freeze({ customerId:"C202607000002", channel:"纪检", eventDate:"2026-08-22", receivedAt:"2026-08-25 10:20", transferAt:"2026-08-25 10:15", deadline:"2026-09-24 18:00", petitionType:"纪检（消保类申诉）", subject:"账户管控", object:"账户管理及风险控制措施", content:"来访人反映账户管控措施影响日常使用，申请核查采取措施的依据、期限及解除条件。", request:"恢复原状", institution:"厦门嘉禾支行", line:{ primary:"运营管理部", optional:"风险管理部" } }),
    "表扬单": Object.freeze({ customerId:"C202607000003", channel:"客服电话", recordingId:"CALL-20260828-104506", eventDate:"2026-08-24", receivedAt:"2026-08-24 10:50", content:"客户来电表扬网点工作人员耐心协助办理适老化服务，并清楚说明业务注意事项。", institution:"厦门文园支行", line:{ primary:"零售金融部", optional:"" } }),
    "建议单": Object.freeze({ customerId:"C202607000004", channel:"在线客服", eventDate:"2026-08-23", receivedAt:"2026-08-23 14:35", content:"客户建议在移动客户端还款页面增加费用构成说明、办理进度提示和在线咨询入口。", institution:"厦门分行", line:{ primary:"数字金融部", optional:"零售金融部" } })
  });

  function fillTicketDemo() {
    const selectedType = document.getElementById("work-order-type")?.value || state.workOrderType;
    const type = TICKET_DEMO_PROFILES[selectedType] ? selectedType : "投诉单";
    const profile = TICKET_DEMO_PROFILES[type];
    state.workOrderType = type;
    state.formValues = {};
    state.aiClassificationReady = false;
    state.aiTrsTags = {};
    state.aiTagSuggestions = {};
    state.aiTagSlotCounts = {};
    state.aiTagProvenance = {};
    state.aiTagSources = {};
    state.aiClassificationSuggestions = {};
    state.aiGeneratedFields.clear();
    const demoCustomer = CUSTOMER_REPOSITORY.get(profile.customerId);
    const customerFields = CUSTOMER_REPOSITORY.toFormFields(demoCustomer);
    const demoCustomerValues = Object.fromEntries(Object.entries(customerFields).map(([key, value]) => ["customer.1." + key, value]));
    Object.assign(state.formValues, {
      ...demoCustomerValues,
      "投诉人数":"1",
      "customer.1.是否有客户编号":"是",
      "customer.1.__customerId":demoCustomer.id,
      "受理渠道":profile.channel,
      "客户事件时间":profile.eventDate,
      "接收时间":profile.receivedAt || "",
      "处置期限":profile.deadline || "",
      "转送时间":profile.transferAt || "",
      "录音编号":profile.recordingId || "",
      "信访类型":profile.petitionType || "",
      "是否发送短信":"是",
      "联系人姓名":customerFields["客户姓名"] || demoCustomer.name,
      "联系人证件号码":customerFields["证件号码"] || "",
      "联系人性别":customerFields["客户性别"] || "未知",
      "联系方式":customerFields["预留手机号码"] || "",
      "投诉/信访事项":profile.subject || "",
      "所属业务条线":profile.line,
      "反馈内容":profile.content,
      "投诉/信访/表扬机构":profile.institution
    });
    if (customerServiceDraftChannelLocked()) state.formValues["受理渠道"] = "客服电话";
    refreshCustomerComplaintCount("customer.1");
    if (type !== "投诉单") state.formValues["投诉/信访对象"] = profile.object || "";
    if (type === "投诉单") {
      Object.assign(state.formValues, {
        "投诉对象":profile.object || "",
        "主体诉求":"请核实贷款还款方案及息费计算依据，并向客户作出明确说明。"
      });
    }
    rerenderPage();
    toast(type + " Demo 已填写客户、受理及工单内容；AI 分类与派发待填入");
  }
  function fillProcessingDemo() {
    const row = ticketRowById(state.detailId) || ticketRows[0];
    const scope = "processing." + row[0];
    state.workOrderType = row[1];
    const fillPass = () => {
      PROCESSING_FIELDS.filter(field => fieldVisible(field, scope)).forEach(field => {
        const key = scope + "." + field.name;
        if (field.type === "readonly") return;
        if (state.formValues[key]) return;
        if (field.type === "checkboxGroup" || (field.type === "hierarchyCascader" && field.multiple)) state.formValues[key] = field.defaultValues || [field.options?.[0]].filter(Boolean);
        else if (field.type === "personSelect") state.formValues[key] = complaintObjectOptions(ticketComplaintInstitutionValue(row)).find(value => value !== "-") || "-";
        else if (field.type === "outboundContactTime") state.formValues[key] = outboundContactTimesForTicket(row)[0] || "";
        else if (field.type === "select" || field.type === "radio") state.formValues[key] = field.defaultValue || field.options?.[0] || "是";
        else if (field.type === "upload") state.formValues[key] = "处理结果示例附件.pdf";
        else if (field.type === "date") state.formValues[key] = "2026-07-18";
        else if (field.type === "datetime") state.formValues[key] = "2026-07-18 15:30";
        else state.formValues[key] = "已核验业务记录、合同约定和客户沟通内容，现填写用于流程演示的" + field.name + "。";
      });
    };
    fillPass();
    fillPass();
    if (row[1] === "投诉单") {
      const institutions = ["总行 / 总行", "上海分行 / 上海分行"];
      state.formValues[scope + ".会签机构"] = institutions;
      state.formValues[scope + ".会签部门"] = countersignDepartmentValues(institutions);
    }
    rerenderPage();
    toast("工单处理 Demo 信息已填写");
  }

  function fillSubprocessProcessingDemo() {
    const row = [...subprocessRows, ...rectificationRows].find(item => item[0] === state.subprocessId) || subprocessRows[0];
    const definition = subprocessDefinition(row[1]);
    const scope = "subprocess-processing." + definition.type;
    subprocessDifferenceSections(definition, definition.type === "异常投诉" ? "create" : "process").forEach(section => section.fields.forEach(field => {
      const key = scope + "." + field.name;
      if (field.type === "readonly") return;
      if (field.type === "checkboxGroup") state.formValues[key] = [field.options?.[0] || "是"];
      else if (field.type === "select" || field.type === "radio") state.formValues[key] = field.options?.[0] || "是";
      else if (field.type === "upload") state.formValues[key] = definition.document + "处理材料.pdf";
      else if (field.type === "date") state.formValues[key] = "2026-07-18";
      else if (field.type === "datetime") state.formValues[key] = "2026-07-18 15:30";
      else state.formValues[key] = "已结合关联主工单完成" + field.name + "，此处为开发测试演示数据。";
    }));
    rerenderPage();
    toast(definition.document + "处理阶段 Demo 信息已填写");
  }

  function demoFieldValue(field, scope, documentLabel) {
    if (field.valueMap) {
      const dependency = state.formValues[scope + "." + field.valueMap.key];
      return field.valueMap.values?.[dependency] || field.value || "";
    }
    if (field.type === "readonly" || field.type === "relatedEventPicker") return undefined;
    if (field.type === "hierarchyCascader") {
      const value = hierarchyDemoValue(field.dictionary, "", field.tree || null);
      return field.multiple ? [value].filter(Boolean) : value;
    }
    if (field.type === "cascader") return cascaderDemoValue(field.cascader);
    if (field.type === "checkboxGroup") return [field.options?.[0]].filter(Boolean);
    if (field.type === "select" || field.type === "radio") {
      const dependency = field.optionsBy?.key ? state.formValues[scope + "." + field.optionsBy.key] : "";
      const options = field.optionsBy ? field.optionsBy.values?.[dependency] || [] : field.options || (field.dictionary ? tagTreeLeafOptions(field.dictionary) : []);
      return options[0] || "";
    }
    if (field.type === "date") return "2026-07-17";
    if (field.type === "datetime") return "2026-07-17 10:30";
    if (field.type === "year") return "2026";
    if (field.type === "upload") return documentLabel + "示例材料.pdf";
    if (field.type === "number") return "1000";
    return "用于演示的" + field.name + "信息，已根据关联工单核实并补充。";
  }

  const SUBPROCESS_DEMO_OVERRIDES = Object.freeze({
    "延长申请": Object.freeze({ "延长原因":"因需补充调取交易流水、合同影像和沟通记录，申请延长处置期限。" }),
    "撤销投诉": Object.freeze({ "撤销原因":"客户已收到费用计算说明并确认协商方案，自愿申请撤销本次投诉。" }),
    "异常投诉": Object.freeze({ "异常投诉认定依据":"同一事项在短期内多渠道重复提交，诉求与已核实事实存在明显差异。", "报告摘要":"已汇总关联工单、沟通记录及业务凭证，供异常投诉审核认定。" }),
    "剔除申请": Object.freeze({ "剔除原因":"经核验该记录不符合投诉统计口径，申请从统计范围中剔除。" }),
    "废止申请": Object.freeze({ "废止原因":"原申请依据发生变化且后续无需继续流转，申请废止当前工单。" }),
    "投诉调查": Object.freeze({ "投诉调查原因":"需进一步核验业务办理过程、费用披露记录及客户沟通情况。" }),
    "投诉问责": Object.freeze({ "责任描述":"业务解释不够完整，客户沟通记录归档不及时。", "判断依据":"依据工单调查材料、电话录音及内部业务记录综合判断。" }),
    "纠纷化解": Object.freeze({ "第1轮调解情况":"已向双方说明争议焦点并确认可协商范围。", "调解执行情况":"双方已按调解方案完成确认，后续持续跟踪执行情况。" }),
    "异议核查": Object.freeze({ "核查内容":"核查客户对处理结论提出异议的事实依据、业务记录和告知过程。", "核查情况":"已复核原工单、系统流水及联系记录，形成独立核查意见。" })
  });

  function fillSubprocessDemo() {
    const definition = subprocessDefinition();
    const scope = "subprocess." + definition.type;
    if (!state.subprocessSourceTicket && !(state.subprocessSourceTickets || []).length) state.subprocessSourceTicket = "TS202607230012";
    state.formValues["子流程-申请时间"] = "提交后系统自动生成";
    const fields = subprocessDifferenceSections(definition, "create").flatMap(section => section.fields);
    const overrides = SUBPROCESS_DEMO_OVERRIDES[definition.type] || {};
    for (let pass = 0; pass < 2; pass += 1) {
      fields.forEach(field => {
        const key = scope + "." + field.name;
        const configuredValue = Object.prototype.hasOwnProperty.call(overrides, field.name) ? overrides[field.name] : undefined;
        const value = configuredValue !== undefined ? configuredValue : demoFieldValue(field, scope, definition.document);
        if (value !== undefined && value !== "" && (!state.formValues[key] || pass > 0)) state.formValues[key] = value;
      });
    }
    rerenderPage();
    toast(definition.document + " Demo 信息已按“" + definition.type + "”类型填写");
  }
  function subprocessSupplementValues(row) {
    const definition = subprocessDefinition(row[1]);
    const scope = subprocessSupplementScope(row);
    const fields = subprocessSupplementFields(definition);
    const values = Object.fromEntries(fields.map(field => [field.name, deepClone(state.formValues[scope + "." + field.name] ?? "")]));
    return { definition, scope, fields, values, selectedContactIndex:state.formValues[scope + "._selectedContactIndex"] ?? "" };
  }

  function validateSubprocessSupplement(row) {
    const model = subprocessSupplementValues(row);
    const visibleFields = model.fields.filter(field => fieldVisible(field, model.scope));
    const missing = visibleFields.filter(field => fieldRequired(field, model.scope) && !String(model.values[field.name] ?? "").trim()).map(field => field.name);
    if (row[1] === "延长申请" && model.values["是否告知延期"] === "是" && model.selectedContactIndex === "") missing.unshift("联系记录");
    return { ...model, missing:[...new Set(missing)] };
  }

  function saveSubprocessSupplement() {
    const row = workflowRow("subprocess", state.subprocessId);
    if (!row || row[5] !== "待补录") return toast("当前子流程不处于待补录状态", true);
    const model = subprocessSupplementValues(row);
    state.supplementDataBySubprocess[row[0]] = { fields:model.values, selectedContactIndex:model.selectedContactIndex, savedAt:systemTimestamp() };
    snapshotDocumentStage("subprocess", row[0], "supplement", model.values);
    persistWorkflowState();
    toast(row[0] + " 的补录信息已保存");
  }

  function submitSubprocessSupplement() {
    const row = workflowRow("subprocess", state.subprocessId);
    if (!row || row[5] !== "待补录") return toast("当前子流程不处于待补录状态", true);
    const model = validateSubprocessSupplement(row);
    if (model.missing.length) return toast("请完成补录字段：" + model.missing.join("、"), true);
    const summary = Object.entries(model.values).filter(([, value]) => value !== "").map(([name, value]) => name + "：" + value).join("；");
    const detailRows = Object.entries(model.values).filter(([, value]) => value !== "").map(([name, value]) => '<div><dt>' + escapeAttribute(name) + '</dt><dd>' + escapeAttribute(value) + '</dd></div>').join("");
    openModal("提交补录", '<div class="action-dialog"><div class="action-dialog-question"><strong>确认提交补录？</strong><span>提交后子流程状态将更新为已办结，补录字段不可继续编辑。</span></div><dl class="action-summary-grid"><div><dt>子流程单编号</dt><dd>' + row[0] + '</dd></div><div><dt>子流程类型</dt><dd>' + row[1] + '</dd></div>' + detailRows + '<div><dt>提交后状态</dt><dd>已办结</dd></div></dl></div>', "确认提交", () => {
      state.supplementDataBySubprocess[row[0]] = { fields:model.values, selectedContactIndex:model.selectedContactIndex, savedAt:systemTimestamp(), submittedAt:systemTimestamp() };
      snapshotDocumentStage("subprocess", row[0], "supplement", model.values);
      const transition = workflowTransition("subprocess", row[0], "completeSupplement", { action:"提交补录", flowOpinion:summary, systemGeneratedOpinion:true, result:"通过", receiver:"-" });
      if (!transition.ok) return toast(transition.reason, true);
      closeOverlay();
      persistWorkflowState();
      toast(row[0] + " 已完成补录并办结");
      state.detailEntry = "view";
      navigate("subprocess-manage");
    });
  }

  function persistSubprocessProcessingDraft(row, submitting = false) {
    const definition = subprocessDefinition(row?.[1]);
    const values = scopedFormValues("subprocess-processing." + definition.type);
    if (row?.[1] === "溯源整改") {
      const record = documentRecordFor("rectification", row);
      if (!record) return;
      record.fields = record.fields || {};
      const stage = row[5] === "方案待提交" ? "plan" : "result";
      record.fields[stage] = { ...(record.fields[stage] || {}), ...deepClone(values) };
      if (stage === "plan") {
        record.fields.plan["提交时间"] = submitting ? systemTimestamp() : (record.fields.plan["提交时间"] || "-");
        record.fields.plan["执行部门/团队"] = record.fields.entry?.["整改部门或机构"] || row[4];
      }
      if (stage === "result" && submitting) {
        const products = Array.isArray(record.fields.entry?.["投诉产品标签"]) ? record.fields.entry["投诉产品标签"] : [];
        const productSeries = Object.fromEntries(products.map((product, index) => [product, index % 2 ? [2,2,3,2,3,2,2,2,1,1,1,1] : [4,3,4,4,2,4,3,2,3,2,1,1]]));
        record.fields.statistics = {
          "投诉产品标签": "全部",
          "投诉原因标签": record.fields.entry?.["投诉原因标签"] || "-",
          "统计周期": "整改前：2026-06-30—2026-07-30；整改中：2026-07-31—2026-08-22",
          "统计机构": row[4],
          comparison: { beforeDaily:3.6, duringDaily:1.8, changeRate:-50, groups:[{label:"办理方案告知不充分",beforeDaily:1.8,duringDaily:0.8,changeRate:-55.6},{label:"处理时效过长",beforeDaily:1.2,duringDaily:0.7,changeRate:-41.7},{label:"办理结果存在争议",beforeDaily:0.6,duringDaily:0.3,changeRate:-50}] },
          trend: { labels:["6/30","7/05","7/10","7/15","7/20","7/25","7/30","8/04","8/09","8/14","8/19","8/22"], values:[6,5,7,6,5,6,5,4,4,3,2,2], creationIndex:6, resultIndex:11, productSeries }
        };
      }
      record.updatedAt = systemTimestamp();
    } else snapshotDocumentStage("subprocess", row[0], "processing", values);
    persistWorkflowState();
  }

  function saveSubprocessProcessingDraft() {
    const row = [...subprocessRows, ...rectificationRows].find(item => item[0] === state.subprocessId);
    if (!row) return toast("未找到当前处理单据", true);
    persistSubprocessProcessingDraft(row, false);
    toast((row[1] === "溯源整改" ? "当前整改阶段" : "子流程处理") + "草稿已保存");
  }

  function rejectRectificationPlan() {
    const row = workflowRow("rectification", state.subprocessId);
    if (!row || row[5] !== "方案待提交") return toast("当前状态不允许驳回整改方案", true);
    const record = documentRecordFor("rectification", row);
    const creator = listColumnValueText(record?.fields?.base?.["创建人"] || record?.fields?.entry?.["创建人"] || row[3]);
    const content = '<div class="action-dialog rectification-plan-reject-dialog">' +
      '<label class="action-full-field"><span>驳回至节点</span><div class="action-readonly-status">' + statusTag("问题待提交") + '</div></label>' +
      '<label class="action-full-field"><span>接收人</span><input class="di-input is-fluid" value="' + escapeAttribute(creator) + '" readonly disabled aria-disabled="true"></label>' +
      '<label class="action-full-field required"><span>驳回理由 <em>*</em></span><textarea class="di-textarea" id="rectification-plan-reject-reason" rows="5" placeholder="请输入驳回理由"></textarea></label>' +
      '</div>';
    openModal("驳回整改方案", content, "确认驳回", () => {
      const reasonControl = document.getElementById("rectification-plan-reject-reason");
      const reason = reasonControl?.value.trim() || "";
      if (!reason) return showOverlayValidationError("请填写驳回理由。", reasonControl);
      const transition = workflowTransition("rectification", row[0], "rejectPlan", {
        action:"驳回整改方案",
        opinion:reason,
        receiver:creator,
        assignee:creator,
        result:"驳回"
      });
      if (!transition.ok) return showOverlayValidationError(transition.reason);
      row[8] = transition.to;
      persistWorkflowState();
      closeOverlay();
      toast("整改方案已驳回至问题待提交");
      returnToRectificationList("rectification-process");
    });
  }

  function rejectSubprocessProcessing() {
    const row = workflowRow("subprocess", state.subprocessId);
    if (!canRejectSubprocessProcessing(row)) return toast("当前状态不允许驳回子流程处理", true);
    const applicant = subprocessApplicantName(row);
    const content = '<div class="action-dialog rectification-plan-reject-dialog">' +
      '<label class="action-full-field"><span>驳回至节点</span><div class="action-readonly-status">' + statusTag("待提交") + '</div></label>' +
      '<label class="action-full-field"><span>接收人</span><input class="di-input is-fluid" value="' + escapeAttribute(applicant) + '" readonly></label>' +
      '<label class="action-full-field required"><span>驳回理由 <em>*</em></span><textarea class="di-textarea" id="subprocess-processing-reject-reason" rows="5" placeholder="请输入驳回理由"></textarea></label>' +
      '</div>';
    openModal("驳回" + row[1], content, "确认驳回", () => {
      const reasonControl = document.getElementById("subprocess-processing-reject-reason");
      const reason = reasonControl?.value.trim() || "";
      if (!reason) return showOverlayValidationError("请填写驳回理由。", reasonControl);
      const transition = workflowTransition("subprocess", row[0], "rejectProcessingToDraft", {
        action:"处理人驳回",
        opinion:reason,
        receiver:applicant,
        assignee:applicant,
        result:"驳回"
      });
      if (!transition.ok) return showOverlayValidationError(transition.reason);
      closeOverlay();
      toast(row[1] + "已驳回至申请人待提交");
      state.detailEntry = "view";
      state.subprocessDetailTab = "流转记录";
      rerenderPage();
    });
  }

  function submitSubprocessProcessing() {
    const form = document.getElementById("subprocess-processing-form");
    if (!form) return;
    const missing = [...form.querySelectorAll(".form-label.required")].filter(label => {
      const holder = label.parentElement.querySelector("[data-field-key]");
      if (!holder) return false;
      const key = holder.dataset.fieldKey, value = holder.matches("input,textarea,select") ? holder.value : state.formValues[key];
      return Array.isArray(value) ? !value.length : !String(value || "").trim();
    });
    if (missing.length) { missing[0].parentElement.querySelector("input,textarea,button")?.focus(); return toast("还有 " + missing.length + " 个必填处理字段未完成", true); }
    const row = [...subprocessRows, ...rectificationRows].find(item => item[0] === state.subprocessId);
    const isRectification = row?.[1] === "溯源整改";
    const skipsApproval = !isRectification && SUBPROCESS_NO_APPROVAL_TYPES.has(row?.[1]);
    const nextApprovalStage = !isRectification && !skipsApproval && subprocessNeedsInitialApproval(row) ? "initial" : "approval";
    const rectificationStage = row?.[5] === "方案待提交" ? "整改计划" : "整改结果";
    const nextNode = isRectification ? rectificationStage + "审核" : skipsApproval ? "已办结（无需审批）" : nextApprovalStage === "initial" ? "子流程初审" : "子流程审批";
    const submitHint = isRectification ? "仅提交当前阶段已填写字段；历史阶段保持只读，审核通过后开放下一阶段。" : skipsApproval ? "该子单无需审批，处理结果提交后直接办结并更新关联主工单。" : "处理字段提交后进入后续审批节点，审批结果将写入流转记录。";
    const modalContent = '<div class="action-dialog"><div class="action-dialog-question"><strong>确认提交' + (isRectification ? rectificationStage : "子流程处理结果") + '？</strong><span>' + submitHint + '</span></div><dl class="action-summary-grid"><div><dt>单据编号</dt><dd>' + state.subprocessId + '</dd></div><div><dt>下一节点</dt><dd>' + nextNode + '</dd></div></dl></div>';
    const completeSubmission = (selection = null) => {
      persistSubprocessProcessingDraft(row, true);
      const event = isRectification ? (row[5] === "方案待提交" ? "submitPlan" : "submitResult") : skipsApproval ? "completeProcessing" : nextApprovalStage === "initial" ? "submitProcessingToInitial" : "submitProcessing";
      if (!isRectification && !skipsApproval) setApprovalStage(state.subprocessId, nextApprovalStage);
      const processValues = scopedFormValues("subprocess-processing." + row[1]);
      const processOpinion = processValues["督导反馈"] || processValues["处理意见"] || processValues["调查结论"] || processValues["核查结论"] || processValues["异常认定结果"] || processValues["剔除认定结果"] || (skipsApproval ? "处理完成，无需审批，直接办结。" : "当前阶段字段已填写完成，提交下一审核节点。");
      const transition = workflowTransition(isRectification ? "rectification" : "subprocess", state.subprocessId, event, { action:isRectification ? (event === "submitPlan" ? "提交整改计划" : "提交整改结果") : "提交处理结果", opinion:processOpinion, receiver:selection?.actor || (skipsApproval ? "-" : "下一节点审核人"), assignee:selection?.actor });
      if (!transition.ok) return toast(transition.reason, true);
      if (isRectification) {
        row[8] = transition.to;
        saveRectificationRoutingAssignment(row[0], transition, selection);
        persistWorkflowState();
      }
      if (skipsApproval) {
        const triggeredRecord = Object.values(state.triggeredSubprocesses).flat().find(record => record.id === row[0]);
        if (triggeredRecord) { triggeredRecord.status = transition.to; triggeredRecord.linked = true; triggeredRecord.relationStatus = "无需审批，处理完成并已关联"; }
        const relatedTicket = ticketRowById(row[2]);
        if (row[1] === "撤销投诉" && relatedTicket) { relatedTicket[5] = "已办结"; relatedTicket[6] = systemTimestamp(); }
        persistWorkflowState();
      }
      closeOverlay(); toast(subprocessDefinition(row?.[1]).document + "当前阶段已提交，状态更新为" + transition.to); if (isRectification) returnToRectificationList("rectification-process"); else navigate("subprocess-manage");
    };
    if (isRectification) {
      const ruleKey = row[5] === "方案待提交" ? "planSubmit" : "resultSubmit";
      return openRectificationRoutingDialog({
        row,
        ruleKey,
        title:"提交" + rectificationStage,
        question:"确认提交" + rectificationStage + "？",
        hint:"请选择整改部门的审批人员，提交后由该人员完成当前阶段初审。",
        summary:[["整改单编号", state.subprocessId], ["提交后状态", row[5] === "方案待提交" ? "方案待初审" : "结果待初审"]],
        confirmLabel:"确认提交",
        onConfirm:completeSubmission
      });
    }
    openModal("提交子流程处理结果", modalContent, "确认提交", completeSubmission);
  }

  function aiTagExampleValues(dictionary, preferred, count) {
    const first = hierarchyDemoValue(dictionary, preferred);
    const paths = [];
    const visit = (nodes, prefix = []) => (nodes || []).forEach(node => {
      const path = [...prefix, node.label];
      if (node.children?.length) visit(node.children, path);
      else paths.push(path.join(" / "));
    });
    visit(hierarchyTreeFor(dictionary));
    const parent = first.split(" / ").slice(0, -1).join(" / ");
    const ordered = [first, ...paths.filter(path => path !== first && path.startsWith(parent + " / ")), ...paths.filter(path => path !== first && !path.startsWith(parent + " / "))];
    return [...new Set(ordered.filter(Boolean))].slice(0, count);
  }

  function aiSingleClassificationExamples(values) {
    const categoryAlternative = cascaderDemoValue("business", "B-02 贷款 / B-0201 个人住房贷款 / B-02010 个人住房贷款");
    const reasonAlternative = cascaderDemoValue("reason", "C-01 服务态度及服务质量 / C-0102 业务操作效率");
    const preferred = {
      "业务办理渠道": [values["业务办理渠道"]],
      "业务类别": [values["业务类别"], categoryAlternative],
      "投诉/信访原因": [values["投诉/信访原因"], reasonAlternative],
      "被投诉业务办理渠道": [values["被投诉业务办理渠道"]],
      "被投诉业务类别": [values["被投诉业务类别"]],
      "被投诉业务原因": [values["被投诉业务原因"]]
    };
    return Object.fromEntries(AI_SINGLE_FIELD_NAMES.map(name => [name, [...new Set((preferred[name] || []).filter(Boolean))]]));
  }

  function smartClassify() {
    if (!state.workOrderType) return toast("请先选择工单类型", true);
    if (!AI_CLASSIFICATION_TYPES.has(state.workOrderType)) return toast("当前工单类型仅支持手工填写标签及派发信息", true);
    if (!String(activeCustomerType()).trim()) {
      toast("请先填写：客户类型", true);
      return requestAnimationFrame(() => document.getElementById("section-customer")?.scrollIntoView({ behavior:"smooth", block:"start" }));
    }
    const inputFields = aiInputFields();
    const missing = inputFields.filter(field => !String(state.formValues[field.name] || "").trim());
    if (missing.length) {
      toast("请先填写：" + missing.map(fieldLabel).join("、"), true);
      return requestAnimationFrame(() => document.getElementById("section-content")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }

    const isOrganizationCustomer = isOrganizationCustomerType();
    const outputsByType = {
      "投诉单": {
        "业务办理渠道": isOrganizationCustomer ? "Z-01 前台业务渠道 / Z-0103 电子渠道 / Z-01033 移动客户端" : "A-01 前台业务渠道 / A-0103 电子渠道 / A-01033 移动客户端",
        "业务类别": isOrganizationCustomer ? "Y-02 贷款 / Y-0201 信用贷款" : "B-02 贷款 / B-0205 个人生产经营性贷款",
        "投诉/信访原因": isOrganizationCustomer ? "X-03 金融机构管理制度、业务规则与流程" : "C-03 管理制度、业务规则与流程",
        "被投诉业务办理渠道": "自有电子渠道", "被投诉业务类别": "个人业务 / 个人生产经营性贷款 / 办理问题",
        "被投诉业务原因": "因金融机构管理制度、业务规则与流程引起的投诉",
        "业务办理渠道标签": hierarchyDemoValue("trsBusinessChannel", "第三方合作渠道 / 度小满"), "投诉产品标签": hierarchyDemoValue("rectificationProduct", "贷款 / 个人合作类贷款 / 度小满"),
        "投诉原因标签": hierarchyDemoValue("rectificationCause", "服务类 / 客服服务 / 服务效率"), "投诉诉求标签": hierarchyDemoValue("appealTag", "催收还款类 / 协商还款/个性化分期"),
        "派发机构": "厦门分行 / 厦门分行"
      },
      "信访单": {
        "业务办理渠道标签": hierarchyDemoValue("trsBusinessChannel", "大堂渠道 / 柜面业务"), "投诉产品标签": hierarchyDemoValue("rectificationProduct", "贷款 / 个人非合作类贷款 / 个人经营贷"),
        "投诉原因标签": hierarchyDemoValue("rectificationCause", "服务类 / 网点线下服务 / 对客户经理服务不满意"), "投诉诉求标签": hierarchyDemoValue("appealTag", "查证解释类 / 查明账户异常原因"),
        "派发机构": "福州分行 / 福州分行"
      }
    };
    const groups = aiOutputGroups();
    const visibleOutputNames = new Set(groups.flatMap(group => group.fields.map(field => field.name)));
    const values = outputsByType[state.workOrderType] || {};
    const tagDictionaries = { "业务办理渠道标签":"trsBusinessChannel", "投诉产品标签":"rectificationProduct", "投诉原因标签":"rectificationCause", "投诉诉求标签":"appealTag" };
    const suggestions = Object.fromEntries(AI_TAG_FIELD_NAMES.map(name => [name, aiTagExampleValues(tagDictionaries[name], values[name], name === "投诉产品标签" ? 2 : name === "投诉原因标签" ? 3 : 1)]));
    const singleSuggestions = state.workOrderType === "投诉单" ? aiSingleClassificationExamples(values) : {};
    Object.entries(values).forEach(([key, value]) => {
      if (visibleOutputNames.has(key) && !AI_TAG_FIELD_NAMES.includes(key)) state.formValues[key] = value;
    });
    // 先保留用户已选和后续人工补充的标签，再用模型结果填补剩余位置。
    const tagSources = {};
    const tagProvenance = {};
    AI_TAG_FIELD_NAMES.forEach(name => {
      const stored = state.formValues[name];
      const selected = (Array.isArray(stored) ? stored : (stored ? [stored] : [])).filter(Boolean);
      const previousSources = state.aiTagSources[name] || [];
      // 仅保护有明确人工来源的标签；首次打标前的演示默认值没有来源，不能误判为人工选择。
      const kept = [...new Set(selected.filter((_, index) => previousSources[index] && previousSources[index] !== '模型返回'))].slice(0, 3);
      const merged = [...kept];
      suggestions[name].forEach(value => { if (merged.length < 3 && !merged.includes(value)) merged.push(value); });
      state.formValues[name] = merged;
      tagSources[name] = merged.map((_, index) => index < kept.length ? (previousSources[selected.indexOf(merged[index])] || '用户已选') : '模型返回');
      tagProvenance[name] = tagSources[name].map(source => source === '模型返回');
    });
    if (state.formValues["被投诉业务类别"]) {
      const regulatoryPath = state.formValues["被投诉业务类别"].split(" / ");
      ["被投诉业务类别1", "被投诉业务类别2", "被投诉业务类别3"].forEach((key, index) => { state.formValues[key] = regulatoryPath[index] || "/"; });
    }
    const availableDispatchDepartments = dispatchDepartmentOptions(state.formValues["派发机构"]);
    state.formValues["派发部门"] = availableDispatchDepartments.find(item => item.includes("消费者权益保护部")) || availableDispatchDepartments[0] || "";
    const copyRecipients = ticketDispatchCopyRecipients();
    state.formValues["抄送人"] = [...copyRecipients];
    state.aiTrsTags = JSON.parse(JSON.stringify(TRS_TAG_RESULTS[state.workOrderType] || {}));
    state.aiTagSuggestions = JSON.parse(JSON.stringify(suggestions));
    state.aiTagSlotCounts = Object.fromEntries(AI_TAG_FIELD_NAMES.map(name => [name, state.formValues[name].length]));
    state.aiTagProvenance = tagProvenance;
    state.aiTagSources = tagSources;
    state.aiClassificationSuggestions = JSON.parse(JSON.stringify(singleSuggestions));
    state.aiGeneratedFields = new Set(Object.keys(values).filter(key => visibleOutputNames.has(key)));
    if (state.formValues["派发部门"]) state.aiGeneratedFields.add("派发部门");
    if (copyRecipients.length) state.aiGeneratedFields.add("抄送人");
    state.aiClassificationReady = true;
    rerenderPage();
    toast("AI 智能打标结果已生成，可按重要性手动调整标签");
    requestAnimationFrame(() => document.getElementById("section-intelligent-tags")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function refreshSmartDispatch() {
    if (!state.workOrderType || !AI_CLASSIFICATION_TYPES.has(state.workOrderType)) return toast("当前工单类型不支持智能派发", true);
    const institution = state.workOrderType === "信访单" ? "福州分行 / 福州分行" : "厦门分行 / 厦门分行";
    state.formValues["派发机构"] = institution;
    const departments = dispatchDepartmentOptions(institution);
    state.formValues["派发部门"] = departments.find(item => item.includes("消费者权益保护部")) || departments.find(item => item !== "-") || "-";
    state.formValues["抄送人"] = [...ticketDispatchCopyRecipients()];
    state.aiGeneratedFields.add("派发机构");
    state.aiGeneratedFields.add("派发部门");
    rerenderPage();
    toast("智能派发结果已刷新");
    requestAnimationFrame(() => document.getElementById("section-intelligent-dispatch")?.scrollIntoView({ behavior:"smooth", block:"start" }));
  }

  function resetImportJob() {
    state.importJob = { fileName: "", sourceFile: null, status: "idle", progress: 0, total: 0, parsed: 0, valid: 0, invalid: 0, drafts: 0, targetValid: 0, targetInvalid: 0, oversized: false, blockReason: "", rows: [], fieldErrors: [] };
    state.importOpenDraftsAfterGeneration = false;
  }

  function downloadImportTemplate() {
    const link = document.createElement("a");
    link.href = "批量导入模版.xlsx";
    link.download = "批量导入模版.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast("批量导入模版已开始下载");
  }

  async function readXlsxEntry(buffer, entryName) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    for (let offset = 0; offset < bytes.length - 46; offset += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) continue;
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      if (name !== entryName) { offset += 45 + nameLength + extraLength + commentLength; continue; }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      if (method === 0) return new TextDecoder().decode(compressed);
      if (method !== 8 || typeof DecompressionStream === "undefined") throw new Error("浏览器不支持 XLSX 压缩数据解析");
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new TextDecoder().decode(await new Response(stream).arrayBuffer());
    }
    return "";
  }

  async function validateImportWorkbook(file) {
    if (file.size > 30 * 1024 * 1024) return { rowCount:0, blockReason:"文件大小超过 30 MB，请重新检查附件内容" };
    const buffer = await file.arrayBuffer();
    const signature = new Uint8Array(buffer.slice(0, 4));
    if (signature[0] !== 0x50 || signature[1] !== 0x4b) return { rowCount:0, blockReason:"文件不是有效的 .xlsx 工作簿，请重新下载标准模板" };
    const parseXml = xml => new DOMParser().parseFromString(xml, "application/xml");
    const workbookXml = await readXlsxEntry(buffer, "xl/workbook.xml");
    const relationshipXml = await readXlsxEntry(buffer, "xl/_rels/workbook.xml.rels");
    if (!workbookXml || !relationshipXml) return { rowCount:0, blockReason:"无法识别工作簿结构，请使用统一标准模板" };
    const workbook = parseXml(workbookXml);
    const relationships = parseXml(relationshipXml);
    const firstSheet = workbook.querySelector("sheet");
    const relationshipId = firstSheet?.getAttribute("r:id") || firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const relationship = [...relationships.querySelectorAll("Relationship")].find(item => item.getAttribute("Id") === relationshipId);
    const target = relationship?.getAttribute("Target") || "";
    const worksheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const worksheetXml = worksheetPath ? await readXlsxEntry(buffer, worksheetPath) : "";
    if (!worksheetXml) return { rowCount:0, blockReason:"无法识别工作表，请使用统一标准模板" };

    const sharedStringsXml = await readXlsxEntry(buffer, "xl/sharedStrings.xml");
    const sharedStrings = sharedStringsXml
      ? [...parseXml(sharedStringsXml).querySelectorAll("si")].map(item => item.textContent || "")
      : [];
    const worksheet = parseXml(worksheetXml);
    const columnIndex = reference => {
      const letters = (reference.match(/[A-Z]+/i) || [""])[0].toUpperCase();
      return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
    };
    const rows = [...worksheet.querySelectorAll("sheetData > row")].map(row => {
      const values = new Map();
      row.querySelectorAll("c").forEach(cell => {
        const type = cell.getAttribute("t");
        const raw = cell.querySelector("v")?.textContent || "";
        const value = type === "s" ? (sharedStrings[Number(raw)] || "") : type === "inlineStr" ? (cell.querySelector("is")?.textContent || "") : raw;
        if (value.trim()) values.set(columnIndex(cell.getAttribute("r") || ""), value.trim());
      });
      return { number:Number(row.getAttribute("r") || 0), values };
    });
    const requiredHeaders = ["客户编号", "客户类型", "卡号/账号", "证件号码", "预留手机号码", "受理渠道", "具体来源", "投诉时间", "转送时间", "接收时间", "是否发送短信", "转送函号", "联系人姓名", "联系人证件号码", "联系方式1", "联系方式2", "投诉机构", "投诉对象", "投诉事项", "所属业务条线", "投诉内容"];
    const headerCandidate = rows.reduce((best, row) => {
      const values = [...row.values.values()];
      const matches = requiredHeaders.filter(header => values.includes(header)).length;
      return matches > best.matches ? { row, matches } : best;
    }, { row:null, matches:0 });
    const headerValues = headerCandidate.row ? [...headerCandidate.row.values.values()] : [];
    const duplicateHeader = headerValues.find((header, index) => headerValues.indexOf(header) !== index);
    if (duplicateHeader) return { rowCount:0, blockReason:`模板表头无法识别，存在重复列“${duplicateHeader}”` };
    const missingHeader = requiredHeaders.find(header => !headerValues.includes(header));
    if (missingHeader) return { rowCount:0, blockReason:`模板表头无法识别，缺少“${missingHeader}”字段` };
    const unknownHeader = headerValues.find(header => !requiredHeaders.includes(header));
    if (unknownHeader) return { rowCount:0, blockReason:`模板表头无法识别，列名“${unknownHeader}”不正确` };
    const businessColumns = new Set([...headerCandidate.row.values.entries()].filter(([, value]) => requiredHeaders.includes(value)).map(([index]) => index));
    const headerByColumn = new Map([...headerCandidate.row.values.entries()].map(([index, value]) => [index, value]));
    const requiredValues = new Set(["客户类型", "受理渠道", "投诉时间", "接收时间", "联系人姓名", "联系方式1", "投诉机构", "投诉对象", "投诉事项", "所属业务条线", "投诉内容"]);
    const dataRows = rows.filter(row => row.number > headerCandidate.row.number && [...row.values.entries()].some(([index, value]) => businessColumns.has(index) && value)).map(row => {
      const values = Object.fromEntries(requiredHeaders.map(header => [header, ""]));
      row.values.forEach((value, index) => { const header = headerByColumn.get(index); if (header) values[header] = value; });
      const errors = [];
      const invalidate = (field, message) => { errors.push({ rowNumber:row.number, field, message }); values[field] = ""; };
      requiredValues.forEach(field => { if (!String(values[field] || "").trim()) errors.push({ rowNumber:row.number, field, message:`${field}不能为空` }); });
      ["预留手机号码", "联系方式1", "联系方式2"].forEach(field => {
        const phone = String(values[field] || "").replace(/\s+/g, "");
        if (phone && !/^(?:1[3-9]\d{9}|0\d{2,3}-?\d{7,8})$/.test(phone)) invalidate(field, "手机号格式不正确");
      });
      if (values["客户类型"] && !["自然人", "非自然人"].includes(values["客户类型"])) invalidate("客户类型", "客户类型不在可选范围内");
      if (values["是否发送短信"] && !["是", "否"].includes(values["是否发送短信"])) invalidate("是否发送短信", "是否发送短信仅支持是/否");
      return { rowNumber:row.number, values, errors };
    });
    return { rowCount:dataRows.length, rows:dataRows, fieldErrors:dataRows.flatMap(row => row.errors), blockReason:"" };
  }

  function setImportFile(file) {
    const name = typeof file === "string" ? file : file?.name || "";
    if (!/\.xlsx$/i.test(name)) {
      return openModal("文件格式不正确", '<div class="action-dialog"><div class="action-dialog-question"><strong>仅支持 .xlsx 标准模板</strong><span>不支持 .xls、.xlsm、.csv 或仅修改扩展名的文件，请使用系统模板重新填写。</span></div></div>', "重新上传", () => openImportDrawer());
    }
    const oversized = typeof file !== "string" && file.size > 30 * 1024 * 1024;
    Object.assign(state.importJob, {
      fileName: name,
      sourceFile: typeof file === "string" ? null : file,
      status: "uploaded",
      total: 0,
      targetValid: 0,
      targetInvalid: 0,
      oversized,
      blockReason: oversized ? "文件大小超过 30 MB，请重新检查附件内容" : ""
    });
    const drop = document.getElementById("upload-drop");
    if (!drop) return;
    drop.classList.add("has-file");
    drop.querySelector("strong").textContent = name;
    const uploadNote = drop.querySelector(".upload-limit-note");
    if (uploadNote) uploadNote.textContent = "文件已上传，请点击“校验并上传”";
    const row = document.getElementById("import-file-row");
    if (row) {
      row.hidden = false;
      row.querySelector("b").textContent = name;
      row.querySelector("em").textContent = "等待校验";
    }
    const parseButton = document.getElementById("parse-import");
    parseButton.disabled = false;
    parseButton.textContent = "校验并上传";
  }

  async function startImportValidation() {
    const job = state.importJob;
    if (!job.sourceFile) return toast("请先上传导入文件", true);
    const button = document.getElementById("parse-import");
    button.disabled = true;
    button.textContent = "正在校验";
    try {
      const result = await validateImportWorkbook(job.sourceFile);
      job.blockReason = result.blockReason;
      job.oversized = /超过 30 MB/.test(result.blockReason);
      job.total = result.rowCount;
      job.rows = result.rows || [];
      job.fieldErrors = result.fieldErrors || [];
      job.targetInvalid = new Set(job.fieldErrors.map(error => error.rowNumber)).size;
      job.targetValid = Math.max(0, job.total - job.targetInvalid);
      runImportProgress("parse");
    } catch (error) {
      job.blockReason = error?.message || "文件解析失败，请重新上传标准模板";
      button.disabled = false;
      button.textContent = "重新校验";
      toast(job.blockReason, true);
    }
  }

  function openImportDrawer() {
    resetImportJob();
    showOverlay('<div class="drawer-mask" data-close-overlay></div><aside class="drawer import-drawer"><div class="drawer-head">批量导入工单<button class="icon-btn" data-close-overlay>' + icon("close") + '</button></div><div class="drawer-body"><section class="import-section import-template-section"><div class="import-section-head"><div></div><button class="btn xib-btn xib-btn--secondary" data-download-template>下载标准模板</button></div></section><section class="import-section import-upload-section"><label class="upload-drop" id="upload-drop"><input type="file" accept=".xlsx" hidden><div><img src="ui/assets/upload.svg" alt=""><strong>将文件拖到此处，或点击上传</strong><small class="upload-limit-note">仅支持 .xlsx 文件，文件大小不超过 30 MB</small></div></label></section></div><div class="drawer-foot"><button class="btn xib-btn xib-btn--secondary" data-close-overlay>取消</button><button class="btn xib-btn xib-btn--primary btn-primary" id="parse-import" disabled>校验并上传</button></div></aside>');
    const input = document.querySelector("#upload-drop input");
    const drop = document.getElementById("upload-drop");
    input.addEventListener("change", () => { if (input.files.length) setImportFile(input.files[0]); });
    ["dragenter", "dragover"].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add("is-dragging"); }));
    drop.addEventListener("dragleave", () => drop.classList.remove("is-dragging"));
    drop.addEventListener("drop", event => { event.preventDefault(); drop.classList.remove("is-dragging"); if (event.dataTransfer.files[0]) setImportFile(event.dataTransfer.files[0]); });
    document.querySelector("[data-download-template]").addEventListener("click", downloadImportTemplate);
    document.getElementById("parse-import").addEventListener("click", startImportValidation);
    document.getElementById("remove-import-file")?.addEventListener("click", () => openImportDrawer());
  }

  function importProgressMarkup(stage) {
    const parsing = stage === "parse";
    return '<div class="modal-mask"></div><div class="modal is-wide import-progress-modal"><div class="modal-body"><div class="import-progress-file"><img src="ui/assets/excel.svg" alt=""><span><strong>' + state.importJob.fileName + '</strong></span><em class="import-validation-status">' + (parsing ? "校验中" : "生成草稿中") + '</em></div><div id="import-result-panel"></div></div><div class="modal-foot import-progress-actions"><button class="btn xib-btn xib-btn--secondary" id="import-progress-cancel" disabled>处理中</button><button class="btn xib-btn xib-btn--primary btn-primary" id="import-progress-next" disabled>' + (parsing ? "生成可编辑草稿" : "查看录入导入草稿箱") + '</button></div></div>';
  }

  function updateImportProgress(stage) {
    const job = state.importJob;
    const progress = job.progress;
    const current = stage === "parse" ? job.parsed : job.drafts;
    if (document.getElementById("import-progress-bar")) document.getElementById("import-progress-bar").style.width = progress + "%";
    if (document.getElementById("import-progress-percent")) document.getElementById("import-progress-percent").textContent = progress + "%";
    if (document.getElementById("import-progress-message")) document.getElementById("import-progress-message").textContent = stage === "parse" ? "正在检查模板结构并统计有效数据行" : "正在生成可编辑草稿";
    if (document.getElementById("import-current")) document.getElementById("import-current").textContent = current;
    if (document.getElementById("import-valid")) document.getElementById("import-valid").textContent = job.valid;
    if (document.getElementById("import-invalid")) document.getElementById("import-invalid").textContent = job.invalid;
  }

  function renderImportProgress(stage) {
    const drawer = document.querySelector(".import-drawer");
    if (!drawer) return showOverlay(importProgressMarkup(stage));
    const template = document.createElement("template");
    template.innerHTML = importProgressMarkup(stage);
    const progress = template.content.querySelector(".import-progress-modal");
    progress.classList.remove("modal", "is-wide");
    progress.classList.add("import-inline-progress");
    drawer.querySelector(".drawer-body").replaceChildren(progress);
    drawer.querySelector(".drawer-foot")?.remove();
  }

  function importFieldKey(header) {
    const keys = {
      "客户编号":"customer.1.客户编号", "客户类型":"customer.1.客户类型", "卡号/账号":"customer.1.卡号/账号",
      "证件号码":"customer.1.证件号码", "预留手机号码":"customer.1.预留手机号码", "投诉时间":"客户事件时间",
      "联系方式1":"联系方式", "投诉机构":"投诉/信访/表扬机构", "投诉对象":"投诉/信访对象",
      "投诉事项":"投诉/信访事项", "投诉内容":"反馈内容"
    };
    return keys[header] || header;
  }

  function importDraftValues(values) {
    const output = { "投诉人数":"1", "customer.1.是否有客户编号":values["客户编号"] ? "是" : "否" };
    Object.entries(values).forEach(([header, value]) => { output[importFieldKey(header)] = value; });
    output["customer.1.客户姓名"] = values["联系人姓名"] || "";
    output["所属业务条线"] = values["所属业务条线"] ? { primary:values["所属业务条线"], optional:"" } : { primary:"", optional:"" };
    return output;
  }

  function createImportedDrafts(job) {
    const draftOrg = state.role === "developer" ? "厦门分行" : currentRoleProfile().orgLabel;
    let serial = manualDraftRows.length + 1;
    job.rows.forEach((importRow, index) => {
      const prefix = "DR" + systemTimestamp().replace(/\D/g, "").slice(0, 8);
      let id = prefix + String(serial + index).padStart(4, "0");
      while (manualDraftRows.some(item => item[0] === id)) { serial += 1; id = prefix + String(serial + index).padStart(4, "0"); }
      const values = importDraftValues(importRow.values);
      const fieldErrors = Object.fromEntries(importRow.errors.map(error => [importFieldKey(error.field), error.message]));
      state.importDraftDataById[id] = { type:"投诉单", values, fieldErrors, sourceRow:importRow.rowNumber };
      const row = [id, "投诉单", importRow.values["联系人姓名"] || "待补充客户", importRow.values["投诉事项"] || "待补充事项", importRow.values["投诉机构"] || draftOrg, "草稿", systemTimestamp().slice(0, 16)];
      const existing = manualDraftRows.findIndex(item => item[0] === id);
      if (existing >= 0) manualDraftRows.splice(existing, 1, row); else manualDraftRows.unshift(row);
    });
    persistWorkflowState();
  }

  function importErrorSummary(errors) {
    if (!errors.length) return "";
    const rows = errors.slice(0, 8).map(error => '<li><b>第 ' + error.rowNumber + ' 行 · ' + escapeAttribute(error.field) + '</b><span>' + escapeAttribute(error.message) + '</span></li>').join("");
    const remainder = errors.length > 8 ? '<small>另有 ' + (errors.length - 8) + ' 项，进入草稿后可逐项查看。</small>' : "";
    return '<div class="import-field-error-summary"><strong>' + new Set(errors.map(error => error.rowNumber)).size + ' 条待补充</strong><ul>' + rows + '</ul>' + remainder + '</div>';
  }

  function finishImportProgress(stage) {
    const job = state.importJob;
    const next = document.getElementById("import-progress-next");
    const cancel = document.getElementById("import-progress-cancel");
    const label = document.querySelector(".import-running-label");
    cancel.disabled = false;
    cancel.textContent = "关闭";
    cancel.addEventListener("click", closeOverlay);
    const validationStatus = document.querySelector(".import-validation-status");
    if (validationStatus) validationStatus.textContent = stage === "parse" && (job.oversized || job.blockReason) ? "校验失败" : stage === "parse" ? "校验完成" : "草稿已生成";
    if (label) label.classList.add("is-complete");
    if (stage === "parse" && (job.oversized || job.blockReason)) {
      if (label) {
        label.textContent = "已阻断";
        label.classList.add("is-blocked");
      }
      document.getElementById("import-result-panel").innerHTML = '<div class="import-result-summary is-error"><strong>本次导入已阻断</strong><span>' + escapeAttribute(job.blockReason) + '</span></div>';
      next.disabled = false;
      next.textContent = "重新提交";
      next.addEventListener("click", () => { closeOverlay(); openImportDrawer(); });
      return;
    }
    next.disabled = false;
    if (label) label.textContent = "已完成";
    if (stage === "parse") {
      job.status = "parsed";
      document.getElementById("import-result-panel").innerHTML = '<div class="import-result-summary"><span>成功解析' + job.parsed + '条</span></div>' + importErrorSummary(job.fieldErrors);
      next.addEventListener("click", () => { state.importOpenDraftsAfterGeneration = true; runImportProgress("import"); });
    } else {
      job.status = "completed";
      const exists = importRows.some(row => row[0] === job.fileName);
      if (!exists) importRows.unshift([job.fileName, "2026-07-22 11:20:00", "草稿生成成功"]);
      createImportedDrafts(job);
      if (state.importOpenDraftsAfterGeneration) {
        state.importOpenDraftsAfterGeneration = false;
        closeOverlay();
        state.createTab = "录入导入草稿箱";
        rerenderPage();
        toast("草稿数据已保存，请由创建人编辑后提交并转派");
        return;
      }
      document.getElementById("import-result-panel").innerHTML = '<div class="import-result-summary is-success"><strong>草稿生成完成</strong><span>成功生成 ' + job.drafts + ' 条可编辑草稿。正式提交前不生成工单编号，请由创建人逐条编辑后提交并转派。</span></div>';
      next.addEventListener("click", () => { closeOverlay(); state.createTab = "录入导入草稿箱"; rerenderPage(); toast("草稿数据已保存，请由创建人编辑后提交并转派"); });
    }
  }

  function runImportProgress(stage) {
    if (!state.importJob.fileName) return toast("请先上传导入文件", true);
    if (window.__importProgressTimer) clearInterval(window.__importProgressTimer);
    state.importJob.status = stage === "parse" ? "parsing" : "importing";
    state.importJob.progress = 0;
    if (stage === "parse") Object.assign(state.importJob, { parsed: 0, valid: 0, invalid: 0 });
    else state.importJob.drafts = 0;
    renderImportProgress(stage);
    window.__importProgressTimer = setInterval(() => {
      const job = state.importJob;
      job.progress = Math.min(100, job.progress + 8);
      if (stage === "parse") {
        job.parsed = Math.min(job.total, Math.round(job.total * job.progress / 100));
        job.invalid = job.oversized ? 0 : Math.min(job.targetInvalid, Math.floor(job.parsed * job.targetInvalid / Math.max(1, job.total)));
        if (job.progress === 100 && !job.oversized) job.invalid = job.targetInvalid;
        job.valid = Math.max(0, job.parsed - job.invalid);
      } else {
        job.valid = job.targetValid;
        job.invalid = job.targetInvalid;
        job.drafts = Math.min(job.total, Math.round(job.total * job.progress / 100));
      }
      updateImportProgress(stage);
      if (job.progress >= 100) {
        clearInterval(window.__importProgressTimer);
        window.__importProgressTimer = null;
        finishImportProgress(stage);
      }
    }, 120);
  }

  function openImportErrorDetails() {
    const sampleRows = state.importJob.total === 4
      ? '<tr><td>5</td><td>待补充客户</td><td>证件号码为空</td><td>草稿可生成；正式提交时阻断，请补充后提交</td></tr>'
      : '<tr><td>17</td><td>张女士</td><td>客户证件号码格式待确认</td><td>草稿可生成；正式提交前修正</td></tr><tr><td>36</td><td>王先生</td><td>受理渠道未匹配字典</td><td>草稿可生成；从标准字典重新选择</td></tr>';
    openModal("待补充数据明细", '<div class="import-validation-note">轻量解析不会因业务字段缺失而阻断；正式提交时将执行完整校验并定位到行与字段。</div><div class="table-wrap"><table class="table ds-table"><thead><tr><th>行号</th><th>客户姓名</th><th>待补充项</th><th>处理规则</th></tr></thead><tbody>' + sampleRows + '</tbody></table></div>', "返回解析结果", () => { showOverlay(importProgressMarkup("parse")); updateImportProgress("parse"); finishImportProgress("parse"); });
  }
  function openApprovalDrawer(id) {
    showOverlay(`<div class="drawer-mask" data-close-overlay></div><aside class="drawer"><div class="drawer-head">审批处理 · ${id}<button class="icon-btn" data-close-overlay>${icon("close")}</button></div><div class="drawer-body"><div class="panel"><div class="panel-head"><span class="panel-title">审批摘要</span></div><div class="panel-body" style="line-height:2"><b style="color:var(--title)">业务类型：</b>投诉单 / 子流程申请<br><b style="color:var(--title)">发起机构：</b>厦门分行<br><b style="color:var(--title)">当前节点：</b>分行初审<br><b style="color:var(--title)">风险提示：</b><span style="color:var(--warning)"> 客户存在 2 笔历史工单</span></div></div><div style="margin-top:18px"><label class="filter-label">审批意见</label><textarea class="textarea di-textarea" id="approval-opinion" placeholder="请输入审批意见"></textarea></div></div><div class="drawer-foot"><button class="btn xib-btn btn-danger" id="reject-btn">驳回</button><button class="btn xib-btn xib-btn--primary btn-primary" id="approve-btn">通过</button></div></aside>`);
    document.getElementById("approve-btn").addEventListener("click", () => { closeOverlay(); toast(`${id} 已审批通过`); });
    document.getElementById("reject-btn").addEventListener("click", () => { const op = document.getElementById("approval-opinion"); if (!op.value.trim()) { op.focus(); toast("驳回时必须填写审批意见", true); return; } closeOverlay(); toast(`${id} 已驳回`); });
  }

  function openModal(title, content, confirmText, onConfirm, options = {}) {
    const size = "wide";
    const footerPrompt = options.footerPrompt ? '<span class="modal-footer-prompt">' + escapeAttribute(options.footerPrompt) + '</span>' : '';
    const cancelButton = options.hideCancel ? "" : '<button class="btn xib-btn xib-btn--secondary" data-close-overlay>取消</button>';
    showOverlay(`<div class="modal-mask" data-close-overlay></div><div class="modal ${size === "wide" ? "is-wide" : ""}" data-modal-size="${size}"><div class="modal-head">${title}<button class="icon-btn" data-close-overlay>${icon("close")}</button></div><div class="modal-body">${content}</div><div class="modal-foot${footerPrompt ? ' is-ai-tag-confirm' : ''}">${footerPrompt}${cancelButton}<button class="btn xib-btn xib-btn--primary btn-primary" id="modal-confirm">${confirmText}</button></div></div>`);
    document.getElementById("modal-confirm").addEventListener("click", onConfirm || closeOverlay);
    bindOverlayFormControls(document.querySelector("#overlay-root .modal-body"));
  }

  function showOverlay(html) {
    const overlayRoot = document.getElementById("overlay-root");
    overlayRoot.innerHTML = html;
    overlayRoot.querySelectorAll(".modal").forEach(modal => {
      modal.classList.add("is-wide");
      modal.dataset.modalSize = "wide";
    });
    applyTableEmptyStates(overlayRoot);
    document.querySelectorAll("[data-close-overlay]").forEach(node => node.addEventListener("click", closeOverlay));
    document.addEventListener("keydown", escapeOverlay);
  }
  function closeOverlay() { document.getElementById("overlay-root").innerHTML = ""; document.removeEventListener("keydown", escapeOverlay); }
  function escapeOverlay(e) { if (e.key === "Escape") closeOverlay(); }

  // 统一字数计数：带字数限制的文本描述输入框，实时在输入框右下角显示"已输入/上限"。
  document.addEventListener("input", event => {
    const target = event.target;
    if (!target || target.tagName !== "TEXTAREA") return;
    const wrapper = target.parentElement;
    if (!wrapper || !wrapper.classList.contains("textarea-with-count")) return;
    const counter = wrapper.querySelector(":scope > .textarea-count");
    if (!counter) return;
    const max = target.getAttribute("maxlength");
    counter.textContent = target.value.length + (max ? "/" + max : "");
  });

  function toast(message, error) {
    const node = document.createElement("div");
    node.className = `toast ${error ? "error" : ""}`;
    const iconNode = document.createElement("span");
    iconNode.className = "toast-icon";
    iconNode.textContent = error ? "!" : "✓";
    const messageNode = document.createElement("span");
    messageNode.className = "toast-message";
    messageNode.textContent = message;
    node.append(iconNode, messageNode);
    document.getElementById("toast-root").appendChild(node);
    setTimeout(() => node.remove(), 2600);
  }

  function currentPageMeta() {
    if (state.role === "reviewer" && state.page === "ticket-process") return { title: "客服工单复核", group: "投诉管理", groupId: "complaint", subgroup: "工单管理", subgroupId: "ticket" };
    return PAGE_META[state.page] || PAGE_META.overview;
  }

  function updateShellForPage() {
    const meta = currentPageMeta();
    state.openGroups.add(meta.groupId);
    if (meta.subgroupId) state.openSubgroups.add(meta.subgroupId);
    document.querySelectorAll("[data-page]").forEach(button => button.classList.toggle("is-active", button.dataset.page === state.page));
    document.querySelectorAll(".nav-group").forEach(node => node.classList.toggle("has-active-child", node.dataset.group === meta.groupId && meta.groupId !== state.page));
    document.querySelectorAll(".nav-subgroup").forEach(node => node.classList.toggle("has-active-child", node.dataset.subgroup === meta.subgroupId));
    const group = document.querySelector('[data-group="' + meta.groupId + '"]');
    if (group && !group.classList.contains("is-direct")) {
      group.classList.add("is-open");
      const parent = group.querySelector(":scope > [data-group-toggle]");
      parent?.classList.add("is-open");
      parent?.setAttribute("aria-expanded", "true");
      const caret = parent?.querySelector(".chevron img");
      if (caret) caret.src = "ui/assets/caret-top.svg";
    }
    if (meta.subgroupId) {
      const subgroup = document.querySelector('[data-subgroup="' + meta.subgroupId + '"]');
      if (subgroup) {
        subgroup.classList.add("is-open", "has-active-child");
        const parent = subgroup.querySelector(":scope > [data-subgroup-toggle]");
        parent?.classList.add("is-open");
        parent?.setAttribute("aria-expanded", "true");
        const caret = parent?.querySelector(".chevron img");
        if (caret) caret.src = "ui/assets/caret-top.svg";
      }
    }
    const breadcrumb = document.querySelector(".breadcrumb");
    if (breadcrumb) breadcrumb.innerHTML = breadcrumbHtml(meta);
  }
  function navigate(page, options = {}) {
    page = normalizeRoute(page);
    if (!allowed(page)) return toast("当前角色无此页面权限", true);
    if (["notice-complaint","notice-review"].includes(page) && !options.preserveNotificationMessage) {
      state.notificationMessageId = "";
      state.notificationListRequested = true;
    }
    if (!options.skipHistory) rememberNavigationOrigin(page);
    if (page === "analysis-inspections" && !options.preservePageState) window.XIBComplaintInspections?.resetViewState();
    state.page = page;
    state.menuOpen = false;
    location.hash = page;
    updateShellForPage();
    rerenderPage(true);
  }


  function rerenderPage(resetScroll = false, options = {}) {
    const root = document.getElementById("page-root");
    if (!root) return;
    const statisticsRoute = STATISTICS_MODULE_ROUTES[state.page];
    const statisticsHost = root.querySelector(".statistics-module-host");
    if (statisticsRoute && statisticsHost) {
      statisticsHost.dataset.statisticsRoute = statisticsRoute;
      window.XIBStatisticsModule?.update({ route: statisticsRoute });
      if (resetScroll) window.scrollTo({ top: 0, behavior: "auto" });
      root.classList.remove("is-fading");
      return;
    }
    const renderNow = () => {
      if (root.querySelector(".statistics-module-host")) window.XIBStatisticsModule?.unmount();
      root.innerHTML = renderPage(state.page);
      const nextStatisticsRoute = STATISTICS_MODULE_ROUTES[state.page];
      if (nextStatisticsRoute) mountStatisticsModule(root, nextStatisticsRoute);
      bindPageEvents();
      applyTableEmptyStates(root);
      refreshDispositionCountdowns();
      if (resetScroll) window.scrollTo({ top: 0, behavior: "auto" });
      requestAnimationFrame(() => root.classList.remove("is-fading"));
    };
    clearTimeout(window.__pageFadeTimer);
    if (options.instant) {
      root.classList.remove("is-fading");
      renderNow();
      return;
    }
    root.classList.add("is-fading");
    window.__pageFadeTimer = setTimeout(renderNow, 100);
  }

  window.addEventListener("hashchange", () => {
    const page = normalizeRoute(location.hash.replace(/^#\/?/, "") || "home-tasks");
    if (page !== state.page && allowed(page)) { state.page = page; updateShellForPage(); rerenderPage(true); }
  });
  renderShell();
  window.setInterval(refreshDispositionCountdowns, 60000);
})();

