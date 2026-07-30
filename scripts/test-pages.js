/* =========================================================================
   scripts/test-pages.js
   Run with:  npm run test:pages   (or)  node scripts/test-pages.js

   Loads each real page's HTML and its real scripts inside a minimal DOM,
   then drives the actual buttons. Catches broken element IDs, missing
   handlers and render regressions that a syntax check cannot see.
   Uses the offline engine throughout, so no API key is needed.
   ========================================================================= */

const fs=require('fs');
let pass=0,fail=0;
const ok=(l,c,x)=>{c?(pass++,console.log('  ok   '+l)):(fail++,console.log('  FAIL '+l+(x?' -> '+x:'')))};

function makeDom(html){
  const ids=new Map();
  const store={};
  const mk=(id)=>{
    const el={id,_html:'',value:'',textContent:'',checked:false,disabled:false,files:[],
      style:new Proxy({setProperty(){},getPropertyValue(){return ''}},
        {set:(t,k,v)=>{t[k]=v;return true},get:(t,k)=>t[k]!==undefined?t[k]:''}),
      dataset:{},classList:{_s:new Set(),add(...c){c.forEach(x=>this._s.add(x))},
        remove(...c){c.forEach(x=>this._s.delete(x))},
        toggle(c,f){f===undefined?(this._s.has(c)?this._s.delete(c):this._s.add(c)):(f?this._s.add(c):this._s.delete(c));return this._s.has(c)},
        contains(c){return this._s.has(c)}},
      _listeners:{},
      addEventListener(t,f){(this._listeners[t]=this._listeners[t]||[]).push(f)},
      removeEventListener(){}, click(){(this._listeners.click||[]).forEach(f=>f({target:this}))},
      dispatch(t,e){(this._listeners[t]||[]).forEach(f=>f(e||{target:this}))},
      setAttribute(k,v){this['attr_'+k]=v}, getAttribute(k){return this['attr_'+k]},
      querySelectorAll(){return []}, querySelector(){return null},
      appendChild(c){this._children=this._children||[];this._children.push(c)},
      focus(){}, setSelectionRange(){}, scrollIntoView(){}, remove(){},
      get innerHTML(){return this._html}, set innerHTML(v){this._html=v;this._children=[]},
      get offsetWidth(){return 1}};
    return el;
  };
  for(const m of html.matchAll(/\bid="([^"]+)"/g)) ids.set(m[1], mk(m[1]));
  const doc={
    _ready:[],
    getElementById:id=>ids.get(id)||null,
    createElement:()=>mk('created'),
    querySelectorAll:sel=>{ if(sel==='[data-year]'||sel.startsWith('[data-theme')) return []; return []; },
    querySelector:sel=>null,
    addEventListener:(t,f)=>{ if(t==='DOMContentLoaded') doc._ready.push(f); },
    documentElement:{setAttribute(){},getAttribute(){return 'light'}},
    body:{addEventListener(){},removeEventListener(){}}
  };
  return {doc, ids};
}

const ROOT=require('path').join(__dirname,'..');
const R=p=>require('path').join(ROOT,p);

