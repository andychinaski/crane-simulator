<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'
import { useSceneDialogPosition } from './useSceneDialogPosition'

const props = defineProps<{ camera?: HTMLElement; scene?: HTMLElement; crane?: HTMLElement }>()
const emit = defineEmits<{ dismiss: [] }>()

const steps = [
  {
    zone: 'camera',
    title: 'Управление камерой',
    description: 'Регуляторы снизу изменяют вид: горизонталь, вертикаль, масштаб и обход сцены. Кнопка „Сбросить вид“ возвращает исходный ракурс.',
  },
  {
    zone: 'scene',
    title: 'Рабочая область',
    description: 'Здесь находится трёхмерная сцена: кран, ящик и площадка доставки. Сцену можно рассматривать с разных сторон.',
  },
  {
    zone: 'crane',
    title: 'Управление краном',
    description: 'Справа находятся семь регуляторов механизмов крана. Ход работы и подсказки отображаются под ними.',
  },
] as const

const stepIndex = ref(-1)
const step = computed(() => steps[stepIndex.value])
const target = computed(() => step.value && props[step.value.zone])
const dialog = ref<HTMLDialogElement>()
const card = ref<HTMLElement>()
const { position: welcomePosition, update: positionWelcome } =
  useSceneDialogPosition(() => props.scene, () => step.value ? undefined : card.value)
const spotlight = ref<CSSProperties>()
const margin = 16
const gap = 14
const tooltipWidth = 500
let startScroll = 0
let observer: ResizeObserver | undefined

