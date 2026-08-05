import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { api } from "./api-client"
import type { Payee, PaymentPlan } from "./types"

interface User {
  id: string
  email: string
  displayName: string
  createdAt?: string
}

interface Wallet {
  id: string
  address: string
  chain: string
  label: string | null
  isPrimary: boolean
  balance: string
  createdAt?: string
}

interface Transaction {
  id: string
  txHash?: string
  type: string
  amount: string
  token: string
  status: string
  recipient?: string
  counterparty?: string
  memo?: string
  fee?: string
  createdAt: string
}

interface Schedule {
  id: string
  title: string
  description?: string
  amount: string
  token: string
  recipient: string
  frequency: string
  nextRun?: string
  status: string
  conditions?: string
  createdAt: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => void
  wallets: Wallet[]
  transactions: Transaction[]
  schedules: Schedule[]
  payees: Payee[]
  totalBalance: number
  createPayee: (data: { name: string; walletAddress: string; category?: string; notes?: string }) => Promise<Payee>
  updatePayee: (id: string, data: { name?: string; walletAddress?: string; category?: string; notes?: string }) => Promise<void>
  deletePayee: (id: string) => Promise<void>
  createPlan: (payeeId: string, data: { purpose?: string; amount: string; frequency?: string; payDay?: number | null; startDate?: string | null; sourceWalletId?: string | null }) => Promise<PaymentPlan>
  updatePlan: (payeeId: string, planId: string, data: Partial<Omit<PaymentPlan, "id" | "payeeId">>) => Promise<void>
  deletePlan: (payeeId: string, planId: string) => Promise<void>
  executePlan: (payeeId: string, planId: string) => Promise<void>
  connectWallet: (address: string, chain?: string, label?: string) => Promise<void>
  signInWithCode: (email: string, code: string) => Promise<void>
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; message: string }>
  refreshData: () => void
  sendPayment: (walletId: string, to: string, amount: string, token?: string) => Promise<void>
  createSchedule: (text: string) => Promise<Schedule>
  executeSchedule: (id: string) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>
  deleteAccount: () => Promise<void>
  syncWallets: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function getLocalToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("sf_token")
}

function getLocalUser(): User | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("sf_user")
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

interface LocalData {
  wallets: Wallet[]
  transactions: Transaction[]
  schedules: Schedule[]
  payees: Payee[]
}

function getLocalData(userId: string): LocalData | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(`sf_data_${userId}`)
  if (raw) {
    try { return JSON.parse(raw) } catch {}
  }
  return null
}

