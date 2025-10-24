import { OpenAPIV3 } from 'openapi-types';
import { OperationMeta } from './meta';
import type { TRPCRootConfig as RootConfig, AnyRouter, TRPCRouterDef as RouterDef } from '@trpc/server';
/**
 * @public
 */
export declare function generateOpenAPIDocumentFromTRPCRouter<R extends AnyRouter>(inRouter: R, options?: GenerateOpenAPIDocumentOptions<MetaOf<R>>): OpenAPIV3.Document<{}>;
/**
 * @public
 */
export interface GenerateOpenAPIDocumentOptions<M extends OperationMeta> {
    pathPrefix?: string;
    processOperation?: (operation: OpenAPIV3.OperationObject, meta: M | undefined) => OpenAPIV3.OperationObject | void;
}
type MetaOf<R extends AnyRouter> = R extends AnyRouter ? R extends {
    _def: RouterDef<infer RC, any>;
} ? RC extends RootConfig<infer C> ? C['meta'] : never : never : never;
export {};
//# sourceMappingURL=generate.d.ts.map