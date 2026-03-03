import type { App, Directive } from 'vue'
import { useUserStore } from '@/stores/user'
import type { AdminRole } from '@/types'

const roleDirective: Directive<HTMLElement, AdminRole | AdminRole[]> = {
  mounted(el, binding) {
    const userStore = useUserStore()
    const required = Array.isArray(binding.value) ? binding.value : [binding.value]

    if (!required.includes(userStore.user?.role ?? 'NORMAL')) {
      el.style.display = 'none'
    }
  },
}

export const setupRoleDirective = (app: App) => {
  app.directive('role', roleDirective)
}
