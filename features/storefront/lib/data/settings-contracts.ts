import { gql } from 'graphql-request';

// GraphQL documents are values, not server actions. Keep them outside modules
// with a file-level 'use server' directive so production builds can load them.
export const PUBLIC_STOREFRONT_SETTINGS_QUERY = gql`
  query PublicStorefrontSettings {
    settings: getPublicStorefrontSettings {
      id
      name
      tagline
      address
      phone
      timezone
      currencyCode
      hours
      brandColor
      logoIcon
      logoColor
      isDemo
    }
  }
`;
