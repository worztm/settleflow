import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { ModeToggle } from "../components/mode-toggle"
import PayrollSection from "../components/payroll"
import { useAuth } from "../lib/auth-context"
import {
  Wallet, Send, CalendarClock, ArrowUpRight, ArrowDownLeft,
  Repeat, Plus, LogOut, Menu, X, Copy, CheckCircle,
  Clock, Globe, Shield, Activity,
  Bot, User, AlertCircle, Trash2,
  Zap, DollarSign, TrendingUp, Sparkles, Loader2, ArrowRight,
} from "lucide-react"

function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <rect width="36" height="36" rx="8" className="fill-foreground" />
      <path d="M10 22c0-4 3-7 8-7s8 3 8 7" className="stroke-background" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M12 14c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5" className="stroke-background" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
      <circle cx="18" cy="25" r="2" className="fill-background" />
      <path d="M24 25l2 2 4-4" className="stroke-background" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function formatAmount(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return amount.toString()
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, token, isAuthenticated, isLoading, logout, wallets, transactions, schedules, totalBalance, connectWallet, createSchedule, deleteSchedule, deleteAccount, sendPayment, syncWallets } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [walletInput, setWalletInput] = useState("")
  const [showWalletInput, setShowWalletInput] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [commandInput, setCommandInput] = useState("")
  const [commands, setCommands] = useState<Array<{ input: string; status: "processing" | "done" | "error"; result?: any; error?: string }>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const agentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (chatEndRef.current) {
      const chatContainer = chatEndRef.current.closest('.overflow-y-auto')
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight
      }
    }
  }, [commands])

  useEffect(() => {
    syncWallets()
    const interval = setInterval(syncWallets, 30000)
    return () => clearInterval(interval)
  }, [syncWallets])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/app/auth")
  }, [isLoading, isAuthenticated, navigate])

  const handleCommandText = async (text: string) => {
    if (!text || isProcessing) return
    setCommandInput("")
    setIsProcessing(true)
    const cmdEntry = { input: text, status: "processing" as const }
    setCommands(prev => [...prev, cmdEntry])

    try {
      const res = await fetch("/api/ai/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      const intent = data.intent

      if (intent.action === "schedule" && intent.recipient) {
        const scheduleAmount = parseFloat(intent.amount || "0")
        if (totalBalance < scheduleAmount) {
          setCommands(prev => prev.map((c, i) => i === prev.length - 1 ? {
            ...c, status: "error" as const, error: `Insufficient balance. You have ${totalBalance.toFixed(2)} USDC but schedule requires ${scheduleAmount.toFixed(2)} USDC.`,
          } : c))
          setIsProcessing(false)
          return
        }
        try {
          const schedule = await createSchedule(text)
          setCommands(prev => prev.map((c, i) => i === prev.length - 1 ? {
            ...c, status: "done" as const,
            result: { intent, executed: true, schedule },
          } : c))
        } catch (err: any) {
          setCommands(prev => prev.map((c, i) => i === prev.length - 1 ? {
            ...c, status: "error" as const, error: `Schedule failed: ${err.message}`,
          } : c))
        }
      } else if (intent.action === "send" && intent.recipient && wallets.length > 0) {
        const sendAmount = parseFloat(intent.amount || "0")
        const gasFee = parseFloat(intent.gasEstimate || "0")
        const totalNeeded = sendAmount + gasFee
        if (totalBalance < totalNeeded) {
          setCommands(prev => prev.map((c, i) => i === prev.length - 1 ? {
            ...c, status: "error" as const, error: `Not enough balance. You have ${totalBalance.toFixed(2)} USDC but need ${totalNeeded.toFixed(6)} USDC (${sendAmount.toFixed(2)} + ~${gasFee.toFixed(6)} gas fee).`,
          } : c))
          setIsProcessing(false)
          return
        }
        try {
          // Execute payment instantly via viem (no queue — only schedules use the queue)
          const primaryWallet = wallets.find(w => w.isPrimary) || wallets[0]
          await sendPayment(primaryWallet.id, intent.recipient, intent.amount, intent.token || "USDC")
          setCommands(prev => prev.map((c, i) => i === prev.length - 1 ? {
            ...c, status: "done" as const,
            result: { intent, executed: true, status: "confirmed", message: `Sent ${intent.amount} USDC to ${intent.recipient}` },
          } : c))
          // Refresh balances after payment
          syncWallets()
        } catch (err: any) {
          setCommands(prev => prev.map((c, i) => i === prev.length - 1 ? {
            ...c, status: "error" as const, error: `Payment failed: ${err.message}`,
          } : c))
        }
      } else if (intent.action === "balance") {
        setCommands(prev => prev.map((c, i) => i === prev.length - 1 ? {
          ...c, status: "done" as const,
          result: {
            intent,
            wallets: wallets.map(w => `${w.label || "Wallet"}: ${w.address.slice(0, 6)}...${w.address.slice(-4)} — ${w.balance} USDC`),
            totalBalance: `${totalBalance.toFixed(2)} USDC`,
          },
        } : c))
      } else {
        setCommands(prev => prev.map((c, i) => i === prev.length - 1 ? { ...c, status: "done" as const, result: data } : c))
      }
    } catch (err: any) {
      setCommands(prev => prev.map((c, i) => i === prev.length - 1 ? { ...c, status: "error" as const, error: err.message } : c))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCommand = async () => { await handleCommandText(commandInput.trim()) }

  const handleDisconnect = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout()
      navigate("/app/auth")
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      await deleteAccount()
      navigate("/")
    } catch (err: any) {
      console.error("Delete account failed:", err)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const focusAgent = () => {
    agentInputRef.current?.focus()
    document.getElementById("ai-agent-section")?.scrollIntoView({ behavior: "smooth" })
  }

  const handleAddWallet = () => {
    if (walletInput.trim()) {
      connectWallet(walletInput.trim())
      setWalletInput("")
      setShowWalletInput(false)
    }
  }

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const statusColor = (status: string) => {
    if (status === "confirmed" || status === "active") return "bg-muted text-foreground"
    if (status === "pending" || status === "scheduled") return "bg-muted text-muted-foreground"
    if (status === "failed") return "bg-red-500/10 text-red-600 dark:text-red-400"
    if (status === "paused") return "bg-muted text-muted-foreground"
    return "bg-muted text-muted-foreground"
  }

  if (isLoading) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) return null

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
              <Logo /><span className="font-semibold text-base tracking-tight hidden sm:inline">SettleFlow</span>
              <span className="text-sm text-muted-foreground ml-1 hidden sm:inline">/ Dashboard</span>
            </button>
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border/50">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/30 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-foreground/80" /></span>
                <span className="text-xs text-muted-foreground">All Systems Operational</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ModeToggle />
              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle menu">
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="hidden md:flex items-center gap-3">
                <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-muted-foreground hover:text-red-500 transition-colors" title="Delete account">
                  <AlertCircle className="w-3.5 h-3.5" />
                </button>
                <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center"><User className="w-4 h-4 text-background" /></div>
                <div className="text-sm leading-tight">
                  <p className="font-medium truncate max-w-[120px]">{user?.displayName || user?.email}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[120px]">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center"><User className="w-5 h-5 text-background" /></div>
                <div className="text-sm"><p className="font-medium">{user?.displayName || user?.email}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border/50 w-fit">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/30 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-foreground/80" /></span>
                <span className="text-xs text-muted-foreground">All Systems Operational</span>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={handleDisconnect}><LogOut className="w-4 h-4" />Logout</Button>
              <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                <AlertCircle className="w-4 h-4" />Delete Account
              </button>
            </div>
          </motion.div>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage your USDC settlements and payment schedules</p>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <Button variant="outline" className="gap-2" onClick={handleDisconnect}><LogOut className="w-4 h-4" />Logout</Button>
            </div>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Delete Account</h3>
                    <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  All your wallets, transactions, schedules, payees, and personal data will be permanently deleted.
                  Your USDC balances on the blockchain will <span className="font-medium text-foreground">not</span> be affected —
                  you can access them from any wallet with your private keys.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteAccount} disabled={isDeleting}>
                    {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Deleting...</> : <><AlertCircle className="w-4 h-4 mr-2" /> Delete Forever</>}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Balance Card */}
          <Card className="overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Balance</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-extrabold tracking-tight">${formatAmount(totalBalance)}</span>
                    <span className="text-lg text-muted-foreground">USDC</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Across {wallets.length} wallet{wallets.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button className="gap-2" onClick={focusAgent}><Send className="w-4 h-4" /><span className="hidden sm:inline">Send Payment</span><span className="sm:hidden">Send</span></Button>
                  <Button variant="outline" className="gap-2" onClick={focusAgent}><CalendarClock className="w-4 h-4" /><span className="hidden sm:inline">Create Schedule</span><span className="sm:hidden">Schedule</span></Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /><span>Deterministic Finality</span></div>
                <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /><span>&lt;1s Settlement</span></div>
                <div className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /><span>Global Infrastructure</span></div>
              </div>
            </CardContent>
          </Card>

          {/* AI Agent */}
          <div id="ai-agent-section">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                  <Bot className="w-5 h-5 text-background" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">AI Agent</h2>
                  <p className="text-xs text-muted-foreground">Tell me what to pay in plain English</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border/50">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/30 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-foreground/80" /></span>
                <span className="text-xs text-muted-foreground">Ready</span>
              </div>
            </div>

            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5 max-h-[320px] overflow-y-auto space-y-4 scrollbar-hide">
                  {commands.length === 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-8">
                      <div className="flex items-start gap-3 mb-6">
                        <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center shrink-0">
                          <Bot className="w-5 h-5 text-background" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%]">
                          <p className="text-sm">Hi! I'm your payment agent. Try one of these commands, or just type what you need.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { label: "Send 500 USDC to alice.arc", icon: Send },
                          { label: "Show my balance", icon: Wallet },
                          { label: "Create a new wallet", icon: Plus },
                          { label: "Schedule 200 USDC to bob every friday", icon: CalendarClock },
                        ].map((example) => (
                          <button key={example.label} onClick={() => handleCommandText(example.label)}
                            className="flex items-center gap-2.5 text-left text-xs p-3 rounded-xl bg-muted/50 hover:bg-accent hover:border-foreground/30 border border-border/50 transition-all group">
                            <example.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                            <span className="truncate">{example.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {commands.map((cmd, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="flex gap-3 justify-end">
                        <div className="bg-foreground text-background rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[90%] sm:max-w-[75%]">
                          <p className="text-sm break-words">{cmd.input}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center shrink-0 mt-1">
                          <Bot className="w-4 h-4 text-background" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] sm:max-w-[75%]">
                          {cmd.status === "processing" && (
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                <span className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                              <span className="text-sm text-muted-foreground">Processing...</span>
                            </div>
                          )}
                          {cmd.status === "done" && cmd.result && (
                            <div className="space-y-2">
                              {cmd.result.schedule ? (
                                <>
                                  <div className="flex items-center gap-2"><CalendarClock className="w-4 h-4" /><span className="text-sm font-semibold">Schedule Created</span></div>
                                  <div className="bg-background rounded-xl p-3 space-y-1.5 text-xs border border-border/30">
                                    <p className="font-medium">{cmd.result.schedule.title}</p>
                                    <p className="text-muted-foreground">{cmd.result.schedule.amount} {cmd.result.schedule.token} → <span className="font-mono">{cmd.result.schedule.recipient}</span></p>
                                    <p className="text-muted-foreground">Every <span className="font-medium">{cmd.result.schedule.frequency}</span></p>
                                    {cmd.result.schedule.conditions && <p className="text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{cmd.result.schedule.conditions}</p>}
                                  </div>
                                </>
                              ) : cmd.result.status === "confirmed" && cmd.result.message ? (
                                <>
                                  <div className="flex items-center gap-2"><Send className="w-4 h-4" /><span className="text-sm font-semibold">Payment Sent ✅</span></div>
                                  <div className="bg-background rounded-xl p-3 text-xs border border-border/30">
                                    <p className="text-muted-foreground">{cmd.result.message}</p>
                                    <p className="text-emerald-500 text-xs mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Confirmed on-chain — instant</p>
                                  </div>
                                </>
                              ) : cmd.result.wallets ? (
                                <>
                                  <div className="flex items-center gap-2"><Wallet className="w-4 h-4" /><span className="text-sm font-semibold">Balance Summary</span></div>
                                  <div className="bg-background rounded-xl p-3 space-y-1 text-xs border border-border/30">
                                    <p className="text-lg font-bold">{cmd.result.totalBalance}</p>
                                    {cmd.result.wallets.map((w: string, i: number) => <p key={i} className="text-muted-foreground">{w}</p>)}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /><span className="text-sm font-semibold">{cmd.result.intent?.action || "Done"}</span></div>
                                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words bg-background rounded-lg p-2">{JSON.stringify(cmd.result.intent || cmd.result, null, 2)}</pre>
                                </>
                              )}
                            </div>
                          )}
                          {cmd.status === "error" && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-red-500"><AlertCircle className="w-4 h-4" /><span className="text-sm font-semibold">Error</span></div>
                              <p className="text-xs text-red-400/80 break-words bg-red-500/5 rounded-lg p-2">{cmd.error || "Something went wrong"}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="border-t border-border/30 p-4">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input ref={agentInputRef} placeholder="Type a payment instruction..." value={commandInput} onChange={(e) => setCommandInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCommand() } }} className="pr-12 h-12 text-sm" disabled={isProcessing} />
                      <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                    <Button size="icon" className="w-12 h-12 shrink-0" onClick={handleCommand} disabled={isProcessing || !commandInput.trim()}>
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Wallets */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Wallets</h2>
              <button onClick={() => setShowWalletInput(!showWalletInput)} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />Add Wallet
              </button>
            </div>
            {showWalletInput && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 mb-4">
                <Input placeholder="Enter wallet address..." value={walletInput} onChange={(e) => setWalletInput(e.target.value)} className="flex-1" />
                <Button size="sm" onClick={handleAddWallet}>Connect</Button>
                <Button variant="outline" size="sm" onClick={() => setShowWalletInput(false)}>Cancel</Button>
              </motion.div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              {wallets.map((w, i) => (
                <motion.div key={w.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }}>
                  <Card className="h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0"><Wallet className="w-5 h-5" /></div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate">{w.label || "Unlabeled"}</p>
                              {w.isPrimary && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Primary</Badge>}
                            </div>
                            <button onClick={() => copyToClipboard(w.address, i)} className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                              {w.address}{copiedIdx === i ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{w.chain}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5"><span className="text-2xl font-bold">${formatAmount(w.balance)}</span><span className="text-sm text-muted-foreground">USDC</span></div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Transactions & Schedules */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Transaction History <span className="text-sm font-normal text-muted-foreground">({transactions.length})</span></h2>
              <Card>
                <CardContent className="p-0">
                  {transactions.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"><Activity className="w-6 h-6 text-muted-foreground" /></div>
                      <p className="text-sm text-muted-foreground">No transactions yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {transactions.map((tx, i) => (
                        <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.type === "receive" ? "bg-muted" : "bg-muted"}`}>
                            {tx.type === "receive" ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {tx.type === "receive" ? "Received" : "Sent"}
                              {tx.counterparty ? ` from ${tx.counterparty}` : ""}{tx.recipient ? ` to ${tx.recipient}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              {tx.memo ? ` · ${tx.memo}` : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-semibold ${tx.type === "receive" ? "" : ""}`}>{tx.type === "receive" ? "+" : "-"}${formatAmount(tx.amount)}</p>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${statusColor(tx.status)}`}>{tx.status}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-4">Active Schedules</h2>
              <Card>
                <CardContent className="p-0">
                  {schedules.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"><CalendarClock className="w-6 h-6 text-muted-foreground" /></div>
                      <p className="text-sm text-muted-foreground">No schedules yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Try: "Schedule 200 USDC to bob every friday"</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {schedules.map((s, i) => (
                        <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0"><Repeat className="w-5 h-5" /></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate">{s.title}</p>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${statusColor(s.status)}`}>{s.status}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">${formatAmount(s.amount)} · {s.frequency}</p>
                              <p className="text-xs text-muted-foreground">→ {s.recipient}</p>
                              {s.conditions && <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-500"><AlertCircle className="w-3 h-3" /><span>{s.conditions}</span></div>}
                              {s.nextRun && <p className="text-xs mt-1.5 font-medium">Next: {new Date(s.nextRun).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
                            </div>
                            <button onClick={async () => { if (window.confirm(`Delete schedule "${s.title}"?`)) { try { await deleteSchedule(s.id) } catch {} } }} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors shrink-0 rounded-lg hover:bg-red-500/10" title="Delete schedule"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Payees & Payments (payroll) */}
          <PayrollSection />

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Zap, label: "Sub-Second Finality", desc: "Instant settlement" },
              { icon: DollarSign, label: "USDC-Native Gas", desc: "Predictable fees" },
              { icon: Shield, label: "Deterministic", desc: "No reorgs" },
              { icon: TrendingUp, label: "Global Network", desc: "300+ nodes" },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}>
                <Card className="text-center">
                  <CardContent className="p-4">
                    <item.icon className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <footer className="border-t border-border/50 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><Logo size={20} /><span className="text-xs font-semibold">SettleFlow</span></div>
          <p className="text-xs text-muted-foreground">&copy; 2026 SettleFlow. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/worztm/settleflow" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
            <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Home</button>
          </div>
        </div>
      </footer>
    </main>
  )
}
