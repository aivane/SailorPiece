<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import { useShopStore } from '../stores/shop';
import { storeToRefs } from 'pinia';

const route = useRoute();
const shopStore = useShopStore();
const { queues } = storeToRefs(shopStore);
const queueId = ref(route.params.id || null);

const queueDetails = computed(() => {
  if (!queueId.value) return null;
  const q = queues.value.find(item => item.id === queueId.value);
  if (!q) return null;

  const waitingQs = queues.value.filter(item => item.status === 'waiting');
  const positionIndex = waitingQs.findIndex(item => item.id === queueId.value);
  
  return {
    ...q,
    position: positionIndex >= 0 ? positionIndex + 1 : '-',
    totalCount: waitingQs.length,
    productName: q.product,
    submittedAt: q.time
  };
});
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6 flex flex-col items-center">
    <div class="text-center w-full">
      <h1 class="text-3xl font-bold text-brand-dark">เช็คคิวของคุณ</h1>
      <p class="text-slate-500 mt-2">ติดตามสถานะคำสั่งซื้อและการตรวจสอบสลิป</p>
    </div>

    <!-- No Queue ID Case -->
    <div v-if="!queueId" class="w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
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
          <h2 class="text-xl font-bold text-amber-700">กำลังตรวจสอบสลิป</h2>
          <p class="text-amber-600/80 mt-1">โปรดรอการยืนยันจาก Admin</p>
        </div>
        <div v-else-if="queueDetails?.status === 'approved'" class="flex flex-col items-center">
          <CheckCircle2 class="w-16 h-16 text-green-500 mb-4" />
          <h2 class="text-xl font-bold text-green-700">ชำระเงินสำเร็จ</h2>
          <p class="text-green-600/80 mt-1">สินค้าพร้อมจัดส่งตามคิว</p>
        </div>
      </div>

      <!-- Queue Position (Mock) -->
      <div class="p-8 pb-12 flex flex-col justify-center items-center">
         <p class="text-slate-500 font-medium mb-2">คิวปัจจุบันของคุณ</p>
         <div class="flex items-end gap-3 justify-center">
            <span class="text-6xl font-black text-brand-dark tabular-nums tracking-tighter">
               {{ queueDetails?.status === 'waiting' ? '#' + queueDetails?.position : '-' }}
            </span>
            <span v-if="queueDetails?.status === 'waiting'" class="text-lg font-medium text-slate-400 mb-2">/ {{ queueDetails?.totalCount }} คิว</span>
         </div>
      </div>

      <!-- Details -->
      <div class="bg-slate-50 p-6 space-y-3 text-sm">
        <div class="flex justify-between items-center">
          <span class="text-slate-500">หมายเลขคิว:</span>
          <span class="font-semibold text-slate-800 tracking-wide text-base">#{{ queueDetails?.id }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-slate-500">สถานะล่าสุด:</span>
          <span class="font-medium text-slate-800">{{ queueDetails?.submittedAt }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
