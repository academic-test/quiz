<template>
  <article class="card question-card">
    <div class="question-head">
      <span class="tag">{{ sectionLabel }}</span>
      <span class="difficulty">{{ question.difficulty }}</span>
    </div>

    <div v-if="question.passage" class="stimulus-panel">
      <div class="stimulus-label">{{ question.stimulus_group ? `Stimulus · ${question.stimulus_group}` : "Stimulus" }}</div>
      <div class="passage">{{ question.passage }}</div>
    </div>
    <div class="question-text">{{ question.q }}</div>

    <div v-if="previousFeedback" class="feedback" :class="previousFeedback.correct ? 'good' : 'bad'">
      <strong>Previous answer: {{ previousFeedback.correct ? "Correct" : "Not quite" }}</strong>
      <span> Correct answer: {{ String.fromCharCode(65 + Number(previousFeedback.correctAnswer)) }}.</span>
      <div>{{ previousFeedback.explanation }}</div>
    </div>

    <div class="options">
      <button
        v-for="(option, index) in question.o"
        :key="index"
        class="option"
        :class="{
          selected: selected === index,
          correct: feedback && index === feedback.correctAnswer,
          incorrect: feedback && selected === index && index !== feedback.correctAnswer
        }"
        :disabled="locked"
        type="button"
        @click="$emit('select', index)"
      >
        <span class="letter">{{ String.fromCharCode(65 + index) }}</span>
        <span>{{ option }}</span>
      </button>
    </div>

    <div v-if="feedback" class="feedback" :class="feedback.correct ? 'good' : 'bad'">
      <strong>{{ feedback.correct ? "Correct!" : "Answer recorded." }}</strong>
      <span> Correct answer: {{ String.fromCharCode(65 + Number(feedback.correctAnswer)) }}.</span>
      <div>{{ feedback.explanation }}</div>
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
        :disabled="saving || locked || selected !== null && selected !== undefined"
        @click="$emit('skip')"
      >
        Skip
      </button>

      <button
        v-if="!isLastInBlock"
        class="secondary-btn"
        :disabled="(!feedback && (selected === null || selected === undefined)) || waitingForQuestions || saving"
        @click="$emit('next')"
      >
        {{ feedback ? "Next Question →" : "Save Answer & Review →" }}
      </button>

      <button
        v-else
        class="primary-btn"
        :disabled="(!feedback && (selected === null || selected === undefined)) || waitingForQuestions || saving || (feedback && !sectionComplete)"
        @click="$emit('submit')"
      >
        {{ feedback ? (isLast ? "Submit Test →" : "Submit Section & Continue →") : "Save Answer & Review →" }}
      </button>
    </div>

    <div class="question-state">
      <span v-if="feedback">Response locked — this answer cannot be changed.</span>
      <span v-else-if="isLastInBlock && !sectionComplete">
        Answer all {{ unansweredCount }} remaining question{{ unansweredCount === 1 ? "" : "s" }} before submitting this section.
      </span>
      <span v-else-if="selected !== null && selected !== undefined">Answer selected — press Next Question to record your response.</span>
      <span v-else>Not answered yet. Use Skip to come back later.</span>
    </div>
  </article>
</template>

<script setup>
defineProps({
  question: { type: Object, required: true },
  sectionLabel: { type: String, required: true },
  selected: { type: Number, default: null },
  locked: { type: Boolean, default: false },
  feedback: { type: Object, default: null },
  previousFeedback: { type: Object, default: null },
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
