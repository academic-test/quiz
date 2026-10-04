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

function signSession(payload){const body=Buffer.from(JSON.stringify(payload)).toString("base64url");const sig=crypto.createHmac("sha256",adminPassword||"missing-admin-password").update(body).digest("base64url");return body+"."+sig}
function verifySession(req){if(!adminPassword)return false;const match=(req.headers.cookie||"").match(new RegExp("(^|;\\s*)"+cookieName+"=([^;]+)"));if(!match)return false;const [body,sig]=match[2].split(".");if(!body||!sig)return false;const expected=crypto.createHmac("sha256",adminPassword).update(body).digest("base64url");if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;try{return JSON.parse(Buffer.from(body,"base64url").toString("utf8")).exp>Date.now()}catch{return false}}
function requireAdmin(req,res,next){if(!verifySession(req))return res.status(401).json({error:"Admin login required"});next()}

function clientIp(req){return (req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").toString().split(",")[0].trim()}
function ipHash(req){return crypto.createHash("sha256").update((process.env.QUESTION_IP_SALT||"quiz-question-salt")+"|"+clientIp(req)).digest("hex")}
function rand(n){return Math.floor(Math.random()*n)}
function pick(a){return a[rand(a.length)]}
function shuffle(a){return [...a].sort(()=>Math.random()-0.5)}
function uuidLike(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""))}
function generatedId(q){return crypto.createHash("sha256").update(JSON.stringify([q.year_level,q.section,q.question_text,q.answer_options,q.correct_answer])).digest("hex").slice(0,24)}
function optionsWithAnswer(answer,distractors){const vals=[answer,...distractors].map(String);const uniq=[];for(const v of vals)if(!uniq.includes(v))uniq.push(v);while(uniq.length<4)uniq.push(String(Number(answer)+uniq.length*3+1));const o=shuffle(uniq.slice(0,4));return {o,a:o.indexOf(String(answer))}}
function money(n){return "$"+Number(n).toFixed(2)}
function makeMath(){const t=rand(6);
 if(t===0){const a=pick([3,4,5,6,7,8]),x=pick([4,5,6,7,8,9]),b=pick([3,5,7,9,11]),c=a*x+b,res=optionsWithAnswer(x,[x-2,x+2,x+3,x+5]);return {section:"maths",difficulty:"hard",time:65,question_text:"Solve for x: "+a+"x + "+b+" = "+c+".",answer_options:res.o,correct_answer:res.a,explanation:"Subtract "+b+" from both sides, then divide by "+a+"."}}
 if(t===1){const price=pick([80,90,120,150,180,240]),pct=pick([10,15,20,25,30]),ans=price*(1-pct/100),res=optionsWithAnswer(money(ans),[money(ans+price*.05),money(ans-price*.05),money(price*(1-pct/200)),money(price*(1+pct/100))]);return {section:"maths",difficulty:"medium",time:60,question_text:"A jacket costs "+money(price)+" and is reduced by "+pct+"%. What is the sale price?",answer_options:res.o,correct_answer:res.a,explanation:"Calculate "+pct+"% of the original price and subtract it."}}
 if(t===2){const l=pick([7,8,9,10,11,12]),w=pick([4,5,6,7]),ans=l*w,res=optionsWithAnswer(ans,[ans+l,ans-w,2*(l+w),ans+w]);return {section:"maths",difficulty:"medium",time:55,question_text:"A rectangle is "+l+" cm long and "+w+" cm wide. What is its area?",answer_options:res.o,correct_answer:res.a,explanation:"Area of a rectangle = length × width."}}
 if(t===3){const base=pick([8,9,10,12]),height=pick([5,6,7,8]),ans=base*height/2,res=optionsWithAnswer(ans,[base*height,ans+base,ans-height,base+height]);return {section:"maths",difficulty:"medium",time:60,question_text:"A triangle has a base of "+base+" cm and a height of "+height+" cm. What is its area?",answer_options:res.o,correct_answer:res.a,explanation:"Triangle area = 1/2 × base × height."}}
 if(t===4){const n=pick([4,5,6,7,8]),y=pick([-3,-1,2,4]),m=pick([2,3,4]),ans=m*n+y,res=optionsWithAnswer(ans,[m*n-y,m+n+y,ans+m,ans-m]);return {section:"maths",difficulty:"hard",time:60,question_text:"If y = "+m+"x "+(y>=0?"+ "+y:"− "+Math.abs(y))+", what is y when x = "+n+"?",answer_options:res.o,correct_answer:res.a,explanation:"Substitute x = "+n+" into the formula."}}
 const parts=pick([[2,3,4],[3,4,5],[2,4,5],[3,5,7]]),total=360,sum=parts.reduce((a,b)=>a+b,0),ans=total*parts[2]/sum,res=optionsWithAnswer(ans,[total*parts[0]/sum,total*parts[1]/sum,90,120]);return {section:"maths",difficulty:"hard",time:65,question_text:"The angles of a quadrilateral are in the ratio "+parts.join(":")+". What is the largest angle?",answer_options:res.o,correct_answer:res.a,explanation:"Angles in a quadrilateral total 360°, so find the value of one ratio part and multiply by the largest part."}}
