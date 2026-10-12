import {strict as assert} from "node:assert";
import {test} from "node:test";
import {evaluateArithmetic} from "./arithmetic-expression";

test("evaluates the expression forms used by the phone animation", () => {
    // Mirrors every distinct expression shape in src/data/phone.json after {p}
    // substitution, compared against plain JS arithmetic.
    const cases: Array<[string, number]> = [
        ["0.5", 0.5],
        ["(1 - 0.5) * 5", (1 - 0.5) * 5],
        ["0.25 * -16 - 12", 0.25 * -16 - 12],
        ["0.75 * -400 - 70", 0.75 * -400 - 70],
        ["0.1 * 110 + 60", 0.1 * 110 + 60],
        ["0 * 4", 0],
        ["1 * -3", -3],
        ["-0.2 * -8 - 6", -0.2 * -8 - 6]
    ];
    for (const [expr, expected] of cases) {
        assert.equal(evaluateArithmetic(expr), expected, expr);
    }
});

test("honours operator precedence and parentheses", () => {
    assert.equal(evaluateArithmetic("2 + 3 * 4"), 14);
    assert.equal(evaluateArithmetic("(2 + 3) * 4"), 20);
    assert.equal(evaluateArithmetic("10 / 4"), 2.5);
    assert.equal(evaluateArithmetic("-(3 - 5)"), 2);
});

test("rejects malformed or unsupported input", () => {
    assert.throws(() => evaluateArithmetic("2 +"));
    assert.throws(() => evaluateArithmetic("(1 + 2"));
    assert.throws(() => evaluateArithmetic("sin(1)"));
    assert.throws(() => evaluateArithmetic("2 2"));
});
