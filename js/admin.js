const loginBox = document.getElementById('loginBox');
const adminShell = document.getElementById('adminShell');
const whoEmail = document.getElementById('whoEmail');
const toastEl = document.getElementById('toast');

function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=> toastEl.classList.remove('show'), 2800);
}

// ---------- LOGIN ----------
document.getElementById('loginBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){
    errEl.textContent = 'E-mail ou senha incorretos.';
    return;
  }
  onLoggedIn(data.session);
});

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  await supabaseClient.auth.signOut();
  location.reload();
});

async function checkSession(){
  const { data } = await supabaseClient.auth.getSession();
  if(data.session){
    onLoggedIn(data.session);
  }
}

function onLoggedIn(session){
  loginBox.style.display = 'none';
  adminShell.style.display = 'block';
  whoEmail.textContent = session.user.email;
  loadProducts();
}

checkSession();

// ---------- FORM STATE ----------
const form = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const currentImgPreview = document.getElementById('currentImgPreview');
let editingImageUrl = null;

function resetForm(){
  form.reset();
  document.getElementById('productId').value = '';
  document.getElementById('fAtivo').value = 'true';
  formTitle.textContent = 'Adicionar produto';
  cancelEditBtn.style.display = 'none';
  currentImgPreview.innerHTML = '';
  editingImageUrl = null;
  document.getElementById('formError').textContent = '';
}

cancelEditBtn.addEventListener('click', resetForm);

// ---------- SALVAR (criar ou editar) ----------
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const errEl = document.getElementById('formError');
  errEl.textContent = '';
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando…';

  try{
    const id = document.getElementById('productId').value;
    const cores = document.getElementById('fCores').value
      .split(',').map(c=>c.trim()).filter(Boolean);

    let imagem_url = editingImageUrl;
    const fotoFile = document.getElementById('fFoto').files[0];
    if(fotoFile){
      const ext = fotoFile.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error: uploadError } = await supabaseClient
        .storage.from('produtos-fotos')
        .upload(path, fotoFile, { upsert: false });
      if(uploadError) throw uploadError;
      const { data: publicData } = supabaseClient
        .storage.from('produtos-fotos').getPublicUrl(path);
      imagem_url = publicData.publicUrl;
    }

    const payload = {
      nome: document.getElementById('fNome').value.trim(),
      categoria: document.getElementById('fCategoria').value.trim(),
      descricao: document.getElementById('fDescricao').value.trim() || null,
      material: document.getElementById('fMaterial').value.trim() || null,
      tamanho: document.getElementById('fTamanho').value.trim() || null,
      preco_varejo: document.getElementById('fPrecoVarejo').value || null,
      preco_atacado: document.getElementById('fPrecoAtacado').value || null,
      cores: cores.length ? cores : null,
      ativo: document.getElementById('fAtivo').value === 'true',
      imagem_url
    };

    let error;
    if(id){
      ({ error } = await supabaseClient.from('produtos').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('produtos').insert(payload));
    }
    if(error) throw error;

    showToast(id ? 'Produto atualizado!' : 'Produto adicionado!');
    resetForm();
    loadProducts();
  } catch(err){
    console.error(err);
    errEl.textContent = 'Erro ao salvar: ' + (err.message || 'tenta de novo.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar produto';
  }
});

// ---------- LISTAR ----------
async function loadProducts(){
  const tbody = document.getElementById('productsTableBody');
  const { data, error } = await supabaseClient
    .from('produtos').select('*')
    .order('categoria', { ascending: true })
    .order('nome', { ascending: true });

  if(error){
    tbody.innerHTML = `<tr><td colspan="7">Erro ao carregar produtos.</td></tr>`;
    return;
  }
  if(!data.length){
    tbody.innerHTML = `<tr><td colspan="7">Nenhum produto cadastrado ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td>${p.imagem_url ? `<img src="${p.imagem_url}" alt="">` : '—'}</td>
      <td>${escapeHtmlAdmin(p.nome)}</td>
      <td>${escapeHtmlAdmin(p.categoria)}</td>
      <td>${p.preco_varejo != null ? 'R$ '+Number(p.preco_varejo).toFixed(2) : '—'}</td>
      <td>${p.preco_atacado != null ? 'R$ '+Number(p.preco_atacado).toFixed(2) : '—'}</td>
      <td><span class="status-pill ${p.ativo ? 'on':'off'}">${p.ativo ? 'Ativo':'Inativo'}</span></td>
      <td class="row-actions">
        <button class="btn secondary" data-edit="${p.id}">Editar</button>
        <button class="btn danger" data-delete="${p.id}">Apagar</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=> editProduct(btn.dataset.edit, data));
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteProduct(btn.dataset.delete));
  });
}

function editProduct(id, data){
  const p = data.find(x => x.id === id);
  if(!p) return;
  document.getElementById('productId').value = p.id;
  document.getElementById('fNome').value = p.nome || '';
  document.getElementById('fCategoria').value = p.categoria || '';
  document.getElementById('fDescricao').value = p.descricao || '';
  document.getElementById('fMaterial').value = p.material || '';
  document.getElementById('fTamanho').value = p.tamanho || '';
  document.getElementById('fPrecoVarejo').value = p.preco_varejo || '';
  document.getElementById('fPrecoAtacado').value = p.preco_atacado || '';
  document.getElementById('fCores').value = (p.cores || []).join(', ');
  document.getElementById('fAtivo').value = p.ativo ? 'true' : 'false';
  editingImageUrl = p.imagem_url || null;
  currentImgPreview.innerHTML = p.imagem_url
    ? `<img src="${p.imagem_url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">`
    : '';
  formTitle.textContent = 'Editar produto';
  cancelEditBtn.style.display = 'inline-block';
  window.scrollTo({top:0, behavior:'smooth'});
}

async function deleteProduct(id){
  if(!confirm('Tem certeza que quer apagar este produto? Essa ação não pode ser desfeita.')) return;
  const { error } = await supabaseClient.from('produtos').delete().eq('id', id);
  if(error){
    alert('Erro ao apagar: ' + error.message);
    return;
  }
  showToast('Produto apagado.');
  loadProducts();
}

function escapeHtmlAdmin(str){
  if(!str) return '';
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
