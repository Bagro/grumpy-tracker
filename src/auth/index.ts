import lucia from 'lucia-auth';
import { db } from '../db';

export const auth = lucia({
  adapter: {
    getUser: async (id: string) => {
      return await db.selectFrom('user').selectAll().where('id', '=', id).executeTakeFirst();
    },
    getUserByEmail: async (email: string) => {
      return await db.selectFrom('user').selectAll().where('email', '=', email).executeTakeFirst();
    },
    // ...implement other required adapter methods
  },
  session: {
    // session config here
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  },
});
