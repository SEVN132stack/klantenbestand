const API='/api';
let token=localStorage.getItem('cp_token'),currentUser=null,dark=localStorage.getItem('cp_dark')==='1';
let editingId=null,viewingId=null,editingUserId=null,clients=[],auditLog=[],users=[];

const FL={naam:'Naam',bsn:'BSN',status:'Status',klant:'Klant',locatie:'Locatie',begeleider_1:'Begeleider 1',begeleider_2:'Begeleider 2',datum_start:'Datum start',einde_beschikking:'Einde beschikking',bedrag_beschikt:'Bedrag',gefactureerd:'Gefactureerd',betaald:'Betaald',uur_per_week:'Uur/week',enquete_gestuurd:'Enquete',laatste_gefactureerd:'Laatst gefactureerd'};
const DOTMAP={edit:'dot-edit',add:'dot-add',delete:'dot-delete',note:'dot-note',status:'dot-status'};
const PVL={full:{l:'Volledig',c:'pv-full'},read:{l:'Inzien',c:'pv-read'},none:{l:'Geen',c:'pv-none'}};
const ROLES_DEF=[
  {k:'admin',l:'Admin',d:'Volledige toegang',ic:'A',bg:'#dbeafe',tc:'#1e40af',p:{'Clienten bekijken':'full','Clienten bewerken':'full','Clienten verwijderen':'full','Configuratie':'full','Gebruikers':'full'}},
  {k:'bewerker',l:'Bewerker',d:'Kan clienten bewerken',ic:'B',bg:'#dcfce7',tc:'#166534',p:{'Clienten bekijken':'full','Clienten bewerken':'full','Clienten verwijderen':'none','Configuratie':'none','Gebruikers':'none'}},
  {k:'alleen_lezen',l:'Alleen lezen',d:'Alleen inzien',ic:'L',bg:'#f1f0e8',tc:'#44403c',p:{'Clienten bekijken':'full','Clienten bewerken':'none','Clienten verwijderen':'none','Configuratie':'none','Gebruikers':'none'}},
];
const CFG_DEF={
  locatie:{l:'Locaties',c:'tg-l',i:['Smederij','Ambulant','TFR','Dagbesteding','Stage']},
  begeleider:{l:'Begeleiders',c:'tg-b',i:['Lennart','Floris','Taru','Britt','Olger','Bente','Laurien','Jantine','Claire']},
  klant:{l:'Klanten',c:'tg-k',i:['Dronten','Kampen','Zwolle','Intern','Klaver4You','RIBW','PGB','Gemeente Olst-Wijhe','Boslust Dependance de Laarakkers','Stapsgewijs','Gemeente Lelystad','Gemeente Hardenberg','Menso','Gemeente Aa en Hunze']},
  product:{l:'Producten',c:'tg-p',i:['Individueel','Dagbesteding']},
  eenheid:{l:'Eenheden',c:'tg-e',i:['Maand','Week','Dagdeel','Uur','Minuut']},
};
const AVC=[['#dbeafe','#1e40af'],['#dcfce7','#166534'],['#ede9fe','#4c1d95'],['#fef3cd','#7a4f00'],['#ffe4e6','#881337'],['#f1f0e8','#44403c']];

async function api(method,path,body){
  const opts={method,headers:{'Content-Type':'application/json'}};
  if(token)opts.headers['Authorization']='Bearer '+token;
  if(body)opts.body=JSON.stringify(body);
  const r=await fetch(API+path,opts);
  if(r.status===401){doLogout();return null;}
  if(!r.ok){const e=await r.json().catch(function(){return{};});throw new Error(e.detail||r.statusText);}
  if(r.status===204)return null;
  return r.json();
}

function doLogin(){
  var email=document.getElementById('l-email').value;
  var pass=document.getElementById('l-pass').value;
  var err=document.getElementById('login-err');
  err.style.display='none';
  var form=new FormData();
  form.append('username',email);
  form.append('password',pass);
  fetch(API+'/auth/login',{method:'POST',body:form})
    .then(function(r){
      if(!r.ok){err.style.display='block';return null;}
      return r.json();
    })
    .then(function(data){
      if(!data)return;
      token=data.access_token;currentUser=data.user;
      localStorage.setItem('cp_token',token);
      startApp();
    })
    .catch(function(){err.style.display='block';});
}

function doLogout(){
  token=null;currentUser=null;
  localStorage.removeItem('cp_token');
  document.getElementById('login-wrap').style.display='flex';
  document.getElementById('shell').classList.remove('visible');
}

function startApp(){
  if(!token)return;
  var me=currentUser?Promise.resolve(currentUser):api('GET','/auth/me');
  me.then(function(u){
    if(!u){doLogout();return;}
    currentUser=u;
    document.getElementById('login-wrap').style.display='none';
    document.getElementById('shell').classList.add('visible');
    document.getElementById('nav-user').textContent=currentUser.naam+' - '+rolLabel(currentUser.role);
    var isAdmin=currentUser.role==='admin';
    var canWrite=currentUser.role!=='alleen_lezen';
    if(isAdmin)document.getElementById('tab-settings').style.display='';
    if(isAdmin){var ib=document.getElementById('btn-import');if(ib)ib.style.display='';}
    if(canWrite)document.getElementById('btn-add-client').style.display='';
    if(dark)applyDark();
    loadAll().then(function(){
      renderList();
      renderRoles();
      laadRapBeschikkingen(clients, function(){ renderFinancieel(); });
      if(isAdmin){renderUsers();renderConfig();}
    });
  }).catch(function(){doLogout();});
}

function rolLabel(r){return{admin:'Admin',bewerker:'Bewerker',alleen_lezen:'Alleen lezen'}[r]||r;}

function loadAll(){
  return Promise.all([
    api('GET','/clienten/').then(function(d){clients=d||[];}).catch(function(){clients=[];}),
    api('GET','/audit/').then(function(d){auditLog=d||[];}).catch(function(){auditLog=[];}),
    currentUser&&currentUser.role==='admin'?api('GET','/gebruikers/').then(function(d){users=d||[];}).catch(function(){users=[];}):Promise.resolve()
  ]);
}

function tDark(){dark=!dark;localStorage.setItem('cp_dark',dark?'1':'0');applyDark();}
function applyDark(){document.body.classList.toggle('dark',dark);document.getElementById('dlbl').textContent=dark?'Licht':'Donker';}

function sw(id,btn){
  document.querySelectorAll('.sec').forEach(function(s){s.classList.remove('on');});
  document.querySelectorAll('#main-tabs .tab').forEach(function(b){b.classList.remove('on');});
  document.getElementById('s-'+id).classList.add('on');
  if(btn)btn.classList.add('on');
  if(id==='log')renderGlobalLog();
  if(id==='rapportages'){initRapFilters();renderRapportage();}
  if(id==='settings'){renderRoles();if(currentUser&&currentUser.role==='admin'){renderUsers();renderConfig();}}
}

function swSub(id,btn){
  document.querySelectorAll('.sub').forEach(function(s){s.classList.remove('on');});
  document.querySelectorAll('#s-settings .tabs .tab').forEach(function(b){b.classList.remove('on');});
  document.getElementById(id).classList.add('on');
  if(btn)btn.classList.add('on');
}

function backToList(){
  document.getElementById('tab-detail').style.display='none';
  sw('list',document.querySelector('#main-tabs .tab'));
}

