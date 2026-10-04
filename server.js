const express=require("express");
const path=require("path");
const crypto=require("crypto");
const {createClient}=require("@supabase/supabase-js");

const app=express();
app.use(express.json({limit:"100kb"}));
app.use(express.static(path.join(__dirname,"public")));

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase=(url&&key)?createClient(url,key):null;
const adminEmail=process.env.ADMIN_EMAIL;
const adminPassword=process.env.ADMIN_PASSWORD;
const cookieName="hendersons_admin";

function signSession(payload){const body=Buffer.from(JSON.stringify(payload)).toString("base64url");const sig=crypto.createHmac("sha256",adminPassword||"missing-admin-password").update(body).digest("base64url");return body+"."+sig;}
function verifySession(req){if(!adminPassword)return false;const match=(req.headers.cookie||"").match(new RegExp("(^|;\\s*)"+cookieName+"=([^;]+)"));if(!match)return false;const [body,sig]=match[2].split(".");if(!body||!sig)return false;const expected=crypto.createHmac("sha256",adminPassword).update(body).digest("base64url");if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;try{return JSON.parse(Buffer.from(body,"base64url").toString("utf8")).exp>Date.now();}catch{return false;}}
function requireAdmin(req,res,next){if(!verifySession(req))return res.status(401).json({error:"Admin login required"});next();}

function clientIp(req){return (req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").toString().split(",")[0].trim()}
function ipHash(req){return crypto.createHash("sha256").update((process.env.QUESTION_IP_SALT||"quiz-question-salt")+"|"+clientIp(req)).digest("hex")}
function rand(n){return Math.floor(Math.random()*n)}
function pick(a){return a[rand(a.length)]}
function shuffle(a){return [...a].sort(()=>Math.random()-0.5)}
function generatedId(q){return crypto.createHash("sha256").update(JSON.stringify([q.year_level,q.section,q.question_text,q.answer_options])).digest("hex").slice(0,24)}
function makeQuestion(year){
  const y=Math.max(5,Math.min(10,Number(year)||7));
  const level=y<=6?"primary":y<=8?"middle":"secondary";
  const out=[];
  const add=(section,difficulty,time,q,o,a,e)=>out.push({section,difficulty,time,question_text:q,answer_options:o,correct_answer:a,explanation:e});
  const n=pick([6,7,8,9,11,12,14,15,16,18,21,24]);
  const step=pick([2,3,4,5,6]);
  if(rand(4)===0){
    const start=pick([3,5,7,9,12]), mult=pick([2,2,2,3]);
    const terms=[start];for(let i=1;i<5;i++)terms.push(terms[i-1]*mult+step);
    const ans=terms[4]*mult+step, opts=shuffle([ans,ans-step,ans+step,ans+mult,ans+step*2]);
    add("numerical",level==="secondary"?"hard":"medium",50,"Find the next number: "+terms.join(", ")+", ?",opts,opts.indexOf(ans),"Look for the repeated rule connecting each term to the next.");
  } else if(rand(3)===0){
    const price=pick([24,30,36,45,50,60]), pct=pick([10,15,20,25]);
    const ans=price*(100-pct)/100, opts=shuffle([ans,ans+price*.05,ans-price*.05,ans+price*.1,ans+price*.2]);
    add("maths","medium",60,"A $"+price+" item is reduced by "+pct+"%. What is the new price?",opts,opts.indexOf(ans),"Find the percentage reduction, then subtract it from the original price.");
  } else if(rand(2)===0){
    const a=pick([3,4,5,6,7]), b=pick([2,3,4,5]), ans=a*b;
    const opts=shuffle([ans,ans+a,ans-b,ans+b,ans*2]);
    add("maths",y>=9?"hard":"medium",60,"A rectangle is "+a+" cm long and "+b+" cm wide. What is its area?",opts,opts.indexOf(ans),"Area of a rectangle is length × width.");
  } else {
    const words=[["brief","concise"],["rapid","quick"],["ancient","old"],["silent","quiet"],["generous","giving"]];
    const pair=pick(words), wrong=shuffle(words.filter(x=>x[0]!==pair[0]).map(x=>x[1])).slice(0,4);
    const opts=shuffle([pair[1],...wrong]), ans=opts.indexOf(pair[1]);
    add("verbal","medium",50,"Which word is closest in meaning to '"+pair[0]+"'?",opts,ans,"The correct answer is the synonym with the closest meaning.");
  }
  return out[0];
}
async function generateQuestions(req,year,count=20){
  if(!supabase)return [];
  const hash=ipHash(req);
  const used=await supabase.from("generated_questions").select("id").eq("ip_hash",hash);
  const usedIds=new Set((used.data||[]).map(x=>x.id));
  const made=[];let attempts=0;
  while(made.length<count&&attempts<count*20){
    attempts++;
    const q=makeQuestion(year);
    q.year_level=String(year);q.id=generatedId(q);
    if(usedIds.has(q.id)||made.some(x=>x.id===q.id))continue;
    q.ip_hash=hash;q.session_id=req.body&&req.body.session_id?req.body.session_id:null;
    const {error}=await supabase.from("generated_questions").insert(q);
    if(error)continue;
    made.push(q);usedIds.add(q.id);
  }
  return made;
}
app.get("/health",(req,res)=>res.json({ok:true,supabaseConfigured:Boolean(supabase)}));
app.post("/api/admin/login",(req,res)=>{if(!adminEmail||!adminPassword)return res.status(503).json({error:"Admin login is not configured"});const {email,password}=req.body||{};if(email!==adminEmail||password!==adminPassword)return res.status(401).json({error:"Incorrect email or password"});const token=signSession({email,exp:Date.now()+8*60*60*1000});res.setHeader("Set-Cookie",cookieName+"="+token+"; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800");res.json({ok:true});});
app.post("/api/admin/logout",(req,res)=>{res.setHeader("Set-Cookie",cookieName+"=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");res.json({ok:true});});
app.get("/api/admin/me",requireAdmin,(req,res)=>res.json({ok:true}));
app.get("/api/admin/attempts",requireAdmin,async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const {data,error}=await supabase.from("quiz_attempts").select("*").order("started_at",{ascending:false}).limit(500);if(error)return res.status(400).json({error:error.message});res.json({attempts:data||[]});});
app.get("/api/admin/attempts/:id/responses",requireAdmin,async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const {data,error}=await supabase.from("quiz_responses").select("*").eq("attempt_id",req.params.id).order("answered_at",{ascending:true});if(error)return res.status(400).json({error:error.message});res.json({responses:data||[]});});

