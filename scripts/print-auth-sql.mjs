// Prints the SQL Better Auth needs (core tables + stripe plugin) for a fresh SQLite/D1 database.
import { DatabaseSync } from 'node:sqlite'
import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import { stripe } from '@better-auth/stripe'
import Stripe from 'stripe'

const options = {
	database: new DatabaseSync(':memory:'),
	secret: 'x'.repeat(32),
	emailAndPassword: { enabled: true },
	rateLimit: { enabled: true, storage: 'database' },
	plugins: [
		stripe({
			stripeClient: new Stripe('sk_test_placeholder'),
			stripeWebhookSecret: 'whsec_placeholder',
			createCustomerOnSignUp: false,
			subscription: { enabled: true, plans: [] }
		})
	]
}
betterAuth(options)
const { compileMigrations } = await getMigrations(options)
console.log(await compileMigrations())
