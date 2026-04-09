<script setup>
import { RouterView, RouterLink } from 'vue-router'
import { ShoppingBag, LayoutDashboard, Store, LogOut } from 'lucide-vue-next'
import { useAuthStore } from './stores/auth'
import { storeToRefs } from 'pinia'

const authStore = useAuthStore()
const { user, isAdmin, loading } = storeToRefs(authStore)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-brand-light font-sans text-slate-800">
    <nav class="bg-white shadow-sm sticky top-0 z-50">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <RouterLink to="/" class="flex items-center gap-2 text-brand-dark font-bold text-xl">
              <Store class="w-6 h-6 text-brand" />
              <span>SailorPiece</span>
            </RouterLink>
          </div>
          <div class="flex items-center space-x-2 sm:space-x-4">
            <RouterLink to="/" class="text-slate-500 hover:text-brand-dark px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 transition-colors">
              <ShoppingBag class="w-4 h-4 hidden sm:block" /> Shop
            </RouterLink>
            <RouterLink to="/queue" class="text-slate-500 hover:text-brand-dark px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 transition-colors">
               คิวของฉัน
            </RouterLink>
            <RouterLink v-if="isAdmin" to="/admin" class="text-slate-500 hover:text-brand-dark px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 transition-colors">
              <LayoutDashboard class="w-4 h-4 hidden sm:block" /> Admin
            </RouterLink>
            
            <div class="h-6 w-px bg-slate-200 mx-2"></div>
            
            <div v-if="loading" class="w-20 h-8 bg-slate-100 rounded animate-pulse"></div>
            <div v-else-if="user" class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <img :src="user.photoURL" class="w-8 h-8 rounded-full border border-slate-200" />
                <span class="text-sm font-medium hidden sm:block">{{ user.displayName?.split(' ')[0] }}</span>
              </div>
              <button @click="authStore.logout" class="text-slate-400 hover:text-red-500 transition-colors p-1" title="ออกจากระบบ">
                <LogOut class="w-5 h-5" />
              </button>
            </div>
            <button v-else @click="authStore.loginWithGoogle" class="flex items-center gap-2 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <img src="https://www.google.com/favicon.ico" class="w-4 h-4" />
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    </nav>

    <main class="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <RouterView />
    </main>
    
    <footer class="bg-white py-6 border-t border-slate-100 mt-auto">
      <p class="text-center text-slate-400 text-sm">© 2026 SailorPiece - Simple Commerce & Queue</p>
    </footer>
  </div>
</template>

<style>
.router-link-exact-active {
  @apply text-brand font-semibold;
}
</style>
