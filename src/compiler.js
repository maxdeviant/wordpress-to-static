import path from 'path';
import cheerio from 'cheerio';
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

  constructor({ outputDirectory, testingUrl, productionUrl, themeUrl }) {
    this.outputDirectory = outputDirectory;
    this.testingUrl = testingUrl;
    this.productionUrl = productionUrl;
    this.themeUrl = themeUrl;
    this.queuedUrls = [this.testingUrl];
  }

  async compile() {
    try {
      const startTime = process.hrtime();
      await this.crawl();
      const [ elapsedSeconds, elapsedNanoseconds ] = process.hrtime(startTime);
      console.log(`Done in ${elapsedSeconds}s ${elapsedNanoseconds}ns!`);
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

      const contentType = headers['content-type'];

      await this.save(url, contentType, body);

      const $ = cheerio.load(body);

      const urls = $('a')
        .map((index, element) => $(element).attr('href'))
        .get()
        .filter(url => this.isValidUrl(url))
        .filter(url => !this.isExternalUrl(url))
        .filter(url => !this.isPageCompleted(url))
        .filter(url => !this.isPageSkipped(url));

      this.queuedUrls.push(...urls);

      while (urls.length > 0 && this.workerCount <= this.maxWorkers) {
        const url = this.queuedUrls.shift();
        await this.crawl(url);
      }

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

  isPageSkipped(url) {
    return this.skippedPages.indexOf(url) !== -1;
  }

  completePage(url) {
    this.completedPages[url] = true;
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
