<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useAuctionStore } from '../stores/auction';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';
import { storeToRefs } from 'pinia';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Gavel, Clock, Coins, User, CheckCircle, AlertTriangle, X, Award, Flame } from 'lucide-vue-next';

const auctionStore = useAuctionStore();
const authStore = useAuthStore();
const uiStore = useUiStore();

const { activeAuctions, endedAuctions } = storeToRefs(auctionStore);
const { user, userProfile } = storeToRefs(authStore);

const activeTab = ref('active'); // 'active' | 'ended'
const selectedAuction = ref(null);
const activeBids = ref([]);
const robloxName = ref('');
const customBidAmount = ref(null);
const isSubmitting = ref(false);

let bidsUnsubscribe = null;
const countdownIntervals = ref({});
const currentTime = ref(new Date());

onMounted(() => {
  auctionStore.initAuctions();
  
  // Update current time every second for reactive countdowns
  const timer = setInterval(() => {
    currentTime.value = new Date();
  }, 1000);

  onUnmounted(() => {
    clearInterval(timer);
    if (bidsUnsubscribe) bidsUnsubscribe();
  });
});

// Watch selected auction to load its live bids
watch(selectedAuction, (newAuction) => {
  if (bidsUnsubscribe) {
    bidsUnsubscribe();
    bidsUnsubscribe = null;
  }
  activeBids.value = [];
  if (newAuction) {
    robloxName.value = userProfile.value?.robloxName || '';
    const bidsQuery = query(collection(db, 'auctions', newAuction.id, 'bids'), orderBy('timestamp', 'desc'));
    bidsUnsubscribe = onSnapshot(bidsQuery, (snapshot) => {
      activeBids.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    // Set default custom bid
    const currentBid = newAuction.currentBid || 0;
    const minIncrement = newAuction.minIncrement || 0;
    const startingPrice = newAuction.startingPrice || 0;
    const bidsCount = newAuction.bidsCount || 0;
    customBidAmount.value = bidsCount > 0 ? (currentBid + minIncrement) : startingPrice;
  }
});

// Format currency
const formatPrice = (price) => {
  return new Intl.NumberFormat('th-TH').format(price);
};

// Calculate time remaining for an auction
const getTimeRemaining = (endTimeStr) => {
  const total = Date.parse(endTimeStr) - currentTime.value.getTime();
  if (total <= 0) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, text: 'หมดเวลาแล้ว' };
  }
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  
  let text = '';
  if (days > 0) text += `${days} วัน `;
  text += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  return { total, days, hours, minutes, seconds, text };
};

// Get current minimum required bid for an auction
const getMinRequiredBid = (auction) => {
  const currentBid = auction.currentBid || 0;
  const minIncrement = auction.minIncrement || 0;
  const startingPrice = auction.startingPrice || 0;
  const bidsCount = auction.bidsCount || 0;
  return bidsCount > 0 ? (currentBid + minIncrement) : startingPrice;
};

// Preset bid amount
const setPresetBid = (increment) => {
  if (!selectedAuction.value) return;
  const minBid = getMinRequiredBid(selectedAuction.value);
  customBidAmount.value = minBid + increment;
};

// Place Bid Handler
const handlePlaceBid = async () => {
  if (!user.value) {
    uiStore.showAlert('กรุณาเข้าสู่ระบบด้วย Google ก่อนประมูลครับ', 'error');
    authStore.loginWithGoogle();
    return;
  }

  if (!robloxName.value.trim()) {
    uiStore.showAlert('กรุณากรอกชื่อ Roblox สำหรับรับสินค้ากรณีชนะประมูลครับ', 'warning');
    return;
  }

  if (!customBidAmount.value || customBidAmount.value < getMinRequiredBid(selectedAuction.value)) {
    uiStore.showAlert('ยอดเสนอราคาต่ำกว่าเกณฑ์ขั้นต่ำครับ', 'warning');
    return;
  }

  const userWallet = userProfile.value?.virtualWallet || 0;
  const currentBid = selectedAuction.value.currentBid || 0;
  let netNeeded = customBidAmount.value;
  
  if (selectedAuction.value.currentBidderUid === user.value.uid) {
    netNeeded = customBidAmount.value - currentBid;
  }

  if (userWallet < netNeeded) {
    uiStore.showAlert(`ยอดเงินใน Wallet ไม่เพียงพอ (ขาดอีก ${formatPrice(netNeeded - userWallet)} บาท)`, 'error');
    return;
  }

  isSubmitting.value = true;
  const res = await auctionStore.placeBid(selectedAuction.value.id, customBidAmount.value, robloxName.value);
  isSubmitting.value = false;

  if (res.success) {
    uiStore.showAlert(res.message, 'success');
  } else {
    uiStore.showAlert(res.message || 'การประมูลขัดข้อง', 'error');
  }
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'กำลังประมวลผล...';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'เมื่อครู่';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return date.toLocaleDateString('th-TH');
};
</script>

