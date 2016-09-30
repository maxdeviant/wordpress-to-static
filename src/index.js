import path from 'path';
import Compiler from './compiler';

const compiler = new Compiler({
  outputDirectory: path.join(__dirname, '../dist'),
  testingUrl: 'http://remarksoftware.com',
  productionUrl: 'http://remarksoftware.com',
  themeUrl: 'http://gravictest2/remark',
  blacklist: [
    '/wp-content/',
    '/support/kb/'
  ]
});

(async () => {
  const [ elapsedSeconds, elapsedNanoseconds ] = await compiler.compile();
  console.log(`Done in ${elapsedSeconds}s ${elapsedNanoseconds}ns!`);
})();
