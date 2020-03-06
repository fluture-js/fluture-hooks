# Fluture Hooks

Fantasy Land Monad and Alternative instances for return values from
[Fluture's `hook`][hook].

[hook]: https://github.com/fluture-js/Fluture#hook

## Usage Example

```js
import {Future, node, fork} from 'fluture/index.js';
import {hook, hookAll, runHook} from 'fluture-hooks/index.js';

const acquirePostgres = (
  node (done => require ('imaginary-postgres').connect (done))
);

const acquireRedis = (
  node (done => require ('imaginary-redis').connect (done))
);

const closeConnection = connection => (
  node (done => connection.end (done))
);

const postgresHook = hook (acquirePostgres) (closeConnection);
const redisHook = hook (acquireRedis) (closeConnection);
const servicesHook = hookAll ([postgresHook, redisHook]);

const withServices = runHook (servicesHook);

fork (console.error)
     (console.log)
     (withServices (([postgres, redis]) => Future ((rej, res) => {
       /* consume postgres and redis */
     })));
```

## API

### <a name="Hook" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.js#L72">`Hook :: ((b -⁠> a) -⁠> a) -⁠> Hook a b`</a>

Tags a function awaiting a callback (such as the value returned by
[Fluture's `hook`][hook]) as a "Hook".

`Hook a` has Monad instance with sequential behaviour in its Applicative.

```js
Hook (Future.hook (myResourceAcquisition) (myResourceDisposal));
```

### <a name="hook" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.js#L103">`hook :: Future a b -⁠> (b -⁠> Future c d) -⁠> Hook (Future a e) b`</a>

`hook (m) (f)` is the equivalent of `Hook (Future.hook (m) (f))`.

### <a name="acquire" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.js#L108">`acquire :: Future a b -⁠> Hook (Future a d) b`</a>

Creates a Hook without the need for a disposal function.

### <a name="runHook" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.js#L113">`runHook :: Hook b a -⁠> (a -⁠> b) -⁠> b`</a>

Given a Hook and a callback, runs the Hook, returning the callbacks' return
value. For Hooks created from Fluture's hook, this means a Future is
retured.

This function can also be thought of as "untagging" a [`Hook`](#Hook):
`runHook (Hook (h)) = h`.

### <a name="ParallelHook" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.js#L123">`ParallelHook :: Hook a b -⁠> ParallelHook a b`</a>

Construct a ParallelHook using a Hook.

`ParallelHook a` has a Functor instance, and `ParallelHook (Future a b)`
has an Applicative instance with parallel behaviour.

### <a name="sequential" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.js#L213">`sequential :: ParallelHook a b -⁠> Hook a b`</a>

Converts a ParallelHook to a normal Hook.

### <a name="hookAll" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.js#L220">`hookAll :: Array (Hook (Future a b) c) -⁠> Hook (Future a b) (Array c)`</a>

Combines resources from many hooks into a single hook in parallel, given
that the eventual consumption of this new hook will return a Future.

`hookAll (hooks)` is the equivalent of
`sequential (sequence (ParallelHook) (map (ParallelHook) (hooks)))` for all
`hooks :: Array (Hook (Future a b) c)`.
