import type { ConversationDirectorySettings, PreparationResponse } from '../shared/types.ts';
import { ConversationRecordStore } from './records.ts';
/** Create a prepared directory and durable classification record. */
export declare class ConversationPreparationService {
    private readonly readSettings;
    private readonly records;
    private readonly now;
    private readonly makeId;
    constructor(readSettings: () => ConversationDirectorySettings, records: ConversationRecordStore, now?: () => number, makeId?: () => string);
    /** Validate, create, and persist one preparation without retaining its message. */
    prepare(text: string): Promise<PreparationResponse>;
    private canonicalDirectory;
    private createDirectory;
}
//# sourceMappingURL=preparation.d.ts.map