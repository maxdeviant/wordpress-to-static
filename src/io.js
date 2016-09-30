import fs from 'fs';
import mkdirp from 'mkdirp-promise/lib/node6';

export function createDirectory(directoryPath) {
  return mkdirp(directoryPath);
}

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
