import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import { allowedOperationKeys } from './meta';
// Type name constants for compatibility with both Zod 3 and Zod 4
const ZodTypeNames = {
    ZodArray: 'ZodArray',
    ZodObject: 'ZodObject',
    ZodVoid: 'ZodVoid',
    ZodOptional: 'ZodOptional',
};
/**
 * @public
 */
export function generateOpenAPIDocumentFromTRPCRouter(inRouter, options = {}) {
    const procs = inRouter._def.procedures;
    const paths = {};
    const processOperation = (op, meta) => {
        return options.processOperation?.(op, meta) || op;
    };
    for (const [procName, proc] of Object.entries(procs)) {
        const procDef = proc._def;
        // ZodArrays are also correct, as .splice(1) will return an empty array
        // it's ok just to return the array itself
        const input = getZodTypeName(procDef.inputs[0]) === ZodTypeNames.ZodArray
            ? procDef.inputs[0]
            : procDef.inputs
                .slice(1)
                .reduce((acc, cur) => asZodObject(acc).merge(asZodObject(cur)), asZodObject(procDef.inputs[0] || z.object({})));
        const output = procDef.output;
        const inputSchema = toJsonSchema(input);
        const outputSchema = output
            ? toJsonSchema(z.object({
                result: z.object({
                    data: asZodType(output),
                }),
            }))
            : undefined;
        const key = [
            '',
            ...(options.pathPrefix || '/').split('/').filter(Boolean),
            procName,
        ].join('/');
        const responses = {
            200: {
                description: (output && asZodType(output).description) || '',
                ...(outputSchema
                    ? {
                        content: {
                            'application/json': {
                                schema: outputSchema,
                            },
                        },
                    }
                    : {}),
            },
        };
        const operationInfo = {
            tags: procName.split('.').slice(0, -1).slice(0, 1),
        };
        for (const key of allowedOperationKeys) {
            const value = procDef.meta?.[key];
            if (value) {
                operationInfo[key] = value;
            }
        }
        if (procDef.type === 'query') {
            paths[key] = {
                get: processOperation({
                    ...operationInfo,
                    operationId: procName,
                    responses,
                    parameters: [
                        {
                            in: 'query',
                            name: 'input',
                            content: {
                                'application/json': {
                                    schema: inputSchema,
                                },
                            },
                        },
                    ],
                }, procDef.meta),
            };
        }
        else {
            paths[key] = {
                post: processOperation({
                    ...operationInfo,
                    operationId: procName,
                    responses,
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: inputSchema,
                            },
                        },
                    },
                }, procDef.meta),
            };
        }
    }
    const api = {
        openapi: '3.0.0',
        info: {
            title: 'tRPC HTTP-RPC',
            version: '',
        },
        paths,
    };
    return api;
}
function getZodTypeName(input) {
    const schema = input;
    // Zod 3 uses _def.typeName (e.g., "ZodObject")
    // Zod 4 uses _def.type or def.type (e.g., "object")
    const typeName = schema?._def?.typeName || schema?._def?.type || schema?.def?.type;
    // Normalize to Zod 3 format for consistency
    if (typeName && !typeName.startsWith('Zod')) {
        return 'Zod' + typeName.charAt(0).toUpperCase() + typeName.slice(1);
    }
    return typeName;
}
function asZodObject(input) {
    const typeName = getZodTypeName(input);
    if (typeName !== ZodTypeNames.ZodObject &&
        typeName !== ZodTypeNames.ZodVoid &&
        typeName !== ZodTypeNames.ZodOptional) {
        throw new Error(`Expected a ZodObject, ZodVoid, or ZodOptional, but got typeName: ${typeName}. Input: ${JSON.stringify({
            hasZDef: !!input?._def,
            hasDef: !!input?.def,
            zDefType: input?._def?.type,
            defType: input?.def?.type,
            zDefTypeName: input?._def?.typeName,
        })}`);
    }
    return input;
}
function asZodType(input) {
    if (!getZodTypeName(input)) {
        throw new Error('Expected a Zod schema, received: ' + String(input));
    }
    return input;
}
/**
 * Convert a Zod schema to JSON Schema, with compatibility for both Zod 3 and Zod 4
 */
function toJsonSchema(input) {
    // Zod 4 has built-in JSON Schema support via z.toJSONSchema
    // Check if it's available and use it, otherwise fall back to zod-to-json-schema (for Zod 3)
    if (typeof z.toJSONSchema === 'function') {
        // Zod 4 - use built-in JSON Schema conversion
        try {
            const result = z.toJSONSchema(input);
            // Remove $schema property if present for consistency
            const { $schema, ...output } = result;
            return output;
        }
        catch (error) {
            // If Zod 4's toJSONSchema fails, fall back to zod-to-json-schema
            const { $schema, ...output } = zodToJsonSchema(input);
            return output;
        }
    }
    else {
        // Zod 3 - use zod-to-json-schema
        const { $schema, ...output } = zodToJsonSchema(input);
        return output;
    }
}
//# sourceMappingURL=generate.js.map