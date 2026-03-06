# Filla IQ — Project Instructions

## Fusion 360 MCP

The Fusion 360 MCP server is configured in `.mcp.json`. It allows Claude to drive Autodesk Fusion 360 for 3D CAD modeling (enclosure design, mounting brackets, etc.).

**Prerequisites for use:**
1. Fusion 360 must be running
2. The FusionMCP add-in must be installed and enabled in Fusion 360 (Utilities → Add-Ins → add from `tools/ClaudeFusion360MCP/fusion-addin/`)
3. Fusion documents use **mm** display units (standard for mechanical design)
4. The Fusion 360 API internally uses **cm** — all MCP tool parameters are in **cm** (e.g., 10mm = 1.0cm in tool calls)

**Skill references:**
- `tools/ClaudeFusion360MCP/docs/SKILL.md` — Full tool reference and CAD guidelines
- `tools/ClaudeFusion360MCP/docs/SPATIAL_AWARENESS.md` — Coordinate system and spatial verification
- `tools/ClaudeFusion360MCP/docs/TOOL_REFERENCE.md` — Quick tool reference

## Fabrication Equipment

**3D Printer:**
- Bambu H2D — build volume 350×320×325 mm
- 40W LED laser module (for engraving/cutting on the H2D)
- Drag knife (for vinyl, stickers, etc. on the H2D)
- Pen attachment (for drawing/plotting on the H2D)

**Laser Cutters:**
- K40 CO2 laser (40W, ~300×200 mm bed)

**CNC:**
- 1500×1500 mm CNC router with 10W LED laser
