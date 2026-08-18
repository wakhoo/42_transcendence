import { registerDecorator, ValidationOptions } from 'class-validator';

// Code points that render as nothing or as an ordinary-looking space, so they
// can be used to smuggle whitespace-equivalent content past a plain length check
// (zero-width space/non-joiner/joiner, word joiner, BOM/zero-width no-break space,
// soft hyphen).
const INVISIBLE_CODEPOINTS = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad]);

function containsInvisibleOrWhitespace(value: string): boolean {
    for (const ch of value) {
        const code = ch.codePointAt(0)!;
        if (/\s/.test(ch)) return true;
        if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
        if (INVISIBLE_CODEPOINTS.has(code)) return true;
    }
    return false;
}

export function IsNoInvisibleChars(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'isNoInvisibleChars',
            target: object.constructor,
            propertyName,
            options: {
                message: `${propertyName} must not contain spaces or invisible characters`,
                ...validationOptions,
            },
            validator: {
                validate(value: unknown) {
                    return typeof value === 'string' && value.length > 0 && !containsInvisibleOrWhitespace(value);
                },
            },
        });
    };
}
