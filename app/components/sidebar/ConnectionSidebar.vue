<script setup lang="ts">
import { NButton, NIcon, NTooltip, NTree, useDialog, useMessage, type TreeOption } from 'naive-ui'
import {
	AddOutline,
	CreateOutline,
	FlameOutline,
	FolderOutline,
	LockClosedOutline,
	RefreshOutline,
	ServerOutline,
	TrashOutline
} from '@vicons/ionicons5'
import type { Connection } from '#shared/types/connection'

interface NodeMeta {
	kind: 'connection' | 'database' | 'collection'
	conn: string
	db?: string
	path?: string
}

type Node = TreeOption & { meta: NodeMeta }

const { connections, configPath, remove } = useConnections()
const { isCloud } = useMode()
const loadDatabases = useDatabases()
const driverFor = useDriver()
const { openHere, openNew } = useTabs()
const { collectionMenu } = useDocActions()
const { treeVersion } = useDataVersion()
const message = useMessage()
const dialog = useDialog()

const formOpen = ref(false)
const editing = ref<Connection | null>(null)
const treeKey = ref(0)
const expandedKeys = ref<string[]>([])

/** A ref (not computed) so the lazily loaded `children` mutations are reactive. */
const data = ref<Node[]>([])
watch(
	connections,
	(list) => {
		data.value = list.map((c) => ({
			key: `c:${c.id}`,
			label: c.name,
			isLeaf: false,
			meta: { kind: 'connection', conn: c.id }
		}))
	},
	{ immediate: true }
)

async function onLoad(option: TreeOption): Promise<void> {
	const node = option as Node
	try {
		if (node.meta.kind === 'connection') {
			const list = await loadDatabases(node.meta.conn, true)
			if (list.warning) message.warning(list.warning, { duration: 8000 })
			node.children = list.databases.map<Node>((db) => ({
				key: `d:${node.meta.conn}:${db.id}`,
				label: db.id,
				isLeaf: false,
				meta: { kind: 'database', conn: node.meta.conn, db: db.id },
				suffix: () => (db.locationId ? h('span', { class: 'location' }, db.locationId) : null)
			}))
		} else if (node.meta.kind === 'database') {
			const collections = await driverFor(node.meta.conn).listCollections(node.meta.db!)
			node.children = collections.map<Node>((id) => ({
				key: `col:${node.meta.conn}:${node.meta.db}:${id}`,
				label: id,
				isLeaf: true,
				meta: { kind: 'collection', conn: node.meta.conn, db: node.meta.db, path: id }
			}))
		}
	} catch (error) {
		message.error(apiErrorMessage(error), { duration: 8000 })
		node.children = []
	}
}

/**
 * Collections: click opens in this tab, Ctrl/Cmd-click or middle-click in a
 * new tab, right-click shows the collection menu.
 */
function nodeProps({ option }: { option: TreeOption }) {
	const meta = (option as Node).meta
	if (meta.kind !== 'collection') return {}
	const target = { conn: meta.conn, db: meta.db!, path: meta.path! }
	return {
		onClick(event: MouseEvent) {
			if (event.ctrlKey || event.metaKey) openNew(target)
			else openHere(target)
		},
		onAuxclick(event: MouseEvent) {
			if (event.button === 1) openNew(target)
		},
		onContextmenu(event: MouseEvent) {
			collectionMenu(event, target)
		}
	}
}

function renderPrefix({ option }: { option: TreeOption }) {
	const meta = (option as Node).meta
	if (meta.kind === 'connection') {
		const conn = connections.value.find((c) => c.id === meta.conn)
		return h('span', { class: 'dot', style: { background: conn?.color || 'var(--fb-accent)' } })
	}
	return h(NIcon, { size: 14, component: meta.kind === 'database' ? ServerOutline : FolderOutline })
}

