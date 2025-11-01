const axios = require('axios');
const { api_url } = require('./config');

// Axios instance centralizada para padronizar baseURL e headers
const http = axios.create({
  baseURL: api_url,
  headers: { 'Content-Type': 'application/json' },
  maxBodyLength: Infinity,
});

module.exports = http;

