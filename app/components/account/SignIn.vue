<script setup lang="ts">
import { NButton, NCard, NDivider, NForm, NFormItem, NIcon, NInput, useMessage } from 'naive-ui'
import { FlameOutline, LogoGoogle } from '@vicons/ionicons5'

const { state, signInWithGoogle, signInWithPassword } = useAccount()
const message = useMessage()
const email = ref('')
const password = ref('')
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
		<NCard class="card">
			<div class="brand">
				<NIcon :component="FlameOutline" color="var(--fb-accent)" :size="28" />
				<h1>Fireboard</h1>
			</div>
			<p class="lead">
				A Firestore browser for multi-region projects. Your data goes straight from Google to your
				browser: Fireboard's servers never see it.
			</p>
			<NButton
				v-if="state.features.google"
				block
				type="primary"
				size="large"
				:loading="busy"
				@click="run(signInWithGoogle)">
				<template #icon><NIcon :component="LogoGoogle" /></template>
				Sign in with Google
			</NButton>
			<template v-if="state.features.password">
				<NDivider v-if="state.features.google">or</NDivider>
				<NForm @submit.prevent="run(() => signInWithPassword(email, password, false))">
					<NFormItem label="Email">
						<NInput
							v-model:value="email"
							placeholder="you@example.com"
							:input-props="{ autocomplete: 'username', type: 'email' }" />
					</NFormItem>
					<NFormItem label="Password">
						<NInput
							v-model:value="password"
							type="password"
							show-password-on="click"
							autocomplete="current-password" />
					</NFormItem>
					<div class="buttons">
						<NButton :loading="busy" @click="run(() => signInWithPassword(email, password, true))">
							Create account
						</NButton>
						<NButton type="primary" attr-type="submit" :loading="busy">Sign in</NButton>
					</div>
				</NForm>
			</template>
			<p v-if="!state.features.google && !state.features.password" class="lead">
				No sign-in method is configured for this deployment.
			</p>
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
.brand {
	display: flex;
	align-items: center;
	gap: 10px;
}
h1 {
	margin: 0;
	font-size: 22px;
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
