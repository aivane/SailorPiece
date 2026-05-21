<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Clock, CheckCircle2, AlertCircle, History } from 'lucide-vue-next';
import { useShopStore } from '../stores/shop';
import { useAuthStore } from '../stores/auth';
import { storeToRefs } from 'pinia';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const route = useRoute();
const shopStore = useShopStore();
const authStore = useAuthStore();
const { queues, vipServerLink } = storeToRefs(shopStore);
const { user } = storeToRefs(authStore);
const queueId = ref(route.params.id || null);
const userHistoryQueues = ref([]);

const loadHistory = async () => {
   if (user.value) {
      userHistoryQueues.value = await shopStore.fetchUserHistory(user.value.uid);
   }
};

onMounted(() => {
   loadHistory();
});

watch(user, () => {
   loadHistory();
});

const activeQueueId = computed(() => {
  if (queueId.value) return queueId.value;
  if (user.value) {
     const myQueue = queues.value.find(q => q.uid === user.value.uid && (q.status === 'waiting' || q.status === 'approved'));
     if (myQueue) return myQueue.id;
  }
  return null;
});

const liveQueueDoc = ref(null);
let queueDocUnsubscribe = null;

// Direct live listener to the specific active queue document
watch(activeQueueId, (newId) => {
  if (queueDocUnsubscribe) {
    queueDocUnsubscribe();
    queueDocUnsubscribe = null;
  }
  
  if (newId) {
    queueDocUnsubscribe = onSnapshot(doc(db, 'queues', newId), 
      (docSnap) => {
        if (docSnap.exists()) {
          liveQueueDoc.value = { id: docSnap.id, ...docSnap.data() };
        } else {
          liveQueueDoc.value = null;
        }
      },
      (error) => {
        console.warn("Error listening to active queue doc:", error);
      }
    );
  } else {
    liveQueueDoc.value = null;
  }
}, { immediate: true });

onUnmounted(() => {
  if (queueDocUnsubscribe) {
    queueDocUnsubscribe();
  }
});

const queueDetails = computed(() => {
  if (!liveQueueDoc.value) return null;
  const q = liveQueueDoc.value;

  const waitingQs = queues.value.filter(item => item.status === 'waiting');
  const positionIndex = waitingQs.findIndex(item => item.id === q.id);
  
  return {
    ...q,
    position: positionIndex >= 0 ? positionIndex + 1 : '-',
    totalCount: waitingQs.length,
    productName: q.product,
    submittedAt: q.time
  };
});

