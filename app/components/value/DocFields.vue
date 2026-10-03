<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui'
import type { FsDoc, FsValue } from '#shared/types/firestore'
import { getIn, type ValuePath } from '~/utils/fsValueEdit'

const props = defineProps<{
	doc: FsDoc
	conn: string
	db: string
	editable: boolean
	depth?: number
}>()
const emit = defineEmits<{ updated: [FsDoc]; open: [path: string] }>()

const message = useMessage()
const dialog = useDialog()
const writes = useDocWrites({ conn: props.conn, db: props.db })

/** Pending editor state: where the value goes and whether a name must be asked. */
const editorOpen = ref(false)
const editorTitle = ref('')
const editorValue = ref<FsValue>({ t: 'null' })
const editorAskName = ref(false)
let editorTarget: { path: ValuePath; mode: 'set' | 'append' } = { path: [], mode: 'set' }

async function write(path: ValuePath, value: FsValue | undefined) {
	try {
		emit('updated', await writes.updateField(props.doc, path, value))
	} catch (error) {
		message.error(apiErrorMessage(error), { duration: 10000 })
	}
}

provide(fieldEditorKey, {
	editable: toRef(props, 'editable'),
	edit(path, value) {
		editorTarget = { path, mode: 'set' }
		editorTitle.value = `Edit ${path.join('.')}`
		editorValue.value = value
		editorAskName.value = false
		editorOpen.value = true
	},
	addChild(path, container) {
		editorTarget = { path, mode: container.t === 'array' ? 'append' : 'set' }
		editorTitle.value = `Add to ${path.join('.') || 'document'}`
		editorValue.value = { t: 'string', v: '' }
		editorAskName.value = container.t === 'map'
		editorOpen.value = true
	},
	remove(path) {
		dialog.warning({
			title: 'Delete field',
			content: `Delete "${path.join('.')}" from ${props.doc.path}?`,
			positiveText: 'Delete',
			negativeText: 'Cancel',
			onPositiveClick: () => write(path, undefined)
		})
	},
	openPath: (path) => emit('open', path)
})

function onSave({ name, value }: { name: string; value: FsValue }) {
	const { path, mode } = editorTarget
	if (mode === 'append') {
		const array = getIn({ t: 'map', v: props.doc.fields }, path)
		const length = array?.t === 'array' ? array.v.length : 0
		return write([...path, length], value)
	}
	write(editorAskName.value ? [...path, name] : path, value)
}

function addTopLevel() {
	editorTarget = { path: [], mode: 'set' }
	editorTitle.value = 'Add field'
	editorValue.value = { t: 'string', v: '' }
	editorAskName.value = true
	editorOpen.value = true
}

defineExpose({ addTopLevel })

const entries = computed(() => sortedEntries(props.doc.fields))
</script>

<template>
	<div>
		<ValueFieldRow
			v-for="[name, value] in entries"
			:key="name"
			:name="name"
			:value="value"
			:path="[name]"
			:depth="depth ?? 0" />
		<div v-if="!entries.length" class="empty">No fields</div>
		<ValueEditorModal
			v-model:show="editorOpen"
			:title="editorTitle"
			:value="editorValue"
			:ask-name="editorAskName"
			@save="onSave" />
	</div>
</template>

<style scoped>
.empty {
	padding: 8px 12px;
	color: var(--fb-muted);
}
</style>
