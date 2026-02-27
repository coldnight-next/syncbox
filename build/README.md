# Build Resources

Place these files here before building the installer:

- `icon.ico` — Multi-size Windows icon (16, 32, 48, 64, 128, 256px). Use a tool like [RealFaviconGenerator](https://realfavicongenerator.net/) or `png2ico`.
- `installerSidebar.bmp` — 164x314 BMP image shown in the NSIS installer sidebar.

For development/testing without these files, the build will use Electron's default icon.
