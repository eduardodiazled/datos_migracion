'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Filter, MoreVertical, Copy, RefreshCw, Trash2, User, ShieldAlert, Check, DollarSign, Calendar, Activity, Monitor, LogOut, Edit2, X, Clock, FileText, Download, CheckCircle, Send, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { signOut } from 'next-auth/react'
import { MessageGenerator } from '@/lib/messageGenerator'
import { createInventoryAccount, deleteInventoryAccount, updateInventoryAccount, createSale, assignProfile, setAccountWarranty, replaceInventoryAccount, updateProfileStatus, getAllProviders, createProvider, createComboSale, sellFullAccount, searchClients, deleteInventoryProfile, migrateProfile, sendReceiptAction, getExpiredDisposables, archiveAccount, getArchivedInventory, sendTestReminder } from '../actions'
import { calculateSafeEndDate, getLocalDateISO, getLocalDateTimeISO } from '@/lib/dateUtils'
import html2canvas from 'html2canvas'
import { sendToBot } from '@/services/whatsapp'

// Types
type Profile = {
  id: number
  nombre_perfil: string
  pin: string | null
  estado: 'LIBRE' | 'OCUPADO' | 'CUARENTENA_PIN' | 'GARANTIA' | 'CAIDO'
  cliente?: {
    nombre: string
    celular: string
  }
}

type Account = {
  id: number
  servicio: string
  email: string
  password: string
  perfiles: Profile[]
  provider?: {
    id: number
    nombre: string
  }
  dia_corte?: number
  is_disposable?: boolean
  tipo: string
  activationDate?: string
  fecha_activacion?: string
  duracion_meses?: number
}

const DEFAULT_PRICES: Record<string, number> = {
  'netflix': 16000,
  'disney': 15000,
  'max': 10000,
  'prime': 11000,
  'amazon': 11000,
  'youtube': 10000,
  'spotify': 10000,
  'crunchyroll': 10000,
  'vix': 10000,
  'plex': 10000,
  'iptv': 15000,
  'apple': 25000,
  'jellyfin': 12000,
  'Chat GPT': 25000,
  'capcut': 10000,
  'canva': 10000
}

const getServicePrice = (serviceName: string): number => {
  const lower = serviceName.toLowerCase()
  for (const [key, price] of Object.entries(DEFAULT_PRICES)) {
    if (lower.includes(key)) return price
  }
  return 10000 // Fallback
}

