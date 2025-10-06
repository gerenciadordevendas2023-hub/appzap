const express = require('express');
module.exports = (getClient, isClientPronto) => {
  const router = express.Router();

  router.get('/diagnostico-grupos', async (req, res) => {
    try {
      const client = getClient();
      if (!client) {
        return res.status(400).json({ error: 'Bot não está conectado.' });
      }
      if (!isClientPronto()) {
  return res.status(503).json({ error: 'Bot ainda está carregando. Aguarde alguns segundos.' });
}


      let chats = [];
try {
  chats = await client.getChats();
} catch (err) {
  console.error('❌ [GRUPOS] Erro ao obter chats:', err.message);
  return res.status(500).json({ error: 'Erro ao buscar os chats do WhatsApp.' });
}

      const resultado = [];

      for (const chat of chats) {
        try {
          if (
            !chat?.isGroup ||
            !chat?.id ||
            typeof chat.id._serialized !== 'string'
          ) continue;

          const possuiNomeValido = typeof chat.name === 'string' && chat.name.length > 0;
          const possuiParticipants = Array.isArray(chat.participants);

          const grupoInfo = {
            nome: possuiNomeValido ? chat.name : '(sem nome)',
            id: chat.id._serialized,
            possuiIdValido: true,
            possuiNomeValido,
            possuiParticipants,
            totalParticipants: possuiParticipants ? chat.participants.length : 0,
            participantsValidos: 0,
            participantsInvalidos: 0
          };

          if (possuiParticipants) {
            for (const p of chat.participants) {
              if (p?.id && typeof p.id._serialized === 'string') {
                grupoInfo.participantsValidos++;
              } else {
                grupoInfo.participantsInvalidos++;
              }
            }
          }

          resultado.push(grupoInfo);
        } catch (err) {
          console.warn('⚠️ Grupo ignorado por erro inesperado:', err.message);
          continue;
        }
      }

      console.log(`🔍 Diagnóstico concluído: ${resultado.length} grupo(s) processados`);
      res.json(resultado);

    } catch (err) {
      console.error('❌ Erro geral na rota de diagnóstico:', err.message);
      res.status(500).json({ error: 'Erro interno ao executar diagnóstico.' });
    }
  });

  return router;
};
