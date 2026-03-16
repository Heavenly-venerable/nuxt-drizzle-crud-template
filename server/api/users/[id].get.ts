import { db } from '~/server/utils/db';
import { users } from '~/server/database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const id = Number(event.context.params?.id);

    if (isNaN(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid user ID',
      });
    }

    const user = await db.select().from(users).where(eq(users.id, id));

    if (!user.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found',
      });
    }

    return { data: user[0] };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch user',
    });
  }
});
