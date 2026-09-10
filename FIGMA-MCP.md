# Connecting the Figma Dev Mode MCP Server

This lets an AI **read** your Figma designs (selected frames → code, variables,
images). It is **read-only** — it cannot publish plugins or edit published plugin
code. Publishing stays a manual desktop step.

## Requirements
- Figma **desktop app** (not the browser)
- A **Dev or Full seat** on a paid plan (Professional+). The free plan can't
  enable the Dev Mode MCP server.

## Steps
1. Open **Figma desktop** → open any design file.
2. Menu (top-left) → **Preferences → Enable Dev Mode MCP Server**.
3. Figma starts a local server at **http://127.0.0.1:3845/sse** and confirms it.
4. This repo already has `.mcp.json` pointing at that URL.
5. **Restart your AI/coding session** so it loads the server.

Once connected, tools like `get_code`, `get_image`, `get_variable_defs`,
`get_code_connect_map` become available.

## What it's good for here
- Read a selected frame's structure/variables to inform plugin work.
- Pull design tokens/images from a file.

## What it can't do (so expectations are clear)
- ❌ Publish a plugin (desktop-only, manual).
- ❌ Edit the code of an already-published plugin.
- ❌ Write changes back into the Figma document.

The editable source of truth for the plugins remains this repo
(`~/Documents/figma-plugins` / github.com/sinhaankur/figma-plugins).
