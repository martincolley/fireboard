import type { H3Event } from 'h3'
import { createAuth } from './auth'
import { cloudEnv, stripeConfigured, type CloudEnv } from './env'

export interface Access {
	user: { id: string; email: string; name: string; emailVerified: boolean }
	entitled: boolean
	/** Why the user has (or lacks) access. */
	reason: 'allowlist' | 'approved' | 'subscription' | 'none'
	/** Allowlisted (verified) users manage who else gets access. */
	isAdmin: boolean
	billingEnabled: boolean
}

const ACTIVE = ['active', 'trialing']

function allowlist(env: CloudEnv): string[] {
	return (env.ALLOWED_EMAILS ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean)
}

/**
 * Signed-in user and whether they may use the app: an allowlisted verified
 * email (also an admin), a user an admin approved, or an active subscription.
 */
export async function getAccess(event: H3Event): Promise<Access | null> {
	const env = cloudEnv(event)
	const session = await createAuth(event).api.getSession({ headers: event.headers })
	if (!session) return null
	const { user } = session
	const billingEnabled = stripeConfigured(env)

	// Only a verified email can match the allowlist, so nobody can sign up as someone else.
	if (user.emailVerified && allowlist(env).includes(user.email.toLowerCase())) {
		return { user, entitled: true, reason: 'allowlist', isAdmin: true, billingEnabled }
	}

	const grant = await env.DB.prepare('select 1 as ok from "access_grant" where "userId" = ?')
		.bind(user.id)
		.first<{ ok: number }>()
	if (grant) return { user, entitled: true, reason: 'approved', isAdmin: false, billingEnabled }

	const subscription = await env.DB.prepare(
		`select "status" from "subscription" where "referenceId" = ? and "status" in (${ACTIVE.map(() => '?').join(',')}) limit 1`
	)
		.bind(user.id, ...ACTIVE)
		.first<{ status: string }>()
	return {
		user,
		entitled: Boolean(subscription),
		reason: subscription ? 'subscription' : 'none',
		isAdmin: false,
		billingEnabled
	}
}

export async function requireEntitled(event: H3Event): Promise<Access> {
	const access = await getAccess(event)
	if (!access) throw createError({ statusCode: 401, message: 'Sign in required' })
	if (!access.entitled) throw createError({ statusCode: 402, message: 'Access required' })
	return access
}

export async function requireAdmin(event: H3Event): Promise<Access> {
	const access = await requireEntitled(event)
	if (!access.isAdmin) throw createError({ statusCode: 403, message: 'Admins only' })
	return access
}
