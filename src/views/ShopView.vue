<script setup>
import { ref, computed } from 'vue';
import { ShoppingCart, UploadCloud, X, Search, Wallet } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { useShopStore } from '../stores/shop';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';
import { storeToRefs } from 'pinia';

const router = useRouter();
const shopStore = useShopStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const { products, cart, cartTotalBaht, categories: storeCategories } = storeToRefs(shopStore);
const { user, userProfile } = storeToRefs(authStore);

const categories = computed(() => ['ทั้งหมด', ...storeCategories.value]);
const activeCategory = ref('ทั้งหมด');
const searchQuery = ref('');

const filteredProducts = computed(() => {
  // First, filter out items that don't have an image or are priced at 0 (drafts/imported items), or are set to inactive
  let result = products.value.filter(p => p.image && p.price > 0 && p.isActive !== false);
  
  // 1. Filter by category
  if (activeCategory.value !== 'ทั้งหมด') {
    result = result.filter(p => (p.category || 'Reroll').toLowerCase() === activeCategory.value.toLowerCase());
  }
  
  // 2. Filter by search query
  if (searchQuery.value.trim() !== '') {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q)
    );
  }
  
  return result;
});

const formatPrice = (price) => {
  return new Intl.NumberFormat('th-TH').format(price);
};

const selectedProduct = ref(null);
const isAddModalOpen = ref(false);
const isCartModalOpen = ref(false);
const robloxName = ref('');
const paymentMethod = ref('wallet'); // Hardcoded to wallet
const purchaseQuantity = ref('');
const purchaseBahtInput = ref('');
const isSubmitting = ref(false);

const onUpdatePieces = () => {
  const pieces = Number(purchaseQuantity.value) || 0;
  if (!selectedProduct.value) {
    purchaseBahtInput.value = '';
    return;
  }
  if (pieces === 0) {
    purchaseBahtInput.value = '';
    return;
  }
  if (selectedProduct.value.pricingType === 'rate') {
    purchaseBahtInput.value = pieces / selectedProduct.value.price;
  } else {
    purchaseBahtInput.value = pieces * selectedProduct.value.price;
  }
};

const onUpdateBaht = () => {
  const baht = Number(purchaseBahtInput.value) || 0;
  if (!selectedProduct.value) {
    purchaseQuantity.value = '';
    return;
  }
  if (baht === 0) {
    purchaseQuantity.value = '';
    return;
  }
  if (selectedProduct.value.pricingType === 'rate') {
    purchaseQuantity.value = Math.floor(baht * selectedProduct.value.price);
  } else {
    purchaseQuantity.value = Math.floor(baht / selectedProduct.value.price);
  }
};

const calculatedPieces = computed(() => {
  return Number(purchaseQuantity.value) || 0;
});

const calculatedBaht = computed(() => {
  const pieces = Number(purchaseQuantity.value) || 0;
  if (!selectedProduct.value) return 0;
  if (selectedProduct.value.pricingType === 'rate') {
    return pieces / selectedProduct.value.price;
  }
  return pieces * selectedProduct.value.price;
});

const openCheckout = (product) => {
  if (!user.value) {
    uiStore.showAlert('กรุณาเข้าสู่ระบบด้วย Google ก่อนทำการสั่งซื้อครับ', 'error');
    authStore.loginWithGoogle();
    return;
  }
  selectedProduct.value = product;
  purchaseQuantity.value = '';
  purchaseBahtInput.value = '';
  isAddModalOpen.value = true;
};

const closeAddModal = () => {
  isAddModalOpen.value = false;
  selectedProduct.value = null;
  purchaseQuantity.value = '';
  purchaseBahtInput.value = '';
};

