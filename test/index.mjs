import {deepStrictEqual} from 'assert';
import {Future, attempt, value, resolve, map, ap, chain} from 'fluture/index.js';
import {equivalence} from 'fluture/test/assertions.js';
import identify from 'sanctuary-type-identifiers';
import {Hook, hook, acquire, runHook, ParallelHook, sequential, hookAll} from '../index.js';
import test from 'oletus'

const crash = e => Future (() => { throw e });

const id = x => x;
const inc = x => x + 1;
const compose = f => g => x => f (g (x));
const eq = a => b => { deepStrictEqual (a, b) };

const assertType = name => x => {
  const t = identify.parse (identify (x));
  eq (t.namespace) ('fluture');
  eq (t.name) (name);
}

const runParallel = compose (runHook) (sequential);
const effect = value (id);

const with42 = Hook.of (42);
const with42p = ParallelHook.of (42);
const mockAcquire = id => attempt (() => ({id, disposed: false}));
const mockDispose = resource => attempt (() => { resource.disposed = true });
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
  eq (runHook (map (inc) (with42)) (id)) (43);
  eq (runHook (ap (with42) (Hook.of (inc))) (id)) (43);
  eq (runHook (chain (Hook.of) (with42)) (id)) (42);

  eq (runParallel (with42p) (id)) (42);
  eq (runParallel (map (inc) (with42p)) (id)) (43);

  value (eq (43)) (runParallel (ap (with42p) (ParallelHook.of (inc))) (resolve));

  effect (runHook (mockHook) (compose (resolve) (eq ({id: 1, disposed: false}))));
  value (eq ({id: 1, disposed: true})) (runHook (mockHook) (resolve));

  effect (runHook (mockHook2) (compose (resolve) (eq ({id: 2, disposed: false}))));
  value (eq ({id: 2, disposed: false})) (runHook (mockHook2) (resolve));

  eq (sequential (mockParallelHook)) (mockHook);

  value (eq ([{id: 1, disposed: true}, {id: 2, disposed: false}]))
        (runHook (hookAll ([mockHook, mockHook2])) (resolve));
});
