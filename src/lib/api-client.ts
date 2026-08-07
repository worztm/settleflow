const API_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("sf_token") : null
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options?.headers } })
  const data: any = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data
}

export const api = {
  auth: {
    register: (email: string, password: string, displayName?: string) =>
      request<{ user: any; token: string; wallet: any | null }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      }),
    login: (email: string, password: string) =>
      request<{ user: any; token: string; wallets: any[] }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: any; wallets: any[] }>("/auth/me"),
    forgotPassword: (email: string) =>
      request<{ success: boolean; message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (email: string, code: string, newPassword: string) =>
      request<{ success: boolean; message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword }),
      }),
    sendSignInCode: (email: string) =>
      request<{ success: boolean; message: string }>("/auth/send-signin-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    verifySignInCode: (email: string, code: string) =>
      request<{ user: any; token: string; wallets: any[] }>("/auth/verify-signin-code", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }),
    deleteAccount: () => request<{ success: boolean; message: string }>("/auth/account", { method: "DELETE" }),
  },
  wallets: {
    list: () => request<{ wallets: any[] }>("/wallets"),
    create: (label?: string) =>
      request<{ wallet: any }>("/wallets/create", {
        method: "POST",
        body: JSON.stringify({ label }),
      }),
    balance: () => request<{ wallets: any[]; totalBalance: string }>("/wallets/balance"),
    sync: () => request<{ synced: any[]; newTransactions: any[]; wallets: any[]; transactions: any[] }>("/wallets/sync", { method: "POST" }),
  },
  transactions: {
    list: (limit = 20, offset = 0) =>
      request<{ transactions: any[] }>(`/transactions?limit=${limit}&offset=${offset}`),
    send: (walletId: string, to: string, amount: string, token?: string, memo?: string) =>
      request<{ transaction: any }>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ walletId, to, amount, token, memo }),
      }),
  },
  schedules: {
    list: () => request<{ schedules: any[] }>("/schedules"),
    create: (data: { title: string; amount: string; token?: string; recipient: string; frequency: string; description?: string; nextRun?: string; conditions?: string }) =>
      request<{ schedule: any }>("/schedules/create", { method: "POST", body: JSON.stringify(data) }),
    aiCreate: (text: string) =>
      request<{ schedule: any }>("/schedules/ai-create", { method: "POST", body: JSON.stringify({ text }) }),
    execute: (id: string) =>
      request<{ executed: boolean; transaction: any; nextRun: string }>(`/schedules/${id}/execute`, { method: "POST" }),
    update: (id: string, data: { status?: string }) =>
      request<{ schedule: any }>(`/schedules/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/schedules/${id}`, { method: "DELETE" }),
  },
  payees: {
    list: () => request<{ payees: any[] }>("/payees"),
    create: (data: { name: string; walletAddress: string; category?: string; notes?: string }) =>
      request<{ payee: any }>("/payees", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; walletAddress?: string; category?: string; notes?: string }) =>
      request<{ payee: any }>(`/payees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/payees/${id}`, { method: "DELETE" }),
  },
  plans: {
    list: () => request<{ plans: any[] }>("/plans"),
    create: (data: { payeeId: string; purpose?: string; amount: string; token?: string; frequency?: string; payDay?: number | null; startDate?: string | null; sourceWalletId?: string | null }) =>
      request<{ plan: any }>("/plans", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { purpose?: string; amount?: string; frequency?: string; payDay?: number | null; startDate?: string | null; sourceWalletId?: string | null; status?: string }) =>
      request<{ plan: any }>(`/plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    execute: (id: string) =>
      request<{ executed: boolean; transaction: any; nextRun: string | null }>(`/plans/${id}/execute`, { method: "POST" }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/plans/${id}`, { method: "DELETE" }),
  },
  ai: {
    parseIntent: (text: string) =>
      request<{ intent: any }>("/ai/parse-intent", { method: "POST", body: JSON.stringify({ text }) }),
  },
}