function makeNumerical(){const t=rand(6);
 if(t===0){const start=pick([4,5,7,9,12]),step=pick([3,4,5,6]),terms=[start];for(let i=1;i<5;i++)terms.push(terms[i-1]+step);const ans=terms[4]+step,res=optionsWithAnswer(ans,[ans-step,ans+step*2,ans+step*3,ans-2]);return {section:"numerical",difficulty:"medium",time:50,question_text:"Find the next number: "+terms.join(", ")+", ?",answer_options:res.o,correct_answer:res.a,explanation:"Each term increases by "+step+"."}}
 if(t===1){const avg=pick([14,16,18,20,22]),known=[avg-5,avg-2,avg+1,avg+4],ans=avg*5-known.reduce((a,b)=>a+b,0),res=optionsWithAnswer(ans,[ans-2,ans+2,ans+4,avg]);return {section:"numerical",difficulty:"medium",time:55,question_text:"The average of five numbers is "+avg+". Four numbers are "+known.join(", ")+". What is the fifth number?",answer_options:res.o,correct_answer:res.a,explanation:"Total = average × 5. Subtract the four known values."}}
 if(t===2){const speed=pick([48,54,60,72]),hours=pick([1.5,2,2.5,3]),dist=speed*hours,res=optionsWithAnswer(speed,[speed-6,speed+6,speed*2,speed/2]);return {section:"numerical",difficulty:"hard",time:60,question_text:"A cyclist travels "+dist+" km in "+hours+" hours. What is the average speed?",answer_options:res.o,correct_answer:res.a,explanation:"Average speed = distance ÷ time."}}
 if(t===3){const a=pick([2,3,4,5]),b=pick([3,4,5,6]),total=a+b,students=total*pick([4,5,6]),girls=b*students/total,res=optionsWithAnswer(girls,[students-girls,girls+a,girls-b,girls+5]);return {section:"numerical",difficulty:"hard",time:60,question_text:"In a class, boys:girls = "+a+":"+b+". If there are "+students+" students, how many are girls?",answer_options:res.o,correct_answer:res.a,explanation:"There are "+total+" equal parts. Each part contains "+students/total+" students."}}
 if(t===4){const original=pick([80,100,120,160,200]),pct=pick([10,15,20,25]),ans=original*(1+pct/100),res=optionsWithAnswer(money(ans),[money(original-pct),money(original*(1-pct/100)),money(ans+10),money(ans-10)]);return {section:"numerical",difficulty:"medium",time:55,question_text:"A value of "+money(original)+" increases by "+pct+"%. What is the new value?",answer_options:res.o,correct_answer:res.a,explanation:"Increase the original by "+pct+"% of itself."}}
 const startHour=pick([8,9,10,11]),startMin=pick([5,15,25,35]),dur=pick([75,95,110,125]),base=startHour*60+startMin+dur,h=base%1440,display=((Math.floor(h/60)+11)%12+1)+":"+String(h%60).padStart(2,"0")+" "+(h>=720?"pm":"am");const wrong=[5,10,15].map(x=>{const z=h+x;return ((Math.floor((z%1440)/60)+11)%12+1)+":"+String(z%60).padStart(2,"0")+" "+(z%1440>=720?"pm":"am")});return {section:"numerical",difficulty:"medium",time:55,question_text:"A lesson starts at "+String(startHour).padStart(2,"0")+":"+String(startMin).padStart(2,"0")+" and lasts "+dur+" minutes. What time does it finish?",answer_options:[display,...shuffle(wrong)],correct_answer:0,explanation:"Add the duration in minutes to the starting time."}}