function runPage(htmlFile, scripts, label, seedStore){
  const html=fs.readFileSync(R(htmlFile),'utf8');
  const {doc,ids}=makeDom(html);
  const localStorage={_d:Object.assign({},seedStore||{}),getItem(k){return k in this._d?this._d[k]:null},
    setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
  /* Use a real vm context so `window.X = ...` creates a true global, exactly
     as it does in a browser. That is how data.js exposes GameData. */
  const vm=require('vm');
  const ctx={document:doc,localStorage,console,Math,Date,JSON,Object,Array,String,Number,Boolean,
    parseInt,parseFloat,isNaN,RegExp,Error,Set,Map,Promise,Symbol,
    requestAnimationFrame:f=>f(),setTimeout:(f,t)=>{if(t<50)f();return 0},clearTimeout(){},
    setInterval:()=>0,clearInterval(){},Blob:function(){},URL:{createObjectURL:()=>'',revokeObjectURL(){}},
    FileReader:function(){},confirm:()=>true,alert(){},
    fetch:()=>Promise.reject(new Error('no-backend')),
    AbortController:function(){this.signal=null;this.abort=()=>{}}};
  ctx.window=ctx; ctx.globalThis=ctx;
  vm.createContext(ctx);
  const win=ctx;
  let err=null;
  try{
    const bundle = scripts.map(s=>fs.readFileSync(R(s),'utf8')).join('\n;\n');
    vm.runInContext(bundle, ctx, {filename:label});
    doc._ready.forEach(f=>f());
  }catch(e){ err=e; }
  ok(label+' initialises without error', !err, err && err.message);
  return {doc,ids,localStorage,win,err};
}

console.log('\ncreate.html');
const create=runPage('create.html',['js/data.js','js/app.js','js/builder.js'],'builder');
if(!create.err){
  const preview=create.ids.get('previewCard');
  ok('renders the preview card', preview._html.includes('candidate-card-body'));
  ok('renders the checklist', create.ids.get('checklist')._html.includes('<li'));
  ok('shows a progress percent', /%$/.test(create.ids.get('completionPct').textContent));
  ok('age note is populated', create.ids.get('ageTag').textContent.length>10);
  ok('example button works', (()=>{ create.ids.get('exampleBtn').click();
      return create.ids.get('nameInput').value==='John Carter'; })());
  ok('example fills the card', create.ids.get('previewCard')._html.includes('John Carter'));
  ok('progress hits 100% on the example', create.ids.get('completionPct').textContent==='100%');
  ok('save persists the candidate', (()=>{ create.ids.get('saveBtn').click();
      return !!create.localStorage.getItem('bap_player_candidate'); })());
  ok('random button works', (()=>{ create.ids.get('randomCandidateBtn').click();
      return create.ids.get('nameInput').value.length>3; })());
  ok('no emoji in preview markup', !/[\u{1F300}-\u{1FAFF}]/u.test(create.ids.get('previewCard')._html));
}
const saved=create.err?{}:{bap_player_candidate:create.localStorage.getItem('bap_player_candidate')};

console.log('\nopponent.html');
const opp=runPage('opponent.html',['js/data.js','js/app.js','js/opponent.js'],'opponent picker',saved);
if(!opp.err){
  ok('renders the roster', opp.ids.get('rosterGrid')._children===undefined ? false : true);
  ok('renders the opponent preview', opp.ids.get('oppPreviewCard')._html.includes('candidate-card-body'));
  ok('random opponent works', (()=>{ opp.ids.get('oppRandomizeBtn').click();
      return opp.ids.get('oppNameInput').value.length>3; })());
  ok('saving an opponent persists it', (()=>{ opp.ids.get('oppSaveBtn').click();
      return !!opp.localStorage.getItem('bap_opponent_candidate'); })());
}

console.log('\nsimulator.html (offline fallback path)');
const sim=runPage('simulator.html',['js/data.js','js/app.js','js/simulation-engine.js','js/report.js','js/simulator.js'],'simulator',saved);
if(!sim.err){
  ok('shows the console, not the empty state', sim.ids.get('simConsole').style.display==='block');
  ok('renders both matchup cards', sim.ids.get('matchupA')._html.includes('candidate-card-body') &&
     sim.ids.get('matchupB')._html.includes('candidate-card-body'));
  ok('readiness note is set', sim.ids.get('readinessNote').textContent.length>5);
}

console.log('\nresults.html');
const E=require(require('path').join(__dirname,'..','js','simulation-engine.js'));
const cand=JSON.parse(saved.bap_player_candidate||'{}');
const result=E.simulate({candidate:cand}); result.ranAt=new Date().toISOString(); result.candidateSnapshot=cand;
const res=runPage('results.html',['js/data.js','js/app.js','js/report.js','js/results.js'],'results',
  Object.assign({},saved,{bap_last_result:JSON.stringify(result)}));
if(!res.err){
  ok('shows the results wrapper', res.ids.get('resultsWrap').style.display==='block');
  ok('hides the empty state', res.ids.get('resultsMissing').style.display==='none');
  ok('sets the headline', res.ids.get('winnerBannerText').textContent.length>3);
  ok('renders the report', res.ids.get('reportRoot')._html.includes('Voter groups'));
  ok('renders the candidate card', res.ids.get('resultCandidateCard')._html.includes('candidate-card-body'));
  ok('report has no em dash', !res.ids.get('reportRoot')._html.includes('—'));
}

console.log('\nresults.html with nothing run yet');
const empty=runPage('results.html',['js/data.js','js/app.js','js/report.js','js/results.js'],'results (empty)',{});
if(!empty.err){
  ok('shows the empty state', empty.ids.get('resultsMissing').style.display==='block');
  ok('hides the report', empty.ids.get('resultsWrap').style.display==='none');
}

console.log('\nsimulator.html with no candidate');
const noCand=runPage('simulator.html',['js/data.js','js/app.js','js/simulation-engine.js','js/report.js','js/simulator.js'],'simulator (empty)',{});
if(!noCand.err){
  ok('shows the empty state', noCand.ids.get('missingNotice').style.display==='block');
  ok('hides the console', noCand.ids.get('simConsole').style.display==='none');
}

console.log('\n'+(fail===0?'PASS':'FAIL')+' - '+pass+' passed, '+fail+' failed\n');
process.exit(fail?1:0);
