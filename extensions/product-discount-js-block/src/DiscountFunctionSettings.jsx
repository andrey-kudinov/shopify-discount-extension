// [START discount-ui-extension.ui-extension]
// [START discount-ui-extension.ui-components]
import {
  reactExtension,
  FunctionSettings,
  Text,
  Form,
  NumberField,
  Box,
  BlockStack,
  Section,
  Divider,
  InlineStack,
  Button,
  Icon,
  Link,
  useApi,
  TextField,
  ProgressIndicator
} from '@shopify/ui-extensions-react/admin';
// [END discount-ui-extension.ui-components]
import { Fragment, useState, useEffect } from 'react';

// [START discount-ui-extension.target]
// The target used here must match the target used in the extension toml file
const TARGET = 'admin.discount-details.function-settings.render';
// [END discount-ui-extension.target]

export default reactExtension(TARGET, async api => {
  const existingDefinition = await getMetafieldDefinition(api.query);
  if (!existingDefinition) {
    // Create a metafield definition for persistence if no pre-existing definition exists
    const metafieldDefinition = await createMetafieldDefinition(api.query);

    if (!metafieldDefinition) {
      throw new Error('Failed to create metafield definition');
    }
  }

  return <App />;
});

// [START discount-ui-extension.collections-field]
function CollectionsField({ defaultValue, value, onChange }) {
  return (
    <Box display='none'>
      <TextField defaultValue={defaultValue} value={value.map(collection => collection.id)} onChange={onChange} />
    </Box>
  );
}

// [END discount-ui-extension.collections-field]

function PercentageField({ defaultValue, value, onChange, i18n }) {
  return (
    <Box paddingBlockEnd='300'>
      <BlockStack gap='base'>
        <Text variant='headingMd' as='h2'>
          {i18n.translate('description')}
        </Text>
        <NumberField
          label={i18n.translate('discountPercentage')}
          name='percentage'
          autoComplete='on'
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          suffix='%'
        />
      </BlockStack>
    </Box>
  );
}

// [START discount-ui-extension.app-component]
function App() {
  const {
    loading,
    applyExtensionMetafieldChange,
    handleRemoveCollection,
    handleRemoveGroup,
    handleRemoveProduct,
    i18n,
    initialSelectedCollections,
    initialSelectedGroups,
    initialPercentage,
    onPercentageValueChange,
    onSelectCollections,
    handleAddProductsToGroup,
    handleAddGroup,
    percentage,
    selectedCollections,
    groups,
    resetForm
  } = useExtensionData();
  return (
    <FunctionSettings onSave={applyExtensionMetafieldChange}>
      <Form onReset={resetForm}>
        <Section>
          <CollectionsField
            defaultValue={initialSelectedCollections}
            value={selectedCollections}
            onChange={onSelectCollections}
          />
          <ProductGroupsField defaultValue={initialSelectedGroups} value={groups} onChange={handleAddProductsToGroup} />
          <PercentageField
            value={percentage}
            defaultValue={initialPercentage}
            onChange={onPercentageValueChange}
            i18n={i18n}
          />
        </Section>

        <Section padding='base'>
          <Box padding='base none'>
            <CollectionsSection
              loading={loading}
              selectedCollections={selectedCollections}
              onClickAdd={onSelectCollections}
              onClickRemove={handleRemoveCollection}
              i18n={i18n}
            />
          </Box>
        </Section>

        <Divider />

        <Section padding='base'>
          <Box padding='base none'>
            <GroupsSection
              loading={loading}
              groups={groups}
              onClickAddProducts={handleAddProductsToGroup}
              onClickAddGroup={handleAddGroup}
              onClickRemoveGroup={handleRemoveGroup}
              onClickRemoveProduct={handleRemoveProduct}
              i18n={i18n}
            />
          </Box>
        </Section>
      </Form>
    </FunctionSettings>
  );
}
// [END discount-ui-extension.app-component]

