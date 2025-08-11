
"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
function toCSV(rows:any[]){const header=["date_iso","time_str","alk","ca","mg","po4","no3"];return [header.join(","),...rows.map(r=>[r.date_iso,r.time_str,r.alk??"",r.ca??"",r.mg??"",r.po4??"",r.no3??""].join(","))].join("\n");}
export default function ResultsPage(){
  const [userId,setUserId]=useState<string>(); const [items,setItems]=useState<any[]>([]);
  const [dateISO,setDateISO]=useState<string>(new Date().toISOString().slice(0,10));
  const [time,setTime]=useState<string>(new Date().toTimeString().slice(0,5));
  const [alk,setAlk]=useState(""); const [ca,setCa]=useState(""); const [mg,setMg]=useState(""); const [po4,setPo4]=useState(""); const [no3,setNo3]=useState("");
  const [frm,setFrm]=useState(""); const [to,setTo]=useState("");
  useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser(); if(!user) return; setUserId(user.id);
    const {data}=await supabase.from("readings").select("id,date_iso,time_str,alk,ca,mg,po4,no3").eq("user_id",user.id).order("date_iso",{ascending:false}).order("time_str",{ascending:false}); setItems(data||[]);
  })();},[]);
  async function add(){ if(!userId) return; const payload:any={user_id:userId,date_iso:dateISO,time_str:time};
    if(alk)payload.alk=Number(alk); if(ca)payload.ca=Number(ca); if(mg)payload.mg=Number(mg); if(po4)payload.po4=Number(po4); if(no3)payload.no3=Number(no3);
    const {data,error}=await supabase.from("readings").insert(payload).select().single(); if(error) alert(error.message); else setItems(p=>[data,...p]);
    setAlk("");setCa("");setMg("");setPo4("");setNo3("");
  }
  const filtered=useMemo(()=>items.filter(i=>{if(frm&&i.date_iso<frm)return false; if(to&&i.date_iso>to)return false; return true;}),[items,frm,to]).map(x=>x);
  function downloadCSV(){const csv=toCSV(filtered); const b=new Blob([csv],{type:"text/csv"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u;a.download="readings.csv";a.click();URL.revokeObjectURL(u);}
  return (<main className="space-y-4">
    <div className="border rounded p-4"><h2 className="font-semibold">Results</h2>{!userId&&<p className="text-sm text-gray-600">Sign in to log results.</p>}</div>
    {userId&&(<>
      <div className="border rounded p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label>Date</label><input className="border rounded px-2 py-1 w-full" type="date" value={dateISO} onChange={e=>setDateISO(e.target.value)} /></div>
          <div><label>Time</label><input className="border rounded px-2 py-1 w-full" type="time" value={time} onChange={e=>setTime(e.target.value)} /></div>
          <div><label>Alk</label><input className="border rounded px-2 py-1 w-full" value={alk} onChange={e=>setAlk(e.target.value)} /></div>
          <div><label>Ca</label><input className="border rounded px-2 py-1 w-full" value={ca} onChange={e=>setCa(e.target.value)} /></div>
          <div><label>Mg</label><input className="border rounded px-2 py-1 w-full" value={mg} onChange={e=>setMg(e.target.value)} /></div>
          <div><label>PO4</label><input className="border rounded px-2 py-1 w-full" value={po4} onChange={e=>setPo4(e.target.value)} /></div>
          <div><label>NO3</label><input className="border rounded px-2 py-1 w-full" value={no3} onChange={e=>setNo3(e.target.value)} /></div>
        </div>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={add}>Add</button>
      </div>
      <div className="border rounded p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label>From</label><input className="border rounded px-2 py-1 w-full" type="date" value={frm} onChange={e=>setFrm(e.target.value)} /></div>
          <div><label>To</label><input className="border rounded px-2 py-1 w-full" type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>
        </div>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={downloadCSV}>Export CSV</button>
      </div>
      <div className="border rounded p-4">
        <h3 className="font-medium mb-2">Recent</h3>
        {filtered.length===0?<p className="text-sm text-gray-500">No results for range.</p>:(
          <ul className="divide-y">{filtered.map((i:any)=>(<li key={i.id} className="py-2 text-sm">{i.date_iso} {i.time_str} — Alk {i.alk??""} Ca {i.ca??""} Mg {i.mg??""} PO4 {i.po4??""} NO3 {i.no3??""}</li>))}</ul>
        )}
      </div>
    </>)}
  </main>);
}
