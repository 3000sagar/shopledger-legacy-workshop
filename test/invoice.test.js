var assert = require('node:assert/strict');
var test = require('node:test');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice uses the order GST slab and produces the amount the customer was billed', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '', total: billed.total });

  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
});

test('invoice applies the same capped coupon and post-discount GST as order pricing', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10', total: billed.total });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 142.5);
  assert.equal(billed.total, 2992.5);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice rendering omits a reconciliation warning when its total matches the recorded billed total', function () {
  var html = invoice.render({
    id: 42,
    items: [{ name: 'Rice', price: 100, qty: 1, hsn: '1006' }],
    coupon: '',
    total: 105
  });

  assert.match(html, /Invoice Total/);
  assert.match(html, /<td>CGST<\/td><td class="r">₹2\.50<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">₹2\.50<\/td>/);
  assert.doesNotMatch(html, /differs from Order Ledger/);
});

test('invoice follows pricing GST rate interpretation for a decimal gstRate', function () {
  var items = [{ id: 1, name: 'Tea', hsn: '0902', gstRate: 0.05, price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(invoiced.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice GST split follows pricing rounding for small lines', function () {
  var items = [
    { id: 1, name: 'Item A', price: 0.03, qty: 1, gstRate: 10 },
    { id: 2, name: 'Item B', price: 0.03, qty: 1, gstRate: 10 }
  ];
  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
});

test('invoice recomputes figures from line items rather than recorded summary fields', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Staples', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 80,
    discount: 5,
    tax: 9,
    total: 84
  });

  assert.equal(figures.subtotal, 100);
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 18);
  assert.equal(figures.total, 118);
});
