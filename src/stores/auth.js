import { defineStore } from 'pinia';
import { ref } from 'vue';
import { auth, googleProvider, db } from '../firebase/config';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import router from '../router';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const loading = ref(true);
  const userProfile = ref({ robloxName: '', tiktokName: '', virtualWallet: 0 });
  
  const ADMIN_EMAIL = 'tpkj220646@gmail.com';
  const isAdmin = ref(false);

  const initAuth = () => {
    onAuthStateChanged(auth, async (currentUser) => {
      user.value = currentUser;
      isAdmin.value = currentUser?.email === ADMIN_EMAIL;
      
      if (currentUser) {
        try {
          // Fetch or Create user profile
          const userRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            userProfile.value = { 
              robloxName: docSnap.data().robloxName || '', 
              tiktokName: docSnap.data().tiktokName || '', 
              virtualWallet: docSnap.data().virtualWallet || 0 
            };
          } else {
            // Initialize empty profile
            const initialProfile = { robloxName: '', tiktokName: '', virtualWallet: 0 };
            await setDoc(userRef, initialProfile);
            userProfile.value = initialProfile;
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          userProfile.value = { robloxName: '', tiktokName: '', virtualWallet: 0 }; // Fallback
        }
      } else {
         userProfile.value = { robloxName: '', tiktokName: '', virtualWallet: 0 };
      }
      
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
      router.push('/');
    } catch (error) {
      console.error('Logout Failed:', error);
    }
  };

  const updateProfile = async (robloxName, tiktokName) => {
    if (!user.value) return;
    try {
      const userRef = doc(db, 'users', user.value.uid);
      await updateDoc(userRef, { robloxName, tiktokName });
      userProfile.value.robloxName = robloxName;
      userProfile.value.tiktokName = tiktokName;
    } catch (error) {
      console.error('Update Profile Failed:', error);
      throw error;
    }
  };
  
  const adjustWallet = async (uid, amount) => {
    try {
      const userRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
         return { success: false, message: 'ไม่พบผู้ใช้ที่ตรงกับ UID นี้' };
      }
      await updateDoc(userRef, {
         virtualWallet: increment(amount)
      });
      return { success: true, message: 'ทำรายการสำเร็จ' };
    } catch (error) {
      console.error('Adjust Wallet Failed:', error);
      return { success: false, message: error.message };
    }
  };

  return {
    user,
    userProfile,
    isAdmin,
    loading,
    initAuth,
    loginWithGoogle,
    logout,
    updateProfile,
    adjustWallet
  };
});
