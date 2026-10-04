import { computed, onBeforeUnmount, ref } from "vue";

export function useQuiz() {
  const labels = { maths:"Mathematics", numerical:"Quantitative / Numerical Reasoning", reading:"Reading", verbal:"Verbal Reasoning" };
  const blocks = [
    { label:"Mathematics + Quantitative Reasoning", start:0, end:119, duration:3600 },
    { label:"Reading + Verbal Reasoning", start:120, end:229, duration:3300 }
  ];
  const totalQuestions = 230;

  const screen=ref("start"), studentName=ref(""), startError=ref(""), starting=ref(false);
  const sessionId=ref(""), attemptId=ref(""), questions=ref([]), questionIndex=ref(0);
  const answers=ref(Array(totalQuestions).fill(null)), skipped=ref(Array(totalQuestions).fill(false));
  const timeSpent=ref(Array(totalQuestions).fill(0)), outcomes=ref(Array(totalQuestions).fill(null));
  const savedResponses=ref(new Set()), remaining=ref(0), generatingQuestions=ref(false);

  let timerHandle=null, pollHandle=null, questionStartedAt=0;

  const currentQuestion=computed(()=>questions.value[questionIndex.value]||null);
  const blockIndex=computed(()=>questionIndex.value<120?0:1);
  const currentBlock=computed(()=>blocks[blockIndex.value]);
  const blockLabel=computed(()=>currentBlock.value.label);
  const subsectionLabel=computed(()=>labels[currentQuestion.value?.section]||"");
  const progressPercent=computed(()=>((questionIndex.value+1)/totalQuestions)*100);
  const availableBlockIndexes=computed(()=>{
    const end=Math.min(currentBlock.value.end,questions.value.length-1);
    if(end<currentBlock.value.start)return [];
    return Array.from({length:end-currentBlock.value.start+1},(_,i)=>currentBlock.value.start+i);
  });

  const sectionRanges={numerical:[0,59],maths:[60,119],reading:[120,174],verbal:[175,229]};
  const resultStats=computed(()=>{
    const answered=answers.value.filter(v=>v!==null).length;
    const correct=outcomes.value.filter(v=>v===true).length;
    const skippedCount=totalQuestions-answered;
    const incorrect=answered-correct;
    const totalTime=timeSpent.value.reduce((a,b)=>a+b,0);
    const average=answered?totalTime/answered:0;
    const breakdown=Object.entries(sectionRanges).map(([section,[start,end]])=>{
      let a=0,c=0,t=0;
      for(let i=start;i<=end;i++){if(answers.value[i]!==null)a++;if(outcomes.value[i]===true)c++;t+=timeSpent.value[i];}
      return {section,label:labels[section],correct:c,total:end-start+1,answered:a,average:a?(t/a).toFixed(1):"0.0"};
    });
    return {score:Math.round(correct/totalQuestions*100),correct,incorrect,skipped:skippedCount,timeouts:0,averageTime:average.toFixed(1),breakdown};
  });

  const resultTitle=computed(()=>resultStats.value.score>=80?"Excellent work!":resultStats.value.score>=60?"Good progress — keep practising!":"Keep going — speed and accuracy will improve.");

  async function api(path,options={}){
    const r=await fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
    const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.error||"Request failed"); return d;
  }
  function clearTimer(){if(timerHandle)clearInterval(timerHandle);timerHandle=null;}
  function clearPoll(){if(pollHandle)clearInterval(pollHandle);pollHandle=null;}
  function addTime(){if(!currentQuestion.value||!questionStartedAt)return;timeSpent.value[questionIndex.value]+=Math.max(0,(performance.now()-questionStartedAt)/1000);questionStartedAt=performance.now();}
  function loadQuestion(){questionStartedAt=performance.now();}

  async function saveCurrent(){
    const i=questionIndex.value,a=answers.value[i];
    if(a===null||savedResponses.value.has(i))return true;
    try{
      const r=await api("/api/responses",{method:"POST",body:JSON.stringify({
        attempt_id:attemptId.value,session_id:sessionId.value,question_id:questions.value[i].id,
        selected_answer:a,timed_out:false,response_seconds:timeSpent.value[i]
      })});
      outcomes.value[i]=!!r.correct;savedResponses.value.add(i);return true;
    }catch(e){console.error(e);return false;}
  }

  async function refreshQuestions(){
    if(!sessionId.value)return;
    try{
      const r=await api("/api/questions?year=9&session_id="+encodeURIComponent(sessionId.value));
      if(Array.isArray(r.questions)){if(r.questions.length>questions.value.length)questions.value=r.questions;generatingQuestions.value=r.questions.length<totalQuestions;if(r.ready)clearPoll();}
    }catch(e){console.error("Question polling failed",e);}
  }
  function startPolling(){clearPoll();if(questions.value.length>=totalQuestions)return;generatingQuestions.value=true;pollHandle=setInterval(refreshQuestions,1500);}

  async function waitForIndex(i){
    for(let n=0;n<30;n++){if(questions.value.length>i)return;await refreshQuestions();if(questions.value.length>i)return;await new Promise(r=>setTimeout(r,500));}
  }

  async function startTest(){
    const name=studentName.value.trim();if(!name){startError.value="Please enter the student's name.";return;}
    startError.value="";starting.value=true;clearTimer();
    try{
      sessionId.value=crypto.randomUUID();
      const r=await api("/api/questions?year=9&session_id="+encodeURIComponent(sessionId.value));
      if(!r.questions||r.questions.length<10)throw new Error("Could not generate the first 10 questions.");
      const attempt=await api("/api/attempts",{method:"POST",body:JSON.stringify({session_id:sessionId.value,session_name:name,year_level:"9",section:"quantitative + mathematics, then reading + verbal",difficulty:"all",question_count:totalQuestions})});
      attemptId.value=attempt.id;questions.value=r.questions;questionIndex.value=0;
      answers.value=Array(totalQuestions).fill(null);skipped.value=Array(totalQuestions).fill(false);
      timeSpent.value=Array(totalQuestions).fill(0);outcomes.value=Array(totalQuestions).fill(null);savedResponses.value=new Set();
      screen.value="quiz";startBlockTimer(blocks[0].duration);loadQuestion();startPolling();
    }catch(e){console.error(e);startError.value="The test could not start. Please try again.";}
    finally{starting.value=false;}
  }

  function startBlockTimer(seconds){
    clearTimer();remaining.value=seconds;
    timerHandle=setInterval(()=>{if(remaining.value<=1){remaining.value=0;handleBlockExpiry();}else remaining.value--;},1000);
  }

  async function handleBlockExpiry(){
    clearTimer();addTime();await saveCurrent();
    if(blockIndex.value===0){
      questionIndex.value=120;await waitForIndex(120);startBlockTimer(3300);loadQuestion();
    }else{await submitTest();}
  }

  function selectAnswer(i){if(savedResponses.value.has(questionIndex.value))return;answers.value[questionIndex.value]=i;skipped.value[questionIndex.value]=false;}
  async function moveTo(i){
    addTime();const ok=await saveCurrent();if(!ok&&answers.value[questionIndex.value]!==null)return false;
    questionIndex.value=i;loadQuestion();return true;
  }

  async function nextQuestion(){
    const i=questionIndex.value;
    if(answers.value[i]===null)return;
    if(!(await moveTo(i)))return;
    if(i===totalQuestions-1){await submitTest();return;}
    if(i===currentBlock.value.end){
      questionIndex.value=120;await waitForIndex(120);startBlockTimer(3300);loadQuestion();return;
    }
    const next=i+1;await waitForIndex(next);questionIndex.value=next;loadQuestion();
  }

  async function skipQuestion(){
    const i=questionIndex.value;if(answers.value[i]!==null)return;
    addTime();skipped.value[i]=true;
    if(i===totalQuestions-1){await submitTest();return;}
    if(i===currentBlock.value.end){
      questionIndex.value=120;await waitForIndex(120);startBlockTimer(3300);loadQuestion();return;
    }
    const next=i+1;await waitForIndex(next);questionIndex.value=next;loadQuestion();
  }

  async function previousQuestion(){
    const i=questionIndex.value;if(i===currentBlock.value.start)return;
    await moveTo(i-1);
  }

  async function navigateTo(i){
    if(i<currentBlock.value.start||i>currentBlock.value.end||i>=questions.value.length)return;
    await moveTo(i);
  }

  async function submitTest(){
    if(screen.value!=="quiz")return;
    addTime();await saveCurrent();clearTimer();clearPoll();
    const s=resultStats.value;
    try{await api("/api/attempts/"+attemptId.value,{method:"PATCH",body:JSON.stringify({completed_at:new Date().toISOString(),score:s.score,correct_count:s.correct,wrong_count:s.incorrect,timeout_count:0,average_response_seconds:Number(s.averageTime),session_id:sessionId.value})});}catch(e){console.error(e);}
    screen.value="results";
  }

  function reset(){clearTimer();clearPoll();screen.value="start";questions.value=[];questionIndex.value=0;answers.value=Array(totalQuestions).fill(null);skipped.value=Array(totalQuestions).fill(false);timeSpent.value=Array(totalQuestions).fill(0);outcomes.value=Array(totalQuestions).fill(null);savedResponses.value=new Set();remaining.value=0;sessionId.value="";attemptId.value="";startError.value="";}

  onBeforeUnmount(()=>{clearTimer();clearPoll();});
  return {labels,blocks,totalQuestions,screen,studentName,startError,starting,questions,questionIndex,answers,skipped,remaining,generatingQuestions,currentQuestion,blockIndex,blockLabel,subsectionLabel,progressPercent,availableBlockIndexes,resultStats,resultTitle,startTest,selectAnswer,nextQuestion,skipQuestion,previousQuestion,navigateTo,submitTest};
}