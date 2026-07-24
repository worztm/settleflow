"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ModeToggle } from "@/components/mode-toggle"
import {
  Brain, CalendarClock, Shield, Coins, Activity, Workflow,
  Lock, Send, Mic, Bot, User, Menu, X,
  BookOpen, Play, ShieldCheck, Clock, Globe, Repeat, Receipt,
  Split, AlertCircle, Twitter, Github, MessageCircle,
  Edit, CheckCircle, Calendar
} from "lucide-react"

/* ─────────────── DATA ─────────────── */

const scenarios = [
  {
    title: "Recurring Payroll",
    icon: Repeat,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
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
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
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
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
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
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
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
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
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
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: CalendarClock,
    title: "Smart Scheduling",
    desc: "Recurring payments, one-time future transfers, conditional triggers. The agent manages your entire payment schedule automatically.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Shield,
    title: "Deterministic Finality",
    desc: "Sub-second, irreversible settlement. No reorgs, no uncertainty — payments are final instantly.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Coins,
    title: "USDC-Native Gas",
    desc: "Pay fees in USDC, not volatile tokens. Predictable costs for treasury planning. No need to hold speculative assets for gas.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Activity,
    title: "Real-Time Monitoring",
    desc: "Track every scheduled payment, execution status, and on-chain confirmation through a unified dashboard with live updates.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Workflow,
    title: "Conditional Logic",
    desc: 'Set rules: "Pay invoice only if balance > 10k USDC", "Split revenue 60/40 between treasury and ops every Friday."',
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
]

const steps = [
  {
    num: "1",
    title: "Intent Parsing",
    desc: "Our AI extracts recipient, amount, schedule, and conditions from natural language.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    num: "2",
    title: "Validation & Rules",
    desc: "Agent checks balance sufficiency, whitelist compliance, spending limits, and user-approved policies.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    num: "3",
    title: "Schedule & Queue",
    desc: "Payments are scheduled, queued, and executed precisely when you want — no manual follow-ups needed.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    num: "4",
    title: "On-Chain Settlement",
    desc: "Transaction signed and broadcast to the network. Sub-second deterministic finality with USDC-native gas.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
]

/* ─────────────── COMPONENTS ─────────────── */

function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#logo-grad)" />
      <path
        d="M10 22c0-4 3-7 8-7s8 3 8 7"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 14c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <circle cx="18" cy="25" r="2" fill="white" />
      <path
        d="M24 25l2 2 4-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function StatusDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
    </span>
  )
}

function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`bg-gradient-to-r from-emerald-500 to-emerald-400 bg-clip-text text-transparent ${className}`}>
      {children}
    </span>
  )
}

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollTo = (id: string) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="font-bold text-xl tracking-tight">
              Settle<GradientText>Flow</GradientText>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {["features", "demo", "architecture"].map((id) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors capitalize"
              >
                {id}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <Button className="hidden sm:inline-flex rounded-2xl">Get Started</Button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
            {["features", "demo", "architecture"].map((id) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="block w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors capitalize py-2"
              >
                {id}
              </button>
            ))}
            <Button className="w-full rounded-2xl sm:hidden">Get Started</Button>
          </div>
        </motion.div>
      )}
    </nav>
  )
}

