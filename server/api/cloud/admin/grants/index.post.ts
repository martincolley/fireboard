import { z } from 'zod'
import { requireAdmin } from '../../../../cloud/access'
import { cloudEnv } from '../../../../cloud/env'

const schema = z.object({ userId: z.string().min(1).max(100) })

/** Approves a signed-up user. */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
	const admin = await requireAdmin(event)
	const { userId } = await readValidatedBody(event, schema.parse)
	const exists = await cloudEnv(event)
		.DB.prepare('select 1 as ok from "user" where "id" = ?')
		.bind(userId)
		.first<{ ok: number }>()
	if (!exists) throw createError({ statusCode: 404, message: 'User not found' })
	await cloudEnv(event)
		.DB.prepare(
			'insert into "access_grant" ("userId", "grantedBy", "createdAt") values (?, ?, ?) on conflict ("userId") do nothing'
		)
		.bind(userId, admin.user.email, new Date().toISOString())
		.run()
	return { ok: true }
})
