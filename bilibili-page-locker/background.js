// 默认启用状态
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('enabled', (data) => {
    if (data.enabled === undefined) {
      chrome.storage.sync.set({ enabled: true });
    }
  });
});

// 监听标签页更新，应用锁定
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('bilibili.com')) {
    // 获取当前启用状态
    chrome.storage.sync.get('enabled', ({ enabled = true }) => {
      if (!enabled) return;
      
      // 检查是否为需要锁定的页面
      const isLockedPage = (() => {
        try {
          const url = new URL(tab.url);
          const path = url.pathname;
          const search = url.search;
          const hostname = url.hostname;
          
          // 直播子域名处理：只放行直播间
          if (hostname === 'live.bilibili.com') {
            return !/\/room\/\d+/.test(path);
          }
          
          // 放行规则：
          // 1. 视频播放页：/video/BVxxxxxx 或 /video/avxxxxxx
          const isVideoPage = /^\/video\/(BV|av)[a-zA-Z0-9]+/.test(path);
          
          // 2. 搜索页：/search?q=xxx（包含 keyword= 参数）
          const isSearchPage = /^\/search/.test(path) && search.includes('keyword=');
          
          // 3. 个人空间：/space/ 或 /space/user_id
          const isSpacePage = /^\/space(\/|$)/.test(path);
          
          // 4. 动态：/dynamic/ 或 /dynamic/feed
          const isDynamicPage = /^\/dynamic(\/|$)/.test(path);
          
          // 5. 收藏夹：/space/user_id/favlist 或 /favlist
          const isFavlistPage = /\/favlist/.test(path) || /^\/space\/\d+\/favlist/.test(path);
          
          // 放行：视频页、搜索页、个人空间、动态、收藏夹
          const shouldAllow = isVideoPage || isSearchPage || isSpacePage || isDynamicPage || isFavlistPage;
          
          // 除了放行的页面，其他都锁定
          return !shouldAllow;
        } catch (e) {
          return false;
        }
      })();
      
      if (isLockedPage) {
        // 注入锁定脚本
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: applyLockPage,
          args: []
        });
      }
    });
  }
});

// 应用锁定页面的函数
function applyLockPage() {
  // 防止重复锁定
  if (document.body.dataset.lockState === 'locked') return;
  
  document.body.innerHTML = `
    <div style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
      background: #f9f9f9;
      padding: 100px 20px 0;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    ">
      <h1 style="color: #00a1d6; margin: 0; font-size: 2.5em;">⚠️ 页面已锁定</h1>
      <p style="font-size: 1.2em; margin: 20px 0; color: #555;">
        为专注内容，非视频/搜索/个人空间页面已被禁用
      </p>
      <p style="color: #888; margin-bottom: 30px;">
        请直接访问视频链接、搜索或个人空间
      </p>
      <div style="
        background: #e3f2fd;
        padding: 15px;
        border-radius: 8px;
        max-width: 500px;
        margin: 20px 0;
      ">
        <span style="font-weight: 500; color: #007bff;">💡 提示：</span>
        点击浏览器工具栏插件图标可随时关闭锁定
      </div>
      <button onclick="alert('锁定页面无法刷新！');" 
              style="
                background: #e0e0e0;
                color: #666;
                border: none;
                padding: 12px 30px;
                border-radius: 6px;
                cursor: not-allowed;
                font-size: 1.1em;
                opacity: 0.8;
              " disabled>
        刷新无效
      </button>
    </div>
  `;
  
  // 禁用F5刷新
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
      e.preventDefault();
      alert('锁定页面无法刷新！');
    }
  });
  
  // 禁用右键菜单
  document.addEventListener('contextmenu', (e) => {
    if (e.target === document.body) {
      e.preventDefault();
    }
  });
  
  document.body.dataset.lockState = 'locked';
}

// 监听存储变化，广播到所有B站页面
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.enabled) {
    const newState = changes.enabled.newValue;
    
    // 查询所有B站页面
    chrome.tabs.query({ url: '*://*.bilibili.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        try {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'LOCK_STATE_CHANGED', 
            enabled: newState 
          });
        } catch (e) {
          console.log('发送消息失败:', e);
        }
      });
    });
  }
});