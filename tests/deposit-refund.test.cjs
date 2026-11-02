// Booking board "Refund deposit": which deposit is refundable, the confirm/feedback
// text and the refund state shown afterwards. Node's built-in runner; modules are
// transpiled in memory. No DB, network or payment processor.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const source = fs.readFileSync(path.resolve(root, relative), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require });
  return module.exports;
}

const refund = load('features/platform/booking/lib/depositRefund.ts');
const money = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;

test('only a processor-captured deposit with money left is refundable', () => {
  assert.equal(refund.refundableDeposit(null), null);
  assert.equal(refund.refundableDeposit([{ id: 'p', status: 'pending', amount: 1000, processor: true }]), null);
  assert.equal(refund.refundableDeposit([{ id: 'o', status: 'captured', amount: 1000, processor: false }]), null, 'pay-in-person is never refunded here');
  assert.equal(refund.refundableDeposit([{ id: 'r', status: 'refunded', amount: 1000, refundedAmount: 1000, processor: true }]), null);
  const full = refund.refundableDeposit([{ id: 'c', status: 'captured', amount: 1000, refundedAmount: 0, processor: true }]);
  assert.equal(full.id, 'c');
  assert.equal(full.remaining, 1000);
  const part = refund.refundableDeposit([{ id: 'pr', status: 'partially_refunded', amount: 1500, refundedAmount: 500, processor: true }]);
  assert.equal(part.remaining, 1000);
});

test('refund state appears only after money went back', () => {
  assert.equal(refund.depositRefundState([{ id: 'c', status: 'captured', amount: 1000, refundedAmount: 0 }]), null);
  assert.deepEqual({ ...refund.depositRefundState([{ id: 'r', status: 'refunded', amount: 1000, refundedAmount: 1000 }]) }, { tone: 'refunded', refunded: 1000 });
  assert.deepEqual({ ...refund.depositRefundState([{ id: 'p', status: 'partially_refunded', amount: 1500, refundedAmount: 500 }]) }, { tone: 'partial', refunded: 500 });
});

test('feedback reports the verified refund, errors and unmatched results', () => {
  assert.equal(refund.depositRefundFeedback({ success: false, error: 'Payment session in pending state cannot be refunded.' }, 's1', money), 'Payment session in pending state cannot be refunded.');
  assert.equal(refund.depositRefundFeedback({ success: true, paymentSession: { id: 's1', status: 'refunded', amount: 1000, refundedAmount: 1000 } }, 's1', money), 'Deposit refunded: $10.00.');
  assert.equal(refund.depositRefundFeedback({ success: true, paymentSession: { id: 's1', status: 'partially_refunded', amount: 1500, refundedAmount: 500 } }, 's1', money), 'Deposit partly refunded: $5.00 of $15.00.');
  assert.match(refund.depositRefundFeedback({ success: true, paymentSession: { id: 'other', status: 'refunded' } }, 's1', money), /could not be matched/);
});

test('board wiring: confirm dialog, mutation, and payment-permission gate', () => {
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const button = read('features/platform/booking/components/RefundDepositButton.tsx');
  assert.match(button, /AlertDialogTrigger[\s\S]*Refund deposit/);
  assert.match(button, /AlertDialogAction onClick=\{\(\) => onConfirm\(/, 'refund runs only from the confirm action');
  const action = read('features/platform/booking/actions/appointments.ts');
  assert.match(action, /refundAppointmentPaymentSession\(paymentSessionId: \$id, idempotencyKey: \$key\)/);
  const projection = read('features/keystone/queries/getPlatformProjections.ts');
  assert.match(projection, /const canRefund = \(await currentShopForPermission\(context\.session, 'canManagePayments', context\.prisma\)\) === shopId;/);
  assert.match(projection, /const depositRows = canRefund && appointments\.length/);
  assert.match(projection, /depositSessions: canRefund \? /);
  const board = read('features/platform/booking/screens/BookingBoardPageClient.tsx');
  assert.match(board, /data\.canRefundDeposits \? refundableDeposit\(/);
});
