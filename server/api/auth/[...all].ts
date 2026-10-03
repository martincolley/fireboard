import { createAuth } from '../../cloud/auth'

/** Better Auth routes (sign-in, session, Stripe checkout/portal/webhook). */
export default defineEventHandler((event) => createAuth(event).handler(toWebRequest(event)))
