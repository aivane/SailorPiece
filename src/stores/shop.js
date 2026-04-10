import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, query, where, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';

export const useShopStore = defineStore('shop', () => {
  const rawProducts = ref([]);
  const products = computed(() => {
     return rawProducts.value.map(p => {
        if (p.isRecipe && p.recipeItems && p.recipeItems.length > 0) {
           let limit = Infinity;
           for (const req of p.recipeItems) {
              const ing = rawProducts.value.find(rp => rp.id === req.productId);
              if (!ing) {
                 limit = 0; 
                 break;
              }
              const possible = Math.floor(ing.quantity / req.pieces);
              if (possible < limit) limit = possible;
           }
           if (limit === Infinity) limit = 0;
           return { ...p, quantity: limit, status: limit > 0 ? 'available' : 'out-of-stock' };
        }
        return p;
     });
  });

  const queues = ref([]);
  const cart = ref([]);
  const categories = ref(['Reroll', 'Melee', 'Sword', 'Chest', 'Summon', 'Other']);

  const adminHistoryQueues = ref([]);
  const hasMoreAdminHistory = ref(true);
  let lastAdminDoc = null;

  const cartTotalBaht = computed(() => {
    return cart.value.reduce((sum, item) => sum + item.baht, 0);
  });

  const addToCart = (product, pieces, baht) => {
    const existingIndex = cart.value.findIndex(item => item.product.id === product.id);
    if (existingIndex !== -1) {
       cart.value[existingIndex].pieces += pieces;
       cart.value[existingIndex].baht += baht;
    } else {
       cart.value.push({ product, pieces, baht });
    }
  };

  const removeFromCart = (index) => {
    cart.value.splice(index, 1);
  };

  const clearCart = () => {
    cart.value = [];
  };

  const initShop = () => {
    // Listen to products
    onSnapshot(collection(db, 'products'), (snapshot) => {
      rawProducts.value = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    });
    
    // Listen to ACTIVE queues only
    const activeQuery = query(collection(db, 'queues'), where('status', '==', 'waiting'));
    onSnapshot(activeQuery, (snapshot) => {
      queues.value = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).sort((a,b) => b.timestamp - a.timestamp);
    });

    // Listen to categories
    onSnapshot(doc(db, 'configs', 'shop'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().categories) {
        categories.value = docSnap.data().categories;
      } else {
        // Initialize if not exists
        setDoc(doc(db, 'configs', 'shop'), { categories: categories.value }, { merge: true });
      }
    });
  };

  const updateCategories = async (newCategories) => {
    try {
      await setDoc(doc(db, 'configs', 'shop'), { categories: newCategories }, { merge: true });
    } catch (e) {
      console.error('Error updating categories:', e);
    }
  };

  const loadAdminHistory = async (reset = false) => {
    if (reset) {
       adminHistoryQueues.value = [];
       lastAdminDoc = null;
       hasMoreAdminHistory.value = true;
    }
    if (!hasMoreAdminHistory.value) return;

    try {
       let q = query(collection(db, 'queues'), where('status', 'in', ['approved', 'rejected']), orderBy('timestamp', 'desc'), limit(50));
       if (lastAdminDoc) {
          q = query(collection(db, 'queues'), where('status', 'in', ['approved', 'rejected']), orderBy('timestamp', 'desc'), startAfter(lastAdminDoc), limit(50));
       }
       const snapshot = await getDocs(q);
       if (snapshot.empty) {
          hasMoreAdminHistory.value = false;
          return;
       }
       lastAdminDoc = snapshot.docs[snapshot.docs.length - 1];
       const result = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
       adminHistoryQueues.value = [...adminHistoryQueues.value, ...result];
       if (snapshot.docs.length < 50) hasMoreAdminHistory.value = false;
    } catch(e) {
       console.error("Error loading admin history:", e);
    }
  };

  const fetchUserHistory = async (uid) => {
     if (!uid) return [];
     try {
        const q = query(collection(db, 'queues'), where('uid', '==', uid), where('status', 'in', ['approved', 'rejected']), orderBy('timestamp', 'desc'));
        const sn = await getDocs(q);
        return sn.docs.map(d => ({id: d.id, ...d.data()}));
     } catch(e) {
        console.error("Error loading user history:", e);
        return [];
     }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
             const canvas = document.createElement('canvas');
             const MAX_WIDTH = 800; // Resize to ensure it fits in Firestore 1MB limits
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
             // Use JPEG as it has better widespread mobile support than WebP
             const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
             resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadImage = async (file, path) => {
    if (!file) return null;
    try {
      // Instead of relying on Firebase Storage (which requires paid plans in some regions),
      // we compress the image into a lightweight string and store it directly in Firestore database!
      return await compressImage(file);
    } catch (e) {
      console.error('Image processing error:', e);
      return null;
    }
  };

  const addProduct = async (productData, imageFile) => {
    if (!productData.name || typeof productData.price !== 'number' || productData.price < 0 || productData.quantity < 0) {
       return { success: false, message: 'ข้อมูลราคาหรือจำนวนสินค้าไม่ถูกต้อง' };
    }
    try {
      let imageUrl = productData.image; 
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'products');
      }
      
      const newDocRef = doc(collection(db, 'products'));
      await setDoc(newDocRef, {
        name: productData.name,
        description: productData.description || '',
        price: productData.price,
        quantity: productData.quantity,
        pricingType: productData.pricingType || 'fixed',
        status: productData.quantity > 0 ? 'available' : 'out-of-stock',
        image: imageUrl || '',
        category: productData.category || 'Reroll',
        badge: productData.badge || 'none',
        isRecipe: productData.isRecipe || false,
        recipeItems: productData.recipeItems || []
      });
      return { success: true };
    } catch (e) {
       console.error("Error adding product:", e);
       return { success: false, message: 'แพลตฟอร์มขัดข้อง ' + e.message };
    }
  };

  const updateProduct = async (id, updatedData, imageFile) => {
    if (!updatedData.name || typeof updatedData.price !== 'number' || updatedData.price < 0 || updatedData.quantity < 0) {
       return { success: false, message: 'ข้อมูลราคาหรือจำนวนสินค้าไม่ถูกต้อง' };
    }
    try {
      let imageUrl = updatedData.image;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'products');
      }
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, {
        ...updatedData,
        image: imageUrl,
        status: updatedData.quantity > 0 ? 'available' : 'out-of-stock'
      });
      return { success: true };
    } catch (e) {
      console.error("Error updating product:", e);
      return { success: false, message: 'แพลตฟอร์มขัดข้อง ' + e.message };
    }
  };

  const deleteProduct = async (id) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch(e) {
      console.error("Error deleting product:", e);
    }
  };

  const batchSyncProducts = async (updateItems, newItems) => {
    try {
      const batch = writeBatch(db);
      
      for (const item of updateItems) {
         const pRef = doc(db, 'products', item.id);
         batch.update(pRef, { quantity: item.quantity });
      }

      for (const item of newItems) {
         const pRef = doc(collection(db, 'products'));
         batch.set(pRef, {
            name: item.name,
            quantity: item.quantity,
            price: 0,
            image: '',
            category: 'New Import',
            pricingType: 'fixed',
            badge: 'new'
         });
      }

      await batch.commit();
      return { success: true };
    } catch (error) {
       console.error("Batch error:", error);
       return { success: false, message: error.message };
    }
  };

  const addQueue = async (queueData, slipFile) => {
    // Validate that shop items requested are within stock
    if (queueData.items && queueData.items.length > 0) {
       const deductMap = {};
       for (const item of queueData.items) {
          if (item.product.isRecipe && item.product.recipeItems) {
              for (const req of item.product.recipeItems) {
                  if (!deductMap[req.productId]) deductMap[req.productId] = { pieces: 0, name: req.name };
                  deductMap[req.productId].pieces += req.pieces * item.pieces;
              }
          } else {
              if (!deductMap[item.product.id]) deductMap[item.product.id] = { pieces: 0, name: item.product.name };
              deductMap[item.product.id].pieces += item.pieces;
          }
       }
       for (const pid of Object.keys(deductMap)) {
           const needed = deductMap[pid].pieces;
           const dbItem = rawProducts.value.find(p => p.id === pid);
           if (!dbItem || dbItem.quantity < needed || needed <= 0) {
              return { success: false, docId: null, message: `วัตถุดิบ/สินค้า ${deductMap[pid].name} มีสต๊อกไม่พอ ณ ขณะนี้ (ต้องการ ${needed})` };
           }
       }
    }
    if (typeof queueData.price !== 'number' || queueData.price < 0) {
       return { success: false, docId: null, message: 'ยอดชำระโอนหรือจำนวนเรตถูกส่งมาไม่ถูกต้อง ขออภัย' };
    }

    try {
      let slipUrl = '';
      if (slipFile) {
         slipUrl = await uploadImage(slipFile, 'slips');
      }

      const qDocRef = doc(collection(db, 'queues'));
      
      let maxQueueNumber = 0;
      for (const q of queues.value) {
         if (q.queueNumber && q.queueNumber > maxQueueNumber) {
            maxQueueNumber = q.queueNumber;
         }
      }
      const newQueueNumber = maxQueueNumber + 1;
      
      // Store both legacy formatting and new multiple-items logic
      await setDoc(qDocRef, {
        name: queueData.name, // Usually robloxName
        tiktokName: queueData.tiktokName || '',
        paymentMethod: queueData.paymentMethod || 'slip',
        uid: queueData.uid || null, // Track user who bought it
        queueNumber: newQueueNumber,
        // Fallback for single-item backwards compatibility (mostly for old code references if any remain)
        product: queueData.items?.[0]?.product?.name || queueData.product || 'หลายรายการ', 
        receivedPieces: queueData.items?.[0]?.pieces || queueData.receivedPieces || 0,
        price: queueData.price || 0,
        
        // New array structure
        items: queueData.items || [], 
        
        status: 'waiting',
        slipImage: slipUrl,
        timestamp: serverTimestamp(),
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
      });
      return { success: true, docId: qDocRef.id };
    } catch (e) {
      console.error("Error adding queue:", e);
      return { success: false, docId: null, message: e.message };
    }
  };

  const updateQueueStatus = async (id, newStatus) => {
    try {
      const qRef = doc(db, 'queues', id);
      
      // If approving, we MUST check stock strictly before doing anything
      if (newStatus === 'approved') {
         const queueItem = queues.value.find(q => q.id === id);
         if (queueItem) {
             const batch = writeBatch(db);
             
             // Deduct from NEW items array using Deduct Map
             if (queueItem.items && queueItem.items.length > 0) {
                 const deductMap = {};
                 for (const item of queueItem.items) {
                     if (item.product.isRecipe && item.product.recipeItems) {
                         for (const req of item.product.recipeItems) {
                             if (!deductMap[req.productId]) deductMap[req.productId] = 0;
                             deductMap[req.productId] += req.pieces * item.pieces;
                         }
                     } else {
                         if (!deductMap[item.product.id]) deductMap[item.product.id] = 0;
                         deductMap[item.product.id] += item.pieces;
                     }
                 }
                 
                 for (const pid of Object.keys(deductMap)) {
                     const deductPieces = deductMap[pid];
                     const targetProduct = rawProducts.value.find(p => p.id === pid);
                     if (!targetProduct || targetProduct.quantity < deductPieces) {
                         return { success: false, message: `สต๊อกไอเทมย่อย ${targetProduct?targetProduct.name:'(ลบไปแล้ว)'} ไม่พอตัดจ่าย กรุณาเช็คคลัง`};
                     }
                     batch.update(doc(db, 'products', targetProduct.id), {
                         quantity: targetProduct.quantity - deductPieces,
                         status: (targetProduct.quantity - deductPieces) > 0 ? 'available' : 'out-of-stock'
                     });
                 }
                 
                 batch.update(qRef, { status: newStatus });
                 await batch.commit();
                 return { success: true };
             } 
             // Deduct using OLD single-product structure
             else {
                 const targetProduct = rawProducts.value.find(p => p.name === queueItem.product);
                 const finalDeduct = queueItem.receivedPieces || 0;
                 if (!targetProduct || targetProduct.quantity < finalDeduct) {
                    return { success: false, message: `ไม่สามารถอนุมัติได้ สินค้า ${queueItem.product} มีสต๊อกไม่พอ ณ ปัจจุบัน` };
                 }
                 batch.update(doc(db, 'products', targetProduct.id), {
                    quantity: targetProduct.quantity - finalDeduct,
                    status: (targetProduct.quantity - finalDeduct) > 0 ? 'available' : 'out-of-stock'
                 });
                 batch.update(qRef, { status: newStatus });
                 await batch.commit();
                 return { success: true };
             }
         }
      } else {
         // Rejecting or other status
         await updateDoc(qRef, { status: newStatus });
         return { success: true };
      }

    } catch(e) {
      console.error("Error updating queue status:", e);
      return { success: false, message: e.message };
    }
  };

  return {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    batchSyncProducts,
    queues,
    addQueue,
    updateQueueStatus,
    initShop,
    cart,
    cartTotalBaht,
    addToCart,
    removeFromCart,
    clearCart,
    categories,
    updateCategories,
    adminHistoryQueues,
    hasMoreAdminHistory,
    loadAdminHistory,
    fetchUserHistory
  };
});
