const TRUSTED_SOURCES = [
  { id:'rwaf', name:'RWAF — Recommended vegetables and herbs', url:'https://rabbitwelfare.co.uk/welfare-need/recommended-vegetables-and-herbs/', rabbitSpecific:true, kind:'safe' },
  { id:'rspca-diet', name:'RSPCA — Healthy diet', url:'https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/diet', rabbitSpecific:true, kind:'safe' },
  { id:'rspca-poison', name:'RSPCA — Common rabbit poisons', url:'https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/health/poisoning', rabbitSpecific:true, kind:'toxic' },
  { id:'merck-rabbit', name:'Merck Veterinary Manual — Harmful plants and foods', url:'https://www.merckvetmanual.com/multimedia/table/plants-and-foods-that-are-harmful-to-rabbits', rabbitSpecific:true, kind:'toxic' },
  { id:'merck-food', name:'Merck Veterinary Manual — Food hazards', url:'https://www.merckvetmanual.com/special-pet-topics/poisoning/food-hazards', rabbitSpecific:false, kind:'toxic' },
  { id:'merck-plants', name:'Merck Veterinary Manual — Plants poisonous to animals', url:'https://www.merckvetmanual.com/special-pet-topics/poisoning/plants-poisonous-to-animals', rabbitSpecific:false, kind:'toxic' }
];
const MODEL='@cf/google/gemma-4-26b-a4b-it';
const STATUS_LABELS={safe:'🟢 SÛR / TRÈS BON',moderate:'🟡 SÛR — MODÉRATION',treat:'🟠 FRIANDISE OCCASIONNELLE',toxic:'🔴 TOXIQUE / À NE PAS DONNER',verify:'⚪ À VÉRIFIER'};
const MAX_BODY=4096;
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}})}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function stripHtml(html){return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
function terms(q){const n=norm(q);return [...new Set([n,n.replace(/\bthe\b/g,'').replace(/\s+/g,' ').trim(),n.replace(/\bde\b/g,'').replace(/\s+/g,' ').trim(),n.split(' ').filter(x=>x.length>2).join(' ')].filter(x=>x.length>=3))]}
function wordMatch(text,q){const n=norm(text);const needle=norm(q);if(!needle)return false;const escaped=needle.split(' ').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');return new RegExp(`(^|\\s)${escaped}($|\\s)`,'i').test(n)}
function findEvidence(text,qs){for(const q of qs){if(wordMatch(text,q)){const n=norm(text),needle=norm(q),i=n.indexOf(needle);const raw=text.toLowerCase();const approx=raw.indexOf(q.split(' ')[0].toLowerCase());const pos=approx>=0?approx:Math.max(0,i);return text.slice(Math.max(0,pos-700),Math.min(text.length,pos+1500))}}return ''}
async function fetchSource(source,qs){try{const r=await fetch(source.url,{headers:{'user-agent':'Archi-bon/5 source-check'}});if(!r.ok)return null;const text=stripHtml(await r.text());const excerpt=findEvidence(text,qs);return excerpt?{...source,excerpt}:null}catch{return null}}
function parseAI(raw){if(typeof raw!=='string')return null;const m=raw.match(/\{[\s\S]*\}/);if(!m)return null;try{return JSON.parse(m[0])}catch{return null}}
async function research(plant,env){
  const q=String(plant||'').trim().slice(0,120);if(!q)return null;
  let localMatch=null;
  try{if(env.ASSETS){const r=await env.ASSETS.fetch(new Request(new URL('/database.json','https://archi-bon.local')));if(r.ok){const db=await r.json();const nq=norm(q);localMatch=db.find(p=>[p.name,p.scientific,...(p.synonyms||[])].some(v=>norm(v)===nq))||null;}}}catch{}
  const qs=terms(q);
  if(localMatch&&localMatch.scientific)qs.push(...terms(localMatch.scientific));
  const uniqueQs=[...new Set(qs)];const matches=(await Promise.all(TRUSTED_SOURCES.map(s=>fetchSource(s,uniqueQs)))).filter(Boolean);
  const safeEvidence=matches.some(s=>s.kind==='safe');const toxicEvidence=matches.some(s=>s.kind==='toxic');
  const context=matches.map(s=>`SOURCE: ${s.name}\nURL: ${s.url}\nEXCERPT:\n${s.excerpt}`).join('\n\n');
  const base={name:q,status:'verify',statusLabel:'⚪ À VÉRIFIER',summary:'Les éléments trouvés ne suffisent pas à conclure de façon fiable.',scientific:'',parts:'À vérifier',caution:'Ne donne pas la plante tant que son identification et sa sécurité ne sont pas suffisamment établies.',sources:matches.map(({name,url})=>({name,url})),evidence:matches.map(({name,url,rabbitSpecific,kind})=>({name,url,rabbitSpecific,kind}))};
  if(!env.AI){
    if(localMatch&&localMatch.status==='verify')return {...base,summary:localMatch.advice||base.summary,scientific:localMatch.scientific||'',parts:localMatch.parts||base.parts,caution:localMatch.caution||base.caution,status:'verify',statusLabel:STATUS_LABELS.verify,sources:(localMatch.sources||[]).map(name=>({name,url:null}))};
    base.summary='Le service IA n’est pas disponible sur ce déploiement. La base locale reste utilisable et ce résultat reste ⚪ À VÉRIFIER.';return base}
  const prompt=`Tu es l'assistant de sécurité d'Archi-bon. Réponds en français.\n\nPlante demandée: ${q}\n\nRÈGLES STRICTES:\n- Ne jamais inventer un nom scientifique, une toxicité, une sécurité, une partie de plante ou une source.\n- Utilise uniquement les extraits fournis.\n- L'absence d'une mention n'est PAS une preuve de sécurité.\n- Une source générale sur les lapins ne suffit pas à déclarer une plante précise sûre.\n- Pour SAFE/MODERATE/TREAT, il faut une mention directe et pertinente dans une source rabbit-specific de type alimentation.\n- Pour TOXIC, il faut une mention directe dans une source de toxicologie/poisons.\n- Si l'identification est ambiguë ou les preuves sont insuffisantes, choisis verify.\n- Retourne UNIQUEMENT un JSON avec: status, statusLabel, summary, scientific, parts, caution.\n- status ∈ safe, moderate, treat, toxic, verify.\n- statusLabel ∈ 🟢 SÛR / TRÈS BON, 🟡 SÛR — MODÉRATION, 🟠 FRIANDISE OCCASIONNELLE, 🔴 TOXIQUE / À NE PAS DONNER, ⚪ À VÉRIFIER.\n\nSOURCES ET EXTRAITS:\n${context||'Aucun extrait exact n’a été trouvé.'}`;
  try{
    const r=await env.AI.run(MODEL,{messages:[{role:'user',content:prompt}]},{rejectIfBusy:true});
    const ai=parseAI(r?.response||r?.result?.response||r?.output_text||'');
    if(ai){
      const allowed=['safe','moderate','treat','toxic','verify'];
      if(!allowed.includes(ai.status))ai.status='verify';
      if(!['safe','moderate','treat','toxic','verify'].includes(ai.status))ai.status='verify';
      if(ai.status!=='verify' && ((['safe','moderate','treat'].includes(ai.status)&&!safeEvidence)||(ai.status==='toxic'&&!toxicEvidence)))ai.status='verify';
      ai.statusLabel=STATUS_LABELS[ai.status]||STATUS_LABELS.verify;
      if(ai.status==='verify'){ai.scientific='';if(!ai.parts)ai.parts='À vérifier';if(!ai.caution)ai.caution=base.caution}
      return {...base,...ai, sources:base.sources, evidence:base.evidence};
    }
  }catch{}
  return base;
}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/api/research'){if(request.method!=='POST')return json({error:'Méthode non autorisée'},405);try{const len=Number(request.headers.get('content-length')||0);if(len>MAX_BODY)return json({error:'Requête trop volumineuse'},413);const b=await request.json();if(!b.plant||typeof b.plant!=='string'||b.plant.length>120)return json({error:'Nom de plante invalide'},400);const result=await research(b.plant,env);return json(result)}catch{return json({error:'Recherche impossible'},500)}}if(env.ASSETS)return env.ASSETS.fetch(request);return new Response('Archi-bon');}};
