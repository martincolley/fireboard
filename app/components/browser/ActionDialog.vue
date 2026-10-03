<script setup lang="ts">
import {
	NAlert,
	NButton,
	NForm,
	NFormItem,
	NInput,
	NModal,
	NSelect,
	NSwitch,
	useMessage
} from 'naive-ui'
import type { FsValue } from '#shared/types/firestore'
import type { DocLocation } from '~/utils/docTransfer'

const { request, close } = useActionDialog()
const { bump } = useDataVersion()
const { connections, byId } = useConnections()
const loadDatabases = useDatabases()
const driverFor = useDriver()
const { openHere } = useTabs()
const message = useMessage()

const name = ref('')
const path = ref('')
const recursive = ref(true)
const targetConn = ref('')
const targetDb = ref('')
const databaseOptions = ref<{ value: string; label: string }[]>([])
const confirmText = ref('')
const file = ref<File | null>(null)
const busy = ref(false)
const fieldEditorOpen = ref(false)

const show = computed({
	get: () => Boolean(request.value) && request.value?.kind !== 'addField',
	set: (value) => {
		if (!value) close()
	}
})
const kind = computed(() => request.value?.kind)
const target = computed(() => request.value?.target)
const id = computed(() => lastSegment(target.value?.path ?? ''))
const parent = computed(() => parentPath(target.value?.path ?? ''))

const titles: Record<string, string> = {
	rename: 'Rename document',
	move: 'Move document',
	duplicate: 'Duplicate document',
	copyTo: 'Copy document to…',
	addSubcollection: 'Add subcollection',
	import: 'Import documents',
	deleteCollection: 'Delete collection'
}

const connectionOptions = computed(() =>
	connections.value.map((c) => ({
		value: c.id,
		label: `${c.name}${c.readOnly ? ' (read-only)' : ''}`
	}))
)

watch(request, (next) => {
	if (!next) return
	busy.value = false
	confirmText.value = ''
	file.value = null
	recursive.value = next.kind !== 'duplicate'
	name.value =
		next.kind === 'duplicate'
			? `${lastSegment(next.target.path)}-copy`
			: next.kind === 'rename'
				? lastSegment(next.target.path)
				: ''
	path.value = next.target.path
	targetConn.value = next.target.conn
	targetDb.value = next.target.db
	if (next.kind === 'addField') fieldEditorOpen.value = true
	if (next.kind === 'copyTo') void refreshDatabases()
})

watch(targetConn, () => {
	if (kind.value === 'copyTo') void refreshDatabases()
})

async function refreshDatabases() {
	try {
		const list = await loadDatabases(targetConn.value)
		databaseOptions.value = list.databases.map((d) => ({
			value: d.id,
			label: d.locationId ? `${d.id} (${d.locationId})` : d.id
		}))
		if (!list.databases.some((d) => d.id === targetDb.value))
			targetDb.value = list.databases[0]?.id ?? '(default)'
	} catch (error) {
		message.error(apiErrorMessage(error))
	}
}

function location(conn: string, db: string, at: string): DocLocation {
	return { driver: driverFor(conn), db, path: normalizePath(at) }
}

/** Copies (and for rename/move, then deletes) the document tree. */
async function transfer(dest: { conn: string; db: string; path: string }, removeSource: boolean) {
	const src = target.value!
	if (!isDocumentPath(dest.path))
		throw new Error('The destination must be a document path (collection/id)')
	if (normalizePath(dest.path) === src.path && dest.conn === src.conn && dest.db === src.db) {
		throw new Error('The destination is the same document')
	}
	const existing = await driverFor(dest.conn).getDocument(dest.db, normalizePath(dest.path))
	if (existing.doc) throw new Error(`${dest.path} already exists`)
	const written = await copyDocumentTree(
		location(src.conn, src.db, src.path),
		location(dest.conn, dest.db, dest.path),
		recursive.value
	)
	if (removeSource) await driverFor(src.conn).deleteDocument(src.db, src.path, recursive.value)
	return written
}