app.get("/api/questions",async(req,res)=>{try{const year=Number(req.query.year);if(!Number.isInteger(year)||year<5||year>10)return res.status(400).json({error:"Year level must be 5 to 10"});const questions=await generateQuestions(req,year,20);if(questions.length<20)return res.status(503).json({error:"Could not generate enough fresh questions"});res.json({questions:questions.map(q=>({id:q.id,section:q.section,difficulty:q.difficulty,time:q.time,q:q.question_text,o:q.answer_options}))});}catch(e){console.error(e);res.status(500).json({error:"Question generation failed"})}});
app.post("/api/attempts",async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const {session_id,session_name,year_level,section,difficulty,question_count}=req.body;const {data,error}=await supabase.from("quiz_attempts").insert({session_id,session_name,year_level,section,difficulty,question_count}).select("id").single();if(error)return res.status(400).json({error:error.message});res.json({id:data.id});});
app.post("/api/responses",async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const {attempt_id,session_id,question_id,selected_answer,timed_out,response_seconds}=req.body||{};const {data:q,error:qerr}=await supabase.from("generated_questions").select("*").eq("id",question_id).eq("session_id",session_id).single();if(qerr||!q)return res.status(400).json({error:"Question not found"});const correct=!timed_out&&Number(selected_answer)===q.correct_answer;const {error}=await supabase.from("quiz_responses").insert({attempt_id,session_id,question_id,section:q.section,difficulty:q.difficulty,selected_answer:selected_answer??null,correct_answer:q.correct_answer,is_correct:correct,timed_out:Boolean(timed_out),response_seconds:Number(response_seconds||0),question_text:q.question_text,answer_options:q.answer_options});if(error)return res.status(400).json({error:error.message});res.status(201).json({ok:true,correct,correct_answer:q.correct_answer,explanation:q.explanation});});
app.patch("/api/attempts/:id",async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const {error}=await supabase.from("quiz_attempts").update(req.body).eq("id",req.params.id);if(error)return res.status(400).json({error:error.message});res.json({ok:true});});
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
const port=process.env.PORT||10000;app.listen(port,()=>console.log("Hendersons app listening on "+port));
