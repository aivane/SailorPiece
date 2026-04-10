<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Package, Users, Settings, Tag, Plus, Check, X, History, Layers, Wallet, UserCog, Search, Database } from 'lucide-vue-next';

import { db } from '../firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';

import { useShopStore } from '../stores/shop';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';
import { storeToRefs } from 'pinia';

const shopStore = useShopStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const { products, queues: currentQueues, categories, adminHistoryQueues, hasMoreAdminHistory } = storeToRefs(shopStore);

// Use 'users' tab instead of 'wallet'
const activeTab = ref('queue');

import { watch } from 'vue';
watch(activeTab, (val) => {
  if (val === 'history' && adminHistoryQueues.value.length === 0) {
    shopStore.loadAdminHistory(true);
  }
});

const allUsers = ref([]);
let usersUnsubscribe = null;

onMounted(() => {
  usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
    allUsers.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });
});

onUnmounted(() => {
  if (usersUnsubscribe) usersUnsubscribe();
});

const searchHistoryText = ref('');
const searchUserText = ref('');

const filteredUsers = computed(() => {
  let list = allUsers.value;
  if(searchUserText.value.trim()) {
    const term = searchUserText.value.toLowerCase();
    list = list.filter(u => 
      (u.robloxName && u.robloxName.toLowerCase().includes(term)) ||
      (u.tiktokName && u.tiktokName.toLowerCase().includes(term)) ||
      (u.displayName && u.displayName.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.id && u.id.toLowerCase().includes(term))
    );
  }
  return list;
});

const isAdjustModalOpen = ref(false);

const targetUid = ref('');
const adjustAmount = ref(0);
const adjustMessage = ref('');
const isAdjusting = ref(false);

const handleAdjustWallet = async () => {
   if (!targetUid.value || !adjustAmount.value) {
      adjustMessage.value = 'กรุณาระบุ UID และ จำนวนเงิน (ใส่ค่าลบเพื่อหักออก)';
      return;
   }
   isAdjusting.value = true;
   const result = await authStore.adjustWallet(targetUid.value, adjustAmount.value);
   adjustMessage.value = result.message;
   if (result.success) {
      setTimeout(() => {
         isAdjustModalOpen.value = false;
         targetUid.value = '';
         adjustAmount.value = 0;
         adjustMessage.value = '';
      }, 1500);
   }
   isAdjusting.value = false;
};

const openAdjustModal = (uid) => {
  targetUid.value = uid;
  adjustAmount.value = 0;
  adjustMessage.value = '';
  isAdjustModalOpen.value = true;
};

const viewUserHistory = (uid) => {
  searchHistoryText.value = uid;
  activeTab.value = 'history';
};

const newCategoryName = ref('');
const addCategory = async () => {
  const name = newCategoryName.value.trim();
  if (!name) return;
  if (categories.value.includes(name)) {
    uiStore.showAlert('มีหมวดหมู่นี้อยู่แล้ว', 'warning');
    return;
  }
  const updatedCategories = [...categories.value, name];
  await shopStore.updateCategories(updatedCategories);
  newCategoryName.value = '';
};

const removeCategory = async (catToRemove) => {
  if (await uiStore.showConfirm(`คุณต้องการลบหมวดหมู่ "${catToRemove}" ใช่หรือไม่?`)) {
    const updatedCategories = categories.value.filter(cat => cat !== catToRemove);
    await shopStore.updateCategories(updatedCategories);
  }
};

const waitingQueues = computed(() => currentQueues.value.filter(q => q.status === 'waiting'));
const historyQueues = computed(() => {
  let list = adminHistoryQueues.value;
  if (searchHistoryText.value.trim()) {
    const term = searchHistoryText.value.toLowerCase();
    list = list.filter(q => 
       (q.name && q.name.toLowerCase().includes(term)) ||
       (q.tiktokName && q.tiktokName.toLowerCase().includes(term)) ||
       (q.uid && q.uid.toLowerCase().includes(term)) ||
       (q.queueNumber && String(q.queueNumber).includes(term)) ||
       (q.id && q.id.toLowerCase().includes(term))
    );
  }
  return list;
});

const approveQueue = async (id) => { 
  const res = await shopStore.updateQueueStatus(id, 'approved'); 
  if (res && !res.success) {
     uiStore.showAlert(res.message, 'error');
  } else {
     uiStore.showAlert('อนุมัติคิวและตัดสต๊อกสำเร็จ', 'success');
  }
};
const rejectQueue = async (id) => { 
  await shopStore.updateQueueStatus(id, 'rejected'); 
  uiStore.showAlert('ปฏิเสธคิวสำเร็จ', 'info');
};

const isFocusMode = ref(false);
const focusIndex = ref(0);

const focusedQueue = computed(() => {
  if (waitingQueues.value.length === 0) return null;
  if (focusIndex.value >= waitingQueues.value.length) {
     focusIndex.value = 0;
  }
  return waitingQueues.value[focusIndex.value];
});

const skipFocus = () => {
   if (waitingQueues.value.length === 0) return;
   focusIndex.value = (focusIndex.value + 1) % waitingQueues.value.length;
};

const focusApproveQueue = async () => {
   if (!focusedQueue.value) return;
   if (await uiStore.showConfirm('คุณเทรดสินค้าในเกมเสร็จสิ้นและต้องการยืนยันคิวใช่หรือไม่?')) {
      const currentId = focusedQueue.value.id;
      const res = await shopStore.updateQueueStatus(currentId, 'approved');
      if (res && !res.success) {
         uiStore.showAlert(res.message, 'error');
      } else {
         uiStore.showAlert('อนุมัติสำเร็จ เลื่อนคิวถัดไป...', 'success');
         // No need to increment focusIndex as the array length shifts down, so current focusIndex points to the NEXT item
         if (focusIndex.value >= waitingQueues.value.length) focusIndex.value = 0;
      }
   }
};

