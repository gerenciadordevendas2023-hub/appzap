const express = require('express');

module.exports = (ligarBot, desligarBot, recriarClient, getClient, isAtivo, isClientPronto) => {
  const router = express.Router();

  // 🚀 Liga o bot manualmente
  router.post('/ligar', (_, res) => {
    try {
      if (isAtivo()) {
        return res.status(200).json({ status: 'Bot já está ligado.' });
      }

      ligarBot(); // já recria o client internamente

      console.log('🟢 [BOT] Bot ativado manualmente.');
      res.status(200).json({ status: 'Bot ativado com sucesso.' });
    } catch (err) {
      console.error('❌ [BOT] Erro ao ativar bot:', err.message);
      res.status(500).json({ error: 'Erro ao ligar o bot.' });
    }
  });

  // ⛔ Desliga o bot manualmente
  router.post('/desligar', (_, res) => {
    try {
      if (!isAtivo()) {
        return res.status(200).json({ status: 'Bot já está desligado.' });
      }

      desligarBot();
      console.log('🔴 [BOT] Bot desligado manualmente.');
      res.status(200).json({ status: 'Bot desligado com sucesso.' });
    } catch (err) {
      console.error('❌ [BOT] Erro ao desligar bot:', err.message);
      res.status(500).json({ error: 'Erro ao desligar o bot.' });
    }
  });

  // 📊 Consulta status do bot e do client
  router.get('/status', async (_, res) => {
    try {
      const client = getClient();
      const conectado = client?.info?.wid ? true : false;
      res.status(200).json({
        botAtivo: isAtivo(),
        clientConectado: conectado
      });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao consultar status do bot.' });
    }
  });

  // 🔓 Rota de logout (apaga a sessão e redireciona)
  router.post('/logout', async (_, res) => {
  console.log('[ROTA LOGOUT] Requisição recebida');
  try {
    const client = getClient();
    
    if (client && client.info?.wid) {
      await client.logout();
      console.log('[ROTA LOGOUT] Logout realizado com sucesso.');
    } else {
      console.log('[ROTA LOGOUT] Client já estava desconectado.');
    }

    desligarBot();     // destrói
    setTimeout(() => { // recria após curto delay
      console.log('[ROTA LOGOUT] Recriando cliente...');
      ligarBot(); // importante: cria novo client
    }, 1000);

    res.status(200).json({ status: 'Logout realizado. QR será necessário novamente.' });

  } catch (err) {
    console.error('Erro ao fazer logout:', err.message);
    res.status(500).json({ error: 'Erro ao realizar logout.' });
  }
});

  return router;
};
