/* ============================================================
   FireMap — script.js
   ============================================================ */

let dados = {
  1: { tipo: "Pó Químico ABC", validade: "2026-05-10", setor: "Galpão A" },
  2: { tipo: "CO₂",            validade: "2026-03-25", setor: "Galpão A" }
};
let posicoes = {
  1: { top: "100px", left: "200px" },
  2: { top: "250px", left: "400px" }
};
let proximoId  = 3;
let idAtivo    = null;
let viewAtual  = "mapa";
let pz         = null;

// estados do modo edição
let modoAtual  = null; // null | "mover" | "colocar"
let fantasma   = null; // div que segue o cursor ao colocar novo
let dadosNovo  = null; // dados do novo extintor aguardando posição

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
  if (d < 0)      return `${Math.abs(d)} dias vencido`;
  if (d === 0)    return "Vence hoje!";
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
  event?.currentTarget?.classList.add("active");
  document.getElementById("viewTitle").textContent =
    v === "mapa" ? "Mapa de Extintores" : "Lista de Extintores";
  document.getElementById("viewSub").textContent =
    v === "mapa" ? "Galpão A · clique num extintor para detalhes"
                 : `${Object.keys(dados).length} extintores cadastrados`;
  if (v === "lista") renderizarLista();
}

/* ── PANZOOM ── */
function criarPanzoom() {
  if (pz) return;
  pz = Panzoom(document.getElementById("mapa"), { maxScale: 5, minScale: 0.4, contain: "outside" });
}
function destruirPanzoom() {
  if (!pz) return;
  pz.destroy();
  pz = null;
}
function resetZoom() { if (pz) pz.reset(); }

document.getElementById("mapaContainer").addEventListener("wheel", e => {
  if (pz) pz.zoomWithWheel(e);
});

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

  const tt = document.createElement("div");
  tt.className   = "ttip";
  tt.textContent = `#${id} — ${ext.tipo} · ${dias < 0 ? "VENCIDO" : dias === 0 ? "Hoje!" : dias + "d"}`;
  div.appendChild(tt);

  /* Clique normal → abre painel */
  div.addEventListener("click", e => {
    if (modoAtual) return;
    e.stopPropagation();
    abrirPainel(id);
  });

  /* Drag no modo mover */
  div.addEventListener("mousedown", e => {
    if (modoAtual !== "mover") return;
    e.stopPropagation();
    e.preventDefault();

    const mapaEl = document.getElementById("mapa");
    const rect   = mapaEl.getBoundingClientRect();
    const ox     = e.clientX - rect.left - parseFloat(div.style.left);
    const oy     = e.clientY - rect.top  - parseFloat(div.style.top);
    div.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    function onMove(ev) {
      const r = mapaEl.getBoundingClientRect();
      div.style.left = (ev.clientX - r.left - ox) + "px";
      div.style.top  = (ev.clientY - r.top  - oy) + "px";
    }
    function onUp() {
      posicoes[id] = { top: div.style.top, left: div.style.left };
      salvarStorage();
      div.style.cursor = "";
      document.body.style.userSelect = "";
      toast("Posição salva", "ok");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  });

  document.getElementById("mapa").appendChild(div);
}

/* ── MODAL SELEÇÃO DE MODO ── */
function toggleEdicao() {
  if (modoAtual) {
    // já em edição → sair
    sairEdicao();
    return;
  }
  abrirModalModo();
}

function abrirModalModo() {
  document.getElementById("modalModo").classList.remove("hidden");
}
function fecharModalModo() {
  document.getElementById("modalModo").classList.add("hidden");
}

function escolherMover() {
  fecharModalModo();
  modoAtual = "mover";
  destruirPanzoom();
  document.getElementById("btnEdicao").classList.add("ativo");
  document.getElementById("btnEdicao").textContent = "✕ Sair da Edição";
  setBadge("mover");
  document.getElementById("mapaContainer").style.cursor = "grab";
  fecharPainel();
  toast("Modo mover — arraste os extintores para reposicioná-los", "warn");
}

function escolherCriar() {
  fecharModalModo();
  abrirModalCadastro();
}