function renderSuffix({ option }: { option: TreeOption }) {
	const node = option as Node & { suffix?: () => unknown }
	if (node.meta.kind === 'database') return node.suffix?.()
	if (node.meta.kind !== 'connection') return null
	const conn = connections.value.find((c) => c.id === node.meta.conn)
	if (!conn) return null
	return h('span', { class: 'actions' }, [
		conn.readOnly ? h(NIcon, { size: 13, component: LockClosedOutline, title: 'Read-only' }) : null,
		h(NButton, { quaternary: true, size: 'tiny', onClick: (e: Event) => edit(e, conn) }, () =>
			h(NIcon, { component: CreateOutline })
		),
		h(
			NButton,
			{ quaternary: true, size: 'tiny', onClick: (e: Event) => confirmRemove(e, conn) },
			() => h(NIcon, { component: TrashOutline })
		)
	])
}

function add() {
	editing.value = null
	formOpen.value = true
}

function edit(event: Event, conn: Connection) {
	event.stopPropagation()
	editing.value = conn
	formOpen.value = true
}

function confirmRemove(event: Event, conn: Connection) {
	event.stopPropagation()
	dialog.warning({
		title: 'Remove connection',
		content: `Remove "${conn.name}" from Fireboard? This only edits your local config.`,
		positiveText: 'Remove',
		negativeText: 'Cancel',
		onPositiveClick: async () => {
			await remove(conn.id)
		}
	})
}

/** Collapses and re-creates the tree so every lazy level reloads. */
// After writes or reconnecting Google, reload the tree (failed lazy loads stay empty otherwise).
watch(treeVersion, () => refresh())

function refresh() {
	expandedKeys.value = []
	data.value = data.value.map(({ children: _children, ...node }) => node)
	treeKey.value++
}
</script>

<template>
	<div class="header">
		<span class="brand">
			<NIcon :component="FlameOutline" color="var(--fb-accent)" />
			Fireboard
		</span>
		<div>
			<NTooltip>
				<template #trigger>
					<NButton quaternary size="small" @click="refresh">
						<NIcon :component="RefreshOutline" />
					</NButton>
				</template>
				Reload tree
			</NTooltip>
			<NTooltip>
				<template #trigger>
					<NButton quaternary size="small" @click="add">
						<NIcon :component="AddOutline" />
					</NButton>
				</template>
				Add connection
			</NTooltip>
		</div>
	</div>
	<AccountCloudBar v-if="isCloud" />
	<div class="tree">
		<NTree
			v-if="connections.length"
			:key="treeKey"
			v-model:expanded-keys="expandedKeys"
			:data="data"
			:on-load="onLoad"
			:node-props="nodeProps"
			:render-prefix="renderPrefix"
			:render-suffix="renderSuffix"
			block-line
			expand-on-click
			selectable />
		<div v-if="!connections.length" class="hint">
			<p>No connections yet.</p>
			<NButton size="small" type="primary" @click="add">Add connection</NButton>
		</div>
	</div>
	<SidebarSnapshotList />
	<div v-if="!isCloud" class="footer mono" :title="configPath">{{ configPath }}</div>
	<SidebarConnectionForm v-model:show="formOpen" :connection="editing" />
</template>

<style scoped>
.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 12px;
	border-bottom: 1px solid var(--fb-border);
}
.brand {
	display: flex;
	align-items: center;
	gap: 6px;
	font-weight: 600;
	font-size: 14px;
}
.tree {
	flex: 1;
	overflow: auto;
	padding: 6px 4px;
}
.hint {
	padding: 16px;
	color: var(--fb-muted);
}
.footer {
	padding: 6px 12px;
	border-top: 1px solid var(--fb-border);
	color: var(--fb-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: 11px;
}
:deep(.dot) {
	display: inline-block;
	width: 9px;
	height: 9px;
	border-radius: 50%;
}
:deep(.location) {
	color: var(--fb-muted);
	font-size: 11px;
	margin-right: 6px;
}
:deep(.actions) {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	color: var(--fb-muted);
}
</style>
