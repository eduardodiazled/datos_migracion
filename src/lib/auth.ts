import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    console.log('❌ Missing credentials')
                    return null
                }

                console.log(`🔍 Attempting login for: ${credentials.email}`)

                try {
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email }
                    })

                    if (!user) {
                        console.log('❌ User not found in database')
                        return null
                    }

                    console.log('✅ User found. Verifying password...')
                    const isValid = await bcrypt.compare(credentials.password, user.password)

                    if (!isValid) {
                        console.log('❌ Password mismatch')
                        return null
                    }

                    console.log('✅ Login successful')
                    return {
                        id: user.id.toString(),
                        email: user.email,
                        name: user.name,
                        role: user.role
                    }
                } catch (error) {
                    console.error('🔥 Auth Error:', error)
                    return null
                }
            }
        })
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async jwt({ token, user }: any) {
            if (user) {
                token.role = user.role
            }
            return token
        },
        async session({ session, token }: any) {
            if (session.user) {
                session.user.role = token.role
            }
            return session
        }
    },
    session: {
        strategy: 'jwt'
    }
}
