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
    .map(
      line =>
        /** @type {ProductVariant} */ ({
          id: line.merchandise.product.id,
          variantId: /** @type {ProductVariant} */ (line.merchandise).id,
          quantity: line.quantity
        })
    );

  const groupedCart = {};
  for (const group of groups) {
    groupedCart[group.id] = cartProducts.filter(product => group.products.includes(product.id));
  }

  let result = {};

  const minSets = Math.min(...groups.map(group => groupedCart[group.id].reduce((sum, item) => sum + item.quantity, 0)));

  if (minSets > 0) {
    for (const group of groups) {
      let remaining = minSets;
      for (const product of groupedCart[group.id] || []) {
        let applyDiscount = Math.min(product.quantity, remaining);
        if (applyDiscount > 0) {
          result[product.id] = (result[product.id] || 0) + applyDiscount;
          remaining -= applyDiscount;
        }
      }
    }
  } else {
    return EMPTY_DISCOUNT;
  }

  console.log(JSON.stringify({ result }));

  const targets = cartProducts
    .filter(product => result[product.id])
    .map(product => ({
      productVariant: {
        id: product.variantId,
        quantity: result[product.id]
      }
    }));

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
