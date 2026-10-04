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

function signSession(payload){
  const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig=crypto.createHmac("sha256",adminPassword||"missing-admin-password").update(body).digest("base64url");
  return body+"."+sig;
}
function verifySession(req){
  if(!adminPassword)return false;
  const header=req.headers.cookie||"";
  const match=header.match(new RegExp("(^|;\\s*)"+cookieName+"=([^;]+)"));
  if(!match)return false;
  const parts=match[2].split(".");
  const body=parts[0],sig=parts[1];
  if(!body||!sig)return false;
  const expected=crypto.createHmac("sha256",adminPassword).update(body).digest("base64url");
  if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;
  try{
    const payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
    return payload.exp>Date.now();
  }catch{return false}
}
function requireAdmin(req,res,next){
  if(!verifySession(req))return res.status(401).json({error:"Admin login required"});
  next();
}

app.get("/health",(req,res)=>res.json({ok:true,supabaseConfigured:Boolean(supabase)}));

app.post("/api/admin/login",(req,res)=>{
  if(!adminEmail||!adminPassword)return res.status(503).json({error:"Admin login is not configured"});
  const {email,password}=req.body||{};
  if(email!==adminEmail||password!==adminPassword)return res.status(401).json({error:"Incorrect email or password"});
  const token=signSession({email,exp:Date.now()+8*60*60*1000});
  res.setHeader("Set-Cookie",cookieName+"="+token+"; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800");
  res.json({ok:true});
});

app.post("/api/admin/logout",(req,res)=>{
  res.setHeader("Set-Cookie",cookieName+"=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ok:true});
});

app.get("/api/admin/me",requireAdmin,(req,res)=>res.json({ok:true}));

app.get("/api/admin/attempts",requireAdmin,async(req,res)=>{
  if(!supabase)return res.status(503).json({error:"Supabase is not configured"});
  const {data,error}=await supabase.from("quiz_attempts").select("*").order("started_at",{ascending:false}).limit(500);
  if(error)return res.status(400).json({error:error.message});
  res.json({attempts:data||[]});
});

app.get("/api/admin/attempts/:id/responses",requireAdmin,async(req,res)=>{
  if(!supabase)return res.status(503).json({error:"Supabase is not configured"});
  const {data,error}=await supabase.from("quiz_responses").select("*").eq("attempt_id",req.params.id).order("answered_at",{ascending:true});
  if(error)return res.status(400).json({error:error.message});
  res.json({responses:data||[]});
});

app.post("/api/attempts",async(req,res)=>{
  if(!supabase)return res.status(503).json({error:"Supabase is not configured"});
  const {session_id,section,difficulty,question_count}=req.body;
  const {data,error}=await supabase.from("quiz_attempts").insert({session_id,section,difficulty,question_count}).select("id").single();
  if(error)return res.status(400).json({error:error.message});
  res.json({id:data.id});
});

app.post("/api/responses",async(req,res)=>{
  if(!supabase)return res.status(503).json({error:"Supabase is not configured"});
  const {error}=await supabase.from("quiz_responses").insert(req.body);
  if(error)return res.status(400).json({error:error.message});
  res.status(201).json({ok:true});
});

app.patch("/api/attempts/:id",async(req,res)=>{
  if(!supabase)return res.status(503).json({error:"Supabase is not configured"});
  const {error}=await supabase.from("quiz_attempts").update(req.body).eq("id",req.params.id);
  if(error)return res.status(400).json({error:error.message});
  res.json({ok:true});
});

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

const port=process.env.PORT||10000;
app.listen(port,()=>console.log("Hendersons app listening on "+port));
