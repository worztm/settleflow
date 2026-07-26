import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "../lib/auth-context"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { ModeToggle } from "../components/mode-toggle"
import {
  Brain, CalendarClock, Shield, Coins, Activity, Workflow,
  Send, Mic, Bot, User, Menu, X,
  BookOpen, Play, Clock, Globe, Repeat, Receipt,
  Split, AlertCircle, Twitter, Github, MessageCircle,
  Edit, CheckCircle, Calendar, ArrowRight, Sparkles
} from "lucide-react"

const scenarios = [
  {
    title: "Recurring Payroll",
    icon: Repeat,
    intent: "Pay my team 2500 USDC every 2 weeks on Friday at 10am UTC",
    parsed: {
      "Recipient": "team-wallet.arc",
      "Amount": "2,500 USDC",
      "Frequency": "Bi-weekly (Fri 10:00 UTC)",
      "Duration": "Ongoing",
      "Network": "Arc USDC",
    },
    schedule: [
      { date: "Jul 25, 2026", status: "Scheduled", amount: "2,500 USDC" },
      { date: "Aug 08, 2026", status: "Scheduled", amount: "2,500 USDC" },
      { date: "Aug 22, 2026", status: "Scheduled", amount: "2,500 USDC" },
    ],
    tx: {
      from: "0x742d...8a3f",
      to: "0xteam...f421",
      amount: "2,500.00 USDC",
      gas: "0.05 USDC",
      nonce: 42,
    },
  },
  {
    title: "Invoice Settlement",
    icon: Receipt,
    intent: "Settle invoice #4421 for 12,500 USDC to vendor.settle on the 1st of next month",
    parsed: {
      "Recipient": "vendor.arc",
      "Amount": "12,500 USDC",
      "Frequency": "One-time",
      "Execution": "Aug 01, 2026 00:00 UTC",
      "Network": "Arc USDC",
    },
    schedule: [
      { date: "Aug 01, 2026", status: "Pending", amount: "12,500 USDC" },
    ],
    tx: {
      from: "0x742d...8a3f",
      to: "0xven...d902",
      amount: "12,500.00 USDC",
      gas: "0.08 USDC",
      nonce: 43,
      memo: "Invoice #4421",
    },
  },
  {
    title: "Revenue Split",
    icon: Split,
    intent: "Split incoming revenue 70% to treasury.settle and 30% to ops.settle daily at midnight UTC",
    parsed: {
      "Type": "Revenue Split",
      "Split": "70% / 30%",
      "Recipients": "treasury.arc, ops.arc",
      "Frequency": "Daily (00:00 UTC)",
      "Network": "Arc USDC",
    },
    schedule: [
      { date: "Jul 23, 2026", status: "Scheduled", amount: "Variable" },
      { date: "Jul 24, 2026", status: "Scheduled", amount: "Variable" },
      { date: "Jul 25, 2026", status: "Scheduled", amount: "Variable" },
    ],
    tx: {
      from: "0xrev...a1b2",
      to: "Multi-output",
      amount: "Split 70/30",
      gas: "0.12 USDC",
      nonce: "Auto",
    },
  },
  {
    title: "Conditional Payment",
    icon: AlertCircle,
    intent: "If my wallet balance exceeds 50,000 USDC, send the excess to cold-storage.arc every Sunday",
    parsed: {
      "Condition": "Balance > 50,000 USDC",
      "Action": "Send excess to cold-storage",
      "Frequency": "Weekly (Sun 00:00 UTC)",
      "Network": "Arc USDC",
    },
    schedule: [
      { date: "Jul 27, 2026", status: "Conditional", amount: "Excess > 50k" },
      { date: "Aug 03, 2026", status: "Conditional", amount: "Excess > 50k" },
    ],
    tx: {
      from: "0x742d...8a3f",
      to: "0xcold...9e4f",
      amount: "Variable (excess)",
      gas: "0.06 USDC",
      nonce: "Auto",
      condition: "if balance > 50k",
    },
  },
  {
    title: "Cross-Border Batch",
    icon: Globe,
    intent: "Batch pay 5 contractors 1000 USDC each in EU, APAC, and LATAM on the 15th of every month",
    parsed: {
      "Type": "Batch Payment",
      "Recipients": "5 contractors",
      "Amount": "1,000 USDC each",
      "Frequency": "Monthly (15th)",
      "Network": "Arc USDC",
    },
    schedule: [
      { date: "Aug 15, 2026", status: "Scheduled", amount: "5,000 USDC" },
      { date: "Sep 15, 2026", status: "Scheduled", amount: "5,000 USDC" },
    ],
    tx: {
      from: "0x742d...8a3f",
      to: "5 recipients",
      amount: "5,000.00 USDC",
      gas: "0.25 USDC",
      nonce: 44,
    },
  },
]

