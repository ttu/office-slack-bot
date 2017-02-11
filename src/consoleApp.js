const readline = require('readline');
const myBot = require('./bot');

myBot.handle('current').then(result => console.log(result));

myBot.handle('free').then(result => console.log(result));

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', function(line){
    myBot.handle(line).then(result => console.log(result));
});