// [START discount-ui-extension.collections-section]
function CollectionsSection({ i18n, loading, onClickAdd, onClickRemove, selectedCollections }) {
  const collectionRows =
    selectedCollections && selectedCollections.length > 0
      ? selectedCollections.map(collection => (
          <BlockStack gap='base' key={collection.id}>
            <InlineStack blockAlignment='center' inlineAlignment='space-between'>
              <Link
                href={`shopify://admin/collections/${collection.id.split('/').pop()}`}
                tone='inherit'
                target='_blank'
              >
                {collection.title}
              </Link>
              <Button variant='tertiary' onClick={() => onClickRemove(collection.id)}>
                <Icon name='CircleCancelMajor' />
              </Button>
            </InlineStack>
            <Divider />
          </BlockStack>
        ))
      : null;
  return (
    <Section>
      <BlockStack gap='base'>
        {loading ? (
          <InlineStack gap inlineAlignment='center' padding='base'>
            <ProgressIndicator />
          </InlineStack>
        ) : null}

        {collectionRows}
        <Button onClick={onClickAdd}>
          <InlineStack blockAlignment='center' inlineAlignment='start' gap='base'>
            <Icon name='CirclePlusMajor' />
            {i18n.translate('addCollections')}
          </InlineStack>
        </Button>
      </BlockStack>
    </Section>
  );
}
// [END discount-ui-extension.collections-section]

