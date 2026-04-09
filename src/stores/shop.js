import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db, storage } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export const useShopStore = defineStore('shop', () => {
  const products = ref([]);
  const queues = ref([]);

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

  const uploadImage = async (file, path) => {
    if (!file) return null;
    try {
      const sRef = storageRef(storage, `${path}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(sRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (e) {
      console.error('Upload Error:', e);
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
      await setDoc(qDocRef, {
        name: queueData.name,
        product: queueData.product,
        price: queueData.price,
        receivedPieces: queueData.receivedPieces || 0,
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
         const targetProduct = products.value.find(p => p.name === queueItem?.product);
         if (queueItem && targetProduct) {
             const deductAmt = targetProduct.pricingType === 'rate' ? 0 : queueItem.receivedPieces;
             // If rate, technically stock is pieces, so yes deduct pieces
             const finalDeduct = queueItem.receivedPieces;
             if (targetProduct.quantity >= finalDeduct) {
               await updateDoc(doc(db, 'products', targetProduct.id), {
                 quantity: targetProduct.quantity - finalDeduct,
                 status: (targetProduct.quantity - finalDeduct) > 0 ? 'available' : 'out-of-stock'
               });
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
    initShop
  };
});
