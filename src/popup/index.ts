import { createApp } from 'vue';
import App from './app.vue';
import './index.scss';

// 异步初始化应用
async function initApp() {
  const app = createApp(App);

  app.mount('#app');
}

initApp();

chrome.tabs.query({ active: !0 }, (e) => {
  if (!e[0]?.url?.includes('web.telegram.org')) {
    chrome.tabs.create({ url: 'https://web.telegram.org/k' });
  }
});
