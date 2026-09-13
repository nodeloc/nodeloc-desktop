import { useEffect, useRef } from 'react'

/**
 * Receives a MessageBus channel while the component is mounted. The main
 * process holds the single long-poll connection; this only registers
 * interest. `lastId` is read once at subscribe time (-1 = only new messages).
 */
export function useRealtime(
  channel: string | null | undefined,
  onMessage: (data: unknown, messageId: number) => void,
  lastId = -1
): void {
  const handler = useRef(onMessage)
  handler.current = onMessage
  const initialId = useRef(lastId)
  initialId.current = lastId

  useEffect(() => {
    if (!channel) return
    void window.nodeloc.realtime.subscribe(channel, initialId.current)
    const off = window.nodeloc.events.onRealtime((message) => {
      if (message.channel === channel) handler.current(message.data, message.messageId)
    })
    return () => {
      off()
      void window.nodeloc.realtime.unsubscribe(channel)
    }
  }, [channel])
}
