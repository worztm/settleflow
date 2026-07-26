import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits, getAddress, defineChain } from "viem"

// Arc Testnet chain definition for viem
// Verified: chainId=5039954 via eth_chainId, actively running with 53M+ blocks
const arcTestnet = defineChain({
  id: 5_039_954,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.io"] },
  },
})

const ARC_RPC = "https://rpc.testnet.arc.io"
// Arc is a standard EVM chain: smallest unit is wei (10^-18).
// The chain metadata has decimals:6 as a UI hint ("this is USDC"), but on-chain
// balances are 18-decimal wei just like Ethereum. Verified via eth_getBalance.
const USDC_DECIMALS = 18

const ENCRYPTION_SECRET = "settleflow-wallet-key-" // prefix for simple XOR obfuscation; replace with real encryption in production

function encryptPrivateKey(pk: `0x${string}`): string {
  // Simple XOR-based obfuscation for storage (not production-grade — use a proper KMS in production)
  const key = ENCRYPTION_SECRET
  let result = ""
  for (let i = 0; i < pk.length; i++) {
    result += String.fromCharCode(pk.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result)
}

function decryptPrivateKey(encrypted: string): `0x${string}` {
  const key = ENCRYPTION_SECRET
  const decoded = atob(encrypted)
  let result = ""
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return result as `0x${string}`
}

export interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
  AI: Ai
  ENVIRONMENT: string
  OPENCLAW_API_KEY: string
  CIRCLE_API_KEY?: string
  SCHEDULE_QUEUE: Queue
  RESEND_API_KEY?: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    const path = url.pathname

    try {
      // Auth
      if (path === "/api/auth/register" && request.method === "POST") return handleRegister(request, env)
      if (path === "/api/auth/login" && request.method === "POST") return handleLogin(request, env)
      if (path === "/api/auth/me" && request.method === "GET") return handleGetMe(request, env)
      if (path === "/api/auth/forgot-password" && request.method === "POST") return handleForgotPassword(request, env)
      if (path === "/api/auth/reset-password" && request.method === "POST") return handleResetPassword(request, env)
      if (path === "/api/auth/send-signin-code" && request.method === "POST") return handleSendSignInCode(request, env)
      if (path === "/api/auth/verify-signin-code" && request.method === "POST") return handleVerifySignInCode(request, env)
      if (path === "/api/auth/account" && request.method === "DELETE") return handleDeleteAccount(request, env)
      if (path === "/api/admin/backfill-wallets" && request.method === "POST") return handleBackfillWallets(request, env)

      // Wallets
      if (path === "/api/wallets" && request.method === "GET") return handleGetWallets(request, env)
      if (path === "/api/wallets/create" && request.method === "POST") return handleCreateWallet(request, env)
      if (path === "/api/wallets/balance" && request.method === "GET") return handleGetBalance(request, env)
      if (path === "/api/wallets/sync" && request.method === "POST") return handleSyncWallets(request, env)

      // Transactions
      if (path === "/api/transactions" && request.method === "GET") return handleGetTransactions(request, env)
      if (path === "/api/transactions/send" && request.method === "POST") return handleSendTransaction(request, env)

      // Schedules
      if (path === "/api/schedules" && request.method === "GET") return handleGetSchedules(request, env)
      if (path === "/api/schedules/create" && request.method === "POST") return handleCreateSchedule(request, env)
      if (path === "/api/schedules/ai-create" && request.method === "POST") return handleAICreateSchedule(request, env)
      if (path.match(/^\/api\/schedules\/[\w-]+\/execute$/) && request.method === "POST") return handleExecuteSchedule(request, env)
      if (path.match(/^\/api\/schedules\/[\w-]+$/) && request.method === "DELETE") return handleDeleteSchedule(request, env)

      // AI
      if (path === "/api/ai/parse-intent" && request.method === "POST") return handleAIParseIntent(request, env)

      return json({ error: "Not found" }, 404)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  },

  // Queue consumer — processes due schedules
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await processScheduledExecution(msg.body.scheduleId, msg.body.userId, env)
        msg.ack()
      } catch (err: any) {
        console.error("Scheduled payment failed:", err.message)
        msg.retry()
      }
    }
  },

  // Cron trigger — checks for due schedules and queues them for execution
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(queueDueSchedules(env))
  },
}

// ─── On-Chain USDC Transfer (Arc-native — native currency IS USDC) ─────

async function sendUsdc(to: string, amount: string, privateKey: `0x${string}`, env: Env): Promise<`0x${string}`> {
  const walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: arcTestnet,
    transport: http(undefined, { timeout: 15_000 }),
  })

  // Arc is an EVM chain — smallest unit is wei (10^-18), same as Ethereum.
  // Even though chain metadata says decimals:6, getBalance returns 18-dec wei.
  const value = parseUnits(amount, USDC_DECIMALS)
  if (value <= 0n) throw new Error("Amount must be positive")

  const hash = await walletClient.sendTransaction({
    to: getAddress(to),
    value,
  })

  console.error("sendUsdc success:", hash, "to:", to, "amount:", amount)
  return hash
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getUserId(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return null
  const token = auth.slice(7)
  return await env.SESSIONS.get(token)
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
}

// ─── Beautiful Email Templates ───────────────────────────────────────────

const LOGO_SVG = `<svg width="40" height="40" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="36" height="36" rx="8" fill="#000"/>
  <path d="M10 22c0-4 3-7 8-7s8 3 8 7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <path d="M12 14c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.6"/>
  <circle cx="18" cy="25" r="2" fill="#fff"/>
  <path d="M24 25l2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`

