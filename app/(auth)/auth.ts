import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { createOAuthUser, getUser } from "@/lib/db/queries";
import { authConfig } from "./auth.config";

export type UserType = "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession["user"];
  }

  // biome-ignore lint/nursery/useConsistentTypeDefinitions: "Required"
  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const users = await getUser(email);

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) {
          return null;
        }

        return { ...user, type: "regular" };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("SignIn callback triggered:", { 
        provider: account?.provider, 
        email: user.email, 
        hasId: !!user.id 
      });
      
      if (account?.provider === "google" && user.email) {
        try {
          const users = await getUser(user.email);
          console.log("Found existing users:", users.length);
          
          if (users.length === 0) {
            // Create new user if doesn't exist
            console.log("Creating new OAuth user for:", user.email);
            const [newUser] = await createOAuthUser(user.email);
            user.id = newUser.id;
            user.type = "regular";
            console.log("Created new user with ID:", newUser.id);
          } else {
            const [existingUser] = users;
            user.id = existingUser.id;
            user.type = "regular";
            console.log("Using existing user with ID:", existingUser.id);
          }
          return true;
        } catch (error) {
          console.error("Error during Google sign in:", error);
          // Don't block sign-in for database errors, let it proceed
          // The user will still have basic info from Google
          user.id = user.email || "temp-id";
          user.type = "regular";
          return true;
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
      }

      return session;
    },
  },
});
