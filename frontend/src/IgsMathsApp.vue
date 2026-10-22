<template>
<main class="app-shell igs-maths-shell">
  <header class="topbar"><div><div class="eyebrow">IGS PRACTICE · YEAR 8 MATHEMATICS</div><h1>IGS Maths Practice Test</h1><p class="subtitle">40 original questions based on the Year 8 Mathematics Exam Checklist.</p></div><button class="ghost-btn" @click="leaveTest">Back to test selection</button></header>
  <section v-if="finished" class="card start-card"><div class="eyebrow">PRACTICE COMPLETE</div><h2>Test complete</h2><p class="igs-score">{{ score }} / {{ questions.length }} correct ({{ Math.round(score / questions.length * 100) }}%)</p><div class="igs-topic-results"><div v-for="item in topicResults" :key="item.topic" class="igs-topic-result"><strong>{{ item.topic }}</strong><span>{{ item.correct }} / {{ item.total }}</span></div></div><button class="primary-btn" @click="restart">Try again</button></section>
  <section v-else class="quiz-screen">
    <div class="quiz-meta"><div><span>IGS Maths Practice Test</span><strong>Page {{ pageIndex + 1 }} of {{ pageCount }} · Questions {{ pageIndex * pageSize + 1 }}–{{ Math.min((pageIndex + 1) * pageSize, questions.length) }} of {{ questions.length }}</strong></div><div class="assessment-actions"><strong>{{ timeLabel }}</strong></div></div>
    <div class="block-meta"><span>{{ pageQuestions[0]?.topic }}</span><span>{{ pageAnsweredCount }} of {{ pageQuestions.length }} answered</span></div>
    <div class="progress"><div :style="{ width: ((pageIndex + 1) / pageCount * 100) + '%' }"></div></div>
    <article class="card stimulus-card math-science-card">
      <div class="stimulus-head"><div><div class="stimulus-label">Checklist topic</div><div class="stimulus-range">{{ pageQuestions[0]?.topic }}</div></div><span class="stimulus-status">{{ pageAnsweredCount }} / {{ pageQuestions.length }} answered</span></div>
      <div class="stimulus-questions"><section v-for="(question, i) in pageQuestions" :key="pageIndex * pageSize + i" class="stimulus-question">
        <div class="stimulus-question-number">Question {{ pageIndex * pageSize + i + 1 }} <span v-if="answers[pageIndex * pageSize + i] !== undefined">Answer selected</span></div>
        <div class="question-text">{{ question.q }}</div>
        <div class="options"><button v-for="(option, oi) in question.o" :key="oi" class="option" :class="{ selected: answers[pageIndex * pageSize + i] === oi }" :disabled="reviewedPages[pageIndex]" @click="choose(pageIndex * pageSize + i, oi)"><span class="letter">{{ String.fromCharCode(65 + oi) }}</span><span>{{ option }}</span></button></div>
        <div v-if="reviewedPages[pageIndex]" class="stimulus-feedback" :class="{ correct: answers[pageIndex * pageSize + i] === question.a, incorrect: answers[pageIndex * pageSize + i] !== question.a }"><div class="stimulus-feedback-title">{{ answers[pageIndex * pageSize + i] === question.a ? "✓ Correct" : "✕ Incorrect" }}</div><div v-if="answers[pageIndex * pageSize + i] !== question.a" class="stimulus-feedback-answer">Correct answer: <strong>{{ String.fromCharCode(65 + question.a) }} — {{ question.o[question.a] }}</strong></div><div class="stimulus-feedback-explanation"><strong>Worked explanation:</strong> <span>{{ question.e }}</span></div></div>
      </section></div>
      <div class="stimulus-navigation"><button v-if="!reviewedPages[pageIndex]" class="primary-btn review-submit-btn" :disabled="pageAnsweredCount !== pageQuestions.length" @click="reviewPage">Save Answer &amp; Review →</button><template v-else><button class="secondary-btn" :disabled="pageIndex === 0" @click="pageIndex--">← Previous Page</button><button class="primary-btn review-submit-btn" @click="nextPage">{{ pageIndex === pageCount - 1 ? "Finish Practice Test →" : "Next Page →" }}</button></template></div>
      <div class="question-state"><span v-if="reviewedPages[pageIndex]">Answers are saved in this browser and worked explanations are shown. Continue when ready.</span><span v-else>Answer all four questions on this page, then select Save Answer &amp; Review.</span></div>
    </article>
  </section>
