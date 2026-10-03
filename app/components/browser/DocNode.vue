<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import type { FsDoc } from '#shared/types/firestore'

const props = defineProps<{ doc: FsDoc; conn: string; db: string; editable: boolean }>()
const emit = defineEmits<{ updated: [FsDoc]; open: [path: string] }>()

const expanded = ref(false)
const { documentMenu } = useDocActions()
const { openNew } = useTabs()
const target = computed(() => ({ conn: props.conn, db: props.db, path: props.doc.path }))

function onOpen(event: MouseEvent) {
	if (event.ctrlKey || event.metaKey) openNew(target.value)
	else emit('open', props.doc.path)
}

function onAux(event: MouseEvent) {
	if (event.button === 1) openNew(target.value)
}

function onMenu(event: MouseEvent) {
	documentMenu(event, target.value, props.doc.missing ? null : props.doc)
}
const summary = computed(() =>
	props.doc.missing
		? 'no data, only subcollections'
		: summarize({ t: 'map', v: props.doc.fields }, 300)
)
</script>

<template>
	<div class="doc" @click="expanded = !expanded" @contextmenu="onMenu">
		<NIcon :component="expanded ? ChevronDownOutline : ChevronForwardOutline" :size="12" />
		<a
			class="mono id"
			:class="{ missing: doc.missing }"
			@click.stop="onOpen"
			@auxclick.stop="onAux">
			{{ doc.id }}
		</a>
		<span class="mono summary">{{ summary }}</span>
		<span class="type">Document</span>
	</div>
	<ValueDocFields
		v-if="expanded && !doc.missing"
		:doc="doc"
		:conn="conn"
		:db="db"
		:editable="editable"
		:depth="1"
		@updated="emit('updated', $event)"
		@open="emit('open', $event)" />
</template>

<style scoped>
.doc {
	display: grid;
	grid-template-columns: 16px minmax(180px, 30%) 1fr 90px;
	align-items: center;
	gap: 4px;
	min-height: 26px;
	padding: 0 8px;
	border-bottom: 1px solid var(--fb-border);
	cursor: pointer;
}
.doc:hover {
	background: rgba(255, 255, 255, 0.03);
}
.id {
	color: var(--fb-reference);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.id.missing {
	font-style: italic;
	opacity: 0.6;
}
.id:hover {
	text-decoration: underline;
}
.summary {
	color: var(--fb-muted);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.type {
	color: var(--fb-muted);
	font-size: 11px;
}
</style>
