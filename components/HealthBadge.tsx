
"use client";
import { useEffect, useState } from "react";
export default function HealthBadge(){
  const [ok,setOk]=useState<boolean|null>(null);
  useEffect(()=>{fetch("/api/ok").then(r=>r.json()).then(d=>setOk(Boolean(d.ok))).catch(()=>setOk(false));},[]);
  return <span className={"px-2 py-1 rounded-2xl text-xs "+(ok===null?"bg-gray-200":ok?"bg-green-100 text-green-700":"bg-red-100 text-red-700")}>{ok===null?"checking…":ok?"live":"issue"}</span>;
}
