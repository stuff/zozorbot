const request = require('superagent');
const Sherlock = require('sherlockjs');
const ICAL = require('ical.js');
const uniq = require('lodash/fp/uniq');
const uniqBy = require('lodash/uniqBy');
const sortBy = require('lodash/sortBy');
const dateFns = require('date-fns');
const { eachOf, eachSeries } = require('async');
const doAsync = require('doasync');

const Feature = require('../Feature');

const stringMatcher = {
  remote: /^(Télétravail -) (.*)/,
  off: /^(Congé payé -) (.*)/,
  there: /^(Présence -) (.*)/,
  birthday: /^(Anniversaire de) (.*)/,
}

class Events extends Feature {
  constructor(controller, bot, config, name) {
    super(controller, bot, config, name);

    this.events = [];
    this.remoteWorkers = {};
  }

  async start() {
    await super.start();

    // reload the file at midnight every day
    await this.schedule('0 0 * * *', () => {
      this.loadIcs();
    });

    // say all events in various channels
    await this.schedule('0 9 * * *', () => {
      this.config.ics.forEach(async ({ target_channel }) => {
        await this.sayEvents(target_channel, new Date());
      });
    });

    // load events at initialization
    await this.loadIcs();

    // // TODO: remove
    // this.config.ics.forEach(async ({ target_channel }) => {
    //   await this.sayEvents(target_channel, new Date());
    // });

    this.controller.hears('who (will be|is) (out of office|remote|on vacation)([^\?]+)', 'direct_mention', async (bot, message) => {
      const { channel, raw_message, match } = message;
      const [, ,what, when] = match;
      const { startDate } = Sherlock.parse(when.trim());

      if (!startDate) {
        await this.bot.say({
          text: `Well... It's embarrassing, I don't understand *${when}*...`,
          channel,
        });
        return;
      }

      let options;

      switch(what) {
        case 'remote':
          options = { off: false, remote: true };
          break;

        case 'on vacation':
          options = { off: true, remote: false };
          break;

        default:
          options = { off: true, remote: true };
      }

      const channelInfo = await this.bot.api.conversations.info({ channel: raw_message.channel });
      await this.sayEvents(channelInfo.channel.name, startDate, options);
    });
  }

  async loadIcs(cb) {
    this.events = [];
    this.remoteWorkers = {};

    const files = this.config.ics;

    await this.log(':arrow_down: Loading all ical events file');

    const attendancePromises = [];
    const offPromises = files.map(({ target_channel, name, url, remote_workers_attendance }) => {
      if (remote_workers_attendance) {
        attendancePromises.push(remote_workers_attendance.map(url => request.get(url)));
      }
      return request.get(url);
    });

    const offContents = await Promise.all(offPromises);

    offContents.forEach(({ text: iCalendarData}, n) => {
      const parsed = parseIcal(iCalendarData, files[n].target_channel);
      this.events = this.events.concat(parsed);
    });

    await eachOf(attendancePromises, async (attendancePromise, n) => {
      const attendanceContents = await Promise.all(attendancePromise);

      attendanceContents.forEach(({ text: iCalendarData}) => {
        const channelName = files[n].target_channel;
        const parsed = parseIcal(iCalendarData, channelName);
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
    });

    await this.log(':white_check_mark: ical events loaded');
  }

  async sayEvents(channel, date, options = { off: true, remote: true }) {
    const filterPeriod = ({ startDate, endDate }) => dateFns.isWithinRange(date, startDate, endDate);
    const botSayAllFunc = (stringDate, events) => {
      const text = events.map(({ summary, morningOnly, afternoonOnly }) => getEventString(summary, morningOnly, afternoonOnly));
      text.unshift(`*${stringDate}*, don't search for those people at the office:`);

      this.bot.say({
        text: text.join('\n'),
        channel,
      });
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
      await this.bot.say({
        text: ':tada: No one is working, it\'s the *week-end*! :tada:',
        channel
      });
      return;
    }

    let stringDate = date.toLocaleDateString('en-EN', { weekday: 'long', month: 'long', day: 'numeric' });

    if (dateFns.isSameDay(date, new Date())) {
      stringDate = 'Today';
    } else if (dateFns.isTomorrow(date, new Date())) {
      stringDate = 'Tomorrow';
    }

    let finalEvents = [];

    if (options.remote) {
      const remoteEvents = filterEvents(this.events, stringMatcher.remote);

      // dynamically add remote event for regular remote worker
      if (this.remoteWorkers[channel]) {
        this.remoteWorkers[channel].forEach((workerName) => {
          if (!isOff(this.events, workerName, date) && !isThere(this.events, workerName, date)) {
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

      finalEvents = finalEvents.concat(remoteEvents);
    }

    if (options.off) {
      finalEvents = finalEvents.concat(filterEvents(this.events, stringMatcher.off));
    }

    if (finalEvents.length > 0) {
      botSayAllFunc(stringDate, finalEvents);
    } else {
      await this.bot.say({
        text: `*${stringDate}*, it seems no one is missing!`,
        channel,
      });
    }

  }

  help(channelName) {
    const channels = this.config.ics.map((c) => c.target_channel);
    if (!channels.includes(channelName)) {
      return null;
    }

    return {
      ...super.help(channelName),
      description: 'Handle events like vacations, remote days...',
      commands: [
        [
          ':speech_balloon: `@zozor who [is|will be] [out of office|remote|on vacation] [date]?`',
          '_List who is out of office for a particular day_',
          ':gear: *is / will be*: well, I\'m not so good with grammar...',
          ':gear: *out of office*: remote OR in vacation',
          ':gear: *remote*: working at home',
          ':gear: *on vacation*: lying on the beach',
          ':gear: *date*: today, tomorrow, next monday, in 3 days...',
        ].join('\n'),
      ],
    }
  }
}

function isOff(events, who, date) {
  const offEvents = events
    .filter(event => event.summary.match(stringMatcher.off))
    .filter(event => event.who === who);

  return offEvents.some(({ startDate, endDate }) => dateFns.isWithinRange(date, startDate, endDate));
}

function isThere(events, who, date) {
  const offEvents = events
    .filter(event => event.summary.match(stringMatcher.there))
    .filter(event => event.who === who);

  return offEvents.some(({ startDate, endDate }) => dateFns.isWithinRange(date, startDate, endDate));
}

function getEventString(str, morningOnly, afternoonOnly) {
  let string = str.replace(stringMatcher.remote, ':house_with_garden: $2');
  string = string.replace(stringMatcher.off, ':palm_tree: $2');


  if (morningOnly && !afternoonOnly) {
    string += ' *(morning only)*';
  } else if (!morningOnly && afternoonOnly) {
    string += ' *(afternoon only)*';
  }

  return string;
}

function parseIcal(iCalendarData, targetChannel) {
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

module.exports = Events;
