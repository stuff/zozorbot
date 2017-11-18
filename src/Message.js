class Message {
  constructor(messageInfo, bot) {
    this._messageInfo = messageInfo;
    this.bot = bot;
  }

  async getInfo() {
    let user = null;
    let channel = { id: this._messageInfo.channel };

    try {
      const channelInfo = await this.bot.web.channels.info(this._messageInfo.channel);
      channel = channelInfo.channel;
    } catch(e) {}

    try {
      const userInfo = await this.bot.web.users.info(this._messageInfo.user);
      user = userInfo.user;
    } catch(e) {}

    const resolvedMessageInfo = Object.assign(this._messageInfo, {
      user,
      channel,
    });

    resolvedMessageInfo.type = this.getType(resolvedMessageInfo);

    return resolvedMessageInfo;
  }

  getType(resolvedMessageInfo) {
    const { channel, text } = resolvedMessageInfo;

    if (!channel.is_channel) {
      return Message.DIRECT_MESSAGE;
    }

    if (this.isBotMention()) {
      return Message.MENTION;
    }

    if (this.isBotDirectMention()) {
      return Message.DIRECT_MENTION;
    }

    return Message.AMBIENT;
  }

  isBotMention() {
    return this.getMentionPosition(this.bot.self.id) > 0;
  }

  isBotDirectMention() {
    return this.getMentionPosition(this.bot.self.id) == 0;
  }

  getMentionPosition(userId) {
    const stringToFind = `<@${userId}>`;
    return this._messageInfo.text.indexOf(stringToFind);
  }
}

Message.MESSAGE_RECEIVED = 'MESSAGE_RECEIVED';
Message.FILE_SHARE = 'FILE_SHARE';
Message.DIRECT_MESSAGE = 'DIRECT_MESSAGE'; // the bot received a direct message from a user
Message.DIRECT_MENTION = 'DIRECT_MENTION'; // the bot was addressed directly in a channel2
Message.MENTION = 'MENTION';        // the bot was mentioned by someone in a message
Message.AMBIENT = 'AMBIENT';        // the message received had no mention of the bot

module.exports = Message;