function sairEdicao() {
  modoAtual = null;
  dadosNovo = null;
  removerFantasma();
  criarPanzoom();
  document.getElementById("btnEdicao").classList.remove("ativo");
  document.getElementById("btnEdicao").innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    Modo Edição`;
  setBadge(null);
  document.getElementById("mapaContainer").style.cursor = "";
  toast("Modo edição desativado", "ok");
}

function setBadge(modo) {
  const badge = document.getElementById("modoEdBadge");
  const hint  = document.getElementById("addHint");
  if (!modo) {
    badge.classList.add("hidden");
    if (hint) hint.classList.add("hidden");
    return;
  }
  badge.classList.remove("hidden");
  badge.querySelector("span:last-child").textContent =
    modo === "mover" ? "Arraste os extintores" : "Clique no mapa para posicionar";
  if (hint) hint.classList.toggle("hidden", modo !== "colocar");
}

/* ── MODAL CADASTRO ── */
function abrirModalCadastro() {
  // Limpa campos
  document.getElementById("novoSetor").value    = "Galpão A";
  document.getElementById("novoTipo").value     = "Pó Químico ABC";
  document.getElementById("novoValidade").value = "";
  document.getElementById("modalCadastro").classList.remove("hidden");
}
function fecharModalCadastro() {
  document.getElementById("modalCadastro").classList.add("hidden");
}

function confirmarCadastro() {
  const tipo     = document.getElementById("novoTipo").value;
  const validade = document.getElementById("novoValidade").value;
  const setor    = document.getElementById("novoSetor").value.trim();

  if (!validade) { toast("Informe a validade!", "err"); return; }
  if (!setor)    { toast("Informe o setor!",    "err"); return; }

  dadosNovo = { tipo, validade, setor };
  fecharModalCadastro();

  // Entra no modo colocar
  modoAtual = "colocar";
  destruirPanzoom();
  document.getElementById("btnEdicao").classList.add("ativo");
  document.getElementById("btnEdicao").textContent = "✕ Cancelar";
  setBadge("colocar");
  document.getElementById("mapaContainer").style.cursor = "crosshair";
  criarFantasma();
  toast("Clique no mapa para posicionar o extintor", "warn");
}

/* ── FANTASMA (ponto que segue o cursor) ── */
function criarFantasma() {
  removerFantasma();
  const div = document.createElement("div");
  div.id        = "fantasma";
  div.className = "ponto verde fantasma-pin";
  div.style.pointerEvents = "none";
  div.style.opacity       = "0.7";
  div.style.position      = "absolute";
  div.style.display       = "none";
  document.getElementById("mapa").appendChild(div);
  fantasma = div;
}
function removerFantasma() {
  if (fantasma) { fantasma.remove(); fantasma = null; }
}

// Fantasma segue o mouse
document.getElementById("mapaContainer").addEventListener("mousemove", e => {
  if (modoAtual !== "colocar" || !fantasma) return;
  const mapa = document.getElementById("mapa");
  const rect = mapa.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  fantasma.style.display = "block";
  fantasma.style.left    = x + "px";
  fantasma.style.top     = y + "px";
});

// Clique no mapa → posiciona o novo extintor
document.getElementById("mapa").addEventListener("click", e => {
  if (modoAtual !== "colocar" || !dadosNovo) return;
  if (e.target.id === "fantasma") return;

  const mapa = document.getElementById("mapa");
  const rect = mapa.getBoundingClientRect();
  const x    = Math.round(e.clientX - rect.left);
  const y    = Math.round(e.clientY - rect.top);

  const id = proximoId++;
  dados[id]    = { ...dadosNovo };
  posicoes[id] = { top: y + "px", left: x + "px" };
  salvarStorage();

  removerFantasma();
  dadosNovo = null;

  // Volta para modo mover automaticamente (pronto para reposicionar se necessário)
  modoAtual = "mover";
  setBadge("mover");
  document.getElementById("mapaContainer").style.cursor = "grab";
  document.getElementById("btnEdicao").textContent = "✕ Sair da Edição";

  renderPonto(id);
  atualizarStats();
  abrirPainel(id);
  toast(`Extintor #${id} posicionado! Arraste para ajustar ou saia da edição.`, "ok");
});

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
criarPanzoom();
renderizarPontos();
