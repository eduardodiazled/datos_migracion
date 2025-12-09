import { withAuth } from "next-auth/middleware"

export default withAuth

export const config = {
    matcher: [
        '/',
        '/dashboard/:path*',
        '/inventory/:path*',
        '/sales/:path*',
        '/clients/:path*',
        '/analytics/:path*',
        '/api/inventory/:path*',
        '/api/clients/:path*',
        '/api/analytics/:path*',
    ]
}
