const SlackClient = require('@slack/client');

const Message = require('../Message');

class Botmodule {
  constructor(bot, config = {}) {
    this.bot = bot;
    this.config = config;

    this.channels = this.config.channel ? this.config.channel.split(',') : '*';
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

      if (this.channels !== '*' && !this.channels.includes(messageInfo.channel.name)) {
        return;
      }

      if (!text) {
        return;
      }

      const dispatchEvent = typeFilters.includes(messageInfo.type) ||
                            typeFilters.includes(Message.MESSAGE_RECEIVED) ||
                            typeFilters.includes(Message.FILE_SHARE) && messageInfo.subtype === 'file_share';

      if (!dispatchEvent) {
        return;
      }

      // if (typeFilters && !typeFilters.includes(messageInfo.type) && (typeFilters[0] !== Message.MESSAGE_RECEIVED)) {
      //   return;
      // }

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
