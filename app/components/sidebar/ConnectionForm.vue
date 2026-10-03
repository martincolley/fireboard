<script setup lang="ts">
import {
	NButton,
	NColorPicker,
	NDynamicTags,
	NForm,
	NFormItem,
	NInput,
	NModal,
	NRadioButton,
	NRadioGroup,
	NSelect,
	NSwitch,
	useMessage
} from 'naive-ui'
import type { Connection } from '#shared/types/connection'

const props = defineProps<{ connection: Connection | null }>()
const show = defineModel<boolean>('show', { required: true })

const { save } = useConnections()
const { isCloud } = useMode()
const google = useGoogleAuth()
const projectOptions = ref<{ value: string; label: string }[]>([])

/** Hosted app: offer the projects the connected Google account can see. */
async function loadProjects() {
	if (!isCloud || !google.state.value.connected) return
	try {
		projectOptions.value = (await google.listProjects()).map((p) => ({
			value: p.projectId,
			label: `${p.name} (${p.projectId})`
		}))
	} catch (error) {
		projectOptions.value = []
		message.warning(`Couldn't list your Google projects: ${apiErrorMessage(error)}`, {
			duration: 8000
		})
	}
}

const message = useMessage()
const saving = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

interface FormState {
	id: string
	name: string
	projectId: string
	credentialType: 'serviceAccount' | 'adc' | 'emulator' | 'google'
	serviceAccountPath: string
	emulatorHost: string
	databases: string[]
	readOnly: boolean
	color: string
}

const form = reactive<FormState>(blank())

function blank(): FormState {
	return {
		id: '',
		name: '',
		projectId: '',
		credentialType: isCloud ? 'google' : 'serviceAccount',
		serviceAccountPath: '',
		emulatorHost: '127.0.0.1:8080',
		databases: [],
		readOnly: false,
		color: '#ff8a3d'
	}
}

// A name is required to save; default it to the project id.
watch(
	() => form.projectId,
	(projectId, previous) => {
		if (!form.name || form.name === previous) form.name = projectId
	}
)

watch(show, (visible) => {
	if (!visible) return
	void loadProjects()
	const c = props.connection
	Object.assign(
		form,
		c
			? {
					id: c.id,
					name: c.name,
					projectId: c.projectId,
					credentialType: c.credential.type,
					serviceAccountPath: c.credential.type === 'serviceAccount' ? c.credential.path : '',
					emulatorHost: c.credential.type === 'emulator' ? c.credential.host : '127.0.0.1:8080',
					databases: c.databases ?? [],
					readOnly: c.readOnly ?? false,
					color: c.color ?? '#ff8a3d'
				}
			: blank()
	)
})

function slug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

/** Reads a picked key file, stores it server side and fills path + project id. */
async function onKeyFile(event: Event) {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	input.value = ''
	if (!file) return
	uploading.value = true
	try {
		const json = JSON.parse(await file.text())
		const res = await api<{ path: string; projectId: string }>('/api/connections/key', {
			method: 'POST',
			body: json
		})
		form.serviceAccountPath = res.path
		if (!form.projectId) form.projectId = res.projectId
		if (!form.name) form.name = res.projectId
		message.success('Key stored in your Fireboard config folder')
	} catch (error) {
		message.error(error instanceof SyntaxError ? 'That file is not JSON' : apiErrorMessage(error))
	} finally {
		uploading.value = false
	}
}

async function submit() {
	const connection: Connection = {
		id: form.id || slug(form.name),
		name: form.name.trim(),
		projectId: form.projectId.trim(),
		credential:
			form.credentialType === 'adc'
				? { type: 'adc' }
				: form.credentialType === 'google'
					? { type: 'google' }
					: form.credentialType === 'emulator'
						? { type: 'emulator', host: form.emulatorHost.trim() }
						: { type: 'serviceAccount', path: form.serviceAccountPath.trim() },
		databases: form.databases.length ? form.databases : undefined,
		readOnly: form.readOnly || undefined,
		color: form.color
	}
	saving.value = true
	try {
		await save(connection)
		show.value = false
	} catch (error) {
		message.error(apiErrorMessage(error))
	} finally {
		saving.value = false
	}
}
</script>

<template>
	<NModal
		v-model:show="show"
		preset="card"
		:title="connection ? 'Edit connection' : 'Add connection'"
		style="width: 560px">
		<NForm label-placement="top" @submit.prevent="submit">
			<NFormItem label="Name">
				<NInput v-model:value="form.name" placeholder="Production" />
			</NFormItem>
			<NFormItem label="Credentials">
				<NRadioGroup v-model:value="form.credentialType">
					<template v-if="isCloud">
						<NRadioButton value="google">My Google account</NRadioButton>
					</template>
					<template v-else>
						<NRadioButton value="serviceAccount">Service account file</NRadioButton>
						<NRadioButton value="adc">gcloud login (ADC)</NRadioButton>
					</template>
					<NRadioButton value="emulator">Emulator</NRadioButton>
				</NRadioGroup>
			</NFormItem>
			<NFormItem
				:label="
					isCloud ? 'Google Cloud project' : 'Google Cloud project id (filled from the key file)'
				">
				<NSelect
					v-if="form.credentialType === 'google' && projectOptions.length"
					v-model:value="form.projectId"
					:options="projectOptions"
					filterable
					tag
					placeholder="Pick or type a project id" />
				<NInput v-else v-model:value="form.projectId" placeholder="my-project-id" />
			</NFormItem>
			<p v-if="form.credentialType === 'google'" class="note">
				Fireboard reads this project in your browser with your own Google sign-in. Nothing is stored
				on Fireboard's servers except the project id.
			</p>
			<NFormItem v-if="form.credentialType === 'serviceAccount'" label="Service account JSON path">
				<div class="key-row">
					<NInput
						v-model:value="form.serviceAccountPath"
						class="mono"
						placeholder="/home/you/keys/project-service-account.json" />
					<NButton :loading="uploading" @click="fileInput?.click()">Choose file…</NButton>
					<input
						ref="fileInput"
						type="file"
						accept=".json,application/json"
						hidden
						@change="onKeyFile" />
				</div>
			</NFormItem>
			<p v-else-if="form.credentialType === 'adc'" class="note">
				Uses
				<span class="mono">gcloud auth application-default login</span>
				credentials from this machine.
			</p>
			<NFormItem
				v-else-if="form.credentialType === 'emulator'"
				label="Emulator host (Firestore emulator)">
				<NInput v-model:value="form.emulatorHost" class="mono" placeholder="127.0.0.1:8080" />
			</NFormItem>
			<NFormItem label="Databases (optional: leave empty to auto-discover)">
				<NDynamicTags v-model:value="form.databases" />
			</NFormItem>
			<div class="row">
				<NFormItem label="Color">
					<NColorPicker v-model:value="form.color" :show-alpha="false" style="width: 120px" />
				</NFormItem>
				<NFormItem label="Read-only (blocks every write)">
					<NSwitch v-model:value="form.readOnly" />
				</NFormItem>
			</div>
			<div class="buttons">
				<NButton @click="show = false">Cancel</NButton>
				<NButton
					type="primary"
					attr-type="submit"
					:loading="saving"
					:disabled="!form.name.trim() || !form.projectId.trim()">
					Save
				</NButton>
			</div>
		</NForm>
	</NModal>
</template>

<style scoped>
.note {
	color: var(--fb-muted);
	margin: -8px 0 16px;
}
.key-row {
	display: flex;
	gap: 8px;
	width: 100%;
}
.row {
	display: flex;
	gap: 32px;
}
.buttons {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}
</style>
