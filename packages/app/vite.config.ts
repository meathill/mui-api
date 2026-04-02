import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';
import ssrPlugin from 'vite-ssr-components/plugin';

import { sharedCloudflareStatePath } from '../shared-db/dev-config';

export default defineConfig({
  plugins: [
    cloudflare({
      configPath: './wrangler.jsonc',
      persistState: {
        path: sharedCloudflareStatePath,
      },
      remoteBindings: false,
    }),
    ssrPlugin(),
  ],
});
