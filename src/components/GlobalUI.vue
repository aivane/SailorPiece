<script setup>
import { useUiStore } from '../stores/ui';
import { storeToRefs } from 'pinia';
import { X, CheckCircle2, AlertCircle, Info, HelpCircle } from 'lucide-vue-next';

const uiStore = useUiStore();
const { toasts, confirmDialog } = storeToRefs(uiStore);

const getIcon = (type) => {
  switch(type) {
    case 'success': return CheckCircle2;
    case 'error': return AlertCircle;
    case 'warning': return AlertCircle;
    default: return Info;
  }
};

const getColorClass = (type) => {
  switch(type) {
    case 'success': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'error': return 'bg-red-50 text-red-800 border-red-200';
    case 'warning': return 'bg-amber-50 text-amber-800 border-amber-200';
    default: return 'bg-blue-50 text-blue-800 border-blue-200';
  }
};

const getIconColorClass = (type) => {
  switch(type) {
    case 'success': return 'text-emerald-500';
    case 'error': return 'text-red-500';
    case 'warning': return 'text-amber-500';
    default: return 'text-blue-500';
  }
};
</script>

<template>
  <div>
    <!-- TOASTS CONTAINER -->
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
      <TransitionGroup name="toast" tag="div" class="flex flex-col gap-2">
        <div 
          v-for="toast in toasts" 
          :key="toast.id" 
          :class="['pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-300', getColorClass(toast.type)]"
        >
          <component :is="getIcon(toast.type)" :class="['w-5 h-5 shrink-0 mt-0.5', getIconColorClass(toast.type)]" />
          <div class="flex-grow font-medium text-sm pr-4">{{ toast.message }}</div>
          <button @click="uiStore.removeToast(toast.id)" class="shrink-0 p-1 hover:bg-black/5 rounded-md transition-colors -mr-2 -mt-1 opacity-60 hover:opacity-100">
            <X class="w-4 h-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>

    <!-- CONFIRM MODAL -->
    <Transition name="fade">
      <div v-if="confirmDialog.isOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="uiStore.resolveConfirm(false)"></div>
        <div class="bg-white rounded-2xl w-full max-w-sm relative z-10 overflow-hidden shadow-2xl flex flex-col scale-100 transition-transform">
          <div class="p-6 text-center space-y-4">
            <div class="w-16 h-16 bg-blue-50 text-blue-500 mx-auto rounded-full flex items-center justify-center mb-2">
               <HelpCircle class="w-8 h-8" />
            </div>
            <h3 class="text-xl font-bold text-slate-800">ยืนยันการทำรายการ</h3>
            <p class="text-slate-600 text-sm whitespace-pre-line">{{ confirmDialog.message }}</p>
          </div>
          <div class="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-center">
            <button @click="uiStore.resolveConfirm(false)" class="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
               ยกเลิก
            </button>
            <button @click="uiStore.resolveConfirm(true)" class="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-brand hover:bg-brand-dark transition-colors shadow-sm">
               ยืนยัน
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100px) scale(0.9);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100px) scale(0.9);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-active .scale-100 {
  animation: bounce-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes bounce-in {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
