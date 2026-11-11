import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 1) Remplacez ces deux valeurs par celles de votre projet Supabase.
const SUPABASE_URL = "https://duvudhxhttqxuvjfgqee.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Muk0w0kyexiJqsk7m1ZeEA_SgSsXoTS";
const configured = SUPABASE_URL.includes("supabase.co") && !SUPABASE_URL.includes("VOTRE-PROJET") && !SUPABASE_ANON_KEY.includes("VOTRE_CLE");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);
const money = (n,c="EUR") => new Intl.NumberFormat("fr-FR",{style:"currency",currency:c}).format(Number(n||0));
const dateFR = d => d ? new Date(d+"T12:00:00").toLocaleDateString("fr-FR") : "Sans échéance";
const state = {user:null,tab:"Résumé",transactions:[],debts:[],recurrences:[],goals:[],authMode:"login"};

const navItems = [
  ["Résumé","⌂"],["Gains","↗"],["Dépenses","↘"],["Dettes","▤"],["Récurrences","⟳"],["Agenda","▦"],["Devises","◎"],["Banque","⇧"],["Épargne","♡"]
];
function setMessage(id,msg,isError=true){$(id).textContent=msg;$(id).style.color=isError?"#c45b4b":"#16865f";}
function showAuth(){ $("auth").classList.remove("hidden"); $("app").classList.add("hidden"); }
function showApp(){ $("auth").classList.add("hidden"); $("app").classList.remove("hidden"); $("userEmail").textContent=state.user.email||""; renderNav(); loadAll(); }
function renderNav(){
  $("sideNav").innerHTML=navItems.map(([name,ico])=>`<button class="nav-btn ${state.tab===name?"active":""}" data-tab="${name}"><span class="nav-icon">${ico}</span><span class="nav-label">${name}</span></button>`).join("");
  $("sideNav").querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderNav();render();});
  $("pageTitle").textContent=state.tab;
}
async function loadAll(){
  if(!supabase)return;
  $("syncStatus").textContent="● Synchronisation…";
  try{
    const [t,d,r,g]=await Promise.all([
      supabase.from("transactions").select("*").order("transaction_date",{ascending:false}),
      supabase.from("debts").select("*").order("due_date",{ascending:true}),
      supabase.from("recurring_rules").select("*").order("created_at",{ascending:false}),
      supabase.from("savings_goals").select("*").order("created_at",{ascending:false})
    ]);
    for(const x of [t,d,r,g])if(x.error)throw x.error;
    state.transactions=t.data||[];state.debts=d.data||[];state.recurrences=r.data||[];state.goals=g.data||[];
    $("syncStatus").textContent="● Synchronisé";render();
  }catch(e){$("syncStatus").textContent="● Erreur de synchronisation";console.error(e);alert("Impossible de charger les données : "+e.message);}
}
async function insert(table,payload){const {error}=await supabase.from(table).insert(payload);if(error)throw error;await loadAll();}
async function update(table,id,payload){const {error}=await supabase.from(table).update(payload).eq("id",id);if(error)throw error;await loadAll();}
async function remove(table,id){if(!confirm("Supprimer cet élément ?"))return;const {error}=await supabase.from(table).delete().eq("id",id);if(error)alert(error.message);else loadAll();}
const total = (type,currency="EUR",predicate=()=>true)=>state.transactions.filter(x=>x.type===type&&x.currency===currency&&predicate(x)).reduce((s,x)=>s+Number(x.amount),0);
const balance = currency => total("income",currency,x=>x.transaction_date<=today())-total("expense",currency,x=>x.transaction_date<=today());
const outstanding = d=>Math.max(0,Number(d.amount)-Number(d.paid_amount||0));
function render(){
  const root=$("view");
  if(state.tab==="Résumé")root.innerHTML=dashboard();
  else if(state.tab==="Gains"||state.tab==="Dépenses")root.innerHTML=transactionsPage(state.tab==="Gains"?"income":"expense");
  else if(state.tab==="Dettes")root.innerHTML=debtsPage();
  else if(state.tab==="Récurrences")root.innerHTML=recurrencesPage();
  else if(state.tab==="Agenda")root.innerHTML=calendarPage();
  else if(state.tab==="Devises")root.innerHTML=currenciesPage();
  else if(state.tab==="Banque")root.innerHTML=bankPage();
  else if(state.tab==="Épargne")root.innerHTML=savingsPage();
  root.querySelectorAll("[data-edit-tx]").forEach(b=>b.onclick=()=>openTx(state.transactions.find(x=>x.id===b.dataset.editTx)));
  root.querySelectorAll("[data-delete-tx]").forEach(b=>b.onclick=()=>remove("transactions",b.dataset.deleteTx));
  root.querySelectorAll("[data-pay]").forEach(b=>b.onclick=()=>openPayment(state.debts.find(x=>x.id===b.dataset.pay)));
  root.querySelectorAll("[data-delete-debt]").forEach(b=>b.onclick=()=>remove("debts",b.dataset.deleteDebt));
  root.querySelectorAll("[data-delete-rec]").forEach(b=>b.onclick=()=>remove("recurring_rules",b.dataset.deleteRec));
  root.querySelectorAll("[data-delete-goal]").forEach(b=>b.onclick=()=>remove("savings_goals",b.dataset.deleteGoal));
  root.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>$(b.dataset.action).showModal());
  const importBtn=$("importCsv");if(importBtn)importBtn.onclick=importCSV;
}
function dashboard(){
  const bal=balance("EUR"),inm=total("income","EUR",x=>x.transaction_date.slice(0,7)===today().slice(0,7)),outm=total("expense","EUR",x=>x.transaction_date.slice(0,7)===today().slice(0,7));
  const due=state.debts.reduce((s,d)=>s+(d.currency==="EUR"&&d.status!=="paid"?outstanding(d):0),0);
  const recent=state.transactions.slice(0,6);
  const cats={};state.transactions.filter(x=>x.type==="expense"&&x.currency==="EUR").forEach(x=>cats[x.category||"Autre"]=(cats[x.category||"Autre"]||0)+Number(x.amount));
  const max=Math.max(1,...Object.values(cats));
  return `<div class="grid stats">
    ${stat("Solde actuel",money(bal),"Gains − dépenses passés et du jour","⌂")}
    ${stat("Gains ce mois",money(inm),"Entrées enregistrées","↗","positive")}
    ${stat("Dépenses ce mois",money(outm),"Sorties enregistrées","↘","negative")}
    ${stat("Dettes restantes",money(due),"Engagements non réglés","▤")}
  </div>
  <div class="grid two-col">
    <section class="card"><div class="section-head"><div><h2>Répartition des dépenses</h2><p>Par catégorie · EUR</p></div></div>
    ${Object.keys(cats).length?Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill expense" style="width:${v/max*100}%"></div></div><b>${money(v)}</b></div>`).join(""):`<div class="empty"><b>Aucune dépense pour le moment</b>Ajoutez une opération pour commencer.</div>`}</section>
    <section class="card"><div class="section-head"><div><h2>Prévision simplifiée</h2><p>Solde actuel moins dettes en EUR</p></div></div><div class="stat-value">${money(bal-due)}</div><p class="muted tiny">Les récurrences futures sont listées dans leur rubrique. Cette estimation ne constitue pas un conseil financier.</p><button class="secondary" data-action="recurringDialog">Ajouter une récurrence</button></section>
  </div>
  <section class="card" style="margin-top:16px"><div class="section-head"><div><h2>Dernières opérations</h2><p>Vos mouvements les plus récents</p></div><button class="secondary" data-tab-jump="Dépenses">Voir les opérations</button></div>${recent.length?`<div class="tx-list">${recent.map(txRow).join("")}</div>`:`<div class="empty"><b>Bienvenue dans Mon Budget</b>Ajoutez votre premier gain ou votre première dépense.</div>`}</section>`;
}
function stat(label,value,foot,icon,cls=""){return `<article class="card"><div class="stat-label"><span>${label}</span><b>${icon}</b></div><div class="stat-value ${cls}">${value}</div><div class="stat-foot">${foot}</div></article>`}
function txRow(t){return `<div class="tx-row"><div class="tx-icon">${t.type==="income"?"↗":"↘"}</div><div class="tx-info"><strong>${esc(t.label)}</strong><small>${dateFR(t.transaction_date)} · ${esc(t.category||"Sans catégorie")}</small></div><div class="tx-amount ${t.type==="income"?"positive":"negative"}">${t.type==="income"?"+":"−"}${money(t.amount,t.currency)}</div></div>`}
function transactionsPage(type){
  const arr=state.transactions.filter(x=>x.type===type);
  return `<section class="card"><div class="section-head"><div><h2>${type==="income"?"Tous mes gains":"Toutes mes dépenses"}</h2><p>${arr.length} opération(s)</p></div><button class="primary" data-action="transactionDialog">＋ Ajouter</button></div>
  ${arr.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Actions</th></tr></thead><tbody>${arr.map(t=>`<tr><td>${dateFR(t.transaction_date)}</td><td><b>${esc(t.label)}</b></td><td>${esc(t.category||"—")}</td><td class="${type==="income"?"positive":"negative"}"><b>${money(t.amount,t.currency)}</b></td><td><div class="table-actions"><button class="small-btn" data-edit-tx="${t.id}">Modifier</button><button class="small-btn danger-btn" data-delete-tx="${t.id}">Supprimer</button></div></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty"><b>Aucune opération</b>Utilisez « Ajouter » pour enregistrer votre premier mouvement.</div>`}</section>`;
}
function debtsPage(){
 return `<div class="section-head"><div><h2>Dettes à rembourser</h2><p>Les dettes non réglées n'affectent pas le solde actuel.</p></div><button class="primary" data-action="debtDialog">＋ Ajouter une dette</button></div>
 <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${state.debts.map(d=>{const left=outstanding(d),pct=Number(d.amount)?(Number(d.paid_amount||0)/Number(d.amount))*100:0;return `<article class="card debt-card"><div class="debt-top"><div><h2>${esc(d.label)}</h2><p class="muted tiny">${esc(d.creditor)}</p></div><span class="pill ${left===0?"paid":""}">${left===0?"Payée":"À payer"}</span></div><div><div class="stat-value">${money(left,d.currency)}</div><div class="muted tiny">Restant sur ${money(d.amount,d.currency)}</div></div><div class="progress"><span style="width:${pct}%"></span></div><div class="muted tiny">Échéance : ${dateFR(d.due_date)}</div><div class="table-actions">${left>0?`<button class="primary" data-pay="${d.id}">Payer</button>`:""}<button class="small-btn danger-btn" data-delete-debt="${d.id}">Supprimer</button></div></article>`}).join("")||`<div class="card empty"><b>Aucune dette enregistrée</b>Ajoutez un engagement pour suivre son remboursement.</div>`}</div>`;
}
function recurrencesPage(){return `<div class="section-head"><div><h2>Opérations récurrentes</h2><p>Règles de suivi à fréquence régulière.</p></div><button class="primary" data-action="recurringDialog">＋ Ajouter</button></div><section class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Libellé</th><th>Type</th><th>Montant</th><th>Fréquence</th><th>Début</th><th></th></tr></thead><tbody>${state.recurrences.map(r=>`<tr><td><b>${esc(r.label)}</b></td><td>${r.type==="income"?"Gain":"Dépense"}</td><td>${money(r.amount,r.currency)}</td><td>${freqLabel(r.frequency)}</td><td>${dateFR(r.start_date)}</td><td><button class="small-btn danger-btn" data-delete-rec="${r.id}">Supprimer</button></td></tr>`).join("")}</tbody></table></div>${state.recurrences.length?"":`<div class="empty">Aucune récurrence configurée.</div>`}</section>`}
function freqLabel(f){return ({weekly:"Hebdomadaire",biweekly:"Toutes les 2 semaines",monthly:"Mensuelle",quarterly:"Trimestrielle",yearly:"Annuelle"})[f]||f}
function calendarPage(){
 const now=new Date(),y=now.getFullYear(),m=now.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();
 let cells=Array.from({length:offset},()=>`<div></div>`).join("");
 for(let d=1;d<=days;d++){const date=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,items=state.transactions.filter(t=>t.transaction_date===date);cells+=`<div class="calendar-day"><strong>${d}</strong>${items.map(t=>`<i class="dot" style="background:${t.type==="income"?"#16865f":"#c45b4b"}"></i>`).join("")}${items.length?`<small>${items.length} op.</small>`:""}</div>`}
 return `<section class="card"><div class="section-head"><div><h2>${now.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</h2><p>Gains en vert · Dépenses en rouge</p></div></div><div class="calendar-grid">${["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(x=>`<b class="muted tiny">${x}</b>`).join("")}${cells}</div></section>`;
}
function currenciesPage(){const codes=[...new Set(["EUR",...state.transactions.map(t=>t.currency),...state.debts.map(d=>d.currency)])];return `<section class="card"><h2>Soldes par devise</h2><p class="muted tiny">Les montants restent dans leur devise d'origine. Aucun taux de change n'est appliqué automatiquement.</p>${codes.map(c=>`<div class="tx-row"><div class="tx-icon">◎</div><div class="tx-info"><strong>${c}</strong><small>Gains − dépenses enregistrés</small></div><div class="tx-amount">${money(balance(c),c)}</div></div>`).join("")}</section>`}
function bankPage(){return `<section class="card"><h2>Importer un relevé CSV</h2><p class="muted">Format attendu : date;nom;montant;type;devise;catégorie. Les montants négatifs sont interprétés comme des dépenses si le type est absent.</p><label>Choisir un fichier CSV<input type="file" id="csvFile" accept=".csv,text/csv"></label><button id="importCsv" class="primary">Importer les opérations</button><p id="csvMessage" class="message"></p><p class="tiny muted">Vérifiez votre fichier avant l'import. Les lignes invalides sont ignorées.</p></section><section class="card" style="margin-top:15px"><h2>Lecture de captures d'écran</h2><p class="muted">L'OCR d'images et l'analyse automatique de relevés ne sont pas encore activés dans cette version. Ne téléversez pas de relevés contenant des données sensibles vers un service tiers sans en comprendre les conditions.</p><span class="pill">À connecter</span></section>`}
function savingsPage(){return `<div class="section-head"><div><h2>Objectifs d'épargne</h2><p>Suivez vos projets et vos progrès.</p></div><button class="primary" id="newGoal">＋ Nouvel objectif</button></div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">${state.goals.map(g=>`<section class="card"><h2>${esc(g.label)}</h2><div class="goal"><div class="goal-line"><span>${money(g.saved_amount,g.currency)} économisés</span><b>${money(g.target_amount,g.currency)}</b></div><div class="progress"><span style="width:${Math.min(100,Number(g.saved_amount)/Number(g.target_amount)*100)}%"></span></div></div><button class="small-btn danger-btn" data-delete-goal="${g.id}">Supprimer</button></section>`).join("")||`<section class="card empty"><b>Aucun objectif</b>Créez un objectif d'épargne pour commencer.</section>`}</div>`;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function openTx(t=null){$("transactionForm").reset();$("transactionId").value=t?.id||"";$("txType").value=t?.type|| (state.tab==="Gains"?"income":"expense");$("txLabel").value=t?.label||"";$("txAmount").value=t?.amount||"";$("txCurrency").value=t?.currency||"EUR";$("txDate").value=t?.transaction_date||today();$("txCategory").value=t?.category||"";$("txNote").value=t?.note||"";$("transactionDialogTitle").textContent=t?"Modifier une opération":"Ajouter une opération";$("transactionDialog").showModal();}
function openPayment(d){$("paymentForm").reset();$("paymentDebtId").value=d.id;$("paymentDebtInfo").textContent=`${d.label} — restant : ${money(outstanding(d),d.currency)}`;$("paymentAmount").max=outstanding(d);$("paymentDate").value=today();$("paymentDialog").showModal();}
$("loginTab").onclick=()=>setAuthMode("login");$("signupTab").onclick=()=>setAuthMode("signup");
function setAuthMode(m){state.authMode=m;$("loginTab").classList.toggle("active",m==="login");$("signupTab").classList.toggle("active",m==="signup");$("authSubmit").textContent=m==="login"?"Se connecter":"Créer mon compte";}
$("authForm").onsubmit=async e=>{e.preventDefault();if(!supabase){setMessage("authMessage","Configurez d'abord l'URL et la clé publique Supabase dans app.js.");return;}const email=$("email").value,password=$("password").value;try{const res=state.authMode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});if(res.error)throw res.error;if(state.authMode==="signup"&&!res.data.session){setMessage("authMessage","Compte créé. Vérifiez votre e-mail pour confirmer l'inscription.",false);return;}state.user=res.data.user;showApp();}catch(err){setMessage("authMessage",err.message);}};
$("logout").onclick=async()=>{await supabase.auth.signOut();state.user=null;showAuth();};
$("addQuick").onclick=()=>openTx();
$("transactionForm").onsubmit=async e=>{e.preventDefault();try{const payload={user_id:state.user.id,type:$("txType").value,label:$("txLabel").value.trim(),amount:Number($("txAmount").value),currency:$("txCurrency").value,transaction_date:$("txDate").value,category:$("txCategory").value.trim()||null,note:$("txNote").value.trim()||null};const id=$("transactionId").value;if(id)await update("transactions",id,payload);else await insert("transactions",payload);$("transactionDialog").close();}catch(err){setMessage("txError",err.message);}};
$("debtForm").onsubmit=async e=>{e.preventDefault();try{await insert("debts",{user_id:state.user.id,label:$("debtLabel").value.trim(),creditor:$("debtCreditor").value.trim(),amount:Number($("debtAmount").value),paid_amount:0,currency:$("debtCurrency").value,due_date:$("debtDue").value||null,status:"pending"});$("debtDialog").close();}catch(err){setMessage("debtError",err.message);}};
$("paymentForm").onsubmit=async e=>{e.preventDefault();const d=state.debts.find(x=>x.id===$("paymentDebtId").value),amt=Number($("paymentAmount").value);if(!d||amt<=0||amt>outstanding(d)){setMessage("paymentError","Montant invalide ou supérieur au restant dû.");return;}try{await insert("transactions",{user_id:state.user.id,type:"expense",label:`Remboursement : ${d.label}`,amount:amt,currency:d.currency,transaction_date:$("paymentDate").value,category:"Remboursement",note:`Créancier : ${d.creditor}`});await update("debts",d.id,{paid_amount:Number(d.paid_amount||0)+amt,status:amt>=outstanding(d)?"paid":"pending"});$("paymentDialog").close();}catch(err){setMessage("paymentError",err.message);}};
$("recurringForm").onsubmit=async e=>{e.preventDefault();try{await insert("recurring_rules",{user_id:state.user.id,label:$("recLabel").value.trim(),type:$("recType").value,amount:Number($("recAmount").value),currency:$("recCurrency").value,frequency:$("recFrequency").value,start_date:$("recStart").value,active:true});$("recurringDialog").close();}catch(err){setMessage("recError",err.message);}};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$("view").addEventListener("click",e=>{const b=e.target.closest("[data-tab-jump]");if(b){state.tab=b.dataset.tabJump;renderNav();render();}});
async function importCSV(){const file=$("csvFile")?.files?.[0];if(!file){setMessage("csvMessage","Choisissez un fichier CSV.");return;}const text=await file.text(),lines=text.split(/\r?\n/).filter(Boolean);let count=0;for(let i=0;i<lines.length;i++){const cols=lines[i].split(";");if(i===0&&/date/i.test(cols[0]))continue;const [date,label,raw,type,currency,category]=cols;const amount=Number(String(raw||"").replace(",",".").replace(/[^\d.-]/g,""));if(!date||!label||!Number.isFinite(amount)||amount===0)continue;const inferred=type?.toLowerCase().includes("gain")||type?.toLowerCase().includes("income")?"income":type?.toLowerCase().includes("dép")||type?.toLowerCase().includes("dep")||type?.toLowerCase().includes("expense")?"expense":amount>0?"income":"expense";try{await insert("transactions",{user_id:state.user.id,type:inferred,label:label.trim(),amount:Math.abs(amount),currency:(currency||"EUR").trim().toUpperCase(),transaction_date:date.trim(),category:category?.trim()||"Import CSV"});count++;}catch(err){console.error(err);}}setMessage("csvMessage",`${count} opération(s) importée(s).`,false);}
$("view").addEventListener("click",e=>{if(e.target.id==="newGoal"||e.target.closest("#newGoal")){const label=prompt("Nom de l'objectif ?");if(!label)return;const target=Number(prompt("Montant cible ?"));if(!target)return;insert("savings_goals",{user_id:state.user.id,label,target_amount:target,saved_amount:0,currency:"EUR"}).catch(err=>alert(err.message));}});
async function boot(){
  if(!configured){showAuth();setMessage("authMessage","Avant utilisation : configurez votre projet Supabase en suivant le guide README.");return;}
  const {data:{session}}=await supabase.auth.getSession();if(session){state.user=session.user;showApp();}else showAuth();
  supabase.auth.onAuthStateChange((_event,session)=>{if(session){state.user=session.user;showApp();}else{state.user=null;showAuth();}});
}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.error));
boot();
