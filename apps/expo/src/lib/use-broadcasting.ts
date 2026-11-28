import { useEffect, useState } from "react"
import { AppState } from "react-native"

import type { TrackingRecord } from "./tracking-model"
import { readTracking } from "./background-location"
import { canTransmit } from "./tracking-model"

/**
 * Local truth for "this phone is broadcasting its group": the record that the
 * native GPS task itself checks before each upload. Polled, because the record
 * is written by background code that cannot notify React.
 */
export function useBroadcasting(intervalMs = 4_000): TrackingRecord | null {
  const [record, setRecord] = useState<TrackingRecord | null>(null)
  useEffect(() => {
    let alive = true
    const check = () =>
      void readTracking().then((value) => {
        if (!alive) return
        const next = canTransmit(value, Date.now()) ? value : null
        setRecord((current) =>
          current?.sessionId === next?.sessionId &&
          current?.generation === next?.generation
            ? current
            : next,
        )
      })
    check()
    const timer = setInterval(check, intervalMs)
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") check()
    })
    return () => {
      alive = false
      clearInterval(timer)
      listener.remove()
    }
  }, [intervalMs])
  return record
}
