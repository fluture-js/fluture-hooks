import {deepStrictEqual} from 'assert';
import * as fl from 'fluture/index.js';
import {equivalence, equality as eq} from 'fluture/test/assertions.js';
import identify from 'sanctuary-type-identifiers';
import {Hook, hook, acquire, runHook, ParallelHook, sequential, hookAll} from '../index.js';
import test from 'oletus'

const crash = e => fl.Future (() => { throw e });

const id = x => x;
const inc = x => x + 1;
const compose = f => g => x => f (g (x));

const assertType = name => x => {
  const t = identify.parse (identify (x));
  eq (t.namespace) ('fluture');
  eq (t.name) (name);
}

const runParallel = compose (runHook) (sequential);
const effect = fl.value (id);

const with42 = Hook.of (42);
const with42p = ParallelHook.of (42);
const mockAcquire = id => fl.attempt (() => ({id, disposed: false}));
const mockDispose = resource => fl.attempt (() => { resource.disposed = true });
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

  effect (runHook (mockHook) (compose (fl.resolve) (eq ({id: 1, disposed: false}))));
  fl.value (eq ({id: 1, disposed: true})) (runHook (mockHook) (fl.resolve));

  effect (runHook (mockHook2) (compose (fl.resolve) (eq ({id: 2, disposed: false}))));
  fl.value (eq ({id: 2, disposed: false})) (runHook (mockHook2) (fl.resolve));

  eq (sequential (mockParallelHook)) (mockHook);

  fl.value (eq ([{id: 1, disposed: true}, {id: 2, disposed: false}]))
           (runHook (hookAll ([mockHook, mockHook2])) (fl.resolve));
});

const delay = fl.chain (fl.after (10));
const mockDisposeAsync = compose (delay) (mockDispose);

const mockHooks = [ hook (mockAcquire (1)) (mockDispose)
                  , hook (delay (mockAcquire (2))) (mockDispose)
                  , hook (mockAcquire (3)) (mockDisposeAsync)
                  , hook (delay (mockAcquire (4))) (mockDisposeAsync)
                  , hook (mockAcquire (5)) (mockDispose)
                  , hook (delay (mockAcquire (6))) (mockDispose)
                  , hook (mockAcquire (7)) (mockDisposeAsync)
                  , hook (delay (mockAcquire (8))) (mockDisposeAsync) ];

test ('async assertions', () => Promise.all ([
  equivalence (runHook (hook (delay (mockAcquire (1))) (mockDisposeAsync))
                       (fl.resolve))
              (fl.resolve ({id: 1, disposed: true})),

  equivalence (runHook (hookAll (mockHooks)) (fl.resolve))
              (fl.resolve ([ {id: 1, disposed: true}
                           , {id: 2, disposed: true}
                           , {id: 3, disposed: true}
                           , {id: 4, disposed: true}
                           , {id: 5, disposed: true}
                           , {id: 6, disposed: true}
                           , {id: 7, disposed: true}
                           , {id: 8, disposed: true} ])),

  fl.promise (runHook (hookAll (mockHooks))
                      (compose (fl.resolve) (eq ([ {id: 1, disposed: false}
                                                 , {id: 2, disposed: false}
                                                 , {id: 3, disposed: false}
                                                 , {id: 4, disposed: false}
                                                 , {id: 5, disposed: false}
                                                 , {id: 6, disposed: false}
                                                 , {id: 7, disposed: false}
                                                 , {id: 8, disposed: false} ])))),
]));
