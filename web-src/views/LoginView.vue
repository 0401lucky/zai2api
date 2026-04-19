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

const password = ref('')
const submitting = ref(false)

async function handleSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    await api.login({ password: password.value })
    toast.success('登录成功')
    password.value = ''
    await bootstrap.refresh()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '登录失败'
    toast.error(message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Card eyebrow="后台登录" title="进入管理台">
    <form class="form" @submit.prevent="handleSubmit">
      <FormField label="后台密码" required>
        <TextInput
          v-model="password"
          type="password"
          placeholder="输入后台密码"
          required
          autocomplete="current-password"
        />
      </FormField>
      <div class="actions">
        <Button type="submit" variant="primary" :loading="submitting">登录</Button>
      </div>
    </form>
  </Card>
</template>

<style scoped>
.form {
  display: grid;
  gap: 16px;
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
