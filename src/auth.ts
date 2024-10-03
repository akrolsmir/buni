import { dbOnVolume } from 'src/volumes'
import { type AuthConfig } from '@auth/core'
import { getToken } from '@auth/core/jwt'
import Google from '@auth/core/providers/google'
import { customAlphabet } from 'nanoid'

export const AUTH_CONFIG: AuthConfig = {
  providers: [
    Google(
      process.env.NODE_ENV === 'production'
        ? {
            clientId: process.env.GOOGLE_PROD_CLIENT_ID,
            clientSecret: process.env.GOOGLE_PROD_CLIENT_SECRET,
          }
        : {
            clientId: process.env.GOOGLE_LOCAL_CLIENT_ID,
            clientSecret: process.env.GOOGLE_LOCAL_CLIENT_SECRET,
          }
    ),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  // debug: true,
  callbacks: {
    // Adding the access token means that you can make future API calls
    // to eg Google as the user. Lasts 3600s = 1h
    async jwt({ token, account, user }) {
      // In a single SQL query, look up user by email, creating them if not found
      if (account) {
        // For now, directly access /buni/db.sqlite.
        // !!! bad practice to directly modify userspace db from the platform !!!
        // Probably should migrate Users to a platform db
        // TODO: also refactor this stuff to src/auth.ts
        const buniDb = dbOnVolume('/buni/db.sqlite')
        const randomId = customAlphabet(
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
          8
        )
        const sanitize = (s: string) =>
          s.toLocaleLowerCase().replace(/[^a-z0-9]/g, '-')
        const user_id = randomId()
        const params = {
          $user_id: user_id,
          $email: user.email as string,
          $username: sanitize(user.name as string),
          $name: user.name as string,
          $avatar_url: user.image as string,
        }

        const newUser = buniDb
          .query(
            'INSERT INTO Users (user_id, email, username, name, avatar_url) VALUES ($user_id, $email, $username, $name, $avatar_url) ON CONFLICT (email) DO NOTHING RETURNING *'
          )
          .all(params)

        // accessToken is the Google OAuth access token; not currently used
        // token.accessToken = account.access_token
      }
      return token
    },
    // This callback executes on /auth/session
    async session({ session, token }) {
      // Look up user_id by email
      const buniDb = dbOnVolume('/buni/db.sqlite')
      const user = buniDb
        .query('SELECT user_id, username FROM Users WHERE email = $email')
        .get({ $email: session.user.email }) as {
        user_id: string
        username: string
      }
      session.user.id = user.user_id
      session.user.username = user.username
      return session
    },
  },
  cookies: {
    csrfToken: {
      name: 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  theme: {
    logo: 'https://manifund.org/Manifox.png',
  },
}

async function getSession(req: Request) {
  return await getToken({ req, secret: process.env.AUTH_SECRET })
}
