// @ts-check
import { DiscountApplicationStrategy } from '../generated/api';

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
  discounts: []
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
  const configuration = JSON.parse(input?.discountNode?.metafield?.value ?? '{}');

  console.log(JSON.stringify({ percentage: configuration.percentage }));

  if (!configuration.productGroups || !configuration.percentage) {
    return EMPTY_DISCOUNT;
  }

  const groups = configuration.productGroups;

  const cartProducts = input.cart.lines
    .filter(line => line.merchandise.__typename === 'ProductVariant')
    .map(line => /** @type {ProductVariant} */ ({ id: line.merchandise.product.id, quantity: line.quantity }));

  const result = {};
  const stock = [];

  for (const product of cartProducts) {
    if (!stock.length) {
      for (const group of groups) {
        if (group.products.includes(product.id)) {
          stock.push(product);
          break;
        }
      }
    } else if (stock.length) {
      for (const group of groups) {
        const last = stock[stock.length - 1];
        if (group.products.includes(product.id) && !group.products.includes(last.id)) {
          const minQuantity = Math.min(product.quantity, last.quantity);

          if (!result[last.id]) {
            result[last.id] = minQuantity;
          } else {
            result[last.id] += minQuantity;
          }

          if (!result[product.id]) {
            result[product.id] = minQuantity;
          } else {
            result[product.id] += minQuantity;
          }

          stock.length = 0;
          break;
        }
      }
    }
  }

  console.log(JSON.stringify({ result }));

  const targets = input.cart.lines
    .filter(line => {
      if (line.merchandise.__typename === 'ProductVariant') {
        const variant = /** @type {ProductVariant} */ (line.merchandise);
        return result[variant.product.id];
      }
      return false;
    })
    .map(line => {
      const variant = /** @type {ProductVariant} */ (line.merchandise);
      return /** @type {Target} */ ({
        productVariant: {
          id: variant.id,
          quantity: result[variant.product.id]
        }
      });
    });

  console.log(JSON.stringify({ targets }));

  if (!targets.length) {
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        targets,
        value: {
          percentage: {
            value: configuration.percentage.toString()
          }
        }
      }
    ],
    discountApplicationStrategy: DiscountApplicationStrategy.First
  };
}
