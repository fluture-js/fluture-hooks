import {deepStrictEqual} from 'assert';
import {attempt, value, resolve, map, ap, chain} from 'fluture';
import identify from 'sanctuary-type-identifiers';
import {Hook, hook, acquire, runHook, ParallelHook, sequential, hookAll} from '..';

const id = x => x;
const inc = x => x + 1;
const compose = f => g => x => f (g (x));
const eq = a => b => { deepStrictEqual (a, b) };

const assertType = name => x => {
  const t = identify.parse (identify (x));
  eq (t.namespace) ('fluture');
  eq (t.name) (name);
}

const runParallel = f => compose (runHook (f)) (sequential);
const effect = value (id);

const with42 = Hook.of (42);
const with42p = ParallelHook.of (42);
const mockAcquire = attempt (() => ({disposed: false}));
const mockDispose = resource => attempt (() => { resource.disposed = true });
const mockHook = hook (mockAcquire) (mockDispose);
const mockHook2 = acquire (mockAcquire);
const mockParallelHook = ParallelHook (mockHook);

assertType ('Hook') (mockHook);
assertType ('Hook') (mockHook2);
assertType ('ParallelHook') (mockParallelHook);

eq (runHook (id) (with42)) (42);
eq (runHook (id) (map (inc) (with42))) (43);
eq (runHook (id) (ap (Hook.of (inc)) (with42))) (43);
eq (runHook (id) (chain (Hook.of) (with42))) (42);

eq (runParallel (id) (with42p)) (42);
eq (runParallel (id) (map (inc) (with42p))) (43);

value (eq (43)) (runParallel (resolve) (ap (ParallelHook.of (inc)) (with42p)));

effect (runHook (compose (resolve) (eq ({disposed: false}))) (mockHook));
value (eq ({disposed: true})) (runHook (resolve) (mockHook));

effect (runHook (compose (resolve) (eq ({disposed: false}))) (mockHook2));
value (eq ({disposed: false})) (runHook (resolve) (mockHook2));

eq (sequential (mockParallelHook)) (mockHook);
value (eq ([{disposed: true}, {disposed: true}])) (runHook (resolve) (hookAll ([mockHook, mockHook])));

console.log('Tests pass');
