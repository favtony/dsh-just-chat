/** Validate a configured absolute root path without touching the filesystem. */
export declare function validateRootPath(rootDirectory: string): string;
/** Validate a rendered path relative to the configured root. */
export declare function validateRelativePath(relativePath: string): string;
/** Validate one Windows-compatible directory name. */
export declare function validateSegment(segment: string): string;
/** Confirm that a resolved child path remains a strict descendant of its root. */
export declare function isStrictDescendant(rootDirectory: string, childPath: string, relativePath: string): boolean;
//# sourceMappingURL=path.d.ts.map