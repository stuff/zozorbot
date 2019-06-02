const request = require('superagent');

const Botmodule = require('../Botmodule');
const Message = require('../../Message');

class Wwc extends Botmodule {
  init() {
    this.on(Message.AMBIENT, async (bot, message) => {
      const file = message.files[0];

      if (file.filetype !== 'space') {
        return;
      }

      const endpoint = this.moduleConfig.add_slackpost_endpoint;
      const body = {
        userEmail: message.user.profile.email,
        postUrl: file.permalink,
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

        bot.reply(`Congratulations! ${res.body.points} more ${(res.body.points > 1) ? 'points' : 'point' } for your team!`, message);

      } catch(e) {
        if (e.status === 409) {
          bot.reply(`Nice! But this content was already posted! No more points!`, message);
          return;
        }
        bot.logError(e.message);
      }
    });
  }
}

Wwc.id = 'wwc';

module.exports = Wwc;
