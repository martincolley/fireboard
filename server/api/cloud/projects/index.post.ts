import type { Connection } from '#shared/types/connection'
import { requireEntitled } from '../../../cloud/access'
import { cloudEnv } from '../../../cloud/env'
import { cloudProjectSchema } from '../../../cloud/projects'

/** Creates or replaces one of the signed-in user's projects (matched by id). */
export default defineEventHandler(async (event): Promise<Connection> => {
	const { user } = await requireEntitled(event)
	const input = await readValidatedBody(event, cloudProjectSchema.parse)
	const now = new Date().toISOString()
	await cloudEnv(event)
		.DB.prepare(
			`insert into "project" ("id", "userId", "name", "projectId", "credentialType", "emulatorHost", "databases", "readOnly", "color", "createdAt", "updatedAt")
			 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 on conflict ("userId", "id") do update set "name" = excluded."name", "projectId" = excluded."projectId",
			   "credentialType" = excluded."credentialType", "emulatorHost" = excluded."emulatorHost",
			   "databases" = excluded."databases", "readOnly" = excluded."readOnly", "color" = excluded."color",
			   "updatedAt" = excluded."updatedAt"`
		)
		.bind(
			input.id,
			user.id,
			input.name,
			input.projectId,
			input.credential.type,
			input.credential.type === 'emulator' ? input.credential.host : null,
			input.databases?.length ? JSON.stringify(input.databases) : null,
			input.readOnly ? 1 : 0,
			input.color ?? null,
			now,
			now
		)
		.run()
	return input
})
