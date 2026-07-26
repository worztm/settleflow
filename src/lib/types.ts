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
  type: 'send' | 'receive' | 'swap' | 'schedule'
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