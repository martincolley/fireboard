import { stripeClient } from '@better-auth/stripe/client'
import { createAuthClient } from 'better-auth/vue'

export interface AccountState {
	loaded: boolean
	user: { id: string; email: string; name: string } | null
	entitled: boolean
	reason: 'allowlist' | 'approved' | 'subscription' | 'none'
	isAdmin: boolean
	features: { google: boolean; password: boolean; billing: boolean }
}

let client: ReturnType<typeof makeClient> | null = null

function makeClient() {
	return createAuthClient({
		baseURL: window.location.origin,
		basePath: '/api/auth',
		plugins: [stripeClient({ subscription: true })]
	})
}

/** Hosted app account: Better Auth session, access (allowlist or subscription) and billing. */
export function useAccount() {
	const state = useState<AccountState>('account', () => ({
		loaded: false,
		user: null,
		entitled: false,
		reason: 'none',
		isAdmin: false,
		features: { google: false, password: false, billing: false }
	}))
	client ??= makeClient()
	const auth = client

	async function refresh() {
		const [me, features] = await Promise.all([
			api<{
				user: AccountState['user']
				entitled?: boolean
				reason?: AccountState['reason']
				isAdmin?: boolean
			}>('/api/cloud/me'),
			api<AccountState['features']>('/api/cloud/config')
		])
		state.value = {
			loaded: true,
			user: me.user,
			entitled: Boolean(me.entitled),
			reason: me.reason ?? 'none',
			isAdmin: Boolean(me.isAdmin),
			features
		}
	}

	async function signInWithGoogle() {
		await auth.signIn.social({ provider: 'google', callbackURL: '/app' })
	}

	async function signInWithPassword(email: string, password: string, create: boolean) {
		const result = create
			? await auth.signUp.email({ email, password, name: email.split('@')[0] ?? email })
			: await auth.signIn.email({ email, password })
		if (result.error) throw new Error(result.error.message ?? 'Sign-in failed')
		await refresh()
	}

	async function signOut() {
		await auth.signOut()
		await refresh()
	}

	async function subscribe() {
		const origin = window.location.origin
		const result = await auth.subscription.upgrade({
			plan: 'pro',
			successUrl: `${origin}/app?subscribed=1`,
			cancelUrl: `${origin}/app`
		})
		if (result.error) throw new Error(result.error.message ?? 'Could not start checkout')
	}

	async function manageBilling() {
		const result = await auth.subscription.billingPortal({
			returnUrl: `${window.location.origin}/app`
		})
		if (result.error) throw new Error(result.error.message ?? 'Could not open billing')
	}

	return { state, refresh, signInWithGoogle, signInWithPassword, signOut, subscribe, manageBilling }
}
