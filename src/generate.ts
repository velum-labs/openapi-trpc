import { zodToJsonSchema } from 'zod-to-json-schema'
import { DummyProcedure, DummyRouter } from './dummyRouter'
import { z, ZodType, ZodArray, ZodTypeAny, ZodObject } from 'zod'
import type { ZodRawShape } from 'zod'
import { OpenAPIV3 } from 'openapi-types'
import { OperationMeta, allowedOperationKeys } from './meta'
import type {
  TRPCRootConfig as RootConfig,
  AnyRouter,
  TRPCRouterDef as RouterDef,
} from '@trpc/server'

// Type name constants for compatibility with both Zod 3 and Zod 4
const ZodTypeNames = {
  ZodArray: 'ZodArray',
  ZodObject: 'ZodObject',
  ZodVoid: 'ZodVoid',
  ZodOptional: 'ZodOptional',
} as const

/**
 * @public
 */
export function generateOpenAPIDocumentFromTRPCRouter<R extends AnyRouter>(
  inRouter: R,
  options: GenerateOpenAPIDocumentOptions<MetaOf<R>> = {},
) {
  const router: DummyRouter = inRouter as unknown as DummyRouter
  const procs = (router as any)._def.procedures as Record<string, any>
  const paths: OpenAPIV3.PathsObject = {}
  const processOperation = (
    op: OpenAPIV3.OperationObject,
    meta: MetaOf<R>,
  ): OpenAPIV3.OperationObject => {
    return options.processOperation?.(op, meta) || op
  }
  for (const [procName, proc] of Object.entries(procs)) {
    const procDef = proc._def as any

    // ZodArrays are also correct, as .splice(1) will return an empty array
    // it's ok just to return the array itself
    const input =
      getZodTypeName(procDef.inputs[0]) === ZodTypeNames.ZodArray
        ? (procDef.inputs[0] as ZodArray<ZodTypeAny>)
        : (procDef.inputs as any[])
            .slice(1)
            .reduce(
              (acc: ZodObject<ZodRawShape>, cur: any) =>
                asZodObject(acc).merge(asZodObject(cur)),
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
    const responses = {
      200: {
        description: (output && asZodType(output).description) || '',
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
    }
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

function getZodTypeName(input: unknown): string | undefined {
  const schema = input as { _def?: { typeName?: string; type?: string }; def?: { type?: string } } | undefined
  // Zod 3 uses _def.typeName (e.g., "ZodObject")
  // Zod 4 uses _def.type or def.type (e.g., "object")
  const typeName = schema?._def?.typeName || schema?._def?.type || schema?.def?.type

  // Normalize to Zod 3 format for consistency
  if (typeName && !typeName.startsWith('Zod')) {
    return 'Zod' + typeName.charAt(0).toUpperCase() + typeName.slice(1)
  }
  return typeName
}

function asZodObject(input: unknown) {
  const typeName = getZodTypeName(input)
  if (
    typeName !== ZodTypeNames.ZodObject &&
    typeName !== ZodTypeNames.ZodVoid &&
    typeName !== ZodTypeNames.ZodOptional
  ) {
    throw new Error(
      `Expected a ZodObject, ZodVoid, or ZodOptional, but got typeName: ${typeName}. Input: ${JSON.stringify({
        hasZDef: !!(input as any)?._def,
        hasDef: !!(input as any)?.def,
        zDefType: (input as any)?._def?.type,
        defType: (input as any)?.def?.type,
        zDefTypeName: (input as any)?._def?.typeName,
      })}`,
    )
  }
  return input as ZodObject<ZodRawShape>
}

function asZodType(input: unknown) {
  if (!getZodTypeName(input)) {
    throw new Error('Expected a Zod schema, received: ' + String(input))
  }
  return input as ZodType
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

/**
 * Convert a Zod schema to JSON Schema, with compatibility for both Zod 3 and Zod 4
 */
function toJsonSchema(input: ZodType) {
  // Zod 4 has built-in JSON Schema support via z.toJSONSchema
  // Check if it's available and use it, otherwise fall back to zod-to-json-schema (for Zod 3)
  if (typeof (z as any).toJSONSchema === 'function') {
    // Zod 4 - use built-in JSON Schema conversion
    try {
      const result = (z as any).toJSONSchema(input)
      // Remove $schema property if present for consistency
      const { $schema, ...output } = result
      return output
    } catch (error) {
      // If Zod 4's toJSONSchema fails, fall back to zod-to-json-schema
      const { $schema, ...output } = zodToJsonSchema(input)
      return output
    }
  } else {
    // Zod 3 - use zod-to-json-schema
    const { $schema, ...output} = zodToJsonSchema(input)
    return output
  }
}

type MetaOf<R extends AnyRouter> = R extends AnyRouter
  ? R extends { _def: RouterDef<infer RC, any> }
    ? RC extends RootConfig<infer C>
      ? C['meta']
      : never
    : never
  : never
