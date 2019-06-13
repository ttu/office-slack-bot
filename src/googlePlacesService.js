const request = require('superagent');

class GooglePlacesService {
  constructor(apiKey, office, type, distance = 500) {
    this.key = apiKey;
    this.onlyOpen = false;
    this.url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${office.lat},${
      office.lon
    }&radius=${distance}&type=${type}${this.onlyOpen ? '&opennow=true' : ''}&key=${this.key}`;
    this.lastUpdateTimeInMs = 0;
    this.refreshTimeMs = 5 * 60 * 10000;
    this.updatePromise = null;
    this.data = [];
  }

  refreshData() {
    const getData = (datas, url, readyFunc, tryCount = 0) => {
      request.get(url).end((err, res) => {
        if (err || !res.ok) {
          readyFunc([false, 'Failed']);
          return;
        }

        // Maybe too frequent requests to the API makes the request to fail?
        if (res.body.status === 'INVALID_REQUEST') {
          if (tryCount > 5) readyFunc([true, datas]); // Return what we have so far
          setTimeout(() => getData(datas, url, readyFunc, tryCount++), 2000); // eslint-disable-line
          return;
        }

        if (res.body.status === 'REQUEST_DENIED') {
          readyFunc([false, res.body.error_message]);
          return;
        }

        const newDatas = datas.concat(res.body.results.map(r => `${r.name} (${r.vicinity})`));
        if (res.body.next_page_token) {
          const nextPageUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${
            res.body.next_page_token
          }&key=${this.key}`;
          getData(newDatas, nextPageUrl, readyFunc);
        } else {
          console.log(`Found ${newDatas.length} items`);
          readyFunc([true, newDatas]);
        }
      });
    };

    // Set updatePromise in the beginnig of refresh, so data update is not exceuted if it is already runnign
    // Other requester will wait for updatePromise to finish
    this.updatePromise = new Promise((resolve, reject) => {
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

  getRandomPlace() {
    const isOld = Date.now() - this.lastUpdateTimeInMs > this.refreshTimeMs;
    if (isOld || this.updatePromise === null) this.refreshData();
    return this.updatePromise.then(_ => this.data[Math.floor(Math.random() * this.data.length)]);
  }
}

module.exports = GooglePlacesService;
