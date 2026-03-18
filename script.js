/* ============================================================
   FireMap — script.js (versão corrigida)
   ============================================================ */

/* ── ESTADO ── */
let dados = {
  1: { tipo: "Pó Químico ABC", validade: "2026-05-10", setor: "Galpão A" },
  2: { tipo: "CO₂",            validade: "2026-03-25", setor: "Galpão A" }
};
let posicoes = {
  1: { top: "100px", left: "200px" },
  2: { top: "250px", left: "400px" }
};
let proximoId  = 3;
let modoEdicao = false;
let idAtivo    = null;
let viewAtual  = "mapa";
let pz         = null;

// Flag para distinguir clique de arrasto
let dragging = false;

/* ── PERSISTÊNCIA ── */
function salvarStorage() {
  localStorage.setItem("fm_dados",    JSON.stringify(dados));
  localStorage.setItem("fm_posicoes", JSON.stringify(posicoes));
  localStorage.setItem("fm_nextId",   String(proximoId));
}
function carregarStorage() {
  try {
    const d = localStorage.getItem("fm_dados");
    const p = localStorage.getItem("fm_posicoes");
    const n = localStorage.getItem("fm_nextId");
    if (d) dados     = JSON.parse(d);
    if (p) posicoes  = JSON.parse(p);
    if (n) proximoId = parseInt(n, 10);
  } catch(e) {}
}

/* ── STATUS ── */
function calcularStatus(val) {
  if (!val) return "vermelho";
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diff = Math.ceil((new Date(val + "T00:00:00") - hoje) / 86400000);
  if (diff < 0)   return "vermelho";
  if (diff <= 30) return "amarelo";
  return "verde";
}
function diasRestantes(val) {
  if (!val) return -999;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.ceil((new Date(val + "T00:00:00") - hoje) / 86400000);
}
function diasLabel(val) {
  const d = diasRestantes(val);
  if (d === -999) return "Sem validade";
  if (d < 0)     return `${Math.abs(d)} dias vencido`;
  if (d === 0)   return "Vence hoje!";
  return `${d} dias restantes`;
}
function statusLabel(s) {
  return { verde: "Em dia", amarelo: "Vencendo em breve", vermelho: "Vencido" }[s];
}
function statusIcon(s) {
  return { verde: "✓", amarelo: "⚠", vermelho: "✕" }[s];
}

/* ── STATS ── */
function atualizarStats() {
  const ids = Object.keys(dados);
  let ok = 0, warn = 0, exp = 0;
  ids.forEach(id => {
    const s = calcularStatus(dados[id].validade);
    if (s === "verde") ok++;
    else if (s === "amarelo") warn++;
    else exp++;
  });
  document.getElementById("statTotal").textContent = ids.length;
  document.getElementById("statOk").textContent    = ok;
  document.getElementById("statWarn").textContent  = warn;
  document.getElementById("statExp").textContent   = exp;
}

/* ── VIEWS ── */
function setView(v) {
  viewAtual = v;
  document.getElementById("viewMapa").classList.toggle("hidden",  v !== "mapa");
  document.getElementById("viewLista").classList.toggle("hidden", v !== "lista");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  // Se a função foi chamada por um evento, destaca o botão clicado
  if (event?.currentTarget) event.currentTarget.classList.add("active");
  document.getElementById("viewTitle").textContent =
    v === "mapa" ? "Mapa de Extintores" : "Lista de Extintores";
  document.getElementById("viewSub").textContent =
    v === "mapa" ? "Galpão A · clique num extintor para detalhes"
                 : `${Object.keys(dados).length} extintores cadastrados`;
  if (v === "lista") renderizarLista();
}

/* ── RENDERIZAR PONTOS ── */
function renderizarPontos() {
  document.querySelectorAll(".ponto").forEach(p => p.remove());
  Object.keys(dados).forEach(id => renderPonto(id));
  atualizarStats();
}

