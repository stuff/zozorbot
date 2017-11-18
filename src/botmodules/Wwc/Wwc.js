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

      try {
        const res = await request
          .post(this.config.add_slackpost_endpoint)
          .send({
            userEmail: message.user.profile.email,
            postUrl: message.file.permalink,
            createdAt: Date.now(),
          })
          .set('Accept', 'application/json');

        if (res.err) {
          throw res.err;
        }

        bot.reply(`Congratulations! You made 5 points for your team!`, message);

      } catch(e) {
        console.log(e);
      }
    });
  }
}

Wwc.id = 'wwc';

module.exports = Wwc;
