// js/store.js  -  Vue 响应式状态管理 (CloudBase 数据库版)
// ==========================================
// 所有数据存储在 CloudBase 数据库, 实时同步
// ==========================================

const SESSION_KEY = 'chenxi_char_session';

// ==========================================
//  辅助函数
// ==========================================

function makeCharState(char) {
  return {
    ...(char.baseStats || {}),
    currentLocation: (char.role === 'director' || char.role === 'admin') ? 'nurse_station' : 'activity',
    items: [...(ROLE_CONFIG[char.role]?.items || [])],
    notes: '',
    lastSeen: 0
  };
}

/** 将预设角色数据转为数据库用户格式 */
function presetToDbUser(c) {
  return {
    userId: c.id,
    name: c.name,
    role: c.role,
    avatar: c.avatar,
    color: c.color,
    password: c.password,
    title: c.title,
    description: c.description,
    isCustom: false,
    isPreset: true,
    baseStats: c.baseStats || {}
  };
}

// ==========================================
//  响应式 Store
// ==========================================
const store = Vue.reactive({

  /** 当前标签页登录的用户对象 */
  currentChar: null,

  /** 所有用户列表 (从数据库加载) */
  _users: [],

  /** 共享游戏状态 (本地缓存, 实时同步) */
  gameState: {
    gameDay: 1, gameHour: 8, gameMinute: 0,
    messages: [],
    announcements: [],
    characterStates: {}
  },

  /** 稳定的在线状态缓存: { charId: { online: true, location: 'xxx' } }
   *  只在在线/离线状态或位置真正变化时更新, 避免闪烁 */
  _onlineMap: {},

  /** 在线列表版本号 (每次 _onlineMap 有实质变化时 +1, 触发 computed 更新) */
  _onlineVer: 0,

  /** 偷听授权 */
  eavesdropGrants: {},

  /** 通知队列 */
  notifications: [],

  /** 初始化状态 */
  _initialized: false,
  _initializing: false,

  // ===========================
  //  初始化 (异步)
  // ===========================
  async init() {
    if (this._initialized || this._initializing) return;
    this._initializing = true;

    try {
      // 1. 初始化 CloudBase
      await DB.init();

      // 2. 检查并播种预设数据
      await this._seedPresetData();

      // 3. 从数据库加载所有用户
      await this._loadUsers();

      // 4. 从数据库加载游戏状态
      await this._loadGameState();

      // 5. 从数据库加载角色状态
      await this._loadCharStates();

      // 6. 从数据库加载消息
      await this._loadMessages();

      // 7. 恢复会话
      const sessId = sessionStorage.getItem(SESSION_KEY);
      if (sessId) {
        this.currentChar = this._users.find(u => u.userId === sessId) || null;
      }

      // 8. 启动轮询 (主要同步机制)
      this._startPolling();

      // 9. 同时尝试启动实时监听 (可选增强)
      this._tryStartWatchers();

      // 10. 心跳 (同步在线状态到数据库)
      this._heartbeat();
      this._refreshOnlineStatus();
      setInterval(() => {
        this._heartbeat();
        this._refreshOnlineStatus();
      }, 10000);

      this._initialized = true;
      console.log('[Store] 初始化完成, 用户数:', this._users.length);
    } catch (e) {
      console.error('[Store] 初始化失败:', e);
      throw e;
    } finally {
      this._initializing = false;
    }
  },

  // ===========================
  //  数据播种 (首次运行)
  // ===========================
  async _seedPresetData() {
    const existingUsers = await DB.getAllUsers();
    if (existingUsers.length === 0) {
      console.log('[Store] 首次运行, 播种预设数据...');

      const presetUsers = CHARACTERS.map(c => presetToDbUser(c));
      await DB.seedUsers(presetUsers);

      const statesMap = {};
      CHARACTERS.forEach(c => {
        statesMap[c.id] = makeCharState(c);
      });
      await DB.seedCharStates(statesMap);

      await DB.initGameState({
        gameDay: 1, gameHour: 8, gameMinute: 0, announcements: []
      });

      console.log('[Store] 预设数据播种完成');
    } else {
      await DB.initGameState({
        gameDay: 1, gameHour: 8, gameMinute: 0, announcements: []
      });
    }
  },

  // ===========================
  //  数据加载
  // ===========================
  async _loadUsers() {
    const freshUsers = await DB.getAllUsers();
    // 智能合并: 只更新有变化的用户, 避免 Vue 重新渲染导致在线列表闪烁
    const existingMap = {};
    this._users.forEach(u => { existingMap[u.userId] = u; });
    const freshMap = {};
    freshUsers.forEach(u => { freshMap[u.userId] = u; });

    // 更新已有用户的属性 (原地修改, 不替换对象引用)
    for (const u of this._users) {
      const fresh = freshMap[u.userId];
      if (fresh) {
        for (const key of Object.keys(fresh)) {
          if (key === '_id') continue;
          if (JSON.stringify(u[key]) !== JSON.stringify(fresh[key])) {
            u[key] = fresh[key];
          }
        }
      }
    }

    // 添加新用户
    for (const fu of freshUsers) {
      if (!existingMap[fu.userId]) {
        this._users.push(fu);
      }
    }

    // 移除已删除的用户
    for (let i = this._users.length - 1; i >= 0; i--) {
      if (!freshMap[this._users[i].userId]) {
        this._users.splice(i, 1);
      }
    }
  },

  async _loadGameState() {
    const gs = await DB.getGameState();
    if (gs) {
      this.gameState.gameDay        = gs.gameDay        ?? 1;
      this.gameState.gameHour       = gs.gameHour       ?? 8;
      this.gameState.gameMinute     = gs.gameMinute     ?? 0;
      this.gameState.announcements  = gs.announcements  || [];
    }
  },

  async _loadCharStates() {
    const statesMap = await DB.getAllCharStates();
    // 智能合并: 逐字段更新, 避免替换整个对象导致在线列表闪烁
    const existing = this.gameState.characterStates;

    for (const [charId, doc] of Object.entries(statesMap)) {
      const { _id, charId: cid, ...state } = doc;
      if (!existing[charId]) {
        // 新角色状态, 直接赋值
        existing[charId] = state;
      } else {
        // 已存在, 逐字段更新 (只改变有变化的字段)
        for (const key of Object.keys(state)) {
          if (JSON.stringify(existing[charId][key]) !== JSON.stringify(state[key])) {
            existing[charId][key] = state[key];
          }
        }
      }
    }

    // 移除数据库中已不存在的角色状态
    for (const charId of Object.keys(existing)) {
      if (!statesMap[charId]) {
        delete existing[charId];
      }
    }
  },

  async _loadMessages() {
    const msgs = await DB.getMessages(500);
    const freshList = msgs.map(m => {
      const { _id, ...rest } = m;
      return { ...rest, _dbId: _id };
    });

    // 智能合并消息: 用 msgId 判断, 只追加新消息, 不替换整个数组
    // 这样可以保持聊天实时性, 同时不会引起不必要的闪烁
    const existingIds = new Set(this.gameState.messages.map(m => m.msgId || m._dbId));
    const freshIds = new Set(freshList.map(m => m.msgId || m._dbId));

    // 追加新消息
    for (const fm of freshList) {
      const fid = fm.msgId || fm._dbId;
      if (!existingIds.has(fid)) {
        this.gameState.messages.push(fm);
      }
    }

    // 移除本地有但服务器已删除的消息 (比如清空聊天后)
    if (freshList.length === 0 && this.gameState.messages.length > 0) {
      this.gameState.messages.splice(0);
    } else if (this.gameState.messages.length > freshList.length + 20) {
      // 本地消息远多于服务器 (可能服务器被清空过), 做全量替换
      this.gameState.messages.splice(0, this.gameState.messages.length, ...freshList);
    }
  },

  // ===========================
  //  轮询同步 (主要机制)
  // ===========================
  _startPolling() {
    let msgPollRunning = false;
    let slowPollRunning = false;

    // 消息轮询: 每 3 秒同步一次 (快速, 保证实时对话)
    setInterval(async () => {
      if (msgPollRunning) return;
      msgPollRunning = true;
      try {
        await this._loadMessages();
      } catch (e) {
        console.warn('[Store] 消息轮询失败:', e);
      } finally {
        msgPollRunning = false;
      }
    }, 3000);

    // 慢轮询: 8 秒同步用户列表、游戏状态、角色状态 (在线人数等)
    setInterval(async () => {
      if (slowPollRunning) return;
      slowPollRunning = true;
      try {
        await this._loadUsers();
        await this._loadGameState();
        await this._loadCharStates();
        // 刷新在线状态缓存
        this._refreshOnlineStatus();
        // 同步后如果当前角色数据有更新, 刷新 currentChar (只在真正有变化时)
        if (this.currentChar) {
          const updated = this._users.find(u => u.userId === this.currentChar.userId);
          if (updated && updated !== this.currentChar) {
            // 检查是否真的有属性变化
            const keys = Object.keys(updated);
            let hasChange = false;
            for (const k of keys) {
              if (k === '_id') continue;
              if (JSON.stringify(this.currentChar[k]) !== JSON.stringify(updated[k])) {
                hasChange = true;
                break;
              }
            }
            if (hasChange) this.currentChar = updated;
          }
        }
      } catch (e) {
        console.warn('[Store] 慢轮询失败:', e);
      } finally {
        slowPollRunning = false;
      }
    }, 8000);

    console.log('[Store] 轮询已启动 (消息 3s, 其他 8s)');
  },

  // ===========================
  //  可选实时监听 (增强)
  // ===========================
  _tryStartWatchers() {
    try {
      // 监听消息 (如果可用, 会在轮询之上提供即时推送)
      DB.watchMessages((docs) => {
        const freshList = docs.map(m => {
          const { _id, ...rest } = m;
          return { ...rest, _dbId: _id };
        });
        // 智能合并: 只追加新消息
        const existingIds = new Set(this.gameState.messages.map(m => m.msgId || m._dbId));
        for (const fm of freshList) {
          const fid = fm.msgId || fm._dbId;
          if (!existingIds.has(fid)) {
            this.gameState.messages.push(fm);
          }
        }
        if (freshList.length === 0 && this.gameState.messages.length > 0) {
          this.gameState.messages.splice(0);
        }
      });

      // 监听游戏状态
      DB.watchGameState((doc) => {
        if (doc) {
          this.gameState.gameDay        = doc.gameDay        ?? 1;
          this.gameState.gameHour       = doc.gameHour       ?? 8;
          this.gameState.gameMinute     = doc.gameMinute     ?? 0;
          this.gameState.announcements  = doc.announcements  || [];
        }
      });

      // 监听角色状态 (智能合并, 避免闪烁)
      DB.watchCharStates((statesMap) => {
        const existing = this.gameState.characterStates;
        for (const [charId, doc] of Object.entries(statesMap)) {
          const { _id, charId: cid, ...state } = doc;
          if (!existing[charId]) {
            existing[charId] = state;
          } else {
            for (const key of Object.keys(state)) {
              if (JSON.stringify(existing[charId][key]) !== JSON.stringify(state[key])) {
                existing[charId][key] = state[key];
              }
            }
          }
        }
        for (const charId of Object.keys(existing)) {
          if (!statesMap[charId]) delete existing[charId];
        }
        // 刷新在线状态缓存
        this._refreshOnlineStatus();
      });

      // 监听用户 (智能合并, 避免闪烁)
      DB.watchUsers((docs) => {
        const freshMap = {};
        docs.forEach(u => { freshMap[u.userId] = u; });
        const existingMap = {};
        this._users.forEach(u => { existingMap[u.userId] = u; });

        // 原地更新已有用户
        for (const u of this._users) {
          const fresh = freshMap[u.userId];
          if (fresh) {
            for (const key of Object.keys(fresh)) {
              if (key === '_id') continue;
              if (JSON.stringify(u[key]) !== JSON.stringify(fresh[key])) {
                u[key] = fresh[key];
              }
            }
          }
        }
        // 添加新用户
        for (const fu of docs) {
          if (!existingMap[fu.userId]) this._users.push(fu);
        }
        // 移除已删除用户
        for (let i = this._users.length - 1; i >= 0; i--) {
          if (!freshMap[this._users[i].userId]) this._users.splice(i, 1);
        }

        if (this.currentChar) {
          const updated = this._users.find(u => u.userId === this.currentChar.userId);
          if (updated) this.currentChar = updated;
        }
      });

      console.log('[Store] 实时监听已启动 (作为轮询的额外增强)');
    } catch (e) {
      console.warn('[Store] 实时监听启动失败 (将仅依赖轮询):', e);
    }
  },

  // ===========================
  //  心跳 - 写入数据库 (共享在线状态)
  // ===========================
  _heartbeat() {
    if (!this.currentChar) return;
    const charId = this.currentChar.userId;
    const now = Date.now();

    // 更新本地 characterStates 的 lastSeen
    if (!this.gameState.characterStates[charId]) {
      this.gameState.characterStates[charId] = {};
    }
    this.gameState.characterStates[charId].lastSeen = now;

    // 写入数据库 (让其他客户端知道此玩家在线)
    DB.updateCharState(charId, { lastSeen: now }).catch(e => {
      console.warn('[Store] 心跳写入失败:', e);
    });
  },

  // ===========================
  //  内部工具
  // ===========================
  _toast(msg, kind = 'info') {
    const item = { id: Date.now() + Math.random(), msg, kind };
    this.notifications.push(item);
    setTimeout(() => {
      const i = this.notifications.indexOf(item);
      if (i >= 0) this.notifications.splice(i, 1);
    }, 4500);
  },

  // ===========================
  //  公共 API - 用户管理
  // ===========================

  getAllUsers() {
    return this._users;
  },

  findUser(userId) {
    return this._users.find(u => u.userId === userId) || null;
  },

  async login(userId, password) {
    await this._loadUsers();
    const user = this._users.find(u => u.userId === userId);
    if (!user) return { ok: false, msg: '角色不存在' };
    if (user.password !== password) return { ok: false, msg: '密码错误, 请重试' };
    this.currentChar = user;
    sessionStorage.setItem(SESSION_KEY, userId);
    // 立即写一次心跳并刷新在线状态
    this._heartbeat();
    this._refreshOnlineStatus();
    return { ok: true };
  },

  async register(userData) {
    const { name, role, password, description, title } = userData;
    if (!name || !name.trim()) return { ok: false, msg: '请填写角色名称' };
    if (!role) return { ok: false, msg: '请选择身份' };
    if (!password || password.length < 3) return { ok: false, msg: '密码至少 3 位' };

    await this._loadUsers();

    if (this._users.some(u => u.name === name.trim())) {
      return { ok: false, msg: '该名称已被使用, 请换一个' };
    }

    const roleCfg = ROLE_CONFIG[role];
    if (roleCfg && roleCfg.maxCount != null) {
      const currentCount = this._users.filter(u => u.role === role).length;
      if (currentCount >= roleCfg.maxCount) {
        return { ok: false, msg: '【' + roleCfg.label + '】名额已满 (上限 ' + roleCfg.maxCount + ' 人), 请选择其他身份' };
      }
    }

    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const color  = randomColor();
    const avatar = name.trim().charAt(0);
    const roleTitle = title || (ROLE_CONFIG[role]?.label + ' - 新成员');
    const group = ROLE_CONFIG[role]?.group || 'neutral';
    const baseStats = { ...(ROLE_BASE_STATS[group] || {}) };

    const newUser = {
      userId, isCustom: true, isPreset: false,
      name: name.trim(), role, avatar, color, password,
      title: roleTitle,
      description: description ? description.trim() : '',
      baseStats
    };

    await DB.upsertUser(newUser);

    const charState = makeCharState({ ...newUser, id: userId });
    await DB.upsertCharState(userId, charState);

    await this._loadUsers();
    await this._loadCharStates();

    return { ok: true, user: newUser };
  },

  async updateMyProfile(updates) {
    if (!this.currentChar) return { ok: false, msg: '未登录' };
    const userId = this.currentChar.userId;

    if (updates.newPassword) {
      if (updates.oldPassword !== this.currentChar.password) {
        return { ok: false, msg: '原密码错误' };
      }
      if (updates.newPassword.length < 3) {
        return { ok: false, msg: '新密码至少 3 位' };
      }
    }

    if (updates.name && updates.name.trim() !== this.currentChar.name) {
      if (this._users.some(u => u.userId !== userId && u.name === updates.name.trim())) {
        return { ok: false, msg: '该名称已被使用' };
      }
    }

    const dbUpdates = {};
    if (updates.name) {
      dbUpdates.name   = updates.name.trim();
      dbUpdates.avatar = updates.name.trim().charAt(0);
    }
    if (updates.description !== undefined) {
      dbUpdates.description = updates.description;
    }
    if (updates.newPassword) {
      dbUpdates.password = updates.newPassword;
    }

    await DB.updateUser(userId, dbUpdates);

    await this._loadUsers();
    this.currentChar = this._users.find(u => u.userId === userId) || this.currentChar;

    return { ok: true };
  },

  logout() {
    if (this.currentChar) {
      // 清除在线状态
      const charId = this.currentChar.userId;
      if (this.gameState.characterStates[charId]) {
        this.gameState.characterStates[charId].lastSeen = 0;
      }
      // 立即从在线缓存中移除并递增版本号
      delete this._onlineMap[charId];
      this._onlineVer++;
      DB.updateCharState(charId, { lastSeen: 0 }).catch(() => {});
    }
    this.currentChar = null;
    sessionStorage.removeItem(SESSION_KEY);
  },

  /** 判断是否在线 */
  isOnline(charId) {
    return !!this._onlineMap[charId];
  },

  /** 获取在线用户的缓存位置 */
  getOnlineLocation(charId) {
    const entry = this._onlineMap[charId];
    return entry ? entry : null;
  },

  /**
   * 刷新在线状态缓存
   * _onlineMap 格式: { charId: 'locationId' }
   * 只在在线/离线状态或位置真正变化时才更新, 并递增 _onlineVer
   */
  _refreshOnlineStatus() {
    const now = Date.now();
    const threshold = 30000;
    const states = this.gameState.characterStates;
    let changed = false;

    // 检查所有角色状态
    for (const charId of Object.keys(states)) {
      const cs = states[charId];
      const isNowOnline = cs && cs.lastSeen && (cs.lastSeen > now - threshold);
      const curLoc = cs?.currentLocation || 'activity';
      const wasEntry = this._onlineMap[charId]; // string (location) or undefined

      if (isNowOnline) {
        if (wasEntry !== curLoc) {
          // 新上线 或 位置变化
          this._onlineMap[charId] = curLoc;
          changed = true;
        }
      } else {
        if (wasEntry !== undefined) {
          // 下线
          delete this._onlineMap[charId];
          changed = true;
        }
      }
    }

    // 清理 _onlineMap 中已不存在于 states 的条目
    for (const charId of Object.keys(this._onlineMap)) {
      if (!states[charId]) {
        delete this._onlineMap[charId];
        changed = true;
      }
    }

    // 只在有实质变化时递增版本号 (触发依赖 _onlineVer 的 computed 更新)
    if (changed) {
      this._onlineVer++;
      console.log('[Store] 在线状态变化, ver:', this._onlineVer,
        '在线:', Object.keys(this._onlineMap).length, '人');
    }
  },

  getCharState(charId) {
    return this.gameState.characterStates[charId] || {};
  },

  // ===========================
  //  公共 API - 游戏功能
  // ===========================

  async sendMessage(content, locationId, isPrivate = false, targetId = null) {
    if (!this.currentChar || !content.trim()) return;
    const c = this.currentChar;
    const msg = {
      msgId:       Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      authorId:    c.userId,
      authorName:  c.name,
      authorRole:  c.role,
      authorAvatar: c.avatar,
      authorColor: c.color,
      location:    locationId,
      content:     content.trim(),
      isPrivate, targetId,
      timestamp:   new Date().toISOString()
    };

    // 乐观更新 (立即显示自己的消息)
    this.gameState.messages.push(msg);

    try {
      await DB.addMessage(msg);
    } catch (e) {
      console.error('[Store] 消息发送失败:', e);
      const idx = this.gameState.messages.indexOf(msg);
      if (idx >= 0) this.gameState.messages.splice(idx, 1);
      this._toast('消息发送失败, 请重试', 'warning');
    }
  },

  async sendAnnouncement(content, kind = 'info') {
    if (!this.currentChar || !content.trim()) return;
    const ts  = new Date().toISOString();
    const ann = {
      id: Date.now(), content: content.trim(), kind,
      authorName: this.currentChar.name, timestamp: ts
    };

    const announcements = [...(this.gameState.announcements || []), ann];
    if (announcements.length > 50) announcements.splice(0, announcements.length - 50);
    await DB.updateGameState({ announcements });

    const sysMsg = {
      msgId: 'ann_' + ann.id,
      authorId: 'system', authorName: '系统广播',
      authorRole: 'admin', authorAvatar: '播', authorColor: '#ff6b35',
      location: 'system', content: content.trim(),
      isPrivate: false, targetId: null, timestamp: ts
    };
    this.gameState.announcements = announcements;
    this.gameState.messages.push(sysMsg);
    await DB.addMessage(sysMsg);

    this._toast(content.trim(), kind);
  },

  async changeLocation(locationId) {
    if (!this.currentChar) return;
    const charId = this.currentChar.userId;
    await DB.updateCharState(charId, { currentLocation: locationId });
    if (this.gameState.characterStates[charId]) {
      this.gameState.characterStates[charId].currentLocation = locationId;
    }
    // 立即更新在线缓存中的位置并递增版本号
    if (this._onlineMap[charId] !== undefined) {
      this._onlineMap[charId] = locationId;
      this._onlineVer++;
    }
  },

  async advanceTime(minutes) {
    const m = parseInt(minutes) || 30;
    let gameMinute = (this.gameState.gameMinute || 0) + m;
    let gameHour   = this.gameState.gameHour   || 8;
    let gameDay    = this.gameState.gameDay    || 1;

    while (gameMinute >= 60) { gameMinute -= 60; gameHour++; }
    while (gameHour   >= 24) { gameHour   -= 24; gameDay++;  }

    await DB.updateGameState({ gameDay, gameHour, gameMinute });
    this.gameState.gameDay    = gameDay;
    this.gameState.gameHour   = gameHour;
    this.gameState.gameMinute = gameMinute;
  },

  async updateStat(charId, key, value) {
    const updates = {};
    updates[key] = value;
    await DB.updateCharState(charId, updates);
    if (!this.gameState.characterStates[charId]) {
      this.gameState.characterStates[charId] = {};
    }
    this.gameState.characterStates[charId][key] = value;
  },

  async addItem(charId, item) {
    const s = this.gameState.characterStates[charId];
    if (s) {
      const items = Array.isArray(s.items) ? [...s.items, item] : [item];
      await DB.updateCharState(charId, { items });
      s.items = items;
    }
  },

  async removeItem(charId, idx) {
    const s = this.gameState.characterStates[charId];
    if (s && Array.isArray(s.items)) {
      const items = [...s.items];
      items.splice(idx, 1);
      await DB.updateCharState(charId, { items });
      s.items = items;
    }
  },

  // ===========================
  //  私聊 & 偷听
  // ===========================

  getActivePrivateChats(location) {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const pairs  = new Map();
    this.gameState.messages.forEach(m => {
      if (m.location === location && m.isPrivate && m.targetId &&
          new Date(m.timestamp).getTime() > cutoff) {
        const key = [m.authorId, m.targetId].sort().join('~');
        if (!pairs.has(key)) {
          pairs.set(key, { p1: m.authorId, p2: m.targetId, key });
        }
      }
    });
    return [...pairs.values()];
  },

  tryEavesdrop(location, p1, p2) {
    if (!this.currentChar) return { roll: 0, threshold: 40, success: false };
    const roll      = Math.floor(Math.random() * 100) + 1;
    const threshold = 40;
    const success   = roll > threshold;
    if (success) {
      this.eavesdropGrants[this.currentChar.userId] = {
        p1, p2, location, expireAt: Date.now() + 10 * 60 * 1000
      };
    }
    return { roll, threshold, success };
  },

  canEavesdrop(p1, p2, location) {
    if (!this.currentChar) return false;
    const grant = this.eavesdropGrants[this.currentChar.userId];
    if (!grant || grant.expireAt < Date.now()) return false;
    if (grant.location !== location) return false;
    return (grant.p1 === p1 && grant.p2 === p2) ||
           (grant.p1 === p2 && grant.p2 === p1);
  },

  async clearMessages() {
    await DB.clearMessages();
    this.gameState.messages = [];
  },

  async resetGame() {
    if (!confirm('确定要重置所有游戏数据吗? 此操作不可撤销!\n将清空所有用户、消息、状态并重新初始化。')) return;
    DB.closeAllWatchers();
    await DB.resetAll();
    this.logout();
    location.reload();
  }
});
