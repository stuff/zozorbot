const Message = require('../Message');

describe('Message', () => {
  const bot = {
    self: {
      id: 'BOT_ID',
    },
  }
  const dataProvider = [
    {
      expectedType: Message.DIRECT_MENTION,
      message: { channel: { is_channel: true }, text: '<@BOT_ID> hello' }
    },
    {
      expectedType: Message.DIRECT_MESSAGE,
      message: { channel: {}, text: 'hello' }
    },
    {
      expectedType: Message.MENTION,
      message: { channel: { is_channel: true }, text: 'hello where is <@BOT_ID>?' }
    },
    {
      expectedType: Message.AMBIENT,
      message: { channel: { is_channel: true }, text: 'hello where is foo?' }
    }
  ];

  dataProvider.forEach((data, n) => {
    it(`should have a type of ${data.expectedType} (${n})`, () => {
      const message = new Message(data.message, bot);
      expect(message.getType(data.message)).toEqual(data.expectedType);
    });
  });
});
