import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
export declare const inject: string[];
/** Register the pre-session workspace picker after its owning slot is declared. */
export declare function apply(ctx: ClientContext & {
    connection: ConnectionHandle;
}): void;
//# sourceMappingURL=index.d.ts.map