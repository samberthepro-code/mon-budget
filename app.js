import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 1) Remplacez ces deux valeurs par celles de votre projet Supabase.
const SUPABASE_URL = "https://duvudhxhttqxuvjfgqee.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Muk0w0kyexiJqsk7m1ZeEA_SgSsXoTS";
const configured = SUPABASE_URL.includes("supabase.co") && !SUPABASE_URL.includes("VOTRE-PROJET") && !SUPABASE_ANON_KEY.includes("VOTRE_CLE");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = id => document.getElementById(id);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const money = (n,c="EUR") => new Intl.NumberFormat("fr-FR",{style:"currency",currency:c}).format(Number(n||0));
const dateFR = d => d ? new Date(d+"T12:00:00").toLocaleDateString("fr-FR") : "Sans échéance";
const state = {user:null,tab:"Résumé",transactions:[],debts:[],debtPayments:[],receivables:[],recurrences:[],goals:[],authMode:"login",calendarDate:new Date(),selectedDate:today()};

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
    const [t,d,rec,pay,r,g]=await Promise.all([
      supabase.from("transactions").select("*").order("transaction_date",{ascending:false}),
      supabase.from("debts").select("*").order("due_date",{ascending:true}),
      supabase.from("receivables").select("*").order("due_date",{ascending:true}),
      supabase.from("debt_payments").select("*").order("payment_date",{ascending:false}),
      supabase.from("recurring_rules").select("*").order("created_at",{ascending:false}),
      supabase.from("savings_goals").select("*").order("created_at",{ascending:false})
    ]);
    for(const x of [t,d,rec,pay,r,g])if(x.error)throw x.error;
    state.transactions=t.data||[];state.debts=d.data||[];state.receivables=rec.data||[];state.debtPayments=pay.data||[];state.recurrences=r.data||[];state.goals=g.data||[];
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
  root.querySelectorAll("[data-edit-payment]").forEach(b=>b.onclick=()=>openPaymentEdit(state.debtPayments.find(x=>x.id===b.dataset.editPayment)));
  root.querySelectorAll("[data-delete-payment]").forEach(b=>b.onclick=()=>deleteDebtPayment(state.debtPayments.find(x=>x.id===b.dataset.deletePayment)));
  root.querySelectorAll("[data-cal-nav]").forEach(b=>b.onclick=()=>{state.calendarDate=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth()+Number(b.dataset.calNav),1);state.selectedDate=`${state.calendarDate.getFullYear()}-${String(state.calendarDate.getMonth()+1).padStart(2,"0")}-01`;render();});
  root.querySelectorAll("[data-cal-day]").forEach(b=>b.onclick=()=>{state.selectedDate=b.dataset.calDay;render();});
  root.querySelectorAll("[data-cal-add]").forEach(b=>b.onclick=()=>openTx(null,state.selectedDate));
  root.querySelectorAll("[data-collect]").forEach(b=>b.onclick=()=>openCollection(state.receivables.find(x=>x.id===b.dataset.collect)));
  root.querySelectorAll("[data-delete-debt]").forEach(b=>b.onclick=()=>deleteDebt(b.dataset.deleteDebt));
  root.querySelectorAll("[data-delete-receivable]").forEach(b=>b.onclick=()=>remove("receivables",b.dataset.deleteReceivable));
  root.querySelectorAll("[data-delete-rec]").forEach(b=>b.onclick=()=>remove("recurring_rules",b.dataset.deleteRec));
  root.querySelectorAll("[data-delete-goal]").forEach(b=>b.onclick=()=>remove("savings_goals",b.dataset.deleteGoal));
  root.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>$(b.dataset.action).showModal());
  const importBtn=$("importCsv");if(importBtn)importBtn.onclick=importCSV;
}
function dashboard(){
  const bal=balance("EUR"),inm=total("income","EUR",x=>x.transaction_date.slice(0,7)===today().slice(0,7)),outm=total("expense","EUR",x=>x.transaction_date.slice(0,7)===today().slice(0,7));
  const due=state.debts.reduce((s,d)=>s+(d.currency==="EUR"&&d.status!=="paid"?outstanding(d):0),0);
  const plusDays=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
  const end30=plusDays(30),end7=plusDays(7);
  const forecast30=state.transactions.filter(x=>x.type==="expense"&&x.currency==="EUR"&&x.transaction_date>=today()&&x.transaction_date<=end30).reduce((a,x)=>a+Number(x.amount),0);
  const recurring7=state.recurrences.filter(r=>r.active&&r.type==="expense"&&r.currency==="EUR").reduce((sum,r)=>sum+occurrencesBetween(r,today(),end7).reduce((a)=>a+Number(r.amount),0),0);
  const recent=state.transactions.slice(0,6);
  const futureGains=state.transactions.filter(x=>x.type==="income"&&x.transaction_date>today()).sort((a,b)=>a.transaction_date.localeCompare(b.transaction_date));
  const pendingReceivables=state.receivables.filter(x=>Number(x.amount)>Number(x.received_amount||0)).sort((a,b)=>(a.due_date||"9999-12-31").localeCompare(b.due_date||"9999-12-31"));
  const incomingRows=[
    ...futureGains.map(x=>({label:x.label,who:x.category||"Gain prévu",amount:Number(x.amount),currency:x.currency,date:x.transaction_date,kind:"Gain prévu"})),
    ...pendingReceivables.map(x=>({id:x.id,label:x.label,who:x.debtor,amount:Math.max(0,Number(x.amount)-Number(x.received_amount||0)),currency:x.currency,date:x.due_date,kind:"Somme à recevoir"}))
  ].sort((a,b)=>(a.date||"9999-12-31").localeCompare(b.date||"9999-12-31"));
  const incomingTotals={};incomingRows.forEach(x=>incomingTotals[x.currency]=(incomingTotals[x.currency]||0)+x.amount);
  const cats={};state.transactions.filter(x=>x.type==="expense"&&x.currency==="EUR").forEach(x=>cats[x.category||"Autre"]=(cats[x.category||"Autre"]||0)+Number(x.amount));
  const max=Math.max(1,...Object.values(cats));
  return `<div class="grid stats">
    ${stat("Solde actuel",money(bal),"Gains − dépenses passés et du jour","⌂")}
    ${stat("Gains ce mois",money(inm),"Entrées enregistrées","↗","positive")}
    ${stat("Dépenses ce mois",money(outm),"Sorties enregistrées","↘","negative")}
    ${stat("Dettes restantes",money(due),"Engagements non réglés","▤")}
  </div>
  <section class="card incoming-card">
    <div class="section-head"><div><h2>💰 ARGENT À VENIR</h2><p>Salaires et gains prévus, ainsi que les sommes que l'on doit vous rembourser.</p></div><button class="primary" data-action="receivableDialog">＋ Ajouter une somme à recevoir</button></div>
    <div class="incoming-totals">${Object.entries(incomingTotals).length?Object.entries(incomingTotals).map(([c,v])=>`<div><span>Total ${c}</span><strong>${money(v,c)}</strong></div>`).join(""):`<span class="muted tiny">Aucun montant attendu pour le moment.</span>`}</div>
    ${incomingRows.length?`<div class="tx-list">${incomingRows.map(x=>`<div class="tx-row"><div class="tx-icon incoming-icon">↗</div><div class="tx-info"><strong>${esc(x.label)}</strong><small>${esc(x.who)} · ${x.kind} · ${dateFR(x.date)}</small></div><div class="tx-amount positive">+${money(x.amount,x.currency)}</div>${x.id?`<button class="small-btn" data-collect="${x.id}">Reçu</button>`:""}</div>`).join("")}</div>`:`<div class="empty"><b>Rien à venir pour l'instant</b>Ajoutez une somme que quelqu'un vous doit, ou un gain avec une date future (par exemple votre prochain salaire).</div>`}
  </section>
  <div class="grid two-col">
    <section class="card"><div class="section-head"><div><h2>Répartition des dépenses</h2><p>Par catégorie · EUR</p></div></div>
    ${Object.keys(cats).length?Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill expense" style="width:${v/max*100}%"></div></div><b>${money(v)}</b></div>`).join(""):`<div class="empty"><b>Aucune dépense pour le moment</b>Ajoutez une opération pour commencer.</div>`}</section>
    <section class="card forecast-card"><div class="section-head"><div><h2>Prévision simplifiée</h2><p>Dépenses prévues sur 30 jours · récurrences sur 7 jours</p></div><span class="pill">EUR</span></div><div class="stat-value">${money(bal-forecast30-recurring7)}</div><div class="forecast-lines"><div><span>Dépenses ponctuelles · 30 jours</span><b class="negative">−${money(forecast30)}</b></div><div><span>Récurrences · 7 jours</span><b class="negative">−${money(recurring7)}</b></div></div><p class="muted tiny">Seules les dépenses à venir dans ces périodes sont prises en compte. Les autres devises sont exclues de ce calcul.</p><button class="secondary" data-action="recurringDialog">Ajouter une récurrence</button></section>
  </div>
  <section class="card" style="margin-top:16px"><div class="section-head"><div><h2>Dernières opérations</h2><p>Vos mouvements les plus récents</p></div><button class="secondary" data-tab-jump="Dépenses">Voir les opérations</button></div>${recent.length?`<div class="tx-list">${recent.map(txRow).join("")}</div>`:`<div class="empty"><b>Bienvenue dans Mon Budget</b>Ajoutez votre premier gain ou votre première dépense.</div>`}</section>`;
}
function stat(label,value,foot,icon,cls=""){return `<article class="card"><div class="stat-label"><span>${label}</span><b>${icon}</b></div><div class="stat-value ${cls}">${value}</div><div class="stat-foot">${foot}</div></article>`}
function txRow(t){return `<div class="tx-row"><div class="tx-icon">${t.type==="income"?"↗":"↘"}</div><div class="tx-info"><strong>${esc(t.label)}</strong><small>${dateFR(t.transaction_date)} · ${esc(t.category||"Sans catégorie")}</small></div><div class="tx-amount ${t.type==="income"?"positive":"negative"}">${t.type==="income"?"+":"−"}${money(t.amount,t.currency)}</div></div>`}
function transactionsPage(type){
  const arr=state.transactions.filter(x=>x.type===type);
  return `<section class="card"><div class="section-head"><div><h2>${type==="income"?"Tous mes gains":"Toutes mes dépenses"}</h2><p>${arr.length} opération(s)</p></div><button class="primary" data-action="transactionDialog">＋ Ajouter</button></div>
  ${arr.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Actions</th></tr></thead><tbody>${arr.map(t=>{const linked=state.debtPayments.some(p=>p.transaction_id===t.id);return `<tr><td>${dateFR(t.transaction_date)}</td><td><b>${esc(t.label)}</b></td><td>${esc(t.category||"—")}</td><td class="${type==="income"?"positive":"negative"}"><b>${money(t.amount,t.currency)}</b></td><td>${linked?`<button class="small-btn" data-tab-jump="Dettes">Gérer dans Dettes</button>`:`<div class="table-actions"><button class="small-btn" data-edit-tx="${t.id}">Modifier</button><button class="small-btn danger-btn" data-delete-tx="${t.id}">Supprimer</button></div>`}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty"><b>Aucune opération</b>Utilisez « Ajouter » pour enregistrer votre premier mouvement.</div>`}</section>`;
}
function debtsPage(){
 return `<div class="section-head"><div><h2>Dettes à rembourser</h2><p>Consultez vos dettes et gérez chaque remboursement enregistré.</p></div><button class="primary" data-action="debtDialog">＋ Ajouter une dette</button></div>
 <div class="grid debt-grid">${state.debts.map(d=>{const left=outstanding(d),pct=Number(d.amount)?(Number(d.paid_amount||0)/Number(d.amount))*100:0,payments=state.debtPayments.filter(p=>p.debt_id===d.id);return `<article class="card debt-card"><div class="debt-top"><div><h2>${esc(d.label)}</h2><p class="muted tiny">${esc(d.creditor)}</p></div><span class="pill ${left===0?"paid":""}">${left===0?"Payée":"À payer"}</span></div><div><div class="stat-value">${money(left,d.currency)}</div><div class="muted tiny">Restant sur ${money(d.amount,d.currency)} · déjà payé ${money(d.paid_amount||0,d.currency)}</div></div><div class="progress"><span style="width:${pct}%"></span></div><div class="muted tiny">Échéance : ${dateFR(d.due_date)}</div>${payments.length?`<div class="payment-history"><strong>Historique des remboursements</strong>${payments.map(p=>`<div class="payment-item"><div><b>${money(p.amount,d.currency)}</b><small>${dateFR(p.payment_date)}</small></div><div class="table-actions"><button class="small-btn" data-edit-payment="${p.id}">Modifier</button><button class="small-btn danger-btn" data-delete-payment="${p.id}">Retirer</button></div></div>`).join("")}</div>`:`<p class="muted tiny">Aucun remboursement enregistré.</p>`}<div class="table-actions">${left>0?`<button class="primary" data-pay="${d.id}">＋ Enregistrer un paiement</button>`:""}<button class="small-btn danger-btn" data-delete-debt="${d.id}">Supprimer la dette</button></div></article>`}).join("")||`<div class="card empty"><b>Aucune dette enregistrée</b>Ajoutez un engagement pour suivre son remboursement.</div>`}</div>`;
}
function recurrencesPage(){return `<div class="section-head"><div><h2>Opérations récurrentes</h2><p>Règles de suivi à fréquence régulière.</p></div><button class="primary" data-action="recurringDialog">＋ Ajouter</button></div><section class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Libellé</th><th>Type</th><th>Montant</th><th>Fréquence</th><th>Début</th><th></th></tr></thead><tbody>${state.recurrences.map(r=>`<tr><td><b>${esc(r.label)}</b></td><td>${r.type==="income"?"Gain":"Dépense"}</td><td>${money(r.amount,r.currency)}</td><td>${freqLabel(r.frequency)}</td><td>${dateFR(r.start_date)}</td><td><button class="small-btn danger-btn" data-delete-rec="${r.id}">Supprimer</button></td></tr>`).join("")}</tbody></table></div>${state.recurrences.length?"":`<div class="empty">Aucune récurrence configurée.</div>`}</section>`}
function freqLabel(f){return ({weekly:"Hebdomadaire",biweekly:"Toutes les 2 semaines",monthly:"Mensuelle",quarterly:"Trimestrielle",yearly:"Annuelle"})[f]||f}
function calendarPage(){
 const shown=state.calendarDate,y=shown.getFullYear(),m=shown.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),monthLabel=shown.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
 const byDate={};state.transactions.forEach(t=>(byDate[t.transaction_date]??=[]).push(t));
 state.recurrences.filter(r=>r.active).forEach(r=>occurrencesBetween(r,`${y}-${String(m+1).padStart(2,"0")}-01`,`${y}-${String(m+1).padStart(2,"0")}-${String(days).padStart(2,"0")}`).forEach(date=>(byDate[date]??=[]).push({isRecurring:true,label:r.label,type:r.type,amount:r.amount,currency:r.currency,transaction_date:date,category:"Récurrence"})));
 let cells=Array.from({length:offset},()=>`<div class="calendar-blank"></div>`).join("");
 for(let d=1;d<=days;d++){const date=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,items=byDate[date]||[],selected=state.selectedDate===date,isToday=date===today();cells+=`<button type="button" class="calendar-day ${selected?"selected":""} ${isToday?"is-today":""}" data-cal-day="${date}"><strong>${d}</strong><span class="calendar-dots">${items.slice(0,4).map(t=>`<i class="dot ${t.type==="income"?"income-dot":"expense-dot"}"></i>`).join("")}</span>${items.length?`<small>${items.length} op.</small>`:""}</button>`}
 const selectedItems=byDate[state.selectedDate]||[];
 return `<section class="card calendar-card"><div class="calendar-toolbar"><button class="icon-btn" data-cal-nav="-1" aria-label="Mois précédent">‹</button><div><h2>${monthLabel}</h2><p class="muted tiny">Touchez une date pour voir ses opérations</p></div><button class="icon-btn" data-cal-nav="1" aria-label="Mois suivant">›</button></div><div class="calendar-legend"><span><i class="dot income-dot"></i> Gains</span><span><i class="dot expense-dot"></i> Dépenses</span></div><div class="calendar-grid">${["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(x=>`<b class="calendar-weekday">${x}</b>`).join("")}${cells}</div></section><section class="card selected-day-card"><div class="section-head"><div><h2>${dateFR(state.selectedDate)}</h2><p>${selectedItems.length} opération(s) enregistrée(s)</p></div><button class="primary" data-cal-add>＋ Ajouter à cette date</button></div>${selectedItems.length?`<div class="tx-list">${selectedItems.map(t=>t.isRecurring?`<div class="tx-row"><div class="tx-icon">⟳</div><div class="tx-info"><strong>${esc(t.label)}</strong><small>${dateFR(t.transaction_date)} · Récurrence prévue</small></div><div class="tx-amount ${t.type==="income"?"positive":"negative"}">${t.type==="income"?"+":"−"}${money(t.amount,t.currency)}</div></div>`:txRow(t)).join("")}</div>`:`<div class="empty compact-empty">Aucune opération pour cette date.</div>`}</section>`;
}
function occurrencesBetween(rule,start,end){
 const result=[],anchor=new Date((rule.start_date||start)+"T12:00:00"),from=new Date(start+"T12:00:00"),to=new Date(end+"T12:00:00"),freq=rule.frequency;let d=new Date(anchor),guard=0;
 const advance=cur=>{if(freq==="weekly")return new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()+7,12);if(freq==="biweekly")return new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()+14,12);if(freq==="monthly"||freq==="quarterly"){const step=freq==="monthly"?1:3,month=cur.getMonth()+step,year=cur.getFullYear()+Math.floor(month/12),normalized=month%12;return new Date(year,normalized,Math.min(anchor.getDate(),new Date(year,normalized+1,0).getDate()),12);}if(freq==="yearly"){const year=cur.getFullYear()+1;return new Date(year,cur.getMonth(),Math.min(anchor.getDate(),new Date(year,cur.getMonth()+1,0).getDate()),12);}return null;};
 while(d<from&&guard++<500){const next=advance(d);if(!next||next<=d)return result;d=next;}
 while(d<=to&&guard++<1000){result.push(d.toISOString().slice(0,10));const next=advance(d);if(!next||next<=d)break;d=next;}return result;
}

function currenciesPage(){const codes=[...new Set(["EUR",...state.transactions.map(t=>t.currency),...state.debts.map(d=>d.currency),...state.receivables.map(r=>r.currency)])];return `<section class="card"><h2>Soldes par devise</h2><p class="muted tiny">Les montants restent dans leur devise d'origine. Aucun taux de change n'est appliqué automatiquement.</p>${codes.map(c=>`<div class="tx-row"><div class="tx-icon">◎</div><div class="tx-info"><strong>${c}</strong><small>Gains − dépenses enregistrés</small></div><div class="tx-amount">${money(balance(c),c)}</div></div>`).join("")}</section>`}
function bankPage(){return `<section class="card"><h2>Importer un relevé CSV</h2><p class="muted">Format attendu : date;nom;montant;type;devise;catégorie. Les montants négatifs sont interprétés comme des dépenses si le type est absent.</p><label>Choisir un fichier CSV<input type="file" id="csvFile" accept=".csv,text/csv"></label><button id="importCsv" class="primary">Importer les opérations</button><p id="csvMessage" class="message"></p><p class="tiny muted">Vérifiez votre fichier avant l'import. Les lignes invalides sont ignorées.</p></section><section class="card" style="margin-top:15px"><h2>Lecture de captures d'écran</h2><p class="muted">L'OCR d'images et l'analyse automatique de relevés ne sont pas encore activés dans cette version. Ne téléversez pas de relevés contenant des données sensibles vers un service tiers sans en comprendre les conditions.</p><span class="pill">À connecter</span></section>`}
function savingsPage(){return `<div class="section-head"><div><h2>Objectifs d'épargne</h2><p>Suivez vos projets et vos progrès.</p></div><button class="primary" id="newGoal">＋ Nouvel objectif</button></div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">${state.goals.map(g=>`<section class="card"><h2>${esc(g.label)}</h2><div class="goal"><div class="goal-line"><span>${money(g.saved_amount,g.currency)} économisés</span><b>${money(g.target_amount,g.currency)}</b></div><div class="progress"><span style="width:${Math.min(100,Number(g.saved_amount)/Number(g.target_amount)*100)}%"></span></div></div><button class="small-btn danger-btn" data-delete-goal="${g.id}">Supprimer</button></section>`).join("")||`<section class="card empty"><b>Aucun objectif</b>Créez un objectif d'épargne pour commencer.</section>`}</div>`;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function openTx(t=null,dateOverride=null){$("transactionForm").reset();$("transactionId").value=t?.id||"";$("txType").value=t?.type|| (state.tab==="Gains"?"income":"expense");$("txLabel").value=t?.label||"";$("txAmount").value=t?.amount||"";$("txCurrency").value=t?.currency||"EUR";$("txDate").value=t?.transaction_date||dateOverride||today();$("txCategory").value=t?.category||"";$("txNote").value=t?.note||"";$("transactionDialogTitle").textContent=t?"Modifier une opération":"Ajouter une opération";$("transactionDialog").showModal();}
function openPayment(d){$("paymentForm").reset();$("paymentEditId").value="";$("paymentDialogTitle").textContent="Enregistrer un paiement";$("paymentSubmit").textContent="Confirmer le paiement";$("paymentDebtId").value=d.id;$("paymentDebtInfo").textContent=`${d.label} — restant : ${money(outstanding(d),d.currency)}`;$("paymentAmount").max=outstanding(d);$("paymentDate").value=today();$("paymentDialog").showModal();}
function openPaymentEdit(p){const d=state.debts.find(x=>x.id===p.debt_id);if(!d)return;$("paymentForm").reset();$("paymentDebtId").value=d.id;$("paymentEditId").value=p.id;$("paymentDebtInfo").textContent=`Modification du remboursement — ${d.label}`;$("paymentAmount").max=Number(d.amount);$("paymentAmount").value=p.amount;$("paymentDate").value=p.payment_date;$("paymentDialogTitle").textContent="Modifier le remboursement";$("paymentSubmit").textContent="Enregistrer les modifications";$("paymentDialog").showModal();}
async function deleteDebtPayment(p){
  if(!p||!confirm("Retirer ce remboursement ? Le solde de la dette et la dépense associée seront recalculés."))return;
  const d=state.debts.find(x=>x.id===p.debt_id);
  if(!d)return;
  const oldPaid=Number(d.paid_amount||0),paid=Math.max(0,oldPaid-Number(p.amount));
  let paymentDeleted=false;
  try{
    const {error:debtError}=await supabase.from("debts").update({paid_amount:paid,status:paid>=Number(d.amount)?"paid":"pending"}).eq("id",d.id);
    if(debtError)throw debtError;
    const {error:paymentError}=await supabase.from("debt_payments").delete().eq("id",p.id);
    if(paymentError)throw paymentError;
    paymentDeleted=true;
    if(p.transaction_id){
      const {error:txError}=await supabase.from("transactions").delete().eq("id",p.transaction_id);
      if(txError)throw txError;
    }
    await loadAll();
  }catch(err){
    if(paymentDeleted)await supabase.from("debt_payments").insert(p);
    await supabase.from("debts").update({paid_amount:oldPaid,status:oldPaid>=Number(d.amount)?"paid":"pending"}).eq("id",d.id);
    alert("Impossible de retirer le remboursement : "+err.message);
  }
}
async function deleteDebt(id){
  const d=state.debts.find(x=>x.id===id);
  if(!d||!confirm("Supprimer cette dette et son historique de remboursements ? Les dépenses de remboursement associées seront également supprimées."))return;
  try{
    const payments=state.debtPayments.filter(p=>p.debt_id===id);
    const txIds=payments.map(p=>p.transaction_id).filter(Boolean);
    if(txIds.length){
      const {error}=await supabase.from("transactions").delete().in("id",txIds);
      if(error)throw error;
    }
    const {error}=await supabase.from("debts").delete().eq("id",id);
    if(error)throw error;
    await loadAll();
  }catch(err){alert("Impossible de supprimer la dette : "+err.message);}
}
function openCollection(r){$("collectionForm").reset();$("collectionId").value=r.id;$("collectionInfo").textContent=`${r.label} — restant à recevoir : ${money(Number(r.amount)-Number(r.received_amount||0),r.currency)}`;$("collectionAmount").max=Number(r.amount)-Number(r.received_amount||0);$("collectionDate").value=today();$("collectionDialog").showModal();}
$("loginTab").onclick=()=>setAuthMode("login");$("signupTab").onclick=()=>setAuthMode("signup");
function setAuthMode(m){state.authMode=m;$("loginTab").classList.toggle("active",m==="login");$("signupTab").classList.toggle("active",m==="signup");$("authSubmit").textContent=m==="login"?"Se connecter":"Créer mon compte";}
$("authForm").onsubmit=async e=>{e.preventDefault();if(!supabase){setMessage("authMessage","Configurez d'abord l'URL et la clé publique Supabase dans app.js.");return;}const email=$("email").value,password=$("password").value;try{const res=state.authMode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});if(res.error)throw res.error;if(state.authMode==="signup"&&!res.data.session){setMessage("authMessage","Compte créé. Vérifiez votre e-mail pour confirmer l'inscription.",false);return;}state.user=res.data.user;showApp();}catch(err){setMessage("authMessage",err.message);}};
$("logout").onclick=async()=>{await supabase.auth.signOut();state.user=null;showAuth();};
$("addQuick").onclick=()=>openTx();
$("transactionForm").onsubmit=async e=>{e.preventDefault();try{const payload={user_id:state.user.id,type:$("txType").value,label:$("txLabel").value.trim(),amount:Number($("txAmount").value),currency:$("txCurrency").value,transaction_date:$("txDate").value,category:$("txCategory").value.trim()||null,note:$("txNote").value.trim()||null};const id=$("transactionId").value;if(id)await update("transactions",id,payload);else await insert("transactions",payload);$("transactionDialog").close();}catch(err){setMessage("txError",err.message);}};
$("debtForm").onsubmit=async e=>{e.preventDefault();try{await insert("debts",{user_id:state.user.id,label:$("debtLabel").value.trim(),creditor:$("debtCreditor").value.trim(),amount:Number($("debtAmount").value),paid_amount:0,currency:$("debtCurrency").value,due_date:$("debtDue").value||null,status:"pending"});$("debtDialog").close();}catch(err){setMessage("debtError",err.message);}};
$("receivableForm").onsubmit=async e=>{e.preventDefault();try{await insert("receivables",{user_id:state.user.id,label:$("receivableLabel").value.trim(),debtor:$("receivableDebtor").value.trim(),amount:Number($("receivableAmount").value),received_amount:0,currency:$("receivableCurrency").value,due_date:$("receivableDue").value||null,status:"pending"});$("receivableDialog").close();}catch(err){setMessage("receivableError",err.message);}};
$("collectionForm").onsubmit=async e=>{
  e.preventDefault();
  const r=state.receivables.find(x=>x.id===$("collectionId").value);
  const amt=Number($("collectionAmount").value);
  const remaining=r?Number(r.amount)-Number(r.received_amount||0):0;
  if(!r||amt<=0||amt>remaining){setMessage("collectionError","Montant invalide ou supérieur au montant restant à recevoir.");return;}
  let transactionId=null;
  try{
    const {data:tx,error:txError}=await supabase.from("transactions").insert({
      user_id:state.user.id,type:"income",label:`Somme reçue : ${r.label}`,amount:amt,
      currency:r.currency,transaction_date:$("collectionDate").value,
      category:"Remboursement reçu",note:`Versé par : ${r.debtor}`
    }).select("id").single();
    if(txError)throw txError;
    transactionId=tx.id;
    const received=Number(r.received_amount||0)+amt;
    const {error:updateError}=await supabase.from("receivables").update({
      received_amount:received,status:received>=Number(r.amount)?"received":"pending"
    }).eq("id",r.id);
    if(updateError)throw updateError;
    $("collectionDialog").close();
    await loadAll();
  }catch(err){
    if(transactionId)await supabase.from("transactions").delete().eq("id",transactionId);
    setMessage("collectionError",err.message);
  }
};
$("paymentForm").onsubmit=async e=>{
  e.preventDefault();
  const d=state.debts.find(x=>x.id===$("paymentDebtId").value);
  const amt=Number($("paymentAmount").value);
  const editId=$("paymentEditId").value;
  const existing=editId?state.debtPayments.find(p=>p.id===editId):null;
  const oldAmount=Number(existing?.amount||0);
  const limit=d?Number(d.amount)-Number(d.paid_amount||0)+oldAmount:0;
  if(!d||amt<=0||amt>limit){setMessage("paymentError","Montant invalide ou supérieur au montant restant dû.");return;}
  const paymentDate=$("paymentDate").value;
  const oldPaid=Number(d.paid_amount||0);
  let createdTransactionId=null;
  try{
    if(existing){
      if(existing.transaction_id){
        const {error}=await supabase.from("transactions").update({amount:amt,transaction_date:paymentDate}).eq("id",existing.transaction_id);
        if(error)throw error;
      }
      const {error:paymentError}=await supabase.from("debt_payments").update({amount:amt,payment_date:paymentDate}).eq("id",existing.id);
      if(paymentError)throw paymentError;
    }else{
      const {data:tx,error:txError}=await supabase.from("transactions").insert({
        user_id:state.user.id,type:"expense",label:`Remboursement : ${d.label}`,amount:amt,
        currency:d.currency,transaction_date:paymentDate,category:"Remboursement",note:`Créancier : ${d.creditor}`
      }).select("id").single();
      if(txError)throw txError;
      createdTransactionId=tx.id;
      const {error:paymentError}=await supabase.from("debt_payments").insert({
        user_id:state.user.id,debt_id:d.id,transaction_id:tx.id,amount:amt,payment_date:paymentDate
      });
      if(paymentError)throw paymentError;
    }
    const paid=existing?Math.max(0,oldPaid-oldAmount+amt):oldPaid+amt;
    const {error:debtError}=await supabase.from("debts").update({
      paid_amount:paid,status:paid>=Number(d.amount)?"paid":"pending"
    }).eq("id",d.id);
    if(debtError)throw debtError;
    $("paymentDialog").close();
    $("paymentEditId").value="";
    $("paymentDialogTitle").textContent="Enregistrer un paiement";
    $("paymentSubmit").textContent="Confirmer le paiement";
    await loadAll();
  }catch(err){
    if(createdTransactionId){
      await supabase.from("debt_payments").delete().eq("transaction_id",createdTransactionId);
      await supabase.from("transactions").delete().eq("id",createdTransactionId);
    }else if(existing){
      await supabase.from("debt_payments").update({amount:oldAmount,payment_date:existing.payment_date}).eq("id",existing.id);
      if(existing.transaction_id)await supabase.from("transactions").update({amount:oldAmount,transaction_date:existing.payment_date}).eq("id",existing.transaction_id);
    }
    setMessage("paymentError",err.message);
  }
};
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
