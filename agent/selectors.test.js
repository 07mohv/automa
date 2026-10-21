const assert = require('node:assert/strict');
const test = require('node:test');
const { candidatesFromDescriptor, judgeSelector } = require('./selectors');

test('stable attributes outrank tags, text, and positional selectors', () => {
  const ranked = candidatesFromDescriptor({
    tag: 'input',
    id: 'ember123',
    text: '',
    attributes: {
      name: 'custname',
      type: 'text',
      placeholder: 'Customer name',
      'data-testid': 'customer-name',
    },
  });
  assert.equal(ranked[0].reason, 'data-testid');
  assert.equal(ranked[0].verdict, 'stable');
  assert.ok(ranked.some((item) => item.reason === 'name'));
  assert.equal(
    ranked.find((item) => item.selector.includes('#ember123')),
    undefined
  );
  assert.ok(
    ranked[0].score > ranked.find((item) => item.reason === 'name').score
  );
});

test('a generated id is fragile and a landmark tag is only ok', () => {
  assert.equal(judgeSelector('div#ember123').verdict, 'fragile');
  assert.equal(
    judgeSelector('html > body > div:nth-child(1) > div:nth-child(2)').verdict,
    'fragile'
  );
  assert.equal(judgeSelector('*').verdict, 'fragile');
  assert.equal(judgeSelector('h1').verdict, 'ok');
  assert.equal(
    judgeSelector('a[href="https://www.iana.org/domains/example"]').verdict,
    'stable'
  );
});

test('button text becomes an :equal selector and is not used for headings', () => {
  const button = candidatesFromDescriptor({
    tag: 'button',
    text: 'Submit',
    attributes: { type: 'submit' },
  });
  assert.ok(button.some((item) => item.selector === 'button:equal("Submit")'));
  assert.equal(
    button.find((item) => item.selector === 'button:equal("Submit")').verdict,
    'ok'
  );

  const heading = candidatesFromDescriptor({
    tag: 'h1',
    text: 'Example Domain',
    attributes: {},
  });
  assert.equal(heading.length, 1);
  assert.equal(String(heading[0].selector), 'h1');
  assert.equal(heading[0].verdict, 'ok');
});

test('a form field prefers name over a bare tag', () => {
  const field = candidatesFromDescriptor({
    tag: 'input',
    text: '',
    attributes: { name: 'custname', type: 'text' },
  });
  assert.equal(field[0].selector, 'input[name="custname"]');
  assert.equal(field[0].verdict, 'stable');
  assert.equal(
    field.find((item) => item.selector === 'input'),
    undefined
  );
});
