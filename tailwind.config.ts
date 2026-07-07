import type { Config } from 'tailwindcss';
// @ts-expect-error - DaisyUI doesn't have type definitions
import daisyui from 'daisyui';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          'primary': '#D1350F',
          'primary-content': '#ffffff',
          'secondary': '#F5F6F8',
          'secondary-content': '#000000',
          'accent': '#F59E0B',
          'neutral': '#1F2937',
          'neutral-content': '#F3F4F6',
          'base-100': '#FFFFFF',
          'base-200': '#F9FAFB',
          'base-300': '#F3F4F6',
          'base-content': '#111827',
          'success': '#10B981',
          'warning': '#F59E0B',
          'error': '#EF4444',
          'info': '#3B82F6',
        },
        dark: {
          'primary': '#D1350F',
          'primary-content': '#ffffff',
          'secondary': '#F5F6F8',
          'secondary-content': '#000000',
          'accent': '#F59E0B',
          'neutral': '#E5E7EB',
          'neutral-content': '#1F2937',
          'base-100': '#0D0E12',
          'base-200': '#1A1D27',
          'base-300': '#27293F',
          'base-content': '#F3F4F6',
          'success': '#10B981',
          'warning': '#F59E0B',
          'error': '#EF4444',
          'info': '#3B82F6',
        },
      },
    ],
    darkTheme: 'dark',
    styled: true,
    base: true,
    utils: true,
    logs: true,
  },
} as unknown as Config;

export default config;
