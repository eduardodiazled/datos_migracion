import { triggerBatchReminders } from '@/app/actions'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // Ensure it runs every time

export async function GET(request: Request) {
    try {
        // Vercel Cron automatically adds this header. 
        // We can check it to prevent unauthorized external access if needed, 
        // but for now, we'll keep it open or check basic auth if preferred.
        // Ideally: if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) ...

        console.log("⏰ Cron Triggered: Daily Reminders")

        const result = await triggerBatchReminders()

        if (result.success) {
            return NextResponse.json({ ok: true, message: result.message, count: result.count })
        } else {
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
        }
    } catch (error) {
        console.error("Cron Error:", error)
        return NextResponse.json({ ok: false, error: 'Internal Cron Error' }, { status: 500 })
    }
}
