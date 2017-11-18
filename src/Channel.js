class Channel {
  constructor(channelInfo) {
    this.channelInfo = channelInfo;
  }

  getId() {
    return this.channelInfo.id;
  }

  getName() {
    return this.channelInfo.name;
  }
}

module.exports = Channel;
