<script setup lang="ts">
import { ref } from 'vue'
import { api, ApiError } from '@/api/client'
import { useBootstrapStore } from '@/stores/bootstrap'
import { useToastStore } from '@/stores/toast'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import TextInput from '@/components/TextInput.vue'
import Button from '@/components/Button.vue'

const bootstrap = useBootstrapStore()
const toast = useToastStore()

const setupToken = ref('')
const panelPassword = ref('')
const apiPassword = ref('')
const logRetention = ref('7')
const submitting = ref(false)

async function handleSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const retentionDays = Number.parseInt(logRetention.value, 10)
    await api.setup(
      {
        panel_password: panelPassword.value,
        api_password: apiPassword.value || undefined,
        log_retention_days: Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : undefined,
      },
      setupToken.value.trim(),
    )
    toast.success('后台初始化完成')
    setupToken.value = ''
    panelPassword.value = ''
    apiPassword.value = ''
    await bootstrap.refresh()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '初始化失败'
    toast.error(message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Card eyebrow="首次初始化" title="设置后台密码">
    <form class="form" @submit.prevent="handleSubmit">
      <FormField label="初始化令牌" required>
        <TextInput
          v-model="setupToken"
          type="password"
          placeholder="输入部署时生成的 SETUP_TOKEN"
          required
          autocomplete="one-time-code"
        />
      </FormField>

      <FormField label="后台密码" required>
        <TextInput
          v-model="panelPassword"
          type="password"
          placeholder="至少输入一组后台密码"
          required
          autocomplete="new-password"
        />
      </FormField>

      <FormField label="API 密码（可选）" hint="留空则默认关闭 API 密码">
        <TextInput
          v-model="apiPassword"
          type="password"
          placeholder="可留空，稍后在安全设置中开启"
          autocomplete="new-password"
        />
      </FormField>

      <FormField label="日志保留天数">
        <TextInput v-model="logRetention" type="number" min="1" />
      </FormField>

      <div class="actions">
        <Button type="submit" variant="primary" :loading="submitting">
          初始化后台
        </Button>
      </div>
    </form>
  </Card>
</template>

<style scoped>
.form {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .form {
    grid-template-columns: 1fr;
  }
}
</style>
