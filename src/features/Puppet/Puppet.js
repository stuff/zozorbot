// const request = require('superagent');
// const Sherlock = require('sherlockjs');
// const ICAL = require('ical.js');
// const uniq = require('lodash/fp/uniq');
// const uniqBy = require('lodash/uniqBy');
// const sortBy = require('lodash/sortBy');
// const dateFns = require('date-fns');
// const { eachOf, eachSeries } = require('async');
// const doAsync = require('doasync');

const Feature = require('../Feature');

class Puppet extends Feature {
  async start() {
    await super.start();

    this.controller.hears('say `(.*)` in <#\\w+\\|(\\w+)', 'direct_message', async (bot, message) => {
      const { raw_message, match } = message;
      const [, what, where] = match;

      this.bot.say({
        text: what,
        channel: where,
      });
    });
  }
}

module.exports = Puppet;
