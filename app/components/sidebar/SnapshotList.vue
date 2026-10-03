<script setup lang="ts">
import { NButton, NIcon, NTooltip, useDialog, useMessage } from 'naive-ui'
import {
	CloudUploadOutline,
	DownloadOutline,
	FolderOpenOutline,
	TrashOutline
} from '@vicons/ionicons5'
import type { SnapshotMeta } from '#shared/types/snapshot'

const { snapshots, load, remove, download, importFile, canTransfer } = useSnapshots()
const fileInput = ref<HTMLInputElement | null>(null)

async function onImport(event: Event) {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	input.value = ''
	if (!file) return
	try {
		const meta = await importFile(file)
		message.success(`Imported ${meta.name}`)
	} catch (e) {
		message.error(apiErrorMessage(e))
	}
}

async function onDownload(name: string) {
	try {
		await download(name)
	} catch (e) {
		message.error(apiErrorMessage(e))
	}
}
const dialog = useDialog()
const message = useMessage()

const loading = ref<SnapshotMeta | null>(null)
const loadOpen = ref(false)

onMounted(() => load().catch((e) => message.error(apiErrorMessage(e))))

function openLoad(snapshot: SnapshotMeta) {
	loading.value = snapshot
	loadOpen.value = true
}

function confirmRemove(snapshot: SnapshotMeta) {
	dialog.warning({
		title: 'Delete snapshot',
		content: `Delete the local snapshot "${snapshot.name}"?`,
		positiveText: 'Delete',
		negativeText: 'Cancel',
		onPositiveClick: () => remove(snapshot.name)
	})
}
</script>

<template>
	<div v-if="snapshots.length || canTransfer" class="snapshots">
		<div class="title">
			<span>Snapshots (anonymized)</span>
			<NButton
				v-if="canTransfer"
				quaternary
				size="tiny"
				title="Import a snapshot file"
				@click="fileInput?.click()">
				<NIcon :component="FolderOpenOutline" />
			</NButton>
			<input ref="fileInput" type="file" accept=".ndjson,.json" hidden @change="onImport" />
		</div>
		<div v-for="s in snapshots" :key="s.name" class="item">
			<NTooltip placement="right">
				<template #trigger>
					<span class="name mono">{{ s.name }}</span>
				</template>
				{{ s.source.projectId }} · {{ s.source.db }} · {{ s.source.paths.join(', ') }}
				<br />
				{{ s.docCount }} docs{{ s.truncated ? ' (truncated)' : '' }} ·
				{{ new Date(s.createdAt).toLocaleString() }}
			</NTooltip>
			<NButton
				v-if="canTransfer"
				quaternary
				size="tiny"
				title="Download file"
				@click="onDownload(s.name)">
				<NIcon :component="DownloadOutline" />
			</NButton>
			<NButton quaternary size="tiny" title="Load into emulator" @click="openLoad(s)">
				<NIcon :component="CloudUploadOutline" />
			</NButton>
			<NButton quaternary size="tiny" title="Delete" @click="confirmRemove(s)">
				<NIcon :component="TrashOutline" />
			</NButton>
		</div>
		<SidebarLoadSnapshotModal v-model:show="loadOpen" :snapshot="loading" />
	</div>
</template>

<style scoped>
.snapshots {
	border-top: 1px solid var(--fb-border);
	padding: 6px 8px;
	max-height: 30%;
	overflow: auto;
}
.title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	color: var(--fb-muted);
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	padding: 4px;
}
.item {
	display: flex;
	align-items: center;
	gap: 2px;
}
.name {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 11px;
}
</style>
