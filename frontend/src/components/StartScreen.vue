<template>
  <section class="card start-card">
    <div class="hero-icon">🎯</div>
    <div class="eyebrow">YEAR 9</div>
    <h2>Ready to begin?</h2>
    <p>Enter the student's name. A full 230-question Year 9 practice test will run in four fixed sections: 60 Quantitative/Numerical, 60 Mathematics, 55 Reading, then 55 Verbal.</p>
    <label class="name-field">
      Student name
      <input :value="studentName" type="text" autocomplete="name" placeholder="Enter student name"
        @input="$emit('update:studentName', $event.target.value)" @keyup.enter="$emit('start')" />
    </label>
    <div class="year-badge">YEAR 9 ONLY</div>
    <button class="primary-btn" type="button" :disabled="loading" @click="$emit('start')">
      {{ loading ? "Generating test…" : "Start Test" }}
    </button>
    <p v-if="error" class="start-error">{{ error }}</p>
    <div class="timer-note">⏱ Block 1: 60 minutes · Block 2: 55 minutes · 230 questions total · You may skip and revisit questions.</div>
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