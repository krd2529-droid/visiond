# heic-to browser decoder

VisionD redistributes the unmodified CSP ESM bundle from `heic-to` 1.5.2, which embeds libheif 1.22.2 and libde265 1.0.16. It is loaded dynamically only when a user selects a HEIC/HEIF image.

- Upstream: https://github.com/hoppergee/heic-to/tree/v1.5.2
- npm tarball: https://registry.npmjs.org/heic-to/-/heic-to-1.5.2.tgz
- npm integrity: `sha512-8Fns+lZHAWmz5U5IUxDeXKwIf3foBoKNPLxxFY4B0MkLjNuomEIHCoDbDE+x/llFK3NCEO1cu4+n3iUKY+Svmw==`
- Vendored bundle SHA-256: `c189220a7a1e87559758a48ab4700e55629fb23a4cb57489e1e8970be1b9d018`
- License: package metadata declares LGPL-3.0; see the complete `LICENSE-LGPL-3.0.txt` in this directory (its terms permit version 3 or a later version).

The decoder stays in its own replaceable module file. An interface-compatible modified build can be substituted at the same path. Complete corresponding source is available from the pinned upstream tag and npm tarball above, including build instructions and the linked libheif sources.
