function formatDate(date = new Date()) {
  return date.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19);
}

module.exports = {
  formatDate,
  getCurrentFormattedDate: formatDate,
  // Compatibilidade temporária com consumidores do nome antigo.
  getCurrentFormatedDate: formatDate,
};
