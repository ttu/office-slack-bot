const readline = require('readline');
const myBot = require('./bot');

myBot.setNotifyFunc(output => console.log(`ERROR: ${output}`));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', line => {
  myBot.handle(line, { name: 'console', email: 'console@test.com' }).then(result => console.log(result));
});
