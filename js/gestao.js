const loginBox = document.getElementById('loginBox');
const adminShell = document.getElementById('adminShell');
const whoEmail = document.getElementById('whoEmail');
const toastEl = document.getElementById('toast');

function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=> toastEl.classList.remove('show'), 2800);
}
function esc(str){
  if(!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function brl(v){ return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ','); }

// ---------- LOGIN (mesmo padrão do admin.html) ----------
document.getElementById('loginBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){ errEl.textContent = 'E-mail ou senha incorretos.'; return; }
  onLoggedIn(data.session);
});
document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  await supabaseClient.auth.signOut();
  location.reload();
});
async function checkSession(){
  const { data } = await supabaseClient.auth.getSession();
  if(data.session) onLoggedIn(data.session);
}
function onLoggedIn(session){
  loginBox.style.display = 'none';
  adminShell.style.display = 'block';
  whoEmail.textContent = session.user.email;
  init();
}
checkSession();

// ---------- TABS ----------
document.querySelectorAll('.gestao-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.gestao-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.gestao-panel').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.panel).classList.add('active');
  });
});

// ---------- estado global carregado do banco ----------
let FILAMENTOS = [];
let INSUMOS = [];
let CUSTO_ENERGIA_HORA = 0;

async function init(){
  await loadConfiguracoes();
  await loadFilamentos();
  await loadInsumos();
  await loadPecas();
  addFilRow();
  addInsRow();
  recalcCosts();
}

async function loadConfiguracoes(){
  const { data } = await supabaseClient.from('configuracoes').select('custo_energia_hora').limit(1).single();
  CUSTO_ENERGIA_HORA = data ? Number(data.custo_energia_hora) : 0;
}

/* =========================================================
   FILAMENTOS
   ========================================================= */
async function loadFilamentos(){
  const { data, error } = await supabaseClient.from('filamentos').select('*').order('marca').order('cor');
  FILAMENTOS = data || [];
  renderFilamentosTable();
  renderFilSelects();
}

function renderFilamentosTable(){
  const tbody = document.getElementById('filamentosTableBody');
  if(!FILAMENTOS.length){ tbody.innerHTML = '<tr><td colspan="5">Nenhum filamento cadastrado.</td></tr>'; return; }
  tbody.innerHTML = FILAMENTOS.map(f => `
    <tr>
      <td>${esc(f.marca)}</td>
      <td>${esc(f.cor)}</td>
      <td>${esc(f.tipo||'—')}</td>
      <td>${brl((f.preco_rolo / f.peso_rolo_g) * 1000)}</td>
      <td class="row-actions">
        <button class="btn secondary" data-edit-fil="${f.id}">Editar</button>
        <button class="btn danger" data-del-fil="${f.id}">Apagar</button>
      </td>
    </tr>
  `).join('');
  tbody.querySelectorAll('[data-edit-fil]').forEach(b=>b.addEventListener('click', ()=>editFilamento(b.dataset.editFil)));
  tbody.querySelectorAll('[data-del-fil]').forEach(b=>b.addEventListener('click', ()=>deleteFilamento(b.dataset.delFil)));
}

document.getElementById('filForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const errEl = document.getElementById('filFormError'); errEl.textContent='';
  const id = document.getElementById('filId').value;
  const payload = {
    marca: document.getElementById('filMarca').value.trim(),
    cor: document.getElementById('filCor').value.trim(),
    cor_hex: document.getElementById('filCorHex').value.trim() || null,
    tipo: document.getElementById('filTipo').value.trim() || null,
    peso_rolo_g: Number(document.getElementById('filPeso').value),
    preco_rolo: Number(document.getElementById('filPreco').value),
  };
  let error;
  if(id){ ({error} = await supabaseClient.from('filamentos').update(payload).eq('id', id)); }
  else { ({error} = await supabaseClient.from('filamentos').insert(payload)); }
  if(error){ errEl.textContent = 'Erro: ' + error.message; return; }
  showToast('Filamento salvo!');
  resetFilForm();
  await loadFilamentos();
});

