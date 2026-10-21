import { GraphQLClient, type RequestDocument, type Variables } from 'graphql-request';
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl';

class BarbershopStorefrontClient {
  private async getClient() {
    // No process-global request-derived endpoint, headers or identity.
    return new GraphQLClient(await getGraphQLEndpoint(), { credentials: 'include' });
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
