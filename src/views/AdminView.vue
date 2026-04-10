<script setup>
import { ref, computed } from 'vue';
import { Package, Users, Settings, Tag, Plus, Check, X, History, Layers, Wallet } from 'lucide-vue-next';

import { useShopStore } from '../stores/shop';
import { useAuthStore } from '../stores/auth';
import { storeToRefs } from 'pinia';

const shopStore = useShopStore();
const authStore = useAuthStore();
const { products, queues: currentQueues, categories } = storeToRefs(shopStore);

// View State: 'products' | 'queue' | 'history' | 'categories' | 'wallet'
const activeTab = ref('queue');

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
      targetUid.value = '';
      adjustAmount.value = 0;
   }
   isAdjusting.value = false;
};

const newCategoryName = ref('');
const addCategory = async () => {
  const name = newCategoryName.value.trim();
  if (!name) return;
  if (categories.value.includes(name)) {
    alert('มีหมวดหมู่นี้อยู่แล้ว');
    return;
  }
  const updatedCategories = [...categories.value, name];
  await shopStore.updateCategories(updatedCategories);
  newCategoryName.value = '';
};

const removeCategory = async (catToRemove) => {
  if (confirm(`คุณต้องการลบหมวดหมู่ "${catToRemove}" ใช่หรือไม่?`)) {
    const updatedCategories = categories.value.filter(cat => cat !== catToRemove);
    await shopStore.updateCategories(updatedCategories);
  }
};

const waitingQueues = computed(() => currentQueues.value.filter(q => q.status === 'waiting'));
const historyQueues = computed(() => currentQueues.value.filter(q => q.status !== 'waiting'));

const approveQueue = (id) => { shopStore.updateQueueStatus(id, 'approved'); };
const rejectQueue = (id) => { shopStore.updateQueueStatus(id, 'rejected'); };

const isModalOpen = ref(false);
const editingProductId = ref(null);
const productForm = ref({ name: '', description: '', price: 0, quantity: 1, image: '', pricingType: 'fixed', category: 'Reroll', badge: 'none' });
const imageRawFile = ref(null);
const isSubmitting = ref(false);

const viewingSlipUrl = ref(null);
const viewSlip = (url) => { viewingSlipUrl.value = url; };
const closeSlip = () => { viewingSlipUrl.value = null; };

const openAddModal = () => {
  editingProductId.value = null;
  productForm.value = { name: '', description: '', price: 0, quantity: 1, image: '', pricingType: 'fixed', category: 'Reroll', badge: 'none' };
  imageRawFile.value = null;
  isModalOpen.value = true;
};

const openEditModal = (product) => {
  editingProductId.value = product.id;
  productForm.value = { ...product };
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
  if(editingProductId.value) {
    await shopStore.updateProduct(editingProductId.value, productForm.value, imageRawFile.value);
  } else {
    await shopStore.addProduct(productForm.value, imageRawFile.value);
  }
  isSubmitting.value = false;
  isModalOpen.value = false;
};

