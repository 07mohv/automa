const path = require('path');
const { loadEsm } = require('./load-esm');

module.exports = loadEsm(path.join(__dirname, '../src/utils/agentInspect.js'));
