module.exports = async function sayGenericHelp (bot, message, features) {
  const { channel } = await bot.api.conversations.info({ channel: message.channel });

  const helps = features
    .map((feature) => feature.help(channel.name))
    .filter((help) => help !== null);

  const texts = helps.map(help => `• *${help.name}*: ${help.description}` );
  texts.unshift('Here is a list of features I\'m capable of:');
  texts.push('\n');
  texts.push(':bulb: type `@zozor help [feature]` for more help on a feature!');

  bot.reply(message, texts.join('\n'));
}
