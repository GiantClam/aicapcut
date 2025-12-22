"use server"

import { prisma } from "./prisma"

export async function checkUserAuthorization(email: string | null | undefined) {
    if (!email) return false;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { profile: true }
        });

        return user?.profile?.is_allowed || false;
    } catch (error) {
        console.error("Error checking authorization:", error);
        return false;
    }
}
