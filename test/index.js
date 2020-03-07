import * as fl from 'fluture/index.js';
import {equivalence, equality as eq} from 'fluture/test/assertions.js';
import identify from 'sanctuary-type-identifiers';
import {Hook, hook, acquire, runHook, ParallelHook, sequential, hookAll} from '../index.js';
import test from 'oletus';

const id = x => x;
const inc = x => x + 1;
const compose = f => g => x => f (g (x));
const countTo = n => Array.from ({length: n}, (_, i) => i + 1);

const assertType = name => x => {
  const t = identify.parse (identify (x));
  eq (t.namespace) ('fluture');
  eq (t.name) (name);
};

const runParallel = compose (runHook) (sequential);
const effect = fl.value (id);
const delay = compose (fl.chainRej (fl.rejectAfter (50))) (fl.chain (fl.after (50)));

const with42 = Hook.of (42);
const with42p = ParallelHook.of (42);
const liveResource = id => ({id, disposed: 0});
const deadResource = id => ({id, disposed: 1});
const mockAcquire = fl.encase (liveResource);
const mockDispose = resource => fl.attempt (() => { resource.disposed += 1; });
const mockDisposeAsync = compose (delay) (mockDispose);
const mockHook = hook (mockAcquire (1)) (mockDispose);
const mockHook2 = acquire (mockAcquire (2));
const mockParallelHook = ParallelHook (mockHook);

test ('type errors', ({throws}) => {
  throws (() => Hook (null), new TypeError ('Function expected'));
  throws (() => ParallelHook (null), new TypeError ('Hook expected'));
});

test ('assertions', () => {
  assertType ('Hook') (mockHook);
  assertType ('Hook') (mockHook2);
  assertType ('ParallelHook') (mockParallelHook);

  eq (runHook (with42) (id)) (42);
  eq (runHook (fl.map (inc) (with42)) (id)) (43);
  eq (runHook (fl.ap (with42) (Hook.of (inc))) (id)) (43);
  eq (runHook (fl.chain (Hook.of) (with42)) (id)) (42);

  eq (runParallel (with42p) (id)) (42);
  eq (runParallel (fl.map (inc) (with42p)) (id)) (43);

  fl.value (eq (43)) (runParallel (fl.ap (with42p) (ParallelHook.of (inc))) (fl.resolve));

  effect (runHook (mockHook) (compose (fl.resolve) (eq ({id: 1, disposed: 0}))));
  fl.value (eq ({id: 1, disposed: 1})) (runHook (mockHook) (fl.resolve));

  effect (runHook (mockHook2) (compose (fl.resolve) (eq ({id: 2, disposed: 0}))));
  fl.value (eq ({id: 2, disposed: 0})) (runHook (mockHook2) (fl.resolve));

  eq (sequential (mockParallelHook)) (mockHook);

  fl.value (eq ([{id: 1, disposed: 1}, {id: 2, disposed: 0}]))
           (runHook (hookAll ([mockHook, mockHook2])) (fl.resolve));
});

const mockHooks = [hook (mockAcquire (1)) (mockDispose),
                   hook (delay (mockAcquire (2))) (mockDispose),
                   hook (mockAcquire (3)) (mockDisposeAsync),
                   hook (delay (mockAcquire (4))) (mockDisposeAsync),
                   hook (mockAcquire (5)) (mockDispose),
                   hook (delay (mockAcquire (6))) (mockDispose),
                   hook (mockAcquire (7)) (mockDisposeAsync),
                   hook (delay (mockAcquire (8))) (mockDisposeAsync)];

test ('async assertions', () => Promise.all ([
  equivalence (runHook (hook (delay (mockAcquire (1))) (mockDisposeAsync)) (fl.resolve))
              (fl.resolve ({id: 1, disposed: 1})),

  equivalence (runHook (hookAll (mockHooks)) (fl.resolve))
              (fl.resolve (countTo (8).map (deadResource))),

  fl.promise (runHook (hookAll (mockHooks))
                      (compose (fl.resolve) (eq (countTo (8).map (liveResource))))),
]));

const choice = [true, false];
choice.forEach (lr => choice.forEach (ld => choice.forEach (rr => choice.forEach (rd => choice.forEach (ldd => choice.forEach (rdd => choice.forEach (cr => choice.forEach (cd => {
  const name = `left acquire ${
    lr ? 'reject' : 'resolve'
  } ${
    ld ? 'delayed' : 'instantly'
  }; right acquire ${
    rr ? 'reject' : 'resolve'
  } ${
    rd ? 'delayed' : 'instantly'
  }; left disposal resolve ${
    ldd ? 'delayed' : 'instantly'
  }; right disposal resolve ${
    rdd ? 'delayed' : 'instantly'
  }; consumption ${
    cr ? 'reject' : 'resolve'
  } ${
    cd ? 'delayed' : 'instantly'
  }`;

  const leftAcquire = (ld ? delay : id) (lr ? fl.reject ('meh') : fl.resolve (41));
  const rightAcquire = (rd ? delay : id) (rr ? fl.reject ('meh') : fl.resolve (inc));
  const leftDisposal = compose (ldd ? delay : id) (fl.resolve);
  const rightDisposal = compose (rdd ? delay : id) (fl.resolve);
  const consume = compose (cd ? delay : id) (cr ? _ => fl.reject ('meh') : fl.resolve);

  const expected = lr || rr || cr ? fl.reject ('meh') : fl.resolve (42);

  const cancellable = (
    (lr && !ld) ? (false) :
    (rr && !rd) ? (!ld && ldd) :
    (ld || rd || cd || ldd || rdd)
  );

  const it = runParallel (fl.ap (ParallelHook (hook (leftAcquire) (leftDisposal)))
                                (ParallelHook (hook (rightAcquire) (rightDisposal))))
                         (consume);

  test (`parallel result: ${name}`, () => (
    equivalence (it) (expected)
  ));

  test (`parallel cancellation: ${name}`, () => new Promise ((res, rej) => {
    if (cancellable) {
      let cancelled = false;
      const fail = _ => rej (new Error (`Cancellation failed ${cancelled ? '' : 'instantly'}`));
      const cancel = fl.fork (fail) (fail) (it);
      cancel ();
      cancelled = true;
      setTimeout (res, 100);
    } else {
      const cancel = fl.fork (res) (res) (it);
      cancel ();
      rej (new Error ('Did not settle immediately'));
    }
  }));
}))))))));
