import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./lib/prisma"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: [
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
        }),
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
    ],
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                // @ts-ignore
                session.user.id = user.id;
            }
            return session;
        },
        async signIn({ user, account, profile }) {
            // Optional: Check if profile exists, if not create one with is_allowed: false
            // But Auth.js with PrismaAdapter automatically handles User creation.
            // We can use an event or a callback to ensure a Profile is created.
            return true;
        },
    },
    events: {
        async createUser({ user }) {
            // Automatically create a profile for new users
            await prisma.profile.create({
                data: {
                    id: `prof_${user.id}`,
                    userId: user.id!,
                    is_allowed: false
                }
            })
        }
    }
})