function buildEmailHtml(title: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding:0 0 20px 0;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="vertical-align:middle;">
                    ${LOGO_SVG}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:6px;">
                    <span style="font-size:18px;font-weight:700;color:#18181b;letter-spacing:-0.3px;">SettleFlow</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:16px 0 0 0;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.4;">
                SettleFlow &mdash; Automated USDC Settlements<br>
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildPasswordResetEmail(code: string): string {
  return buildEmailHtml(
    "Reset your SettleFlow password",
    `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">Password reset</h1>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:24px;">
          <p style="margin:0;font-size:15px;color:#52525b;line-height:1.5;">
            We received a request to reset your SettleFlow password. Enter the code below to set a new one. This code expires in <strong style="color:#18181b;">15 minutes</strong>.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:10px;">
            <tr>
              <td align="center" style="padding:20px;">
                <p style="margin:0 0 6px 0;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:500;">Your reset code</p>
                <p style="margin:0;font-size:38px;font-weight:700;color:#18181b;letter-spacing:8px;font-family:'SF Mono',Monaco,'Cascadia Code','Courier New',monospace;">${code}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
            If you didn't request a password reset, you can safely ignore this email. No changes have been made to your account.
          </p>
        </td>
      </tr>
    </table>`
  )
}

function buildSignInCodeEmail(code: string): string {
  return buildEmailHtml(
    "Your SettleFlow sign-in code",
    `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">Sign in to SettleFlow</h1>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:24px;">
          <p style="margin:0;font-size:15px;color:#52525b;line-height:1.5;">
            Use the code below to complete your sign in. This code expires in <strong style="color:#18181b;">10 minutes</strong>. Never share this code with anyone.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:10px;">
            <tr>
              <td align="center" style="padding:20px;">
                <p style="margin:0 0 6px 0;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:500;">Your sign-in code</p>
                <p style="margin:0;font-size:38px;font-weight:700;color:#18181b;letter-spacing:8px;font-family:'SF Mono',Monaco,'Cascadia Code','Courier New',monospace;">${code}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
            If you didn't request this code, someone may be trying to access your account. You can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>`
  )
}

// ─── Email via Resend (free tier: 100 emails/day) ───────────────────────

async function sendEmail(to: string, subject: string, htmlBody: string, env: Env): Promise<void> {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured. Get a free key at https://resend.com")
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SettleFlow <noreply@auth.settleflows.app>",
      to: [to],
      subject,
      html: htmlBody,
    }),
  })

  if (!res.ok) {
    let detail = ""
    try { const j = await res.json(); detail = j.message || j.errors?.map((e:any) => e.message).join(", ") || JSON.stringify(j) } catch { detail = await res.text() }
    console.error("Resend send failed:", res.status, detail)
    throw new Error(`Failed to send email (${res.status}): ${detail}`)
  }
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

async function createSession(userId: string, env: Env): Promise<string> {
  const tokenBytes = new Uint8Array(32)
  crypto.getRandomValues(tokenBytes)
  const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("")
  await env.SESSIONS.put(token, userId, { expirationTtl: 604800 })
  return token
}

// ─── Viem Wallet Creation & On-Chain Balance ────────────────────────────

function createViemWallet(): { address: `0x${string}`; privateKey: `0x${string}` } {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return { address: account.address, privateKey }
}

async function getUsdcBalance(address: string): Promise<string> {
  try {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(undefined, { timeout: 10_000 }),
    })
    const checksummed = getAddress(address)
    // Arc is USDC-native — the native balance IS the USDC balance
    const balanceWei = await client.getBalance({ address: checksummed })
    const formatted = parseFloat(formatUnits(balanceWei, USDC_DECIMALS))
    return formatted.toFixed(2)
  } catch (err: any) {
    console.error("Balance check failed:", err.message)
    return "0.00"
  }
}

async function createWalletAnyway(env: Env, label: string): Promise<{ id: string; address: string; privateKey: `0x${string}` } | null> {
  try {
    const wallet = createViemWallet()
    console.error("Created viem wallet:", wallet.address)
    return {
      id: crypto.randomUUID(),
      address: wallet.address,
      privateKey: wallet.privateKey,
    }
  } catch (err: any) {
    console.error("Viem wallet creation failed:", err.message)
    return null
  }
}

// ─── Auth Handlers ─────────────────────────────────────────────────────────

async function handleRegister(request: Request, env: Env) {
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { email, password, displayName } = body
  if (!email || !password) return json({ error: "Email and password required" }, 400)

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()
  if (existing) return json({ error: "Email already registered" }, 409)

  const passwordHash = await hashPassword(password)
  const id = crypto.randomUUID()
  const name = displayName || email.split("@")[0]

  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).bind(id, email, passwordHash, name).run()

  // Create a real Arc wallet using viem
  let wallet: { id: string; address: string; privateKey: `0x${string}` } | null = null
  let realBalance = "0.00"
  try {
    console.error("Creating wallet for user:", name)
    wallet = await createWalletAnyway(env, `settleflow-${name}-${id.slice(0, 8)}`)
    console.error("Wallet result:", wallet?.address)

    if (wallet) {
      const encKey = encryptPrivateKey(wallet.privateKey)
      await env.DB.prepare(
        "INSERT INTO wallets (id, user_id, address, chain, label, is_primary, balance, private_key) VALUES (?, ?, ?, 'arc', ?, 1, '0', ?)"
      ).bind(wallet.id, id, wallet.address, `Arc Wallet (${name})`, encKey).run()

      // Fetch real on-chain balance
      try {
        realBalance = await getUsdcBalance(wallet.address)
        await env.DB.prepare("UPDATE wallets SET balance = ? WHERE id = ?").bind(realBalance, wallet.id).run()
      } catch {}

      wallet = { ...wallet, id: wallet.id, address: wallet.address }
    }
  } catch (err: any) {
    console.error("Wallet creation failed:", err.message)
  }

  const token = await createSession(id, env)
  return json({
    user: { id, email, displayName: name },
    token,
    wallet: wallet ? { id: wallet.id, address: wallet.address, chain: "arc", label: `Arc Wallet (${name})`, isPrimary: true, balance: realBalance } : null,
  })
}

