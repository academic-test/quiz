<template>
  <section class="card start-card">
    <div class="hero-icon">🎯</div>
    <div class="eyebrow">ACER LEVEL 2</div>
    <h2>Year 10 Entry Practice</h2>
    <p>Enter the student's name. This original practice assessment follows the structure of the supplied ACER Years 9–10 booklet: two Written Expression tasks, Humanities, and Mathematics & Science.</p>

    <label class="name-field">
      Student name
      <input
        :value="studentName"
        type="text"
        autocomplete="name"
        placeholder="Enter student name"
        @input="$emit('update:studentName', $event.target.value)"
        @keyup.enter="$emit('start')"
      />
    </label>

    <div class="year-badge">YEAR 10 ENTRY · LEVEL 2</div>
    <button class="primary-btn" type="button" :disabled="loading" @click="$emit('start')">
      {{ loading ? "Generating assessment…" : "Start Assessment" }}
    </button>

    <p v-if="error" class="start-error">{{ error }}</p>
    <div class="timer-note">⏱ Test 1: 25 min · Test 2: 40 min · Test 3: 40 min · Test 4: 25 min · No calculator.</div>
  </section>
</template>

<script setup>
defineProps({
  studentName: { type: String, default: "" },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" }
});
defineEmits(["update:studentName", "start"]);
</script>
