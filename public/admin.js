const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

async function api(url,options={}){
  const response=await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"Request failed");
  return data;
}

const bankLabels={humanities:"Humanities",mathematics_science:"Mathematics & Science"};

function applyAdminTheme(theme){
  const resolved=theme==="dark"?"dark":"light";
  document.body.dataset.theme=resolved;
  const toggle=$("themeToggle");
  if(toggle){
    toggle.textContent=resolved==="dark"?"☀ Light mode":"☾ Dark mode";
    toggle.setAttribute("aria-pressed",String(resolved==="dark"));
  }
  try{localStorage.setItem("quiz-admin-theme",resolved);}catch{}
}

function initAdminTheme(){
  let theme="light";
  try{theme=localStorage.getItem("quiz-admin-theme")||"light";}catch{}
  applyAdminTheme(theme);
  $("themeToggle")?.addEventListener("click",()=>{
    applyAdminTheme(document.body.dataset.theme==="dark"?"light":"dark");
  });
}

initAdminTheme();
let currentBankSection="";
const attemptsState={
  page:0,
  pageSize:25,
  total:0,
  hasMore:true,
  loading:false,
  observer:null
};

function openDashboard(){
  $("login").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  showAdminSection("overview");
  loadAttempts(true);
  loadBankCards().then(()=>{
    const bankSection=new URLSearchParams(window.location.search).get("bank");
    if(bankSection && bankLabels[bankSection]) { showAdminSection("question-bank"); openBank(bankSection); }
  });
  loadWritingTopics();
  setupAttemptsInfiniteScroll();
}

async function checkLogin(){try{await api("/api/admin/me");openDashboard();}catch{}}

$("loginForm").onsubmit=async function(e){
  e.preventDefault();
  $("loginError").textContent="";
  try{
    await api("/api/admin/login",{method:"POST",body:JSON.stringify({
      email:$("email").value,password:$("password").value
    })});
    openDashboard();
  }catch(err){$("loginError").textContent=err.message;}
};

async function logoutAdmin(){
  await api("/api/admin/logout",{method:"POST"});
  location.reload();
}

function showAdminSection(section){
  const map={overview:"overviewSection","question-bank":"questionBankSection",writing:"writingSection",assessments:"assessmentsSection",analytics:"analyticsSection","ai-telemetry":"aiTelemetrySection"};
  Object.values(map).forEach(id=>$(id)?.classList.add("hidden"));
  const target=map[section]||map.overview;
  $(target)?.classList.remove("hidden");
  if(section==="ai-telemetry") loadTelemetry();
  if(section==="analytics") loadQuestionAnalytics();
  document.querySelectorAll("[data-admin-nav]").forEach(button=>button.classList.toggle("active",button.dataset.adminNav===section));
  window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll("[data-admin-nav]").forEach(button=>{
  button.onclick=()=>showAdminSection(button.dataset.adminNav);
});
$("navRefresh")?.addEventListener("click",refreshAdmin);
$("navLogout")?.addEventListener("click",logoutAdmin);



async function refreshAdmin(){
  await Promise.all([
    loadAttempts(true),
    loadBankCards(),
    loadWritingTopics(),
    document.getElementById("aiTelemetrySection")?.classList.contains("hidden") ? Promise.resolve() : loadTelemetry(),
    document.getElementById("analyticsSection")?.classList.contains("hidden") ? Promise.resolve() : loadQuestionAnalytics()
  ]);
}

$("refreshBank")?.addEventListener("click",loadBankCards);
$("refreshWriting")?.addEventListener("click",loadWritingTopics);
$("closeDetail")?.addEventListener("click",()=>$("detail")?.classList.add("hidden"));
$("attemptsLoadMore")?.addEventListener("click",()=>loadAttempts(false));

async function loadAttempts(reset=false){
  if(attemptsState.loading) return;
  if(!reset && !attemptsState.hasMore) return;

  attemptsState.loading=true;
  if(reset){
    attemptsState.page=0;
    attemptsState.total=0;
    attemptsState.hasMore=true;
    $("attempts").innerHTML="";
  }

  $("attemptsStatus").textContent=reset?"Loading assessments…":"Loading more assessments…";
  $("attemptsLoadMore").classList.add("hidden");

  try{
    const nextPage=attemptsState.page+1;
    const data=await api("/api/admin/attempts?page="+nextPage+"&page_size="+attemptsState.pageSize);

    attemptsState.page=data.page||nextPage;
    attemptsState.total=Number(data.total||0);
    attemptsState.hasMore=Boolean(data.has_more);

    appendAttempts(data.attempts||[]);
    if(reset || attemptsState.page===1) await loadAttemptSummary();
    updateAttemptsStatus();
  }catch(err){
    if(err.message==="Admin login required")location.reload();
    else{
      $("attemptsStatus").textContent="Could not load assessments. Use Load more to retry.";
      $("attemptsLoadMore").textContent="Retry";
      $("attemptsLoadMore").classList.remove("hidden");
    }
  }finally{
    attemptsState.loading=false;
  }
}

async function loadAttemptSummary(){
  const data=await api("/api/admin/attempts/summary");
  $("total").textContent=Number(data.total_attempts||0);
  $("avgScore").textContent=Number(data.average_score||0)+"%";
  $("best").textContent=Number(data.best_score||0)+"%";
  $("responses").textContent=Number(data.total_responses||0);
}

function appendAttempts(attempts){
  const body=$("attempts");
  if(!attempts.length && attemptsState.page===1){
    body.innerHTML='<tr><td colspan="12" class="loading-row">No assessments have been taken yet.</td></tr>';
    return;
  }

  // Remove an empty-state row before appending real records.
  const emptyRow=body.querySelector(".loading-row");
  if(emptyRow)emptyRow.remove();

  attempts.forEach(a=>{
    const row=document.createElement("tr");

    [
      new Date(a.started_at).toLocaleString(),
      (a.session_name||"Student")+" — "+(a.session_id||"-"),
      a.year_level||"-",a.section,a.difficulty,a.question_count,a.answered_count||0,
      a.score==null?"-":a.score+"%",
      a.correct_count==null?"-":a.correct_count,
      a.wrong_count==null?"-":a.wrong_count,
      a.timeout_count==null?"-":a.timeout_count
    ].forEach(v=>{
      const cell=document.createElement("td");
      cell.textContent=v;
      row.appendChild(cell);
    });

    const actionCell=document.createElement("td");
    const viewButton=document.createElement("button");
    viewButton.textContent="View";
    viewButton.className="ghost";
    viewButton.onclick=()=>window.open("/admin/responses?id="+encodeURIComponent(a.id),"_blank","noopener,noreferrer");

    const deleteButton=document.createElement("button");
    deleteButton.textContent="Delete";
    deleteButton.className="delete-btn";
    deleteButton.style.marginLeft="7px";
    deleteButton.onclick=()=>deleteAssessment(a,deleteButton);

    actionCell.appendChild(viewButton);
    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);
    body.appendChild(row);
  });
}

