import { AppKit } from "@circle-fin/app-kit"
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2"
import { createWalletClient, http, type WalletClient } from "viem"
import { privateKeyToAccount } from "viem/accounts"

export const SUPPORTED_CHAINS = {
  Arc_Testnet: { name: "Arc Testnet", chain: "Arc_Testnet", token: "USDC", rpc: "https://rpc.testnet.arc.io" },
  Arc_Mainnet: { name: "Arc Mainnet", chain: "Arc_Mainnet", token: "USDC", rpc: "https://rpc.mainnet.arc.io" },
  Ethereum_Sepolia: { name: "Ethereum Sepolia", chain: "Ethereum_Sepolia", token: "USDC", rpc: "https://rpc.sepolia.org" },
  Ethereum: { name: "Ethereum", chain: "Ethereum", token: "USDC", rpc: "https://rpc.ankr.com/eth" },
  Base: { name: "Base", chain: "Base", token: "USDC", rpc: "https://mainnet.base.org" },
  Solana_Devnet: { name: "Solana Devnet", chain: "Solana_Devnet", token: "USDC" },
  Solana_Mainnet: { name: "Solana", chain: "Solana_Mainnet", token: "USDC" },
} as const

export type ChainKey = keyof typeof SUPPORTED_CHAINS

export async function initArcKit() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No Ethereum provider found. Please install MetaMask or Arc wallet.")
  }
  const provider = (window as any).ethereum
  const viemAdapter = await createViemAdapterFromProvider({ provider })
  const kit = new AppKit()
  return { kit, adapter: viemAdapter }
}

export async function sendUSDC(kit: AppKit, adapter: any, to: string, amount: string, chain: string = "Arc_Testnet") {
  return kit.send({ from: { adapter, chain: chain as any }, to, amount, token: "USDC" })
}

export async function bridgeUSDC(kit: AppKit, adapter: any, fromChain: string, toChain: string, amount: string) {
  return kit.bridge({ from: { adapter, chain: fromChain as any }, to: { adapter, chain: toChain as any }, amount })
}

export async function swapTokens(kit: AppKit, adapter: any, tokenIn: string, tokenOut: string, amountIn: string, chain: string = "Arc_Testnet", to?: { chain?: string; recipientAddress?: string }) {
  if (to?.chain && to?.recipientAddress) {
    return kit.swap({ from: { adapter, chain: chain as any }, tokenIn, tokenOut, amountIn, to: { chain: to.chain as any, recipientAddress: to.recipientAddress } })
  }
  return kit.swap({ from: { adapter, chain: chain as any }, tokenIn, tokenOut, amountIn })
}

export function createAgentWalletClient(privateKey?: `0x${string}`): WalletClient {
  if (privateKey) return createWalletClient({ account: privateKeyToAccount(privateKey), transport: http("https://rpc.testnet.arc.io") })
  return createWalletClient({ transport: http("https://rpc.testnet.arc.io") })
}