const labels={maths:"Mathematics",numerical:"Numerical Reasoning",verbal:"Verbal Reasoning",reading:"Reading Comprehension"};
let state={questions:[],i:0,selected:null,submitted:false,timer:null,startedAt:0,results:[],sessionId:null,attemptId:null,studentName:""};
const $=id=>document.getElementById(id);
async function api(path,opts={}){const r=await fetch(path,{headers:{"Content-Type":"application/json"},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d}
function show(id){["start","quiz","results"].forEach(x=>$(x).classList.toggle("hidden",x!==id))}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
async function start(){
 clearInterval(state.timer);
 const name=$( "studentName").value.trim();
 if(!name){$("studentName").focus();$("studentName").style.borderColor="#c0394b";return}
 $("studentName").style.borderColor="";
 state.studentName=name;state.sessionId=crypto.randomUUID();state.attemptId=null;state.results=[];
 const year=Number($("yearLevel").value);
 try{
   const d=await api("/api/questions?year="+year);
   state.questions=d.questions;
   if(!state.questions.length)throw Error("No questions were generated");
   const a=await api("/api/attempts",{method:"POST",body:JSON.stringify({session_id:state.sessionId,session_name:name,year_level:String(year),section:"mixed",difficulty:"all",question_count:state.questions.length})});
   state.attemptId=a.id;state.i=0;show("quiz");render();
 }catch(e){console.error(e);alert("The assessment could not start. Please try again.");}
}
function render(){
 clearInterval(state.timer);const q=state.questions[state.i];
 state.selected=null;state.submitted=false;state.startedAt=performance.now();state.remaining=q.time;
 $("sectionLabel").textContent=labels[q.section];$("progress").textContent="Question "+(state.i+1)+" of "+state.questions.length;
 $("bar").style.width=(state.i/state.questions.length*100)+"%";$("tag").textContent=labels[q.section];$("diff").textContent=q.difficulty;
 $("question").textContent=q.q;$("passage").textContent=q.passage||"";$("passage").classList.toggle("hidden",!q.passage);
 $("options").innerHTML="";q.o.forEach((o,i)=>{const b=document.createElement("button");b.className="option";b.type="button";b.innerHTML='<span class="letter">'+String.fromCharCode(65+i)+'</span><span>'+o+'</span>';b.onclick=()=>select(i);$("options").appendChild(b)});
 $("feedback").className="feedback hidden";$("submit").classList.remove("hidden");$("next").classList.add("hidden");tick();state.timer=setInterval(tick,1000);
}
function select(i){if(!state.submitted){state.selected=i;[...$("options").children].forEach((b,j)=>b.classList.toggle("selected",j===i))}}
function tick(){const q=state.questions[state.i],wrap=document.querySelector(".timer");$("timer").textContent=state.remaining;wrap.classList.toggle("warn",state.remaining<=15&&state.remaining>5);wrap.classList.toggle("danger",state.remaining<=5);if(state.remaining<=0)submit(true);else state.remaining--}
async function submit(timeout=false){
 if(state.submitted)return;state.submitted=true;clearInterval(state.timer);
 const q=state.questions[state.i],time=Math.min(q.time,Math.max(0,(performance.now()-state.startedAt)/1000));
 try{
   const d=await api("/api/responses",{method:"POST",body:JSON.stringify({attempt_id:state.attemptId,session_id:state.sessionId,question_id:q.id,selected_answer:state.selected,timed_out:timeout,response_seconds:time})});
   const r={q,selected:state.selected,correct:d.correct,timeout,time,correctAnswer:d.correct_answer,explanation:d.explanation};state.results.push(r);
   [...$("options").children].forEach((b,j)=>{b.disabled=true;if(j===d.correct_answer)b.classList.add("correct");if(state.selected===j&&j!==d.correct_answer)b.classList.add("incorrect")});
   const fb=$("feedback");fb.className="feedback "+(timeout?"timeout":d.correct?"good":"bad");fb.textContent=timeout?"Time’s up. Correct answer: "+String.fromCharCode(65+d.correct_answer)+". "+d.explanation:d.correct?"Correct! "+d.explanation:"Not quite. Correct answer: "+String.fromCharCode(65+d.correct_answer)+". "+d.explanation;
   $("submit").classList.add("hidden");$("next").classList.remove("hidden");$("next").textContent=state.i===state.questions.length-1?"See Results →":"Next Question →";
 }catch(e){state.submitted=false;console.error(e);alert("Your answer could not be recorded. Please try again.");}
}
async function next(){if(!state.submitted)return;if(state.i===state.questions.length-1){await finish();results()}else{state.i++;render()}}
async function finish(){const total=state.results.length,c=state.results.filter(r=>r.correct).length,t=state.results.filter(r=>r.timeout).length,w=total-c-t,avg=total?state.results.reduce((s,r)=>s+r.time,0)/total:0;try{await api("/api/attempts/"+state.attemptId,{method:"PATCH",body:JSON.stringify({completed_at:new Date().toISOString(),score:Math.round(c/total*100),correct_count:c,wrong_count:w,timeout_count:t,average_response_seconds:Number(avg.toFixed(3))})})}catch(e){console.error(e)}}
function practiceAmount(n){return n>=3?{questions:20,minutes:20}:n===2?{questions:15,minutes:15}:{questions:10,minutes:10}}
function results(){
 const total=state.results.length,c=state.results.filter(r=>r.correct).length,t=state.results.filter(r=>r.timeout).length,w=total-c-t,score=Math.round(c/total*100),avg=state.results.reduce((s,r)=>s+r.time,0)/total;
 show("results");$("score").textContent=score+"%";document.querySelector(".score").style.setProperty("--score",score+"%");$("correct").textContent=c;$("wrong").textContent=w;$("timeouts").textContent=t;$("avg").textContent=avg.toFixed(1)+"s";
 $("resultTitle").textContent=score>=80?"Excellent work!":score>=60?"Good progress — keep practising!":"Keep going — speed and accuracy will improve!";
 const by={};state.results.forEach(r=>{by[r.q.section]??={c:0,n:0,t:0};by[r.q.section].n++;by[r.q.section].c+=r.correct?1:0;by[r.q.section].t+=r.time});
 $("breakdown").innerHTML=Object.entries(by).map(([s,x])=>'<div class="row"><span>'+labels[s]+'</span><b>'+x.c+'/'+x.n+'</b><b>'+(x.t/x.n).toFixed(1)+'s avg</b></div>').join("");
 const misses={};state.results.filter(r=>!r.correct).forEach(r=>misses[r.q.section]=(misses[r.q.section]||0)+1);
 const plan=Object.entries(misses).map(([s,n])=>{const p=practiceAmount(n);return '<div class="practice-item"><strong>'+labels[s]+'</strong><span>'+p.questions+' questions · about '+p.minutes+' min</span></div>'}).join("");
 $("practiceSummary").innerHTML=plan||'<div class="practice-empty"><strong>Great job!</strong><p>No clear weak area was identified in this attempt.</p></div>';
}
function newSession(){clearInterval(state.timer);state.sessionId=null;state.attemptId=null;state.results=[];show("start");window.scrollTo({top:0,behavior:"smooth"})}
$("startBtn").onclick=start;$("submit").onclick=()=>submit(false);$("next").onclick=next;$("retry").onclick=start;$("newSession").onclick=newSession;
