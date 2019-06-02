const request = require('superagent');
const Sherlock = require('sherlockjs');
const ICAL = require('ical.js');
const uniq = require('lodash/fp/uniq');
const uniqBy = require('lodash/uniqBy');
const sortBy = require('lodash/sortBy');
const dateFns = require('date-fns');
const { eachOf } = require('async');

const Botmodule = require('../Botmodule');

const stringMatcher = {
  remote: /^(Télétravail -) (.*)/,
  off: /^(Congé payé -) (.*)/,
  there: /^(Présence -) (.*)/,
  birthday: /^(Anniversaire de) (.*)/,
}

class Events extends Botmodule {
  async init() {
    this.events = [];
    this.remoteWorkers = {};

    // reload the file at midnight every day
    this.schedule('0 0 * * *', () => {
      this.loadIcs();
    });

    // say all events in various channels
    this.schedule('0 9 * * *', () => {
      this.moduleConfig.ics.forEach(({ target_channel }) => {
        this.sayEvents(target_channel, new Date());
      })
    });

    this.hears('who.*(off|remote) ([^\?]+)', (bot, { match, channel }) => {
      const [, what, when] = match;
      const { startDate } = Sherlock.parse(when);
      if (!startDate) {
        this.bot.say(`Well... It's embarrassing, I don't understand *${when}*...`, channel);
        return;
      }

      const options = (what === 'remote')
                      ? { off: false, remote: true, channel }
                      : { off: true, remote: false, channel };

      this.sayEvents(channel.name, startDate, options);
    });

    // load events at initialization
    await this.loadIcs();
  }

  sayEvents(channel, date, options = { off: true, remote: true }) {
    const filterPeriod = ({ startDate, endDate }) => dateFns.isWithinRange(date, startDate, endDate);

    const botSayFunc = ({ summary, morningOnly, afternoonOnly }) => {
      this.bot.say(this.getEventString(summary, morningOnly, afternoonOnly), channel);
    }

    const filterEvents = (events, matcher) => {
      const filteredEvents =  events
        .filter(event => event.summary.match(matcher))
        .filter(event => event.targetChannel === channel)
        .filter(filterPeriod);

      const uniq = uniqBy(filteredEvents, 'who');
      const sorted = sortBy(uniq, 'who');

      return sorted;
    };

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
      const remoteEvents = filterEvents(this.events, stringMatcher.remote);

    // dynamically add remote event for regular remote worker
    if (this.remoteWorkers[channel]) {
      this.remoteWorkers[channel].forEach((workerName) => {
        if (!this.isOff(workerName, date) && !this.isThere(workerName, date)) {
          const startDate = dateFns.startOfDay(date);
          const endDate = dateFns.endOfDay(date);

          remoteEvents.push({
            type: 'remote',
            who: workerName,
            summary: `Télétravail - ${workerName}`,
            startDate,
            endDate,
            morningOnly: false,
            afternoonOnly: false,
          });
        }
      });
    }

      remoteEvents.forEach(botSayFunc);
    }

    if (options.off) {
      filterEvents(this.events, stringMatcher.off).forEach(botSayFunc);
    }
  }

  isOff(who, date) {
    const offEvents = this.events
        .filter(event => event.summary.match(stringMatcher.off))
        .filter(event => event.who === who);

    return offEvents.some(({ startDate, endDate }) => dateFns.isWithinRange(date, startDate, endDate));
  }

  isThere(who, date) {
    const offEvents = this.events
      .filter(event => event.summary.match(stringMatcher.there))
      .filter(event => event.who === who);

    return offEvents.some(({ startDate, endDate }) => dateFns.isWithinRange(date, startDate, endDate));
  }

  getEventString(str, morningOnly, afternoonOnly) {
    let string = str.replace(stringMatcher.remote, ':house_with_garden: $2');
    string = string.replace(stringMatcher.off, ':palm_tree: $2');


    if (morningOnly && !afternoonOnly) {
      string += ' *(morning only)*';
    } else if (!morningOnly && afternoonOnly) {
      string += ' *(afternoon only)*';
    }

    return string;
  }

  async loadIcs() {
    this.events = [];
    this.remoteWorkers = {};

    const files = this.moduleConfig.ics;

    this.bot.log(':arrow_down: Loading all ical events file');

    const attendancePromises = [];
    const offPromises = files.map(({ target_channel, name, url, remote_workers_attendance }) => {
      if (remote_workers_attendance) {
        attendancePromises.push(remote_workers_attendance.map(url => request.get(url)));
      }
      return request.get(url);
    });

    const offContents = await Promise.all(offPromises);

    offContents.forEach(({ text: iCalendarData}, n) => {
      const parsed = this.parseIcal(iCalendarData, files[n].target_channel);
      this.events = this.events.concat(parsed);
    });

    eachOf(attendancePromises, async (attendancePromise, n) => {
      const attendanceContents = await Promise.all(attendancePromise);

      attendanceContents.forEach(({ text: iCalendarData}) => {
        const channelName = files[n].target_channel;
        const parsed = this.parseIcal(iCalendarData, channelName);
        this.events = this.events.concat(parsed);

        const remoteWorkers = parsed.reduce((workers, { type, who }) => {
          if (!workers.includes(who)) {
            workers.push(who);
          }
          return workers;
        }, []);

        if (!this.remoteWorkers[channelName]) {
          this.remoteWorkers[channelName] = [];
        }

        this.remoteWorkers[channelName] = this.remoteWorkers[channelName].concat(remoteWorkers);
      });
    }, () => {
      this.bot.log(':white_check_mark: ical events loaded');
    });
  }

  parseIcal(iCalendarData, targetChannel) {
    const jcalData = ICAL.parse(iCalendarData);
    const vcalendar = new ICAL.Component(jcalData);

    return vcalendar.getAllSubcomponents().map((component) => {
      const summary = component.getFirstPropertyValue('summary');
      const dtstart = component.getFirstPropertyValue('dtstart');
      const dtend = component.getFirstPropertyValue('dtend');
      const description = component.getFirstPropertyValue('description');

      const morningOnly = !!(description && description.match(/matinée/));
      const afternoonOnly = !!(description && description.match(/après-midi/));

      let type;
      let who;

      if (summary.match(stringMatcher.there)) {
        type = 'there';
        who = summary.match(stringMatcher.there)[2];
      } else {
        if (summary.match(stringMatcher.off)) {
          type = 'vacation';
          who = summary.match(stringMatcher.off)[2];
        } else if (summary.match(stringMatcher.remote)) {
          type = 'remote';
          who = summary.match(stringMatcher.remote)[2];
        } else if (summary.match(stringMatcher.birthday)) {
          type = 'birthday';
          who = summary.match(stringMatcher.birthday)[2];
        }
      }

      const startDate = dateFns.startOfDay(new Date(dtstart));
      const endDate = dateFns.endOfDay(dateFns.subDays(new Date(dtend), 1));

      return {
        targetChannel,
        type,
        who,
        summary,
        startDate,
        endDate,
        morningOnly,
        afternoonOnly,
      }
    });
  }
}

Events.id = 'events';

module.exports = Events;
