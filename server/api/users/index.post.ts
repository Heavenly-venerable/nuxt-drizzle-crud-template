import { db } from '~/server/utils/db';
import { users } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Validate input
    if (!body.name || !body.email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name and email are required',
      });
    }

    const newUser = await db.insert(users).values({
      name: body.name,
      email: body.email,
    }).returning();

    return { data: newUser[0] };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create user',
    });
  }
});