function updateAttemptsStatus(){
  const loaded=$("attempts").querySelectorAll("tr:not(.loading-row)").length;
  if(!attemptsState.total){
    $("attemptsStatus").textContent="No assessments taken.";
    $("attemptsLoadMore").classList.add("hidden");
    return;
  }

  $("attemptsStatus").textContent="Showing "+Math.min(loaded,attemptsState.total)+" of "+attemptsState.total+" assessments";
  $("attemptsLoadMore").classList.toggle("hidden",!attemptsState.hasMore);
  if(!attemptsState.hasMore){
    $("attemptsStatus").textContent+=" · All assessments loaded";
  }
}

function setupAttemptsInfiniteScroll(){
  if(attemptsState.observer)attemptsState.observer.disconnect();

  const root=$("attemptsScroll");
  const sentinel=$("attemptsSentinel");
  if(!root||!sentinel)return;

  attemptsState.observer=new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting)) loadAttempts(false);
  },{
    root,
    rootMargin:"500px 0px",
    threshold:0
  });
  attemptsState.observer.observe(sentinel);
}

async function deleteAssessment(attempt,button){
  const student=attempt.session_name||"this student";
  const started=attempt.started_at?new Date(attempt.started_at).toLocaleString():"";
  const confirmed=window.confirm(
    "Delete this assessment permanently?\\n\\n"+
    student+
    (started?" — "+started:"")+
    "\\n\\nThis removes the assessment, saved responses, writing responses and its generated questions. This cannot be undone."
  );
  if(!confirmed)return;

  button.disabled=true;
  button.textContent="Deleting…";
  try{
    await api("/api/admin/attempts/"+encodeURIComponent(attempt.id),{method:"DELETE"});
    await loadAttempts(true);
  }catch(err){
    button.disabled=false;
    button.textContent="Delete";
    alert(err.message);
  }
}

async function loadWritingTopics(){
  try{
    const data=await api("/api/admin/writing-topics");
    renderWritingTopicCards(data.topics||[]);
  }catch(err){
    if(err.message==="Admin login required")location.reload();
    else $("writingTopicCards").innerHTML='<div class="bank-empty">'+esc(err.message)+"</div>";
  }
}

function renderWritingTopicCards(topics){
  const grouped={1:[],2:[]};
  (topics||[]).forEach(topic=>{
    if(grouped[topic.task_slot]) grouped[topic.task_slot].push(topic);
  });
  $("writingTopicCards").innerHTML=[1,2].map(slot=>`
    <article class="writing-topic-card">
      <div class="eyebrow">WRITTEN EXPRESSION ${slot}</div>
      <h3>Topic Pool ${slot}</h3>
      <div class="small-note">Students receive one topic from this pool when the assessment starts.</div>
      <div class="writing-topic-list">
        ${grouped[slot].length?grouped[slot].map(topic=>`
          <div class="writing-topic-item" data-topic-id="${esc(topic.id)}" data-task-slot="${slot}">
            <div class="writing-topic-id">${esc(topic.id)}</div>
            <textarea data-topic-field>${esc(topic.topic)}</textarea>
            <div class="writing-topic-actions">
              <span class="writing-status" data-topic-status></span>
              <button type="button" class="ghost" data-writing-action="save">Save</button>
              <button type="button" class="ghost" data-writing-action="delete">Delete</button>
            </div>
          </div>
        `).join(""):'<div class="bank-empty">No topics in this pool.</div>'}
      </div>
      <form class="writing-add" data-writing-add-slot="${slot}">
        <label>Add new topic</label>
        <textarea name="topic" placeholder="Enter a new topic for Written Expression ${slot}." required></textarea>
        <div class="bank-actions">
          <span class="writing-status" data-add-status></span>
          <button type="submit" class="primary">Add Topic</button>
        </div>
      </form>
    </article>
  `).join("");

  $("writingTopicCards").querySelectorAll("[data-writing-action]").forEach(button=>{
    button.onclick=()=>button.dataset.writingAction==="save"
      ? saveWritingTopic(button)
      : deleteWritingTopic(button);
  });
  $("writingTopicCards").querySelectorAll("[data-writing-add-slot]").forEach(form=>{
    form.onsubmit=e=>addWritingTopic(e,Number(form.dataset.writingAddSlot));
  });
}

