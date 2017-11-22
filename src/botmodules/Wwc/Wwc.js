const request = require('superagent');

const Botmodule = require('../Botmodule');
const Message = require('../../Message');

class Wwc extends Botmodule {
  init() {
    this.on(Message.FILE_SHARE, async (bot, message) => {
      const { file } = message;

      if (file.filetype !== 'space') {
        return;
      }

      const endpoint = this.moduleConfig.add_slackpost_endpoint;
      const body = {
        userEmail: message.user.profile.email,
        postUrl: message.file.permalink,
        createdAt: Date.now(),
      };

      if (!this.config.isProduction) {
        bot.log(endpoint);
        bot.log(JSON.stringify(body, null, 4));
        return;
      }

      try {
        const res = await request
          .post(endpoint)
          .send(body)
          .set('Accept', 'application/json');

        if (res.err) {
          throw res.err;
        }

        bot.reply(`Congratulations! ${res.body.points} more points for your team!`, message);

      } catch(e) {
        bot.logError(e.message);
      }
    });
  }
}

Wwc.id = 'wwc';

module.exports = Wwc;
