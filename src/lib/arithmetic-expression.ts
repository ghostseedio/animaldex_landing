/**
 * Minimal, dependency-free evaluator for the arithmetic expressions used by the
 * home-page phone scroll animation (`src/data/phone.json`), e.g. `"{p} * -8 - 6"`
 * or `"(1 - {p}) * 5"`. It replaces a full `mathjs` import that shipped ~165 KB
 * (brotli) of JavaScript on the home page to evaluate a handful of linear
 * expressions.
 *
 * Supports: decimal numbers, `+ - * /`, parentheses and unary minus/plus.
 * Does NOT support identifiers, functions or any other syntax — callers must
 * substitute variables (such as `{p}`) with numbers before calling.
 *
 * Throws on malformed input rather than returning a wrong number silently.
 */
export function evaluateArithmetic(expression: string): number {
    let index = 0;
    const input = expression;

    const skipWhitespace = () => {
        while (index < input.length && input[index] === " ") index++;
    };

    // expr := term (("+" | "-") term)*
    const parseExpression = (): number => {
        let value = parseTerm();
        for (;;) {
            skipWhitespace();
            const operator = input[index];
            if (operator === "+" || operator === "-") {
                index++;
                const right = parseTerm();
                value = operator === "+" ? value + right : value - right;
            } else {
                return value;
            }
        }
    };

    // term := factor (("*" | "/") factor)*
    const parseTerm = (): number => {
        let value = parseFactor();
        for (;;) {
            skipWhitespace();
            const operator = input[index];
            if (operator === "*" || operator === "/") {
                index++;
                const right = parseFactor();
                value = operator === "*" ? value * right : value / right;
            } else {
                return value;
            }
        }
    };

    // factor := ("+" | "-") factor | "(" expr ")" | number
    const parseFactor = (): number => {
        skipWhitespace();
        const char = input[index];

        if (char === "+") {
            index++;
            return parseFactor();
        }
        if (char === "-") {
            index++;
            return -parseFactor();
        }
        if (char === "(") {
            index++;
            const value = parseExpression();
            skipWhitespace();
            if (input[index] !== ")") {
                throw new Error(`Unbalanced parenthesis in "${input}"`);
            }
            index++;
            return value;
        }

        const start = index;
        while (index < input.length && /[0-9.]/.test(input[index])) index++;
        if (index === start) {
            throw new Error(`Unexpected token "${char ?? "end of input"}" in "${input}"`);
        }
        const value = Number(input.slice(start, index));
        if (Number.isNaN(value)) {
            throw new Error(`Invalid number "${input.slice(start, index)}" in "${input}"`);
        }
        return value;
    };

    const result = parseExpression();
    skipWhitespace();
    if (index !== input.length) {
        throw new Error(`Unexpected trailing input "${input.slice(index)}" in "${input}"`);
    }
    return result;
}