function fmtD(d){
  if(!d)return'-';
  var p=String(d).substring(0,10).split('-');
  return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:d;
}
function fmtE(v){
  if(v===null||v===undefined||v==='')return'-';
  return 'EUR '+parseFloat(v).toLocaleString('nl-NL',{minimumFractionDigits:2});
}
function stBadge(s){
  var m={'In zorg':'b-active','Uit Zorg':'b-ended'};
  return '<span class="badge '+(m[s]||'b-other')+'">'+s+'</span>';
}

function renderStats(){
  var a=clients.filter(function(c){return c.status==='In zorg';}).length;
  var e=clients.filter(function(c){return c.status==='Uit Zorg';}).length;
  var o=clients.filter(function(c){return c.status!=='In zorg'&&c.status!=='Uit Zorg';}).length;
  document.getElementById('stats-bar').innerHTML=
    '<div class="stat"><div class="stat-l">In zorg</div><div class="stat-v" style="color:#0F6E56">'+a+'</div></div>'+
    '<div class="stat"><div class="stat-l">Uit zorg</div><div class="stat-v" style="color:#712B13">'+e+'</div></div>'+
    '<div class="stat"><div class="stat-l">Overig</div><div class="stat-v" style="color:#854F0B">'+o+'</div></div>'+
    '<div class="stat"><div class="stat-l">Totaal</div><div class="stat-v">'+clients.length+'</div></div>';
}

function renderFinancieel(){
  var totB=0,totG=0,totP=0;
  clients.forEach(function(c){
    var bs=_rapBeschikkingen[c.id]||[];
    totB+=bs.reduce(function(s,b){return s+(parseFloat(b.bedrag_beschikt)||0);},0);
    totG+=bs.reduce(function(s,b){return s+(parseFloat(b.gefactureerd)||0);},0);
    totP+=bs.reduce(function(s,b){return s+(parseFloat(b.betaald)||0);},0);
  });
  var pctG=totB>0?Math.round(totG/totB*100):0;
  var pctP=totG>0?Math.round(totP/totG*100):0;
  var kleurO=totB-totG>0?"#854F0B":"#0F6E56";
  var el=document.getElementById("fin-overzicht");
  if(!el)return;
  el.innerHTML=
    '<div class="fin-card"><div class="fin-label">Bedrag beschikt</div><div class="fin-val">'+fmtE(totB)+'</div><div style="font-size:11px;color:var(--t3)">Totaal over alle beschikkingen</div></div>'+
    '<div class="fin-card"><div class="fin-label">Gefactureerd</div><div class="fin-val" style="color:#185FA5">'+fmtE(totG)+'</div><div class="fin-bar-wrap"><div class="fin-bar" style="width:'+pctG+'%;background:#185FA5"></div></div><div style="font-size:11px;color:var(--t3);margin-top:4px">'+pctG+'% van beschikt</div></div>'+
    '<div class="fin-card"><div class="fin-label">Betaald</div><div class="fin-val" style="color:#0F6E56">'+fmtE(totP)+'</div><div class="fin-bar-wrap"><div class="fin-bar" style="width:'+pctP+'%;background:#0F6E56"></div></div><div style="font-size:11px;color:var(--t3);margin-top:4px">'+pctP+'% van gefactureerd</div></div>'+
    '<div class="fin-card"><div class="fin-label">Openstaand</div><div class="fin-val" style="color:'+kleurO+'">'+fmtE(totB-totG)+'</div><div style="font-size:11px;color:var(--t3)">Beschikt min gefactureerd</div></div>';
}

function renderList(){
  renderStats();
  renderFinancieel();
  var q=(document.getElementById('srch').value||'').toLowerCase();
  var fs=document.getElementById('fstat').value;
  var canWrite=currentUser&&currentUser.role!=='alleen_lezen';
  var rows=clients.filter(function(c){
    var qok=!q||c.naam.toLowerCase().indexOf(q)>-1||(c.klant||'').toLowerCase().indexOf(q)>-1||(c.begeleider_1||'').toLowerCase().indexOf(q)>-1;
    var fok=!fs||c.status===fs;
    return qok&&fok;
  });
  var tb=document.getElementById('list-tbody');
  if(!rows.length){tb.innerHTML='<tr><td colspan="8"><div class="empty-state">Geen clienten gevonden</div></td></tr>';return;}
  tb.innerHTML=rows.map(function(c){
    var begs=[c.begeleider_1,c.begeleider_2].filter(Boolean).join(', ')||'-';
    var notitie=c.notitie?c.notitie.substring(0,35)+(c.notitie.length>35?'...':''):'-';
    var acties=canWrite?'<button class="xbtn" onclick="openModal(\''+c.id+'\')">&#9998;</button> <button class="xbtn delbtn" onclick="delClient(\''+c.id+'\')">&#10005;</button>':'';
    return '<tr class="row-link" onclick="openDetail(\''+c.id+'\')">'
      +'<td style="font-weight:500">'+c.naam+'</td>'
      +'<td>'+stBadge(c.status)+'</td>'
      +'<td>'+(c.klant||'-')+'</td>'
      +'<td>'+fmtD(c.datum_start)+'</td>'
      +'<td>'+fmtD(c.einde_beschikking)+'</td>'
      +'<td>'+begs+'</td>'
      +'<td style="color:var(--t3);font-size:12px">'+notitie+'</td>'
      +'<td onclick="event.stopPropagation()" style="white-space:nowrap">'+acties+'</td>'
      +'</tr>';
  }).join('');
}

function openDetail(id){
  viewingId=id;
  var c=clients.find(function(x){return x.id===id;});
  if(!c)return;
  document.getElementById('tab-detail').style.display='';
  document.getElementById('tab-detail').textContent='Dossier: '+c.naam;
  sw('detail',document.getElementById('tab-detail'));
  var canWrite=currentUser&&currentUser.role!=='alleen_lezen';
  Promise.all([
    api('GET','/clienten/'+id+'/audit').catch(function(){return [];}),
    api('GET','/clienten/'+id+'/beschikkingen').catch(function(){return [];})
  ]).then(function(results){
    var clog=results[0]||[];
    var beschikkingen=results[1]||[];
    var logHtml=clog.length?clog.map(function(e){return auditHtml(e);}).join(''):'<div class="empty-state">Nog geen wijzigingen geregistreerd.</div>';
    var notitieHtml=canWrite
      ?'<textarea class="notes-area" id="notes-input">'+( c.notitie||'')+'</textarea><div class="notes-footer"><span class="notes-meta" id="notes-meta">'+(c.notitie?'Notitie aanwezig':'Nog geen notitie')+'</span><button class="save-note" onclick="saveNote(\''+c.id+'\')">Notitie opslaan</button></div>'
      :'<div style="font-size:13px;color:var(--t2);padding:8px 0;line-height:1.6">'+(c.notitie||'Geen notitie')+'</div>';
    var bewerkBtn=canWrite?'<button class="abtn" onclick="openModal(\''+c.id+'\')">&#9998; Bewerken</button>':'';
    document.getElementById('detail-content').innerHTML=
      '<div class="detail-hdr"><div>'
        +'<div class="detail-name">'+c.naam+' <span class="chip">'+(c.bsn||'geen BSN')+'</span></div>'
        +'<div class="detail-sub">'+(c.klant||'Onbekende klant')+' - '+([c.begeleider_1,c.begeleider_2].filter(Boolean).join(' & ')||'Geen begeleider')+'</div>'
      +'</div><div style="display:flex;gap:8px;align-items:center">'+stBadge(c.status)+bewerkBtn+'</div></div>'
      +'<div class="dgrid">'
        +'<div class="dcard"><div class="dcard-t">Zorgperiode</div>'
          +'<div class="irow"><span class="ik">Datum start</span><span class="iv">'+fmtD(c.datum_start)+'</span></div>'
          +'<div class="irow"><span class="ik">Einde beschikking</span><span class="iv">'+fmtD(c.einde_beschikking)+'</span></div>'
          +'<div class="irow"><span class="ik">Datum sluiting</span><span class="iv">'+fmtD(c.datum_sluiting)+'</span></div>'
          +'<div class="irow"><span class="ik">Locatie</span><span class="iv">'+(c.locatie||'-')+'</span></div>'
          +'<div class="irow"><span class="ik">Uur/dagdeel p/w</span><span class="iv">'+(c.uur_per_week||'-')+'</span></div>'
        +'</div>'
        +'<div class="dcard"><div class="dcard-t">Financien</div>'
          +'<div class="irow"><span class="ik">Gefactureerd</span><span class="iv">'+fmtE(c.gefactureerd)+'</span></div>'
          +'<div class="irow"><span class="ik">Betaald</span><span class="iv">'+fmtE(c.betaald)+'</span></div>'
          +'<div class="irow"><span class="ik">Laatst gefactureerd</span><span class="iv">'+(c.laatste_gefactureerd||'-')+'</span></div>'
          +'<div class="irow"><span class="ik">Enquete gestuurd</span><span class="iv">'+(c.enquete_gestuurd||'-')+'</span></div>'
        +'</div>'
      +'</div>'
      +'<div class="dcard" style="margin-bottom:1.25rem">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
          +'<div class="dcard-t" style="margin-bottom:0">Beschikkingen <span class="chip">'+beschikkingen.length+'</span></div>'
          +(canWrite?'<button class="abtn" onclick="openModal(\''+c.id+'\')">+ Beschikking toevoegen</button>':'')
        +'</div>'
        +renderBeschikkingenInDossier(c.id, beschikkingen, canWrite)
      +'</div>'
      +'<div class="dcard" style="margin-bottom:1.25rem"><div class="dcard-t">Notities</div>'+notitieHtml+'</div>'
      +'<div class="dcard"><div class="dcard-t" style="margin-bottom:12px">Auditlogboek <span class="chip">'+clog.length+' wijzigingen</span></div>'
        +'<div class="audit-list" id="client-log">'+logHtml+'</div>'
      +'</div>';
  }).catch(function(){});
}

