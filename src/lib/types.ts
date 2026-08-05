export interface User {
  id: string
  email: string
  displayName: string
  createdAt?: string
}

export interface Wallet {
  id: string
  address: string
  chain: string
  label: string | null
  isPrimary: boolean
  balance: string
  createdAt?: string
}

export interface Transaction {
  id: string
  txHash?: string
  type: 'send' | 'receive' | 'swap' | 'schedule' | 'payroll'
  amount: string
  token: string
  status: 'pending' | 'confirmed' | 'failed' | 'scheduled'
  recipient?: string
  counterparty?: string
  memo?: string
  fee?: string
  createdAt: string
}

export interface Schedule {
  id: string
  title: string
  description?: string
  amount: string
  token: string
  recipient: string
  frequency: string
  nextRun?: string
  status: 'active' | 'paused' | 'completed'
  conditions?: string
  createdAt: string
}

// Payees = employees, vendors, contractors, ... any recipient the user sets up.
// Category is a free-text label the user chooses ("Employee", "Vendor", "Freelancer", ...).
export interface Payee {
  id: string
  name: string
  walletAddress: string
  category: string
  notes?: string
  createdAt?: string
  plans: PaymentPlan[]
}

// A payment plan defines how much a payee gets, for what purpose (free text:
// "Salary", "Bonus", "Commission", ...), how often, and on which date/day.
export interface PaymentPlan {
  id: string
  payeeId: string
  purpose: string
  amount: string
  token: string
  // once | daily | weekly | bi-weekly | monthly | quarterly | yearly
  frequency: string
  // weekly -> 0-6 (0=Sunday); monthly/quarterly/yearly -> 1-31 (day of month)
  payDay?: number | null
  startDate?: string | null
  nextRun?: string | null
  status: 'active' | 'paused' | 'completed'
  sourceWalletId?: string | null
  createdAt?: string
}