async function handleLogin(request: Request, env: Env) {
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { email, password } = body
  if (!email || !password) return json({ error: "Email and password required" }, 400)

  const user = await env.DB.prepare(
    "SELECT id, email, display_name, created_at FROM users WHERE email = ? AND password_hash = ?"
  ).bind(email, await hashPassword(password)).first()
  if (!user) return json({ error: "Invalid email or password" }, 401)

  const token = await createSession(user.id as string, env)

  // Fetch wallets with on-chain balance check
  await syncUserWalletBalances(user.id as string, env)

  const wallets = await env.DB.prepare(
    "SELECT id, address, chain, label, is_primary, balance, created_at FROM wallets WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC"
  ).bind(user.id).all()

  return json({
    user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at },
    token,
    wallets: wallets.results.map((w: any) => ({
      id: w.id, address: w.address, chain: w.chain, label: w.label,
      isPrimary: !!w.is_primary, balance: w.balance, createdAt: w.created_at,
    })),
  })
}

async function syncUserWalletBalances(userId: string, env: Env) {
  const wallets = await env.DB.prepare(
    "SELECT id, address, balance, private_key FROM wallets WHERE user_id = ?"
  ).bind(userId).all()

  for (const w of (wallets.results as any[])) {
    // If wallet has no private_key, it's a pre-fix placeholder — replace with real wallet
    if (!w.private_key) {
      try {
        const realWallet = createViemWallet()
        const encKey = encryptPrivateKey(realWallet.privateKey)
        await env.DB.prepare(
          "UPDATE wallets SET address = ?, private_key = ? WHERE id = ?"
        ).bind(realWallet.address, encKey, w.id).run()
        console.error("Replaced placeholder wallet with real:", realWallet.address)
        w.address = realWallet.address
      } catch (err: any) {
        console.error("Failed to replace placeholder wallet:", err.message)
        continue
      }
    }

    try {
      const onChainBalance = await getUsdcBalance(w.address)
      const currentBalance = parseFloat(w.balance || "0")
      const newBalance = parseFloat(onChainBalance)

      if (newBalance > currentBalance) {
        const diff = (newBalance - currentBalance).toFixed(2)
        await env.DB.prepare(
          `INSERT INTO transactions (id, user_id, wallet_id, type, amount, token, status, created_at)
           VALUES (?, ?, ?, 'receive', ?, 'USDC', 'confirmed', datetime('now'))`
        ).bind(crypto.randomUUID(), userId, w.id, diff).run()
      }

      if (newBalance !== currentBalance) {
        await env.DB.prepare("UPDATE wallets SET balance = ? WHERE id = ?").bind(onChainBalance, w.id).run()
      }
    } catch {}
  }
}

async function handleGetMe(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)

  const user = await env.DB.prepare(
    "SELECT id, email, display_name, created_at FROM users WHERE id = ?"
  ).bind(userId).first()
  if (!user) return json({ error: "User not found" }, 404)

  const wallets = await env.DB.prepare(
    "SELECT id, address, chain, label, is_primary, balance, created_at FROM wallets WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC"
  ).bind(userId).all()

  return json({
    user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at },
    wallets: wallets.results.map((w: any) => ({
      id: w.id, address: w.address, chain: w.chain, label: w.label,
      isPrimary: !!w.is_primary, balance: w.balance, createdAt: w.created_at,
    })),
  })
}

// ─── Forgot / Reset Password ────────────────────────────────────────────

async function handleForgotPassword(request: Request, env: Env) {
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { email } = body
  if (!email) return json({ error: "Email is required" }, 400)

  // Check user exists (don't reveal whether email exists for security)
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()
  if (!user) {
    return json({ success: true, message: "If that email is registered, a reset code has been sent." })
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // Store in KV with 15-minute TTL, keyed by reset:<email>
  await env.SESSIONS.put(`reset:${email}`, code, { expirationTtl: 900 })

  // Send email with the reset code
  try {
    await sendEmail(
      email,
      "Reset your SettleFlow password",
      buildPasswordResetEmail(code),
      env
    )
  } catch (err: any) {
    console.error("Failed to send reset email:", err.message)
    return json({ error: "Failed to send reset email. Please try again later." }, 500)
  }

  return json({ success: true, message: "If that email is registered, a reset code has been sent." })
}

async function handleResetPassword(request: Request, env: Env) {
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { email, code, newPassword } = body

  if (!email || !code || !newPassword) {
    return json({ error: "Email, code, and new password are required" }, 400)
  }
  if (newPassword.length < 6) {
    return json({ error: "Password must be at least 6 characters" }, 400)
  }

  // Verify code from KV
  const storedCode = await env.SESSIONS.get(`reset:${email}`)
  if (!storedCode || storedCode !== code) {
    return json({ error: "Invalid or expired reset code" }, 400)
  }

  // Find user
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()
  if (!user) {
    return json({ error: "User not found" }, 404)
  }

  // Update password
  const passwordHash = await hashPassword(newPassword)
  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, user.id).run()

  // Delete the used code
  await env.SESSIONS.delete(`reset:${email}`)

  return json({ success: true, message: "Password reset successfully. You can now sign in with your new password." })
}

// ─── Sign-In via Email Code ───────────────────────────────────────────────

async function handleSendSignInCode(request: Request, env: Env) {
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { email } = body
  if (!email) return json({ error: "Email is required" }, 400)

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // Store in KV with 10-minute TTL, keyed by signin:<email>
  await env.SESSIONS.put(`signin:${email}`, code, { expirationTtl: 600 })

  // Send email with the sign-in code
  try {
    await sendEmail(
      email,
      "Your SettleFlow sign-in code",
      buildSignInCodeEmail(code),
      env
    )
  } catch (err: any) {
    console.error("Failed to send sign-in code email:", err.message)
    return json({ error: "Failed to send sign-in code. Please try again later." }, 500)
  }

  return json({ success: true, message: "Sign-in code sent to your email." })
}

