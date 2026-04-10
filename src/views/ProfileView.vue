<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';
import { storeToRefs } from 'pinia';
import { User, Wallet, Edit, Check, Link, Gamepad2, Smartphone, Save, Copy } from 'lucide-vue-next';

const authStore = useAuthStore();
const uiStore = useUiStore();
const { user, userProfile, loading } = storeToRefs(authStore);

const isEditing = ref(false);
const editForm = ref({
  robloxName: '',
  tiktokName: ''
});
const isSaving = ref(false);

const initForm = () => {
  editForm.value.robloxName = userProfile.value?.robloxName || '';
  editForm.value.tiktokName = userProfile.value?.tiktokName || '';
};

// Update form when profile loads
watch(userProfile, () => {
  if (!isEditing.value) {
    initForm();
  }
}, { deep: true });

onMounted(() => {
  if (userProfile.value) {
    initForm();
  }
});

const startEdit = () => {
  initForm();
  isEditing.value = true;
};

const cancelEdit = () => {
  initForm();
  isEditing.value = false;
};

const saveProfile = async () => {
  isSaving.value = true;
  try {
    await authStore.updateProfile(editForm.value.robloxName, editForm.value.tiktokName);
    isEditing.value = false;
    uiStore.showAlert('บันทึกข้อมูลสำเร็จ', 'success');
  } catch (e) {
    uiStore.showAlert('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
  } finally {
    isSaving.value = false;
  }
};

const copied = ref(false);
const copyUid = async () => {
  if (!user.value?.uid) return;
  try {
    await navigator.clipboard.writeText(user.value.uid);
    copied.value = true;
    setTimeout(() => copied.value = false, 2000);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
};
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <div class="text-center sm:text-left mb-8">
      <h1 class="text-3xl font-bold text-brand-dark flex items-center justify-center sm:justify-start gap-2">
        <User class="w-8 h-8 text-brand" /> 
        โปรไฟล์ของฉัน
      </h1>
      <p class="text-slate-500 mt-2">จัดการข้อมูลส่วนตัวและตรวจสอบยอดเงินในกระเป๋า</p>
    </div>

    <div v-if="loading" class="text-center py-10 text-slate-500">
      กำลังโหลดข้อมูล...
    </div>
    
    <div v-else-if="!user" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
      <p class="text-slate-600 mb-4">กรุณาเข้าสู่ระบบเพื่อดูโปรไฟล์ของคุณ</p>
      <button @click="authStore.loginWithGoogle" class="inline-flex items-center gap-2 bg-brand text-white px-6 py-2.5 rounded-xl font-medium hover:bg-brand-dark transition-colors">
        <img src="https://www.google.com/favicon.ico" class="w-4 h-4 bg-white rounded-full p-0.5" />
        เข้าสู่ระบบด้วย Google
      </button>
    </div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      <!-- User Info & Wallet Card -->
      <div class="md:col-span-1 space-y-6">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center text-center">
          <img :src="user.photoURL" class="w-24 h-24 rounded-full border-4 border-slate-100 mb-4 shadow-sm" />
          <h2 class="text-lg font-bold text-slate-800">{{ user.displayName }}</h2>
          <p class="text-sm text-slate-500 truncate w-full" :title="user.email">{{ user.email }}</p>
          <button @click="copyUid" class="mt-4 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-600 font-mono flex items-center gap-2 transition-colors cursor-pointer group" title="คลิกเพื่อคัดลอก UID เต็ม">
            <span>UID: {{ user.uid.substring(0, 8) }}...</span>
            <Check v-if="copied" class="w-3.5 h-3.5 text-emerald-500" />
            <Copy v-else class="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
            <span v-if="copied" class="absolute -top-8 bg-black text-white text-[10px] py-1 px-2 rounded-md whitespace-nowrap">คัดลอกแล้ว!</span>
          </button>
        </div>

        <div class="bg-gradient-to-br from-brand to-brand-dark rounded-2xl shadow-md p-6 text-white relative overflow-hidden">
          <div class="absolute -right-4 -bottom-4 opacity-10">
            <Wallet class="w-32 h-32" />
          </div>
          <div class="relative z-10 flex flex-col">
             <div class="flex items-center gap-2 mb-2 opacity-90">
                <Wallet class="w-5 h-5" />
                <span class="font-medium text-sm">ยอดเงิน Virtual Wallet</span>
             </div>
             <div class="mt-2 flex items-baseline gap-1">
                <span class="text-4xl font-black tabular-nums">{{ userProfile.virtualWallet.toLocaleString() }}</span>
                <span class="text-lg font-medium opacity-80">฿</span>
             </div>
             <p class="text-xs mt-4 opacity-75">ใช้ยอดเงินนี้ซื้อสินค้าในร้านได้โดยไม่ต้องแนบสลิป</p>
          </div>
        </div>
      </div>

      <!-- General Info Form -->
      <div class="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
        <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
           <h3 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
             <Link class="w-5 h-5 text-slate-400" />
             ช่องทางการติดต่อ / ชื่อในเกม
           </h3>
           <button v-if="!isEditing" @click="startEdit" class="text-brand hover:text-brand-dark flex items-center gap-1.5 text-sm font-medium transition-colors bg-brand/5 px-3 py-1.5 rounded-lg">
             <Edit class="w-4 h-4" /> แก้ไขข้อมูล
           </button>
        </div>

        <div class="space-y-6">
          <!-- View Mode -->
          <template v-if="!isEditing">
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
              <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Gamepad2 class="w-5 h-5" />
              </div>
              <div class="flex-grow min-w-0">
                <p class="text-xs text-slate-400 font-medium mb-0.5">ชื่อในเกม Roblox</p>
                <p class="text-slate-800 font-medium truncate">{{ userProfile.robloxName || 'ยังไม่ได้ตั้งค่า' }}</p>
              </div>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
              <div class="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                <Smartphone class="w-5 h-5" />
              </div>
              <div class="flex-grow min-w-0">
                <p class="text-xs text-slate-400 font-medium mb-0.5">ชื่อ TikTok (เผื่อเรียกคิว)</p>
                <p class="text-slate-800 font-medium truncate">{{ userProfile.tiktokName || 'ยังไม่ได้ตั้งค่า' }}</p>
              </div>
            </div>
          </template>

          <!-- Edit Mode -->
          <template v-else>
            <div class="space-y-5">
              <div>
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                   <Gamepad2 class="w-4 h-4 text-blue-500" /> ชื่อในเกม Roblox
                </label>
                <input v-model="editForm.robloxName" type="text" placeholder="ระบุชื่อในเกมของคุณ" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all placeholder:text-slate-400" />
                <p class="text-xs text-slate-400 mt-1.5">ใช้สำหรับการส่งของในเกม แนะนำให้ตั้งไว้</p>
              </div>

              <div>
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                   <Smartphone class="w-4 h-4 text-pink-500" /> ชื่อ TikTok
                </label>
                <input v-model="editForm.tiktokName" type="text" placeholder="ระบุชื่อ TikTok ของคุณ" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all placeholder:text-slate-400" />
                <p class="text-xs text-slate-400 mt-1.5">แอดมินอาจจะเรียกชื่อนี้ตอนไลฟ์สด</p>
              </div>

              <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button @click="cancelEdit" class="px-5 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors bg-white border border-slate-200">
                  ยกเลิก
                </button>
                <button @click="saveProfile" :disabled="isSaving" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white font-medium hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                  <Save class="w-4 h-4" /> {{ isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล' }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
