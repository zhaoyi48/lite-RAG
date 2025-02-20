<template>
  <transition name="toast-fade">
    <div class="toast-container" v-if="show">
      <div class="toast" :class="type">
        <div class="toast-content">
          <span class="toast-icon">
            {{ getIcon }}
          </span>
          <span class="toast-message" v-html="formattedMessage"></span>
        </div>
        <button class="toast-close" @click="$emit('close')">×</button>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'Toast',
  props: {
    show: Boolean,
    message: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      default: 'info'
    }
  },
  computed: {
    formattedMessage() {
      // 将换行符转换为 HTML 换行
      return this.message.replace(/\n/g, '<br>')
    },
    getIcon() {
      switch(this.type) {
        case 'success': return '✓'
        case 'error': return '✕'
        case 'warning': return '⚠'
        default: return 'ℹ'
      }
    }
  }
}
</script>

<style scoped>
/* 添加过渡动画 */
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.toast {
  min-width: 300px;
  max-width: 500px;
  padding: 12px;
  border-radius: 6px;
  background-color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: flex-start;
  animation: slideIn 0.3s ease;
}

.toast-content {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.toast-icon {
  font-size: 18px;
  line-height: 20px;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  padding: 0 4px;
  margin-left: 10px;
}

.toast.success {
  border-left: 4px solid #4CAF50;
}

.toast.success .toast-icon {
  color: #4CAF50;
}

.toast.error {
  border-left: 4px solid #f44336;
}

.toast.error .toast-icon {
  color: #f44336;
}

.toast.info {
  border-left: 4px solid #2196F3;
}

.toast.info .toast-icon {
  color: #2196F3;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style> 