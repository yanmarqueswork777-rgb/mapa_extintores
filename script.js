/* ============================================================
   FireMap — script.js
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
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const v    = new Date(val + "T00:00:00");
  const diff = Math.ceil((v - hoje) / 86400000);
  if (diff < 0)   return "vermelho";
  if (diff <= 30) return "amarelo";
  return "verde";
}
function diasRestantes(val) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.ceil((new Date(val + "T00:00:00") - hoje) / 86400000);
}
function diasLabel(val) {
  const d = diasRestantes(val);
  if (d < 0)  return `${Math.abs(d)} dias vencido`;
  if (d === 0) return "Vence hoje!";
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
  document.getElementById("viewMapa").classList.toggle("hidden", v !== "mapa");
  document.getElementById("viewLista").classList.toggle("hidden", v !== "lista");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  event?.currentTarget?.classList.add("active");

  document.getElementById("viewTitle").textContent =
    v === "mapa" ? "Mapa de Extintores" : "Lista de Extintores";
  document.getElementById("viewSub").textContent =
    v === "mapa" ? "Galpão A · clique num extintor para detalhes" : `${Object.keys(dados).length} extintores cadastrados`;

  if (v === "lista") renderizarLista();
}

/* ── RENDERIZAR MAPA ── */
function renderizarPontos() {
  document.querySelectorAll(".ponto").forEach(p => p.remove());
  Object.keys(dados).forEach(id => renderPonto(id));
  atualizarStats();
}

function renderPonto(id) {
  const ext    = dados[id];
  const pos    = posicoes[id];
  const status = calcularStatus(ext.validade);
  const dias   = diasRestantes(ext.validade);

  const div = document.createElement("div");
  div.id        = "p" + id;
  div.className = `ponto ${status}${idAtivo == id ? " selecionado" : ""}`;
  div.style.top    = pos.top;
  div.style.left   = pos.left;
  div.style.touchAction = "none"; // necessário para pointer capture

  const tt = document.createElement("div");
  tt.className = "ttip";
  tt.textContent = `#${id} — ${ext.tipo} · ${dias < 0 ? "VENCIDO" : dias === 0 ? "Vence hoje!" : dias + "d"}`;
  div.appendChild(tt);

  // Clique normal para abrir painel
  div.addEventListener("click", e => {
    if (!modoEdicao) { e.stopPropagation(); abrirPainel(id); }
  });

  // Drag via Pointer Capture — não conflita com panzoom
  div.addEventListener("pointerdown", e => {
    if (!modoEdicao) return;
    e.stopPropagation();
    e.preventDefault();
    div.setPointerCapture(e.pointerId); // captura todos os eventos no elemento
    const s = pz.getTransform().scale;
    const r = document.getElementById("mapa").getBoundingClientRect();
    drag.ativo = true;
    drag.el    = div;
    drag.id    = id;
    drag.ox    = (e.clientX - r.left) / s - parseFloat(div.style.left);
    drag.oy    = (e.clientY - r.top)  / s - parseFloat(div.style.top);
    document.body.style.userSelect = "none";
  });

  div.addEventListener("pointermove", e => {
    if (!drag.ativo || drag.el !== div) return;
    const s = pz.getTransform().scale;
    const r = document.getElementById("mapa").getBoundingClientRect();
    div.style.left = ((e.clientX - r.left) / s - drag.ox) + "px";
    div.style.top  = ((e.clientY - r.top)  / s - drag.oy) + "px";
  });

  div.addEventListener("pointerup", e => {
    if (!drag.ativo || drag.el !== div) return;
    posicoes[id] = { top: div.style.top, left: div.style.left };
    salvarStorage();
    toast("Posição salva", "ok");
    drag.ativo = false; drag.el = null; drag.id = null;
    document.body.style.userSelect = "";
  });

  document.getElementById("mapa").appendChild(div);
}

/* ── DRAG STATE ── */
let drag = { ativo: false, el: null, id: null, ox: 0, oy: 0 };

/* ── MAPA — adicionar clicando (mousedown+mouseup para evitar conflito com panzoom) ── */
let addDown = null;
document.getElementById("mapaContainer").addEventListener("mousedown", e => {
  if (!modoEdicao || e.target.closest(".ponto")) return;
  addDown = { x: e.clientX, y: e.clientY };
});

