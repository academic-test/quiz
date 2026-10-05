<template>
  <article class="card writing-card">
    <div class="question-head">
      <span class="tag">{{ task.title }}</span>
      <span class="difficulty">25 minutes</span>
    </div>

    <div class="writing-instructions">
      <p><strong>Use the following to develop a piece of writing.</strong></p>
      <p>Your response may be a story, persuasive piece, discussion or personal reflection. Focus on original ideas, organisation and clear, effective language.</p>
      <p class="writing-prompt">{{ task.prompt }}</p>
    </div>

    <textarea
      v-model="localText"
      class="writing-input"
      :disabled="locked || saving"
      rows="18"
      placeholder="Plan your ideas, then write your response here..."
      @input="$emit('update:text', localText)"
    ></textarea>

    <div class="writing-meta">
      <span>{{ wordCount }} words</span>
      <span>Writing responses are saved once you submit this task.</span>
    </div>

    <div class="action-row navigation-row">
      <button
        class="primary-btn"
        type="button"
        :disabled="!localText.trim() || locked || saving"
        @click="$emit('submit')"
      >
        {{ saving ? "Saving…" : isLast ? "Submit Writing & Finish" : "Submit Writing & Continue →" }}
      </button>
    </div>

    <div class="question-state">
      <span v-if="locked">Response submitted and locked.</span>
      <span v-else>Take a couple of minutes to plan before writing.</span>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  task: { type: Object, required: true },
  text: { type: String, default: "" },
  locked: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false }
});

defineEmits(["update:text", "submit"]);

const localText = ref(props.text);
watch(() => props.text, value => {
  if (value !== localText.value) localText.value = value;
});
const wordCount = computed(() => localText.value.trim() ? localText.value.trim().split(/\s+/).length : 0);
</script>
