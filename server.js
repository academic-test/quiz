const express=require("express");
const path=require("path");
const {createClient}=require("@supabase/supabase-js");

const app=express();
app.use(express.json({limit:"100kb"}));
app.use(express.static(path.join(__dirname,"public")));

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase=(url&&key)?createClient(url,key):null;

app.get("/health",(req,res)=>res.json({ok:true,supabaseConfigured:Boolean(supabase)}));

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

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

const port=process.env.PORT||10000;
app.listen(port,()=>console.log("Hendersons app listening on "+port));
