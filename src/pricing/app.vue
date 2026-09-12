<script setup lang="ts">
  import { onMounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import PricingPanel from './components/PricingPanel.vue';

  // Chrome API 类型声明
  declare const chrome: any;

  const { locale } = useI18n();

  const handleClose = () => {
    // 关闭窗口
    window.close();
  };

  const handleUpgradeSuccess = () => {
    // 升级成功，发送消息到 background service worker
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'subscription-success' }, (response: any) => {
        console.log('Subscription success message sent', response);
      });
    }
    // 升级成功，可以关闭窗口或显示成功消息
    setTimeout(() => {
      window.close();
    }, 1000);
  };

  // 监听认证成功事件
  const handleSubscriptionMessage = (message: any) => {
    if (message?.type === 'close-pricing-windows') {
      handleClose();
    }
  };

  // 从 URL 参数获取语言设置
  onMounted(async () => {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    if (lang) {
      locale.value = lang;
    } else {
      // 从 chrome.storage 加载语言设置
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          const result = await chrome.storage.local.get(['language']);
          if (result.language) {
            locale.value = result.language;
          }
        } catch (error) {
          console.warn('Failed to load language setting:', error);
        }
      }
    }

    // 监听认证消息
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
      (window as any).chrome.runtime.onMessage.addListener(handleSubscriptionMessage);
    }
  });
</script>

<template>
  <v-app>
    <v-main class="pricing-page">
      <PricingPanel @close="handleClose" @upgrade-success="handleUpgradeSuccess" />
    </v-main>
  </v-app>
</template>

<style scoped>
  .pricing-page {
    min-height: 100vh;
    background: linear-gradient(to bottom, rgba(var(--v-theme-surface), 0.5), rgba(var(--v-theme-surface), 1));
  }
</style>
