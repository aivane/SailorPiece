<script setup>
import { ref, computed } from 'vue';
import { ShoppingCart, UploadCloud, X } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { useShopStore } from '../stores/shop';
import { useAuthStore } from '../stores/auth';
import { storeToRefs } from 'pinia';

const router = useRouter();
const shopStore = useShopStore();
const authStore = useAuthStore();
const { products } = storeToRefs(shopStore);
const { user } = storeToRefs(authStore);

const formatPrice = (price) => {
  return new Intl.NumberFormat('th-TH').format(price);
};

const selectedProduct = ref(null);
const isModalOpen = ref(false);
const slipImage = ref(null);
const slipRawFile = ref(null);
const customerName = ref('');
const customerPhone = ref('');
const purchaseValue = ref('');
const isSubmitting = ref(false);

const calculatedPieces = computed(() => {
  const val = Number(purchaseValue.value) || 0;
  if (!selectedProduct.value) return 0;
  return selectedProduct.value.pricingType === 'rate' ? val * selectedProduct.value.price : val;
});

const calculatedBaht = computed(() => {
  const val = Number(purchaseValue.value) || 0;
  if (!selectedProduct.value) return 0;
  return selectedProduct.value.pricingType === 'rate' ? val : val * selectedProduct.value.price;
});

const openCheckout = (product) => {
  if (!user.value) {
    alert('กรุณาเข้าสู่ระบบด้วย Google ก่อนทำการสั่งซื้อครับ');
    authStore.loginWithGoogle();
    return;
  }
  selectedProduct.value = product;
  customerName.value = user.value.displayName || '';
  isModalOpen.value = true;
};

const closeCheckout = () => {
  isModalOpen.value = false;
  selectedProduct.value = null;
  slipImage.value = null;
  slipRawFile.value = null;
  customerName.value = '';
  customerPhone.value = '';
  purchaseValue.value = '';
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
  const amount = Number(purchaseValue.value) || 0;
  if (!customerName.value || !slipRawFile.value || amount <= 0) {
    alert('กรุณากรอกข้อมูลให้ครบถ้วนและแนบสลิปการโอนเงิน (จำนวนต้องมากกว่า 0)');
    return;
  }
  if (calculatedPieces.value > selectedProduct.value.quantity) {
    alert('สต๊อกสินค้าไม่พอสำหรับจำนวนที่คุณต้องการซื้อ');
    return;
  }
  
  isSubmitting.value = true;
  
  const mockQueueId = await shopStore.addQueue({
    name: customerName.value,
    product: selectedProduct.value.name,
    price: calculatedBaht.value,
    receivedPieces: calculatedPieces.value
  }, slipRawFile.value);

  isSubmitting.value = false;
  closeCheckout();
  if (mockQueueId) {
    router.push(`/queue/${mockQueueId}`);
  } else {
    alert('เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ');
  }
};
</script>

<template>
  <div class="space-y-6">
    <div class="text-center sm:text-left">
      <h1 class="text-3xl font-bold text-brand-dark">สินค้าทั้งหมด</h1>
      <p class="text-slate-500 mt-2">เลือกซื้อสินค้าและแนบสลิปเพื่อเข้าสู่ระบบคิว</p>
    </div>

    <!-- Product Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="product in products" :key="product.id" class="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border border-slate-100 flex flex-col group">
        <div class="aspect-square w-full bg-slate-50 rounded-xl mb-4 overflow-hidden relative">
          <img :src="product.image" :alt="product.name" class="w-full h-full object-cover transition-transform group-hover:scale-105" />
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

    <!-- Checkout Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="closeCheckout"></div>
      <div class="bg-white rounded-2xl w-full max-w-md relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 class="text-lg font-semibold text-brand-dark">ยืนยันการสั่งซื้อ</h2>
          <button @click="closeCheckout" class="text-slate-400 hover:text-slate-600 p-1">
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
                {{ selectedProduct?.pricingType === 'rate' ? 'จำนวนเงินที่ต้องการเติม (บาท)' : 'จำนวนชิ้นที่ต้องการสั่งซื้อ' }}
                <span class="text-red-500">*</span>
              </label>
              <input v-model.number="purchaseValue" type="number" min="1" class="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-sm font-medium" :placeholder="selectedProduct?.pricingType === 'rate' ? 'เช่น 10' : 'เช่น 1'" />
              
              <div v-if="purchaseValue > 0" class="mt-2 bg-brand/10 p-3 rounded-xl border border-brand/20">
                <p v-if="selectedProduct?.pricingType === 'rate'" class="text-brand-dark font-medium text-sm flex justify-between">
                  <span>สิ่งที่คุณจะได้รับ:</span>
                  <span class="text-brand font-bold">{{ formatPrice(calculatedPieces) }} ชิ้น</span>
                </p>
                <p v-else class="text-brand-dark font-medium text-sm flex justify-between">
                  <span>ยอดรวมที่ต้องโอน:</span>
                  <span class="text-brand font-bold">{{ formatPrice(calculatedBaht) }} บาท</span>
                </p>
                <p v-if="calculatedPieces > selectedProduct?.quantity" class="text-red-500 text-xs mt-1 font-medium">❌ สต๊อกไม่เพียงพอ</p>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">ชื่อ-นามสกุล <span class="text-red-500">*</span></label>
              <input v-model="customerName" type="text" class="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-sm" placeholder="กรอกชื่อของคุณ" />
            </div>

            <!-- Payment Info Mock -->
            <div class="bg-brand-light/50 rounded-xl p-4 border border-brand-light">
              <p class="text-sm text-brand-dark font-medium mb-1">บัญชีสำหรับโอนเงิน</p>
              <p class="text-sm text-slate-600">ธนาคารกสิกรไทย: 123-4-56789-0</p>
              <p class="text-sm text-slate-600">ชื่อบัญชี: บจก. เซเลอร์พีซ</p>
            </div>

            <!-- Upload Slip -->
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

        <div class="p-4 border-t border-slate-100 bg-slate-50">
          <button @click="submitOrder" :disabled="isSubmitting" class="w-full bg-brand hover:bg-brand-dark text-white font-medium py-3 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {{ isSubmitting ? 'กำลังอัปโหลด...' : 'ยืนยันและรับคิว' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
