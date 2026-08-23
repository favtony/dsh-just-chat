import { type Domain, type KvTable } from '@deepseek-ai/dsh-storage-domain';
import type { ConversationRecord } from '../shared/types.ts';
/** Durable domain declaration for automatic conversation classification. */
export declare const conversationDomainSpec: {
    name: string;
    version: number;
    tables: {
        conversations: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, ConversationRecord>;
    };
};
/** A typed store over the official storage-domain table. */
export declare class ConversationRecordStore {
    private readonly table;
    constructor(table: KvTable<string, ConversationRecord>);
    /** Read one record by its preallocated session id. */
    get(sessionId: string): ConversationRecord | undefined;
    /** Return a stable snapshot of every stored classification record. */
    list(): readonly ConversationRecord[];
    /** Persist one prepared record before exposing its id to the caller. */
    put(record: ConversationRecord): Promise<void>;
    /** Mark one prepared record active, preserving every immutable field. */
    activate(sessionId: string, cwd: string): Promise<ConversationRecord>;
    /** Remove an abandoned classification record while leaving its directory untouched. */
    delete(sessionId: string): Promise<void>;
    /** Return active records in their initial sidebar order. */
    active(excludedSessionIds?: ReadonlySet<string>): readonly ConversationRecord[];
}
/** Open the plugin domain through the injected official facility. */
export declare function openConversationRecords(ctx: {
    storageDomain: {
        open<S extends typeof conversationDomainSpec>(spec: S): Promise<Domain<S>>;
    };
}): Promise<{
    domain: Domain<typeof conversationDomainSpec>;
    records: ConversationRecordStore;
}>;
//# sourceMappingURL=records.d.ts.map