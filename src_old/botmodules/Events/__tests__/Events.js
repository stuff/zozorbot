const Events = require('../Events');

jest.mock('superagent', () => {
  const fs = require('fs-extra');

  return {
    async get(url) {
      const text = await fs.readFile(url, 'utf8');
      return { text };
    }
  }
});

class BotMock {
  constructor() {
    this.rtm = { on: jest.fn() };
    this.log = jest.fn();
    this.addMessageListener = jest.fn();
    this.say = jest.fn();
  }
}

describe('Events', () => {
  let botMock;
  let peopleEvents;

  beforeEach(async () => {
    botMock = new BotMock();
    peopleEvents = new Events(botMock, 'Event-test', {
      'Event-test': {
        "channel": "testbot,testbot",
        "ics": [
          {
            "name": "student success",
            "url": "./src/botmodules/Events/__tests__/ics-test.ics",
            "remote_workers_attendance": ["./src/botmodules/Events/__tests__/there.ics"],
            "target_channel": "test-channel",
          },
          {
            "name": "tech",
            "url": "./src/botmodules/Events/__tests__/ics-test.ics",
            "target_channel": "test-tech-channel",
          },
        ]
      }
    });

    await peopleEvents.init();
  });

  it('should add full remote workers attendance in the event list', async () => {
    const remoteWorkers = peopleEvents.events.filter(event => event.who === 'Stéphane S');
    expect(remoteWorkers.length).toEqual(7);
  });

  it('should keep a list of remote workers, per target_channel', async () => {
    expect(peopleEvents.remoteWorkers['test-channel']).toEqual(['Stéphane S']);
  });

  it('should dynamically add remote workers in the remote list when saying events', async () => {
    peopleEvents.sayEvents('test-channel', new Date('2018-09-24'), { remote: true });
    const [message, channel] = botMock.say.mock.calls[1];

    expect(message).toEqual(':house_with_garden: Stéphane S');
    expect(channel).toEqual('test-channel');
  });

  it('should NOT dynamically add remote workers in the remote list when saying events', async () => {
    peopleEvents.sayEvents('test-tech-channel', new Date('2018-09-24'), { remote: true });
    expect(botMock.say.mock.calls.length).toEqual(1);
  });
});
