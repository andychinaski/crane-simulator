<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import ControlSlider from './components/ControlSlider.vue'
import {
  cameraControls, controlDefinition, craneControls, formatValue, initialValues, type CraneControl,
} from './state/controls'
import type { CargoHint, CargoState } from './simulation/CargoController'
import type { DemoPhase } from './simulation/DemoSequence'
import { mountScene, type RopeContact } from './simulation/Simulator'

const viewport = ref<HTMLElement>()
const help = ref<HTMLDialogElement>()
const sceneError = ref('')
const simulator = shallowRef<ReturnType<typeof mountScene>>()
const craneTarget = ref(initialValues(craneControls))
const cameraValues = ref(initialValues(cameraControls))
const moving = ref(false)
const ropeControl = controlDefinition('ropeLength')
const ropeMaximum = ref(ropeControl.max)
const ropeContact = ref<RopeContact>(null)
const cargoState = ref<CargoState>('GROUND')
const cargoHint = ref<CargoHint>(null)
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

function changeCrane(id: CraneControl, value: number) {
  if (simulator.value) craneTarget.value[id] = simulator.value.setCraneTarget(id, value)
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
      onMotionChange(active, maximum, contact) {
        moving.value = active
        ropeMaximum.value = maximum
        ropeContact.value = contact
      },
      onCargoChange(state, hint) {
        cargoState.value = state
        cargoHint.value = hint
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
    <button class="secondary" type="button" @click="help?.showModal()">Справка</button>
  </header>
  <main class="workspace">
    <section ref="viewport" class="viewport panel" aria-label="Трёхмерная сцена">
      <div v-if="!sceneError" class="cargo-status" role="status">
        <strong id="cargo-status" :data-state="cargoState">{{ cargoLabels[cargoState] }}</strong>
        <span v-if="cargoHint" id="cargo-hint" :data-hint="cargoHint">{{ cargoHints[cargoHint] }}</span>
      </div>
      <div v-if="sceneError" class="scene-error" role="alert">{{ sceneError }}</div>
    </section>
    <aside class="crane-panel panel" aria-labelledby="crane-title">
      <h2 id="crane-title">Управление краном</h2>
      <div class="crane-sliders">
        <ControlSlider
          v-for="control in craneControls" :key="control.id" :control="control"
          :value="craneTarget[control.id]" :limit="control.id === 'ropeLength' ? ropeMaximum : undefined"
          :disabled="unavailable || demoRunning" :continuous="demoRunning" @change="changeCrane(control.id, $event)"
        />
      </div>
      <p id="stage-status" class="stage-status" role="status" :data-moving="moving"
        :data-demo="demoPhase" :data-demo-paused="demoPausing">
        {{ status }}
      </p>
      <div class="actions">
        <button class="demo" type="button" :disabled="unavailable || demoRunning" @click="simulator?.startDemo()">
          Демонстрация
        </button>
        <button class="stop" type="button" :disabled="!demoRunning" @click="simulator?.stopDemo()">Стоп</button>
      </div>
    </aside>
    <section class="camera-panel panel" aria-labelledby="camera-title">
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
    <p>«Демонстрация» возвращает кран и ящик в начальное положение и выполняет перенос с выбранной скоростью. Камерой можно управлять весь цикл. «Стоп» сохраняет текущую позу и возвращает ручное управление.</p>
    <form method="dialog"><button class="secondary" autofocus>Закрыть</button></form>
  </dialog>
</template>
