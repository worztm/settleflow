// @vitest-environment node
// Pure date logic — runs in the node environment; no DOM required.
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { computeNextRun, frequencyLabel, normalizeFrequency } from "./scheduling"

// The scheduling module is timezone-robust: it operates on LOCAL calendar
// components (getDay/getDate/getHours), so every fixture here is built with
// local Date components (new Date(y, m, d, h, min)) and assertions compare the
// same local components on the result. The clock is frozen so "next occurrence
// from now" is deterministic in CI.

// Wed Jul 29 2099 at 10:30 local
const FROZEN_NOW = new Date(2099, 6, 29, 10, 30)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FROZEN_NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

function local(y: number, mo: number, d: number, h = 9, min = 0): string {
  return new Date(y, mo, d, h, min, 0, 0).toISOString()
}

describe("normalizeFrequency", () => {
  it("maps AI weekday aliases onto the (frequency + payDay) model", () => {
    expect(normalizeFrequency("weekly-friday")).toEqual({ frequency: "weekly", payDay: 5 })
    expect(normalizeFrequency("weekly-monday")).toEqual({ frequency: "weekly", payDay: 1 })
    expect(normalizeFrequency("monthly")).toEqual({ frequency: "monthly", payDay: null })
  })
})

describe("computeNextRun — weekly AI schedules fire on the RIGHT weekday", () => {
  // Regression: previously "every friday" computed +7 days from creation,
  // so a schedule made on a Wednesday fired every Wednesday forever.
  const wednesday = local(2099, 6, 29, 10, 30) // matches FROZEN_NOW

  it("\"weekly-friday\" lands on the next Friday, not +7 days", () => {
    const r = new Date(computeNextRun("weekly-friday", null, wednesday)!)
    expect(r.getDay()).toBe(5) // Friday
    expect(r.getDate()).toBe(31) // Jul 31 2099
    expect(r.getHours()).toBe(10)
    expect(r.getMinutes()).toBe(30)
  })

  it("\"weekly-monday\" lands on the next Monday", () => {
    const r = new Date(computeNextRun("weekly-monday", null, wednesday)!)
    expect(r.getDay()).toBe(1) // Monday
    expect(r.getDate()).toBe(3) // Aug 3 2099
  })

  it("anchored roll-forward keeps the payday when processing late", () => {
    // The Friday slot (Jul 31) fired; a lagging queue processes it later —
    // the next run must still be a Friday and exactly +7 days.
    const fired = local(2099, 6, 31, 10, 0)
    const r = new Date(computeNextRun("weekly-friday", null, null, fired)!)
    expect(r.getDay()).toBe(5)
    expect(r.getTime() - new Date(fired).getTime()).toBe(7 * 24 * 3600 * 1000)
  })
})

describe("computeNextRun — payee plan cadences", () => {
  it("monthly payday 31 clamps into shorter months", () => {
    // Anchored on Jan 31 → next occurrence is Feb 28 (clamped to month length).
    const jan31 = local(2099, 0, 31, 9)
    const r = new Date(computeNextRun("monthly", 31, jan31, jan31)!)
    expect(r.getMonth()).toBe(1) // February
    expect(r.getDate()).toBe(28)
  })

  it("daily keeps the start time-of-day", () => {
    const start = local(2099, 6, 1, 15, 45)
    const r = new Date(computeNextRun("daily", null, start, start)!)
    expect(r.getHours()).toBe(15)
    expect(r.getMinutes()).toBe(45)
    expect(r.getTime() - new Date(start).getTime()).toBe(24 * 3600 * 1000)
  })

  it("bi-weekly anchored roll-forward is exactly +14 days", () => {
    const start = local(2099, 6, 3, 9)
    const r = new Date(computeNextRun("bi-weekly", null, start, start)!)
    expect(r.getTime() - new Date(start).getTime()).toBe(14 * 24 * 3600 * 1000)
  })

  it("quarterly day-of-month steps in 3-month increments", () => {
    // Anchored on Jan 15 → next is Apr 15.
    const jan15 = local(2099, 0, 15, 9)
    const r = new Date(computeNextRun("quarterly", 15, jan15, jan15)!)
    expect(r.getMonth()).toBe(3) // April
    expect(r.getDate()).toBe(15)
  })

  it("once with a past startDate fires now", () => {
    const r = new Date(computeNextRun("once", null, "2020-01-01T00:00:00")!)
    expect(r.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it("once with a future startDate fires on that date", () => {
    const start = local(2099, 11, 25, 12)
    expect(computeNextRun("once", null, start)).toBe(start)
  })
})

describe("frequencyLabel", () => {
  it("renders weekday aliases as natural language", () => {
    expect(frequencyLabel("weekly-friday")).toBe("Every Friday")
    expect(frequencyLabel("weekly-monday")).toBe("Every Monday")
  })
  it("renders payee payDay variants", () => {
    expect(frequencyLabel("monthly", 1)).toBe("Monthly on the 1st")
    expect(frequencyLabel("monthly", 22)).toBe("Monthly on the 22nd")
    expect(frequencyLabel("yearly", 2)).toBe("Yearly on the 2nd")
  })
  it("falls back to plain frequency labels", () => {
    expect(frequencyLabel("daily")).toBe("Daily")
    expect(frequencyLabel("bi-weekly")).toBe("Bi-weekly")
  })
})