// The lane's own verification tracer (regex-based, independent of tools/graph.mjs and of esbuild): used to re-run workers' key
// claims before a finding is entered in the report. Copy beside a small script at the repository root and import from it.
// It follows relative import / export-from / import() literals and bare side-effect imports; owner = most specific path in
// process/modules/*.json (files and tests). It does NOT see computed paths or run-time reads: use tools/trace.mjs for those.
// verification tracer: follows relative import/export-from/import() literals; owner by module json (files+tests, most specific)
import {readFileSync,existsSync,readdirSync,statSync} from "node:fs";import {resolve,dirname,join} from "node:path";
const order=readFileSync("process/modules/order.txt","utf8").trim().split("\n");
const js=order.map(m=>[m,JSON.parse(readFileSync(`process/modules/${m}.json`,"utf8"))]);
export const owner=f=>{let b=null,l=-1;for(const [m,j] of js)for(const p of [...(j.files||[]),...(j.tests||[])])if((f===p||(p.endsWith("/")&&f.startsWith(p)))&&p.length>l){b=m;l=p.length}return b};
export const pos=m=>order.indexOf(m)+1;
const UI=new Set(order.filter((m,i)=>i+1>=176&&i+1<=194));
export function codeFilesOf(mod){const j=js.find(([m])=>m===mod)[1];const out=[];const walk=p=>{if(!existsSync(p))return;const st=statSync(p);if(st.isFile()){if(/\.(mjs|js|cjs|ts)$/.test(p)&&owner(p)===mod)out.push(p)}else for(const n of readdirSync(p)){if(n==="node_modules")continue;walk(join(p,n))}};for(const p of j.files||[])walk(p.replace(/\/$/,""));return out}
export function closure(starts,cut=()=>false){const seen=new Set();const walk=f=>{if(seen.has(f)||!existsSync(f))return;seen.add(f);const s=readFileSync(f,"utf8").replace(/\/\*[\s\S]*?\*\//g,"");for(const m of s.matchAll(/(?:from|import\s*\(|import)\s*["'](\.{1,2}\/[^"']+)["']/g)){const t=resolve(dirname(f),m[1]).replace(process.cwd()+"/","");if(cut(t,f))continue;walk(t)}};for(const f of starts)walk(f);return seen}
export function report(label,seen){let max=0,who=null,ui=0;for(const f of seen){const o=owner(f);const p=o?pos(o):0;if(UI.has(o))ui++;if(p>max){max=p;who=o}}console.log(label,"| files",seen.size,"| UI-owned files reached",ui,"| latest module reached",max,who)}
export {UI,order};
