'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UseHeartbeatOptions {
  enabled: boolean
  onStudsCredited: (amount: number, newBalance: number) => void
  intervalMs?: number
}

export function useHeartbeat({
  enabled,
  onStudsCredited,
  intervalMs = 60_000,
}: UseHeartbeatOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const ping = useCallback(async () => {
    try {
      const res = await fetch('/api/heartbeat', { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      if (data.studs_credited > 0 && data.new_balance != null) {
        onStudsCredited(data.studs_credited, data.new_balance)
      }
    } catch {}
  }, [onStudsCredited])

  useEffect(() => {
    if (!enabled) return
    ping()
    intervalRef.current = setInterval(ping, intervalMs)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, ping, intervalMs])
}