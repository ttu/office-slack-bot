'use strict';

const request = require('superagent');

class RestaurantService {
    constructor(apiKey, office) {
        this.key = apiKey;
        this.onlyOpen = false;
        this.url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${office.lat},${office.lon}&radius=500&type=restaurant${this.onlyOpen ? '&opennow=true' : ''}&key=${this.key}`;
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

                    const newDatas = datas.concat(res.body.results.map(r => `${r.name} (${r.vicinity})`));
                    if (res.body.next_page_token) {
                        const nextPageUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${res.body.next_page_token}&key=${this.key}`;
                        getData(newDatas, nextPageUrl, cb);
                    }
                    else {
                        console.log(`Found ${newDatas.length} items`);
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

    getRestaurant() {
        const isOld = Date.now() - this.lastUpdateTimeInMs > this.refreshTimeMs;

        if (isOld || this.updatePromise === null)
            this.refreshData();
        
        return this.updatePromise.then(_ => this.data[Math.floor(Math.random() * this.data.length)]);
    }
}

module.exports = RestaurantService;