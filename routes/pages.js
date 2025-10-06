const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

router.get('/login.html', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

router.get('/dashboard.html', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

module.exports = router;
