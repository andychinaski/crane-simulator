<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import ControlSlider from './components/ControlSlider.vue'
import OnboardingTour from './components/OnboardingTour.vue'
import { useSceneDialogPosition } from './components/useSceneDialogPosition'
import {
  cameraControls, controlDefinition, craneControls, formatValue, initialValues, type CraneControl,
} from './state/controls'
import type { CargoHint, CargoState } from './simulation/CargoController'
import type { DemoPhase } from './simulation/DemoSequence'
import { mountScene, type ScenarioSnapshot } from './simulation/Simulator'
import {
  evaluateStep, guideInstruction, guideSteps, guideValue, guidedByDefault,
} from './state/guidedRoute'

type Mode = 'demo' | 'guided' | 'free'

const viewport = ref<HTMLElement>()
const cameraPanel = ref<HTMLElement>()
const cranePanel = ref<HTMLElement>()
const help = ref<HTMLDialogElement>()
const helpButton = ref<HTMLButtonElement>()
const onboarding = ref<InstanceType<typeof OnboardingTour>>()
const sceneError = ref('')
const simulator = shallowRef<ReturnType<typeof mountScene>>()
const craneTarget = ref(initialValues(craneControls))
const cameraValues = ref(initialValues(cameraControls))
const ropeControl = controlDefinition('ropeLength')
const snapshot = shallowRef<ScenarioSnapshot>()
const settledSnapshot = shallowRef<ScenarioSnapshot>()
const moving = computed(() => snapshot.value?.moving ?? false)
const ropeMaximum = computed(() => snapshot.value?.ropeMaximum ?? ropeControl.max)
const ropeContact = computed(() => snapshot.value?.contact)
const cargoState = computed(() => snapshot.value?.cargoState ?? 'GROUND')
const cargoHint = computed(() => snapshot.value?.cargoHint)
const demoPhase = ref<DemoPhase>('idle')
const demoRunning = ref(false)
const demoPausing = ref(false)
const demoLabels: Record<Exclude<DemoPhase, 'idle'>, string> = {
  reset: 'Демонстрация · Сценарий сброшен',
  approach: 'Демонстрация · Подвод захвата',
  close: 'Демонстрация · Захват ящика',
  lift: 'Демонстрация · Подъём',
  transfer: 'Демонстрация · Перенос',
  lower: 'Демонстрация · Опускание',
  release: 'Демонстрация · Укладка',
  retreat: 'Демонстрация · Подъём захвата',
  complete: 'Демонстрация завершена',
  stopped: 'Демонстрация остановлена',
  failed: 'Цикл прерван · Проверьте положение',
}
const demoPauseLabels: Partial<Record<DemoPhase, string>> = {
  approach: 'Захват подведён',
  close: 'Ящик захвачен',
  lift: 'Ящик поднят',
  transfer: 'Ящик над площадкой',
  lower: 'Ящик опущен',
  release: 'Ящик освобождён',
}
const cargoLabels: Record<CargoState, string> = {
  GROUND: 'Свободен',
  ATTACHED: 'Захвачен',
  PLACED: 'На площадке',
}
const cargoHints: Record<NonNullable<CargoHint>, string> = {
  ready: 'Готов к захвату',
  position: 'Подведите захват над ручкой ящика',
  height: 'Совместите захват с ручкой по высоте',
  angle: 'Поверните захват вдоль ручки',
  pickup: 'Укоротите трос, чтобы поднять ящик',
  airborne: 'Сначала опустите ящик на пол',
  landed: 'Можно открыть захват',
  outside: 'Ящик поставлен вне площадки',
}
const status = computed(() => {
  if (demoPhase.value !== 'idle') {
    const completed = demoPausing.value && demoPauseLabels[demoPhase.value]
    return completed ? `Демонстрация · ${completed}` : demoLabels[demoPhase.value]
  }
  if (ropeContact.value === 'side') return 'Поднимите захват над ящиком'
  if (ropeContact.value) {
    const support = ropeContact.value === 'lid' ? 'Крышка ящика' : 'Предел пола'
    return `${support} · трос ${formatValue(ropeControl, Number(ropeMaximum.value.toFixed(2)))}`
  }
  return moving.value ? 'Кран движется' : 'Ручное управление'
})
const unavailable = computed(() => !simulator.value || !!sceneError.value)
const mode = ref<Mode>()
const scenarioDialog = ref<HTMLDialogElement>()
const modeTitle = ref<HTMLElement>()
const resetButton = ref<HTMLButtonElement>()
const { position: scenarioPosition, update: positionScenario } =
  useSceneDialogPosition(() => viewport.value, () => scenarioDialog.value)
