// js/data.js - 游戏数据：角色、场地配置
// ==========================================
// 角色配置（注册时选择的身份类型）
// ==========================================
const ROLE_CONFIG = {
  // ── 管理 ──
  director: {
    label: '院长',
    color: '#ff6b35',
    group: 'admin',
    maxCount: 1,
    items: ['工作牌（院长）', '院长主钥', '全院档案', '院章']
  },
  vice_director: {
    label: '副院长',
    color: '#e0824a',
    group: 'admin',
    maxCount: 1,
    items: ['工作牌（副院长）', '副院长钥匙', '行政文件']
  },
  npc: {
    label: 'NPC',
    color: '#8b949e',
    group: 'neutral',
    maxCount: 20,
    items: ['工作牌（NPC）']
  },

  // ── 医疗医护 ──
  attending: {
    label: '主治医师',
    color: '#4a7ab8',
    group: 'staff',
    maxCount: 3,
    items: ['工作牌（主治医师）', '诊疗记录本', '处方单']
  },
  doctor: {
    label: '医生',
    color: '#5a90c8',
    group: 'staff',
    maxCount: 6,
    items: ['工作牌（医生）', '病历本', '听诊器']
  },
  head_nurse: {
    label: '护士长',
    color: '#3ab8a4',
    group: 'staff',
    maxCount: 1,
    items: ['工作牌（护士长）', '护士长钥匙', '巡房记录本']
  },
  nurse: {
    label: '护士',
    color: '#4ab8b0',
    group: 'staff',
    maxCount: 8,
    items: ['工作牌（护士）', '给药记录本', '血压计']
  },
  therapist: {
    label: '治疗师',
    color: '#7ab84a',
    group: 'staff',
    maxCount: 3,
    items: ['工作牌（治疗师）', '心理测评表', '录音笔']
  },

  // ── 患者 ──
  patient_open: {
    label: '开放病区患者',
    color: '#b8a4d4',
    group: 'patient',
    maxCount: 10,
    items: ['病号服', '日记（残损）', '一枚发卡']
  },
  patient_closed: {
    label: '封闭病区患者',
    color: '#d4a4b8',
    group: 'patient',
    maxCount: 8,
    items: ['病号服', '一张模糊的照片']
  },
  patient_icu: {
    label: '特护室患者',
    color: '#d4c4a4',
    group: 'patient',
    maxCount: 4,
    items: ['病号服', '手环（特护）', '碎片记忆']
  },

  // ── 其他人员 ──
  unknown: {
    label: '不明身份者',
    color: '#6e7681',
    group: 'neutral',
    maxCount: 5,
    items: ['临时通行证', '碎片线索']
  },
  archivist: {
    label: '档案管理员',
    color: '#9090b8',
    group: 'staff',
    maxCount: 2,
    items: ['工作牌（档案员）', '档案室钥匙', '记录本']
  },
  sec_captain: {
    label: '安保队长',
    color: '#8a6a4a',
    group: 'staff',
    maxCount: 1,
    items: ['工作牌（安保队长）', '对讲机', '安保钥匙串']
  },
  security: {
    label: '安保员',
    color: '#9a7a5a',
    group: 'staff',
    maxCount: 6,
    items: ['工作牌（安保员）', '对讲机', '警棍']
  },
  logistics: {
    label: '后勤',
    color: '#6a9a6a',
    group: 'neutral',
    maxCount: 4,
    items: ['工作牌（后勤员）', '工具包', '通道卡']
  },
  family: {
    label: '患者家属',
    color: '#c8a87a',
    group: 'neutral',
    maxCount: 8,
    items: ['探视证', '家庭合照']
  },
  reporter: {
    label: '调查记者',
    color: '#d4c44a',
    group: 'neutral',
    maxCount: 3,
    items: ['记者证（伪造）', '录音设备', '线索笔记本']
  },
  vip_visitor: {
    label: '神秘高层访客',
    color: '#c8a84a',
    group: 'neutral',
    maxCount: 2,
    items: ['特殊访客证', '精致名片']
  },
  escapee: {
    label: '逃逸者',
    color: '#f85149',
    group: 'patient',
    maxCount: 3,
    items: ['破损的手环', '藏身处草图']
  },
};

