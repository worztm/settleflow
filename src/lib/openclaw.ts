// OpenClawCash integration — UNUSED, kept for reference.
// API key must be set via VITE_OPENCLAW_API_KEY env var if ever used.
const API_BASE = "https://openclawcash.com"
const API_KEY = import.meta.env.VITE_OPENCLAW_API_KEY || ""

function headers() {
  if (!API_KEY) throw new Error("OpenClawCash API key not configured. Set VITE_OPENCLAW_API_KEY.")
  return { "Content-Type": "application/json", "X-Agent-Key": API_KEY }
}

function apiUrl(path: string) { return `${API_BASE}${path}` }

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), { ...options, headers: { ...headers(), ...options?.headers } })
  if (!res.ok) { const body = await res.text(); throw new Error(`OpenClawCash API error ${res.status}: ${body}`) }
  return res.json()
}

export interface OpenClawWallet {
  id: number; label: string; address: string; network: string; chain: "evm" | "solana"; balance?: string; nativeSymbol?: string
}

export interface TransferResult {
  txHash: string; status: string; token: string; tokenAddress?: string; requestedAmountDisplay: string; adjustedAmountDisplay: string; valueBaseUnits: string; amountDisplay: string; fee: string; feePercent: string; netAmount: string; memo?: string
}

export async function listWallets(includeBalances = false): Promise<OpenClawWallet[]> {
  const qs = includeBalances ? "?includeBalances=true" : ""
  return fetchApi<OpenClawWallet[]>(`/api/agent/wallets${qs}`)
}

export async function createWallet(params: { label: string; network: string; exportPassphrase: string; exportPassphraseStorageType: string; exportPassphraseStorageRef: string }): Promise<OpenClawWallet> {
  return fetchApi<OpenClawWallet>("/api/agent/wallets/create", { method: "POST", body: JSON.stringify({ ...params, confirmExportPassphraseSaved: true }) })
}

export async function transfer(params: { walletId?: number; walletLabel?: string; to: string; token?: string; amountDisplay?: string; valueBaseUnits?: string; chain?: string; memo?: string }): Promise<TransferResult> {
  return fetchApi<TransferResult>("/api/agent/transfer", { method: "POST", body: JSON.stringify(params) })
}

export async function getTransactions(opts: { walletId?: number; walletLabel?: string; walletAddress?: string; network?: string }): Promise<any[]> {
  const qs = new URLSearchParams()
  if (opts.walletId) qs.set("walletId", String(opts.walletId))
  if (opts.walletLabel) qs.set("walletLabel", opts.walletLabel)
  if (opts.walletAddress) qs.set("walletAddress", opts.walletAddress)
  if (opts.network) qs.set("network", opts.network)
  return fetchApi<any[]>(`/api/agent/transactions?${qs.toString()}`)
}
