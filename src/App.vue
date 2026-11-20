<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import ControlSlider from './components/ControlSlider.vue'
import OnboardingTour from './components/OnboardingTour.vue'
import {
  cameraControls, controlDefinition, craneControls, formatValue, initialValues, type CraneControl,
} from './state/controls'
import type { CargoHint, CargoState } from './simulation/CargoController'
import type { DemoPhase } from './simulation/DemoSequence'
import { mountScene, type ScenarioSnapshot } from './simulation/Simulator'
import {
  evaluateStep, guideInstruction, guideSteps, guideValue, guidedByDefault, matchesGuideValue, restoreValue,
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
const modeButton = ref<HTMLButtonElement>()
const guided = ref(guidedByDefault)
const pendingAction = ref<Mode | 'reset'>()
const stepIndex = ref(0)
const wasComplete = ref(false)
const guideFinished = ref(false)
const step = computed(() => mode.value === 'guided' && !guideFinished.value ? guideSteps[stepIndex.value] : undefined)
const progress = computed(() => step.value && snapshot.value && !unavailable.value
  ? evaluateStep(stepIndex.value, snapshot.value) : undefined)
const guideFeedback = computed(() => {
  if (progress.value?.complete) return '✓ Выполнено'
  if (progress.value?.issue) return progress.value.issue
  if (wasComplete.value && step.value && snapshot.value && !matchesGuideValue(step.value, snapshot.value)) {
    return restoreValue(step.value, snapshot.value)
  }
  return 'Выполняется'
})
watch(() => progress.value?.complete, complete => {
  if (complete) wasComplete.value = true
})

function changeCrane(id: CraneControl, value: number) {
  if (simulator.value) craneTarget.value[id] = simulator.value.setCraneTarget(id, value)
}

function restartOnboarding() {
  help.value?.close()
  onboarding.value?.restart()
}

function dismissOnboarding() {
  if (!mode.value) openModeSelection()
  else helpButton.value?.focus({ preventScroll: true })
}

function openModeSelection() {
  guided.value = guidedByDefault
  scenarioDialog.value?.showModal()
}

function cancelScenarioDialog() {
  if (pendingAction.value && pendingAction.value !== 'reset') {
    pendingAction.value = undefined
    nextTick(() => modeTitle.value?.focus())
  } else if (mode.value) {
    pendingAction.value = undefined
    scenarioDialog.value?.close()
  }
}

function requestScenario(action: Mode | 'reset') {
  if (!simulator.value?.scenarioChanged) {
    applyScenario(action)
    return
  }
  pendingAction.value = action
  if (!scenarioDialog.value?.open) scenarioDialog.value?.showModal()
  nextTick(() => scenarioDialog.value?.querySelector('button')?.focus())
}

function applyScenario(action: Mode | 'reset') {
  const nextMode = action === 'reset' ? mode.value : action
  if (!nextMode) return
  const wasOpen = scenarioDialog.value?.open
  scenarioDialog.value?.close()
  pendingAction.value = undefined
  mode.value = nextMode
  stepIndex.value = 0
  wasComplete.value = false
  guideFinished.value = false
  if (nextMode === 'demo') {
    simulator.value?.stopDemo()
    simulator.value?.startDemo()
  } else {
    simulator.value?.resetScenario()
  }
  if (nextMode === 'guided') focusGuideControl()
  else if (wasOpen) nextTick(() => modeButton.value?.focus({ preventScroll: true }))
}

function stopDemo() {
  simulator.value?.stopDemo()
  mode.value = 'free'
  nextTick(() => modeButton.value?.focus({ preventScroll: true }))
}

function focusGuideControl() {
  nextTick(() => {
    if (!step.value) return
    const control = document.getElementById(step.value.controlId)
    control?.focus({ preventScroll: true })
    control?.scrollIntoView({ block: 'nearest' })
  })
}

function advanceGuide() {
  if (!progress.value?.complete) return
  wasComplete.value = false
  if (stepIndex.value === guideSteps.length - 1) {
    guideFinished.value = true
    nextTick(() => cranePanel.value?.querySelector<HTMLElement>('.guide-card')?.focus())
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
      onScenarioChange(value) { snapshot.value = value },
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
        <button class="secondary" type="button" :disabled="unavailable || !mode"
          :title="mode === 'demo' ? 'Повторить демонстрацию' : 'Сбросить сценарий'"
          :aria-label="mode === 'demo' ? 'Повторить демонстрацию' : 'Сбросить сценарий'"
          @click="requestScenario('reset')">
          <span aria-hidden="true">↻</span>
        </button>
        <button ref="modeButton" class="secondary" type="button" title="Выбрать режим" aria-label="Выбрать режим"
          @click="openModeSelection">Выбрать режим</button>
      </div>
      <div v-if="sceneError" class="scene-error" role="alert">{{ sceneError }}</div>
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
      <section v-if="step" class="guide-card" aria-labelledby="guide-title">
        <h3 id="guide-title">Шаг {{ stepIndex + 1 }} из {{ guideSteps.length }}</h3>
        <p id="guide-instruction">{{ guideInstruction(step) }}
          <strong>{{ step.target === null ? 'Предел ' : '· ' }}{{ guideValue(step, ropeMaximum) }}</strong>
        </p>
        <p class="guide-feedback" role="status" :data-complete="progress?.complete ?? false">{{ guideFeedback }}</p>
        <div class="guide-actions">
          <button class="secondary" type="button" @click="mode = 'free'">Выйти из подсказок</button>
          <button class="guide-next" type="button" :disabled="!progress?.complete" @click="advanceGuide">Далее</button>
        </div>
      </section>
      <section v-else-if="mode === 'guided' && guideFinished" class="guide-card" tabindex="-1">
        <h3>✓ Ручной цикл завершён</h3>
        <button class="secondary" type="button" @click="mode = 'free'">Выйти из подсказок</button>
      </section>
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
  <dialog ref="help" aria-labelledby="help-title">
    <h2 id="help-title">Справка</h2>
    <p>Задайте позу ползунками справа. «Скорость движений» меняет темп. Пустой захват останавливается над крышкой ящика или у пола. Чтобы пройти над ящиком сбоку, сначала поднимите захват. Предел троса отображается под регуляторами.</p>
    <p>«Горизонталь» и «Вертикаль» смещают камеру вдоль кадра. «Масштаб» приближает или отдаляет сцену, «Обход сцены» поворачивает камеру. Левой кнопкой мыши вращайте вид, правой смещайте, колесом меняйте масштаб. «Сбросить вид» возвращает исходный ракурс.</p>
    <p>Подведите открытый захват к ручке ящика. При подсказке «Готов к захвату» закройте лепестки. Поднимите ящик, перенесите к бирюзовой площадке и опустите на пол. Затем откройте захват. Засчитывается укладка, при которой ящик целиком внутри контура.</p>
    <p>Откройте «Выбрать режим» над сценой, чтобы запустить демонстрацию или ручной перенос. Камерой можно управлять весь цикл. «Стоп» сохраняет текущую позу и возвращает ручное управление. Круговая стрелка сбрасывает сценарий или повторяет демонстрацию.</p>
    <form method="dialog" class="help-actions">
      <button class="secondary" type="button" @click="restartOnboarding">Пройти обучение ещё раз</button>
      <button class="secondary" autofocus>Закрыть</button>
    </form>
  </dialog>
  <dialog ref="scenarioDialog" class="scenario-dialog" aria-labelledby="mode-title" @cancel.prevent="cancelScenarioDialog">
    <template v-if="pendingAction">
      <h2 id="mode-title">Сбросить текущий сценарий?</h2>
      <p>Кран и ящик вернутся в исходное положение. Камера и скорость сохранятся.</p>
      <div class="mode-actions">
        <button class="secondary" type="button" @click="cancelScenarioDialog">Отмена</button>
        <button class="demo" type="button" @click="applyScenario(pendingAction)">Сбросить и продолжить</button>
      </div>
    </template>
    <template v-else>
      <h2 id="mode-title" ref="modeTitle" tabindex="-1">Выбрать режим</h2>
      <div class="mode-actions">
        <button class="demo" type="button" :disabled="unavailable" @click="requestScenario('demo')">Демонстрация</button>
        <div class="manual-option">
          <button class="secondary" type="button" @click="requestScenario(guided ? 'guided' : 'free')">Попробовать вручную</button>
          <label><input v-model="guided" type="checkbox"> С подсказками</label>
        </div>
      </div>
      <button v-if="mode" class="secondary mode-cancel" type="button" @click="cancelScenarioDialog">Отмена</button>
    </template>
  </dialog>
  <OnboardingTour ref="onboarding" :camera="cameraPanel" :scene="viewport" :crane="cranePanel"
    @dismiss="dismissOnboarding" />
</template>
