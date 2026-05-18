import type { LoanAccount } from '../data-access/use-loans'

export function formatSOL(lamports: bigint | number | undefined | null, decimals = 4): string {
  if (lamports === undefined || lamports === null) return '0'
  const n = typeof lamports === 'bigint' ? Number(lamports) : lamports
  return (n / 1_000_000_000).toFixed(decimals)
}

export function shortAddr(addr: string | undefined | null, lead = 4, tail = 3): string {
  if (!addr) return ''
  if (addr.length <= lead + tail + 1) return addr
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`
}

export function calculateOwed(loan: LoanAccount, nowSec?: bigint): bigint {
  const now = nowSec ?? BigInt(Math.floor(Date.now() / 1000))
  const elapsed = now > loan.data.startTs ? now - loan.data.startTs : 0n
  const cappedElapsed = elapsed > loan.data.duration ? loan.data.duration : elapsed
  const rateBps = BigInt(loan.data.interestRateBps)
  if (loan.data.duration === 0n) return loan.data.principal
  const interest = (loan.data.principal * rateBps * cappedElapsed) / (10_000n * loan.data.duration)
  return loan.data.principal + interest
}

export function loanProgress(loan: LoanAccount, nowSec?: bigint): number {
  if (loan.data.duration === 0n) return 0
  const now = nowSec ?? BigInt(Math.floor(Date.now() / 1000))
  const elapsed = now > loan.data.startTs ? now - loan.data.startTs : 0n
  const ratio = Number(elapsed) / Number(loan.data.duration)
  return Math.max(0, Math.min(1, ratio))
}

export function secondsLeft(loan: LoanAccount, nowSec?: bigint): bigint {
  const now = nowSec ?? BigInt(Math.floor(Date.now() / 1000))
  const end = loan.data.startTs + loan.data.duration
  return end > now ? end - now : 0n
}

export function formatDuration(seconds: bigint): string {
  const s = Number(seconds)
  if (s <= 0) return '0h'
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h`
  return `${Math.floor(s / 60)}m`
}

export function getRepaidTs(loan: LoanAccount): bigint | null {
  const r: any = loan.data.repaidTs
  if (!r) return null
  if (typeof r === 'object' && '__option' in r) {
    return r.__option === 'Some' ? (r.value as bigint) : null
  }
  if (typeof r === 'object' && 'value' in r) return r.value as bigint
  return null
}
