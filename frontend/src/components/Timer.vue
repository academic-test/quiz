<template>
  <div class="timer-wrap" :class="{ warning: remaining <= 300 && remaining > 60, danger: remaining <= 60 }">
    <span>TIME LEFT</span><strong>{{ minutes }}:{{ seconds }}</strong>
  </div>
</template>
<script setup>
import { computed } from "vue";
const props = defineProps({
  remaining: { type: Number, required: true },
  label: { type: String, default: "" }
});
const minutes = computed(() => Math.floor(Math.max(0, props.remaining) / 60).toString().padStart(2, "0"));
const seconds = computed(() => Math.floor(Math.max(0, props.remaining) % 60).toString().padStart(2, "0"));
</script>