const request = require('superagent');
const SlackClient = require('@slack/client');

const Bot = require('./src/Bot');
const config = require(process.env.CONFIG_FILE || './config.json');
const bot = new Bot(config);

bot.start();
