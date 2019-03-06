const assert = require('assert');
const EmailSender = require('../src/emailSender');

describe('EmailSender tests', () => {
  it('getOpts', () => {
    const template = `
Hello.

{content}

Br,
{senderName}`;
    const smtpConfig = {
      service: "gmail",
      host: "smtp.gmail.com",
      auth: {
        user: "xxx@xxx.com",
        pass: "xxx"
      }
    };
    const toEmail = 'to@test.com';
    const defaultSenderEmail = 'default@test.com';
    const defaultSenderName = 'Jeff Administrator';
    const email = new EmailSender(smtpConfig, template, toEmail, defaultSenderEmail, defaultSenderName);
    assert.equal(email.mailConfig.host, smtpConfig.host);
        
    const senderName = 'Unit Test';
    const senderEmail = 'unit@test.com';
    const content = 'ZZZZ1111';

    const opts = email.getOpts(content, senderEmail, senderName);
    assert.equal(opts.to, toEmail);
    assert.equal(opts.from, senderEmail);
    assert.strictEqual(opts.text.indexOf(content) > -1, true);
    assert.strictEqual(opts.text.indexOf(senderName) > -1, true);    
  });

  it('getOpts default sender', () => {
    const template = `
Hello.

{content}

Br,
{senderName}`;
    const smtpConfig = {
      service: "gmail",
      host: "smtp.gmail.com",
      auth: {
        user: "xxx@xxx.com",
        pass: "xxx"
      }
    };
    const toEmail = 'to@test.com';
    const defaultSenderEmail = 'default@test.com';
    const defaultSenderName = 'Jeff Administrator';
        
    const email = new EmailSender(smtpConfig, template, toEmail, defaultSenderEmail, defaultSenderName);
    assert.equal(email.mailConfig.host, smtpConfig.host);
        
    const senderName = '';
    const senderEmail = '';
    const content = 'ZZZZ1111';
        
    const opts = email.getOpts(content, senderEmail, senderName);
    assert.equal(opts.to, toEmail);
    assert.equal(opts.from, defaultSenderEmail);
    assert.strictEqual(opts.text.indexOf(content) > -1, true);
    assert.strictEqual(opts.text.indexOf(defaultSenderName) > -1, true);        
  });
});