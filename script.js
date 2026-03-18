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

function abrir(id) {
  const info = dados[id];

  const hoje = new Date();
  const validade = new Date(info.validade);

  let status = "OK";

  if (validade < hoje) {
    status = "VENCIDO";
  }

  const box = document.getElementById("infoBox");

  box.innerHTML = `
    <b>Extintor ${id}</b><br>
    Tipo: ${info.tipo}<br>
    Validade: ${info.validade}<br>
    Status: ${status}<br><br>
    <button onclick="trocar(${id})">Trocar</button>
  `;

  box.classList.remove("hidden");
}

function trocar(id) {
  alert("Extintor " + id + " atualizado!");
}