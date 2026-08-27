import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots';
type SlotName = 'conversation' | 'conversation.hero.workspace' | 'conversation.composer.bar' | 'sidebar.workspaces';
type SlotRegistry = {
    entries(name: SlotName): readonly StoredEntry[];
};
export type LiveComponent<P> = (props: P) => unknown;
export interface LiveEntryContract {
    locale: string;
    children: readonly {
        name: string;
        kind: string;
        scope: string;
    }[];
}
/** Replace only the component pointer of the host's current live entry. */
export declare function installLiveEntry<P>(registry: SlotRegistry, name: SlotName, contract: LiveEntryContract, createAdapter: (official: LiveComponent<P>) => LiveComponent<P>): () => void;
export declare const OFFICIAL_ENTRY_CONTRACTS: {
    readonly conversation: {
        readonly locale: "conversation";
        readonly children: readonly [{
            readonly name: "conversation.session";
            readonly kind: "single";
            readonly scope: "session";
        }, {
            readonly name: "conversation.session.header";
            readonly kind: "single";
            readonly scope: "session";
        }, {
            readonly name: "conversation.composer";
            readonly kind: "chain";
            readonly scope: "session";
        }, {
            readonly name: "conversation.composer.bar";
            readonly kind: "single";
            readonly scope: "session-maybe";
        }, {
            readonly name: "conversation.input.overlay";
            readonly kind: "list";
            readonly scope: "session";
        }, {
            readonly name: "conversation.input.dock";
            readonly kind: "list";
            readonly scope: "session";
        }, {
            readonly name: "conversation.composer.dock";
            readonly kind: "list";
            readonly scope: "session";
        }, {
            readonly name: "conversation.input.left";
            readonly kind: "list";
            readonly scope: "session";
        }, {
            readonly name: "conversation.input.right";
            readonly kind: "list";
            readonly scope: "session";
        }, {
            readonly name: "conversation.hero.brand.mark";
            readonly kind: "single";
            readonly scope: "root";
        }, {
            readonly name: "conversation.hero.workspace";
            readonly kind: "single";
            readonly scope: "root";
        }, {
            readonly name: "conversation.hero.agentPreset";
            readonly kind: "single";
            readonly scope: "root";
        }];
    };
    readonly picker: {
        readonly locale: "workspace";
        readonly children: readonly [{
            readonly name: "conversation.hero.workspace.directoryFlow";
            readonly kind: "single";
            readonly scope: "root";
        }];
    };
    readonly composer: {
        readonly locale: "conversation";
        readonly children: readonly [{
            readonly name: "conversation.input.attachments";
            readonly kind: "single";
            readonly scope: "session-maybe";
        }, {
            readonly name: "conversation.input.plan";
            readonly kind: "single";
            readonly scope: "session";
        }, {
            readonly name: "conversation.input.model";
            readonly kind: "single";
            readonly scope: "session";
        }];
    };
    readonly sidebar: {
        readonly locale: "workspace";
        readonly children: readonly [{
            readonly name: "sidebar.workspaces.directoryFlow";
            readonly kind: "single";
            readonly scope: "root";
        }];
    };
};
export {};
//# sourceMappingURL=live-entry.d.ts.map