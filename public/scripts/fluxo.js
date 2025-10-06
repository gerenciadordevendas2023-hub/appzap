let blocos = [];
let contador = 0;

const blocosContainer = document.getElementById('blocos');
const simulador = document.getElementById('simulador');

// Adicionar novo bloco
document.getElementById('adicionarBloco').onclick = () => {
  const id = `bloco-${contador++}`;
  const bloco = {
    id,
    mensagem: '',
    opcoes: [],
  };
  blocos.push(bloco);
  renderBlocos();
};



function renderBlocos() {
  blocosContainer.innerHTML = '';

  blocos.forEach((bloco) => {
    const div = document.createElement('div');
    div.className = 'bg-gray-100 p-4 rounded shadow space-y-2';
    div.dataset.id = bloco.id;

    const inputMensagem = document.createElement('textarea');
    inputMensagem.placeholder = 'Mensagem do bloco';
    inputMensagem.className = 'w-full p-2 border border-gray-300 rounded';
    inputMensagem.value = bloco.mensagem;
    inputMensagem.oninput = e => bloco.mensagem = e.target.value;

    const opcoesDiv = document.createElement('div');
    opcoesDiv.className = 'space-y-1';

    bloco.opcoes.forEach((opcao) => {
      const linha = document.createElement('div');
      linha.className = 'flex space-x-2';

      const inputTexto = document.createElement('input');
      inputTexto.className = 'flex-1 p-1 border rounded';
      inputTexto.placeholder = 'Texto do botão';
      inputTexto.value = opcao.texto;
      inputTexto.oninput = e => opcao.texto = e.target.value;

      const selectDestino = document.createElement('select');
      selectDestino.className = 'p-1 border rounded';
      selectDestino.innerHTML = '<option value="">Destino</option>' + blocos.map(b =>
        `<option value="${b.id}" ${b.id === opcao.destino ? 'selected' : ''}>${b.id}</option>`
      ).join('');
      selectDestino.onchange = e => opcao.destino = e.target.value;

      linha.appendChild(inputTexto);
      linha.appendChild(selectDestino);
      opcoesDiv.appendChild(linha);
    });

    const btnAddOpcao = document.createElement('button');
    btnAddOpcao.textContent = '➕ Adicionar botão';
    btnAddOpcao.className = 'text-sm text-blue-600';
    btnAddOpcao.onclick = () => {
      bloco.opcoes.push({ texto: '', destino: '' });
      renderBlocos();
    };

    div.appendChild(document.createTextNode(`🧱 ${bloco.id}`));
    div.appendChild(inputMensagem);
    div.appendChild(opcoesDiv);
    div.appendChild(btnAddOpcao);
    blocosContainer.appendChild(div);
  });
}

// Simulação
document.getElementById('iniciarSimulacao').onclick = () => {
  simulador.innerHTML = '';
  iniciarAtendimento('bloco-0');
};

function iniciarAtendimento(id) {
  const bloco = blocos.find(b => b.id === id);
  if (!bloco) return;

  const msg = document.createElement('div');
  msg.textContent = bloco.mensagem;
  msg.className = 'bg-gray-200 p-2 rounded';
  simulador.appendChild(msg);

  bloco.opcoes.forEach(op => {
    const btn = document.createElement('button');
    btn.textContent = op.texto;
    btn.className = 'block w-full text-left px-4 py-2 mt-2 bg-blue-100 hover:bg-blue-200 rounded';
    btn.onclick = () => {
      simulador.innerHTML = '';
      iniciarAtendimento(op.destino);
    };
    simulador.appendChild(btn);
  });
}

// Reiniciar simulador
document.getElementById("restart-flow").addEventListener("click", () => {
  simulador.innerHTML = "";
  if (blocos.length > 0) {
    iniciarAtendimento('bloco-0');
  }
});

// Exportar JSON
document.getElementById('exportarFluxo').addEventListener("click", () => {
  if (blocos.length === 0) {
    alert('Nenhum bloco para exportar!');
    return;
  }
  const data = JSON.stringify(blocos, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "fluxo_chatbot.json";
  link.click();
  URL.revokeObjectURL(url);
});

// Importar JSON
const inputImportar = document.getElementById('importarFluxo');
document.getElementById('btnImportar').onclick = () => inputImportar.click();

inputImportar.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      if (!Array.isArray(json)) throw new Error("Formato inválido");
      if (!json.every(b => b.id && typeof b.mensagem === 'string' && Array.isArray(b.opcoes))) {
        throw new Error("Estrutura dos blocos incorreta");
      }

      blocos = json;
      contador = blocos.length;
      renderBlocos();
      alert("Fluxo carregado com sucesso!");
      inputImportar.value = null;
    } catch (err) {
      alert("Erro ao importar JSON: " + err.message);
    }
  };
  reader.readAsText(file);
};