export default function InventoryPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSellModal, setShowSellModal] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)

  const [providers, setProviders] = useState<{ id: number, nombre: string }[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<number | 'ALL'>('ALL')

  // Forms Data
  const [newAccount, setNewAccount] = useState<{ service: string, email: string, password: string, profilesCount: number, providerId?: number, dia_corte?: number, is_disposable?: boolean, activationDate?: string, months_duration?: number }>({ service: '', email: '', password: '', profilesCount: 1, is_disposable: false, activationDate: getLocalDateISO(), months_duration: 1 })
  const [isCustomService, setIsCustomService] = useState(false)
  // Filters & Views
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS')
  const [activeTab, setActiveTab] = useState<'ALL' | 'RENEWABLE' | 'DISPOSABLE' | 'ARCHIVED'>('ALL')
  const [isCreatingProvider, setIsCreatingProvider] = useState(false)
  const [newProviderName, setNewProviderName] = useState('')

  // Combo / Multi-select (Use existing definition at line 315)

  const [profileDetails, setProfileDetails] = useState<{ name: string, pin?: string }[]>([])
  const [usePin, setUsePin] = useState(false)
  const [saleData, setSaleData] = useState({ phone: '', name: '', price: '', paymentMethod: 'NEQUI' as 'NEQUI' | 'BANCOLOMBIA' | 'EFECTIVO' | 'DAVIPLATA' | 'USDT', date: getLocalDateISO(), months: 1 })
  // Assign Modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignData, setAssignData] = useState({ phone: '', name: '', startDate: getLocalDateISO(), months: 1 })
  const [clientSearchResults, setClientSearchResults] = useState<{ celular: string, nombre: string }[]>([])
  const [isSearchingClient, setIsSearchingClient] = useState(false)

  // Edit Account State
  const [showEditAccountModal, setShowEditAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any>(null)
  const [editingProfiles, setEditingProfiles] = useState<{ id?: number, name: string, pin?: string }[]>([])

  // Replace Account State
  const [showReplaceModal, setShowReplaceModal] = useState(false)

  // Full Account Sale State
  const [isFullAccountSale, setIsFullAccountSale] = useState(false)
  const [targetAccountForSale, setTargetAccountForSale] = useState<any>(null)

  // ...

  const [replacingAccount, setReplacingAccount] = useState<{ id: number, serviceName: string } | null>(null)

  // Lifecycle State
  const [expiredAccounts, setExpiredAccounts] = useState<Account[]>([])
  const [replaceData, setReplaceData] = useState({
    email: '',
    password: '',
    date: getLocalDateISO()
  })


  // Migration State (Swap)
  const [showMigrateModal, setShowMigrateModal] = useState(false)
  const [profileToMigrate, setProfileToMigrate] = useState<{ id: number, serviceName: string, accountId: number, profileName: string } | null>(null)
  const [targetProfileId, setTargetProfileId] = useState<number | null>(null)
  const [migrationReason, setMigrationReason] = useState<'FALLA_PIN' | 'CAIDA_PAGO' | 'MES_FINALIZADO' | 'OTRO' | 'FALLA_CODIGO'>('FALLA_PIN')

  // Sort & Group State
  const [sortBy, setSortBy] = useState<'DEFAULT' | 'AVAILABILITY'>('DEFAULT')
  const [groupBy, setGroupBy] = useState<'PROVIDER' | 'SERVICE'>('PROVIDER')
  const [showMenu, setShowMenu] = useState(false)
  const [autoSendStatus, setAutoSendStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE')

  const fetchInventory = () => {
    setLoading(true)

    if (activeTab === 'ARCHIVED') {
      getArchivedInventory().then(res => {
        if (res.success && res.accounts) {
          setAccounts(res.accounts as any)
        } else {
          setAccounts([])
        }
        setLoading(false)
      })
    } else {
      fetch('/api/inventory')
        .then(res => res.json())
        .then(data => {
          setAccounts(data)
          setLoading(false)
        })
    }
  }

  // Invoice State
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const invoiceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchInventory()
  }, [activeTab])

  useEffect(() => {
    getAllProviders().then(setProviders)
  }, [])

  const handlePhoneChange = async (val: string) => {
    // Allow only numbers
    const cleanVal = val.replace(/\D/g, '')
    setSaleData(prev => ({ ...prev, phone: cleanVal }))

    // Search if length > 6
    if (cleanVal.length > 6) {
      const clients = await searchClients(cleanVal)
      if (clients && clients.length > 0) {
        // Exact match or best match?
        // searchClients returns regex match. Let's find exact or first.
        const found = clients.find(c => c.celular.includes(cleanVal)) || clients[0]
        if (found) {
          setSaleData(prev => ({ ...prev, name: found.nombre }))
        }
      }
    }
  }

  const generateInvoice = (data: any) => {
    const invoicePayload = {
      amount: data.price,
      client: data.clientName,
      category: data.service,
      date: new Date().toISOString(), // Use current time for invoice generation or parse data.date
      paymentMethod: data.paymentMethod || 'EFECTIVO',
      isCombo: data.service === 'Combo / Selección',
      items: data.items || [] // Capture items for combo display
    }

    setInvoiceData(invoicePayload)

    setTimeout(() => {
      if (invoiceRef.current) {
        html2canvas(invoiceRef.current, { backgroundColor: '#020617' }).then(canvas => {
          const link = document.createElement('a')
          link.download = `Recibo_${data.clientName}_${Date.now()}.png`
          link.href = canvas.toDataURL()
          link.click()
          setInvoiceData(null)
        })
      }
    }, 500)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }

  const handleRotate = async (profileId: number, status?: string) => {
    if (status === 'CUARENTENA_PIN') {
      const newPin = prompt('Ingrese el nuevo PIN si desea cambiarlo (o deje vacío para mantener el actual):')
      if (newPin !== null) { // User didn't cancel
        const res = await fetch('/api/inventory/revive', {
          method: 'POST',
          body: JSON.stringify({ profileId, newPin })
        })
        if (res.ok) {
          toast.success('Perfil revivido (Libre)')
          fetchInventory()
        } else {
          toast.error('Error al revivir')
        }
      }
    } else {
      if (!confirm('¿Seguro que quieres reportar/rotar este perfil? Se marcará en CUARENTENA.')) return
      const res = await fetch('/api/inventory/rotate', {
        method: 'POST',
        body: JSON.stringify({ profileId })
      })

      if (res.ok) {
        toast.success('Perfil rotado/reportado')
        fetchInventory()
      } else {
        const err = await res.json()
        toast.error('Error: ' + err.error)
      }
    }
  }

  const handleWarranty = async (profileId: number) => {
    if (!confirm('¿Aplicar GARANTÍA? Esto buscará una cuenta diferente.')) return

    const res = await fetch('/api/inventory/warranty', {
      method: 'POST',
      body: JSON.stringify({ profileId })
    })

    if (res.ok) {
      toast.success('Garantía aplicada')
      fetchInventory()
    } else {
      const err = await res.json()
      toast.error('Error: ' + err.error)
    }
  }




  const handleCreateAccount = async () => {
    if (!newAccount.service || !newAccount.email || !newAccount.password) return toast.error('Faltan datos')

    // Construct profiles
    const profiles = Array.from({ length: newAccount.profilesCount }).map((_, i) => ({
      name: profileDetails[i]?.name || `Perfil ${i + 1}`,
      pin: usePin ? (profileDetails[i]?.pin || '') : undefined
    }))

    const res = await createInventoryAccount({
      service: newAccount.service,
      email: newAccount.email,
      password: newAccount.password,
      profiles,
      providerId: newAccount.providerId,
      dia_corte: newAccount.dia_corte,
      is_disposable: newAccount.is_disposable,
      activationDate: newAccount.activationDate,
      months_duration: newAccount.months_duration
    })

    if (res.success) {
      toast.success('Cuenta creada!')
      setShowAddModal(false)
      setNewAccount({
        service: '',
        email: '',
        password: '',
        profilesCount: 1,
        is_disposable: false,
        activationDate: new Date().toISOString().split('T')[0],
        months_duration: 1
      })
      setProfileDetails([])
      setUsePin(false)
      fetchInventory()
    } else {
      toast.error('Error creando cuenta')
    }
  }



  const handleOpenSell = (profileId: number, serviceName: string) => {
    setSelectedProfileId(profileId)
    const price = getServicePrice(serviceName)
    setSaleData({ ...saleData, price: price.toString(), paymentMethod: 'NEQUI' })
    setShowSellModal(true)
  }


  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successData, setSuccessData] = useState<{ message: string, receiptId?: number, clientName?: string, service?: string, date?: string, price?: number, paymentMethod?: string, months?: number, items?: any[] } | null>(null)



  // Combo / Multi-select
  const [selectedItems, setSelectedItems] = useState<{ profileId: number, type: 'PROFILE' | 'FULL_ACCOUNT', accountId: number, serviceName: string, price: number }[]>([])

  const toggleSelection = (profile: Profile, serviceName: string, accountId: number, defaultPrice: number = 10000) => {
    setSelectedItems(prev => {
      // Check if profile is already selected
      const exists = prev.find(i => i.profileId === profile.id && i.type === 'PROFILE')
      if (exists) return prev.filter(i => i.profileId !== profile.id)

      // Check if ALREADY selected as part of FULL ACCOUNT? 
      // If user selects specific profile while Full Account is selected, maybe we shouldn't allow?
      // Or we just let them do it and handle it. Ideally, distinct.
      // If Full Account is selected, individual profiles disable?
      const fullAccountSelected = prev.find(i => i.accountId === accountId && i.type === 'FULL_ACCOUNT')
      if (fullAccountSelected) {
        toast.error('La cuenta completa ya está seleccionada')
        return prev
      }

      return [...prev, { profileId: profile.id, type: 'PROFILE', accountId, serviceName: `${serviceName} - ${profile.nombre_perfil}`, price: defaultPrice }]
    })
  }

  const toggleFullAccountSelection = (account: Account) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.accountId === account.id && i.type === 'FULL_ACCOUNT')
      if (exists) {
        return prev.filter(i => i.accountId !== account.id || i.type !== 'FULL_ACCOUNT')
      }

      // Remove any individual profiles from this account if selecting full
      const cleanPrev = prev.filter(i => i.accountId !== account.id)

      return [...cleanPrev, {
        profileId: 0, // Dummy
        type: 'FULL_ACCOUNT',
        accountId: account.id,
        serviceName: `${account.servicio} (COMPLETA)`,
        price: getServicePrice(account.servicio)
      }]
    })
  }

  // Toggle ALL profiles of an account (Select All / Combo)
  const toggleAccountSelection = (account: Account) => {
    const allProfileIds = (account.perfiles || []).map(p => p.id)
    const allSelected = allProfileIds.every(id => selectedItems.some(i => i.profileId === id))

    if (allSelected) {
      // Deselect All
      setSelectedItems(prev => prev.filter(i => !allProfileIds.includes(i.profileId)))
    } else {
      // Select All (Prefer LIBRE, but for full account sale, selects ALL useful ones)
      const validProfiles = (account.perfiles || []).filter(p => p.estado === 'LIBRE' || p.estado === 'OCUPADO' || p.estado === 'GARANTIA')
      if (validProfiles.length === 0) return toast.error('No hay perfiles válidos')

      const newItems = validProfiles.map(p => ({
        profileId: p.id,
        accountId: account.id,
        type: 'PROFILE' as const,
        serviceName: `${account.servicio} - ${p.nombre_perfil}`,
        price: 15000 // Default, can be overridden by combo price
      }))
      setSelectedItems(prev => {
        const others = prev.filter(i => !allProfileIds.includes(i.profileId))
        return [...others, ...newItems]
      })
      toast.success(`${validProfiles.length} perfiles seleccionados`)
    }
  }

  const handleSell = async () => {
    // COMBO / SELECTION MODE
    if (selectedItems.length > 0) {
      if (!saleData.phone || !saleData.name) return toast.error('Faltan datos del cliente')

      setIsSubmitting(true)
      try {
        // Distribute custom combo price proportionally
        const totalOriginalPrice = selectedItems.reduce((sum, item) => sum + item.price, 0)
        const customPrice = parseInt(saleData.price) || 0

        let runningSum = 0
        const payloadItems = selectedItems.map((i, idx) => {
          let adjustedPrice = 0
          if (idx === selectedItems.length - 1) {
            adjustedPrice = customPrice - runningSum
          } else {
            if (totalOriginalPrice > 0) {
              adjustedPrice = Math.round((i.price / totalOriginalPrice) * customPrice)
            } else {
              adjustedPrice = Math.round(customPrice / selectedItems.length)
            }
            runningSum += adjustedPrice
          }
          return {
            profileId: i.profileId,
            type: i.type,
            accountId: i.accountId,
            price: adjustedPrice
          }
        })

        const res = await createComboSale(
          saleData.phone,
          saleData.name,
          saleData.paymentMethod as any,
          payloadItems,
          saleData.date,
          saleData.months
        )

        if (res.success) {
          toast.success('Venta Exitosa (Combo)')
          setShowSellModal(false)
          fetchInventory()

          // Detailed Success Message for Combo
          const validationItems = selectedItems.map((item, idx) => {
            // Find the source profile/account in the state to get credentials
            const sourceAccount = accounts.find(a => a.id === item.accountId)
            if (!sourceAccount) return null

            const payloadItem = payloadItems[idx]
            const finalPrice = payloadItem ? payloadItem.price : item.price

            if (item.type === 'FULL_ACCOUNT') {
              return {
                service: sourceAccount.servicio,
                email: sourceAccount.email,
                password: sourceAccount.password,
                profile: 'Cuenta Completa',
                pin: null,
                price: finalPrice
              }
            } else {
              const sourceProfile = sourceAccount.perfiles.find(p => p.id === item.profileId)
              if (!sourceProfile) return null

              return {
                service: sourceAccount.servicio,
                email: sourceAccount.email,
                password: sourceAccount.password,
                profile: sourceProfile.nombre_perfil,
                pin: sourceProfile.pin,
                price: finalPrice
              }
            }
          }).filter(Boolean) as any[]

          // Calculate Expiration Date correctly (Date + Months)
          const startDate = new Date((saleData.date || getLocalDateISO()) + 'T12:00:00')
          const monthsToAdd = saleData.months || 1
          const expirationDate = new Date(startDate)
          expirationDate.setMonth(expirationDate.getMonth() + monthsToAdd)

          const msg = MessageGenerator.generate('COMBO', {
            clientName: saleData.name,
            items: validationItems,
            expirationDate: expirationDate.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
          })

          setSuccessData({
            message: msg,
            clientName: saleData.name,
            service: 'Combo / Selección',
            price: parseInt(saleData.price),
            date: new Date().toLocaleDateString(),
            paymentMethod: saleData.paymentMethod,
            months: saleData.months,
            items: validationItems // Save items in successData too for reference
          })
          setShowSuccessModal(true)

          // AUTO-SEND TEXT TO BOT
          sendToBot(saleData.phone, msg)
            .then(() => setAutoSendStatus('SUCCESS'))
            .catch(() => setAutoSendStatus('ERROR'))

          // AUTOMATION: Generate & Send Receipt
          setInvoiceData({
            amount: parseInt(saleData.price),
            client: saleData.name,
            category: 'Combo / Selección',
            date: getLocalDateTimeISO(),
            paymentMethod: saleData.paymentMethod,
            isCombo: true,
            items: validationItems, // Pass items to invoice
            months: saleData.months
          })



          setSelectedItems([])
        } else {
          toast.error('Error: ' + res.error)
        }
      } catch (e) {
        console.error(e)
        toast.error('Error procesando venta')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // SINGLE SALE (Legacy / Direct)
    if (!selectedProfileId || !saleData.phone || !saleData.name || !saleData.price || !saleData.paymentMethod) return toast.error('Faltan datos del cliente o venta')

    const res = await createSale(saleData.phone, saleData.name, selectedProfileId, parseInt(saleData.price), saleData.paymentMethod, saleData.date, saleData.months)
    if (res.success && res.transaction) {
      toast.success('Venta realizada!')
      setShowSellModal(false)
      fetchInventory()

      const profileInfo = accounts.flatMap(a => a.perfiles.map(p => ({ ...p, account: a }))).find(p => p.id === selectedProfileId)

      if (profileInfo) {
        const msg = MessageGenerator.generate('SALE', {
          clientName: saleData.name,
          service: profileInfo.account.servicio,
          email: profileInfo.account.email,
          password: profileInfo.account.password,
          profileName: profileInfo.nombre_perfil,
          pin: profileInfo.pin,
          date: (() => {
            const d = new Date((saleData.date || new Date().toISOString().split('T')[0]) + 'T12:00:00')
            d.setMonth(d.getMonth() + (saleData.months || 1))
            return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
          })(),
          price: parseInt(saleData.price)
        })
        setSuccessData({
          message: msg,
          receiptId: res.transaction.id,
          clientName: saleData.name,
          service: profileInfo.account.servicio,
          date: new Date((saleData.date || new Date().toISOString().split('T')[0]) + 'T12:00:00').toLocaleDateString(),
          price: parseInt(saleData.price),
          paymentMethod: saleData.paymentMethod,
          months: saleData.months
        })
        setShowSuccessModal(true)

        // AUTO-SEND TEXT TO BOT
        sendToBot(saleData.phone, msg)
          .then(() => setAutoSendStatus('SUCCESS'))
          .catch(() => setAutoSendStatus('ERROR'))

        // AUTOMATION: Generate & Send Receipt
        setInvoiceData({
          amount: parseInt(saleData.price),
          client: saleData.name,
          category: profileInfo.account.servicio,
          date: new Date().toISOString(),
          paymentMethod: saleData.paymentMethod,
          isCombo: false,
          months: saleData.months
        })


      }

    } else {
      toast.error('Error en venta')
    }
  }


  const handleOpenAssign = (profileId: number) => {
    setSelectedProfileId(profileId)
    setShowAssignModal(true)
  }

  const handleAssign = async () => {
    if (!selectedProfileId || !assignData.phone || !assignData.name) return toast.error('Faltan datos')

    const calculatedEndDate = calculateSafeEndDate(assignData.startDate, assignData.months)

    const res = await assignProfile(assignData.phone, assignData.name, selectedProfileId, calculatedEndDate.toISOString(), assignData.startDate)
    if (res.success) {
      toast.success('Cliente asignado correctamente!')
      setShowAssignModal(false)
      fetchInventory()
    } else {
      toast.error('Error al asignar')
    }
  }

  const handleClientSearch = async (query: string) => {
    setAssignData(prev => ({ ...prev, name: query }))
    if (query.length > 2) {
      setIsSearchingClient(true)
      const results = await searchClients(query)
      setClientSearchResults(results)
      setIsSearchingClient(false)
    } else {
      setClientSearchResults([])
    }
  }

  const selectClient = (client: { celular: string, nombre: string }) => {
    setAssignData(prev => ({ ...prev, name: client.nombre, phone: client.celular }))
    setClientSearchResults([])
  }

  // --- LIFECYCLE HANDLERS ---
  useEffect(() => {
    // Check for expired disposables on load
    getExpiredDisposables().then(res => {
      if (res.success && res.accounts) {
        setExpiredAccounts(res.accounts as any)
      }
    })
  }, [])

  const handleArchive = async (accountId: number) => {
    if (!confirm('¿Archivar esta cuenta completada?\n\nDesaparecerá de la lista activa y se eliminará automáticamente en 30 días.')) return

    const res = await archiveAccount(accountId)
    if (res.success) {
      toast.success('Cuenta Archivada')
      // Remove locally
      setExpiredAccounts(prev => prev.filter(a => a.id !== accountId))
      fetchInventory()
    } else {
      toast.error('Error al archivar')
    }
  }

  const handleUpdateAccount = async () => {
    if (!editingAccount) return

    // Construct update payload
    const payload: any = {}
    if (editingAccount.servicio) payload.service = editingAccount.servicio
    if (editingAccount.email) payload.email = editingAccount.email
    if (editingAccount.password) payload.password = editingAccount.password
    if (editingAccount.providerId) payload.providerId = editingAccount.providerId
    if (editingAccount.dia_corte) payload.dia_corte = editingAccount.dia_corte
    if (editingAccount.is_disposable !== undefined) payload.is_disposable = editingAccount.is_disposable
    if (editingAccount.fecha_activacion) payload.activationDate = editingAccount.fecha_activacion
    // @ts-ignore
    if (editingAccount.duracion_meses) payload.months_duration = editingAccount.duracion_meses
    // @ts-ignore
    if (editingAccount.duracion_meses) payload.months_duration = editingAccount.duracion_meses

    // Add profiles if modified
    payload.profiles = editingProfiles

    const res = await updateInventoryAccount(editingAccount.id, payload)

    if (res.success) {
      toast.success('Cuenta y perfiles actualizados')
      setShowEditAccountModal(false)
      setEditingAccount(null)
      fetchInventory()
    } else {
      toast.error('Error al actualizar')
    }
  }

  const handleAccountWarranty = async (accountId: number, serviceName: string) => {
    if (confirm(`⚠ GARANTÍA DE CUENTA COMPLETA ⚠\n\n¿Estás seguro de poner TODA la cuenta de ${serviceName} en garantía?\nEsto marcará TODOS los perfiles como 'GARANTÍA' para revisión/reemplazo.`)) {
      const res = await setAccountWarranty(accountId)
      if (res.success) {
        toast.success(`Cuenta ${serviceName} marcada en Garantía`)
        fetchInventory()
      } else {
        toast.error('Error: ' + res.error) // Will show stock error if gate fails
      }
    }
  }

  const handleOpenReplace = (account: Account) => {
    setReplacingAccount({ id: account.id, serviceName: account.servicio })
    setReplaceData({
      email: '',
      password: '',
      date: new Date().toISOString().split('T')[0]
    })
    setShowReplaceModal(true)
  }

  const handleReplaceSubmit = async () => {
    if (!replacingAccount) return
    if (!replaceData.email || !replaceData.password || !replaceData.date) return toast.error('Faltan datos de la cuenta nueva')

    const res = await replaceInventoryAccount(replacingAccount.id, {
      newEmail: replaceData.email,
      newPassword: replaceData.password,
      newDate: replaceData.date
    })

    if (res.success) {
      toast.success('Cuenta Repuesta Exitosamente (Perfiles Libres)')
      setShowReplaceModal(false)
      fetchInventory()
    } else {
      toast.error('Error al reponer: ' + res.error)
    }
  }


  const handleRevive = async (profileId: number) => {
    // Ask for PIN
    const newPin = prompt('REVIVIR PERFIL:\n\nIngresa el NUEVO PIN para este perfil (Opcional).\nSi lo dejas vacío, quedará sin PIN.')

    if (newPin === null) return // Cancelled

    const res = await fetch('/api/inventory/revive', {
      method: 'POST',
      body: JSON.stringify({ profileId, newPin })
    })

    if (res.ok) {
      toast.success('Perfil Revivido con Éxito')
      fetchInventory()
    } else {
      toast.error('Error al revivir')
    }
  }

  const handleProfileStatus = async (profileId: number, status: 'LIBRE' | 'GARANTIA') => {
    // If setting to WARRANTY, we should probably check stock too? 
    // The user requirement specifically mentioned "si yo meto una cuenta desechable... no, es que si debe ser asi la garantia es con la cuenta completaa"
    // But later "cada perfil individual... mensaje a traves del bot".
    // Let's allow individual toggle. Ideally strict stock check should be on backend for this too, but setAccountWarranty has the gate.
    // For individual profile:
    if (status === 'GARANTIA') {
      if (!confirm('¿Reportar este perfil específico a Garantía?')) return
    }

    const res = await updateProfileStatus(profileId, status)
    if (res.success) {
      toast.success(`Perfil actualizado a ${status}`)
      fetchInventory()
    } else {
      toast.error('Error actualizando perfil')
    }
  }

  const handleDeleteAccount = async () => {
    if (!editingAccount || !confirm('⛔ ¿ESTÁS COMPLETAMENTE SEGURO?\n\nSe eliminará la cuenta y TODOS sus perfiles asociados permanentemente.\nEsta acción no se puede deshacer.')) return

    const res = await deleteInventoryAccount(editingAccount.id)
    if (res.success) {
      toast.success('Cuenta eliminada correctamente')
      setShowEditAccountModal(false)
      setEditingAccount(null)
      fetchInventory()
    } else {
      toast.error('Error al eliminar: ' + res.error)
    }
  }

  const handleDeleteProfile = async (index: number, profileId?: number) => {
    if (profileId) {
      // Existing profile: Delete from DB
      if (!confirm('¿Seguro de eliminar este perfil permanentemente?')) return

      const res = await deleteInventoryProfile(profileId)
      if (res.success) {
        toast.success('Perfil eliminado')
        const newProfiles = [...editingProfiles]
        newProfiles.splice(index, 1)
        setEditingProfiles(newProfiles)
        fetchInventory() // Refresh to sync data
      } else {
        toast.error('Error al eliminar perfil')
      }
    } else {
      // New profile (unsaved): Just remove from list
      const newProfiles = [...editingProfiles]
      newProfiles.splice(index, 1)
      setEditingProfiles(newProfiles)
    }
  }



  return (

    <>
      {/* FLOATING ACTION BAR FOR COMBOS */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-8 z-50 animate-in slide-in-from-bottom-6 fade-in duration-300">
          <div className="glass-panel p-3 px-6 rounded-full flex items-center gap-6 shadow-2xl border border-violet-500/50 bg-slate-900/90 backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Combo Activo</span>
              <span className="text-white font-bold text-lg">{selectedItems.length} {selectedItems.length === 1 ? 'Ítem' : 'Ítems'}</span>
            </div>
            <div className="h-8 w-px bg-white/10"></div>
            <button
              onClick={() => setSelectedItems([])}
              className="text-sm font-medium text-slate-400 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                setSelectedProfileId(null) // Indicate combo sale
                setSaleData({ ...saleData, price: selectedItems.reduce((sum, item) => sum + item.price, 0).toString(), paymentMethod: 'NEQUI' })
                setShowSellModal(true)
              }}
              className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-violet-600/30 transition hover:scale-105 flex items-center gap-2"
            >
              <DollarSign size={18} />
              Vender Selección
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 pb-24">

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Inventario
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-500"></div>}
            </h1>
            <p className="text-slate-400 text-sm">Gestiona cuentas y perfiles.</p>
          </div>
          <div className="relative md:hidden">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <MoreVertical size={24} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-12 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 min-w-[160px] z-50 flex flex-col gap-1">
                <button onClick={() => { signOut({ callbackUrl: '/login' }); setShowMenu(false) }} className="w-full text-left px-4 py-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg flex items-center gap-2 text-sm font-bold">
                  <LogOut size={16} /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>


        {/* --- EXPIRED ACCOUNTS WARNING --- */}
        {expiredAccounts.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/50 p-4 rounded-xl flex items-center justify-between mb-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <div className="bg-rose-500/20 p-2 rounded-full">
                <ShieldAlert className="text-rose-500" size={24} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Atención: {expiredAccounts.length} {expiredAccounts.length === 1 ? 'Cuenta Desechable Vencida' : 'Cuentas Desechables Vencidas'}</h3>
                <p className="text-rose-300 text-sm">Estas cuentas terminaron hace más de 5 días. Revísalas y archívalas.</p>
              </div>
            </div>
            <button
              onClick={() => {
                // Filter view to show these accounts? Or just open first one?
                // Simpler: Just filter search to "DESECHABLE" and maybe highlight them? 
                // Better: Show a mini list inside a modal or toggle a special filter?
                // Let's just set the searchTerm to a unique ID or similar? 
                // Or simply filter the current view to only show these IDs.
                // For now, let's keep it simple: Show them in a Modal LIST or just let user find them?
                // User said: "alert me... verify... archive".
                // Let's make this button Open a "Expiring Review Modal"
                // Actually, I can just render them right here in the banner if it's small list, or toggle filter.

                // Let's toggle a special Mode or just filter the main list?
                // Actually, let's just make the banner expandable?
                // No, let's use the Search to find them? No that's hacky.
                // Let's add a "Quick Action" block right here.
              }}
              className="hidden" // Hiding for now, will implement direct list below
            ></button>
          </div>
        )}

        {expiredAccounts.length > 0 && (
          <div className="space-y-2 mb-8">
            {expiredAccounts.map(acc => (
              <div key={acc.id} className="bg-slate-900 border border-rose-500/30 p-3 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="text-rose-400 font-bold">{acc.servicio}</div>
                  <div className="text-slate-500 text-xs">{acc.email}</div>
                  <div className="text-xs bg-rose-500/20 text-rose-300 px-2 py-1 rounded">Venció: {new Date(new Date(acc.fecha_activacion || new Date().toISOString()).setMonth(new Date(acc.fecha_activacion || new Date().toISOString()).getMonth() + ((acc as any).duracion_meses || 1))).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={() => handleArchive(acc.id)}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  <Trash2 size={16} /> Archivar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* --- STOCK DASHBOARD (CENTRALITA) --- */}
        {(() => {
          // 1. Calculate Stock
          const stockStats: Record<string, number> = {}
          accounts.forEach(acc => {
            // Normalize service name (simple method: first word or known keywords)
            const lowerService = acc.servicio.toLowerCase()
            let displayService = acc.servicio

            // Grouping keywords
            if (lowerService.includes('netflix')) displayService = 'Netflix'
            else if (lowerService.includes('disney')) displayService = 'Disney+'
            else if (lowerService.includes('max')) displayService = 'Max'
            else if (lowerService.includes('prime') || lowerService.includes('amazon')) displayService = 'Prime Video'
            else if (lowerService.includes('youtube')) displayService = 'YouTube'
            else if (lowerService.includes('spotify')) displayService = 'Spotify'
            else if (lowerService.includes('apple')) displayService = 'Apple TV'
            else if (lowerService.includes('paramount')) displayService = 'Paramount+'
            else if (lowerService.includes('iptv')) displayService = 'IPTV'
            else if (lowerService.includes('crunchyroll')) displayService = 'Crunchyroll'
            else if (lowerService.includes('vix')) displayService = 'Vix'
            else if (lowerService.includes('plex')) displayService = 'Plex'
            else if (lowerService.includes('jellyfin')) displayService = 'Jellyfin'

            const freeCount = acc.perfiles.filter(p => p.estado === 'LIBRE').length
            stockStats[displayService] = (stockStats[displayService] || 0) + freeCount
          })

          // Sort by count
          const sortedStock = Object.entries(stockStats).sort((a, b) => b[1] - a[1]) // High stock first

          if (sortedStock.length === 0) return null

          return (
            <div className="mb-8 p-4 bg-slate-900/40 rounded-3xl border border-white/5 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 px-2">
                <Monitor className="text-violet-400" size={20} />
                Centralita de Stock
              </h2>
              <div className="flex overflow-x-auto gap-4 pb-2 px-2 custom-scrollbar snap-x">
                {sortedStock.map(([serviceName, count]) => {
                  // Icon Logic (Reusing same logic for consistency)
                  const serviceLower = serviceName.toLowerCase()
                  let iconPath = null
                  let scaleClass = ''

                  if (serviceLower.includes('netflix')) { iconPath = '/logos/netflix.png'; scaleClass = 'scale-[1.7]' }
                  else if (serviceLower.includes('disney')) { iconPath = '/logos/disney.png'; scaleClass = 'scale-[1.7]' }
                  else if (serviceLower.includes('max')) iconPath = '/logos/max.png'
                  else if (serviceLower.includes('prime') || serviceLower.includes('amazon')) { iconPath = '/logos/prime.png'; scaleClass = 'scale-[1.8]' }
                  else if (serviceLower.includes('youtube')) { iconPath = '/logos/youtube.png'; scaleClass = 'scale-[1.3]' }
                  else if (serviceLower.includes('spotify')) { iconPath = '/logos/spotify.png'; scaleClass = 'scale-[1.7]' }
                  else if (serviceLower.includes('crunchyroll')) iconPath = '/logos/crunchyroll.png'
                  else if (serviceLower.includes('vix')) iconPath = '/logos/vix.png'
                  else if (serviceLower.includes('plex')) iconPath = '/logos/plex.png'
                  else if (serviceLower.includes('iptv')) { iconPath = '/logos/iptv.png'; scaleClass = 'scale-[1.3]' }
                  else if (serviceLower.includes('apple')) { iconPath = '/logos/apple tv.png'; scaleClass = 'scale-[2.0]' }
                  else if (serviceLower.includes('paramount')) { iconPath = '/logos/paramount.png'; scaleClass = 'scale-[1.7]' }
                  else if (serviceLower.includes('jellyfin')) { iconPath = '/logos/jellyfin.png'; scaleClass = 'scale-[1.9]' }

                  const isLowStock = count < 2

                  return (
                    <div
                      onClick={() => setSearchTerm(serviceName)}
                      key={serviceName}
                      className="glass-panel p-2 md:p-4 rounded-2xl min-w-[100px] md:min-w-[130px] flex flex-col items-center gap-2 border border-white/5 bg-slate-900/60 relative overflow-hidden group snap-center cursor-pointer transition-all hover:bg-slate-800/80 active:scale-95"
                    >
                      {/* Background Glow */}
                      {isLowStock && <div className="absolute inset-0 bg-red-500/10 z-0 animate-pulse"></div>}

                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-800/50 flex items-center justify-center overflow-hidden relative z-10 shadow-inner">
                        {iconPath ? (
                          <img src={iconPath} alt={serviceName} className={`w-full h-full object-cover ${scaleClass}`} />
                        ) : (
                          <Monitor size={20} className="text-slate-400" />
                        )}
                      </div>
                      <div className="text-center z-10 w-full">
                        <div className={`text-lg md:text-2xl font-black leading-none mb-1 ${isLowStock ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.3)]' : 'text-white'}`}>
                          {count}
                        </div>
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider font-bold text-slate-400 truncate w-full px-1">
                          {serviceName}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Filters */}
        {/* CONTROLS BAR: SEARCH + FLTERS + VIEW TOGGLE */}
        <div className="flex flex-col md:flex-row gap-4 justify-start items-start md:items-center mb-6 bg-slate-900/50 p-4 rounded-3xl border border-white/5 backdrop-blur-sm sticky top-2 z-30 shadow-xl">
          {/* 1. Search Bar */}
          <div className="bg-slate-800/50 p-1 rounded-xl flex items-center border border-white/5 w-full max-w-[280px] md:max-w-none md:w-80 transition-all focus-within:border-violet-500/50 focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-violet-500/20 relative">
            <Search size={18} className="text-slate-500 ml-2" />
            <input
              className="bg-transparent border-none outline-none text-white text-sm p-2 w-full placeholder-slate-500 pr-8"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto justify-start">
            {/* New Account Button (Mobile Position) */}
            <button onClick={() => setShowAddModal(true)} className="bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-violet-600/20 active:scale-95 transition-all w-auto whitespace-nowrap order-first md:order-none text-xs md:text-sm">
              <Plus size={18} /> <span className="hidden sm:inline">Nueva</span><span className="inline sm:hidden">Crear</span>
            </button>
            <button onClick={async () => {
              const phone = prompt('Ingresa tu número (Ej: 573001234567) para recibir un recordatorio de prueba:')
              if (phone) {
                toast.info('Enviando...')
                const res = await sendTestReminder(phone)
                if (res.success) toast.success('Enviado. Revisa tu WhatsApp.')
                else toast.error('Error al enviar')
              }
            }} className="bg-slate-800 text-slate-400 hover:text-white px-3 py-2 rounded-xl flex items-center gap-2 border border-white/5 order-last md:order-none text-xs transition-colors" title="Prueba de Bot">
              <Activity size={16} /> <span className="hidden md:inline">Test Bot</span>
            </button>
            {/* 2. Tabs: Renewable vs Disposable */}
            <div className="flex bg-slate-800 p-1 rounded-xl overflow-x-auto max-w-[200px] md:max-w-none">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'ALL' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveTab('RENEWABLE')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'RENEWABLE' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-400 hover:text-white'}`}
              >
                Renovables
              </button>
              <button
                onClick={() => setActiveTab('DISPOSABLE')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'DISPOSABLE' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-400 hover:text-white'}`}
              >
                Desechables
              </button>
              <button
                onClick={() => setActiveTab('ARCHIVED')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ARCHIVED' ? 'bg-slate-600/50 text-slate-300 border border-white/5' : 'text-slate-400 hover:text-white'}`}
              >
                Archivados
              </button>
            </div>

            {/* SORT & GROUP CONTROLS */}
            <div className="flex gap-2 items-center bg-slate-800 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setGroupBy(prev => prev === 'PROVIDER' ? 'SERVICE' : 'PROVIDER')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition"
              >
                {groupBy === 'PROVIDER' ? 'Agrupar: Proveedor' : 'Agrupar: Servicio'}
              </button>
              <div className="w-px h-4 bg-white/10"></div>
              <button
                onClick={() => setSortBy(prev => prev === 'DEFAULT' ? 'AVAILABILITY' : 'DEFAULT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'AVAILABILITY' ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
              >
                {sortBy === 'DEFAULT' ? 'Ordenar: Defecto' : 'Ordenar: Disponibilidad'}
              </button>
            </div>

            {/* 3. View Switch: Cards vs Table */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-white/5">
              <button onClick={() => setViewMode('CARDS')} className={`p-2 rounded-lg transition-colors ${viewMode === 'CARDS' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`} title="Vista Tarjetas">
                <Monitor size={16} />
              </button>
              <button onClick={() => setViewMode('TABLE')} className={`p-2 rounded-lg transition-colors ${viewMode === 'TABLE' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`} title="Vista Tabla">
                <Copy size={16} />
              </button>
            </div>
          </div>
        </div>


        {/* RENDER LOGIC */}
        {(() => {
          // DEBUG: Log filter state
          console.log('Active Tab:', activeTab)
          // FILTERING
          const filteredAccounts = accounts.filter(account => {
            // 1. Tab Filter
            const isDisposable = (account.tipo?.toUpperCase() === 'DESECHABLE') || (account.is_disposable === true)
            // console.log(`ID: ${account.id}, Tipo: ${account.tipo}, IsDisp: ${isDisposable}`) 

            if (activeTab === 'RENEWABLE' && isDisposable) return false
            if (activeTab === 'DISPOSABLE' && !isDisposable) return false
            // If activeTab is 'ALL', we don't return false (we show everything) - Filter Logic Verified

            // 2. Search Filter
            if (searchTerm) {
              const lowerTerm = searchTerm.toLowerCase()
              const searchDigits = searchTerm.replace(/\D/g, '')
              const searchPhoneNoPrefix = (searchDigits.startsWith('57') && searchDigits.length > 9) ? searchDigits.slice(2) : searchDigits

              const matchesService = account.servicio.toLowerCase().includes(lowerTerm)
              const matchesEmail = account.email.toLowerCase().includes(lowerTerm)
              const matchesProfile = account.perfiles.some(p => {
                // Name match
                if (p.nombre_perfil.toLowerCase().includes(lowerTerm)) return true
                if (p.cliente?.nombre.toLowerCase().includes(lowerTerm)) return true

                // Smart Phone Match
                const clientPhone = p.cliente?.celular || ''
                if (clientPhone.includes(lowerTerm)) return true // Basic match

                // Normalized match
                if (searchPhoneNoPrefix.length >= 3) {
                  const clientDigits = clientPhone.replace(/\D/g, '')
                  if (clientDigits.includes(searchPhoneNoPrefix)) return true
                }

                return false
              })

              if (!matchesService && !matchesEmail && !matchesProfile) return false
            }

            return true
          })

          // SORTING
          const sortedAccounts = [...filteredAccounts].sort((a, b) => {
            if (sortBy === 'AVAILABILITY') {
              const freeA = a.perfiles.filter(p => p.estado === 'LIBRE').length
              const freeB = b.perfiles.filter(p => p.estado === 'LIBRE').length
              // Descending: More free profiles first
              if (freeB !== freeA) return freeB - freeA
            }
            // Default fallback (e.g. by ID or creation)
            return b.id - a.id
          })


          // GROUPING
          const groupedAccounts = sortedAccounts.reduce((acc, account) => {
            const key = groupBy === 'PROVIDER'
              ? (account.provider?.nombre || 'Sin Proveedor')
              : account.servicio // Group by Service Name

            if (!acc[key]) acc[key] = []
            acc[key].push(account)
            return acc
          }, {} as Record<string, typeof accounts>)

          if (filteredAccounts.length === 0) {
            return <div className="text-center p-12 text-slate-500">No se encontraron cuentas con estos filtros.</div>
          }

          // VIEW: CARDS (HORIZONTAL ROWS BY PROVIDER)
          // VIEW: CARDS (HORIZONTAL ROWS BY PROVIDER/SERVICE)
          if (viewMode === 'CARDS') {
            return (
              <div className="space-y-8 pb-32">
                {Object.entries(groupedAccounts).map(([groupName, groupAccounts]) => (
                  <div key={groupName} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3 px-2">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {groupName}
                        <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{groupAccounts.length}</span>
                      </h2>
                      <div className="h-px bg-white/10 flex-1"></div>
                    </div>

                    {/* HORIZONTAL SCROLL CONTAINER */}
                    <div className="flex overflow-x-auto gap-6 pb-6 px-2 custom-scrollbar snap-x">
                      {groupAccounts.map(account => (
                        <div key={account.id} className="min-w-[320px] md:min-w-[400px] max-w-[400px] snap-center">
                          {/* EXISTING CARD COMPONENT INLINED */}
                          <div className="glass-panel p-5 rounded-3xl flex flex-col h-full group hover:border-violet-500/30 transition-all duration-300 relative border border-white/5 bg-slate-900/50">
                            {/* Account Header */}
                            <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-4">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 flex items-center justify-center text-violet-400 shadow-inner border border-white/5 shrink-0 overflow-hidden relative">
                                  {(() => {
                                    // Icon mapping
                                    const serviceLower = account.servicio.toLowerCase()
                                    let iconPath = null

                                    if (serviceLower.includes('netflix')) iconPath = '/logos/netflix.png'
                                    else if (serviceLower.includes('disney')) iconPath = '/logos/disney.png'
                                    else if (serviceLower.includes('max')) iconPath = '/logos/max.png'
                                    else if (serviceLower.includes('prime') || serviceLower.includes('amazon')) iconPath = '/logos/prime.png'
                                    else if (serviceLower.includes('youtube')) iconPath = '/logos/youtube.png'
                                    else if (serviceLower.includes('spotify')) iconPath = '/logos/spotify.png'
                                    else if (serviceLower.includes('crunchyroll')) iconPath = '/logos/crunchyroll.png'
                                    else if (serviceLower.includes('vix')) iconPath = '/logos/vix.png'
                                    else if (serviceLower.includes('plex')) iconPath = '/logos/plex.png'
                                    else if (serviceLower.includes('iptv')) iconPath = '/logos/iptv.png'
                                    else if (serviceLower.includes('apple')) iconPath = '/logos/apple tv.png'
                                    else if (serviceLower.includes('paramount')) iconPath = '/logos/paramount.png'
                                    else if (serviceLower.includes('jellyfin')) iconPath = '/logos/jellyfin.png'
                                    else if (serviceLower.includes('chat')) iconPath = '/logos/chatgpt.png'
                                    else if (serviceLower.includes('capcut')) iconPath = '/logos/CapCut.png'
                                    else if (serviceLower.includes('canva')) iconPath = '/logos/Canva.png'

                                    if (iconPath) {
                                      let scaleClass = ''
                                      if (serviceLower.includes('apple')) scaleClass = 'scale-[2.0]'
                                      else if (serviceLower.includes('netflix')) scaleClass = 'scale-[1.7]'
                                      else if (serviceLower.includes('disney')) scaleClass = 'scale-[1.7]'
                                      else if (serviceLower.includes('paramount')) scaleClass = 'scale-[1.7]'
                                      else if (serviceLower.includes('spotify')) scaleClass = 'scale-[1.7]'
                                      else if (serviceLower.includes('prime') || serviceLower.includes('amazon')) scaleClass = 'scale-[1.8]'
                                      else if (serviceLower.includes('iptv')) scaleClass = 'scale-[1.3]'
                                      else if (serviceLower.includes('youtube')) scaleClass = 'scale-[1.3]'
                                      else if (serviceLower.includes('jellyfin')) scaleClass = 'scale-[1.9]' // Increased scale for Jellyfin

                                      return <img src={iconPath} alt={account.servicio} loading="lazy" className={`w-full h-full object-cover ${scaleClass}`} />
                                    }
                                    return <Monitor size={24} />
                                  })()}
                                </div>
                                <div className="overflow-hidden min-w-0 w-full">
                                  {/* Stale Inventory Alert */}
                                  {(() => {
                                    if (!(account as any).is_disposable) return null
                                    const activationDateStr = (account as any).fecha_activacion || (account as any).activationDate
                                    if (!activationDateStr) return null

                                    const diffTime = Math.abs(new Date().getTime() - new Date(activationDateStr).getTime())
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                                    const isStale = diffDays > 10 && account.perfiles.some(p => p.estado === 'LIBRE')

                                    if (isStale) return (
                                      <div className="mb-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5 flex items-center justify-between">
                                        <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                                          <Clock size={10} /> Hace {diffDays} días
                                        </span>
                                        <span className="text-[9px] text-amber-400 uppercase tracking-wider">Rotar</span>
                                      </div>
                                    )
                                    return null
                                  })()}
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-white leading-tight truncate">
                                      {account.servicio}
                                      <span className="text-[10px] ml-2 opacity-50 font-normal">
                                        (Age: {Math.ceil(Math.abs(new Date().getTime() - new Date((account as any).fecha_activacion || (account as any).createdAt).getTime()) / (86400000))}d
                                        | D:{(account as any).is_disposable ? 'Y' : 'N'})
                                      </span>
                                    </h3>
                                    <button
                                      onClick={() => {
                                        setEditingAccount({
                                          id: account.id,
                                          servicio: account.servicio,
                                          email: account.email,
                                          password: account.password,
                                          providerId: account.provider?.id,
                                          dia_corte: (account as any).dia_corte,
                                          is_disposable: (account as any).is_disposable,
                                          duracion_meses: (account as any).duracion_meses || 1,
                                          fecha_activacion: (account as any).fecha_activacion ? new Date((account as any).fecha_activacion).toISOString().split('T')[0] : ''
                                        })
                                        setShowEditAccountModal(true)
                                        // Initialize editing profiles
                                        setEditingProfiles(account.perfiles.map(p => ({ id: p.id, name: p.nombre_perfil, pin: p.pin || '' })))
                                      }}
                                      className="p-1 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition"
                                      title="Editar Cuenta"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                    </button>
                                  </div>
                                  <div className="flex flex-col gap-1 mt-1">
                                    <button onClick={() => copyToClipboard(account.email)} className="text-xs text-slate-400 cursor-pointer hover:text-white flex items-center gap-1 transition-colors text-left">
                                      <span className="truncate max-w-[150px]">{account.email}</span> <Copy size={10} />
                                    </button>
                                    <button onClick={() => copyToClipboard(account.password)} className="text-xs text-slate-400 cursor-pointer hover:text-white flex items-center gap-1 transition-colors text-left">
                                      <span className="font-mono">••••••</span> <Copy size={10} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider ${account.perfiles.filter(p => p.estado === 'LIBRE').length > 0
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500 border border-white/5'
                                }`}>
                                {account.perfiles.filter(p => p.estado === 'LIBRE').length} Libres
                              </div>
                            </div>

                            {/* Profiles Grid - FORCED SINGLE COLUMN */}
                            <div className="grid grid-cols-1 gap-3 flex-1 content-start">
                              {account.perfiles.map(profile => (
                                <ProfileCard
                                  key={profile.id}
                                  profile={profile}
                                  isSelected={selectedItems.some(i => i.profileId === profile.id)}
                                  onToggle={() => toggleSelection(profile, account.servicio, account.id)}
                                  onRotate={() => handleRotate(profile.id, profile.estado)}
                                  // Individual Profile Actions
                                  onReportWarranty={() => handleProfileStatus(profile.id, 'GARANTIA')}
                                  onRevive={() => handleRevive(profile.id)}
                                  onSell={() => handleOpenSell(profile.id, account.servicio)}
                                  onAssign={() => handleOpenAssign(profile.id)}
                                  onMigrate={() => {
                                    setProfileToMigrate({
                                      id: profile.id,
                                      serviceName: account.servicio,
                                      accountId: account.id,
                                      profileName: profile.nombre_perfil
                                    })
                                    setShowMigrateModal(true)
                                  }}
                                />
                              ))}
                            </div>

                            { /* Full Account Sale Button - NOW SELECTION */}
                            <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
                              <button
                                onClick={() => toggleFullAccountSelection(account)}
                                className={`text-xs font-bold flex items-center gap-1 transition-colors ${selectedItems.some(i => i.accountId === account.id && i.type === 'FULL_ACCOUNT')
                                  ? 'text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-lg'
                                  : 'text-violet-400 hover:text-white'
                                  }`}
                              >
                                {selectedItems.some(i => i.accountId === account.id && i.type === 'FULL_ACCOUNT') ? (
                                  <><Check size={14} /> Seleccionada (Completa)</>
                                ) : (
                                  <><DollarSign size={14} /> Seleccionar Cuenta Completa</>
                                )}
                              </button>

                              {/* Replace Button (Only if has warranties or occupied? - User said "cuenta caida la dejo ahi... hasta que me den garantia... uso boton reponer") */}
                              <button
                                onClick={() => handleOpenReplace(account)}
                                className="text-xs font-bold text-emerald-400 hover:text-white flex items-center gap-1 transition-colors ml-4"
                              >
                                <RefreshCw size={14} /> Reponer Cuenta
                              </button>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          } else {
            // VIEW: TABLE
            return (
              <div className="bg-slate-900/50 rounded-3xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-xs font-bold tracking-wider border-b border-white/5">
                      <tr>
                        <th className="p-4 pl-6">Servicio</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Proveedor</th>
                        <th className="p-4">Libres</th>
                        <th className="p-4 text-right pr-6">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredAccounts.map(account => (
                        <tr key={account.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-6 font-medium text-white">{account.servicio}</td>
                          <td className="p-4 text-slate-300 font-mono text-xs">{account.email}</td>
                          <td className="p-4 text-slate-400">
                            {account.provider?.nombre || '-'}
                            <span className="text-[10px] ml-2 opacity-50 block">
                              Age: {Math.ceil(Math.abs(new Date().getTime() - new Date((account as any).fecha_activacion || (account as any).createdAt).getTime()) / (86400000))}d
                              | Disp: {(account as any).is_disposable ? 'Y' : 'N'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${account.perfiles.filter(p => p.estado === 'LIBRE').length > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500'}`}>
                              {account.perfiles.filter(p => p.estado === 'LIBRE').length}
                            </span>
                          </td>
                          <td className="p-4 text-right pr-6">
                            <button
                              onClick={() => {
                                setEditingAccount({
                                  id: account.id,
                                  servicio: account.servicio,
                                  email: account.email,
                                  password: account.password,
                                  providerId: account.provider?.id,
                                  dia_corte: (account as any).dia_corte,
                                  is_disposable: (account as any).is_disposable,
                                  fecha_activacion: (account as any).fecha_activacion ? new Date((account as any).fecha_activacion).toISOString().split('T')[0] : ''
                                })
                                setShowEditAccountModal(true)
                                setEditingProfiles(account.perfiles.map(p => ({ id: p.id, name: p.nombre_perfil, pin: p.pin || '' })))
                              }}
                              className="text-violet-400 hover:text-white font-medium"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        })()}
      </div>

      {/* ADD ACCOUNT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 text-left animate-in fade-in">
          <div className="glass-panel p-5 md:p-6 rounded-3xl w-full max-w-md border border-white/10 shadow-2xl bg-slate-900 max-h-[85vh] flex flex-col">
            <h3 className="text-xl font-bold text-white mb-4 flex-shrink-0">Agregar Nueva Cuenta</h3>

            <div className="space-y-4 mb-6 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {/* Provider Selection (Opcional) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-slate-400">Proveedor (Opcional)</label>
                  <button onClick={() => setIsCreatingProvider(!isCreatingProvider)} className="text-xs text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1">
                    {isCreatingProvider ? 'Cancelar' : <><Plus size={10} /> Nuevo</>}
                  </button>
                </div>
                {isCreatingProvider ? (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-violet-500"
                      placeholder="Nombre del nuevo proveedor"
                      value={newProviderName}
                      onChange={e => setNewProviderName(e.target.value)}
                    />
                    <button
                      onClick={async () => {
                        if (!newProviderName) return toast.error("Escribe un nombre")
                        const res = await createProvider(newProviderName)
                        if (res.success && res.provider) {
                          setProviders([...providers, res.provider])
                          setNewAccount({ ...newAccount, providerId: res.provider.id })
                          setIsCreatingProvider(false)
                          setNewProviderName("")
                          toast.success("Proveedor creado")
                        } else {
                          toast.error("Error al crear proveedor")
                        }
                      }}
                      className="bg-violet-600 hover:bg-violet-500 text-white px-4 rounded-xl font-bold"
                    >
                      Crear
                    </button>
                  </div>
                ) : (
                  <select
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none appearance-none"
                    value={newAccount.providerId || ''}
                    onChange={e => setNewAccount({ ...newAccount, providerId: e.target.value ? Number(e.target.value) : undefined })}
                  >
                    <option value="">Ninguno (Propio)</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                )}

                {/* Payment Day Input - Only if provider is selected AND NOT DISPOSABLE */}
                {newAccount.providerId && !newAccount.is_disposable && (
                  <div className="mt-2">
                    <label className="text-xs text-slate-400 block mb-1">Día de Corte (Pago al Proveedor)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Día del mes (Ej: 15)"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                      value={newAccount.dia_corte || ''}
                      onChange={e => setNewAccount({ ...newAccount, dia_corte: e.target.value ? parseInt(e.target.value.replace(/\D/g, '')) || undefined : undefined })}
                    />
                  </div>
                )}
              </div >

              {/* Service Selection */}
              < div >
                <label className="text-xs text-slate-400 block mb-1">Servicio</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-violet-500 appearance-none"
                  value={isCustomService ? 'Otro' : newAccount.service}
                  onChange={e => {
                    const svc = e.target.value
                    if (svc === 'Otro') {
                      setIsCustomService(true)
                      setNewAccount(prev => ({ ...prev, service: '' }))
                    } else {
                      setIsCustomService(false)
                      setNewAccount({ ...newAccount, service: svc })
                    }

                    // Auto-config defaults
                    if (svc === 'Netflix') setNewAccount(prev => ({ ...prev, service: svc, profilesCount: 5 }))
                    if (svc === 'Disney+') setNewAccount(prev => ({ ...prev, service: svc, profilesCount: 7 }))
                    if (svc === 'Max') setNewAccount(prev => ({ ...prev, service: svc, profilesCount: 5 }))
                    if (svc === 'Prime Video') setNewAccount(prev => ({ ...prev, service: svc, profilesCount: 6 }))
                    if (svc === 'Spotify' || svc === 'YouTube') setNewAccount(prev => ({ ...prev, service: svc, profilesCount: 1 }))
                  }}
                >
                  <option value="" disabled>Seleccionar Servicio...</option>
                  <option value="Netflix">Netflix</option>
                  <option value="Disney+">Disney+</option>
                  <option value="Max">Max</option>
                  <option value="Prime Video">Prime Video</option>
                  <option value="Spotify">Spotify</option>
                  <option value="YouTube Premium">YouTube Premium</option>
                  <option value="Crunchyroll">Crunchyroll</option>
                  <option value="Paramount+">Paramount+</option>
                  <option value="Vix+">Vix+</option>
                  <option value="Apple TV">Apple TV</option>
                  <option value="Plex">Plex</option>
                  <option value="IPTV">IPTV</option>
                  <option value="Jellyfin">Jellyfin</option>
                  <option value="Chat GPT">Chat GPT</option>
                  <option value="CapCut">CapCut</option>
                  <option value="Canva">Canva</option>
                  <option value="Otro">Otro...</option>
                </select>
                {
                  isCustomService && (
                    <input
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none mt-2"
                      placeholder="Escribe el nombre del servicio"
                      value={newAccount.service}
                      onChange={(e) => setNewAccount({ ...newAccount, service: e.target.value })}
                      autoFocus
                    />
                  )
                }
              </div>

              {/* Basic Creds */}
              < div >
                <label className="text-xs text-slate-400 block mb-1">Email / Usuario</label>
                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-violet-500"
                  value={newAccount.email} onChange={e => setNewAccount({ ...newAccount, email: e.target.value })} placeholder="correo@ejemplo.com" />
              </div >
              <div>
                <label className="text-xs text-slate-400 block mb-1">Contraseña</label>
                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-violet-500"
                  value={newAccount.password} onChange={e => setNewAccount({ ...newAccount, password: e.target.value })} placeholder="******" />
              </div>


              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <input
                  type="checkbox"
                  id="is_disposable"
                  className="w-5 h-5 rounded border border-white/20 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  checked={newAccount.is_disposable}
                  onChange={(e) => setNewAccount({ ...newAccount, is_disposable: e.target.checked })}
                />
                <div className="flex-1">
                  <label htmlFor="is_disposable" className="text-sm font-medium text-slate-300 block mb-1">
                    ¿Es Cuenta Desechable?
                  </label>

                  {newAccount.is_disposable && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                          type="date"
                          className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-xs text-white outline-none"
                          value={newAccount.activationDate}
                          onChange={(e) => setNewAccount({ ...newAccount, activationDate: e.target.value })}
                        />
                        <span className="text-[10px] text-slate-500">Fecha de Activación/Compra</span>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Duración (Meses)</label>
                        <select
                          className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-xs text-white outline-none w-full"
                          value={newAccount.months_duration || 1}
                          onChange={e => setNewAccount({ ...newAccount, months_duration: Number(e.target.value) })}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <option key={m} value={m}>{m} Mes{m > 1 ? 'es' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-bold text-white">Configuración de Perfiles</label>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">¿Usar PIN?</label>
                    <input
                      type="checkbox"
                      checked={usePin}
                      onChange={(e) => setUsePin(e.target.checked)}
                      className="w-4 h-4 accent-violet-600 rounded"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-slate-400 block mb-1">Cantidad de Perfiles/Cupos</label>
                  <select
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2 text-white outline-none"
                    value={newAccount.profilesCount}
                    onChange={e => setNewAccount({ ...newAccount, profilesCount: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Perfil' : 'Perfiles'}</option>)}
                  </select>
                </div>

                {/* Dynamic Inputs */}
                <div className="space-y-3">
                  {Array.from({ length: newAccount.profilesCount }).map((_, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-sm text-white placeholder-slate-600"
                        placeholder={`Nombre Perfil ${i + 1}`}
                        value={profileDetails[i]?.name || `Perfil ${i + 1}`}
                        onChange={(e) => {
                          const newDetails = [...profileDetails]
                          if (!newDetails[i]) newDetails[i] = { name: `Perfil ${i + 1}`, pin: '' }
                          newDetails[i] = { ...newDetails[i], name: e.target.value }
                          setProfileDetails(newDetails)
                        }}
                      />
                      {usePin && (
                        <input
                          className="w-20 bg-slate-950 border border-white/10 rounded-lg p-2 text-sm text-white placeholder-slate-600 text-center"
                          placeholder="PIN"
                          maxLength={4}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={profileDetails[i]?.pin || ''}
                          onChange={(e) => {
                            const newDetails = [...profileDetails]
                            if (!newDetails[i]) newDetails[i] = { name: `Perfil ${i + 1}`, pin: '' }
                            newDetails[i] = { ...newDetails[i], pin: e.target.value }
                            setProfileDetails(newDetails)
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div >

            <div className="flex gap-3 flex-shrink-0 pt-2 border-t border-white/5">
              <button onClick={() => setShowAddModal(false)} className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium">Cancelar</button>
              <button onClick={handleCreateAccount} className="flex-1 p-3 rounded-xl bg-violet-600 text-white hover:bg-violet-500 font-bold shadow-lg shadow-violet-600/20">Crear Cuenta</button>
            </div>
          </div >
        </div >
      )
      }

      {/* EDIT ACCOUNT MODAL */}
      {showEditAccountModal && editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 text-left animate-in fade-in">
          <div className="glass-panel p-5 md:p-6 rounded-3xl w-full max-w-md border border-white/10 shadow-2xl bg-slate-900 max-h-[85vh] flex flex-col">
            <h3 className="text-xl font-bold text-white mb-4 flex-shrink-0">Editar Cuenta</h3>

            <div className="space-y-4 mb-6 overflow-y-auto flex-1 pr-2 custom-scrollbar">

              {/* Service Display (Read Only) */}
              <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl mb-2">
                <label className="text-xs text-violet-400 block mb-1 font-bold">Servicio</label>
                <div className="text-white font-bold">{editingAccount.servicio}</div>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Proveedor (Opcional)</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none appearance-none"
                  value={editingAccount.providerId || ''}
                  onChange={e => setEditingAccount({ ...editingAccount, providerId: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">Ninguno (Propio)</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>

                {/* Payment Day Input - Only if provider is selected AND NOT DISPOSABLE */}
                {editingAccount.providerId && !editingAccount.is_disposable && (
                  <div className="mt-2">
                    <label className="text-xs text-slate-400 block mb-1">Día de Corte (Pago al Proveedor)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Día del mes (Ej: 15)"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                      value={editingAccount.dia_corte || ''}
                      onChange={e => setEditingAccount({ ...editingAccount, dia_corte: e.target.value ? parseInt(e.target.value.replace(/\D/g, '')) || undefined : undefined })}
                    />
                  </div>
                )}
              </div >

              {/* Basic Creds */}
              < div >
                <label className="text-xs text-slate-400 block mb-1">Email / Usuario</label>
                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-violet-500"
                  value={editingAccount.email} onChange={e => setEditingAccount({ ...editingAccount, email: e.target.value })} placeholder="correo@ejemplo.com" />
              </div >
              <div>
                <label className="text-xs text-slate-400 block mb-1">Contraseña</label>
                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-violet-500"
                  value={editingAccount.password} onChange={e => setEditingAccount({ ...editingAccount, password: e.target.value })} placeholder="******" />
              </div>


              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <input
                  type="checkbox"
                  id="edit_is_disposable"
                  className="w-5 h-5 rounded border border-white/20 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  checked={!!editingAccount.is_disposable}
                  onChange={(e) => setEditingAccount({ ...editingAccount, is_disposable: e.target.checked })}
                />
                <div className="flex-1">
                  <label htmlFor="edit_is_disposable" className="text-sm font-medium text-slate-300 block mb-1">
                    ¿Es Cuenta Desechable?
                  </label>

                  {editingAccount.is_disposable && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                          type="date"
                          className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-xs text-white outline-none"
                          value={editingAccount.fecha_activacion}
                          onChange={(e) => setEditingAccount({ ...editingAccount, fecha_activacion: e.target.value })}
                        />
                        <span className="text-[10px] text-slate-500">Fecha de Activación/Compra</span>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Duración (Meses)</label>
                        <select
                          className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-xs text-white outline-none w-full"
                          value={editingAccount.duracion_meses || 1}
                          onChange={e => setEditingAccount({ ...editingAccount, duracion_meses: Number(e.target.value) })}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <option key={m} value={m}>{m} Mes{m > 1 ? 'es' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Editor */}
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-bold text-white">Perfiles</label>
                  <button
                    onClick={() => setEditingProfiles([...editingProfiles, { name: '', pin: '' }])}
                    className="text-[10px] bg-violet-600/20 text-violet-400 border border-violet-500/30 px-2 py-1 rounded-lg hover:bg-violet-600 hover:text-white transition"
                  >
                    + Agregar Perfil
                  </button>
                </div>
                <div className="space-y-3">
                  {editingProfiles.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-sm text-white placeholder-slate-600"
                        placeholder={`Nombre Perfil`}
                        value={p.name}
                        onChange={(e) => {
                          const newProfiles = [...editingProfiles]
                          newProfiles[i] = { ...newProfiles[i], name: e.target.value }
                          setEditingProfiles(newProfiles)
                        }}
                      />

                      <input
                        className="w-20 bg-slate-950 border border-white/10 rounded-lg p-2 text-sm text-white placeholder-slate-600 text-center"
                        placeholder="PIN"
                        maxLength={4}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={p.pin}
                        onChange={(e) => {
                          const newProfiles = [...editingProfiles]
                          newProfiles[i] = { ...newProfiles[i], pin: e.target.value }
                          setEditingProfiles(newProfiles)
                        }}
                      />
                      <button
                        onClick={() => {
                          if (confirm('¿Eliminar este perfil?')) {
                            const newProfiles = editingProfiles.filter((_, idx) => idx !== i)
                            setEditingProfiles(newProfiles)
                          }
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div >

            <div className="flex flex-col gap-3 flex-shrink-0 pt-2 border-t border-white/5">
              <div className="flex gap-3">
                <button onClick={() => setShowEditAccountModal(false)} className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium">Cancelar</button>
                <button onClick={handleUpdateAccount} className="flex-1 p-3 rounded-xl bg-violet-600 text-white hover:bg-violet-500 font-bold shadow-lg shadow-violet-600/20">Guardar Cambios</button>
              </div>
              <button
                onClick={handleDeleteAccount}
                className="w-full p-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-lg transition border border-rose-500/20 flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Eliminar Cuenta Permanentemente
              </button>
            </div>
          </div >
        </div >
      )
      }

      {/* SELL MODAL (ADAPTIVE: SINGLE OR COMBO) */}
      {
        showSellModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in">
            <div
              className={`glass-panel p-6 rounded-3xl w-full ${selectedItems.length > 1 ? 'max-w-2xl' : 'max-w-sm'} border border-white/10 shadow-2xl bg-slate-900 transition-all`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    {selectedItems.length > 1 ? 'Venta de Combo' : 'Venta Individual'}
                    {selectedItems.length > 1 && <span className="bg-violet-500/20 text-violet-300 text-xs px-2 py-1 rounded-full">{selectedItems.length} ítems</span>}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">Completa los datos del cliente para finalizar.</p>
                </div>
                <button onClick={() => setShowSellModal(false)} className="p-2 hover:bg-white/10 rounded-full transition"><Plus className="rotate-45" /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT: CLIENT INFO */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Celular Cliente (ID)</label>
                    <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                      value={saleData.phone} onChange={e => handlePhoneChange(e.target.value)} placeholder="3001234567" autoFocus />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Nombre Cliente</label>
                    <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                      value={saleData.name} onChange={e => setSaleData({ ...saleData, name: e.target.value })} placeholder="Juan Pérez" />
                  </div>

                  {/* NEW: Date and Duration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Fecha Venta</label>
                      <input
                        type="date"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                        value={saleData.date}
                        onChange={e => setSaleData({ ...saleData, date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Duración</label>
                      <select
                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                        value={saleData.months}
                        onChange={e => setSaleData({ ...saleData, months: parseInt(e.target.value) })}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                          <option key={m} value={m}>{m} Mes{m > 1 ? 'es' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Método de Pago</label>
                    <select
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                      value={saleData.paymentMethod}
                      onChange={e => setSaleData({ ...saleData, paymentMethod: e.target.value as any })}
                    >
                      <option value="NEQUI">Nequi</option>
                      <option value="BANCOLOMBIA">Bancolombia</option>
                      <option value="DAVIPLATA">Daviplata</option>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="USDT">USDT</option>
                    </select>
                  </div>
                </div>

                {/* RIGHT: ITEMS & PRICING */}
                <div className="space-y-4">
                  {selectedItems.length > 1 ? (
                    // COMBO VIEW
                    <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5 space-y-3">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ítems Seleccionados</div>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                        {(selectedItems.length > 0 ? selectedItems : [{ profileId: selectedProfileId, serviceName: '(Individual)', price: 0 }]).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-slate-300 truncate max-w-[150px]">{item.serviceName}</span>
                            {/* Proportional Price Input (Optional Advanced) - For now just text or auto-calc display */}
                          </div>
                        ))}
                      </div>
                      <div className="h-px bg-white/10 my-2"></div>
                      <div>
                        <label className="text-xs text-violet-400 font-bold block mb-1">PRECIO TOTAL DEL COMBO</label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-slate-500">$</span>
                          <input
                            className="w-full bg-slate-900 border border-violet-500/30 rounded-xl p-3 pl-6 text-white font-bold text-lg focus:border-violet-500 outline-none"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={saleData.price}
                            onChange={e => setSaleData({ ...saleData, price: e.target.value.replace(/\D/g, '') })}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">El valor se dividirá proporcionalmente en los reportes.</p>
                      </div>
                    </div>
                  ) : (
                    // SINGLE VIEW
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Precio Venta</label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-500">$</span>
                        <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 pl-6 text-white focus:border-violet-500 outline-none font-bold text-lg"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={saleData.price}
                          onChange={e => setSaleData({ ...saleData, price: e.target.value.replace(/\D/g, '') })} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowSellModal(false)} className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition">Cancelar</button>
                <button
                  onClick={handleSell}
                  disabled={isSubmitting}
                  className={`flex-1 p-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold shadow-lg shadow-emerald-600/20 transition hover:scale-105 flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? <span className="animate-spin">⌛</span> : <DollarSign size={18} />}
                  {isSubmitting ? 'Procesando...' : 'Confirmar Venta'}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ASSIGN MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 text-left">
          <div
            className="glass-panel p-6 rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-2">Asignar Manualmente</h3>
            <p className="text-xs text-slate-400 mb-4">Vincula este perfil a un cliente existente con su fecha de vencimiento actual.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nombre Cliente</label>
                <div className="relative">
                  <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                    value={assignData.name}
                    onChange={e => handleClientSearch(e.target.value)}
                    placeholder="Buscar cliente..."
                    autoFocus
                  />
                  {clientSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-slate-900 border border-white/10 rounded-xl mt-1 max-h-40 overflow-y-auto z-50 shadow-xl">
                      {clientSearchResults.map((client) => (
                        <button key={client.celular} onClick={() => selectClient(client)}
                          className="w-full text-left p-2 hover:bg-white/5 text-sm flex flex-col border-b border-white/5 last:border-0"
                        >
                          <span className="font-bold text-white">{client.nombre}</span>
                          <span className="text-xs text-slate-400">{client.celular}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Celular Cliente</label>
                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                  value={assignData.phone} onChange={e => setAssignData({ ...assignData, phone: e.target.value })} placeholder="3001234567" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Inicio (Venta)</label>
                  <input type="date" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                    value={assignData.startDate} onChange={e => setAssignData({ ...assignData, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Duración (Meses)</label>
                  <select
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                    value={assignData.months}
                    onChange={e => setAssignData({ ...assignData, months: parseInt(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <option key={m} value={m}>{m} Mes{m > 1 ? 'es' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium">Cancelar</button>
              <button onClick={handleAssign} className="flex-1 p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/20">Asignar Cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* REPLACE MODAL */}
      {showReplaceModal && replacingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in">
          <div
            className="glass-panel p-6 rounded-3xl w-full max-w-sm border border-white/10 shadow-2xl bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">Reponer Cuenta</h3>
            <p className="text-xs text-slate-400 mb-4">Ingresa los datos de la cuenta de reemplazo. Los perfiles se mantendrán libres.</p>

            <div className="space-y-3">
              <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                placeholder="Nuevo Email" value={replaceData.email} onChange={e => setReplaceData({ ...replaceData, email: e.target.value })} />
              <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                placeholder="Nueva Contraseña" value={replaceData.password} onChange={e => setReplaceData({ ...replaceData, password: e.target.value })} />
              <input type="date" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                value={replaceData.date} onChange={e => setReplaceData({ ...replaceData, date: e.target.value })} />
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
              <button onClick={() => setShowReplaceModal(false)} className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300">Cancelar</button>
              <button onClick={handleReplaceSubmit} className="flex-1 p-3 rounded-xl bg-emerald-600 text-white font-bold">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MIGRATE MODAL */}
      {showMigrateModal && profileToMigrate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in">
          <div
            className="glass-panel p-6 rounded-3xl w-full max-w-sm border border-white/10 shadow-2xl bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-2">Migrar Cliente</h3>
            <div className="bg-slate-950 p-3 rounded-xl border border-white/5 mb-4">
              <p className="text-xs text-slate-400">Desde: <span className="text-white font-bold">{profileToMigrate.profileName}</span> ({profileToMigrate.serviceName})</p>
            </div>

            <p className="text-xs text-slate-400 mb-2">Selecciona la razón de la migración:</p>
            <div className="space-y-2 mb-4">
              {[
                { id: 'FALLA_PIN', label: 'Falla PIN / Pantalla' },
                { id: 'CAIDA_PAGO', label: 'Caída de Cuenta (Garantía)' },
                { id: 'MES_FINALIZADO', label: 'Mes Finalizado (Renovación Manual)' },
                { id: 'OTRO', label: 'Otro / Cambio Voluntario' }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => setMigrationReason(r.id as any)}
                  className={`w-full p-2 rounded-lg text-xs font-bold border transition-colors ${migrationReason === r.id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-400 mb-2">Selecciona el perfil DESTINO (Libre):</p>
            <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2 mb-4">
              {accounts
                .filter(a => a.servicio === profileToMigrate.serviceName && a.id !== profileToMigrate.accountId) // Same service, different account
                .flatMap(a => a.perfiles.filter(p => p.estado === 'LIBRE').map(p => ({ ...p, accountEmail: a.email })))
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => setTargetProfileId(p.id)}
                    className={`w-full p-2 rounded-lg text-left text-xs border transition-colors ${targetProfileId === p.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-white/5'}`}
                  >
                    <span className="font-bold">{p.nombre_perfil}</span>
                    <span className="block text-[10px] opacity-50">{p.accountEmail}</span>
                  </button>
                ))
              }
              {accounts.filter(a => a.servicio === profileToMigrate.serviceName && a.id !== profileToMigrate.accountId && a.perfiles.some(p => p.estado === 'LIBRE')).length === 0 && (
                <div className="text-center text-xs text-slate-500 py-4">No hay perfiles libres disponibles en otras cuentas.</div>
              )}
            </div>

            <div className="flex gap-3 mt-4 pt-4 border-t border-white/5">
              <button onClick={() => setShowMigrateModal(false)} className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300">Cancelar</button>
              <button
                onClick={async () => {
                  if (!targetProfileId) return toast.error("Selecciona un perfil destino")
                  try {
                    const res = await migrateProfile(profileToMigrate.id, targetProfileId, migrationReason)
                    if (res.success) {
                      toast.success("Migración Exitosa")
                      setShowMigrateModal(false)
                      fetchInventory()

                      // Generate Migration Message
                      const targetAccount = accounts.find(a => a.perfiles.some(p => p.id === targetProfileId))
                      const targetProfile = targetAccount?.perfiles.find(p => p.id === targetProfileId)

                      if (targetAccount && targetProfile) {
                        const msg = MessageGenerator.generate('MIGRATION', {
                          clientName: 'Cliente', // Ideally fetch from DB or previous profile, simplified
                          service: profileToMigrate.serviceName,
                          email: targetAccount.email,
                          password: targetAccount.password,
                          profileName: targetProfile.nombre_perfil,
                          pin: targetProfile.pin,
                          reason: migrationReason
                        })
                        setSuccessData({
                          message: msg,
                          clientName: 'Migración',
                          service: profileToMigrate.serviceName,
                          price: 0,
                          date: new Date().toLocaleDateString(),
                          paymentMethod: 'TRANSFERENCIA', // Irrelevant for migration
                          months: 1
                        })
                        setShowSuccessModal(true)
                      }

                    } else {
                      toast.error("Error: " + res.error)
                    }
                  } catch (e) {
                    console.error(e)
                    toast.error("Error de servidor")
                  }
                }}
                disabled={!targetProfileId}
                className="flex-1 p-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in zoom-in-95">
          <div
            className="glass-panel p-6 rounded-3xl w-full max-w-md border border-white/10 shadow-2xl bg-slate-900 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <Check size={32} />
              </div>
              <h3 className="text-2xl font-bold text-white">¡Venta Exitosa!</h3>
              <div className="flex items-center justify-center gap-2 mt-1">
                <p className="text-slate-400 text-sm">El servicio ha sido activado correctament.</p>
                {autoSendStatus === 'SUCCESS' && <span className="text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">Enviado por Bot ✅</span>}
                {autoSendStatus === 'ERROR' && <span className="text-rose-400 text-xs font-bold bg-rose-400/10 px-2 py-0.5 rounded-full border border-rose-400/20">Fallo envío Bot ⚠️</span>}
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-white/10 mb-4 overflow-y-auto custom-scrollbar flex-1">
              <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed">
                {successData.message}
              </pre>
            </div>

            <div className="flex gap-3">
              <button onClick={() => copyToClipboard(successData.message)} className="flex-1 p-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold flex items-center justify-center gap-2 transition">
                <Copy size={18} /> Copiar
              </button>
              <a
                href={`https://wa.me/${saleData.phone}?text=${encodeURIComponent(successData.message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 p-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
              >
                <Send size={18} /> Enviar
              </a>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const btn = document.getElementById('btn-share-receipt') as HTMLButtonElement
                  if (btn) {
                    btn.disabled = true;
                    btn.innerText = 'Generando...';
                  }

                  // Timeout to ensure rendering (increased for stability)
                  setTimeout(() => {
                    if (invoiceRef.current) {
                      html2canvas(invoiceRef.current, {
                        backgroundColor: '#111',
                        scale: 2, // Improve quality
                        useCORS: true // Ensure images load
                      }).then(canvas => {
                        try {
                          const link = document.createElement('a')
                          link.download = `Recibo_${saleData.phone || 'Venta'}.png`
                          link.href = canvas.toDataURL('image/png')
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          toast.success('📸 Recibo generado')
                        } catch (e) {
                          console.error(e)
                          toast.error('Error descarga')
                        } finally {
                          if (btn) {
                            btn.disabled = false;
                            btn.innerText = 'Compartir Recibo';
                          }
                        }
                      }).catch(err => {
                        console.error(err)
                        toast.error("Error generando imagen")
                        if (btn) {
                          btn.disabled = false;
                          btn.innerText = 'Compartir Recibo';
                        }
                      })
                    } else {
                      toast.error("Error: Plantilla no encontrada")
                      if (btn) {
                        btn.disabled = false;
                        btn.innerText = 'Compartir Recibo';
                      }
                    }
                  }, 800)
                }}
                id="btn-share-receipt"
                className="flex-1 p-3 rounded-xl bg-violet-600 text-white hover:bg-violet-500 font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
              >
                <Download size={18} /> Compartir Recibo
              </button>
            </div>
            <button onClick={() => setShowSuccessModal(false)} className="mt-3 text-slate-500 hover:text-white text-sm">Cerrar</button>
          </div>
        </div >
      )
      }

      {/* INVOICE TEMPLATE (HIDDEN OFFSCREEN) */}
      {
        invoiceData && (
          <div className="fixed top-0 left-0 w-full h-full -z-50 flex items-center justify-center opacity-0 pointer-events-none">
            <div ref={invoiceRef} className="w-[400px] bg-slate-950 p-8 rounded-none border border-white/10 text-center relative overflow-hidden" style={{ fontFamily: 'Arial, sans-serif' }}>
              {/* DECORATION */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-600 to-blue-600"></div>
              <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-violet-600"></div>

              {/* HEADER */}
              <div className="flex flex-col items-center mb-6">
                <img src="/logo.jpg" className="w-20 h-20 rounded-full object-cover border-2 border-white/10 mb-4 shadow-lg shadow-violet-500/20" alt="Logo" />
                <h1 className="text-2xl font-bold text-white tracking-tight">ESTRATOSFERA</h1>
                <p className="text-violet-400 text-sm font-medium tracking-widest uppercase">Comprobante de Pago</p>
              </div>

              {/* DETAILS */}
              <div className="space-y-6">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Pagado</p>
                  <p className="text-3xl font-bold text-emerald-400 font-mono">${parseInt(invoiceData.amount).toLocaleString()}</p>
                </div>

                <div className="space-y-4 text-sm text-left">
                  <div className="flex justify-between items-start border-b border-white/5 pb-2">
                    <span className="text-slate-400 shrink-0">Cliente</span>
                    <span className="font-bold text-white text-right">{invoiceData.client}</span>
                  </div>

                  {invoiceData.isCombo && invoiceData.items && invoiceData.items.length > 0 ? (
                    <div className="border-b border-white/5 pb-2">
                      <span className="text-slate-400 block mb-2 text-xs uppercase">Detalles del Combo</span>
                      <div className="space-y-2">
                        {invoiceData.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-slate-300">
                              {item.profile ? `${item.service} - ${item.profile}` : item.service}
                            </span>
                            <span className="text-emerald-400 font-mono">
                              {item.price !== undefined ? `$${item.price.toLocaleString()}` : 'Activado'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start border-b border-white/5 pb-2">
                      <span className="text-slate-400 shrink-0">Servicio</span>
                      <span className="font-bold text-white text-right">{invoiceData.category}</span>
                    </div>
                  )}

                  {invoiceData.months && invoiceData.months > 1 && (
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">Duración</span>
                      <span className="font-bold text-white">{invoiceData.months} Meses</span>
                    </div>
                  )}

                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Fecha</span>
                    <span className="font-bold text-white">{(() => {
                      if (!invoiceData.date) return ''
                      if (typeof invoiceData.date === 'string' && invoiceData.date.endsWith('T00:00:00.000Z')) {
                        return new Date(invoiceData.date).toISOString().split('T')[0]
                      }
                      return new Date(invoiceData.date).toLocaleDateString()
                    })()}</span>
                  </div>

                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Método de Pago</span>
                    <span className="font-bold text-white">{invoiceData.paymentMethod}</span>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-slate-500 text-xs">¡Gracias por tu compra!</p>
                <p className="text-slate-600 text-[10px] mt-1">Generado automáticamente por el sistema</p>
              </div>
            </div>
          </div>
        )
      }
    </>
  )
}


function ProfileCard({ profile, isSelected, onToggle, onRotate, onReportWarranty, onRevive, onSell, onAssign, onMigrate }: { profile: Profile, isSelected: boolean, onToggle: () => void, onRotate: () => void, onReportWarranty: () => void, onRevive: () => void, onSell: () => void, onAssign: () => void, onMigrate: () => void }) {
  const statusColors = {
    LIBRE: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    OCUPADO: 'bg-slate-800/50 border-white/5 text-slate-400',
    CUARENTENA_PIN: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    GARANTIA: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    CAIDO: 'bg-rose-500/10 border-rose-500/20 text-rose-400'
  }

  return (
    <div className={`p-3 rounded-xl border transition-all duration-200 ${statusColors[profile.estado as keyof typeof statusColors]}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          {profile.estado === 'LIBRE' && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className="w-4 h-4 rounded border-white/20 bg-slate-800 text-violet-600 focus:ring-violet-500 cursor-pointer accent-violet-600"
            />
          )}
          <span className="font-bold text-sm truncate">{profile.nombre_perfil}</span>
          {profile.pin && (
            <span className="text-[10px] text-slate-500 font-mono border border-white/5 bg-black/20 px-1 rounded tracking-wider">{profile.pin}</span>
          )}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{profile.estado === 'CUARENTENA_PIN' ? 'CUARENTENA' : profile.estado}</span>
      </div>

      {/* Client Name Display for Occupied Profiles */}
      {
        profile.estado === 'OCUPADO' && profile.cliente && (
          <div className="mb-2 px-2 py-1 rounded bg-black/20 text-[10px] text-slate-300 flex items-center gap-1 border border-white/5">
            <User size={10} className="text-slate-500" />
            <span className="truncate">{profile.cliente.nombre}</span>
          </div>
        )
      }


      <div className="flex gap-2 mt-auto">
        {(profile.estado === 'OCUPADO' || profile.estado === 'GARANTIA' || profile.estado === 'CAIDO') && (
          <div className="flex gap-1 flex-1">
            {profile.estado === 'GARANTIA' ? (
              <button
                onClick={onRevive}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1"
                title="Revivir Perfil (Liberar)"
              >
                <Activity size={12} /> Revivir
              </button>
            ) : (
              <div className="flex flex-1 gap-1">
                <button
                  onClick={onReportWarranty}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                    }`}
                >
                  <ShieldAlert size={12} />
                </button>
                {/* MIGRATE BUTTON (Unique for OCUPADO/GARANTIA) */}
                {profile.estado === 'OCUPADO' && (
                  <button
                    onClick={onMigrate}
                    title="Migrar/Intercambiar Cliente"
                    className="flex-1 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 hover:text-indigo-300 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                  >
                    <RefreshCw size={12} /> Migrar
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onAssign} // Opens Assign Modal
              title="Reasignar a Cliente"
              className="w-8 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors flex items-center justify-center"
            >
              <User size={12} />
            </button>
          </div>
        )}

        {profile.estado === 'LIBRE' ? (
          <div className="flex gap-1 flex-1">
            <button
              onClick={onSell}
              className="flex-1 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={12} /> Vender
            </button>
            <button
              onClick={onAssign}
              title="Asignar a Cliente Existente (Migración)"
              className="w-8 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors flex items-center justify-center"
            >
              <User size={12} />
            </button>
            <button
              onClick={onRotate}
              title="Reportar Caído/Rotar"
              className="w-8 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-medium transition-colors flex items-center justify-center"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        ) : (
          // Status other than LIBRE (OCUPADO, GARANTIA, etc) are handled above or here if needed (e.g. CUARENTENA)
          profile.estado === 'CUARENTENA_PIN' && (
            <button
              onClick={onRotate}
              className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1"
            >
              <RefreshCw size={12} /> Revivir
            </button>
          )
        )}
      </div>
    </div>

  )
}


