<script setup lang="ts">
import { NButton, NForm, NFormItem, NInput, NModal } from 'naive-ui'
import type { FsFields } from '#shared/types/firestore'

defineProps<{ collection: string }>()
const show = defineModel<boolean>('show', { required: true })
const emit = defineEmits<{ create: [{ id: string; fields: FsFields }] }>()

const id = ref('')
const json = ref('{\n  \n}')
const error = ref('')

watch(show, (visible) => {
	if (!visible) return
	id.value = ''
	json.value = '{\n  \n}'
	error.value = ''
})

function submit() {
	try {
		error.value = ''
		emit('create', { id: id.value.trim(), fields: fieldsFromExtJson(JSON.parse(json.value)) })
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	}
}
</script>

<template>
	<NModal
		v-model:show="show"
		preset="card"
		:title="`New document in ${collection}`"
		style="width: 640px">
		<NForm label-placement="top" @submit.prevent="submit">
			<NFormItem label="Document id (empty = auto)">
				<NInput v-model:value="id" class="mono" />
			</NFormItem>
			<NFormItem label='Fields (extended JSON: {"__time__": "..."}, {"__ref__": "path"})'>
				<NInput
					v-model:value="json"
					type="textarea"
					class="mono"
					:autosize="{ minRows: 8, maxRows: 24 }" />
			</NFormItem>
			<p v-if="error" class="error">{{ error }}</p>
			<div class="buttons">
				<NButton @click="show = false">Cancel</NButton>
				<NButton type="primary" attr-type="submit">Create</NButton>
			</div>
		</NForm>
	</NModal>
</template>

<style scoped>
.error {
	color: #ff6b6b;
}
.buttons {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}
</style>