async function saveWritingTopic(button){
  const item=button.closest(".writing-topic-item");
  const status=item.querySelector("[data-topic-status]");
  const topic=item.querySelector("[data-topic-field]").value.trim();
  status.className="writing-status";
  status.textContent="Saving…";
  try{
    await api("/api/admin/writing-topics/"+encodeURIComponent(item.dataset.topicId),{
      method:"PUT",body:JSON.stringify({topic})
    });
    status.className="writing-status good";
    status.textContent="Saved.";
  }catch(err){
    status.className="writing-status bad";
    status.textContent=err.message;
  }
}

async function deleteWritingTopic(button){
  const item=button.closest(".writing-topic-item");
  const topic=item.querySelector("[data-topic-field]").value.trim();
  if(!window.confirm("Delete this Written Expression topic?\\n\\n"+topic)) return;
  const status=item.querySelector("[data-topic-status]");
  status.className="writing-status";
  status.textContent="Deleting…";
  try{
    await api("/api/admin/writing-topics/"+encodeURIComponent(item.dataset.topicId),{method:"DELETE"});
    await loadWritingTopics();
  }catch(err){
    status.className="writing-status bad";
    status.textContent=err.message;
  }
}

async function addWritingTopic(event,slot){
  event.preventDefault();
  const form=event.currentTarget;
  const status=form.querySelector("[data-add-status]");
  const topic=form.querySelector("textarea[name=topic]").value.trim();
  status.className="writing-status";
  status.textContent="Saving…";
  try{
    await api("/api/admin/writing-topics",{
      method:"POST",
      body:JSON.stringify({task_slot:slot,topic})
    });
    await loadWritingTopics();
  }catch(err){
    status.className="writing-status bad";
    status.textContent=err.message;
  }
}

async function loadBankCards(){
  try{
    const [humanities,maths]=await Promise.all([
      api("/api/admin/question-bank?section=humanities"),
      api("/api/admin/question-bank?section=mathematics_science")
    ]);
    renderBankCards({humanities,mathematics_science:maths});
  }catch(err){
    if(err.message==="Admin login required")location.reload();
    else $("bankCards").innerHTML='<div class="bank-empty">'+esc(err.message)+"</div>";
  }
}

function renderBankCards(data){
  const cards=[
    ["humanities",data.humanities],
    ["mathematics_science",data.mathematics_science]
  ];
  $("bankCards").innerHTML=cards.map(([section,value])=>{
    const groups=new Set((value.questions||[]).map(q=>q.stimulus_group).filter(Boolean));
    const selected=currentBankSection===section?" selected":"";
    return `<button type="button" class="bank-card${selected}" data-bank-section="${section}">
      <div class="bank-card-title">${bankLabels[section]}</div>
      <div class="bank-card-meta">
        <span class="bank-badge">${value.count||0} questions</span>
        <span class="bank-badge">${groups.size} stimulus pages</span>
        <span class="bank-badge ${value.active_count?"active":""}">${value.active_count||0} in active assessments</span>
      </div>
    </button>`;
  }).join("");
  $("bankCards").querySelectorAll("[data-bank-section]").forEach(button=>{
    button.onclick=()=>{
      showAdminSection("question-bank");
      openBank(button.dataset.bankSection);
    };
  });
}

async function openBank(section){
  currentBankSection=section;
  renderBankCardsAfterSelection();
  $("newQuestionPanel").classList.add("hidden");
  $("bankEditor").classList.remove("hidden");
  $("bankEditor").innerHTML='<div class="bank-empty">Loading '+esc(bankLabels[section])+' question bank…</div>';
  try{
    const data=await api("/api/admin/question-bank?section="+encodeURIComponent(section));
    const params=new URLSearchParams(window.location.search);
    const generatedParam=params.get("generated");
    if(generatedParam && params.get("bank")===section){
      data=filterGeneratedQuestions(data,generatedParam.split(",").filter(Boolean));
    }
    renderQuestionBank(data);
    if(data.generatedOnly)decorateGeneratedOnlyView();
  }catch(err){
    $("bankEditor").innerHTML='<div class="bank-empty">'+esc(err.message)+'</div>';
  }
  $("bankEditor").scrollIntoView({behavior:"smooth",block:"start"});
}

function renderBankCardsAfterSelection(){
  $("bankCards").querySelectorAll("[data-bank-section]").forEach(button=>{
    button.classList.toggle("selected",button.dataset.bankSection===currentBankSection);
  });
}

function filterGeneratedQuestions(data, stimulusGroups){
  const groupIds=new Set(stimulusGroups);
  data.questions=(data.questions||[]).filter(question=>groupIds.has(question.stimulus_group));
  data.count=data.questions.length;
  data.generatedOnly=true;
  return data;
}

