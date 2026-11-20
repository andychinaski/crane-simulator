<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'

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
const spotlight = ref<CSSProperties>()
const cardPosition = ref<CSSProperties>()
let startScroll = 0
let observer: ResizeObserver | undefined

function positionTour() {
  const dialogElement = dialog.value
  const cardElement = card.value
  const rect = target.value?.getBoundingClientRect()
  if (!dialogElement?.open || !cardElement || !rect) {
    spotlight.value = undefined
    cardPosition.value = undefined
    return
  }

  const { width, height } = dialogElement.getBoundingClientRect()
  const left = Math.max(0, rect.left)
  const top = Math.max(0, rect.top)
  const right = Math.min(width, rect.right)
  const bottom = Math.min(height, rect.bottom)
  spotlight.value = right > left && bottom > top
    ? { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` }
    : undefined

  const { width: cardWidth, height: cardHeight } = cardElement.getBoundingClientRect()
  const margin = 12
  const gap = 14
  const maxX = width - cardWidth - margin
  const maxY = height - cardHeight - margin
  const centerX = Math.max(margin, Math.min(maxX, (left + right - cardWidth) / 2))
  const centerY = Math.max(margin, Math.min(maxY, (top + bottom - cardHeight) / 2))
  const sides = [[right + gap, centerY], [left - gap - cardWidth, centerY]]
  const rows = [[centerX, top - gap - cardHeight], [centerX, bottom + gap]]
  const candidates = step.value?.zone === 'camera' ? [...rows, ...sides] : [...sides, ...rows]
  const [x, y] = candidates.find(([x, y]) => x >= margin && x <= maxX && y >= margin && y <= maxY)
    ?? [centerX, Math.max(margin, maxY)]
  cardPosition.value = { left: `${x}px`, top: `${y}px` }
}

function showStep() {
  if (!dialog.value?.open) return
  const element = target.value
  const rect = element?.getBoundingClientRect()
  if (rect && (rect.top < 0 || rect.bottom > innerHeight)) {
    element?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
  positionTour()
  dialog.value.focus({ preventScroll: true })
}

function open() {
  startScroll = window.scrollY
  dialog.value?.showModal()
  dialog.value?.focus({ preventScroll: true })
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
  window.addEventListener('resize', positionTour)
  window.addEventListener('scroll', positionTour)
  open()
})

onUnmounted(() => {
  observer?.disconnect()
  window.removeEventListener('resize', positionTour)
  window.removeEventListener('scroll', positionTour)
})

defineExpose({ restart })
</script>

<template>
  <dialog ref="dialog" class="onboarding" data-testid="onboarding"
    aria-labelledby="onboarding-title" aria-describedby="onboarding-description"
    @cancel.prevent="dismiss" @keydown="keepTabInDialog" @wheel.self.prevent>
    <div v-if="step && spotlight" class="spotlight" :style="spotlight"
      data-testid="onboarding-spotlight" :data-zone="step.zone" aria-hidden="true"></div>
    <div v-else class="onboarding-shade" aria-hidden="true"></div>
    <section ref="card" class="onboarding-card" :class="{ 'onboarding-welcome': !step }"
      :style="step ? cardPosition : undefined" data-testid="onboarding-card">
      <p v-if="step" class="onboarding-progress">{{ stepIndex + 1 }} из {{ steps.length }}</p>
      <h2 id="onboarding-title">
        {{ step?.title ?? 'Добро пожаловать в симулятор крана' }}
      </h2>
      <p id="onboarding-description">
        {{ step?.description ?? 'Узнайте, как управлять сценой и механизмами' }}
      </p>
      <div v-if="step" class="onboarding-actions">
        <button v-if="stepIndex > 0" class="secondary" type="button" @click="stepIndex--">Назад</button>
        <button class="secondary onboarding-skip" type="button" @click="dismiss">Пропустить</button>
        <button v-if="stepIndex < steps.length - 1" class="demo onboarding-next" type="button" @click="stepIndex++">Далее</button>
        <button v-else class="demo" type="button" @click="dismiss">Завершить</button>
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
  touch-action: none;
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
  width: min(clamp(316px, 23vw, 370px), calc(100% - 24px));
  max-height: calc(100% - 24px);
  padding: 16px;
  border: 1px solid #616970;
  border-radius: 11px;
  overflow: auto;
  overscroll-behavior: contain;
  background: #272c30;
  box-shadow: 0 14px 36px #080b107a;
}
.onboarding-welcome {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(440px, calc(100% - 24px));
  padding: clamp(18px, 3vw, 26px);
  text-align: center;
}
.onboarding-card h2 { font-size: 22px; }
.onboarding-welcome h2 { font-size: clamp(22px, 2.2vw, 27px); }
.onboarding-card p { margin: 8px 0 14px; color: #e1e5e9; line-height: 1.42; }
.onboarding-card .onboarding-progress { margin: 0 0 6px; color: #ffbd59; font-size: 14px; font-weight: 650; }
.onboarding-actions { display: flex; flex-wrap: wrap; gap: 7px; }
.onboarding-welcome .onboarding-actions { justify-content: center; }
.onboarding-actions button { padding-inline: 8px; font-size: 14px; }
.onboarding-skip, .onboarding-next { inline-size: 7.2em; }
.onboarding-skip { margin-right: auto; }
.onboarding:focus-visible, .onboarding-actions button:focus-visible { outline: none; }
@media (prefers-reduced-motion: reduce) {
  .onboarding { transition: none; }
}
</style>
