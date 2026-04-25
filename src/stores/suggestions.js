import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '../firebase/config'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { useUiStore } from './ui'
import { useAuthStore } from './auth'

export const useSuggestionsStore = defineStore('suggestions', () => {
  const suggestions = ref([])
  const loading = ref(false)
  const error = ref(null)
  
  const uiStore = useUiStore()
  const authStore = useAuthStore()

  // Fetch all suggestions (Admin only)
  const fetchSuggestions = async () => {
    loading.value = true
    error.value = null
    try {
      const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      suggestions.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to Date
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }))
    } catch (err) {
      console.error('Error fetching suggestions:', err)
      error.value = err.message
      uiStore.showToast('เกิดข้อผิดพลาดในการโหลดข้อเสนอแนะ', 'error')
    } finally {
      loading.value = false
    }
  }

  // Add a new suggestion (User)
  const addSuggestion = async (suggestionData) => {
    loading.value = true
    error.value = null
    try {
      const user = authStore.user
      if (!user) throw new Error('User not authenticated')

      const newSuggestion = {
        userId: user.uid,
        userName: user.displayName || 'Unknown User',
        userEmail: user.email || '',
        userPhotoURL: user.photoURL || '',
        ...suggestionData,
        status: 'pending',
        createdAt: serverTimestamp()
      }

      await addDoc(collection(db, 'suggestions'), newSuggestion)
      uiStore.showToast('ส่งข้อเสนอแนะสำเร็จ ขอบคุณครับ!', 'success')
      return true
    } catch (err) {
      console.error('Error adding suggestion:', err)
      error.value = err.message
      uiStore.showToast('เกิดข้อผิดพลาดในการส่งข้อเสนอแนะ', 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  // Update suggestion status (Admin)
  const updateStatus = async (id, status) => {
    try {
      const suggestionRef = doc(db, 'suggestions', id)
      await updateDoc(suggestionRef, { status })
      
      const index = suggestions.value.findIndex(s => s.id === id)
      if (index !== -1) {
        suggestions.value[index].status = status
      }
      uiStore.showToast('อัพเดทสถานะสำเร็จ', 'success')
    } catch (err) {
      console.error('Error updating status:', err)
      uiStore.showToast('เกิดข้อผิดพลาดในการอัพเดทสถานะ', 'error')
    }
  }

  // Delete a suggestion (Admin)
  const deleteSuggestion = async (id) => {
    try {
      await deleteDoc(doc(db, 'suggestions', id))
      suggestions.value = suggestions.value.filter(s => s.id !== id)
      uiStore.showToast('ลบข้อเสนอแนะสำเร็จ', 'success')
    } catch (err) {
      console.error('Error deleting suggestion:', err)
      uiStore.showToast('เกิดข้อผิดพลาดในการลบข้อเสนอแนะ', 'error')
    }
  }

  return {
    suggestions,
    loading,
    error,
    fetchSuggestions,
    addSuggestion,
    updateStatus,
    deleteSuggestion
  }
})
