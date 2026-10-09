<template>
  <section class="card start-card">
    <div class="hero-icon">🎯</div>
    <div class="eyebrow">LEVEL 2</div>
    <h2>Year 10 Entry Practice</h2>
    <p>Enter the student's name to start. You can then choose either Humanities or Mathematics & Science to practise.</p>

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
    <p class="assessment-note">Original scholarship-style practice · Choose Humanities or Mathematics & Science after starting</p>
    <button class="primary-btn" type="button" :disabled="loading" @click="$emit('start')">
      {{ loading ? "Generating assessment…" : "Start Assessment" }}
    </button>

    <p v-if="error" class="start-error">{{ error }}</p>
    <div class="timer-note">⏱ Humanities: 40 min · Mathematics & Science: 40 min</div>
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