function saveNote(id){
  var notitie=document.getElementById('notes-input').value;
  api('PATCH','/clienten/'+id+'/notitie',{notitie:notitie}).then(function(){
    var c=clients.find(function(x){return x.id===id;});
    if(c)c.notitie=notitie;
    var meta=document.getElementById('notes-meta');
    if(meta)meta.textContent='Opgeslagen';
    var entry={type:'note',user_naam:currentUser.naam,actie:'Notitie bijgewerkt',veld:null,oude_waarde:null,nieuwe_waarde:'(opgeslagen)',tijdstip:new Date().toISOString()};
    var cl=document.getElementById('client-log');
    if(cl)cl.insertAdjacentHTML('afterbegin',auditHtml(entry));
  }).catch(function(e){alert('Fout: '+e.message);});
}

function auditHtml(e){
  var diff='';
  if(e.veld&&e.oude_waarde&&e.nieuwe_waarde){
    diff='<div class="adiff"><span class="aold">'+e.oude_waarde+'</span> naar <span class="anew">'+e.nieuwe_waarde+'</span></div>';
  } else if(e.type==='note'&&e.nieuwe_waarde){
    diff='<div class="adiff" style="font-style:italic;color:var(--t2)">'+e.nieuwe_waarde+'</div>';
  }
  var ts=e.tijdstip?String(e.tijdstip).substring(0,16).replace('T',' '):'';
  var veldLabel=e.veld?(FL[e.veld]||e.veld):'';
  var clientLink=e.client_naam?'<span style="color:var(--acc);cursor:pointer" onclick="openDetail(\''+e.client_id+'\')">'+e.client_naam+'</span>':'';
  return '<div class="aentry"><div class="adot '+(DOTMAP[e.type]||'dot-edit')+'"></div>'
    +'<div class="abody"><div class="aaction"><strong>'+e.user_naam+'</strong> - '+e.actie+(veldLabel?' <span style="color:var(--t3);font-size:12px">('+veldLabel+')</span>':'')+'</div>'
    +diff
    +'<div class="ameta"><span>'+ts+'</span>'+clientLink+'</div>'
    +'</div></div>';
}

function renderGlobalLog(){
  var f=document.getElementById('log-filter').value;
  var rows=f?auditLog.filter(function(e){return e.type===f;}):auditLog;
  document.getElementById('log-count').textContent=rows.length+' wijzigingen';
  var el=document.getElementById('global-log-list');
  el.innerHTML=rows.length?rows.map(function(e){return auditHtml(e);}).join(''):'<div class="empty-state">Geen wijzigingen gevonden.</div>';
}

function openModal(id){
  editingId=id;
  document.getElementById('modal-title').textContent=id?'Client bewerken':'Client toevoegen';
  var c=id?clients.find(function(x){return x.id===id;}):null;
  var g=function(fid,val){var el=document.getElementById(fid);if(el)el.value=val||'';};
  var klantSel=document.getElementById('f-klant');
  klantSel.innerHTML='<option value=""></option>'+CFG_DEF.klant.i.map(function(k){return '<option value="'+k+'">'+k+'</option>';}).join('');
  var locSel=document.getElementById('f-locatie');
  locSel.innerHTML='<option value=""></option>'+CFG_DEF.locatie.i.map(function(k){return '<option value="'+k+'">'+k+'</option>';}).join('');
  var beg1Sel=document.getElementById('f-beg1');
  beg1Sel.innerHTML='<option value=""></option>'+CFG_DEF.begeleider.i.map(function(k){return '<option value="'+k+'">'+k+'</option>';}).join('');
  var beg2Sel=document.getElementById('f-beg2');
  beg2Sel.innerHTML='<option value=""></option>'+CFG_DEF.begeleider.i.map(function(k){return '<option value="'+k+'">'+k+'</option>';}).join('');
  g('f-naam',c&&c.naam);g('f-bsn',c&&c.bsn);
  g('f-geb',c&&c.geboortedatum&&c.geboortedatum.substring(0,10));
  g('f-status',(c&&c.status)||'In zorg');g('f-klant',c&&c.klant);
  g('f-start',c&&c.datum_start&&c.datum_start.substring(0,10));
  g('f-einde',c&&c.einde_beschikking&&c.einde_beschikking.substring(0,10));
  g('f-sluiting',c&&c.datum_sluiting&&c.datum_sluiting.substring(0,10));
  g('f-locatie',c&&c.locatie);g('f-beg1',c&&c.begeleider_1);g('f-beg2',c&&c.begeleider_2);
  g('f-uur',c&&c.uur_per_week);g('f-enquete',c&&c.enquete_gestuurd);g('f-laatste-gefact',c&&c.laatste_gefactureerd);g('f-opm',c&&c.opmerkingen);
  document.getElementById('edit-modal').classList.add('open');
  laadBeschikkingenVoorModal(id||null);
}

function toggleFacturatieType(){
  var type=document.getElementById('f-facturatie-type').value;
  var vast=document.getElementById('facturatie-extra-vast');
  var uur=document.getElementById('facturatie-extra-uur');
  if(vast){vast.className='facturatie-extra'+(type==='vast_bedrag'?' zichtbaar':'');}
  if(uur){uur.className='facturatie-extra'+(type==='uurtarief'?' zichtbaar':'');}
}
function closeModal(){document.getElementById('edit-modal').classList.remove('open');}