const focusRejectQueue = async () => {
   if (!focusedQueue.value) return;
   if (await uiStore.showConfirm('ยืนยันที่จะปฏิเสธและปัดตกคิวนี้ใช่หรือไม่?')) {
      await shopStore.updateQueueStatus(focusedQueue.value.id, 'rejected');
      uiStore.showAlert('ปฏิเสธคิวสำเร็จ เลื่อนคิวถัดไป...', 'info');
      if (focusIndex.value >= waitingQueues.value.length) focusIndex.value = 0;
   }
};

const isModalOpen = ref(false);
const editingProductId = ref(null);
const productForm = ref({ name: '', description: '', price: 0, quantity: 1, image: '', pricingType: 'fixed', category: 'Reroll', badge: 'none', isRecipe: false, recipeItems: [] });
const imageRawFile = ref(null);
const isSubmitting = ref(false);

const viewingSlipUrl = ref(null);
const viewSlip = (url) => { viewingSlipUrl.value = url; };
const closeSlip = () => { viewingSlipUrl.value = null; };

const openAddModal = () => {
  editingProductId.value = null;
  productForm.value = { name: '', description: '', price: 0, quantity: 1, image: '', pricingType: 'fixed', category: 'Reroll', badge: 'none', isRecipe: false, recipeItems: [] };
  imageRawFile.value = null;
  isModalOpen.value = true;
};

const openEditModal = (product) => {
  editingProductId.value = product.id;
  productForm.value = { ...product, recipeItems: product.recipeItems || [], isRecipe: product.isRecipe || false };
  imageRawFile.value = null;
  isModalOpen.value = true;
};

const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    imageRawFile.value = file;
    productForm.value.image = URL.createObjectURL(file);
  }
};

const saveProduct = async () => {
  isSubmitting.value = true;
  let result;
  if(editingProductId.value) {
    result = await shopStore.updateProduct(editingProductId.value, productForm.value, imageRawFile.value);
  } else {
    result = await shopStore.addProduct(productForm.value, imageRawFile.value);
  }
  isSubmitting.value = false;
  
  if (result.success) {
     uiStore.showAlert('บันทึกข้อมูลสินค้าสำเร็จ', 'success');
     isModalOpen.value = false;
  } else {
     uiStore.showAlert(result.message || 'บันทึกไม่สำเร็จ', 'error');
  }
};

const deleteProduct = async (id) => {
  if (await uiStore.showConfirm('คุณต้องการลบสินค้านี้ใช่หรือไม่?')) {
    shopStore.deleteProduct(id);
    uiStore.showAlert('ลบสินค้าสำเร็จ', 'success');
  }
};
const searchProductText = ref('');
const filterProductCategory = ref('');
const productViewMode = ref('ready'); // 'ready' or 'draft'

const filteredProducts = computed(() => {
  let list = products.value;
  
  if (productViewMode.value === 'ready') {
    list = list.filter(p => p.image && p.price > 0);
  } else {
    list = list.filter(p => !p.image || p.price <= 0);
  }

  if (filterProductCategory.value) {
    list = list.filter(p => p.category === filterProductCategory.value);
  }
  if (searchProductText.value.trim()) {
    const term = searchProductText.value.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(term));
  }
  return list;
});

const quickSave = async (p) => {
  const result = await shopStore.updateProduct(p.id, p, null);
  if (result.success) {
     uiStore.showAlert('บันทึกสำเร็จ', 'success');
  } else {
     uiStore.showAlert(result.message || 'บันทึกไม่สำเร็จ', 'error');
  }
};

const duplicateProduct = (p) => {
  editingProductId.value = null;
  productForm.value = { ...p, name: p.name + ' (Copy)', recipeItems: p.recipeItems ? [...p.recipeItems] : [], isRecipe: p.isRecipe || false };
  imageRawFile.value = null;
  isModalOpen.value = true;
};

const newRecipeItemId = ref('');
const newRecipeItemPieces = ref(1);

const addRecipeItem = () => {
  if (!newRecipeItemId.value || newRecipeItemPieces.value <= 0) return;
  const targetProd = products.value.find(p => p.id === newRecipeItemId.value);
  if (!targetProd) return;
  // avoid adding duplicate item, update instead
  const existing = productForm.value.recipeItems.find(p => p.productId === targetProd.id);
  if (existing) {
     existing.pieces += newRecipeItemPieces.value;
  } else {
     productForm.value.recipeItems.push({
        productId: targetProd.id,
        name: targetProd.name,
        pieces: newRecipeItemPieces.value
     });
  }
  newRecipeItemId.value = '';
  newRecipeItemPieces.value = 1;
};

const removeRecipeItem = (index) => {
   productForm.value.recipeItems.splice(index, 1);
};

const isImportModalOpen = ref(false);
const importText = ref('');
const importUpdateItems = ref([]);
const importNewItems = ref([]);
const isImportAnalyzed = ref(false);
const isImporting = ref(false);

const openImportModal = () => {
   importText.value = '';
   importUpdateItems.value = [];
   importNewItems.value = [];
   isImportAnalyzed.value = false;
   isImportModalOpen.value = true;
};

const analyzeImport = () => {
   importUpdateItems.value = [];
   importNewItems.value = [];
   
   const lines = importText.value.split('\n');
   const regex = /^\s*(\d+)x\s+(.+)$/i;
   
   for (let line of lines) {
      if (!line.trim()) continue;
      const match = line.match(regex);
      if (match) {
         const qty = parseInt(match[1]);
         let rawName = match[2].trim();
         
         const existingProduct = products.value.find(p => p.name.toLowerCase() === rawName.toLowerCase());
         
         if (existingProduct) {
             importUpdateItems.value.push({ id: existingProduct.id, name: existingProduct.name, quantity: qty, oldQuantity: existingProduct.quantity });
         } else {
             importNewItems.value.push({ name: rawName, quantity: qty });
         }
      }
   }
   
   isImportAnalyzed.value = true;
};

const confirmImport = async () => {
   if (importUpdateItems.value.length === 0 && importNewItems.value.length === 0) return;
   
   isImporting.value = true;
   if (importNewItems.value.length > 0 && !categories.value.includes('New Import')) {
       await shopStore.updateCategories([...categories.value, 'New Import']);
   }
   const result = await shopStore.batchSyncProducts(importUpdateItems.value, importNewItems.value);
   isImporting.value = false;
   
   if (result.success) {
      uiStore.showAlert('นำเข้าสต๊อกสำเร็จ', 'success');
      isImportModalOpen.value = false;
      if (importNewItems.value.length > 0) {
         filterProductCategory.value = 'New Import';
      }
   } else {
      uiStore.showAlert(result.message || 'เกิดข้อผิดพลาด', 'error');
   }
};

