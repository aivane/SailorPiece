<script setup>
import { ref } from 'vue'
import { MessageSquare, X, Send } from 'lucide-vue-next'
import { useSuggestionsStore } from '../stores/suggestions'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const suggestionsStore = useSuggestionsStore()

const type = ref('product')
const message = ref('')

const typeOptions = [
  { value: 'product', label: 'รีเควสสินค้าใหม่' },
  { value: 'price', label: 'เสนอราคา/ปรับราคา' },
  { value: 'other', label: 'ข้อเสนอแนะอื่นๆ' }
]

const submitFeedback = async () => {
  if (!message.value.trim()) return

  const success = await suggestionsStore.addSuggestion({
    type: type.value,
    message: message.value.trim()
  })

  if (success) {
    message.value = ''
    type.value = 'product'
    emit('close')
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="$emit('close')"></div>
      
      <div class="bg-white rounded-2xl w-full max-w-md relative z-10 overflow-hidden shadow-2xl flex flex-col scale-100 transition-transform">
        
        <!-- Header -->
        <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-brand to-brand-dark text-white">
          <div class="flex items-center gap-3">
            <div class="bg-white/20 p-2 rounded-lg">
              <MessageSquare class="w-6 h-6 text-white" />
            </div>
            <h3 class="text-xl font-bold">ส่งข้อเสนอแนะ</h3>
          </div>
          <button @click="$emit('close')" class="p-1 hover:bg-white/20 rounded-md transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5">
          <div class="space-y-2">
            <label class="block text-sm font-semibold text-slate-700">หัวข้อ <span class="text-red-500">*</span></label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button 
                v-for="opt in typeOptions" 
                :key="opt.value"
                @click="type = opt.value"
                :class="[
                  'px-3 py-2 text-sm font-medium border rounded-xl transition-all',
                  type === opt.value 
                    ? 'border-brand bg-brand/5 text-brand shadow-sm' 
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                ]"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-semibold text-slate-700">รายละเอียด <span class="text-red-500">*</span></label>
            <textarea 
              v-model="message"
              rows="4" 
              placeholder="พิมพ์ข้อเสนอแนะ สินค้าที่อยากได้ หรือราคาที่ต้องการเสนอ..."
              class="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition-all"
            ></textarea>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
          <button 
            @click="$emit('close')" 
            class="px-4 py-2.5 rounded-xl font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
            :disabled="suggestionsStore.loading"
          >
            ยกเลิก
          </button>
          <button 
            @click="submitFeedback" 
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-brand hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!message.trim() || suggestionsStore.loading"
          >
            <Send class="w-4 h-4" v-if="!suggestionsStore.loading" />
            <svg v-else class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            {{ suggestionsStore.loading ? 'กำลังส่ง...' : 'ส่งข้อเสนอ' }}
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-active .scale-100 {
  animation: bounce-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes bounce-in {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
