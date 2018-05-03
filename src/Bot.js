const fs = require('fs');
const path_module = require('path');
const SlackClient = require('@slack/client');

// const Channel = require('./Channel');
const Message = require('./Message');

const { WebClient, RtmClient, CLIENT_EVENTS, RTM_EVENTS } = SlackClient;

class Bot {
  constructor(config) {
    this.config = config;

    this.messageCallbacks = [];

    this.rtm = new RtmClient(this.config.bot_token);
    this.web = new WebClient(this.config.bot_token);

    this.rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
      this.availablePublicChannels = rtmStartData.channels.reduce((acc, channel) => {
        if (channel.is_member) {
          acc[channel.name] = channel;
        }
        return acc;
      }, {});

      this.self = rtmStartData.self;
      this.team = rtmStartData.team;
    });

    this.rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
      this.log(`:white_check_mark: I'm alive!`);
    });

    this.rtm.on(RTM_EVENTS.MESSAGE, async (messageInfo) => {
      this.messageCallbacks.forEach((callback) => {
        try {
          callback(new Message(messageInfo, this));
        } catch (e) {
          logError(e.message);
        }
      });
    });

    this.loadBotModules();
  }

  loadBotModules() {
    const path = `${__dirname}/botmodules`;
    const files = fs.readdirSync(path);

    files.forEach((f) => {
      const p = `${path}/${f}`;
      if (f[0] === '_') {
        return;
      }

      const stats = fs.lstatSync(p);
      if (stats.isDirectory()) {
        const Module = require(p);

        const botmodule = new Module(this, Module.id, this.config);

        botmodule.id = Module.id;
        botmodule.init();
      }
    });
  }

  logError(message) {
    // if (!this.availablePublicChannels) {
    //   return;
    // }
    //
    // const channel = this.availablePublicChannels[this.config.bot_log_channel];
    //
    // if (!channel) {
    //   return;
    // }

    this.say(`:exclamation: ${message}`, this.config.bot_log_channel);
  }

  log(message) {
    // if (!this.availablePublicChannels) {
    //   return;
    // }
    //
    // const channel = this.availablePublicChannels[this.config.bot_log_channel];
    //
    // if (!channel) {
    //   return;
    // }

    this.say(`:memo: ${message}`, this.config.bot_log_channel);
  }

  reply(text, message) {
    this.say(text, message.channel);
  }

  // say(message, channel, attachments) {
  //   if (!message || !channel) {
  //     return;
  //   }
  //
  //   if (attachments) {
  //     return this.web.chat.postMessage(channel.id, message, {
  //       as_user: true,
  //       attachments: Array.isArray(attachments) ? attachments : [attachments],
  //     });
  //   } else {
  //     return this.rtm.sendMessage(message, channel.id);
  //   }
  // }

  say(message, channel, attachments) {
    if (!message || !channel) {
      return;
    }

    let channelId;

    if (typeof channel === 'string' && this.availablePublicChannels) {
      channelId = this.availablePublicChannels[channel].id;
    } else {
      channelId = channel.id;
    }

    if (!channelId) {
      return;
    }

    if (attachments) {
      return this.web.chat.postMessage(channelId, message, {
        as_user: true,
        attachments: Array.isArray(attachments) ? attachments : [attachments],
      });
    } else {
      return this.rtm.sendMessage(message, channelId);
    }
  }

  addMessageListener(callback) {
    this.messageCallbacks.push(callback);
  }

  start() {
    this.rtm.start();
  }
}

module.exports = Bot;
