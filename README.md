# Personal site - 2024

This is a new version of my personal site. To create it, I am using [Eleventy](https://www.11ty.dev/)

## Animated background glow

The sidebar background glow is a small WebGPU shader (`public/js/glow.js`) using a
vendored build of [vgpu](https://vgpu.sh). It only runs on desktop viewports and
falls back to the static CSS glow when WebGPU is unavailable. To regenerate the
vendor bundle after bumping the `vgpu` dependency:

```sh
npx esbuild node_modules/vgpu/dist/index.js --bundle --minify --format=esm --outfile=public/js/vendor/vgpu.esm.js
```
