import path from 'path';
import Compiler from './compiler';

const compiler = new Compiler({
  outputDirectory: path.join(__dirname, '../dist'),
  testingUrl: 'http://remarksoftware.com',
  productionUrl: 'http://remarksoftware.com',
  themeUrl: 'http://gravictest2/remark'
});

compiler.compile();