function Hero() {
  const demoRef = useRef<HTMLDivElement>(null)

  return (
    <section className="relative pt-24 pb-12 lg:pt-40 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold tracking-wide uppercase border border-emerald-500/20">
              <StatusDot />
              Intelligent Payment Automation
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Pay with
              <br />
              <GradientText>Natural Language</GradientText>
              <br />
              Instantly
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              An AI agent that understands your payment intent, schedules USDC settlements
              with sub-second finality, and executes autonomously.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="gap-2 rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30"
                onClick={() => demoRef.current?.scrollIntoView({ behavior: "smooth" })}
              >
                <Play className="w-4 h-4" />
                Try Live Demo
              </Button>
              <Button size="lg" variant="outline" className="gap-2 rounded-2xl">
                <BookOpen className="w-4 h-4" />
                Documentation
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Deterministic Finality</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span>&lt;1s Settlement</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>Global Infrastructure</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-emerald-400/20 rounded-3xl blur-2xl" />
            <Card className="relative glow-settle border-border/50 bg-card/50 glass-card gradient-border">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">settleflow.demo</span>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-secondary rounded-2xl rounded-tl-sm px-3 sm:px-4 py-3 max-w-[90%] sm:max-w-[80%]">
                      <p className="text-sm">
                        Hi! I&apos;m your SettleFlow AI agent. Tell me who to pay, how much, and when —
                        I&apos;ll handle the USDC settlement.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 sm:px-4 py-3 max-w-[90%] sm:max-w-[80%]">
                      <p className="text-sm">
                        Send 500 USDC to alice.arc every Monday at 9am for the next 3 months
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-secondary rounded-2xl rounded-tl-sm px-3 sm:px-4 py-3 max-w-[90%] sm:max-w-[80%] space-y-2">
                      <p className="text-sm">Got it! I&apos;ve parsed your intent:</p>
                      <div className="bg-background/50 rounded-lg p-3 space-y-1 text-xs font-mono overflow-x-auto">
                        <div className="flex justify-between"><span className="text-muted-foreground">Recipient:</span> <span>alice.arc</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span> <span>500 USDC</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Frequency:</span> <span>Weekly (Mon 09:00 UTC)</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span> <span>12 payments (3 months)</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Network:</span> <span className="text-emerald-500">Arc USDC</span></div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="text-xs h-8 rounded-xl">Confirm & Schedule</Button>
                        <Button size="sm" variant="outline" className="text-xs h-8 rounded-xl">Edit</Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Type a payment instruction..."
                      className="pr-10 rounded-xl border-border/60 focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                    />
                    <Mic className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  <Button size="icon" className="rounded-xl">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <div ref={demoRef} />
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
    <section className="border-y border-border/50 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold gradient-text">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="py-12 sm:py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Built for Autonomous Finance
            </h2>
          <p className="text-muted-foreground text-lg">
            Automate your USDC settlements with intelligent AI-powered scheduling and execution.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1 transition-all duration-300 bg-card/50 glass-card gradient-border rounded-xl">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                    <f.icon className={`w-6 h-6 ${f.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
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
    if (status === "Scheduled") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    if (status === "Pending") return "bg-amber-500/10 text-amber-600 dark:text-amber-400"
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400"
  }

  return (
    <section id="demo" className="py-12 sm:py-20 lg:py-32 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">See It In Action</h2>
          <p className="text-muted-foreground text-lg">
            Try different payment scenarios and watch the AI agent parse, validate, and schedule settlements.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
              Choose a Scenario
            </p>
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
            
            {scenarios.map((sc, i) => (
              <button
                key={sc.title}
                onClick={() => setActiveScenario(i)}
                className={`w-full text-left p-4 rounded-xl border transition-all group ${
                  activeScenario === i
                    ? "border-emerald-500 bg-accent ring-2 ring-emerald-500 ring-offset-2"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${sc.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <sc.icon className={`w-5 h-5 ${sc.iconColor}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{sc.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">&quot;{sc.intent}&quot;</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          </div>

          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col overflow-hidden rounded-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium">Live Preview</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">Testnet</span>
                  <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
                    Connected
                  </Badge>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeScenario}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto scrollbar-hide"
                >
                  <div className="bg-secondary rounded-xl p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      Natural Language Input
                    </p>
                    <p className="text-sm font-medium">&quot;{s.intent}&quot;</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                      AI Parsed Intent
                    </p>
                    <div className="bg-background border border-border rounded-xl p-4 space-y-2">
                      {Object.entries(s.parsed).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="font-mono font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                      Execution Schedule
                    </p>
                    <div className="space-y-2">
                      {s.schedule.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-background"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                              <Calendar className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{item.date}</p>
                              <p className="text-xs text-muted-foreground">{item.amount}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                      Transaction Preview
                    </p>
                    <div className="bg-background border border-border rounded-xl p-4 space-y-2 font-mono text-xs overflow-x-auto">
                      <div className="flex justify-between"><span className="text-muted-foreground">From:</span> <span>{s.tx.from}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">To:</span> <span>{s.tx.to}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span> <span className="text-emerald-500 font-semibold">{s.tx.amount}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Gas (USDC):</span> <span>{s.tx.gas}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Nonce:</span> <span>{s.tx.nonce}</span></div>
                      {"memo" in s.tx && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Memo:</span> <span>{(s.tx as any).memo}</span></div>
                      )}
                      {"condition" in s.tx && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Condition:</span> <span className="text-amber-500">{(s.tx as any).condition}</span></div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button className="flex-1 gap-2 rounded-xl">
                      <CheckCircle className="w-4 h-4" />
                      Approve & Schedule
                    </Button>
                    <Button variant="outline" size="icon" className="rounded-xl">
                      <Edit className="w-4 h-4" />
                    </Button>
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
    <section id="architecture" className="py-12 sm:py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">How It Works</h2>
          <p className="text-muted-foreground text-lg">
            From natural language to on-chain settlement in under a second.
          </p>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/30 via-emerald-400/30 to-emerald-500/30 -translate-y-1/2" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 relative">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative"
              >
                <Card className="text-center relative z-10 h-full bg-card/50 glass-card gradient-border rounded-xl">
                  <CardContent className="p-6">
                    <div className={`w-14 h-14 rounded-full ${step.bg} flex items-center justify-center mx-auto mb-4 ring-4 ring-background`}>
                      <span className={`text-xl font-bold ${step.color}`}>{step.num}</span>
                    </div>
                    <h3 className="font-semibold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-12 sm:py-20 lg:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="relative">
          <div className="absolute -inset-8 bg-gradient-to-r from-emerald-500/10 to-emerald-400/10 rounded-3xl blur-3xl" />
          <Card className="relative p-6 sm:p-12 rounded-xl bg-card/50 glass-card gradient-border">
            <CardContent className="p-0 space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Ready to Automate Your Payments?
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Join the waitlist for early access to SettleFlow. Be among the first to experience
                autonomous USDC settlement.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                <div className="flex-1 relative">
                  <Input placeholder="Enter your email" className="pr-28 rounded-xl border-border/60 focus:ring-2 focus:ring-primary/30 focus:border-primary/40" />
                  <Button className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 text-xs rounded-xl max-sm:relative max-sm:w-full max-sm:mt-2 max-sm:static max-sm:translate-y-0">
                    Join Waitlist
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                No spam. Unsubscribe anytime. Mainnet launch expected Q3 2026.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 sm:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Logo size={32} />
              
              <span className="font-bold text-lg">
                Settle<GradientText>Flow</GradientText>
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Autonomous payment settlement powered by AI with sub-second finality on USDC-native infrastructure.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["Features", "Changelog", "Roadmap"].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-foreground transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["Documentation", "API Reference", "Network Status", "Support"].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-foreground transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground"> 2026 SettleFlow. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="https://github.com/worztm/settleflow" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Github className="w-4 h-4" />
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ─────────────── PAGE ─────────────── */

export default function Home() {
  return (
    <main className="min-h-screen">
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <Demo />
      <Architecture />
      <CTA />
      <Footer />
    </main>
  )
}