// [START discount-ui-extension.use-collection]
function useExtensionData() {
  const { applyMetafieldChange, i18n, data, resourcePicker, query } = useApi(TARGET);
  const initialMetafields = data?.metafields || [];
  const [loading, setLoading] = useState(false);
  const [percentage, setPercentage] = useState(0);
  const [savedMetafields] = useState(initialMetafields);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [initialCollectionIds, setInitialCollectionIds] = useState([]);
  const [initialSelectedCollections, setInitialSelectedCollections] = useState([]);
  const [groups, setGroups] = useState([]);
  const [initialGroupIds, setInitialGroupIds] = useState([]);
  const [initialSelectedGroups, setInitialSelectedGroups] = useState([]);
  const [initialPercentage, setInitialPercentage] = useState(0);

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);
      if (!selectedCollections && !groups) {
        return;
      }

      const transferPercentage = parsePercentageMetafield(
        savedMetafields.find(metafield => metafield.key === 'function-configuration')?.value
      );
      setInitialPercentage(Number(transferPercentage));
      setPercentage(Number(transferPercentage));

      const transferExcludedCollectionIds = parseTransferExcludedCollectionIdsMetafield(
        savedMetafields.find(metafield => metafield.key === 'function-configuration')?.value
      );
      setInitialCollectionIds(transferExcludedCollectionIds);

      const transferExcludedProductGroupIds = parseTransferExcludedProductGroupIdsMetafield(
        savedMetafields.find(metafield => metafield.key === 'function-configuration')?.value
      );
      setInitialGroupIds(transferExcludedProductGroupIds);

      const collectionIds = transferExcludedCollectionIds.map(collection => collection.id);

      await getCollectionTitles(collectionIds, query).then(results => {
        const collections = results.data.nodes.map(collection => ({
          id: collection.id,
          title: collection.title,
          products: collection.products.edges.map(edge => edge.node.id)
        }));

        setSelectedCollections(collections);
        setInitialSelectedCollections(collections);
      });

      const productGroupsData =
        JSON.parse(savedMetafields.find(metafield => metafield.key === 'function-configuration')?.value ?? '{}')
          .productGroups ?? [];

      if (productGroupsData) {
        const productGroups = await Promise.all(
          productGroupsData.map(async group => {
            const products = await getProductTitles(group.products, query);
            return {
              id: group.id,
              title: group.title,
              products: products.data.nodes.map(product => ({
                id: product.id,
                title: product.title
              }))
            };
          })
        );
        setGroups(productGroups);
        setInitialSelectedGroups(productGroups);
      }

      setLoading(false);
    }
    fetchInitialData();
  }, [initialMetafields]);

  const onPercentageValueChange = async value => {
    setPercentage(Number(value));
  };

  async function getCollectionsWithProducts(collectionIds, adminApiQuery) {
    const query = `
      {
        nodes(ids: ${JSON.stringify(collectionIds)}) {
          ... on Collection {
            id
            title
            products(first: 100) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
        }
      }
    `;

    const response = await adminApiQuery(query);

    return response.data.nodes.map(collection => ({
      id: collection.id,
      title: collection.title,
      products: collection.products.edges.map(edge => edge.node.id)
    }));
  }

  async function onSelectCollections() {
    const selection = await resourcePicker({
      type: 'collection',
      selectionIds: selectedCollections.map(collection => ({
        id: collection.id
      })),
      action: 'select',
      filter: {
        archived: true,
        variants: true
      }
    });

    const collectionIds = selection.map(col => col.id);

    const collectionsWithProducts = await getCollectionsWithProducts(collectionIds, query);

    setSelectedCollections(collectionsWithProducts);
  }

  async function handleAddProductsToGroup(id) {
    const groupToUpdate = groups.find(group => group.id === id);

    if (!groupToUpdate) {
      console.error('Group not found');
      return;
    }

    const selection = await resourcePicker({
      type: 'product',
      selectionIds: groupToUpdate.products.map(product => ({ id: product.id })),
      action: 'select',
      filter: {
        archived: true,
        variants: true
      }
    });

    setGroups(prevGroups => prevGroups.map(group => (group.id === id ? { ...group, products: selection } : group)));
  }

  async function handleAddGroup(newGroupId) {
    setGroups(prevGroups => [...prevGroups, { id: newGroupId, products: [], title: `Group ${newGroupId}` }]);
  }

  async function applyExtensionMetafieldChange() {
    const commitFormValues = {
      percentage: Number(percentage),
      collections: selectedCollections,
      productGroups: groups.map(group => ({
        id: group.id,
        title: group.title,
        products: group.products.map(product => product.id)
      }))
    };

    await applyMetafieldChange({
      type: 'updateMetafield',
      namespace: '$app:example-discounts--ui-extension',
      key: 'function-configuration',
      value: JSON.stringify(commitFormValues),
      valueType: 'json'
    });
  }

  async function handleRemoveCollection(id) {
    const updatedCollections = selectedCollections.filter(collection => collection.id !== id);
    setSelectedCollections(updatedCollections);
  }

  async function handleRemoveGroup(id) {
    const updatedProductGroups = groups.filter(group => group.id !== id);
    setGroups(updatedProductGroups);
  }

  async function handleRemoveProduct(id) {
    const updatedProductGroups = groups.map(group => {
      const updatedProducts = group.products.filter(product => product.id !== id);
      return { ...group, products: updatedProducts };
    });
    setGroups(updatedProductGroups);
  }

  return {
    loading,
    applyExtensionMetafieldChange,
    handleRemoveCollection,
    handleRemoveGroup,
    handleRemoveProduct,
    i18n,
    initialSelectedCollections: initialCollectionIds,
    initialSelectedGroups: initialGroupIds,
    initialPercentage,
    onPercentageValueChange,
    onSelectCollections,
    handleAddProductsToGroup,
    handleAddGroup,
    percentage,
    selectedCollections,
    groups,
    resetForm: () => {
      setPercentage(initialPercentage);
      setSelectedCollections(initialSelectedCollections);
      setGroups(initialSelectedGroups);
    }
  };
}
// [END discount-ui-extension.use-collection]

// [START discount-ui-extension.metafields]
const METAFIELD_NAMESPACE = '$app:example-discounts--ui-extension';
const METAFIELD_KEY = 'function-configuration';
async function getMetafieldDefinition(adminApiQuery) {
  const query = `#graphql
    query GetMetafieldDefinition {
      metafieldDefinitions(first: 1, ownerType: DISCOUNT, namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
        nodes {
          id
        }
      }
    }
  `;

  const result = await adminApiQuery(query);

  return result?.data?.metafieldDefinitions?.nodes[0];
}