// 按组划分的初始属性
const ROLE_BASE_STATS = {
  admin: { stress: 20, authority: 100 },
  staff: { stress: 30, authority: 60 },
  patient: { memoryFragments: 0, maxFragments: 8, sanity: 65, trust: 50, medication: false },
  neutral: { trust: 60 },
};

// ==========================================
// 预设角色（NPC 级别，由主持人扮演或预置）
// ==========================================
const CHARACTERS = [
  // ── 患者 ──
  {
    id: 'lin_xiaoyu',
    name: '林晓雨',
    role: 'patient_open',
    avatar: '女',
    color: '#b8a4d4',
    password: '1234',
    title: '开放病区患者 · 记忆失调者',
    description: '入院三个月，对自己的过去只有零星记忆。安静、敏感，喜欢在花园里坐着。',
    baseStats: { memoryFragments: 0, maxFragments: 10, sanity: 70, trust: 50, medication: true }
  },
  {
    id: 'chen_mo',
    name: '陈默',
    role: 'patient_closed',
    avatar: '男',
    color: '#a4b8d4',
    password: '1234',
    title: '封闭病区患者 · 偏执型精神分裂',
    description: '总觉得有人在监视他。不信任任何人，但洞察力极强，总能注意到别人忽视的细节。',
    baseStats: { memoryFragments: 0, maxFragments: 8, sanity: 55, trust: 20, medication: false }
  },
  {
    id: 'su_zhitong',
    name: '苏芷彤',
    role: 'patient_closed',
    avatar: '女',
    color: '#d4a4b8',
    password: '1234',
    title: '封闭病区患者 · 解离性身份障碍',
    description: '两个人格交替出现：温柔的"苏苏"和冷漠的"彤"。转变时她自己也无从察觉。',
    baseStats: { memoryFragments: 0, maxFragments: 12, sanity: 60, trust: 45, medication: true }
  },
  {
    id: 'fang_li',
    name: '方黎',
    role: 'patient_open',
    avatar: '男',
    color: '#a4d4b8',
    password: '1234',
    title: '开放病区患者 · 抑郁障碍',
    description: '世界在他眼中是灰色的。文字是他唯一的出口，他在病房的墙缝里藏着一本诗集。',
    baseStats: { memoryFragments: 0, maxFragments: 6, sanity: 45, trust: 60, medication: true }
  },
  {
    id: 'bai_ye',
    name: '白叶',
    role: 'patient_closed',
    avatar: '女',
    color: '#d4d4a4',
    password: '1234',
    title: '封闭病区患者 · 梦游症',
    description: '清醒时对夜间的活动全无记忆。总会在不该出现的地方出现，手里握着无法解释的物品。',
    baseStats: { memoryFragments: 0, maxFragments: 8, sanity: 65, trust: 55, medication: false }
  },

  // ── 医护 ──
  {
    id: 'gu_mingyuan',
    name: '顾明远',
    role: 'attending',
    avatar: '男',
    color: '#4a7ab8',
    password: '1234',
    title: '主治医师 · 精神科',
    description: '院里资历最深的医师。态度温和，但对某些患者的过去似乎知道得太多。',
    baseStats: { stress: 35, authority: 85 }
  },
  {
    id: 'shen_jing',
    name: '沈静',
    role: 'head_nurse',
    avatar: '女',
    color: '#4ab8a4',
    password: '1234',
    title: '护士长',
    description: '严格遵守规章制度，准时给所有病房。偶尔会对某些患者格外关照，原因不明。',
    baseStats: { stress: 50, authority: 70 }
  },
  {
    id: 'zhou_zhe',
    name: '周哲',
    role: 'therapist',
    avatar: '男',
    color: '#7ab84a',
    password: '1234',
    title: '心理治疗师',
    description: '年轻的咨询师，真心想帮助患者，却对这所医院隐藏的秘密一无所知。',
    baseStats: { stress: 25, authority: 50 }
  },

  // ── 院长（主持人）──
  {
    id: 'admin',
    name: '游戏主持',
    role: 'director',
    avatar: '管',
    color: '#ff6b35',
    password: '1234',
    title: '院长 · 游戏主持者',
    description: '控制游戏进程的幕后主持者。可以发布公告、触发事件、修改角色数据。',
    baseStats: { stress: 0, authority: 100 }
  }
];

