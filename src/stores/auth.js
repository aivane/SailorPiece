import { defineStore } from 'pinia';
import { ref } from 'vue';
import { auth, googleProvider } from '../firebase/config';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const loading = ref(true);
  
  const ADMIN_EMAIL = 'tpkj220646@gmail.com';
  const isAdmin = ref(false);

  const initAuth = () => {
    onAuthStateChanged(auth, (currentUser) => {
      user.value = currentUser;
      isAdmin.value = currentUser?.email === ADMIN_EMAIL;
      loading.value = false;
    });
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login Failed:', error);
      alert('เข้าสู่ระบบไม่สำเร็จ: ' + error.message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout Failed:', error);
    }
  };

  return {
    user,
    isAdmin,
    loading,
    initAuth,
    loginWithGoogle,
    logout
  };
});
