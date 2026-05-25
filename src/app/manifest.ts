import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Estratosfera App',
        short_name: 'Estratosfera',
        description: 'Gestión inteligente de servicios de streaming',
        start_url: '/',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#020617',
        icons: [
            {
                src: '/logo.jpg',
                sizes: '192x192',
                type: 'image/jpeg',
            },
            {
                src: '/logo.jpg',
                sizes: '512x512',
                type: 'image/jpeg',
            },
        ],
    }
}
