<script setup lang="ts">
import {
	NAlert,
	NButton,
	NForm,
	NFormItem,
	NInput,
	NInputNumber,
	NModal,
	NSwitch,
	useMessage
} from 'naive-ui'
import type { BrowserTab } from '~/composables/useTabs'
import { readOverrides, writeOverrides } from '~/snapshots/browserSnapshots'

const props = defineProps<{ tab: BrowserTab }>()
const show = defineModel<boolean>('show', { required: true })

const { create } = useSnapshots()
const { isCloud } = useMode()
const rulesText = ref('')
const showRules = ref(false)

function loadRules() {
	try {
		rulesText.value = JSON.stringify(readOverrides(), null, 2)
	} catch {
		rulesText.value = '{\n  "extraRules": []\n}'
	}
}
const message = useMessage()

const name = ref('')
const recursive = ref(true)
const maxDocs = ref(2000)
const running = ref(false)

function defaultName(): string {
	// Only collection ids (never document ids, which can be emails or names) go in the name.
	const collections = pathSegments(props.tab.path).filter((_, i) => i % 2 === 0)
	const date = new Date().toISOString().slice(0, 10)
	return `${props.tab.db}-${collections.join('-')}-${date}`
		.replace(/[()]/g, '')
		.replace(/[^a-zA-Z0-9_-]+/g, '-')
		.slice(0, 80)
}

watch(show, (visible) => {
	if (!visible) return
	name.value = defaultName()
	if (isCloud) loadRules()
})

async function submit() {
	running.value = true
	try {
		if (isCloud && showRules.value) writeOverrides(rulesText.value)
		const meta = await create({
			name: name.value,
			conn: props.tab.conn,
			db: props.tab.db,
			paths: [props.tab.path],
			recursive: recursive.value,
			maxDocs: maxDocs.value
		})
		message.success(
			`Snapshot "${meta.name}": ${meta.docCount} docs${meta.truncated ? ' (stopped at max docs)' : ''}`,
			{ duration: 6000 }
		)
		show.value = false
	} catch (e) {
		message.error(apiErrorMessage(e), { duration: 10000 })
	} finally {
		running.value = false
	}
}
</script>

<template>
	<NModal v-model:show="show" preset="card" title="Anonymized snapshot" style="width: 560px">
		<NForm label-placement="top" @submit.prevent="submit">
			<NAlert type="info" :bordered="false" class="info">
				Copies
				<span class="mono">{{ tab.path }}</span>
				from
				<b>{{ tab.db }}</b>
				to a snapshot. Emails, names, phones, addresses, secrets and free text are replaced with
				stable fakes before anything is stored.
				<template v-if="isCloud">
					It is built and kept in this browser only; Fireboard's servers never see it.
				</template>
				<template v-else>
					Extra rules:
					<span class="mono">anonymize.json</span>
					in your Fireboard config folder.
				</template>
			</NAlert>
			<NFormItem label="Snapshot name">
				<NInput v-model:value="name" class="mono" />
			</NFormItem>
			<div class="row">
				<NFormItem label="Include subcollections">
					<NSwitch v-model:value="recursive" />
				</NFormItem>
				<NFormItem label="Max documents (each is one read)">
					<NInputNumber v-model:value="maxDocs" :min="1" :max="50000" />
				</NFormItem>
			</div>
			<template v-if="isCloud">
				<NButton text size="small" class="rules-toggle" @click="showRules = !showRules">
					{{ showRules ? 'Hide' : 'Edit' }} extra anonymization rules
				</NButton>
				<NFormItem
					v-if="showRules"
					label='Extra rules (JSON, checked before the built-in ones), e.g. {"extraRules": [{"key": "nickname", "strategy": "firstName"}]}'>
					<NInput
						v-model:value="rulesText"
						type="textarea"
						class="mono"
						:autosize="{ minRows: 4, maxRows: 14 }" />
				</NFormItem>
			</template>
			<div class="buttons">
				<NButton @click="show = false">Cancel</NButton>
				<NButton type="primary" attr-type="submit" :loading="running" :disabled="!name">
					Create snapshot
				</NButton>
			</div>
		</NForm>
	</NModal>
</template>

<style scoped>
.info {
	margin-bottom: 16px;
}
.row {
	display: flex;
	gap: 32px;
}
.rules-toggle {
	margin-bottom: 12px;
}
.buttons {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}
</style>
