(function (global) {
    "use strict";
    let statisticsRootElement = null;
    let statisticsReactRoot = null;
    let statisticsObserver = null;
    let statisticsHost = null;
    let statisticsOptions = {};
    let statisticsOfficialCloser = null;
    let statisticsOfficialCloserRoot = null;

    function getStatisticsRoot() {
      return statisticsRootElement;
    }

    function getStatisticsPortalRoot() {
      return statisticsHost?.shadowRoot?.getElementById('statistics-portal-root') || statisticsRootElement;
    }

const { useMemo, useState } = React;

    // 原型数据：仅用于展示三种管理视角下的指标变化。
    const VIEW_DATA = {
      headOffice: {
        key: 'headOffice',
        label: '总行视角',
        shortLabel: '总行',
        organization: '全行',
        scope: '全行 12 家分行及全部下辖机构',
        clientCount: '36,503,000',
        outletCount: '668',
        scopeNote: '覆盖全行有效投诉、有效客户和营业网点',
        focus: '判断全行投诉形势，公平比较各分行，确定重点关注机构。',
        abnormalTitle: '异常分行明细',
        abnormalRule: '每万客户投诉高于目标值 3.00，且有效客户数达到最低统计要求',
        abnormalRows: [
          { name: '上海分行', complaints: '420', clients: '280,000', rate: '15.00', deviation: '+12.00', status: '红色预警' },
          { name: '福州分行', complaints: '286', clients: '260,000', rate: '11.00', deviation: '+8.00', status: '红色预警' },
          { name: '北京分行', complaints: '528', clients: '660,000', rate: '8.00', deviation: '+5.00', status: '橙色预警' },
          { name: '泉州分行', complaints: '198', clients: '300,000', rate: '6.60', deviation: '+3.60', status: '橙色预警' },
          { name: '宁德分行', complaints: '315', clients: '500,000', rate: '6.30', deviation: '+3.30', status: '橙色预警' },
          { name: '厦门分行', complaints: '836', clients: '2,000,000', rate: '4.18', deviation: '+1.18', status: '黄色关注' }
        ],
        outletAbnormalTitle: '全行异常网点明细',
        outletAbnormalRule: '单个营业网点有效投诉量高于目标值 15.0 件；停业、筹建等非正常营业网点不纳入',
        outletAbnormalRows: [
          { name: '上海浦东营业部', parent: '上海分行', complaints: '35', deviation: '+20.0', status: '红色预警' },
          { name: '福州鼓楼支行', parent: '福州分行', complaints: '31', deviation: '+16.0', status: '红色预警' },
          { name: '厦门莲前网点', parent: '厦门分行', complaints: '28', deviation: '+13.0', status: '橙色预警' },
          { name: '北京中关村支行', parent: '北京分行', complaints: '26', deviation: '+11.0', status: '橙色预警' },
          { name: '杭州蕉城支行', parent: '宁德分行', complaints: '22', deviation: '+7.0', status: '黄色关注' }
        ],
        metrics: {
          total: { value: '12,486', unit: '件', sub: '全行有效投诉工单' },
          perClient: {
            value: '3.42',
            unit: '件/万客户',
            sub: '按全行有效客户标准化',
            insights: [
              { label: '环比', value: '↑ 22.1%', tone: 'warning' },
              { label: '目标值', value: '3.00', tone: 'normal' },
              { label: '异常分行', value: '6 家', tone: 'danger', action: 'abnormal' }
            ],
            conclusion: '高于目标值 0.42，6 家分行超过预警线'
          },
          perOutlet: {
            value: '18.7',
            unit: '件/网点',
            sub: '按全行营业网点标准化',
            insights: [
              { label: '环比', value: '↑ 12.4%', tone: 'warning' },
              { label: '目标值', value: '15.0', tone: 'normal' },
              { label: '异常网点', value: '5 个', tone: 'danger', action: 'abnormal' }
            ],
            conclusion: '全行网点均值高于目标 3.7，5 个网点超过预警线'
          },
          repeat: {
            value: '286', unit: '件', sub: '“是否再次投诉＝是”的有效投诉',
            insights: [
              { label: '环比', value: '↑ 8.3%', tone: 'warning' },
              { label: '重复投诉率', value: '2.29%', tone: 'normal' },
              { label: '高频问题', value: '12 项', tone: 'danger' }
            ],
            conclusion: '重复投诉持续上升，12 项问题存在反复发生风险'
          },
          specialRisk: {
            value: '64', unit: '件', sub: '异常或黑灰产标记投诉（去重）',
            insights: [
              { label: '异常投诉', value: '41 件', tone: 'warning' },
              { label: '黑灰产投诉', value: '23 件', tone: 'danger' },
              { label: '待核验', value: '8 件', tone: 'normal' }
            ],
            conclusion: '需优先核验 8 件待确认投诉并评估特殊处置压力'
          }
        },
        values: {
          total: '判断全行整体投诉压力，为资源配置和重点机构管理提供依据。',
          perClient: '全行投诉密度环比上升且超过目标值，需重点核查 6 家异常分行。',
          perOutlet: '全行网点平均投诉压力上升，需直接核查 5 个异常营业网点。',
          repeat: '识别反复发生的问题，判断前期整改是否真正解决客户诉求。',
          specialRisk: '识别异常投诉及黑灰产风险，辅助制定差异化核验和处置策略。'
        }
      },
      branch: {
        key: 'branch',
        label: '分行视角',
        shortLabel: '分行',
        organization: '厦门分行',
        scope: '厦门分行及下辖 12 家支行、37 个营业网点',
        clientCount: '2,000,000',
        outletCount: '37',
        scopeNote: '仅统计本分行及全部下辖机构数据',
        focus: '判断本分行投诉压力，比较下辖支行，定位客户规模之外的投诉问题。',
        abnormalTitle: '异常支行明细',
        abnormalRule: '每万客户投诉高于目标值 3.50，且有效客户数达到最低统计要求',
        abnormalRows: [
          { name: '思明支行', complaints: '96', clients: '187,500', rate: '5.12', deviation: '+1.62', status: '橙色预警' },
          { name: '湖里支行', complaints: '82', clients: '180,000', rate: '4.56', deviation: '+1.06', status: '黄色关注' },
          { name: '集美支行', complaints: '71', clients: '165,000', rate: '4.30', deviation: '+0.80', status: '黄色关注' }
        ],
        outletAbnormalTitle: '厦门分行异常网点明细',
        outletAbnormalRule: '厦门分行辖内单个营业网点有效投诉量高于目标值 18.0 件',
        outletAbnormalRows: [
          { name: '莲前网点', parent: '思明支行', complaints: '28', deviation: '+10.0', status: '红色预警' },
          { name: '会展网点', parent: '思明支行', complaints: '24', deviation: '+6.0', status: '橙色预警' },
          { name: '湖里营业部', parent: '湖里支行', complaints: '23', deviation: '+5.0', status: '橙色预警' },
          { name: '集美新城网点', parent: '集美支行', complaints: '21', deviation: '+3.0', status: '黄色关注' }
        ],
        metrics: {
          total: { value: '836', unit: '件', sub: '本分行及下辖有效投诉' },
          perClient: {
            value: '4.18',
            unit: '件/万客户',
            sub: '按本分行有效客户标准化',
            insights: [
              { label: '环比', value: '↑ 9.7%', tone: 'warning' },
              { label: '目标值', value: '3.50', tone: 'normal' },
              { label: '异常支行', value: '3 家', tone: 'danger', action: 'abnormal' }
            ],
            conclusion: '高于目标值 0.68，3 家支行超过预警线'
          },
          perOutlet: {
            value: '22.6',
            unit: '件/网点',
            sub: '按本分行营业网点标准化',
            insights: [
              { label: '环比', value: '↑ 8.1%', tone: 'warning' },
              { label: '目标值', value: '18.0', tone: 'normal' },
              { label: '异常网点', value: '4 个', tone: 'danger', action: 'abnormal' }
            ],
            conclusion: '辖内网点均值高于目标 4.6，4 个网点超过预警线'
          },
          repeat: {
            value: '32', unit: '件', sub: '本分行再次投诉有效工单',
            insights: [
              { label: '环比', value: '↑ 6.7%', tone: 'warning' },
              { label: '重复投诉率', value: '3.83%', tone: 'normal' },
              { label: '高频问题', value: '4 项', tone: 'danger' }
            ],
            conclusion: '重复投诉率高于全行水平，4 项问题需推动专项整改'
          },
          specialRisk: {
            value: '11', unit: '件', sub: '异常或黑灰产标记投诉（去重）',
            insights: [
              { label: '异常投诉', value: '7 件', tone: 'warning' },
              { label: '黑灰产投诉', value: '4 件', tone: 'danger' },
              { label: '待核验', value: '2 件', tone: 'normal' }
            ],
            conclusion: '2 件投诉尚待核验，需关注本分行特殊风险处置压力'
          }
        },
        values: {
          total: '判断本分行投诉压力，定位下辖机构问题并安排处理资源。',
          perClient: '本分行投诉密度超过目标值，需核查 3 家单位客户投诉异常的支行。',
          perOutlet: '本分行网点平均投诉压力超过目标值，需直接核查 4 个异常网点。',
          repeat: '定位辖内反复投诉问题，检查处理结果和整改措施是否有效。',
          specialRisk: '掌握本分行异常及黑灰产投诉，安排核验和特殊处置资源。'
        }
      },
      outlet: {
        key: 'outlet',
        label: '支行/网点视角',
        shortLabel: '支行/网点',
        organization: '思明支行',
        scope: '思明支行及下辖 4 个营业网点',
        clientCount: '187,500',
        outletCount: '4',
        scopeNote: '当前为支行视角，包含下辖营业网点',
        focus: '关注本机构具体投诉密度、投诉压力和辖内网点服务情况。',
        abnormalTitle: '异常网点明细',
        abnormalRule: '每万客户投诉高于关注值 4.00，需结合投诉量和客户规模进行人工复核',
        abnormalRows: [
          { name: '莲前网点', complaints: '28', clients: '40,000', rate: '7.00', deviation: '+3.00', status: '橙色预警' },
          { name: '会展网点', complaints: '19', clients: '35,000', rate: '5.43', deviation: '+1.43', status: '黄色关注' }
        ],
        outletAbnormalTitle: '思明支行异常网点明细',
        outletAbnormalRule: '单个网点投诉量高于关注值 20.0；因网点分母为 1，需结合投诉原因进一步复核',
        outletAbnormalRows: [
          { name: '莲前网点', parent: '思明支行', complaints: '28', deviation: '+8.0', status: '橙色预警' },
          { name: '会展网点', parent: '思明支行', complaints: '24', deviation: '+4.0', status: '黄色关注' }
        ],
        metrics: {
          total: { value: '96', unit: '件', sub: '本支行及下辖有效投诉' },
          perClient: {
            value: '5.12',
            unit: '件/万客户',
            sub: '客户量较小时仅作辅助参考',
            insights: [
              { label: '环比', value: '↑ 4.9%', tone: 'warning' },
              { label: '关注值', value: '4.00', tone: 'normal' },
              { label: '异常网点', value: '2 个', tone: 'danger', action: 'abnormal' }
            ],
            conclusion: '高于关注值 1.12，2 个网点需结合投诉量复核'
          },
          perOutlet: {
            value: '24.0',
            unit: '件/网点',
            sub: '辖内 4 个营业网点平均值',
            insights: [
              { label: '环比', value: '↑ 6.7%', tone: 'warning' },
              { label: '关注值', value: '20.0', tone: 'normal' },
              { label: '异常网点', value: '2 个', tone: 'danger', action: 'abnormal' }
            ],
            conclusion: '高于关注值 4.0，2 个网点需进一步复核'
          },
          repeat: {
            value: '7', unit: '件', sub: '本支行再次投诉有效工单',
            insights: [
              { label: '环比', value: '↑ 16.7%', tone: 'warning' },
              { label: '重复投诉率', value: '7.29%', tone: 'danger' },
              { label: '高频问题', value: '2 项', tone: 'normal' }
            ],
            conclusion: '重复投诉率较高，需复盘 2 项高频问题的处理过程'
          },
          specialRisk: {
            value: '3', unit: '件', sub: '异常或黑灰产标记投诉（去重）',
            insights: [
              { label: '异常投诉', value: '2 件', tone: 'warning' },
              { label: '黑灰产投诉', value: '1 件', tone: 'danger' },
              { label: '待核验', value: '1 件', tone: 'normal' }
            ],
            conclusion: '1 件投诉尚待核验，需及时确认风险性质和处置方式'
          }
        },
        values: {
          total: '关注本机构具体投诉和处理情况，快速确认当前工作压力。',
          perClient: '本机构投诉密度高于关注值，需结合投诉量复核 2 个异常网点。',
          perOutlet: '辖内网均投诉超过关注值，需结合投诉原因复核 2 个异常网点。',
          repeat: '复盘本机构再次投诉工单，确认客户诉求是否得到实质解决。',
          specialRisk: '及时核验异常或黑灰产投诉，避免风险扩大和处置延误。'
        }
      }
    };

    // 投诉总览2：严格按照“数据展示层”呈现五组固定指标，仅随管理权限切换统计范围。
    const OVERVIEW2_DATA = {
      headOffice: {
        scope: '全行及全部下辖机构',
        focus: '快速判断全行投诉规模、监管压力、问题复发、特殊风险和处理质量。',
        cards: {
          scale: {
            title: '投诉规模', eyebrow: '总体投诉压力', icon: 'file', accent: '#2272DE', soft: '#E9F1FC',
            value: '12,486', unit: '件', valueLabel: '有效投诉总量',
            items: [{ label: '投诉受理总量', value: '13,240 件' }, { label: '有效投诉占比', value: '94.3%' }],
            question: '当前全行收到多少投诉？', managementValue: '判断整体投诉规模和当前投诉压力。'
          },
          regulatory: {
            title: '监管压力', eyebrow: '监管转送', icon: 'monitor', accent: '#185FBF', soft: '#E9F1FC',
            value: '1,286', unit: '件', valueLabel: '监管转送投诉总量',
            items: [{ label: '监管投诉占比', value: '10.3%' }, { label: '重点关注投诉', value: '28 件' }],
            question: '有多少投诉来自监管转送？', managementValue: '判断当前全行监管压力和重点投诉规模。'
          },
          repeat: {
            title: '重复投诉量', eyebrow: '重复风险', icon: 'repeat', accent: '#2272DE', soft: '#E9F1FC',
            value: '286', unit: '件', valueLabel: '',
            items: [{ label: '重复投诉率', value: '2.29%' }, { label: '高频重复事项', value: '12 项' }],
            question: '有多少客户再次投诉？', managementValue: '判断问题是否真正解决及整改是否有效。'
          },
          special: {
            title: '异常/黑灰产投诉量', eyebrow: '特殊风险', icon: 'shield', accent: '#164F9B', soft: '#E9F1FC',
            value: '64', unit: '件', valueLabel: '',
            items: [{ label: '异常投诉', value: '41 件' }, { label: '黑灰产投诉', value: '23 件' }],
            question: '当前有多少异常或黑灰产投诉？', managementValue: '掌握特殊风险规模，辅助安排核验和差异化处置。'
          },
          quality: {
            title: '与客户达成一致率', eyebrow: '处理质量', icon: 'check', accent: '#123E78', soft: '#E9F1FC',
            value: '91.6', unit: '%', valueLabel: '',
            items: [{ label: '结果告知率', value: '98.7%' }, { label: '救济途径告知率', value: '97.4%' }],
            question: '投诉处理结果如何？', managementValue: '判断投诉是否实质解决，而不仅是完成工单。'
          }
        }
      },
      branch: {
        scope: '厦门分行及下辖支行、营业网点',
        focus: '掌握本分行五项核心结果，判断辖内投诉风险和处理质量。',
        cards: {
          scale: { title: '投诉规模', eyebrow: '总体投诉压力', icon: 'file', accent: '#2272DE', soft: '#E9F1FC', value: '836', unit: '件', valueLabel: '有效投诉总量', items: [{ label: '投诉受理总量', value: '884 件' }, { label: '有效投诉占比', value: '94.6%' }], question: '当前本分行收到多少投诉？', managementValue: '判断本分行及下辖机构的整体投诉压力。' },
          regulatory: { title: '监管压力', eyebrow: '监管转送', icon: 'monitor', accent: '#185FBF', soft: '#E9F1FC', value: '86', unit: '件', valueLabel: '监管转送投诉总量', items: [{ label: '监管投诉占比', value: '10.3%' }, { label: '重点关注投诉', value: '6 件' }], question: '本分行有多少监管转送投诉？', managementValue: '掌握本分行监管投诉规模和处置压力。' },
          repeat: { title: '重复投诉量', eyebrow: '重复风险', icon: 'repeat', accent: '#2272DE', soft: '#E9F1FC', value: '32', unit: '件', valueLabel: '', items: [{ label: '重复投诉率', value: '3.83%' }, { label: '高频重复事项', value: '4 项' }], question: '本分行有多少客户再次投诉？', managementValue: '检查辖内首次处理和整改措施是否有效。' },
          special: { title: '异常/黑灰产投诉量', eyebrow: '特殊风险', icon: 'shield', accent: '#164F9B', soft: '#E9F1FC', value: '11', unit: '件', valueLabel: '', items: [{ label: '异常投诉', value: '7 件' }, { label: '黑灰产投诉', value: '4 件' }], question: '本分行有多少异常或黑灰产投诉？', managementValue: '安排辖内风险核验和特殊投诉处置资源。' },
          quality: { title: '与客户达成一致率', eyebrow: '处理质量', icon: 'check', accent: '#123E78', soft: '#E9F1FC', value: '89.2', unit: '%', valueLabel: '', items: [{ label: '结果告知率', value: '97.8%' }, { label: '救济途径告知率', value: '95.6%' }], question: '本分行投诉处理结果如何？', managementValue: '判断辖内投诉是否得到实质解决。' }
        }
      },
      outlet: {
        scope: '思明支行及下辖4个营业网点',
        focus: '关注本机构具体投诉结果，及时确认重复、特殊风险和处理质量。',
        cards: {
          scale: { title: '投诉规模', eyebrow: '总体投诉压力', icon: 'file', accent: '#2272DE', soft: '#E9F1FC', value: '96', unit: '件', valueLabel: '有效投诉总量', items: [{ label: '投诉受理总量', value: '102 件' }, { label: '有效投诉占比', value: '94.1%' }], question: '当前本机构收到多少投诉？', managementValue: '确认本机构当前投诉工作压力。' },
          regulatory: { title: '监管压力', eyebrow: '监管转送', icon: 'monitor', accent: '#185FBF', soft: '#E9F1FC', value: '12', unit: '件', valueLabel: '监管转送投诉总量', items: [{ label: '监管投诉占比', value: '12.5%' }, { label: '重点关注投诉', value: '2 件' }], question: '本机构有多少监管转送投诉？', managementValue: '及时跟踪本机构监管投诉处置情况。' },
          repeat: { title: '重复投诉量', eyebrow: '重复风险', icon: 'repeat', accent: '#2272DE', soft: '#E9F1FC', value: '7', unit: '件', valueLabel: '', items: [{ label: '重复投诉率', value: '7.29%' }, { label: '高频重复事项', value: '2 项' }], question: '本机构有多少客户再次投诉？', managementValue: '复盘原投诉处理过程，避免问题继续反复。' },
          special: { title: '异常/黑灰产投诉量', eyebrow: '特殊风险', icon: 'shield', accent: '#164F9B', soft: '#E9F1FC', value: '3', unit: '件', valueLabel: '', items: [{ label: '异常投诉', value: '2 件' }, { label: '黑灰产投诉', value: '1 件' }], question: '本机构有多少异常或黑灰产投诉？', managementValue: '及时确认风险性质和对应处置方式。' },
          quality: { title: '与客户达成一致率', eyebrow: '处理质量', icon: 'check', accent: '#123E78', soft: '#E9F1FC', value: '85.4', unit: '%', valueLabel: '', items: [{ label: '结果告知率', value: '95.8%' }, { label: '救济途径告知率', value: '93.8%' }], question: '本机构投诉处理结果如何？', managementValue: '识别已办结但未实质解决的投诉风险。' }
        }
      }
    };

    // 基础统计固定专题：按投诉时间展示每日有效投诉量趋势。
    const TREND_DATA = {
      headOffice: {
        compare: '7.6%',
        points: [740, 760, 785, 770, 800, 825, 790, 830, 855, 810, 860, 900, 920, 890, 951]
      },
      branch: {
        compare: '5.2%',
        points: [45, 48, 50, 52, 49, 55, 58, 54, 60, 57, 62, 64, 61, 66, 55]
      },
      outlet: {
        compare: '9.1%',
        points: [5, 6, 5, 7, 6, 6, 8, 5, 7, 6, 8, 9, 7, 6, 5]
      }
    };

    const INSTITUTION_BRANCH_NAMES = ['厦门分行', '上海分行', '福州分行', '北京分行', '宁德分行', '龙岩分行', '漳州分行', '莆田分行', '三明分行', '珠海分行', '泉州分行', '南平分行'];
    const INSTITUTION_NAMES = {
      headOffice: ['厦门分行', '上海分行', '福州分行', '北京分行', '宁德分行'],
      branch: ['思明支行', '湖里支行', '集美支行', '海沧支行', '同安支行'],
      outlet: ['莲前网点', '会展网点', '湖里营业部', '集美新城网点', '海沧网点']
    };

    const INSTITUTION_SUMMARY = {
      headOffice: { included: '43', attention: '6', regulatory: '3', overdue: '4' },
      branch: { included: '12', attention: '3', regulatory: '2', overdue: '2' },
      outlet: { included: '4', attention: '2', regulatory: '1', overdue: '1' }
    };

    // 仅保留截图中未划线的九个管理关注维度。
    const INSTITUTION_FOCUS_DATA = {
      pressure: {
        label: '投诉压力',
        question: '哪些机构投诉最多？',
        metrics: ['有效投诉量', '投诉占比', '环比', '机构排名'],
        chartMetric: '有效投诉量',
        unit: '件',
        values: {
          headOffice: [836, 742, 691, 628, 584, 552, 518, 474, 441, 398, 365, 332],
          branch: [96, 82, 71, 62, 55],
          outlet: [28, 24, 23, 21, 18]
        },
        judgement: '投诉量排名靠前，需要结合投诉占比和环比方向确定重点机构。',
        action: '优先安排处理资源，重点盯防占比高且环比上升的机构，并下钻查看产品、原因和渠道构成。'
      },
      regulatory: {
        label: '监管风险',
        question: '哪些机构更容易形成监管压力？',
        metrics: ['监管投诉量', '监管投诉占比', '监管投诉环比增幅', '监管投诉同比增幅'],
        chartMetric: '监管投诉占比',
        unit: '%',
        values: {
          headOffice: [18.6, 16.4, 14.8, 12.7, 11.9, 11.2, 10.6, 9.9, 9.3, 8.8, 8.1, 7.4],
          branch: [20.9, 18.3, 15.5, 14.7, 12.8],
          outlet: [25.0, 20.8, 17.4, 14.3, 11.1]
        },
        judgement: '监管投诉占比高且环比增长快，说明当前监管压力较高且近期仍在上升。',
        action: '优先核查右上象限机构的监管转送原因、重点投诉进度和新增问题来源。'
      },
      trend: {
        label: '变化趋势',
        question: '哪些机构投诉增长最大？',
        metrics: ['有效投诉量', '环比', '同比', '预警触发机构'],
        chartMetric: '投诉环比增幅',
        unit: '%',
        values: {
          headOffice: [12.0, 22.5, 21.0, 24.1, 6.7, 15.4, 8.1, 14.8, 9.7, 7.3, 11.2, 6.1],
          branch: [28.6, 24.3, 19.8, 16.4, 12.7],
          outlet: [35.0, 27.8, 22.2, 18.8, 14.3]
        },
        judgement: '等环比、同比双超阈值的机构，往往是新的风险热点，应重点盯防。',
        action: '切换日／周／月定位突发时段，悬停查看单点环比同比，对双超机构优先核查新增问题来源。'
      },
      efficiency: {
        label: '处理效率',
        question: '哪些机构处理最慢？',
        metrics: ['平均处理时长', '按时办结率'],
        chartMetric: '平均处理时长',
        unit: '天',
        values: {
          headOffice: [6.8, 6.2, 5.9, 5.4, 5.1, 4.9, 4.7, 4.5, 4.3, 4.1, 3.9, 3.7],
          branch: [6.1, 5.8, 5.3, 4.9, 4.6],
          outlet: [5.8, 5.2, 4.9, 4.5, 4.1]
        },
        judgement: '平均处理时长偏高，可能存在流程协同或责任认定障碍。',
        action: '检查超时环节、协同部门和高龄工单，明确提速责任。'
      },
      backlog: {
        label: '积压风险',
        question: '哪些机构存在大量未处理或即将超期工单？',
        metrics: ['待办量', '超期量', '超期率', '工单账龄'],
        chartMetric: '超期工单量',
        unit: '件',
        values: {
          headOffice: [38, 32, 29, 24, 21],
          branch: [12, 10, 8, 7, 5],
          outlet: [6, 5, 4, 3, 2]
        },
        judgement: '超期工单集中，继续积压可能引发重复投诉和监管升级。',
        action: '按工单账龄分层清理，优先处理即将超期及监管转送工单。'
      },
      quality: {
        label: '处理质量',
        question: '哪些机构与客户达成一致的比例较低？',
        metrics: ['达成一致率'],
        chartMetric: '达成一致率',
        unit: '%',
        values: {
          headOffice: [27.6, 24.2, 21.9, 19.4, 17.7, 16.8, 15.9, 15.1, 14.4, 13.7, 12.9, 12.2],
          branch: [25.4, 22.8, 20.6, 18.5, 16.9],
          outlet: [28.6, 24.0, 20.8, 18.2, 15.6]
        },
        judgement: '达成一致率偏低，说明投诉处理结果未获得客户认可，存在重复投诉或监管升级风险。',
        action: '优先抽查未达成一致的工单，复核处理方案、沟通过程和救济途径告知情况。'
      },
      recurrence: {
        label: '问题复发',
        question: '哪些机构处理后客户仍再次投诉？',
        metrics: ['重复投诉量', '重复投诉率'],
        chartMetric: '重复投诉率',
        unit: '%',
        values: {
          headOffice: [8.4, 7.6, 6.9, 5.8, 5.2],
          branch: [9.1, 8.3, 7.2, 6.4, 5.5],
          outlet: [10.7, 8.3, 7.1, 6.0, 5.6]
        },
        judgement: '重复投诉率较高，表明首次处理或整改措施可能未解决根本问题。',
        action: '关联原工单复盘处理过程，并对高频重复事项开展专项整改。'
      },
      special: {
        label: '特殊风险',
        question: '哪些机构异常投诉或黑灰产压力较大？',
        metrics: ['异常投诉量', '黑灰产投诉量', '特殊风险占比'],
        chartMetric: '特殊风险投诉量',
        unit: '件',
        values: {
          headOffice: [28, 24, 19, 16, 13],
          branch: [9, 7, 6, 4, 3],
          outlet: [4, 3, 2, 2, 1]
        },
        judgement: '特殊风险投诉较集中，需要避免按普通投诉流程机械处置。',
        action: '加强证据核验、风险会商和差异化处置，跟踪待核验工单。'
      },
      resource: {
        label: '资源匹配',
        question: '投诉压力是否超过机构处理能力？',
        metrics: ['人均待办量', '人均处理量', '超期率'],
        chartMetric: '人均待办量',
        unit: '件/人',
        values: {
          headOffice: [18.6, 16.9, 15.8, 14.2, 13.5],
          branch: [16.4, 15.1, 13.8, 12.6, 11.9],
          outlet: [14.0, 12.5, 11.0, 9.5, 8.0]
        },
        judgement: '人均待办量较高且伴随超期，可能存在处理资源不足。',
        action: '结合人员配置和工单复杂度，动态调配处理人员与协同资源。'
      },
      rectification: {
        label: '整改效果',
        question: '重点机构整改后投诉是否下降？',
        metrics: ['整改前有效投诉量', '整改后有效投诉量', '有效投诉量降幅'],
        chartMetric: '整改后有效投诉量降幅',
        unit: '%',
        values: {
          headOffice: [38.6, 31.4, 27.8, 22.5, 18.3],
          branch: [35.2, 29.7, 24.6, 20.8, 16.9],
          outlet: [32.1, 27.5, 23.8, 18.6, 14.2]
        },
        judgement: '通过有效投诉量降幅判断整改是否达到预期目标。',
        action: '持续跟踪整改后三个统计周期，对未持续下降的机构重新评估整改措施。'
      }
    };

    // 机构分析2仅呈现本轮确认的六个高亮分析维度。
    const INSTITUTION2_KEYS = ['pressure', 'regulatory', 'trend', 'efficiency', 'quality', 'rectification'];

    // 六张机构分析图的统计说明，便于业务、研发和数据团队统一实现口径。
    const INSTITUTION2_METHODS = {
      pressure: {
        caliber: '统计期内，按投诉责任机构归属的有效投诉工单（排除无效、撤销、废止、剔除，按工单编号去重）；按有效投诉量降序展示 Top5 机构，占比以当前管理范围有效投诉总量为分母。',
        formula: '有效投诉量＝符合有效口径的工单编号去重数\n投诉占比＝本机构有效投诉量÷当前管理范围有效投诉总量×100%\n环比＝（本期有效投诉量－上期）÷上期×100%',
        source: '工单编号、客户投诉时间、投诉责任机构、是否无效投诉、是否撤销、是否废止、是否剔除'
      },
      regulatory: {
        caliber: '统计期内由监管机构接收并转送、且经认定有效的投诉，按投诉责任机构归属。',
        formula: '监管投诉占比＝本机构监管转送有效投诉量÷本机构有效投诉量×100%\n环比增幅＝（本期监管投诉量－上期监管投诉量）÷上期监管投诉量×100%\n同比增幅＝（本期监管投诉量－上年同期监管投诉量）÷上年同期监管投诉量×100%\n对比期为0时标记“新增”，不计算增幅',
        source: '投诉责任机构、受理渠道、转送时间、工单编号、是否无效投诉、客户投诉时间'
      },
      trend: {
        caliber: '按客户投诉时间归属期统计各机构有效投诉量，粒度可切换日／周／月并随统计周期筛选联动（按月展示截至结束月的近6个月）；默认按有效投诉量降序取 Top5／Top10 机构，有效口径与机构归属保持不变。',
        formula: '期有效投诉量＝当期有效工单编号去重数\n环比＝（本期－上期）÷上期×100%\n同比＝（本期－上年同期）÷上年同期×100%\n触发预警：环比＞20% 或 同比＞30%',
        source: '客户投诉时间、工单编号、投诉责任机构、是否无效投诉、是否撤销、是否废止、是否剔除（同比需上年同期归档数据）'
      },
      efficiency: {
        caliber: '统计期内已反馈或已办结投诉，按实际接收至处置员最后反馈的自然日计算处理时长。',
        formula: '处理时长＝处置员反馈时间－接收时间\n平均处理时长＝处理时长合计÷已反馈工单量\n按时办结率＝未超期办结量÷已办结量×100%',
        source: '工单接收机构、接收时间、处置员反馈时间、工单状态、是否超期、投诉责任机构'
      },
      quality: {
        caliber: '统计期内已办结的有效投诉，按投诉责任机构统计是否与客户达成一致。',
        formula: '达成一致率＝“是否达成一致＝是”的已办结有效投诉量÷已办结有效投诉量×100%',
        source: '工单编号、工单状态、是否有效投诉、是否达成一致、投诉责任机构'
      },
      rectification: {
        caliber: '默认统计有效投诉量。以整改完成日为界，选择时长相同的整改前、整改后观察期，按同一投诉责任机构统计有效投诉工单去重数。排除无效、撤销、废止及剔除工单。',
        formula: '有效投诉量降幅＝（整改前观察期有效投诉量－整改后观察期有效投诉量）÷整改前观察期有效投诉量×100%\n达标条件：有效投诉量降幅≥20%',
        source: '整改记录、整改完成时间、工单编号、客户投诉时间、投诉责任机构、是否无效投诉、是否撤销、是否废止、是否剔除（需关联整改台账）',
        pending: true
      }
    };

    const FIRST_LEVEL_ORG_DATA = {
      '全行': { viewKey: 'headOffice', names: ['厦门分行', '上海分行', '福州分行', '北京分行', '宁德分行'], valid: '12,486', received: '13,240', invalid: '754', invalidShare: '5.7%', mom: '+6.8%', yoy: '+12.3%', regVolume: '1,286', validShare: '94.3%', regulatoryShare: '10.3%', attention: '6', alertCount: '4', momOver: '3', yoyOver: '2' },
      '厦门分行': { viewKey: 'branch', names: ['厦门分行营业部', '思明支行', '湖里支行', '海沧支行', '同安支行'], valid: '836', received: '884', invalid: '48', invalidShare: '5.4%', mom: '+5.2%', yoy: '+9.4%', regVolume: '86', validShare: '94.6%', regulatoryShare: '10.3%', attention: '3', alertCount: '2', momOver: '1', yoyOver: '1' },
      '上海分行': { viewKey: 'branch', names: ['浦东支行', '徐汇支行', '虹桥支行', '静安支行', '陆家嘴支行'], valid: '742', received: '791', invalid: '49', invalidShare: '6.2%', mom: '+7.1%', yoy: '+14.2%', regVolume: '86', validShare: '93.8%', regulatoryShare: '11.6%', attention: '4', alertCount: '3', momOver: '2', yoyOver: '2' },
      '福州分行': { viewKey: 'branch', names: ['鼓楼支行', '台江支行', '仓山支行', '晋安支行', '马尾支行'], valid: '691', received: '727', invalid: '36', invalidShare: '5.0%', mom: '+4.3%', yoy: '+8.1%', regVolume: '68', validShare: '95.1%', regulatoryShare: '9.8%', attention: '2', alertCount: '1', momOver: '1', yoyOver: '0' },
      '北京分行': { viewKey: 'branch', names: ['中关村支行', '朝阳支行', '海淀支行', '丰台支行', '东城支行'], valid: '628', received: '676', invalid: '48', invalidShare: '7.1%', mom: '+6.0%', yoy: '+11.0%', regVolume: '80', validShare: '92.9%', regulatoryShare: '12.7%', attention: '3', alertCount: '2', momOver: '2', yoyOver: '1' },
      '宁德分行': { viewKey: 'branch', names: ['蕉城支行', '东侨支行', '福安支行', '霞浦支行', '古田支行'], valid: '584', received: '611', invalid: '27', invalidShare: '4.5%', mom: '+3.5%', yoy: '+6.7%', regVolume: '52', validShare: '95.5%', regulatoryShare: '8.9%', attention: '2', alertCount: '1', momOver: '0', yoyOver: '1' }
    };

    // 投诉激增预警明细：环比＞20% 或 同比＞30% 触发；type 标注触发类型，tone 控制配色。
    const ALERT_DETAIL_DATA = {
      '全行': [
        { name: '上海分行', current: '742', mom: '+22.5%', yoy: '+31.2%', type: '环比+同比', tone: 'danger' },
        { name: '厦门分行', current: '836', mom: '+12.0%', yoy: '+33.5%', type: '同比', tone: 'warn' },
        { name: '北京分行', current: '628', mom: '+24.1%', yoy: '+18.0%', type: '环比', tone: 'warn' },
        { name: '福州分行', current: '691', mom: '+21.0%', yoy: '+9.4%', type: '环比', tone: 'warn' }
      ],
      '厦门分行': [
        { name: '厦门分行营业部', current: '286', mom: '+22.4%', yoy: '+18.6%', type: '环比', tone: 'danger' },
        { name: '思明支行', current: '214', mom: '+23.0%', yoy: '+14.0%', type: '环比', tone: 'warn' },
        { name: '湖里支行', current: '186', mom: '+8.0%', yoy: '+35.0%', type: '同比', tone: 'warn' }
      ],
      '上海分行': [
        { name: '浦东支行', current: '210', mom: '+25.0%', yoy: '+32.0%', type: '环比+同比', tone: 'danger' },
        { name: '徐汇支行', current: '168', mom: '+21.0%', yoy: '+15.0%', type: '环比', tone: 'warn' },
        { name: '静安支行', current: '150', mom: '+10.0%', yoy: '+34.0%', type: '同比', tone: 'warn' }
      ],
      '福州分行': [
        { name: '鼓楼支行', current: '180', mom: '+21.0%', yoy: '+11.0%', type: '环比', tone: 'warn' }
      ],
      '北京分行': [
        { name: '中关村支行', current: '165', mom: '+26.0%', yoy: '+31.0%', type: '环比+同比', tone: 'danger' },
        { name: '朝阳支行', current: '140', mom: '+22.0%', yoy: '+12.0%', type: '环比', tone: 'warn' }
      ],
      '宁德分行': [
        { name: '蕉城支行', current: '158', mom: '+9.0%', yoy: '+33.0%', type: '同比', tone: 'warn' }
      ]
    };

    // 监管投诉指标独立使用“监管机构接收并转送的有效投诉”作为统计分子。
    const REGULATORY_DATA = {
      headOffice: {
        scope: '全行监管机构接收并转送的有效投诉',
        metrics: {
          regTotal: {
            value: '1,286', unit: '件', sub: '监管机构接收并转送',
            insights: [
              { label: '环比', value: '↑ 6.4%', tone: 'warning' },
              { label: '占有效投诉', value: '10.3%', tone: 'normal' },
              { label: '重点关注', value: '28 件', tone: 'danger' }
            ],
            conclusion: '监管转送投诉环比上升，需优先跟踪 28 件重点投诉',
            valueText: '判断全行监管投诉压力及重点投诉处置规模。'
          },
          regPerThousand: {
            value: '0.04', unit: '件/千客户', sub: '按全行有效客户标准化',
            insights: [
              { label: '环比', value: '↑ 5.0%', tone: 'warning' },
              { label: '目标值', value: '0.03', tone: 'normal' },
              { label: '异常分行', value: '3 家', tone: 'danger' }
            ],
            conclusion: '高于目标值 0.01，3 家分行超过预警线',
            valueText: '排除客户规模差异，识别监管投诉密度异常的分行。'
          },
          regPerOutlet: {
            value: '1.93', unit: '件/网点', sub: '按全行营业网点标准化',
            insights: [
              { label: '环比', value: '↑ 8.4%', tone: 'warning' },
              { label: '目标值', value: '1.50', tone: 'normal' },
              { label: '异常网点', value: '5 个', tone: 'danger' }
            ],
            conclusion: '高于目标值 0.43，5 个网点超过预警线',
            valueText: '判断监管投诉在营业网点层面的平均压力。'
          }
        }
      },
      branch: {
        scope: '厦门分行及下辖机构的监管转送有效投诉',
        metrics: {
          regTotal: {
            value: '86', unit: '件', sub: '本分行监管转送投诉',
            insights: [
              { label: '环比', value: '↑ 4.9%', tone: 'warning' },
              { label: '占有效投诉', value: '10.3%', tone: 'normal' },
              { label: '重点关注', value: '6 件', tone: 'danger' }
            ],
            conclusion: '本分行监管投诉上升，需重点跟踪 6 件投诉',
            valueText: '掌握本分行监管投诉规模及重点投诉处理压力。'
          },
          regPerThousand: {
            value: '0.04', unit: '件/千客户', sub: '按本分行有效客户标准化',
            insights: [
              { label: '环比', value: '↑ 3.2%', tone: 'warning' },
              { label: '目标值', value: '0.03', tone: 'normal' },
              { label: '异常支行', value: '2 家', tone: 'danger' }
            ],
            conclusion: '高于目标值 0.01，2 家支行超过预警线',
            valueText: '识别监管投诉总量不高但单位客户投诉异常的支行。'
          },
          regPerOutlet: {
            value: '2.32', unit: '件/网点', sub: '按本分行营业网点标准化',
            insights: [
              { label: '环比', value: '↑ 7.1%', tone: 'warning' },
              { label: '目标值', value: '2.00', tone: 'normal' },
              { label: '异常网点', value: '4 个', tone: 'danger' }
            ],
            conclusion: '高于目标值 0.32，4 个网点超过预警线',
            valueText: '定位辖内监管投诉压力较高的具体营业网点。'
          }
        }
      },
      outlet: {
        scope: '思明支行及下辖网点的监管转送有效投诉',
        metrics: {
          regTotal: {
            value: '12', unit: '件', sub: '本支行监管转送投诉',
            insights: [
              { label: '环比', value: '↑ 9.1%', tone: 'warning' },
              { label: '占有效投诉', value: '12.5%', tone: 'normal' },
              { label: '重点关注', value: '2 件', tone: 'danger' }
            ],
            conclusion: '本支行监管投诉上升，需优先处理 2 件重点投诉',
            valueText: '关注本机构监管投诉数量及重点投诉处置情况。'
          },
          regPerThousand: {
            value: '0.06', unit: '件/千客户', sub: '客户量较小时仅作辅助参考',
            insights: [
              { label: '环比', value: '↑ 4.6%', tone: 'warning' },
              { label: '关注值', value: '0.04', tone: 'normal' },
              { label: '异常网点', value: '2 个', tone: 'danger' }
            ],
            conclusion: '高于关注值 0.02，2 个网点需进一步复核',
            valueText: '观察辖内网点监管投诉密度，避免小样本直接排名。'
          },
          regPerOutlet: {
            value: '3.00', unit: '件/网点', sub: '辖内 4 个营业网点平均值',
            insights: [
              { label: '环比', value: '↑ 6.7%', tone: 'warning' },
              { label: '关注值', value: '2.50', tone: 'normal' },
              { label: '异常网点', value: '2 个', tone: 'danger' }
            ],
            conclusion: '高于关注值 0.50，2 个网点超过预警线',
            valueText: '定位辖内监管投诉较集中的具体营业网点。'
          }
        }
      }
    };

    const REGULATORY_META = {
      regTotal: {
        title: '监管转送投诉总量',
        eyebrow: '监管规模',
        icon: 'file',
        formula: '监管转送有效投诉工单数（按工单编号去重）'
      },
      regPerThousand: {
        title: '有效每千客户投诉',
        eyebrow: '客户标准化',
        icon: 'users',
        formula: '监管转送投诉总量 ÷ 同期有效客户数 × 1,000'
      },
      regPerOutlet: {
        title: '有效网均投诉',
        eyebrow: '网点标准化',
        icon: 'building',
        formula: '监管转送投诉总量 ÷ 同期有效营业网点数'
      }
    };

    const METRIC_META = {
      total: {
        title: '有效投诉总量',
        eyebrow: '绝对规模',
        accent: '#2272DE',
        soft: '#E9F1FC',
        description: '统计周期内，真正进入管理和分析范围的有效投诉工单数量。',
        formula: '有效投诉工单数（按工单编号去重）',
        scope: '以客户投诉时间为统计时间，排除无效、废止、已剔除及重复导入工单。',
        confirm: ['统计时间最终采用投诉时间、接收时间还是创建时间', '无效、废止、剔除等状态的统一映射', '跨机构工单按投诉机构还是责任机构归属']
      },
      perClient: {
        title: '有效每万客户投诉',
        eyebrow: '客户标准化',
        accent: '#2272DE',
        soft: '#E9F1FC',
        description: '消除不同机构客户规模差异，衡量单位客户规模下的投诉水平。',
        formula: '有效投诉总量 ÷ 同期有效客户数 × 10,000',
        scope: '投诉统计范围、时间口径和组织范围与有效投诉总量保持一致。',
        confirm: ['有效客户定义及数据来源', '个人与企业客户是否均纳入', '客户数取期末值还是日均值', '客户如何归属机构']
      },
      perOutlet: {
        title: '有效网均投诉',
        eyebrow: '网点标准化',
        accent: '#7C4DCE',
        soft: '#F5F2FE',
        description: '消除不同机构营业网点数量差异，衡量单个网点平均投诉压力。',
        formula: '有效投诉总量 ÷ 同期有效营业网点数',
        scope: '网点口径需与投诉组织范围一致，单个网点分母为 1 时不单独展示。',
        confirm: ['哪些机构属于营业网点', '停业、筹建网点是否排除', '网点数取期末值还是日均值', '总行部门是否纳入']
      },
      repeat: {
        title: '重复投诉量',
        eyebrow: '重复风险',
        accent: '#E8792E',
        soft: '#FFF4E8',
        description: '统计有效投诉中客户再次投诉的工单数量，用于识别问题是否反复发生。',
        formula: '“是否再次投诉＝是”的有效投诉工单数（按工单编号去重）',
        scope: '投诉统计范围与有效投诉总量一致，同一事件多次导入仅统计一次。',
        confirm: ['“再次投诉”的业务认定规则', '同一客户、同一事项的关联方式', '是否设置再次投诉识别时间窗口', '重复投诉率的分母口径']
      },
      specialRisk: {
        title: '异常/黑灰产投诉量',
        eyebrow: '特殊风险',
        accent: '#DC4C64',
        soft: '#FFF0F3',
        description: '统计被标记为异常投诉或黑灰产投诉的有效工单，分别展示两类风险规模。',
        formula: '“是否异常投诉＝是”或“是否黑灰产投诉＝是”的有效工单数（并集去重）',
        scope: '仅统计已进入有效投诉范围的工单；异常投诉和黑灰产投诉标签可分别查看。',
        confirm: ['异常投诉及黑灰产投诉的认定标准', '两个风险标签是否允许同时命中', '待核验工单是否纳入统计', '风险标签调整后的历史数据处理方式']
      }
    };

    function Icon({ name, size = 20, className = '' }) {
      const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className };
      const paths = {
        home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-6h6v6"/></>,
        chart: <><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20V7"/></>,
        file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></>,
        monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
        bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
        user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
        info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
        building: <><path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-5h6v5M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"/></>,
        users: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15.5a5 5 0 0 1 5 4.5"/></>,
        repeat: <><path d="M20 7h-7a6 6 0 1 0 5.2 9"/><path d="m17 3 3 4-3 4"/></>,
        shield: <><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6z"/><path d="M12 8v5M12 16h.01"/></>,
        branch: <><path d="M12 3v5M5 21v-5M19 21v-5M12 21v-6"/><path d="M5 16v-3h14v3M12 8v5"/></>,
        chevron: <path d="m9 18 6-6-6-6"/>,
        close: <path d="M6 6l12 12M18 6 6 18"/>,
        search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
        calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
        check: <path d="m5 12 4 4L19 6"/>,
        trend: <><path d="M4 18l5-5 3 3 7-8"/><path d="M15 8h5v5"/></>,
        settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V20.3h-3v-.09a1.7 1.7 0 0 0-1.03-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.55-1.03H5.3v-3h.15A1.7 1.7 0 0 0 7 9.94a1.7 1.7 0 0 0-.34-1.88L6.6 8l2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.7V4.6h3v.1a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03h.05v3h-.05A1.7 1.7 0 0 0 19.4 15z"/></>,
        flag: <><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></>,
        alert: <><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/></>,
        database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
        inbox: <><path d="M4 13h4l1.5 3h5L16 13h4"/><path d="M4 13 6 5h12l2 8v6H4z"/></>,
        download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>
      };
      return <svg {...common}>{paths[name]}</svg>;
    }

    function SidebarItem({ icon, label, active, children, onClick }) {
      return (
        <button onClick={onClick} className={`relative flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
          {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-violetx" />}
          <Icon name={icon} size={19} className={active ? 'text-white' : 'text-slate-400'} />
          <span className="flex-1">{label}</span>
          {children && <Icon name="chevron" size={15} className="text-slate-500" />}
        </button>
      );
    }

    function MetricCard({ metricKey, view, onOpen, onOpenDetail }) {
      const meta = METRIC_META[metricKey];
      const metric = view.metrics[metricKey];
      return (
        <article className="metric-card relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: meta.accent }} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ color: meta.accent, background: meta.soft }}>{meta.eyebrow}</span>
                <span className="text-xs text-slate-400">当前统计周期</span>
              </div>
              <h3 className="text-base font-semibold text-slate-800">{meta.title}</h3>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ color: meta.accent, background: meta.soft }}>
              <Icon name={metricKey === 'total' ? 'file' : metricKey === 'perClient' ? 'users' : metricKey === 'perOutlet' ? 'building' : metricKey === 'repeat' ? 'repeat' : 'shield'} size={21} />
            </div>
          </div>

          <div className="mt-6 flex items-end gap-2">
            <strong className="text-[34px] font-semibold leading-none tracking-tight text-slate-900">{metric.value}</strong>
            <span className="mb-0.5 text-sm text-slate-500">{metric.unit}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">{metric.sub}</p>

          {/* 每万客户投诉不仅展示平均值，同时给出管理判断所需的对比信息。 */}
          {metric.insights && (
            <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/60 p-3">
              <div className="grid grid-cols-3 divide-x divide-violet-100">
                {metric.insights.map((item) => (
                  <div key={item.label} className="px-2 first:pl-0 last:pr-0">
                    <div className="text-[11px] text-slate-400">{item.label}</div>
                    {item.action === 'abnormal' ? (
                      <button
                        onClick={() => onOpenDetail(metricKey)}
                        className="mt-1 inline-flex items-center gap-1 border-b border-dashed border-rose-300 text-sm font-semibold text-rose-600 transition hover:border-rose-600 hover:text-rose-700"
                        aria-label={`查看${meta.title}${item.label}明细`}
                      >
                        {normalizedComparison(item.value)}<span aria-hidden="true">›</span>
                      </button>
                    ) : (
                      <div className="mt-1 text-sm">
                        <ComparisonValue label={item.label} value={item.value}/>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-violet-100 pt-2 text-xs font-medium text-violet-700">
                判断：{metric.conclusion}
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Icon name="check" size={14} className="text-emerald-500" />
              当前视角管理价值
            </div>
            <p className="min-h-[42px] text-sm leading-6 text-slate-600">{view.values[metricKey]}</p>
          </div>

        </article>
      );
    }

    function RegulatoryMetricCard({ metricKey, regulatory }) {
      const meta = REGULATORY_META[metricKey];
      const metric = regulatory.metrics[metricKey];
      return (
        <article className="relative overflow-hidden rounded-lg border border-violet-100 bg-white p-5 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-violet-500" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">{meta.eyebrow}</span>
                <span className="text-xs text-slate-400">监管转送口径</span>
              </div>
              <h3 className="text-base font-semibold text-slate-800">{meta.title}</h3>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-50 text-violet-600">
              <Icon name={meta.icon} size={21} />
            </div>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <strong className="text-[32px] font-semibold leading-none tracking-tight text-slate-900">{metric.value}</strong>
            <span className="mb-0.5 text-sm text-slate-500">{metric.unit}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">{metric.sub}</p>

          <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/60 p-3">
            <div className="grid grid-cols-3 divide-x divide-violet-100">
              {metric.insights.map(item => (
                <div key={item.label} className="px-2 first:pl-0 last:pr-0">
                  <div className="text-[11px] text-slate-400">{item.label}</div>
                  <div className={`mt-1 text-sm font-semibold ${item.tone === 'danger' ? 'text-rose-600' : item.tone === 'warning' ? 'text-amber-600' : 'text-slate-700'}`}>{item.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-violet-100 pt-2 text-xs font-medium text-violet-700">判断：{metric.conclusion}</div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm leading-6 text-slate-600">{metric.valueText}</p>
            <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              <span className="font-medium text-slate-600">计算：</span>{meta.formula}
            </div>
          </div>
        </article>
      );
    }

    // 固定指标卡：只展示当前结果和管理含义，不提供筛选、对比或下钻入口。
    function Overview2Card({ card }) {
      return (
        <article data-testid="overview2-card" className="metric-card relative overflow-hidden rounded-lg border border-violet-100 bg-white p-5 shadow-card">
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: card.accent }} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ color: card.accent, background: card.soft }}>{card.eyebrow}</span>
              <h2 className="mt-2 text-base font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-1 text-xs text-slate-400">{card.question}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ color: card.accent, background: card.soft }}>
              <Icon name={card.icon} size={20} />
            </div>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <strong className="text-[34px] font-semibold leading-none tracking-tight text-slate-900">{card.value}</strong>
            <span className="mb-0.5 text-sm text-slate-500">{card.unit}</span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">{card.valueLabel}</div>

          <div className="mt-5 grid grid-cols-2 divide-x divide-violet-100 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-3">
            {card.items.map(item => (
              <div key={item.label} className="px-3 first:pl-0 last:pr-0">
                <div className="text-[11px] text-slate-400">{item.label}</div>
                <div className="mt-1 text-sm font-semibold text-violet-700">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Icon name="check" size={14} className="text-violet-500" />对管理层的价值</div>
            <p className="mt-2 min-h-[40px] text-sm leading-6 text-slate-600">{card.managementValue}</p>
          </div>
        </article>
      );
    }

    function Overview2Page({ viewKey, setViewKey }) {
      const view = VIEW_DATA[viewKey];
      const overview = OVERVIEW2_DATA[viewKey];
      const cards = Object.values(overview.cards);
      return (
        <div className="mx-auto max-w-[1540px] px-6 py-5">
          <nav className="mb-4 flex items-center gap-2 text-xs text-slate-400">
            <span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">投诉总览2</span>
          </nav>

          <section className="mb-4 flex items-end justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">投诉总览2</h1>
                <span className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">固定指标展示</span>
              </div>

            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />数据更新时间：2026-07-15 12:00</div>
          </section>

          {/* 三个视角仅改变权限范围，不改变固定指标和页面结构。 */}
          <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex items-center gap-6">
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">管理视角</div>
                <div className="flex rounded-md bg-slate-100 p-1">
                  {Object.values(VIEW_DATA).map(item => (
                    <button key={item.key} onClick={() => setViewKey(item.key)} className={`rounded px-4 py-2 text-sm font-medium transition ${viewKey === item.key ? 'bg-white text-violet-600 shadow-sm ring-1 ring-violet-200' : 'text-slate-500 hover:text-slate-800'}`}>{item.label}</button>
                  ))}
                </div>
              </div>
              <div className="h-12 w-px bg-slate-200" />
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">当前机构</div>
                <div className="flex h-10 min-w-[220px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"><Icon name="building" size={16} className="text-violet-500" />{view.organization}</div>
              </div>
              <div className="h-12 w-px bg-slate-200" />
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">固定统计周期</div>
                <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"><Icon name="calendar" size={16} className="text-slate-400" />2026年7月</div>
              </div>
              <div className="ml-auto rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-700">统计范围由当前用户权限自动确定</div>
            </div>
          </section>

          <section data-testid="overview2-explanation" className="mb-4 flex overflow-hidden rounded-lg border border-violet-100 bg-white shadow-card">
            <div className="flex w-[220px] flex-none items-center gap-3 bg-violet-50 px-4 py-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-violet-600 shadow-sm"><Icon name={viewKey === 'headOffice' ? 'building' : viewKey === 'branch' ? 'branch' : 'monitor'} size={20} /></div>
              <div><h2 className="text-sm font-semibold text-slate-800">{view.label}说明</h2><p className="mt-1 text-[11px] text-slate-400">权限范围自动切换</p></div>
            </div>
            <div className="grid flex-1 grid-cols-2 divide-x divide-slate-100 py-4">
              <div className="px-5"><div className="text-xs font-medium text-slate-400">数据范围</div><div className="mt-1 text-sm leading-6 text-slate-700">{overview.scope}</div></div>
              <div className="px-5"><div className="text-xs font-medium text-slate-400">管理重点</div><div className="mt-1 text-sm leading-6 text-slate-700">{overview.focus}</div></div>
            </div>
          </section>

          <div key={viewKey} className="view-enter">
            <section className="grid grid-cols-3 gap-4">
              {cards.slice(0, 3).map(card => <Overview2Card key={card.title} card={card} />)}
            </section>
            <section className="mt-4 grid grid-cols-2 gap-4">
              {cards.slice(3).map(card => <Overview2Card key={card.title} card={card} />)}
            </section>
          </div>
        </div>
      );
    }

    // 四项核心指标的管理说明：统一为“问题、口径、价值、数据源”。
    const PRODUCTION_METRIC_EXPLAIN={
      '投诉规模':{question:'当前总体投诉规模是否正常？',caliber:'展示查询范围内的有效投诉量，以及有效投诉占全部受理投诉的比例。按客户投诉时间纳入统计期，剔除无效、撤销、废止及重复导入的投诉工单，并按工单编号去重。',value:'判断整体投诉压力是否异常，为处理资源配置及后续重点分布分析提供基础。',source:'工单编号、客户投诉时间、有效投诉标识、撤销标识、废止标识、工单状态。'},
      '监管压力':{question:'当前监管投诉压力有多大？',caliber:'展示查询范围内的监管转送有效投诉量，以及监管投诉占有效投诉的比例。统计期内由监管机构转送且属于有效投诉的工单，按工单编号去重。',value:'判断当前监管风险，识别需要优先处理和重点跟踪的监管转送投诉。',source:'工单编号、客户投诉时间、受理渠道、监管转送标识、转送时间、有效投诉标识。'},
      '自收投诉':{question:'当前本行自收投诉规模有多大？',caliber:'展示查询范围内由本行渠道直接受理的有效投诉量。统计期内排除监管机构转送投诉，保留本行自收且属于有效投诉的工单，并按工单编号去重。',value:'判断本行自收渠道的投诉压力，为客户服务、消保受理及相关业务部门配置处理资源提供依据。',source:'工单编号、客户投诉时间、受理渠道、监管转送标识、有效投诉标识、工单状态。'},
      '重复投诉量':{question:'客户问题是否真正解决，是否再次引发投诉？',caliber:'展示重复投诉量、重复投诉率以及高频重复事项数量。统计期内统计“是否再次投诉＝是”的有效投诉，按本次工单编号去重，并通过关联工单追溯首次投诉。',value:'识别未真正解决的问题，定位重复投诉较多的原因和责任机构。',source:'工单编号、是否再次投诉、关联工单编号、有效投诉标识、投诉原因、处理结果。'},
      '异常/黑灰产投诉量':{question:'是否存在异常投诉或黑灰产集中投诉风险？',caliber:'展示异常投诉和黑灰产投诉的规模、占比及风险构成。统计期内统计“异常投诉＝是”或“黑灰产投诉＝是”的有效工单；合计时按工单编号取并集去重。',value:'掌握特殊风险规模，支持风险核验、差异化处置和人员资源安排。',source:'工单编号、异常投诉标识、黑灰产投诉标识、核验状态、有效投诉标识、客户及联系方式。'},
      '与客户达成一致率':{question:'当前投诉处理结果是否真正解决客户问题？',caliber:'展示已办结有效投诉的与客户达成一致率、处理结果告知率和救济途径告知率。按工单编号去重，仅统计已完成处理且属于有效投诉的工单。',value:'判断投诉处理结果是否获得客户认可，识别处理质量不足及可能再次引发投诉的风险。',source:'工单编号、工单状态、有效投诉标识、是否达成一致、处理结果是否告知、救济途径是否告知、处置员反馈时间。'}
    };

    // 投诉总览各分析区域的说明内容。
    const PRODUCTION_SECTION_EXPLAIN={
      trend:{title:'投诉整体趋势',question:'投诉规模和监管压力是否出现异常波动？',caliber:'在当前机构和日期范围内，按日、周或月汇总有效投诉量和监管投诉量。切换时间颗粒度时同步调整横轴和数据聚合方式；超过预警阈值或环比增幅达到20%的周期标记为异常。',value:'及时发现投诉集中上升的时间窗口和监管风险变化，为进一步下钻机构、产品、原因或条线提供线索。',source:'工单编号、客户投诉时间、有效投诉标识、监管转送标识、受理渠道、转送时间。'},
      abnormal:{title:'异常投诉',question:'当前是否存在异常投诉集中增长？',caliber:'统计查询范围内“异常投诉标识＝是”的有效投诉工单，按工单编号去重，并展示异常投诉量、占有效投诉比例及环比变化。',value:'及时识别异常投诉集中增长及可能被滥用的投诉行为，支持业务核验和差异化处置。',source:'工单编号、客户投诉时间、有效投诉标识、异常投诉标识、异常认定原因、核验状态、投诉责任机构。'},
      blackGray:{title:'黑灰产投诉',question:'当前黑灰产投诉风险有多大？',caliber:'统计查询范围内已标记或待核验为黑灰产的有效投诉工单，按工单编号去重，并展示投诉量、占有效投诉比例及环比变化。',value:'掌握代理维权、职业投诉等黑灰产风险规模，合理安排核验资源并支持风险名单管理。',source:'工单编号、客户投诉时间、有效投诉标识、黑灰产投诉标识、核验状态、风险名单命中信息、客户及联系方式。'},
      repeat:{title:'重复投诉',question:'客户问题是否反复发生？',caliber:'统计查询范围内“是否再次投诉＝是”的有效投诉工单，按本次工单编号去重；展示重复投诉量、重复投诉率及环比变化，并通过关联工单追溯首次投诉。',value:'识别首次处理未真正解决的问题，定位重复投诉较多的原因和责任机构，为溯源整改提供依据。',source:'工单编号、客户投诉时间、是否再次投诉、关联工单编号、有效投诉标识、投诉原因、处理结果、投诉责任机构。'},
      distribution:{title:'重点分布',question:'投诉主要集中在哪些机构、产品、原因、条线、渠道和客户？',caliber:'按照当前选择的投诉口径，分别按机构、一级产品、一级投诉原因、业务条线和投诉渠道和客户类型汇总投诉量，降序展示前5项及环比变化；勾选的剔除规则同步作用于分布数据。',value:'快速识别投诉最集中的对象和风险优先级，并进入相应专题分析继续定位具体问题。',source:'工单编号、客户投诉时间、投诉有效性及责任认定、投诉责任机构、产品一级分类、修正投诉原因一级标签、所属业务条线、投诉渠道、客户类型。'},
      rectification:{title:'溯源整改',question:'当前有多少溯源整改单，分别处于什么处理阶段？',caliber:'按当前查询范围统计溯源整改单，按整改单编号去重，展示提问阶段、方案制定阶段、整改阶段、结果审核阶段和已办结数量，并查看具体整改单。',value:'帮助管理层掌握整改任务规模和当前进展，定位仍处于提问、方案制定、整改及结果审核阶段的任务，督促责任机构按计划推进。',source:'整改单编号、问题来源、整改单标题、整改机构、整改业务、整改产品、整改单创建部门、整改开始时间、整改截止时间、计划完成时间、整改单状态。'}
    };

    // 小型说明悬浮窗：优先从信息图标右侧展开，保持所有模块交互一致。
    function CompactInfoPopover({ info, ariaLabel }) {
      return null;
    }

    const EXCLUSION_RULE_DESCRIPTIONS={
      '重复投诉':'经系统重复投诉规则识别，并标记为“重复投诉单”的投诉工单。',
      '再次投诉':'投诉单字段【再次投诉】取值为“是”的工单。',
      '异常投诉':'投诉单已关联异常投诉申请单，且【异常投诉判定】为“是”的工单。',
      '废止投诉':'工单状态为【已废止】的投诉工单。'
    };
    function ExclusionRules({ rules, onChange, testId }) {
      return <div data-testid={testId} className="flex min-w-0 items-center gap-2">
        <strong className="shrink-0 text-sm font-normal text-slate-500">剔除规则</strong>
        <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-0.5">
          {rules.map(rule=><label key={rule.label} className="flex min-w-0 cursor-pointer items-center gap-1 whitespace-nowrap text-[10px] leading-3 text-slate-600">
            <input type="checkbox" checked={rule.checked} ref={el=>{if(el)el.indeterminate=Boolean(rule.partial);}} onChange={event=>onChange(rule.label,event.target.checked)} className="h-3 w-3 shrink-0 accent-violet-600"/>
            <span className="shrink-0">{rule.label}</span><small className="min-w-0 text-[9px] leading-3 text-slate-400">{EXCLUSION_RULE_DESCRIPTIONS[rule.label]}</small>
          </label>)}
        </div>
      </div>;
    }

    // 四个专题分析页共用同一张指标卡，开发视角显示指标说明入口。
    function metricDeveloperInfoEnabled() {
      try {
        return window.parent === window || Boolean(window.parent.document.querySelector('[data-action="reset-demo-data"]'));
      } catch (error) {
        return true;
      }
    }

    const normalizedComparison = value => {
      const raw=String(value??'—').trim();
      if(!raw||raw==='—')return '—';
      const arrowDown=raw.includes('↓');
      let clean=raw.replace(/[↑↓]/g,'').trim();
      const numeric=Number.parseFloat(clean.replace(/,/g,''));
      if(Number.isFinite(numeric)&&!clean.startsWith('+')&&!clean.startsWith('-'))clean=`${arrowDown||numeric<0?'-':'+'}${clean}`;
      return clean;
    };
    function ComparisonValue({ label, value, className='' }) {
      const display=normalizedComparison(value);
      const tone=display.startsWith('+')?'text-rose-500':display.startsWith('-')?'text-emerald-600':'text-slate-500';
      return <span className={`inline-flex items-baseline gap-1 ${className}`}><span className="text-slate-400">{label}</span><b className={`font-medium ${tone}`}>{display}</b></span>;
    }

    function AnalysisMetricCard({ label, value, unit='', detail='', compareLabel='环比', compareValue='—', icon='file', accent='#2272DE', soft='#E9F1FC', info=null, action=null, testId='', highlight=false, compactValue=false, showComparison=true, valueTone='text-slate-900' }) {
      const displayChange=normalizedComparison(compareValue);
      const longValue=String(value).length>10;
      return <article data-testid={testId||undefined} className={`flex min-h-[148px] flex-col rounded-md border p-4 shadow-card ${highlight?'border-[#B9D5F7] bg-[#E9F1FC]':'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md" style={{color:accent,background:soft}}><Icon name={icon} size={16}/></span>
            <span className="truncate text-xs font-medium text-slate-600" title={label}>{label}</span>
          </div>
          {info&&metricDeveloperInfoEnabled()&&<CompactInfoPopover info={info} ariaLabel={`查看${label}说明`}/>}
        </div>
        <div className="mt-3 min-w-0">
          <div className={`${compactValue?'line-clamp-2 text-[20px] leading-6':longValue?'truncate text-3xl':'text-3xl'} font-semibold ${valueTone}`} title={String(value)}>{value}<span className="ml-1 text-xs font-normal text-slate-400">{unit}</span></div>
          {detail&&<div className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{detail}</div>}
        </div>
        <div className="mt-auto flex min-h-5 items-end justify-between gap-3 pt-3">
          <div>{action}</div>
          {showComparison&&<div className="shrink-0 text-right text-[11px]"><ComparisonValue label={compareLabel} value={displayChange}/></div>}
        </div>
      </article>;
    }

    function ProductionMetricCard({ card }) {
      const explain=PRODUCTION_METRIC_EXPLAIN[card.title];
      const info=explain?{title:card.title,question:explain.question,caliber:explain.caliber,value:explain.value,source:explain.source}:null;
      const compareValue=card.delta;
      const detail=[card.valueLabel,card.detailText].filter(Boolean).join(' · ');
      return <AnalysisMetricCard testId="production-card" label={card.title} value={card.value} unit={card.unit} detail={detail} compareLabel={card.deltaLabel} compareValue={compareValue} icon={card.icon} accent={card.accent} soft={card.soft} info={info}/>;
    }

    // 统计机构范围直接读取全局机构字典：一级为总行/分行，二级为本体与下辖支行。
    const STATISTICS_ORG_ORDER=['总行','北京分行','上海分行','厦门分行','福州分行','珠海分行','宁德分行','龙岩分行','泉州分行','漳州分行','莆田分行','三明分行','南平分行'];
    const ORG_SCOPE={
      presets:[
        {key:'all',label:'全行'},
        {key:'big5',label:'五大分行及其下辖',members:['北京分行','上海分行','厦门分行','福州分行','珠海分行']},
        {key:'province',label:'省内分行及其下辖',members:['宁德分行','龙岩分行','泉州分行','漳州分行','莆田分行','三明分行','南平分行']}
      ],
      branches:STATISTICS_ORG_ORDER.filter(name=>name!=='总行')
    };
    const buildStatisticsOrganizationModel=()=>{
      const records=(window.XIB_PROTOTYPE_CONFIG?.organizationTree?.organizations||[]).filter(item=>item.status!=='停用');
      const firstLevel=STATISTICS_ORG_ORDER.map(name=>records.find(item=>item.name===name&&(name==='总行'||item.type==='304903'))).filter(Boolean);
      const subbranches=records.filter(item=>item.type==='304905'&&firstLevel.some(parent=>parent.id===item.parentId));
      const byId=new Map([...records].map(item=>[item.id,item]));
      return{firstLevel,byId,branchesByParent:new Map(firstLevel.map(parent=>[parent.id,subbranches.filter(branch=>branch.parentId===parent.id)]))};
    };
    const devOrgSelectionSummary=selection=>{
      const items=selection?.items||[];
      if(selection?.isAll)return'全行';
      if(!items.length)return'';
      return items.length===1?items[0].tag:`${items[0].tag}等${items.length}项`;
    };
    const selectedOrganizationLabels=selection=>selection?.isAll?buildStatisticsOrganizationModel().firstLevel.map(item=>item.name):(selection?.items||[]).map(item=>item.name||item.tag).filter(Boolean);
    const organizationSeed=(name,salt=0)=>Array.from(String(name||'')).reduce((sum,char)=>sum+char.charCodeAt(0),salt);
    const RISK_CUSTOMER_TYPES=['高龄老人','超高龄老人','未成年','重要客户','新市民','器质性病变','孕妇','宝妈/宝爸','重大手术康复期','其他特殊人士','危重病客户','疑似心理状态异常','法律从业者','行政事业机构人员','金融行业从业者','媒体从业者','教育及人力从业者','警察','低端从业者','无业','男性科研人员','退伍军人'];
    const selectedOrganizationRows=(selection,sourceRows,valueIndex=1)=>{
      const labels=selectedOrganizationLabels(selection);
      if(!labels.length)return[];
      const source=sourceRows||[];
      const maximum=Math.max(1,...source.map(row=>Number(row[valueIndex])||0));
      const rows=labels.map((label,index)=>{
        const item=selection?.items?.[index];
        const matched=source.find(row=>row[0]===label||row[0]===item?.name||row[0]===item?.tag);
        if(matched)return[...matched];
        const value=Math.max(1,Math.round(maximum*(.84-(organizationSeed(label,index)%43)/100)));
        return[label,value,'0%',`${organizationSeed(label,17)%2?'+':'-'}${(3.2+(organizationSeed(label,29)%173)/10).toFixed(1)}%`];
      }).sort((left,right)=>(Number(right[valueIndex])||0)-(Number(left[valueIndex])||0));
      const total=rows.reduce((sum,row)=>sum+(Number(row[valueIndex])||0),0);
      return rows.map(row=>{const next=[...row];if(next.length>2)next[2]=total?`${(Number(next[valueIndex])/total*100).toFixed(1)}%`:'0.0%';return next;});
    };

    const SHORT_TREND_GRANULARITIES=[{key:'day',label:'日'},{key:'week',label:'周'},{key:'month',label:'月'}];
    const LONG_TREND_GRANULARITIES=[{key:'quarter',label:'季度'},{key:'halfYear',label:'半年'},{key:'year',label:'年度'}];
    const statisticsRangeExceedsTwelveMonths=(startDate,endDate)=>{
      if(!startDate||!endDate)return false;
      const start=new Date(`${startDate}T00:00:00`),end=new Date(`${endDate}T00:00:00`);
      if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)return false;
      const threshold=new Date(start);
      threshold.setFullYear(threshold.getFullYear()+1);
      return end>threshold;
    };
    const sampleStatisticsLabels=(labels,maximum=8)=>{
      if(labels.length<=maximum)return labels;
      return Array.from({length:maximum},(_,index)=>labels[Math.round(index*(labels.length-1)/(maximum-1))]);
    };
    const statisticsTrendLabels=(startDate,endDate,granularity)=>{
      const fallbackStart=new Date('2026-07-01T00:00:00'),fallbackEnd=new Date('2026-07-15T00:00:00');
      const parsedStart=startDate?new Date(`${startDate}T00:00:00`):fallbackStart;
      const parsedEnd=endDate?new Date(`${endDate}T00:00:00`):fallbackEnd;
      const start=Number.isNaN(parsedStart.getTime())?fallbackStart:parsedStart;
      const end=Number.isNaN(parsedEnd.getTime())?fallbackEnd:parsedEnd;
      const dayMs=86400000;
      const spanDays=Math.max(1,Math.round((end-start)/dayMs)+1);
      if(granularity==='day')return Array.from({length:Math.max(2,Math.min(31,spanDays))},(_,index)=>{const date=new Date(start.getTime()+index*dayMs);return `${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;});
      if(granularity==='week')return Array.from({length:Math.max(2,Math.ceil(spanDays/7))},(_,index)=>`第${index+1}周`);
      if(granularity==='month')return Array.from({length:6},(_,index)=>`${new Date(end.getFullYear(),end.getMonth()-5+index,1).getMonth()+1}月`);
      const periods=[];
      if(granularity==='quarter'){
        let year=start.getFullYear(),quarter=Math.floor(start.getMonth()/3)+1;
        const endKey=end.getFullYear()*4+Math.floor(end.getMonth()/3);
        while(year*4+quarter-1<=endKey){periods.push(`${year}年Q${quarter}`);quarter+=1;if(quarter===5){quarter=1;year+=1;}}
      }else if(granularity==='halfYear'){
        let year=start.getFullYear(),half=start.getMonth()<6?1:2;
        const endKey=end.getFullYear()*2+(end.getMonth()<6?0:1);
        while(year*2+half-1<=endKey){periods.push(`${year}年${half===1?'上':'下'}半年`);half+=1;if(half===3){half=1;year+=1;}}
      }else{
        for(let year=start.getFullYear();year<=end.getFullYear();year+=1)periods.push(`${year}年`);
      }
      return sampleStatisticsLabels(periods.length>1?periods:[...periods,periods[0]||`${end.getFullYear()}年`]);
    };
    const resampleStatisticsTrend=(source,length,scale=1)=>Array.from({length},(_,index)=>{
      if(length===1)return Math.round(source[source.length-1]*scale);
      const position=index*(source.length-1)/(length-1),left=Math.floor(position),right=Math.min(source.length-1,Math.ceil(position));
      const value=source[left]+(source[right]-source[left])*(position-left);
      return Math.max(0,Math.round(value*scale));
    });

    const quickOrganizationNames={
      '五大分行及其下辖':['北京分行','上海分行','厦门分行','福州分行','珠海分行'],
      '省内分行及其下辖':['宁德分行','龙岩分行','泉州分行','漳州分行','莆田分行','三明分行','南平分行']
    };
    const organizationScopeItem=(kind,parent,item)=>({id:kind==='group'?`group-${parent.id}`:item.id,name:kind==='group'?parent.name:item.name,parentId:parent.id,parentName:parent.name,kind,tag:kind==='group'?`${parent.name}及其所有下辖`:item.name});
    const allOrganizationSelection=()=>{
      const model=buildStatisticsOrganizationModel();
      return{mode:'self',items:model.firstLevel.map(parent=>organizationScopeItem('self',parent,parent)),isAll:true,queryLabel:'全行'};
    };
    const initialOrganizationSelection=(initialOrg,initialBranches=[])=>{
      if(initialOrg==='all'||!initialBranches.length)return allOrganizationSelection();
      const model=buildStatisticsOrganizationModel();
      const items=initialBranches.map(name=>model.firstLevel.find(parent=>parent.name===name)).filter(Boolean).map(parent=>organizationScopeItem('self',parent,parent));
      const selection={mode:'self',items,isAll:false};
      return{...selection,queryLabel:devOrgSelectionSummary(selection)};
    };
    const organizationDimensionsForPage=pageKey=>pageKey==='petition'?['处理机构','信访机构']:['处理机构','投诉机构'];
    const organizationFieldForDimension=(pageKey,dimension)=>dimension==='处理机构'?'工单接收机构':pageKey==='petition'?'信访机构':'投诉机构';
    function OrganizationScopePicker({testId,pageKey,selection,dimension,onDimensionChange,onApply}){
      const model=useMemo(buildStatisticsOrganizationModel,[]);
      const dimensions=organizationDimensionsForPage(pageKey);
      const [open,setOpen]=useState(false);
      const [activeParentId,setActiveParentId]=useState(model.firstLevel[0]?.id||null);
      const [draft,setDraft]=useState(selection||allOrganizationSelection());
      const openPicker=()=>{setDraft(selection||allOrganizationSelection());setOpen(true)};
      const activeParent=model.byId.get(activeParentId)||model.firstLevel[0];
      const children=model.branchesByParent.get(activeParent?.id)||[];
      const hasItem=id=>(draft.items||[]).some(item=>item.id===id);
      const replaceMode=(mode,item)=>setDraft(previous=>{
        const current=previous.mode===mode?(previous.items||[]):[];
        const exists=current.some(value=>value.id===item.id);
        const items=exists?current.filter(value=>value.id!==item.id):[...current,item];
        return{mode,items,isAll:false,queryLabel:''};
      });
      const selectGroup=checked=>checked
        ?replaceMode('group',organizationScopeItem('group',activeParent,activeParent))
        :setDraft({mode:'self',items:[organizationScopeItem('self',activeParent,activeParent)],isAll:false,queryLabel:''});
      const pickShortcut=label=>{
        if(label==='全行'){setDraft(allOrganizationSelection());return;}
        const items=(quickOrganizationNames[label]||[]).map(name=>model.firstLevel.find(parent=>parent.name===name)).filter(Boolean).map(parent=>organizationScopeItem('group',parent,parent));
        setDraft({mode:'group',items,isAll:false,shortcut:label,queryLabel:label});
      };
      const removeDraftItem=id=>setDraft(previous=>{
        const items=(previous.items||[]).filter(item=>item.id!==id);
        return{...previous,items,isAll:false,shortcut:null,queryLabel:''};
      });
      const clearDraft=()=>setDraft({mode:'self',items:[],isAll:false,shortcut:null,queryLabel:''});
      const confirm=()=>{
        if(!draft.isAll&&!(draft.items||[]).length)return;
        const next={...draft,queryLabel:draft.shortcut||devOrgSelectionSummary(draft)};
        onApply(next);setOpen(false);
      };
      return <div className="xib-embed-filter-item xib-embed-org-scope relative">
        <div className="mb-2 text-xs text-slate-500">机构范围</div>
        <button data-testid={testId} type="button" onClick={openPicker} className="di-select is-fluid di-select-trigger xib-embed-inline-select"><span>{selection?.queryLabel||'全行'}</span></button>
        {open&&ReactDOM.createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/25 p-6" onMouseDown={event=>event.target===event.currentTarget&&setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="选择机构范围" data-testid="organization-scope-dialog" className="flex h-[620px] w-full max-w-[780px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="text-lg font-semibold text-slate-900">选择机构范围</h2><button type="button" aria-label="关闭选择机构范围" onClick={()=>setOpen(false)} className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-50"><Icon name="close" size={18}/></button></header>
            <div className="flex min-h-0 flex-1 flex-col p-5">
              <div className="mb-4 flex items-center justify-between gap-4"><div className="flex items-center gap-2"><span className="mr-1 text-xs text-slate-500">快捷筛选</span>{['全行','五大分行及其下辖','省内分行及其下辖'].map(label=><button key={label} type="button" data-quick-scope={label} onClick={()=>pickShortcut(label)} className={`h-8 rounded border px-3 text-xs ${draft.queryLabel===label||draft.shortcut===label?'border-[#2272DE] bg-[#E9F1FC] text-[#165DB5]':'border-slate-200 text-slate-600 hover:border-[#A7C7F2]'}`}>{label}</button>)}</div><div data-testid={`${pageKey}-org-dimension`} className="flex shrink-0 rounded bg-slate-100 p-0.5">{dimensions.map(item=><button key={item} type="button" onClick={()=>onDimensionChange(item)} className={`rounded px-3 py-1.5 text-xs ${dimension===item?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>{item}</button>)}</div></div>
              <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] divide-x divide-slate-200 overflow-hidden rounded-md border border-slate-200">
                <div className="min-h-0 overflow-y-auto py-1">{model.firstLevel.map(parent=><button key={parent.id} type="button" data-org-parent={parent.name} onClick={()=>setActiveParentId(parent.id)} className={`flex h-11 w-full items-center gap-2 px-4 text-left text-sm ${activeParent?.id===parent.id?'bg-[#E9F1FC] font-medium text-[#165DB5]':'text-slate-600 hover:bg-slate-50'}`}><Icon name="building" size={16}/><span>{parent.name}</span><span className="ml-auto text-slate-300">›</span></button>)}</div>
                <div className="min-h-0 overflow-y-auto py-2">
                  <div className="border-b border-slate-100 px-5 pb-2 text-xs font-medium text-slate-400">{activeParent?.name}范围</div>
                  <label className="flex h-11 cursor-pointer items-center gap-3 px-5 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" aria-label={`${activeParent?.name}本体`} checked={draft.mode==='self'&&hasItem(activeParent?.id)} onChange={()=>replaceMode('self',organizationScopeItem('self',activeParent,activeParent))} className="h-4 w-4 accent-[#2272DE]"/><span>{activeParent?.name}（本体）</span></label>
                  {activeParent?.name!=='总行'&&<label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-2 text-sm font-medium text-slate-700"><input type="checkbox" aria-label={`${activeParent?.name}及其所有下辖`} checked={draft.mode==='group'&&hasItem(`group-${activeParent?.id}`)} onChange={event=>selectGroup(event.target.checked)} className="h-4 w-4 accent-[#2272DE]"/><span>{activeParent?.name}及其所有下辖支行</span></label>}
                  {children.map(child=><label key={child.id} className="flex h-10 cursor-pointer items-center gap-3 px-5 pl-8 text-sm text-slate-600 hover:bg-slate-50"><input type="checkbox" aria-label={child.name} checked={draft.mode==='subbranch'&&hasItem(child.id)} onChange={()=>replaceMode('subbranch',organizationScopeItem('subbranch',activeParent,child))} className="h-4 w-4 accent-[#2272DE]"/><span>{child.name}</span></label>)}
                  {!children.length&&activeParent?.name==='总行'&&<div className="px-8 py-5 text-xs text-slate-400">总行仅支持选择本体</div>}
                </div>
              </div>
              <div className="mt-4 flex min-h-[42px] items-start gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><span className="shrink-0 pt-1 text-slate-400">已选</span><div className="flex max-h-[92px] min-w-0 flex-1 flex-wrap gap-2 overflow-y-auto">{(draft.items||[]).map(item=><span key={item.id} className="inline-flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[#165DB5]"><span>{item.tag}</span><button type="button" aria-label={`移除${item.tag}`} onClick={()=>removeDraftItem(item.id)} className="text-base leading-none text-[#2272DE] hover:text-blue-800">×</button></span>)}</div><button type="button" data-clear-organizations onClick={clearDraft} disabled={!(draft.items||[]).length} className="h-7 shrink-0 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-600 hover:border-blue-300 hover:text-[#165DB5] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300">清空</button></div>
            </div>
            <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4"><button type="button" onClick={()=>setOpen(false)} className="h-9 rounded border border-slate-200 px-5 text-sm text-slate-600">取消</button><button type="button" onClick={confirm} disabled={!draft.isAll&&!(draft.items||[]).length} className="h-9 rounded bg-[#2272DE] px-5 text-sm font-medium text-white disabled:bg-slate-300">确认</button></footer>
          </section>
        </div>,getStatisticsPortalRoot())}
      </div>;
    }

    const findSchemaField=(value,name)=>{
      if(!value||typeof value!=='object')return null;
      if(value.name===name)return value;
      const children=Array.isArray(value)?value:Object.values(value);
      for(const child of children){const found=findSchemaField(child,name);if(found)return found;}
      return null;
    };
    const businessLineField=findSchemaField(window.XIB_PROTOTYPE_CONFIG?.formSchema,'所属业务条线');
    const BUSINESS_LINE_OPTIONS=[...(businessLineField?.primaryOptions||[]),...(businessLineField?.optionalOptions||[])];
    const allBusinessLines=()=>[...BUSINESS_LINE_OPTIONS];
    const CUSTOMER_PERSPECTIVE_OPTIONS=['高龄老人','超高龄老人','未成年','重要客户','新市民','器质性病变','孕妇','宝妈/宝爸','重大手术康复期','其他特殊人士','危重病客户','疑似心理状态异常','法律从业者','行政事业机构人员','金融行业从业者','媒体从业者','教育及人力从业者','警察','低端从业者','无业','男性科研人员','退伍军人'];
    const perspectiveTop5Rows=(options,base=720)=>{
      const source=(options||[]).map((name,index)=>[name,Math.max(36,base-index*29+(organizationSeed(name,index)%23))]);
      const total=Math.max(1,source.reduce((sum,row)=>sum+row[1],0));
      return source.sort((left,right)=>right[1]-left[1]).slice(0,5).map(row=>[row[0],row[1],`${(row[1]/total*100).toFixed(1)}%`]);
    };

    function BusinessLineMultiSelect({testId,value,onChange}){
      const [open,setOpen]=useState(false);
      const [draft,setDraft]=useState(value);
      const openPicker=()=>{setDraft(value);setOpen(true)};
      const toggle=line=>setDraft(previous=>previous.includes(line)?previous.filter(item=>item!==line):[...previous,line]);
      const label=value.length===BUSINESS_LINE_OPTIONS.length?'全部条线':value.length?`已选 ${value.length} 项`:'未选择条线';
      return <div className="xib-embed-filter-item xib-embed-line-scope relative">
        <div className="mb-2 text-xs text-slate-500">条线范围</div>
        <button type="button" data-testid={testId} onClick={openPicker} className="di-select is-fluid di-select-trigger xib-embed-inline-select"><span>{label}</span></button>
        {open&&<><button type="button" aria-label="关闭条线范围" className="fixed inset-0 z-30 cursor-default" onClick={()=>setOpen(false)}/><div className="absolute left-0 top-[64px] z-40 w-[300px] rounded-md border border-slate-200 bg-white p-2 shadow-xl">
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><input type="checkbox" aria-label="全部条线" checked={draft.length===BUSINESS_LINE_OPTIONS.length} ref={node=>{if(node)node.indeterminate=draft.length>0&&draft.length<BUSINESS_LINE_OPTIONS.length}} onChange={event=>setDraft(event.target.checked?allBusinessLines():[])} className="h-4 w-4 accent-[#2272DE]"/>全部条线</label>
          <div className="my-1 border-t border-slate-100"/><div className="max-h-64 overflow-y-auto">{BUSINESS_LINE_OPTIONS.map(line=><label key={line} className="flex h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm text-slate-600 hover:bg-slate-50"><input type="checkbox" aria-label={line} checked={draft.includes(line)} onChange={()=>toggle(line)} className="h-4 w-4 accent-[#2272DE]"/><span>{line}</span></label>)}</div>
          <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-2"><button type="button" onClick={()=>setOpen(false)} className="h-8 rounded border border-slate-200 px-3 text-xs text-slate-600">取消</button><button type="button" data-line-confirm onClick={()=>{onChange(draft);setOpen(false)}} className="h-8 rounded bg-[#2272DE] px-3 text-xs font-medium text-white">确定</button></div>
        </div></>}
      </div>;
    }

    function ReportOrganizationMultiSelect({value,onChange}){
      const options=['全行','总行',...ORG_SCOPE.branches];
      const [open,setOpen]=useState(false);
      const [draft,setDraft]=useState(value);
      const openPicker=()=>{setDraft(value);setOpen(true)};
      const toggle=organization=>setDraft(previous=>previous.includes(organization)?previous.filter(item=>item!==organization):[...previous,organization]);
      const allSelected=draft.length===options.length;
      const label=value.length===options.length?'全选':value.length===1?value[0]:value.length?`已选 ${value.length} 项`:'未选择机构';
      return <div className="relative">
        <span className="mb-2 block text-xs text-slate-500">机构范围</span>
        <button type="button" data-testid="report-org-scope" aria-expanded={open} onClick={openPicker} className="di-select is-fluid di-select-trigger h-10 w-full text-sm"><span>{label}</span></button>
        {open&&<><button type="button" aria-label="关闭报告机构范围" className="fixed inset-0 z-30 cursor-default" onClick={()=>setOpen(false)}/><div className="absolute left-0 top-[64px] z-40 w-[320px] rounded-md border border-slate-200 bg-white p-2 shadow-xl">
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><input type="checkbox" aria-label="全选" checked={allSelected} ref={node=>{if(node)node.indeterminate=draft.length>0&&!allSelected}} onChange={event=>setDraft(event.target.checked?[...options]:[])} className="h-4 w-4 accent-[#2272DE]"/>全选</label>
          <div className="my-1 border-t border-slate-100"/><div className="max-h-64 overflow-y-auto">{options.map(organization=><label key={organization} className="flex h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm text-slate-600 hover:bg-slate-50"><input type="checkbox" aria-label={organization} checked={draft.includes(organization)} onChange={()=>toggle(organization)} className="h-4 w-4 accent-[#2272DE]"/><span>{organization}</span></label>)}</div>
          <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-2"><button type="button" onClick={()=>setOpen(false)} className="h-8 rounded border border-slate-200 px-3 text-xs text-slate-600">取消</button><button type="button" data-report-org-confirm disabled={!draft.length} onClick={()=>{onChange(draft);setOpen(false)}} className="h-8 rounded bg-[#2272DE] px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300">确定</button></div>
        </div></>}
      </div>;
    }

    // 五大分析页共用的投诉查询条件，避免各页口径和交互不一致。
    function ComplaintAnalysisFilters({ pageKey, initialFilter=null, initialOrg='all', initialBranches=[], initialCompare='环比', startDate='2026-07-01', endDate='2026-07-15', onStartDateChange, onEndDateChange, onOrgChange, onFilterChange, onQuery, auxiliaryControls=null, hideChannel=false, hideCaliber=false, hideExclusions=false, autoCollapseOnScroll=false }) {
      const [devOrgSelection,setDevOrgSelection]=useState(()=>initialFilter?.orgSelection||initialOrganizationSelection(initialOrg,initialBranches));
      const [businessLines,setBusinessLines]=useState(()=>initialFilter?.lineSelection||allBusinessLines());
      const [localStart,setLocalStart]=useState(startDate);
      const [localEnd,setLocalEnd]=useState(endDate);
      const [channel,setChannel]=useState(initialFilter?.channel??'全部渠道');
      const [caliber,setCaliber]=useState(initialFilter?.caliber??'全部受理');
      const [compare,setCompare]=useState(initialFilter?.compare??initialCompare);
      const [organizationDimension,setOrganizationDimension]=useState(initialFilter?.organizationDimension??'处理机构');
      const [excludeDup,setExcludeDup]=useState(()=>initialFilter?.excluded?initialFilter.excluded.includes('重复投诉'):true);
      const [excludeAgain,setExcludeAgain]=useState(()=>initialFilter?.excluded?initialFilter.excluded.includes('再次投诉'):true);
      const [excludeAbnormal,setExcludeAbnormal]=useState(()=>initialFilter?.excluded?initialFilter.excluded.includes('异常投诉'):true);
      const [excludeVoid,setExcludeVoid]=useState(()=>initialFilter?.excluded?initialFilter.excluded.includes('废止投诉'):true);
      const [filtersCollapsed,setFiltersCollapsed]=useState(false);
      React.useEffect(()=>{
        if(!autoCollapseOnScroll)return;
        const scrollTarget=getStatisticsRoot();
        if(!scrollTarget)return;
        const handleScroll=()=>setFiltersCollapsed(scrollTarget.scrollTop>24);
        handleScroll();
        scrollTarget.addEventListener('scroll',handleScroll,{passive:true});
        return()=>scrollTarget.removeEventListener('scroll',handleScroll);
      },[autoCollapseOnScroll]);
      React.useEffect(()=>{
        if(!filtersCollapsed) return;
        const scrollTarget=getStatisticsRoot();
        let armed = (scrollTarget?.scrollTop||window.scrollY) > 8;
        const handleScroll = () => {
          const scrollTop=scrollTarget?.scrollTop||window.scrollY;
          if(scrollTop > 8) armed = true;
          else if(armed) setFiltersCollapsed(false);
        };
        scrollTarget?.addEventListener('scroll',handleScroll,{passive:true});
        window.addEventListener('scroll', handleScroll, { passive:true });
        return () => {
          scrollTarget?.removeEventListener('scroll',handleScroll);
          window.removeEventListener('scroll', handleScroll);
        };
      },[filtersCollapsed]);
      const changeStart=value=>{setLocalStart(value);onStartDateChange&&onStartDateChange(value)};
      const changeEnd=value=>{setLocalEnd(value);onEndDateChange&&onEndDateChange(value)};
      const reset=()=>{const allOrg=allOrganizationSelection();const allLines=allBusinessLines();setDevOrgSelection(allOrg);setBusinessLines(allLines);changeStart('2026-07-01');changeEnd('2026-07-15');setChannel('全部渠道');setCaliber('全部受理');setCompare('环比');setOrganizationDimension('处理机构');setExcludeDup(true);setExcludeAgain(true);setExcludeAbnormal(true);setExcludeVoid(true);onOrgChange&&onOrgChange('全行',allOrg);onFilterChange&&onFilterChange({org:'全行',orgSelection:allOrg,lineSelection:allLines,channel:'全部渠道',caliber:'全部受理',compare:'环比',organizationDimension:'处理机构',organizationField:'工单接收机构',excluded:['重复投诉','再次投诉','异常投诉','废止投诉']})};
      // 机构范围和已选机构是所有统计页的共同筛选状态。确认机构选择后立即
      // 下发完整选择对象，页面不得仅以查询栏的展示文本重新推断统计范围。
      const applyDevOrg=scope=>{setDevOrgSelection(scope);onOrgChange&&onOrgChange(scope.queryLabel,scope);onFilterChange&&onFilterChange({org:scope.queryLabel,orgSelection:scope});};
      const changeOrganizationDimension=dimension=>{const organizationField=organizationFieldForDimension(pageKey,dimension);setOrganizationDimension(dimension);onFilterChange&&onFilterChange({organizationDimension:dimension,organizationField});};
      const excluded=[excludeDup&&'重复投诉',excludeAgain&&'再次投诉',excludeAbnormal&&'异常投诉',excludeVoid&&'废止投诉'].filter(Boolean);
      // 渠道、口径、对比方式和剔除规则切换后立即通知页面，指标无需再次点击“查询”。
      const changeExcluded=(label,checked,setter)=>{
        const next=excluded.filter(item=>item!==label);
        if(label==='重复投诉'){setExcludeDup(checked);setExcludeAgain(checked);if(checked){next.push('重复投诉');if(!next.includes('再次投诉'))next.push('再次投诉');}}
        else if(label==='再次投诉'){setExcludeAgain(checked);if(!checked){setExcludeDup(false);const idx=next.indexOf('重复投诉');if(idx>=0)next.splice(idx,1);}else{next.push('再次投诉');}}
        else{setter(checked);if(checked)next.push(label);}
        onFilterChange&&onFilterChange({excluded:next});
      };
      return <section data-testid={`${pageKey}-shared-filters`} className="xib-embed-filter-panel xib-sticky-filter sticky top-[72px] z-30 mb-4 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
        <div className={"xib-embed-filter-grid " + (hideChannel&&hideCaliber ? "is-compact " : "") + (filtersCollapsed ? "is-collapsed" : "")}>
          <OrganizationScopePicker testId={`${pageKey}-org-scope`} pageKey={pageKey} selection={devOrgSelection} dimension={organizationDimension} onDimensionChange={changeOrganizationDimension} onApply={applyDevOrg}/>
          <BusinessLineMultiSelect testId={`${pageKey}-line-scope`} value={businessLines} onChange={value=>{setBusinessLines(value);onFilterChange&&onFilterChange({lineSelection:value})}}/>
          <div className="xib-embed-filter-item xib-embed-date-range"><div>统计日期</div><div className="xib-embed-date-range-controls"><input aria-label={`${pageKey}开始日期`} type="date" value={localStart} onChange={e=>changeStart(e.target.value)}/><span className="xib-embed-date-range-separator">至</span><input aria-label={`${pageKey}结束日期`} type="date" value={localEnd} onChange={e=>changeEnd(e.target.value)}/></div></div>
          {!hideChannel&&<label className="xib-embed-filter-item xib-embed-channel"><div className="mb-2 text-xs text-slate-500">投诉渠道</div><select value={channel} onChange={e=>{const value=e.target.value;setChannel(value);onFilterChange&&onFilterChange({channel:value})}} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400"><option>全部渠道</option><option>监管转送</option><option>自收投诉</option></select></label>}
          {!hideCaliber&&<label className="xib-embed-filter-item xib-embed-caliber"><div className="mb-2 text-xs text-slate-500">投诉口径</div><select value={caliber} onChange={e=>{const value=e.target.value;setCaliber(value);onFilterChange&&onFilterChange({caliber:value})}} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400"><option>全部受理</option><option>有效投诉</option><option>有责投诉</option></select></label>}
          <div className="xib-embed-filter-actions flex justify-end gap-2"><button onClick={reset} className="h-10 rounded-md border border-slate-200 px-5 text-sm text-slate-600 hover:bg-slate-50">重置</button><button onClick={()=>onQuery&&onQuery({org:devOrgSelection.queryLabel,orgSelection:devOrgSelection,lineSelection:businessLines,startDate:localStart,endDate:localEnd,channel,caliber,compare,organizationDimension,organizationField:organizationFieldForDimension(pageKey,organizationDimension),excluded})} className="h-10 rounded-md bg-violet-600 px-6 text-sm font-medium text-white hover:bg-violet-700">查询</button></div>
        </div>
        <div className={"xib-embed-filter-conditions mt-3 flex items-center justify-between text-[11px] text-slate-400 " + (filtersCollapsed ? "is-collapsed" : "border-t border-slate-100 pt-3")}> <div className="flex min-w-0 items-center gap-4">{pageKey==='channel'&&auxiliaryControls}<div className="flex shrink-0 rounded bg-slate-100 p-0.5">{['环比','同比'].map(item=><button key={item} onClick={()=>{setCompare(item);onFilterChange&&onFilterChange({compare:item})}} className={`rounded px-2.5 py-1 text-[11px] ${compare===item?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>{item}</button>)}</div>{!hideExclusions&&<ExclusionRules testId={`${pageKey}-exclude-rules`} rules={[{checked:excludeDup,label:'重复投诉',partial:!excludeDup&&excludeAgain},{checked:excludeAgain,label:'再次投诉'},{checked:excludeAbnormal,label:'异常投诉'},{checked:excludeVoid,label:'废止投诉'}]} onChange={(label,checked)=>changeExcluded(label,checked,label==='异常投诉'?setExcludeAbnormal:setExcludeVoid)}/>}</div><div className="flex shrink-0 items-center justify-end gap-2">{pageKey==='institution'&&auxiliaryControls}<button type="button" className="xib-filter-collapse-btn" aria-label={filtersCollapsed?'展开筛选':'收起筛选'} title={filtersCollapsed?'展开筛选':'收起筛选'} onClick={()=>setFiltersCollapsed(v=>!v)}><svg className={"xib-filter-collapse-icon " + (filtersCollapsed ? "is-collapsed" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button></div></div>
      </section>;
    }

    // 统计页共用的筛选规则。原型数据按同一套查询状态重算，避免不同图表
    // 各自保留一份与筛选无关的固定数字。
    const DEFAULT_LINKED_FILTER = {channel:'全部渠道',caliber:'全部受理',compare:'环比',organizationDimension:'处理机构',organizationField:'工单接收机构',lineSelection:allBusinessLines(),excluded:['重复投诉','再次投诉','异常投诉','废止投诉']};
    const linkedAnalysisFactor = (filter,startDate,endDate,org='全行') => {
      // 当前演示数据仅覆盖 2026-07-01 至 2026-07-15；查询区间完全不相交时
      // 必须返回 0，由调用方展示“暂无数据”。
      if (endDate < '2026-07-01' || startDate > '2026-07-15') return 0;
      const days=Math.max(1,Math.round((new Date(endDate)-new Date(startDate))/86400000)+1);
      const dateFactor=Math.min(2,Math.max(.15,days/15));
      const channelFactor=filter.channel==='监管转送'?.103:filter.channel==='自收投诉'?.897:1;
      const caliberFactor=filter.caliber==='有效投诉'?.943:filter.caliber==='有责投诉'?.66:1;
      const exclusionFactor=(filter.excluded.includes('重复投诉')?0.977:filter.excluded.includes('再次投诉')?0.99:1)*(filter.excluded.includes('异常投诉')?.995:1)*(filter.excluded.includes('废止投诉')?.998:1);
      const selection=filter?.orgSelection;
      const orgFactor=selection
        ? (selection.isAll ? 1 : Math.min(1, Math.max(.012, (selection.items||[]).length * (selection.granularity==='一级分行' ? .08 : selection.granularity==='支行' ? .035 : .012))))
        : (org==='全行'?1:.18);
      const lineFactor=Math.max(0,Math.min(1,(filter.lineSelection||BUSINESS_LINE_OPTIONS).length/Math.max(1,BUSINESS_LINE_OPTIONS.length)));
      const organizationFieldFactor=filter.organizationField==='投诉机构'?.92:filter.organizationField==='信访机构'?.88:1;
      return dateFactor*channelFactor*caliberFactor*exclusionFactor*orgFactor*lineFactor*organizationFieldFactor;
    };
    const linkedFilterSummary = () => '';
    const statisticsContextText = () => '';
        const scaleLinkedCount = (value,factor) => Math.max(0,Math.round(Number(value||0)*factor));

    const csvCell=value=>`"${String(value??'').replace(/"/g,'""')}"`;
    const downloadCsv=(filename,headers,rows)=>{
      if(!rows.length)return;
      const csv=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\n');
      const link=document.createElement('a');
      link.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
      link.download=filename;
      link.click();
      URL.revokeObjectURL(link.href);
    };
    const useSelectableRows=(rows,getId)=>{
      const ids=rows.map(getId);
      const idsKey=ids.join('|');
      const [selectedIds,setSelectedIds]=useState([]);
      React.useEffect(()=>setSelectedIds(current=>current.filter(id=>ids.includes(id))),[idsKey]);
      const selectedSet=new Set(selectedIds);
      const allSelected=ids.length>0&&ids.every(id=>selectedSet.has(id));
      const toggle=(id,checked)=>setSelectedIds(current=>checked?[...new Set([...current,id])]:current.filter(item=>item!==id));
      const toggleAll=checked=>setSelectedIds(checked?ids:[]);
      return {selectedSet,selectedRows:rows.filter(row=>selectedSet.has(getId(row))),allSelected,toggle,toggleAll};
    };
    const SelectionCheckbox=({checked,onChange,ariaLabel,testId})=><input type="checkbox" data-testid={testId} checked={checked} onChange={event=>onChange(event.target.checked)} onClick={event=>event.stopPropagation()} aria-label={ariaLabel} className="h-4 w-4 shrink-0 cursor-pointer accent-violet-600"/>;
    const SelectableHeader=({label,selection,testId})=><span className="flex items-center gap-3 whitespace-nowrap"><SelectionCheckbox testId={testId} checked={selection.allSelected} onChange={selection.toggleAll} ariaLabel={`全选${label}`}/><span>{label}</span></span>;
    const SelectableIdCell=({id,selection,testId,onOpen})=><span className="flex min-w-0 items-center gap-3"><SelectionCheckbox testId={testId} checked={selection.selectedSet.has(id)} onChange={checked=>selection.toggle(id,checked)} ariaLabel={`选择工单${id}`}/><button type="button" onClick={()=>onOpen&&onOpen(id)} className="truncate whitespace-nowrap text-left font-medium text-violet-600 hover:underline focus:underline">{id}</button></span>;

    function ProductionOverviewPage({ onNavigate }) {
      // 当前登录人为总行消保管理员，因此系统直接加载其有权查看的全行范围。
      const overview = OVERVIEW2_DATA.headOffice;
      const [distributionView,setDistributionView]=useState('机构');
      const [selectedOrg,setSelectedOrg]=useState('全行');
      const [devOrgSelection,setDevOrgSelection]=useState(allOrganizationSelection());
      const [overviewOrganizationDimension,setOverviewOrganizationDimension]=useState('处理机构');
      const [overviewOrganizationField,setOverviewOrganizationField]=useState('工单接收机构');
      const [businessLines,setBusinessLines]=useState(allBusinessLines());
      const [startDate,setStartDate]=useState('2026-07-01');
      const [endDate,setEndDate]=useState('2026-07-15');
      const [complaintChannel,setComplaintChannel]=useState('全部渠道');
      const [complaintCaliber,setComplaintCaliber]=useState('全部受理');
      // 剔除规则属数据清洗，与基础口径分离，默认全部剔除。
      const [excludeDup,setExcludeDup]=useState(true);
      const [excludeAgain,setExcludeAgain]=useState(true);
      const [excludeAbnormal,setExcludeAbnormal]=useState(true);
      const [excludeVoid,setExcludeVoid]=useState(true);
      const [compareMode,setCompareMode]=useState('环比');
      const [filtersCollapsed,setFiltersCollapsed]=useState(false);
      React.useEffect(()=>{
        if(!filtersCollapsed) return;
        let armed = window.scrollY > 8;
        const handleScroll = () => {
          if(window.scrollY > 8) armed = true;
          else if(armed) setFiltersCollapsed(false);
        };
        window.addEventListener('scroll', handleScroll, { passive:true });
        return () => window.removeEventListener('scroll', handleScroll);
      },[filtersCollapsed]);
      // 各卡片的同/环比变化，随对比方式切换。
      const OV_DELTA={投诉规模:{环比:'6.8%',同比:'12.3%'},监管压力:{环比:'4.2%',同比:'9.6%'},自收投诉:{环比:'7.1%',同比:'12.6%'},'重复投诉量':{环比:'-3.1%',同比:'5.4%'},'异常/黑灰产投诉量':{环比:'11.5%',同比:'18.2%'},'与客户达成一致率':{环比:'0.6%',同比:'1.8%'}};
      // 5 张指标卡与检索条件联动：机构范围/渠道/口径/剔除规则共同决定分子。
      const OV_BASE={received:13240,valid:12486,responsible:8210,regulatoryReceived:1368,regulatory:1286,regulatoryResponsible:846,keyReg:28,repeat:286,repeatRate:2.29,highFreq:12,abnormalAll:64,abnormal:41,black:23};
      const scopeFactor=React.useMemo(()=>{
        const fieldFactor=overviewOrganizationField==='投诉机构'?.92:1;
        if(devOrgSelection.isAll)return fieldFactor;
        const count=(devOrgSelection.items||[]).length;
        const unit=devOrgSelection.mode==='subbranch'?.035:.08;
        return Math.min(1,Math.max(0,count*unit))*fieldFactor;
      },[devOrgSelection,overviewOrganizationField]);
      const excludeFactor=(excludeDup?0.9771:excludeAgain?0.99:1)*(excludeAbnormal?0.9967:1)*(excludeVoid?0.994:1);
      const caliberBase=complaintCaliber==='有效投诉'?OV_BASE.valid:complaintCaliber==='有责投诉'?OV_BASE.responsible:OV_BASE.received;
      const regulatoryBase=complaintCaliber==='有效投诉'?OV_BASE.regulatory:complaintCaliber==='有责投诉'?OV_BASE.regulatoryResponsible:OV_BASE.regulatoryReceived;
      const caliberLabel=complaintCaliber==='全部受理'?'受理':complaintCaliber.replace('投诉','');
      const totalMetricLabel=complaintCaliber==='全部受理'?'受理投诉总量':complaintCaliber==='有效投诉'?'有效投诉总量':'有责投诉总量';
      // 仅前两张卡（投诉规模、监管压力）随投诉渠道联动；其余指标与渠道无关。
      const lineFactor=businessLines.length/Math.max(1,BUSINESS_LINE_OPTIONS.length);
      const f=scopeFactor*excludeFactor*lineFactor;
      const fmtN=v=>Math.round(v).toLocaleString();
      const cards=React.useMemo(()=>{
        const b=overview.cards;
        // 前置渠道条件决定首张业务指标：全部看规模、监管看监管压力、自收看自收投诉。
        const allValue=caliberBase*scopeFactor*excludeFactor*lineFactor;
        const regValue=regulatoryBase*scopeFactor*excludeFactor*lineFactor;
        const selfValue=(caliberBase-regulatoryBase)*scopeFactor*excludeFactor*lineFactor;
        const deltaOf=(title,muted)=>{
          const raw=(OV_DELTA[title]||{})[compareMode]||'0.0%';
          return{deltaLabel:compareMode,delta:muted?'—':raw};
        };
        const excludedRuleNames=[excludeDup&&'重复投诉',excludeAgain&&'再次投诉',excludeAbnormal&&'异常投诉',excludeVoid&&'废止投诉'].filter(Boolean);
        const specialValue=OV_BASE.abnormalAll*scopeFactor*lineFactor;
        const specialShare=allValue>0?specialValue/allValue*100:0;
        const channelCardBase=complaintChannel==='监管转送'
          ? {...b.regulatory,value:fmtN(regValue),valueLabel:`${caliberLabel}监管投诉量`,...deltaOf('监管压力',regValue===0)}
          : complaintChannel==='自收投诉'
            ? {...b.regulatory,title:'自收投诉',eyebrow:'本行自收',valueLabel:`${caliberLabel}自收投诉量`,value:fmtN(selfValue),...deltaOf('自收投诉',selfValue===0)}
            : {...b.scale,value:fmtN(allValue),valueLabel:totalMetricLabel,...deltaOf('投诉规模',scopeFactor===0)};
        const channelCard={...channelCardBase,detailText:excludedRuleNames.length?`已剔除：${excludedRuleNames.join('、')}`:undefined};
        return [
          channelCard,
          {...b.repeat,value:fmtN(OV_BASE.repeat*scopeFactor*lineFactor),valueLabel:'',...deltaOf('重复投诉量',false)},
          {...b.special,value:fmtN(specialValue),unit:`件 · 占比 ${specialShare.toFixed(1)}%`,valueLabel:'',detailText:`异常投诉 ${fmtN(OV_BASE.abnormal*scopeFactor*lineFactor)} 件 · 黑灰产投诉 ${fmtN(OV_BASE.black*scopeFactor*lineFactor)} 件`,...deltaOf('异常/黑灰产投诉量',false)},
          {...b.quality,...deltaOf('与客户达成一致率',false)}
        ];
      },[complaintChannel,complaintCaliber,caliberBase,regulatoryBase,caliberLabel,totalMetricLabel,excludeDup,excludeAbnormal,excludeVoid,compareMode,scopeFactor,excludeFactor,lineFactor,f,overview]);
      const [trendGranularity,setTrendGranularity]=useState('日');
      const useLongTrendGranularity=statisticsRangeExceedsTwelveMonths(startDate,endDate);
      const overviewTrendGranularities=useLongTrendGranularity?LONG_TREND_GRANULARITIES:SHORT_TREND_GRANULARITIES;
      React.useEffect(()=>{
        const activeKey=overviewTrendGranularities.find(option=>option.label===trendGranularity)?.key;
        if(!activeKey)setTrendGranularity(useLongTrendGranularity?'季度':'日');
      },[useLongTrendGranularity]);
      const [activeTrendIndex,setActiveTrendIndex]=useState(null);
      const [rectificationDetail,setRectificationDetail]=useState(null);
      const [rectificationPage,setRectificationPage]=useState(1);
      const resetOverviewFilters=()=>{
        setSelectedOrg('全行');
        setDevOrgSelection(allOrganizationSelection());
        setOverviewOrganizationDimension('处理机构');
        setOverviewOrganizationField('工单接收机构');
        setBusinessLines(allBusinessLines());
        setStartDate('2026-07-01');
        setEndDate('2026-07-15');
        setComplaintChannel('全部渠道');
        setComplaintCaliber('全部受理');
        setExcludeDup(true);
        setExcludeAgain(true);
        setExcludeAbnormal(true);
        setExcludeVoid(true);
        setCompareMode('环比');
      };
      const toggleOverviewExclusion=(label,checked,setter)=>{
        if (label === '重复投诉') { setExcludeDup(checked); setExcludeAgain(checked); }
        else if (label === '再次投诉') { setExcludeAgain(checked); if (!checked) setExcludeDup(false); }
        else setter(checked);
      };
      // 趋势图与查询条件使用同一统计范围：机构、日期、渠道、口径和剔除规则均参与计算。
      const trendDays=React.useMemo(()=>{
        const labels=statisticsTrendLabels(startDate,endDate,'day');
        if(labels.length<=8)return labels;
        return Array.from({length:8},(_,index)=>labels[Math.round(index*(labels.length-1)/7)]);
      },[startDate,endDate]);
      const effectiveTrend=[386,412,398,468,442,526,486,558];
      const regulatoryTrend=[36,42,38,56,48,68,61,76];
      const longTrendSeries=LONG_TREND_GRANULARITIES.reduce((result,option)=>{
        const labels=statisticsTrendLabels(startDate,endDate,option.key);
        const scale=option.key==='quarter'?18:option.key==='halfYear'?36:72;
        result[option.label]={labels,effective:resampleStatisticsTrend(effectiveTrend,labels.length,scale),regulatory:resampleStatisticsTrend(regulatoryTrend,labels.length,scale)};
        return result;
      },{});
      const trendSeriesBase={
        '日':{labels:trendDays,effective:effectiveTrend,regulatory:regulatoryTrend},
        '周':{labels:['6月第2周','6月第3周','6月第4周','7月第1周','7月第2周','7月第3周'],effective:[2386,2498,2416,2686,2928,3184],regulatory:[226,248,236,286,328,396]},
        '月':{labels:['2月','3月','4月','5月','6月','7月'],effective:[8468,8926,9148,9686,10328,11286],regulatory:[786,842,896,928,1086,1286]},
        ...longTrendSeries
      };
      const baseTrend=trendSeriesBase[trendGranularity]||trendSeriesBase[useLongTrendGranularity?'季度':'日'];
      const totalTrendFactor=scopeFactor*excludeFactor*lineFactor*(caliberBase/OV_BASE.valid);
      const regulatoryTrendFactor=scopeFactor*excludeFactor*(regulatoryBase/OV_BASE.regulatory);
      const totalTrend=baseTrend.effective.map(v=>Math.max(0,Math.round(v*totalTrendFactor)));
      const filteredRegulatoryTrend=baseTrend.regulatory.map(v=>Math.max(0,Math.round(v*regulatoryTrendFactor)));
      const selfTrend=totalTrend.map((v,i)=>Math.max(0,v-filteredRegulatoryTrend[i]));
      const showRegulatorySeries=complaintChannel!=='自收投诉';
      const showSelfSeries=complaintChannel!=='监管转送';
      // 左轴和右轴固定表达投诉渠道；投诉口径仅作为两条曲线的数据筛选范围。
      const activeTrend={labels:baseTrend.labels,effective:filteredRegulatoryTrend,regulatory:selfTrend};
      const effectiveMax=Math.max(100,Math.ceil(Math.max(...activeTrend.effective)*1.12/100)*100);
      const regulatoryMax=Math.max(100,Math.ceil(Math.max(...activeTrend.regulatory)*1.12/100)*100);
      const trendX=index=>80+(index*840)/Math.max(activeTrend.labels.length-1,1);
      const effectiveY=value=>220-(value/effectiveMax)*190;
      const regulatoryY=value=>220-(value/regulatoryMax)*190;
      const distributionData={
        '机构':[['厦门分行',836,'18.6%','+12.4%'],['上海分行',742,'16.5%','+8.6%'],['福州分行',691,'15.4%','+15.2%'],['北京分行',628,'14.0%','-3.1%'],['宁德分行',584,'13.0%','+6.8%']],
        '产品':[['贷款',1526,'17.7%','+12.6%'],['存款',1286,'14.9%','+5.4%'],['财富管理',968,'11.2%','-2.8%'],['支付结算',786,'9.1%','+9.6%'],['电子银行',642,'7.4%','+6.8%']],
        '原因':[['收费争议',1860,'19.5%','+18.6%'],['业务规则告知不清',1512,'15.8%','+12.4%'],['办理时效',1286,'13.5%','+21.3%'],['营销宣传争议',1034,'10.8%','+9.7%'],['功能与系统异常',824,'8.6%','+15.2%']],
        '条线':[['零售金融部',2368,'26.7%','+16.8%'],['普惠金融部',1986,'22.4%','+21.3%'],['公司金融部',1352,'15.3%','-2.8%'],['运营管理部',1046,'11.8%','+14.6%'],['风险管理部',864,'9.8%','+8.7%'],['特殊资产经营部',716,'8.1%','+18.2%'],['消费者权益保护部',528,'6.0%','+6.4%'],['安全保卫部/总务部',486,'5.5%','+5.8%'],['授信审批部',422,'4.8%','-1.9%'],['科技管理部',396,'4.5%','+12.6%'],['华侨金融部',286,'3.2%','+3.9%'],['科技开发部',224,'2.5%','+11.2%'],['科技运维部',198,'2.2%','+8.1%']],
        '客户':[['无风险客户',9765,'78.2%','+5.6%'],['高龄老人',986,'7.9%','+12.4%'],['超高龄老人',512,'4.1%','+9.8%'],['未成年',462,'3.7%','-2.1%'],['重要客户',400,'3.2%','+6.7%'],['新市民',350,'2.8%','+15.3%']],
        '渠道':[['金融消费者保护服务平台',4862,'38.9%','+12.6%'],['客服电话',2628,'21.0%','+4.8%'],['营业网点',1486,'11.9%','+8.2%'],['厦门金管局',786,'6.3%','+15.4%'],['在线客服',742,'5.9%','-3.1%']]
      };
      const distributionRoutes={'机构':'institution2','产品':'product','原因':'reason','条线':'line','渠道':'channel','客户':'customer'};
      const distributionMetricLabel='投诉量';
      const distributionFactor=scopeFactor*excludeFactor*lineFactor*(caliberBase/OV_BASE.valid);
      const selectedOverviewInstitutions=selectedOrganizationRows(devOrgSelection,distributionData.机构);
      const selectedOverviewLines=distributionData.条线.filter(item=>businessLines.includes(item[0]));
      const currentDistributionSource=distributionView==='机构'?selectedOverviewInstitutions:distributionView==='条线'?selectedOverviewLines:distributionData[distributionView];
      const distributionLimit=distributionView==='机构'||distributionView==='条线'?5:Infinity;
      const currentDistributionRows=currentDistributionSource.map(item=>[item[0],Math.max(0,Math.round(item[1]*distributionFactor)),item[3]]).sort((left,right)=>right[1]-left[1]).slice(0,distributionLimit);
      const distributionPeak=Math.max(...currentDistributionRows.map(item=>item[1]),1);
      const riskItems=[
        {title:'即将超期',value:28,unit:'件',note:'剩余办理时间≤24小时',tone:'amber'},
        {title:'已超期',value:12,unit:'件',note:'需立即协调责任机构处理',tone:'rose'},
        {title:'重点监管',value:16,unit:'件',note:'监管转送且风险等级较高',tone:'violet'},
        {title:'待核验黑灰产',value:9,unit:'件',note:'命中疑似黑灰产识别规则',tone:'slate'}
      ];
      const rectificationSeeds=[
        ['INC-2026-004521','投诉问题','年费问题整改','北京西直门支行','消费者权益保护部 / 人民币储蓄','总行消保办公室','2026-07-10','2026-07-31','2026-07-28','待处理'],
        ['INC-2026-004522','上级指示','贷款流程优化','厦门分行','零售金融部 / 个人贷款','总行零售金融部','2026-07-08','2026-08-05','2026-08-01','处理中'],
        ['INC-2026-004523','业务问题','理财风险揭示整改','福州分行','零售金融部 / 理财','总行财富管理部','2026-07-12','2026-08-10','2026-08-06','待审批'],
        ['INC-2026-004524','投诉问题','网点服务规范整改','珠海分行','运营管理部 / 柜面服务','总行运营管理部','2026-07-05','2026-07-25','2026-07-22','审批中'],
        ['INC-2026-004525','业务问题','支付到账时效整改','上海分行','运营管理部 / 转账汇款','总行网络金融部','2026-07-01','2026-07-20','2026-07-18','已办结'],
        ['INC-2026-004526','投诉问题','贷款费用告知整改','宁德分行','零售金融部 / 个人消费贷','总行零售金融部','2026-07-13','2026-08-12','2026-08-08','处理中'],
        ['INC-2026-004527','上级指示','营销宣传规范整改','泉州分行','零售金融部 / 个人存款','总行零售金融部','2026-07-14','2026-08-15','2026-08-12','待处理'],
        ['INC-2026-004528','业务问题','客户信息保护整改','龙岩分行','运营管理部 / 账户服务','总行运营管理部','2026-07-09','2026-08-08','2026-08-05','处理中'],
        ['INC-2026-004529','投诉问题','贷款催收规范整改','漳州分行','零售金融部 / 个人消费贷','总行零售金融部','2026-07-06','2026-07-30','2026-07-27','待审批'],
        ['INC-2026-004530','业务问题','线上办理时效整改','莆田分行','运营管理部 / 手机银行','总行网络金融部','2026-07-03','2026-07-26','2026-07-24','已办结']
      ];
      const rectificationStageStats=[
        {label:'提问阶段',count:5,tone:'text-amber-600'},
        {label:'方案制定阶段',count:18,tone:'text-blue-600'},
        {label:'整改阶段',count:28,tone:'text-violet-600'},
        {label:'结果审核阶段',count:18,tone:'text-indigo-600'},
        {label:'已办结',count:55,tone:'text-emerald-600'}
      ];
      const rectificationStageSequence=(()=>{
        const remaining=rectificationStageStats.map(stage=>stage.count),sequence=[];
        while(sequence.length<124)rectificationStageStats.forEach((stage,index)=>{if(remaining[index]>0){sequence.push(stage.label);remaining[index]-=1;}});
        return sequence;
      })();
      const rectificationRows=Array.from({length:124},(_,index)=>{const seed=rectificationSeeds[index%rectificationSeeds.length];const row=index<10?[...seed]:[`INC-2026-${String(4521+index).padStart(6,'0')}`,...seed.slice(1)];row[9]=rectificationStageSequence[index];return row;});
      const rectificationStageTone=status=>rectificationStageStats.find(stage=>stage.label===status)?.tone||'text-slate-600';
      const rectificationPageSize=10;
      const rectificationPageCount=Math.ceil(rectificationRows.length/rectificationPageSize);
      const currentRectificationRows=rectificationRows.slice((rectificationPage-1)*rectificationPageSize,rectificationPage*rectificationPageSize);
      const rectificationSelection=useSelectableRows(currentRectificationRows,row=>row[0]);
      const exportRectificationRows=()=>downloadCsv(`溯源整改单列表_${startDate}_${endDate}.csv`,['整改单编号','问题来源','整改单标题','整改机构','整改业务/产品','整改单创建部门','整改开始时间','整改截止时间','计划完成时间','整改单状态'],rectificationSelection.selectedRows);
      // 点击整改单编号后进入独立详情页，信息结构与现有溯源整改页保持一致。
      if(rectificationDetail){
        const detail=rectificationDetail;
        const InfoItem=({label,value,wide=false})=><div className={wide?'col-span-3':''}><div className="text-[11px] text-slate-400">{label}</div><div className="mt-1 text-sm leading-6 text-slate-700">{value}</div></div>;
        const Attachment=({name})=><div className="mt-3 flex items-center gap-3 text-xs"><span className="grid h-7 w-7 place-items-center rounded bg-rose-50 text-rose-500"><Icon name="file" size={14}/></span><span className="font-medium text-slate-600">{name}</span><button className="text-violet-600">预览</button><button className="text-violet-600">下载</button></div>;
        return <div className="mx-auto max-w-[1540px] px-6 py-5">
          <section className="mb-4 flex items-start justify-between">
            <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">溯源整改单详情</h1></div>
            <button onClick={()=>setRectificationDetail(null)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600"><Icon name="chevron" size={15} className="rotate-180"/>返回投诉总览</button>
          </section>
          <div className="space-y-4">
            <section><h2 className="mb-3 border-l-4 border-violet-600 pl-3 text-base font-semibold text-slate-800">创建信息</h2><div className="grid grid-cols-3 gap-x-8 gap-y-5 rounded-lg border border-slate-100 bg-white p-5 shadow-card"><InfoItem label="事件经办员" value="张三"/><InfoItem label="所属机构" value="总行"/><InfoItem label="所属部门" value={detail[5]}/><InfoItem label="整改单编号" value={detail[0]}/><InfoItem label="创建时间" value="2026-07-10 13:45:23"/></div></section>
            <section><h2 className="mb-3 border-l-4 border-violet-600 pl-3 text-base font-semibold text-slate-800">整改问题</h2><div className="grid grid-cols-3 gap-x-8 gap-y-5 rounded-lg border border-slate-100 bg-white p-5 shadow-card"><InfoItem label="整改单名称" value={detail[2]}/><InfoItem label="整改业务" value={detail[4].split(' / ')[0]}/><InfoItem label="整改产品" value={detail[4].split(' / ')[1]||'其他'}/><InfoItem label="问题来源" value={detail[1]}/><InfoItem label="整改开始时间" value={detail[6]}/><InfoItem label="整改截止时间" value={detail[7]}/><InfoItem label="关联投诉原因标签" value={<span className="rounded bg-amber-50 px-2 py-1 text-amber-700">业务规则告知不及时导致扣费</span>}/><InfoItem wide label="问题描述" value={`相关投诉集中反映“${detail[2]}”，涉及规则告知、办理流程和客户沟通执行不一致等问题。`}/><InfoItem label="整改部门或机构" value={detail[3]}/><div className="col-span-3"><div className="text-[11px] text-slate-400">附件</div><Attachment name="整改要求.pdf"/></div></div></section>
            <section><h2 className="mb-3 border-l-4 border-violet-600 pl-3 text-base font-semibold text-slate-800">整改方案</h2><div className="grid grid-cols-3 gap-x-8 gap-y-5 rounded-lg border border-slate-100 bg-white p-5 shadow-card"><InfoItem label="提交时间" value="2026-07-11 10:48:00"/><InfoItem label="任务执行部门 / 团队" value={detail[5]}/><InfoItem label="计划完成时间" value={detail[8]}/><InfoItem wide label="整改计划" value="完善相关业务规则和标准话术，优化系统提示及办理流程，组织责任机构开展专项培训和存量问题排查。"/><InfoItem wide label="预期目标" value="统一执行口径，补齐流程和风险提示的薄弱环节，提高客户告知的及时性和准确性。"/><div className="col-span-3"><div className="text-[11px] text-slate-400">附件</div><Attachment name="整改方案.pdf"/></div></div></section>
            <section><h2 className="mb-3 border-l-4 border-violet-600 pl-3 text-base font-semibold text-slate-800">整改成果</h2><div className="rounded-lg border border-slate-100 bg-white p-5 shadow-card"><InfoItem wide label="工作成果说明" value={detail[9]==='已办结'?'已完成制度、流程及标准话术优化，并组织责任机构完成培训和核验。':'当前整改单尚未办结，工作成果待执行部门提交。'}/><Attachment name="整改成果.pdf"/></div></section>
          </div>
        </div>;
      }
      return (
        <div className="mx-auto max-w-[1540px] px-6 py-5">
          <nav className="mb-4 flex items-center gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">投诉总览</span></nav>

          <section className="mb-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-900">投诉总览</h1></div>

            </div>

          </section>

          {/* 投诉总览支持机构、日期、投诉渠道和投诉口径组合查询。 */}
          <section className="xib-embed-filter-panel xib-sticky-filter sticky top-16 z-20 mb-5 rounded-lg border border-slate-200 bg-white/95 backdrop-blur-sm">
            <div className={"xib-embed-filter-grid " + (filtersCollapsed ? "is-collapsed" : "")}>
              <OrganizationScopePicker testId="overview-org-scope" pageKey="overview" selection={devOrgSelection} dimension={overviewOrganizationDimension} onDimensionChange={dimension=>{setOverviewOrganizationDimension(dimension);setOverviewOrganizationField(organizationFieldForDimension('overview',dimension))}} onApply={scope=>{setDevOrgSelection(scope);setSelectedOrg(scope.queryLabel)}}/>
              <BusinessLineMultiSelect testId="overview-line-scope" value={businessLines} onChange={setBusinessLines}/>
              <div className="xib-embed-filter-item xib-embed-date-range"><div>统计日期</div><div className="xib-embed-date-range-controls"><input aria-label="投诉总览开始日期" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/><span className="xib-embed-date-range-separator">至</span><input aria-label="投诉总览结束日期" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></div></div>
              <label className="xib-embed-filter-item xib-embed-channel"><div className="mb-2 text-xs text-slate-500">投诉渠道</div><select data-testid="overview-channel-filter" value={complaintChannel} onChange={e=>setComplaintChannel(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400"><option>全部渠道</option><option>监管转送</option><option>自收投诉</option></select></label>
              <label className="xib-embed-filter-item xib-embed-caliber"><div className="mb-2 text-xs text-slate-500">投诉口径</div><select data-testid="overview-caliber-filter" value={complaintCaliber} onChange={e=>setComplaintCaliber(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400"><option>全部受理</option><option>有效投诉</option><option>有责投诉</option></select></label>
              <div className="xib-embed-filter-actions flex justify-end gap-2"><button onClick={resetOverviewFilters} className="h-10 rounded-md border border-slate-200 px-5 text-sm text-slate-600 hover:bg-slate-50">重置</button><button className="h-10 rounded-md bg-violet-600 px-6 text-sm font-medium text-white hover:bg-violet-700">查询</button></div>
            </div>
            <div className={"xib-embed-filter-conditions flex items-center justify-between text-[11px] text-slate-400 " + (filtersCollapsed ? "is-collapsed" : "border-t border-slate-100")}> <div className="flex min-w-0 items-center gap-4"><div data-testid="overview-compare-mode" className="flex shrink-0 rounded bg-slate-100 p-0.5">{['环比','同比'].map(m => <button key={m} onClick={() => setCompareMode(m)} className={`rounded px-2.5 py-1 text-[11px] ${compareMode === m ? 'bg-white font-medium text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{m}</button>)}</div><ExclusionRules testId="overview-exclude-rules" rules={[{checked:excludeDup,label:'重复投诉',partial:!excludeDup&&excludeAgain},{checked:excludeAgain,label:'再次投诉'},{checked:excludeAbnormal,label:'异常投诉'},{checked:excludeVoid,label:'废止投诉'}]} onChange={(label,checked)=>toggleOverviewExclusion(label,checked,label==='异常投诉'?setExcludeAbnormal:setExcludeVoid)}/></div><div className="flex shrink-0 items-center justify-end"><button type="button" className="xib-filter-collapse-btn" aria-label={filtersCollapsed?'展开筛选':'收起筛选'} title={filtersCollapsed?'展开筛选':'收起筛选'} onClick={()=>setFiltersCollapsed(v=>!v)}><svg className={"xib-filter-collapse-icon " + (filtersCollapsed ? "is-collapsed" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button></div></div>
          </section>

          <section className="grid grid-cols-4 gap-3">
            {cards.map(card => <ProductionMetricCard key={card.title} card={card} />)}
          </section>

          {/* 半上线版总览：在核心指标下补充趋势、风险、分布和快捷分析入口。 */}
          <section className="mt-4 rounded-lg border border-slate-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold text-slate-800">投诉整体趋势</h2><CompactInfoPopover info={PRODUCTION_SECTION_EXPLAIN.trend} ariaLabel="查看投诉整体趋势说明"/></div><p className="mt-1 text-xs text-slate-400">{selectedOrg}（按{overviewOrganizationDimension}）｜统计口径：{complaintCaliber}｜{startDate} 至 {endDate}｜按投诉渠道观察变化</p></div><div className="flex items-center gap-5"><div className="flex gap-4 text-xs">{showRegulatorySeries&&<span className="flex items-center gap-2 text-violet-600"><i className="h-2.5 w-2.5 rounded-full bg-violet-600"/>监管投诉量</span>}{showSelfSeries&&<span className="flex items-center gap-2 text-rose-500"><i className="h-2.5 w-2.5 rounded-full bg-rose-500"/>自收投诉量</span>}</div><div data-testid="overview-trend-granularity" className="flex rounded-md bg-slate-100 p-1">{overviewTrendGranularities.map(option=><button key={option.key} onClick={()=>setTrendGranularity(option.label)} className={`rounded px-3 py-1 text-xs ${trendGranularity===option.label?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>{useLongTrendGranularity?option.label:`按${option.label}`}</button>)}</div></div></div>
            <div className="p-5"><svg viewBox="0 0 1000 250" onMouseLeave={()=>setActiveTrendIndex(null)} className="h-[260px] w-full" role="img" aria-label="按监管投诉和自收投诉展示的渠道趋势图">{showRegulatorySeries&&<text x="80" y="16" textAnchor="start" fontSize="11" fontWeight="600" fill="#2272DE">监管投诉量（件）</text>}{showSelfSeries&&<text x="920" y="16" textAnchor="end" fontSize="11" fontWeight="600" fill="#f43f5e">自收投诉量（件）</text>}<line x1="80" x2="80" y1="28" y2="220" stroke="#cbd5e1"/><line x1="920" x2="920" y1="28" y2="220" stroke="#cbd5e1"/><line x1="80" x2="920" y1="220" y2="220" stroke="#cbd5e1"/><g>{[0,1,2,3,4].map(i=><g key={i}><line x1="80" x2="920" y1={28+i*46} y2={28+i*46} stroke="#e2e8f0" strokeDasharray="4 5"/>{showRegulatorySeries&&<><line x1="76" x2="80" y1={28+i*46} y2={28+i*46} stroke="#5A9EEC"/><text x="68" y={32+i*46} textAnchor="end" fontSize="10" fill="#5A9EEC">{Math.round(effectiveMax*(4-i)/4)}</text></>}{showSelfSeries&&<><line x1="920" x2="924" y1={28+i*46} y2={28+i*46} stroke="#f43f5e"/><text x="932" y={32+i*46} fontSize="10" fill="#f43f5e">{Math.round(regulatoryMax*(4-i)/4)}</text></>}</g>)}</g>{showRegulatorySeries&&<polyline fill="none" stroke="#2272DE" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" points={activeTrend.effective.map((v,i)=>`${trendX(i)},${effectiveY(v)}`).join(' ')}/>} {showSelfSeries&&<polyline fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={activeTrend.regulatory.map((v,i)=>`${trendX(i)},${regulatoryY(v)}`).join(' ')}/>} {activeTrend.labels.map((label,i)=><g key={label}>{showRegulatorySeries&&<circle cx={trendX(i)} cy={effectiveY(activeTrend.effective[i])} r="4" fill="white" stroke="#2272DE" strokeWidth="2.5"/>} {showSelfSeries&&<circle cx={trendX(i)} cy={regulatoryY(activeTrend.regulatory[i])} r="4" fill="white" stroke="#f43f5e" strokeWidth="2.5"/>}<circle cx={trendX(i)} cy={showRegulatorySeries?effectiveY(activeTrend.effective[i]):regulatoryY(activeTrend.regulatory[i])} r="18" fill="transparent" className="cursor-pointer" onMouseEnter={()=>setActiveTrendIndex(i)}/><text x={trendX(i)} y="242" textAnchor="middle" fontSize="11" fill="#94a3b8">{label}</text></g>)}{activeTrendIndex!==null&&activeTrendIndex<activeTrend.labels.length&&<g data-testid="overview-trend-tooltip"><line x1={trendX(activeTrendIndex)} x2={trendX(activeTrendIndex)} y1="28" y2="220" stroke="#cbd5e1" strokeDasharray="3 4"/><g transform={`translate(${Math.min(Math.max(trendX(activeTrendIndex)-85,85),710)},35)`}><rect width="205" height={showRegulatorySeries&&showSelfSeries?65:48} rx="8" fill="#0f172a" opacity="0.94"/><text x="12" y="20" fontSize="11" fill="#cbd5e1">{activeTrend.labels[activeTrendIndex]} · {complaintCaliber}</text>{showRegulatorySeries&&<text x="12" y="40" fontSize="12" fill="#A7C7F2">监管投诉量：{activeTrend.effective[activeTrendIndex]} 件</text>}{showSelfSeries&&<text x="12" y={showRegulatorySeries?58:40} fontSize="12" fill="#fda4af">自收投诉量：{activeTrend.regulatory[activeTrendIndex]} 件</text>}</g></g>}</svg></div>
          </section>

          <div className="hidden"><div><h2>特殊风险监控</h2><p>已合并至上方核心指标。</p></div></div>

          <section className="mt-4 rounded-lg border border-slate-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold text-slate-800">重点分布</h2><CompactInfoPopover info={PRODUCTION_SECTION_EXPLAIN.distribution} ariaLabel="查看重点分布说明"/></div><p className="mt-1 text-xs text-slate-400">按{distributionMetricLabel}识别重点对象；数据随投诉口径和剔除规则同步变化</p></div><div className="flex rounded-md bg-slate-100 p-1">{['机构','产品','原因','条线','渠道','客户'].map(view=><button key={view} onClick={()=>setDistributionView(view)} className={`rounded px-4 py-1.5 text-xs transition ${distributionView===view?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>{view}</button>)}</div></div>
            <div className="p-5"><div className="mb-3 grid grid-cols-[32px_170px_minmax(0,1fr)_130px_90px] gap-3 px-2 text-[11px] text-slate-400"><span>序号</span><span>名称</span><span></span><span className="text-right">投诉量</span><span className="text-right">环比</span></div><div data-testid="overview-key-distribution-rows" className="space-y-2">{currentDistributionRows.map((item,i)=><button data-distribution-name={item[0]} key={item[0]} onClick={()=>onNavigate(distributionRoutes[distributionView])} className="grid w-full grid-cols-[32px_170px_minmax(0,1fr)_130px_90px] items-center gap-3 rounded-lg px-2 py-2 text-left text-xs transition hover:bg-violet-50"><span className={`grid h-6 w-6 place-items-center rounded ${i<3?'bg-violet-600 text-white':'bg-slate-100 text-slate-500'}`}>{i+1}</span><span className="font-medium text-slate-700">{item[0]}</span><span className="h-7 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded bg-violet-500" style={{width:`${item[1]/distributionPeak*100}%`}}/></span><span className="text-right text-slate-600">{item[1].toLocaleString()}件</span><ComparisonValue label="" value={item[2]} className="justify-end"/></button>)}{currentDistributionRows.length===0&&<div className="py-10 text-center text-sm text-slate-400">请先在顶部选择机构</div>}</div></div>
          </section>

          <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Icon name="check" size={17}/></span><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold text-slate-800">溯源整改</h2><CompactInfoPopover info={PRODUCTION_SECTION_EXPLAIN.rectification} ariaLabel="查看溯源整改说明"/></div><p className="mt-1 text-xs text-slate-400">查看整改单规模、当前状态及责任机构</p></div></div>
              <div data-testid="rectification-stage-summary" className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] xl:gap-x-4 xl:text-xs">{rectificationStageStats.map(stage=><span key={stage.label} className="whitespace-nowrap text-slate-500">{stage.label} <b className={`ml-1 ${stage.tone}`}>{stage.count}</b></span>)}<span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">共124单</span><button data-testid="rectification-export" disabled={!rectificationSelection.selectedRows.length} onClick={exportRectificationRows} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-violet-200 bg-white px-3 font-medium text-violet-600 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="download" size={14}/>导出列表</button></div>
            </div>
            <div className="p-5">
              <div className="mb-3 grid grid-cols-[180px_100px_1fr_150px_170px_150px_100px] gap-3 px-2 text-[11px] text-slate-400"><span className="flex items-center gap-3"><SelectionCheckbox testId="rectification-select-all" checked={rectificationSelection.allSelected} onChange={rectificationSelection.toggleAll} ariaLabel="全选当前页整改单"/><span>整改单编号</span></span><span>问题来源</span><span>整改单标题</span><span>整改机构</span><span>整改业务 / 产品</span><span>计划完成时间</span><span className="text-right">状态</span></div>
              <div data-testid="rectification-list" className="space-y-2">{currentRectificationRows.map(item=><div key={item[0]} className="grid w-full grid-cols-[180px_100px_1fr_150px_170px_150px_100px] items-center gap-3 rounded-lg px-2 py-2.5 text-left text-xs hover:bg-violet-50"><span className="flex min-w-0 items-center gap-3"><SelectionCheckbox testId="rectification-select" checked={rectificationSelection.selectedSet.has(item[0])} onChange={checked=>rectificationSelection.toggle(item[0],checked)} ariaLabel={`选择整改单${item[0]}`}/><button onClick={()=>setRectificationDetail(item)} className="truncate text-left font-medium text-violet-600 hover:underline">{item[0]}</button></span><span className="text-slate-500">{item[1]}</span><span className="font-medium text-slate-700">{item[2]}</span><span className="text-slate-500">{item[3]}</span><span className="text-slate-500">{item[4]}</span><span className="text-slate-500">{item[8]}</span><span className={`whitespace-nowrap text-right ${rectificationStageTone(item[9])}`}>{item[9]}</span></div>)}</div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-[11px] text-slate-400">每页10笔，当前显示第{(rectificationPage-1)*10+1}-{Math.min(rectificationPage*10,rectificationRows.length)}笔，共{rectificationRows.length}笔</span><div className="flex items-center gap-1"><button disabled={rectificationPage===1} onClick={()=>setRectificationPage(page=>Math.max(1,page-1))} className="h-8 rounded border border-slate-200 px-3 text-xs text-slate-500 disabled:cursor-not-allowed disabled:opacity-40">上一页</button>{[1,2,3].map(page=><button key={page} onClick={()=>setRectificationPage(page)} className={`h-8 min-w-8 rounded px-2 text-xs ${rectificationPage===page?'bg-violet-600 text-white':'border border-slate-200 text-slate-600'}`}>{page}</button>)}<span className="px-1 text-slate-400">…</span><button onClick={()=>setRectificationPage(rectificationPageCount)} className={`h-8 min-w-8 rounded px-2 text-xs ${rectificationPage===rectificationPageCount?'bg-violet-600 text-white':'border border-slate-200 text-slate-600'}`}>{rectificationPageCount}</button><button disabled={rectificationPage===rectificationPageCount} onClick={()=>setRectificationPage(page=>Math.min(rectificationPageCount,page+1))} className="h-8 rounded border border-slate-200 px-3 text-xs text-slate-500 disabled:cursor-not-allowed disabled:opacity-40">下一页</button></div></div>
            </div>
          </section>

        </div>
      );
    }

    function TrendChart({ viewKey }) {
      const trend = TREND_DATA[viewKey];
      const [activeIndex, setActiveIndex] = useState(trend.points.length - 1);
      const dates = trend.points.map((_, index) => `07-${String(index + 1).padStart(2, '0')}`);
      const total = trend.points.reduce((sum, value) => sum + value, 0);
      const average = total / trend.points.length;
      const peakValue = Math.max(...trend.points);
      const peakIndex = trend.points.indexOf(peakValue);
      const rawMax = peakValue;
      const niceMax = rawMax > 100 ? Math.ceil(rawMax / 100) * 100 : rawMax > 10 ? Math.ceil(rawMax / 10) * 10 : Math.ceil(rawMax / 2) * 2;
      const left = 56;
      const right = 980;
      const top = 24;
      const bottom = 218;
      const xFor = (index) => left + (index * (right - left)) / (trend.points.length - 1);
      const yFor = (value) => bottom - (value / niceMax) * (bottom - top);
      const linePath = trend.points.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(value)}`).join(' ');
      const areaPath = `${linePath} L ${right} ${bottom} L ${left} ${bottom} Z`;
      const yTicks = [niceMax, niceMax * 0.75, niceMax * 0.5, niceMax * 0.25, 0];
      const xLabelIndexes = [0, 3, 6, 9, 12, 14];

      return (
        <section data-testid="complaint-trend" className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">投诉趋势</h2>
                <span className="rounded border border-xib-100 bg-xib-50 px-2 py-0.5 text-[11px] font-medium text-xib-500">基础统计</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">按日</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">按客户投诉时间统计每日有效投诉量；固定统计维度，不支持自由组合。</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs text-violet-700">
                <span className="h-2 w-2 rounded-full bg-violet-500" />
                当前查看：{dates[activeIndex]}，{trend.points[activeIndex]} 件
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <div className="px-5 py-3">
                <div className="text-[11px] text-slate-400">日均投诉量</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">{average.toFixed(1)}<span className="ml-1 text-xs font-normal text-slate-400">件</span></div>
              </div>
              <div className="px-5 py-3">
                <div className="text-[11px] text-slate-400">峰值</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">{peakValue}<span className="ml-1 text-xs font-normal text-slate-400">件</span></div>
                <div className="text-[10px] text-slate-400">{dates[peakIndex]}</div>
              </div>
              <div className="px-5 py-3">
                <div className="text-[11px] text-slate-400">较上期</div>
                <div className="mt-1 text-lg font-semibold"><ComparisonValue label="环比" value={trend.compare}/></div>
              </div>
            </div>
          </div>

          {/* 使用内嵌 SVG 绘制折线，保证单文件转发后无需加载图表库。 */}
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/40 px-2 py-2">
            <svg viewBox="0 0 1000 250" className="h-[270px] w-full" role="img" aria-label="每日有效投诉量折线图">
              <defs>
                <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2272DE" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#2272DE" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {yTicks.map((tick, index) => {
                const y = top + (index * (bottom - top)) / (yTicks.length - 1);
                return (
                  <g key={tick}>
                    <line x1={left} x2={right} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray={index === yTicks.length - 1 ? '0' : '4 5'} />
                    <text x={left - 12} y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{Math.round(tick)}</text>
                  </g>
                );
              })}

              {xLabelIndexes.map(index => (
                <text key={index} x={xFor(index)} y="241" textAnchor="middle" fontSize="11" fill="#94A3B8">{dates[index]}</text>
              ))}

              <path d={areaPath} fill="url(#trendArea)" />
              <path d={linePath} fill="none" stroke="#2272DE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

              <line x1={xFor(activeIndex)} x2={xFor(activeIndex)} y1={top} y2={bottom} stroke="#7CA9E8" strokeDasharray="4 4" opacity="0.65" />
              {trend.points.map((value, index) => (
                <circle
                  key={index}
                  cx={xFor(index)}
                  cy={yFor(value)}
                  r={activeIndex === index ? 6 : 3.5}
                  fill={activeIndex === index ? '#2272DE' : '#FFFFFF'}
                  stroke="#2272DE"
                  strokeWidth={activeIndex === index ? 3 : 2}
                  className="cursor-pointer transition-all"
                  tabIndex="0"
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                >
                  <title>{dates[index]}：{value} 件</title>
                </circle>
              ))}
            </svg>
          </div>
        </section>
      );
    }

    function MetricModal({ metricKey, view, onClose }) {
      if (!metricKey) return null;
      const meta = METRIC_META[metricKey];
      const metric = view.metrics[metricKey];
      return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <section className="modal-enter w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-float">
            <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="mb-2 text-xs font-medium" style={{ color: meta.accent }}>{meta.eyebrow}</div>
                <h2 className="text-xl font-semibold text-slate-900">{meta.title}</h2>
                <p className="mt-1 text-sm text-slate-500">当前值：{metric.value} {metric.unit}</p>
              </div>
              <button onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="关闭弹窗">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className="space-y-5 px-6 py-5">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">指标说明</h3>
                <p className="text-sm leading-6 text-slate-600">{meta.description}</p>
              </div>
              <div className="rounded-lg border border-xib-100 bg-xib-50 px-4 py-3">
                <div className="text-xs font-medium text-xib-500">计算公式</div>
                <div className="mt-1 text-sm font-semibold text-slate-800">{meta.formula}</div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">统计范围</h3>
                <p className="text-sm leading-6 text-slate-600">{meta.scope}</p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">还需确认的关键点</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {meta.confirm.map(item => (
                    <li key={item} className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-violetx" />{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3">
                <div className="text-xs font-medium text-violet-600">{view.label}的管理价值</div>
                <p className="mt-1 text-sm leading-6 text-slate-700">{view.values[metricKey]}</p>
              </div>
            </div>
            <footer className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button onClick={onClose} className="rounded-md bg-xib-500 px-5 py-2 text-sm font-medium text-white hover:bg-xib-600">我知道了</button>
            </footer>
          </section>
        </div>
      );
    }

    function AbnormalDetailModal({ view, metricKey, onClose }) {
      const isPerClient = metricKey === 'perClient';
      const metric = view.metrics[metricKey];
      const benchmark = metric.insights.find(item => item.label === '目标值' || item.label === '关注值');
      const rows = isPerClient ? view.abnormalRows : view.outletAbnormalRows;
      const title = isPerClient ? view.abnormalTitle : view.outletAbnormalTitle;
      const rule = isPerClient ? view.abnormalRule : view.outletAbnormalRule;
      const metricName = isPerClient ? '有效每万客户投诉' : '有效网均投诉';
      const denominatorLabel = isPerClient ? '有效客户数' : '营业网点数';
      const denominatorUnit = isPerClient ? '人' : '个';
      const rateLabel = isPerClient ? '每万客户投诉' : '有效网均投诉';
      const rateUnit = isPerClient ? '件/万客户' : '件/网点';
      const entityLabel = isPerClient ? '机构名称' : '网点名称';
      const statusClass = (status) => status.includes('红色')
        ? 'border-rose-200 bg-rose-50 text-rose-600'
        : status.includes('橙色')
          ? 'border-orange-200 bg-orange-50 text-orange-600'
          : 'border-amber-200 bg-amber-50 text-amber-700';

      return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-6 py-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <section className="modal-enter flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-float">
            <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-50 text-violet-600">
                  <Icon name="branch" size={20} />
                </div>
                <div>
                  <div className="text-xs font-medium text-violet-600">{metricName} · 下钻明细</div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">{title}</h2>
                  <p className="mt-1 text-sm text-slate-500">统计周期：2026-07-01 至 2026-07-15</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="关闭异常机构明细">
                <Icon name="close" size={20} />
              </button>
            </header>

            <div className="overflow-y-auto px-6 py-5">
              <div className="mb-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-400">{isPerClient ? '异常机构数' : '异常网点数'}</div>
                  <div className="mt-1 text-2xl font-semibold text-rose-600">{rows.length}<span className="ml-1 text-xs font-normal text-slate-400">家/个</span></div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-400">当前管理范围指标</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{metric.value}<span className="ml-1 text-xs font-normal text-slate-400">{rateUnit}</span></div>
                </div>
                <div className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3">
                  <div className="text-xs text-violet-500">{benchmark.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-violet-700">{benchmark.value}<span className="ml-1 text-xs font-normal text-violet-400">{rateUnit}</span></div>
                </div>
              </div>

              <div className="mb-4 flex items-start gap-2 rounded-lg border border-xib-100 bg-xib-50 px-4 py-3">
                <Icon name="info" size={16} className="mt-0.5 flex-none text-xib-500" />
                <div>
                  <div className="text-xs font-medium text-xib-600">异常识别规则</div>
                  <p className="mt-1 text-sm text-slate-600">{rule}</p>
                </div>
              </div>

              {/* 异常机构下钻表：用于从汇总判断进入具体机构核查。 */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="w-14 px-4 py-3 text-center">序号</th>
                      <th className="px-4 py-3">{entityLabel}</th>
                      {!isPerClient && <th className="px-4 py-3">所属机构</th>}
                      <th className="px-4 py-3 text-right">{isPerClient ? '有效投诉量' : '网点有效投诉量'}</th>
                      {isPerClient && <th className="px-4 py-3 text-right">{denominatorLabel}</th>}
                      {isPerClient && <th className="px-4 py-3 text-right">{rateLabel}</th>}
                      <th className="px-4 py-3 text-right">较{benchmark.label}</th>
                      <th className="px-4 py-3 text-center">预警状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {rows.map((row, index) => (
                      <tr key={row.name} className="transition hover:bg-violet-50/40">
                        <td className="px-4 py-3 text-center text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                        {!isPerClient && <td className="px-4 py-3 text-slate-500">{row.parent}</td>}
                        <td className="px-4 py-3 text-right">{row.complaints} 件</td>
                        {isPerClient && <td className="px-4 py-3 text-right">{row.clients} {denominatorUnit}</td>}
                        {isPerClient && <td className="px-4 py-3 text-right font-semibold text-slate-900">{row.rate}</td>}
                        <td className="px-4 py-3 text-right font-semibold text-rose-600">{row.deviation}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(row.status)}`}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {isPerClient
                  ? '说明：当前为原型演示数据，实际异常名单由正式目标值、预警线和最低样本量规则计算生成。'
                  : '说明：网均值用于判断当前管理范围的网点平均压力；异常明细直接列示超过目标值的具体营业网点。'}
              </p>
            </div>

            <footer className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button onClick={onClose} className="rounded-md bg-xib-500 px-5 py-2 text-sm font-medium text-white hover:bg-xib-600">关闭</button>
            </footer>
          </section>
        </div>
      );
    }

    function InstitutionAnalysisPage({ viewKey, setViewKey }) {
      const [focusKey, setFocusKey] = useState('pressure');
      const focus = INSTITUTION_FOCUS_DATA[focusKey];
      const view = VIEW_DATA[viewKey];
      const summary = INSTITUTION_SUMMARY[viewKey];
      const names = INSTITUTION_NAMES[viewKey];
      const values = focus.values[viewKey];
      const maxValue = Math.max(...values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const formatValue = (value) => {
        const number = Number.isInteger(value) ? value.toLocaleString('zh-CN') : value.toFixed(1);
        return focus.unit === '%' ? `${number}%` : `${number} ${focus.unit}`;
      };

      return (
        <div className="mx-auto max-w-[1540px] px-6 py-5">
          <nav className="mb-4 flex items-center gap-2 text-xs text-slate-400">
            <span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">机构分析</span>
          </nav>

          <section className="mb-4 flex items-end justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">机构分析</h1>
                <span className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">统计分析子模块</span>
              </div>

            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> 数据更新时间：2026-07-15 12:00
            </div>
          </section>

          <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex items-center gap-6">
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">管理视角</div>
                <div className="flex rounded-md bg-slate-100 p-1">
                  {Object.values(VIEW_DATA).map(item => (
                    <button key={item.key} onClick={() => setViewKey(item.key)} className={`rounded px-4 py-2 text-sm font-medium transition ${viewKey === item.key ? 'bg-white text-xib-500 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-12 w-px bg-slate-200" />
              <div className="min-w-[220px]">
                <div className="mb-2 text-xs font-medium text-slate-500">当前机构</div>
                <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 px-3 text-sm text-slate-700">
                  <span className="flex items-center gap-2"><Icon name="building" size={16} className="text-xib-500" />{view.organization}</span><span className="text-slate-400">⌄</span>
                </div>
              </div>
              <div className="min-w-[250px]">
                <div className="mb-2 text-xs font-medium text-slate-500">统计周期</div>
                <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm text-slate-700">
                  <Icon name="calendar" size={16} className="text-slate-400" />2026-07-01 至 2026-07-15
                </div>
              </div>
              <div className="ml-auto flex items-end gap-2 pt-5">
                <button className="h-10 rounded-md border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50">重置</button>
                <button className="h-10 rounded-md bg-xib-500 px-5 text-sm font-medium text-white hover:bg-xib-600">查询</button>
              </div>
            </div>
          </section>

          <section className="mb-4 grid grid-cols-4 gap-4" data-testid="institution-summary">
            {[
              { label: '纳入分析机构', value: summary.included, unit: '家/个', color: 'text-xib-500', soft: 'bg-xib-50', icon: 'building' },
              { label: '重点关注机构', value: summary.attention, unit: '家/个', color: 'text-violet-600', soft: 'bg-violet-50', icon: 'monitor' },
              { label: '监管高风险', value: summary.regulatory, unit: '家/个', color: 'text-rose-600', soft: 'bg-rose-50', icon: 'shield' },
              { label: '存在超期工单', value: summary.overdue, unit: '家/个', color: 'text-amber-600', soft: 'bg-amber-50', icon: 'file' }
            ].map(item => (
              <article key={item.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-card">
                <div>
                  <div className="text-xs text-slate-400">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{item.value}<span className="ml-1 text-xs font-normal text-slate-400">{item.unit}</span></div>
                </div>
                <div className={`grid h-10 w-10 place-items-center rounded-lg ${item.soft} ${item.color}`}><Icon name={item.icon} size={20} /></div>
              </article>
            ))}
          </section>

          <section className="grid grid-cols-[360px_1fr] gap-4">
            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-900">管理关注维度</h2>
                <p className="mt-1 text-xs text-slate-400">选择一个问题，查看对应机构排名</p>
              </div>
              <div className="grid grid-cols-3 gap-2" data-testid="institution-focus-tabs">
                {Object.entries(INSTITUTION_FOCUS_DATA).map(([key, item]) => (
                  <button
                    key={key}
                    data-focus-key={key}
                    onClick={() => setFocusKey(key)}
                    className={`min-h-[72px] rounded-lg border px-2 py-3 text-center transition ${focusKey === key ? 'border-violet-400 bg-violet-600 text-white shadow-md' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700'}`}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className={`mt-1 text-[10px] ${focusKey === key ? 'text-violet-100' : 'text-slate-400'}`}>{item.metrics.length}项指标</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-xib-100 bg-xib-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-xib-600"><Icon name="info" size={14} />使用方式</div>

              </div>
            </article>

            <article key={`${viewKey}-${focusKey}`} data-testid="institution-focus-panel" className="view-enter rounded-lg border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">{focus.label}</span>
                    <span className="text-xs text-slate-400">固定机构统计维度</span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">{focus.question}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {focus.metrics.map(metric => <span key={metric} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{metric}</span>)}
                  </div>
                </div>
                <div className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-right">
                  <div className="text-[11px] text-violet-500">当前第一名</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">{names[0]}</div>
                  <div className="mt-1 text-xl font-semibold text-violet-700">{formatValue(values[0])}</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-[1.35fr_.85fr] gap-5">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">机构{focus.chartMetric}排名</h3>
                    <span className="text-xs text-slate-400">Top 5</span>
                  </div>
                  <div className="space-y-3">
                    {names.map((name, index) => (
                      <div key={name} className="grid grid-cols-[90px_1fr_86px] items-center gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <span className={`grid h-5 w-5 place-items-center rounded text-[10px] font-semibold ${index === 0 ? 'bg-rose-50 text-rose-600' : index === 1 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
                          <span className="truncate">{name}</span>
                        </div>
                        <div className="h-7 overflow-hidden rounded bg-slate-100">
                          <div className={`flex h-full items-center rounded px-2 transition-all ${index === 0 ? 'bg-gradient-to-r from-violet-600 to-violet-400' : 'bg-gradient-to-r from-xib-500 to-violet-400'}`} style={{ width: `${Math.max((values[index] / maxValue) * 100, 18)}%` }}>
                            <span className="text-[10px] font-medium text-white">{focus.chartMetric}</span>
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold text-slate-800">{formatValue(values[index])}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-400">Top5平均值</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{formatValue(average)}</div>
                    <div className="mt-3 text-xs leading-5 text-slate-500">第一名较Top5平均高 {(((values[0] - average) / average) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-violet-50 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-violet-600"><Icon name="check" size={14} />管理判断</div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{names[0]}{focus.judgement}</p>
                  </div>
                  <div className="rounded-lg border border-xib-100 bg-xib-50 p-4">
                    <div className="text-xs font-medium text-xib-600">建议动作</div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{focus.action}</p>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </div>
      );
    }

    const CHART_COLORS = ['#185FBF', '#5A9EEC', '#7CA9E8', '#7CA9E8', '#94A3B8'];

    function RankingVisual({ names, values, focus, viewKey, alertRows = [], rangeTotal, topNKey = '5', metricLabel = '有效投诉量', compareMode = '环比' }) {
      const alertMap = {};
      alertRows.forEach(r => { alertMap[r.name] = r; });
      const baseList = names.map((name, i) => ({ name, valid: values[i], growth: institutionFocusValue('trend',viewKey,name,i) }));
      const ranked = [...baseList].sort((a, b) => b.valid - a.valid);
      const shown = ranked.slice(0, Math.min(Number(topNKey), ranked.length));
      const total = parseFloat(String(rangeTotal || '').replace(/,/g, '')) || shown.reduce((sum, o) => sum + o.valid, 0);
      const maxValue = Math.max(...shown.map(o => o.valid));
      const fmtMom = v => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(1) + '%';
      return (
        <div>
          <div className="space-y-2.5">{shown.map((o, index) => {
            const ar = alertMap[o.name];
            const mom = ar ? parseFloat(ar.mom) : o.growth / 6;
            const share = o.valid / total * 100;
            return (
              <div key={o.name} className="grid grid-cols-[112px_1fr_120px] items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-semibold ${index === 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
                  <span className="truncate">{o.name}</span>
                  {ar && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ar.tone === 'danger' ? 'bg-rose-500' : 'bg-amber-500'}`} title="触发预警" />}
                </div>
                <div className="h-6 overflow-hidden rounded bg-slate-100"><div className={`h-full rounded ${ar ? 'bg-gradient-to-r from-violet-700 to-violet-400' : 'bg-gradient-to-r from-slate-400 to-slate-300'}`} style={{ width: `${Math.max(o.valid / maxValue * 100, 12)}%` }} /></div>
                <div className="text-right text-xs">
                  <div className="font-semibold text-slate-700">{o.valid.toLocaleString()} 件</div>
                  <div className="text-[11px] text-slate-400">占{share.toFixed(1)}% · {compareMode} <span className={mom > 0 ? 'font-semibold text-rose-600' : mom < 0 ? 'font-semibold text-emerald-600' : 'text-slate-400'}>{fmtMom(mom)}</span></div>
                </div>
              </div>
            );
          })}</div>
          <div className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">注：按{metricLabel}降序展示 Top5；占比＝本机构{metricLabel}÷当前管理范围{metricLabel}。色点表示该机构已触发环比或同比预警。</div>
        </div>
      );
    }

    function QuadrantVisual({ names, values, viewKey, type, compareMode = 'mom', alertRows = [], regulatoryThreshold, efficiencyDurationThreshold = 5.5, efficiencyCompletionThreshold = 85, onConfigureThreshold }) {
      const [hi, setHi] = useState(null);
      const alertMap = {};
      alertRows.forEach(r => { alertMap[r.name] = r; });
      const regulatoryGrowthSource = compareMode === 'yoy'
        ? (viewKey === 'headOffice' ? [33.5, 31.2, 18.4, 12.6, 6.7] : viewKey === 'branch' ? [36.8, 29.5, 21.2, 14.8, 8.1] : [38.4, 32.1, 24.6, 16.2, 9.5])
        : (viewKey === 'headOffice' ? [24.1, 18.6, 12.4, 6.8, -3.2] : viewKey === 'branch' ? [27.5, 21.8, 14.6, 7.2, -1.8] : [31.2, 23.4, 16.8, 8.6, -4.1]);
      const regulatoryGrowth=names.map((_,index)=>regulatoryGrowthSource[index%regulatoryGrowthSource.length]);
      const primary = values;
      const secondarySource = type === 'regulatory'
        ? regulatoryGrowth
        : (viewKey === 'headOffice' ? [78, 82, 85, 89, 92] : viewKey === 'branch' ? [80, 83, 86, 90, 93] : [79, 84, 87, 91, 94]);
      const secondary=names.map((_,index)=>secondarySource[index%secondarySource.length]);
      const rawXMin = Math.min(...primary), rawXMax = Math.max(...primary);
      const rawYMin = Math.min(...secondary), rawYMax = Math.max(...secondary);
      const xMin = rawXMin === rawXMax ? rawXMin - Math.max(1, Math.abs(rawXMin) * .08) : rawXMin * .88;
      const xMax = rawXMin === rawXMax ? rawXMax + Math.max(1, Math.abs(rawXMax) * .08) : rawXMax * 1.08;
      const yMin = rawYMin === rawYMax ? rawYMin - Math.max(1, Math.abs(rawYMin) * .08) : rawYMin * .92;
      const yMax = rawYMin === rawYMax ? rawYMax + Math.max(1, Math.abs(rawYMax) * .08) : rawYMax * 1.06;
      const VBW = 560, VBH = 225;
      const x = value => 58 + (value - xMin) / (xMax - xMin) * 460;
      const y = value => 198 - (value - yMin) / (yMax - yMin) * 150;
      const xLabel = type === 'regulatory' ? '监管投诉占比' : '平均处理时长';
      const yLabel = type === 'regulatory' ? `监管投诉${compareMode === 'yoy' ? '同比' : '环比'}增幅` : '按时办结率';
      const xUnit = type === 'regulatory' ? '%' : '天';
      const validVolumes=names.map((name,index)=>institutionFocusValue('pressure',viewKey,name,index)||1);
      // 监管风险图的气泡表示监管投诉实际规模，处理效率图仍表示有效投诉量。
      const volumes = type === 'regulatory' ? validVolumes.map((volume, index) => Math.max(1, Math.round(volume * primary[index] / 100))) : validVolumes;
      const volMin = Math.min(...volumes), volMax = Math.max(...volumes);
      const radius = index => 8 + (volumes[index] - volMin) / Math.max(1, volMax - volMin) * 7;
      const xThreshold = type === 'regulatory' ? (Number.isFinite(regulatoryThreshold) ? regulatoryThreshold : (Math.min(...primary) + Math.max(...primary)) / 2) : efficiencyDurationThreshold;
      const yThreshold = type === 'regulatory' ? (compareMode === 'yoy' ? 30 : 20) : efficiencyCompletionThreshold;
      const xSplit = Math.max(58, Math.min(518, x(xThreshold))), ySplit = Math.max(28, Math.min(198, y(yThreshold)));
      return (
        <div className="relative">
          <svg viewBox={`0 0 ${VBW} ${VBH}`} className="h-[225px] w-full" role="img" aria-label={type === 'regulatory' ? '监管风险机构分布图' : '处理效率机构分布图'}>
            <rect x="58" y="28" width={xSplit-58} height={ySplit-28} fill="#FFF1F2" opacity=".72" /><rect x={xSplit} y="28" width={518-xSplit} height={ySplit-28} fill={type === 'regulatory' ? '#FEE2E2' : '#F0FDF4'} opacity=".7" /><rect x="58" y={ySplit} width={xSplit-58} height={198-ySplit} fill="#F8FAFC" /><rect x={xSplit} y={ySplit} width={518-xSplit} height={198-ySplit} fill={type === 'regulatory' ? '#FFF7ED' : '#FEF2F2'} opacity=".8" />
            <line x1={xSplit} y1="28" x2={xSplit} y2="198" stroke="#CBD5E1" strokeDasharray="4 4"/><line x1="58" y1={ySplit} x2="518" y2={ySplit} stroke="#CBD5E1" strokeDasharray="4 4"/>
            <line x1="58" y1="198" x2="518" y2="198" stroke="#94A3B8"/><line x1="58" y1="28" x2="58" y2="198" stroke="#94A3B8"/>
            <text x="66" y="43" fontSize="10" fill="#64748B">{type === 'regulatory' ? `${compareMode === 'yoy' ? '同比' : '环比'}增幅 ↑` : '按时办结率高 ↑'}</text><text x="410" y="214" fontSize="10" fill="#64748B">{type === 'regulatory' ? '监管投诉数量 →' : '平均处理时长长 →'}</text>
            {names.map((name, index) => {
              const alerted = type === 'regulatory'
                ? primary[index] >= xThreshold && secondary[index] >= yThreshold
                : primary[index] >= xThreshold && secondary[index] < yThreshold;
              const rr = radius(index);
              return <g key={name} onMouseEnter={() => setHi(index)} onMouseLeave={() => setHi(null)} style={{ cursor: 'pointer' }}>
                {alerted && <circle cx={x(primary[index])} cy={y(secondary[index])} r={rr + 5} fill="none" stroke="#E11D48" strokeWidth="2" />}
                <circle cx={x(primary[index])} cy={y(secondary[index])} r={hi === index ? rr + 2 : rr} fill={CHART_COLORS[index%CHART_COLORS.length]} opacity={hi == null || hi === index ? .9 : .45} stroke="#fff" strokeWidth="2" />
                <text x={x(primary[index]) + 12} y={y(secondary[index]) - 8} fontSize="10" fill="#475569">{name}</text>
              </g>;
            })}
          </svg>
          {hi != null && (
            <div className="pointer-events-none absolute z-20 w-44 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl" style={{ left: x(primary[hi]) / VBW * 100 + '%', top: y(secondary[hi]) / VBH * 100 + '%', transform: `translate(${x(primary[hi]) / VBW > .6 ? '-110%' : '16px'}, -50%)` }}>
              <div className="mb-1.5 flex items-center gap-1.5 border-b border-slate-100 pb-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[hi%CHART_COLORS.length] }} /><span className="text-xs font-semibold text-slate-700">{names[hi]}</span>{((type === 'regulatory' && primary[hi] >= xThreshold && secondary[hi] >= yThreshold) || (type === 'efficiency' && primary[hi] >= xThreshold && secondary[hi] < yThreshold)) && <span className="ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">预警</span>}</div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-400">{xLabel}</span><span className="font-medium tabular-nums text-slate-700">{primary[hi]}{xUnit}</span></div>
              <div className="mt-0.5 flex justify-between text-[11px]"><span className="text-slate-400">{yLabel}</span><span className="font-medium tabular-nums text-slate-700">{secondary[hi]}%</span></div>
              <div className="mt-0.5 flex justify-between text-[11px]"><span className="text-slate-400">{type === 'regulatory' ? '监管投诉量' : '有效投诉量'}</span><span className="font-medium tabular-nums text-slate-700">{volumes[hi]}件</span></div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-violet-500" />圆形面积越大，{type === 'regulatory' ? '监管投诉量越多' : '有效投诉量越多'}</span><span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-rose-500" />{type === 'regulatory' ? '红圈＝占比和增幅同时超过分界线' : '红圈＝处理时长高且按时办结率低'}</span></div>
            <button type="button" onClick={onConfigureThreshold} className="inline-flex h-8 items-center gap-1.5 rounded border border-violet-200 bg-white px-3 text-[11px] font-medium text-violet-700 transition hover:bg-violet-50"><Icon name="settings" size={14}/>自定义风险阈值</button>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">风险分界：{type === 'regulatory' ? `${xLabel}≥${xThreshold.toFixed(1)}${xUnit} 且 ${yLabel}≥${yThreshold.toFixed(1)}%` : `${xLabel}≥${xThreshold.toFixed(1)}${xUnit} 且 ${yLabel}<${yThreshold.toFixed(1)}%`}</div>
        </div>
      );
    }

    const TREND_MEASURES = [{ key: 'valid', label: '有效投诉量', factor: 1 }, { key: 'regulatory', label: '监管投诉量', factor: 0.097 }, { key: 'received', label: '受理投诉量', factor: 1.06 }];
    const TREND_GRANS = SHORT_TREND_GRANULARITIES;
    const TREND_TOPN = [{ key: '5', label: 'Top5' }, { key: '10', label: 'Top10' }];
    const MOM_THRESHOLD = 20, YOY_THRESHOLD = 30;
    // 历史样例量级只用于生成演示数值；图表名称始终来自顶部“已选机构”。
    const TREND_ORGS = {
      headOffice: [
        { name: '厦门分行', valid: 836, growth: 12.0 }, { name: '上海分行', valid: 742, growth: 22.5 }, { name: '福州分行', valid: 691, growth: 21.0 },
        { name: '北京分行', valid: 628, growth: 24.1 }, { name: '宁德分行', valid: 584, growth: 6.7 }, { name: '龙岩分行', valid: 552, growth: 15.4 },
        { name: '漳州分行', valid: 518, growth: 8.1 }, { name: '莆田分行', valid: 474, growth: 14.8 }, { name: '三明分行', valid: 441, growth: 9.7 },
        { name: '珠海分行', valid: 398, growth: 7.3 }, { name: '泉州分行', valid: 365, growth: 11.2 }, { name: '南平分行', valid: 332, growth: 6.1 }
      ]
    };
    const institutionFocusValue=(focusKey,viewKey,name,index=0)=>{
      const values=INSTITUTION_FOCUS_DATA[focusKey]?.values?.[viewKey]||[];
      if(!values.length)return 0;
      const referenceNames=viewKey==='headOffice'?INSTITUTION_BRANCH_NAMES:(INSTITUTION_NAMES[viewKey]||[]);
      const matchedIndex=referenceNames.indexOf(name);
      return values[(matchedIndex>=0?matchedIndex:index)%values.length]||0;
    };

    function TrendVisual({ names, viewKey, alertRows = [], startDate, endDate, measureKey = 'valid', granKey = 'month', topNKey = '5', filterFactor = 1, metricLabel }) {
      const [hover, setHover] = useState(null); // { i: 期index, li: 机构index }
      const alertMap = {};
      alertRows.forEach(r => { alertMap[r.name] = r; });
      const measure = TREND_MEASURES.find(m => m.key === measureKey);
      const fmt = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
      // 机构全集 → 按有效投诉量降序 → 取 TopN。
      const baseList = names.map((name, i) => ({ name, valid: institutionFocusValue('pressure',viewKey,name,i)||1, growth: institutionFocusValue('trend',viewKey,name,i) }));
      const ranked = [...baseList].sort((a, b) => b.growth - a.growth || b.valid - a.valid);
      const limit = topNKey === 'all' ? ranked.length : Math.min(Number(topNKey), ranked.length);
      const shown = ranked.slice(0, limit);
      const orgCount = shown.length;
      // 横轴随日期筛选 + 粒度联动；区间超过 12 个月时由季度／半年／年度接管。
      const labels = statisticsTrendLabels(startDate,endDate,granKey);
      const N = labels.length;
      const rangeText = `${startDate} ~ ${endDate}`;
      // 按度量缩放、按粒度重采样生成各机构序列。
      const series = shown.map((o, index) => {
        const final = o.valid * measure.factor * filterFactor;
        const start = final / (1 + o.growth / 100);
        return Array.from({ length: N }, (_, k) => start + (final - start) * k / (N - 1) + ((k > 0 && k < N - 1) ? final * .012 * Math.sin(k * 1.3 + index) : 0));
      });
      const all = series.flat();
      const rawMin = Math.min(...all), rawMax = Math.max(...all);
      const stepSize = Math.max(2, Math.ceil((rawMax - rawMin) / 4 / 2) * 2);
      const min = Math.floor(rawMin / stepSize) * stepSize;
      const max = Math.max(min + stepSize, Math.ceil(rawMax / stepSize) * stepSize);
      const VBW = 1010, VBH = 300, PL = 54, PR = 858, PW = PR - PL, PT = 26, PB = 262;
      const stepX = PW / (N - 1);
      const x = i => PL + i * stepX;
      const y = value => PB - (value - min) / (max - min) * (PB - PT);
      const yTicks = [0,1,2,3,4].map(i => min + (max - min) * i / 4);
      const meta = shown.map((o, index) => {
        const ar = alertMap[o.name];
        return { name: o.name, index, pts: series[index], ar, alerted: !!ar, tone: ar ? ar.tone : null, color: ar ? CHART_COLORS[index % CHART_COLORS.length] : '#CBD5E1' };
      });
      const ordered = [...meta].sort((a, b) => Number(a.alerted) - Number(b.alerted));
      const top = meta[0];
      const areaPath = top.pts.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ') + ` L ${x(N - 1)} ${PB} L ${x(0)} ${PB} Z`;
      // 常驻超阈点示例：取第一条预警线在区间内最大环比的期作为示范点。
      const exLine = meta.find(m => m.alerted);
      let exPoint = null;
      if (exLine) {
        let bi = 1, bm = -Infinity;
        for (let i = 1; i < N; i++) { const mo = (exLine.pts[i] - exLine.pts[i - 1]) / exLine.pts[i - 1] * 100; if (mo > bm) { bm = mo; bi = i; } }
        exPoint = { i: bi, val: exLine.pts[bi], color: exLine.color, tone: exLine.tone, mom: exLine.ar ? parseFloat(exLine.ar.mom) : bm };
      }
      // 单点命中：先定期(index)，再取纵向最近的机构线。
      const onMove = ev => {
        const r = ev.currentTarget.getBoundingClientRect();
        const fx = (ev.clientX - r.left) / r.width * VBW;
        const fy = (ev.clientY - r.top) / r.height * VBH;
        const i = Math.max(0, Math.min(N - 1, Math.round((fx - PL) / stepX)));
        let li = 0, best = Infinity;
        meta.forEach((m, k) => { const d = Math.abs(y(m.pts[i]) - fy); if (d < best) { best = d; li = k; } });
        setHover({ i, li });
      };
      const hv = hover && meta[hover.li];
      const hvVal = hv && hv.pts[hover.i];
      const leftPct = hover ? x(hover.i) / VBW * 100 : 0;
      const topPct = hover ? y(hvVal) / VBH * 100 : 0;
      return (
        <div className="relative">
          <div className="relative">
            <svg viewBox={`0 0 ${VBW} ${VBH}`} className="h-[336px] w-full" role="img" aria-label="机构投诉变化趋势折线图" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
              <defs><linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={top.color} stopOpacity=".16"/><stop offset="100%" stopColor={top.color} stopOpacity="0"/></linearGradient></defs>
              {yTicks.map(value => <g key={value}><line x1={PL} x2={PR} y1={y(value)} y2={y(value)} stroke="#EEF1F5"/><text x={PL - 10} y={y(value) + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{Math.round(value)}</text></g>)}
              <path d={areaPath} fill="url(#trendArea)" />
              <line x1={PL} x2={PR} y1={PB} y2={PB} stroke="#CBD5E1"/><line x1={PL} x2={PL} y1={PT - 6} y2={PB} stroke="#CBD5E1"/>
              <text x="12" y="16" fontSize="11" fill="#94A3B8">{metricLabel || measure.label}（件）</text>
              {labels.map((m, i) => (N > 8 && i % 2 === 1) ? null : <text key={i} x={x(i)} y={PB + 20} textAnchor="middle" fontSize="10.5" fill="#94A3B8">{m}</text>)}
              {hover && <line x1={x(hover.i)} x2={x(hover.i)} y1={PT - 6} y2={PB} stroke="#CBD5E1" strokeDasharray="4 3"/>}
              {ordered.map(m => {
                const path = m.pts.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ');
                const showLabel = m.alerted || orgCount <= 5;
                return <g key={m.name} opacity={m.alerted ? 1 : .8}>
                  <path d={path} fill="none" stroke={m.color} strokeWidth={m.alerted ? 3 : 1.4}/>
                  <circle cx={x(N - 1)} cy={y(m.pts[N - 1])} r={m.alerted ? 3.5 : 2.2} fill="#fff" stroke={m.color} strokeWidth={m.alerted ? 2 : 1.4}/>
                  {showLabel && <text x={x(N - 1) + 12} y={y(m.pts[N - 1]) + 4} fontSize="11" fontWeight={m.alerted ? 600 : 400} fill={m.alerted ? m.color : '#94A3B8'}>{m.name} {Math.round(m.pts[N - 1])}</text>}
                </g>;
              })}
              {exPoint && !hover && <g>
                <circle cx={x(exPoint.i)} cy={y(exPoint.val)} r="8.5" fill="none" stroke={exPoint.tone === 'danger' ? '#E11D48' : '#F59E0B'} strokeWidth="2"/>
                <circle cx={x(exPoint.i)} cy={y(exPoint.val)} r="4" fill={exPoint.color} stroke="#fff" strokeWidth="2"/>
                <g transform={`translate(${x(exPoint.i)}, ${y(exPoint.val) - 16})`}>
                  <rect x="-30" y="-15" width="60" height="17" rx="8.5" fill="#E11D48"/>
                  <text x="0" y="-3" textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff">超阈点</text>
                </g>
              </g>}
              {hv && <g>
                {hv.alerted && <circle cx={x(hover.i)} cy={y(hvVal)} r="8.5" fill="none" stroke={hv.tone === 'danger' ? '#E11D48' : '#F59E0B'} strokeWidth="2"/>}
                <circle cx={x(hover.i)} cy={y(hvVal)} r="4.5" fill={hv.color} stroke="#fff" strokeWidth="2"/>
              </g>}
            </svg>
            {hv && (
              <div data-testid="institution-trend-tooltip" className="pointer-events-none absolute z-20 w-48 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl" style={{ left: leftPct + '%', top: topPct + '%', transform: `translate(${leftPct > 62 ? '-112%' : '14px'}, -50%)` }}>
                <div className="mb-1.5 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hv.color }} />
                  <span className="text-xs font-semibold text-slate-700">{hv.name}</span>
                  {hv.alerted && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ${hv.tone === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>预警</span>}
                </div>
                <div className="flex items-baseline justify-between"><span className="text-[11px] text-slate-400">{labels[hover.i]} · {metricLabel || measure.label}</span><span className="text-sm font-semibold tabular-nums text-slate-800">{Math.round(hvVal)} 件</span></div>
              </div>
            )}
          </div>
          {/* 图例移到底部 */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-4 rounded-full bg-violet-500" />触发预警</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-[2px] w-4 rounded-full bg-slate-300" />正常机构</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-rose-500" />超阈点</span>
            </div>
            <span className="text-slate-400">投诉变化异常时触发预警</span>
          </div>
        </div>
      );
    }

    function QualityHeatmap({ names, values }) {
      const [hover, setHover] = useState(null);
      const rows = names.map((name, index) => ({ name, value: +(100 - values[index]).toFixed(1) })).sort((a,b) => a.value - b.value);
      return <div className="relative" role="img" aria-label="机构达成一致率排名">
        <div className="relative ml-9 h-[235px] border-b border-l border-slate-300">
          {[60,70,80,90,100].map(tick=><React.Fragment key={tick}><span className="absolute -left-8 text-[10px] text-slate-400" style={{bottom:`${(tick-60)/40*100}%`,transform:'translateY(50%)'}}>{tick}%</span><span className="absolute left-0 right-0 border-t border-slate-100" style={{bottom:`${(tick-60)/40*100}%`}} /></React.Fragment>)}
          <div className="absolute inset-0 z-[2] flex items-end justify-around gap-5 px-7">{rows.map((row,index)=><button key={row.name} onMouseEnter={()=>setHover(index)} onMouseLeave={()=>setHover(null)} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end pt-5"><span className="mb-1 text-[11px] font-semibold text-slate-700">{row.value.toFixed(1)}%</span><span className="w-full max-w-[58px] rounded-t bg-violet-500 transition-all group-hover:brightness-95 group-hover:ring-2 group-hover:ring-violet-200" style={{height:`${Math.max(8,(row.value-60)/40*100)}%`}}/><span className="mt-2 whitespace-nowrap text-[11px] text-slate-600">{row.name}</span></button>)}</div>
        </div>
        {hover != null && <div className="pointer-events-none absolute right-3 top-3 z-20 w-44 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl"><div className="text-xs font-semibold text-slate-700">{rows[hover].name}</div><div className="mt-1 flex justify-between text-[11px]"><span className="text-slate-400">达成一致率</span><span className="font-semibold text-slate-700">{rows[hover].value.toFixed(1)}%</span></div></div>}
      </div>;
    }

    function RectificationSlope({ names, reductions, viewKey, valueFactor = 1 }) {
      const [hover, setHover] = useState(null);
      const metric = { label: '有效投诉量', unit: '件' };
      const complaintAfter = INSTITUTION_FOCUS_DATA.pressure.values[viewKey].map(value => Math.max(1, Math.round(value * valueFactor)));
      const after = complaintAfter;
      const decline = reductions, before=after.map((v,i)=>v/(1-decline[i]/100));
      const max=Math.max(...before)*1.08, x=v=>230+v/max*520, fmt=v=>Math.round(v);
      const reached=decline.filter(v=>v>=20).length, average=decline.reduce((a,b)=>a+b,0)/decline.length;
      return <div className="relative" role="img" aria-label="机构整改效果图">
        <svg viewBox="0 0 1010 235" className="h-[255px] w-full">
          <text x="230" y="18" fontSize="10" fill="#94A3B8">{metric.label}低</text><text x="700" y="18" fontSize="10" fill="#94A3B8">{metric.label}高</text><text x="850" y="18" fontSize="10" fill="#94A3B8">整改后降幅</text>
          {names.map((name,i)=>{const yy=48+i*36,ok=decline[i]>=20;return <g key={name} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} className="cursor-pointer"><rect x="10" y={yy-15} width="970" height="29" rx="6" fill={hover===i?'#E9F1FC':'transparent'}/><text x="22" y={yy+4} fontSize="11" fill="#475569">{name}</text><line x1={x(before[i])} y1={yy} x2={x(after[i])} y2={yy} stroke="#A7C7F2" strokeWidth="5" strokeLinecap="round"/><circle cx={x(before[i])} cy={yy} r="6" fill="#CBD5E1"/><circle cx={x(after[i])} cy={yy} r="7" fill="#185FBF"/><text x={x(before[i])} y={yy-10} textAnchor="middle" fontSize="9" fill="#64748B">{fmt(before[i])}</text><text x={x(after[i])} y={yy+17} textAnchor="middle" fontSize="9" fill="#185FBF">{fmt(after[i])}</text><text x="850" y={yy+4} fontSize="11" fontWeight="600" fill={ok?'#16A34A':'#D97706'}>↓{decline[i].toFixed(1)}%</text><text x="920" y={yy+4} fontSize="10" fill={ok?'#16A34A':'#D97706'}>{ok?'已达标':'待观察'}</text></g>})}
        </svg>
        {hover!=null&&<div className="pointer-events-none absolute right-8 top-12 z-20 w-52 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl"><div className="text-xs font-semibold text-slate-700">{names[hover]}</div><div className="mt-1 flex justify-between text-[11px]"><span className="text-slate-400">整改前观察期</span><span>{fmt(before[hover])}{metric.unit}</span></div><div className="mt-1 flex justify-between text-[11px]"><span className="text-slate-400">整改后观察期</span><span className="font-semibold text-violet-600">{fmt(after[hover])}{metric.unit}</span></div><div className="mt-1 flex justify-between text-[11px]"><span className="text-slate-400">降幅</span><span className={decline[hover]>=20?'font-semibold text-emerald-600':'font-semibold text-amber-600'}>{decline[hover].toFixed(1)}%</span></div></div>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500"><div className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />整改前</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" />整改后</span></div><span>整改后降幅≥20% 判定达标</span></div>
      </div>;
    }

    function Institution2Panel({ focusKey, viewKey, wide = false, namesOverride, alertRows = [], startDate, endDate, rangeTotal, filterContext = {}, regulatoryThreshold, efficiencyDurationThreshold, efficiencyCompletionThreshold, onConfigureRiskThreshold, onConfigureEfficiencyThreshold }) {
      const focus = INSTITUTION_FOCUS_DATA[focusKey];
      const names = namesOverride || INSTITUTION_NAMES[viewKey];
      const rankedMetricRows=names.map((name,index)=>({name,value:institutionFocusValue(focusKey,viewKey,name,index)})).sort((left,right)=>right.value-left.value);
      const displayedRows=['pressure','regulatory','efficiency','quality'].includes(focusKey)?rankedMetricRows.slice(0,5):rankedMetricRows;
      const displayNames=displayedRows.map(row=>row.name);
      const baseValues=displayedRows.map(row=>row.value);
      const volumeFactor = filterContext.volumeFactor || 1;
      const metricLabel = filterContext.metricLabel || '有效投诉量';
      // 数量、风险、效率、质量和整改结果均继承同一查询样本；不同指标按各自业务含义使用缩放或轻量重算。
      const excludedAdjustment = 1 - (filterContext.excluded || []).length * .006;
      const caliberAdjustment = filterContext.caliber === '有责投诉' ? .965 : filterContext.caliber === '有效投诉' ? .985 : 1;
      const compareAdjustment = filterContext.compare === '同比' ? 1.018 : 1;
      const channelAdjustment = filterContext.channel === '监管转送' ? 1.035 : filterContext.channel === '自收投诉' ? .982 : 1;
      const dateAdjustment = 1 + ((filterContext.dateFactor || 1) - 1) * .04;
      const sampleAdjustment = dateAdjustment * channelAdjustment * caliberAdjustment * excludedAdjustment * compareAdjustment;
      const values = focusKey === 'pressure' ? baseValues.map(value => Math.max(1, Math.round(value * volumeFactor)))
        : focusKey === 'regulatory' ? baseValues.map(value => +(value * sampleAdjustment).toFixed(1))
        : focusKey === 'efficiency' || focusKey === 'quality' ? baseValues.map(value => +(value * sampleAdjustment).toFixed(1))
        : focusKey === 'rectification' ? baseValues.map(value => +Math.max(0, value * sampleAdjustment).toFixed(1))
        : baseValues;
      const [trendMeasure, setTrendMeasure] = useState('valid');
      const [trendGran, setTrendGran] = useState('month');
      const [trendTopN, setTrendTopN] = useState('5');
      const useLongTrendGranularity=statisticsRangeExceedsTwelveMonths(startDate,endDate);
      const trendGranularities=useLongTrendGranularity?LONG_TREND_GRANULARITIES:TREND_GRANS;
      React.useEffect(()=>{
        if(!trendGranularities.some(option=>option.key===trendGran))setTrendGran(useLongTrendGranularity?'quarter':'month');
      },[useLongTrendGranularity]);
      const regulatoryCompare = filterContext.compare === '同比' ? 'yoy' : 'mom';
      const rectDeclines = values;
      const rectReached = rectDeclines.filter(value => value >= 20).length;
      const rectAverage = rectDeclines.reduce((sum,value) => sum + value, 0) / rectDeclines.length;
      const visualTitle = { pressure:`机构${metricLabel}排名`, regulatory:'监管风险机构分布', trend:'投诉变化趋势', efficiency:'处理效率机构分布', quality:'机构达成一致率排名', rectification:'整改效果' }[focusKey];
      const scaledRangeTotal = (parseFloat(String(rangeTotal || '').replace(/,/g, '')) || 0) * volumeFactor;
      const visual = names.length===0 ? <div className="grid h-[270px] place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-400">请先在顶部选择机构</div>
        : focusKey === 'pressure' ? <RankingVisual names={displayNames} values={values} focus={focus} viewKey={viewKey} alertRows={alertRows} rangeTotal={scaledRangeTotal} topNKey="5" metricLabel={metricLabel} compareMode={filterContext.compare || '环比'} />
        : focusKey === 'regulatory' ? (filterContext.channel === '自收投诉' ? <div className="grid h-[270px] place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50/60 text-center"><div><div className="text-sm font-medium text-slate-600">当前渠道不包含监管转送投诉</div><div className="mt-1 text-xs text-slate-400">请选择“全部渠道”或“监管转送”查看监管风险机构分布</div></div></div> : <QuadrantVisual names={displayNames} values={values} viewKey={viewKey} type="regulatory" compareMode={regulatoryCompare} regulatoryThreshold={regulatoryThreshold} onConfigureThreshold={onConfigureRiskThreshold} />)
        : focusKey === 'trend' ? <TrendVisual names={names} viewKey={viewKey} alertRows={alertRows} startDate={startDate} endDate={endDate} measureKey={trendMeasure} granKey={trendGran} topNKey={trendTopN} filterFactor={volumeFactor} metricLabel={metricLabel} />
        : focusKey === 'efficiency' ? <QuadrantVisual names={displayNames} values={values} viewKey={viewKey} type="efficiency" efficiencyDurationThreshold={efficiencyDurationThreshold} efficiencyCompletionThreshold={efficiencyCompletionThreshold} onConfigureThreshold={onConfigureEfficiencyThreshold} />
        : focusKey === 'quality' ? <QualityHeatmap names={displayNames} values={values} />
        : <RectificationSlope names={names} reductions={values} viewKey={viewKey} valueFactor={volumeFactor} />;
      const method = INSTITUTION2_METHODS[focusKey];
      const managementValue = {
        pressure:'识别有效投诉量最高、投诉占比较大的机构，判断投诉压力是否集中，为重点关注机构确定和处理资源配置提供依据。',
        regulatory:'识别监管投诉占比较高且仍在增长的机构，提前判断监管处置压力并确定优先核查对象。',
        trend:'识别投诉增长最快及持续上升的机构，判断风险是单期波动还是趋势性恶化，及时发现新的风险热点。',
        efficiency:'识别平均处理时间较长、按时办结率偏低的机构，定位流程协同和责任认定方面的效率问题。',
        quality:'识别达成一致率较低的机构，判断投诉处理结果是否获得客户认可，降低重复投诉和监管升级风险。',
        rectification:'验证重点机构整改后有效投诉量是否下降，识别整改未达标机构，并推动重新评估整改措施。'
      }[focusKey];
      const methodInfo = {title:focus.label,question:focus.question,caliber:method.caliber,value:managementValue,source:method.source};
      const trendSelectCls = "h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none focus:border-violet-400";
      return (
        <article data-testid={`institution2-${focusKey}`} className={`${wide ? 'col-span-2' : ''} overflow-visible rounded-lg border border-slate-200 bg-white shadow-card`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2"><span className="rounded bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">{focus.label}</span><span className="text-xs text-slate-400">{focus.question}</span></div>
            </div>
            <div className="flex items-center gap-2">
            {focusKey === 'trend' && <>
              <div data-testid="institution-trend-granularity" className="flex items-center rounded-md border border-slate-200 p-0.5 text-xs">{trendGranularities.map(g => <button key={g.key} onClick={() => setTrendGran(g.key)} className={`rounded px-3 py-1 transition ${trendGran === g.key ? 'bg-violet-600 font-medium text-white' : 'text-slate-500 hover:text-slate-700'}`}>{g.label}</button>)}</div>
              <select aria-label="展示范围" value={trendTopN} onChange={ev => setTrendTopN(ev.target.value)} className={trendSelectCls}>{TREND_TOPN.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
            </>}
            <span data-testid={`institution2-method-${focusKey}`}><CompactInfoPopover info={methodInfo} ariaLabel={`查看${focus.label}指标说明`}/></span>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-700">{visualTitle}</h3>{focusKey==='rectification'&&<div className="flex gap-2 text-[11px]"><span className="rounded bg-emerald-50 px-2.5 py-1 text-emerald-700">达标 <b>{rectReached}</b> 家</span><span className="rounded bg-violet-50 px-2.5 py-1 text-violet-700">平均降幅 <b>{rectAverage.toFixed(1)}%</b></span><span className="rounded bg-amber-50 px-2.5 py-1 text-amber-700">未达标 <b>{names.length-rectReached}</b> 家</span></div>}</div>
            {visual}
          </div>

        </article>
      );
    }

    function InstitutionAnalysis2Page() {
      // 从首页异常机构进入时，保留机构、日期和对比方式，并自动定位趋势区域。
      const initialDrilldown = useMemo(() => window.__INSTITUTION_DRILLDOWN__ || null, []);
      const initialParentOrg = initialDrilldown?.parentOrg && FIRST_LEVEL_ORG_DATA[initialDrilldown.parentOrg] ? initialDrilldown.parentOrg : '全行';
      const [draftOrg, setDraftOrg] = useState(initialParentOrg);
      const [selectedOrg, setSelectedOrg] = useState(initialParentOrg);
      const [startDate, setStartDate] = useState(initialDrilldown?.startDate || '2026-07-01');
      const [endDate, setEndDate] = useState(initialDrilldown?.endDate || '2026-07-15');
      const [showAlertDetail, setShowAlertDetail] = useState(false);
      const [showCompareConfig, setShowCompareConfig] = useState(false);
      const [showCompareResult, setShowCompareResult] = useState(false);
      const [showRiskThresholdConfig, setShowRiskThresholdConfig] = useState(false);
      const [regulatoryShareThreshold, setRegulatoryShareThreshold] = useState(15);
      const [regulatoryShareThresholdDraft, setRegulatoryShareThresholdDraft] = useState('15');
      const [showEfficiencyThresholdConfig, setShowEfficiencyThresholdConfig] = useState(false);
      const [efficiencyDurationThreshold, setEfficiencyDurationThreshold] = useState(5.5);
      const [efficiencyCompletionThreshold, setEfficiencyCompletionThreshold] = useState(85);
      const [efficiencyDurationThresholdDraft, setEfficiencyDurationThresholdDraft] = useState('5.5');
      const [efficiencyCompletionThresholdDraft, setEfficiencyCompletionThresholdDraft] = useState('85.0');
      const [compareOrgs, setCompareOrgs] = useState(['厦门分行', '福州分行', '珠海分行']);
      const [compareMetric, setCompareMetric] = useState('投诉口径');
      const [compareDimension, setCompareDimension] = useState('投诉口径');
      const [compareIndicator, setCompareIndicator] = useState('投诉口径');
      const [compareDisplay, setCompareDisplay] = useState('占比');
      const [compareChart, setCompareChart] = useState('100%堆叠图');
      // 机构分析复用投诉总览筛选结果，确保顶部指标与查询条件同步联动。
      const [institutionChannel, setInstitutionChannel] = useState('全部渠道');
      const [institutionCaliber, setInstitutionCaliber] = useState('全部受理');
      const [institutionCompare, setInstitutionCompare] = useState(initialDrilldown?.compare || '环比');
      const [institutionOrganizationDimension, setInstitutionOrganizationDimension] = useState('处理机构');
      const [institutionOrganizationField, setInstitutionOrganizationField] = useState('工单接收机构');
      const [institutionExcluded, setInstitutionExcluded] = useState(['重复投诉', '异常投诉', '废止投诉']);
      const [institutionLineSelection, setInstitutionLineSelection] = useState(allBusinessLines());
      const [institutionOrgSelection, setInstitutionOrgSelection] = useState(()=>initialOrganizationSelection(initialDrilldown?'':'all',initialDrilldown?[initialParentOrg]:[]));
      const selectedInstitutionNames=selectedOrganizationLabels(institutionOrgSelection);
      const hasDefaultInstitutionScope=institutionOrgSelection?.isAll&&institutionLineSelection.length===BUSINESS_LINE_OPTIONS.length;
      const chartInstitutionNames=hasDefaultInstitutionScope?selectedInstitutionNames.filter(name=>name!=='总行'):selectedInstitutionNames;
      const baseAlertRows = (ALERT_DETAIL_DATA[selectedOrg] || []).filter(row=>selectedInstitutionNames.includes(row.name));
      const orgData = FIRST_LEVEL_ORG_DATA[selectedOrg];
      const viewKey = orgData.viewKey;
      React.useEffect(() => {
        if (!initialDrilldown) return;
        const timer = window.setTimeout(() => getStatisticsRoot()?.querySelector('[data-testid="institution2-trend"]')?.scrollIntoView({behavior:'smooth', block:'start'}), 180);
        window.__INSTITUTION_DRILLDOWN__ = null;
        return () => window.clearTimeout(timer);
      }, []);
      const runQuery = () => setSelectedOrg(draftOrg);
      const scopeLabel = selectedOrg === '全行' ? '一级机构' : '下辖机构';
      const compareOrgOptions = selectedInstitutionNames;
      const compareDimensions = {
        '投诉量': ['有效投诉量', '有责投诉量', '其他'],
        '投诉口径': ['有效投诉量', '有责投诉量', '其他'],
        '监管投诉占比': ['监管转送投诉', '自收投诉'],
        '监管转送/自收投诉': ['监管转送投诉', '自收投诉'],
        '产品类型': ['贷款', '存款', '财富管理', '支付结算', '电子银行'],
        '原因类型': ['贷款利率', '贷款申请/取消', '贷款审批', '贷款签约', '个人短信通知业务', '个人信息采集与泄露', '公积金提取规则/政策', '对公投资理财', '对公银行卡', '对公账户公积金业务', '其他'],
        '条线类型': ['零售金融部', '普惠金融部', '公司金融部', '消费者权益保护部', '运营管理部', '风险管理部', '安全保卫部/总务部', '授信审批部', '华侨金融部', '特殊资产经营部', '其他'],
        '投诉受理渠道': ['客服电话','在线客服','总行投诉邮箱','机构专线电话','营业网点','客户意见薄','信函','厦门金管局','属地金管局','金融消费者保护服务平台','市长热线','其它'],
        '业务办理渠道': ['第三方合作平台', '电子银行', '营业网点柜面', '其他'],
        '客户类型': ['30—39岁', '40—49岁', '50—59岁', '18—29岁', '60岁及以上', '18岁以下', '未知'],
        '客户年龄': ['30—39岁', '40—49岁', '50—59岁', '18—29岁', '60岁及以上', '18岁以下', '未知']
      };
      const compareShareTemplates = {
        '投诉量': [62, 26, 12],
        '投诉口径': [62, 26, 12],
        '监管投诉占比': [14, 86],
        '监管转送/自收投诉': [14, 86],
        '产品类型': [34, 22, 18, 15, 11],
        '原因类型': [18, 14, 12, 10, 9, 8, 7, 6, 5, 4, 7],
        '条线类型': [24, 19, 14, 10, 8, 6, 5, 4, 3, 3, 4],
        '客户类型': [26, 23, 17, 15, 12, 5, 2],
        '客户年龄': [26, 23, 17, 15, 12, 5, 2]
      };
      const compareColors = ['#185FBF', '#2272DE', '#4B8FEA', '#70A7EC', '#8A8FE7', '#6C74D9', '#58A6B8', '#65B890', '#E0A84A', '#D77868', '#94A3B8', '#64748B'];
      const categories = compareDimensions[compareDimension];
      const totalByOrg = {'北京分行':584, '厦门分行':836, '珠海分行':628, '龙岩分行':388, '漳州分行':462, '三明分行':356, '上海分行':742, '福州分行':691, '宁德分行':526, '泉州分行':603, '莆田分行':426, '南平分行':318};
      const effectiveCompareOrgs=compareOrgs.filter(org=>selectedInstitutionNames.includes(org));
      const comparisonRows = effectiveCompareOrgs.map((org, orgIndex) => {
        const template = compareShareTemplates[compareDimension];
        let shares = (template || categories.map(() => 1)).map((value, categoryIndex) => Math.max(1, value + (((organizationSeed(org, orgIndex) + categoryIndex * 7) % 7) - 3)));
        const sum = shares.reduce((total, value) => total + value, 0);
        shares = shares.map((value, index) => index === shares.length - 1 ? Math.round((100 - shares.slice(0, -1).reduce((total, item) => total + Math.round(item / sum * 1000) / 10, 0)) * 10) / 10 : Math.round(value / sum * 1000) / 10);
        return {org, total: totalByOrg[org]||Math.max(1,Math.round(360*(.7+(organizationSeed(org,orgIndex)%41)/100))), shares};
      });
      const toggleCompareOrg = (org) => {
        if (effectiveCompareOrgs.includes(org)) {
          if (effectiveCompareOrgs.length > 2) setCompareOrgs(effectiveCompareOrgs.filter(item => item !== org));
        } else if (effectiveCompareOrgs.length < 10) setCompareOrgs([...effectiveCompareOrgs, org]);
      };
      const numberOf = value => Number(String(value).replace(/,/g, '')) || 0;
      const receivedCount = numberOf(orgData.received);
      const validCount = numberOf(orgData.valid);
      const responsibleCount = Math.round(validCount * 0.66);
      const regulatoryValidCount = numberOf(orgData.regVolume);
      const regulatoryReceivedCount = Math.round(regulatoryValidCount / 0.94);
      const regulatoryResponsibleCount = Math.round(regulatoryValidCount * 0.66);
      const baseCount = institutionCaliber === '有效投诉' ? validCount : institutionCaliber === '有责投诉' ? responsibleCount : receivedCount;
      const regulatoryBaseCount = institutionCaliber === '有效投诉' ? regulatoryValidCount : institutionCaliber === '有责投诉' ? regulatoryResponsibleCount : regulatoryReceivedCount;
      const exclusionFactor = (institutionExcluded.includes('重复投诉') ? 0.9771 : 1) * (institutionExcluded.includes('异常投诉') ? 0.9949 : 1) * (institutionExcluded.includes('废止投诉') ? 0.998 : 1);
      const selectedDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
      const dateFactor = Math.min(2, Math.max(.2, selectedDays / 15));
      const caliberFactor = receivedCount ? baseCount / receivedCount : 1;
      const channelFactor = baseCount ? (institutionChannel === '监管转送' ? regulatoryBaseCount / baseCount : institutionChannel === '自收投诉' ? (baseCount - regulatoryBaseCount) / baseCount : 1) : 1;
      const scopedSample=linkedAnalysisFactor({channel:institutionChannel,caliber:institutionCaliber,compare:institutionCompare,organizationDimension:institutionOrganizationDimension,organizationField:institutionOrganizationField,excluded:institutionExcluded,lineSelection:institutionLineSelection,orgSelection:institutionOrgSelection},startDate,endDate,'全行');
      const allSample=linkedAnalysisFactor({channel:institutionChannel,caliber:institutionCaliber,compare:institutionCompare,organizationDimension:institutionOrganizationDimension,organizationField:institutionOrganizationField,excluded:institutionExcluded},startDate,endDate,'全行');
      const institutionScopeFactor=allSample ? scopedSample/allSample : 0;
      // 占比的分子、分母使用完全相同的日期、条线、渠道、口径、机构字段和剔除规则，分母仅将机构范围还原为全行。
      const institutionShareFilter={channel:institutionChannel,caliber:institutionCaliber,compare:institutionCompare,organizationDimension:institutionOrganizationDimension,organizationField:institutionOrganizationField,excluded:institutionExcluded,lineSelection:institutionLineSelection};
      const selectedInstitutionSample=linkedAnalysisFactor({...institutionShareFilter,orgSelection:institutionOrgSelection},startDate,endDate,'全行');
      const fullBankSample=linkedAnalysisFactor({...institutionShareFilter,orgSelection:allOrganizationSelection()},startDate,endDate,'全行');
      const selectedInstitutionShare=institutionOrgSelection?.isAll?100:(fullBankSample?Math.min(100,selectedInstitutionSample/fullBankSample*100):0);
      const volumeFactor = dateFactor * caliberFactor * channelFactor * exclusionFactor * institutionScopeFactor;
      const mainCount = Math.round(receivedCount * volumeFactor);
      // 重复投诉和异常/黑灰产投诉直接沿用投诉总览同层级口径：全行取总览值，分行按总览分行样例比例折算。
      const overviewReferenceCards = OVERVIEW2_DATA[viewKey].cards;
      const subsetFactor = dateFactor * caliberFactor * channelFactor;
      const repeatBaseCount = viewKey === 'headOffice' ? numberOf(overviewReferenceCards.repeat.value) : Math.max(1, Math.round(validCount * 32 / 836));
      const repeatCount = Math.max(0, Math.round(repeatBaseCount * subsetFactor));
      const specialReferenceCount = viewKey === 'headOffice' ? numberOf(overviewReferenceCards.special.value) : Math.max(1, Math.round(validCount * 11 / 836));
      const specialBaseCount = Math.max(0, Math.round(specialReferenceCount * subsetFactor));
      const abnormalCount = viewKey === 'headOffice' ? 41 : Math.max(1, Math.round(specialBaseCount * 7 / 11));
      const blackCount = Math.max(0, specialBaseCount - abnormalCount);
      const specialCount = abnormalCount + blackCount;
      const caliberPrefix = institutionCaliber === '全部受理' ? '受理' : institutionCaliber.replace('投诉', '');
      const mainLabel = institutionChannel === '监管转送' ? '监管投诉' : institutionChannel === '自收投诉' ? '自收投诉' : '投诉规模';
      const mainValueLabel = institutionChannel === '监管转送' ? `${caliberPrefix}监管投诉量` : institutionChannel === '自收投诉' ? `${caliberPrefix}自收投诉量` : institutionCaliber === '全部受理' ? '受理投诉总量' : `${institutionCaliber}总量`;
      const alertSampleFactor = Math.min(1, dateFactor * caliberFactor * channelFactor * exclusionFactor);
      const dynamicAlertCount = Math.min(baseAlertRows.length, Math.max(institutionChannel === '监管转送' ? 1 : 0, Math.round(baseAlertRows.length * alertSampleFactor)));
      const alertRows = baseAlertRows.slice(0, dynamicAlertCount);
      const filterSummary='';
      const institutionFilterContext = {channel:institutionChannel,caliber:institutionCaliber,compare:institutionCompare,organizationDimension:institutionOrganizationDimension,organizationField:institutionOrganizationField,excluded:institutionExcluded,dateFactor,volumeFactor,metricLabel:mainValueLabel,summary:filterSummary};
      const linkedComparisonRows = comparisonRows.map(row => ({...row,total:Math.max(0,Math.round(row.total * volumeFactor))}));
      const deltaMap = {环比:{main:'6.8%',regulatory:'4.2%',self:'7.1%',repeat:'-3.1%',special:'11.5%'},同比:{main:'12.3%',regulatory:'9.6%',self:'12.6%',repeat:'5.4%',special:'18.2%'}};
      const selectedDelta = deltaMap[institutionCompare];
      const mainDelta = institutionChannel === '监管转送' ? selectedDelta.regulatory : institutionChannel === '自收投诉' ? selectedDelta.self : selectedDelta.main;
      const kpiCards = [
        {
          key: 'main', icon: institutionChannel === '监管转送' ? 'shield' : 'file', accent: 'text-violet-600', soft: 'bg-violet-50', label: mainLabel,
          value: mainCount.toLocaleString('zh-CN'), unit: '件', sub: mainValueLabel, note: institutionExcluded.length ? `已剔除：${institutionExcluded.join('、')}` : `${institutionCompare} ${mainDelta}`,
          question: institutionChannel === '监管转送' ? '当前机构的监管投诉压力有多大？' : institutionChannel === '自收投诉' ? '当前机构自行受理了多少投诉？' : '当前机构总体投诉规模是否正常？',
          managementValue: '统一呈现当前查询口径下的投诉规模，并随机构、渠道、投诉口径及剔除规则联动，帮助管理层判断当前机构投诉压力。',
          source: '工单编号、客户投诉时间、投诉责任机构、受理渠道、有效投诉标识、有责投诉标识、重复投诉标识、异常投诉标识、废止标识。',
          caliber: `${mainValueLabel}＝统计期内符合“${institutionCaliber}、${institutionChannel}”及当前剔除规则的工单编号去重数。`,
          judgement: `${institutionCompare} ${mainDelta}；结合机构排名和趋势判断增长是否集中于个别机构。`,
          action: '投诉规模上升时，下钻机构排名、产品、原因和渠道，定位增量来源并配置处理资源。'
        },
        {
          key: 'repeat', icon: overviewReferenceCards.repeat.icon, accent: 'text-violet-600', soft: 'bg-violet-50', label: overviewReferenceCards.repeat.title,
          value: repeatCount.toLocaleString('zh-CN'), unit: overviewReferenceCards.repeat.unit, sub: '', note: `${institutionCompare} ${selectedDelta.repeat}`,
          question: overviewReferenceCards.repeat.question, managementValue: overviewReferenceCards.repeat.managementValue,
          source: '工单编号、是否再次投诉、关联工单编号、投诉责任机构、有效投诉标识、投诉原因、处理结果。',
          caliber: '重复投诉量＝统计期内“是否再次投诉＝是”的投诉工单编号去重数，并通过关联工单追溯首次投诉。',
          judgement: '重复投诉量或增幅较高，说明首次处理可能未解决根因。',
          action: '下钻重复投诉明细，定位集中原因、产品和责任机构，复核首次处理结果。'
        },
        {
          key: 'special', icon: overviewReferenceCards.special.icon, accent: 'text-violet-600', soft: 'bg-violet-50', label: overviewReferenceCards.special.title,
          value: specialCount.toLocaleString('zh-CN'), unit: overviewReferenceCards.special.unit, sub: `异常投诉 ${abnormalCount} 件 · 黑灰产投诉 ${blackCount} 件`, note: `${institutionCompare} ${selectedDelta.special}`,
          question: overviewReferenceCards.special.question, managementValue: overviewReferenceCards.special.managementValue,
          source: '工单编号、异常投诉标识、黑灰产投诉标识、核验状态、投诉责任机构、客户及联系方式。',
          caliber: '异常/黑灰产投诉量＝“异常投诉＝是”或“黑灰产投诉＝是”的工单编号并集去重数。',
          judgement: '规模或增幅明显上升时，应关注是否出现集中发起、模板化表达或同源联系方式。',
          action: '查看投诉明细并开展身份、联系方式及投诉行为核验，按核验结果分类处置。'
        },
        {
          key: 'alert', icon: 'alert', accent: 'text-rose-600', soft: 'bg-rose-50', label: '投诉激增预警',
          value: alertRows.length, unit: '家', sub: '阈值说明：环比＞20%、同比＞30%', note: '',
          question: '哪些机构的投诉量正在异常增长？', managementValue: '同时识别短期突发和持续恶化机构，帮助管理层优先核查双重超阈机构及新增风险来源。',
          source: '工单编号、客户投诉时间、投诉责任机构、有效投诉标识、当前周期投诉量、上一周期投诉量、上年同期投诉量、预警阈值配置。',
          caliber: '统计周期内，机构有效投诉量环比＞环比阈值（默认20%）或 同比＞同比阈值（默认30%）即触发预警，统计触发机构数。环比＝（本期－上期）÷上期；同比＝（本期－上年同期）÷上年同期。阈值在“标签与口径管理”按机构层级配置。',
          judgement: '环比预警捕捉短期突发、同比预警识别持续恶化；环比与同比“双超”的机构是重点异常，须优先处置。',
          action: '展开预警机构明细，优先核查双超机构；结合“近6个月投诉变化”确认是趋势性上升还是单期波动。'
        },
        {
          key: 'scopeShare', icon: 'chart', accent: 'text-violet-600', soft: 'bg-violet-50', label: '所选机构投诉量占比',
          value: selectedInstitutionShare.toFixed(1), unit: '%', sub: `${institutionOrgSelection?.queryLabel||selectedOrg}投诉量 ÷ 全行投诉量`, note: '',
          question: '查询栏所选机构的投诉量占全行多少？', managementValue: '衡量当前所选机构范围对全行投诉规模的贡献，帮助识别投诉集中程度。',
          source: '工单编号、客户投诉时间、查询栏机构范围、所属业务条线、受理渠道、投诉口径、机构字段及剔除规则。',
          caliber: '所选机构投诉量占比＝查询栏所选机构投诉量÷全行投诉量×100%。分子和分母均继承当前日期、条线、渠道、投诉口径、机构字段和剔除规则；机构范围为全行时占比为100%。',
          judgement: '占比越高，说明当前所选机构范围在全行投诉规模中的贡献越集中。',
          action: '结合机构排名和投诉趋势继续定位贡献较高的分行或支行。'
        }
      ];
      return (
        <div className="mx-auto max-w-[1540px] px-6 py-5">
          <nav className="mb-4 flex items-center gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">机构分析</span></nav>

          <section className="mb-4 flex items-end justify-between">
            <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">机构分析</h1></div>
            <div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />数据更新时间：2026-07-15 12:00</div>
          </section>

          <ComplaintAnalysisFilters pageKey="institution" initialOrg={initialDrilldown ? '' : 'all'} initialBranches={initialDrilldown ? [initialParentOrg] : []} initialCompare={initialDrilldown?.compare || '环比'} auxiliaryControls={<button type="button" onClick={() => setShowCompareConfig(true)} className="inline-flex h-7 items-center gap-1 rounded border border-violet-200 bg-white px-2.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50"><span className="text-sm leading-none">＋</span>自定义机构对比</button>} startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onOrgChange={(org)=>setSelectedOrg(org.startsWith('全行') ? '全行' : FIRST_LEVEL_ORG_DATA[org] ? org : '全行')} onFilterChange={(changes)=>{
            if (changes.channel) setInstitutionChannel(changes.channel);
            if (changes.caliber) setInstitutionCaliber(changes.caliber);
            if (changes.compare) setInstitutionCompare(changes.compare);
            if (changes.excluded) setInstitutionExcluded(changes.excluded);
            if (changes.lineSelection) setInstitutionLineSelection(changes.lineSelection);
            if (changes.orgSelection) setInstitutionOrgSelection(changes.orgSelection);
            if (changes.organizationDimension) setInstitutionOrganizationDimension(changes.organizationDimension);
            if (changes.organizationField) setInstitutionOrganizationField(changes.organizationField);
          }} onQuery={({org, orgSelection, lineSelection, channel, caliber, compare, organizationDimension, organizationField, excluded})=>{
            setSelectedOrg(org.startsWith('全行') ? '全行' : FIRST_LEVEL_ORG_DATA[org] ? org : '全行');
            setInstitutionOrgSelection(orgSelection);
            setInstitutionLineSelection(lineSelection);
            setInstitutionChannel(channel);
            setInstitutionCaliber(caliber);
            setInstitutionCompare(compare);
            setInstitutionOrganizationDimension(organizationDimension);
            setInstitutionOrganizationField(organizationField);
            setInstitutionExcluded(excluded);
          }}/>

          {initialDrilldown && (
            <section className="mb-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-5 py-3 text-xs">
              <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-rose-100 text-rose-600"><Icon name="alert" size={16}/></span><div><b className="text-slate-700">已定位：{initialDrilldown.focusOrg}</b><p className="mt-0.5 text-[11px] text-slate-500">触发{initialDrilldown.compare}预警 {initialDrilldown.change}，下方已定位至投诉变化趋势。</p></div></div>
              <button onClick={() => setShowAlertDetail(true)} className="rounded-md border border-rose-200 bg-white px-3 py-2 font-medium text-rose-600">查看预警依据</button>
            </section>
          )}

          {showCompareResult && (
            <section data-testid="institution-compare-result" className="view-enter mb-4 overflow-hidden rounded-lg border border-violet-200 bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div><div className="flex items-center gap-2"><span className="rounded bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">自定义机构对比</span><h2 className="text-sm font-semibold text-slate-800">{compareDimension}构成横向比较</h2></div></div>
                <div className="ml-auto flex items-center"><button onClick={() => setShowCompareConfig(true)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-violet-300">重新配置</button></div>
              </div>
              <div className="p-5">
                <div>
                  <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">{categories.map((category,index)=><span key={category} data-testid="institution-compare-legend-item" className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2.5 w-2.5 rounded-sm" style={{backgroundColor:compareColors[index%compareColors.length]}}/>{category}</span>)}</div>
                  <div className="space-y-4">{linkedComparisonRows.map(row=><div key={row.org} data-testid="institution-compare-row" className="grid grid-cols-[76px_1fr_58px] items-center gap-3"><button className="text-left text-xs font-medium text-slate-700 hover:text-violet-700">{row.org}</button><div className="flex h-7 overflow-hidden rounded bg-slate-100">{row.shares.map((share,index)=><button key={categories[index]} data-testid="institution-compare-segment" data-share={share} title={`${row.org} · ${categories[index]}：${compareDisplay==='占比'?`${share.toFixed(1)}%`:`${Math.round(row.total*share/100)}件`}`} className="flex min-w-0 items-center justify-center overflow-hidden text-[10px] font-medium text-white transition hover:brightness-95" style={{width:`${share}%`,backgroundColor:compareColors[index%compareColors.length]}}>{share >= 12 ? `${share.toFixed(1)}%` : ''}</button>)}</div><div className="text-right text-[11px] text-slate-400">{row.total}件</div></div>)}</div>
                </div>
              </div>
              <div className="overflow-x-auto border-t border-slate-100 px-5 pb-5 pt-3"><table data-testid="institution-compare-table" className="w-full text-xs"><thead><tr className="text-slate-400"><th className="py-2 text-left font-medium">机构</th>{categories.map(item=><th key={item} data-testid="institution-compare-table-category" className="px-3 py-2 text-right font-medium">{item}</th>)}<th className="px-3 py-2 text-right font-medium">{mainValueLabel}</th></tr></thead><tbody>{linkedComparisonRows.map(row=><tr key={row.org} className="border-t border-slate-100 text-slate-600"><td className="py-2.5 font-medium text-slate-700">{row.org}</td>{row.shares.map((share,index)=><td key={categories[index]} className="px-3 py-2.5 text-right tabular-nums">{Math.round(row.total*share/100)}件</td>)}<td className="px-3 py-2.5 text-right tabular-nums">{row.total}件</td></tr>)}</tbody></table></div>
            </section>
          )}

          <section data-testid="institution2-summary" className="mb-4 grid grid-cols-5 items-stretch gap-4">
            {kpiCards.map((item) => {
              const info = {title:item.label,question:item.question,caliber:item.caliber,value:item.managementValue,source:item.source};
              const compareValue=item.key==='main'?mainDelta:item.key==='repeat'?selectedDelta.repeat:item.key==='special'?selectedDelta.special:item.key==='scopeShare'?'所选÷全行':`+${alertRows.length?1:0} 家`;
              const detail=item.key==='main'?(institutionExcluded.length?`已剔除：${institutionExcluded.join('、')}`:item.sub):item.sub;
              const action=item.key==='alert'?<button onClick={() => setShowAlertDetail(true)} className="inline-flex items-center gap-0.5 text-[11px] font-medium text-rose-600 hover:text-rose-700">查看明细<Icon name="chevron" size={12}/></button>:null;
              return <AnalysisMetricCard key={item.key} label={item.label} value={item.value} unit={item.unit} detail={detail} compareLabel={institutionCompare} compareValue={compareValue} icon={item.icon} accent={item.key==='alert'?'#DC4C64':'#2272DE'} soft={item.key==='alert'?'#FFF0F3':'#E9F1FC'} info={info} action={action} showComparison={item.key!=='alert'&&item.key!=='scopeShare'}/>;
            })}
          </section>

          {showAlertDetail && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-6" onClick={() => setShowAlertDetail(false)}>
              <div data-testid="institution2-alert-detail" className="view-enter w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-rose-50 text-rose-600"><Icon name="alert" size={14} /></span>
                    <h3 className="text-sm font-semibold text-slate-700">投诉激增预警明细</h3>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">{alertRows.length} 家触发</span>
                  </div>
                  <button onClick={() => setShowAlertDetail(false)} aria-label="关闭" className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="close" size={16} /></button>
                </div>
                <div className="border-b border-slate-100 px-5 py-2 text-[11px] text-slate-400">{institutionOrgSelection?.queryLabel||selectedOrg}范围 · 环比＞20% 或 同比＞30% 触发；阈值可在“标签与口径管理”配置</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] text-slate-400">
                      <th className="px-5 py-2.5 text-left font-medium">{selectedOrg === '全行' ? '机构' : '下辖机构'}</th>
                      <th className="px-4 py-2.5 text-right font-medium">本期有效投诉量</th>
                      <th className="px-4 py-2.5 text-right font-medium">环比</th>
                      <th className="px-4 py-2.5 text-right font-medium">同比</th>
                      <th className="px-5 py-2.5 text-center font-medium">触发类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertRows.map(row => {
                      const momHit = parseFloat(row.mom) > 20;
                      const yoyHit = parseFloat(row.yoy) > 30;
                      return (
                        <tr key={row.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-600">{row.current} 件</td>
                          <td className={`px-4 py-3 text-right tabular-nums font-medium ${momHit ? 'text-rose-600' : 'text-slate-400'}`}>{row.mom}</td>
                          <td className={`px-4 py-3 text-right tabular-nums font-medium ${yoyHit ? 'text-rose-600' : 'text-slate-400'}`}>{row.yoy}</td>
                          <td className="px-5 py-3 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${row.tone === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{row.type}{row.tone === 'danger' ? ' 双超' : ''}</span></td>
                        </tr>
                      );
                    })}
                    {alertRows.length===0&&<tr><td colSpan="5" className="px-5 py-10 text-center text-slate-400">当前已选机构暂无预警数据</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showCompareConfig && (
            <div className="fixed inset-0 z-50 bg-slate-900/30" onClick={() => setShowCompareConfig(false)}>
              <aside data-testid="institution-compare-drawer" className="view-enter ml-auto flex h-full w-[560px] flex-col bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-semibold text-slate-900">自定义机构对比</h2><button aria-label="关闭自定义机构对比" onClick={() => setShowCompareConfig(false)} className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-100"><Icon name="close" size={18}/></button></div>
                <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                  <div><div className="mb-3 flex items-center justify-between"><label className="text-sm font-semibold text-slate-700">1. 选择对比机构</label><span className="text-[11px] text-slate-400">已选 {effectiveCompareOrgs.length} 家 · 至少2家</span></div><div className="grid grid-cols-3 gap-2">{compareOrgOptions.map(org=><button key={org} onClick={()=>toggleCompareOrg(org)} className={`rounded-md border px-3 py-2.5 text-xs ${effectiveCompareOrgs.includes(org)?'border-violet-400 bg-violet-50 font-medium text-violet-700':'border-slate-200 text-slate-600 hover:border-violet-200'}`}>{effectiveCompareOrgs.includes(org)?'✓ ':''}{org}</button>)}{compareOrgOptions.length===0&&<div className="col-span-3 py-6 text-center text-xs text-slate-400">请先在顶部选择机构</div>}</div></div>
                  <div><label className="mb-3 block text-sm font-semibold text-slate-700">2. 选择指标</label><div className="grid grid-cols-3 gap-2">{['投诉口径','监管转送/自收投诉','产品类型','原因类型','条线类型','投诉受理渠道','业务办理渠道','客户年龄'].map(item=><button key={item} onClick={()=>{setCompareIndicator(item);setCompareMetric(item);setCompareDimension(item);}} className={`rounded-md border px-3 py-2.5 text-xs transition ${compareIndicator===item?'border-[#2272DE] bg-[#E9F1FC] font-medium text-[#2272DE]':'border-slate-200 text-slate-500 hover:border-[#A7C7F2] hover:text-slate-700'}`}>{item}</button>)}</div></div>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4"><button onClick={() => setShowCompareConfig(false)} className="rounded-md border border-slate-200 px-5 py-2.5 text-sm text-slate-600">取消</button><button onClick={() => {setShowCompareConfig(false);setShowCompareResult(true);}} className="rounded-md bg-violet-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700">生成分析</button></div>
              </aside>
            </div>
          )}

          {showRiskThresholdConfig && (
            <div className="fixed inset-0 z-50 bg-slate-900/30" onClick={() => {setRegulatoryShareThresholdDraft(String(regulatoryShareThreshold));setShowRiskThresholdConfig(false);}}>
              <aside data-testid="institution-risk-threshold-drawer" className="view-enter absolute bottom-0 right-0 flex h-[300px] w-[560px] flex-col bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="text-lg font-semibold text-slate-900">自定义风险阈值</h2><p className="mt-1 text-xs text-slate-400">配置监管风险机构分布图的风险判定分界线</p></div><button aria-label="关闭自定义风险阈值" onClick={() => {setRegulatoryShareThresholdDraft(String(regulatoryShareThreshold));setShowRiskThresholdConfig(false);}} className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-100"><Icon name="close" size={18}/></button></div>
                <div className="flex-1 px-6 py-5">
                  <label className="block text-sm font-semibold text-slate-700">监管投诉占比阈值配置</label>
                  <div className="mt-3 flex items-center gap-3"><input type="number" min="0" max="100" step="0.1" value={regulatoryShareThresholdDraft} onChange={event=>setRegulatoryShareThresholdDraft(event.target.value)} className="h-11 w-56 rounded-md border border-slate-200 px-3 text-sm tabular-nums text-slate-700 outline-none focus:border-violet-400"/><span className="text-sm font-medium text-slate-500">%</span></div>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4"><button onClick={() => {setRegulatoryShareThresholdDraft(String(regulatoryShareThreshold));setShowRiskThresholdConfig(false);}} className="w-28 rounded-md border border-slate-200 py-2.5 text-sm text-slate-600">取消配置</button><button onClick={() => {const next=Math.min(100,Math.max(0,Number(regulatoryShareThresholdDraft)||0));setRegulatoryShareThreshold(next);setRegulatoryShareThresholdDraft(String(next));setShowRiskThresholdConfig(false);}} className="w-28 rounded-md bg-violet-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700">应用配置</button></div>
              </aside>
            </div>
          )}

          {showEfficiencyThresholdConfig && (
            <div className="fixed inset-0 z-50 bg-slate-900/30" onClick={() => {setEfficiencyDurationThresholdDraft(efficiencyDurationThreshold.toFixed(1));setEfficiencyCompletionThresholdDraft(efficiencyCompletionThreshold.toFixed(1));setShowEfficiencyThresholdConfig(false);}}>
              <aside data-testid="institution-efficiency-threshold-drawer" className="view-enter absolute bottom-0 right-0 flex h-[300px] w-[560px] flex-col bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="text-lg font-semibold text-slate-900">自定义风险阈值</h2><p className="mt-1 text-xs text-slate-400">配置处理效率机构分布图的风险判定分界线</p></div><button aria-label="关闭处理效率风险阈值" onClick={() => {setEfficiencyDurationThresholdDraft(efficiencyDurationThreshold.toFixed(1));setEfficiencyCompletionThresholdDraft(efficiencyCompletionThreshold.toFixed(1));setShowEfficiencyThresholdConfig(false);}} className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-100"><Icon name="close" size={18}/></button></div>
                <div className="grid flex-1 grid-cols-2 gap-5 px-6 py-5">
                  <div><label className="block text-sm font-semibold text-slate-700">平均处理时长</label><div className="mt-3 flex items-center gap-3"><input type="number" min="0" max="365" step="0.1" value={efficiencyDurationThresholdDraft} onChange={event=>setEfficiencyDurationThresholdDraft(event.target.value)} className="h-11 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm tabular-nums text-slate-700 outline-none focus:border-violet-400"/><span className="w-4 text-sm font-medium text-slate-500">天</span></div></div>
                  <div><label className="block text-sm font-semibold text-slate-700">按时办结率</label><div className="mt-3 flex items-center gap-3"><input type="number" min="0" max="100" step="0.1" value={efficiencyCompletionThresholdDraft} onChange={event=>setEfficiencyCompletionThresholdDraft(event.target.value)} className="h-11 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm tabular-nums text-slate-700 outline-none focus:border-violet-400"/><span className="w-4 text-sm font-medium text-slate-500">%</span></div></div>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4"><button onClick={() => {setEfficiencyDurationThresholdDraft(efficiencyDurationThreshold.toFixed(1));setEfficiencyCompletionThresholdDraft(efficiencyCompletionThreshold.toFixed(1));setShowEfficiencyThresholdConfig(false);}} className="w-28 rounded-md border border-slate-200 py-2.5 text-sm text-slate-600">取消配置</button><button onClick={() => {const duration=Math.round(Math.min(365,Math.max(0,Number(efficiencyDurationThresholdDraft)||0))*10)/10;const completion=Math.round(Math.min(100,Math.max(0,Number(efficiencyCompletionThresholdDraft)||0))*10)/10;setEfficiencyDurationThreshold(duration);setEfficiencyCompletionThreshold(completion);setEfficiencyDurationThresholdDraft(duration.toFixed(1));setEfficiencyCompletionThresholdDraft(completion.toFixed(1));setShowEfficiencyThresholdConfig(false);}} className="w-28 rounded-md bg-violet-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700">应用配置</button></div>
              </aside>
            </div>
          )}

          {/* 变化趋势占据整行，其余分析图在下方按管理主题分组展示。 */}
          <section key={selectedOrg} data-testid="institution2-grid" className="view-enter grid grid-cols-2 gap-4">
            {['trend', 'pressure', 'regulatory', 'efficiency', 'quality'].map(key => <Institution2Panel key={key} focusKey={key} viewKey={viewKey} namesOverride={chartInstitutionNames} alertRows={alertRows} startDate={startDate} endDate={endDate} rangeTotal={orgData.received} filterContext={institutionFilterContext} wide={key === 'trend'} regulatoryThreshold={regulatoryShareThreshold} efficiencyDurationThreshold={efficiencyDurationThreshold} efficiencyCompletionThreshold={efficiencyCompletionThreshold} onConfigureRiskThreshold={()=>{setRegulatoryShareThresholdDraft(String(regulatoryShareThreshold));setShowRiskThresholdConfig(true);}} onConfigureEfficiencyThreshold={()=>{setEfficiencyDurationThresholdDraft(efficiencyDurationThreshold.toFixed(1));setEfficiencyCompletionThresholdDraft(efficiencyCompletionThreshold.toFixed(1));setShowEfficiencyThresholdConfig(true);}} />)}
          </section>
        </div>
      );
    }

    // 产品分析：与机构分析保持同一展示颗粒度，但统计主体切换为产品类型。
    const PRODUCT_NAMES = ['个人贷款', '理财产品', '电子银行', '借记卡'];
    const PRODUCT_DATA = {
      pressure: [2340, 1920, 1460, 980], share: [34.9, 28.7, 21.8, 14.6],
      regulatoryShare: [12.8, 9.6, 8.4, 6.1], mom: [18.2, 31.6, 8.3, -4.2], yoy: [26.5, 38.2, 14.1, 3.8],
      regulatoryVolume: [300, 184, 123, 60], recurrence: [7.9, 6.2, 5.4, 3.8]
    };
    const PRODUCT_METHODS = {
      pressure: ['按产品类型归属统计有效投诉，降序展示 Top5。', '产品投诉占比＝本产品有效投诉量÷全部产品有效投诉量×100%', '工单编号、产品类型、是否有效投诉'],
      regulatory: ['按产品类型统计监管转送有效投诉。', '监管投诉占比＝监管投诉量÷本产品有效投诉量×100%；环比／同比按对比期计算', '产品类型、受理渠道、转送时间、工单编号'],
      trend: ['按客户投诉时间归属期统计各产品有效投诉量。', '环比＝（本期－上期）÷上期×100%；同比＝（本期－上年同期）÷上年同期×100%', '客户投诉时间、产品类型、工单编号'],
      cause: ['在有效投诉中，按产品关联的修正投诉原因标签统计。', '原因占比＝某原因有效投诉量÷当前产品有效投诉量×100%', '产品类型、修正投诉原因标签、投诉诉求标签'],
      partner: ['对关联合作平台或合作方的产品投诉进行归集。', '合作方监管占比＝合作方监管投诉量÷合作方有效投诉量×100%', '业务类型、产品类型、合作方标签、受理渠道'],
      recurrence: ['同一客户对同一产品问题再次投诉，并与原工单建立关联。', '重复投诉率＝重复投诉量÷本产品有效投诉量×100%', '是否再次投诉、关联主单编号、产品类型、投诉原因标签']
    };

    function ProductInfo({ type, label }) {
      return null;
    }
    function ProductPanel({ type, label, question, wide=false, children, tools }) {
      return <article data-testid={`product-${type}`} className={`${wide?'col-span-2':''} overflow-visible rounded-lg border border-slate-200 bg-white shadow-card`}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><span className="rounded bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">{label}</span><span className="text-xs text-slate-400">{question}</span></div><div className="flex items-center gap-2">{tools}<ProductInfo type={type} label={label}/></div></div><div className="px-5 py-4">{children}</div></article>;
    }
    function ProductAnalysisLegacyPage() {
      const [gran,setGran]=useState('month'), [compare,setCompare]=useState('mom');
      const [startDate,setStartDate]=useState('2026-07-01'), [endDate,setEndDate]=useState('2026-07-15');
      const periods=gran==='day'?['7/10','7/11','7/12','7/13','7/14','7/15']:gran==='week'?['W2','W3','W4','W5','W6','W7']:['2月','3月','4月','5月','6月','7月'];
      const series=PRODUCT_NAMES.map((name,i)=>({name,values:periods.map((_,p)=>Math.round(PRODUCT_DATA.pressure[i]*(.72+p*.055+(i%2?p*.006:0))))}));
      const VBW=1010,VBH=285,PL=52,PR=850,PT=24,PB=235,max=Math.max(...series.flatMap(s=>s.values))*1.08,x=i=>PL+i*(PR-PL)/5,y=v=>PB-v/max*(PB-PT);
      const causes=[['收费争议',1860,24.6],['业务规则告知不清',1512,20.0],['审批或办理时效',1286,17.0],['功能与系统异常',1034,13.7],['营销宣传争议',824,10.9]];
      const partners=[['美团联名贷',426,'16.4%','8.8%'],['度小满合作贷',382,'14.7%','8.1%'],['京东金融合作贷',315,'12.9%','6.7%'],['小米消费贷',268,'10.8%','5.9%'],['乐信分期',221,'9.4%','5.2%']];
      const granTools=<div className="flex rounded-md border border-slate-200 p-0.5 text-xs">{TREND_GRANS.map(g=><button key={g.key} onClick={()=>setGran(g.key)} className={`rounded px-3 py-1 ${gran===g.key?'bg-violet-600 text-white':'text-slate-500'}`}>{g.label}</button>)}</div>;
      return <div className="mx-auto max-w-[1540px] px-6 py-5"><nav className="mb-4 flex gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">产品分析</span></nav><section className="mb-4 flex items-end justify-between"><div><h1 className="text-2xl font-semibold text-slate-900">产品分析</h1></div><div className="text-xs text-slate-400">数据更新时间：2026-07-15 12:00</div></section>
        <section className="mb-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-card"><div className="flex items-end gap-5"><label className="min-w-[230px]"><div className="mb-2 text-xs text-slate-500">产品范围</div><select className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"><option>全部产品</option>{PRODUCT_NAMES.map(n=><option key={n}>{n}</option>)}</select></label><label><div className="mb-2 text-xs text-slate-500">开始日期</div><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm"/></label><span className="pb-2.5 text-slate-400">至</span><label><div className="mb-2 text-xs text-slate-500">结束日期</div><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm"/></label><button className="ml-auto h-10 rounded-md bg-violet-600 px-6 text-sm text-white">查询</button></div></section>
        <section className="mb-4 grid grid-cols-4 gap-4">{[['有效投诉量','9,560','件','产品口径去重'],['监管投诉量','1,073','件','占有效投诉 11.2%'],['投诉增长预警','2','个','环比＞20%'],['重复投诉率','6.9','%','高于目标 1.9个百分点']].map(([l,v,u,n])=><article key={l} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs text-slate-500">{l}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{v}<span className="ml-1 text-xs font-normal text-slate-400">{u}</span></div><div className="mt-1 text-[11px] text-slate-400">{n}</div></article>)}</section>
        <section className="grid grid-cols-2 gap-4">
          <ProductPanel type="trend" label="变化趋势" question="哪些产品投诉增长最快？" wide tools={granTools}><svg viewBox={`0 0 ${VBW} ${VBH}`} className="h-[310px] w-full" aria-label="产品投诉变化趋势图">{[0,1,2,3,4].map(i=><line key={i} x1={PL} y1={PT+i*52} x2={PR} y2={PT+i*52} stroke="#E2E8F0"/>)}{series.map((s,si)=><g key={s.name}><polyline points={s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')} fill="none" stroke={CHART_COLORS[si]} strokeWidth={si<2?3:2}/>{s.values.map((v,i)=><circle key={i} cx={x(i)} cy={y(v)} r="4" fill="#fff" stroke={CHART_COLORS[si]} strokeWidth="2"/>)}<text x={PR+12} y={y(s.values[5])+4} fontSize="10" fill={CHART_COLORS[si]}>{s.name} {s.values[5]}</text></g>)}{periods.map((p,i)=><text key={p} x={x(i)} y="260" textAnchor="middle" fontSize="10" fill="#94A3B8">{p}</text>)}</svg><div className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">默认展示有效投诉量 Top5 产品；环比＞20% 或同比＞30% 触发预警。</div></ProductPanel>
          <ProductPanel type="pressure" label="投诉压力" question="哪些产品投诉最多？"><div className="space-y-3">{PRODUCT_NAMES.map((n,i)=><div key={n} className="grid grid-cols-[90px_1fr_90px] items-center gap-3 text-xs"><span>{i+1}. {n}</span><div className="h-6 rounded bg-slate-100"><div className="h-full rounded bg-gradient-to-r from-violet-700 to-violet-400" style={{width:`${PRODUCT_DATA.pressure[i]/2860*100}%`}}/></div><span className="text-right font-semibold">{PRODUCT_DATA.pressure[i].toLocaleString()} 件</span></div>)}</div><div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400">按有效投诉量降序展示 Top5，可下钻至所选产品的单笔投诉。</div></ProductPanel>
          <ProductPanel type="regulatory" label="监管风险" question="哪些产品更容易形成监管投诉？" tools={<div className="flex rounded border border-slate-200 p-0.5 text-xs"><button onClick={()=>setCompare('mom')} className={`rounded px-3 py-1 ${compare==='mom'?'bg-violet-600 text-white':'text-slate-500'}`}>环比</button><button onClick={()=>setCompare('yoy')} className={`rounded px-3 py-1 ${compare==='yoy'?'bg-violet-600 text-white':'text-slate-500'}`}>同比</button></div>}><div className="space-y-3">{PRODUCT_NAMES.map((n,i)=><div key={n} className="grid grid-cols-[90px_1fr_85px] items-center gap-3 text-xs"><span>{n}</span><div className="relative h-6 rounded bg-slate-100"><div className="h-full rounded bg-violet-500" style={{width:`${PRODUCT_DATA.regulatoryShare[i]/15*100}%`}}/></div><span className="text-right">{PRODUCT_DATA.regulatoryShare[i]}% · <b className={(compare==='mom'?PRODUCT_DATA.mom[i]:PRODUCT_DATA.yoy[i])>20?'text-rose-600':'text-slate-600'}>{compare==='mom'?PRODUCT_DATA.mom[i]:PRODUCT_DATA.yoy[i]}%</b></span></div>)}</div><div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400">条形＝监管投诉占比；右侧＝监管投诉{compare==='mom'?'环比':'同比'}增幅。</div></ProductPanel>
          <ProductPanel type="cause" label="原因结构" question="客户主要投诉产品的哪些问题？"><div className="space-y-3">{causes.map(([n,v,s],i)=><div key={n} className="grid grid-cols-[130px_1fr_90px] items-center gap-3 text-xs"><span>{i+1}. {n}</span><div className="h-5 rounded bg-slate-100"><div className="h-full rounded bg-violet-500" style={{width:`${s/25*100}%`}}/></div><span className="text-right">{v}件 · {s}%</span></div>)}</div></ProductPanel>
          <ProductPanel type="partner" label="合作方风险" question="哪些合作平台产品风险较高？"><div className="overflow-hidden rounded border border-slate-200"><div className="grid grid-cols-[1fr_70px_90px_90px] bg-slate-50 px-3 py-2 text-[10px] text-slate-400"><span>合作产品</span><span>投诉量</span><span>监管占比</span><span>重复投诉率</span></div>{partners.map((r,i)=><div key={r[0]} className="grid grid-cols-[1fr_70px_90px_90px] border-t border-slate-100 px-3 py-2.5 text-xs"><span>{i+1}. {r[0]}</span><span>{r[1]}</span><span className={i<2?'font-semibold text-rose-600':''}>{r[2]}</span><span>{r[3]}</span></div>)}</div></ProductPanel>
          <ProductPanel type="recurrence" label="问题复发" question="哪些产品处理后客户仍再次投诉？" wide><div className="relative mx-auto flex h-[240px] max-w-4xl items-end justify-around border-b border-l border-slate-300 px-12"> <div className="absolute bottom-[50%] left-0 right-0 border-t border-dashed border-rose-400"><span className="absolute right-1 -top-4 text-[10px] text-rose-500">预警线 5%</span></div>{PRODUCT_NAMES.map((n,i)=><div key={n} className="z-10 flex h-full w-24 flex-col items-center justify-end"><span className="mb-1 text-xs font-semibold">{PRODUCT_DATA.recurrence[i]}%</span><div className={`w-14 rounded-t ${PRODUCT_DATA.recurrence[i]>=5?'bg-rose-400':'bg-violet-500'}`} style={{height:`${PRODUCT_DATA.recurrence[i]*10}%`}}/><span className="mt-2 text-xs text-slate-600">{n}</span></div>)}</div></ProductPanel>
        </section>
      </div>;
    }

    // 产品分析正式版：按“哪个产品→什么原因→哪个细分产品→是否复发→单笔投诉”组织。
    function ProductAnalysisPage({onOpenTicket}) {
      const [selectedProduct,setSelectedProduct]=useState('贷款');
      const [selectedFine,setSelectedFine]=useState('');
      const [selectedCause,setSelectedCause]=useState('');
      const [selectedOrg,setSelectedOrg]=useState('全行');
      const [startDate,setStartDate]=useState('2026-07-01'), [endDate,setEndDate]=useState('2026-07-15');
      const [linkedFilter,setLinkedFilter]=useState(DEFAULT_LINKED_FILTER);
      const filterFactor=linkedAnalysisFactor(linkedFilter,startDate,endDate,selectedOrg);
      const filterSummary='';
      const productIndex=PRODUCT_NAMES.indexOf(selectedProduct);
      const causeSets={
        '贷款':[['催收',648,23.4],['协商还款',526,19.0],['贷款利率',438,15.8],['个人信息',356,12.9],['征信异议',286,10.3]],
        '存款':[['存款账户开/销户',218,24.1],['利息计算规则争议',176,19.5],['账户管理与查询',142,15.7],['个人存取款业务办理',118,13.0],['存款到期未通知',86,9.5]],
        '财富管理':[['理财销售合规问题',196,22.7],['业务规则告知',162,18.8],['收益与风险告知',136,15.8],['保险退保退款问题',108,12.5],['交易与操作问题',82,9.5]],
        '支付结算':[['转账限额管理',186,23.1],['转账交易',154,19.1],['账户冻结与异常',126,15.7],['账户信息变更',98,12.2],['资金入账',76,9.4]],
        '电子银行':[['核心交易与转账支付场景',238,24.1],['系统功能与界面体验场景',192,19.5],['登录与认证场景',156,15.8],['信息查询场景',128,13.0],['消息通知与推送服务场景',96,9.7]]
      };
      const fineProducts={
        '贷款':[['个人合作类贷款',1096,'39.1%','9.2%'],['个人非合作类贷款',982,'35.0%','5.8%'],['对公贷款',726,'25.9%','8.7%']],
        '存款':[['个人存款',638,'61.8%','4.1%'],['对公存款',394,'38.2%','3.6%']],
        '财富管理':[['个人代销',486,'55.2%','7.1%'],['对公代销',268,'30.5%','5.4%'],['其它财富管理',126,'14.3%','4.8%']],
        '支付结算':[['账户服务',438,'48.2%','6.1%'],['支付工具',326,'35.9%','5.2%'],['其它支付结算',144,'15.9%','3.8%']],
        '电子银行':[['个人电子渠道',672,'46.0%','6.8%'],['对公电子渠道',398,'27.3%','4.9%'],['小程序',186,'12.7%','5.6%'],['积分增值服务',142,'9.7%','7.4%'],['其它电子银行',48,'3.3%','4.1%']]
      };
      const complaints=[
        ['TS2026071500186','2026-07-15 09:36','贷款利率争议','个人消费贷','调整计息','厦门金管局','处理中'],
        ['TS2026071400921','2026-07-14 14:22','提前还款','住房按揭贷款','申请提前结清','客服电话','待审批'],
        ['TS2026071300648','2026-07-13 11:08','催收行为','个人经营贷','停止不当催收','在线客服','已办结'],
        ['TS2026071200375','2026-07-12 16:45','审批时效','汽车消费贷','加快审批','客服电话','处理中'],
        ['TS2026071100214','2026-07-11 10:17','费用告知','教育分期','退还费用','营业网点','已办结']
      ];
      const topProductsRaw=[['贷款',4826,'38.7%','+12.4%'],['存款',2684,'21.5%','+5.4%'],['财富管理',2096,'16.8%','+9.7%'],['支付结算',1688,'13.5%','+18.5%'],['电子银行',1192,'9.5%','+8.3%']];
      const productYoy=['+18.6%','+9.6%','+14.3%','+24.2%','+12.7%'];
      const topProducts=topProductsRaw.map((row,index)=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2],linkedFilter.compare==='环比'?row[3]:productYoy[index]]);
      const genericCauses=[['业务规则告知不清',186,22.1],['收费或价格争议',152,18.1],['办理时效',128,15.2],['服务态度与流程',106,12.6],['功能或系统异常',84,10.0]];
      const genericFines=[1,2,3,4,5].map((n,i)=>[`${selectedProduct}${['A类','B类','C类','D类','E类'][i]}`,Math.round((topProducts.find(r=>r[0]===selectedProduct)?.[1]||500)*(.31-i*.045)),`${31-i*4.5}%`,`${(7.8-i*.6).toFixed(1)}%`]);
      const causes=(causeSets[selectedProduct]||genericCauses).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]), fines=(fineProducts[selectedProduct]||genericFines).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2],row[3]]);
      const selectPrimary=name=>{setSelectedProduct(name);setSelectedCause('');setSelectedFine('');};
      const resetCrossFilters=()=>selectPrimary(topProducts[0]?.[0]||'贷款');
      const selectFine=name=>{setSelectedFine(name);setSelectedCause('');};
      const selectCause=name=>{
        if(selectedCause===name){setSelectedCause('');setSelectedFine('');return;}
        setSelectedCause(name);setSelectedFine('');
      };
      const displayComplaints=complaints.filter(row=>linkedFilter.channel==='监管转送'?row[5].includes('金管局'):linkedFilter.channel==='自收投诉'?!row[5].includes('金管局'):true).slice(0,Math.max(1,Math.ceil(complaints.length*Math.min(1,filterFactor)))).map((row,i)=>[row[0],row[1],selectedProduct,fines[i%fines.length]?.[0]||'—',causes[i%causes.length]?.[0]||'—',row[4],row[5],row[6]]).filter(row=>(!selectedFine||row[3]===selectedFine)&&(!selectedCause||row[4]===selectedCause));
      const productDetailSelection=useSelectableRows(displayComplaints,row=>row[0]);
      const exportProductDetails=()=>downloadCsv(`产品分析关联投诉明细_${startDate}_${endDate}.csv`,['工单编号','客户投诉时间','一级产品','二级产品','投诉原因','投诉诉求','受理渠道','工单状态'],productDetailSelection.selectedRows);
      const analysisMethods={
        primary:{question:'哪些一级产品投诉量最高？',caliber:'统计期内，按一级产品分类归属有效投诉，排除无效、撤销、废止及剔除工单，按工单编号去重。一级产品投诉占比＝该产品有效投诉量÷当前机构范围全部产品有效投诉量×100%。',value:'识别投诉压力最高和增长较快的一级产品，确定需要优先分析、优化和整改的产品范围。',source:'工单编号、客户投诉时间、一级产品分类、投诉责任机构、有效投诉标识、撤销标识、废止标识、剔除标识。'},
        secondary:{question:'投诉具体集中在哪些二级产品？',caliber:'在当前选中的一级产品下，按二级产品统计有效投诉量并降序展示 Top5。二级产品重复投诉率＝该产品重复投诉量÷该产品有效投诉量×100%。',value:'定位一级产品下真正产生投诉的具体产品，区分大类规模问题与单一细分产品异常。',source:'一级产品分类、二级产品分类、工单编号、有效投诉标识、是否再次投诉、关联工单编号。'},
        cause:{question:'客户主要因为什么问题投诉该产品？',caliber:'在当前选中的一级产品有效投诉中，按修正投诉原因标签统计并降序展示 Top5。投诉原因占比＝该原因有效投诉量÷当前一级产品有效投诉量×100%。',value:'识别产品条款、收费、功能或服务流程中的主要问题，为产品优化和溯源整改提供方向。',source:'工单编号、一级产品分类、二级产品分类、修正投诉原因标签、投诉诉求标签、有效投诉标识。'},
        detail:{question:'当前产品与投诉原因对应哪些单笔投诉？',caliber:'一级产品为必选条件，未手动选择时默认 Top1。二级产品与投诉原因为互斥筛选，同一时间仅保留其中一项，明细按工单编号去重。',value:'用单笔投诉验证分析结论，核查具体客户问题、受理渠道和工单状态，并支持责任定位。',source:'工单编号、客户投诉时间、投诉原因、投诉诉求、一级产品分类、二级产品分类、受理渠道、工单状态。'}
      };
      const MetricInfo=({type,label})=>{const method=analysisMethods[type];const info={title:label,question:method.question,caliber:method.caliber,value:method.value,source:method.source};return <CompactInfoPopover info={info} ariaLabel={`查看${label}指标说明`}/>};
      const Section=({title,question,children,wide=false,extra,methodKey})=>{
        const type=methodKey||(title.includes('二级产品')?'secondary':title.includes('投诉原因')?'cause':title.includes('投诉明细')?'detail':null);
        const formalTitle=type==='secondary'?`${selectedProduct}｜二级产品投诉量 Top5`:type==='detail'?'关联单笔投诉明细':title;
        const formalNote=type==='secondary'||type==='cause'?'':type==='detail'?<><span className="mt-0.5 block">一级产品必选；二级产品与投诉原因仅可择其一，明细随当前有效条件联动</span></>:question;
        return <article className={`${wide?'col-span-2':''} rounded-lg border border-slate-200 bg-white shadow-card`}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">{formalTitle}</h3>{formalNote&&<p className="mt-0.5 text-[11px] text-slate-400">{formalNote}</p>}</div><div className="flex items-center gap-2">{extra}{type&&<MetricInfo type={type} label={formalTitle}/>}</div></div><div className={type==='detail'?'':'p-5'}>{children}</div></article>;
      };
      return <div className="mx-auto max-w-[1540px] px-6 py-5">
        <nav className="mb-4 flex gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">产品分析</span></nav>
        <section className="mb-4 flex items-end justify-between"><div><h1 className="text-2xl font-semibold text-slate-900">产品分析</h1></div><div className="text-xs text-slate-400">数据更新时间：2026-07-15 12:00</div></section>
        <ComplaintAnalysisFilters pageKey="product" startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onOrgChange={org=>setSelectedOrg(org.startsWith('全行')?'全行':org)} onFilterChange={changes=>setLinkedFilter(prev=>({...prev,...changes}))} onQuery={({org,orgSelection,lineSelection,channel,caliber,compare,organizationDimension,organizationField,excluded})=>{setSelectedOrg(org.startsWith('全行')?'全行':org);setLinkedFilter({channel,caliber,compare,organizationDimension,organizationField,excluded,orgSelection,lineSelection})}}/>
        <section className="mb-4 rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold text-slate-800">一级产品投诉量 Top5</h2><p className="mt-1 text-xs text-slate-400">按当前投诉口径降序</p></div><div className="flex items-center gap-2"><MetricInfo type="primary" label="一级产品投诉量 Top5"/></div></div><div className="grid grid-cols-5 gap-3">{topProducts.map((row,i)=><button key={row[0]} onClick={()=>selectPrimary(row[0])} className={`rounded-lg border p-4 text-left transition ${selectedProduct===row[0]?'border-violet-400 bg-violet-50 ring-1 ring-violet-200':'border-slate-200 bg-white hover:border-violet-200 hover:shadow-sm'}`}><div className="flex items-center justify-between"><span className={`grid h-6 w-6 place-items-center rounded text-[10px] font-semibold ${i<3?'bg-violet-600 text-white':'bg-slate-100 text-slate-500'}`}>{i+1}</span><span className={`text-[11px] ${String(row[3]).startsWith('+')?'text-rose-500':'text-emerald-600'}`}><span className="text-slate-400">{linkedFilter.compare}</span> <b className={String(row[3]).startsWith('+')?'text-rose-500':'text-emerald-600'}>{normalizedComparison(row[3])}</b></span></div><div className="mt-3 text-sm font-semibold text-slate-700">{row[0]}</div><div className="mt-2 text-xl font-semibold text-slate-900">{row[1].toLocaleString()}<span className="ml-1 text-xs font-normal text-slate-400">件</span></div><div className="mt-1 text-[11px] text-slate-400">占比 {row[2]}</div></button>)}</div></section>
        <section className="grid grid-cols-2 gap-4">
          <Section title={`${selectedProduct}｜二级产品 Top5`} question="投诉具体集中在哪些细分产品？"><div className="overflow-hidden rounded-md border border-slate-200"><div className="grid grid-cols-[36px_1fr_80px_75px] bg-slate-50 px-3 py-2 text-[10px] text-slate-400"><span>排名</span><span>二级产品</span><span>投诉量</span><span>占比</span></div>{fines.map((row,i)=><button key={row[0]} onClick={()=>selectFine(row[0])} className={`grid w-full grid-cols-[36px_1fr_80px_75px] border-t border-slate-100 px-3 py-2.5 text-left text-xs ${selectedFine===row[0]?'bg-violet-50 ring-1 ring-inset ring-violet-200':'hover:bg-violet-50'}`}><span>{i+1}</span><span className="font-medium text-slate-700">{row[0]}</span><span>{row[1]}件</span><span className="text-slate-500">{row[2]}</span></button>)}</div><div className="mt-3 text-[11px] text-slate-400">当前选中：<span className="font-medium text-violet-600">{selectedFine||'未选择'}</span>；选择二级产品会取消投诉原因筛选。</div></Section>
          <Section title={`${selectedProduct}｜投诉原因 Top5`} question="客户主要为什么投诉？"><div className="overflow-hidden rounded-md border border-slate-200"><div className="grid grid-cols-[36px_1fr_80px_75px] bg-slate-50 px-3 py-2 text-[10px] text-slate-400"><span>排名</span><span>投诉原因</span><span>投诉量</span><span>占比</span></div>{causes.map(([name,count,share],i)=><button type="button" data-product-cause={name} key={name} onClick={()=>selectCause(name)} className={`grid w-full grid-cols-[36px_1fr_80px_75px] border-t border-slate-100 px-3 py-2.5 text-left text-xs transition ${selectedCause===name?'bg-violet-50 ring-1 ring-inset ring-violet-200':'hover:bg-violet-50'}`}><span>{i+1}</span><span className="font-medium text-slate-700">{name}</span><span>{count}件</span><span>{share}%</span></button>)}</div><div className="mt-3 text-[11px] text-slate-400">原因占比＝该原因有效投诉量÷{selectedProduct}有效投诉量；选择原因会取消二级产品筛选。</div></Section>
          <Section wide title="关联单笔投诉明细" question="当前筛选条件对应哪些单笔投诉？" extra={<><button type="button" data-testid="product-detail-reset" onClick={resetCrossFilters} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50">重置交叉筛选</button><button type="button" data-testid="product-detail-export" disabled={!productDetailSelection.selectedRows.length} onClick={exportProductDetails} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 disabled:cursor-not-allowed disabled:opacity-40">导出明细</button></>}><div data-testid="product-detail-filters" className="m-5 mb-4 flex flex-wrap gap-2 rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-xs"><span className="rounded-full bg-violet-600 px-3 py-1 text-white">一级产品类型：{selectedProduct}</span>{selectedFine&&<span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">二级产品类型：{selectedFine}</span>}{selectedCause&&<span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">投诉原因：{selectedCause}</span>}</div><div className="overflow-x-auto"><div className="grid min-w-[1190px] grid-cols-[210px_150px_140px_180px_160px_140px_120px_90px] bg-slate-50 px-5 py-3 text-[11px] text-slate-500"><span className="flex items-center gap-3 whitespace-nowrap"><SelectionCheckbox testId="product-detail-select-all" checked={productDetailSelection.allSelected} onChange={productDetailSelection.toggleAll} ariaLabel="全选产品分析关联工单"/><span>工单编号</span></span><span>客户投诉时间</span><span>一级产品标签</span><span>二级产品标签</span><span>投诉原因标签</span><span>投诉诉求</span><span>受理渠道</span><span>工单状态</span></div>{displayComplaints.map(row=><div data-testid="product-detail-row" key={row[0]} className="grid min-w-[1190px] grid-cols-[210px_150px_140px_180px_160px_140px_120px_90px] border-t border-slate-100 px-5 py-3 text-left text-xs hover:bg-violet-50"><span className="flex min-w-0 items-center gap-3"><SelectionCheckbox testId="product-detail-select" checked={productDetailSelection.selectedSet.has(row[0])} onChange={checked=>productDetailSelection.toggle(row[0],checked)} ariaLabel={`选择工单${row[0]}`}/><button type="button" onClick={()=>onOpenTicket&&onOpenTicket(row[0])} className="truncate whitespace-nowrap text-left font-medium text-violet-600 hover:underline focus:underline">{row[0]}</button></span>{row.slice(1).map((cell,index)=><span key={index}>{cell}</span>)}</div>)}{displayComplaints.length===0&&<div className="px-5 py-10 text-center text-sm text-slate-400">当前条件下暂无匹配投诉</div>}</div></Section>
        </section>
      </div>;
    }

    // 原因分析：以一级投诉原因为主线，向下定位二级原因及关联业务对象。
    function ReasonAnalysisPage({onOpenTicket}) {
      const [selectedReason,setSelectedReason]=useState('贷款');
      const [selectedOrg,setSelectedOrg]=useState('全行');
      const [selectedSecondary,setSelectedSecondary]=useState('全部');
      const [relatedView,setRelatedView]=useState('产品');
      const [startDate,setStartDate]=useState('2026-07-01'),[endDate,setEndDate]=useState('2026-07-15');
      const [linkedFilter,setLinkedFilter]=useState(DEFAULT_LINKED_FILTER);
      const filterFactor=linkedAnalysisFactor(linkedFilter,startDate,endDate,selectedOrg);
      const filterSummary='';
      const reasonsRaw=[['贷款',8648,'74.8%','+18.6%','+26.4%'],['服务类',2190,'18.9%','+12.4%','+18.1%'],['借记卡',464,'4.0%','+8.3%','+12.7%'],['手机银行',144,'1.2%','+15.2%','+8.9%'],['营销活动类',120,'1.0%','+9.7%','+12.8%']];
      const reasons=reasonsRaw.map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2],row[3],row[4]]);
      const secondaryMap={
        '贷款':[['催收',2640,'30.5%'],['协商还款',1842,'21.3%'],['贷款利率',1376,'15.9%'],['个人信息',986,'11.4%'],['征信异议',742,'8.6%']],
        '服务类':[['网点线下服务',642,'29.3%'],['通信服务',518,'23.7%'],['预约与准备',396,'18.1%'],['自助机存取款服务',284,'13.0%'],['柜台存取款服务',172,'7.9%']],
        '借记卡':[['借记卡限额',142,'30.6%'],['开卡与销卡管理',106,'22.8%'],['借记卡账户冻结',82,'17.7%'],['账户信息管理',66,'14.2%'],['结算账户分类争议',42,'9.1%']],
        '手机银行':[['核心交易与转账支付场景',46,'31.9%'],['系统功能与界面体验场景',32,'22.2%'],['登录与认证场景',24,'16.7%'],['信息查询场景',18,'12.5%'],['消息通知与推送服务场景',12,'8.3%']],
        '营销活动类':[['达标资格与权益发放',56,'46.7%'],['活动信息与规则复杂',31,'25.8%'],['营销活动通知与提示',20,'16.7%'],['客户参与资格',9,'7.5%']]
      };
      const fallback=[['业务执行不一致',186,'23.4%'],['客户告知不充分',152,'19.1%'],['系统或流程异常',126,'15.8%'],['处理结果争议',98,'12.3%'],['责任认定争议',76,'9.5%']];
      const secondary=(secondaryMap[selectedReason]||fallback).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      const idx=reasons.findIndex(r=>r[0]===selectedReason);
      const rotate=(arr)=>arr.map((_,i)=>arr[(i+Math.max(idx,0))%arr.length]);
      const products=rotate([['贷款',526,'28.3%'],['存款',248,'13.3%'],['财富管理',186,'10.0%'],['支付结算',112,'6.0%'],['电子银行',86,'4.6%']]).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      const institutions=rotate([['厦门分行',326,'17.5%'],['上海分行',298,'16.0%'],['福州分行',264,'14.2%'],['北京分行',238,'12.8%'],['宁德分行',196,'10.5%']]).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      // 默认“全行”范围直接展示全行机构 Top5；仅在用户收窄机构范围后按已选机构过滤。
      const selectedReasonInstitutions=(selectedOrg==='全行'||!linkedFilter.orgSelection||linkedFilter.orgSelection.isAll
        ?institutions
        :selectedOrganizationRows(linkedFilter.orgSelection,institutions).map(row=>[row[0],scaleLinkedCount(row[1],1),row[2]])
      ).slice(0,5);
      const channels=rotate([['金融消费者保护服务平台',482,'25.9%'],['客服电话',398,'21.4%'],['营业网点',316,'17.0%'],['厦门金管局',268,'14.4%'],['在线客服',182,'9.8%']]).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      const relatedLineOptions=(linkedFilter.lineSelection||[]).length?linkedFilter.lineSelection:BUSINESS_LINE_OPTIONS;
      const relatedLines=perspectiveTop5Rows(relatedLineOptions,680).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      const customers=perspectiveTop5Rows(CUSTOMER_PERSPECTIVE_OPTIONS,620).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      // 单笔明细继承上方全部筛选条件，用于验证分析结论并定位具体工单。
      const details=Array.from({length:10},(_,i)=>({
        id:`TS202607${String(1501+i).padStart(4,'0')}`,
        date:`2026-07-${String(15-i).padStart(2,'0')}`,
        secondary:secondary[i%secondary.length][0],
        product:products[i%products.length][0],
        institution:institutions[i%institutions.length][0],
        channel:channels[i%channels.length][0],
        line:relatedLines.length?relatedLines[i%relatedLines.length][0]:'—',
        customerType:customers[i%customers.length][0],
        status:['处理中','已办结','待处理'][i%3]
      }));
      const filteredDetails=details.filter(row=>
        row.date>=startDate&&row.date<=endDate&&
        (selectedOrg==='全行'||row.institution===selectedOrg)&&
        (selectedSecondary==='全部'||row.secondary===selectedSecondary)&&
        (linkedFilter.channel==='监管转送'?row.channel.includes('金管局'):linkedFilter.channel==='自收投诉'?!row.channel.includes('金管局'):true)
      );
      const reasonDetailSelection=useSelectableRows(filteredDetails,row=>row.id);
      const exportReasonDetails=()=>downloadCsv(`原因分析关联投诉明细_${startDate}_${endDate}.csv`,['工单编号','客户投诉时间','投诉原因一级标签','投诉原因二级标签','产品一级分类','投诉责任机构','受理渠道','部门/条线','客户类型','工单状态'],reasonDetailSelection.selectedRows.map(row=>[row.id,row.date,selectedReason,row.secondary,row.product,row.institution,row.channel,row.line,row.customerType,row.status]));
      const resetCrossFilters=()=>{setSelectedReason(reasons[0]?.[0]||'贷款');setSelectedSecondary('全部');};
      const reasonRelatedViews={
        产品:{data:products},
        机构:{data:selectedReasonInstitutions},
        渠道:{data:channels},
        条线:{data:relatedLines},
        客户:{data:customers}
      };
      const activeReasonRelatedView=reasonRelatedViews[relatedView];
      const methods={
        rank:{question:'哪些一级投诉原因最突出？',caliber:'统计期内，按修正后的一级投诉原因标签归集有效投诉，按工单编号去重。原因占比＝该原因有效投诉量÷当前机构范围有效投诉总量×100%，并同步展示同比、环比变化。',value:'识别当前最主要且增长较快的投诉问题，确定需要优先分析和整改的一级原因。',source:'工单编号、客户投诉时间、有效投诉标识、修正投诉原因一级标签、投诉责任机构。'},
        secondary:{question:'当前一级原因具体由哪些二级原因构成？',caliber:'在当前选中的一级投诉原因下，按修正后的二级原因标签归集有效投诉并降序展示 Top5。二级原因占比＝该二级原因有效投诉量÷当前一级原因有效投诉量×100%。',value:'进一步拆解一级原因，定位更具体的业务规则、服务流程或系统问题，避免整改方向过于宽泛。',source:'工单编号、有效投诉标识、修正投诉原因一级标签、修正投诉原因二级标签、投诉诉求标签。'},
        related:{question:'该投诉原因主要集中在哪些产品、机构、渠道、条线和客户群体？',caliber:'继承当前机构、日期、一级原因和二级原因筛选条件，分别按一级产品、投诉责任机构、受理渠道、所属业务条线或客户标签汇总有效投诉量并展示 Top5。关联对象占比＝该对象当前原因有效投诉量÷当前原因有效投诉量×100%。',value:'通过产品、机构、渠道、条线和客户视角交叉定位问题集中范围，支持责任定位、产品优化及客群服务改进。',source:'工单编号、有效投诉标识、一级产品分类、投诉责任机构、受理渠道、所属业务条线、客户标签、修正投诉原因一级标签、修正投诉原因二级标签。'},
        detail:{question:'哪些单笔投诉构成当前分析结果？',caliber:'明细仅接受当前投诉原因一级标签和二级标签的交叉筛选，关联分布的五个视角只用于查看，不影响明细，工单按编号去重。',value:'用单笔工单验证原因分析结论，核查具体投诉事实和处理状态，并支持责任追溯及后续整改。',source:'工单编号、客户投诉时间、有效投诉标识、投诉原因一级标签、投诉原因二级标签、一级产品分类、投诉责任机构、受理渠道、部门/条线、客户类型、工单状态。'}
      };
      const Info=({type,label})=>{const method=methods[type];const info={title:label,question:method.question,caliber:method.caliber,value:method.value,source:method.source};return <CompactInfoPopover info={info} ariaLabel={`查看${label}指标说明`}/>};
      const Rank=({data})=><div><div className="mb-2 grid items-center gap-3 px-2 text-[11px] text-slate-400" style={{gridTemplateColumns:'135px minmax(0,1fr) 70px 60px'}}><span>名称</span><span/><span className="text-right">投诉量</span><span className="text-right">占比</span></div><div data-testid="reason-related-ranking" className="space-y-3">{data.map((r,i)=><div key={r[0]} className="grid w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs" style={{gridTemplateColumns:'135px minmax(0,1fr) 70px 60px'}}><span className="flex min-w-0 items-center gap-2"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] ${i<3?'bg-[#2272DE] text-white':'bg-slate-100 text-slate-500'}`}>{i+1}</span><span className="truncate">{r[0]}</span></span><span className="h-5 rounded bg-slate-100"><span className="block h-full rounded bg-violet-500" style={{width:`${parseFloat(r[2])/40*100}%`}}/></span><span className="text-right">{r[1]}件</span><span className="text-right">{r[2]}</span></div>)}</div></div>;
      const Panel=({title,note,type='related',children,wide=false})=><article className={`${wide?'col-span-2':''} rounded-lg border border-slate-200 bg-white shadow-card`}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">{title}</h3>{note&&<p className="mt-0.5 text-[11px] text-slate-400">{note}</p>}</div><Info type={type} label={title}/></div><div className="p-5">{children}</div></article>;
      return <div className="mx-auto max-w-[1540px] px-6 py-5"><nav className="mb-4 flex gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">原因分析</span></nav><section className="mb-4 flex items-end justify-between"><div><h1 className="text-2xl font-semibold text-slate-900">原因分析</h1></div><div className="text-xs text-slate-400">数据更新时间：2026-07-15 12:00</div></section>
        <ComplaintAnalysisFilters pageKey="reason" startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onOrgChange={org=>setSelectedOrg(org.startsWith('全行')?'全行':org)} onFilterChange={changes=>setLinkedFilter(prev=>({...prev,...changes}))} onQuery={({org,orgSelection,lineSelection,channel,caliber,compare,organizationDimension,organizationField,excluded})=>{setSelectedOrg(org.startsWith('全行')?'全行':org);setLinkedFilter({channel,caliber,compare,organizationDimension,organizationField,excluded,orgSelection,lineSelection})}}/>
        <section className="mb-4 rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold text-slate-800">一级投诉原因投诉量 Top5</h2></div><Info type="rank" label="一级投诉原因投诉量 Top5"/></div><div className="grid grid-cols-5 gap-3">{reasons.map((r,i)=><button key={r[0]} onClick={()=>{setSelectedReason(r[0]);setSelectedSecondary('全部');}} className={`rounded-lg border p-4 text-left transition ${selectedReason===r[0]?'border-violet-400 bg-violet-50 ring-1 ring-violet-200':'border-slate-200 hover:border-violet-200'}`}><div className="flex items-center justify-between"><span className={`grid h-6 w-6 place-items-center rounded text-[10px] font-semibold ${i<3?'bg-violet-600 text-white':'bg-slate-100 text-slate-500'}`}>{i+1}</span><span className="text-[11px]"><ComparisonValue label={linkedFilter.compare} value={linkedFilter.compare==='环比'?r[3]:r[4]}/></span></div><div className="mt-3 text-sm font-semibold text-slate-700">{r[0]}</div><div className="mt-2 text-xl font-semibold text-slate-900">{r[1].toLocaleString()}<span className="ml-1 text-xs font-normal text-slate-400">件</span></div><div className="mt-1 text-[11px] text-slate-400">占比 {r[2]}</div></button>)}</div></section>
        <section className="grid grid-cols-2 gap-4"><Panel wide type="secondary" title={`${selectedReason}｜二级投诉原因 Top5`} note=""><div className="grid grid-cols-5 gap-3">{secondary.map((r,i)=><button key={r[0]} onClick={()=>setSelectedSecondary(selectedSecondary===r[0]?'全部':r[0])} className={`rounded-lg border p-4 text-left transition ${selectedSecondary===r[0]?'border-violet-400 bg-violet-50 ring-1 ring-violet-200':'border-slate-200 hover:border-violet-300 hover:bg-violet-50'}`}><div className="text-xs text-slate-400">Top {i+1}</div><div className="mt-2 h-9 text-sm font-medium text-slate-700">{r[0]}</div><div className="mt-2 text-lg font-semibold">{r[1]}<span className="ml-1 text-xs font-normal text-slate-400">件</span></div><div className="mt-1 text-[11px] text-slate-400">占比 {r[2]}</div></button>)}</div></Panel><article className="col-span-2 rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">{selectedReason}｜关联分布 Top5</h3><p className="mt-0.5 text-[11px] text-slate-400">各视角仅供查看，不参与明细筛选</p></div><div className="flex items-center gap-3"><div className="flex rounded-md bg-slate-100 p-1">{Object.keys(reasonRelatedViews).map(view=><button key={view} onClick={()=>setRelatedView(view)} className={`rounded px-4 py-1.5 text-xs transition ${relatedView===view?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>{view}</button>)}</div><Info type="related" label="关联分布 Top5"/></div></div><div className="p-5">{activeReasonRelatedView.data.length?<Rank data={activeReasonRelatedView.data}/>:<div className="py-10 text-center text-sm text-slate-400">当前范围暂无可展示数据</div>}</div></article></section>
        <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">关联单笔投诉明细</h3><p className="mt-0.5 text-[11px] text-slate-400"><span className="mt-0.5 block">明细仅随当前投诉原因一级标签和投诉原因二级标签筛选联动</span></p></div><div className="flex items-center gap-2"><button type="button" data-testid="reason-detail-reset" onClick={resetCrossFilters} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50">重置交叉筛选</button><button type="button" data-testid="reason-detail-export" disabled={!reasonDetailSelection.selectedRows.length} onClick={exportReasonDetails} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40">导出明细</button><Info type="detail" label="关联单笔投诉明细"/></div></div><div data-testid="reason-detail-filters" className="m-5 mb-4 flex flex-wrap gap-2 rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-xs"><span className="rounded-full bg-violet-600 px-3 py-1 text-white">投诉原因一级标签：{selectedReason}</span>{selectedSecondary!=='全部'&&<span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">投诉原因二级标签：{selectedSecondary}</span>}</div><div className="mx-5 mb-5 overflow-x-auto rounded-md border border-slate-200"><div className="grid min-w-[1580px] bg-slate-50 px-4 py-2.5 text-[11px] text-slate-400" style={{gridTemplateColumns:'230px repeat(9,minmax(140px,1fr))'}}><SelectableHeader label="工单编号" selection={reasonDetailSelection} testId="reason-detail-select-all"/>{['客户投诉时间','投诉原因一级标签','投诉原因二级标签','投诉产品标签','责任机构','受理渠道','所属业务条线','客户类型','工单状态'].map(header=><span key={header} className="whitespace-nowrap">{header}</span>)}</div>{filteredDetails.map(row=><div data-testid="reason-detail-row" key={row.id} className="grid min-w-[1580px] border-t border-slate-100 px-4 py-3 text-left text-xs hover:bg-violet-50" style={{gridTemplateColumns:'230px repeat(9,minmax(140px,1fr))'}}><SelectableIdCell id={row.id} selection={reasonDetailSelection} testId="reason-detail-select" onOpen={onOpenTicket}/><span>{row.date}</span><span>{selectedReason}</span><span>{row.secondary}</span><span>{row.product}</span><span>{row.institution}</span><span>{row.channel}</span><span>{row.line}</span><span>{row.customerType}</span><span>{row.status}</span></div>)}{filteredDetails.length===0&&<div className="px-5 py-10 text-center text-sm text-slate-400">当前原因条件下暂无匹配投诉，请调整筛选条件</div>}</div></section>
      </div>;
    }

    function LineAnalysisPage({initialQuery=null,onOpenTicket}) {
      const [selectedLine,setSelectedLine]=useState('零售金融部');
      const [relatedView,setRelatedView]=useState('产品');
      const [selectedOrg,setSelectedOrg]=useState(initialQuery?.org||'全行');
      const [startDate,setStartDate]=useState(initialQuery?.startDate||'2026-07-01');
      const [endDate,setEndDate]=useState(initialQuery?.endDate||'2026-07-15');
      const [linkedFilter,setLinkedFilter]=useState(()=>initialQuery?.filter||DEFAULT_LINKED_FILTER);
      const [linePage,setLinePage]=useState(1);
      const linePageSize=7;
      // 未勾选任何条线时按“全部条线”处理；图表只展示查询栏当前选择的部门。
      const effectiveLineSelection=(linkedFilter.lineSelection||[]).length?linkedFilter.lineSelection:BUSINESS_LINE_OPTIONS;
      const effectiveLinkedFilter={...linkedFilter,lineSelection:effectiveLineSelection};
      const filterFactor=linkedAnalysisFactor(effectiveLinkedFilter,startDate,endDate,selectedOrg);
      const filterSummary='';
      const linesRaw=[
        ['零售金融部',2368,'+16.8%','+22.4%'],['普惠金融部',1986,'+21.3%','+27.8%'],['公司金融部',1352,'-2.8%','+5.4%'],['消费者权益保护部',1186,'+12.8%','+14.2%'],['运营管理部',1046,'+14.6%','+9.8%'],['风险管理部',864,'+8.7%','+10.2%'],['特殊资产经营部',716,'+18.2%','+16.9%'],
        ['安全保卫部/总务部',528,'+6.4%','+8.1%'],['授信审批部',458,'-1.9%','+3.6%'],['科技管理部',430,'+12.6%','+15.1%'],['华侨金融部',304,'+3.9%','+5.2%'],['科技开发部',238,'+11.2%','+13.8%'],['科技运维部',216,'+8.1%','+10.7%']
      ];
      const selectedLineSet=new Set(effectiveLineSelection);
      const scopedLinesRaw=linesRaw.filter(row=>selectedLineSet.has(row[0])).sort((a,b)=>b[1]-a[1]);
      const scopedLineTotal=Math.max(1,scopedLinesRaw.reduce((sum,row)=>sum+row[1],0));
      const lines=scopedLinesRaw.map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),`${(row[1]/scopedLineTotal*100).toFixed(1)}%`,row[2],row[3]]);
      const linePageCount=Math.max(1,Math.ceil(lines.length/linePageSize));
      const pagedLines=lines.slice((linePage-1)*linePageSize,linePage*linePageSize);
      const maxLineCount=Math.max(1,...lines.map(row=>row[1]));
      const causeMap={
        '零售金融部':[['收费争议',526,'22.2%'],['业务规则告知不清',438,'18.5%'],['办理时效',386,'16.3%'],['营销宣传争议',298,'12.6%'],['征信异议',216,'9.1%']],
        '普惠金融部':[['办理时效',326,'24.1%'],['收费争议',278,'20.6%'],['业务规则告知不清',216,'16.0%'],['征信异议',168,'12.4%'],['服务态度',126,'9.3%']],
        '公司金融部':[['业务规则告知不清',286,'21.2%'],['办理时效',248,'18.3%'],['收费争议',196,'14.5%'],['账户管理',168,'12.4%'],['服务态度',126,'9.3%']]
      };
      const fallbackCauses=[['业务规则告知不清',268,'22.5%'],['办理时效',226,'19.0%'],['收费争议',186,'15.6%'],['服务态度',142,'11.9%'],['功能与系统异常',118,'9.9%']];
      const causes=(causeMap[selectedLine]||fallbackCauses).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      const lineIndex=Math.max(lines.findIndex(item=>item[0]===selectedLine),0);
      const rotate=arr=>arr.map((_,i)=>arr[(i+lineIndex)%arr.length]);
      const products=rotate([['贷款',684,'28.9%'],['存款',386,'16.3%'],['财富管理',298,'12.6%'],['支付结算',186,'7.9%'],['电子银行',142,'6.0%']]).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      const institutions=rotate([['厦门分行',438,'18.5%'],['上海分行',396,'16.7%'],['福州分行',328,'13.9%'],['北京分行',286,'12.1%'],['宁德分行',238,'10.1%']]).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      const channels=rotate([['金融消费者保护服务平台',922,'38.9%'],['客服电话',497,'21.0%'],['营业网点',282,'11.9%'],['厦门金管局',149,'6.3%'],['在线客服',140,'5.9%'],['市长热线',107,'4.5%'],['属地金管局',95,'4.0%'],['总行投诉邮箱',81,'3.4%'],['机构专线电话',54,'2.3%'],['客户意见薄',17,'0.7%'],['信函',12,'0.5%'],['其它',12,'0.5%']]).slice(0,5).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      const customers=perspectiveTop5Rows(CUSTOMER_PERSPECTIVE_OPTIONS,760).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      // 示例明细中的字段与工单字段直接对应，保证筛选条件能够逐层传递。
      const details=Array.from({length:15},(_,i)=>({id:`TS202607${String(2101+i).padStart(4,'0')}`,date:`2026-07-${String(15-i).padStart(2,'0')}`,cause:causes[i%causes.length][0],product:products[i%products.length][0],institution:institutions[i%institutions.length][0],channel:channels[i%channels.length][0],customerType:customers[i%customers.length][0],status:['处理中','已办结','待处理'][i%3]}));
      const isRegulatoryChannel=channel=>channel==='厦门金管局'||channel==='属地金管局';
      const filteredDetails=details.filter(row=>row.date>=startDate&&row.date<=endDate&&(selectedOrg==='全行'||row.institution===selectedOrg)&&(linkedFilter.channel==='全部渠道'||(linkedFilter.channel==='监管转送'?isRegulatoryChannel(row.channel):!isRegulatoryChannel(row.channel)))).slice(0,Math.ceil(15*Math.min(1,filterFactor)));
      const lineDetailSelection=useSelectableRows(filteredDetails,row=>row.id);
      const exportLineDetails=()=>downloadCsv(`条线分析关联投诉明细_${startDate}_${endDate}.csv`,['工单编号','客户投诉时间','所属业务条线','产品一级分类','投诉原因一级标签','投诉责任机构','受理渠道','客户类型','工单状态'],lineDetailSelection.selectedRows.map(row=>[row.id,row.date,selectedLine,row.product,row.cause,row.institution,row.channel,row.customerType,row.status]));
      React.useEffect(()=>{
        setLinePage(1);
        if(!selectedLineSet.has(selectedLine)){
          setSelectedLine(scopedLinesRaw[0]?.[0]||'');
        }
      },[effectiveLineSelection.join('|')]);
      const lineMethods={
        comparison:{question:'哪些业务条线的投诉问题最突出？',caliber:'按所属业务条线归集统计期内有效投诉，排除无效、撤销、废止及剔除工单，按工单编号去重。仅展示查询栏所选业务条线；未选择时展示全部条线，按投诉量降序每页展示 7 条。占比＝该条线有效投诉量÷当前范围有效投诉总量×100%，同比和环比按对应周期计算。',value:'比较各业务条线投诉压力和变化趋势，明确需要优先关注的业务领域及管理责任。',source:'工单编号、客户投诉时间、有效投诉标识、所属业务条线、投诉责任部门、撤销标识、废止标识、剔除标识。'},
        related:{question:'该条线的问题主要集中在哪些产品、原因、机构、渠道和客户群体？',caliber:'继承当前日期、机构范围和业务条线筛选条件，分别按一级产品、修正投诉原因一级标签、投诉责任机构、受理渠道或客户标签汇总有效投诉量，并展示各关联对象的投诉量和占比。',value:'定位条线内部的具体产品问题、主要投诉原因、责任机构、投诉来源和重点客户群体，支持条线部门制定针对性的优化与整改措施。',source:'工单编号、有效投诉标识、所属业务条线、一级产品分类、修正投诉原因一级标签、投诉责任机构、受理渠道、客户标签。'},
        detail:{question:'哪些单笔投诉构成当前条线分析结果？',caliber:'明细仅接受“各业务条线投诉量对比”当前选中条线的交叉筛选，关联分布的五个视角只用于查看，不影响明细，工单按编号去重。',value:'用单笔工单核验条线分析结论，查看具体客户问题和处理状态，并支持责任追溯及后续整改。',source:'工单编号、客户投诉时间、有效投诉标识、所属业务条线、投诉原因一级标签、一级产品分类、投诉责任机构、受理渠道、客户类型、工单状态。'}
      };
      const Info=({type,label})=>{const method=lineMethods[type];const info={title:label,question:method.question,caliber:method.caliber,value:method.value,source:method.source};return <CompactInfoPopover info={info} ariaLabel={`查看${label}指标说明`}/>};
      const Rank=({data})=><div><div className="mb-2 grid items-center gap-4 px-3 text-[11px] text-slate-400" style={{gridTemplateColumns:'160px minmax(0,1fr) 75px 65px'}}><span>名称</span><span/><span className="text-right">投诉量</span><span className="text-right">占比</span></div><div data-testid="line-related-ranking" className="space-y-2.5">{data.map((item,i)=><div key={item[0]} className="grid w-full items-center gap-4 rounded-md px-3 py-2 text-left text-xs" style={{gridTemplateColumns:'160px minmax(0,1fr) 75px 65px'}}><span className="flex min-w-0 items-center gap-2"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] ${i<3?'bg-[#2272DE] text-white':'bg-slate-100 text-slate-500'}`}>{i+1}</span><span className="truncate">{item[0]}</span></span><span className="h-5 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded bg-violet-500" style={{width:`${parseFloat(item[2])/Math.max(...data.map(row=>parseFloat(row[2])))*100}%`}}/></span><span className="text-right">{item[1]}件</span><span className="text-right">{item[2]}</span></div>)}</div></div>;
      return <div className="mx-auto max-w-[1540px] px-6 py-5"><nav className="mb-4 flex gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">条线分析</span></nav><section className="mb-4 flex items-end justify-between"><div><h1 className="text-2xl font-semibold text-slate-900">条线分析</h1></div><div className="text-xs text-slate-400">数据更新时间：2026-07-15 12:00</div></section>
        <ComplaintAnalysisFilters pageKey="line" initialFilter={initialQuery?.filter} startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onOrgChange={org=>setSelectedOrg(org.startsWith('全行')?'全行':org)} onFilterChange={changes=>setLinkedFilter(prev=>({...prev,...changes}))} onQuery={({org,orgSelection,lineSelection,channel,caliber,compare,organizationDimension,organizationField,excluded})=>{setSelectedOrg(org.startsWith('全行')?'全行':org);setLinkedFilter({channel,caliber,compare,organizationDimension,organizationField,excluded,orgSelection,lineSelection})}}/>
        <section data-testid="line-comparison-card" className="mb-4 rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-semibold text-slate-800">各业务条线投诉量对比</h2><p className="mt-1 text-xs text-slate-400">{effectiveLineSelection.length===BUSINESS_LINE_OPTIONS.length?'展示全部业务条线':`展示已选 ${effectiveLineSelection.length} 项业务条线`}</p></div><Info type="comparison" label="各业务条线投诉量对比"/></div><div data-testid="line-comparison-list" className="space-y-2">{pagedLines.map(item=><button data-line-name={item[0]} key={item[0]} onClick={()=>setSelectedLine(item[0])} className={`grid w-full grid-cols-[150px_1fr_95px_90px] items-center gap-4 rounded-lg px-3 py-2 text-left transition ${selectedLine===item[0]?'bg-violet-50 ring-1 ring-violet-200':'hover:bg-slate-50'}`}><span className={`text-xs font-medium ${selectedLine===item[0]?'text-violet-700':'text-slate-700'}`}>{item[0]}</span><span className="h-7 overflow-hidden rounded bg-slate-100"><span className={`flex h-full items-center justify-end rounded px-2 text-[10px] text-white transition-all ${selectedLine===item[0]?'bg-violet-600':'bg-violet-400'}`} style={{width:`${item[1]/maxLineCount*100}%`,minWidth:'52px'}}>{item[1].toLocaleString()}</span></span><span className="text-right text-xs text-slate-500">占比 {item[2]}</span><span className={`text-right text-xs ${(linkedFilter.compare==='环比'?item[3]:item[4]).startsWith('+')?'text-rose-500':'text-emerald-600'}`}><span className="text-slate-400">{linkedFilter.compare}</span> <b className={(linkedFilter.compare==='环比'?item[3]:item[4]).startsWith('+')?'text-rose-500':'text-emerald-600'}>{normalizedComparison(linkedFilter.compare==='环比'?item[3]:item[4])}</b></span></button>)}</div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-[11px] text-slate-400">柱长表示当前查询口径下的条线投诉量。共 {lines.length} 个条线，每页 {linePageSize} 个</span><div data-testid="line-comparison-pagination" className="flex items-center gap-1"><button type="button" aria-label="条线对比上一页" disabled={linePage===1} onClick={()=>setLinePage(page=>Math.max(1,page-1))} className="grid h-8 w-8 place-items-center rounded border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"><span className="rotate-180"><Icon name="chevron" size={14}/></span></button>{Array.from({length:linePageCount},(_,index)=>index+1).map(page=><button type="button" key={page} aria-label={`条线对比第${page}页`} onClick={()=>setLinePage(page)} className={`h-8 min-w-8 rounded border px-2 text-xs ${linePage===page?'border-violet-600 bg-violet-600 text-white':'border-slate-200 text-slate-600 hover:border-violet-300'}`}>{page}</button>)}<button type="button" aria-label="条线对比下一页" disabled={linePage===linePageCount} onClick={()=>setLinePage(page=>Math.min(linePageCount,page+1))} className="grid h-8 w-8 place-items-center rounded border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="chevron" size={14}/></button></div></div></section>
        <section className="mb-4 rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">{selectedLine}｜关联分布 Top5</h3><p className="mt-1 text-[11px] text-slate-400">各视角仅供查看，不参与明细筛选</p></div><div className="flex items-center gap-3"><div className="flex rounded-md bg-slate-100 p-1">{['产品','原因','机构','渠道','客户'].map(view=><button key={view} onClick={()=>setRelatedView(view)} className={`rounded px-4 py-1.5 text-xs ${relatedView===view?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>{view}</button>)}</div><Info type="related" label="条线关联分布 Top5"/></div></div><div className="p-5"><Rank data={relatedView==='产品'?products:relatedView==='原因'?causes:relatedView==='机构'?institutions:relatedView==='渠道'?channels:customers}/></div></section>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">关联单笔投诉明细</h3><p className="mt-0.5 text-[11px] text-slate-400"><span className="mt-0.5 block">明细仅随“各业务条线投诉量对比”当前选中条线联动；当前示例匹配 {filteredDetails.length} 笔</span></p></div><div className="flex items-center gap-2"><button type="button" data-testid="line-detail-reset" onClick={()=>setSelectedLine(scopedLinesRaw[0]?.[0]||'')} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50">重置交叉筛选</button><button type="button" data-testid="line-detail-export" disabled={!lineDetailSelection.selectedRows.length} onClick={exportLineDetails} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40">导出明细</button><Info type="detail" label="关联单笔投诉明细"/></div></div><div data-testid="line-detail-filters" className="m-5 mb-4 flex flex-wrap gap-2 rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-xs"><span className="rounded-full bg-violet-600 px-3 py-1 text-white">所属业务条线：{selectedLine}</span></div><div data-testid="line-detail-table" className="mx-5 mb-5 overflow-x-auto rounded-md border border-slate-200"><div data-testid="line-detail-header" className="grid min-w-[1440px] bg-slate-50 px-4 py-2.5 text-[11px] text-slate-400" style={{gridTemplateColumns:'230px repeat(8,minmax(140px,1fr))'}}><SelectableHeader label="工单编号" selection={lineDetailSelection} testId="line-detail-select-all"/>{['客户投诉时间','所属业务条线','产品一级标签','投诉原因一级标签','责任机构','受理渠道','客户类型','工单状态'].map(h=><span key={h} className="whitespace-nowrap">{h}</span>)}</div>{filteredDetails.map(row=><div data-testid="line-detail-row" key={row.id} className="grid min-w-[1440px] border-t border-slate-100 px-4 py-3 text-left text-xs hover:bg-violet-50" style={{gridTemplateColumns:'230px repeat(8,minmax(140px,1fr))'}}><SelectableIdCell id={row.id} selection={lineDetailSelection} testId="line-detail-select" onOpen={onOpenTicket}/><span>{row.date}</span><span>{selectedLine}</span><span>{row.product}</span><span>{row.cause}</span><span>{row.institution}</span><span>{row.channel}</span><span>{row.customerType}</span><span><span className="rounded bg-slate-100 px-2 py-1">{row.status}</span></span></div>)}{filteredDetails.length===0&&<div className="px-5 py-10 text-center text-sm text-slate-400">当前条线下暂无匹配投诉，请调整筛选条件</div>}</div></section>
      </div>;
    }

    // 客户分析：仅使用工单中已经具备的客户字段，不引入无法从当前数据计算的客户资产或存量指标。
    function CustomerAnalysisPage({ onNavigate=()=>{},onOpenTicket }) {
      const initialCustomerDrilldown=window.__CUSTOMER_DRILLDOWN__||{dimension:null,group:null};
      const [selectedDimension,setSelectedDimension]=useState(initialCustomerDrilldown.dimension);
      const [selectedGroup,setSelectedGroup]=useState(initialCustomerDrilldown.group);
      const [selectedRegion,setSelectedRegion]=useState(null);
      const [relatedView,setRelatedView]=useState('产品');
      const [selectedRelated,setSelectedRelated]=useState('全部');
      const [selectedOrg,setSelectedOrg]=useState('全行');
      const [startDate,setStartDate]=useState('2026-07-01');
      const [endDate,setEndDate]=useState('2026-07-15');
      const [linkedFilter,setLinkedFilter]=useState(DEFAULT_LINKED_FILTER);
      const filterFactor=linkedAnalysisFactor(linkedFilter,startDate,endDate,selectedOrg);
      const filterSummary='';
      const customerCompareChange=linkedFilter.compare==='环比'?'+6.8%':'+14.2%';
      const dimensionDataRaw={
        '客户类型':[['自然人',10246,'82.1%'],['非自然人',2240,'17.9%']],
        '年龄':[['18岁以下',599,'4.8%'],['18—29岁',1836,'14.7%'],['30—39岁',3186,'25.5%'],['40—49岁',2864,'22.9%'],['50—59岁',2148,'17.2%'],['60岁及以上',1648,'13.2%'],['未知',212,'1.7%']],
        '性别':[['男性',6248,'50.0%'],['女性',6036,'48.3%'],['未知',202,'1.6%']],
        '地区':[['福建省',3862,'30.9%'],['上海市',1834,'14.7%'],['广东省',1586,'12.7%'],['北京市',1218,'9.8%'],['浙江省',986,'7.9%'],['其他国内地区',3000,'24.0%']],
        '境内外':[['境内客户',12086,'96.8%'],['境外客户',286,'2.3%'],['未知',114,'0.9%']],
        '风险客户类型':[['高龄老人',986,'7.9%'],['超高龄老人',512,'4.1%'],['未成年',468,'3.7%'],['重要客户',402,'3.2%'],['新市民',348,'2.8%'],['无风险客户',9770,'78.2%']]
      };
      const customerLineOptions=(linkedFilter.lineSelection||[]).length?linkedFilter.lineSelection:BUSINESS_LINE_OPTIONS;
      const relatedDataRaw={
        '产品':[['贷款',2486,'24.3%'],['存款',1486,'14.5%'],['财富管理',1168,'11.4%'],['支付结算',926,'9.0%'],['电子银行',768,'7.5%']],
        '原因':[['收费争议',1860,'18.2%'],['业务规则告知不清',1512,'14.8%'],['办理时效',1286,'12.6%'],['营销宣传争议',1034,'10.1%'],['服务态度',716,'7.0%']],
        '机构':[['厦门分行',1836,'17.9%'],['上海分行',1542,'15.0%'],['福州分行',1386,'13.5%'],['北京分行',1128,'11.0%'],['珠海分行',986,'9.6%']],
        '渠道':[['金融消费者保护服务平台',2486,'24.3%'],['客服电话',2158,'21.1%'],['营业网点',1686,'16.5%'],['在线客服',1168,'11.4%'],['机构专线电话',926,'9.0%']],
        '条线':perspectiveTop5Rows(customerLineOptions,840)
      };
      const dimensionNames=['客户类型','地区','性别','年龄','境内外','风险客户类型'];
      const hasCustomerSelection=Boolean(selectedDimension&&selectedGroup);
      const selectedDimensionIndex=hasCustomerSelection?Math.max(0,dimensionNames.indexOf(selectedDimension)):0;
      const selectedGroupIndex=hasCustomerSelection?Math.max(0,(dimensionDataRaw[selectedDimension]||[]).findIndex(row=>row[0]===selectedGroup)):0;
      const crossFilterWeights=[.58,.67,.74,.82,.9,.96];
      const dimensionData=Object.fromEntries(Object.entries(dimensionDataRaw).map(([key,rows],dimensionIndex)=>{
        if(key==='地区'&&selectedDimension==='境内外'&&selectedGroup!=='境内客户')return [key,rows.map(row=>[row[0],0,'0%'])];
        const geographyPair=(selectedDimension==='地区'&&key==='境内外')||(selectedDimension==='境内外'&&key==='地区');
        const adjusted=rows.map((row,rowIndex)=>{const crossWeight=!hasCustomerSelection||key===selectedDimension||geographyPair?1:crossFilterWeights[(rowIndex+selectedGroupIndex*2+selectedDimensionIndex+dimensionIndex)%crossFilterWeights.length];return [row[0],scaleLinkedCount(row[1]*crossWeight,filterFactor),row[2]];});
        if(!hasCustomerSelection||key===selectedDimension||geographyPair)return [key,adjusted];
        const total=Math.max(1,adjusted.reduce((sum,row)=>sum+row[1],0));
        return [key,adjusted.map(row=>[row[0],row[1],`${(row[1]/total*100).toFixed(1)}%`])];
      }));
      const relatedData=Object.fromEntries(Object.entries(relatedDataRaw).map(([key,rows],viewIndex)=>{const adjusted=rows.map((row,rowIndex)=>[row[0],scaleLinkedCount(row[1]*(hasCustomerSelection?crossFilterWeights[(rowIndex+selectedGroupIndex+viewIndex)%crossFilterWeights.length]:1),filterFactor),row[2]]);const total=Math.max(1,adjusted.reduce((sum,row)=>sum+row[1],0));return [key,adjusted.map(row=>[row[0],row[1],`${(row[1]/total*100).toFixed(1)}%`])];}));
      const detailSeeds=[['自然人','18岁以下','男性','境内客户','福建省','电子银行','功能与系统异常','厦门分行','在线客服'],['自然人','30—39岁','女性','境内客户','福建省','个人贷款','收费争议','厦门分行','客服电话'],['非自然人','未知','未知','境内客户','广东省','支付结算','办理时效','珠海分行','营业网点'],['自然人','60岁及以上','女性','境内客户','福建省','理财产品','业务规则告知不清','福州分行','机构专线电话'],['自然人','18—29岁','男性','境内客户','北京市','借记卡','功能与系统异常','北京分行','在线客服'],['自然人','50—59岁','女性','境外客户','境外','个人贷款','营销宣传争议','厦门分行','金融消费者保护服务平台'],['非自然人','未知','未知','境内客户','浙江省','支付结算','收费争议','上海分行','客服电话']];
      const detailRiskTypes=['高龄老人','无风险客户','超高龄老人','未成年','重要客户','新市民'];
      const details=Array.from({length:24},(_,i)=>{const seed=detailSeeds[i%detailSeeds.length];return {id:`TS202607${String(3201+i).padStart(4,'0')}`,customer:`KH****${String(1286+i).slice(-4)}`,date:`2026-07-${String(15-(i%15)).padStart(2,'0')}`,type:seed[0],age:seed[1],gender:seed[2],domestic:seed[3],region:seed[4],product:seed[5],reason:seed[6],institution:seed[7],channel:seed[8],line:customerLineOptions[i%Math.max(1,customerLineOptions.length)]||'—',riskType:detailRiskTypes[i%detailRiskTypes.length],status:['处理中','已办结','待处理'][i%3]};});
      const dimensionField={'客户类型':'type','年龄':'age','性别':'gender','境内外':'domestic','地区':'region','风险客户类型':'riskType'};
      const filteredDetails=details.filter(row=>row.date>=startDate&&row.date<=endDate&&(selectedOrg==='全行'||row.institution===selectedOrg)&&(linkedFilter.channel==='全部渠道'||(linkedFilter.channel==='监管转送'?row.channel.includes('金管局'):!row.channel.includes('金管局')))&&(!hasCustomerSelection||row[dimensionField[selectedDimension]]===selectedGroup)&&(!selectedRegion||row.region===selectedRegion)).slice(0,Math.ceil(24*Math.min(1,filterFactor)));
      const customerDetailSelection=useSelectableRows(filteredDetails,row=>row.id);
      const exportCustomerDetails=()=>downloadCsv(`客户分析关联投诉明细_${startDate}_${endDate}.csv`,['工单编号','客户投诉时间','客户编号','客户类型','年龄','性别','境内外/地区','风险类型','产品','投诉原因','责任机构','受理渠道','业务条线','工单状态'],customerDetailSelection.selectedRows.map(row=>[row.id,row.date,row.customer,row.type,row.age,row.gender,`${row.domestic} · ${row.region}`,row.riskType,row.product,row.reason,row.institution,row.channel,row.line,row.status]));
      const resetCustomerDetail=()=>{setSelectedDimension(null);setSelectedGroup(null);setSelectedRegion(null);setSelectedRelated('全部');};
      const selectGroup=(dimension,row)=>{
        if(dimension==='地区'&&selectedDimension==='境内外'&&selectedGroup==='境内客户'){
          setSelectedRegion(current=>current===row[0]?null:row[0]);setSelectedRelated('全部');return;
        }
        if(selectedDimension&&selectedDimension!==dimension)return;
        if(selectedDimension===dimension&&selectedGroup===row[0]){setSelectedDimension(null);setSelectedGroup(null);setSelectedRegion(null);setSelectedRelated('全部');return;}
        setSelectedDimension(dimension);setSelectedGroup(row[0]);setSelectedRegion(null);setSelectedRelated('全部');
      };
      const customerMethods={overview:{title:'客户分析',question:'哪些类型的客户投诉更集中，主要涉及什么问题？',caliber:'在当前查询范围内，按客户编号识别投诉客户并按工单编号统计投诉量。',value:'识别投诉集中客群及其主要问题，支持差异化服务和重点客群保护。',source:'工单编号、客户编号、客户类型、出生年月、客户性别、是否境内、居住地省市区。'},distribution:{title:'客户投诉构成',question:'投诉主要集中在哪类客户？',caliber:'按多个客户维度分别汇总有效投诉工单数并计算占比。',value:'拆开展示客户类型、年龄、性别、地区等维度，避免切换时遗漏结构差异。',source:'客户类型、出生年月、性别、境内外、地区。'},related:{title:'重点客群关联分布',question:'该客群的投诉集中在哪些产品、原因、机构、渠道和业务条线？',caliber:'继承日期、机构范围和所选客户分组，分别按产品、原因、机构、渠道或所属业务条线汇总；各视角 Top5 只读，不作为明细筛选条件。',value:'将客群特征与具体业务问题及责任条线关联。',source:'客户字段、产品、原因、机构、受理渠道、所属业务条线。'},detail:{title:'关联单笔投诉明细',question:'哪些投诉工单构成当前客户分析结果？',caliber:'仅接受客户投诉构成中客户类型、地区、性别、年龄、境内外、风险客户类型六个维度的筛选，关联分布 Top5 不参与明细筛选，工单按编号去重。',value:'用单笔工单核验客群分析结论。',source:'工单编号、客户投诉时间、客户编号、客户类型、年龄、性别、境内外/地区、风险类型、产品、投诉原因、责任机构、受理渠道、业务条线、工单状态。'}};
      const Info=({type,label})=><CompactInfoPopover info={{...customerMethods[type],title:label||customerMethods[type].title}} ariaLabel={`查看${label||customerMethods[type].title}说明`}/>;
      const chartPalettes={
        '客户类型':['#165DB5','#7CA9E8'],
        '年龄':['#165DB5','#2272DE','#4997FF','#5B9BE8','#7CA9E8','#9BBDEA','#CBD5E1'],
        '性别':['#2272DE','#6F8FD8','#CBD5E1'],
        '地区':['#165DB5','#2272DE','#4386D8','#68A3D8','#8CB5EB','#CBD5E1'],
        '境内外':['#2272DE','#7CA9E8','#CBD5E1']
      };
      const renderDimensionChart=(dimension,rows)=>{
        const palette=chartPalettes[dimension]||chartPalettes.年龄;
        const mutedPalette=['#AEB8C6','#B8C1CD','#C1C9D4','#CAD1DA','#D2D8E0','#D9DEE5','#DFE3E9','#E4E8ED','#E8EBEF','#ECEFF2','#F0F2F4','#F3F5F7'];
        const geographyUnavailable=dimension==='地区'&&selectedDimension==='境内外'&&selectedGroup!=='境内客户';
        const maxValue=Math.max(...rows.map(item=>item[1]),1);
        const selected=row=>dimension==='地区'&&selectedDimension==='境内外'?selectedRegion===row[0]:selectedDimension===dimension&&selectedGroup===row[0];
        const colorFor=(row,index)=>geographyUnavailable?'#CBD5E1':selected(row)?palette[index%palette.length]:selectedDimension===dimension?mutedPalette[index%mutedPalette.length]:(row[0].includes('其他')||row[0].includes('未知'))?'#CBD5E1':palette[index%palette.length];
        const geographyDrilldown=dimension==='地区'&&selectedDimension==='境内外'&&selectedGroup==='境内客户';
        const dimensionLocked=Boolean(selectedDimension&&selectedDimension!==dimension&&!geographyDrilldown);
        const choose=row=>selectGroup(dimension,row);
        const chooseDonutSegment=(event)=>{
          if(dimensionLocked)return;
          const rect=event.currentTarget.getBoundingClientRect();
          const dx=event.clientX-(rect.left+rect.width/2);
          const dy=event.clientY-(rect.top+rect.height/2);
          const radius=Math.sqrt(dx*dx+dy*dy);
          if(radius<rect.width*.27)return;
          const angle=(Math.atan2(dy,dx)*180/Math.PI+450)%360;
          let cursor=0;
          const target=rows.find(row=>{cursor+=parseFloat(row[2])*3.6;return angle<=cursor;})||rows[rows.length-1];
          choose(target);
        };
        const selectedClass=row=>selected(row)?'border-[#2272DE] bg-[#E9F1FC] ring-1 ring-[#A7C7F2]':dimensionLocked?'cursor-not-allowed border-slate-100 bg-slate-50/40':'border-slate-100 hover:border-[#A7C7F2] hover:bg-slate-50';
        if(dimension==='客户类型'){
          let cursor=0;
          const gradient=`conic-gradient(${rows.map((row,index)=>{const start=cursor;cursor+=parseFloat(row[2]);return `${colorFor(row,index)} ${start}% ${cursor}%`}).join(',')})`;
          const focusRow=selectedDimension===dimension?rows.find(selected)||rows[0]:rows[0];
          return <div className="grid grid-cols-[112px_1fr] items-center gap-4"><div role="button" aria-label="点击圆环选择客户类型" title="点击圆环扇区筛选，再次点击已选扇区取消" onClick={chooseDonutSegment} className={`relative h-28 w-28 rounded-full ${dimensionLocked?'cursor-not-allowed':'cursor-pointer'}`} style={{background:gradient}}><div onClick={event=>event.stopPropagation()} className="absolute inset-5 grid place-items-center rounded-full bg-white text-center"><span><b className="block text-xl text-slate-800">{focusRow[2]}</b><small className="text-[10px] text-slate-400">{focusRow[0]}</small></span></div></div><div className="space-y-2">{rows.map((row,index)=><button type="button" key={row[0]} disabled={dimensionLocked} onClick={()=>choose(row)} className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs ${selectedClass(row)}`}><i className="h-2.5 w-2.5 rounded-sm" style={{background:colorFor(row,index)}}/><span className="flex-1 text-slate-600">{row[0]}</span><b className="text-slate-700">{row[2]}</b></button>)}</div></div>;
        }
        if(dimension==='年龄'||dimension==='风险客户类型')return <div className="space-y-2">{rows.map((row,index)=><button type="button" key={row[0]} disabled={dimensionLocked} onClick={()=>choose(row)} className={`grid w-full grid-cols-[76px_1fr_48px] items-center gap-2 rounded border px-2 py-1.5 text-left text-[11px] ${selectedClass(row)}`}><span className="whitespace-nowrap text-slate-600">{row[0]}</span><span className="h-3 overflow-hidden rounded-sm bg-slate-100"><i className="block h-full rounded-sm" style={{width:`${row[1]/maxValue*100}%`,background:colorFor(row,index)}}/></span><b className="text-right text-slate-600">{row[2]}</b></button>)}</div>;
        if(dimension==='性别')return <div><div className="flex h-11 overflow-hidden rounded-md border border-white">{rows.map((row,index)=><button type="button" key={row[0]} disabled={dimensionLocked} onClick={()=>choose(row)} title={`${row[0]} ${row[2]}`} className={`h-full text-[10px] font-medium text-white ${selected(row)?'ring-2 ring-inset ring-[#123E78]':''}`} style={{width:row[2],background:colorFor(row,index),minWidth:index===2?'9px':'0'}}>{parseFloat(row[2])>8?row[2]:''}</button>)}</div><div className="mt-4 grid grid-cols-3 gap-2">{rows.map((row,index)=><button type="button" key={row[0]} disabled={dimensionLocked} onClick={()=>choose(row)} className={`rounded-md border px-2 py-3 text-center ${selectedClass(row)}`}><i className="mx-auto block h-2 w-6 rounded-sm" style={{background:colorFor(row,index)}}/><span className="mt-2 block text-[11px] text-slate-500">{row[0]}</span><b className="mt-1 block text-sm text-slate-700">{row[1].toLocaleString()}</b></button>)}</div></div>;
        if(dimension==='地区')return <div className="flex h-[174px] items-end gap-2 pt-4">{rows.map((row,index)=><button type="button" key={row[0]} disabled={dimensionLocked} onClick={()=>choose(row)} className={`group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded px-1 pt-1 ${selected(row)?'bg-[#E9F1FC] ring-1 ring-[#A7C7F2]':'hover:bg-slate-50'}`}><b className="text-[10px] text-slate-500">{row[2]}</b><span className="w-full rounded-t-sm transition group-hover:brightness-95" style={{height:`${Math.max(20,row[1]/maxValue*105)}px`,background:colorFor(row,index)}}/><span className="h-7 text-center text-[9px] leading-3 text-slate-500">{row[0]}</span></button>)}</div>;
        if(dimension==='境内外')return <div><div className="flex h-12 overflow-hidden rounded-md border border-white">{rows.map((row,index)=><button type="button" key={row[0]} disabled={dimensionLocked} onClick={()=>choose(row)} title={`${row[0]} ${row[2]}`} className={`h-full px-1 text-[10px] font-medium text-white ${selected(row)?'ring-2 ring-inset ring-[#123E78]':''}`} style={{width:row[2],background:colorFor(row,index),minWidth:index>0?'10px':'0'}}>{parseFloat(row[2])>8?row[2]:''}</button>)}</div><div className="mt-5 space-y-2">{rows.map((row,index)=><button type="button" key={row[0]} disabled={dimensionLocked} onClick={()=>choose(row)} className={`flex w-full items-center gap-2 rounded border px-2.5 py-2 text-left text-[11px] ${selectedClass(row)}`}><i className="h-2.5 w-2.5 rounded-sm" style={{background:colorFor(row,index)}}/><span className="flex-1 text-slate-600">{row[0]}</span><b className="text-slate-700">{row[1].toLocaleString()} · {row[2]}</b></button>)}</div></div>;
        return null;
      };
      return <div className="mx-auto max-w-[1540px] px-6 py-5">
        <nav className="mb-4 flex gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">客户分析</span></nav>
        <section className="mb-4 flex items-end justify-between"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold text-slate-900">客户分析</h1><Info type="overview"/></div></div><div className="text-xs text-slate-400">数据更新时间：2026-07-15 12:00</div></section>
        <ComplaintAnalysisFilters pageKey="customer" startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onOrgChange={org=>setSelectedOrg(org.startsWith('全行')?'全行':org)} onFilterChange={changes=>setLinkedFilter(prev=>({...prev,...changes}))} onQuery={({org,orgSelection,lineSelection,channel,caliber,compare,organizationDimension,organizationField,excluded})=>{setSelectedOrg(org.startsWith('全行')?'全行':org);setSelectedRelated('全部');setLinkedFilter({channel,caliber,compare,organizationDimension,organizationField,excluded,orgSelection,lineSelection})}}/>
        <section className="mb-4 grid grid-cols-5 gap-4">{[
          {label:'投诉客户数',value:scaleLinkedCount(8742,filterFactor).toLocaleString(),unit:'人',change:customerCompareChange,icon:'users'},
          {label:'客均投诉件数',value:(1.43*(linkedFilter.caliber==='全部受理'?1:linkedFilter.caliber==='有效投诉'?0.96:0.83)).toFixed(2),unit:'件/人',change:linkedFilter.compare==='环比'?'+1.2%':'+3.8%',icon:'chart'},
          {label:'重复投诉客户数',value:scaleLinkedCount(214,filterFactor).toLocaleString(),unit:'人',change:linkedFilter.compare==='环比'?'+8.3%':'+16.5%',icon:'repeat'},
          {label:'境内客户投诉占比',value:'96.8',unit:'%',change:linkedFilter.compare==='环比'?'+0.2%':'+0.5%',icon:'building'},
          {label:'投诉升级客户数',value:scaleLinkedCount(386,filterFactor).toLocaleString(),unit:'人',change:linkedFilter.compare==='环比'?'+12.4%':'+24.1%',icon:'alert'}
        ].map(item=><AnalysisMetricCard key={item.label} label={item.label} value={item.value} unit={item.unit} compareLabel={linkedFilter.compare} compareValue={item.change} icon={item.icon} info={{...customerMethods.overview,title:item.label}}/>)}</section>
        <section data-testid="customer-composition" className="mb-4 rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-base font-semibold text-slate-800">客户投诉构成</h2></div><Info type="distribution"/></div><div className="grid grid-cols-3 gap-4 p-5">{dimensionNames.map(dimension=>{const rows=dimensionData[dimension];const geographyDrilldown=dimension==='地区'&&selectedDimension==='境内外'&&selectedGroup==='境内客户';return <article data-customer-dimension={dimension} key={dimension} className={`min-h-[260px] rounded-lg border p-4 ${selectedDimension===dimension||geographyDrilldown?'border-[#2272DE] bg-[#F4F8FE]':'border-slate-100 bg-white'} ${selectedDimension&&selectedDimension!==dimension&&!geographyDrilldown?'opacity-80':''}`}><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-700">{dimension}</h3><span className={`rounded px-2 py-1 text-[10px] ${selectedDimension===dimension||geographyDrilldown?'bg-[#E9F1FC] text-[#165DB5]':'bg-slate-100 text-slate-500'}`}>{selectedDimension===dimension?'筛选条件':geographyDrilldown?'可继续筛选':selectedDimension?'已联动':'可选择'} · {rows.length} 类</span></div>{renderDimensionChart(dimension,rows)}</article>})}</div><div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">{hasCustomerSelection?<>当前筛选：{selectedDimension}＝{selectedGroup}{selectedRegion?`｜地区＝${selectedRegion}`:''}。再次点击已选项可取消；取消后可选择其他维度。</>:<>当前未选择客户构成条件，可从任一维度开始筛选。</>}</div></section>
        <section className="mb-4 rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">{hasCustomerSelection?selectedGroup:'全部客户'}｜关联分布 Top5</h3><p className="mt-1 text-[11px] text-slate-400">查看该客群主要涉及的产品、原因、责任机构、投诉受理渠道和业务条线；各视角 Top5 仅供查看，不参与明细筛选</p></div><div className="flex items-center gap-3"><div className="flex rounded-md bg-slate-100 p-1">{Object.keys(relatedData).map(item=><button key={item} onClick={()=>setRelatedView(item)} className={`rounded px-4 py-1.5 text-xs ${relatedView===item?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>{item}</button>)}</div><Info type="related"/></div></div><div className="space-y-2.5 p-5"><div className="grid items-center gap-4 px-3 text-[11px] text-slate-400" style={{gridTemplateColumns:'28px 160px minmax(0,1fr) 75px 65px'}}><span/><span>名称</span><span/><span className="text-right">投诉量</span><span className="text-right">占比</span></div><div data-testid="customer-related-ranking">{relatedData[relatedView].map((item,index)=><div key={item[0]} className="grid w-full items-center gap-4 rounded-md px-3 py-2.5 text-left text-xs" style={{gridTemplateColumns:'28px 160px minmax(0,1fr) 75px 65px'}}><span className={`grid h-6 w-6 place-items-center rounded text-[10px] ${index<3?'bg-[#2272DE] text-white':'bg-slate-100 text-slate-500'}`}>{index+1}</span><span className="font-medium text-slate-700">{item[0]}</span><span className="h-5 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded bg-violet-400" style={{width:`${parseFloat(item[2])*3}%`}}/></span><span className="text-right text-slate-500">{item[1].toLocaleString()}件</span><span className="text-right text-slate-500">{item[2]}</span></div>)}</div></div></section>
        <section data-testid="customer-detail-section" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">关联单笔投诉明细</h3><p className="mt-0.5 text-[11px] text-slate-400"><span className="mt-0.5 block">明细仅随客户投诉构成中的六个维度筛选联动；关联分布 Top5 仅供查看</span></p></div><div className="flex items-center gap-2"><button type="button" data-testid="customer-detail-reset" onClick={resetCustomerDetail} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50">重置交叉筛选</button><button type="button" data-testid="customer-detail-export" disabled={!customerDetailSelection.selectedRows.length} onClick={exportCustomerDetails} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40">导出明细</button><Info type="detail"/></div></div><div data-testid="customer-detail-filters" className="m-5 mb-4 flex flex-wrap gap-2 rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-xs"><span className="rounded-full bg-slate-200 px-3 py-1 text-slate-600">客户维度：{hasCustomerSelection?`${selectedDimension}＝${selectedGroup}`:'全部'}</span>{selectedRegion&&<span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">地区：{selectedRegion}</span>}</div><div className="overflow-x-auto"><table data-testid="customer-detail-table" className="min-w-[1852px] w-full table-fixed text-left text-xs"><colgroup>{[230,140,108,108,108,108,150,120,120,150,140,140,140,120].map((width,index)=><col key={index} style={{width}}/>)}</colgroup><thead className="bg-slate-50 text-slate-500"><tr><th className="whitespace-nowrap px-5 py-3 font-medium"><SelectableHeader label="工单编号" selection={customerDetailSelection} testId="customer-detail-select-all"/></th>{['客户投诉时间','客户编号','客户类型','年龄','性别','境内外/地区','风险类型','产品标签','投诉原因标签','责任机构','受理渠道','所属业务条线','工单状态'].map(h=><th key={h} className="whitespace-nowrap px-5 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredDetails.map(row=><tr data-testid="customer-detail-row" key={row.id} className="hover:bg-violet-50/40"><td className="px-5 py-3"><SelectableIdCell id={row.id} selection={customerDetailSelection} testId="customer-detail-select" onOpen={onOpenTicket}/></td><td className="px-5 py-3">{row.date}</td><td className="px-5 py-3">{row.customer}</td><td className="px-5 py-3">{row.type}</td><td className="px-5 py-3">{row.age}</td><td className="px-5 py-3">{row.gender}</td><td className="px-5 py-3">{row.domestic} · {row.region}</td><td className="px-5 py-3">{row.riskType}</td><td className="px-5 py-3">{row.product}</td><td className="px-5 py-3">{row.reason}</td><td className="px-5 py-3">{row.institution}</td><td className="px-5 py-3">{row.channel}</td><td className="px-5 py-3">{row.line}</td><td className="px-5 py-3"><span className="rounded bg-slate-100 px-2 py-1">{row.status}</span></td></tr>)}{filteredDetails.length===0&&<tr><td colSpan="14" className="px-5 py-10 text-center text-slate-400">当前客户维度条件下暂无匹配投诉，请调整筛选条件</td></tr>}</tbody></table></div></section>
      </div>;
    }
    // 首页管理摘要：仅呈现投诉态势和风险提醒。
    function HomeDashboardPage({ onNavigate, embedded = false }) {
      // 首页说明统一回答“看什么、有什么价值、数据从哪里来”。
      const homeExplain={
        overview:{title:'首页',question:'当前整体投诉形势是否正常，最需要优先处理什么？',caliber:'在当前账号的数据权限范围内，汇总本统计周期的投诉态势和风险提醒。具体原因和投诉明细进入对应分析模块查看。',value:'帮助管理层快速判断整体压力和风险优先级，减少在多个页面之间反复查找。',source:'投诉工单、有效投诉标识、监管转送标识、重复投诉标识、超期状态、异常及黑灰产标签。'},
        attitude:{title:'投诉态势',question:'当前投诉规模和风险指标是否出现异常变化？',caliber:'展示有效投诉量、监管投诉量、重复投诉量和超期投诉量，同时显示环比变化、近7个统计周期趋势及风险状态。',value:'快速判断整体投诉压力、监管风险、问题复发和处理积压是否异常，为后续专题分析确定方向。',source:'工单编号、客户投诉时间、有效投诉标识、监管转送标识、是否再次投诉、工单状态、是否超期。'},
        risk:{title:'风险提醒',question:'当前最需要优先处理的投诉风险是什么？',caliber:'根据机构投诉增幅、监管投诉变化和黑灰产待核验数量生成风险提醒。当前示例中，一级机构环比增幅大于20%或同比增幅大于30%时触发投诉激增提醒。',value:'将分散的异常信号转化为明确的优先事项，帮助管理层快速确定核查对象和处置入口。',source:'机构有效投诉量、同期对比数据、监管转送投诉、黑灰产标识、核验状态、投诉责任机构、产品分类。'},
        focus:{title:'重点关注',question:'投诉风险主要集中在哪些机构、产品、原因和条线？',caliber:'分别选取当前有效投诉量、占比或增幅较突出的机构、一级产品、一级投诉原因和业务条线作为重点对象。首页每个维度仅展示一个管理摘要。',value:'快速定位需要重点关注的业务对象，并可直接进入对应专题分析继续下钻和核验。',source:'工单编号、有效投诉标识、投诉责任机构、一级产品分类、修正投诉原因一级标签、所属业务条线、同比及环比数据。'},
        rectification:{title:'整改跟踪',question:'重点问题整改是否按计划推进，投诉是否开始下降？',caliber:'汇总整改中、已完成和已逾期任务，并展示所选整改单的任务进度及阶段投诉降幅。阶段投诉降幅＝（整改基准期有效投诉量－当前观察期有效投诉量）÷整改基准期有效投诉量×100%。',value:'识别逾期或效果不明显的整改事项，推动责任部门及时调整措施并形成管理闭环。',source:'整改单编号、整改事项、责任部门、任务状态、任务进度、整改时间、关联工单编号、有效投诉量。'}
      };
      const attitudeData={
        effective:{label:'有效投诉量',value:'12,486',unit:'件',change:'+6.8%',status:'关注',tone:'violet',icon:'file',series:[1486,1532,1498,1686,1768,1892,2014],summary:'有效投诉量温和上升，当前仍在正常波动区间，但需关注连续增长机构。'},
        regulatory:{label:'监管投诉量',value:'1,286',unit:'件',change:'+12.3%',status:'预警',tone:'rose',icon:'shield',series:[126,138,154,168,196,224,280],summary:'监管投诉增幅高于有效投诉增幅，监管处置压力正在上升。'},
        repeat:{label:'重复投诉量',value:'286',unit:'件',change:'+8.3%',status:'关注',tone:'amber',icon:'repeat',series:[28,31,36,35,42,51,63],summary:'重复投诉连续两期增长，部分问题可能未在首次处理中真正解决。'},
        overdue:{label:'超期投诉量',value:'12',unit:'件',change:'+20.0%',status:'预警',tone:'rose',icon:'alert',series:[4,5,4,6,7,9,12],summary:'超期投诉增幅达到预警阈值，应优先协调责任机构处理高龄工单。'}
      };
      const risks=[
        {key:'surge',level:'高',title:'3家一级机构投诉增幅超阈值',subject:'上海分行、北京分行、厦门分行',detail:'其中上海分行环比和同比同时超过预警阈值，个人贷款及合作类贷款投诉增量较集中。',action:'进入机构分析核查增长来源',route:'institution2',tone:'rose'},
        {key:'regulatory',level:'高',title:'监管投诉增幅高于整体投诉',subject:'个人贷款',detail:'监管投诉环比增长12.3%，高于有效投诉增幅5.5个百分点，需关注监管转送原因和回复时限。',action:'查看监管风险机构分布',route:'institution2',tone:'rose'},
        {key:'black',level:'中',title:'9件黑灰产投诉待核验',subject:'代理维权、职业投诉',detail:'待核验投诉主要集中在个人贷款，部分联系方式关联多笔投诉事件。',action:'进入投诉总览查看明细',route:'production',tone:'amber'}
      ];
      const focusItems=[
        {key:'institution',label:'重点机构',name:'上海分行',metric:'有效投诉742件 · 环比+22.5%',reason:'投诉量和增幅同时较高',route:'institution2',icon:'building'},
        {key:'product',label:'重点产品',name:'合作类贷款',metric:'有效投诉2,860件 · 占19.6%',reason:'收费争议及监管投诉较集中',route:'product',icon:'file'},
        {key:'reason',label:'重点原因',name:'收费争议',metric:'有效投诉1,860件 · 环比+18.6%',reason:'连续增长且关联多个产品',route:'reason',icon:'alert'},
        {key:'line',label:'重点条线',name:'零售金融部',metric:'有效投诉2,368件 · 占26.7%',reason:'当前投诉压力最高的业务条线',route:'line',icon:'branch'}
      ];
      const rectTasks=[
        {id:'ZG202607001',name:'贷款费用告知整改',owner:'零售金融部',status:'已完成',progress:100,decline:'31.2%',note:'有效投诉量已明显下降，继续观察两个统计周期。'},
        {id:'ZG202607002',name:'贷款提前还款流程优化',owner:'零售金融部',status:'整改中',progress:68,decline:'15.5%',note:'阶段降幅尚未达到20%目标，需要加快系统和流程优化。'},
        {id:'ZG202607005',name:'支付到账时效优化',owner:'网络金融部',status:'已逾期',progress:46,decline:'4.7%',note:'任务已逾期且投诉下降不明显，需要升级协调责任部门。'}
      ];
      const [activeMetric,setActiveMetric]=useState('effective');
      const [selectedRisk,setSelectedRisk]=useState(risks[0]);
      const [selectedFocus,setSelectedFocus]=useState(focusItems[0]);
      const [selectedRect,setSelectedRect]=useState(rectTasks[1]);
      const active=attitudeData[activeMetric];
      const values=active.series, max=Math.max(...values)*1.12, min=Math.min(...values)*.88;
      const px=i=>36+i*74, py=value=>126-(value-min)/(max-min)*92;
      const toneClass=tone=>tone==='rose'?'bg-rose-50 text-rose-600':tone==='amber'?'bg-amber-50 text-amber-700':'bg-violet-50 text-violet-700';
      return <div className={embedded ? "mt-8 border-t border-slate-200 pt-6" : "mx-auto max-w-[1540px] px-6 py-5"}>
        {!embedded && <section className="mb-5 flex items-end justify-between"><div><div className="text-xs text-slate-400">首页 / 管理驾驶舱</div><div className="mt-2 flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-900">上午好，总行消保管理员</h1><CompactInfoPopover info={homeExplain.overview} ariaLabel="查看首页说明"/></div></div><div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500"/>数据更新时间：2026-07-15 12:00</div></section>}
        {embedded && <section className="mb-4 flex items-end justify-between"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-slate-900">管理关注与处置跟踪</h2><CompactInfoPopover info={{...homeExplain.overview,title:'管理关注与处置跟踪'}} ariaLabel="查看管理关注与处置跟踪说明"/></div></div><span className="text-[11px] text-slate-400">管理摘要</span></section>}

        <section className="rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold text-slate-800">投诉态势</h2><CompactInfoPopover info={homeExplain.attitude} ariaLabel="查看投诉态势说明"/></div></div><button onClick={()=>onNavigate('production')} className="text-xs font-medium text-violet-600">进入投诉总览 →</button></div><div className="grid grid-cols-[1.08fr_.92fr]"><div className="grid grid-cols-2 gap-3 border-r border-slate-100 p-5">{Object.entries(attitudeData).map(([key,item])=><button key={key} onClick={()=>setActiveMetric(key)} className={`rounded-lg border p-4 text-left transition ${activeMetric===key?'border-violet-300 bg-violet-50/60 ring-1 ring-violet-100':'border-slate-200 hover:border-violet-200'}`}><div className="flex items-start justify-between"><span className="grid h-8 w-8 place-items-center rounded-md bg-slate-50 text-slate-500"><Icon name={item.icon} size={16}/></span><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass(item.tone)}`}>{item.status}</span></div><div className="mt-3 text-xs text-slate-500">{item.label}</div><div className="mt-1 flex items-end gap-1"><b className="text-2xl font-semibold text-slate-900">{item.value}</b><span className="mb-0.5 text-xs text-slate-400">{item.unit}</span></div><div className={`mt-1 text-[11px] ${item.change.startsWith('+')?'text-rose-500':'text-emerald-600'}`}><ComparisonValue label="环比" value={item.change}/></div></button>)}</div><div className="p-5"><div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-slate-700">{active.label}趋势</div><div className="mt-1 text-[11px] text-slate-400">近7个统计周期</div></div><span className={`rounded-full px-2.5 py-1 text-xs ${toneClass(active.tone)}`}>{active.status}</span></div><svg viewBox="0 0 500 155" className="mt-3 h-[150px] w-full" role="img" aria-label={`${active.label}近7期趋势`}><line x1="30" x2="485" y1="126" y2="126" stroke="#E2E8F0"/>{[0,1,2].map(i=><line key={i} x1="30" x2="485" y1={34+i*31} y2={34+i*31} stroke="#E2E8F0" strokeDasharray="4 5"/>)}<polyline points={values.map((v,i)=>`${px(i)},${py(v)}`).join(' ')} fill="none" stroke={active.tone==='rose'?'#F43F5E':active.tone==='amber'?'#F59E0B':'#2272DE'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{values.map((v,i)=><g key={i}><circle cx={px(i)} cy={py(v)} r="4" fill="white" stroke={active.tone==='rose'?'#F43F5E':active.tone==='amber'?'#F59E0B':'#2272DE'} strokeWidth="2"/><text x={px(i)} y="146" textAnchor="middle" fontSize="9" fill="#94A3B8">第{i+1}期</text></g>)}</svg><div className={`rounded-md px-3 py-2 text-xs leading-5 ${toneClass(active.tone)}`}>{active.summary}</div></div></div></section>

        <section className="mt-4 grid grid-cols-[1.1fr_.9fr] gap-4"><article className="rounded-lg border border-slate-200 bg-white shadow-card"><div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><h2 className="text-base font-semibold text-slate-800">风险提醒</h2><CompactInfoPopover info={homeExplain.risk} ariaLabel="查看风险提醒说明"/></div></div><div className="p-4">{risks.map(risk=><button key={risk.key} onClick={()=>setSelectedRisk(risk)} className={`mb-2 grid w-full grid-cols-[42px_1fr_28px] items-center gap-3 rounded-lg border px-3 py-3 text-left last:mb-0 ${selectedRisk.key===risk.key?'border-violet-300 bg-violet-50/50':'border-slate-100 hover:bg-slate-50'}`}><span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${toneClass(risk.tone)}`}>{risk.level}</span><span><b className="block text-sm text-slate-700">{risk.title}</b><small className="mt-1 block text-[11px] text-slate-400">{risk.subject}</small></span><Icon name="chevron" size={15} className="text-slate-300"/></button>)}</div></article><article className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass(selectedRisk.tone)}`}>{selectedRisk.level}风险</span><span className="text-xs text-slate-400">当前选中</span></div><h3 className="mt-3 text-base font-semibold text-slate-800">{selectedRisk.title}</h3><div className="mt-4 rounded-md bg-slate-50 p-3"><div className="text-[11px] text-slate-400">重点对象</div><div className="mt-1 text-sm font-medium text-slate-700">{selectedRisk.subject}</div></div><p className="mt-4 text-xs leading-6 text-slate-500">{selectedRisk.detail}</p><button onClick={()=>onNavigate(selectedRisk.route)} className="mt-5 w-full rounded-md bg-violet-600 py-2.5 text-xs font-medium text-white">{selectedRisk.action} →</button></article></section>

      </div>;
    }

    // 渠道分析：严格区分投诉进入系统的“受理渠道”和问题实际发生的“业务办理渠道”。
    function ChannelAnalysisPage({onOpenTicket}) {
      const [selectedOrg,setSelectedOrg]=useState('全行');
      const [startDate,setStartDate]=useState('2026-07-01');
      const [endDate,setEndDate]=useState('2026-07-15');
      const [linkedFilter,setLinkedFilter]=useState({...DEFAULT_LINKED_FILTER,compare:'环比'});
      const [mode,setMode]=useState('business');
      const [businessLabelLevel,setBusinessLabelLevel]=useState('primary');
      const [selectedChannel,setSelectedChannel]=useState('大堂渠道');
      const filterFactor=linkedAnalysisFactor(linkedFilter,startDate,endDate,selectedOrg);
      const filterSummary='';
      const compare=linkedFilter.compare||'环比';
      const compareBasis=compare==='环比'?'上月':'上年同期';
      const intakeChannelsRaw=[
        {name:'金融消费者保护服务平台',value:4862,share:'38.9%',mom:'+12.6%',yoy:'+18.4%',risk:'重点关注'},
        {name:'客服电话',value:2628,share:'21.0%',mom:'+4.8%',yoy:'+9.6%',risk:'正常'},
        {name:'营业网点',value:1486,share:'11.9%',mom:'+8.2%',yoy:'+6.4%',risk:'重点关注'},
        {name:'厦门金管局',value:786,share:'6.3%',mom:'+15.4%',yoy:'+11.8%',risk:'监管关注'},
        {name:'在线客服',value:742,share:'5.9%',mom:'-3.1%',yoy:'+4.5%',risk:'正常'},
        {name:'市长热线',value:568,share:'4.5%',mom:'+9.6%',yoy:'+13.2%',risk:'重点关注'},
        {name:'属地金管局',value:500,share:'4.0%',mom:'+6.7%',yoy:'+7.8%',risk:'监管关注'},
        {name:'总行投诉邮箱',value:426,share:'3.4%',mom:'-1.8%',yoy:'+2.6%',risk:'正常'},
        {name:'机构专线电话',value:286,share:'2.3%',mom:'+2.7%',yoy:'+5.1%',risk:'正常'},
        {name:'客户意见薄',value:88,share:'0.7%',mom:'+1.6%',yoy:'-1.2%',risk:'正常'},
        {name:'信函',value:64,share:'0.5%',mom:'-5.2%',yoy:'-8.6%',risk:'正常'},
        {name:'其它',value:50,share:'0.4%',mom:'-2.4%',yoy:'-3.1%',risk:'正常'}
      ];
      const businessPrimaryChannelsRaw=[
        {name:'大堂渠道',value:4197,share:'33.6%',mom:'+18.6%',yoy:'+26.4%',risk:'重点关注'},
        {name:'线上自有渠道',value:2491,share:'19.9%',mom:'+7.2%',yoy:'+12.8%',risk:'重点关注'},
        {name:'第三方合作渠道',value:2121,share:'17.0%',mom:'+2.8%',yoy:'+6.5%',risk:'正常'},
        {name:'其他',value:1248,share:'10.0%',mom:'-3.4%',yoy:'+2.6%',risk:'正常'},
        {name:'内部管理渠道',value:957,share:'7.7%',mom:'+5.6%',yoy:'+9.4%',risk:'正常'}
      ];
      const businessSecondaryChannelsRaw=[
        {name:'柜面业务',value:1686,share:'13.5%',mom:'+16.8%',yoy:'+22.6%',risk:'重点关注'},
        {name:'手机银行',value:1542,share:'12.3%',mom:'+13.2%',yoy:'+19.4%',risk:'重点关注'},
        {name:'微信/公众平台',value:1286,share:'10.3%',mom:'+11.6%',yoy:'+17.8%',risk:'重点关注'},
        {name:'网上银行',value:1128,share:'9.0%',mom:'+8.4%',yoy:'+12.6%',risk:'正常'},
        {name:'厅堂服务',value:986,share:'7.9%',mom:'+6.8%',yoy:'+10.2%',risk:'正常'},
        {name:'客服电话',value:862,share:'6.9%',mom:'+4.6%',yoy:'+8.5%',risk:'正常'},
        {name:'在线客服',value:748,share:'6.0%',mom:'+3.2%',yoy:'+7.4%',risk:'正常'},
        {name:'短信渠道',value:636,share:'5.1%',mom:'-1.8%',yoy:'+3.2%',risk:'正常'},
        {name:'厅堂自助',value:548,share:'4.4%',mom:'+2.4%',yoy:'+5.6%',risk:'正常'},
        {name:'维信金科',value:462,share:'3.7%',mom:'+9.8%',yoy:'+14.2%',risk:'重点关注'}
      ];
      // 数量与比较结果使用同一筛选系数，确保机构、条线、渠道、口径、日期和剔除规则同步生效。
      const scaleChannels=rows=>rows.map((item,index)=>{
        const baseChange=parseFloat(compare==='环比'?item.mom:item.yoy);
        const filterAdjustment=(filterFactor-1)*(1.2+(index%4)*.35);
        const adjustedChange=baseChange+filterAdjustment;
        return{...item,value:scaleLinkedCount(item.value,filterFactor),change:`${adjustedChange>=0?'+':''}${adjustedChange.toFixed(1)}%`};
      });
      const intakeChannels=scaleChannels(intakeChannelsRaw.filter(item=>linkedFilter.channel==='全部渠道'||(linkedFilter.channel==='监管转送'?item.name.includes('金管局'):!item.name.includes('金管局'))));
      const businessPrimaryChannels=scaleChannels(businessPrimaryChannelsRaw);
      const businessSecondaryChannels=scaleChannels(businessSecondaryChannelsRaw).sort((a,b)=>b.value-a.value).slice(0,10);
      const businessChannels=businessLabelLevel==='primary'?businessPrimaryChannels:businessSecondaryChannels;
      const data=mode==='intake'?intakeChannels:businessChannels;
      const selected=data.find(item=>item.name===selectedChannel)||data[0];
      const switchMode=next=>{setMode(next);setSelectedChannel(next==='intake'?'金融消费者保护服务平台':(businessLabelLevel==='primary'?'大堂渠道':businessSecondaryChannels[0].name))};
      const switchBusinessLabelLevel=next=>{setBusinessLabelLevel(next);setSelectedChannel(next==='primary'?'大堂渠道':businessSecondaryChannels[0].name)};
      const maxChannel=Math.max(...data.map(item=>item.value),1);
      const metricCards=[
        {label:'有效投诉量',value:scaleLinkedCount(12486,filterFactor).toLocaleString(),unit:'件',change:compare==='环比'?'+6.8%':'+18.2%',icon:'file'},
        {label:`投诉最多的${mode==='intake'?'受理':'业务'}渠道`,value:data[0].name,unit:'',change:data[0].change,detail:`${data[0].value.toLocaleString()}件 · 占比${data[0].share}`,icon:'branch'},
        {label:'监管来源投诉占比',value:'10.3',unit:'%',change:compare==='环比'?'+1.2%':'+2.6%',icon:'shield'}
      ];
      const channelProfileKey=`${mode}:${businessLabelLevel}:${selected.name}`;
      const relatedTopFive=(labels,base,salt)=>{
        const available=labels.filter(Boolean);
        if(!available.length)return[];
        const seed=organizationSeed(channelProfileKey,salt),offset=seed%available.length;
        return Array.from({length:Math.min(5,available.length)},(_,index)=>{
          const label=available[(offset+index)%available.length];
          const channelFactor=.88+(seed%19)/100;
          const value=Math.round(base*channelFactor*(1-index*.14));
          return[label,scaleLinkedCount(value,filterFactor)];
        });
      };
      const productPool=['贷款','存款','财富管理','支付结算','电子银行'];
      const reasonPool=['贷款催收','服务质量与态度','业务办理效率','收费争议','信息披露','系统功能异常','营销活动','账户管理','个人信息保护'];
      const customerPool=RISK_CUSTOMER_TYPES;
      const institutionSource=[['总行',718],['北京分行',526],['上海分行',742],['厦门分行',836],['福州分行',584],['珠海分行',628],['宁德分行',468],['龙岩分行',436],['泉州分行',552],['漳州分行',498],['莆田分行',416],['三明分行',382],['南平分行',354]];
      const activeOrgSelection=linkedFilter.orgSelection||allOrganizationSelection();
      const institutionRows=selectedOrganizationRows(activeOrgSelection,institutionSource).map((row,index)=>{
        const channelWeight=.58+(organizationSeed(`${channelProfileKey}:${row[0]}`,index)%71)/100;
        return[row[0],Math.max(1,Math.round(Number(row[1])*channelWeight))];
      }).sort((left,right)=>right[1]-left[1]).slice(0,5).map(row=>[row[0],scaleLinkedCount(row[1],filterFactor)]);
      const scopedLines=linkedFilter.lineSelection||BUSINESS_LINE_OPTIONS;
      const linked={products:relatedTopFive(productPool,2468,11),reasons:relatedTopFive(reasonPool,1686,23),institutions:institutionRows,lines:relatedTopFive(scopedLines,2368,37),customers:relatedTopFive(customerPool,10842,53)};
      Object.values(linked).forEach(rows=>rows.forEach(row=>{row[1]=`${Number(row[1]).toLocaleString()}件`;}));
      const primaryBusinessChannel=name=>{
        if(businessPrimaryChannelsRaw.some(item=>item.name===name))return name;
        if(['柜面业务','厅堂自助','厅堂服务'].includes(name))return'大堂渠道';
        if(['短信渠道','微信/公众平台','网上银行','手机银行','客服电话','在线客服'].includes(name))return'线上自有渠道';
        if(['维信金科','新网银行','美团','字节跳动','京东','拍拍贷','网商银行','度小满','其他合作平台','乐信','360借条','马上消费','小米'].includes(name))return'第三方合作渠道';
        if(name==='中、后台业务渠道投诉')return'内部管理渠道';
        return'其他';
      };
      const details=[
        {id:'TS202607180126',date:'2026-07-18 09:26',institution:'厦门分行',product:'合作类贷款',reason:'贷款催收',intake:'金融消费者保护服务平台',business:'第三方合作渠道',line:'零售金融部',customerType:'重要客户',status:'处理中'},
        {id:'TS202607170862',date:'2026-07-17 16:18',institution:'珠海分行',product:'合作类贷款',reason:'贷款业务办理',intake:'厦门金管局',business:'第三方合作渠道',line:'普惠金融部',customerType:'新市民',status:'已办结'},
        {id:'TS202607170736',date:'2026-07-17 14:05',institution:'上海分行',product:'账户及支付',reason:'服务质量与态度',intake:'营业网点',business:'大堂渠道',line:'运营管理部',customerType:'高龄老人',status:'处理中'}
      ];
      const displayDetails=details.filter(row=>linkedFilter.channel==='全部渠道'||(linkedFilter.channel==='监管转送'?row.intake.includes('金管局'):!row.intake.includes('金管局'))).slice(0,Math.ceil(details.length*Math.min(1,filterFactor))).map(row=>({...row,intake:mode==='intake'?selected.name:row.intake,business:mode==='business'?primaryBusinessChannel(selected.name):row.business}));
      const channelDetailSelection=useSelectableRows(displayDetails,row=>row.id);
      const exportChannelDetails=()=>downloadCsv(`渠道分析关联投诉明细_${startDate}_${endDate}.csv`,['工单编号','客户投诉时间','投诉机构','产品类型','投诉原因','受理渠道','业务办理渠道','业务条线','客户类型','工单状态'],channelDetailSelection.selectedRows.map(row=>[row.id,row.date,row.institution,row.product,row.reason,row.intake,row.business,row.line,row.customerType,row.status]));
      const resetChannelDetail=()=>setSelectedChannel(mode==='intake'?(intakeChannels[0]?.name||'金融消费者保护服务平台'):(businessChannels[0]?.name||'大堂渠道'));
      const pageInfo={title:'渠道分析',question:'投诉通过哪些渠道进入？客户问题实际发生在哪些业务办理渠道？',caliber:'受理渠道按工单“受理渠道”汇总；业务办理渠道支持一级标签与二级标签 Top10 切换，明细统一展示一级标签。',value:'区分投诉来源压力与服务渠道问题，识别需要优化的受理入口、业务渠道及合作平台。',source:'工单编号、客户投诉时间、受理渠道、业务办理渠道一级标签、业务办理渠道二级标签、产品类型、投诉原因、投诉机构。'};
      return <div className="mx-auto max-w-[1540px] px-6 py-5">
        <nav className="mb-4 flex gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">渠道分析</span></nav>
        <section className="mb-4 flex items-end justify-between"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-900">渠道分析</h1><CompactInfoPopover info={pageInfo} ariaLabel="查看渠道分析说明"/></div></div><div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500"/>数据更新时间：2026-07-20 08:00</div></section>
        <ComplaintAnalysisFilters pageKey="channel" initialCompare="环比" autoCollapseOnScroll startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onOrgChange={org=>setSelectedOrg(org.startsWith('全行')?'全行':org)} auxiliaryControls={<div className="flex rounded bg-slate-100 p-0.5"><button type="button" onClick={()=>switchMode('intake')} className={`rounded px-2.5 py-1 text-[11px] ${mode==='intake'?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>投诉受理渠道</button><button type="button" onClick={()=>switchMode('business')} className={`rounded px-2.5 py-1 text-[11px] ${mode==='business'?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>业务办理渠道</button></div>} onFilterChange={changes=>setLinkedFilter(prev=>({...prev,...changes}))} onQuery={({org,orgSelection,lineSelection,channel,caliber,compare,organizationDimension,organizationField,excluded})=>{setSelectedOrg(org.startsWith('全行')?'全行':org);setLinkedFilter({channel,caliber,compare,organizationDimension,organizationField,excluded,orgSelection,lineSelection})}}/>
        <section className="mb-4 grid grid-cols-3 gap-3">{metricCards.map((item,index)=><AnalysisMetricCard key={item.label} label={item.label} value={item.value} unit={item.unit} detail={item.detail||''} compareLabel={compare} compareValue={item.change} icon={item.icon} info={{...pageInfo,title:item.label}} highlight={index===1} compactValue={index===1}/>)}</section>
        <section data-testid="channel-distribution-card" className="rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">{mode==='intake'?'受理渠道分布':'业务办理渠道分布'}</h2></div><div className="flex items-center gap-3">{mode==='business'&&<div data-testid="business-channel-label-level" className="flex rounded-md bg-slate-100 p-1">{[{key:'primary',label:'一级标签'},{key:'secondary',label:'二级标签'}].map(option=><button type="button" key={option.key} onClick={()=>switchBusinessLabelLevel(option.key)} className={`rounded px-3 py-1 text-xs ${businessLabelLevel===option.key?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>{option.label}</button>)}</div>}<span className="text-xs text-slate-400">{data.length}个{mode==='business'?(businessLabelLevel==='primary'?'一级':'二级'):''}渠道 · {compare}</span></div></div><div data-testid="channel-distribution-chart" className={`flex h-[360px] items-end pb-8 pt-6 ${data.length>7?'gap-3 px-5':'gap-8 px-12'}`}>{data.map(item=><button type="button" data-channel-name={item.name} key={item.name} onClick={()=>setSelectedChannel(item.name)} className="group flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><span data-channel-value className="text-[11px] font-medium text-slate-700">{item.value.toLocaleString()}</span><span data-channel-distribution-bar data-selected={selected.name===item.name?'true':'false'} className={`channel-distribution-bar w-full max-w-[92px] rounded-t-sm ${selected.name===item.name?'is-selected':''}`} style={{height:`${Math.max(26,item.value/maxChannel*230)}px`}}/><span className="h-9 max-w-[110px] text-[10px] leading-4 text-slate-500">{item.name}</span><span data-channel-change className={item.change.startsWith('+')?'text-[10px] text-rose-500':'text-[10px] text-emerald-600'}><span className="text-slate-400">{compare}</span> <b className={item.change.startsWith('+')?'text-rose-500':'text-emerald-600'}>{normalizedComparison(item.change)}</b></span></button>)}</div></section>
        <section data-testid="channel-related-problems" className="mt-4 rounded-lg border border-slate-200 bg-white shadow-card"><div className="border-b border-slate-100 px-5 py-4"><h2 data-testid="channel-related-title" className="text-sm font-semibold text-slate-800">{selected.name}关联问题</h2></div><div className="grid grid-cols-5 divide-x divide-slate-100">{[['关联产品',linked.products],['投诉原因',linked.reasons],['责任机构',linked.institutions],['业务条线',linked.lines],['客户类型',linked.customers]].map(([title,items])=><article key={title} data-related-angle={title} className="min-w-0 p-4"><h3 className="text-xs font-semibold text-slate-700">{title} Top5</h3><div className="mt-3 space-y-2">{items.length?items.map((item,index)=><div key={item[0]} data-related-rank className="flex items-center gap-2 text-[11px]"><span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-violet-50 text-[10px] text-violet-600">{index+1}</span><span data-related-name className="min-w-0 flex-1 truncate text-slate-600">{item[0]}</span><b data-related-value className="shrink-0 text-slate-700">{item[1]}</b></div>):<div className="py-6 text-center text-[11px] text-slate-400">暂无数据</div>}</div></article>)}</div></section>
        <section data-testid="channel-related-details" className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">关联投诉明细</h3><p className="mt-0.5 text-[11px] text-slate-400"><span className="mt-0.5 block">明细仅随当前{mode==='intake'?'受理渠道':'业务办理渠道'}联动；当前示例匹配 {displayDetails.length} 笔</span></p></div><div className="flex items-center gap-2"><button type="button" data-testid="channel-detail-reset" onClick={resetChannelDetail} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50">重置交叉筛选</button><button type="button" data-testid="channel-detail-export" disabled={!channelDetailSelection.selectedRows.length} onClick={exportChannelDetails} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40">导出明细</button><CompactInfoPopover info={{title:'关联投诉明细',question:'哪些单笔投诉构成当前渠道分析结果？',caliber:'继承查询条件，并仅随当前选中的受理渠道或业务办理渠道联动，按工单编号去重展示。',value:'核验渠道分析结论并追溯具体工单。',source:'工单编号、客户投诉时间、投诉机构、产品类型、投诉原因、受理渠道、业务办理渠道、业务条线、客户类型、工单状态。'}} ariaLabel="查看关联投诉明细指标说明"/></div></div><div data-testid="channel-detail-filters" className="m-5 mb-4 flex flex-wrap gap-2 rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-xs"><span className="rounded-full bg-violet-600 px-3 py-1 text-white">{mode==='intake'?'受理渠道':'业务办理渠道'}：{selected.name}</span></div><div className="mx-5 mb-5 overflow-x-auto rounded-md border border-slate-200"><div data-testid="channel-detail-header" className="grid min-w-[1580px] bg-slate-50 px-4 py-2.5 text-[11px] text-slate-400" style={{gridTemplateColumns:'230px repeat(9,minmax(140px,1fr))'}}><SelectableHeader label="工单编号" selection={channelDetailSelection} testId="channel-detail-select-all"/>{['客户投诉时间','责任机构','产品标签','投诉原因标签','受理渠道','业务办理渠道','所属业务条线','客户类型','工单状态'].map(item=><span key={item} className="whitespace-nowrap">{item}</span>)}</div>{displayDetails.map(row=><div data-testid="channel-detail-row" key={row.id} className="grid min-w-[1580px] border-t border-slate-100 px-4 py-3 text-left text-xs text-slate-600 hover:bg-violet-50" style={{gridTemplateColumns:'230px repeat(9,minmax(140px,1fr))'}}><SelectableIdCell id={row.id} selection={channelDetailSelection} testId="channel-detail-select" onOpen={onOpenTicket}/><span>{row.date}</span><span>{row.institution}</span><span>{row.product}</span><span>{row.reason}</span><span>{row.intake}</span><span data-business-channel={row.business}>{row.business}</span><span>{row.line}</span><span>{row.customerType}</span><span><span className="rounded bg-slate-100 px-2 py-1">{row.status}</span></span></div>)}{displayDetails.length===0&&<div className="px-5 py-10 text-center text-sm text-slate-400">当前渠道条件下暂无匹配投诉，请调整筛选条件</div>}</div></section>
      </div>;
    }
    const FUJIAN_SVG_REGIONS = [{"city":"福州市","branch":"福州分行","x":224.75,"y":155.32,"d":"M261.2,125.76L260.85,125.17L260.14,124.59L258.99,123.97L257.78,124.05L257.8,124.49L256.87,125.01L255.08,124.44L254.02,125.04L253.61,126.31L253.02,126.42L252.65,126.99L251.35,126.87L250.41,127.29L249.67,126.92L249.35,126.4L248.77,126.13L248.15,126.33L246.94,125.79L246.46,125.88L246.38,125.29L245.07,124.92L244.45,124.18L244.83,123.9L243.36,122.19L242.99,121.36L241.37,120.76L240.93,121L239.86,120.8L238.37,121.15L237.39,120.58L236.98,120.95L237.77,121.22L237.27,121.58L236.15,121.26L235.69,121.34L235.64,121.93L235.15,122.53L234.49,122.68L233.93,122.44L233.49,122.74L233.74,123.2L232.96,123.49L232.76,123.86L231.71,124.07L232.03,123.49L231.78,123.13L230.74,123.12L229.9,124.37L229.53,126.46L227.98,125.66L227.56,126.59L226.49,127.12L225.66,126.36L225.64,125.82L224.99,124.78L224.48,124.46L223.64,125.32L222.73,125.61L222.25,126.09L221.58,125.95L221.15,126.29L220.77,126.03L219.61,126.24L219.4,125.53L218.74,125.03L218.66,124.1L218.06,124.63L216.95,124.56L216.4,124.34L216.54,123.84L217.24,123.43L217.06,123.05L216.07,122.4L215.68,122.78L214.29,122.71L214.16,123.34L213.52,123.22L213.41,124.19L212.93,125.24L212.19,125.36L212.66,125.85L212.26,126.83L211.58,126.55L210.63,126.62L209.75,127.02L209.42,127.92L208.95,128.35L208.9,128.93L209.58,129.03L209.78,129.55L209.54,130.35L208.81,130.57L208.08,129.87L206.88,129.84L204.78,130.52L204.57,131.13L204.06,131.3L203.73,132.12L202.08,132.9L201.03,132.54L201.08,131.62L200.25,130.89L200.69,130.42L200.72,129.57L200.21,129.13L199.42,128.94L199.36,128.2L198.11,127.85L197.25,127.9L197.17,128.4L197.66,129.42L196.49,130.28L196.48,131.61L196.22,132.19L198.11,133.22L197.56,134.55L198.35,134.9L199.18,136.04L200.34,136.8L200.04,137.99L198.79,138.69L197.57,138.36L197.48,138.1L195.57,137.99L195.02,138.8L193.82,139.73L193.76,140.51L194.11,140.89L193.19,140.87L193.31,141.16L192.28,141.85L192.68,143.24L192.42,143.74L192.09,144.66L191.34,144.84L190.15,144.25L188.95,144.2L188.16,144.7L188.99,145.7L188.83,146.02L188.24,145.71L187.47,145.75L186.93,146.07L186.68,147.17L187.01,147.74L186.29,147.71L186.08,148.17L186.1,149.97L186.6,150.52L187.44,150.31L187.13,151.39L187.25,152.32L187.56,152.58L187.77,153.62L188.35,153.62L187.85,154.5L188.3,154.88L187.75,155.06L186.88,154.47L185.37,154.72L183.16,154.64L183.52,155.66L183.13,156.66L183.32,158.96L183,159.54L183.37,159.97L183.11,160.42L183.41,160.7L183.04,162.09L183.35,162.62L182.63,163.99L183.27,164.81L182.92,164.94L182.6,164.31L181.26,164.07L180.96,163.86L180.4,164.16L180.75,165.14L180.73,165.78L179.72,166.1L179.94,164.33L178.28,162.98L178.06,163.03L177.14,164.13L177.2,164.53L176.68,164.7L176.46,165.35L176.83,165.52L177.37,166.77L176.39,167.44L175.91,167.28L175.64,168.5L174.99,169.16L175.59,169.41L175.96,169.94L176.97,170.61L177.17,171.83L177.6,172.29L177.96,174.11L179.03,174.85L179.39,174.7L180.25,175.29L180.94,175.5L181.7,176.59L182.78,177.41L183.6,178.35L184.6,178.2L184.8,177.61L186.2,177.04L186.53,177.46L186.89,177.27L186.8,176.69L187.26,177.24L187.49,176.52L188.15,176.91L188.54,176.8L188.55,176.1L188.97,175.98L188.86,175.42L189.79,176.08L190.18,176.04L190.36,175.42L191.5,175.23L192.39,175.42L192.89,175.84L192.77,176.22L193.78,176.22L193.81,176.53L194.76,176.94L195.92,176.23L196,176.68L195.74,177.71L196.14,177.81L196.62,177.22L197.04,177.16L197.58,176.15L197.99,176.57L198.72,176.73L200.34,175.93L200.79,175.36L200.47,175.23L201.12,174.69L202.01,174.75L202.77,175.4L203.66,175.7L205.13,175.4L204.93,176.02L205.43,175.78L206.79,174.6L207.72,174.36L207.76,174.02L208.58,173.12L209.06,173.05L209.68,172.37L209.58,172.84L209.83,173.99L209.61,175.17L211.07,174.02L213.46,173.82L214.13,173.4L215.07,173.45L215.53,173.13L216.88,172.8L217.22,173.05L217.93,172.67L218.07,172.98L218.99,172.7L220.64,172.8L221.82,173.27L221.48,174.05L220.12,175.11L221.32,175.34L221.78,175.91L221.17,176.09L221.33,176.82L221.97,177.37L221.41,177.33L221.33,177.79L220.67,179.1L220.71,179.87L221.77,180.74L222,181.67L222.43,181.8L222.39,182.36L222.84,182.25L222.94,182.92L222.51,182.6L222.11,182.78L222.69,183.37L222.82,183.84L223.55,184.51L224.83,184.72L224.96,185.11L226.41,183.94L226.85,185.24L227.42,186.12L227.33,186.96L226.59,187.54L226.17,188.38L225.29,188.21L225.49,189.43L225.92,189.63L228.13,188.43L228.13,189L229.14,189.08L228.46,190.65L228.56,192.04L230.07,193.04L234.06,192.99L234.12,191.1L233.45,189.4L233.85,187.45L234.27,186.54L236.72,187.4L236.95,188.15L238.38,188.48L239.04,187.8L240.1,188.14L239.48,189.4L239.39,190.17L239.76,190.68L238.72,191.58L239.21,192.07L239.23,192.94L239.57,193L239.79,192.18L240.32,191.62L240.68,190.85L242.36,190.92L242.1,192.36L243.4,193.91L243.29,194.33L242.42,195.05L242.09,195.63L242.76,196.13L243.01,195.68L244.17,195.06L245.02,195.32L244.89,196.02L245.91,195.7L246.13,194.85L246.9,194.57L247.11,194.06L247.76,193.65L247.37,192.84L246.33,191.97L246.6,190.98L247.4,190.71L248.07,192.15L247.89,192.89L248.46,193.8L247.99,194.88L248.08,195.46L248.82,196.48L248.36,196.9L248.88,197.56L249.77,197.19L251.23,197.33L252.03,197.07L252.6,196.42L252.51,195.87L251.66,196.3L250.9,196.14L251.77,195.89L252.34,195.47L252.7,195.7L253.01,195.35L252.47,193.87L252.57,193.23L253.2,193.22L253.44,192.57L253.3,191.59L252.49,191.41L252.51,192.01L251.85,191.67L251.48,191.96L250.43,191.68L251.54,191.06L252.01,190.04L253.6,189.66L253.93,190.1L254.36,190.07L253.97,190.71L254.24,191.32L255.31,191.29L255.3,191.71L256.25,192.52L257.47,192.72L258.57,193.91L259.53,193.98L260.2,193.01L258.91,192.65L259.03,191.72L259.69,191.48L261.43,190.28L262.04,190.25L262.81,189.83L263.63,189.98L263.95,190.57L264.55,190.68L265.25,190.44L264.82,190.02L265.08,188.97L264.33,189.11L263.82,188.74L263.21,188.85L263.02,188.35L262.18,188.14L261.87,187.35L262.09,186.03L262.49,185.7L263.88,185.16L264.49,185.79L265.51,185.65L266.51,184.66L266.69,183.88L266.35,183.64L265.57,183.99L263.97,183.64L263.11,183.03L263.73,182.32L263.67,181.77L261.74,180.75L260.47,180.94L260.01,180.44L259.94,179.64L260.71,178.66L260.68,177.97L260.26,177.85L258.13,179.11L256.82,179.57L256.3,180.52L255.88,180.44L255.14,180.88L254.68,181.73L254.13,182.09L254.65,183.18L255.62,183.56L256.2,184.96L255.93,185.63L255.99,186.52L256.58,186.73L256.26,187.08L255.53,186.95L254.91,187.13L254.62,187.67L253.66,188.28L253.84,188.73L253.6,189.25L252.33,189.53L252.24,188.62L251.72,188.62L251.13,189.24L250.53,189.32L250.7,188.43L249.89,187.48L249.81,186.45L250.24,185.56L250.04,184.41L249.06,183.21L249.22,182.68L248.84,182.24L248.23,182.31L247.26,182.9L245.07,182.71L245.01,182.2L245.54,181.7L245.41,180.14L244.94,180.03L244.52,180.41L243.62,180.2L243.19,180.4L242.56,179.93L241.64,179.98L241.32,178.16L242.31,177.82L242.37,177.49L244.58,176.93L245.62,176.85L248.03,177.16L249.22,176.79L249.77,175.71L249.22,175.05L249.78,174.32L250.65,174.54L251.33,172.99L251.27,172.32L250.72,171.88L250.6,169.72L250.77,165.73L251.16,164.84L251.66,164.54L254.44,164.19L254.83,163.82L255.27,162.21L256.04,160.33L256.46,158.73L256.56,157.47L256.05,156.65L255.13,156.23L253.65,156.63L253.12,156.44L252.63,153.87L252.35,152.82L251.75,152.79L251.59,151.7L251.04,151.31L250.18,151.06L249.71,149.52L249.26,149.08L249.36,148.1L250.65,147.52L251.69,146.56L252.96,146.19L253.18,145.1L253.89,144.58L253.9,144.03L253.39,143.51L253.24,142.93L253.68,142.57L256.58,142.19L259.46,141.26L260.05,141.4L261.06,142.27L262.09,141.55L262.32,140.75L261.43,140.45L261.61,139.93L263.94,139.04L264.91,139.45L265,139.93L265.87,139.79L267.19,139.88L267.88,139.77L268.11,139.17L269.37,138.32L270.59,137.26L271.07,136.03L269.76,136.07L268.08,136.78L266.9,137.08L265.86,136.85L266.12,136.07L264.94,134.99L264.92,134.54L263.37,132.23L263.49,131.5L262.33,128.27L261.2,125.76ZM303.49,136.12L302.95,136.3L302.84,135.6L302.43,135.58L302.11,136.38L302.58,136.07L302.97,136.51L302.85,137.1L303.63,137.28L304.17,136.56L304.61,136.81L304.44,136.2L303.82,135.84L303.49,136.12ZM267.27,182.9L267.73,182.47L267.68,181.79L267.13,181.43L267.05,181.78L266.22,181.93L265.82,181.48L265.86,182.61L266.31,182.56L267.27,182.9ZM247.82,180.24L248.29,179.68L249.11,179.42L249.65,178.66L249.84,177.79L248.94,178.17L247.88,178.89L247.37,179.84L247.09,179.11L246.65,179.77L247.82,180.24ZM273.74,145.41L274.35,145.8L274.58,144.79L273.41,144.17L272.63,144.86L271.58,145.29L271.51,146.83L272.04,146.69L272.18,145.81L273.74,145.41ZM271.38,161.39L272.1,161.01L272.93,160.25L271.93,160.24L271.44,160.78L271.38,161.39ZM255.43,196.49L256.74,196.27L257.3,195.91L256.78,195.56L256.61,194.96L256.13,195.37L254.99,195.64L255.43,196.49ZM254.78,199.39L254.9,198.97L255.86,198.76L255.07,197.97L255.45,197.62L255.3,197.12L254.74,197.42L254.34,198.11L254.57,198.7L254.39,199.22L254.78,199.39ZM269.07,150.2L269.51,149.85L270.01,149.91L270.68,149.34L270.93,149.44L271.54,148.51L270.37,148.46L270.06,148.91L269.03,148.66L269.29,148.15L268.39,148.11L268.43,149.01L268.07,149.85L269.07,150.2ZM251.65,150.49L252.38,150.3L252.29,149.61L252.52,149.14L251.65,148.84L250.7,147.9L249.47,148.1L249.37,148.98L250.17,149.92L251.62,150.23L251.65,150.49ZM266.31,133.81L266.85,133.58L266.42,133.28L266.31,133.81ZM241.38,197.76L242.24,197.86L242.1,197.41L242.3,196.57L241.23,196.94L240.88,197.61L241.38,197.76ZM252.83,179.09L252.82,179.41L253.51,179.92L255,179.69L255.29,179.47L255.91,179.82L256.45,179.49L256.15,178.01L255.48,178.5L254.06,178.88L253.63,178.37L252.83,179.09ZM253.5,172.56L254.09,172.21L253.44,172.02L253.5,172.56ZM253.67,150.79L254.16,149.81L253.63,149.71L252.82,150.22L253.74,151.44L253.67,150.79ZM258.61,199.7L259.04,200.23L259.23,199.68L258.61,199.7ZM268.24,133.38L267.71,134.05L268.43,133.91L268.24,133.38ZM273.31,143.96L274.05,143.49L273.52,143.54L273.31,143.96ZM269.54,160.3L270.52,159.56L270.26,159.36L269.12,159.42L269.03,159.8L269.54,160.3ZM251.45,177.58L251.55,177.85L252.67,177.1L251.69,177.27L251.45,177.58ZM236.3,191.61L236.82,191.52L236.67,191.11L236.3,191.61ZM251.26,151.36L251.74,151.69L251.96,151.16L251.26,151.05L251.26,151.36ZM272.58,142.6L273.06,142.4L272.99,141.54L272.26,142.29L272.58,142.6ZM286.83,138.49L287.61,137.92L286.97,138.1L286.83,138.49ZM252.04,178L251.94,178.6L252.93,178.61L253.43,178.21L252.76,177.52L252.04,178ZM247.81,177.79L247.96,178.2L248.49,177.46L247.81,177.79Z"},{"city":"厦门市","branch":"厦门分行","x":159.29,"y":236.55,"d":"M154.74,251.84L154.93,250.25L155.68,249.13L156.91,245.23L157.74,244.15L158.2,243.93L159.14,242.86L160.91,242.05L161.61,242.73L162.06,243.49L164.22,245.03L166.53,246.26L169.39,245.66L172.85,245.19L173.86,245.21L174.59,244.84L174.47,244.18L174.71,243.35L173.86,242.96L174.49,242.52L173.38,242.51L173.23,241.96L172.54,241.53L172.51,240.65L171.92,241.18L171.8,240.76L172.25,240.05L172.7,239.84L172.86,239.27L172.63,238.58L173.09,238.17L173.17,237.27L172.35,236.71L172.36,236.22L171.37,235.6L171.34,235.26L172.22,234.06L171.97,233.41L171.35,233.19L171.03,232.26L172.14,232.05L172.25,230.95L172.72,230.91L172.31,230.39L172.12,230.74L171.37,230.19L171.55,229.34L170.73,228.94L170.08,227.68L169.05,227.31L167.8,227.73L167.09,227.37L166.55,227.75L165.85,227.69L165.39,226.96L165.49,226.22L163.74,225.3L163.75,224.49L164.17,224.37L163.61,223.74L162.52,223.71L161.58,223.45L160.92,223.8L160.15,223.62L159.39,223.99L158.66,224.8L158.43,224.78L156.96,225.46L156.49,226.02L156.17,225.56L156.13,224.82L155.76,224.76L155.36,225.3L154.32,224.31L154,223.33L152.72,223.2L152.31,223.73L151.58,223.32L151.17,223.73L152.04,224.03L152.64,224.51L152.47,224.78L151.58,224.66L151.24,225.27L151.7,225.68L150.01,226.38L149.19,225.19L148.56,225.02L147.9,225.3L147.52,224.76L146.76,224.52L146.47,225.07L147.18,225.42L148.14,226.59L149.11,226.56L149.51,226.79L149.28,227.81L149.41,229.93L149.03,231.27L148.59,231.46L148.17,232.64L148.62,234.46L149.05,234.65L149.66,236.87L149.19,237.16L149.01,238.16L147.52,239.14L146.94,240.23L145.22,240.39L145.28,241.21L144.83,241.66L146.51,242.94L146.19,243.72L146.48,244.24L146.41,245.02L147.58,245.42L147.96,246.21L149.24,246.93L149.47,248.16L149.13,249.42L149.58,250.31L150.24,250.86L150.85,250.94L151.3,251.56L152.1,251.82L153.49,251.71L154.74,251.84ZM164.19,246.72L164.02,245.49L163.42,244.82L162.11,244.28L161.22,244.17L160.43,243.35L158.55,243.73L157.86,244.15L157.18,245.07L156.36,247.32L155.96,248.91L156.04,249.65L157.17,251.07L158.22,251.48L159.94,251.76L160.47,251.69L161.28,250.89L163.85,248.88L164.33,248.1L164.19,246.72ZM174.79,243.71L175.09,243.94L175.77,243.78L175.19,243.44L174.79,243.71ZM156.1,250.84L156.48,250.63L156.32,250.15L155.52,249.77L155.2,250.25L155.56,250.72L156.1,250.84Z"},{"city":"莆田市","branch":"莆田分行","x":206.16,"y":191.01,"d":"M206.47,203.09L207.58,202.82L207.43,202.17L208.31,202.23L209.48,201.67L209.8,201.31L211.57,201.41L212.24,200.99L213.43,201.13L214,201.52L213.62,202.25L212.95,202.27L212.37,201.61L211.87,202.33L211.56,203.3L211.04,203.31L211.25,204.19L211.95,204.85L211.95,205.43L213.32,205.28L213.75,204.91L215.92,204.39L216.49,205.14L217.09,204.86L216.95,206.05L216.38,207.08L215.86,207.4L214.86,207.03L214.29,207.64L214.33,209.12L214.73,209.93L215.72,210.47L215.74,210.72L217.16,211.47L217.59,210.96L220.72,211.1L221.22,211.66L220.4,211.74L219.08,212.92L219.73,213.94L219.45,214.29L218.45,214.06L218.03,214.29L219.01,214.75L219.05,215.43L219.81,215.81L219.82,216.64L220.33,216.64L220.21,216.14L221.5,214.08L221.1,214.05L221.18,212.49L222.17,211.92L222.55,210.33L222.64,208.77L222.34,208.44L221.46,208.7L220.97,208.39L221.31,208.03L221.19,207.34L219.78,206.98L219.13,205.89L219.8,204.8L220.57,204.16L220.98,204.08L221.48,205.29L223.65,206.83L224.66,206.94L225.96,206.29L226.65,206.19L228.43,206.98L228.94,207.91L230.41,206.82L230.86,206.84L231.62,206.17L231.62,205.86L230.9,205.27L230.4,203.46L231.6,203.32L232.75,203.71L233.29,203.11L234.22,203.16L235.56,202.64L235.97,201.06L235.04,201.3L234.08,200.76L232.97,200.48L231.62,199.23L230.74,197.91L230.35,197.77L228.82,197.87L227.98,197.49L227.61,197.62L227.66,198.66L227.18,198.62L226.9,197.77L226.37,196.96L226.44,196.61L225.86,195.59L224.43,195.57L222.96,195.12L222.45,194.46L221.79,194.7L221.37,194.4L221.43,193.39L221.78,192.12L222.82,191.4L223.8,192.08L224.54,192.23L226.68,191.19L226.91,190.83L225.92,189.63L225.49,189.43L225.29,188.21L226.17,188.38L226.59,187.54L227.33,186.96L227.42,186.12L226.85,185.24L226.41,183.94L224.96,185.11L224.83,184.72L223.55,184.51L222.82,183.84L222.69,183.37L222.11,182.78L222.51,182.6L222.94,182.92L222.84,182.25L222.39,182.36L222.43,181.8L222,181.67L221.77,180.74L220.71,179.87L220.67,179.1L221.33,177.79L221.41,177.33L221.97,177.37L221.33,176.82L221.17,176.09L221.78,175.91L221.32,175.34L220.12,175.11L221.48,174.05L221.82,173.27L220.64,172.8L218.99,172.7L218.07,172.98L217.93,172.67L217.22,173.05L216.88,172.8L215.53,173.13L215.07,173.45L214.13,173.4L213.46,173.82L211.07,174.02L209.61,175.17L209.83,173.99L209.58,172.84L209.68,172.37L209.06,173.05L208.58,173.12L207.76,174.02L207.72,174.36L206.79,174.6L205.43,175.78L204.93,176.02L205.13,175.4L203.66,175.7L202.77,175.4L202.01,174.75L201.12,174.69L200.47,175.23L200.79,175.36L200.34,175.93L198.72,176.73L197.99,176.57L197.58,176.15L197.04,177.16L196.62,177.22L196.14,177.81L195.74,177.71L196,176.68L195.92,176.23L194.76,176.94L193.81,176.53L193.78,176.22L192.77,176.22L192.89,175.84L192.39,175.42L191.5,175.23L190.36,175.42L190.18,176.04L189.79,176.08L188.86,175.42L188.97,175.98L188.55,176.1L188.54,176.8L188.15,176.91L187.49,176.52L187.26,177.24L186.8,176.69L186.89,177.27L186.53,177.46L186.2,177.04L184.8,177.61L184.6,178.2L184.89,178.5L184.06,179.33L185.2,179.93L184.91,180.79L184.17,181.38L184.06,181.74L182.86,183.12L182.77,184.1L181.56,184.81L181.64,185L180.58,186.32L180.02,186.81L180.07,188.07L180.55,188.28L180.13,188.78L180.91,188.9L180.78,189.61L180.42,189.75L179.73,191.11L180.32,192.27L181.07,192.18L181.41,193.46L182,193.64L181.82,194.54L182.36,194.6L183.25,195.35L183.42,195.89L183.97,196.17L183.53,196.82L183.52,197.6L182.94,198.57L183.41,198.88L183.88,198.09L184.33,198.39L183.99,199.1L184.19,200.13L186.02,200.19L186.53,200.4L186.92,199.54L188.01,199.47L189.19,200.02L189.8,200L190.23,199.53L191.63,199.5L192.28,200.22L192.04,200.8L191.29,201.13L191.06,201.49L191.86,202.12L192.01,201.65L192.66,201.7L193.13,201.33L194.06,202.07L193.39,202.89L193.59,203.49L193.31,203.72L193.25,204.8L193.81,204.82L193.24,205.47L192.72,205.5L192.97,206.03L192.97,206.86L193.84,207.35L193.81,208.21L194.6,208.05L195.39,207.35L195.88,207.39L196.81,206.3L197.05,206.38L198.28,205.83L199.09,205.81L198.99,205.32L199.3,204.72L200.48,204.31L200.46,204.53L202.08,204.46L203.36,204.06L203.45,204.56L204.62,203.9L204.63,203.31L204.99,203.09L206.47,203.09ZM241.2,205.71L243.47,206.61L243.53,207.26L244.25,207.51L244.39,208.02L246.27,207.65L245.86,206.65L246.35,206.54L246.28,205.95L247.27,205.93L247.73,205.26L247.01,204.95L246.31,205.33L245.7,204.93L245.42,205.42L244.06,205.06L243.86,204.67L243.33,204.67L242.91,204.25L242.93,203.15L242.26,202.75L241.68,202.96L241.68,202.12L241.22,202.01L241,202.79L240.02,203.03L240.16,203.37L239.26,203.36L239.71,204.21L239.37,204.85L239.56,205.42L241.2,205.71ZM247.83,201.75L247.67,201.4L247.27,202.03L247.83,201.75ZM235.17,210.58L235.54,210.26L235.03,209.75L234.86,210.39L235.17,210.58ZM244,201.7L244.81,201.64L244.51,200.89L244.09,200.84L243.71,201.57L244,201.7ZM215.5,211.37L215.58,211.77L216.1,211.31L215.5,211.37ZM248.56,206.29L249.17,206.27L248.75,205.85L248.56,206.29ZM233.36,198.91L233.8,198.51L233.55,198.2L233.11,198.64L233.36,198.91ZM247.75,202.66L248.28,203.09L248.12,202.52L247.75,202.66ZM213.66,207.12L214.2,207.23L214.76,206.47L214.54,206.17L213.5,206.58L213.66,207.12ZM234.94,198.04L235.49,197.99L234.62,197.58L234.94,198.04ZM240.6,218.43L240.5,217.85L239.91,217.7L240.6,218.43Z"},{"city":"三明市","branch":"三明分行","x":115.28,"y":140.5,"d":"M134.62,187.06L135.57,186.93L135.45,187.21L136.13,187.46L136.72,187.31L137.32,187.91L137.75,187.8L138.78,188.84L139.48,189.07L138.94,188.16L138.94,187.17L139.87,187.24L140.83,186.76L141.37,187.22L142.06,188.25L142.83,188.46L143.5,188.02L144.62,187.84L145.25,187.92L147.62,187.12L148.23,186.34L149.48,186.06L150.6,186.8L150.56,185.93L151.41,185.55L151.89,184.82L153.59,183.7L153.89,183.08L153.81,182.55L154.16,182.31L154.39,181.56L154.37,180.67L154.07,180.17L153.31,180.15L152.94,180.58L151.98,180.85L151.35,180.64L151.19,181.04L150.89,180.31L150.34,180.1L149.8,179.22L149.11,179.44L148.92,178.54L148.24,178.8L147.95,178.39L148.7,177.8L148.52,177.43L149.31,177.57L149.87,177.05L151.77,176.76L152.12,176.41L152.68,174.8L152.34,174.49L151.94,175.03L151.13,174.07L150.32,172.34L150.74,172.4L151.01,171.71L151.68,171.97L152.14,171.8L152.43,170.26L152.21,170.17L152.46,169.19L153.37,168.14L153.59,168.62L153.78,167.92L152.91,167.33L152.7,166.62L153.67,166.21L154.12,166.67L154.77,166.54L155.64,167.14L156.94,166.14L156.44,165.44L156.51,165.01L157.64,164.88L158.11,164.56L159.65,164.08L160.76,164.06L161.27,163.61L162.55,164.07L162.72,165.02L163.74,164.96L164.47,164.18L164.86,164.2L165.92,165.04L166.77,164.62L166.85,164.3L168.04,164.15L168.34,163.85L167.95,163.1L168.51,162.31L169.11,162.25L169.75,162.74L170.53,162.33L171.09,163.27L172.22,163.08L172.72,161.98L173.06,161.89L173.65,162.33L173.72,163.01L174.05,163.23L174.23,164.29L175.84,164.08L176.68,164.7L177.2,164.53L177.14,164.13L178.06,163.03L178.28,162.98L179.94,164.33L179.72,166.1L180.73,165.78L180.75,165.14L180.4,164.16L180.96,163.86L181.26,164.07L182.6,164.31L182.92,164.94L183.27,164.81L182.63,163.99L183.35,162.62L183.04,162.09L183.41,160.7L183.11,160.42L183.37,159.97L183,159.54L183.32,158.96L183.13,156.66L183.52,155.66L183.16,154.64L185.37,154.72L186.88,154.47L187.75,155.06L188.3,154.88L187.85,154.5L188.35,153.62L187.77,153.62L187.56,152.58L187.25,152.32L187.13,151.39L187.44,150.31L186.6,150.52L186.1,149.97L186.08,148.17L186.29,147.71L187.01,147.74L186.68,147.17L186.93,146.07L187.47,145.75L188.24,145.71L188.83,146.02L188.99,145.7L188.16,144.7L188.95,144.2L190.15,144.25L191.34,144.84L192.09,144.66L192.42,143.74L191.64,142.6L190.79,142.52L190.3,142.04L190.09,141.05L189.17,141.08L188.72,140.14L188.2,140.12L187.68,139.41L187.77,138.97L185.92,138.88L186.04,138.24L185.56,137.91L184.73,137.87L184.48,138.19L183.76,138.25L183.27,137.31L182.23,136.54L181.85,136.58L180.22,137.68L179.38,138.09L179.17,137.46L178.32,137.08L177.78,136.26L177.72,135.65L178.32,134.9L179.05,135.49L179.39,135.26L179.35,134.27L178.72,134.76L177.29,134.58L176.63,134.81L175.68,134.81L174.35,133.9L173.8,134.43L173.03,134.16L172.73,133.51L172.55,133.91L171.69,134.02L171.4,133.3L171.98,132.92L172.02,132.21L171.42,132.68L170.66,132.61L170.41,132.22L169.84,132.59L170,133.29L169.38,133.6L168.76,133.13L168.17,133.13L167.55,133.9L167.74,134.48L167.21,134.81L166.4,134.7L166.57,134.25L165.44,133.88L164.84,134.19L164.92,134.76L164.08,135.31L163.31,135.57L162.79,135.12L161.97,135.22L161.94,135.64L161.12,135.67L160.03,136.49L159.76,135.78L158.69,135.67L158.65,134.8L157.34,134.71L157.07,134.08L157.21,133.53L156.81,133.03L155.84,132.85L155.37,132.12L155.74,131.29L155.27,130.85L155.27,130.35L154.53,130.12L154.03,130.64L153.58,129.84L154.1,129.22L153.81,128.68L154.48,128.17L154.07,127.8L153.05,128.07L151.97,127.87L152.15,126.8L151.34,126.16L151.44,125.49L152.44,124.42L151.46,123.94L150.47,123.89L150.68,124.52L150.35,124.82L149.96,124.52L148.75,124.77L148.13,124.15L147.07,125.01L145.78,124.75L145.65,124.32L144.73,124.72L144.36,125.15L144.01,123.73L143.4,123.65L143.6,122.77L143.04,122.54L142.85,121.4L143.78,121.28L143.89,120.75L142.95,120.23L143.16,119.42L142.52,119.06L143.17,118.18L142.88,117.9L142,118.1L141.21,118.62L140.73,118.36L140.45,118.62L139.81,118.4L139.11,118.68L138.31,118.66L137.72,119.33L137.14,118.99L136.22,119.14L135.18,118.86L133.62,119.48L133.26,120.19L132.49,120.01L132.23,120.44L131.55,120.56L131.26,119.87L131.63,119.23L130.18,119.29L129.92,118.19L127.69,117.49L127.8,116.8L127.05,116.52L127.5,116.17L128.19,115.05L128.91,115.16L129.26,114.57L130.23,114.22L130.67,113.51L130.85,112.69L131.79,111.72L131.46,111.29L131.74,110.49L130.64,109.6L130,108.62L129.54,108.34L129.3,107.31L128.64,106.5L128.22,106.46L127.56,105.7L126.79,105.26L126.17,103.47L125.15,103.47L124.48,103.04L124.05,103.5L122.86,103.33L122.24,103.68L121.68,103.26L121.6,102.26L121.86,101.75L123.29,101.28L123.48,99.92L124.17,99.34L123.43,99.21L123.16,98.69L122.79,98.81L122.12,98.39L120.47,98.39L120.46,97.59L120.04,98.11L119.24,98.32L118.82,98.73L118.42,98.62L118.36,97.8L117.97,97.57L118.19,97.16L118.03,96.4L117.47,96.17L116.86,96.31L117.61,95.47L117.66,95.08L115.63,95.81L115.01,94.93L114.23,94.81L114.27,93.03L113.2,92.91L112.1,93.22L110.99,92.58L110.72,92.19L109.31,91.82L108.39,91.27L107.76,91.44L107.53,92.17L108.49,92.29L108.57,92.94L108.02,93.55L108.31,94.43L108.11,95.5L107.77,95.5L106.82,96.14L106.48,96.86L105.8,96.94L105.7,96.47L104.66,95.96L103.13,95.43L102.55,94.72L101.91,93.4L100.75,92.39L100.05,92.56L99.45,93.06L98.4,93.39L97.19,92.57L96.83,92.57L96.23,93.35L95.4,93.14L94.85,92.42L94.2,92.91L92.93,93.61L90.97,94.18L88.99,95.26L87.73,96.67L87.09,97.78L86.56,97.07L85.49,96.88L84.54,96.99L83.67,97.35L82.51,98.24L81.92,98.37L79.88,97.83L77.72,98.35L76.67,98.9L76.2,99.85L74.79,99.29L73.02,99.46L71.46,100.2L70.24,101.16L68.65,102.83L66.77,105.51L64.75,107.28L64.05,107.7L63.52,108.4L63.25,109.56L63.22,110.54L63.46,111.29L64.08,112.31L64.13,112.74L63.61,113.65L62.86,114.49L61.48,115.45L61.29,116.2L61.77,117.59L63.3,119.08L63.63,119.58L64.58,119.65L64.74,120.12L64.32,121.39L64.15,122.84L63.8,124.05L63.05,124.5L63.05,125.2L64.37,125.89L65.4,126.67L65.35,127.26L65.84,127.35L66.56,127.92L65.97,128.66L66.71,129.1L66.48,129.41L67.29,129.9L68.96,129.75L68.9,130.55L68.47,130.93L68.34,131.77L67.29,132.49L66.89,133.53L66.91,134.12L67.28,134.82L67.18,135.42L66.72,136.06L65.68,136.47L64.88,136.18L63.83,136.51L64.16,135.31L63.82,134.45L63.31,134.62L62.66,134.42L62.59,133.94L61.74,133.85L61.3,134.33L61.24,134.99L60.46,135.23L60.23,136.3L60.55,136.75L58.08,137.71L57.75,138.51L56.83,139.12L56.74,139.9L56.14,140.37L55.27,140.5L55.82,140.89L55.59,141.61L54.59,141.87L53.97,142.96L54.21,143.67L53.59,144.05L54.06,145.27L53.9,145.71L54.48,146.08L54.44,146.9L54.02,148.07L55.4,148.69L56.66,148.67L57.74,148.31L58.33,147.76L58.83,147.78L59.47,148.67L59.46,149.98L59.92,150.53L59.91,151.42L59.17,152.07L58.03,152.71L57.13,153.48L55.8,154.26L55.59,154.92L54.56,155.42L54.49,156.2L55.67,156.89L56.86,157.21L58.51,157.37L59,157.58L59.37,158.22L59.43,159.64L60.29,160.15L62.9,158.34L63.79,158.74L65.52,159.28L66.25,158.65L67.32,159.08L68.19,158.57L68.43,157.34L69.86,158.19L69.36,159.34L69.37,159.99L69.72,160.46L69.66,161.55L70.71,161.75L71.15,162.24L71.71,162.31L72.08,162.93L73.18,163.1L73.92,163.69L74.98,164.09L75.37,164.68L75.64,166.8L76.13,167.16L77.52,166.47L78.44,166.66L77.65,168.1L77.48,168.9L77.77,169.3L80.03,170.95L81.1,170.75L82.76,170.18L83.37,168.92L83.98,168.57L84.44,167.8L85.16,167.04L86.35,166.69L87.86,167.23L88.09,167.51L89.21,167.24L90.13,166.78L91.47,166.58L92.42,166.85L93.16,169.34L94.39,170.82L94.43,171.97L94.88,172.53L94.5,173.12L94.92,173.76L93.9,174.4L94.31,175L94.67,174.68L95.13,175.42L95.07,176.35L94.49,176.75L95.32,176.85L95.84,177.8L95.33,177.8L95.93,178.73L97.33,178.45L99.03,178.87L99.47,179.35L99.59,180.03L100.62,181.09L101.2,182.07L101.04,183.58L102.11,183.31L102.95,184.26L103.87,183.61L103.03,183.59L103.7,182.51L104.09,182.36L104.39,181.64L105.21,180.76L105.43,179.83L106.4,179.31L108.2,177.99L108.33,177.26L107.65,176.67L106.45,176.92L106.08,176.69L107.13,175.01L107.18,174.45L108.26,173.71L109.62,173.52L111.23,172.77L112,172.58L112.15,171.17L112.5,170.84L113.81,171.04L114.25,172.79L113.86,173.09L114.23,174.32L114.75,174.67L114.77,173.83L115.05,173.93L115.39,176.49L114.67,177.83L114.8,178.37L115.67,178.36L117.45,177.96L117.76,177.73L118.74,175.18L119.55,174.73L119.7,174.3L118.88,174.05L119.03,173.8L120.62,173.59L120.75,173.97L121.52,173.82L120.99,174.58L121.21,175.42L121.78,175.75L122.49,174.89L123.55,174.43L123.9,174.59L124.34,175.65L124.99,176.04L126.28,176.27L127.1,177.47L126.7,177.9L127.51,178.92L128.13,178.85L129.58,177.91L130.24,177.66L131.22,178.04L132.08,179.57L133.26,180.44L134.64,182.41L136.45,182.07L136.26,183.62L135.09,184.95L133.83,184.23L133.38,184.46L132.85,185.69L132.81,186.66L133.03,187.14L133.65,186.74L134.62,187.06Z"},{"city":"泉州市","branch":"泉州分行","x":168.03,"y":205.41,"d":"M206.47,203.09L204.99,203.09L204.63,203.31L204.62,203.9L203.45,204.56L203.36,204.06L202.08,204.46L200.46,204.53L200.48,204.31L199.3,204.72L198.99,205.32L199.09,205.81L198.28,205.83L197.05,206.38L196.81,206.3L195.88,207.39L195.39,207.35L194.6,208.05L193.81,208.21L193.84,207.35L192.97,206.86L192.97,206.03L192.72,205.5L193.24,205.47L193.81,204.82L193.25,204.8L193.31,203.72L193.59,203.49L193.39,202.89L194.06,202.07L193.13,201.33L192.66,201.7L192.01,201.65L191.86,202.12L191.06,201.49L191.29,201.13L192.04,200.8L192.28,200.22L191.63,199.5L190.23,199.53L189.8,200L189.19,200.02L188.01,199.47L186.92,199.54L186.53,200.4L186.02,200.19L184.19,200.13L183.99,199.1L184.33,198.39L183.88,198.09L183.41,198.88L182.94,198.57L183.52,197.6L183.53,196.82L183.97,196.17L183.42,195.89L183.25,195.35L182.36,194.6L181.82,194.54L182,193.64L181.41,193.46L181.07,192.18L180.32,192.27L179.73,191.11L180.42,189.75L180.78,189.61L180.91,188.9L180.13,188.78L180.55,188.28L180.07,188.07L180.02,186.81L180.58,186.32L181.64,185L181.56,184.81L182.77,184.1L182.86,183.12L184.06,181.74L184.17,181.38L184.91,180.79L185.2,179.93L184.06,179.33L184.89,178.5L184.6,178.2L183.6,178.35L182.78,177.41L181.7,176.59L180.94,175.5L180.25,175.29L179.39,174.7L179.03,174.85L177.96,174.11L177.6,172.29L177.17,171.83L176.97,170.61L175.96,169.94L175.59,169.41L174.99,169.16L175.64,168.5L175.91,167.28L176.39,167.44L177.37,166.77L176.83,165.52L176.46,165.35L176.68,164.7L175.84,164.08L174.23,164.29L174.05,163.23L173.72,163.01L173.65,162.33L173.06,161.89L172.72,161.98L172.22,163.08L171.09,163.27L170.53,162.33L169.75,162.74L169.11,162.25L168.51,162.31L167.95,163.1L168.34,163.85L168.04,164.15L166.85,164.3L166.77,164.62L165.92,165.04L164.86,164.2L164.47,164.18L163.74,164.96L162.72,165.02L162.55,164.07L161.27,163.61L160.76,164.06L159.65,164.08L158.11,164.56L157.64,164.88L156.51,165.01L156.44,165.44L156.94,166.14L155.64,167.14L154.77,166.54L154.12,166.67L153.67,166.21L152.7,166.62L152.91,167.33L153.78,167.92L153.59,168.62L153.37,168.14L152.46,169.19L152.21,170.17L152.43,170.26L152.14,171.8L151.68,171.97L151.01,171.71L150.74,172.4L150.32,172.34L151.13,174.07L151.94,175.03L152.34,174.49L152.68,174.8L152.12,176.41L151.77,176.76L149.87,177.05L149.31,177.57L148.52,177.43L148.7,177.8L147.95,178.39L148.24,178.8L148.92,178.54L149.11,179.44L149.8,179.22L150.34,180.1L150.89,180.31L151.19,181.04L151.35,180.64L151.98,180.85L152.94,180.58L153.31,180.15L154.07,180.17L154.37,180.67L154.39,181.56L154.16,182.31L153.81,182.55L153.89,183.08L153.59,183.7L151.89,184.82L151.41,185.55L150.56,185.93L150.6,186.8L149.48,186.06L148.23,186.34L147.62,187.12L145.25,187.92L144.62,187.84L143.5,188.02L142.83,188.46L142.06,188.25L141.37,187.22L140.83,186.76L139.87,187.24L138.94,187.17L138.94,188.16L139.48,189.07L138.78,188.84L137.75,187.8L137.32,187.91L136.72,187.31L136.13,187.46L135.45,187.21L135.57,186.93L134.62,187.06L134.44,188.27L134.88,188.87L134.32,189.08L133.77,190.28L133.37,190.39L133,191.27L133.46,192.38L132.55,193.9L133.01,194.25L133,195.57L132.2,196.34L132.32,196.82L131.19,197.46L130.8,198.39L128.62,199.64L127.43,199.99L127.72,200.55L127.65,201.98L128.72,202.73L128.79,203.12L128.29,204.22L127.18,204.25L126.14,203.69L125.66,204.34L124.73,204.84L124.75,205.88L125.14,206.28L125.81,206.19L126.35,207.03L127.24,207.24L127.68,207.65L128.75,207.85L128.69,208.62L129.06,209.19L130.67,209.44L131.79,210.02L131.78,211.53L132.15,212.17L133.46,212.72L133.98,213.36L134.85,212.77L135.14,213.17L135.44,214.36L135.11,214.8L135.86,215.18L135.78,215.81L134.62,216.5L134.46,217.18L133.61,217.12L133.22,217.85L132.61,218.06L131.75,217.39L130.75,217.56L130.77,218.49L129.69,219.11L128.55,219.49L127.7,220.47L127.87,221.51L129.28,221.78L129.35,222.55L128.34,223.43L128.46,224.66L128.95,225.28L129.67,225.27L130.17,225.74L130.94,226.06L131.6,226.03L132.51,226.33L134.23,225.46L134.6,224.83L135.34,224.45L136.58,224.66L137.33,225.18L137.79,225.17L137.81,225.92L138.13,226.21L138.99,225.85L139.45,225.36L139.76,226.11L140.36,226.27L140.94,225.8L141.12,225.29L140.89,224.81L141.66,224.4L142.63,224.86L143.49,224.59L143.96,224.98L144.62,223.56L145.29,224.07L145.6,224.81L146.47,225.07L146.76,224.52L147.52,224.76L147.9,225.3L148.56,225.02L149.19,225.19L150.01,226.38L151.7,225.68L151.24,225.27L151.58,224.66L152.47,224.78L152.64,224.51L152.04,224.03L151.17,223.73L151.58,223.32L152.31,223.73L152.72,223.2L154,223.33L154.32,224.31L155.36,225.3L155.76,224.76L156.13,224.82L156.17,225.56L156.49,226.02L156.96,225.46L158.43,224.78L158.66,224.8L159.39,223.99L160.15,223.62L160.92,223.8L161.58,223.45L162.52,223.71L163.61,223.74L164.17,224.37L163.75,224.49L163.74,225.3L165.49,226.22L165.39,226.96L165.85,227.69L166.55,227.75L167.09,227.37L167.8,227.73L169.05,227.31L170.08,227.68L170.73,228.94L171.55,229.34L171.37,230.19L172.12,230.74L172.31,230.39L172.72,230.91L172.25,230.95L172.14,232.05L171.03,232.26L171.35,233.19L171.97,233.41L172.22,234.06L171.34,235.26L171.37,235.6L172.36,236.22L172.35,236.71L173.17,237.27L173.09,238.17L172.63,238.58L172.86,239.27L172.7,239.84L172.25,240.05L171.8,240.76L171.92,241.18L172.51,240.65L172.54,241.53L173.23,241.96L173.38,242.51L174.49,242.52L175.21,242.14L175.58,242.61L176.26,242.38L176.18,241.62L177.42,241.16L178.8,240.19L180.86,240.19L183.29,240.73L185.65,242.68L185.6,243.29L185.03,243.49L184.97,244.05L186.03,244.67L186.2,245.78L185.69,246.25L187.02,246.57L187.68,246.18L189.11,245.71L189.49,244.94L189.78,244.92L190.65,244.11L191.73,243.77L191.64,243.1L192.15,242.63L192.69,242.55L193.12,242.13L193.66,240.55L193.52,239.09L192.65,239.21L192.31,239.81L191.96,239.76L191.58,239.08L191.43,237.9L191.65,236.94L192.51,236.35L192.95,237.1L193.46,237.37L194.53,237.2L195.34,236.54L195.78,236.48L196.23,235.66L196.89,235.22L196.74,234.78L197.39,234.18L196.9,234.14L197.19,233.75L197.5,234.04L198.33,233.45L198.32,233.1L198.97,232.73L199.47,231.6L199.51,230.6L197.05,230.45L196.51,230.18L196.23,229.18L196.28,228.31L195.6,228.29L195.11,228.68L194.96,229.42L193.77,229.24L192.72,229.56L191.3,228.71L191.02,227.51L191.15,226.65L192.67,226.29L193.57,225.88L194.14,225.21L194.47,225.35L194.23,226.11L194.64,226.61L196.23,226.82L196.44,227.68L197.11,227.78L197.43,226.54L198.33,226.39L199.62,225.93L200.75,225.09L201.59,225.14L202.5,226.02L203.18,225.45L202.57,225.2L202.73,224.75L203.3,224.75L204.34,224.05L205.03,224.01L206.23,224.26L206.9,224.72L208.39,225.06L209.45,224.72L210.01,225.01L212.06,224.47L211.84,223.49L210.88,223.17L209.86,223.49L209.04,222.82L208.48,222.92L208.19,222.2L207.59,221.89L207.6,221.38L208.51,220.38L209.25,220.11L211.55,221.04L211.51,221.27L213.41,220.85L214.55,219.89L214.53,219.67L213.6,219.55L213.13,219.84L212.93,219.15L212.43,219.25L211.93,218.92L211.87,217.65L212.92,217.42L213.29,215.84L214.02,214.81L214.05,214.33L213.55,213.92L212.5,214.09L212.05,214.78L211.56,214.78L211.12,215.8L210.15,216.1L209.23,215.7L209.29,214.83L207.73,214.13L205.82,212.4L206,211.89L207.14,211.88L207.48,211.52L208.78,211.58L209.84,210.99L211.03,210.56L210.97,210.18L209.76,209.85L209.61,208.54L210.53,208.27L211.68,207.55L211.61,205.81L210.98,205.61L210.8,205.04L209.54,205.17L209.03,204.88L209.26,204.38L207.68,203.58L207.56,203.27L206.47,203.09ZM176.84,246.15L175.78,246.47L176.07,247.55L175.09,248.14L175.5,248.49L175.44,249.04L174.54,249.44L172.75,248.86L171.14,247.79L169.74,248.46L169.64,248.97L170.29,249.69L170.73,251.46L169.4,251.56L169.43,252.03L168.9,252.31L169.65,252.84L169.97,253.37L171.14,253.89L172.01,253.89L172.42,253.51L173.08,252.19L174.39,251.36L176.4,251.26L177.06,251.64L178.05,251.8L178.33,252.27L177.95,252.71L179.59,252.2L179.7,251.73L180.32,251.42L180.07,250.9L180.76,250.7L180.88,250.08L180.19,249.41L180.21,248.75L180.55,248.35L179.91,248.27L179.42,246.74L178.42,246.54L177.94,245.74L176.97,245.42L176.84,246.15ZM165.77,252.85L166.24,252.44L166.76,252.49L167.13,251.9L168.18,251.65L168.39,250.49L167.3,249.85L165.98,250.21L165.69,251.27L165.18,251.4L165.01,252.59L165.77,252.85ZM212.83,206.61L212.62,206.38L212.21,207.16L212.83,206.61ZM214.28,215.63L214.8,215.52L214.2,214.99L214.28,215.63Z"},{"city":"漳州市","branch":"漳州分行","x":118.84,"y":257.02,"d":"M85.12,254.71L84.69,255.29L84.65,255.84L85.38,256.37L85.43,257.06L86.07,257.6L85.69,258.11L85.75,259.57L85.99,259.83L86.67,259.66L87.17,259.86L87.03,261.93L87.26,262.43L86.95,263.63L88.29,263.76L89.22,264.88L89.52,264.78L90.42,265.37L90.88,266.01L90.37,266.64L89.67,267.02L89.31,267.52L88.82,267.53L87.74,268.62L87,269.1L86.5,270.78L86.69,272.74L87.13,273.38L88.07,273.38L87.85,274.37L87.34,274.54L88.23,275.42L88.19,276.26L88.53,276.49L89.13,276.17L89.82,276.81L89.46,277.17L89.33,278.14L89.9,279.02L89.76,280.11L89.34,280.93L88.21,281.33L88.48,281.68L88.46,282.5L89.32,282.85L89.7,283.46L89.47,284.18L88.53,284.42L88.65,284.83L89.84,285.17L90.03,284.83L90.66,284.79L91.7,285.19L92.33,286.17L92.59,287.28L92.08,287.74L92.18,288.42L93.03,289.11L93.55,290.61L93.87,290.91L94.07,292.21L93.96,292.95L94.24,293.88L94.2,294.48L95.01,295.05L95.46,294.92L96.4,296.25L97.98,296.44L98.55,297.58L99.04,297.26L99.93,297.12L100.65,297.93L101.52,298.26L102.26,298.16L102.67,298.56L102.69,302.58L107.47,302.31L108.67,302.01L108.88,302.74L109.36,303.25L110.28,303.33L112.96,302.9L114.21,303.06L116.95,301.96L117.81,302.04L118.56,301.79L119.16,301.19L119.13,300.39L118.67,299.93L118.6,298.63L119.32,297.94L120.94,297.79L121.44,297.32L121.28,296.32L120.75,296.06L120.68,295.6L121.52,294.11L122.5,294.14L124.08,293.45L125.53,293.64L126.83,294.28L127.53,294.27L128.23,293.59L129.12,291.46L129.84,290.37L131.11,289.11L131.18,288.64L130.58,287.55L131,285.39L131.82,283.84L132.97,283.19L133.77,283.13L137.33,283.31L138.86,282.54L139.16,282.17L139.72,280.36L140.06,279.73L141.18,278.61L142.5,277.52L143.55,276.33L145.08,276.33L146.33,275.92L147.36,274.25L147.39,273.28L147.2,272.16L147.6,271.02L148.55,270.02L150.23,268.65L151.2,268.16L151.76,267.59L151.85,266.14L152.94,264.93L154.13,264.81L155.21,264.21L155.63,263.63L156.3,263.26L158.8,263.03L159.29,262.64L159.42,261.66L160.48,261.7L161.08,261.46L161.33,261L161.33,260.15L160.54,259.21L160.62,258.47L160.25,257.97L159.49,257.75L159.47,256.88L159.14,256.05L158.58,255.48L157.62,255.38L156.71,255.51L156.36,255.24L156.84,254.64L157.15,252.56L157.01,252.31L154.74,251.84L153.49,251.71L152.1,251.82L151.3,251.56L150.85,250.94L150.24,250.86L149.58,250.31L149.13,249.42L149.47,248.16L149.24,246.93L147.96,246.21L147.58,245.42L146.41,245.02L146.48,244.24L146.19,243.72L146.51,242.94L144.83,241.66L145.28,241.21L145.22,240.39L146.94,240.23L147.52,239.14L149.01,238.16L149.19,237.16L149.66,236.87L149.05,234.65L148.62,234.46L148.17,232.64L148.59,231.46L149.03,231.27L149.41,229.93L149.28,227.81L149.51,226.79L149.11,226.56L148.14,226.59L147.18,225.42L146.47,225.07L145.6,224.81L145.29,224.07L144.62,223.56L143.96,224.98L143.49,224.59L142.63,224.86L141.66,224.4L140.89,224.81L141.12,225.29L140.94,225.8L140.36,226.27L139.76,226.11L139.45,225.36L138.99,225.85L138.13,226.21L137.81,225.92L137.79,225.17L137.33,225.18L136.58,224.66L135.34,224.45L134.6,224.83L134.23,225.46L132.51,226.33L131.6,226.03L130.94,226.06L130.17,225.74L129.67,225.27L128.95,225.28L128.46,224.66L128.34,223.43L129.35,222.55L129.28,221.78L127.87,221.51L127.7,220.47L128.55,219.49L129.69,219.11L130.77,218.49L130.75,217.56L131.75,217.39L132.61,218.06L133.22,217.85L133.61,217.12L134.46,217.18L134.62,216.5L135.78,215.81L135.86,215.18L135.11,214.8L135.44,214.36L135.14,213.17L134.85,212.77L133.98,213.36L133.46,212.72L132.15,212.17L131.78,211.53L131.79,210.02L130.67,209.44L129.06,209.19L128.69,208.62L128.75,207.85L127.68,207.65L127.24,207.24L126.35,207.03L125.81,206.19L125.14,206.28L124.75,205.88L124.73,204.84L124.14,204.89L124.29,206L123.49,205.47L123.15,206.4L122.32,206.98L121.2,207.06L121.08,207.6L120.42,207.62L120.37,209.42L120.07,209.81L120.26,210.25L121.54,210.92L122.02,212.04L121.6,214.93L120.87,215.98L120.79,216.39L121.09,219.08L120.94,219.63L120.37,219.86L118.05,219.76L116.81,218.68L114.9,218.53L114.3,218.29L113.47,218.95L112.95,219.04L111.71,218.64L110.3,219.26L109.62,219.27L109.26,218.82L108.52,219.06L108.82,218.32L108.38,217.95L107.97,218.11L107.25,218.91L105.36,219.6L105.22,220.08L105.91,220.11L105.37,221.48L105.4,221.92L104.77,222.77L104.31,222.81L103.75,222.06L102.17,221.78L102.43,223.07L102.91,223.26L103,224.19L101.43,225.32L101.26,227.69L100.35,228.44L99.73,229.8L99.32,230.13L97.18,229.85L95.87,230.35L95.26,230.07L95.34,228.78L95.17,227.93L94.41,227.82L94.17,228.51L94.13,229.62L92.66,230.4L92.39,230.79L92.41,232.79L92.09,234.61L92.6,235.51L93.35,235.7L92.99,236.82L93.81,237.92L93.6,239.09L93.24,239.53L92.17,239.36L91.87,240.14L92.49,240.96L92.37,242.77L92,243.69L91.34,244.38L90.77,244.59L89.79,244.36L87.78,244.34L86.86,244.98L87.04,245.7L86.67,246.19L86.22,245.42L85.58,246.07L85.93,247.58L86.53,248.88L87.06,249.56L87.56,251.03L87,253.51L86.61,253.95L85.08,254.1L85.12,254.71ZM134.22,290.08L134.59,290.26L135,289.89L134.02,289.69L134.22,290.08ZM132.53,289.37L133.08,289.95L132.93,289.41L132.53,289.37ZM160.95,257.76L161.27,256.98L160.65,256.53L160.95,257.76ZM131.66,289.02L132.11,289.15L131.77,288.26L131.66,289.02Z"},{"city":"南平市","branch":"南平分行","x":160.7,"y":78.87,"d":"M228.5,74.01L227.7,74.13L227.59,73.48L227.36,74.05L226.1,74.22L225.3,73.92L224.4,74.12L223.52,73.56L222.81,73.76L221.92,73.54L221.53,73.76L221,73.19L220.37,73.35L219.94,72.96L220.22,72.14L219.79,71.59L220.54,71.49L220.51,70.92L219.56,70.33L218.04,71.39L216.97,70.95L216.52,71.28L215.92,70.63L214.82,70.46L213.82,69.43L212.49,69.53L212,69.11L211.51,69.54L211.98,69.98L211.85,70.66L210.49,70.88L209.85,72.28L209.47,71.89L208.51,71.46L207.13,71.63L206.57,71.4L206.34,70.55L205.74,70.28L205.89,69.66L205.26,69.33L204.87,68.26L203.92,68.32L204.03,67.67L204.61,66.94L205.81,66.5L206.24,65.57L207.1,65.14L206.73,64.81L206.63,63.88L206.89,63.65L206.98,62.76L207.32,62.25L206.64,61.98L206.7,61.08L206.12,60.01L205.26,59.36L204.94,58.48L205.3,58.09L204.96,57.4L205.17,57.15L206.48,57.16L206.36,56.34L205.9,56.35L205.3,55.62L204.7,55.29L203.68,53.06L202.83,52.77L202.8,52.22L203.53,51.78L203.26,50.8L202.76,50.31L202.55,49.27L202,48.78L202.57,47.6L202.01,47.11L202.32,46.43L201.64,45.89L201.52,44.63L200.63,44.53L200.68,44.01L198.4,43.14L197.61,43.08L197.57,42.77L196.14,41.32L196.3,40.23L195.93,39.67L195.94,38.85L196.36,38.13L196.31,37.56L195.56,37L195.46,35.92L196.47,35.25L196.94,34.45L198.18,34.08L198.28,33.6L198.79,33.29L199.51,33.37L200.54,32.74L200.43,31.79L200.76,30.63L200.28,29.69L199.36,29.47L198.89,29.74L198.03,29.78L198.53,28.69L199.31,28.25L200.08,27.49L200.65,27.38L201.15,26.33L200.52,25.45L199.26,25.29L197.63,24.68L196.81,23.85L196.71,23.26L195.98,23.04L196.15,22.11L195.5,21.21L194.28,21.33L193.7,22.46L192.79,23.61L192.29,23.72L191.36,23.28L190.69,23.49L190.25,24.2L189.64,24.49L187.98,24.47L188.09,23.58L187.3,22.85L186.34,22.8L185.72,22.97L185.05,22.72L184.97,23.4L184,23.67L183.02,23.72L182.5,23.11L181.89,23.52L181.73,24.13L182.32,25.07L181.59,25.57L181.01,25.12L179.72,25.22L178.83,24.83L179.05,24.2L178.43,24.22L177.93,23.14L178.09,22.33L177.56,22.42L175.38,23.89L174.47,23.95L173.92,24.66L173.07,24.87L172.64,25.8L172.38,25.72L170.91,26.49L171.18,26.99L172.08,27.44L172.42,28.21L173.41,28.28L174.52,28.56L174.54,29.39L174.82,29.83L173.71,30.46L173.76,31.38L174.16,32.04L173.45,32.35L173.62,33.06L173.42,34.26L172.55,34.67L172.38,34.47L170.5,34.4L169.51,34.8L168.47,34.78L167.18,35.62L166.51,35.22L165.44,36.18L164.55,36.3L163.9,36.73L162.87,36.63L161.11,36.03L159.97,36.51L159.1,37.22L159.61,38.67L159.26,38.95L158.2,38.69L157.46,39.58L157.35,40.79L157.66,41.61L157.23,41.77L156.27,41.62L156.06,41.03L155.47,40.72L154.36,40.87L153.85,40.39L152.93,40.81L152.16,40.85L151.64,40.22L150.89,41.38L149.64,41.91L149.21,41.53L148.28,41.23L147.66,41.66L146.91,41.86L146.42,42.65L145.13,42.74L143.65,43.38L143,42.9L142.59,43.45L141.81,43.97L140.52,44.39L139.56,45.53L138.72,46.05L138.89,46.63L138.54,47.63L138.88,48.23L138.13,49.38L137.15,49.94L136.82,50.82L136.07,51.47L135.4,51.33L134.52,50.58L133.86,49.58L132.46,50.13L131.89,49.85L131.52,49.03L130.48,48.48L128.05,47.78L127.6,47.42L127.66,46.45L127.17,45.64L126.6,45.28L126.75,44.53L126.51,43.55L126.64,43.11L126.17,42.91L125.59,43.52L125.04,42.82L125.23,42.26L124.89,41.77L123.33,41.24L123.23,40.78L122.68,40.73L122.05,41.2L121.65,42.4L120.32,43.28L119.82,43.81L119.11,43.17L118.57,43.25L117.1,44.84L115.56,46.02L115.04,46.02L114.33,46.42L113.97,46.29L113.25,46.66L112.47,47.69L112.45,48.07L111.67,48.2L111.21,47.86L111.4,46.9L110.88,45.96L110.3,45.97L109.4,47.26L108.53,47.48L108.03,47.32L107.78,48.69L108.81,48.98L109.39,49.75L109.06,51.63L109.57,52.61L109.54,52.99L108.88,53.67L107.85,53.46L107.97,54.51L107.26,55.07L107.04,55.75L106.43,55.73L105.79,56.39L104.81,56.32L103.35,56.79L103.28,58.43L102.28,58.49L101.46,58.76L99.65,58.12L98.96,58.22L98.35,57.8L97.44,58.28L96.81,59.39L97.17,59.66L97.76,60.7L97.41,60.87L97.62,61.49L96.68,61.74L95.75,60.88L95.75,60.37L94.67,59.29L93.44,59.22L92.2,60.24L92.27,60.84L91.81,61.6L91.52,61.39L91.17,61.85L92,62.69L91.78,62.99L92.45,63.83L91.98,65.55L92.18,65.93L93.51,66.51L94.05,66.38L94.3,66.78L95.45,65.77L96.12,65.51L96.5,66.5L96.97,66.69L97.23,67.34L97.23,68.67L97.67,69.61L97.32,70.22L97.74,70.81L97.66,71.75L98.59,72.15L98.63,73.19L99.03,73.91L98.71,74.83L97.49,75.61L97.38,76.27L96.99,76.46L97.29,77.2L97.06,78.83L97.62,79.56L98.84,79.83L99.5,79.8L99.63,80.2L99.3,80.98L100.51,81.05L100.7,81.41L101.41,81.73L101.06,83.1L100.35,83.47L100.07,84.63L99.51,85.21L98.29,86.13L98.03,86.62L97.45,86.86L96.87,86.75L96.09,88.1L95.17,88.54L94.41,89.63L93.93,89.9L93.61,90.64L94.2,92.91L94.85,92.42L95.4,93.14L96.23,93.35L96.83,92.57L97.19,92.57L98.4,93.39L99.45,93.06L100.05,92.56L100.75,92.39L101.91,93.4L102.55,94.72L103.13,95.43L104.66,95.96L105.7,96.47L105.8,96.94L106.48,96.86L106.82,96.14L107.77,95.5L108.11,95.5L108.31,94.43L108.02,93.55L108.57,92.94L108.49,92.29L107.53,92.17L107.76,91.44L108.39,91.27L109.31,91.82L110.72,92.19L110.99,92.58L112.1,93.22L113.2,92.91L114.27,93.03L114.23,94.81L115.01,94.93L115.63,95.81L117.66,95.08L117.61,95.47L116.86,96.31L117.47,96.17L118.03,96.4L118.19,97.16L117.97,97.57L118.36,97.8L118.42,98.62L118.82,98.73L119.24,98.32L120.04,98.11L120.46,97.59L120.47,98.39L122.12,98.39L122.79,98.81L123.16,98.69L123.43,99.21L124.17,99.34L123.48,99.92L123.29,101.28L121.86,101.75L121.6,102.26L121.68,103.26L122.24,103.68L122.86,103.33L124.05,103.5L124.48,103.04L125.15,103.47L126.17,103.47L126.79,105.26L127.56,105.7L128.22,106.46L128.64,106.5L129.3,107.31L129.54,108.34L130,108.62L130.64,109.6L131.74,110.49L131.46,111.29L131.79,111.72L130.85,112.69L130.67,113.51L130.23,114.22L129.26,114.57L128.91,115.16L128.19,115.05L127.5,116.17L127.05,116.52L127.8,116.8L127.69,117.49L129.92,118.19L130.18,119.29L131.63,119.23L131.26,119.87L131.55,120.56L132.23,120.44L132.49,120.01L133.26,120.19L133.62,119.48L135.18,118.86L136.22,119.14L137.14,118.99L137.72,119.33L138.31,118.66L139.11,118.68L139.81,118.4L140.45,118.62L140.73,118.36L141.21,118.62L142,118.1L142.88,117.9L143.17,118.18L142.52,119.06L143.16,119.42L142.95,120.23L143.89,120.75L143.78,121.28L142.85,121.4L143.04,122.54L143.6,122.77L143.4,123.65L144.01,123.73L144.36,125.15L144.73,124.72L145.65,124.32L145.78,124.75L147.07,125.01L148.13,124.15L148.75,124.77L149.96,124.52L150.35,124.82L150.68,124.52L150.47,123.89L151.46,123.94L152.44,124.42L151.44,125.49L151.34,126.16L152.15,126.8L151.97,127.87L153.05,128.07L154.07,127.8L154.48,128.17L153.81,128.68L154.1,129.22L153.58,129.84L154.03,130.64L154.53,130.12L155.27,130.35L155.27,130.85L155.74,131.29L155.37,132.12L155.84,132.85L156.81,133.03L157.21,133.53L157.07,134.08L157.34,134.71L158.65,134.8L158.69,135.67L159.76,135.78L160.03,136.49L161.12,135.67L161.94,135.64L161.97,135.22L162.79,135.12L163.31,135.57L164.08,135.31L164.92,134.76L164.84,134.19L165.44,133.88L166.57,134.25L166.4,134.7L167.21,134.81L167.74,134.48L167.55,133.9L168.17,133.13L168.76,133.13L169.38,133.6L170,133.29L169.84,132.59L170.41,132.22L170.66,132.61L171.42,132.68L172.02,132.21L171.98,132.92L171.4,133.3L171.69,134.02L172.55,133.91L172.73,133.51L173.03,134.16L173.8,134.43L174.35,133.9L175.68,134.81L176.63,134.81L177.29,134.58L178.72,134.76L179.35,134.27L179.39,135.26L179.05,135.49L178.32,134.9L177.72,135.65L177.78,136.26L178.32,137.08L179.17,137.46L179.38,138.09L180.22,137.68L181.85,136.58L182.23,136.54L183.27,137.31L183.76,138.25L184.48,138.19L184.73,137.87L185.56,137.91L186.04,138.24L185.92,138.88L187.77,138.97L187.68,139.41L188.2,140.12L188.72,140.14L189.17,141.08L190.09,141.05L190.3,142.04L190.79,142.52L191.64,142.6L192.42,143.74L192.68,143.24L192.28,141.85L192.25,140.75L191.4,139.23L192.09,138.65L192.02,137.89L190.71,137.12L190.01,136.87L189.69,136.47L188.82,136.71L188.13,137.36L187.79,137.38L187.9,136.78L187.28,136.14L186,136.41L185.94,135.23L185.25,134.97L185.18,133.69L186.19,132.76L186.2,132.43L185.61,131.83L186.24,130.62L187.48,130.04L188.35,129.87L188.76,129.16L188.57,128.19L189.16,127.14L189.16,126.15L189.39,125.34L188.52,125.53L187.68,125.39L187.07,124.68L187.55,122.31L187.31,121.83L187.43,120.97L187.88,120.36L187.98,119.46L188.28,119.07L188.16,118.52L187.59,118.19L186.93,118.17L186.56,117.67L187.13,117.11L187.09,116.62L187.5,116.14L188.4,116.22L188.56,115.08L189.05,114.54L189.07,113.69L189.71,112.47L189.78,111.52L190.52,111.08L190.75,109.66L189.81,108.41L190.17,107.67L191.23,107.53L191.34,107.17L192.09,107.03L192.65,107.24L193.74,106.94L194.08,106.5L193.85,105.9L194.22,105.55L194.52,104.48L193.92,103.18L192.6,102.04L193.19,101.08L194.11,101.27L194.31,101.87L195.06,102.22L196.44,101.5L197.19,101.91L199.35,102.06L199.93,101.7L199.97,100.97L200.63,100.32L201.9,100.03L202.69,99.6L203.14,98.88L202.94,98.12L203.3,97.52L204.06,97.61L204.91,96.83L205.28,95.72L206.38,94.62L206.63,93.57L207.45,93.18L207.94,92.27L208.41,92.19L209.3,92.7L210.01,91.98L209.92,91.38L209.3,91.39L209.38,90.55L208.6,90.76L208.42,90.34L208.93,89.31L208.55,89.45L208.29,88.91L208.75,88.53L209.14,88.76L210.4,88.94L211.82,89.52L212.04,91.42L212.54,91.7L212.02,92.54L212.65,93.16L213.4,93.21L213.9,92.85L215.17,92.85L215.38,92.61L216.18,93.11L217.25,92.93L218.24,93.16L218.26,94.01L219.12,94.55L219.88,95.46L219.85,95.78L220.86,95.59L220.73,94.72L220.32,93.75L221.31,93.72L222.31,93.47L222.37,92.55L223.84,92.03L224.46,92.45L225.03,92.1L225.03,91.44L223.87,91.03L224.22,89.34L224.01,88.87L223.22,88.91L223.39,88.45L223.42,87.1L224.81,86.53L225.15,85.18L226.85,85.65L226.83,86.39L227.59,86.99L228.12,86.8L228.58,87.22L229.08,86.33L227.49,84.78L226.75,84.98L225.73,83.94L225.02,83.47L225.44,83.32L225.23,82.64L225.37,81.31L225.77,80.47L226.47,80.41L226.91,79.91L227.51,79.96L227.32,79.19L227.6,78.47L228.06,78.28L228,77.3L228.85,77.04L229.3,76.46L229.2,75.99L228.59,75.36L228.37,74.6L228.5,74.01Z"},{"city":"龙岩市","branch":"龙岩分行","x":75.38,"y":200.11,"d":"M54.49,156.2L53.46,156.41L52.72,157.83L52.11,158.11L52.04,158.66L52.54,159.64L52.65,160.33L51.34,160.42L50,160.73L49.63,161.66L48.65,162.33L48.55,162.74L47.22,163.22L46.47,163.23L45.86,163.9L44.28,164.05L43.85,163.57L42.76,163.99L41.83,164.02L40.96,164.41L40.48,165.44L39.49,165.45L38.11,166.52L38.02,167.71L38.17,168.56L39.84,169.43L39.89,170.07L40.88,170.87L41.2,171.4L40.92,171.87L40.83,172.99L40.25,173.05L40.29,172.01L39.03,172.39L38.04,172.42L37.26,173.62L37.35,173.98L36.76,174.54L36.85,175.47L36.66,175.86L35.18,176.15L34.27,175.68L34.27,176.44L33.82,176.22L33.58,176.97L34.13,177.34L33.66,178.28L34.35,179.1L34.24,179.81L33.79,179.53L33.26,180.21L32.69,180.29L33.01,180.84L32.65,181.43L33.32,181.93L33.47,183.14L33.98,184.02L33.45,184.99L32.61,184.93L32.31,185.37L32.38,186.89L31.12,187.28L30.96,187.88L30.49,188.33L30.6,189.32L31.33,189.3L30.9,190.42L31.5,191.44L31.49,192.47L31.08,192.84L30.49,192.85L30.3,193.21L30.65,194.12L29.92,194.9L29.72,195.41L30.16,196.2L29.65,196.94L30.17,197.05L30.51,197.79L30.21,198.14L30.65,198.35L30.16,199.53L29.33,200.16L28.8,199.71L28.62,200.21L28.07,200.39L27.21,200.02L26.95,200.32L27.08,201.62L26.48,202.34L25.96,203.4L25.19,203.74L24.18,203.68L23.52,204.48L22.79,204.69L22.29,204.28L21.38,204.98L21.5,206.83L21.25,206.93L21.67,207.55L21.24,207.68L21.35,208.31L22.1,208.56L22.61,208.36L23.17,209L23.37,209.74L22.5,210.17L22.5,210.59L23.1,211.27L22.87,211.92L24.58,212.38L25.26,213.09L24.92,213.79L25.36,213.76L25.8,214.39L25.2,215.09L24.83,214.84L23.95,215.19L23.36,216.03L22.48,216.2L22.68,217.2L22.98,217.68L24.03,217.87L25.12,218.91L25.6,219.71L25.13,219.87L24.35,219.5L23.78,219.63L23.61,219.16L23.04,218.77L22.39,219.04L22.27,219.78L23.12,220.29L23.63,221.11L23.92,221.11L24.59,221.93L27.44,222.21L27.9,222.53L28.74,222.36L29.24,223.29L30.35,223.51L31.09,222.97L31.58,223.18L32.49,224.08L32.78,225.02L33.34,225.59L33.98,225.68L34.35,226.27L35.22,226.06L35.71,226.96L35.93,226.31L37.21,226.19L38.64,226.58L39.48,226.47L41.17,224.78L41.82,224.66L42.38,225.8L42.98,226.01L43.57,226.71L43.61,227.41L44.1,227.69L44.69,227.43L45.36,227.58L44.37,228.86L44.33,229.19L45.44,229.62L46.27,229.24L47.87,229.22L48.4,229.06L49.5,228.15L50.36,227.65L50.39,227.94L51.08,227.6L51.39,227.06L51.42,225.87L52.16,225.09L52.93,225.18L53.22,224.64L54.16,224.62L54.11,225.86L54.92,226.07L55.56,226.82L53.1,227.98L53.02,229.03L53.53,229.77L54.46,229.59L54.92,230.55L55.64,231.17L55.41,231.81L55.52,232.6L56.75,233.17L57.28,234.3L57.88,234.34L58.72,234.01L59.77,234.05L60.65,235.25L60.86,237.11L61.62,237.98L60.97,239.82L62.14,240.79L63.8,240.3L64.84,239.79L65,239.29L65.81,238.9L66.43,237.88L68.11,238.62L68.63,238.63L68.78,238.25L70.72,237.6L72.12,237.55L72.75,237.78L73.17,237.22L75.27,237.13L75.99,237.85L77.44,236.36L78.87,236.44L79.73,237.84L79.53,238.42L78.71,238.88L78.73,239.66L78.04,240.21L77.68,240.9L76.44,242.09L76.84,243.2L76.13,243.74L76.27,244.24L77.12,244.94L77.65,245L77.55,245.36L78.08,246.31L78.61,246.88L79.82,247.57L79.57,247.94L80.84,247.23L81.8,248.24L82.49,249.24L81.95,249.8L81.32,249.76L81.17,250.4L81.73,251.33L82.17,251.51L82.66,252.34L83.02,252.5L83.26,253.45L83.98,253.15L85.12,254.71L85.08,254.1L86.61,253.95L87,253.51L87.56,251.03L87.06,249.56L86.53,248.88L85.93,247.58L85.58,246.07L86.22,245.42L86.67,246.19L87.04,245.7L86.86,244.98L87.78,244.34L89.79,244.36L90.77,244.59L91.34,244.38L92,243.69L92.37,242.77L92.49,240.96L91.87,240.14L92.17,239.36L93.24,239.53L93.6,239.09L93.81,237.92L92.99,236.82L93.35,235.7L92.6,235.51L92.09,234.61L92.41,232.79L92.39,230.79L92.66,230.4L94.13,229.62L94.17,228.51L94.41,227.82L95.17,227.93L95.34,228.78L95.26,230.07L95.87,230.35L97.18,229.85L99.32,230.13L99.73,229.8L100.35,228.44L101.26,227.69L101.43,225.32L103,224.19L102.91,223.26L102.43,223.07L102.17,221.78L103.75,222.06L104.31,222.81L104.77,222.77L105.4,221.92L105.37,221.48L105.91,220.11L105.22,220.08L105.36,219.6L107.25,218.91L107.97,218.11L108.38,217.95L108.82,218.32L108.52,219.06L109.26,218.82L109.62,219.27L110.3,219.26L111.71,218.64L112.95,219.04L113.47,218.95L114.3,218.29L114.9,218.53L116.81,218.68L118.05,219.76L120.37,219.86L120.94,219.63L121.09,219.08L120.79,216.39L120.87,215.98L121.6,214.93L122.02,212.04L121.54,210.92L120.26,210.25L120.07,209.81L120.37,209.42L120.42,207.62L121.08,207.6L121.2,207.06L122.32,206.98L123.15,206.4L123.49,205.47L124.29,206L124.14,204.89L124.73,204.84L125.66,204.34L126.14,203.69L127.18,204.25L128.29,204.22L128.79,203.12L128.72,202.73L127.65,201.98L127.72,200.55L127.43,199.99L128.62,199.64L130.8,198.39L131.19,197.46L132.32,196.82L132.2,196.34L133,195.57L133.01,194.25L132.55,193.9L133.46,192.38L133,191.27L133.37,190.39L133.77,190.28L134.32,189.08L134.88,188.87L134.44,188.27L134.62,187.06L133.65,186.74L133.03,187.14L132.81,186.66L132.85,185.69L133.38,184.46L133.83,184.23L135.09,184.95L136.26,183.62L136.45,182.07L134.64,182.41L133.26,180.44L132.08,179.57L131.22,178.04L130.24,177.66L129.58,177.91L128.13,178.85L127.51,178.92L126.7,177.9L127.1,177.47L126.28,176.27L124.99,176.04L124.34,175.65L123.9,174.59L123.55,174.43L122.49,174.89L121.78,175.75L121.21,175.42L120.99,174.58L121.52,173.82L120.75,173.97L120.62,173.59L119.03,173.8L118.88,174.05L119.7,174.3L119.55,174.73L118.74,175.18L117.76,177.73L117.45,177.96L115.67,178.36L114.8,178.37L114.67,177.83L115.39,176.49L115.05,173.93L114.77,173.83L114.75,174.67L114.23,174.32L113.86,173.09L114.25,172.79L113.81,171.04L112.5,170.84L112.15,171.17L112,172.58L111.23,172.77L109.62,173.52L108.26,173.71L107.18,174.45L107.13,175.01L106.08,176.69L106.45,176.92L107.65,176.67L108.33,177.26L108.2,177.99L106.4,179.31L105.43,179.83L105.21,180.76L104.39,181.64L104.09,182.36L103.7,182.51L103.03,183.59L103.87,183.61L102.95,184.26L102.11,183.31L101.04,183.58L101.2,182.07L100.62,181.09L99.59,180.03L99.47,179.35L99.03,178.87L97.33,178.45L95.93,178.73L95.33,177.8L95.84,177.8L95.32,176.85L94.49,176.75L95.07,176.35L95.13,175.42L94.67,174.68L94.31,175L93.9,174.4L94.92,173.76L94.5,173.12L94.88,172.53L94.43,171.97L94.39,170.82L93.16,169.34L92.42,166.85L91.47,166.58L90.13,166.78L89.21,167.24L88.09,167.51L87.86,167.23L86.35,166.69L85.16,167.04L84.44,167.8L83.98,168.57L83.37,168.92L82.76,170.18L81.1,170.75L80.03,170.95L77.77,169.3L77.48,168.9L77.65,168.1L78.44,166.66L77.52,166.47L76.13,167.16L75.64,166.8L75.37,164.68L74.98,164.09L73.92,163.69L73.18,163.1L72.08,162.93L71.71,162.31L71.15,162.24L70.71,161.75L69.66,161.55L69.72,160.46L69.37,159.99L69.36,159.34L69.86,158.19L68.43,157.34L68.19,158.57L67.32,159.08L66.25,158.65L65.52,159.28L63.79,158.74L62.9,158.34L60.29,160.15L59.43,159.64L59.37,158.22L59,157.58L58.51,157.37L56.86,157.21L55.67,156.89L54.49,156.2Z"},{"city":"宁德市","branch":"宁德分行","x":242.32,"y":100.61,"d":"M261.2,125.76L261.16,125.21L260.58,124.57L260.79,124.16L260.49,123.61L259.35,123.1L258.32,122.84L257.56,121.98L256.82,121.78L255.08,122.01L254.49,121.96L253.85,121.57L253.31,121.55L252.75,122.02L251.25,122.51L250.3,123.08L249.52,122.97L247.7,121.3L248.07,120.61L248.55,120.68L250.23,119.71L250.76,118.09L251.14,118.11L251.53,117.57L251.06,116.76L251.33,116.51L252.55,116.66L252.95,115.4L252.5,115.03L252.29,114.05L252.54,114.07L252.97,115.14L254.82,116.89L255.79,117.48L257.65,117.62L260.44,117.23L261.83,117.63L263.05,117.23L264.39,117.75L265,118.24L264.75,119.07L264.93,119.92L265.7,120.07L267.78,118.98L267.35,118.38L267.57,118.08L267.23,117.1L267.59,116.84L268.08,115.92L269.09,115.18L269.6,114.2L269.61,113.77L268.78,112.54L269.24,111.95L269.9,111.67L270.86,111.79L271.47,111.59L271.38,112.08L272.12,112.25L273.09,111.87L275.12,111.83L276.79,111.6L277.2,112.29L276.98,112.77L275.86,113.81L275.33,113.87L274.61,114.38L274.55,115.01L272.99,115.47L272.7,116.08L271.57,117.19L271.96,118.04L271.61,118.6L271.55,119.48L270.81,119.73L271,120.39L270.27,121.17L270.1,121.9L269.73,121.25L268.4,121.35L267.4,121.16L266.82,121.62L264.36,122.89L263.98,123.27L263.9,124.46L263.33,124.92L263.42,125.61L263.04,126.11L262.94,127.1L263.58,127.7L265.27,128.01L266.35,127.94L266.9,127.71L267.41,126.73L268,126.17L269.32,125.87L269.65,125.23L270.18,124.95L269.59,124L270.13,123.22L271.4,122.75L272.38,123L273.83,122.87L275.23,122.14L277.01,121.08L277.5,120.99L278.18,121.65L279.07,121.8L279.67,121.4L281.75,120.36L282.15,119.69L281.13,119.74L281.32,118.95L280.7,119.13L280.38,118.83L280.09,117.12L281.14,116.38L282.5,116.13L283.08,115.75L283.44,114.83L282.51,114.65L283,113.93L282.39,113.73L281.05,114.25L280.31,114.12L279.85,113.56L280.91,111.89L281.69,111.47L281.66,110.9L281.17,111.11L280.76,110.88L279.58,111.02L279.09,109.9L279.73,109.37L279.59,109.18L278.38,109.45L277.23,109.33L276.41,108.39L276.37,107.6L276.67,107L277.65,107L278.43,106.53L279.67,106.45L280.55,105.86L280.76,105.11L280.53,104.5L280.58,103.73L281.07,103.64L281.78,103.94L282.29,103.5L282.85,103.79L284.34,103.64L284.91,103.98L286.03,103.9L287.11,104.07L287.46,104.42L287.8,103.79L288.39,103.38L288.48,102.58L288.17,102.51L288.62,100.51L289.25,99.95L290.3,99.76L290.35,98.34L290.05,97.27L288.96,97.04L289.4,96.84L291.34,96.81L291.59,96.58L290.8,95.22L291.04,94.52L290.55,93.6L290.84,93.36L292,93.71L292.81,93.33L293.23,93.75L295.18,93.85L297.2,94.11L297.79,93.64L297.88,92.96L299.26,92.3L301.43,90.48L300.43,89.39L300.01,89.39L299.27,88.65L299.24,88.06L297.95,86.84L297.74,86.39L298.53,85.24L297.59,84.56L297.79,84.06L298.61,83.74L299.04,84.07L299.51,83.59L298.21,82.54L297.76,81.24L296.67,80.4L296.15,79.42L295.15,78.93L294.73,78.38L294.96,77.96L294.23,77.23L294.74,76.2L294.08,75.25L293.53,75.46L292.8,75.25L292.55,74.9L292.53,75.63L291.76,75.69L290.96,75.47L289.98,75.86L289.06,74.48L289.4,74.16L289.32,73.28L288.5,72.87L288.37,73.18L286.84,74.03L286.32,74.03L285.66,73.55L284.11,74.05L283.43,73.76L281.54,74.06L281.3,74.44L281.7,75.09L281.19,75.73L280.75,75.38L279.88,75.49L279.21,75.8L279.25,76.44L278.04,77.05L277.08,78.34L276.54,78.86L275.04,78.65L274.98,78.15L274.33,77.32L273.94,77.37L273.68,76.61L273.01,76.46L272.65,76.93L270.94,77.24L271.17,77.57L270.94,78.08L270.4,78.38L269.64,79.74L269.96,80.32L269.32,80.17L267.48,80.11L267.22,80.47L266.53,80.36L266,80.59L265.95,81.04L265.19,80.79L265.54,80.24L264.65,80.28L264.01,79.73L263.32,80.41L263.93,80.76L263.64,81.22L262.56,81.07L262.39,81.39L261.8,80.89L260.94,80.53L260.62,81L259.41,80.82L259.36,79.78L260.29,79.76L260.07,79.35L259.28,79.04L259.32,78.46L258.2,78.17L257.98,77.59L257.58,77.47L258.19,76.82L257.64,76.68L257.53,76.01L257.1,75.83L256.63,75.16L255.7,74.95L255.4,73.77L254.48,73.4L254.24,72.95L254.75,72.94L255.33,72.43L255.36,71.76L255.72,71.53L255.53,70.29L255.73,69.55L255.3,69.35L255.64,68.46L254.19,66.87L254.06,67.12L253.12,67.32L252.65,66.96L253.23,65.96L253.42,65.97L253.61,64.9L251.8,64.68L250.92,64.41L250.65,62.17L251.54,61.88L251.93,60.98L251.45,60.27L251.72,59.62L251.18,59.32L249.42,58.96L248.74,59.42L248.07,59.53L247.76,59.25L247,59.61L246.01,59.6L245.96,59.23L245.34,58.92L245.51,59.6L245.21,59.89L244.54,59.81L244.2,60.42L243.66,60.22L243.03,60.43L242.84,61.85L243.02,62.9L242.27,63.46L241.86,64.23L242.04,65.14L241.59,66.12L241.42,66.98L240.92,67.74L240.02,68.51L239.22,68.79L238.88,68.54L238.52,67.47L237.89,66.96L236.57,66.98L235.47,67.24L234.45,67.86L233.35,68.9L233.7,69.74L232.91,70.49L229.89,71.82L229.37,73.13L228.85,73.96L228.5,74.01L228.37,74.6L228.59,75.36L229.2,75.99L229.3,76.46L228.85,77.04L228,77.3L228.06,78.28L227.6,78.47L227.32,79.19L227.51,79.96L226.91,79.91L226.47,80.41L225.77,80.47L225.37,81.31L225.23,82.64L225.44,83.32L225.02,83.47L225.73,83.94L226.75,84.98L227.49,84.78L229.08,86.33L228.58,87.22L228.12,86.8L227.59,86.99L226.83,86.39L226.85,85.65L225.15,85.18L224.81,86.53L223.42,87.1L223.39,88.45L223.22,88.91L224.01,88.87L224.22,89.34L223.87,91.03L225.03,91.44L225.03,92.1L224.46,92.45L223.84,92.03L222.37,92.55L222.31,93.47L221.31,93.72L220.32,93.75L220.73,94.72L220.86,95.59L219.85,95.78L219.88,95.46L219.12,94.55L218.26,94.01L218.24,93.16L217.25,92.93L216.18,93.11L215.38,92.61L215.17,92.85L213.9,92.85L213.4,93.21L212.65,93.16L212.02,92.54L212.54,91.7L212.04,91.42L211.82,89.52L210.4,88.94L209.14,88.76L208.75,88.53L208.29,88.91L208.55,89.45L208.93,89.31L208.42,90.34L208.6,90.76L209.38,90.55L209.3,91.39L209.92,91.38L210.01,91.98L209.3,92.7L208.41,92.19L207.94,92.27L207.45,93.18L206.63,93.57L206.38,94.62L205.28,95.72L204.91,96.83L204.06,97.61L203.3,97.52L202.94,98.12L203.14,98.88L202.69,99.6L201.9,100.03L200.63,100.32L199.97,100.97L199.93,101.7L199.35,102.06L197.19,101.91L196.44,101.5L195.06,102.22L194.31,101.87L194.11,101.27L193.19,101.08L192.6,102.04L193.92,103.18L194.52,104.48L194.22,105.55L193.85,105.9L194.08,106.5L193.74,106.94L192.65,107.24L192.09,107.03L191.34,107.17L191.23,107.53L190.17,107.67L189.81,108.41L190.75,109.66L190.52,111.08L189.78,111.52L189.71,112.47L189.07,113.69L189.05,114.54L188.56,115.08L188.4,116.22L187.5,116.14L187.09,116.62L187.13,117.11L186.56,117.67L186.93,118.17L187.59,118.19L188.16,118.52L188.28,119.07L187.98,119.46L187.88,120.36L187.43,120.97L187.31,121.83L187.55,122.31L187.07,124.68L187.68,125.39L188.52,125.53L189.39,125.34L189.16,126.15L189.16,127.14L188.57,128.19L188.76,129.16L188.35,129.87L187.48,130.04L186.24,130.62L185.61,131.83L186.2,132.43L186.19,132.76L185.18,133.69L185.25,134.97L185.94,135.23L186,136.41L187.28,136.14L187.9,136.78L187.79,137.38L188.13,137.36L188.82,136.71L189.69,136.47L190.01,136.87L190.71,137.12L192.02,137.89L192.09,138.65L191.4,139.23L192.25,140.75L192.28,141.85L193.31,141.16L193.19,140.87L194.11,140.89L193.76,140.51L193.82,139.73L195.02,138.8L195.57,137.99L197.48,138.1L197.57,138.36L198.79,138.69L200.04,137.99L200.34,136.8L199.18,136.04L198.35,134.9L197.56,134.55L198.11,133.22L196.22,132.19L196.48,131.61L196.49,130.28L197.66,129.42L197.17,128.4L197.25,127.9L198.11,127.85L199.36,128.2L199.42,128.94L200.21,129.13L200.72,129.57L200.69,130.42L200.25,130.89L201.08,131.62L201.03,132.54L201.43,132.32L201.94,132.51L202.08,132.9L203.73,132.12L204.06,131.3L204.57,131.13L204.78,130.52L206.88,129.84L208.08,129.87L208.81,130.57L209.54,130.35L209.78,129.55L209.58,129.03L208.9,128.93L208.95,128.35L209.42,127.92L209.75,127.02L210.63,126.62L211.58,126.55L212.26,126.83L212.66,125.85L212.19,125.36L212.93,125.24L213.41,124.19L213.52,123.22L214.16,123.34L214.29,122.71L215.68,122.78L216.07,122.4L217.06,123.05L217.24,123.43L216.54,123.84L216.4,124.34L216.95,124.56L218.06,124.63L218.66,124.1L218.74,125.03L219.4,125.53L219.61,126.24L220.77,126.03L221.15,126.29L221.58,125.95L222.25,126.09L222.73,125.61L223.64,125.32L224.48,124.46L224.99,124.78L225.64,125.82L225.66,126.36L226.49,127.12L227.56,126.59L227.98,125.66L229.53,126.46L229.9,124.37L230.74,123.12L231.78,123.13L232.03,123.49L231.71,124.07L232.76,123.86L232.96,123.49L233.74,123.2L233.49,122.74L233.93,122.44L234.49,122.68L235.15,122.53L235.64,121.93L235.69,121.34L236.15,121.26L237.27,121.58L237.77,121.22L236.98,120.95L237.39,120.58L238.37,121.15L239.86,120.8L240.93,121L241.37,120.76L242.99,121.36L243.36,122.19L244.83,123.9L244.45,124.18L245.07,124.92L246.38,125.29L246.46,125.88L246.94,125.79L248.15,126.33L248.77,126.13L249.35,126.4L249.67,126.92L250.41,127.29L251.35,126.87L252.65,126.99L253.02,126.42L253.61,126.31L254.02,125.04L255.08,124.44L256.87,125.01L257.8,124.49L257.78,124.05L258.99,123.97L260.14,124.59L260.85,125.17L261.2,125.76ZM201.94,132.51L201.43,132.32L201.03,132.54L202.08,132.9L201.94,132.51ZM316.73,99.62L316.69,100.43L317.17,100.42L317.47,99.48L316.73,99.62ZM315.58,98.75L315.62,99.32L316.31,99.04L316.41,98.51L315.69,98.41L315.58,98.75ZM288.53,102.82L288.42,104.01L289.48,103.85L289.64,103.33L289.07,103.4L289.77,102.75L289.04,103.05L288.53,102.82ZM292.7,103.03L293.07,102.81L292.14,102.53L290.62,103.06L291.21,103.43L292.49,103.5L292.7,103.03ZM261.66,118.26L262.01,118.75L262.86,118.21L261.78,117.74L261.05,117.66L261.66,118.26ZM294.69,120.21L295.8,120.55L294.97,119.81L294.69,120.21ZM267.69,117.3L267.56,117.74L268.3,118.19L268.83,118.17L268.91,118.79L269.35,118.67L270.12,119.08L269.66,118.43L269.93,117.63L270.37,117.14L268.47,117.15L267.69,117.3ZM261.28,124.54L262.05,124.96L262.23,124.23L261.28,124.54ZM294.56,116.61L294.3,116.92L294.66,117.27L295.98,116.73L295.2,116.17L294.56,116.61ZM275.45,129.2L276.29,128.86L277.13,128.86L277.69,128.01L277.71,127.28L277.02,127.21L276.86,127.57L276.35,127.34L275.56,127.59L275.36,128.49L274.97,128.69L275.45,129.2ZM282.48,125.24L282.38,125.48L283.38,125.29L282.91,124.85L282.48,125.24ZM281.71,117.63L281.87,117.17L280.96,116.9L280.94,117.35L281.71,117.63ZM281.43,126.74L282.3,126.88L282.7,126.58L282.3,125.91L281.75,126.05L281.88,126.4L281.43,126.74ZM296.08,101.32L296.29,101.73L297.2,101.36L296.08,101.32ZM273.54,125.91L273.22,126.54L273.54,126.57L274.05,126.02L273.48,125.46L273.54,125.91ZM258.82,121.83L259.19,122.36L259.77,122.63L260.72,122.29L261.07,121.94L261.9,122.09L262.34,121.37L261.13,120.77L258.79,121.38L258.82,121.83ZM261,122.6L261.68,122.59L261.28,122.25L261,122.6ZM297.92,93.23L298.97,93.15L299.21,92.74L298.48,92.81L297.92,93.23ZM281.62,125.52L282.5,124.97L282.53,124.47L283.51,124.3L283.76,122.68L283.27,122.29L282.53,122.46L281.68,123.32L281.54,123.72L280.53,124.44L281.05,125.3L281.62,125.52ZM286.71,106.49L287.28,106.24L287.02,105.61L286.42,106.13L286.71,106.49ZM281.49,129.16L281.56,129.53L282.24,129.14L282.11,128.66L281.49,129.16ZM295.29,103.85L296.47,103.22L297.41,103.28L297.34,102.84L296.49,102.46L295.89,101.18L294.9,100.64L293.97,100.68L292.87,101.52L292.96,102.46L294.22,103.53L295.29,103.85ZM281.97,110.84L282.15,111.26L283.15,111.49L283.2,110.57L282.51,110.52L281.97,110.84ZM253.19,120.93L254.78,120.83L256.38,120.48L258.69,119.09L258.94,118.17L258.1,117.81L255.9,118.56L254.62,118.41L253.54,117.83L253.06,117.9L252.5,118.48L252.2,119.72L252.6,120.58L253.19,120.93ZM259.87,118.11L260.51,117.85L260.68,117.37L259.85,117.57L259.87,118.11Z"}];
    const REGIONAL_SVG_MAPS = {"beijing":{"viewBox":"0 0 520 420","regions":[{"name":"东城区","adcode":110101,"x":248.23,"y":287.4,"d":"M254.18,296.98L254.64,295.5L254.28,293.03L255.86,292.98L255.84,292.1L254.99,292.08L254.91,290.74L255.35,290L252.54,290.28L252.19,287.54L252.04,284.16L254.19,284.17L254.19,282.33L254.8,280.14L253.47,280.35L253.86,279.34L252.29,278.78L252.59,279.44L250.93,279.23L250.82,277.6L249.87,276.45L247.42,276.47L246.78,275.84L246.71,274.34L245.89,273.76L245.97,276.47L241.75,276.25L241.33,276.76L241.13,277.66L242.64,277.58L242.85,281.42L243.28,281.55L243.4,284.25L244.04,285.33L242.37,285.6L242.39,288.94L243.14,288.91L243.26,290.87L243.61,291.05L243.96,297.13L239.71,297.37L239.72,298.54L241.38,298.24L243,299.3L243.13,300.23L245.74,299.94L247.02,300.17L247.81,299.09L247.3,297.37L249.49,296.98L253.93,297.2L254.18,296.98Z"},{"name":"西城区","adcode":110102,"x":235.75,"y":286.02,"d":"M227.13,291.48L227.14,292.79L225.97,294.99L226.1,296.44L227.32,296.06L229.31,296.44L230.75,296.22L231.37,296.79L232.56,296.81L232.82,297.93L239.71,297.37L243.96,297.13L243.61,291.05L243.26,290.87L243.14,288.91L242.39,288.94L242.37,285.6L244.04,285.33L243.4,284.25L243.28,281.55L242.85,281.42L242.64,277.58L241.13,277.66L241.33,276.76L241.89,275.04L242.82,274.82L242.81,274.02L239.78,274.06L239.66,275.1L237.36,275.16L237.73,279.59L234.11,280.63L233.15,279.07L233.24,280.69L230.72,281.11L228.76,280.63L227.63,281.02L228.8,281.89L229.16,285.54L229.32,291.1L229.77,291.35L227.13,291.48Z"},{"name":"朝阳区","adcode":110105,"x":271.35,"y":278.78,"d":"M289.05,263.77L284.98,261.48L285.2,260.2L283.29,260.35L281.86,258.69L278.77,257.35L277.8,256.56L279.23,255.2L279,254.07L278.08,253.4L277.03,254.16L275.01,252.46L273.08,251.42L270.32,251.63L268.67,250.73L266.96,249.34L264.05,249.19L263.2,248.57L261.04,248.15L260.46,247.27L259.5,247.09L259.37,248.89L258.36,249.24L258.53,250.17L257.66,250.39L257.62,251.64L258.42,252.34L257.8,254.02L255.97,253.72L256.01,254.31L254,253.72L251.8,253.5L247.75,254.94L246.37,255.02L245.57,256.37L246.2,257.86L245.37,258.85L243.09,259.35L242.55,258.21L242.02,258.32L241.92,259.39L243.04,260.25L239.28,260.64L232.89,261.66L238.78,269.41L239.85,272.85L239.78,274.06L242.81,274.02L242.82,274.82L241.89,275.04L241.33,276.76L241.75,276.25L245.97,276.47L245.89,273.76L246.71,274.34L246.78,275.84L247.42,276.47L249.87,276.45L250.82,277.6L250.93,279.23L252.59,279.44L252.29,278.78L253.86,279.34L253.47,280.35L254.8,280.14L254.19,282.33L254.19,284.17L252.04,284.16L252.19,287.54L252.54,290.28L255.35,290L254.91,290.74L254.99,292.08L255.84,292.1L255.86,292.98L254.28,293.03L254.64,295.5L254.18,296.98L254.03,298.53L254.8,299.73L255.22,299.09L256.61,300.07L257.03,299.65L258.7,300.79L259.72,300.84L258.01,302.54L255.9,301.76L255.75,302.52L254.72,302.61L254.88,303.54L253.88,303.67L253.48,304.6L252.6,304.21L251.52,306.14L249.95,306.38L251.06,306.79L252.65,306.66L252.58,307.4L254.7,307.57L254.24,308.89L256.27,308.42L258.57,310.04L259.88,310.37L261.21,311.46L263.73,310.78L263.82,309.82L266.05,309.39L266.7,310.1L268.45,309.6L267.76,309.34L269.44,308.78L269.55,307.36L270.83,306.85L272.94,306.87L273.05,307.52L275.14,308L275.87,307.23L274.73,306.19L276.91,306.77L277.14,305.65L280.57,305.74L283.04,306.01L284.82,306.66L284.9,307.38L287.09,307.22L286.34,307.98L288.14,308.22L288.11,307.65L289.89,307.83L289.84,306.43L290.58,306.43L290.51,304.35L291.99,303.02L291.14,303.11L291.03,302.21L293.16,302.18L296.26,299.77L294.66,297.87L295.79,295.97L295.65,295.07L296.72,294.97L296.4,292.93L293.65,293.09L293.58,291.78L294.89,291.01L295.43,289.77L294.72,288.99L295.35,287.57L294.88,285.44L297.09,285.77L295.61,283.86L296.8,283.56L296.88,281.86L297.75,281.36L297.07,280.15L297.47,279.14L300.46,280.19L299.96,278.58L299.67,274.78L299.21,271.78L297.88,271.99L297.79,270.96L299.05,270.8L299.33,270.05L300.11,270.18L299.87,268.54L298.7,267.25L297.58,267.83L295.98,267.08L296.53,266.04L294.64,265.09L290.37,264.61L289.05,263.77ZM290.92,255.64L292,255.19L290.87,247.87L290.74,246.24L289.7,243.95L289.77,246.33L289.13,247.08L285.56,247.51L285.09,244.21L284.12,243.04L284.18,245.73L285.05,250.24L285.8,252.22L285.8,250.85L286.99,250.73L287.8,254.9L287.31,256.19L288.05,255.9L288.23,257.89L290.03,258.29L289.94,256.96L290.44,256.85L289.73,255.73L290.92,255.64Z"},{"name":"丰台区","adcode":110106,"x":212.85,"y":306.92,"d":"M211.82,291.51L210.4,291.58L205.95,292.55L206.21,293.14L204.63,293.25L204.62,294.46L203.52,294.42L202.74,295.03L202.64,296.09L200.76,295.78L201.03,296.56L200.12,296.69L199.3,295.36L198.12,294.58L196.04,294.99L193.46,294.72L190.69,293.33L189.84,293.76L188.19,293.26L187,294.41L186.23,294.12L182.57,295.05L181.25,295.81L179.83,295.92L178.11,296.89L176.55,297.05L176.25,297.9L174.34,297.85L172.36,298.52L170.33,297.56L168.52,297.99L167.81,298.61L168.46,299.83L168.64,301.37L165.33,302L164.89,303.15L166.46,304.08L168.18,304.34L169.84,305.2L170.39,306.45L171.71,307.14L172.03,306.32L172.95,306.88L172.6,307.52L172.91,309.95L172.13,309.94L171.82,311.04L172.35,312.94L172,314.77L173.45,316.47L173.37,317.35L174.07,317.93L175.62,316.97L176.91,317.07L176.76,316.31L179.84,316.07L180.07,317.18L181.05,317.06L182.53,317.57L182.78,318.61L181.61,318.51L180.89,319.04L180.23,318.51L179.32,319.81L180.23,322.51L181.84,322.33L183.06,321.36L186.33,321.39L186.53,320.9L188.15,321.29L189.69,320.77L191.3,317.31L194.35,317.44L194.44,318.24L195.5,317.88L196.97,318.16L196.98,318.64L198.34,318.71L198.68,316.39L198.68,313.78L200.11,312.24L199.96,311.22L202.1,309.82L201.57,309.34L201.5,308.03L204.5,307.95L204.75,307.46L207.35,307.53L208.13,307.93L208.42,309.44L210.11,310.65L210.56,312.04L209.95,313.37L210.08,315.29L211.87,314.25L212.53,315.36L215.29,314.4L218.28,313.91L218.73,314.64L220.31,314.72L219.18,315.24L220.11,315.78L221.56,319.45L222.83,320.57L223.66,320.11L225.34,317.5L226.21,317.46L226.46,314.07L227.37,314.07L227.69,313.37L230.42,313.21L230.79,311.96L234,312.4L234.25,313.59L236.6,313.74L236.86,314.89L236.3,315.04L236.72,317.15L239.22,316.99L239.39,318.43L240.86,318.55L242.02,318.18L242.3,321.67L243.91,321.54L243.68,318.05L243.25,316.74L248.81,316.58L248.99,315.05L250.88,315.05L250.91,312.88L250.07,312.47L249.32,311.3L248.24,311.37L247.67,310.82L246.46,311.1L246.49,309.79L248.7,310.17L248.4,308.44L247.47,308.13L247.79,306.94L248.77,307.59L249.95,306.38L251.52,306.14L252.6,304.21L253.48,304.6L253.88,303.67L254.88,303.54L254.72,302.61L255.75,302.52L255.9,301.76L258.01,302.54L259.72,300.84L258.7,300.79L257.03,299.65L256.61,300.07L255.22,299.09L254.8,299.73L254.03,298.53L254.18,296.98L253.93,297.2L249.49,296.98L247.3,297.37L247.81,299.09L247.02,300.17L245.74,299.94L243.13,300.23L243,299.3L241.38,298.24L239.72,298.54L239.71,297.37L232.82,297.93L232.56,296.81L231.37,296.79L230.75,296.22L229.31,296.44L227.32,296.06L226.1,296.44L225.97,294.99L227.14,292.79L227.13,291.48L224.43,291.49L221.85,292.6L220.07,293.77L220.06,291.55L213.45,291.61L211.82,291.51Z"},{"name":"石景山区","adcode":110107,"x":194.36,"y":283.71,"d":"M190.69,293.33L193.46,294.72L196.04,294.99L198.12,294.58L199.3,295.36L200.12,296.69L201.03,296.56L200.76,295.78L202.64,296.09L202.74,295.03L203.52,294.42L204.62,294.46L204.63,293.25L206.21,293.14L205.95,292.55L210.4,291.58L211.82,291.51L210.42,291.45L210.42,287.17L209.96,286.19L206.91,286.51L205.7,286.86L205.35,286.26L199.81,286.92L200.02,284.8L201.86,284.52L201.25,284.11L201.97,283.58L201.28,283.12L201.99,282.39L201.81,280.7L201.2,279.51L198.51,276.72L196.13,275.74L196.12,275.08L195,274.62L194.88,272.85L195.18,271.49L193.41,270.48L193.21,271.87L191.71,273.07L191.19,272.53L190.65,270.65L188.64,271.43L188.18,270.29L187.14,269.3L185.56,270.27L179.65,270.98L178.39,272.03L179.11,274.24L180.57,275.24L180.06,276.7L178.8,277.49L179.9,279.09L178.64,279.45L178.04,280.89L179.86,283.23L180.99,282.73L181.69,283.78L181.58,284.64L182.25,285.12L184.32,285.67L186.06,288.43L187.42,289.22L187.58,290.52L189.33,291.48L190.69,293.33Z"},{"name":"海淀区","adcode":110108,"x":205.48,"y":259.27,"d":"M227.13,291.48L229.77,291.35L229.32,291.1L229.16,285.54L228.8,281.89L227.63,281.02L228.76,280.63L230.72,281.11L233.24,280.69L233.15,279.07L234.11,280.63L237.73,279.59L237.36,275.16L239.66,275.1L239.78,274.06L239.85,272.85L238.78,269.41L232.89,261.66L239.28,260.64L243.04,260.25L241.92,259.39L242.02,258.32L240.76,257.96L238.86,257.98L238.68,257.36L237.18,257.01L236.68,255.53L237.96,255.32L237.8,254.51L239.4,254.25L240.23,253.66L240.01,252.55L238.05,252.73L237.86,252.09L235.7,251.96L235.68,252.66L234.36,252.64L231.92,253.18L231.99,253.92L231,254.1L231.16,255.07L230.45,255.15L230.12,254.27L228.27,253.24L228.51,254.67L227.16,255.21L225.41,253.64L223.38,253.88L222.59,253.32L221.88,253.84L218.99,248.71L216.59,249.49L215.03,246.51L215.09,245.86L213.23,246.06L211.63,244.49L212.92,243.92L212.79,242.41L211.57,242.1L211.93,243.25L211.08,243.81L210.36,243.34L208.8,243.61L207.55,243L208.21,241.79L207.86,240.61L208.59,240.52L209.05,236.53L206.01,236.44L201.8,234.93L201.06,235.53L199.7,234.95L199.55,233.32L198.99,232.5L198.75,230.84L196.94,231.05L196.43,232.06L194.28,231.5L194.37,232.6L193.76,233.98L192.32,234.83L190.84,235.23L191.05,236.7L191.78,238.43L190.77,238.31L191.27,239.2L187.4,239.84L182.86,239.94L182.7,241.38L181.65,241.08L178.36,241.26L176.65,240.7L175.82,241.17L174.4,239.96L172.96,240.4L171.73,240.19L170.23,241.38L169.3,241.3L169.03,242.71L168.29,243.71L166.79,244.19L166.57,244.94L165.18,245.66L164.25,246.75L163.57,248.21L164.13,248.43L164.88,249.84L167.04,251.03L167.26,252.31L168.67,253.55L167.97,255.87L169.59,258.63L170.29,260.27L171.68,260.7L174.17,260.5L174.93,260.03L176.56,260.4L178.64,260.22L180.72,260.99L182.09,260.65L184.51,261.2L186.61,262.71L188.46,262.96L189.98,263.94L190.17,264.5L192.59,266.32L191.85,267.65L189.45,267.8L187.82,268.42L187.14,269.3L188.18,270.29L188.64,271.43L190.65,270.65L191.19,272.53L191.71,273.07L193.21,271.87L193.41,270.48L195.18,271.49L194.88,272.85L195,274.62L196.12,275.08L196.13,275.74L198.51,276.72L201.2,279.51L201.81,280.7L201.99,282.39L201.28,283.12L201.97,283.58L201.25,284.11L201.86,284.52L200.02,284.8L199.81,286.92L205.35,286.26L205.7,286.86L206.91,286.51L209.96,286.19L210.42,287.17L210.42,291.45L211.82,291.51L213.45,291.61L220.06,291.55L220.07,293.77L221.85,292.6L224.43,291.49L227.13,291.48Z"},{"name":"门头沟区","adcode":110109,"x":109.25,"y":271.26,"d":"M187.14,269.3L187.82,268.42L189.45,267.8L191.85,267.65L192.59,266.32L190.17,264.5L189.98,263.94L188.46,262.96L186.61,262.71L184.51,261.2L182.09,260.65L180.72,260.99L178.64,260.22L176.56,260.4L174.93,260.03L174.17,260.5L171.68,260.7L170.29,260.27L169.59,258.63L167.97,255.87L168.67,253.55L167.26,252.31L167.04,251.03L164.88,249.84L164.13,248.43L163.57,248.21L162.4,248.63L161.05,248.39L160.14,249.51L159.44,248.93L157.14,250.67L154.14,249.29L153.53,249.47L151.74,248.95L149.23,248.63L147.76,249.05L147.12,249.65L145.13,250.47L144.68,248.38L143.27,246.57L143.65,246.12L143.75,244.3L142.58,244.68L142.41,245.75L141.49,244.6L139.32,244.07L140.39,243.14L137.1,239.14L134.32,236.92L130.9,236.07L130.42,236.55L129.5,235.95L125.17,235.87L123.46,234.77L122.68,234.68L121.4,233.68L119.42,233.94L118.69,233.52L117.09,234.03L114.3,233.31L114.65,234.41L113.11,233.37L111.55,232.76L107.95,232.62L106.92,231.81L104.11,229.01L103.44,228.68L103.46,226.77L100.25,227.35L99.14,229.79L97.77,230.47L95.96,230.32L94.86,232.67L96.08,234.4L94.79,236.18L92.92,237.44L91.32,238.1L89.19,238.23L87.13,237.18L85.48,236.97L83.43,237.4L84.58,238.03L86.02,238.2L86.26,238.66L83.99,238.37L82.85,238.71L81.9,237.51L80.5,237.83L79.17,237.34L78.59,237.74L73.79,238.39L73.11,237.66L70.77,238.72L70.15,240.06L70.57,240.82L68.78,241.21L67.76,240.74L66.28,241.1L65.44,240.54L64.26,240.91L62.14,240.23L60.33,240.25L59.35,241.1L59.26,242.78L58.79,242.5L58.4,245.67L56.87,246.01L55.61,245.67L55.07,244.65L53.14,245.63L52.14,245.32L49.91,246.75L50.31,248.83L49.55,249.6L47.74,250.37L46.28,249.94L43.85,250.33L41.01,252.43L39.81,252.76L39.97,253.35L37.8,255.75L34.9,257.2L35.05,257.75L32.66,259.49L30.33,260.47L28.55,260.41L27.14,260.97L26.58,263.02L24.31,265.29L24.45,266.11L25.92,267.34L26.18,269.34L24.7,269.02L23.08,269.76L21.17,271.39L20.97,272.5L20,274.72L20.81,275.76L20.08,277.96L20.63,279.19L22.84,279.06L23.46,278.68L24.86,278.96L25.42,279.54L26.63,279.69L27.66,280.58L29.42,281.53L31.24,281.85L33.15,282.52L34.66,285.28L36.43,286.63L38.47,287.12L42.2,290.16L42.86,290.99L39.65,294.38L39.88,295L41.4,295.24L43.62,296.33L44.28,296.27L43.86,297.66L42.61,298.05L42.71,300.21L41.24,302.76L40.1,303.35L40.91,304.9L43.66,305.61L44.58,306.83L45.6,306.65L48.23,307.73L48.6,308.49L52.15,309.93L53.48,310.65L55.34,310.82L57.62,310.54L58.51,309.45L59.76,308.77L60.38,307.01L61.57,305.79L62.27,304.31L63.54,303.66L64.29,300.49L65.58,299.18L65.84,298.33L67.65,297.18L69.72,297.28L70.8,296.26L71.75,296.39L73.13,294.76L76.04,294.44L76.84,293.97L78.47,293.83L79.48,292.34L81.03,291.62L81.6,290.81L85.59,289.57L87.98,289.69L88.45,289.18L90.66,288.94L94.71,287.26L94.88,286.69L97.6,285.93L99.41,284.95L100.53,286.02L104.8,285.96L105.83,285.66L108.01,286.23L108.99,287.58L110.76,287.54L112.62,288.32L114.5,290.84L115.34,290.6L116.83,291.42L120.42,290.43L122.12,289.47L123.22,287.88L124.54,287.08L127.12,286.78L130.3,287.53L135.79,287.47L137.63,286.67L138.84,286.73L139.88,288.23L139.72,290.32L137.61,291.15L134.41,294.38L135.69,296.21L140.83,297.34L141.82,298.37L143.47,298.12L144.96,297.16L145.17,298.16L146.97,298.03L146.9,297.52L150.09,296.18L151.72,296.45L150.71,298.24L149.32,298.85L149.63,299.96L148.74,302.43L150.35,304.47L154.16,302.34L156.18,302.4L156.56,304.17L157.17,304.37L159.3,303.72L159.94,303.16L161.95,303.4L162.87,302.84L164.89,303.15L165.33,302L168.64,301.37L168.46,299.83L167.81,298.61L168.52,297.99L170.33,297.56L172.36,298.52L174.34,297.85L176.25,297.9L176.55,297.05L178.11,296.89L179.83,295.92L181.25,295.81L182.57,295.05L186.23,294.12L187,294.41L188.19,293.26L189.84,293.76L190.69,293.33L189.33,291.48L187.58,290.52L187.42,289.22L186.06,288.43L184.32,285.67L182.25,285.12L181.58,284.64L181.69,283.78L180.99,282.73L179.86,283.23L178.04,280.89L178.64,279.45L179.9,279.09L178.8,277.49L180.06,276.7L180.57,275.24L179.11,274.24L178.39,272.03L179.65,270.98L185.56,270.27L187.14,269.3Z"},{"name":"房山区","adcode":110111,"x":122.51,"y":337,"d":"M164.89,303.15L162.87,302.84L161.95,303.4L159.94,303.16L159.3,303.72L157.17,304.37L156.56,304.17L156.18,302.4L154.16,302.34L150.35,304.47L148.74,302.43L149.63,299.96L149.32,298.85L150.71,298.24L151.72,296.45L150.09,296.18L146.9,297.52L146.97,298.03L145.17,298.16L144.96,297.16L143.47,298.12L141.82,298.37L140.83,297.34L135.69,296.21L134.41,294.38L137.61,291.15L139.72,290.32L139.88,288.23L138.84,286.73L137.63,286.67L135.79,287.47L130.3,287.53L127.12,286.78L124.54,287.08L123.22,287.88L122.12,289.47L120.42,290.43L116.83,291.42L115.34,290.6L114.5,290.84L112.62,288.32L110.76,287.54L108.99,287.58L108.01,286.23L105.83,285.66L104.8,285.96L100.53,286.02L99.41,284.95L97.6,285.93L94.88,286.69L94.71,287.26L90.66,288.94L88.45,289.18L87.98,289.69L85.59,289.57L81.6,290.81L81.03,291.62L79.48,292.34L78.47,293.83L76.84,293.97L76.04,294.44L73.13,294.76L71.75,296.39L70.8,296.26L69.72,297.28L67.65,297.18L65.84,298.33L65.58,299.18L64.29,300.49L63.54,303.66L62.27,304.31L61.57,305.79L60.38,307.01L59.76,308.77L58.51,309.45L57.62,310.54L55.34,310.82L53.48,310.65L52.81,311.45L52.86,312.64L51.88,312.85L50.17,314.71L46.63,314.9L45.91,315.51L40.75,316.3L39.58,317.35L36.97,315.75L35.83,314.6L33.73,314L32.04,315.58L27.89,317.8L26.73,317.84L24.58,316.99L22.45,317.77L21.78,319.26L20.41,319.81L20.83,320.64L21.72,320.11L22.76,320.6L22.52,322L23.61,324.56L27.88,326.34L29.94,327.37L30.82,326.92L33.52,326.9L35.77,327.73L35.02,329.04L35.57,333.27L36.07,334.93L35.34,336.33L35.89,336.26L37.41,337.53L37.53,338.66L36.75,339.94L36.3,339.76L35.01,340.87L35.22,341.7L34.53,342.77L35.59,343.84L33.58,345.14L32.52,347.16L32.65,348.05L36.35,348.31L36.84,347.54L39.12,347.64L40.22,349.42L41.22,350.14L42.73,350.43L42.27,351.94L42.56,354.49L42.95,354.93L40.88,356.51L40.36,358.43L41.24,361.63L41.9,361.2L41.78,360.26L43.14,359.85L44.6,358.95L45.36,357.63L45.22,356.98L46.56,355.87L48.13,355.3L49.49,356.38L50.09,357.45L52.4,358.32L53.02,359.69L54.54,360.4L54.08,361.54L57.35,362.04L58.8,360.38L60.24,360.12L60.48,359.41L61.75,359.6L63.4,359.35L64.77,358.67L66.49,359.75L68.01,360.14L68.5,358.72L70.08,358.84L70.54,359.85L72.07,359.38L73.68,359.59L75.52,358.38L76.05,357.39L76.02,356.11L77.35,357.65L80.12,358.76L81.03,359.83L81.02,361.23L82.16,362.41L81.98,364.12L83.01,364.37L83.16,366.36L82.2,366.63L81.67,367.46L83.19,368.04L85.82,368.1L87.41,368.7L88.13,369.99L88.45,372.58L89.67,372.48L89.63,371.51L92.47,372.15L92.39,373.54L93.01,374.23L93.57,376.42L95.54,379.01L97.13,379.37L98.48,379.15L99.26,380.52L99.74,380.04L98.96,378.92L101.06,379.64L101.37,379.39L103,380.18L104.76,380.09L111.37,380.38L113.03,380.94L113.21,379.6L111.52,379.31L110.98,378.31L112.05,378.25L111.98,377.42L110.99,376.84L110.85,375.5L111.66,375.55L112.02,374.71L112.96,374.42L113.03,373.08L116.12,373.02L117.01,372.62L117.36,371.02L118.23,370.98L119.18,369.94L120.68,371.42L121.6,371.12L121.67,371.92L123.04,371.98L123.27,371.35L125.48,371.52L125.63,370.83L126.57,370.93L126.81,369.8L127.8,369.66L127.88,368.36L127.11,366.98L128.48,366.51L131.2,367.21L132.32,365.84L132.1,365.53L132.98,363.52L131.4,363.27L131.61,362.3L130.96,361.9L131.73,359.42L132.26,359.8L134.85,360.23L134.94,361.02L136.33,361.13L136.28,361.92L137.24,362.34L137.42,363.78L138.14,363.81L138.1,364.78L139.31,364.8L139.28,365.42L140.68,365.74L140.97,367.33L142.01,367.39L142.61,368.58L143.95,367.53L144.91,367.73L145.21,366.26L146.51,366.3L147.33,365.84L147.09,361.69L147.4,360.6L150.28,361.03L150.22,362.71L151.65,363.46L151.25,364.87L154.1,364.84L154.78,363.5L155.49,363.5L155.57,362.34L157.09,362.82L158.37,362.5L158.03,365.21L159.89,365.44L159.91,365.96L161.35,366.05L175.03,365.31L175.76,365.08L175.62,364.19L176.63,364.99L176.74,366.27L178.47,366.34L179.12,365.57L180.23,365.36L180.24,366.37L182.26,366.62L182.27,367.01L184.12,366.75L184.2,366.25L186.69,365.78L187.19,363.41L190.34,363.38L192.96,362.84L192.99,361.9L194.68,361.69L196.14,362.04L196.09,362.5L197.53,362.13L197.43,362.8L198.65,362.73L199.69,363.46L200.12,364.72L203.12,364.45L204.01,363.26L204.24,361.44L203.44,361L203.57,360.24L202.41,357.75L202.73,355.26L202.59,353.18L201.81,349.73L202.16,347.77L203.57,344.75L203.15,344.12L204.14,342.72L203.13,341.6L205.36,338.41L206.14,335.78L205.59,335.27L206.66,333.7L208.59,332.43L208.76,331.13L209.38,330.22L209.28,329.16L208.34,327.09L210.17,325.38L210.3,323.19L210.75,322.14L210.3,320.18L210.6,318.4L210.1,317.71L210.08,315.29L209.95,313.37L210.56,312.04L210.11,310.65L208.42,309.44L208.13,307.93L207.35,307.53L204.75,307.46L204.5,307.95L201.5,308.03L201.57,309.34L202.1,309.82L199.96,311.22L200.11,312.24L198.68,313.78L198.68,316.39L198.34,318.71L196.98,318.64L196.97,318.16L195.5,317.88L194.44,318.24L194.35,317.44L191.3,317.31L189.69,320.77L188.15,321.29L186.53,320.9L186.33,321.39L183.06,321.36L181.84,322.33L180.23,322.51L179.32,319.81L180.23,318.51L180.89,319.04L181.61,318.51L182.78,318.61L182.53,317.57L181.05,317.06L180.07,317.18L179.84,316.07L176.76,316.31L176.91,317.07L175.62,316.97L174.07,317.93L173.37,317.35L173.45,316.47L172,314.77L172.35,312.94L171.82,311.04L172.13,309.94L172.91,309.95L172.6,307.52L172.95,306.88L172.03,306.32L171.71,307.14L170.39,306.45L169.84,305.2L168.18,304.34L166.46,304.08L164.89,303.15Z"},{"name":"通州区","adcode":110112,"x":316.75,"y":311.01,"d":"M318.88,354.08L319.96,354.34L320.03,355.21L321.72,356.08L323.12,355.75L324.2,355.03L327.4,356.44L330.06,358.36L330.21,359.8L330.97,361.13L332.55,361.1L332.64,360.48L333.84,360.51L333.54,359.01L334.33,359.11L333.68,357.19L336.45,356.78L338.21,356.27L340.46,355.25L341.48,355.66L341.72,356.42L344.1,355.7L343.81,354.67L344.8,354.5L342.03,352L342.62,351.54L342.15,350.83L343.91,350L343.68,349.48L345.33,349.45L344.96,348.7L347.78,347.48L347.44,344.1L349.86,344.17L350.66,343.45L352.77,343.22L355.08,342.31L356.9,342.6L360.46,341.84L360.12,340.87L361,340.59L359.6,338.82L356.61,339.49L356.13,338.73L357.41,338.22L357.52,337.6L355.8,335.05L355.97,333.37L354.98,332.41L356.08,330.8L358.88,330.65L359.46,329.9L361.58,329.42L362.76,329.46L362.69,328.42L361.9,328.46L361.39,327.24L362.25,327.07L361.96,326.1L360.58,323.81L359.29,323.98L359.35,322.05L360.83,321.34L361.37,322.36L363.73,320.79L362.72,319.22L363.92,318.15L366.69,317.88L367.95,317.98L369.44,318.89L370.35,318.63L369.95,317.06L371.28,316.9L370.6,315.64L367.72,315.28L366.92,313.44L368.77,313.31L365.77,311.09L365.4,310.45L365.56,308.9L364.88,305.57L362.93,302.93L361.31,302.08L359.58,302.63L359.6,304.21L360.67,305.87L359.7,306.66L358.36,306.22L355.64,303.47L353.95,303.32L354.03,304L352.39,304.04L351.14,303.62L351.01,302.93L349.36,302.58L348.04,300.14L346.82,300.25L345.02,298.6L344.45,298.84L342.24,296.01L341.41,295.53L339.88,295.65L338.99,295.04L338.8,293.11L337.88,293.13L337.87,294.21L336.95,294.22L336.93,295.81L334.77,295.05L333.01,293.77L332.47,292.72L332.36,290.24L331.88,288.35L331.93,284.26L332.15,282.47L331.98,279.83L331.52,279.33L327.44,277.89L326.18,276.63L326.71,274.69L328.27,273.22L328.35,271.86L330.32,269.45L330.41,267.12L329.2,265.12L329.49,264.47L327.9,264.11L325.26,264.14L324.91,263.21L323.82,262.75L323.83,261.97L321.55,261.45L320.45,262.03L320.38,262.69L318.72,262.22L318.58,262.91L317.55,262.63L317.01,263.29L316.77,262.34L315,261.69L313.93,263.17L312.39,264.1L309.71,263.99L310.36,265.69L309.88,265.89L309.3,264.47L308.08,264.34L305.82,264.59L304.92,263.42L303.87,262.82L302.84,263.53L301.93,262.76L301.82,261.88L298.37,263.27L297.76,262.36L296.28,262.86L295.63,262.36L294.68,262.63L294.52,261.66L293.32,261.32L293.3,260.5L292.38,260.63L290.7,261.25L290.26,263.46L289.05,263.77L290.37,264.61L294.64,265.09L296.53,266.04L295.98,267.08L297.58,267.83L298.7,267.25L299.87,268.54L300.11,270.18L299.33,270.05L299.05,270.8L297.79,270.96L297.88,271.99L299.21,271.78L299.67,274.78L299.96,278.58L300.46,280.19L297.47,279.14L297.07,280.15L297.75,281.36L296.88,281.86L296.8,283.56L295.61,283.86L297.09,285.77L294.88,285.44L295.35,287.57L294.72,288.99L295.43,289.77L294.89,291.01L293.58,291.78L293.65,293.09L296.4,292.93L296.72,294.97L295.65,295.07L295.79,295.97L294.66,297.87L296.26,299.77L293.16,302.18L291.03,302.21L291.14,303.11L291.99,303.02L290.51,304.35L290.58,306.43L289.84,306.43L289.89,307.83L288.11,307.65L288.14,308.22L286.34,307.98L287.09,307.22L284.9,307.38L284.82,306.66L283.04,306.01L280.57,305.74L277.14,305.65L276.91,306.77L274.73,306.19L275.87,307.23L275.14,308L276.2,308.75L274.78,309.19L276.42,310.98L276.68,312.97L275.18,313.67L275.73,314.46L274.22,315.6L274.67,316.79L275.86,318L274.02,318.56L275.41,320.61L277.36,320.06L277.63,320.88L275.49,320.95L276.27,321.45L276.39,322.64L273.61,322.55L272.54,320.6L271.72,321.55L272.9,322.33L272.4,325.25L274.27,325.74L273.44,326.71L275.43,327.32L275.84,327.91L274.56,327.56L274.43,329.76L275.8,330.22L275.6,331.71L275.06,332.5L273.86,332.11L273.39,332.85L274.59,333.14L274.13,333.61L275.31,333.93L277.44,333.2L283.94,333.32L283.98,334.56L285.45,334.3L285.76,333.78L287.81,333.59L287.82,334.01L289.7,333.91L290.99,333.27L291.12,332.35L292.17,332.21L293.8,330.78L295.09,330.73L295.04,330.21L296.53,330.28L297.23,331.38L298.71,331.16L298.91,332.71L300.3,334.44L302.23,334.67L302.26,335.78L301.07,335.83L300.69,336.55L300.88,337.85L301.89,337.93L301.85,339.44L303.41,339.83L303.42,339.28L305.35,339.61L306.04,340.41L305.22,341.31L305.81,342.48L307.33,342.11L308.61,342.42L309.71,341.96L311.35,341.98L311.54,342.4L313.89,342.59L314.14,344.18L313.51,346.38L313.69,348.15L314.42,349.76L315.42,350.5L316.7,350.34L318.42,350.65L317.94,352.86L318.88,354.08Z"},{"name":"顺义区","adcode":110113,"x":316.23,"y":234.96,"d":"M329.49,264.47L330.81,261.55L330.89,260.34L331.74,259.8L333.73,259.88L333.57,260.37L336.04,261.17L336.75,260.41L339.49,260.7L340.57,261.28L340.76,258.89L341.29,258.65L341.2,257.13L343.26,256.66L343.21,256.04L347.34,255.87L347.5,255.17L349.25,255.88L351.55,258.18L352.88,258.26L354.51,257.2L356.7,257.24L359.25,256.84L360.41,255.99L362.2,255.72L363.06,257.53L364.48,256.9L365.38,255.18L366.21,255.85L367.84,256.11L367.57,257.02L369.26,256.63L369.32,258.28L373.15,256L373.23,253.21L375.15,253.15L375.8,252.57L376.97,252.9L377.48,251.45L377.95,251.57L378.73,249.81L377.57,249.09L377.72,247.17L377.28,246.25L376.25,245.97L374.53,244.56L375.76,243.99L376.39,242.27L375.3,241.62L374.81,240.53L375.36,239.28L374.03,238.45L374.5,237.99L375,235.58L376.78,233.05L375.47,231.92L374.71,230.26L372.99,228.33L373.17,227.5L370.72,227.67L369.34,226.18L369.45,225.05L370.4,225.02L369.47,223.46L368.01,223.64L366.02,220.26L365.74,219.23L367.66,219.46L368.34,216.39L367.01,215.03L366.06,214.86L364.77,215.97L363.99,217.26L362.49,216.77L362.13,217.27L360.91,216.74L360.45,215.3L359.09,215.28L357.54,214.21L359.33,213.43L357.63,212.7L357.15,211.39L355.85,209.97L355.74,209.2L354.63,208.29L354.32,207.16L353.02,206.21L353.5,204.82L352.44,203.18L352.35,201.01L349.63,201.03L349.1,200.56L348.5,198.21L347.22,196.36L344.79,196.59L342.63,197.92L342.89,199.11L342.22,199.31L341.62,201L341.74,202.29L338.69,202.97L338.18,202.14L336.11,201.41L334.71,201.82L333.23,201.36L333.18,203.19L332.32,203.65L332.07,205.07L329.9,205.93L329.47,206.62L328.77,205.79L327.41,206.03L325.14,204.55L322.89,203.73L321.82,203.81L322.46,202.83L321.97,202.58L321.84,202.51L315.51,208.98L314.1,208.78L314.08,210.05L312.23,210.85L312.4,211.97L310.89,212.5L309.35,214.02L308,213.99L307.59,213.02L306.19,213.88L305.86,213.04L306.9,211.15L306.02,209.68L305.43,207.63L301.21,208.08L299.96,208.77L299.59,208.24L298.57,208.47L298.16,207.78L295.5,207.98L295.53,209.8L295.13,210.3L293.11,210L290.94,210.1L291.13,209L290.24,208.35L289.99,206.88L287.97,207.16L287.41,205.94L286.68,206.68L286.06,206.19L283.23,206.08L283.3,205.11L282.12,205.04L282.31,203.98L279.09,204.94L277.73,204.39L276.51,204.68L275.59,204.17L276.32,206.47L275.31,207.8L273.13,207.81L272.62,208.68L269.23,208.56L268.48,207.8L267.81,208.18L267.35,210.04L265.67,210.14L263.01,211.47L262.78,213.11L263.39,216.1L262.06,216.1L261.08,217.02L260.75,220.72L263.56,222.69L264.37,223.77L264.36,225.4L264.85,226.17L263.71,227.22L263.29,228.37L262.71,228.33L261.82,230.25L262.05,231.07L263.59,230.96L265.35,231.76L265,233.59L262.7,233.95L263.06,235.51L263.62,235.64L264.18,239.17L265.33,242.19L264.66,244.46L262.73,245.54L261,245.41L259.43,246L259.5,247.09L260.46,247.27L261.04,248.15L263.2,248.57L264.05,249.19L266.96,249.34L268.67,250.73L270.32,251.63L273.08,251.42L275.01,252.46L277.03,254.16L278.08,253.4L279,254.07L285.05,250.24L284.18,245.73L284.12,243.04L285.09,244.21L285.56,247.51L289.13,247.08L289.77,246.33L289.7,243.95L290.74,246.24L290.87,247.87L292,255.19L290.92,255.64L292.38,260.63L293.3,260.5L293.32,261.32L294.52,261.66L294.68,262.63L295.63,262.36L296.28,262.86L297.76,262.36L298.37,263.27L301.82,261.88L301.93,262.76L302.84,263.53L303.87,262.82L304.92,263.42L305.82,264.59L308.08,264.34L309.3,264.47L309.88,265.89L310.36,265.69L309.71,263.99L312.39,264.1L313.93,263.17L315,261.69L316.77,262.34L317.01,263.29L317.55,262.63L318.58,262.91L318.72,262.22L320.38,262.69L320.45,262.03L321.55,261.45L323.83,261.97L323.82,262.75L324.91,263.21L325.26,264.14L327.9,264.11L329.49,264.47ZM285.05,250.24L279,254.07L279.23,255.2L277.8,256.56L278.77,257.35L281.86,258.69L283.29,260.35L285.2,260.2L284.98,261.48L289.05,263.77L290.26,263.46L290.7,261.25L292.38,260.63L290.92,255.64L289.73,255.73L290.44,256.85L289.94,256.96L290.03,258.29L288.23,257.89L288.05,255.9L287.31,256.19L287.8,254.9L286.99,250.73L285.8,250.85L285.8,252.22L285.05,250.24Z"},{"name":"昌平区","adcode":110114,"x":200.31,"y":219.74,"d":"M242.02,258.32L242.55,258.21L243.09,259.35L245.37,258.85L246.2,257.86L245.57,256.37L246.37,255.02L247.75,254.94L251.8,253.5L254,253.72L256.01,254.31L255.97,253.72L257.8,254.02L258.42,252.34L257.62,251.64L257.66,250.39L258.53,250.17L258.36,249.24L259.37,248.89L259.5,247.09L259.43,246L261,245.41L262.73,245.54L264.66,244.46L265.33,242.19L264.18,239.17L263.62,235.64L263.06,235.51L262.7,233.95L265,233.59L265.35,231.76L263.59,230.96L262.05,231.07L261.82,230.25L262.71,228.33L263.29,228.37L263.71,227.22L264.85,226.17L264.36,225.4L264.37,223.77L263.56,222.69L260.75,220.72L261.08,217.02L262.06,216.1L263.39,216.1L262.78,213.11L263.01,211.47L265.67,210.14L267.35,210.04L267.81,208.18L268.48,207.8L267.54,207.43L265.57,207.54L263.51,206.36L263.44,204.46L262.25,203.52L260.71,203.49L260.15,202.83L258.01,201.89L256.86,202.41L255.5,201.98L255.86,200.53L255.18,198.82L254.21,198.37L255.23,197.56L256.83,195.18L255.45,194.08L254.2,193.73L252.94,191.31L252.02,192.25L250.57,192.23L249.75,191.76L248.08,192.08L246.23,191.31L246.14,190.92L243.33,190.93L242.19,190.12L240.62,189.97L238.44,190.35L238.68,191.05L236.34,191.65L236.87,190.94L237.25,189.2L236.02,187.66L236.61,187.37L237.2,185.99L235.88,185.38L233.98,185.89L232.43,185.98L233.33,184.15L234.37,184.22L234.99,183.6L233.92,182.55L231.55,182.14L229.79,180.62L226.71,178.89L225.98,178.99L224.22,178.4L221.83,178.85L220.19,179.55L219.78,177.72L218.88,177.89L219.08,179.84L217.27,181.66L214.52,179.95L212.32,180.44L211.65,179.84L210.51,180.28L210.22,181.42L209.23,181.84L208.25,180.61L207.89,181.14L206.67,181.16L205.56,181.72L204.45,180.31L203.36,180.08L200.88,180.17L200.35,181.43L196.65,182.23L193.75,183.39L193.01,182.65L191.53,183.01L191.09,183.62L188.91,183.72L186.37,184.74L186.47,185.86L185.75,187.21L186.94,187.63L188.08,188.62L187.38,190.27L185.57,190.52L186.21,189.6L185.58,187.79L184.12,188.55L184.67,189.05L183.92,189.57L183.94,190.55L185.38,190.65L184.04,191.82L184.11,193.27L184.93,195.06L182.82,196.18L180.44,195.99L179.03,193.89L179.12,193.5L177.68,191.86L175.99,191.7L174.99,192.04L172.17,191.86L171.48,190.73L170.19,189.9L169.2,189.79L168.05,190.45L166.53,190.48L164.59,192.77L165.43,193.84L164.08,195.3L162.1,195.06L161.55,196.01L159.5,196.1L158.35,194.23L158.43,193.36L156.21,190.98L154.09,191.32L152.13,193.09L150.83,192.28L148.38,193.38L147.68,194.22L146.21,194.57L146.93,196.29L146.73,196.94L149.58,198.06L150.13,199.05L148.38,199.4L147.45,201.31L148.04,202.32L147.49,203.15L148.17,204.23L146.93,205.59L144.77,206.82L145.21,207.13L144.45,208.25L143.17,208.88L140.93,208.99L139.2,209.59L137.62,209.13L133.29,211.08L133.21,212.15L132.14,213.97L130.93,214.05L128.95,213.53L129.04,213.96L127.56,215.42L127.41,216.06L125.52,218.19L125.97,219.12L125.53,219.68L126.26,220.36L124.19,221.69L123.96,223.28L123.36,223.56L122.58,225.08L120.92,225.08L119.18,224.44L117.48,225.59L118.88,226.49L117.2,228.9L116.64,229.23L117.17,230.34L118.73,232.41L118.69,233.52L119.42,233.94L121.4,233.68L122.68,234.68L123.46,234.77L125.17,235.87L129.5,235.95L130.42,236.55L130.9,236.07L134.32,236.92L137.1,239.14L140.39,243.14L139.32,244.07L141.49,244.6L142.41,245.75L142.58,244.68L143.75,244.3L143.65,246.12L143.27,246.57L144.68,248.38L145.13,250.47L147.12,249.65L147.76,249.05L149.23,248.63L151.74,248.95L153.53,249.47L154.14,249.29L157.14,250.67L159.44,248.93L160.14,249.51L161.05,248.39L162.4,248.63L163.57,248.21L164.25,246.75L165.18,245.66L166.57,244.94L166.79,244.19L168.29,243.71L169.03,242.71L169.3,241.3L170.23,241.38L171.73,240.19L172.96,240.4L174.4,239.96L175.82,241.17L176.65,240.7L178.36,241.26L181.65,241.08L182.7,241.38L182.86,239.94L187.4,239.84L191.27,239.2L190.77,238.31L191.78,238.43L191.05,236.7L190.84,235.23L192.32,234.83L193.76,233.98L194.37,232.6L194.28,231.5L196.43,232.06L196.94,231.05L198.75,230.84L198.99,232.5L199.55,233.32L199.7,234.95L201.06,235.53L201.8,234.93L206.01,236.44L209.05,236.53L208.59,240.52L207.86,240.61L208.21,241.79L207.55,243L208.8,243.61L210.36,243.34L211.08,243.81L211.93,243.25L211.57,242.1L212.79,242.41L212.92,243.92L211.63,244.49L213.23,246.06L215.09,245.86L215.03,246.51L216.59,249.49L218.99,248.71L221.88,253.84L222.59,253.32L223.38,253.88L225.41,253.64L227.16,255.21L228.51,254.67L228.27,253.24L230.12,254.27L230.45,255.15L231.16,255.07L231,254.1L231.99,253.92L231.92,253.18L234.36,252.64L235.68,252.66L235.7,251.96L237.86,252.09L238.05,252.73L240.01,252.55L240.23,253.66L239.4,254.25L237.8,254.51L237.96,255.32L236.68,255.53L237.18,257.01L238.68,257.36L238.86,257.98L240.76,257.96L242.02,258.32Z"},{"name":"大兴区","adcode":110115,"x":260.05,"y":347.95,"d":"M318.88,354.08L317.94,352.86L318.42,350.65L316.7,350.34L315.42,350.5L314.42,349.76L313.69,348.15L313.51,346.38L314.14,344.18L313.89,342.59L311.54,342.4L311.35,341.98L309.71,341.96L308.61,342.42L307.33,342.11L305.81,342.48L305.22,341.31L306.04,340.41L305.35,339.61L303.42,339.28L303.41,339.83L301.85,339.44L301.89,337.93L300.88,337.85L300.69,336.55L301.07,335.83L302.26,335.78L302.23,334.67L300.3,334.44L298.91,332.71L298.71,331.16L297.23,331.38L296.53,330.28L295.04,330.21L295.09,330.73L293.8,330.78L292.17,332.21L291.12,332.35L290.99,333.27L289.7,333.91L287.82,334.01L287.81,333.59L285.76,333.78L285.45,334.3L283.98,334.56L283.94,333.32L277.44,333.2L275.31,333.93L274.13,333.61L274.59,333.14L273.39,332.85L273.86,332.11L275.06,332.5L275.6,331.71L275.8,330.22L274.43,329.76L274.56,327.56L275.84,327.91L275.43,327.32L273.44,326.71L274.27,325.74L272.4,325.25L272.9,322.33L271.72,321.55L272.54,320.6L273.61,322.55L276.39,322.64L276.27,321.45L275.49,320.95L277.63,320.88L277.36,320.06L275.41,320.61L274.02,318.56L275.86,318L274.67,316.79L274.22,315.6L275.73,314.46L275.18,313.67L276.68,312.97L276.42,310.98L274.78,309.19L276.2,308.75L275.14,308L273.05,307.52L272.94,306.87L270.83,306.85L269.55,307.36L269.44,308.78L267.76,309.34L268.45,309.6L266.7,310.1L266.05,309.39L263.82,309.82L263.73,310.78L261.21,311.46L259.88,310.37L258.57,310.04L256.27,308.42L254.24,308.89L254.7,307.57L252.58,307.4L252.65,306.66L251.06,306.79L249.95,306.38L248.77,307.59L247.79,306.94L247.47,308.13L248.4,308.44L248.7,310.17L246.49,309.79L246.46,311.1L247.67,310.82L248.24,311.37L249.32,311.3L250.07,312.47L250.91,312.88L250.88,315.05L248.99,315.05L248.81,316.58L243.25,316.74L243.68,318.05L243.91,321.54L242.3,321.67L242.02,318.18L240.86,318.55L239.39,318.43L239.22,316.99L236.72,317.15L236.3,315.04L236.86,314.89L236.6,313.74L234.25,313.59L234,312.4L230.79,311.96L230.42,313.21L227.69,313.37L227.37,314.07L226.46,314.07L226.21,317.46L225.34,317.5L223.66,320.11L222.83,320.57L221.56,319.45L220.11,315.78L219.18,315.24L220.31,314.72L218.73,314.64L218.28,313.91L215.29,314.4L212.53,315.36L211.87,314.25L210.08,315.29L210.1,317.71L210.6,318.4L210.3,320.18L210.75,322.14L210.3,323.19L210.17,325.38L208.34,327.09L209.28,329.16L209.38,330.22L208.76,331.13L208.59,332.43L206.66,333.7L205.59,335.27L206.14,335.78L205.36,338.41L203.13,341.6L204.14,342.72L203.15,344.12L203.57,344.75L202.16,347.77L201.81,349.73L202.59,353.18L202.73,355.26L202.41,357.75L203.57,360.24L203.44,361L204.24,361.44L204.01,363.26L203.12,364.45L204.18,366.92L205,367.53L206.62,366.86L206.22,367.89L207.58,367.85L208.13,369.16L208.86,369.44L208.01,370.4L208.93,373.43L208.72,375.64L209.33,375.61L208.92,376.75L208.25,377L208.98,377.95L208.78,379.14L210.62,380.25L211.35,381.3L211.55,382.44L214.17,383.59L215.62,383.66L216.45,384.56L217.35,383.95L222.42,385.04L222.81,386L224.13,387.02L224.6,388.05L225.79,388.66L225.81,389.78L226.97,390.33L227.09,391.06L229.13,392.43L232.72,393.37L232.94,392.77L235.48,392.92L236.77,393.66L238.09,393.57L241.54,393.87L242.3,393.37L244.11,394.03L246.22,393.98L250.05,394.75L252.06,395.7L252.71,394.97L255.72,394.38L255.79,393.43L256.71,393.28L256.56,392.31L255.33,390.57L255.36,388L254.28,387.41L254.29,386.65L252.49,386.48L251.89,387.57L250.67,388.02L249.98,386.86L251.04,386.85L250.44,385.36L249.57,385.97L247,386.67L246.82,385.98L247.8,385.26L248.41,383.35L249.42,383.34L248.46,381.09L246.13,380.72L245.83,379.78L244.81,379.26L244.77,376.39L245.43,376.09L246.74,376.9L249.09,376.8L249.68,377.34L249.47,378.81L249.82,380.33L251.44,380.14L251.74,380.85L254.22,380.29L253.97,378.84L253.43,378.83L253.32,377.2L252.77,376.48L253.57,376.29L256.49,376.48L256.52,375.98L258.98,376.22L258.99,375.3L259.96,374.67L262.11,374.42L262.07,372.64L261.41,372.06L260.45,370.03L261.01,370.37L264.7,370.29L264.77,371.02L269.06,370.84L268.96,368.73L269.55,368.67L269.77,367.53L271.57,367.3L271.8,366.05L273.37,365.82L273.12,364.82L271.8,364.85L271.64,363.77L272.43,362.76L272,361.85L272.87,361.03L272.73,360.4L274.14,359.89L274.2,360.36L276.71,361.1L276.5,359.28L277.24,358.78L277.26,360.41L278.46,360.49L280.23,359.26L281.41,359.21L282.4,358.61L282.29,357.05L283.1,356.91L282.26,355.9L282.25,355.07L285.34,355.09L285.29,354.22L288.23,354.72L288.59,355.34L290.1,355.1L290.57,353.98L291.88,353.94L291.86,355.09L292.77,355.27L293.09,356.44L293.89,356.37L293.94,357.93L294.7,358.02L294.78,359.22L296.57,359.71L298.2,359.62L298.24,358.5L300.53,359.13L300.75,359.81L303.31,359.43L303.11,358.97L304.39,358.41L306.15,358.48L306.13,358.83L310.48,359.95L311.67,359.3L312.2,360.66L312.82,360.65L313.18,361.68L314.2,362.37L319.24,361.2L318.75,360.06L317.23,359.36L317.22,358.91L313.62,357.21L313.19,354.77L314.25,354.68L315.16,355.45L316.73,354.66L318.04,354.61L318.88,354.08Z"},{"name":"怀柔区","adcode":110116,"x":284.63,"y":123.94,"d":"M218.88,177.89L219.78,177.72L220.19,179.55L221.83,178.85L224.22,178.4L225.98,178.99L226.71,178.89L229.79,180.62L231.55,182.14L233.92,182.55L234.99,183.6L234.37,184.22L233.33,184.15L232.43,185.98L233.98,185.89L235.88,185.38L237.2,185.99L236.61,187.37L236.02,187.66L237.25,189.2L236.87,190.94L236.34,191.65L238.68,191.05L238.44,190.35L240.62,189.97L242.19,190.12L243.33,190.93L246.14,190.92L246.23,191.31L248.08,192.08L249.75,191.76L250.57,192.23L252.02,192.25L252.94,191.31L254.2,193.73L255.45,194.08L256.83,195.18L255.23,197.56L254.21,198.37L255.18,198.82L255.86,200.53L255.5,201.98L256.86,202.41L258.01,201.89L260.15,202.83L260.71,203.49L262.25,203.52L263.44,204.46L263.51,206.36L265.57,207.54L267.54,207.43L268.48,207.8L269.23,208.56L272.62,208.68L273.13,207.81L275.31,207.8L276.32,206.47L275.59,204.17L276.51,204.68L277.73,204.39L279.09,204.94L282.31,203.98L282.12,205.04L283.3,205.11L283.23,206.08L286.06,206.19L286.68,206.68L287.41,205.94L287.97,207.16L289.99,206.88L290.24,208.35L291.13,209L290.94,210.1L293.11,210L295.13,210.3L295.53,209.8L295.5,207.98L298.16,207.78L298.57,208.47L299.59,208.24L299.96,208.77L301.21,208.08L305.43,207.63L306.02,209.68L306.9,211.15L305.86,213.04L306.19,213.88L307.59,213.02L308,213.99L309.35,214.02L310.89,212.5L312.4,211.97L312.23,210.85L314.08,210.05L314.1,208.78L315.51,208.98L321.84,202.51L321.97,202.58L325.52,198.09L326.07,198.34L327.46,196.54L329.85,195.27L328.78,194.84L327.45,192.8L326.72,192.77L326.47,191.15L324.84,190.73L323.27,191.19L323.13,189.95L320.21,190.89L320.18,189.97L318.3,189.94L318.51,188.82L319.33,188.25L319.69,186.16L318.94,186.16L319.17,184.89L317.18,184.85L317.58,183.08L316.26,183.18L314.52,181.99L314.66,181.26L316.75,179.62L315.71,178.98L316.2,176.94L316.06,175.62L317.27,175.51L318.4,174.76L318.62,173.87L319.63,173.72L322.47,172.62L320.65,171.77L320.47,171.25L318.89,171.83L318.15,170.51L318.43,167.93L316.79,166.4L317.84,166.57L318.95,166.09L317.45,164.81L317.52,163.18L318.44,162.54L317.44,162.11L316.9,162.88L314.44,162.22L312.72,160.36L312.01,160.66L311.51,158.51L311.53,157.22L314.02,157.83L311.68,156.36L311.5,155.14L312.65,154.57L312.82,152.01L313.27,150.6L315.64,149.24L315.83,147.96L316.98,147.33L315.91,146.15L314.62,145.55L313.36,143.86L313.51,142.59L310.89,141.67L308.95,141.8L307.74,140.52L305.17,140.99L305.84,139.82L308.98,139.99L308.35,138.79L309.89,138.22L312.87,138.43L315.29,137.99L315.43,137.26L316.37,136.8L316.32,134.6L315.08,132.35L315.69,131.93L314.97,131.17L315.6,130.02L314.31,129.38L314.86,128.58L314.53,127.55L313.62,127.14L312.55,125.85L313.33,125.16L314.1,125.46L314.2,123.89L313.47,123.54L313.37,122.51L315.82,120.6L315.58,119L315.92,117.7L315.29,115.7L316.31,114.9L316.06,114.03L316.45,111.7L318.86,110.64L318.9,109.62L321.24,109.03L322.78,108.05L323.93,107.79L324.19,106.99L325.64,106.45L325.91,105.81L327.45,105.64L328.92,106.47L332.3,107L333.02,106.09L332.92,104.75L333.47,104.26L333.79,100.47L332.84,98.85L332.03,96.14L331.55,95.29L332.25,93.89L334.51,96.04L336.66,96.56L338.39,95.84L340.26,95.54L341.99,95.79L343.28,95.34L345.18,93.19L343.96,91L347.56,89.9L347.74,89L349.02,88.86L349.3,88.05L351.46,87.71L350.34,85.8L352.34,85.36L352.81,84.44L354.01,84.73L355.94,83.92L354.39,83.16L354.84,80.91L353.59,79.93L353.46,79.3L352.13,79.21L350.08,78.34L349.89,77.17L348.7,76.03L347.13,75.64L347.04,75.14L345.1,75.21L344.65,74.63L343.28,74.39L342.41,74.73L341.36,74.37L340.74,73.09L339.1,73.05L337.34,74.79L336.55,74.43L336.53,72.41L335.29,71.57L335.34,70.38L330.65,66.17L329.63,66.14L328.95,65.12L327.29,65.62L326.46,65.35L326.68,63.54L324.56,63.12L322.15,61.98L320.01,61.72L319.02,60.94L318.46,59.76L316.9,58.87L316.09,58.82L316.95,56.23L318.15,54.91L316.21,54.46L315.82,53.21L314.68,53.4L313.66,52.83L313.57,51.88L312.15,50.99L310.57,49.48L310.1,46.85L307.96,44.92L307.96,43.77L308.72,42.68L309.65,42.24L309.02,41.41L309.14,38.14L310.95,36.59L310.93,35.28L311.61,35.11L312.76,33.38L312.05,32.43L311.9,30.62L311.04,29.65L311.24,28.89L310.41,28.01L309.09,28.66L307.74,28.45L306.89,27.61L305.04,27.54L303.16,26.48L302.45,25.34L300.96,24.62L299.52,24.87L298.78,24.37L297.15,24.3L295.6,25.76L293.85,26L294.14,27.09L293.17,28.9L293.31,29.97L294.11,30.29L294.94,31.6L295.32,33.51L295.1,34.64L294.47,34.99L293.49,37.44L293.99,38.55L293.4,42.09L289.56,44.05L287.7,43.6L284.32,41.4L282.99,40.18L281.17,39.76L280.57,40.87L278.09,41.01L276.75,40.49L275.3,40.86L274.79,41.54L272.79,42.6L271.61,42.49L270.86,43.95L268.15,43.78L266.37,43.21L265.68,43.32L263.81,42.28L262.28,43.05L261.19,43.17L258.88,41.81L256.91,42.74L256.03,45.45L256.4,46.39L255.05,48.85L256.75,49.84L256.87,50.78L258.47,53.12L258.29,53.71L259.59,54.02L259.87,55.45L261.06,56.68L261.97,60.81L261.16,62.13L258.93,62.05L257.63,61.07L255.81,60.9L255.29,61.23L252.57,61.35L251.26,60.44L248.51,60.67L247.31,61.27L245.26,59.89L243.83,59.83L243.32,58.62L242.5,58.2L240.69,55.97L240.49,54.66L239.51,53.58L239.56,53L237.36,51.19L236.08,51.34L234.73,52.93L232.71,52.94L230.37,54.46L230.12,55.3L229.04,56.43L229.34,58.8L229.11,60.15L230.9,61.24L231.47,62.43L233.57,64.01L235.1,64.68L236.35,65.76L236.5,66.57L238.4,67.74L239.97,69.6L241.8,69.97L242.28,71.58L244,72.57L245.57,75.46L245.65,76.51L247.6,77.43L249.32,78.94L252.61,79.4L253.32,80.71L253.34,82.07L255.86,83.72L256.13,84.61L257.3,84.55L258.26,86.79L258.09,88.19L259.28,90.01L259.19,90.42L260.58,90.77L262.59,90.69L263.72,92.16L265.14,92.59L266.08,93.41L267.17,93.16L267.78,94.12L267.53,96.42L268.6,97.15L270.26,97.6L269.3,98.97L269.58,101.05L268.69,102.52L268.06,102.5L267.83,103.47L268.51,104.62L267.56,105.56L267.36,106.59L267.73,107.72L266.35,107.83L264.55,108.96L263.3,111.84L264.16,113.01L265.47,113.09L267.48,113.73L268.48,113.3L270.21,113.47L271.08,114.98L271.73,115.36L271.34,116.09L273.32,116.67L273.89,117.54L276.31,117.06L277.24,117.73L277.45,118.57L278.67,119.14L278.86,120.24L279.49,120.23L281.78,121.6L284.08,121.74L284.12,122.8L282.95,124.22L281.17,123.52L278.98,124.28L277.45,123.86L276.14,124.19L276.05,125.55L275.3,126.47L274.67,128.59L275.37,130.2L274.22,131.02L274.36,132.07L272.89,133.97L271.2,134.72L270.14,136.32L269.31,136.32L268.3,138.66L267.12,139.04L266.26,140.38L263.58,140.89L262.45,143.52L260.37,144.89L259.57,146.12L258.15,147.43L259.28,148.71L260.31,148.67L261.68,149.77L264.5,149.39L265.3,148.87L266.6,148.87L267.22,150.52L268.58,151.14L269.86,152.76L271.51,153.8L271.5,154.91L269.77,156.02L269.03,156.89L265.32,157.38L264.21,157.22L263.34,156.47L259.82,156.48L259.21,156.01L257.45,155.68L257,157.41L254.08,157.2L251.77,158.03L248.98,157.55L247.99,156.92L247.3,157.26L245.65,157.16L242.72,159.32L240.97,158.58L241.26,157.15L238.84,156.3L239.25,154.97L239.01,153.75L237.19,152.95L236.34,153.11L234.3,152.58L232.37,153.24L230.92,152.92L229.62,153.34L228.23,152.85L226.54,152.99L224.24,154.91L223.55,154.93L222.08,156.28L220.56,156.06L219.3,156.39L220.01,158.68L221.59,160.34L222.78,160.81L221.43,162.57L219.79,163.85L219.92,164.51L218.87,166.59L219.07,167.75L219.94,169.25L220.44,171.23L219.36,172.16L218.78,171.84L218.57,172.89L219.28,174.04L218.42,174.89L218.86,175.4L218,176.89L218.88,177.89Z"},{"name":"平谷区","adcode":110117,"x":417.93,"y":224.03,"d":"M373.15,256L373.83,256.81L374.84,256.64L375.48,259.3L378.59,258.88L380.01,259.32L381.92,260.39L382.04,260.93L384.49,260.62L386.03,260.8L386.68,260.34L387.59,260.88L387.37,260.05L388.43,260L388.09,258.88L389.5,258.07L390.75,256.46L393.69,256.05L394.14,255.65L393.83,254.16L395.93,254L396.66,253.38L398.1,253.06L397.87,252.28L400.49,252L400.47,252.85L401.41,252.05L401.53,250.55L405.74,250.44L406.62,251.31L409.32,251.17L411.47,252.77L413.84,253.09L417.75,251.88L418.64,250.45L418.26,250.02L421.42,250.77L422.19,251.35L424.03,251.25L424.68,250.3L423.55,249.41L424.44,248.54L425.31,248.77L425.92,251.04L427.46,251.7L427.23,252.24L429,251.66L429.67,250.16L428.62,250.19L428.78,249.51L431,248L430.33,246.95L430.37,245.62L433.41,246.06L433.39,245.16L434.36,244.78L434.45,244.03L436.06,242.91L436.57,242.14L438.2,241.81L439.1,241.06L440.54,241.79L441.65,241.59L443.13,242.04L443.84,243.19L444.86,243.51L445.39,242.7L445.16,241.71L447.4,239.94L450.08,240.51L450.07,239.96L451.43,238.89L452.49,236.35L453.9,235.67L455.01,236L456.09,235.49L457.84,236.63L457.77,237.11L462.01,236.45L462.54,235.67L463.68,235.45L463.8,234.5L462.34,234.55L463.43,233.69L462.62,233.23L464.66,231.76L463.91,230.09L462.48,228.39L463.08,227.93L464.38,228L465.44,227.24L466.55,228.08L467.28,227.27L468.42,227.32L469.39,228.21L469.25,227.19L472.13,227.65L471.78,227.03L473.98,225.65L474.79,225.73L475.47,224.75L473.17,223.51L471.03,224.58L470.05,224.68L470.11,222.97L469.44,223.05L469.01,221.58L472.13,221.11L470.41,220.07L468.75,219.52L468.55,217.61L472.26,216.91L471.41,215.47L470.68,215.66L467.73,214.36L464.58,214.41L463.53,215.1L462.59,215.12L461.82,213.95L461.18,213.86L460.72,212.04L459.9,211.28L460.43,208.92L459.38,207.36L459.47,206.76L458.55,202.22L457.92,201.3L456.11,202.5L454.6,202.35L454.61,203.06L451.73,203.94L449.9,203.96L448.99,202.09L449.52,201.02L449.21,199.68L447.47,198.42L444.86,196.97L444.94,195.63L444.28,194.37L444.15,193.13L445,191.6L443.2,190.74L441.52,190.62L441.82,190.03L440.9,189.41L440.27,187.18L440.23,185.82L439.31,185.53L438.75,184.22L437.5,182.87L436.3,182.72L433.8,183.08L433.28,181.59L432.04,181.09L430.35,181.99L428.83,182.16L427.73,181.52L424.53,181.08L423.19,181.71L421.02,181.87L420.44,182.53L418.06,181.75L417.54,182.54L415.73,182.87L414.57,184.51L411.29,185.42L410.66,185.98L408.85,186.6L405.05,185.03L403.6,185.55L401.45,187.36L398.57,188.47L398.48,189.06L397.25,189.07L395.87,190.26L394.01,190.29L392.97,189.4L390.9,189.74L389.4,190.32L387.88,190.1L386.67,190.63L384.8,192.79L384.23,194.17L383.49,194.51L383.62,195.58L384.48,197.3L382.34,199.01L382.82,200.33L381.5,201.04L379.78,201.09L379.83,201.75L378.16,201.71L375.31,203.13L375.12,204.32L373.16,205.03L372.81,205.73L370.63,207.86L371.4,208.77L373.11,209.8L374.84,209.5L376.35,210.53L375.94,211.66L372.69,214.38L371.85,214.4L371.23,213.6L369.7,213.6L369.41,214.21L367.39,214.48L367.01,215.03L368.34,216.39L367.66,219.46L365.74,219.23L366.02,220.26L368.01,223.64L369.47,223.46L370.4,225.02L369.45,225.05L369.34,226.18L370.72,227.67L373.17,227.5L372.99,228.33L374.71,230.26L375.47,231.92L376.78,233.05L375,235.58L374.5,237.99L374.03,238.45L375.36,239.28L374.81,240.53L375.3,241.62L376.39,242.27L375.76,243.99L374.53,244.56L376.25,245.97L377.28,246.25L377.72,247.17L377.57,249.09L378.73,249.81L377.95,251.57L377.48,251.45L376.97,252.9L375.8,252.57L375.15,253.15L373.23,253.21L373.15,256Z"},{"name":"密云区","adcode":110118,"x":385.74,"y":148.82,"d":"M433.28,181.59L433.91,180.9L434.46,179L435.91,178.38L436.27,177.34L437.13,177.26L437.08,176.52L436.2,175.78L436.4,174.19L435.62,172.04L437.86,170.73L438.52,169.81L441.03,167.86L442.33,166.25L439.87,165.41L439.76,164.4L437.73,163.26L436.18,163L435.41,161.47L436.34,160.19L434.89,159.8L433.71,158.57L434.32,157.32L431.91,154.27L430.56,154.24L429.73,153.47L429.76,152.77L431.12,151.33L430.66,151.21L431.24,149.98L432.38,149.74L434.77,150.46L436.87,149.19L438.54,150.28L440.55,149.6L442.28,150.01L442.51,149.06L441.9,148.65L440.44,146.6L439.73,144.69L438.68,143.79L439.41,143.38L439.16,141.97L441.48,140.89L443.52,139.29L444.59,138.91L445.98,139.17L447.44,138.09L450.64,137.69L453.46,135.11L456.59,135.08L457.27,135.59L458.69,135.47L460.56,134.3L462.23,134.16L462.91,134.93L465.88,135.59L466.63,136.87L468.06,137.46L468.75,138.48L471.24,138.97L472.47,137.44L473.83,137.11L474.52,135.98L476.79,136.98L478.57,137.16L480.58,135.55L480.54,134.82L479.03,134.33L478.43,132.17L478.69,131.64L477.08,129.9L476.62,128.89L478.28,126.05L480.65,124.1L482.42,124.17L483.41,123.65L484.92,123.56L486.1,120.24L485.51,119.38L486.66,118.79L484.97,118.23L487.93,117.89L488.46,118.9L489.28,118.7L490.48,119.87L491.04,119.87L491.6,121.96L493.48,122.38L494.35,121.8L496.75,121.76L497.11,119.85L497.81,119.48L497.3,117.89L499.85,117.17L500,116.18L497.33,114.08L495.13,112.79L493.15,112.38L492.61,111.93L490.11,113.01L488.66,113.19L486.08,112.25L483.39,112.49L482.27,110.88L481.21,111.34L479.77,110.49L478.14,110.11L477.11,110.34L475.82,110.04L473.06,110.84L470.71,110.75L468.69,111.98L466.95,111.77L464.46,113.1L460.48,113.21L459.17,114.7L459.38,115.28L458.06,115.95L455.6,116.69L448.55,116.26L445.84,115.27L445.84,114.57L444.64,113.99L443.34,112.47L441.88,111.44L440.82,111.83L437.35,112.47L435.67,111.58L435.41,110.89L432.09,109.53L431.77,108.96L430.23,108.96L429.72,108.39L428.33,108.13L427.29,108.43L426.41,107.97L423.76,107.79L423.42,108.48L422.43,108.59L420.73,107.32L419.7,107.2L418.49,107.96L415.76,107.35L414.6,107.76L412.3,107.42L411.45,106.91L408.92,107.1L407.29,105.22L403.72,105.84L401.64,106.65L400.51,106.52L399.51,107.11L395.28,106.76L394.48,107.16L392.1,107.03L390.17,107.74L390.05,108.39L389.01,108.92L388.28,108.41L386.08,108.03L384.96,108.48L383.15,108.3L382.45,107.73L379.69,106.84L379.17,106.39L377.28,106.47L376.73,105.84L374.91,105.66L373.88,104.92L374.19,103.62L372.73,102.28L369.64,100.94L368.74,100.26L368.27,97.98L365.02,96.81L364.33,95.5L365.34,93.84L364.25,91.76L364.3,90.2L359.98,89.38L358.61,89.5L357.79,88.36L357.77,86.3L358.17,84.98L356.42,84.54L355.94,83.92L354.01,84.73L352.81,84.44L352.34,85.36L350.34,85.8L351.46,87.71L349.3,88.05L349.02,88.86L347.74,89L347.56,89.9L343.96,91L345.18,93.19L343.28,95.34L341.99,95.79L340.26,95.54L338.39,95.84L336.66,96.56L334.51,96.04L332.25,93.89L331.55,95.29L332.03,96.14L332.84,98.85L333.79,100.47L333.47,104.26L332.92,104.75L333.02,106.09L332.3,107L328.92,106.47L327.45,105.64L325.91,105.81L325.64,106.45L324.19,106.99L323.93,107.79L322.78,108.05L321.24,109.03L318.9,109.62L318.86,110.64L316.45,111.7L316.06,114.03L316.31,114.9L315.29,115.7L315.92,117.7L315.58,119L315.82,120.6L313.37,122.51L313.47,123.54L314.2,123.89L314.1,125.46L313.33,125.16L312.55,125.85L313.62,127.14L314.53,127.55L314.86,128.58L314.31,129.38L315.6,130.02L314.97,131.17L315.69,131.93L315.08,132.35L316.32,134.6L316.37,136.8L315.43,137.26L315.29,137.99L312.87,138.43L309.89,138.22L308.35,138.79L308.98,139.99L305.84,139.82L305.17,140.99L307.74,140.52L308.95,141.8L310.89,141.67L313.51,142.59L313.36,143.86L314.62,145.55L315.91,146.15L316.98,147.33L315.83,147.96L315.64,149.24L313.27,150.6L312.82,152.01L312.65,154.57L311.5,155.14L311.68,156.36L314.02,157.83L311.53,157.22L311.51,158.51L312.01,160.66L312.72,160.36L314.44,162.22L316.9,162.88L317.44,162.11L318.44,162.54L317.52,163.18L317.45,164.81L318.95,166.09L317.84,166.57L316.79,166.4L318.43,167.93L318.15,170.51L318.89,171.83L320.47,171.25L320.65,171.77L322.47,172.62L319.63,173.72L318.62,173.87L318.4,174.76L317.27,175.51L316.06,175.62L316.2,176.94L315.71,178.98L316.75,179.62L314.66,181.26L314.52,181.99L316.26,183.18L317.58,183.08L317.18,184.85L319.17,184.89L318.94,186.16L319.69,186.16L319.33,188.25L318.51,188.82L318.3,189.94L320.18,189.97L320.21,190.89L323.13,189.95L323.27,191.19L324.84,190.73L326.47,191.15L326.72,192.77L327.45,192.8L328.78,194.84L329.85,195.27L327.46,196.54L326.07,198.34L325.52,198.09L321.97,202.58L322.46,202.83L321.82,203.81L322.89,203.73L325.14,204.55L327.41,206.03L328.77,205.79L329.47,206.62L329.9,205.93L332.07,205.07L332.32,203.65L333.18,203.19L333.23,201.36L334.71,201.82L336.11,201.41L338.18,202.14L338.69,202.97L341.74,202.29L341.62,201L342.22,199.31L342.89,199.11L342.63,197.92L344.79,196.59L347.22,196.36L348.5,198.21L349.1,200.56L349.63,201.03L352.35,201.01L352.44,203.18L353.5,204.82L353.02,206.21L354.32,207.16L354.63,208.29L355.74,209.2L355.85,209.97L357.15,211.39L357.63,212.7L359.33,213.43L357.54,214.21L359.09,215.28L360.45,215.3L360.91,216.74L362.13,217.27L362.49,216.77L363.99,217.26L364.77,215.97L366.06,214.86L367.01,215.03L367.39,214.48L369.41,214.21L369.7,213.6L371.23,213.6L371.85,214.4L372.69,214.38L375.94,211.66L376.35,210.53L374.84,209.5L373.11,209.8L371.4,208.77L370.63,207.86L372.81,205.73L373.16,205.03L375.12,204.32L375.31,203.13L378.16,201.71L379.83,201.75L379.78,201.09L381.5,201.04L382.82,200.33L382.34,199.01L384.48,197.3L383.62,195.58L383.49,194.51L384.23,194.17L384.8,192.79L386.67,190.63L387.88,190.1L389.4,190.32L390.9,189.74L392.97,189.4L394.01,190.29L395.87,190.26L397.25,189.07L398.48,189.06L398.57,188.47L401.45,187.36L403.6,185.55L405.05,185.03L408.85,186.6L410.66,185.98L411.29,185.42L414.57,184.51L415.73,182.87L417.54,182.54L418.06,181.75L420.44,182.53L421.02,181.87L423.19,181.71L424.53,181.08L427.73,181.52L428.83,182.16L430.35,181.99L432.04,181.09L433.28,181.59Z"},{"name":"延庆区","adcode":110119,"x":193.78,"y":146.86,"d":"M144.77,206.82L146.93,205.59L148.17,204.23L147.49,203.15L148.04,202.32L147.45,201.31L148.38,199.4L150.13,199.05L149.58,198.06L146.73,196.94L146.93,196.29L146.21,194.57L147.68,194.22L148.38,193.38L150.83,192.28L152.13,193.09L154.09,191.32L156.21,190.98L158.43,193.36L158.35,194.23L159.5,196.1L161.55,196.01L162.1,195.06L164.08,195.3L165.43,193.84L164.59,192.77L166.53,190.48L168.05,190.45L169.2,189.79L170.19,189.9L171.48,190.73L172.17,191.86L174.99,192.04L175.99,191.7L177.68,191.86L179.12,193.5L179.03,193.89L180.44,195.99L182.82,196.18L184.93,195.06L184.11,193.27L184.04,191.82L185.38,190.65L183.94,190.55L183.92,189.57L184.67,189.05L184.12,188.55L185.58,187.79L186.21,189.6L185.57,190.52L187.38,190.27L188.08,188.62L186.94,187.63L185.75,187.21L186.47,185.86L186.37,184.74L188.91,183.72L191.09,183.62L191.53,183.01L193.01,182.65L193.75,183.39L196.65,182.23L200.35,181.43L200.88,180.17L203.36,180.08L204.45,180.31L205.56,181.72L206.67,181.16L207.89,181.14L208.25,180.61L209.23,181.84L210.22,181.42L210.51,180.28L211.65,179.84L212.32,180.44L214.52,179.95L217.27,181.66L219.08,179.84L218.88,177.89L218,176.89L218.86,175.4L218.42,174.89L219.28,174.04L218.57,172.89L218.78,171.84L219.36,172.16L220.44,171.23L219.94,169.25L219.07,167.75L218.87,166.59L219.92,164.51L219.79,163.85L221.43,162.57L222.78,160.81L221.59,160.34L220.01,158.68L219.3,156.39L220.56,156.06L222.08,156.28L223.55,154.93L224.24,154.91L226.54,152.99L228.23,152.85L229.62,153.34L230.92,152.92L232.37,153.24L234.3,152.58L236.34,153.11L237.19,152.95L239.01,153.75L239.25,154.97L238.84,156.3L241.26,157.15L240.97,158.58L242.72,159.32L245.65,157.16L247.3,157.26L247.99,156.92L248.98,157.55L251.77,158.03L254.08,157.2L257,157.41L257.45,155.68L259.21,156.01L259.82,156.48L263.34,156.47L264.21,157.22L265.32,157.38L269.03,156.89L269.77,156.02L271.5,154.91L271.51,153.8L269.86,152.76L268.58,151.14L267.22,150.52L266.6,148.87L265.3,148.87L264.5,149.39L261.68,149.77L260.31,148.67L259.28,148.71L258.15,147.43L259.57,146.12L260.37,144.89L262.45,143.52L263.58,140.89L266.26,140.38L267.12,139.04L268.3,138.66L269.31,136.32L270.14,136.32L271.2,134.72L272.89,133.97L274.36,132.07L274.22,131.02L275.37,130.2L274.67,128.59L275.3,126.47L276.05,125.55L276.14,124.19L277.45,123.86L278.98,124.28L281.17,123.52L282.95,124.22L284.12,122.8L284.08,121.74L281.78,121.6L279.49,120.23L278.86,120.24L278.67,119.14L277.45,118.57L277.24,117.73L276.31,117.06L273.89,117.54L273.32,116.67L271.34,116.09L271.73,115.36L271.08,114.98L270.21,113.47L268.48,113.3L267.48,113.73L265.47,113.09L264.16,113.01L263.3,111.84L264.55,108.96L266.35,107.83L267.73,107.72L267.36,106.59L267.56,105.56L268.51,104.62L267.83,103.47L268.06,102.5L268.69,102.52L269.58,101.05L269.3,98.97L270.26,97.6L268.6,97.15L267.53,96.42L267.78,94.12L267.17,93.16L266.08,93.41L265.14,92.59L263.72,92.16L262.59,90.69L260.58,90.77L259.19,90.42L256.55,92L254.36,91.23L252.82,91.77L251.47,91.45L249.87,91.64L247.95,91.19L247.45,89.23L245.96,88.66L244.9,89.07L242.47,89.12L239.53,90.52L237.5,90.49L236.75,90.85L235.26,90.44L233.4,91L231.07,90.34L228.82,90.43L228.13,90.18L225.24,90.55L224.23,91L223.03,92.49L223.76,94.47L223.03,95.15L222.3,94.34L220.72,94.08L219.12,92.47L216.94,92.44L216.01,92.97L215.12,92.68L215.28,91.89L214.3,90.89L214.23,89.41L212.26,88.08L211.53,86.94L209.26,86.04L208.64,86.83L206.29,88.04L206.43,89.87L205.54,90.71L205.14,92.79L205.98,93.37L203.61,94.77L202.96,95.83L202.93,96.86L201.3,97.9L200.68,97.54L199.34,97.95L199.56,99.53L197.74,100.94L196.48,101.43L194.79,103.98L193.92,104.26L193.18,105.31L192.8,106.99L191.68,108.04L192.21,109.63L191.71,111.32L191.01,111.96L190.82,113.4L189.69,115.74L187.11,115.53L185.14,114.7L183.78,114.54L181.09,117.66L178.34,118.86L177.95,119.45L178.23,120.67L179.99,122.43L180.37,123.19L179.51,123.65L176.31,123.87L175.04,123.05L172.66,123.96L172.05,124.6L169.95,125.51L169.22,127.29L168.37,127.72L166.75,127.7L165.73,128.46L164.03,128.67L162.58,129.6L159.78,130.1L159.24,130.68L158.89,128.39L158.15,128.57L153.52,133.72L151.46,133.76L151.26,134.69L148.25,134.89L146.64,132.19L145.92,129.53L144.52,129.84L144.87,128.72L142.04,127.88L140.49,128.05L139.65,127.52L137.44,127.01L135.89,127.14L134.07,126.25L131.19,126.1L128.9,128.21L128.19,128.49L126.67,130.75L126.04,131.17L122,131.04L121.64,131.59L119.04,132.33L117.04,131.67L112.72,133.05L111.18,137.36L111.39,138.49L110.99,139.4L109.89,139.85L107.57,139.56L106.23,139.78L104.65,138.96L102.93,139.62L101.01,141.05L100.45,141.87L99.6,142.01L98.15,143.71L97.16,144.09L96.13,143.83L95.65,144.69L96.25,145.9L94.67,147.04L93.54,148.79L93.38,149.84L91.76,152.11L93.37,154.18L93.6,153.43L99.12,153.4L100.59,154.42L102.36,154.84L100.98,156.99L101.09,158.19L99.91,159.26L99.64,161.07L100.21,161.68L101.74,161.27L100.34,162.8L100.81,164.03L100.12,163.85L100.37,164.93L99.65,165.84L103.38,167.47L104.13,168.52L105.73,168.51L105.62,169.82L114.83,179.26L115.04,180.28L115.77,180.32L117.2,181.7L119.29,181.23L120.64,182.08L120.65,184.06L120.17,184.67L121.23,184.72L121.23,185.31L123.14,185.25L123.94,184.67L124.36,185.3L125.53,185.26L126.01,185.84L127.31,185.64L127.79,186.18L131.58,185.71L133.6,186.56L134.12,188.26L134.92,189.51L134.31,190.06L134.65,191.38L135.64,192.14L134.6,192.99L135.54,194.43L136.11,194.1L137.59,195.09L137.93,195.94L139.45,196.42L138.52,197.92L139.93,199.8L139.98,201.45L140.89,201.4L141.26,203.06L142.07,204.21L143.22,204.69L143.54,206L144.77,206.82Z"}]},"shanghai":{"viewBox":"0 0 520 420","regions":[{"name":"黄浦区","adcode":310101,"x":237.38,"y":227.49,"d":"M230.07,227.13L231.03,229.26L231.3,230.3L231.52,232.53L232.85,232.14L233.17,232.57L233.85,234.68L234.1,236.31L235.55,236.75L235.88,237.38L240.57,236.25L241.8,235.81L242.89,234.94L243.92,233.62L246.16,230.31L246.65,228.93L246.48,227.68L245.64,226.2L244.14,224.65L242.15,223.07L241.44,222.06L241.44,220.79L241.86,220.14L239.63,219.51L239.05,219.54L238.1,220.23L236.81,220.75L235.52,220.39L233.84,221.09L231.75,220.4L232.75,222.46L233.23,225.4L233.17,225.96L229.78,225.95L230.07,227.13Z"},{"name":"徐汇区","adcode":310104,"x":223.75,"y":245.95,"d":"M230.07,227.13L228.32,228.01L226.67,228.52L224.28,228.94L223.65,229.88L222.94,230L223.8,232.28L222.24,233.13L219.31,234.39L218.63,235.01L218.75,235.98L218.02,236.46L215.75,236.36L216.06,237.72L216.6,237.55L216.57,238.81L215.4,239.24L211.79,240.26L211.23,239.92L211.15,240.45L209.99,240.56L210.3,241.6L209.44,242.08L209.87,243.22L209.06,243.48L210.03,246.36L212.6,245.53L213.21,247L212.35,247.02L210.45,247.55L210.78,248.56L212.22,248.21L212.07,247.76L213.33,247.29L215.34,252.03L216.14,253.45L217.6,255.23L218.59,256.67L223.33,256.06L223.99,258.38L224.09,259.22L223.1,260.98L223.82,261.44L224.95,261.29L226.29,260.53L226.58,260.75L227.89,260.39L227.68,261.21L228.38,262.56L226.88,262.93L226.45,263.46L228.23,264.06L228.46,264.89L229.35,265.04L231.71,264.66L231.83,262.56L232.46,261.44L233.76,259.34L233.87,257.39L233.57,256.44L231.58,254.34L230,251.88L230,250.54L230.93,249.32L232.63,247.79L233.46,246.84L233.78,245.51L233.39,243.98L232.36,241.34L232.36,240.52L232.79,239.54L233.57,238.58L235.88,237.38L235.55,236.75L234.1,236.31L233.85,234.68L233.17,232.57L232.85,232.14L231.52,232.53L231.3,230.3L231.03,229.26L230.07,227.13Z"},{"name":"长宁区","adcode":310105,"x":204.97,"y":228.59,"d":"M224.28,228.94L223.24,226.98L223,225.58L222.65,225.32L220.97,226.21L220.56,225.85L220.49,224.24L219.17,224.61L218.09,225.54L216.72,224.47L216.47,224.63L216.83,225.77L216.25,226.12L214.52,226.44L212.96,227.01L211.91,226.93L211.67,227.6L208.16,227.62L204.43,226.97L203.25,227.16L202.68,226.39L201.19,225.9L200.99,225.28L199.73,225.3L198.77,224.07L197.21,221.76L196.79,221.37L195.49,221.04L195.93,220.26L195.54,219.62L195.02,219.83L194.88,220.51L194.18,219.71L194.49,220.88L192.99,220.86L192.19,221.63L193.83,222.65L194.42,223.89L194.41,224.69L193.21,225.19L193.03,225.84L194.5,226.07L193.7,226.22L193.49,227.89L192.51,228.26L192.71,229.64L192.24,229.67L192.22,231.42L192.37,234.6L191.87,234.87L192.09,235.88L190.11,236.83L192.19,239.85L193.16,240.07L196.34,238.78L196.93,239.37L198.1,239.01L198.53,237.98L199.14,238.21L200.95,238.12L205.41,236.69L209.04,236.11L215.75,236.36L218.02,236.46L218.75,235.98L218.63,235.01L219.31,234.39L222.24,233.13L223.8,232.28L222.94,230L223.65,229.88L224.28,228.94Z"},{"name":"静安区","adcode":310106,"x":227.29,"y":211.72,"d":"M230.07,227.13L229.78,225.95L233.17,225.96L233.23,225.4L232.75,222.46L231.75,220.4L233.84,221.09L235.52,220.39L236.81,220.75L238.1,220.23L237.54,218.32L237.02,217.73L237.68,217.45L237.03,216.59L237.34,216L237.31,214.95L235.29,213.4L233.85,212.02L232.27,209.92L231.7,209.61L231.27,208.49L231.38,206.66L230.83,205.04L231.58,204.1L232.24,202.43L231.92,199.89L233.24,199.79L233.44,196.71L233.39,195.35L232.51,195L229.89,195.13L229.12,195.69L226.96,196.37L226.59,195.51L223.43,195.55L223.33,195.17L222.42,195.17L222.06,195.87L222.75,197.89L221.97,198.09L221.81,198.79L222.06,199.92L221.69,200.64L220.15,200.78L220.31,202.26L219.26,202.67L218.12,202.78L217.68,204.25L218.01,204.63L219.32,204.65L219.01,206.79L219.51,208.07L219.56,210.71L219.77,211.11L221.23,209.76L222.05,210.7L223.53,211.5L225.39,212.23L227.96,215.68L227.41,216.74L228.09,217.03L227.76,218.38L227.1,219.19L227.63,219.79L226.29,220.41L222.92,222.35L221.6,222.39L220.62,223.65L220.49,224.24L220.56,225.85L220.97,226.21L222.65,225.32L223,225.58L223.24,226.98L224.28,228.94L226.67,228.52L228.32,228.01L230.07,227.13Z"},{"name":"普陀区","adcode":310107,"x":205.78,"y":213.21,"d":"M197.21,221.76L198.77,224.07L199.73,225.3L200.99,225.28L201.19,225.9L202.68,226.39L203.25,227.16L204.43,226.97L208.16,227.62L211.67,227.6L211.91,226.93L212.96,227.01L214.52,226.44L216.25,226.12L216.83,225.77L216.47,224.63L216.72,224.47L218.09,225.54L219.17,224.61L220.49,224.24L220.62,223.65L221.6,222.39L222.92,222.35L226.29,220.41L227.63,219.79L227.1,219.19L227.76,218.38L228.09,217.03L227.41,216.74L227.96,215.68L225.39,212.23L223.53,211.5L222.05,210.7L221.23,209.76L219.77,211.11L217.95,212.83L216.76,212.62L216.61,211.59L215.12,211.2L215.24,210.31L213.49,210.35L213.82,209.14L213.21,209.34L211.79,208.76L213.17,206.17L211.88,206.2L211.27,205.88L211.62,205.32L211.09,204.81L209.69,204.57L210.1,203.49L208.07,203.3L206.92,203.56L205.93,204.11L205.9,205.15L204.22,204.78L203.77,205.26L202.28,204.87L202.13,205.25L200.26,204.55L200.26,204.33L198.61,203.87L199.15,203.49L200.18,200.93L199.16,200.93L197.41,201.86L196.82,201.27L195.54,202.04L195.78,202.56L194.9,202.95L194.89,202.54L193.01,202.61L193.03,203.79L192.29,203.95L191.6,203.41L190.24,204.02L190.43,204.68L188.39,205.31L188.69,206.5L189.22,206.69L190.41,206.22L191.13,208.24L191.46,208.13L191.52,209.59L192.36,209.73L192.16,210.42L193.84,210.86L194.21,210.08L198.21,210.87L198.72,211.7L199.46,211.05L201.42,211.44L201.28,212.38L199.77,212.09L199.01,212.27L198.72,213.35L199.63,214.51L200.97,214.7L200.93,215.23L203.69,215.43L203.87,214.65L204.62,214.66L205.69,215.2L204.53,218.39L204.04,219.42L203.22,219.04L202.98,219.65L201.72,218.5L201.19,218.83L200.05,220.81L199.27,221.27L199.09,220.68L197.81,220.79L197.81,221.54L197.21,221.76Z"},{"name":"虹口区","adcode":310109,"x":239.13,"y":209.52,"d":"M238.87,198.12L238.86,197.15L236.89,197.13L234.92,196.78L233.44,196.71L233.24,199.79L231.92,199.89L232.24,202.43L231.58,204.1L230.83,205.04L231.38,206.66L231.27,208.49L231.7,209.61L232.27,209.92L233.85,212.02L235.29,213.4L237.31,214.95L237.34,216L237.03,216.59L237.68,217.45L237.02,217.73L237.54,218.32L238.1,220.23L239.05,219.54L239.63,219.51L241.86,220.14L243.51,219.26L245.69,218.79L248.73,218.63L248.58,217.16L249.1,217.08L248.13,215.66L246.19,213.66L245.5,212.35L245.57,211.13L243.47,209.44L242.41,209.28L242.25,207.2L242.91,206.16L244.36,205.08L243.71,203.23L241.48,203.74L240.38,204.14L238.95,200.69L238.87,198.12Z"},{"name":"杨浦区","adcode":310110,"x":250.99,"y":203.44,"d":"M248.73,218.63L252.25,218.54L255.05,217.79L256.69,217.09L262.25,213.15L263.67,211.7L265.25,209.51L265.57,208.28L265.45,206.48L264.28,203.66L263.35,201.87L263.1,200.74L263.14,195.08L262.7,192.97L262.09,191.87L261.21,191.02L259.18,189.8L251.59,186.94L250.76,188.18L249.93,187.82L249.1,188.85L245.27,187.28L241.46,192.18L242.74,192.87L243.16,193.76L242.3,194.38L242.46,198.15L238.87,198.12L238.95,200.69L240.38,204.14L241.48,203.74L243.71,203.23L244.36,205.08L242.91,206.16L242.25,207.2L242.41,209.28L243.47,209.44L245.57,211.13L245.5,212.35L246.19,213.66L248.13,215.66L249.1,217.08L248.58,217.16L248.73,218.63Z"},{"name":"闵行区","adcode":310112,"x":220.63,"y":263.03,"d":"M198.65,304.05L203.89,302.47L209.94,300.75L214.72,300.13L215.94,299.86L219.37,298.77L221.73,297.29L222.44,296.46L223.45,295.74L224.71,295.19L227.09,294.66L230.79,294.68L232.58,294.25L234.44,293.23L236,292.79L239.02,292.56L240.06,292.28L241.24,292.98L240.95,293.84L242.21,297.56L243.14,297.59L243.13,297.21L244.47,296.16L246,295.52L246.81,295.58L248.9,294.6L250.12,295.61L250.52,296.33L249.88,296.21L249.95,297.23L250.77,297.08L252.58,298.32L253.65,298.67L254.45,298.34L255.49,298.71L255.64,299.2L257.24,298.86L258.14,299.23L259.23,300.74L260.26,300.56L260.42,299.24L261.35,299.13L261.25,298.56L263.02,298.41L265.87,297.55L265.07,296.75L265.95,296.3L265.8,295.58L266.19,295.24L265.63,293.66L265.14,293.83L264.41,293.24L265.66,293.07L266.04,291.81L267.2,291.11L267.23,290.37L266.46,288.56L265.21,289L265.42,289.28L263.91,290.3L262.63,289.36L262.13,290.59L261.43,290.59L261.44,291.08L260.69,291.12L260.09,290.39L260.26,289.64L261.2,289.75L262.04,289.24L261.99,287.65L262.39,287.41L262.38,283.89L263.22,283.17L262.49,282.8L261.6,281.79L261.32,281.9L260.88,280.89L260.23,281.38L259.54,281.34L259.23,281.82L258.67,281.62L258.06,282.09L256.67,282.3L256.93,281.45L256.45,280.35L257.24,279.88L257.25,279.34L258.86,278.96L258.48,277.46L258.91,276.82L259.72,276.77L259.94,276.19L261.52,275.64L260.26,274.96L261.15,274.27L262.24,274.12L261.76,273.74L263.4,273.44L263.38,273.18L264.97,272.84L267.39,271.61L266.56,271.21L266.24,271.61L265.65,271.12L263.68,270.84L263.04,270.47L261.6,270.77L261.41,271.29L260.5,271.53L259.55,270.73L258.91,269.44L259.86,269.04L259.88,268.42L262.26,267.84L263.04,267.32L263.14,267.86L263.93,267.86L264.85,267.3L264.71,266.37L263.6,265.61L263.2,264.88L263.71,264.69L262.91,263.61L262.99,263.31L261.86,262.17L262.5,261.51L261.5,261.13L261.05,260.56L260.43,261.25L260.11,260.87L259.12,261.02L259.51,261.59L258.64,262.22L257.54,261.64L256.91,260.15L256.05,260.32L255.53,260.84L254.72,259.58L253.74,259.82L253.47,259.43L251.53,259.97L250.76,260.44L250.3,260.1L248.11,260.43L247.87,259.56L247.1,258.56L245.24,258.93L244.73,259.46L245.18,260.36L244,260.63L243.04,258.46L241.22,259.34L240.41,257.57L239.05,257.5L238.96,258.32L237.76,258.91L237.55,259.56L236.34,259.78L237.58,261.89L236.3,261.84L235.29,260.73L235.24,261.18L234.07,261.81L232.46,261.44L231.83,262.56L231.71,264.66L229.35,265.04L228.46,264.89L228.23,264.06L226.45,263.46L226.88,262.93L228.38,262.56L227.68,261.21L227.89,260.39L226.58,260.75L226.29,260.53L224.95,261.29L223.82,261.44L223.1,260.98L224.09,259.22L223.99,258.38L223.33,256.06L218.59,256.67L217.6,255.23L216.14,253.45L215.34,252.03L213.33,247.29L212.07,247.76L212.22,248.21L210.78,248.56L210.45,247.55L212.35,247.02L213.21,247L212.6,245.53L210.03,246.36L209.06,243.48L209.87,243.22L209.44,242.08L210.3,241.6L209.99,240.56L211.15,240.45L211.23,239.92L211.79,240.26L215.4,239.24L216.57,238.81L216.6,237.55L216.06,237.72L215.75,236.36L209.04,236.11L205.41,236.69L200.95,238.12L199.14,238.21L198.53,237.98L198.1,239.01L196.93,239.37L196.34,238.78L193.16,240.07L192.19,239.85L190.11,236.83L192.09,235.88L191.87,234.87L192.37,234.6L192.22,231.42L192.24,229.67L192.71,229.64L192.51,228.26L193.49,227.89L193.7,226.22L194.5,226.07L193.03,225.84L193.21,225.19L194.41,224.69L194.42,223.89L193.83,222.65L192.19,221.63L191.11,222.15L190.77,223.38L188.31,224.15L187.27,224.14L184.9,224.9L180.97,223.82L179.04,223.68L177.68,223.14L176.38,221.41L175.98,219.8L174.85,219.19L174.12,218.25L175.01,217.08L173.78,217.07L172.18,216.55L170.9,216.95L168.73,215.61L168.58,214.76L167.39,215.02L165.54,214.61L165.47,214.91L163.29,216.62L162.85,218.04L161.5,218.51L160.95,220.5L161.41,220.77L163.48,220.55L164.05,221.94L164.49,221.41L165.03,221.8L165.46,223.03L166.42,223.79L166.69,225.01L166.24,225.18L166.75,226.31L166.51,227.12L167.22,227.78L167.71,228.75L167.13,229.49L168.54,230.71L168.8,231.4L168.29,231.73L168.83,232.49L169.45,232.5L171.03,234.08L172.84,235.58L174.95,235.32L175.99,234.7L177.52,233.34L177.61,232.74L178.38,232.56L179.22,233.09L180.2,234.48L182.73,237.22L183.44,238.54L185.19,240.89L185.74,241.91L185.91,242.98L187.59,245.3L188.66,247.23L189.15,247.29L190.02,248.76L189.95,249.48L190.72,249.8L191.28,251.36L191.67,251.46L192.34,252.53L191.69,252.91L193.38,254.28L194.2,255.65L193.99,255.93L194.62,256.96L194.27,257.1L195.11,258.31L194.86,258.41L195.76,259.65L196.86,259.69L196.1,260.34L197.09,261.63L197.8,261.3L198.11,261.94L196.59,263.22L196.42,262.83L195.42,263.17L196.31,265.52L198.55,265.03L198.77,265.62L199.94,265.35L201.69,268.78L202.88,271.67L202.43,272.15L201.86,271.91L200.8,272.3L200.44,273.63L199.73,273.98L200.47,274.84L200.25,275.33L198.2,275.83L198.49,276.69L196.98,277.57L193.81,278.25L193.17,277.1L191.23,277.84L191.16,282.54L190.7,284.11L190.81,286.89L190.59,287.28L190.77,288.48L190.72,292.05L190.51,292.79L192.68,292.63L193.6,292.32L194.06,292.6L192.66,293.77L192.15,295.06L189.65,298.01L188.74,298.33L188.51,298.78L188.55,300.21L188.21,302.33L188.7,303.16L189.4,302.95L190.94,303.15L193.9,304.45L196.29,304.65L198.65,304.05Z"},{"name":"宝山区","adcode":310113,"x":206.01,"y":178.65,"d":"M219.77,211.11L219.56,210.71L219.51,208.07L219.01,206.79L219.32,204.65L218.01,204.63L217.68,204.25L218.12,202.78L219.26,202.67L220.31,202.26L220.15,200.78L221.69,200.64L222.06,199.92L221.81,198.79L221.97,198.09L222.75,197.89L222.06,195.87L222.42,195.17L223.33,195.17L223.43,195.55L226.59,195.51L226.96,196.37L229.12,195.69L229.89,195.13L232.51,195L233.39,195.35L233.44,196.71L234.92,196.78L236.89,197.13L238.86,197.15L238.87,198.12L242.46,198.15L242.3,194.38L243.16,193.76L242.74,192.87L241.46,192.18L245.27,187.28L249.1,188.85L249.93,187.82L250.76,188.18L251.59,186.94L248.23,185.29L246.18,183.62L244.72,181.19L244.6,179.77L244.72,178.39L245.81,176.69L247.43,174.54L250.24,171.71L245.84,168.17L246.49,167.42L248.77,168.37L248.97,168.05L246.93,166.89L244.25,165.8L243.92,166.25L245.8,166.97L245.4,167.82L241.68,164.39L237.58,161.39L231.98,157.9L226.37,153.95L222.64,151.48L217.69,147.62L214.84,145.83L213.13,144.91L213.02,144.18L213.75,142.95L213.48,142.37L204.23,137.96L199.78,136.16L198.35,135.69L193.82,134.48L191.39,135.68L189.38,136.96L188.66,136.96L187.36,137.58L187.54,138.42L186.33,138.4L186.37,137.36L186.96,137.23L186.42,136.44L185.3,136.48L184.89,137.91L183.81,137.39L183.3,136.43L181.77,136.62L181.88,137.22L180.84,137.49L179.99,138.39L180.29,139.34L181.5,139.65L182.09,140.43L182.93,140.69L183.28,141.57L182.75,141.91L183.26,142.34L184.25,144.47L185.08,144.27L185.99,146.23L184.54,147.05L185.72,148.32L186.55,148.13L186.38,148.87L185.5,149.02L185.66,150.97L186.53,151.87L185.94,151.99L186.3,152.63L187.68,152.59L188.71,154.55L188.3,154.8L188.99,157.01L189.93,157.47L190.7,157.32L191.63,159.81L191.65,160.69L191.17,160.8L191.58,162.12L191.62,164L190.3,164.67L190.84,165.72L190.33,165.89L190.54,166.64L189.68,166.78L189.05,166.26L184.56,167.77L185.53,168.89L184.98,169.19L184.7,170.57L185.55,170.87L186.83,170.82L187.36,171.37L187.42,172.17L186.5,173.51L187.34,173.71L188.46,176.06L189.71,176.04L189.95,176.89L189.14,177.24L189.98,178.2L190.81,178.74L190.6,179.17L191.44,179.55L191.13,180.54L191.94,181.42L192.37,182.43L192.82,182.59L193.17,183.45L191.8,184.01L192,184.85L191.01,185.64L190.25,185.51L190.33,186.85L191.59,186.93L191.93,187.66L192.37,187.58L193.47,188.68L194.09,188.49L194.71,190.26L193.62,190.35L193.25,191.23L193.45,191.95L194.6,193.82L195.1,194.15L194.25,194.39L194.49,195.18L195.63,195.03L195.18,195.59L195.16,196.49L193.81,196.34L192.83,198.14L192.39,198.59L191.34,200.74L189.95,201.34L190.87,203.03L191.4,202.73L191.6,203.41L192.29,203.95L193.03,203.79L193.01,202.61L194.89,202.54L194.9,202.95L195.78,202.56L195.54,202.04L196.82,201.27L197.41,201.86L199.16,200.93L200.18,200.93L199.15,203.49L198.61,203.87L200.26,204.33L200.26,204.55L202.13,205.25L202.28,204.87L203.77,205.26L204.22,204.78L205.9,205.15L205.93,204.11L206.92,203.56L208.07,203.3L210.1,203.49L209.69,204.57L211.09,204.81L211.62,205.32L211.27,205.88L211.88,206.2L213.17,206.17L211.79,208.76L213.21,209.34L213.82,209.14L213.49,210.35L215.24,210.31L215.12,211.2L216.61,211.59L216.76,212.62L217.95,212.83L219.77,211.11Z"},{"name":"嘉定区","adcode":310114,"x":163.57,"y":184.27,"d":"M133.59,209.21L133.65,210.66L132.97,212.07L134.16,212.54L134.89,211.15L135.91,212.07L136.41,211.58L138.01,213.24L138.13,214.61L138.87,214.77L138.41,215.7L139.2,216.1L140.1,215.49L140.9,216.21L141.54,215.81L141.71,216.58L142.41,216.27L143.17,216.95L143.97,216.93L144.58,216.16L146.06,216.52L146.17,217.21L147.09,217.28L147.03,216.59L148.22,216L149.27,215.82L149.18,215.4L150.29,214.47L150.97,215.29L151.39,215.12L151.37,214.23L152.28,214.54L152.77,216.29L155.03,215.67L154.69,215.32L155.85,214.8L155.74,214.32L157.54,213.95L157.51,213.63L159.44,213.64L160.24,213.83L161.69,214.69L163.06,214.56L163.12,214.99L165.47,214.91L165.54,214.61L167.39,215.02L168.58,214.76L168.73,215.61L170.9,216.95L172.18,216.55L173.78,217.07L175.01,217.08L174.12,218.25L174.85,219.19L175.98,219.8L176.38,221.41L177.68,223.14L179.04,223.68L180.97,223.82L184.9,224.9L187.27,224.14L188.31,224.15L190.77,223.38L191.11,222.15L192.19,221.63L192.99,220.86L194.49,220.88L194.18,219.71L194.88,220.51L195.02,219.83L195.54,219.62L195.93,220.26L195.49,221.04L196.79,221.37L197.21,221.76L197.81,221.54L197.81,220.79L199.09,220.68L199.27,221.27L200.05,220.81L201.19,218.83L201.72,218.5L202.98,219.65L203.22,219.04L204.04,219.42L204.53,218.39L205.69,215.2L204.62,214.66L203.87,214.65L203.69,215.43L200.93,215.23L200.97,214.7L199.63,214.51L198.72,213.35L199.01,212.27L199.77,212.09L201.28,212.38L201.42,211.44L199.46,211.05L198.72,211.7L198.21,210.87L194.21,210.08L193.84,210.86L192.16,210.42L192.36,209.73L191.52,209.59L191.46,208.13L191.13,208.24L190.41,206.22L189.22,206.69L188.69,206.5L188.39,205.31L190.43,204.68L190.24,204.02L191.6,203.41L191.4,202.73L190.87,203.03L189.95,201.34L191.34,200.74L192.39,198.59L192.83,198.14L193.81,196.34L195.16,196.49L195.18,195.59L195.63,195.03L194.49,195.18L194.25,194.39L195.1,194.15L194.6,193.82L193.45,191.95L193.25,191.23L193.62,190.35L194.71,190.26L194.09,188.49L193.47,188.68L192.37,187.58L191.93,187.66L191.59,186.93L190.33,186.85L190.25,185.51L191.01,185.64L192,184.85L191.8,184.01L193.17,183.45L192.82,182.59L192.37,182.43L191.94,181.42L191.13,180.54L191.44,179.55L190.6,179.17L190.81,178.74L189.98,178.2L189.14,177.24L189.95,176.89L189.71,176.04L188.46,176.06L187.34,173.71L186.5,173.51L187.42,172.17L187.36,171.37L186.83,170.82L185.55,170.87L184.7,170.57L184.98,169.19L185.53,168.89L184.56,167.77L189.05,166.26L189.68,166.78L190.54,166.64L190.33,165.89L190.84,165.72L190.3,164.67L191.62,164L191.58,162.12L191.17,160.8L191.65,160.69L191.63,159.81L190.7,157.32L189.93,157.47L188.99,157.01L188.3,154.8L188.71,154.55L187.68,152.59L186.3,152.63L185.94,151.99L186.53,151.87L185.66,150.97L185.5,149.02L186.38,148.87L186.55,148.13L185.72,148.32L184.54,147.05L185.99,146.23L185.08,144.27L184.25,144.47L183.26,142.34L182.75,141.91L183.28,141.57L182.93,140.69L182.09,140.43L181.5,139.65L180.29,139.34L180.17,140.04L179.56,140.31L179.57,141L177.95,141.55L177.04,140.95L176.65,141.79L175.37,141.27L174.84,141.55L173.57,141.36L173.77,141.91L172.54,142.55L172.47,142.95L171.14,143.28L170.14,142.29L169.64,142.68L169.68,143.59L168.95,143.67L167.87,144.41L167.78,145.02L165.67,145.41L165.94,143.51L165.3,143.68L165.21,144.72L164.53,144.78L164.05,145.41L163.21,145.59L162.82,144.7L163.57,144.06L162.37,144.28L162.18,142.34L161.33,141.2L161.25,140.31L160.09,140.86L159.3,140.63L159.51,142.09L158.75,142.15L157.37,143.98L158.06,144.31L157.91,145.47L156.59,145.39L156.32,145.92L154.85,145.91L154.32,146.18L152.6,145.95L153.04,145.44L152.84,144.94L150.29,146.25L149.36,147.09L149.2,148.04L146.7,148.52L143.85,150.75L143.66,151.81L143.85,152.8L142.18,153.72L140.33,154.41L138.7,154.17L138.03,154.72L137.5,154.13L136.54,154.54L135.87,154.28L131.56,156.11L131.31,157.67L131.71,158.57L133.19,159.39L135.09,159.81L136.44,159.83L136.38,160.67L136.94,161.41L136.21,161.18L136.01,161.87L134.08,161.88L132.77,163.13L131.21,163.36L131.2,163.8L132.17,163.98L132.05,165.02L133.51,165.71L134.15,165.66L133.83,166.38L135.21,166.84L134.91,167.55L133.39,168.2L133.64,168.88L132.56,169.35L132.27,170.25L133.27,170.63L131.66,170.9L132.23,171.8L130.44,172.49L131.48,173.26L132.08,174.21L131.9,174.69L129.68,175.27L129.56,174.96L128.44,175.52L128.72,176.04L126.61,176.78L126.45,176.51L124.23,177.44L123.92,176.88L122.31,177.72L120.9,178.16L121.36,179.22L122.59,179.4L122.94,180L120.71,180.57L120.61,181.12L119.48,181.26L119.35,180.68L118.74,180.66L118.67,181.31L119.15,182.61L118.87,184.41L119.2,184.64L119.17,185.72L120.07,185.44L120.29,185.76L122,185.39L122.94,186.7L122.03,186.84L122.23,188L124.13,188.22L126.19,187.76L126.31,188.62L126.09,190.78L126.42,191.6L126.87,191.65L127.1,193.67L126.54,193.72L126.57,194.42L125.18,195.66L125.12,196.42L125.62,197.27L125.41,198.02L125.98,199.16L125.78,199.41L126.04,200.97L127.25,201.14L129.11,200.85L128.89,200.01L130.43,198.71L131.42,199.91L132.65,202.11L132.06,202.15L133.26,203.68L132.81,204.36L133.89,204.95L134.43,205.79L135.36,205.71L135.99,206.88L135.39,207.64L134.16,207.9L134.14,208.64L133.59,209.21Z"},{"name":"浦东新区","adcode":310115,"x":293.43,"y":265.97,"d":"M265.87,297.55L267.86,297.19L269.83,297.18L270.26,296.76L273.56,296.8L273.84,296.38L276.53,296.67L279.92,296.63L280.87,298.39L281.77,299.35L290.07,299.14L292.56,299.17L295.28,299.34L297.31,299.69L298.53,300.25L298.91,299.63L301.78,300.26L303.2,300.15L304.76,300.41L306.82,301.02L308.73,301.79L311.05,303.08L317.12,307.25L317.76,308.3L319.02,309.52L318.69,310.13L319.68,310.76L320.87,310.8L322.18,312.29L322.61,311.93L323.49,312.03L325.81,313.16L326.36,313.66L326.33,314.61L327.47,315.51L326.56,316.03L326.5,316.57L327.39,316.54L327.25,317.07L328.07,317.17L328.57,316.6L329.13,317.57L330.17,318L330.28,318.75L331.68,318.92L331.64,320.28L332.73,323.19L332.46,325.02L332.05,325.56L331.85,327.56L332.06,328.94L332,330.48L331.12,333.08L331.33,334.8L330.2,334.93L329.99,336.48L329.72,336.57L328.62,340.43L329,344.5L336.75,355.16L371.89,356.02L375.32,356.42L378.28,358.41L384.34,367.78L392.6,363.94L388.08,355.07L387.72,353.71L387.84,352.32L392.92,348.11L397.57,344.42L400.29,340.49L401.26,336.74L401.74,328.78L401.02,317.51L399.34,307.04L395.09,291.91L390.37,282.01L385.32,276.11L367.13,258.39L365.4,255.56L355.67,247.71L341.84,234.52L320.87,207.13L316.22,202.34L314.13,200.68L310.93,198.81L303.64,194.67L278.6,180.15L276.21,178.73L273.25,177.54L262.49,175.26L255.57,173.71L250.24,171.71L247.43,174.54L245.81,176.69L244.72,178.39L244.6,179.77L244.72,181.19L246.18,183.62L248.23,185.29L251.59,186.94L259.18,189.8L261.21,191.02L262.09,191.87L262.7,192.97L263.14,195.08L263.1,200.74L263.35,201.87L264.28,203.66L265.45,206.48L265.57,208.28L265.25,209.51L263.67,211.7L262.25,213.15L256.69,217.09L255.05,217.79L252.25,218.54L248.73,218.63L245.69,218.79L243.51,219.26L241.86,220.14L241.44,220.79L241.44,222.06L242.15,223.07L244.14,224.65L245.64,226.2L246.48,227.68L246.65,228.93L246.16,230.31L243.92,233.62L242.89,234.94L241.8,235.81L240.57,236.25L235.88,237.38L233.57,238.58L232.79,239.54L232.36,240.52L232.36,241.34L233.39,243.98L233.78,245.51L233.46,246.84L232.63,247.79L230.93,249.32L230,250.54L230,251.88L231.58,254.34L233.57,256.44L233.87,257.39L233.76,259.34L232.46,261.44L234.07,261.81L235.24,261.18L235.29,260.73L236.3,261.84L237.58,261.89L236.34,259.78L237.55,259.56L237.76,258.91L238.96,258.32L239.05,257.5L240.41,257.57L241.22,259.34L243.04,258.46L244,260.63L245.18,260.36L244.73,259.46L245.24,258.93L247.1,258.56L247.87,259.56L248.11,260.43L250.3,260.1L250.76,260.44L251.53,259.97L253.47,259.43L253.74,259.82L254.72,259.58L255.53,260.84L256.05,260.32L256.91,260.15L257.54,261.64L258.64,262.22L259.51,261.59L259.12,261.02L260.11,260.87L260.43,261.25L261.05,260.56L261.5,261.13L262.5,261.51L261.86,262.17L262.99,263.31L262.91,263.61L263.71,264.69L263.2,264.88L263.6,265.61L264.71,266.37L264.85,267.3L263.93,267.86L263.14,267.86L263.04,267.32L262.26,267.84L259.88,268.42L259.86,269.04L258.91,269.44L259.55,270.73L260.5,271.53L261.41,271.29L261.6,270.77L263.04,270.47L263.68,270.84L265.65,271.12L266.24,271.61L266.56,271.21L267.39,271.61L264.97,272.84L263.38,273.18L263.4,273.44L261.76,273.74L262.24,274.12L261.15,274.27L260.26,274.96L261.52,275.64L259.94,276.19L259.72,276.77L258.91,276.82L258.48,277.46L258.86,278.96L257.25,279.34L257.24,279.88L256.45,280.35L256.93,281.45L256.67,282.3L258.06,282.09L258.67,281.62L259.23,281.82L259.54,281.34L260.23,281.38L260.88,280.89L261.32,281.9L261.6,281.79L262.49,282.8L263.22,283.17L262.38,283.89L262.39,287.41L261.99,287.65L262.04,289.24L261.2,289.75L260.26,289.64L260.09,290.39L260.69,291.12L261.44,291.08L261.43,290.59L262.13,290.59L262.63,289.36L263.91,290.3L265.42,289.28L265.21,289L266.46,288.56L267.23,290.37L267.2,291.11L266.04,291.81L265.66,293.07L264.41,293.24L265.14,293.83L265.63,293.66L266.19,295.24L265.8,295.58L265.95,296.3L265.07,296.75L265.87,297.55ZM384.2,228.63L383.75,231.1L384,234.03L384.71,237.7L385.72,241.03L387.18,243.95L389.4,246.46L391.32,247.02L392.94,247.01L394.55,246.61L400.86,245.98L402.07,244.62L405.58,237.35L406.03,236.06L406.22,230.36L405.72,228.01L404.93,226.88L398.93,225.76L396.08,224.62L392.43,223.93L388.65,223.88L386.68,224.39L385.26,225.8L384.2,228.63ZM364.96,220.57L364.4,222.01L364.93,225.41L365.76,227.03L367.07,228.78L370.99,233.08L373.26,235.04L374.87,235.49L376.44,235.34L377.6,234.54L378.55,231.81L379.21,225.92L378.96,224.1L377.95,222.79L375.38,221.93L369.64,220.17L367.27,220.02L364.96,220.57Z"},{"name":"金山区","adcode":310116,"x":142.27,"y":344.39,"d":"M83.75,312.8L83.78,314.6L83.41,314.69L83.99,315.71L85.05,316.79L84.8,317.75L84.67,324.34L84.46,325.74L86.24,325.82L86.22,326.56L85.6,327.23L84.38,326.88L84.35,327.69L83.43,327.59L82.5,328.08L82.46,328.85L81.76,330.1L82.54,330.7L82.83,332.05L86.38,332.32L87.49,332.54L87.42,334.17L88.31,334.41L90.33,334.25L90.69,334.89L91.6,335.5L90.95,336.17L91.74,336.65L91.07,337.02L91.28,337.69L90.43,337.22L89.49,337.96L90.43,338.49L89.22,340.07L89.95,340.56L89.68,341.3L88.27,342.72L89.55,343.49L89.03,344.1L88,343.64L87.33,344.46L86.84,344.49L86.05,345.88L85.1,346.02L84.76,346.75L84.08,346.52L83.41,348.27L82.52,348.32L81.61,349.49L81.34,350.25L82.39,350.49L81.34,351.4L82.49,352.35L81.9,353.3L83.07,353.69L84.96,351.17L85.88,352.16L86.99,350.74L88.25,349.52L89.36,349.14L89.51,349.73L94.33,351.45L96.42,354.65L96.82,356.1L99.06,355.58L98.68,354.16L97.19,354.61L96.75,354.08L97.23,353.89L97.57,352.77L98.04,352.45L97.47,351.87L98.6,351.57L99.1,352.29L100.31,352.52L99.63,350.64L102.67,349.21L104.48,348.51L103.91,346.93L104.36,346.74L104,346.17L106.05,345.03L110.33,345.04L115.8,342.38L115.79,343.07L117.25,344.56L118.05,344.85L119.99,344.19L120.71,343.35L121.21,344.17L122.9,344.92L123.24,344.59L124,345.51L122.96,346.77L122.83,348.53L122.16,349.3L123.08,348.98L125.32,349.19L126.05,349.43L126.56,349.08L127.52,350.03L126.98,350.48L127.41,351.46L128.03,351.66L128.41,350.99L128.41,352.56L126.81,354.39L126.12,355.57L125.48,357.27L124.8,362.72L124.97,364L124.55,364.26L122.89,364.14L122,364.93L123.96,367.19L125.27,367.28L126.63,367.71L127.97,367.7L128.81,367.36L129.42,367.83L130.54,367.02L133.25,367.18L134.25,367.75L135.79,367.94L135.81,369.01L136.67,368.36L138.42,368.14L139,367.78L139.06,368.55L140.23,369.39L141.91,368.64L143.02,368.43L143.76,367.92L143.94,367.16L144.95,367.18L145.4,366.51L145.68,367.22L147.31,368.97L148.37,368.88L148.01,366.62L148.3,365.81L150.03,364.98L152.63,364.98L153.98,365.29L155.7,368.14L156.09,367.82L156.59,368.42L156.82,369.77L157.51,370.68L158.01,372.02L158.53,374.53L160.11,375.54L161.95,376.21L162.48,376.64L166.17,378.3L167.74,380.12L169.49,381.62L169.91,381.16L170.95,382.01L170.42,382.5L170.95,383.7L170.6,384.04L171.14,384.87L170.53,385.75L170.6,386.89L169.56,387.48L170,388.4L169.18,389.24L169.44,390.25L169.87,390.32L170.07,391.58L170.71,391.76L170.63,392.87L171,393.24L171.97,399.43L177.17,399.13L188.5,399.89L194.82,400L197.26,399.56L199.66,398.75L213.98,386.51L220.13,382.64L236.76,374.37L232.41,367.97L228.17,361.04L226.59,358.74L226.18,358.96L224.98,358.34L223.51,354.76L220.01,354.58L218.27,354.23L217.88,355.42L216.56,355.49L216.68,354.18L216.26,353.6L215.68,353.68L213.28,353.18L212.07,351.81L211.98,350.95L212.91,351.03L213.09,349.78L211.67,349.66L210.93,349.94L210.8,351.63L209.24,351.68L209.13,351.01L207.82,351.03L207.82,350.1L206.6,349.75L205.17,347.78L205.11,346.78L207.14,346.8L206.97,345.25L206.59,344.08L206.8,342.66L206.51,341.71L206.68,340.36L206.02,340.27L206,339.14L206.32,338.59L206.3,336.86L205.89,336.19L206.11,335.45L204.63,335.12L202.79,333.94L202.29,333.87L201.36,333L200.1,332.91L199.44,331L199.21,329.47L198.56,328.58L198.01,326.03L196.46,324.57L196.08,325.15L195.12,324.59L193.93,325.87L192.76,326.05L191.64,326.63L191.02,326.31L189.89,326.38L188.79,325.55L188.25,325.92L186.85,325.91L186.4,325.25L184.65,325.86L184.41,325.37L182.18,325.53L182.08,324.92L181.2,324.93L181.11,325.82L180.58,326.08L179.53,325.67L178.83,324.02L178.37,324.02L178.41,322.89L176.47,323.4L176.43,325.62L176.86,325.65L177.16,327.92L176.89,328.76L176.43,328.78L176.34,330.02L175.51,330.22L175.34,329.84L174.4,329.86L174.33,330.42L173.55,330.53L173.38,329.68L171.97,330.01L171.44,328.64L170.63,328.71L170.19,328.23L169.28,328.22L169.52,326.78L168.12,326.6L167.99,326.2L166.99,326.48L166.01,326.23L165.8,325.74L163.07,325.62L162.14,323.1L162.72,323.35L162.43,322.32L161.9,322.45L161.18,320.78L160.39,320.88L159.31,320.52L159.22,319.7L156.95,320.27L155.57,319.01L154.03,319.98L151.77,322.01L150.66,322.45L146.63,323.27L144.39,323.5L143.98,323.88L140.23,323.97L139.15,324.11L137.77,323.38L137.04,322.44L135.01,322.32L134.54,322.75L134.4,324.76L134.51,325.6L133.32,325.53L132.35,324.76L129.91,323.82L130.26,323.02L128.93,322.54L128.41,324.53L129.26,325.49L129.12,326.42L129.54,327.18L129.63,328.34L127.46,328.19L126.59,328.85L126.1,327.94L124,327.86L123.58,328.41L122.3,328.29L120.8,329.58L120.05,329.01L119.97,328.44L120.82,327.62L122.18,325.37L122.67,324.96L123.34,322.43L121.16,321.89L120.01,321.86L118.16,322.37L117.91,321.54L116.66,320.37L113.79,323.63L113.05,323.91L113.07,324.96L114.56,325.69L115.32,325.49L116.14,326.67L115.62,327.75L114.7,327.96L114.74,327.24L113.88,327.68L111.36,327.09L110.75,327.42L110.45,326.88L107.78,327.2L107.8,327.76L106.68,328.09L106.35,327.34L102.73,327.7L101.62,327.7L99.13,328.17L98.22,328.95L97.76,328.54L97.59,327.34L97.1,328.09L95.71,327.9L95.79,326.81L92.81,325.89L92.69,325.08L93,323.45L93.78,321.59L93.9,320.03L94.79,317.31L94.9,316.14L94.19,315.48L94.28,314.66L93.69,314.82L90.97,315.7L90.16,315.65L90.4,316.32L89.64,315.98L89.18,314.75L88.47,314.93L88.3,313.79L89.02,313.91L89.66,313.48L88.02,312.66L87.21,313.65L85.63,313.84L85.44,312.57L83.75,312.8ZM220.22,397.91L220.26,398.5L220.83,398.05L220.22,397.91ZM218.89,394.96L217.94,394.91L217.94,395.47L219.81,396.26L220.93,395.71L220.21,395.02L218.89,394.96ZM213.91,390.67L213.86,391.27L214.71,390.82L213.91,390.67Z"},{"name":"松江区","adcode":310117,"x":149.34,"y":292.61,"d":"M187.59,245.3L187.15,245.48L186.66,246.72L185.75,247.01L185.16,246.18L180.47,247.67L178.57,248.17L175.93,248.68L175.39,248.31L174.66,248.73L174.88,249.14L173.76,249.24L172.96,248.69L173.26,249.97L172.53,250.73L172.72,251.26L173.44,250.77L174.23,251.94L174.99,251.75L176.04,252.6L173.98,254.73L169.14,253.73L169.09,254.24L168.47,254.04L167.52,255.04L167.83,256.66L166.67,256.69L166.7,255.01L165.34,254.92L163.19,254.44L162.71,255.52L160.76,255.77L162.66,255.98L162.41,257.22L160.92,256.95L159.96,257.12L159.64,259.26L159.03,259.78L155.92,260.47L155.03,260.5L155.17,258.95L155.76,256.89L156.77,254.44L157.16,252.87L154.8,253.1L150.9,253.95L150.23,253.12L148.38,253.27L148.79,252.29L148.16,252.72L146.6,253.16L142.55,251.48L142.45,255.19L141.88,255.16L142.03,256.58L142.51,256.72L142.5,257.57L143.15,257.57L143.14,259.35L141.56,259.84L140.79,259.25L140.12,259.61L140.4,260.44L139.7,260.81L140.17,262.57L138.91,262.41L138.93,262.8L137.62,262.64L137.73,263.92L137.23,263.93L137.32,264.83L135.44,265.11L133.8,264.7L133.78,265.64L134.56,265.62L134.54,267.46L134.11,267.45L134.04,268.3L133.5,268.41L133.31,267.81L132.77,267.93L132.23,266.77L131.09,267.2L130.65,266.09L129.83,266.27L129.74,265.7L127.88,265.89L127.11,265.58L126.67,264.63L126.27,265.11L125.32,264.23L124.63,264.21L123.18,262.82L122.16,262.46L121.65,261.8L121.09,262.17L120.53,261.49L119.31,263.01L117.66,264.44L117.75,265.11L116.73,265.78L115.89,265.49L116.48,266.36L116.38,267.14L115.77,267.33L116.8,268.87L116.34,269.74L116.75,271.33L117.45,271.56L118.84,270.96L120.53,272.38L121.96,273.02L122.37,272.92L123.37,274.74L123.59,275.7L124.86,275.87L124.91,278.04L125.34,278.06L124.75,278.81L123.1,278.85L122.24,278.48L122.31,279.23L119.27,279.05L119.19,278.63L117.11,278.84L116.89,280L116,279.05L114.83,279.14L114.31,278.47L114.8,277.38L114.29,276.54L112.79,276.5L112.07,277.07L112.25,277.61L111.58,278.37L110.49,278.96L110.94,279.82L112.04,281.08L112.45,280.22L113.33,280.54L113.44,281.74L115.33,282.8L114.34,284.1L115.22,284.18L115.82,284.69L116.62,286.42L116.51,287.12L115.57,287.04L115.39,288.63L113.73,288.79L113.2,288.17L111.94,288.93L114.32,290.61L117.18,293.29L117.86,294.49L117.83,298.59L116.58,298.63L116.28,302.74L116.43,303.06L116.27,305.57L115.12,305.2L115.19,307.05L115.73,307.93L114.48,308.24L112.73,308.4L112.78,309.04L110.57,309L110.42,309.66L109.72,309.71L109.9,310.27L109.11,310.49L109.07,311.05L107.74,311.28L105.53,311.26L103.94,310.83L103.68,309.98L102.85,309.12L102.99,308.02L101.69,308.31L100.98,306.75L99.84,306.85L99.61,306.47L98.47,306.73L99.37,308.63L98.32,309.58L98.6,310.51L97.61,310.83L96.3,310.64L95.79,311.95L95.33,313.81L93.64,314.22L93.69,314.82L94.28,314.66L94.19,315.48L94.9,316.14L94.79,317.31L93.9,320.03L93.78,321.59L93,323.45L92.69,325.08L92.81,325.89L95.79,326.81L95.71,327.9L97.1,328.09L97.59,327.34L97.76,328.54L98.22,328.95L99.13,328.17L101.62,327.7L102.73,327.7L106.35,327.34L106.68,328.09L107.8,327.76L107.78,327.2L110.45,326.88L110.75,327.42L111.36,327.09L113.88,327.68L114.74,327.24L114.7,327.96L115.62,327.75L116.14,326.67L115.32,325.49L114.56,325.69L113.07,324.96L113.05,323.91L113.79,323.63L116.66,320.37L117.91,321.54L118.16,322.37L120.01,321.86L121.16,321.89L123.34,322.43L122.67,324.96L122.18,325.37L120.82,327.62L119.97,328.44L120.05,329.01L120.8,329.58L122.3,328.29L123.58,328.41L124,327.86L126.1,327.94L126.59,328.85L127.46,328.19L129.63,328.34L129.54,327.18L129.12,326.42L129.26,325.49L128.41,324.53L128.93,322.54L130.26,323.02L129.91,323.82L132.35,324.76L133.32,325.53L134.51,325.6L134.4,324.76L134.54,322.75L135.01,322.32L137.04,322.44L137.77,323.38L139.15,324.11L140.23,323.97L143.98,323.88L144.39,323.5L146.63,323.27L150.66,322.45L151.77,322.01L154.03,319.98L155.57,319.01L156.95,320.27L159.22,319.7L159.31,320.52L160.39,320.88L161.18,320.78L161.9,322.45L162.43,322.32L162.72,323.35L162.14,323.1L163.07,325.62L165.8,325.74L166.01,326.23L166.99,326.48L167.99,326.2L168.12,326.6L169.52,326.78L169.28,328.22L170.19,328.23L170.63,328.71L171.44,328.64L171.97,330.01L173.38,329.68L173.55,330.53L174.33,330.42L174.4,329.86L175.34,329.84L175.51,330.22L176.34,330.02L176.43,328.78L176.89,328.76L177.16,327.92L176.86,325.65L176.43,325.62L176.47,323.4L178.41,322.89L178.37,324.02L178.83,324.02L179.53,325.67L180.58,326.08L181.11,325.82L181.2,324.93L182.08,324.92L182.18,325.53L184.41,325.37L184.65,325.86L186.4,325.25L186.85,325.91L188.25,325.92L188.79,325.55L189.89,326.38L191.02,326.31L191.64,326.63L192.76,326.05L193.93,325.87L195.12,324.59L196.08,325.15L196.46,324.57L197.5,323.58L197.81,322.5L197.59,321.98L196.57,321.21L196.59,319.81L196.26,319.04L197.69,318.59L197.38,318.13L198.22,318.09L198.85,317.63L199.91,317.73L199.83,316.35L199.42,314.78L200.29,314.43L200.8,313.77L199.85,313.24L199.78,312.36L200.05,310.96L199.97,309.87L199.38,307.95L199.52,306.41L199.05,304.56L198.65,304.05L196.29,304.65L193.9,304.45L190.94,303.15L189.4,302.95L188.7,303.16L188.21,302.33L188.55,300.21L188.51,298.78L188.74,298.33L189.65,298.01L192.15,295.06L192.66,293.77L194.06,292.6L193.6,292.32L192.68,292.63L190.51,292.79L190.72,292.05L190.77,288.48L190.59,287.28L190.81,286.89L190.7,284.11L191.16,282.54L191.23,277.84L193.17,277.1L193.81,278.25L196.98,277.57L198.49,276.69L198.2,275.83L200.25,275.33L200.47,274.84L199.73,273.98L200.44,273.63L200.8,272.3L201.86,271.91L202.43,272.15L202.88,271.67L201.69,268.78L199.94,265.35L198.77,265.62L198.55,265.03L196.31,265.52L195.42,263.17L196.42,262.83L196.59,263.22L198.11,261.94L197.8,261.3L197.09,261.63L196.1,260.34L196.86,259.69L195.76,259.65L194.86,258.41L195.11,258.31L194.27,257.1L194.62,256.96L193.99,255.93L194.2,255.65L193.38,254.28L191.69,252.91L192.34,252.53L191.67,251.46L191.28,251.36L190.72,249.8L189.95,249.48L190.02,248.76L189.15,247.29L188.66,247.23L187.59,245.3Z"},{"name":"青浦区","adcode":310118,"x":115.49,"y":258.68,"d":"M133.59,209.21L132.53,209.59L130.18,209.58L130.14,208.89L129.6,209.18L128.47,208.91L128.6,208.54L126.59,207.71L126.39,208.11L125.17,207.76L124.25,207.16L124.47,206.75L122.99,206.19L122.65,206.52L121.29,206.47L120.06,207.59L118.65,209.19L117.75,209.63L118.26,210.16L116.15,209.33L115.07,205.92L114.34,205.54L113.4,204.36L112.37,204.43L112.51,204.76L111.67,205.73L110.61,209.02L111.62,209.51L110.87,210.83L110.31,211.27L107.88,211.59L106.59,211.92L104.86,211.98L104.45,215.15L104.14,218.78L103.09,218.7L104.36,219.18L105.21,218.89L104.96,220.14L105.07,221.34L104.23,221.53L104.66,222.53L105.29,223.07L106.18,223.09L106.11,223.72L105.31,223.77L105.33,224.88L104.72,224.98L104.67,225.71L105.61,229.77L106.31,233.22L106.76,234.64L105.93,234.43L105.99,235.14L106.88,235.03L107.04,235.57L107.7,235.71L107.82,236.23L107.2,236.3L107.12,237.11L107.54,238L106.61,238.34L106.84,238.97L108.59,238.5L108.78,238.98L107.4,239.42L107.45,240.05L108.35,241.09L108.73,241.97L107.81,242.2L107.76,243.19L108.74,242.96L109.35,244.79L108,245.2L108.18,245.69L109.16,245.4L108.93,246.07L109.24,246.73L108.23,247.17L107.66,248.3L106.3,248.68L106.73,249.82L105.65,249.86L105.76,249.11L105.15,249.14L104.65,248.42L103,248.53L102.51,249.2L100.75,249.18L100.38,247.95L99.2,248.13L99.15,248.91L97.95,249.47L97.97,250.38L99,250.83L98.06,252.93L97.06,253.57L96.3,253.42L96.25,252.48L95.29,251.88L93.92,252.19L93.79,251.35L93.27,251.39L92.94,252.34L91.86,252.44L92.03,253.12L90.66,254.46L87.09,254.67L82.01,254.75L79.68,255.22L69.75,253.14L62.68,252.14L58.42,253.79L54.76,254.42L52.79,253.84L47.11,254.26L45.56,255.29L44.27,256.66L43.84,257.73L43.71,259.02L42.24,260.6L41.06,261.31L40.42,262.32L39.69,262.58L39.33,264.38L40.27,265.19L41.61,265.19L42.17,266.04L43.39,266.17L43.46,265.62L44.33,265.64L44.53,265.18L45.63,265.3L45.43,265.96L46.37,265.8L46.09,266.63L49.07,267.16L50.19,267.09L50.26,266.18L50.77,266.38L50.56,267.12L51.59,268.23L52,269.52L52.82,269.43L53.72,269.84L53.58,270.33L54.55,271.47L54.51,272.1L52.92,272.15L52.68,274.64L51.75,277L51.34,278.4L51.32,279.92L51.6,281.05L52.16,281.72L52.1,282.56L52.96,284.45L53.67,285.07L53.47,288.93L53.22,290.54L53.48,291.47L56.24,291.65L56.2,293.01L56.54,293.67L58.79,292.96L61.35,293.72L61.61,293.19L63.01,293.28L63.77,293.84L65.13,294.17L65.77,293.84L64.39,292.14L64.57,291.59L68.91,291.43L69.29,289.4L68.51,289.07L68.64,287.52L69.26,287.79L69.61,287.42L71.55,287.95L72.24,290.15L73.45,290.43L73.63,290.75L73.11,291.76L75.33,291.9L79.39,291.92L79.66,292.44L81.46,292.45L81.61,293.69L82.23,294.44L81.95,294.65L82.28,295.94L82.26,297.94L81.56,298.08L81.78,298.75L83.15,298.53L83.07,299.59L83.88,300.44L84.58,303.34L85.05,303.22L85.54,304.13L84.97,304.32L84.95,305.3L83.95,305.77L82.61,305.87L82.07,307.06L82.79,308.44L82.44,308.82L83.12,310.13L82.15,310.29L82.42,311.3L83.14,311.36L83.32,312.78L83.75,312.8L85.44,312.57L85.63,313.84L87.21,313.65L88.02,312.66L89.66,313.48L89.02,313.91L88.3,313.79L88.47,314.93L89.18,314.75L89.64,315.98L90.4,316.32L90.16,315.65L90.97,315.7L93.69,314.82L93.64,314.22L95.33,313.81L95.79,311.95L96.3,310.64L97.61,310.83L98.6,310.51L98.32,309.58L99.37,308.63L98.47,306.73L99.61,306.47L99.84,306.85L100.98,306.75L101.69,308.31L102.99,308.02L102.85,309.12L103.68,309.98L103.94,310.83L105.53,311.26L107.74,311.28L109.07,311.05L109.11,310.49L109.9,310.27L109.72,309.71L110.42,309.66L110.57,309L112.78,309.04L112.73,308.4L114.48,308.24L115.73,307.93L115.19,307.05L115.12,305.2L116.27,305.57L116.43,303.06L116.28,302.74L116.58,298.63L117.83,298.59L117.86,294.49L117.18,293.29L114.32,290.61L111.94,288.93L113.2,288.17L113.73,288.79L115.39,288.63L115.57,287.04L116.51,287.12L116.62,286.42L115.82,284.69L115.22,284.18L114.34,284.1L115.33,282.8L113.44,281.74L113.33,280.54L112.45,280.22L112.04,281.08L110.94,279.82L110.49,278.96L111.58,278.37L112.25,277.61L112.07,277.07L112.79,276.5L114.29,276.54L114.8,277.38L114.31,278.47L114.83,279.14L116,279.05L116.89,280L117.11,278.84L119.19,278.63L119.27,279.05L122.31,279.23L122.24,278.48L123.1,278.85L124.75,278.81L125.34,278.06L124.91,278.04L124.86,275.87L123.59,275.7L123.37,274.74L122.37,272.92L121.96,273.02L120.53,272.38L118.84,270.96L117.45,271.56L116.75,271.33L116.34,269.74L116.8,268.87L115.77,267.33L116.38,267.14L116.48,266.36L115.89,265.49L116.73,265.78L117.75,265.11L117.66,264.44L119.31,263.01L120.53,261.49L121.09,262.17L121.65,261.8L122.16,262.46L123.18,262.82L124.63,264.21L125.32,264.23L126.27,265.11L126.67,264.63L127.11,265.58L127.88,265.89L129.74,265.7L129.83,266.27L130.65,266.09L131.09,267.2L132.23,266.77L132.77,267.93L133.31,267.81L133.5,268.41L134.04,268.3L134.11,267.45L134.54,267.46L134.56,265.62L133.78,265.64L133.8,264.7L135.44,265.11L137.32,264.83L137.23,263.93L137.73,263.92L137.62,262.64L138.93,262.8L138.91,262.41L140.17,262.57L139.7,260.81L140.4,260.44L140.12,259.61L140.79,259.25L141.56,259.84L143.14,259.35L143.15,257.57L142.5,257.57L142.51,256.72L142.03,256.58L141.88,255.16L142.45,255.19L142.55,251.48L146.6,253.16L148.16,252.72L148.79,252.29L148.38,253.27L150.23,253.12L150.9,253.95L154.8,253.1L157.16,252.87L156.77,254.44L155.76,256.89L155.17,258.95L155.03,260.5L155.92,260.47L159.03,259.78L159.64,259.26L159.96,257.12L160.92,256.95L162.41,257.22L162.66,255.98L160.76,255.77L162.71,255.52L163.19,254.44L165.34,254.92L166.7,255.01L166.67,256.69L167.83,256.66L167.52,255.04L168.47,254.04L169.09,254.24L169.14,253.73L173.98,254.73L176.04,252.6L174.99,251.75L174.23,251.94L173.44,250.77L172.72,251.26L172.53,250.73L173.26,249.97L172.96,248.69L173.76,249.24L174.88,249.14L174.66,248.73L175.39,248.31L175.93,248.68L178.57,248.17L180.47,247.67L185.16,246.18L185.75,247.01L186.66,246.72L187.15,245.48L187.59,245.3L185.91,242.98L185.74,241.91L185.19,240.89L183.44,238.54L182.73,237.22L180.2,234.48L179.22,233.09L178.38,232.56L177.61,232.74L177.52,233.34L175.99,234.7L174.95,235.32L172.84,235.58L171.03,234.08L169.45,232.5L168.83,232.49L168.29,231.73L168.8,231.4L168.54,230.71L167.13,229.49L167.71,228.75L167.22,227.78L166.51,227.12L166.75,226.31L166.24,225.18L166.69,225.01L166.42,223.79L165.46,223.03L165.03,221.8L164.49,221.41L164.05,221.94L163.48,220.55L161.41,220.77L160.95,220.5L161.5,218.51L162.85,218.04L163.29,216.62L165.47,214.91L163.12,214.99L163.06,214.56L161.69,214.69L160.24,213.83L159.44,213.64L157.51,213.63L157.54,213.95L155.74,214.32L155.85,214.8L154.69,215.32L155.03,215.67L152.77,216.29L152.28,214.54L151.37,214.23L151.39,215.12L150.97,215.29L150.29,214.47L149.18,215.4L149.27,215.82L148.22,216L147.03,216.59L147.09,217.28L146.17,217.21L146.06,216.52L144.58,216.16L143.97,216.93L143.17,216.95L142.41,216.27L141.71,216.58L141.54,215.81L140.9,216.21L140.1,215.49L139.2,216.1L138.41,215.7L138.87,214.77L138.13,214.61L138.01,213.24L136.41,211.58L135.91,212.07L134.89,211.15L134.16,212.54L132.97,212.07L133.65,210.66L133.59,209.21Z"},{"name":"奉贤区","adcode":310120,"x":252.97,"y":320.5,"d":"M265.87,297.55L263.02,298.41L261.25,298.56L261.35,299.13L260.42,299.24L260.26,300.56L259.23,300.74L258.14,299.23L257.24,298.86L255.64,299.2L255.49,298.71L254.45,298.34L253.65,298.67L252.58,298.32L250.77,297.08L249.95,297.23L249.88,296.21L250.52,296.33L250.12,295.61L248.9,294.6L246.81,295.58L246,295.52L244.47,296.16L243.13,297.21L243.14,297.59L242.21,297.56L240.95,293.84L241.24,292.98L240.06,292.28L239.02,292.56L236,292.79L234.44,293.23L232.58,294.25L230.79,294.68L227.09,294.66L224.71,295.19L223.45,295.74L222.44,296.46L221.73,297.29L219.37,298.77L215.94,299.86L214.72,300.13L209.94,300.75L203.89,302.47L198.65,304.05L199.05,304.56L199.52,306.41L199.38,307.95L199.97,309.87L200.05,310.96L199.78,312.36L199.85,313.24L200.8,313.77L200.29,314.43L199.42,314.78L199.83,316.35L199.91,317.73L198.85,317.63L198.22,318.09L197.38,318.13L197.69,318.59L196.26,319.04L196.59,319.81L196.57,321.21L197.59,321.98L197.81,322.5L197.5,323.58L196.46,324.57L198.01,326.03L198.56,328.58L199.21,329.47L199.44,331L200.1,332.91L201.36,333L202.29,333.87L202.79,333.94L204.63,335.12L206.11,335.45L205.89,336.19L206.3,336.86L206.32,338.59L206,339.14L206.02,340.27L206.68,340.36L206.51,341.71L206.8,342.66L206.59,344.08L206.97,345.25L207.14,346.8L205.11,346.78L205.17,347.78L206.6,349.75L207.82,350.1L207.82,351.03L209.13,351.01L209.24,351.68L210.8,351.63L210.93,349.94L211.67,349.66L213.09,349.78L212.91,351.03L211.98,350.95L212.07,351.81L213.28,353.18L215.68,353.68L216.26,353.6L216.68,354.18L216.56,355.49L217.88,355.42L218.27,354.23L220.01,354.58L223.51,354.76L224.98,358.34L226.18,358.96L226.59,358.74L228.17,361.04L232.41,367.97L236.76,374.37L248.96,368.32L260.27,363.88L275.67,358.9L290.61,355.37L301.02,354.67L315.58,354.89L332.11,355.04L336.75,355.16L329,344.5L328.62,340.43L329.72,336.57L329.99,336.48L330.2,334.93L331.33,334.8L331.12,333.08L332,330.48L332.06,328.94L331.85,327.56L332.05,325.56L332.46,325.02L332.73,323.19L331.64,320.28L331.68,318.92L330.28,318.75L330.17,318L329.13,317.57L328.57,316.6L328.07,317.17L327.25,317.07L327.39,316.54L326.5,316.57L326.56,316.03L327.47,315.51L326.33,314.61L326.36,313.66L325.81,313.16L323.49,312.03L322.61,311.93L322.18,312.29L320.87,310.8L319.68,310.76L318.69,310.13L319.02,309.52L317.76,308.3L317.12,307.25L311.05,303.08L308.73,301.79L306.82,301.02L304.76,300.41L303.2,300.15L301.78,300.26L298.91,299.63L298.53,300.25L297.31,299.69L295.28,299.34L292.56,299.17L290.07,299.14L281.77,299.35L280.87,298.39L279.92,296.63L276.53,296.67L273.84,296.38L273.56,296.8L270.26,296.76L269.83,297.18L267.86,297.19L265.87,297.55Z"},{"name":"崇明区","adcode":310151,"x":298.75,"y":136.84,"d":"M394.34,101.16L366.54,95.02L344.38,90.05L311.83,83.13L288.78,75.63L285.81,76.04L283.92,75.53L278.98,73.47L276.12,72.62L275.53,72.6L275.14,73.84L273.1,73.12L272.79,72.77L268.43,71.48L264.14,69.52L259.81,66.13L259.22,66.26L256.24,64.25L256.02,63.56L252.5,62.65L251.97,62.06L248.26,61.22L247.64,60.95L243.05,57.92L239.61,57.87L236.14,57L232.12,56.69L229.4,55.99L227.55,55.25L226.16,54.41L221.75,52.84L219.94,51.25L218.4,49.56L215.22,44.49L216.94,43.83L215.41,41.07L213.49,39.96L211.49,37.53L210.29,36.32L207.01,32.44L204.26,30.84L202.01,29.34L187.34,21.33L185.05,20.39L183.31,20.07L180.62,20L177.21,20.55L174.09,21.17L169.09,22.73L164.81,24.76L161.63,26.13L156.31,28.15L148.38,31.93L142.4,36.6L132.16,47.12L122.4,56.07L129.88,57.27L130.92,57.71L141.88,68.23L176.56,101.4L194.49,115.56L202.94,121.42L210.32,111.19L212.88,109.74L216.46,109.4L222.62,109.64L234.35,114.68L258.63,128.43L278.04,136.12L280.86,137.14L283.43,137.75L287.51,138.4L297.66,140.15L301.55,141.15L316.47,147.21L327.13,151.57L344.82,157.93L349.59,159.27L353.13,159.93L357.08,160.52L361.9,160.74L364.79,160.96L367.47,160.92L370.84,160.49L376.2,159.04L381.36,156.61L391.83,152.07L396.44,149.71L399.58,145.69L400.86,140.5L400.27,134.54L398.49,128.92L394.34,101.16ZM332.02,198.56L334.12,198.29L335.89,199.14L337.68,199.46L338.34,198.51L337.42,192.28L337.61,190.55L337.46,187.31L336.51,184.31L336.31,181.7L335.83,180.51L334.88,179.06L332.56,176.35L330.52,174.19L329.01,172.99L326.3,171.58L324.04,169.94L320.38,167.76L318.89,167.26L316.29,166.77L314.51,166.13L309.63,163.79L306.1,162.44L303.27,161.84L298.68,161.25L282.15,156.04L277.25,154.37L275.18,153.97L270.66,152.7L269.86,152.19L267.57,149.8L266.61,148.01L264.88,143.55L263.29,142.64L259.35,141.56L250.21,140.22L248.88,140.12L247.77,140.42L246.47,141.55L246.39,142.96L246.72,143.84L248.85,145.51L252.87,147.46L255.38,148.88L257.24,150.24L259.3,151.94L262.06,154.56L266.44,158.6L272.19,161.31L275.7,163.12L288.27,169.7L302.76,177.48L315.85,184.4L319.93,187.04L321.16,187.93L323.23,189.8L326.27,195.34L327.38,196.94L329.51,198.09L332.02,198.56ZM479.04,164L479.53,164.39L480.67,163.92L480.1,163.29L479.04,164ZM339.29,183.71L339.58,188.21L339.73,191.6L339.92,192.77L340.84,194.12L342.92,196.64L345.91,199.46L348.9,201.25L349.4,201.91L351.61,203.24L355.52,204.22L356.72,204.08L358.02,203.4L359.67,203.4L367.17,204.33L370.71,204.6L380.71,207.15L394.53,208.15L407.44,207.42L425.07,212.33L429.92,215.27L433.25,215.87L435.61,213.82L441.16,199.51L440.93,196.9L439.25,195.06L426.98,194.33L415.25,194.24L402.71,192.51L386.89,189.96L374.62,185.78L361.07,180.84L357.3,179.77L355.52,179.14L353.2,178.12L348.81,177.82L347.74,177.53L346.58,176.85L344.27,176.22L339.83,176.01L337.7,176.06L336.78,176.25L336.45,177.17L337.99,179.69L338.91,181.48L339.29,183.71ZM283.83,155.77L285.25,155.74L286.04,155.47L286.77,154.22L286.37,153.23L285.28,152.02L283.23,150.31L279.58,147.41L277.96,146.42L275.92,145.66L273.75,145.2L271.08,144.81L267.99,144.87L267.57,145.23L267.66,146.32L268.22,147.04L270.89,149.71L273.39,151.46L279.64,154.85L280.6,155.25L283.83,155.77Z"}]},"guangdong":{"viewBox":"0 0 520 420","regions":[{"name":"广州市","adcode":440100,"x":269.17,"y":176.32,"d":"M256.25,215.84L259.25,217.73L260.14,218.04L261.52,218.18L262.8,218.64L262.6,219.12L264.33,220.47L266.33,221.78L267.43,222.61L266.95,223.24L267.19,223.8L268.77,226.35L269.85,226.53L270.57,227.13L271.19,227.18L272.53,228.13L273.72,230.12L274.5,232.19L277.07,232.23L279.37,231.79L280.16,231.01L278.65,223.95L276.64,219.33L276.19,218.8L274.28,216.53L271.98,213.95L270.2,212.1L269.38,210.71L269.63,208.47L268.94,207.28L268.06,205.42L267.5,203.94L266.7,202.46L266.31,200.63L266.3,198.98L266.88,198.11L267.63,197.39L267.96,196.52L268.43,196.18L270.35,195.77L271.3,195.28L271.88,194.75L273.77,194.74L273.93,194.13L274.48,193.76L275.11,193.84L275.16,194.26L275.71,193.94L276.8,193.73L278.66,192.51L280.04,192.36L281.02,193.1L282.51,193.01L283.39,193.23L284.88,193.22L286.56,193.96L286.79,193.36L287.12,191.88L287.69,191.34L288.71,190.82L290.04,190.88L290.45,190.07L289.61,189.98L289.28,189.15L289.93,187.81L290.56,187.82L289.68,185.94L290.01,185.21L288.86,184.53L289.7,183.36L289.58,182.86L290,181.32L289.64,180.08L290.06,179.38L292.06,179.71L292.82,179.52L294.07,180.18L294.04,181.3L295.25,181.94L295.3,182.19L296.47,182.42L296.44,181.66L295.68,180.31L296.3,180.14L296.74,179.28L296.08,178.76L295.54,177.2L296.43,176.73L296.71,176.31L295.84,175.53L295.68,174.53L295.91,173.88L295.11,174.01L294.14,173.8L293.68,173.15L293.85,171.68L295.06,171.75L295.52,171.29L295.04,170.86L294.2,170.77L292.78,171L292.3,170.6L292.92,170.56L293.28,169.99L292.22,169.89L291.79,169.32L291.05,169.25L290.72,168.76L289.88,168.23L289.56,167.28L288.49,166.89L287.93,165.29L287.31,165.02L288.02,163.95L287.66,163.56L287.74,162.51L286.72,162.01L286.13,162.03L286,161.6L285.06,161.65L285.01,160.87L285.57,160.61L285.72,160.09L285.14,159.57L286.49,159.62L286.99,158.1L289.16,157.73L290.16,156.77L290.38,155.8L291.1,155.73L291.59,154.91L292.64,154.73L292.88,154.35L293.88,154.7L294.2,154.35L294.95,154.28L295.16,153.11L296.6,152.77L297.52,151.82L297.81,151.8L297.32,152.77L297.84,152.78L298.27,153.44L298.43,152.95L299.13,152.25L300.5,151.95L300.27,151.43L299.05,150.83L299.72,150.2L298.93,149.56L299.25,148.86L300.01,148.5L300.36,147.43L299.9,146.93L299.72,146.12L299.35,145.86L299.4,144.69L298.99,143.93L298.68,143.64L298.84,142.84L297.83,142.44L297.22,141.94L295.7,142.38L295.54,142.16L293.67,142.16L292.94,142.54L292.64,142.22L290.81,142.48L289.84,142.03L289.52,142.52L289.03,142.11L288.1,142.2L287.2,142.75L286.59,142.85L284.41,144.02L283.96,143.88L283.41,143.8L282.74,144.28L282.38,145.45L281.85,145.86L281.28,146.75L280.7,146.95L280.27,146.65L279.72,146.91L278.44,146.43L278.2,146.83L278.73,147.62L278.52,148.19L278.86,148.81L277.99,149.44L276.78,148.78L276.58,149.59L275.44,149.54L274.5,149.13L273.77,149.5L273.36,150.59L272.18,151.7L272.88,152.49L273.53,153.58L273.17,154.3L273.53,154.74L273.23,155.01L273,156.04L273.64,156.49L272.65,156.82L272.73,157.12L271.95,157.66L272.21,158.04L271.04,159.01L270.4,158.75L270.4,158.36L269.18,158.09L269.18,157.4L268.59,156.74L267.83,156.62L267.74,157.01L266.57,157.66L265.5,157.9L263.64,157.8L262.85,157.35L262.57,156.27L261.27,155.77L260.92,155.05L258.75,155.29L258.34,154.84L257.1,154.77L256.72,156.16L256.33,156.12L255.13,158.87L254.56,158.96L254.33,159.56L253.89,159.61L253.91,160.26L252.81,160.39L251.42,160.32L252.07,160.76L251.51,162.06L250.84,162.58L250.62,162.13L248.83,163.05L248.31,162.75L248.66,163.9L247.51,163.5L247.46,164.06L246.67,164.15L245.88,164.65L245.79,165.58L246.39,166.14L246.5,166.72L245.18,168.04L245.24,168.58L243.96,168.73L242.78,169.34L241.2,168.71L239.95,169.65L238.35,169.88L237.81,170.52L237.07,170.63L236.56,171.3L235.74,171.16L234.15,171.49L233.3,171.93L232.58,171.63L231.42,171.83L231.28,172.7L230.58,173.05L230.47,174.23L231.36,173.71L231.64,173.24L232.31,173.13L231.91,173.69L232.28,174.62L233.07,175.48L232.41,175.72L232.26,176.51L231.77,177.14L232.36,178.77L233.81,178.9L234.17,179.62L235.22,178.6L235.77,179L234.76,180.12L234.5,180.67L235.4,180.97L235.07,182.2L235.71,183.31L236.28,183.63L236.36,184.58L235.87,185.3L236.41,185.22L237.48,185.51L238.09,185.43L238.22,184.69L237.61,183.25L238.49,183.19L238.77,182.89L239.73,182.91L240.02,182.51L239.74,182.08L240.95,181.76L241.16,181.33L242.61,182.38L242.6,182.89L243.25,183.1L244.32,184.08L244.6,185.34L244.24,186.29L244.31,187.29L245.17,187.67L246.05,188.55L246.31,189.12L246.34,190.08L244.96,191.22L244.9,191.91L245.23,192.22L246.47,192.27L246.36,193.6L245.98,193.59L246.26,195.01L246.75,194.95L246.3,196.04L245.34,196.01L244.29,196.47L244.78,197.56L245.47,197.78L246.48,198.6L247.38,198.69L249.24,198.5L249.46,200.46L248.92,200.78L249.05,203.24L250.04,203.98L251.16,204.47L251.99,205.56L250.99,205.98L251.21,207.63L250.65,208.06L252.14,209.18L252.19,209.88L251.87,210.11L252.72,210.83L252.88,212.16L254.4,212.95L256.2,212.6L256.85,212.65L258.06,213.47L257.4,214.13L255.71,214.54L256.25,215.84Z"},{"name":"韶关市","adcode":440200,"x":289.68,"y":89.66,"d":"M283.96,143.88L284.41,144.02L286.59,142.85L287.2,142.75L288.1,142.2L289.03,142.11L289.52,142.52L289.84,142.03L290.81,142.48L292.64,142.22L292.94,142.54L293.67,142.16L295.54,142.16L295.7,142.38L297.22,141.94L297.83,142.44L298.84,142.84L298.68,143.64L298.99,143.93L299.31,143.6L300.3,141.76L301.42,142.08L301.5,142.49L304.13,142.15L304.31,141.75L305.78,141.47L306.75,141.51L307.1,140.63L307.78,140.26L308.56,140.46L308.91,141.19L309.55,141.42L310.27,141.11L310.5,141.33L311.87,141.38L312.24,140.97L313.16,140.69L313.45,140.21L313.99,140.26L313.99,140.96L312.67,141.47L312.9,141.84L312.47,142.15L311.76,143.37L312.52,143.63L313.44,143.34L313.77,143.87L314.49,143.98L315.03,143.7L315.99,144.59L317.16,144.4L317.79,144.01L318.96,144.81L319.77,143.98L319.64,143.38L320.1,143.25L320.27,142.3L321.04,142L320.75,141.32L321.31,140.46L321.19,139.73L321.5,139.56L321.07,138.83L321.22,138.03L321.64,138.21L321.23,137.43L321.5,136.87L322.12,136.53L322.03,136.02L322.95,135.93L323.45,136.43L323.79,135.58L324.75,135.56L324.48,134.59L324.56,133.72L325.07,133.18L326.21,132.84L327.33,132.16L328.09,130.88L327.86,130.42L328.26,130.12L329.12,130.88L329.98,129.77L330.3,129.03L330.69,128.84L330.8,129.76L331.5,129.37L331.97,129.76L332.7,129.01L332.22,128.09L332.87,127.53L334.51,127.23L334.89,126.54L334.3,125.72L334.31,124.71L334.74,124.15L334.34,123.29L333.44,123.21L332.73,122.84L332.09,122.02L331.6,122.99L329.31,124.25L329.23,124.6L327.99,125.43L327.32,126.71L326.88,127.09L326.64,126.74L326.01,126.88L326.15,127.37L326.6,127.35L326.57,128.48L326.23,128.75L326.87,129.07L327.44,130.11L327.19,130.49L326.22,130.62L325.14,129.96L324.67,129.91L324.27,129.19L323.57,129.32L323.42,128.81L321.74,128.7L320.81,128.82L319.93,129.26L319.11,128.56L318.38,129.03L318.17,129.7L317.69,129.6L317.71,128.94L316.83,128.3L316.2,127.15L315.33,126.53L315.1,126.1L315.66,125.25L315.21,124.46L314.14,124.13L314.19,123.4L313.44,121.97L312.91,121.33L314.06,121.28L312.9,120.74L313.65,120.31L313.47,119.96L314.47,118.37L314.55,117.74L314.06,116.99L314.57,116.2L315.31,115.59L315.38,115.22L314.43,114.44L312.55,114.58L312.6,113.04L312.91,112.2L312.33,111.49L312.09,110.55L313.1,109.96L314.73,108.77L315.34,107.82L316.22,107.56L316.46,107.06L314.93,105.8L314.54,105.11L314.52,104.37L314.11,103.69L315.08,103.42L315.36,102.53L316.46,102.11L316.3,101.12L315.85,100.8L315.78,100.21L315.22,99.46L315.13,98.28L314.63,98.13L314.45,97.46L313.62,97.5L313.14,96.83L312.15,96.58L311.43,96.9L309.97,96.37L309.87,96.04L309.02,96.12L307.8,96.57L307.88,95.72L308.24,96.08L308.77,95.78L307.5,94.21L307.45,93.76L308.88,93.47L310.08,93.84L311.38,93.25L313.08,93.28L314.03,93.08L314.48,92.59L314.79,91.36L315.35,91.06L316.53,90.93L317.04,90.41L318.07,89.98L318.45,89.05L317.94,88.02L318.59,87.4L318.49,86.27L318.92,85.66L319.45,85.55L319.39,84.89L320.74,82.86L321.35,82.7L322.35,81.8L322.46,80.84L322.22,80.2L321.56,79.53L322.16,79.13L322.29,78.56L321.91,77.99L321.89,77.11L323.78,76.59L323.66,75.75L324.84,75.76L325.76,75.37L325.76,74.18L327.24,73.63L327.54,73.89L328.91,73.99L329.25,73.58L329.6,72.44L330.6,72.55L331.05,71.99L331.14,70.83L331.47,70.6L332.44,69.06L333.93,68.99L334.78,69.47L335.18,68.67L335.44,69.17L337.44,69.3L338.34,68.87L339.07,68.2L339.04,67.55L339.96,67.2L340.87,67.35L342.02,66.99L342.28,66.7L343.53,66.23L343.66,65.7L343.3,64.93L343.49,64.08L342.84,63.63L341.42,63.61L340.35,62.97L340.64,62.55L339.99,61.7L340.95,61.57L340.87,60.4L341.4,59.92L342.07,59.88L342.93,59.16L343.85,59.59L344.34,59.03L343.7,59.23L343.7,58.71L344.4,58.56L344.03,58.2L343.99,56.52L343.46,55.96L342.78,55.92L342.71,54.76L342.09,54.5L342.17,53.92L341.44,54L340.76,53.49L340.35,54.02L339.63,53.8L339.02,53.19L338.52,53.1L337.21,53.34L336.64,52.95L335.62,51.19L334.86,51.11L334.87,49.43L334.01,48.79L333.64,48.94L333.68,49.55L333.17,49.52L333.19,48.85L333.56,48.68L332.13,48.12L331.1,47.45L330.51,47.62L329.81,48.32L328.9,48.61L329.08,49.51L328.33,49.95L327.1,50.34L326.14,49.71L325.89,49.3L325.21,49.39L324.62,50.05L324.06,51.72L324.07,52.11L323.27,52.67L322.35,52.72L322.21,53.13L321.37,53.4L321.07,53.81L320.42,53.28L319.44,53.19L318.22,52.73L316.73,52.44L316.18,52.72L316.09,53.96L316.57,54.14L315.51,54.91L315.97,55.48L315.33,55.59L314.98,54.92L313.94,54.76L313.62,55.29L313.05,55.36L311.71,54.89L311.18,55.19L310.43,54.85L309.72,54.92L309.74,54.24L309.04,53.79L307.74,54.58L307.41,54.1L306.78,54.03L306.06,54.56L305.9,54.22L305.05,54.36L304.74,54.86L304.05,54.78L303.29,55.25L302,56.46L301.54,56.27L301.05,56.57L300.8,56.1L300.24,56.32L299.22,58.03L298.54,57.81L298.68,57.21L298.09,56.83L297.61,56.14L298.31,55.6L298.44,54.78L299.05,54.37L300.26,54.14L298.94,53.62L298.55,53.09L299.02,52.18L299.81,52.23L299.96,51.79L299.32,51.03L299.73,50.61L298.23,50.19L299.56,49.55L299.27,49.09L298.15,49.51L297.37,49.39L297.05,48.74L295.9,48.31L295.62,47.55L296.87,46.44L296.55,45.71L294.26,45.18L293.66,45.74L292.55,46.14L292.01,45.85L291.17,45.81L289.48,46.2L289.33,47.24L289.81,47.77L289.16,48.09L289.25,48.83L288.84,49.78L287.83,50.48L286.48,50.86L286.08,51.46L286.04,52.1L285.42,52.86L284.9,53.07L282.69,52.73L281.28,52.99L281.67,52.76L281.3,52.11L281.03,51L280.38,50.83L279.78,51.78L279.19,51.16L278,51.02L278.08,51.55L276.76,51.58L276.65,52.27L276.25,52.7L275.27,52.5L274.87,53.04L273.2,52.95L272.51,53.26L271.9,53.18L270.32,54.43L269.92,53.84L270.15,52.87L270.03,52.18L268.32,51.59L267.66,50.66L267.14,50.53L266.39,51.49L265.8,51.03L266.01,50.4L265.11,50.12L263.57,50.11L262.95,50.72L262.45,50.45L261.65,51.1L261.17,50.99L260.24,50.23L260.01,49L258.92,48.44L258.07,48.68L257.8,48.3L256.78,48.36L256.37,46.54L255.91,46.08L255.4,46.14L254.66,45.35L254,45.29L252.99,45.8L253.13,44.23L252.69,43.37L252.83,42.77L251.91,41.63L252.32,41.15L251.69,41.09L251.39,41.56L251.58,42.1L251,42.53L250.16,41.83L249.61,42.2L248.87,41.26L248.5,41.17L247.41,41.54L246.42,42.37L245.79,43.47L244.28,43.97L243.79,42.92L242.68,42.66L242.56,44.2L241.58,44.22L240.79,44.98L241.15,45.37L240.55,45.63L241.04,46.08L241.38,47.59L240.29,47.22L238.89,47.42L239.17,47.85L238.76,48.1L238.66,48.75L238.14,49.11L238.11,49.59L237.12,49.69L235.66,50.69L234.9,51L234.51,51.97L233.59,51.53L232.71,51.78L232.24,51.47L230.98,51.72L230.76,52.21L229.89,52.51L229.51,53.22L228.66,53.44L228.41,54.9L227.48,54.9L226.68,54.17L226.31,52.5L225.22,52.75L224.65,53.13L223.92,52.55L223.57,52.77L224.01,53.61L223.8,54.03L223.86,55.43L224.5,56.39L224.98,56.54L224.47,57.46L224.62,58.16L225.42,58.1L226.93,58.82L227.32,58.39L228.16,58.17L229.45,58.11L229.94,58.35L230.36,57.8L231.28,58.01L231.73,58.4L232.53,58.26L233.43,59.26L234.13,60.55L234.9,60.6L235.2,61.18L234.95,61.61L233.55,61.89L232.47,62.74L231.37,63.29L230.97,64.98L231.27,65.59L232.17,66.41L232.44,67.03L232.98,67.44L233.29,68.32L234.18,68.71L233.13,69.47L233.16,70.29L231.71,71.83L231.63,72.31L232.5,72.86L232.4,74.29L233.14,74.57L233.64,75.44L233.55,76.42L233.18,76.73L233.76,77.43L232.47,77.98L232.67,78.63L233.33,79.47L233.31,80.36L233.64,80.57L233.7,81.46L234.42,82.22L234.25,83.17L233.94,83.45L232.94,83.52L231.68,84.66L230.44,85.19L229.92,85.73L230.46,86.67L229.89,87.47L230.08,87.87L229.19,89.44L228.78,89.58L229.11,90.67L228.57,91.91L226.68,92.23L227.56,95.48L226.41,96.25L226.5,97.42L225.66,98.43L225.87,99.77L226.55,99.44L226.77,99.75L227.73,99.44L228.32,99.7L229.85,99.79L230.74,100.35L230.55,101.37L231.05,101.5L231.85,103.11L232.43,102.99L232.99,104.01L234.32,104.97L234.64,106.23L236.02,107.4L237.06,107.83L238.56,107.65L239.17,106.07L240.27,105.65L241.74,106.93L242.65,107.19L242.77,107.9L243.32,107.17L244.15,107.38L244.9,107.07L245.55,107.45L246.13,107.34L246.79,106.11L247.66,105.94L248.02,105.47L248.58,105.7L248.99,105.19L249.1,105.98L249.68,106.97L250.22,107.32L250.33,107.94L251.79,108.57L253.35,108.05L254.1,107.59L255.33,107.61L256.06,107.17L256.83,106.22L257.19,106.78L259.47,106.78L259.25,107.59L259.7,108.39L261.09,108.79L262.77,108.28L263.5,107.25L264.16,107.69L264.8,107.51L265.34,106.86L266.04,107.76L266.77,107.14L266.84,106.49L267.42,105.44L268.19,105.14L269.66,105.26L269.91,105.81L270.55,104.87L271.19,105.01L271.01,105.78L271.83,106.48L272.85,106.35L273.58,106.7L273.96,107.26L274.83,107.86L275.42,107.91L276.51,108.76L276.71,109.81L278.21,111.42L279,111.28L279.1,109.98L279.3,109.85L280.98,109.84L281.58,110.11L281.74,111.08L282.56,111.51L284.19,112.09L284.3,113.2L284.01,113.65L285.13,115.25L285.03,115.74L285.94,116.25L286.53,116.27L287.16,117.37L286.8,118.29L286.79,119.87L287.13,120.19L286.5,120.8L287.5,121.57L287.95,121.18L288.54,121.51L288.44,122.25L289.24,122.05L289.73,122.3L289.7,123.05L290.09,124.29L291.66,124.88L291.72,125.39L292.25,125.2L292.24,125.68L290.9,125.94L290.38,125.67L289.04,126.59L287.58,127.39L287.91,128.3L288.43,128.69L288.06,129.21L287.38,129.22L287.19,129.72L286.45,130.04L286.3,130.56L286.65,131.05L286.28,131.4L286.29,132.05L286.86,132.15L286.33,133.04L285.76,133.25L285.93,133.63L284.78,134.33L284.18,134.27L283.33,135.48L283.35,136.08L282.94,136.26L282.23,135.96L281.63,136.32L280.99,135.97L280.58,136.2L279.37,137.86L278.77,138.12L279.64,138.88L279.52,139.29L280.09,139.61L280.43,140.29L281.81,140.17L282.31,140.69L282.38,141.6L283.46,142.04L283.91,142.55L283.96,143.88Z"},{"name":"深圳市","adcode":440300,"x":306.45,"y":223.6,"d":"M311.28,213.29L310.41,213.6L309.88,214.74L308.78,215L308.2,215.64L308.65,215.98L308.28,216.3L309.49,216.33L309.62,216.95L310.41,218.19L309.96,218.6L309.93,219.52L309.21,219.81L309.38,220.33L309.12,221.73L308.62,222.14L308.62,222.6L307.67,223.36L306.58,222.44L307.12,222.66L307.34,221.69L306.35,221.09L305.92,220.38L305.89,219.56L304.45,219.43L304.17,218.98L303.51,219L302.95,217.45L302.05,217.24L301.44,217.86L300.8,216.9L299.83,216.86L299.85,215.93L299.22,216.36L298.93,216.21L297.82,216.62L296.87,216.42L296.38,215.92L296.1,214.08L295.7,213.86L295.09,214.19L295.3,213.68L294.92,213.3L293.82,213.13L293.79,212.75L292.72,212.01L291.01,212.18L290.62,211.54L289.93,211.15L290.28,210.56L289.51,210.37L289.25,210.87L288.89,210.62L288.57,211.72L287.58,212.02L287.21,211.7L286.59,211.93L286.15,212.68L286.41,212.84L286.32,214.03L285.54,214.54L284.8,214.7L284.65,215.21L284.09,215.05L284.07,215.55L283.43,216.15L283.36,217.06L281.55,218.11L280.86,219.48L281.26,221.81L281.75,222.64L282.25,224.08L282.82,225.19L284.16,227.26L286,228.72L286.39,229.42L286.15,230.68L287.2,230.48L287.55,230.67L288.02,232.18L287.73,233.47L287.95,234.73L288.4,235.77L289.15,236.58L289.79,236.85L291.32,236L293.3,234.64L294.08,232.88L295.19,232.52L298.21,232.57L298.65,232.92L300.17,233.22L300.8,232.52L301.59,232.21L301.88,232.4L302.43,231.86L302.05,231.6L302.67,231.06L304,231.11L304.15,231.48L305.28,230.72L306.46,230.69L306.69,229.89L307.23,229.44L308.29,229.58L308.32,229.83L309.51,229.73L310.9,229.84L311.49,230.65L313.17,229.45L315.3,229.19L316.09,228.82L316.54,228.19L317.4,227.55L318.78,227.55L319.57,227.36L321,226.73L322.05,226.65L323.59,227.29L324.11,227.88L324.37,228.95L326.46,231.07L326.73,231.78L326.49,233.74L326.89,235.45L327.26,236.19L327.87,236.78L328.96,237.1L330.14,236.98L331.02,236.43L331.66,235.38L333.96,234.89L335.61,234.34L336.66,233L336.61,231.93L335.81,230.32L334.23,230.03L332.86,229.32L332.33,228.53L332.28,227.89L333.13,226.66L334.04,226.01L335.09,224.36L335.07,223.31L333.63,222.91L331.91,223.25L329.49,223.29L329.44,222.96L328.89,222.47L327.37,222.49L327.14,222.89L325.56,222.37L325.32,222.67L324.19,222.95L323.95,221.94L324.79,221.59L325.04,221.16L324.83,220.61L323.83,220.46L323.46,219.57L322.74,219.59L322.37,218.93L323.04,218.15L323.05,217.13L323.32,216.24L322.45,215.28L321.92,215.53L321.82,216.65L321.39,216.82L319.96,216.25L319.35,216.33L319.23,215.48L318.5,215.13L319.04,214.75L319.17,213.67L317.73,213.5L316.97,213.67L316.71,214.08L315.43,213.87L314.82,213.56L314.69,213.94L313.33,215.25L312.65,215.26L312.32,214.69L311.64,214.54L311.28,213.29ZM285.22,239.79L285.49,239.28L284.66,238.26L283.88,238.13L283.1,238.7L284.03,239.09L284.41,239.55L285.22,239.79ZM286.78,232.54L287.57,232.97L287.57,232.58L286.66,232.19L286.78,232.54ZM286.47,233.29L286.96,233.71L287.26,233.41L286.78,232.98L286.47,233.29Z"},{"name":"珠海市","adcode":440400,"x":273.86,"y":258.99,"d":"M249.73,240.07L248.89,239.6L248.11,240.09L246.52,239.65L246.34,240.32L245.24,240.73L245,239.89L244.57,239.41L243.54,239.55L243.39,240.33L243.78,240.96L244.67,241.48L245.3,242.23L244.82,246.26L244.23,247.19L244.22,247.98L243.74,249.85L243.12,250.47L241.26,251.14L240.67,251.68L240.36,251.33L239.78,251.7L239.97,252L239.21,253.08L238.86,256.33L238.55,257L238.87,260.87L239.47,261.96L242.12,264.28L242.4,264.73L242.65,266.32L243.17,267.01L244.6,268.03L246.89,271.08L247.98,272.18L249.99,273.21L251.43,272.46L252.11,271.47L253.38,270.78L253.89,269.21L254.03,267.48L254.51,267.01L255.43,266.66L259.13,265.61L261.16,264.43L261.58,263.95L261.7,262.98L262.28,262.25L263.74,261.55L265.09,261.55L266.14,260.63L266.8,260.34L268.31,260.58L269.03,260.41L269.04,259.19L268.28,258.42L268.32,255.96L267.68,255.22L267.04,253.95L267.03,253.21L267.44,252.34L267.28,251.7L267.99,251.41L268.59,251.51L269.23,250.73L270.57,250.59L271.03,250.07L271.2,248.4L270.71,247.96L270.92,247.05L270.58,246.32L270.95,245.66L272.03,245.37L272.29,244.73L271.55,244.07L271.51,243.39L273,242.79L274.35,240.44L275.63,238.53L275.66,237.29L274.97,236.93L272.79,236.83L272.34,237.21L271.78,239L271.45,239.35L270.32,239.54L269.22,238.8L267.21,238.52L265.76,239.01L265.41,238.71L264.58,239.08L264.54,239.85L264.01,240.19L264.29,241.03L264.16,241.74L264.41,242.49L264.23,243.33L264.51,243.4L265.11,244.38L264.42,244.78L263.76,244.73L262.96,245.27L263.6,245.68L264.61,247.06L265.15,248.03L265.76,248.38L265.66,249.11L263.5,249.86L263.97,250.57L262.47,251.1L262.19,251.42L260.42,252.21L259.48,252.11L257.9,250.27L257.54,250.36L255.44,249.17L254.98,248.57L254.44,247.2L253.46,245.15L253.4,244.05L252.57,242.97L250.44,240.53L249.73,240.07ZM299.98,259.54L300.25,259.03L299.72,258.09L298.4,258.46L298.88,259.22L299.98,259.54ZM311.39,263.99L312.04,263.52L313.65,263.28L314.78,262.73L315.78,262.73L316.51,262.39L316.36,261.94L317.29,261.44L317.25,260.95L316.14,261.18L315.96,261.82L314.69,261.87L313.7,262.4L311.95,262.77L311.19,263.2L310.86,263.83L311.39,263.99ZM278.51,264.56L279.49,263.99L279.04,263.2L277.75,263.17L277.31,263.66L277.94,264L277.96,264.53L278.51,264.56ZM285.5,264.95L285.56,265.64L285.97,265.74L286.64,265.1L285.91,265.25L285.5,264.95ZM297.32,274.38L297.74,273.75L298.69,273.08L297.34,273.71L297.32,274.38ZM284.91,255.03L284.49,253.94L283.92,254.43L284.91,255.03ZM296.64,262.15L296.75,262.74L297.03,262.16L296.64,262.15ZM281.73,267.46L281.92,266.82L282.59,266.41L282.68,265.72L282.22,265.11L281.77,265.5L280.77,265.34L280.28,265.81L281.13,266.65L281.28,267.25L281.73,267.46ZM298.88,272.29L299.82,272.5L300.05,271.82L300.73,271.89L300.42,271.25L299.42,271.69L298.88,272.29ZM291.55,262.68L291.85,262.95L292.72,262.72L292.52,262.23L291.78,261.94L291.55,262.68ZM242.13,275.75L242.29,275.29L243.19,274.47L244.3,274.28L244.44,274.75L244.95,274.69L245.99,273.87L246.11,273.23L245.2,273.16L244.52,273.81L243.68,272.89L242.63,273.63L242.22,273.09L241.73,273.4L241.81,275.27L242.13,275.75ZM279.04,269.99L280.35,269.6L280.87,268.81L280.32,268.17L279.35,267.89L278.72,268.14L278.67,269.16L279.18,269.33L279.04,269.99ZM288.85,257.54L288.38,257.84L289.08,258.19L289.31,257.86L288.85,257.54ZM285.74,257.52L286.47,256.69L285.76,255.08L285.1,255.27L285.37,256.34L284.99,256.61L285.27,257.35L285.74,257.52ZM308.77,265.9L309.59,265.57L310.71,265.68L310.94,264.54L310.56,264.33L308.27,264.34L308.06,264.84L308.2,265.76L308.77,265.9ZM243.54,268L243.98,268.79L243.96,267.91L243.54,268ZM306.49,266.62L307.38,266.11L307.76,265.48L307.66,265.05L306.89,265.33L306.4,265L306.12,265.61L304.59,265.97L304.56,266.31L305.89,266.28L306.49,266.62ZM241.79,270.18L241.13,270.74L240.97,271.65L242,270.58L242.95,270.15L243.11,269.68L242.59,268.99L242.22,269.04L241.66,269.78L241.79,270.18ZM275.37,262.53L275.68,262.9L275.45,263.54L276.04,263.16L275.76,262.14L275.37,262.53ZM276.51,268.93L278.18,268.54L278.01,267.76L277.12,267.39L276.39,268.26L276.51,268.93ZM290.42,257.76L290.32,257.16L289.69,257.21L289.45,257.95L290.42,257.76ZM278.07,255.89L278.09,256.45L278.99,256L278.07,255.89ZM297.16,263.32L297.83,263.23L297.54,262.6L297.16,263.32ZM277.75,258.56L277.63,258.99L278.28,259.19L277.75,258.56ZM304.75,267.47L305.78,267.23L305.53,266.92L304.75,267.47ZM269.74,251.53L269.69,252.23L270.35,252.23L270.62,251.73L269.74,251.53Z"},{"name":"汕头市","adcode":440500,"x":466.43,"y":177.14,"d":"M459.22,194.61L459.2,194.06L460.11,192.8L460.83,192.33L462.1,192.03L465.55,191.62L466.4,191.28L467.08,190.65L468.7,188.73L469.56,187.99L470.19,187.7L471.46,187.66L474.25,188.67L475.41,188.56L475.92,188.13L476.48,186.68L476.04,185.88L474.97,185.8L474.42,184.43L474.46,183.64L474.15,182.98L473.88,181.37L475.39,179.2L477.08,178.06L478.7,175.37L479.56,174.95L479.65,173.01L480.41,172.42L481.1,171.03L480.4,170.87L480.62,169.41L481.29,168.31L482.43,167.5L482.51,165.59L481.93,164.3L482.05,163.01L481.38,162.39L481.39,161.91L480.79,161.7L479.74,162.12L478.98,161.65L479,161.07L477.41,160.31L476.95,160.23L476.34,160.88L476.41,161.4L477.01,161.74L476.73,162.4L475.94,162.35L475.32,162.72L474.71,162.48L474.45,163.19L474.63,163.82L474.04,164.45L473.23,164.16L472.52,164.81L472.16,164.7L471.62,163.64L471.09,163.05L469.44,163.28L469.56,164.12L468.8,164.78L469.8,165.5L469.85,166.17L469.01,166.81L468.92,168.4L469.46,169.96L469.75,171.36L469.43,172.11L468.76,172.31L468.51,172.89L468.78,173.45L467.76,174.01L467.46,173.42L466.61,174.06L465.71,173.91L465.44,174.21L464.16,174.01L463.14,173.76L462.59,173.15L461.6,172.49L461.49,171.94L460.99,171.99L460.96,172.83L461.57,173.12L461.68,174.2L461.1,174.41L460.67,175.38L460.81,175.73L460.28,176.64L460.23,177.27L459.82,176.72L459.26,175.1L458.73,174.33L457.37,173.5L456.66,173.37L453.94,173.49L453.69,173.18L454.09,172.33L454.77,171.72L455.31,170.87L455.39,169.97L454.77,169.48L453.7,169.67L452.61,170.26L451.79,171.21L451.19,171.51L450.51,170.81L450.46,168.86L450.07,168.71L449.58,169.49L448.05,169.47L446.67,171.28L446.37,172.72L445.2,173.11L444.39,172.75L444.22,173.19L444.6,174.5L445.16,174.33L446.05,175.36L446.02,175.91L446.39,176.74L446.31,178.55L446.64,179.24L446.25,179.97L445.03,179.94L444.39,180.2L444.37,180.6L445.1,181.2L444.98,182.28L444.64,182.07L443.71,182.5L443.95,183.1L443.29,183.57L443.49,183.98L443.06,184.57L442.77,186.08L441.83,186.96L441.02,186.84L440.58,187.55L440.68,188.28L441.18,188.3L440.88,188.83L440.13,189.16L440.74,190.2L440.11,190.13L440.27,191.64L439.61,192.41L440.69,193.53L442.62,194.32L442.59,195.04L443.32,195.24L443.96,194.82L444.89,195.21L445.73,195.85L446.11,197.63L447.49,197.69L447.91,198.15L447.6,198.37L448.27,198.82L449.25,198.52L449.86,197.92L451.22,197.32L451.88,196.25L452.47,195.89L452.4,195.42L452.94,195.55L454.53,194.72L456.5,194.95L457.17,195.33L459.22,194.61ZM496.97,172.31L496.71,172.06L495.84,172.14L496.18,171.25L495.96,170.58L494.67,170.99L494.33,171.77L493.66,172.1L493.1,171.94L492.77,171.24L491.82,171.07L490.98,171.56L489.17,173.54L488.78,173.41L487.8,172.23L486.8,172.01L486.09,172.25L485.26,172.88L484.6,172.94L484.19,173.34L484.22,174.43L485.47,174.84L486.55,174.96L487.68,174.85L489.55,174.94L489.62,175.48L490.97,175.83L492.75,175.31L494,175.56L494.22,176.29L494.98,175.92L495.63,176.54L496.82,175.86L496.98,175.13L496.37,174.44L496.43,173.34L497.17,173.47L497.57,173.01L496.95,172.69L496.97,172.31Z"},{"name":"佛山市","adcode":440600,"x":224.98,"y":200.19,"d":"M231.42,171.83L230.86,172.02L230.83,172.56L230.31,172.86L229.33,172.05L228.56,171.87L228.77,171.39L228.28,171.27L228.45,170.57L226.85,170.24L225.86,168.41L226.21,167.83L227.35,166.87L227.61,166.19L226.66,165.27L226.22,166.16L224.83,165L224.28,164.84L223.36,165.25L222,165.25L222.21,166.6L222.28,167.12L222.87,167.22L223.48,167.76L223.15,169.33L223.18,170.34L222.7,170.49L222.25,171.55L221.02,171.9L220.44,173.07L220.5,173.61L220.04,174.03L219.9,175.4L219.36,176.26L219.46,177.72L220.69,177.96L220.91,177.71L220.64,176.68L221.17,176.41L222.71,176.69L224.07,178.14L224.34,179.12L225.57,179.24L224.81,181.26L224.53,182.68L223.93,183.07L223.32,183.84L223.13,184.59L221.77,185.71L223.27,186.16L223.01,187.06L222.3,187.62L221.23,187.53L220.96,188.6L220.33,188.59L220.69,187.83L220.26,186.82L219.97,186.94L219.85,188.1L219.4,188.24L219.09,186.97L218.32,187.13L218.54,187.62L218.13,187.76L218,188.43L218.55,188.64L218.48,189.15L218.73,190.74L219.88,191.8L220.17,192.53L220.25,194.35L220.61,195.53L221.46,196.73L221.49,198.04L222.44,200.41L221.57,200.7L219.94,201.97L219.52,201.87L219.67,201.22L219.61,201.27L219.54,201.28L219.5,201.29L218.81,201.58L217.7,202.65L217.18,201.93L216.12,202.55L216.21,203.66L216.54,203.72L216.07,205.13L214.47,205.96L213.89,204.64L213.07,204.64L212.16,205.15L213.27,205.99L213.69,206.63L213.04,207.24L213.42,207.6L212.97,207.83L212.47,207.55L212.4,208.01L211.31,208.54L209.8,208.76L209.6,209.15L207.81,209.6L207,209.65L206.72,210.08L205.09,209.42L204.85,210.05L205.18,210.64L205.89,211.07L205.74,211.98L204.82,212.43L203.23,212.63L202.92,213.13L202.46,212.35L201.84,212.62L201.1,212.38L201.19,213.3L200.53,213.51L200.07,214.41L198.84,214.77L197.59,214.62L197.43,214.87L195.66,215.72L194.32,216.02L194.34,217.63L194.74,218.77L195.48,220.17L194.99,220.45L194.89,221.06L195.56,222.29L196.47,222.32L197.08,221.67L197.89,219.92L198.82,219.72L199.67,220.2L199.7,219.45L201.17,218.63L201.65,218.96L202.64,218.67L203.61,219.3L204.32,220.4L204.99,220.72L204.62,221.6L203.43,221.88L203.73,222.89L203.48,223.73L204.13,224.14L206.09,223.24L206.49,222.73L206.56,221.87L207.28,221.68L207.55,221.19L206.73,220.69L207.8,220.06L208.6,219.95L208.87,220.39L209.13,219.75L210.15,219.64L210.48,218.76L211.36,218.72L211.65,219.63L212.12,219.6L211.68,218.93L212.63,219.57L212.8,219.08L212.37,218.71L212.88,218.3L213.29,218.78L213.97,218.65L213.11,218.09L212.66,217.46L213.68,216.7L214.09,216.87L214.4,217.65L213.81,218.31L214.48,218.58L214.32,219.29L213.42,220.13L213.61,220.74L214.43,219.8L215.05,220.99L216.07,220.57L216.53,221.01L216.74,220.67L217.45,220.94L218.33,220.38L218.89,219.49L220.78,218.63L220.93,217.24L220.52,217.14L221,216.3L221.42,216.29L221.69,215.08L221.04,214.62L221.5,213.9L222.55,213.85L223.01,213.41L223.64,213.48L223.49,212.17L223.11,211.84L223.55,211.55L224.11,211.94L224.59,211.84L224.96,211.02L225.6,210.77L225.93,211.18L226.67,211.21L227.01,210.82L228.13,210.51L230.71,212.37L231.76,213.92L232.28,214.06L234.61,213.94L236.16,213.6L236.8,214.01L237.8,215.49L238.56,219.32L239.51,220.55L240.22,220.36L243.28,222.13L243.96,221.69L245.06,222.12L245.81,221.99L245.69,221.57L246.01,220.63L247.16,219.68L248.05,217.86L248.48,217.57L249.18,217.86L249.62,218.53L250.23,218.77L251.15,217.98L252.2,218.15L253.96,217.83L253.98,217.34L254.81,216.75L255.85,216.33L256.25,215.84L255.71,214.54L257.4,214.13L258.06,213.47L256.85,212.65L256.2,212.6L254.4,212.95L252.88,212.16L252.72,210.83L251.87,210.11L252.19,209.88L252.14,209.18L250.65,208.06L251.21,207.63L250.99,205.98L251.99,205.56L251.16,204.47L250.04,203.98L249.05,203.24L248.92,200.78L249.46,200.46L249.24,198.5L247.38,198.69L246.48,198.6L245.47,197.78L244.78,197.56L244.29,196.47L245.34,196.01L246.3,196.04L246.75,194.95L246.26,195.01L245.98,193.59L246.36,193.6L246.47,192.27L245.23,192.22L244.9,191.91L244.96,191.22L246.34,190.08L246.31,189.12L246.05,188.55L245.17,187.67L244.31,187.29L244.24,186.29L244.6,185.34L244.32,184.08L243.25,183.1L242.6,182.89L242.61,182.38L241.16,181.33L240.95,181.76L239.74,182.08L240.02,182.51L239.73,182.91L238.77,182.89L238.49,183.19L237.61,183.25L238.22,184.69L238.09,185.43L237.48,185.51L236.41,185.22L235.87,185.3L236.36,184.58L236.28,183.63L235.71,183.31L235.07,182.2L235.4,180.97L234.5,180.67L234.76,180.12L235.77,179L235.22,178.6L234.17,179.62L233.81,178.9L232.36,178.77L231.77,177.14L232.26,176.51L232.41,175.72L233.07,175.48L232.28,174.62L231.91,173.69L232.31,173.13L231.64,173.24L231.36,173.71L230.47,174.23L230.58,173.05L231.28,172.7L231.42,171.83ZM219.61,201.27L219.67,201.22L219.5,201.29L219.54,201.28L219.61,201.27Z"},{"name":"江门市","adcode":440700,"x":208.41,"y":255.28,"d":"M179.86,240.52L179.13,241.1L179.09,241.57L178.52,242.2L178.92,242.54L178.71,243.44L177.89,243.56L177.9,242.8L177.49,242.76L176.96,243.52L176.97,242.34L176.2,242.91L175.62,242.64L174.54,242.68L173.47,244.38L173.72,244.75L173.29,245.64L173.68,246.19L173.24,246.98L172.48,247.79L171.66,248.3L170.6,247.95L170,248.08L169.6,249.22L170.69,249.57L170.86,250.05L171.74,250.25L171.74,251.34L172.61,251.82L172.65,252.63L171.98,253.09L171.66,254.33L172.59,255.68L171.8,256.67L171.06,256.94L171.52,257.81L173.96,257.06L173.99,256.74L174.83,256.67L175.05,256.29L176.07,256.39L176.12,257.04L177.4,258.31L177.36,258.88L178.45,258.97L178.86,259.24L179.3,258.94L180.01,259.59L180.39,259.61L181.11,260.78L182,260.91L182.85,260.62L183.77,260.98L184.05,261.67L183.13,262.51L183.44,263.89L184.1,263.79L183.7,264.25L184.57,264.64L186.12,264.94L186.75,265.44L186.96,266.15L188.37,265.97L189.61,266.54L189.95,267.39L190.41,267.61L191.01,268.67L191.05,270.18L191.42,270.1L191.31,271.01L191.67,271.3L191.51,272.34L191.17,272.88L192.05,273.18L192.89,273.86L191.73,274.63L192.16,275.6L191.13,276.59L191.34,277.02L190.2,277.82L190.57,279.62L190.13,279.84L189.32,280.87L188.72,281.31L189.07,282.07L188.65,283.22L188.93,283.87L189.39,284.09L189.96,283.75L191.82,283.68L195.4,282.33L195.8,281.92L196.54,278.39L197.31,277.53L199.75,278.04L201.01,278.7L202.66,280.25L203.43,280.69L204.91,280.89L207.46,280.94L210.04,280.57L210.83,280.18L213.01,277.1L216.29,273.68L218.18,272.01L219.78,270.04L220.29,269.82L222.33,269.84L222.87,270.1L224.28,272.48L225.69,274.45L226.23,274.95L227.36,275.29L229.47,275.09L231.22,274.13L232.35,273.34L235.41,269.15L236.03,267.81L236.3,266.46L236.46,264.79L236.23,263.87L235.06,262.12L234.96,260.8L235.27,260.11L235.92,259.4L238.01,257.63L238.55,257L238.86,256.33L239.21,253.08L239.97,252L239.78,251.7L240.36,251.33L240.67,251.68L241.26,251.14L243.12,250.47L243.74,249.85L244.22,247.98L244.23,247.19L244.82,246.26L245.3,242.23L244.67,241.48L243.78,240.96L243.39,240.33L243.54,239.55L244.57,239.41L245,239.89L245.24,240.73L246.34,240.32L246.52,239.65L248.11,240.09L248.89,239.6L249.73,240.07L249.33,238.87L249.33,237.16L248.62,235.91L248.3,234.71L247.34,233.38L247.34,233.38L246.72,232.36L244.92,230.65L245.02,229.83L244.79,228.46L244.23,227.46L243.01,225.92L243.01,224.79L243.4,223.55L243.87,223.55L243.24,222.66L243.28,222.13L240.22,220.36L239.51,220.55L238.56,219.32L237.8,215.49L236.8,214.01L236.16,213.6L234.61,213.94L232.28,214.06L231.76,213.92L230.71,212.37L228.13,210.51L227.01,210.82L226.67,211.21L225.93,211.18L225.6,210.77L224.96,211.02L224.59,211.84L224.11,211.94L223.55,211.55L223.11,211.84L223.49,212.17L223.64,213.48L223.01,213.41L222.55,213.85L221.5,213.9L221.04,214.62L221.69,215.08L221.42,216.29L221,216.3L220.52,217.14L220.93,217.24L220.78,218.63L218.89,219.49L218.33,220.38L217.45,220.94L216.74,220.67L216.53,221.01L216.07,220.57L215.05,220.99L214.43,219.8L213.61,220.74L213.42,220.13L214.32,219.29L214.48,218.58L213.81,218.31L214.4,217.65L214.09,216.87L213.68,216.7L212.66,217.46L213.11,218.09L213.97,218.65L213.29,218.78L212.88,218.3L212.37,218.71L212.8,219.08L212.63,219.57L211.68,218.93L212.12,219.6L211.65,219.63L211.36,218.72L210.48,218.76L210.15,219.64L209.13,219.75L208.87,220.39L208.6,219.95L207.8,220.06L206.73,220.69L207.55,221.19L207.28,221.68L206.56,221.87L206.49,222.73L206.09,223.24L204.13,224.14L203.48,223.73L203.73,222.89L203.43,221.88L204.62,221.6L204.99,220.72L204.32,220.4L203.61,219.3L202.64,218.67L201.65,218.96L201.17,218.63L199.7,219.45L199.67,220.2L200.7,221.29L200.53,221.97L201.18,222.45L201.58,223.15L201.5,224.38L202.17,225.13L202.55,226.36L201.52,226.96L200.09,227.31L199.58,227.75L198.85,227.79L198.39,226.79L197.46,226.44L197.07,225.55L197.4,225.07L197.55,224.14L196.61,223.19L197.04,222.92L196.66,222.62L196.04,222.74L195.61,223.21L195.82,223.79L194.82,224.54L195.25,225.02L195.12,225.67L194.69,225.56L194.55,226.66L194.18,227.16L193.54,227.15L193.49,228.18L192.96,229.48L193.36,229.85L192.69,229.98L192.53,229.47L191.27,229.1L191.15,229.5L191.84,229.58L192.23,230.3L191.14,229.97L190.75,230.3L189.95,229.72L190.44,229.12L190.22,228.74L189.01,228.58L188.66,229.36L188.92,229.57L188.57,230.34L188.9,231.58L188.51,232.22L186.88,232.52L185.71,233.18L186.04,234.42L185.43,235.81L184.79,236.68L184.35,237.84L184.84,239.04L183.78,239.05L182.78,239.62L181.82,239.25L181.33,239.69L181.6,240.55L181.19,241.09L181.37,241.81L180.48,241.48L180.28,240.72L179.86,240.52ZM218.7,292.79L220.7,291.86L221.37,291.14L221.01,290.51L220.2,289.81L220.18,289.32L220.62,287.99L221.61,287.08L221.1,285.74L220.62,285.33L220.99,283.9L221.46,283.36L221.93,282.29L222.37,281.82L224.5,281.43L225.1,280.93L225.11,279.51L224.04,279.64L222.87,279.25L221.37,279.85L220.71,279.72L220.27,280.35L219.58,280.34L219.08,279.79L218.77,280.88L219.14,281.72L218.67,282.08L218.06,281.98L216.48,282.38L215.44,282.88L214.4,284.23L214.68,284.89L214.25,285.24L214.76,285.83L215.66,285.89L216.1,286.26L217.04,285.96L217.38,285.24L217.94,285.29L219.01,285.95L218.75,286.96L217.24,287.33L216.36,288.57L215.87,289.63L216.15,290.34L216.76,290.25L217.47,289.74L217.31,291.55L218.17,291.26L218.38,291.57L217.8,292.18L218.7,292.79ZM203.14,291.53L203.56,291.06L204.14,291.34L205.14,291.14L205.04,290.84L204.02,290.46L204.16,290.02L205.54,289.27L206.49,289.66L207.22,289.66L207.46,290.1L208.21,289.78L208.9,290.07L209.12,289.47L209.74,288.99L209.93,288.42L211.34,288.53L211.71,287.8L210.73,287.55L210.07,287.03L210.11,285.81L211.73,285.16L211.97,284.52L211.61,283.26L211.18,283.61L210.63,283.18L209.54,283.7L208.17,283.97L207.04,284.58L206.85,285.66L205.77,285.89L204.97,286.33L205.09,286.86L205.63,287.14L205.65,287.59L204.37,288.36L203.99,288.03L203.4,288.69L202.71,290.74L202.75,291.38L203.14,291.53ZM197.05,286.46L197.71,287.37L198.39,287.4L198.67,286.63L199.13,286.24L199.01,284.98L198.52,284.77L197.98,285.85L197.05,286.46ZM212.66,284.25L213.27,284.14L213.02,283.26L212.62,283.66L212.66,284.25ZM225.58,290.9L226.2,290.84L226.8,290.36L226.84,289.81L225.56,289.52L224.22,290.08L224.54,290.78L225.58,290.9ZM234.63,274.72L235.08,274.29L235.99,274.28L236.31,273.39L235.92,272.5L234.5,272.69L233.47,273.36L234.29,274.61L234.63,274.72ZM211.12,290.78L211.8,290L210.95,290.13L211.12,290.78ZM206.77,291.38L207.56,291.03L207.53,290.56L206.37,290.47L206.21,291.04L206.77,291.38ZM212.26,289.83L212.14,289.38L211.66,289.71L212.26,289.83ZM220.38,292.78L221.18,292.45L221.42,291.8L220.73,291.94L219.89,292.48L220.38,292.78Z"},{"name":"湛江市","adcode":440800,"x":65.9,"y":311.58,"d":"M83.07,314.23L83.02,312.5L82.6,310.31L81.64,310.18L80.98,310.48L79.68,311.81L78.29,310.76L77.35,310.44L75.22,309.38L75.28,308.55L75.71,308.46L76.29,307.69L77.09,307.92L76.88,307.48L77.66,307.19L77.44,306.78L78.17,305.7L77.52,305.11L77.56,304.76L76.8,305.05L76.31,304.72L75.8,303.32L75.92,302.5L75.2,302.34L74.35,301.52L74.33,300.92L73.45,300.49L73.19,300.77L72.79,300.24L72.83,299.63L73.44,298.51L73.23,297.97L74.39,298.19L74.33,297.47L74.34,297.45L74.48,296.9L73.66,295.78L72.87,296L72.39,295.2L72.78,294.08L72.26,293.42L71.92,293.84L70.97,293.4L70.65,293.66L70.23,293.28L69.64,293.44L68.89,292.91L69.33,292.05L69.22,291.74L69.95,291.71L70.19,291.34L69.18,290.5L68.56,290.62L68.73,291.06L68.29,291.39L67.86,290.39L68.25,290.22L68.25,289.42L67.8,289.35L67.78,288.3L67.24,288.39L67.89,287.41L66.54,286.84L66.33,286.21L68.23,285.68L68.06,284.99L67.62,284.82L67.23,285.82L66.96,285.31L66.54,285.74L65.38,285.2L65.53,284.81L64.35,283.27L65.45,282.75L65.24,281.08L65.86,280.3L65.54,279.67L65.74,278.78L66.19,278.76L66.7,278.46L66.6,278.05L65.89,277.85L65.99,277.35L65.04,277.92L64.15,277.61L64.27,277.15L65.22,277.32L64.76,276.78L64.14,277.17L64,277.71L63.58,277.36L63.79,275.39L64.36,274.86L64.53,274.17L64.31,273.7L65.06,273.42L65.7,274.18L66.64,274.44L67.34,273.84L66.65,272.01L66.23,271.85L65.41,272.1L64.17,271.98L63.45,272.17L62.6,271.86L61.84,270.98L60.47,270.26L60.04,271.9L59.32,271.72L58.2,272.57L57,272.76L55.35,272.2L55.47,271.84L53.8,271.81L53.57,271.42L52.24,271.77L51.58,271.59L51,272.56L50.47,271.41L49.6,271.29L48.8,272.51L48.85,273.26L48.42,273.29L48.16,272.27L47.84,272.42L47.2,273.66L45.43,274.15L44.4,273.31L43.39,273.33L42.39,272.98L42.29,272.66L41.1,272.73L40.61,273.55L38.47,274.79L39,275.08L38.5,275.84L38.58,276.22L37.91,276.95L38.2,277.26L37.87,277.85L38.15,279.8L37.6,280.81L38.26,281.8L37.05,282.38L37.12,283.85L36.58,283.78L35.9,284.96L36.48,285.17L36.04,285.89L36.61,286.12L35.5,287.34L34.64,287.44L33.95,286.8L33.32,287.52L32.63,287.32L32.08,288.06L30.51,288.09L29.81,287.77L29.7,288.66L28.93,288.56L28.26,288.07L28.35,287.54L27.83,286.01L27.1,286.17L27.07,286.86L26.5,287.64L26.3,288.73L25.81,289.04L25.66,290.44L26.34,291.61L26.19,291.93L26.36,293.28L27.51,294.88L27.59,296.39L28.5,297.48L28.32,299.61L30.46,300.36L32,300.51L35.25,300.55L35.9,301.32L34.95,303.5L33.62,305.42L33.2,305.62L31.58,305.84L27.37,305.82L26.53,306.63L26.7,307.34L27.02,312.02L26.94,314.3L26.6,314.86L24.19,317.01L21.27,320.01L20.8,320.95L20.78,321.54L21.21,324.36L20.59,328.05L20.04,333.22L20,334.85L20.14,335.84L20.63,337.48L22.43,340.97L23.62,343.06L24.77,346.56L24.95,349.42L25.74,352.84L26,353.04L27.8,352.75L28.81,353.19L29.43,354.13L30.1,355.8L30.01,357.9L30.29,359.35L30.79,360.36L31.78,361.22L34.86,362.11L35.41,362.98L35.53,363.91L35.32,365.16L34.75,366.27L33.37,366.81L33.1,367.43L33.14,368.4L33.77,369.36L35.76,370.77L36.61,372.21L36.71,374.4L36.2,377.7L36.47,378.41L37.47,378.91L38.74,378.59L39.96,377.85L41.1,376.36L41.55,376.18L43.64,376L46.85,375.84L47.23,375.92L49.49,378.39L51.29,378.53L52.71,378.41L54.21,377.89L55.76,376.43L58.42,376.27L59.64,376.54L60.16,377.21L60.87,376.52L62.83,376.37L64.18,375.89L65.93,374.01L66.78,373.72L67.73,373.97L69.04,373.82L69.76,373.47L70.77,372.57L72.76,369.57L73.28,368.56L74.88,366.64L76.46,365.6L76.73,365.16L77.11,362.91L76.77,361.77L75.27,359.61L73.8,355.94L73.38,353.3L72.98,351.63L71.66,349.07L70.13,349.63L68.17,349.65L66.95,348.9L67.78,346.45L67.91,345.77L67.94,343.71L67.75,342.51L67.04,340.39L64.71,338.94L63.14,338.37L60.53,338.38L59.1,338.92L58.38,338.69L56.83,337.72L55.33,337.61L54.79,337.16L53.7,335.6L53.29,334.63L53.16,332.51L53.4,331.23L53.48,329.87L55.03,328.49L55.17,328.09L54.83,326.84L54.95,326.14L55.42,325.26L55.85,325.33L55.79,326.13L56.89,327.8L57.74,327.39L57.87,325.83L60.88,322.74L61.82,322.36L63.27,322.25L64.19,321.96L64.88,321.46L65.63,320.37L65.98,320.22L66.7,320.7L67.52,320.36L68.07,319.38L68.87,316.57L69.21,316.38L69.97,316.85L70.7,316.84L71.29,316.42L71.48,315.78L72.63,315.49L73.3,314.95L73.88,314.86L75.36,315.57L76.02,315.69L77.81,315.27L81.86,314.98L83.07,314.23ZM74.34,297.45L74.33,297.47L74.71,298.1L74.24,298.64L73.44,298.51L72.83,299.63L73.2,299.62L72.79,300.24L73.19,300.77L73.45,300.49L74.33,300.92L74.35,301.52L75.2,302.34L75.92,302.5L75.8,303.32L76.31,304.72L76.8,305.05L77.56,304.76L77.52,305.11L78.17,305.7L77.44,306.78L77.66,307.19L76.88,307.48L77.09,307.92L76.29,307.69L75.71,308.46L75.28,308.55L75.22,309.38L77.35,310.44L78.29,310.76L79.68,311.81L80.98,310.48L81.64,310.18L82.6,310.31L83.02,312.5L83.07,314.23L83.97,313.45L85.84,311L87.38,308.81L89.18,306.8L90.91,305.47L92.68,304.85L96,305.19L98.55,305.3L99.75,305.17L101.14,304.76L102.52,303.99L104.19,302.81L103.44,301.12L102.47,300.45L101.72,300.57L101.13,300.19L101.01,300.59L99.94,300.7L99.4,301.6L98.87,300.91L98.04,300.38L99.02,299.98L98.98,299.37L98.26,298.8L97.4,298.71L97.87,298.35L97.66,297.84L97.75,296.99L97.2,296.48L96.6,297.12L95.5,297.28L96.5,296.64L96.02,295.79L95.97,295.11L94.75,294.15L94.32,294.2L94.1,293.58L94.59,293.06L94.05,292.47L93.79,291.58L92.64,291.8L92.51,290.76L92.84,289.24L92.8,288.48L92.08,288.38L91.12,287.46L90.46,287.45L90.02,288.29L89.72,288.22L88.85,288.98L88.89,289.9L89.31,290.11L89.55,291.22L88.87,291.43L88.73,292.06L88.29,292.18L88.16,293.83L88.84,294.75L88.34,294.89L88.42,295.35L87.49,295.16L87.65,295.62L88.51,296.8L88.03,296.65L87.09,296.81L87.41,296.12L87.06,295.64L86.98,295.53L86.13,295.99L85.13,295.51L84.77,296.07L85.39,296.39L85.78,297.42L85.49,297.61L84.37,297.03L83.81,297.45L83.87,296.64L83.05,296.79L83.08,297.96L81.53,298.08L80.78,296.94L80.12,296.41L79.55,296.83L78.73,296.93L78.6,295.87L77.44,296.07L76.47,297.31L76.71,298.19L76.29,298.54L75.88,298.12L74.97,298.13L74.94,297.53L74.34,297.45ZM67.21,271.01L68.32,270.68L67.47,270.51L68.3,270.4L68.39,269.32L70.04,269.07L70.14,268.8L68.62,268.57L68.27,267.97L67.44,267.87L66.88,268.2L65.72,269.28L66.44,269.45L67.19,270.6L67.21,271.01ZM66.24,278.83L66.12,280.08L66.75,280.18L66.87,279.25L66.24,278.83ZM76.68,323.37L78.59,323.11L79.05,322.68L80.45,318.79L81.19,317.39L82.19,316.56L82.42,315.6L82.24,315.27L81.04,315.49L80.43,316.1L79.51,316.32L79.1,315.86L77.45,315.87L75.43,316.58L74.23,315.35L73.56,315.2L72.72,315.91L71.59,316.04L71.62,316.5L71.1,316.94L69.6,317.02L69.48,317.62L69.78,318.09L70.7,318.19L71.48,319.19L73.12,319.85L73.94,319.61L74.5,319.93L75.11,321.42L75.75,321.34L75.94,321.81L75.64,322.35L76.02,323.07L76.68,323.37ZM74.93,323.68L73.66,323.87L72.47,324.72L71.25,324.71L69.6,323.7L68.33,322.74L67.35,322.58L66.4,322.8L64.42,323.65L63.3,323.71L62.92,323.1L61.47,323.1L60.03,325.29L59.53,326.57L58.7,327.06L56.47,329.04L55.41,329.55L55.05,330.08L54.61,331.45L54.79,332.63L55.63,332.68L57.36,331.93L59.31,331.7L61.68,331.04L64.11,329.68L65.15,329.47L66.91,329.61L67.92,329.32L69.63,329.66L70.73,329.45L71.73,329.53L72.09,329.78L73.53,331.89L73.93,333.45L74.56,334.02L75.48,334.04L76.09,333.61L76.24,332.68L76.14,331.14L76.31,329.51L77.68,325.63L77.64,324.8L76.92,324.28L75.73,323.78L74.93,323.68ZM87.49,295.16L86.98,295.53L87.06,295.64L87.65,295.62L87.49,295.16ZM67.79,349.21L68.75,349.28L68.97,348.85L69.26,349.39L69.91,349.1L69.7,347.89L68.96,347.1L68.11,347.31L68,348.07L67.51,348.35L67.79,349.21ZM83.05,332.81L82.71,332.52L80.47,331.75L79.52,331.7L79.17,331.97L78.12,333.47L76.93,334.53L76.74,335.4L77.09,336.82L77.8,337.56L79.45,337.83L80.93,337.62L81.52,336.96L82.35,335.14L83.13,333.98L83.05,332.81ZM77.42,371.54L77.92,371.67L79.78,369.42L79.82,368.75L79.31,368.12L78.64,370.06L77.42,371.54ZM68.77,318.52L68.68,319.08L70.13,319.27L70.48,318.51L69.21,318.31L68.77,318.52ZM67.15,322.06L67.2,322.44L69.13,322.69L69.26,322.01L68.47,321.55L67.15,322.06Z"},{"name":"茂名市","adcode":440900,"x":100.02,"y":265.63,"d":"M86.98,295.53L87.49,295.16L88.42,295.35L88.34,294.89L88.84,294.75L88.16,293.83L88.29,292.18L88.73,292.06L88.87,291.43L89.55,291.22L89.31,290.11L88.89,289.9L88.85,288.98L89.72,288.22L90.02,288.29L90.46,287.45L91.12,287.46L92.08,288.38L92.8,288.48L92.84,289.24L92.51,290.76L92.64,291.8L93.79,291.58L94.05,292.47L94.59,293.06L94.1,293.58L94.32,294.2L94.75,294.15L95.97,295.11L96.02,295.79L96.5,296.64L95.5,297.28L96.6,297.12L97.2,296.48L97.75,296.99L97.66,297.84L97.87,298.35L97.4,298.71L98.26,298.8L98.98,299.37L99.02,299.98L98.04,300.38L98.87,300.91L99.4,301.6L99.94,300.7L101.01,300.59L101.13,300.19L101.72,300.57L102.47,300.45L103.44,301.12L104.19,302.81L105.7,302.09L107.87,300.77L109.55,300.11L110.53,299.9L112.57,299.71L113.08,299.85L114.99,299.47L116.57,299.52L119.15,298.84L120.88,298.67L121.67,298.11L123.28,297.83L124.15,297.88L124.47,298.38L123.57,299.54L123.59,300.28L123.09,300.44L121.8,299.89L121.6,300.08L122.06,300.91L122.04,302.27L122.43,302.43L123.85,302.03L124.83,301.09L125.24,301.09L126.65,300.26L128.14,299.14L130.01,297.16L130.86,296.76L134.46,295.9L134.89,295.28L134.87,294.7L134.12,292.36L133.63,292.05L132.96,292.39L133.08,291.79L132.49,292.18L132.29,291.86L132.64,291.03L132.17,290.63L132.89,289.6L132.43,289.4L132.11,288.42L132.16,287.52L132.5,287.4L132.58,286.6L133.13,286.03L132.96,285.6L133.71,284.55L133.11,282.95L131.31,282.35L130.48,282.41L129.93,281.94L130.08,280.94L130.41,280.55L129.48,279.4L130.29,279.03L131.22,277.87L132.62,276.89L132.22,274.57L131.3,274.28L131.33,273.81L129.5,273.91L129.07,273.78L128.73,272.86L127.3,273.03L126.36,272.23L126.03,271.54L125.45,271.78L124.12,270.89L123.94,269.86L124.41,269.12L123.7,268.08L123.72,266.83L123.97,266.43L123.69,265.87L123.97,265.03L125.13,264.28L125.05,263.13L124.49,263.03L123.82,261.95L124.02,261.32L124.79,260.96L124.66,260.58L125.04,259.66L125.83,259.77L125.56,259.41L126.48,258.47L126.31,257.81L127.14,257.49L127.34,256.79L126.75,255.98L126.95,254.84L126.48,254.12L127.82,253.5L128.2,252.72L127.69,251.57L128.61,250.14L129.65,249.55L129.93,249.69L130.39,249.03L131.2,248.92L132.19,248.26L132.56,247.67L133.25,247.51L134.53,247.82L134.91,246.16L135.25,245.79L134.9,245.31L135.46,244.23L135.31,244.02L136.19,243.76L137,243.79L137.12,243.42L138.2,242.77L138.57,241.77L139.47,242.21L140.21,241.59L140.84,241.81L142.04,241.14L143.24,241.49L143.9,241.12L144.32,239.99L144.93,240.17L145.82,239.38L147.01,237.86L147.68,237.34L148.89,235.94L149.17,235.18L148.97,234.31L148.86,233.42L148.4,232.99L146.92,233.31L146.01,232.99L145.49,232.5L145.11,233.37L144.88,232.67L145.21,231.84L144.88,231.83L145.02,231.03L144.51,231.02L144.62,230.48L144.29,230.03L143.62,229.92L141.9,230.6L141.27,231.36L141.38,231.71L140.33,232.09L140.38,233.24L139.09,234.46L137.99,233.58L136.65,232.84L135.54,233.81L136.02,234.46L135.8,234.81L136.24,235.73L135.66,236.89L134.05,236.87L133.64,237.79L132.51,237.86L132.21,237.58L132.47,236.57L131.73,235.92L131.68,234.77L131.33,234.5L131.8,233.7L131.97,232.39L131.32,232.17L130.14,232.57L129.45,232.17L127.94,232.75L127.21,231.73L126.65,232.17L124.33,232.81L123.29,233.71L122.97,232.8L123.31,232.06L123.81,231.68L124.37,230.16L126.2,230.03L126.45,229.55L124.99,228.77L124.95,228.05L123.43,227.33L121.79,227.51L121.51,227.87L119.61,227.73L119.38,227.17L118.18,226.17L117.48,226.55L116.78,226.46L115.96,225.54L114.83,225.19L114.77,224.36L114.34,224.04L113.8,222.61L114.38,222.08L114.37,221.35L113.58,220.72L113.52,220.37L112.55,220.18L112.32,220.79L111.36,220.82L110.36,222.55L109.6,222.61L109.19,223.74L107.61,223.85L107.43,223.54L106.29,223.97L105.46,224.83L104.85,224.26L104.21,224.18L103.04,224.5L103.22,225.19L102.96,225.76L101.91,226.31L99.02,225.96L99.15,227.34L98.47,227.87L97.86,227.93L96.81,227.61L96.34,227.96L95.03,227.79L93.9,228.22L93.4,228.69L93.28,229.44L92.86,229.57L92.5,228.65L91.56,227.76L90.38,228.05L90.65,229L90.46,229.4L89.61,229.71L90.17,230.11L90,230.85L90.42,232.13L89.76,232.11L89.12,233.27L89.09,233.91L89.59,234.71L89.18,235.47L88.2,235.66L86.87,235.33L86.44,234.82L85.8,234.61L85.5,234.89L86.08,235.88L86.13,236.49L86.97,236.61L87.39,237.18L87.44,238.47L86.98,239.22L87.34,239.85L87.28,241.5L88.06,242.12L88.42,241.7L89.18,241.98L89.74,243.08L89.69,244.03L90.4,244.35L91.21,245.46L91.17,246.21L92,246.27L92.26,246.78L91.93,247.15L90.29,247.54L89.02,247.08L88.16,246.21L87.88,246.3L87.31,247.35L86.26,247.69L86.2,248.59L85.66,249.21L84.3,249.41L83.59,249.86L83.16,250.83L83.54,251.81L84.3,252.08L84.97,253.03L85.2,254.04L84.67,254.03L84.35,254.51L83.88,254.36L83.56,254.88L82.03,255.54L81.5,254.98L80.56,255.1L80.08,254.63L80.34,253.36L79.24,253.25L77.65,252.53L75.68,254.56L75.69,255.2L74.49,255.8L73.14,255.83L72.75,255.45L73.18,255.15L71.28,253.66L70.85,252.8L69.41,251.9L68.37,251.75L68.07,252.09L68.12,252.92L67.4,253.1L66.87,253.63L67.03,254.18L66.24,254.57L65.88,254.44L64.16,252.56L63.78,253.35L63.46,253.31L63.29,254.18L62.73,254.56L62.77,255.31L63.26,255.54L64.4,256.6L64.96,256.62L65.19,257.06L65.08,258.01L65.26,258.75L64.31,258.86L64.34,259.37L64.85,259.68L64.82,260.2L64.37,260.29L64.61,261.11L64.46,262.26L64.12,262.55L65.12,264.66L64.66,264.56L64.89,265.42L64.45,266.52L65.97,267.08L66.88,268.2L67.44,267.87L68.27,267.97L68.62,268.57L70.14,268.8L70.04,269.07L68.39,269.32L68.3,270.4L67.47,270.51L68.32,270.68L67.21,271.01L66.65,272.01L67.34,273.84L66.64,274.44L65.7,274.18L65.06,273.42L64.31,273.7L64.53,274.17L64.36,274.86L63.79,275.39L63.58,277.36L64,277.71L64.14,277.17L64.76,276.78L65.22,277.32L64.27,277.15L64.15,277.61L65.04,277.92L65.99,277.35L65.89,277.85L66.6,278.05L66.7,278.46L66.19,278.76L66.24,278.83L66.87,279.25L66.75,280.18L66.12,280.08L65.86,280.3L65.24,281.08L65.45,282.75L64.35,283.27L65.53,284.81L65.38,285.2L66.54,285.74L66.96,285.31L67.23,285.82L67.62,284.82L68.06,284.99L68.23,285.68L66.33,286.21L66.54,286.84L67.89,287.41L67.24,288.39L67.78,288.3L67.8,289.35L68.25,289.42L68.25,290.22L67.86,290.39L68.29,291.39L68.73,291.06L68.56,290.62L69.18,290.5L70.19,291.34L69.95,291.71L69.22,291.74L69.33,292.05L68.89,292.91L69.64,293.44L70.23,293.28L70.65,293.66L70.97,293.4L71.92,293.84L72.26,293.42L72.78,294.08L72.39,295.2L72.87,296L73.66,295.78L74.48,296.9L74.34,297.45L74.94,297.53L74.97,298.13L75.88,298.12L76.29,298.54L76.71,298.19L76.47,297.31L77.44,296.07L78.6,295.87L78.73,296.93L79.55,296.83L80.12,296.41L80.78,296.94L81.53,298.08L83.08,297.96L83.05,296.79L83.87,296.64L83.81,297.45L84.37,297.03L85.49,297.61L85.78,297.42L85.39,296.39L84.77,296.07L85.13,295.51L86.13,295.99L86.98,295.53ZM74.33,297.47L74.39,298.19L73.23,297.97L73.44,298.51L74.24,298.64L74.71,298.1L74.33,297.47ZM66.12,280.08L66.24,278.83L66.19,278.76L65.74,278.78L65.54,279.67L65.86,280.3L66.12,280.08ZM87.65,295.62L87.06,295.64L87.41,296.12L87.09,296.81L88.03,296.65L88.51,296.8L87.65,295.62ZM117.41,305.09L118.06,304.51L118.11,303.81L117.41,304.39L117.41,305.09ZM72.79,300.24L73.2,299.62L72.83,299.63L72.79,300.24Z"},{"name":"肇庆市","adcode":441200,"x":184.12,"y":167.61,"d":"M222.21,166.6L220.41,166.62L220.06,166.22L219.85,164.95L220.28,164.94L220.25,163.85L219.11,163.88L218.5,162.94L217.52,162.94L217.12,162.51L217.22,161.33L218.89,160.52L219.29,159.63L219.05,158.61L218.27,158.22L217.67,158.54L217.17,158.35L216.76,158.79L216.44,158.53L216.76,157.64L215.73,158.15L214.86,157.31L215.28,156.87L215.47,156.13L214.76,156.34L214.62,156.01L215.55,155.14L216.65,153.44L215.81,153.06L214.29,153.42L213.75,152.6L214.17,151.01L213.94,150.85L214.28,150.01L213.23,150.01L212.34,149.45L211.06,149.61L211.44,149.03L212.32,148.42L212.13,147.14L212.6,146.77L212.13,146.29L213.4,144.71L212.98,144.34L213.47,143.78L213.49,143.24L212.84,142.51L212.79,141.56L212.36,141.51L211.54,140.89L210.41,141.43L208.98,141.27L208.05,140.7L206.79,140.44L205.95,139.76L205.43,139.91L205.26,139.12L203.44,139.54L202.19,139.14L201.89,137.59L201.58,137.22L202.34,136.62L201.65,134.92L201.65,134.38L201.03,133.58L201.22,132.53L200.5,132.19L200.76,131.6L200.32,130.41L198.86,129.99L198.14,130.31L198.32,129.73L197.79,129.91L196.7,129.59L196.61,128.78L197.01,128.28L196.68,127.45L197.02,127.21L196.8,126.64L197.28,126.2L197.32,125.54L198.18,124.35L198.54,122.5L197.98,119.78L197.62,119.36L196.31,119.53L195.52,118.13L194.92,117.92L194.41,116.88L193.83,116.77L193.13,115.52L191.11,115.17L189.69,113.47L188.89,113.57L187.73,112.93L187.46,113.65L188.03,115.74L188.03,116.82L186.8,117.26L185.78,117.03L185.69,117.25L186.01,119.17L185.6,119.9L185.65,121.14L185.22,122.18L184.34,122L183.23,122.12L183.02,123.45L181.87,124.68L180.14,125.1L179.94,125.71L179.36,125.84L178.77,125.57L178.52,124.85L177.56,124.47L177.13,123.48L176.66,123.09L176.08,123.12L174.86,121.32L173.65,121.08L173.04,121.95L172.71,122.02L172.54,123.4L171.96,123.88L172.26,125.09L171.99,125.48L170.92,125.68L169.76,125.57L169.18,125.77L168.96,125.03L168.49,124.62L167.93,123.5L166.88,122.73L165.68,122.72L164.28,122.81L163.78,123.56L161.55,123.1L161.13,126.43L162.12,127.24L162.19,127.83L161.61,129.6L161.6,130.67L161.91,131.59L162.24,131.82L162.19,132.64L162.77,133.25L163.33,134.7L164.3,135.3L164.33,136.91L165.53,138.46L164.08,140.72L163.61,140.72L163.72,141.25L162.8,141.08L162.11,141.22L161.62,141.74L160.8,141.1L160.06,141.03L159.86,141.87L160.26,142.88L159.52,143.77L159.07,143.32L158.05,143.33L158.03,143.82L157.4,144.84L157.67,145.63L158.11,145.84L157.87,146.89L158.17,148.35L157.56,148.56L157.27,149.97L156.35,149.41L156.06,149.83L155,149.89L154.42,149.46L153.56,149.6L153.15,149.09L152.63,149.19L151.48,148.77L151.15,148.05L150.03,148.13L149.81,149.31L147.96,148.19L147.35,148.29L147.28,149.01L146.77,149.44L147,149.71L146.48,150.6L146.35,151.27L145.64,151.14L145.73,154.47L145.02,154.57L145.23,155.13L148.11,155.58L147.85,156.37L148.01,156.78L146.61,157.03L146.12,157.77L146.22,158.16L145.49,158.28L144.8,159.41L144.85,160.67L144.33,160.77L143.5,160.38L143.13,160.72L142.86,160.3L141.58,161.04L140.74,160.57L139.93,161.18L138.02,161.51L136.66,161.45L136.39,162.79L136.79,163.64L136.79,165.61L136.34,165.77L136.12,166.72L136.23,167.44L135.21,168.79L134.92,169.53L134.43,169.45L133.59,170.73L133.28,170.77L132.96,171.64L131.1,171.47L131.12,172.26L130.67,172.91L130.84,173.45L130.07,175.91L130.62,176.45L130.43,177.41L129.72,177.82L129.43,178.74L128.87,179.46L128.7,180.32L128.93,180.99L129.53,181.28L129.58,180.98L130.65,180.62L131.68,181.24L132.47,181.22L133.81,182.16L133.53,182.56L134.52,182.92L134.75,183.42L135.74,183.84L137.03,183.23L137.89,183.38L138.49,182.99L138.76,181.9L139.27,181.59L139.01,180.81L139.54,180.68L140.68,182.37L142.19,184.11L142.35,185.2L141.89,185.88L140.2,186.4L139.64,187.27L140.03,187.79L142.29,189L143.49,189.35L145.41,189.26L146.26,189.55L147.01,190.87L147.43,191.26L148.89,191.5L149.72,191.3L150.7,191.74L151.94,191.75L153.64,192.57L154.71,192.87L157.49,193.08L158.95,192.98L160.44,192.36L161.48,192.54L161.99,193L162.91,193.36L164.35,193.4L166.74,193.02L167.26,193.1L167.99,193.73L168.23,195.16L168.78,195.81L170.98,196.18L171.6,196.72L172.36,196.75L174.66,196.28L175.66,195.63L176.86,196.07L177.83,195.89L179.86,196.58L181.5,196.61L184.27,194.04L186.21,193.75L187.52,193.09L188.51,193.57L189.19,193.63L189.24,194.02L190.16,194.72L190.11,195.4L189.55,196.24L188.51,196.29L188.17,197.48L187.5,198.65L187.78,199.81L187.59,200.08L188.37,200.7L187.58,202.31L187.5,202.87L186.99,203.23L187.81,204.37L187.39,204.89L187.17,204.6L186.58,204.94L185.7,204.44L186.07,205.19L185.95,206.53L185.74,207.05L186.26,207.3L187.05,206.79L187.5,207.01L188.13,206.73L188.9,207.01L188.79,207.97L188.43,208.25L188.18,209.42L188.35,209.94L189.21,210.88L189.09,212.51L189.69,212.47L190.74,213.68L189.95,213.92L189.42,214.73L190.24,214.94L192.02,214.86L193.15,214.45L193.79,214.58L193.69,215.08L194.32,216.02L195.66,215.72L197.43,214.87L197.59,214.62L198.84,214.77L200.07,214.41L200.53,213.51L201.19,213.3L201.1,212.38L201.84,212.62L202.46,212.35L202.92,213.13L203.23,212.63L204.82,212.43L205.74,211.98L205.89,211.07L205.18,210.64L204.85,210.05L205.09,209.42L206.72,210.08L207,209.65L207.81,209.6L209.6,209.15L209.8,208.76L211.31,208.54L212.4,208.01L212.47,207.55L212.97,207.83L213.42,207.6L213.04,207.24L213.69,206.63L213.27,205.99L212.16,205.15L213.07,204.64L213.89,204.64L214.47,205.96L216.07,205.13L216.54,203.72L216.21,203.66L216.12,202.55L217.18,201.93L217.7,202.65L218.81,201.58L219.5,201.29L219.67,201.22L219.52,201.87L219.94,201.97L221.57,200.7L222.44,200.41L221.49,198.04L221.46,196.73L220.61,195.53L220.25,194.35L220.17,192.53L219.88,191.8L218.73,190.74L218.48,189.15L218.55,188.64L218,188.43L218.13,187.76L218.54,187.62L218.32,187.13L219.09,186.97L219.4,188.24L219.85,188.1L219.97,186.94L220.26,186.82L220.69,187.83L220.33,188.59L220.96,188.6L221.23,187.53L222.3,187.62L223.01,187.06L223.27,186.16L221.77,185.71L223.13,184.59L223.32,183.84L223.93,183.07L224.53,182.68L224.81,181.26L225.57,179.24L224.34,179.12L224.07,178.14L222.71,176.69L221.17,176.41L220.64,176.68L220.91,177.71L220.69,177.96L219.46,177.72L219.36,176.26L219.9,175.4L220.04,174.03L220.5,173.61L220.44,173.07L221.02,171.9L222.25,171.55L222.7,170.49L223.18,170.34L223.15,169.33L223.48,167.76L222.87,167.22L222.28,167.12L222.21,166.6Z"},{"name":"惠州市","adcode":441300,"x":331.25,"y":187.82,"d":"M329.44,222.96L330.57,222.64L332.24,221.56L334.85,221L335.41,220.74L335.18,219.62L334.52,219.11L335,218.5L340.36,216.31L340.86,215.71L340.97,215.1L341.87,214.88L343.25,215.92L344.43,216.38L344.59,216.65L343.76,218.28L343.42,219.23L343.71,221.35L343.2,222.27L343.08,223.56L343.86,224.38L344.03,225.54L343.74,226.42L344.27,228L348.04,227.79L350.35,227.44L352.41,227.44L353.07,228.79L352.95,230.63L354.91,230.28L355.6,229.91L355.74,229.47L355.47,227.57L355.53,226.13L356.39,224.45L356.88,223.93L358.73,222.47L360.22,221.54L360.9,220.58L362.03,220.32L361.83,219.34L360.99,218.6L360.82,217.87L360.01,217L360.35,215.78L359.87,215.93L358.94,215.58L358.72,214.85L357.35,214.44L356.82,213.49L357.21,213.06L357.18,211.88L356.57,211.39L356.01,211.51L355.77,210.92L356.05,210.33L355.59,209.74L356.48,209.63L356.62,209.16L355.65,208.33L355.66,207.67L355.12,207.28L355.93,206.41L356.94,206.49L357.4,205.9L358.19,206.02L358.83,205.26L359.49,205.49L360.22,205.26L360.36,204.57L361,204.16L361.64,204.19L363.13,203.27L363.41,203.47L364.33,201.73L365.2,201.66L365.13,201.37L365.83,200.86L366.69,201.6L367.43,200.74L368.6,201.15L369.71,201.92L369.83,201.33L370.76,200.56L370.93,199.63L371.85,198.79L372.73,198.45L373.24,198.56L374.42,197.87L374.81,197.93L376.02,197.42L376.38,196.67L377.29,196L377.09,195.53L378.84,195.27L378.68,193.85L378.28,193.39L378.53,192.73L378.3,192.11L378.41,191.33L379.11,191.1L380.2,191.32L380.55,190.94L381.07,191.21L381.81,190.51L382.16,188.99L384.32,188.29L385.07,187.33L386.11,187.36L386.03,186.67L386.45,186.2L387.44,186.31L387.06,185.83L386.05,185.43L385.92,183.75L385.51,182.99L384.84,182.9L384.39,182.07L383.66,182.26L383.43,181.93L382.53,181.71L382.37,181.17L381.68,180.83L380.15,181.74L379.7,180.68L379.9,179.42L379.67,179.3L379.85,178.39L379.18,178.6L378.04,177.42L377.24,176.87L375.69,177.37L375.35,176.82L374.48,176.87L373.46,177.32L372.95,177.11L372.43,177.37L371.59,177.09L371.09,177.33L371.13,177.87L370.39,178.28L369.36,178.38L368.15,177.91L367.58,178.46L366.74,178.69L365.94,179.46L365.34,179.39L364.78,180.29L364.26,180.26L363.93,180.9L363.47,180.94L362.37,180.39L360.82,180.19L360.83,180.69L360.16,181.37L359.86,182.46L358.96,182.61L358.52,182.1L358.84,181.18L358.51,181.38L357.92,180.55L357.05,180.37L357.42,179.47L356.8,179.06L355.47,179.79L354.82,179.78L354.97,181.23L355.21,181.31L354.74,182.51L354.74,183.87L353.67,185.12L353.92,185.65L352.69,186L352.46,187.16L351.44,187.91L351.57,188.63L352.01,189.27L351.25,190.06L350.83,190.83L349.82,190.42L349.37,189.61L347.9,188.63L347.78,188.27L346.76,188.17L346.54,187.06L346.75,186.31L347.19,186.09L346.78,185.02L346.78,184.4L346.37,184.43L346.3,183.84L345.62,183.56L346.33,182.58L346.14,181.39L345.18,181.32L344.73,180.42L343.61,180.44L343.49,180.06L343.01,180.49L343,179.81L342.27,179.2L342.52,178.52L341.09,178.04L341.49,177.95L341.27,176.57L340.83,176.3L341.73,175.61L340.37,175.02L339.07,175.27L338.71,175.67L338.25,175.13L338.12,176.08L336.98,175.38L337.59,174.8L339.14,172.87L339.73,172.37L341.08,172.03L341.15,171.4L340.15,169.9L340.34,168.99L341.18,168.2L340.76,167.45L339.8,167.65L338.83,167.25L338.43,165.51L337.41,165.92L337.23,166.42L336.48,166.37L336.39,167.66L335.31,167.17L335.61,166.7L334.93,166L333.81,165.47L333.55,165.6L332.83,165.01L332.82,164.45L332,163.78L332.15,163.37L331.73,162.81L332.15,161.74L331.44,161.13L330.47,158.91L329.82,158.79L329.33,157.51L328.11,156.83L326.81,156.57L324.71,157.57L323.7,156.96L323.52,156.15L322.5,156.26L321.43,154.28L320.79,153.94L320.17,155.16L319.31,154.49L319.43,153.75L318.43,153.5L318.2,152.28L318.9,150.96L318.5,150.61L318.4,149.91L317.87,149.86L317.5,148.35L317.71,147.04L318.58,146.18L319.37,145.98L318.72,145.42L318.96,144.81L317.79,144.01L317.16,144.4L315.99,144.59L315.03,143.7L314.49,143.98L313.77,143.87L313.44,143.34L312.52,143.63L311.76,143.37L312.47,142.15L312.9,141.84L312.67,141.47L313.99,140.96L313.99,140.26L313.45,140.21L313.16,140.69L312.24,140.97L311.87,141.38L310.5,141.33L310.27,141.11L309.55,141.42L308.91,141.19L308.56,140.46L307.78,140.26L307.1,140.63L306.75,141.51L305.78,141.47L304.31,141.75L304.13,142.15L301.5,142.49L301.42,142.08L300.3,141.76L299.31,143.6L298.99,143.93L299.4,144.69L299.35,145.86L299.72,146.12L299.9,146.93L300.36,147.43L300.01,148.5L299.25,148.86L298.93,149.56L299.72,150.2L299.05,150.83L300.27,151.43L300.5,151.95L299.13,152.25L298.43,152.95L298.27,153.44L297.84,152.78L297.32,152.77L297.81,151.8L297.52,151.82L296.6,152.77L295.16,153.11L294.95,154.28L294.2,154.35L293.88,154.7L292.88,154.35L292.64,154.73L291.59,154.91L291.1,155.73L290.38,155.8L290.16,156.77L289.16,157.73L286.99,158.1L286.49,159.62L285.14,159.57L285.72,160.09L285.57,160.61L285.01,160.87L285.06,161.65L286,161.6L286.13,162.03L286.72,162.01L287.74,162.51L287.66,163.56L288.02,163.95L287.31,165.02L287.93,165.29L288.49,166.89L289.56,167.28L289.88,168.23L290.72,168.76L291.05,169.25L291.79,169.32L292.22,169.89L293.28,169.99L292.92,170.56L292.3,170.6L292.78,171L294.2,170.77L295.04,170.86L295.52,171.29L295.06,171.75L293.85,171.68L293.68,173.15L294.14,173.8L295.11,174.01L295.91,173.88L295.68,174.53L295.84,175.53L296.71,176.31L296.43,176.73L295.54,177.2L296.08,178.76L296.74,179.28L296.3,180.14L295.68,180.31L296.44,181.66L296.47,182.42L295.3,182.19L295.25,181.94L294.04,181.3L294.07,180.18L292.82,179.52L292.06,179.71L290.06,179.38L289.64,180.08L290,181.32L289.58,182.86L289.7,183.36L288.86,184.53L290.01,185.21L289.68,185.94L290.56,187.82L289.93,187.81L289.28,189.15L289.61,189.98L290.45,190.07L290.04,190.88L288.71,190.82L287.69,191.34L287.12,191.88L286.79,193.36L287.01,193.91L287.98,194.06L288.82,193.44L289.99,194.27L290.67,194.03L292.76,194.51L294.31,194.08L294.81,194.14L295.82,194.86L296.26,195.46L297.34,196.04L298.58,195.98L299.85,195.15L300.88,194.9L302.35,195.36L302.51,196.43L303.19,197.62L304.39,198.3L306.25,199.78L306.3,200.14L305.55,199.86L304.61,201.74L305.1,201.71L305.48,202.22L306.6,202.43L306.78,202.74L308.06,202.04L308.29,201.65L309.44,202.2L310.21,202.13L310.84,202.58L310.94,203.67L310.14,204.29L310.25,205.91L311.31,206.79L312.3,206.98L312.55,207.4L313.19,207.34L313.26,207.75L312.71,208.72L312.27,208.96L311.77,208.62L311.4,208.98L311.63,210.08L311.53,211.4L311.69,211.55L311.58,213.01L311.28,213.29L311.64,214.54L312.32,214.69L312.65,215.26L313.33,215.25L314.69,213.94L314.82,213.56L315.43,213.87L316.71,214.08L316.97,213.67L317.73,213.5L319.17,213.67L319.04,214.75L318.5,215.13L319.23,215.48L319.35,216.33L319.96,216.25L321.39,216.82L321.82,216.65L321.92,215.53L322.45,215.28L323.32,216.24L323.05,217.13L323.04,218.15L322.37,218.93L322.74,219.59L323.46,219.57L323.83,220.46L324.83,220.61L325.04,221.16L324.79,221.59L323.95,221.94L324.19,222.95L325.32,222.67L325.56,222.37L327.14,222.89L327.37,222.49L328.89,222.47L329.44,222.96ZM338.1,228.49L338.64,229.34L338.57,228.38L337.32,227.74L337.54,228.56L338.1,228.49ZM336.73,236.47L337.34,236.11L338.21,236.09L338.53,235.59L336.91,235.23L336.18,235.34L336.73,236.47ZM335.52,222.35L335.71,222.9L336.03,222.4L335.52,222.35ZM350.17,232.43L350.21,233.06L351.17,232.32L350.55,232.13L350.17,232.43ZM338.03,222.04L337.95,222.7L338.3,222.75L338.03,222.04ZM342.97,228.25L342.58,227.56L342.48,228.08L342.97,228.25ZM337.52,237.69L338.1,237.73L338.68,236.76L338.34,236.69L337.52,237.69Z"},{"name":"梅州市","adcode":441400,"x":425.28,"y":125.45,"d":"M447.5,154.68L447.81,154.22L448.29,154.4L449.63,152.82L449.7,152.37L450.58,151.82L451.81,151.67L452.01,152.1L452.81,152.38L453.64,153.26L454.93,153.5L455.63,153.44L456.18,152.73L456.25,150.82L456.94,150.24L456.53,149.85L456.73,149.4L456.5,148.65L457.05,148.92L457.52,148.35L456.93,147.48L455.81,146.69L455.68,146.01L456.79,146.17L457.29,145.18L458.13,145.21L458.19,144.9L459.61,144.11L459.57,143.58L460.66,143.46L461.64,143.99L462.55,143.36L462.51,142.17L462.77,141.4L462.51,140.84L463.74,141.04L463.88,140.86L462.78,140.15L462.93,139.68L464.07,139.35L464.62,139.66L464.86,138.34L465.23,138.03L465.92,138.4L467.64,138.34L467.85,138.88L468.32,138.19L468,137.34L468.43,137.51L469.17,136.46L469.16,135.55L468.62,134.49L469.41,133.7L470.82,134.26L471.42,133.73L472.27,132.45L472.91,132.92L473.21,131.69L472.84,130.83L472.84,129.78L473.72,128.3L474.33,127.67L474.78,127.68L475.59,126.9L477.01,127.37L477.27,126.64L478.02,126.04L478.77,126.39L479.25,127.25L479.98,126.99L480.32,126.11L480.35,125.35L481.37,125.15L481.64,124.76L481.13,123.75L482.44,122.85L483.47,123.53L483.84,122.42L483.59,121.77L483.86,120.19L483.63,119.55L482.5,119.63L482.26,119.36L482.17,117.84L482.59,117.24L481.94,116.71L481.87,115.92L481.1,115.34L481.15,114.75L481.6,114.12L480.41,112.45L479.65,112.77L479.4,111.75L479.03,111.58L478.51,110.69L478.05,110.49L477.46,109.5L477.62,108.81L478.38,108.82L478.85,108.24L478.12,107.17L477.03,106.09L475.89,106.87L476.05,106.45L474.77,105.71L473.92,104.67L473.77,103.69L473.22,103.63L472.33,102.87L472.26,102.18L472.93,101.75L472.51,100.56L473.81,99.28L474.18,98.53L474.91,97.94L474.89,97.11L475.74,96.61L475.96,96L475.06,94.49L473.55,94.41L472.04,96L471.28,95.23L469.07,95.33L468.64,95.92L467.98,95.68L466.51,95.74L465.49,96.2L464.48,96.43L464.29,96.92L463.78,96.84L462.02,96.03L461.38,97.13L460.47,97.63L460.36,98.09L459.27,98.64L457.79,99.16L456.54,98.48L456.73,96.6L457,96.19L456.19,95.2L455.97,93.21L455.04,91.92L453.95,91.87L453.07,92.23L452.44,92.18L451.89,90.96L450.6,90.36L450.49,89.51L450.73,88.82L449.96,88.15L449.49,87.12L448.83,87.35L447.91,86.28L448.1,85.35L450.64,84.15L449.97,83.35L449.12,83.11L449.17,81.78L448.19,81.8L447.89,82.38L447.08,82.29L446.31,83.13L446.39,83.64L446.06,84.88L445.2,85.04L444.3,85.58L443.14,86.55L442.59,86.72L440.91,86.74L440.04,87.16L438.88,86.69L439.25,85.89L440.01,85.29L439.96,84.96L439.25,84.8L438.64,85.08L438.12,84.77L438.08,84.02L437.47,83.27L436.83,83.04L436.25,81.82L435.56,81.95L433.8,83.76L432.92,83.89L431.43,83.46L430.08,83.6L429.8,84.3L429.34,83.33L428.42,83.55L428.03,82.92L427.33,82.79L426.83,82.17L426.48,81.2L425.53,80.23L425.01,80L424.23,80.59L423.12,80.39L422.55,79.35L421.66,79.53L421.15,79.19L418.2,78.89L417.5,78.01L416.3,78.29L416.53,78.85L416.74,80.44L417.93,81.13L418.12,81.63L417.26,82.21L415.87,82.36L415.12,82.61L415.42,81.89L415.48,80.98L414.88,80.89L414.52,80.35L413.32,79.85L412.55,79.93L411.89,80.82L411.63,82.07L411.76,82.74L411.09,83.01L410.19,82.73L410.73,83.23L410.38,83.8L410.78,84.27L410.08,84.5L409.98,85.48L409.57,85.84L409.66,86.45L409.1,87.13L409.82,88.36L409.1,89.07L408.57,89.92L408.59,90.8L409.49,91.43L409.34,92.47L410.08,92.97L410.98,92.99L411.38,92.74L411.81,93.26L411.66,94L411.16,94.24L411.19,94.7L410,94.55L408.87,95.13L410.04,95.45L410.63,96.61L410.46,97.3L411.1,97.59L412.45,99.27L413.91,100.49L413.91,100.98L414.42,101.39L414.11,101.85L411.69,101.83L410.35,101.56L408.72,102.64L407.73,103.06L406.08,103.31L405.48,102.98L404.05,102.85L403.55,101.71L404.11,101.34L403.99,100.4L403.13,99.17L402.42,99.04L401.72,98.53L400.83,98.7L400.42,98.21L399.12,97.81L398.2,98.5L397.18,98.5L396.7,98.24L396.51,97.44L395.99,96.73L394.05,97.28L393.52,97.66L393.52,98.31L392.58,99.38L393.08,100.99L391.79,101.44L392.21,101.89L391.13,101.85L391.44,102.79L391.29,103.2L391.65,104.38L391.37,104.8L391.77,105.97L392.55,106.27L393.21,106.15L394.12,106.37L394.66,106.96L395.64,106.83L395.48,107.79L396.04,107.3L396.7,107.21L397.07,107.69L397.02,108.32L398.12,108.4L397.86,108.98L397.03,109.55L396.9,110.43L397.43,110.76L397.54,111.49L397.04,112.47L395.89,113.09L395.44,114.76L395.56,116.45L396.05,116.73L396.25,117.75L396.77,117.94L396.51,118.88L397.15,119.19L397.35,120L397.08,120.48L398.07,121.42L397.98,122.21L397.16,122.25L396.71,122.67L396.86,123.21L396.75,124.67L396.28,124.89L395.87,124.54L395.46,125.04L394.62,125.4L394.67,126.24L395.08,126.84L393.51,126.04L393.17,125.53L392.43,125.73L392.86,126.5L392.65,127.11L393.53,128.55L392.83,128.74L393.59,128.95L393.61,129.47L394.27,129.87L394.58,130.75L394.08,131.41L393.04,131.37L392.73,130.98L392.22,129.5L391.84,129.89L391.16,129.81L390.93,129.35L391.01,128.56L390.51,128.63L389.86,129.4L389.22,129.69L388.81,129.37L388.52,129.75L388.93,130.5L388.22,131.06L387.68,132.79L386.96,133.33L387.49,134.24L388.73,135.24L388.71,136.65L389.01,136.88L388.79,138.08L389.17,138.7L389.22,139.78L387.44,140.62L386.37,140.82L386.59,141.51L385.87,142.26L386.05,143.43L385.29,144.25L385.31,145.2L384.67,145.3L384.48,146.11L384.04,146.26L384.33,147.16L382.93,147.71L383.05,148.57L382.63,149.24L383.48,150.14L382.69,150.37L383.19,150.89L382.6,151.53L380.56,152.86L381.12,153.11L382.52,153.35L383.64,152.94L385.02,151.8L385.79,152.4L384.75,153.71L385.1,154.58L386.06,155.23L386.63,155.32L386.58,156.3L386.3,156.57L387.12,157.03L388.6,156.57L388.76,156.17L389.27,156.36L389.47,157.02L389.12,158.02L389.18,159.11L388.94,159.14L388.5,160.4L387.91,160.75L387.83,163.14L387.66,164.35L388.24,164.95L388.17,165.58L389.04,165.95L388.08,167.33L387.9,168.49L388.42,169.45L387.9,169.78L387.01,169.77L386.9,170.53L387.51,170.59L387.5,171.53L387.92,171.5L388.42,172.83L388.09,173.87L389.32,174.73L389.3,175.57L389.66,175.87L389.46,176.92L389.9,177.45L390.64,177.56L392.52,177.24L392.89,176.61L392.79,175.89L393.07,175.43L392.7,175.17L393.37,174.45L393.9,174.48L393.94,174.05L394.95,173.53L396.1,173.68L397.42,172.79L398.36,171.76L398.25,171.46L398.98,171.31L399.59,171.11L400.04,170.16L399.97,169.06L400.93,168.56L401.25,168.63L401.1,167.69L402.35,167.44L403,166.43L404.13,165.85L404.59,166.33L405.06,167.35L405.81,168.3L406.41,168.58L407.08,168.48L407.25,167.86L408.22,167.77L408.74,168.06L409.78,167.95L410.42,168.41L410.88,167.88L410.56,167.02L411.39,166.77L411.81,166.07L411.44,165.88L412.09,164.49L411.18,163.33L411.8,163.23L411.83,162.72L411.3,162.16L412.48,160.31L413.51,159.27L415.15,159.48L415.35,160.22L416.15,160.99L417.43,161.5L417.53,161.87L418.61,161.18L419.18,161.36L421.14,160.27L421.4,159.59L422.27,159.07L423.13,158.25L424.46,158.34L425.15,159.2L424.75,159.7L425.39,160.3L426.55,160.08L427.59,160.63L427.63,160.2L428.65,160.42L428.77,160.84L429.59,161.47L430.33,161.71L430.8,161.34L431.51,161.82L432.54,161.61L433.63,162.11L434.57,162.12L435.36,161.35L435.5,160.78L436.22,160.52L435.97,159.82L435.35,159.5L435.69,158.41L435.57,157.7L436.51,157.69L437.69,156.62L437.67,155.57L438.54,154.95L439.13,155.02L438.88,155.62L441.33,153.82L441.31,153.13L442.41,152.76L442.88,153.02L443.56,152.33L444.42,151.97L445.4,152.07L445.61,153.04L446.33,153.47L446.63,154.04L447.5,154.68Z"},{"name":"汕尾市","adcode":441500,"x":405.58,"y":226.42,"d":"M398.98,171.31L398.25,171.46L398.36,171.76L397.42,172.79L396.1,173.68L394.95,173.53L393.94,174.05L393.9,174.48L393.37,174.45L392.7,175.17L393.07,175.43L392.79,175.89L392.89,176.61L392.52,177.24L390.64,177.56L390.34,178.66L390.65,180.12L390.37,180.5L392.03,180.82L391.29,181.28L390.18,181.53L389.55,181.46L389.67,182.21L389.16,182.68L389.59,182.98L388.74,183.54L388.25,183.4L387.35,183.71L387.8,184.12L386.99,185.1L387.06,185.83L387.44,186.31L386.45,186.2L386.03,186.67L386.11,187.36L385.07,187.33L384.32,188.29L382.16,188.99L381.81,190.51L381.07,191.21L380.55,190.94L380.2,191.32L379.11,191.1L378.41,191.33L378.3,192.11L378.53,192.73L378.28,193.39L378.68,193.85L378.84,195.27L377.09,195.53L377.29,196L376.38,196.67L376.02,197.42L374.81,197.93L374.42,197.87L373.24,198.56L372.73,198.45L371.85,198.79L370.93,199.63L370.76,200.56L369.83,201.33L369.71,201.92L368.6,201.15L367.43,200.74L366.69,201.6L365.83,200.86L365.13,201.37L365.2,201.66L364.33,201.73L363.41,203.47L363.13,203.27L361.64,204.19L361,204.16L360.36,204.57L360.22,205.26L359.49,205.49L358.83,205.26L358.19,206.02L357.4,205.9L356.94,206.49L355.93,206.41L355.12,207.28L355.66,207.67L355.65,208.33L356.62,209.16L356.48,209.63L355.59,209.74L356.05,210.33L355.77,210.92L356.01,211.51L356.57,211.39L357.18,211.88L357.21,213.06L356.82,213.49L357.35,214.44L358.72,214.85L358.94,215.58L359.87,215.93L360.35,215.78L360.01,217L360.82,217.87L360.99,218.6L361.83,219.34L362.03,220.32L362.85,219.77L362.56,219.06L361.87,218.79L361.87,218.13L362.53,217.63L363.77,217.43L363.61,216.34L363.87,215.47L364.62,215.01L365.57,214.79L367.13,214.72L368.85,214.09L370.2,213.99L370.62,214.92L371.43,215.66L372.36,215.83L372.73,215.65L372.67,214.64L372.08,214.05L372.47,212.9L373.01,212.7L374.87,212.48L375.92,212.57L376.89,212.98L375.22,213.98L374.94,215.22L375.37,215.65L378.47,215.17L380.12,215.1L381.17,215.26L381.88,215.58L382.23,216.1L382.42,217.72L382.13,218.85L382.72,219.79L383.65,220.58L384.49,220.86L384.64,221.48L385.64,221.4L387.68,221.49L388.48,220.82L390.4,220.6L391.8,221.55L392.7,221.57L394.6,222.82L395.81,222.67L395.97,223.1L396.92,223.61L397.42,222.17L396.36,221.38L396.51,220.7L397.87,218.91L399.05,218.45L399.15,217.1L398.73,217.03L397.81,217.59L396.87,217.08L395.36,217.33L394.85,216.93L395.15,216.21L396.68,214.95L397.3,213.78L397.53,212.27L398.5,211.38L400.63,210.27L402.02,209.92L403.82,210.02L404.32,210.46L404.7,211.37L407.49,211.49L408.49,211.71L410.56,213.46L410.97,214.16L411.05,215.14L410.88,216.49L410.93,217.61L411.63,218.31L412.5,218.46L413.17,218.25L414.16,217.33L415.28,215.95L416.61,215.02L418.27,214.91L419.55,213.99L420.36,213.92L420.89,214.37L421.46,214.33L422.51,213.29L423.87,212.38L424.71,212.3L426.52,211.49L427.61,211.24L428.53,211.32L429.2,211.87L429.65,212.71L430.22,213.02L430.84,212.95L431.84,212.22L432.83,211.95L433.44,211.35L433.92,211.26L435.29,210.23L436.31,209.25L437.03,208.18L437.66,207.77L438.49,206.8L438.3,206.01L437.52,206.07L436.66,205.71L435.6,206.06L434.74,206.85L435.02,208.14L433.98,208.6L433.2,208.34L432.64,207.69L431.96,208.2L431.04,208.29L429.55,207.63L429.15,206.72L427.58,206.42L425.75,205.23L425.16,205.55L424.4,204.82L424.2,205.34L422.97,206.07L422.71,205.26L421.94,204.94L422.63,204.42L422.33,203.28L421.71,204.56L421.43,204.09L420.46,204.14L420.78,203.09L420.29,202.18L420.82,201.99L420.57,201.61L421.49,200.25L421.14,199.98L420.36,200.96L419.17,200.24L420.07,199.42L420.9,199.81L421.19,198.92L421.93,198.34L421.79,197.98L420.92,197.45L420.87,197.15L420.07,197.08L420.21,196.12L418.99,194.98L419.14,194.29L418.73,194.2L418.23,193.35L417.59,193.11L416.62,193.74L415.4,193.85L414.58,195.06L413.4,194.21L413.41,193.53L411.27,192.89L410.75,192.47L410.07,191.28L408.98,191.22L408.31,190.67L406.57,189.65L407.07,189.08L406.88,188.68L407.4,187.91L408.25,189.03L408.61,187.6L408.12,186.98L408.07,186.3L408.64,185.76L409.27,185.79L411.13,185.49L412,185.52L413.32,184.92L412.87,184.01L411.15,183.11L411.13,181.67L411.43,180.7L412.12,180.55L412.55,179.98L412.02,179.28L410.5,177.86L409.88,176.93L407.47,177.2L406.59,177.83L405.13,177.91L404.56,178.77L403.46,178.75L403.13,176.94L403.22,176.2L403.84,175.39L402.25,174.58L401.64,173.95L401.51,173.36L400.17,172.59L399.48,171.44L398.98,171.31ZM473.04,343.25L473.05,344.11L472.5,344.61L473,345.02L474.83,344.92L475.6,345.37L476.96,345.17L479.6,345.37L480.13,345.68L480.6,346.92L480.7,348.89L479.72,350.96L478.09,352.38L476.76,352.92L474.45,353.34L472.33,353.01L471.71,353.4L471.77,354.12L473.09,354.95L474.73,355.29L476.61,355.22L478.99,354.89L480.53,353.92L481.66,352.95L482.48,351.82L483.37,349.97L483.5,349.32L482.98,346.11L482.11,344.25L481.78,343.86L480.46,343L478.82,342.73L477.86,342.81L476.26,342.69L473.04,343.25ZM367.22,215.92L367.82,215.38L367.28,215.16L367.22,215.92ZM470.88,348.16L470.95,347.74L470.04,347.34L469.53,347.8L470.88,348.16ZM372.19,218.06L372.87,218.17L372.79,217.79L372.19,218.06ZM420.43,322.5L420.48,323.45L421.06,324.62L423.35,326.45L425.12,327.23L426.59,327.41L427.55,326.96L428.33,326.14L428.22,324.58L427.7,323.14L426.83,321.69L425.59,320.8L424.06,320.63L421.81,320.84L420.85,321.67L420.43,322.5ZM419.37,329.89L419.65,331L420.18,332.16L421.05,333.27L422.12,333.84L423.96,333.62L424.1,332L423.22,330.83L421.11,328.72L419.68,329.16L419.37,329.89Z"},{"name":"河源市","adcode":441600,"x":357.46,"y":137,"d":"M387.06,185.83L386.99,185.1L387.8,184.12L387.35,183.71L388.25,183.4L388.74,183.54L389.59,182.98L389.16,182.68L389.67,182.21L389.55,181.46L390.18,181.53L391.29,181.28L392.03,180.82L390.37,180.5L390.65,180.12L390.34,178.66L390.64,177.56L389.9,177.45L389.46,176.92L389.66,175.87L389.3,175.57L389.32,174.73L388.09,173.87L388.42,172.83L387.92,171.5L387.5,171.53L387.51,170.59L386.9,170.53L387.01,169.77L387.9,169.78L388.42,169.45L387.9,168.49L388.08,167.33L389.04,165.95L388.17,165.58L388.24,164.95L387.66,164.35L387.83,163.14L387.91,160.75L388.5,160.4L388.94,159.14L389.18,159.11L389.12,158.02L389.47,157.02L389.27,156.36L388.76,156.17L388.6,156.57L387.12,157.03L386.3,156.57L386.58,156.3L386.63,155.32L386.06,155.23L385.1,154.58L384.75,153.71L385.79,152.4L385.02,151.8L383.64,152.94L382.52,153.35L381.12,153.11L380.56,152.86L382.6,151.53L383.19,150.89L382.69,150.37L383.48,150.14L382.63,149.24L383.05,148.57L382.93,147.71L384.33,147.16L384.04,146.26L384.48,146.11L384.67,145.3L385.31,145.2L385.29,144.25L386.05,143.43L385.87,142.26L386.59,141.51L386.37,140.82L387.44,140.62L389.22,139.78L389.17,138.7L388.79,138.08L389.01,136.88L388.71,136.65L388.73,135.24L387.49,134.24L386.96,133.33L387.68,132.79L388.22,131.06L388.93,130.5L388.52,129.75L388.81,129.37L389.22,129.69L389.86,129.4L390.51,128.63L391.01,128.56L390.93,129.35L391.16,129.81L391.84,129.89L392.22,129.5L392.73,130.98L393.04,131.37L394.08,131.41L394.58,130.75L394.27,129.87L393.61,129.47L393.59,128.95L392.83,128.74L393.53,128.55L392.65,127.11L392.86,126.5L392.43,125.73L393.17,125.53L393.51,126.04L395.08,126.84L394.67,126.24L394.62,125.4L395.46,125.04L395.87,124.54L396.28,124.89L396.75,124.67L396.86,123.21L396.71,122.67L397.16,122.25L397.98,122.21L398.07,121.42L397.08,120.48L397.35,120L397.15,119.19L396.51,118.88L396.77,117.94L396.25,117.75L396.05,116.73L395.56,116.45L395.44,114.76L395.89,113.09L397.04,112.47L397.54,111.49L397.43,110.76L396.9,110.43L397.03,109.55L397.86,108.98L398.12,108.4L397.02,108.32L397.07,107.69L396.7,107.21L396.04,107.3L395.48,107.79L395.64,106.83L394.66,106.96L394.12,106.37L393.21,106.15L392.55,106.27L391.77,105.97L391.37,104.8L391.65,104.38L391.29,103.2L391.44,102.79L391.13,101.85L392.21,101.89L391.79,101.44L393.08,100.99L392.58,99.38L393.52,98.31L393.52,97.66L394.05,97.28L395.99,96.73L396,95.59L395.71,94.9L395.78,94.21L394.38,93.62L393.67,92.91L393.97,92.3L393.71,91.99L392.7,92.05L392.62,91.52L391.97,90.93L392.2,90.48L391.11,89.94L390.84,89.21L390.01,88.82L389.08,88.88L386.66,87.19L385.91,87.35L385.16,88.37L384.08,88.37L383.46,89.44L383.52,90.6L383.19,90.86L381.95,89.98L380.86,90L379.89,89.37L378.1,89.66L377.55,89.96L376.85,91.27L376.12,91.09L375.25,91.61L374.66,91.42L373.11,92.23L372.1,92.38L372.34,93.29L372.79,93.62L371.11,93.42L370.26,93.82L369.8,93.75L369.18,94.3L368.36,94.28L368.05,95.37L367.47,94.92L367.04,95.15L365.91,93.93L365.66,93.07L365.09,93.23L365.06,92.83L364.14,92.93L363.86,92.47L363.26,93.24L363.33,93.82L362.33,94.5L361.94,95.07L360.86,94.86L360.61,94.43L359.8,94.8L359.01,94.81L357.96,95.32L357.51,95.94L356.37,96.17L356.34,95.31L355.24,95.2L354.6,95.55L354.36,97.4L353.9,98.01L354.11,98.97L353.6,100.05L353.56,100.59L353.14,100.73L352.9,101.43L352.02,101.87L351.55,101.56L351.08,100.58L351.4,99.64L350.6,99.31L349.72,99.7L349.3,100.22L347.89,99.13L347.37,99.33L346.43,98.65L345.65,99.1L344.61,98.44L343.16,98.9L343.19,99.95L343.53,100.56L343.35,101.05L343.68,101.7L342.95,102.67L342.45,102.39L341.59,104.18L341.25,103.48L340.4,103.38L339.85,102.41L339.04,100.51L337.35,101.36L336.44,101.02L335.41,101.79L334.41,103.42L333.12,103.15L332.51,103.45L331.5,103.11L330.7,102.08L328.56,103.66L327.32,103.93L326.61,105.16L325.43,105.82L324.87,105.93L323.99,106.71L323.57,106.04L322.85,105.68L322.28,105.93L322.56,104.69L322.37,104.01L321.56,103.7L321.35,102.78L321.62,101.8L320.86,101.8L320.66,101.25L319.85,100.58L319.04,100.84L318.24,100.53L317.8,100.94L317.31,100.77L316.3,101.12L316.46,102.11L315.36,102.53L315.08,103.42L314.11,103.69L314.52,104.37L314.54,105.11L314.93,105.8L316.46,107.06L316.22,107.56L315.34,107.82L314.73,108.77L313.1,109.96L312.09,110.55L312.33,111.49L312.91,112.2L312.6,113.04L312.55,114.58L314.43,114.44L315.38,115.22L315.31,115.59L314.57,116.2L314.06,116.99L314.55,117.74L314.47,118.37L313.47,119.96L313.65,120.31L312.9,120.74L314.06,121.28L312.91,121.33L313.44,121.97L314.19,123.4L314.14,124.13L315.21,124.46L315.66,125.25L315.1,126.1L315.33,126.53L316.2,127.15L316.83,128.3L317.71,128.94L317.69,129.6L318.17,129.7L318.38,129.03L319.11,128.56L319.93,129.26L320.81,128.82L321.74,128.7L323.42,128.81L323.57,129.32L324.27,129.19L324.67,129.91L325.14,129.96L326.22,130.62L327.19,130.49L327.44,130.11L326.87,129.07L326.23,128.75L326.57,128.48L326.6,127.35L326.15,127.37L326.01,126.88L326.64,126.74L326.88,127.09L327.32,126.71L327.99,125.43L329.23,124.6L329.31,124.25L331.6,122.99L332.09,122.02L332.73,122.84L333.44,123.21L334.34,123.29L334.74,124.15L334.31,124.71L334.3,125.72L334.89,126.54L334.51,127.23L332.87,127.53L332.22,128.09L332.7,129.01L331.97,129.76L331.5,129.37L330.8,129.76L330.69,128.84L330.3,129.03L329.98,129.77L329.12,130.88L328.26,130.12L327.86,130.42L328.09,130.88L327.33,132.16L326.21,132.84L325.07,133.18L324.56,133.72L324.48,134.59L324.75,135.56L323.79,135.58L323.45,136.43L322.95,135.93L322.03,136.02L322.12,136.53L321.5,136.87L321.23,137.43L321.64,138.21L321.22,138.03L321.07,138.83L321.5,139.56L321.19,139.73L321.31,140.46L320.75,141.32L321.04,142L320.27,142.3L320.1,143.25L319.64,143.38L319.77,143.98L318.96,144.81L318.72,145.42L319.37,145.98L318.58,146.18L317.71,147.04L317.5,148.35L317.87,149.86L318.4,149.91L318.5,150.61L318.9,150.96L318.2,152.28L318.43,153.5L319.43,153.75L319.31,154.49L320.17,155.16L320.79,153.94L321.43,154.28L322.5,156.26L323.52,156.15L323.7,156.96L324.71,157.57L326.81,156.57L328.11,156.83L329.33,157.51L329.82,158.79L330.47,158.91L331.44,161.13L332.15,161.74L331.73,162.81L332.15,163.37L332,163.78L332.82,164.45L332.83,165.01L333.55,165.6L333.81,165.47L334.93,166L335.61,166.7L335.31,167.17L336.39,167.66L336.48,166.37L337.23,166.42L337.41,165.92L338.43,165.51L338.83,167.25L339.8,167.65L340.76,167.45L341.18,168.2L340.34,168.99L340.15,169.9L341.15,171.4L341.08,172.03L339.73,172.37L339.14,172.87L337.59,174.8L336.98,175.38L338.12,176.08L338.25,175.13L338.71,175.67L339.07,175.27L340.37,175.02L341.73,175.61L340.83,176.3L341.27,176.57L341.49,177.95L341.09,178.04L342.52,178.52L342.27,179.2L343,179.81L343.01,180.49L343.49,180.06L343.61,180.44L344.73,180.42L345.18,181.32L346.14,181.39L346.33,182.58L345.62,183.56L346.3,183.84L346.37,184.43L346.78,184.4L346.78,185.02L347.19,186.09L346.75,186.31L346.54,187.06L346.76,188.17L347.78,188.27L347.9,188.63L349.37,189.61L349.82,190.42L350.83,190.83L351.25,190.06L352.01,189.27L351.57,188.63L351.44,187.91L352.46,187.16L352.69,186L353.92,185.65L353.67,185.12L354.74,183.87L354.74,182.51L355.21,181.31L354.97,181.23L354.82,179.78L355.47,179.79L356.8,179.06L357.42,179.47L357.05,180.37L357.92,180.55L358.51,181.38L358.84,181.18L358.52,182.1L358.96,182.61L359.86,182.46L360.16,181.37L360.83,180.69L360.82,180.19L362.37,180.39L363.47,180.94L363.93,180.9L364.26,180.26L364.78,180.29L365.34,179.39L365.94,179.46L366.74,178.69L367.58,178.46L368.15,177.91L369.36,178.38L370.39,178.28L371.13,177.87L371.09,177.33L371.59,177.09L372.43,177.37L372.95,177.11L373.46,177.32L374.48,176.87L375.35,176.82L375.69,177.37L377.24,176.87L378.04,177.42L379.18,178.6L379.85,178.39L379.67,179.3L379.9,179.42L379.7,180.68L380.15,181.74L381.68,180.83L382.37,181.17L382.53,181.71L383.43,181.93L383.66,182.26L384.39,182.07L384.84,182.9L385.51,182.99L385.92,183.75L386.05,185.43L387.06,185.83Z"},{"name":"阳江市","adcode":441700,"x":159.2,"y":261.84,"d":"M188.93,283.87L188.65,283.22L189.07,282.07L188.72,281.31L189.32,280.87L190.13,279.84L190.57,279.62L190.2,277.82L191.34,277.02L191.13,276.59L192.16,275.6L191.73,274.63L192.89,273.86L192.05,273.18L191.17,272.88L191.51,272.34L191.67,271.3L191.31,271.01L191.42,270.1L191.05,270.18L191.01,268.67L190.41,267.61L189.95,267.39L189.61,266.54L188.37,265.97L186.96,266.15L186.75,265.44L186.12,264.94L184.57,264.64L183.7,264.25L184.1,263.79L183.44,263.89L183.13,262.51L184.05,261.67L183.77,260.98L182.85,260.62L182,260.91L181.11,260.78L180.39,259.61L180.01,259.59L179.3,258.94L178.86,259.24L178.45,258.97L177.36,258.88L177.4,258.31L176.12,257.04L176.07,256.39L175.05,256.29L174.83,256.67L173.99,256.74L173.96,257.06L171.52,257.81L171.06,256.94L171.8,256.67L172.59,255.68L171.66,254.33L171.98,253.09L172.65,252.63L172.61,251.82L171.74,251.34L171.74,250.25L170.86,250.05L170.69,249.57L169.6,249.22L170,248.08L170.6,247.95L171.66,248.3L172.48,247.79L173.24,246.98L173.68,246.19L173.29,245.64L173.72,244.75L173.47,244.38L174.54,242.68L175.62,242.64L176.2,242.91L176.97,242.34L176.96,243.52L177.49,242.76L177.9,242.8L177.89,243.56L178.71,243.44L178.92,242.54L178.52,242.2L179.09,241.57L179.13,241.1L179.86,240.52L179.61,239.52L178.37,238.58L177.79,239.19L176.27,238.71L174.85,238.53L174.25,238.23L173.98,237.34L173.07,236.3L172.22,236.18L171.53,235.34L170.15,234.99L170.24,234.16L169.89,233.76L169.03,233.68L168.29,232.85L168.31,232.22L167.39,230.24L167.82,229.19L168.69,229.05L169.24,228.39L169.22,227.51L168.38,227.22L167.16,225.07L166.56,224.67L165.45,225.5L164.95,226.44L164.17,227.33L163.86,227.23L163.1,228.01L162.98,228.7L161.29,228.15L161.1,228.63L160.38,228L158.87,227.72L158.76,227.09L157.98,226.97L158.62,226.26L159.21,226.48L159.58,226.05L160.36,226.48L160.44,225.74L159.99,225.28L160.25,224.74L161.13,224.69L161.1,223.02L160.58,223.07L159.82,221.97L159.22,221.79L159.3,221.24L158.84,221.16L158.72,221.69L157.87,221.96L157.89,222.58L157.21,223.25L157.04,223.94L157.52,224.71L156.75,225.16L155.59,226.34L155.34,227.08L154.3,227.59L154.3,227.93L152.65,228.71L151.48,230.62L151.59,231.54L151.07,232.89L149.66,234.33L148.97,234.31L149.17,235.18L148.89,235.94L147.68,237.34L147.01,237.86L145.82,239.38L144.93,240.17L144.32,239.99L143.9,241.12L143.24,241.49L142.04,241.14L140.84,241.81L140.21,241.59L139.47,242.21L138.57,241.77L138.2,242.77L137.12,243.42L137,243.79L136.19,243.76L135.31,244.02L135.46,244.23L134.9,245.31L135.25,245.79L134.91,246.16L134.53,247.82L133.25,247.51L132.56,247.67L132.19,248.26L131.2,248.92L130.39,249.03L129.93,249.69L129.65,249.55L128.61,250.14L127.69,251.57L128.2,252.72L127.82,253.5L126.48,254.12L126.95,254.84L126.75,255.98L127.34,256.79L127.14,257.49L126.31,257.81L126.48,258.47L125.56,259.41L125.83,259.77L125.04,259.66L124.66,260.58L124.79,260.96L124.02,261.32L123.82,261.95L124.49,263.03L125.05,263.13L125.13,264.28L123.97,265.03L123.69,265.87L123.97,266.43L123.72,266.83L123.7,268.08L124.41,269.12L123.94,269.86L124.12,270.89L125.45,271.78L126.03,271.54L126.36,272.23L127.3,273.03L128.73,272.86L129.07,273.78L129.5,273.91L131.33,273.81L131.3,274.28L132.22,274.57L132.62,276.89L131.22,277.87L130.29,279.03L129.48,279.4L130.41,280.55L130.08,280.94L129.93,281.94L130.48,282.41L131.31,282.35L133.11,282.95L133.71,284.55L132.96,285.6L133.13,286.03L132.58,286.6L132.5,287.4L132.16,287.52L132.11,288.42L132.43,289.4L132.89,289.6L132.17,290.63L132.64,291.03L132.29,291.86L132.49,292.18L133.08,291.79L132.96,292.39L133.63,292.05L134.12,292.36L134.87,294.7L134.89,295.28L134.46,295.9L135.95,296.86L137.17,296.77L138.5,295.93L140.03,295.66L140.15,296.46L140.54,296.7L141.35,296.53L142.54,295.71L144.24,295L144.87,294.99L146.73,295.64L147.07,296.09L147.83,295.23L148.79,294.98L148.72,292.68L149.24,291.69L149.82,291.12L152.56,289.87L153.96,289.62L156.24,289.78L157.25,290.21L158.57,291.6L157.46,292.32L157.06,293.11L157.41,293.37L158.46,293.18L159.57,292.58L160.09,292.59L160.59,293.24L160.97,293.1L162.17,291.86L164.33,290.54L165.62,290.07L165.97,290.48L167.57,290.3L169.28,289.36L169.72,289.57L170.92,288.61L170.74,287.58L169.41,286.94L167.56,287.09L166.43,286.19L166.16,285.69L166.12,284.72L166.52,283.46L169.4,281.41L171.65,280.22L173.35,279.59L178.02,278.16L180.27,277.87L181.04,278L181.57,278.45L181.82,279.08L181.56,280.46L181.87,281.8L182.62,281.77L183.36,282.42L184.08,282.25L184.68,283.15L184.61,284.03L185.9,284.26L186.08,284.55L186.78,284.15L187.96,284.17L188.93,283.87ZM180.86,293.95L181.22,294.11L182.37,293.8L181.49,293.65L181.42,293.16L180.84,293.38L180.86,293.95ZM178.28,290.38L178.89,290.39L178.55,289.62L178.28,290.38ZM176.85,288.37L177.56,287.92L176.85,287.78L176.85,288.37Z"},{"name":"清远市","adcode":441800,"x":226.19,"y":119.77,"d":"M232.67,78.63L232.02,79.02L230.89,79.14L230.41,78.87L229.3,79.36L229.02,79.07L228.2,79.17L226.92,78.98L225.32,79.87L224.95,80.58L222.95,80.55L220.55,80.96L219.53,80.85L219.04,80.54L219.42,79.58L219.14,78.92L219.28,77.91L218.58,77.19L216.85,76.77L216.59,75.43L216.79,75.19L216.56,74.09L215.55,73.36L214.87,72.34L215.13,70.93L214.9,69.01L213.73,68.27L213.6,67.92L212.61,67L211.92,66.74L211.86,66.22L211.34,65.55L210.59,65.49L209.33,65.05L209.11,65.46L208.35,65.52L207.31,65.96L205.16,66.07L203.53,65.45L201.66,65.29L201.33,64.79L200.6,64.8L199.73,64.36L198.51,64.32L198.15,63.82L198.29,62.95L197.54,62.18L196.75,62.84L196.46,64.05L195.65,65L194.77,65.04L193.99,64.31L194.36,63.8L193.13,62.69L192.56,61.79L191.67,62.09L190.33,62.93L189.3,62.93L188.59,63.99L187.69,63.9L187.28,63.51L185.63,63.85L185.6,63.08L185.03,62.22L182.17,62.17L181.26,62.34L181.63,63.04L181,64.52L181.04,65.02L180.42,65.75L180.6,67.16L179.89,68.59L179.69,69.64L179.02,70.44L179.11,71.1L178.81,71.74L179.24,72.28L177.9,74.27L177.14,74.61L176.97,76.31L178.38,77.95L179.04,78.3L180.48,78.62L180.04,80.95L179.88,82.46L180.22,82.74L179.58,83.92L178.85,84.38L178.33,83.9L177.23,84.12L176.5,84.73L175.52,85.06L175.47,85.64L174.66,86.43L173.1,86.77L172.78,87.44L171.48,88.57L171.27,90.23L170.21,91.1L169.27,90.99L168.37,91.35L167.59,91.36L166.87,91.75L166.32,93.34L165.48,93.96L165.77,94.61L165.46,95.05L165.99,95.31L166.37,96.47L165.14,96.8L164.71,97.6L165.41,98.87L165.32,99.74L166.05,99.94L166.99,100.69L167.54,100.83L167.94,101.93L168.68,102.61L169.19,102.58L169.8,103.64L169.66,105.07L169.95,105.66L169.1,106.16L168.51,107.06L168.48,108.1L169.11,108.43L169.31,108.99L170.8,109.56L172.01,111.55L172.1,112.67L173,113.03L173.26,114.24L173.11,116.05L172.55,116.5L172.2,117.25L171.44,117.72L170.99,118.89L170.34,118.96L169.53,119.74L168.72,119.86L168.56,121.18L167.8,121.44L167.35,120.89L166.53,121.1L166.31,121.66L165.55,122.07L165.68,122.72L166.88,122.73L167.93,123.5L168.49,124.62L168.96,125.03L169.18,125.77L169.76,125.57L170.92,125.68L171.99,125.48L172.26,125.09L171.96,123.88L172.54,123.4L172.71,122.02L173.04,121.95L173.65,121.08L174.86,121.32L176.08,123.12L176.66,123.09L177.13,123.48L177.56,124.47L178.52,124.85L178.77,125.57L179.36,125.84L179.94,125.71L180.14,125.1L181.87,124.68L183.02,123.45L183.23,122.12L184.34,122L185.22,122.18L185.65,121.14L185.6,119.9L186.01,119.17L185.69,117.25L185.78,117.03L186.8,117.26L188.03,116.82L188.03,115.74L187.46,113.65L187.73,112.93L188.89,113.57L189.69,113.47L191.11,115.17L193.13,115.52L193.83,116.77L194.41,116.88L194.92,117.92L195.52,118.13L196.31,119.53L197.62,119.36L197.98,119.78L198.54,122.5L198.18,124.35L197.32,125.54L197.28,126.2L196.8,126.64L197.02,127.21L196.68,127.45L197.01,128.28L196.61,128.78L196.7,129.59L197.79,129.91L198.32,129.73L198.14,130.31L198.86,129.99L200.32,130.41L200.76,131.6L200.5,132.19L201.22,132.53L201.03,133.58L201.65,134.38L201.65,134.92L202.34,136.62L201.58,137.22L201.89,137.59L202.19,139.14L203.44,139.54L205.26,139.12L205.43,139.91L205.95,139.76L206.79,140.44L208.05,140.7L208.98,141.27L210.41,141.43L211.54,140.89L212.36,141.51L212.79,141.56L212.84,142.51L213.49,143.24L213.47,143.78L212.98,144.34L213.4,144.71L212.13,146.29L212.6,146.77L212.13,147.14L212.32,148.42L211.44,149.03L211.06,149.61L212.34,149.45L213.23,150.01L214.28,150.01L213.94,150.85L214.17,151.01L213.75,152.6L214.29,153.42L215.81,153.06L216.65,153.44L215.55,155.14L214.62,156.01L214.76,156.34L215.47,156.13L215.28,156.87L214.86,157.31L215.73,158.15L216.76,157.64L216.44,158.53L216.76,158.79L217.17,158.35L217.67,158.54L218.27,158.22L219.05,158.61L219.29,159.63L218.89,160.52L217.22,161.33L217.12,162.51L217.52,162.94L218.5,162.94L219.11,163.88L220.25,163.85L220.28,164.94L219.85,164.95L220.06,166.22L220.41,166.62L222.21,166.6L222,165.25L223.36,165.25L224.28,164.84L224.83,165L226.22,166.16L226.66,165.27L227.61,166.19L227.35,166.87L226.21,167.83L225.86,168.41L226.85,170.24L228.45,170.57L228.28,171.27L228.77,171.39L228.56,171.87L229.33,172.05L230.31,172.86L230.83,172.56L230.86,172.02L231.42,171.83L232.58,171.63L233.3,171.93L234.15,171.49L235.74,171.16L236.56,171.3L237.07,170.63L237.81,170.52L238.35,169.88L239.95,169.65L241.2,168.71L242.78,169.34L243.96,168.73L245.24,168.58L245.18,168.04L246.5,166.72L246.39,166.14L245.79,165.58L245.88,164.65L246.67,164.15L247.46,164.06L247.51,163.5L248.66,163.9L248.31,162.75L248.83,163.05L250.62,162.13L250.84,162.58L251.51,162.06L252.07,160.76L251.42,160.32L252.81,160.39L253.91,160.26L253.89,159.61L254.33,159.56L254.56,158.96L255.13,158.87L256.33,156.12L256.72,156.16L257.1,154.77L258.34,154.84L258.75,155.29L260.92,155.05L261.27,155.77L262.57,156.27L262.85,157.35L263.64,157.8L265.5,157.9L266.57,157.66L267.74,157.01L267.83,156.62L268.59,156.74L269.18,157.4L269.18,158.09L270.4,158.36L270.4,158.75L271.04,159.01L272.21,158.04L271.95,157.66L272.73,157.12L272.65,156.82L273.64,156.49L273,156.04L273.23,155.01L273.53,154.74L273.17,154.3L273.53,153.58L272.88,152.49L272.18,151.7L273.36,150.59L273.77,149.5L274.5,149.13L275.44,149.54L276.58,149.59L276.78,148.78L277.99,149.44L278.86,148.81L278.52,148.19L278.73,147.62L278.2,146.83L278.44,146.43L279.72,146.91L280.27,146.65L280.7,146.95L281.28,146.75L281.85,145.86L282.38,145.45L282.74,144.28L283.41,143.8L283.96,143.88L283.91,142.55L283.46,142.04L282.38,141.6L282.31,140.69L281.81,140.17L280.43,140.29L280.09,139.61L279.52,139.29L279.64,138.88L278.77,138.12L279.37,137.86L280.58,136.2L280.99,135.97L281.63,136.32L282.23,135.96L282.94,136.26L283.35,136.08L283.33,135.48L284.18,134.27L284.78,134.33L285.93,133.63L285.76,133.25L286.33,133.04L286.86,132.15L286.29,132.05L286.28,131.4L286.65,131.05L286.3,130.56L286.45,130.04L287.19,129.72L287.38,129.22L288.06,129.21L288.43,128.69L287.91,128.3L287.58,127.39L289.04,126.59L290.38,125.67L290.9,125.94L292.24,125.68L292.25,125.2L291.72,125.39L291.66,124.88L290.09,124.29L289.7,123.05L289.73,122.3L289.24,122.05L288.44,122.25L288.54,121.51L287.95,121.18L287.5,121.57L286.5,120.8L287.13,120.19L286.79,119.87L286.8,118.29L287.16,117.37L286.53,116.27L285.94,116.25L285.03,115.74L285.13,115.25L284.01,113.65L284.3,113.2L284.19,112.09L282.56,111.51L281.74,111.08L281.58,110.11L280.98,109.84L279.3,109.85L279.1,109.98L279,111.28L278.21,111.42L276.71,109.81L276.51,108.76L275.42,107.91L274.83,107.86L273.96,107.26L273.58,106.7L272.85,106.35L271.83,106.48L271.01,105.78L271.19,105.01L270.55,104.87L269.91,105.81L269.66,105.26L268.19,105.14L267.42,105.44L266.84,106.49L266.77,107.14L266.04,107.76L265.34,106.86L264.8,107.51L264.16,107.69L263.5,107.25L262.77,108.28L261.09,108.79L259.7,108.39L259.25,107.59L259.47,106.78L257.19,106.78L256.83,106.22L256.06,107.17L255.33,107.61L254.1,107.59L253.35,108.05L251.79,108.57L250.33,107.94L250.22,107.32L249.68,106.97L249.1,105.98L248.99,105.19L248.58,105.7L248.02,105.47L247.66,105.94L246.79,106.11L246.13,107.34L245.55,107.45L244.9,107.07L244.15,107.38L243.32,107.17L242.77,107.9L242.65,107.19L241.74,106.93L240.27,105.65L239.17,106.07L238.56,107.65L237.06,107.83L236.02,107.4L234.64,106.23L234.32,104.97L232.99,104.01L232.43,102.99L231.85,103.11L231.05,101.5L230.55,101.37L230.74,100.35L229.85,99.79L228.32,99.7L227.73,99.44L226.77,99.75L226.55,99.44L225.87,99.77L225.66,98.43L226.5,97.42L226.41,96.25L227.56,95.48L226.68,92.23L228.57,91.91L229.11,90.67L228.78,89.58L229.19,89.44L230.08,87.87L229.89,87.47L230.46,86.67L229.92,85.73L230.44,85.19L231.68,84.66L232.94,83.52L233.94,83.45L234.25,83.17L234.42,82.22L233.7,81.46L233.64,80.57L233.31,80.36L233.33,79.47L232.67,78.63Z"},{"name":"东莞市","adcode":441900,"x":294.25,"y":207.99,"d":"M311.28,213.29L311.58,213.01L311.69,211.55L311.53,211.4L311.63,210.08L311.4,208.98L311.77,208.62L312.27,208.96L312.71,208.72L313.26,207.75L313.19,207.34L312.55,207.4L312.3,206.98L311.31,206.79L310.25,205.91L310.14,204.29L310.94,203.67L310.84,202.58L310.21,202.13L309.44,202.2L308.29,201.65L308.06,202.04L306.78,202.74L306.6,202.43L305.48,202.22L305.1,201.71L304.61,201.74L305.55,199.86L306.3,200.14L306.25,199.78L304.39,198.3L303.19,197.62L302.51,196.43L302.35,195.36L300.88,194.9L299.85,195.15L298.58,195.98L297.34,196.04L296.26,195.46L295.82,194.86L294.81,194.14L294.31,194.08L292.76,194.51L290.67,194.03L289.99,194.27L288.82,193.44L287.98,194.06L287.01,193.91L286.79,193.36L286.56,193.96L284.88,193.22L283.39,193.23L282.51,193.01L281.02,193.1L280.04,192.36L278.66,192.51L276.8,193.73L275.71,193.94L275.16,194.26L275.11,193.84L274.48,193.76L273.93,194.13L273.77,194.74L271.88,194.75L271.3,195.28L270.35,195.77L268.43,196.18L267.96,196.52L267.63,197.39L266.88,198.11L266.3,198.98L266.31,200.63L266.7,202.46L267.5,203.94L268.06,205.42L268.94,207.28L269.63,208.47L269.38,210.71L270.2,212.1L271.98,213.95L274.28,216.53L276.19,218.8L277.43,218.08L279.1,218.02L279.73,218.14L280.51,218.8L280.86,219.48L281.55,218.11L283.36,217.06L283.43,216.15L284.07,215.55L284.09,215.05L284.65,215.21L284.8,214.7L285.54,214.54L286.32,214.03L286.41,212.84L286.15,212.68L286.59,211.93L287.21,211.7L287.58,212.02L288.57,211.72L288.89,210.62L289.25,210.87L289.51,210.37L290.28,210.56L289.93,211.15L290.62,211.54L291.01,212.18L292.72,212.01L293.79,212.75L293.82,213.13L294.92,213.3L295.3,213.68L295.09,214.19L295.7,213.86L296.1,214.08L296.38,215.92L296.87,216.42L297.82,216.62L298.93,216.21L299.22,216.36L299.85,215.93L299.83,216.86L300.8,216.9L301.44,217.86L302.05,217.24L302.95,217.45L303.51,219L304.17,218.98L304.45,219.43L305.89,219.56L305.92,220.38L306.35,221.09L307.34,221.69L307.12,222.66L306.58,222.44L307.67,223.36L308.62,222.6L308.62,222.14L309.12,221.73L309.38,220.33L309.21,219.81L309.93,219.52L309.96,218.6L310.41,218.19L309.62,216.95L309.49,216.33L308.28,216.3L308.65,215.98L308.2,215.64L308.78,215L309.88,214.74L310.41,213.6L311.28,213.29Z"},{"name":"中山市","adcode":442000,"x":258.15,"y":232.94,"d":"M269.22,238.8L269.54,238.82L271.86,236.65L273.22,234.72L275.57,234.44L277.07,232.23L274.5,232.19L273.72,230.12L272.53,228.13L271.19,227.18L270.57,227.13L269.85,226.53L268.77,226.35L267.19,223.8L266.95,223.24L267.43,222.61L266.33,221.78L264.33,220.47L262.6,219.12L262.8,218.64L261.52,218.18L260.14,218.04L259.25,217.73L256.25,215.84L255.85,216.33L254.81,216.75L253.98,217.34L253.96,217.83L252.2,218.15L251.15,217.98L250.23,218.77L249.62,218.53L249.18,217.86L248.48,217.57L248.05,217.86L247.16,219.68L246.01,220.63L245.69,221.57L245.81,221.99L245.06,222.12L243.96,221.69L243.28,222.13L243.24,222.66L243.87,223.55L243.4,223.55L243.01,224.79L243.01,225.92L244.23,227.46L244.79,228.46L245.02,229.83L244.92,230.65L246.72,232.36L247.34,233.38L247.34,233.38L248.3,234.71L248.62,235.91L249.33,237.16L249.33,238.87L249.73,240.07L250.44,240.53L252.57,242.97L253.4,244.05L253.46,245.15L254.44,247.2L254.98,248.57L255.44,249.17L257.54,250.36L257.9,250.27L259.48,252.11L260.42,252.21L262.19,251.42L262.47,251.1L263.97,250.57L263.5,249.86L265.66,249.11L265.76,248.38L265.15,248.03L264.61,247.06L263.6,245.68L262.96,245.27L263.76,244.73L264.42,244.78L265.11,244.38L264.51,243.4L264.23,243.33L264.41,242.49L264.16,241.74L264.29,241.03L264.01,240.19L264.54,239.85L264.58,239.08L265.41,238.71L265.76,239.01L267.21,238.52L269.22,238.8Z"},{"name":"潮州市","adcode":445100,"x":472.92,"y":150.97,"d":"M482.43,167.5L483.29,167.73L483.95,168.58L485.38,169.07L488.37,169.35L488.87,169.18L489.74,167.52L490.57,166.99L492.14,166.82L493.16,167.16L494.06,167.12L494.91,166.82L500,165.59L499.98,161.26L499.56,160.84L498.78,160.94L497.86,160.6L497.11,159.72L496.18,159.87L495.67,160.22L495.07,158.99L493.31,158.73L492.43,157.36L491.96,157.5L491.1,156.88L490.89,155.4L490.97,154.44L490.76,153.05L490.43,152.72L490.22,151.79L489.74,150.96L488.99,150.37L488.89,149.64L489.42,149.15L489.14,147.94L488.48,146.89L487.07,146.41L486.54,146.87L485.3,146.51L485.17,146.07L486.16,145.81L486.39,145.04L485.99,144.38L485.09,144L485.12,143.12L484.83,142.75L486.01,142.32L486.45,141.43L486.61,140.27L486,139.32L486.15,138.27L486.53,137.89L485.8,137.21L485.17,137.54L484.81,137.3L484.86,136.39L483.88,135.57L484.53,135.08L484.69,134.19L483.7,134.2L483.24,133.51L483.22,131.86L483.04,131.4L483.57,129.6L484.34,129.09L485.47,127.91L485.99,127.9L486.37,127.36L487.1,126.96L487.63,126.28L487.15,125.59L486.21,124.95L485.89,125.06L484.92,123.86L484.1,123.91L483.47,123.53L482.44,122.85L481.13,123.75L481.64,124.76L481.37,125.15L480.35,125.35L480.32,126.11L479.98,126.99L479.25,127.25L478.77,126.39L478.02,126.04L477.27,126.64L477.01,127.37L475.59,126.9L474.78,127.68L474.33,127.67L473.72,128.3L472.84,129.78L472.84,130.83L473.21,131.69L472.91,132.92L472.27,132.45L471.42,133.73L470.82,134.26L469.41,133.7L468.62,134.49L469.16,135.55L469.17,136.46L468.43,137.51L468,137.34L468.32,138.19L467.85,138.88L467.64,138.34L465.92,138.4L465.23,138.03L464.86,138.34L464.62,139.66L464.07,139.35L462.93,139.68L462.78,140.15L463.88,140.86L463.74,141.04L462.51,140.84L462.77,141.4L462.51,142.17L462.55,143.36L461.64,143.99L460.66,143.46L459.57,143.58L459.61,144.11L458.19,144.9L458.13,145.21L457.29,145.18L456.79,146.17L455.68,146.01L455.81,146.69L456.93,147.48L457.52,148.35L457.05,148.92L456.5,148.65L456.73,149.4L456.53,149.85L456.94,150.24L456.25,150.82L456.18,152.73L455.63,153.44L454.93,153.5L453.64,153.26L452.81,152.38L452.01,152.1L451.81,151.67L450.58,151.82L449.7,152.37L449.63,152.82L448.29,154.4L447.81,154.22L447.5,154.68L447.7,155.67L448.09,156L448.58,155.85L449.77,157.14L451.52,157.38L451.7,158.07L452.36,158.7L452.59,158.2L453.99,158.72L454.25,159.59L454.91,159.4L456.78,159.59L457.61,160.97L457.54,161.46L458.01,162.05L458.02,162.75L457.61,162.94L457.55,163.78L458.03,163.78L458,164.33L458.57,164.82L459.16,164.45L460.14,165.11L460.01,165.88L460.37,166.42L459.29,166.87L459.31,167.33L458.73,167.7L458.66,169.16L459.36,169.8L459.69,170.64L461.02,171.18L461.39,171.07L462.77,171.76L463.5,171.65L464.38,172.66L464.16,174.01L465.44,174.21L465.71,173.91L466.61,174.06L467.46,173.42L467.76,174.01L468.78,173.45L468.51,172.89L468.76,172.31L469.43,172.11L469.75,171.36L469.46,169.96L468.92,168.4L469.01,166.81L469.85,166.17L469.8,165.5L468.8,164.78L469.56,164.12L469.44,163.28L471.09,163.05L471.62,163.64L472.16,164.7L472.52,164.81L473.23,164.16L474.04,164.45L474.63,163.82L474.45,163.19L474.71,162.48L475.32,162.72L475.94,162.35L476.73,162.4L477.01,161.74L476.41,161.4L476.34,160.88L476.95,160.23L477.41,160.31L479,161.07L478.98,161.65L479.74,162.12L480.79,161.7L481.39,161.91L481.38,162.39L482.05,163.01L481.93,164.3L482.51,165.59L482.43,167.5Z"},{"name":"揭阳市","adcode":445200,"x":434.74,"y":179.56,"d":"M459.22,194.61L457.17,195.33L456.5,194.95L454.53,194.72L452.94,195.55L452.4,195.42L452.47,195.89L451.88,196.25L451.22,197.32L449.86,197.92L449.25,198.52L448.27,198.82L447.6,198.37L447.91,198.15L447.49,197.69L446.11,197.63L445.73,195.85L444.89,195.21L443.96,194.82L443.32,195.24L442.59,195.04L442.62,194.32L440.69,193.53L439.61,192.41L440.27,191.64L440.11,190.13L440.74,190.2L440.13,189.16L440.88,188.83L441.18,188.3L440.68,188.28L440.58,187.55L441.02,186.84L441.83,186.96L442.77,186.08L443.06,184.57L443.49,183.98L443.29,183.57L443.95,183.1L443.71,182.5L444.64,182.07L444.98,182.28L445.1,181.2L444.37,180.6L444.39,180.2L445.03,179.94L446.25,179.97L446.64,179.24L446.31,178.55L446.39,176.74L446.02,175.91L446.05,175.36L445.16,174.33L444.6,174.5L444.22,173.19L444.39,172.75L445.2,173.11L446.37,172.72L446.67,171.28L448.05,169.47L449.58,169.49L450.07,168.71L450.46,168.86L450.51,170.81L451.19,171.51L451.79,171.21L452.61,170.26L453.7,169.67L454.77,169.48L455.39,169.97L455.31,170.87L454.77,171.72L454.09,172.33L453.69,173.18L453.94,173.49L456.66,173.37L457.37,173.5L458.73,174.33L459.26,175.1L459.82,176.72L460.23,177.27L460.28,176.64L460.81,175.73L460.67,175.38L461.1,174.41L461.68,174.2L461.57,173.12L460.96,172.83L460.99,171.99L461.49,171.94L461.6,172.49L462.59,173.15L463.14,173.76L464.16,174.01L464.38,172.66L463.5,171.65L462.77,171.76L461.39,171.07L461.02,171.18L459.69,170.64L459.36,169.8L458.66,169.16L458.73,167.7L459.31,167.33L459.29,166.87L460.37,166.42L460.01,165.88L460.14,165.11L459.16,164.45L458.57,164.82L458,164.33L458.03,163.78L457.55,163.78L457.61,162.94L458.02,162.75L458.01,162.05L457.54,161.46L457.61,160.97L456.78,159.59L454.91,159.4L454.25,159.59L453.99,158.72L452.59,158.2L452.36,158.7L451.7,158.07L451.52,157.38L449.77,157.14L448.58,155.85L448.09,156L447.7,155.67L447.5,154.68L446.63,154.04L446.33,153.47L445.61,153.04L445.4,152.07L444.42,151.97L443.56,152.33L442.88,153.02L442.41,152.76L441.31,153.13L441.33,153.82L438.88,155.62L439.13,155.02L438.54,154.95L437.67,155.57L437.69,156.62L436.51,157.69L435.57,157.7L435.69,158.41L435.35,159.5L435.97,159.82L436.22,160.52L435.5,160.78L435.36,161.35L434.57,162.12L433.63,162.11L432.54,161.61L431.51,161.82L430.8,161.34L430.33,161.71L429.59,161.47L428.77,160.84L428.65,160.42L427.63,160.2L427.59,160.63L426.55,160.08L425.39,160.3L424.75,159.7L425.15,159.2L424.46,158.34L423.13,158.25L422.27,159.07L421.4,159.59L421.14,160.27L419.18,161.36L418.61,161.18L417.53,161.87L417.43,161.5L416.15,160.99L415.35,160.22L415.15,159.48L413.51,159.27L412.48,160.31L411.3,162.16L411.83,162.72L411.8,163.23L411.18,163.33L412.09,164.49L411.44,165.88L411.81,166.07L411.39,166.77L410.56,167.02L410.88,167.88L410.42,168.41L409.78,167.95L408.74,168.06L408.22,167.77L407.25,167.86L407.08,168.48L406.41,168.58L405.81,168.3L405.06,167.35L404.59,166.33L404.13,165.85L403,166.43L402.35,167.44L401.1,167.69L401.25,168.63L400.93,168.56L399.97,169.06L400.04,170.16L399.59,171.11L398.98,171.31L399.48,171.44L400.17,172.59L401.51,173.36L401.64,173.95L402.25,174.58L403.84,175.39L403.22,176.2L403.13,176.94L403.46,178.75L404.56,178.77L405.13,177.91L406.59,177.83L407.47,177.2L409.88,176.93L410.5,177.86L412.02,179.28L412.55,179.98L412.12,180.55L411.43,180.7L411.13,181.67L411.15,183.11L412.87,184.01L413.32,184.92L412,185.52L411.13,185.49L409.27,185.79L408.64,185.76L408.07,186.3L408.12,186.98L408.61,187.6L408.25,189.03L407.4,187.91L406.88,188.68L407.07,189.08L406.57,189.65L408.31,190.67L408.98,191.22L410.07,191.28L410.75,192.47L411.27,192.89L413.41,193.53L413.4,194.21L414.58,195.06L415.4,193.85L416.62,193.74L417.59,193.11L418.23,193.35L418.73,194.2L419.14,194.29L418.99,194.98L420.21,196.12L420.07,197.08L420.87,197.15L420.92,197.45L421.79,197.98L421.93,198.34L421.19,198.92L420.9,199.81L420.07,199.42L419.17,200.24L420.36,200.96L421.14,199.98L421.49,200.25L420.57,201.61L420.82,201.99L420.29,202.18L420.78,203.09L420.46,204.14L421.43,204.09L421.71,204.56L422.33,203.28L422.63,204.42L421.94,204.94L422.71,205.26L422.97,206.07L424.2,205.34L424.4,204.82L425.16,205.55L425.75,205.23L427.58,206.42L429.15,206.72L429.55,207.63L431.04,208.29L431.96,208.2L432.64,207.69L433.2,208.34L433.98,208.6L435.02,208.14L434.74,206.85L435.6,206.06L436.66,205.71L437.52,206.07L438.3,206.01L438.49,206.8L439.76,206.33L441.2,205.28L443.32,204.44L444.25,204.36L445.37,205.26L448.4,206.5L452.71,205.38L454.2,205.32L455.04,205.74L456.23,205.76L456.89,205.24L457.76,203.56L457.99,202.34L458.49,201.7L459.09,201.74L459.89,201.31L459.82,200.91L460.72,200.27L459.9,199.71L459.53,197.77L460.07,196.06L459.93,195.44L459.22,194.61Z"},{"name":"云浮市","adcode":445300,"x":157.47,"y":215.86,"d":"M199.67,220.2L198.82,219.72L197.89,219.92L197.08,221.67L196.47,222.32L195.56,222.29L194.89,221.06L194.99,220.45L195.48,220.17L194.74,218.77L194.34,217.63L194.32,216.02L193.69,215.08L193.79,214.58L193.15,214.45L192.02,214.86L190.24,214.94L189.42,214.73L189.95,213.92L190.74,213.68L189.69,212.47L189.09,212.51L189.21,210.88L188.35,209.94L188.18,209.42L188.43,208.25L188.79,207.97L188.9,207.01L188.13,206.73L187.5,207.01L187.05,206.79L186.26,207.3L185.74,207.05L185.95,206.53L186.07,205.19L185.7,204.44L186.58,204.94L187.17,204.6L187.39,204.89L187.81,204.37L186.99,203.23L187.5,202.87L187.58,202.31L188.37,200.7L187.59,200.08L187.78,199.81L187.5,198.65L188.17,197.48L188.51,196.29L189.55,196.24L190.11,195.4L190.16,194.72L189.24,194.02L189.19,193.63L188.51,193.57L187.52,193.09L186.21,193.75L184.27,194.04L181.5,196.61L179.86,196.58L177.83,195.89L176.86,196.07L175.66,195.63L174.66,196.28L172.36,196.75L171.6,196.72L170.98,196.18L168.78,195.81L168.23,195.16L167.99,193.73L167.26,193.1L166.74,193.02L164.35,193.4L162.91,193.36L161.99,193L161.48,192.54L160.44,192.36L158.95,192.98L157.49,193.08L154.71,192.87L153.64,192.57L151.94,191.75L150.7,191.74L149.72,191.3L148.89,191.5L147.43,191.26L147.01,190.87L146.26,189.55L145.41,189.26L143.49,189.35L142.29,189L140.03,187.79L139.64,187.27L140.2,186.4L141.89,185.88L142.35,185.2L142.19,184.11L140.68,182.37L139.54,180.68L139.01,180.81L139.27,181.59L138.76,181.9L138.49,182.99L137.89,183.38L137.03,183.23L135.74,183.84L134.75,183.42L134.52,182.92L133.53,182.56L133.81,182.16L132.47,181.22L131.68,181.24L130.65,180.62L129.58,180.98L129.53,181.28L129.63,181.96L128.15,182.95L128.36,183.31L127.91,183.99L128.02,184.42L128.65,184.13L129.33,184.52L128.94,186.27L129.8,187.25L129.71,187.61L130.41,187.97L130.12,188.99L130.12,190.68L130.64,190.56L131.04,191.18L128.96,192.14L129.63,192.31L129.85,193.51L129.53,194.27L129.48,195.46L129.82,196.18L130.78,197.02L131.25,197.14L133.32,196.8L132.85,197.49L133.29,199.05L132.14,199.72L132.01,200.33L130.93,200.51L130.46,201L131.36,201.91L130.94,202.55L129.67,203.06L129.55,203.4L128.8,203.36L129.17,204.47L128.87,204.69L129.47,205.23L129.56,206.03L129.23,206.74L128.7,207.09L128.49,208.41L128.04,208.67L127.4,209.6L126.7,209.88L126.01,210.83L124.99,211.29L125.18,211.57L123.97,213.07L124.22,213.59L123.02,214.16L122.98,214.69L122.01,214.48L121.9,214.91L121,215.28L120.87,216.08L120.43,216.7L119.56,217.4L118.68,217.27L118.52,217.88L116.87,218.15L116.78,217.91L114.97,218.09L113.3,217.76L111.97,217.8L111.71,218.33L111.09,218.57L109.51,218.45L109.72,219.19L110.95,219.9L111.36,220.82L112.32,220.79L112.55,220.18L113.52,220.37L113.58,220.72L114.37,221.35L114.38,222.08L113.8,222.61L114.34,224.04L114.77,224.36L114.83,225.19L115.96,225.54L116.78,226.46L117.48,226.55L118.18,226.17L119.38,227.17L119.61,227.73L121.51,227.87L121.79,227.51L123.43,227.33L124.95,228.05L124.99,228.77L126.45,229.55L126.2,230.03L124.37,230.16L123.81,231.68L123.31,232.06L122.97,232.8L123.29,233.71L124.33,232.81L126.65,232.17L127.21,231.73L127.94,232.75L129.45,232.17L130.14,232.57L131.32,232.17L131.97,232.39L131.8,233.7L131.33,234.5L131.68,234.77L131.73,235.92L132.47,236.57L132.21,237.58L132.51,237.86L133.64,237.79L134.05,236.87L135.66,236.89L136.24,235.73L135.8,234.81L136.02,234.46L135.54,233.81L136.65,232.84L137.99,233.58L139.09,234.46L140.38,233.24L140.33,232.09L141.38,231.71L141.27,231.36L141.9,230.6L143.62,229.92L144.29,230.03L144.62,230.48L144.51,231.02L145.02,231.03L144.88,231.83L145.21,231.84L144.88,232.67L145.11,233.37L145.49,232.5L146.01,232.99L146.92,233.31L148.4,232.99L148.86,233.42L148.97,234.31L149.66,234.33L151.07,232.89L151.59,231.54L151.48,230.62L152.65,228.71L154.3,227.93L154.3,227.59L155.34,227.08L155.59,226.34L156.75,225.16L157.52,224.71L157.04,223.94L157.21,223.25L157.89,222.58L157.87,221.96L158.72,221.69L158.84,221.16L159.3,221.24L159.22,221.79L159.82,221.97L160.58,223.07L161.1,223.02L161.13,224.69L160.25,224.74L159.99,225.28L160.44,225.74L160.36,226.48L159.58,226.05L159.21,226.48L158.62,226.26L157.98,226.97L158.76,227.09L158.87,227.72L160.38,228L161.1,228.63L161.29,228.15L162.98,228.7L163.1,228.01L163.86,227.23L164.17,227.33L164.95,226.44L165.45,225.5L166.56,224.67L167.16,225.07L168.38,227.22L169.22,227.51L169.24,228.39L168.69,229.05L167.82,229.19L167.39,230.24L168.31,232.22L168.29,232.85L169.03,233.68L169.89,233.76L170.24,234.16L170.15,234.99L171.53,235.34L172.22,236.18L173.07,236.3L173.98,237.34L174.25,238.23L174.85,238.53L176.27,238.71L177.79,239.19L178.37,238.58L179.61,239.52L179.86,240.52L180.28,240.72L180.48,241.48L181.37,241.81L181.19,241.09L181.6,240.55L181.33,239.69L181.82,239.25L182.78,239.62L183.78,239.05L184.84,239.04L184.35,237.84L184.79,236.68L185.43,235.81L186.04,234.42L185.71,233.18L186.88,232.52L188.51,232.22L188.9,231.58L188.57,230.34L188.92,229.57L188.66,229.36L189.01,228.58L190.22,228.74L190.44,229.12L189.95,229.72L190.75,230.3L191.14,229.97L192.23,230.3L191.84,229.58L191.15,229.5L191.27,229.1L192.53,229.47L192.69,229.98L193.36,229.85L192.96,229.48L193.49,228.18L193.54,227.15L194.18,227.16L194.55,226.66L194.69,225.56L195.12,225.67L195.25,225.02L194.82,224.54L195.82,223.79L195.61,223.21L196.04,222.74L196.66,222.62L197.04,222.92L196.61,223.19L197.55,224.14L197.4,225.07L197.07,225.55L197.46,226.44L198.39,226.79L198.85,227.79L199.58,227.75L200.09,227.31L201.52,226.96L202.55,226.36L202.17,225.13L201.5,224.38L201.58,223.15L201.18,222.45L200.53,221.97L200.7,221.29L199.67,220.2Z"}]},"zhuhai":{"viewBox":"0 0 520 420","regions":[{"name":"香洲区","adcode":440402,"x":308.77,"y":228.55,"d":"M153.69,180.49L151.93,182.98L149.18,184.58L147.02,186.17L147.53,187.14L152.28,196.29L160.35,211.57L165.63,221.61L169.2,228.67L173.85,237.21L176.55,237.41L177.24,237.67L178.5,237.87L182.03,237.18L185.55,234.65L188.39,231.62L190.18,230.38L191.37,229.94L192.41,229.87L195.93,230.17L201.62,231.33L203.2,231.43L204.08,231.36L205.27,230.84L206,230.25L206.56,229.16L206.85,228.1L206.85,224.42L206.02,222.86L202.02,219.11L201.45,218.17L201.33,216.78L201.61,216.84L201.21,214.77L201.29,212.85L200.52,212.84L200.19,212.85L198.41,211.72L198.29,211.5L198.06,207.1L198.16,206.98L200.84,206.83L201.54,206.85L201.69,203.25L200.02,201.16L197.82,198.75L194.97,192.91L194.91,192.43L193.92,191L193.44,189L193.52,188.1L193.82,187.31L194.22,186.78L193.85,186.55L195.54,184.24L196.32,181.22L196.22,179.52L195.94,179.26L195.33,177.35L196.06,176.88L197.29,176.84L198.35,177.08L198.67,177L199.31,175.81L199.68,175.57L201.55,175.7L202.19,175.54L202.22,176.16L202.65,175.94L203.33,176.2L204.01,174.84L204.72,174.31L207.16,171.45L207.57,171.15L208.89,170.59L210.15,170.44L212.97,170.49L215.32,170.62L216.34,170.3L217,169.76L217.85,168.36L218.14,167.46L218.91,163.39L219.06,161.94L219,160.05L219.19,157.93L219.14,157.34L218.5,156.28L217.44,155.71L216.65,155.15L216.21,154.66L215.97,153.57L216.09,152.75L217.48,150.86L217.64,150.31L217.59,149.47L217.23,148.68L216.68,148.04L216.15,147.16L215.41,144.66L215.41,143.7L215.75,142.53L216.47,141.57L217.66,140.65L219.27,140.1L222.18,139.64L224.21,138.88L225.04,138.23L225.74,137.43L226.05,136.47L226.05,135.84L225.79,135.01L224.28,133.85L222.75,132.81L221.27,131.02L220.96,130.16L220.75,128.79L220.84,127.82L221.08,126.87L221.53,126.35L222.37,126.09L223.63,126.11L224.86,126.01L226.22,125.66L227.43,125.16L228.67,124.42L230.08,123.23L231.06,121.77L233.43,117.9L235.35,113.94L238.32,108.93L239.46,107.24L246.06,97.32L246.63,95.08L246.85,91.97L246.27,89.84L244.76,88.65L242.11,87.62L239.22,87.13L236.86,86.83L234.54,86.72L232.07,86.93L228.83,86.99L226.11,89.35L224.21,94.23L222.67,100.19L220.71,102.31L217.13,103.34L213.8,103.44L211.21,102.77L208.78,101.26L207.37,99.49L207.15,99L206.3,98.74L200.87,98.73L197.82,98.03L194.94,97.29L193.74,97.27L192.32,97.64L191.76,98.06L191.37,98.83L190.69,99.05L190.06,98.8L189.7,98.44L188.93,98.4L188.52,98.57L187.4,100.38L186.82,100.46L186.09,100.24L184.93,99.03L184,98.44L183.24,98.47L182.4,98.98L181.99,99.49L180.21,100.31L178.96,100.69L178.62,101.42L178.75,104.14L178.71,105.39L178.2,105.77L176.51,106.5L175.52,107.41L175.18,108.65L175.09,109.41L175.4,110.47L175.92,111.34L177.2,112.53L177.11,113.79L177.19,115.06L176.38,116.2L176.36,116.84L177.63,118.77L177.94,121.39L176.88,122.41L176.55,123.06L176.93,123.57L177.28,124.54L176.55,125.56L176.81,126.54L177.43,126.82L178.53,126.94L179.05,127.54L178.96,128.86L179.14,129.26L180.4,129.64L180.84,129.99L181,130.49L180.84,131L181.15,131.61L182.07,132.42L182.14,132.89L181.76,133.46L177.98,135.34L176.79,135.39L176.24,135.1L175.77,135.1L175.47,134.82L174.61,134.82L173.98,135.03L174.36,135.71L173.59,136.5L172.4,136.7L171.96,137.02L170.88,136.52L169.13,138.29L170.65,139.51L171.18,139.73L170.75,140.23L172,140.98L172.58,141.14L172.98,140.81L173.71,141.92L173.94,141.72L175.1,142.99L175.88,143.73L175.4,144.06L177.22,146.06L177.79,146.85L177.52,147.14L178.28,147.96L178.13,148.12L178.81,148.62L179.15,149.16L178.64,150.05L180.09,152.09L180.35,151.97L181.04,152.27L180.41,152.77L182.38,155.07L183.08,154.4L183.75,154.01L184.04,154.14L185.29,155.89L185.87,157.12L186.11,157.18L186.1,158.44L185.65,161.33L185.49,161.64L184.18,161.11L183.16,162.91L178.58,164.06L178.21,163.92L177.62,164.11L177.51,164.4L175.24,164.73L174.41,165.21L173.79,165.39L173.13,166.03L172.38,166.16L172.51,167.13L172.83,167.97L173.8,168.85L175.19,169.71L175.27,170.5L174.79,170.71L171.96,171.32L168.26,172.82L166.44,173.49L166.1,173.68L165.62,174.36L164.44,175.65L163.53,176.12L158.33,178.26L157.36,178.62L154.48,179.45L153.69,180.49ZM394.01,224.95L394.84,224.27L394.77,223.6L395.29,223.11L395.65,222.4L395.67,221.89L394.61,221.4L394.39,220.9L394.84,220.62L395.12,220.02L394.48,218.83L394.03,218.53L393.5,218.53L392.71,219.09L392.39,219L392.56,218.36L392.42,216.2L392.03,215.68L391.58,215.55L390.51,216.39L389.45,216.06L388.52,216.48L387.99,217.16L387.38,218.41L387.05,218.68L386.36,218.76L386.12,218.3L385.79,218.61L385.52,218.2L384.42,218.44L384.61,219.02L385.13,219.54L384.84,219.88L385.43,219.99L384.83,220.31L384.96,220.97L386.06,222.27L387.05,222.66L387.34,223.01L388.01,222.98L389.07,223.25L389.72,223.22L390.28,222.88L390.37,223.42L390.97,223.96L391.5,223.45L392.28,223.6L392.53,223.97L393.63,224.87L394.01,224.95ZM463.38,252.04L464.43,251.59L464.82,250.69L466.35,249.5L467.3,249.18L469.46,249.05L470.44,248.89L470.62,248.59L471.43,248.05L472.84,247.62L475.58,247.48L476.57,247.76L477.05,247.68L479.34,246.14L481.45,246.04L481.98,245.86L482.05,245.49L481.73,245.07L483.64,244.84L483.94,244.35L486.47,244.44L487.96,244.67L490,244.38L492.26,242.76L494.44,242.32L494.75,241.92L494.5,241.64L493.5,241.48L493.35,241.33L493.91,241.02L493.91,240.37L493.5,239.53L494.75,239.28L495.83,238.56L496.14,237.97L495.87,237.01L498.14,236.73L499.16,236.54L500,235.05L499.78,234.11L498.93,233.53L496.99,233.42L495.47,233.69L493.07,234.51L492.17,234.94L491.94,235.52L492.91,236.49L493.5,236.91L493.22,237.26L491.98,238.08L491.51,238.7L491.12,238.82L488.06,238.63L487.05,239.02L483.4,239.14L481.15,239.84L478.02,241.32L477.58,241.8L477.34,242.38L473.61,242.24L472.93,242.43L472.79,243.31L471.33,243.74L469.05,244.23L466.73,244.61L465.95,245.05L464.89,246.41L463.77,246.4L463.34,246.84L462.13,247.2L461.73,247.69L461.93,248.11L461.42,248.27L460.06,249.62L459.94,250.57L460.1,251.02L461.08,251.4L463,252L463.38,252.04ZM263.56,255.5L264.72,255.13L265.63,254.38L266.72,254.47L267.46,254L267.52,253.09L268.4,252.6L268.94,252.6L269.51,252.01L269.45,251.61L268.71,251.3L268.74,250.12L267.82,249.78L266.58,249.75L265.57,250.29L264.95,250.79L264.35,250.86L263.49,251.65L263.37,251.4L263.78,250.83L265.09,249.77L265.35,249.35L265.81,249.4L266.46,249L266.82,247.24L265.82,246.71L264.99,246.9L264.26,246.55L262.54,246.62L261.33,247.69L260.75,248.33L260.45,247.85L259.06,248.04L259.43,247.08L258.94,247.03L257.29,248.63L256.26,250.01L256.74,250.97L258.18,251.51L259.26,251.37L260.01,251.68L260.14,252.07L259.5,253.23L259.6,253.83L259.98,254.5L259.98,255.15L260.21,255.33L261.33,255.07L261.53,254.68L262.34,254.9L262.86,254.42L263.42,254.43L263.4,255.27L263.56,255.5ZM306.04,257.87L306.66,258.68L306.21,259.55L306.44,260.3L306.17,260.85L306.2,261.49L306.45,262.02L307.07,262.38L308.9,262.66L309.85,262.3L310.77,261.35L311.55,261.21L311.61,260.67L312.24,260.19L312.94,259.1L312.8,258.66L312.33,258.73L310.46,259.48L309.77,259.62L308.36,259.56L308.34,258.32L307.88,257.86L308.23,257.06L307.89,256.7L306.43,257.17L306.04,257.87ZM377.82,315.18L377.17,315.56L376.54,316.85L376.68,317.11L377.19,316.68L378.29,316.55L378.78,316.2L378.84,314.9L379.46,314.2L379.58,313.6L380.14,312.8L380.2,311.54L380.67,311.14L382.19,310.76L383.54,310.23L385.57,308.59L386.23,307.84L386.18,307.24L385.78,307.07L384.82,307.18L383.98,307.57L383.16,307.78L382.58,308.3L381.91,309.43L381.34,309.43L380.88,308.92L380.4,308.91L380.01,309.4L379.23,309.46L379.01,309.67L379.15,310.33L378.28,310.74L377.96,311.1L377.63,312.03L377.59,312.66L378.32,313.22L378.07,314.49L377.82,315.18ZM302.43,197.57L303.08,196.67L303.13,196.26L302.77,196.08L301.81,196.24L301.54,195.49L301.84,195.15L302.44,194.92L301.91,194.83L301.61,193.69L300.69,192.57L300.39,192.61L300.39,193.19L299.83,193.64L299.35,192.53L299.75,192.13L299.9,190.97L299.66,190.59L299.06,190.59L298.06,191.03L297.3,191.02L297,191.39L297.1,192.26L296.73,192.96L296.85,193.23L296.44,193.96L296.84,194.91L298.29,195.64L298.95,195.52L298.54,195.18L298.98,194.75L299.82,195.42L299.51,195.94L300.03,195.98L300.03,196.5L302.43,197.57ZM373.72,240.84L373.61,242.01L373.32,242.36L373.04,242.15L372.85,243.38L373.03,243.86L373.87,244.57L374.38,244.45L375.2,242.9L375.19,242.26L376.07,240.91L376.04,240.17L375.54,240.01L375,239.11L374.63,238.92L374.23,239.33L373.34,239.3L372.76,239.55L372.53,239.05L372.24,239.1L371.59,240.09L371.74,241.12L372.06,241.43L373.72,240.84ZM283.13,273.08L284.06,272.33L284.35,270.62L284.28,269.19L284.42,268.9L284.85,269.22L285.6,269.3L286.67,268.44L288.34,266.73L287.99,265.26L287.13,264.41L287.13,264.16L288.13,264.48L288.38,263.55L288.91,262.52L288.8,262.09L288.31,261.96L287.82,261.51L287.64,260.35L286.75,259.1L286.13,258.83L284.88,259.37L283.36,259.41L283.14,260.62L283.41,261.2L281.01,260.77L279.86,260.29L279.26,260.32L278.8,260.87L278.74,261.78L278.43,261.32L277.74,260.98L277.29,260.24L276.54,260.12L275.77,260.24L275.52,260.61L275.89,261.75L275.52,262.04L274.8,261.55L274.11,261.67L274.06,262.09L274.32,263.06L275.83,264.49L277.32,265.35L276.94,266.81L277.6,268.81L278,269.09L279.49,268.15L279.83,269.35L280.51,269.81L280.51,270.23L280.17,271.12L280.43,271.83L282.31,273.08L283.13,273.08ZM387.3,302.43L387.55,303.29L388.07,303.87L388.97,304.09L390.2,303.85L390.74,303.3L391.27,303.35L392.47,304.12L392.99,303.9L392.98,303.54L392.06,302.32L391.83,301.78L391.88,300.99L392.27,300.45L392.85,300.07L394.42,299.62L395.17,299.7L396.78,300.14L397.65,300.16L398.57,299.99L401.13,298.81L403.02,297.5L403.47,296.68L403.4,295.82L403.06,295.71L402.05,296.77L400.58,297.65L399.57,297.93L398.72,297.82L398.16,297.51L398.07,296.52L399.18,295.05L399.39,294.51L398.67,292.82L398.02,292.67L397.43,293.09L397.08,293.94L396.68,296.15L396.21,296.68L394.46,297.46L390.59,298.81L389.27,299.71L388.25,300.73L387.49,301.85L387.3,302.43ZM342.81,244.04L342.92,244.72L343.39,245.7L343.98,245.85L344.63,245.68L345.59,245.23L346.57,244.53L347.19,244.39L349.41,244.49L350.08,244.05L350.05,243.5L349.43,243.37L348.92,242.88L348.71,241.33L348,241.06L347.05,241.26L345.79,241.1L345.43,240.76L344.75,239.63L344.28,239.51L344.06,239.92L344.23,240.9L343.45,241.89L342.82,243.4L342.81,244.04ZM266.8,288.46L267.31,288.15L268.6,288.37L269.34,287.69L269.31,287.12L270.4,286.8L271.26,287.2L272.52,287.29L274.74,286.11L275.37,284.77L276.09,284.17L276.77,282.89L277.48,282L277.91,281.29L277.88,279.72L275.46,279.54L275.86,278.57L275.83,278.17L274.6,277.4L272.26,276.78L270.83,276.69L270.69,276.38L268.68,275.72L267.25,276.07L266.57,276.7L264.88,277.21L263.79,278.64L263.82,279.1L264.39,279.3L265.42,279.04L265.74,279.12L265.68,279.72L264.88,281.01L264.66,282.11L264.57,283.41L264.74,283.67L265.79,283.61L266.3,284.24L267.44,283.75L267.62,284.43L266.42,285.15L266.45,286.29L265.91,287.32L265.91,287.69L266.8,288.46ZM367.93,236.37L367.29,236.01L367,235.64L367.14,235.34L367.02,234.54L366.56,234.28L365.82,234.5L365.05,234.54L365.24,235.22L365.2,236.37L365.53,237.28L366.09,237.49L366.87,238.44L367.19,238.41L367.57,237.89L368.1,238.2L368.56,238.09L368.74,237.55L369.06,237.34L368.96,236.79L368.5,236.34L367.93,236.37ZM379.89,243.2L380.14,243.72L380.84,244.19L381.58,244.4L381.82,244.15L381.76,243.59L382.4,243.46L382.75,243.13L383.8,242.8L384.16,242.23L383.5,241.49L381.86,241.24L381.28,241.49L381.46,242.11L381.12,242.34L380.87,242.95L380.03,243.02L379.89,243.2ZM326.37,212.85L326.13,212.97L325.77,213.76L325.73,214.62L325.17,214.38L324.99,214.7L323.97,214.41L323.55,214.63L324.47,216.15L324.93,216.69L326.12,216.29L326.61,216.6L327.77,216.79L328.89,216.23L329.29,215.39L329.22,214.79L328.52,214.79L328,213.87L327.41,213.72L326.83,212.94L326.37,212.85ZM307.52,212.74L307.94,212.66L308.23,212.24L308.53,211.12L309.73,209.51L311.6,208.03L311.92,207.67L312.04,206.85L311.29,206.54L310.85,204.73L310.28,203.99L309.3,203.17L309.22,202.09L308.68,202.02L307.96,202.19L307.46,202.07L307.27,201.16L307.71,199.77L307.6,198.75L307.67,197.9L307.4,197.7L305.9,197.98L304.7,197.92L304.23,198.06L303.57,198.62L303.86,199.42L305.38,202.32L305.27,205.54L304.77,206L302.98,207.17L302.87,207.93L303.2,208.88L303.82,208.58L304.1,208.86L304.28,210L304.77,210.28L304.38,210.89L304.61,211.7L305.31,212.11L306.27,212.14L306.67,212.44L307.52,212.74ZM447.44,263.62L448.43,263.44L450.27,262.16L451.28,261.84L452.38,261.65L454.91,261.95L455.99,261.87L456.82,261.93L458.29,262.28L459.19,262.28L460.84,261.76L461.64,261.38L462.31,260.69L462.67,260.09L462.35,259.51L461.92,259.51L460.52,259.85L459.96,259.57L459.96,258.94L460.18,257.98L460.99,256.77L461.01,256.17L460.59,255.35L459.38,254.47L458.26,254.06L455.94,254.27L454.81,254.01L453.35,253.92L451.78,254.13L450.81,254.05L449.5,253.76L448.23,253.72L445.33,253.84L444.37,254.12L443.62,255.13L443.1,257.17L443.08,258.1L443.27,258.94L443.66,259.71L443.7,260.29L443.47,261.31L443.57,262.14L443.94,262.79L444.49,263.12L446.34,263.57L447.44,263.62ZM433.52,267.99L434.2,267.77L435.4,266.52L435.96,266.16L438.36,265.32L438.97,264.9L439.21,264.29L439.21,263.58L439.41,263.13L440.37,262.55L440.97,261.91L441.28,261.08L440.86,259.78L440.66,258.44L440.26,258.18L438.88,258.22L437.97,258.71L437.18,259.58L436.65,259.96L436,260.16L435.02,259.79L434.6,258.83L434.02,258.39L433.02,258.16L432.32,258.34L431.88,258.72L431.57,259.75L431.5,261.04L431.34,261.87L430.88,262.36L429.2,262.67L427.91,262.44L426.42,262.46L424.97,262.86L422.02,264.07L421.48,264.56L421.19,265.25L421.33,265.74L421.82,266.1L422.89,266.19L426.88,266.17L428.53,265.91L429.91,265.93L431.57,266.54L432.06,266.96L432.44,267.57L432.86,267.88L433.52,267.99ZM225.68,164.56L225.31,165.02L225.28,165.58L225.56,165.8L225.32,166.15L225.28,167.03L226.18,166.83L226.54,166.21L226.36,165.2L226.54,164.3L226.44,163.89L225.63,163.89L225.68,164.56ZM298.66,257.2L299.23,257.96L300.62,258.44L301.29,259.08L301.79,259.05L303.19,258.42L303.74,257.85L303.69,257.42L303.11,257.46L302.36,257.94L301.43,258.09L301.28,257.94L301.12,256.9L300.89,256.54L300.14,256.25L299.17,256.59L298.66,257.2ZM244.51,243.17L244.26,243.54L244.32,244.47L244.72,244.86L246.08,245.17L246.4,245.44L246.43,246.76L246.24,247.15L245.15,247.92L244.76,248.68L244.99,249.31L245.68,249.55L246.51,249.56L246.92,249.38L247.9,248L248.06,247.41L248.56,247L248.56,246.6L248.16,245.21L247.28,244.81L247.28,244.35L247.86,243.18L247.73,242.72L247.23,242.6L247,242.16L247.45,241.36L247.43,240.98L246.83,240.79L246.43,241.1L245.67,242.28L244.51,243.17ZM251.4,282.03L253.68,281.79L254.17,281.47L254.52,279.95L254.63,279.83L255.93,280.6L259.49,280.14L259.69,281.06L260.03,281.12L260.61,280.77L261.56,279.64L261.48,279.33L260.32,279.1L260.24,278.15L260.61,277.23L260.29,276.45L260.67,275.29L260.49,274.92L259.72,274.57L257.7,273.4L257.06,273.48L256.08,272.91L255.16,272.68L254.09,273.23L252.85,275.28L251.92,276.35L250.73,277.96L251.26,279.29L251.14,279.69L250.25,280.67L250.19,281.22L250.56,281.77L251.4,282.03ZM335.98,214.18L336.2,213.56L336.85,213.47L337.12,213.18L337.03,212.52L336.33,212.11L336.07,211.43L335.3,210.51L334.63,210.44L334.2,210.13L333.57,210.06L333.32,209.71L332.95,209.81L332.75,210.28L331.49,210.85L331.35,211.85L330.96,213.46L330.17,214.11L330.03,215.32L330.55,215.7L332.72,216.14L333.74,215.91L335.55,214.92L335.98,214.18ZM260.89,202.82L260.64,203.3L260.81,203.99L261.14,204.48L260.65,205.45L261.02,206.23L261.8,206.39L262.68,206.33L263.47,206.07L264.75,205.18L265.25,204.29L266.26,204.22L266.58,203.79L266.46,203.48L265.71,203.33L265.76,202.86L265.42,202.7L264.72,203.3L264.16,203.18L263.74,202.68L260.89,202.82ZM361.26,325.51L361.24,326.58L362.02,326.71L362.36,327.3L362.4,327.96L363.08,328.11L363.63,327.36L363.13,327.04L362.52,326.26L362.2,325.28L361.57,324.86L361.09,325.16L361.26,325.51ZM292.83,264.96L293.22,265.84L293.06,266.61L293.16,267.01L293.52,267.01L293.79,266.56L294.77,266.08L295.32,265.21L295.2,264.32L294.76,264.06L294.31,264.13L293.63,264.57L293.07,264.65L292.83,264.96ZM362.4,332.04L362.44,332.38L363.27,332.42L363.45,333.28L363.96,332.85L364.13,331.86L364.47,331.42L364.24,330.95L363.13,330.84L362.78,330.99L363.21,331.51L362.4,332.04ZM258.39,214.4L258.68,214.55L258.73,215.47L259.51,215.36L259.84,214.83L260.12,213.77L259.29,213.37L258.37,213.67L258.39,214.4ZM376.89,247.92L377.07,248.32L378.2,248.41L378.78,248.27L380.93,247.4L381.35,246.53L381.02,245.43L379.69,243.7L379.21,243.57L378.84,244.13L378.66,245.23L377.97,246.02L377.76,246.8L377.02,247.54L376.89,247.92ZM219.43,162.63L219.07,163.02L219.14,163.66L219.57,163.77L220.25,163.42L220.73,163.97L221.46,163.89L221.71,163.45L221.49,162.93L221.5,162.09L221.12,161.83L220.04,161.81L219.43,162.63ZM338.36,245.5L338.49,245.89L339.03,246.25L340.03,246.26L340.68,245.87L341.45,244.73L342.25,244.07L342.49,243.61L342.37,242.89L341.98,242.7L341.44,242.77L340.3,243.35L339.34,243.71L338.54,244.81L338.36,245.5ZM258.96,219.01L258.54,219.12L258.11,219.64L257.87,220.26L257.94,221.02L258.26,221.66L258.79,222.04L259.94,222.54L261.26,222.46L261.7,222.91L262.19,222.84L262.55,222.17L262.45,221.46L262.21,221.2L261.23,220.82L261.06,220.59L260.89,219.64L260.65,219.28L259.68,219.03L258.96,219.01ZM378.93,316.8L378.73,317.31L378.79,318.03L379.15,318.21L379.18,318.69L379.7,318.89L380.18,318.62L380.1,317.78L379.86,317.47L379.96,316.72L379.81,316.28L378.87,316.21L378.93,316.8ZM268.19,194.64L268.19,194.87L269.47,196L270.03,195.95L271.35,194.73L271.2,194.43L270.39,194.56L269.6,194.39L269.35,194.07L268.82,194.14L268.19,194.64ZM242.51,246.27L243.18,245.66L243.17,245.04L242.59,243.6L242.66,243.11L243.28,242.18L243.17,241.77L242.73,241.79L242,242.55L241.8,243.01L241.68,243.97L241.77,245.03L241.06,245.31L240.94,245.66L241.4,246L242.51,246.27ZM351.64,331.35L351.98,331.77L352,331.28L351.64,331.35ZM369.44,310.64L370.07,311.08L370.06,310.61L369.78,310.27L369.44,310.64ZM311.88,210.07L311.54,210.19L311.66,211.04L311.44,212.71L311.9,213.26L312.56,212.92L312.58,212.35L312.3,211.92L312.44,211.36L312.32,210.41L311.88,210.07ZM234.3,247.97L234.32,248.29L235.11,248.35L235.55,247.96L235.52,247.61L234.35,247.67L234.3,247.97ZM422.98,273.15L423.04,273.66L423.58,273.76L424.71,273.35L425.96,272.31L426.38,272.15L428.44,271.98L429.22,271.7L430.66,270.52L430.79,270.18L430.32,269.7L429.12,269.59L427.74,269.82L426.78,270.49L426.31,270.99L425.79,271.26L424,271.88L423.52,272.28L422.98,273.15ZM296.45,189.99L296.66,190.98L297.01,190.95L297.25,190.22L297.24,189.71L296.49,189.76L296.45,189.99ZM261.94,208.45L261.49,209.04L262.04,209.11L262.41,208.47L261.94,208.45ZM381.64,307.91L381.74,308.43L382.09,308.71L382.45,308.42L382.39,307.9L381.64,307.91ZM229.81,165.76L229.27,165.48L229.25,166.06L229.67,166.42L230.4,166.4L230.56,165.8L229.81,165.76ZM210.27,176.31L209.49,177.41L209.42,178.47L210.02,179.07L210.01,180.58L214.01,180.57L214.23,179.78L215.66,177.51L215.45,176.82L213.4,176.21L210.61,176.21L210.27,176.31ZM457.42,253.55L458.19,253.99L458.65,253.96L458.67,253.63L457.63,253.1L457.42,253.55ZM256.23,244.24L256.69,244.17L257.72,243.69L257.92,243.41L258.14,242.45L258.83,240.89L258.29,240.35L257.75,240.5L256.56,241.61L255.68,241.92L255.48,242.25L255.98,244.12L256.23,244.24ZM224.8,131.97L224.72,132.33L225.65,132.8L226.27,132.5L225.95,132.1L224.8,131.97ZM358.77,327.62L358.4,328.24L358.6,328.82L359.28,329L359.84,328.71L360.11,327.85L359.82,327.21L359.11,327.24L358.77,327.62ZM364.89,327.97L364.82,328.67L365.54,329.09L366.65,329.01L366.84,328.55L366.3,327.82L365.83,327.67L364.89,327.97ZM378.52,319.25L378.47,319.7L378.98,319.84L379.42,319.39L379.43,319.03L379.07,318.91L378.52,319.25ZM313.68,261.69L314.38,261.75L314.8,261.2L313.64,261.33L313.68,261.69ZM223.33,130.96L222.76,130.61L221.84,130.73L222.54,131.04L223.35,131.65L223.94,131.78L223.87,131.23L223.33,130.96ZM282.34,214.67L282.62,213.98L283.65,212.74L283.49,212.12L282.32,212.54L281.69,213.05L281.18,213.92L281.57,214.57L282.34,214.67ZM352.24,232.4L352.85,232.63L352.7,231.95L352.05,231.85L352.24,232.4ZM364.12,323.18L364.93,323.71L365.65,323.62L366.17,322.73L366.02,322.19L365.16,321.98L364.01,322.19L363.73,322.51L364.12,323.18ZM408.49,296.72L408.95,296.85L408.97,296.52L408.49,296.72ZM314.5,149.62L313.95,149.88L314.04,150.68L316.26,151.36L316.85,151.01L316.98,150.13L316.44,149.66L314.5,149.62ZM378.27,238.21L378.4,238.79L379.07,239.15L379.46,238.9L379.53,238.3L379.14,237.73L378.61,237.71L378.27,238.21ZM389.96,304.51L390.12,304.96L390.5,304.83L390.59,304.44L389.96,304.51ZM256.43,246.51L256.85,246.16L257.09,245.32L256.73,244.58L256.34,244.53L255.66,245.22L255.55,245.8L256.03,246.46L256.43,246.51ZM291.83,149.14L290.99,149.21L290.48,149.56L290.42,150.16L290.88,150.71L291.87,150.8L293.42,150.64L293.88,150.25L293.74,149.65L293.31,149.28L291.83,149.14ZM200.52,212.84L201.29,212.85L201.54,206.85L200.84,206.83L200.52,212.84ZM399.28,286.13L399.81,285.75L399.69,285.41L399.16,285.53L399.28,286.13Z"},{"name":"斗门区","adcode":440403,"x":81.78,"y":171.08,"d":"M147.53,187.14L147.02,186.17L149.18,184.58L151.93,182.98L153.69,180.49L151.39,180.58L149.75,180.19L147.96,179.86L145.16,176.81L142.04,173.18L139.58,169.78L138.13,168.49L137.84,168.53L137.02,169.16L136.18,169.24L135.3,167.98L133.93,167.09L132.94,167.66L132.57,167.19L131.8,166.85L131.21,166.79L127.65,164.8L124.89,163.08L123.45,161.98L122.25,160.62L120.64,158.33L119.77,156.52L119.07,154.79L118.2,152.31L117.34,149.99L114.71,144.98L111.88,138.94L111.42,137.59L111.32,134.1L111.06,130.85L109.89,128.48L108.54,126.81L105.95,124.32L95.82,112.57L94.06,110.74L93.05,109.5L88.73,106.68L84.95,104.39L83.62,103.87L82.82,104.22L82.19,104.68L79.61,106.28L78.91,106.8L78.11,106.86L76.85,106.23L75.52,105.13L74.32,105.25L73.06,105.65L72.25,105.64L72.02,104.72L71.16,103.92L70.13,103.8L69.21,104.15L69.02,105.13L69.04,106.22L68.52,106.85L68.12,108.23L66.34,109.72L63.24,110.46L61.44,110.71L60.68,107.91L59.99,105.57L59.58,104.56L59.05,103.86L57.39,102.69L56.35,102.55L55.84,102.7L54.84,103.52L54,103.55L52.36,103.38L51.1,103.51L50.29,104.44L50.24,106.25L50.3,107.12L50.22,108.27L51.35,108.37L51.35,109.11L51.55,109.9L50.84,110.2L50.9,110.4L52.55,112.12L53.25,112.42L57.22,114.68L58,115.29L59.29,117.16L59.8,119.25L60.67,119.32L61.8,119.78L61.49,122.34L60.31,122.49L59.91,123.61L59.97,124.99L60.88,125.43L60.69,126.55L59.8,130L59.91,133.68L59.08,141.38L58.88,144.33L58.53,145.15L55.81,148.65L55.32,149.98L55.26,154.76L53.75,159.06L53.23,162.98L52.33,166.13L50.57,168.23L48.59,169.87L45.25,171.21L41.27,172.53L39.53,172.98L38.32,173.4L37.3,173.94L33.72,177.27L31.84,175.13L28.3,177.37L29.48,179.2L27.42,181.73L26.11,183.02L25.4,184.28L24.8,185.75L22.68,205.51L21.39,208.9L20.84,209.55L21.46,217.29L31.44,216.07L35.58,216.07L38.39,215.56L39.94,214.87L41.49,213.84L44.02,211.6L45.25,210.64L46.66,210.11L50.7,209.67L55.78,209.61L59.11,209.73L62.09,208.59L70.35,205.96L71.95,205.5L72.83,205.51L73.57,205.96L74.06,206.71L74.03,207.79L73.57,208.75L73.21,209.12L71.29,210.5L70.5,211.32L70.5,214.53L70.95,215.72L72.47,217.76L72.68,218.71L72.52,219.26L72.06,219.68L71.39,219.92L69.95,219.98L68.23,219.57L66.45,219.68L64.55,220.71L63.06,222.38L62.71,223.37L63.35,224.62L63.99,225.18L64.64,225.49L65.59,225.54L67.94,223.65L68.98,223.36L69.78,223.59L70.7,224.06L72.51,225.21L73.77,225.8L74.52,225.83L75.38,225.68L75.92,225.27L81.15,220.73L82.56,219.76L83.2,219.63L84.67,219.83L87.41,220.05L88.23,220.03L88.56,219.7L88.79,219.01L90.29,215.56L91.56,213.81L92.99,212.29L96.61,209.49L101.96,206.3L106.51,202.62L107.26,201.89L109.68,203.66L114.61,206.92L115.22,207.5L118.94,205.53L118.55,204.89L119.29,204.47L119.89,204.94L120.6,204.08L119.82,202.9L121.75,202.07L122.74,201.39L123.24,202.08L123.36,202.61L124.13,202.23L123.81,201.69L124.09,201.55L124.54,202.38L125.57,202.57L126.32,202.29L126.59,202.47L127.6,201.72L127.2,201.15L129.89,200.31L130.06,199.98L135.38,207.94L137.59,206.87L142.48,203.44L142.18,202.94L149.54,197.54L144.54,188.76L145.19,188.27L147.53,187.14ZM20,222L20.16,222.42L20.8,222.17L20.84,221.78L20.36,221.71L20,222Z"},{"name":"金湾区","adcode":440404,"x":72.93,"y":262.32,"d":"M21.46,217.29L22.74,233.08L23.75,236.02L26.41,239.69L42.48,253.77L44.19,256.53L44.76,263.01L45.71,266.15L48.84,270.34L52.07,272.73L55.5,274.64L57.58,276.54L65.77,287.87L71.51,295.1L73.84,297.72L78.11,301.77L80.82,303.7L82.57,304.64L87.11,306.29L89.05,307.73L90.34,308L93.18,306.66L96.35,305.64L99.07,303.46L103.21,297.44L104.91,295.88L106.38,295.09L109.88,294.08L110.89,293.3L113.15,288.06L114.02,283.72L113.97,277.02L114.85,273.21L116,271.41L117.75,270.35L123.36,268.21L130.4,266.32L145.84,261.88L158.18,254.68L160.75,251.75L161.53,249.31L161.62,247.43L161.43,245.88L162,244.53L162.55,243.58L163.68,242.33L164.99,241.43L168.16,239.98L169.83,239.15L172.09,237.84L173.85,237.21L169.2,228.67L165.63,221.61L160.35,211.57L152.28,196.29L147.53,187.14L145.19,188.27L144.54,188.76L149.54,197.54L142.18,202.94L142.48,203.44L137.59,206.87L135.38,207.94L130.06,199.98L129.89,200.31L127.2,201.15L127.6,201.72L126.59,202.47L126.32,202.29L125.57,202.57L124.54,202.38L124.09,201.55L123.81,201.69L124.13,202.23L123.36,202.61L123.24,202.08L122.74,201.39L121.75,202.07L119.82,202.9L120.6,204.08L119.89,204.94L119.29,204.47L118.55,204.89L118.94,205.53L115.22,207.5L114.61,206.92L109.68,203.66L107.26,201.89L106.51,202.62L101.96,206.3L96.61,209.49L92.99,212.29L91.56,213.81L90.29,215.56L88.79,219.01L88.56,219.7L88.23,220.03L87.41,220.05L84.67,219.83L83.2,219.63L82.56,219.76L81.15,220.73L75.92,225.27L75.38,225.68L74.52,225.83L73.77,225.8L72.51,225.21L70.7,224.06L69.78,223.59L68.98,223.36L67.94,223.65L65.59,225.54L64.64,225.49L63.99,225.18L63.35,224.62L62.71,223.37L63.06,222.38L64.55,220.71L66.45,219.68L68.23,219.57L69.95,219.98L71.39,219.92L72.06,219.68L72.52,219.26L72.68,218.71L72.47,217.76L70.95,215.72L70.5,214.53L70.5,211.32L71.29,210.5L73.21,209.12L73.57,208.75L74.03,207.79L74.06,206.71L73.57,205.96L72.83,205.51L71.95,205.5L70.35,205.96L62.09,208.59L59.11,209.73L55.78,209.61L50.7,209.67L46.66,210.11L45.25,210.64L44.02,211.6L41.49,213.84L39.94,214.87L38.39,215.56L35.58,216.07L31.44,216.07L21.46,217.29ZM42.54,323.46L42.95,323.35L43.12,321.94L43.55,320.68L44.87,319.55L48.97,315.66L49.92,314.98L52.16,314.22L52.76,314.34L53.48,314.82L53.87,314.8L55.07,314.37L55.76,314.54L56.09,315.28L56.2,316.64L56.63,317.4L58.3,317.31L59.69,317L60.34,316.55L60.46,315.87L60.29,315.1L60.46,314.66L62.02,314.68L62.96,314.53L63.46,314.07L66,312.05L66.95,309.7L66.72,308.14L65.3,307.19L63.14,307.17L61.2,307.75L58.83,309.89L57.09,311.68L56.09,311.66L54.68,310.46L53.77,308.84L53.45,307.12L51.99,306.12L50.27,306.31L49.05,307.02L48.45,308.2L48.48,310L47.46,311.02L45.64,310.61L43.11,307.29L41.92,307.06L41.2,307.2L40.15,309.16L39.9,310.34L39.7,311.93L39.65,314.44L40.09,318.01L40.62,320.57L42.09,323.27L42.54,323.46ZM51.11,276.35L50.71,276.68L50.58,277.81L51.04,278.45L51.35,279.85L52.41,280.92L53.28,281.18L53.81,281.15L54.31,280.4L54.28,280.1L53.04,278.7L53.31,278.33L52.88,277.94L53.31,277.69L53.68,277.79L54.08,277.18L54.54,276.9L54.45,276.44L53.7,275.86L52.72,276.35L51.6,276.07L51.11,276.35ZM40.52,289.61L40.6,289.94L39.42,290.96L38.89,291.71L37.16,292.32L36.49,293.01L35.43,295.52L35.18,297.8L35.56,298.55L36.02,298.44L36.96,297.9L38.75,296.14L39.96,295.06L41.05,293L41.24,292.4L41.78,292.07L43.2,291.79L44.65,291.4L46.43,290.44L47.56,289.47L47.97,288.5L48.54,286.59L48.24,285.48L46.93,285.22L46.67,284.99L46.54,284.13L46.18,283.26L45.32,282.38L44.79,282.27L44.2,282.75L43.11,282.73L42.86,282.94L42.7,283.64L42.05,284.34L40.77,284.76L39.73,287.18L39.73,288.45L39.87,288.93L40.52,289.61ZM39.51,275.9L38.8,275.42L38.17,275.45L37.84,275.85L38.67,276.35L39.27,277.48L39.87,277.84L40.2,277.63L40.23,277.2L39.51,275.9ZM32.68,300.6L32.83,301.44L33.21,301.4L33.46,300.91L34.3,299.94L34.15,299.72L33.26,300.02L32.68,300.6Z"}]}};

    function HomeRegionalMap({ mapKey, rows, selectedName, onSelect, onBack, filterFactor }) {
      const map=REGIONAL_SVG_MAPS[mapKey];
      if(!map)return null;
      const selected=rows.find(row=>row.name===selectedName)||rows[0];
      return <svg key={mapKey} viewBox={map.viewBox} preserveAspectRatio="xMidYMid meet" className="h-full w-full xib-map-enter-province" aria-label={`${mapKey}下辖支行地图`}>
        <rect width="100%" height="100%" fill="transparent" onClick={onBack}/>
        {map.regions.map(region=>{const regionRows=rows.filter(row=>row.mapRegion===region.name);const active=selected?.mapRegion===region.name;const warning=regionRows.some(row=>row.status==='红色预警');const fill=!regionRows.length?'#E2E8F0':active?'#2272DE':warning?'#FCE7EC':'#E8F5EE';return <g key={region.adcode||region.name}><path aria-label={region.name} d={region.d} fill={fill} fillRule="evenodd" clipRule="evenodd" stroke="#FFFFFF" strokeWidth={active?2:1.1} vectorEffect="non-scaling-stroke" className={regionRows.length?'cursor-pointer transition-colors hover:opacity-80':'transition-colors'} onClick={event=>{event.stopPropagation();if(regionRows[0])onSelect(regionRows[0]);}}/><text x={region.x} y={region.y} textAnchor="middle" fill={active?'#FFFFFF':'#64748B'} fontSize="8" fontWeight="600" pointerEvents="none">{region.name}</text></g>})}
        {rows.map((row,index)=>({row,index})).sort((a,b)=>(a.row.name===selectedName?1:0)-(b.row.name===selectedName?1:0)).map(({row,index})=>{const region=map.regions.find(item=>item.name===row.mapRegion);if(!region)return null;const active=row.name===selectedName;const dx=row.dx||0,dy=row.dy||0;const x=region.x+dx,y=region.y+dy;const align=x>350?'end':'start';const panelX=align==='end'?x-154:x+12;const panelY=Math.max(18,Math.min(354,y-26));const riskColor=row.status==='红色预警'?'#E11D48':'#059669';return <g key={row.name} data-testid="home-map-label" data-risk-status={row.status} className="cursor-pointer" onClick={event=>{event.stopPropagation();onSelect(row)}}><circle cx={x} cy={y} r={active?10:8} fill={row.status==='红色预警'?'#F43F5E':'#10B981'} stroke="#FFFFFF" strokeWidth={active?3:2}/><text x={x} y={y+3.5} textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="700" pointerEvents="none">{index+1}</text>{active&&<g pointerEvents="none"><rect x={panelX} y={panelY} width="142" height="50" rx="4" fill="#FFFFFF" stroke="#CBD5E1"/><text x={panelX+10} y={panelY+19} fill="#334155" fontSize="10" fontWeight="700">{row.name}</text><text x={panelX+10} y={panelY+37} fill={riskColor} fontSize="8.5">{Math.round(row.value*filterFactor)}件 · 占比{row.share}</text></g>}</g>})}
      </svg>;
    }
    // 首页：承接原投诉驾驶舱，以同一核心指标展示全国宏观分布。
    function ExecutiveDashboardPage({ onNavigate }) {
      const metrics={
        received:{label:'受理投诉量',total:13240,unit:'件'},
        effective:{label:'有效投诉量',total:12486,unit:'件'},
        responsible:{label:'有责投诉量',total:8210,unit:'件'},
        regulatory:{label:'监管投诉量',total:1286,unit:'件'},
        repeat:{label:'重复投诉量',total:286,unit:'件'},
        overdue:{label:'超期投诉量',total:12,unit:'件'}
      };
      const [selectedBranch,setSelectedBranch]=useState('厦门分行');
      const [selectedRegion,setSelectedRegion]=useState('福建·厦门');
      const [activeDimension,setActiveDimension]=useState(null);
      const [channelMode,setChannelMode]=useState('business');
      const [compareMode,setCompareMode]=useState('环比');
      const [selectedOrg,setSelectedOrg]=useState('全行');
      const [startDate,setStartDate]=useState('2026-07-01');
      const [endDate,setEndDate]=useState('2026-07-15');
      const [homeFilter,setHomeFilter]=useState(DEFAULT_LINKED_FILTER);
      const [mapView,setMapView]=useState('national');
      const [institutionPage,setInstitutionPage]=useState(1);
      const homeFilterFactor=linkedAnalysisFactor(homeFilter,startDate,endDate,selectedOrg);
      // 地图按一级分行汇总：机构范围只决定哪些分行纳入展示，不把支行选择
      // 缩小为支行粒度。条线、渠道、口径、日期和剔除规则仍完整作用于地图数据。
      const mapDataFilter={...homeFilter,orgSelection:allOrganizationSelection()};
      const mapFilterFactor=linkedAnalysisFactor(mapDataFilter,startDate,endDate,'全行');
      const metric=homeFilter.caliber==='有效投诉'?metrics.effective:homeFilter.caliber==='有责投诉'?metrics.responsible:metrics.received;
      let nationalBranchRanking=[
        {name:'厦门分行',region:'福建·厦门',value:836,share:'26.7%',mom:'+12.4%',yoy:'+18.1%',status:'重点关注',x:425,y:255,province:'福建省'},
        {name:'上海分行',region:'上海',value:676,share:'21.6%',mom:'+8.6%',yoy:'+11.4%',status:'重点关注',x:455,y:201,province:'上海市'},
        {name:'珠海分行',region:'广东·珠海',value:628,share:'20.1%',mom:'+18.4%',yoy:'+24.5%',status:'红色预警',x:385,y:260,province:'广东省'},
        {name:'北京分行',region:'北京',value:562,share:'18.0%',mom:'-3.1%',yoy:'+4.2%',status:'正常',x:410,y:130,province:'北京市'},
        {name:'福州分行',region:'福建·福州',value:428,share:'13.7%',mom:'+18.6%',yoy:'+22.8%',status:'红色预警',x:436,y:242,province:'福建省'}
      ];
      let fujianBranchRanking=[
        {name:'厦门分行',region:'福建·厦门',value:836,share:'24.9%',mom:'+12.4%',yoy:'+18.1%',status:'重点关注',x:205,y:246},
        {name:'福州分行',region:'福建·福州',value:691,share:'20.6%',mom:'+18.6%',yoy:'+22.8%',status:'红色预警',x:215,y:104},
        {name:'泉州分行',region:'福建·泉州',value:584,share:'17.4%',mom:'+10.8%',yoy:'+16.5%',status:'重点关注',x:210,y:207},
        {name:'漳州分行',region:'福建·漳州',value:546,share:'16.3%',mom:'+7.6%',yoy:'+12.1%',status:'重点关注',x:175,y:266},
        {name:'宁德分行',region:'福建·宁德',value:486,share:'14.5%',mom:'+6.8%',yoy:'+9.4%',status:'正常',x:242,y:64},
        {name:'龙岩分行',region:'福建·龙岩',value:398,share:'11.9%',mom:'+3.2%',yoy:'+8.6%',status:'正常',x:119,y:230},
        {name:'三明分行',region:'福建·三明',value:356,share:'10.6%',mom:'-2.4%',yoy:'+5.8%',status:'正常',x:139,y:146},
        {name:'南平分行',region:'福建·南平',value:328,share:'9.8%',mom:'+4.8%',yoy:'+7.2%',status:'正常',x:158,y:72},
        {name:'莆田分行',region:'福建·莆田',value:286,share:'8.5%',mom:'+8.7%',yoy:'+10.4%',status:'重点关注',x:222,y:164}
      ];
      const headOfficeMapRow={name:'总行',region:'福建·厦门',value:1248,share:'100.0%',mom:'+6.8%',yoy:'+11.2%',status:'重点关注',x:425,y:248,province:'福建省',isHeadOffice:true};
      const nationalBranchNames=new Set(['北京分行','上海分行','厦门分行','福州分行','珠海分行']);
      const fujianBranchNames=new Set(fujianBranchRanking.map(item=>item.name));
      const mapScope=homeFilter.orgSelection||allOrganizationSelection();
      const selectedMapBranchNames=new Set(mapScope.isAll
        ? [...nationalBranchNames,...fujianBranchNames,'总行']
        : (mapScope.items||[]).map(item=>item.parentName||item.name).filter(Boolean));
      const hasHeadOffice=selectedMapBranchNames.has('总行');
      const hasNationalSelection=hasHeadOffice||[...nationalBranchNames].some(name=>selectedMapBranchNames.has(name));
      const hasFujianSelection=[...fujianBranchNames].some(name=>selectedMapBranchNames.has(name));
      const canOpenFujianRegion=hasHeadOffice||hasFujianSelection;
      const isMapRowSelected=row=>selectedMapBranchNames.has(row.name);
      const mapRowWithSelection=row=>({...row,selected:isMapRowSelected(row),value:isMapRowSelected(row)?Math.round(row.value*mapFilterFactor/Math.max(homeFilterFactor,.0001)):0,status:isMapRowSelected(row)?row.status:'未纳入统计范围'});
      const nationalMapRows=[...nationalBranchRanking.map(mapRowWithSelection),...(hasHeadOffice?[mapRowWithSelection(headOfficeMapRow)]:[])];
      const fujianMapRows=fujianBranchRanking.map(mapRowWithSelection);
      // 后续地图渲染统一使用已聚合的一级分行行；支行不会成为地图字段。
      nationalBranchRanking=nationalMapRows;
      fujianBranchRanking=fujianMapRows;
      const branchProfiles={
        厦门分行:{orgs:4,warning:1,branches:[['厦门分行营业部',286,'34.2%','+22.4%','红色预警'],['思明支行',214,'25.6%','+12.8%','重点关注'],['湖里支行',186,'22.2%','+4.1%','正常'],['海沧支行',150,'17.9%','-2.1%','正常']]},
        上海分行:{orgs:3,warning:1,branches:[['上海分行营业部',318,'47.0%','+8.6%','重点关注'],['浦东支行',226,'33.4%','+3.2%','正常'],['自贸区支行',132,'19.5%','-3.2%','正常']]},
        珠海分行:{orgs:3,warning:2,branches:[['珠海分行营业部',286,'45.5%','+26.8%','红色预警'],['横琴支行',198,'31.5%','+21.3%','红色预警'],['拱北支行',144,'22.9%','+4.2%','正常']]},
        北京分行:{orgs:3,warning:0,branches:[['北京分行营业部',276,'49.1%','-4.6%','正常'],['中关村支行',166,'29.5%','+1.2%','正常'],['朝阳支行',120,'21.4%','-2.1%','正常']]},
        福州分行:{orgs:3,warning:1,branches:[['福州分行营业部',198,'46.3%','+24.2%','红色预警'],['鼓楼支行',132,'30.8%','+8.4%','重点关注'],['台江支行',98,'22.9%','-1.6%','正常']]},
        泉州分行:{orgs:3,warning:1,branches:[['泉州分行营业部',198,'33.9%','+11.8%','重点关注'],['晋江支行',162,'27.7%','+8.4%','正常'],['石狮支行',116,'19.9%','+2.2%','正常']]},
        漳州分行:{orgs:3,warning:1,branches:[['漳州分行营业部',176,'32.2%','+9.7%','重点关注'],['龙文支行',142,'26.0%','+5.1%','正常'],['芗城支行',118,'21.6%','-1.4%','正常']]},
        宁德分行:{orgs:2,warning:0,branches:[['宁德分行营业部',168,'34.6%','+6.8%','正常'],['蕉城支行',126,'25.9%','+3.4%','正常']]},
        龙岩分行:{orgs:2,warning:0,branches:[['龙岩分行营业部',154,'38.7%','+3.2%','正常'],['新罗支行',112,'28.1%','+1.6%','正常']]},
        三明分行:{orgs:2,warning:0,branches:[['三明分行营业部',136,'38.2%','-2.4%','正常'],['梅列支行',98,'27.5%','+1.4%','正常']]},
        南平分行:{orgs:2,warning:0,branches:[['南平分行营业部',128,'39.0%','+4.8%','正常'],['延平支行',92,'28.0%','+2.6%','正常']]},
        莆田分行:{orgs:2,warning:1,branches:[['莆田分行营业部',116,'40.6%','+8.7%','重点关注'],['城厢支行',72,'25.2%','+4.2%','正常']]}
      };
      const regionalSubbranchRanking={
        beijing:[
          {name:'北京分行营业部',region:'北京·东城',value:276,share:'20.8%',mom:'-4.6%',yoy:'+3.2%',status:'正常',province:'北京市',mapRegion:'东城区'},
          {name:'中关村支行',region:'北京·海淀',value:166,share:'12.5%',mom:'+1.2%',yoy:'+6.8%',status:'正常',province:'北京市',mapRegion:'海淀区'},
          {name:'朝阳支行',region:'北京·朝阳',value:148,share:'11.2%',mom:'-2.1%',yoy:'+4.1%',status:'正常',province:'北京市',mapRegion:'朝阳区'},
          {name:'西城支行',region:'北京·西城',value:132,share:'10.0%',mom:'+5.8%',yoy:'+9.4%',status:'正常',province:'北京市',mapRegion:'西城区'},
          {name:'丰台支行',region:'北京·丰台',value:126,share:'9.5%',mom:'+8.6%',yoy:'+12.1%',status:'红色预警',province:'北京市',mapRegion:'丰台区'},
          {name:'石景山支行',region:'北京·石景山',value:112,share:'8.4%',mom:'+3.4%',yoy:'+7.2%',status:'正常',province:'北京市',mapRegion:'石景山区'},
          {name:'通州支行',region:'北京·通州',value:104,share:'7.8%',mom:'+6.2%',yoy:'+10.8%',status:'正常',province:'北京市',mapRegion:'通州区'},
          {name:'昌平支行',region:'北京·昌平',value:96,share:'7.2%',mom:'-1.8%',yoy:'+2.6%',status:'正常',province:'北京市',mapRegion:'昌平区'},
          {name:'大兴支行',region:'北京·大兴',value:88,share:'6.6%',mom:'+4.1%',yoy:'+8.3%',status:'正常',province:'北京市',mapRegion:'大兴区'},
          {name:'顺义支行',region:'北京·顺义',value:78,share:'5.9%',mom:'+2.7%',yoy:'+5.4%',status:'正常',province:'北京市',mapRegion:'顺义区'}
        ],
        shanghai:[
          {name:'上海分行营业部',region:'上海·黄浦',value:318,share:'21.9%',mom:'+8.6%',yoy:'+11.4%',status:'正常',province:'上海市',mapRegion:'黄浦区'},
          {name:'浦东支行',region:'上海·浦东',value:226,share:'15.6%',mom:'+3.2%',yoy:'+7.8%',status:'正常',province:'上海市',mapRegion:'浦东新区'},
          {name:'徐汇支行',region:'上海·徐汇',value:168,share:'11.6%',mom:'+12.4%',yoy:'+18.6%',status:'红色预警',province:'上海市',mapRegion:'徐汇区'},
          {name:'虹桥支行',region:'上海·长宁',value:146,share:'10.1%',mom:'+6.8%',yoy:'+9.6%',status:'正常',province:'上海市',mapRegion:'长宁区'},
          {name:'静安支行',region:'上海·静安',value:132,share:'9.1%',mom:'+4.6%',yoy:'+8.2%',status:'正常',province:'上海市',mapRegion:'静安区'},
          {name:'杨浦支行',region:'上海·杨浦',value:118,share:'8.1%',mom:'-1.6%',yoy:'+3.4%',status:'正常',province:'上海市',mapRegion:'杨浦区'},
          {name:'虹口支行',region:'上海·虹口',value:102,share:'7.0%',mom:'+2.8%',yoy:'+6.1%',status:'正常',province:'上海市',mapRegion:'虹口区'},
          {name:'闵行支行',region:'上海·闵行',value:92,share:'6.3%',mom:'+5.2%',yoy:'+9.3%',status:'正常',province:'上海市',mapRegion:'闵行区'},
          {name:'宝山支行',region:'上海·宝山',value:82,share:'5.7%',mom:'+3.1%',yoy:'+5.8%',status:'正常',province:'上海市',mapRegion:'宝山区'},
          {name:'嘉定支行',region:'上海·嘉定',value:66,share:'4.6%',mom:'-2.4%',yoy:'+1.9%',status:'正常',province:'上海市',mapRegion:'嘉定区'}
        ],
        zhuhai:[
          {name:'珠海分行营业部',region:'广东·珠海',value:286,share:'22.0%',mom:'+26.8%',yoy:'+31.4%',status:'红色预警',province:'广东省',mapRegion:'香洲区',dx:-54,dy:-44},
          {name:'横琴支行',region:'广东·横琴',value:198,share:'15.2%',mom:'+21.3%',yoy:'+28.6%',status:'红色预警',province:'广东省',mapRegion:'香洲区',dx:-18,dy:58},
          {name:'拱北支行',region:'广东·拱北',value:164,share:'12.6%',mom:'+8.4%',yoy:'+12.7%',status:'正常',province:'广东省',mapRegion:'香洲区',dx:-48,dy:30},
          {name:'香洲支行',region:'广东·香洲',value:148,share:'11.4%',mom:'+6.2%',yoy:'+10.5%',status:'正常',province:'广东省',mapRegion:'香洲区',dx:8,dy:-28},
          {name:'吉大支行',region:'广东·吉大',value:126,share:'9.7%',mom:'+4.8%',yoy:'+8.1%',status:'正常',province:'广东省',mapRegion:'香洲区',dx:42,dy:8},
          {name:'前山支行',region:'广东·前山',value:112,share:'8.6%',mom:'+3.6%',yoy:'+6.9%',status:'正常',province:'广东省',mapRegion:'香洲区',dx:5,dy:24},
          {name:'金湾支行',region:'广东·金湾',value:98,share:'7.5%',mom:'+12.6%',yoy:'+18.4%',status:'红色预警',province:'广东省',mapRegion:'金湾区',dx:8,dy:8},
          {name:'斗门支行',region:'广东·斗门',value:82,share:'6.3%',mom:'+2.4%',yoy:'+5.2%',status:'正常',province:'广东省',mapRegion:'斗门区',dx:8,dy:-8},
          {name:'唐家支行',region:'广东·唐家',value:48,share:'3.7%',mom:'-1.8%',yoy:'+2.7%',status:'正常',province:'广东省',mapRegion:'香洲区',dx:58,dy:-48},
          {name:'高新支行',region:'广东·高新',value:38,share:'2.9%',mom:'+5.1%',yoy:'+9.4%',status:'正常',province:'广东省',mapRegion:'香洲区',dx:66,dy:-16}
        ]
      };
      const regionalParentByView={fujian:'福建省内分行'};
      const isSubbranchMap=false;
      // 排行独立于地图视角：无论全国/地区，始终展示机构范围命中的全部一级机构。
      // 五大分行沿用全国口径，其余省内分行取地区口径；总数最多为总行加 12 家分行。
      const displayBranches=[...nationalMapRows,...fujianMapRows.filter(item=>!nationalBranchNames.has(item.name))]
        .filter(item=>item.selected)
        .slice(0,13);
      const selectedBranchMeta=[...nationalMapRows,...fujianMapRows].find(item=>item.name===selectedBranch)||displayBranches[0]||nationalMapRows[0];
      const selectedBranchProfile={...selectedBranchMeta,...(branchProfiles[selectedBranch]||{})};
      const branchCity=selectedBranch.replace('分行','');
      const branchAreaSuffixes=['营业部','中心支行','城东支行','城西支行','城南支行','城北支行','开发区支行','高新区支行','自贸区支行','新区支行','滨海支行','科技园支行','工业园支行','大学城支行','金融街支行','软件园支行','机场支行','港区支行','人民路支行','中山路支行','湖滨支行','会展支行','产业园支行','政务中心支行'];
      const existingBranchRows=selectedBranchProfile.branches||[];
      const existingBranchNames=new Set(existingBranchRows.map(row=>row[0]));
      const generatedBranchRows=branchAreaSuffixes.map((suffix,index)=>{const name=suffix==='营业部'?`${selectedBranch}营业部`:`${branchCity}${suffix}`;const value=Math.max(24,Math.round(selectedBranchMeta.value*(.19-index*.0058)));const share=`${(value/selectedBranchMeta.value*100).toFixed(1)}%`;const changes=['+6.8%','+3.4%','-1.8%','+9.6%','+2.7%','-3.2%','+12.1%','+4.5%'];const change=changes[index%changes.length];const status=index%11===7?'红色预警':index%5===3?'重点关注':'正常';return [name,value,share,change,status];}).filter(row=>!existingBranchNames.has(row[0]));
      const allSubbranchRows=[...existingBranchRows,...generatedBranchRows];
      const selectedScopeItems=mapScope.isAll
        ? [{kind:'group',parentName:selectedBranch}]
        : (mapScope.items||[]).filter(item=>(item.parentName||item.name)===selectedBranch);
      const includesAllSubbranches=selectedScopeItems.some(item=>item.kind==='group');
      const selectedSubbranchItems=selectedScopeItems.filter(item=>item.kind==='subbranch');
      const scopedSubbranchRows=selectedSubbranchItems.map((item,index)=>{
        const existing=allSubbranchRows.find(row=>row[0]===item.name);
        if(existing)return existing;
        const seed=organizationSeed(item.name,index+31);
        const value=Math.max(24,Math.round(selectedBranchMeta.value*(.16-(seed%45)/1000)));
        const share=`${(value/Math.max(1,selectedBranchMeta.value)*100).toFixed(1)}%`;
        const changes=['+6.8%','+3.4%','-1.8%','+9.6%','+2.7%','-3.2%','+12.1%','+4.5%'];
        const change=changes[seed%changes.length];
        const status=seed%9===0?'红色预警':seed%4===0?'重点关注':'正常';
        return[item.name,value,share,change,status];
      }).sort((left,right)=>right[1]-left[1]);
      // 本体选择不列支行；“及其所有下辖”列全部；单选支行直接使用查询栏中命中当前分行的真实支行名称。
      const institutionRows=includesAllSubbranches?allSubbranchRows:scopedSubbranchRows;
      const institutionPageSize=10;
      const institutionPageCount=Math.max(1,Math.ceil(institutionRows.length/institutionPageSize));
      const effectiveInstitutionPage=Math.min(institutionPage,institutionPageCount);
      const pagedInstitutionRows=institutionRows.slice((effectiveInstitutionPage-1)*institutionPageSize,effectiveInstitutionPage*institutionPageSize);
      const institutionTotal=institutionRows.reduce((sum,row)=>sum+row[1],0);
      const institutionShare=row=>institutionTotal?`${(row[1]/institutionTotal*100).toFixed(1)}%`:'0.0%';
      const institutionChange=row=>compareMode==='环比'?row[3]:row[5]||`${(Number.parseFloat(row[3])*1.4).toFixed(1)}%`;
      selectedBranchProfile.orgs=institutionRows.length;
      selectedBranchProfile.warning=institutionRows.filter(row=>row[4]==='红色预警').length;
      const provinceDefaultBranch=Object.fromEntries(Object.entries({'北京市':'北京分行','上海市':'上海分行','福建省':'厦门分行','广东省':'珠海分行'}).filter(([,branch])=>nationalBranchRanking.some(item=>item.name===branch&&item.selected)));
      const provinceRisk={福建省:94,上海市:88,广东省:86,北京市:64};
      const mapFeatures=(window.CHINA_GEOJSON?.features||[]).filter(feature=>feature.geometry);
      const project=coordinate=>{const [longitude,latitude]=coordinate;return [28+(longitude-73.3)/61.8*548,18+(53.7-latitude)/37.2*302];};
      const ringPath=ring=>ring.map((coordinate,index)=>`${index?'L':'M'}${project(coordinate)[0].toFixed(1)},${project(coordinate)[1].toFixed(1)}`).join(' ')+' Z';
      const featurePath=feature=>feature.geometry.type==='Polygon'?feature.geometry.coordinates.map(ringPath).join(' '):feature.geometry.coordinates.map(polygon=>polygon.map(ringPath).join(' ')).join(' ');
      const fujianLabelOffset={'厦门分行':[10,15,'start'],'福州分行':[8,-4,'start'],'泉州分行':[-8,-12,'end'],'漳州分行':[-9,10,'end'],'莆田分行':[12,16,'start'],'宁德分行':[8,-4,'start'],'三明分行':[8,-4,'start'],'南平分行':[8,-4,'start'],'龙岩分行':[-8,-4,'end']};
      const provinceShortName=name=>name.replace(/分行|特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市/g,'')+'分行';
      const changeText=branch=>compareMode==='环比'?branch.mom:branch.yoy;
      const mapRiskColor=status=>status==='红色预警'?'#E11D48':'#059669';
      const riskLabel=status=>status==='红色预警'?'预警':'正常';
      const setBranch=branch=>{if(!branch)return;setSelectedBranch(branch.name);setSelectedRegion(branch.region);setInstitutionPage(1);};
      const enterBranchMap=branch=>{if(!branch||!branch.selected)return;setBranch(branch);if(fujianBranchNames.has(branch.name)&&canOpenFujianRegion){setMapView('fujian');setBranch(fujianMapRows.find(item=>item.name===branch.name)||fujianMapRows[0]);}else if(nationalBranchNames.has(branch.name)||branch.name==='总行'){setMapView('national');}};
      const openSelectedRegion=()=>{if(!canOpenFujianRegion)return;setMapView('fujian');setBranch(fujianMapRows.find(item=>item.selected)||fujianMapRows[0]);};
      const updateOrgScope=(org,scope)=>{const normalized=org.startsWith('全行')?'全行':org;setSelectedOrg(normalized);const items=scope?.isAll?buildStatisticsOrganizationModel().firstLevel.map(parent=>({parentName:parent.name})):scope?.items||[];const selectedParents=new Set(items.map(item=>item.parentName||item.name));const hasNational=selectedParents.has('总行')||[...nationalBranchNames].some(name=>selectedParents.has(name));const hasFujian=[...fujianBranchNames].some(name=>selectedParents.has(name));const nextView=hasNational?'national':hasFujian?'fujian':'national';setMapView(nextView);const preferred=nextView==='fujian'?[...selectedParents].find(name=>fujianBranchNames.has(name)):'厦门分行';setBranch((nextView==='fujian'?fujianMapRows:nationalMapRows).find(item=>item.name===preferred)||(nextView==='fujian'?fujianMapRows:nationalMapRows)[0]);};
      const products=[['贷款',38.7,'#2272DE','+12.6%','+18.4%'],['存款',21.5,'#4997FF','+5.4%','+11.2%'],['财富管理',16.8,'#5A9EEC','-2.8%','+6.1%'],['支付结算',13.5,'#7CA9E8','+9.6%','+14.8%'],['电子银行',9.5,'#A7C7F2','+6.8%','+10.2%']];
      const reasons=[['收费争议',19.5,'+18.6%','+22.4%'],['业务规则告知不清',15.8,'+12.4%','+16.8%'],['办理时效',13.5,'+21.3%','+27.1%'],['营销宣传争议',10.1,'+8.2%','+11.5%'],['服务态度',7.0,'-2.4%','+2.6%']];
      const lineSourceBase=[['零售金融部',2368,'26.7%','+12.4%'],['普惠金融部',1986,'22.4%','+18.6%'],['公司金融部',1352,'15.3%','+7.2%'],['运营管理部',1046,'11.8%','-3.1%'],['风险管理部',864,'9.8%','+2.8%'],['特殊资产经营部',716,'8.1%','+6.4%'],['消费者权益保护部',528,'6.0%','-1.6%'],['授信审批部',486,'5.5%','+4.2%'],['安全保卫部/总务部',438,'4.9%','-2.4%'],['华侨金融部',392,'4.4%','+5.8%'],['科技管理部',346,'3.9%','+3.6%'],['科技开发部',298,'3.4%','+7.1%'],['科技运维部',254,'2.9%','-1.2%']];
      const lineTotal=lineSourceBase.reduce((sum,item)=>sum+item[1],0);
      const lineYoyChanges=['+16.8%','+21.3%','-2.8%','+14.6%','+8.7%','+18.2%','+6.4%','+5.8%','-1.9%','+3.9%','+12.6%','+11.2%','+8.1%'];
      const lineSource=lineSourceBase.map(([name,value,,change],index)=>[name,value,`${(value/lineTotal*100).toFixed(1)}%`,compareMode==='环比'?change:lineYoyChanges[index]]);
      const selectedHomeLines=new Set(homeFilter.lineSelection||BUSINESS_LINE_OPTIONS);
      const lines=lineSource.filter(item=>selectedHomeLines.has(item[0])).sort((left,right)=>right[1]-left[1]).slice(0,7);
      const homeCustomerAges=[['18岁以下',4.8],['18—29岁',14.7],['30—39岁',25.5],['40—49岁',22.9],['50—59岁',17.2],['60岁及以上',13.2],['未知',1.7]];
      const homeCustomerRegions=[['福建省',30.9],['上海市',14.7],['广东省',12.7],['北京市',9.8],['浙江省',7.9],['其他国内地区',16.0],['境外',8.0]];
      const channelSets={business:[['第三方合作平台',34.6,'#2272DE'],['手机银行/网上银行',20.6,'#5A9EEC'],['营业网点柜面',17.5,'#7CA9E8'],['电话及远程服务',10.3,'#A7C7F2'],['其他业务渠道',17.0,'#CBD5E1']],intake:[['金融消费者保护服务平台',38.9,'#2272DE'],['客服电话',21.0,'#5A9EEC'],['营业网点',11.9,'#7CA9E8'],['厦门金管局',6.3,'#F43F5E'],['其它',21.9,'#CBD5E1']]};
      const cockpitChannels=channelSets[channelMode];
      const leadingSubbranch=institutionRows[0]||['未选择下辖支行',0];
      const selectedBranchComplaintCount=Math.max(0,Math.round(selectedBranchProfile.value*homeFilterFactor));
      const shareToComplaintCount=share=>`${Math.round(selectedBranchComplaintCount*Number(share||0)/100).toLocaleString()}件`;
      const branchTopCards=[['产品',products[0][0],shareToComplaintCount(products[0][1])],['原因',reasons[0][0],shareToComplaintCount(reasons[0][1])],['条线',lines[0][0],Math.round(lines[0][1]*homeFilterFactor).toLocaleString()+'件'],['下辖机构',leadingSubbranch[0],Math.round(leadingSubbranch[1]*homeFilterFactor).toLocaleString()+'件'],['客户',homeCustomerAges[0][0],shareToComplaintCount(homeCustomerAges[0][1])],['渠道',cockpitChannels[0][0],shareToComplaintCount(cockpitChannels[0][1])]];
      const selectedPetitionVolume=Math.max(3,Math.round(selectedBranchProfile.value*(isSubbranchMap?.08:.11)));
      let channelStart=0;
      const channelGradient=`conic-gradient(${cockpitChannels.map(item=>{const part=`${item[2]} ${channelStart}% ${channelStart+item[1]}%`;channelStart+=item[1];return part}).join(',')})`;
      const selectDimension=(type,label)=>setActiveDimension(current=>current?.type===type&&current?.label===label?null:{type,label});
      const goIcon=(route,label)=><button onClick={()=>onNavigate(route,route==='line'?{org:selectedOrg,startDate,endDate,filter:{...homeFilter,compare:compareMode}}:undefined)} aria-label={label} title={label} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-[#2272DE] hover:border-[#2272DE] hover:bg-[#E9F1FC]"><Icon name="chevron" size={15}/></button>;
      // 地图标签由旧版 SVG 模板直接输出。未选分行保留灰色名称，同时移除圆点和
      // 数值/占比文本，使它与排行榜的“只列已选分行”规则完全一致。
      React.useEffect(()=>{
        const root=getStatisticsRoot();
        if(!root)return;
        const mapSvg=root.querySelector('svg[aria-label="全国重点分行地图"], svg[aria-label="福建省内分行地图"], svg[aria-label$="下辖支行地图"]');
        const visibleMapRows=mapView==='national'?nationalBranchRanking:mapView==='fujian'?fujianMapRows:displayBranches;
        const mapRowByName=new Map(visibleMapRows.map(row=>[row.name,row]));
        const rankingRowByName=new Map(displayBranches.map(row=>[row.name,row]));
        root.querySelectorAll('svg[aria-label="全国重点分行地图"] g, svg[aria-label="福建省内分行地图"] g').forEach(group=>{
          const texts=group.querySelectorAll('text');
          const detail=texts[1];
          const row=mapRowByName.get(texts[0]?.textContent.trim());
          if(row&&detail){
            detail.textContent=`${Math.round(row.value*homeFilterFactor)}件 · 占比${row.share}`;
            detail.setAttribute('fill',mapRiskColor(row.status));
          }
          if(!detail?.textContent.includes('0件'))return;
          group.querySelectorAll('circle').forEach(circle=>{circle.style.display='none';});
          if(texts[0])texts[0].style.fill='#94A3B8';
          detail.style.display='none';
          group.style.cursor='default';
        });
        root.querySelectorAll('svg[aria-label="福建省内分行地图"] path[data-city]').forEach(path=>{
          const region=FUJIAN_SVG_REGIONS.find(item=>item.city===path.dataset.city);
          const row=fujianMapRows.find(item=>item.name===region?.branch);
          if(row&&!row.selected)path.style.fill='#F1F5F9';
        });
        const rankingAside=mapSvg?.closest('.relative')?.previousElementSibling;
        const rankingTitle=rankingAside?.querySelector('h3');
        if(rankingTitle)rankingTitle.textContent='已选机构投诉排行';
        rankingAside?.querySelectorAll('.mt-2.space-y-1 > button').forEach(button=>{
          const name=button.querySelector('b')?.textContent.trim();
          const row=rankingRowByName.get(name);
          const value=button.querySelector('.text-right b');
          const share=button.querySelector('.text-right small');
          if(!row||!value||!share)return;
          const color=mapRiskColor(row.status);
          value.textContent=String(Math.round(row.value*homeFilterFactor));
          share.textContent=`占比 ${row.share}`;
          value.style.color=color;
          share.style.color=color;
        });
        const detailPanel=mapSvg?.closest('.relative')?.nextElementSibling;
        const comparisonLabel=[...(detailPanel?.querySelectorAll('span')||[])].find(node=>node.textContent.trim().endsWith('变化'));
        if(comparisonLabel?.parentElement)comparisonLabel.parentElement.style.display='none';
        const branchDistribution=root.querySelector('#executive-branch-ranking');
        const branchDistributionSection=branchDistribution?.closest('section');
        if(branchDistributionSection)branchDistributionSection.style.order='2';
        const productDistribution=[...root.querySelectorAll('h2')].find(node=>node.textContent.trim()==='产品类型分布')?.closest('section');
        if(productDistribution)productDistribution.style.order='3';
        // 产品类型保留树图视觉，五个分类在两行内自适应排列。
        const productGrid=productDistribution?.querySelector('.grid.grid-cols-12');
        const productAreas=[['1 / span 5','1 / span 2'],['6 / span 4','1'],['10 / span 3','1'],['6 / span 4','2'],['10 / span 3','2']];
        productGrid?.querySelectorAll('button').forEach((button,index)=>{
          const area=productAreas[index];
          if(!area)return;
          button.style.gridColumn=area[0];
          button.style.gridRow=area[1];
        });
        // 七个年龄段使用同一套递浅色板，避免新增的“未知”柱无颜色。
        const customerDistribution=[...root.querySelectorAll('h2')].find(node=>node.textContent.trim()==='客户投诉分布')?.closest('article');
        const ageColors=['#165DB5','#2272DE','#4997FF','#5A9EEC','#7CA9E8','#A7C7F2','#CBD5E1'];
        const agePanel=[...customerDistribution?.querySelectorAll('h3')||[]].find(node=>node.textContent.trim()==='年龄分布')?.parentElement?.parentElement;
        agePanel?.querySelectorAll('button i').forEach((bar,index)=>{bar.style.background=ageColors[index];});
        const petitionInstitution=[...root.querySelectorAll('h2')].find(node=>node.textContent.trim()==='信访机构分布')?.closest('article');
        const petitionSubtitle=petitionInstitution?.querySelector('h2 + p');
        const switchMapViewFromRanking=event=>{
          const button=event.target.closest('aside button');
          const name=button?.querySelector('b')?.textContent?.trim();
          if(!name)return;
          requestAnimationFrame(()=>setMapView(fujianBranchNames.has(name)?'fujian':'national'));
        };
        root.addEventListener('click',switchMapViewFromRanking,true);
        return()=>root.removeEventListener('click',switchMapViewFromRanking,true);
      },[mapView,selectedBranch,compareMode,homeFilterFactor,mapFilterFactor,mapScope.queryLabel]);
      const homeComplaintCount=Math.round(metric.total*homeFilterFactor);
      const homeRegulatoryRatio=homeFilter.channel==='监管转送'?100:homeFilter.channel==='自收投诉'?0:10.3;
      const homeClosedCount=Math.round(homeComplaintCount*0.964);
      const homeRegulatoryCount=Math.round(homeComplaintCount*homeRegulatoryRatio/100);
      // 原型数量继承首页筛选因子；上期办结率保持同口径，监管数量增幅由总量和占比增幅推导。
      const homeCountGrowth=compareMode==='环比'?6.8:18.2;
      const homeSummaryMetrics=[
        {name:'投诉增长率',value:compareMode==='环比'?'+6.8':'+18.2',icon:'file',detail:`投诉量：${homeComplaintCount.toLocaleString()} 件`,change:homeComplaintCount?`+${homeCountGrowth.toFixed(1)}%`:'—',showComparison:false},
        {name:'投诉件15日办结率',value:'96.4',icon:'check',detail:`15日办结数量：${homeClosedCount.toLocaleString()} 件`,change:homeClosedCount?`+${homeCountGrowth.toFixed(1)}%`:'—'},
        {name:'监管转办件占比',value:homeRegulatoryRatio.toFixed(1),icon:'shield',detail:`监管转办数量：${homeRegulatoryCount.toLocaleString()} 件`,showComparison:false},
        {name:'监管转办件环比/同比',value:compareMode==='环比'?'-9.6':'-16.5',icon:'repeat',valueTone:'text-emerald-600'}
      ];
      const petitionInstitutionSource=[['厦门分行',96,'24.9%'],['福州分行',78,'20.2%'],['上海分行',64,'16.6%'],['珠海分行',58,'15.0%'],['北京分行',46,'11.9%']];
      const petitionInstitutionRows=selectedOrganizationRows(mapScope,petitionInstitutionSource).slice(0,5);
      const petitionHomeCards=[{title:'信访机构分布',rows:petitionInstitutionRows,scopeText:`机构范围：${mapScope.queryLabel||selectedOrg}`},{title:'信访产品分布',rows:[['个人贷款',118,'38.8%'],['借记卡',54,'17.8%'],['理财产品',42,'13.8%'],['支付结算',36,'11.8%'],['存款产品',28,'9.2%']],scopeText:'统计口径：信访工单'}];
      const pageInfo={title:'首页',question:'投诉风险集中在哪里？',caliber:'在统一统计周期和投诉口径下，横向比较全国重点分行，并可切换至福建省内分行视角。',value:'帮助管理层先定位异常机构，再识别产品、原因、渠道和条线贡献。',source:'投诉工单、机构、产品、原因、渠道、业务条线、处理状态及监管标识。'};
      return <div className="mx-auto flex max-w-[1540px] flex-col px-6 py-5">
        <nav className="mb-4 flex gap-2 text-xs text-slate-400"><span className="text-slate-600">首页</span></nav>
        <section className="mb-4 flex items-end justify-between"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-900">首页</h1><CompactInfoPopover info={pageInfo} ariaLabel="查看首页说明"/></div></div><div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500"/>数据更新时间：2026-07-17 08:00</div></section>
        <ComplaintAnalysisFilters pageKey="home" startDate={startDate} endDate={endDate} initialCompare={compareMode} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onOrgChange={updateOrgScope} onFilterChange={changes=>{setHomeFilter(previous=>({...previous,...changes}));if(changes.compare)setCompareMode(changes.compare);}} onQuery={({org,orgSelection,lineSelection,startDate:queryStart,endDate:queryEnd,channel,caliber,compare,organizationDimension,organizationField,excluded})=>{updateOrgScope(org,orgSelection);setStartDate(queryStart);setEndDate(queryEnd);setCompareMode(compare);setHomeFilter({channel,caliber,compare,organizationDimension,organizationField,excluded,orgSelection,lineSelection});}}/>
        <section data-testid="home-summary-metrics" className="mb-4 grid grid-cols-4 gap-4">
          {homeSummaryMetrics.map(item=><AnalysisMetricCard key={item.name} testId="home-summary-card" label={item.name} value={item.value} unit="%" icon={item.icon} valueTone={item.valueTone} detail={item.detail} showComparison={item.showComparison!==false&&Boolean(item.detail)} compareLabel={compareMode} compareValue={item.change} info={{title:item.name,question:`当前${item.name}表现如何？`,caliber:item.showComparison===false?'继承当前筛选栏口径；按所选统计周期和投诉渠道计算。':'继承当前筛选栏口径并按监管评价口径计算。卡片底部展示所列数量的比较期增幅。',value:'用于快速判断规模、效率和监管风险是否异常。',source:'投诉工单及处理字段（原型演示数据）。'}}/>)}
        </section>
        <section style={{order:2}} className="mb-4 grid grid-cols-[1.05fr_.95fr] gap-4"><article className="rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">产品类型分布</h2><p className="mt-1 text-[11px] text-slate-400">投诉主要集中在哪些产品类型</p></div>{goIcon('product','进入产品分析')}</div><div className="grid grid-cols-12 grid-rows-2 gap-2 p-5" style={{height:300}}>{products.map((item,index)=>{const areaClass=['col-span-6 row-span-2','col-span-3','col-span-3','col-span-6'][index];const change=item[compareMode==='环比'?3:4];const count=Math.round(homeComplaintCount*item[1]/100);return <button key={item[0]} onClick={()=>selectDimension('产品',item[0])} className={`${areaClass} flex min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-md p-3 text-left text-white transition hover:-translate-y-0.5 ${activeDimension?.label===item[0]?'ring-4 ring-amber-300 ring-offset-2':''}`} style={{background:item[2]}}><span className="flex min-w-0 items-start justify-between gap-1"><span className="min-w-0 truncate text-xs font-medium" title={item[0]}>{item[0]}</span><span className="shrink-0 whitespace-nowrap text-[10px] text-white"><span className="opacity-80">{compareMode}</span> <b>{normalizedComparison(change)}</b></span></span><span className="block min-w-0"><b className={`${index===0?'text-2xl':'text-lg'} whitespace-nowrap`}>{count.toLocaleString()}</b><small className="ml-1 whitespace-nowrap text-[10px] opacity-80">件</small></span><span className="text-[11px] opacity-80">占比 {item[1]}%</span></button>})}</div></article><article className="rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">投诉原因分布</h2><p className="mt-1 text-[11px] text-slate-400">定位高频原因与增长较快的问题场景</p></div>{goIcon('reason','进入原因分析')}</div><div className="p-5"><div className="mb-2 grid items-center gap-2 px-2 text-[10px] text-slate-400" style={{gridTemplateColumns:'minmax(110px, 132px) minmax(0,1fr) 54px 48px 58px'}}><span>名称</span><span/><span className="text-right">投诉量</span><span className="text-right">占比</span><span className="text-right">{compareMode}</span></div><div className="space-y-1">{reasons.map((item,index)=>{const change=item[compareMode==='环比'?2:3];return <button key={item[0]} onClick={()=>selectDimension('原因',item[0])} className={`grid w-full items-center gap-2 rounded-md px-2 py-2 text-left ${activeDimension?.label===item[0]?'bg-violet-50 ring-1 ring-violet-200':'hover:bg-slate-50'}`} style={{gridTemplateColumns:'minmax(110px, 132px) minmax(0,1fr) 54px 48px 58px'}}><span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-slate-600"><b className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] ${index<3?'bg-[#2272DE] text-white':'bg-slate-100 text-slate-500'}`}>{index+1}</b><span className="truncate">{item[0]}</span></span><span className="h-6 overflow-hidden rounded bg-slate-100"><i className="block h-full rounded bg-[#5A9EEC]" style={{width:`${item[1]*4}%`}}/></span><span className="text-right text-[11px] text-slate-600">{Math.round(homeComplaintCount*item[1]/100).toLocaleString()}件</span><span className="text-right text-[11px] text-slate-600">{item[1]}%</span><span className={`text-right text-[11px] ${change.startsWith('+')?'text-rose-500':'text-emerald-600'}`}>{change}</span></button>})}</div></div></article></section>
        <section style={{order:4}} className="mb-4 rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">业务条线分布</h2></div>{goIcon('line','进入条线分析')}</div><div className="grid grid-cols-7 gap-3 p-5">{lines.map(item=><div key={item[0]} className="rounded-md border border-slate-100 px-3 py-3 text-left"><div className="flex items-start justify-between gap-1"><span className="min-w-0 truncate text-xs font-medium text-slate-700" title={item[0]}>{item[0]}</span><span className="shrink-0 text-[10px]"><ComparisonValue label={compareMode} value={item[3]}/></span></div><b className="mt-2 block text-lg text-slate-900">{Math.round(item[1]*homeFilterFactor).toLocaleString()}<span className="ml-1 text-xs font-normal text-slate-400">件</span></b><span className="mt-1 block text-[11px] text-slate-400">占比 {item[2]}</span></div>)}</div></section><section style={{order:1}} className="mb-4 space-y-4"><article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">投诉地图</h2><p className="mt-1 text-[11px] text-slate-400">{mapView==='national'?'全国重点分行投诉量分布':mapView==='fujian'?'福建省内分行投诉量分布':`${regionalParentByView[mapView]}下辖支行投诉量分布`}</p></div><div className="flex items-center gap-2 text-xs"><div className="flex rounded bg-slate-100 p-0.5">{[{label:'全国',value:'national'},{label:'地区',value:'regional'}].map(item=>{const active=item.value==='national'?mapView==='national':mapView!=='national';return <button type="button" key={item.value} onClick={()=>item.value==='national'?(setMapView('national'),setBranch(nationalBranchRanking[0])):openSelectedRegion()} className={`rounded px-2.5 py-1 text-[11px] ${active?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>{item.label}</button>})}</div><button type="button" onClick={()=>{setMapView('national');setBranch(nationalBranchRanking[0]);setActiveDimension(null);}} className="rounded border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-500">重置</button></div></div><div className="grid grid-cols-[250px_1fr_300px]"><aside className="h-[620px] overflow-y-auto border-r border-slate-100 bg-white p-4"><div className="flex items-start justify-between border-b border-slate-100 pb-3"><div><h3 className="text-xs font-semibold text-slate-700">{mapView==='national'?'五大分行投诉排行':mapView==='fujian'?'福建省内分行排行':'下辖支行投诉排行'}</h3><p className="mt-1 text-[10px] text-slate-400">{statisticsContextText(homeFilter,startDate,endDate)}</p></div><span className="rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-500">Top {displayBranches.length}</span></div><div className="mt-2 space-y-1">{displayBranches.map((item,index)=><button key={item.name} onClick={()=>mapView==='national'?enterBranchMap(item):setBranch(item)} className={`grid w-full grid-cols-[24px_1fr_62px] items-center gap-2 rounded-md px-2 py-2 text-left transition ${selectedBranch===item.name?'bg-violet-50 ring-1 ring-violet-100':'hover:bg-slate-50'}`}><span className={`grid h-5 w-5 place-items-center rounded text-[10px] ${index<3?'bg-[#2272DE] text-white':'bg-slate-100 text-slate-500'}`}>{index+1}</span><span className="min-w-0"><b className="block truncate text-[11px] font-medium text-slate-700">{item.name}</b><small className="mt-0.5 block text-[9px] text-slate-400">{riskLabel(item.status)}</small></span><span className="text-right"><b className="block text-[11px] text-slate-700">{Math.round(item.value*homeFilterFactor)}</b><small className={`block text-[9px] ${changeText(item).startsWith('+')?'text-rose-500':'text-emerald-600'}`}>{changeText(item)}</small></span></button>)}</div></aside><div className="relative h-[620px] overflow-hidden bg-[radial-gradient(circle_at_46%_42%,#E9F1FC,transparent_42%),linear-gradient(145deg,#f8fafc,#ffffff)] p-3">{mapView==='national'?<svg key="national" viewBox="340 82 165 220" preserveAspectRatio="xMidYMid meet" className="h-full w-full xib-map-enter-national" aria-label="全国重点分行地图"><defs><filter id="homeMapShadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#185FBF" floodOpacity=".3"/></filter></defs>{mapFeatures.map(feature=>{const name=feature.properties?.name||'';const branch=provinceDefaultBranch[name];const selected=name===selectedBranchMeta.province;const branchMeta=nationalBranchRanking.find(row=>row.name===branch);const fill=selected?'#2272DE':branchMeta?.status==='红色预警'?'#FCE7EC':branch?'#E8F5EE':'#F1F5F9';return <path key={name} data-region={name} aria-label={name} d={featurePath(feature)} fill={fill} stroke="white" strokeWidth={selected?1.2:.65} vectorEffect="non-scaling-stroke" className={branch?'cursor-pointer transition-colors':'transition-colors'} onClick={()=>{if(branch)enterBranchMap(nationalBranchRanking.find(row=>row.name===branch));}}/>})}{nationalBranchRanking.map(item=>{const selected=item.name===selectedBranch;const color=item.status==='红色预警'?'#F43F5E':'#10B981';const labelLeft=item.name==='珠海分行'||item.name==='北京分行';return <g key={item.name} className="cursor-pointer" onClick={()=>mapView==='national'?enterBranchMap(item):setBranch(item)} filter="url(#homeMapShadow)"><circle cx={item.x} cy={item.y} r={selected?6:4.8} fill="white" stroke={selected?'#123E78':'#FFFFFF'} strokeWidth={selected?1.6:1}/><circle cx={item.x} cy={item.y} r={selected?4.4:3.4} fill={color}/><text x={item.x+(labelLeft?-5.5:5.5)} y={item.y-2} textAnchor={labelLeft?'end':'start'} fill="#334155" fontSize="4.2" fontWeight="700">{item.name}</text><text x={item.x+(labelLeft?-5.5:5.5)} y={item.y+3.8} textAnchor={labelLeft?'end':'start'} fill={changeText(item).startsWith('+')?'#E11D48':'#059669'} fontSize="3.5">{Math.round(item.value*homeFilterFactor)}件 · {compareMode}{changeText(item)}</text></g>})}</svg>:mapView==='fujian'?<svg key="fujian" viewBox="0 0 340 340" preserveAspectRatio="xMidYMid meet" className="h-full w-full xib-map-enter-province" aria-label="福建省内分行地图" onClick={event=>{if(event.target!==event.currentTarget)return;setMapView('national');setBranch(nationalBranchRanking[0]);}}>{FUJIAN_SVG_REGIONS.map(region=>{const branch=fujianBranchRanking.find(item=>item.name===region.branch);const selected=region.branch===selectedBranch;const fill=selected?'#2272DE':branch?.status==='红色预警'?'#FCE7EC':'#E8F5EE';return <path key={region.city} data-city={region.city} aria-label={region.city} d={region.d} fill={fill} fillRule="evenodd" clipRule="evenodd" stroke="#FFFFFF" strokeWidth={selected?2:1.1} vectorEffect="non-scaling-stroke" className="cursor-pointer transition-colors hover:opacity-80" onClick={()=>branch&&setBranch(branch)}/>})}{FUJIAN_SVG_REGIONS.map(region=>{const branch=fujianBranchRanking.find(item=>item.name===region.branch);if(!branch)return null;const selected=region.branch===selectedBranch;const color=branch.status==='红色预警'?'#F43F5E':'#10B981';const labelOffset=fujianLabelOffset[region.branch]||[7,-2,'start'];return <g key={`${region.city}-label`} className="cursor-pointer" onClick={()=>setBranch(branch)}><circle cx={region.x} cy={region.y} r={selected?6:4.5} fill="white" stroke={selected?'#123E78':'#FFFFFF'} strokeWidth={selected?1.6:1}/><circle cx={region.x} cy={region.y} r={selected?4:3} fill={color}/><text x={region.x+labelOffset[0]} y={region.y+labelOffset[1]} textAnchor={labelOffset[2]} fill="#334155" fontSize="7.5" fontWeight="700">{branch.name}</text><text x={region.x+labelOffset[0]} y={region.y+labelOffset[1]+10} textAnchor={labelOffset[2]} fill={changeText(branch).startsWith('+')?'#E11D48':'#059669'} fontSize="6.5">{Math.round(branch.value*homeFilterFactor)}件 · {compareMode}{changeText(branch)}</text></g>})}</svg>:<HomeRegionalMap mapKey={mapView} rows={displayBranches} selectedName={selectedBranch} onSelect={setBranch} onBack={()=>{setMapView('national');setBranch(nationalBranchRanking[0]);}} compareMode={compareMode} filterFactor={homeFilterFactor}/>}<div className="absolute bottom-3 left-4 rounded-md border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur"><div className="mb-1.5 text-[10px] text-slate-400">风险等级</div><div className="flex items-center gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-rose-500"/>预警</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-500"/>正常</span></div></div></div><div className="border-l border-slate-100 p-4"><div className="text-[11px] text-slate-400">当前选中机构</div><div className="mt-1 text-lg font-semibold text-slate-900">{selectedBranch}</div><div className="mt-4 grid grid-cols-2 gap-3"><div><div className="text-[11px] text-slate-400">投诉量</div><div className="mt-1 text-2xl font-semibold text-slate-900">{Math.round(selectedBranchProfile.value*homeFilterFactor).toLocaleString()}<span className="ml-1 text-xs font-normal text-slate-400">{metric.unit}</span></div></div><div className="border-l border-slate-100 pl-3"><div className="text-[11px] text-slate-400">信访量</div><div className="mt-1 text-2xl font-semibold text-[#165DB5]">{selectedPetitionVolume}<span className="ml-1 text-xs font-normal text-slate-400">件</span></div></div></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-slate-500">投诉量全行占比</span><b className="text-violet-600">{selectedBranchProfile.share}</b></div><div className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-500">{compareMode}变化</span><b className={changeText(selectedBranchMeta).startsWith('+')?'text-rose-500':'text-emerald-600'}>{changeText(selectedBranchMeta)}</b></div><div className="mt-4 grid grid-cols-2 gap-2">{branchTopCards.map(item=><div key={item[0]} className="min-w-0 rounded-md border border-slate-100 bg-slate-50 p-2.5"><span className="block text-[10px] text-slate-400">{item[0]} Top1</span><b className="mt-1 block truncate text-xs text-slate-700" title={item[1]}>{item[1]}</b><small className="mt-0.5 block text-[10px] text-violet-600">{item[2]}</small></div>)}</div></div></div></article></section>
                <section style={{order:3}} className="mb-4"><article id="executive-branch-ranking" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">支行投诉分布</h2></div><div className="flex items-center gap-3">{goIcon('institution2','进入机构分析')}</div></div><div className="p-5"><div className="grid gap-3 px-3 pb-2 text-[10px] text-slate-400" style={{gridTemplateColumns:"52px 190px minmax(0, 1fr) 120px 90px 100px"}}><span>排名</span><span>机构</span><span>{metric.label}分布</span><span className="text-right">投诉量</span><span className="text-right">占比</span><span className="text-right">{compareMode}</span></div><div className="space-y-1.5">{pagedInstitutionRows.map((item,index)=>{const rank=(effectiveInstitutionPage-1)*institutionPageSize+index+1;return <button key={item[0]} onClick={()=>{if(item[4]!=='红色预警')return;window.__INSTITUTION_DRILLDOWN__={parentOrg:selectedBranch,focusOrg:item[0],compare:compareMode,change:institutionChange(item),startDate,endDate};onNavigate('institution2')}} className={`grid w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-violet-50 ${item[4]==='红色预警'?'cursor-pointer':'cursor-default'}`} style={{gridTemplateColumns:'52px 190px minmax(0, 1fr) 120px 90px 100px'}}><span className={`grid h-6 w-6 place-items-center rounded text-xs ${rank<=3?'bg-violet-600 text-white':'bg-slate-100 text-slate-500'}`}>{rank}</span><span className="truncate text-xs font-medium text-slate-700">{item[0]}</span><span className="h-6 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded bg-violet-500" style={{width:`${Math.max(6,item[1]/Math.max(...institutionRows.map(row=>row[1]))*100)}%`}}/></span><span className="text-right text-xs text-slate-600">{Math.round(item[1]*homeFilterFactor).toLocaleString()}件</span><span className="text-right text-xs text-slate-600">{institutionShare(item)}</span><span className={`text-right text-xs font-semibold ${Number.parseFloat(institutionChange(item))>0?'text-rose-500':Number.parseFloat(institutionChange(item))<0?'text-emerald-600':'text-slate-500'}`}>{normalizedComparison(institutionChange(item))}</span></button>})}</div></div><footer className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400"><span>共 {institutionRows.length} 家，每页 {institutionPageSize} 家</span><div className="flex items-center gap-1"><button type="button" aria-label="上一页" disabled={effectiveInstitutionPage===1} onClick={()=>setInstitutionPage(page=>Math.max(1,page-1))} className="grid h-8 w-8 place-items-center rounded border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"><span className="rotate-180"><Icon name="chevron" size={14}/></span></button>{Array.from({length:institutionPageCount},(_,index)=>index+1).map(page=><button type="button" key={page} onClick={()=>setInstitutionPage(page)} className={`h-8 min-w-8 rounded border px-2 text-xs ${effectiveInstitutionPage===page?'border-violet-600 bg-violet-600 text-white':'border-slate-200 text-slate-600 hover:border-violet-300'}`}>{page}</button>)}<button type="button" aria-label="下一页" disabled={effectiveInstitutionPage===institutionPageCount} onClick={()=>setInstitutionPage(page=>Math.min(institutionPageCount,page+1))} className="grid h-8 w-8 place-items-center rounded border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="chevron" size={14}/></button></div></footer></article></section>
        <section style={{order:5}} className="mb-4 grid grid-cols-2 gap-4"><article className="rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">渠道分布</h2><p className="mt-1 text-[11px] text-slate-400">{channelMode==='business'?'客户问题发生渠道':'投诉进入系统渠道'}构成</p></div>{goIcon('channel','进入渠道分析')}</div><div className="px-5 pt-4"><div className="inline-flex rounded-md bg-slate-100 p-1"><button onClick={()=>setChannelMode('business')} className={`rounded px-3 py-1.5 text-[11px] ${channelMode==='business'?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>业务办理渠道</button><button onClick={()=>setChannelMode('intake')} className={`rounded px-3 py-1.5 text-[11px] ${channelMode==='intake'?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>投诉受理渠道</button></div></div><div className="flex items-center gap-6 p-5 pt-4"><div className="relative h-36 w-36 shrink-0 rounded-full" style={{background:channelGradient}}><div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center"><span><b className="block text-xl text-slate-900">{Math.round(selectedBranchProfile.value*homeFilterFactor).toLocaleString()}</b><small className="text-[10px] text-slate-400">{selectedBranch}</small></span></div></div><div className="min-w-0 flex-1"><div className="mb-1 grid gap-2 px-2 text-[10px] text-slate-400" style={{gridTemplateColumns:'minmax(0,1fr) 66px 46px'}}><span/><span className="text-right">投诉量</span><span className="text-right">占比</span></div><div className="space-y-1.5">{cockpitChannels.map(item=><button key={item[0]} onClick={()=>selectDimension('渠道',item[0])} className={`grid w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition ${activeDimension?.label===item[0]?'bg-violet-50 ring-1 ring-violet-200':'hover:bg-slate-50'}`} style={{gridTemplateColumns:'minmax(0,1fr) 66px 46px'}}><span className="flex min-w-0 items-center truncate text-left text-slate-500"><i className="mr-2 h-2 w-2 shrink-0 rounded-full" style={{background:item[2]}}/>{item[0]}</span><span className="whitespace-nowrap text-right text-[10px] text-slate-600">{Math.round(homeComplaintCount*item[1]/100).toLocaleString()}件</span><b className="whitespace-nowrap text-right text-slate-700">{item[1]}%</b></button>)}</div></div></div></article><article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">客户投诉分布</h2><p className="mt-1 text-[11px] text-slate-400">年龄与地区维度的投诉客户构成</p></div>{goIcon('customer','进入客户分析')}</div><div className="grid grid-cols-2 divide-x divide-slate-100"><div className="p-5"><div className="mb-2"><h3 className="text-xs font-semibold text-slate-700">年龄分布</h3></div><div className="mb-1 grid gap-1.5 px-1.5 text-[9px] text-slate-400" style={{gridTemplateColumns:'66px minmax(0,1fr) 48px 38px'}}><span/><span/><span className="whitespace-nowrap text-right">投诉量</span><span className="whitespace-nowrap text-right">占比</span></div><div className="space-y-1.5">{homeCustomerAges.map((item,index)=><button type="button" key={item[0]} onClick={()=>{window.__CUSTOMER_DRILLDOWN__={dimension:'年龄',group:item[0]};onNavigate('customer')}} className="grid w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] hover:bg-violet-50" style={{gridTemplateColumns:'66px minmax(0,1fr) 48px 38px'}}><span className="truncate whitespace-nowrap text-slate-500">{item[0]}</span><span className="h-2.5 min-w-0 overflow-hidden rounded-sm bg-slate-100"><i className="block h-full rounded-sm" style={{width:`${item[1]/25.5*100}%`,background:['#165DB5','#2272DE','#4997FF','#7CA9E8','#A7C7F2','#CBD5E1','#CBD5E1'][index]}}/></span><span className="whitespace-nowrap text-right text-[9px] text-slate-600">{Math.round(homeComplaintCount*item[1]/100).toLocaleString()}件</span><b className="whitespace-nowrap text-right text-slate-600">{item[1]}%</b></button>)}</div></div><div className="p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-700">地区分布</h3></div><div className="flex h-[160px] items-end gap-2">{homeCustomerRegions.map((item,index)=><button type="button" key={item[0]} onClick={()=>{window.__CUSTOMER_DRILLDOWN__={dimension:'地区',group:item[0]};onNavigate('customer')}} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"><b className="text-[9px] text-slate-500">{item[1]}%</b><span className="w-full rounded-t-sm group-hover:brightness-95" style={{height:`${Math.max(20,item[1]/30.9*100)}px`,background:item[0].includes('其他')?'#CBD5E1':['#165DB5','#2272DE','#4997FF','#7CA9E8','#A7C7F2'][index]}}/><span className="h-7 text-center text-[9px] leading-3 text-slate-500">{item[0]}</span></button>)}</div></div></div></article></section>        <section style={{order:6}} className="mb-4 grid grid-cols-2 gap-4">{petitionHomeCards.map(card=><article key={card.title} className="rounded-lg border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">{card.title}</h2></div>{goIcon('petition','进入信访统计分析')}</div><div className="p-5"><div className="mb-1 grid items-center gap-2 px-2 text-[10px] text-slate-400" style={{gridTemplateColumns:'28px 120px minmax(0,1fr) 58px 48px'}}><span/><span>名称</span><span/><span className="whitespace-nowrap text-right">投诉量</span><span className="whitespace-nowrap text-right">占比</span></div><div className="space-y-1">{card.rows.map((item,index)=><div key={item[0]} className="grid items-center gap-2 rounded-md px-2 py-2" style={{gridTemplateColumns:'28px 120px minmax(0,1fr) 58px 48px'}}><span className={`grid h-6 w-6 place-items-center rounded text-[10px] ${index<3?'bg-[#2272DE] text-white':'bg-slate-100 text-slate-500'}`}>{index+1}</span><span className="truncate whitespace-nowrap text-xs text-slate-600">{item[0]}</span><span className="h-2.5 min-w-0 overflow-hidden rounded-sm bg-slate-100"><i className="block h-full rounded-sm bg-[#5A9EEC]" style={{width:`${item[2].replace('%','')*2.6}%`}}/></span><span className="whitespace-nowrap text-right text-[11px] text-slate-600">{item[1]}件</span><span className="whitespace-nowrap text-right text-[11px] text-slate-600">{item[2]}</span></div>)}</div></div></article>)}</section>
      </div>;
    }
    function XibTimePicker({ value='08:00', onChange, ariaLabel='选择时间' }) {
      const normalized=/^\d{2}:\d{2}$/.test(value||'')?value:'08:00';
      const [open,setOpen]=useState(false);
      const [draftHour,setDraftHour]=useState(normalized.slice(0,2));
      const [draftMinute,setDraftMinute]=useState(normalized.slice(3,5));
      const rootRef=React.useRef(null);
      const hourRef=React.useRef(null);
      const minuteRef=React.useRef(null);
      const hours=Array.from({length:24},(_,index)=>String(index).padStart(2,'0'));
      const minutes=Array.from({length:60},(_,index)=>String(index).padStart(2,'0'));
      const alignColumn=(ref,index,behavior='auto')=>ref.current?.scrollTo({top:index*32,behavior});
      React.useEffect(()=>{
        if(!open)return;
        setDraftHour(normalized.slice(0,2));
        setDraftMinute(normalized.slice(3,5));
        requestAnimationFrame(()=>{alignColumn(hourRef,Number(normalized.slice(0,2)));alignColumn(minuteRef,Number(normalized.slice(3,5)));});
        const close=event=>{if(rootRef.current&&!rootRef.current.contains(event.target))setOpen(false)};
        getStatisticsRoot()?.getRootNode().addEventListener('mousedown',close);
        return()=>getStatisticsRoot()?.getRootNode().removeEventListener('mousedown',close);
      },[open,normalized]);
      const selectByScroll=(event,options,setter)=>{
        const index=Math.max(0,Math.min(options.length-1,Math.round(event.currentTarget.scrollTop/32)));
        setter(options[index]);
      };
      const choose=(ref,index,setter,value)=>{setter(value);alignColumn(ref,index,'smooth')};
      const cancel=()=>{setDraftHour(normalized.slice(0,2));setDraftMinute(normalized.slice(3,5));setOpen(false)};
      const confirm=()=>{onChange&&onChange(`${draftHour}:${draftMinute}`);setOpen(false)};
      return <div className="xib-time-picker" ref={rootRef}>
        <button type="button" aria-label={ariaLabel} aria-expanded={open} onClick={()=>setOpen(state=>!state)} className={`xib-time-picker-trigger ${open?'is-open':''}`}><img src="ui/assets/clock-in.svg" alt=""/><span>{normalized}</span></button>
        {open&&<div className="xib-time-picker-popover" role="dialog" aria-label={ariaLabel}><div className="xib-time-picker-columns">
          <div ref={hourRef} className="xib-time-picker-column" aria-label="小时" onScroll={event=>selectByScroll(event,hours,setDraftHour)}>{hours.map((item,index)=><button type="button" key={item} onClick={()=>choose(hourRef,index,setDraftHour,item)} className={draftHour===item?'is-active':''}>{item}</button>)}</div>
          <div ref={minuteRef} className="xib-time-picker-column" aria-label="分钟" onScroll={event=>selectByScroll(event,minutes,setDraftMinute)}>{minutes.map((item,index)=><button type="button" key={item} onClick={()=>choose(minuteRef,index,setDraftMinute,item)} className={draftMinute===item?'is-active':''}>{item}</button>)}</div>
        </div><footer className="xib-time-picker-footer"><button type="button" onClick={cancel}>取消</button><button type="button" onClick={confirm}>确定</button></footer></div>}
      </div>;
    }
    function ReportCenterPage() {
      const initialReports=[
        {id:'RP20260716001',name:'消费者投诉情况日报（2026年7月15日）',type:'日报',period:'2026-07-15',created:'2026-07-16 08:05',status:'已邮件推送',receiver:'总行相关部门、各分行',pushTime:'2026-07-16 08:06',channel:'邮件'},
        {id:'RP20260714001',name:'消费者投诉情况周报（2026年第28周）',type:'周报',period:'2026-07-07 至 2026-07-13',created:'2026-07-14 09:00',status:'已邮件推送',receiver:'消保部、零售金融部、各分行',pushTime:'2026-07-14 09:02',channel:'邮件'},
        {id:'RP20260703002',name:'消费者投诉情况季报（2026年第二季度）',type:'季报',period:'2026-04-01 至 2026-06-30',created:'2026-07-03 10:00',status:'已生成',receiver:'—',pushTime:'—',channel:'仅导出'},
        {id:'RP20260703001',name:'消费者投诉情况月报（2026年6月）',type:'月报',period:'2026-06-01 至 2026-06-30',created:'2026-07-03 10:00',status:'已生成',receiver:'—',pushTime:'—',channel:'仅导出'},
        {id:'RP20260715002',name:'监管转送投诉专项日报（2026年7月14日）',type:'日报',period:'2026-07-14',created:'2026-07-15 08:03',status:'邮件推送失败',receiver:'消保部、投诉责任机构',pushTime:'2026-07-15 08:04',channel:'邮件'},
        {id:'RP20260716002',name:'消费者投诉情况日报（2026年7月16日）',type:'日报',period:'2026-07-16',created:'2026-07-17 08:00',status:'生成中',receiver:'总行相关部门、各分行',pushTime:'—',channel:'邮件'}
      ];
      const reportSenderPool=['全行','总行','北京分行','上海分行','厦门分行','福州分行','珠海分行','宁德分行','龙岩分行','泉州分行','漳州分行','莆田分行','三明分行','南平分行'];
      const generatedReports=['日报','周报','季报','月报'].flatMap((type,typeIndex)=>Array.from({length:13},(_,index)=>{
        const day=String(28-index).padStart(2,'0');
        const sender=reportSenderPool[(index+typeIndex)%reportSenderPool.length];
        const id=`RP${20260600+typeIndex*100+index+1}${String(typeIndex+1).padStart(2,'0')}`;
        return {id,name:`${sender}消费者投诉情况${type}（2026年6月${day}日）`,type,period:`2026-06-${day}`,created:`2026-06-${day} ${String(8+typeIndex).padStart(2,'0')}:00`,status:index%7===0?'已生成':'已邮件推送',receiver:'相关管理机构',pushTime:`2026-06-${day} ${String(8+typeIndex).padStart(2,'0')}:06`,sender,channel:'邮件'};
      }));
      const seededReports=initialReports.map((report,index)=>({...report,sender:index<4?'全行':reportSenderPool[(index+2)%reportSenderPool.length]}));
      const [reports,setReports]=useState([...seededReports,...generatedReports]);
      const [selectedId,setSelectedId]=useState(initialReports[0].id);
      const [typeFilter,setTypeFilter]=useState('日报');
      const defaultReportOrganizations=[...reportSenderPool];
      const [reportOrgDraft,setReportOrgDraft]=useState(defaultReportOrganizations);
      const [reportOrgFilter,setReportOrgFilter]=useState(defaultReportOrganizations);
      const defaultReportDateRange={start:'2026-06-01',end:'2026-07-31'};
      const [reportDateDraft,setReportDateDraft]=useState(defaultReportDateRange);
      const [reportDateFilter,setReportDateFilter]=useState(defaultReportDateRange);
      const [reportPage,setReportPage]=useState(1);
      const [selectedReportIds,setSelectedReportIds]=useState([]);
      const [showConfig,setShowConfig]=useState(false);
      const [notice,setNotice]=useState('');
      // 四类报告分别保存模板、统计周期和交付规则，互不覆盖。
      const defaultConfigPresets={
        日报:{type:'日报',name:'消费者投诉情况日报',orgScope:'全行',frequency:'每日',executeTime:'08:00',period:'上一自然日',template:'【日报模板】',dimensions:['投诉来源','机构','投诉次数','投诉类型','投诉事项','投诉渠道'],analysisDimensions:[],metrics:['受理投诉量'],excluded:['重复投诉','再次投诉','异常投诉','废止投诉'],channels:['邮件'],receivers:'总行相关部门、各分行消保联系人',confirmMode:'自动生成并邮件推送',enabled:true},
        周报:{type:'周报',name:'消费者投诉情况周报',orgScope:'全行',frequency:'每周一',executeTime:'09:00',period:'上一自然周',template:'【周报模板】',dimensions:['投诉来源','机构','投诉次数','投诉类型','投诉事项','产品'],analysisDimensions:[],metrics:['受理投诉量'],excluded:['重复投诉','再次投诉','异常投诉','废止投诉'],channels:['邮件'],receivers:'总行消费者权益保护部、普惠金融部、各分行消保联系人',confirmMode:'自动生成并邮件推送',enabled:true},
        月报:{type:'月报',name:'关于消费投诉情况的通报',orgScope:'全行',frequency:'每月3日',executeTime:'10:00',period:'上一自然月',template:'【月报模板】关于2026年X月消费投诉情况的通报',dimensions:['监管来源','自收渠道','机构','业务类型','产品','投诉事项'],analysisDimensions:['受理分行维度','投诉产品维度','投诉事项维度'],metrics:['受理投诉量'],excluded:['重复投诉','再次投诉','异常投诉','废止投诉'],channels:[],receivers:'—',confirmMode:'仅生成，可人工触发并导出',enabled:true},
        季报:{type:'季报',name:'消费者投诉情况季报',orgScope:'全行',quarterSelection:'季度一（1月-3月）',quarterDates:{'季度一（1月-3月）':'2026-04-03','季度二（4月-6月）':'2026-07-03','季度三（7月-9月）':'2026-10-03','季度四（10月-12月）':'2027-01-03'},scheduleDate:'2026-04-03',frequency:'季度一4月3日',executeTime:'08:00',period:'上一自然季度',template:'【季报模板】消费者投诉情况季报',dimensions:['监管来源','自收渠道','机构','业务类型','产品','投诉事项'],analysisDimensions:['受理分行维度','投诉产品维度','投诉事项维度'],metrics:['受理投诉量'],excluded:['重复投诉','再次投诉','异常投诉','废止投诉'],channels:[],receivers:'—',confirmMode:'仅生成，可人工触发并导出',enabled:true},
      };
      const reportAnalysisDimensionOptions={
        日报:[],
        周报:[],
        季报:[['受理分行维度',true],['投诉产品维度',true],['投诉事项维度',true],['投诉原因维度',false]],
        月报:[['受理分行维度',true],['投诉产品维度',true],['投诉事项维度',true],['投诉原因维度',false]]
      };
      const [reportConfigs,setReportConfigs]=useState(defaultConfigPresets);
      // 配置抽屉读取当前已保存的各类型配置，每类模板互相独立。
      const configPresets=reportConfigs;
      const [config,setConfig]=useState(defaultConfigPresets.日报);
      const filtered=reports.filter(item=>{
        const generatedDate=(item.created||'').slice(0,10);
        return item.type===typeFilter&&reportOrgFilter.includes(item.sender)&&generatedDate>=reportDateFilter.start&&generatedDate<=reportDateFilter.end;
      });
      const reportPageSize=10;
      const reportPageCount=Math.max(1,Math.ceil(filtered.length/reportPageSize));
      const pagedReports=filtered.slice((reportPage-1)*reportPageSize,reportPage*reportPageSize);
      const selected=reports.find(item=>item.id===selectedId) || filtered[0] || null;
      const pageSelected=pagedReports.length>0&&pagedReports.every(report=>selectedReportIds.includes(report.id));
      const toggleReportSelection=id=>setSelectedReportIds(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
      const toggleReportPage=()=>setSelectedReportIds(current=>pageSelected?current.filter(id=>!pagedReports.some(report=>report.id===id)):[...new Set([...current,...pagedReports.map(report=>report.id)])]);
      const exportReportRows=items=>{
        if(!items.length)return;
        const rows=[['报告编号','报告类型','报告生成时间','统计机构'],...items.map(item=>[item.id,item.type,item.created,item.sender])];
        const csv='\ufeff'+rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
        const link=document.createElement('a');
        link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
        link.download=`报告中心_${typeFilter}_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        setNotice(`已导出 ${items.length} 份报告清单。`);
        setTimeout(()=>setNotice(''),2200);
      };
      const statusStyle=status=>status.includes('已邮件推送')||status==='已导出'?'bg-emerald-50 text-emerald-600':status==='已生成'?'bg-violet-50 text-violet-600':status==='生成中'?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-600';
      const pageInfo={title:'报告中心',question:'各类投诉报告是否已按计划生成，并按规定方式完成推送或导出？',caliber:'日报、周报由系统按固定计划自动生成并通过邮件推送；月报、季报、年报按周期定期生成，也可人工触发，只提供导出，不进行系统推送。',value:'减少日常报送操作，确保高频报告及时送达，同时保留长周期报告的人工触发和正式导出能力。',source:'投诉工单、监管转送信息、机构、投诉类型、投诉事项、投诉渠道、报告模板、生成任务、邮件接收人和任务日志。'};
      const toggleConfigItem=(field,item)=>setConfig(current=>({...current,[field]:(current[field]||[]).includes(item)?current[field].filter(value=>value!==item):[...(current[field]||[]),item]}));
      const toggleConfigExclusion=label=>setConfig(current=>{
        const next=[...(current.excluded||[])];
        const index=next.indexOf(label);
        if(index>=0)next.splice(index,1);else next.push(label);
        if(label==='重复投诉'){
          if(next.includes('重复投诉')&&!next.includes('再次投诉'))next.push('再次投诉');
          if(!next.includes('重复投诉')){
            const repeatedIndex=next.indexOf('再次投诉');
            if(repeatedIndex>=0)next.splice(repeatedIndex,1);
          }
        }
        if(label==='再次投诉'&&!next.includes('再次投诉')){
          const repeatedIndex=next.indexOf('重复投诉');
          if(repeatedIndex>=0)next.splice(repeatedIndex,1);
        }
        return {...current,excluded:next};
      });
      const saveConfig=()=>{
        setReportConfigs(current=>({...current,[config.type]:config}));
        setShowConfig(false);
        setNotice(`${config.type}配置已保存，将按“${config.frequency} ${config.executeTime}”自动生成。`);
        setTimeout(()=>setNotice(''),3000);
      };
      const switchReportType=type=>{
        setTypeFilter(type);
        setReportPage(1);
        setSelectedReportIds([]);
      };
      // 报告配置只能从系统已有变量库选择，避免各模板自行创建同义指标。
      const reportVariableLibrary=[
        {title:'业务维度变量',field:'dimensions',items:['投诉来源','监管来源','自收渠道','机构','投诉次数','投诉类型','业务类型','产品','投诉事项','投诉渠道']},
        {title:'基础统计变量',field:'metrics',items:['投诉量','占比','首次投诉量','重复投诉量']},
        {title:'周期对比变量',field:'metrics',items:['上期投诉量','环比','去年同期投诉量','同比']}
      ];
      const reportMetricLibrary=[
        {title:'投诉规模指标',field:'metrics',items:['受理投诉量','有效投诉量','有责投诉量']},
        {title:'数据剔除规则',field:'excluded',items:['重复投诉','再次投诉','异常投诉','废止投诉']}
      ];
      const selectScaleMetric=item=>setConfig(current=>({...current,metrics:[item]}));
      const analysisDimensionOptions=reportAnalysisDimensionOptions[config.type]||[];
      const toggleAnalysisDimension=item=>{
        const locked=analysisDimensionOptions.find(option=>option[0]===item)?.[1];
        if(locked)return;
        toggleConfigItem('analysisDimensions',item);
      };
      // 报告正文严格区分日报、周报和月报模板，列表切换时同步切换预览结构。
      const PreviewTable=({headers,rows})=><table className="mt-2 w-full border-collapse text-[10px]"><thead><tr className="bg-slate-50 text-slate-500">{headers.map(header=><th key={header} className="border border-slate-200 px-2 py-2 text-left font-medium">{header}</th>)}</tr></thead><tbody>{rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,index)=><td key={index} className={`border border-slate-200 px-2 py-2 ${index>0&&/^[-+\d]/.test(String(cell))?'text-right':''}`}>{cell}</td>)}</tr>)}</tbody></table>;
      const ReportPaper=({title,subtitle,children,date})=><div className="mx-auto max-w-[680px] rounded-md border border-slate-200 bg-white px-8 py-7 shadow-sm"><div className="border-b border-slate-200 pb-5 text-center"><h3 className="text-xl font-semibold tracking-wide text-slate-900">{title}</h3><p className="mt-2 text-xs text-slate-400">{subtitle}</p></div>{children}<div className="mt-6 text-right text-xs leading-6 text-slate-500">总行消费者权益保护部<br/>{date}</div></div>;
      const reportDisplayDate=report=>(report.created||'').slice(0,10).replaceAll('-','年').replace(/年(\d{2})年(\d{2})$/,'年$1月$2日');
      const DailyPreview=({report})=> <ReportPaper title={report.name} subtitle={`统计日期：${report.period}`} date={reportDisplayDate(report)}><div className="mt-5 text-xs leading-7 text-slate-600"><p>{report.sender}相关部门：</p><p className="mt-2 indent-6"><b className="text-slate-800">1. 厦门金融监管局转送投诉 8 件。</b>其中福州、珠海分行各2件，厦门分行4件；按照投诉类型，合作类贷款投诉6件；投诉问题主要为贷款业务办理和贷款催收。具体情况详见附表1。</p><p className="mt-2 indent-6"><b className="text-slate-800">2. 其他属地金融监管转送投诉 6 件。</b>其中珠海分行2件，福州、上海分行各2件；按照投诉类型，合作类贷款投诉3件，非合作类贷款投诉2件，其他投诉1件。具体情况详见附表2。</p><p className="mt-2 indent-6"><b className="text-slate-800">3. 本行自收投诉 42 件，剔除重复投诉5件。</b>投诉主要集中在福州、厦门、珠海和上海分行，主要问题为贷款催收。具体情况详见附表3。</p></div><div className="mt-5"><div className="text-xs font-semibold text-slate-700">附表摘要</div><PreviewTable headers={['投诉来源','投诉量','首次投诉','重复投诉','主要投诉事项']} rows={[["厦门监管转送","8","6","2","贷款业务办理"],["其他属地监管转送","6","5","1","协商还款、催收"],["本行自收","42","37","5","贷款催收"]]}/></div><div className="mt-5 rounded-md border-l-2 border-violet-500 bg-violet-50 px-4 py-3 text-xs leading-6 text-slate-600"><b className="text-violet-700">处置要求：</b>请相关分行做好分类处置，对首次投诉单独登记台账并跟踪处理；涉及征信、协商还款或异常投诉情形的，应做好核验判断。</div></ReportPaper>;
      const WeeklyPreview=({report})=> <ReportPaper title={report.name} subtitle={`统计周期：${report.period}`} date={reportDisplayDate(report)}><div className="mt-5 text-xs leading-7 text-slate-600"><p>{report.sender}相关部门：</p><p>现将本统计周期的投诉数据通报如下：</p><p className="mt-2 indent-6"><b className="text-slate-800">1. 厦门金融监管局转送投诉 38 件。</b>其中首次投诉28件，二次投诉7件，三次及以上重复投诉3件；合作类贷款投诉31件；投诉问题主要集中在贷款业务办理18件，占比47.4%。</p><p className="mt-2 indent-6"><b className="text-slate-800">2. 其余属地金融监管局转送投诉 24 件。</b>其中首次投诉19件，二次投诉4件，三次及以上重复投诉1件；投诉问题主要集中在贷款业务办理9件，占比37.5%。</p><p className="mt-2 indent-6"><b className="text-slate-800">3. 本行自收投诉 286 件，已剔除重复投诉32件。</b>合作类贷款投诉236件，非合作类贷款投诉28件，其他投诉22件；主要集中在贷款催收和贷款业务办理。</p><p className="mt-2 indent-6"><b className="text-slate-800">综上，本行全量投诉共348件。</b>投诉机构聚焦福州、厦门和珠海分行；投诉产品聚焦度小满、京东、美团和乐信。</p></div><div className="mt-5"><div className="text-xs font-semibold text-slate-700">附表：各来源投诉周环比摘要</div><PreviewTable headers={['投诉来源','本周合计','上周合计','环比','首次','二次','三次及以上']} rows={[["厦门监管转送","38","32","+18.8%","28","7","3"],["其他属地监管转送","24","26","-7.7%","19","4","1"],["本行自收","286","268","+6.7%","254","24","8"]]}/></div><div className="mt-5 rounded-md border-l-2 border-violet-500 bg-violet-50 px-4 py-3 text-xs leading-6 text-slate-600"><b className="text-violet-700">管理要求：</b>请总行普惠金融部及厦门、福州、珠海分行加强互联网合作机构管理，妥善处理重复投诉，推动合作类贷款业务投诉压降。</div></ReportPaper>;
      const MonthlyPreview=({report})=> <ReportPaper title={report.name} subtitle={`报告周期：${report.period}`} date={reportDisplayDate(report)}><div className="mt-5 text-xs leading-6 text-slate-600"><h4 className="font-semibold text-slate-800">一、本月投诉情况</h4><p className="mt-2 indent-6">本统计周期内，剔除重复投诉及异常投诉后，本行受理投诉1,248件，环比增加86件，增幅7.4%，同比增加214件，增幅20.7%。其中监管转办投诉128件，占比10.3%；自收渠道投诉1,120件，占比89.7%。</p><h5 className="mt-4 font-semibold text-slate-700">（一）监管转办投诉情况</h5><p className="mt-1 indent-6">全国属地监管转办投诉128件，环比增加9件，增幅7.6%；同比减少12件，降幅8.6%。其中厦门监管转办投诉72件，属地监管转办投诉56件。</p><PreviewTable headers={['金管局','本月件数','占比','上月件数','环比','去年同期','同比']} rows={[["厦门监管局","72","56.3%","66","+9.1%","78","-7.7%"],["珠海监管局","18","14.1%","16","+12.5%","20","-10.0%"],["福建监管局","16","12.5%","15","+6.7%","18","-11.1%"],["其他监管局","22","17.1%","22","0.0%","24","-8.3%"]]}/><h5 className="mt-4 font-semibold text-slate-700">1. 按受理分行维度</h5><p className="mt-1">珠海分行投诉量环比上升，其他分行投诉量总体平稳；福州分行投诉量同比上升，需要重点关注。</p><PreviewTable headers={['分行','本月投诉','占比','上月投诉','环比','去年同期','同比']} rows={[["福州分行","286","22.9%","268","+6.7%","232","+23.3%"],["厦门分行","248","19.9%","226","+9.7%","210","+18.1%"],["珠海分行","196","15.7%","174","+12.6%","168","+16.7%"]]}/><h5 className="mt-4 font-semibold text-slate-700">2. 按投诉业务类型维度</h5><p className="mt-1">贷款类投诉1,086件，占比87.0%；其中合作类贷款投诉936件，主要集中在度小满、京东、美团和乐信。</p><h5 className="mt-4 font-semibold text-slate-700">3. 按投诉事项维度</h5><p className="mt-1">贷款催收及协商还款投诉518件，占比41.5%；贷款业务办理投诉396件，占比31.7%；个人征信投诉86件，占比6.9%。</p><h5 className="mt-4 font-semibold text-slate-700">（二）自收渠道投诉情况</h5><p className="mt-1 indent-6">本行自收渠道投诉1,120件，其中金融消费者保护服务平台小程序投诉968件，银行客服渠道投诉126件，其他自收渠道投诉26件。</p><PreviewTable headers={['自收投诉渠道','本月投诉','占比','上月投诉','环比','去年同期','同比']} rows={[["金融消保服务平台","968","86.4%","884","+9.5%","746","+29.8%"],["银行客服渠道","126","11.3%","132","-4.5%","138","-8.7%"],["其他自收渠道","26","2.3%","27","-3.7%","22","+18.2%"]]}/><h4 className="mt-5 font-semibold text-slate-800">二、投诉数据分析及管理要求</h4><p className="mt-2"><b>（一）监管转办投诉：</b>监管转办投诉总体平稳，但厦门监管转办量环比上升，应重点关注合作类贷款业务办理问题。</p><p className="mt-1"><b>（二）投诉高度聚焦于合作类贷款：</b>应加强重点合作平台准入、考核和退出管理。</p><p className="mt-1"><b>（三）个别分行投诉同比增幅较大：</b>福州、厦门分行应形成专项压降方案并跟踪整改效果。</p><h4 className="mt-5 font-semibold text-slate-800">三、其他投诉管理要求</h4><p className="mt-2">请各单位强化重复投诉治理、监管投诉时效管理和投诉溯源整改，按月反馈重点问题整改进展。</p></div></ReportPaper>;
      const LongCyclePreview=({report})=> <ReportPaper title={report.name} subtitle={`统计周期：${report.period}`} date={reportDisplayDate(report)}><div className="mt-5 text-xs leading-7 text-slate-600"><h4 className="font-semibold text-slate-800">一、投诉总体情况</h4><p className="mt-2 indent-6">本报告按当前统计周期汇总{report.sender}投诉规模、监管转送、自收渠道、重点机构、产品及投诉事项，并与上一可比周期和去年同期进行比较。</p><h4 className="mt-4 font-semibold text-slate-800">二、重点分布与变化</h4><PreviewTable headers={['分析维度','本期投诉量','占比','环比','同比']} rows={[["监管转送","1,286","10.3%","+9.6%","+12.3%"],["本行自收","11,200","89.7%","+6.4%","+18.6%"],["合作类贷款","5,346","42.8%","+12.1%","+24.3%"]]}/><h4 className="mt-4 font-semibold text-slate-800">三、管理要求</h4><p className="mt-2">请相关机构围绕投诉增长较快的产品、原因和渠道开展核查，形成问题清单并持续跟踪整改效果。</p></div></ReportPaper>;
      if(showConfig) return <div className="mx-auto max-w-[1320px] px-6 py-5">
        <nav className="mb-4 flex items-center gap-2 text-xs text-slate-400"><button onClick={()=>setShowConfig(false)} className="flex items-center gap-1 text-violet-600 hover:text-violet-700">← 返回报告中心</button><span>/</span><span>{config.type}维护配置</span></nav>
        <section className="mb-5 flex items-end justify-between border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-violet-600 text-white"><Icon name="file" size={19}/></span><div><h1 className="text-2xl font-semibold text-slate-900">{config.type}维护配置</h1></div></div>
          <div className="flex gap-2"><button onClick={()=>setShowConfig(false)} className="rounded-md border border-slate-200 bg-white px-5 py-2.5 text-xs text-slate-500">取消</button><button onClick={saveConfig} className="rounded-md bg-violet-600 px-6 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-violet-700">保存配置</button></div>
        </section>
        <section className="min-h-0 rounded-lg border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-semibold text-slate-800">指标变量库</h2><p className="mt-1 text-xs text-slate-400">选择需要写入{config.type}的指标，并配置数据剔除规则与分析维度；指标名称与统计口径由系统变量库统一维护</p></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-600">已选 {(config.metrics||[]).length+(config.excluded||[]).length+(config.analysisDimensions||[]).length} 项</span></div>
          <div className="space-y-5">{reportMetricLibrary.map(group=><div key={group.title} data-testid={group.title==='投诉规模指标'?'report-scale-metrics':undefined}><div className="mb-2 text-xs font-medium text-slate-600">{group.title}</div><div role={group.title==='投诉规模指标'?'radiogroup':undefined} aria-label={group.title} className="grid grid-cols-5 gap-2">{group.items.map(item=>{const checked=(config[group.field]||[]).includes(item);return <button key={item} role={group.title==='投诉规模指标'?'radio':undefined} aria-checked={group.title==='投诉规模指标'?checked:undefined} onClick={()=>group.field==='excluded'?toggleConfigExclusion(item):selectScaleMetric(item)} className={`flex items-center gap-2 rounded-md border px-3 py-3 text-left text-xs transition ${checked?'border-violet-300 bg-violet-50 text-violet-700':'border-slate-200 bg-white text-slate-500 hover:border-violet-200'}`}><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${checked?'border-violet-600 bg-violet-600 text-white':'border-slate-300'}`}>{checked?'✓':''}</span>{item}</button>})}</div></div>)}</div>
          {analysisDimensionOptions.length>0&&<div data-testid="report-analysis-dimensions" className="mt-5"><div className="mb-2 text-xs font-medium text-slate-600">分析维度</div><div className="grid grid-cols-4 gap-2">{analysisDimensionOptions.map(([item,locked])=>{const checked=(config.analysisDimensions||[]).includes(item);return <button type="button" key={item} disabled={locked} onClick={()=>toggleAnalysisDimension(item)} aria-checked={checked} className={`flex items-center gap-2 rounded-md border px-3 py-3 text-left text-xs transition ${checked?'border-violet-300 bg-violet-50 text-violet-700':'border-slate-200 bg-white text-slate-500 hover:border-violet-200'} ${locked?'cursor-not-allowed opacity-80':''}`}><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${checked?'border-violet-600 bg-violet-600 text-white':'border-slate-300'}`}>{checked?'✓':''}</span><span className="whitespace-nowrap">{item}</span>{locked&&<span className="ml-auto text-[10px] text-slate-400">固定</span>}</button>})}</div></div>}
          <div className="mt-5 border-t border-slate-100 pt-4 text-[11px] text-slate-400">如需调整指标名称、定义或计算口径，请前往“标签与口径管理”维护变量库。</div>
        </section>
      </div>;

      return <div className="mx-auto max-w-[1540px] px-6 py-5">
        <nav className="mb-4 flex gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span>运营管理</span><span>/</span><span className="text-slate-600">报告中心</span></nav>
        <section className="mb-4"><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold text-slate-900">报告中心</h1><CompactInfoPopover info={pageInfo} ariaLabel="查看报告中心说明"/></div></section>

        <section data-testid="report-type-cards" className="mb-4 grid grid-cols-4 gap-3">
          {Object.keys(reportConfigs).map(type=>{
            const item=reportConfigs[type];
            const active=typeFilter===type;
            return <article key={type} onClick={()=>switchReportType(type)} className={`cursor-pointer rounded-lg border p-3 shadow-card transition ${active?'border-violet-400 bg-violet-50 ring-1 ring-violet-100':'border-slate-200 bg-white hover:border-violet-200'}`}>
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-md ${active?'bg-violet-600 text-white':'bg-violet-50 text-violet-600'}`}><Icon name="file" size={15}/></span><b className={`text-sm ${active?'text-violet-700':'text-slate-700'}`}>{type}</b></div><span className={`rounded px-2 py-0.5 text-[10px] ${item.enabled?'bg-emerald-50 text-emerald-600':'bg-slate-100 text-slate-400'}`}>{item.enabled?'已启用':'已停用'}</span></div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400"><span>{item.frequency} · {item.executeTime}</span><button onClick={event=>{event.stopPropagation();setConfig({...item});setShowConfig(true)}} className="font-medium text-violet-600">维护配置</button></div>
            </article>
          })}
        </section>

        <section data-testid="report-filter-bar" className="mb-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-card">
          <div className="grid grid-cols-[minmax(240px,320px)_1fr_auto] items-end gap-4">
            <ReportOrganizationMultiSelect value={reportOrgDraft} onChange={setReportOrgDraft}/>
            <div className="pb-2 text-xs text-slate-400">当前报告类型：<b className="font-medium text-slate-600">{typeFilter}</b> · 共 {filtered.length} 份</div>
            <div className="flex gap-2"><button onClick={()=>{setReportOrgDraft(defaultReportOrganizations);setReportOrgFilter(defaultReportOrganizations);setReportDateDraft(defaultReportDateRange);setReportDateFilter(defaultReportDateRange);setReportPage(1);setSelectedReportIds([])}} className="h-10 rounded-md border border-slate-200 px-5 text-sm text-slate-600">重置</button><button onClick={()=>{setReportOrgFilter([...reportOrgDraft]);setReportDateFilter({...reportDateDraft});setReportPage(1);setSelectedReportIds([])}} className="h-10 rounded-md bg-violet-600 px-6 text-sm font-medium text-white">查询</button></div>
          </div>
          <div data-testid="report-query-date" className="mt-3 grid items-center border-t border-slate-100 pt-3 text-xs text-slate-600" style={{gridTemplateColumns:'96px 320px 36px 320px',columnGap:'16px',justifyContent:'start'}}>
            <span data-testid="report-query-date-label" className="font-medium text-slate-500">查询日期</span>
            <input type="date" aria-label="报告查询开始日期" value={reportDateDraft.start} max={reportDateDraft.end} onChange={event=>setReportDateDraft(current=>({...current,start:event.target.value}))} className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-violet-400"/>
            <span className="text-center text-slate-400">至</span>
            <input type="date" aria-label="报告查询结束日期" value={reportDateDraft.end} min={reportDateDraft.start} onChange={event=>setReportDateDraft(current=>({...current,end:event.target.value}))} className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-violet-400"/>
          </div>
        </section>
        <div data-testid="report-list-preview-layout" className="grid items-start gap-4 lg:grid-cols-[minmax(560px,0.9fr)_minmax(0,1.1fr)]">
          <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
          <header className="flex min-h-[52px] items-center justify-between border-b border-slate-100 px-5">
            <div><h2 className="text-sm font-semibold text-slate-800">报告列表</h2><p className="mt-0.5 text-[11px] text-slate-400">每页 10 笔，按报告生成时间倒序</p></div>
            <button data-testid="batch-export-reports" disabled={!selectedReportIds.length} onClick={()=>exportReportRows(reports.filter(report=>selectedReportIds.includes(report.id)))} className="h-8 rounded-md bg-violet-600 px-4 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">批量导出（{selectedReportIds.length}）</button>
          </header>
          <div className="overflow-x-auto">
            <table data-testid="report-list-table" className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-50 text-[11px] text-slate-500"><tr className="h-10"><th className="w-12 px-4"><input aria-label="选择本页报告" type="checkbox" checked={pageSelected} onChange={toggleReportPage} className="h-3.5 w-3.5 accent-violet-600"/></th><th className="w-[148px] px-3 font-medium">报告编号</th><th className="w-[72px] whitespace-nowrap px-3 font-medium">报告类型</th><th className="w-[150px] whitespace-nowrap px-3 font-medium">报告生成时间</th><th className="whitespace-nowrap px-3 font-medium">统计机构</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{pagedReports.map(report=><tr key={report.id} data-report-row={report.id} tabIndex={0} aria-selected={selected.id===report.id} onClick={()=>setSelectedId(report.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedId(report.id)}}} className={`h-11 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400 ${selected.id===report.id?'bg-violet-50/60':'hover:bg-slate-50'}`}><td className="px-4"><input aria-label={`选择报告${report.id}`} type="checkbox" checked={selectedReportIds.includes(report.id)} onClick={event=>event.stopPropagation()} onChange={()=>toggleReportSelection(report.id)} className="h-3.5 w-3.5 accent-violet-600"/></td><td className="px-3"><button onClick={()=>setSelectedId(report.id)} className="font-medium text-violet-600 hover:underline">{report.id}</button></td><td className="px-3 text-slate-600">{report.type}</td><td className="px-3 text-slate-600">{report.created}</td><td className="whitespace-normal break-words px-3 py-2 leading-5 text-slate-600" title={report.sender}>{report.sender}</td></tr>)}{!pagedReports.length&&<tr><td colSpan="5" className="h-32 text-center text-sm text-slate-400">暂无符合条件的报告</td></tr>}</tbody>
            </table>
          </div>
          <footer className="flex min-h-[48px] items-center justify-between border-t border-slate-100 px-5 text-xs text-slate-400"><span>共 {filtered.length} 笔，第 {reportPage}/{reportPageCount} 页</span><div className="flex items-center gap-1"><button aria-label="报告上一页" disabled={reportPage===1} onClick={()=>setReportPage(page=>Math.max(1,page-1))} className="grid h-8 w-8 place-items-center rounded border border-slate-200 disabled:opacity-40"><span className="rotate-180"><Icon name="chevron" size={14}/></span></button>{Array.from({length:reportPageCount},(_,index)=>index+1).map(page=><button key={page} onClick={()=>setReportPage(page)} className={`h-8 min-w-8 rounded border px-2 ${reportPage===page?'border-violet-600 bg-violet-600 text-white':'border-slate-200 text-slate-600'}`}>{page}</button>)}<button aria-label="报告下一页" disabled={reportPage===reportPageCount} onClick={()=>setReportPage(page=>Math.min(reportPageCount,page+1))} className="grid h-8 w-8 place-items-center rounded border border-slate-200 disabled:opacity-40"><Icon name="chevron" size={14}/></button></div></footer>
        </section>

        {selected&&<section data-testid="report-preview-panel" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50 shadow-card"><div className="border-b border-slate-100 bg-white px-5 py-3"><h2 className="text-sm font-semibold text-slate-800">报告预览</h2><p className="mt-1 text-[11px] text-slate-400">{selected.name}</p></div><div className="max-h-[680px] overflow-y-auto p-5"><div data-testid="report-preview-meta" className="mb-4 grid grid-cols-4 gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-[10px]"><div><span className="block text-slate-400">报告编号</span><b className="mt-1 block truncate text-slate-700">{selected.id}</b></div><div><span className="block text-slate-400">统计周期</span><b className="mt-1 block truncate text-slate-700">{selected.period}</b></div><div><span className="block text-slate-400">统计机构</span><b className="mt-1 block truncate text-slate-700">{selected.sender}</b></div><div><span className="block text-slate-400">报告生成时间</span><b className="mt-1 block truncate text-slate-700">{selected.created}</b></div></div>{selected.type==='日报'?<DailyPreview report={selected}/>:selected.type==='周报'?<WeeklyPreview report={selected}/>:selected.type==='月报'?<MonthlyPreview report={selected}/>:<LongCyclePreview report={selected}/>}</div></section>}
        </div>

        {showConfig&&<div className="fixed inset-0 z-40 bg-slate-900/20" onClick={()=>setShowConfig(false)}><aside data-testid="report-config-drawer" className="absolute bottom-0 right-0 top-16 flex w-[760px] flex-col bg-white shadow-2xl" onClick={event=>event.stopPropagation()}><header className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600"><Icon name="file" size={17}/></span><h2 className="text-lg font-semibold text-slate-900">生成规则配置</h2></div><p className="mt-2 text-xs text-slate-400">配置报告模板、生成周期、统计内容和交付方式</p></div><button aria-label="关闭报告配置" onClick={()=>setShowConfig(false)} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-50"><Icon name="close" size={18}/></button></header><div className="flex-1 overflow-y-auto px-6 py-5"><section><div className="mb-3 text-xs font-semibold text-slate-700">1. 报告类型与模板</div><div className="grid grid-cols-5 gap-2">{Object.keys(configPresets).map(type=><button key={type} onClick={()=>setConfig({...configPresets[type]})} className={`rounded-lg border p-3 text-left ${config.type===type?'border-violet-400 bg-violet-50 ring-1 ring-violet-100':'border-slate-200 hover:border-violet-200'}`}><div className={`text-sm font-semibold ${config.type===type?'text-violet-700':'text-slate-700'}`}>{type}</div><div className="mt-1 truncate text-[10px] text-slate-400">{configPresets[type].template}</div></button>)}</div><div className="mt-4 grid grid-cols-2 gap-4"><label><span className="mb-2 block text-xs text-slate-500">报告名称</span><input value={config.name} onChange={e=>setConfig({...config,name:e.target.value})} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-violet-400"/></label><label><span className="mb-2 block text-xs text-slate-500">报告模板</span><div className="flex h-10 items-center justify-between rounded-md border border-slate-200 px-3 text-sm text-slate-600"><span className="truncate">{config.template}</span><button className="ml-2 shrink-0 text-xs text-violet-600">更换模板</button></div></label></div></section><section className="mt-6 border-t border-slate-100 pt-5"><div className="mb-3 text-xs font-semibold text-slate-700">2. 定期生成规则</div><div className="grid grid-cols-3 gap-4">{config.type==='日报'?<label><span className="mb-2 block text-xs text-slate-500">生成周期</span><input value="每日" disabled className="xib-disabled-field h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400"/></label>:<label><span className="mb-2 block text-xs text-slate-500">生成周期</span><select value={config.frequency} onChange={e=>setConfig({...config,frequency:e.target.value})} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"><option>每日</option><option>每周一</option><option>每月3日</option><option>每季度首月3日</option><option>每年1月3日</option></select></label>}<div><span className="mb-2 block text-xs text-slate-500">生成时间</span><XibTimePicker value={(config.executeTime||'08:00').replace('次日 ','')} onChange={value=>setConfig({...config,executeTime:value})} ariaLabel="选择报告生成时间"/></div><label><span className="mb-2 block text-xs text-slate-500">统计周期</span><select value={config.period} onChange={e=>setConfig({...config,period:e.target.value})} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"><option>上一自然日</option><option>上一自然周</option><option>上一自然月</option><option>上一自然季度</option><option>上一自然年度</option></select></label></div><label className="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-4 py-3"><span><b className="block text-xs font-medium text-slate-700">启用定期生成</b><small className="mt-1 block text-[11px] text-slate-400">关闭后不再按计划生成，但保留历史报告</small></span><button onClick={()=>setConfig({...config,enabled:!config.enabled})} className={`relative h-6 w-11 rounded-full transition ${config.enabled?'bg-violet-600':'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${config.enabled?'left-6':'left-1'}`}/></button></label></section><section className="mt-6 border-t border-slate-100 pt-5"><div className="mb-1 text-xs font-semibold text-slate-700">3. 统计内容</div><p className="mb-3 text-[11px] text-slate-400">系统按选定维度汇总指标，并写入对应模板正文和附表</p><div className="text-xs text-slate-500">分析维度</div><div className="mt-2 flex flex-wrap gap-2">{['投诉来源','监管来源','自收渠道','机构','投诉次数','投诉类型','业务类型','产品','投诉事项','投诉渠道'].map(item=><button key={item} onClick={()=>toggleConfigItem('dimensions',item)} className={`rounded-full border px-3 py-1.5 text-xs ${config.dimensions.includes(item)?'border-violet-300 bg-violet-50 text-violet-700':'border-slate-200 text-slate-400'}`}>{config.dimensions.includes(item)?'✓ ':''}{item}</button>)}</div><div className="mt-4 text-xs text-slate-500">核心指标</div><div className="mt-2 flex flex-wrap gap-2">{['投诉量','占比','首次投诉量','重复投诉量','上期投诉量','环比','去年同期投诉量','同比'].map(item=><button key={item} onClick={()=>toggleConfigItem('metrics',item)} className={`rounded-full border px-3 py-1.5 text-xs ${config.metrics.includes(item)?'border-violet-300 bg-violet-50 text-violet-700':'border-slate-200 text-slate-400'}`}>{config.metrics.includes(item)?'✓ ':''}{item}</button>)}</div></section><section className="mt-6 border-t border-slate-100 pt-5"><div className="mb-3 text-xs font-semibold text-slate-700">4. 交付方式</div>{['日报','周报'].includes(config.type)?<div><label><span className="mb-2 block text-xs text-slate-500">邮件接收对象</span><textarea value={config.receivers} onChange={e=>setConfig({...config,receivers:e.target.value})} rows="2" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-violet-400"/></label><div className="mt-3 rounded-md border border-violet-100 bg-violet-50 px-4 py-3 text-[11px] leading-5 text-violet-700"><b>自动生成并邮件推送：</b>报告生成成功后直接发送至配置邮箱，无需人工确认。</div></div>:<div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-600"><b className="text-slate-700">仅生成并导出</b><br/>月报、季报、年报不配置接收对象，不进行邮件或协同办公推送；可按周期自动生成，也可人工触发后导出。</div>}</section></div><footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4"><div className="text-[11px] text-slate-400">保存后，新生成的报告将使用最新配置；历史报告不受影响。</div><div className="flex gap-2"><button onClick={()=>setShowConfig(false)} className="rounded-md border border-slate-200 px-5 py-2 text-xs text-slate-500">取消</button><button onClick={saveConfig} className="rounded-md bg-violet-600 px-5 py-2 text-xs font-medium text-white">保存配置</button></div></footer></aside></div>}

        {notice&&<div className="fixed bottom-8 right-8 z-50 rounded-lg bg-slate-900 px-4 py-3 text-xs text-white shadow-xl"><span className="mr-2 text-emerald-400">✓</span>{notice}</div>}
      </div>;
    }

    // 信访统计分析：仅使用《信访单字段表》中已明确的字段和枚举值。
    function PetitionAnalysisPage({onOpenTicket}) {
      const [relatedView,setRelatedView]=useState('机构');
      const [relatedPage,setRelatedPage]=useState(1);
      const [selectedOrg,setSelectedOrg]=useState('全行');
      const [startDate,setStartDate]=useState('2026-07-01');
      const [endDate,setEndDate]=useState('2026-07-15');
      const [linkedFilter,setLinkedFilter]=useState(DEFAULT_LINKED_FILTER);
      // 信访页不提供投诉渠道、投诉口径和剔除规则，三者也不参与下方指标联动。
      const petitionFilter={...linkedFilter,channel:'全部渠道',caliber:'全部受理',excluded:[]};
      const filterFactor=linkedAnalysisFactor(petitionFilter,startDate,endDate,selectedOrg);
      const selectedLineSummary=linkedFilter.lineSelection?.length===BUSINESS_LINE_OPTIONS.length?'全部条线':linkedFilter.lineSelection?.length===1?linkedFilter.lineSelection[0]:`已选 ${linkedFilter.lineSelection?.length||0} 条条线`;
      const filterSummary='';
      const compareChange=linkedFilter.compare==='环比'?'+7.4%':'+16.8%';
      const summary = [
        {label:'信访事项总量',value:scaleLinkedCount(386,filterFactor).toLocaleString(),unit:'件',note:`按工单编号去重 · ${linkedFilter.compare} ${compareChange}`,icon:'file',tone:'violet'},
        {label:'当前处理中',value:scaleLinkedCount(42,filterFactor).toLocaleString(),unit:'件',note:`工单状态为处理中 · ${linkedFilter.compare} ${linkedFilter.compare==='环比'?'+4.2%':'+9.6%'}`,icon:'inbox',tone:'indigo'},
        {label:'超期信访量',value:scaleLinkedCount(6,filterFactor).toLocaleString(),unit:'件',note:`“是否超期＝是” · ${linkedFilter.compare} ${linkedFilter.compare==='环比'?'-2.1%':'+3.4%'}`,icon:'alert',tone:'rose'},
        {label:'要求整改事项',value:scaleLinkedCount(18,filterFactor).toLocaleString(),unit:'件',note:`“是否要求整改＝是” · ${linkedFilter.compare} ${linkedFilter.compare==='环比'?'+5.8%':'+11.2%'}`,icon:'check',tone:'emerald'}
      ];
      const scaleRows=rows=>rows.map(row=>[row[0],scaleLinkedCount(row[1],filterFactor),row[2]]);
      const makeDistribution=(names,start,step)=>{
        const rows=names.map((name,index)=>[name,Math.max(12,start-index*step)]);
        const total=Math.max(1,rows.reduce((sum,row)=>sum+row[1],0));
        return scaleRows(rows.map(row=>[row[0],row[1],Number((row[1]/total*100).toFixed(1))]));
      };
      const sources = scaleRows([['厦门金管局',146,37.8],['属地金管局',128,33.2],['纪检',62,16.1],['其它',50,12.9]]);
      const matters = scaleRows([['贷款催收',82,21.2],['贷款协商还款',68,17.6],['贷款业务办理',55,14.2],['个人征信',43,11.1],['账户管控',36,9.3],['其它事项',102,26.4]]);
      const businessTypes = scaleRows([['合作类贷款',154,39.9],['非合作类贷款',98,25.4],['存款',54,14.0],['代理销售',38,9.8],['其它',42,10.9]]);
      const lines = scaleRows([['零售金融部',112,29.0],['普惠金融部',86,22.3],['公司金融部',58,15.0],['运营管理部',46,11.9],['风险管理部',34,8.8],['特殊资产经营部',28,7.3],['消费者权益保护部',22,5.7]]);
      const productNames=['度小满','京东','乐信','美团','数禾','字节跳动','拍拍贷','维信金科','小米','马上消费','360借条','新网银行','网商贷','E车贷','花呗','兴安贷+','好康贷','梦想贷','兴安花','个人经营贷','个人按揭住房贷款','税享贷','欢欣贷','公司贷款','公司担保承诺','公司贸易融资','个人保证金存款','个人大额存单','个人定期存款','个人活期存款','个人结构性存款','个人通知存款','公司保证金存款','公司大额存单','公司定期存款','公司活期存款','公司结构性存款','公司通知存款','公司协议存款','个人代销贵金属','个人代销理财','个人代销保险','个人代销基金','个人代销信托','公司代销理财','个人账户（银行卡）','公司账户','现金服务','汇兑','商业承兑汇票','代客外汇','个人网银','个人电话银行','个人手机银行','个人微信银行（微信公众号）','企业网银','企业手机银行','花一厦 微信小程序','兴安贷+微信小程序','兴安贷+抖音小程序','厦门国际银行云闪付小程序','厦门国际银行支付宝小程序','积分商城'];
      const channelNames=['厦门金管局','福建金管局','珠海金管局','北京金管局','上海金管局','宁德金管局','龙岩金管局','泉州金管局','漳州金管局','莆田金管局','三明金管局','南平金管局','纪检','其它'];
      const petitionLineCounts={'零售金融部':112,'普惠金融部':86,'公司金融部':58,'运营管理部':46,'风险管理部':34,'特殊资产经营部':28,'消费者权益保护部':22};
      const allPetitionLineRows=BUSINESS_LINE_OPTIONS.map((name,index)=>[name,petitionLineCounts[name]||Math.max(8,20-index)]);
      const selectedPetitionLineSet=new Set(linkedFilter.lineSelection?.length?linkedFilter.lineSelection:BUSINESS_LINE_OPTIONS);
      const scopedPetitionLineRows=allPetitionLineRows.filter(row=>selectedPetitionLineSet.has(row[0])).sort((left,right)=>right[1]-left[1]);
      const scopedPetitionLineTotal=Math.max(1,scopedPetitionLineRows.reduce((sum,row)=>sum+row[1],0));
      const relatedLines=scaleRows(scopedPetitionLineRows.slice(0,5).map(row=>[row[0],row[1],Number((row[1]/scopedPetitionLineTotal*100).toFixed(1))]));
      const relatedDistributions={
        '机构':scaleRows([['厦门分行',96,24.9],['福州分行',78,20.2],['上海分行',64,16.6],['珠海分行',58,15.0],['北京分行',46,11.9]]),
        '产品':makeDistribution(productNames,720,10),
        '原因':matters.slice(0,5),
        '渠道':makeDistribution(channelNames,286,14),
        '条线':relatedLines,
        '客户':scaleRows([['30—39岁',98,25.5],['40—49岁',88,22.9],['50—59岁',66,17.2],['18—29岁',57,14.7],['60岁及以上',51,13.2],['18岁以下',19,4.8],['未知',7,1.7]])
      };
      const relatedPageSize=10;
      const relatedRowsAll=relatedDistributions[relatedView];
      const relatedPageCount=Math.max(1,Math.ceil(relatedRowsAll.length/relatedPageSize));
      const paginatesRelatedView=['产品','渠道'].includes(relatedView);
      const relatedRows=paginatesRelatedView?relatedRowsAll.slice((relatedPage-1)*relatedPageSize,relatedPage*relatedPageSize):relatedRowsAll;
      React.useEffect(()=>setRelatedPage(1),[relatedView,linkedFilter.lineSelection?.join('|')]);
      // 关联分布仅用于查看；明细表只继承查询栏条件，避免多视角交叉筛选造成口径叠加。
      const petitionDetails=Array.from({length:10},(_,index)=>{
        const pick=items=>items[index%items.length][0];
        return {
          id:`XF202607${String(2401+index).padStart(4,'0')}`,
          date:`2026-07-${String(15-index).padStart(2,'0')}`,
          institution:pick(relatedDistributions.机构),
          product:pick(relatedDistributions.产品),
          reason:pick(relatedDistributions.原因),
          channel:pick(relatedDistributions.渠道),
          line:pick(relatedDistributions.条线),
          customer:pick(relatedDistributions.客户),
          status:['处理中','已办结','待处理','处理中','已办结'][index%5],
          overdue:index%6===0?'是':'否'
        };
      }).filter(row=>row.date>=startDate&&row.date<=endDate&&(selectedOrg==='全行'||row.institution===selectedOrg)).slice(0,Math.ceil(10*Math.min(1,filterFactor)));
      const petitionDetailSelection=useSelectableRows(petitionDetails,row=>row.id);
      const exportPetitionDetails=()=>downloadCsv(`信访统计关联明细_${startDate}_${endDate}.csv`,['信访工单编号','客户信访时间','信访机构','关联产品','信访原因','受理渠道','所属条线','客户类型','处理状态','是否超期'],petitionDetailSelection.selectedRows.map(row=>[row.id,row.date,row.institution,row.product,row.reason,row.channel,row.line,row.customer,row.status,row.overdue]));
      const panels=[
        ['受理渠道分布','信访事项主要由哪个渠道转送？',sources,'受理渠道'],
        ['信访事项分布','客户主要针对哪些事项信访？',matters,'信访事项'],
        ['业务类型分布','信访问题主要集中在哪类业务？',businessTypes,'业务类型'],
        ['所属业务部门/条线分布','哪些业务部门需要重点关注？',lines,'所属业务部门/条线']
      ];
      const pageInfo={title:'信访统计分析',question:'当前信访规模、处理风险和问题集中度如何？',caliber:'按客户信访时间纳入统计期，按工单编号去重；关联分布分别按机构、产品、信访原因、渠道、所属业务条线及客户类型汇总。',value:'快速识别超期、整改压力和高发信访问题，并定位需要优先介入的机构、产品、条线及客户群体。',source:'信访单字段表：工单编号、客户信访时间、信访机构、产品、信访事项/原因、受理渠道、所属业务部门/条线、客户类型、工单状态、是否超期、是否要求整改。'};
      return <div className="mx-auto max-w-[1540px] px-6 py-5">
        <nav className="mb-4 flex items-center gap-2 text-xs text-slate-400"><span>首页</span><span>/</span><span className="text-slate-600">信访统计分析</span></nav>
        <section className="mb-4 flex items-end justify-between"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-900">信访统计分析</h1><CompactInfoPopover info={pageInfo} ariaLabel="查看信访统计分析说明"/></div></div><div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500"/>数据更新时间：2026-07-15 12:00</div></section>
        <ComplaintAnalysisFilters pageKey="petition" hideChannel hideCaliber hideExclusions startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onOrgChange={org=>setSelectedOrg(org.startsWith('全行')?'全行':org)} onFilterChange={changes=>setLinkedFilter(prev=>({...prev,...changes,channel:'全部渠道',caliber:'全部受理',excluded:[]}))} onQuery={({org,orgSelection,lineSelection,compare,organizationDimension,organizationField})=>{setSelectedOrg(org.startsWith('全行')?'全行':org);setLinkedFilter({channel:'全部渠道',caliber:'全部受理',compare,organizationDimension,organizationField,excluded:[],orgSelection,lineSelection})}}/>
        <section data-testid="petition-summary" className="mb-4 grid grid-cols-4 gap-4">{summary.map(item=><article key={item.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{item.label}</span><span className={`grid h-8 w-8 place-items-center rounded-lg ${item.tone==='rose'?'bg-rose-50 text-rose-600':item.tone==='emerald'?'bg-emerald-50 text-emerald-600':item.tone==='indigo'?'bg-indigo-50 text-indigo-600':'bg-violet-50 text-violet-600'}`}><Icon name={item.icon} size={17}/></span></div><div className="mt-3 text-3xl font-semibold text-slate-900">{item.value}<span className="ml-1 text-xs font-normal text-slate-400">{item.unit}</span></div><p className="mt-2 text-[11px] text-slate-400">{item.note}</p></article>)}</section>
        <section className="rounded-lg border border-slate-200 bg-white shadow-card">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-base font-semibold text-slate-800">信访关联分布</h2><p className="mt-1 text-xs text-slate-400">从机构、产品、原因、渠道、条线和客户六个视角定位信访集中对象 · 机构字段：{linkedFilter.organizationField||'工单接收机构'} · {linkedFilter.compare} {compareChange}</p></div><div className="flex rounded-md bg-slate-100 p-1">{Object.keys(relatedDistributions).map(view=><button key={view} onClick={()=>setRelatedView(view)} className={`rounded px-4 py-1.5 text-xs transition ${relatedView===view?'bg-white font-medium text-violet-600 shadow-sm':'text-slate-500'}`}>{view}</button>)}</div></div>
          <div className="space-y-2.5 p-5"><div className="grid items-center gap-4 px-3 text-[11px] text-slate-400" style={{gridTemplateColumns:'28px 220px minmax(0,1fr) 70px 60px'}}><span/><span>名称</span><span/><span className="text-right">投诉量</span><span className="text-right">占比</span></div><div data-testid="petition-related-ranking">{relatedRows.map(([name,value,share],index)=>{const rank=(paginatesRelatedView?(relatedPage-1)*relatedPageSize:0)+index+1;return <div key={`${name}-${rank}`} className="grid w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left" style={{gridTemplateColumns:'28px 220px minmax(0,1fr) 70px 60px'}}><span className={`grid h-6 w-6 place-items-center rounded text-[10px] ${rank<=3?'bg-[#2272DE] text-white':'bg-slate-100 text-slate-500'}`}>{rank}</span><span className="truncate text-xs font-medium text-slate-700" title={name}>{name}</span><span className="h-6 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded bg-violet-500" style={{width:`${Math.min(100,share*2.5)}%`,minWidth:value?'12px':'0'}}/></span><span className="text-right text-xs text-slate-500">{value}件</span><span className="text-right text-xs text-slate-500">{share}%</span></div>})}{paginatesRelatedView&&<div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-[11px] text-slate-400">共 {relatedRowsAll.length} 项，每页 {relatedPageSize} 项</span><div data-testid="petition-related-pagination" className="flex items-center gap-1"><button type="button" aria-label="信访关联分布上一页" disabled={relatedPage===1} onClick={()=>setRelatedPage(page=>Math.max(1,page-1))} className="grid h-8 w-8 place-items-center rounded border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"><span className="rotate-180"><Icon name="chevron" size={14}/></span></button>{Array.from({length:relatedPageCount},(_,index)=>index+1).map(page=><button type="button" key={page} aria-label={`信访关联分布第${page}页`} onClick={()=>setRelatedPage(page)} className={`h-8 min-w-8 rounded border px-2 text-xs ${relatedPage===page?'border-violet-600 bg-violet-600 text-white':'border-slate-200 text-slate-600 hover:border-violet-300'}`}>{page}</button>)}<button type="button" aria-label="信访关联分布下一页" disabled={relatedPage===relatedPageCount} onClick={()=>setRelatedPage(page=>Math.min(relatedPageCount,page+1))} className="grid h-8 w-8 place-items-center rounded border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="chevron" size={14}/></button></div></div>}</div></div>
        </section>
        <section id="petition-detail-table" className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-700">关联信访明细</h3><p className="mt-0.5 text-[11px] text-slate-400"><span className="mt-0.5 block">明细仅随日期、机构范围和条线范围联动；信访关联分布各视角 Top5 仅供查看</span></p></div><div className="flex items-center gap-2"><button type="button" data-testid="petition-detail-reset" onClick={()=>setRelatedView('机构')} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50">重置交叉筛选</button><button type="button" data-testid="petition-detail-export" disabled={!petitionDetailSelection.selectedRows.length} onClick={exportPetitionDetails} className="rounded-md border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40">导出明细</button><CompactInfoPopover info={{title:'关联信访明细',question:'哪些单笔信访构成当前统计结果？',caliber:'明细仅继承查询栏中的日期、机构范围和条线范围，关联分布各视角 Top5 不参与筛选，按信访工单编号去重。',value:'核验信访分析结论并追溯单笔事项。',source:'信访工单编号、客户信访时间、信访机构、关联产品、信访原因、受理渠道、所属条线、客户类型、处理状态、是否超期。'}} ariaLabel="查看关联信访明细说明"/></div></div>
          <div data-testid="petition-detail-filters" className="m-5 mb-4 flex flex-wrap gap-2 rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-xs"><span className="rounded-full bg-violet-600 px-3 py-1 text-white">统计机构：{selectedOrg}</span><span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">条线范围：{selectedLineSummary}</span></div>
          <div className="overflow-x-auto"><table data-testid="petition-detail-table" className="min-w-[1480px] w-full table-fixed text-left text-xs"><colgroup>{[250,140,140,140,140,140,140,140,140,140].map((width,index)=><col key={index} style={{width}}/>)}</colgroup><thead className="bg-slate-50 text-slate-500"><tr><th className="whitespace-nowrap px-5 py-3 font-medium"><SelectableHeader label="信访工单编号" selection={petitionDetailSelection} testId="petition-detail-select-all"/></th>{['客户信访时间','信访机构','产品二级标签','信访原因标签','受理渠道','所属业务条线','客户类型','处理状态','是否超期'].map(header=><th key={header} className="whitespace-nowrap px-5 py-3 font-medium">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{petitionDetails.map(row=><tr data-testid="petition-detail-row" key={row.id} className="hover:bg-violet-50/40"><td className="px-5 py-3"><SelectableIdCell id={row.id} selection={petitionDetailSelection} testId="petition-detail-select" onOpen={onOpenTicket}/></td><td className="px-5 py-3 text-slate-500">{row.date}</td><td className="px-5 py-3">{row.institution}</td><td className="px-5 py-3">{row.product}</td><td className="px-5 py-3">{row.reason}</td><td className="px-5 py-3">{row.channel}</td><td className="px-5 py-3">{row.line}</td><td className="px-5 py-3">{row.customer}</td><td className="px-5 py-3"><span className={`rounded px-2 py-1 ${row.status==='已办结'?'bg-emerald-50 text-emerald-600':row.status==='处理中'?'bg-violet-50 text-violet-600':'bg-amber-50 text-amber-700'}`}>{row.status}</span></td><td className={`px-5 py-3 ${row.overdue==='是'?'font-medium text-rose-600':'text-slate-500'}`}>{row.overdue}</td></tr>)}{petitionDetails.length===0&&<tr><td colSpan="10" className="px-5 py-10 text-center text-slate-400">当前查询条件下暂无匹配信访数据，请调整筛选条件</td></tr>}</tbody></table></div>
        </section>
        <div className="mt-4 rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-5 py-4 text-xs leading-6 text-slate-500"><span className="font-semibold text-violet-700">数据说明：</span>页面仅使用《信访单字段表》已明确的字段。“按期办结率”因当前未明确独立办结时间字段，暂不展示；如后续确认以处置员反馈时间作为办结时间，再补充该指标。</div>
      </div>;
    }

    function syncEmbeddedWorkOrderStatus() {
      if (!getStatisticsRoot()) return;
      const aliases = {'待反馈':'待审批','待分派':'待处理'};
      const statusClass = {
        '草稿':'xib-status-draft',
        '待处理':'xib-status-pending',
        '处理中':'xib-status-processing',
        '待审批':'xib-status-approval',
        '审批中':'xib-status-approval',
        '已办结':'xib-status-success',
        '已撤销':'xib-status-draft',
        '已废止':'xib-status-draft',
        '已驳回':'xib-status-danger'
      };
      const statusClasses = ['xib-status-draft','xib-status-pending','xib-status-processing','xib-status-approval','xib-status-success','xib-status-danger'];
      const applyStatus = (node, normalized) => {
        if (!node || !statusClass[normalized]) return;
        if (node.tagName === 'TD') {
          const existing = node.querySelector(':scope > .xib-work-status');
          if (existing && existing.getAttribute('data-flow-status') === normalized && existing.classList.contains(statusClass[normalized])) return;
          const tag = existing || document.createElement('span');
          tag.textContent = normalized;
          tag.classList.remove(...statusClasses);
          tag.classList.add('tag','ds-tag','is-light','xib-work-status',statusClass[normalized]);
          tag.setAttribute('data-flow-status', normalized);
          if (!existing) {
            node.textContent = '';
            node.appendChild(tag);
          }
          return;
        }
        if (node.getAttribute('data-flow-status') === normalized && node.classList.contains(statusClass[normalized])) return;
        node.textContent = normalized;
        node.classList.remove(...statusClasses);
        node.classList.add('tag','ds-tag','is-light','xib-work-status',statusClass[normalized]);
        node.setAttribute('data-flow-status', normalized);
      };
      getStatisticsRoot()?.querySelectorAll('td, span').forEach(node => {
        const raw = (node.textContent || '').trim();
        const normalized = aliases[raw] || raw;
        if (!statusClass[normalized]) return;
        applyStatus(node, normalized);
      });
      const root = getStatisticsRoot();
      if (!root) return;
      const legacyOrderTerm = '事件' + '单';
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || /^(SCRIPT|STYLE)$/.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return node.nodeValue.includes(legacyOrderTerm) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(node => { node.nodeValue = node.nodeValue.replace(new RegExp(legacyOrderTerm, 'g'), '工单'); });
    }
    function statisticsRouteToPage(route) {
      return route === 'home' || route === 'executive' ? 'home' : route === 'reports' ? 'reports' : route === 'petition' ? 'petition' : route === 'institution' || route === 'institution2' ? 'institution2' : route === 'product' ? 'product' : route === 'reason' ? 'reason' : route === 'channel' ? 'channel' : route === 'line' ? 'line' : route === 'customer' ? 'customer' : route === 'overview' ? 'overview' : route === 'overview2' ? 'overview2' : 'production';
    }

    function App({ route = 'production', onRouteChange, onOpenTicket }) {
      const [pageKey, setPageKey] = useState(() => statisticsRouteToPage(route)); const [lineQuery,setLineQuery]=useState(null);
      const [viewKey, setViewKey] = useState('headOffice');
      const [selectedMetric, setSelectedMetric] = useState(null);
      const [detailMetric, setDetailMetric] = useState(null);
      React.useEffect(() => {
        setPageKey(statisticsRouteToPage(route)); if(statisticsRouteToPage(route)!=='line')setLineQuery(null);
        setSelectedMetric(null);
        setDetailMetric(null);
      }, [route]);

      const view = useMemo(() => VIEW_DATA[viewKey], [viewKey]);
      const regulatory = useMemo(() => REGULATORY_DATA[viewKey], [viewKey]);
      const switchPage = (key,query=null) => { if(key==='line')setLineQuery(query);
        const target = key === 'executive' ? 'home' : key;
        const route = target === 'home' ? 'home' : target === 'reports' ? 'reports' : target === 'petition' ? 'petition' : target === 'institution2' ? 'institution2' : target === 'product' ? 'product' : target === 'reason' ? 'reason' : target === 'channel' ? 'channel' : target === 'line' ? 'line' : target === 'customer' ? 'customer' : target === 'overview2' ? 'overview2' : target === 'production' ? 'production' : '';
        setPageKey(target);
        if (route && typeof onRouteChange === 'function') onRouteChange(route);
      };

      return (
        <div className="min-h-screen">
          {/* 顶部栏：沿用厦门国际PC端主色与紧凑企业布局。 */}
          <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white px-5 shadow-sm">
            <div className="flex w-[218px] items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-xib-500 text-[11px] font-bold tracking-wide text-white shadow-sm">XIB</div>
              <div>
                <div className="text-sm font-semibold tracking-wide text-slate-900">厦门国际银行</div>
                <div className="text-[10px] tracking-[.12em] text-slate-400">消费者权益保护管理系统</div>
              </div>
            </div>
            <div className="ml-6 h-5 w-px bg-slate-200" />
            <div className="ml-5 text-sm font-medium text-slate-600">{pageKey==='home'?'首页':pageKey==='reports'?'报告中心':pageKey==='petition'?'信访统计分析':'投诉统计分析'}</div>
            <div className="ml-auto flex items-center gap-3">
              {pageKey !== 'home' && pageKey !== 'executive' && pageKey !== 'reports' && pageKey !== 'production' && pageKey !== 'institution2' && pageKey !== 'product' && pageKey !== 'reason' && pageKey !== 'channel' && pageKey !== 'line' && pageKey !== 'customer' && <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-600">演示数据</span>}
              <button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="消息通知">
                <Icon name="bell" size={20} />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
              </button>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-xib-50 text-xib-500"><Icon name="user" size={17} /></div>
                <div className="text-xs">
                  <div className="font-medium text-slate-700">总行消保管理员</div>
                  <div className="text-slate-400">消费者权益保护部</div>
                </div>
              </div>
            </div>
          </header>

          {/* 左侧导航：当前仅高亮统计分析模块，其余入口用于还原系统环境。 */}
          <aside className="fixed bottom-0 left-0 top-16 z-20 w-56 overflow-y-auto bg-xib-900 py-4 shadow-lg">
            <div className="px-5 pb-3 text-[11px] font-medium tracking-wider text-slate-500">工作台</div>
            <SidebarItem icon="home" label="首页" active={pageKey==='home'} onClick={()=>switchPage('home')} />
            <SidebarItem icon="file" label="事件管理" children />
            <SidebarItem icon="chart" label="投诉统计分析" active={pageKey!=='home'&&pageKey!=='reports'&&pageKey!=='petition'} />
            <div className="mx-5 mb-3 ml-9 border-l border-white/10 pl-3">
              <button data-page-key="production" onClick={() => switchPage('production')} className={`block w-full rounded px-3 py-2 text-left text-xs transition ${pageKey === 'production' ? 'bg-violet-500/25 font-medium text-violet-100 ring-1 ring-violet-400/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>投诉总览</button>
              <button data-page-key="institution2" onClick={() => switchPage('institution2')} className={`mt-1 block w-full rounded px-3 py-2 text-left text-xs transition ${pageKey === 'institution2' ? 'bg-violet-500/25 font-medium text-violet-100 ring-1 ring-violet-400/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>机构分析</button>
              <button data-page-key="product" onClick={() => switchPage('product')} className={`mt-1 block w-full rounded px-3 py-2 text-left text-xs transition ${pageKey === 'product' ? 'bg-violet-500/25 font-medium text-violet-100 ring-1 ring-violet-400/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>产品分析</button>
              <button data-page-key="reason" onClick={() => switchPage('reason')} className={`mt-1 block w-full rounded px-3 py-2 text-left text-xs transition ${pageKey === 'reason' ? 'bg-violet-500/25 font-medium text-violet-100 ring-1 ring-violet-400/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>原因分析</button>
              <button data-page-key="channel" onClick={() => switchPage('channel')} className={`mt-1 block w-full rounded px-3 py-2 text-left text-xs transition ${pageKey === 'channel' ? 'bg-violet-500/25 font-medium text-violet-100 ring-1 ring-violet-400/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>渠道分析</button>
              <button data-page-key="line" onClick={() => switchPage('line')} className={`mt-1 block w-full rounded px-3 py-2 text-left text-xs transition ${pageKey === 'line' ? 'bg-violet-500/25 font-medium text-violet-100 ring-1 ring-violet-400/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>条线分析</button>
              <button data-page-key="customer" onClick={() => switchPage('customer')} className={`mt-1 block w-full rounded px-3 py-2 text-left text-xs transition ${pageKey === 'customer' ? 'bg-violet-500/25 font-medium text-violet-100 ring-1 ring-violet-400/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>客户分析</button>
            </div>
            <SidebarItem icon="file" label="信访统计分析" active={pageKey==='petition'} onClick={()=>switchPage('petition')} />
            <div className="mx-5 my-4 h-px bg-white/10" />
            <div className="px-5 pb-3 text-[11px] font-medium tracking-wider text-slate-500">运营管理</div>
            <SidebarItem icon="file" label="报告中心" active={pageKey==='reports'} onClick={()=>switchPage('reports')} />
            <SidebarItem icon="building" label="标签与口径管理" />
          </aside>

          <main className="ml-56 pt-16">
            {pageKey === 'home' ? (
              <ExecutiveDashboardPage onNavigate={switchPage} />
            ) : pageKey === 'reports' ? (
              <ReportCenterPage />
            ) : pageKey === 'petition' ? (
              <PetitionAnalysisPage onOpenTicket={onOpenTicket}/>
            ) : pageKey === 'institution2' ? (
              <InstitutionAnalysis2Page viewKey={viewKey} setViewKey={setViewKey} />
            ) : pageKey === 'product' ? (
              <ProductAnalysisPage onOpenTicket={onOpenTicket}/>
            ) : pageKey === 'reason' ? (
              <ReasonAnalysisPage onOpenTicket={onOpenTicket}/>
            ) : pageKey === 'channel' ? (
              <ChannelAnalysisPage onOpenTicket={onOpenTicket}/>
            ) : pageKey === 'line' ? (
              <LineAnalysisPage initialQuery={lineQuery} onOpenTicket={onOpenTicket}/>
            ) : pageKey === 'customer' ? (
              <CustomerAnalysisPage onOpenTicket={onOpenTicket}/>
            ) : pageKey === 'overview2' ? (
              <Overview2Page viewKey={viewKey} setViewKey={setViewKey} />
            ) : pageKey === 'production' ? (
              <ProductionOverviewPage onNavigate={switchPage} />
            ) : (
              <div className="mx-auto max-w-[1540px] px-6 py-5">
              <nav className="mb-4 flex items-center gap-2 text-xs text-slate-400">
                <span>首页</span><span>/</span><span>投诉统计分析</span><span>/</span><span className="text-slate-600">投诉总览</span>
              </nav>

              <section className="mb-4 flex items-end justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">投诉总览</h1>
                    <span className="rounded border border-xib-100 bg-xib-50 px-2 py-0.5 text-xs font-medium text-xib-500">数据展示层</span>
                  </div>

                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> 数据更新时间：2026-07-15 12:00
                </div>
              </section>

              <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="mb-2 text-xs font-medium text-slate-500">管理视角</div>
                    <div className="flex rounded-md bg-slate-100 p-1">
                      {Object.values(VIEW_DATA).map(item => (
                        <button key={item.key} onClick={() => setViewKey(item.key)} className={`rounded px-4 py-2 text-sm font-medium transition ${viewKey === item.key ? 'bg-white text-xib-500 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-slate-200" />
                  <label className="min-w-[210px]">
                    <div className="mb-2 text-xs font-medium text-slate-500">当前机构</div>
                    <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                      <span className="flex items-center gap-2"><Icon name="building" size={16} className="text-xib-500" />{view.organization}</span>
                      <span className="text-slate-400">⌄</span>
                    </div>
                  </label>
                  <label className="min-w-[250px]">
                    <div className="mb-2 text-xs font-medium text-slate-500">统计周期</div>
                    <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                      <Icon name="calendar" size={16} className="text-slate-400" />
                      <span>2026-07-01 至 2026-07-15</span>
                    </div>
                  </label>
                  <div className="ml-auto flex items-end gap-2 pt-5">
                    <button className="h-10 rounded-md border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50">重置</button>
                    <button className="h-10 rounded-md bg-xib-500 px-5 text-sm font-medium text-white shadow-sm hover:bg-xib-600">查询</button>
                  </div>
                </div>
              </section>

              {/* 当前管理视角说明前置，让管理层先明确范围与关注重点，再阅读指标。 */}
              <section data-testid="view-explanation" className="mb-4 flex items-stretch overflow-hidden rounded-lg border border-xib-100 bg-white shadow-card">
                <div className="flex w-[220px] flex-none items-center gap-3 bg-xib-50 px-4 py-4">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-xib-500 shadow-sm">
                    <Icon name={viewKey === 'headOffice' ? 'building' : viewKey === 'branch' ? 'branch' : 'monitor'} size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">{view.label}说明</h2>
                    <p className="mt-1 text-[11px] text-slate-400">随管理权限自动切换</p>
                  </div>
                </div>
                <div className="grid flex-1 grid-cols-3 divide-x divide-slate-100 px-2 py-4">
                  <div className="px-4">
                    <div className="text-xs font-medium text-slate-400">数据范围</div>
                    <div className="mt-1 text-sm leading-6 text-slate-700">{view.scope}</div>
                  </div>
                  <div className="px-4">
                    <div className="text-xs font-medium text-slate-400">管理重点</div>
                    <div className="mt-1 text-sm leading-6 text-slate-700">{view.focus}</div>
                  </div>
                  <div className="px-4">
                    <div className="text-xs font-medium text-slate-400">使用提示</div>
                    <div className="mt-1 text-sm leading-6 text-slate-700">
                      {viewKey === 'outlet' ? '单个网点的网均指标与投诉总量相同，不建议重复展示。' : ''}
                    </div>
                  </div>
                </div>
              </section>

              <div key={viewKey} className="view-enter">
                <section className="grid grid-cols-3 gap-4">
                  {['total', 'perClient', 'perOutlet'].map(key => (
                    <MetricCard
                      key={key}
                      metricKey={key}
                      view={view}
                      onOpen={setSelectedMetric}
                      onOpenDetail={setDetailMetric}
                    />
                  ))}
                </section>

                <section data-testid="risk-metrics" className="mt-4 grid grid-cols-2 gap-4">
                  {['repeat', 'specialRisk'].map(key => (
                    <MetricCard
                      key={key}
                      metricKey={key}
                      view={view}
                      onOpen={setSelectedMetric}
                      onOpenDetail={setDetailMetric}
                    />
                  ))}
                </section>

                <TrendChart viewKey={viewKey} />

                {/* 监管指标与内部管理指标分开展示，避免统计范围和计算分子混用。 */}
                <section data-testid="regulatory-section" className="mt-4 rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-white p-4 shadow-card">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-600 text-white shadow-sm">
                        <Icon name="monitor" size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold text-slate-900">监管投诉监测</h2>
                          <span className="rounded-full border border-violet-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-violet-600">独立统计口径</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">仅统计监管机构接收并转送、且经认定有效的投诉，不与全部有效投诉混算。</p>
                      </div>
                    </div>
                    <div className="rounded-md border border-violet-100 bg-white px-3 py-2 text-right">
                      <div className="text-[11px] text-slate-400">当前监管数据范围</div>
                      <div className="mt-0.5 text-xs font-medium text-slate-700">{regulatory.scope}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {['regTotal', 'regPerThousand', 'regPerOutlet'].map(key => (
                      <RegulatoryMetricCard key={key} metricKey={key} regulatory={regulatory} />
                    ))}
                  </div>
                </section>

              </div>
              </div>
            )}
          </main>

          <MetricModal metricKey={selectedMetric} view={view} onClose={() => setSelectedMetric(null)} />
          {detailMetric && <AbnormalDetailModal view={view} metricKey={detailMetric} onClose={() => setDetailMetric(null)} />}
        </div>
      );
    }

    function syncEmbeddedOfficialControls() {
      if (!getStatisticsRoot()) return;
      const root = getStatisticsRoot();
      if (!root) return;
      // React 路由切换后，移除已失去对应原生 input 的外置日期控件，避免
      // 报告中心的查询日期残留到四类报告的“指标变量库”中。
      root.querySelectorAll('.xib-embed-date').forEach(host => {
        if (host.__xibBridgeInput && !host.__xibBridgeInput.isConnected) host.remove();
      });
      const setNativeValue = (el, value) => {
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, value); else el.value = value;
      };
      const emitChange = el => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const closeAll = except => root.querySelectorAll('.xib-embed-control.is-open').forEach(node => { if (node !== except) node.classList.remove('is-open'); });
      const dateLabel = value => value ? value.replace(/-/g, '/') : '请选择';
      const monthTitle = date => date.getFullYear() + '年' + String(date.getMonth() + 1).padStart(2, '0') + '月';
      const isoDate = date => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
      const renderCalendar = (host, input, baseDate) => {
        const pop = host.querySelector('.xib-embed-date-popover');
        const title = pop.querySelector('[data-xib-month-title]');
        const days = pop.querySelector('.di-days');
        const active = input.value;
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const min = input.min || '';
        const max = input.max || '';
        title.textContent = monthTitle(baseDate);
        const first = new Date(year, month, 1);
        const start = new Date(year, month, 1 - first.getDay());
        days.innerHTML = Array.from({ length: 42 }, (_, index) => {
          const date = new Date(start);
          date.setDate(start.getDate() + index);
          const value = isoDate(date);
          const muted = date.getMonth() !== month;
          const unavailable = muted || (min && value < min) || (max && value > max);
          return '<button type="button" class="' + (unavailable ? 'is-muted ' : '') + (value === active ? 'is-active' : '') + '" ' + (unavailable ? 'disabled' : 'data-xib-date="' + value + '"') + '>' + date.getDate() + '</button>';
        }).join('');
      };
      // 筛选栏结构和网格类由 React 组件直接声明。这里不再通过文本与旧
      // Tailwind 类名重新识别 DOM，避免 MutationObserver 在重渲染后清除布局类。
      root.querySelectorAll('button[data-testid$="org-scope"]').forEach(button => {
        button.classList.add('di-select', 'is-fluid', 'di-select-trigger', 'xib-embed-inline-select');
      });
      root.querySelectorAll('select:not([data-xib-skip])').forEach(select => {
        if (select.closest('.xib-embed-control')) return;
        select.classList.remove('xib-native-hidden');
        select.classList.add('di-native-select', 'is-fluid');
        if (select.__xibBridgeHost && select.__xibBridgeHost.isConnected) {
          select.__xibBridgeHost.remove();
        }
        select.__xibBridgeHost = null;
      });
      root.querySelectorAll('input[type="date"]').forEach(input => {
        if (input.closest('.xib-embed-control')) return;
        input.classList.add('xib-native-hidden');
        let host = input.__xibBridgeHost;
        if (!host || !host.isConnected) {
          // React 可能在受控日期值更新时替换原生 input；清理旧 input 遗留的
          // 日历桥接节点，避免查询或重置后重复渲染日期控件。
          const bridgeKey = input.getAttribute('aria-label') || input.dataset.testid || '';
          if (bridgeKey) {
            root.querySelectorAll('.xib-embed-date').forEach(candidate => {
              if (candidate.dataset.xibFor === bridgeKey) candidate.remove();
            });
          }
          let staleHost = input.nextElementSibling;
          while (staleHost && staleHost.classList.contains('xib-embed-date')) {
            const nextHost = staleHost.nextElementSibling;
            staleHost.remove();
            staleHost = nextHost;
          }
          host = document.createElement('div');
          host.className = 'di-picker-field xib-embed-control xib-embed-date';
          host.dataset.xibFor = bridgeKey;
          host.dataset.xibMonth = (input.value || '2026-07-01').slice(0, 7) + '-01';
          host.innerHTML = '<button type="button" class="di-select is-fluid di-picker-trigger xib-embed-trigger xib-embed-date-trigger" data-picker-trigger><img class="lib-icon-img" src="ui/assets/date.svg" alt=""><span></span></button><div class="di-picker-popover xib-embed-popover xib-embed-date-popover" hidden><div class="di-calendar"><div class="di-calendar-head"><button type="button" data-xib-prev-year aria-label="上一年">‹‹</button><button type="button" data-xib-prev-month aria-label="上个月">‹</button><b data-xib-month-title></b><button type="button" data-xib-next-month aria-label="下个月">›</button><button type="button" data-xib-next-year aria-label="下一年">››</button></div><div class="di-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="di-days"></div></div><div class="di-picker-footer"><button type="button" data-xib-cancel>取消</button><button type="button" data-xib-confirm>确定</button></div></div>';
          input.insertAdjacentElement('afterend', host);
          input.__xibBridgeHost = host;
          host.__xibBridgeInput = input;
          const trigger = host.querySelector('.xib-embed-trigger');
          trigger.addEventListener('click', event => {
            event.preventDefault(); event.stopPropagation();
            const open = !host.classList.contains('is-open');
            closeAll(host); host.classList.toggle('is-open', open);
            host.querySelector('.xib-embed-popover').hidden = !open;
            renderCalendar(host, input, new Date(host.dataset.xibMonth));
          });
          host.querySelector('[data-xib-prev-year]').onclick = event => { event.stopPropagation(); const date = new Date(host.dataset.xibMonth); date.setFullYear(date.getFullYear() - 1); host.dataset.xibMonth = isoDate(date); renderCalendar(host, input, date); };
          host.querySelector('[data-xib-prev-month]').onclick = event => { event.stopPropagation(); const date = new Date(host.dataset.xibMonth); date.setMonth(date.getMonth() - 1); host.dataset.xibMonth = isoDate(date); renderCalendar(host, input, date); };
          host.querySelector('[data-xib-next-month]').onclick = event => { event.stopPropagation(); const date = new Date(host.dataset.xibMonth); date.setMonth(date.getMonth() + 1); host.dataset.xibMonth = isoDate(date); renderCalendar(host, input, date); };
          host.querySelector('[data-xib-next-year]').onclick = event => { event.stopPropagation(); const date = new Date(host.dataset.xibMonth); date.setFullYear(date.getFullYear() + 1); host.dataset.xibMonth = isoDate(date); renderCalendar(host, input, date); };
          host.querySelector('.di-days').onclick = event => {
            const button = event.target.closest('[data-xib-date]');
            if (!button) return;
            event.preventDefault(); event.stopPropagation();
            host.dataset.pendingDate = button.dataset.xibDate;
            host.querySelectorAll('[data-xib-date]').forEach(item => item.classList.toggle('is-active', item === button));
          };
          host.querySelector('[data-xib-cancel]').onclick = event => { event.preventDefault(); event.stopPropagation(); host.classList.remove('is-open'); host.querySelector('.xib-embed-popover').hidden = true; };
          host.querySelector('[data-xib-confirm]').onclick = event => {
            event.preventDefault(); event.stopPropagation();
            const value = host.dataset.pendingDate || input.value;
            if (!value) return;
            setNativeValue(input, value);
            emitChange(input);
            host.classList.remove('is-open');
            host.querySelector('.xib-embed-popover').hidden = true;
            host.querySelector('.xib-embed-trigger span').textContent = dateLabel(value);
          };
        }
        if (input.dataset.xibLockMonth === 'true') {
          host.dataset.xibMonth = (input.value || input.min || '2026-07-01').slice(0, 7) + '-01';
          ['[data-xib-prev-year]','[data-xib-prev-month]','[data-xib-next-month]','[data-xib-next-year]'].forEach(selector => { host.querySelector(selector).disabled = true; });
        }
        host.querySelector('.xib-embed-trigger span').textContent = dateLabel(input.value);
        host.querySelector('.xib-embed-popover').hidden = !host.classList.contains('is-open');
      });
      root.querySelectorAll('label input[type="checkbox"]').forEach(input => {
        const label = input.closest('label');
        input.classList.remove('xib-native-hidden');
        input.style.setProperty('display', 'inline-block', 'important');
        input.style.setProperty('vertical-align', 'middle', 'important');
        if (label) {
          label.classList.remove('di-check-choice', 'xib-checkbox-label-bridged', 'is-checked');
        }
      });

      root.querySelectorAll('button').forEach(button => {
        const mark = button.querySelector(':scope > span:first-child');
        if (!mark) return;
        const markClass = String(mark.className || '');
        if (!markClass.includes('h-4') || !markClass.includes('w-4')) return;
        const checked = (mark.textContent || '').trim() === '✓' || markClass.includes('bg-violet-600');
        button.classList.remove('di-check-choice');
        button.classList.add('xib-report-checkbox-option');
        button.classList.toggle('is-checked', checked);
        mark.classList.add('xib-report-checkbox-mark');
        mark.textContent = '';
        mark.style.display = '';
      });
      const officialEventRoot = getStatisticsRoot()?.getRootNode();
      if (officialEventRoot && statisticsOfficialCloserRoot !== officialEventRoot) {
        if (statisticsOfficialCloserRoot && statisticsOfficialCloser) {
          statisticsOfficialCloserRoot.removeEventListener('click', statisticsOfficialCloser);
        }
        statisticsOfficialCloser = event => {
          if (!event.target.closest('.xib-embed-control')) closeAll(null);
        };
        statisticsOfficialCloserRoot = officialEventRoot;
        statisticsOfficialCloserRoot.addEventListener('click', statisticsOfficialCloser);
      }
    }

    const scheduleStickyFilterLayers = () => {
      if (window.__xibStickyFilterFrame) return;
      window.__xibStickyFilterFrame = window.requestAnimationFrame(() => {
        window.__xibStickyFilterFrame = 0;
        const statisticsRoot = getStatisticsRoot();
        const scrollTop = statisticsRoot?.scrollTop || 0;
        const stickyViewportTop = statisticsRoot?.getBoundingClientRect().top || 0;
        (statisticsRoot?.querySelectorAll('.xib-sticky-filter') || []).forEach(filter => {
          const top = Number.parseFloat(window.getComputedStyle(filter).top) || 0;
          const isStuck = scrollTop > 0 && filter.getBoundingClientRect().top <= stickyViewportTop + top + 1;
          filter.classList.toggle('is-stuck', isStuck);
          filter.style.setProperty('box-shadow', isStuck ? '0 8px 20px rgba(31,56,88,.18)' : 'none', 'important');
        });
      });
    };


    function renderStatisticsModule() {
      if (!statisticsReactRoot) return;
      statisticsReactRoot.render(
        <App
          route={statisticsOptions.route || 'production'}
          onRouteChange={statisticsOptions.onRouteChange}
          onOpenTicket={statisticsOptions.onOpenTicket}
        />
      );
    }

    function startStatisticsEnhancements() {
      if (!statisticsRootElement) return;
      if (statisticsObserver) statisticsObserver.disconnect();
      statisticsObserver = new MutationObserver(() => window.requestAnimationFrame(() => {
        syncEmbeddedWorkOrderStatus();
        syncEmbeddedOfficialControls();
        scheduleStickyFilterLayers();
      }));
      statisticsObserver.observe(statisticsRootElement, { childList: true, subtree: true });
      window.requestAnimationFrame(() => {
        syncEmbeddedWorkOrderStatus();
        syncEmbeddedOfficialControls();
        scheduleStickyFilterLayers();
      });
      statisticsRootElement.addEventListener('scroll', scheduleStickyFilterLayers, { passive: true });
      window.addEventListener('resize', scheduleStickyFilterLayers);
    }

    function stopStatisticsEnhancements() {
      if (statisticsObserver) statisticsObserver.disconnect();
      statisticsObserver = null;
      if (statisticsOfficialCloserRoot && statisticsOfficialCloser) {
        statisticsOfficialCloserRoot.removeEventListener('click', statisticsOfficialCloser);
      }
      statisticsOfficialCloser = null;
      statisticsOfficialCloserRoot = null;
      statisticsRootElement?.removeEventListener('scroll', scheduleStickyFilterLayers);
      window.removeEventListener('resize', scheduleStickyFilterLayers);
    }

    global.XIBStatisticsModule = {
      mount(host, options = {}) {
        if (!host) throw new Error('统计分析模块缺少挂载节点');
        if (statisticsHost && statisticsHost !== host) this.unmount();
        statisticsHost = host;
        statisticsOptions = { ...options };
        const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
        let mountNode = shadowRoot.getElementById('root');
        if (!mountNode) {
          const stylesheet = document.createElement('link');
          stylesheet.rel = 'stylesheet';
          stylesheet.href = 'statistics-module.css';
          shadowRoot.appendChild(stylesheet);
          mountNode = document.createElement('div');
          mountNode.id = 'root';
          shadowRoot.appendChild(mountNode);
          const portalNode = document.createElement('div');
          portalNode.id = 'statistics-portal-root';
          shadowRoot.appendChild(portalNode);
        }
        statisticsRootElement = mountNode;
        statisticsReactRoot = statisticsReactRoot || ReactDOM.createRoot(mountNode);
        renderStatisticsModule();
        startStatisticsEnhancements();
      },
      update(options = {}) {
        const routeChanged = Boolean(options.route && options.route !== statisticsOptions.route);
        statisticsOptions = { ...statisticsOptions, ...options };
        renderStatisticsModule();
        if (routeChanged) statisticsRootElement?.scrollTo({ top: 0, behavior: 'auto' });
        window.requestAnimationFrame(scheduleStickyFilterLayers);
      },
      unmount() {
        stopStatisticsEnhancements();
        if (statisticsReactRoot) statisticsReactRoot.unmount();
        statisticsReactRoot = null;
        statisticsRootElement = null;
        statisticsHost = null;
        statisticsOptions = {};
      }
    };
  })(window);
