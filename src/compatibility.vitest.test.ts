import { describe, it, expect } from 'vitest'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { generateOpenAPIDocumentFromTRPCRouter } from './generate'
import { OperationMeta } from './meta'

describe('Zod 4 and tRPC 11 Compatibility', () => {
  describe('Basic Router Generation', () => {
    it('should generate OpenAPI document with simple query procedure', () => {
      const t = initTRPC.create()
      const router = t.router({
        hello: t.procedure
          .input(z.object({ name: z.string() }))
          .output(z.string())
          .query(() => 'hello'),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router, {
        pathPrefix: '/trpc',
      })

      expect(doc).toBeDefined()
      expect(doc.openapi).toBe('3.0.0')
      expect(doc.paths).toBeDefined()
      expect(doc.paths['/trpc/hello']).toBeDefined()
      expect(doc.paths['/trpc/hello'].get).toBeDefined()
    })

    it('should generate OpenAPI document with mutation procedure', () => {
      const t = initTRPC.create()
      const router = t.router({
        createUser: t.procedure
          .input(z.object({ name: z.string(), email: z.string().email() }))
          .output(z.object({ id: z.string(), name: z.string() }))
          .mutation(() => ({ id: '1', name: 'test' })),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router, {
        pathPrefix: '/api',
      })

      expect(doc.paths['/api/createUser']).toBeDefined()
      expect(doc.paths['/api/createUser'].post).toBeDefined()
      expect(doc.paths['/api/createUser'].post?.requestBody).toBeDefined()
    })

    it('should handle procedure without input', () => {
      const t = initTRPC.create()
      const router = t.router({
        getAll: t.procedure.output(z.array(z.string())).query(() => []),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router, {
        pathPrefix: '/trpc',
      })

      expect(doc.paths['/trpc/getAll']).toBeDefined()
      expect(doc.paths['/trpc/getAll'].get).toBeDefined()
    })
  })

  describe('Zod 4 Schema Support', () => {
    it('should handle Zod object schemas', () => {
      const t = initTRPC.create()
      const router = t.router({
        test: t.procedure
          .input(
            z.object({
              name: z.string(),
              age: z.number(),
              email: z.string().email().optional(),
            }),
          )
          .query(() => null),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/test']).toBeDefined()
      const params = doc.paths['/test'].get?.parameters
      expect(params).toBeDefined()
      expect(params?.[0].content?.['application/json'].schema).toBeDefined()
    })

    it('should handle Zod array schemas', () => {
      const t = initTRPC.create()
      const router = t.router({
        test: t.procedure.input(z.array(z.string())).query(() => null),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/test']).toBeDefined()
      const params = doc.paths['/test'].get?.parameters
      expect(params).toBeDefined()
    })

    it('should handle optional Zod object schemas', () => {
      const t = initTRPC.create()
      const router = t.router({
        test: t.procedure
          .input(z.object({ value: z.string() }).optional())
          .query(() => null),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/test']).toBeDefined()
    })

    it('should handle nested Zod objects', () => {
      const t = initTRPC.create()
      const router = t.router({
        test: t.procedure
          .input(
            z.object({
              user: z.object({
                name: z.string(),
                profile: z.object({
                  bio: z.string(),
                  age: z.number(),
                }),
              }),
            }),
          )
          .query(() => null),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/test']).toBeDefined()
    })

    it('should handle Zod enums', () => {
      const t = initTRPC.create()
      const router = t.router({
        test: t.procedure
          .input(
            z.object({
              status: z.enum(['active', 'inactive', 'pending']),
            }),
          )
          .query(() => null),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/test']).toBeDefined()
    })

    it('should handle Zod unions', () => {
      const t = initTRPC.create()
      const router = t.router({
        test: t.procedure
          .input(
            z.object({
              value: z.union([z.string(), z.number()]),
            }),
          )
          .query(() => null),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/test']).toBeDefined()
    })
  })

  describe('tRPC 11 Features', () => {
    it('should handle meta information', () => {
      interface AppMeta extends OperationMeta {
        requiresAuth?: boolean
        rateLimit?: number
      }

      const t = initTRPC.meta<AppMeta>().create()
      const router = t.router({
        public: t.procedure
          .meta({ summary: 'Public endpoint' })
          .query(() => null),
        private: t.procedure
          .meta({
            summary: 'Private endpoint',
            requiresAuth: true,
            description: 'Requires authentication',
          })
          .query(() => null),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router, {
        pathPrefix: '/api',
        processOperation: (op, meta: any) => {
          if (meta?.requiresAuth) {
            op.security = [{ bearerAuth: [] }]
          }
          return op
        },
      })

      expect(doc.paths['/api/public']).toBeDefined()
      expect(doc.paths['/api/public'].get?.summary).toBe('Public endpoint')
      expect(doc.paths['/api/private']).toBeDefined()
      expect(doc.paths['/api/private'].get?.summary).toBe('Private endpoint')
      expect(doc.paths['/api/private'].get?.description).toBe(
        'Requires authentication',
      )
      expect(doc.paths['/api/private'].get?.security).toEqual([
        { bearerAuth: [] },
      ])
    })

    it('should handle nested routers', () => {
      const t = initTRPC.create()
      const router = t.router({
        users: t.router({
          getAll: t.procedure.query(() => []),
          getById: t.procedure
            .input(z.object({ id: z.string() }))
            .query(() => null),
        }),
        posts: t.router({
          getAll: t.procedure.query(() => []),
          create: t.procedure
            .input(z.object({ title: z.string() }))
            .mutation(() => null),
        }),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/users.getAll']).toBeDefined()
      expect(doc.paths['/users.getById']).toBeDefined()
      expect(doc.paths['/posts.getAll']).toBeDefined()
      expect(doc.paths['/posts.create']).toBeDefined()
    })

    it('should handle output schemas', () => {
      const t = initTRPC.create()
      const router = t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(
            z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().email(),
            }),
          )
          .query(() => ({ id: '1', name: 'Test', email: 'test@example.com' })),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/getUser']).toBeDefined()
      expect(doc.paths['/getUser'].get?.responses['200']).toBeDefined()
      expect(
        doc.paths['/getUser'].get?.responses['200'].content?.[
          'application/json'
        ],
      ).toBeDefined()
    })
  })

  describe('Path Prefix', () => {
    it('should respect pathPrefix option', () => {
      const t = initTRPC.create()
      const router = t.router({
        test: t.procedure.query(() => null),
      })

      const doc1 = generateOpenAPIDocumentFromTRPCRouter(router, {
        pathPrefix: '/api/v1',
      })
      expect(doc1.paths['/api/v1/test']).toBeDefined()

      const doc2 = generateOpenAPIDocumentFromTRPCRouter(router, {
        pathPrefix: '/trpc',
      })
      expect(doc2.paths['/trpc/test']).toBeDefined()

      const doc3 = generateOpenAPIDocumentFromTRPCRouter(router)
      expect(doc3.paths['/test']).toBeDefined()
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle a realistic API with multiple procedures', () => {
      const t = initTRPC.meta<OperationMeta>().create()

      const userRouter = t.router({
        list: t.procedure
          .meta({
            summary: 'List all users',
            description: 'Returns a paginated list of users',
          })
          .input(
            z.object({
              page: z.number().min(1).optional(),
              limit: z.number().min(1).max(100).optional(),
            }),
          )
          .output(
            z.object({
              users: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  email: z.string().email(),
                }),
              ),
              total: z.number(),
            }),
          )
          .query(() => ({ users: [], total: 0 })),

        create: t.procedure
          .meta({
            summary: 'Create a new user',
            description: 'Creates a new user account',
          })
          .input(
            z.object({
              name: z.string().min(1).max(100),
              email: z.string().email(),
              password: z.string().min(8),
            }),
          )
          .output(
            z.object({
              id: z.string(),
              name: z.string(),
              email: z.string(),
            }),
          )
          .mutation(() => ({ id: '1', name: 'Test', email: 'test@example.com' })),

        update: t.procedure
          .meta({
            summary: 'Update a user',
            description: 'Updates an existing user',
          })
          .input(
            z.object({
              id: z.string(),
              name: z.string().optional(),
              email: z.string().email().optional(),
            }),
          )
          .output(z.object({ success: z.boolean() }))
          .mutation(() => ({ success: true })),
      })

      const router = t.router({
        user: userRouter,
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router, {
        pathPrefix: '/api',
      })

      // Check that all endpoints are present
      expect(doc.paths['/api/user.list']).toBeDefined()
      expect(doc.paths['/api/user.create']).toBeDefined()
      expect(doc.paths['/api/user.update']).toBeDefined()

      // Check query vs mutation
      expect(doc.paths['/api/user.list'].get).toBeDefined()
      expect(doc.paths['/api/user.create'].post).toBeDefined()
      expect(doc.paths['/api/user.update'].post).toBeDefined()

      // Check metadata
      expect(doc.paths['/api/user.list'].get?.summary).toBe('List all users')
      expect(doc.paths['/api/user.create'].post?.summary).toBe(
        'Create a new user',
      )
    })
  })

  describe('JSON Schema Conversion', () => {
    it('should convert Zod schemas to JSON Schema format', () => {
      const t = initTRPC.create()
      const router = t.router({
        test: t.procedure
          .input(
            z.object({
              string: z.string(),
              number: z.number(),
              boolean: z.boolean(),
              array: z.array(z.string()),
              optional: z.string().optional(),
              nullable: z.string().nullable(),
            }),
          )
          .query(() => null),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/test']).toBeDefined()
      const schema =
        doc.paths['/test'].get?.parameters?.[0].content?.['application/json']
          .schema
      expect(schema).toBeDefined()
      expect(schema).toHaveProperty('type')
    })

    it('should handle schema descriptions', () => {
      const t = initTRPC.create()
      const router = t.router({
        test: t.procedure
          .input(
            z
              .object({
                name: z.string().describe('The user name'),
                age: z.number().describe('The user age'),
              })
              .describe('User input data'),
          )
          .output(z.string().describe('Success message'))
          .query(() => 'Success'),
      })

      const doc = generateOpenAPIDocumentFromTRPCRouter(router)

      expect(doc.paths['/test']).toBeDefined()
    })
  })
})
