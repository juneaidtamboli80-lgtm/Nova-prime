const K='nova.geminiApiKey';
export function getKey():string{
  try{const v=localStorage.getItem(K);if(v&&v.trim())return v.trim();}catch{}
  const e=(import.meta.env.VITE_GEMINI_API_KEY as string|undefined)||'';
  return e.includes('PASTE_YOUR')?'':e.trim();
}
export function saveKey(v:string){const t=v.trim();if(t)localStorage.setItem(K,t);else localStorage.removeItem(K);}
export function maskKey(v:string){return v.length<=8?'••••':v.slice(0,4)+'••••'+v.slice(-4);}
export async function testKey(v:string):Promise<string>{
  try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',{headers:{'x-goog-api-key':v.trim()}});
    if(r.ok)return 'ok';
    if(r.status===400||r.status===403)return 'Key invalid ya permission nahi hai.';
    return 'Error '+r.status;
  }catch{return 'Network error. Internet check karo.';}
}
