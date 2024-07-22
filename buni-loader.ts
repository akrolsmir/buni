import { plugin, type BunPlugin } from 'bun'

export const buniPlugin: BunPlugin = {
  name: 'buni-loader',
  setup(build) {
    build.onResolve({ filter: /\.buni$/ }, (args) => {
      console.log('buni-loader resolve', args)
      // Return what would have been resolved, but with a namespace?
      // TODO: Why is namespace needed...?
      return { path: args.path, namespace: 'buni' }
    })

    build.onLoad({ filter: /\.buni$/, namespace: 'buni' }, async (args) => {
      console.log('buni-loader load', args)
      return {
        contents:
          'export function randMarket() { return { name: "manifold" } }',
        loader: 'js',
      }
    })
  },
}
