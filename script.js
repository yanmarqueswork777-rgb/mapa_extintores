/* ============================================================
   CONTROLE DE EXTINTORES — script.js
   ============================================================ */

/* ── ESTADO INICIAL ── */
let dados = {
  1: { tipo: "Pó Químico ABC", validade: "2026-05-10", setor: "Galpão A" },
  2: { tipo: "CO₂",            validade: "2026-03-25", setor: "Galpão A" }
};
let posicoes = {
  1: { top: "100px", left: "200px" },
  2: { top: "250px", left: "400px" }
};
let proximoId = 3;
let modoEdicao = false;
let idSelecionado = null;

/* ── TIPOS DE EXTINTOR ── */
const TIPOS = ["Pó Químico ABC", "CO₂", "Água", "Espuma", "Halotron"];

/* ── PERSISTÊNCIA ── */
function salvarStorage() {
  localStorage.setItem("extintores_dados",    JSON.stringify(dados));
  localStorage.setItem("extintores_posicoes", JSON.stringify(posicoes));
  localStorage.setItem("extintores_proximoId",String(proximoId));
}
function carregarStorage() {
  try {
    const d = localStorage.getItem("extintores_dados");
    const p = localStorage.getItem("extintores_posicoes");
    const n = localStorage.getItem("extintores_proximoId");
    if (d) dados     = JSON.parse(d);
    if (p) posicoes  = JSON.parse(p);
    if (n) proximoId = parseInt(n, 10);
  } catch(e) {
    console.warn("Erro ao carregar localStorage:", e);
  }
}

/* ── STATUS ── */
function calcularStatus(dataValidade) {
  const hoje    = new Date(); hoje.setHours(0,0,0,0);
  const validade = new Date(dataValidade + "T00:00:00");
  const diff    = (validade - hoje) / (1000 * 60 * 60 * 24);
  if (diff < 0)   return "vermelho";
  if (diff <= 30)  return "amarelo";
  return "verde";
}
function diasRestantes(dataValidade) {
  const hoje    = new Date(); hoje.setHours(0,0,0,0);
  const validade = new Date(dataValidade + "T00:00:00");
  return Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
}

/* ── ESTATÍSTICAS ── */
function atualizarStats() {
  const ids   = Object.keys(dados);
  let ok = 0, warn = 0, exp = 0;
  ids.forEach(id => {
    const s = calcularStatus(dados[id].validade);
    if (s === "verde")    ok++;
    else if (s === "amarelo") warn++;
    else                      exp++;
  });
  document.getElementById("statTotal").textContent = ids.length;
  document.getElementById("statOk").textContent    = ok;
  document.getElementById("statWarn").textContent  = warn;
  document.getElementById("statExp").textContent   = exp;
}

/* ── RENDERIZAR PONTOS ── */
function renderizarPontos() {
  // Remove pontos antigos
  document.querySelectorAll(".ponto").forEach(p => p.remove());

  Object.keys(dados).forEach(id => {
    const pos    = posicoes[id];
    const status = calcularStatus(dados[id].validade);
    const dias   = diasRestantes(dados[id].validade);
    const ext    = dados[id];

    const div = document.createElement("div");
    div.id        = "p" + id;
    div.className = `ponto ${status}`;
    div.style.top  = pos.top;
    div.style.left = pos.left;
    if (idSelecionado == id) div.classList.add("selecionado");

    // Tooltip
    const tt = document.createElement("div");
    tt.className = "tooltip";
    tt.textContent = `#${id} — ${ext.tipo} | ${dias >= 0 ? dias + " dias" : "VENCIDO"}`;
    div.appendChild(tt);

    // Click
    div.addEventListener("click", (e) => {
      if (modoEdicao) return;
      e.stopPropagation();
      abrirPainel(id);
    });

    // Drag
    div.addEventListener("mousedown", (e) => {
      if (!modoEdicao) return;
      e.stopPropagation();
      e.preventDefault();
      iniciarDrag(div, id, e);
    });

    document.getElementById("mapa").appendChild(div);
  });

  atualizarStats();
}

/* ── DRAG DOS PONTOS ── */
let dragAtivo    = false;
let dragPonto    = null;
let dragId       = null;
let dragOffsetX  = 0;
let dragOffsetY  = 0;

