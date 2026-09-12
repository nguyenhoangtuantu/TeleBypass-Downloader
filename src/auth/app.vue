<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';
  import AuthDialog from '../components/AuthDialog.vue';

  declare const chrome: any;

  const authMode = ref<'login' | 'register' | 'reset-password'>('login');
  const { locale } = useI18n();

  onMounted(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode === 'register') {
      authMode.value = 'register';
    } else if (mode === 'reset-password' || mode === 'reset') {
      authMode.value = 'reset-password';
    }

    const lang = urlParams.get('lang');
    if (lang) {
      locale.value = lang;
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get(['language']);
        if (result.language) {
          locale.value = result.language;
        }
      } catch {
        // ignore
      }
    }
  });

  const closeWindow = () => {
    // 通知打开者关闭窗口
    if (window.opener) {
      window.opener.postMessage({ type: 'auth-window-closed' }, '*');
    }

    // 关闭当前窗口或标签页
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.getCurrent((tab: any) => {
        if (tab?.id) {
          chrome.tabs.remove(tab.id);
        }
      });
    } else {
      window.close();
    }
  };

  const handleLoginSuccess = (user: any) => {
    // 通知打开者登录成功
    if (window.opener) {
      window.opener.postMessage({ type: 'auth-login-success', user }, '*');
    }

    // 触发全局事件
    chrome.runtime.sendMessage({
      type: 'auth-login-success',
      user,
    });

    // 延迟关闭，确保消息发送成功
    setTimeout(() => {
      closeWindow();
    }, 500);
  };

  const handleRegisterSuccess = (user: any) => {
    // 通知打开者注册成功
    if (window.opener) {
      window.opener.postMessage({ type: 'auth-register-success', user }, '*');
    }

    // 触发全局事件
    chrome.runtime.sendMessage({
      type: 'auth-register-success',
      user,
    });

    // 延迟关闭，确保消息发送成功
    setTimeout(() => {
      closeWindow();
    }, 500);
  };

  const handleResetSuccess = () => {
    // 密码重置成功后不关闭窗口，让用户继续在登录页面操作
    // 通知打开者密码重置成功
    if (window.opener) {
      window.opener.postMessage({ type: 'auth-reset-success' }, '*');
    }

    // 触发全局事件
    chrome.runtime.sendMessage({
      type: 'auth-reset-success',
    });

    // 不再关闭窗口，让用户可以使用新密码登录
    // setTimeout(() => {
    //   closeWindow();
    // }, 500);
  };

  const handleDialogClose = (visible: boolean) => {
    if (!visible) {
      closeWindow();
    }
  };
</script>

<template>
  <div class="auth-window-container">
    <AuthDialog
      :visible="true"
      :mode="authMode"
      :show-close-button="true"
      :persistent="false"
      @loginSuccess="handleLoginSuccess"
      @registerSuccess="handleRegisterSuccess"
      @resetSuccess="handleResetSuccess"
      @update:visible="handleDialogClose"
    />
  </div>
</template>

<style scoped>
  .auth-window-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    animation: containerFadeIn 0.6s ease-out;
  }

  @keyframes containerFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* 深度样式优化 - 确保对话框平滑显示 */
  :deep(.v-dialog) {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :deep(.v-card) {
    border-radius: 16px !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :deep(.v-card:hover) {
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.15) !important;
  }

  /* 输入框动画优化 */
  :deep(.v-text-field) {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :deep(.v-text-field:focus-within) {
    transform: translateY(-2px);
  }

  /* 按钮动画优化 */
  :deep(.v-btn) {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  :deep(.v-btn:hover:not(:disabled)) {
    transform: translateY(-2px);
  }

  :deep(.v-btn:active:not(:disabled)) {
    transform: translateY(0);
  }

  /* 加载动画优化 */
  :deep(.v-progress-circular) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
