import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

export const useShopStore = defineStore('shop', () => {
  const products = ref([]);
  const queues = ref([]);
  const cart = ref([]);

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
      products.value = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    });
    
    // Listen to queues
    onSnapshot(collection(db, 'queues'), (snapshot) => {
      queues.value = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).sort((a,b) => b.timestamp - a.timestamp);
    });
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
        image: imageUrl || ''
      });
    } catch (e) {
       console.error("Error adding product:", e);
    }
  };

  const updateProduct = async (id, updatedData, imageFile) => {
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
    } catch (e) {
      console.error("Error updating product:", e);
    }
  };

  const deleteProduct = async (id) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch(e) {
      console.error("Error deleting product:", e);
    }
  };

  const addQueue = async (queueData, slipFile) => {
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
        name: queueData.name,
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
      return qDocRef.id;
    } catch (e) {
      console.error("Error adding queue:", e);
      return null;
    }
  };

  const updateQueueStatus = async (id, newStatus) => {
    try {
      const qRef = doc(db, 'queues', id);
      await updateDoc(qRef, { status: newStatus });
      
      // Auto deduct stock if approved
      if (newStatus === 'approved') {
         const queueItem = queues.value.find(q => q.id === id);
         if (queueItem) {
             const batch = writeBatch(db);
             
             // Deduct from NEW items array
             if (queueItem.items && queueItem.items.length > 0) {
                 for (const item of queueItem.items) {
                    const targetProduct = products.value.find(p => p.id === item.product.id);
                    if (targetProduct) {
                       const finalDeduct = item.pieces;
                       if (targetProduct.quantity >= finalDeduct) {
                           batch.update(doc(db, 'products', targetProduct.id), {
                               quantity: targetProduct.quantity - finalDeduct,
                               status: (targetProduct.quantity - finalDeduct) > 0 ? 'available' : 'out-of-stock'
                           });
                       }
                    }
                 }
                 await batch.commit();
             } 
             // Deduct using OLD single-product structure
             else {
                 const targetProduct = products.value.find(p => p.name === queueItem.product);
                 if (targetProduct) {
                     const finalDeduct = queueItem.receivedPieces || 0;
                     if (targetProduct.quantity >= finalDeduct) {
                       await updateDoc(doc(db, 'products', targetProduct.id), {
                         quantity: targetProduct.quantity - finalDeduct,
                         status: (targetProduct.quantity - finalDeduct) > 0 ? 'available' : 'out-of-stock'
                       });
                     }
                 }
             }
         }
      }

    } catch(e) {
      console.error("Error updating queue status:", e);
    }
  };

  return {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    queues,
    addQueue,
    updateQueueStatus,
    initShop,
    cart,
    cartTotalBaht,
    addToCart,
    removeFromCart,
    clearCart
  };
});
