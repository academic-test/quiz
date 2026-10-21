<template>
  <main class="admin-shell">
    <section v-if="!authenticated" class="card login-card">
      <div class="login-top">
        <div class="eyebrow">ASSESSMENT ADMINISTRATION</div>
        <h1>Question Bank</h1>
        <p>Sign in to view and edit the existing question bank. Student test flow is not changed by this screen.</p>
      </div>
      <form @submit.prevent="login">
        <label class="field">Admin email<input v-model.trim="credentials.email" type="email" autocomplete="username" required /></label>
        <label class="field">Password<input v-model="credentials.password" type="password" autocomplete="current-password" required /></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="primary wide" type="submit" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
      </form>
    </section>

    <template v-else>
      <header class="admin-header">
        <div>
          <div class="eyebrow">ASSESSMENT ADMINISTRATION</div>
          <h1>Question Bank</h1>
          <div class="muted">Vue admin preview · existing API · no database migration</div>
        </div>
        <button class="secondary" @click="logout">Sign out</button>
      </header>

      <div class="toolbar">
        <select v-model="section" aria-label="Question section" @change="loadBank">
          <option value="humanities">Humanities</option>
          <option value="mathematics_science">Mathematics &amp; Science</option>
        </select>
        <button class="secondary" @click="loadBank" :disabled="busy">{{ busy ? 'Loading…' : 'Refresh bank' }}</button>
        <button class="primary" @click="beginCreate">＋ New question</button>
        <span class="summary">{{ questions.length }} questions · {{ groups.length }} stimulus groups</span>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div v-if="notice" class="notice" role="status">{{ notice }}</div>

      <section v-if="editor" class="card" style="margin-bottom:18px">
        <div class="admin-header" style="margin-bottom:8px">
          <div>
            <div class="eyebrow">{{ editor.id ? 'EDIT QUESTION' : 'CREATE QUESTION' }}</div>
            <h2 style="margin:5px 0">{{ editor.id ? 'Update question' : 'Add to question bank' }}</h2>
          </div>
          <button class="secondary" @click="editor=null">Cancel</button>
        </div>
        <form @submit.prevent="saveQuestion">
          <div class="form-grid">
            <label class="field">Stimulus group<input v-model.trim="editor.stimulus_group" required /></label>
            <label class="field">Difficulty<select v-model="editor.difficulty"><option>easy</option><option>medium</option><option>hard</option></select></label>
          </div>
          <label class="field">Question<textarea v-model.trim="editor.question_text" required /></label>
          <div class="option-grid">
            <label v-for="(option,index) in editor.answer_options" :key="index" class="field">
              Response {{ String.fromCharCode(65+index) }}
              <textarea v-model.trim="editor.answer_options[index]" required />
            </label>
          </div>
          <div class="form-grid">
            <label class="field">Correct response<select v-model.number="editor.correct_answer"><option v-for="(_,index) in editor.answer_options" :key="index" :value="index">{{ String.fromCharCode(65+index) }}</option></select></label>
            <label class="field">Time limit (seconds)<input v-model.number="editor.time" type="number" min="10" max="600" required /></label>
          </div>
          <label class="field">Explanation<textarea v-model.trim="editor.explanation" /></label>
          <template v-if="!editor.id">
            <label class="field">Stimulus passage<textarea v-model.trim="editor.passage" placeholder="Optional. Leave blank when using an existing stimulus group." /></label>
            <label class="field">Stimulus image path or URL<input v-model.trim="editor.stimulus_image" placeholder="/stimuli/example.svg" /></label>
          </template>
          <div class="editor-actions">
            <span class="status">{{ saveStatus }}</span>
            <button class="secondary" type="button" @click="editor=null">Cancel</button>
            <button class="primary" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save question' }}</button>
          </div>
        </form>
      </section>

      <div v-if="loading" class="card empty">Loading question bank…</div>
      <div v-else-if="!groups.length" class="card empty">No bank questions found for this section.</div>
      <div v-else class="group-list">
        <section v-for="group in groups" :key="group.key" class="group-card">
          <header class="group-head">
            <div>
              <h3>{{ group.key }}</h3>
              <p>{{ group.questions.length }} questions · {{ group.questions[0]?.subject || sectionLabel }}</p>
            </div>
            <button class="secondary" @click="toggleGroup(group.key)">{{ expanded.has(group.key) ? 'Hide questions' : 'Show questions' }}</button>
          </header>
          <div v-if="expanded.has(group.key)" class="question-list">
            <article v-for="(question,index) in group.questions" :key="question.id" class="question-row">
              <div>
                <p><strong>Q{{ index+1 }}.</strong> {{ question.question_text }}</p>
                <div class="question-meta">
                  Correct: {{ String.fromCharCode(65 + Number(question.correct_answer || 0)) }} ·
                  {{ question.difficulty || 'medium' }} · {{ Number(question.time || 60) }} sec
                </div>
              </div>
              <button class="secondary" @click="beginEdit(question)">Edit</button>
            </article>
          </div>
        </section>
      </div>
      <p class="helper" style="margin-top:18px">This preview uses the current authenticated admin endpoints. It does not add/delete bank records, change scoring, alter stimulus grouping rules, or migrate the database.</p>
    </template>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";