function editFilamento(id){
  const f = FILAMENTOS.find(x=>x.id===id); if(!f) return;
  document.getElementById('filId').value = f.id;
  document.getElementById('filMarca').value = f.marca;
  document.getElementById('filCor').value = f.cor;
  document.getElementById('filCorHex').value = f.cor_hex || '';
  document.getElementById('filTipo').value = f.tipo || '';
  document.getElementById('filPeso').value = f.peso_rolo_g;
  document.getElementById('filPreco').value = f.preco_rolo;
  document.getElementById('filFormTitle').textContent = 'Editar filamento';
  document.getElementById('filCancelBtn').style.display = 'inline-block';
  window.scrollTo({top:0, behavior:'smooth'});
}
function resetFilForm(){
  document.getElementById('filForm').reset();
  document.getElementById('filId').value = '';
  document.getElementById('filPeso').value = 1000;
  document.getElementById('filFormTitle').textContent = 'Novo filamento';
  document.getElementById('filCancelBtn').style.display = 'none';
}
document.getElementById('filCancelBtn').addEventListener('click', resetFilForm);

async function deleteFilamento(id){
  if(!confirm('Apagar este filamento? Peças que já usam ele podem ficar com cálculo incompleto.')) return;
  const { error } = await supabaseClient.from('filamentos').delete().eq('id', id);
  if(error){ alert('Erro ao apagar: ' + error.message); return; }
  showToast('Filamento apagado.');
  await loadFilamentos();
}

/* =========================================================
   INSUMOS / SERVIÇOS
   ========================================================= */
let insumoTipoAtual = 'acessorio';
document.getElementById('btnTipoAcessorio').addEventListener('click', ()=>setInsumoTipo('acessorio'));
document.getElementById('btnTipoServico').addEventListener('click', ()=>setInsumoTipo('servico'));

function setInsumoTipo(tipo){
  insumoTipoAtual = tipo;
  document.getElementById('btnTipoAcessorio').classList.toggle('active', tipo==='acessorio');
  document.getElementById('btnTipoServico').classList.toggle('active', tipo==='servico');
  document.getElementById('loteFields').style.display = tipo === 'acessorio' ? 'grid' : 'none';
  document.getElementById('custoUnitLabel').textContent = tipo === 'acessorio'
    ? 'Custo por unidade (R$) — calculado do lote, editável'
    : 'Custo por uso (R$)';
}

// recalcula custo unitário automaticamente ao digitar lote
['insQtdLote','insPrecoLote'].forEach(id=>{
  document.getElementById(id).addEventListener('input', ()=>{
    const qtd = Number(document.getElementById('insQtdLote').value);
    const preco = Number(document.getElementById('insPrecoLote').value);
    if(qtd > 0 && preco >= 0){
      document.getElementById('insCustoUnitario').value = (preco / qtd).toFixed(4);
    }
  });
});

async function loadInsumos(){
  const { data } = await supabaseClient.from('insumos').select('*').order('nome');
  INSUMOS = data || [];
  renderInsumosTable();
  renderInsSelects();
}

function renderInsumosTable(){
  const tbody = document.getElementById('insumosTableBody');
  if(!INSUMOS.length){ tbody.innerHTML = '<tr><td colspan="4">Nenhum insumo cadastrado.</td></tr>'; return; }
  tbody.innerHTML = INSUMOS.map(i => `
    <tr>
      <td>${esc(i.nome)}</td>
      <td>${i.tipo === 'acessorio' ? 'Acessório' : 'Serviço'}</td>
      <td>${brl(i.custo_unitario)}</td>
      <td class="row-actions">
        <button class="btn secondary" data-edit-ins="${i.id}">Editar</button>
        <button class="btn danger" data-del-ins="${i.id}">Apagar</button>
      </td>
    </tr>
  `).join('');
  tbody.querySelectorAll('[data-edit-ins]').forEach(b=>b.addEventListener('click', ()=>editInsumo(b.dataset.editIns)));
  tbody.querySelectorAll('[data-del-ins]').forEach(b=>b.addEventListener('click', ()=>deleteInsumo(b.dataset.delIns)));
}