document.getElementById("mapaContainer").addEventListener("mouseup", e => {
  if (!modoEdicao || !addDown || e.target.closest(".ponto")) { addDown = null; return; }
  const dist = Math.hypot(e.clientX - addDown.x, e.clientY - addDown.y);
  const pos  = { ...addDown };
  addDown = null;
  if (dist > 6) return; // foi um arrasto, não um clique
  const s = pz.getTransform().scale;
  const r = document.getElementById("mapa").getBoundingClientRect();
  adicionarExtintor(
    Math.round((pos.x - r.left) / s),
    Math.round((pos.y - r.top)  / s)
  );
});

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

  document.getElementById("dpId").textContent   = `EXTINTOR #${id}`;
  document.getElementById("dpNome").textContent  = ext.tipo;

  const bar = document.getElementById("dpStatusBar");
  bar.className = `dp-status-bar s-${status}`;
  document.getElementById("dpStatusIcon").textContent = statusIcon(status);
  document.getElementById("dpStatusText").textContent = statusLabel(status);
  document.getElementById("dpDias").textContent       = ext.validade ? diasLabel(ext.validade) : "—";

  document.getElementById("editSetor").value    = ext.setor   || "";
  document.getElementById("editTipo").value     = ext.tipo    || "Pó Químico ABC";
  document.getElementById("editValidade").value = ext.validade|| "";

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
  const c = document.getElementById("listaContainer");
  const ids = Object.keys(dados).filter(id => {
    if (!filtro) return true;
    const ext = dados[id];
    const f   = filtro.toLowerCase();
    return String(id).includes(f) || ext.tipo.toLowerCase().includes(f) || ext.setor.toLowerCase().includes(f);
  });

  c.innerHTML = ids.length === 0
    ? `<div style="color:var(--text3);font-size:14px;padding:20px">Nenhum extintor encontrado.</div>`
    : ids.sort((a,b)=>+a-+b).map(id => {
        const ext    = dados[id];
        const status = calcularStatus(ext.validade);
        const dias   = ext.validade ? diasRestantes(ext.validade) : null;
        const diasTx = dias === null ? "—" : dias < 0 ? `${Math.abs(dias)}d vencido` : dias === 0 ? "Hoje!" : `${dias}d`;
        return `
          <div class="lista-card ${status}" onclick="abrirPainelLista(${id})">
            <div class="lc-header">
              <span class="lc-id">#${id}</span>
              <span class="lc-badge ${status}">${statusLabel(status)}</span>
            </div>
            <div class="lc-tipo">${ext.tipo}</div>
            <div class="lc-setor">${ext.setor}</div>
            <div class="lc-divider"></div>
            <div>
              <span class="lc-validade">Val. ${ext.validade || "—"}</span>
              <span class="lc-dias ${status}">${diasTx}</span>
            </div>
          </div>`;
      }).join("");
}

function abrirPainelLista(id) {
  // troca pra mapa e abre painel
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
  const btn  = document.getElementById("btnEdicao");
  const badge = document.getElementById("modoEdBadge");
  const hint  = document.getElementById("addHint");

  btn.classList.toggle("ativo", modoEdicao);
  badge.classList.toggle("hidden", !modoEdicao);
  hint?.classList.toggle("hidden", !modoEdicao);
  document.getElementById("mapaContainer").classList.toggle("modo-adicionar", modoEdicao);

  fecharPainel();
  toast(modoEdicao ? "Modo edição ativo — arraste ou clique para adicionar" : "Modo edição desativado", modoEdicao ? "warn" : "ok");
}

/* ── ZOOM ── */
let pz;
function iniciarPanzoom() {
  const el = document.getElementById("mapa");
  pz = Panzoom(el, { maxScale: 5, minScale: 0.4, contain: "outside" });
  document.getElementById("mapaContainer").addEventListener("wheel", e => {
    if (!modoEdicao) pz.zoomWithWheel(e);
  });
}
function resetZoom() { pz.reset(); }

/* ── TOAST ── */
function toast(msg, tipo = "") {
  const c   = document.getElementById("toast-container");
  const el  = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.classList.add("fade-out"); setTimeout(() => el.remove(), 350); }, 3000);
}

/* ── EXPORTAR ── */
function exportarRelatorio() {
  const hoje = new Date().toLocaleDateString("pt-BR");
  let txt = `RELATÓRIO DE EXTINTORES — ${hoje}\n${"─".repeat(50)}\n\n`;
  Object.keys(dados).sort((a,b)=>+a-+b).forEach(id => {
    const ext = dados[id];
    const s   = calcularStatus(ext.validade);
    const d   = diasRestantes(ext.validade);
    const sx  = s === "verde" ? "✓ EM DIA" : s === "amarelo" ? "⚠ VENCENDO" : "✕ VENCIDO";
    txt += `#${id.padStart(3,"0")} | ${ext.tipo.padEnd(18)} | ${ext.setor.padEnd(15)} | Val: ${ext.validade} | ${sx} (${d >= 0 ? d + "d restantes" : Math.abs(d) + "d vencido"})\n`;
  });
  const a  = document.createElement("a");
  a.href   = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
  a.download = `extintores-${hoje.replace(/\//g,"-")}.txt`;
  a.click();
  toast("Relatório exportado!", "ok");
}

/* ── INIT ── */
carregarStorage();
iniciarPanzoom();
renderizarPontos();
