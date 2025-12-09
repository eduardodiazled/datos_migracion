'use client'

import { useState, useEffect } from 'react'
import { Monitor, User, RefreshCw, ShieldAlert, Copy, Plus, LogOut, DollarSign, Check, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { signOut } from 'next-auth/react'
import { MessageGenerator } from '@/lib/messageGenerator'
import { createInventoryAccount, createSale, assignProfile, getAllProviders, createProvider, updateInventoryAccount, createComboSale, sellFullAccount, deleteInventoryAccount, setAccountWarranty } from '../actions'

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
  'jellyfin': 12000
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
  const [newAccount, setNewAccount] = useState<{ service: string, email: string, password: string, profilesCount: number, providerId?: number, dia_corte?: number, is_disposable?: boolean }>({ service: '', email: '', password: '', profilesCount: 1, is_disposable: false })
  // Filters & Views
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS')
  const [activeTab, setActiveTab] = useState<'RENEWABLE' | 'DISPOSABLE' | 'ALL'>('ALL')
  const [isCreatingProvider, setIsCreatingProvider] = useState(false)
  const [newProviderName, setNewProviderName] = useState('')

  const [profileDetails, setProfileDetails] = useState<{ name: string, pin?: string }[]>([])
  const [usePin, setUsePin] = useState(false)
  const [saleData, setSaleData] = useState({ phone: '', name: '', price: '', paymentMethod: 'NEQUI', date: new Date().toISOString().split('T')[0], months: 1 })
  // Assign Modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignData, setAssignData] = useState({ phone: '', name: '', date: new Date().toISOString().split('T')[0] })

  // Edit Account State
  const [showEditAccountModal, setShowEditAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any>(null)

  // Sort & Group State
  const [sortBy, setSortBy] = useState<'DEFAULT' | 'AVAILABILITY'>('DEFAULT')
  const [groupBy, setGroupBy] = useState<'PROVIDER' | 'SERVICE'>('PROVIDER')

  const fetchInventory = () => {
    setLoading(true)
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => {
        setAccounts(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchInventory()
    getAllProviders().then(setProviders)
  }, [])

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
      is_disposable: newAccount.is_disposable
    })

    if (res.success) {
      toast.success('Cuenta creada!')
      setShowAddModal(false)
      setNewAccount({ service: '', email: '', password: '', profilesCount: 1 })
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
  const [successData, setSuccessData] = useState<{ message: string, receiptId?: number, clientName?: string, service?: string, date?: string, price?: number, paymentMethod?: string, months?: number } | null>(null)

  const handleSell = async () => {
    if (!selectedProfileId || !saleData.phone || !saleData.name || !saleData.price || !saleData.paymentMethod) return toast.error('Faltan datos del cliente o venta')

    const res = await createSale(saleData.phone, saleData.name, selectedProfileId, parseInt(saleData.price), saleData.paymentMethod, saleData.date, saleData.months)
    if (res.success && res.transaction) { // Assuming createSale returns the created sale object or we can look it up
      toast.success('Venta realizada!')
      setShowSellModal(false)
      fetchInventory()

      // Get account details for message
      const profileInfo = accounts.flatMap(a => a.perfiles.map(p => ({ ...p, account: a }))).find(p => p.id === selectedProfileId)

      if (profileInfo) {
        const msg = MessageGenerator.generate('SALE', {
          clientName: saleData.name,
          service: profileInfo.account.servicio,
          email: profileInfo.account.email,
          password: profileInfo.account.password,
          profileName: profileInfo.nombre_perfil,
          pin: profileInfo.pin,
          date: new Date((saleData.date || new Date().toISOString().split('T')[0]) + 'T12:00:00').toLocaleDateString(), // Safe date
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
      }

    } else {
      toast.error('Error en venta')
    }
  }

  // Combo / Multi-select
  const [selectedItems, setSelectedItems] = useState<{ profileId: number, serviceName: string, price: number }[]>([])

  const toggleSelection = (profile: Profile, serviceName: string, defaultPrice: number = 10000) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.profileId === profile.id)
      if (exists) return prev.filter(i => i.profileId !== profile.id)
      return [...prev, { profileId: profile.id, serviceName: `${serviceName} - ${profile.nombre_perfil}`, price: defaultPrice }]
    })
  }


  const handleOpenAssign = (profileId: number) => {
    setSelectedProfileId(profileId)
    setShowAssignModal(true)
  }

  const handleAssign = async () => {
    if (!selectedProfileId || !assignData.phone || !assignData.name || !assignData.date) return toast.error('Faltan datos')

    const res = await assignProfile(assignData.phone, assignData.name, selectedProfileId, assignData.date)
    if (res.success) {
      toast.success('Cliente asignado correctamente!')
      setShowAssignModal(false)
      fetchInventory()
    } else {
      toast.error('Error al asignar')
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

    const res = await updateInventoryAccount(editingAccount.id, payload)

    if (res.success) {
      toast.success('Cuenta actualizada')
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
        toast.error('Error al aplicar garantía: ' + res.error)
      }
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

  if (loading) return <div className="p-8 text-center text-slate-400">Cargando inventario...</div>

  return (

    <>
      {/* FLOATING ACTION BAR FOR COMBOS */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-8 z-50 animate-in slide-in-from-bottom-6 fade-in duration-300">
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

      <div className="p-4 md:p-8 md:ml-72 space-y-6 pb-24">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Inventario</h1>
            <p className="text-slate-400 text-sm">Gestiona cuentas y perfiles.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl flex items-center font-medium transition-all shadow-lg shadow-violet-600/20">
              <Plus size={18} className="md:mr-2" /> <span className="hidden md:inline">Nueva Cuenta</span>
            </button>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="md:hidden bg-slate-800 p-2 rounded-xl text-slate-400">
              <LogOut size={20} />
            </button>
          </div>
        </div>


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
                    <div key={serviceName} className="glass-panel p-4 rounded-2xl min-w-[130px] flex flex-col items-center gap-3 border border-white/5 bg-slate-900/60 relative overflow-hidden group snap-center cursor-default transition-all hover:bg-slate-800/80">
                      {/* Background Glow */}
                      {isLowStock && <div className="absolute inset-0 bg-red-500/10 z-0 animate-pulse"></div>}

                      <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center overflow-hidden relative z-10 shadow-inner">
                        {iconPath ? (
                          <img src={iconPath} alt={serviceName} className={`w-full h-full object-cover ${scaleClass}`} />
                        ) : (
                          <Monitor size={24} className="text-slate-400" />
                        )}
                      </div>
                      <div className="text-center z-10 w-full">
                        <div className={`text-2xl font-black leading-none mb-1 ${isLowStock ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.3)]' : 'text-white'}`}>
                          {count}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 truncate w-full">
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
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 bg-slate-900/50 p-4 rounded-3xl border border-white/5 backdrop-blur-sm">
          {/* 1. Search Bar */}
          <div className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="Buscar por servicio, email o cliente..."
              className="w-full bg-slate-800 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-3 text-slate-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>

          <div className="flex gap-4 items-center w-full md:w-auto justify-between md:justify-end">
            {/* 2. Tabs: Renewable vs Disposable */}
            <div className="flex bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ALL' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
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
              <div className="space-y-8">
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

                                      return <img src={iconPath} alt={account.servicio} className={`w-full h-full object-cover ${scaleClass}`} />
                                    }
                                    return <Monitor size={24} />
                                  })()}
                                </div>
                                <div className="overflow-hidden min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-white leading-tight truncate">{account.servicio}</h3>
                                    <button
                                      onClick={() => {
                                        setEditingAccount({
                                          id: account.id,
                                          servicio: account.servicio,
                                          email: account.email,
                                          password: account.password,
                                          providerId: account.provider?.id,
                                          dia_corte: (account as any).dia_corte,
                                          is_disposable: (account as any).is_disposable
                                        })
                                        setShowEditAccountModal(true)
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
                                  onToggle={() => toggleSelection(profile, account.servicio)}
                                  onRotate={() => handleRotate(profile.id, profile.estado)}
                                  onWarranty={() => handleAccountWarranty(account.id, account.servicio)}
                                  onSell={() => handleOpenSell(profile.id, account.servicio)}
                                  onAssign={() => handleOpenAssign(profile.id)}
                                />
                              ))}
                            </div>

                            { /* Full Account Sale Button */}
                            <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
                              <button
                                onClick={async () => {
                                  if (confirm(`⚠ GARANTÍA DE CUENTA COMPLETA ⚠\n\n¿Estás seguro de poner TODA la cuenta de ${account.servicio} en garantía?\nEsto marcará TODOS los perfiles como 'GARANTÍA' para revisión/reemplazo.`)) {
                                    const res = await setAccountWarranty(account.id)
                                    if (res.success) {
                                      toast.success(`Cuenta ${account.servicio} marcada en Garantía`)
                                      fetchInventory()
                                    } else {
                                      toast.error('Error al aplicar garantía: ' + res.error)
                                    }
                                  }
                                }}
                                className="text-xs font-bold text-violet-400 hover:text-white flex items-center gap-1 transition-colors"
                              >
                                <DollarSign size={14} /> Vender Cuenta Completa
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
                          <td className="p-4 text-slate-400">{account.provider?.nombre || '-'}</td>
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
                                  is_disposable: (account as any).is_disposable
                                })
                                setShowEditAccountModal(true)
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
              {/* Provider Selection (Optional) */}
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

                {/* Payment Day Input - Only if provider is selected */}
                {newAccount.providerId && (
                  <div className="mt-2">
                    <label className="text-xs text-slate-400 block mb-1">Día de Corte (Pago al Proveedor)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Día del mes (Ej: 15)"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                      value={newAccount.dia_corte || ''}
                      onChange={e => setNewAccount({ ...newAccount, dia_corte: parseInt(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              {/* Service Selection */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Servicio</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none appearance-none"
                  value={newAccount.service}
                  onChange={e => {
                    const svc = e.target.value
                    setNewAccount({ ...newAccount, service: svc })
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
                  <option value="Otro">Otro...</option>
                </select>
                {newAccount.service === 'Otro' && (
                  <input
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none mt-2"
                    placeholder="Escribe el nombre del servicio"
                    onChange={(e) => setNewAccount({ ...newAccount, service: e.target.value })}
                  />
                )}
              </div>

              {/* Basic Creds */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Email / Usuario</label>
                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                  value={newAccount.email} onChange={e => setNewAccount({ ...newAccount, email: e.target.value })} placeholder="correo@ejemplo.com" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Contraseña</label>
                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                  value={newAccount.password} onChange={e => setNewAccount({ ...newAccount, password: e.target.value })} placeholder="******" />
              </div>



              {/* DISPOSABLE CHECKBOX */}
              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <input
                  type="checkbox"
                  id="is_disposable"
                  className="w-5 h-5 rounded border border-white/20 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  checked={newAccount.is_disposable}
                  onChange={(e) => setNewAccount({ ...newAccount, is_disposable: e.target.checked })}
                />
                <label htmlFor="is_disposable" className="text-sm font-medium text-slate-300">
                  ¿Es Cuenta Desechable? (1 Mes)
                  <span className="block text-xs text-slate-500 font-normal">Si marcas esto, la cuenta aparecerá en la pestaña de desechables.</span>
                </label>
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
            </div>

            <div className="flex gap-3 flex-shrink-0 pt-2 border-t border-white/5">
              <button onClick={() => setShowAddModal(false)} className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium">Cancelar</button>
              <button onClick={handleCreateAccount} className="flex-1 p-3 rounded-xl bg-violet-600 text-white hover:bg-violet-500 font-bold shadow-lg shadow-violet-600/20">Crear Cuenta</button>
            </div>
          </div >
        </div >
      )
      }

      {/* SELL MODAL (ADAPTIVE: SINGLE OR COMBO) */}
      {
        showSellModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className={`glass-panel p-6 rounded-3xl w-full ${selectedItems.length > 1 ? 'max-w-2xl' : 'max-w-sm'} border border-white/10 shadow-2xl bg-slate-900 transition-all`}>
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
                      value={saleData.phone} onChange={e => setSaleData({ ...saleData, phone: e.target.value })} placeholder="3001234567" autoFocus />
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
                        <option value={1}>1 Mes</option>
                        <option value={2}>2 Meses</option>
                        <option value={3}>3 Meses</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Método de Pago</label>
                    <select
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                      value={saleData.paymentMethod}
                      onChange={e => setSaleData({ ...saleData, paymentMethod: e.target.value })}
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
                            type="number"
                            value={saleData.price}
                            onChange={e => setSaleData({ ...saleData, price: e.target.value })}
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
                          type="number" value={saleData.price} onChange={e => setSaleData({ ...saleData, price: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
                <button onClick={() => setShowSellModal(false)} className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition">Cancelar</button>
                <button
                  onClick={async () => {
                    if (isSubmitting) return

                    if (selectedItems.length > 1) {
                      // COMBO SALE LOGIC
                      if (!saleData.phone || !saleData.name) return toast.error('Faltan datos del cliente')

                      setIsSubmitting(true)
                      try {
                        // Calculate individual prices
                        const total = parseInt(saleData.price)
                        const count = selectedItems.length
                        const basePrice = Math.floor(total / count)

                        const items = selectedItems.map((item, i) => ({
                          profileId: item.profileId,
                          price: i === count - 1 ? total - (basePrice * (count - 1)) : basePrice
                        }))

                        const res = await createComboSale(saleData.phone, saleData.name, saleData.paymentMethod, items, saleData.date, saleData.months)

                        if (res.success) {
                          toast.success(`Combo de ${count} ítems vendido!`)

                          // Generate Success Data for Combo
                          const msg = MessageGenerator.generate('SALE', {
                            clientName: saleData.name,
                            service: `Combo ${count} Ítems`,
                            price: parseInt(saleData.price),
                            date: new Date().toLocaleDateString()
                          })

                          setSuccessData({
                            message: msg,
                            clientName: saleData.name,
                            service: `Combo (${count} P)`,
                            date: new Date().toLocaleDateString(),
                            price: parseInt(saleData.price),
                            paymentMethod: saleData.paymentMethod,
                            months: saleData.months
                          })
                          setShowSuccessModal(true)

                          setSelectedItems([])
                          setSaleData({ phone: '', name: '', price: '15000', paymentMethod: 'NEQUI', date: new Date().toISOString().split('T')[0], months: 1 })
                          fetchInventory()
                        } else {
                          toast.error("Error: " + res.error)
                        }
                      } catch (error) {
                        console.error(error)
                        toast.error("Error inesperado")
                      } finally {
                        setIsSubmitting(false)
                      }

                    } else {
                      // LEGACY SINGLE SALE
                      setIsSubmitting(true)
                      await handleSell()
                      setIsSubmitting(false)
                    }
                  }}
                  disabled={isSubmitting}
                  className={`flex-1 p-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold shadow-lg shadow-emerald-600/20 transition hover:scale-105 flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? <span className="animate-spin">⌛</span> : <DollarSign size={18} />}
                  {isSubmitting ? 'Procesando...' : 'Confirmar Venta'}
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* ASSIGN MODAL */}
      {
        showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
            <div className="glass-panel p-6 rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl bg-slate-900">
              <h3 className="text-lg font-bold text-white mb-2">Asignar Manualmente</h3>
              <p className="text-xs text-slate-400 mb-4">Vincula este perfil a un cliente existente con su fecha de vencimiento actual.</p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Celular Cliente</label>
                  <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                    value={assignData.phone} onChange={e => setAssignData({ ...assignData, phone: e.target.value })} placeholder="3001234567" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nombre Cliente</label>
                  <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                    value={assignData.name} onChange={e => setAssignData({ ...assignData, name: e.target.value })} placeholder="Juan Pérez" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Fecha de Vencimiento Actual</label>
                  <input type="date" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                    value={assignData.date} onChange={e => setAssignData({ ...assignData, date: e.target.value })} />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowAssignModal(false)} className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium">Cancelar</button>
                <button onClick={handleAssign} className="flex-1 p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold">Asignar Cliente</button>
              </div>
            </div>
          </div>
        )
      }

      {/* EDIT ACCOUNT MODAL */}
      {
        showEditAccountModal && editingAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-slate-900 w-full max-w-lg rounded-3xl p-6 border border-white/10 shadow-2xl">
              <h2 className="text-xl font-bold mb-4">Editar Cuenta</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Servicio</label>
                  <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white"
                    value={editingAccount.servicio}
                    onChange={e => setEditingAccount({ ...editingAccount, servicio: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Email</label>
                  <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white"
                    value={editingAccount.email}
                    onChange={e => setEditingAccount({ ...editingAccount, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Contraseña</label>
                  <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white"
                    value={editingAccount.password}
                    onChange={e => setEditingAccount({ ...editingAccount, password: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Proveedor (Opcional)</label>
                    <select
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white"
                      value={editingAccount.providerId || ''}
                      onChange={(e) => setEditingAccount({ ...editingAccount, providerId: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">Ninguno (Propio)</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Día Corte</label>
                    <input type="number" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white"
                      value={editingAccount.dia_corte || ''}
                      onChange={e => setEditingAccount({ ...editingAccount, dia_corte: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Ej: 15"
                    />
                  </div>
                </div>

                <button onClick={handleUpdateAccount} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition mt-2">
                  Guardar Cambios
                </button>
                <button onClick={() => setShowEditAccountModal(false)} className="w-full bg-transparent hover:bg-white/5 text-slate-400 py-3 rounded-xl transition">
                  Cancelar
                </button>

                <div className="pt-4 border-t border-white/5 mt-2">
                  <button onClick={handleDeleteAccount} className="w-full flex items-center justify-center gap-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 py-3 rounded-xl transition font-medium text-sm">
                    <Trash2 size={16} /> Eliminar Cuenta Permanentemente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* SUCCESS MODAL / RECEIPT */}
      {showSuccessModal && successData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-sm rounded-[32px] p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
            {/* Decoration */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600"></div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-slate-950 rounded-full mx-auto flex items-center justify-center border border-white/10 mb-3 shadow-lg shadow-violet-500/10">
                <Check size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">ESTRATOSFERA</h2>
              <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mt-1">COMPROBANTE DE PAGO</p>
            </div>

            <div className="bg-slate-950/50 rounded-2xl p-6 border border-white/5 mb-6">
              <p className="text-center text-xs text-slate-500 font-medium mb-1">TOTAL PAGADO</p>
              <p className="text-center text-3xl font-black text-emerald-400 mb-6">${successData.price?.toLocaleString()}</p>

              <div className="space-y-3">
                <div className="flex justify-between items-start text-sm">
                  <span className="text-slate-500 shrink-0">Cliente</span>
                  <span className="text-white font-bold text-right">{successData.clientName}</span>
                </div>
                <div className="flex justify-between items-start text-sm">
                  <span className="text-slate-500 shrink-0">Servicio</span>
                  <span className="text-white font-medium text-right">{successData.service}</span>
                </div>
                {successData.months && successData.months > 1 && (
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-500 shrink-0">Duración</span>
                    <span className="text-white font-medium text-right">{successData.months} Meses</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Fecha</span>
                  <span className="text-white font-medium">{successData.date}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Método de Pago</span>
                  <span className="text-white font-bold bg-white/5 px-2 py-0.5 rounded text-xs">{successData.paymentMethod}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const url = `https://wa.me/?text=${encodeURIComponent(successData.message)}`
                  window.open(url, '_blank')
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                Enviar al Cliente
              </button>
              <button onClick={() => setShowSuccessModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl transition">
                Cerrar
              </button>
            </div>

            <p className="text-center text-[10px] text-slate-600 mt-6">
              ¡Gracias por tu compra!<br />
              Generado automáticamente por el sistema
            </p>
          </div>
        </div>
      )}

    </>
  )
}

function ProfileCard({ profile, isSelected, onToggle, onRotate, onWarranty, onSell, onAssign }: { profile: Profile, isSelected: boolean, onToggle: () => void, onRotate: () => void, onWarranty: () => void, onSell: () => void, onAssign: () => void }) {
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
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{profile.estado === 'CUARENTENA_PIN' ? 'CUARENTENA' : profile.estado}</span>
      </div >

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
          <button
            onClick={onWarranty}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${profile.estado === 'GARANTIA'
              ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
              }`}
          >
            <ShieldAlert size={12} />
            {profile.estado === 'GARANTIA' ? 'REASIGNAR' : 'Garantía'}
          </button>
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
          <button
            onClick={onRotate}
            className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1"
          >
            <RefreshCw size={12} />
            {profile.estado === 'CUARENTENA_PIN' ? 'Revivir (Liberar)' : 'Rotar'}
          </button>
        )}
      </div>
    </div >
  )
}