function positionTour() {
  const dialogElement = dialog.value
  const cardElement = card.value
  const rect = target.value?.getBoundingClientRect()
  if (!dialogElement?.open || !cardElement || !rect) {
    spotlight.value = undefined
    return
  }

  const { width, height } = dialogElement.getBoundingClientRect()
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  const left = clamp(rect.left, 0, width)
  const top = clamp(rect.top, 0, height)
  const right = clamp(rect.right, 0, width)
  const bottom = clamp(rect.bottom, 0, height)
  spotlight.value = right > left && bottom > top
    ? { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` }
    : undefined

  const availableWidth = width - margin * 2
  const availableHeight = height - margin * 2
  const preferredWidth = Math.min(tooltipWidth, availableWidth)
  const positions = {
    above: { width: availableWidth, height: top - gap - margin },
    below: { width: availableWidth, height: height - bottom - gap - margin },
    right: { width: width - right - gap - margin, height: availableHeight },
    left: { width: left - gap - margin, height: availableHeight },
  }
  const preference = step.value?.zone === 'camera'
    ? ['above', 'below', 'right', 'left'] as const
    : ['right', 'left', 'above', 'below'] as const
  const candidates = []
  const heights = new Map<number, number>()
  const style = cardElement.style
  const scrollTop = cardElement.scrollTop
  const measure = (cardWidth: number) => {
    const known = heights.get(cardWidth)
    if (known !== undefined) return known
    style.width = `${cardWidth}px`
    style.maxHeight = 'none'
    const naturalHeight = cardElement.getBoundingClientRect().height
    heights.set(cardWidth, naturalHeight)
    return naturalHeight
  }
  for (const side of preference) {
    const space = positions[side]
    const cardWidth = Math.min(preferredWidth, space.width)
    if (cardWidth < Math.min(230, preferredWidth) || space.height < 112) continue
    const naturalHeight = measure(cardWidth)
    const cardHeight = Math.min(naturalHeight, space.height)
    candidates.push({ side, cardWidth, cardHeight, naturalHeight })
  }
  const best = candidates.find(candidate => candidate.cardWidth === preferredWidth && candidate.cardHeight === candidate.naturalHeight)
    ?? candidates.find(candidate => candidate.cardHeight === candidate.naturalHeight)
    ?? candidates.sort((a, b) => b.cardHeight / b.naturalHeight - a.cardHeight / a.naturalHeight)[0]

  function coordinates(side: keyof typeof positions, cardWidth: number, cardHeight: number) {
    const x = side === 'right' ? right + gap : side === 'left'
      ? left - gap - cardWidth : (left + right - cardWidth) / 2
    const y = side === 'below' ? bottom + gap : side === 'above'
      ? top - gap - cardHeight : (top + bottom - cardHeight) / 2
    return { x: clamp(x, margin, width - cardWidth - margin), y: clamp(y, margin, height - cardHeight - margin) }
  }

  const cardWidth = best?.cardWidth ?? Math.min(preferredWidth, 340)
  const cardHeight = best?.cardHeight ?? Math.min(measure(cardWidth), availableHeight)
  const { x, y } = best ? coordinates(best.side, cardWidth, cardHeight) : preference
    .map(side => coordinates(side, cardWidth, cardHeight))
    .reduce((least, candidate) => {
      const overlap = ({ x, y }: { x: number; y: number }) =>
        Math.max(0, Math.min(x + cardWidth, right) - Math.max(x, left)) *
        Math.max(0, Math.min(y + cardHeight, bottom) - Math.max(y, top))
      return overlap(candidate) < overlap(least) ? candidate : least
    })
  Object.assign(style, {
    left: `${x}px`, top: `${y}px`, width: `${cardWidth}px`, maxHeight: `${cardHeight}px`,
  })
  if (scrollTop) cardElement.scrollTop = scrollTop
}

function followScroll(event: Event) {
  if (event.target instanceof Node && card.value?.contains(event.target)) return
  positionTour()
}

function revealStep() {
  if (!dialog.value?.open) return
  const element = target.value
  const rect = element?.getBoundingClientRect()
  if (step.value?.zone === 'scene' && rect && rect.width + 2 * margin >= innerWidth && rect.height < innerHeight) {
    // On the stacked layout, keep the entire scene visible and make room below it.
    window.scrollBy({ top: rect.top - margin, behavior: 'instant' })
  } else if (rect && (rect.top < 0 || rect.bottom > innerHeight)) {
    element?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
  positionTour()
}

function showStep() {
  revealStep()
  if (!dialog.value?.open) return
  dialog.value.focus({ preventScroll: true })
}

function open() {
  startScroll = window.scrollY
  dialog.value?.showModal()
  dialog.value?.focus({ preventScroll: true })
  positionWelcome()
}

async function restart() {
  stepIndex.value = 0
  await nextTick()
  open()
  showStep()
}

function dismiss() {
  dialog.value?.close()
  if (window.scrollY !== startScroll) window.scrollTo({ top: startScroll, behavior: 'instant' })
  emit('dismiss')
}

function keepTabInDialog(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !card.value) return
  const buttons = card.value.querySelectorAll('button')
  const first = buttons[0]
  const last = buttons[buttons.length - 1]
  const focused = document.activeElement
  if (focused === dialog.value || (event.shiftKey ? focused === first : focused === last)) {
    event.preventDefault()
    const next = event.shiftKey ? last : first
    next.focus()
  }
}

watch(stepIndex, showStep, { flush: 'post' })
watch(() => [card.value, target.value], ([currentCard, currentTarget]) => {
  observer?.disconnect()
  if (currentCard) observer?.observe(currentCard)
  if (currentTarget) observer?.observe(currentTarget)
}, { flush: 'post' })

onMounted(() => {
  observer = new ResizeObserver(positionTour)
  if (card.value) observer.observe(card.value)
  window.addEventListener('resize', revealStep)
  window.addEventListener('scroll', followScroll, true)
  open()
})

onUnmounted(() => {
  observer?.disconnect()
  window.removeEventListener('resize', revealStep)
  window.removeEventListener('scroll', followScroll, true)
})

defineExpose({ restart })
</script>

<template>
  <dialog ref="dialog" class="onboarding" data-testid="onboarding"
    aria-labelledby="onboarding-title" aria-describedby="onboarding-description"
    @cancel.prevent="dismiss" @keydown="keepTabInDialog" @wheel.self.prevent @touchmove.self.prevent>
    <div v-if="step && spotlight" class="spotlight" :style="spotlight"
      data-testid="onboarding-spotlight" :data-zone="step.zone" aria-hidden="true"></div>
    <div v-else class="onboarding-shade" aria-hidden="true"></div>
    <section ref="card" class="onboarding-card" :class="{ 'onboarding-welcome': !step }"
      :style="step ? undefined : welcomePosition" data-testid="onboarding-card">
      <p v-if="step" class="onboarding-progress">{{ stepIndex + 1 }} из {{ steps.length }}</p>
      <h2 id="onboarding-title">
        {{ step?.title ?? 'Добро пожаловать в симулятор крана' }}
      </h2>
      <p id="onboarding-description">
        {{ step?.description ?? 'Узнайте, как управлять сценой и механизмами' }}
      </p>
      <div v-if="step" class="onboarding-actions">
        <button v-if="stepIndex > 0" class="secondary onboarding-back" type="button" @click="stepIndex--">Назад</button>
        <div class="onboarding-forward">
          <button class="secondary onboarding-skip" type="button" @click="dismiss">Пропустить</button>
          <button v-if="stepIndex < steps.length - 1" class="demo onboarding-next" type="button" @click="stepIndex++">Далее</button>
          <button v-else class="demo" type="button" @click="dismiss">Завершить</button>
        </div>
      </div>
      <div v-else class="onboarding-actions">
        <button class="demo" type="button" @click="stepIndex = 0">Пройти обучение</button>
        <button class="secondary" type="button" @click="dismiss">Пропустить обучение</button>
      </div>
    </section>
  </dialog>
</template>

<style scoped>
.onboarding {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease, display 160ms allow-discrete, overlay 160ms allow-discrete;
}
.onboarding[open] { opacity: 1; pointer-events: auto; }
@starting-style {
  .onboarding[open] { opacity: 0; }
}
.onboarding::backdrop { background: transparent; pointer-events: none; }
.onboarding-shade, .spotlight { position: absolute; pointer-events: none; }
.onboarding-shade { inset: 0; background: #0a0e14ba; }
.spotlight {
  border-radius: 11px;
  outline: 2px solid #ffbd59;
  box-shadow: 0 0 0 200vmax #0a0e14ba, 0 0 18px 2px #f9a01c60;
}
.onboarding-card {
  position: absolute;
  left: 12px;
  top: 12px;
  width: min(500px, calc(100% - 32px));
  max-height: calc(100% - 32px);
  padding: 16px;
  border: 1px solid #616970;
  border-radius: 11px;
  overflow: auto;
  overscroll-behavior: contain;
  background: #272c30;
  box-shadow: 0 14px 36px #080b107a;
}
.onboarding-welcome {
  width: min(440px, calc(100% - 32px));
  padding: clamp(18px, 3vw, 26px);
  text-align: center;
}
.onboarding-card h2 { font-size: 22px; }
.onboarding-welcome h2 { font-size: clamp(22px, 2.2vw, 27px); }
.onboarding-card p { margin: 8px 0 14px; color: #e1e5e9; line-height: 1.42; }
.onboarding-card .onboarding-progress { margin: 0 0 6px; color: #ffbd59; font-size: 14px; font-weight: 650; }
.onboarding-actions { display: flex; flex-wrap: wrap; gap: 7px; }
.onboarding-forward { display: flex; flex: 1; justify-content: space-between; gap: 7px; }
.onboarding-welcome .onboarding-actions { justify-content: center; }
.onboarding-actions button { padding-inline: 8px; font-size: 14px; }
.onboarding-skip, .onboarding-next { inline-size: 7.2em; }
.onboarding-back { min-inline-size: 112px; }
.onboarding:focus-visible, .onboarding-actions button:focus-visible { outline: none; }
@media (max-width: 430px) {
  .onboarding-card:not(.onboarding-welcome) { padding: 14px; }
  .onboarding-actions, .onboarding-forward { gap: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .onboarding { transition: none; }
}
</style>