function decorateGeneratedOnlyView(){
  const title=$("bankEditor").querySelector(".bank-toolbar h2");
  if(title)title.textContent="Newly Generated Questions";
  const generator=$("bankEditor").querySelector("[data-hf-generator]");
  if(generator)generator.remove();
  const addButton=$("bankEditor").querySelector('[data-action="add-question"]');
  if(addButton)addButton.remove();
  const closeButton=$("bankEditor").querySelector('[data-action="close-bank"]');
  if(closeButton){closeButton.textContent="Back to Question Bank";closeButton.dataset.action="close-generated";}
  const note=document.createElement("p");
  note.className="small-note";
  note.textContent="These complete stimulus pages have just been added to the persistent question bank. Active student assessments are unchanged.";
  $("bankEditor").querySelector(".bank-toolbar").after(note);
}

function displayStimulusName(group,index){
  const raw=String(group||"").trim();
  const uuid=/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  if(!raw || uuid.test(raw) || /^(GEN|GENERATED)[-_ ]?(HUM|MS|MATH|HUMANITIES)?[-_ ]?(PAGE|STIMULUS)/i.test(raw)) return "Stimulus page "+(index+1);
  const clean=raw.replace(uuid,"").replace(/[-_ ]+$/,"").trim();
  return clean && !/^(GEN|GENERATED)$/i.test(clean) ? clean : "Stimulus page "+(index+1);
}

function renderQuestionBank(data){
  const questions=data.questions||[];
  const grouped=new Map();
  questions.forEach(question=>{
    const group=question.stimulus_group||"Ungrouped";
    if(!grouped.has(group))grouped.set(group,[]);
    grouped.get(group).push(question);
  });

  const groupHtml=[...grouped.entries()].map(([group,rows],groupIndex)=>{
    const active=rows.some(row=>row.session_id);
    const first=rows[0]||{};
    return `<article class="bank-group" data-group-root="${esc(group)}">
      <div class="bank-group-head">
        <div class="bank-group-title">
          <div><strong>${esc(displayStimulusName(group,groupIndex))}</strong><div class="small-note">${rows.length} question${rows.length===1?"":"s"} in this stimulus page</div></div>
          <span class="bank-status ${active?"active":""}">${active?"Currently in an active assessment":"Available for use"}</span>
        </div>
      </div>
      <div class="bank-stimulus">
        <div class="stimulus-reading-label">Stimulus paragraph</div>
        <div class="stimulus-reading-text">${esc(first.passage||"No stimulus paragraph has been added yet.")}</div>
        ${first.stimulus_image?`<img class="bank-image-preview" src="${esc(first.stimulus_image)}" alt="Stimulus preview" onerror="this.style.display='none'">`:""}
        <details class="stimulus-edit-details">
          <summary>Edit stimulus paragraph and image</summary>
          <label>Shared stimulus / passage</label>
          <textarea data-group-field="passage" ${active?"disabled":""}>${esc(first.passage||"")}</textarea>
          <label>Stimulus image path or URL</label>
          <input type="text" data-group-field="stimulus_image" value="${esc(first.stimulus_image||"")}" ${active?"disabled":""}>
          <div class="bank-actions">
            <span class="bank-save-state"></span>
            <button type="button" class="primary" data-action="save-group" ${active?"disabled":""}>Save Stimulus</button>
          </div>
        </details>
      </div>
      <div class="bank-questions-wrap">
        <button type="button" class="ghost question-toggle" data-action="toggle-questions" aria-expanded="false">
          <span class="question-toggle-arrow">▸</span> Show ${rows.length} question${rows.length===1?"":"s"}
        </button>
        <div class="bank-questions hidden">${rows.map((row,index)=>questionEditorHtml(row,index,active)).join("")}</div>
      </div>
    </article>`;
  }).join("");

  $("bankEditor").innerHTML=`
    <div class="bank-toolbar">
      <div>
        <h2>${esc(bankLabels[data.section])} Question Bank</h2>
        <p>${data.count||0} questions across ${grouped.size} stimulus pages.</p>
      </div>
      <div>
        <button type="button" class="ghost close-bank" data-action="close-bank">Close</button>
        <button type="button" class="primary" data-action="add-question">Create New Question</button>
      </div>
    </div>
    <div class="hf-generator" data-hf-generator>
      <div>
        <div class="eyebrow">QUESTION GENERATION</div>
        <h3>Generate with AI</h3>
        <p>Add original shared-stimulus pages to this persistent question bank. The generator does not change active student assessments.</p>
      </div>
      <div class="hf-generator-controls">
        <label for="hfProvider">AI provider</label>
        <select id="hfProvider" data-hf-provider>
          <option value="openrouter">OpenRouter</option><option value="grok">Grok (xAI)</option>
        </select>
        <label for="hfPageCount">Pages</label>
        <select id="hfPageCount" data-hf-page-count>
          <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
        </select>
        <button type="button" class="primary" data-hf-generate>Generate pages</button>
      </div>
      <div class="hf-generator-status" data-hf-status data-state="checking">Checking OpenRouter and Grok configuration…</div>
    <div class="small-note">If your selected provider fails, the generator automatically tries the other configured provider.</div>
    <div class="small-note hidden" data-hf-grok-missing>Add XAI_API_KEY in Render to enable Grok.</div>
    </div>
    <div class="small-note" style="margin-bottom:14px">Questions currently assigned to an active student test are read-only here so an edit cannot change a live assessment.</div>
    <div class="bank-groups">${groupHtml||'<div class="bank-empty">No questions are in this bank yet.</div>'}</div>`;

  bindBankEditor(data.section);
  setupHuggingFaceGenerator(data.section);
}

