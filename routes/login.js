const express = require('express');
const { toDataURL } = require('qrcode');
const router = express.Router();

module.exports = (getClient) => {
  const clients = new Set();

  // Instala listeners seguros no client
  function instalarListeners(client) {
    client.removeAllListeners('qr');
    client.removeAllListeners('ready');
    client.removeAllListeners('disconnected');

    client.on('qr', async (qr) => {
      try {
        const qrImage = await toDataURL(qr);
        for (const res of clients) {
          res.write(`data: ${qrImage}\n\n`);
        }
      } catch (err) {
        console.error('Erro ao gerar QR Code base64:', err);
      }
    });

    client.on('ready', async () => {
      try {
        const chats = await client.getChats(); // verifica se tudo está ok
        if (!Array.isArray(chats)) throw new Error('Chats inválidos');

        for (const res of clients) {
          res.write(`data: ready\n\n`);
        }
      } catch (err) {
        console.error('❌ Erro ao carregar chats no login:', err.message);
        for (const res of clients) {
          res.write(`data: erro|${err.message}\n\n`);
        }
      }
    });

    client.on('disconnected', () => {
      for (const res of clients) {
        res.write(`data: aguardando\n\n`);
      }
      console.log('[LOGIN] Cliente desconectado');
    });
  }

  router.get('/', (req, res) => {
    const client = getClient();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    clients.add(res);

    req.on('close', () => {
      clients.delete(res);
    });

    if (!client) {
      res.write(`data: aguardando\n\n`);
      return;
    }

    instalarListeners(client);

    if (client.info) {
      res.write(`data: aguardando\n\n`); // ele está pronto, mas queremos checar se getChats funciona
    } else {
      res.write(`data: aguardando\n\n`);
    }
  });

  return router;
};
