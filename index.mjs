//. # Fluture Hooks
//.
//. Fantasy Land Monad and Alternative instances for return values from
//. [Fluture's `hook`][hook].
//.
//. [hook]: https://github.com/fluture-js/Fluture#hook
//.
//. ## Usage Example
//.
//. ```js
//. import {Future, node, fork} from 'fluture';
//. import {hook, hookAll, runHook} from 'fluture-hooks';
//.
//. const acquirePostgres = (
//.   node (done => require ('imaginary-postgres').connect (done))
//. );
//.
//. const acquireRedis = (
//.   node (done => require ('imaginary-redis').connect (done))
//. );
//.
//. const closeConnection = connection => (
//.   node (done => connection.end (done))
//. );
//.
//. const postgresHook = hook (acquirePostgres) (closeConnection);
//. const redisHook = hook (acquireRedis) (closeConnection);
//. const servicesHook = hookAll ([postgresHook, redisHook]);
//.
//. const withServices = runHook (servicesHook);
//.
//. fork (console.error)
//.      (console.log)
//.      (withServices (([postgres, redis]) => Future ((rej, res) => {
//.        /* consume postgres and redis */
//.      })));
//. ```

import * as Callback from 'callgebra';
import {
  Future,
  ap,
  chain,
  fold,
  forkCatch,
  hook as baseHook,
  map,
  never,
  race,
  reject,
  resolve,
} from 'fluture';

const $of = 'fantasy-land/of';
const $ap = 'fantasy-land/ap';
const $map = 'fantasy-land/map';
const $chain = 'fantasy-land/chain';

const pure = T => x => T[$of](x);
const noop = () => {};

const lift2 = f => a => b => ap(map(f)(a))(b);

const append = xs => x => xs.concat([x]);
const mappend = lift2(append);

function HookFromCallback(run){
  if(typeof run !== 'function') throw new TypeError('Function expected');
  this.run = run;
}

function ParallelHookFromHook(hook){
  if(!(hook instanceof Hook)) throw new TypeError('Hook expected');
  this.hook = hook;
}

//. ## API
//.
//# Hook :: ((b -> a) -> a) -> Hook a b
//.
//. Tags a function awaiting a callback (such as the value returned by
//. [Fluture's `hook`][hook]) as a "Hook".
//.
//. `Hook a` has Monad instance with sequential behaviour in its Applicative.
//.
//. ```js
//. Hook (Future.hook (myResourceAcquisition) (myResourceDisposal));
//. ```
export function Hook(run){
  return new HookFromCallback(run);
};

HookFromCallback.prototype = Object.create(Hook.prototype);

Hook['@@type'] = 'fluture/Hook@1';
Hook.of = Hook[$of] = x => Hook(Callback.of(x));

Hook.prototype[$ap] = function(mf){
  return Hook(Callback.ap(mf.run)(this.run));
}

Hook.prototype[$map] = function(f){
  return Hook(Callback.map(f)(this.run));
}

Hook.prototype[$chain] = function(f){
  return Hook(Callback.chain(x => f(x).run)(this.run));
}

//# hook :: Future a b -> (b -> Future c d) -> Hook (Future a e) b
//.
//. `hook (m) (f)` is the equivalent of `Hook (Future.hook (m) (f))`.
export const hook = m => f => Hook(baseHook(m, f));

//# acquire :: Future a b -> Hook (Future a d) b
//.
//. Creates a Hook without the need for a disposal function.
export const acquire = m => Hook(f => chain(f)(m));

//# runHook :: Hook b a -> (a -> b) -> b
//.
//. Given a Hook and a callback, runs the Hook, returning the callbacks' return
//. value. For Hooks created from Fluture's hook, this means a Future is
//. retured.
//.
//. This function can also be thought of as "untagging" a [`Hook`](#Hook):
//. `runHook (Hook (h)) = h`.
export const runHook = hook => hook.run;

//# ParallelHook :: Hook a b -> ParallelHook a b
//.
//. Construct a ParallelHook using a Hook.
//.
//. `ParallelHook a` has a Functor instance, and `ParallelHook (Future a b)`
//. has an Applicative instance with parallel behaviour.
export function ParallelHook(hook){
  return new ParallelHookFromHook(hook);
}

ParallelHookFromHook.prototype = Object.create(ParallelHook.prototype);

ParallelHook['@@type'] = 'fluture/ParallelHook@1';
ParallelHook.of = ParallelHook[$of] = x => ParallelHook(pure(Hook)(x));

ParallelHook.prototype[$map] = function(f){
  return ParallelHook(map(f)(this.hook));
}

const CustomFuture = function (interpret) {
  this._interpret = interpret;
}

CustomFuture.prototype = Object.create (Future.prototype);

ParallelHook.prototype[$ap] = function(parallelFunctionHook){
  const withValue = runHook (sequential (this));
  const withFunction = runHook (sequential (parallelFunctionHook));
  return ParallelHook(Hook(consumeResult => {
    let result = null;

    const setResult = value => new CustomFuture (() => {
      result = {value};
      return noop;
    });

    const eventuallyConsumeValue = withValue (val => (
      result ? consumeResult (result.value (val)) : setResult (val)
    ));

    const eventuallyConsumeFunction = withFunction (func => (
      result ? consumeResult (func (result.value)) : setResult (func)
    ));

    return new CustomFuture ((rec, rej, res) => {
      const cancelValue = forkCatch (rec) (rej) (res) (eventuallyConsumeValue);
      const cancelFunction = forkCatch (rec) (rej) (res) (eventuallyConsumeFunction);
      return () => {
        cancelValue();
        cancelFunction();
      };
    });
  }));
}

//# sequential :: ParallelHook a b -> Hook a b
//.
//. Converts a ParallelHook to a normal Hook.
export const sequential = m => m.hook;

const hookAllReducer = (xs, x) => mappend(xs)(x);

//# hookAll :: Array (Hook i (Future a b)) -> Hook i (Future a (Array b))
//.
//. Combines resources from many hooks into a single hook in parallel.
//.
//. `hookAll (hooks)` is the equivalent of
//. `sequential (sequence (ParallelHook) (map (ParallelHook) (hooks)))` for all
//. `hooks :: Array (Hook (Future a b) c)`.
export const hookAll = xs => sequential(
  xs.map(ParallelHook).reduce(hookAllReducer, pure(ParallelHook)([]))
);
