
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export default async function DebugPage() {
    const email = 'ldznnfx18@gmail.com'
    const pass = 'Netflix1805'

    let userDetails = "Pending..."
    let dbUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "Undefined"

    // Mask DB URL for safety
    const maskedUrl = dbUrl.length > 10 ? dbUrl.substring(0, 15) + "..." : dbUrl

    try {
        const user = await prisma.user.findUnique({ where: { email } })
        const usersCount = await prisma.user.count()

        if (!user) {
            userDetails = `❌ User '${email}' NOT found. (Total Users in DB: ${usersCount})`
        } else {
            const match = await bcrypt.compare(pass, user.password)
            userDetails = `✅ User FOUND. ID: ${user.id}. Password Match: ${match ? 'YES' : 'NO'}. Role: ${user.role}`
        }
    } catch (e: any) {
        userDetails = `🔥 ERROR: ${e.message}`
    }

    return (
        <div className="min-h-screen bg-black text-green-400 font-mono p-8 text-sm md:text-base">
            <h1 className="text-2xl font-bold mb-6 border-b border-green-800 pb-2">SYSTEM DIAGNOSTIC</h1>

            <div className="space-y-4">
                <div>
                    <span className="text-slate-500 block mb-1">Database Connection:</span>
                    <div className="border border-green-900 bg-green-900/10 p-4 rounded-lg">
                        URL: {maskedUrl}
                    </div>
                </div>

                <div>
                    <span className="text-slate-500 block mb-1">User Verification ({email}):</span>
                    <div className="border border-green-900 bg-green-900/10 p-4 rounded-lg">
                        {userDetails}
                    </div>
                </div>
            </div>

            <div className="mt-8 text-slate-600 text-xs">
                System Node Version: {process.version}
            </div>
        </div>
    )
}