function saveClient(){
  var naam=document.getElementById('f-naam').value.trim();
  if(!naam)return;
  var g=function(id){var el=document.getElementById(id);return el?el.value||null:null;};
  var gf=function(id){var el=document.getElementById(id);return el&&el.value?parseFloat(el.value)||null:null;};
  var body={
    naam:naam,
    bsn:g('f-bsn'),
    geboortedatum:g('f-geb'),
    status:document.getElementById('f-status').value,
    klant:g('f-klant'),
    locatie:g('f-locatie'),
    begeleider_1:g('f-beg1'),
    begeleider_2:g('f-beg2'),
    datum_start:g('f-start'),
    einde_beschikking:g('f-einde'),
    datum_sluiting:g('f-sluiting'),
    uur_per_week:g('f-uur'),
    enquete_gestuurd:g('f-enquete'),
    laatste_gefactureerd:g('f-laatste-gefact'),
    opmerkingen:g('f-opm'),
  };
  var req=editingId?api('PUT','/clienten/'+editingId,body):api('POST','/clienten/',body);
  req.then(function(result){
    var savedId=editingId||(result&&result.id);
    if(editingId){Object.assign(clients.find(function(c){return c.id===editingId;})||{},result||body);}
    else{clients.push(result);}
    return slaanBeschikkingenOp(savedId).then(function(){return api('GET','/audit/');});
  }).then(function(log){
    auditLog=log||auditLog;
    closeModal();renderList();
    if(editingId&&viewingId===editingId)openDetail(editingId);
  }).catch(function(e){alert('Fout: '+e.message);});
}

function delClient(id){
  if(!confirm('Client verwijderen?'))return;
  api('DELETE','/clienten/'+id).then(function(){
    clients=clients.filter(function(c){return c.id!==id;});
    if(viewingId===id){document.getElementById('tab-detail').style.display='none';backToList();}
    renderList();
  }).catch(function(e){alert('Fout: '+e.message);});
}

function renderRoles(){
  document.getElementById('roles-grid').innerHTML=ROLES_DEF.map(function(r){
    var perms=Object.entries(r.p).map(function(kv){
      return '<div class="prow"><span>'+kv[0]+'</span><span class="pvb '+PVL[kv[1]].c+'">'+PVL[kv[1]].l+'</span></div>';
    }).join('');
    return '<div class="rcard"><div class="rcard-hdr"><div class="rico" style="background:'+r.bg+';color:'+r.tc+'">'+r.ic+'</div><div><div class="rname">'+r.l+'</div><div class="rdesc">'+r.d+'</div></div></div><div>'+perms+'</div></div>';
  }).join('');
  var ps=Object.keys(ROLES_DEF[0].p);
  var hdrs=ROLES_DEF.map(function(r){return '<th style="text-align:center;padding:7px 10px;color:var(--t2);border-bottom:0.5px solid var(--bd)">'+r.l+'</th>';}).join('');
  var rows=ps.map(function(p){
    var cols=ROLES_DEF.map(function(r){return '<td style="text-align:center;padding:6px 10px;border-bottom:0.5px solid var(--bd)"><span class="pvb '+PVL[r.p[p]].c+'">'+PVL[r.p[p]].l+'</span></td>';}).join('');
    return '<tr><td style="padding:6px 10px;border-bottom:0.5px solid var(--bd);color:var(--t1)">'+p+'</td>'+cols+'</tr>';
  }).join('');
  document.getElementById('mx').innerHTML='<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;padding:7px 10px;color:var(--t2);border-bottom:0.5px solid var(--bd)">Recht</th>'+hdrs+'</tr></thead><tbody>'+rows+'</tbody></table>';
}

function ini(n){return n.split(' ').map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();}

function renderUsers(){
  var q=(document.getElementById('usrq')&&document.getElementById('usrq').value||'').toLowerCase();
  var rows=users.filter(function(u){return !q||u.naam.toLowerCase().indexOf(q)>-1||u.email.toLowerCase().indexOf(q)>-1;});
  var tb=document.getElementById('user-tbody');
  if(!tb)return;
  if(!rows.length){tb.innerHTML='<tr><td colspan="5"><div class="empty-state">Geen gebruikers</div></td></tr>';return;}
  var RM={admin:'rb-a',bewerker:'rb-e',alleen_lezen:'rb-r'};
  tb.innerHTML=rows.map(function(u,i){
    var av=AVC[i%AVC.length];
    return '<tr>'
      +'<td><div class="ncell"><div class="av" style="background:'+av[0]+';color:'+av[1]+'">'+ini(u.naam)+'</div><span style="font-weight:500">'+u.naam+'</span></div></td>'
      +'<td style="color:var(--t2)">'+u.email+'</td>'
      +'<td><span class="rbdg '+(RM[u.role]||'rb-r')+'">'+rolLabel(u.role)+'</span></td>'
      +'<td style="color:var(--t2)">'+(u.laatst_ingelogd?String(u.laatst_ingelogd).substring(0,16).replace('T',' '):'Nooit')+'</td>'
      +'<td style="white-space:nowrap"><button class="xbtn" onclick="openUserModal(\''+u.id+'\')">&#9998;</button><button class="xbtn delbtn" onclick="delUser(\''+u.id+'\')">&#10005;</button></td>'
      +'</tr>';
  }).join('');
}

function openUserModal(id){
  editingUserId=id;
  document.getElementById('umodal-title').textContent=id?'Gebruiker bewerken':'Gebruiker toevoegen';
  var u=id?users.find(function(x){return x.id===id;}):null;
  document.getElementById('fu-naam').value=u&&u.naam||'';
  document.getElementById('fu-email').value=u&&u.email||'';
  document.getElementById('fu-pass').value='';
  document.getElementById('fu-role').value=u&&u.role||'alleen_lezen';
  document.getElementById('user-modal').classList.add('open');
}
function closeUserModal(){document.getElementById('user-modal').classList.remove('open');}

function saveUser(){
  var naam=document.getElementById('fu-naam').value.trim();
  var email=document.getElementById('fu-email').value.trim();
  var pass=document.getElementById('fu-pass').value;
  var role=document.getElementById('fu-role').value;
  if(!naam||!email)return;
  var body={naam:naam,email:email,role:role,actief:true};
  if(pass||!editingUserId)body.password=pass;
  var req=editingUserId?api('PUT','/gebruikers/'+editingUserId,body):api('POST','/gebruikers/',body);
  req.then(function(u){
    if(editingUserId){return api('GET','/gebruikers/').then(function(d){users=d||users;});}
    else{users.push(u);}
  }).then(function(){closeUserModal();renderUsers();}).catch(function(e){alert('Fout: '+e.message);});
}

function delUser(id){
  if(!confirm('Gebruiker verwijderen?'))return;
  api('DELETE','/gebruikers/'+id).then(function(){
    users=users.filter(function(u){return u.id!==id;});renderUsers();
  }).catch(function(e){alert('Fout: '+e.message);});
}

