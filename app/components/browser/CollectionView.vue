<script setup lang="ts">
import { NButton, NIcon, useMessage } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import type { FsDoc, FsQuery, FsQueryResult } from '#shared/types/firestore'
import type { BrowserTab } from '~/composables/useTabs'

const props = defineProps<{ tab: BrowserTab }>()
const emit = defineEmits<{ open: [path: string] }>()

const message = useMessage()
const { persist } = useTabs()
const { byId } = useConnections()
const writes = useDocWrites(props.tab)
const driverFor = useDriver()
const viewResults = useViewResults()
const { version } = useDataVersion()

const docs = ref<FsDoc[]>([])
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
const count = ref<number | null>(null)
const nextPageToken = ref<string | undefined>()
const newDocOpen = ref(false)

const editable = computed(() => !byId(props.tab.conn)?.readOnly)

function buildRequest(cursor: { startAfter?: string; pageToken?: string } = {}): FsQuery {
	const q = props.tab.query
	return {
		conn: props.tab.conn,
		db: props.tab.db,
		path: props.tab.path,
		group: q.group || undefined,
		filters: q.filters.filter((f) => f.field.trim()).map(toFsFilter),
		orderBy: q.orderBy.filter((o) => o.field.trim()),
		limit: q.limit,
		...cursor
	}
}

async function run(append = false) {
	loading.value = true
	error.value = ''
	try {
		const { conn: _conn, ...request } = buildRequest(
			append ? { pageToken: nextPageToken.value } : {}
		)
		const res = await driverFor(props.tab.conn).runQuery(
			request,
			append ? docs.value.at(-1) : undefined
		)
		nextPageToken.value = res.nextPageToken
		docs.value = append ? [...docs.value, ...res.docs] : res.docs
		hasMore.value = res.hasMore
		viewResults.value[props.tab.id] = { documents: docs.value, hasMore: res.hasMore }
		if (!append) count.value = null
		persist()
	} catch (e) {
		error.value = apiErrorMessage(e)
	} finally {
		loading.value = false
	}
}

async function runCount() {
	try {
		const { limit: _limit, conn: _conn, ...request } = buildRequest()
		// Count runs as a query, so it excludes missing (data-less) documents.
		count.value = await driverFor(props.tab.conn).count(request)
	} catch (e) {
		message.error(apiErrorMessage(e), { duration: 10000 })
	}
}

function onUpdated(doc: FsDoc) {
	const index = docs.value.findIndex((d) => d.path === doc.path)
	if (index !== -1) docs.value[index] = doc
}

async function onCreate({ id, fields }: { id: string; fields: FsDoc['fields'] }) {
	try {
		const doc = await writes.createDoc(props.tab.path, id, fields)
		docs.value = [doc, ...docs.value]
		message.success(`Created ${doc.path}`)
		newDocOpen.value = false
	} catch (e) {
		message.error(apiErrorMessage(e), { duration: 10000 })
	}
}

watch(
	() => props.tab.path,
	() => {
		docs.value = []
		run()
	},
	{ immediate: true }
)

// Reload after a write from a menu or dialog.
watch(version, () => run())
</script>

<template>
	<BrowserQueryBar
		v-model="tab.query"
		:loading="loading"
		:count="count"
		@run="run()"
		@count="runCount" />
	<div class="status">
		<span>{{ docs.length }} doc{{ docs.length === 1 ? '' : 's' }}{{ hasMore ? '+' : '' }}</span>
		<span class="grow" />
		<NButton v-if="editable && !tab.query.group" size="tiny" quaternary @click="newDocOpen = true">
			<template #icon><NIcon :component="AddOutline" /></template>
			New document
		</NButton>
	</div>
	<div v-if="error" class="error mono">{{ error }}</div>
	<div class="results">
		<BrowserDocTable
			v-if="tab.view === 'table'"
			:conn="tab.conn"
			:db="tab.db"
			:docs="docs"
			:loading="loading"
			@open="emit('open', $event)" />
		<div v-else-if="tab.view === 'tree'">
			<BrowserDocNode
				v-for="doc in docs"
				:key="doc.path"
				:doc="doc"
				:conn="tab.conn"
				:db="tab.db"
				:editable="editable"
				@updated="onUpdated"
				@open="emit('open', $event)" />
		</div>
		<BrowserJsonView v-else :docs="docs" />
		<div v-if="hasMore" class="more">
			<NButton size="small" :loading="loading" @click="run(true)">Load more</NButton>
		</div>
	</div>
	<BrowserNewDocModal v-model:show="newDocOpen" :collection="tab.path" @create="onCreate" />
</template>

<style scoped>
.status {
	display: flex;
	align-items: center;
	padding: 4px 12px;
	color: var(--fb-muted);
	font-size: 12px;
	border-bottom: 1px solid var(--fb-border);
}
.grow {
	flex: 1;
}
.error {
	padding: 8px 12px;
	color: #ff6b6b;
	white-space: pre-wrap;
	word-break: break-word;
	border-bottom: 1px solid var(--fb-border);
}
.results {
	flex: 1;
	overflow: auto;
	min-height: 0;
	display: flex;
	flex-direction: column;
}
.more {
	padding: 12px;
	text-align: center;
}
</style>
