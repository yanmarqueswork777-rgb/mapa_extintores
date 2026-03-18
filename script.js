const dados = {
  1: {
    tipo: "Pó Químico",
    validade: "2026-05-10"
  },
  2: {
    tipo: "CO2",
    validade: "2026-03-25"
  }
};

function calcularStatus(dataValidade) {
  const hoje = new Date();
  const validade = new Date(dataValidade);

  const diffDias = (validade - hoje) / (1000 * 60 * 60 * 24);

  if (diffDias < 0) return "vermelho";
  if (diffDias <= 30) return "amarelo";
  return "verde";
}

function atualizarCores() {
  Object.keys(dados).forEach(id => {
    const status = calcularStatus(dados[id].validade);
    const ponto = document.getElementById("p" + id);

    ponto.classList.remove("verde", "amarelo", "vermelho");
    ponto.classList.add(status);
  });
}

function abrir(id) {
  const info = dados[id];
  const status = calcularStatus(info.validade);

  const box = document.getElementById("infoBox");

  box.innerHTML = `
    <h3>Extintor ${id}</h3>
    Tipo: ${info.tipo}<br>
    Validade: ${info.validade}<br>
    Status: ${status.toUpperCase()}<br>
    <button onclick="trocar(${id})">Trocar</button>
  `;

  box.classList.remove("hidden");
}

function trocar(id) {
  const novaData = prompt("Nova validade (YYYY-MM-DD):");

  if (novaData) {
    dados[id].validade = novaData;
    atualizarCores();
    alert("Atualizado!");
  }
}

atualizarCores();