function renderConfig(){
  var g=document.getElementById('cfg-grid');if(!g)return;g.innerHTML='';
  Object.entries(CFG_DEF).forEach(function(entry){
    var key=entry[0],cfg=entry[1];
    var d=document.createElement('div');
    d.className='ccard'+(key==='klant'?' full':'');
    d.innerHTML='<div class="ccard-hdr"><span class="ctitle">'+cfg.l+'</span><span class="ccnt" id="cn-'+key+'">'+cfg.i.length+'</span></div>'
      +'<div class="tags" id="ct-'+key+'"></div><div class="dvd"></div>'
      +'<div class="arow"><input id="ci-'+key+'" placeholder="Toevoegen..." onkeydown="if(event.key===\'Enter\')cfgAdd(\''+key+'\')"><button onclick="cfgAdd(\''+key+'\')">+ Toevoegen</button></div>';
    g.appendChild(d);
    rtags(key,cfg);
  });
}
function rtags(key,cfg){
  var el=document.getElementById('ct-'+key);if(!el)return;
  el.innerHTML=cfg.i.map(function(x,i){return '<span class="tag '+cfg.c+'">'+x+'<button class="tagx" onclick="cfgRm(\''+key+'\','+i+')">&#10005;</button></span>';}).join('');
  var c=document.getElementById('cn-'+key);if(c)c.textContent=cfg.i.length;
}
function cfgAdd(key){
  var inp=document.getElementById('ci-'+key),v=inp.value.trim();
  if(!v||CFG_DEF[key].i.indexOf(v)>-1)return;
  CFG_DEF[key].i.push(v);inp.value='';rtags(key,CFG_DEF[key]);
}
function cfgRm(key,i){CFG_DEF[key].i.splice(i,1);rtags(key,CFG_DEF[key]);}
function saveSettings(){var t=document.getElementById('tst');t.classList.add('on');setTimeout(function(){t.classList.remove('on');},2200);}

function exportRapport(type){
  var btn=event&&event.target?event.target:null;
  if(btn){btn.classList.add('loading');btn.textContent='Bezig...';}
  fetch('/api/export/'+type,{headers:{Authorization:'Bearer '+token}})
    .then(function(r){
      if(!r.ok)throw new Error(r.statusText);
      var cd=r.headers.get('Content-Disposition')||'';
      var fname=cd.match(/filename=([^;]+)/);
      fname=fname?fname[1]:'export_'+type+'.xlsx';
      return r.blob().then(function(blob){return{blob:blob,fname:fname};});
    })
    .then(function(obj){
      var url=URL.createObjectURL(obj.blob);
      var a=document.createElement('a');
      a.href=url;a.download=obj.fname;a.click();
      URL.revokeObjectURL(url);
    })
    .catch(function(e){alert('Fout bij exporteren: '+e.message);})
    .finally(function(){if(btn){btn.classList.remove('loading');btn.textContent='Exporteren';}});
}

if(token)startApp();

// ─── RAPPORTAGES ────────────────────────────────────────────────────────────

function initRapFilters(){
  var klantSel=document.getElementById('rf-klant');
  var begSel=document.getElementById('rf-beg');
  var locSel=document.getElementById('rf-loc');
  if(!klantSel)return;
  var curKlant=klantSel.value,curBeg=begSel.value,curLoc=locSel.value;
  klantSel.innerHTML='<option value="">Alle klanten</option>'+CFG_DEF.klant.i.map(function(k){return '<option'+(k===curKlant?' selected':'')+'>'+k+'</option>';}).join('');
  begSel.innerHTML='<option value="">Alle begeleiders</option>'+CFG_DEF.begeleider.i.map(function(b){return '<option'+(b===curBeg?' selected':'')+'>'+b+'</option>';}).join('');
  locSel.innerHTML='<option value="">Alle locaties</option>'+CFG_DEF.locatie.i.map(function(l){return '<option'+(l===curLoc?' selected':'')+'>'+l+'</option>';}).join('');
}

function getRapFiltered(){
  var status=document.getElementById('rf-status')&&document.getElementById('rf-status').value||'';
  var klant=document.getElementById('rf-klant')&&document.getElementById('rf-klant').value||'';
  var beg=document.getElementById('rf-beg')&&document.getElementById('rf-beg').value||'';
  var loc=document.getElementById('rf-loc')&&document.getElementById('rf-loc').value||'';
  return clients.filter(function(c){
    if(status&&c.status!==status)return false;
    if(klant&&c.klant!==klant)return false;
    if(beg&&c.begeleider_1!==beg&&c.begeleider_2!==beg)return false;
    if(loc&&c.locatie!==loc)return false;
    return true;
  });
}

var _rapBeschikkingen = {};

function laadRapBeschikkingen(rows, callback){
  var ids = rows.map(function(c){return c.id;});
  var loaded = 0;
  if(!ids.length){callback();return;}
  ids.forEach(function(id){
    api('GET','/clienten/'+id+'/beschikkingen').then(function(b){
      _rapBeschikkingen[id] = b||[];
    }).catch(function(){
      _rapBeschikkingen[id] = [];
    }).finally(function(){
      loaded++;
      if(loaded===ids.length) callback();
    });
  });
}

function getBeschikkingenTotalen(clientId){
  var bs = _rapBeschikkingen[clientId]||[];
  return {
    beschikt: bs.reduce(function(s,b){return s+(parseFloat(b.bedrag_beschikt)||0);},0),
    gefact:   bs.reduce(function(s,b){return s+(parseFloat(b.gefactureerd)||0);},0),
    betaald:  bs.reduce(function(s,b){return s+(parseFloat(b.betaald)||0);},0),
    aantal:   bs.length,
  };
}

function renderRapSummary(rows){
  var inZorg=rows.filter(function(c){return c.status==='In zorg';}).length;
  var uitZorg=rows.filter(function(c){return c.status==='Uit Zorg';}).length;
  var totB=0,totG=0,totP=0;
  rows.forEach(function(c){
    var t=getBeschikkingenTotalen(c.id);
    totB+=t.beschikt; totG+=t.gefact; totP+=t.betaald;
  });
  var pctG=totB>0?Math.round(totG/totB*100):0;
  var pctP=totG>0?Math.round(totP/totG*100):0;
  var kleurO=totB-totG>0?'#854F0B':'#0F6E56';
  var el=document.getElementById('rap-summary');
  if(!el)return;
  el.innerHTML=
    '<div class="rsum-card"><div class="rsum-label">Totaal cliënten</div><div class="rsum-val">'+rows.length+'</div><div class="rsum-sub">'+inZorg+' in zorg, '+uitZorg+' uit zorg</div></div>'+
    '<div class="rsum-card"><div class="rsum-label">Bedrag beschikt</div><div class="rsum-val" style="font-size:16px">'+fmtE(totB)+'</div><div class="rsum-sub">&nbsp;</div></div>'+
    '<div class="rsum-card"><div class="rsum-label">Gefactureerd</div><div class="rsum-val" style="font-size:16px;color:#185FA5">'+fmtE(totG)+'</div><div class="rsum-sub">'+pctG+'% van beschikt</div></div>'+
    '<div class="rsum-card"><div class="rsum-label">Betaald</div><div class="rsum-val" style="font-size:16px;color:#0F6E56">'+fmtE(totP)+'</div><div class="rsum-sub">'+pctP+'% van gefactureerd</div></div>'+
    '<div class="rsum-card"><div class="rsum-label">Openstaand</div><div class="rsum-val" style="font-size:16px;color:'+kleurO+'">'+fmtE(totB-totG)+'</div><div class="rsum-sub">Beschikt min gefactureerd</div></div>';
}

function renderRapportage(){
  var view=document.getElementById('rf-view')&&document.getElementById('rf-view').value||'clienten';
  var rows=getRapFiltered();
  var countEl=document.getElementById('rap-count');
  if(countEl)countEl.textContent=rows.length+' cliënten';

  var thead=document.getElementById('rap-thead');
  var tbody=document.getElementById('rap-tbody');
  if(!thead||!tbody)return;

  if(tbody)tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--t2)">Gegevens laden...</td></tr>';

  laadRapBeschikkingen(rows, function(){
    renderRapSummary(rows);
    _renderRapTabel(view, rows, thead, tbody);
  });
}

