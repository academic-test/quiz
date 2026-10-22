<template>
<main class="app-shell igs-maths-shell">
  <header class="topbar"><div><div class="eyebrow">IGS PRACTICE · YEAR 8 MATHEMATICS</div><h1>IGS Maths Practice Test</h1><p class="subtitle">60 original questions based on the Year 8 Mathematics Exam Checklist.</p></div><button class="ghost-btn" @click="leaveTest">Back to test selection</button></header>
  <section v-if="finished" class="card start-card"><div class="eyebrow">PRACTICE COMPLETE</div><h2>Test complete</h2><p class="igs-score">{{ score }} / {{ questions.length }} correct ({{ Math.round(score / questions.length * 100) }}%)</p><div class="igs-topic-results"><div v-for="item in topicResults" :key="item.topic" class="igs-topic-result"><strong>{{ item.topic }}</strong><span>{{ item.correct }} / {{ item.total }}</span></div></div><button class="primary-btn" @click="restart">Try again</button></section>
  <section v-else class="quiz-screen">
    <div class="quiz-meta"><div><span>IGS Maths Practice Test</span><strong>Page {{ pageIndex + 1 }} of {{ pageCount }} · Questions {{ pageIndex * pageSize + 1 }}–{{ Math.min((pageIndex + 1) * pageSize, questions.length) }} of {{ questions.length }}</strong></div><div class="assessment-actions"><strong>{{ timeLabel }}</strong></div></div>
    <div class="block-meta"><span>{{ pageQuestions[0]?.topic }}</span><span>{{ pageAnsweredCount }} of {{ pageQuestions.length }} answered</span></div>
    <div class="progress"><div :style="{ width: ((pageIndex + 1) / pageCount * 100) + '%' }"></div></div>
    <article class="card stimulus-card math-science-card">
      <div class="stimulus-head"><div><div class="stimulus-label">Checklist topic</div><div class="stimulus-range">{{ pageQuestions[0]?.topic }}</div></div><span class="stimulus-status">{{ pageAnsweredCount }} / {{ pageQuestions.length }} answered</span></div>
      <div class="stimulus-questions"><section v-for="(question, i) in pageQuestions" :key="pageIndex * pageSize + i" class="stimulus-question">
        <div class="stimulus-question-number">Question {{ pageIndex * pageSize + i + 1 }} <span v-if="answers[pageIndex * pageSize + i] !== undefined">Answer entered</span></div>
        <div class="question-text">{{ question.q }}</div>
        <label class="igs-answer-label" :for="'igs-answer-' + (pageIndex * pageSize + i)">Your answer</label>
        <input :id="'igs-answer-' + (pageIndex * pageSize + i)" class="igs-answer-input" type="text" autocomplete="off" :placeholder="answerPlaceholder(question)" :value="answers[pageIndex * pageSize + i] ?? ''" :disabled="Boolean(reviewedPages[pageIndex])" @input="enterAnswer(pageIndex * pageSize + i, $event.target.value)" @keydown.enter.prevent="focusNextAnswer($event, i)">
        <p v-if="requiresUnit(question)" class="igs-unit-hint">Include the correct unit in your answer (for example, cm, cm², cm³, mL or m).</p>
        <div v-if="reviewedPages[pageIndex]" class="stimulus-feedback" :class="{ correct: isCorrect(question, answers[pageIndex * pageSize + i]), incorrect: !isCorrect(question, answers[pageIndex * pageSize + i]) }"><div class="stimulus-feedback-title">{{ isCorrect(question, answers[pageIndex * pageSize + i]) ? "✓ Correct" : "✕ Incorrect" }}</div><div v-if="!isCorrect(question, answers[pageIndex * pageSize + i])" class="stimulus-feedback-answer">Expected answer: <strong>{{ question.o[question.a] }}</strong></div><div class="stimulus-feedback-explanation"><strong>Worked explanation:</strong> <span>{{ question.e }}</span></div></div>
      </section></div>
      <div class="stimulus-navigation"><button v-if="!reviewedPages[pageIndex]" class="primary-btn review-submit-btn" :disabled="pageAnsweredCount !== pageQuestions.length" @click="reviewPage">Save Answer &amp; Review →</button><template v-else><button class="secondary-btn" :disabled="pageIndex === 0" @click="pageIndex--">← Previous Page</button><button class="primary-btn review-submit-btn" @click="nextPage">{{ pageIndex === pageCount - 1 ? "Finish Practice Test →" : "Next Page →" }}</button></template></div>
      <div class="question-state"><span v-if="reviewedPages[pageIndex]">Answers are saved in this browser and worked explanations are shown. Continue when ready.</span><span v-else>Enter an answer for all {{ pageQuestions.length }} questions, then select Save Answer &amp; Review. Options are not shown.</span></div>
    </article>
  </section>
