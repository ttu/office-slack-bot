const fetch = require('node-fetch');
const moment = require('moment');

moment.locale('fi');

class SlackChannelStatus {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async getChannelHistoryJson(method, channelId, startFrom = 0) {
    // If oldest is used then it will return that and amount of count newer ones. Have to do decision when we have enough manually.
    const result = await fetch(`https://slack.com/api/${method}?token=${this.apiKey}&channel=${channelId}&latest=${startFrom}&count=1000&pretty=0`);
    return result.json();
  }

  async getChannelMembers(channelId) {
    const isPublic = await this.isChannelPublic(channelId);
    const method = isPublic ? 'channels.info' : 'groups.info';
    const result = await fetch(`https://slack.com/api/${method}?token=${this.apiKey}&channel=${channelId}`);
    const json = await result.json();
    return isPublic ? json.channel.members : json.group.members;
  }

  async getUser(userId) {
    const result = await fetch(`https://slack.com/api/users.info?token=${this.apiKey}&user=${userId}&pretty=0`);
    const json = await result.json();
    return json.ok ? json.user : {};
  }

  async isChannelPublic(channelId) {
    const result = await fetch(`https://slack.com/api/channels.info?token=${this.apiKey}&channel=${channelId}`);
    const json = await result.json();
    return json.ok;
  }

  async getActivity(channelId, days = 7, top = 5) {
    const listMethod = (await this.isChannelPublic(channelId)) ? 'channels.history' : 'groups.history';

    const startDate = moment().add(-1 * days, 'days');
    const startTimeStamp = startDate.unix();

    let messages = [];
    let currentFetchTimeStamp = 0;

    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const json = await this.getChannelHistoryJson(listMethod, channelId, currentFetchTimeStamp);

      if (json.ok === false) return null;

      const lastInArray = json.messages[json.messages.length - 1].ts;

      if (startTimeStamp >= lastInArray) {
        const toAdd = json.messages.filter(e => e.ts >= startTimeStamp);
        messages = messages.concat(toAdd);
        break;
      }

      messages = messages.concat(json.messages);

      if (json.has_more === false) break;

      currentFetchTimeStamp = lastInArray;
    }

    const userGrouped = messages.reduce((grouped, item) => {
      if (
        !item ||
        item.type !== 'message' ||
        item.subtype === 'bot_message' ||
        item.subtype === 'group_join' ||
        item.subtype === 'group_leave'
      )
        return grouped;

      const key = item.user || item.comment.user;
      grouped[key] = grouped[key] || []; // eslint-disable-line no-param-reassign
      grouped[key].push(item);
      return grouped;
    }, {});

    const groupedArray = Object.keys(userGrouped).map(key => {
      return {
        id: key,
        count: userGrouped[key].length
      };
    });

    const sortedArray = groupedArray.sort((a, b) => a.count - b.count).reverse();
    const itemCount = messages.length;

    let topList;

    if (top === 0) {
      const members = await this.getChannelMembers(channelId);
      const passiveMembers = members.filter(e => sortedArray.some(s => s.id === e) === false);
      topList = passiveMembers.map(e => {
        return { id: e, count: 0, percentage: 0 };
      });
    } else {
      topList = sortedArray.slice(0, top).map(e => {
        return {
          id: e.id,
          count: e.count,
          percentage: ((e.count / itemCount) * 100).toFixed(1)
        };
      });
    }

    const userPromises = topList.map(e => this.getUser(e.id));

    const users = await Promise.all(userPromises);

    topList.forEach((item, idx) => {
      item.name = users[idx].real_name; // eslint-disable-line no-param-reassign
    });

    const othersPercentage = (
      ((itemCount - topList.reduce((sum, item) => sum + item.count, 0)) / itemCount) *
      100
    ).toFixed(1);

    const oldestMessage = moment.unix(messages[messages.length - 1].ts);

    return {
      from: oldestMessage.format('HH:mm DD.MM.YYYY'),
      messages: itemCount,
      top: topList,
      others: othersPercentage,
      active: groupedArray.length
    };
  }
}

module.exports = SlackChannelStatus;
