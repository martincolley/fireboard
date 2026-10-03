<script setup lang="ts">
/** The Fireboard app: in the hosted build it is gated by sign-in and access. */
import { NSpin, useMessage } from 'naive-ui'

const { isCloud } = useMode()
const { state, refresh } = useAccount()
const message = useMessage()

onMounted(async () => {
	if (!isCloud) return
	try {
		await refresh()
	} catch (error) {
		message.error(apiErrorMessage(error))
	}
})
</script>

<template>
	<Workspace v-if="!isCloud" />
	<div v-else-if="!state.loaded" class="loading"><NSpin /></div>
	<AccountSignIn v-else-if="!state.user" />
	<AccountPaywall v-else-if="!state.entitled" />
	<Workspace v-else />
</template>

<style scoped>
.loading {
	min-height: 100vh;
	display: grid;
	place-items: center;
}
</style>