</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold text-brand-dark flex items-center gap-2">
          <Settings class="w-8 h-8 text-brand" /> 
          Admin Dashboard
        </h1>
        <p class="text-slate-500 mt-2">จัดการสินค้าและตรวจสอบสลิป</p>
      </div>

      <!-- Tab Buttons -->
      <div class="flex bg-white rounded-xl shadow-sm p-1 border border-slate-100 w-full sm:w-auto">
        <button 
          @click="activeTab = 'queue'"
          :class="['px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none', activeTab === 'queue' ? 'bg-brand/10 text-brand' : 'text-slate-500 hover:text-slate-700']"
        >
          <Users class="w-4 h-4" /> จัดการคิว
        </button>
        <button 
          @click="activeTab = 'history'"
          :class="['px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none', activeTab === 'history' ? 'bg-brand/10 text-brand' : 'text-slate-500 hover:text-slate-700']"
        >
          <History class="w-4 h-4" /> ประวัติ
        </button>
        <button 
          @click="activeTab = 'products'"
          :class="['px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none', activeTab === 'products' ? 'bg-brand/10 text-brand' : 'text-slate-500 hover:text-slate-700']"
        >
          <Package class="w-4 h-4" /> จัดการสินค้า
        </button>
        <button 
          @click="activeTab = 'categories'"
          :class="['px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none', activeTab === 'categories' ? 'bg-brand/10 text-brand' : 'text-slate-500 hover:text-slate-700']"
        >
          <Layers class="w-4 h-4" /> จัดการหมวดหมู่
        </button>
        <button 
          @click="activeTab = 'users'"
          :class="['px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none', activeTab === 'users' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:text-slate-700']"
        >
          <UserCog class="w-4 h-4" /> จัดการผู้ใช้
        </button>
      </div>
    </div>

    <!-- Queue Management Tab -->
    <div v-if="activeTab === 'queue'" class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div class="flex items-center gap-3">
             <h2 class="text-lg font-semibold text-slate-800">รายการรอยืนยันสลิป</h2>
             <span class="text-brand font-bold bg-brand/10 px-3 py-1 rounded-full text-sm">{{ waitingQueues.length }} รายการ</span>
         </div>
         
         <!-- View Switcher -->
         <div class="flex bg-slate-100 p-1 rounded-lg">
             <button @click="isFocusMode = false" :class="['px-3 py-1.5 text-sm font-medium rounded-md transition-colors', !isFocusMode ? 'bg-white shadow-sm text-brand' : 'text-slate-500 hover:text-slate-700']">ตารางรวม</button>
             <button @click="isFocusMode = true" :class="['px-3 py-1.5 text-sm font-medium rounded-md transition-colors', isFocusMode ? 'bg-white shadow-sm text-brand' : 'text-slate-500 hover:text-slate-700']">Focus Mode (คิวต่อคิว)</button>
         </div>
      </div>
      
      <!-- List View -->
      <div v-if="!isFocusMode" class="divide-y divide-slate-100">
        <div v-for="q in waitingQueues" :key="q.id" class="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 hover:bg-slate-50 transition-colors">
          
          <!-- Slip Preview Box -->
          <div class="w-24 h-32 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 relative group">
            <template v-if="q.paymentMethod === 'wallet'">
               <div class="w-full h-full flex flex-col items-center justify-center bg-emerald-50 text-emerald-600 p-2 text-center text-xs">
                 <Wallet class="w-6 h-6 mb-1 opacity-70" />
                 <b>ชำระผ่าน Wallet</b>
               </div>
            </template>
            <template v-else-if="q.slipImage">
              <img :src="q.slipImage" class="w-full h-full object-cover grayscale mix-blend-multiply opacity-50" />
              <div @click="viewSlip(q.slipImage)" class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm">
                <span class="text-xs text-white font-medium">ดูสลิปเต็ม</span>
              </div>
            </template>
            <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-xs">ไม่มีรูปสลิป</div>
          </div>
          
          <div class="flex-grow">
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-slate-800">แอดมินตรวจคิว #{{ q.queueNumber || q.id }}</h3>
              <span v-if="q.status === 'waiting'" class="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wider">รอยืนยัน</span>
              <span v-else-if="q.status === 'approved'" class="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-xs font-semibold uppercase tracking-wider">อนุมัติแล้ว</span>
              <span v-else class="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-xs font-semibold uppercase tracking-wider">ปฏิเสธ</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-2 text-xs">
               <span class="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">𝗥𝗼𝗯𝗹𝗼𝘅: <b>{{ q.name || '-' }}</b></span>
               <span class="bg-pink-50 text-pink-700 px-2 py-1 rounded border border-pink-100">𝗧𝗶𝗸𝗧𝗼𝗸: <b>{{ q.tiktokName || '-' }}</b></span>
            </div>
            <div class="mt-2 space-y-1">
               <template v-if="q.items && q.items.length > 0">
                 <div v-for="(item, i) in q.items" :key="i" class="text-sm text-slate-600">
                    <p>
                      <span class="text-slate-400 mr-1">-</span> {{ item.product.name }} 
                      <span class="text-brand font-medium ml-1">x{{ item.pieces }} ชิ้น</span>
                    </p>
                    <ul v-if="item.product.isRecipe && item.product.recipeItems" class="pl-4 mt-1 border-l-2 border-brand-light/50 ml-2 space-y-1">
                      <li v-for="(req, ri) in item.product.recipeItems" :key="ri" class="text-xs text-slate-500">
                        ↳ <span class="font-medium text-slate-700">{{ req.name }}</span> <span class="font-bold text-brand">x{{ req.pieces * item.pieces }}</span>
                      </li>
                    </ul>
                 </div>
               </template>
               <template v-else>
                 <p class="text-sm text-slate-600">
                   <span class="text-slate-400 mr-1">-</span> {{ q.product }} 
                   <span v-if="q.receivedPieces" class="text-brand font-medium ml-1">x{{ q.receivedPieces.toLocaleString('th-TH') }} ชิ้น</span>
                 </p>
               </template>
               <p class="text-sm font-bold text-slate-800 pt-1 border-t border-slate-100/50 w-max mt-1">ยอดโอนรวม: {{ q.price }} บาท</p>
            </div>
            <p class="text-xs text-slate-400 mt-2 font-mono">เวลาอัปโหลด: {{ q.time }}</p>
          </div>

          <div v-if="q.status === 'waiting'" class="flex items-center gap-2 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-100">
             <button @click="approveQueue(q.id)" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-green-50 hover:bg-green-100 text-green-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
               <Check class="w-4 h-4" /> ยืนยันสลิป
             </button>
             <button @click="rejectQueue(q.id)" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
               <X class="w-4 h-4" /> ปฏิเสธ
             </button>
          </div>
        </div>
        <div v-if="waitingQueues.length === 0" class="p-8 text-center text-slate-500">
          ไม่พบรายการคำสั่งซื้อใหม่
        </div>
      </div>

      <!-- Focus Mode View -->
      <div v-else class="p-4 sm:p-8 bg-slate-50 min-h-[400px] flex items-center justify-center">
         <div v-if="focusedQueue" class="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div class="p-4 bg-brand/5 border-b border-brand/10 flex justify-between items-center">
               <span class="text-brand-dark font-bold">คิวปัจจุบันที่โฟกัส (#{{ focusedQueue.queueNumber || focusedQueue.id }})</span>
               <span class="text-sm text-slate-500 font-medium">คิวที่ {{ focusIndex + 1 }} จาก {{ waitingQueues.length }}</span>
            </div>
            
            <div class="p-6 sm:p-8 flex flex-col sm:flex-row gap-8">
               <div class="w-full sm:w-1/2 flex flex-col items-center">
                  <div class="w-full aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden shadow-inner relative group border border-slate-200 mb-2">
                    <template v-if="focusedQueue.paymentMethod === 'wallet'">
                       <div class="w-full h-full flex flex-col items-center justify-center bg-emerald-50 text-emerald-600 p-4 text-center">
                         <Wallet class="w-12 h-12 mb-2 opacity-70" />
                         <b class="text-lg">ชำระผ่าน Wallet 100%</b>
                       </div>
                    </template>
                    <template v-else-if="focusedQueue.slipImage">
                      <img :src="focusedQueue.slipImage" class="w-full h-full object-cover" />
                      <div @click="viewSlip(focusedQueue.slipImage)" class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm">
                        <span class="text-white font-medium flex items-center gap-2"><Search class="w-5 h-5"/> กดดูเต็มจอ</span>
                      </div>
                    </template>
                    <div v-else class="w-full h-full flex items-center justify-center text-slate-400">ไม่มีรูปสลิป</div>
                  </div>
                  <p class="text-xs text-slate-400 font-mono text-center">อัปโหลดเมื่อ: {{ focusedQueue.time }}</p>
               </div>
               
               <div class="w-full sm:w-1/2 flex flex-col justify-center">
                   <h3 class="text-2xl font-black text-slate-800 mb-4 border-b pb-4 border-slate-100">ข้อมูลการเทรด</h3>
                   <div class="space-y-4">
                      <div>
                         <p class="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">ชื่อตัวละคร Roblox</p>
                         <p class="text-lg font-bold text-blue-700 bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-100 break-all select-all">{{ focusedQueue.name || '-' }}</p>
                      </div>
                      <div>
                         <p class="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">TikTok</p>
                         <p class="text-md font-bold text-pink-700 bg-pink-50 py-1 px-3 rounded-lg border border-pink-100 break-all">{{ focusedQueue.tiktokName || '-' }}</p>
                      </div>
                      <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                         <p class="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">รายการที่ต้องมอบ</p>
                         <ul class="space-y-2">
                           <template v-if="focusedQueue.items && focusedQueue.items.length > 0">
                             <li v-for="(item, i) in focusedQueue.items" :key="i" class="flex flex-col mb-3">
                                <div class="flex justify-between items-start">
                                   <span class="font-medium text-slate-800">{{ item.product.name }}</span>
                                   <span class="font-black text-brand text-lg ml-2 whitespace-nowrap">x{{ item.pieces }}</span>
                                </div>
                                <div v-if="item.product.isRecipe && item.product.recipeItems" class="mt-2 bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                   <p class="text-xs text-slate-500 font-medium mb-1.5 flex items-center gap-1.5"><List class="w-3.5 h-3.5"/> เตรียมวัตถุดิบและนำไปมอบดังนี้:</p>
                                   <ul class="space-y-1">
                                      <li v-for="(req, ri) in item.product.recipeItems" :key="ri" class="flex justify-between text-xs items-center">
                                         <span class="text-slate-600">- {{ req.name }}</span>
                                         <span class="font-bold text-brand bg-brand/5 px-1.5 py-0.5 rounded">x{{ req.pieces * item.pieces }}</span>
                                      </li>
                                   </ul>
                                </div>
                             </li>
                           </template>
                           <template v-else>
                             <li class="flex justify-between items-start">
                                <span class="font-medium text-slate-800">{{ focusedQueue.product }}</span>
                                <span class="font-black text-brand text-lg ml-2 whitespace-nowrap">x{{ focusedQueue.receivedPieces }}</span>
                             </li>
                           </template>
                         </ul>
                      </div>
                      <div class="flex justify-between items-center py-2 border-t border-slate-100 px-2">
                         <span class="text-sm font-medium text-slate-500">ยอดชำระ:</span>
                         <span class="text-xl font-black text-slate-800">{{ focusedQueue.price }} บาท</span>
                      </div>
                   </div>
               </div>
            </div>
            
            <div class="p-4 bg-slate-50 flex flex-col sm:flex-row gap-3 border-t border-slate-200">
               <button @click="skipFocus" class="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all shadow-sm">
                 ข้ามไปคิวถัดไปก่อน
               </button>
               <button @click="focusRejectQueue" class="sm:flex-none py-3 px-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all shadow-sm">
                 ปฏิเสธ
               </button>
               <button @click="focusApproveQueue" class="flex-1 py-3 px-4 bg-brand text-white font-black text-lg rounded-xl hover:bg-brand-dark transition-all shadow-md transform hover:-translate-y-0.5">
                 🎉 เทรดเสร็จแล้ว (อนุมัติ)
               </button>
            </div>
         </div>
         
         <div v-else class="text-center">
            <CheckCircle2 class="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 class="text-xl font-bold text-slate-700">เยี่ยมมาก! ไม่มีคิวตกค้าง</h3>
            <p class="text-slate-500 mt-2">คุณเคลียร์คิวทั้งหมดเสร็จเรียบร้อยแล้ว</p>
         </div>
      </div>
    </div>

    <!-- History Tab -->
    <div v-if="activeTab === 'history'" class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <h2 class="text-lg font-semibold text-slate-800">ประวัติการทำรายการ</h2>
         <!-- History Search -->
         <div class="relative w-full sm:w-72">
           <input 
             v-model="searchHistoryText" 
             type="text" 
             placeholder="ค้นหาชื่อ, UID, รหัสคิว..." 
             class="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:border-brand outline-none"
           />
           <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
         </div>
      </div>
      <div class="divide-y divide-slate-100">
        <div v-for="q in historyQueues" :key="q.id" class="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 hover:bg-slate-50 transition-colors opacity-80 hover:opacity-100">
          
          <div class="w-16 h-24 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 relative group">
            <template v-if="q.paymentMethod === 'wallet'">
               <div class="w-full h-full flex flex-col items-center justify-center bg-emerald-50 text-emerald-600 p-1 text-center text-[10px] leading-tight">
                 <Wallet class="w-4 h-4 mb-0.5 opacity-70" />
                 <b>ทำรายการ<br>ผ่าน<br>Wallet</b>
               </div>
            </template>           
            <template v-else-if="q.slipImage">
              <img :src="q.slipImage" class="w-full h-full object-cover grayscale mix-blend-multiply opacity-50" />
              <div @click="viewSlip(q.slipImage)" class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm">
                <span class="text-xs text-white font-medium text-center">ดูสลิป<br>เต็ม</span>
              </div>
            </template>
            <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center leading-tight">ไม่มี<br>สลิป</div>
          </div>
          
          <div class="flex-grow">
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-slate-800">คิว #{{ q.queueNumber || q.id }}</h3>
              <span v-if="q.status === 'approved'" class="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-xs font-semibold uppercase tracking-wider">อนุมัติแล้ว</span>
              <span v-else class="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-xs font-semibold uppercase tracking-wider">ปฏิเสธ</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-2 text-xs mb-1">
               <span class="text-slate-500">𝗥𝗼𝗯𝗹𝗼𝘅: <b>{{ q.name || '-' }}</b></span>
               <span class="text-slate-500">𝗧𝗶𝗸𝗧𝗼𝗸: <b>{{ q.tiktokName || '-' }}</b></span>
            </div>
            <div class="mt-2 text-sm text-slate-600 line-clamp-2">
               <template v-if="q.items && q.items.length > 0">
                 {{ q.items.map(item => `${item.product.name} (x${item.pieces})`).join(', ') }}
               </template>
               <template v-else>
                 {{ q.product }} (x{{ q.receivedPieces || 0 }})
               </template>
            </div>
            <p class="text-sm font-bold text-slate-800 pt-1 border-t border-slate-100/50 w-max mt-2">ยอดโอนรวม: {{ q.price }} บาท</p>
            <p class="text-xs text-slate-400 mt-2 font-mono">เวลาอัปโหลด: {{ q.time }}</p>
          </div>
        </div>
        <div v-if="historyQueues.length === 0" class="p-8 text-center text-slate-500">
          ยังไม่มีประวัติการทำรายการ
        </div>
      </div>
      
      <!-- Load More Button -->
      <div v-if="hasMoreAdminHistory" class="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
         <button @click="shopStore.loadAdminHistory(false)" class="text-brand font-medium bg-white border border-slate-200 shadow-sm px-6 py-2 rounded-xl hover:bg-slate-100 transition-colors">
            โหลดประวัติเก่าเพิ่มเติม...
         </button>
      </div>
    </div>

    <!-- Product Management Tab -->
    <div v-if="activeTab === 'products'" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 border-slate-100">
        <div>
          <h2 class="text-lg font-semibold text-slate-800">จัดการข้อมูลสินค้าในร้าน</h2>
          <!-- Product View Toggle -->
          <div class="flex bg-slate-100 p-1 rounded-lg mt-3 w-mc">
            <button @click="productViewMode = 'ready'" :class="['px-3 py-1.5 text-sm font-medium rounded-md transition-colors', productViewMode === 'ready' ? 'bg-white shadow-sm text-brand' : 'text-slate-500 hover:text-slate-700']">สินค้าเผยแพร่แล้ว</button>
            <button @click="productViewMode = 'draft'" :class="['px-3 py-1.5 text-sm font-medium rounded-md transition-colors', productViewMode === 'draft' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700']">ฉบับร่าง (รอแก้ไข)</button>
          </div>
        </div>
        
        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <!-- Filter Category -->
          <select v-model="filterProductCategory" class="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand outline-none bg-white">
             <option value="">ทั้งหมด (ทุกหมวดหมู่)</option>
             <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
          <!-- Search Box -->
          <div class="relative flex-grow sm:flex-none sm:w-48">
            <input v-model="searchProductText" type="text" placeholder="ค้นหาสินค้า..." class="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-brand outline-none" />
            <Search class="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
          <button @click="openImportModal" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors shadow-sm ml-auto">
            <Database class="w-4 h-4" /> นำเข้าสต๊อก
          </button>
          <button @click="openAddModal" class="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors shadow-sm">
            <Plus class="w-4 h-4" /> เพิ่มสินค้า
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-100">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100 text-slate-500">
              <th class="px-4 py-3 font-medium">สินค้า / หมวดหมู่</th>
              <th class="px-4 py-3 font-medium">รูปแบบ</th>
              <th class="px-4 py-3 font-medium">ราคา / เรต</th>
              <th class="px-4 py-3 font-medium">สต๊อก</th>
              <th class="px-4 py-3 font-medium text-right">แอคชั่น (บันทึกด่วน)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in filteredProducts" :key="p.id" class="hover:bg-slate-50/50 transition-colors">
              <td class="px-4 py-3">
                 <p class="font-bold text-slate-800">{{ p.name }} <span v-if="p.badge && p.badge !== 'none'" class="ml-1 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded">{{ p.badge }}</span></p>
                 <span class="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">{{ p.category || 'Reroll' }}</span>
              </td>
              <td class="px-4 py-3 text-slate-500 text-xs">
                <span v-if="p.pricingType === 'rate'" class="px-2 py-1 bg-blue-100 text-blue-700 rounded-md">อิงเรต</span>
                <span v-else class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md">ฟิกราคา</span>
              </td>
              <td class="px-4 py-3 text-slate-600">
                 <div class="flex items-center gap-1">
                    <input type="number" v-model.number="p.price" class="w-20 border border-slate-300 rounded px-2 py-1 text-sm outline-brand focus:border-brand" />
                    <span class="text-xs text-slate-400">{{ p.pricingType === 'rate' ? 'ชิ้น/฿' : '฿/ชิ้น' }}</span>
                 </div>
              </td>
              <td class="px-4 py-3 text-slate-600">
                <input type="number" v-model.number="p.quantity" class="w-20 border border-slate-300 rounded px-2 py-1 text-sm outline-brand focus:border-brand" />
              </td>
              <td class="px-4 py-3 text-right space-x-2">
                <button @click="quickSave(p)" class="text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 transition-colors"><Check class="w-3 h-3"/>เซฟเลข</button>
                <button @click="duplicateProduct(p)" class="text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded text-xs font-medium transition-colors">คัดลอก</button>
                <div class="inline-flex gap-2 ml-2 pl-2 border-l border-slate-200">
                   <button @click="openEditModal(p)" class="text-blue-500 hover:text-blue-700 font-medium text-xs transition-colors">แก้ไขเต็ม</button>
                   <button @click="deleteProduct(p.id)" class="text-red-500 hover:text-red-700 font-medium text-xs transition-colors">ลบ</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredProducts.length === 0">
               <td colspan="5" class="px-4 py-8 text-center text-slate-500">ไม่พบสินค้าในหมวดหมู่นี้ หรือคำค้นหานี้</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Categories Management Tab -->
    <div v-if="activeTab === 'categories'" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-semibold text-slate-800">จัดการข้อมูลหมวดหมู่สินค้า</h2>
      </div>
      
      <div class="flex gap-2 w-full max-w-md">
        <input v-model="newCategoryName" type="text" placeholder="พิมพ์ชื่อหมวดหมู่ใหม่ที่นี่..." class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand outline-none" @keyup.enter="addCategory" />
        <button @click="addCategory" class="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-brand-dark transition-colors shadow-sm whitespace-nowrap">
          <Plus class="w-4 h-4" /> เพิ่มหมวดหมู่
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div v-for="cat in categories" :key="cat" class="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl hover:border-brand/30 transition-colors">
          <span class="font-medium text-slate-700 text-sm">{{ cat }}</span>
          <button @click="removeCategory(cat)" class="text-red-400 hover:text-red-600 transition-colors p-1 bg-white rounded-md shadow-sm border border-slate-100 hover:border-red-100">
             <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    
    <!-- Users Management Tab -->
    <div v-if="activeTab === 'users'" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <UserCog class="w-6 h-6 text-emerald-500" /> 
          จัดการรายชื่อผู้ใช้และ Wallet
        </h2>
        <!-- User Search -->
        <div class="relative w-full sm:w-64">
           <input 
             v-model="searchUserText" 
             type="text" 
             placeholder="ค้นหาชื่อ, อีเมล, UID..." 
             class="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:border-emerald-500 outline-none"
           />
           <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>
      
      <div class="overflow-x-auto rounded-xl border border-slate-100">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100 text-slate-500">
              <th class="px-4 py-3 font-medium">โปรไฟล์ / บัญชี</th>
              <th class="px-4 py-3 font-medium">ชื่อในเกม (Roblox)</th>
              <th class="px-4 py-3 font-medium">TikTok</th>
              <th class="px-4 py-3 font-medium">ยอด Wallet</th>
              <th class="px-4 py-3 font-medium text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="u in filteredUsers" :key="u.id" class="hover:bg-slate-50/50 transition-colors">
              <td class="px-4 py-3 flex items-center gap-3">
                 <img v-if="u.photoURL" :src="u.photoURL" class="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                 <div v-else class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><UserCog class="w-4 h-4 text-slate-400" /></div>
                 <div>
                    <p class="font-medium text-slate-800">{{ u.displayName || 'ไม่มีชื่อโปรไฟล์' }}</p>
                    <p class="text-xs text-slate-400 font-mono">{{ u.id.substring(0,8) }}...</p>
                 </div>
              </td>
              <td class="px-4 py-3 text-slate-600">
                <span v-if="u.robloxName" class="font-medium">{{ u.robloxName }}</span>
                <span v-else class="text-slate-400 text-xs italic">ยังไม่กรอก</span>
              </td>
              <td class="px-4 py-3 text-slate-600">
                <span v-if="u.tiktokName">{{ u.tiktokName }}</span>
                <span v-else class="text-slate-400 text-xs italic">ยังไม่กรอก</span>
              </td>
              <td class="px-4 py-3">
                 <span class="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{{ (u.virtualWallet || 0).toLocaleString() }} ฿</span>
              </td>
              <td class="px-4 py-3 text-right space-x-3">
                <button @click="viewUserHistory(u.id)" class="text-blue-500 hover:text-blue-700 font-medium transition-colors text-xs bg-blue-50 px-2 py-1 rounded">ประวัติคิว</button>
                <button @click="openAdjustModal(u.id)" class="text-emerald-600 hover:text-emerald-800 font-medium transition-colors text-xs bg-emerald-100 px-2 py-1 rounded shadow-sm outline outline-1 outline-emerald-200">ปรับยอดเงิน</button>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
               <td colspan="5" class="px-4 py-8 text-center text-slate-500">เงียบเหงาเกินไป ไม่พบข้อมูลผู้ใช้เลย...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Virtual Wallet Adjust Modal -->
    <div v-if="isAdjustModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="isAdjustModalOpen = false"></div>
      <div class="bg-white rounded-2xl w-full max-w-sm relative z-10 overflow-hidden shadow-2xl flex flex-col">
        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
          <h2 class="text-lg font-semibold text-emerald-800 flex items-center gap-2">
             <Wallet class="w-5 h-5 text-emerald-500" /> ปรับลดยอดเงิน
          </h2>
          <button @click="isAdjustModalOpen = false" class="text-emerald-600 hover:text-emerald-800 p-1">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 space-y-4">
           <div>
              <p class="text-sm font-medium text-slate-600 mb-1">UID ของลูกค้า</p>
              <div class="bg-slate-100 px-3 py-2 rounded-lg text-sm text-slate-800 font-mono">{{ targetUid }}</div>
           </div>
           <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">จำนวนหน่วย (บาท)</label>
              <input v-model.number="adjustAmount" type="number" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-300" placeholder="ใส่ค่าลบเพื่อหักออก เช่น -50" />
           </div>
           
           <div v-if="adjustMessage" class="px-4 py-2 rounded-lg text-xs" :class="targetUid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-50 text-red-600'">
             {{ adjustMessage }}
           </div>
        </div>
        <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button @click="isAdjustModalOpen = false" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors">ยกเลิก</button>
          <button @click="handleAdjustWallet" :disabled="isAdjusting" class="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium">
             {{ isAdjusting ? 'กำลังดำเนินการ...' : 'ยืนยัน' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Product Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="isModalOpen = false"></div>
      <div class="bg-white rounded-2xl w-full max-w-md relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 class="text-lg font-semibold text-brand-dark">{{ editingProductId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่' }}</h2>
          <button @click="isModalOpen = false" class="text-slate-400 hover:text-slate-600 p-1">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 overflow-y-auto space-y-4">
          <div class="flex gap-4 flex-col sm:flex-row">
            <div class="flex-1">
              <label class="block text-sm font-medium text-slate-700 mb-1">ชื่อสินค้า</label>
              <input v-model="productForm.name" type="text" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand outline-none" />
            </div>
            <div class="w-full sm:w-1/3 flex-shrink-0">
              <label class="block text-sm font-medium text-slate-700 mb-1">หมวดหมู่</label>
              <select v-model="productForm.category" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand outline-none bg-white">
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
            <div class="w-full sm:w-1/4 flex-shrink-0">
              <label class="block text-sm font-medium text-slate-700 mb-1">ป้ายกำกับ</label>
              <select v-model="productForm.badge" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand outline-none bg-white">
                <option value="none">ไม่มี</option>
                <option value="new">New</option>
                <option value="promotion">Promotion</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">รายละเอียด</label>
            <textarea v-model="productForm.description" rows="3" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand outline-none"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">รูปแบบการขาย</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm cursor-pointer p-2 border border-slate-200 rounded-lg shrink-0 flex-1 justify-center transition-colors hover:bg-slate-50" :class="{'ring-2 ring-brand border-brand bg-brand-light/20': productForm.pricingType === 'fixed'}">
                <input type="radio" value="fixed" v-model="productForm.pricingType" class="hidden" /> 
                <Package class="w-4 h-4 text-slate-500" :class="{'text-brand': productForm.pricingType === 'fixed'}" /> ขายราคาฟิก (บาท/ชิ้น)
              </label>
              <label class="flex items-center gap-2 text-sm cursor-pointer p-2 border border-slate-200 rounded-lg shrink-0 flex-1 justify-center transition-colors hover:bg-slate-50" :class="{'ring-2 ring-brand border-brand bg-brand-light/20': productForm.pricingType === 'rate'}">
                <input type="radio" value="rate" v-model="productForm.pricingType" class="hidden" /> 
                <Tag class="w-4 h-4 text-slate-500" :class="{'text-brand': productForm.pricingType === 'rate'}" /> ขายตามเรต (ชิ้น/บาท)
              </label>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-slate-700 mb-1">
                {{ productForm.pricingType === 'rate' ? 'เรต (ชิ้น ต่อ 1 บาท)' : 'ราคา (บาท ต่อ 1 ชิ้น)' }}
          </label>
              <input v-model.number="productForm.price" type="number" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand outline-none" />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-slate-700 mb-1">จำนวนสต๊อก <span v-if="productForm.isRecipe" class="text-xs text-brand font-normal">(คำนวณอัตโนมัติ)</span></label>
              <input v-model.number="productForm.quantity" type="number" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" :class="productForm.isRecipe ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'focus:border-brand'" :disabled="productForm.isRecipe" />
            </div>
          </div>
          
          <div class="space-y-4 border border-slate-200 rounded-xl p-4 bg-slate-50">
             <label class="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input type="checkbox" v-model="productForm.isRecipe" class="w-4 h-4 text-brand rounded border-slate-300 focus:ring-brand" />
                🛠️ กำหนดเป็นสินค้าสั่งคราฟท์ (ใช้ชิ้นส่วนวัตถุดิบ)
             </label>
             <div v-if="productForm.isRecipe" class="mt-3 pt-3 border-t border-slate-200">
                <p class="text-xs text-slate-500 mb-3">เมื่อลูกค้าสั่งซื้อ ระบบจะทำการหักสต๊อกจากวัตถุดิบเหล่านี้แทน</p>
                
                <div class="flex flex-wrap gap-2 mb-3">
                   <select v-model="newRecipeItemId" class="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none w-full min-w-[150px]">
                      <option value="" disabled>เลือกวัตถุดิบ...</option>
                      <option v-for="p in products.filter(x => !x.isRecipe && x.id !== editingProductId)" :key="p.id" :value="p.id">{{ p.name }} (เหลือ {{ p.quantity }})</option>
                   </select>
                   <input v-model.number="newRecipeItemPieces" type="number" min="1" class="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none text-center" placeholder="จำนวน" />
                   <button @click.prevent="addRecipeItem" class="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm whitespace-nowrap hover:bg-slate-700 w-full sm:w-auto">เพิ่มส่วนผสม</button>
                </div>
                
                <ul class="space-y-1">
                   <li v-for="(req, i) in productForm.recipeItems" :key="i" class="flex justify-between items-center bg-white border border-slate-100 px-3 py-2 rounded text-sm font-medium text-slate-700 shadow-sm">
                      <span>{{ req.name }}</span>
                      <div class="flex items-center gap-3">
                         <span class="text-brand font-bold">x{{ req.pieces }}</span>
                         <button @click.prevent="removeRecipeItem(i)" class="text-red-400 hover:text-red-600"><X class="w-4 h-4"/></button>
                      </div>
                   </li>
                </ul>
                <div v-if="!productForm.recipeItems || productForm.recipeItems.length === 0" class="text-xs text-slate-400 italic text-center py-2">
                   ยังไม่ได้เพิ่มสูตรวัตถุดิบ
                </div>
             </div>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-slate-700">รูปภาพสินค้า</label>
            <div class="flex items-center gap-4">
              <div v-if="productForm.image" class="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                <img :src="productForm.image" class="w-full h-full object-cover" />
              </div>
              <div class="flex-grow">
                <input type="file" accept="image/*" @change="handleImageUpload" class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-light file:text-brand hover:file:bg-brand/20 transition-colors cursor-pointer outline-none" />
                <p class="text-xs text-slate-400 mt-1">สามารถอัปโหลดรูปจากเครื่องของคุณได้เลย</p>
              </div>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button @click="isModalOpen = false" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors">ยกเลิก</button>
          <button @click="saveProduct" :disabled="isSubmitting" class="px-4 py-2 rounded-xl bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
             {{ isSubmitting ? 'กำลังบันทึก...' : 'บันทึก' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Import Modal -->
    <div v-if="isImportModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="isImportModalOpen = false"></div>
      <div class="bg-white rounded-2xl w-full max-w-3xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-purple-50">
          <h2 class="text-lg font-semibold text-purple-800 flex items-center gap-2">
            <Database class="w-5 h-5 text-purple-600" /> นำเข้าสต๊อกอัจฉริยะ (Bulk Import)
          </h2>
          <button @click="isImportModalOpen = false" class="text-slate-400 hover:text-slate-600 p-1">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto space-y-4">
           <div v-if="!isImportAnalyzed">
              <label class="block text-sm font-medium text-slate-700 mb-2">วางแพทเทิร์นข้อความ (เช่น "10x Adamantite")</label>
              <textarea v-model="importText" rows="10" placeholder="วางข้อความที่ก๊อปปี้มาจากในเกมตรงนี้..." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-purple-500 outline-none font-mono"></textarea>
           </div>
           
           <div v-else class="space-y-6">
              <div class="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-100">
                 รบกวนตรวจสอบข้อมูลก่อนยืนยัน! ระบบพบ <b>ของเก่า {{ importUpdateItems.length }} รายการ</b> และจะสร้าง <b>ของใหม่ {{ importNewItems.length }} รายการ</b>
              </div>
              
              <div class="flex flex-col sm:flex-row gap-6">
                 <!-- Update Column -->
                 <div class="flex-1 space-y-2">
                    <h3 class="font-bold text-slate-700 flex items-center gap-2 border-b pb-2"><Check class="w-4 h-4 text-emerald-500"/> ของเก่า (แทนที่สต๊อกเดิม)</h3>
                    <div class="max-h-64 overflow-y-auto space-y-1">
                       <div v-for="(item, i) in importUpdateItems" :key="i" class="text-sm py-1 border-b border-slate-50 flex justify-between">
                          <span class="text-slate-600 break-all pr-2">{{ item.name }}</span>
                          <span class="font-bold text-emerald-600 whitespace-nowrap">{{ item.oldQuantity }} ➔ {{ item.quantity }}</span>
                       </div>
                       <p v-if="importUpdateItems.length === 0" class="text-slate-400 text-sm italic">ไม่มีรายการอัปเดต</p>
                    </div>
                 </div>
                 
                 <!-- New Column -->
                 <div class="flex-1 space-y-2">
                    <h3 class="font-bold text-slate-700 flex items-center gap-2 border-b pb-2"><Plus class="w-4 h-4 text-purple-500"/> ของใหม่ (สร้างเพิ่ม)</h3>
                    <div class="max-h-64 overflow-y-auto space-y-1">
                       <div v-for="(item, i) in importNewItems" :key="i" class="text-sm py-1 border-b border-slate-50 flex justify-between">
                          <span class="text-slate-600 break-all pr-2">{{ item.name }}</span>
                          <span class="font-bold text-purple-600 whitespace-nowrap">+{{ item.quantity }}</span>
                       </div>
                       <p v-if="importNewItems.length === 0" class="text-slate-400 text-sm italic">ไม่มีรายการเพิ่มใหม่</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button v-if="isImportAnalyzed" @click="isImportAnalyzed = false" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors mr-auto">ซ่อนและแก้ข้อความใหม่</button>
          
          <button @click="isImportModalOpen = false" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors">ยกเลิก</button>
          
          <button v-if="!isImportAnalyzed" @click="analyzeImport" class="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors">วิเคราะห์ข้อความ</button>
          
          <button v-else @click="confirmImport" :disabled="isImporting" class="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 font-bold">
             {{ isImporting ? 'กำลังซิงค์...' : 'ยืนยันการนำเข้าสต๊อก' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Slip Viewer Modal -->
    <div v-if="viewingSlipUrl" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" @click="closeSlip"></div>
      <div class="relative z-10 max-w-2xl max-h-[90vh] bg-transparent flex flex-col items-center">
        <button @click="closeSlip" class="absolute -top-12 right-0 text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors">
          <X class="w-6 h-6" />
        </button>
        <img :src="viewingSlipUrl" class="w-auto h-auto max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border-2 border-white/10" />
      </div>
    </div>
  </div>
</template>
