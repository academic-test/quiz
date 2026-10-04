<template>
  <div class="timer-wrap" :class="{ warning: remaining <= 15 && remaining > 5, danger: remaining <= 5 }">
    <span>TIME</span><strong>{{ remaining }}</strong><span>s</span>
  </div>
</template>
<script setup>
defineProps({ remaining: { type: Number, required: true } });
</script>