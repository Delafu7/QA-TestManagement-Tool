const { v4: uuidv4 } = require('uuid');

const newId = () => uuidv4();
const now = () => new Date().toISOString();

module.exports = { newId, now };