// Validação completa
function validarFluxo() {
  let erros = [];

  const blocosReferenciados = new Set();
  const blocosUsados = new Set();

  blocos.forEach((bloco, index) => {
    if (!bloco.mensagem.trim() && bloco.opcoes.length === 0) {
      erros.push(`❗ Bloco vazio: ${bloco.id}`);
    }

    bloco.opcoes.forEach((opcao, j) => {
      if (!opcao.texto.trim()) {
        erros.push(`❌ Botão #${j + 1} no bloco ${bloco.id} está sem texto`);
      }
      if (!opcao.destino.trim()) {
        erros.push(`❌ Botão #${j + 1} no bloco ${bloco.id} está sem destino`);
      } else {
        blocosReferenciados.add(opcao.destino);
      }
    });
  });

  blocos.forEach(bloco => {
    if (bloco.id !== 'bloco-0' && !blocosReferenciados.has(bloco.id)) {
      erros.push(`⚠️ Bloco órfão (sem destino apontando): ${bloco.id}`);
    }
  });

  if (erros.length > 0) {
    alert("🚨 Problemas encontrados no fluxo:\n\n" + erros.join('\n'));
  } else {
    alert("✅ Fluxo válido! Nenhum problema encontrado.");
  }
}

// Conecta botão validar
document.getElementById('btnValidar').onclick = validarFluxo;

// NOVO: Salvar fluxo no backend para o número WhatsApp informado
document.getElementById('salvarFluxoBackend')?.addEventListener('click', async () => {
  const numero = document.getElementById('numeroWhatsApp')?.value.trim();
  if (!numero) {
    alert('Por favor, informe o número WhatsApp com DDD, só números.');
    return;
  }
  if (blocos.length === 0) {
    alert('Nenhum bloco criado para salvar.');
    return;
  }

  try {
    const response = await fetch('/chatbot/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero, nomeFluxo: 'principal', fluxo: blocos }),
    });
    const data = await response.json();
    if (response.ok) {
      alert('Fluxo salvo e vinculado ao número com sucesso!');
    } else {
      alert('Erro ao salvar fluxo: ' + (data.error || 'Erro desconhecido'));
    }
  } catch (err) {
    alert('Erro ao comunicar com o servidor: ' + err.message);
  }
});
// Função para mostrar o QR code no canvas
function mostrarQRCode(qrString) {
  const qrCodeContainer = document.getElementById('qrCodeContainer');
  const qrCanvas = document.getElementById('qrCanvas');
  qrCodeContainer.classList.remove('hidden');

  QRCode.toCanvas(qrCanvas, qrString, function (error) {
    if (error) {
      console.error('Erro ao gerar QR Code:', error);
      qrCodeContainer.classList.add('hidden');
    }
  });
}

// Função para conectar SSE e receber QR code do backend
function conectarSSE(numero) {
  if (!numero) return;

  const source = new EventSource(`/chatbot/qr-code-sse?numero=${numero}`);

  source.addEventListener('qr', function(event) {
  const qrString = event.data;
  mostrarQRCode(qrString);
});

source.addEventListener('ready', function(event) {
  document.getElementById('qrCodeContainer').classList.add('hidden');
  alert(`Cliente ${numero} conectado!`);
  source.close();
});

source.addEventListener('disconnected', function(event) {
  alert('Cliente desconectado: ' + event.data);
  document.getElementById('qrCodeContainer').classList.add('hidden');
  source.close();
});

source.onerror = function() {
  console.error('Erro na conexão SSE');
  source.close();
  document.getElementById('qrCodeContainer').classList.add('hidden');
};


  source.onerror = function() {
    source.close();
    document.getElementById('qrCodeContainer').classList.add('hidden');
  };
}

