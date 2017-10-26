/**
 * @license
 * Copyright 2013 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { isBinaryExpression } from "tsutils";
import * as ts from "typescript";

import * as Lint from "../index";

const OPTION_ALLOW_NULL_CHECK = "allow-null-check";
const OPTION_ALLOW_UNDEFINED_CHECK = "allow-undefined-check";

interface Options {
    allowNull: boolean;
    allowUndefined: boolean;
}

type InvalidOperand = "Both" | "Left" | "Right" | "None";

export class Rule extends Lint.Rules.AbstractRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "no-undefined-or-null-comparison",
        description: "Disallows comparisons to `undefined` or `null`.",
        optionsDescription: Lint.Utils.dedent `
            Two arguments may be optionally provided:

            * \`"allow-null-check"\` allows comparisons to \`null\`.
            * \`"allow-undefined-check"\` allows comparisons to \`undefined\`.`,
        options: {
            type: "array",
            items: {
                type: "string",
                enum: [OPTION_ALLOW_NULL_CHECK, OPTION_ALLOW_UNDEFINED_CHECK],
            },
            minLength: 0,
            maxLength: 2,
        },
        optionExamples: [
            true,
            [true, "allow-null-check"],
            [true, "allow-undefined-check"],
        ],
        type: "functionality",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FAILURE_STRING_FACTORY(node: ts.Expression) {
        return `Comparison operand is ${node.kind === ts.SyntaxKind.NullKeyword ? 'null' : 'undefined'}`;
    }

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk, {
            allowNull: this.ruleArguments.indexOf(OPTION_ALLOW_NULL_CHECK) !== -1,
            allowUndefined: this.ruleArguments.indexOf(OPTION_ALLOW_UNDEFINED_CHECK) !== -1,
        });
    }
}

function walk(ctx: Lint.WalkContext<Options>) {
    return ts.forEachChild(ctx.sourceFile, function cb(node: ts.Node): void {
        if (isBinaryExpression(node) && typeof Lint.getEqualsKind(node.operatorToken) !== "undefined") {
            const invalidOperands = getInvalidOperands(node.left, node.right, ctx.options);
            if (invalidOperands === "Both" || invalidOperands === "Left") {
                ctx.addFailureAtNode(node.left, Rule.FAILURE_STRING_FACTORY(node.left));
            }
            if (invalidOperands === "Both" || invalidOperands === "Right") {
                ctx.addFailureAtNode(node.right, Rule.FAILURE_STRING_FACTORY(node.right));
            }
        }
        return ts.forEachChild(node, cb);
    });
}

function getInvalidOperands(nodeLeft: ts.Expression, nodeRight: ts.Expression, options: Options): InvalidOperand {
    let leftInvalid = false;
    let rightInvalid = false;

    if ((ts.isIdentifier(nodeLeft) && nodeLeft.text === 'undefined' && !options.allowUndefined) ||
        (nodeLeft.kind === ts.SyntaxKind.NullKeyword && !options.allowNull)) {
        leftInvalid = true;
    }

    if ((ts.isIdentifier(nodeRight) && nodeRight.text === 'undefined' && !options.allowUndefined) ||
        (nodeRight.kind === ts.SyntaxKind.NullKeyword && !options.allowNull)) {
        rightInvalid = true;
    }

    if (leftInvalid && rightInvalid) {
        return "Both";
    }
    if (leftInvalid) {
        return "Left";
    }
    if (rightInvalid) {
        return "Right";
    }

    return "None";
}