async function handleVerifySignInCode(request: Request, env: Env) {
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { email, code } = body

  if (!email || !code) {
    return json({ error: "Email and code are required" }, 400)
  }

  // Verify code from KV
  const storedCode = await env.SESSIONS.get(`signin:${email}`)
  if (!storedCode || storedCode !== code) {
    return json({ error: "Invalid or expired sign-in code" }, 400)
  }

  // Find or create user
  let user = await env.DB.prepare("SELECT id, email, display_name, created_at FROM users WHERE email = ?").bind(email).first()

  if (!user) {
    // Auto-register with email-only account (no password)
    const id = crypto.randomUUID()
    const name = email.split("@")[0]
    await env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, '', ?, datetime('now'))"
    ).bind(id, email, name).run()
    user = { id, email, display_name: name }

    // Create a wallet for the new user
    try {
      const wallet = await createWalletAnyway(env, `settleflow-${name}-${id.slice(0, 8)}`)
      if (wallet) {
        const encKey = encryptPrivateKey(wallet.privateKey)
        await env.DB.prepare(
          "INSERT INTO wallets (id, user_id, address, chain, label, is_primary, balance, private_key) VALUES (?, ?, ?, 'arc', ?, 1, '0', ?)"
        ).bind(wallet.id, id, wallet.address, `Arc Wallet (${name})`, encKey).run()
      }
    } catch {}
  }

  // Delete the used code
  await env.SESSIONS.delete(`signin:${email}`)

  // Create session
  const token = await createSession((user as any).id, env)

  // Fetch wallets
  await syncUserWalletBalances((user as any).id, env)
  const wallets = await env.DB.prepare(
    "SELECT id, address, chain, label, is_primary, balance, created_at FROM wallets WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC"
  ).bind((user as any).id).all()

  return json({
    user: { id: (user as any).id, email: (user as any).email, displayName: (user as any).display_name, createdAt: (user as any).created_at },
    token,
    wallets: wallets.results.map((w: any) => ({
      id: w.id, address: w.address, chain: w.chain, label: w.label,
      isPrimary: !!w.is_primary, balance: w.balance, createdAt: w.created_at,
    })),
  })
}

// ─── Account Deletion ─────────────────────────────────────────────────────

async function handleDeleteAccount(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)

  // Delete all user data
  await env.DB.prepare("DELETE FROM transactions WHERE user_id = ?").bind(userId).run()
  await env.DB.prepare("DELETE FROM schedules WHERE user_id = ?").bind(userId).run()
  await env.DB.prepare("DELETE FROM wallets WHERE user_id = ?").bind(userId).run()
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run()

  // Invalidate all sessions for this user
  // (We'd need a list of sessions per user; with current design just delete the current one)
  // This is handled client-side by removing the token

  return json({ success: true, message: "Account permanently deleted" })
}

// ─── Wallet Handlers ───────────────────────────────────────────────────────

async function handleGetWallets(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)

  const wallets = await env.DB.prepare(
    "SELECT id, address, chain, label, is_primary, balance, created_at FROM wallets WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC"
  ).bind(userId).all()

  return json({
    wallets: wallets.results.map((w: any) => ({
      id: w.id, address: w.address, chain: w.chain, label: w.label,
      isPrimary: !!w.is_primary, balance: w.balance, createdAt: w.created_at,
    })),
  })
}

async function handleCreateWallet(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { label } = body

  const user = await env.DB.prepare("SELECT display_name FROM users WHERE id = ?").bind(userId).first()
  const name = (user as any)?.display_name || "user"

  try {
    const viemWallet = await createWalletAnyway(env, `settleflow-${name}-${Date.now()}`)
    if (!viemWallet) {
      return json({ error: "Could not create wallet. Try again later." }, 502)
    }
    const encKey = encryptPrivateKey(viemWallet.privateKey)
    await env.DB.prepare(
      "INSERT INTO wallets (id, user_id, address, chain, label, is_primary, balance, private_key) VALUES (?, ?, ?, 'arc', ?, 0, '0', ?)"
    ).bind(viemWallet.id, userId, viemWallet.address, label || `Arc Wallet`, encKey).run()

    // Fetch real on-chain balance
    let realBalance = "0.00"
    try {
      realBalance = await getUsdcBalance(viemWallet.address)
      await env.DB.prepare("UPDATE wallets SET balance = ? WHERE id = ?").bind(realBalance, viemWallet.id).run()
    } catch {}

    return json({
      wallet: { id: viemWallet.id, address: viemWallet.address, chain: "arc", label: label || "Arc Wallet", isPrimary: false, balance: realBalance },
    })
  } catch (err: any) {
    return json({ error: `Failed to create wallet: ${err.message}` }, 500)
  }
}

async function handleGetBalance(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)

  const wallets = await env.DB.prepare(
    "SELECT id, address, chain, label, is_primary, balance FROM wallets WHERE user_id = ? ORDER BY is_primary DESC"
  ).bind(userId).all()

  const totalBalance = (wallets.results as any[]).reduce((sum: number, w: any) => sum + parseFloat(w.balance || "0"), 0)

  return json({
    wallets: wallets.results.map((w: any) => ({
      id: w.id, address: w.address, chain: w.chain, label: w.label,
      isPrimary: !!w.is_primary, balance: w.balance,
    })),
    totalBalance: totalBalance.toFixed(2),
  })
}

// ─── Wallet Sync (on-chain balance & incoming tx detection) ──────────────

