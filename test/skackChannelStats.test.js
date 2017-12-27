'use strict';

const assert = require('assert');
const SlackChannelStats = require('../src/slackChannelStats');
const Config = require('../src/configuration');

describe('SlackChannelStats tests', () => {
    it('should get channel activity', async done => {
        var s = new SlackChannelStats(Config.botToken);
        var activity = await s.getActivity(Config.homeChannelId, 30, 8);
        assert.equal(activity.top.length, 8);
    });
});