document.getElementById('insForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const errEl = document.getElementById('insFormError'); errEl.textContent='';
  const id = document.getElementById('insId').value;
  const payload = {
    nome: document.getElementById('insNome').value.trim(),
    tipo: insumoTipoAtual,
    quantidade_lote: insumoTipoAtual === 'acessorio' ? (Number(document.getElementById('insQtdLote').value) || null) : null,
    preco_lote: insumoTipoAtual === 'acessorio' ? (Number(document.getElementById('insPrecoLote').value) || null) : null,
    custo_unitario: Number(document.getElementById('insCustoUnitario').value) || 0,
  };
  let error;
  if(id){ ({error} = await supabaseClient.from('insumos').update(payload).eq('id', id)); }
  else { ({error} = await supabaseClient.from('insumos').insert(payload)); }
  if(error){ errEl.textContent = 'Erro: ' + error.message; return; }
  showToast('Insumo salvo!');
  resetInsForm();
  await loadInsumos();
});

function editInsumo(id){
  const i = INSUMOS.find(x=>x.id===id); if(!i) return;
  document.getElementById('insId').value = i.id;
  document.getElementById('insNome').value = i.nome;
  setInsumoTipo(i.tipo);
  document.getElementById('insQtdLote').value = i.quantidade_lote || '';
  document.getElementById('insPrecoLote').value = i.preco_lote || '';
  document.getElementById('insCustoUnitario').value = i.custo_unitario;
  document.getElementById('insFormTitle').textContent = 'Editar insumo/serviço';
  document.getElementById('insCancelBtn').style.display = 'inline-block';
  window.scrollTo({top:0, behavior:'smooth'});
}
function resetInsForm(){
  document.getElementById('insForm').reset();
  document.getElementById('insId').value = '';
  setInsumoTipo('acessorio');
  document.getElementById('insFormTitle').textContent = 'Novo insumo / serviço';
  document.getElementById('insCancelBtn').style.display = 'none';
}
document.getElementById('insCancelBtn').addEventListener('click', resetInsForm);

async function deleteInsumo(id){
  if(!confirm('Apagar este insumo/serviço?')) return;
  const { error } = await supabaseClient.from('insumos').delete().eq('id', id);
  if(error){ alert('Erro ao apagar: ' + error.message); return; }
  showToast('Insumo apagado.');
  await loadInsumos();
}

/* =========================================================
   PEÇAS — repeaters de filamento/insumo + cálculo em tempo real
   ========================================================= */
function renderFilSelects(){
  document.querySelectorAll('.fil-select').forEach(sel=>{
    const current = sel.value;
    sel.innerHTML = FILAMENTOS.map(f => `<option value="${f.id}">${esc(f.marca)} — ${esc(f.cor)}</option>`).join('');
    if(current) sel.value = current;
  });
}
function renderInsSelects(){
  document.querySelectorAll('.ins-select').forEach(sel=>{
    const current = sel.value;
    sel.innerHTML = INSUMOS.map(i => `<option value="${i.id}">${esc(i.nome)}</option>`).join('');
    if(current) sel.value = current;
  });
}

