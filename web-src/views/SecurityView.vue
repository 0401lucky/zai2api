<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ApiError } from '@/api/client'
import { useBootstrapStore } from '@/stores/bootstrap'
import { useSecurityStore } from '@/stores/security'
import { useToastStore } from '@/stores/toast'
import { guestSourceSettingLabel } from '@/utils/format'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import TextInput from '@/components/TextInput.vue'
import Button from '@/components/Button.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'

const security = useSecurityStore()
const bootstrap = useBootstrapStore()
const toast = useToastStore()

const { data, loading, loaded } = storeToRefs(security)

const panelPassword = ref('')
const apiPassword = ref('')
const disableApiPassword = ref(false)
const logRetentionDays = ref('7')
const guestEnabled = ref(false)
const submitting = ref(false)

const logRetentionOverridden = computed(() => Boolean(data.value?.log_retention.overridden_by_env))
const guestOverridden = computed(() => Boolean(data.value?.guest_source.overridden_by_env))

const guestNote = computed(() => {
  if (!data.value) return '未配置'
  if (guestOverridden.value) return '游客来源由环境变量控制，后台不可修改。'
  return `当前来源：${guestSourceSettingLabel(data.value.guest_source.source)}。`
})

const retentionNote = computed(() => {
  if (!data.value) return '每 N 天清理一次日志'
  if (logRetentionOverridden.value) return '日志保留天数由环境变量控制，此处修改不会生效。'
  if (data.value.log_retention.default_active) return '当前使用默认值，可手动修改后保存。'
  return '当前值由后台设置保存。'
})

const apiHint = computed(() => {
  if (!data.value) return '留空表示不修改'
  if (!data.value.api_password.enabled) return '当前未启用 API 密码，填写新密码后即可开启。'
  if (data.value.api_password.overridden_by_env) return 'API 密码由环境变量提供，不建议在此覆盖。'
  return '留空表示不修改现有 API 密码。'
})

watch(
  data,
  (next) => {
    if (!next) return
    logRetentionDays.value = String(next.log_retention.days)
    guestEnabled.value = next.guest_source.enabled
  },
  { immediate: true },
)

async function loadOnce() {
  try {
    await security.load()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '加载安全设置失败'
    toast.error(message)
  }
}

onMounted(() => {
  if (!loaded.value) void loadOnce()
})

async function handleSubmit() {
  if (submitting.value) return
  const payload: Record<string, unknown> = {}
  if (panelPassword.value.trim()) payload.panel_password = panelPassword.value.trim()
  if (disableApiPassword.value) {
    payload.disable_api_password = true
  } else if (apiPassword.value.trim()) {
    payload.api_password = apiPassword.value.trim()
  }
  if (!logRetentionOverridden.value) {
    const days = Number.parseInt(logRetentionDays.value, 10)
    if (Number.isFinite(days) && days > 0) payload.log_retention_days = days
  }
  if (!guestOverridden.value) {
    payload.guest_enabled = guestEnabled.value
  }

  if (Object.keys(payload).length === 0) {
    toast.warning('未填写任何变更')
    return
  }

  submitting.value = true
  try {
    await security.update(payload)
    toast.success('安全设置已更新')
    panelPassword.value = ''
    apiPassword.value = ''
    disableApiPassword.value = false
    await bootstrap.refresh()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '保存失败'
    toast.error(message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Card eyebrow="安全设置" title="密码与保留策略">
    <template #actions>
      <Button variant="ghost" size="sm" :loading="loading" @click="loadOnce">
        重新加载
      </Button>
    </template>

    <SkeletonCard v-if="loading && !loaded" :rows="4" />

    <form v-else class="form" @submit.prevent="handleSubmit">
      <FormField label="更新后台密码" hint="留空表示不修改">
        <TextInput
          v-model="panelPassword"
          type="password"
          placeholder="输入新后台密码"
          autocomplete="new-password"
        />
      </FormField>

      <FormField label="更新 API 密码" :hint="apiHint">
        <TextInput
          v-model="apiPassword"
          type="password"
          placeholder="输入新 API 密码"
          autocomplete="new-password"
          :disabled="disableApiPassword"
        />
      </FormField>

      <label class="check">
        <input v-model="disableApiPassword" type="checkbox" />
        <span>关闭 API 密码（`/v1/*` 不再要求认证）</span>
      </label>

      <FormField label="日志保留天数" :hint="retentionNote">
        <TextInput
          v-model="logRetentionDays"
          type="number"
          min="1"
          :disabled="logRetentionOverridden"
        />
      </FormField>

      <label class="check">
        <input
          v-model="guestEnabled"
          type="checkbox"
          :disabled="guestOverridden"
        />
        <span>启用游客来源</span>
      </label>

      <p class="note muted">{{ guestNote }}</p>

      <div class="actions">
        <Button type="submit" variant="primary" :loading="submitting">
          保存安全设置
        </Button>
      </div>
    </form>
  </Card>
</template>

<style scoped>
.form {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.check {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
  align-items: center;
  color: var(--text);
  font-size: 14px;
}

.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}

.note {
  grid-column: 1 / -1;
  margin: -6px 0 0;
  font-size: 13px;
}

.muted {
  color: var(--muted);
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
