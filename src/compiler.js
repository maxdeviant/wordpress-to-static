import path from 'path';
import cheerio from 'cheerio';
import { get } from './http';
import { createDirectory, writeFile } from './io';

export default class Compiler {
  completedPages = {};
  skippedPages = [];
  completedAssets = [];
  skippedAssets = [];

  constructor({ outputDirectory, testingUrl, productionUrl, themeUrl }) {
    this.outputDirectory = outputDirectory;
    this.testingUrl = testingUrl;
    this.productionUrl = productionUrl;
    this.themeUrl = themeUrl;
  }

  async compile() {
    try {
      const startTime = process.hrtime();
      await this.crawl(this.testingUrl);
      const [ elapsedSeconds, elapsedNanoseconds ] = process.hrtime(startTime);
      console.log(`Done in ${elapsedSeconds}s ${elapsedNanoseconds}ns!`);
    } catch (err) {
      console.error(err);
    }
  }

  async crawl(url) {
    try {
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

      const promises = $('a')
        .map((index, element) => $(element).attr('href'))
        .get()
        .filter(link => this.isValidUrl(link))
        .filter(link => !this.isExternalUrl(link))
        .filter(link => !this.isPageCompleted(link))
        .filter(link => this.skippedPages.indexOf(link) === -1)
        .map(async link => {
          await this.crawl(link);
        });

        return Promise.all(promises);
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

  isPageCompleted(url) {
    return !!this.completedPages[url];
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
