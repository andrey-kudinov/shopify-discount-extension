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

  if ((!configuration.collections && !configuration.productGroups) || !configuration.percentage) {
    return EMPTY_DISCOUNT;
  }

  const groups = configuration.productGroups || [];
  const collections = configuration.collections || [];

  const cartProducts = input.cart.lines
    .filter(line => line.merchandise.__typename === 'ProductVariant')
    .map(
      line =>
        /** @type {ProductVariant} */ ({
          id: line.merchandise.product.id,
          variantId: /** @type {ProductVariant} */ (line.merchandise).id,
          quantity: line.quantity,
          inAnyCollection: line.merchandise.product.inAnyCollection,
          inCollections: line.merchandise.product.inCollections
        })
    );

  const groupedCart = {};
  for (const group of groups) {
    groupedCart[group.id] = cartProducts.filter(product => group.products.includes(product.id));
  }

  for (const collection of collections) {
    groupedCart[collection.id] = cartProducts.filter(product => collection.products.includes(product.id));
  }

  const allGroupsPresent = Object.keys(groupedCart).every(groupId => groupedCart[groupId].length > 0);

  if (!allGroupsPresent) {
    return EMPTY_DISCOUNT;
  }

  let result = {};

  const minSets = Math.min(
    ...Object.keys(groupedCart).map(groupId => groupedCart[groupId].reduce((sum, product) => sum + product.quantity, 0))
  );

  if (minSets < 1) {
    return EMPTY_DISCOUNT;
  }

  for (const groupId of Object.keys(groupedCart)) {
    let remaining = minSets;

    while (remaining > 0) {
      let applied = false;

      for (const product of groupedCart[groupId]) {
        if (product.quantity > (result[product.id] || 0)) {
          result[product.id] = (result[product.id] || 0) + 1;
          applied = true;
          break;
        }
      }

      if (!applied) break;
      remaining--;
    }
  }

  const targets = cartProducts
    .filter(product => result[product.id])
    .map(product => ({
      productVariant: {
        id: product.variantId,
        quantity: result[product.id]
      }
    }));

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
    discountApplicationStrategy: DiscountApplicationStrategy.Maximum
  };
}
