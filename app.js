
const API='/api';
let token=localStorage.getItem('cp_token'),currentUser=null,dark=localStorage.getItem('cp_dark')==='1';
let editingId=null,viewingId=null,editingUserId=null,clients=[],auditLog=[],users=[];
const FL={naam:'Naam',bsn:'BSN',status:'Status',klant:'Klant',locatie:'Locatie',begeleider_1:'Begeleider 1',begeleider_2:'Begeleider 2',datum_start:'Datum start',einde_beschikking:'Einde beschikking',bedrag_beschikt:'Bedrag',gefactureerd:'Gefactureerd',betaald:'Betaald',uur_per_week:'Uur/week'};
const DOTMAP={edit:'dot-edit',add:'dot-add',delete:'dot-delete',note:'dot-note',status:'dot-status'};
const PVL={full:{l:'Volledig',c:'pv-full'},read:{l:'Inzien',c:'pv-read'},none:{l:'Geen',c:'pv-none'}};
const ROLES_DEF=[
  {k:'admin',l:'Admin',d:'Volledige toegang',ic:'A',bg:'#dbeafe',tc:'#1e40af',p:{'Cliënten bekijken':'full','Cliënten bewerken':'full','Cliënten verwijderen':'full','Configuratie':'full','Gebruikers':'full'}},
  {k:'bewerker',l:'Bewerker',d:'Kan cliënten bewerken',ic:'B',bg:'#dcfce7',tc:'#166534',p:{'Cliënten bekijken':'full','Cliënten bewerken':'full','Cliënten verwijderen':'none','Configuratie':'none','Gebruikers':'none'}},
  {k:'alleen_lezen',l:'Alleen lezen',d:'Alleen inzien',ic:'L',bg:'#f1f0e8',tc:'#44403c',p:{'Cliënten bekijken':'full','Cliënten bewerken':'none','Cliënten verwijderen':'none','Configuratie':'none','Gebruikers':'none'}},
];
const CFG_DEF={
  locatie:{l:'Locaties',c:'tg-l',i:['Smederij','Ambulant','TFR','Dagbesteding','Stage']},
  begeleider:{l:'Begeleiders',c:'tg-b',i:['Lennart','Floris','Taru','Britt','Olger','Bente','Laurien','Jantine','Claire']},
  klant:{l:'Klanten',c:'tg-k',i:['Dronten','Kampen','Zwolle','Intern','Klaver4You','RIBW','PGB','Gemeente Olst-Wijhe','Boslust Dependance de Laarakkers','Stapsgewijs','Gemeente Lelystad','Gemeente Hardenberg','Menso','Gemeente Aa en Hunze']},
  product:{l:'Producten',c:'tg-p',i:['Individueel','Dagbesteding']},
  eenheid:{l:'Eenheden',c:'tg-e',i:['Maand','Week','Dagdeel','Uur','Minuut']},
};
const AVC=[['#dbeafe','#1e40af'],['#dcfce7','#166534'],['#ede9fe','#4c1d95'],['#fef3cd','#7a4f00'],['#ffe4e6','#881337'],['#f1f0e8','#44403c']];
async function api(method,path,body){const opts={method,headers:{'Content-Type':'application/json'}};if(token)opts.headers['Authorization']='Bearer '+token;if(body)opts.body=JSON.stringify(body);const r=await fetch(API+path,opts);if(r.status===401){doLogout();return null;}if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||r.statusText);}if(r.status===204)return null;return r.json();}
async function doLogin(){const email=document.getElementById('l-email').value,pass=document.getElementById('l-pass').value,err=document.getElementById('login-err');err.style.display='none';try{const form=new FormData();form.append('username',email);form.append('password',pass);const r=await fetch(API+'/auth/login',{method:'POST',body:form});if(!r.ok){err.style.display='block';return;}const data=await r.json();token=data.access_token;currentUser=data.user;localStorage.setItem('cp_token',token);startApp();}catch(e){err.style.display='block';}}
function doLogout(){token=null;currentUser=null;localStorage.removeItem('cp_token');document.getElementById('login-wrap').style.display='flex';document.getElementById('shell').classList.remove('visible');}
async function startApp(){if(!token)return;try{if(!currentUser)currentUser=await api('GET','/auth/me');if(!currentUser)return;}catch(e){doLogout();return;}document.getElementById('login-wrap').style.display='none';document.getElementById('shell').classList.add('visible');document.getElementById('nav-user').textContent=currentUser.naam+' · '+rolLabel(currentUser.role);const isAdmin=currentUser.role==='admin',canWrite=currentUser.role!=='alleen_lezen';if(isAdmin)document.getElementById('tab-settings').style.display='';if(canWrite)document.getElementById('btn-add-client').style.display='';if(dark)applyDark();await loadAll();renderList();renderRoles();if(isAdmin){renderUsers();renderConfig();}}
function rolLabel(r){return{admin:'Admin',bewerker:'Bewerker',alleen_lezen:'Alleen lezen'}[r]||r;}
async function loadAll(){try{clients=await api('GET','/clienten/')||[];}catch(e){clients=[];}try{auditLog=await api('GET','/audit/')||[];}catch(e){auditLog=[];}if(currentUser.role==='admin'){try{users=await api('GET','/gebruikers/')||[];}catch(e){users=[];}}}
function tDark(){dark=!dark;localStorage.setItem('cp_dark',dark?'1':'0');applyDark();}
function applyDark(){document.body.classList.toggle('dark',dark);document.getElementById('dlbl').textContent=dark?'Licht':'Donker';}
function sw(id,btn){document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));document.querySelectorAll('#main-tabs .tab').forEach(b=>b.classList.remove('on'));document.getElementById('s-'+id).classList.add('on');if(btn)btn.classList.add('on');if(id==='log')renderGlobalLog();if(id==='settings'){renderRoles();if(currentUser.role==='admin'){renderUsers();renderConfig();}}}
function swSub(id,btn){document.querySelectorAll('.sub').forEach(s=>s.classList.remove('on'));document.querySelectorAll('#s-settings .tabs .tab').forEach(b=>b.classList.remove('on'));document.getElementById(id).classList.add('on');if(btn)btn.classList.add('on');}
function backToList(){document.getElementById('tab-detail').style.display='none';sw('list',document.querySelector('#main-tabs .tab'));}
function fmtD(d){if(!d)return'—';const p=String(d).substring(0,10).split('-');return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:d;}
function fmtE(v){if(v===null||v===undefined||v==='')return'—';return'€'+parseFloat(v).toLocaleString('nl-NL',{minimumFractionDigits:2});}
function stBadge(s){const m={'In zorg':'b-active','Uit Zorg':'b-ended'};return`<span class="badge ${m[s]||'b-other'}">${s}</span>`;}
function renderStats(){const a=clients.filter(c=>c.status==='In zorg').length,e=clients.filter(c=>c.status==='Uit Zorg').length,o=clients.filter(c=>c.status!=='In zorg'&&c.status!=='Uit Zorg').length;document.getElementById('stats-bar').innerHTML=`<div class="stat"><div class="stat-l">In zorg</div><div class="stat-v" style="color:#0F6E56">${a}</div></div><div class="stat"><div class="stat-l">Uit zorg</div><div class="stat-v" style="color:#712B13">${e}</div></div><div class="stat"><div class="stat-l">Overig</div><div class="stat-v" style="color:#854F0B">${o}</div></div><div class="stat"><div class="stat-l">Totaal</div><div class="stat-v">${clients.length}</div></div>`;}
function renderList(){renderStats();renderFinancieel();const q=(document.getElementById('srch').value||'').toLowerCase(),fs=document.getElementById('fstat').value,canWrite=currentUser&&currentUser.role!=='alleen_lezen',rows=clients.filter(c=>(!q||c.naam.toLowerCase().includes(q)||(c.klant||'').toLowerCase().includes(q)||(c.begeleider_1||'').toLowerCase().includes(q))&&(!fs||c.status===fs)),tb=document.getElementById('list-tbody');if(!rows.length){tb.innerHTML=`<tr><td colspan="8"><div class="empty-state">Geen cliënten gevonden</div></td></tr>`;return;}tb.innerHTML=rows.map(c=>`<tr class="row-link" onclick="openDetail('${c.id}')"><td style="font-weight:500">${c.naam}</td><td>${stBadge(c.status)}</td><td>${c.klant||'—'}</td><td>${fmtD(c.datum_start)}</td><td>${fmtD(c.einde_beschikking)}</td><td>${[c.begeleider_1,c.begeleider_2].filter(Boolean).join(', ')||'—'}</td><td style="color:var(--t3);font-size:12px">${c.notitie?c.notitie.substring(0,35)+(c.notitie.length>35?'…':''):'—'}</td><td onclick="event.stopPropagation()" style="white-space:nowrap">${canWrite?`<button class="xbtn" onclick="openModal('${c.id}')">✎</button>`:''} ${canWrite?`<button class="xbtn delbtn" onclick="delClient('${c.id}')">✕</button>`:''}</td></tr>`).join('');}
async function openDetail(id){viewingId=id;const c=clients.find(x=>x.id===id);if(!c)return;document.getElementById('tab-detail').style.display='';document.getElementById('tab-detail').textContent='Dossier: '+c.naam;sw('detail',document.getElementById('tab-detail'));let clog=[];try{clog=await api('GET',`/clienten/${id}/audit`)||[];}catch(e){}const canWrite=currentUser&&currentUser.role!=='alleen_lezen',logHtml=clog.length?clog.map(e=>auditHtml(e)).join(''):`<div class="empty-state">Nog geen wijzigingen geregistreerd.</div>`;document.getElementById('detail-content').innerHTML=`<div class="detail-hdr"><div><div class="detail-name">${c.naam} <span class="chip">${c.bsn||'geen BSN'}</span></div><div class="detail-sub">${c.klant||'Onbekende klant'} · ${[c.begeleider_1,c.begeleider_2].filter(Boolean).join(' & ')||'Geen begeleider'}</div></div><div style="display:flex;gap:8px;align-items:center">${stBadge(c.status)}${canWrite?`<button class="abtn" onclick="openModal('${c.id}')">✎ Bewerken</button>`:''}</div></div><div class="dgrid"><div class="dcard"><div class="dcard-t">Zorgperiode</div><div class="irow"><span class="ik">Datum start</span><span class="iv">${fmtD(c.datum_start)}</span></div><div class="irow"><span class="ik">Einde beschikking</span><span class="iv">${fmtD(c.einde_beschikking)}</span></div><div class="irow"><span class="ik">Datum sluiting</span><span class="iv">${fmtD(c.datum_sluiting)}</span></div><div class="irow"><span class="ik">Locatie</span><span class="iv">${c.locatie||'—'}</span></div><div class="irow"><span class="ik">Uur/dagdeel p/w</span><span class="iv">${c.uur_per_week||'—'}</span></div></div><div class="dcard"><div class="dcard-t">Financiën</div><div class="irow"><span class="ik">Bedrag beschikt</span><span class="iv">${fmtE(c.bedrag_beschikt)}</span></div><div class="irow"><span class="ik">Gefactureerd</span><span class="iv">${fmtE(c.gefactureerd)}</span></div><div class="irow"><span class="ik">Betaald</span><span class="iv">${fmtE(c.betaald)}</span></div><div class="irow"><span class="ik">Enquête gestuurd</span><span class="iv">${c.enquete_gestuurd||'—'}</span></div></div></div><div class="dcard" style="margin-bottom:1.25rem"><div class="dcard-t">Notities</div>${canWrite?`<textarea class="notes-area" id="notes-input">${c.notitie||''}</textarea><div class="notes-footer"><span class="notes-meta" id="notes-meta">${c.notitie?'Notitie aanwezig':'Nog geen notitie'}</span><button class="save-note" onclick="saveNote('${c.id}')">Notitie opslaan</button></div>`:`<div style="font-size:13px;color:var(--t2);padding:8px 0;line-height:1.6">${c.notitie||'Geen notitie'}</div>`}</div><div class="dcard"><div class="dcard-t" style="margin-bottom:12px">Auditlogboek <span class="chip">${clog.length} wijzigingen</span></div><div class="audit-list" id="client-log">${logHtml}</div></div>`;}
async function saveNote(id){const notitie=document.getElementById('notes-input').value;try{await api('PATCH',`/clienten/${id}/notitie`,{notitie});const c=clients.find(x=>x.id===id);if(c)c.notitie=notitie;const meta=document.getElementById('notes-meta');if(meta)meta.textContent='Opgeslagen';const now=new Date(),ts=`${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;const entry={type:'note',user_naam:currentUser.naam,actie:'Notitie bijgewerkt',veld:null,oude_waarde:null,nieuwe_waarde:'(notitie opgeslagen)',tijdstip:ts};const cl=document.getElementById('client-log');if(cl)cl.insertAdjacentHTML('afterbegin',auditHtml(entry));}catch(e){alert('Fout bij opslaan: '+e.message);}}
function auditHtml(e){const diff=(e.veld&&e.oude_waarde&&e.nieuwe_waarde)?`<div class="adiff"><span class="aold">✕ ${e.oude_waarde}</span> &nbsp;→&nbsp; <span class="anew">✓ ${e.nieuwe_waarde}</span></div>`:(e.type==='note'&&e.nieuwe_waarde?`<div class="adiff" style="font-style:italic;color:var(--t2)">"${e.nieuwe_waarde}"</div>`:''),ts=e.tijdstip?String(e.tijdstip).substring(0,16).replace('T',' '):'';return `<div class="aentry"><div class="adot ${DOTMAP[e.type]||'dot-edit'}"></div><div class="abody"><div class="aaction"><strong>${e.user_naam}</strong> — ${e.actie}${e.veld?` <span style="color:var(--t3);font-size:12px">(${FL[e.veld]||e.veld})</span>`:''}</div>${diff}<div class="ameta"><span>${ts}</span>${e.client_naam?`<span style="color:var(--acc);cursor:pointer" onclick="openDetail('${e.client_id}')">${e.client_naam}</span>`:''}</div></div></div>`;}
function renderGlobalLog(){const f=document.getElementById('log-filter').value,rows=f?auditLog.filter(e=>e.type===f):auditLog;document.getElementById('log-count').textContent=rows.length+' wijzigingen';const el=document.getElementById('global-log-list');el.innerHTML=rows.length?rows.map(e=>auditHtml(e)).join(''):`<div class="empty-state">Geen wijzigingen gevonden.</div>`;}
function openModal(id){
  editingId=id;
  document.getElementById('modal-title').textContent=id?'Cliënt bewerken':'Cliënt toevoegen';
  const c=id?clients.find(x=>x.id===id):null;
  const g=(fid,val)=>{const el=document.getElementById(fid);if(el)el.value=val||'';};
  // Vul dropdowns vanuit configuratie
  const klantSel=document.getElementById('f-klant');
  klantSel.innerHTML='<option value=""></option>'+CFG_DEF.klant.i.map(k=>`<option value="${k}">${k}</option>`).join('');
  const locSel=document.getElementById('f-locatie');
  locSel.innerHTML='<option value=""></option>'+CFG_DEF.locatie.i.map(k=>`<option value="${k}">${k}</option>`).join('');
  const beg1Sel=document.getElementById('f-beg1');
  beg1Sel.innerHTML='<option value=""></option>'+CFG_DEF.begeleider.i.map(k=>`<option value="${k}">${k}</option>`).join('');
  const beg2Sel=document.getElementById('f-beg2');
  beg2Sel.innerHTML='<option value=""></option>'+CFG_DEF.begeleider.i.map(k=>`<option value="${k}">${k}</option>`).join('');
  g('f-naam',c?.naam);g('f-bsn',c?.bsn);g('f-geb',c?.geboortedatum?.substring?.(0,10));
  g('f-status',c?.status||'In zorg');g('f-klant',c?.klant);
  g('f-start',c?.datum_start?.substring?.(0,10));g('f-einde',c?.einde_beschikking?.substring?.(0,10));
  g('f-sluiting',c?.datum_sluiting?.substring?.(0,10));g('f-locatie',c?.locatie);
  g('f-beg1',c?.begeleider_1);g('f-beg2',c?.begeleider_2);
  g('f-bedrag',c?.bedrag_beschikt);g('f-gefact',c?.gefactureerd);g('f-betaald',c?.betaald);
  g('f-uur',c?.uur_per_week);g('f-enquete',c?.enquete_gestuurd);g('f-opm',c?.opmerkingen);
  document.getElementById('edit-modal').classList.add('open');
}
function closeModal(){document.getElementById('edit-modal').classList.remove('open');}
async function saveClient(){const naam=document.getElementById('f-naam').value.trim();if(!naam)return;const body={naam,bsn:document.getElementById('f-bsn').value||null,geboortedatum:document.getElementById('f-geb').value||null,status:document.getElementById('f-status').value,klant:document.getElementById('f-klant').value||null,locatie:document.getElementById('f-locatie').value||null,begeleider_1:document.getElementById('f-beg1').value||null,begeleider_2:document.getElementById('f-beg2').value||null,datum_start:document.getElementById('f-start').value||null,einde_beschikking:document.getElementById('f-einde').value||null,datum_sluiting:document.getElementById('f-sluiting').value||null,bedrag_beschikt:parseFloat(document.getElementById('f-bedrag').value)||null,gefactureerd:parseFloat(document.getElementById('f-gefact').value)||null,betaald:parseFloat(document.getElementById('f-betaald').value)||null,uur_per_week:document.getElementById('f-uur').value||null,enquete_gestuurd:document.getElementById('f-enquete').value||null,opmerkingen:document.getElementById('f-opm').value||null};try{if(editingId){const u=await api('PUT',`/clienten/${editingId}`,body);Object.assign(clients.find(c=>c.id===editingId)||{},u||body);}else{const cr=await api('POST','/clienten/',body);clients.push(cr);}auditLog=await api('GET','/audit/')||auditLog;closeModal();renderList();if(editingId&&viewingId===editingId)openDetail(editingId);}catch(e){alert('Fout: '+e.message);}}
async function delClient(id){if(!confirm('Cliënt verwijderen?'))return;try{await api('DELETE',`/clienten/${id}`);clients=clients.filter(c=>c.id!==id);if(viewingId===id){document.getElementById('tab-detail').style.display='none';backToList();}renderList();}catch(e){alert('Fout: '+e.message);}}
function renderRoles(){document.getElementById('roles-grid').innerHTML=ROLES_DEF.map(r=>`<div class="rcard"><div class="rcard-hdr"><div class="rico" style="background:${r.bg};color:${r.tc}">${r.ic}</div><div><div class="rname">${r.l}</div><div class="rdesc">${r.d}</div></div></div><div>${Object.entries(r.p).map(([k,v])=>`<div class="prow"><span>${k}</span><span class="pvb ${PVL[v].c}">${PVL[v].l}</span></div>`).join('')}</div></div>`).join('');const ps=Object.keys(ROLES_DEF[0].p);document.getElementById('mx').innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;padding:7px 10px;color:var(--t2);border-bottom:0.5px solid var(--bd)">Recht</th>${ROLES_DEF.map(r=>`<th style="text-align:center;padding:7px 10px;color:var(--t2);border-bottom:0.5px solid var(--bd)">${r.l}</th>`).join('')}</tr></thead><tbody>${ps.map(p=>`<tr><td style="padding:6px 10px;border-bottom:0.5px solid var(--bd);color:var(--t1)">${p}</td>${ROLES_DEF.map(r=>`<td style="text-align:center;padding:6px 10px;border-bottom:0.5px solid var(--bd)"><span class="pvb ${PVL[r.p[p]].c}">${PVL[r.p[p]].l}</span></td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function ini(n){return n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();}
function renderUsers(){const q=(document.getElementById('usrq')?.value||'').toLowerCase(),rows=users.filter(u=>!q||u.naam.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)),tb=document.getElementById('user-tbody');if(!tb)return;if(!rows.length){tb.innerHTML=`<tr><td colspan="5"><div class="empty-state">Geen gebruikers</div></td></tr>`;return;}const RM={admin:'rb-a',bewerker:'rb-e',alleen_lezen:'rb-r'};tb.innerHTML=rows.map((u,i)=>{const[bg,tc]=AVC[i%AVC.length];return`<tr><td><div class="ncell"><div class="av" style="background:${bg};color:${tc}">${ini(u.naam)}</div><span style="font-weight:500">${u.naam}</span></div></td><td style="color:var(--t2)">${u.email}</td><td><span class="rbdg ${RM[u.role]||'rb-r'}">${rolLabel(u.role)}</span></td><td style="color:var(--t2)">${u.laatst_ingelogd?String(u.laatst_ingelogd).substring(0,16).replace('T',' '):'Nooit'}</td><td style="white-space:nowrap"><button class="xbtn" onclick="openUserModal('${u.id}')">✎</button><button class="xbtn delbtn" onclick="delUser('${u.id}')">✕</button></td></tr>`;}).join('');}
function openUserModal(id){editingUserId=id;document.getElementById('umodal-title').textContent=id?'Gebruiker bewerken':'Gebruiker toevoegen';const u=id?users.find(x=>x.id===id):null;document.getElementById('fu-naam').value=u?.naam||'';document.getElementById('fu-email').value=u?.email||'';document.getElementById('fu-pass').value='';document.getElementById('fu-role').value=u?.role||'alleen_lezen';document.getElementById('user-modal').classList.add('open');}
function closeUserModal(){document.getElementById('user-modal').classList.remove('open');}
async function saveUser(){const naam=document.getElementById('fu-naam').value.trim(),email=document.getElementById('fu-email').value.trim(),pass=document.getElementById('fu-pass').value,role=document.getElementById('fu-role').value;if(!naam||!email)return;try{const body={naam,email,role,actief:true};if(pass||!editingUserId)body.password=pass;if(editingUserId){await api('PUT',`/gebruikers/${editingUserId}`,body);users=await api('GET','/gebruikers/')||users;}else{const u=await api('POST','/gebruikers/',body);users.push(u);}closeUserModal();renderUsers();}catch(e){alert('Fout: '+e.message);}}
async function delUser(id){if(!confirm('Gebruiker verwijderen?'))return;try{await api('DELETE',`/gebruikers/${id}`);users=users.filter(u=>u.id!==id);renderUsers();}catch(e){alert('Fout: '+e.message);}}
function renderFinancieel(){
  const totBeschikt=clients.reduce((s,c)=>s+(parseFloat(c.bedrag_beschikt)||0),0);
  const totGefact=clients.reduce((s,c)=>s+(parseFloat(c.gefactureerd)||0),0);
  const totBetaald=clients.reduce((s,c)=>s+(parseFloat(c.betaald)||0),0);
  const totOpenstaand=totBeschikt-totGefact;
  const pctGefact=totBeschikt>0?Math.round(totGefact/totBeschikt*100):0;
  const pctBetaald=totGefact>0?Math.round(totBetaald/totGefact*100):0;
  const openstaandKleur=totOpenstaand>0?'#854F0B':'#0F6E56';
  const aantalMetBeschikking=clients.filter(function(c){return c.bedrag_beschikt;}).length;
  const el=document.getElementById('fin-overzicht');
  el.innerHTML='';
  const cards=[
    {label:'Bedrag beschikt',val:fmtE(totBeschikt),sub:aantalMetBeschikking+' cliënten met beschikking',bar:null,kleur:'var(--t1)'},
    {label:'Gefactureerd',val:fmtE(totGefact),sub:pctGefact+'% van beschikt bedrag',bar:pctGefact,kleur:'#185FA5'},
    {label:'Betaald',val:fmtE(totBetaald),sub:pctBetaald+'% van gefactureerd',bar:pctBetaald,kleur:'#0F6E56'},
    {label:'Openstaand',val:fmtE(totOpenstaand),sub:'Beschikt minus gefactureerd',bar:null,kleur:openstaandKleur},
  ];
  cards.forEach(function(c){
    const d=document.createElement('div');
    d.className='fin-card';
    d.innerHTML='<div class="fin-label">'+c.label+'</div>'
      +'<div class="fin-val" style="color:'+c.kleur+'">'+c.val+'</div>'
      +(c.bar!==null?'<div class="fin-bar-wrap"><div class="fin-bar" style="width:'+c.bar+'%;background:'+c.kleur+'"></div></div>':'')
      +'<div style="font-size:11px;color:var(--t3);margin-top:4px">'+c.sub+'</div>';
    el.appendChild(d);
  });
}

async function exportRapport(type){
  const btn=event.target;
  btn.classList.add('loading');
  btn.textContent='Bezig...';
  const status=document.getElementById('rap-status');
  status.style.display='block';
  status.textContent='Export wordt voorbereid...';
  try{
    const r=await fetch(`/api/export/${type}`,{headers:{Authorization:'Bearer '+token}});
    if(!r.ok)throw new Error(await r.text());
    const blob=await r.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const cd=r.headers.get('Content-Disposition')||'';
    const fname=cd.match(/filename=([^;]+)/)?.[1]||`export_${type}.xlsx`;
    a.href=url;a.download=fname;a.click();
    URL.revokeObjectURL(url);
    status.textContent='Download gestart.';
    setTimeout(()=>status.style.display='none',3000);
  }catch(e){
    status.textContent='Fout bij exporteren: '+e.message;
  }finally{
    btn.classList.remove('loading');
    btn.textContent='Exporteren';
  }
}const g=document.getElementById('cfg-grid');if(!g)return;g.innerHTML='';Object.entries(CFG_DEF).forEach(([key,cfg])=>{const d=document.createElement('div');d.className='ccard'+(key==='klant'?' full':'');d.innerHTML=`<div class="ccard-hdr"><span class="ctitle">${cfg.l}</span><span class="ccnt" id="cn-${key}">${cfg.i.length}</span></div><div class="tags" id="ct-${key}"></div><div class="dvd"></div><div class="arow"><input id="ci-${key}" placeholder="Toevoegen..." onkeydown="if(event.key==='Enter')cfgAdd('${key}')"><button onclick="cfgAdd('${key}')">+ Toevoegen</button></div>`;g.appendChild(d);rtags(key,cfg);});}
function rtags(key,cfg){const el=document.getElementById('ct-'+key);if(!el)return;el.innerHTML=cfg.i.map((x,i)=>`<span class="tag ${cfg.c}">${x}<button class="tagx" onclick="cfgRm('${key}',${i})">✕</button></span>`).join('');const c=document.getElementById('cn-'+key);if(c)c.textContent=cfg.i.length;}
function cfgAdd(key){const inp=document.getElementById('ci-'+key),v=inp.value.trim();if(!v)return;if(CFG_DEF[key].i.includes(v))return;CFG_DEF[key].i.push(v);inp.value='';rtags(key,CFG_DEF[key]);}
function cfgRm(key,i){CFG_DEF[key].i.splice(i,1);rtags(key,CFG_DEF[key]);}
function saveSettings(){const t=document.getElementById('tst');t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2200);}
if(token)startApp();
