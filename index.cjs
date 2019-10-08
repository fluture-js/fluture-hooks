(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('callgebra'), require('fluture')) :
  typeof define === 'function' && define.amd ? define(['exports', 'callgebra', 'fluture'], factory) :
  (global = global || self, factory(global.flutureHooks = {}, global.callgebra, global.Fluture));
}(this, function (exports, Callback, index_js) { 'use strict';

  //. # Fluture Hooks

  const $of = 'fantasy-land/of';
  const $ap = 'fantasy-land/ap';
  const $map = 'fantasy-land/map';
  const $chain = 'fantasy-land/chain';

  const pure = T => x => T[$of](x);
  const noop = () => {};

  const lift2 = f => a => b => index_js.ap(b)(index_js.map(f)(a));

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
  function Hook(run){
    return new HookFromCallback(run);
  }
  HookFromCallback.prototype = Object.create(Hook.prototype);

  Hook['@@type'] = 'fluture/Hook@1';
  Hook.of = Hook[$of] = x => Hook(Callback.of(x));

  Hook.prototype[$ap] = function(mf){
    return Hook(Callback.ap(mf.run)(this.run));
  };

  Hook.prototype[$map] = function(f){
    return Hook(Callback.map(f)(this.run));
  };

  Hook.prototype[$chain] = function(f){
    return Hook(Callback.chain(x => f(x).run)(this.run));
  };

  //# hook :: Future a b -> (b -> Future c d) -> Hook (Future a e) b
  //.
  //. `hook (m) (f)` is the equivalent of `Hook (Future.hook (m) (f))`.
  const hook = m => f => Hook(index_js.hook(m)(f));

  //# acquire :: Future a b -> Hook (Future a d) b
  //.
  //. Creates a Hook without the need for a disposal function.
  const acquire = m => Hook(f => index_js.chain(f)(m));

  //# runHook :: Hook b a -> (a -> b) -> b
  //.
  //. Given a Hook and a callback, runs the Hook, returning the callbacks' return
  //. value. For Hooks created from Fluture's hook, this means a Future is
  //. retured.
  //.
  //. This function can also be thought of as "untagging" a [`Hook`](#Hook):
  //. `runHook (Hook (h)) = h`.
  const runHook = hook => hook.run;

  //# ParallelHook :: Hook a b -> ParallelHook a b
  //.
  //. Construct a ParallelHook using a Hook.
  //.
  //. `ParallelHook a` has a Functor instance, and `ParallelHook (Future a b)`
  //. has an Applicative instance with parallel behaviour.
  function ParallelHook(hook){
    return new ParallelHookFromHook(hook);
  }

  ParallelHookFromHook.prototype = Object.create(ParallelHook.prototype);

  ParallelHook['@@type'] = 'fluture/ParallelHook@1';
  ParallelHook.of = ParallelHook[$of] = x => ParallelHook(pure(Hook)(x));

  ParallelHook.prototype[$map] = function(f){
    return ParallelHook(index_js.map(f)(this.hook));
  };

  const crash = e => index_js.Future(() => { throw e });

  ParallelHook.prototype[$ap] = function(mf){
    return ParallelHook(Hook(c => {
      let consume = noop;
      const rf = mf.hook.run(f => consume !== noop ? consume (f) : (
        index_js.Future((rej, res) => {
          consume = x => index_js.map(y => (res(y), y))(c(f(x)));
          return noop;
        })
      ));
      const rx = this.hook.run(x => consume !== noop ? consume (x) : (
        index_js.Future((rej, res) => {
          consume = f => index_js.map(y => (res(y), y))(c(f(x)));
          return noop;
        })
      ));
      const transformation = {
        cancel: noop,
        context: rx.context,
        rejected: () => index_js.never,
        resolved: () => index_js.never,
        toString: () => `parallelHookTransform(${rx.toString()})`,
        run: early => {
          const action = Object.create(transformation);
          action.cancel = rx._interpret(
            e => early(crash(e), action),
            x => early(index_js.reject(x), action),
            x => early(index_js.resolve(x), action),
          );
          return action;
        },
      };
      return rf._transform(transformation);
    }));
  };

  //# sequential :: ParallelHook a b -> Hook a b
  //.
  //. Converts a ParallelHook to a normal Hook.
  const sequential = m => m.hook;

  const hookAllReducer = (xs, x) => mappend(xs)(x);

  //# hookAll :: Array (Hook i (Future a b)) -> Hook i (Future a (Array b))
  //.
  //. Combines resources from many hooks into a single hook in parallel.
  //.
  //. `hookAll (hooks)` is the equivalent of
  //. `sequential (sequence (ParallelHook) (map (ParallelHook) (hooks)))` for all
  //. `hooks :: Array (Hook (Future a b) c)`.
  const hookAll = xs => sequential(
    xs.map(ParallelHook).reduce(hookAllReducer, pure(ParallelHook)([]))
  );

  exports.Hook = Hook;
  exports.ParallelHook = ParallelHook;
  exports.acquire = acquire;
  exports.hook = hook;
  exports.hookAll = hookAll;
  exports.runHook = runHook;
  exports.sequential = sequential;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
