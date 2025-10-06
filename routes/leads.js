const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// 🔧 Garante que a pasta uploads exista
const uploadsPath = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
}

let palavrasChaveDinamicas = null;

module.exports = (getClient) => {
  const router = express.Router();

  // 🔍 ANÁLISE DE LEADS POR PALAVRAS-CHAVE E PERÍODO
  router.get('/analisar', async (req, res) => {
    console.log('🚀 [LEADS] Rota /analisar acessada');

    const client = getClient();
    if (!client) {
      return res.status(400).json({ sucesso: false, erro: 'Bot não conectado.' });
    }

    const { dataInicio, dataFim } = req.query;
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ sucesso: false, erro: 'Período inválido.' });
    }

    const inicio = new Date(dataInicio).getTime();
    const fim = new Date(dataFim).getTime() + 24 * 60 * 60 * 1000;

    let chats = [];
    try {
      chats = await client.getChats();
    } catch (err) {
      console.error('❌ Erro ao obter chats:', err.message);
      return res.status(500).json({ sucesso: false, erro: 'Falha ao obter os chats.' });
    }

    const palavras = palavrasChaveDinamicas || {
      'ORÇAMENTO': ['preço', 'valor', 'quanto custa', 'orçamento'],
      'INTERESSE': ['quero', 'interesse', 'me chama', 'curti']
    };

    const resultado = [];

    for (const chat of chats) {
      try {
        if (
          !chat ||
          chat.isGroup ||
          !chat.id?._serialized ||
          typeof chat.name !== 'string'
        ) continue;

        const mensagens = await chat.fetchMessages({ limit: 50 });
        const recentes = mensagens.filter(msg => {
          if (
            !msg ||
            typeof msg.body !== 'string' ||
            !msg.timestamp ||
            msg.fromMe
          ) return false;

          const ts = msg.timestamp * 1000;
          return ts >= inicio && ts <= fim;
        });

        if (recentes.length === 0) continue;

        let categoria = 'NÃO QUALIFICADO';
        let msgEncontrada = '';

        for (const msg of recentes) {
          const texto = msg.body.toLowerCase();

          for (const [cat, lista] of Object.entries(palavras)) {
            if (lista.some(p => texto.includes(p))) {
              categoria = cat;
              msgEncontrada = msg.body;
              break;
            }
          }

          if (categoria !== 'NÃO QUALIFICADO') break;
        }

        resultado.push({
          numero: chat.id.user || chat.id._serialized,
          nome: chat.name,
          categoria,
          mensagem: msgEncontrada || '(sem conteúdo relevante)'
        });
      } catch (err) {
        console.warn(`⚠️ Erro ao processar chat: ${err.message}`);
        continue;
      }
    }

    console.log(`✅ [LEADS] Contatos classificados: ${resultado.length}`);
    res.json({ sucesso: true, resultado });
  });

  // 📄 GERAR PDF DOS RESULTADOS
  router.post('/gerar-pdf', express.json(), async (req, res) => {
    const resultado = req.body.resultado;

    if (!Array.isArray(resultado) || resultado.length === 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Nenhum dado para gerar PDF.' });
    }

    const filePath = path.join(uploadsPath, 'relatorio.pdf');
    const doc = new PDFDocument({ margin: 30 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(18).text('Relatório de Análise de Conversas', { align: 'center' }).moveDown();

    resultado.forEach((item, i) => {
      doc
        .fontSize(12)
        .text(`Contato #${i + 1}`, { underline: true })
        .text(`Número: ${item.numero}`)
        .text(`Nome: ${item.nome}`)
        .text(`Categoria: ${item.categoria}`)
        .text(`Mensagem: ${item.mensagem}`)
        .moveDown();
    });

    doc.end();

    stream.on('finish', () => {
      res.download(filePath, 'relatorio.pdf', err => {
        if (err) console.error('❌ Erro ao enviar PDF:', err);
        fs.unlink(filePath, () => {});
      });
    });
  });

  // 🧠 DEFINIR PALAVRAS-CHAVE DINÂMICAS
  router.post('/palavras-chave', express.json(), (req, res) => {
    if (typeof req.body !== 'object' || !req.body) {
      return res.status(400).json({ erro: 'Formato inválido para palavras-chave.' });
    }

    palavrasChaveDinamicas = req.body;
    console.log('📚 [LEADS] Palavras-chave atualizadas:', palavrasChaveDinamicas);
    res.sendStatus(200);
  });

  return router;
};