function addFilRow(filamento_id, peso_g){
  const wrap = document.getElementById('filRepeater');
  const row = document.createElement('div');
  row.className = 'repeater-row';
  row.innerHTML = `
    <select class="fil-select">${FILAMENTOS.map(f => `<option value="${f.id}">${esc(f.marca)} — ${esc(f.cor)}</option>`).join('')}</select>
    <input type="number" step="0.1" class="fil-peso" placeholder="peso (g)">
    <button type="button" class="repeater-remove">×</button>
  `;
  wrap.appendChild(row);
  if(filamento_id) row.querySelector('.fil-select').value = filamento_id;
  if(peso_g != null) row.querySelector('.fil-peso').value = peso_g;
  row.querySelector('.repeater-remove').addEventListener('click', ()=>{ row.remove(); recalcCosts(); });
  row.querySelector('.fil-select').addEventListener('change', recalcCosts);
  row.querySelector('.fil-peso').addEventListener('input', recalcCosts);
}
document.getElementById('addFilRow').addEventListener('click', ()=>addFilRow());

function addInsRow(insumo_id, quantidade){
  const wrap = document.getElementById('insRepeater');
  const row = document.createElement('div');
  row.className = 'repeater-row';
  row.innerHTML = `
    <select class="ins-select">${INSUMOS.map(i => `<option value="${i.id}">${esc(i.nome)}</option>`).join('')}</select>
    <input type="number" step="1" class="ins-qtd" placeholder="qtd" value="1">
    <button type="button" class="repeater-remove">×</button>
  `;
  wrap.appendChild(row);
  if(insumo_id) row.querySelector('.ins-select').value = insumo_id;
  if(quantidade != null) row.querySelector('.ins-qtd').value = quantidade;
  row.querySelector('.repeater-remove').addEventListener('click', ()=>{ row.remove(); recalcCosts(); });
  row.querySelector('.ins-select').addEventListener('change', recalcCosts);
  row.querySelector('.ins-qtd').addEventListener('input', recalcCosts);
}
document.getElementById('addInsRow').addEventListener('click', ()=>addInsRow());

document.getElementById('pTempo').addEventListener('input', recalcCosts);

// markup <-> margem em duas vias
let updatingPricing = false;
document.getElementById('pMarkup').addEventListener('input', ()=>{
  if(updatingPricing) return;
  updatingPricing = true;
  const custoTotal = getCustoTotal();
  const markup = Number(document.getElementById('pMarkup').value) || 0;
  const preco = custoTotal * markup;
  const margem = preco > 0 ? ((preco - custoTotal) / preco) * 100 : 0;
  document.getElementById('pMargem').value = margem.toFixed(1);
  updatePriceDisplay(custoTotal, preco);
  updatingPricing = false;
});
document.getElementById('pMargem').addEventListener('input', ()=>{
  if(updatingPricing) return;
  updatingPricing = true;
  const custoTotal = getCustoTotal();
  const margem = Number(document.getElementById('pMargem').value) || 0;
  const preco = margem < 100 ? custoTotal / (1 - margem/100) : 0;
  const markup = custoTotal > 0 ? preco / custoTotal : 0;
  document.getElementById('pMarkup').value = markup.toFixed(2);
  updatePriceDisplay(custoTotal, preco);
  updatingPricing = false;
});

function getCustoTotal(){
  return Number(document.getElementById('cfTotal').dataset.raw || 0);
}

function recalcCosts(){
  // custo filamento
  let custoFilamento = 0;
  document.querySelectorAll('#filRepeater .repeater-row').forEach(row=>{
    const filId = row.querySelector('.fil-select').value;
    const peso = Number(row.querySelector('.fil-peso').value) || 0;
    const fil = FILAMENTOS.find(f=>f.id===filId);
    if(fil) custoFilamento += (fil.preco_rolo / fil.peso_rolo_g) * peso;
  });

  // custo energia
  const horas = Number(document.getElementById('pTempo').value) || 0;
  const custoEnergia = horas * CUSTO_ENERGIA_HORA;

  // custo insumos
  let custoInsumos = 0;
  document.querySelectorAll('#insRepeater .repeater-row').forEach(row=>{
    const insId = row.querySelector('.ins-select').value;
    const qtd = Number(row.querySelector('.ins-qtd').value) || 0;
    const ins = INSUMOS.find(i=>i.id===insId);
    if(ins) custoInsumos += Number(ins.custo_unitario) * qtd;
  });

  const custoTotal = custoFilamento + custoEnergia + custoInsumos;

  document.getElementById('cfFilamento').textContent = brl(custoFilamento);
  document.getElementById('cfEnergia').textContent = brl(custoEnergia);
  document.getElementById('cfInsumos').textContent = brl(custoInsumos);
  document.getElementById('cfTotal').textContent = brl(custoTotal);
  document.getElementById('cfTotal').dataset.raw = custoTotal;

  const markup = Number(document.getElementById('pMarkup').value) || 0;
  const preco = custoTotal * markup;
  updatePriceDisplay(custoTotal, preco);
}

