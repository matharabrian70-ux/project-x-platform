const test = require('node:test');
const assert = require('node:assert/strict');
const {
  weightedPipeline,
  profitAndMargin,
  deliveryProgress,
  netProductRevenue,
  weeklyCompletion,
  transition
} = require('../src/domain');

test('weighted pipeline sums deal value multiplied by probability', () => {
  assert.equal(weightedPipeline([{ value: 10000, probability: 0.5 }, { value: 5000, probability: 0.2 }]), 6000);
});

test('freelancer profit and margin reconcile from income and expenses', () => {
  const result = profitAndMargin([{ amount: 5000, kind: 'income' }], [{ amount: 1200, kind: 'expense' }]);
  assert.deepEqual(result, { revenue: 5000, expenses: 1200, profit: 3800, margin: 0.76 });
});

test('client delivery progress is based on completed milestones', () => {
  assert.equal(deliveryProgress([{ status: 'complete' }, { status: 'active' }, { status: 'complete' }]), 2 / 3);
});

test('digital product net revenue subtracts refunds', () => {
  assert.equal(netProductRevenue([{ gross: 1000, refunds: 100 }, { gross: 500, refunds: 0 }]), 1400);
});

test('weekly completion counts completed tasks over all tasks', () => {
  assert.equal(weeklyCompletion([{ status: 'done' }, { status: 'open' }, { status: 'done' }, { status: 'overdue' }]), 0.5);
});

test('invalid delivery state transition is rejected', () => {
  assert.throws(() => transition('complete', 'in_progress', ['approved']), /Invalid transition/);
});
