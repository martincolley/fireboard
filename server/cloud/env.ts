import type { D1Database } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'

/**
 * Cloudflare bindings and secrets for the hosted app. The hosted app holds no
 * Google credentials for anyone's data: these are only for app accounts and billing.
 */
export interface CloudEnv {
	DB: D1Database
	BETTER_AUTH_SECRET: string
	/** Public URL of the deployment, e.g. https://fireboard.example.workers.dev */
	PUBLIC_BASE_URL?: string
	/** Google OAuth web client used for app sign-in (openid/email only). */
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
	/** Comma-separated verified emails that get access without a subscription. */
	ALLOWED_EMAILS?: string
	/** "true" enables email/password sign-in (local testing only). */
	ENABLE_PASSWORD_LOGIN?: string
	STRIPE_SECRET_KEY?: string
	STRIPE_WEBHOOK_SECRET?: string
	STRIPE_PRICE_ID?: string
}

export function cloudEnv(event: H3Event): CloudEnv {
	const env = (event.context as { cloudflare?: { env?: CloudEnv } }).cloudflare?.env
	if (!env?.DB) {
		throw createError({ statusCode: 500, message: 'Cloud bindings missing (run with wrangler)' })
	}
	return env
}

export function stripeConfigured(env: CloudEnv): boolean {
	return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_ID)
}
