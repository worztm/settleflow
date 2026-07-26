export type ActionType = "send" | "swap" | "bridge" | "schedule" | "balance" | "create_wallet"
export type ExecutionType = "immediate" | "scheduled"

export interface ParsedIntent {
  action: ActionType
  amount: string
  token: string
  recipient?: string
  sourceChain?: string
  destChain?: string
  tokenIn?: string
  tokenOut?: string
  frequency?: string
  executionType: ExecutionType
  conditions?: string
  scheduleDate?: string
  summary?: string
  raw: string
}

const FREQUENCY_PATTERNS: [RegExp, string][] = [
  [/every\s+friday/i, "weekly-friday"],
  [/every\s+monday/i, "weekly-monday"],
  [/every\s+week/i, "weekly"],
  [/every\s+month/i, "monthly"],
  [/daily/i, "daily"],
]

export function parseIntent(text: string): ParsedIntent {
  let action: ActionType = "send"
  let amount = "0"
  let token = "USDC"
  let recipient: string | undefined
  let frequency: string | undefined
  let executionType: ExecutionType = "immediate"

  const amountMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(USDC|EURC|ETH|SOL)/i)
  if (amountMatch) { amount = amountMatch[1].replace(/,/g, ""); token = amountMatch[2].toUpperCase() }

  if (/swap/i.test(text)) {
    action = "swap"
    const swapMatch = text.match(/swap\s+(?:(\d+(?:,\d{3})*(?:\.\d+)?)\s*)?(\w+)\s+(?:for|to)\s+(\w+)/i)
    if (swapMatch) { if (swapMatch[1]) amount = swapMatch[1].replace(/,/g, ""); }
  } else if (/bridge/i.test(text)) {
    action = "bridge"
  }

  const toMatch = text.match(/(?:to|send)\s+(\S+@\S+|\S+\.\w+|\w+\.arc)/i)
  if (toMatch) recipient = toMatch[1].toLowerCase()

  for (const [pattern, freq] of FREQUENCY_PATTERNS) { if (pattern.test(text)) { frequency = freq; executionType = "scheduled"; break } }
  if (/schedule|every|recurring|weekly|monthly|daily/i.test(text)) executionType = "scheduled"
  if (/balance|show my wallet|how much/i.test(text)) action = "balance"
  if (/create wallet|new wallet/i.test(text)) action = "create_wallet"

  const actionLabels: Record<string, string> = { send: "Send", swap: "Swap", bridge: "Bridge", schedule: "Schedule", balance: "Check Balance", create_wallet: "Create Wallet" }
  const summary = `${actionLabels[action] || action}${amount !== "0" ? ` ${amount} ${token}` : ""}${recipient ? ` to ${recipient}` : ""}${frequency ? ` ${frequency}` : ""}`

  return { action, amount, token, recipient, frequency, executionType, summary, raw: text }
}