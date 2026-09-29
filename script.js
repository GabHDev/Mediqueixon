const Banco = {
    nuvem:null, pronto:false,
    cache:{pacientes:{}, atendimentos:{}, profissionais:{}, sistema:{}},
    ouvintes:[],
    async iniciar(){
      try{ if(window.claude && claude.use) this.nuvem = await claude.use('db'); }catch(e){ this.nuvem=null; }
      if(this.nuvem){
        for(const col of ['pacientes','atendimentos','profissionais','sistema']){
          try{
            this.nuvem.collection(col).onSnapshot(snap=>{
              const novo={};
              snap.docs.forEach(d=>{ novo[d.id]=Object.assign({id:d.id}, d.data()); });
              this.cache[col]=novo; this.pronto=true; this.avisar();
            }, ()=>{});
          }catch(e){}
        }
        document.getElementById('infoBanco').textContent =
          'Esta demonstração está gravando no banco de documentos do artefato (na nuvem). Ele é compartilhado: o que o paciente envia aparece na hora para a enfermagem, em outro aparelho.';
      }else{
        for(const col of ['pacientes','atendimentos','profissionais','sistema']){
          try{ this.cache[col]=JSON.parse(localStorage.getItem('triagem:'+col)||'{}'); }catch(e){ this.cache[col]={}; }
        }
        const el=document.getElementById('infoBanco');
        if(el) el.textContent='Esta cópia está gravando no armazenamento do próprio navegador (localStorage). Os dados ficam só neste aparelho.';
      }
      this.pronto=true; this.avisar();
    },
    avisar(){ this.ouvintes.forEach(f=>{ try{f();}catch(e){} }); },
    aoMudar(f){ this.ouvintes.push(f); },
    lista(col){ return Object.values(this.cache[col]||{}); },
    pega(col,id){ return (this.cache[col]||{})[id]||null; },
    async salva(col,id,obj){
      const corpo=Object.assign({},obj); delete corpo.id;
      this.cache[col][id]=Object.assign({id},corpo);
      if(this.nuvem){ try{ await this.nuvem.doc(col+'/'+id).set(corpo); }catch(e){ Aviso.mostrar('Não consegui gravar agora. Tente de novo.'); } }
      else localStorage.setItem('triagem:'+col, JSON.stringify(this.cache[col]));
      this.avisar();
    },
    async apaga(col,id){
      delete this.cache[col][id];
      if(this.nuvem){ try{ await this.nuvem.doc(col+'/'+id).delete(); }catch(e){} }
      else localStorage.setItem('triagem:'+col, JSON.stringify(this.cache[col]));
      this.avisar();
    }
  };
  
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const Aviso = { t:null, mostrar(txt){ const r=$('#recado'); r.textContent=txt; r.classList.add('aparece'); clearTimeout(this.t); this.t=setTimeout(()=>r.classList.remove('aparece'),3200); } };
  const soNumeros = s => (s||'').replace(/\D/g,'');
  const id = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  
  function embaralhaSenha(txt){ let h=5381; for(let i=0;i<txt.length;i++) h=((h<<5)+h+txt.charCodeAt(i))|0; return 'd'+Math.abs(h).toString(36); }
  
  function validaCPF(v){
    const c=soNumeros(v); if(c.length!==11||/^(\d)\1{10}$/.test(c)) return false;
    let s=0; for(let i=0;i<9;i++) s+=+c[i]*(10-i);
    let d1=(s*10)%11; if(d1===10) d1=0; if(d1!==+c[9]) return false;
    s=0; for(let i=0;i<10;i++) s+=+c[i]*(11-i);
    let d2=(s*10)%11; if(d2===10) d2=0; return d2===+c[10];
  }
  function formataCPF(v){ const c=soNumeros(v).slice(0,11); return c.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2'); }
  function mascaraCPF(v){ const c=soNumeros(v); return c.length===11 ? '•••.'+c.slice(3,6)+'.•••-••' : '•••'; }
  function mascaraRG(v){ const c=(v||'').trim(); return c ? '••••'+c.slice(-2) : '—'; }
  function idade(nasc){ if(!nasc) return '—'; const d=new Date(nasc), h=new Date(); let a=h.getFullYear()-d.getFullYear(); const m=h.getMonth()-d.getMonth(); if(m<0||(m===0&&h.getDate()<d.getDate())) a--; return a+' anos'; }
  function hora(ts){ return new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); }
  function espera(ts){ const m=Math.floor((Date.now()-ts)/60000); if(m<60) return m+' min'; const h=Math.floor(m/60); return h+'h'+String(m%60).padStart(2,'0'); }
  
  let sessao=null;
  function vaPara(nome){
    $$('.tela').forEach(t=>t.classList.remove('ativa'));
    const alvo=$('#tela-'+nome); if(alvo) alvo.classList.add('ativa');
    $('#topo').hidden = (nome==='inicio');
    window.scrollTo({top:0,behavior:'instant'});
    if(nome==='prof-painel') desenhaFila();
    if(nome==='paciente-painel') desenhaPaciente();
  }
  $$('[data-ir]').forEach(b=>b.addEventListener('click',()=>{
    const d=b.dataset.ir;
    if(d==='paciente') vaPara('paciente-entrada');
    else if(d==='enfermeiro'||d==='tecnico'){ prepararLoginProf(d); }
    else vaPara(d);
  }));
  $('#btnManual').addEventListener('click',()=>vaPara('manual'));
  $('#voltarInicio').addEventListener('click',()=>vaPara(sessao? (sessao.papel==='paciente'?'paciente-painel':'prof-painel') : 'inicio'));
  $('#btnSair').addEventListener('click',()=>{ sessao=null; sessionStorage.removeItem('triagem:sessao'); $('#quemSou').textContent=''; vaPara('inicio'); });
  $('#btnTema').addEventListener('click',()=>{
    const atual=document.documentElement.getAttribute('data-theme');
    const escuro=window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', atual? (atual==='dark'?'light':'dark') : (escuro?'light':'dark'));
  });
  $$('.abas').forEach(grupo=>{
    grupo.addEventListener('click',e=>{
      const b=e.target.closest('button[data-painel]'); if(!b) return;
      grupo.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected', x===b));
      const irmaos=b.dataset.painel;
      grupo.parentElement.querySelectorAll(':scope > .painel').forEach(p=>p.classList.toggle('ativo', p.id===irmaos));
    });
  });
  
  const CARAS = [
    {cor:'amarelo', boca:'sorrisao', texto:'Quase não dói'},
    {cor:'amarelo', boca:'sorriso'},
    {cor:'amarelo', boca:'sorrisinho'},
    {cor:'amarelo', boca:'reta'},
    {cor:'amarelo', boca:'reta', texto:'Dá para aguentar'},
    {cor:'laranja', boca:'reta'},
    {cor:'laranja', boca:'reta'},
    {cor:'laranja', boca:'triste', texto:'Está atrapalhando'},
    {cor:'vermelho', boca:'muitotriste', olhos:'x'},
    {cor:'vermelho', boca:'careta', olhos:'x', texto:'A pior dor possível'}
  ];
  const PALETA = {amarelo:['#FFE45C','#F2C200'], laranja:['#FCB13E','#EE8B00'], vermelho:['#F4574C','#D2251B']};
  function desenhaCara(i){
    const c=CARAS[i], [claro,escuro]=PALETA[c.cor], g='g'+i;
    let olhos = c.olhos==='x'
      ? `<g stroke="#101010" stroke-width="7" stroke-linecap="round">
           <path d="M29,34 L43,46 M43,34 L29,46"/><path d="M57,34 L71,46 M71,34 L57,46"/></g>`
      : `<circle cx="36" cy="41" r="6.5" fill="#101010"/><circle cx="64" cy="41" r="6.5" fill="#101010"/>`;
    const bocas = {
      sorrisao:'<path d="M24,54 Q50,92 76,54 Z" fill="#101010"/>',
      sorriso:'<path d="M25,56 Q50,84 75,56" fill="none" stroke="#101010" stroke-width="8" stroke-linecap="round"/>',
      sorrisinho:'<path d="M27,58 Q50,76 73,58" fill="none" stroke="#101010" stroke-width="8" stroke-linecap="round"/>',
      reta:'<rect x="28" y="62" width="44" height="8" rx="4" fill="#101010"/>',
      triste:'<path d="M28,70 Q50,56 72,70" fill="none" stroke="#101010" stroke-width="8" stroke-linecap="round"/>',
      muitotriste:'<path d="M27,74 Q50,52 73,74" fill="none" stroke="#101010" stroke-width="8" stroke-linecap="round"/>',
      careta:`<rect x="27" y="58" width="46" height="20" rx="8" fill="#101010"/>
              <g stroke="#FFF" stroke-width="3"><path d="M27,68 H73"/><path d="M39,58 V78"/><path d="M50,58 V78"/><path d="M61,58 V78"/></g>`
    };
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><radialGradient id="${g}" cx="38%" cy="30%" r="78%">
        <stop offset="0%" stop-color="${claro}"/><stop offset="100%" stop-color="${escuro}"/></radialGradient></defs>
      <circle cx="50" cy="50" r="44" fill="url(#${g})" stroke="#101010" stroke-width="6"/>
      ${olhos}${bocas[c.boca]}</svg>`;
  }
  let dorEscolhida=null;
  function montaEscala(){
    const box=$('#escalaDor'); box.innerHTML='';
    CARAS.forEach((c,i)=>{
      const b=document.createElement('button');
      b.type='button'; b.className='dor-item'; b.setAttribute('aria-pressed','false');
      b.setAttribute('aria-label','Dor nível '+(i+1)+(c.texto?' — '+c.texto:''));
      b.innerHTML=desenhaCara(i)+'<span>'+(i+1)+'</span>';
      b.addEventListener('click',()=>{
        dorEscolhida=i+1;
        $$('#escalaDor .dor-item').forEach((x,j)=>x.setAttribute('aria-pressed', j===i));
        $('#dorLegenda').textContent = 'Dor '+dorEscolhida+' de 10 — '+descreveDor(dorEscolhida);
      });
      box.appendChild(b);
    });
  }
  function descreveDor(n){
    if(n<=2) return 'leve';
    if(n<=4) return 'incômoda';
    if(n<=6) return 'moderada';
    if(n<=8) return 'forte';
    return 'insuportável';
  }
  
  async function registrar(acao, alvo){
    const doc = Banco.pega('sistema','auditoria') || {eventos:[]};
    const eventos = (doc.eventos||[]).slice(-199);
    eventos.push({quando:Date.now(), quem: sessao?sessao.nome:'—', papel: sessao?sessao.papel:'—', acao, alvo:alvo||''});
    await Banco.salva('sistema','auditoria',{eventos});
  }
  
  ['c-cpf','le-cpf','f-cpf','ac-cpf'].forEach(k=>{
    const el=$('#'+k); if(el) el.addEventListener('input',()=>{ el.value=formataCPF(el.value); });
  });
  $('#formCadastro').addEventListener('submit', async e=>{
    e.preventDefault();
    const err=$('#c-erro'); err.textContent='';
    const obrig=[['c-nome','o nome completo'],['c-nasc','a data de nascimento'],['c-rg','o RG'],['c-tel','o telefone'],['c-alergia','o campo de alergias'],['c-em-nome','o contato de emergência'],['c-em-par','o parentesco do contato'],['c-em-tel','o telefone do contato']];
    for(const [k,nome] of obrig){ if(!$('#'+k).value.trim()){ err.textContent='Falta preencher '+nome+'.'; $('#'+k).focus(); return; } }
    if(!validaCPF($('#c-cpf').value)){ err.textContent='CPF inválido. Confira os números.'; $('#c-cpf').focus(); return; }
    if($('#c-senha').value.length<6){ err.textContent='A senha precisa ter pelo menos 6 caracteres.'; return; }
    if($('#c-senha').value!==$('#c-senha2').value){ err.textContent='As duas senhas estão diferentes.'; return; }
    if(!$('#c-consent').checked){ err.textContent='Sem o consentimento da LGPD o cadastro não pode ser salvo.'; return; }
    const cpf=soNumeros($('#c-cpf').value);
    if(Banco.lista('pacientes').some(p=>p.cpf===cpf)){ err.textContent='Já existe um cadastro com este CPF. Use a aba Entrar.'; return; }
    const p={
      nome:$('#c-nome').value.trim(), nomeSocial:$('#c-social').value.trim(),
      nascimento:$('#c-nasc').value, cpf, rg:$('#c-rg').value.trim(),
      sus:$('#c-sus').value.trim(), govbr:$('#c-govbr').value.trim(),
      telefone:$('#c-tel').value.trim(), sangue:$('#c-sangue').value,
      endereco:{cep:$('#c-cep').value,rua:$('#c-rua').value,num:$('#c-num').value,bairro:$('#c-bairro').value,cidade:$('#c-cidade').value,uf:$('#c-uf').value.toUpperCase()},
      alergias:$('#c-alergia').value.trim(),
      doencas:$$('#c-doencas input:checked').map(i=>i.value),
      outras:$('#c-outras').value.trim(), medicamentos:$('#c-medic').value.trim(),
      emergencia:{nome:$('#c-em-nome').value,parentesco:$('#c-em-par').value,telefone:$('#c-em-tel').value},
      senha:embaralhaSenha($('#c-senha').value),
      consentimento:{aceito:true, quando:Date.now(), versao:'1.0'},
      criadoEm:Date.now()
    };
    const novo=id();
    await Banco.salva('pacientes',novo,p);
    sessao={papel:'paciente', id:novo, nome:p.nomeSocial||p.nome};
    await registrar('Criou o cadastro','paciente '+novo);
    Aviso.mostrar('Cadastro criado. Agora conte o que está sentindo.');
    entrouPaciente();
  });
  $('#btnEntrarPaciente').addEventListener('click', async ()=>{
    const err=$('#le-erro'); err.textContent='';
    const cpf=soNumeros($('#le-cpf').value);
    const p=Banco.lista('pacientes').find(x=>x.cpf===cpf);
    if(!p || p.senha!==embaralhaSenha($('#le-senha').value)){ err.textContent='CPF ou senha não conferem.'; return; }
    sessao={papel:'paciente', id:p.id, nome:p.nomeSocial||p.nome};
    await registrar('Entrou no sistema','paciente '+p.id);
    entrouPaciente();
  });
  function entrouPaciente(){
    const p=Banco.pega('pacientes',sessao.id);
    $('#quemSou').textContent='Paciente · '+(p.nomeSocial||p.nome);
    $('#pac-saudacao').textContent='Olá, '+(p.nomeSocial||p.nome).split(' ')[0];
    vaPara('paciente-painel');
  }
  $('#formAtend').addEventListener('submit', async e=>{
    e.preventDefault();
    const err=$('#a-erro'); err.textContent='';
    if(!$('#a-motivo').value.trim()||!$('#a-sintomas').value.trim()){ err.textContent='Conte o motivo e descreva os sintomas.'; return; }
    if(!dorEscolhida){ err.textContent='Escolha uma carinha na escala de dor.'; return; }
    const senha='T'+String(Banco.lista('atendimentos').length+1).padStart(3,'0');
    const at={
      pacienteId:sessao.id, senhaChamada:senha, abertoEm:Date.now(),
      motivo:$('#a-motivo').value.trim(), inicio:$('#a-inicio').value.trim(),
      sintomas:$('#a-sintomas').value.trim(), dor:dorEscolhida,
      risco:null, riscoConfirmado:false, status:'aguardando',
      acompanhante:{nome:$('#ac-nome').value,parentesco:$('#ac-par').value,rg:$('#ac-rg').value,cpf:soNumeros($('#ac-cpf').value),telefone:$('#ac-tel').value,endereco:$('#ac-end').value},
      sinais:{}, anotacoes:'', eventos:[{quando:Date.now(), texto:'Ficha aberta pelo paciente'}]
    };
    await Banco.salva('atendimentos',id(),at);
    await registrar('Abriu atendimento', senha);
    e.target.reset(); dorEscolhida=null;
    $$('#escalaDor .dor-item').forEach(x=>x.setAttribute('aria-pressed','false'));
    $('#dorLegenda').textContent='Nenhuma carinha selecionada';
    Aviso.mostrar('Ficha enviada. Sua senha é '+senha+'.');
    desenhaPaciente();
  });
  
  function desenhaPaciente(){
    if(!sessao||sessao.papel!=='paciente') return;
    const p=Banco.pega('pacientes',sessao.id); if(!p) return;
    const meus=Banco.lista('atendimentos').filter(a=>a.pacienteId===p.id).sort((a,b)=>b.abertoEm-a.abertoEm);
    const aberto=meus.find(a=>a.status!=='finalizado');
  
    $('#atendAberto').innerHTML = aberto ? `
      <div class="cartao" style="border-left:5px solid ${aberto.risco?'var(--'+aberto.risco+')':'var(--agua)'}">
        <h2 style="margin-bottom:2px">Você está na fila — senha ${esc(aberto.senhaChamada)}</h2>
        <p style="color:var(--tinta-2);margin-bottom:10px">Aberta às ${hora(aberto.abertoEm)} · esperando há ${espera(aberto.abertoEm)}</p>
        <p>${aberto.risco
          ? 'Classificação da enfermagem: <span class="bolinha '+aberto.risco+'"></span> <b>'+aberto.risco+'</b>'
          : 'Aguardando a enfermagem chamar você para medir os sinais vitais.'}</p>
        <p style="font-size:.88rem;color:var(--tinta-2)">Se piorar enquanto espera, avise a equipe no balcão.</p>
      </div>` : '';
    $('#formAtend').style.display = aberto ? 'none' : 'block';
  
    const e1=p.endereco||{};
    $('#tabelaMeusDados').innerHTML = `<tbody>
      ${linha('Nome',p.nome)}${linha('Nome social',p.nomeSocial||'—')}
      ${linha('Nascimento',(p.nascimento||'—')+' ('+idade(p.nascimento)+')')}
      ${linha('CPF',formataCPF(p.cpf))}${linha('RG',p.rg)}
      ${linha('Cartão SUS',p.sus||'—')}${linha('Conta gov.br',p.govbr||'—')}
      ${linha('Telefone',p.telefone)}${linha('Tipo sanguíneo',p.sangue||'Não informado')}
      ${linha('Endereço',[e1.rua,e1.num,e1.bairro,e1.cidade,e1.uf,e1.cep].filter(Boolean).join(', ')||'—')}
      ${linha('Alergia a medicamentos',p.alergias)}
      ${linha('Doenças',(p.doencas||[]).join(', ')||'Nenhuma marcada')}
      ${linha('Outras doenças / cirurgias',p.outras||'—')}
      ${linha('Medicamentos de uso contínuo',p.medicamentos||'—')}
      ${linha('Contato de emergência',(p.emergencia?p.emergencia.nome+' ('+p.emergencia.parentesco+') · '+p.emergencia.telefone:'—'))}
    </tbody>`;
  
    $('#histPaciente').innerHTML = meus.length ? `<div class="rolagem"><table>
      <thead><tr><th>Data</th><th>Senha</th><th>Motivo</th><th>Dor</th><th>Risco</th><th>Sinais vitais</th><th>Situação</th></tr></thead>
      <tbody>${meus.map(a=>`<tr>
        <td>${hora(a.abertoEm)}</td><td>${esc(a.senhaChamada)}</td><td>${esc(a.motivo)}</td>
        <td>${a.dor}/10</td>
        <td>${a.risco?'<span class="bolinha '+a.risco+'"></span> '+a.risco:'—'}</td>
        <td>${resumoSinais(a.sinais)}</td>
        <td>${esc(a.status)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="vazio">Você ainda não tem atendimentos registrados.</div>';
  
    const c=p.consentimento||{};
    $('#consentTexto').textContent = c.aceito
      ? 'Você autorizou o tratamento dos seus dados em '+hora(c.quando)+', termo versão '+c.versao+'. A finalidade é triagem e atendimento. Você pode revogar excluindo sua conta abaixo.'
      : 'Consentimento não registrado.';
  
    const ev=((Banco.pega('sistema','auditoria')||{}).eventos||[]).slice().reverse().slice(0,40);
    $('#tabelaAuditoria tbody').innerHTML = ev.length ? ev.map(x=>`<tr><td>${hora(x.quando)}</td><td>${esc(x.quem)}</td><td>${esc(x.papel)}</td><td>${esc(x.acao)}${x.alvo?' · '+esc(x.alvo):''}</td></tr>`).join('')
      : '<tr><td colspan="4" class="vazio">Nenhum acesso registrado ainda.</td></tr>';
  }
  function linha(t,v){ return `<tr><th>${esc(t)}</th><td>${esc(v)}</td></tr>`; }
  function resumoSinais(s){
    if(!s||!Object.keys(s).length) return '—';
    const partes=[]; if(s.pa) partes.push('P.A. '+s.pa); if(s.pag) partes.push('P.A.G. '+s.pag);
    if(s.fc) partes.push('FC '+s.fc); if(s.temp) partes.push('T '+s.temp+'°C'); if(s.spo2) partes.push('SpO₂ '+s.spo2+'%');
    return partes.join(' · ')||'—';
  }
  
  $('#btnExportar').addEventListener('click', async ()=>{
    const p=Banco.pega('pacientes',sessao.id);
    const meus=Banco.lista('atendimentos').filter(a=>a.pacienteId===p.id);
    const dados={paciente:p, atendimentos:meus, geradoEm:new Date().toISOString()};
    const texto=JSON.stringify(dados,null,2);
    let baixou=false;
    try{
      const d = window.claude && claude.use ? await claude.use('downloads') : null;
      if(d){ await d.save({filename:'meus-dados-triagem.json', data:texto}); baixou=true; }
    }catch(e){}
    if(!baixou){
      const janela=window.open('','_blank');
      if(janela){ janela.document.write('<pre>'+esc(texto)+'</pre>'); baixou=true; }
    }
    await registrar('Exportou os próprios dados','');
    Aviso.mostrar(baixou?'Seus dados foram gerados.':'Não consegui abrir o arquivo aqui.');
  });
  $('#btnExcluir').addEventListener('click', async ()=>{
    if(!confirm('Isso apaga seu cadastro e todo o seu histórico, sem volta. Confirmar?')) return;
    const meus=Banco.lista('atendimentos').filter(a=>a.pacienteId===sessao.id);
    for(const a of meus) await Banco.apaga('atendimentos',a.id);
    await Banco.apaga('pacientes',sessao.id);
    await registrar('Excluiu a própria conta','');
    sessao=null; Aviso.mostrar('Seus dados foram excluídos.'); vaPara('inicio');
  });

  let papelEscolhido='enfermeiro';
  function prepararLoginProf(papel){
    papelEscolhido=papel;
    $('#prof-titulo').textContent = papel==='enfermeiro' ? 'Área do enfermeiro(a)' : 'Área do técnico(a) em enfermagem';
    $('#prof-sub').textContent = papel==='enfermeiro'
      ? 'Acesso privativo do enfermeiro: ficha completa, sinais vitais, classificação de risco e finalização do atendimento.'
      : 'Acesso do técnico: registro de sinais vitais e sugestão de cor. CPF e RG dos pacientes aparecem mascarados.';
    $('#f-erro').textContent=''; vaPara('prof-entrada');
  }
  $('#btnEntrarProf').addEventListener('click', async ()=>{
    const err=$('#f-erro'); err.textContent='';
    const nome=$('#f-nome').value.trim(), cpf=soNumeros($('#f-cpf').value), rg=$('#f-rg').value.trim(),
          coren=$('#f-coren').value.trim(), senha=$('#f-senha').value;
    if(!nome||!cpf||!rg||!coren||!senha){ err.textContent='Preencha nome, CPF, RG, COREN e senha.'; return; }
    if(!validaCPF(cpf)){ err.textContent='CPF inválido.'; return; }
    if(senha.length<6){ err.textContent='A senha precisa ter pelo menos 6 caracteres.'; return; }
    let prof=Banco.lista('profissionais').find(p=>p.cpf===cpf);
    if(prof){
      if(prof.senha!==embaralhaSenha(senha)){ err.textContent='Senha incorreta para este CPF.'; return; }
      if(prof.papel!==papelEscolhido){ err.textContent='Este CPF está cadastrado como '+prof.papel+'. Entre pela porta correta.'; return; }
    }else{
      const novo=id();
      prof={id:novo, nome, cpf, rg, coren, papel:papelEscolhido, senha:embaralhaSenha(senha), criadoEm:Date.now()};
      await Banco.salva('profissionais',novo,prof);
    }
    sessao={papel:prof.papel, id:prof.id, nome:prof.nome, coren:prof.coren};
    $('#quemSou').textContent=(prof.papel==='enfermeiro'?'Enf. ':'Téc. ')+prof.nome+' · '+prof.coren;
    await registrar('Entrou no plantão','');
    vaPara('prof-painel');
  });
  
  let selecionado=null;
  const ORDEM={null:0, vermelho:1, amarelo:2, verde:3};
  function desenhaFila(){
    if(!sessao||sessao.papel==='paciente') return;
    const ehEnf = sessao.papel==='enfermeiro';
    $('#avisoPerfil').innerHTML = ehEnf
      ? 'Você vê a ficha completa e é quem <b>confirma</b> a classificação de risco e finaliza o atendimento.'
      : 'Perfil técnico: CPF e RG aparecem mascarados (princípio da necessidade, LGPD). A cor que você marcar fica como <b>a confirmar</b> até um enfermeiro validar.';
    const verFin=$('#verFinalizados').checked;
    const lista=Banco.lista('atendimentos')
      .filter(a=>verFin?true:a.status!=='finalizado')
      .sort((a,b)=>{
        const ra=ORDEM[a.risco]??0, rb=ORDEM[b.risco]??0;
        if(a.status!==b.status) return a.status==='finalizado'?1:-1;
        if(ra!==rb) return ra-rb;
        return a.abertoEm-b.abertoEm;
      });
    const semCor=lista.filter(a=>!a.risco&&a.status!=='finalizado').length;
    $('#resumoFila').textContent = lista.length
      ? lista.filter(a=>a.status!=='finalizado').length+' pessoas aguardando · '+semCor+' ainda sem classificação'
      : 'Ninguém na fila agora.';
    const tb=$('#tabelaFila tbody');
    tb.innerHTML = lista.length ? lista.map(a=>{
      const p=Banco.pega('pacientes',a.pacienteId)||{nome:'(cadastro removido)'};
      return `<tr class="clicavel ${selecionado===a.id?'selecionada':''}" data-at="${a.id}">
        <td><span class="bolinha ${a.risco||'nenhum'}"></span>${a.risco&&!a.riscoConfirmado?'<br><span class="etiqueta">a confirmar</span>':''}</td>
        <td><b>${esc(p.nomeSocial||p.nome)}</b><br><span style="color:var(--tinta-2);font-size:.82rem">${esc(a.senhaChamada)} · ${idade(p.nascimento)}</span></td>
        <td>${a.dor}/10</td>
        <td>${a.status==='finalizado'?'<span class="etiqueta">finalizado</span>':espera(a.abertoEm)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="vazio">Nenhuma ficha aberta.</td></tr>';
    tb.querySelectorAll('tr[data-at]').forEach(tr=>tr.addEventListener('click',()=>abrirFicha(tr.dataset.at)));
    if(selecionado && Banco.pega('atendimentos',selecionado)) abrirFicha(selecionado,true);
  }
  $('#verFinalizados').addEventListener('change',desenhaFila);
  
  async function abrirFicha(atId, semLog){
    const a=Banco.pega('atendimentos',atId); if(!a) return;
    const p=Banco.pega('pacientes',a.pacienteId)||{};
    const ehEnf=sessao.papel==='enfermeiro';
    if(selecionado!==atId && !semLog){ await registrar('Abriu a ficha do paciente', a.senhaChamada); }
    selecionado=atId;
    $$('#tabelaFila tbody tr').forEach(tr=>tr.classList.toggle('selecionada', tr.dataset.at===atId));
    const s=a.sinais||{}, ac=a.acompanhante||{}, e1=p.endereco||{};
    const podeFinalizar = ehEnf && a.status!=='finalizado';
    $('#fichaPaciente').innerHTML=`
      <div class="cartao">
        <h2 style="margin-bottom:2px">${esc(p.nomeSocial||p.nome||'—')}</h2>
        <p style="color:var(--tinta-2)">Senha ${esc(a.senhaChamada)} · ${idade(p.nascimento)} · aberta ${hora(a.abertoEm)} · dor <b>${a.dor}/10 (${descreveDor(a.dor)})</b></p>
        ${p.alergias&&!/nenhum/i.test(p.alergias)?`<div class="aviso alerta"><b>Alergia:</b> ${esc(p.alergias)}</div>`:''}
        <div class="rolagem"><table class="ficha"><tbody>
          ${linha('Motivo da vinda',a.motivo)}
          ${linha('Começou',a.inicio||'—')}
          ${linha('Sintomas relatados',a.sintomas)}
          ${linha('CPF', ehEnf?formataCPF(p.cpf):mascaraCPF(p.cpf))}
          ${linha('RG', ehEnf?(p.rg||'—'):mascaraRG(p.rg))}
          ${ehEnf?linha('Cartão SUS',p.sus||'—')+linha('Conta gov.br',p.govbr||'—'):''}
          ${linha('Nascimento',p.nascimento||'—')}
          ${linha('Tipo sanguíneo',p.sangue||'Não informado')}
          ${linha('Doenças',(p.doencas||[]).join(', ')||'Nenhuma marcada')}
          ${linha('Outras doenças / cirurgias',p.outras||'—')}
          ${linha('Medicamentos de uso contínuo',p.medicamentos||'—')}
          ${linha('Telefone',p.telefone||'—')}
          ${ehEnf?linha('Endereço',[e1.rua,e1.num,e1.bairro,e1.cidade,e1.uf].filter(Boolean).join(', ')||'—'):''}
          ${linha('Contato de emergência',p.emergencia?p.emergencia.nome+' ('+p.emergencia.parentesco+') · '+p.emergencia.telefone:'—')}
        </tbody></table></div>
  
        <h3 style="margin-top:18px">Acompanhante</h3>
        <div class="rolagem"><table class="ficha"><tbody>
          ${linha('Nome',ac.nome||'Veio sozinho(a)')}
          ${linha('Grau de parentesco',ac.parentesco||'—')}
          ${linha('RG', ehEnf?(ac.rg||'—'):mascaraRG(ac.rg))}
          ${linha('CPF', ac.cpf?(ehEnf?formataCPF(ac.cpf):mascaraCPF(ac.cpf)):'—')}
          ${linha('Telefone',ac.telefone||'—')}
          ${linha('Onde reside',ac.endereco||'—')}
        </tbody></table></div>
      </div>
  
      <div class="cartao">
        <h3>Sinais vitais e medidas</h3>
        <div class="grade">
          <div class="campo"><label for="s-pa">P.A. <span class="dica">mmHg</span></label><input id="s-pa" placeholder="120/80" value="${esc(s.pa||'')}"></div>
          <div class="campo"><label for="s-pag">P.A.G. <span class="dica">conforme protocolo da unidade</span></label><input id="s-pag" placeholder="—" value="${esc(s.pag||'')}"></div>
          <div class="campo"><label for="s-fc">FC <span class="dica">bpm</span></label><input id="s-fc" inputmode="numeric" value="${esc(s.fc||'')}"></div>
          <div class="campo"><label for="s-fr">FR <span class="dica">irpm</span></label><input id="s-fr" inputmode="numeric" value="${esc(s.fr||'')}"></div>
          <div class="campo"><label for="s-temp">Temperatura <span class="dica">°C</span></label><input id="s-temp" inputmode="decimal" value="${esc(s.temp||'')}"></div>
          <div class="campo"><label for="s-spo2">Saturação <span class="dica">%</span></label><input id="s-spo2" inputmode="numeric" value="${esc(s.spo2||'')}"></div>
          <div class="campo"><label for="s-glic">Glicemia <span class="dica">mg/dL</span></label><input id="s-glic" inputmode="numeric" value="${esc(s.glicemia||'')}"></div>
          <div class="campo"><label for="s-peso">Peso <span class="dica">kg</span></label><input id="s-peso" inputmode="decimal" value="${esc(s.peso||'')}"></div>
        </div>
  
        <h3 style="margin-top:18px">Classificação de risco</h3>
        <div class="selbolinha" id="selRisco">
          <button type="button" data-risco="verde" aria-pressed="${a.risco==='verde'}"><span class="bolinha verde"></span> Verde · pode aguardar</button>
          <button type="button" data-risco="amarelo" aria-pressed="${a.risco==='amarelo'}"><span class="bolinha amarelo"></span> Amarelo · importante</button>
          <button type="button" data-risco="vermelho" aria-pressed="${a.risco==='vermelho'}"><span class="bolinha vermelho"></span> Vermelho · risco de vida</button>
        </div>
        <p style="font-size:.85rem;color:var(--tinta-2);margin-top:8px">${a.risco
          ? 'Marcado por '+esc(a.riscoPor||'—')+(a.riscoConfirmado?' · confirmado por enfermeiro':' · aguardando confirmação do enfermeiro')
          : 'Ainda sem cor.'}</p>
  
        <div class="campo" style="margin-top:14px"><label for="s-notas">Anotações da enfermagem</label><textarea id="s-notas" placeholder="Evolução, condutas, encaminhamento...">${esc(a.anotacoes||'')}</textarea></div>
        <div class="linha-botoes">
          <button class="btn" id="btnSalvarFicha">Salvar na ficha</button>
          ${podeFinalizar?'<button class="btn neutro" id="btnFinalizar">Encaminhar / finalizar</button>':''}
        </div>
        ${a.eventos&&a.eventos.length?`<h3 style="margin-top:20px">Linha do tempo</h3><ul style="font-size:.88rem;color:var(--tinta-2);padding-left:18px">${a.eventos.map(ev=>`<li>${hora(ev.quando)} — ${esc(ev.texto)}</li>`).join('')}</ul>`:''}
      </div>`;
  
    let riscoTmp=a.risco;
    $$('#selRisco button').forEach(b=>b.addEventListener('click',()=>{
      riscoTmp = (riscoTmp===b.dataset.risco)? null : b.dataset.risco;
      $$('#selRisco button').forEach(x=>x.setAttribute('aria-pressed', x.dataset.risco===riscoTmp));
    }));
  
    $('#btnSalvarFicha').addEventListener('click', async ()=>{
      const at=Banco.pega('atendimentos',atId);
      const sinais={pa:$('#s-pa').value.trim(), pag:$('#s-pag').value.trim(), fc:$('#s-fc').value.trim(),
        fr:$('#s-fr').value.trim(), temp:$('#s-temp').value.trim(), spo2:$('#s-spo2').value.trim(),
        glicemia:$('#s-glic').value.trim(), peso:$('#s-peso').value.trim(),
        medidoPor:sessao.nome, medidoEm:Date.now()};
      const eventos=(at.eventos||[]).slice();
      if(riscoTmp!==at.risco) eventos.push({quando:Date.now(), texto:'Risco '+(riscoTmp||'removido')+' por '+sessao.nome+' ('+sessao.papel+')'});
      eventos.push({quando:Date.now(), texto:'Sinais vitais registrados por '+sessao.nome});
      await Banco.salva('atendimentos',atId,Object.assign({},at,{
        sinais, anotacoes:$('#s-notas').value, risco:riscoTmp,
        riscoPor: riscoTmp? sessao.nome+' ('+sessao.coren+')' : null,
        riscoConfirmado: riscoTmp? (sessao.papel==='enfermeiro') : false,
        status: at.status==='aguardando'&&riscoTmp?'em atendimento':at.status,
        eventos
      }));
      await registrar('Registrou sinais vitais e risco '+(riscoTmp||'nenhum'), at.senhaChamada);
      Aviso.mostrar('Ficha salva.');
      desenhaFila();
    });
    const bf=$('#btnFinalizar');
    if(bf) bf.addEventListener('click', async ()=>{
      const at=Banco.pega('atendimentos',atId);
      if(!at.risco){ Aviso.mostrar('Classifique o risco antes de finalizar.'); return; }
      const eventos=(at.eventos||[]).concat([{quando:Date.now(), texto:'Atendimento finalizado por '+sessao.nome}]);
      await Banco.salva('atendimentos',atId,Object.assign({},at,{status:'finalizado', riscoConfirmado:true, eventos}));
      await registrar('Finalizou o atendimento', at.senhaChamada);
      selecionado=null; $('#fichaPaciente').innerHTML='<div class="cartao vazio">Selecione um paciente na fila para abrir a ficha.</div>';
      Aviso.mostrar('Atendimento finalizado e enviado ao histórico.');
      desenhaFila();
    });
  }

  $('#btnDemo').addEventListener('click', async ()=>{
    const modelos=[
      {nome:'Marina Alves de Souza', nomeSocial:'', nascimento:'1958-03-12', cpf:'11144477735', rg:'12.345.678-9',
       telefone:'(16) 99888-1122', sangue:'O+', alergias:'Dipirona', doencas:['Hipertensão','Diabetes'],
       motivo:'Dor no peito e falta de ar', sintomas:'Começou depois do almoço, aperto no peito que vai para o braço esquerdo.', dor:9,
       ac:{nome:'Paulo Souza', parentesco:'Filho', telefone:'(16) 99777-3311'}},
      {nome:'Renan Batista Lima', nomeSocial:'', nascimento:'1994-11-02', cpf:'52998224725', rg:'33.221.114-0',
       telefone:'(16) 99444-7788', sangue:'A+', alergias:'nenhuma', doencas:['Asma'],
       motivo:'Corte profundo na mão', sintomas:'Cortei com faca cozinhando, sangrou bastante mas parou com pano.', dor:6,
       ac:{nome:'', parentesco:'', telefone:''}},
      {nome:'Cecília Prado Nogueira', nomeSocial:'Ceci', nascimento:'2016-07-21', cpf:'15350946056', rg:'44.556.677-1',
       telefone:'(16) 99333-2211', sangue:'B+', alergias:'Penicilina', doencas:[],
       motivo:'Febre há dois dias', sintomas:'Febre de 38,5, sem tosse, comendo pouco.', dor:3,
       ac:{nome:'Juliana Prado', parentesco:'Mãe', telefone:'(16) 99333-2211'}}
    ];
    let n=0;
    for(const m of modelos){
      if(Banco.lista('pacientes').some(p=>p.cpf===m.cpf)) continue;
      const pid=id();
      await Banco.salva('pacientes',pid,{
        nome:m.nome, nomeSocial:m.nomeSocial, nascimento:m.nascimento, cpf:m.cpf, rg:m.rg,
        sus:'', govbr:'', telefone:m.telefone, sangue:m.sangue,
        endereco:{cep:'14400-000',rua:'Rua das Acácias',num:'120',bairro:'Centro',cidade:'Franca',uf:'SP'},
        alergias:m.alergias, doencas:m.doencas, outras:'', medicamentos:'',
        emergencia:{nome:m.ac.nome||'—',parentesco:m.ac.parentesco||'—',telefone:m.ac.telefone||'—'},
        senha:embaralhaSenha('123456'), consentimento:{aceito:true,quando:Date.now(),versao:'1.0'}, criadoEm:Date.now()
      });
      await Banco.salva('atendimentos',id(),{
        pacienteId:pid, senhaChamada:'T'+String(Banco.lista('atendimentos').length+1).padStart(3,'0'),
        abertoEm:Date.now()-(++n*17*60000), motivo:m.motivo, inicio:'Hoje', sintomas:m.sintomas, dor:m.dor,
        risco:null, riscoConfirmado:false, status:'aguardando', acompanhante:m.ac, sinais:{}, anotacoes:'',
        eventos:[{quando:Date.now(), texto:'Ficha aberta pelo paciente'}]
      });
    }
    Aviso.mostrar(n?'Pacientes de exemplo criados (senha 123456).':'Os exemplos já estavam criados.');
  });
  

  montaEscala();
  Banco.aoMudar(()=>{
    if($('#tela-prof-painel').classList.contains('ativa')) desenhaFila();
    if($('#tela-paciente-painel').classList.contains('ativa')) desenhaPaciente();
  });
  Banco.iniciar();
  setInterval(()=>{ if($('#tela-prof-painel').classList.contains('ativa')) desenhaFila(); }, 60000);
