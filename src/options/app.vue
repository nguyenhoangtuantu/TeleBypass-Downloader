<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
  import { useI18n } from 'vue-i18n';
  // import { useTheme } from 'vuetify'; // 暂时注释 - 主题切换功能
  import { useRoute, useRouter } from 'vue-router';
  import { authService } from '../services/auth.service';
  import { useAuthStore } from '../stores/auth.store';
  import { isProUser } from '../utils/subscription.utils';
  import type { UserInfo } from '../types/api.types';
  import AuthDialog from '../components/AuthDialog.vue';
  import { useLanguage } from '../utils/language-manager';
  import { supportedLanguages } from '../locales';

  const { t, locale } = useI18n();
  // const theme = useTheme(); // 暂时注释 - 主题切换功能
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();

  const { language, setLanguage } = useLanguage();

  // 左侧抽屉状态
  const drawer = ref(true);

  // 用户认证状态
  const isAuthenticated = ref(false);

  // 用户订阅信息
  const userSubscriptionInfo = ref<UserInfo | null>(null);

  // 身份验证对话框状态
  const authDialogVisible = ref(false);
  const authMode = ref<'login' | 'register' | 'reset-password'>('login');

  // 帮助弹窗状态
  const helpDialogVisible = ref(false);
  const supportEmail = 'support@tg-video-downloader.net';
  const isCopied = ref(false);

  // 检查用户认证状态
  const checkAuthStatus = async () => {
    // 优先从 chrome.storage 读取用户信息和 token（跨环境同步）
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.storage) {
      try {
        const result = await (window as any).chrome.storage.local.get(['user_info', 'access_token', 'auth_token']);

        const token = result.auth_token || result.access_token;
        if (result.user_info && token) {
          const storedUser = authService.parseStoredUserInfoRaw(result.user_info);
          if (!storedUser) {
            isAuthenticated.value = false;
            return;
          }

          // 更新 authStore 状态
          authStore.user = storedUser;
          authStore.isAuthenticated = true;
          isAuthenticated.value = true;

          // 重新初始化 authService，让它从 localStorage 加载数据
          await authService.init();
          return;
        }
      } catch (error) {
        console.error('Options: 从 chrome.storage 读取失败:', error);
      }
    }

    // 回退到原来的逻辑：检查 authService
    const authenticated = authService.isAuthenticated();
    isAuthenticated.value = authenticated;

    console.log('Options: authService 认证状态:', authenticated);

    if (authenticated) {
      // 从 authService 读取用户信息
      const storedUser = await authService.getStoredUserInfoAsync();
      if (storedUser) {
        authStore.user = storedUser;
        authStore.isAuthenticated = true;
        console.log('Options: 用户信息已从 authService 恢复:', storedUser);
      } else {
        console.warn('Options: 认证状态为true但未找到用户信息');
        isAuthenticated.value = false;
        authStore.user = null;
        authStore.isAuthenticated = false;
      }
    } else {
      // 如果未认证，清空用户数据
      authStore.user = null;
      authStore.isAuthenticated = false;
    }
  };

  // 获取用户订阅信息
  const fetchUserSubscription = async () => {
    if (!isAuthenticated.value) {
      userSubscriptionInfo.value = null;
      return;
    }

    try {
      const userData = await authService.syncUserProfileFromServer();
      if (!userData) {
        userSubscriptionInfo.value = null;
        return;
      }

      userSubscriptionInfo.value = {
        id: userData.id || userData.uid,
        email: userData.email,
        userName: userData.userName || userData.displayName,
        status: userData.status ?? 1,
        subscription_status: userData.subscription_status ?? 0,
        current_subscription: userData.current_subscription || null,
      } as UserInfo;

      authStore.user = userData;
      authStore.isAuthenticated = true;
    } catch (error) {
      console.error('Failed to fetch user subscription:', error);
      userSubscriptionInfo.value = null;
    }
  };

  // 打开登录对话框
  const openLoginDialog = () => {
    authMode.value = 'login';
    authDialogVisible.value = true;
  };

  // 打开注册对话框
  const openRegisterDialog = () => {
    authMode.value = 'register';
    authDialogVisible.value = true;
  };

  // 处理登录成功
  const handleLoginSuccess = async (user: any) => {
    console.log('Login successful:', user);
    authDialogVisible.value = false;
    await checkAuthStatus(); // 重新检查认证状态
    await fetchUserSubscription(); // 获取用户订阅信息
    // 可以显示成功消息或跳转到用户信息页面
    router.push('/options/user-info');
  };

  // 处理注册成功
  const handleRegisterSuccess = async (user: any) => {
    console.log('Registration successful:', user);
    authDialogVisible.value = false;
    await checkAuthStatus(); // 重新检查认证状态
    await fetchUserSubscription(); // 获取用户订阅信息
    // 可以显示成功消息或跳转到用户信息页面
    router.push('/options/user-info');
  };

  // 处理对话框关闭
  const handleAuthDialogClose = () => {
    authDialogVisible.value = false;
  };

  // 退出登录
  const handleLogout = async () => {
    try {
      await authService.logout();
      // 清空认证store和订阅信息
      authStore.user = null;
      isAuthenticated.value = false;
      userSubscriptionInfo.value = null;
      // 跳转到首页而不是登录页
      router.push('/options');
    } catch (error) {
      console.error('Logout failed:', error);
      // 即使退出失败，也清空本地状态
      authStore.user = null;
      isAuthenticated.value = false;
      userSubscriptionInfo.value = null;
      router.push('/options');
    }
  };

  // 菜单项配置
  const menuItems = computed(() => {
    const baseItems = [
      {
        title: t('options.menu.settings'),
        icon: 'mdi-view-dashboard',
        value: 'settings',
        route: '/options',
      },
    ];

    // 如果已登录，显示用户相关菜单
    if (isAuthenticated.value) {
      baseItems.push({
        title: t('options.menu.userInfo'),
        icon: 'mdi-account',
        value: 'user-info',
        route: '/options/user-info',
      });

      // 只有非VIP用户才显示pricing菜单
      const isPro = isProUser(userSubscriptionInfo.value);
      if (!isPro) {
        baseItems.push({
          title: t('options.menu.pricing'),
          icon: 'mdi-currency-usd',
          value: 'pricing',
          route: '/options/pricing',
        });
      }
    } else {
      baseItems.push({
        title: t('options.menu.login'),
        icon: 'mdi-login',
        value: 'login',
        route: '/options/login',
      });
    }

    // 通用菜单项
    baseItems.push({
      title: t('options.menu.faq'),
      icon: 'mdi-help-circle',
      value: 'faq',
      route: '/options/faq',
    });

    return baseItems;
  });

  // 当前选中的菜单项
  const selectedMenu = computed(() => {
    const currentPath = route.path;
    const item = menuItems.value.find((item) => item.route === currentPath);
    return item?.value || 'dashboard';
  });

  // 语言选项
  const languageOptions = supportedLanguages.map((lang) => ({
    title: lang.name,
    value: lang.code,
  }));

  // 当前语言
  const currentLanguage = computed({
    get: () => locale.value,
    set: (value: string) => {
      locale.value = value;
      // 保存到存储
      try {
        // 尝试使用Chrome扩展存储
        if ((window as any).chrome?.storage) {
          (window as any).chrome.storage.local.set({ language: value });
        }
      } catch {
        localStorage.setItem('language', value);
      }
    },
  });

  const onSwitchLanguage = async (lang: string) => {
    locale.value = lang;
    currentLanguage.value = lang;
    await setLanguage(lang);
  };

  watch(language, async (newLang) => {
    onSwitchLanguage(newLang);
  });

  // 处理菜单点击
  const handleMenuClick = (item: any) => {
    // 如果是登录菜单项，打开登录对话框
    if (item.value === 'login') {
      openLoginDialog();
    } else if (item.route) {
      router.push(item.route);
    }
  };

  // 打开修改密码对话框
  const openChangePasswordDialog = () => {
    authMode.value = 'reset-password';
    authDialogVisible.value = true;
  };

  // 处理修改密码成功
  const handleChangePasswordSuccess = () => {
    authDialogVisible.value = false;
    // 可选：显示成功提示或刷新用户信息
  };

  // 判断是否为仅重置密码模式（已登录用户修改密码）
  const isOnlyResetPassword = computed(() => {
    return isAuthenticated.value && authMode.value === 'reset-password';
  });

  // 用户信息（从认证服务获取真实数据）
  const userInfo = computed(() => {
    const authUser = authStore.user;
    if (!authUser) {
      return {
        name: t('common.guest'),
        avatar: '',
        plan: t('common.free'),
        isGuest: true,
      };
    }

    // 判断是否为 Pro 用户
    const isPro = isProUser(userSubscriptionInfo.value);

    return {
      name: authUser.email || authUser.displayName || t('common.user'),
      avatar: authUser.photoURL || '',
      plan: isPro ? t('common.pro') : t('common.free'),
      isGuest: false,
    };
  });

  // 获取用户名首字母
  const getUserInitials = (name: string) => {
    if (!name) return 'U';

    // 处理姓名 - 取首字母
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  // 打开帮助弹窗
  const openHelpDialog = () => {
    helpDialogVisible.value = true;
  };

  // 复制邮箱到剪贴板
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      isCopied.value = true;
      // 2秒后重置状态
      setTimeout(() => {
        isCopied.value = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // 降级方案：使用传统方法
      const textArea = document.createElement('textarea');
      textArea.value = supportEmail;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      isCopied.value = true;
      setTimeout(() => {
        isCopied.value = false;
      }, 2000);
    }
  };

  // 监听认证状态变化
  const handleAuthStateChange = async (message: any) => {
    if (message.type === 'auth-login-success' || message.type === 'auth-register-success' || message.type === 'subscription-success') {
      console.log('Options: 认证成功，刷新状态:', message.user);
      if (message.type === 'subscription-success') {
        await authService.syncUserProfileFromServer(true);
      }
      await checkAuthStatus();
      await fetchUserSubscription();
    } else if (message.type === 'auth-logout') {
      console.log('Options: 退出登录，刷新状态');
      await checkAuthStatus();
      userSubscriptionInfo.value = null;
    }
  };

  // 监听 storage 变化
  const handleStorageChange = async (changes: any, areaName: string) => {
    console.log('Options: storage 变化:', areaName, changes);

    if (areaName === 'local') {
      // 监听认证相关的变化
      if (changes.lastAuthUpdate || changes.user_info || changes.access_token || changes.auth_token) {
        await checkAuthStatus();
        await fetchUserSubscription();
      }
    }
  };

  onMounted(async () => {
    // 初始化认证服务
    await authService.init();
    // 检查认证状态（异步）
    await checkAuthStatus();
    // 获取用户订阅信息
    await fetchUserSubscription();

    // 监听认证消息
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
      (window as any).chrome.runtime.onMessage.addListener(handleAuthStateChange);
    }

    // 监听 storage 变化
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.storage) {
      (window as any).chrome.storage.onChanged.addListener(handleStorageChange);
    }
  });

  // 清理监听器
  onUnmounted(() => {
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
      (window as any).chrome.runtime.onMessage.removeListener(handleAuthStateChange);
    }
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.storage) {
      (window as any).chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  });