function updatePriceDisplay(custoTotal, preco){
  document.getElementById('cfPreco').textContent = brl(preco);
  document.getElementById('cfLucro').textContent = brl(preco - custoTotal);
}

async function loadPecas(){
  const { data } = await supabaseClient.from('pecas').select('*').order('nome');
  renderPecasTable(data || []);
}

function renderPecasTable(pecas){
  const tbody = document.getElementById('pecasTableBody');
  if(!pecas.length){ tbody.innerHTML = '<tr><td colspan="5">Nenhuma peça cadastrada.</td></tr>'; return; }
  tbody.innerHTML = pecas.map(p => `
    <tr>
      <td>${esc(p.nome)}</td>
      <td>${brl(p.custo_total)}</td>
      <td>${brl(p.preco_venda)}</td>
      <td>${p.margem_percentual != null ? Number(p.margem_percentual).toFixed(1)+'%' : '—'}</td>
      <td class="row-actions">
        <button class="btn secondary" data-edit-peca="${p.id}">Editar</button>
        <button class="btn danger" data-del-peca="${p.id}">Apagar</button>
      </td>
    </tr>
  `).join('');
  tbody.querySelectorAll('[data-edit-peca]').forEach(b=>b.addEventListener('click', ()=>editPeca(b.dataset.editPeca)));
  tbody.querySelectorAll('[data-del-peca]').forEach(b=>b.addEventListener('click', ()=>deletePeca(b.dataset.delPeca)));
}

async function editPeca(id){
  const { data: p } = await supabaseClient.from('pecas').select('*').eq('id', id).single();
  if(!p) return;
  const { data: fils } = await supabaseClient.from('peca_filamentos').select('*').eq('peca_id', id);
  const { data: inss } = await supabaseClient.from('peca_insumos').select('*').eq('peca_id', id);

  document.getElementById('pecaId').value = p.id;
  document.getElementById('pNome').value = p.nome;
  document.getElementById('pTempo').value = p.tempo_impressao_horas;
  document.getElementById('pMarkup').value = p.markup;
  document.getElementById('pMargem').value = p.margem_percentual || '';

  document.getElementById('filRepeater').innerHTML = '';
  (fils && fils.length ? fils : [null]).forEach(f => f ? addFilRow(f.filamento_id, f.peso_g) : addFilRow());

  document.getElementById('insRepeater').innerHTML = '';
  (inss && inss.length ? inss : [null]).forEach(i => i ? addInsRow(i.insumo_id, i.quantidade) : addInsRow());

  document.getElementById('pecaFormTitle').textContent = 'Editar peça';
  document.getElementById('pecaCancelBtn').style.display = 'inline-block';
  recalcCosts();
  window.scrollTo({top:0, behavior:'smooth'});
}

function resetPecaForm(){
  document.getElementById('pecaForm').reset();
  document.getElementById('pecaId').value = '';
  document.getElementById('pMarkup').value = 1.5;
  document.getElementById('filRepeater').innerHTML = '';
  document.getElementById('insRepeater').innerHTML = '';
  addFilRow();
  addInsRow();
  document.getElementById('pecaFormTitle').textContent = 'Nova peça';
  document.getElementById('pecaCancelBtn').style.display = 'none';
  recalcCosts();
}
document.getElementById('pecaCancelBtn').addEventListener('click', resetPecaForm);

