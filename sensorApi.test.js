'use strict';

const assert = require('assert');
const SensorApi = require('./sensorApi');

describe('SensorApi tests', () => {
    it('should get row count', done => {
        // Run server on localhost
        const sApi = new SensorApi('xxx', 'xxx', 'localhost:8080', [ { id: '000D6F0004476483', name: '6krs'} ]);
        sApi.hasPeople().then(result => {
            done();
        });
    });
});