"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"
import Link from "next/link"
import {
  CheckCircle2, Circle, Zap, Globe, Shield, Coins,
  ArrowRight, Menu, X, Radio
} from "lucide-react"

function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-grad-r" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#logo-grad-r)" />
      <path d="M10 22c0-4 3-7 8-7s8 3 8 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M12 14c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
      <circle cx="18" cy="25" r="2" fill="white" />
      <path d="M24 25l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`bg-gradient-to-r from-emerald-500 to-emerald-400 bg-clip-text text-transparent ${className}`}>
      {children}
    </span>
  )
}

function StatusDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  )
}

type Phase = {
  quarter: string
  title: string
  tag: string
  tagColor: string
  items: { title: string; desc: string; status: "done" | "active" | "upcoming" }[]
}

const phases: Phase[] = [
  {
    quarter: "Q3 2026",
    title: "Foundation",
    tag: "Live",
    tagColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    items: [
      { title: "Natural Language Intent Parsing", desc: "AI agent extracts recipient, amount, and schedule from plain English payment instructions.", status: "done" },
      { title: "Arc USDC Settlement", desc: "Sub-second deterministic finality on Arc.io network with USDC-native gas fees.", status: "done" },
      { title: "Recurring Payment Scheduling", desc: "Weekly, bi-weekly, and monthly schedules with precise UTC execution times.", status: "done" },
      { title: "One-Time Future Transfers", desc: "Schedule single payments for any future date with automatic execution.", status: "done" },
      { title: "Transaction Preview & Approval", desc: "Full transparency into every transaction before it is signed and broadcast.", status: "done" },
    ],
  },
  {
    quarter: "Q4 2026",
    title: "Intelligence",
    tag: "In Development",
    tagColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    items: [
      { title: "Conditional Payment Logic", desc: "If-then rules that trigger, modify, or cancel payments based on wallet balances and external data.", status: "active" },
      { title: "Revenue Splitting", desc: "Auto-split incoming funds across multiple wallets with configurable percentages.", status: "active" },
      { title: "Batch Payouts", desc: "Pay multiple recipients in a single atomic transaction with individual memo fields.", status: "active" },
      { title: "Spending Rules Engine", desc: "Define per-wallet limits, approved recipient lists, and category-based controls.", status: "upcoming" },
      { title: "Balance Threshold Alerts", desc: "Push notifications when wallet balances cross user-defined thresholds.", status: "upcoming" },
    ],
  },
  {
    quarter: "Q1 2027",
    title: "Scale",
    tag: "Planned",
    tagColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    items: [
      { title: "Multi-Wallet Management", desc: "Manage and schedule payments across multiple Arc.io wallets from a single dashboard.", status: "upcoming" },
      { title: "Cross-Chain Settlement", desc: "Settle USDC across Arc.io and other supported networks with automated bridging.", status: "upcoming" },
      { title: "Team Access & Roles", desc: "Invite team members with granular roles: viewer, scheduler, admin, and owner.", status: "upcoming" },
      { title: "Audit Logs & Compliance", desc: "Immutable audit trail of all payment intents, approvals, and on-chain settlements.", status: "upcoming" },
      { title: "Webhook Notifications", desc: "Real-time webhooks for payment execution, failures, and conditional triggers.", status: "upcoming" },
    ],
  },
  {
    quarter: "Q2 2027",
    title: "Ecosystem",
    tag: "Planned",
    tagColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    items: [
      { title: "API Access", desc: "REST API to programmatically create, manage, and monitor payment schedules.", status: "upcoming" },
      { title: "Third-Party Integrations", desc: "Connect with accounting tools, payroll systems, and treasury platforms via API.", status: "upcoming" },
      { title: "Mobile App", desc: "Native mobile experience for on-the-go payment approvals and monitoring.", status: "upcoming" },
      { title: "Analytics Dashboard", desc: "Visual insights into payment volumes, gas costs, schedule adherence, and trends.", status: "upcoming" },
      { title: "Custom Smart Contract Templates", desc: "Deploy custom settlement logic using Arc.io smart contracts without writing code.", status: "upcoming" },
    ],
  },
]

