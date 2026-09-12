import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import routes from '~pages';
import '../assets/base.scss';
import '../my-styles.scss';
import vuetify from '../plugins/vuetify';
import { createI18nInstance } from '../plugins/i18n';
import { useAuthStore } from '../stores/auth.store';
import App from './app.vue';
import './index.scss';

routes.push({
  path: '/',
  redirect: '/options',
});

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const pinia = createPinia();

// 异步初始化应用
async function initApp() {
  const i18n = await createI18nInstance();

  const app = createApp(App);

  // 确保 Pinia 首先安装
  // 确保 Pinia 已安装并初始化认证存储
  app.use(pinia);
  try {
    const authStore = useAuthStore();
    await authStore.initAuth();
    // 设置全局认证事件监听（包括 chrome.storage 监听）
    authStore.setupGlobalAuthEvents();
  } catch {
    // ignore
  }
  app.use(router);
  app.use(vuetify);
  app.use(i18n);

  app.mount('#app');
}

initApp();

self.onerror = function (message, source, lineno, colno, error) {
  console.info(`Error: ${message}\nSource: ${source}\nLine: ${lineno}\nColumn: ${colno}\nError object: ${error}`);
};
