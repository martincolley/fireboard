<script setup lang="ts">
import { NButton, NDropdown, NIcon, NTag, useMessage, type DropdownOption } from 'naive-ui'
import { LogoGoogle, PersonCircleOutline } from '@vicons/ionicons5'

/** Hosted app: Google data access status and the account menu. */
const google = useGoogleAuth()
const companion = useCompanion()
const { state, signOut, manageBilling } = useAccount()
const message = useMessage()
const accessOpen = ref(false)

const menu = computed<DropdownOption[]>(() => [
	{ key: 'email', label: state.value.user?.email ?? '', disabled: true },
	...(state.value.isAdmin ? [{ key: 'access', label: 'Manage access' }] : []),
	...(state.value.reason === 'subscription' ? [{ key: 'billing', label: 'Manage billing' }] : []),
	...(google.state.value.connected ? [{ key: 'google', label: 'Disconnect Google' }] : []),
	{
		key: 'companion',
		label: companion.enabled.value
			? 'Stop sharing with local MCP companion'
			: 'Share view with local MCP companion'
	},
	{ key: 'signout', label: 'Sign out' }
])

async function onMenu(key: string) {
	try {
		if (key === 'access') accessOpen.value = true
		if (key === 'billing') await manageBilling()
		if (key === 'companion') companion.setEnabled(!companion.enabled.value)
		if (key === 'google') await google.disconnect()
		if (key === 'signout') {
			await google.disconnect()
			await signOut()
		}
	} catch (e) {
		message.error(apiErrorMessage(e))
	}
}

async function connect() {
	try {
		await google.connect()
	} catch (e) {
		message.error(apiErrorMessage(e))
	}
}
</script>

<template>
	<div class="bar">
		<NTag v-if="google.state.value.connected" size="small" type="success" :bordered="false">
			<template #icon><NIcon :component="LogoGoogle" /></template>
			Google connected
		</NTag>
		<NButton v-else size="small" type="primary" :disabled="!google.configured" @click="connect">
			<template #icon><NIcon :component="LogoGoogle" /></template>
			Connect Google
		</NButton>
		<NDropdown trigger="click" :options="menu" @select="onMenu">
			<NButton quaternary size="small" title="Account">
				<NIcon :component="PersonCircleOutline" />
			</NButton>
		</NDropdown>
		<AccountAccessManager v-if="state.isAdmin" v-model:show="accessOpen" />
	</div>
</template>

<style scoped>
.bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 8px 12px;
	border-bottom: 1px solid var(--fb-border);
}
</style>
