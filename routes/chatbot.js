const express = require('express');
const router = express.Router();
const { Client, LocalAuth, Buttons } = require('whatsapp-web.js');
const chatbotManager = require('../services/chatbotManager');

const clients = {};           // instâncias dos bots
const sseConnections = {};    // conexões SSE
const progressoUsuarios = {}; // progresso por usuário e número

function getKey(numero, remetente) {
  return `${numero}:${remetente}`;
}

// 🔌 Rota SSE para QR Code
router.get('/qr-code-sse/:numero', (req, res) => {
  const numero = req.params.numero;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sseConnections[numero] = res;

  if (!clients[numero]) {
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: numero })
    });
    clients[numero] = client;

    client.on('qr', qr => {
      const conn = sseConnections[numero];
      if (conn) {
        conn.write(`event: qr\n`);
        conn.write(`data: ${qr}\n\n`);
      }
    });

    client.on('ready', () => {
      const conn = sseConnections[numero];
      if (conn) {
        conn.write(`event: ready\n`);
        conn.write(`data: Conectado\n\n`);
      }
    });

    client.on('disconnected', reason => {
      const conn = sseConnections[numero];
      if (conn) {
        conn.write(`event: disconnected\n`);
        conn.write(`data: ${reason}\n\n`);
      }
      delete clients[numero];
    });

    // 🎯 Lógica do fluxo de atendimento
    client.on('message', async msg => {
      try {
        const fluxoAtivo = chatbotManager.getFluxoAtivo(numero);
        if (!fluxoAtivo) return;

        const fluxo = chatbotManager.getFluxo(numero, fluxoAtivo);
        if (!fluxo || !fluxo.passos) return;

        const remetente = msg.from;
        const texto = msg.body.trim().toLowerCase();
        const key = getKey(numero, remetente);

        // 🔎 Se usuário mandar "oi" → inicia no bloco-0
        if (texto === 'oi') {
          progressoUsuarios[key] = 'bloco-0';
          const passoInicial = fluxo.passos['bloco-0'];

          if (passoInicial) {
            if (passoInicial.opcoes && passoInicial.opcoes.length > 0) {
              const botoes = passoInicial.opcoes.map(op => ({ body: op.texto }));

              const mensagemComBotoes = new Buttons(
                passoInicial.mensagem,
                botoes,
                'Menu',
                'Selecione abaixo'
              );

              await client.sendMessage(remetente, mensagemComBotoes);
            } else {
              await client.sendMessage(remetente, passoInicial.mensagem);
            }
          }
          return; // sai daqui, não executa o resto
        }

        // Continua fluxo normal
        let passoAtual = progressoUsuarios[key] || 'bloco-0';
        let dadosPasso = fluxo.passos[passoAtual];

        if (!dadosPasso) {
          progressoUsuarios[key] = 'bloco-0';
          dadosPasso = fluxo.passos['bloco-0'];
        }

        // 🔎 Verificar se usuário escolheu uma opção válida
        if (dadosPasso.opcoes && dadosPasso.opcoes.length > 0) {
          const opcaoEscolhida = dadosPasso.opcoes.find(
            op => op.texto.toLowerCase() === texto
          );

          if (opcaoEscolhida) {
            progressoUsuarios[key] = opcaoEscolhida.destino;
            dadosPasso = fluxo.passos[progressoUsuarios[key]];
          } else {
            // Entrada inválida → repete passo
            await client.sendMessage(remetente, "❌ Não entendi. Use os botões abaixo:");
          }
        }

        // 📤 Enviar mensagem do passo atual
        if (dadosPasso && dadosPasso.mensagem) {
          if (dadosPasso.opcoes && dadosPasso.opcoes.length > 0) {
            const botoes = dadosPasso.opcoes.map(op => ({ body: op.texto }));

            const mensagemComBotoes = new Buttons(
              dadosPasso.mensagem,
              botoes,
              'Menu',
              'Selecione abaixo'
            );

            await client.sendMessage(remetente, mensagemComBotoes);
          } else {
            await client.sendMessage(remetente, dadosPasso.mensagem);
          }
        }
      } catch (err) {
        console.error(`Erro ao processar mensagem no número ${numero}:`, err);
      }
    });

    client.initialize();
  }
});

// 📥 Salvar fluxo
router.post('/salvar', (req, res) => {
  const { numero, nomeFluxo, fluxo } = req.body;
  const sucesso = chatbotManager.setFluxo(numero, nomeFluxo, fluxo);
  if (sucesso) {
    res.json({ ok: true, mensagem: 'Fluxo salvo com sucesso!' });
  } else {
    res.status(400).json({ ok: false, erro: 'Não foi possível salvar o fluxo.' });
  }
});

// 📤 Carregar fluxo
router.get('/carregar', (req, res) => {
  const { numero, nomeFluxo } = req.query;
  const fluxo = chatbotManager.getFluxo(numero, nomeFluxo);
  if (fluxo) {
    res.json({ fluxo: fluxo.passos });
  } else {
    res.status(404).json({ erro: 'Fluxo não encontrado.' });
  }
});

// 🛑 Parar fluxo (desconectar cliente)
router.post('/parar-fluxo', (req, res) => {
  const { numero } = req.body;
  if (clients[numero]) {
    clients[numero].destroy();
    delete clients[numero];
    if (sseConnections[numero]) {
      sseConnections[numero].end();
      delete sseConnections[numero];
    }
    res.json({ ok: true, mensagem: 'Cliente desconectado.' });
  } else {
    res.status(404).json({ ok: false, erro: 'Cliente não encontrado.' });
  }
});

// 🗑️ Apagar fluxo salvo
router.post('/apagar-fluxo', (req, res) => {
  const { numero } = req.body;
  const file = require('path').join(__dirname, '..', 'fluxos', `${numero}.json`);
  if (require('fs').existsSync(file)) {
    require('fs').unlinkSync(file);
  }
  if (clients[numero]) {
    clients[numero].destroy();
    delete clients[numero];
  }
  if (sseConnections[numero]) {
    sseConnections[numero].end();
    delete sseConnections[numero];
  }
  res.json({ ok: true, mensagem: 'Fluxo apagado e cliente desconectado.' });
});

module.exports = router;
