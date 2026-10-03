<script setup lang="ts">
import { NButton, useMessage } from 'naive-ui'
import type { FsDoc } from '#shared/types/firestore'

const props = defineProps<{ docs: FsDoc[] }>()
const message = useMessage()

/** Keyed by document id, values in extended JSON (types preserved). */
const text = computed(() => {
	const out: Record<string, unknown> = {}
	for (const doc of props.docs) out[doc.id] = fieldsToExtJson(doc.fields)
	return JSON.stringify(out, null, 2)
})

async function copy() {
	await navigator.clipboard.writeText(text.value)
	message.success('Copied')
}
</script>

<template>
	<div class="json">
		<NButton size="tiny" class="copy" @click="copy">Copy</NButton>
		<pre class="mono">{{ text }}</pre>
	</div>
</template>

<style scoped>
.json {
	position: relative;
	padding: 8px 12px;
}
.copy {
	position: sticky;
	top: 0;
	float: right;
}
pre {
	margin: 0;
	white-space: pre-wrap;
	word-break: break-word;
}
</style>