function _renderRapTabel(view, rows, thead, tbody){
  if(view==='clienten'){
    thead.innerHTML='<tr><th>Naam</th><th>Status</th><th>Klant</th><th>Begeleider</th><th>Locatie</th><th>Beschikkingen</th><th>Totaal beschikt</th><th>Einde beschikking</th></tr>';
    if(!rows.length){tbody.innerHTML='<tr><td colspan="8"><div class="empty-state">Geen cliënten gevonden</div></td></tr>';return;}
    tbody.innerHTML=rows.map(function(c){
      var bs=_rapBeschikkingen[c.id]||[];
      var t=getBeschikkingenTotalen(c.id);
      var bLabel=bs.length
        ? bs.map(function(b,i){return 'B'+(b.volgnummer||i+1)+': '+fmtD(b.datum_start)+' - '+fmtD(b.datum_einde);}).join(' | ')
        : '-';
      return '<tr class="row-link" onclick="openDetail(\''+c.id+'\')">'
        +'<td style="font-weight:500">'+c.naam+'</td>'
        +'<td>'+stBadge(c.status)+'</td>'
        +'<td>'+(c.klant||'-')+'</td>'
        +'<td>'+([c.begeleider_1,c.begeleider_2].filter(Boolean).join(', ')||'-')+'</td>'
        +'<td>'+(c.locatie||'-')+'</td>'
        +'<td style="font-size:11px;color:var(--t2)">'+bLabel+'</td>'
        +'<td style="text-align:right">'+fmtE(t.beschikt)+'</td>'
        +'<td>'+fmtD(c.einde_beschikking)+'</td>'
        +'</tr>';
    }).join('');
  }

  else if(view==='financieel'){
    thead.innerHTML='<tr><th>Naam</th><th>Status</th><th>Klant</th><th>Besch.</th><th>Beschikt</th><th>Gefactureerd</th><th>Betaald</th><th>Openstaand</th><th>%</th></tr>';
    if(!rows.length){tbody.innerHTML='<tr><td colspan="9"><div class="empty-state">Geen cliënten gevonden</div></td></tr>';return;}
    tbody.innerHTML=rows.map(function(c){
      var t=getBeschikkingenTotalen(c.id);
      var o=t.beschikt-t.gefact;
      var pct=t.beschikt>0?Math.round(t.gefact/t.beschikt*100):0;
      var kleurO=o>0?'#854F0B':'#0F6E56';
      return '<tr class="row-link" onclick="openDetail(\''+c.id+'\')">'
        +'<td style="font-weight:500">'+c.naam+'</td>'
        +'<td>'+stBadge(c.status)+'</td>'
        +'<td>'+(c.klant||'-')+'</td>'
        +'<td style="text-align:center;color:var(--t2)">'+t.aantal+'</td>'
        +'<td style="text-align:right">'+fmtE(t.beschikt)+'</td>'
        +'<td style="text-align:right">'+fmtE(t.gefact)+'</td>'
        +'<td style="text-align:right">'+fmtE(t.betaald)+'</td>'
        +'<td style="text-align:right;color:'+kleurO+'">'+fmtE(o)+'</td>'
        +'<td style="text-align:center">'
        +'<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">'
        +'<div style="width:40px;height:5px;background:var(--bg3);border-radius:5px;overflow:hidden">'
        +'<div style="width:'+pct+'%;height:100%;background:#185FA5;border-radius:5px"></div>'
        +'</div>'
        +'<span style="font-size:11px;color:var(--t2)">'+pct+'%</span>'
        +'</div>'
        +'</td>'
        +'</tr>';
    }).join('');
  }

  else if(view==='per-klant'){
    var klanten=Array.from(new Set(rows.map(function(c){return c.klant||'Onbekend';}))).sort();
    thead.innerHTML='<tr><th>Naam</th><th>Status</th><th>Begeleider</th><th>Beschikkingen</th><th>Beschikt</th><th>Gefactureerd</th><th>Betaald</th></tr>';
    if(!rows.length){tbody.innerHTML='<tr><td colspan="7"><div class="empty-state">Geen cliënten gevonden</div></td></tr>';return;}
    var html='';
    klanten.forEach(function(klant){
      var sub=rows.filter(function(c){return (c.klant||'Onbekend')===klant;});
      var totB=0,totG=0,totP=0,totAantal=0;
      sub.forEach(function(c){var t=getBeschikkingenTotalen(c.id);totB+=t.beschikt;totG+=t.gefact;totP+=t.betaald;totAantal+=t.aantal;});
      html+='<tr style="background:var(--bg2)">'
        +'<td colspan="3" style="font-weight:500;color:var(--t1);padding:8px 13px">'+klant+' <span style="font-size:11px;font-weight:400;color:var(--t2)">('+sub.length+' cliënten, '+totAantal+' beschikkingen)</span></td>'
        +'<td style="text-align:center;padding:8px 13px;color:var(--t2)">'+totAantal+'</td>'
        +'<td style="text-align:right;padding:8px 13px;font-weight:500">'+fmtE(totB)+'</td>'
        +'<td style="text-align:right;padding:8px 13px;font-weight:500">'+fmtE(totG)+'</td>'
        +'<td style="text-align:right;padding:8px 13px;font-weight:500">'+fmtE(totP)+'</td>'
        +'</tr>';
      sub.forEach(function(c){
        var t=getBeschikkingenTotalen(c.id);
        var bs=_rapBeschikkingen[c.id]||[];
        html+='<tr class="row-link" onclick="openDetail(\''+c.id+'\')">'
        +'<td style="font-weight:500;padding-left:24px">'+c.naam+'</td>'
        +'<td>'+stBadge(c.status)+'</td>'
        +'<td>'+([c.begeleider_1,c.begeleider_2].filter(Boolean).join(', ')||'-')+'</td>'
        +'<td style="text-align:center;color:var(--t2)">'+bs.length+'</td>'
        +'<td style="text-align:right">'+fmtE(t.beschikt)+'</td>'
        +'<td style="text-align:right">'+fmtE(t.gefact)+'</td>'
        +'<td style="text-align:right">'+fmtE(t.betaald)+'</td>'
        +'</tr>';
      });
    });
    tbody.innerHTML=html;
  }
}

