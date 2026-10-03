import { getAccess, type Access } from '../../cloud/access'

export default defineEventHandler(async (event): Promise<Access | { user: null }> => {
	return (await getAccess(event)) ?? { user: null }
})