const features = [
  {
    icon: Brain,
    title: "Natural Language Intent",
    desc: "Describe payments in plain English. Our AI agent parses intent, extracts entities, and validates against your rules.",
  },
  {
    icon: CalendarClock,
    title: "Smart Scheduling",
    desc: "Recurring payments, one-time future transfers, conditional triggers. The agent manages your entire payment schedule automatically.",
  },
  {
    icon: Shield,
    title: "Deterministic Finality",
    desc: "Sub-second, irreversible settlement. No reorgs, no uncertainty — payments are final instantly.",
  },
  {
    icon: Coins,
    title: "USDC-Native Gas",
    desc: "Pay fees in USDC, not volatile tokens. Predictable costs for treasury planning. No need to hold speculative assets for gas.",
  },
  {
    icon: Activity,
    title: "Real-Time Monitoring",
    desc: "Track every scheduled payment, execution status, and on-chain confirmation through a unified dashboard with live updates.",
  },
  {
    icon: Workflow,
    title: "Conditional Logic",
    desc: "Set rules: Pay invoice only if balance > 10k USDC, Split revenue 60/40 between treasury and ops every Friday.",
  },
]

const steps = [
  { num: "01", title: "Intent Parsing", desc: "Our AI extracts recipient, amount, schedule, and conditions from natural language." },
  { num: "02", title: "Validation & Rules", desc: "Agent checks balance sufficiency, whitelist compliance, spending limits, and user-approved policies." },
  { num: "03", title: "Schedule & Queue", desc: "Payments are scheduled, queued, and executed precisely when you want — no manual follow-ups needed." },
  { num: "04", title: "On-Chain Settlement", desc: "Transaction signed and broadcast to the network. Sub-second deterministic finality with USDC-native gas." },
]

function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
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

function Nav() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollTo = (id: string) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }

  const handleGetStarted = () => {
    if (!isLoading && isAuthenticated) navigate("/app")
    else navigate("/app/auth")
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-semibold text-base sm:text-lg tracking-tight">SettleFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {["features", "demo", "architecture"].map((id) => (
              <button key={id} onClick={() => scrollTo(id)} className="text-sm text-muted-foreground hover:text-foreground transition-colors capitalize">{id}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <Button className="hidden sm:inline-flex" onClick={handleGetStarted}>Get Started</Button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle menu">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      {menuOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
            {["features", "demo", "architecture"].map((id) => (
              <button key={id} onClick={() => scrollTo(id)} className="block w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors capitalize py-2">{id}</button>
            ))}
            <Button className="w-full sm:hidden" onClick={handleGetStarted}>Get Started</Button>
          </div>
        </motion.div>
      )}
    </nav>
  )
}

