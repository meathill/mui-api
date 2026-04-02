import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { sharedCloudflareStateV3Path } from '../shared-db/dev-config';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.0.0',
  },
  transpilePackages: ['@muirouter/shared-db'],
};

export default withNextIntl(nextConfig);

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev({
  configPath: './wrangler.jsonc',
  persist: {
    path: sharedCloudflareStateV3Path,
  },
  remoteBindings: false,
});
