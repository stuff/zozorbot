const request = require('superagent');
const SlackClient = require('@slack/client');

const Bot = require('./src/Bot');
const isProduction = process.env.NODE_ENV === 'production';

const config = require(isProduction ? './config.json' : './config.dev.json');
config.isProduction = isProduction;

const bot = new Bot(config);

bot.start();
