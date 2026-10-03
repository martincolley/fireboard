<script setup lang="ts">
import type { FsValue } from '#shared/types/firestore'

const props = withDefaults(defineProps<{ value: FsValue; maxLength?: number }>(), {
	maxLength: 200
})
const text = computed(() => summarize(props.value, props.maxLength))
</script>

<template>
	<span :class="`v-${value.t}`" class="mono value">{{ text }}</span>
</template>

<style scoped>
.value {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
