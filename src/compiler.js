import path from 'path';
import arrayUniq from 'array-uniq';
import cheerio from 'cheerio';
import { minify } from 'html-minifier';
import { get } from './http';
import { createDirectory, writeFile } from './io';

export default class Compiler {
  workerCount = 0;
  maxWorkers = 100;
  queuedUrls = [];
  completedPages = [];
  skippedPages = [];
  completedAssets = [];
  skippedAssets = [];
  blacklist = [];

  constructor({ outputDirectory, testingUrl, productionUrl, themeUrl, blacklist }) {
    this.outputDirectory = outputDirectory;
    this.testingUrl = testingUrl;
    this.productionUrl = productionUrl;
    this.themeUrl = themeUrl;
    this.blacklist = blacklist;
    this.queuedUrls = [this.testingUrl];
  }

  async compile() {
    try {
      const startTime = process.hrtime();
      await this.crawl();
      return process.hrtime(startTime);
    } catch (err) {
      console.error(err);
    }
  }

  async crawl() {
    try {
      this.addWorker();
      const url = this.queuedUrls.shift();
      const response = await get(url);
      const {
        statusCode,
        headers,
        body
      } = response;

      if (statusCode === 404) {
        this.skippedPages.push(url);
        return;
      }

      let contents = body;
      const contentType = headers['content-type'];

      if (contentType.indexOf('text/html') !== -1) {
        contents = minify(body, {
          collapseWhitespace: true
        });
      }

      await this.save(url, contentType, contents);

      const $ = cheerio.load(body);

      const urls = $('a')
        .map((index, element) => $(element).attr('href'))
        .get()
        .filter(url => this.isValidUrl(url))
        .filter(url => !this.isExternalUrl(url))
        .filter(url => !this.isBlacklistedUrl(url))
        .filter(url => !this.isPageCompleted(url))
        .filter(url => !this.isPageSkipped(url));

      this.queuedUrls.push(...urls);
      this.queuedUrls = arrayUniq(this.queuedUrls);

      let promise;
      while (this.queuedUrls.length > 0 && this.workerCount < this.maxWorkers) {
        promise = this.crawl();
      }

      await promise;
      this.removeWorker()
    } catch (err) {
      console.error(err);
    }
  }

  async save(url, contentType, html) {
    try {
      if (this.isPageCompleted(url)) {
        return;
      }

      const outputDirectory = this.convertUrlToPath(url);
      await createDirectory(outputDirectory);

      const outputFile = path.join(outputDirectory, 'index.html');
      await writeFile(outputFile, html);

      this.completePage(url);
    } catch (err) {
      console.error(err);
    }
  }

  addWorker() {
    this.workerCount++;
  }

  removeWorker() {
    this.workerCount--;
  }

  isPageCompleted(url) {
    return this.completedPages.indexOf(url) !== -1;
  }

  completePage(url) {
    this.completedPages.push(url);
  }

  isPageSkipped(url) {
    return this.skippedPages.indexOf(url) !== -1;
  }

  isValidUrl(url) {
    return (
      url &&
      url !== '' &&
      url !== '#'
    );
  }

  isExternalUrl(url) {
    return !url.startsWith(this.testingUrl);
  }

  isBlacklistedUrl(url) {
    return this.blacklist.some(value => url.indexOf(value) !== -1);
  }

  convertUrlToPath(url) {
    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
      url = url.slice(queryIndex);
    }

    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      url = url.slice(hashIndex);
    }

    const filePath = path.join(this.outputDirectory, url.replace(new RegExp(this.testingUrl), ''));

    return filePath;
  }
}
