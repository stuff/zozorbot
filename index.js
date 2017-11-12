const request = require('superagent');
const SlackClient = require('@slack/client');

const config = require('./config.json');

const { WebClient, RtmClient, CLIENT_EVENTS, RTM_EVENTS } = SlackClient;

const bot_token = process.env.SLACK_BOT_TOKEN || config.wwc.slack_bot_token;
const bot_channel = process.env.SLACK_CHANNEL || config.wwc.channel;

const rtm = new RtmClient(bot_token);
const web = new WebClient(bot_token);

let channel;

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  for (const c of rtmStartData.channels) {

    if (c.is_member && c.name === bot_channel) {
      channel = c.id
    }
  }

  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}`);
});

rtm.on(RTM_EVENTS.MESSAGE, async function handleRtmMessage(message) {
  const { type, subtype, file, user } = message;

  if (type !== 'message' || subtype !== 'file_share') {
    return;
  }

  const userInfo = await web.users.info(user);

  try {
    const res = await request
      .post(config.wwc.add_slackpost_endpoint)
      .send({
        userEmail: userInfo.user.profile.email,
        postUrl: file.permalink,
        createdAt: Date.now(),
      })
      .set('Accept', 'application/json');

    if (res.err) {
      throw res.err;
    }

    rtm.sendMessage(`Congratulations! You made 5 points to your team!`, channel);

  } catch(e) {
    console.log(e);
  }
});

rtm.start();
