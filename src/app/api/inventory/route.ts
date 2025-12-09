import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const accounts = await prisma.inventoryAccount.findMany({
      include: {
        perfiles: {
          orderBy: { id: 'asc' },
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { client: true }
            }
          }
        },
        provider: true
      },
    })

    // Transform to include 'cliente' property for frontend compatibility
    const formattedAccounts = accounts.map(account => ({
      ...account,
      perfiles: account.perfiles.map(profile => ({
        ...profile,
        cliente: profile.transactions[0]?.client || null,
        transactions: undefined // Optional: cleanup to reduce payload
      }))
    }))

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
