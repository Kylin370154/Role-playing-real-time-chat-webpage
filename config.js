// js/config.js — CloudBase 配置
// ==========================================
// 请在此处填写你的腾讯云 CloudBase 环境 ID
// 登录 https://console.cloud.tencent.com/tcb 创建环境后获取
// ==========================================

const CLOUDBASE_CONFIG = {
  // ★★★ 必填：你的 CloudBase 环境 ID ★★★
  env: 'hospital-7glw7f85b9f65571',

  // 可选：区域，默认 ap-shanghai
  region: 'ap-shanghai',

  // 数据库集合名称（一般不需要修改）
  collections: {
    users:      'users',       // 用户账号（预设 + 注册）
    messages:   'messages',    // 聊天消息
    gameState:  'game_state',  // 游戏全局状态（时间、公告）
    charStates: 'char_states'  // 角色状态（属性、背包、位置）
  }
};

/*
  ═══════════════════════════════════════════════════
  CloudBase 控制台配置指南
  ═══════════════════════════════════════════════════

  1. 前往 https://console.cloud.tencent.com/tcb 创建环境
     - 选择「按量计费」模式（有免费额度）

  2. 开启匿名登录：
     - 进入「环境」→「登录授权」
     - 开启「匿名登录」

  3. 创建数据库集合：
     - 进入「数据库」→ 创建以下集合：
       · users
       · messages
       · game_state
       · char_states

  4. 设置安全规则：
     - 进入「数据库」→「安全规则」
     - 对每个集合设置为：
       {
         "read": true,
         "write": true
       }
     注意：此设置允许所有人读写，适合内部 RP 使用。
     如需更严格的权限，请参考 CloudBase 文档。

  5. 添加安全域名：
     - 进入「环境」→「安全配置」→「Web安全域名」
     - 添加你的域名（如 localhost 用于本地测试）

  ═══════════════════════════════════════════════════
*/
