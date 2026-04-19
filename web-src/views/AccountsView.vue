<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { api, ApiError } from '@/api/client'
import { useAccountsStore, type AccountStatusFilter } from '@/stores/accounts'
import { useBootstrapStore } from '@/stores/bootstrap'
import { useConfirmStore } from '@/stores/confirm'
import { useToastStore } from '@/stores/toast'
import { usePolling } from '@/composables/usePolling'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import TextInput from '@/components/TextInput.vue'
import SearchInput from '@/components/SearchInput.vue'
import FilterChips from '@/components/FilterChips.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import AccountCard from '@/components/AccountCard.vue'
import GuestSourceCard from '@/components/GuestSourceCard.vue'

const accounts = useAccountsStore()
const bootstrap = useBootstrapStore()
const confirm = useConfirmStore()
const toast = useToastStore()

const { items, filtered, guestSource, loading, loaded, keyword, statusFilter, counts } = storeToRefs(accounts)

const jwtInput = ref('')
const submitting = ref(false)
const busyId = ref<number | null>(null)

const filterOptions = computed<ReadonlyArray<{ value: AccountStatusFilter; label: string; count: number }>>(() => [
  { value: 'all', label: '全部', count: counts.value.total },
  { value: 'active', label: '活跃', count: counts.value.active },
  { value: 'idle', label: '待命', count: counts.value.idle },
  { value: 'error', label: '异常', count: counts.value.error },
  { value: 'disabled', label: '已停用', count: counts.value.disabled },
])

async function loadOnce() {
  try {
    await accounts.load()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '加载账号失败'
    toast.error(message)
  }
}

async function handleSubmit() {
  if (submitting.value) return
  const jwt = jwtInput.value.trim()
  if (!jwt) {
    toast.warning('请粘贴完整 JWT')
    return
  }
  submitting.value = true
  try {
    await accounts.create(jwt)
    toast.success('账号已保存')
    jwtInput.value = ''
    await bootstrap.refresh()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '保存账号失败'
    toast.error(message)
  } finally {
    submitting.value = false
  }
}

async function handleCheck(id: number) {
  busyId.value = id
  try {
    await accounts.check(id)
    toast.success('账号已重新检测')
    await bootstrap.refresh()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '检测失败'
    toast.error(message)
  } finally {
    busyId.value = null
  }
}

async function handleToggle(id: number, enable: boolean) {
  const account = items.value.find((a) => a.id === id)
  const title = enable ? '启用账号' : '禁用账号'
  const confirmed = await confirm.open({
    title,
    message: enable
      ? `确认重新启用账号「${account?.name || account?.email || id}」？启用后将立即参与轮询。`
      : `确认禁用账号「${account?.name || account?.email || id}」？禁用后该账号不再参与请求。`,
    confirmLabel: enable ? '启用' : '禁用',
    variant: enable ? 'default' : 'danger',
  })
  if (!confirmed) return
  busyId.value = id
  try {
    await accounts.setEnabled(id, enable)
    toast.success(enable ? '账号已启用' : '账号已禁用')
    await bootstrap.refresh()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '操作失败'
    toast.error(message)
  } finally {
    busyId.value = null
  }
}

usePolling(loadOnce, { interval: 30_000, immediate: true })
</script>

<template>
  <Card eyebrow="账号池" title="添加与切换账号">
    <template #actions>
      <Button variant="ghost" size="sm" :loading="loading" @click="loadOnce">
        刷新账号
      </Button>
    </template>

    <form class="add-form" @submit.prevent="handleSubmit">
      <TextInput v-model="jwtInput" placeholder="粘贴完整 JWT" required autocomplete="off" />
      <Button type="submit" variant="primary" :loading="submitting">
        校验并保存
      </Button>
    </form>

    <div class="controls">
      <SearchInput v-model="keyword" placeholder="搜索账号名 / 邮箱 / UID / JWT 片段" />
      <FilterChips
        v-model="statusFilter"
        aria-label="按状态筛选账号"
        :options="filterOptions"
      />
    </div>

    <GuestSourceCard v-if="guestSource" :source="guestSource" />

    <div v-if="loading && !loaded" class="grid">
      <SkeletonCard v-for="n in 3" :key="n" :rows="4" />
    </div>

    <div v-else-if="!items.length" class="wide-slot">
      <EmptyState
        title="暂无持久化账号"
        description="可直接粘贴 JWT 添加账号，也可以仅依赖环境变量兜底或启用游客来源。"
      />
    </div>

    <div v-else-if="!filtered.length" class="wide-slot">
      <EmptyState
        title="没有匹配的账号"
        description="试试清空搜索关键字或切换状态筛选。"
      />
    </div>

    <div v-else class="grid">
      <AccountCard
        v-for="account in filtered"
        :key="account.id"
        :account="account"
        :busy="busyId === account.id"
        @check="handleCheck"
        @toggle="(id, enabled) => handleToggle(id, enabled)"
      />
    </div>
  </Card>
</template>

<style scoped>
.add-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  margin-bottom: 18px;
}

.controls {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.wide-slot {
  margin-top: 16px;
}

@media (max-width: 720px) {
  .add-form {
    grid-template-columns: 1fr;
  }
  .controls {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
