<script setup lang="ts">
import { NButton, NInput, NInputNumber, NModal, NSelect, NSwitch, NFormItem, NForm } from 'naive-ui'
import type { FsType, FsValue } from '#shared/types/firestore'

const props = defineProps<{
	title: string
	value: FsValue
	/** Show a name input (adding a key to a map). */
	askName?: boolean
}>()
const show = defineModel<boolean>('show', { required: true })
const emit = defineEmits<{ save: [{ name: string; value: FsValue }] }>()

const JSON_TYPES = new Set<FsType>(['array', 'map', 'bytes', 'vector'])

const name = ref('')
const type = ref<FsType>('string')
const draft = ref<FsValue>({ t: 'null' })
const isoText = ref('')
const jsonText = ref('')
const error = ref('')

const typeOptions = (Object.keys(TYPE_LABELS) as FsType[]).map((t) => ({
	value: t,
	label: TYPE_LABELS[t]
}))

watch(show, (visible) => {
	if (visible) load(props.value)
})

function load(value: FsValue) {
	name.value = ''
	error.value = ''
	type.value = value.t
	draft.value = structuredClone(toRaw(value))
	isoText.value = value.t === 'timestamp' ? timestampToIso(value.s, value.n) : ''
	jsonText.value = JSON_TYPES.has(value.t) ? JSON.stringify(toExtJson(value), null, 2) : ''
}

function changeType(next: FsType) {
	load(defaultValue(next))
}

function setNow() {
	const now = defaultValue('timestamp')
	if (now.t === 'timestamp') isoText.value = timestampToIso(now.s, now.n)
}

/** Builds the final value from whichever input the current type uses. */
function result(): FsValue {
	if (type.value === 'timestamp') return { t: 'timestamp', ...isoToTimestamp(isoText.value) }
	if (JSON_TYPES.has(type.value)) {
		const parsed = fromExtJson(JSON.parse(jsonText.value))
		if (parsed.t !== type.value) throw new Error(`JSON is a ${parsed.t}, expected ${type.value}`)
		return parsed
	}
	return draft.value
}

function save() {
	try {
		if (props.askName && !name.value.trim()) throw new Error('Field name is required')
		emit('save', { name: name.value.trim(), value: result() })
		show.value = false
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	}
}

const timestampPreview = computed(() => {
	try {
		const ts = isoToTimestamp(isoText.value)
		return formatTimestamp(ts.s, ts.n)
	} catch {
		return 'Invalid timestamp'
	}
})
</script>

<template>
	<NModal v-model:show="show" preset="card" :title="title" style="width: 560px">
		<NForm label-placement="top" @submit.prevent="save">
			<NFormItem v-if="askName" label="Field name">
				<NInput v-model:value="name" class="mono" autofocus />
			</NFormItem>
			<NFormItem label="Type">
				<NSelect :value="type" :options="typeOptions" @update:value="changeType" />
			</NFormItem>

			<NFormItem v-if="draft.t === 'string'" label="Value">
				<NInput
					v-model:value="draft.v"
					type="textarea"
					class="mono"
					:autosize="{ minRows: 1, maxRows: 12 }" />
			</NFormItem>
			<NFormItem v-else-if="draft.t === 'number'" label="Value">
				<NInputNumber v-model:value="draft.v" :show-button="false" style="width: 100%" />
			</NFormItem>
			<NFormItem v-else-if="draft.t === 'boolean'" label="Value">
				<NSwitch v-model:value="draft.v" />
			</NFormItem>
			<NFormItem v-else-if="draft.t === 'reference'" label="Document path">
				<NInput v-model:value="draft.v" class="mono" placeholder="users/abc123" />
			</NFormItem>
			<div v-else-if="draft.t === 'geopoint'" class="pair">
				<NFormItem label="Latitude">
					<NInputNumber v-model:value="draft.lat" :show-button="false" />
				</NFormItem>
				<NFormItem label="Longitude">
					<NInputNumber v-model:value="draft.lng" :show-button="false" />
				</NFormItem>
			</div>
			<NFormItem v-else-if="type === 'timestamp'" :label="`ISO 8601 (UTC) · ${timestampPreview}`">
				<NInput v-model:value="isoText" class="mono" />
				<NButton style="margin-left: 8px" @click="setNow">Now</NButton>
			</NFormItem>
			<NFormItem v-else-if="JSON_TYPES.has(type)" label="Extended JSON">
				<NInput
					v-model:value="jsonText"
					type="textarea"
					class="mono"
					:autosize="{ minRows: 4, maxRows: 20 }" />
			</NFormItem>

			<p v-if="error" class="error">{{ error }}</p>
			<div class="buttons">
				<NButton @click="show = false">Cancel</NButton>
				<NButton type="primary" attr-type="submit">Save</NButton>
			</div>
		</NForm>
	</NModal>
</template>

<style scoped>
.pair {
	display: flex;
	gap: 16px;
}
.error {
	color: #ff6b6b;
}
.buttons {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}
</style>
