import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const toasts = ref([]);
  const confirmDialog = ref({
    isOpen: false,
    message: '',
    resolve: null
  });

  // Unique ID generator for toasts
  let toastIdCounter = 0;

  // showToast: type can be 'info', 'success', 'warning', 'error'
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = toastIdCounter++;
    toasts.value.push({ id, message, type });
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  const removeToast = (id) => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  };

  // Replace default alert(...) 
  const showAlert = (message, type = 'info') => {
    // We treat alerts as toasts for a better UX, but usually an alert is meant to grab attention.
    // If it's an error, we give it a slightly longer duration.
    const duration = type === 'error' ? 5000 : 3000;
    showToast(message, type, duration);
  };

  // Replace default confirm(...) using Promise
  const showConfirm = (message) => {
    return new Promise((resolve) => {
      confirmDialog.value = {
        isOpen: true,
        message,
        resolve
      };
    });
  };

  const resolveConfirm = (result) => {
    if (confirmDialog.value.resolve) {
      confirmDialog.value.resolve(result);
    }
    confirmDialog.value.isOpen = false;
  };

  return {
    toasts,
    confirmDialog,
    showToast,
    removeToast,
    showAlert,
    showConfirm,
    resolveConfirm
  };
});