function iniciarDrag(el, id, e) {
  dragAtivo   = true;
  dragPonto   = el;
  dragId      = id;

  const scale = obterScale();
  const mapa  = document.getElementById("mapa");
  const rect  = mapa.getBoundingClientRect();

  // Posição atual do ponto (em px do mapa, sem escala)
  const px = parseFloat(el.style.left);
  const py = parseFloat(el.style.top);

  // Onde o mouse está no espaço do mapa (dividido pela scale)
  const mouseX = (e.clientX - rect.left) / scale;
  const mouseY = (e.clientY - rect.top)  / scale;

  dragOffsetX = mouseX - px;
  dragOffsetY = mouseY - py;

  // Desabilita panzoom enquanto arrasta
  panzoomInst.setOptions({ disablePan: true });
  document.body.style.userSelect = "none";
}

document.addEventListener("mousemove", (e) => {
  if (!dragAtivo || !dragPonto) return;
  const scale = obterScale();
  const mapa  = document.getElementById("mapa");
  const rect  = mapa.getBoundingClientRect();

  const mouseX = (e.clientX - rect.left) / scale;
  const mouseY = (e.clientY - rect.top)  / scale;

  const newX = mouseX - dragOffsetX;
  const newY = mouseY - dragOffsetY;

  dragPonto.style.left = newX + "px";
  dragPonto.style.top  = newY + "px";
});

document.addEventListener("mouseup", () => {
  if (!dragAtivo) return;
  if (dragId !== null) {
    posicoes[dragId] = {
      top:  dragPonto.style.top,
      left: dragPonto.style.left
    };
    salvarStorage();
    toast("Posição salva!", "ok");
  }
  dragAtivo  = false;
  dragPonto  = null;
  dragId     = null;
  panzoomInst.setOptions({ disablePan: false });
  document.body.style.userSelect = "";
});

/* ── OBTER SCALE DO PANZOOM ── */
function obterScale() {
  const transform = panzoomInst.getTransform();
  return transform.scale || 1;
}

/* ── PAINEL LATERAL ── */
function abrirPainel(id) {
  idSelecionado = id;
  renderizarPontos(); // atualiza selecionado

  const ext    = dados[id];
  const status = calcularStatus(ext.validade);
  const dias   = diasRestantes(ext.validade);
  const badgeClass = `badge-${status}`;

  let diasTexto = "";
  if (dias < 0)      diasTexto = `<span style="color:var(--vermelho)">${Math.abs(dias)} dias vencido</span>`;
  else if (dias == 0) diasTexto = `<span style="color:var(--amarelo)">Vence HOJE!</span>`;
  else               diasTexto = `<span style="color:var(--verde)">${dias} dias restantes</span>`;

  // Monta select de tipos
  const opcoesSelect = TIPOS.map(t =>
    `<option value="${t}" ${t === ext.tipo ? "selected" : ""}>${t}</option>`
  ).join("");

  document.getElementById("painelConteudo").innerHTML = `
    <div class="painel-titulo">EXTINTOR #${id}</div>

    <div class="painel-row">
      <label>Status</label>
      <span class="status-badge ${badgeClass}">${status === "verde" ? "✓ Em dia" : status === "amarelo" ? "⚠ Vencendo" : "✕ Vencido"}</span>
      <div class="dias-label">${diasTexto}</div>
    </div>

    <div class="painel-row">
      <label>Setor / Local</label>
      <input type="text" id="editSetor" value="${ext.setor}" placeholder="Ex: Galpão A">
    </div>

    <div class="painel-row">
      <label>Tipo do Extintor</label>
      <select id="editTipo">${opcoesSelect}</select>
    </div>

    <div class="painel-row">
      <label>Validade</label>
      <input type="date" id="editValidade" value="${ext.validade}">
    </div>

    <div class="painel-acoes">
      <button class="btn" onclick="salvarEdicao(${id})">💾 Salvar Alterações</button>
      <button class="btn btn-ghost" onclick="trocarValidade(${id})">🔄 Registrar Recarga</button>
      <button class="btn btn-danger" onclick="removerExtintor(${id})">🗑 Remover Extintor</button>
    </div>
  `;

  document.getElementById("painel").classList.remove("fechado");
}

function fecharPainel() {
  document.getElementById("painel").classList.add("fechado");
  idSelecionado = null;
  document.querySelectorAll(".ponto").forEach(p => p.classList.remove("selecionado"));
}

function salvarEdicao(id) {
  const tipo     = document.getElementById("editTipo").value;
  const validade = document.getElementById("editValidade").value;
  const setor    = document.getElementById("editSetor").value.trim();

  if (!validade) { toast("Informe a validade!", "err"); return; }

  dados[id].tipo     = tipo;
  dados[id].validade = validade;
  dados[id].setor    = setor || dados[id].setor;

  salvarStorage();
  renderizarPontos();
  abrirPainel(id); // recarrega painel
  toast("Extintor atualizado!", "ok");
}