function questionEditorHtml(row,index,groupActive){
  const options=Array.isArray(row.answer_options)?row.answer_options:[];
  const active=Boolean(row.session_id)||groupActive;
  const safeId=String(row.id).replace(/[^a-zA-Z0-9_-]/g,"_");
  return `<div class="bank-question" data-question-id="${esc(row.id)}" data-section="${esc(row.section)}" data-group="${esc(row.stimulus_group||"")}" data-active="${active?"1":"0"}">
    <div class="bank-q-head">
      <span class="bank-q-number">Question ${index+1}</span>

    </div>
    <div class="bank-grid">
      <div>
        <label>Question</label>
        <textarea data-field="question_text" ${active?"disabled":""}>${esc(row.question_text||"")}</textarea>
      </div>
      <div>
        <label>Difficulty</label>
        <select data-field="difficulty" ${active?"disabled":""}>
          ${["easy","medium","hard"].map(value=>`<option value="${value}" ${String(row.difficulty||"medium")===value?"selected":""}>${value[0].toUpperCase()+value.slice(1)}</option>`).join("")}
        </select>
        <label>Time (seconds)</label>
        <input type="number" min="10" max="600" data-field="time" value="${Number(row.time||60)}" ${active?"disabled":""}>
      </div>
    </div>
    <details class="answer-details">
      <summary>Show answers & explanation</summary>
      <div class="answer-details-body">
        <label>Answer responses</label>
        <div>
          ${[0,1,2,3].map(i=>{
            const value=options[i]||"";
            const checked=Number(row.correct_answer)===i;
            return `<div class="bank-option">
              <input type="radio" name="correct-${safeId}" value="${i}" ${checked?"checked":""} ${active?"disabled":""}>
              <span class="bank-option-label">${String.fromCharCode(65+i)}</span>
              <input type="text" data-option-index="${i}" value="${esc(value)}" ${active?"disabled":""}>
            </div>`;
          }).join("")}
        </div>
        <label>Explanation</label>
        <textarea data-field="explanation" ${active?"disabled":""}>${esc(row.explanation||"")}</textarea>
      </div>
    </details>
    <div class="bank-actions">
      <span class="bank-save-state"></span>
      <button type="button" class="primary" data-action="save-question" ${active?"disabled":""}>Save Question</button>
    </div>
  </div>`;
}

function bindBankEditor(section){
  $("bankEditor").querySelectorAll("[data-action]").forEach(button=>{
    button.onclick=()=>{
      const action=button.dataset.action;
      if(action==="toggle-questions"){
        const wrap=button.closest(".bank-questions-wrap");
        const questions=wrap?.querySelector(".bank-questions");
        if(questions){
          const expanded=button.getAttribute("aria-expanded")==="true";
          questions.classList.toggle("hidden",expanded);
          button.setAttribute("aria-expanded",String(!expanded));
          button.querySelector(".question-toggle-arrow").textContent=expanded?"▸":"▾";
          button.lastChild.textContent=expanded
            ?" Show "+questions.querySelectorAll(".bank-question").length+" questions"
            :" Hide questions";
        }
      }else if(action==="close-generated"){
        openBank(currentBankSection);
      }else if(action==="close-bank"){
        currentBankSection="";
        $("bankEditor").classList.add("hidden");
        $("newQuestionPanel").classList.add("hidden");
        renderBankCardsAfterSelection();
      }else if(action==="add-question"){
        showNewQuestion(section);
      }else if(action==="save-group"){
        saveStimulusGroup(button);
      }else if(action==="save-question"){
        saveBankQuestion(button);
      }
    };
  });
}

function showNewQuestion(section){
  $("newQuestionPanel").classList.remove("hidden");
  $("newQuestionPanel").innerHTML=`
    <div class="top" style="margin-bottom:6px"><div><div class="eyebrow">NEW QUESTION</div><h2>Create Question</h2><p>Add a new bank question. Use the same stimulus group for questions that share a page.</p></div><button type="button" class="ghost" id="cancelNewQuestion">Cancel</button></div>
    <form id="newQuestionForm">
      <div class="new-grid">
        <div>
          <label>Stimulus group</label>
          <input name="stimulus_group" required placeholder="${section==="humanities"?"HUM-ADMIN-A-01":"MATH-ADMIN-A-01"}">
          <label>Stimulus passage</label>
          <textarea name="passage" placeholder="Leave blank when adding to an existing stimulus group."></textarea>
          <label>Stimulus image path or URL</label>
          <input name="stimulus_image" type="text" placeholder="/stimuli/example.svg">
        </div>
        <div>
          <label>Question</label>
          <textarea name="question_text" required></textarea>
          <div class="new-options">
            ${[0,1,2,3].map(i=>`<div><label>Response ${String.fromCharCode(65+i)}</label><input name="option-${i}" required></div>`).join("")}
          </div>
          <label>Correct response</label>
          <div class="radio-row">${[0,1,2,3].map(i=>`<label><input type="radio" name="correct_answer" value="${i}" ${i===0?"checked":""}> ${String.fromCharCode(65+i)}</label>`).join("")}</div>
          <label>Explanation</label>
          <textarea name="explanation"></textarea>
          <div class="new-grid">
            <div><label>Difficulty</label><select name="difficulty"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select></div>
            <div><label>Time (seconds)</label><input name="time" type="number" min="10" max="600" value="60"></div>
          </div>
        </div>
      </div>
      <div class="bank-actions"><span class="bank-save-state" id="newQuestionStatus"></span><button class="primary" type="submit">Create Question</button></div>
    </form>`;
  $("cancelNewQuestion").onclick=()=>$("newQuestionPanel").classList.add("hidden");
  $("newQuestionForm").onsubmit=e=>createBankQuestion(e,section);
  $("newQuestionPanel").scrollIntoView({behavior:"smooth",block:"start"});
}

