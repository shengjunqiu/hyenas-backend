import type { App, Directive } from 'vue'
import { watch } from 'vue'
import { useUserStore } from '@/stores/user'
import type { AdminRole } from '@/types'

type RoleElement = HTMLElement & {
  __roleStop__?: () => void
}

const applyRoleVisibility = (
  el: HTMLElement,
  role: AdminRole | undefined,
  required: AdminRole | AdminRole[],
) => {
  const requiredRoles = Array.isArray(required) ? required : [required]
  if (!requiredRoles.includes(role ?? 'NORMAL')) {
    el.style.display = 'none'
    return
  }
  el.style.display = ''
}

const roleDirective: Directive<RoleElement, AdminRole | AdminRole[]> = {
  mounted(el, binding) {
    const userStore = useUserStore()
    applyRoleVisibility(el, userStore.user?.role, binding.value)

    el.__roleStop__ = watch(
      () => userStore.user?.role,
      (role) => {
        applyRoleVisibility(el, role, binding.value)
      },
    )
  },
  updated(el, binding) {
    const userStore = useUserStore()
    applyRoleVisibility(el, userStore.user?.role, binding.value)
  },
  unmounted(el) {
    el.__roleStop__?.()
    delete el.__roleStop__
  },
}

export const setupRoleDirective = (app: App) => {
  app.directive('role', roleDirective)
}
