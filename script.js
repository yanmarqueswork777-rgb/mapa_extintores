const dados = {
  1: { tipo: "Pó Químico", validade: "2026-05-10" },
  2: { tipo: "CO2", validade: "2026-03-25" }
};

/* STATUS */
function calcularStatus(dataValidade) {
  const hoje = new Date();
  const validade = new Date(dataValidade);
  const diff = (validade - hoje) / (1000 * 60 * 60 * 24);

  if (diff < 0) return "vermelho";
  if (diff <= 30) return "amarelo";
  return "verde";
}

function atualizarCores() {
  Object.keys(dados).forEach(id => {
    const status = calcularStatus(dados[id].validade);
    const ponto = document.getElementById("p" + id);

    ponto.className = "ponto " + status;
  });
}

/* INFO */
function abrir(id) {
  if (modoEdicao) return;

  const info = dados[id];
  const status = calcularStatus(info.validade);

  const box = document.getElementById("infoBox");

  box.innerHTML = `
    <h3>Extintor ${id}</h3>
    Tipo: ${info.tipo}<br>
    Validade: ${info.validade}<br>
    Status: ${status.toUpperCase()}<br><br>
    <button onclick="trocar(${id})">Trocar</button>
  `;

  box.classList.remove("hidden");
}

function trocar(id) {
  const novaData = prompt("Nova validade (YYYY-MM-DD):");

  if (novaData) {
    dados[id].validade = novaData;
    atualizarCores();
  }
}

/* MODO EDIÇÃO */
let modoEdicao = false;

function toggleEdicao() {
  modoEdicao = !modoEdicao;

  alert(modoEdicao ? "Modo edição ativado" : "Modo edição desativado");
}

/* ARRASTAR PONTO */
let pontoSelecionado = null;

document.querySelectorAll(".ponto").forEach(p => {

  p.addEventListener("mousedown", e => {
    if (!modoEdicao) return;
    pontoSelecionado = p;
  });

});

document.addEventListener("mousemove", e => {
  if (!modoEdicao || !pontoSelecionado) return;

  const mapa = document.getElementById("mapa");
  const rect = mapa.getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  pontoSelecionado.style.left = x + "px";
  pontoSelecionado.style.top = y + "px";
});

document.addEventListener("mouseup", () => {
  pontoSelecionado = null;
});

/* SALVAR */
function salvar() {
  const pontos = document.querySelectorAll(".ponto");

  pontos.forEach(p => {
    const id = p.id.replace("p", "");
    const x = p.style.left;
    const y = p.style.top;

    console.log(`Extintor ${id}: X=${x}, Y=${y}`);
  });

  alert("Posições salvas (veja o console F12)");
}

/* ZOOM */
const elem = document.getElementById('mapa');

const panzoom = Panzoom(elem, {
  maxScale: 5,
  minScale: 1
});

elem.parentElement.addEventListener('wheel', panzoom.zoomWithWheel);

/* INIT */
atualizarCores();
