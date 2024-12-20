import JSZip from 'jszip'

export async function createNextJSProject(
  code: string,
  projectName: string
): Promise<Uint8Array> {
  const zip = new JSZip()

  // Core package.json with minimal dependencies
  zip.file(
    'package.json',
    JSON.stringify(
      {
        name: projectName,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: '^15.0.3',
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
        devDependencies: {
          typescript: '^5.2.2',
          '@types/react': '^18.2.0',
          '@types/node': '^22.10.1',
          tailwindcss: '^3.4.1',
          postcss: '^8.4.35',
          autoprefixer: '^10.4.17',
        },
      },
      null,
      2
    )
  )

  // Basic Tailwind setup
  zip.file(
    'tailwind.config.js',
    `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}`
  )

  zip.file(
    'postcss.config.js',
    `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
  )

  // Add component and styles
  zip.file('app/page.tsx', `'use client'\n\n${code}`)
  zip.file(
    'app/globals.css',
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;'
  )
  zip.file(
    'app/layout.tsx',
    `import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`
  )

  // Add README with install instructions
  zip.file(
    'README.md',
    `# ${projectName}

## Using npm

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev
\`\`\`

## Using bun

Bun (https://bun.sh/) is a fast Javascript runtime & package manager.

\`\`\`bash
# Install dependencies
bun install

# Start development server
bun dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---
Made with [yield.sh](https://yield.sh)
`
  )

  // Add .gitignore
  zip.file(
    '.gitignore',
    `# dependencies
/node_modules

# next.js
/.next/
/out/

# misc
.DS_Store
*.pem

# local env files
.env*.local

# typescript
*.tsbuildinfo
next-env.d.ts
`
  )

  return zip.generateAsync({ type: 'uint8array' })
}