function makeVerbal(){const t=rand(6);
 if(t===0){const pairs=[[["brief","concise"],"concise"],[["rapid","swift"],"swift"],[["accurate","precise"],"precise"],[["cautious","careful"],"careful"],[["observe","notice"],"notice"]],p=pick(pairs),res=optionsWithAnswer(p[1],[pick(["noisy","ancient","fragile","distant"]),pick(["careless","silent","narrow","hostile"]),pick(["lengthy","ordinary","complex","generous"])]);return {section:"verbal",difficulty:"medium",time:50,question_text:"Which word is closest in meaning to '"+p[0][0]+"'?",answer_options:res.o,correct_answer:res.a,explanation:"The closest synonym is '"+p[1]+"'."}}
 if(t===1){const pairs=[["reluctant","eager"],["ancient","modern"],["scarce","abundant"],["temporary","permanent"],["expand","contract"]],p=pick(pairs),res=optionsWithAnswer(p[1],[p[0],"fragile","curious","silent"]);return {section:"verbal",difficulty:"medium",time:50,question_text:"Which word is most nearly opposite in meaning to '"+p[0]+"'",answer_options:res.o,correct_answer:res.a,explanation:"The opposite of '"+p[0]+"' is '"+p[1]+"'."}}
 if(t===2){const pairs=[["SCULPTOR","STATUE","CARTOGRAPHER","MAP"],["AUTHOR","BOOK","COMPOSER","MUSIC"],["ARCHITECT","BUILDING","CHEF","MEAL"],["PAINTER","PORTRAIT","PHOTOGRAPHER","PHOTO"]],p=pick(pairs),res=optionsWithAnswer(p[3],[p[2],"journey","tool","theatre"]);return {section:"verbal",difficulty:"hard",time:55,question_text:p[0]+" is to "+p[1]+" as "+p[2]+" is to:",answer_options:res.o,correct_answer:res.a,explanation:"The first pair shows a creator and what that creator produces."}}
 if(t===3){const groups=[["generous","charitable","benevolent","selfish"],["rapid","swift","brisk","sluggish"],["fragile","delicate","breakable","durable"],["silent","quiet","soundless","noisy"]],g=pick(groups),odd=g[3],res=optionsWithAnswer(odd,g.slice(0,3));return {section:"verbal",difficulty:"medium",time:50,question_text:"Which word is the odd one out?",answer_options:res.o,correct_answer:res.a,explanation:"The other three share a closer meaning or characteristic."}}
 if(t===4){const code=[["nems","tavs","lorps"],["daxs","mivs","sorns"],["pels","rins","vorts"]],c=pick(code),res=optionsWithAnswer(c[1],["small","large","yellow","round"]);return {section:"verbal",difficulty:"hard",time:60,question_text:"If all '"+c[0]+"' are '"+c[1]+"' and no '"+c[1]+"' are '"+c[2]+"', which statement must be true?",answer_options:[ "No "+c[0]+" are "+c[2], "All "+c[2]+" are "+c[0], "Some "+c[1]+" are "+c[2], "All "+c[0]+" are "+c[2] ],correct_answer:0,explanation:"Anything that is a '"+c[0]+"' must be a '"+c[1]+"', and no '"+c[1]+"' can be a '"+c[2]+"'."}}
 const contexts=[["The engineer remained ___ when the first model failed.", "composed"],["The witness gave a ___ account of the events, avoiding unnecessary detail.", "succinct"],["The student made a ___ decision after considering the evidence carefully.", "prudent"],["The explanation was ___ enough to be accepted by the panel.", "plausible"]],p=pick(contexts),res=optionsWithAnswer(p[1],["reckless","fragile","hostile","lengthy"]);return {section:"verbal",difficulty:"medium",time:50,question_text:p[0],answer_options:res.o,correct_answer:res.a,explanation:"The context requires the word '"+p[1]+"'. "}}
