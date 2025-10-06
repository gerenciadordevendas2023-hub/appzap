const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'fluxos');

// Garante que a pasta exista
if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

function getFilePath(numero) {
  return path.join(baseDir, `${numero}.json`);
}

// Converte blocos (frontend) em passos (backend) com opcoes como array
function blocosParaPassos(blocos) {
  const passos = {};
  blocos.forEach(bloco => {
    const opcoes = [];
    if (Array.isArray(bloco.opcoes)) {
      bloco.opcoes.forEach(op => {
        if (op.texto && op.destino) {
          opcoes.push({ texto: op.texto.trim(), destino: op.destino });
        }
      });
    }
    passos[bloco.id] = {
      mensagem: bloco.mensagem || '',
      opcoes
    };
  });
  return { passos };
}

// Carrega fluxos do disco
function carregarFluxos(numero) {
  const file = getFilePath(numero);
  if (!fs.existsSync(file)) {
    return { fluxos: {}, ativo: null };
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    fluxos: data.fluxos || {},
    ativo: data.ativo || null
  };
}

// Salva fluxos no disco
function salvarFluxos(numero, fluxos, ativo) {
  const file = getFilePath(numero);
  const data = { fluxos, ativo };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ----- API -----

function setFluxo(numero, nomeFluxo, fluxoBruto) {
  const { fluxos } = carregarFluxos(numero);

  // Converte blocos em passos, garantindo opcoes como array
  const fluxoConvertido = Array.isArray(fluxoBruto)
    ? blocosParaPassos(fluxoBruto)
    : fluxoBruto;

  fluxos[nomeFluxo] = fluxoConvertido;
  salvarFluxos(numero, fluxos, nomeFluxo); // salva e define ativo
  return true;
}

function getFluxo(numero, nomeFluxo) {
  const { fluxos } = carregarFluxos(numero);
  return fluxos[nomeFluxo] || null;
}

function listarFluxos(numero) {
  const { fluxos } = carregarFluxos(numero);
  return Object.keys(fluxos);
}

function setFluxoAtivo(numero, nomeFluxo) {
  const { fluxos } = carregarFluxos(numero);
  if (!fluxos[nomeFluxo]) return false;
  salvarFluxos(numero, fluxos, nomeFluxo);
  return true;
}

function getFluxoAtivo(numero) {
  const { ativo } = carregarFluxos(numero);
  return ativo;
}

module.exports = {
  setFluxo,
  getFluxo,
  listarFluxos,
  setFluxoAtivo,
  getFluxoAtivo
};
