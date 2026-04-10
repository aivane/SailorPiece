<script setup>
import { ref, computed } from 'vue';
import { ShoppingCart, UploadCloud, X, Search } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { useShopStore } from '../stores/shop';
import { useAuthStore } from '../stores/auth';
import { storeToRefs } from 'pinia';

const router = useRouter();
const shopStore = useShopStore();
const authStore = useAuthStore();
const { products, cart, cartTotalBaht, categories: storeCategories } = storeToRefs(shopStore);
const { user } = storeToRefs(authStore);

const categories = computed(() => ['ทั้งหมด', ...storeCategories.value]);
const activeCategory = ref('ทั้งหมด');
const searchQuery = ref('');

const filteredProducts = computed(() => {
  let result = products.value;
  
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
const slipImage = ref(null);
const slipRawFile = ref(null);
const robloxName = ref('');
const purchaseQuantity = ref('');
const isSubmitting = ref(false);

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
    alert('กรุณาเข้าสู่ระบบด้วย Google ก่อนทำการสั่งซื้อครับ');
    authStore.loginWithGoogle();
    return;
  }
  selectedProduct.value = product;
  purchaseQuantity.value = '';
  isAddModalOpen.value = true;
};

const closeAddModal = () => {
  isAddModalOpen.value = false;
  selectedProduct.value = null;
  purchaseQuantity.value = '';
};

const confirmAddToCart = () => {
  const amount = Number(purchaseQuantity.value) || 0;
  if (amount <= 0) {
    alert('กรุณาระบุจำนวนชิ้นที่ต้องการ');
    return;
  }
  
  const existingCartItem = cart.value.find(i => i.product.id === selectedProduct.value.id);
  const currentCartPieces = existingCartItem ? existingCartItem.pieces : 0;
  const totalAttemptedPieces = calculatedPieces.value + currentCartPieces;

  if (totalAttemptedPieces > selectedProduct.value.quantity) {
    if (currentCartPieces > 0) {
      alert(`สต๊อกสินค้าไม่พอครับ (คุณหยิบใส่ตะกร้าไว้แล้ว ${currentCartPieces} ชิ้น ปัจจุบันเหลือสต๊อก ${selectedProduct.value.quantity} ชิ้น)`);
    } else {
      alert('สต๊อกสินค้าไม่พอสำหรับจำนวนที่คุณต้องการซื้อ');
    }
    return;
  }
  
  shopStore.addToCart(selectedProduct.value, calculatedPieces.value, calculatedBaht.value);
  closeAddModal();
};

const openCartModal = () => {
  if (cart.value.length === 0) {
    alert('ตะกร้าสินค้ายังว่างเปล่าครับ');
    return;
  }
  robloxName.value = '';
  slipImage.value = null;
  slipRawFile.value = null;
  isCartModalOpen.value = true;
};

const closeCartModal = () => {
  isCartModalOpen.value = false;
  robloxName.value = '';
  slipImage.value = null;
  slipRawFile.value = null;
  isSubmitting.value = false;
};

const handleSlipUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    slipRawFile.value = file;
    slipImage.value = URL.createObjectURL(file);
  }
};