document.getElementById('pecaForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const errEl = document.getElementById('pecaFormError'); errEl.textContent = '';
  const saveBtn = document.getElementById('pecaSaveBtn');
  saveBtn.disabled = true; saveBtn.textContent = 'Salvando…';

  try{
    const id = document.getElementById('pecaId').value;

    const filRows = [...document.querySelectorAll('#filRepeater .repeater-row')]
      .map(row => ({ filamento_id: row.querySelector('.fil-select').value, peso_g: Number(row.querySelector('.fil-peso').value) || 0 }))
      .filter(r => r.filamento_id && r.peso_g > 0);

    const insRows = [...document.querySelectorAll('#insRepeater .repeater-row')]
      .map(row => ({ insumo_id: row.querySelector('.ins-select').value, quantidade: Number(row.querySelector('.ins-qtd').value) || 0 }))
      .filter(r => r.insumo_id && r.quantidade > 0);

    const custoTotal = getCustoTotal();
    const markup = Number(document.getElementById('pMarkup').value) || 0;
    const precoVenda = custoTotal * markup;
    const margem = precoVenda > 0 ? ((precoVenda - custoTotal) / precoVenda) * 100 : 0;

    let custoFilamento = 0;
    filRows.forEach(r=>{
      const fil = FILAMENTOS.find(f=>f.id===r.filamento_id);
      if(fil) custoFilamento += (fil.preco_rolo / fil.peso_rolo_g) * r.peso_g;
    });
    const custoEnergia = (Number(document.getElementById('pTempo').value)||0) * CUSTO_ENERGIA_HORA;
    let custoInsumos = 0;
    insRows.forEach(r=>{
      const ins = INSUMOS.find(i=>i.id===r.insumo_id);
      if(ins) custoInsumos += Number(ins.custo_unitario) * r.quantidade;
    });

    const payload = {
      nome: document.getElementById('pNome').value.trim(),
      tempo_impressao_horas: Number(document.getElementById('pTempo').value) || 0,
      markup,
      custo_filamento: custoFilamento,
      custo_energia: custoEnergia,
      custo_insumos: custoInsumos,
      custo_total: custoTotal,
      preco_venda: precoVenda,
      margem_percentual: margem,
      atualizado_em: new Date().toISOString(),
    };

    let pecaId = id;
    let error;
    if(id){
      ({error} = await supabaseClient.from('pecas').update(payload).eq('id', id));
    } else {
      const { data, error: insErr } = await supabaseClient.from('pecas').insert(payload).select('id').single();
      error = insErr;
      if(data) pecaId = data.id;
    }
    if(error) throw error;

    // substitui as relações (mais simples: apaga e recria)
    await supabaseClient.from('peca_filamentos').delete().eq('peca_id', pecaId);
    if(filRows.length){
      await supabaseClient.from('peca_filamentos').insert(filRows.map(r => ({ ...r, peca_id: pecaId })));
    }
    await supabaseClient.from('peca_insumos').delete().eq('peca_id', pecaId);
    if(insRows.length){
      await supabaseClient.from('peca_insumos').insert(insRows.map(r => ({ ...r, peca_id: pecaId })));
    }

    showToast(id ? 'Peça atualizada!' : 'Peça criada!');
    resetPecaForm();
    await loadPecas();
  } catch(err){
    console.error(err);
    errEl.textContent = 'Erro ao salvar: ' + (err.message || 'tenta de novo.');
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = 'Salvar peça';
  }
});

async function deletePeca(id){
  if(!confirm('Apagar esta peça? Essa ação não pode ser desfeita.')) return;
  const { error } = await supabaseClient.from('pecas').delete().eq('id', id);
  if(error){ alert('Erro ao apagar: ' + error.message); return; }
  showToast('Peça apagada.');
  await loadPecas();
}
