const request = require('superagent');
// const calendario = require('calendario');
// const ical2json = require('ical2json');
const ICAL = require('ical.js');
var dateFns = require('date-fns')

const Botmodule = require('../Botmodule');
// const Message = require('../../Message');

class Events extends Botmodule {
  async init() {
    this.events = {};

    // reload the file at midnight every day
    this.schedule('0 0 * * *', async () => {
      await this.loadIcs();
    });

    // say all events in the channel
    this.schedule('0 9 * * *', () => {
      this.sayEvents();
    });

    // load events at initialization
    await this.loadIcs();

    // setTimeout(() => {
    //   this.sayEvents();
    // }, 2000);
  }

  sayEvents(date = new Date()) {
    const channelName = this.moduleConfig.channel; // TODO: should use summary_channel from per ics configuration

    this.bot.say('*Today, don\'t search for those people at the office:*', channelName);

    this.events.forEach(({ startDate, endDate, summary }) => {
      if (dateFns.isWithinRange(date, startDate, endDate)) {
        let string = summary.replace(/Télétravail -/, ':house_with_garden:');
        string = string.replace(/Congé payé -/, ':palm_tree:');

        this.bot.say(string, channelName);

      }
    });
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
