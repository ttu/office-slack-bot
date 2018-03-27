'use strict';

const assert = require('assert');
const Bot = require('../src/bot');

describe('Bot tests', () => {
  it('should get correct message', done => {
    Bot.handle('say This aint over!').then(response => {
      assert.notEqual(response.channel, undefined);
      assert.equal(response.text, 'Anonymous: This aint over!');
      done();
    });
  });
});