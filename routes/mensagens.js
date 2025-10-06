const express = require('express');
const fs = require('fs');
const multer = require('multer');
const { MessageMedia } = require('whatsapp-web.js');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const upload = multer({ dest: 'uploads/' });

module.exports = (getClient, isAtivo) => {
  const router = express.Router();

  router.post('/', upload.single('media'), async (req, res) => {
    const { grupoId, texto, comMentions, legenda } = req.body;

    try {
      const client = getClient();
      if (!isAtivo()) return res.status(403).send({ error: 'Bot está desligado.' });
      if (!grupoId || !grupoId.includes('@')) return res.status(400).send({ error: 'ID de grupo inválido.' });

      let chat;
try {
  chat = await client.getChatById(grupoId);
} catch (err) {
  return res.status(404).send({ error: 'Grupo não encontrado.' });
}

if (!chat?.isGroup || !Array.isArray(chat.participants)) {
  return res.status(400).send({ error: 'Grupo inválido ou sem participantes.' });
}


      if (!chat || !Array.isArray(chat.participants)) {
        return res.status(404).send({ error: 'Grupo não disponível ou incompleto.' });
      }

      const mensagemTexto = (texto || legenda || '').trim();
      let mentions = [];

      try {
        mentions = chat.participants
          .filter(p => p?.id && typeof p.id._serialized === 'string')
          .map(p => p.id._serialized);
      } catch {
        mentions = [];
      }

      const enviarMedia = async (filePath, mimeType, nomeOriginal) => {
        if (!fs.existsSync(filePath)) return { error: 'Arquivo não encontrado.' };

        const stats = fs.statSync(filePath);
        if (stats.size > 16 * 1024 * 1024) {
          fs.unlinkSync(filePath);
          return { error: 'Arquivo excede 16MB.' };
        }

        const raw = fs.readFileSync(filePath);
        const base64 = Buffer.isBuffer(raw) ? raw.toString('base64') : '';
        const media = new MessageMedia(mimeType, base64, nomeOriginal);

        const tentativas = [
          { caption: mensagemTexto, mentions: comMentions === 'true' ? mentions : [] },
          { caption: mensagemTexto },
          {}
        ];

        for (let i = 0; i < tentativas.length; i++) {
          try {
            await chat.sendMessage(media, tentativas[i]);
            fs.unlinkSync(filePath);
            return { status: '✅ Enviado (tentativa ' + (i + 1) + ')' };
          } catch (err) {
            console.warn(`⚠️ Tentativa ${i + 1} falhou:`, err.message);
          }
        }

        fs.unlinkSync(filePath);
        return { error: 'Todas as tentativas falharam.' };
      };

      if (req.file) {
        const inputPath = req.file.path;
        const mimeType = req.file.mimetype;

        if (mimeType.startsWith('video/')) {
          const outputPath = inputPath + '_convertido.mp4';
          ffmpeg(inputPath)
            .outputOptions(['-preset fast', '-crf 28', '-vf scale=640:-2', '-c:v libx264', '-c:a aac'])
            .on('end', async () => {
              const result = await enviarMedia(outputPath, 'video/mp4', req.file.originalname);
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
              if (result.error) return res.status(500).send({ error: result.error });
              res.send({ status: result.status });
            })
            .on('error', err => {
              fs.unlinkSync(inputPath);
              res.status(500).send({ error: 'Erro ao converter vídeo.' });
            })
            .save(outputPath);
        } else {
          const result = await enviarMedia(inputPath, mimeType, req.file.originalname);
          if (result.error) return res.status(500).send({ error: result.error });
          res.send({ status: result.status });
        }
      } else {
        try {
          const opcoesEnvio = {};
          if (comMentions === 'true' && mentions.length > 0) opcoesEnvio.mentions = mentions;

          await chat.sendMessage(mensagemTexto, opcoesEnvio);
          res.send({ status: '✅ Mensagem enviada com sucesso.' });
        } catch (err) {
          console.error('❌ Erro ao enviar mensagem de texto:', err.message);
          res.status(500).send({ error: 'Erro ao enviar mensagem de texto.' });
        }
      }

    } catch (err) {
      console.error('❌ Erro inesperado ao enviar:', err.message);
      res.status(500).send({ error: 'Erro inesperado ao enviar mensagem.' });
    }
  });

  return router;
};
