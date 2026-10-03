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
import type { SnapshotMeta } from '#shared/types/snapshot'

const props = defineProps<{ snapshot: SnapshotMeta | null }>()
const show = defineModel<boolean>('show', { required: true })

const { connections } = useConnections()
const { loadInto } = useSnapshots()
const { open } = useTabs()
const message = useMessage()

const conn = ref<string | null>(null)
const db = ref('(default)')
const wipe = ref(false)
const running = ref(false)

const emulatorOptions = computed(() =>
	connections.value
		.filter((c) => c.credential.type === 'emulator')
		.map((c) => ({
			value: c.id,
			label: `${c.name} (${c.credential.type === 'emulator' ? c.credential.host : ''})`
		}))
)

watch(show, (visible) => {
	if (!visible) return
	conn.value = emulatorOptions.value[0]?.value ?? null
	db.value = props.snapshot?.source.db ?? '(default)'
	wipe.value = false
})

async function submit() {
	if (!props.snapshot || !conn.value) return
	running.value = true
	try {
		const result = await loadInto({
			name: props.snapshot.name,
			conn: conn.value,
			db: db.value,
			wipe: wipe.value
		})
		if (result.failed) {
			message.warning(
				`Loaded ${result.written} docs, ${result.failed} failed: ${result.errors.join('; ')}`,
				{ duration: 15000 }
			)
		} else {
			message.success(`Loaded ${result.written} docs`)
		}
		const firstPath = props.snapshot.source.paths[0]
		if (firstPath) open({ conn: conn.value, db: db.value, path: firstPath })
		show.value = false
	} catch (e) {
		message.error(apiErrorMessage(e), { duration: 10000 })
	} finally {
		running.value = false
	}
}
</script>

<template>
	<NModal
		v-model:show="show"
		preset="card"
		:title="`Load ${snapshot?.name ?? ''}`"
		style="width: 520px">
		<NForm label-placement="top" @submit.prevent="submit">
			<NAlert v-if="!emulatorOptions.length" type="warning" :bordered="false" class="info">
				Add an
				<b>Emulator</b>
				connection first. Snapshots only load into emulators.
			</NAlert>
			<NFormItem label="Emulator connection">
				<NSelect v-model:value="conn" :options="emulatorOptions" />
			</NFormItem>
			<NFormItem label="Database">
				<NInput v-model:value="db" class="mono" />
			</NFormItem>
			<NFormItem label="Wipe the emulator database first">
				<NSwitch v-model:value="wipe" />
			</NFormItem>
			<div class="buttons">
				<NButton @click="show = false">Cancel</NButton>
				<NButton type="primary" attr-type="submit" :loading="running" :disabled="!conn">
					Load
				</NButton>
			</div>
		</NForm>
	</NModal>
</template>

<style scoped>
.info {
	margin-bottom: 16px;
}
.buttons {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}
</style>