async function run() {
	const src = target.value
	if (!src) return
	busy.value = true
	try {
		switch (kind.value) {
			case 'rename':
			case 'duplicate': {
				const next = `${parent.value}/${name.value.trim()}`
				const written = await transfer(
					{ conn: src.conn, db: src.db, path: next },
					kind.value === 'rename'
				)
				message.success(
					`${kind.value === 'rename' ? 'Renamed' : 'Duplicated'}: ${written} document(s)`
				)
				openHere({ conn: src.conn, db: src.db, path: next })
				break
			}
			case 'move': {
				const written = await transfer({ conn: src.conn, db: src.db, path: path.value }, true)
				message.success(`Moved ${written} document(s)`)
				openHere({ conn: src.conn, db: src.db, path: path.value })
				break
			}
			case 'copyTo': {
				const written = await transfer(
					{ conn: targetConn.value, db: targetDb.value, path: path.value },
					false
				)
				message.success(
					`Copied ${written} document(s) to ${byId(targetConn.value)?.name} · ${targetDb.value}`
				)
				break
			}
			case 'addSubcollection': {
				const collection = `${src.path}/${name.value.trim()}`
				if (!isCollectionPath(collection))
					throw new Error('Use a single collection id (no slashes)')
				const doc = await driverFor(src.conn).createDocument(
					src.db,
					collection,
					path.value.trim(),
					{}
				)
				openHere({ conn: src.conn, db: src.db, path: doc.path })
				break
			}
			case 'import':
				await importFile(src)
				break
			case 'deleteCollection': {
				const docs = await listAllDocuments(driverFor(src.conn), src.db, src.path)
				for (const doc of docs) await driverFor(src.conn).deleteDocument(src.db, doc.path, true)
				message.success(`Deleted ${docs.length} document(s) and their subcollections`)
				break
			}
		}
		bump({
			tree:
				kind.value === 'addSubcollection' ||
				kind.value === 'deleteCollection' ||
				kind.value === 'copyTo'
		})
		close()
	} catch (error) {
		message.error(apiErrorMessage(error), { duration: 10000 })
	} finally {
		busy.value = false
	}
}

/** Accepts {"id": {fields}} (Fireboard's JSON view), or [{"id", "fields"}] in extended JSON. */
async function importFile(src: { conn: string; db: string; path: string }) {
	if (!file.value) throw new Error('Choose a JSON file')
	const parsed: unknown = JSON.parse(await file.value.text())
	const entries: [string, unknown][] = Array.isArray(parsed)
		? parsed.map((item: { id?: string; fields?: unknown }) => [item.id ?? '', item.fields ?? item])
		: Object.entries(parsed as Record<string, unknown>)
	let created = 0
	const failed: string[] = []
	for (const [docId, fields] of entries) {
		try {
			await driverFor(src.conn).createDocument(src.db, src.path, docId, fieldsFromExtJson(fields))
			created++
		} catch (error) {
			failed.push(`${docId || '(auto id)'}: ${apiErrorMessage(error)}`)
		}
	}
	if (failed.length)
		message.warning(
			`Imported ${created}, failed ${failed.length}: ${failed.slice(0, 3).join('; ')}`,
			{ duration: 15000 }
		)
	else message.success(`Imported ${created} document(s)`)
}

