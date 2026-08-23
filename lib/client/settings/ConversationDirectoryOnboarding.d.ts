import type { SettingsOnboardingOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client';
export interface ConversationDirectoryRequestSource {
    getSnapshot(): 'conversation-directory' | undefined;
    subscribe(listener: () => void): () => void;
}
export interface ConversationDirectoryOnboardingInjected {
    acknowledge(): void;
}
/** 仅在缺少根目录的提交明确请求时挂载设置引导项。 */
export declare function createConversationDirectoryOnboardingRegistration(deps: {
    request: ConversationDirectoryRequestSource;
    register(): () => void;
}): () => void;
/** 通过 DSH 公开的引导 owner 打开插件设置分区，然后结束本次引导请求。 */
export declare function ConversationDirectoryOnboarding(props: SettingsOnboardingOwnerProps & ConversationDirectoryOnboardingInjected): null;
//# sourceMappingURL=ConversationDirectoryOnboarding.d.ts.map