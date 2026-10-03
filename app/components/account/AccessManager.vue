<script setup lang="ts">
import { NButton, NModal, NTag, useMessage } from 'naive-ui'

interface AdminUser {
	id: string
	email: string
	name: string
	emailVerified: boolean
	createdAt: string
	approved: boolean
}

const show = defineModel<boolean>('show', { required: true })
const message = useMessage()
const users = ref<AdminUser[]>([])
const loading = ref(false)

async function load() {
	loading.value = true
	try {
		users.value = (await api<{ users: AdminUser[] }>('/api/cloud/admin/users')).users
	} catch (e) {
		message.error(apiErrorMessage(e))
	} finally {
		loading.value = false
	}
}

async function setApproved(user: AdminUser, approved: boolean) {
	try {
		if (approved)
			await api('/api/cloud/admin/grants', { method: 'POST', body: { userId: user.id } })
		else await api(`/api/cloud/admin/grants/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
		await load()
	} catch (e) {
		message.error(apiErrorMessage(e))
	}
}

watch(show, (visible) => {
	if (visible) void load()
})
</script>

<template>
	<NModal v-model:show="show" preset="card" title="Manage access" style="width: 640px">
		<p class="lead">
			People who signed in appear here. Approve them to give access. Allowlisted admins always have
			access.
		</p>
		<div v-if="!users.length && !loading" class="lead">Nobody has signed up yet.</div>
		<div v-for="user in users" :key="user.id" class="row">
			<div class="who">
				<div>{{ user.name }}</div>
				<div class="mono email">{{ user.email }}</div>
			</div>
			<NTag v-if="!user.emailVerified" size="small" type="warning" :bordered="false">
				unverified
			</NTag>
			<NTag v-if="user.approved" size="small" type="success" :bordered="false">approved</NTag>
			<NButton v-if="user.approved" size="small" @click="setApproved(user, false)">Revoke</NButton>
			<NButton v-else size="small" type="primary" @click="setApproved(user, true)">Approve</NButton>
		</div>
	</NModal>
</template>

<style scoped>
.lead {
	color: var(--fb-muted);
	margin-top: 0;
}
.row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 0;
	border-bottom: 1px solid var(--fb-border);
}
.who {
	flex: 1;
	min-width: 0;
}
.email {
	color: var(--fb-muted);
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
