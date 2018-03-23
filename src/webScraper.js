const fetch = require('node-fetch');
const cheerio = require('cheerio');

class WebScraper {
  constructor(options) {
    this.options = options;
  }

  async getText(siteId) {
    if (siteId == 'list') return this.getList();

    const opts = this.options[siteId];

    if (!opts) return `Available sites: ${Object.keys(this.options)}`;

    const result = await fetch(opts.url);
    const html = await result.text();
    const $ = cheerio.load(html); // eslint-disable-line
    return eval(opts.selector);
  }

  getList() {
    let text = '';
    for (const prop in this.options) {
      text += `${prop}: ${this.options[prop].description}\n`;
    }
    return text;
  }
}

module.exports = WebScraper;
