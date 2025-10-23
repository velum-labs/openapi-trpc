import { zodToJsonSchema } from 'zod-to-json-schema'
import { z, ZodFirstPartyTypeKind, ZodTypeAny } from 'zod'
import { OpenAPIV3 } from 'openapi-types'
import { OperationMeta, allowedOperationKeys } from './meta'
import type {
  TRPCRootConfig,
  TRPCRouterDef,
  AnyTRPCRouter,
} from '@trpc/server'

/**
 * @public
 */
export function generateOpenAPIDocumentFromTRPCRouter<R extends AnyTRPCRouter>(
  inRouter: R,
  options: GenerateOpenAPIDocumentOptions<MetaOf<R>> = {},
) {
  const router = inRouter as unknown as InternalRouter
  const procs = router._def.procedures
  const paths: OpenAPIV3.PathsObject = {}
  const processOperation = (
    op: OpenAPIV3.OperationObject,
    meta: MetaOf<R>,
  ): OpenAPIV3.OperationObject => {
    return options.processOperation?.(op, meta) || op
  }
  for (const [procName, proc] of Object.entries(procs)) {
    const procDef = proc._def as InternalProcedureDef

    // ZodArrays are also correct, as .splice(1) will return an empty array
    // it's ok just to return the array itself
    const input =
      getZodTypeName(procDef.inputs[0]) === ZodFirstPartyTypeKind.ZodArray
        ? (procDef.inputs[0] as ZodTypeAny)
        : procDef.inputs
            .slice(1)
            .reduce<any>(
              (acc, cur) => asZodObject(acc).merge(asZodObject(cur)),
              asZodObject(procDef.inputs[0] || z.object({})),
            )
    const output = procDef.output
    const inputSchema = toJsonSchema(input)
    const outputSchema = output
      ? toJsonSchema(
          z.object({
            result: z.object({
              data: asZodType(output),
            }),
          }),
        )
      : undefined
    const key = [
      '',
      ...(options.pathPrefix || '/').split('/').filter(Boolean),
      procName,
    ].join('/')
    const outputDescription =
      output && typeof (asZodType(output) as any).description === 'string'
        ? ((asZodType(output) as any).description as string)
        : ''
    const responses = {
      200: {
        description: outputDescription,
        ...(outputSchema
          ? {
              content: {
                'application/json': {
                  schema: outputSchema as any,
                },
              },
            }
          : {}),
      },
    } as const satisfies OpenAPIV3.ResponsesObject
    const operationInfo: Partial<OpenAPIV3.OperationObject> = {
      tags: procName.split('.').slice(0, -1).slice(0, 1),
    }
    for (const key of allowedOperationKeys) {
      const value = procDef.meta?.[key]
      if (value) {
        operationInfo[key] = value as any
      }
    }
    if (procDef.type === 'query') {
      paths[key] = {
        get: processOperation(
          {
            ...operationInfo,
            operationId: procName,
            responses,
            parameters: [
              {
                in: 'query',
                name: 'input',
                content: {
                  'application/json': {
                    schema: inputSchema as any,
                  },
                },
              },
            ],
          },
          procDef.meta as any,
        ),
      }
    } else {
      paths[key] = {
        post: processOperation(
          {
            ...operationInfo,
            operationId: procName,
            responses,
            requestBody: {
              content: {
                'application/json': {
                  schema: inputSchema as any,
                },
              },
            },
          },
          procDef.meta as any,
        ),
      }
    }
  }
  const api: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title: 'tRPC HTTP-RPC',
      version: '',
    },
    paths,
  }
  return api
}

function getZodTypeName(input: unknown) {
  return (input as { _def?: { typeName?: string } } | undefined)?._def?.typeName
}

function asZodObject(input: unknown): any {
  const typeName = getZodTypeName(input)
  if (
    typeName !== ZodFirstPartyTypeKind.ZodObject &&
    typeName !== ZodFirstPartyTypeKind.ZodVoid &&
    typeName !== ZodFirstPartyTypeKind.ZodOptional
  ) {
    throw new Error('Expected a ZodObject, received: ' + String(input))
  }
  return input as any
}

function asZodType(input: unknown): ZodTypeAny {
  const maybe = input as ZodTypeAny
  if (!maybe || typeof (maybe as any).parse !== 'function') {
    throw new Error('Expected a Zod schema, received: ' + String(input))
  }
  return maybe
}

/**
 * @public
 */
export interface GenerateOpenAPIDocumentOptions<M extends OperationMeta> {
  pathPrefix?: string
  processOperation?: (
    operation: OpenAPIV3.OperationObject,
    meta: M | undefined,
  ) => OpenAPIV3.OperationObject | void
}

function toJsonSchema(input: ZodTypeAny) {
  const { $schema, ...output } = zodToJsonSchema(input)
  return output
}

type MetaOf<R extends AnyTRPCRouter> = R['_def']['_config']['$types']['meta']

// tRPC v11 compatibility types (re-exported names)
type Router<TRoot> = AnyTRPCRouter & { _def: TRPCRouterDef<TRoot, any> }
type RootConfig<T> = TRPCRootConfig<T>
type RouterDef<TRoot, TRecord> = TRPCRouterDef<TRoot, TRecord>

// Internal shapes we rely on at runtime
type InternalProcedureDef = {
  type: 'query' | 'mutation' | 'subscription'
  inputs: unknown[]
  output?: unknown
  meta?: Record<string, unknown>
}
type InternalRouter = {
  _def: {
    procedures: Record<string, { _def: InternalProcedureDef }>
  }
}
