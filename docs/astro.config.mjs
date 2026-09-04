import react from '@astrojs/react';
// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://oktntko.github.io',
  base: '/clinder',
  integrations: [
    starlight({
      title: 'Clinder',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/oktntko/clinder' }],
      sidebar: [
        {
          label: 'Guides',
          items: [{ label: 'Getting Started', slug: 'guides/getting-started' }],
        },
        {
          label: 'How to use',
          items: [{ autogenerate: { directory: 'how-to-use' } }],
        },
      ],
    }),
    react(),
  ],
});