</main>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, watch, ref } from "vue";
import { igsMathsQuestions as questions } from "./data/igsMathsQuestions.js";
const key = "igs-year8-maths-practice-v2", pageSize = 4, pageCount = Math.ceil(questions.length / pageSize);
const pageIndex = ref(0), answers = ref({}), reviewedPages = ref({}), finished = ref(false), remaining = ref(2400);
let timer = null;
const pageQuestions = computed(() => questions.slice(pageIndex.value * pageSize, (pageIndex.value + 1) * pageSize));
const pageAnsweredCount = computed(() => pageQuestions.value.filter((q, i) => String(answers.value[pageIndex.value * pageSize + i] ?? "").trim().length > 0).length);
const score = computed(() => questions.reduce((n, q, i) => n + (isCorrect(q, answers.value[i]) ? 1 : 0), 0));
const topicResults = computed(() => { const d = {}; questions.forEach((q, i) => { d[q.topic] ||= { topic: q.topic, total: 0, correct: 0 }; d[q.topic].total++; if (isCorrect(q, answers.value[i])) d[q.topic].correct++; }); return Object.values(d); });
const timeLabel = computed(() => Math.floor(remaining.value / 60) + ":" + String(remaining.value % 60).padStart(2, "0"));
function normalize(value) {
  return String(value ?? "").toLowerCase().trim()
    .replace(/[−–—]/g, "-").replace(/×/g, "*").replace(/÷/g, "/")
    .replace(/²/g, "^2").replace(/³/g, "^3").replace(/π/g, "pi")
    .replace(/,/g, "").replace(/\s+/g, "").replace(/\$/g, "")
    .replace(/squarecentimetres?|squarecentimeters?/g, "cm^2")
    .replace(/cubiccentimetres?|cubiccentimeters?/g, "cm^3")
    .replace(/centimetres?|centimeters?/g, "cm").replace(/millilitres?|milliliters?/g, "ml")
    .replace(/litres?|liters?/g, "l").replace(/metres?|meters?/g, "m");
}
function stripAnswerPrefix(value) {
  return normalize(value).replace(/^[a-z]\s*=\s*/, "").replace(/^x\s*[:=]\s*/, "");
}
function isCorrect(question, answer) {
  if (String(answer ?? "").trim() === "") return false;
  const expected = question.o?.[question.a];
  if (expected == null) return false;
  const actual = stripAnswerPrefix(answer), target = stripAnswerPrefix(expected);
  if (actual === target) return true;
  // Permit equivalent common numeric forms, including fractions and decimal probabilities.
  const fraction = actual.match(/^(-?\d+)\/(-?\d+)$/);
  const targetFraction = target.match(/^(-?\d+)\/(-?\d+)$/);
  const numericActual = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(actual);
  const numericTarget = targetFraction ? Number(targetFraction[1]) / Number(targetFraction[2]) : Number(target);
  if (actual && target && Number.isFinite(numericActual) && Number.isFinite(numericTarget) && numericActual === numericTarget) return true;
  return false;
}
function requiresUnit(question) {
  const expected = normalize(question.o?.[question.a] ?? "");
  return /\d(cm\^2|cm\^3|mm\^2|mm\^3|km\^2|m\^2|m\^3|cm|mm|km|ml|l|m|°|degrees?|\$)/.test(expected);
}
function answerPlaceholder(question) {
  const expected = question.o?.[question.a] ?? "";
  if (/[a-z]/i.test(expected) && /[=<>]/.test(expected)) return "e.g. x = …";
  if (/\{/.test(expected)) return "Enter the set, e.g. {1, 2, 3}";
  if (/\//.test(expected)) return "Enter a fraction or decimal";
  if (requiresUnit(question)) return "Number and unit";
  return "Type your answer";
}
function persist() { try { localStorage.setItem(key, JSON.stringify({ pageIndex: pageIndex.value, answers: answers.value, reviewedPages: reviewedPages.value, finished: finished.value, remaining: remaining.value })); } catch {} }
function enterAnswer(i, value) { if (!reviewedPages.value[pageIndex.value]) answers.value = { ...answers.value, [i]: value }; }
function focusNextAnswer(event, i) { const fields = event.target.closest(".stimulus-questions")?.querySelectorAll(".igs-answer-input"); if (fields && i < fields.length - 1) fields[i + 1].focus(); }
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
.igs-answer-label{display:block;font-weight:650;margin:12px 0 6px}.igs-answer-input{display:block;width:100%;box-sizing:border-box;min-height:44px;padding:11px 12px;border:1px solid #9aa6b2;border-radius:8px;background:#fff;color:#17202a;font:inherit}.igs-answer-input:focus{outline:3px solid #b9d7ff;border-color:#2767b2}.igs-answer-input:disabled{background:#f2f4f7}.igs-unit-hint{margin:6px 0 0;color:var(--muted);font-size:13px}
</style>
