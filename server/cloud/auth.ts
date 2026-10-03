import { stripe } from '@better-auth/stripe'
import { betterAuth } from 'better-auth'
import type { H3Event } from 'h3'
import Stripe from 'stripe'
import { cloudEnv, stripeConfigured, type CloudEnv } from './env'

export const PLAN = 'pro'

function stripePlugin(env: CloudEnv) {
	return stripe({
		stripeClient: new Stripe(env.STRIPE_SECRET_KEY!, {
			httpClient: Stripe.createFetchHttpClient()
		}),
		stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET!,
		createCustomerOnSignUp: true,
		subscription: {
			enabled: true,
			plans: [{ name: PLAN, priceId: env.STRIPE_PRICE_ID! }]
		}
	})
}

/**
 * Better Auth for app accounts (who may use the hosted app). It never stores
 * Google tokens: Firestore access happens in the browser with a separate,
 * short-lived Google token the server never sees.
 */
export function createAuth(event: H3Event) {
	const env = cloudEnv(event)
	const origin = getRequestURL(event).origin
	const baseURL = env.PUBLIC_BASE_URL || origin
	const google =
		env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
			: undefined

	return betterAuth({
		baseURL,
		basePath: '/api/auth',
		secret: env.BETTER_AUTH_SECRET,
		database: env.DB,
		trustedOrigins: [baseURL],
		emailAndPassword: {
			enabled: env.ENABLE_PASSWORD_LOGIN === 'true',
			minPasswordLength: 12
		},
		...(google ? { socialProviders: google } : {}),
		rateLimit: { enabled: true, storage: 'database' },
		advanced: {
			useSecureCookies: baseURL.startsWith('https://'),
			// Cloudflare sets this to the real client IP; X-Forwarded-For can be spoofed.
			ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] }
		},
		databaseHooks: {
			account: {
				// Sign-in only needs the identity; drop provider tokens so none are stored.
				create: { before: async (account) => ({ data: withoutTokens(account) }) },
				update: { before: async (account) => ({ data: withoutTokens(account) }) }
			}
		},
		plugins: stripeConfigured(env) ? [stripePlugin(env)] : []
	})
}

function withoutTokens<T extends Record<string, unknown>>(account: T): T {
	return { ...account, accessToken: null, refreshToken: null, idToken: null }
}

export type Auth = ReturnType<typeof createAuth>