// Calculate the queue number currently being served (the head of the FIFO queue)
const currentServingQueueNumber = computed(() => {
  if (queues.value.length > 0) {
    return queues.value[0].queueNumber;
  }
  return null;
});
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6 flex flex-col items-center">
    <div class="text-center w-full">
      <h1 class="text-3xl font-bold text-brand-dark">เช็คคิวของคุณ</h1>
      <p class="text-slate-500 mt-2">ติดตามสถานะคำสั่งซื้อและการตรวจสอบสลิปแบบเรียลไทม์</p>
    </div>

    <!-- No Queue ID Case -->
    <div v-if="!activeQueueId" class="w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
      <div class="w-16 h-16 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-4 text-brand">
        <Clock class="w-8 h-8" />
      </div>
      <h2 class="text-lg font-medium text-slate-800">คุณยังไม่มีหมายเลขคิวในขณะนี้</h2>
      <p class="text-slate-500 mt-2 mb-6">กรุณาเลือกซื้อสินค้าและแนบสลิปเพื่อเข้าสู่ระบบคิว</p>
      <router-link to="/" class="inline-flex items-center text-white bg-brand hover:bg-brand-dark px-6 py-2.5 rounded-xl font-medium transition-colors">
        ไปหน้าเลือกซื้อสินค้า
      </router-link>
    </div>

    <!-- Queue Case -->
    <div v-else class="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <!-- Status Header -->
      <div class="p-6 text-center border-b border-slate-100 transition-colors" :class="{
        'bg-amber-50': queueDetails?.status === 'waiting',
        'bg-green-50': queueDetails?.status === 'approved',
      }">
        <div v-if="queueDetails?.status === 'waiting'" class="flex flex-col items-center">
          <Clock class="w-16 h-16 text-amber-500 mb-4 animate-pulse" />
          <h2 class="text-xl font-bold text-amber-700">กำลังตรวจสอบสลิปและคิวจัดส่ง</h2>
          <p class="text-amber-600/80 mt-1">โปรดรอการส่งมอบและยืนยันจาก Admin</p>
        </div>
        <div v-else-if="queueDetails?.status === 'approved'" class="flex flex-col items-center">
          <CheckCircle2 class="w-16 h-16 text-green-500 mb-4" />
          <h2 class="text-xl font-bold text-green-700">ชำระเงินและจัดส่งสินค้าสำเร็จ</h2>
          <p class="text-green-600/80 mt-1">ทำรายการเสร็จสิ้นเรียบร้อยแล้ว ขอบคุณที่ใช้บริการครับ</p>
        </div>
      </div>

      <!-- Queue Number Display (Dashboard Mode) -->
      <div class="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/40">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <!-- Card 1: Your Queue -->
          <div class="bg-white p-5 rounded-2xl border border-brand/20 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
            <div class="absolute top-0 right-0 bg-brand text-white px-3 py-0.5 rounded-bl-lg text-[10px] font-semibold">
              คิวของคุณ
            </div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Your Ticket</p>
            <span class="text-5xl font-black text-brand-dark tabular-nums tracking-tight">
               #{{ queueDetails?.queueNumber || '-' }}
            </span>
            <p class="text-xs text-slate-400 mt-1.5">หมายเลขคิวอ้างอิงหลัก</p>
          </div>

          <!-- Card 2: Now Serving -->
          <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
            <div class="absolute top-0 right-0 bg-slate-800 text-white px-3 py-0.5 rounded-bl-lg text-[10px] font-semibold flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              คิวที่กำลังบริการ
            </div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Now Serving</p>
            <span class="text-5xl font-black text-slate-700 tabular-nums tracking-tight">
               #{{ currentServingQueueNumber || 'ไม่มีคิวรอ' }}
            </span>
            <p class="text-xs text-slate-400 mt-1.5">แอดมินกำลังดำเนินการคิวนี้</p>
          </div>
        </div>

        <!-- Waiting Status Indicator & Progress Timeline -->
        <div v-if="queueDetails?.status === 'waiting'" class="mt-6 flex flex-col items-center text-center space-y-3">
          <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div class="bg-brand h-full rounded-full transition-all duration-500" :style="{ width: `${Math.max(8, 100 - ((queueDetails?.position - 1) * 15))}%` }"></div>
          </div>
          
          <p class="text-slate-600 text-sm font-medium">
            คิวที่รออยู่ก่อนหน้าคุณ: 
            <span class="text-brand font-extrabold text-base bg-brand-light/40 px-2.5 py-0.5 rounded-lg border border-brand/10 inline-block align-middle ml-1">
              {{ queueDetails?.position - 1 }}
            </span> คิว
          </p>
        </div>
      </div>

      <!-- Details -->
      <div class="bg-slate-50/50 p-6 space-y-3 text-sm rounded-b-2xl">
        <div class="space-y-2 pb-3 border-b border-slate-200/60 font-medium">
           <p class="text-slate-500 font-normal mb-2">รายการสินค้าที่สั่ง:</p>
           <template v-if="queueDetails?.items && queueDetails.items.length > 0">
              <div v-for="(item, i) in queueDetails.items" :key="i" class="flex justify-between items-center">
                 <span class="text-slate-800">{{ item.product.name }}</span>
                 <span class="text-brand font-bold bg-brand/10 px-2 py-0.5 rounded-md text-xs">x{{ item.pieces }} ชิ้น</span>
              </div>
           </template>
           <template v-else>
              <div class="flex justify-between items-center">
                 <span class="text-slate-800">{{ queueDetails?.productName }}</span>
                 <span class="text-brand font-bold bg-brand/10 px-2 py-0.5 rounded-md text-xs">x{{ queueDetails?.receivedPieces }} ชิ้น</span>
              </div>
           </template>
           
           <div class="flex justify-between items-center pt-2 mt-2 border-t border-slate-100/50">
             <span class="text-slate-500 font-normal">ยอดโอนรวม:</span>
             <span class="text-slate-800 font-semibold">{{ queueDetails?.price }} บาท</span>
           </div>
        </div>

        <div class="flex justify-between items-center pt-1">
          <span class="text-slate-500">รหัสเอกสารอ้างอิง:</span>
          <span class="font-bold text-slate-400 font-mono text-xs">{{ queueDetails?.id }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-slate-500">เวลาที่เข้าคิว:</span>
          <span class="font-medium text-slate-800">{{ queueDetails?.submittedAt }}</span>
        </div>

        <!-- VIP Server Link -->
        <div class="pt-5 mt-4 border-t border-slate-200/60">
          <a 
            :href="vipServerLink" 
            target="_blank" 
            rel="noopener noreferrer"
            class="flex items-center justify-center w-full py-3.5 px-4 bg-[#232527] hover:bg-[#111213] text-white rounded-xl font-bold transition-all hover:scale-[1.02] shadow-md shadow-black/10 gap-2 border border-slate-800 text-base"
          >
            🎮 กดเข้าเซิร์ฟ VIP (Roblox)
          </a>
          <p class="text-xs text-center text-slate-500 mt-2">ปล. คุณสามารถกดปุ่มนี้เพื่อเข้าไปรอแอดมินส่งของในเกมได้เลยครับ</p>
        </div>
      </div>
    </div>

    <!-- User History Section -->
    <div v-if="userHistoryQueues.length > 0" class="w-full mt-8">
      <div class="flex items-center gap-2 mb-4 px-2">
         <History class="w-5 h-5 text-slate-500" />
         <h2 class="text-lg font-bold text-slate-700">ประวัติการสั่งซื้อของคุณ</h2>
      </div>
      <div class="space-y-4">
        <div v-for="q in userHistoryQueues" :key="q.id" class="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row justify-between gap-4 transition-colors hover:border-brand/30">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="font-bold text-slate-800 text-sm">#{{ q.queueNumber || q.id }}</span>
              <span v-if="q.status === 'approved'" class="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold uppercase tracking-wider">สำเร็จ</span>
              <span v-else class="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold uppercase tracking-wider">ถูกยกเลิก</span>
            </div>
            <div class="text-xs text-slate-600 space-y-1">
               <template v-if="q.items && q.items.length > 0">
                 <p v-for="(item, i) in q.items" :key="i">
                    <span class="text-slate-400">-</span> {{ item.product.name }} <span class="text-brand font-medium">x{{ item.pieces }}</span>
                 </p>
               </template>
               <template v-else>
                 <p><span class="text-slate-400">-</span> {{ q.product }} <span v-if="q.receivedPieces" class="text-brand font-medium">x{{ q.receivedPieces }}</span></p>
               </template>
            </div>
          </div>
          <div class="flex flex-col sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <span class="font-bold text-slate-800">{{ q.price }} บาท</span>
            <span class="text-xs text-slate-400 font-mono">{{ q.time }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