const submitOrder = async () => {
  if (!robloxName.value || !slipRawFile.value) {
    alert('กรุณากรอกชื่อ Roblox และแนบสลิปการโอนเงินให้ครบถ้วน');
    return;
  }
  
  // หายนะเคส (Worst case scenario): ระหว่างลูกค้ากำลังจะจ่ายเงิน มีคนอื่นเหมาสต๊อกไปแล้ว!
  for (const item of cart.value) {
    const upToDateProduct = products.value.find(p => p.id === item.product.id);
    if (!upToDateProduct || item.pieces > upToDateProduct.quantity) {
      alert(`ขออภัยครับ สินค้า "${item.product.name}" ตอนนี้เหลือสต๊อกเพียง ${upToDateProduct ? upToDateProduct.quantity : 0} ชิ้น กรุณาลบออกแล้วระบุจำนวนใหม่`);
      return;
    }
  }
  
  isSubmitting.value = true;
  
  const mockQueueId = await shopStore.addQueue({
    name: robloxName.value,
    uid: user.value ? user.value.uid : null,
    price: cartTotalBaht.value,
    items: cart.value.map(item => ({ product: item.product, pieces: item.pieces, price: item.baht }))
  }, slipRawFile.value);

  isSubmitting.value = false;
  closeCartModal();
  if (mockQueueId) {
    router.push(`/queue/${mockQueueId}`);
  } else {
    alert('เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ');
  }
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
      <div class="text-center sm:text-left">
        <h1 class="text-3xl font-bold text-brand-dark">สินค้าทั้งหมด</h1>
        <p class="text-slate-500 mt-2">เลือกซื้อสินค้าและแนบสลิปเพื่อเข้าสู่ระบบคิว</p>
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
      <div v-for="product in filteredProducts" :key="product.id" class="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border border-slate-100 flex flex-col group">
        <div class="aspect-square w-full bg-slate-50 rounded-xl mb-4 overflow-hidden relative">
          <img :src="product.image" :alt="product.name" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 contrast-105 saturate-105 [image-rendering:-webkit-optimize-contrast]" />
          <!-- Badges -->
          <div v-if="product.badge === 'new'" class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm z-10 animate-pulse border border-red-400">NEW!</div>
          <div v-if="product.badge === 'promotion'" class="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm z-10 border border-yellow-300">PROMO🔥</div>
          
          <div v-if="product.status === 'out-of-stock'" class="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[1px]">
            <span class="bg-slate-800 text-white px-3 py-1 rounded-full text-sm font-medium shadow-sm">สินค้าหมด</span>
          </div>
        </div>
        
        <h3 class="text-lg font-semibold text-brand-dark">{{ product.name }}</h3>
        <p class="text-sm text-slate-500 mt-1 line-clamp-2 flex-grow">{{ product.description }}</p>
        
        <div class="mt-4 flex items-center justify-between">
          <div>
            <div v-if="product.pricingType === 'rate'" class="text-lg font-bold text-brand">เรต {{ formatPrice(product.price) }} ชิ้น/บาท</div>
            <div v-else class="text-lg font-bold text-brand">{{ formatPrice(product.price) }} บาท/ชิ้น</div>
            <div class="text-xs text-slate-400 mt-0.5">มีพร้อมส่ง: {{ formatPrice(product.quantity) }} ชิ้น</div>
          </div>
          
          <button 
            @click="openCheckout(product)"
            :disabled="product.status === 'out-of-stock'"
            class="bg-brand hover:bg-brand-dark text-white p-2.5 rounded-xl disabled:bg-slate-100 disabled:text-slate-300 transition-colors shadow-sm shadow-brand/20 disabled:shadow-none"
          >
            <ShoppingCart class="w-5 h-5" />
          </button>
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
            <img :src="selectedProduct?.image" class="w-16 h-16 rounded-lg object-cover" />
            <div>
              <h3 class="font-medium text-slate-800">{{ selectedProduct?.name }}</h3>
              <p class="text-brand font-bold mt-1">{{ formatPrice(selectedProduct?.price) }}</p>
            </div>
          </div>

          <!-- Form -->
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">
                จำนวนที่ต้องการสั่งซื้อ (ชิ้น)
                <span class="text-red-500">*</span>
              </label>
              <input v-model.number="purchaseQuantity" type="number" min="1" class="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-sm font-medium" placeholder="ระบุจำนวนชิ้น" />
              
              <div v-if="purchaseQuantity > 0" class="mt-2 bg-brand/10 p-3 rounded-xl border border-brand/20">
                <p class="text-brand-dark font-medium text-sm flex justify-between">
                  <span>ยอดรวมที่ต้องโอน:</span>
                  <span class="text-brand font-bold">{{ formatPrice(calculatedBaht) }} บาท</span>
                </p>
                <p v-if="calculatedPieces > selectedProduct?.quantity" class="text-red-500 text-xs mt-1 font-medium">❌ สต๊อกไม่เพียงพอ</p>
              </div>
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

            <div class="bg-brand-light/50 rounded-xl p-4 border border-brand-light">
              <p class="text-sm text-brand-dark font-medium mb-1">ช่องทางสำหรับโอนเงิน</p>
              <p class="text-sm text-slate-600">พร้อมเพย์ (Promptpay): 0811780531</p>
              <p class="text-sm text-slate-600">ทรูมันนี่ (TrueMoney Wallet): 0840100637</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">แนบสลิปโอนเงิน <span class="text-red-500">*</span></label>
              <div class="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors relative cursor-pointer group">
                <input type="file" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" @change="handleSlipUpload" />
                <div v-if="!slipImage" class="space-y-2 pointer-events-none">
                  <div class="w-10 h-10 bg-brand-light rounded-full flex items-center justify-center mx-auto text-brand">
                    <UploadCloud class="w-5 h-5" />
                  </div>
                  <p class="text-sm text-slate-500">คลิก หรือ ลากสลิปมาวางที่นี่</p>
                </div>
                <div v-else class="relative pointer-events-none">
                  <img :src="slipImage" class="max-h-40 mx-auto rounded-lg shadow-sm" />
                  <div class="absolute inset-0 bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                    <span class="text-brand font-medium text-sm drop-shadow-md">เปลี่ยนสลิป</span>
                  </div>
                </div>
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
