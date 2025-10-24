import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { OperationMeta } from './meta'

const _dummyT = initTRPC.meta<OperationMeta>().create()

const _dummyRouterDef = _dummyT.router({
  hello: _dummyT.router({
    world: _dummyT.procedure
      .meta({ description: 'ok' })
      .input(z.object({ name: z.string() }))
      .output(z.string())
      .query(() => 'hello world'),
  }),
})

export function createDummyRouter(
  t = initTRPC.meta<OperationMeta>().create(),
): typeof _dummyRouterDef {
  return t.router({
    hello: t.router({
      world: t.procedure
        .meta({ description: 'ok' })
        .input(z.object({ name: z.string() }))
        .output(z.string())
        .query(() => 'hello world'),
    }),
  })
}

export type DummyRouter = ReturnType<typeof createDummyRouter>
export type DummyProcedure = ReturnType<
  typeof createDummyRouter
>['hello']['world']
