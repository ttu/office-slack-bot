const fetch = require('node-fetch');
const moment = require('moment');
moment.locale('fi');

class SlackChannelStatus {

    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async getChannelHistoryJson(channelId, startFrom = 0) {
        // If oldest is used then it will return that and amount of count newer ones. Have to do decision when we have anough manually.
        const result = await fetch(`https://slack.com/api/channels.history?token=${this.apiKey}&channel=${channelId}&latest=${startFrom}&count=1000&pretty=0`);
        return await result.json();
    }

    async getUser(userId) {
        const result = await fetch(`https://slack.com/api/users.info?token=${this.apiKey}&user=${userId}&pretty=0`);
        const json = await result.json();
        return json.ok ? json.user : {};
    }

    async getActivity(channelId, days = 7, top = 5) {
        const lastWeek = moment().add(-1 * days, 'days');
        const oldestTimeStamp = lastWeek.unix();

        let messages = [];
        let startFrom = 0;

        while (true) {
            let json = await this.getChannelHistoryJson(channelId, startFrom);

            if (json.ok === false)
                return null;

            let lastInArray = json.messages[json.messages.length - 1].ts;

            if (oldestTimeStamp >= lastInArray) {
                let toAdd = json.messages.filter(e => e.ts >= oldestTimeStamp);
                messages = messages.concat(toAdd);
                break;
            }

            messages = messages.concat(json.messages);

            if (json.has_more === false)
                break;

            startFrom = lastInArray;
        }

        const userGrouped = messages.reduce((grouped, item) => {
            if (!item || item.subtype == "bot_message") return grouped;

            const key = item.user || item.comment.user;
            grouped[key] = grouped[key] || [];
            grouped[key].push(item);
            return grouped
        }, {});

        const groupedArray = Object.keys(userGrouped).map(key => {
            return {
                id: key,
                count: userGrouped[key].length
            }
        });

        const sortedArray = groupedArray.sort((a, b) => a.count - b.count).reverse();
        const itemCount = messages.length;

        const topList = sortedArray.slice(0, top).map(e => {
            return {
                id: e.id,
                count: e.count,
                percentage: (e.count / itemCount * 100).toFixed(1)
            }
        });

        const userPromises = topList.map(e => this.getUser(e.id));

        const users = await Promise.all(userPromises);

        topList.forEach((item, idx) => {
            item.name = users[idx].real_name;
        });

        const othersPercentage = ((itemCount - topList.reduce((sum, item) => sum + item.count, 0)) / itemCount * 100).toFixed(1);

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