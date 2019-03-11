# Fluture Hooks

Fantasy Land Monad and Alternative instances for return values from
[Fluture's `hook`][hook].

[hook]: https://github.com/fluture-js/Fluture#hook

## Usage Example

```js
import {node, fork} from 'fluture';
import {hook, hookAll, runHook} from 'fluture-hooks';

const acquirePostgres = (
  node (done => require ('imaginary-postgres') .connect (done))
);

const acquireRedis = (
  node(done => require ('imaginary-redis') .connect (done))
);

const closeConnection = connection => (
  node(done => connection.end (done))
);

const withPostgres = hook (acquirePostgres) (closeConnection);
const withRedis = hook (acquireRedis) (closeConnection);

const withServices = hookAll ([withPostgres, withRedis]);

const app = runHook (([postgres, redis]) => {/*...*/});

fork (console.error) (console.log) (app (withServices));
```

## API

### <a name="Hook" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.mjs#L79">`Hook :: ((b -⁠> a) -⁠> a) -⁠> Hook a b`</a>

Tags a function awaiting a callback (such as the value returned by
[Fluture's `hook`][hook]) as a "Hook".

`Hook a` has Monad instance with sequential behaviour in its Applicative.

```js
Hook(Future.hook(myResourceAcquisition, myResourceDisposal));
```

### <a name="hook" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.mjs#L110">`hook :: Future a b -⁠> (b -⁠> Future c d) -⁠> Hook (Future a e) b`</a>

`hook(m)(f)` is the equivalent of `Hook(Future.hook(m, f))`.

### <a name="acquire" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.mjs#L115">`acquire :: Future a b -⁠> Hook (Future a d) b`</a>

Creates a Hook without the need for a disposal function.

### <a name="runHook" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.mjs#L120">`runHook :: Hook b a -⁠> (a -⁠> b) -⁠> b`</a>

Given a Hook and a callback, runs the Hook, returning the callbacks' return
value. For Hooks created from Fluture's hook, this means a Future is
retured.

This function can also be thought of as "untagging" a [`Hook`](#Hook):
`runHook (Hook (h)) = h`.

### <a name="ParallelHook" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.mjs#L130">`ParallelHook :: Hook a b -⁠> ParallelHook a b`</a>

Construct a ParallelHook using a Hook.

`ParallelHook a` has a Functor instance, and `ParallelHook (Future a b)`
has an Applicative instance with parallel behaviour.

### <a name="sequential" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.mjs#L169">`sequential :: ParallelHook a b -⁠> Hook a b`</a>

Converts a ParallelHook to a normal Hook.

### <a name="hookAll" href="https://github.com/fluture-js/fluture-hooks/blob/master/index.mjs#L176">`hookAll :: Array (Hook (Future a b)) -⁠> Hook (Future a (Array b))`</a>

Combines resources from many hooks into a single hook in parallel.

`hookAll (hooks)` is the equivalent of
`sequential (sequence (ParallelHook) (map (ParallelHook) (hooks)))` for all
`hooks :: Array (Hook (Future a b) c)`.
