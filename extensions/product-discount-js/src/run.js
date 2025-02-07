// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

// Use JSDoc annotations for type safety
/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 * @typedef {import("../generated/api").Target} Target
 * @typedef {import("../generated/api").ProductVariant} ProductVariant
 */

/**
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};
/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  /**
   * @type {{
   *   collections: array
   *   percentage: number
   * }}
   */
  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? '{}',
  );
  if (!configuration.collections || !configuration.percentage) {
    return EMPTY_DISCOUNT;
  }

  console.log(JSON.stringify({configuration}));

  const targets = input.cart.lines
    .filter(line => {
      if (line.merchandise.__typename == 'ProductVariant') {
        const variant = /** @type {ProductVariant} */ (line.merchandise);
        return !variant.product.inAnyCollection;
      } else {
        return false;
      }
    })
    .map(line => {
      const variant = /** @type {ProductVariant} */ (line.merchandise);

      return /** @type {Target} */ ({
        productVariant: {
          id: variant.id,
        },
      });
    });

  if (!targets.length) {
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        targets,
        value: {
          percentage: {
            value: (configuration.percentage-10).toString(),
          },
        },
      },
    ],
    discountApplicationStrategy: DiscountApplicationStrategy.First,
  };
}
