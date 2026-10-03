import { requireAdmin } from '../../../../cloud/access'
import { cloudEnv } from '../../../../cloud/env'

/** Revokes an approval. Allowlisted admins and subscribers are unaffected. */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
	await requireAdmin(event)
	await cloudEnv(event)
		.DB.prepare('delete from "access_grant" where "userId" = ?')
		.bind(getRouterParam(event, 'userId') ?? '')
		.run()
	return { ok: true }
})
