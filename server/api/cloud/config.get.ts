import { cloudEnv, stripeConfigured } from '../../cloud/env'

/** Which sign-in methods and features this deployment has (no secrets). */
export default defineEventHandler((event) => {
	const env = cloudEnv(event)
	return {
		google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
		password: env.ENABLE_PASSWORD_LOGIN === 'true',
		billing: stripeConfigured(env)
	}
})