function onFile(event: Event) {
	file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function saveField({ name: field, value }: { name: string; value: FsValue }) {
	const src = target.value
	if (!src) return
	try {
		await driverFor(src.conn).updateField(src.db, src.path, [field], value)
		message.success(`Added ${field}`)
		bump()
	} catch (error) {
		message.error(apiErrorMessage(error), { duration: 10000 })
	} finally {
		close()
	}
}

watch(fieldEditorOpen, (open) => {
	if (!open && kind.value === 'addField') close()
})

const canRun = computed(() => {
	switch (kind.value) {
		case 'rename':
			return (
				Boolean(name.value.trim()) && name.value.trim() !== id.value && !name.value.includes('/')
			)
		case 'duplicate':
		case 'addSubcollection':
			return Boolean(name.value.trim()) && !name.value.includes('/')
		case 'move':
		case 'copyTo':
			return isDocumentPath(normalizePath(path.value))
		case 'import':
			return Boolean(file.value)
		case 'deleteCollection':
			return confirmText.value === id.value
		default:
			return false
	}
})
</script>

<template>
	<NModal v-model:show="show" preset="card" :title="titles[kind ?? ''] ?? ''" style="width: 560px">
		<NForm label-placement="top" @submit.prevent="run">
			<p class="where mono">
				{{ byId(target?.conn ?? '')?.name }} · {{ target?.db }} · {{ target?.path }}
			</p>

			<template v-if="kind === 'rename' || kind === 'duplicate'">
				<NFormItem label="New document id">
					<NInput v-model:value="name" class="mono" autofocus />
				</NFormItem>
			</template>

			<template v-if="kind === 'move'">
				<NFormItem label="New document path (same database)">
					<NInput v-model:value="path" class="mono" autofocus />
				</NFormItem>
			</template>

			<template v-if="kind === 'copyTo'">
				<NFormItem label="Connection">
					<NSelect v-model:value="targetConn" :options="connectionOptions" />
				</NFormItem>
				<NFormItem label="Database">
					<NSelect v-model:value="targetDb" :options="databaseOptions" />
				</NFormItem>
				<NFormItem label="Document path">
					<NInput v-model:value="path" class="mono" />
				</NFormItem>
			</template>

			<NFormItem
				v-if="kind === 'rename' || kind === 'move' || kind === 'duplicate' || kind === 'copyTo'"
				label="Include subcollections">
				<NSwitch v-model:value="recursive" />
			</NFormItem>
			<NAlert
				v-if="kind === 'rename' || kind === 'move'"
				type="warning"
				:bordered="false"
				class="note">
				Firestore can't rename in place: this copies the document{{
					recursive ? ' and its subcollections' : ''
				}}
				to the new path, then deletes the original. References elsewhere still point at the old
				path.
			</NAlert>

			<template v-if="kind === 'addSubcollection'">
				<NFormItem label="Collection id">
					<NInput v-model:value="name" class="mono" autofocus />
				</NFormItem>
				<NFormItem label="First document id (empty = auto)">
					<NInput v-model:value="path" class="mono" />
				</NFormItem>
			</template>

			<template v-if="kind === 'import'">
				<p class="hint">
					A JSON file shaped like Fireboard's JSON view (
					<span class="mono">{"id": {fields}}</span>
					) or a list of
					<span class="mono">{"id", "fields"}</span>
					. Existing ids are skipped, never overwritten.
				</p>
				<input type="file" accept=".json,application/json" @change="onFile" />
			</template>

			<template v-if="kind === 'deleteCollection'">
				<NAlert type="error" :bordered="false" class="note">
					Deletes every document in this collection and all their subcollections. This can't be
					undone.
				</NAlert>
				<NFormItem :label="`Type ${id} to confirm`">
					<NInput v-model:value="confirmText" class="mono" />
				</NFormItem>
			</template>

			<div class="buttons">
				<NButton @click="close">Cancel</NButton>
				<NButton
					:type="kind === 'deleteCollection' ? 'error' : 'primary'"
					attr-type="submit"
					:loading="busy"
					:disabled="!canRun">
					{{ kind === 'deleteCollection' ? 'Delete' : 'Run' }}
				</NButton>
			</div>
		</NForm>
	</NModal>
	<ValueEditorModal
		v-model:show="fieldEditorOpen"
		title="Add field"
		:value="{ t: 'string', v: '' }"
		ask-name
		@save="saveField" />
</template>

<style scoped>
.where {
	color: var(--fb-muted);
	margin: 0 0 16px;
	word-break: break-all;
}
.note {
	margin-bottom: 16px;
}
.hint {
	color: var(--fb-muted);
	margin: 0 0 12px;
}
.buttons {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 16px;
}
</style>
