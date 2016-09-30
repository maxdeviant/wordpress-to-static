import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp-promise/lib/node6';
import request from 'request';
import cheerio from 'cheerio';

export function writeFile(filePath, contents) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    writeStream.on('finish', () => {
      resolve();
    });
    writeStream.on('error', err => {
      reject(err);
    });
    writeStream.write(contents);
    writeStream.end();
  });
}

export function get(url) {
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url,
      headers: {
        'User-Agent': 'request'
      }
    }, (err, response) => {
      if (err) {
        return reject(err);
      }

      return resolve(response);
    });
  })
}

export default class Compiler {
  completedPages = [];
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
      await this.crawl(this.testingUrl);
    } catch (err) {
      console.error(err);
      throw err;
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

      $('a')
        .map((index, element) => $(element).attr('href'))
        .get()
        .filter(link => this.isValidUrl(link))
        .filter(link => !this.isExternalUrl(link))
        .filter(link => this.completedPages.indexOf(link) === -1)
        .filter(link => this.skippedPages.indexOf(link) === -1)
        .forEach(link => {
          this.crawl(link);
        });
    } catch (err) {
      throw err;
    }
  }

  async save(url, contentType, html) {
    const outputDirectory = this.convertUrlToPath(url);
    await mkdirp(outputDirectory);

    const outputFile = path.join(outputDirectory, 'index.html');
    await writeFile(outputFile, html);

    this.completedPages.push(url);
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
