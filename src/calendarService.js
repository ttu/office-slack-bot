const Bluebird = require('bluebird');
const fs = Bluebird.promisifyAll(require('fs'));
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const moment = require('moment');
moment.locale('fi');

class CalendarService {
  constructor(calendars) {
    this.calendars = calendars;
  }

  async getEventsText(eventCount = 1) {
    const events = await this.getEvents(eventCount);
    return events.reduce((acc, cur) => {
      const start = moment(cur.start).format('DD.MM. HH:mm');
      const end = moment(cur.end).format('HH:mm');
      return `${acc}${acc !== '' ? '\n' : ''}${cur.name} - ${start} to ${end} - ${cur.summary}`
    }, 'Next 2 reservations:');
  }

  async getFreeText() {
    const events = await this.getEvents();
    return this.calendars.reduce((acc, cur) => {
      const e = events.find(e => e.name == cur.name);
  
      if (!e) 
        return `${acc}${acc !== '' ? '\n' : ''}${cur.name} - indefinitely`;
  
      const diff = moment.duration(moment(e.start).diff(moment()));
      const diffAsHours = diff.asHours();
      
      if (diffAsHours > 0 && diffAsHours < 1) {
        return `${acc}${acc !== '' ? '\n' : ''}${e.name} - ${diff.asMinutes().toFixed(0)} minutes`
      } else if (diffAsHours > 0) {
        return `${acc}${acc !== '' ? '\n' : ''}${e.name} - ${diffAsHours.toFixed(1)} hours`
      } else {
        return acc;
      }
    }, '');
  }

  async getEvents(eventCount = 1) {
    const client = await this.getOAuthClient();
    return await this.getCurrentOrNextEvents(eventCount, client);
  }

  async bookEvent(booker, meetingRoom, durationMinutes = 15) {
    const client = await this.getOAuthClient();
    return this.bookMeetingRoom(booker, meetingRoom, durationMinutes, client);
  }

  async cancelEvent(canceller, meetingRoom) {
    const client = await this.getOAuthClient();
    return await this.cancelMeeting(canceller, meetingRoom, client);
  }

  async getOAuthClient() {
    const secretPromise = fs.readFileAsync('client_secret.json');
    const tokenPromise = fs.readFileAsync('calendar-authToken.json');
    const secret = await secretPromise;
    const token = await tokenPromise;

    const credentials = JSON.parse(secret);
    const clientSecret = credentials.installed.client_secret;
    const clientId = credentials.installed.client_id;
    const redirectUrl = credentials.installed.redirect_uris[0];

    const auth = new googleAuth();
    const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
    oauth2Client.credentials = JSON.parse(token);
    return oauth2Client;
  }

  async getCurrentOrNextEvents(eventCount, auth) {
    const promises = this.calendars.map(c => {
      return this.getCalendarEvents(c.name, c.id, eventCount, auth);
    }, this);

    return await Promise.all(promises).then(results => {
      return results.reduce((p, [success, result]) => {
        return success ? p.concat(result) : p;
      }, []);
    });
  }

  getCalendarEvents(calendarName, calendarId, eventCount, auth) {
    const params = {
      auth: auth,
      calendarId: calendarId,
      timeMin: (new Date()).toISOString(),
      maxResults: eventCount,
      singleEvents: true,
      orderBy: 'startTime'
    };
    return new Promise((resolve, reject) => {
      google.calendar('v3').events.list(params, (err, response) => {
        if (err) {
          resolve([false, 'The API (calendar.events.list) returned an error: ' + err]);
          return;
        }

        const isPublic = (item) => item.visibility !== 'private';

        const events = response.items.map(e => {
          return {
            id: e.id,
            name: calendarName,
            start: e.start.dateTime || e.start.date,
            end: e.end.dateTime || e.end.date,
            summary: isPublic(e) ? e.summary : 'Private',
            description: isPublic(e) ? e.description : 'Private',
            attendees: isPublic(e) ? e.attendees : 'Private',
            creator: e.creator
          }
        });

        resolve([true, events]);
      });
    });
  }