// 场景列表
const LOCATIONS = [
  { id: 'activity', name: '患者活动室', icon: '活', access: 'all', desc: '日间活动空间，有棋盘和书架' },
  { id: 'corridor', name: '走廊', icon: '廊', access: 'all', desc: '连接各区域，医护常在此巡视' },
  { id: 'ward_open', name: '开放病区', icon: '开', access: 'all', desc: '开放管理的轻症病房' },
  { id: 'ward_closed', name: '封闭病区', icon: '封', access: 'all', desc: '封闭管理的重症病房' },
  { id: 'ward_icu', name: '特护室', icon: '特', access: 'staff_only', desc: '24小时特别监护室' },
  { id: 'cafeteria', name: '餐厅', icon: '餐', access: 'all', desc: '用餐区，患者最常聚集的地方' },
  { id: 'garden', name: '花园', icon: '园', access: 'all', desc: '院内花园，傍晚19:00后锁门' },
  { id: 'therapy_room', name: '咨询室', icon: '询', access: 'all', desc: '心理咨询专用房间，需预约' },
  { id: 'nurse_station', name: '护士站', icon: '护', access: 'staff_only', desc: '医护工作区，存放药柜和病历' },
  { id: 'archive', name: '档案室', icon: '档', access: 'staff_only', desc: '存放所有患者历史档案' },
  { id: 'security_post', name: '安保室', icon: '安', access: 'staff_only', desc: '安保人员驻守区，监控全院' },
  { id: 'director_office', name: '院长办公室', icon: '院', access: 'staff_only', desc: '重要档案所在地，门常锁着' }
];