// Merge into the stored snapshot so callers that only update one slice
// (e.g. payees) never clobber the others.
function saveLocalData(userId: string, data: Partial<LocalData>) {
  const existing = getLocalData(userId) || {}
  localStorage.setItem(`sf_data_${userId}`, JSON.stringify({ ...existing, ...data }))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getLocalUser)
  const [token, setToken] = useState<string | null>(getLocalToken)
  const [isLoading, setIsLoading] = useState(true)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [payees, setPayees] = useState<Payee[]>([])

  // Load persisted wallet/schedule data from localStorage on mount
  useEffect(() => {
    if (user) {
      const stored = getLocalData(user.id)
      if (stored) {
        setWallets(stored.wallets ?? [])
        setTransactions(stored.transactions ?? [])
        setSchedules(stored.schedules ?? [])
        setPayees(stored.payees ?? [])
      }
      // Try to fetch fresh data from API
      api.auth.me()
        .then(res => {
          if (res.wallets) {
            setWallets(res.wallets.map((w: any) => ({
              id: w.id, address: w.address, chain: w.chain,
              label: w.label, isPrimary: w.isPrimary, balance: w.balance,
              createdAt: w.createdAt,
            })))
          }
          return api.payees.list()
        })
        .then(res => {
          if (res?.payees) setPayees(res.payees)
        })
        .catch(() => {})
        .finally(() => {
          saveLocalData(user.id, {
            wallets,
            transactions,
            schedules,
            payees,
          })
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [user])

  function persist(user: User, t: string) {
    setUser(user)
    setToken(t)
    localStorage.setItem("sf_token", t)
    localStorage.setItem("sf_user", JSON.stringify(user))
  }

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password)
    persist(res.user, res.token)
    if (res.wallets) {
      setWallets(res.wallets)
      saveLocalData(res.user.id, { wallets: res.wallets, transactions, schedules })
    }
  }

  const register = async (email: string, password: string, displayName?: string) => {
    const res = await api.auth.register(email, password, displayName)
    persist(res.user, res.token)
    if (res.wallet) {
      const walletArr = [{
        id: res.wallet.id, address: res.wallet.address, chain: res.wallet.chain,
        label: res.wallet.label, isPrimary: true, balance: "0",
      }]
      setWallets(walletArr)
      saveLocalData(res.user.id, { wallets: walletArr, transactions: [], schedules: [] })
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setWallets([])
    setTransactions([])
    setSchedules([])
    localStorage.removeItem("sf_token")
    localStorage.removeItem("sf_user")
  }

  const connectWallet = async (address: string, chain?: string, label?: string) => {
    if (!user) return
    if (wallets.find(w => w.address === address)) return
    const newWallet: Wallet = {
      id: "wallet-" + Date.now(),
      address, chain: chain || "arc", label: label || null,
      isPrimary: wallets.length === 0,
      balance: "0.00", createdAt: new Date().toISOString(),
    }
    const updated = [...wallets, newWallet]
    setWallets(updated)
    saveLocalData(user.id, { wallets: updated, transactions, schedules })
    try {
      const res = await api.wallets.create(label)
      if (res.wallet) {
        setWallets(prev => prev.map(w => w.address === address ? { ...w, id: res.wallet.id, isPrimary: res.wallet.isPrimary } : w))
      }
    } catch {}
  }

  const sendPayment = async (walletId: string, to: string, amount: string, token?: string) => {
    if (!user) throw new Error("Not authenticated")
    const res = await api.transactions.send(walletId, to, amount, token)
    const tx: Transaction = {
      id: res.transaction.id, txHash: res.transaction.txHash,
      type: "send", amount, token: token || "USDC",
      status: res.transaction.status || "pending",
      recipient: to, memo: res.transaction.memo,
      createdAt: res.transaction.createdAt || new Date().toISOString(),
    }
    const updated = [tx, ...transactions]
    setTransactions(updated)
    saveLocalData(user.id, { wallets, transactions: updated, schedules })
  }

  const createSchedule = async (text: string): Promise<Schedule> => {
    if (!user) throw new Error("Not authenticated")
    const res = await api.schedules.aiCreate(text)
    const s: Schedule = {
      id: res.schedule.id, title: res.schedule.title, amount: res.schedule.amount,
      token: res.schedule.token || "USDC", recipient: res.schedule.recipient,
      frequency: res.schedule.frequency, nextRun: res.schedule.nextRun,
      status: res.schedule.status, conditions: res.schedule.conditions,
      createdAt: res.schedule.createdAt || new Date().toISOString(),
    }
    const updated = [s, ...schedules]
    setSchedules(updated)
    saveLocalData(user.id, { wallets, transactions, schedules: updated })
    return s
  }

  const executeSchedule = async (id: string) => {
    if (!user) throw new Error("Not authenticated")
    const res = await api.schedules.execute(id)
    // Add the executed transaction
    const tx: Transaction = {
      id: res.transaction.id, type: "schedule", amount: "0", token: "USDC",
      status: res.transaction.status, createdAt: new Date().toISOString(),
    }
    const txUpdated = [tx, ...transactions]
    setTransactions(txUpdated)
    // Update schedule next run
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, nextRun: res.nextRun } : s))
    saveLocalData(user.id, { wallets, transactions: txUpdated, schedules })
  }

  const deleteSchedule = async (id: string) => {
    if (!user) throw new Error("Not authenticated")
    await api.schedules.delete(id)
    const updated = schedules.filter(s => s.id !== id)
    setSchedules(updated)
    saveLocalData(user.id, { wallets, transactions, schedules: updated })
  }

  const signInWithCode = async (email: string, code: string) => {
    const res = await api.auth.verifySignInCode(email, code)
    persist(res.user, res.token)
    if (res.wallets) {
      setWallets(res.wallets)
      saveLocalData(res.user.id, { wallets: res.wallets, transactions, schedules })
    }
  }

  const forgotPassword = async (email: string) => {
    return api.auth.forgotPassword(email)
  }

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    return api.auth.resetPassword(email, code, newPassword)
  }

  const deleteAccount = async () => {
    if (!user) throw new Error("Not authenticated")
    await api.auth.deleteAccount()
    // Clear everything
    setUser(null)
    setToken(null)
    setWallets([])
    setTransactions([])
    setSchedules([])
    setPayees([])
    localStorage.removeItem("sf_token")
    localStorage.removeItem("sf_user")
    // Remove all user data from localStorage
    const keys = Object.keys(localStorage).filter(k => k.startsWith("sf_data_"))
    keys.forEach(k => localStorage.removeItem(k))
  }

  const refreshData = useCallback(async () => {
    if (!user) return
    try {
      const [walletRes, txRes, schedRes, payeeRes] = await Promise.all([
        api.wallets.list(),
        api.transactions.list(),
        api.schedules.list(),
        api.payees.list(),
      ])
      if (walletRes.wallets) setWallets(walletRes.wallets)
      if (txRes.transactions) setTransactions(txRes.transactions)
      if (schedRes.schedules) setSchedules(schedRes.schedules)
      if (payeeRes.payees) setPayees(payeeRes.payees)
      saveLocalData(user.id, {
        wallets: walletRes.wallets || wallets,
        transactions: txRes.transactions || transactions,
        schedules: schedRes.schedules || schedules,
        payees: payeeRes.payees || payees,
      })
    } catch {}
  }, [user])

  const syncWallets = useCallback(async () => {
    if (!user) return
    try {
      const res = await api.wallets.sync()
      if (res.wallets) setWallets(res.wallets)
      if (res.transactions) setTransactions(res.transactions)
      saveLocalData(user.id, {
        wallets: res.wallets || wallets,
        transactions: res.transactions || transactions,
        schedules,
      })
    } catch (err) {
      console.error("Wallet sync failed:", err)
    }
  }, [user])

  const totalBalance = wallets.reduce((sum, w) => sum + parseFloat(w.balance || "0"), 0)

  // ─── Payees & Payment Plans (payroll) ────────────────────────────────

  const persistPayees = (updated: Payee[]) => {
    setPayees(updated)
    if (user) saveLocalData(user.id, { wallets, transactions, schedules, payees: updated })
  }

  const createPayee = async (data: { name: string; walletAddress: string; category?: string; notes?: string }) => {
    if (!user) throw new Error("Not authenticated")
    const res = await api.payees.create(data)
    const p: Payee = {
      id: res.payee.id, name: res.payee.name, walletAddress: res.payee.walletAddress,
      category: res.payee.category, notes: res.payee.notes, createdAt: res.payee.createdAt,
      plans: [],
    }
    persistPayees([p, ...payees])
    return p
  }

  const updatePayee = async (id: string, data: { name?: string; walletAddress?: string; category?: string; notes?: string }) => {
    if (!user) throw new Error("Not authenticated")
    const res = await api.payees.update(id, data)
    const updated = payees.map(p => p.id === id ? { ...p, ...res.payee, plans: p.plans } : p)
    persistPayees(updated)
  }

  const deletePayee = async (id: string) => {
    if (!user) throw new Error("Not authenticated")
    await api.payees.delete(id)
    persistPayees(payees.filter(p => p.id !== id))
  }

  const createPlan = async (payeeId: string, data: { purpose?: string; amount: string; frequency?: string; payDay?: number | null; startDate?: string | null; sourceWalletId?: string | null }) => {
    if (!user) throw new Error("Not authenticated")
    const res = await api.plans.create({ payeeId, ...data })
    const plan: PaymentPlan = {
      id: res.plan.id, payeeId: res.plan.payeeId, purpose: res.plan.purpose,
      amount: res.plan.amount, token: res.plan.token, frequency: res.plan.frequency,
      payDay: res.plan.payDay, startDate: res.plan.startDate, nextRun: res.plan.nextRun,
      status: res.plan.status, sourceWalletId: res.plan.sourceWalletId,
      createdAt: res.plan.createdAt,
    }
    persistPayees(payees.map(p => p.id === payeeId ? { ...p, plans: [plan, ...p.plans] } : p))
    return plan
  }

  const updatePlan = async (payeeId: string, planId: string, data: Partial<Omit<PaymentPlan, "id" | "payeeId">>) => {
    if (!user) throw new Error("Not authenticated")
    const res = await api.plans.update(planId, data)
    persistPayees(payees.map(p => p.id === payeeId ? {
      ...p,
      plans: p.plans.map(pl => pl.id === planId ? { ...pl, ...res.plan } : pl),
    } : p))
  }

  const deletePlan = async (payeeId: string, planId: string) => {
    if (!user) throw new Error("Not authenticated")
    await api.plans.delete(planId)
    persistPayees(payees.map(p => p.id === payeeId ? { ...p, plans: p.plans.filter(pl => pl.id !== planId) } : p))
  }

  const executePlan = async (payeeId: string, planId: string) => {
    if (!user) throw new Error("Not authenticated")
    // Grab the plan's amount for an accurate transaction record
    const plan = payees.find(p => p.id === payeeId)?.plans.find(pl => pl.id === planId)
    const res = await api.plans.execute(planId)
    // Record the executed transaction locally
    const tx: Transaction = {
      id: res.transaction.id, txHash: res.transaction.txHash, type: "payroll",
      amount: plan?.amount || "0", token: plan?.token || "USDC", status: res.transaction.status,
      recipient: payees.find(p => p.id === payeeId)?.walletAddress,
      memo: plan ? `${plan.purpose} (payroll)` : "Payroll",
      createdAt: new Date().toISOString(),
    }
    const txUpdated = [tx, ...transactions]
    // Roll the plan forward (next run / completed) — one consistent save
    const payeesUpdated: Payee[] = payees.map(p => p.id === payeeId ? {
      ...p,
      plans: p.plans.map(pl => pl.id === planId ? {
        ...pl,
        nextRun: res.nextRun,
        status: (res.nextRun ? "active" : "completed") as PaymentPlan["status"],
      } : pl),
    } : p)
    setPayees(payeesUpdated)
    setTransactions(txUpdated)
    saveLocalData(user.id, { wallets, transactions: txUpdated, schedules, payees: payeesUpdated })
  }

  return (
    <AuthContext.Provider value={{
      user, token, isAuthenticated: !!user, isLoading,
      login, register, logout, deleteAccount,
      wallets, transactions, schedules, payees, totalBalance,
      connectWallet, signInWithCode, forgotPassword, resetPassword, refreshData, sendPayment, createSchedule, executeSchedule, deleteSchedule, syncWallets,
      createPayee, updatePayee, deletePayee, createPlan, updatePlan, deletePlan, executePlan,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}