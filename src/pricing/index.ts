import { createApp } from 'vue';
import App from './app.vue';
import vuetify from '../plugins/vuetify';
import { createI18nInstance } from '../plugins/i18n';
import './index.scss';

async function bootstrap() {
  const app = createApp(App);
  const i18n = await createI18nInstance({ legacy: true });

  app.use(vuetify);
  app.use(i18n);
  app.mount('#app');
}

bootstrap();