const deleteProduct = (id) => {
  if (confirm('คุณต้องการลบสินค้านี้ใช่หรือไม่?')) {
    shopStore.deleteProduct(id);
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
          @click="activeTab = 'wallet'"
          :class="['px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none', activeTab === 'wallet' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:text-slate-700']"
        >
          <Wallet class="w-4 h-4" /> Virtual Wallet
        </button>
      </div>
    </div>

    <!-- Queue Management Tab -->
    <div v-if="activeTab === 'queue'" class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center">
         <h2 class="text-lg font-semibold text-slate-800">รายการรอยืนยันสลิป</h2>
         <span class="text-brand font-bold bg-brand/10 px-3 py-1 rounded-full text-sm">{{ waitingQueues.length }} รายการ</span>
      </div>
      <div class="divide-y divide-slate-100">
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
                 <p v-for="(item, i) in q.items" :key="i" class="text-sm text-slate-600">
                    <span class="text-slate-400 mr-1">-</span> {{ item.product.name }} 
                    <span class="text-brand font-medium ml-1">x{{ item.pieces }} ชิ้น</span>
                 </p>
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
    </div>

    <!-- History Tab -->
    <div v-if="activeTab === 'history'" class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="p-6 border-b border-slate-100">
         <h2 class="text-lg font-semibold text-slate-800">ประวัติการทำรายการ</h2>
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
    </div>

    <!-- Product Management Tab -->
    <div v-if="activeTab === 'products'" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-semibold text-slate-800">จัดการข้อมูลสินค้าในร้าน</h2>
        <button @click="openAddModal" class="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-brand-dark transition-colors shadow-sm">
          <Plus class="w-4 h-4" /> เพิ่มสินค้าใหม่
        </button>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-100">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100 text-slate-500">
              <th class="px-4 py-3 font-medium">ชื่อสินค้า</th>
              <th class="px-4 py-3 font-medium">หมวดหมู่</th>
              <th class="px-4 py-3 font-medium">รูปแบบการขาย</th>
              <th class="px-4 py-3 font-medium">ราคา / เรต</th>
              <th class="px-4 py-3 font-medium">จำนวนที่มีโค้ด/สต๊อก</th>
              <th class="px-4 py-3 font-medium text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in products" :key="p.id" class="hover:bg-slate-50/50 transition-colors">
              <td class="px-4 py-3 font-medium text-slate-800">{{ p.name }}</td>
              <td class="px-4 py-3 text-slate-500">
                <span class="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">{{ p.category || 'Reroll' }}</span>
              </td>
              <td class="px-4 py-3 text-slate-500 text-xs">
                <span v-if="p.pricingType === 'rate'" class="px-2 py-1 bg-blue-100 text-blue-700 rounded-md">อิงเรต</span>
                <span v-else class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md">ฟิกราคา</span>
              </td>
              <td class="px-4 py-3 text-slate-600">
                <span v-if="p.pricingType === 'rate'" class="text-brand font-medium">เรต {{ p.price }} ชิ้น/บาท</span>
                <span v-else>{{ p.price }} บาท/ชิ้น</span>
              </td>
              <td class="px-4 py-3 text-slate-600">{{ p.quantity }}</td>
              <td class="px-4 py-3 text-right space-x-3">
                <button @click="openEditModal(p)" class="text-brand hover:text-brand-dark font-medium transition-colors">แก้ไข</button>
                <button @click="deleteProduct(p.id)" class="text-red-500 hover:text-red-700 font-medium transition-colors">ลบ</button>
              </td>
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
    
    <!-- Virtual Wallet Tab -->
    <div v-if="activeTab === 'wallet'" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Wallet class="w-6 h-6 text-emerald-500" /> 
          จัดการ Virtual Wallet (เติมเงิน / หักเงิน)
        </h2>
      </div>
      
      <div class="bg-emerald-50/50 border border-emerald-100 p-6 rounded-xl space-y-4 max-w-xl">
        <p class="text-sm text-slate-600">คุณสามารถปรับยอดเงินในกระเป๋าลูกค้าได้โดยตรง หากต้องการหักเงินให้ใส่ตัวเลขติดลบ (เช่น -50)</p>
        
        <div class="space-y-4">
           <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">UID ของลูกค้า (คัดลอกได้จากโปรไฟล์ลูกค้า)</label>
              <input v-model="targetUid" type="text" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all" placeholder="วาง UID ที่นี่" />
           </div>
           <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">จำนวนหน่วย (บาท)</label>
              <input v-model.number="adjustAmount" type="number" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all" placeholder="ช่องนี้ใส่เฉพาะตัวเลข" />
           </div>
           
           <div v-if="adjustMessage" class="px-4 py-2 rounded-lg text-sm bg-slate-100 font-medium">
             {{ adjustMessage }}
           </div>
           
           <button @click="handleAdjustWallet" :disabled="isAdjusting" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 mt-2">
             {{ isAdjusting ? 'กำลังดำเนินการ...' : 'ยืนยันการปรับยอดเงิน' }}
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
              <label class="block text-sm font-medium text-slate-700 mb-1">จำนวนสต๊อก</label>
              <input v-model.number="productForm.quantity" type="number" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand outline-none" />
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
