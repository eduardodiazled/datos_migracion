import { Eye } from 'lucide-react'

export function Header() {
    return (
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-card-border px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center text-background font-bold text-lg">
                    E
                </div>
                <span className="font-bold text-lg tracking-tight">
                    ESTRATOSFERA<span className="text-primary">+</span>
                </span>
            </div>
        </header>
    )
}
