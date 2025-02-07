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
  ProgressIndicator,
} from '@shopify/ui-extensions-react/admin';
// [END discount-ui-extension.ui-components]
import { useState, useEffect } from 'react';

// [START discount-ui-extension.target]
// The target used here must match the target used in the extension toml file
const TARGET = 'admin.discount-details.function-settings.render';
// [END discount-ui-extension.target]

export default reactExtension(TARGET, async (api) => {
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
    <Box display="none">
      <TextField
        defaultValue={defaultValue}
        value={value.map((collection) => collection.id)}
        onChange={onChange}
      />
    </Box>
  );
}

// [END discount-ui-extension.collections-field]

function PercentageField({ defaultValue, value, onChange, i18n }) {
  return (
    <Box paddingBlockEnd="300">
      <BlockStack gap="base">
        <Text variant="headingMd" as="h2">
          {i18n.translate('description')}
        </Text>
        <NumberField
          label={i18n.translate('discountPercentage')}
          name="percentage"
          autoComplete="on"
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          suffix="%"
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
    i18n,
    initialSelectedCollections,
    initialPercentage,
    onPercentageValueChange,
    onSelectCollections,
    percentage,
    selectedCollections,
    resetForm,
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
          <PercentageField
            value={percentage}
            defaultValue={initialPercentage}
            onChange={onPercentageValueChange}
            i18n={i18n}
          />
        </Section>
        <Section padding="base">
          <Box padding="base none">
            <CollectionsSection
              loading={loading}
              selectedCollections={selectedCollections}
              onClickAdd={onSelectCollections}
              onClickRemove={handleRemoveCollection}
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
function CollectionsSection({
  i18n,
  loading,
  onClickAdd,
  onClickRemove,
  selectedCollections,
}) {
  const collectionRows =
    selectedCollections && selectedCollections.length > 0
      ? selectedCollections.map((collection) => (
          <BlockStack gap="base" key={collection.id}>
            <InlineStack
              blockAlignment="center"
              inlineAlignment="space-between"
            >
              <Link
                href={`shopify://admin/collections/${collection.id
                  .split('/')
                  .pop()}`}
                tone="inherit"
                target="_blank"
              >
                {collection.title}
              </Link>
              <Button
                variant="tertiary"
                onClick={() => onClickRemove(collection.id)}
              >
                <Icon name="CircleCancelMajor" />
              </Button>
            </InlineStack>
            <Divider />
          </BlockStack>
        ))
      : null;
  return (
    <Section>
      <BlockStack gap="base">
        {loading ? (
          <InlineStack gap inlineAlignment="center" padding="base">
            <ProgressIndicator />
          </InlineStack>
        ) : null}

        {collectionRows}
        <Button onClick={onClickAdd}>
          <InlineStack
            blockAlignment="center"
            inlineAlignment="start"
            gap="base"
          >
            <Icon name="CirclePlusMajor" />
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
  const [initialSelectedCollections, setInitialSelectedCollections] = useState(
    []
  );
  const [initialPercentage, setInitialPercentage] = useState(0);

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);
      if (!selectedCollections) {
        return;
      }

      const transferPercentage = parsePercentageMetafield(
        savedMetafields.find(
          (metafield) => metafield.key === 'function-configuration'
        )?.value
      );
      setInitialPercentage(Number(transferPercentage));
      setPercentage(Number(transferPercentage));

      const transferExcludedCollectionIds =
        parseTransferExcludedCollectionIdsMetafield(
          savedMetafields.find(
            (metafield) => metafield.key === 'function-configuration'
          )?.value
        );
      setInitialCollectionIds(transferExcludedCollectionIds);

      await getCollectionTitles(transferExcludedCollectionIds, query).then(
        (results) => {
          const collections = results.data.nodes.map((collection) => ({
            id: collection.id,
            title: collection.title,
          }));
          setSelectedCollections(collections);
          setInitialSelectedCollections(collections);
          return;
        }
      );
      setLoading(false);
    }
    fetchInitialData();
  }, [initialMetafields]);

  const onPercentageValueChange = async (value) => {
    setPercentage(Number(value));
  };

  async function onSelectCollections() {
    const selection = await resourcePicker({
      type: 'collection',
      selectionIds: selectedCollections.map((collection) => ({
        id: collection.id,
      })),
      action: 'select',
      filter: {
        archived: true,
        variants: true,
      },
    });
    setSelectedCollections(selection);
  }

  // [START discount-ui-extension.apply-extension-metafield-change]
  async function applyExtensionMetafieldChange() {
    const commitFormValues = {
      percentage: Number(percentage),
      collections: selectedCollections.map((collection) => collection.id),
    };
    await applyMetafieldChange({
      type: 'updateMetafield',
      namespace: '$app:example-discounts--ui-extension',
      key: 'function-configuration',
      value: JSON.stringify(commitFormValues),
      valueType: 'json',
    });
  }
  // [END discount-ui-extension.apply-extension-metafield-change]

  async function handleRemoveCollection(id) {
    const updatedCollections = selectedCollections.filter(
      (collection) => collection.id !== id
    );
    setSelectedCollections(updatedCollections);
  }

  return {
    loading,
    applyExtensionMetafieldChange,
    handleRemoveCollection,
    i18n,
    initialSelectedCollections: initialCollectionIds,
    initialPercentage,
    onPercentageValueChange,
    onSelectCollections,
    percentage,
    selectedCollections,
    resetForm: () => {
      setPercentage(initialPercentage);
      setSelectedCollections(initialSelectedCollections);
    },
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
      admin: 'MERCHANT_READ_WRITE',
    },
    key: METAFIELD_KEY,
    name: 'Discount Configuration',
    namespace: METAFIELD_NAMESPACE,
    ownerType: 'DISCOUNT',
    type: 'json',
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
