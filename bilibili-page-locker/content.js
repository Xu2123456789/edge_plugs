// 存储当前页面锁定状态
let lockCheckTimeout = null;
let isSpecialPage = false;

// 检查是否是特殊页面（首页/直播域名）
function checkIfSpecialPage() {
  const hostname = location.hostname;
  const path = location.pathname;
  
  // 首页、直播域名或空路径视为特殊页面
  isSpecialPage = (
    path === '/' || 
    path === '/index.html' || 
    path === '/index.php' ||
    hostname === 'live.bilibili.com'
  );
  
  return isSpecialPage;
}

// 监听来自插件的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LOCK_STATE_CHANGED') {
    handleLockStateChange(message.enabled);
  }
});

// 处理锁定状态变化
function handleLockStateChange(enabled) {
  // 特殊页面需要立即响应
  if (isSpecialPage) {
    if (enabled) {
      // 启用锁定：立即检查并应用
      if (shouldLockCurrentPage()) {
        applyLockPage();
      } else {
        // 特殊页面：1秒后再次检查（应对缓存/延迟加载）
        scheduleSpecialPageCheck(enabled);
      }
    } else {
      // 禁用锁定：如果当前页被锁定，立即重载
      if (isPageLocked()) {
        location.reload();
      } else {
        // 特殊页面：1秒后再次检查
        scheduleSpecialPageCheck(enabled);
      }
    }
  } else {
    // 普通页面正常处理
    if (enabled) {
      if (shouldLockCurrentPage()) {
        applyLockPage();
      }
    } else {
      if (isPageLocked()) {
        location.reload();
      }
    }
  }
}

// 特殊页面检查调度
function scheduleSpecialPageCheck(enabled) {
  clearTimeout(lockCheckTimeout);
  lockCheckTimeout = setTimeout(() => {
    if (enabled) {
      if (shouldLockCurrentPage() && !isPageLocked()) {
        applyLockPage();
      }
    } else {
      if (isPageLocked()) {
        location.reload();
      }
    }
  }, 1000);
}

// 检查当前页面是否应该锁定（放行：视频、搜索、个人空间、动态、收藏夹）
function shouldLockCurrentPage() {
  const path = location.pathname;
  const search = location.search;
  const hostname = location.hostname;
  
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
}

// 检查页面是否已被锁定（通过DOM特征）
function isPageLocked() {
  // 通过data属性检查
  if (document.body.dataset.lockState === 'locked') return true;
  
  // 通过DOM特征检查
  return document.querySelector('h1[style*="color: #00a1d6; margin: 0; font-size: 2.5em;"]') !== null;
}

// 应用锁定页面
function applyLockPage() {
  // 防止重复锁定
  if (isPageLocked()) return;
  
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

// 页面加载完成后检查初始状态
document.addEventListener('DOMContentLoaded', () => {
  // 首先检查是否是特殊页面
  checkIfSpecialPage();
  
  chrome.storage.sync.get('enabled', ({ enabled = true }) => {
    if (enabled && shouldLockCurrentPage()) {
      applyLockPage();
    }
    
    // 特殊页面：1秒后再次检查
    if (isSpecialPage) {
      setTimeout(() => {
        if (enabled && shouldLockCurrentPage() && !isPageLocked()) {
          applyLockPage();
        }
      }, 1000);
    }
  });
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  clearTimeout(lockCheckTimeout);
});

// 监听URL变化（SPA支持）
let currentPath = location.pathname;
let currentSearch = location.search;
let currentHost = location.hostname;
setInterval(() => {
  if (location.pathname !== currentPath || 
      location.search !== currentSearch || 
      location.hostname !== currentHost) {
    
    currentPath = location.pathname;
    currentSearch = location.search;
    currentHost = location.hostname;
    
    // 重新检查特殊页面
    checkIfSpecialPage();
    
    chrome.storage.sync.get('enabled', ({ enabled = true }) => {
      if (enabled) {
        if (shouldLockCurrentPage()) {
          applyLockPage();
        }
      } else {
        if (isPageLocked()) {
          location.reload();
        }
      }
    });
  }
}, 500);