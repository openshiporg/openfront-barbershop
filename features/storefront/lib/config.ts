import { GraphQLClient, type RequestDocument, type Variables } from 'graphql-request';
import { getServerGraphQLTarget } from '@/features/dashboard/lib/getBaseUrl';

class BarbershopStorefrontClient {
  private async getClient() {
    // No process-global request-derived endpoint, headers or identity: built per request, so the signed identity is the CURRENT visitor's.
    const target = await getServerGraphQLTarget();
    return new GraphQLClient(target.endpoint, { credentials: 'include', ...(target.fetch ? { fetch: target.fetch } : {}) });
  }

  async request<T = unknown>(document: RequestDocument): Promise<T>;
  async request<T = unknown, V extends Variables = Variables>(document: RequestDocument, variables: V): Promise<T>;
  async request<T = unknown, V extends Variables = Variables>(document: RequestDocument, variables?: V): Promise<T> {
    const client = await this.getClient();
    if (variables === undefined) {
      return client.request<T>(document);
    }

    return client.request<T>(document, variables);
  }
}

export const storefrontClient = new BarbershopStorefrontClient();
