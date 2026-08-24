// js/app.js — Vue 3 应用主逻辑（CloudBase 版）

const { createApp, computed, ref, watch, nextTick, onMounted } = Vue;

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

const app = createApp({
  setup() {

    // ───── 视图状态 ─────
    const view = ref('login');

    // ───── 登录 ─────
    const loginUserId  = ref('');
    const loginPwd     = ref('');
    const loginError   = ref('');
    const loginLoading = ref(false);

    // ───── 注册 ─────
    const regName      = ref('');
    const regRole      = ref('patient_open');
    const regTitle     = ref('');
    const regDesc      = ref('');
    const regPwd       = ref('');
    const regPwd2      = ref('');
    const regError     = ref('');
    const regLoading   = ref(false);

    // ───── 个人主页 ─────
    const profName     = ref('');
    const profDesc     = ref('');
    const profOldPwd   = ref('');
    const profNewPwd   = ref('');
    const profNewPwd2  = ref('');
    const profError    = ref('');
    const profSuccess  = ref('');
    const profExtra    = ref({});
    const profLoading  = ref(false);

    // ───── 主界面 ─────
    const activeLocation  = ref('activity');
    const activeRightTab  = ref('char');
    const msgText         = ref('');
    const isPrivate       = ref(false);
    const privateTarget   = ref('');
    const newItemText     = ref('');
    const annText         = ref('');
    const annKind         = ref('info');
    const adminTimeAdv    = ref(30);
    const adminEditKey    = ref('');
    const adminEditVal    = ref('');
    const adminEditTarget = ref('');
    const messagesEl      = ref(null);

    // ───── 私聊 Modal ─────
    const showPrivateModal   = ref(false);
    const privChatTarget     = ref('');
    const privChatMsg        = ref('');
    const privModalEl        = ref(null);

    // ───── 偷听 Modal ─────
    const showEavesdropModal = ref(false);
    const eavesdropPair      = ref(null);
    const eavesdropResult    = ref(null);
    const eavesdropRolling   = ref(false);
    const eavesdropDisplayNum= ref('?');

    // ───── 记事本 ─────
    const myNotes = ref('');
    const notesSaving = ref(false);
    const notesSaveStatus = ref(''); // 'saved', 'saving', 'unsaved'
    const notesSaveStatusText = computed(() => {
      if (notesSaveStatus.value === 'saving') return '⏳ 保存中...';
      if (notesSaveStatus.value === 'saved') return '✅ 已保存';
      if (notesSaveStatus.value === 'unsaved') return '● 未保存';
      return '';
    });
    let _notesTimer = null;

    function onNotesInput() {
      notesSaveStatus.value = 'unsaved';
      clearTimeout(_notesTimer);
      _notesTimer = setTimeout(() => { saveNotes(); }, 2000); // 2 秒自动保存
    }

    async function saveNotes() {
      if (!char.value || notesSaving.value) return;
      notesSaving.value = true;
      notesSaveStatus.value = 'saving';
      try {
        await store.updateStat(char.value.userId, 'notes', myNotes.value);
        notesSaveStatus.value = 'saved';
      } catch (e) {
        console.error('保存笔记失败:', e);
        notesSaveStatus.value = 'unsaved';
      } finally {
        notesSaving.value = false;
      }
    }

    function loadNotes() {
      if (!char.value) return;
      const cs = store.getCharState(char.value.userId);
      myNotes.value = cs?.notes || '';
      notesSaveStatus.value = cs?.notes ? 'saved' : '';
    }

    // ───── 应用初始化状态 ─────
    const appReady = ref(false);
    const initError = ref('');

    // ───── 计算属性 ─────
    // 注意：用户对象的 id 字段现在是 userId
    const char       = computed(() => store.currentChar);
    const charState  = computed(() => char.value ? store.getCharState(char.value.userId) : {});
    const roleConfig = computed(() => char.value ? (ROLE_CONFIG[char.value.role] || {}) : {});
    const roleGroup  = computed(() => roleConfig.value.group || 'neutral');
    const isAdmin    = computed(() => roleGroup.value === 'admin');
    const isStaff    = computed(() => roleGroup.value === 'staff' || roleGroup.value === 'admin');
    const isPatient  = computed(() => roleGroup.value === 'patient');

    const isDirectorProfile = computed(() =>
      char.value?.role === 'director' || char.value?.role === 'vice_director'
    );

    const currentRoleFields = computed(() =>
      (ROLE_EXTRA_FIELDS[char.value?.role]?.fields) || []
    );

    // 全部用户列表
    const allUsers = computed(() => store.getAllUsers());

    const visibleLocations = computed(() =>
      isStaff.value ? LOCATIONS : LOCATIONS.filter(l => l.access === 'all')
    );

    const locationMap = computed(() => {
      const m = {};
      LOCATIONS.forEach(l => { m[l.id] = l; });
      return m;
    });

    const currentLocation = computed(() => locationMap.value[activeLocation.value] || LOCATIONS[0]);

    // 主聊天区只显示公开消息
    const messages = computed(() =>
      store.gameState.messages.filter(m => {
        if (m.location === 'system') return true;
        if (m.location !== activeLocation.value) return false;
        return !m.isPrivate;
      })
    );

    // 当前私聊对话内容
    const privateChatMessages = computed(() => {
      if (!char.value || !privChatTarget.value) return [];
      const me = char.value.userId;
      const them = privChatTarget.value;
      const loc = activeLocation.value;
      return store.gameState.messages.filter(m =>
        m.isPrivate && m.location === loc &&
        ((m.authorId === me && m.targetId === them) ||
         (m.authorId === them && m.targetId === me))
      );
    });

    // 当前场景他人的活跃私聊
    const activePrivChatsInLoc = computed(() => {
      if (!char.value) return [];
      return store.getActivePrivateChats(activeLocation.value)
        .filter(p => p.p1 !== char.value.userId && p.p2 !== char.value.userId);
    });

    // 同场景在线玩家 (使用缓存的 location, 避免访问 characterStates 导致闪烁)
    const sameLocationChars = computed(() =>
      onlineList.value.filter(c =>
        c.userId !== char.value?.userId &&
        c.location === activeLocation.value
      )
    );

    // 偷听到的消息
    const eavesdroppedMsgs = computed(() => {
      if (!eavesdropPair.value || !char.value) return [];
      const { p1, p2, location } = eavesdropPair.value;
      if (!store.canEavesdrop(p1, p2, location)) return [];
      return store.gameState.messages.filter(m =>
        m.isPrivate && m.location === location &&
        ((m.authorId === p1 && m.targetId === p2) ||
         (m.authorId === p2 && m.targetId === p1))
      );
    });

    // 在线列表: 只依赖 _onlineVer (版本号) 和 _users
    // _onlineVer 只在有人真正上线/下线/换位置时才递增, 所以不会闪烁
    const onlineList = computed(() => {
      const ver = store._onlineVer; // 触发依赖跟踪
      const map = store._onlineMap;
      const result = [];
      for (const charId of Object.keys(map)) {
        const user = store._users.find(u => u.userId === charId);
        if (user) {
          result.push({
            userId: user.userId,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            color: user.color,
            title: user.title,
            location: map[charId] || 'activity'
          });
        }
      }
      return result;
    });

    const locationCounts = computed(() => {
      const ct = {};
      onlineList.value.forEach(c => { ct[c.location] = (ct[c.location] || 0) + 1; });
      return ct;
    });

    const otherOnlineChars = computed(() =>
      onlineList.value.filter(c => c.userId !== char.value?.userId)
    );

    const gameTimeStr = computed(() => {
      const g = store.gameState;
      return `第 ${g.gameDay} 天  ${pad2(g.gameHour)}:${pad2(g.gameMinute)}`;
    });

    const allCharStates = computed(() =>
      allUsers.value.map(c => ({
        ...c,
        id: c.userId,
        state: store.getCharState(c.userId)
      }))
    );

    const regRoleConfig = computed(() => ROLE_CONFIG[regRole.value] || {});

    const roleGroups = computed(() => [
      {
        label: '管理层',
        roles: [
          { id: 'director', label: '院长（限 1 人）', cfg: ROLE_CONFIG.director },
          { id: 'vice_director', label: '副院长（限 1 人）', cfg: ROLE_CONFIG.vice_director },
          { id: 'npc', label: 'NPC（限 2 人）', cfg: ROLE_CONFIG.npc },
        ]
      },
      {
        label: '医疗医护',
        roles: [
          { id: 'attending', label: '主治医师（限 3 人）', cfg: ROLE_CONFIG.attending },
          { id: 'doctor', label: '医生（限 6 人）', cfg: ROLE_CONFIG.doctor },
          { id: 'head_nurse', label: '护士长（限 1 人）', cfg: ROLE_CONFIG.head_nurse },
          { id: 'nurse', label: '护士（限 4 人）', cfg: ROLE_CONFIG.nurse },
          { id: 'therapist', label: '治疗师（限 2 人）', cfg: ROLE_CONFIG.therapist },
        ]
      },
      {
        label: '患者',
        roles: [
          { id: 'patient_open', label: '开放病区患者（限 7 人）', cfg: ROLE_CONFIG.patient_open },
          { id: 'patient_closed', label: '封闭病区患者（限 8 人）', cfg: ROLE_CONFIG.patient_closed },
          { id: 'patient_icu', label: '特护室患者（限 2 人）', cfg: ROLE_CONFIG.patient_icu },
          { id: 'escapee', label: '逃逸者（不限人数）', cfg: ROLE_CONFIG.escapee },
        ]
      },
      {
        label: '其他人员',
        roles: [
          { id: 'unknown', label: '不明身份者（限 1 人）', cfg: ROLE_CONFIG.unknown },
          { id: 'archivist', label: '档案管理员（限 1 人）', cfg: ROLE_CONFIG.archivist },
          { id: 'sec_captain', label: '安保队长（限 1 人）', cfg: ROLE_CONFIG.sec_captain },
          { id: 'security', label: '安保员（限 4 人）', cfg: ROLE_CONFIG.security },
          { id: 'logistics', label: '后勤（限 3 人）', cfg: ROLE_CONFIG.logistics },
          { id: 'family', label: '患者家属（限 2 人）', cfg: ROLE_CONFIG.family },
          { id: 'reporter', label: '调查记者（限 1 人）', cfg: ROLE_CONFIG.reporter },
          { id: 'vip_visitor', label: '神秘高层访客（限 1 人）', cfg: ROLE_CONFIG.vip_visitor },
        ]
      }
    ]);

    // ───── 登录操作 ─────
    function selectUser(id) { loginUserId.value = id; loginError.value = ''; }
    function selectedUserData() { return allUsers.value.find(u => u.userId === loginUserId.value) || null; }

    async function doLogin() {
      if (!loginUserId.value) { loginError.value = '请先选择一个角色'; return; }
      loginLoading.value = true;
      loginError.value = '';
      try {
        const res = await store.login(loginUserId.value, loginPwd.value);
        if (res.ok) {
          view.value = 'main';
          const cs = charState.value;
          if (cs?.currentLocation) activeLocation.value = cs.currentLocation;
          loadNotes();
        } else {
          loginError.value = res.msg;
        }
      } catch (e) {
        loginError.value = '登录失败：' + (e.message || '网络错误');
      } finally {
        loginLoading.value = false;
      }
    }

    function doLogout() {
      store.logout();
      view.value = 'login';
      loginPwd.value = '';
      loginError.value = '';
      loginUserId.value = '';
    }

    // ───── 注册操作 ─────
    function goRegister() {
      regName.value = ''; regRole.value = 'patient_open'; regTitle.value = '';
      regDesc.value = ''; regPwd.value = ''; regPwd2.value = ''; regError.value = '';
      view.value = 'register';
    }

    async function doRegister() {
      regError.value = '';
      if (!regName.value.trim()) { regError.value = '请填写角色名称'; return; }
      if (!regPwd.value || regPwd.value.length < 3) { regError.value = '密码至少 3 位'; return; }
      if (regPwd.value !== regPwd2.value) { regError.value = '两次密码不一致'; return; }

      regLoading.value = true;
      try {
        const res = await store.register({
          name: regName.value.trim(),
          role: regRole.value,
          title: regTitle.value.trim() || '',
          description: regDesc.value.trim(),
          password: regPwd.value
        });

        if (res.ok) {
          await store.login(res.user.userId, regPwd.value);
          view.value = 'main';
          const cs = charState.value;
          if (cs?.currentLocation) activeLocation.value = cs.currentLocation;
        } else {
          regError.value = res.msg;
        }
      } catch (e) {
        regError.value = '注册失败：' + (e.message || '网络错误');
      } finally {
        regLoading.value = false;
      }
    }

    // ───── 个人主页 ─────
    function openProfile() {
      if (!char.value) return;
      profName.value    = char.value.name;
      profDesc.value    = char.value.description || '';
      profOldPwd.value  = '';
      profNewPwd.value  = '';
      profNewPwd2.value = '';
      profError.value   = '';
      profSuccess.value = '';
      const cs = store.getCharState(char.value.userId);
      const fields = (ROLE_EXTRA_FIELDS[char.value.role]?.fields) || [];
      const extra = {};
      fields.forEach(f => { extra[f.key] = cs[f.key] ?? ''; });
      profExtra.value = extra;
      view.value = 'profile';
    }

    function closeProfile() { view.value = 'main'; }

    async function doSaveProfile() {
      profError.value   = '';
      profSuccess.value = '';

      const updates = {
        name:        profName.value.trim() || char.value.name,
        description: profDesc.value
      };

      if (profNewPwd.value) {
        if (profNewPwd.value !== profNewPwd2.value) {
          profError.value = '两次新密码不一致'; return;
        }
        updates.oldPassword = profOldPwd.value;
        updates.newPassword = profNewPwd.value;
      }

      profLoading.value = true;
      try {
        const res = await store.updateMyProfile(updates);
        if (res.ok) {
          // 保存角色专属字段到 charState
          const fields = (ROLE_EXTRA_FIELDS[char.value?.role]?.fields) || [];
          for (const f of fields) {
            await store.updateStat(char.value.userId, f.key, profExtra.value[f.key] ?? '');
          }
          profSuccess.value = '保存成功！';
          profOldPwd.value  = '';
          profNewPwd.value  = '';
          profNewPwd2.value = '';
        } else {
          profError.value = res.msg;
        }
      } catch (e) {
        profError.value = '保存失败：' + (e.message || '网络错误');
      } finally {
        profLoading.value = false;
      }
    }

    // ───── 场景切换 ─────
    function switchLocation(locId) {
      activeLocation.value = locId;
      store.changeLocation(locId); // async but fire-and-forget
      nextTick(scrollToBottom);
    }

    // ───── 聊天 ─────
    async function sendMsg() {
      const txt = msgText.value.trim();
      if (!txt) return;
      const target = (isPrivate.value && privateTarget.value) ? privateTarget.value : null;
      msgText.value = '';
      await store.sendMessage(txt, activeLocation.value, isPrivate.value && !!target, target);
      nextTick(scrollToBottom);
    }

    function onKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    }

    function togglePrivate() {
      isPrivate.value = !isPrivate.value;
      if (!isPrivate.value) privateTarget.value = '';
    }

    function scrollToBottom() {
      if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
    }

    // ───── 私聊 Modal ─────
    function openPrivateModal(targetId = '') {
      privChatTarget.value = targetId || '';
      privChatMsg.value    = '';
      showPrivateModal.value = true;
      nextTick(() => {
        if (privModalEl.value) privModalEl.value.scrollTop = privModalEl.value.scrollHeight;
      });
    }

    function closePrivateModal() {
      showPrivateModal.value = false;
      privChatTarget.value   = '';
      privChatMsg.value      = '';
    }

    async function sendPrivateMsg() {
      const txt = privChatMsg.value.trim();
      if (!txt || !privChatTarget.value) return;
      privChatMsg.value = '';
      await store.sendMessage(txt, activeLocation.value, true, privChatTarget.value);
      nextTick(() => {
        if (privModalEl.value) privModalEl.value.scrollTop = privModalEl.value.scrollHeight;
      });
    }

    function onPrivKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrivateMsg(); }
    }

    // ───── 偷听 Modal ─────
    function openEavesdropModal(pair) {
      eavesdropPair.value    = pair;
      eavesdropResult.value  = null;
      eavesdropRolling.value = false;
      eavesdropDisplayNum.value = '?';
      showEavesdropModal.value  = true;
    }

    function closeEavesdropModal() {
      showEavesdropModal.value = false;
      eavesdropResult.value    = null;
    }

    function doRollEavesdrop() {
      if (eavesdropRolling.value || !eavesdropPair.value) return;
      eavesdropRolling.value = true;
      eavesdropResult.value  = null;

      let count = 0;
      const intervalId = setInterval(() => {
        eavesdropDisplayNum.value = Math.floor(Math.random() * 100) + 1;
        count++;
        if (count >= 22) {
          clearInterval(intervalId);
          const { p1, p2, location } = eavesdropPair.value;
          const res = store.tryEavesdrop(location, p1, p2);
          eavesdropDisplayNum.value = res.roll;
          eavesdropResult.value     = res;
          eavesdropRolling.value    = false;
        }
      }, 65);
    }

    // ───── 物品 ─────
    async function addMyItem() {
      const t = newItemText.value.trim();
      if (!t || !char.value) return;
      newItemText.value = '';
      await store.addItem(char.value.userId, t);
    }

    async function removeMyItem(idx) {
      if (!char.value) return;
      await store.removeItem(char.value.userId, idx);
    }

    // ───── 管理员 ─────
    async function doAnnouncement() {
      const txt = annText.value.trim();
      if (!txt) return;
      annText.value = '';
      await store.sendAnnouncement(txt, annKind.value);
      nextTick(scrollToBottom);
    }

    async function doAdvanceTime() {
      await store.advanceTime(parseInt(adminTimeAdv.value) || 30);
    }

    async function doUpdateStat() {
      if (!adminEditTarget.value || !adminEditKey.value) return;
      const v = adminEditVal.value;
      const num = Number(v);
      const val = (v !== '' && !isNaN(num)) ? num : v;
      await store.updateStat(adminEditTarget.value, adminEditKey.value, val);
      store._toast(`已更新 ${adminEditTarget.value} · ${adminEditKey.value} = ${val}`, 'success');
      adminEditKey.value = '';
      adminEditVal.value = '';
    }

    // ───── 渲染辅助 ─────
    function msgAuthorColor(msg) {
      const c = allUsers.value.find(u => u.userId === msg.authorId);
      return c ? { color: c.color } : {};
    }

    function roleLabel(role)  { return ROLE_CONFIG[role]?.label || role; }
    function roleColor(role)  { return ROLE_CONFIG[role]?.color || '#8b949e'; }

    function annKindLabel(kind) {
      return { info: '通知', warning: '警告', alert: '紧急' }[kind] || kind;
    }
    function annCssClass(kind) {
      return { info: 'ann-info', warning: 'ann-warning', alert: 'ann-alert' }[kind] || 'ann-info';
    }
    function fmtAnn(iso) {
      const d = new Date(iso);
      return `第${store.gameState.gameDay}天 · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }

    // ───── 自动滚底 ─────
    watch(() => store.gameState.messages.length, () => {
      nextTick(scrollToBottom);
      if (showPrivateModal.value && privModalEl.value) {
        nextTick(() => { privModalEl.value.scrollTop = privModalEl.value.scrollHeight; });
      }
    });

    // ───── 初始化 ─────
    onMounted(async () => {
      try {
        await store.init();
        appReady.value = true;

        if (store.currentChar) {
          view.value = 'main';
          const cs = store.getCharState(store.currentChar.userId);
          if (cs?.currentLocation) activeLocation.value = cs.currentLocation;
          loadNotes();
        }
      } catch (e) {
        console.error('应用初始化失败:', e);
        initError.value = e.message || '初始化失败';
      } finally {
        const ls = document.getElementById('loading-screen');
        if (ls) ls.style.display = 'none';
        document.getElementById('app').style.display = 'block';
        nextTick(scrollToBottom);
      }
    });

    // ───── 暴露给模板 ─────
    return {
      view, appReady, initError,
      // 登录
      loginUserId, loginPwd, loginError, loginLoading,
      // 注册
      regName, regRole, regTitle, regDesc, regPwd, regPwd2, regError, regLoading,
      regRoleConfig, roleGroups,
      // 个人主页
      profName, profDesc,
      profOldPwd, profNewPwd, profNewPwd2, profError, profSuccess, profLoading,
      profExtra, currentRoleFields, isDirectorProfile,
      // 主界面
      activeLocation, activeRightTab,
      msgText, isPrivate, privateTarget, newItemText,
      annText, annKind, adminTimeAdv,
      adminEditKey, adminEditVal, adminEditTarget,
      messagesEl,

      // 私聊 & 偷听
      showPrivateModal, privChatTarget, privChatMsg, privModalEl,
      showEavesdropModal, eavesdropPair, eavesdropResult, eavesdropRolling, eavesdropDisplayNum,
      privateChatMessages, activePrivChatsInLoc, sameLocationChars, eavesdroppedMsgs,
      openPrivateModal, closePrivateModal, sendPrivateMsg, onPrivKeydown,
      openEavesdropModal, closeEavesdropModal, doRollEavesdrop,

      store, char, charState, roleConfig,
      roleGroup, isStaff, isAdmin, isPatient,
      allUsers,
      visibleLocations, locationMap, currentLocation,
      messages, onlineList, locationCounts, otherOnlineChars,
      gameTimeStr, allCharStates,

      CHARACTERS, LOCATIONS, ROLE_CONFIG, ROLE_EXTRA_FIELDS,

      selectUser, selectedUserData,
      doLogin, doLogout, goRegister, doRegister,
      openProfile, closeProfile, doSaveProfile,
      switchLocation, sendMsg, onKeydown, togglePrivate,
      addMyItem, removeMyItem,
      doAnnouncement, doAdvanceTime, doUpdateStat,

      // 记事本
      myNotes, notesSaving, notesSaveStatus, notesSaveStatusText,
      onNotesInput, saveNotes,

      msgAuthorColor, roleLabel, roleColor,
      annKindLabel, annCssClass, fmtAnn, fmtTime, pad2
    };
  }
});

app.mount('#app');