async function createBankQuestion(event,section){
  event.preventDefault();
  const form=event.currentTarget;
  const status=$("newQuestionStatus");
  status.className="bank-save-state";
  status.textContent="Saving…";
  const fd=new FormData(form);
  try{
    await api("/api/admin/question-bank",{method:"POST",body:JSON.stringify({
      section,
      stimulus_group:String(fd.get("stimulus_group")||"").trim(),
      passage:String(fd.get("passage")||"").trim(),
      stimulus_image:String(fd.get("stimulus_image")||"").trim(),
      question_text:String(fd.get("question_text")||"").trim(),
      answer_options:[0,1,2,3].map(i=>String(fd.get("option-"+i)||"").trim()),
      correct_answer:Number(fd.get("correct_answer")),
      explanation:String(fd.get("explanation")||"").trim(),
      difficulty:String(fd.get("difficulty")||"medium"),
      time:Number(fd.get("time")||60)
    })});
    status.className="bank-save-state good";
    status.textContent="Created.";
    form.reset();
    form.querySelector('[name="correct_answer"][value="0"]').checked=true;
    await openBank(section);
    $("newQuestionPanel").classList.add("hidden");
  }catch(err){
    status.className="bank-save-state bad";
    status.textContent=err.message;
  }
}

async function saveStimulusGroup(button){
  const group=button.closest(".bank-group");
  const section=currentBankSection;
  const actualGroup=group.getAttribute("data-group-root");
  const passage=group.querySelector('[data-group-field="passage"]').value;
  const stimulusImage=group.querySelector('[data-group-field="stimulus_image"]').value.trim();
  const status=group.querySelector(".bank-save-state");
  status.className="bank-save-state";
  status.textContent="Saving…";
  try{
    await api("/api/admin/question-bank/group",{method:"PUT",body:JSON.stringify({
      section,stimulus_group:actualGroup,passage,stimulus_image:stimulusImage
    })});
    status.className="bank-save-state good";
    status.textContent="Stimulus saved.";
  }catch(err){
    status.className="bank-save-state bad";
    status.textContent=err.message;
  }
}

async function saveBankQuestion(button){
  const root=button.closest(".bank-question");
  const status=root.querySelector(".bank-save-state");
  status.className="bank-save-state";
  status.textContent="Saving…";
  const options=[0,1,2,3].map(i=>{
    const input=root.querySelector('[data-option-index="'+i+'"]');
    return input?input.value.trim():"";
  });
  const correct=root.querySelector('input[type="radio"]:checked');
  try{
    await api("/api/admin/question-bank/"+encodeURIComponent(root.dataset.questionId),{
      method:"PUT",
      body:JSON.stringify({
        section:root.dataset.section,
        stimulus_group:root.dataset.group,
        question_text:root.querySelector('[data-field="question_text"]').value.trim(),
        answer_options:options,
        correct_answer:correct?Number(correct.value):0,
        explanation:root.querySelector('[data-field="explanation"]').value.trim(),
        difficulty:root.querySelector('[data-field="difficulty"]').value,
        time:Number(root.querySelector('[data-field="time"]').value||60)
      })
    });
    status.className="bank-save-state good";
    status.textContent="Question saved.";
  }catch(err){
    status.className="bank-save-state bad";
    status.textContent=err.message;
  }
}


async function setupHuggingFaceGenerator(section){
  const panel=$("bankEditor").querySelector("[data-hf-generator]");
  if(!panel)return;
  const button=panel.querySelector("[data-hf-generate]");
  const status=panel.querySelector("[data-hf-status]");
  const providerSelect=panel.querySelector("[data-hf-provider]");
  button.onclick=()=>generateWithHuggingFace(section,button);
  button.disabled=true;
  try{
    const config=await api("/api/admin/huggingface/status");
    const providers=config.providers||{};
    const openrouter=Boolean(providers.openrouter&&providers.openrouter.configured);
    const grok=Boolean(providers.grok&&providers.grok.configured);
    const grokNotice=panel.querySelector("[data-hf-grok-missing]");
    if(grokNotice)grokNotice.classList.toggle("hidden",grok);
    const refreshProviderStatus=()=>{
      const preferred=providerSelect.value==="grok"?"Grok":"OpenRouter";
      const preferredConfigured=providerSelect.value==="grok"?grok:openrouter;
      const fallbackConfigured=providerSelect.value==="grok"?openrouter:grok;
      if(!openrouter&&!grok){
        status.dataset.state="not-configured";
        status.textContent="Add OPENROUTER_API_KEY and/or XAI_API_KEY in Render to enable question generation.";
        button.disabled=true;
      }else{
        status.dataset.state="ready";
        status.textContent=preferred+" selected · "+(preferredConfigured?"configured":"not configured; will try the other provider")+
          (fallbackConfigured?" · automatic fallback available":" · no fallback provider configured");
        button.disabled=false;
      }
    };
    providerSelect.onchange=refreshProviderStatus;
    refreshProviderStatus();
    if(status.dataset.state==="success"||status.dataset.state==="error"){
      // Preserve the result/error message until the provider selection changes.
      button.disabled=!openrouter&&!grok;
      return;
    }
  }catch(err){
    if(err.message==="Admin login required")location.reload();
    status.dataset.state="error";
    status.textContent=err.message;
    button.disabled=true;
  }
}

