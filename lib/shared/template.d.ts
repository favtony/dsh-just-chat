declare const DEFAULT_TEMPLATE: string;
type TemplateToken = {
    readonly kind: 'literal';
    readonly value: string;
} | {
    readonly kind: 'parameter';
    readonly value: TemplateParameter;
};
type TemplateParameter = 'date.yyyy' | 'date.MM' | 'date.dd' | 'time.HH' | 'time.mm' | 'time.ss' | 'message.firstSentence' | {
    readonly kind: 'message.words';
    readonly count: number;
};
/** The default directory template from the product specification. */
export { DEFAULT_TEMPLATE };
/** Parse one restricted template without evaluating arbitrary expressions. */
export declare function parseTemplate(template: string): readonly TemplateToken[];
/** Render a parsed template with the host-local time and one message. */
export declare function renderTemplate(template: string, message: string, now?: Date): string;
/** Validate a template against a sample message and return its rendered path. */
export declare function previewTemplate(template: string, sampleText: string, now?: Date): string;
//# sourceMappingURL=template.d.ts.map