async function handleSyncWallets(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)

  const wallets = await env.DB.prepare(
    "SELECT id, address, chain, label, is_primary, balance FROM wallets WHERE user_id = ?"
  ).bind(userId).all()

  const results: any[] = []
  const newTransactions: any[] = []

  for (const w of (wallets.results as any[])) {
    try {
      // Check real on-chain USDC balance via Arc RPC
      const onChainBalance = await getUsdcBalance(w.address)
      const currentBalance = parseFloat(w.balance || "0")
      const newBalance = parseFloat(onChainBalance)

      // If on-chain balance is higher than stored, it means we received
      if (newBalance > currentBalance) {
        const diff = (newBalance - currentBalance).toFixed(2)
        const txId = crypto.randomUUID()
        // Record as a receive transaction
        await env.DB.prepare(
          `INSERT INTO transactions (id, user_id, wallet_id, type, amount, token, status, created_at)
           VALUES (?, ?, ?, 'receive', ?, 'USDC', 'confirmed', datetime('now'))`
        ).bind(txId, userId, w.id, diff).run()
        newTransactions.push({ id: txId, amount: diff, type: "receive", address: w.address })
      }

      // Update stored balance to on-chain value
      if (newBalance !== currentBalance) {
        await env.DB.prepare("UPDATE wallets SET balance = ? WHERE id = ?").bind(onChainBalance, w.id).run()
      }

      results.push({ address: w.address, balance: onChainBalance, previous: w.balance, synced: true })
    } catch (err: any) {
      console.error("Sync failed for wallet", w.address, err.message)
      results.push({ address: w.address, balance: w.balance, synced: false, reason: err.message })
    }
  }

  // Re-fetch fresh data
  const freshWallets = await env.DB.prepare(
    "SELECT id, address, chain, label, is_primary, balance, created_at FROM wallets WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC"
  ).bind(userId).all()

  const freshTxs = await env.DB.prepare(
    "SELECT id, wallet_id, tx_hash, type, amount, token, status, recipient, counterparty, memo, fee, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
  ).bind(userId).all()

  return json({
    synced: results,
    newTransactions,
    wallets: freshWallets.results.map((w: any) => ({
      id: w.id, address: w.address, chain: w.chain, label: w.label,
      isPrimary: !!w.is_primary, balance: w.balance, createdAt: w.created_at,
    })),
    transactions: freshTxs.results.map((tx: any) => ({
      id: tx.id, walletId: tx.wallet_id, txHash: tx.tx_hash, type: tx.type,
      amount: tx.amount, token: tx.token, status: tx.status, recipient: tx.recipient,
      counterparty: tx.counterparty, memo: tx.memo, fee: tx.fee, createdAt: tx.created_at,
    })),
  })
}

// ─── Transaction Handlers ─────────────────────────────────────────────────

