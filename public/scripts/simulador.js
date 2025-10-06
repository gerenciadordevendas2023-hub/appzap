const botaoToggle = document.getElementById('simulador-toggle');
const simulador = document.getElementById('simulador');
const areaMensagens = document.getElementById('area-mensagens');
const entradaUsuario = document.getElementById('entrada-usuario');
const botaoEnviar = document.getElementById('enviar-mensagem');
const botaoResetar = document.getElementById('resetar-fluxo');
const botaoMinimizar = document.getElementById('minimizar-simulador');
const botaoLimparChat = document.getElementById('limpar-chat');

let fluxoDados = null;
let fluxoAtual = null; // nó atual em execução
let variaveis = {}; // variáveis para armazenar respostas do usuário

// Abrir/fechar simulador
botaoToggle.addEventListener('click', () => {
  simulador.classList.toggle('hidden');
});

// Limpar chat
botaoLimparChat.addEventListener('click', () => {
  areaMensagens.innerHTML = '';
});

// Minimizar simulador (esconde, mas mantém aberto no background)
botaoMinimizar.addEventListener('click', () => {
  simulador.style.display = 'none';
  botaoToggle.style.display = 'block';
});

// Resetar fluxo
botaoResetar.addEventListener('click', () => {
  variaveis = {};
  fluxoAtual = null;
  areaMensagens.innerHTML = '';
  alert('Fluxo resetado.');
});

// Iniciar fluxo (botão da sidebar)
document.getElementById('iniciarFluxo').addEventListener('click', () => {
  const data = localStorage.getItem('fluxo');
  if (!data) {
    alert('Nenhum fluxo salvo encontrado.');
    return;
  }
  fluxoDados = JSON.parse(data);
  fluxoAtual = encontrarNoInicial(fluxoDados);
  if (!fluxoAtual) {
    alert('Não foi possível encontrar o nó inicial para iniciar o fluxo.');
    return;
  }

  areaMensagens.innerHTML = '';
  variaveis = {};
  simulador.classList.remove('hidden');
  botaoToggle.style.display = 'none';

  executarFluxo(fluxoAtual);
});

// Encontrar nó inicial (exemplo: primeiro nó do array)
function encontrarNoInicial(fluxo) {
  if (!fluxo || !fluxo.drawflow || !fluxo.drawflow.Home || !fluxo.drawflow.Home.data) return null;
  const nos = Object.values(fluxo.drawflow.Home.data);
  if (nos.length === 0) return null;
  // Procurar primeiro nó tipo mensagem_texto para começar (ajuste conforme necessário)
  for (const no of nos) {
    if (no.name === 'mensagem_texto' || no.name === 'finalizar') return no;
  }
  return nos[0];
}

// Executar o fluxo a partir do nó atual
function executarFluxo(no) {
  if (!no) return;

  // Mostrar a mensagem se houver
  if (no.data && no.data.mensagem) {
    adicionarMensagemBot(no.data.mensagem);
  } else if (no.data && no.data.pergunta) {
    adicionarMensagemBot(no.data.pergunta);
  } else {
    adicionarMensagemBot(`Executando nó tipo: ${no.name}`);
  }

  fluxoAtual = no;
  // Espera a entrada do usuário se for input_usuario, senão vai para próximo
  if (no.name === 'input_usuario') {
    esperarEntradaUsuario(no);
  } else {
    // Se não tem saída (finalizar), para
    if (!no.outputs || Object.keys(no.outputs).length === 0) return;
    // Pega o primeiro nó conectado na saída 1
    const proxConexao = no.outputs[1] && no.outputs[1][0] && no.outputs[1][0].node;
    if (proxConexao) {
      // Busca o próximo nó no fluxoDados pelo id
      const proximoNo = encontrarNoPorId(proxConexao);
      setTimeout(() => executarFluxo(proximoNo), 1000);
    }
  }
}

function esperarEntradaUsuario(no) {
  entradaUsuario.disabled = false;
  botaoEnviar.disabled = false;
  entradaUsuario.focus();

  botaoEnviar.onclick = () => {
    const resposta = entradaUsuario.value.trim();
    if (!resposta) return;

    adicionarMensagemUsuario(resposta);
    entradaUsuario.value = '';
    entradaUsuario.disabled = true;
    botaoEnviar.disabled = true;

    // Armazena a resposta na variável definida no nó
    if (no.data && no.data.variavel) {
      variaveis[no.data.variavel] = resposta;
    }

    // Vai para próximo nó conectado
    if (!no.outputs || Object.keys(no.outputs).length === 0) return;

    const proxConexao = no.outputs[1] && no.outputs[1][0] && no.outputs[1][0].node;
    if (proxConexao) {
      const proximoNo = encontrarNoPorId(proxConexao);
      setTimeout(() => executarFluxo(proximoNo), 500);
    }
  };
}

function adicionarMensagemBot(msg) {
  const div = document.createElement('div');
  div.className = 'mensagem-bot';
  div.textContent = msg;
  areaMensagens.appendChild(div);
  areaMensagens.scrollTop = areaMensagens.scrollHeight;
}

function adicionarMensagemUsuario(msg) {
  const div = document.createElement('div');
  div.className = 'mensagem-usuario';
  div.textContent = msg;
  areaMensagens.appendChild(div);
  areaMensagens.scrollTop = areaMensagens.scrollHeight;
}

function encontrarNoPorId(id) {
  if (!fluxoDados || !fluxoDados.drawflow || !fluxoDados.drawflow.Home || !fluxoDados.drawflow.Home.data) return null;
  const nos = fluxoDados.drawflow.Home.data;
  return Object.values(nos).find(no => no.id == id);
}
