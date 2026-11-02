# File Access Router

This is the routing entry point for filesystem paths, download endpoints, upload pipelines, and file preview handling.

## When to Use

- Parameters, filenames, download endpoints, or import flows influence file paths
- The target supports upload, preview, transcoding, extraction, sharing, download, or proxied file access
- You need to decide whether this is path traversal/LFI or an upload-validation/processing-chain issue

## Document Map

- [Path Traversal LFI](./path-traversal-lfi.md): path traversal, file read, wrapper abuse, include chains
- [Upload Insecure Files](./upload-insecure-files.md): upload validation, storage paths, processing chains, overwrite risk, preview/share boundaries

## Recommended Flow

1. First identify whether the entry point is a path parameter, download endpoint, or upload workflow
2. Then locate whether the issue appears in accept, store, process, or serve stages
3. Small path-chain and upload-bypass samples are merged into the main topic documents; no separate payload entry is needed

## Related Categories

- [injection-checking](./injection-checking.md)
- [business-logic-vuln](./business-logic-vuln.md)