const confirmAddToCart = () => {
  const amount = Number(purchaseQuantity.value) || 0;
  if (amount <= 0) {
    uiStore.showAlert('กรุณาระบุจำนวนชิ้นที่ต้องการ', 'warning');
    return;
  }
  
  const existingCartItem = cart.value.find(i => i.product.id === selectedProduct.value.id);
  const currentCartPieces = existingCartItem ? existingCartItem.pieces : 0;
  const totalAttemptedPieces = calculatedPieces.value + currentCartPieces;

  if (totalAttemptedPieces > selectedProduct.value.quantity) {
    if (currentCartPieces > 0) {
      uiStore.showAlert(`สต๊อกไม่พอครับ (คุณหยิบใส่ตะกร้าไว้แล้ว ${currentCartPieces} ปัจจุบันเหลือสต๊อก ${selectedProduct.value.quantity} ชิ้น)`, 'error');
    } else {
      uiStore.showAlert('สต๊อกสินค้าไม่พอสำหรับจำนวนที่คุณต้องการซื้อ', 'error');
    }
    return;
  }
  
  shopStore.addToCart(selectedProduct.value, calculatedPieces.value, calculatedBaht.value);
  closeAddModal();
};

const openCartModal = () => {
  if (cart.value.length === 0) {
    uiStore.showAlert('ตะกร้าสินค้ายังว่างเปล่าครับ', 'warning');
    return;
  }
  robloxName.value = userProfile.value?.robloxName || '';
  paymentMethod.value = 'wallet';
  isCartModalOpen.value = true;
};