// Modificar evento do botão para abrir SSE e iniciar cliente
document.getElementById('salvarFluxoBackend').addEventListener('click', async () => {
  const numero = document.getElementById('numeroWhatsApp').value.trim();
  if (!numero) {
    alert('Informe o número WhatsApp');
    return;
  }

  // Abrir SSE para receber QR Code
  conectarSSE(numero);

  // Iniciar client no backend
  try {
    const res = await fetch('/chatbot/iniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero }),
    });
    const data = await res.json();
    alert(data.mensagem || 'Cliente iniciado. Escaneie o QR Code');
  } catch (err) {
    alert('Erro ao iniciar cliente: ' + err.message);
  }
});
document.addEventListener("DOMContentLoaded", function () {
  const numeroInput = document.getElementById("numero");
  const statusSpan = document.getElementById("status");
  const gerarBtn = document.getElementById("gerar");
  const salvarBtn = document.getElementById("salvar");
  const pararBtn = document.getElementById("parar");
  const apagarBtn = document.getElementById("apagar");
  const blocosContainer = document.getElementById("blocos");

  let numeroAtual = "";

  gerarBtn.addEventListener("click", () => {
    numeroAtual = numeroInput.value.trim();
    if (!numeroAtual) return alert("Informe o número!");

    conectar(numeroAtual);
  });

  salvarBtn.addEventListener("click", () => {
    const fluxo = gerarFluxo();
    fetch(`/chatbot/fluxo/${numeroAtual}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fluxo }),
    })
      .then(res => res.json())
      .then(data => alert("Fluxo salvo com sucesso!"))
      .catch(err => console.error("Erro ao salvar fluxo:", err));
  });

  pararBtn.addEventListener("click", () => {
    fetch(`/chatbot/parar/${numeroAtual}`, { method: "POST" })
      .then(() => alert("Fluxo interrompido."))
      .catch(err => console.error("Erro ao parar:", err));
  });

  apagarBtn.addEventListener("click", () => {
    if (!numeroAtual) return alert("Nenhum número conectado.");
    fetch(`/chatbot/apagar/${numeroAtual}`, { method: "DELETE" })
      .then(() => {
        numeroAtual = "";
        blocosContainer.innerHTML = "";
        statusSpan.innerText = "Desconectado";
        alert("Fluxo e cliente removidos.");
      })
      .catch(err => console.error("Erro ao apagar fluxo:", err));
  });

  function conectar(numero) {
    const evtSource = new EventSource(`/chatbot/qr-code-sse?numero=${numero}`);
    statusSpan.innerText = "Conectando...";

    evtSource.addEventListener("qr", event => {
      const qrCode = event.data;
      const qrDiv = document.getElementById("qrcode");
      qrDiv.innerHTML = "";
      new QRCode(qrDiv, qrCode);
    });

    evtSource.addEventListener("ready", () => {
      statusSpan.innerText = "Conectado";
    });

    evtSource.addEventListener("disconnected", () => {
      statusSpan.innerText = "Desconectado";
    });
  }

  function gerarFluxo() {
    const blocos = [...document.querySelectorAll(".bloco")];
    return blocos.map(bloco => {
      const id = bloco.dataset.id;
      const mensagem = bloco.querySelector(".mensagem").value;
      const opcoes = [...bloco.querySelectorAll(".opcao")].map(op => ({
        texto: op.querySelector(".texto").value,
        destino: op.querySelector(".destino").value,
      }));
      return { id, mensagem, opcoes };
    });
  }
});
function carregarFluxo() {
  const atendente = document.getElementById("atendente").value.trim();
  if (!atendente) {
    alert("Informe o nome do atendente.");
    return;
  }

  fetch(`/fluxo/${atendente}`)
    .then(res => {
      if (!res.ok) throw new Error("Fluxo não encontrado");
      return res.json();
    })
    .then(data => {
      fluxo = data.fluxo;
      contador = fluxo.length + 1; // atualizar o contador
      atualizarVisual();

      // recriar os nós no editor visual (Drawflow)
      if (editor) {
        editor.clear();
        fluxo.forEach((bloco, index) => {
          let htmlNode = `<div style="padding:8px;"><strong>${bloco.tipo}</strong></div>`;
          editor.addNode(
            bloco.tipo,
            1,
            1,
            100 + index * 20,
            100 + index * 10,
            bloco.tipo,
            { id: bloco.id, tipo: bloco.tipo },
            bloco.id,
            htmlNode
          );
        });
      }

      alert("📦 Fluxo carregado com sucesso!");
    })
    .catch(err => {
      console.error(err);
      alert("❌ Fluxo não encontrado ou erro ao carregar.");
    });
}
function salvarFluxo() {
  const atendente = document.getElementById("atendente").value.trim();
  if (!atendente) {
    alert("Informe o nome do atendente.");
    return;
  }

  fetch("/fluxo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ atendente, fluxo })
  })
    .then(res => res.json())
    .then(data => {
      alert("✅ Fluxo salvo com sucesso!");
    })
    .catch(err => {
      console.error(err);
      alert("❌ Erro ao salvar fluxo.");
    });
}
