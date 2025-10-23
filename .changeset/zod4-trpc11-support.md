---
"openapi-trpc": minor
---

Add support for Zod 4 and tRPC 11

This release adds compatibility with Zod 4.x and tRPC 11.x while maintaining backward compatibility with Zod 3.x and tRPC 10.x.

### Breaking Changes
None - this release is fully backward compatible.

### New Features
- Support for Zod 4.0.0+ (in addition to existing Zod 3.20.6+ support)
- Support for tRPC 11.0.0+ (in addition to existing tRPC 10.11.1+ support)
- Automatic detection and use of Zod 4's native `toJSONSchema()` when available
- Fallback to `zod-to-json-schema` for Zod 3 compatibility

### Internal Changes
- Replaced deprecated `ZodFirstPartyTypeKind` enum with string literals for type checking
- Updated type detection to handle both Zod 3 (`_def.typeName`) and Zod 4 (`_def.type`/`def.type`) schemas
- Updated tRPC type imports to use correct type names for v11 (`TRPCRootConfig`, `TRPCRouterDef`, `AnyRouter`)
- Enhanced JSON schema conversion with automatic version detection
- Updated TypeScript to 5.6.3 for better compatibility

### Dependencies
- Updated `zod-to-json-schema` to ^3.24.6
- Updated peer dependencies to accept both major versions:
  - `zod`: `^3.20.6 || ^4.0.0`
  - `@trpc/server`: `^10.11.1 || ^11.0.0`