const milestones = [
  { quarter: "Q3 2026", title: "Public Mainnet Launch", done: true },
  { quarter: "Q4 2026", title: "Conditional Payments & Splits", done: false },
  { quarter: "Q1 2027", title: "Multi-Wallet & Cross-Chain", done: false },
  { quarter: "Q2 2027", title: "API & Ecosystem", done: false },
]

const arcFeatures = [
  { icon: Zap, title: "Sub-Second Finality", desc: "Arc.io network settles transactions in under one second with deterministic finality. No reorgs, no waiting." },
  { icon: Coins, title: "USDC-Native Gas", desc: "All transaction fees are paid in USDC, removing the need to hold volatile native tokens for gas." },
  { icon: Shield, title: "Instant Finality", desc: "Unlike probabilistic chains, every Arc.io transaction is final the moment it is confirmed." },
  { icon: Globe, title: "Global Settlement", desc: "Arc.io infrastructure spans 300+ nodes worldwide, enabling low-latency settlement across regions." },
]

export default function Roadmap() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <Logo />
              <span className="font-bold text-xl tracking-tight">
                Settle<GradientText>Flow</GradientText>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Home
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <ModeToggle />
              <Link href="/">
                <Button className="hidden sm:inline-flex rounded-2xl">Back to App</Button>
              </Link>
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
              <Link href="/" className="block w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
                Home
              </Link>
              <Link href="/">
                <Button className="w-full rounded-2xl">Back to App</Button>
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-12 lg:pt-36 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-glow" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold tracking-wide uppercase border border-emerald-500/20">
              <StatusDot />
              Development Roadmap
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Building the Future of
              <br />
              <GradientText>Autonomous Payments</GradientText>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              SettleFlow is powered by Arc.io technology, delivering sub-second USDC settlement
              with deterministic finality and USDC-native gas fees. Here is what we are building and when.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Milestone Timeline ── */}
      <section className="py-12 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
            {milestones.map((m, i) => (
              <div key={m.quarter} className="flex items-center gap-3 min-w-0 shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.done ? "bg-emerald-500/20" : "bg-muted"
                }`}>
                  {m.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${m.done ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {m.quarter}
                  </p>
                  <p className="text-sm font-medium truncate">{m.title}</p>
                </div>
                {i < milestones.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Phases ── */}
      <section className="py-12 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 lg:space-y-16">
          {phases.map((phase, pIdx) => (
            <motion.div
              key={phase.quarter}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: pIdx * 0.1 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-emerald-500">0{pIdx + 1}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{phase.title}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${phase.tagColor}`}>
                      {phase.tag}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{phase.quarter}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {phase.items.map((item) => (
                  <Card key={item.title} className={`bg-card/50 glass-card gradient-border rounded-xl ${
                    item.status === "done" ? "border-emerald-500/20" : ""
                  }`}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {item.status === "done" ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : item.status === "active" ? (
                            <Radio className="w-5 h-5 text-amber-500 animate-pulse" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm break-words">{item.title}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">{item.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Arc.io Technology ── */}
      <section className="py-12 lg:py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Powered by <GradientText>Arc.io</GradientText>
            </h2>
            <p className="text-muted-foreground text-lg">
              Every SettleFlow feature is built on Arc.io network infrastructure, ensuring fast,
              cheap, and final settlement.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {arcFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card className="h-full bg-card/50 glass-card gradient-border rounded-xl">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                      <f.icon className="w-5 h-5 text-emerald-500" />
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

      {/* ── CTA ── */}
      <section className="py-12 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-r from-emerald-500/10 to-emerald-400/10 rounded-3xl blur-3xl" />
            <Card className="relative p-6 sm:p-12 rounded-xl bg-card/50 glass-card gradient-border">
              <CardContent className="p-0 space-y-6">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  Want to Shape the Roadmap?
                </h2>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                  We prioritize features based on community feedback. Join the waitlist to vote
                  on what we build next.
                </p>
                <Link href="/">
                  <Button size="lg" className="gap-2 rounded-2xl shadow-lg shadow-emerald-500/20">
                    Join the Waitlist
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo size={28} />
              <span className="font-bold text-sm">Settle<GradientText>Flow</GradientText></span>
            </div>
            <p className="text-sm text-muted-foreground">2026 SettleFlow. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="https://github.com/worztm/settleflow" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="text-xs">GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
