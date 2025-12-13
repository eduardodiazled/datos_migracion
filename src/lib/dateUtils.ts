
export function calculateSafeEndDate(startDate: Date | string, months: number): Date {
    const start = new Date(startDate)
    if (isNaN(start.getTime())) return new Date()

    // Create a new date for mutation
    const end = new Date(start)

    // Get original day to check for clamping needs
    const originalDay = start.getDate()

    // Add months
    end.setMonth(end.getMonth() + months)

    // Check if day overflowed (e.g. Jan 31 + 1 month -> March 3)
    // If we are in a different month than expected (Target Month + 1), it means it overflowed.
    // Expected month index: (StartMonth + months) % 12
    // But calculate expected year/month carefully.

    // Simpler check: If the day of the result is not the same as the original day,
    // AND the original day was > 28, it likely overflowed.
    // Example: Jan 31 + 1 mo -> Feb 28/29 (Standard behavior usually jumps to Mar 2/3, we want Feb 28/29).

    if (end.getDate() !== originalDay) {
        // If the day changed, it means the target month didn't have that many days.
        // So we clamp to the last day of the PREVIOUS month (which is the target month).
        // Actually, setMonth handles the overflow by going forward.
        // So if end.getDate() != originalDay, we set it to 0 (last day of previous month).
        end.setDate(0)
    }

    return end
}
