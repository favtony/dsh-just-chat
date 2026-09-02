import { Component, type ErrorInfo, type ReactElement, type ReactNode, type RefObject } from 'react';
export declare const SIDEBAR_SECTION_STYLE: {
    readonly display: "block";
    readonly flex: "none";
    readonly minHeight: 0;
};
/** Return false when the expanded workspace browser has collapsed geometry. */
export declare function isExpandedSidebarLayoutUsable(root: HTMLElement): boolean;
export interface SidebarLayoutGuardProps {
    wide: boolean;
    rootRef: RefObject<HTMLDivElement | null>;
    onInvalid: () => void;
    children?: ReactNode;
}
/** Inject scoped layout CSS and disable the plugin after repeated bad geometry. */
export declare function SidebarLayoutGuard({ wide, rootRef, onInvalid, children }: SidebarLayoutGuardProps): ReactElement;
interface SidebarErrorBoundaryProps {
    fallback: ReactNode;
    onError: () => void;
    children?: ReactNode;
}
interface SidebarErrorBoundaryState {
    hasError: boolean;
}
/** Keep a failed plugin render from blanking the host sidebar slot. */
export declare class SidebarErrorBoundary extends Component<SidebarErrorBoundaryProps, SidebarErrorBoundaryState> {
    state: SidebarErrorBoundaryState;
    static getDerivedStateFromError(): SidebarErrorBoundaryState;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    render(): ReactNode;
}
export {};
//# sourceMappingURL=sidebar-layout-guard.d.ts.map