async function handleGetTransactions(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)

  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get("limit") || "20")
  const offset = parseInt(url.searchParams.get("offset") || "0")

  const txs = await env.DB.prepare(
    `SELECT id, wallet_id, tx_hash, type, amount, token, status, recipient, counterparty, memo, fee, created_at
     FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(userId, limit, offset).all()

  return json({
    transactions: txs.results.map((tx: any) => ({
      id: tx.id, walletId: tx.wallet_id, txHash: tx.tx_hash, type: tx.type,
      amount: tx.amount, token: tx.token, status: tx.status, recipient: tx.recipient,
      counterparty: tx.counterparty, memo: tx.memo, fee: tx.fee, createdAt: tx.created_at,
    })),
  })
}

async function handleSendTransaction(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { walletId, to, amount, token, memo } = body
  if (!walletId || !to || !amount) return json({ error: "walletId, to, and amount required" }, 400)

  // Get wallet with private key
  const wallet = await env.DB.prepare(
    "SELECT id, address, private_key FROM wallets WHERE id = ? AND user_id = ?"
  ).bind(walletId, userId).first()
  if (!wallet) return json({ error: "Wallet not found" }, 404)

  const txId = crypto.randomUUID()
  let txHash: `0x${string}` | null = null

  try {
    // Decrypt private key and send on-chain
    const privKey = decryptPrivateKey((wallet as any).private_key)
    txHash = await sendUsdc(to, amount, privKey, env)
  } catch (err: any) {
    console.error("Send failed:", err.message)
    // Record as failed transaction
    await env.DB.prepare(
      "INSERT INTO transactions (id, user_id, wallet_id, type, amount, token, status, recipient, memo, created_at) VALUES (?, ?, ?, 'send', ?, ?, 'failed', ?, ?, datetime('now'))"
    ).bind(txId, userId, walletId, amount, token || "USDC", to, memo || "").run()
    return json({ error: `Payment failed: ${err.message}` }, 502)
  }

  // Record as confirmed transaction with tx hash
  await env.DB.prepare(
    "INSERT INTO transactions (id, user_id, wallet_id, tx_hash, type, amount, token, status, recipient, memo, created_at) VALUES (?, ?, ?, ?, 'send', ?, ?, 'confirmed', ?, ?, datetime('now'))"
  ).bind(txId, userId, walletId, txHash, amount, token || "USDC", to, memo || "").run()

  // Update wallet balance
  try {
    const newBalance = await getUsdcBalance((wallet as any).address)
    await env.DB.prepare("UPDATE wallets SET balance = ? WHERE id = ?").bind(newBalance, walletId).run()
  } catch {}

  return json({
    transaction: { id: txId, txHash, walletId, type: "send", amount, token: token || "USDC", status: "confirmed", recipient: to, memo: memo || "", createdAt: new Date().toISOString() },
  })
}

// ─── Schedule Handlers ────────────────────────────────────────────────────

async function handleGetSchedules(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)

  const schedules = await env.DB.prepare(
    "SELECT id, title, description, amount, token, recipient, frequency, next_run, status, conditions, created_at FROM schedules WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all()

  return json({
    schedules: schedules.results.map((s: any) => ({
      id: s.id, title: s.title, description: s.description, amount: s.amount,
      token: s.token, recipient: s.recipient, frequency: s.frequency,
      nextRun: s.next_run, status: s.status, conditions: s.conditions, createdAt: s.created_at,
    })),
  })
}

async function handleCreateSchedule(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { title, description, amount, token, recipient, frequency, nextRun, conditions } = body
  if (!title || !amount || !recipient || !frequency) return json({ error: "title, amount, recipient, and frequency required" }, 400)

  const id = crypto.randomUUID()
  await env.DB.prepare(
    "INSERT INTO schedules (id, user_id, title, description, amount, token, recipient, frequency, next_run, status, conditions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)"
  ).bind(id, userId, title, description || "", amount, token || "USDC", recipient, frequency, nextRun || null, conditions || null).run()

  return json({
    schedule: { id, title, description, amount, token: token || "USDC", recipient, frequency, nextRun: nextRun || null, status: "active", conditions: conditions || null, createdAt: new Date().toISOString() },
  })
}

function computeNextRun(frequency: string): string {
  const now = new Date()
  switch (frequency) {
    case "daily": now.setDate(now.getDate() + 1); break
    case "weekly":
    case "weekly-monday":
    case "weekly-friday": now.setDate(now.getDate() + 7); break
    case "bi-weekly": now.setDate(now.getDate() + 14); break
    case "monthly": now.setMonth(now.getMonth() + 1); break
    default: now.setDate(now.getDate() + 7); break
  }
  return now.toISOString()
}

async function handleAICreateSchedule(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { text } = body
  if (!text) return json({ error: "Text required" }, 400)

  // Use AI to parse scheduling intent
  try {
    const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
      messages: [{
        role: "system",
        content: `You are a payment scheduling assistant. Extract a structured schedule from natural language.
Return ONLY valid JSON (no markdown, no backticks, no explanation text, ONLY the JSON object itself) with these fields:
- title: string (short title for the schedule)
- description: string (brief description)
- amount: string (numeric amount, e.g. "150")
- token: string (token symbol, default "USDC")
- recipient: string (recipient address or identifier)
- frequency: string (one of: "daily", "weekly", "bi-weekly", "monthly", "weekly-monday", "weekly-friday")
- conditions: string | null (any conditions like "if balance > 1000")

Examples:
"send 500 USDC to alice.arc every friday" → {"title":"Weekly payment to alice.arc","description":"Auto-send 500 USDC every Friday","amount":"500","token":"USDC","recipient":"alice.arc","frequency":"weekly-friday","conditions":null}

"pay bob 200 USDC every month" → {"title":"Monthly payment to bob","description":"200 USDC monthly recurring","amount":"200","token":"USDC","recipient":"bob","frequency":"monthly","conditions":null}

"schedule 100 USDC to alice@arc every week if balance is over 500" → {"title":"Conditional weekly payment","description":"100 USDC weekly if balance > 500","amount":"100","token":"USDC","recipient":"alice@arc","frequency":"weekly","conditions":"balance > 500"}`,
      }, {
        role: "user",
        content: text,
      }],
    })

    const responseText = (aiResponse as any).response || ""
    console.error("AI raw schedule response:", responseText)
    console.error("AI response type:", typeof responseText)
    let scheduleData: any
    try {
      const text = String(responseText)
      scheduleData = JSON.parse(text)
    } catch {
      try {
        const text = String(responseText)
        const start = text.indexOf("{")
        const end = text.lastIndexOf("}")
        if (start !== -1 && end > start) {
          scheduleData = JSON.parse(text.slice(start, end + 1))
        }
      } catch {}
    }
    if (!scheduleData) {
      try {
        const text = String(responseText)
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (match) scheduleData = JSON.parse(match[1])
      } catch {}
    }

    if (!scheduleData) {
      return json({ error: "Could not parse scheduling intent. Try: 'send 100 USDC to alice.arc every friday'" }, 400)
    }

    const id = crypto.randomUUID()
    const nextRun = computeNextRun(scheduleData.frequency || "weekly")

    await env.DB.prepare(
      "INSERT INTO schedules (id, user_id, title, description, amount, token, recipient, frequency, next_run, status, conditions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)"
    ).bind(
      id, userId,
      scheduleData.title || `Schedule: ${scheduleData.amount} ${scheduleData.token} to ${scheduleData.recipient}`,
      scheduleData.description || "",
      scheduleData.amount,
      scheduleData.token || "USDC",
      scheduleData.recipient,
      scheduleData.frequency || "weekly",
      nextRun,
      scheduleData.conditions || null
    ).run()

    return json({
      schedule: {
        id, title: scheduleData.title || `Scheduled Payment`, description: scheduleData.description || "",
        amount: scheduleData.amount, token: scheduleData.token || "USDC",
        recipient: scheduleData.recipient, frequency: scheduleData.frequency || "weekly",
        nextRun, status: "active", conditions: scheduleData.conditions || null,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    return json({ error: `AI scheduling failed: ${err.message}` }, 500)
  }
}

async function handleExecuteSchedule(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)

  const url = new URL(request.url)
  const scheduleId = url.pathname.split("/")[3] // /api/schedules/:id/execute

  const schedule = await env.DB.prepare(
    "SELECT id, user_id, amount, token, recipient, frequency, next_run, status, title FROM schedules WHERE id = ? AND user_id = ?"
  ).bind(scheduleId, userId).first()
  if (!schedule) return json({ error: "Schedule not found" }, 404)
  if ((schedule as any).status !== "active") return json({ error: "Schedule is not active" }, 400)

  // Find primary wallet with private key
  const wallet = await env.DB.prepare(
    "SELECT id, address, private_key FROM wallets WHERE user_id = ? AND is_primary = 1 LIMIT 1"
  ).bind(userId).first()
  if (!wallet) return json({ error: "No primary wallet found" }, 400)

  const txId = crypto.randomUUID()
  let txHash: `0x${string}` | null = null

  try {
    const privKey = decryptPrivateKey((wallet as any).private_key)
    txHash = await sendUsdc((schedule as any).recipient, (schedule as any).amount, privKey, env)
  } catch (err: any) {
    console.error("Schedule execution failed:", err.message)
    await env.DB.prepare(
      "INSERT INTO transactions (id, user_id, wallet_id, type, amount, token, status, recipient, memo, created_at) VALUES (?, ?, ?, 'schedule', ?, ?, 'failed', ?, ?, datetime('now'))"
    ).bind(txId, userId, (wallet as any).id, (schedule as any).amount, (schedule as any).token, (schedule as any).recipient, `Scheduled: ${(schedule as any).title || ""}`).run()
    return json({ error: `Schedule execution failed: ${err.message}` }, 502)
  }

  // Record as confirmed transaction
  await env.DB.prepare(
    "INSERT INTO transactions (id, user_id, wallet_id, tx_hash, type, amount, token, status, recipient, memo, created_at) VALUES (?, ?, ?, ?, 'schedule', ?, ?, 'confirmed', ?, ?, datetime('now'))"
  ).bind(txId, userId, (wallet as any).id, txHash, (schedule as any).amount, (schedule as any).token, (schedule as any).recipient, `Scheduled: ${(schedule as any).title || ""}`).run()

  // Update schedule's next_run
  const nextRun = computeNextRun((schedule as any).frequency)
  await env.DB.prepare(
    "UPDATE schedules SET next_run = ? WHERE id = ?"
  ).bind(nextRun, scheduleId).run()

  // Update wallet balance
  try {
    const newBalance = await getUsdcBalance((wallet as any).address)
    await env.DB.prepare("UPDATE wallets SET balance = ? WHERE id = ?").bind(newBalance, (wallet as any).id).run()
  } catch {}

  return json({
    executed: true,
    transaction: { id: txId, txHash, status: "confirmed" },
    nextRun,
  })
}

async function handleDeleteSchedule(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)

  const url = new URL(request.url)
  const scheduleId = url.pathname.split("/")[3] // /api/schedules/:id

  const schedule = await env.DB.prepare(
    "SELECT id FROM schedules WHERE id = ? AND user_id = ?"
  ).bind(scheduleId, userId).first()
  if (!schedule) return json({ error: "Schedule not found" }, 404)

  await env.DB.prepare("DELETE FROM schedules WHERE id = ? AND user_id = ?").bind(scheduleId, userId).run()

  return json({ success: true, message: "Schedule deleted" })
}

// ─── AI Intent Parser ──────────────────────────────────────────────────────

async function handleAIParseIntent(request: Request, env: Env) {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: "Unauthorized" }, 401)
  let body: any
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { text } = body
  if (!text) return json({ error: "Text required" }, 400)

  try {
    const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
      messages: [{
        role: "system",
        content: `You are a payment intent parser for SettleFlow, an Arc.io USDC settlement platform.

Extract structured data from natural language payment instructions.
Return ONLY valid JSON (no markdown, no backticks, no explanation text, ONLY the JSON object itself) with these fields:
- action: "send" | "schedule" | "balance" | "create_wallet" | "swap"
- amount: string (the numeric amount, default "0")
- token: string (token symbol, default "USDC")
- recipient: string | null (recipient address or identifier like alice.arc)
- frequency: string | null (one of: "daily", "weekly", "weekly-monday", "weekly-friday", "bi-weekly", "monthly" or null for one-time)
- executionType: "immediate" | "scheduled"
- conditions: string | null (any conditions like "if balance > 1000")
- summary: string (a concise one-line summary)

If the text mentions scheduling (every, weekly, monthly, recurring, each), set action to "schedule" and executionType to "scheduled".
If the text mentions balance, set action to "balance".
If the text mentions creating a wallet, set action to "create_wallet".

Examples:
"send 500 USDC to alice.arc" → {"action":"send","amount":"500","token":"USDC","recipient":"alice.arc","frequency":null,"executionType":"immediate","conditions":null,"summary":"Send 500 USDC to alice.arc"}

"pay bob 200 USDC every friday" → {"action":"schedule","amount":"200","token":"USDC","recipient":"bob","frequency":"weekly-friday","executionType":"scheduled","conditions":null,"summary":"Schedule 200 USDC to bob every Friday"}

"show my balance" → {"action":"balance","amount":"0","token":"USDC","recipient":null,"frequency":null,"executionType":"immediate","conditions":null,"summary":"Check wallet balance"}

"create a new wallet" → {"action":"create_wallet","amount":"0","token":"USDC","recipient":null,"frequency":null,"executionType":"immediate","conditions":null,"summary":"Create a new wallet"}

"schedule 100 USDC to alice every week if balance is over 500" → {"action":"schedule","amount":"100","token":"USDC","recipient":"alice","frequency":"weekly","executionType":"scheduled","conditions":"balance > 500","summary":"Schedule 100 USDC weekly to alice if balance > 500"}`,
      }, {
        role: "user",
        content: text,
      }],
    })

    const responseText = (aiResponse as any).response || ""
    console.error("AI raw intent response:", responseText)
    let intent: any
    try {
      const t = String(responseText)
      intent = JSON.parse(t)
    } catch {
      try {
        const t = String(responseText)
        const start = t.indexOf("{")
        const end = t.lastIndexOf("}")
        if (start !== -1 && end > start) {
          intent = JSON.parse(t.slice(start, end + 1))
        }
      } catch {}
    }

    if (!intent) {
      intent = {
        action: "send", amount: "0", token: "USDC", recipient: null,
        frequency: null, executionType: "immediate", conditions: null,
        summary: `Parsed: ${text}`,
      }
    }

    // Estimate gas fee for send actions so the frontend can check balance
    let gasEstimate = "0"
    if (intent.action === "send" && parseFloat(intent.amount || "0") > 0) {
      try {
        gasEstimate = await estimateGasFee(userId, intent.amount, env)
      } catch (err: any) {
        console.error("Gas estimation failed:", err.message)
      }
    }

    return json({ intent: { ...intent, gasEstimate } })
  } catch (err: any) {
    console.error("parseIntent error:", err.message)
    return json({
      intent: {
        action: "send", amount: "0", token: "USDC", recipient: null,
        frequency: null, executionType: "immediate", conditions: null,
        summary: `Parsed: ${text}`,
        gasEstimate: "0",
      },
    })
  }
}

// ─── Gas Estimation (Arc native currency IS USDC, so gas comes from same balance) ──

async function estimateGasFee(userId: string, amount: string, env: Env): Promise<string> {
  const wallet = await env.DB.prepare(
    "SELECT address FROM wallets WHERE user_id = ? AND is_primary = 1 LIMIT 1"
  ).bind(userId).first()
  if (!wallet) return "0"

  try {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(undefined, { timeout: 10_000 }),
    })

    const [gasPrice, gasLimit] = await Promise.all([
      client.getGasPrice(),
      client.estimateGas({
        account: (wallet as any).address as `0x${string}`,
        to: (wallet as any).address as `0x${string}`, // dummy self-send for estimate
        value: parseUnits(amount, USDC_DECIMALS),
      }),
    ])

    // gasPrice and gasLimit are both in the smallest unit
    // totalGasCost = gasPrice * gasLimit (in smallest units)
    const totalGasWei = gasPrice * gasLimit
    const gasInUsdc = formatUnits(totalGasWei, USDC_DECIMALS)

    // Add 20% buffer for price fluctuations
    const withBuffer = (parseFloat(gasInUsdc) * 1.2).toFixed(6)
    console.error("Gas estimate:", withBuffer, "USDC for amount:", amount)
    return withBuffer
  } catch (err: any) {
    console.error("Gas estimate failed:", err.message)
    // Fallback: assume ~0.01 USDC which is generous for Arc transfers
    return "0.01"
  }
}

// ─── Queue: Check due schedules and process payments ─────────────────────

async function queueDueSchedules(env: Env) {
  try {
    const now = new Date().toISOString()
    const dueSchedules = await env.DB.prepare(
      "SELECT id, user_id FROM schedules WHERE status = 'active' AND next_run <= ?"
    ).bind(now).all()

    for (const s of (dueSchedules.results as any[])) {
      try {
        await env.SCHEDULE_QUEUE.send({ scheduleId: s.id, userId: s.user_id })
      } catch (err: any) {
        console.error("Failed to queue schedule:", s.id, err.message)
      }
    }
  } catch (err: any) {
    console.error("queueDueSchedules error:", err.message)
  }
}

async function processScheduledExecution(scheduleId: string, userId: string, env: Env) {
  try {
    const schedule = await env.DB.prepare(
      "SELECT id, user_id, amount, token, recipient, frequency, next_run, status, title FROM schedules WHERE id = ? AND user_id = ?"
    ).bind(scheduleId, userId).first()

    if (!schedule || (schedule as any).status !== "active") {
      console.error("Schedule not found or not active:", scheduleId)
      return
    }

    const wallet = await env.DB.prepare(
      "SELECT id, address, private_key FROM wallets WHERE user_id = ? AND is_primary = 1 LIMIT 1"
    ).bind(userId).first()

    if (!wallet) {
      console.error("No primary wallet for user:", userId)
      return
    }

    const txId = crypto.randomUUID()
    let txHash: `0x${string}` | null = null

    try {
      const privKey = decryptPrivateKey((wallet as any).private_key)
      txHash = await sendUsdc((schedule as any).recipient, (schedule as any).amount, privKey, env)
    } catch (err: any) {
      console.error("Scheduled execution on-chain failed:", scheduleId, err.message)
      await env.DB.prepare(
        "INSERT INTO transactions (id, user_id, wallet_id, type, amount, token, status, recipient, memo, created_at) VALUES (?, ?, ?, 'schedule', ?, ?, 'failed', ?, ?, datetime('now'))"
      ).bind(txId, userId, (wallet as any).id, (schedule as any).amount, (schedule as any).token, (schedule as any).recipient, `Scheduled: ${(schedule as any).title || ""}`).run()
      throw err // Re-throw for queue retry
    }

    // Record as confirmed transaction
    await env.DB.prepare(
      "INSERT INTO transactions (id, user_id, wallet_id, tx_hash, type, amount, token, status, recipient, memo, created_at) VALUES (?, ?, ?, ?, 'schedule', ?, ?, 'confirmed', ?, ?, datetime('now'))"
    ).bind(txId, userId, (wallet as any).id, txHash, (schedule as any).amount, (schedule as any).token, (schedule as any).recipient, `Scheduled: ${(schedule as any).title || ""}`).run()

    // Update schedule's next_run
    const nextRun = computeNextRun((schedule as any).frequency)
    await env.DB.prepare(
      "UPDATE schedules SET next_run = ? WHERE id = ?"
    ).bind(nextRun, scheduleId).run()

    // Update wallet balance
    try {
      const newBalance = await getUsdcBalance((wallet as any).address)
      await env.DB.prepare("UPDATE wallets SET balance = ? WHERE id = ?").bind(newBalance, (wallet as any).id).run()
    } catch {}

    console.error("Executed schedule:", scheduleId, "tx:", txHash, "next:", nextRun)
  } catch (err: any) {
    console.error("processScheduledExecution error:", err.message)
    throw err // Re-throw so queue can retry
  }
}

async function handleBackfillWallets(request: Request, env: Env) {
  const auth = request.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ") || auth.slice(7) !== env.ENVIRONMENT + "-admin-secret") {
    return json({ error: "Unauthorized" }, 401)
  }

  const users = await env.DB.prepare(
    "SELECT u.id, u.email, u.display_name FROM users u LEFT JOIN wallets w ON w.user_id = u.id WHERE w.id IS NULL"
  ).all()

  const results: Array<{ email: string; wallet: any; error?: string }> = []
  for (const user of users.results as any[]) {
    try {
      const wallet = await createWalletAnyway(env, `settleflow-${user.display_name || user.email}-${user.id.slice(0,8)}`)
      if (wallet) {
        const encKey = encryptPrivateKey(wallet.privateKey)
        await env.DB.prepare(
          "INSERT INTO wallets (id, user_id, address, chain, label, is_primary, balance, private_key) VALUES (?, ?, ?, 'arc', ?, 1, '0', ?)"
        ).bind(wallet.id, user.id, wallet.address, `Arc Wallet (${user.display_name || user.email})`, encKey).run()
        results.push({ email: user.email, wallet })
      } else {
        results.push({ email: user.email, wallet: null, error: "Wallet creation returned null" })
      }
    } catch (err: any) {
      results.push({ email: user.email, wallet: null, error: err.message })
    }
  }

  return json({ backfilled: results.filter(r => r.wallet).length, failed: results.filter(r => !r.wallet).length, results })
}
