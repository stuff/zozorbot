const request = require('superagent');
const Sherlock = require('sherlockjs');
const ICAL = require('ical.js');
var dateFns = require('date-fns')

const Botmodule = require('../Botmodule');
// const Message = require('../../Message');

const stringMatcher = {
  remote: /Télétravail -/,
  off: /Congé payé -/,
}

class Events extends Botmodule {
  async init() {
    this.events = {};

    // reload the file at midnight every day
    this.schedule('0 0 * * *', async () => {
      await this.loadIcs();
    });

    // say all events in the channel
    this.schedule('0 9 * * *', () => {
      this.sayEvents(new Date());
    });

    this.hears('who.*(off|remote) ([^\?]+)', (bot, { match, channel }) => {
      const [, what, when] = match;
      const { startDate } = Sherlock.parse(when);
      if (!startDate) {
        this.bot.say(`Well... It's embarrassing, I don't understand *${when}*...`, channel);
        return;
      }

      const options = (what === 'remote') ? { off: false, remote: true, channel } : { off: true, remote: false, channel };
      this.sayEvents(startDate, options);
    });

    // load events at initialization
    await this.loadIcs();
  }

  sayEvents(date, options = { off: true, remote: true }) {
    const channel = options.channel || this.moduleConfig.channel; // TODO: should use summary_channel from per ics configuration
    const botSayFunc = ({ startDate, endDate, summary }) => {
      if (dateFns.isWithinRange(date, startDate, endDate)) {
        this.bot.say(this.getEventString(summary), channel);
      }
    }

    if (dateFns.isWeekend(date)) {
      this.bot.say(':tada: Everyone is *OFF*, it\'s the week-end! :tada:', channel);
      return;
    }

    let stringDate = date.toLocaleDateString('en-EN', { weekday: 'long', month: 'long', day: 'numeric' });

    if (dateFns.isSameDay(date, new Date())) {
      stringDate = 'Today';
    } else if (dateFns.isTomorrow(date, new Date())) {
      stringDate = 'Tomorrow';
    }

    this.bot.say(`*${stringDate}*, don't search for those people at the office:`, channel);

    if (options.remote) {
      this.events
        .filter((event) => event.summary.match(stringMatcher.remote))
        .forEach(botSayFunc);
    }

    if (options.off) {
      this.events
        .filter((event) => event.summary.match(stringMatcher.off))
        .forEach(botSayFunc);
    }
  }

  getEventString(str) {
    let string = str.replace(stringMatcher.remote, ':house_with_garden:');
    string = string.replace(stringMatcher.off, ':palm_tree:');

    return string;
  }

  async loadIcs() {
    const files = this.moduleConfig.ics;
    const promises = files.map(({ name, url }) => {
      return request.get(url)
    });

    this.bot.log(':arrow_down: Loading all ical events file');

    const contents = await Promise.all(promises);

    this.bot.log(':white_check_mark: ical events loaded');

    this.events = [];

    return this.moduleConfig.ics.forEach((ics, n) => {
      const iCalendarData = contents[n].text;
      const parsed = this.parseIcal(iCalendarData);

      this.events = this.events.concat(parsed);
    })
  }

  parseIcal(iCalendarData) {
    const jcalData = ICAL.parse(iCalendarData);
    const vcalendar = new ICAL.Component(jcalData);

    return vcalendar.getAllSubcomponents().map((component) => {
      const summary = component.getFirstPropertyValue('summary');
      const dtstart = component.getFirstPropertyValue('dtstart');
      const dtend = component.getFirstPropertyValue('dtend');

      const startDate = dateFns.startOfDay(new Date(dtstart));
      const endDate = dateFns.endOfDay(dateFns.subDays(new Date(dtend), 1));

      return {
        summary,
        startDate,
        endDate
      }
    });
  }
}

Events.id = 'events';

module.exports = Events;