function renderPonto(id) {
  const ext    = dados[id];
  const pos    = posicoes[id];
  if (!pos) return;
  const status = calcularStatus(ext.validade);
  const dias   = diasRestantes(ext.validade);

  const div = document.createElement("div");
  div.id        = "p" + id;
  div.className = `ponto ${status}${idAtivo == id ? " selecionado" : ""}`;
  div.style.top  = pos.top;
  div.style.left = pos.left;

  // Tooltip
  const tt = document.createElement("div");
  tt.className   = "ttip";
  tt.textContent = `#${id} — ${ext.tipo} · ${dias < 0 ? "VENCIDO" : dias === 0 ? "Hoje!" : dias + "d"}`;
  div.appendChild(tt);

  // Eventos de mouse e touch para drag (modo edição)
  div.addEventListener("mousedown", onDragStart);
  div.addEventListener("touchstart", onDragStart, { passive: false });

  // Clique normal → abre painel (somente se não houve arrasto)
  div.addEventListener("click", e => {
    if (modoEdicao) return;
    if (dragging) {
      dragging = false; // impede que um clique após arrasto abra o painel
      return;
    }
    e.stopPropagation();
    abrirPainel(id);
  });

  document.getElementById("mapa").appendChild(div);
}

/* ── DRAG (suporte mouse e touch) ── */
function onDragStart(e) {
  if (!modoEdicao) return;
  e.preventDefault();   // importante para touch
  e.stopPropagation();

  dragging = false;     // ainda não moveu

  const ponto = e.currentTarget;
  const id = ponto.id.substring(1); // remove 'p'

  // Coordenadas do toque ou mouse
  const clientX = e.clientX ?? e.touches[0].clientX;
  const clientY = e.clientY ?? e.touches[0].clientY;

  const mapaEl = document.getElementById("mapa");
  const escala = pz ? pz.getTransform().scale : 1;
  const rect   = mapaEl.getBoundingClientRect();

  // Offset dentro do ponto
  const ox = (clientX - rect.left) / escala - parseFloat(ponto.style.left);
  const oy = (clientY - rect.top)  / escala - parseFloat(ponto.style.top);

  document.body.style.userSelect = "none";

  function onMove(ev) {
    dragging = true; // moveu, não será clique
    ev.preventDefault();
    const mvX = ev.clientX ?? ev.touches[0].clientX;
    const mvY = ev.clientY ?? ev.touches[0].clientY;
    const r2 = mapaEl.getBoundingClientRect();
    ponto.style.left = ((mvX - r2.left) / escala - ox) + "px";
    ponto.style.top  = ((mvY - r2.top)  / escala - oy) + "px";
  }

  function onUp() {
    // Salva nova posição
    posicoes[id] = { top: ponto.style.top, left: ponto.style.left };
    salvarStorage();
    toast("Posição salva", "ok");
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup",   onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend",  onUp);
    // Pequeno atraso para evitar clique após arrasto
    setTimeout(() => { dragging = false; }, 100);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup",   onUp);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend",  onUp);
}

