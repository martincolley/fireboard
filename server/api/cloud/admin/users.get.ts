import { requireAdmin } from '../../../cloud/access'
import { cloudEnv } from '../../../cloud/env'

export interface AdminUser {
	id: string
	email: string
	name: string
	emailVerified: boolean
	createdAt: string
	approved: boolean
}

/** Everyone who has signed up, with whether an admin approved them. */
export default defineEventHandler(async (event): Promise<{ users: AdminUser[] }> => {
	await requireAdmin(event)
	const { results } = await cloudEnv(event)
		.DB.prepare(
			`select u."id", u."email", u."name", u."emailVerified", u."createdAt", g."userId" is not null as approved
			 from "user" u left join "access_grant" g on g."userId" = u."id"
			 order by u."createdAt" desc limit 500`
		)
		.all<
			Omit<AdminUser, 'emailVerified' | 'approved'> & { emailVerified: number; approved: number }
		>()
	return {
		users: results.map((u) => ({
			...u,
			emailVerified: Boolean(u.emailVerified),
			approved: Boolean(u.approved)
		}))
	}
})