async function createMetafieldDefinition(adminApiQuery) {
  const definition = {
    access: {
      admin: 'MERCHANT_READ_WRITE'
    },
    key: METAFIELD_KEY,
    name: 'Discount Configuration',
    namespace: METAFIELD_NAMESPACE,
    ownerType: 'DISCOUNT',
    type: 'json'
  };

  const query = `#graphql
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
            id
          }
        }
      }
  `;

  const variables = { definition };
  const result = await adminApiQuery(query, { variables });

  return result?.data?.metafieldDefinitionCreate?.createdDefinition;
}
// [END discount-ui-extension.metafields]
// Utility functions

async function getCollectionTitles(collectionGids, adminApiQuery) {
  return adminApiQuery(`
    {
      nodes(ids: ${JSON.stringify(collectionGids)}) {
        ... on Collection {
          id
          title
          description
          products(first: 100) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  `);
}

async function getProductTitles(productGids, adminApiQuery) {
  return adminApiQuery(`
    {
      nodes(ids: ${JSON.stringify(productGids)}) {
        ... on Product {
          id
          title
        }
      }
    }
  `);
}

function parseTransferExcludedCollectionIdsMetafield(value) {
  try {
    return JSON.parse(value).collections;
  } catch {
    return [];
  }
}

function parsePercentageMetafield(value) {
  try {
    return JSON.parse(value).percentage;
  } catch {
    return 0;
  }
}
// [END discount-ui-extension.ui-extension]

function ProductGroupsField({ defaultValue, value, onChange }) {
  return (
    <Box display='none'>
      <TextField defaultValue={defaultValue} value={value.map(group => group.id)} onChange={onChange} />
    </Box>
  );
}
function GroupsSection({
  i18n,
  loading,
  onClickAddProducts,
  onClickAddGroup,
  onClickRemoveGroup,
  onClickRemoveProduct,
  groups
}) {
  const productGroupRows =
    groups && groups.length > 0
      ? groups.map(group => (
          <BlockStack gap='base' key={group.id}>
            <InlineStack blockAlignment='center' inlineAlignment='space-between'>
              <Text variant='headingSm' as='h3'>
                {group.title || `Group ${group.id}`}
              </Text>
              <Button variant='tertiary' onClick={() => onClickRemoveGroup(group.id)}>
                <Icon name='CircleCancelMajor' />
              </Button>
            </InlineStack>

            {group.products && group.products.length > 0 ? (
              <BlockStack gap='tight'>
                {group.products.map(product => (
                  <InlineStack key={product.id} blockAlignment='center' gap='base'>
                    <Link
                      href={`shopify://admin/products/${product.id.split('/').pop()}`}
                      tone='inherit'
                      target='_blank'
                    >
                      {product.title}
                    </Link>
                    <Button variant='tertiary' onClick={() => onClickRemoveProduct(product.id)}>
                      <Icon name='CircleCancelMajor' />
                    </Button>
                  </InlineStack>
                ))}
              </BlockStack>
            ) : (
              <Text tone='subdued'>{i18n.translate('noProductsInGroup')}</Text>
            )}

            <Button onClick={() => onClickAddProducts(group.id)}>
              <InlineStack blockAlignment='center' inlineAlignment='start' gap='base'>
                <Icon name='CirclePlusMajor' />
                {i18n.translate('addProducts')}
              </InlineStack>
            </Button>

            <Divider />
          </BlockStack>
        ))
      : null;

  return (
    <Section>
      <BlockStack gap='base'>
        {loading ? (
          <InlineStack gap inlineAlignment='center' padding='base'>
            <ProgressIndicator />
          </InlineStack>
        ) : null}

        {productGroupRows}

        <Button onClick={() => onClickAddGroup(crypto.randomUUID())}>
          <InlineStack blockAlignment='center' inlineAlignment='start' gap='base'>
            <Icon name='CirclePlusMajor' />
            {i18n.translate('addGroup')}
          </InlineStack>
        </Button>
      </BlockStack>
    </Section>
  );
}

function parseTransferExcludedProductGroupIdsMetafield(value) {
  try {
    const data = JSON.parse(value ?? '') ?? {};
    return data.productGroups || [];
  } catch {
    return [];
  }
}
