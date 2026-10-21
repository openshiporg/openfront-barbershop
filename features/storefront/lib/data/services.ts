'use server';

import { cache } from 'react';
import { gql } from 'graphql-request';
import { storefrontClient } from '../config';

const CATALOG_UNAVAILABLE = 'The service menu couldn’t be loaded. Try again in a moment.';

export type StorefrontService = {
  id: string;
  name: string;
  description?: string | null;
  imagePath?: string | null;
  durationMinutes: number;
  price: number;
  depositRequired: boolean;
  depositAmount?: number | null;
  color?: string | null;
  category?: { id: string; name: string } | null;
  specialists?: StorefrontBarber[];
};

export type StorefrontServiceCategory = {
  id: string;
  name: string;
  description?: string | null;
  services: StorefrontService[];
};

export type StorefrontBarber = {
  id: string;
  displayName: string;
  bio?: string | null;
  imagePath?: string | null;
  chairNumber?: string | null;
  bookingEnabled: boolean;
  specialties?: { id: string; name: string }[];
};

export type StorefrontProduct = {
  id: string;
  name: string;
  sku?: string | null;
  productType?: string | null;
  price?: number | null;
  description?: string | null;
  imagePath?: string | null;
};

export const getServiceCategories = cache(async function getServiceCategories(): Promise<StorefrontServiceCategory[]> {
  const query = gql`
    query StorefrontServiceCategories {
      serviceCategories: getPublicServiceCatalog {
        id
        name
        description
        services {
          id
          name
          description
          imagePath
          durationMinutes
          price
          depositRequired
          depositAmount
          color
          specialists {
            id
            displayName
            imagePath
            chairNumber
            bookingEnabled
          }
        }
      }
    }
  `;

  try {
    const data = await storefrontClient.request<{ serviceCategories: StorefrontServiceCategory[] }>(query);
    return data.serviceCategories || [];
  } catch {
    // A failed request is not an empty catalog: let the page show it as unavailable.
    throw new Error(CATALOG_UNAVAILABLE);
  }
});

export const getAllServices = cache(async function getAllServices(): Promise<StorefrontService[]> {
  const query = gql`
    query StorefrontServices {
      categories: getPublicServiceCatalog {
        id
        name
        services {
          id
          name
          description
          imagePath
          durationMinutes
          price
          depositRequired
          depositAmount
          specialists { id displayName imagePath chairNumber }
        }
      }
    }
  `;

  try {
    const data = await storefrontClient.request<{ categories: StorefrontServiceCategory[] }>(query);
    return (data.categories || []).flatMap((category) =>
      category.services.map((service) => ({ ...service, category: { id: category.id, name: category.name } }))
    );
  } catch {
    // A failed request is not an empty catalog: let the page show it as unavailable.
    throw new Error(CATALOG_UNAVAILABLE);
  }
});

export const getAllBarbers = cache(async function getAllBarbers(): Promise<StorefrontBarber[]> {
  const query = gql`
    query StorefrontBarbers {
      barbers: getPublicBarbers {
        id
        displayName
        bio
        imagePath
        chairNumber
        specialties {
          id
          name
        }
      }
    }
  `;

  try {
    const data = await storefrontClient.request<{ barbers: StorefrontBarber[] }>(query);
    return data.barbers || [];
  } catch {
    // A failed request is not an empty catalog: let the page show it as unavailable.
    throw new Error(CATALOG_UNAVAILABLE);
  }
});

export const getRetailProducts = cache(async function getRetailProducts(): Promise<StorefrontProduct[]> {
  const query = gql`
    query StorefrontRetailProducts {
      products: getPublicProducts {
        id
        name
        sku
        productType
        price
        description
        imagePath
      }
    }
  `;

  try {
    const data = await storefrontClient.request<{ products: StorefrontProduct[] }>(query);
    return data.products || [];
  } catch {
    // A failed request is not an empty catalog: let the page show it as unavailable.
    throw new Error(CATALOG_UNAVAILABLE);
  }
});