  async bookMeetingRoom(booker, roomName, durationMinutes, auth) {
    if (!roomName)
      return `Define a room name. (${this.calendars.map(c => c.name)})`;

    const selected = this.calendars.filter(c => c.name.toUpperCase() == roomName.toUpperCase());

    if (selected.length == 0)
      return `${roomName} not found. (${this.calendars.map(c => c.name)})`;

    const [success, nextReservation] = await this.getCalendarEvents(selected[0].name, selected[0].id, 1, auth);

    if (!success)
      return `Failed to get the calendar events`;

    const start = new Date();
    const end = new Date(start.getTime() + durationMinutes * 60000);

    if (nextReservation[0]) {
      const bookStart = moment(start);
      const bookEnd = moment(end);
      const nextResStart = moment(new Date(nextReservation[0].start));
      const nextResEnd = moment(new Date(nextReservation[0].end));
            
      if (bookStart.isBetween(nextResStart, nextResEnd) 
        || bookEnd.isBetween(nextResStart, nextResEnd)
        || nextResStart.isBetween(bookStart, bookEnd) 
        || nextResEnd.isBetween(bookStart, bookEnd))
        return `Can't book ${roomName} for ${durationMinutes} minutes at ${bookStart.format('H:mm')}. The room is already reserved from ${nextResStart.format('H:mm')} till ${nextResEnd.format('H:mm')}.`;
    }
            
    const event = {
      'summary': `${ booker.name || booker.email } - SlackBot quick booking`,
      'description': `A quick booking made from SlackBot for ${booker.name} - ${booker.email}`,
      'start': {
        'dateTime': start
      },
      'end': {
        'dateTime': end
      },
      'attendees': [{
        'email': booker.email
      }]
    };

    return await new Promise((resolve, reject) => {
      google.calendar('v3').events.insert({
        'auth': auth,
        'calendarId': selected[0].id,
        'resource': event
      }, (err, response) => {
        if (err) {
          reject(`The API (calendar.events.insert) returned an error: ${err}\ncalendarId: ${selected[0].id}\nresource: ${JSON.stringify(event, null, 4)}`);
        }
        resolve(`${selected[0].name} booked for ${durationMinutes} minutes at ${moment(start).format('H:mm')}`);
      });
    });
  }

  async cancelMeeting(canceller, roomName, auth) {
    if (!roomName)
      return `Define a room name. (${this.calendars.map(c => c.name)})`;

    const selected = this.calendars.filter(c => c.name.toUpperCase() == roomName.toUpperCase());

    if (selected.length == 0)
      return `${roomName} not found. (${this.calendars.map(c => c.name)})`;

    const [success, upcomingReservations] = await this.getCalendarEvents(selected[0].name, selected[0].id, 1, auth);
        
    if (!success)
      return `Failed to get the calendar events`;

    const cancellerReservations = upcomingReservations.filter(reservation =>
      reservation.attendees && reservation.attendees.some(a => a.email == canceller.email) &&
            reservation.description && reservation.description.includes('A quick booking made from SlackBot for'));

    if (cancellerReservations.length == 0)
      return `${canceller.email} has not made any room reservations with SlackBot - Cannot cancel`;

    return await new Promise((resolve, reject) => {
      google.calendar('v3').events.delete({
        'calendarId': selected[0].id,
        'eventId': cancellerReservations[0].id,
        'auth': auth
      }, (err, response) => {
        if (err)
          reject('The API (calendar.events.delete) returned an error: ' + err);
        resolve(`The reservation of ${selected[0].name} at ${moment(cancellerReservations[0].start).format('H:mm')} by ${canceller.email} has been cancelled`);
      });
    });
  }
}

module.exports = CalendarService;