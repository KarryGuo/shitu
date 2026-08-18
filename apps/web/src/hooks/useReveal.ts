import { useEffect, useRef } from 'react'

/** 滚动显现：进入视口时加 .in */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    el.querySelectorAll('.reveal').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])
  return ref
}

/** 定时器调度器：停止即彻底终止（沿用原型 makeRunner 语义） */
export function makeRunner() {
  let timers: ReturnType<typeof setTimeout>[] = []
  let alive = false
  return {
    start() {
      alive = true
    },
    schedule(fn: () => void, delay: number) {
      if (!alive) return
      const id = setTimeout(() => {
        if (alive) fn()
      }, delay)
      timers.push(id)
    },
    stop() {
      alive = false
      timers.forEach(clearTimeout)
      timers = []
    },
    get alive() {
      return alive
    },
  }
}