function makeReading(){const data=[
 ["Nadia compared two maps of her town. The newer map showed a footbridge that did not appear on the older map. She became curious about when the bridge had been built.","What prompted Nadia's curiosity?","The bridge appeared only on the newer map.",["The maps were the same.","The bridge appeared only on the newer map.","The town had moved.","She lost one map."]],
 ["The school garden began as a bare patch beside the library. Students planted herbs and native flowers. Months later, bees returned and the science teacher began using the garden during lessons.","What is the main idea?","Students transformed an unused area into a useful garden.",["The library was moved.","Bees damaged the garden.","Students transformed an unused area into a useful garden.","The science teacher stopped teaching."]],
 ["When the microphone failed during Leo's presentation, he moved closer to the audience and continued. His voice became steadier as he went on.","What can be inferred about Leo?","He adapted when something unexpected went wrong.",["He had forgotten the topic.","He adapted when something unexpected went wrong.","He refused to continue.","He was not prepared."]],
 ["A council planned to remove several trees to widen a road. After examining traffic data, it changed the design so that fewer trees were removed.","Why did the council change the plan?","New evidence influenced the decision.",["The road was cancelled.","New evidence influenced the decision.","The trees disappeared.","The residents left town."]],
 ["Mia kept a notebook beside her bed. Whenever an idea came to her, she wrote it down. Months later, she used several notes while planning a project.","What was the main benefit of the notebook?","It helped Mia preserve ideas for later use.",["It helped her sleep.","It replaced her textbooks.","It helped Mia preserve ideas for later use.","It made her work faster."]],
 ["The ranger noticed small tracks crossing a quiet beach. She placed signs asking visitors to keep away from the dunes.","What was the most likely purpose of the signs?","To protect an area where wildlife was active.",["To advertise the beach.","To protect an area where wildlife was active.","To show the shortest route.","To stop the tide."]]
];const p=pick(data),res=optionsWithAnswer(p[2],p[3].filter(x=>x!==p[2]));return {section:"reading",difficulty:pick(["medium","hard"]),time:80,question_text:p[1],passage:p[0],answer_options:res.o,correct_answer:res.a,explanation:"The passage provides the evidence needed to choose the best answer."}}
function makeQuestion(section){if(section==="maths")return makeMath();if(section==="numerical")return makeNumerical();if(section==="verbal")return makeVerbal();return makeReading()}
async function generateQuestions(req,year,count,sessionId){
 if(!supabase)return [];
 const hash=ipHash(req);
 const used=await supabase.from("generated_questions").select("id").eq("ip_hash",hash);
 const usedIds=new Set((used.data||[]).map(x=>x.id));
 const made=[];let attempts=0;
 const sections=shuffle(["maths","numerical","verbal","reading"]);
 while(made.length<count&&attempts<count*30){
   attempts++;
   const section=sections[made.length%sections.length];
   const q=makeQuestion(section);
   q.year_level=String(year);q.id=generatedId(q);q.ip_hash=hash;q.session_id=sessionId;
   if(usedIds.has(q.id)||made.some(x=>x.id===q.id))continue;
   const {error}=await supabase.from("generated_questions").insert(q);
   if(error)continue;
   made.push(q);usedIds.add(q.id);
 }
 return made;
}

