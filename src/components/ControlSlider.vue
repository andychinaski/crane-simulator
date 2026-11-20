<script setup lang="ts">
import { computed } from 'vue'
import { formatValue, type ControlDefinition } from '../state/controls'

const props = defineProps<{ control: ControlDefinition; value: number; limit?: number; disabled?: boolean; continuous?: boolean }>()
const emit = defineEmits<{ change: [value: number] }>()
const valueText = computed(() => formatValue(props.control,
  props.limit === undefined && !props.continuous ? props.value : Number(props.value.toFixed(2))))
const fill = computed(() => 100 * (props.value - props.control.min) / (props.control.max - props.control.min))

function atStep(tick: number) {
  return Number((props.control.min + tick * props.control.step).toFixed(8))
}

function setInput(input: HTMLInputElement, value: number) {
  input.value = String(value)
  emit('change', input.valueAsNumber)
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const value = Math.min(input.valueAsNumber, props.limit ?? props.control.max)
  if (props.limit === undefined) {
    emit('change', value)
    return
  }
  // Keep the configured increments and also allow the exact physical endpoint.
  const tick = Math.round((value - props.control.min) / props.control.step)
  const regular = Math.min(atStep(tick), props.limit)
  setInput(input, props.limit - value < Math.abs(regular - value) ? props.limit : regular)
}

function onKey(event: KeyboardEvent) {
  if (props.limit === undefined) return
  const forward = event.key === 'ArrowRight' || event.key === 'ArrowUp'
  if (!forward && event.key !== 'ArrowLeft' && event.key !== 'ArrowDown') return
  event.preventDefault()
  const input = event.target as HTMLInputElement
  const position = (input.valueAsNumber - props.control.min) / props.control.step
  const tick = forward ? Math.floor(position + 1e-8) + 1 : Math.ceil(position - 1e-8) - 1
  setInput(input, Math.max(props.control.min, Math.min(props.limit, atStep(tick))))
}
</script>

<template>
  <div class="control">
    <div class="control-label">
      <label :for="control.id">{{ control.label }}</label>
      <output :for="control.id" aria-live="off">{{ valueText }}</output>
    </div>
    <input
      :id="control.id"
      type="range"
      :min="control.min"
      :max="control.max"
      :step="limit === undefined && !continuous ? control.step : 'any'"
      :value="value"
      :style="{ '--fill': fill + '%' }"
      :aria-valuemax="limit"
      :aria-valuetext="valueText"
      :disabled="disabled"
      @input="onInput"
      @keydown="onKey"
    />
  </div>
</template>
