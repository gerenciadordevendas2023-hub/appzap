const express = require('express');
const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

module.exports = (getClient) => {
  const router = express.Router();

  let mensagem = "Olá! Este número foi desativado. Nosso novo número é: (81)7121-3464";
  let imagemPath = path.join(__dirname, '..', 'imagem.png');
  let imagem = null;

  if (fs.existsSync(imagemPath)) {
    imagem = MessageMedia.fromFilePath(imagemPath);
  }

  let enviados = [];
  if (fs.existsSync('enviados.json')) {
    enviados = JSON.parse(fs.readFileSync('enviados.json'));
  }

  let pausado = false;
  let parado = false;
  let intervalo;
  let index = 0;
  let pendentes = [];
  let contatosPorHora = 20;
  let delayEntreMensagens = 5000;

  // função principal de envio
  async function enviarLote(client) {
    if (parado) return;

    if (pendentes.length === 0) {
      const chats = await client.getChats();
      const contatos = chats.filter(chat => !chat.isGroup);
      pendentes = contatos.filter(c => !enviados.includes(c.id._serialized));
    }

    const lote = pendentes.slice(index, index + contatosPorHora);
    for (const contato of lote) {
      while (pausado) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        if (imagem) {
          await client.sendMessage(contato.id._serialized, imagem);
        }
        await client.sendMessage(contato.id._serialized, mensagem);

        enviados.push(contato.id._serialized);
        fs.writeFileSync('enviados.json', JSON.stringify(enviados, null, 2));

        console.log(`📨 Enviado para: ${contato.name || contato.id.user}`);
        await new Promise(resolve => setTimeout(resolve, delayEntreMensagens));
      } catch (err) {
        console.error(`❌ Erro ao enviar para ${contato.id.user}:`, err.message);
      }
    }

    index += contatosPorHora;
    if (index >= pendentes.length) {
      console.log('🎉 Todos os contatos foram atendidos!');
      clearInterval(intervalo);
      intervalo = null;
    }
  }

  // rotas REST
  router.post('/comando', async (req, res) => {
    const client = getClient();
    if (!client) return res.status(400).json({ ok: false, erro: 'Cliente não iniciado.' });

    const { acao } = req.body;
    if (acao === 'pausar') pausado = true;
    if (acao === 'retomar') pausado = false;
    if (acao === 'parar') {
      parado = true;
      clearInterval(intervalo);
    }
    if (acao === 'iniciar') {
      pausado = false;
      parado = false;
      if (!intervalo) {
        await enviarLote(client);
        intervalo = setInterval(() => enviarLote(client), 60 * 60 * 1000);
      }
    }
    res.json({ ok: true, status: `Comando ${acao} executado` });
  });

  router.post('/configurar', (req, res) => {
    const { msg, cph, delay } = req.body;
    if (msg) mensagem = msg;
    if (cph) contatosPorHora = parseInt(cph);
    if (delay) delayEntreMensagens = parseInt(delay);
    res.json({ ok: true, status: 'Configurações atualizadas' });
  });

  router.post('/upload', (req, res) => {
    const { base64 } = req.body;
    const buffer = Buffer.from(base64.split(',')[1], 'base64');
    imagemPath = path.join(__dirname, '..', 'imagem.png');
    fs.writeFileSync(imagemPath, buffer);
    imagem = MessageMedia.fromFilePath(imagemPath);
    res.json({ ok: true, status: 'Imagem atualizada' });
  });

  return router;
};
