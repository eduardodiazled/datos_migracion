import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const accounts = await prisma.inventoryAccount.findMany({
      include: {
        perfiles: {
          orderBy: { id: 'asc' },
          include: {
            transactions: {
              where: { supersededAt: null },
              orderBy: { fecha_vencimiento: 'desc' },
              take: 1,
              include: { client: true }
            }
          }
        },
        transactions: {
          where: { supersededAt: null, perfilId: null },
          orderBy: { fecha_vencimiento: 'desc' },
          take: 1,
          include: { client: true }
        },
        provider: true
      },
    })

    // Transform to include 'cliente' property for frontend compatibility
    // Rule: If profile is LIBRE (or not OCUPADO), NEVER rehydrate previous client from transaction history!
    const formattedAccounts = accounts.map(account => {
      const directTx = account.transactions?.[0] || null
      return {
        ...account,
        transactions: undefined,
        perfiles: account.perfiles.map(profile => {
          const isOccupied = profile.estado === 'OCUPADO'
          const profileTx = profile.transactions?.[0] || null
          let activeClient = profileTx?.client || null

          // Fallback for 1-profile / full-account sales or renewals where perfilId was null
          if (isOccupied && directTx?.client) {
            if (!profileTx || new Date(directTx.fecha_vencimiento) > new Date(profileTx.fecha_vencimiento)) {
              activeClient = directTx.client
            }
          }

          return {
            ...profile,
            cliente: isOccupied ? activeClient : null,
            transactions: undefined // Optional: cleanup to reduce payload
          }
        })
      }
    })

    return NextResponse.json(formattedAccounts)
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching inventory' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Logic to add new account
    const { service, email, password, type } = body

    const account = await prisma.inventoryAccount.create({
      data: {
        servicio: service,
        email,
        password,
        tipo: type || 'ESTATICO',
        perfiles: {
          create: [
            { nombre_perfil: 'Per 1', pin: '1111' },
            { nombre_perfil: 'Per 2', pin: '2222' },
            { nombre_perfil: 'Per 3', pin: '3333' },
            { nombre_perfil: 'Per 4', pin: '4444' }, // Default 4 profiles
          ]
        }
      },
      include: { perfiles: true }
    })

    return NextResponse.json(account)
  } catch (error) {
    return NextResponse.json({ error: 'Error creating account' }, { status: 500 })
  }
}
