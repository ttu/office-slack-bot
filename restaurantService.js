'use strict';

const request = require('superagent');

class RestaurantService {
    constructor(apiKey) {
        this.key = apiKey;
        const office = { lat: 60.171005, lon: 24.945224 };
        this.url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${office.lat},${office.lon}&radius=500&type=restaurant&opennow=true&key=${this.key}`;
        this.lastUpdateTimeInMs = 0;
        this.refreshTimeMs = 5 * 60 * 10000;
        this.updatePromise = null;
        this.data = [];
    }

    refreshData() {
        const getData = (datas, url, cb, tryCount = 0) => {
            request
                .get(url)
                .end((err, res) => {
                    if (err || !res.ok) cb([false, 'Failed']);

                    // Maybe too frequent requests to api make requet to fail?
                    if (res.body.status === "INVALID_REQUEST") {
                        if (tryCount > 5) cb([true, datas]); // Return what we have so far
                        setTimeout(() => getData(datas, url, cb, tryCount++), 2000);
                        return;
                    }

                    if (res.body.status === 'REQUEST_DENIED') {
                        cb([false, res.body.error_message]);
                        return;
                    }

                    const newDatas = datas.concat(res.body.results.map(r => r.name));
                    if (res.body.next_page_token) {
                        const nextPageUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${res.body.next_page_token}&key=${this.key}`;
                        getData(newDatas, nextPageUrl, cb);
                    }
                    else {
                        cb([true, newDatas]);
                    }
                });
        };

        this.updatePromise = new Promise((resolve, reject) => {
            // Set this in the beginnig so we won't start update again
            // Other requester will wait for updatePromise to finish
            this.lastUpdateTimeInMs = Date.now();

            getData([], this.url, ([success, result]) => {
                if (success) {
                    this.data = result;
                    resolve(true);
                } else {
                    reject(result);
                }
            });
        });

        return this.updatePromise;
    }

    getFromList() {
        return this.data[Math.floor(Math.random() * this.data.length)];
    }

    getRestaurant() {
        const isOld = Date.now() - this.lastUpdateTimeInMs > this.refreshTimeMs;

        if (isOld || this.updatePromise === null)
            this.refreshData();
        
        return this.updatePromise.then(_ => this.getFromList()).catch(errMessage => errMessage);
    }
}

module.exports = RestaurantService;