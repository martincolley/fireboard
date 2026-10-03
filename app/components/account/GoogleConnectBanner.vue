<script setup lang="ts">
import { NButton, NIcon, useMessage } from 'naive-ui'
import { LogoGoogle } from '@vicons/ionicons5'

/**
 * Hosted app: the Google token lives in memory only, so after a reload it is
 * gone. This asks for it once, then reloads every open view.
 */
const google = useGoogleAuth()
const { connections } = useConnections()
const { bump } = useDataVersion()
const message = useMessage()
const busy = ref(false)

const needed = computed(
	() =>
		!google.state.value.connected && connections.value.some((c) => c.credential.type === 'google')
)

async function connect() {
	busy.value = true
	try {
		await google.connect()
	} catch (error) {
		message.error(apiErrorMessage(error))
	} finally {
		busy.value = false
	}
}

// Reload whatever was waiting on a token (tabs and the sidebar tree).
watch(
	() => google.state.value.connected,
	(connected) => {
		if (connected) bump({ tree: true })
	}
)
</script>

<template>
	<div v-if="needed" class="banner" role="status">
		<span>
			{{
				google.connectedBefore()
					? 'Reconnect Google to keep reading your projects. For your security the connection only lasts while this page is open (up to an hour).'
					: 'Connect your Google account to read your projects. Data goes straight from Google to this browser.'
			}}
		</span>
		<NButton type="primary" size="small" :loading="busy" @click="connect">
			<template #icon><NIcon :component="LogoGoogle" /></template>
			{{ google.connectedBefore() ? 'Reconnect Google' : 'Connect Google' }}
		</NButton>
	</div>
</template>

<style scoped>
.banner {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px 16px;
	padding: 10px 16px;
	background: #2a1d12;
	border-bottom: 1px solid #5c3a1d;
	color: #ffd2b3;
	font-size: 13px;
}
</style>