const closeCartModal = () => {
  isCartModalOpen.value = false;
  robloxName.value = '';
  isSubmitting.value = false;
};
const submitOrder = async () => {
  if (!robloxName.value) {
    uiStore.showAlert('กรุณากรอกชื่อ Roblox ให้ครบถ้วน', 'warning');
    return;
  }
  if (!userProfile.value || userProfile.value.virtualWallet < cartTotalBaht.value) {
     uiStore.showAlert('ยอดเงินใน Virtual Wallet ของคุณมีไม่เพียงพอ กรุณาเติมเงินก่อนสั่งซื้อครับ', 'error');
     return;
  }
  
  // หายนะเคส (Worst case scenario): ระหว่างลูกค้ากำลังจะจ่ายเงิน มีคนอื่นเหมาสต๊อกไปแล้ว!
  for (const item of cart.value) {
    const upToDateProduct = products.value.find(p => p.id === item.product.id);
    if (!upToDateProduct || item.pieces > upToDateProduct.quantity) {
      uiStore.showAlert(`ขออภัยครับ สินค้า "${item.product.name}" ตอนนี้เหลือสต๊อกเพียง ${upToDateProduct ? upToDateProduct.quantity : 0} ชิ้น กรุณาลบออกแล้วระบุจำนวนใหม่`, 'error');
      return;
    }
  }
  
  isSubmitting.value = true;

  const adjustRes = await authStore.adjustWallet(user.value.uid, -cartTotalBaht.value);
  if (!adjustRes.success) {
      uiStore.showAlert('เกิดข้อผิดพลาดในการตัดเงินจาก Wallet: ' + adjustRes.message, 'error');
      isSubmitting.value = false;
      return;
  }
  
  const queueRes = await shopStore.addQueue({
    name: robloxName.value,
    tiktokName: userProfile.value?.tiktokName || '',
    paymentMethod: 'wallet',
    uid: user.value ? user.value.uid : null,
    price: cartTotalBaht.value,
    items: cart.value.map(item => ({ product: item.product, pieces: item.pieces, price: item.baht }))
  }, null);

  isSubmitting.value = false;
  closeCartModal();
  if (queueRes && queueRes.success) {
    shopStore.clearCart(); // ล้างรถเข็นเมื่อสั่งซื้อสำเร็จ
    uiStore.showAlert('สั่งซื้อสำเร็จ! รอรับคิวได้เลย', 'success');
    router.push(`/queue/${queueRes.docId}`);
  } else {
    // โอนเงินคืนให้ลูกค้าอัตโนมัติหากสร้างคิวไม่สำเร็จ
    await authStore.adjustWallet(user.value.uid, cartTotalBaht.value);
    uiStore.showAlert(queueRes?.message || 'เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ (ระบบได้คืนเงินเรียบร้อยแล้ว)', 'error');
  }
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
      <div class="text-center sm:text-left">
        <h1 class="text-3xl font-bold text-brand-dark">สินค้าทั้งหมด</h1>
        <p class="text-slate-500 mt-2">เลือกซื้อสินค้าโดยใช้ยอดเงินใน Virtual Wallet ของคุณ</p>
      </div>

      <!-- Search Bar -->
      <div class="relative w-full sm:w-72 flex-shrink-0">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="ค้นหาสินค้า..." 
          class="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-sm bg-white"
        />
        <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      </div>
    </div>

    <!-- Category Filter -->
    <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      <button 
        v-for="cat in categories" :key="cat"
        @click="activeCategory = cat"
        class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border"
        :class="activeCategory === cat ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand'"
      >
        {{ cat }}
      </button>
    </div>

    <!-- Product Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      <div v-for="product in filteredProducts" :key="product.id" class="bg-white rounded-2xl p-4 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col group relative overflow-hidden">
        <!-- Image Area -->
        <div class="aspect-square w-full bg-slate-50 rounded-xl mb-4 overflow-hidden relative">
          <img :src="product.image" :alt="product.name" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 contrast-105 saturate-105 [image-rendering:-webkit-optimize-contrast]" />
          
          <!-- Badges -->
          <div class="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
            <div v-if="product.badge === 'new'" class="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-wider animate-pulse w-max">NEW</div>
            <div v-if="product.badge === 'promotion'" class="bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-wider w-max">HOT🔥</div>
          </div>
          
          <div v-if="product.status === 'out-of-stock'" class="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[2px]">
             <span class="bg-slate-800 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">สินค้าหมด</span>
          </div>
        </div>
        
        <!-- Content Area -->
        <div class="flex flex-col flex-grow">
          <h3 class="text-lg font-bold text-slate-800 line-clamp-1 leading-tight group-hover:text-brand transition-colors">{{ product.name }}</h3>
          <p v-if="product.description" class="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{{ product.description }}</p>
          <div v-else class="flex-grow"></div> <!-- Spacer if no description -->
          
          <div v-if="product.isRecipe && product.recipeItems" class="mt-2.5 text-[11px] bg-amber-50/50 text-slate-600 px-2.5 py-1.5 rounded-lg border border-amber-100/50 shadow-sm leading-relaxed">
            <span class="font-bold text-amber-600 flex items-center gap-1 mb-0.5">🛠️ เซ็ตคราฟท์:</span> 
            <span class="opacity-80 line-clamp-1">ดรอป: <span v-for="(req, idx) in product.recipeItems" :key="req.productId">{{req.name}} (x{{req.pieces}})<template v-if="idx < product.recipeItems.length - 1">, </template></span></span>
          </div>
          <div class="flex-grow min-h-[8px]"></div>
          
          <!-- Price & Stock section -->
          <div class="pt-3 flex flex-col border-t border-slate-100 mt-auto">
            <!-- Price Row -->
            <div class="flex items-center h-[28px] mb-2">
                <div v-if="product.pricingType === 'rate'" class="text-[11px] font-semibold text-brand flex items-center gap-1 w-fit bg-brand-light/30 px-2 py-0.5 rounded border border-brand/20">
                   <span class="font-bold">1฿</span>
                   <span class="text-slate-400">=</span>
                   <span class="text-lg font-black text-brand-dark leading-none tracking-tight">{{ formatPrice(product.price) }}</span>
                   <span class="text-slate-500">ชิ้น</span>
                </div>
                <div v-else class="text-xs font-semibold text-brand flex items-baseline gap-1" title="ราคาฟิก">
                   <span class="text-xl font-black text-brand-dark leading-none tracking-tight">{{ formatPrice(product.price) }}</span>
                   <span class="text-[11px] text-slate-500 font-medium tracking-wide">บาท/ชิ้น</span>
                </div>
            </div>
            
            <!-- Stock & Button Row -->
            <div class="flex items-center justify-between">
                <div class="text-[11px] text-slate-500 flex items-center gap-1.5 whitespace-nowrap bg-slate-50 px-2 py-1.5 rounded-md border border-slate-100">
                   <div class="w-1.5 h-1.5 rounded-full" :class="product.quantity > 0 ? 'bg-emerald-500' : 'bg-red-500'"></div>
                   คงเหลือ: <span class="font-bold text-slate-700 ml-0.5 text-xs">{{ formatPrice(product.quantity) }}</span>
                </div>
                
                <!-- Add to Cart Button -->
                <button 
                  @click="openCheckout(product)"
                  :disabled="product.status === 'out-of-stock'"
                  class="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-sm group-hover:scale-105"
                  :class="product.status === 'out-of-stock' ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' : 'bg-brand hover:bg-brand-dark hover:shadow-brand/30 hover:-translate-y-0.5 text-white'"
                >
                  <ShoppingCart class="w-4 h-4" />
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Cart Button -->
    <div v-if="cart.length > 0" class="fixed bottom-6 right-6 z-40">
      <button @click="openCartModal" class="bg-brand text-white p-4 rounded-full shadow-lg shadow-brand/30 hover:bg-brand-dark transition-all hover:scale-105 flex items-center justify-center relative">
        <ShoppingCart class="w-6 h-6" />
        <span class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
          {{ cart.length }}
        </span>
      </button>
    </div>

    <!-- Add to Cart Modal -->
    <div v-if="isAddModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="closeAddModal"></div>
      <div class="bg-white rounded-2xl w-full max-w-md relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 class="text-lg font-semibold text-brand-dark">ระบุจำนวนที่ต้องการ</h2>
          <button @click="closeAddModal" class="text-slate-400 hover:text-slate-600 p-1">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto w-full font-sans">
          <!-- Product Summary -->
          <div class="flex gap-4 mb-6 pb-6 border-b border-slate-100">
            <img :src="selectedProduct?.image" class="w-16 h-16 rounded-lg object-cover bg-slate-100" />
            <div>
              <h3 class="font-medium text-slate-800 mb-1.5">{{ selectedProduct?.name }}</h3>
              <div v-if="selectedProduct?.pricingType === 'rate'" class="text-xs font-bold text-brand bg-brand-light/30 px-2.5 py-1 rounded-lg border border-brand/20 inline-block">1 บาท ได้ <span class="text-sm">{{ formatPrice(selectedProduct?.price) }}</span> ชิ้น</div>
              <div v-else class="text-xs font-bold text-brand bg-brand-light/30 px-2.5 py-1 rounded-lg border border-brand/20 inline-block">ชิ้นละ <span class="text-sm">{{ formatPrice(selectedProduct?.price) }}</span> บาท</div>
            </div>
          </div>

          <div v-if="selectedProduct?.isRecipe && selectedProduct?.recipeItems" class="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
             <p class="text-sm text-amber-800 font-bold mb-1 flex items-center gap-1.5">🛠️ สินค้านี้เป็น "เซ็ตวัตถุดิบ"</p>
             <p class="text-xs text-amber-700/80 mb-3">เมื่อสั่งซื้อ 1 ชิ้น คุณจะได้รับชิ้นส่วนดังต่อไปนี้เพื่อนำไปคราฟท์ต่อในเกม</p>
             <ul class="space-y-1.5">
                <li v-for="req in selectedProduct.recipeItems" :key="req.productId" class="text-xs text-amber-800 flex justify-between bg-amber-100/50 px-2 py-1 rounded">
                   <span>- {{ req.name }}</span>
                   <span class="font-bold">x{{ req.pieces }}</span>
                </li>
             </ul>
          </div>

          <!-- Form -->
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">
                  จำนวน (ชิ้น) <span class="text-red-500">*</span>
                </label>
                <input v-model.number="purchaseQuantity" @input="onUpdatePieces" type="number" min="1" class="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-sm font-medium" placeholder="ระบุชิ้น" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">
                  กำหนดงบ (บาท)
                </label>
                <input v-model.number="purchaseBahtInput" @input="onUpdateBaht" type="number" min="1" class="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-medium" placeholder="ระบุงบประมาณ" />
              </div>
            </div>
              
            <div v-if="purchaseQuantity > 0" class="mt-2 bg-brand/10 p-3 rounded-xl border border-brand/20">
              <p class="text-brand-dark font-medium text-sm flex justify-between">
                <span>ยอดหักจาก Wallet:</span>
                <span class="text-brand font-bold">{{ formatPrice(calculatedBaht) }} บาท</span>
              </p>
              <p class="text-slate-500 text-[10px] mt-1 text-right">*(คุณจะได้รับสินค้า {{ calculatedPieces }} ชิ้น)</p>
              <p v-if="calculatedPieces > selectedProduct?.quantity" class="text-red-500 text-xs mt-1 font-medium">❌ สต๊อกไม่เพียงพอ</p>
            </div>
          </div>
        </div>

        <div class="p-4 border-t border-slate-100 bg-slate-50">
          <button @click="confirmAddToCart" class="w-full bg-brand hover:bg-brand-dark text-white font-medium py-3 rounded-xl transition-colors shadow-sm">
            เพิ่มลงตะกร้า
          </button>
        </div>
      </div>
    </div>

    <!-- Cart / Checkout Modal -->
    <div v-if="isCartModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="closeCartModal"></div>
      <div class="bg-white rounded-2xl w-full max-w-md relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 class="text-lg font-semibold text-brand-dark">ตะกร้าสินค้าของคุณ</h2>
          <button @click="closeCartModal" class="text-slate-400 hover:text-slate-600 p-1">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto w-full font-sans space-y-6">
          <!-- Item List -->
          <div class="space-y-3">
             <div v-for="(item, index) in cart" :key="index" class="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50 group shadow-sm">
                <div class="flex items-center gap-3">
                   <img :src="item.product.image" class="w-10 h-10 rounded-lg object-cover bg-white" />
                   <div>
                      <p class="font-medium text-slate-800 text-sm line-clamp-1">{{ item.product.name }}</p>
                      <p class="text-slate-500 text-xs">x{{ item.pieces }} ชิ้น</p>
                   </div>
                </div>
                <div class="flex items-center gap-3">
                   <span class="font-bold text-brand text-sm">{{ formatPrice(item.baht) }}฿</span>
                   <button @click="shopStore.removeFromCart(index)" class="text-red-400 hover:text-red-600 transition-colors p-1" title="ลบออก">
                      <X class="w-4 h-4" />
                   </button>
                </div>
             </div>
          </div>

          <!-- Total Summary -->
          <div class="flex justify-between items-center py-3 border-y border-slate-100">
             <span class="font-semibold text-slate-800">ยอดรวมทั้งหมด</span>
             <span class="font-bold text-brand text-xl">{{ formatPrice(cartTotalBaht) }} บาท</span>
          </div>

          <!-- Form -->
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">ชื่อภายในเกม Roblox <span class="text-red-500">*</span></label>
              <input v-model="robloxName" type="text" class="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-sm" placeholder="กรอกชื่อ Roblox ของคุณ" />
            </div>

            <div class="space-y-3 pt-2">
               <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex flex-col items-center justify-center text-center">
                  <Wallet class="w-8 h-8 text-emerald-400 mb-2" />
                  <p class="text-emerald-800 font-medium text-sm">ยอดเงินปัจจุบันของคุณคือ {{ formatPrice(userProfile?.virtualWallet || 0) }} บาท</p>
                  <p class="text-emerald-600/80 text-xs mt-1">ระบบจะหักเงินจาก Wallet จำนวน {{ formatPrice(cartTotalBaht) }} บาททันทีที่คุณกดยืนยัน</p>
               </div>
            </div>
          </div>
        </div>

        <div class="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button @click="shopStore.clearCart(); closeCartModal();" class="px-4 py-3 rounded-xl font-medium text-slate-500 hover:bg-slate-200 transition-colors bg-slate-100">ลบตะกร้า</button>
          <button @click="submitOrder" :disabled="isSubmitting" class="flex-1 bg-brand hover:bg-brand-dark text-white font-medium py-3 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {{ isSubmitting ? 'กำลังอัปโหลด...' : 'ชำระเงินและรับคิว' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
