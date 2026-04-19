<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ApiError } from '@/api/client'
import { useLogsStore, type LogLevelFilter, type LogCategoryFilter } from '@/stores/logs'
import { useToastStore } from '@/stores/toast'
import { usePolling } from '@/composables/usePolling'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import SearchInput from '@/components/SearchInput.vue'
import FilterChips from '@/components/FilterChips.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import LogEntryCard from '@/components/LogEntryCard.vue'

const logs = useLogsStore()
const toast = useToastStore()

const { items, filtered, loading, loaded, keyword, levelFilter, categoryFilter, levels, categories } = storeToRefs(logs)

const levelOptions = computed<ReadonlyArray<{ value: LogLevelFilter; label: string }>>(() =>
  levels.value.map((level) => ({
    value: level,
    label: level === 'all' ? '全部级别' : level,
  })),
)

const categoryOptions = computed<ReadonlyArray<{ value: LogCategoryFilter; label: string }>>(() =>
  categories.value.map((category) => ({
    value: category,
    label: category === 'all' ? '全部分类' : category,
  })),
)

async function loadOnce() {
  try {
    await logs.load(100)
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '加载日志失败'
    toast.error(message)
  }
}

usePolling(loadOnce, { interval: 15_000, immediate: true })
</script>

<template>
  <Card eyebrow="运行日志" title="最近 100 条">
    <template #actions>
      <Button variant="ghost" size="sm" :loading="loading" @click="loadOnce">
        刷新日志
      </Button>
    </template>

    <div class="controls">
      <SearchInput v-model="keyword" placeholder="搜索消息或 details JSON" />
      <FilterChips
        v-model="levelFilter"
        :options="levelOptions"
        aria-label="按级别筛选日志"
      />
    </div>

    <FilterChips
      v-if="categoryOptions.length > 1"
      v-model="categoryFilter"
      :options="categoryOptions"
      aria-label="按分类筛选日志"
      class="category-chips"
    />

    <div v-if="loading && !loaded" class="list">
      <SkeletonCard v-for="n in 3" :key="n" :rows="2" />
    </div>

    <div v-else-if="!items.length" class="list">
      <EmptyState
        title="暂无日志"
        description="等待请求和账号调度写入日志。"
      />
    </div>

    <div v-else-if="!filtered.length" class="list">
      <EmptyState
        title="没有匹配的日志"
        description="尝试清空筛选条件或换个关键词。"
      />
    </div>

    <div v-else class="list">
      <LogEntryCard v-for="log in filtered" :key="log.id" :log="log" />
    </div>
  </Card>
</template>

<style scoped>
.controls {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.category-chips {
  margin-bottom: 16px;
}

.list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

@media (max-width: 720px) {
  .controls {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
