<script setup lang="ts">
import { NButton, NCard, useMessage } from 'naive-ui'

const { state, subscribe, signOut } = useAccount()
const message = useMessage()
const busy = ref(false)

async function run(action: () => Promise<void>) {
	busy.value = true
	try {
		await action()
	} catch (e) {
		message.error(apiErrorMessage(e))
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<div class="page">
		<NCard class="card" title="Unlock Fireboard">
			<p>
				Signed in as
				<b>{{ state.user?.email }}</b>
				.
			</p>
			<p v-if="state.features.billing" class="lead">
				Subscribe to use Fireboard with your Firestore projects. You can cancel any time.
			</p>
			<p class="lead">
				{{ state.features.billing ? 'Or ask' : 'Ask' }} the owner to approve your account: they'll
				see you under Manage access. Then reload this page.
			</p>
			<div class="buttons">
				<NButton :loading="busy" @click="run(signOut)">Sign out</NButton>
				<NButton
					v-if="state.features.billing"
					type="primary"
					:loading="busy"
					@click="run(subscribe)">
					Subscribe
				</NButton>
			</div>
		</NCard>
	</div>
</template>

<style scoped>
.page {
	min-height: 100vh;
	display: grid;
	place-items: center;
	padding: 16px;
}
.card {
	max-width: 420px;
	width: 100%;
}
.lead {
	color: var(--fb-muted);
	line-height: 1.5;
}
.buttons {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}
</style>
