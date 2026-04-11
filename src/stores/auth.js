import { defineStore } from 'pinia';
import { ref } from 'vue';
import { auth, googleProvider, db } from '../firebase/config';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import router from '../router';
import { useUiStore } from './ui';

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
            // Keep google info fresh in the DB for admin
            await updateDoc(userRef, {
              displayName: currentUser.displayName || '',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || ''
            });
          } else {
            // Initialize empty profile
            const initialProfile = { 
               robloxName: '', 
               tiktokName: '', 
               virtualWallet: 0,
               displayName: currentUser.displayName || '',
               email: currentUser.email || '',
               photoURL: currentUser.photoURL || ''
            };
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
      useUiStore().showAlert('เข้าสู่ระบบไม่สำเร็จ: ' + error.message, 'error');
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
    if (!uid || typeof amount !== 'number' || isNaN(amount) || amount === 0) {
      return { success: false, message: 'ข้อมูลระบุตัวตน หรือจำนวนหน่วยไม่ถูกต้อง' };
    }
    try {
      const userRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
         return { success: false, message: 'ไม่พบผู้ใช้ที่ตรงกับ UID นี้' };
      }
      await updateDoc(userRef, {
         virtualWallet: increment(amount)
      });
      if (userProfile.value) {
         userProfile.value.virtualWallet += amount;
      }
      return { success: true, message: 'ทำรายการสำเร็จ' };
    } catch (error) {
      console.error('Adjust Wallet Failed:', error);
      return { success: false, message: error.message };
    }
  };

  const topupWallet = async (slipDataUrl) => {
    if (!user.value || !slipDataUrl) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };
    }
    try {
      const response = await fetch('/api/verify-slip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid: user.value.uid,
          slipDataUrl
        })
      });

      const result = await response.json();
      
      if (result.success && result.amount) {
         if (userProfile.value) {
            userProfile.value.virtualWallet += result.amount;
         }
      }
      return result;
    } catch (error) {
      console.error('Topup Error:', error);
      return { success: false, message: 'ระบบขัดข้อง: ' + error.message };
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
    adjustWallet,
    topupWallet
  };
});
