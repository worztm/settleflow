import { useState, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, UserPlus, Pencil, Trash2, Copy, CheckCircle,
  CalendarClock, Play, Pause, Plus, Loader2, AlertCircle, X,
  Repeat, Tag, Briefcase,
} from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { useAuth } from "../lib/auth-context"
import type { Payee, PaymentPlan } from "../lib/types"

// ─── Constants ────────────────────────────────────────────────────────────

// Categories are free-text — these are just suggestions users can pick or override
const CATEGORY_SUGGESTIONS = [
  "Employee", "Contractor", "Freelancer", "Vendor", "Supplier",
  "Landlord", "Consultant", "Intern", "Other",
]
// Purposes are free-text too — salary, bonus, etc. are user's choice
const PURPOSE_SUGGESTIONS = [
  "Salary", "Bonus", "Commission", "Allowance", "Reimbursement",
  "Rent", "Subscription", "Incentive", "Stipend", "Other",
]
const FREQUENCIES = [
  { value: "once", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
]
const FREQUENCY_LABELS: Record<string, string> = Object.fromEntries(FREQUENCIES.map(f => [f.value, f.label]))
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

function formatAmount(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return String(amount)
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function payDayLabel(plan: PaymentPlan): string {
  if (plan.payDay === null || plan.payDay === undefined) return ""
  if (plan.frequency === "weekly") return ` · ${WEEKDAYS[plan.payDay] ?? ""}`
  return ` · on the ${plan.payDay}${plan.payDay === 1 ? "st" : plan.payDay === 2 ? "nd" : plan.payDay === 3 ? "rd" : "th"}`
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase() || "?"
}

// ─── Modals ───────────────────────────────────────────────────────────────

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl my-8"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

const inputCls = "w-full"
const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// ─── Payee Form (create / edit) ───────────────────────────────────────────

interface PayeeFormState {
  name: string
  walletAddress: string
  category: string
  notes: string
}

function PayeeFormModal({ editing, onClose, onCreated }: { editing: Payee | null; onClose: () => void; onCreated?: (p: Payee) => void }) {
  const { createPayee, updatePayee } = useAuth()
  const [form, setForm] = useState<PayeeFormState>({
    name: editing?.name || "",
    walletAddress: editing?.walletAddress || "",
    category: editing?.category || "Employee",
    notes: editing?.notes || "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    setError("")
    if (!form.name.trim()) return setError("Name is required")
    if (!form.walletAddress.trim()) return setError("Wallet address is required")
    if (!/^0x[a-fA-F0-9]{40}$/.test(form.walletAddress.trim()) && !/^[a-zA-Z0-9._-]{1,64}\.arc$/.test(form.walletAddress.trim())) {
      return setError("Invalid wallet address — use a 0x… address or a name.arc handle")
    }
    setSaving(true)
    try {
      if (editing) {
        await updatePayee(editing.id, {
          name: form.name.trim(), walletAddress: form.walletAddress.trim(),
          category: form.category.trim() || "Employee", notes: form.notes.trim(),
        })
        onClose()
      } else {
        const created = await createPayee({
          name: form.name.trim(), walletAddress: form.walletAddress.trim(),
          category: form.category.trim() || "Employee", notes: form.notes.trim(),
        })
        // Jump straight into the salary/plan setup for the new payee
        onCreated?.(created)
        onClose()
      }
    } catch (err: any) {
      setError(err.message || "Failed to save payee")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? "Edit Payee" : "Add Payee"}
      subtitle={editing ? "Update this payee's details" : "Employees, vendors, contractors — name the category anything you like"}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full name</label>
          <Input placeholder="e.g. Alice Johnson" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Wallet address</label>
          <Input placeholder="0x…" value={form.walletAddress} onChange={(e) => setForm({ ...form, walletAddress: e.target.value })} className={inputCls + " font-mono text-xs"} />
          <p className="text-[11px] text-muted-foreground mt-1">Payments go directly to this address — synchronously, on-chain.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
          <Input list="payee-categories" placeholder="Employee, Vendor, Freelancer…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} />
          <datalist id="payee-categories">
            {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
          </datalist>
          <p className="text-[11px] text-muted-foreground mt-1">Anything you want — not just employees.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes (optional)</label>
          <Input placeholder="e.g. Full-time, Engineering team" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
        </div>
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/5 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /><span>{error}</span>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</> : editing ? "Save Changes" : "Add Payee"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Payment Plan Form (create / edit) ────────────────────────────────────

interface PlanFormState {
  purpose: string
  amount: string
  frequency: string
  payDay: string
  startDate: string
  sourceWalletId: string
}

function PlanFormModal({ payee, editing, onClose }: { payee: Payee; editing: PaymentPlan | null; onClose: () => void }) {
  const { createPlan, updatePlan, wallets } = useAuth()
  const [form, setForm] = useState<PlanFormState>({
    purpose: editing?.purpose || "Salary",
    amount: editing?.amount || "",
    frequency: editing?.frequency || "monthly",
    payDay: editing?.payDay !== null && editing?.payDay !== undefined ? String(editing.payDay) : "",
    startDate: toLocalInputValue(editing?.startDate),
    sourceWalletId: editing?.sourceWalletId || "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const needsPayDay = ["weekly", "monthly", "quarterly", "yearly"].includes(form.frequency)

  const changeFrequency = (freq: string) => {
    setForm(f => ({
      ...f,
      frequency: freq,
      // Sensible defaults when switching: Monday for weekly, 1st for monthly+
      payDay: freq === "weekly" ? "1" : ["monthly", "quarterly", "yearly"].includes(freq) ? "1" : "",
    }))
  }

  const submit = async () => {
    setError("")
    if (!form.amount || parseFloat(form.amount) <= 0) return setError("Enter an amount greater than 0")
    const payload = {
      purpose: form.purpose.trim() || "Salary",
      amount: form.amount,
      frequency: form.frequency,
      payDay: needsPayDay && form.payDay !== "" ? parseInt(form.payDay) : null,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      sourceWalletId: form.sourceWalletId || null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updatePlan(payee.id, editing.id, payload)
      } else {
        await createPlan(payee.id, payload)
      }
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to save payment plan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? "Edit Payment Plan" : `New Payment Plan — ${payee.name}`}
      subtitle={editing ? "Update amount, purpose, or schedule" : "Salary, bonus, rent… name the purpose anything you want"}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Purpose</label>
            <Input list="plan-purposes" placeholder="Salary, Bonus…" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={inputCls} />
            <datalist id="plan-purposes">
              {PURPOSE_SUGGESTIONS.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount (USDC)</label>
            <Input type="number" min="0" step="0.01" placeholder="2500.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequency</label>
            <select className={selectCls} value={form.frequency} onChange={(e) => changeFrequency(e.target.value)}>
              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          {needsPayDay ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {form.frequency === "weekly" ? "Pay day" : "Day of month"}
              </label>
              {form.frequency === "weekly" ? (
                <select className={selectCls} value={form.payDay} onChange={(e) => setForm({ ...form, payDay: e.target.value })}>
                  {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              ) : (
                <select className={selectCls} value={form.payDay} onChange={(e) => setForm({ ...form, payDay: e.target.value })}>
                  {MONTH_DAYS.map(d => <option key={d} value={d}>{d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}</option>)}
                </select>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Pay day</label>
              <div className="flex h-10 items-center rounded-md border border-dashed border-input px-3 text-xs text-muted-foreground">
                {form.frequency === "once" ? "On the date below" : "Auto (every 14 days)"}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">First payment date</label>
            <Input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} />
            <p className="text-[11px] text-muted-foreground mt-1">Recurring payments keep this time of day.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Pay from wallet</label>
            <select className={selectCls} value={form.sourceWalletId} onChange={(e) => setForm({ ...form, sourceWalletId: e.target.value })}>
              <option value="">Primary wallet (auto)</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>{w.label || "Wallet"} — {w.balance} USDC</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/5 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /><span>{error}</span>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</> : editing ? "Save Changes" : "Create Plan"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Plan Row ─────────────────────────────────────────────────────────────

function PlanRow({ payee, plan }: { payee: Payee; plan: PaymentPlan }) {
  const { executePlan, updatePlan, deletePlan, totalBalance } = useAuth()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null)

  const handlePayNow = async () => {
    const amount = parseFloat(plan.amount)
    if (totalBalance < amount) {
      setNotice({ type: "error", text: `Not enough balance — you have ${formatAmount(totalBalance)} USDC, this plan needs ${formatAmount(amount)} USDC.` })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      await executePlan(payee.id, plan.id)
      setNotice({ type: "success", text: `Paid ${formatAmount(amount)} USDC to ${payee.name} — confirmed on-chain.` })
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Payment failed" })
    } finally {
      setBusy(false)
    }
  }

  const togglePause = async () => {
    setNotice(null)
    try {
      await updatePlan(payee.id, plan.id, { status: plan.status === "active" ? "paused" : "active" })
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Update failed" })
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete this ${plan.purpose.toLowerCase()} plan for ${payee.name}?`)) return
    setNotice(null)
    try {
      await deletePlan(payee.id, plan.id)
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Delete failed" })
    }
  }

  return (
    <div className="border border-border/50 rounded-xl p-3.5 bg-background/40 hover:bg-background/70 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0">
          <Repeat className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">{plan.purpose}</p>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-medium">{FREQUENCY_LABELS[plan.frequency] || plan.frequency}</Badge>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${plan.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : plan.status === "paused" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
              {plan.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-semibold text-foreground">{formatAmount(plan.amount)} {plan.token}</span>
            {payDayLabel(plan)}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
            <CalendarClock className="w-3.5 h-3.5" />
            {plan.status === "completed" ? (
              <span className="text-emerald-600 dark:text-emerald-400">Completed</span>
            ) : (
              <span>Next: <span className="font-medium text-foreground">{formatDate(plan.nextRun)}</span></span>
            )}
          </div>
          {notice && (
            <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${notice.type === "error" ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
              {notice.type === "error" ? <AlertCircle className="w-3 h-3 shrink-0" /> : <CheckCircle className="w-3 h-3 shrink-0" />}
              <span className="break-words">{notice.text}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {plan.status === "active" && (
            <Button size="sm" variant="default" className="gap-1.5 h-8 px-2.5 text-xs" onClick={handlePayNow} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Pay now</span>
            </Button>
          )}
          {plan.status !== "completed" && (
            <button onClick={togglePause} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors" title={plan.status === "active" ? "Pause" : "Resume"}>
              {plan.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}
          <button onClick={handleDelete} className="p-2 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors" title="Delete plan">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payee Card ───────────────────────────────────────────────────────────

function PayeeCard({ payee, onEdit, onAddPlan }: { payee: Payee; onEdit: () => void; onAddPlan: () => void }) {
  const { deletePayee } = useAuth()
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const copyAddress = () => {
    navigator.clipboard.writeText(payee.walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${payee.name} and all their payment plans?`)) return
    setDeleting(true)
    try {
      await deletePayee(payee.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-foreground flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-background">{initials(payee.name)}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{payee.name}</p>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 flex items-center gap-1 max-w-[140px]">
                  <Tag className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{payee.category}</span>
                </Badge>
              </div>
              <button onClick={copyAddress} className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mt-0.5 max-w-full">
                <span className="truncate">{payee.walletAddress}</span>
                {copied ? <CheckCircle className="w-3 h-3 shrink-0 text-emerald-500" /> : <Copy className="w-3 h-3 shrink-0" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors" title="Edit payee">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={handleDelete} className="p-2 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors" title="Delete payee" disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {payee.notes && <p className="text-xs text-muted-foreground mb-4">{payee.notes}</p>}

        <div className="space-y-2.5">
          {payee.plans.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">No payment plans yet</p>
              <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs" onClick={onAddPlan}>
                <Plus className="w-3.5 h-3.5" /> Add {payee.category.toLowerCase() || "payment"} plan
              </Button>
            </div>
          ) : (
            <>
              {payee.plans.map(plan => (
                <PlanRow key={plan.id} payee={payee} plan={plan} />
              ))}
              <button onClick={onAddPlan} className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-2 rounded-xl border border-dashed border-border hover:border-foreground/30 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add another plan
              </button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────

export default function PayrollSection() {
  const { payees } = useAuth()
  const [showPayeeForm, setShowPayeeForm] = useState(false)
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null)
  const [planForPayee, setPlanForPayee] = useState<Payee | null>(null)
  const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null)

  const openPayeeForm = () => { setEditingPayee(null); setShowPayeeForm(true) }
  const openEditPayee = (p: Payee) => { setEditingPayee(p); setShowPayeeForm(true) }
  const openPlanForm = (payee: Payee, plan: PaymentPlan | null = null) => {
    setPlanForPayee(payee)
    setEditingPlan(plan)
  }

  const totalPlans = payees.reduce((sum, p) => sum + p.plans.length, 0)
  const monthlyObligation = payees.reduce((sum, p) =>
    sum + p.plans.reduce((s, pl) => {
      if (pl.status !== "active") return s
      switch (pl.frequency) {
        case "weekly": return s + parseFloat(pl.amount) * 4.33
        case "bi-weekly": return s + parseFloat(pl.amount) * 2.17
        case "monthly": return s + parseFloat(pl.amount)
        case "quarterly": return s + parseFloat(pl.amount) / 3
        case "yearly": return s + parseFloat(pl.amount) / 12
        case "daily": return s + parseFloat(pl.amount) * 30
        default: return s
      }
    }, 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Payees &amp; Payments</h2>
            <p className="text-xs text-muted-foreground">Employees, vendors, anyone — with recurring USDC payouts</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openPayeeForm}><UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Add Payee</span><span className="sm:hidden">Add</span></Button>
      </div>

      {payees.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /><span>{payees.length} payee{payees.length !== 1 ? "s" : ""}</span></div>
          <div className="flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" /><span>{totalPlans} active plan{totalPlans !== 1 ? "s" : ""}</span></div>
          <div className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /><span>≈ {formatAmount(monthlyObligation)} USDC / month</span></div>
        </div>
      )}

      {payees.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm mb-1">No payees yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5">
              Add your employees, contractors, or vendors with their wallet addresses — then set up salary, bonus,
              or any recurring payment you can name.
            </p>
            <Button className="gap-2" onClick={openPayeeForm}><UserPlus className="w-4 h-4" /> Add your first payee</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {payees.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(i * 0.06, 0.4) }}>
              <PayeeCard payee={p} onEdit={() => openEditPayee(p)} onAddPlan={() => openPlanForm(p)} />
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showPayeeForm && (
          <PayeeFormModal
            editing={editingPayee}
            onClose={() => { setShowPayeeForm(false); setEditingPayee(null) }}
            onCreated={(p) => { setShowPayeeForm(false); setEditingPayee(null); setPlanForPayee(p); setEditingPlan(null) }}
          />
        )}
        {planForPayee && (
          <PlanFormModal
            payee={planForPayee}
            editing={editingPlan}
            onClose={() => { setPlanForPayee(null); setEditingPlan(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
