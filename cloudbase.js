// js/cloudbase.js — CloudBase 数据库操作层
// ==========================================
// 封装所有 CloudBase 数据库的增删改查和实时监听
// ==========================================

const DB = {
  app: null,
  auth: null,
  db: null,
  _: null,           // db.command
  _watchers: [],     // 实时监听句柄
  _ready: false,

  // ===========================
  //  初始化
  // ===========================
  async init() {
    if (this._ready) return;

    const envId = CLOUDBASE_CONFIG.env;
    if (!envId || envId === 'your-env-id-here') {
      console.error('[CloudBase] 请先在 js/config.js 中填写你的环境 ID');
      alert('请先在 js/config.js 中配置 CloudBase 环境 ID！\n详见文件中的配置指南。');
      throw new Error('CloudBase env not configured');
    }

    // 初始化 CloudBase（兼容 v1 和 v2 API）
    console.log('[CloudBase] SDK 对象:', typeof cloudbase, Object.keys(cloudbase || {}));
    
    // v2 使用 cloudbase.init，v1 也使用 cloudbase.init
    this.app = cloudbase.init({
      env: envId,
      region: CLOUDBASE_CONFIG.region || 'ap-shanghai'
    });

    // 获取 auth 实例（兼容 v1 和 v2）
    this.auth = this.app.auth({
      persistence: 'local'
    });

    // 匿名登录（兼容 v1 和 v2 API）
    try {
      const loginState = await this.auth.getLoginState();
      if (!loginState) {
        // v2 API: signInAnonymously()
        if (typeof this.auth.signInAnonymously === 'function') {
          await this.auth.signInAnonymously();
          console.log('[CloudBase] 匿名登录成功 (v2 API)');
        }
        // v1 API: anonymousAuthProvider().signIn()
        else if (typeof this.auth.anonymousAuthProvider === 'function') {
          await this.auth.anonymousAuthProvider().signIn();
          console.log('[CloudBase] 匿名登录成功 (v1 API)');
        }
        else {
          throw new Error('未找到匿名登录方法，请检查 SDK 版本');
        }
      } else {
        console.log('[CloudBase] 已有登录态');
      }
    } catch (authErr) {
      console.error('[CloudBase] 登录失败:', authErr);
      throw new Error('匿名登录失败: ' + (authErr.message || authErr));
    }

    this.db = this.app.database();
    this._ = this.db.command;
    this._ready = true;
    console.log('[CloudBase] 数据库初始化完成');
  },

  // 获取集合引用
  col(name) {
    return this.db.collection(CLOUDBASE_CONFIG.collections[name] || name);
  },

  // ===========================
  //  用户相关
  // ===========================

  /** 获取所有用户 */
  async getAllUsers() {
    const res = await this.col('users').limit(1000).get();
    return res.data || [];
  },

  /** 根据 ID 获取用户 */
  async getUser(userId) {
    const res = await this.col('users').where({ userId: userId }).limit(1).get();
    return res.data?.[0] || null;
  },

  /** 创建/更新用户（upsert by userId） */
  async upsertUser(userData) {
    const existing = await this.getUser(userData.userId);
    if (existing) {
      await this.col('users').doc(existing._id).update(userData);
    } else {
      await this.col('users').add(userData);
    }
  },

  /** 批量写入用户（用于初始化预设角色） */
  async seedUsers(usersArray) {
    for (const u of usersArray) {
      const existing = await this.getUser(u.userId);
      if (!existing) {
        await this.col('users').add(u);
      }
    }
  },

  /** 更新用户字段 */
  async updateUser(userId, updates) {
    const existing = await this.getUser(userId);
    if (existing) {
      await this.col('users').doc(existing._id).update(updates);
    }
  },

  // ===========================
  //  消息相关
  // ===========================

  /** 获取消息（按时间排序，限制条数） */
  async getMessages(limit = 500) {
    const res = await this.col('messages')
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();
    return res.data || [];
  },

  /** 获取指定场景的消息 */
  async getMessagesByLocation(locationId, limit = 200) {
    const res = await this.col('messages')
      .where({
        location: this._.or(this._.eq(locationId), this._.eq('system'))
      })
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();
    return res.data || [];
  },

  /** 添加消息 */
  async addMessage(msgData) {
    await this.col('messages').add(msgData);
  },

  /** 清空所有消息 */
  async clearMessages() {
    // CloudBase 不支持批量删除全部，需要分批
    let hasMore = true;
    while (hasMore) {
      const res = await this.col('messages').limit(100).get();
      if (!res.data || res.data.length === 0) {
        hasMore = false;
        break;
      }
      const ids = res.data.map(d => d._id);
      for (const id of ids) {
        await this.col('messages').doc(id).remove();
      }
    }
  },

  // ===========================
  //  游戏状态相关
  // ===========================

  /** 获取游戏全局状态 */
  async getGameState() {
    const res = await this.col('gameState').where({ stateId: 'main' }).limit(1).get();
    return res.data?.[0] || null;
  },

  /** 初始化游戏状态 */
  async initGameState(stateData) {
    const existing = await this.getGameState();
    if (!existing) {
      await this.col('gameState').add({ stateId: 'main', ...stateData });
    }
    return await this.getGameState();
  },

  /** 更新游戏状态 */
  async updateGameState(updates) {
    const existing = await this.getGameState();
    if (existing) {
      await this.col('gameState').doc(existing._id).update(updates);
    }
  },

  // ===========================
  //  角色状态相关
  // ===========================

  /** 获取所有角色状态 */
  async getAllCharStates() {
    const res = await this.col('charStates').limit(1000).get();
    const map = {};
    (res.data || []).forEach(d => { map[d.charId] = d; });
    return map;
  },

  /** 获取单个角色状态 */
  async getCharState(charId) {
    const res = await this.col('charStates').where({ charId: charId }).limit(1).get();
    return res.data?.[0] || null;
  },

  /** 创建或更新角色状态 */
  async upsertCharState(charId, stateData) {
    const existing = await this.getCharState(charId);
    if (existing) {
      await this.col('charStates').doc(existing._id).update(stateData);
    } else {
      await this.col('charStates').add({ charId, ...stateData });
    }
  },

  /** 更新角色状态部分字段 */
  async updateCharState(charId, updates) {
    const existing = await this.getCharState(charId);
    if (existing) {
      await this.col('charStates').doc(existing._id).update(updates);
    } else {
      await this.col('charStates').add({ charId, ...updates });
    }
  },

  /** 批量初始化角色状态 */
  async seedCharStates(statesMap) {
    for (const [charId, state] of Object.entries(statesMap)) {
      const existing = await this.getCharState(charId);
      if (!existing) {
        await this.col('charStates').add({ charId, ...state });
      }
    }
  },

  // ===========================
  //  实时监听
  // ===========================

  /** 监听消息集合变化 */
  watchMessages(onChange) {
    const watcher = this.col('messages')
      .orderBy('timestamp', 'asc')
      .limit(500)
      .watch({
        onChange: (snapshot) => {
          onChange(snapshot.docs || [], snapshot.type);
        },
        onError: (err) => {
          console.error('[CloudBase] 消息监听错误:', err);
        }
      });
    this._watchers.push(watcher);
    return watcher;
  },

  /** 监听游戏状态变化 */
  watchGameState(onChange) {
    const watcher = this.col('gameState')
      .where({ stateId: 'main' })
      .watch({
        onChange: (snapshot) => {
          const doc = snapshot.docs?.[0];
          if (doc) onChange(doc);
        },
        onError: (err) => {
          console.error('[CloudBase] 游戏状态监听错误:', err);
        }
      });
    this._watchers.push(watcher);
    return watcher;
  },

  /** 监听角色状态变化 */
  watchCharStates(onChange) {
    const watcher = this.col('charStates')
      .limit(1000)
      .watch({
        onChange: (snapshot) => {
          const map = {};
          (snapshot.docs || []).forEach(d => { map[d.charId] = d; });
          onChange(map);
        },
        onError: (err) => {
          console.error('[CloudBase] 角色状态监听错误:', err);
        }
      });
    this._watchers.push(watcher);
    return watcher;
  },

  /** 监听用户集合变化 */
  watchUsers(onChange) {
    const watcher = this.col('users')
      .limit(1000)
      .watch({
        onChange: (snapshot) => {
          onChange(snapshot.docs || []);
        },
        onError: (err) => {
          console.error('[CloudBase] 用户监听错误:', err);
        }
      });
    this._watchers.push(watcher);
    return watcher;
  },

  /** 关闭所有监听 */
  closeAllWatchers() {
    this._watchers.forEach(w => {
      try { w.close(); } catch (e) { /* ignore */ }
    });
    this._watchers = [];
  },

  // ===========================
  //  数据重置
  // ===========================

  /** 清空指定集合 */
  async clearCollection(colName) {
    let hasMore = true;
    while (hasMore) {
      const res = await this.col(colName).limit(100).get();
      if (!res.data || res.data.length === 0) {
        hasMore = false;
        break;
      }
      for (const doc of res.data) {
        await this.col(colName).doc(doc._id).remove();
      }
    }
  },

  /** 重置全部数据 */
  async resetAll() {
    await this.clearCollection('messages');
    await this.clearCollection('gameState');
    await this.clearCollection('charStates');
    await this.clearCollection('users');
  }
};
