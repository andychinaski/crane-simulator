import { onMounted, onUnmounted, shallowRef, watch, type CSSProperties } from 'vue'

export function useSceneDialogPosition(scene: () => HTMLElement | undefined, card: () => HTMLElement | undefined) {
  const position = shallowRef<CSSProperties>()
  let observer: ResizeObserver | undefined

  function update() {
    const sceneBounds = scene()?.getBoundingClientRect()
    const cardBounds = card()?.getBoundingClientRect()
    if (!sceneBounds || !cardBounds?.width) return
    const width = document.documentElement.clientWidth
    const height = document.documentElement.clientHeight
    const margin = 16
    const center = (start: number, end: number, viewport: number) => {
      const visibleStart = Math.max(0, start)
      const visibleEnd = Math.min(viewport, end)
      return visibleEnd > visibleStart ? (visibleStart + visibleEnd) / 2 : viewport / 2
    }
    const left = Math.max(margin, Math.min(width - cardBounds.width - margin,
      center(sceneBounds.left, sceneBounds.right, width) - cardBounds.width / 2))
    const top = Math.max(margin, Math.min(height - cardBounds.height - margin,
      center(sceneBounds.top, sceneBounds.bottom, height) - cardBounds.height / 2))
    position.value = { left: `${left}px`, top: `${top}px` }
  }

  function observe() {
    observer?.disconnect()
    for (const element of [scene(), scene()?.parentElement, card()]) {
      if (element) observer?.observe(element)
    }
    update()
  }

  watch([scene, card], observe, { flush: 'post' })
  onMounted(() => {
    observer = new ResizeObserver(update)
    observe()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
  })
  onUnmounted(() => {
    observer?.disconnect()
    window.removeEventListener('resize', update)
    window.removeEventListener('scroll', update, true)
  })

  return { position, update }
}
