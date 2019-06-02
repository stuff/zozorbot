const isProduction = process.env.NODE_ENV === 'production';
const config = require(isProduction ? '../config.json' : '../config.dev.json');
config.isProduction = isProduction;

module.exports = config;