const authenticated = ref(false);
const busy = ref(false);
const loading = ref(false);
const error = ref("");
const notice = ref("");
const saveStatus = ref("");
const section = ref("humanities");
const questions = ref([]);
const editor = ref(null);
const expanded = reactive(new Set());
const credentials = reactive({ email: "", password: "" });

const sectionLabel = computed(() => section.value === "humanities" ? "Humanities" : "Mathematics & Science");
const groups = computed(() => {
  const map = new Map();
  for (const question of questions.value) {
    const key = String(question.stimulus_group || "UNGROUPED");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(question);
  }
  return [...map.entries()].map(([key, rows]) => ({ key, questions: rows }));
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed (" + response.status + ")");
  return body;
}

async function login() {
  busy.value = true; error.value = "";
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify(credentials) });
    authenticated.value = true;
    credentials.password = "";
    await loadBank();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}

async function logout() {
  authenticated.value = false;
  questions.value = [];
  editor.value = null;
  notice.value = "";
}

async function loadBank() {
  busy.value = true; loading.value = true; error.value = ""; notice.value = "";
  try {
    const data = await api("/api/admin/question-bank?section=" + encodeURIComponent(section.value));
    questions.value = Array.isArray(data.questions) ? data.questions : [];
    for (const group of groups.value) expanded.add(group.key);
  } catch (e) {
    if (e.message === "Admin login required") authenticated.value = false;
    error.value = e.message;
  } finally { busy.value = false; loading.value = false; }
}

function toggleGroup(key) {
  if (expanded.has(key)) expanded.delete(key);
  else expanded.add(key);
}

function blankEditor(question = {}) {
  return {
    id: question.id || "",
    section: section.value,
    stimulus_group: question.stimulus_group || "",
    question_text: question.question_text || "",
    answer_options: Array.from({ length: 4 }, (_, i) => String(question.answer_options?.[i] ?? "")),
    correct_answer: Number(question.correct_answer || 0),
    explanation: question.explanation || "",
    difficulty: question.difficulty || "medium",
    time: Number(question.time || 60),
    passage: question.passage || "",
    stimulus_image: question.stimulus_image || ""
  };
}
function beginCreate() {
  editor.value = blankEditor();
  saveStatus.value = "";
  error.value = "";
  notice.value = "";
}
function beginEdit(question) {
  editor.value = blankEditor(question);
  saveStatus.value = "";
  error.value = "";
  notice.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function saveQuestion() {
  if (!editor.value) return;
  busy.value = true; error.value = ""; saveStatus.value = "Saving…";
  const item = editor.value;
  try {
    if (item.id) {
      await api("/api/admin/question-bank/" + encodeURIComponent(item.id), {
        method: "PUT",
        body: JSON.stringify({
          section: item.section, stimulus_group: item.stimulus_group,
          question_text: item.question_text, answer_options: item.answer_options,
          correct_answer: item.correct_answer, explanation: item.explanation,
          difficulty: item.difficulty, time: item.time
        })
      });
    } else {
      await api("/api/admin/question-bank", {
        method: "POST",
        body: JSON.stringify({
          section: item.section, stimulus_group: item.stimulus_group,
          passage: item.passage, stimulus_image: item.stimulus_image,
          question_text: item.question_text, answer_options: item.answer_options,
          correct_answer: item.correct_answer, explanation: item.explanation,
          difficulty: item.difficulty, time: item.time
        })
      });
    }
    editor.value = null;
    notice.value = "Question saved successfully.";
    saveStatus.value = "";
    await loadBank();
  } catch (e) {
    saveStatus.value = "";
    error.value = e.message;
  } finally { busy.value = false; }
}

onMounted(async () => {
  try {
    await api("/api/admin/me");
    authenticated.value = true;
    await loadBank();
  } catch { authenticated.value = false; }
});
</script>
