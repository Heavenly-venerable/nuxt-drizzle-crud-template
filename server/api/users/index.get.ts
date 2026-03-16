import { db } from '~/server/utils/db';
import { users } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  try {
    const allUsers = await db.select().from(users);
    return { data: allUsers };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch users',
    });
  }
});