async function generateWithHuggingFace(section,button){
  const panel=button.closest("[data-hf-generator]");
  const status=panel.querySelector("[data-hf-status]");
  const provider=panel.querySelector("[data-hf-provider]").value||"openrouter";
  const pageCount=Number(panel.querySelector("[data-hf-page-count]").value||1);
  button.disabled=true;
  button.textContent="Generating…";
  status.dataset.state="generating";
  status.textContent="Generating with "+(provider==="grok"?"Grok":"OpenRouter")+"; automatic fallback is enabled if it fails. This can take up to two minutes.";
  try{
    const result=await api("/api/admin/question-bank/generate-with-hugging-face",{
      method:"POST",
      body:JSON.stringify({section,page_count:pageCount,provider})
    });
    await loadBankCards();
    const refreshed=await api("/api/admin/question-bank?section="+encodeURIComponent(section));
    if(result.stimulus_groups&&result.stimulus_groups.length){
      filterGeneratedQuestions(refreshed,result.stimulus_groups);
      renderQuestionBank(refreshed);
      decorateGeneratedOnlyView();
      $("bankEditor").scrollIntoView({behavior:"smooth",block:"start"});
    }else{
      renderQuestionBank(refreshed);
    }
    const newStatus=$("bankEditor").querySelector("[data-hf-status]");
    if(newStatus){
      newStatus.dataset.state="success";
      newStatus.textContent=result.message+" Provider: "+(result.provider==="grok"?"Grok (xAI)":"OpenRouter")+" / "+result.model+(result.fallback_used?" (automatic fallback used).":".");
    }
  }catch(err){
    status.dataset.state="error";
    status.textContent=err.message;
    button.disabled=false;
    button.textContent="Generate pages";
  }
}

let telemetryRecords=[];
async function loadTelemetry(){
  const status=$("telemetryStatus");
  if(!status)return;
  status.textContent="Loading recent AI generation requests…";
  $("refreshTelemetry").disabled=true;
  try{
    const outcome=$("telemetryOutcome").value;
    const limit=$("telemetryLimit").value;
    const query=new URLSearchParams({limit});
    if(outcome)query.set("outcome",outcome);
    const data=await api("/api/admin/ai-telemetry?"+query.toString());
    telemetryRecords=data.records||[];
    renderTelemetry(telemetryRecords);
    status.textContent="Loaded "+telemetryRecords.length+" telemetry records. Select Details to inspect the full request and provider diagnostics.";
  }catch(err){
    status.textContent="Could not load telemetry: "+err.message;
  }finally{
    $("refreshTelemetry").disabled=false;
  }
}

function renderTelemetry(records){
  const body=$("telemetryRows");
  body.innerHTML="";
  const failed=records.filter(r=>r.outcome==="failed").length;
  const success=records.filter(r=>r.outcome==="success").length;
  const durations=records.map(r=>Number(r.duration_ms)).filter(n=>Number.isFinite(n)&&n>=0);
  $("telemetryTotal").textContent=records.length;
  $("telemetryFailed").textContent=failed;
  $("telemetrySuccess").textContent=success;
  $("telemetryAvg").textContent=durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length/100)/10+" s":"—";
  if(!records.length){
    body.innerHTML='<tr><td colspan="9" class="loading-row">No telemetry records match this filter.</td></tr>';
    return;
  }
  records.forEach((r,index)=>{
    const row=document.createElement("tr");
    const requested=(r.requested_provider||"—")+" / "+(r.requested_model||"—");
    const actual=(r.actual_provider||"—")+" / "+(r.actual_model||"—");
    const values=[
      r.created_at?new Date(r.created_at).toLocaleString():"—",
      r.outcome||"—",requested,actual,
      (r.section||"—")+" / "+(r.page_count??"—")+" requested",
      r.duration_ms==null?"—":(Number(r.duration_ms)/1000).toFixed(1)+" s",
      r.http_status??"—",r.request_id||r.id||"—"
    ];
    values.forEach((value,i)=>{
      const cell=document.createElement("td");
      cell.textContent=String(value);
      if(i===1){cell.style.fontWeight="800";cell.style.color=r.outcome==="failed"?"var(--bad)":r.outcome==="success"?"var(--good)":"var(--warn)";}
      row.appendChild(cell);
    });
    const actionCell=document.createElement("td");
    const button=document.createElement("button");
    button.className="ghost";
    button.textContent="Details";
    button.onclick=()=>{
      $("telemetryDetailJson").textContent=JSON.stringify(r,null,2);
      $("telemetryDetail").classList.remove("hidden");
      $("telemetryDetail").scrollIntoView({behavior:"smooth",block:"start"});
    };
    actionCell.appendChild(button);
    row.appendChild(actionCell);
    body.appendChild(row);
  });
}
$("refreshTelemetry")?.addEventListener("click",loadTelemetry);
$("telemetryOutcome")?.addEventListener("change",loadTelemetry);
$("telemetryLimit")?.addEventListener("change",loadTelemetry);
$("closeTelemetryDetail")?.addEventListener("click",()=>$("telemetryDetail").classList.add("hidden"));