// ==========================================
// 各角色专属档案字段配置
// ==========================================
const ROLE_EXTRA_FIELDS = {
  director: {
    isAdminProfile: true,
    fields: []
  },
  vice_director: {
    isAdminProfile: true,
    fields: []
  },
  npc: {
    isAdminProfile: false,
    fields: []
  },
  attending: {
    isAdminProfile: false,
    fields: [
      { key: 'ward', label: '负责病区', type: 'select', options: ['A区（轻症开放）', 'B区（中度封闭）', 'C区（重症特护）'] },
      { key: 'philosophy', label: '治疗理念', type: 'textarea', placeholder: '简述你的治疗风格与核心理念...' },
      { key: 'notes', label: '备注', type: 'textarea', placeholder: '当前关注的患者、待忘事项...' }
    ]
  },
  doctor: {
    isAdminProfile: false,
    fields: [
      { key: 'notes', label: '工作备注', type: 'textarea', placeholder: '日常工作备忘、关注病例等...' }
    ]
  },
  head_nurse: {
    isAdminProfile: false,
    fields: [
      { key: 'notes', label: '工作备注', type: 'textarea', placeholder: '排班安排、突发事项记录...' }
    ]
  },
  nurse: {
    isAdminProfile: false,
    fields: [
      { key: 'shift', label: '班次', type: 'select', options: ['白班（07:00-19:00）', '夜班（19:00-07:00）'] },
      { key: 'notes', label: '工作备注', type: 'textarea', placeholder: '给药记录、巡房记录...' }
    ]
  },
  therapist: {
    isAdminProfile: false,
    fields: [
      { key: 'therapy_type', label: '治疗方式', type: 'select', options: ['艺术疗法', '音乐疗法', '运动疗法', '谈话疗法', '催眠疗法', '其他'] },
      { key: 'therapy_habit', label: '治疗习惯与手法', type: 'textarea', placeholder: '描述你惯用的治疗手法、独特方法...' }
    ]
  },
  patient_open: {
    isAdminProfile: false,
    fields: [
      { key: 'activity_range', label: '活动范围', type: 'textarea', placeholder: '开放病区患者可以在哪些区域活动...' }
    ]
  },
  patient_closed: {
    isAdminProfile: false,
    fields: [
      { key: 'activity_range', label: '活动范围（受限）', type: 'textarea', placeholder: '封闭病区患者活动受到严格限制，可活动区域...' }
    ]
  },
  patient_icu: {
    isAdminProfile: false,
    fields: [
      { key: 'activity_range', label: '活动范围（极度受限·24h监控）', type: 'textarea', placeholder: '特护室患者几乎不能离开监护区，可活动范围极小...' }
    ]
  },
  unknown: {
    isAdminProfile: false,
    fields: [
      { key: 'custom_bg', label: '自定义背景（仅自己可见）', type: 'textarea', placeholder: '你的真实身份、来院原因、隐藏目的...' }
    ]
  },
  archivist: {
    isAdminProfile: false,
    fields: [
      { key: 'notes', label: '档案管理备注', type: 'textarea', placeholder: '当前在整理的档案、异常记录...' }
    ]
  },
  sec_captain: {
    isAdminProfile: false,
    fields: [
      { key: 'team_notes', label: '队伍安排与任务记录', type: 'textarea', placeholder: '安保团队分工、当前执行任务...' }
    ]
  },
  security: {
    isAdminProfile: false,
    fields: [
      { key: 'patrol_zone', label: '巡逻区域', type: 'text', placeholder: '负责巡逻的具体区域...' },
      { key: 'notes', label: '工作备注', type: 'textarea', placeholder: '任务备注、异常情况...' }
    ]
  },
  logistics: {
    isAdminProfile: false,
    fields: [
      { key: 'duty_area', label: '职责区域', type: 'text', placeholder: '食堂 / 仓库 / 维修 / 洗衣...' },
      { key: 'notes', label: '工作备注', type: 'textarea', placeholder: '物资状态、工作记录...' }
    ]
  },
  family: {
    isAdminProfile: false,
    fields: [
      { key: 'visit_target', label: '探视的亲人（患者名字）', type: 'text', placeholder: '正在探视的亲人名字...' },
      { key: 'relation', label: '与患者的关系', type: 'text', placeholder: '父母 / 子女 / 配偶 / 兄弟姐妹...' }
    ]
  },
  reporter: {
    isAdminProfile: false,
    fields: [
      { key: 'disguise', label: '对外宣称的身份', type: 'text', placeholder: '对周围人宣称的身份...' },
      { key: 'investigation_target', label: '调查目标与线索', type: 'textarea', placeholder: '你正在追查的内容、已掌握的线索...' }
    ]
  },
  vip_visitor: {
    isAdminProfile: false,
    fields: [
      { key: 'true_identity', label: '真实身份与目的（仅自己可见）', type: 'textarea', placeholder: '你真正的来意、幕后关系...' }
    ]
  },
  escapee: {
    isAdminProfile: false,
    fields: [
      { key: 'hideout', label: '东翼藏身处', type: 'text', placeholder: '东翼某个具体位置...' },
      { key: 'custom_bg', label: '逃逸背景', type: 'textarea', placeholder: '你如何从监护区逃出，逃出的困境与动机...' }
    ]
  }
};

// 随机颜色池（注册用户使用）
const RANDOM_COLORS = [
  '#c084fc', '#f472b6', '#fb923c', '#34d399', '#60a5fa',
  '#a78bfa', '#f87171', '#4ade80', '#38bdf8', '#facc15',
  '#e879f9', '#67e8f9', '#86efac', '#fda4af', '#c4b5fd'
];

function randomColor() {
  return RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
}