function trocarValidade(id) {
  // Troca a validade para hoje + 1 ano (recarga padrão)
  const hoje   = new Date();
  hoje.setFullYear(hoje.getFullYear() + 1);
  const nova   = hoje.toISOString().split("T")[0];
  dados[id].validade = nova;
  salvarStorage();
  renderizarPontos();
  abrirPainel(id);
  toast("Recarga registrada! Nova validade: " + nova, "ok");
}

function removerExtintor(id) {
  if (!confirm(`Remover o Extintor #${id}?`)) return;
  delete dados[id];
  delete posicoes[id];
  salvarStorage();
  fecharPainel();
  renderizarPontos();
  toast(`Extintor #${id} removido.`, "warn");
}

/* ── ADICIONAR EXTINTOR (clique no mapa) ── */
function adicionarExtintor(x, y) {
  const id = proximoId++;
  dados[id]    = { tipo: "Pó Químico ABC", validade: "", setor: "Galpão A" };
  posicoes[id] = { top: y + "px", left: x + "px" };
  salvarStorage();
  renderizarPontos();
  abrirPainel(id); // abre painel imediatamente para preencher dados
  toast(`Extintor #${id} adicionado. Preencha os dados no painel →`, "ok");
}

/* ── MODO EDIÇÃO ── */
function toggleEdicao() {
  modoEdicao = !modoEdicao;
  const btn   = document.getElementById("btnEdicao");
  const label = document.getElementById("modoLabel");
  const cont  = document.getElementById("mapaContainer");

  btn.classList.toggle("ativo", modoEdicao);
  label.classList.toggle("hidden", !modoEdicao);
  cont.classList.toggle("modo-adicionar", modoEdicao);

  // Em modo edição, clique no mapa (fora de ponto) adiciona extintor
  if (modoEdicao) {
    toast("Modo edição ativado — arraste pontos ou clique no mapa para adicionar", "warn");
    panzoomInst.setOptions({ disablePan: true });
  } else {
    toast("Modo edição desativado", "ok");
    panzoomInst.setOptions({ disablePan: false });
  }
}

document.getElementById("mapaContainer").addEventListener("click", (e) => {
  if (!modoEdicao) return;
  if (e.target.closest(".ponto")) return; // clicou em ponto, não adiciona

  const scale = obterScale();
  const mapa  = document.getElementById("mapa");
  const rect  = mapa.getBoundingClientRect();
  const x     = (e.clientX - rect.left) / scale;
  const y     = (e.clientY - rect.top)  / scale;
  adicionarExtintor(Math.round(x), Math.round(y));
});

/* ── ZOOM ── */
let panzoomInst;
function iniciarPanzoom() {
  const elem = document.getElementById("mapa");
  panzoomInst = Panzoom(elem, {
    maxScale: 5,
    minScale: 0.5,
    contain: "outside"
  });
  document.getElementById("mapaContainer").addEventListener("wheel", (e) => {
    if (modoEdicao) return;
    panzoomInst.zoomWithWheel(e);
  });
}
function resetZoom() {
  panzoomInst.reset();
}

/* ── TOAST ── */
let toastTimer;
function toast(msg, tipo = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = "show" + (tipo ? " toast-" + tipo : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ""; }, 3000);
}

/* ── EXPORTAR RELATÓRIO ── */
function exportarRelatorio() {
  const hoje = new Date().toLocaleDateString("pt-BR");
  let linhas = [`RELATÓRIO DE EXTINTORES — ${hoje}\n${"=".repeat(50)}\n`];

  Object.keys(dados).sort((a,b)=>a-b).forEach(id => {
    const ext    = dados[id];
    const status = calcularStatus(ext.validade);
    const dias   = diasRestantes(ext.validade);
    const s      = status === "verde" ? "OK" : status === "amarelo" ? "VENCENDO" : "VENCIDO";
    linhas.push(
      `Extintor #${id}\n` +
      `  Setor:    ${ext.setor}\n` +
      `  Tipo:     ${ext.tipo}\n` +
      `  Validade: ${ext.validade}\n` +
      `  Status:   ${s} (${dias >= 0 ? dias + " dias restantes" : Math.abs(dias) + " dias vencido"})\n`
    );
  });

  const blob = new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `relatorio-extintores-${hoje.replace(/\//g,"-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Relatório exportado!", "ok");
}

/* ── INICIALIZAÇÃO ── */
carregarStorage();
iniciarPanzoom();
renderizarPontos();
