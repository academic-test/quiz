<template>
  <article class="card question-card">
    <div class="question-head">
      <span class="tag">{{ sectionLabel }}</span>
      <span class="difficulty">{{ question.difficulty }}</span>
    </div>

    <div v-if="question.passage" class="passage">{{ question.passage }}</div>
    <div class="question-text">{{ question.q }}</div>

    <div class="options">
      <button
        v-for="(option, index) in question.o"
        :key="index"
        class="option"
        :class="{ selected: selected === index }"
        type="button"
        @click="$emit('select', index)"
      >
        <span class="letter">{{ String.fromCharCode(65 + index) }}</span>
        <span>{{ option }}</span>
      </button>
    </div>

    <div class="action-row navigation-row">
      <button
        class="ghost-btn"
        type="button"
        :disabled="isFirst || saving"
        @click="$emit('previous')"
      >
        ← Previous
      </button>

      <button
        class="secondary-btn skip-btn"
        type="button"
        :disabled="saving || selected !== null && selected !== undefined"
        @click="$emit('skip')"
      >
        Skip
      </button>

      <button
        v-if="!isLastInBlock"
        class="secondary-btn"
        type="button"
        :disabled="selected === null || selected === undefined || waitingForQuestions || saving"
        @click="$emit('next')"
      >
        {{ waitingForQuestions ? "Preparing…" : "Next →" }}
      </button>

      <button
        v-else
        class="primary-btn"
        type="button"
        :disabled="!sectionComplete || waitingForQuestions || saving"
        @click="$emit('submit')"
      >
        {{ isLast ? "Submit Test" : "Submit Section & Continue →" }}
      </button>
    </div>

    <div class="question-state">
      <span v-if="isLastInBlock && !sectionComplete">
        Answer all {{ unansweredCount }} remaining question{{ unansweredCount === 1 ? "" : "s" }} before submitting this section.
      </span>
      <span v-else-if="selected !== null && selected !== undefined">Answer selected — you can change it before moving on.</span>
      <span v-else>Not answered yet. Use Skip to come back later.</span>
    </div>
  </article>
</template>

<script setup>
defineProps({
  question: { type: Object, required: true },
  sectionLabel: { type: String, required: true },
  selected: { type: Number, default: null },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  isLastInBlock: { type: Boolean, default: false },
  waitingForQuestions: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  sectionComplete: { type: Boolean, default: false },
  unansweredCount: { type: Number, default: 0 }
});

defineEmits(["select", "next", "skip", "previous", "submit"]);
</script>
