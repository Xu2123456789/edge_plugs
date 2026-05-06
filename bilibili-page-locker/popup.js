document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle');
  const status = document.getElementById('status');

  // 读取当前状态
  chrome.storage.sync.get('enabled', ({ enabled }) => {
    // 默认启用
    const currentState = enabled !== undefined ? enabled : true;
    toggle.checked = currentState;
    updateStatus(currentState);
  });

  // 切换状态
  toggle.addEventListener('change', async () => {
    const newState = toggle.checked;
    
    // 保存状态
    await chrome.storage.sync.set({ enabled: newState });
    
    // 更新状态显示
    updateStatus(newState);
    
    // 通知所有B站页面更新状态
    try {
      const tabs = await chrome.tabs.query({ url: "*://www.bilibili.com/*" });
      
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { 
            action: 'LOCK_STATE_CHANGED', 
            enabled: newState 
          });
        } catch (e) {
          console.log('发送消息到标签页失败:', tab.id, e);
        }
      }
      
      console.log('状态已广播到', tabs.length, '个B站页面');
    } catch (e) {
      console.error('查询标签页失败:', e);
    }
  });

  function updateStatus(enabled) {
    status.textContent = enabled 
      ? "✅ 已启用（导航页将锁定）" 
      : "❌ 已禁用（刷新页面生效）";
    
    status.className = `status ${enabled ? 'enabled' : 'disabled'}`;
  }
});