</script>

<template>
  <v-app>
    <!-- 应用栏 -->
    <v-app-bar :elevation="2" color="primary" density="comfortable">
      <v-app-bar-nav-icon @click="drawer = !drawer" />

      <v-app-bar-title>
        <v-icon icon="mdi-download" class="me-2" />
        {{ t('app.title') }}
      </v-app-bar-title>

      <v-spacer />

      <!-- 语言切换 -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn icon v-bind="props" class="me-3">
            <v-icon>mdi-translate</v-icon>
          </v-btn>
        </template>
        <v-list min-width="200">
          <v-list-item v-for="lang in languageOptions" :key="lang.value" :active="currentLanguage === lang.value" @click="onSwitchLanguage(lang.value)">
            <v-list-item-title>{{ lang.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- 主题切换 - 暂时注释 -->
      <!-- <v-btn icon @click="isDark = !isDark" class="me-3">
        <v-icon>{{ isDark ? 'mdi-brightness-7' : 'mdi-brightness-4' }}</v-icon>
      </v-btn> -->

      <!-- 用户菜单 -->
      <v-menu v-if="isAuthenticated">
        <template #activator="{ props }">
          <v-btn icon v-bind="props">
            <v-avatar size="32">
              <v-img v-if="userInfo.avatar" :src="userInfo.avatar" :alt="userInfo.name" />
              <span v-else class="text-body-2 font-weight-medium">{{ getUserInitials(userInfo.name) }}</span>
            </v-avatar>
          </v-btn>
        </template>
        <v-card min-width="220" elevation="8">
          <v-card-text class="pa-4">
            <div class="text-center">
              <v-avatar size="56" class="mb-4">
                <v-img v-if="userInfo.avatar" :src="userInfo.avatar" :alt="userInfo.name" />
                <span v-else class="text-h6 font-weight-medium">{{ getUserInitials(userInfo.name) }}</span>
              </v-avatar>
              <div class="mb-1 font-weight-medium text-body-1">
                {{ userInfo.name }}
              </div>
              <v-chip size="small" color="primary" variant="elevated">
                {{ userInfo.plan }}
              </v-chip>
            </div>
          </v-card-text>
          <v-divider />
          <v-card-actions class="pa-2">
            <v-btn block variant="text" color="primary" prepend-icon="mdi-lock-reset" @click="openChangePasswordDialog">
              {{ t('common.changePassword') || 'Change Password' }}
            </v-btn>
          </v-card-actions>
          <v-divider />
          <v-card-actions class="pa-2">
            <v-btn block variant="text" color="error" prepend-icon="mdi-logout" @click="handleLogout">
              {{ t('common.logout') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>

      <!-- 登录按钮 -->
      <v-btn v-else color="primary" variant="text" prepend-icon="mdi-login" @click="openLoginDialog">
        {{ t('common.login') }}
      </v-btn>
    </v-app-bar>

    <!-- 左侧导航抽屉 -->
    <v-navigation-drawer v-model="drawer" :permanent="$vuetify.display.mdAndUp" :temporary="$vuetify.display.smAndDown" width="300">
      <!-- 用户信息区域 -->
      <v-card v-if="isAuthenticated" flat class="mb-2 ma-4" variant="tonal" elevation="0">
        <v-card-text class="text-center pa-4">
          <v-avatar size="72" class="mb-4" color="primary">
            <v-img v-if="userInfo.avatar" :src="userInfo.avatar" :alt="userInfo.name" />
            <span v-else class="text-white text-h4 font-weight-medium">{{ getUserInitials(userInfo.name) }}</span>
          </v-avatar>
          <div class="mb-3 font-weight-medium text-h6">
            {{ userInfo.name }}
          </div>
          <v-chip size="small" color="primary" variant="elevated">
            {{ userInfo.plan }}
          </v-chip>
        </v-card-text>
      </v-card>

      <!-- 未登录状态 -->
      <v-card v-else flat class="mb-2 ma-4" variant="tonal" elevation="0">
        <v-card-text class="text-center pa-4">
          <v-avatar size="72" class="mb-4" color="grey-lighten-1">
            <span class="text-white text-h4 font-weight-medium">{{ getUserInitials('Guest') }}</span>
          </v-avatar>
          <div class="mb-3 text-h6">
            {{ t('options.auth.login.title') }}
          </div>
          <v-btn color="primary" variant="elevated" block @click="openLoginDialog">
            {{ t('common.login') }}
          </v-btn>
          <v-btn color="secondary" variant="outlined" block class="mt-2" @click="openRegisterDialog">
            {{ t('common.register') }}
          </v-btn>
        </v-card-text>
      </v-card>

      <v-divider class="mx-4 mb-4" />

      <!-- 导航菜单 -->
      <v-list :selected="[selectedMenu]" density="comfortable" nav class="px-2">
        <v-list-item
          v-for="item in menuItems"
          :key="item.value"
          :value="item.value"
          :title="item.title"
          :prepend-icon="item.icon"
          rounded="xl"
          class="mx-2 mb-2"
          @click="handleMenuClick(item)"
        />
      </v-list>

      <!-- 底部操作 -->
      <template #append>
        <v-divider class="mx-4 mb-4" />
        <v-card flat class="ma-4">
          <v-card-text class="px-0 py-0">
            <v-btn block variant="outlined" prepend-icon="mdi-help-circle" size="default" class="mb-2" @click="openHelpDialog">
              {{ t('options.help') }}
            </v-btn>
            <v-btn v-if="isAuthenticated" block variant="outlined" prepend-icon="mdi-lock-reset" size="default" class="mb-2" @click="openChangePasswordDialog">
              {{ t('common.changePassword') }}
            </v-btn>
            <v-btn v-if="isAuthenticated" block variant="text" prepend-icon="mdi-logout" size="small" color="error" @click="handleLogout">
              {{ t('options.logout') }}
            </v-btn>
          </v-card-text>
        </v-card>
      </template>
    </v-navigation-drawer>

    <!-- 主内容区域 -->
    <v-main>
      <v-container fluid class="pa-8">
        <RouterView />
      </v-container>
    </v-main>

    <!-- 身份验证对话框 -->
    <AuthDialog
      v-model:visible="authDialogVisible"
      :mode="authMode"
      :only-reset-password="isOnlyResetPassword"
      @login-success="handleLoginSuccess"
      @register-success="handleRegisterSuccess"
      @reset-success="handleChangePasswordSuccess"
      @close="handleAuthDialogClose"
    />

    <!-- 帮助弹窗 -->
    <v-dialog v-model="helpDialogVisible" max-width="520" persistent>
      <v-card class="rounded-3xl overflow-hidden shadow-2xl">
        <v-card-title class="flex items-center px-8 py-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <v-icon class="mr-4 text-blue-600" size="32"> mdi-help-circle </v-icon>
          <span class="text-xl font-semibold text-gray-800">{{ t('options.help') }}</span>
          <v-spacer />
        </v-card-title>

        <v-card-text class="px-8 py-8">
          <div class="text-center">
            <!-- 主图标 -->
            <div class="mb-8">
              <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full mb-6">
                <v-icon size="40" class="text-blue-600"> mdi-email-outline </v-icon>
              </div>
              <h3 class="text-2xl font-bold text-gray-800 mb-3">
                {{ t('options.helpDialog.title') }}
              </h3>
              <p class="text-gray-600 leading-relaxed max-w-sm mx-auto">
                {{ t('options.helpDialog.description') }}
              </p>
            </div>

            <!-- 邮箱显示和复制区域 -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6 border border-blue-100 shadow-sm">
              <div class="flex items-center justify-center mb-5">
                <div class="flex items-center bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                  <div class="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg mr-4 shadow-md">
                    <v-icon color="white" size="20"> mdi-email </v-icon>
                  </div>
                  <div class="text-left">
                    <div class="text-xs text-gray-500 font-medium mb-1">
                      {{ t('options.helpDialog.title') }}
                    </div>
                    <div class="text-base font-bold text-gray-800 select-all">
                      {{ supportEmail }}
                    </div>
                  </div>
                </div>
              </div>

              <v-btn
                :color="isCopied ? 'success' : 'primary'"
                :variant="isCopied ? 'flat' : 'elevated'"
                size="large"
                class="px-8 py-3 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                :class="isCopied ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'"
                @click="copyEmail"
              >
                <v-icon :icon="isCopied ? 'mdi-check-circle' : 'mdi-content-copy'" class="mr-2" size="20" />
                {{ isCopied ? t('options.helpDialog.copied') : t('options.helpDialog.copyButton') }}
              </v-btn>
            </div>

            <!-- 响应时间提示 -->
            <div class="flex items-center justify-center text-gray-500">
              <v-icon size="16" class="mr-2 text-green-500"> mdi-clock-outline </v-icon>
              <p class="text-sm font-medium">
                {{ t('options.helpDialog.responseTime') }}
              </p>
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="px-8 pb-8 pt-0">
          <v-spacer />
          <v-btn
            variant="text"
            size="large"
            class="px-6 py-2 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-200"
            @click="helpDialogVisible = false"
          >
            {{ t('options.helpDialog.close') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<style scoped>
  .v-app-bar {
    backdrop-filter: blur(10px);
  }

  .v-navigation-drawer {
    border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }

  :deep(.v-list-item--active) {
    color: rgb(var(--v-theme-primary));
    background-color: rgba(var(--v-theme-primary), 0.12);
  }

  :deep(.v-list-item--active .v-list-item__prepend > .v-icon) {
    color: rgb(var(--v-theme-primary));
  }

  /* 头像文字样式优化 */
  .v-avatar span {
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  /* 确保头像背景色在暗色主题下也显示正常 */
  .v-avatar:not(:has(img)) {
    background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-secondary)));
  }
</style>