const guided = ref(guidedByDefault)
const confirmingReset = ref(false)
const confirmingGuideExit = ref(false)
const offeringManual = ref(false)
let manualOfferPending = false
let replayingOnboarding = false
const stepIndex = ref(0)
const wasComplete = ref(false)
const guideFinished = ref(false)
const guideCard = ref<HTMLElement>()
const step = computed(() => mode.value === 'guided' && !guideFinished.value ? guideSteps[stepIndex.value] : undefined)
const progress = computed(() => step.value && settledSnapshot.value && !unavailable.value
  ? evaluateStep(stepIndex.value, settledSnapshot.value) : undefined)
const canAdvance = computed(() => progress.value?.complete === true && !moving.value)
const guideState = computed(() => {
  if (progress.value?.complete) return 'COMPLETED'
  if (wasComplete.value || progress.value?.invariantBroken) return 'REGRESSED'
  return 'ACTIVE'
})
watch([step, () => progress.value?.complete], ([, complete]) => {
  if (complete) wasComplete.value = true
})
watch(demoPhase, phase => {
  manualOfferPending = phase === 'complete' && mode.value === 'demo' && cargoState.value === 'PLACED'
  showManualOffer()
})

function changeCrane(id: CraneControl, value: number) {
  if (simulator.value) craneTarget.value[id] = simulator.value.setCraneTarget(id, value)
}

function restartOnboarding() {
  replayingOnboarding = true
  help.value?.close()
  onboarding.value?.restart()
}

function dismissOnboarding() {
  replayingOnboarding = false
  if (!mode.value) openModeSelection()
  else {
    helpButton.value?.focus({ preventScroll: true })
    showManualOffer()
  }
}

function openModeSelection() {
  guided.value = guidedByDefault
  if (!scenarioDialog.value?.open) scenarioDialog.value?.showModal()
  nextTick(() => {
    positionScenario()
    modeTitle.value?.focus({ preventScroll: true })
  })
}

function cancelScenarioDialog() {
  if (confirmingGuideExit.value) {
    confirmingGuideExit.value = false
    scenarioDialog.value?.close()
    return
  }
  if (!confirmingReset.value && !offeringManual.value) return
  confirmingReset.value = false
  offeringManual.value = false
  scenarioDialog.value?.close()
  resetButton.value?.focus({ preventScroll: true })
}

async function requestGuideExit() {
  if (mode.value !== 'guided' || scenarioDialog.value?.open || confirmingGuideExit.value) return
  confirmingGuideExit.value = true
  await nextTick()
  scenarioDialog.value?.showModal()
  positionScenario()
  scenarioDialog.value?.querySelector('button')?.focus({ preventScroll: true })
}

function confirmGuideExit() {
  if (!confirmingGuideExit.value) return
  cancelScenarioDialog()
  leaveGuide()
}

function leaveGuide() {
  mode.value = 'free'
  resetButton.value?.focus({ preventScroll: true })
}

async function requestReset() {
  if (!mode.value || scenarioDialog.value?.open || confirmingReset.value) return
  confirmingReset.value = true
  await nextTick()
  scenarioDialog.value?.showModal()
  positionScenario()
  scenarioDialog.value?.querySelector('button')?.focus({ preventScroll: true })
}

function resetScenario() {
  simulator.value?.resetScenario()
  mode.value = undefined
  stepIndex.value = 0
  wasComplete.value = false
  guideFinished.value = false
}

function confirmReset() {
  if (!confirmingReset.value) return
  resetScenario()
  confirmingReset.value = false
  openModeSelection()
}

async function showManualOffer() {
  if (!manualOfferPending || help.value?.open || scenarioDialog.value?.open ||
    confirmingReset.value || replayingOnboarding) return
  manualOfferPending = false
  guided.value = guidedByDefault
  offeringManual.value = true
  await nextTick()
  scenarioDialog.value?.showModal()
  positionScenario()
  modeTitle.value?.focus({ preventScroll: true })
}

function tryManualAfterDemo() {
  if (!offeringManual.value || unavailable.value) return
  offeringManual.value = false
  resetScenario()
  selectMode(guided.value ? 'guided' : 'free')
}

function selectMode(nextMode: Mode) {
  if (mode.value || confirmingReset.value) return
  mode.value = nextMode
  scenarioDialog.value?.close()
  if (nextMode === 'demo') simulator.value?.startDemo()
  if (nextMode === 'guided') focusGuideControl()
  else nextTick(() => resetButton.value?.focus({ preventScroll: true }))
}

function restartGuide() {
  if (mode.value !== 'guided' || !guideFinished.value || unavailable.value) return
  resetScenario()
  selectMode('guided')
}

function stopDemo() {
  simulator.value?.stopDemo()
  mode.value = 'free'
  nextTick(() => resetButton.value?.focus({ preventScroll: true }))
}

