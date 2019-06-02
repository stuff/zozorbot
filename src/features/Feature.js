const cron = require('node-cron');
const cronstrue = require('cronstrue');

class Feature {
  constructor(controller, bot, config, name) {
    this.controller = controller;
    this.name = name;
    this.config = config[this.name.toLowerCase()];
    this.globalConfig = config;
    this.bot = bot;
  }

  async start() {
    await this.log(`:robot_face: *${this.name}* Feature loaded.`);
  }

  async schedule(cronExpression, taskFunction) {
    cron.schedule(cronExpression, taskFunction);

    await this.log(`:stopwatch: *${this.name}* Feature added cron (${cronstrue.toString(cronExpression)}).`);
  }

  async log(message) {
    await this.bot.say({
      text: `:memo: ${message}`,
      channel: this.globalConfig.bot_log_channel,
    });
  }

  help() {
    return { name: this.name };
  }
}

module.exports = Feature;
