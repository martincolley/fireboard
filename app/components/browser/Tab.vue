<script setup lang="ts">
import {
	NButton,
	NButtonGroup,
	NDropdown,
	NIcon,
	NInput,
	NTag,
	type DropdownOption
} from 'naive-ui'
import {
	ArrowBackOutline,
	ArrowUpOutline,
	CameraOutline,
	LockClosedOutline
} from '@vicons/ionicons5'
import type { BrowserTab, ViewMode } from '~/composables/useTabs'

const props = defineProps<{ tab: BrowserTab }>()

const { navigate, back, persist } = useTabs()
const { byId } = useConnections()
const loadDatabases = useDatabases()

const connection = computed(() => byId(props.tab.conn))
const snapshotOpen = ref(false)
const pathInput = ref(props.tab.path)
watch(
	() => props.tab.path,
	(path) => (pathInput.value = path)
)

const isCollection = computed(() => isCollectionPath(props.tab.path))
const isDocument = computed(() => isDocumentPath(props.tab.path))

const views: { value: ViewMode; label: string }[] = [
	{ value: 'table', label: 'Table' },
	{ value: 'tree', label: 'Tree' },
	{ value: 'json', label: 'JSON' }
]

const dbOptions = shallowRef<DropdownOption[]>([])

/** Lists the connection's databases so the same path can be opened in another region. */
async function loadDbOptions(visible: boolean) {
	if (!visible) return
	const { databases } = await loadDatabases(props.tab.conn)
	dbOptions.value = databases.map((db) => ({
		key: db.id,
		label: db.locationId ? `${db.id}  (${db.locationId})` : db.id,
		disabled: db.id === props.tab.db
	}))
}

function switchDb(db: string) {
	props.tab.db = db
	persist()
}

function go(path: string) {
	navigate(props.tab, path)
}

function setView(view: ViewMode) {
	props.tab.view = view
	persist()
}
</script>

<template>
	<div class="tab-view">
		<div class="toolbar">
			<NButton quaternary size="small" :disabled="!tab.history.length" @click="back(tab)">
				<NIcon :component="ArrowBackOutline" />
			</NButton>
			<NButton quaternary size="small" :disabled="!tab.path" @click="go(parentPath(tab.path))">
				<NIcon :component="ArrowUpOutline" />
			</NButton>
			<NDropdown
				trigger="click"
				:options="dbOptions"
				@update:show="loadDbOptions"
				@select="switchDb">
				<NTag
					size="small"
					:bordered="false"
					class="target"
					title="Open this path in another database"
					:color="{ color: connection?.color || '#ff8a3d', textColor: '#111' }">
					{{ connection?.name ?? tab.conn }} · {{ tab.db }} ▾
				</NTag>
			</NDropdown>
			<NIcon
				v-if="connection?.readOnly"
				:component="LockClosedOutline"
				title="Read-only connection" />
			<NInput
				v-model:value="pathInput"
				size="small"
				class="mono path"
				placeholder="collection/doc/subcollection"
				@keydown.enter="go(pathInput)" />
			<NButton
				quaternary
				size="small"
				:disabled="!tab.path"
				title="Anonymized snapshot of this path (for the emulator)"
				@click="snapshotOpen = true">
				<NIcon :component="CameraOutline" />
			</NButton>
			<NButtonGroup size="small">
				<NButton
					v-for="view in views"
					:key="view.value"
					:type="tab.view === view.value ? 'primary' : 'default'"
					:secondary="tab.view === view.value"
					@click="setView(view.value)">
					{{ view.label }}
				</NButton>
			</NButtonGroup>
		</div>
		<BrowserCollectionView
			v-if="isCollection"
			:key="`${tab.conn}:${tab.db}`"
			:tab="tab"
			@open="go" />
		<BrowserDocumentView
			v-else-if="isDocument"
			:key="`${tab.conn}:${tab.db}`"
			:tab="tab"
			@open="go" />
		<div v-else class="empty">Enter a collection or document path.</div>
		<BrowserSnapshotModal v-model:show="snapshotOpen" :tab="tab" />
	</div>
</template>

<style scoped>
.tab-view {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
}
.toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	border-bottom: 1px solid var(--fb-border);
}
.path {
	flex: 1;
}
.target {
	cursor: pointer;
}
.empty {
	padding: 24px;
	color: var(--fb-muted);
}
</style>
