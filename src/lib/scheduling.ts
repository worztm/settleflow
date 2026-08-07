// Unified scheduling core — THE single function used for every recurring
// payment in SettleFlow:
//   - AI-created schedules ("send 500 USDC to alice every friday")
//   - manually created schedules
//   - payee payment plans (salary / bonus / rent ... recurring payouts)
//
// The same module is imported by the Cloudflare Worker (backend) and the
// dashboard (frontend), so a cadence can never be computed two different ways.

export const SCHEDULE_FREQUENCIES = [
  { value: "once", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const

export const FREQUENCY_LABELS: Record<string, string> = Object.fromEntries(
  SCHEDULE_FREQUENCIES.map(f => [f.value, f.label])
)

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// Aliases the AI intent parser emits for weekday-targeted weekly schedules.
// "weekly-friday" / "weekly-monday" carry the target day-of-week, so the
// unified scheduler maps them onto the same (frequency + payDay) model used
// by payee payment plans — no special-casing anywhere else.
const WEEKDAY_ALIASES: Record<string, number> = {
  "weekly-monday": 1,
  "weekly-friday": 5,
}

/** Normalizes any frequency string into the canonical (frequency, payDay) model. */
export function normalizeFrequency(frequency: string): { frequency: string; payDay: number | null } {
  if (frequency in WEEKDAY_ALIASES) return { frequency: "weekly", payDay: WEEKDAY_ALIASES[frequency] }
  return { frequency, payDay: null }
}

/**
 * Computes the next occurrence of a recurring payment.
 *
 * @param frequency  once | daily | weekly | bi-weekly | monthly | quarterly | yearly
 *                   (+ AI aliases weekly-monday / weekly-friday)
 * @param payDay     weekly -> 0-6 (0 = Sunday); monthly/quarterly/yearly -> 1-31
 *                   (clamped to month length). Falls back to startDate's weekday/day.
 * @param startDate  first payment; recurring payments keep its time-of-day.
 * @param at         the previous scheduled slot (the next_run that just fired).
 *                   When rolling forward after an execution we anchor on it
 *                   (+period) so a queue that processes late never shifts the
 *                   payday cadence. When omitted, computes the next occurrence
 *                   of the series against now.
 */
export function computeNextRun(
  frequency: string,
  payDay?: number | null,
  startDate?: string | null,
  at?: string | null
): string | null {
  const now = new Date()
  const start = startDate ? new Date(startDate) : null
  const hasStart = !!start && !isNaN(start.getTime())
  const anchor = at ? new Date(at) : null
  const hasAnchor = !!anchor && !isNaN(anchor.getTime())

  const { frequency: base, payDay: aliasDay } = normalizeFrequency(frequency)
  const targetDay = payDay ?? aliasDay

  if (base === "once") {
    // One-time payout fires on the chosen date (or immediately when none is set)
    if (!hasStart || start!.getTime() <= now.getTime()) return now.toISOString()
    return start!.toISOString()
  }

  // Recurring payments keep the time-of-day of the first payment so payouts
  // land at the same hour.
  const hour = hasAnchor ? anchor!.getHours() : hasStart ? start!.getHours() : 9
  const minute = hasAnchor ? anchor!.getMinutes() : hasStart ? start!.getMinutes() : 0

  if (base === "daily") {
    const baseDate = hasAnchor ? anchor! : now
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1, hour, minute, 0, 0)
    return d.toISOString()
  }

  if (base === "bi-weekly") {
    // Fires on the same weekday as the first payment, every 14 days. Anchored
    // runs simply add 14 days to the previous slot so late processing never drifts.
    if (hasAnchor) {
      const d = new Date(anchor!.getFullYear(), anchor!.getMonth(), anchor!.getDate() + 14, hour, minute, 0, 0)
      return d.toISOString()
    }
    const baseDow = hasStart ? start!.getDay() : now.getDay()
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
    let diff = (baseDow - d.getDay() + 7) % 7
    d.setDate(d.getDate() + diff)
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 14)
    return d.toISOString()
  }

  if (base === "weekly") {
    if (hasAnchor) {
      const d = new Date(anchor!.getFullYear(), anchor!.getMonth(), anchor!.getDate() + 7, hour, minute, 0, 0)
      return d.toISOString()
    }
    const targetDow = targetDay ?? (hasStart ? start!.getDay() : now.getDay())
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
    let diff = (targetDow - d.getDay() + 7) % 7
    if (diff === 0) diff = 7 // always move to the *next* occurrence
    d.setDate(d.getDate() + diff)
    return d.toISOString()
  }

  // monthly / quarterly / yearly — day-of-month based, aligned to the start month
  const targetDom = targetDay ?? (hasStart ? start!.getDate() : now.getDate())
  const baseYear = hasAnchor ? anchor!.getFullYear() : hasStart ? start!.getFullYear() : now.getFullYear()
  const baseMonth = hasAnchor ? anchor!.getMonth() : hasStart ? start!.getMonth() : now.getMonth()
  const stepMonths = base === "quarterly" ? 3 : base === "yearly" ? 12 : 1
  // The next slot must be strictly after the previous slot (anchor); when there
  // is no anchor (fresh plan / resume) it must be after now.
  const after = hasAnchor ? anchor!.getTime() : now.getTime()

  let candidate = new Date(baseYear, baseMonth, 1)
  for (;;) {
    const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()
    const day = Math.min(Math.max(1, targetDom), lastDay)
    const d = new Date(candidate.getFullYear(), candidate.getMonth(), day, hour, minute, 0, 0)
    if (d.getTime() > after) return d.toISOString()
    candidate = new Date(candidate.getFullYear(), candidate.getMonth() + stepMonths, 1)
  }
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}

/** Human-readable label for a frequency (+ optional pay day), e.g. "Every Friday". */
export function frequencyLabel(frequency: string, payDay?: number | null): string {
  const { frequency: base, payDay: aliasDay } = normalizeFrequency(frequency)
  const day = payDay ?? aliasDay
  switch (base) {
    case "once": return "One-time"
    case "daily": return "Daily"
    case "weekly":
      return day !== null && day !== undefined ? `Every ${WEEKDAYS[day] ?? ""}`.trim() : "Weekly"
    case "bi-weekly": return "Bi-weekly"
    case "monthly": return day ? `Monthly on the ${ordinal(day)}` : "Monthly"
    case "quarterly": return day ? `Quarterly on the ${ordinal(day)}` : "Quarterly"
    case "yearly": return day ? `Yearly on the ${ordinal(day)}` : "Yearly"
    default: return frequency
  }
}
