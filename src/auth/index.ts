import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app.vue';
import vuetify from '../plugins/vuetify';
import { createI18nInstance } from '../plugins/i18n';

import '../assets/base.scss';
import './index.scss';

async function bootstrap() {
  const pinia = createPinia();
  const i18n = await createI18nInstance({ legacy: true });
  const app = createApp(App);

  app.use(pinia);
  app.use(vuetify);
  app.use(i18n);

  try {
    const { useAuthStore } = await import('../stores/auth.store');
    const authStore = useAuthStore();
    await authStore.initAuth();
  } catch {
    // ignore
  }

  app.mount('#auth-app');
}

bootstrap();
