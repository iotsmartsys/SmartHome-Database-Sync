const axios = require('axios');
const { api_url, api_key, api_authorization } = require('./config');

// Axios instance centralizada para padronizar baseURL e headers
const http = axios.create({
  baseURL: api_url,
  headers: { 
    'x-api-key': api_key,
    'Content-Type': 'application/json',
    'Authorization': api_authorization
  },
  maxBodyLength: Infinity,
});

module.exports = http;

