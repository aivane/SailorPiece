import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '../firebase/config';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, query, where, orderBy, getDocs, limit, increment } from 'firebase/firestore';
import { useAuthStore } from './auth';

export const useAuctionStore = defineStore('auction', () => {
  const auctions = ref([]);
  const activeAuctions = computed(() => auctions.value.filter(a => a.status === 'active'));
  const endedAuctions = computed(() => auctions.value.filter(a => a.status === 'ended' || a.status === 'completed' || a.status === 'cancelled'));
  
  const authStore = useAuthStore();

  const initAuctions = () => {
    // Listen to ALL auctions to show both active and ended
    onSnapshot(collection(db, 'auctions'), 
      (snapshot) => {
        auctions.value = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          // Convert timestamp if needed
          let endsAtParsed = data.endsAt;
          if (data.endsAt && typeof data.endsAt.toDate === 'function') {
            endsAtParsed = data.endsAt.toDate().toISOString();
          }
          return {
            id: docSnap.id,
            ...data,
            endsAt: endsAtParsed
          };
        }).sort((a, b) => {
          // Sort active auctions first, then by endsAt descending
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          return new Date(b.endsAt) - new Date(a.endsAt);
        });
      },
      (error) => {
        console.warn("Firestore auctions listener error:", error);
      }
    );
  };

  const placeBid = async (auctionId, bidAmount, robloxName) => {
    if (!authStore.user) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำการเสนอราคาครับ' };
    }
    try {
      const response = await fetch('/api/place-bid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid: authStore.user.uid,
          auctionId,
          bidAmount,
          robloxName
        })
      });

      const result = await response.json();
      
      // Update local wallet balance if bid was successful (since wallet is locked)
      if (result.success) {
        // The wallet update will be synced from Firestore profile listener automatically, 
        // but we can deduct it locally for instant responsiveness
        if (authStore.userProfile) {
          // Determine actual deduction (if outbidding yourself vs outbidding someone else)
          const auction = auctions.value.find(a => a.id === auctionId);
          let extraDeduction = bidAmount;
          if (auction && auction.currentBidderUid === authStore.user.uid) {
            extraDeduction = bidAmount - auction.currentBid;
          }
          authStore.userProfile.virtualWallet -= extraDeduction;
        }
      }
      return result;
    } catch (error) {
      console.error('Bidding request failed:', error);
      return { success: false, message: 'การเชื่อมต่อระบบขัดข้อง: ' + error.message };
    }
  };

  // Image helpers copied from shop store to keep auction store standalone
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadImage = async (file) => {
    if (!file) return null;
    try {
      return await compressImage(file);
    } catch (e) {
      console.error('Image compression error:', e);
      return null;
    }
  };

  // Admin Actions
  const createAuction = async (auctionData, imageFile) => {
    if (!authStore.isAdmin) return { success: false, message: 'สิทธิ์ไม่เพียงพอ' };
    try {
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      
      const newDocRef = doc(collection(db, 'auctions'));
      await setDoc(newDocRef, {
        title: auctionData.title,
        description: auctionData.description || '',
        startingPrice: Number(auctionData.startingPrice),
        minIncrement: Number(auctionData.minIncrement),
        currentBid: Number(auctionData.startingPrice),
        currentBidderUid: null,
        currentBidderName: null,
        currentBidderRoblox: null,
        bidsCount: 0,
        createdAt: serverTimestamp(),
        endsAt: new Date(auctionData.endsAt), // Stores as actual Firestore Timestamp
        status: 'active',
        image: imageUrl || ''
      });
      return { success: true };
    } catch (e) {
      console.error('Error creating auction:', e);
      return { success: false, message: e.message };
    }
  };

  const cancelAuction = async (auctionId) => {
    if (!authStore.isAdmin) return { success: false, message: 'สิทธิ์ไม่เพียงพอ' };
    try {
      const auctionRef = doc(db, 'auctions', auctionId);
      const auctionSnap = await getDoc(auctionRef);
      
      if (!auctionSnap.exists()) {
        return { success: false, message: 'ไม่พบรายการประมูลนี้' };
      }
      
      const data = auctionSnap.data();
      const batch = writeBatch(db);
      
      // Update status to cancelled
      batch.update(auctionRef, { status: 'cancelled' });
      
      // Refund the high bidder's funds immediately
      if (data.currentBidderUid && data.currentBid > 0) {
        const userRef = doc(db, 'users', data.currentBidderUid);
        batch.update(userRef, {
          virtualWallet: increment(data.currentBid)
        });
      }
      
      await batch.commit();
      return { success: true };
    } catch (e) {
      console.error('Error cancelling auction:', e);
      return { success: false, message: e.message };
    }
  };

  const completeAuction = async (auctionId) => {
    if (!authStore.isAdmin) return { success: false, message: 'สิทธิ์ไม่เพียงพอ' };
    try {
      const auctionRef = doc(db, 'auctions', auctionId);
      const auctionSnap = await getDoc(auctionRef);
      
      if (!auctionSnap.exists()) {
        return { success: false, message: 'ไม่พบรายการประมูลนี้' };
      }
      
      const data = auctionSnap.data();
      if (data.status !== 'active' && data.status !== 'ended') {
        return { success: false, message: 'การประมูลนี้ไม่ได้อยู่ในสถานะพร้อมจัดส่ง' };
      }
      if (!data.currentBidderUid) {
        return { success: false, message: 'ไม่สามารถจัดส่งได้เนื่องจากไม่มีผู้เข้าร่วมประมูล' };
      }
      
      const batch = writeBatch(db);
      
      // Mark as completed
      batch.update(auctionRef, { status: 'completed' });
      
      // Fetch queue counter & update
      const configRef = doc(db, 'configs', 'shop');
      const configSnap = await getDoc(configRef);
      let newQueueNumber = 1;
      if (configSnap.exists()) {
         const currentCounter = configSnap.data().globalQueueCounter || 0;
         newQueueNumber = currentCounter + 1;
         batch.update(configRef, { globalQueueCounter: newQueueNumber });
      } else {
         batch.set(configRef, { globalQueueCounter: 1 }, { merge: true });
      }
      
      // Create a delivery queue document
      const qDocRef = doc(collection(db, 'queues'));
      batch.set(qDocRef, {
        name: data.currentBidderRoblox || 'ผู้ประมูลชนะ',
        tiktokName: '',
        paymentMethod: 'auction',
        uid: data.currentBidderUid,
        queueNumber: newQueueNumber,
        product: `[ประมูล] ${data.title}`,
        receivedPieces: 1,
        price: data.currentBid,
        items: [
          {
            product: {
              id: auctionId,
              name: `[ประมูล] ${data.title}`,
              price: data.currentBid,
              image: data.image || '',
              category: 'Auction'
            },
            pieces: 1,
            baht: data.currentBid
          }
        ],
        status: 'waiting',
        slipImage: data.image || '',
        timestamp: serverTimestamp(),
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
      });
      
      await batch.commit();
      return { success: true };
    } catch (e) {
      console.error('Error completing auction:', e);
      return { success: false, message: e.message };
    }
  };

  return {
    auctions,
    activeAuctions,
    endedAuctions,
    initAuctions,
    placeBid,
    createAuction,
    cancelAuction,
    completeAuction
  };
});
