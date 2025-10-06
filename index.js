const express = require('express');
const app = express();
const port = 3000;




// Dependências do WhatsApp
const qrcodeTerminal = require('qrcode-terminal');
const rimraf = require('rimraf');
const { Client, LocalAuth } = require('whatsapp-web.js');

require('dotenv').config();
console.log('🔑 HF_API_TOKEN:', process.env.HF_API_TOKEN);

let client = null;
let clientPronto = false;
let botAtivo = false;
const gruposStore = { lista: [] };

// Funções utilitárias para WhatsApp principal
function limparSessao() {
  return new Promise((resolve, reject) => {
    rimraf('./.wwebjs_auth', err => {
      if (err) return reject(err);
      rimraf('./.wwebjs_cache', err2 => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}

function criarClient() {
  console.log('\n🚀 [SERVER] Criando novo cliente WhatsApp PRINCIPAL...\n');
  client = new Client({ authStrategy: new LocalAuth() });
  gruposStore.lista = [];
  clientPronto = false;
  botAtivo = true;

  client.on('qr', qr => {
    console.log('📱 [CLIENT] QR Code gerado (cliente principal). Escaneie com o celular!');
    qrcodeTerminal.generate(qr, { small: true });
  });

  client.on('ready', async () => {
    console.log('✅ [CLIENT] Cliente principal conectado!');
    clientPronto = true;

    try {
      const chats = await client.getChats();
      const gruposValidos = chats.filter(c => c?.isGroup && c?.id?._serialized && c?.name);
      gruposStore.lista = gruposValidos;
      console.log(`📦 ${gruposValidos.length} grupo(s) em cache.`);
    } catch (err) {
      console.error('❌ Erro ao carregar grupos:', err.message);
    }
  });

  // ❌ Removida lógica de fluxos aqui
  // Agora toda a parte de chatbot multi-número está em routes/chatbot.js

  client.on('disconnected', reason => {
    console.warn(`⚠️ Cliente principal desconectado: ${reason}`);
    clientPronto = false;
    botAtivo = false;
  });

  client.initialize();
}

function desligarBot() {
  if (client) {
    client.destroy();
    clientPronto = false;
    botAtivo = false;
  }
}

function isAtivo() {
  return botAtivo;
}

function getClient() {
  return client;
}

function ligarBot() {
  if (!botAtivo) criarClient();
}

// Middlewares
app.use(express.json());
app.use(express.static('public'));

// Importar rotas
const diagnosticoRoute = require('./routes/diagnostico');
const pagesRoute = require('./routes/pages');
const loginRoute = require('./routes/login');
const disparosRoute = require('./routes/disparos')(getClient);
const botRoute = require('./routes/bot');
const gruposRoute = require('./routes/grupos');
const mensagemRoute = require('./routes/mensagens');
const leadsRoute = require('./routes/leads');
const chatbotRoute = require('./routes/chatbot'); // 🔗 NOVO CHATBOT

// Usar rotas
app.use('/chatbot', chatbotRoute); // 🔗 nova rota multi-número
app.use('/', diagnosticoRoute(getClient, () => clientPronto));
app.use('/', pagesRoute);
app.use('/login', loginRoute(() => client));
app.use('/bot', botRoute(ligarBot, desligarBot, criarClient, getClient, isAtivo, () => clientPronto, limparSessao));
app.use('/grupos', gruposRoute(getClient, gruposStore, () => clientPronto));
app.use('/mensagem', mensagemRoute(getClient, isAtivo, () => clientPronto));
app.use('/leads', leadsRoute(getClient, () => clientPronto));
app.use('/disparos', disparosRoute);
// Inicia automaticamente o cliente principal
ligarBot();

// Start do servidor
app.listen(port, () => {
  console.log(`🟢 Servidor rodando em http://localhost:${port}\n`);
});