</main>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { ref } from "vue";
import { igsMathsQuestions as questions } from "./data/igsMathsQuestions.js";
const key = "igs-year8-maths-practice-v1", pageSize = 4, pageCount = Math.ceil(questions.length / pageSize);
const pageIndex = ref(0), answers = ref({}), reviewedPages = ref({}), finished = ref(false), remaining = ref(2400);
let timer = null;
const pageQuestions = computed(() => questions.slice(pageIndex.value * pageSize, (pageIndex.value + 1) * pageSize));
const pageAnsweredCount = computed(() => pageQuestions.value.filter((q, i) => answers.value[pageIndex.value * pageSize + i] !== undefined).length);
const score = computed(() => questions.reduce((n, q, i) => n + (answers.value[i] === q.a ? 1 : 0), 0));
const topicResults = computed(() => { const d = {}; questions.forEach((q, i) => { d[q.topic] ||= { topic: q.topic, total: 0, correct: 0 }; d[q.topic].total++; if (answers.value[i] === q.a) d[q.topic].correct++; }); return Object.values(d); });
const timeLabel = computed(() => Math.floor(remaining.value / 60) + ":" + String(remaining.value % 60).padStart(2, "0"));
function persist() { try { localStorage.setItem(key, JSON.stringify({ pageIndex: pageIndex.value, answers: answers.value, reviewedPages: reviewedPages.value, finished: finished.value, remaining: remaining.value })); } catch {} }
function choose(i, oi) { if (!reviewedPages.value[pageIndex.value]) answers.value = { ...answers.value, [i]: oi }; }
function reviewPage() { if (pageAnsweredCount.value === pageQuestions.value.length) reviewedPages.value = { ...reviewedPages.value, [pageIndex.value]: true }; }
function nextPage() { if (!reviewedPages.value[pageIndex.value]) return; if (pageIndex.value === pageCount - 1) { finished.value = true; clearInterval(timer); } else pageIndex.value++; persist(); }
function restart() { pageIndex.value = 0; answers.value = {}; reviewedPages.value = {}; finished.value = false; remaining.value = 2400; persist(); startTimer(); }
function leaveTest() { window.location.href = "/"; }
function startTimer() { clearInterval(timer); timer = setInterval(() => { if (remaining.value > 0 && !finished.value) remaining.value--; if (remaining.value <= 0) { finished.value = true; clearInterval(timer); } persist(); }, 1000); }
onMounted(() => { try { const s = JSON.parse(localStorage.getItem(key) || "null"); if (s) { pageIndex.value = Math.max(0, Math.min(pageCount - 1, Number(s.pageIndex) || 0)); answers.value = s.answers || {}; reviewedPages.value = s.reviewedPages || {}; finished.value = Boolean(s.finished); remaining.value = Number.isFinite(s.remaining) ? Math.max(0, s.remaining) : 2400; } } catch {} if (!finished.value && remaining.value > 0) startTimer(); });
onBeforeUnmount(() => clearInterval(timer));
watch([pageIndex, answers, reviewedPages, finished, remaining], persist, { deep: true });
</script>
<style scoped>
.igs-maths-shell{max-width:1100px;margin:0 auto}.igs-score{font-size:1.4rem;font-weight:700}.igs-topic-results{display:grid;gap:10px;margin:24px 0}.igs-topic-result{display:flex;justify-content:space-between;gap:16px;padding:12px 14px;border:1px solid #ddd;border-radius:10px}
</style>
