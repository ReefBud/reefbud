
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
export default function AuthBar(){
  const [email,setEmail]=useState(""); const [user,setUser]=useState<any>(null); const [msg,setMsg]=useState("");
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user??null));
    return ()=>sub.subscription.unsubscribe();
  },[]);
  async function signIn(){
    setMsg("Sending magic link…");
    const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: typeof window!=="undefined"?window.location.origin:undefined }});
    setMsg(error?error.message:"Check your email.");
  }
  return user? (<div className="flex items-center gap-2 text-sm text-gray-600">{user.email}<button className="px-3 py-1 rounded bg-black text-white" onClick={()=>supabase.auth.signOut()}>Sign out</button></div>)
  : (<div className="flex items-center gap-2"><input className="border rounded px-2 py-1" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} /><button className="px-3 py-1 rounded bg-black text-white" onClick={signIn}>Sign in</button><span className="text-xs text-gray-500">{msg}</span></div>);
}