/* ── OVERLAY DE EDIÇÃO ── */
function criarOverlay() {
  let overlay = document.getElementById("editOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "editOverlay";
  overlay.style.cssText = `
    position: absolute; top:0; left:0; width:100%; height:100%;
    z-index: 5; cursor: crosshair; display: none;
    background: transparent; /* para teste: rgba(0,255,0,0.1) */
  `;

  let startX, startY;

  overlay.addEventListener("mousedown", startOverlayDrag);
  overlay.addEventListener("touchstart", startOverlayDrag, { passive: false });

  function startOverlayDrag(e) {
    e.preventDefault(); // importante para touch
    startX = e.clientX ?? e.touches[0].clientX;
    startY = e.clientY ?? e.touches[0].clientY;
  }

  overlay.addEventListener("mouseup", endOverlayDrag);
  overlay.addEventListener("touchend", endOverlayDrag);

  function endOverlayDrag(e) {
    if (startX === undefined) return;
    const endX = e.clientX ?? e.changedTouches[0].clientX;
    const endY = e.clientY ?? e.changedTouches[0].clientY;
    const dist = Math.hypot(endX - startX, endY - startY);
    if (dist > 10) { // limite de 10px para considerar clique (evita arrasto)
      startX = undefined;
      return;
    }

    const escala = pz ? pz.getTransform().scale : 1;
    const mapa   = document.getElementById("mapa");
    const rect   = mapa.getBoundingClientRect();
    const x      = Math.round((startX - rect.left) / escala);
    const y      = Math.round((startY - rect.top)  / escala);
    startX = undefined;
    adicionarExtintor(x, y);
  }

  document.getElementById("mapaContainer").appendChild(overlay);
  return overlay;
}

function adicionarExtintor(x, y) {
  const id = proximoId++;
  dados[id]    = { tipo: "Pó Químico ABC", validade: "", setor: "Galpão A" };
  posicoes[id] = { top: y + "px", left: x + "px" };
  salvarStorage();
  renderPonto(id);
  atualizarStats();
  abrirPainel(id);
  toast(`Extintor #${id} adicionado — preencha os dados →`, "ok");
}

/* ── PAINEL ── */
function abrirPainel(id) {
  idAtivo = id;
  document.querySelectorAll(".ponto").forEach(p => p.classList.remove("selecionado"));
  const pEl = document.getElementById("p" + id);
  if (pEl) pEl.classList.add("selecionado");

  const ext    = dados[id];
  const status = calcularStatus(ext.validade);

  document.getElementById("dpId").textContent  = `EXTINTOR #${id}`;
  document.getElementById("dpNome").textContent = ext.tipo;

  const bar = document.getElementById("dpStatusBar");
  bar.className = `dp-status-bar s-${status}`;
  document.getElementById("dpStatusIcon").textContent = statusIcon(status);
  document.getElementById("dpStatusText").textContent = statusLabel(status);
  document.getElementById("dpDias").textContent       = ext.validade ? diasLabel(ext.validade) : "—";

  document.getElementById("editSetor").value    = ext.setor    || "";
  document.getElementById("editTipo").value     = ext.tipo     || "Pó Químico ABC";
  document.getElementById("editValidade").value = ext.validade || "";

  document.getElementById("detailPanel").classList.remove("hidden");
}

function fecharPainel() {
  idAtivo = null;
  document.getElementById("detailPanel").classList.add("hidden");
  document.querySelectorAll(".ponto").forEach(p => p.classList.remove("selecionado"));
}

function salvarEdicao() {
  if (!idAtivo) return;
  const val = document.getElementById("editValidade").value;
  if (!val) { toast("Informe a validade!", "err"); return; }
  dados[idAtivo].tipo     = document.getElementById("editTipo").value;
  dados[idAtivo].validade = val;
  dados[idAtivo].setor    = document.getElementById("editSetor").value.trim() || dados[idAtivo].setor;
  salvarStorage();
  renderizarPontos();
  abrirPainel(idAtivo);
  if (viewAtual === "lista") renderizarLista();
  toast("Extintor atualizado!", "ok");
}

function trocarValidade() {
  if (!idAtivo) return;
  const nova = new Date();
  nova.setFullYear(nova.getFullYear() + 1);
  dados[idAtivo].validade = nova.toISOString().split("T")[0];
  salvarStorage();
  renderizarPontos();
  abrirPainel(idAtivo);
  if (viewAtual === "lista") renderizarLista();
  toast("Recarga registrada! Válido por mais 1 ano.", "ok");
}

function removerExtintor() {
  if (!idAtivo) return;
  if (!confirm(`Remover o Extintor #${idAtivo}?`)) return;
  const id = idAtivo;
  fecharPainel();
  delete dados[id];
  delete posicoes[id];
  salvarStorage();
  renderizarPontos();
  if (viewAtual === "lista") renderizarLista();
  toast(`Extintor #${id} removido`, "warn");
}

/* ── LISTA ── */
function renderizarLista(filtro = "") {
  const c   = document.getElementById("listaContainer");
  const ids = Object.keys(dados).filter(id => {
    if (!filtro) return true;
    const ext = dados[id]; const f = filtro.toLowerCase();
    return String(id).includes(f) || ext.tipo.toLowerCase().includes(f) || ext.setor.toLowerCase().includes(f);
  });
  if (ids.length === 0) {
    c.innerHTML = `<div style="color:var(--text3);font-size:14px;padding:20px">Nenhum extintor encontrado.</div>`;
    return;
  }
  c.innerHTML = ids.sort((a,b)=>+a-+b).map(id => {
    const ext = dados[id]; const status = calcularStatus(ext.validade);
    const dias = ext.validade ? diasRestantes(ext.validade) : null;
    const diasTx = dias === null ? "—" : dias < 0 ? `${Math.abs(dias)}d vencido` : dias === 0 ? "Hoje!" : `${dias}d`;
    return `<div class="lista-card ${status}" onclick="abrirPainelLista(${id})">
      <div class="lc-header"><span class="lc-id">#${id}</span><span class="lc-badge ${status}">${statusLabel(status)}</span></div>
      <div class="lc-tipo">${ext.tipo}</div><div class="lc-setor">${ext.setor}</div>
      <div class="lc-divider"></div>
      <div><span class="lc-validade">Val. ${ext.validade || "—"}</span><span class="lc-dias ${status}">${diasTx}</span></div>
    </div>`;
  }).join("");
}

function abrirPainelLista(id) {
  setView("mapa");
  document.querySelectorAll(".nav-item")[0].classList.add("active");
  document.querySelectorAll(".nav-item")[1].classList.remove("active");
  setTimeout(() => abrirPainel(id), 50);
}

function filtrarLista(v) {
  if (viewAtual === "lista") renderizarLista(v);
}

/* ── MODO EDIÇÃO ── */
function toggleEdicao() {
  modoEdicao = !modoEdicao;
  document.getElementById("btnEdicao").classList.toggle("ativo", modoEdicao);
  document.getElementById("modoEdBadge").classList.toggle("hidden", !modoEdicao);
  document.getElementById("mapaContainer").classList.toggle("modo-adicionar", modoEdicao);

  const hint    = document.getElementById("addHint");
  const overlay = criarOverlay();

  if (modoEdicao) {
    // Desativa o panzoom (impede movimento do mapa)
    pz.setOptions({ disablePan: true });
    overlay.style.display = "block";
    if (hint) hint.classList.remove("hidden");
    fecharPainel();
    toast("Modo edição ativo — arraste pontos ou clique no mapa para adicionar", "warn");
  } else {
    pz.setOptions({ disablePan: false });
    overlay.style.display = "none";
    if (hint) hint.classList.add("hidden");
    toast("Modo edição desativado", "ok");
  }
}

/* ── ZOOM ── */
function iniciarPanzoom() {
  pz = Panzoom(document.getElementById("mapa"), {
    maxScale: 5,
    minScale: 0.4,
    contain:  "outside"
  });
  document.getElementById("mapaContainer").addEventListener("wheel", e => {
    pz.zoomWithWheel(e);
  });
}
function resetZoom() { pz.reset(); }

/* ── TOAST ── */
function toast(msg, tipo = "") {
  const c  = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className   = `toast ${tipo}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.classList.add("fade-out"); setTimeout(() => el.remove(), 350); }, 3000);
}

/* ── EXPORTAR ── */
function exportarRelatorio() {
  const hoje = new Date().toLocaleDateString("pt-BR");
  let txt = `RELATÓRIO DE EXTINTORES — ${hoje}\n${"─".repeat(50)}\n\n`;
  Object.keys(dados).sort((a,b)=>+a-+b).forEach(id => {
    const ext = dados[id]; const s = calcularStatus(ext.validade); const d = diasRestantes(ext.validade);
    const sx = s === "verde" ? "✓ EM DIA" : s === "amarelo" ? "⚠ VENCENDO" : "✕ VENCIDO";
    const dTx = d >= 0 ? `${d}d restantes` : `${Math.abs(d)}d vencido`;
    txt += `#${String(id).padStart(3,"0")} | ${ext.tipo.padEnd(18)} | ${ext.setor.padEnd(15)} | Val: ${ext.validade || "—"} | ${sx} (${dTx})\n`;
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
  a.download = `extintores-${hoje.replace(/\//g,"-")}.txt`;
  a.click();
  toast("Relatório exportado!", "ok");
}

/* ── INIT ── */
carregarStorage();
iniciarPanzoom();
renderizarPontos();