let questionAnalyticsCache=[];
function formatAnalyticsDate(value){
  if(!value)return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":date.toLocaleString();
}
function renderQuestionAnalytics(){
  const section=$("questionAnalyticsSection").value;
  const accuracy=$("questionAnalyticsAccuracy").value;
  const search=$("questionAnalyticsSearch").value.trim().toLowerCase();
  const rows=questionAnalyticsCache.filter(q=>{
    if(section && q.section!==section)return false;
    if(search && !String(q.question_text||"").toLowerCase().includes(search))return false;
    if(accuracy==="unused" && Number(q.appearance_count||0)>0)return false;
    if(accuracy==="low" && (q.correct_percentage==null || q.correct_percentage>=50))return false;
    if(accuracy==="mid" && (q.correct_percentage==null || q.correct_percentage<50 || q.correct_percentage>=80))return false;
    if(accuracy==="high" && (q.correct_percentage==null || q.correct_percentage<80))return false;
    return true;
  });
  const body=$("questionAnalyticsRows");
  body.innerHTML="";
  if(!rows.length){
    body.innerHTML='<tr><td colspan="7" class="loading-row">No questions match these filters.</td></tr>';
    return;
  }
  rows.forEach(q=>{
    const row=document.createElement("tr");
    const values=[
      q.question_text||"Untitled question",
      q.section==="humanities"?"Humanities":"Mathematics & Science",
      formatAnalyticsDate(q.created_at),
      formatAnalyticsDate(q.updated_at||q.created_at),
      Number(q.assessment_count||0),
      Number(q.appearance_count||0),
      q.correct_percentage==null?"Not answered yet":q.correct_percentage+"% ("+Number(q.correct_count||0)+"/"+Number(q.appearance_count||0)+")"
    ];
    values.forEach((value,i)=>{
      const cell=document.createElement("td");
      cell.textContent=String(value);
      if(i===0){cell.style.whiteSpace="normal";cell.style.minWidth="280px";cell.style.maxWidth="520px";}
      if(i===6 && q.correct_percentage!=null){
        cell.style.fontWeight="800";
        cell.style.color=q.correct_percentage<50?"var(--bad)":q.correct_percentage>=80?"var(--good)":"var(--warn)";
      }
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  $("questionAnalyticsStatus").textContent="Showing "+rows.length+" of "+questionAnalyticsCache.length+" bank questions. Accuracy is based on recorded responses; timed-out responses count as incorrect.";
}
async function loadQuestionAnalytics(){
  $("questionAnalyticsStatus").textContent="Loading question analytics…";
  try{
    const data=await api("/api/admin/question-analytics");
    questionAnalyticsCache=data.questions||[];
    const used=questionAnalyticsCache.filter(q=>Number(q.appearance_count||0)>0);
    const responseCount=questionAnalyticsCache.reduce((sum,q)=>sum+Number(q.appearance_count||0),0);
    const correctCount=questionAnalyticsCache.reduce((sum,q)=>sum+Number(q.correct_count||0),0);
    $("questionAnalyticsTotal").textContent=questionAnalyticsCache.length;
    $("questionAnalyticsUsed").textContent=used.length;
    $("questionAnalyticsResponses").textContent=responseCount;
    $("questionAnalyticsAvg").textContent=responseCount?Math.round(correctCount/responseCount*100)+"%":"—";
    renderQuestionAnalytics();
  }catch(err){
    $("questionAnalyticsStatus").textContent="Could not load question analytics: "+err.message;
    $("questionAnalyticsRows").innerHTML='<tr><td colspan="7" class="loading-row">Analytics unavailable.</td></tr>';
  }
}
$("refreshQuestionAnalytics")?.addEventListener("click",loadQuestionAnalytics);
$("questionAnalyticsSection")?.addEventListener("change",renderQuestionAnalytics);
$("questionAnalyticsAccuracy")?.addEventListener("change",renderQuestionAnalytics);
$("questionAnalyticsSearch")?.addEventListener("input",renderQuestionAnalytics);

function timeFlag(response){
  if(response.timed_out)return {label:"Timed out",className:"time-timeout"};
  const seconds=Number(response.response_seconds||0);
  if(seconds<=10)return {label:"Very fast",className:"time-fast"};
  if(seconds<=25)return {label:"On pace",className:"time-good"};
  return {label:"Near limit",className:"time-near"};
}

async function viewResponses(id){
  try{
    const data=await api("/api/admin/attempts/"+id+"/responses");
    const detail=$("detail"),body=$("responseRows");
    detail.classList.remove("hidden");
    body.innerHTML="";
    (data.responses||[]).forEach((r,index)=>{
      const row=document.createElement("tr");
      const selected=r.selected_answer==null?"-":String.fromCharCode(65+r.selected_answer);
      const correct=String.fromCharCode(65+r.correct_answer);
      const elapsed=Number(r.response_seconds||0);
      const flag=timeFlag(r);
      const values=[
        index+1,
        r.question_text||("Question "+r.question_id),
        r.section,selected,correct,
        r.timed_out?"Timed out":r.is_correct?"Correct":"Wrong",
        elapsed.toFixed(1)+"s",flag.label,new Date(r.answered_at).toLocaleString()
      ];
      values.forEach((v,i)=>{
        const c=document.createElement("td");
        c.textContent=v;
        if(i===6||i===7)c.className=i===7?flag.className:flag.className+" time-cell";
        row.appendChild(c);
      });
      body.appendChild(row);
    });
    detail.scrollIntoView({behavior:"smooth"});
  }catch(err){alert(err.message);}
}

checkLogin();