app.get("/health",(req,res)=>res.json({ok:true,supabaseConfigured:Boolean(supabase)}));
app.post("/api/admin/login",(req,res)=>{if(!adminEmail||!adminPassword)return res.status(503).json({error:"Admin login is not configured"});const {email,password}=req.body||{};if(email!==adminEmail||password!==adminPassword)return res.status(401).json({error:"Incorrect email or password"});const token=signSession({email,exp:Date.now()+8*60*60*1000});res.setHeader("Set-Cookie",cookieName+"="+token+"; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800");res.json({ok:true})});
app.post("/api/admin/logout",(req,res)=>{res.setHeader("Set-Cookie",cookieName+"=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");res.json({ok:true})});
app.get("/api/admin/me",requireAdmin,(req,res)=>res.json({ok:true}));
app.get("/api/admin/attempts",requireAdmin,async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const {data,error}=await supabase.from("quiz_attempts").select("*").order("started_at",{ascending:false}).limit(500);if(error)return res.status(400).json({error:error.message});res.json({attempts:data||[]})});
app.get("/api/admin/attempts/:id/responses",requireAdmin,async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const {data,error}=await supabase.from("quiz_responses").select("*").eq("attempt_id",req.params.id).order("answered_at",{ascending:true});if(error)return res.status(400).json({error:error.message});res.json({responses:data||[]})});

app.get("/api/questions",async(req,res)=>{
 try{
   const year=Number(req.query.year),sessionId=String(req.query.session_id||"");
   if(year!==9)return res.status(400).json({error:"Only Year 9 is available"});
   if(!uuidLike(sessionId))return res.status(400).json({error:"Valid session_id is required"});
   const questions=await generateQuestions(req,9,20,sessionId);
   if(questions.length<20)return res.status(503).json({error:"Could not generate enough fresh questions"});
   res.json({questions:questions.map(q=>({id:q.id,section:q.section,difficulty:q.difficulty,time:q.time,q:q.question_text,o:q.answer_options,passage:q.passage||""}))});
 }catch(e){console.error(e);res.status(500).json({error:"Question generation failed"})}
});
app.post("/api/attempts",async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const {session_id,session_name,year_level,section,difficulty,question_count}=req.body||{};if(!uuidLike(session_id))return res.status(400).json({error:"Valid session_id is required"});const {data,error}=await supabase.from("quiz_attempts").insert({session_id,session_name,year_level,section,difficulty,question_count}).select("id").single();if(error)return res.status(400).json({error:error.message});res.json({id:data.id})});
app.post("/api/responses",async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const {attempt_id,session_id,question_id,selected_answer,timed_out,response_seconds}=req.body||{};const {data:q,error:qerr}=await supabase.from("generated_questions").select("*").eq("id",question_id).eq("session_id",session_id).single();if(qerr||!q)return res.status(400).json({error:"Question not found"});const correct=!timed_out&&Number(selected_answer)===q.correct_answer;const {error}=await supabase.from("quiz_responses").insert({attempt_id,session_id,question_id,section:q.section,difficulty:q.difficulty,selected_answer:selected_answer??null,correct_answer:q.correct_answer,is_correct:correct,timed_out:Boolean(timed_out),response_seconds:Number(response_seconds||0),question_text:q.question_text,answer_options:q.answer_options});if(error)return res.status(400).json({error:error.message});res.status(201).json({ok:true,correct,correct_answer:q.correct_answer,explanation:q.explanation})});
app.patch("/api/attempts/:id",async(req,res)=>{if(!supabase)return res.status(503).json({error:"Supabase is not configured"});const allowed=["completed_at","score","correct_count","wrong_count","timeout_count","average_response_seconds"];const patch={};for(const k of allowed)if(req.body&&req.body[k]!==undefined)patch[k]=req.body[k];const {error}=await supabase.from("quiz_attempts").update(patch).eq("id",req.params.id);if(error)return res.status(400).json({error:error.message});res.json({ok:true})});
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
const port=process.env.PORT||10000;app.listen(port,()=>console.log("Quiz app listening on "+port));