function Hero() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()

  const handleGetStarted = () => {
    if (!isLoading && isAuthenticated) navigate("/app")
    else navigate("/app/auth")
  }

  return (
    <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 lg:pt-44 lg:pb-36 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-8">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-balance">
              Pay with natural language.
              <br />
              <span className="text-muted-foreground">Settled instantly.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
              An AI agent that understands your payment intent and executes USDC settlements with sub-second finality.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="gap-2" onClick={handleGetStarted}>
                <Play className="w-4 h-4" /> Try Live Demo
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                <BookOpen className="w-4 h-4" /> Documentation
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function DemoChat() {
  return (
    <section className="pb-16 sm:pb-24 lg:pb-36">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">settleflow.demo</span>
                </div>
                <div className="space-y-5">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-background" /></div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] sm:max-w-[85%]">
                      <p className="text-sm">Hi! I'm your SettleFlow AI agent. Tell me who to pay, how much, and when.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-foreground text-background rounded-2xl rounded-tr-sm px-4 py-3 max-w-[90%] sm:max-w-[85%]">
                      <p className="text-sm">Send 500 USDC to alice.arc every Monday at 9am for 3 months</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-muted-foreground" /></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-background" /></div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] sm:max-w-[85%] space-y-3">
                      <p className="text-sm">Got it! I've parsed your intent:</p>
                      <div className="bg-background rounded-xl p-3.5 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Recipient</span><span>alice.arc</span></div>
                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Amount</span><span>500 USDC</span></div>
                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Frequency</span><span>Weekly (Mon 09:00 UTC)</span></div>
                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Duration</span><span>12 payments (3 months)</span></div>
                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Network</span><span>Arc USDC</span></div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="text-xs h-8">Confirm & Schedule</Button>
                        <Button size="sm" variant="outline" className="text-xs h-8">Edit</Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-5 pt-4 border-t border-border/50">
                  <div className="flex-1 relative">
                    <Input placeholder="Type a payment instruction..." className="pr-10 text-sm" />
                    <Mic className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  <Button size="icon"><Send className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const stats = [
    { value: "<1s", label: "Settlement Finality" },
    { value: "$0.001", label: "Avg. Tx Fee (USDC)" },
    { value: "300+", label: "Global Nodes" },
    { value: "99.99%", label: "Uptime SLA" },
  ]
  return (
    <section className="border-y border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Built for Autonomous Finance</h2>
          <p className="text-muted-foreground text-lg">Automate your USDC settlements with intelligent AI-powered scheduling and execution.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}>
              <Card className="h-full hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Demo() {
  const [activeScenario, setActiveScenario] = useState(0)
  const s = scenarios[activeScenario]
  const statusColor = (status: string) => {
    if (status === "Scheduled") return "bg-muted text-foreground"
    if (status === "Pending") return "bg-muted text-muted-foreground"
    return "bg-muted text-muted-foreground"
  }

  return (
    <section id="demo" className="py-16 sm:py-24 lg:py-32 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">See It In Action</h2>
          <p className="text-muted-foreground text-lg">Try different payment scenarios and watch the AI agent parse, validate, and schedule settlements.</p>
        </div>
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider text-xs">Choose a Scenario</p>
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
              {scenarios.map((sc, i) => (
                <button key={sc.title} onClick={() => setActiveScenario(i)}
                  className={`w-full min-w-0 text-left p-4 rounded-xl border transition-all group ${
                    activeScenario === i ? "border-foreground bg-accent" : "border-border bg-card hover:bg-accent"
                  }`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <sc.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0"><h4 className="font-semibold text-sm truncate">{sc.title}</h4><p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">"{sc.intent}"</p></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Live Preview</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">Testnet</span>
                  <Badge variant="outline" className="text-xs">Connected</Badge>
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={activeScenario} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto scrollbar-hide">
                  <div className="bg-muted rounded-xl p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Natural Language Input</p>
                    <p className="text-sm font-medium">"{s.intent}"</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">AI Parsed Intent</p>
                    <div className="bg-background border border-border rounded-xl p-4 space-y-2 max-w-full">
                      {Object.entries(s.parsed).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground shrink-0">{k}</span><span className="font-mono font-medium break-all min-w-0 text-right">{v}</span></div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Execution Schedule</p>
                    <div className="space-y-2">
                      {s.schedule.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-background">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div className="min-w-0"><p className="text-sm font-medium truncate">{item.date}</p><p className="text-xs text-muted-foreground truncate">{item.amount}</p></div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${statusColor(item.status)}`}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Transaction Preview</p>
                    <div className="bg-background border border-border rounded-xl p-4 space-y-2 font-mono text-xs max-w-full overflow-x-auto">
                      {Object.entries(s.tx).filter(([k]) => k !== 'memo' && k !== 'condition').map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                          <span className="text-muted-foreground shrink-0 capitalize">{k}</span>
                          <span className={k === 'amount' ? 'font-semibold break-all min-w-0' : 'break-all min-w-0'}>{v}</span>
                        </div>
                      ))}
                      {'memo' in s.tx && <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Memo</span><span className="break-all min-w-0">{(s.tx as any).memo}</span></div>}
                      {'condition' in s.tx && <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Condition</span><span className="break-all min-w-0">{(s.tx as any).condition}</span></div>}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button className="flex-1 gap-2"><CheckCircle className="w-4 h-4" /> Approve & Schedule</Button>
                    <Button variant="outline" size="icon"><Edit className="w-4 h-4" /></Button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

function Architecture() {
  return (
    <section id="architecture" className="py-16 sm:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">How It Works</h2>
          <p className="text-muted-foreground text-lg">From natural language to on-chain settlement in under a second.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((step, i) => (
            <motion.div key={step.num} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.15 }}>
              <Card className="text-center h-full">
                <CardContent className="p-6 sm:p-8">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <span className="text-sm font-semibold text-muted-foreground">{step.num}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()

  const handleGetStarted = () => {
    if (!isLoading && isAuthenticated) navigate("/app")
    else navigate("/app/auth")
  }

  return (
    <section className="py-16 sm:py-24 lg:py-32">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to Automate Your Payments?</h2>
          <p className="text-muted-foreground text-lg">Join the waitlist for early access to SettleFlow.</p>
          <Button size="lg" className="gap-2" onClick={handleGetStarted}>
            <Sparkles className="w-4 h-4" /> Get Started Free
          </Button>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 sm:col-span-2">
            <div className="flex items-center gap-2.5 mb-4"><Logo size={24} /><span className="font-semibold text-base">SettleFlow</span></div>
            <p className="text-sm text-muted-foreground max-w-sm">Autonomous payment settlement powered by AI with sub-second finality on USDC-native infrastructure.</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button className="hover:text-foreground transition-colors">Features</button></li>
              <li><button className="hover:text-foreground transition-colors">Changelog</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["Documentation", "API Reference", "Network Status", "Support"].map(item => (
                <li key={item}><button className="hover:text-foreground transition-colors">{item}</button></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground"> 2026 SettleFlow. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <button className="text-muted-foreground hover:text-foreground transition-colors"><Twitter className="w-4 h-4" /></button>
            <a href="https://github.com/worztm/settleflow" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors"><Github className="w-4 h-4" /></a>
            <button className="text-muted-foreground hover:text-foreground transition-colors"><MessageCircle className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Nav />
      <Hero />
      <DemoChat />
      <Stats />
      <FeaturesSection />
      <Demo />
      <Architecture />
      <CTA />
      <Footer />
    </main>
  )
}