function focusGuideControl() {
  nextTick(() => {
    if (!step.value) return
    if (cranePanel.value && viewport.value &&
      cranePanel.value.getBoundingClientRect().top >= viewport.value.getBoundingClientRect().bottom) {
      guideCard.value?.focus()
      return
    }
    const control = document.getElementById(step.value.controlId)
    control?.focus({ preventScroll: true })
    control?.scrollIntoView({ block: 'nearest' })
  })
}

function advanceGuide() {
  if (!canAdvance.value) return
  wasComplete.value = false
  if (stepIndex.value === guideSteps.length - 1) {
    guideFinished.value = true
    nextTick(() => guideCard.value?.focus())
  } else {
    stepIndex.value++
    focusGuideControl()
  }
}

onMounted(() => {
  if (!viewport.value) return
  try {
    simulator.value = mountScene(viewport.value, {
      onContextChange(lost) {
        sceneError.value = lost ? 'Связь с WebGL потеряна. Перезагрузите страницу, если сцена не восстановится.' : ''
      },
      onCameraChange(values) {
        for (const control of cameraControls) {
          const value = values[control.id]
          const ticks = Math.round((value - control.min) / control.step)
          cameraValues.value[control.id] = Number((control.min + ticks * control.step).toFixed(8))
        }
      },
      onScenarioChange(value) {
        snapshot.value = value
        // Keep the last evaluated pose while the mechanisms are moving.
        if (!value.moving) settledSnapshot.value = value
      },
      onCraneTargetChange(id, value) { craneTarget.value[id] = value },
      onDemoChange(phase, running, pausing) {
        demoPhase.value = phase
        demoRunning.value = running
        demoPausing.value = pausing
      },
    })
  } catch {
    sceneError.value = 'Не удалось запустить 3D-сцену. Проверьте, что браузер поддерживает WebGL 2 и аппаратное ускорение.'
  }
})
onUnmounted(() => simulator.value?.dispose())
</script>