function resetRapFilters(){
  ['rf-status','rf-klant','rf-beg','rf-loc'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  var view=document.getElementById('rf-view');
  if(view)view.value='clienten';
  renderRapportage();
}

function exportHuidig(){
  var view=document.getElementById('rf-view')&&document.getElementById('rf-view').value||'clienten';
  var typeMap={clienten:'clienten',financieel:'financieel','per-klant':'per-klant'};
  var type=typeMap[view]||'clienten';
  exportRapport(type);
}

// ─── BESCHIKKINGEN ───────────────────────────────────────────────────────────

var _beschikkingen = [];
var _beschikkingenClientId = null;

function voegBeschikkingToe(){
  var nr = _beschikkingen.length + 1;
  var nieuw = {_tmp: true, _id: 'tmp_'+Date.now(), volgnummer: nr, datum_start:'', datum_einde:'', bedrag:'', product:'', toewijzingsnummer:'', opmerkingen:''};
  _beschikkingen.push(nieuw);
  renderBeschikkingenInModal();
}

function renderBeschikkingenInModal(){
  var list = document.getElementById('beschikking-list');
  if(!list) return;
  if(!_beschikkingen.length){
    list.innerHTML = '<div style="font-size:12px;color:var(--t3);text-align:center;padding:8px 0">Geen beschikkingen. Klik op + om er een toe te voegen.</div>';
    return;
  }
  list.innerHTML = _beschikkingen.map(function(b){
    var bid = b.id || b._id;
    return '<div class="beschikking-item" id="bitem-'+bid+'">'
      +'<div class="beschikking-item-header">'
        +'<span class="beschikking-nr">Beschikking '+b.volgnummer+'</span>'
        +'<button type="button" class="beschikking-del" onclick="verwijderBeschikkingModal(\''+bid+'\')" title="Verwijderen">&#10005;</button>'
      +'</div>'
      +'<div class="beschikking-grid">'
        +'<div class="ff2"><label>Datum start</label><input type="date" id="bs-start-'+bid+'" value="'+(b.datum_start||'')+'"></div>'
        +'<div class="ff2"><label>Datum einde</label><input type="date" id="bs-einde-'+bid+'" value="'+(b.datum_einde||'')+'"></div>'
        +'<div class="ff2"><label>Bedrag beschikt (€)</label><input type="number" step="0.01" id="bs-bedrag-beschikt-'+bid+'" value="'+(b.bedrag_beschikt||'')+'"></div>'
        +'<div class="ff2"><label>Gefactureerd (€)</label><input type="number" step="0.01" id="bs-gefact-'+bid+'" value="'+(b.gefactureerd||'')+'"></div>'
        +'<div class="ff2"><label>Betaald (€)</label><input type="number" step="0.01" id="bs-betaald-'+bid+'" value="'+(b.betaald||'')+'"></div>'
        +'<div class="ff2"><label>Factuurtype</label>'
          +'<select id="bs-facturatie-type-'+bid+'" onchange="toggleBeschikkingFacturatie(\''+bid+'\')">'
            +'<option value="">— Selecteer type —</option>'
            +'<option value="vast_bedrag"'+(b.facturatie_type==='vast_bedrag'?' selected':'')+'>Vast bedrag</option>'
            +'<option value="uurtarief"'+(b.facturatie_type==='uurtarief'?' selected':'')+'>Uurtarief</option>'
          +'</select>'
        +'</div>'
        +'<div class="ff2 full beschikking-vast-'+bid+'" style="display:'+(b.facturatie_type==='vast_bedrag'?'block':'none')+'">'
          +'<label>Vast bedrag (€)</label><input type="number" step="0.01" id="bs-vast-'+bid+'" value="'+(b.vast_bedrag||'')+'"></div>'
        +'<div class="beschikking-uur-'+bid+'" style="display:'+(b.facturatie_type==='uurtarief'?'contents':'none')+'">'
          +'<div class="ff2"><label>Uren</label><input type="number" min="0" id="bs-uren-'+bid+'" value="'+(b.uren||'')+'"></div>'
          +'<div class="ff2"><label>Minuten</label>'
            +'<select id="bs-minuten-'+bid+'">'
              +'<option value="">—</option>'
              +'<option value="0"'+(b.minuten==0?' selected':'')+'>0 min</option>'
              +'<option value="15"'+(b.minuten==15?' selected':'')+'>15 min</option>'
              +'<option value="30"'+(b.minuten==30?' selected':'')+'>30 min</option>'
              +'<option value="45"'+(b.minuten==45?' selected':'')+'>45 min</option>'
            +'</select>'
          +'</div>'
          +'<div class="ff2"><label>Prijs per uur (€)</label><input type="number" step="0.01" min="0" id="bs-prijs-uur-'+bid+'" value="'+(b.prijs_per_uur||'')+'"></div>'
          +'<div class="ff2"><label>Prijs per minuut (€)</label><input type="number" step="0.001" min="0" id="bs-prijs-min-'+bid+'" value="'+(b.prijs_per_minuut||'')+'"></div>'
        +'</div>'
      +'</div>'
    +'</div>';
  }).join('');
}

function verwijderBeschikkingModal(bid){
  _beschikkingen = _beschikkingen.filter(function(b){ return (b.id||b._id) !== bid; });
  _beschikkingen.forEach(function(b, i){ b.volgnummer = i+1; });
  renderBeschikkingenInModal();
}

function toggleBeschikkingFacturatie(bid){
  var type = document.getElementById('bs-facturatie-type-'+bid).value;
  var vastEl = document.querySelector('.beschikking-vast-'+bid);
  var uurEl = document.querySelector('.beschikking-uur-'+bid);
  if(vastEl) vastEl.style.display = type==='vast_bedrag'?'block':'none';
  if(uurEl) uurEl.style.display = type==='uurtarief'?'contents':'none';
}

function getBeschikkingenFormData(){
  return _beschikkingen.map(function(b){
    var bid = b.id || b._id;
    var g = function(id){ var el=document.getElementById(id); return el?el.value:null; };
    return {
      _id: b.id || null,
      _tmp: b._tmp || false,
      datum_start: g('bs-start-'+bid) || null,
      datum_einde: g('bs-einde-'+bid) || null,
      bedrag_beschikt: parseFloat(g('bs-bedrag-beschikt-'+bid)) || null,
      gefactureerd: parseFloat(g('bs-gefact-'+bid)) || null,
      betaald: parseFloat(g('bs-betaald-'+bid)) || null,
      facturatie_type: g('bs-facturatie-type-'+bid) || null,
      vast_bedrag: parseFloat(g('bs-vast-'+bid)) || null,
      uren: parseInt(g('bs-uren-'+bid)) || null,
      minuten: parseInt(g('bs-minuten-'+bid)) || null,
      prijs_per_uur: parseFloat(g('bs-prijs-uur-'+bid)) || null,
      prijs_per_minuut: parseFloat(g('bs-prijs-min-'+bid)) || null,
    };
  });
}

function laadBeschikkingenVoorModal(clientId){
  _beschikkingenClientId = clientId;
  if(!clientId){_beschikkingen=[];renderBeschikkingenInModal();return;}
  api('GET', '/clienten/'+clientId+'/beschikkingen').then(function(data){
    _beschikkingen = data||[];
    renderBeschikkingenInModal();
  }).catch(function(){_beschikkingen=[];renderBeschikkingenInModal();});
}

function slaanBeschikkingenOp(clientId){
  var formData = getBeschikkingenFormData();
  var bestaand = formData.filter(function(b){return !b._tmp&&b._id;});
  var nieuw = formData.filter(function(b){return b._tmp||!b._id;});
  var promises = [];
  function toBody(b){
    return {
      datum_start:b.datum_start, datum_einde:b.datum_einde,
      bedrag_beschikt:b.bedrag_beschikt, gefactureerd:b.gefactureerd, betaald:b.betaald,
      facturatie_type:b.facturatie_type, vast_bedrag:b.vast_bedrag,
      uren:b.uren, minuten:b.minuten,
      prijs_per_uur:b.prijs_per_uur, prijs_per_minuut:b.prijs_per_minuut,
    };
  }
  bestaand.forEach(function(b){
    promises.push(api('PUT','/clienten/'+clientId+'/beschikkingen/'+b._id, toBody(b)));
  });
  nieuw.forEach(function(b){
    promises.push(api('POST','/clienten/'+clientId+'/beschikkingen', toBody(b)));
  });
  return Promise.all(promises);
}

function renderBeschikkingenInDossier(clientId, beschikkingen, canWrite){
  if(!beschikkingen||!beschikkingen.length){
    return '<div style="font-size:13px;color:var(--t2);padding:6px 0">Geen beschikkingen geregistreerd.'
      +(canWrite?' <button class="abtn" style="margin-left:8px" onclick="openModal(\''+clientId+'\')">+ Toevoegen</button>':'')+'</div>';
  }
  var html='<div class="beschikking-list">';
  beschikkingen.forEach(function(b){
    var factuurLabel = b.facturatie_type==='vast_bedrag'?'Vast bedrag':b.facturatie_type==='uurtarief'?'Uurtarief':'';
    var tijdStr = b.facturatie_type==='uurtarief'?(b.uren||0)+' uur '+(b.minuten||0)+' min':'';
    html+='<div class="beschikking-item">'
      +'<div class="beschikking-item-header">'
        +'<span class="beschikking-nr">Beschikking '+b.volgnummer+'</span>'
        +(canWrite?'<button class="beschikking-del" onclick="verwijderBeschikkingDossier(\''+clientId+'\',\''+b.id+'\')" title="Verwijderen">&#10005;</button>':'')
      +'</div>'
      +'<div class="beschikking-grid">'
        +'<div class="ff2"><span class="fin-label">Datum start</span><div style="font-size:13px;font-weight:500;color:var(--t1);margin-top:2px">'+fmtD(b.datum_start)+'</div></div>'
        +'<div class="ff2"><span class="fin-label">Datum einde</span><div style="font-size:13px;font-weight:500;color:var(--t1);margin-top:2px">'+fmtD(b.datum_einde)+'</div></div>'
        +(b.bedrag_beschikt?'<div class="ff2"><span class="fin-label">Bedrag beschikt</span><div style="font-size:13px;font-weight:500;color:var(--t1);margin-top:2px">'+fmtE(b.bedrag_beschikt)+'</div></div>':'')
        +(b.gefactureerd?'<div class="ff2"><span class="fin-label">Gefactureerd</span><div style="font-size:13px;font-weight:500;color:var(--t1);margin-top:2px">'+fmtE(b.gefactureerd)+'</div></div>':'')
        +(b.betaald?'<div class="ff2"><span class="fin-label">Betaald</span><div style="font-size:13px;font-weight:500;color:#0F6E56;margin-top:2px">'+fmtE(b.betaald)+'</div></div>':'')
        +(factuurLabel?'<div class="ff2"><span class="fin-label">Factuurtype</span><div style="font-size:13px;font-weight:500;color:var(--t1);margin-top:2px">'+factuurLabel+'</div></div>':'')
        +(b.facturatie_type==='vast_bedrag'&&b.vast_bedrag?'<div class="ff2"><span class="fin-label">Vast bedrag</span><div style="font-size:13px;font-weight:500;color:var(--t1);margin-top:2px">'+fmtE(b.vast_bedrag)+'</div></div>':'')
        +(b.facturatie_type==='uurtarief'&&tijdStr?'<div class="ff2"><span class="fin-label">Tijd</span><div style="font-size:13px;font-weight:500;color:var(--t1);margin-top:2px">'+tijdStr+'</div></div>':'')
        +(b.facturatie_type==='uurtarief'&&b.prijs_per_uur?'<div class="ff2"><span class="fin-label">Prijs per uur</span><div style="font-size:13px;font-weight:500;color:var(--t1);margin-top:2px">'+fmtE(b.prijs_per_uur)+'</div></div>':'')
        +(b.facturatie_type==='uurtarief'&&b.prijs_per_minuut?'<div class="ff2"><span class="fin-label">Prijs per minuut</span><div style="font-size:13px;font-weight:500;color:var(--t1);margin-top:2px">'+fmtE(b.prijs_per_minuut)+'</div></div>':'')
      +'</div>'
    +'</div>';
  });
  html+='</div>';
  return html;
}

function verwijderBeschikkingDossier(clientId, beschikkingId){
  if(!confirm('Beschikking verwijderen?'))return;
  api('DELETE','/clienten/'+clientId+'/beschikkingen/'+beschikkingId).then(function(){
    openDetail(clientId);
  }).catch(function(e){alert('Fout: '+e.message);});
}

// ─── IMPORT ─────────────────────────────────────────────────────────────────

var _importBestand = null;

function openImportModal(){
  _importBestand = null;
  document.getElementById('import-filename').textContent = '';
  document.getElementById('import-result').style.display = 'none';
  document.getElementById('import-result').innerHTML = '';
  document.getElementById('import-file').value = '';
  var btn = document.getElementById('import-btn');
  btn.disabled = true;
  btn.style.opacity = '0.5';
  btn.style.cursor = 'default';
  document.getElementById('import-modal').classList.add('open');
}

function closeImportModal(){
  document.getElementById('import-modal').classList.remove('open');
  _importBestand = null;
}

function handleImportFile(input){
  var file = input.files[0];
  if(!file) return;
  _importBestand = file;
  document.getElementById('import-filename').textContent = file.name + ' (' + Math.round(file.size/1024) + ' KB)';
  var btn = document.getElementById('import-btn');
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.style.cursor = 'pointer';
}

function handleImportDrop(event){
  event.preventDefault();
  document.getElementById('import-dropzone').style.borderColor = '';
  var file = event.dataTransfer.files[0];
  if(!file) return;
  _importBestand = file;
  document.getElementById('import-filename').textContent = file.name + ' (' + Math.round(file.size/1024) + ' KB)';
  var btn = document.getElementById('import-btn');
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.style.cursor = 'pointer';
}

function uitvoerenImport(){
  if(!_importBestand) return;
  var btn = document.getElementById('import-btn');
  btn.textContent = 'Bezig...';
  btn.disabled = true;
  btn.style.opacity = '0.6';

  var formData = new FormData();
  formData.append('file', _importBestand);

  fetch('/api/import', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: formData,
  })
  .then(function(r){
    var contentType = r.headers.get('content-type') || '';
    if(contentType.indexOf('application/json') === -1){
      return r.text().then(function(txt){
        throw new Error('Server fout (geen JSON): ' + txt.substring(0, 200));
      });
    }
    return r.json().then(function(data){ return { ok: r.ok, data: data }; });
  })
  .then(function(res){
    var el = document.getElementById('import-result');
    el.style.display = 'block';
    if(res.ok){
      var kleur = res.data.overgeslagen > 0 ? '#854F0B' : '#0F6E56';
      var bg = res.data.overgeslagen > 0 ? '#FAEEDA' : '#E1F5EE';
      el.innerHTML = '<div style="background:'+bg+';border:0.5px solid '+kleur+';border-radius:var(--r);padding:12px 14px;font-size:13px;color:'+kleur+'">'
        + '<strong>' + res.data.bericht + '</strong>'
        + (res.data.fouten && res.data.fouten.length ? '<ul style="margin-top:8px;padding-left:16px">' + res.data.fouten.map(function(f){ return '<li>'+f+'</li>'; }).join('') + '</ul>' : '')
        + '</div>';
      if(res.data.toegevoegd > 0){
        loadAll().then(function(){ renderList(); });
      }
    } else {
      el.innerHTML = '<div style="background:#FCEBEB;border:0.5px solid #A32D2D;border-radius:var(--r);padding:12px 14px;font-size:13px;color:#7a1f1f">'
        + (res.data.detail || 'Importeren mislukt') + '</div>';
    }
  })
  .catch(function(e){
    var el = document.getElementById('import-result');
    el.style.display = 'block';
    el.innerHTML = '<div style="background:#FCEBEB;border:0.5px solid #A32D2D;border-radius:var(--r);padding:12px 14px;font-size:13px;color:#7a1f1f">Fout: ' + e.message + '</div>';
  })
  .finally(function(){
    btn.textContent = 'Importeren';
    btn.disabled = false;
    btn.style.opacity = '1';
  });
}