<template>
  <div class="space-y-6 font-sans">
    
    <!-- Hero Banner (Golden Obsidian Theme) -->
    <div class="relative bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 p-6 sm:p-8 rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 text-center sm:text-left">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_50%)]"></div>
      <div class="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-widest mb-3 animate-pulse">
            <Flame class="w-3.5 h-3.5" /> LIVE AUCTIONS
          </span>
          <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent">
            ตลาดประมูลสินค้าสุดแรร์
          </h1>
          <p class="text-slate-400 mt-2.5 max-w-lg text-sm sm:text-base leading-relaxed">
            ร่วมชิงไอเทมแรร์ระดับเทพแบบเรียลไทม์! ปลอดภัยสูงสุดด้วยระบบล็อคเงินมัดจำและการโอนเงินคืนอัตโนมัติหากโดนบิดแซง
          </p>
        </div>
        <div class="flex-shrink-0 bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-3">
          <div class="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
            <Gavel class="w-6 h-6 text-amber-400" />
          </div>
          <div class="text-left">
            <p class="text-xs text-slate-500 font-bold">ยอดประมูลรวมทั้งหมด</p>
            <p class="text-lg font-black text-amber-400">{{ activeAuctions.length }} รายการ</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex gap-2 border-b border-slate-200/60 pb-px">
      <button 
        @click="activeTab = 'active'"
        class="px-5 py-3 border-b-2 font-bold text-sm transition-all"
        :class="activeTab === 'active' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'"
      >
        🔥 กำลังประมูล ({{ activeAuctions.length }})
      </button>
      <button 
        @click="activeTab = 'ended'"
        class="px-5 py-3 border-b-2 font-bold text-sm transition-all"
        :class="activeTab === 'ended' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'"
      >
        🏁 การประมูลที่จบแล้ว ({{ endedAuctions.length }})
      </button>
    </div>

    <!-- Main Content Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Auctions List -->
      <div class="lg:col-span-2 space-y-4">
        
        <div v-if="activeTab === 'active' && activeAuctions.length === 0" class="bg-white rounded-2xl p-12 text-center border border-slate-200/60 shadow-sm">
          <Gavel class="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 class="text-lg font-bold text-slate-700">ไม่มีรายการประมูลที่กำลังดำเนินอยู่</h3>
          <p class="text-slate-400 text-sm mt-1">แวะเข้ามาเช็คใหม่ในภายหลังนะค้าบ</p>
        </div>

        <div v-if="activeTab === 'ended' && endedAuctions.length === 0" class="bg-white rounded-2xl p-12 text-center border border-slate-200/60 shadow-sm">
          <Award class="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 class="text-lg font-bold text-slate-700">ยังไม่มีประวัติการประมูลที่สิ้นสุด</h3>
          <p class="text-slate-400 text-sm mt-1">ประวัติรายการประมูลที่สำเร็จแล้วจะแสดงที่นี่</p>
        </div>

        <!-- Auctions Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div 
            v-for="auction in (activeTab === 'active' ? activeAuctions : endedAuctions)" 
            :key="auction.id"
            @click="selectedAuction = auction"
            class="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-xl hover:scale-[1.01] hover:border-amber-500/30 transition-all duration-300 cursor-pointer flex flex-col group relative"
            :class="selectedAuction?.id === auction.id ? 'ring-2 ring-amber-500 border-transparent bg-amber-50/5' : 'border-slate-200/60'"
          >
            <!-- Image Frame -->
            <div class="aspect-video w-full bg-slate-900 overflow-hidden relative border-b border-slate-100 flex items-center justify-center">
              <img :src="auction.image" :alt="auction.title" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              
              <!-- Countdown Badge Overlay -->
              <div 
                v-if="auction.status === 'active' && getTimeRemaining(auction.endsAt).total > 0"
                class="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-white border text-[11px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5"
                :class="getTimeRemaining(auction.endsAt).total < 60000 ? 'border-red-500 text-red-400 animate-pulse bg-red-950/90' : 'border-slate-800'"
              >
                <Clock class="w-3.5 h-3.5 text-amber-500" :class="getTimeRemaining(auction.endsAt).total < 60000 ? 'text-red-400' : ''" />
                {{ getTimeRemaining(auction.endsAt).text }}
              </div>

              <!-- Ended Stamp Badge Overlay -->
              <div v-else class="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center">
                <span class="bg-amber-600 text-white font-black px-4 py-1.5 rounded-full text-xs shadow-lg flex items-center gap-1.5 tracking-wider uppercase">
                  <Award class="w-4 h-4" /> 
                  {{ auction.status === 'completed' ? 'จัดส่งสำเร็จ' : 'สิ้นสุดแล้ว' }}
                </span>
              </div>
            </div>

            <!-- Card Content -->
            <div class="p-4 flex flex-col flex-grow">
              <h3 class="font-extrabold text-slate-800 line-clamp-1 leading-tight group-hover:text-amber-600 transition-colors">{{ auction.title }}</h3>
              <p class="text-xs text-slate-400 line-clamp-2 mt-1 leading-normal">{{ auction.description }}</p>
              
              <div class="flex-grow min-h-[12px]"></div>

              <!-- Bid Rates -->
              <div class="border-t border-slate-100 pt-3 flex items-end justify-between">
                <div>
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ราคาบิดปัจจุบัน</p>
                  <p class="text-2xl font-black text-amber-600 tracking-tight leading-none mt-1">
                    {{ formatPrice(auction.currentBid) }}<span class="text-xs font-semibold text-slate-500 ml-0.5">฿</span>
                  </p>
                </div>
                <div class="text-right">
                  <span class="inline-block bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500">
                    บิดแล้ว: {{ auction.bidsCount || 0 }} ครั้ง
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Winning badge overlay for logged-in user -->
            <div v-if="user && auction.currentBidderUid === user.uid && auction.status === 'active'" class="absolute top-3 right-3 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg border border-white">
              <CheckCircle class="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <!-- Live Bidding Detail Sidebar -->
      <div class="lg:col-span-1">
        
        <div v-if="!selectedAuction" class="bg-white rounded-3xl p-8 text-center border border-slate-200/60 shadow-sm sticky top-20 flex flex-col items-center justify-center min-h-[300px]">
          <Gavel class="w-16 h-16 text-slate-200 mb-4 animate-bounce" />
          <h3 class="text-lg font-extrabold text-slate-700">ร่วมชิงชัยชนะ!</h3>
          <p class="text-slate-400 text-sm mt-1 max-w-xs leading-normal">
            คลิกเลือกรายการไอเทมในกระดานประมูล เพื่อเริ่มเสนอราคาสู้และดูประวัติการประมูลสดๆ แบบเรียลไทม์ได้เลยครับ
          </p>
        </div>

        <div v-else class="bg-white rounded-3xl border border-slate-200/60 shadow-xl overflow-hidden sticky top-20 flex flex-col max-h-[85vh]">
          
          <!-- Detailed Header -->
          <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 class="font-extrabold text-brand-dark flex items-center gap-1.5 text-slate-800">
              <Gavel class="w-5 h-5 text-amber-500" /> ข้อมูลการร่วมชิง
            </h2>
            <button @click="selectedAuction = null" class="text-slate-400 hover:text-slate-600 p-1 bg-white border border-slate-200 rounded-full shadow-sm">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Detailed Scrollable Content -->
          <div class="overflow-y-auto p-5 space-y-5 flex-1 select-none">
            
            <!-- Picture & Title -->
            <div class="flex gap-3">
              <img :src="selectedAuction.image" class="w-20 h-20 rounded-2xl object-cover bg-slate-900 border" />
              <div>
                <h3 class="font-extrabold text-slate-800 leading-snug line-clamp-2">{{ selectedAuction.title }}</h3>
                <p class="text-xs text-slate-400 mt-1 leading-normal line-clamp-2">{{ selectedAuction.description }}</p>
              </div>
            </div>

            <!-- Responsive Dynamic Timer -->
            <div 
              class="rounded-2xl p-4 text-center border font-sans"
              :class="[
                selectedAuction.status !== 'active' ? 'bg-slate-100 border-slate-200 text-slate-500' :
                getTimeRemaining(selectedAuction.endsAt).total < 60000 ? 'bg-gradient-to-r from-red-600 to-amber-600 border-transparent text-white animate-pulse' :
                'bg-slate-900 border-slate-800 text-amber-400'
              ]"
            >
              <p class="text-[10px] uppercase font-black tracking-widest opacity-70">
                {{ selectedAuction.status !== 'active' ? 'การประมูลสิ้นสุดลงแล้ว' : 'ระยะเวลาเสนอราคาสุดท้าย' }}
              </p>
              <h4 class="text-2xl font-black mt-1 tracking-tight">
                {{ selectedAuction.status !== 'active' ? 'ปิดการบิด' : getTimeRemaining(selectedAuction.endsAt).text }}
              </h4>
            </div>

            <!-- Current Winning User Alert -->
            <div v-if="user && selectedAuction.status === 'active'">
              <div 
                v-if="selectedAuction.currentBidderUid === user.uid" 
                class="bg-emerald-50 text-emerald-800 rounded-2xl p-3.5 border border-emerald-200 flex items-start gap-2.5 shadow-sm"
              >
                <CheckCircle class="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-xs font-black">คุณเสนอราคาสูงสุด! 👑</p>
                  <p class="text-[10px] text-emerald-600 mt-0.5 leading-relaxed">
                    ยอดเงินประมูลของคุณจำนวน {{ formatPrice(selectedAuction.currentBid) }} บาท ถูกล็อกไว้ชั่วคราว หากถูกแซงเงินจะคืนอัตโนมัติ
                  </p>
                </div>
              </div>
              <div 
                v-else-if="selectedAuction.currentBidderUid && activeBids.some(b => b.uid === user.uid)"
                class="bg-amber-50 text-amber-800 rounded-2xl p-3.5 border border-amber-200 flex items-start gap-2.5 shadow-sm"
              >
                <AlertTriangle class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-xs font-black">⚠️ คุณโดนบิดแซงแล้ว!</p>
                  <p class="text-[10px] text-amber-600 mt-0.5 leading-relaxed">
                    ระบบได้ทำการโอนเงินมัดจำเดิมคืนเข้ากระเป๋าคุณเรียบร้อยแล้ว รีบเสนอราคาเพิ่มเพื่อแย่งชิงไอเทมด่วน!
                  </p>
                </div>
              </div>
            </div>

            <!-- Bidding Action Box -->
            <div v-if="selectedAuction.status === 'active' && getTimeRemaining(selectedAuction.endsAt).total > 0" class="space-y-4 pt-1">
              
              <!-- In-Game Name Check -->
              <div>
                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">ชื่อตัวละคร Roblox <span class="text-red-500">*</span></label>
                <input 
                  v-model="robloxName" 
                  type="text" 
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm font-semibold shadow-sm" 
                  placeholder="สำหรับส่งมอบไอเทมหากชนะประมูล"
                />
              </div>

              <!-- Quick Presets -->
              <div>
                <label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">เสนอราคาบิดเพิ่มเร็ว</label>
                <div class="grid grid-cols-4 gap-2 text-center">
                  <button 
                    v-for="inc in [10, 50, 100, 500]" 
                    :key="inc"
                    @click="setPresetBid(inc)"
                    class="py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-colors shadow-sm bg-white"
                  >
                    +{{ inc }}฿
                  </button>
                </div>
              </div>

              <!-- Custom Amount Box -->
              <div>
                <div class="flex justify-between items-baseline mb-1">
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">เสนอราคาสุทธิ (บาท)</label>
                  <span class="text-[10px] font-bold text-amber-600">ขั้นต่ำคือ {{ getMinRequiredBid(selectedAuction) }}฿</span>
                </div>
                <div class="relative">
                  <input 
                    v-model.number="customBidAmount" 
                    type="number" 
                    :min="getMinRequiredBid(selectedAuction)"
                    class="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm font-black text-slate-800 shadow-sm"
                    placeholder="ใส่ยอดเสนอราคาของคุณ"
                  />
                  <Coins class="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <!-- Extra Wallet Hold Reminder Info -->
              <div v-if="user" class="bg-amber-500/5 rounded-2xl p-3 border border-amber-500/10 text-[10px] text-slate-500 font-medium leading-relaxed flex items-center justify-between">
                <span>เงินคงเหลือ: <span class="font-bold text-slate-800">{{ formatPrice(userProfile?.virtualWallet || 0) }}฿</span></span>
                <span v-if="customBidAmount >= getMinRequiredBid(selectedAuction)">
                  ยอดหักจากกระเป๋า: 
                  <span class="font-black text-amber-600">
                    {{ formatPrice(selectedAuction.currentBidderUid === user.uid ? (customBidAmount - selectedAuction.currentBid) : customBidAmount) }}฿
                  </span>
                </span>
              </div>

              <!-- Submit Button -->
              <button 
                @click="handlePlaceBid"
                :disabled="isSubmitting"
                class="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold py-3.5 rounded-xl transition-all shadow-md hover:shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Gavel class="w-4.5 h-4.5" />
                {{ isSubmitting ? 'กำลังประมวลผลเสนอ...' : 'เสนอราคาประมูลทันที' }}
              </button>
            </div>

            <!-- Bid History Section -->
            <div class="space-y-3 pt-3 border-t border-slate-100">
              <h3 class="text-xs font-extrabold text-slate-800 flex justify-between uppercase tracking-wider">
                <span>ประวัติผู้เสนอราคา ({{ activeBids.length }})</span>
                <span class="text-amber-600 animate-pulse text-[10px] font-black">● LIVE UPDATE</span>
              </h3>

              <div v-if="activeBids.length === 0" class="text-center py-6 bg-slate-50 rounded-2xl border text-slate-400 text-xs">
                ไม่มีประวัติเสนอราคาสำหรับไอเทมนี้เลย
              </div>

              <div v-else class="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                <div 
                  v-for="(bid, index) in activeBids" 
                  :key="bid.id"
                  class="flex justify-between items-center p-2.5 rounded-xl border transition-all shadow-sm"
                  :class="[
                    index === 0 ? 'bg-amber-500/5 border-amber-500/20 text-amber-900 font-bold scale-[1.01]' : 'bg-slate-50/50 border-slate-100 text-slate-600 text-xs'
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <!-- Avatar circle -->
                    <div 
                      class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                      :class="index === 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'"
                    >
                      <User class="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p class="font-extrabold text-xs">
                        {{ index === 0 ? '👑' : '' }} 
                        {{ bid.robloxName ? bid.robloxName : (bid.bidderName ? bid.bidderName.split(' ')[0] : 'ผู้ประมูล') }}
                      </p>
                      <p class="text-[9px] text-slate-400 font-semibold">{{ formatTimeAgo(bid.timestamp) }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="font-black" :class="index === 0 ? 'text-amber-600 text-sm' : 'text-slate-700'">
                      {{ formatPrice(bid.bidAmount) }}฿
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>

  </div>
</template>

<style scoped>
/* Scoped modifications if needed */
</style>
