function escapeHtml(str){
  if(!str) return '';
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatPrice(v){
  if(v === null || v === undefined) return '—';
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

function productCardHtml(p){
  const cores = Array.isArray(p.cores) ? p.cores : [];
  const swatches = cores.map(c => `<span class="swatch" style="background:${escapeHtml(c)}"></span>`).join('');
  const imgHtml = p.imagem_url
    ? `<img class="card-img" src="${escapeHtml(p.imagem_url)}" alt="${escapeHtml(p.nome)}">`
    : `<div class="card-img placeholder"><div class="placeholder-icon"></div>Foto em breve</div>`;

  const specsParts = [];
  if(p.tamanho) specsParts.push(escapeHtml(p.tamanho));
  if(p.material) specsParts.push('Material: ' + escapeHtml(p.material));
  const specsLine = specsParts.join(' · ');

  return `
    <article class="card">
      ${imgHtml}
      <div class="card-body">
        <h3>${escapeHtml(p.nome)}</h3>
        ${p.descricao ? `<p class="card-desc">${escapeHtml(p.descricao)}</p>` : ''}
        ${specsLine ? `<p class="card-specs">${specsLine}</p>` : ''}
        ${cores.length ? `<div class="card-colors"><span class="label">Cores:</span>${swatches}</div>` : ''}
        <div class="price-row">
          <div class="price-block"><div class="lbl">Varejo</div><div class="val">${formatPrice(p.preco_varejo)}</div></div>
          <div class="price-block wholesale"><div class="lbl">Atacado</div><div class="val">${formatPrice(p.preco_atacado)}</div></div>
        </div>
        <button class="cta-btn" data-product="${escapeHtml(p.nome)}">Pedir pelo WhatsApp</button>
      </div>
    </article>
  `;
}

function attachCtaHandlers(){
  document.querySelectorAll('.cta-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const product = btn.getAttribute('data-product');
      const msg = encodeURIComponent(`Olá! Vim pelo catálogo e tenho interesse no produto: ${product}`);
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
    });
  });
}

function renderCatalog(produtos){
  const main = document.getElementById('mainContent');
  const navCategories = document.getElementById('navCategories');
  const tabsWrap = document.getElementById('tabsWrap');

  if(!produtos.length){
    main.innerHTML = `<div class="empty-state">Nenhum produto disponível no momento. Volte em breve!</div>`;
    return;
  }

  // agrupa por categoria, preservando a ordem de primeira aparição
  const categorias = [];
  const porCategoria = {};
  produtos.forEach(p=>{
    const cat = p.categoria || 'Outros';
    if(!porCategoria[cat]){ porCategoria[cat] = []; categorias.push(cat); }
    porCategoria[cat].push(p);
  });

  // nav do cabeçalho
  navCategories.innerHTML = categorias.map(cat =>
    `<li><a href="#${slugify(cat)}">${escapeHtml(cat)}</a></li>`
  ).join('');

  // abas de filtro
  categorias.forEach(cat=>{
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.target = slugify(cat);
    btn.textContent = cat;
    tabsWrap.appendChild(btn);
  });

  // seções
  main.innerHTML = categorias.map(cat => `
    <section class="cat-section" id="${slugify(cat)}" data-cat="${slugify(cat)}">
      <div class="cat-heading">
        <h2>${escapeHtml(cat)}</h2>
        <span class="count">${porCategoria[cat].length} produto${porCategoria[cat].length>1?'s':''}</span>
      </div>
      <div class="grid">
        ${porCategoria[cat].map(productCardHtml).join('')}
      </div>
    </section>
  `).join('');

  attachCtaHandlers();

  // filtro por aba
  const tabs = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.cat-section');
  tabs.forEach(tab=>{
    tab.addEventListener('click', ()=>{
      tabs.forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-target');
      if(target === 'all'){
        sections.forEach(s=>s.style.display='block');
      } else {
        sections.forEach(s=>{
          s.style.display = (s.getAttribute('data-cat') === target) ? 'block' : 'none';
        });
        document.getElementById(target).scrollIntoView({behavior:'smooth', block:'start'});
      }
    });
  });
}

function slugify(str){
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function loadCatalog(){
  const main = document.getElementById('mainContent');
  const { data, error } = await supabaseClient
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .order('categoria', { ascending: true })
    .order('nome', { ascending: true });

  if(error){
    console.error(error);
    main.innerHTML = `<div class="empty-state">Não foi possível carregar o catálogo agora. Tenta de novo em instantes.</div>`;
    return;
  }
  renderCatalog(data || []);
}

loadCatalog();
