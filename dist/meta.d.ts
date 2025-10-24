import { OpenAPIV3 } from 'openapi-types';
export declare const allowedOperationKeys: ("tags" | "summary" | "description" | "externalDocs" | "deprecated")[];
/**
 * @public
 */
export interface OperationMeta extends Pick<OpenAPIV3.OperationObject, typeof allowedOperationKeys[number]> {
}
//# sourceMappingURL=meta.d.ts.map