<template>
  <header class="app-header">
    <h1>Симулятор крана</h1>
    <button ref="helpButton" class="secondary" type="button" @click="help?.showModal()">Справка</button>
  </header>
  <main class="workspace">
    <section ref="viewport" class="viewport panel" aria-label="Трёхмерная сцена">
      <div class="scene-actions" role="group" aria-label="Действия сценария">
        <button v-if="demoRunning" class="stop" type="button" title="Стоп" aria-label="Стоп"
          @click="stopDemo">Стоп</button>
        <button ref="resetButton" class="secondary" type="button" :disabled="unavailable || !mode"
          title="Сбросить сценарий" aria-label="Сбросить сценарий" @click="requestReset">
          <span aria-hidden="true">↻</span>
        </button>
      </div>
      <div v-if="sceneError" class="scene-error" role="alert">{{ sceneError }}</div>
      <section v-if="step" ref="guideCard" class="guide-card" :data-guide-state="guideState"
        aria-labelledby="guide-title" tabindex="-1">
        <div class="guide-step-content">
          <h3 id="guide-title">Шаг {{ stepIndex + 1 }} из {{ guideSteps.length }}</h3>
          <p id="guide-instruction">{{ guideInstruction(step) }}
            <strong v-if="step.target !== undefined">
              {{ step.target === null ? 'Предел ' : '· ' }}{{ guideValue(step, ropeMaximum) }}
            </strong>
          </p>
        </div>
        <div class="guide-actions">
          <button type="button" @click="requestGuideExit">Завершить</button>
          <button type="button" :disabled="!canAdvance" @click="advanceGuide">Далее</button>
        </div>
      </section>
      <section v-else-if="mode === 'guided' && guideFinished" ref="guideCard" class="guide-card guide-result"
        data-guide-state="COMPLETED" aria-labelledby="guide-end-title" tabindex="-1">
        <h3 id="guide-end-title">Вы успешно доставили груз</h3>
        <div class="guide-actions">
          <button type="button" :disabled="unavailable" @click="restartGuide">Попробовать снова</button>
          <button type="button" @click="leaveGuide">Осмотреть сцену</button>
        </div>
      </section>
    </section>
    <aside ref="cranePanel" class="crane-panel panel" aria-labelledby="crane-title">
      <h2 id="crane-title">Управление краном</h2>
      <div class="crane-sliders">
        <ControlSlider
          v-for="control in craneControls" :key="control.id" :control="control"
          :value="craneTarget[control.id]" :limit="control.id === 'ropeLength' ? ropeMaximum : undefined"
          :class="{ 'guide-control': step?.controlId === control.id }"
          :described-by="step?.controlId === control.id ? 'guide-instruction' : undefined"
          :disabled="unavailable || demoRunning" :continuous="demoRunning" @change="changeCrane(control.id, $event)"
        />
      </div>
      <div v-if="!sceneError" class="scenario-status">
        <div class="cargo-status" role="status">
          <strong id="cargo-status" :data-state="cargoState">{{ cargoLabels[cargoState] }}</strong>
          <span v-if="cargoHint" id="cargo-hint" :data-hint="cargoHint">{{ cargoHints[cargoHint] }}</span>
        </div>
        <p id="stage-status" class="stage-status" role="status" :data-moving="moving"
          :data-demo="demoPhase" :data-demo-paused="demoPausing">{{ status }}</p>
      </div>
    </aside>
    <section ref="cameraPanel" class="camera-panel panel" aria-labelledby="camera-title">
      <h2 id="camera-title">Камера</h2>
      <ControlSlider
        v-for="control in cameraControls" :key="control.id" :control="control"
        :value="cameraValues[control.id]" :disabled="unavailable" @change="simulator?.setCamera(control.id, $event)"
      />
      <button class="secondary" type="button" :disabled="unavailable" @click="simulator?.resetCamera()">Сбросить вид</button>
    </section>
  </main>
  <dialog ref="help" aria-labelledby="help-title" @close="showManualOffer">
    <h2 id="help-title">Справка</h2>
    <p>Задайте позу ползунками справа. «Скорость движений» меняет темп. Пустой захват останавливается над крышкой ящика или у пола. Чтобы пройти над ящиком сбоку, сначала поднимите захват. Предел троса отображается под регуляторами.</p>
    <p>«Горизонталь» и «Вертикаль» смещают камеру вдоль кадра. «Масштаб» приближает или отдаляет сцену, «Обход сцены» поворачивает камеру. Левой кнопкой мыши вращайте вид, правой смещайте, колесом меняйте масштаб. «Сбросить вид» возвращает исходный ракурс.</p>
    <p>Подведите открытый захват к ручке ящика. При подсказке «Готов к захвату» закройте лепестки. Поднимите ящик, перенесите к бирюзовой площадке и опустите на пол. Затем откройте захват. Засчитывается укладка, при которой ящик целиком внутри контура.</p>
    <p>Чтобы выбрать режим заново, нажмите круговую стрелку над сценой и подтвердите сброс сценария. Камерой можно управлять весь цикл. «Стоп» сохраняет текущую позу и возвращает ручное управление.</p>
    <form method="dialog" class="help-actions">
      <button class="secondary" type="button" @click="restartOnboarding">Пройти обучение ещё раз</button>
      <button class="secondary" autofocus>Закрыть</button>
    </form>
  </dialog>
  <dialog ref="scenarioDialog" class="scenario-dialog" :style="scenarioPosition"
    aria-labelledby="mode-title" @cancel.prevent="cancelScenarioDialog" @close="showManualOffer">
    <template v-if="confirmingReset">
      <h2 id="mode-title">Сбросить текущий сценарий?</h2>
      <p>Кран и ящик вернутся в исходное положение. Камера и скорость сохранятся.</p>
      <div class="mode-actions">
        <button class="secondary" type="button" @click="cancelScenarioDialog">Отмена</button>
        <button class="demo" type="button" @click="confirmReset">Сбросить</button>
      </div>
    </template>
    <template v-else-if="confirmingGuideExit">
      <h2 id="mode-title">Завершить подсказки?</h2>
      <p>Вы сможете продолжить управление краном вручную.</p>
      <div class="mode-actions">
        <button class="secondary" type="button" @click="cancelScenarioDialog">Отмена</button>
        <button class="demo" type="button" @click="confirmGuideExit">Завершить</button>
      </div>
    </template>
    <template v-else-if="offeringManual">
      <h2 id="mode-title" ref="modeTitle" tabindex="-1">Демонстрация завершена</h2>
      <p>Попробуйте перенести ящик самостоятельно. Кран и ящик вернутся в исходное положение.</p>
      <div class="mode-actions">
        <button class="secondary" type="button" @click="cancelScenarioDialog">Закрыть</button>
        <div class="manual-option">
          <button class="demo" type="button" :disabled="unavailable"
            @click="tryManualAfterDemo">Попробовать вручную</button>
          <label><input v-model="guided" type="checkbox"> С подсказками</label>
        </div>
      </div>
    </template>
    <template v-else>
      <h2 id="mode-title" ref="modeTitle" tabindex="-1">Выбрать режим</h2>
      <div class="mode-actions">
        <button class="demo" type="button" :disabled="unavailable" @click="selectMode('demo')">Демонстрация</button>
        <div class="manual-option">
          <button class="secondary" type="button" @click="selectMode(guided ? 'guided' : 'free')">Попробовать вручную</button>
          <label><input v-model="guided" type="checkbox"> С подсказками</label>
        </div>
      </div>
    </template>
  </dialog>
  <OnboardingTour ref="onboarding" :camera="cameraPanel" :scene="viewport" :crane="cranePanel"
    @dismiss="dismissOnboarding" />
</template>
