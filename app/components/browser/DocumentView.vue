<script setup lang="ts">
import { NButton, NCheckbox, NIcon, NInput, NTag, useDialog, useMessage } from 'naive-ui'
import {
	AddOutline,
	CopyOutline,
	EllipsisHorizontal,
	RefreshOutline,
	TrashOutline
} from '@vicons/ionicons5'
import type { FsDoc, FsDocResult } from '#shared/types/firestore'
import type { BrowserTab } from '~/composables/useTabs'

const props = defineProps<{ tab: BrowserTab }>()
const emit = defineEmits<{ open: [path: string] }>()

const message = useMessage()
const dialog = useDialog()
const { byId } = useConnections()
const writes = useDocWrites(props.tab)
const driverFor = useDriver()
const { documentMenu, collectionMenu } = useDocActions()
const { openNew } = useTabs()
const { version } = useDataVersion()

function subcollection(id: string) {
	return { conn: props.tab.conn, db: props.tab.db, path: `${props.tab.path}/${id}` }
}

function openCollection(event: MouseEvent, id: string) {
	if (event.ctrlKey || event.metaKey) openNew(subcollection(id))
	else emit('open', `${props.tab.path}/${id}`)
}

function onMenu(event: MouseEvent) {
	documentMenu(event, { conn: props.tab.conn, db: props.tab.db, path: props.tab.path }, doc.value)
}
const viewResults = useViewResults()

const doc = ref<FsDoc | null>(null)
const collections = ref<string[]>([])
const loading = ref(false)
const error = ref('')
const jsonText = ref('')
const jsonError = ref('')
const fieldsRef = ref<{ addTopLevel(): void } | null>(null)

const editable = computed(() => !byId(props.tab.conn)?.readOnly)

async function load() {
	loading.value = true
	error.value = ''
	try {
		const res = await driverFor(props.tab.conn).getDocument(props.tab.db, props.tab.path)
		setDoc(res.doc)
		collections.value = res.collections
		viewResults.value[props.tab.id] = {
			documents: res.doc ? [res.doc] : [],
			subcollections: res.collections
		}
	} catch (e) {
		error.value = apiErrorMessage(e)
	} finally {
		loading.value = false
	}
}

function setDoc(next: FsDoc | null) {
	doc.value = next
	jsonText.value = next ? JSON.stringify(fieldsToExtJson(next.fields), null, 2) : '{\n  \n}'
	jsonError.value = ''
}

async function saveJson() {
	try {
		const fields = fieldsFromExtJson(JSON.parse(jsonText.value))
		setDoc(await writes.replaceDoc(props.tab.path, fields))
		message.success('Saved')
	} catch (e) {
		jsonError.value = apiErrorMessage(e)
	}
}

function confirmDelete() {
	const recursive = ref(false)
	dialog.warning({
		title: 'Delete document',
		content: () =>
			h('div', [
				h('p', `Delete ${props.tab.path} from ${props.tab.db}?`),
				collections.value.length
					? h(
							NCheckbox,
							{
								checked: recursive.value,
								'onUpdate:checked': (v: boolean) => (recursive.value = v)
							},
							() => `Also delete subcollections (${collections.value.join(', ')})`
						)
					: null
			]),
		positiveText: 'Delete',
		negativeText: 'Cancel',
		onPositiveClick: async () => {
			try {
				await writes.deleteDoc(props.tab.path, recursive.value)
				message.success('Deleted')
				await load()
			} catch (e) {
				message.error(apiErrorMessage(e), { duration: 10000 })
			}
		}
	})
}

async function copyPath() {
	await navigator.clipboard.writeText(props.tab.path)
	message.success('Path copied')
}

watch(() => props.tab.path, load, { immediate: true })
// Reload after a write from a menu or dialog.
watch(version, load)
</script>

<template>
	<div class="actions" @contextmenu="onMenu">
		<span class="mono meta" v-if="doc">
			updated {{ doc.updateTime ? new Date(doc.updateTime).toLocaleString() : '-' }}
		</span>
		<span v-else-if="!loading && !error" class="meta">
			{{
				collections.length
					? 'No data: this document only holds subcollections'
					: 'Document does not exist'
			}}
		</span>
		<span class="grow" />
		<NButton size="tiny" quaternary @click="copyPath">
			<template #icon><NIcon :component="CopyOutline" /></template>
			Path
		</NButton>
		<NButton size="tiny" quaternary :loading="loading" @click="load">
			<template #icon><NIcon :component="RefreshOutline" /></template>
			Refresh
		</NButton>
		<NButton size="tiny" quaternary title="More actions" aria-label="More actions" @click="onMenu">
			<template #icon><NIcon :component="EllipsisHorizontal" /></template>
		</NButton>
		<template v-if="editable && doc">
			<NButton v-if="tab.view !== 'json'" size="tiny" quaternary @click="fieldsRef?.addTopLevel()">
				<template #icon><NIcon :component="AddOutline" /></template>
				Field
			</NButton>
			<NButton size="tiny" quaternary type="error" @click="confirmDelete">
				<template #icon><NIcon :component="TrashOutline" /></template>
				Delete
			</NButton>
		</template>
	</div>
	<div v-if="collections.length" class="collections">
		<span class="meta">Subcollections</span>
		<NTag
			v-for="id in collections"
			:key="id"
			size="small"
			class="collection"
			@click="(event: MouseEvent) => openCollection(event, id)"
			@auxclick="(event: MouseEvent) => event.button === 1 && openNew(subcollection(id))"
			@contextmenu="(event: MouseEvent) => collectionMenu(event, subcollection(id))">
			{{ id }}
		</NTag>
	</div>
	<div v-if="error" class="error mono">{{ error }}</div>
	<div class="body">
		<div v-if="tab.view === 'json'" class="json">
			<NInput
				v-model:value="jsonText"
				type="textarea"
				class="mono"
				:readonly="!editable"
				:autosize="{ minRows: 10 }" />
			<p v-if="jsonError" class="error">{{ jsonError }}</p>
			<div v-if="editable" class="buttons">
				<NButton size="small" @click="setDoc(doc)">Revert</NButton>
				<NButton size="small" type="primary" @click="saveJson">
					{{ doc ? 'Save (replace document)' : 'Create document' }}
				</NButton>
			</div>
		</div>
		<ValueDocFields
			v-else-if="doc"
			ref="fieldsRef"
			:doc="doc"
			:conn="tab.conn"
			:db="tab.db"
			:editable="editable"
			@updated="setDoc"
			@open="emit('open', $event)" />
	</div>
</template>

<style scoped>
.actions,
.collections {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 12px;
	border-bottom: 1px solid var(--fb-border);
	flex-wrap: wrap;
}
.meta {
	color: var(--fb-muted);
	font-size: 12px;
}
.grow {
	flex: 1;
}
.collection {
	cursor: pointer;
}
.error {
	padding: 8px 12px;
	color: #ff6b6b;
	white-space: pre-wrap;
	word-break: break-word;
}
.body {
	flex: 1;
	overflow: auto;
	min-height: 0;
}
.json {
	padding: 8px 12px;
}
.buttons {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 8px;
}
</style>
