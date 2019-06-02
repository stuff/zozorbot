const doAsync = require('doasync');
const Botkit = require('botkit');
const { SlackAdapter, SlackMessageTypeMiddleware, SlackEventMiddleware } = require('botbuilder-adapter-slack');

const loadFeatures = require('./services/loadFeatures');
const sayGenericHelp = require('./services/help/sayGenericHelp');

const package = require('../package');

const isProduction = process.env.NODE_ENV === 'production';

const config = require(isProduction ? '../config.json' : '../config.dev.json');

config.isProduction = isProduction;

var controller = Botkit.slackbot({
  debug: false,
});

controller.spawn({
  token: config.bot_token,
}).startRTM(async (err, bot) => {
  if (err) {
    throw new Error(err);
  }

  const featuresFolder = `${__dirname}/features`;

  const asyncBot = doAsync(bot);

  Object.keys(asyncBot.api).forEach((k) => {
    if (typeof asyncBot.api[k] !== "object") {
      return;
    }
    asyncBot.api[k] = doAsync(asyncBot.api[k]);
  });

  await asyncBot.say({
    text: `:heart: I'm alive! (v${package.version})`,
    channel: config.bot_log_channel
  });

  const features = await loadFeatures(featuresFolder, {
    config,
    controller,
    bot: asyncBot,
  });

  controller.hears('help (.*)', 'direct_mention', async (bot, message) => {
    const { match } = message;
    const [, what] = match;

    const { channel } = await bot.api.conversations.info({ channel: message.channel });

    const availableHelps = features
      .map((feature) => feature.help(channel.name))
      .filter((help) => help !== null);

    const availableHelpNames = availableHelps.map(feature => feature.name.toLowerCase());
    const noHelpForThisChannel = !(availableHelpNames.includes(what.toLowerCase()));

    if (noHelpForThisChannel) {
      bot.reply(message, `I can't help with \`${what}\` :(`);
      await sayGenericHelp(bot, message, features);
      return;
    }

    const availableHelpDescriptions = availableHelps.map(feature => feature.commands);
    bot.reply(message, availableHelpDescriptions.join('\n'));
  });

  controller.hears('help', 'direct_mention', (bot, message) => sayGenericHelp(bot, message, features));
});
