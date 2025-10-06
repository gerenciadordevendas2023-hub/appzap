const express = require('express');
const router = express.Router();

module.exports = (getClient, gruposStore, isClientPronto) => {
  // 🚀 Lista os grupos salvos no cache
  router.get('/', (_, res) => {
    const gruposValidos = Array.isArray(gruposStore.lista)
      ? gruposStore.lista.filter(g => g?.id?._serialized && typeof g.name === 'string')
      : [];

    console.log(`📤 [GRUPOS] Enviando ${gruposValidos.length} grupo(s) para o painel.`);
    res.json(gruposValidos.map(g => ({
      id: g.id._serialized,
      nome: g.name
    })));
  });

  // 🔄 Atualiza os grupos no cache (sem exigir participants)
  router.get('/atualizar', async (_, res) => {
    const client = getClient();
    if (!client) {
      return res.status(400).json({ error: 'Bot não está iniciado.' });
    }

    if (!isClientPronto()) {
      return res.status(503).json({ error: 'WhatsApp ainda está carregando. Tente novamente em instantes.' });
    }

    try {
      const chats = await client.getChats();
      const gruposValidos = [];

      for (const chat of chats) {
        if (
          chat?.isGroup &&
          typeof chat.name === 'string' &&
          chat?.id &&
          typeof chat.id._serialized === 'string'
        ) {
          gruposValidos.push(chat);
        } else {
          console.warn('⚠️ [GRUPOS] Ignorado: estrutura inválida ou incompleta', chat?.name || '(sem nome)');
        }
      }

      gruposStore.lista = gruposValidos;

      console.log(`✅ [GRUPOS] Grupos atualizados: ${gruposValidos.length}`);
      res.json({ status: 'Grupos atualizados com sucesso!' });

    } catch (err) {
      console.error('❌ [GRUPOS] Erro ao atualizar grupos:', err.message);
      res.status(500).json({ error: 'Erro ao atualizar grupos do WhatsApp.' });
    }
  });

  // 🧭 Verifica se o cache está pronto para uso
  router.get('/status', (_, res) => {
    const pronto = Array.isArray(gruposStore.lista) && gruposStore.lista.length > 0;
    console.log(`[GRUPOS] Cache ${pronto ? 'pronto' : 'ainda vazio'}.`);
    res.json({ pronto });
  });

  return router;
};
