import type { Context } from '.keystone/types';

async function redirectToInit(_root: unknown, _args: unknown, context: Context): Promise<boolean> {
  const userCount = await context.sudo().query.User.count({});

  return userCount === 0;
}

export default redirectToInit;
