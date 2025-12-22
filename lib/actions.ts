"use server"

import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

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

export async function registerUser(email: string, password: string) {
    try {
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return { error: "User already exists" };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                profile: {
                    create: {
                        id: `prof_${Date.now()}`,
                        is_allowed: false
                    }
                }
            }
        });

        return { success: true, user: { id: user.id, email: user.email } };
    } catch (error) {
        console.error("Registration error:", error);
        return { error: "Failed to register user" };
    }
}
