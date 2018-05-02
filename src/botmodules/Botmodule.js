const SlackClient = require('@slack/client');

const Message = require('../Message');

const { CLIENT_EVENTS } = SlackClient;

class Botmodule {
  constructor(bot, id, config = {}) {
    this.bot = bot;
    this.config = config;
    this.moduleConfig = config[id];

    this.channels = this.moduleConfig.channel ? this.moduleConfig.channel.split(',') : '*';

    this.bot.rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
      this.bot.log(`:robot_face: *${this.id}* Botmodule loaded.`);
    });
  }

  on(messageType, callback) {
    this.hears('.*', [messageType], callback);
  }

  hears(regexStrings, typeFilters, callback) {
    if (!callback && typeof typeFilters === 'function') {
      callback = typeFilters;
      typeFilters = null;
    }

    if (typeof regexStrings === 'string') {
      regexStrings = [regexStrings];
    }

    if (!typeFilters) {
      typeFilters = [Message.MESSAGE_RECEIVED];
    }

    this.bot.addMessageListener(async (message) => {
      const messageInfo = await message.getInfo();
      const { text } = messageInfo;

      if ((this.channels !== '*' && !this.channels.includes(messageInfo.channel.name))) {
        return;
      }

      if (!text) {
        return;
      }

      if (this.config.jail_channel && messageInfo.channel.name !== this.config.jail_channel) {
        return;
      }

      const dispatchEvent = typeFilters.includes(messageInfo.type) ||
                            typeFilters.includes(Message.MESSAGE_RECEIVED) ||
                            typeFilters.includes(Message.FILE_SHARE) && messageInfo.subtype === 'file_share';

      if (!dispatchEvent) {
        return;
      }

      let firstMatch = null;
      const isMatching = regexStrings.every((regexString, n) => {
        const reg = new RegExp(regexString);
        const match = text.match(reg);
        if (n === 0) {
          firstMatch = match;
        }

        return match;
      });

      if (!isMatching) {
        return;
      }

      messageInfo.match = firstMatch;

      callback(this.bot, messageInfo);
    });
  }
}

module.exports = Botmodule;
