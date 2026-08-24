// js/loader.js — ES Module 入口，加载 CloudBase SDK v2 后再加载应用脚本
// 使用 jsdelivr 的 ESM 转换服务加载 @cloudbase/js-sdk

async function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('加载脚本失败: ' + src));
    document.body.appendChild(s);
  });
}

try {
  // 动态导入 CloudBase JS SDK v2（使用 esm.sh CDN）
  const module = await import('https://esm.sh/@cloudbase/js-sdk@2.9.8');
  const cloudbase = module.default || module.cloudbase || module;
  window.cloudbase = cloudbase;
  console.log('[Loader] CloudBase SDK v2 加载成功', cloudbase);

  // 按顺序加载应用脚本
  await loadScript('js/cloudbase.js');
  console.log('[Loader] cloudbase.js 加载完成');
  await loadScript('js/store.js');
  console.log('[Loader] store.js 加载完成');
  await loadScript('js/app.js');
  console.log('[Loader] app.js 加载完成');

} catch (e) {
  console.error('[Loader] 加载失败:', e);
  // 显示错误信息
  const ls = document.getElementById('loading-screen');
  if (ls) {
    ls.innerHTML = `
      <div style="text-align:center;padding:40px;color:#f85149">
        <div style="font-size:48px;margin-bottom:20px">?</div>
        <div style="font-size:18px;font-weight:bold;margin-bottom:12px">SDK 加载失败</div>
        <div style="font-size:13px;color:#8b949e;max-width:500px;margin:0 auto;line-height:1.8">
          ${e.message || e}<br><br>
          请检查网络连接，或尝试刷新页面。
        </div>
        <button onclick="location.reload()" style="margin-top:20px;padding:8px 32px;background:#4e9ae1;color:#fff;border:none;border-radius:6px;cursor:pointer">重试</button>
      </div>
    `;
  }
}
