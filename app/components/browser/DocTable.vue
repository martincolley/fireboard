<script setup lang="ts">
import { NDataTable, type DataTableColumns } from 'naive-ui'
import type { FsDoc } from '#shared/types/firestore'
import ValueInline from '~/components/value/ValueInline.vue'

const props = defineProps<{ docs: FsDoc[]; loading: boolean; conn: string; db: string }>()
const emit = defineEmits<{ open: [path: string] }>()

const MAX_COLUMNS = 40

/** Columns are the union of top-level fields, most common first. */
const columns = computed<DataTableColumns<FsDoc>>(() => {
	const frequency = new Map<string, number>()
	for (const doc of props.docs) {
		for (const key of Object.keys(doc.fields)) frequency.set(key, (frequency.get(key) ?? 0) + 1)
	}
	const keys = [...frequency.keys()]
		.sort((a, b) => frequency.get(b)! - frequency.get(a)! || a.localeCompare(b))
		.slice(0, MAX_COLUMNS)

	return [
		{
			key: '__id',
			title: 'id',
			fixed: 'left',
			width: 220,
			ellipsis: { tooltip: true },
			render: (doc) =>
				h(
					'span',
					{
						class: ['mono', 'doc-id', { missing: doc.missing }],
						title: doc.missing ? 'No data, only subcollections' : undefined
					},
					doc.id
				)
		},
		...keys.map<DataTableColumns<FsDoc>[number]>((key) => ({
			key,
			title: key,
			width: 200,
			ellipsis: true,
			render: (doc) => {
				const value = doc.fields[key]
				return value ? h(ValueInline, { value, maxLength: 120 }) : null
			}
		}))
	]
})

const scrollX = computed(() => columns.value.length * 200 + 20)

const { documentMenu } = useDocActions()
const { openNew } = useTabs()

/** Click opens here; Ctrl/Cmd-click or middle-click opens a new tab; right-click shows the menu. */
function rowProps(doc: FsDoc) {
	const target = { conn: props.conn, db: props.db, path: doc.path }
	return {
		style: 'cursor: pointer',
		onClick: (event: MouseEvent) =>
			event.ctrlKey || event.metaKey ? openNew(target) : emit('open', doc.path),
		onAuxclick: (event: MouseEvent) => {
			if (event.button === 1) openNew(target)
		},
		onContextmenu: (event: MouseEvent) => documentMenu(event, target, doc.missing ? null : doc)
	}
}
</script>

<template>
	<NDataTable
		:columns="columns"
		:data="docs"
		:loading="loading"
		:row-key="(doc: FsDoc) => doc.path"
		:row-props="rowProps"
		:scroll-x="scrollX"
		size="small"
		virtual-scroll
		flex-height
		class="table" />
</template>

<style scoped>
.table {
	flex: 1;
	min-height: 200px;
}
:deep(.doc-id) {
	color: var(--fb-accent);
}
:deep(.doc-id.missing) {
	font-style: italic;
	opacity: 0.6;
}
</style>
